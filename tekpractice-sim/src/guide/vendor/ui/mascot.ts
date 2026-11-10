import type { MascotState } from "../core/types.ts";
import { s } from "./dom.ts";
export const MASCOT_STATES: readonly MascotState[] = ["idle", "walk", "point", "think", "celebrate", "no", "sleep"];
export interface Mascot {
    el: SVGElement;
    setState(state: MascotState): void;
}
function isState(v: unknown): v is MascotState {
    return typeof v === "string" && (MASCOT_STATES as readonly string[]).includes(v);
}
export function createMascot(doc: Document = document): Mascot {
    const root = s(doc, "svg", { viewBox: "0 0 64 64", focusable: "false", "aria-hidden": "true" }, "oscar-mascot");
    const add = (parent: Element, tag: string, attrs: Record<string, string>, className?: string): SVGElement => {
        const node = s(doc, tag, attrs, className);
        parent.appendChild(node);
        return node;
    };
    add(root, "ellipse", { cx: "32", cy: "59", rx: "13", ry: "2.6" }, "oscar-shadow");
    const body = add(root, "g", {}, "oscar-body");
    const sparks = add(body, "g", {}, "oscar-sparks");
    add(sparks, "path", { d: "M8 12 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" }, "oscar-spark oscar-spark-a");
    add(sparks, "path", { d: "M56 8 l1.6 4 l4 1.6 l-4 1.6 l-1.6 4 l-1.6 -4 l-4 -1.6 l4 -1.6 z" }, "oscar-spark oscar-spark-b");
    const arm = add(body, "g", {}, "oscar-arm");
    add(arm, "path", { d: "M46 44 L57 36" }, "oscar-arm-line");
    add(arm, "circle", { cx: "58.5", cy: "34.8", r: "3.6" }, "oscar-hand");
    add(body, "path", { d: "M12.5 33 a19.5 19.5 0 0 1 39 0" }, "oscar-band");
    add(body, "circle", { cx: "32", cy: "35", r: "19" }, "oscar-head");
    add(body, "rect", { x: "7", y: "29", width: "9", height: "15", rx: "4.5" }, "oscar-cup");
    add(body, "rect", { x: "48", y: "29", width: "9", height: "15", rx: "4.5" }, "oscar-cup");
    const eyes = add(body, "g", {}, "oscar-eyes");
    add(eyes, "circle", { cx: "25", cy: "34", r: "2.8" }, "oscar-eye");
    add(eyes, "circle", { cx: "39", cy: "34", r: "2.8" }, "oscar-eye");
    const shut = add(body, "g", {}, "oscar-eyes-shut");
    add(shut, "path", { d: "M21.5 34.5 q3.5 3.2 7 0" }, "oscar-lid");
    add(shut, "path", { d: "M35.5 34.5 q3.5 3.2 7 0" }, "oscar-lid");
    add(body, "path", { d: "M27 42.5 q5 4.2 10 0" }, "oscar-mouth oscar-mouth-smile");
    add(body, "path", { d: "M28 43.5 h8" }, "oscar-mouth oscar-mouth-flat");
    const dots = add(body, "g", {}, "oscar-think");
    add(dots, "circle", { cx: "47", cy: "13", r: "2.2" }, "oscar-dot oscar-dot-a");
    add(dots, "circle", { cx: "53", cy: "9", r: "2.2" }, "oscar-dot oscar-dot-b");
    add(dots, "circle", { cx: "59", cy: "5", r: "2.2" }, "oscar-dot oscar-dot-c");
    const zzz = add(body, "g", {}, "oscar-zzz");
    add(zzz, "path", { d: "M47 14 h6 l-6 7 h6" }, "oscar-z oscar-z-a");
    add(zzz, "path", { d: "M53 5 h4.5 l-4.5 5.5 h4.5" }, "oscar-z oscar-z-b");
    const setState = (state: MascotState): void => {
        const next: MascotState = isState(state) ? state : "idle";
        root.setAttribute("data-state", next);
        root.setAttribute("class", "oscar-mascot oscar-state-" + next);
    };
    setState("idle");
    return { el: root, setState };
}
