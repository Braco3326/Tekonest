import { lookupString } from "../content/strings.fr.ts";
import { isWithheld } from "./hints.ts";
import type { Intent } from "./router.ts";
import type { CourseContext, CourseLesson, CourseLocation, CourseUnit, GuideContext, NextStep } from "./types.ts";
const CONTROL = /[\p{Cc}\p{Cf}]/gu;
const COURSE_ID = /^[a-z0-9._-]{1,70}$/;
export function cleanText(s: unknown, max = 120): string {
    if (typeof s !== "string")
        return "";
    let t = (s.length > max * 4 ? s.slice(0, max * 4) : s).replace(CONTROL, " ").replace(/\s+/gu, " ").trim();
    if (t.length > max) {
        t = t.slice(0, max);
        const last = t.charCodeAt(t.length - 1);
        if (last >= 0xd800 && last <= 0xdbff)
            t = t.slice(0, -1);
        t = t.trim();
    }
    return t.toWellFormed();
}
export function fill(key: string, vars: Readonly<Record<string, string | number>> = {}): string {
    const template = lookupString(key);
    if (template === null)
        return "";
    return template.replace(/\{([a-z]+)\}/gu, (m, name: string) => (Object.hasOwn(vars, name) ? String(vars[name]) : m));
}
function unitsOf(course: CourseContext | undefined | null): CourseUnit[] {
    if (course === undefined || course === null || typeof course !== "object" || !Array.isArray(course.units))
        return [];
    const seen = new Set<string>();
    const out: CourseUnit[] = [];
    for (const u of course.units) {
        if (u === null || typeof u !== "object" || typeof u.id !== "string" || seen.has(u.id))
            continue;
        seen.add(u.id);
        out.push(u);
    }
    return out;
}
function lessonsOf(unit: CourseUnit): CourseLesson[] {
    if (!Array.isArray(unit.lessons))
        return [];
    return unit.lessons.filter((l): l is CourseLesson => l !== null && typeof l === "object" && typeof l.id === "string");
}
function doneSet(course: CourseContext): Set<string> {
    return new Set(Array.isArray(course.done) ? course.done.filter((d): d is string => typeof d === "string") : []);
}
function quizOf(unit: CourseUnit): {
    id: string;
    graded: boolean;
} | null {
    const q = unit.quiz;
    return q !== null && q !== undefined && typeof q === "object" && typeof q.id === "string" ? q : null;
}
function isUnitDoneIn(done: ReadonlySet<string>, unit: CourseUnit): boolean {
    if (done.has(unit.id))
        return true;
    const lessons = lessonsOf(unit);
    if (lessons.length === 0)
        return false;
    const quiz = quizOf(unit);
    return lessons.every((l) => done.has(l.id)) && (quiz === null || done.has(quiz.id));
}
export function isUnitDone(course: CourseContext, unit: CourseUnit): boolean {
    return isUnitDoneIn(doneSet(course), unit);
}
export function progress(course: CourseContext | undefined | null): {
    done: number;
    total: number;
} {
    if (course === undefined || course === null)
        return { done: 0, total: 0 };
    const units = unitsOf(course);
    const done = doneSet(course);
    return { done: units.filter((u) => isUnitDoneIn(done, u)).length, total: units.length };
}
function anchorOf(kind: "lesson" | "quiz", id: string): string | undefined {
    return COURSE_ID.test(id) ? `${kind}:${id}` : undefined;
}
function ctxOf(course: CourseContext): GuideContext {
    return { page: "course", mode: "practice", now: 0, course };
}
function locationOf(course: CourseContext): CourseLocation | undefined {
    const loc = course.location;
    return loc !== null && typeof loc === "object" ? loc : undefined;
}
export interface WhereAmI {
    lines: string[];
    withheld: boolean;
    unitId?: string;
    lessonId?: string;
}
export function whereAmI(course: CourseContext | undefined | null): WhereAmI {
    if (course === undefined || course === null || typeof course !== "object")
        return { lines: [fill("course.whereUnknown")], withheld: false };
    const loc = locationOf(course);
    if (loc === undefined)
        return { lines: [fill("course.whereUnknown")], withheld: false };
    if (loc.kind === "exam")
        return { lines: [fill("course.withheld")], withheld: true };
    const { done, total } = progress(course);
    const progressLine = fill("course.progress", { done, total });
    if (loc.kind === "dashboard")
        return { lines: [fill("course.whereDashboard"), progressLine], withheld: false };
    if (loc.kind === "survey")
        return { lines: [fill("course.whereSurvey"), progressLine], withheld: false };
    const units = unitsOf(course);
    const idx = units.findIndex((u) => u.id === loc.unitId);
    const unit = idx >= 0 ? (units[idx] as CourseUnit) : undefined;
    if (unit === undefined)
        return { lines: [fill("course.whereUnknown"), progressLine], withheld: false };
    const base = { n: idx + 1, total: units.length, unit: cleanText(unit.title) };
    if (loc.kind === "quiz") {
        const q = quizOf(unit);
        const key = q === null || q.graded ? "course.whereGradedQuiz" : "course.whereQuiz";
        return { lines: [fill(key, base), progressLine], withheld: false, unitId: unit.id };
    }
    const lessons = lessonsOf(unit);
    const li = lessons.findIndex((l) => l.id === loc.lessonId);
    if (li < 0)
        return { lines: [fill("course.whereUnit", base), progressLine], withheld: false, unitId: unit.id };
    const lesson = lessons[li] as CourseLesson;
    return {
        lines: [fill("course.whereLesson", { ...base, m: li + 1, count: lessons.length, lesson: cleanText(lesson.title) }), progressLine],
        withheld: false,
        unitId: unit.id,
        lessonId: lesson.id,
    };
}
export function nextCourseStep(course: CourseContext | undefined | null): NextStep {
    if (course === undefined || course === null || typeof course !== "object")
        return { kind: "course", textKey: "course.nothing" };
    if (locationOf(course) === undefined)
        return { kind: "course", textKey: "course.nothing" };
    if (isWithheld(ctxOf(course)))
        return { kind: "none" };
    const units = unitsOf(course);
    const done = doneSet(course);
    for (const unit of units) {
        if (isUnitDoneIn(done, unit))
            continue;
        const title = cleanText(unit.title);
        const lesson = lessonsOf(unit).find((l) => !done.has(l.id));
        if (lesson !== undefined) {
            const out: NextStep = { kind: "course", text: fill("course.nextLesson", { lesson: cleanText(lesson.title), unit: title }) };
            const a = anchorOf("lesson", lesson.id);
            if (a !== undefined)
                out.anchor = a;
            return out;
        }
        const quiz = quizOf(unit);
        if (quiz !== null && !done.has(quiz.id)) {
            const out: NextStep = { kind: "course", text: fill("course.nextQuiz", { unit: title }) };
            const a = anchorOf("quiz", quiz.id);
            if (a !== undefined)
                out.anchor = a;
            return out;
        }
    }
    if (units.length === 0)
        return { kind: "course", textKey: "course.nothing" };
    const reason = lockedReason(course, { kind: "exam" });
    if (reason !== null)
        return { kind: "locked", text: reason };
    return { kind: "course", anchor: "nav:exam", text: fill("course.nextExam") };
}
export type LockTarget = {
    kind: "unit";
    unitId: string;
} | {
    kind: "exam";
};
export function lockedReason(course: CourseContext | undefined | null, target: LockTarget): string | null {
    if (course === undefined || course === null || typeof course !== "object" || target === null || typeof target !== "object")
        return null;
    const units = unitsOf(course);
    if (target.kind === "exam") {
        if (course.examUnlocked === true)
            return null;
        const done = doneSet(course);
        const remaining = units.filter((u) => !isUnitDoneIn(done, u)).map((u) => cleanText(u.title)).filter((t) => t !== "");
        if (remaining.length === 0)
            return fill("course.lockedExamOther");
        return fill("course.lockedExam", { units: remaining.join(", ") });
    }
    if (target.kind === "unit") {
        const idx = units.findIndex((u) => u.id === target.unitId);
        if (idx < 0)
            return null;
        const done = doneSet(course);
        const blocker = units.slice(0, idx).find((u) => !isUnitDoneIn(done, u));
        if (blocker === undefined)
            return null;
        return fill("course.lockedUnit", { unit: cleanText((units[idx] as CourseUnit).title), previous: cleanText(blocker.title) });
    }
    return null;
}
export const MAX_TOPICS = 6;
export const MAX_TOPIC_CHARS = 100;
export function lessonQuestion(course: CourseContext | undefined | null, lessonId: string): string | null {
    if (course === undefined || course === null || typeof course !== "object" || typeof lessonId !== "string")
        return null;
    const loc = locationOf(course);
    if (loc !== undefined && (loc.kind === "quiz" || loc.kind === "exam"))
        return null;
    for (const unit of unitsOf(course)) {
        const lesson = lessonsOf(unit).find((l) => l.id === lessonId);
        if (lesson === undefined)
            continue;
        const topics = (Array.isArray(lesson.topics) ? lesson.topics : [])
            .slice(0, MAX_TOPICS * 4)
            .map((t) => cleanText(t, MAX_TOPIC_CHARS))
            .filter((t) => t !== "")
            .slice(0, MAX_TOPICS);
        if (topics.length === 0)
            return null;
        return fill("course.lessonQuestion", { topics: topics.join(" ; ") });
    }
    return null;
}
export function currentLessonId(course: CourseContext | undefined | null): string | null {
    if (course === undefined || course === null || typeof course !== "object")
        return null;
    const loc = locationOf(course);
    if (loc === undefined)
        return null;
    const unit = unitsOf(course).find((u) => u.id === loc.unitId);
    if (unit === undefined)
        return null;
    const lessons = lessonsOf(unit);
    if (loc.lessonId !== undefined && lessons.some((l) => l.id === loc.lessonId))
        return loc.lessonId;
    return lessons[0]?.id ?? null;
}
export type PolicyDecision = {
    action: "allow";
} | {
    action: "local";
} | {
    action: "refuse";
    textKey: string;
    anchor?: string;
} | {
    action: "withheld";
    textKey: string;
};
const LOCAL_ANYWHERE: ReadonlySet<string> = new Set(["next-step", "where-am-i", "show-me", "more-hint", "mute", "how-to", "empty"]);
const LOCAL_IN_QUIZ: ReadonlySet<string> = new Set(["next-step", "where-am-i", "show-me", "more-hint", "mute", "empty"]);
const LOCAL_IN_GRADED_QUIZ: ReadonlySet<string> = new Set(["where-am-i", "mute"]);
export function quizPolicy(ctx: GuideContext, intent: Intent | "empty"): PolicyDecision {
    if (ctx === null || typeof ctx !== "object" || ctx.mode !== "practice")
        return { action: "withheld", textKey: "course.withheld" };
    const course = ctx.course;
    const loc = course === undefined || course === null ? undefined : locationOf(course);
    const courseish = ctx.page === "course" || course !== undefined;
    if (courseish && isWithheld(ctx)) {
        if (loc !== undefined && loc.kind === "quiz") {
            return LOCAL_IN_GRADED_QUIZ.has(intent) ? { action: "local" } : { action: "withheld", textKey: "quiz.gradedWithheld" };
        }
        return { action: "withheld", textKey: "course.withheld" };
    }
    if (courseish && course !== undefined && course !== null && loc !== undefined && loc.kind === "quiz") {
        if (LOCAL_IN_QUIZ.has(intent))
            return { action: "local" };
        const lessonId = currentLessonId(course);
        const out: PolicyDecision = { action: "refuse", textKey: "quiz.refusal" };
        if (lessonId !== null) {
            const a = anchorOf("lesson", lessonId);
            if (a !== undefined)
                out.anchor = a;
        }
        return out;
    }
    return LOCAL_ANYWHERE.has(intent) ? { action: "local" } : { action: "allow" };
}
