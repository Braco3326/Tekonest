import type { Bubble, Chip } from "../core/types.ts";
import { h, s } from "./dom.ts";
import type { Labels } from "./labels.ts";
export interface BubbleParts {
    el: HTMLElement;
    muteBtn: HTMLButtonElement;
    closeBtn: HTMLButtonElement;
    live: HTMLElement;
    status: HTMLElement;
    chips: HTMLElement;
    form: HTMLFormElement;
    input: HTMLInputElement;
    sendBtn: HTMLButtonElement;
}
const MAX_LINES_SHOWN = 12;
const MAX_TEXT_SHOWN = 4000;
const MAX_CHIPS_SHOWN = 8;
const MAX_CHIP_LABEL = 80;
function glyph(doc: Document, paths: string[], extraClass?: string): SVGElement {
    const svg = s(doc, "svg", { viewBox: "0 0 20 20", width: "18", height: "18", "aria-hidden": "true", focusable: "false" }, "oscar-glyph");
    for (const d of paths)
        svg.appendChild(s(doc, "path", { d }, extraClass));
    return svg;
}
function iconButton(doc: Document, label: string, svg: SVGElement, className: string): HTMLButtonElement {
    const b = h(doc, "button", "oscar-iconbtn " + className, undefined, { type: "button", "aria-label": label, title: label }) as HTMLButtonElement;
    b.appendChild(svg);
    return b;
}
export function createBubble(doc: Document, L: Labels): BubbleParts {
    const el = h(doc, "div", "oscar-bubble", undefined, { role: "region", "aria-label": L.region });
    el.hidden = true;
    const head = h(doc, "div", "oscar-header");
    head.appendChild(h(doc, "div", "oscar-title", L.title));
    const bell = glyph(doc, ["M10 3a4.5 4.5 0 0 0-4.5 4.5c0 3.2-1.3 4.6-2 5.5h13c-.7-.9-2-2.3-2-5.5A4.5 4.5 0 0 0 10 3z", "M8.2 15.5a1.9 1.9 0 0 0 3.6 0"]);
    bell.appendChild(s(doc, "path", { d: "M3.5 3.5l13 13" }, "oscar-slash"));
    const muteBtn = iconButton(doc, L.mute, bell, "oscar-mute");
    muteBtn.setAttribute("aria-pressed", "false");
    const closeBtn = iconButton(doc, L.close, glyph(doc, ["M5 5l10 10", "M15 5L5 15"]), "oscar-close");
    head.appendChild(muteBtn);
    head.appendChild(closeBtn);
    el.appendChild(head);
    const scroll = h(doc, "div", "oscar-scroll");
    const live = h(doc, "div", "oscar-live", undefined, { "aria-live": "polite", "aria-atomic": "false" });
    scroll.appendChild(live);
    el.appendChild(scroll);
    const status = h(doc, "div", "oscar-sr", undefined, { role: "status" });
    el.appendChild(status);
    const chips = h(doc, "div", "oscar-chips");
    el.appendChild(chips);
    const form = h(doc, "form", "oscar-form", undefined, { novalidate: "" }) as HTMLFormElement;
    const input = h(doc, "input", "oscar-input", undefined, {
        type: "text",
        maxlength: "2000",
        autocomplete: "off",
        spellcheck: "false",
        enterkeyhint: "send",
        placeholder: L.inputPlaceholder,
        "aria-label": L.inputLabel,
    }) as HTMLInputElement;
    const sendBtn = h(doc, "button", "oscar-send", L.send, { type: "submit" }) as HTMLButtonElement;
    form.appendChild(input);
    form.appendChild(sendBtn);
    el.appendChild(form);
    return { el, muteBtn, closeBtn, live, status, chips, form, input, sendBtn };
}
export function fillLive(doc: Document, live: HTMLElement, bubble: Bubble | null, error: string | null): void {
    const nodes: Node[] = [];
    if (bubble !== null) {
        if (typeof bubble.title === "string" && bubble.title !== "")
            nodes.push(h(doc, "p", "oscar-sub", bubble.title.slice(0, MAX_TEXT_SHOWN)));
        for (const line of bubble.lines.slice(0, MAX_LINES_SHOWN)) {
            const p = h(doc, "p", "oscar-line");
            if (typeof line.badge === "string" && line.badge !== "") {
                p.appendChild(h(doc, "span", "oscar-badge", line.badge.slice(0, 200)));
                p.appendChild(doc.createTextNode(" "));
            }
            p.appendChild(h(doc, "span", "oscar-text", String(line.text).slice(0, MAX_TEXT_SHOWN)));
            nodes.push(p);
        }
    }
    if (error !== null)
        nodes.push(h(doc, "p", "oscar-error", error.slice(0, MAX_TEXT_SHOWN)));
    live.replaceChildren(...nodes);
}
export function fillChips(doc: Document, row: HTMLElement, chips: readonly Chip[], onChip: (chip: Chip) => void): void {
    const active = doc.activeElement;
    const hadFocus = active !== null && row.contains(active) ? active.getAttribute("data-chip") : null;
    const buttons: HTMLElement[] = [];
    for (const chip of chips) {
        if (chip.id === "close" || chip.id === "mute")
            continue;
        if (buttons.length >= MAX_CHIPS_SHOWN)
            break;
        const b = h(doc, "button", "oscar-chip", String(chip.label).slice(0, MAX_CHIP_LABEL), { type: "button", "data-chip": chip.id });
        b.addEventListener("click", () => onChip(chip));
        buttons.push(b);
    }
    row.replaceChildren(...buttons);
    row.hidden = buttons.length === 0;
    if (hadFocus !== null) {
        for (const b of buttons) {
            if (b.getAttribute("data-chip") === hadFocus) {
                b.focus();
                break;
            }
        }
    }
}
