---
id: 16-workflow-enregistrement-studio
title_fr: Workflow d'enregistrement en studio
title_en: Studio recording workflow
bts_mapping:
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    note: "BC02 lists 'gérer et mettre en œuvre les outils de prise de son' and post-production resources (checked on France Compétences RNCP37196); eduscol référentiel PDF unreachable this session, so no S-code."
    source: https://www.francecompetences.fr/recherche/rncp/37196/
  - epreuve: E3
    bloc: BC02
    savoirs: "not verified"
    verified: false
    note: "Alignment level, dBFS headroom and loudness metering are PTES-style technical content; not checked against the référentiel."
    source: https://www.francecompetences.fr/recherche/rncp/37196/
tekpractice_rules: [R1, R2, R4, R6, R8]
last_checked: 2026-10-22
---

# Workflow d'enregistrement en studio (Studio recording workflow)

## En bref / In short
Une session studio se déroule en étapes : pré-production (pre-production), choix et placement des micros (mic choice and placement), réglage des gains vers la station audionumérique (gain staging into the DAW), prise (tracking) avec des mixes casque (cue mixes), montage (editing), mixage (mixing), puis mastering et livrables (deliverables). Chaque étape prépare la suivante : une prise propre et bien nommée fait gagner des heures au mixage. Le niveau TekPractice D1 (Post) reprend cette chaîne : U 87 Ai → préampli ISA One → patchbay → interface Pro Tools HD I/O, horloge Antelope OCX HD, écoute Grace m905 et Genelec.

## Notions clés (Key concepts)
- **Pré-production** : on fixe le tempo, la tonalité, l'arrangement, la liste des pistes (track sheet), le planning et le format de session (fréquence d'échantillonnage, résolution). On décide ce qui est enregistré ensemble ou en re-recording (overdub).
- **Choix du micro** : statique (condenser) pour la voix et les sources détaillées, dynamique pour les sources fortes, ruban pour un rendu doux. Un statique a besoin du phantom +48 V (règle R4).
- **Placement du micro (voix)** : DPA propose de commencer à environ 10 cm de la bouche en placement frontal rapproché, puis de faire varier la distance entre environ 5 et 15 cm en répétition. Pour un son plus aéré, on commence vers 30 cm, mais il faut alors une bonne pièce [1]. On utilise toujours un filtre anti-pop (pop screen) en placement rapproché [1].
- **Effet de proximité (proximity effect)** : plus un micro directif est proche de la source, plus le grave augmente [1].
- **Plusieurs micros sur une source** : risque de filtrage en peigne (comb filtering). On applique la règle 3:1 ou on atténue le son retardé d'au moins 10 dB [2].
- **Gain staging** : on règle le gain du préampli pour une marge suffisante sous 0 dBFS. La recommandation EBU R 68 place le niveau d'alignement numérique (alignment level) 18 dB sous le niveau de codage maximal, quel que soit le nombre de bits [3].
- **Horloge (word clock)** : un seul maître (clock master), tous les autres appareils esclaves, même fréquence d'échantillonnage partout (règle R8).
- **Session** : nommage clair des pistes et des prises, sauvegardes, notes de prise (take sheet). En format BWF (Broadcast Wave Format), le chunk « bext » contient la description, l'auteur (originator), la date et l'heure, une référence temporelle en échantillons depuis minuit (TimeReference) et, depuis la version 2, des champs de loudness [4].
- **Mixes casque (cue mixes)** : chaque musicien a son mix, envoyé en pré-fader (aux pre) pour que les mouvements du mix de la régie ne le modifient pas. Le micro ouvert dans la cabine ne doit pas recevoir les enceintes de la régie (R6). On écoute au casque en cabine.
- **Montage (editing)** : choix des meilleures prises (comping), fondus (fades) aux coupes pour éviter les clics, recalage, nettoyage des bruits.
- **Mixage** : équilibre, plans, égalisation, dynamique, espace. On écoute sur des moniteurs placés correctement et à un niveau constant.
- **Mastering et livrables** : contrôle final du niveau, des crêtes et du format. La sonie (loudness) se mesure selon ITU-R BS.1770 (version 5, novembre 2023) [5]. Pour la diffusion broadcast, EBU R 128 fixe −23,0 LUFS et un maximum de −1 dBTP [6]. Pour le streaming, l'EBU indique que les plateformes visent en général une sonie plus élevée que la diffusion et publie un supplément dédié (R 128 s2) [7] ; on vérifie toujours la fiche de livraison du client.

## Formules (Formulas)
- **Niveau d'alignement numérique** [3] : AL = niveau de codage maximal − 18 dB, soit −18 dBFS (dBFS = décibels relatifs à la pleine échelle). Sens : 18 dB de marge (headroom) au-dessus du niveau d'alignement.
- **Règle 3:1** [2] : 20·log(1/3) ≈ −10 dB. Pour 1 m et 3 m de distance, l'écart de temps est d'environ 6 ms [2].
- **Sonie de programme** [5][6] : intégrée sur toute la durée, avec une porte (gating) selon BS.1770, exprimée en LUFS (identique à LKFS) ; cible broadcast −23,0 LUFS, crête vraie ≤ −1 dBTP [6].

## Erreurs fréquentes (Common mistakes)
- **Enregistrer trop fort « pour avoir du niveau »** : en numérique, un dépassement de 0 dBFS écrête sans retour possible. On garde la marge prévue par l'alignement (−18 dBFS) [3].
- **Oublier le phantom sur un statique**, ou l'envoyer vers un ruban ancien (R4).
- **Deux horloges maîtres, ou fréquences différentes** : clics et craquements (R8).
- **Micro trop près sans anti-pop** : plosives et trop de grave par effet de proximité [1].
- **Deux micros sur la même source sans vérifier la phase** : filtrage en peigne [2].
- **Fichiers sans nom ni métadonnées** : on remplit les champs BWF et les noms de pistes dès la prise [4].
- **Masteriser au maximum quel que soit le support** : on suit la cible du livrable (R 128 pour la diffusion, la fiche technique de la plateforme pour le streaming) [6][7].

## Lien avec le matériel (Equipment links)
- Micros : `neumann-u87-ai`, `neumann-tlm-103`, `neumann-km-184`, `shure-sm7b`, `royer-r-121`, `coles-4038`.
- Préamplis / dynamique : `focusrite-isa-one`, `ams-neve-1073spx`, `api-512c`, `universal-audio-1176ln`, `universal-audio-teletronix-la-2a`.
- Conversion / horloge / DAW : `avid-protools-hdx`, `avid-hd-io`, `antelope-ocx-hd`, `rme-fireface-ufx-iii`, `focusrite-scarlett-2i2-4th-gen`.
- Écoute : `grace-m905`, `genelec-8030c`, `neumann-kh-120-ii`, `beyerdynamic-dt-770-pro`, `presonus-hp4`.
- Règles TekPractice : R1, R2, R4 (phantom U 87), R6 (écoutes coupées quand le micro est ouvert dans la même pièce), R8 (word clock).

## Pour aller plus loin (Best sources)
- [1] DPA, voix en studio : quatre placements (frontal rapproché, frontal éloigné, au-dessus de la tête, poitrine) avec distances de départ.
- [2] DPA, filtrage en peigne : explique la règle 3:1 et ses limites.
- [3] EBU R 68 : texte court qui fixe le niveau d'alignement numérique.
- [4] EBU Tech 3285 : structure du fichier BWF, utile pour comprendre les métadonnées lues par les DAW.
- [5][6][7] ITU-R BS.1770, EBU R 128 et R 128 s2 : mesure et cibles de sonie.

## Sources
1. DPA Microphones, "How to mic vocals in the recording studio", Mic University, https://www.dpamicrophones.com/mic-university/how-to-mic/how-to-mic-vocals-in-the-recording-studio/, accessed 2026-10-22, verified-primary
2. DPA Microphones, "The basics about comb filtering (and how to avoid it)", https://www.dpamicrophones.com/mic-university/audio-production/the-basics-about-comb-filtering-and-how-to-avoid-it/, accessed 2026-10-22, verified-primary
3. EBU, R 68 "Alignment level in digital audio production equipment and recorders" (2000), https://tech.ebu.ch/publications/r068 (PDF: https://tech.ebu.ch/files/live/sites/tech/files/shared/r/r068.pdf), accessed 2026-10-22, verified-primary (publication page read; PDF not opened)
4. EBU, Tech 3285 v2 "Specification of the Broadcast Wave Format" (2011), https://tech.ebu.ch/files/live/sites/tech/files/shared/tech/tech3285.pdf, accessed 2026-10-22, verified-primary
5. ITU-R, Recommendation BS.1770 "Algorithms to measure audio programme loudness and true-peak audio level" (BS.1770-5, 11/2023), https://www.itu.int/rec/R-REC-BS.1770, accessed 2026-10-22, verified-primary (record page)
6. EBU, R 128 "Loudness normalisation and permitted maximum level of audio signals", v5.0 (Nov. 2023), https://tech.ebu.ch/files/live/sites/tech/files/shared/r/r128.pdf, accessed 2026-10-22, verified-primary
7. EBU, R 128 s2 "Loudness in Streaming" (v3.0, Nov. 2023), https://tech.ebu.ch/publications/r128s2, accessed 2026-10-22, verified-secondary (publication page only; numeric targets not read)
8. France Compétences, fiche RNCP37196, https://www.francecompetences.fr/recherche/rncp/37196/, accessed 2026-10-22, verified-primary
