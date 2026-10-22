---
id: 05-alimentation-fantome
title_fr: Alimentation fantôme (P48, P12) et risques
title_en: Phantom power (P48, P12) and its risks
bts_mapping:
  - epreuve: E3
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Référentiel PDF injoignable (ECONNRESET). Le +48 V est traité dans l'unité e3-u2 'Électricité' de la plateforme, notion récurrente des annales E3."
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Mise en œuvre pratique (activer/couper le +48 V, câblage) évaluée en situation E4; codes non lus."
tekpractice_rules: [R4]
last_checked: 2026-10-22
---

# Alimentation fantôme (Phantom power)

## En bref / In short
L'alimentation fantôme (phantom power) fournit une tension continue au micro par le câble audio symétrique lui-même : la même tension est appliquée sur les broches 2 et 3 de la XLR, référencée à la broche 1 (masse) [1][2]. Comme le courant circule de façon identique dans les deux conducteurs de modulation, il est « invisible » pour une entrée différentielle et sans effet sur la plupart des micros symétriques qui n'en ont pas besoin, rubans compris, à condition que le câblage soit correct [2]. La norme actuelle est l'IEC 61938 (qui a remplacé la DIN 45 596) ; la variante la plus répandue est le P48 (48 V ± 4 V) [1][2]. Le danger apparaît quand une liaison est défectueuse ou asymétrique : un courant traverse alors la bobine ou le ruban [2][3].

## Notions clés (Key concepts)
- **Normes** : IEC 61938:2018 (tension, courant, impédance) ; première norme DIN 45 596 [1]. Schoeps cite DIN EN 61938, ratifiée en 1997 [2].
- **P48** : 48 V ± 4 V sur les broches 2 et 3, broche 1 à 0 V [1]. Courant disponible : 7 mA nominal, 10 mA maximum selon DPA [1] ; Schoeps confirme qu'un micro P48 peut tirer jusqu'à 10 mA selon la norme [2].
- **Résistances d'alimentation (feed resistors)** : 6,8 kΩ par conducteur en P48 [2]. Tolérance de la valeur : ± 20 %, mais l'écart entre les deux résistances d'une paire doit rester < 0,4 % (soit 27 Ω pour 6,8 kΩ) pour préserver la réjection de mode commun (CMRR) et éviter qu'un courant continu traverse le transformateur d'entrée [2]. Vues en parallèle, elles font 3,4 kΩ, valeur d'impédance P48 citée par DPA [1].
- **P12** : 12 V ; la norme autorise 15 mA [2]. Contrôle à vide : 11 à 13 V ; courant de court-circuit 15 à 21 mA [2]. La valeur des résistances P12 n'a pas été trouvée dans une source lue (gap).
- **P24** : DPA mentionne seulement l'existence de tensions anciennes ou non standard (12, 15, 18, 24 V) et des appareils qui affichent « phantom on » sans indiquer la tension [1]. Pas de valeurs P24 vérifiées ici (gap).
- **Micros multi-tension** : le Schoeps CMC 6 fonctionne en P12 ou P48 (8 mA en P12, 4 mA en P48) mais ce n'est pas un micro « 12 à 48 V » : l'entrée doit respecter l'un des deux standards, résistances comprises [2].
- **Consommations réelles** : Neumann U 87 Ai 0,8 mA [1][4] ; DPA 4017B 4,5 mA ; Shure KSM44A 5,8 mA ; Earthworks SR40V 10 mA [1].
- **Tension réellement vue par le micro** : elle chute sous charge ; avec un CMC 5/6 sur P48 on mesure ≈ 34 V (minimum 30 V) sur les broches 2 et 3 [2]. Une tension trop basse réduit le SPL max et augmente la distorsion, puis le micro cesse de fonctionner [1].
- **Alimentation T (T-power, « Tonaderspeisung », A-B powering)** : ancien système où la tension est appliquée entre les deux conducteurs de modulation (et non en mode commun). Aucune source lue pendant cette session ne le documente (le manuel actuel du Sennheiser MKH 416 n'a pas pu être lu) : ne pas enseigner de valeurs chiffrées sans vérification dans l'IEC 61938. Point pédagogique sûr : T-power et phantom ne sont pas interchangeables.
- **Autres usages du P48** : alimenter des DI actives, des drivers de ligne, des lampes de pupitre [1]. Exemple : la DI active Radial J48 fonctionne sur fantôme 48 V [8].

## Formules (Formulas)
- **Tension au micro sous charge** (déduite du schéma P48 [2], deux résistances R_s = 6,8 kΩ en parallèle = 3,4 kΩ [1]) : U_micro ≈ U_s − I · (R_s / 2), U en V, I en A, R en Ω. Vérification : 48 V − 4 mA × 3,4 kΩ ≈ 34,4 V, cohérent avec les ≈ 34 V mesurés par Schoeps [2]. Sens : plus le micro consomme, plus la tension disponible baisse.
- **Courant de court-circuit d'une broche** : I_cc = U_s / R_s ≈ 48 V / 6,8 kΩ ≈ 7,1 mA, cohérent avec la plage de contrôle 5,9–8,5 mA de Schoeps [2].
- **Contrôle au voltmètre** : broche 1 → 2 ou 1 → 3 : 48 V DC (44–52 V à vide en P48) et 0 V AC ; broche 2 → 3 : 0 V [1][2].

## Pourquoi les rubans et les liaisons asymétriques sont à risque (R4)
- Le fantôme est sans danger pour un micro symétrique correctement câblé car aucune différence de tension n'apparaît entre 2 et 3 [2].
- Si un câble, un connecteur ou un adaptateur est défectueux ou câblé de façon non standard (un conducteur mis à la masse en continu) alors que le fantôme est actif, un courant impulsionnel traverse la bobine ou le ruban et peut l'endommager [2]. Coles : si le courant atteint le ruban, il est détruit instantanément [3].
- DPA : ne pas brancher de micros ou de câbles asymétriques sur une entrée avec fantôme ; les micros sensibles asymétriques, comme certains rubans, peuvent être endommagés [1]. Le fantôme suppose une liaison symétrique, avec la même impédance de chaque conducteur vers la masse [6].
- Le courant fantôme circule de la prise femelle vers la fiche mâle, dans le sens inverse du signal, sur les deux conducteurs référencés à la broche 1 [7].
- Royer : le R-121 est utilisable sur une console avec fantôme si le câblage est correct, mais il ne faut pas le faire passer par les lignes micro d'une baie de brassage (patchbay) quand le fantôme est actif, car le ruban reçoit alors une impulsion dommageable [5]. Tous les rubans ne sont pas compatibles fantôme : vérifier la doc du fabricant [5].
- Une alimentation bien conçue doit supporter un court-circuit temporaire, ce qu'une liaison asymétrique provoque ; ne pas le laisser en place [2].

## Erreurs fréquentes (Common mistakes)
- Laisser un U 87 sans +48 V et chercher la panne ailleurs : première cause listée par Neumann quand le micro ne fonctionne pas [4]. C'est exactement le cas TekPractice R4 (`focusrite-isa-one`, toggle `phantom-48v` à OFF par défaut).
- Brasser des micros à ruban dans une patchbay avec le fantôme actif [5].
- Couper/activer le fantôme volume ouvert : Neumann recommande de baisser le niveau avant de couper le fantôme et de débrancher [4].
- Croire que « 48 V » suffit : il faut aussi des résistances conformes et appariées [2].
- Brancher un même micro sur deux préamplis par un simple Y : utiliser un splitter actif pour conserver les conditions d'alimentation et de charge [2].

## Lien avec le matériel (Equipment links)
- Exige P48 : `neumann-u87-ai`, `neumann-tlm-103`, `neumann-km-184`, `sennheiser-mkh-416`, `sennheiser-mkh-8040`.
- P48/P12 : `schoeps-cmc-6-mk-4`, `schoeps-mstc-74`.
- Rubans à protéger : `royer-r-121`, `coles-4038`, `aea-r84`, `beyerdynamic-m-160`.
- Fournit le +48 V : `focusrite-isa-one`, `yamaha-ql1`, `yamaha-rio3224-d2`, `axia-iq`, `aeta-scoopy-plus-s`.
- DI alimentée par fantôme : `radial-j48`.
- TekPractice **R4** : erreur si `requiresPhantom` n'atteint pas une entrée `providesPhantom` active ; avertissement si +48 V vers un ruban ou une source ligne.

## Pour aller plus loin (Best sources)
- [2] Manuel Schoeps CMC/MK : la source la plus complète trouvée (6,8 kΩ, tolérances, appariement 0,4 %, P12 15 mA, procédures de mesure). À utiliser pour un TP de mesure au multimètre.
- [1] DPA, *Know the basics about phantom power* : synthèse claire, consommations de micros réels, historique (Neumann 1966).
- [5] Manuel Royer R-121 et [3] Coles : les mises en garde concrètes sur les rubans.
- Norme IEC 61938 (payante) : non consultée ; à acquérir par l'établissement pour vérifier P24/T-power.

## Sources
1. DPA Microphones, "Know the basics about phantom power", Mic University, https://www.dpamicrophones.com/mic-university/technology/know-the-basics-about-phantom-power/, accessed 2026-10-22, verified-primary
2. SCHOEPS GmbH, "Colette Series – CMC/MK user manual (EN)", incl. section "Phantom Powering (DIN EN 61938)", https://schoeps.de/fileadmin/user_upload/user_upload/Downloads/Bedienungsanleitungen/SCHOEPS_Manual_CMC_MK_E_2015-10-03_1444311033__1_.pdf, accessed 2026-10-22, verified-primary
3. Coles Electroacoustics, "Ribbon microphone care tips", https://coleselectroacoustics.com/ribbon-microphone-care-tips/, accessed 2026-10-22, verified-primary
4. Neumann, "U 87 Ai Operating Manual" (opin0134), https://www.neumann.com/globalassets/digizuite/16474-en-opin0134_u87ai_06-10.pdf (redirects to https://bgzkwm.files.cmp.optimizely.com/download/assets/opin0134_U87Ai_06-10.pdf/f62126f8dc1311f0ba6b7ec57e6db003), accessed 2026-10-22, verified-primary
5. Royer Labs, "R-121 Operation Instructions", https://royerlabs.com/pdf/manuals/R-121manual.pdf, accessed 2026-10-22, verified-primary
6. DPA Microphones, "About balanced and unbalanced lines", https://www.dpamicrophones.com/mic-university/technology/about-balanced-and-unbalanced-lines/, accessed 2026-10-22, verified-primary
7. Wikipedia, "XLR connector" (phantom power flows on both signal lines referenced to pin 1), https://en.wikipedia.org/wiki/XLR_connector, accessed 2026-10-22, verified-secondary
8. Radial Engineering, "J48 – Specifications", https://www.radialeng.com/product/j48/specifications/, accessed 2026-10-22, verified-primary
