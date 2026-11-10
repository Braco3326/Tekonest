import type { Verdict } from "../hostTypes.ts";
import type { Setup } from "../hostTypes.ts";
import type { BubbleLine, CourseLocationKind } from "./types.ts";
export type BrainKind = "answer" | "refusal" | "need-info" | "error" | "withheld";
export interface BrainReply {
    kind: BrainKind;
    text: string;
    lines: BubbleLine[];
    verdict: Verdict | null;
}
export interface BrainRequest {
    question: string;
    setup?: Setup;
    mode: "practice" | "exam";
    location?: {
        kind: CourseLocationKind;
    };
}
export interface BrainVerdict {
    verdict: Verdict | null;
    needInfo: string | null;
    withheld?: boolean;
}
export interface GuideBrain {
    ask(req: BrainRequest): Promise<BrainReply>;
    judge(setup: Setup, mode: "practice" | "exam"): Promise<BrainVerdict>;
}
