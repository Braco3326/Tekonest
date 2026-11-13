import type { Gesture, Keyframe, MascotState, MotionPlan, Point, Rect } from "./types.ts";
export type MotionGesture = Gesture;
export type Side = "right" | "left" | "below" | "above";
export interface MotionInput {
    from: Point;
    target: Rect | null;
    to?: Rect | null;
    viewport: {
        w: number;
        h: number;
    };
    gesture: MotionGesture;
    reducedMotion: boolean;
    iconSize?: number;
}
export interface MotionPlanEx extends MotionPlan {
    crowded: boolean;
    side: Side | null;
    ringTo: Rect | null;
}
export const ICON_SIZE = 56;
export const GAP = 8;
export const RING_PAD = 4;
export const STEP_MS = 50;
export const MAX_DURATION_MS = 2500;
export const CABLE_POINTS = 24;
const WALK_MIN_MS = 250;
const WALK_MAX_MS = 1000;
const HOLD_MS = 150;
const SIDES: readonly Side[] = ["right", "left", "below", "above"];
const GAPS: readonly number[] = [GAP, 4, 0];
const LIMIT = 1e7;
function finite(n: unknown): n is number {
    return typeof n === "number" && Number.isFinite(n);
}
function usableRect(r: Rect | null | undefined): r is Rect {
    return (r !== null &&
        r !== undefined &&
        typeof r === "object" &&
        finite(r.x) &&
        finite(r.y) &&
        finite(r.w) &&
        finite(r.h) &&
        r.w > 0 &&
        r.h > 0 &&
        Math.abs(r.x) <= LIMIT &&
        Math.abs(r.y) <= LIMIT &&
        r.w <= LIMIT &&
        r.h <= LIMIT);
}
function clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v;
}
function overlapArea(a: Rect, b: Rect): number {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
}
export function rectsIntersect(a: Rect, b: Rect): boolean {
    return overlapArea(a, b) > 0;
}
function insideViewport(r: Rect, vp: {
    w: number;
    h: number;
}): boolean {
    return r.x >= 0 && r.y >= 0 && r.x + r.w <= vp.w && r.y + r.h <= vp.h;
}
interface Place {
    x: number;
    y: number;
    side: Side;
    crowded: boolean;
}
export function placeBeside(t: Rect, vp: {
    w: number;
    h: number;
}, s: number): Place {
    const maxX = Math.max(0, vp.w - s);
    const maxY = Math.max(0, vp.h - s);
    const cy = t.y + t.h / 2 - s / 2;
    const cx = t.x + t.w / 2 - s / 2;
    const raw = (side: Side, gap: number): Point => {
        switch (side) {
            case "right":
                return { x: t.x + t.w + gap, y: cy };
            case "left":
                return { x: t.x - gap - s, y: cy };
            case "below":
                return { x: cx, y: t.y + t.h + gap };
            default:
                return { x: cx, y: t.y - gap - s };
        }
    };
    const box = (p: Point): Rect => ({ x: p.x, y: p.y, w: s, h: s });
    if (vp.w >= s && vp.h >= s) {
        for (const gap of GAPS) {
            for (const side of SIDES) {
                const p = raw(side, gap);
                const horizontal = side === "right" || side === "left";
                const primaryOk = horizontal ? p.x >= 0 && p.x <= maxX : p.y >= 0 && p.y <= maxY;
                if (!primaryOk)
                    continue;
                const q = { x: clamp(p.x, 0, maxX), y: clamp(p.y, 0, maxY) };
                if (!rectsIntersect(box(q), t) && insideViewport(box(q), vp))
                    return { ...q, side, crowded: false };
            }
        }
    }
    let best: Place | null = null;
    let bestArea = Infinity;
    for (const side of SIDES) {
        const p = raw(side, GAP);
        const q = { x: clamp(p.x, 0, maxX), y: clamp(p.y, 0, maxY) };
        const area = overlapArea(box(q), t);
        if (area < bestArea) {
            bestArea = area;
            best = { ...q, side, crowded: true };
        }
    }
    return best as Place;
}
function visibleEnough(r: Rect, vp: {
    w: number;
    h: number;
}): boolean {
    const xOk = r.w > vp.w ? r.x < vp.w && r.x + r.w > 0 : r.x >= 0 && r.x + r.w <= vp.w;
    const yOk = r.h > vp.h ? r.y < vp.h && r.y + r.h > 0 : r.y >= 0 && r.y + r.h <= vp.h;
    return xOk && yOk;
}
function ringOf(t: Rect, vp: {
    w: number;
    h: number;
}): Rect | null {
    const x0 = Math.max(0, t.x - RING_PAD);
    const y0 = Math.max(0, t.y - RING_PAD);
    const x1 = Math.min(vp.w, t.x + t.w + RING_PAD);
    const y1 = Math.min(vp.h, t.y + t.h + RING_PAD);
    if (x1 - x0 <= 0 || y1 - y0 <= 0)
        return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function centre(r: Rect): Point {
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}
export function cablePath(a: Point, b: Point): Point[] {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const sag = Math.min(len * 0.25, 80);
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + sag };
    const out: Point[] = [];
    for (let i = 0; i < CABLE_POINTS; i++) {
        const u = i / (CABLE_POINTS - 1);
        const v = 1 - u;
        out.push({
            x: v * v * a.x + 2 * v * u * c.x + u * u * b.x,
            y: v * v * a.y + 2 * v * u * c.y + u * u * b.y,
        });
    }
    return out;
}
function ease(u: number): number {
    return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}
export function finalState(g: MotionGesture): MascotState {
    return g === "read" ? "idle" : "point";
}
function walkMs(a: Point, b: Point): number {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 0.5)
        return 0;
    return clamp(d, WALK_MIN_MS, WALK_MAX_MS);
}
function pushWalk(out: Keyframe[], a: Point, b: Point, t0: number, endState: MascotState): number {
    const dur = walkMs(a, b);
    if (dur === 0) {
        if (out.length === 0)
            out.push({ t: t0, x: b.x, y: b.y, state: endState });
        return t0;
    }
    for (let t = STEP_MS; t < dur; t += STEP_MS) {
        const e = ease(t / dur);
        out.push({ t: t0 + t, x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, state: "walk" });
    }
    out.push({ t: t0 + dur, x: b.x, y: b.y, state: endState });
    return t0 + dur;
}
function unresolved(): MotionPlanEx {
    return { ok: false, reason: "unresolved", keyframes: [], ring: null, cable: null, needsScroll: false, durationMs: 0, crowded: false, side: null, ringTo: null };
}
export function planMotion(input: MotionInput): MotionPlanEx {
    const vp = input.viewport;
    if (vp === null || typeof vp !== "object" || !finite(vp.w) || !finite(vp.h) || vp.w < 1 || vp.h < 1 || vp.w > LIMIT || vp.h > LIMIT) {
        return unresolved();
    }
    const s = finite(input.iconSize) && input.iconSize > 0 && input.iconSize <= LIMIT ? input.iconSize : ICON_SIZE;
    const target = input.target;
    if (!usableRect(target))
        return unresolved();
    const isDrag = input.gesture === "drag";
    const drop = input.to;
    if (isDrag && !usableRect(drop))
        return unresolved();
    const dropRect: Rect | null = isDrag && usableRect(drop) ? drop : null;
    const pickup = placeBeside(target, vp, s);
    const rest = dropRect === null ? pickup : placeBeside(dropRect, vp, s);
    const maxX = Math.max(0, vp.w - s);
    const maxY = Math.max(0, vp.h - s);
    const f = input.from;
    const start: Point = f !== null && typeof f === "object" && finite(f.x) && finite(f.y)
        ? { x: clamp(f.x, 0, maxX), y: clamp(f.y, 0, maxY) }
        : { x: pickup.x, y: pickup.y };
    const state = finalState(input.gesture);
    const keyframes: Keyframe[] = [];
    let durationMs = 0;
    if (input.reducedMotion) {
        keyframes.push({ t: 0, x: rest.x, y: rest.y, state });
    }
    else if (dropRect === null) {
        durationMs = pushWalk(keyframes, start, { x: pickup.x, y: pickup.y }, 0, state);
    }
    else {
        let t = pushWalk(keyframes, start, { x: pickup.x, y: pickup.y }, 0, "point");
        t += HOLD_MS;
        keyframes.push({ t, x: pickup.x, y: pickup.y, state: "point" });
        t = pushWalk(keyframes, { x: pickup.x, y: pickup.y }, { x: rest.x, y: rest.y }, t, "walk");
        t += HOLD_MS;
        keyframes.push({ t, x: rest.x, y: rest.y, state });
        durationMs = t;
    }
    durationMs = Math.min(durationMs, MAX_DURATION_MS);
    const needsScroll = !visibleEnough(target, vp) || (dropRect !== null && !visibleEnough(dropRect, vp));
    return {
        ok: true,
        keyframes,
        ring: ringOf(target, vp),
        cable: dropRect === null ? null : cablePath(centre(target), centre(dropRect)),
        needsScroll,
        durationMs,
        crowded: pickup.crowded || (dropRect !== null && rest.crowded),
        side: rest.side,
        ringTo: dropRect === null ? null : ringOf(dropRect, vp),
    };
}
