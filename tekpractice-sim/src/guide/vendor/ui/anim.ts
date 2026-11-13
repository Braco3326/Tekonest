import type { Keyframe as MotionKeyframe, Point } from "../core/types.ts";
import { translate } from "./dom.ts";
export interface Running {
    done: Promise<boolean>;
    cancel(): void;
}
function ended(): Running {
    return { done: Promise.resolve(true), cancel: () => undefined };
}
export function glide(el: HTMLElement, from: Point, frames: readonly MotionKeyframe[], onCommit: (p: Point) => void, easing = "linear"): Running {
    const last = frames.length > 0 ? frames[frames.length - 1] : null;
    if (last === null)
        return ended();
    const end: Point = { x: last.x, y: last.y };
    const commit = (): void => {
        el.style.transform = translate(end);
        onCommit(end);
    };
    const total = last.t;
    if (typeof el.animate !== "function" || !(total > 0)) {
        commit();
        return ended();
    }
    const steps: {
        transform: string;
        offset: number;
    }[] = [{ transform: translate(from), offset: 0 }];
    let prev = 0;
    for (const k of frames) {
        const offset = Math.max(prev, Math.min(1, k.t / total));
        steps.push({ transform: translate({ x: k.x, y: k.y }), offset });
        prev = offset;
    }
    steps[steps.length - 1].offset = 1;
    let anim: Animation;
    try {
        anim = el.animate(steps, { duration: total, easing, fill: "forwards" });
    }
    catch {
        commit();
        return ended();
    }
    let settled = false;
    const done = new Promise<boolean>((resolve) => {
        anim.onfinish = () => {
            if (settled)
                return;
            settled = true;
            commit();
            resolve(true);
            anim.cancel();
        };
        anim.oncancel = () => {
            settled = true;
            resolve(false);
        };
    });
    return {
        done,
        cancel: () => {
            if (!settled)
                anim.cancel();
        },
    };
}
export function fadeCycle(el: Element, holdMs: number): () => void {
    if (typeof (el as HTMLElement).animate !== "function")
        return () => undefined;
    try {
        const total = 400 + holdMs + 600;
        const anim = (el as HTMLElement).animate([
            { opacity: 0, offset: 0 },
            { opacity: 1, offset: 400 / total },
            { opacity: 1, offset: (400 + holdMs) / total },
            { opacity: 0, offset: 1 },
        ], { duration: total, easing: "linear", fill: "forwards" });
        return () => anim.cancel();
    }
    catch {
        return () => undefined;
    }
}
