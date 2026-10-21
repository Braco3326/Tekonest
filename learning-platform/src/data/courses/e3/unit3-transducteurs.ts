import type { Unit } from "../../types";

/**
 * E3 · Unité 3 — Transducteurs : microphones et haut-parleurs.
 * Principes physiques, caractéristiques, directivité, couples stéréo,
 * enceintes. Notions récurrentes des annales E3-PTES.
 */
export const unitTransducteurs: Unit = {
  id: "e3-u3",
  slug: "transducteurs",
  title: "Transducteurs — microphones et haut-parleurs",
  summary:
    "Principe des transducteurs électroacoustiques, familles de microphones (dynamique, condensateur, ruban), directivité, couples stéréo et haut-parleurs.",
  estimatedMinutes: 50,
  lesson: [
    { type: "h2", text: "1. Le transducteur : convertir énergie acoustique et énergie électrique" },
    {
      type: "p",
      text: "Un **transducteur** convertit une forme d'énergie en une autre. En audio, le **microphone** transforme l'énergie acoustique (variation de pression) en énergie électrique (tension), tandis que le **haut-parleur** effectue la conversion inverse. Beaucoup de principes physiques se retrouvent à l'identique dans les deux sens : un micro dynamique et un haut-parleur électrodynamique partagent exactement la même architecture (bobine mobile + aimant), simplement utilisée en sens réciproque.",
    },
    { type: "h2", text: "2. Le microphone dynamique à bobine mobile" },
    {
      type: "p",
      text: "Une bobine, solidaire du diaphragme, est suspendue dans l'entrefer d'un aimant permanent. La pression acoustique fait vibrer le diaphragme, donc la bobine, dans le champ magnétique : ce déplacement fait varier le flux magnétique traversant la bobine, ce qui induit une force électromotrice (**loi de Faraday**), dont le sens s'oppose à la variation qui lui donne naissance (**loi de Lenz**). La tension induite est proportionnelle à la **vitesse** de déplacement de la bobine.",
    },
    {
      type: "list",
      items: [
        "**Robuste** : peu de pièces fragiles, tolère les chocs et les forts niveaux de pression (SPL max élevé).",
        "**Autonome** : aucune alimentation nécessaire, le signal est généré directement par induction.",
        "**Sensibilité faible** : environ 1 à 3 mV/Pa, la masse du diaphragme + bobine limitant la finesse des transitoires.",
        "Usages typiques : scène, batterie, amplis guitare/basse — famille des micros de type SM57/SM58.",
      ],
    },
    { type: "h2", text: "3. Le microphone à condensateur (statique)" },
    {
      type: "p",
      text: "La capsule forme un condensateur : un diaphragme métallisé très léger fait face à une contre-électrode fixe, séparés par une distance d. La capacité vaut C = ε·S/d (S = surface, ε = permittivité de l'air). Une tension de **polarisation** (fournie par le +48 V ou, pour un électret, préchargée dans le matériau du diaphragme) établit une charge Q = C·U sur la capsule.",
    },
    {
      type: "formula",
      latexLike: "U = Q / C",
      label: "À charge Q quasi constante, toute variation de C (due à la pression) produit une variation de tension exploitable",
    },
    {
      type: "p",
      text: "Cette tension, générée à très haute impédance, est immédiatement convertie en basse impédance par un étage actif intégré à la capsule (transistor à effet de champ, FET). Un diaphragme aussi léger réclame beaucoup moins d'énergie mécanique qu'une bobine mobile pour se déplacer, d'où une sensibilité nettement supérieure (≈ 10 à 50 mV/Pa) et une réponse en fréquence souvent plus étendue et plus fine sur les transitoires — au prix d'une plus grande fragilité (humidité, chocs, poussière).",
    },
    {
      type: "p",
      text: "On distingue les **petites membranes** (< 1 cm environ), plus précises en aigu et plus régulières en directivité sur toute la bande passante — très utilisées pour les ensembles, les overheads, la musique classique — et les **grandes membranes** (≈ 2,5 cm), souvent plus sensibles, avec un bruit propre plus faible et un caractère « chaleureux » recherché pour la voix, mais plus marquées par l'effet de proximité.",
    },
    { type: "h2", text: "4. Le microphone à ruban" },
    {
      type: "p",
      text: "Un ruban métallique très fin et corrugué est suspendu dans le champ d'un aimant puissant : le ruban lui-même joue le rôle de conducteur, sans bobine séparée, et sa vibration induit directement une force électromotrice (même principe que le dynamique). Le signal généré est de très faible niveau et de très basse impédance : un transformateur élévateur, intégré au corps du micro, remonte le niveau et l'impédance à des valeurs exploitables.",
    },
    {
      type: "p",
      text: "Ouvert à l'avant comme à l'arrière, le ruban répond de façon strictement symétrique aux deux faces, en opposition de phase : sa directivité **native** est donc une **figure en 8** (bidirectionnelle), avec un zéro de captation sur les côtés.",
    },
    {
      type: "note",
      tone: "warning",
      text: "Le ruban est extrêmement fragile : un souffle direct (voix proche sans bonnette, coup de vent) peut l'étirer ou le déchirer, et un courant continu mal maîtrisé (+48 V appliqué par erreur sur un modèle ancien non protégé) peut le démagnétiser ou le détruire via son transformateur. Toujours vérifier la compatibilité +48 V avant de brancher un ruban.",
    },
    { type: "h2", text: "5. Caractéristiques techniques d'un microphone" },
    {
      type: "table",
      caption: "Grandeurs à connaître",
      header: ["Caractéristique", "Définition", "Ordres de grandeur"],
      rows: [
        ["Sensibilité", "Tension de sortie produite pour 1 Pa (94 dB SPL) à 1 kHz", "≈ 1–3 mV/Pa (dynamique) · ≈ 10–50 mV/Pa (condensateur)"],
        ["Réponse en fréquence", "Bande passante et régularité (± x dB)", "ex. 20 Hz–20 kHz ± 3 dB pour un condensateur large bande"],
        ["Bruit propre (self-noise)", "Niveau équivalent de bruit généré par le micro lui-même", "≈ 7 dBA (excellent) à 20 dBA (courant)"],
        ["SPL max", "Niveau de pression maximal admissible avant distorsion sensible (souvent à 0,5 % THD)", "ex. 135 dB SPL, davantage avec un atténuateur (pad)"],
      ],
    },
    {
      type: "example",
      title: "Exercice résolu — tension de sortie d'un micro pour un SPL donné",
      problem:
        "Un micro dynamique de sensibilité 2 mV/Pa reçoit un niveau de 100 dB SPL. Quelle tension délivre-t-il ?",
      steps: [
        "Convertir le niveau en pression : p = p₀ · 10^(L/20), avec p₀ = 20 µPa.",
        "p = 20×10⁻⁶ × 10^(100/20) = 20×10⁻⁶ × 10⁵ = 2 Pa (cohérent avec le repère 94 dB SPL = 1 Pa, ici +6 dB soit ×2 en pression).",
        "Tension de sortie : U = sensibilité × p = 2 mV/Pa × 2 Pa = 4 mV.",
      ],
      answer:
        "U = 4 mV (0,004 V) — un niveau très faible qui impose un préampli à fort gain (souvent +40 dB ou plus) pour atteindre le niveau ligne.",
    },
    { type: "h2", text: "6. Directivité et diagrammes polaires" },
    {
      type: "p",
      text: "La **directivité** décrit la sensibilité d'un micro selon l'angle d'incidence du son. L'**omnidirectionnelle** (capsule sensible à la seule pression) capte de façon quasi égale dans toutes les directions, sans zéro de captation. Les micros à **gradient de pression** (sensibles à la différence de pression entre l'avant et l'arrière de la capsule) présentent un ou plusieurs zéros de captation : c'est le cas de la cardioïde, de la supercardioïde, de l'hypercardioïde et de la bidirectionnelle (figure en 8).",
    },
    {
      type: "figure",
      figureId: "mic-directivity",
      caption:
        "Diagrammes polaires comparés : omnidirectionnelle (aucun zéro), cardioïde (zéro à 180°), supercardioïde (zéros à ≈126°), hypercardioïde (zéros à ≈110°, lobe arrière plus large) et bidirectionnelle (zéros à 90°/270°).",
    },
    {
      type: "table",
      caption: "Zéros de captation par type de directivité",
      header: ["Directivité", "Zéro(s) de captation", "Caractéristique"],
      rows: [
        ["Omnidirectionnelle", "aucun", "sensible à la pression seule, pas d'effet de proximité"],
        ["Cardioïde", "180° (arrière)", "meilleur rejet direct de l'arrière"],
        ["Supercardioïde", "≈ ±126°", "lobe frontal plus étroit, léger lobe arrière"],
        ["Hypercardioïde", "≈ ±110°", "lobe frontal encore plus étroit, lobe arrière plus large"],
        ["Bidirectionnelle (figure en 8)", "90° et 270°", "capte avant et arrière, effet de proximité marqué"],
      ],
    },
    {
      type: "p",
      text: "L'**effet de proximité** est un renforcement des graves qui apparaît lorsqu'un micro à gradient de pression est utilisé très près de la source (quelques centimètres) : à faible distance, la courbure du front d'onde rend la différence de pression entre les deux faces du diaphragme disproportionnellement plus forte en basses fréquences. Un micro omnidirectionnel, sensible à la seule pression, n'y est pas soumis.",
    },
    {
      type: "note",
      tone: "exam",
      text: "En sonorisation, on choisit et on oriente le micro pour placer le retour de scène (wedge) dans un **zéro de captation** afin de limiter le larsen. Un micro hypercardioïde offre le meilleur rejet global hors axe mais un lobe arrière plus large qu'un supercardioïde : le choix dépend de la position exacte de la source de larsen par rapport à l'axe du micro.",
    },
    {
      type: "example",
      title: "Exercice résolu — choix de directivité pour limiter le larsen",
      problem:
        "Un chanteur utilise un micro sur scène, avec un retour de scène (wedge) posé au sol devant lui, incliné vers son visage — donc pas exactement à 180° de l'axe du micro. Quel type de directivité choisir, et comment l'orienter ?",
      steps: [
        "Un cardioïde n'a qu'un seul zéro, exactement à 180° : si le retour est plutôt de face et en contrebas, ce zéro ne tombe pas sur la source de larsen.",
        "Une supercardioïde ou une hypercardioïde ont des zéros décalés (≈126° ou ≈110°) et un lobe frontal plus étroit : en orientant précisément le micro, on peut placer un de ces zéros sur la direction réelle du retour.",
        "L'hypercardioïde a un lobe arrière plus large que la supercardioïde : si un second retour ou une réflexion arrive par l'arrière, la supercardioïde peut mieux le rejeter.",
      ],
      answer:
        "Une supercardioïde bien orientée (zéro à ≈126° dirigé vers le retour) offre en général le meilleur compromis pour ce cas de figure : réjection hors axe supérieure à la cardioïde, sans le large lobe arrière de l'hypercardioïde.",
    },
    { type: "h2", text: "7. Couples stéréophoniques" },
    {
      type: "p",
      text: "Une prise stéréo à deux microphones reconstitue l'image spatiale à partir de différences d'**intensité** (ILD) et/ou de **temps** (ITD) entre les deux capsules.",
    },
    {
      type: "list",
      items: [
        "**XY (coïncident)** : deux micros directifs (souvent cardioïdes), capsules aussi proches que possible, angle 90° à 135° entre les axes. L'image naît des différences d'intensité, l'arrivée du son étant quasi simultanée : excellente compatibilité mono (peu de risque de filtrage en peigne), mais image parfois resserrée.",
        "**AB (espacé)** : deux micros (souvent omnidirectionnels) séparés de 40 cm à 1 m ou plus. L'image naît surtout des différences de temps d'arrivée : sensation d'espace et de largeur importante, mais compatibilité mono plus fragile (risque de filtrage en peigne à la somme).",
        "**ORTF** : compromis normalisé (Office de Radiodiffusion Télévision Française) — deux cardioïdes espacées de **17 cm**, angle de **110°** entre les axes. Combine différences de temps et d'intensité pour une image naturelle et raisonnablement compatible mono ; technique classique des annales E3.",
        "**MS (Mid-Side)** : un micro cardioïde ou omni orienté vers la source (voie M, Mid) et un micro bidirectionnel orienté à 90° (voie S, Side). Le signal stéréo s'obtient par **matriçage** : Gauche = M+S, Droite = M−S. Avantage majeur : compatibilité mono garantie (M+S additionné à M−S annule S et ne conserve que M) et largeur stéréo réglable après la prise en ajustant le gain de S avant matriçage.",
      ],
    },
    { type: "h2", text: "8. Les haut-parleurs" },
    {
      type: "p",
      text: "Le haut-parleur électrodynamique est le **réciproque** du micro dynamique : un courant électrique traverse une bobine mobile plongée dans le champ d'un aimant permanent, ce qui produit une force (loi de Laplace, F = B·l·I) déplaçant la membrane et créant l'onde de pression.",
    },
    {
      type: "list",
      items: [
        "**Boomer** (grave) : grand diamètre, grande excursion, pour restituer les basses fréquences.",
        "**Médium** : bande intermédiaire, souvent la zone la plus critique pour l'intelligibilité.",
        "**Tweeter** (aigu) : petit diaphragme léger (dôme), pour une bonne réponse transitoire en haute fréquence.",
      ],
    },
    {
      type: "p",
      text: "Un **filtre passif (crossover)** répartit le spectre entre ces transducteurs : bobines (inductances) en passe-bas vers le boomer, condensateurs en passe-haut vers le tweeter, avec une fréquence de coupure et une pente caractéristiques (souvent 12 ou 24 dB/octave). Le **rendement** (ou sensibilité) d'une enceinte s'exprime en dB SPL produits pour 1 W électrique à 1 m de distance ; il varie fortement d'un modèle à l'autre (typiquement 85 à 95 dB SPL/W/m en sonorisation). L'**impédance nominale** (4, 8, parfois 16 Ω) doit être compatible avec l'amplificateur, qui doit pouvoir fournir le courant correspondant. Une **enceinte active** intègre son propre amplificateur et son filtrage (souvent actif) ; une **enceinte passive** nécessite un amplificateur externe et un filtre passif interne.",
    },
    {
      type: "example",
      title: "Exercice résolu — SPL d'une enceinte à puissance et distance données",
      problem:
        "Une enceinte a un rendement de 96 dB SPL (1 W à 1 m). Quel niveau produit-elle avec un amplificateur de 100 W, à une distance de 8 m, en champ libre ?",
      steps: [
        "Effet de la puissance : ΔL = 10·log₁₀(P₂/P₁) = 10·log₁₀(100/1) = +20 dB. À 1 m avec 100 W : 96 + 20 = 116 dB SPL.",
        "Effet de la distance : de 1 m à 8 m, la distance est multipliée par 8, soit trois doublements (1→2→4→8).",
        "Chaque doublement de distance : −6 dB (loi de l'inverse du carré), donc 3 × (−6) = −18 dB. Niveau final : 116 − 18 = 98 dB SPL.",
      ],
      answer: "≈ 98 dB SPL à 8 m.",
    },
  ],
  quiz: [
    {
      id: "e3u3-q1",
      question: "Quel phénomène physique explique la production du signal électrique dans un micro dynamique à bobine mobile ?",
      choices: ["L'effet piézoélectrique", "La variation de capacité électrique", "L'induction électromagnétique (loi de Faraday-Lenz)", "L'effet photoélectrique"],
      answerIndex: 2,
      explanation:
        "Le déplacement de la bobine mobile dans le champ d'un aimant permanent fait varier le flux magnétique qui la traverse, ce qui induit une force électromotrice proportionnelle à la vitesse de déplacement — le principe inverse du haut-parleur.",
    },
    {
      id: "e3u3-q2",
      question: "Dans un micro à condensateur (statique), quelle grandeur varie directement sous l'effet de la pression acoustique ?",
      choices: ["La résistance du diaphragme", "La capacité de la capsule (C = ε·S/d)", "L'inductance de la bobine mobile", "La tension d'alimentation fantôme"],
      answerIndex: 1,
      explanation:
        "Le diaphragme, très léger, forme avec une contre-électrode fixe un condensateur dont la capacité varie avec la distance qui les sépare ; à charge quasi constante, cette variation de C produit une tension exploitable (U = Q/C).",
    },
    {
      id: "e3u3-q3",
      question: "Quelle est la directivité native (sans traitement additionnel) d'un micro à ruban ?",
      choices: ["Cardioïde", "Omnidirectionnelle", "Hypercardioïde", "Bidirectionnelle (figure en 8)"],
      answerIndex: 3,
      explanation:
        "Le ruban, ouvert à l'avant comme à l'arrière, répond de façon identique et en opposition de phase aux ondes venant de face et de dos, avec un zéro de captation sur les côtés : c'est la définition même du diagramme en 8.",
    },
    {
      id: "e3u3-q4",
      question: "Pourquoi un micro à condensateur est-il en général beaucoup plus sensible qu'un micro dynamique (≈10–50 mV/Pa contre ≈1–3 mV/Pa) ?",
      choices: [
        "Son diaphragme, très léger, réagit à la pression avec beaucoup moins d'énergie mécanique à fournir",
        "Son aimant est nettement plus puissant",
        "Il ne capte que les fréquences aiguës",
        "Il fonctionne uniquement en champ proche",
      ],
      answerIndex: 0,
      explanation:
        "La masse du diaphragme du condensateur est très inférieure à l'ensemble diaphragme + bobine du dynamique : il faut donc beaucoup moins de pression pour produire une variation de capacité exploitable, d'où une sensibilité plus élevée.",
    },
    {
      id: "e3u3-q5",
      question: "Que signifie la caractéristique « SPL max » d'un microphone ?",
      choices: [
        "Le niveau de bruit propre exprimé en dB(A)",
        "La distance maximale d'utilisation recommandée",
        "Le niveau de pression acoustique maximal admissible avant distorsion sensible (souvent à 0,5 % de THD)",
        "La sensibilité exprimée en dB re 1 V/Pa",
      ],
      answerIndex: 2,
      explanation:
        "Au-delà du SPL max, la capsule ou l'électronique interne du micro sature et produit une distorsion audible ; les micros à condensateur proposent souvent un atténuateur (pad) pour repousser cette limite.",
    },
    {
      id: "e3u3-q6",
      question: "À quel angle se situe le zéro de captation d'un micro cardioïde ?",
      choices: ["90°", "126°", "110°", "180°"],
      answerIndex: 3,
      explanation:
        "Le cardioïde possède un unique zéro de captation, exactement à l'arrière (180°) : c'est la directivité de base dont dérivent la supercardioïde et l'hypercardioïde.",
    },
    {
      id: "e3u3-q7",
      question: "Un micro hypercardioïde se distingue de la cardioïde et de la supercardioïde par...",
      choices: [
        "Des zéros de captation à environ ±110°, et un lobe arrière plus large",
        "Une absence totale de zéro de captation",
        "Un zéro de captation unique à 180°",
        "Une sensibilité identique dans toutes les directions",
      ],
      answerIndex: 0,
      explanation:
        "L'hypercardioïde resserre encore le lobe frontal par rapport à la supercardioïde (zéros ≈126°), au prix d'un lobe arrière plus important — un compromis à connaître pour choisir le bon micro selon la source de larsen à rejeter.",
    },
    {
      id: "e3u3-q8",
      question: "Qu'est-ce que l'effet de proximité ?",
      choices: [
        "Une perte de sensibilité en haute fréquence à grande distance",
        "Une saturation du préampli à faible distance",
        "Un phénomène propre aux micros omnidirectionnels",
        "Un renforcement des graves quand un micro à gradient de pression (cardioïde, figure en 8...) est utilisé très près de la source",
      ],
      answerIndex: 3,
      explanation:
        "Seuls les micros sensibles au gradient de pression (donc directifs) présentent cet effet ; un micro omnidirectionnel, sensible à la seule pression, n'en montre pas — un repère classique pour identifier le type de capsule.",
    },
    {
      id: "e3u3-q9",
      question: "Quels sont les paramètres caractéristiques du couple stéréo ORTF ?",
      choices: [
        "Deux cardioïdes espacées de 17 cm, angle de 110° entre les axes",
        "Deux omnidirectionnels espacés de 1 m",
        "Deux cardioïdes quasi coïncidentes, angle de 90°",
        "Un cardioïde et une figure en 8 à 90°",
      ],
      answerIndex: 0,
      explanation:
        "L'ORTF est un compromis normalisé entre AB et XY : l'écart de 17 cm et l'angle de 110° combinent différences de temps et d'intensité pour une image stéréo naturelle et raisonnablement compatible mono.",
    },
    {
      id: "e3u3-q10",
      question: "Quel est l'avantage principal de la technique Mid-Side (MS) par rapport à un couple XY classique ?",
      choices: [
        "Elle nécessite deux micros omnidirectionnels identiques",
        "Elle offre une compatibilité mono garantie et un réglage de largeur stéréo possible après la prise (via le gain du canal Side)",
        "Elle capte uniquement les basses fréquences",
        "Elle ne nécessite aucun matriçage",
      ],
      answerIndex: 1,
      explanation:
        "Le matriçage Gauche = M+S / Droite = M−S fait qu'une somme mono (G+D) annule automatiquement le Side et ne conserve que le Mid ; on peut aussi ajuster la largeur stéréo a posteriori en changeant le gain de S avant matriçage.",
    },
  ],
};
