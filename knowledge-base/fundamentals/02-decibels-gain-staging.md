---
id: 02-decibels-gain-staging
title_fr: Décibels, niveaux de référence et gain staging
title_en: Decibels, reference levels and gain staging
bts_mapping:
  - epreuve: E3
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://www.francecompetences.fr/recherche/rncp/37196/
    # Bloc BC02 vérifié sur la fiche RNCP37196. Codes de savoirs non vérifiés : le PDF du référentiel (sti.eduscol) a renvoyé ECONNRESET.
    # Les conversions entre dB SPL, dBu, dBV et dBFS et l'addition de niveaux sont des calculs typiques de l'écrit E3.
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://www.francecompetences.fr/recherche/rncp/37196/
    # E4 (pratique) : réglage du gain, alignement d'une chaîne, ton de référence. Mapping par jugement pédagogique (cohérent avec R2 dans tekpractice-sim/content/readiness.json).
tekpractice_rules: [R2]
last_checked: 2026-10-22
---

# Décibels, niveaux de référence et gain staging (Decibels, reference levels and gain staging)

## En bref / In short
Le décibel (decibel, dB) est un rapport logarithmique entre une grandeur et une **référence**. Le suffixe donne cette référence : 20 µPa pour le dB SPL [1], 0,775 V pour le dBu, 1 V pour le dBV [2], le niveau maximal codable pour le dBFS (decibels relative to full scale) [5]. Les niveaux ne s'additionnent pas comme des nombres ordinaires : deux sources égales et non corrélées donnent +3 dB, pas le double [3][9]. En radiodiffusion, l'EBU place le niveau d'alignement (alignment level) 18 dB sous le niveau numérique maximal, soit −18 dBFS [5][7]. Le gain staging consiste à régler chaque étage de la chaîne pour rester loin du bruit de fond (noise floor) tout en gardant une marge (headroom) avant l'écrêtage (clipping).

## Notions clés (Key concepts)
- **Grandeurs de champ et grandeurs de puissance (field vs power quantities)** : tension et pression se convertissent avec 20·log, puissance et intensité avec 10·log [1][2]. Doubler la pression ou la tension donne +6 dB, doubler la puissance ou l'intensité donne +3 dB [4].
- **dB SPL** : référence p0 = 20 µPa. 1 Pa ≈ 94 dB SPL, 20 Pa = 120 dB SPL [1].
- **dBu et dBV** : 0 dBu = 0,775 V, 0 dBV = 1 V. L'écart est de 2,2 dB (0 dBV = +2,2 dBu). Le niveau ligne pro +4 dBu vaut environ 1,228 V ; le niveau grand public −10 dBV vaut environ 0,316 V, soit −7,78 dBu [2].
- **dBFS** : niveau par rapport au maximum codable par le convertisseur. L'EBU indique que la seule façon fiable de spécifier un niveau numérique est de le rapporter à ce maximum, quel que soit le nombre de bits [5]. 0 dBFS est donc un plafond, et les niveaux de travail sont négatifs.
- **Niveau d'alignement (alignment level, AL)** : niveau d'un signal sinusoïdal à 1 kHz servant à caler une liaison. ITU-R BS.645 le fixe à 0 dBu0s, soit 0,775 V efficaces en un point de niveau relatif zéro [6].
- **Niveau maximal permis (permitted maximum level, PML)** : 9 dB au-dessus de l'alignement selon BS.645 ; le signal de mesure (measurement signal) est 12 dB en dessous [6].
- **Correspondance analogique / numérique (EBU)** : EBU Tech 3276 précise que le niveau d'alignement vaut −9 dB par rapport au PML en analogique (BS.645) et −18 dB par rapport à la pleine échelle en numérique (R 68) [7]. En combinant [6] et [7] : un ton d'alignement à 0 dBu (au point de niveau relatif zéro) correspond à −18 dBFS. Cette équivalence est une déduction à partir des deux textes, pas une phrase de R 68.
- **Marge (headroom)** : écart entre le niveau nominal et l'écrêtage. R 68 justifie ses 18 dB ainsi : les crêtes réelles peuvent dépasser de 3 dB ce qu'indique un crêtemètre quasi-crête, et avec les erreurs d'opérateur elles atteignent occasionnellement 15 dB au-dessus de l'alignement [5]. Il reste donc environ 3 dB de sécurité.
- **Rapport signal/bruit et nombre de bits** : en numérique, le rapport signal/bruit dépend directement du nombre de bits et du niveau d'alignement choisi [5].
- **Pondérations dB(A) et dB(C) (weighting)** : le filtre A suit approximativement l'inverse de la courbe isosonique à 40 phones ; il atténue fortement le grave (−26,2 dB à 63 Hz, −39,4 dB à 31,5 Hz). Le filtre C reste presque plat (−0,8 dB à 63 Hz, −3,0 dB à 31,5 Hz) et convient aux niveaux élevés. Les deux valent 0 dB à 1 kHz [8]. Le dB(A) n'est pas une unité de sonie et ne se convertit pas en dB SPL par une formule unique [10].
- **Addition de sources** : sources non corrélées (incoherent), +3 dB pour deux sources égales. Signaux corrélés en phase (coherent), +6 dB [3]. INRS : une machine à 80 dB(A) donne 83 dB(A) à deux, 86 dB(A) à quatre et 90 dB(A) à dix [9].
- **Sonie perçue (loudness)** : environ +10 dB pour un son perçu « deux fois plus fort ». C'est une règle approximative, différente de +6 dB (pression ×2) et de +3 dB (puissance ×2) [4].
- **Gain staging et sensibilité des micros** : un micro sensible (en mV/Pa à 1 kHz, mesuré à 94 dB SPL = 1 Pa) demande moins de gain au préampli. À faible niveau, un micro sensible limite le bruit d'amplification ; à très fort niveau, un micro peu sensible est préférable [11]. La plage dynamique d'un micro va de son bruit propre (pondéré A) au niveau où la distorsion harmonique totale atteint 1 % [11].
- **Niveau d'écoute de référence** : l'EBU règle chaque enceinte avec un bruit rose au niveau d'alignement, pour obtenir LLISTref = 85 − 10·log10(n) dB(A) au point d'écoute (n = nombre d'enceintes principales). L'écart entre deux canaux ne doit pas dépasser 1 dB [7].

## Formules (Formulas)
- **Niveau de pression** : Lp = 20·log10(p / p0), p0 = 20 µPa ; p en Pa, Lp en dB SPL [1].
- **Niveau d'intensité** : LI = 10·log10(I / I0), I0 = 10⁻¹² W/m² [1].
- **Tension en dBu ou dBV** : L = 20·log10(V / V0), avec V0 = 0,775 V (dBu) ou 1 V (dBV). Inverse : V = V0·10^(L/20) [2].
- **Conversion** : dBu = dBV + 2,2 [2].
- **n sources égales non corrélées** : ΔL = 10·log10(n) (n = 2 → +3 dB) [3].
- **Deux signaux égaux corrélés en phase** : +6 dB [3].
- **Alignement EBU numérique** : AL = −18 dBFS (rapport 1:8, soit 18,06 dB sous le maximum) [5].
- **Niveau d'écoute de référence EBU** : LLISTref = 85 − 10·log10(n) dB(A) [7].

## Erreurs fréquentes (Common mistakes)
- **Additionner les dB arithmétiquement** (90 + 90 = 180). Deux sources non corrélées de 90 dB donnent 93 dB [3][9].
- **Utiliser 10·log pour une tension.** Pour une tension ou une pression, c'est 20·log [2].
- **Confondre dBu et dBV.** L'écart est de 2,2 dB ; −10 dBV ≈ −7,8 dBu, pas −10 dBu [2].
- **Écrire « l'EBU R 68 fixe +4 dBu = −18 dBFS ».** R 68 ne parle que du niveau numérique : l'alignement est 18 dB sous le maximum codable [5]. Côté analogique, l'alignement ITU/EBU est 0 dBu0s [6][7]. D'autres organisations utilisent d'autres correspondances ; vérifiez toujours la norme maison. (Le cours `unit1-acoustique.ts` contient cette formulation et devrait être corrigé.)
- **Pousser les niveaux près de 0 dBFS « pour avoir un bon rapport signal/bruit ».** Avec un crêtemètre quasi-crête, les crêtes réelles sont plus hautes que l'affichage [5]. Gardez la marge.
- **Croire que +3 dB double la sonie.** +3 dB double la puissance ; la sonie double vers +10 dB [4].
- **Mesurer un concert ou un caisson uniquement en dB(A).** Le filtre A écrase le grave ; la réglementation française fixe aussi une limite en dB(C) [8][12].
- **Régler le gain du préampli d'après le fader.** Réglez d'abord le gain d'entrée pour un niveau nominal correct, puis mixez avec les faders.

## Lien avec le matériel (Equipment links)
- Préamplis et consoles : `focusrite-isa-one`, `ams-neve-1073spx`, `yamaha-ql1`, `yamaha-cl5`, `behringer-x32`, `allen-heath-sq-6` (gain d'entrée, PAD, vumètres).
- Convertisseurs et interfaces : `avid-hd-io`, `rme-fireface-ufx-iii`, `focusrite-scarlett-2i2-4th-gen`, `antelope-orion-32-plus-gen4` (correspondance dBu / dBFS réglable selon les modèles ; consultez leurs fiches).
- Micros (sensibilité, bruit propre, SPL max) : `neumann-u87-ai`, `neumann-km-184`, `shure-sm58` ; méthode de lecture des fiches techniques dans [11].
- Règle TekPractice **R2** (signal : niveau micro ≠ niveau ligne). Ce fichier fournit les références dBu/dBV et le vocabulaire de marge qui la justifient.

## Pour aller plus loin (Best sources)
- [5] **EBU R 68** : deux pages, le texte de référence pour −18 dBFS et sa justification (crêtes réelles, rapport signal/bruit).
- [6] **ITU-R BS.645-2** : définitions officielles du signal d'alignement, du signal de mesure et du niveau maximal permis.
- [7] **EBU Tech 3276** : fait le pont entre analogique et numérique, et définit le niveau d'écoute de référence.
- [1][2][3][4][8][10] **sengpielaudio** : calculateurs pour vérifier les exercices de conversion et d'addition.
- [9] **INRS** : tableau d'addition de machines, en français, très parlant pour les élèves.
- [11] **DPA Mic University** : lire une fiche technique de micro (sensibilité, bruit propre, SPL max).

## Sources
1. « Sound level SPL, pressure, pascal, and intensity level conversion », sengpielaudio, http://www.sengpielaudio.com/calculator-soundlevel.htm, accessed 2026-10-22, verified-secondary
2. « Voltage to level dBu and dBV conversion », sengpielaudio, http://www.sengpielaudio.com/calculator-db-volt.htm, accessed 2026-10-22, verified-secondary
3. « Total level in decibels – adding of incoherent sound sources », sengpielaudio, http://www.sengpielaudio.com/calculator-leveladding.htm, accessed 2026-10-22, verified-secondary
4. « The human perception of loudness – loudness factor », sengpielaudio, http://www.sengpielaudio.com/calculator-loudness.htm, accessed 2026-10-22, verified-secondary
5. EBU R 68-2000, « Alignment level in digital audio production equipment and in digital audio recorders », EBU, https://tech.ebu.ch/files/live/sites/tech/files/shared/r/r068.pdf (page : https://tech.ebu.ch/publications/r068), accessed 2026-10-22, verified-primary
6. Recommendation ITU-R BS.645-2 (1992), « Test signals and metering to be used on international sound programme connections », ITU, https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.645-2-199203-I!!PDF-E.pdf, accessed 2026-10-22, verified-primary
7. EBU Tech 3276 (1998), « Listening conditions for the assessment of sound programme material », EBU, https://tech.ebu.ch/files/live/sites/tech/files/shared/tech/tech3276.pdf, accessed 2026-10-22, verified-primary
8. « Weighting filter calculation – weighted dBA and dBC », sengpielaudio, http://www.sengpielaudio.com/calculator-dba-spl.htm, accessed 2026-10-22, verified-secondary
9. « Bruit au travail : définitions », INRS, https://www.inrs.fr/risques/bruit/definitions.html, accessed 2026-10-22, verified-primary
10. « Sones and phons loudness conversion and the problem with dBA », sengpielaudio, http://www.sengpielaudio.com/calculatorSonephon.htm, accessed 2026-10-22, verified-secondary
11. « How to read microphone specifications », DPA Microphones, Mic University, https://www.dpamicrophones.com/mic-university/technology/how-to-read-microphone-specifications/, accessed 2026-10-22, verified-primary (manufacturer education)
12. « Lieux diffusant des sons amplifiés », CIDB, https://www.bruit.fr/droits-demarches/bruits-de-voisinage-lies-aux-activites/lieux-diffusant-des-sons-amplifies, accessed 2026-10-22, verified-secondary
