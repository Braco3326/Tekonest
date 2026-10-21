import type { Unit } from "../../types";

/**
 * E3 · Unité 2 — Électricité & électronique audio.
 * Impédance, niveaux d'exploitation, liaisons symétriques/asymétriques,
 * alimentation fantôme, masse. Notions récurrentes des annales E3-PTES.
 */
export const unitElectricite: Unit = {
  id: "e3-u2",
  slug: "electricite-electronique",
  title: "Électricité & électronique audio — impédance, niveaux, liaisons",
  summary:
    "Impédance et adaptation en tension, niveaux d'exploitation (micro, ligne, instrument), liaison symétrique, alimentation fantôme +48 V et masse : la chaîne électrique du signal audio.",
  estimatedMinutes: 50,
  lesson: [
    { type: "h2", text: "1. Tension, puissance et niveaux électriques — rappels" },
    {
      type: "p",
      text: "Un signal audio électrique est une **tension alternative**. La valeur **crête** (Umax) mesure l'amplitude instantanée maximale ; la valeur **efficace (RMS, Root Mean Square)** est la valeur qui produirait le même échauffement dans une résistance qu'une tension continue équivalente — c'est elle qui représente l'énergie « utile » du signal, et c'est elle que l'on utilise pour tous les calculs de niveau (dBu, dBV).",
    },
    {
      type: "formula",
      latexLike: "Ucrête = URMS × √2",
      label: "Valable uniquement pour un signal sinusoïdal pur (√2 ≈ 1,414)",
    },
    {
      type: "p",
      text: "Ce **facteur de crête** de √2 ne vaut que pour une sinusoïde. Un signal musical réel a un facteur de crête bien plus élevé (souvent 10 à 20 dB entre crête et RMS) à cause des transitoires : c'est pourquoi on prévoit toujours une marge (headroom) entre le niveau RMS nominal et le plafond de l'appareil.",
    },
    {
      type: "formula",
      latexLike: "P = U² / R",
      label: "Puissance dissipée (W) dans une résistance R, avec U en valeur efficace",
    },
    { type: "h2", text: "2. Impédance : adaptation en tension, pas en puissance" },
    {
      type: "p",
      text: "L'**impédance** Z (en ohms) est le rapport complexe tension/courant d'un dipôle : elle inclut une part résistive et, souvent, une part réactive (dépendante de la fréquence, due aux bobinages et capacités). En audio, deux logiques de raccordement coexistent, et il ne faut pas les confondre.",
    },
    {
      type: "note",
      tone: "warning",
      text: "Historiquement (téléphonie, lignes 600 Ω), on recherchait une **adaptation d'impédance** (Z source = Z charge) pour maximiser le transfert de puissance sur de longues lignes passives. En électronique audio moderne, les étages actifs rendent cette contrainte obsolète : on préfère largement transmettre un **niveau de tension** fidèle plutôt qu'un transfert de puissance maximal.",
    },
    {
      type: "p",
      text: "La règle moderne est celle du **bridging** (adaptation en tension) : l'impédance d'entrée du récepteur doit être très supérieure à l'impédance de sortie de la source, généralement d'un facteur **10 au minimum**. Une source à faible impédance de sortie « voit » alors une charge quasi ouverte : la tension se transmet avec une perte négligeable, et plusieurs récepteurs peuvent être branchés en parallèle sur la même sortie sans s'affaiblir mutuellement.",
    },
    {
      type: "formula",
      latexLike: "Zin ≫ Zout, généralement Zin ≥ 10 × Zout",
      label: "Règle du ×10 — adaptation en tension (bridging)",
    },
    {
      type: "table",
      caption: "Impédances typiques d'une chaîne audio",
      header: ["Liaison", "Z de sortie", "Z d'entrée", "Rapport"],
      rows: [
        ["Micro → préampli", "150–200 Ω", "1,5–2 kΩ", "≈ ×10"],
        ["Sortie ligne → entrée ligne", "≈ 100 Ω", "≈ 10 kΩ", "≈ ×100"],
        ["Instrument (guitare passive) → DI/ampli", "10 kΩ à plus de 1 MΩ (Hi-Z)", "≥ 1 MΩ (entrée Hi-Z dédiée)", "variable"],
        ["Ampli casque → casque", "quelques Ω", "32–300 Ω", "adaptation de puissance"],
        ["Ampli de puissance → haut-parleur", "< 1 Ω (facteur d'amortissement élevé)", "4 ou 8 Ω (nominal)", "adaptation de puissance"],
      ],
    },
    {
      type: "p",
      text: "Le cas des **casques et haut-parleurs** est différent : ce sont des transducteurs qui doivent fournir un vrai **travail mécanique** (déplacer une membrane), donc recevoir de la **puissance** (P = U²/Z) et non simplement une tension fidèle. L'impédance nominale (4 Ω, 8 Ω…) est fixée par la construction du transducteur et détermine le courant appelé à l'amplificateur : à tension de sortie maximale identique, une charge de 4 Ω consomme deux fois plus de courant qu'une charge de 8 Ω. L'amplificateur garde toutefois une impédance de sortie très faible (bon facteur d'amortissement, contrôle de la membrane), mais il n'y a pas de rapport ×10 recherché avec le haut-parleur.",
    },
    {
      type: "example",
      title: "Exercice résolu — pont diviseur sur une liaison ligne",
      problem:
        "Une sortie ligne d'impédance 100 Ω est reliée à une entrée ligne d'impédance 10 kΩ (câble court, capacité négligée). Quelle est la perte de niveau due au pont diviseur formé par ces deux impédances ?",
      steps: [
        "Le montage forme un pont diviseur : Uentrée / Usource = Zin / (Zin + Zout).",
        "Uentrée / Usource = 10 000 / (10 000 + 100) = 10 000 / 10 100 ≈ 0,990.",
        "Perte en dB : 20 · log₁₀(0,990) ≈ −0,09 dB.",
      ],
      answer:
        "La perte est d'environ 0,09 dB, totalement négligeable — c'est exactement l'objectif du rapport ≈×100 entre Zin et Zout sur une liaison ligne.",
    },
    {
      type: "example",
      title: "Exercice résolu — vérification de la règle du ×10",
      problem:
        "Un micro d'impédance de sortie 150 Ω est branché sur une entrée micro de 1,5 kΩ (rapport ×10). Calculer la perte de niveau. Que se passerait-il avec une entrée de seulement 450 Ω (rapport ×3) ?",
      steps: [
        "Cas ×10 : Uentrée / Usource = 1 500 / (1 500 + 150) = 1 500 / 1 650 ≈ 0,909.",
        "Perte correspondante : 20 · log₁₀(0,909) ≈ −0,83 dB.",
        "Cas ×3 : Uentrée / Usource = 450 / (450 + 150) = 450 / 600 = 0,75 → perte = 20 · log₁₀(0,75) ≈ −2,5 dB, avec en plus une dégradation de la réponse en aigu (la capacité du câble interagit davantage avec une charge plus faible).",
      ],
      answer:
        "Avec un rapport ×10, la perte reste sous 1 dB (≈0,83 dB), jugée négligeable. En dessous de ce rapport, la perte dépasse 2 dB et la bande passante se dégrade : d'où la règle du ×10 minimum enseignée pour toute liaison en tension.",
    },
    {
      type: "note",
      tone: "exam",
      text: "Les annales E3 demandent régulièrement de justifier pourquoi on ne cherche plus l'adaptation d'impédance en audio (sauf lignes téléphoniques historiques à 600 Ω) et de vérifier numériquement la règle du ×10 à partir d'impédances données.",
    },
    { type: "h2", text: "3. Niveaux d'exploitation" },
    {
      type: "p",
      text: "Selon l'étage de la chaîne, le signal audio circule à des niveaux très différents. Le **niveau micro** est très faible (−60 à −40 dBu), ce qui impose un préamplificateur à fort gain (souvent 40 à 70 dB). Le **niveau instrument** (guitare/basse passive, dite **Hi-Z**) est à la fois faible en tension et surtout à **très haute impédance de sortie** (dizaines à centaines de kΩ, potentiomètres et bobinages du micro), ce qui le rend fragile au bruit et aux longueurs de câble.",
    },
    {
      type: "p",
      text: "La **boîte de direct (DI)** répond à ce problème : elle abaisse l'impédance de sortie (via un transformateur ou un étage actif à FET) et **symétrise** le signal, permettant de longues liaisons XLR sans dégradation, en parallèle d'une sortie parallèle (« thru ») vers l'ampli de scène.",
    },
    {
      type: "table",
      caption: "Niveaux d'exploitation à connaître",
      header: ["Type de signal", "Niveau typique", "Impédance de sortie typique"],
      rows: [
        ["Micro", "−60 à −40 dBu", "150–600 Ω"],
        ["Instrument Hi-Z (guitare passive)", "variable, souvent bas niveau", "10 kΩ à plus de 1 MΩ"],
        ["Ligne professionnelle", "+4 dBu (≈ 1,23 V RMS)", "≈ 100 Ω, souvent symétrique"],
        ["Ligne grand public", "−10 dBV (≈ 0,316 V RMS)", "≈ 1 kΩ, souvent asymétrique (RCA)"],
      ],
    },
    {
      type: "p",
      text: "Attention à ne pas confondre les deux échelles de tension : le **dBu** est référencé à 0,775 V, le **dBV** est référencé à **1 V** (0 dBV = 1 V). L'écart fixe entre les deux échelles vaut 20·log₁₀(1/0,775) ≈ 2,21 dB, donc dBu = dBV + 2,21.",
    },
    {
      type: "example",
      title: "Exercice résolu — conversion dBu ↔ volts et écart pro/grand public",
      problem:
        "Une sortie grand public délivre −10 dBV. Quelle tension RMS cela représente-t-il, et quel est l'écart en dB avec le niveau ligne professionnel +4 dBu (1,23 V) ?",
      steps: [
        "Référence dBV : U = 1 × 10^(−10/20) = 10^(−0,5) ≈ 0,316 V.",
        "Conversion en dBu : dBu = dBV + 2,21 = −10 + 2,21 ≈ −7,79 dBu.",
        "Écart avec +4 dBu : 4 − (−7,79) ≈ 11,8 dB.",
      ],
      answer:
        "U ≈ 0,316 V, soit environ −7,8 dBu. L'écart avec le niveau pro (+4 dBu) est d'environ 11,8 dB (souvent arrondi à 12 dB) : c'est pourquoi les interfaces audio proposent des commutateurs +4 dBu / −10 dBV, faute de quoi on perd énormément de dynamique ou l'on sature.",
    },
    { type: "h2", text: "4. Liaison symétrique et rejet du bruit" },
    {
      type: "p",
      text: "Une liaison **symétrique** (balanced) utilise trois conducteurs : la **masse/blindage** (référence mécanique et électrique), le **point chaud** (signal en phase) et le **point froid** (même signal, en opposition de phase, même amplitude). À l'entrée, un amplificateur **différentiel** calcule (chaud − froid) : le signal utile, en opposition de phase sur les deux conducteurs, s'additionne (soit +6 dB par rapport à un seul conducteur), tandis qu'un parasite capté en cours de route de façon identique sur les deux conducteurs (mode commun) s'annule par soustraction.",
    },
    {
      type: "formula",
      latexLike: "CMRR = 20 · log₁₀(Gdifférentiel / Gmode commun)",
      label: "Common Mode Rejection Ratio — plus il est élevé (dB), meilleur est le rejet du bruit",
    },
    {
      type: "figure",
      figureId: "balanced-line",
      caption:
        "Liaison symétrique : le parasite induit en mode commun sur point chaud et point froid s'annule à l'entrée différentielle, tandis que le signal utile (en opposition de phase) s'additionne.",
    },
    {
      type: "table",
      caption: "Brochage des connecteurs symétriques",
      header: ["Connecteur", "Broche/contact", "Fonction"],
      rows: [
        ["XLR", "1", "Masse / blindage"],
        ["XLR", "2", "Point chaud (+)"],
        ["XLR", "3", "Point froid (−)"],
        ["Jack TRS (stéréo/symétrique)", "Tip / Ring / Sleeve", "Point chaud / point froid / masse"],
      ],
    },
    {
      type: "p",
      text: "Grâce à ce rejet de mode commun, une liaison symétrique tolère des longueurs de câble importantes (100 m et plus, comme dans un multipaire de salle ou de car régie) sans hum ni parasite audible. Une liaison **asymétrique** (un seul conducteur de signal + masse) n'a aucun mécanisme de rejet : au-delà de quelques mètres — et d'autant plus vite que l'impédance de source est élevée (cas d'un instrument Hi-Z) — le câble se comporte en antenne et capte le bruit ambiant (50 Hz, RF). C'est une raison supplémentaire d'utiliser une DI pour toute liaison instrument longue.",
    },
    { type: "h2", text: "5. Alimentation fantôme +48 V" },
    {
      type: "p",
      text: "L'alimentation fantôme (+48 V, norme P48) délivre une tension continue simultanément sur les points **2 et 3** (chaud et froid), référencée à la masse (point 1), via deux résistances égales (traditionnellement 6,8 kΩ). Comme cette tension est appliquée en **mode commun** — identique sur les deux conducteurs — elle ne crée aucune tension différentielle : elle est totalement invisible pour l'étage d'entrée qui ne « voit » que la différence chaud/froid.",
    },
    {
      type: "p",
      text: "Elle alimente les micros à **condensateur** : la tension de polarisation de la capsule (ou l'électronique d'un condensateur électret déjà auto-polarisé) ainsi que le préamplificateur intégré (souvent un FET, nécessaire pour convertir la très haute impédance de la capsule en une impédance de sortie basse). Elle peut aussi alimenter l'électronique d'une **DI active**.",
    },
    {
      type: "note",
      tone: "warning",
      text: "Un micro **dynamique** bien câblé en symétrique ignore le +48 V sans dommage. En revanche, certains **micros à ruban anciens**, non protégés, peuvent être endommagés : si le câblage n'est pas parfaitement symétrique (adaptateur asymétrique, défaut de câble), un courant continu peut alors circuler dans le ruban ou son transformateur et le démagnétiser, voire le rompre. Règle de prudence : ne jamais activer le +48 V sur un ruban non certifié « phantom power tolerant », et toujours couper l'alimentation fantôme avant de brancher/débrancher un micro sensible.",
    },
    { type: "h2", text: "6. Masse et boucles de masse" },
    {
      type: "p",
      text: "Une **boucle de masse** apparaît lorsque plusieurs appareils reliés par un câble de signal (masse commune, souvent le blindage) sont aussi reliés chacun à la terre de sécurité via leur propre prise secteur. Si un léger écart de potentiel existe entre les prises de terre, un courant circule dans le blindage du câble et s'y superpose au signal utile : c'est la classique **ronflette** à 50 Hz (et ses harmoniques, souvent 100 Hz).",
    },
    {
      type: "note",
      tone: "info",
      text: "Le **ground lift**, présent sur de nombreuses DI et certains appareils symétriques, coupe la continuité du blindage (masse de signal) entre les deux extrémités sans jamais toucher à la terre de sécurité (PE) des appareils, qui reste obligatoire pour la sécurité électrique. C'est le remède de première intention contre une boucle de masse ; un transformateur d'isolement (souvent intégré à la DI) en est une autre solution, plus radicale.",
    },
  ],
  quiz: [
    {
      id: "e3u2-q1",
      question: "Pour un signal sinusoïdal, quelle relation relie tension crête et tension efficace (RMS) ?",
      choices: ["Ucrête = URMS", "Ucrête = URMS × √2", "Ucrête = URMS / √2", "Ucrête = 2 × URMS"],
      answerIndex: 1,
      explanation:
        "Le facteur de crête d'une sinusoïde vaut √2 ≈ 1,414. Ce facteur ne s'applique pas tel quel à un signal musical réel, dont le facteur de crête est bien plus élevé.",
    },
    {
      id: "e3u2-q2",
      question: "Quelle est la règle usuelle d'adaptation en tension (bridging) entre une sortie et une entrée audio modernes ?",
      choices: [
        "Zin = Zout (adaptation d'impédance)",
        "Zin = 0 Ω (court-circuit)",
        "Zin ≪ Zout",
        "Zin ≫ Zout, généralement au moins ×10",
      ],
      answerIndex: 3,
      explanation:
        "Contrairement aux lignes téléphoniques historiques à 600 Ω, l'électronique audio moderne recherche une adaptation en tension : une entrée à haute impédance charge très peu la sortie, ce qui transmet le niveau avec une perte négligeable.",
    },
    {
      id: "e3u2-q3",
      question: "Un micro dynamique a une impédance de sortie d'environ 150–200 Ω. Quelle est l'impédance d'entrée typique d'un préampli micro bien adapté ?",
      choices: ["1,5 à 2 kΩ", "200 Ω", "600 Ω", "50 kΩ"],
      answerIndex: 0,
      explanation:
        "On applique la règle du ×10 : environ 1,5 à 2 kΩ en entrée pour 150–200 Ω en sortie, ce qui limite la perte de niveau à moins de 1 dB.",
    },
    {
      id: "e3u2-q4",
      question: "Quelles sont les impédances typiques d'une liaison ligne professionnelle ?",
      choices: [
        "Sortie 10 kΩ / entrée 100 Ω",
        "Sortie 600 Ω / entrée 600 Ω (adaptées)",
        "Sortie 50 Ω / entrée 50 Ω",
        "Sortie ≈ 100 Ω / entrée ≈ 10 kΩ",
      ],
      answerIndex: 3,
      explanation:
        "Le rapport ≈×100 entre une sortie ligne basse impédance et une entrée ligne haute impédance rend la perte de niveau totalement négligeable (moins de 0,1 dB).",
    },
    {
      id: "e3u2-q5",
      question: "Pourquoi recherche-t-on une adaptation de puissance (et non une simple adaptation en tension) entre un amplificateur et une enceinte ou un casque ?",
      choices: [
        "Pour minimiser le bruit électronique",
        "Parce que le transducteur doit recevoir de la puissance pour produire un travail mécanique (déplacer la membrane)",
        "Pour éviter les boucles de masse",
        "Parce que la tension y est toujours nulle",
      ],
      answerIndex: 1,
      explanation:
        "Un haut-parleur ou un casque convertit l'énergie électrique en énergie mécanique puis acoustique : contrairement à une liaison ligne, ce qui compte ici est la puissance délivrée (P = U²/Z) à l'impédance nominale du transducteur.",
    },
    {
      id: "e3u2-q6",
      question: "Quelle tension RMS correspond au niveau ligne professionnel +4 dBu ?",
      choices: ["1,23 V", "0,775 V", "1 V", "3,08 V"],
      answerIndex: 0,
      explanation:
        "U = 0,775 × 10^(4/20) ≈ 0,775 × 1,585 ≈ 1,23 V. Le dBu est référencé à 0,775 V, pas à 1 V (qui est la référence du dBV).",
    },
    {
      id: "e3u2-q7",
      question: "Quel est le rôle principal d'une boîte de direct (DI) pour un instrument électrique passif (guitare, basse) ?",
      choices: [
        "Amplifier le signal de 20 dB",
        "Ajouter de la réverbération",
        "Convertir un signal Hi-Z asymétrique en signal basse impédance symétrique",
        "Fournir l'alimentation secteur à l'instrument",
      ],
      answerIndex: 2,
      explanation:
        "La DI abaisse l'impédance de sortie (transformateur ou étage actif) et symétrise le signal, ce qui permet de longues liaisons XLR vers la console sans perte ni bruit.",
    },
    {
      id: "e3u2-q8",
      question: "Comment une liaison symétrique rejette-t-elle les parasites captés le long du câble ?",
      choices: [
        "En blindant totalement le câble contre tout champ électromagnétique",
        "Par soustraction différentielle : le parasite, identique sur les deux conducteurs (mode commun), s'annule à l'entrée",
        "En amplifiant sélectivement le point chaud",
        "En doublant la tension du signal utile",
      ],
      answerIndex: 1,
      explanation:
        "Le parasite induit en mode commun est identique sur point chaud et point froid ; l'amplificateur différentiel calcule leur différence, ce qui l'annule, alors que le signal utile (en opposition de phase) s'additionne.",
    },
    {
      id: "e3u2-q9",
      question: "Quel est le brochage correct d'un connecteur XLR pour une liaison audio symétrique ?",
      choices: [
        "1 = point chaud, 2 = masse, 3 = point froid",
        "1 = point froid, 2 = point chaud, 3 = masse",
        "1 = masse, 2 = point froid, 3 = point chaud",
        "1 = masse, 2 = point chaud (+), 3 = point froid (−)",
      ],
      answerIndex: 3,
      explanation:
        "C'est le brochage normalisé : broche 1 masse/blindage, broche 2 point chaud, broche 3 point froid — à connaître par cœur pour l'E3.",
    },
    {
      id: "e3u2-q10",
      question: "Pourquoi faut-il se méfier d'envoyer du +48 V sur un micro à ruban ancien non protégé ?",
      choices: [
        "Cela n'a aucun risque, les rubans sont insensibles au courant continu",
        "Cela inverse la polarité du signal",
        "Le courant continu à travers le ruban ou son transformateur peut l'endommager ou le démagnétiser",
        "Cela fait disjoncter l'alimentation fantôme",
      ],
      answerIndex: 2,
      explanation:
        "Si le câblage n'est pas parfaitement symétrique, le +48 V peut créer un courant continu dans le ruban très fragile ou dans son transformateur élévateur, ce qui peut le démagnétiser voire le détruire.",
    },
  ],
};
