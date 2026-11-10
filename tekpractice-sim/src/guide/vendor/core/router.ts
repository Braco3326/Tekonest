export type Intent = "next-step" | "where-am-i" | "show-me" | "more-hint" | "why" | "how-to" | "explain-lesson" | "mute" | "fact" | "exam-help";
export const INTENT_ORDER: readonly Intent[] = Object.freeze([
    "next-step",
    "where-am-i",
    "show-me",
    "more-hint",
    "why",
    "how-to",
    "explain-lesson",
    "mute",
    "fact",
    "exam-help",
]);
export interface Routed {
    intent: Intent | "empty";
    text: string;
    truncated: boolean;
    flowId?: string;
}
export const MAX_QUESTION_CHARS = 2000;
export interface FlowKeywords {
    flowId: string;
    keywords: readonly string[];
}
export const DEFAULT_FLOW_KEYWORDS: readonly FlowKeywords[] = Object.freeze([
    {
        flowId: "premier-montage",
        keywords: [
            "premier montage", "premier cablage", "premiere connexion", "premier branchement", "brancher un micro", "connecter un micro",
            "cabler un micro", "brancher le micro", "connecter le micro", "micro a la console", "micro sur la console", "first setup",
            "first connection", "connect a mic", "connect a microphone", "connect the mic", "plug in a mic", "plug a mic", "plug the mic",
        ],
    },
    {
        flowId: "alimentation-fantome",
        keywords: ["fantome", "phantom", "48v", "48 v", "micro statique", "micro a condensateur", "condenser mic", "condenser microphone"],
    },
    {
        flowId: "corriger-un-niveau",
        keywords: [
            "corriger un niveau", "corriger le niveau", "corriger les niveaux", "probleme de niveau", "regler un niveau", "fix a level",
            "fix the level", "fix levels", "level problem", "level issue",
        ],
    },
    {
        flowId: "terminer-une-unite",
        keywords: [
            "terminer une unite", "terminer l unite", "finir une unite", "finir l unite", "valider une unite", "valider l unite", "completer une unite",
            "complete a unit", "complete the unit", "finish a unit", "finish the unit",
        ],
    },
    {
        flowId: "commencer-un-cours",
        keywords: ["commencer un cours", "commencer le cours", "demarrer un cours", "demarrer le cours", "premier cours", "start a course", "start the course", "begin the course"],
    },
]);
const CONTROL = /[\p{Cc}]/gu;
const ONLY_JUNK = /^[\s\p{Cc}\p{Cf}\p{Cs}]*$/u;
function capChars(s: string): {
    text: string;
    cut: boolean;
} {
    if (s.length <= MAX_QUESTION_CHARS)
        return { text: s, cut: false };
    let t = s.slice(0, MAX_QUESTION_CHARS);
    const last = t.charCodeAt(t.length - 1);
    if (last >= 0xd800 && last <= 0xdbff)
        t = t.slice(0, -1);
    return { text: t, cut: true };
}
export function foldQuestion(s: string): string {
    return s
        .replace(/\p{Cf}/gu, "")
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/œ/gu, "oe")
        .replace(/æ/gu, "ae")
        .replace(/[^a-z0-9]+/gu, " ")
        .trim();
}
interface Pattern {
    re: RegExp;
    weight?: number;
    maxWords?: number;
}
const p = (re: RegExp, weight = 1, maxWords?: number): Pattern => (maxWords === undefined ? { re, weight } : { re, weight, maxWords });
const PATTERNS: Readonly<Record<Exclude<Intent, "fact" | "how-to" | "mute">, readonly Pattern[]>> = {
    "next-step": [
        p(/\bprochaine etape\b/u),
        p(/\betape suivante\b/u),
        p(/\bet ensuite\b/u),
        p(/^ensuite\b/u),
        p(/\bque (?:dois je |faut il |puis je |peux je )?faire\b(?! (?:en cas|si|quand|lorsque|pour|avec|contre|face|apres|avant|dans|sur|d|de|du|des)\b)/u),
        p(/\bje dois faire\b/u),
        p(/\bquoi faire\b/u),
        p(/\bje fais quoi\b/u),
        p(/\bet maintenant\b/u),
        p(/\bla suite\b/u),
        p(/\bpar ou (?:continuer|commencer|reprendre)\b/u),
        p(/\bnext step\b/u),
        p(/\bwhat (?:do i do|should i do|now|next|to do)\b/u),
        p(/\bwhat s next\b/u),
        p(/\bwhat comes next\b/u),
        p(/^(?:next|suivant|suite|continuer|continue)$/u),
    ],
    "where-am-i": [
        p(/\bou j en suis\b/u),
        p(/\bou en suis je\b/u),
        p(/\bou suis je\b/u),
        p(/\bou je suis\b/u),
        p(/\bou on en est\b/u),
        p(/\bou en est on\b/u),
        p(/\bma progression\b/u),
        p(/\bmon avancement\b/u),
        p(/\bdans quelle (?:lecon|unite|partie|section)\b/u),
        p(/\bquelle (?:lecon|unite) (?:est ce|suis je|je suis)\b/u),
        p(/\bwhere am i\b/u),
        p(/\bwhere i am\b/u),
        p(/\bmy progress\b/u),
        p(/\bwhat (?:lesson|unit|chapter) am i\b/u),
        p(/^(?:progression|avancement|progress)$/u),
    ],
    "show-me": [
        p(/\bmontre(?:r|z|s)?\b(?!(?: moi)? (?:comment (?:fonctionne|marche|agit|calculer|se calcule|on calcule|regler|choisir)|ce qu est|c est quoi|la difference|les differences|pourquoi))/u, 1, 9),
        p(/\bfais voir\b|\bfaire voir\b|\bfaites voir\b/u, 1, 9),
        p(/\bdemonstration\b|\bdemontre\w*\b|\bdemo\b/u, 1, 9),
        p(/\bshow me\b(?! how (?:does|do|is|are|a|an|the) )/u, 1, 9),
        p(/\bdemonstrate\b/u, 1, 9),
        p(/\bpoint (?:it|that|this|to|at)\b/u),
        p(/\bindique(?:r|z)? moi (?:ou|l element|l endroit)\b/u),
        p(/\bou (?:cliquer|brancher|connecter|appuyer)\b/u),
        p(/\bou dois je (?:cliquer|brancher|connecter|appuyer|aller)\b/u),
        p(/\bwhere (?:do i|should i|to|can i) (?:click|plug|connect|press|go)\b/u),
        p(/\bwhere is the (?:button|port|input|output|cable|switch|control|menu)\b/u),
        p(/\bou (?:est|se trouve|sont) (?:le |la |les |l |mon |ma )?(?:bouton|port|prise|entree|sortie|cable|interrupteur|commutateur|switch|element|zone|menu)\b/u),
    ],
    "more-hint": [
        p(/\bindice\b/u),
        p(/\bcoup de pouce\b/u),
        p(/\bplus d aide\b/u),
        p(/\bun peu d aide\b/u),
        p(/\b(?:aide|aidez) moi\b/u),
        p(/\bbesoin d aide\b/u),
        p(/\bje suis bloque\b|\bje suis coince\b|\bbloque\b/u, 1, 6),
        p(/\bje n y arrive pas\b|\bje y arrive pas\b/u),
        p(/\bune piste\b/u),
        p(/\bau secours\b/u),
        p(/\bhint\b|\bclue\b/u),
        p(/\bmore help\b/u),
        p(/\bhelp me\b/u),
        p(/\bi m stuck\b|\bi am stuck\b|\bstuck\b/u, 1, 8),
        p(/^(?:aide|help)$/u),
    ],
    why: [
        p(/\bpourquoi\b/u),
        p(/\bexplique(?:r|z|s)? (?:moi )?(?:le |ce |cet |l )?(?:verdict|probleme|resultat|erreur|diagnostic|defaut)\b/u),
        p(/\bquel est le probleme\b/u),
        p(/\bc est quoi (?:le probleme|l erreur|le defaut)\b/u),
        p(/\bqu est ce qui (?:ne va pas|cloche|ne marche pas|ne fonctionne pas)\b/u),
        p(/\bquelle est la cause (?:du|de ce|de cette) (?:probleme|verdict|erreur|defaut)\b/u),
        p(/\bwhy\b/u),
        p(/\bwhat s wrong\b|\bwhat is wrong\b|\bwhat went wrong\b/u),
        p(/\bwhat is the problem\b/u),
        p(/\bexplain (?:me )?the (?:verdict|problem|error|fault|result)\b/u),
    ],
    "explain-lesson": [
        p(/\b(?:explique|expliquer|expliquez|explications?|resume|resumer|resumez|revois|rappelle|rappeler)\b.{0,30}\b(?:lecon|cours|passage|chapitre|section|unite|notion|notions|partie|module)\b/u),
        p(/\b(?:lecon|cours|passage|chapitre)\b.{0,25}\b(?:expliqu\w*|resum\w*)\b/u),
        p(/\bde quoi parle\b.{0,25}\b(?:lecon|cours|passage|chapitre|unite)\b/u),
        p(/\b(?:explain|summari[sz]e|review|recap)\b.{0,30}\b(?:lesson|passage|chapter|unit|section|course)\b/u),
        p(/\bwhat (?:is|s) (?:this|the) (?:lesson|chapter|unit|passage) about\b/u),
    ],
    "exam-help": [
        p(/\b(?:donne|donnes|donnez|dis|dites|dis moi|donne moi|donnez moi)\b.{0,15}\b(?:la|les|une|un) (?:bonne |bonnes |vraie |bon )?(?:reponses?|solutions?|corrige|choix)\b/u, 3),
        p(/\b(?:quelle|quel) est la (?:bonne |vraie )?reponse\b/u, 3),
        p(/\bla bonne reponse\b|\bbonne reponse\b|\breponse correcte\b|\bla bonne option\b/u, 3),
        p(/\breponse (?:du|de l|au|a la|a cette|a ma) (?:quiz|examen|exam|test|question|qcm)\b/u, 3),
        p(/\b(?:corrige|solution) (?:du|de l|de cet) (?:quiz|examen|exam|test|qcm)\b/u, 3),
        p(/\b(?:aide|aider|aidez|help)\b.{0,20}\b(?:examen|exam|quiz|test|qcm|controle)\b/u, 3),
        p(/\b(?:examen|exam|quiz|test|qcm)\b.{0,20}\b(?:aide|reponse|reponses|triche|answer|answers)\b/u, 3),
        p(/\btriche\w*\b|\bcheat\w*\b/u, 3),
        p(/\blaquelle est (?:la bonne|correcte|juste)\b|\bquel est le bon choix\b|\bquelle option est (?:la bonne|correcte|juste)\b/u, 3),
        p(/\b(?:give|tell) me the (?:right |correct )?answers?\b/u, 3),
        p(/\bwhat(?: is|s) the (?:right |correct )?answer\b/u, 3),
        p(/\b(?:correct|right) answer\b|\bwhich (?:option|choice) is (?:correct|right)\b/u, 3),
        p(/\banswer (?:to|for) (?:the |this )?(?:question|quiz|exam|test)\b/u, 3),
        p(/\bexam help\b|\bhelp (?:me )?(?:in|with|during) (?:the |my )?(?:exam|quiz|test)\b/u, 3),
    ],
};
const MUTE_OBJECT = "(?:(?:les|tes|des|the|all|my) )?(?:conseils|messages|indices|notifications|suggestions|hints|tips|nudges|oscar|le guide|the guide|guide)";
const MUTE_BARE = /^(?:oscar )?(?:mute|muet|silence|chut|quiet|tais toi|sois muet|sois discret|sois silencieux)(?: oscar| s il te plait| svp| stp| please)?$/u;
const MUTE_IMPERATIVE: readonly RegExp[] = [
    /^(?:oscar )?(?:s il te plait |please |stp )?tais toi(?: s il te plait| svp| stp| please)?$/u,
    new RegExp(`^(?:oscar )?(?:s il te plait |please |stp )?(?:arrete|arretez|cesse|stop|desactive|desactivez|coupe|coupez|disable|turn off|mute)(?: de me donner| de me dire| de)? ?(?:${MUTE_OBJECT})?(?: s il te plait| svp| stp| please)?$`, "u"),
    new RegExp(`^(?:oscar )?(?:no more|plus de|pas de|aucun|aucune|stop) (?:${MUTE_OBJECT})(?: s il te plait| svp| stp| please)?$`, "u"),
    /^(?:oscar )?(?:stop|arrete|arretez) (?:talking|helping|de parler|de m aider)(?: please| s il te plait)?$/u,
    /^(?:oscar )?ne me derange(?:z)? plus(?: s il te plait| please)?$/u,
    /^(?:oscar )?(?:sois|soyez) (?:muet|discret|silencieux|calme)(?: s il te plait| please)?$/u,
    /^(?:oscar )?(?:be quiet|shut up|mute yourself)(?: please| oscar)?$/u,
];
const MUTE_POLITE = /^(?:peux tu|tu peux|pouvez vous|vous pouvez|can you|could you|please) (?:te taire|be quiet|stop talking)(?: s il te plait| please)?$/u;
function isMuteRequest(t: string, question: boolean): boolean {
    if (MUTE_POLITE.test(t))
        return true;
    if (question)
        return false;
    return MUTE_BARE.test(t) || MUTE_IMPERATIVE.some((re) => re.test(t));
}
const HOW_TRIGGER = /\bcomment (?:faire|activer|brancher|connecter|cabler|mettre|corriger|regler|utiliser|proceder|s y prendre|on fait|je fais|je dois|dois je|puis je|peut on|pourrais je|bien|commencer|demarrer|debuter|terminer|finir|achever|valider|completer)\b|\bhow (?:do i|can i|to|should i|do you)\b|\b(?:lancer|lance|demarrer|demarre|commencer|commence|start|begin)\b/u;
const HOW_EXPLICIT = /\bparcours\b|\btutoriel\b|\btutorial\b|\bpas a pas\b|\bstep by step\b|\bguide moi\b|\bguidez moi\b|\bguide me\b|\bwalk me through\b|\bvisite guidee\b|\bguided tour\b/u;
function wordCount(t: string): number {
    if (t === "")
        return 0;
    let n = 1;
    for (let i = 0; i < t.length; i++)
        if (t.charCodeAt(i) === 32)
            n++;
    return n;
}
function findFlow(t: string, table: readonly FlowKeywords[]): string | undefined {
    for (const f of table) {
        for (const k of f.keywords)
            if (t.includes(k))
                return f.flowId;
    }
    return undefined;
}
function pickIntent(t: string, flowId: string | undefined, question: boolean): Intent {
    const words = wordCount(t);
    const score = new Map<Intent, number>();
    const bump = (i: Intent, w: number): void => {
        if ((score.get(i) ?? 0) < w)
            score.set(i, w);
    };
    for (const intent of Object.keys(PATTERNS) as (keyof typeof PATTERNS)[]) {
        for (const pat of PATTERNS[intent]) {
            if (pat.maxWords !== undefined && words > pat.maxWords)
                continue;
            if (pat.re.test(t))
                bump(intent, pat.weight ?? 1);
        }
    }
    if (isMuteRequest(t, question))
        bump("mute", 1);
    if (HOW_EXPLICIT.test(t) || (flowId !== undefined && HOW_TRIGGER.test(t)))
        bump("how-to", 2);
    let best: Intent = "fact";
    let bestScore = 0;
    for (const intent of INTENT_ORDER) {
        const s = score.get(intent) ?? 0;
        if (s > bestScore) {
            best = intent;
            bestScore = s;
        }
    }
    return best;
}
export function routeQuestion(text: string, flows: readonly FlowKeywords[] = DEFAULT_FLOW_KEYWORDS): Routed {
    try {
        if (typeof text !== "string")
            return { intent: "empty", text: "", truncated: false };
        const { text: capped, cut } = capChars(text);
        if (ONLY_JUNK.test(capped))
            return { intent: "empty", text: "", truncated: cut };
        const clean = capped.replace(CONTROL, " ").toWellFormed().trim();
        const t = foldQuestion(clean);
        if (t === "") {
            return { intent: "fact", text: clean, truncated: cut };
        }
        const flowId = findFlow(t, flows);
        const intent = pickIntent(t, flowId, clean.includes("?"));
        const out: Routed = { intent, text: clean, truncated: cut };
        if (intent === "how-to" && flowId !== undefined)
            out.flowId = flowId;
        return out;
    }
    catch {
        return { intent: "empty", text: "", truncated: false };
    }
}
