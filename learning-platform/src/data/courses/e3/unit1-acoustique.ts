import type { Unit } from "../../types";

/**
 * E3 · Unité 1 — Acoustique.
 * Propagation, niveaux (dB SPL / dBu / dBFS), psychoacoustique.
 * Notions récurrentes des annales E3-PTES (éduscol 2017–2025).
 */
export const unitAcoustique: Unit = {
  id: "e3-u1",
  slug: "acoustique",
  title: "Acoustique — propagation, niveaux et psychoacoustique",
  summary:
    "L'onde sonore, sa propagation, les échelles de niveau (dB SPL, dBu, dBFS) et la perception humaine : les fondations de toute l'épreuve E3.",
  estimatedMinutes: 45,
  lesson: [
    { type: "h2", text: "1. L'onde sonore et sa propagation" },
    {
      type: "p",
      text: "Le son est une **onde mécanique longitudinale** : une succession de compressions et de dépressions de l'air qui se propage depuis la source. Contrairement à la lumière, le son a besoin d'un milieu matériel (air, eau, solide) — pas de son dans le vide.",
    },
    {
      type: "p",
      text: "Dans l'air à 20 °C, la célérité du son vaut environ **c ≈ 344 m/s** (on retient souvent 340 m/s dans les exercices). Elle augmente avec la température (+0,6 m/s par °C) et dépend du milieu : ~1 480 m/s dans l'eau, ~5 000 m/s dans l'acier.",
    },
    {
      type: "formula",
      latexLike: "λ = c / f",
      label: "Longueur d'onde (m) = célérité (m/s) ÷ fréquence (Hz)",
    },
    {
      type: "p",
      text: "La **longueur d'onde** relie fréquence et dimension physique. C'est elle qui explique pourquoi les graves « contournent » les obstacles (diffraction) alors que les aigus sont directifs et facilement absorbés.",
    },
    {
      type: "table",
      caption: "Ordres de grandeur à connaître (c = 344 m/s)",
      header: ["Fréquence", "Longueur d'onde", "Repère"],
      rows: [
        ["20 Hz", "17,2 m", "Limite basse de l'audition"],
        ["100 Hz", "3,44 m", "Grave — dimension d'une pièce"],
        ["1 kHz", "34,4 cm", "Référence médium"],
        ["10 kHz", "3,44 cm", "Aigu — très directif"],
        ["20 kHz", "1,72 cm", "Limite haute de l'audition"],
      ],
    },
    {
      type: "example",
      title: "Exercice résolu — longueur d'onde",
      problem:
        "Un caisson de basses reproduit un signal à 43 Hz. Quelle est la longueur d'onde dans l'air (c = 344 m/s) ?",
      steps: [
        "On applique λ = c / f.",
        "λ = 344 / 43 = 8 m.",
      ],
      answer:
        "λ = 8 m. À cette échelle, l'onde interagit avec toute la pièce : c'est le domaine des modes propres (ondes stationnaires).",
    },
    { type: "h3", text: "Champ libre et loi de l'inverse du carré" },
    {
      type: "p",
      text: "En **champ libre** (aucune réflexion), la puissance de la source se répartit sur une sphère de plus en plus grande. L'intensité décroît donc comme 1/r² : c'est la **loi de l'inverse du carré**. Conséquence pratique à retenir :",
    },
    {
      type: "note",
      tone: "exam",
      text: "Chaque doublement de distance fait chuter le niveau de pression acoustique de **6 dB** en champ libre. r ×2 → −6 dB ; r ×4 → −12 dB ; r ×10 → −20 dB.",
    },
    {
      type: "example",
      title: "Exercice résolu — atténuation avec la distance",
      problem:
        "Un système de diffusion produit 100 dB SPL à 2 m. Quel niveau à 16 m, en champ libre ?",
      steps: [
        "De 2 m à 16 m : la distance est multipliée par 8, soit trois doublements (2→4→8→16).",
        "Chaque doublement : −6 dB, donc 3 × (−6) = −18 dB.",
        "100 − 18 = 82 dB SPL.",
      ],
      answer: "82 dB SPL à 16 m.",
    },
    { type: "h2", text: "2. Les niveaux : dB SPL, dBu, dBFS" },
    {
      type: "p",
      text: "Le **décibel** n'est pas une unité absolue : c'est un rapport logarithmique entre une grandeur et une **référence**. Tout l'art est de savoir quelle référence se cache derrière chaque suffixe.",
    },
    {
      type: "formula",
      latexLike: "L = 20 · log₁₀(x / x_réf)  (grandeurs de tension/pression)",
      label: "Pour les puissances : L = 10 · log₁₀(P / P_réf)",
    },
    {
      type: "table",
      caption: "Les trois échelles à maîtriser pour l'E3",
      header: ["Échelle", "Référence", "Domaine", "Repères"],
      rows: [
        ["dB SPL", "p₀ = 20 µPa (seuil d'audition)", "Acoustique (pression)", "0 dB = seuil d'audition · ~94 dB = 1 Pa · 120 dB = seuil de douleur"],
        ["dBu", "0,775 V (RMS)", "Électrique (tension)", "+4 dBu = niveau ligne pro (1,23 V) · −10 dBV = niveau grand public"],
        ["dBFS", "Pleine échelle numérique (Full Scale)", "Numérique", "0 dBFS = maximum absolu · toujours négatif en pratique"],
      ],
    },
    {
      type: "note",
      tone: "warning",
      text: "0 dBFS est un **plafond absolu** : le dépasser provoque l'écrêtage numérique (distorsion irréversible). En production on cale le niveau nominal vers −18 dBFS (alignement broadcast EBU R68 : +4 dBu ↔ −18 dBFS), gardant ~18 dB de marge (headroom).",
    },
    {
      type: "example",
      title: "Exercice résolu — conversion de tension en dBu",
      problem: "Une console délivre 1,55 V RMS. Quel niveau en dBu ?",
      steps: [
        "L = 20 · log₁₀(U / 0,775).",
        "U / 0,775 = 1,55 / 0,775 = 2.",
        "20 · log₁₀(2) = 20 × 0,301 ≈ +6 dBu.",
      ],
      answer: "≈ +6 dBu (doubler la tension = +6 dB).",
    },
    {
      type: "list",
      items: [
        "**+6 dB** = tension (ou pression) ×2",
        "**+20 dB** = tension ×10",
        "**+3 dB** = puissance ×2 (attention : puissance, pas tension)",
        "**+10 dB** = puissance ×10, sonie perçue ≈ ×2",
      ],
    },
    { type: "h3", text: "Addition de sources" },
    {
      type: "p",
      text: "Deux sources **non corrélées** (deux machines, deux instruments) de même niveau s'additionnent en puissance : +3 dB. Deux signaux **corrélés** (le même signal, en phase) s'additionnent en tension : +6 dB. Deux signaux identiques en opposition de phase s'annulent — principe des micros hors phase et du câblage symétrique.",
    },
    {
      type: "example",
      title: "Exercice résolu — addition de niveaux",
      problem:
        "Deux enceintes diffusent chacune 90 dB SPL (signaux non corrélés) au point d'écoute. Niveau total ?",
      steps: [
        "Sources non corrélées de même niveau : addition en puissance, +3 dB.",
        "90 + 3 = 93 dB SPL.",
      ],
      answer: "93 dB SPL (et non 180 dB !).",
    },
    { type: "h2", text: "3. Psychoacoustique — comment l'oreille perçoit" },
    {
      type: "p",
      text: "L'oreille humaine entend d'environ **20 Hz à 20 kHz** (la limite haute descend avec l'âge). Sa sensibilité n'est pas uniforme : elle est maximale entre **2 et 5 kHz** (résonance du conduit auditif, zone d'intelligibilité de la parole) et chute fortement dans les graves à bas niveau.",
    },
    {
      type: "figure",
      figureId: "fletcher-munson",
      caption: "Courbes isosoniques (Fletcher & Munson, normalisées ISO 226) : à bas niveau, il faut beaucoup plus d'énergie dans les graves pour une même sonie perçue.",
    },
    {
      type: "p",
      text: "Les **courbes isosoniques** relient les niveaux physiques (dB SPL) à la sonie perçue (phones). Conséquences directes : le bouton *loudness* des amplis hi-fi, la pondération **dB(A)** des sonomètres (qui imite l'oreille à niveau modéré) et le piège du mixage à fort niveau — un mix équilibré à 100 dB paraîtra pauvre en graves à 75 dB.",
    },
    {
      type: "list",
      items: [
        "**Effet de masque** : un son fort rend inaudibles les sons proches en fréquence et plus faibles — fondement des codecs perceptuels (MP3, AAC).",
        "**Effet Haas (précédence)** : si deux sons identiques arrivent à moins de ~30 ms d'écart, on localise la source sur le premier arrivé — essentiel pour caler les délais de rattrapage en sonorisation.",
        "**Bandes critiques** : l'oreille analyse le spectre par bandes (~1/3 d'octave) ; deux fréquences dans la même bande interagissent (battements, rugosité).",
      ],
    },
    {
      type: "note",
      tone: "exam",
      text: "Les annales E3 demandent régulièrement : conversion de niveaux entre échelles, calcul d'atténuation avec la distance, lecture de courbes isosoniques et justification de la pondération A. Entraînez-vous avec les sujets officiels 2017–2025 (bibliothèque Annales).",
    },
    { type: "h3", text: "Acoustique des salles — l'essentiel" },
    {
      type: "p",
      text: "En local clos, le champ direct décroît en 1/r² mais le **champ réverbéré** est à peu près constant : au-delà de la **distance critique**, la réverbération domine. Le **temps de réverbération TR60** (durée pour que le niveau chute de 60 dB après extinction de la source) se calcule avec la formule de Sabine :",
    },
    {
      type: "formula",
      latexLike: "TR60 ≈ 0,16 · V / A",
      label: "V = volume (m³), A = aire d'absorption équivalente (m² Sabine) = Σ(Sᵢ·αᵢ)",
    },
    {
      type: "example",
      title: "Exercice résolu — temps de réverbération",
      problem:
        "Un studio de 240 m³ possède une aire d'absorption équivalente A = 96 m². Calculer le TR60.",
      steps: [
        "TR60 = 0,16 × V / A.",
        "TR60 = 0,16 × 240 / 96 = 38,4 / 96 = 0,4 s.",
      ],
      answer: "TR60 = 0,4 s — typique d'une régie ou d'un studio de prise de parole.",
    },
  ],
  quiz: [
    {
      id: "e3u1-q1",
      question: "Dans l'air à 20 °C, quelle est la longueur d'onde d'un son de 1 kHz (c = 344 m/s) ?",
      choices: ["3,44 m", "34,4 cm", "3,44 cm", "344 m"],
      answerIndex: 1,
      explanation: "λ = c/f = 344/1000 = 0,344 m = 34,4 cm. Repère à connaître par cœur.",
    },
    {
      id: "e3u1-q2",
      question: "En champ libre, que devient le niveau SPL quand on double la distance à la source ?",
      choices: ["−3 dB", "−6 dB", "−10 dB", "Il ne change pas"],
      answerIndex: 1,
      explanation:
        "Loi de l'inverse du carré : l'intensité est divisée par 4 (soit −6 dB) à chaque doublement de distance.",
    },
    {
      id: "e3u1-q3",
      question: "Quelle est la référence de l'échelle dB SPL ?",
      choices: ["0,775 V", "1 V", "20 µPa", "1 Pa"],
      answerIndex: 2,
      explanation:
        "0 dB SPL correspond à p₀ = 20 µPa, le seuil d'audition moyen à 1 kHz. (0,775 V est la référence du dBu.)",
    },
    {
      id: "e3u1-q4",
      question: "Un signal passe de 0,775 V à 7,75 V RMS. De combien de dB a-t-il augmenté ?",
      choices: ["+10 dB", "+20 dB", "+3 dB", "+6 dB"],
      answerIndex: 1,
      explanation: "Tension ×10 → 20·log₁₀(10) = +20 dB (soit +20 dBu ici).",
    },
    {
      id: "e3u1-q5",
      question: "Que signifie 0 dBFS ?",
      choices: [
        "Le niveau nominal d'exploitation d'une console",
        "Le seuil d'audition en numérique",
        "Le niveau maximal absolu codable avant écrêtage numérique",
        "Le niveau de bruit de fond d'un convertisseur",
      ],
      answerIndex: 2,
      explanation:
        "FS = Full Scale, la pleine échelle du convertisseur. Tout dépassement provoque un écrêtage. Les niveaux numériques s'expriment donc en valeurs négatives (ex. −18 dBFS).",
    },
    {
      id: "e3u1-q6",
      question:
        "Deux machines non corrélées produisent chacune 80 dB SPL au même point. Quel est le niveau résultant ?",
      choices: ["160 dB SPL", "86 dB SPL", "83 dB SPL", "80 dB SPL"],
      answerIndex: 2,
      explanation:
        "Sources non corrélées de même niveau : addition en puissance → +3 dB, donc 83 dB SPL.",
    },
    {
      id: "e3u1-q7",
      question: "Dans quelle zone de fréquences l'oreille humaine est-elle la plus sensible ?",
      choices: ["20–60 Hz", "200–500 Hz", "2–5 kHz", "15–20 kHz"],
      answerIndex: 2,
      explanation:
        "La résonance du conduit auditif rend l'oreille la plus sensible entre 2 et 5 kHz — la zone d'intelligibilité de la parole, visible sur les courbes isosoniques.",
    },
    {
      id: "e3u1-q8",
      question: "Que modélise la pondération dB(A) d'un sonomètre ?",
      choices: [
        "La réponse de l'oreille à niveau modéré (courbes isosoniques)",
        "La réponse en fréquence d'un micro de mesure",
        "L'atténuation de l'air en fonction de la distance",
        "La réponse des enceintes de contrôle",
      ],
      answerIndex: 0,
      explanation:
        "Le filtre A imite la sensibilité de l'oreille à niveau modéré (inspiré de l'isosonique 40 phones) : il atténue fortement les graves et légèrement les extrêmes aigus.",
    },
    {
      id: "e3u1-q9",
      question:
        "Un studio de 300 m³ a une aire d'absorption A = 120 m² Sabine. Son TR60 vaut environ :",
      choices: ["0,25 s", "0,4 s", "0,8 s", "1,6 s"],
      answerIndex: 1,
      explanation: "Sabine : TR60 = 0,16·V/A = 0,16 × 300/120 = 0,4 s.",
    },
    {
      id: "e3u1-q10",
      question: "Qu'est-ce que l'effet de précédence (effet Haas) ?",
      choices: [
        "Un son fort masque les sons voisins en fréquence",
        "On localise la source sur le premier front d'onde arrivé (< ~30 ms)",
        "Les graves se propagent plus vite que les aigus",
        "Le niveau perçu double tous les +10 dB",
      ],
      answerIndex: 1,
      explanation:
        "Si deux sons identiques arrivent avec moins de ~30 ms d'écart, la localisation se fait sur le premier arrivé — c'est la base du calage des délais en sonorisation.",
    },
  ],
};
