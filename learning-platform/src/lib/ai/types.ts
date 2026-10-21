/**
 * AiTutor — the third swappable seam, same rule as AuthProvider/ProgressStore.
 * Components consume ONLY this interface via useAiTutor(); the concrete
 * implementation is chosen in providers.tsx (one line to swap).
 */

export type TutorRole = "user" | "assistant";

export interface TutorMessage {
  role: TutorRole;
  content: string;
}

/** A detected weakness, computed from the ProgressStore (see weakSpots.ts). */
export interface WeakSpot {
  unitId: string;
  unitTitle: string;
  kind: "quiz-echoue" | "quiz-fragile" | "examen-non-valide" | "non-commence";
  detail: string;
}

/** Optional context sent with each conversation turn. */
export interface TutorContext {
  courseSlug?: string;
  unitSlug?: string;
  weakSpots?: WeakSpot[];
}

export interface AiTutor {
  /**
   * Stream the assistant's reply as text chunks.
   * Throws TutorUnavailableError when the backend is not configured.
   */
  streamReply(
    messages: TutorMessage[],
    context?: TutorContext,
    signal?: AbortSignal
  ): AsyncIterable<string>;
}

export class TutorUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TutorUnavailableError";
  }
}
