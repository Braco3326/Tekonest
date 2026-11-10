import type { Controller } from "../core/controller.ts";
import { planMotion } from "../core/motion.ts";
import type { Chip, ControllerInput, GuideView, MascotState, Point, Rect } from "../core/types.ts";
import { glide } from "./anim.ts";
import type { Running } from "./anim.ts";
import { createBubble, fillChips, fillLive } from "./bubble.ts";
import { afterFrame, clamp, clipState, elementRect, h, isAnchorId, queryAnchor, sameRect, setText, toRect, translate } from "./dom.ts";
import { cornerAfterKey, homePosition, ICON_SIZE, loadCorner, nearestCorner, placeBubble, placeBubbleNear, saveCorner } from "./layout.ts";
import type { Corner, UiStorage } from "./layout.ts";
import { labels as defaultLabels } from "./labels.ts";
import type { Labels } from "./labels.ts";
import { createMascot } from "./mascot.ts";
import { attachDrag } from "./drag.ts";
import { watchPage } from "./watch.ts";
export { EVENT_NAME } from "./watch.ts";
import { createOverlay } from "./overlay.ts";
export interface MountOptions {
    controller: Controller;
    root?: HTMLElement;
    getRect?: (anchor: string) => Rect | null;
    window?: Window;
    document?: Document;
    reducedMotion?: boolean;
    zIndex?: number;
    context?: {
        page?: unknown;
        mode?: unknown;
        setup?: unknown;
        course?: unknown;
    };
    labels?: Partial<Labels>;
    tickMs?: number;
    storage?: UiStorage | null;
    storageKey?: string;
}
export interface GuideHandle {
    destroy(): void;
    send(input: ControllerInput): Promise<GuideView>;
}
export const UI_STORAGE_KEY = "oscar-guide.ui.v1";
const HOLD_MS = 1600;
const SETTLE_FIRST_MS = 300;
const SETTLE_AGAIN_MS = 120;
const SETTLE_MAX_MS = 1500;
interface Current {
    key: string;
    rect: Rect;
    to: Rect | null;
    w: number;
    h: number;
}
let mountCount = 0;
const mounted = new WeakMap<object, () => void>();
export function mountGuide(options: MountOptions): GuideHandle {
    const win: Window = options.window ?? window;
    const doc: Document = options.document ?? win.document;
    const controller = options.controller;
    const L: Labels = { ...defaultLabels };
    if (options.labels !== undefined) {
        for (const k of Object.keys(defaultLabels) as (keyof Labels)[]) {
            const v = options.labels[k];
            if (typeof v === "string" && v !== "")
                L[k] = v;
        }
    }
    const previous = mounted.get(doc);
    if (previous !== undefined)
        previous();
    const cleanups: (() => void)[] = [];
    const timers = new Set<number>();
    let destroyed = false;
    const on = (target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions | boolean): void => {
        target.addEventListener(type, fn, opts);
        cleanups.push(() => target.removeEventListener(type, fn, opts));
    };
    const later = (fn: () => void, ms: number): number => {
        const id = win.setTimeout(() => {
            timers.delete(id);
            fn();
        }, ms);
        timers.add(id);
        return id;
    };
    const cancelLater = (id: number | null): void => {
        if (id === null)
            return;
        win.clearTimeout(id);
        timers.delete(id);
    };
    let storage: UiStorage | null = null;
    try {
        storage = options.storage !== undefined ? options.storage : win.localStorage;
    }
    catch {
        storage = null;
    }
    const storageKey = options.storageKey ?? UI_STORAGE_KEY;
    const isReduced = (): boolean => {
        if (typeof options.reducedMotion === "boolean")
            return options.reducedMotion;
        try {
            return typeof win.matchMedia === "function" && win.matchMedia("(prefers-reduced-motion: reduce)").matches;
        }
        catch {
            return false;
        }
    };
    const vp = (): {
        w: number;
        h: number;
    } => {
        const de = doc.documentElement;
        return { w: de.clientWidth > 0 ? de.clientWidth : win.innerWidth, h: de.clientHeight > 0 ? de.clientHeight : win.innerHeight };
    };
    const root = h(doc, "div", "oscar-guide", undefined, { "data-oscar-root": "", lang: "fr", dir: "ltr" });
    root.hidden = true;
    if (typeof options.zIndex === "number" && Number.isInteger(options.zIndex) && options.zIndex >= 0 && options.zIndex <= 2147483647) {
        root.style.setProperty("--oscar-z", String(options.zIndex));
    }
    if (options.reducedMotion === true)
        root.classList.add("oscar-reduced");
    const overlay = createOverlay(doc);
    const mascot = createMascot(doc);
    const iconWrap = h(doc, "div", "oscar-icon-wrap");
    const helpId = "oscar-help-" + ++mountCount;
    const iconBtn = h(doc, "button", "oscar-icon", undefined, {
        type: "button",
        "aria-label": L.iconName,
        "aria-expanded": "false",
        "aria-describedby": helpId,
    }) as HTMLButtonElement;
    iconBtn.appendChild(mascot.el);
    iconWrap.appendChild(iconBtn);
    iconWrap.appendChild(h(doc, "span", "oscar-sr", L.iconHelp, { id: helpId }));
    const bubble = createBubble(doc, L);
    root.appendChild(overlay.cable);
    root.appendChild(overlay.ring);
    root.appendChild(overlay.ringTo);
    root.appendChild(iconWrap);
    root.appendChild(bubble.el);
    (options.root ?? doc.body ?? doc.documentElement).appendChild(root);
    let view: GuideView = controller.getView();
    let home: Corner = loadCorner(storage, storageKey);
    let iconPos: Point = homePosition(home, vp());
    let running: Running | null = null;
    let current: Current | null = null;
    let replay = false;
    let learnerMoved = false;
    let dragging = false;
    let suppressClick = false;
    let focusInputNext = false;
    let wasVisible = false;
    let wasOpen = false;
    let typing = false;
    let lastLiveKey = "";
    let lastChipKey = "";
    let lastSig = "";
    let lastTargetId = "";
    let scrollTimer: number | null = null;
    let scrollStartedAt = 0;
    const scrollTried = new Set<string>();
    let liveFillCancel: (() => void) | null = null;
    let shownMascot: MascotState = "idle";
    let holdUntil = 0;
    let pendingMascot: MascotState | null = null;
    let holdTimer: number | null = null;
    let resyncCancel: (() => void) | null = null;
    let dest: Point = iconPos;
    const send = (input: ControllerInput): Promise<GuideView> => {
        try {
            return controller.dispatch(input).catch(() => controller.getView());
        }
        catch {
            return Promise.resolve(controller.getView());
        }
    };
    const fire = (input: ControllerInput): void => {
        void send(input);
    };
    function setIconPos(p: Point): void {
        iconPos = p;
        dest = p;
        iconWrap.style.transform = translate(p);
    }
    function currentIconPos(): Point {
        if (root.hidden)
            return iconPos;
        try {
            const b = iconWrap.getBoundingClientRect();
            if (Number.isFinite(b.x) && Number.isFinite(b.y) && (b.width > 0 || b.height > 0))
                return { x: b.x, y: b.y };
        }
        catch {
        }
        return iconPos;
    }
    function stopMotion(): void {
        if (running === null)
            return;
        const p = currentIconPos();
        const r = running;
        running = null;
        r.cancel();
        setIconPos(p);
    }
    function atHome(): boolean {
        const hp = homePosition(home, vp());
        const p = currentIconPos();
        return Math.abs(hp.x - p.x) < 1 && Math.abs(hp.y - p.y) < 1;
    }
    function goHome(instant: boolean): void {
        stopMotion();
        const hp = homePosition(home, vp());
        if (instant || isReduced() || root.hidden) {
            setIconPos(hp);
            refreshMascot();
            return;
        }
        const from = currentIconPos();
        const dist = Math.hypot(hp.x - from.x, hp.y - from.y);
        if (dist < 1) {
            setIconPos(hp);
            return;
        }
        dest = hp;
        const run = glide(iconWrap, from, [{ t: clamp(dist, 200, 600), x: hp.x, y: hp.y, state: "walk" }], (p) => (iconPos = p), "ease-in-out");
        running = run;
        refreshMascot();
        void run.done.then(() => {
            if (running === run)
                running = null;
            refreshMascot();
        });
    }
    function mascotNow(): number {
        return Date.now();
    }
    function applyMascot(state: MascotState): void {
        if (state === shownMascot)
            return;
        shownMascot = state;
        mascot.setState(state);
    }
    function setMascot(state: MascotState): void {
        const sticky = state === "celebrate" || state === "no";
        if (sticky) {
            holdUntil = mascotNow() + HOLD_MS;
            pendingMascot = null;
            cancelLater(holdTimer);
            holdTimer = later(() => {
                holdTimer = null;
                holdUntil = 0;
                if (pendingMascot !== null)
                    applyMascot(pendingMascot);
                pendingMascot = null;
            }, HOLD_MS);
            applyMascot(state);
            return;
        }
        if (mascotNow() < holdUntil) {
            pendingMascot = state;
            return;
        }
        applyMascot(state);
    }
    function refreshMascot(): void {
        if (running !== null)
            return setMascot("walk");
        setMascot(view.mascot === "walk" ? "point" : view.mascot);
    }
    function resolveAnchor(id: string): Rect | null {
        if (!isAnchorId(id))
            return null;
        if (options.getRect !== undefined) {
            try {
                const r = options.getRect(id);
                if (r !== null && r !== undefined) {
                    const n = toRect(r.x, r.y, r.w, r.h);
                    if (n !== null)
                        return n;
                }
            }
            catch {
            }
        }
        return elementRect(queryAnchor(doc, id));
    }
    function syncAnchors(): boolean {
        if (destroyed || !view.visible)
            return false;
        const want = view.wantAnchors;
        const t = view.target;
        if (!Array.isArray(want) || want.length === 0 || t === null) {
            lastSig = "";
            lastTargetId = "";
            return false;
        }
        const targetId = t.anchor + "|" + t.gesture + "|" + want.join(",");
        if (targetId !== lastTargetId) {
            lastTargetId = targetId;
            lastSig = "";
        }
        const rects: Record<string, Rect | null> = {};
        for (const id of want)
            rects[id] = resolveAnchor(id);
        const sig = JSON.stringify(want.map((id) => [id, rects[id]]));
        if (sig === lastSig)
            return false;
        lastSig = sig;
        fire({ type: "anchorRects", rects });
        return true;
    }
    function scheduleResync(): void {
        if (destroyed || resyncCancel !== null)
            return;
        resyncCancel = afterFrame(win, () => {
            resyncCancel = null;
            if (destroyed)
                return;
            if (!syncAnchors())
                applyTarget(view);
            layoutBubble();
        });
    }
    function visibleRect(r: Rect): boolean {
        const v = vp();
        return r.x >= 0 && r.y >= 0 && r.x + r.w <= v.w && r.y + r.h <= v.h;
    }
    function hideVisuals(): void {
        overlay.hideRing();
        overlay.hideCable();
    }
    function clearTarget(): void {
        hideVisuals();
        current = null;
        scrollTried.clear();
        cancelLater(scrollTimer);
        scrollTimer = null;
        if (!dragging && !learnerMoved && !atHome())
            goHome(false);
        learnerMoved = false;
    }
    function settleScroll(): void {
        scrollTimer = null;
        if (!syncAnchors())
            applyTarget(view);
    }
    function clipOf(id: string | undefined): "clear" | "partial" | "hidden" {
        if (id === undefined)
            return "clear";
        const el = queryAnchor(doc, id);
        if (el === null)
            return "clear";
        const r = elementRect(el);
        return r === null ? "clear" : clipState(win, doc, el, r);
    }
    function applyTarget(v: GuideView): void {
        if (destroyed)
            return;
        const t = v.target;
        if (!v.visible || t === null) {
            if (current !== null || !overlayIdle() || (running === null && !dragging && !atHome()))
                clearTarget();
            return;
        }
        const drag = t.gesture === "drag";
        const rect = t.rect;
        const to = drag ? (t.to ?? null) : null;
        if (rect === null || (drag && to === null)) {
            hideVisuals();
            current = null;
            stopMotion();
            return;
        }
        const size = vp();
        const key = t.anchor + "|" + t.gesture + "|" + (to === null ? "" : "to");
        const same = current !== null && current.key === key && sameRect(current.rect, rect) && sameRect(current.to, to) && current.w === size.w && current.h === size.h;
        if (same && !replay)
            return;
        const fresh = current === null || current.key !== key || replay;
        replay = false;
        if (fresh)
            learnerMoved = false;
        if (dragging)
            return;
        if (!fresh && learnerMoved) {
            if (running === null)
                setIconPos(homePosition(home, size));
            return;
        }
        const reduced = isReduced();
        const instant = reduced || (!fresh && running === null);
        const from = currentIconPos();
        const plan = planMotion({ from, target: rect, to, viewport: size, gesture: t.gesture, reducedMotion: instant, iconSize: ICON_SIZE });
        if (!plan.ok) {
            hideVisuals();
            current = null;
            return;
        }
        const toId = drag && v.wantAnchors.length > 1 ? v.wantAnchors[1] : undefined;
        const clipA = clipOf(t.anchor);
        const clipB = clipOf(toId);
        if ((plan.needsScroll || clipA !== "clear" || clipB !== "clear") && !scrollTried.has(key)) {
            scrollTried.add(key);
            const id = toId !== undefined && visibleRect(rect) && clipA === "clear" ? toId : t.anchor;
            const el = queryAnchor(doc, id);
            if (el !== null) {
                try {
                    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center", inline: "nearest" });
                    overlay.hideRing();
                    cancelLater(scrollTimer);
                    scrollStartedAt = Date.now();
                    scrollTimer = later(settleScroll, SETTLE_FIRST_MS);
                    return;
                }
                catch {
                }
            }
        }
        if (scrollTimer !== null) {
            overlay.hideRing();
            return;
        }
        if (clipA === "hidden" || clipB === "hidden") {
            hideVisuals();
            current = null;
            stopMotion();
            return;
        }
        current = { key, rect, to, w: size.w, h: size.h };
        overlay.showRing(plan.ring, plan.ringTo);
        overlay.showCable(plan.cable, instant, plan.durationMs + 1200);
        stopMotion();
        const last = plan.keyframes.length > 0 ? plan.keyframes[plan.keyframes.length - 1] : null;
        if (last === null)
            return;
        if (instant) {
            setIconPos({ x: last.x, y: last.y });
            refreshMascot();
            if (fresh)
                fire({ type: "arrived" });
        }
        else {
            dest = { x: last.x, y: last.y };
            const run = glide(iconWrap, from, plan.keyframes, (p) => (iconPos = p));
            running = run;
            refreshMascot();
            void run.done.then((ok) => {
                if (!ok || running !== run || destroyed)
                    return;
                running = null;
                refreshMascot();
                fire({ type: "arrived" });
            });
        }
        layoutBubble();
    }
    function overlayIdle(): boolean {
        return overlay.ring.hidden && overlay.ringTo.hidden;
    }
    function layoutBubble(): void {
        if (bubble.el.hidden)
            return;
        bubble.el.style.maxHeight = "";
        const size = { w: bubble.el.offsetWidth, h: bubble.el.offsetHeight };
        if (size.w <= 0 || size.h <= 0)
            return;
        const avoid: Rect[] = [];
        if (current !== null) {
            const targets: Rect[] = [current.rect];
            if (current.to !== null)
                targets.push(current.to);
            const iconRect: Rect = { x: dest.x, y: dest.y, w: ICON_SIZE, h: ICON_SIZE };
            const near = placeBubbleNear(size, vp(), targets, iconRect);
            if (near !== null) {
                if (near.maxHeight !== null)
                    bubble.el.style.maxHeight = near.maxHeight + "px";
                bubble.el.style.transform = translate(near.pos);
                return;
            }
            avoid.push(...targets, iconRect);
        }
        bubble.el.style.transform = translate(placeBubble(home, size, vp(), avoid));
    }
    function renderBubble(v: GuideView): void {
        const b = v.bubble;
        const open = b !== null || v.error !== null;
        iconBtn.setAttribute("aria-expanded", open ? "true" : "false");
        bubble.el.hidden = !open;
        bubble.el.setAttribute("data-kind", b === null ? "info" : b.kind);
        bubble.el.setAttribute("aria-busy", v.busy ? "true" : "false");
        bubble.el.classList.toggle("oscar-busy", v.busy);
        setText(bubble.status, v.busy ? L.busy : "");
        if (!open) {
            if (wasOpen && root.contains(doc.activeElement) && doc.activeElement !== iconBtn)
                iconBtn.focus();
            wasOpen = false;
            focusInputNext = false;
            lastLiveKey = "";
            lastChipKey = "";
            return;
        }
        const chips = b === null ? [] : b.chips;
        const muteChip = chips.find((c) => c.id === "mute");
        bubble.muteBtn.hidden = muteChip === undefined;
        bubble.muteBtn.setAttribute("aria-pressed", v.muted ? "true" : "false");
        const muteLabel = muteChip !== undefined ? muteChip.label : v.muted ? L.unmute : L.mute;
        bubble.muteBtn.setAttribute("aria-label", muteLabel);
        bubble.muteBtn.setAttribute("title", muteLabel);
        const liveKey = JSON.stringify([b === null ? null : [b.kind, b.title, b.lines], v.error]);
        if (liveKey !== lastLiveKey) {
            lastLiveKey = liveKey;
            if (!wasOpen) {
                if (liveFillCancel !== null)
                    liveFillCancel();
                liveFillCancel = afterFrame(win, () => {
                    liveFillCancel = null;
                    if (destroyed)
                        return;
                    fillLive(doc, bubble.live, view.bubble, view.error);
                    layoutBubble();
                }, 60);
            }
            else {
                fillLive(doc, bubble.live, b, v.error);
            }
        }
        const chipKey = JSON.stringify(chips);
        if (chipKey !== lastChipKey) {
            lastChipKey = chipKey;
            fillChips(doc, bubble.chips, chips, onChip);
        }
        wasOpen = true;
        if (focusInputNext) {
            focusInputNext = false;
            bubble.input.focus();
        }
    }
    function onChip(chip: Chip): void {
        if (chip.id === "show") {
            replay = true;
            scrollTried.clear();
        }
        fire({ type: "chip", id: chip.id });
    }
    function closeBubble(): void {
        if (root.contains(doc.activeElement) && doc.activeElement !== iconBtn)
            iconBtn.focus();
        fire({ type: "chip", id: "close" });
    }
    function onView(v: GuideView): void {
        if (destroyed)
            return;
        view = v;
        root.hidden = !v.visible;
        if (!v.visible) {
            wasVisible = false;
            wasOpen = false;
            lastLiveKey = "";
            lastChipKey = "";
            stopMotion();
            hideVisuals();
            current = null;
            return;
        }
        if (!wasVisible) {
            wasVisible = true;
            stopMotion();
            setIconPos(homePosition(home, vp()));
        }
        renderBubble(v);
        refreshMascot();
        applyTarget(v);
        layoutBubble();
        void Promise.resolve().then(() => {
            syncAnchors();
        });
    }
    on(iconBtn, "click", () => {
        if (suppressClick)
            return;
        if (!bubble.el.hidden) {
            closeBubble();
            return;
        }
        focusInputNext = true;
        fire({ type: "chip", id: "open" });
    });
    on(bubble.closeBtn, "click", () => closeBubble());
    on(bubble.muteBtn, "click", () => fire({ type: "chip", id: "mute" }));
    on(bubble.form, "submit", (e) => {
        e.preventDefault();
        const text = bubble.input.value.trim();
        bubble.input.value = "";
        typing = false;
        if (text !== "")
            fire({ type: "ask", text });
    });
    on(bubble.input, "input", () => {
        const now = bubble.input.value.length > 0;
        if (now === typing)
            return;
        typing = now;
        fire({ type: "typing", typing: now });
    });
    on(bubble.input, "blur", () => {
        if (!typing)
            return;
        typing = false;
        fire({ type: "typing", typing: false });
    });
    on(root, "keydown", (e) => {
        const k = e as KeyboardEvent;
        if (k.key === "Escape" && !bubble.el.hidden && !k.isComposing) {
            k.stopPropagation();
            closeBubble();
            return;
        }
        if (k.key !== "Tab")
            k.stopPropagation();
    });
    on(doc, "keydown", (e) => {
        const k = e as KeyboardEvent;
        if (k.key !== "Escape" || k.isComposing || k.defaultPrevented || bubble.el.hidden)
            return;
        const a = doc.activeElement;
        if (a === null || a === doc.body)
            closeBubble();
    });
    attachDrag(iconBtn, root, {
        position: currentIconPos,
        viewport: vp,
        begin() {
            dragging = true;
            stopMotion();
        },
        cancel() {
            dragging = false;
            setIconPos(homePosition(home, vp()));
            scheduleResync();
        },
        move: setIconPos,
        drop(p) {
            dragging = false;
            home = nearestCorner(p, vp());
            saveCorner(storage, storageKey, home);
            learnerMoved = true;
            suppressClick = true;
            later(() => (suppressClick = false), 0);
            goHome(false);
            layoutBubble();
        },
        arrow(key) {
            const next = cornerAfterKey(home, key);
            if (next === home)
                return;
            home = next;
            saveCorner(storage, storageKey, home);
            learnerMoved = true;
            goHome(false);
            layoutBubble();
        },
    }, on);
    const stopObserver = watchPage(win, doc, root, {
        resize() {
            if (!dragging && running === null && (current === null || learnerMoved))
                setIconPos(homePosition(home, vp()));
            scheduleResync();
        },
        scroll(source) {
            try {
                if (source !== null && source !== undefined && root.contains(source as Node))
                    return;
            }
            catch {
            }
            if (scrollTimer !== null) {
                cancelLater(scrollTimer);
                if (Date.now() - scrollStartedAt > SETTLE_MAX_MS)
                    settleScroll();
                else
                    scrollTimer = later(settleScroll, SETTLE_AGAIN_MS);
            }
            scheduleResync();
        },
        change: scheduleResync,
        hostEvent(type, data) {
            const event: {
                type: string;
                at: number;
                data?: Record<string, string | number | boolean>;
            } = { type, at: Date.now() };
            if (data !== null && typeof data === "object")
                event.data = data as Record<string, string | number | boolean>;
            fire({ type: "hostEvent", event });
        },
    }, on, later, () => destroyed);
    const unsubscribe = controller.subscribe(onView);
    const tickMs = typeof options.tickMs === "number" && options.tickMs >= 0 ? options.tickMs : 5000;
    if (tickMs > 0) {
        const id = win.setInterval(() => {
            if (!doc.hidden && view.visible)
                fire({ type: "tick" });
        }, tickMs);
        cleanups.push(() => win.clearInterval(id));
    }
    const destroy = (): void => handle.destroy();
    mounted.set(doc, destroy);
    setIconPos(iconPos);
    onView(controller.getView());
    fire({ type: "setContext", context: options.context ?? {} });
    const handle: GuideHandle = {
        send,
        destroy(): void {
            if (destroyed)
                return;
            destroyed = true;
            try {
                unsubscribe();
            }
            catch {
            }
            for (const f of cleanups.splice(0))
                f();
            for (const id of [...timers])
                win.clearTimeout(id);
            timers.clear();
            if (resyncCancel !== null)
                resyncCancel();
            if (liveFillCancel !== null)
                liveFillCancel();
            liveFillCancel = null;
            stopObserver();
            if (mounted.get(doc) === destroy)
                mounted.delete(doc);
            if (running !== null)
                running.cancel();
            running = null;
            overlay.hideCable();
            root.remove();
        },
    };
    return handle;
}
