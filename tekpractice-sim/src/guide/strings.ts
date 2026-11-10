// The guide's own words in TekPractice: one frozen table of impersonal French (infinitives and nominal forms, no digit).
// Rule titles and explanations are never written here: they are quoted from the app's catalog through ruleTextFor.
// Words follow the app's own (« lieu », « Signal OK », « Erreurs et avertissements », « Lecture »). Apostrophes are ’, except in the one
// pinned sentence `ask.noInformation`, which keeps the straight apostrophes of the sentence as it was specified.

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
    nothingToJudge: 'Rien à vérifier pour le moment : le lieu n’est pas encore prêt.',
    benchEmpty: 'Le lieu est vide. Ajouter un premier appareil pour commencer.',
    placeFirst: 'Aucun lieu n’est encore choisi. Choisir d’abord un lieu, puis ajouter des appareils.',
    /** Said only when the signal can play and the app lists no error: the scope is what the app itself checks. */
    allGood: 'Lecture possible : aucune erreur détectée par l’application. Cette vérification ne couvre que les contrôles de l’application.',
    /** No error, not playable, and the signal path gave no reason. */
    notYet: 'Aucune erreur détectée pour le moment, mais le signal ne peut pas encore être lu. Continuer le montage.',
    /** Last resort when a rule has no readable title. */
    toFix: 'Une correction est à apporter.',
  },
  ask: {
    noInformation: "Je n'ai pas encore d'information sur ce point.",
    examQuiet: 'Cette aide n’est pas disponible pendant un examen.',
  },
  error: {
    calm: 'La réponse n’a pas pu être affichée. Réessayer dans un instant.',
  },
  /** Sentences the controller shows with a next-step bubble: the host table replaces the vendored ones (see CREATION_STRINGS). */
  planner: {
    /** After a verdict sentence that says what is missing. Nothing here asks to run a check: Mode Création has no check button. The offered flow comes as a chip. */
    needInfo: 'La barre d’état, en bas de l’écran, résume l’état du montage.',
  },
  flows: {
    'premier-montage': {
      title: 'Premier montage',
      steps: {
        place: 'Choisir un lieu pour commencer.',
        addFirst: 'Ajouter un premier appareil dans le lieu.',
        addSecond: 'Ajouter un deuxième appareil à côté du premier.',
        connect: 'Relier les deux appareils avec un câble, d’une sortie vers une entrée.',
        status: 'Lire la barre d’état en bas de l’écran : elle indique « Signal OK » ou la liste « Erreurs et avertissements ».',
      },
    },
    'ajouter-des-appareils': {
      title: 'Ajouter des appareils',
      steps: {
        addFirst: 'Ajouter un premier appareil dans le lieu.',
        addSecond: 'Ajouter un deuxième appareil à côté du premier.',
      },
    },
    'deuxieme-appareil': {
      title: 'Ajouter un deuxième appareil',
      steps: {
        add: 'Ajouter un deuxième appareil à côté du premier.',
      },
    },
    'premier-cable': {
      title: 'Premier câble',
      steps: {
        connect: 'Relier les deux appareils avec un câble, d’une sortie vers une entrée.',
        status: 'Lire la barre d’état en bas de l’écran : elle indique « Signal OK » ou la liste « Erreurs et avertissements ».',
      },
    },
    'alimentation-fantome': {
      title: 'Alimentation fantôme',
      steps: {
        toggle: 'Basculer la commande d’alimentation fantôme de la voie du micro.',
      },
    },
    'lire-le-statut': {
      title: 'Lire la barre d’état',
      steps: {
        signal: 'Lire le signal dans la barre d’état : « Signal OK », « Rien de branché » ou « Aucune erreur détectée ».',
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
