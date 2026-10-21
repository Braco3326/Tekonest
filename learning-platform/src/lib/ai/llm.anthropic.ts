/**
 * TutorLlm — Anthropic (Claude) implementation. Server-only.
 * Adaptive thinking + medium effort + prompt caching on the stable block
 * (see ADR 0001 §5).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SystemBlock, TutorLlm } from "./llm";
import type { TutorMessage } from "./types";

export class AnthropicTutorLlm implements TutorLlm {
  private client: Anthropic;

  constructor(apiKey: string, private model: string) {
    this.client = new Anthropic({ apiKey });
  }

  async *streamText(params: {
    system: SystemBlock[];
    messages: TutorMessage[];
    maxTokens: number;
  }): AsyncIterable<string> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: params.maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: params.system.map((b) =>
        b.cacheable
          ? { type: "text" as const, text: b.text, cache_control: { type: "ephemeral" as const } }
          : { type: "text" as const, text: b.text }
      ),
      messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }
}
