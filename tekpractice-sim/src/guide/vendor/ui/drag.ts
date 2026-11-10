import type { Point } from "../core/types.ts";
import { clamp } from "./dom.ts";
import type { Listen } from "./dom.ts";
import { ICON_SIZE } from "./layout.ts";
export const DRAG_THRESHOLD = 6;
const ARROWS: readonly string[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
export interface DragHooks {
    position(): Point;
    viewport(): {
        w: number;
        h: number;
    };
    begin(): void;
    cancel(): void;
    move(p: Point): void;
    drop(p: Point): void;
    arrow(key: string): void;
}
export function attachDrag(btn: HTMLElement, root: HTMLElement, hooks: DragHooks, on: Listen): void {
    let press: {
        x: number;
        y: number;
        pos: Point;
        id: number;
        moved: boolean;
    } | null = null;
    let last: Point = { x: 0, y: 0 };
    on(btn, "pointerdown", (e) => {
        const p = e as PointerEvent;
        if (p.pointerType === "mouse" && p.button !== 0)
            return;
        press = { x: p.clientX, y: p.clientY, pos: hooks.position(), id: p.pointerId, moved: false };
        try {
            btn.setPointerCapture(p.pointerId);
        }
        catch {
        }
    });
    on(btn, "pointermove", (e) => {
        const p = e as PointerEvent;
        if (press === null || p.pointerId !== press.id)
            return;
        const dx = p.clientX - press.x;
        const dy = p.clientY - press.y;
        if (!press.moved) {
            if (Math.hypot(dx, dy) < DRAG_THRESHOLD)
                return;
            press.moved = true;
            hooks.begin();
            root.classList.add("oscar-dragging");
        }
        const v = hooks.viewport();
        last = { x: clamp(press.pos.x + dx, 0, Math.max(0, v.w - ICON_SIZE)), y: clamp(press.pos.y + dy, 0, Math.max(0, v.h - ICON_SIZE)) };
        hooks.move(last);
    });
    const release = (e: Event): void => {
        const p = e as PointerEvent;
        if (press === null || p.pointerId !== press.id)
            return;
        const moved = press.moved;
        press = null;
        if (!moved)
            return;
        root.classList.remove("oscar-dragging");
        hooks.drop(last);
    };
    const lost = (): void => {
        if (press === null || !press.moved) {
            press = null;
            return;
        }
        press = null;
        root.classList.remove("oscar-dragging");
        hooks.cancel();
    };
    on(btn, "lostpointercapture", () => lost());
    on(btn, "pointerup", release);
    on(btn, "pointercancel", release);
    on(btn, "keydown", (e) => {
        const k = e as KeyboardEvent;
        if (!ARROWS.includes(k.key) || k.altKey || k.ctrlKey || k.metaKey || k.shiftKey)
            return;
        k.preventDefault();
        hooks.arrow(k.key);
    });
}
