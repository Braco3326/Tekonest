import { lookupString } from "../content/strings.fr.ts";
import type { Verdict } from "../hostTypes.ts";
import type { PortRef } from "../hostTypes.ts";
import type { BrainKind, BrainReply, BrainVerdict } from "./brain.ts";
import type { BubbleLine } from "./types.ts";
export const MAX_STRING_CHARS = 2000;
export const MAX_LINES = 8;
const MAX_SUBJECTS = 8;
const MAX_FAMILIES = 8;
export interface ShapeOptions {
    leak?: (s: string) => boolean;
    showableNote?: (s: string) => boolean;
    allowSigned?: boolean;
}
export const BADGE_UNSIGNED = "À vérifier (non signé)";
export const BADGE_DISPUTED = "En désaccord";
const MARK_REFERENCE = " · fiche de référence";
const SIGNED_BADGE = /^Vérifié par le fondateur le (\d{4})-(\d{2})-(\d{2})$/u;
function isIsoDate(y: string, m: string, d: string): boolean {
    const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === `${y}-${m}-${d}`;
}
function checkedBadge(badge: string, opts: ShapeOptions): string {
    let base = badge;
    let mark = "";
    if (base.endsWith(MARK_REFERENCE)) {
        base = base.slice(0, -MARK_REFERENCE.length);
        mark = MARK_REFERENCE;
    }
    if (base === BADGE_UNSIGNED || base === BADGE_DISPUTED)
        return base + mark;
    const m = SIGNED_BADGE.exec(base);
    if (m !== null && isIsoDate(m[1] as string, m[2] as string, m[3] as string))
        return opts.allowSigned === true ? base + mark : BADGE_UNSIGNED + mark;
    throw new Reject("unknown badge");
}
class Reject extends Error {
}
export function isRecord(v: unknown): v is object {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}
export function own(o: object, key: string): unknown {
    const d = Object.getOwnPropertyDescriptor(o, key);
    return d !== undefined && "value" in d ? d.value : undefined;
}
const ID_SHAPE = /(?<![\p{L}\p{N}])(?:tmp[\s_-]*\d|f[_-]\d)/iu;
const TMP_ID = /(?<![\p{L}\p{N}])tmp[\s_-]+[a-z0-9]+(?:[\s_-]+[a-z0-9]+)*[\s_-]*\d+|(?<![\p{L}\p{N}])tmp[a-z]+\d+/iu;
const RULE_ID = /(?<![\p{L}\p{N}])r[\s_-]+[a-z]{2,6}[\s_-]+\d+|(?<![\p{L}\p{N}])r[\s_-]*(?:lvl|gain|hum|ph|pol|fb)[\s_-]*\d+/iu;
function foldForId(s: string): string {
    return s.replace(/\p{Cf}/gu, "").normalize("NFKC").replace(/[‐-―−]/gu, "-");
}
function safeString(v: unknown, opts: ShapeOptions, max = MAX_STRING_CHARS): string {
    if (typeof v !== "string")
        throw new Reject("not a string");
    let s = v
        .replace(/[\u2028\u2029]/gu, "\n")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]|\p{Cf}/gu, "")
        .toWellFormed();
    if (s.length > max) {
        s = s.slice(0, max);
        const last = s.charCodeAt(s.length - 1);
        if (last >= 0xd800 && last <= 0xdbff)
            s = s.slice(0, -1);
    }
    const folded = foldForId(s);
    if (ID_SHAPE.test(folded) || TMP_ID.test(folded) || RULE_ID.test(folded))
        throw new Reject("leak");
    if (opts.leak !== undefined && opts.leak(s))
        throw new Reject("leak");
    return s;
}
function elements(v: unknown, max: number): unknown[] {
    if (!Array.isArray(v))
        throw new Reject("not a list");
    const n = Math.min(v.length, max);
    const out: unknown[] = [];
    for (let i = 0; i < n; i++) {
        const d = Object.getOwnPropertyDescriptor(v, String(i));
        if (d === undefined || !("value" in d))
            throw new Reject("hole or accessor");
        out.push(d.value);
    }
    return out;
}
function nullableString(v: unknown, opts: ShapeOptions): string | null {
    if (v === null || v === undefined)
        return null;
    return safeString(v, opts);
}
function stringList(v: unknown, maxItems: number, maxChars: number, opts: ShapeOptions): string[] {
    if (v === undefined || v === null)
        return [];
    return elements(v, maxItems).map((x) => safeString(x, opts, maxChars));
}
const RESULTS: readonly string[] = ["bon", "a-corriger", "indetermine"];
const REASONS: readonly string[] = ["setup-error", "no-declaration", "missing-input", "no-coverage"];
const KINDS: readonly string[] = ["answer", "refusal", "need-info", "error", "withheld"];
function publicSubjects(v: unknown, opts: ShapeOptions): PortRef[] {
    if (v === undefined || v === null)
        return [];
    const out: PortRef[] = [];
    for (const s of elements(v, MAX_SUBJECTS)) {
        if (!isRecord(s))
            throw new Reject("bad subject");
        const instance = own(s, "instance");
        const port = own(s, "port");
        if (typeof instance !== "string" || typeof port !== "string")
            throw new Reject("bad subject");
        try {
            out.push({ instance: safeString(instance, opts, 80), port: safeString(port, opts, 80) });
        }
        catch {
        }
    }
    return out;
}
function publicNote(v: unknown, opts: ShapeOptions): string | null {
    const n = nullableString(v, opts);
    return n === null || (opts.showableNote !== undefined && !opts.showableNote(n)) ? null : n;
}
function publicVerdict(raw: unknown, opts: ShapeOptions): Verdict | null {
    if (raw === null || raw === undefined)
        return null;
    if (!isRecord(raw))
        throw new Reject("bad verdict");
    const result = own(raw, "result");
    if (typeof result !== "string" || !RESULTS.includes(result))
        throw new Reject("bad result");
    const reasonRaw = own(raw, "reason");
    if (reasonRaw !== null && reasonRaw !== undefined && (typeof reasonRaw !== "string" || !REASONS.includes(reasonRaw)))
        throw new Reject("bad reason");
    const hash = own(raw, "setupHash");
    if (typeof hash !== "string" || !/^[0-9A-Za-z:]{1,128}$/u.test(hash))
        throw new Reject("bad hash");
    let primary: Verdict["primary"] = null;
    const p = own(raw, "primary");
    if (p !== null && p !== undefined) {
        if (!isRecord(p))
            throw new Reject("bad primary");
        primary = {
            ruleId: "",
            subjects: publicSubjects(own(p, "subjects"), opts),
            causeFr: safeString(own(p, "causeFr"), opts),
            fixFr: safeString(own(p, "fixFr"), opts),
            factIds: [],
        };
    }
    return {
        setupHash: hash,
        coveredFamilies: stringList(own(raw, "coveredFamilies"), MAX_FAMILIES, 40, opts),
        result: result as Verdict["result"],
        labelFr: safeString(own(raw, "labelFr"), opts),
        reason: reasonRaw === null || reasonRaw === undefined ? null : (reasonRaw as Verdict["reason"]),
        primary,
        note: publicNote(own(raw, "note"), opts),
        alsoFound: [],
        notEvaluated: [],
    };
}
export function fixedReply(kind: BrainKind, body: string): BrainReply {
    return { kind, text: body, lines: [], verdict: null };
}
export function errorReply(): BrainReply {
    return fixedReply("error", lookupString("brain.error") ?? "");
}
export function shapeReply(raw: unknown, opts: ShapeOptions = {}): BrainReply {
    try {
        if (!isRecord(raw))
            return errorReply();
        let kind = own(raw, "kind");
        if (typeof kind !== "string" || !KINDS.includes(kind))
            return errorReply();
        if (kind === "error" && own(raw, "errorCode") === "exam-withheld")
            kind = "withheld";
        const body = safeString(own(raw, "text"), opts);
        const rawLines = own(raw, "lines");
        const lines: BubbleLine[] = [];
        if (rawLines !== undefined && rawLines !== null) {
            for (const l of elements(rawLines, MAX_LINES)) {
                if (!isRecord(l))
                    return errorReply();
                const badge = nullableString(own(l, "badge"), opts);
                lines.push({ text: safeString(own(l, "text"), opts), badge: badge === null ? null : checkedBadge(badge, opts), citation: null });
            }
        }
        return { kind: kind as BrainKind, text: body, lines, verdict: publicVerdict(own(raw, "verdict"), opts) };
    }
    catch {
        return errorReply();
    }
}
export function shapeBrainVerdict(raw: unknown, opts: ShapeOptions = {}): BrainVerdict {
    try {
        if (!isRecord(raw))
            throw new Reject("bad");
        const out: BrainVerdict = { verdict: publicVerdict(own(raw, "verdict"), opts), needInfo: nullableString(own(raw, "needInfo"), opts) };
        if (own(raw, "withheld") === true)
            out.withheld = true;
        return out;
    }
    catch {
        throw new Error("brain-verdict-invalid");
    }
}
