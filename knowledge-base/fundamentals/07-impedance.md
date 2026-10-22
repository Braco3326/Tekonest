---
id: 07-impedance
title_fr: Impédance, adaptation en tension (bridging) et charge des amplificateurs
title_en: Impedance, voltage bridging and amplifier loads
bts_mapping:
  - epreuve: E3
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Référentiel PDF injoignable (ECONNRESET). Les calculs de pont diviseur et la règle du ×10 sont des exercices récurrents des annales E3 (unité e3-u2 de la plateforme)."
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Câbler enceintes passives/ampli et choisir une entrée adaptée relève de la mise en œuvre (E4); codes non lus."
tekpractice_rules: [R2]
last_checked: 2026-10-22
---

# Impédance (Impedance)

## En bref / In short
L'impédance Z (impedance) est le rapport entre tension et courant efficaces (rms) d'un circuit en alternatif ; pour une résistance pure, Z = R, mais condensateurs et bobines ajoutent une composante déphasée de 90°, qui dépend de la fréquence [1]. En audio moderne, on ne cherche plus l'adaptation d'impédance (impedance matching) entre étages de ligne : on transfère une tension, pas une puissance, grâce à des sorties basse impédance et des entrées haute impédance (bridging) [2][3]. L'adaptation 600 Ω est un héritage de la téléphonie [3]. En revanche, entre un amplificateur de puissance et des haut-parleurs, c'est bien une puissance qui est délivrée, et l'impédance de charge (4 Ω, 8 Ω…) détermine la puissance et les limites de l'ampli [4][5].

## Notions clés (Key concepts)
- **Bridging (adaptation en tension)** : une sortie à faible impédance attaque une entrée à forte impédance ; la quasi-totalité de la tension se retrouve aux bornes de l'entrée et la source n'est pas chargée [3]. Rane : sortie ≈ 100 Ω vers entrée ≈ 20 kΩ, perte ≈ −0,04 dB [2].
- **Pourquoi pas l'adaptation (matching)** : si l'on « adapte » 100 Ω en chargeant l'entrée à ≈ 100 Ω, on perd 6 dB de signal et de dynamique, on augmente le courant, la distorsion et l'échauffement [2]. L'adaptation a encore un sens quand on veut transférer une puissance [2].
- **Règle pratique micro → préampli** : impédance de charge 5 à 10 fois celle de la source [6][7] ; DPA indique typiquement ×10 pour un micro professionnel [8]. Royer : au moins ×5 (300 Ω → ≥ 1500 Ω), sinon le ruban perd graves, corps et sensibilité [9].
- **Ordres de grandeur vérifiés** :
  - micro dynamique : Shure SM58, 150 Ω nominal (300 Ω réel) pour entrées « basse impédance » [10] ;
  - micro à condensateur : Neumann U 87 Ai, 200 Ω, charge nominale 1000 Ω [11] ; DPA : 20–200 Ω en général [12] ;
  - entrée P48 : 3,4 kΩ vu par le micro (deux 6,8 kΩ en parallèle) [6] ;
  - sorties ligne : 100 à 600 Ω, plus bas sur le matériel récent [3] ; Rane : sorties symétriques de 100 à 600 Ω, ≤ 200 Ω conviennent à la plupart des installations [13] ;
  - entrées ligne : ≥ 10 kΩ [3] ; Rane : 20 à 100 kΩ en symétrique [13] ; Focusrite ISA One : entrée ligne 10 kΩ [14] ;
  - entrée instrument (Hi-Z) : Focusrite ISA One > 1 MΩ (réglage High) ou > 300 kΩ (Low) selon la fiche, mais 2,4 MΩ / 470 kΩ dans le texte de présentation (incohérence de la source) [14] ; DI Radial JDI : entrée 140 kΩ, sortie 150 Ω [15].
- **Histoire du 600 Ω** : les premiers standards téléphoniques utilisaient sources et charges de 600 Ω et mesuraient la puissance en dBm ; le dBu (0,775 V) est la tension qui donnerait 1 mW dans 600 Ω, utilisée aujourd'hui sans charge 600 Ω (« dBm unloaded ») [3]. Rane considère les charges 600 Ω comme rares et peu pertinentes en pratique moderne [13].
- **Capacité du câble** : une sortie à forte impédance associée à un long câble forme un filtre passe-bas ; Rane : à 200 Ω on garde ≈ 23 kHz (−3 dB) sur 300 m (1000 ft) de câble, à 600 Ω ≈ 15,6 kHz sur seulement ≈ 150 m (500 ft) [13]. Schoeps : charge minimale recommandée 600 Ω pour ses préamplis micro [16].
- **Haut-parleurs et amplificateur** : la puissance dépend de la charge. Crown XLS 2502 (par canal, 0,5 % THD, 1 kHz) : 440 W sous 8 Ω, 775 W sous 4 Ω, 1200 W sous 2 Ω ; en pont : 1550 W sous 8 Ω, 2400 W sous 4 Ω [5]. On remarque que la puissance ne double pas exactement quand l'impédance est divisée par deux : l'ampli atteint ses limites de courant/alimentation. Facteur d'amortissement > 200 (8 Ω, 10–400 Hz) [5].
- **Enceintes actives** : l'amplificateur est intégré ; on leur envoie un niveau ligne (TekPractice : `qsc-k12-2`, entrée `line-level-pro`), jamais une sortie haut-parleur.

## Formules (Formulas)
- **Loi d'Ohm en alternatif** : V = Z · I (V et I efficaces, Z en Ω) [1].
- **Puissance** : P = V · I ; dans une résistance, avec la loi d'Ohm, P = V²/R = R·I² (valeurs efficaces) [4]. Sens : à tension égale, diviser l'impédance par deux double la puissance demandée — en théorie ; l'ampli réel plafonne [5].
- **Pont diviseur source/charge** : U_entrée / U_source = Z_entrée / (Z_entrée + Z_sortie) ; perte en dB = 20·log10 de ce rapport. Vérification sur l'exemple Rane : 20 kΩ / (20 kΩ + 100 Ω) → ≈ −0,04 dB ; avec une entrée chargée à ≈ 100 Ω, rapport ≈ 0,5 → −6 dB [2].
- **Association** : en série, les impédances s'additionnent ; en parallèle, on combine par la méthode des impédances complexes (pour des résistances pures : 1/Z = 1/Z1 + 1/Z2) [1]. Deux enceintes 8 Ω en parallèle sur un canal = 4 Ω.
- **dBu** : 0 dBu ≈ 0,775 V eff., tension de 1 mW dans 600 Ω [3] ; +4 dBu ≈ 1,228 V ; −10 dBV ≈ 0,316 V [3].

## Erreurs fréquentes (Common mistakes)
- « Il faut adapter les impédances en ligne » : faux en audio moderne, on vise Z_entrée ≫ Z_sortie [2][3].
- Brancher une guitare passive sur une entrée ligne 10 kΩ : chute de niveau et d'aigus ; utiliser une entrée Hi-Z ou une DI [14][15] (R2, `instrument-hiz`).
- Charger un ruban passif avec une entrée trop basse impédance : perte de graves et de sensibilité [9].
- Mettre trop d'enceintes en parallèle : l'impédance chute sous le minimum supporté par l'ampli ; vérifier la fiche (ex. XLS spécifié jusqu'à 2 Ω par canal, 4 Ω en pont) [5].
- Confondre impédance nominale (valeur arrondie de catalogue) et impédance réelle, qui varie avec la fréquence [1][10].
- Raccorder une sortie haut-parleur à une entrée ligne : niveaux sans rapport (R2, `speaker-level`).

## Lien avec le matériel (Equipment links)
- Préamplis/entrées : `focusrite-isa-one` (entrée ligne 10 kΩ, instrument Hi-Z), `ams-neve-1073spx`, `universal-audio-solo-610`.
- DI : `radial-jdi`, `radial-j48`, `radial-prodi`.
- Micros : `shure-sm58` (150 Ω), `neumann-u87-ai` (200 Ω / charge 1 kΩ), `royer-r-121` (300 Ω / ≥ 1,5 kΩ).
- Amplis et enceintes passives : `crown-xls-2502`, `l-acoustics-la12x`, `db-audiotechnik-d80` ; enceintes actives : `qsc-k12-2`, `yamaha-dbr12`, `genelec-8030c`.
- TekPractice **R2** (mic vs ligne vs instrument vs haut-parleur, pro +4 dBu vs grand public −10 dBV).

## Pour aller plus loin (Best sources)
- [2] RaneNote 124 *Unity Gain and Impedance Matching: Strange Bedfellows* : l'argument complet contre l'adaptation, avec calculs.
- [13] RaneNote 126 *Practical Line-Driving Current Requirements* : impédances de sortie, capacité de câble, courant.
- [3] Wikipedia *Line level* : rappel dBu/dBV/600 Ω (source secondaire, renvoie à Ballou, *Handbook for Sound Engineers*).
- [1][4] HyperPhysics (Georgia State University) : bases d'électricité (impédance, puissance) en libre accès.
- [5] Fiche Crown XLS : bon support d'exercice puissance/charge.

## Sources
1. C. R. Nave, "Impedance", HyperPhysics, Georgia State University, http://hyperphysics.phy-astr.gsu.edu/hbase/electric/imped.html, accessed 2026-10-22, verified-primary
2. Rane (Dennis Bohn), "RaneNote 124 – Unity Gain and Impedance Matching: Strange Bedfellows", https://www.ranecommercial.com/legacy/note124.html, accessed 2026-10-22, verified-primary
3. Wikipedia, "Line level", https://en.wikipedia.org/wiki/Line_level, accessed 2026-10-22, verified-secondary
4. C. R. Nave, "Electric Power", HyperPhysics, Georgia State University, http://hyperphysics.phy-astr.gsu.edu/hbase/electric/elepow.html, accessed 2026-10-22, verified-primary
5. Crown Audio, "XLS DriveCore 2 Series data sheet", https://www.crownaudio.com/en-US/product_documents/xls_dc2_datasheet_web_050615-pdf, accessed 2026-10-22, verified-primary
6. DPA Microphones, "Know the basics about phantom power", https://www.dpamicrophones.com/mic-university/technology/know-the-basics-about-phantom-power/, accessed 2026-10-22, verified-primary
7. DPA Microphones, "10+ statements on condenser microphones versus dynamic mics", https://www.dpamicrophones.com/mic-university/background-knowledge/10plus-statements-on-condenser-microphones-versus-dynamic-mics/, accessed 2026-10-22, verified-primary
8. DPA Microphones, "How to read microphone specifications", https://www.dpamicrophones.com/mic-university/technology/how-to-read-microphone-specifications/, accessed 2026-10-22, verified-primary
9. Royer Labs, "R-121 Operation Instructions", https://royerlabs.com/pdf/manuals/R-121manual.pdf, accessed 2026-10-22, verified-primary
10. Shure, "SM58 Product Specifications", https://collegeofsanmateo.edu/theatre/docs/sm58_specsheet.pdf, accessed 2026-10-22, verified-primary
11. Neumann, "U 87 Ai Operating Manual", https://www.neumann.com/globalassets/digizuite/16474-en-opin0134_u87ai_06-10.pdf (redirects to https://bgzkwm.files.cmp.optimizely.com/download/assets/opin0134_U87Ai_06-10.pdf/f62126f8dc1311f0ba6b7ec57e6db003), accessed 2026-10-22, verified-primary
12. DPA Microphones, "Microphone technology – the essentials", https://www.dpamicrophones.com/mic-university/technology/microphone-technology-the-essentials/, accessed 2026-10-22, verified-primary
13. Rane (Dennis Bohn), "RaneNote 126 – Practical Line-Driving Current Requirements", https://www.ranecommercial.com/legacy/note126.html, accessed 2026-10-22, verified-primary
14. Focusrite, "ISA One – Specifications", https://us.focusrite.com/mic-pres/isa-one/specifications, accessed 2026-10-22, verified-primary (internal inconsistency on instrument impedance)
15. Radial Engineering, "JDI – Specifications", https://www.radialeng.com/product/jdi/specifications/, accessed 2026-10-22, verified-primary
16. SCHOEPS GmbH, "Colette Series – CMC/MK user manual (EN)", https://schoeps.de/fileadmin/user_upload/user_upload/Downloads/Bedienungsanleitungen/SCHOEPS_Manual_CMC_MK_E_2015-10-03_1444311033__1_.pdf, accessed 2026-10-22, verified-primary
