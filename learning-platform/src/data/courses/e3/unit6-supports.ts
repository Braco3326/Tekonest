import type { Unit } from "../../types";

/**
 * E3 · Unité 6 — Supports & équipements.
 * La chaîne de production son de bout en bout : gain staging, consoles,
 * configurations types, supports d'enregistrement, connectique et micros HF.
 * Unité de synthèse des annales E3-PTES (éduscol 2017–2025).
 */
export const unitSupports: Unit = {
  id: "e3-u6",
  slug: "supports-equipements",
  title: "Supports & équipements — chaînes de production son",
  summary:
    "De la source au support final : structure de gain, consoles analogiques et numériques, configurations types (studio, sonorisation, broadcast, post-prod), supports d'enregistrement, connectique et micros HF.",
  estimatedMinutes: 45,
  lesson: [
    { type: "h2", text: "1. La chaîne du signal et la structure de gain (gain staging)" },
    {
      type: "p",
      text: "Une chaîne de production son relie une **source** à un **support d'enregistrement ou de diffusion** à travers une succession d'étages qui amplifient, traitent et convertissent le signal. Le schéma type, à connaître par cœur :",
    },
    {
      type: "list",
      ordered: true,
      items: [
        "**Source** — voix, instrument, ambiance.",
        "**Microphone** (ou autre transducteur) — convertit la pression acoustique en tension électrique, à un niveau très faible (niveau micro).",
        "**Préampli** — amplifie le niveau micro jusqu'au niveau ligne nominal.",
        "**Traitement** (optionnel) — EQ, dynamique, effets en amont de la console ou intégrés à celle-ci.",
        "**Console** — tranche (gain, filtre, EQ, dynamique, fader, routing), bus, auxiliaires.",
        "**Bus** — somme les tranches assignées vers une sortie commune (principal, sous-groupe, enregistrement, diffusion).",
        "**Convertisseurs** — A/N à l'entrée du monde numérique, N/A en sortie vers la diffusion analogique.",
        "**Enregistreur ou système de diffusion** — support final : fichier, émetteur, système de sonorisation.",
      ],
    },
    {
      type: "figure",
      figureId: "signal-chain",
      caption:
        "La chaîne du signal type, de la source au support final : chaque étage ajoute du gain (ou de l'atténuation) — et du bruit.",
    },
    { type: "h3", text: "La structure de gain (gain staging)" },
    {
      type: "p",
      text: "Le **gain staging** consiste à régler le gain d'entrée de chaque étage pour que le signal circule autour d'un **niveau nominal** (repère 0 VU, +4 dBu en exploitation professionnelle), ni trop bas (bruit de fond audible), ni trop haut (écrêtage). L'écart entre le niveau nominal et le seuil de saturation constitue la **marge de manœuvre (headroom)** disponible pour les transitoires.",
    },
    {
      type: "formula",
      latexLike: "N_sortie (dBu) = N_entrée (dBu) + G (dB)",
      label: "Les niveaux s'additionnent en dB à chaque étage — une échelle logarithmique se manipule par addition, pas par multiplication.",
    },
    {
      type: "table",
      caption: "Ordres de grandeur des niveaux le long de la chaîne",
      header: ["Étage", "Niveau typique", "Repère"],
      rows: [
        ["Sortie micro (voix, prise proche)", "−60 à −40 dBu", "Signal très faible, sensible au bruit"],
        ["Sortie préampli (après gain)", "≈ +4 dBu (0 VU)", "Niveau ligne professionnel nominal"],
        ["Entrée convertisseur A/N", "+4 dBu ↔ −18 dBFS", "Alignement broadcast EBU R68 (vu en unité 1)"],
        ["Sortie ampli de puissance", "Plusieurs dizaines de volts", "Niveau haut-parleur, ne s'exprime pas en dBu"],
      ],
    },
    {
      type: "note",
      tone: "warning",
      text: "Le bruit s'ajoute à **chaque étage** de la chaîne, mais c'est le **premier gain appliqué au signal le plus faible — le préampli micro — qui fixe le rapport signal/bruit final**. Sous-gainer au préampli puis rattraper le niveau plus loin (fader, gain numérique) ne fait que remonter le bruit déjà mélangé au signal utile.",
    },
    {
      type: "example",
      title: "Exercice résolu — diagnostiquer une chaîne de gain",
      problem:
        "Un microphone délivre −54 dBu. Le préampli est réglé sur un gain de 50 dB. Le signal alimente ensuite un convertisseur aligné sur +4 dBu ↔ −18 dBFS. Quel est le niveau en sortie de préampli, et quel est l'écart au niveau nominal ?",
      steps: [
        "Niveau de sortie = niveau d'entrée + gain : −54 + 50 = −4 dBu.",
        "Le niveau nominal de la chaîne est +4 dBu : l'écart est donc de −4 − 4 = −8 dB en dessous du nominal.",
        "En dBFS (alignement +4 dBu ↔ −18 dBFS), le même écart de −8 dB s'applique : −18 − 8 = −26 dBFS.",
      ],
      answer:
        "−4 dBu en sortie de préampli, soit −26 dBFS après conversion : le signal est sous-gainé de 8 dB. Il faut remonter le gain analogique du préampli — et non compenser plus tard en numérique — pour retrouver le nominal et préserver le rapport signal/bruit.",
    },
    { type: "h2", text: "2. La console : tranche, bus, auxiliaires, groupes et matrice" },
    { type: "h3", text: "La tranche (channel strip)" },
    {
      type: "p",
      text: "Chaque voie d'entrée traverse la même succession de blocs : **gain** (trim, adapte le niveau d'entrée), **filtre** (coupe-bas/HPF pour retirer les infra-graves inutiles), **égaliseur** (correction de timbre), **dynamique** (compresseur/gate insérables), **fader** (niveau final dans le mix) et **routing** (assignation vers le bus principal, un ou plusieurs sous-groupes, les auxiliaires).",
    },
    { type: "h3", text: "Bus auxiliaires : pré-fader et post-fader" },
    {
      type: "p",
      text: "Un **bus auxiliaire** crée un mix indépendant du mix principal, à partir d'un départ réglable sur chaque tranche. Deux modes possibles, à ne jamais confondre :",
    },
    {
      type: "list",
      items: [
        "**Pré-fader** : le départ est prélevé avant le fader — le niveau envoyé à l'aux ne dépend pas de la position du fader. Usage type : **retours de scène (monitors)**, pour que le musicien garde un niveau stable même si l'ingénieur façade bouge son fader.",
        "**Post-fader** : le départ est prélevé après le fader — le niveau envoyé à l'aux suit les mouvements du fader. Usage type : **départs d'effets (réverbération, delay)**, pour que le mélange direct/effet reste cohérent quand le niveau de la voie change.",
      ],
    },
    {
      type: "note",
      tone: "exam",
      text: "Question classique des annales : identifier si un départ doit être pré ou post-fader selon l'usage. La règle à retenir : **retour de scène → pré ; effet → post**.",
    },
    { type: "h3", text: "Groupes (sous-groupes), VCA/DCA et matrice" },
    {
      type: "p",
      text: "Un **groupe (sous-groupe)** additionne réellement plusieurs voies dans un bus audio commun : on peut y insérer un traitement partagé (compression, EQ) avant renvoi vers le bus principal — pratique pour un sous-mix de batterie ou de chœurs. Un **VCA** (console analogique) ou son équivalent numérique le **DCA** ne transporte, lui, aucun audio : c'est un simple contrôle de gain à distance qui pilote le niveau de plusieurs tranches assignées, sans sommation ni traitement commun possible. La **matrice** est un étage de routage supplémentaire après les bus, qui permet de composer des mix additionnels à partir des sorties existantes (diffusions de zone en sonorisation, retour spécifique en broadcast…).",
    },
    { type: "h3", text: "Consoles numériques" },
    {
      type: "p",
      text: "Une console numérique ajoute la mémorisation totale des réglages (**scènes**, rappels partiels), des **effets intégrés** (réverbération, dynamique, souvent sous forme de traitements internes), un **contrôle déporté** (tablette ou surface de contrôle sur le réseau, sans devoir être physiquement à la console) et surtout la possibilité d'une **stagebox déportée reliée en AoIP** (audio-sur-IP, cf. unité 4) : un seul câble réseau ou fibre remplace un multipaire analogique volumineux entre la scène et la régie.",
    },
    {
      type: "example",
      title: "Exercice résolu — dimensionner les auxiliaires de retour",
      problem:
        "Un groupe de 5 musiciens demande chacun un mix de retour différent (batterie, basse, guitare, clavier, chant). Combien de départs auxiliaires faut-il prévoir au minimum, et en quel mode ?",
      steps: [
        "Chaque musicien veut un équilibre différent : il faut un mix indépendant par musicien, donc un aux dédié par retour.",
        "5 musiciens → 5 départs aux minimum (un de plus si un retour supplémentaire partagé est ajouté, par exemple un ampli de scène commun).",
        "Un retour de scène doit rester stable quel que soit le mix façade : chaque aux est donc réglé en **pré-fader**.",
      ],
      answer:
        "5 auxiliaires pré-fader, un par musicien. Si la console ne dispose pas d'assez d'aux, il faut regrouper des instruments compatibles (par exemple basse et grosse caisse sur un même retour) plutôt que de basculer un retour en post-fader.",
    },
    { type: "h2", text: "3. Configurations types de chaînes de production" },
    { type: "h3", text: "Studio d'enregistrement" },
    {
      type: "p",
      text: "Une régie (contrôle) et une ou plusieurs cabines (prise de son) sont séparées acoustiquement mais reliées par la baie de brassage. Le **monitoring** (enceintes de contrôle et casques) permet à l'ingénieur du son d'évaluer la prise ; le **talkback** est le micro de communication de la régie vers la cabine — souvent coupé automatiquement sur le monitoring quand il est activé, pour éviter le larsen.",
    },
    { type: "h3", text: "Sonorisation" },
    {
      type: "p",
      text: "On distingue la **façade** (FOH — Front of House, diffusion vers le public) et les **retours** (diffusion vers la scène pour les musiciens), gérés par deux mix distincts, parfois deux consoles séparées. Deux familles de systèmes de diffusion : le **line array** (colonne de boîtes identiques couplées verticalement, pour mieux maîtriser la dispersion verticale et ralentir l'atténuation avec la distance sur de longues portées) et le **point source** (une ou quelques enceintes par zone, rayonnement plus proche d'une source ponctuelle classique, plus simple à mettre en œuvre pour une salle de taille modeste).",
    },
    { type: "h3", text: "Broadcast / radio" },
    {
      type: "p",
      text: "En **conduite** (régie de diffusion), le direct est géré avec des **ordres** (intercom entre régie, studio et reportage) pour coordonner les prises de parole et les enchaînements. Pour un intervenant en duplex, on lui envoie un **mix-minus (N-1)** : le programme complet moins sa propre voix, afin d'éviter tout effet Larsen ou écho de retour.",
    },
    { type: "h3", text: "Post-production" },
    {
      type: "p",
      text: "Le montage et le mixage se font sur une **station de travail audionumérique (DAW)**, synchronisée à l'image par timecode. Les échanges de projet entre stations ou entre étapes (montage → mixage → étalonnage sonore) utilisent des formats d'interopérabilité comme l'**AAF** ou l'**OMF**, tandis que le rendu audio final voyage en **BWF** (WAV avec métadonnées).",
    },
    { type: "h2", text: "4. Supports d'enregistrement et fichiers" },
    {
      type: "p",
      text: "Le format de référence en production son professionnelle est le **WAV/BWF (Broadcast Wave Format)** : un flux audio non compressé (PCM), auquel s'ajoutent des métadonnées embarquées dans le chunk *bext* — timecode d'origine, description, nom de la prise — indispensables pour resynchroniser le son en post-production.",
    },
    {
      type: "p",
      text: "Les enregistrements multicanaux se stockent soit en un seul fichier entrelacé (polyWAV), soit en fichiers mono séparés par piste — une convention de nommage rigoureuse devient alors essentielle pour ne rien perdre au montage.",
    },
    {
      type: "p",
      text: "La **redondance** protège contre la perte de prise : enregistrement simultané sur deux supports (carte + disque, ou deux cartes miroir dans le même enregistreur), voire un second enregistreur de secours. Le **workflow fichier** organise le trajet du son du tournage/de la session à la post-production : nommage, vérification d'intégrité (souvent via un fichier de contrôle type checksum), sauvegarde avant tout effacement de carte.",
    },
    {
      type: "note",
      tone: "info",
      text: "Un enregistreur qui ne propose qu'une seule carte mémoire n'offre aucune redondance : en tournage, on préfère un modèle à cartes miroir (deux copies simultanées et identiques) ou doublé d'un enregistreur de secours.",
    },
    { type: "h2", text: "5. Connectique et câblage" },
    {
      type: "table",
      caption: "Connectique récapitulative",
      header: ["Connecteur", "Signal typique", "Repère / particularité"],
      rows: [
        ["XLR (3 points)", "Micro, ligne symétrique", "Verrouillable, alimentation fantôme +48 V possible"],
        ["Jack 6,35 TRS", "Ligne symétrique, casque, insert", "TRS = 3 contacts (pointe/anneau/manchon)"],
        ["Jack 6,35 TS", "Ligne asymétrique (instrument)", "TS = 2 contacts, sensible aux parasites sur de longs câbles"],
        ["RCA (cinch)", "Ligne asymétrique grand public", "Non verrouillable, pas de blindage renforcé"],
        ["speakON", "Haut-parleur amplifié (puissance)", "Verrouillable, courant élevé, incompatible avec un XLR"],
        ["BNC", "Wordclock, vidéo, MADI coaxial", "Verrouillage à baïonnette, câble 75 Ω"],
        ["RJ45", "Réseau audio-sur-IP (AoIP)", "Dante, Ravenna… plusieurs dizaines de canaux par câble"],
        ["Fibre optique", "MADI optique, réseaux AoIP longue distance", "Immunité totale aux parasites électromagnétiques"],
      ],
    },
    {
      type: "p",
      text: "On ne relie jamais un haut-parleur amplifié avec un câble XLR ou jack : le **speakON** est conçu pour transporter un courant important en toute sécurité (contacts protégés, verrouillage mécanique) et sa forme empêche toute confusion avec une liaison micro ou ligne — un branchement croisé pourrait endommager une entrée micro ou blesser un technicien.",
    },
    {
      type: "p",
      text: "Le câblage n'est pas interchangeable non plus : un **câble micro** (paire torsadée blindée, section fine) protège un signal faible du bruit électromagnétique ; un **câble AES3** utilise la même paire torsadée blindée mais avec une **impédance caractéristique de 110 Ω contrôlée**, nécessaire pour transporter un signal numérique haute fréquence sans réflexions ni erreurs ; un **câble haut-parleur** n'a lui besoin d'aucun blindage (signal de puissance, peu sensible aux parasites) mais demande une **section de conducteur plus importante** pour limiter les pertes résistives sur un circuit à basse impédance (4 à 8 Ω).",
    },
    {
      type: "example",
      title: "Exercice résolu — choisir la connectique adaptée",
      problem:
        "Il faut relier un amplificateur de façade à une enceinte, à 25 m de distance, ainsi qu'une console à un ordinateur de mesure via un signal numérique AES3 sur 15 m. Quels connecteurs et câbles utiliser pour chaque liaison ?",
      steps: [
        "Liaison ampli → enceinte : signal de puissance, basse impédance → connecteur **speakON**, câble haut-parleur de section suffisante (non blindé, mais section plus généreuse qu'un câble micro pour limiter la chute de tension sur 25 m).",
        "Liaison console → ordinateur de mesure : signal numérique symétrique haute fréquence → connecteur **XLR**, câble **AES3 110 Ω** (un câble micro standard dégraderait le signal au-delà de quelques mètres, par réflexions et gigue).",
      ],
      answer:
        "speakON + câble HP pour l'enceinte ; XLR + câble AES 110 Ω pour la liaison numérique. Utiliser un câble micro ordinaire pour l'AES3 peut fonctionner sur une très courte distance, mais devient risqué au-delà de quelques mètres.",
    },
    { type: "h2", text: "6. Micros HF : principe et diversité" },
    {
      type: "p",
      text: "Un système de microphone HF associe un **émetteur** (intégré au micro ou en pack ceinture) et un **récepteur**, reliés par une liaison radio en bande **UHF**. L'émetteur module le signal audio sur une fréquence porteuse ; le récepteur la démodule et restitue un niveau ligne ou micro exploitable par la console.",
    },
    {
      type: "p",
      text: "La **diversité (diversity)** utilise deux antennes, et souvent deux étages de réception, pour sélectionner en permanence le meilleur signal reçu : elle compense les évanouissements par trajets multiples (multipath), fréquents quand l'émetteur se déplace dans une salle pleine de réflexions.",
    },
    {
      type: "p",
      text: "Les fréquences utilisables sont réparties en bandes autorisées, réglementées et sujettes à réattribution (dégagement progressif de certaines bandes UHF au profit de la téléphonie mobile) ; au-delà de quelques émetteurs simultanés, une **coordination de fréquences** est nécessaire pour éviter les produits d'intermodulation entre porteuses. Enfin, un gain d'émetteur mal réglé (trop bas) dégrade le rapport signal/bruit de toute la liaison radio, exactement comme un préampli sous-gainé — d'où l'importance de vérifier l'autonomie des accus et le niveau d'entrée avant chaque prestation.",
    },
    {
      type: "note",
      tone: "exam",
      text: "Les annales E3 croisent souvent supports et notions vues dans les autres unités : gain staging et niveaux (unités 1 et 2), échantillonnage et réseaux AoIP (unité 4). Révisez la chaîne complète, pas les unités isolément.",
    },
  ],
  quiz: [
    {
      id: "e3u6-q1",
      question:
        "Quel est l'ordre correct d'une chaîne de production son type ?",
      choices: [
        "Micro → préampli → console (traitement) → convertisseur → enregistreur/diffusion",
        "Convertisseur → micro → préampli → console → enregistreur",
        "Préampli → micro → convertisseur → console → enregistreur",
        "Console → micro → préampli → convertisseur → enregistreur",
      ],
      answerIndex: 0,
      explanation:
        "Le signal part toujours de la source la plus faible (micro) vers l'amplification (préampli), le traitement/mixage (console), puis la conversion et le support final.",
    },
    {
      id: "e3u6-q2",
      question: "À quel étage de la chaîne se joue principalement le rapport signal/bruit d'une prise de son ?",
      choices: [
        "Le limiteur de sortie",
        "Le convertisseur A/N",
        "Le préampli microphonique",
        "L'enregistreur numérique",
      ],
      answerIndex: 2,
      explanation:
        "Le signal micro est le plus faible de toute la chaîne : c'est le gain appliqué à cet étage qui fixe le rapport signal/bruit final, difficile à rattraper plus loin.",
    },
    {
      id: "e3u6-q3",
      question:
        "Un micro délivre −54 dBu. Le préampli a un gain de 50 dB. Quel est le niveau en sortie de préampli ?",
      choices: ["−104 dBu", "−4 dBu", "+4 dBu", "+50 dBu"],
      answerIndex: 1,
      explanation: "Les niveaux s'additionnent en dB : −54 + 50 = −4 dBu.",
    },
    {
      id: "e3u6-q4",
      question: "Pour un retour de scène (moniteur de musicien), quel type de départ auxiliaire utilise-t-on généralement ?",
      choices: ["Pré-fader", "Post-fader", "Post-EQ uniquement", "Post-insert uniquement"],
      answerIndex: 0,
      explanation:
        "Un retour de scène doit garder un niveau stable indépendamment des mouvements de fader du mix façade : le départ est donc pré-fader.",
    },
    {
      id: "e3u6-q5",
      question: "Quelle est la fonction d'un groupe (sous-groupe) sur une console, par différence avec un bus auxiliaire ?",
      choices: [
        "Il crée un mix indépendant renvoyé vers une sortie séparée",
        "Il synchronise le wordclock de la console",
        "Il alimente un système d'intercom",
        "Il additionne plusieurs voies pour un contrôle et un traitement commun avant le bus principal",
      ],
      answerIndex: 3,
      explanation:
        "Contrairement à l'aux (mix indépendant), le sous-groupe additionne réellement l'audio de plusieurs voies dans un bus commun, permettant d'y insérer un traitement partagé.",
    },
    {
      id: "e3u6-q6",
      question: "Quel est l'avantage principal d'un système line array par rapport à un système point source en sonorisation de grande salle ?",
      choices: [
        "Un coût plus faible",
        "Une meilleure maîtrise de la dispersion verticale et une atténuation plus lente avec la distance",
        "Une absence totale de besoin de traitement DSP",
        "Un encombrement réduit",
      ],
      answerIndex: 1,
      explanation:
        "Le couplage vertical de boîtes identiques permet de mieux contrôler la dispersion verticale et de ralentir la décroissance du niveau sur de longues portées, utile en grande salle ou en plein air.",
    },
    {
      id: "e3u6-q7",
      question: "En conduite radio, à quoi sert le principe du mix-minus (N-1) envoyé à un intervenant en duplex ?",
      choices: [
        "À ajouter de la réverbération sur son micro",
        "À synchroniser le timecode",
        "À couper l'antenne pendant la publicité",
        "À supprimer sa propre voix du retour pour éviter le larsen/écho",
      ],
      answerIndex: 3,
      explanation:
        "Le mix-minus envoie à l'intervenant le programme complet moins sa propre voix, évitant tout effet Larsen ou écho de retour sur la liaison.",
    },
    {
      id: "e3u6-q8",
      question: "Que contient un fichier BWF (Broadcast Wave Format) que ne contient pas un WAV standard ?",
      choices: [
        "Une compression sans perte supplémentaire",
        "Des métadonnées embarquées (timecode, description, origine) via le chunk bext",
        "Un débit binaire plus élevé",
        "Une piste vidéo de référence",
      ],
      answerIndex: 1,
      explanation:
        "Le BWF ajoute au WAV des métadonnées dans le chunk bext (timecode d'origine, description, nom de prise), essentielles pour resynchroniser le son en post-production.",
    },
    {
      id: "e3u6-q9",
      question: "Pourquoi utilise-t-on un connecteur speakON plutôt qu'un XLR pour relier un ampli de puissance à une enceinte ?",
      choices: [
        "Le XLR n'existe qu'en version 3 points",
        "Le speakON est moins cher",
        "Le XLR ne transporte pas de signal audio",
        "Le speakON supporte un courant élevé, verrouille et évite tout risque de confusion avec une liaison micro/ligne",
      ],
      answerIndex: 3,
      explanation:
        "Le speakON est dimensionné pour le courant élevé d'une liaison haut-parleur, se verrouille mécaniquement et sa forme empêche tout branchement croisé avec une liaison micro ou ligne.",
    },
    {
      id: "e3u6-q10",
      question: "Dans un système micro HF, à quoi sert la diversité (diversity) d'un récepteur à deux antennes ?",
      choices: [
        "Doubler la puissance d'émission",
        "Permettre l'utilisation de deux émetteurs sur la même fréquence",
        "Réduire les coupures dues aux évanouissements par trajets multiples (multipath) en sélectionnant la meilleure antenne",
        "Charger deux piles simultanément",
      ],
      answerIndex: 2,
      explanation:
        "La diversité compare en permanence le signal reçu par deux antennes et sélectionne le meilleur, compensant les évanouissements par trajets multiples dans une salle pleine de réflexions.",
    },
  ],
};
