/**
 * TutorLlm — the server-side model seam. The tutor's brain (corpus, prompt,
 * citations) is provider-agnostic; only this interface touches a vendor SDK.
 * Provider selection is env-driven (see resolveProvider) so switching between
 * Claude and Gemini is a configuration change, not a code change.
 *
 * Decision record: docs/adr/0002-seam-fournisseur-llm.md
 */

import type { TutorMessage } from "./types";

export interface SystemBlock {
  text: string;
  /** Stable across requests — providers that support prompt caching use it. */
  cacheable?: boolean;
}

export interface TutorLlm {
  streamText(params: {
    system: SystemBlock[];
    messages: TutorMessage[];
    maxTokens: number;
  }): AsyncIterable<string>;
}

export type ProviderName = "anthropic" | "gemini";

export interface ResolvedProvider {
  provider: ProviderName;
  apiKey: string;
  model: string;
}

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  anthropic: "claude-opus-4-8",
  gemini: "gemini-2.5-flash",
};

/**
 * Pure provider resolution (unit-tested):
 * - TUTOR_PROVIDER forces a provider (its key must be present);
 * - otherwise the first configured key wins, Anthropic first;
 * - TUTOR_MODEL overrides the provider's default model;
 * - returns null when nothing is configured (route answers 501).
 */
export function resolveProvider(env: {
  TUTOR_PROVIDER?: string;
  TUTOR_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
}): ResolvedProvider | null {
  const keys: Record<ProviderName, string | undefined> = {
    anthropic: env.ANTHROPIC_API_KEY,
    gemini: env.GEMINI_API_KEY,
  };

  let provider: ProviderName | null = null;
  const forced = env.TUTOR_PROVIDER?.toLowerCase();
  if (forced === "anthropic" || forced === "gemini") {
    provider = keys[forced] ? forced : null;
  } else {
    provider = keys.anthropic ? "anthropic" : keys.gemini ? "gemini" : null;
  }
  if (!provider) return null;

  return {
    provider,
    apiKey: keys[provider]!,
    model: env.TUTOR_MODEL || DEFAULT_MODELS[provider],
  };
}
