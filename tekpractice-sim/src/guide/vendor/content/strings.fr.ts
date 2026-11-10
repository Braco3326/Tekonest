export const strings = {
    errors: {
        "flow-unknown": "Ce parcours n'existe pas. Choisir un autre parcours dans la liste.",
        "flow-unavailable": "Ce parcours n'est pas disponible sur cette page.",
        internal: "Une erreur est survenue. Réessayer dans un instant.",
    },
    planner: {
        fix: "Correction à apporter",
        needInfo: "Compléter l'information manquante, puis relancer la vérification.",
        offerFlow: "Pour continuer, un parcours guidé est proposé.",
        startFlow: "Aucune étape en cours. Un parcours guidé peut être lancé.",
        nothing: "Aucune étape à proposer pour le moment.",
    },
    step: {
        notOnScreen: "Cet élément n'est pas visible à l'écran pour le moment. Faire défiler la page ou ouvrir la zone concernée pour le retrouver.",
    },
    flows: {
        "premier-montage": "Premier montage",
        "alimentation-fantome": "Alimentation fantôme",
        "corriger-un-niveau": "Corriger un niveau",
        "commencer-un-cours": "Commencer un cours",
        "terminer-une-unite": "Terminer une unité",
    },
    hint: {
        nudge: "Un indice pour avancer.",
        point: "Voici où regarder : l'élément concerné est entouré à l'écran.",
        show: "Voici comment faire : la démonstration est montrée à l'écran, sans rien modifier dans la page.",
        quizLesson: "Pour cette question, revoir la leçon correspondante. Aucune réponse n'est donnée pendant un quiz.",
    },
    quiz: {
        refusal: "Les réponses ne sont pas données pendant un quiz. Revoir la leçon correspondante, puis réessayer.",
        gradedWithheld: "Cette aide n'est pas disponible pendant un quiz noté.",
    },
    course: {
        withheld: "Cette aide n'est pas disponible pendant un examen.",
        whereLesson: "Unité {n} sur {total} : {unit}. Leçon {m} sur {count} : {lesson}.",
        whereUnit: "Unité {n} sur {total} : {unit}.",
        whereQuiz: "Unité {n} sur {total} : {unit}. Quiz de l'unité en cours.",
        whereGradedQuiz: "Unité {n} sur {total} : {unit}. Quiz noté en cours.",
        whereSurvey: "Questionnaire en cours.",
        whereDashboard: "Tableau de bord du cours.",
        whereUnknown: "L'emplacement dans le cours n'est pas déterminé.",
        progress: "Progression : {done} sur {total} unités terminées.",
        nextLesson: "Prochaine étape : la leçon « {lesson} » de l'unité « {unit} ».",
        nextQuiz: "Prochaine étape : le quiz de l'unité « {unit} ».",
        nextExam: "Toutes les unités sont terminées. L'examen est ouvert.",
        nothing: "Aucune étape à proposer dans ce cours pour le moment.",
        lockedUnit: "L'unité « {unit} » est verrouillée : terminer d'abord l'unité « {previous} ».",
        lockedExam: "L'examen est verrouillé. Unités restantes : {units}.",
        lockedExamOther: "L'examen n'est pas encore ouvert.",
        noLesson: "Aucune leçon à expliquer ici. Ouvrir une leçon, puis demander une explication.",
        lessonQuestion: "Expliquer : {topics}.",
    },
    mute: {
        confirm: "Les conseils automatiques sont désactivés. Les questions restent possibles.",
        off: "Les conseils automatiques sont réactivés.",
    },
    empty: {
        prompt: "Poser une question ou choisir une action ci-dessous.",
    },
    brain: {
        error: "La réponse n'a pas pu être affichée. Réessayer dans un instant.",
        staleContext: "La page a changé pendant la réponse. Reposer la question si besoin.",
    },
    chips: {
        next: "Prochaine étape",
        show: "Montre-moi",
        hint: "Un indice de plus",
        where: "Où j'en suis",
        mute: "Désactiver les conseils",
        unmute: "Réactiver les conseils",
        close: "Fermer",
        open: "Ouvrir",
        start: "Lancer le parcours proposé",
        skip: "Passer cette étape",
    },
    where: {
        flow: "Parcours « {flow} » : étape {i} sur {n}.",
        noFlow: "Aucun parcours en cours.",
        workbench: "Plan de travail ouvert.",
        other: "Page ouverte.",
    },
    widget: {
        title: "Oscar, assistant IA",
        iconName: "Oscar, assistant IA",
        iconHelp: "Les flèches du clavier déplacent l'icône vers un coin de l'écran.",
        inputLabel: "Poser une question à l'assistant",
        inputPlaceholder: "Poser une question",
        send: "Envoyer",
        close: "Fermer",
        mute: "Désactiver les conseils",
        unmute: "Réactiver les conseils",
        busy: "Réflexion en cours",
        region: "Réponses de l'assistant",
    },
    celebrate: {
        done: "Parcours « {flow} » terminé : toutes les étapes sont faites.",
    },
} as const;
export type Strings = typeof strings;
export function lookupString(key: string): string | null {
    let node: unknown = strings;
    for (const part of String(key).split(".")) {
        if (node === null || typeof node !== "object" || !Object.hasOwn(node, part))
            return null;
        node = (node as Record<string, unknown>)[part];
    }
    return typeof node === "string" ? node : null;
}
