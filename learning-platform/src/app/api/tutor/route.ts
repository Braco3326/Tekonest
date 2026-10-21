/**
 * /api/tutor — server route for the AI tutor.
 * Holds the Anthropic API key (env only, never client-side), performs
 * retrieval over the typed corpus, streams the reply as plain text chunks.
 *
 * Design decisions: docs/adr/0001-assistant-ia-tuteur.md
 */

import { buildCorpus, retrieve } from "@/lib/ai/corpus";
import {
  buildContextBlock,
  buildSystemPrompt,
  findInvalidCitations,
} from "@/lib/ai/prompt";
import { getTutorLlm } from "@/lib/ai/llm.factory";
import type { TutorContext, TutorMessage } from "@/lib/ai/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGES = 24;
const MAX_MESSAGE_LENGTH = 4000;

interface TutorRequestBody {
  messages: TutorMessage[];
  context?: TutorContext;
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

export async function POST(req: Request): Promise<Response> {
  const provider = getTutorLlm();
  if (!provider) {
    return Response.json(
      {
        error:
          "Le tuteur IA n'est pas configuré : définissez ANTHROPIC_API_KEY ou GEMINI_API_KEY dans les variables d'environnement du déploiement.",
      },
      { status: 501 }
    );
  }

  let body: TutorRequestBody;
  try {
    body = await req.json();
  } catch {
    return badRequest("Corps de requête JSON invalide.");
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return badRequest("messages est requis.");
  }
  if (body.messages.length > MAX_MESSAGES) {
    return badRequest("Conversation trop longue — rechargez la page pour repartir de zéro.");
  }
  for (const m of body.messages) {
    if ((m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      return badRequest("Format de message invalide.");
    }
    if (m.content.length > MAX_MESSAGE_LENGTH) {
      return badRequest("Message trop long (4 000 caractères max).");
    }
  }
  const last = body.messages[body.messages.length - 1];
  if (last.role !== "user") {
    return badRequest("Le dernier message doit venir de l'étudiant.");
  }

  // Retrieval: the latest student message drives it, boosted by weak-spot
  // unit titles so révision plans pull the right lesson passages.
  const weakSpotHint = (body.context?.weakSpots ?? [])
    .map((w) => w.unitTitle)
    .join(" ");
  const unitHint = body.context?.unitSlug?.replace(/-/g, " ") ?? "";
  const passages = retrieve(`${last.content} ${unitHint} ${weakSpotHint}`.trim(), 6);

  const textStream = provider.llm.streamText({
    system: [
      { text: buildSystemPrompt(), cacheable: true },
      { text: buildContextBlock(passages, body.context) },
    ],
    messages: body.messages,
    maxTokens: 2048,
  });

  const encoder = new TextEncoder();
  const validIds = new Set(buildCorpus().map((p) => p.id));

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = "";
      try {
        for await (const chunk of textStream) {
          fullText += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
        // Guardrail: a citation that doesn't exist in the corpus is flagged
        // to the student rather than silently trusted.
        const invalid = findInvalidCitations(fullText, validIds);
        if (invalid.length > 0) {
          controller.enqueue(
            encoder.encode(
              `\n\n⚠️ Vérification automatique : la ou les références ${invalid
                .map((i) => `[source: ${i}]`)
                .join(", ")} ne correspondent à aucune source connue de la plateforme — considérez ce passage avec prudence.`
            )
          );
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      // Stops consuming the provider stream (generator return).
      void (textStream as AsyncGenerator<string>).return?.(undefined);
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
