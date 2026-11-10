// The guide's own words in TekPractice: one frozen table of impersonal French (infinitives and nominal forms, no digit).
// Rule titles and explanations are never written here: they are quoted from the app's catalog through ruleTextFor.

function deepFreeze<T>(node: T): T {
  if (node !== null && typeof node === 'object') {
    for (const child of Object.values(node as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(node)
  }
  return node
}

export const TP_STRINGS = deepFreeze({
  verdict: {
    /** The app is not ready yet (no state to read). */
    nothingToJudge: "Rien à vérifier pour le moment : le plan de travail n'est pas encore prêt.",
    benchEmpty: "Le plan de travail est vide. Ajouter un premier appareil pour commencer.",
    placeFirst: "Aucun lieu n'est encore choisi. Choisir d'abord un lieu, puis ajouter des appareils.",
    /** Said only when the signal can play and the app lists no error: the scope is what the app itself checks. */
    allGood: "Lecture possible : aucune erreur détectée par l'application. Cette vérification ne couvre que les contrôles de l'application.",
    /** No error, not playable, and the signal path gave no reason. */
    notYet: "Aucune erreur détectée pour le moment, mais le signal ne peut pas encore être lu. Continuer le montage.",
    /** Last resort when a rule has no readable title. */
    toFix: "Une correction est à apporter.",
  },
  ask: {
    noInformation: "Je n'ai pas encore d'information sur ce point.",
    examQuiet: "Cette aide n'est pas disponible pendant un examen.",
  },
  error: {
    calm: "La réponse n'a pas pu être affichée. Réessayer dans un instant.",
  },
  flows: {
    'premier-montage': {
      title: 'Premier montage',
      steps: {
        place: 'Choisir un lieu pour commencer.',
        addFirst: 'Ajouter un premier appareil sur le plan de travail.',
        addSecond: 'Ajouter un deuxième appareil à côté du premier.',
        connect: "Relier les deux appareils avec un câble, d'une sortie vers une entrée.",
        status: "Lire la barre d'état en bas de l'écran pour voir ce que dit l'application du montage.",
      },
    },
    'alimentation-fantome': {
      title: 'Alimentation fantôme',
      steps: {
        pickMic: 'Sélectionner le micro concerné sur le plan de travail.',
        findConsole: "Repérer la console reliée à ce micro et l'ouvrir.",
        findControl: "Repérer la commande d'alimentation fantôme de la voie du micro.",
        toggle: 'Basculer cette commande.',
        status: "Relire la barre d'état pour voir si le montage a changé.",
      },
    },
    'lire-le-statut': {
      title: "Lire la barre d'état",
      steps: {
        open: "Repérer la barre d'état en bas de l'écran.",
        signal: "Lire la ligne du signal : elle indique s'il y a des erreurs ou non.",
        list: "Ouvrir la liste des erreurs, puis lire le titre et l'explication de la première.",
        playback: "Lire la ligne de lecture : elle donne la première raison qui empêche d'entendre le signal.",
      },
    },
  },
} as const)

/** A string by its dotted path (`verdict.benchEmpty`). An unknown key, a branch or an inherited name gives ''. */
export function tpString(key: string): string {
  if (typeof key !== 'string' || key === '') return ''
  let node: unknown = TP_STRINGS
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || !Object.hasOwn(node, part)) return ''
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : ''
}
