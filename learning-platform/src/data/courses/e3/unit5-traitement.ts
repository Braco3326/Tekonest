import type { Unit } from "../../types";

/**
 * E3 · Unité 5 — Traitement du signal.
 * Égalisation, traitement de la dynamique, réverbération/délais et
 * normalisation loudness (EBU R128) : les outils qui façonnent le rendu final.
 * Notions récurrentes des annales E3-PTES (éduscol 2017–2025).
 */
export const unitTraitement: Unit = {
  id: "e3-u5",
  slug: "traitement-du-signal",
  title: "Traitement du signal — égalisation, dynamique et loudness",
  summary:
    "Égalisation, compression, réverbération et normalisation loudness EBU R128 : les outils de traitement du signal qui façonnent le rendu final d'une production sonore.",
  estimatedMinutes: 50,
  lesson: [
    { type: "h2", text: "1. Égalisation — sculpter le spectre" },
    { type: "h3", text: "Filtres passe-haut et passe-bas" },
    {
      type: "p",
      text: "Un filtre **passe-haut** laisse passer les fréquences au-dessus d'une fréquence de coupure et atténue celles en dessous ; un filtre **passe-bas** fait l'inverse. Au-delà de la coupure, l'atténuation croît avec la fréquence selon une pente qui dépend de l'**ordre** du filtre.",
    },
    {
      type: "table",
      caption: "Ordre du filtre et pente d'atténuation",
      header: ["Ordre", "Pente", "Remarque"],
      rows: [
        ["1er ordre", "6 dB/octave", "Pente douce, peu de déphasage"],
        ["2e ordre", "12 dB/octave", "Compromis courant en correction"],
        ["3e ordre", "18 dB/octave", "Coupure plus marquée"],
        ["4e ordre", "24 dB/octave", "Coupure très raide (« brickwall » léger)"],
      ],
    },
    {
      type: "p",
      text: "Le filtre passe-haut (coupe-bas) est très utilisé en prise de son de voix ou d'instruments pour éliminer le **rumble** (souffle du climatiseur, bruit de manipulation, plosives) : une coupure autour de 80 à 100 Hz, avec une pente suffisamment raide (18 ou 24 dB/octave), retire ce contenu inutile sans toucher au corps du son.",
    },
    {
      type: "example",
      title: "Exercice résolu — pente d'un filtre passe-haut",
      problem:
        "Un filtre passe-haut du 4e ordre (24 dB/octave) est réglé à 80 Hz. Quelle atténuation obtient-on à 20 Hz ?",
      steps: [
        "20 Hz est à combien d'octaves de 80 Hz ? 80 / 20 = 4 = 2², soit deux octaves en dessous.",
        "Pente de 24 dB/octave × 2 octaves = 48 dB d'atténuation.",
      ],
      answer: "Environ 48 dB d'atténuation à 20 Hz : le rumble à cette fréquence est quasiment éliminé.",
    },
    { type: "h3", text: "Shelving et cloche paramétrique" },
    {
      type: "p",
      text: "Un filtre en **plateau** (shelving grave ou aigu) relève ou atténue d'un gain fixe toutes les fréquences au-delà d'une fréquence de coin, sans revenir au niveau initial — utile pour une correction de balance tonale large. Un filtre en **cloche paramétrique** agit au contraire de façon localisée autour d'une fréquence centrale f0, avec un gain et une largeur de bande réglables.",
    },
    {
      type: "formula",
      latexLike: "Q = f0 / Δf",
      label: "Facteur de qualité d'un filtre en cloche : Δf est la bande passante à −3 dB autour de f0.",
    },
    {
      type: "p",
      text: "Plus Q est élevé, plus la bande affectée est étroite (correction chirurgicale, ex. suppression d'une résonance) ; plus Q est faible, plus la bande est large (correction douce et musicale).",
    },
    {
      type: "example",
      title: "Exercice résolu — calcul du facteur Q",
      problem:
        "Un égaliseur paramétrique est réglé sur une fréquence centrale f0 = 500 Hz, avec une bande passante à −3 dB de Δf = 100 Hz. Quel est le facteur de qualité Q de ce filtre ?",
      steps: ["Q = f0 / Δf.", "Q = 500 / 100 = 5."],
      answer: "Q = 5 : une correction relativement étroite, plutôt destinée à cibler un défaut précis qu'à sculpter un timbre.",
    },
    { type: "h3", text: "Égaliseur graphique et usages" },
    {
      type: "p",
      text: "L'**EQ graphique** propose une série de bandes fixes, chacune avec un simple curseur de gain : la norme la plus répandue utilise **31 bandes** en tiers d'octave, couvrant 20 Hz à 20 kHz sur des fréquences centrales normalisées. On le trouve en calage de système de diffusion et en correction acoustique de salle.",
    },
    {
      type: "list",
      items: [
        "**Usage correctif** : compenser un défaut (résonance de salle, réponse en fréquence d'un haut-parleur, rumble) — on cherche la neutralité.",
        "**Usage esthétique** : façonner un timbre (chaleur, brillance, présence) — on cherche un rendu voulu, pas nécessairement neutre.",
        "**Anti-Larsen** : en sonorisation, une coupure étroite à Q élevé sur la fréquence exacte de résonance identifiée permet de repousser le seuil de larsen (effet Larsen) sans dénaturer le reste du spectre.",
      ],
    },
    {
      type: "note",
      tone: "exam",
      text: "Savoir identifier, sur une courbe de réponse, le type de filtre (passe-haut, passe-bas, plateau, cloche), sa fréquence de coupure ou centrale, sa pente ou son Q, est une question récurrente des annales E3.",
    },
    { type: "h2", text: "2. Traitement de la dynamique" },
    {
      type: "p",
      text: "Un **compresseur** réduit l'écart entre les passages forts et faibles d'un signal : au-delà d'un **seuil** (threshold), il applique un **ratio** de réduction. En dessous du seuil, le signal n'est pas affecté.",
    },
    {
      type: "formula",
      latexLike: "sortie (dB) = seuil + (entrée − seuil) / ratio   (au-dessus du seuil)",
      label: "Caractéristique statique d'un compresseur (avant gain de compensation).",
    },
    {
      type: "table",
      caption: "Paramètres d'un compresseur",
      header: ["Paramètre", "Rôle"],
      rows: [
        ["Seuil (threshold)", "Niveau au-dessus duquel la compression s'active"],
        ["Ratio", "Taux de réduction au-dessus du seuil (ex. 3:1, 4:1)"],
        ["Attack (attaque)", "Temps de mise en action de la réduction de gain, en ms"],
        ["Release (relâchement)", "Temps de retour au gain nominal après passage sous le seuil, en ms"],
        ["Knee (coude)", "Transition douce (soft) ou abrupte (hard) autour du seuil"],
        ["Gain de compensation (makeup)", "Gain ajouté après compression pour compenser la réduction de niveau"],
      ],
    },
    {
      type: "example",
      title: "Exercice résolu — sortie d'un compresseur et gain de compensation",
      problem:
        "Un compresseur est réglé avec un seuil à −18 dBFS et un ratio 4:1. Un signal d'entrée culmine à −6 dBFS. Quel est le niveau de sortie avant gain de compensation ? Si l'on souhaite ramener le pic de sortie à −3 dBFS, quel gain de compensation faut-il appliquer ?",
      steps: [
        "Dépassement du seuil : −6 − (−18) = 12 dB au-dessus du seuil.",
        "Avec un ratio 4:1, seul 12 / 4 = 3 dB de ce dépassement est laissé passer.",
        "Niveau de sortie = seuil + dépassement compressé = −18 + 3 = −15 dBFS.",
        "Gain de compensation pour ramener le pic à −3 dBFS : −3 − (−15) = +12 dB.",
      ],
      answer: "Sortie compressée à −15 dBFS ; il faut ajouter +12 dB de gain de compensation pour ramener le pic à −3 dBFS.",
    },
    {
      type: "p",
      text: "Le **limiteur** est un cas extrême de compresseur : ratio très élevé (proche de l'infini, « ∞:1 ») et attaque quasi instantanée, pour empêcher tout dépassement d'un seuil (effet « brickwall », mur de briques). Le **noise gate** fait l'inverse du compresseur : il atténue ou coupe le signal lorsqu'il passe **sous** un seuil, pour supprimer le bruit de fond entre les prises utiles (fuite de scène, souffle, ronflement). L'**expandeur** applique le même principe de façon plus douce et progressive. Le **de-esser** est un compresseur sélectif en fréquence, déclenché par l'énergie présente dans la bande des sifflantes (environ 4 à 9 kHz sur la voix), pour adoucir les « s » et « ch » sans affecter le reste du timbre.",
    },
    {
      type: "list",
      items: [
        "**Voix parlée/chantée** : ratio de compression courant autour de 3:1.",
        "**Attaque** : de quelques ms (percussif, contrôle des transitoires) à plusieurs dizaines de ms (laisser passer l'attaque naturelle).",
        "**Relâchement** : de quelques dizaines à quelques centaines de ms, selon le rythme du programme.",
      ],
    },
    {
      type: "note",
      tone: "warning",
      text: "Une attaque trop rapide combinée à un relâchement trop rapide produit un effet de « pompage » (pumping) audible — le gain de compensation remonte de façon perceptible entre les transitoires. Une compression excessive tue la dynamique et la lisibilité d'un mix.",
    },
    { type: "h2", text: "3. Réverbération et délais — l'essentiel" },
    {
      type: "p",
      text: "Une réverbération artificielle se règle principalement par son **pre-delay** (le temps entre le son direct et l'apparition de la traîne réverbérée, qui sépare perceptivement le sec du traité) et son **decay** (la durée de décroissance de la traîne, apparentée au TR60 d'une salle réelle — voir Unité 1).",
    },
    {
      type: "p",
      text: "Un compresseur se place presque toujours en **insert** : il doit traiter 100 % du signal d'une piste donnée, en série dans son chemin de signal. Une réverbération, à l'inverse, se place généralement en **envoi auxiliaire** (aux/send-return) : plusieurs pistes envoient chacune une proportion réglable de leur signal vers un unique processeur de réverbération partagé, dont le retour est mélangé au bus. On économise ainsi les ressources, on garde le signal sec intact sur chaque piste, et le degré de traitement mouillé (wet) reste réglable indépendamment pour chaque source.",
    },
    {
      type: "note",
      tone: "info",
      text: "Retenir la règle générale : traitement de dynamique (compresseur, limiteur, gate, de-esser) → insert, car il doit affecter tout le signal d'une piste. Effet temporel partagé (réverbération, délai) → aux/send-return, car on mutualise un seul processeur entre plusieurs sources.",
    },
    { type: "h2", text: "4. Loudness — la norme EBU R128" },
    {
      type: "p",
      text: "La « guerre du volume » (loudness war) a longtemps consisté à maximiser artificiellement le niveau perçu d'un programme par une compression et une limitation excessives, au détriment de la dynamique. La **normalisation loudness EBU R128** répond à ce problème en imposant une cible de **loudness perçu** plutôt qu'une simple cible de crête : deux programmes normalisés en R128 sonnent avec la même intensité perçue, quelle que soit leur dynamique interne.",
    },
    {
      type: "p",
      text: "L'unité de mesure est le **LUFS** (Loudness Units Full Scale, ou LKFS), avec l'équivalence **1 LU = 1 dB**. La mesure s'effectue sur trois fenêtres temporelles différentes : le loudness **momentané** (fenêtre glissante de 400 ms), le loudness **court terme** (fenêtre glissante de 3 s) et le loudness **intégré** (moyenne pondérée sur l'ensemble du programme, du début à la fin).",
    },
    {
      type: "table",
      caption: "Cibles EBU R128 (broadcast européen)",
      header: ["Descripteur", "Cible / limite", "Remarque"],
      rows: [
        ["Loudness intégré", "−23 LUFS (± 0,5 à 1 LU)", "Cible de livraison du programme complet"],
        ["True Peak maximal", "−1 dBTP", "Marge contre les surcharges inter-échantillons après conversion N/A"],
        ["Loudness Range (LRA)", "Variable selon le programme, en LU", "Décrit l'étendue dynamique perçue sur la durée du programme"],
      ],
    },
    {
      type: "example",
      title: "Exercice résolu — correction vers la cible EBU R128",
      problem:
        "Une mesure de loudness intégré donne −19 LUFS pour un programme qui doit être livré à −23 LUFS (± 0,5 LU) selon la recommandation EBU R128. Quel ajustement de gain global faut-il appliquer ?",
      steps: [
        "Écart par rapport à la cible : −23 − (−19) = −4 LU (le programme est trop fort de 4 LU).",
        "1 LU = 1 dB : il faut donc appliquer une atténuation globale de 4 dB.",
        "Vérification : −19 − 4 = −23 LUFS, conforme à la cible.",
      ],
      answer: "Appliquer −4 dB de gain global pour ramener le programme à −23 LUFS (± 0,5 LU).",
    },
    {
      type: "note",
      tone: "exam",
      text: "Différence essentielle à maîtriser pour les annales E3 : la normalisation en **crête** (peak normalisation) aligne uniquement le pic le plus fort sur un niveau cible, sans tenir compte du ressenti global — un programme très compressé paraît alors plus fort qu'un programme dynamique de même crête. La normalisation **loudness** (EBU R128) mesure le ressenti perçu (pondération et gating spécifiques) et aligne ce ressenti, pas seulement la crête.",
    },
    {
      type: "p",
      text: "À titre de contraste, les plateformes de streaming visent des cibles plus élevées, de l'ordre de **−14 LUFS** intégré : un contenu livré à −23 LUFS pour le broadcast européen sera donc généralement remonté par la plateforme elle-même (ou son propre traitement de normalisation) avant diffusion.",
    },
    {
      type: "figure",
      figureId: "compressor-curve",
      caption: "Courbe entrée/sortie d'un compresseur : en dessous du seuil, la sortie suit l'entrée (pente 1:1) ; au-delà, la pente devient 1/ratio, avant application du gain de compensation.",
    },
  ],
  quiz: [
    {
      id: "e3u5-q1",
      question: "Quelle est la pente d'un filtre du 2e ordre, exprimée en dB/octave ?",
      choices: ["6 dB/octave", "18 dB/octave", "12 dB/octave", "24 dB/octave"],
      answerIndex: 2,
      explanation: "Chaque ordre ajoute 6 dB/octave de pente : 1er ordre = 6, 2e ordre = 12, 3e ordre = 18, 4e ordre = 24 dB/octave.",
    },
    {
      id: "e3u5-q2",
      question: "Un filtre en cloche est centré sur 500 Hz avec une bande passante à −3 dB de 100 Hz. Quel est son facteur de qualité Q ?",
      choices: ["50", "100", "0,2", "5"],
      answerIndex: 3,
      explanation: "Q = f0 / Δf = 500 / 100 = 5. Plus Q est élevé, plus la correction est étroite et chirurgicale.",
    },
    {
      id: "e3u5-q3",
      question: "Un égaliseur graphique 31 bandes couvre 20 Hz à 20 kHz. Quelle est la largeur de chaque bande ?",
      choices: ["1 octave", "1/2 octave", "1/3 d'octave", "1/6 d'octave"],
      answerIndex: 2,
      explanation: "31 bandes réparties sur environ 10 octaves (20 Hz–20 kHz) correspondent aux fréquences centrales normalisées ISO en tiers d'octave.",
    },
    {
      id: "e3u5-q4",
      question: "Un compresseur a un seuil à −20 dBFS et un ratio 2:1. Un signal entre à −10 dBFS. Quel est le niveau de sortie (avant gain de compensation) ?",
      choices: ["−15 dBFS", "−20 dBFS", "−10 dBFS", "−5 dBFS"],
      answerIndex: 0,
      explanation: "Dépassement = −10 − (−20) = 10 dB ; compressé au ratio 2:1 = 5 dB ; sortie = −20 + 5 = −15 dBFS.",
    },
    {
      id: "e3u5-q5",
      question: "Qu'est-ce qu'un limiteur, par rapport à un compresseur classique ?",
      choices: [
        "Un compresseur à ratio 1:1, donc sans effet",
        "Un filtre coupe-bas très raide",
        "Un compresseur réglé avec une attaque très lente",
        "Un compresseur à ratio très élevé (proche de l'infini) et attaque quasi instantanée, qui empêche tout dépassement du seuil (brickwall)",
      ],
      answerIndex: 3,
      explanation: "Le limiteur applique un ratio proche de ∞:1 avec une attaque très rapide : au-delà du seuil, le niveau de sortie reste plafonné.",
    },
    {
      id: "e3u5-q6",
      question: "Que fait un noise gate (porte de bruit) ?",
      choices: [
        "Il compresse le signal au-dessus d'un seuil",
        "Il coupe ou atténue le signal lorsqu'il passe sous un seuil, pour supprimer le bruit de fond entre les prises utiles",
        "Il ajoute de la réverbération",
        "Il égalise sélectivement les fréquences aiguës",
      ],
      answerIndex: 1,
      explanation: "Contrairement au compresseur qui agit au-dessus du seuil, le noise gate atténue tout ce qui reste sous le seuil : bruit de fond, fuite de scène, ronflement d'ampli.",
    },
    {
      id: "e3u5-q7",
      question: "À quoi sert un de-esser ?",
      choices: [
        "À compresser sélectivement la bande de fréquences des sifflantes (environ 4-9 kHz) pour réduire les « s » et « ch » trop présents",
        "À supprimer l'effet Larsen en sonorisation",
        "À égaliser les graves d'une voix",
        "À limiter le niveau de sortie général d'un mix",
      ],
      answerIndex: 0,
      explanation: "Le de-esser est un compresseur sélectif en fréquence, déclenché par l'énergie dans la bande des sibilantes, pour adoucir les « s » sans affecter le reste du timbre.",
    },
    {
      id: "e3u5-q8",
      question: "Pourquoi place-t-on généralement une réverbération en envoi auxiliaire (aux/send-return) plutôt qu'en insert ?",
      choices: [
        "Parce que la réverbération ne fonctionne qu'en numérique",
        "Parce qu'un insert ne peut pas traiter les effets temporels",
        "Pour pouvoir mutualiser un seul processeur de réverbération entre plusieurs pistes tout en conservant le signal sec intact",
        "Parce que la réverbération doit toujours précéder le compresseur dans la chaîne",
      ],
      answerIndex: 2,
      explanation: "Le circuit aux permet d'envoyer une proportion de plusieurs pistes vers un même processeur de réverbération partagé, en gardant le signal sec (dry) intact sur chaque piste.",
    },
    {
      id: "e3u5-q9",
      question: "Quelle est la cible de loudness intégré (EBU R128) pour un programme broadcast européen ?",
      choices: ["−9 LUFS", "−23 LUFS", "−14 LUFS", "−31 LUFS"],
      answerIndex: 1,
      explanation: "La recommandation EBU R128 fixe la cible de loudness intégré à −23 LUFS (± 0,5 à 1 LU), contre environ −14 LUFS visés par les plateformes de streaming.",
    },
    {
      id: "e3u5-q10",
      question: "Selon l'EBU R128, quel est le niveau maximal autorisé en True Peak ?",
      choices: ["0 dBTP", "−3 dBTP", "−6 dBTP", "−1 dBTP"],
      answerIndex: 3,
      explanation: "Le plafond de −1 dBTP laisse une marge contre les surcharges inter-échantillons pouvant apparaître après conversion N/A ou transcodage, même si les échantillons mesurés ne dépassent pas 0 dBFS.",
    },
  ],
};
