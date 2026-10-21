import type { Unit } from "../../types";

/**
 * E3 · Unité 4 — Audionumérique.
 * Échantillonnage, quantification, débit binaire, interfaces numériques,
 * audio sur IP et horloge : la chaîne numérique de bout en bout.
 * Notions récurrentes des annales E3-PTES (éduscol 2017–2025).
 */
export const unitAudionumerique: Unit = {
  id: "e3-u4",
  slug: "audionumerique",
  title: "Audionumérique — échantillonnage, quantification, transports et horloge",
  summary:
    "L'échantillonnage, la quantification, le débit binaire, les interfaces numériques (AES3, S/PDIF, ADAT, MADI), l'audio sur IP et l'horloge : la chaîne numérique de bout en bout, au cœur des annales E3-PTES.",
  estimatedMinutes: 55,
  lesson: [
    { type: "h2", text: "1. Échantillonnage — numériser le temps" },
    {
      type: "p",
      text: "Convertir un signal audio analogique en numérique commence par l'**échantillonnage** : on prélève l'amplitude du signal à intervalles réguliers, fe fois par seconde (fe = fréquence d'échantillonnage, en Hz). Chaque prélèvement devient un nombre binaire ; le signal continu est ainsi discrétisé dans le temps.",
    },
    {
      type: "formula",
      latexLike: "fe > 2 · f_max",
      label: "Théorème de Shannon-Nyquist : la fréquence d'échantillonnage doit être strictement supérieure au double de la fréquence maximale contenue dans le signal.",
    },
    {
      type: "p",
      text: "Si cette condition n'est pas respectée, les composantes situées au-dessus de fe/2 (la **fréquence de Nyquist**) ne sont pas correctement reconstruites : elles se replient dans la bande utile sous forme de fausses fréquences, un phénomène appelé **repliement de spectre** (aliasing).",
    },
    {
      type: "formula",
      latexLike: "f_alias = fe − f  (pour f compris entre fe/2 et fe)",
      label: "Fréquence apparente d'une composante repliée dans la bande utile.",
    },
    {
      type: "note",
      tone: "warning",
      text: "Le repliement est irréversible une fois le signal numérisé : impossible de « retirer » l'alias après coup. Il faut impérativement filtrer le signal analogique avant conversion avec un **filtre anti-repliement** (anti-aliasing) : un passe-bas placé juste avant le convertisseur A/N, qui élimine tout ce qui dépasse fe/2.",
    },
    {
      type: "example",
      title: "Exercice résolu — vérification de Nyquist et repliement",
      problem:
        "Un signal contient une composante parasite à 30 kHz. Le convertisseur échantillonne à fe = 44,1 kHz. Que se passe-t-il en l'absence de filtrage anti-repliement efficace, et à quelle fréquence apparaît l'image indésirable ?",
      steps: [
        "Fréquence de Nyquist : fe/2 = 44,1 / 2 = 22,05 kHz.",
        "30 kHz > 22,05 kHz : la composante viole la condition de Shannon, elle va se replier dans la bande utile.",
        "Fréquence de repliement : f_alias = fe − f = 44,1 − 30 = 14,1 kHz.",
      ],
      answer:
        "Une fausse fréquence apparaît à 14,1 kHz, indiscernable d'un vrai signal à cette fréquence — d'où la nécessité absolue du filtre anti-repliement avant le convertisseur.",
    },
    { type: "h3", text: "Fréquences d'échantillonnage usuelles" },
    {
      type: "table",
      caption: "Fréquences normalisées et marge disponible pour le filtre anti-repliement",
      header: ["Fréquence d'échantillonnage", "Nyquist (fe/2)", "Marge au-dessus de 20 kHz", "Usage typique"],
      rows: [
        ["44,1 kHz", "22,05 kHz", "2,05 kHz", "Disque compact (CD audio), musique grand public"],
        ["48 kHz", "24 kHz", "4 kHz", "Broadcast, vidéo, cinéma — standard professionnel audiovisuel"],
        ["96 kHz", "48 kHz", "28 kHz", "Production haute résolution, post-production exigeante"],
        ["192 kHz", "96 kHz", "76 kHz", "Mastering, archivage, captation de très haute précision"],
      ],
    },
    {
      type: "p",
      text: "Pourquoi le **48 kHz** s'est-il imposé en audiovisuel plutôt que le 44,1 kHz du disque ? Parce que cette valeur se divise proprement par les cadences d'image courantes : 48 000 / 25 = 1 920, 48 000 / 30 = 1 600, 48 000 / 24 = 2 000 échantillons par image. Ce nombre entier d'échantillons par image simplifie considérablement le montage, la synchronisation et le calage image/son en post-production — un avantage décisif face au 44,1 kHz.",
    },
    {
      type: "note",
      tone: "info",
      text: "96 kHz et 192 kHz n'étendent pas l'audition humaine (limitée à environ 20 kHz) mais offrent une marge supplémentaire au filtre anti-repliement (moins de contraintes de raideur, moins d'artefacts de phase près de la bande utile) et davantage de latitude pour les traitements numériques (étirement temporel, changement de hauteur).",
    },
    { type: "h2", text: "2. Quantification — numériser l'amplitude" },
    {
      type: "p",
      text: "La **quantification** découpe l'amplitude du signal en 2ⁿ paliers discrets, n étant la **résolution** en bits. Chaque échantillon est arrondi au palier le plus proche : cet arrondi introduit une erreur, le **bruit de quantification**.",
    },
    {
      type: "formula",
      latexLike: "q = pleine échelle / 2ⁿ",
      label: "Pas de quantification (résolution d'amplitude) pour une résolution de n bits.",
    },
    {
      type: "p",
      text: "Statistiquement, cette erreur se comporte comme un bruit blanc de faible niveau, à peu près constant quel que soit le signal : c'est le plancher de bruit numérique de la chaîne.",
    },
    {
      type: "formula",
      latexLike: "SNR (dB) ≈ 6,02 · n + 1,76",
      label: "Rapport signal/bruit théorique d'une quantification linéaire sur n bits.",
    },
    {
      type: "table",
      caption: "Dynamique théorique selon la résolution",
      header: ["Résolution", "SNR théorique", "Repère"],
      rows: [
        ["8 bits", "≈ 50 dB", "Qualité très limitée (jouets, téléphonie ancienne)"],
        ["16 bits", "≈ 98 dB", "CD audio — référence grand public"],
        ["20 bits", "≈ 122 dB", "Interfaces semi-professionnelles et professionnelles"],
        ["24 bits", "≈ 146 dB (théorique)", "Studio professionnel"],
      ],
    },
    {
      type: "note",
      tone: "info",
      text: "En pratique, la dynamique réelle d'un convertisseur 24 bits n'atteint jamais ces 146 dB théoriques : le bruit de l'électronique analogique (préamplis, alimentations) devient le facteur limitant bien avant le plancher numérique. Les meilleurs convertisseurs professionnels atteignent typiquement 120 à 130 dB de dynamique réelle.",
    },
    {
      type: "example",
      title: "Exercice résolu — rapport signal/bruit théorique",
      problem:
        "Calculer le rapport signal/bruit théorique d'une quantification linéaire sur 20 bits, et le comparer à un enregistrement 16 bits.",
      steps: [
        "SNR (dB) ≈ 6,02 × n + 1,76.",
        "Pour n = 20 : SNR = 6,02 × 20 + 1,76 = 120,4 + 1,76 = 122,16 dB ≈ 122 dB.",
        "Pour n = 16 : SNR = 6,02 × 16 + 1,76 = 96,32 + 1,76 = 98,08 dB ≈ 98 dB.",
        "Écart apporté par les 4 bits supplémentaires : 122 − 98 = 24 dB, soit 6 dB par bit — cohérent avec la formule.",
      ],
      answer:
        "≈ 122 dB en 20 bits contre ≈ 98 dB en 16 bits : chaque bit supplémentaire apporte environ 6 dB de dynamique théorique.",
    },
    {
      type: "p",
      text: "Le **dither** est un bruit de très faible amplitude (de l'ordre du dernier bit) volontairement ajouté avant quantification. Il décorrèle l'erreur de quantification du signal utile : au lieu d'une distorsion structurée et audible sur les signaux faibles (queues de réverbération, fondus), on obtient un bruit de fond constant et beaucoup moins gênant à l'oreille — indispensable notamment lors d'une réduction de résolution (24 bits → 16 bits).",
    },
    {
      type: "note",
      tone: "warning",
      text: "0 dBFS reste un plafond absolu (voir Unité 1). En enregistrement numérique, on vise généralement un niveau nominal autour de −18 à −12 dBFS pour conserver de la marge (headroom) avant l'écrêtage, sans intérêt à « pousser » le niveau près de 0 dBFS comme on le ferait en analogique : le bruit de quantification reste constant quel que soit le niveau enregistré.",
    },
    { type: "h2", text: "3. Débit binaire et formats de fichiers" },
    {
      type: "formula",
      latexLike: "débit = fe × n × nb_canaux",
      label: "Débit binaire (bit/s) d'un flux audio PCM non compressé.",
    },
    {
      type: "example",
      title: "Exercice résolu — débit binaire et taille de fichier",
      problem:
        "Un ingénieur enregistre 5 minutes de musique en stéréo, PCM 48 kHz / 24 bits. Calculer le débit binaire puis la taille du fichier (1 Mo = 10⁶ octets, convention décimale).",
      steps: [
        "Débit = fe × n × nb_canaux = 48 000 × 24 × 2 = 2 304 000 bit/s = 2,304 Mbit/s.",
        "Durée = 5 × 60 = 300 s.",
        "Taille en bits = 2 304 000 × 300 = 691 200 000 bit.",
        "Taille en octets = 691 200 000 / 8 = 86 400 000 octets ≈ 86,4 Mo.",
      ],
      answer: "≈ 86,4 Mo pour 5 minutes de stéréo 48 kHz/24 bits non compressé (WAV/BWF).",
    },
    {
      type: "table",
      caption: "Débit et poids comparés (1 Mo = 10⁶ octets)",
      header: ["Format", "fe / résolution", "Débit binaire", "Taille par minute (≈)"],
      rows: [
        ["CD audio (PCM)", "44,1 kHz / 16 bits, stéréo", "1,411 Mbit/s", "≈ 10,58 Mo"],
        ["Broadcast (WAV/BWF)", "48 kHz / 24 bits, stéréo", "2,304 Mbit/s", "≈ 17,28 Mo"],
        ["Haute résolution", "96 kHz / 24 bits, stéréo", "4,608 Mbit/s", "≈ 34,56 Mo"],
        ["MP3 (perceptif, avec pertes)", "—, stéréo", "128 à 320 kbit/s", "≈ 1 à 2,4 Mo"],
      ],
    },
    {
      type: "p",
      text: "**WAV/BWF** (Broadcast Wave Format) stocke le PCM tel quel, sans compression : c'est le format d'échange broadcast de référence, avec métadonnées embarquées (timecode, informations de prise). **MP3/AAC** sont des compressions **perceptuelles avec pertes** : elles s'appuient sur l'effet de masque (Unité 1) pour supprimer les informations jugées inaudibles et réduire fortement le débit — au prix d'une perte irréversible de données. **FLAC** est une compression **sans perte** : il réduit le poids du fichier (typiquement de 40 à 50 %) par un algorithme réversible, sans supprimer aucune information — le fichier décompressé est bit-à-bit identique à l'original.",
    },
    {
      type: "note",
      tone: "exam",
      text: "Savoir distinguer compression **avec pertes** (perceptuelle, irréversible : MP3, AAC) et compression **sans perte** (réversible, poids réduit sans dégradation : FLAC, ALAC) face au PCM non compressé (WAV/BWF) est une question classique des annales E3.",
    },
    { type: "h2", text: "4. Interfaces numériques" },
    {
      type: "table",
      caption: "Les principales liaisons audionumériques professionnelles",
      header: ["Interface", "Connecteur / support", "Impédance", "Canaux", "Distance typique", "Usage"],
      rows: [
        ["AES3 (AES/EBU)", "XLR, paire symétrique", "110 Ω", "2 (multiplexés)", "jusqu'à ≈ 100 m", "Studio, broadcast professionnel"],
        ["S/PDIF", "RCA coaxial ou TOSLINK optique", "75 Ω (coax)", "2", "quelques mètres", "Grand public, home studio"],
        ["ADAT (lightpipe)", "Optique (TOSLINK)", "—", "8 à 48 kHz (4 à 96 kHz)", "≈ 5-10 m", "Extension de préamplis, interfaces multicanal"],
        ["MADI (AES10)", "BNC coaxial ou fibre optique", "75 Ω (coax)", "64", "≈ 100 m (coax), km (fibre)", "Broadcast, régies mobiles, gros systèmes"],
      ],
    },
    {
      type: "p",
      text: "L'**AES3** véhicule 2 canaux numériques multiplexés sur une seule paire symétrique, avec un niveau électrique bien plus élevé que l'analogique (transitions rapides). Le **S/PDIF** en est la version grand public : même structure de trame, mais niveaux électriques différents et connectique non professionnelle (RCA ou optique). L'**ADAT** transporte 8 canaux à 48 kHz sur une simple fibre optique TOSLINK (4 canaux seulement à 96 kHz, via multiplexage d'échantillons ou S/MUX) : une solution économique pour étendre le nombre d'entrées d'une interface. Le **MADI** (norme AES10) multiplexe jusqu'à 64 canaux sur un unique coaxial 75 Ω ou une fibre optique — la solution de choix pour remplacer un multipaire analogique dans une régie ou un car de reportage.",
    },
    {
      type: "note",
      tone: "warning",
      text: "Un câble AES3 doit respecter une impédance caractéristique de 110 Ω sur toute sa longueur. Un câble micro symétrique standard, conçu pour l'analogique basse fréquence, n'est pas garanti à cette impédance : les désadaptations réfléchissent une partie du signal numérique haute fréquence, provoquant erreurs binaires, cliquetis ou pertes de synchronisation au-delà de quelques mètres. Un signal analogique, beaucoup plus tolérant, ne pose pas ce problème sur le même câble.",
    },
    { type: "h2", text: "5. Audio sur IP (AoIP)" },
    {
      type: "p",
      text: "L'audio sur IP transporte l'audio numérique sur un réseau Ethernet standard plutôt que sur un câblage dédié. **Dante** (Audinate) est le protocole le plus répandu : il fonctionne à la couche 3 (IP) sur un réseau commuté Gigabit Ethernet classique, et se configure via le logiciel **Dante Controller**, qui affiche une matrice de routage entre appareils. Selon le matériel et la licence, un réseau Dante achemine de 64 à plus de 512 canaux.",
    },
    {
      type: "p",
      text: "**AES67** est une norme d'interopérabilité qui permet à des systèmes AoIP différents (Dante, Ravenna, Livewire…) d'échanger des flux audio via un profil réseau commun. **Ravenna** est un autre protocole AoIP, aux objectifs proches de Dante, largement utilisé en diffusion et compatible AES67.",
    },
    {
      type: "list",
      items: [
        "**Latence réseau** : typiquement réglable entre 0,25 ms et 5 ms sur un réseau Dante, selon le nombre de commutateurs traversés.",
        "**QoS** (Quality of Service) : priorise les paquets audio dans le trafic réseau pour éviter pertes et à-coups.",
        "**PTP** (Precision Time Protocol, IEEE 1588) : synchronise l'horloge de tous les appareils du réseau autour d'un maître (grandmaster) élu automatiquement, avec une précision de l'ordre de la microseconde — l'équivalent réseau du word clock filaire.",
      ],
    },
    { type: "h2", text: "6. Horloge numérique et latence" },
    { type: "h3", text: "Horloge (word clock)" },
    {
      type: "p",
      text: "Dans une installation comportant plusieurs appareils numériques, tous doivent échantillonner exactement aux mêmes instants. Un seul appareil est configuré en **horloge maître** (master) ; tous les autres s'y synchronisent en **esclaves** (slave). Si deux appareils sont maîtres simultanément, leurs horloges dérivent l'une par rapport à l'autre : les tampons (buffers) se remplissent ou se vident de façon désynchronisée, provoquant clics, craquements et pertes d'échantillons (dropouts).",
    },
    {
      type: "p",
      text: "La distribution peut se faire par un câble **word clock** dédié, coaxial 75 Ω sur connecteur BNC, avec une terminaison 75 Ω sur le dernier appareil de la chaîne pour éviter les réflexions. Elle peut aussi être **embarquée** : un appareil esclave peut extraire l'horloge directement du flux AES3 reçu, ou se synchroniser via PTP sur un réseau Dante — sans câblage word clock séparé.",
    },
    {
      type: "note",
      tone: "exam",
      text: "Identifier, sur un schéma d'installation, quel appareil est configuré en Master et lesquels sont en Slave est une question classique des annales E3 : il ne doit toujours y avoir qu'un seul maître d'horloge dans toute la chaîne.",
    },
    {
      type: "p",
      text: "Le **jitter** désigne les fluctuations très rapides et aléatoires de l'instant exact de chaque échantillon, distinctes d'une simple dérive de fréquence. Il se traduit, lors de la conversion N/A, par un bruit de fond supplémentaire et de la distorsion d'intermodulation, d'autant plus audible que la fréquence du jitter est basse. Des câbles courts, bien blindés et correctement terminés limitent le jitter.",
    },
    { type: "h3", text: "Latence" },
    {
      type: "p",
      text: "La latence d'une chaîne numérique provient principalement des tampons (buffers) d'entrée et de sortie du convertisseur, du temps de traitement (DSP, plug-ins) et, en réseau, du temps de transit des paquets. Chaque tampon retient un certain nombre d'échantillons avant de les transmettre : plus il est grand, plus la latence augmente, mais plus le traitement est sécurisé contre les décrochages.",
    },
    {
      type: "formula",
      latexLike: "latence (s) = taille du buffer (échantillons) / fe",
      label: "Latence introduite par un tampon (buffer) d'entrée ou de sortie.",
    },
    {
      type: "example",
      title: "Exercice résolu — latence d'un buffer audio",
      problem:
        "Une interface audionumérique utilise un buffer de 256 échantillons à fe = 48 kHz. Quelle est la latence introduite par ce seul buffer (aller simple) ? Qu'en est-il à 128 échantillons ?",
      steps: [
        "Latence = taille du buffer / fe.",
        "Pour 256 échantillons : 256 / 48 000 = 0,005333 s ≈ 5,3 ms.",
        "Pour 128 échantillons : 128 / 48 000 = 0,002667 s ≈ 2,7 ms.",
      ],
      answer:
        "5,3 ms à 256 échantillons, 2,7 ms à 128 échantillons — mais la latence totale ressentie (aller-retour, plus traitement) est généralement 2 à 4 fois plus élevée, d'où l'importance de réduire la taille de buffer en captation en direct.",
    },
    {
      type: "p",
      text: "Ces latences se cumulent tout au long de la chaîne (entrée, traitement, sortie, éventuel aller-retour réseau) : un musicien qui s'écoute au casque via un système numérique perçoit la somme de tous ces délais. Le seuil de confort généralement admis se situe autour de **10 ms** ; au-delà, le décalage devient perceptible et gênant, en particulier sur des sources percussives à attaque rapide.",
    },
    {
      type: "note",
      tone: "warning",
      text: "Réduire la taille de buffer diminue la latence mais augmente la charge de calcul du processeur, avec un risque accru de décrochages (dropouts) si la machine ne suit pas. C'est un compromis permanent : petit buffer pour l'enregistrement en direct, buffer plus large pour le mixage où la latence importe peu.",
    },
    {
      type: "figure",
      figureId: "sampling-quantization",
      caption: "Un signal continu est discrétisé en temps (échantillonnage, tous les 1/fe) et en amplitude (quantification, sur 2ⁿ paliers) : chaque échantillon devient un couple (instant, niveau) codé en binaire.",
    },
  ],
  quiz: [
    {
      id: "e3u4-q1",
      question: "Selon le théorème de Shannon-Nyquist, quelle condition doit vérifier fe pour reproduire fidèlement un signal de fréquence maximale f_max ?",
      choices: ["fe = f_max", "fe < 2·f_max", "fe > 2·f_max", "fe = f_max / 2"],
      answerIndex: 2,
      explanation:
        "La fréquence d'échantillonnage doit être strictement supérieure au double de la fréquence maximale du signal, sous peine de repliement de spectre.",
    },
    {
      id: "e3u4-q2",
      question: "Pourquoi le 48 kHz s'est-il imposé comme fréquence d'échantillonnage standard en audiovisuel (broadcast, vidéo) plutôt que le 44,1 kHz ?",
      choices: [
        "Elle se divise proprement par les cadences d'image courantes (24, 25, 30 im/s), simplifiant la synchro audio/vidéo",
        "Elle offre une bande passante audible plus large que l'oreille humaine",
        "Elle réduit le bruit de quantification par rapport au 44,1 kHz",
        "Elle est imposée par la norme AES3",
      ],
      answerIndex: 0,
      explanation:
        "48 000 se divise exactement par 24, 25 et 30 (nombre entier d'échantillons par image), ce qui simplifie le montage et la synchro audio/vidéo en post-production.",
    },
    {
      id: "e3u4-q3",
      question: "Un signal contient une composante à 30 kHz, échantillonnée à fe = 44,1 kHz sans filtre anti-repliement efficace. À quelle fréquence apparaît l'image indésirable ?",
      choices: ["30 kHz (inchangé)", "74,1 kHz", "22,05 kHz", "14,1 kHz"],
      answerIndex: 3,
      explanation: "f_alias = fe − f = 44,1 − 30 = 14,1 kHz : la composante se replie autour de la fréquence de Nyquist (22,05 kHz).",
    },
    {
      id: "e3u4-q4",
      question: "Quel est le rôle du filtre anti-repliement (anti-aliasing) placé avant le convertisseur A/N ?",
      choices: [
        "Éliminer les composantes au-dessus de fe/2 pour éviter le repliement spectral",
        "Amplifier le signal avant conversion",
        "Ajouter du dither",
        "Compenser le bruit de quantification",
      ],
      answerIndex: 0,
      explanation:
        "Il coupe les fréquences supérieures à fe/2 (Nyquist) pour empêcher qu'elles ne se replient dans la bande utile sous forme de fausses fréquences.",
    },
    {
      id: "e3u4-q5",
      question: "Quelle est, en théorie, la valeur approximative du rapport signal/bruit d'une quantification linéaire sur 16 bits ?",
      choices: ["72 dB", "98 dB", "48 dB", "146 dB"],
      answerIndex: 1,
      explanation: "SNR ≈ 6,02 × 16 + 1,76 = 98,08 dB ≈ 98 dB — la référence du CD audio.",
    },
    {
      id: "e3u4-q6",
      question: "À quoi sert le dither lors d'une réduction de résolution (par exemple 24 bits vers 16 bits) ?",
      choices: [
        "Augmenter la fréquence d'échantillonnage",
        "Réduire le débit binaire",
        "Synchroniser l'horloge numérique",
        "Masquer le bruit de quantification en le rendant moins corrélé au signal (bruit aléatoire plutôt que distorsion)",
      ],
      answerIndex: 3,
      explanation:
        "Le dither ajoute un bruit de très faible amplitude qui décorrèle l'erreur de quantification du signal, la transformant en bruit de fond constant, moins gênant à l'oreille que la distorsion structurée.",
    },
    {
      id: "e3u4-q7",
      question: "Quel est le débit binaire d'un enregistrement stéréo en PCM à 48 kHz / 24 bits ?",
      choices: ["2,304 Mbit/s", "1,152 Mbit/s", "1,411 Mbit/s", "4,608 Mbit/s"],
      answerIndex: 0,
      explanation: "Débit = fe × n × nb_canaux = 48 000 × 24 × 2 = 2 304 000 bit/s = 2,304 Mbit/s.",
    },
    {
      id: "e3u4-q8",
      question: "Combien de canaux audio à 48 kHz une liaison optique ADAT peut-elle transporter ?",
      choices: ["2", "8", "4", "64"],
      answerIndex: 1,
      explanation: "ADAT (format optique « lightpipe ») transporte 8 canaux à 48 kHz (4 canaux en S/MUX à 96 kHz).",
    },
    {
      id: "e3u4-q9",
      question: "Pourquoi ne peut-on pas utiliser indifféremment un câble micro XLR symétrique standard pour transporter un signal AES3 sur une longue distance ?",
      choices: [
        "Parce que le signal AES3 est optique, incompatible avec un câble cuivre",
        "Parce qu'un câble micro n'est pas blindé",
        "Parce que l'impédance caractéristique d'un câble micro standard ne correspond pas aux 110 Ω requis par AES3, provoquant réflexions et erreurs binaires au-delà de quelques mètres",
        "Parce que le connecteur XLR ne supporte pas les hautes fréquences",
      ],
      answerIndex: 2,
      explanation:
        "Le signal AES3 est un flux numérique haute fréquence ; un désaccord d'impédance crée des réflexions qui dégradent le signal sur la distance, contrairement à un signal analogique basse fréquence, plus tolérant.",
    },
    {
      id: "e3u4-q10",
      question: "Dans une installation audionumérique comportant plusieurs appareils, combien doivent être configurés en horloge maître (master) ?",
      choices: ["Autant que d'appareils connectés", "Deux, pour la redondance", "Aucun, l'horloge est toujours interne à chaque appareil", "Un seul, tous les autres étant esclaves (slave)"],
      answerIndex: 3,
      explanation:
        "Un seul appareil doit être maître ; si plusieurs le sont simultanément, les horloges dérivent l'une par rapport à l'autre, provoquant clics, craquements et pertes d'échantillons.",
    },
  ],
};
