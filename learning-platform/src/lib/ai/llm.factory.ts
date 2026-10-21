/**
 * Server-only factory: env → concrete TutorLlm.
 * Kept separate from llm.ts so the pure resolution logic stays importable
 * (and testable) without pulling the vendor SDKs.
 */

import type { ResolvedProvider, TutorLlm } from "./llm";
import { resolveProvider } from "./llm";
import { AnthropicTutorLlm } from "./llm.anthropic";
import { GeminiTutorLlm } from "./llm.gemini";

export function getTutorLlm(): { llm: TutorLlm; resolved: ResolvedProvider } | null {
  const resolved = resolveProvider({
    TUTOR_PROVIDER: process.env.TUTOR_PROVIDER,
    TUTOR_MODEL: process.env.TUTOR_MODEL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  });
  if (!resolved) return null;
  const llm =
    resolved.provider === "anthropic"
      ? new AnthropicTutorLlm(resolved.apiKey, resolved.model)
      : new GeminiTutorLlm(resolved.apiKey, resolved.model);
  return { llm, resolved };
}
