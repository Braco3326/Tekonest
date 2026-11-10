import { lookupString, strings as defaultStrings } from "../content/strings.fr.ts";
import { guardedAsk } from "./guard.ts";
import { shapeBrainVerdict } from "./shape.ts";
import type { BrainReply, BrainVerdict, GuideBrain } from "./brain.ts";
import { quizPolicy, whereAmI } from "./course.ts";
import type { PolicyDecision } from "./course.ts";
import { currentStep, initialFlowState, parseFlowState, reduceFlowChecked } from "./flow.ts";
import { dueForAutoRaise, hintFor, hintKey, initialHintState, initialToneState, isWithheld, raiseHint, recordNudge, shouldNudge, } from "./hints.ts";
import type { HintOutput, HintState, ToneState } from "./hints.ts";
import { MAX_DURATION_MS } from "./motion.ts";
import { gestureFor, isUsableRect, isValidAnchor, nextStep } from "./planner.ts";
import { DEFAULT_FLOW_KEYWORDS, routeQuestion } from "./router.ts";
import type { FlowKeywords, Intent, Routed } from "./router.ts";
import type { Bubble, BubbleKind, BubbleLine, Chip, ChipId, ControllerInput, CourseContext, Flow, FlowControl, FlowState, Gesture, GuideContext, GuideView, HostEvent, MascotState, NextStep, Rect, Setup, Step, } from "./types.ts";
export type { ControllerInput } from "./types.ts";
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
export interface ControllerDeps {
    brain: GuideBrain;
    flows: Flow[];
    strings?: unknown;
    clock: () => number;
    storage?: StorageLike;
    storageKey?: string;
    flowKeywords?: readonly FlowKeywords[];
}
export interface Controller {
    dispatch(input: ControllerInput): Promise<GuideView>;
    getView(): GuideView;
    subscribe(listener: (view: GuideView) => void): () => void;
}
export const AUTO_RAISE_MS = 45000;
export const FIX_IDLE_MS = 30000;
export const DEFAULT_STORAGE_KEY = "oscar-guide.state.v1";
export const REQUEST_TIMEOUT_MS = 10000;
export const ERROR_SHOWN_MS = 8000;
export const TYPING_EXPIRES_MS = 30000;
const RECT_LIMIT = 1e6;
const MAX_SETUP_CHARS = 1000000;
const MAX_COURSE_CHARS = 1000000;
const MAX_RECTS_PER_INPUT = 64;
const MAX_RECTS_KEPT = 256;
const MAX_FIRED = 100;
const MAX_BLOB_CHARS = 50000;
const MUTE_SUFFIX = ".muted";
function isRecord(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}
function own(o: object, key: string): unknown {
    const d = Object.getOwnPropertyDescriptor(o, key);
    return d !== undefined && "value" in d ? d.value : undefined;
}
function lookupIn(table: unknown, key: string): string | null {
    let node: unknown = table;
    for (const part of String(key).split(".")) {
        if (node === null || typeof node !== "object" || !Object.hasOwn(node, part))
            return null;
        node = (node as Record<string, unknown>)[part];
    }
    return typeof node === "string" ? node : null;
}
function cloneJson(v: unknown, maxChars: number): {
    key: string;
    value: Record<string, unknown>;
} | null {
    try {
        if (!isRecord(v))
            return null;
        const s = JSON.stringify(v);
        if (typeof s !== "string" || s.length > maxChars)
            return null;
        const value = JSON.parse(s) as unknown;
        return isRecord(value) ? { key: s, value } : null;
    }
    catch {
        return null;
    }
}
function copyRect(r: Rect): Rect {
    return { x: r.x, y: r.y, w: r.w, h: r.h };
}
export function parseHintState(raw: unknown): HintState {
    if (!isRecord(raw))
        return initialHintState();
    const key = own(raw, "key");
    const tier = own(raw, "tier");
    if (typeof key !== "string" || key.length > 300)
        return initialHintState();
    if (tier !== 1 && tier !== 2 && tier !== 3)
        return initialHintState();
    return { key, tier };
}
export function parseMuted(raw: unknown): boolean {
    return raw === "1";
}
function capFired(t: ToneState): ToneState {
    return t.fired.length > MAX_FIRED ? { ...t, fired: t.fired.slice(-MAX_FIRED) } : t;
}
function okRect(r: unknown): r is Rect {
    if (!isUsableRect(r as Rect | null | undefined))
        return false;
    const q = r as Rect;
    return Math.abs(q.x) <= RECT_LIMIT && Math.abs(q.y) <= RECT_LIMIT && q.w <= RECT_LIMIT && q.h <= RECT_LIMIT;
}
type Origin = "learner" | "proactive";
interface BubbleState {
    origin: Origin;
    kind: BubbleKind;
    title?: string;
    lines: BubbleLine[];
    offerFlowId?: string;
}
interface Focus {
    anchor: string;
    to?: string;
    gesture: Gesture;
}
interface Candidate {
    key: string;
    since: number;
    limitMs: number;
    next: NextStep;
}
const INTENT_OF_CHIP: Readonly<Partial<Record<ChipId, Intent>>> = Object.freeze({
    next: "next-step",
    show: "show-me",
    hint: "more-hint",
    where: "where-am-i",
    mute: "mute",
});
const REFRESHABLE_KINDS: readonly BubbleKind[] = ["step", "celebrate", "fix", "need-info", "good"];
const CHIP_IDS: readonly string[] = ["next", "show", "hint", "where", "mute", "close", "open", "start", "skip"];
function bubbleKindOf(kind: NextStep["kind"]): BubbleKind {
    switch (kind) {
        case "flow-step":
            return "step";
        case "fix":
            return "fix";
        case "need-info":
            return "need-info";
        case "good":
            return "good";
        case "course":
            return "course";
        case "locked":
            return "locked";
        default:
            return "info";
    }
}
export function createController(deps: ControllerDeps): Controller {
    const brain = deps.brain;
    const flows: Flow[] = Array.isArray(deps.flows) ? deps.flows : [];
    const table: unknown = deps.strings ?? defaultStrings;
    const keywords = deps.flowKeywords ?? DEFAULT_FLOW_KEYWORDS;
    const storage = deps.storage;
    const storageKey = deps.storageKey ?? DEFAULT_STORAGE_KEY;
    let lastNow = 0;
    const now = (): number => {
        try {
            const n = deps.clock();
            if (typeof n === "number" && Number.isFinite(n))
                lastNow = n;
        }
        catch {
        }
        return lastNow;
    };
    const tr = (key: string): string | null => lookupIn(table, key) ?? lookupString(key);
    const text = (key: string): string => tr(key) ?? "";
    const fillT = (key: string, vars: Readonly<Record<string, string | number>>): string => text(key).replace(/\{([a-z]+)\}/gu, (m, name: string) => (Object.hasOwn(vars, name) ? String(vars[name]) : m));
    const plain = (t: string): BubbleLine => ({ text: t, badge: null, citation: null });
    let page: GuideContext["page"] = "other";
    let mode: "practice" | "exam" = "exam";
    let setup: Setup | undefined;
    let setupKey = "";
    let course: CourseContext | undefined;
    let courseKey = "";
    let ctxRev = 0;
    let setupRev = 0;
    let flowState: FlowState = initialFlowState();
    let hint: HintState = initialHintState();
    let tone: ToneState = initialToneState();
    let bubble: BubbleState | null = null;
    let focus: Focus | null = null;
    let dismissed = false;
    let transient: "celebrate" | "no" | null = null;
    let error: string | null = null;
    let errorAt = 0;
    let typingAt = 0;
    let askAt: number | null = null;
    let askAbort: (() => void) | null = null;
    let judgeAt: number | null = null;
    let askSeq = 0;
    const isBusy = (): boolean => askAt !== null || judgeAt !== null;
    function setError(msg: string): void {
        error = msg;
        errorAt = now();
    }
    function cancelAsk(): void {
        askSeq++;
        askAt = null;
        const abort = askAbort;
        askAbort = null;
        if (abort !== null)
            abort();
    }
    let hintShownAt: number | null = null;
    let stepSince = now();
    let moveSince: number | null = null;
    let arrived = false;
    const rectMap = new Map<string, Rect | null>();
    let held: BrainVerdict | null = null;
    let heldRev = -1;
    let heldAt = 0;
    let failedRev = -1;
    let judging: {
        rev: number;
        promise: Promise<void>;
        gate: Promise<void>;
        release: () => void;
    } | null = null;
    const listeners = new Set<(view: GuideView) => void>();
    let lastSaved = "";
    let lastMuted = false;
    function readItem(key: string): string | null {
        if (storage === undefined)
            return null;
        try {
            const v = storage.getItem(key);
            return typeof v === "string" ? v : null;
        }
        catch {
            return null;
        }
    }
    function restore(): void {
        if (storage === undefined)
            return;
        lastMuted = parseMuted(readItem(storageKey + MUTE_SUFFIX));
        tone = { ...tone, muted: lastMuted };
        const raw = readItem(storageKey);
        if (raw === null || raw.length === 0 || raw.length > MAX_BLOB_CHARS)
            return;
        let blob: unknown;
        try {
            blob = JSON.parse(raw);
        }
        catch {
            return;
        }
        if (!isRecord(blob))
            return;
        flowState = parseFlowState(own(blob, "flow"), flows);
        const h = parseHintState(own(blob, "hint"));
        hint = { key: h.key, tier: h.tier === 3 ? 2 : h.tier };
        lastSaved = raw;
    }
    function persist(): void {
        if (storage === undefined)
            return;
        try {
            const blob = JSON.stringify({ v: 1, flow: flowState, hint });
            if (blob !== lastSaved) {
                storage.setItem(storageKey, blob);
                lastSaved = blob;
            }
            if (tone.muted !== lastMuted) {
                storage.setItem(storageKey + MUTE_SUFFIX, tone.muted ? "1" : "0");
                lastMuted = tone.muted;
            }
        }
        catch {
        }
    }
    restore();
    const hard = (): boolean => mode !== "practice";
    const ctx = (): GuideContext => {
        const c: GuideContext = { page, mode, now: now() };
        if (setup !== undefined)
            c.setup = setup;
        if (course !== undefined)
            c.course = course;
        return c;
    };
    const guarded = (): boolean => hard() || isWithheld(ctx());
    function usableVerdict(): BrainVerdict | null {
        if (mode !== "practice" || setup === undefined || held === null || heldRev !== setupRev || held.withheld === true)
            return null;
        return held;
    }
    async function ensureVerdict(): Promise<void> {
        if (mode !== "practice" || setup === undefined || guarded())
            return;
        if (heldRev === setupRev || failedRev === setupRev)
            return;
        if (judging !== null && judging.rev === setupRev) {
            const j = judging;
            await Promise.race([j.promise, j.gate]);
            return;
        }
        const rev = setupRev;
        const copy = structuredClone(setup);
        let release: () => void = () => undefined;
        const gate = new Promise<void>((res) => {
            release = res;
        });
        const promise = (async (): Promise<void> => {
            try {
                const bv = shapeBrainVerdict(await brain.judge(copy, "practice"));
                if (rev === setupRev && mode === "practice") {
                    held = bv;
                    heldRev = rev;
                    heldAt = now();
                }
            }
            catch {
                if (rev === setupRev && !guarded()) {
                    failedRev = rev;
                    setError(text("brain.error"));
                }
            }
        })();
        const mine = { rev, promise, gate, release };
        judging = mine;
        judgeAt = now();
        render();
        await Promise.race([promise, gate]);
        if (judging === mine) {
            judging = null;
            judgeAt = null;
        }
    }
    function computeNext(): NextStep {
        const v = usableVerdict();
        const needInfo = v !== null && v.needInfo !== null ? v.needInfo : undefined;
        return nextStep(ctx(), flows, flowState, v === null ? null : v.verdict, needInfo);
    }
    function sameFocus(a: Focus | null, b: Focus | null): boolean {
        if (a === null || b === null)
            return a === b;
        return a.anchor === b.anchor && a.to === b.to && a.gesture === b.gesture;
    }
    function setFocus(f: Focus | null): void {
        if (f !== null && !isValidAnchor(f.anchor))
            f = null;
        if (f !== null && f.to !== undefined && !isValidAnchor(f.to))
            f = { anchor: f.anchor, gesture: f.gesture };
        if (!sameFocus(focus, f)) {
            focus = f;
            if (f !== null) {
                rectMap.delete(f.anchor);
                if (f.to !== undefined)
                    rectMap.delete(f.to);
                moveSince = now();
                arrived = false;
            }
        }
    }
    function onRects(raw: unknown): void {
        if (!isRecord(raw))
            return;
        const before = focus !== null && okRect(rectMap.get(focus.anchor));
        let n = 0;
        for (const key of Object.keys(raw)) {
            if (++n > MAX_RECTS_PER_INPUT)
                break;
            if (!isValidAnchor(key))
                continue;
            const v = own(raw, key);
            if (rectMap.size >= MAX_RECTS_KEPT && !rectMap.has(key))
                rectMap.clear();
            rectMap.set(key, okRect(v) ? copyRect(v) : null);
        }
        const after = focus !== null && okRect(rectMap.get(focus.anchor));
        if (!before && after) {
            moveSince = now();
            arrived = false;
        }
    }
    function open(b: Omit<BubbleState, "origin">, origin: Origin, f: Focus | null): void {
        bubble = { ...b, origin };
        setFocus(f);
    }
    function showText(kind: BubbleKind, lines: string[], origin: Origin = "learner", f: Focus | null = null, title?: string): void {
        const b: Omit<BubbleState, "origin"> = { kind, lines: lines.filter((l) => l !== "").map(plain) };
        if (title !== undefined)
            b.title = title;
        open(b, origin, f);
    }
    function showWithheld(textKey: string): void {
        showText("withheld", [tr(textKey) ?? lookupString(textKey) ?? text("course.withheld")], "learner", null);
    }
    function showRefusal(d: Extract<PolicyDecision, {
        action: "refuse";
    }>): void {
        const f: Focus | null = d.anchor !== undefined && isValidAnchor(d.anchor) ? { anchor: d.anchor, gesture: "point" } : null;
        showText("refusal", [lookupString(d.textKey) ?? text("quiz.refusal")], "learner", f);
        transient = "no";
    }
    function stepText(step: Step): string {
        return tr(step.say) ?? step.say;
    }
    function flowOf(id: string): Flow | undefined {
        return flows.find((f) => f.id === id);
    }
    function flowTitle(): string | undefined {
        const flow = flowOf(flowState.flowId);
        if (flow === undefined || currentStep(flowState, flows) === null)
            return undefined;
        return fillT("where.flow", { flow: tr(flow.titleKey) ?? flow.id, i: flowState.index + 1, n: flow.steps.length });
    }
    function stepBubble(origin: Origin): void {
        const step = currentStep(flowState, flows);
        const title = flowTitle();
        if (step === null || title === undefined)
            return;
        const f: Focus = { anchor: step.anchor, gesture: "point" };
        open({ kind: "step", title, lines: [plain(stepText(step))] }, origin, f);
    }
    function nextBubble(ns: NextStep): {
        b: Omit<BubbleState, "origin">;
        f: Focus | null;
    } {
        const kind = bubbleKindOf(ns.kind);
        const keyed = ns.textKey !== undefined ? lookupString(ns.textKey) : null;
        const lines: BubbleLine[] = [];
        let title: string | undefined;
        if (ns.kind === "flow-step" && ns.step !== undefined) {
            title = flowTitle();
            lines.push(plain(stepText(ns.step)));
        }
        else if (ns.kind === "fix") {
            if (keyed !== null)
                title = keyed;
            if (ns.text !== undefined)
                lines.push(plain(ns.text));
        }
        else {
            if (ns.text !== undefined)
                lines.push(plain(ns.text));
            if (keyed !== null)
                lines.push(plain(keyed));
        }
        const b: Omit<BubbleState, "origin"> = { kind, lines };
        if (title !== undefined)
            b.title = title;
        if (ns.flowId !== undefined)
            b.offerFlowId = ns.flowId;
        const f: Focus | null = ns.anchor !== undefined && isValidAnchor(ns.anchor) ? { anchor: ns.anchor, gesture: "point" } : null;
        return { b, f };
    }
    function showNext(ns: NextStep, origin: Origin): void {
        const { b, f } = nextBubble(ns);
        if (b.lines.length === 0)
            b.lines.push(plain(text("planner.nothing")));
        open(b, origin, f);
    }
    function keyFor(ns: NextStep): string {
        const loc = course?.location;
        if (loc !== undefined && loc !== null && typeof loc === "object" && loc.kind === "quiz") {
            return hintKey(`quiz:${typeof loc.unitId === "string" ? loc.unitId : ""}`, "quiz");
        }
        const anchor = ns.anchor ?? ns.step?.anchor ?? "";
        const basis = ns.kind === "flow-step" && ns.step !== undefined ? `${flowState.flowId}:${ns.step.id}` : `${ns.kind}|${ns.text ?? ""}`;
        return hintKey(anchor, basis);
    }
    function showHint(out: HintOutput, ns: NextStep, origin: Origin): void {
        const lines: BubbleLine[] = [];
        let leadKey = out.textKey;
        const kind: BubbleKind = out.text === undefined ? "info" : bubbleKindOf(ns.kind);
        const b: Omit<BubbleState, "origin"> = { kind, lines };
        const title = ns.kind === "flow-step" ? flowTitle() : ns.kind === "fix" ? (tr("planner.fix") ?? lookupString("planner.fix") ?? undefined) : undefined;
        if (title !== undefined)
            b.title = title;
        let f: Focus | null = null;
        if (out.anchor !== undefined && out.tier >= 2) {
            if (out.tier === 3 && ns.step !== undefined) {
                f = { anchor: out.anchor, gesture: gestureFor(ns.step.action) };
                if (ns.step.to !== undefined)
                    f.to = ns.step.to;
            }
            else {
                f = { anchor: out.anchor, gesture: out.tier === 3 ? (out.gesture ?? "point") : "point" };
            }
            if (out.tier === 3 && f.gesture === "point")
                leadKey = "hint.point";
        }
        const lead = tr(leadKey) ?? lookupString(leadKey);
        if (lead !== null)
            lines.push(plain(lead));
        if (out.text !== undefined)
            lines.push(plain(out.text));
        open(b, origin, f);
    }
    async function settle(): Promise<boolean> {
        const rev = ctxRev;
        if (currentStep(flowState, flows) === null) {
            for (let round = 0; round < 2; round++) {
                await ensureVerdict();
                if (setup === undefined || heldRev === setupRev || failedRev === setupRev || guarded())
                    break;
            }
        }
        return !(ctxRev !== rev && guarded());
    }
    async function doHint(show: boolean): Promise<void> {
        if (!(await settle()))
            return;
        const ns = computeNext();
        const key = keyFor(ns);
        if (show)
            hint = { key, tier: 3 };
        else
            hint = hint.key === key ? raiseHint(hint, key) : { key, tier: 1 };
        hintShownAt = now();
        persist();
        const out = hintFor(ctx(), hint, key, ns);
        if (out === null) {
            showText("info", [text("planner.nothing")]);
            return;
        }
        showHint(out, ns, "learner");
    }
    function whenMatches(flow: Flow): boolean {
        const w = flow.when;
        if (w === undefined)
            return true;
        if (w.page !== undefined && w.page !== page)
            return false;
        if (w.mode !== undefined && w.mode !== mode)
            return false;
        return true;
    }
    function flowStarted(): void {
        stepSince = now();
        hint = initialHintState();
        hintShownAt = null;
    }
    function startAllowed(): boolean {
        const d = quizPolicy(ctx(), "how-to");
        if (d.action === "withheld") {
            showWithheld(d.textKey);
            return false;
        }
        if (d.action === "refuse") {
            showRefusal(d);
            return false;
        }
        return true;
    }
    function startFlow(flowId: string): void {
        const flow = flowOf(flowId);
        if (flow !== undefined && flow.steps.length > 0 && !whenMatches(flow)) {
            setError(text("errors.flow-unavailable"));
            return;
        }
        const r = reduceFlowChecked(flowState, { type: "start", flowId, at: now() }, flows);
        if (r.error !== null) {
            setError(tr(`errors.${r.error}`) ?? text("errors.internal"));
            return;
        }
        flowState = r.state;
        flowStarted();
        persist();
        stepBubble("learner");
    }
    function onFlow(control: unknown): void {
        if (!isRecord(control))
            return;
        const action = own(control, "action");
        if (action === "start") {
            if (!startAllowed())
                return;
            const id = own(control, "flowId");
            startFlow(typeof id === "string" ? id : "");
            return;
        }
        if (action !== "back" && action !== "skip" && action !== "restart" && action !== "stop")
            return;
        const r = reduceFlowChecked(flowState, action === "restart" ? { type: "restart", at: now() } : { type: action }, flows);
        if (r.error !== null) {
            setError(tr(`errors.${r.error}`) ?? text("errors.internal"));
            return;
        }
        const moved = JSON.stringify(r.state) !== JSON.stringify(flowState);
        flowState = r.state;
        if (moved)
            flowStarted();
        persist();
        if (flowState.status === "running")
            stepBubble("learner");
        else if (action === "stop") {
            bubble = null;
            setFocus(null);
        }
        else
            showNext(computeNext(), "learner");
    }
    function onHostEvent(raw: unknown): void {
        const evt = cleanEvent(raw);
        if (evt === null)
            return;
        const before = flowState;
        const r = reduceFlowChecked(flowState, { type: "event", event: evt }, flows);
        if (JSON.stringify(r.state) === JSON.stringify(before))
            return;
        flowState = r.state;
        flowStarted();
        persist();
        const finished = before.status === "running" && r.state.status === "done";
        if (finished && !tone.muted)
            transient = "celebrate";
        if (bubble === null && (tone.muted || dismissed || tone.typing))
            return;
        if (bubble !== null && bubble.origin === "learner" && !REFRESHABLE_KINDS.includes(bubble.kind))
            return;
        const origin: Origin = bubble === null ? "proactive" : bubble.origin;
        if (finished) {
            const flow = flowOf(before.flowId);
            const name = flow === undefined ? "" : (tr(flow.titleKey) ?? flow.id);
            open({ kind: "celebrate", lines: [plain(fillT("celebrate.done", { flow: name }))] }, origin, null);
        }
        else if (r.state.status === "running") {
            stepBubble(origin);
        }
    }
    function cleanEvent(raw: unknown): HostEvent | null {
        if (!isRecord(raw))
            return null;
        const type = own(raw, "type");
        if (typeof type !== "string" || type === "" || type.length > 64)
            return null;
        const at = own(raw, "at");
        const evt: HostEvent = { type, at: typeof at === "number" && Number.isFinite(at) ? at : now() };
        const data = own(raw, "data");
        if (isRecord(data)) {
            const out: Record<string, string | number | boolean> = {};
            let n = 0;
            for (const key of Object.keys(data)) {
                if (++n > 16)
                    break;
                if (key === "__proto__" || key.length > 64)
                    continue;
                const v = own(data, key);
                if (typeof v === "string" && v.length <= 200)
                    out[key] = v;
                else if (typeof v === "number" && Number.isFinite(v))
                    out[key] = v;
                else if (typeof v === "boolean")
                    out[key] = v;
            }
            evt.data = out;
        }
        return evt;
    }
    function setMute(on: boolean): void {
        tone = { ...tone, muted: on };
        persist();
        showText("info", [text(on ? "mute.confirm" : "mute.off")], "learner", null);
    }
    function doWhere(): void {
        if (page === "course" || course !== undefined) {
            const w = whereAmI(course);
            showText(w.withheld ? "withheld" : "info", w.lines, "learner", null);
            return;
        }
        const step = currentStep(flowState, flows);
        const flow = flowOf(flowState.flowId);
        if (step !== null && flow !== undefined) {
            const title = tr(flow.titleKey) ?? flow.id;
            showText("info", [fillT("where.flow", { flow: title, i: flowState.index + 1, n: flow.steps.length })], "learner", null);
            return;
        }
        showText("info", [text(page === "workbench" ? "where.workbench" : "where.other"), page === "workbench" ? text("where.noFlow") : ""]);
    }
    async function doNext(): Promise<void> {
        if (!(await settle()))
            return;
        showNext(computeNext(), "learner");
    }
    async function doHowTo(routed: Routed): Promise<void> {
        if (routed.flowId !== undefined) {
            startFlow(routed.flowId);
            return;
        }
        if (!(await settle()))
            return;
        const ns = computeNext();
        if (ns.flowId !== undefined)
            startFlow(ns.flowId);
        else
            showNext(ns, "learner");
    }
    async function askBrain(routed: Routed): Promise<void> {
        cancelAsk();
        const seq = askSeq;
        const rev = ctxRev;
        askAt = now();
        const gate = new Promise<null>((res) => {
            askAbort = () => res(null);
        });
        render();
        try {
            const c = ctx();
            if (c.setup !== undefined)
                c.setup = structuredClone(c.setup);
            const pending = guardedAsk(brain, c, routed);
            pending.catch(() => undefined);
            const g = await Promise.race([pending, gate]);
            if (seq !== askSeq)
                return;
            askAt = null;
            askAbort = null;
            if (g === null)
                return;
            if (ctxRev !== rev) {
                if (guarded())
                    return;
                showText("info", [text("brain.staleContext")], "learner", null);
                return;
            }
            if (g.reply === null)
                return;
            showReply(g.reply);
        }
        catch {
            if (seq === askSeq) {
                askAt = null;
                askAbort = null;
                setError(text("brain.error"));
            }
        }
    }
    function showReply(reply: BrainReply): void {
        if (reply.kind === "error") {
            setError(reply.text !== "" ? reply.text : text("brain.error"));
            return;
        }
        const kind: BubbleKind = reply.kind === "need-info" ? "need-info" : reply.kind;
        const lines: BubbleLine[] = reply.lines.length > 0
            ? reply.lines.map((l) => ({ text: l.text, badge: l.badge, citation: null }))
            : [plain(reply.text)];
        open({ kind, lines }, "learner", null);
        if (kind === "refusal")
            transient = "no";
    }
    async function runIntent(intent: Intent | "empty", routed: Routed | null): Promise<void> {
        dismissed = false;
        error = null;
        const d = quizPolicy(ctx(), intent);
        if (d.action === "withheld") {
            showWithheld(d.textKey);
            return;
        }
        if (d.action === "refuse") {
            showRefusal(d);
            return;
        }
        if (d.action === "local") {
            cancelAsk();
            switch (intent) {
                case "next-step":
                    return doNext();
                case "show-me":
                    return doHint(true);
                case "more-hint":
                    return doHint(false);
                case "where-am-i":
                    return doWhere();
                case "mute":
                    return setMute(true);
                case "how-to":
                    return routed === null ? undefined : doHowTo(routed);
                default:
                    showText("info", [text("empty.prompt")]);
                    return;
            }
        }
        if (routed === null)
            return;
        await askBrain(routed);
    }
    async function onAsk(raw: unknown): Promise<void> {
        tone = { ...tone, typing: false };
        const routed = routeQuestion(typeof raw === "string" ? raw : "", keywords);
        await runIntent(routed.intent, routed);
    }
    async function onChip(id: unknown): Promise<void> {
        if (typeof id !== "string" || !CHIP_IDS.includes(id))
            return;
        const chip = id as ChipId;
        error = null;
        if (chip === "close") {
            bubble = null;
            setFocus(null);
            dismissed = true;
            cancelAsk();
            return;
        }
        dismissed = false;
        if (chip === "open") {
            if (bubble === null)
                showText("info", [text("empty.prompt")]);
            return;
        }
        if (chip === "mute") {
            const d = quizPolicy(ctx(), "mute");
            if (d.action === "withheld")
                return showWithheld(d.textKey);
            return setMute(!tone.muted);
        }
        if ((chip === "start" || chip === "skip") && guarded()) {
            showWithheld("course.withheld");
            return;
        }
        if (chip === "start") {
            if (!startAllowed())
                return;
            const offered = bubble?.offerFlowId ?? computeNext().flowId;
            if (offered !== undefined)
                startFlow(offered);
            return;
        }
        if (chip === "skip") {
            onFlow({ action: "skip" });
            return;
        }
        const intent = INTENT_OF_CHIP[chip];
        if (intent !== undefined)
            await runIntent(intent, null);
    }
    function onSetContext(raw: unknown): void {
        if (!isRecord(raw))
            return;
        const wasHard = hard();
        const wasGuarded = guarded();
        let changed = false;
        if (Object.hasOwn(raw, "page")) {
            const p = own(raw, "page");
            const next: GuideContext["page"] = p === "workbench" || p === "course" ? p : "other";
            if (next !== page) {
                page = next;
                changed = true;
            }
        }
        if (Object.hasOwn(raw, "mode")) {
            const next = own(raw, "mode") === "practice" ? "practice" : "exam";
            if (next !== mode) {
                mode = next;
                changed = true;
            }
        }
        let setupChanged = false;
        if (Object.hasOwn(raw, "setup")) {
            const c = cloneJson(own(raw, "setup"), MAX_SETUP_CHARS);
            const key = c === null ? "" : c.key;
            if (key !== setupKey) {
                setupKey = key;
                setup = c === null ? undefined : (c.value as unknown as Setup);
                setupRev++;
                changed = true;
                setupChanged = true;
            }
        }
        if (Object.hasOwn(raw, "course")) {
            const c = cloneJson(own(raw, "course"), MAX_COURSE_CHARS);
            const key = c === null ? "" : c.key;
            if (key !== courseKey) {
                courseKey = key;
                course = c === null ? undefined : (c.value as unknown as CourseContext);
                changed = true;
            }
        }
        if (!changed)
            return;
        ctxRev++;
        if (setupChanged) {
            if (bubble !== null && (bubble.kind === "fix" || bubble.kind === "need-info" || bubble.kind === "good")) {
                bubble = null;
                setFocus(null);
            }
        }
        if (hard() || (!wasGuarded && guarded()) || (!wasHard && hard())) {
            bubble = null;
            setFocus(null);
            cancelAsk();
            transient = null;
            error = null;
            dismissed = false;
            tone = { ...tone, typing: false };
            rectMap.clear();
        }
        else if (wasGuarded && !guarded()) {
            bubble = null;
            setFocus(null);
            rectMap.clear();
        }
    }
    function candidate(): Candidate | null {
        if (guarded())
            return null;
        const step = currentStep(flowState, flows);
        if (step !== null) {
            const limit = step.hintAfterMs;
            if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0)
                return null;
            const ns: NextStep = { kind: "flow-step", step, anchor: step.anchor, text: step.say };
            return { key: keyFor(ns), since: stepSince, limitMs: limit, next: ns };
        }
        const v = usableVerdict();
        if (v === null || v.verdict === null || v.verdict.result !== "a-corriger")
            return null;
        const ns = computeNext();
        if (ns.kind !== "fix")
            return null;
        return { key: keyFor(ns), since: heldAt, limitMs: FIX_IDLE_MS, next: ns };
    }
    const proactiveAllowed = (): boolean => !dismissed && (bubble === null || bubble.origin === "proactive");
    function onTick(): void {
        const t = now();
        if (askAt !== null && t - askAt >= REQUEST_TIMEOUT_MS) {
            cancelAsk();
            setError(text("brain.error"));
        }
        if (judging !== null && judgeAt !== null && t - judgeAt >= REQUEST_TIMEOUT_MS) {
            failedRev = judging.rev;
            setError(text("brain.error"));
            judging.release();
            judging = null;
            judgeAt = null;
        }
        if (error !== null && t - errorAt >= ERROR_SHOWN_MS)
            error = null;
        if (tone.typing && t - typingAt >= TYPING_EXPIRES_MS)
            tone = { ...tone, typing: false };
        if (guarded())
            return;
        const c = candidate();
        tone = { ...tone, candidate: c !== null && t - c.since >= c.limitMs ? c.key : null };
        if (c === null)
            return;
        const fresh = !tone.fired.includes(c.key);
        if (tone.candidate !== null && fresh) {
            if (!shouldNudge(tone, ctx(), t).nudge || !proactiveAllowed())
                return;
            hint = { key: c.key, tier: 1 };
            hintShownAt = t;
            const out = hintFor(ctx(), hint, c.key, c.next);
            if (out === null)
                return;
            showHint(out, c.next, "proactive");
            tone = capFired(recordNudge(tone, c.key, t));
            persist();
            return;
        }
        if (hint.key === c.key && hint.tier < 3 && hintShownAt !== null && bubble !== null && bubble.origin === "proactive") {
            if (!dueForAutoRaise(ctx(), tone.muted, hintShownAt, AUTO_RAISE_MS, t))
                return;
            const raiseKey = `${c.key}#${hint.tier + 1}`;
            if (!shouldNudge({ ...tone, candidate: raiseKey }, ctx(), t).nudge || !proactiveAllowed())
                return;
            hint = raiseHint(hint, c.key);
            hintShownAt = t;
            const out = hintFor(ctx(), hint, c.key, c.next);
            if (out === null)
                return;
            showHint(out, c.next, "proactive");
            tone = capFired(recordNudge(tone, raiseKey, t));
            persist();
        }
    }
    function chipsFor(isHard: boolean, isGuarded: boolean): Chip[] {
        const chip = (id: ChipId, key: string): Chip => ({ id, label: text(key) });
        const muteChip = chip("mute", tone.muted ? "chips.unmute" : "chips.mute");
        if (isHard)
            return [chip("close", "chips.close")];
        if (isGuarded)
            return [chip("where", "chips.where"), muteChip, chip("close", "chips.close")];
        const out: Chip[] = [chip("next", "chips.next"), chip("show", "chips.show"), chip("hint", "chips.hint"), chip("where", "chips.where")];
        if (currentStep(flowState, flows) !== null)
            out.push(chip("skip", "chips.skip"));
        else if (bubble !== null && bubble.offerFlowId !== undefined)
            out.push(chip("start", "chips.start"));
        out.push(muteChip, chip("close", "chips.close"));
        return out;
    }
    function build(): GuideView {
        const isHard = hard();
        const isGuarded = isHard || isWithheld(ctx());
        let b: BubbleState | null = bubble;
        if (isHard && (b === null || b.kind !== "withheld"))
            b = null;
        if (isGuarded && b !== null && b.kind !== "withheld" && b.kind !== "info")
            b = null;
        const f = isGuarded ? null : focus;
        let target: GuideView["target"] = null;
        let located = false;
        let unresolved = false;
        if (f !== null) {
            const wanted = f.to !== undefined && f.gesture === "drag" ? [f.anchor, f.to] : [f.anchor];
            const rect = okRect(rectMap.get(f.anchor)) ? (rectMap.get(f.anchor) as Rect) : null;
            target = { anchor: f.anchor, rect: rect === null ? null : copyRect(rect), gesture: f.gesture };
            if (f.gesture === "drag") {
                const toRect = f.to !== undefined && okRect(rectMap.get(f.to)) ? (rectMap.get(f.to) as Rect) : null;
                target.from = rect === null ? null : copyRect(rect);
                target.to = toRect === null ? null : copyRect(toRect);
                located = rect !== null && toRect !== null;
            }
            else {
                located = rect !== null;
            }
            const known = wanted.every((a) => rectMap.has(a));
            unresolved = known && !located;
        }
        let lines: BubbleLine[] = [];
        if (b !== null) {
            lines = b.lines.map((l) => ({ text: l.text, badge: l.badge, citation: l.citation }));
            if (isGuarded)
                lines = lines.filter((l) => l.badge === null);
            if (unresolved)
                lines.push(plain(text("step.notOnScreen")));
        }
        let bubbleOut: Bubble | null = null;
        if (b !== null) {
            bubbleOut = { kind: b.kind, lines, chips: chipsFor(isHard, isGuarded) };
            if (b.title !== undefined)
                bubbleOut.title = b.title;
        }
        const moving = !arrived && moveSince !== null && now() - moveSince < MAX_DURATION_MS + 100;
        let mascot: MascotState = "idle";
        if (!isGuarded && isBusy())
            mascot = "think";
        else if (transient !== null && !isGuarded)
            mascot = transient;
        else if (target !== null && located && moving)
            mascot = "walk";
        else if (target !== null && located)
            mascot = target.gesture === "read" ? "idle" : "point";
        else if (tone.muted)
            mascot = "sleep";
        const wantAnchors: string[] = [];
        if (f !== null) {
            wantAnchors.push(f.anchor);
            if (f.gesture === "drag" && f.to !== undefined)
                wantAnchors.push(f.to);
        }
        return {
            visible: isHard ? bubbleOut !== null : true,
            muted: tone.muted,
            bubble: bubbleOut,
            target,
            mascot,
            busy: isGuarded ? false : isBusy(),
            error: isGuarded ? null : error,
            wantAnchors,
        };
    }
    let view: GuideView = build();
    function render(): void {
        view = build();
        for (const l of [...listeners]) {
            try {
                l(structuredClone(view));
            }
            catch {
            }
        }
    }
    async function handle(input: unknown): Promise<void> {
        if (!isRecord(input))
            return;
        const type = own(input, "type");
        if (type === "setContext") {
            onSetContext(own(input, "context"));
            return;
        }
        if (hard()) {
            if (type === "ask" || type === "chip") {
                if (type === "chip" && own(input, "id") === "close") {
                    bubble = null;
                    return;
                }
                showWithheld("course.withheld");
            }
            return;
        }
        if (guarded() && (type === "hostEvent" || type === "flow"))
            return;
        switch (type) {
            case "hostEvent":
                error = null;
                onHostEvent(own(input, "event"));
                return;
            case "ask":
                return onAsk(own(input, "text"));
            case "chip":
                return onChip(own(input, "id"));
            case "anchorRects":
                onRects(own(input, "rects"));
                return;
            case "arrived":
                arrived = true;
                return;
            case "typing":
                tone = { ...tone, typing: own(input, "typing") === true };
                typingAt = now();
                return;
            case "flow":
                error = null;
                dismissed = false;
                onFlow(own(input, "control") as FlowControl);
                return;
            case "tick":
                onTick();
                return;
            default:
                return;
        }
    }
    async function dispatch(input: ControllerInput): Promise<GuideView> {
        transient = null;
        try {
            await handle(input);
        }
        catch {
            askAt = null;
            setError(text("errors.internal"));
        }
        render();
        return structuredClone(view);
    }
    return {
        dispatch,
        getView: () => structuredClone(view),
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
