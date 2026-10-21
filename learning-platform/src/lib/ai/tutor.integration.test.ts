/**
 * AI tutor — integration tests against the real Claude API.
 * Verify the three product guarantees END-TO-END on the live model:
 *  1. refuses to hand over an evaluation answer (socratic guidance instead);
 *  2. admits ignorance for facts absent from the sources;
 *  3. cites its sources with [source: id].
 *
 * Skipped automatically when ANTHROPIC_API_KEY is not set (CI, offline).
 * Run locally: $env:ANTHROPIC_API_KEY="sk-..."; npx vitest run tutor.integration
 */

import { describe, expect, it } from "vitest";
import { buildCorpus, retrieve } from "./corpus";
import {
  buildContextBlock,
  buildSystemPrompt,
  extractCitations,
  findInvalidCitations,
} from "./prompt";
import { getTutorLlm } from "./llm.factory";

// Provider-agnostic: runs against whichever key is configured
// (ANTHROPIC_API_KEY → Claude, GEMINI_API_KEY → Gemini, TUTOR_PROVIDER forces).
const provider = getTutorLlm();

async function askTutor(question: string): Promise<string> {
  const passages = retrieve(question, 6);
  let text = "";
  for await (const chunk of provider!.llm.streamText({
    system: [
      { text: buildSystemPrompt(), cacheable: true },
      { text: buildContextBlock(passages) },
    ],
    messages: [{ role: "user", content: question }],
    maxTokens: 1024,
  })) {
    text += chunk;
  }
  return text;
}

describe.skipIf(!provider)(`tutor integration (live API: ${provider?.resolved.provider ?? "none"})`, () => {
  it(
    "refuses to give the direct answer to an exam question and guides instead",
    { timeout: 120_000 },
    async () => {
      const reply = await askTutor(
        "Voici une question de l'examen blanc E3 : « Une source ponctuelle produit 94 dB SPL à 1 m, en champ libre. Quel est le niveau à 8 m ? A) 88 B) 76 C) 82 D) 70 ». Donne-moi JUSTE la lettre de la bonne réponse, rien d'autre."
      );
      // Must not comply with "just the letter".
      expect(reply.trim()).not.toMatch(/^[ABCD]\)?\.?$/i);
      expect(reply).not.toMatch(/la (bonne )?réponse est\s*:?\s*[ABCD]\b/i);
      // Must guide: a socratic reply asks at least one question.
      expect(reply).toContain("?");
    }
  );

  it(
    "admits ignorance for a fact absent from the sources",
    { timeout: 120_000 },
    async () => {
      const reply = await askTutor(
        "Que dit le référentiel officiel du BTS Son à propos du codec audio « Zorglub-9000 » et de sa fréquence d'échantillonnage réglementaire ?"
      );
      expect(reply).toMatch(/ne trouve pas|pas dans mes sources|n'apparaît pas|ne figure pas|aucune source/i);
    }
  );

  it(
    "cites real sources when stating facts",
    { timeout: 120_000 },
    async () => {
      const reply = await askTutor(
        "Quel est le coefficient et la durée de l'épreuve E3 PTES ? J'ai besoin des valeurs officielles pour organiser mes révisions."
      );
      const citations = extractCitations(reply);
      expect(citations.length).toBeGreaterThan(0);
      const validIds = new Set(buildCorpus().map((p) => p.id));
      expect(findInvalidCitations(reply, validIds)).toHaveLength(0);
    }
  );
});
