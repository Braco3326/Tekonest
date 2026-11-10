import type { Point, Rect } from "../core/types.ts";
import { clamp, intersects } from "./dom.ts";
function overlapArea(a: Rect, b: Rect): number {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const hh = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && hh > 0 ? w * hh : 0;
}
export type Corner = "br" | "bl" | "tr" | "tl";
export const CORNERS: readonly Corner[] = ["br", "bl", "tr", "tl"];
export const DEFAULT_CORNER: Corner = "br";
export const ICON_SIZE = 56;
export const MARGIN = 16;
export const BUBBLE_GAP = 8;
export interface Viewport {
    w: number;
    h: number;
}
export function isCorner(v: unknown): v is Corner {
    return typeof v === "string" && (CORNERS as readonly string[]).includes(v);
}
export function homePosition(corner: Corner, vp: Viewport): Point {
    const maxX = Math.max(0, vp.w - ICON_SIZE);
    const maxY = Math.max(0, vp.h - ICON_SIZE);
    return {
        x: clamp(corner[1] === "l" ? MARGIN : vp.w - ICON_SIZE - MARGIN, 0, maxX),
        y: clamp(corner[0] === "t" ? MARGIN : vp.h - ICON_SIZE - MARGIN, 0, maxY),
    };
}
export function nearestCorner(p: Point, vp: Viewport): Corner {
    const cx = p.x + ICON_SIZE / 2;
    const cy = p.y + ICON_SIZE / 2;
    return ((cy < vp.h / 2 ? "t" : "b") + (cx < vp.w / 2 ? "l" : "r")) as Corner;
}
export function cornerAfterKey(corner: Corner, key: string): Corner {
    const v = corner[0];
    const hz = corner[1];
    switch (key) {
        case "ArrowLeft":
            return (v + "l") as Corner;
        case "ArrowRight":
            return (v + "r") as Corner;
        case "ArrowUp":
            return ("t" + hz) as Corner;
        case "ArrowDown":
            return ("b" + hz) as Corner;
        default:
            return corner;
    }
}
export function placeBubble(corner: Corner, size: {
    w: number;
    h: number;
}, vp: Viewport, avoid: readonly Rect[]): Point {
    const bottom = corner[0] === "b";
    const right = corner[1] === "r";
    const maxX = Math.max(0, vp.w - size.w);
    const maxY = Math.max(0, vp.h - size.h);
    const dock = (b: boolean, r: boolean): Point => ({
        x: clamp(r ? vp.w - MARGIN - size.w : MARGIN, 0, maxX),
        y: clamp(b ? vp.h - MARGIN - ICON_SIZE - BUBBLE_GAP - size.h : MARGIN + ICON_SIZE + BUBBLE_GAP, 0, maxY),
    });
    const options: Point[] = [dock(bottom, right), dock(!bottom, right), dock(bottom, !right), dock(!bottom, !right)];
    let best = options[0];
    let bestArea = Infinity;
    for (const p of options) {
        const box: Rect = { x: p.x, y: p.y, w: size.w, h: size.h };
        if (!avoid.some((a) => intersects(box, a)))
            return p;
        const area = avoid.reduce((sum, a) => sum + overlapArea(box, a), 0);
        if (area < bestArea) {
            bestArea = area;
            best = p;
        }
    }
    return best;
}
export interface NearPlacement {
    pos: Point;
    maxHeight: number | null;
}
export const MIN_NEAR_HEIGHT = 140;
export function placeBubbleNear(size: {
    w: number;
    h: number;
}, vp: Viewport, targets: readonly Rect[], icon: Rect | null): NearPlacement | null {
    if (targets.length === 0 || size.w <= 0 || size.h <= 0)
        return null;
    const top = Math.min(...targets.map((t) => t.y));
    const bottom = Math.max(...targets.map((t) => t.y + t.h));
    const left = Math.min(...targets.map((t) => t.x));
    const right = Math.max(...targets.map((t) => t.x + t.w));
    const above = top - BUBBLE_GAP - BUBBLE_GAP;
    const below = vp.h - bottom - BUBBLE_GAP - BUBBLE_GAP;
    const sides: ("above" | "below")[] = above >= below ? ["above", "below"] : ["below", "above"];
    const w = Math.min(size.w, vp.w);
    const maxX = Math.max(0, vp.w - w);
    const centred = clamp((left + right) / 2 - w / 2, BUBBLE_GAP, Math.max(BUBBLE_GAP, maxX - BUBBLE_GAP));
    const xs = [centred, clamp(BUBBLE_GAP, 0, maxX), clamp(vp.w - w - BUBBLE_GAP, 0, maxX)];
    for (const side of sides) {
        const room = side === "above" ? above : below;
        if (room < MIN_NEAR_HEIGHT && room < size.h)
            continue;
        const h = Math.min(size.h, room);
        const y = side === "above" ? top - BUBBLE_GAP - h : bottom + BUBBLE_GAP;
        for (const x of xs) {
            const box: Rect = { x, y, w, h };
            if (targets.some((t) => intersects(box, t)))
                continue;
            if (icon !== null && intersects(box, icon))
                continue;
            return { pos: { x, y }, maxHeight: h < size.h ? h : null };
        }
    }
    return null;
}
export function parseCorner(raw: unknown): Corner {
    try {
        if (typeof raw !== "string" || raw.length > 200)
            return DEFAULT_CORNER;
        const v = JSON.parse(raw) as unknown;
        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
            const d = Object.getOwnPropertyDescriptor(v, "corner");
            if (d !== undefined && "value" in d && isCorner(d.value))
                return d.value;
        }
    }
    catch {
    }
    return DEFAULT_CORNER;
}
export interface UiStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
export function loadCorner(storage: UiStorage | null, key: string): Corner {
    if (storage === null)
        return DEFAULT_CORNER;
    try {
        return parseCorner(storage.getItem(key));
    }
    catch {
        return DEFAULT_CORNER;
    }
}
export function saveCorner(storage: UiStorage | null, key: string, corner: Corner): void {
    if (storage === null)
        return;
    try {
        storage.setItem(key, JSON.stringify({ corner }));
    }
    catch {
    }
}
