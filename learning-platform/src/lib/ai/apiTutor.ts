/**
 * ApiAiTutor — the default AiTutor implementation: streams from our own
 * server route /api/tutor (which holds the Anthropic API key). Swapping the
 * backend (e.g. a Supabase edge function) means writing another class that
 * implements AiTutor and changing one line in providers.tsx.
 */

import type { AiTutor, TutorContext, TutorMessage } from "./types";
import { TutorUnavailableError } from "./types";

export class ApiAiTutor implements AiTutor {
  constructor(private endpoint = "/api/tutor") {}

  async *streamReply(
    messages: TutorMessage[],
    context?: TutorContext,
    signal?: AbortSignal
  ): AsyncIterable<string> {
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, context }),
      signal,
    });

    if (res.status === 501) {
      const body = await res.json().catch(() => null);
      throw new TutorUnavailableError(
        body?.error ?? "Le tuteur IA n'est pas configuré sur ce déploiement."
      );
    }
    if (!res.ok || !res.body) {
      throw new Error(`Erreur du tuteur (${res.status}). Réessayez dans un instant.`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
  }
}
