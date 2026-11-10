import type { Listen } from "./dom.ts";
export const EVENT_NAME = "oscar-guide:event";
export const MUTATION_THROTTLE_MS = 150;
export interface WatchHooks {
    resize(): void;
    scroll(source: unknown): void;
    change(): void;
    hostEvent(type: string, data: unknown): void;
}
export function watchPage(win: Window, doc: Document, own: Node, hooks: WatchHooks, on: Listen, later: (fn: () => void, ms: number) => number, isDestroyed: () => boolean): () => void {
    on(win, "resize", () => hooks.resize());
    on(win, "scroll", (e) => hooks.scroll(e.target), { capture: true, passive: true });
    on(win, EVENT_NAME, (e) => {
        const detail = (e as CustomEvent).detail as unknown;
        if (detail === null || typeof detail !== "object")
            return;
        const type = (detail as {
            type?: unknown;
        }).type;
        if (typeof type !== "string" || type === "")
            return;
        hooks.hostEvent(type, (detail as {
            data?: unknown;
        }).data);
    });
    const MO = (win as unknown as {
        MutationObserver?: typeof MutationObserver;
    }).MutationObserver;
    if (typeof MO !== "function")
        return () => undefined;
    let timer: number | null = null;
    const observer = new MO((records) => {
        if (isDestroyed() || timer !== null || !records.some((r) => !own.contains(r.target)))
            return;
        timer = later(() => {
            timer = null;
            hooks.change();
        }, MUTATION_THROTTLE_MS);
    });
    observer.observe(doc.body ?? doc.documentElement, { attributes: true, attributeFilter: ["class", "style", "hidden", "open", "data-oscar-anchor"], childList: true, subtree: true });
    return () => observer.disconnect();
}
