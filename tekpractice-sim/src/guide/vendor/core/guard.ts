import { lookupString } from "../content/strings.fr.ts";
import { currentLessonId, lessonQuestion, quizPolicy } from "./course.ts";
import { fixedReply, shapeReply } from "./shape.ts";
import type { BrainReply, BrainRequest, GuideBrain } from "./brain.ts";
import type { Routed } from "./router.ts";
import type { GuideContext } from "./types.ts";
export interface Guarded {
    called: boolean;
    reply: BrainReply | null;
}
const text = (key: string): string => lookupString(key) ?? "";
export async function guardedAsk(brain: GuideBrain, ctx: GuideContext, routed: Routed, sanitize: (raw: unknown) => BrainReply = shapeReply): Promise<Guarded> {
    const d = quizPolicy(ctx, routed.intent);
    if (d.action === "withheld")
        return { called: false, reply: fixedReply("withheld", text(d.textKey)) };
    if (d.action === "refuse")
        return { called: false, reply: fixedReply("refusal", text(d.textKey)) };
    if (d.action === "local")
        return { called: false, reply: null };
    let question = routed.text;
    if (routed.intent === "explain-lesson") {
        const lessonId = currentLessonId(ctx.course);
        const q = lessonId === null ? null : lessonQuestion(ctx.course, lessonId);
        if (q === null)
            return { called: false, reply: fixedReply("refusal", text("course.noLesson")) };
        question = q;
    }
    const req: BrainRequest = { question, mode: "practice" };
    if (ctx.setup !== undefined)
        req.setup = ctx.setup;
    const kind = ctx.course?.location?.kind;
    if (kind !== undefined)
        req.location = { kind };
    return { called: true, reply: sanitize(await brain.ask(req)) };
}
