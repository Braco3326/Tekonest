import type { Point, Rect } from "../core/types.ts";
export const SVG_NS = "http://www.w3.org/2000/svg";
export const ANCHOR_RE = /^[a-z0-9:._-]{1,80}$/;
export function isAnchorId(id: unknown): id is string {
    return typeof id === "string" && ANCHOR_RE.test(id);
}
export function setText(target: Node, text: string): void {
    if (target.textContent !== text)
        target.textContent = text;
}
export function h(doc: Document, tag: string, className?: string, text?: string, attrs?: Record<string, string>): HTMLElement {
    const node = doc.createElement(tag);
    if (className !== undefined && className !== "")
        node.className = className;
    if (text !== undefined)
        node.textContent = text;
    if (attrs !== undefined)
        for (const k of Object.keys(attrs))
            node.setAttribute(k, attrs[k]);
    return node;
}
export function s(doc: Document, tag: string, attrs?: Record<string, string>, className?: string): SVGElement {
    const node = doc.createElementNS(SVG_NS, tag);
    if (className !== undefined && className !== "")
        node.setAttribute("class", className);
    if (attrs !== undefined)
        for (const k of Object.keys(attrs))
            node.setAttribute(k, attrs[k]);
    return node;
}
export function toRect(x: number, y: number, w: number, hh: number): Rect | null {
    if (![x, y, w, hh].every((n) => typeof n === "number" && Number.isFinite(n)))
        return null;
    if (w <= 0 || hh <= 0)
        return null;
    const r = (n: number): number => Math.round(n * 2) / 2;
    return { x: r(x), y: r(y), w: r(w), h: r(hh) };
}
export function queryAnchor(doc: Document, id: string): Element | null {
    if (!isAnchorId(id))
        return null;
    try {
        return doc.querySelector('[data-oscar-anchor="' + id + '"]');
    }
    catch {
        return null;
    }
}
export function elementRect(el: Element | null): Rect | null {
    if (el === null)
        return null;
    try {
        const b = el.getBoundingClientRect();
        return toRect(b.x, b.y, b.width, b.height);
    }
    catch {
        return null;
    }
}
export function clipState(win: Window, doc: Document, el: Element, r: Rect): "clear" | "partial" | "hidden" {
    try {
        if (typeof win.getComputedStyle !== "function")
            return "clear";
        let x0 = r.x;
        let y0 = r.y;
        let x1 = r.x + r.w;
        let y1 = r.y + r.h;
        for (let p = el.parentElement; p !== null && p !== doc.body && p !== doc.documentElement; p = p.parentElement) {
            const cs = win.getComputedStyle(p);
            const clipX = cs.overflowX !== "visible";
            const clipY = cs.overflowY !== "visible";
            if (!clipX && !clipY)
                continue;
            const b = p.getBoundingClientRect();
            if (clipX) {
                x0 = Math.max(x0, b.left);
                x1 = Math.min(x1, b.right);
            }
            if (clipY) {
                y0 = Math.max(y0, b.top);
                y1 = Math.min(y1, b.bottom);
            }
        }
        if (x1 - x0 <= 0 || y1 - y0 <= 0)
            return "hidden";
        const lost = Math.abs(x0 - r.x) + Math.abs(y0 - r.y) + Math.abs(x1 - (r.x + r.w)) + Math.abs(y1 - (r.y + r.h));
        return lost > 0.5 ? "partial" : "clear";
    }
    catch {
        return "clear";
    }
}
export function sameRect(a: Rect | null | undefined, b: Rect | null | undefined): boolean {
    if (a === null || a === undefined || b === null || b === undefined)
        return (a ?? null) === (b ?? null);
    return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01 && Math.abs(a.w - b.w) < 0.01 && Math.abs(a.h - b.h) < 0.01;
}
export function intersects(a: Rect, b: Rect): boolean {
    return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
}
export function clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v;
}
export function translate(p: Point): string {
    return "translate(" + Math.round(p.x * 100) / 100 + "px, " + Math.round(p.y * 100) / 100 + "px)";
}
export function afterFrame(win: Window, fn: () => void, fallbackMs = 100): () => void {
    let done = false;
    const run = (): void => {
        if (done)
            return;
        done = true;
        fn();
    };
    let raf: number | null = null;
    try {
        raf = win.requestAnimationFrame(run);
    }
    catch {
        raf = null;
    }
    const t = win.setTimeout(run, fallbackMs);
    return () => {
        done = true;
        win.clearTimeout(t);
        if (raf !== null) {
            try {
                win.cancelAnimationFrame(raf);
            }
            catch {
            }
        }
    };
}
export type Listen = (target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions | boolean) => void;
