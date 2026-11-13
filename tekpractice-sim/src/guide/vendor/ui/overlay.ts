import type { Point, Rect } from "../core/types.ts";
import { fadeCycle } from "./anim.ts";
import { h, s } from "./dom.ts";
export interface Overlay {
    ring: HTMLElement;
    ringTo: HTMLElement;
    cable: SVGElement;
    showRing(main: Rect | null, drop: Rect | null): void;
    hideRing(): void;
    showCable(points: readonly Point[] | null, still: boolean, holdMs: number): void;
    hideCable(): void;
}
function place(el: HTMLElement, r: Rect): void {
    el.style.left = Math.round(r.x) + "px";
    el.style.top = Math.round(r.y) + "px";
    el.style.width = Math.round(r.w) + "px";
    el.style.height = Math.round(r.h) + "px";
    el.hidden = false;
}
export function createOverlay(doc: Document): Overlay {
    const ring = h(doc, "div", "oscar-ring", undefined, { "aria-hidden": "true" });
    const ringTo = h(doc, "div", "oscar-ring oscar-ring-drop", undefined, { "aria-hidden": "true" });
    ring.hidden = true;
    ringTo.hidden = true;
    const cable = s(doc, "svg", { "aria-hidden": "true", focusable: "false" }, "oscar-cable");
    const group = s(doc, "g", {}, "oscar-cable-group");
    const path = s(doc, "path", { d: "" }, "oscar-cable-path");
    const plugA = s(doc, "circle", { r: "6" }, "oscar-cable-plug");
    const plugB = s(doc, "circle", { r: "6" }, "oscar-cable-plug");
    group.appendChild(path);
    group.appendChild(plugA);
    group.appendChild(plugB);
    cable.appendChild(group);
    cable.setAttribute("hidden", "");
    let stop: () => void = () => undefined;
    const hideCable = (): void => {
        stop();
        stop = () => undefined;
        cable.setAttribute("hidden", "");
    };
    return {
        ring,
        ringTo,
        cable,
        showRing(main, drop) {
            if (main === null)
                ring.hidden = true;
            else
                place(ring, main);
            if (drop === null)
                ringTo.hidden = true;
            else
                place(ringTo, drop);
        },
        hideRing() {
            ring.hidden = true;
            ringTo.hidden = true;
        },
        showCable(points, still, holdMs) {
            stop();
            stop = () => undefined;
            if (points === null || points.length < 2) {
                cable.setAttribute("hidden", "");
                return;
            }
            let d = "";
            for (let i = 0; i < points.length; i++)
                d += (i === 0 ? "M" : "L") + Math.round(points[i].x * 10) / 10 + " " + Math.round(points[i].y * 10) / 10 + " ";
            path.setAttribute("d", d.trim());
            const a = points[0];
            const b = points[points.length - 1];
            plugA.setAttribute("cx", String(Math.round(a.x * 10) / 10));
            plugA.setAttribute("cy", String(Math.round(a.y * 10) / 10));
            plugB.setAttribute("cx", String(Math.round(b.x * 10) / 10));
            plugB.setAttribute("cy", String(Math.round(b.y * 10) / 10));
            cable.removeAttribute("hidden");
            if (still)
                (group as unknown as HTMLElement).style.opacity = "1";
            else
                stop = fadeCycle(group, holdMs);
        },
        hideCable,
    };
}
