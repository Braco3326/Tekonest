import type { Exam } from "../../types";

/**
 * E3 · Examen blanc — Physique et technique des équipements et supports (PTES).
 * Synthèse des 6 unités, dans l'esprit des annales officielles éduscol 2017–2025.
 */
export const e3Exam: Exam = {
  passingScore: 0.7,
  description:
    "L'épreuve E3 réelle est un écrit de 6 h (3 h + 3 h) de résolution de problèmes, portant sur la physique et la technique des équipements et supports. Cet examen blanc Tech Nest n'en est pas la simulation intégrale : c'est un QCM de synthèse de 24 questions, construit dans l'esprit des annales officielles (éduscol 2017–2025), couvrant les 6 unités du cours (acoustique, électricité, transducteurs, audionumérique, traitement du signal, supports & équipements). Il faut au moins 70 % de bonnes réponses pour valider le certificat.",
  questions: [
    // ---------- Acoustique ----------
    {
      id: "e3ex-q1",
      question: "Quelle est la valeur usuelle retenue pour la célérité du son dans l'air à 20 °C ?",
      choices: ["344 m/s", "150 m/s", "1 480 m/s", "3 108 m/s"],
      answerIndex: 0,
      explanation:
        "Dans l'air à 20 °C, le son se propage à environ 344 m/s (souvent arrondi à 340 m/s) ; 1 480 m/s est la valeur dans l'eau.",
    },
    {
      id: "e3ex-q2",
      question: "Une source ponctuelle produit 94 dB SPL à 1 m, en champ libre. Quel est le niveau à 8 m ?",
      choices: ["88 dB SPL", "76 dB SPL", "82 dB SPL", "70 dB SPL"],
      answerIndex: 1,
      explanation:
        "8 m = 1 m × 2³, soit 3 doublements de distance : chaque doublement −6 dB, donc −18 dB au total. 94 − 18 = 76 dB SPL.",
    },
    {
      id: "e3ex-q3",
      question:
        "Vous calez votre mix à fort niveau sur les moniteurs de la régie, puis vous l'écoutez à faible niveau sur une petite enceinte de contrôle. Les graves paraissent soudain trop discrets. Pourquoi ?",
      choices: [
        "Le câble haut-parleur atténue davantage les graves à faible niveau",
        "Les convertisseurs N/A perdent en résolution à faible niveau",
        "L'oreille est moins sensible aux graves à faible niveau (courbes isosoniques)",
        "Le format de fichier a changé pendant l'écoute",
      ],
      answerIndex: 2,
      explanation:
        "Les courbes isosoniques montrent que la sensibilité de l'oreille aux basses fréquences chute fortement à bas niveau : un mix équilibré à fort niveau peut sembler pauvre en graves à faible niveau d'écoute.",
    },
    {
      id: "e3ex-q4",
      question:
        "Une salle de 500 m³ présente une aire d'absorption équivalente A = 100 m² Sabine. Quel est son TR60 (formule de Sabine, TR60 ≈ 0,16·V/A) ?",
      choices: ["0,4 s", "1,6 s", "3,2 s", "0,8 s"],
      answerIndex: 3,
      explanation: "TR60 = 0,16 × 500 / 100 = 80 / 100 = 0,8 s.",
    },
    // ---------- Électricité ----------
    {
      id: "e3ex-q5",
      question: "À quoi sert l'alimentation fantôme +48 V (norme P48) délivrée par une console ou un préampli ?",
      choices: [
        "Alimenter le moteur d'un micro à ruban",
        "Polariser la capsule et alimenter l'électronique interne d'un micro statique (à condensateur)",
        "Charger les accumulateurs d'un micro HF",
        "Alimenter les enceintes de monitoring",
      ],
      answerIndex: 1,
      explanation:
        "Le +48 V (P48) fournit la tension de polarisation de la capsule et l'énergie nécessaire à l'électronique (préampli intégré, adaptation d'impédance) d'un micro à condensateur. Un micro dynamique ou à ruban n'a besoin d'aucune alimentation externe pour fonctionner.",
    },
    {
      id: "e3ex-q6",
      question:
        "Pourquoi une liaison symétrique (deux conducteurs + masse, signal transmis en opposition de phase) rejette-t-elle mieux les parasites qu'une liaison asymétrique ?",
      choices: [
        "Parce qu'elle transporte deux fois plus de courant",
        "Parce que le blindage y est deux fois plus épais",
        "Parce qu'elle ne fonctionne qu'en numérique",
        "Parce qu'à l'entrée, on fait la différence des deux conducteurs : le bruit capté en mode commun s'annule, alors que le signal utile s'additionne",
      ],
      answerIndex: 3,
      explanation:
        "L'étage d'entrée symétrique effectue la différence des deux conducteurs : le bruit induit en mode commun (identique sur les deux fils) s'annule, tandis que le signal utile, transmis en opposition de phase, se retrouve doublé (réjection de mode commun, CMRR).",
    },
    {
      id: "e3ex-q7",
      question:
        "Quel est l'écart approximatif, en dB, entre le niveau ligne professionnel (+4 dBu) et le niveau ligne grand public (−10 dBV) ?",
      choices: ["11,8 dB", "6 dB", "20 dB", "3 dB"],
      answerIndex: 0,
      explanation:
        "+4 dBu = 1,228 V et −10 dBV = 0,316 V. 20·log₁₀(1,228/0,316) ≈ 20 × 0,589 ≈ 11,8 dB : l'écart classique entre matériel professionnel et grand public.",
    },
    {
      id: "e3ex-q8",
      question:
        "Un microphone a une impédance de sortie de 200 Ω ; l'entrée de la console présente une impédance de 2 kΩ. Cette configuration est-elle correcte ?",
      choices: [
        "Non : il faudrait une impédance d'entrée égale à 200 Ω pour un transfert de puissance maximal",
        "Non : l'impédance d'entrée doit toujours être inférieure à l'impédance de sortie",
        "Oui : en audio, on recherche une adaptation en tension — l'impédance d'entrée doit être nettement supérieure à l'impédance de sortie",
        "Cela n'a aucune incidence, l'impédance ne joue aucun rôle en audio basse fréquence",
      ],
      answerIndex: 2,
      explanation:
        "En audio basse fréquence, on ne cherche pas l'adaptation d'impédance (transfert de puissance maximal, utile en RF) mais un pont en tension : l'entrée doit présenter une impédance nettement supérieure (généralement ×10 ou plus) à celle de la source, pour ne pas la charger.",
    },
    // ---------- Transducteurs ----------
    {
      id: "e3ex-q9",
      question: "Quel est le principe de transduction d'un microphone dynamique à bobine mobile ?",
      choices: [
        "La pression acoustique modifie la capacité électrique entre une membrane et une électrode fixe",
        "La pression acoustique déforme un cristal piézoélectrique",
        "La pression acoustique module un faisceau laser",
        "La pression acoustique fait vibrer une membrane liée à une bobine placée dans un champ magnétique, générant une tension par induction",
      ],
      answerIndex: 3,
      explanation:
        "Un micro dynamique (bobine mobile) fonctionne par induction électromagnétique : la membrane entraîne une bobine dans l'entrefer d'un aimant, générant directement une tension, sans alimentation externe.",
    },
    {
      id: "e3ex-q10",
      question: "Une capsule à directivité cardioïde rejette le plus fortement les sons provenant de quelle direction ?",
      choices: ["De l'arrière (180°)", "De face (0°)", "Des côtés (90°)", "Elle rejette également toutes les directions"],
      answerIndex: 0,
      explanation:
        "La cardioïde présente une atténuation maximale à 180°, à l'arrière de la capsule, tout en restant sensible à l'avant.",
    },
    {
      id: "e3ex-q11",
      question:
        "Pour capter l'ambiance d'un concert, vous hésitez entre un couple AB (deux micros omnidirectionnels espacés) et un couple XY (deux cardioïdes coïncidents, capsules croisées). Quelle différence principale attendre du couple AB par rapport au couple XY ?",
      choices: [
        "Le couple AB donne une image stéréo par différences de niveau uniquement, sans risque de déphasage",
        "Le couple AB donne davantage de sensation d'espace grâce aux différences de temps d'arrivée, mais expose à des risques de compatibilité mono (déphasage)",
        "Le couple AB ne capte que les basses fréquences",
        "Le couple XY nécessite obligatoirement une alimentation fantôme, contrairement au couple AB",
      ],
      answerIndex: 1,
      explanation:
        "Le couple AB (capsules espacées) exploite les différences de temps d'arrivée entre les deux micros, ce qui donne une sensation d'espace plus large, mais peut poser des problèmes de phase en sommation mono. Le couple XY, coïncident, n'a pas ce problème mais offre une image moins large.",
    },
    {
      id: "e3ex-q12",
      question:
        "Une enceinte a une sensibilité de 90 dB SPL / 1 W / 1 m. Quel niveau produira-t-elle à 1 m avec une puissance de 4 W (on ignore ici l'atténuation avec la distance) ?",
      choices: ["93 dB SPL", "99 dB SPL", "96 dB SPL", "102 dB SPL"],
      answerIndex: 2,
      explanation:
        "Chaque doublement de puissance électrique ajoute +3 dB. De 1 W à 4 W, il y a deux doublements (1→2→4 W) : +3 + 3 = +6 dB. 90 + 6 = 96 dB SPL.",
    },
    // ---------- Audionumérique ----------
    {
      id: "e3ex-q13",
      question:
        "Selon le théorème de Nyquist-Shannon, quelle est la fréquence d'échantillonnage minimale théorique pour numériser sans repliement (aliasing) un signal audio jusqu'à 20 kHz ?",
      choices: ["20 kHz", "44,1 kHz", "40 kHz", "48 kHz"],
      answerIndex: 2,
      explanation:
        "Le théorème impose une fréquence d'échantillonnage strictement supérieure au double de la fréquence maximale du signal : au moins 40 kHz pour couvrir 20 kHz. Les fréquences normalisées 44,1 et 48 kHz ajoutent une marge pour le filtre anti-repliement.",
    },
    {
      id: "e3ex-q14",
      question:
        "Quelle est la dynamique théorique (rapport signal/bruit) d'un signal codé sur 16 bits, selon la formule 6,02·n + 1,76 (en dB) ?",
      choices: ["98 dB", "48 dB", "72 dB", "144 dB"],
      answerIndex: 0,
      explanation:
        "6,02 × 16 + 1,76 = 96,32 + 1,76 ≈ 98 dB. (Le 24 bits atteint quant à lui environ 146 dB, rarement exploités en pratique à cause du bruit analogique en amont.)",
    },
    {
      id: "e3ex-q15",
      question: "Quel est le débit binaire (non compressé) d'un signal stéréo échantillonné en 24 bits / 48 kHz ?",
      choices: ["1,152 Mbit/s", "4,608 Mbit/s", "48 Mbit/s", "2,304 Mbit/s"],
      answerIndex: 3,
      explanation:
        "Débit = fréquence d'échantillonnage × résolution × nombre de canaux = 48 000 × 24 × 2 = 2 304 000 bit/s = 2,304 Mbit/s.",
    },
    {
      id: "e3ex-q16",
      question:
        "En régie, plusieurs appareils numériques reliés en AES3 produisent des craquements périodiques bien que chaque appareil fonctionne normalement seul. Quelle est la cause la plus probable, et la solution ?",
      choices: [
        "Un problème d'alimentation fantôme : couper le +48 V sur chaque appareil",
        "Une désynchronisation d'horloge : désigner un maître wordclock et synchroniser tous les appareils sur cette horloge",
        "Un câble AES3 trop court",
        "Une fréquence d'échantillonnage trop élevée pour le format WAV",
      ],
      answerIndex: 1,
      explanation:
        "Sans horloge numérique commune (wordclock), les appareils reliés en numérique dérivent l'un par rapport à l'autre : les craquements périodiques trahissent une désynchronisation. Il faut désigner un maître d'horloge et synchroniser tous les esclaves dessus.",
    },
    // ---------- Traitement du signal ----------
    {
      id: "e3ex-q17",
      question: "Que représente le facteur Q d'un filtre paramétrique d'égaliseur ?",
      choices: [
        "Le rapport entre la fréquence centrale et la largeur de bande affectée : plus il est élevé, plus le filtre est étroit et précis",
        "Le gain maximal que peut appliquer le filtre",
        "Le nombre de bandes de l'égaliseur",
        "La latence introduite par le traitement",
      ],
      answerIndex: 0,
      explanation:
        "Q = fréquence centrale / largeur de bande. Un Q élevé cible une bande étroite (correction chirurgicale), un Q faible agit sur une large plage de fréquences (correction large et musicale).",
    },
    {
      id: "e3ex-q18",
      question:
        "Un compresseur a un seuil (threshold) à −20 dBFS et un ratio 4:1. Un signal entre à −4 dBFS. Quel est le niveau en sortie, avant tout makeup gain ?",
      choices: ["−4 dBFS", "−12 dBFS", "−16 dBFS", "−20 dBFS"],
      answerIndex: 2,
      explanation:
        "Le signal dépasse le seuil de 16 dB (−4 − (−20) = 16). Ce dépassement est divisé par le ratio : 16 / 4 = 4 dB au-dessus du seuil en sortie. Niveau de sortie = −20 + 4 = −16 dBFS.",
    },
    {
      id: "e3ex-q19",
      question:
        "Une norme de diffusion impose −23 LUFS intégré (EBU R128). Votre mix mesure −16 LUFS intégré. De combien de dB faut-il réduire le niveau global pour se conformer à la norme ?",
      choices: ["3 dB", "7 dB", "9 dB", "16 dB"],
      answerIndex: 1,
      explanation:
        "L'écart est de −16 − (−23) = 7 dB : le mix est 7 dB trop fort par rapport à la cible, il faut donc l'atténuer de 7 dB (ou utiliser une normalisation loudness automatique).",
    },
    {
      id: "e3ex-q20",
      question:
        "Sur le bus principal, la compression provoque un effet de « pompage » (pumping) audible, en rythme avec le kick. Quelle est la cause la plus probable et comment la corriger ?",
      choices: [
        "Le ratio est trop faible : il faut l'augmenter",
        "Le temps de release est trop long par rapport au tempo : il faut le raccourcir",
        "Le seuil est réglé trop haut : il faut le monter encore",
        "Le temps de release est trop court par rapport au tempo, provoquant une remontée de gain audible et cyclique : il faut l'allonger ou utiliser un release program-dependent",
      ],
      answerIndex: 3,
      explanation:
        "Le pompage apparaît quand le gain remonte de façon audible et synchronisée avec le rythme, généralement parce que le release est trop rapide par rapport à l'enveloppe du programme. Allonger le release (ou utiliser un release automatique/program-dependent) lisse la remontée de gain.",
    },
    // ---------- Supports & équipements ----------
    {
      id: "e3ex-q21",
      question: "Sur une tranche de console, quel réglage permet d'adapter le niveau d'entrée avant l'égaliseur et le fader ?",
      choices: ["Le routing", "L'insert", "Le pan", "Le gain (trim)"],
      answerIndex: 3,
      explanation:
        "Le gain (trim), premier bloc de la tranche, adapte le niveau d'entrée reçu (micro ou ligne) à la plage de travail optimale de la console, avant tout traitement.",
    },
    {
      id: "e3ex-q22",
      question: "Un préampli reçoit un signal à −46 dBu et son gain est réglé sur 40 dB. Quel est le niveau en sortie de préampli ?",
      choices: ["−86 dBu", "−6 dBu", "+6 dBu", "−40 dBu"],
      answerIndex: 1,
      explanation: "Niveau de sortie = niveau d'entrée + gain : −46 + 40 = −6 dBu.",
    },
    {
      id: "e3ex-q23",
      question:
        "Vous voulez envoyer de la réverbération sur la voix lead, en veillant à ce que le mélange direct/effet reste cohérent quand vous bougez le fader de cette voie pendant le mix. En quel mode faut-il régler ce départ auxiliaire ?",
      choices: ["Post-fader", "Pré-fader", "Pré-filtre", "Peu importe, le mode n'a aucune incidence"],
      answerIndex: 0,
      explanation:
        "Un départ d'effet est réglé en post-fader : le niveau envoyé à la réverbération suit le fader, ce qui conserve un équilibre direct/effet cohérent quel que soit le niveau de la voie dans le mix.",
    },
    {
      id: "e3ex-q24",
      question:
        "Un système micro HF présente des coupures aléatoires quand l'artiste se déplace sur scène, malgré des piles neuves et un bon niveau de charge. Quelle cause faut-il vérifier en priorité ?",
      choices: [
        "Le format de fichier de l'enregistreur",
        "L'impédance de sortie du micro",
        "Le placement des antennes de réception et les évanouissements par trajets multiples (problème de diversité)",
        "La fréquence d'échantillonnage du récepteur",
      ],
      answerIndex: 2,
      explanation:
        "Des coupures liées au déplacement, hors problème d'alimentation, évoquent des évanouissements par trajets multiples (multipath) : il faut vérifier le placement des antennes (ligne de vue, distance, réception en diversité) plutôt que l'électronique du micro.",
    },
  ],
};
