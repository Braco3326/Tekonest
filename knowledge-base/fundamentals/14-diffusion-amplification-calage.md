---
id: 14-diffusion-amplification-calage
title_fr: "Diffusion, amplification et calage de système"
title_en: "Loudspeakers, amplification and system tuning"
bts_mapping:
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Référentiel eduscol inaccessible (ECONNRESET). Installer, amplifier et caler une diffusion relève de la mise en œuvre en sonorisation (E4)."
  - epreuve: E3
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Décroissance avec la distance, sensibilité/puissance, retards et filtrage en peigne sont des calculs de physique typiques d'E3 PTES. Non vérifié dans le référentiel."
tekpractice_rules: [R2, R3]
last_checked: 2026-10-22
---

# Diffusion, amplification et calage (Loudspeakers, amplification and system tuning)

## En bref / In short
Une diffusion de sonorisation (sound reinforcement system) se compose d'un système principal (main) qui couvre la majorité du public, de subwoofers (sub) qui prolongent le grave, et de rappels (fills : front-fill, out-fill, délais) pour les zones mal couvertes [9][10]. Le niveau baisse avec la distance : environ 6 dB par doublement pour une source ponctuelle (point source) [1], moins pour une ligne source (line array) dans sa zone de couplage [4]. Les enceintes modernes ne fonctionnent qu'avec leur contrôleur ou amplificateur dédié, qui gère filtrage (crossover), égalisation, alignement de phase et protection [8]. Le **calage** (system tuning) consiste à mesurer puis à régler retards, niveaux et égalisation pour que tous ces éléments s'additionnent correctement dans le public [9][12].

## Notions clés (Key concepts)
- **Sensibilité (sensitivity)** : niveau produit à 1 m pour 1 W. Exemple : NEXO GEO M10, 100 dB SPL nominal (1 W / 1 m) ; niveau crête de 136 dB à 1 m ; impédance nominale 8 Ω ; amplification recommandée de 750 W par enceinte [8].
- **Tenue en puissance (power handling)** : exemple d&b V8/V12, 500 W efficaces et 2000 W crête sur 10 ms ; 8 Ω [6].
- **Couverture (coverage / dispersion)** : angle nominal horizontal et vertical. V8 : 80°, V12 : 120° [6] ; GEO M10 : 80° ou 120° (avec flasques), 12° ou 25° en vertical selon le modèle [8]. Les diagrammes isobares (−6 dB, −12 dB) montrent la dispersion selon la fréquence ; le contrôle horizontal de la V8 tient jusqu'à 250 Hz [6].
- **Ligne source (line array)** : empilement d'éléments couplés dont les fronts d'onde se combinent en une onde cohérente. Les angles de couplage (splay angles) entre éléments règlent la couverture verticale : de 0° à 14° par pas de 1° pour la série V d&b [6], de 0° à 11° pour la LINA de Meyer [12]. La perte n'est que d'environ 3 dB par doublement de distance pour une ligne idéale, contre 6 dB pour un point [4]. Plus la ligne est longue, plus elle contrôle bas en fréquence [4].
- **Source ponctuelle (point source)** : enceinte isolée (par exemple une enceinte active de 12 pouces), simple à mettre en œuvre, avec une décroissance de 6 dB par doublement [1].
- **Correction de couplage et de distance** : d&b propose CPL (compense l'excès de grave dû au couplage, de 0 à −9 dB, à partir de 2 kHz et au maximum sous 100 Hz) et HFC (compense l'absorption de l'air dans les aigus, HFC1 au-delà de 30 m, HFC2 au-delà de 60 m, calculé pour 40 % d'humidité) [6]. Un même line array doit avoir le même réglage CPL sur tous ses éléments [6].
- **Filtrage (crossover)** : sépare les bandes entre voies (passif à 1,3 kHz entre grave et aigu dans la GEO M10) et entre système principal et subs. Les presets NEXO proposent des passe-haut entre 63 et 120 Hz [8]. La transition main/sub se situe en général dans l'octave de 63 Hz, typiquement entre 50 et 80 Hz [9].
- **Subwoofers cardioïdes** : un haut-parleur tourné vers l'arrière, avec traitement adapté, annule l'énergie derrière le caisson. Cela réduit l'excitation du champ réverbéré dans le grave et le niveau sur scène. Le d&b V-SUB associe un 18 pouces vers l'avant et un 12 pouces vers l'arrière, sur un seul canal d'amplification [7].
- **Amplification et contrôleur** : les enceintes d&b ne doivent être alimentées que par des amplificateurs d&b correctement configurés (2 V8 par canal) [6]. Les enceintes NEXO exigent un processeur NEXO pour l'égalisation, l'alignement de phase, le filtrage et la protection en excursion et en température [8]. Le D80 compense électriquement le câble d'enceinte (LoadMatch) [6]. Connecteurs de puissance NL4/NLT4 [6].
- **Alignement temporel (time alignment)** : retard appliqué au système le plus proche (sub ou rappel) pour qu'il arrive en même temps que l'autre au point de mesure. L'alignement n'est parfait qu'à cet endroit : sur un grand parterre, l'écart main/sub peut atteindre 20 à 30 ms sur les côtés [9].
- **Effet de précédence (Haas)** : pour deux sons de même niveau, la fusion vers la source arrivée en premier tient environ 5 à 10 ms pour des clics et 30 ms pour la parole [10]. On s'en sert pour que les rappels retardés restent localisés sur la scène.
- **Filtrage en peigne (comb filtering)** : deux sources identiques légèrement décalées créent des creux réguliers dans la réponse. La coloration diminue nettement quand les sources sont séparées en angle, même de 10° [10].
- **Mesure (measurement)** : on mesure la fonction de transfert avec des balayages (sweeps). En basse fréquence, il vaut mieux multiplier le nombre de balayages (8 en extérieur, 4 en intérieur) que leur durée, car le bruit de fond peut varier de 20 dB en extérieur [11]. SIM (Meyer) mesure avec une résolution de 48 points par octave ; MAPP prédit la couverture et aide à calculer les retards des rappels [12]. Côté d&b, la conception d'un line array se prépare dans le logiciel de simulation ArrayCalc [6].

## Formules (Formulas)
- **Décroissance d'une source ponctuelle en champ libre** : L2 = L1 − 20·log10(r2 / r1) (L en dB SPL, r en m), soit −6 dB par doublement de distance [1]. Exemple : 100 dB à 1 m donne environ 94 dB à 2 m [1].
- **Ligne source idéale (champ proche)** : environ −3 dB par doublement de distance [4].
- **Niveau de puissance** : L_P = 10·log10(P / P0) ; doubler la puissance donne +3 dB, doubler la tension ou la pression donne +6 dB [2].
- **Niveau attendu à partir de la sensibilité** (combinaison des deux relations précédentes, champ libre, source ponctuelle) : L(r) ≈ S + 10·log10(P / 1 W) − 20·log10(r / 1 m), avec S la sensibilité en dB SPL (1 W, 1 m) [1][2]. Exemple : GEO M10, S = 100 dB [8] ; à 100 W et 10 m, L ≈ 100 + 20 − 20 = 100 dB SPL (sans couplage, sans salle, sans compression thermique).
- **Vitesse du son** : c ≈ 331,3 + 0,606·θ (m/s, θ en °C), soit environ 343 m/s à 20 °C [5].
- **Retard d'alignement** : Δt = Δd / c (Δt en s, Δd = différence de distance en m). Exemple : 10 m d'écart à 343 m/s donnent environ 29 ms [5].
- **Premier creux du filtre en peigne** : f_n = 1 / (2·Δt) ; premier pic à 1/Δt [3]. Exemple : Δt = 1 ms, premier creux à 500 Hz.
- **Opposition de phase main/sub** : annulation au croisement quand le retard vaut une demi-période. Exemple de la source : croisement à 52 Hz, période 19 ms, opposition à 9,5 ms [9].

## Erreurs fréquentes (Common mistakes)
- **Enceinte passive branchée sans son contrôleur**, ou sur un amplificateur générique non configuré : risque de destruction des moteurs. Correct : preset constructeur sur l'amplificateur ou le contrôleur dédié [6][8].
- **Sortie ligne d'une console vers une entrée Speakon**, ou sortie ampli vers une entrée ligne : signal inadapté (règles R2 et R3). Une enceinte active prend un niveau ligne ; une passive prend un niveau haut-parleur.
- **Aligner main et subs à la console puis ne plus mesurer** : l'alignement varie selon la position ; il faut choisir le point de référence et vérifier les zones latérales [9].
- **Retarder les rappels « à l'œil »** : calculer Δd/c puis affiner à la mesure ; retarder légèrement le rappel derrière le système principal pour garder l'image sur scène (effet de précédence) [10].
- **Empiler deux enceintes identiques en point source pour « gagner du niveau »** : filtrage en peigne dans la zone de recouvrement [3][10].
- **Mesurer avec un seul balayage en extérieur** : la mesure LF n'est pas reproductible. Utiliser plusieurs balayages et un niveau proche du niveau d'exploitation [11].
- **Oublier l'exposition du public et des équipes** : d&b rappelle que des niveaux d'environ 95 dB SPL, qui semblent sans danger, peuvent provoquer des troubles auditifs en cas d'exposition prolongée [6]. En France, la réglementation sur les sons amplifiés (décret 2017-1244) n'a pas été consultée dans cette session.

## Lien avec le matériel (Equipment links)
- Line arrays et subs : `l-acoustics-k2`, `l-acoustics-kara-ii`, `l-acoustics-ks28`, `l-acoustics-a15-focus` ; retours `l-acoustics-x15-hiq`, `l-acoustics-x8`.
- Enceintes actives (point source et wedge) : `qsc-k12-2`, `yamaha-dbr12`.
- Amplificateurs et contrôleurs : `l-acoustics-la12x`, `l-acoustics-la4x`, `l-acoustics-la7-16`, `db-audiotechnik-d80`, `db-audiotechnik-d40`, `nexo-nxamp4x4mk2`, `crown-xls-2502` (ampli générique, pour comparer).
- Matrices et distribution : `db-audiotechnik-ds10`, `db-audiotechnik-ds20`.
- Règles TekPractice : R2 (niveau haut-parleur et niveau ligne), R3 (sens du signal).

## Pour aller plus loin (Best sources)
- [6][7] Manuels d&b V8/V12 et V-SUB **en français** : vocabulaire officiel (angles de couplage, CPL, HFC, cardioïde, isobares).
- [9] Mouterde et al., AES 2024 : explication rigoureuse et chiffrée de l'alignement main/sub.
- [10] Moulin et Corteel, AES 2022 : effet de précédence et filtrage en peigne entre système principal et rappels.
- [11] Livre blanc L-Acoustics sur la mesure en basse fréquence : bonnes pratiques de mesure.
- [1][2][3] sengpielaudio : calculateurs fiables pour vérifier les exercices (distance, dB, peigne).
- [4][5] Wikipedia : rappels généraux (ligne source, vitesse du son), à recouper avec un manuel de physique acoustique.

## Sources
1. E. Sengpiel, *Damping of sound level with distance* (calculator), sengpielaudio, https://www.sengpielaudio.com/calculator-distance.htm, accessed 2026-10-22, verified-secondary
2. E. Sengpiel, *Decibel calculator*, sengpielaudio, https://www.sengpielaudio.com/calculator-db.htm, accessed 2026-10-22, verified-secondary
3. E. Sengpiel, *Comb filter calculator*, sengpielaudio, https://www.sengpielaudio.com/calculator-combfilter.htm, accessed 2026-10-22, verified-secondary
4. Wikipedia, *Line array*, https://en.wikipedia.org/wiki/Line_array, accessed 2026-10-22, verified-secondary
5. Wikipedia, *Speed of sound*, https://en.wikipedia.org/wiki/Speed_of_sound, accessed 2026-10-22, verified-secondary
6. d&b audiotechnik, *Manuel V8/V12* 1.8 fr, https://www.dbaudio.com/assets/products/downloads/manuals-documentation/v-series/dbaudio-manual-v8-v12-1.8-fr.pdf, accessed 2026-10-22, verified-primary
7. d&b audiotechnik, *Manuel V-SUB* 1.5 fr, https://www.dbaudio.com/assets/products/downloads/manuals-documentation/v-series/dbaudio-manual-v-sub-1.5-fr.pdf, accessed 2026-10-22, verified-primary
8. NEXO, *GEO M10 User Manual* Rev03b, https://www.nexo-sa.com/wp-content/uploads/GEOM10-User-Manual-Rev03b-EN.pdf, accessed 2026-10-22, verified-primary
9. T. Mouterde, S. Moulin, N. Epain, E. Corteel, *On the perception of time-alignment between full-range speakers and subwoofers for sound reinforcement*, AES Int. Conf. on Acoustics & Sound Reinforcement, Le Mans, 2024, https://prdstglaxxwe001.blob.core.windows.net/webapp-lacoustics/Education/scientific_resources/scientific_publications/2024-On_the_perception_of_time-alignment_between_full-range_speakers_and_subwoofers_for_sound_reinforcement.pdf, accessed 2026-10-22, verified-primary
10. S. Moulin, E. Corteel, *Spectral and spatial perceptions of comb-filtering for sound reinforcement applications*, AES 152nd Convention, 2022, https://prdstglaxxwe001.blob.core.windows.net/webapp-lacoustics/Education/scientific_resources/scientific_publications/2022-Spectral_and_spatial_perceptions_of_comb-filtering_for_sound.pdf, accessed 2026-10-22, verified-primary
11. L-Acoustics, *How to improve measurement quality at low frequencies?* (white paper, 2020), https://prdstglaxxwe001.blob.core.windows.net/webapp-lacoustics/Education/scientific_resources/white_papers/WP-HOW_TO_IMPROVE_MEASUREMENT_QUALITY_AT_LOW_FREQUENCIES.pdf, accessed 2026-10-22, verified-primary
12. Meyer Sound, *LINA Operating Instructions*, https://docs-prod.meyersound.com/products/en/operating-instructions---lina.html, accessed 2026-10-22, verified-primary
