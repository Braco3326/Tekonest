import type { Gesture, GuideContext, NextStep } from "./types.ts";
export type HintTier = 1 | 2 | 3;
export interface HintState {
    key: string;
    tier: HintTier;
}
export interface HintOutput {
    tier: HintTier;
    kind: "nudge" | "point" | "show";
    anchor?: string;
    gesture?: Gesture;
    text?: string;
    textKey: string;
}
export interface ToneState {
    muted: boolean;
    typing: boolean;
    lastNudgeAt: number | null;
    fired: string[];
    cooldownMs: number;
    candidate: string | null;
}
export type NudgeReason = "exam" | "muted" | "typing" | "nothing" | "already" | "cooldown" | "ok";
export interface NudgeDecision {
    nudge: boolean;
    reason: NudgeReason;
    key: string | null;
}
export const DEFAULT_COOLDOWN_MS = 20000;
export const MAX_TIER = 3;
export function initialHintState(): HintState {
    return { key: "", tier: 1 };
}
export function initialToneState(cooldownMs: number = DEFAULT_COOLDOWN_MS): ToneState {
    return { muted: false, typing: false, lastNudgeAt: null, fired: [], cooldownMs, candidate: null };
}
export function verdictHash(text: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
}
export function hintKey(anchor: string, verdict: string): string {
    return `${anchor}|${verdictHash(verdict)}`;
}
export function hintTier(state: HintState, key: string): HintTier {
    if (state === null || typeof state !== "object" || state.key !== key)
        return 1;
    const t = state.tier;
    return t === 1 || t === 2 || t === 3 ? t : 1;
}
export function raiseHint(state: HintState, key: string): HintState {
    const next = Math.min(hintTier(state, key) + 1, MAX_TIER) as HintTier;
    return { key, tier: next };
}
export function resetOnChange(state: HintState, key: string): HintState {
    return state !== null && typeof state === "object" && state.key === key ? state : { key, tier: 1 };
}
export function isWithheld(ctx: GuideContext): boolean {
    if (ctx === null || typeof ctx !== "object" || ctx.mode !== "practice")
        return true;
    const course = ctx.course;
    if (course === undefined)
        return ctx.page === "course";
    if (course === null || typeof course !== "object" || !Array.isArray(course.units))
        return true;
    const loc = course.location;
    if (loc === null || typeof loc !== "object")
        return true;
    if (loc.kind === "exam")
        return true;
    if (loc.kind === "quiz") {
        const unit = course.units.find((u) => u !== null && typeof u === "object" && u.id === loc.unitId);
        if (unit === undefined || unit.quiz === null || typeof unit.quiz !== "object")
            return true;
        return unit.quiz.graded !== false;
    }
    if (loc.kind !== "lesson" && loc.kind !== "survey" && loc.kind !== "dashboard")
        return true;
    return false;
}
const LESSON_ID = /^[A-Za-z0-9:._-]{1,80}$/;
function quizLessonId(ctx: GuideContext): string | null {
    const loc = ctx.course?.location;
    if (loc === undefined)
        return null;
    let id: unknown = loc.lessonId;
    if (id === undefined) {
        const unit = ctx.course?.units.find((u) => u !== null && typeof u === "object" && u.id === loc.unitId);
        const lessons: unknown = unit?.lessons;
        id = Array.isArray(lessons) && lessons[0] !== null && typeof lessons[0] === "object" ? (lessons[0] as {
            id?: unknown;
        }).id : undefined;
    }
    return typeof id === "string" && LESSON_ID.test(id) ? id : null;
}
function stepGesture(action: string | undefined): Gesture {
    switch (action) {
        case "click":
        case "drag":
        case "toggle":
            return action;
        case "read":
        case "wait":
            return "read";
        default:
            return "point";
    }
}
export function hintFor(ctx: GuideContext, state: HintState, key: string, next: NextStep): HintOutput | null {
    if (isWithheld(ctx))
        return null;
    if (next === null || typeof next !== "object")
        return null;
    const tier = hintTier(state, key);
    const loc = ctx.course?.location;
    if (loc !== undefined && loc.kind === "quiz") {
        const lessonId = quizLessonId(ctx);
        if (lessonId === null)
            return null;
        const capped = Math.min(tier, 2) as HintTier;
        if (capped === 1)
            return { tier: 1, kind: "nudge", textKey: "hint.quizLesson" };
        return { tier: 2, kind: "point", anchor: `lesson:${lessonId}`, gesture: "point", textKey: "hint.quizLesson" };
    }
    if (next.kind === "none" || next.kind === "locked")
        return null;
    if (tier === 1) {
        const out: HintOutput = { tier: 1, kind: "nudge", textKey: "hint.nudge" };
        if (next.text !== undefined)
            out.text = next.text;
        return out;
    }
    const anchor = next.anchor ?? next.step?.anchor;
    if (anchor === undefined || anchor === "") {
        const out: HintOutput = { tier: 1, kind: "nudge", textKey: "hint.nudge" };
        if (next.text !== undefined)
            out.text = next.text;
        return out;
    }
    const out: HintOutput = tier === 2
        ? { tier: 2, kind: "point", anchor, gesture: "point", textKey: "hint.point" }
        : { tier: 3, kind: "show", anchor, gesture: stepGesture(next.step?.action), textKey: "hint.show" };
    if (next.text !== undefined)
        out.text = next.text;
    return out;
}
export function shouldNudge(state: ToneState, ctx: GuideContext, now: number): NudgeDecision {
    if (isWithheld(ctx))
        return { nudge: false, reason: "exam", key: state?.candidate ?? null };
    if (state === null || typeof state !== "object")
        return { nudge: false, reason: "nothing", key: null };
    const key = state.candidate;
    if (state.muted)
        return { nudge: false, reason: "muted", key };
    if (state.typing)
        return { nudge: false, reason: "typing", key };
    if (typeof key !== "string" || key === "")
        return { nudge: false, reason: "nothing", key: null };
    if (Array.isArray(state.fired) && state.fired.includes(key))
        return { nudge: false, reason: "already", key };
    const cd = Number.isFinite(state.cooldownMs) && state.cooldownMs >= 0 ? state.cooldownMs : DEFAULT_COOLDOWN_MS;
    if (state.lastNudgeAt !== null) {
        const since = now - state.lastNudgeAt;
        if (!(since >= cd))
            return { nudge: false, reason: "cooldown", key };
    }
    else if (!Number.isFinite(now)) {
        return { nudge: false, reason: "cooldown", key };
    }
    return { nudge: true, reason: "ok", key };
}
export function recordNudge(state: ToneState, key: string, now: number): ToneState {
    const fired = Array.isArray(state.fired) ? state.fired : [];
    return { ...state, lastNudgeAt: Number.isFinite(now) ? now : state.lastNudgeAt, fired: fired.includes(key) ? fired : [...fired, key] };
}
export function dueForAutoRaise(ctx: GuideContext, muted: boolean, sinceMs: number, limitMs: number, now: number): boolean {
    if (muted || isWithheld(ctx))
        return false;
    const elapsed = now - sinceMs;
    return Number.isFinite(elapsed) && Number.isFinite(limitMs) && limitMs > 0 && elapsed >= limitMs;
}
