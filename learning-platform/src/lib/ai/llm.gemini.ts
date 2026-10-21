/**
 * TutorLlm — Google Gemini implementation. Server-only.
 * Uses the official @google/genai SDK. The system blocks are concatenated
 * into systemInstruction (Gemini has no per-block cache markers; implicit
 * caching applies automatically on 2.5 models).
 */

import { GoogleGenAI } from "@google/genai";
import type { SystemBlock, TutorLlm } from "./llm";
import type { TutorMessage } from "./types";

export class GeminiTutorLlm implements TutorLlm {
  private client: GoogleGenAI;

  constructor(apiKey: string, private model: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async *streamText(params: {
    system: SystemBlock[];
    messages: TutorMessage[];
    maxTokens: number;
  }): AsyncIterable<string> {
    const stream = await this.client.models.generateContentStream({
      model: this.model,
      contents: params.messages.map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      })),
      config: {
        systemInstruction: params.system.map((b) => b.text).join("\n\n"),
        maxOutputTokens: params.maxTokens,
      },
    });
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield text;
    }
  }
}
