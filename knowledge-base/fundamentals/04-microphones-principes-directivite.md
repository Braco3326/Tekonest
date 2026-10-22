---
id: 04-microphones-principes-directivite
title_fr: Microphones — principes de transduction, sensibilité et directivité
title_en: Microphones — transducer principles, sensitivity and polar patterns
bts_mapping:
  - epreuve: E3
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Référentiel PDF injoignable pendant la session (ECONNRESET). E3 PTES couvre la physique des transducteurs (cf. unité e3-u3 'Transducteurs' de la plateforme)."
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Choix et placement des micros = savoir-faire pratique évalué en E4 (Techniques et mise en œuvre); codes non lus."
tekpractice_rules: [R2, R4, R6]
last_checked: 2026-10-22
---

# Microphones — principes, sensibilité et directivité (Microphones — principles, sensitivity, polar patterns)

## En bref / In short
Un microphone est un transducteur (transducer) qui convertit une variation de pression acoustique en tension électrique. Les micros dynamiques (moving coil) et à ruban (ribbon) fonctionnent par induction : la tension est proportionnelle à la vitesse du conducteur dans le champ magnétique [1]. Les micros à condensateur (condenser) et électret (electret) mesurent une variation de capacité et ont besoin d'un amplificateur intégré, donc d'une alimentation [1]. La directivité (polar pattern) dépend du principe acoustique : capteur de pression (pressure) = omnidirectionnel, capteur à gradient de pression (pressure gradient) = figure en 8 et ses dérivés cardioïdes, avec en contrepartie l'effet de proximité (proximity effect) [1][4].

## Notions clés (Key concepts)
- **Dynamique à bobine mobile (moving coil)** : bobine solidaire du diaphragme dans l'entrefer d'un aimant ; résonance mécanique vers 150–800 Hz qu'il faut amortir ; tension en quadrature (90°) avec la pression [1]. Aucune alimentation nécessaire. Exemple : Shure SM58, cardioïde dynamique, sensibilité −54,5 dBV/Pa (1,85 mV/Pa), impédance nominale 150 Ω [7].
- **Ruban (ribbon)** : un ruban métallique très mince (souvent < 0,5 mg) suspendu dans un champ magnétique ; résonance basse (≈ 20–70 Hz), bonne réponse transitoire, mais sensible aux chocs et au vent [1]. Ouvert des deux côtés, il est naturellement bidirectionnel (figure-8) ; la face arrière est en opposition de phase [8]. Exemple : Royer R-121, figure en 8, −49 dB re 1 V/Pa, 300 Ω, charge recommandée ≥ 1500 Ω [8].
- **Condensateur (condenser / capacitor)** : diaphragme chargé face à une contre-électrode (backplate) ; capacité d'environ 50 pF, d'où la nécessité d'un amplificateur tout près de la capsule ; impédance de sortie typique 20–200 Ω [1]. Le Neumann U 87 Ai (P48, 0,8 mA) est un transducteur à gradient de pression à trois directivités (omni/cardio/8), sensibilité 20/28/22 mV/Pa [6].
- **Électret (electret / pre-polarized)** : condensateur dont la polarisation est stockée dans un matériau ; plus besoin de tension de polarisation externe, mais l'amplificateur intégré reste à alimenter [1].
- **Condensateur HF (RF condenser)** : variante sans tension de polarisation, utilisant un oscillateur (≈ 8 MHz) [1].
- **Sensibilité (sensitivity)** : tension produite en champ libre pour 1 Pa (= 94 dB SPL) à 1 kHz, exprimée en mV/Pa ou en dB re 1 V/Pa (dBV/Pa) [2]. Tolérance typique ± 1 à ± 3 dB selon le fabricant [2][6].
- **Bruit propre (self-noise / equivalent noise level)** : le SPL qui produirait la même tension que le bruit électrique du micro ; mesuré en dB(A) ou selon ITU-R BS.468 (CCIR, quasi-crête) [2]. U 87 Ai : 15/12/14 dB-A [6].
- **SPL max** : défini à un taux de distorsion donné ; attention, la référence change selon le fabricant (0,5 % THD chez Neumann, 10 % THD chez DPA) [2][6].
- **Pression vs gradient de pression** : un capteur de pression (capsule fermée à l'arrière) est omnidirectionnel ; un capteur à gradient (ouvert des deux côtés) répond à la différence de pression avant/arrière, donc figure en 8, nul sur les côtés ; en combinant les deux, on obtient cardioïde, supercardioïde, hypercardioïde [1].
- **Diagrammes polaires (polar patterns)**, valeurs DPA [3] :
  - cardioïde : −3 dB à 66°, −6 dB à 90°, nul à 180° ;
  - supercardioïde : −3 dB à 58°, −6 dB à 78°, quasi-nul vers ± 135° ;
  - hypercardioïde : −3 dB à 55°, −6 dB à 73°, quasi-nul vers ± 115° ;
  - figure en 8 : nul à 90°, lobe arrière en polarité inversée (comme les lobes arrière super/hyper).
- **Directivité dépendante de la fréquence** : les diagrammes réels changent avec la fréquence ; c'est pourquoi les fiches donnent une courbe par bande d'octave [3]. Un omni devient directif en aigu, d'autant plus que la capsule est grosse [5].
- **Coloration hors axe (off-axis colouration)** : un cardioïde peut être plat dans l'axe mais pas hors axe ; le son capté par les côtés et l'arrière est alors « coloré » (DPA parle de *curtain effect*) [5].
- **Effet de proximité (proximity effect)** : renforcement des graves près d'une source ponctuelle, réservé aux micros à gradient ; il augmente quand on se rapproche du diagramme en 8, est maximal dans l'axe, neutre à 90° pour un cardioïde ; un omni n'en a pas ; il devient négligeable au-delà d'environ 1 m ou sur une source plane [4]. Le U 87 Ai propose un passe-haut pour le compenser [6].
- **Facteur de distance** : un cardioïde à 17 cm donne le même rapport direct/réverbéré qu'un omni à 10 cm [5].

## Formules (Formulas)
- **Conversion de sensibilité** : S_dB = 20·log10(S / 1 V/Pa), S en V/Pa. Vérification : 10 mV/Pa = −40 dB re 1 V/Pa [2] ; 1,85 mV/Pa ≈ −54,5 dBV/Pa [7]. Sens : exprimer la sensibilité en dB pour la comparer facilement.
- **Tension de sortie** : U = S · p, avec p = p0 · 10^(L/20), p0 = 20 µPa, U en V, S en V/Pa, L en dB SPL. Exemple de la source : à 124 dB SPL (30 dB au-dessus de 94 dB, soit p ≈ 31,6 Pa), un micro à 1 mV/Pa sort ≈ 31 mV, un micro à 40 mV/Pa ≈ 1,3 V [2]. Sens : le préampli doit encaisser ces niveaux (pad ou entrée ligne) [9].
- **Gradient et distance** : une source à 2 cm, avec un écart avant/arrière de 2 cm, donne ≈ 6 dB de différence de pression entre les faces, ce qui gonfle les graves (proximité) [1][4].
- **Pente du gradient pur** : la réponse brute d'un capteur à gradient monte de +6 dB/octave, compensée par conception [1].

## Erreurs fréquentes (Common mistakes)
- Croire qu'un omni « capte plus de larsen » parce qu'il capte partout : il a moins de rejet, mais pas d'effet de proximité, et son larsen monte plus progressivement ; les directifs décrochent souvent en aigu et brutalement [5]. Choisir selon la position réelle des retours (voir 12-larsen-feedback).
- Retenir des angles de nuls « exacts » : selon les sources, le nul de la supercardioïde est donné vers 120° [1] ou 135° [3], celui de l'hypercardioïde vers 115° [3]. La plateforme (unité e3-u3) utilise ≈ 126° et ≈ 110° (valeurs théoriques du premier ordre, non vérifiées dans une source lue ici) : présenter une plage, et faire vérifier sur la fiche du modèle.
- Comparer des SPL max sans regarder le critère de distorsion (0,5 % vs 10 % THD) [2][6].
- Brancher un micro dynamique passif sur une entrée à trop faible impédance : perte de graves ; viser une charge 5 à 10 fois l'impédance du micro [9][8] (voir 07-impedance).
- Souffler dans un micro (surtout un ruban) pour le tester : risque de dégâts au ruban et niveaux dangereux [10][6].
- Penser que le +48 V est sans danger pour tout ruban : voir 05-alimentation-fantome (règle R4).

## Lien avec le matériel (Equipment links)
- Dynamiques : `shure-sm58`, `shure-sm57`, `shure-beta-58a`, `ev-re20`, `ev-re50`, `sennheiser-md-421-ii`, `beyerdynamic-m-88`.
- Rubans : `royer-r-121`, `coles-4038`, `aea-r84`, `beyerdynamic-m-160`.
- Condensateurs : `neumann-u87-ai` (multi-directivité, P48), `neumann-km-184`, `schoeps-cmc-6-mk-4`, `sennheiser-mkh-8040`, `neumann-m-149-tube`.
- Spécialité : `sennheiser-mkh-416` (canon, condensateur HF), `sanken-cos-11d`, `rode-ntg5`.
- TekPractice : **R4** (le condensateur `neumann-u87-ai` porte `requiresPhantom`), **R2** (niveau micro ≠ niveau ligne), **R6** (micro ouvert + enceintes = larsen).

## Pour aller plus loin (Best sources)
- [1] DPA, *Microphone technology – the essentials* : la meilleure synthèse courte des principes (dynamique, ruban, condensateur, électret, pression/gradient).
- [3] DPA, *Listen to your polar pattern* : tableau des angles −3/−6 dB par directivité, idéal pour un exercice.
- [4] DPA, *Proximity effect explained* : explication physique propre, cas des sources ponctuelles/planes.
- [2] DPA, *How to read microphone specifications* : lire une fiche technique (sensibilité, bruit, SPL max).
- [6] Manuel Neumann U 87 Ai et [8] manuel Royer R-121 : fiches réelles à faire analyser en TD.

## Sources
1. DPA Microphones, "Microphone technology – the essentials", Mic University, https://www.dpamicrophones.com/mic-university/technology/microphone-technology-the-essentials/, accessed 2026-10-22, verified-primary
2. DPA Microphones, "How to read microphone specifications", Mic University, https://www.dpamicrophones.com/mic-university/technology/how-to-read-microphone-specifications/, accessed 2026-10-22, verified-primary
3. DPA Microphones, "Listen to your polar pattern", Mic University, https://www.dpamicrophones.com/mic-university/technology/listen-to-your-polar-pattern/, accessed 2026-10-22, verified-primary
4. DPA Microphones, "Proximity effect in microphones explained", Mic University, https://www.dpamicrophones.com/mic-university/background-knowledge/proximity-effect-in-microphones-explained/, accessed 2026-10-22, verified-primary
5. DPA Microphones, "Directional vs. omnidirectional microphones", Mic University, https://www.dpamicrophones.com/mic-university/technology/directional-vs-omnidirectional-microphones/, accessed 2026-10-22, verified-primary (manufacturer claims)
6. Neumann, "U 87 Ai Operating Manual" (opin0134), https://www.neumann.com/globalassets/digizuite/16474-en-opin0134_u87ai_06-10.pdf (redirects to https://bgzkwm.files.cmp.optimizely.com/download/assets/opin0134_U87Ai_06-10.pdf/f62126f8dc1311f0ba6b7ec57e6db003), accessed 2026-10-22, verified-primary
7. Shure, "SM58 Product Specifications" (2009, Shure document hosted by College of San Mateo), https://collegeofsanmateo.edu/theatre/docs/sm58_specsheet.pdf, accessed 2026-10-22, verified-primary
8. Royer Labs, "R-121 Operation Instructions", https://royerlabs.com/pdf/manuals/R-121manual.pdf, accessed 2026-10-22, verified-primary
9. DPA Microphones, "10+ statements on condenser microphones versus dynamic mics", https://www.dpamicrophones.com/mic-university/background-knowledge/10plus-statements-on-condenser-microphones-versus-dynamic-mics/, accessed 2026-10-22, verified-primary
10. Coles Electroacoustics, "Ribbon microphone care tips", https://coleselectroacoustics.com/ribbon-microphone-care-tips/, accessed 2026-10-22, verified-primary
