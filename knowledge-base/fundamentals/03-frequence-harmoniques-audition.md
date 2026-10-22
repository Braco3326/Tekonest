---
id: 03-frequence-harmoniques-audition
title_fr: Fréquence, harmoniques, timbre et audition
title_en: Frequency, harmonics, timbre and hearing
bts_mapping:
  - epreuve: E3
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://www.francecompetences.fr/recherche/rncp/37196/
    # Bloc BC02 vérifié sur la fiche RNCP37196. Codes de savoirs non vérifiés : le PDF du référentiel (sti.eduscol) a renvoyé ECONNRESET.
    # Courbes isosoniques, pondération A et effet de masque sont des notions de l'écrit E3 (cf. unit1-acoustique.ts).
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://www.francecompetences.fr/recherche/rncp/37196/
    # E4 : niveau d'écoute, protection auditive et réglementation des sons amplifiés en situation de sonorisation. Mapping par jugement pédagogique.
tekpractice_rules: []
last_checked: 2026-10-22
---

# Fréquence, harmoniques, timbre et audition (Frequency, harmonics, timbre and hearing)

## En bref / In short
L'oreille humaine entend en gros de 20 Hz à 20 kHz ; en dessous on parle d'infrasons, au-dessus d'ultrasons [1]. Un son musical est fait d'une fondamentale (fundamental) et d'harmoniques (harmonics) multiples entiers ; leur répartition donne le timbre (timbre) [2]. La sensibilité de l'oreille dépend de la fréquence et du niveau : les courbes isosoniques (equal-loudness contours) de la norme ISO 226 le décrivent [3][4]. Un son fort peut en rendre un autre inaudible, c'est l'effet de masque (masking) [5]. Enfin, l'exposition au bruit abîme l'oreille de façon irréversible ; le Code du travail et le Code de la santé publique fixent des seuils précis [6][7][8].

## Notions clés (Key concepts)
- **Fréquence (frequency)** : nombre de cycles par seconde, en Hz. Plus la fréquence est haute, plus le son est aigu [1].
- **Plage audible (audible range)** : 20 Hz à 20 000 Hz. Les fréquences de la parole vont environ de 100 à 6 000 Hz [1].
- **Fondamentale et harmoniques (fundamental, harmonics)** : une harmonique est un multiple entier de la fondamentale. La fondamentale est la 1re harmonique ; la 2e harmonique (2·f0) est le 1er partiel supérieur (overtone) et sonne à l'octave. Les harmoniques 2, 4 et 8 donnent les trois premières octaves [2].
- **Timbre** : il dépend des harmoniques présentes et de leur niveau. Exemple : la clarinette, dans son registre grave, a des harmoniques impaires fortes et des paires faibles [2].
- **Partiels inharmoniques (inharmonic partials)** : cloches et percussions ont des partiels qui ne sont pas des multiples entiers [2].
- **Voix parlée** : fondamentale vers 100-120 Hz pour un homme, environ une octave plus haut pour une femme, vers 300 Hz pour un enfant. Les consonnes se situent surtout entre 2 et 4 kHz ; la bande autour de 2 kHz est la plus importante pour l'intelligibilité [9].
- **Courbes isosoniques (equal-loudness contours)** : combinaisons de niveaux et de fréquences de sons purs perçus avec la même sonie. ISO 226:2023 (3e édition) les donne de 20 Hz à 12 500 Hz, en champ libre, source de face, écoute binaurale, pour des auditeurs otologiquement normaux de 18 à 25 ans [3]. L'édition 2003 a nettement relevé les valeurs sous 1 kHz par rapport à l'ancienne norme, avec des courbes beaucoup plus raides dans le grave [4].
- **Fletcher-Munson n'est pas ISO 226** : Fletcher et Munson (1933) ont mesuré au casque ; Robinson et Dadson (1956) en champ libre ; ISO 226:2003 ne suit ni l'une ni l'autre. Mieux vaut dire « courbes isosoniques » [10].
- **Phone et sone (phon, sone)** : à 1 kHz, n phones = n dB SPL. 1 sone = 40 phones, et +10 phones double le nombre de sones [11].
- **Pondération A** : elle suit à peu près l'inverse de l'isosonique 40 phones, donc des niveaux faibles ; à fort niveau elle sous-estime ce que l'on perçoit [11][12]. Détails dans le fichier 02.
- **Bandes critiques (critical bands)** : l'oreille découpe le spectre en 24 bandes (échelle de Bark, de Zwicker) ; la 1re bande monte à 100 Hz, la 24e à 15 500 Hz [5].
- **Effet de masque simultané (simultaneous masking)** : un signal audible seul peut devenir inaudible en présence d'un autre. Un bruit masque un son pur environ 5 dB plus faible que lui ; le seuil d'audition est relevé aussi au-dessus et en dessous de la fréquence du masquant [5].
- **Masquage temporel (temporal masking)** : après l'arrêt d'un son fort, le seuil redescend en 5 ms à plus de 150 ms selon le masquant. Le début d'un son fort peut même masquer un son faible qui le précède [5].
- **Plus petite différence de niveau perceptible (JNLD)** : environ 0,75 dB à 20 dB SPL, environ 0,2 dB à 80 dB SPL [5].
- **Seuils** : 0 dB SPL à 1 kHz est le seuil d'audition ; le seuil de douleur se situe vers 130-140 dB SPL selon le spectre et l'auditeur [13]. L'INRS associe 120 dB(A) à une sensation douloureuse [1].
- **Atteintes auditives** : la fatigue auditive (acouphènes, baisse temporaire d'audition) est réversible si l'exposition s'arrête ; la surdité due au bruit détruit les cellules ciliées de l'oreille interne et ne se guérit pas. Elle touche d'abord les aigus de la conversation [7].
- **Seuils au travail (Code du travail)** : VAI 80 dB(A) sur 8 h ou 135 dB(C) crête ; VAS 85 dB(A) ou 137 dB(C) ; VLE 87 dB(A) ou 140 dB(C). La VLE se calcule en tenant compte de l'atténuation des protecteurs, pas la VAI ni la VAS [6].
- **Sons amplifiés (décret n° 2017-1244, art. R1336-1 du Code de la santé publique)** : ne dépasser à aucun moment et en aucun endroit accessible au public 102 dB(A) et 118 dB(C) sur 15 minutes. Pour un public d'enfants jusqu'à 6 ans révolus : 94 dB(A) et 104 dB(C) [8][14]. Les lieux concernés doivent informer le public, fournir gratuitement des protections auditives et prévoir des zones ou périodes de repos auditif. Au-delà de 300 personnes, ils enregistrent les niveaux en continu, conservent les enregistrements 6 mois et affichent les niveaux à la console [14].
- **Règle d'égale énergie (equal-energy rule)** : à partir de 80 dB(A) sur 8 h, chaque division par deux de la durée autorise +3 dB : 83 dB(A) sur 4 h, 86 dB(A) sur 2 h, 89 dB(A) sur 1 h, environ 95 dB(A) sur 15 min [8].

## Formules (Formulas)
- **Harmoniques** : fn = n · f0, n entier ≥ 1 (n = 1 : fondamentale) [2].
- **Période** : T = 1/f [15].
- **Sonie** : LN = 40 + 10·log2(N), avec LN en phones et N en sones [11].
- **Égale énergie** : niveau admissible = 80 + 10·log10(8 h / durée), en dB(A). Formule déduite du tableau de [8] (80,0 à 8 h ; 89,0 à 1 h ; 95,1 à 15 min).

## Erreurs fréquentes (Common mistakes)
- **Appeler « Fletcher-Munson » la norme actuelle.** Les courbes de référence sont celles d'ISO 226 (édition 2023) [3][10].
- **Croire que l'oreille a la même sensibilité à toutes les fréquences et à tous les niveaux.** À bas niveau, il faut beaucoup plus de niveau dans le grave pour une sonie égale [4]. Un mix équilibré à fort niveau paraîtra pauvre en graves plus bas : contrôlez à plusieurs niveaux d'écoute.
- **Utiliser le dB(A) comme mesure de sonie.** C'est une pondération, pas une unité de sonie [11].
- **Mesurer un concert seulement en dB(A).** La loi impose aussi une limite en dB(C) (118 dB(C) sur 15 min) pour tenir compte du grave [8][14].
- **Penser que la fatigue auditive est sans conséquence.** Elle prévient d'une exposition dangereuse ; la surdité qui suit est irréversible [7].
- **Confondre harmonique et partiel supérieur (overtone).** La 2e harmonique est le 1er partiel supérieur [2].
- **Couper sous 1 kHz « pour clarifier » une voix.** Un passe-haut à 500 Hz laisse la parole compréhensible, mais à 1 kHz l'intelligibilité tombe sous 40 % [9].

## Lien avec le matériel (Equipment links)
- Casques et intra-auriculaires (attention au niveau d'écoute) : `beyerdynamic-dt-770-pro`, `sennheiser-hd-25`, `shure-se215`, `sennheiser-ew-iem-g4`, `shure-psm-300`.
- Micro de mesure pour contrôler les niveaux : `earthworks-m23`.
- Codecs perceptifs : le principe du masquage [5] explique la réduction de débit (voir les fichiers sur le numérique s'ils existent).
- Aucune règle TekPractice R1-R8 directement liée.

## Pour aller plus loin (Best sources)
- [5] **ITU-R BS.1387-2** (section 3) : résumé primaire et gratuit de la psychoacoustique utile (bandes critiques, masquage, JNLD).
- [3] **ISO 226:2023** (page de présentation chez evs.ee) : champ d'application et conditions ; le texte complet est payant.
- [4][10] **sengpielaudio** : figures comparant Fletcher-Munson, Robinson-Dadson et ISO 226:2003.
- [6][7][1] **INRS** : seuils réglementaires au travail et effets sur la santé, en français.
- [8][14] **CIDB / DGS-DGPR** : explication du décret 2017-1244 sur les sons amplifiés, avec le tableau d'égale énergie.
- [9] **DPA** : fréquences de la parole et intelligibilité, pour la prise de son voix.

## Sources
1. « Bruit au travail : définitions », INRS, https://www.inrs.fr/risques/bruit/definitions.html, accessed 2026-10-22, verified-primary
2. « Harmonics and overtones », sengpielaudio, http://www.sengpielaudio.com/calculator-harmonics.htm, accessed 2026-10-22, verified-secondary
3. ISO 226:2023 « Acoustics — Normal equal-loudness-level contours » (fiche de la norme), EVS (organisme estonien de normalisation), https://www.evs.ee/et/iso-226-2023, accessed 2026-10-22, verified-secondary (scope only; full text paywalled)
4. « Normal equal-loudness level contours – ISO 226:2003 », E. Sengpiel, sengpielaudio, http://www.sengpielaudio.com/Acoustics226-2003.pdf, accessed 2026-10-22, verified-secondary
5. Recommendation ITU-R BS.1387-2 (05/2023), « Method for objective measurements of perceived audio quality », section 3, ITU, https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1387-2-202305-I!!PDF-E.pdf, accessed 2026-10-22, verified-primary
6. « Bruit : réglementation », INRS, https://www.inrs.fr/risques/bruit/reglementation.html, accessed 2026-10-22, verified-primary
7. « Bruit : effets sur la santé », INRS, https://www.inrs.fr/risques/bruit/effets-sante.html, accessed 2026-10-22, verified-primary
8. N. Commeau (DGPR), D. Ollandini (DGS), « Décret n° 2017-1244 du 7 août 2017 relatif à la prévention des risques liés aux bruits et aux sons amplifiés : explication de texte », présentation CIDB, Rennes, 5 décembre 2018, https://www.bruit.fr/images/pdf/rennes-5-decembre-2018/commeau-ollandini-cidb-sons-amplifies.pdf, accessed 2026-10-22, verified-secondary (official presenters; not the Légifrance text)
9. « Facts about speech intelligibility », DPA Microphones, Mic University, https://www.dpamicrophones.com/mic-university/background-knowledge/facts-about-speech-intelligibility/, accessed 2026-10-22, verified-primary (manufacturer education)
10. « Fletcher-Munson is not Robinson-Dadson », E. Sengpiel, sengpielaudio, http://www.sengpielaudio.com/Fletcher-MunsonIsNotRobinson-Dadson.pdf, accessed 2026-10-22, verified-secondary
11. « Sones and phons loudness conversion and the problem with dBA », sengpielaudio, http://www.sengpielaudio.com/calculatorSonephon.htm, accessed 2026-10-22, verified-secondary
12. « Weighting filter calculation – weighted dBA and dBC », sengpielaudio, http://www.sengpielaudio.com/calculator-dba-spl.htm, accessed 2026-10-22, verified-secondary
13. « Table of sound pressure levels », sengpielaudio, http://www.sengpielaudio.com/TableOfSoundPressureLevels.htm, accessed 2026-10-22, verified-secondary
14. « Lieux diffusant des sons amplifiés », CIDB, https://www.bruit.fr/droits-demarches/bruits-de-voisinage-lies-aux-activites/lieux-diffusant-des-sons-amplifies, accessed 2026-10-22, verified-secondary
15. « Frequency to wavelength conversion », sengpielaudio, http://www.sengpielaudio.com/calculator-wavelength.htm, accessed 2026-10-22, verified-secondary
