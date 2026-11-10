import type { Verdict } from "../hostTypes.ts";
import type { PortRef } from "../hostTypes.ts";
import type { Flow, FlowState, Gesture, GuideContext, NextStep, Rect, Step, StepAction } from "./types.ts";
import { currentStep } from "./flow.ts";
import { nextCourseStep } from "./course.ts";
export { FLOW_UNKNOWN, flowError } from "./flow.ts";
export const ANCHOR_PATTERN = /^(device|port|control|nav|lesson|quiz):[a-z0-9._-]{1,70}$/;
export function isValidAnchor(anchor: unknown): anchor is string {
    return typeof anchor === "string" && ANCHOR_PATTERN.test(anchor);
}
export function anchorForSubject(ref: PortRef): string {
    if (ref.port === "")
        return `device:${ref.instance}`;
    return `port:${ref.instance}.${ref.port}`;
}
export function safeAnchorForSubject(ref: PortRef): string | undefined {
    const a = anchorForSubject(ref);
    return isValidAnchor(a) ? a : undefined;
}
export function gestureFor(action: StepAction): Gesture {
    switch (action) {
        case "click":
            return "click";
        case "drag":
            return "drag";
        case "toggle":
            return "toggle";
        case "read":
        case "wait":
            return "read";
        default:
            return "point";
    }
}
function matchesPredicate(flow: Flow, ctx: GuideContext): boolean {
    const w = flow.when;
    if (w === undefined)
        return true;
    if (w.page !== undefined && w.page !== ctx.page)
        return false;
    if (w.mode !== undefined && w.mode !== ctx.mode)
        return false;
    return true;
}
function nextFlowToOffer(ctx: GuideContext, flows: Flow[], flowState: FlowState | null): Flow | undefined {
    const done = flowState === null || !Array.isArray(flowState.completed) ? [] : flowState.completed;
    return flows.find((f) => f.steps.length > 0 && !done.includes(f.id) && matchesPredicate(f, ctx));
}
export function nextStep(ctx: GuideContext, flows: Flow[], flowState: FlowState | null, verdict?: Verdict | null, needInfo?: string): NextStep {
    if (ctx.mode !== "practice")
        return { kind: "none" };
    if (flowState !== null) {
        const step = currentStep(flowState, flows);
        if (step !== null)
            return { kind: "flow-step", step, anchor: step.anchor, text: step.say };
    }
    if (verdict !== undefined && verdict !== null) {
        if (verdict.result === "a-corriger" && (verdict.primary === null || verdict.primary === undefined)) {
            return { kind: "fix", textKey: "planner.fix", text: verdict.labelFr };
        }
        if (verdict.result === "a-corriger" && verdict.primary !== null) {
            const subject = verdict.primary.subjects[0];
            const anchor = subject === undefined ? undefined : safeAnchorForSubject(subject);
            const step: Step = {
                id: `fix:${anchor ?? "none"}`,
                anchor: anchor ?? "",
                action: "point",
                say: verdict.primary.fixFr,
                done: { event: "verify" },
            };
            const out: NextStep = { kind: "fix", step, textKey: "planner.fix", text: verdict.primary.fixFr };
            if (anchor !== undefined)
                out.anchor = anchor;
            return out;
        }
        if (verdict.result === "indetermine") {
            const text = typeof needInfo === "string" && needInfo.trim() !== "" ? needInfo : verdict.labelFr;
            return { kind: "need-info", textKey: "planner.needInfo", text };
        }
        if (verdict.result === "bon") {
            const offer = nextFlowToOffer(ctx, flows, flowState);
            const out: NextStep = { kind: "good", text: verdict.labelFr };
            if (offer !== undefined) {
                out.flowId = offer.id;
                out.textKey = "planner.offerFlow";
            }
            return out;
        }
    }
    if (ctx.page === "course")
        return nextCourseStep(ctx.course);
    const offer = nextFlowToOffer(ctx, flows, flowState);
    if (offer !== undefined)
        return { kind: "none", flowId: offer.id, textKey: "planner.startFlow" };
    return { kind: "none", textKey: "planner.nothing" };
}
export function isUsableRect(r: Rect | null | undefined): r is Rect {
    return (r !== null &&
        r !== undefined &&
        typeof r === "object" &&
        Number.isFinite(r.x) &&
        Number.isFinite(r.y) &&
        Number.isFinite(r.w) &&
        Number.isFinite(r.h) &&
        r.w > 0 &&
        r.h > 0);
}
export interface StepTarget {
    anchor: string;
    rect: Rect | null;
    toAnchor?: string;
    toRect?: Rect | null;
    onScreen: boolean;
    text: string;
    textKey?: string;
}
function lookupRect(rects: Readonly<Record<string, Rect | null | undefined>>, anchor: string): Rect | null {
    const raw = Object.hasOwn(rects, anchor) ? rects[anchor] : null;
    return isUsableRect(raw) ? raw : null;
}
export function resolveStepTarget(step: Step, rects: Readonly<Record<string, Rect | null | undefined>>): StepTarget {
    const rect = lookupRect(rects, step.anchor);
    const out: StepTarget = { anchor: step.anchor, rect, onScreen: rect !== null, text: step.say };
    if (step.to !== undefined) {
        const toRect = lookupRect(rects, step.to);
        out.toAnchor = step.to;
        out.toRect = toRect;
        out.onScreen = rect !== null && toRect !== null;
    }
    if (!out.onScreen)
        out.textKey = "step.notOnScreen";
    return out;
}
