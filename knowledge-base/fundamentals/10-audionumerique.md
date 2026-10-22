---
id: 10-audionumerique
title_fr: "Audionumérique : échantillonnage, quantification, horloge et interfaces"
title_en: "Digital audio: sampling, quantisation, clocking and interfaces"
bts_mapping:
  - epreuve: E3
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Référentiel eduscol inaccessible (ECONNRESET). Shannon, repliement, quantification et débit sont des notions récurrentes des annales E3 PTES (voir l'unité e3-u4 de la plateforme)."
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Câbler une horloge maître/esclave et des liaisons AES3/MADI/ADAT fait partie de la mise en œuvre pratique (E4). Non vérifié dans le référentiel."
tekpractice_rules: [R2, R8]
last_checked: 2026-10-22
---

# Audionumérique (Digital audio)

## En bref / In short
Numériser un son, c'est le découper dans le temps (échantillonnage, sampling, à la fréquence fe) et en amplitude (quantification, quantisation, sur n bits). Le théorème de Shannon-Nyquist fixe la limite : on ne restitue correctement que les fréquences inférieures à fe/2 ; au-delà, elles se replient (repliement de spectre, aliasing) [1][2]. Le nombre de bits fixe le plancher de bruit de quantification, soit environ 6 dB de dynamique par bit [4][5]. Enfin, tous les appareils d'une chaîne numérique doivent partager **une seule horloge** (word clock) : deux maîtres, ou aucun, et l'on obtient clics, craquements et décrochages [7] (règle R8).

## Notions clés (Key concepts)
- **Fréquence d'échantillonnage (sample rate, fe)** : nombre d'échantillons par seconde ; 44,1 kHz (CD), 48 kHz (broadcast/vidéo), 96 et 192 kHz (vocabulaire de l'unité e3-u4).
- **Théorème d'échantillonnage (sampling theorem)** : un signal est exactement reconstructible s'il ne contient aucune énergie à fe/2 ou au-dessus [1].
- **Repliement (aliasing)** : une composante à fe/2 + ε réapparaît à fe/2 − ε, image « miroir » indiscernable d'un vrai signal [2]. D'où le **filtre anti-repliement (anti-aliasing filter)** avant le convertisseur A/N.
- **Quantification (quantisation)** : arrondi de chaque échantillon au palier le plus proche, de pas q. L'erreur est modélisée comme un bruit uniforme entre −q/2 et +q/2, de moyenne nulle et indépendant d'un échantillon à l'autre [3].
- **Résolution (bit depth)** : chaque bit vaut environ 6 dB de dynamique (20·log10 2) [4]. Le rapport signal/bruit idéal d'un convertisseur n bits se dégrade en pratique à cause des non-linéarités [5].
- **Dither** : petit bruit ajouté **avant une réduction de résolution** (24 → 16 bits) pour remplacer la distorsion d'arrondi par un souffle régulier et préserver les signaux très faibles. On l'applique une seule fois, en dernière étape ; la mise en forme du bruit (noise shaping) le rend moins audible [6].
- **Latence (latency)** : un tampon (buffer) de N échantillons retarde le signal de N/fe. Les convertisseurs A/N et N/A ajoutent leur propre délai : avec un suréchantillonnage de 64 ou 128 fois et le filtrage numérique, environ 1 ms par conversion, soit environ 2 ms pour un aller-retour N/A puis A/N [7].
- **Horloge (word clock)** : signal carré à la fréquence d'échantillonnage. Dans un studio, un seul appareil est maître (master) et tous les autres sont esclaves (slave) [7]. AES3, S/PDIF, ADAT et MADI transportent leur propre horloge (self-clocking), mais un câblage en boucle sans maître ne fonctionne pas [7].
- **Câblage word clock** : câble coaxial et BNC 75 Ω, distribution en guirlande avec des T et **une seule terminaison de 75 Ω au bout de la chaîne** ; une double terminaison (37,5 Ω) affaiblit le signal [7]. Un distributeur d'horloge est recommandé dans les grands studios [7].
- **Gigue (jitter)** : variations temporelles des fronts d'horloge. Une horloge reconstruite par PLL à partir d'un word clock lent (par exemple ×256 pour atteindre environ 11,2 MHz) est plus « gigueuse » qu'un quartz local. Un signal MADI porte environ 80 ns de gigue, qu'une bonne PLL réduit à environ 1 ns [7]. L'AES3 limite la gigue intrinsèque d'une sortie à 0,025 UI crête [8].
- **AES3 (AES/EBU)** : 2 canaux, mots de 16 à 24 bits, sous-trame de 32 intervalles (préambule, 24 bits audio, bits V, U, C et de parité), trame = 2 sous-trames, bloc = 192 trames pour les données d'état de canal (channel status) ; codage biphase-mark, insensible à la polarité ; liaison symétrique 110 Ω sur XLR [8].
- **S/PDIF** : variante grand public (IEC 60958-3, « consumer »). Le bit 0 de l'état de canal distingue « consumer » et « professional » ; relier les deux peut donner un fonctionnement imprévisible [8]. Transport électrique (coaxial) ou optique sur TOSLINK ; l'interface RME détecte automatiquement S/PDIF ou ADAT sur son entrée optique [7][9].
- **ADAT (optique)** : 8 canaux sur TOSLINK à 44,1 ou 48 kHz ; 4 canaux à 88,2 ou 96 kHz et 2 canaux à 176,4 ou 192 kHz par multiplexage d'échantillons (S/MUX, S/MUX4) [9].
- **MADI (AES10)** : jusqu'à 64 canaux à 48 kHz (56 sur les appareils anciens), 32 canaux à 96 kHz (S/MUX ou trame 96k), 16 à 192 kHz ; débit utile limité à 100 Mbit/s, 125 Mbit/s en ligne après codage ; coaxial BNC 75 Ω jusqu'à 100 m, fibre multimode (connecteurs SC) jusqu'à 2000 m [7].

## Formules (Formulas)
- **Condition de Shannon** : fe > 2·f_max (fe et f_max en Hz). Le signal doit être limité en dessous de fe/2 [1].
- **Fréquence repliée** : pour f = fe/2 + ε (avec ε ≤ fe/2), f_alias = fe/2 − ε, c'est-à-dire f_alias = fe − f. Exemple de la source : fe = 1000 Hz, une sinusoïde à 700 Hz apparaît à 300 Hz [2].
- **Puissance du bruit de quantification** : σ² = q²/12 (q = pas de quantification) ; valeur efficace q/(2√3), soit environ 0,3·q [3].
- **Dynamique par bit** : 20·log10(2) ≈ 6,02 dB par bit [4].
- **Rapport signal/bruit idéal** : SNR = 6,02·n + 1,76 dB, pour un convertisseur idéal de n bits et une sinusoïde pleine échelle [5]. Exemple : n = 16, SNR ≈ 98,1 dB ; n = 24, SNR ≈ 146,2 dB (valeur théorique jamais atteinte en pratique). Un défaut de linéarité différentielle de ½ LSB coûte environ 6 dB [5].
- **Latence d'un tampon** : t = N / fe (N en échantillons, t en s). Vérification avec la source : 64 échantillons à 44,1 kHz donnent environ 1,5 ms, à l'enregistrement comme à la lecture [7].
- **Niveaux électriques AES3** : impédance 110 Ω ± 20 % ; tension de sortie de 2 à 7 V crête à crête sur 110 Ω ; le récepteur doit décoder un œil de 200 mV minimum [8].

## Erreurs fréquentes (Common mistakes)
- **Deux horloges maîtres, ou aucune** : clics et décrochages. Correct : un maître (générateur dédié ou interface), tous les autres en esclave, à la même fréquence d'échantillonnage (règle R8) [7].
- **Fréquences différentes sur un même lien** (48 kHz d'un côté, 44,1 kHz de l'autre) : le récepteur ne se verrouille pas. Correct : même fe partout, ou convertisseur de fréquence (SRC).
- **Terminer chaque appareil de la guirlande word clock** : surcharge (2 × 75 Ω). Correct : une seule terminaison 75 Ω, sur le dernier appareil [7].
- **Câble XLR micro pour l'AES3 ou câble RCA audio pour le S/PDIF** : il faut une impédance de 110 Ω pour l'AES3 [8], et un câble 75 Ω (type vidéo RG59) pour le word clock et le MADI coaxial [7].
- **AES3 dans une entrée analogique** : on n'entend que du bruit (règle R2).
- **Croire que 96 kHz « s'entend mieux » par principe** : l'intérêt est surtout la marge du filtre anti-repliement et le traitement ; au-delà de 48 kHz, ADAT et MADI perdent des canaux [7][9].
- **Dither à chaque export intermédiaire** : un seul dither, à la fin, après tout changement de gain [6].
- **Oublier la latence des convertisseurs** : environ 1 ms par conversion, qui s'additionne aux tampons [7].

## Lien avec le matériel (Equipment links)
- Horloge maître : `antelope-ocx-hd` ; interfaces avec entrée/sortie word clock : `avid-hd-io`, `rme-fireface-ufx-iii`, `rme-fireface-802-fs`, `antelope-orion-32-plus-gen4`, `avid-protools-mtrx-studio`.
- ADAT et S/PDIF optiques : `rme-babyface-pro-fs`, `focusrite-scarlett-2i2-4th-gen` (pas d'ADAT : point de comparaison), `audient-id14-mkii`, `motu-828`.
- MADI : `rme-m-32-ad`, `rme-digiface-dante`, `directout-prodigy-mc`.
- AES3 sur réseau : `audinate-dante-avio-aes3`.
- Règles TekPractice : R8 (maître/esclave et fréquence d'échantillonnage), R2 (ne pas mélanger types numériques et analogiques).

## Pour aller plus loin (Best sources)
- [1]–[4] J. O. Smith III, *Mathematics of the DFT* (CCRMA, Stanford) : démonstrations claires du théorème d'échantillonnage, du repliement et du bruit de quantification ; idéal pour E3.
- [5] TI SLAA013 : dérivation complète de 6,02n + 1,76 dB à partir de q²/12.
- [7] Manuel RME HDSPe MADI FX : chapitres « Word Clock », « MADI Basics » et « Latency and Monitoring », très pédagogiques.
- [8] EBU Tech 3250 : la spécification AES/EBU, gratuite, avec la structure de trame et les niveaux électriques.
- [6] iZotope : explication accessible du dither (source secondaire).

## Sources
1. J. O. Smith III, *Mathematics of the DFT* – « Sampling Theorem », CCRMA Stanford (via DSPRelated), https://www.dsprelated.com/freebooks/mdft/Sampling_Theorem.html, accessed 2026-10-22, verified-primary
2. J. O. Smith III, *Mathematics of the DFT* – « Aliasing of Sampled Signals », https://www.dsprelated.com/freebooks/mdft/Aliasing_Sampled_Signals.html, accessed 2026-10-22, verified-primary
3. J. O. Smith III, *Mathematics of the DFT* – « Round-Off Error Variance », https://www.dsprelated.com/freebooks/mdft/Round_Off_Error_Variance.html, accessed 2026-10-22, verified-primary
4. J. O. Smith III, *Mathematics of the DFT* – « How Many Bits are Enough for Digital Audio? », https://www.dsprelated.com/freebooks/mdft/How_Many_Bits_Enough.html, accessed 2026-10-22, verified-primary
5. Texas Instruments, *Application Report SLAA013* (Mixed-Signal Products, 1995), https://www.ti.com/lit/an/slaa013/slaa013.pdf, accessed 2026-10-22, verified-primary
6. iZotope, *What is dithering in audio?*, https://www.izotope.com/en/learn/what-is-dithering-in-audio.html, accessed 2026-10-22, verified-secondary
7. RME, *HDSPe MADI FX User's Guide*, https://www.rme-audio.de/downloads/hdspemadifx_e.pdf, accessed 2026-10-22, verified-primary
8. EBU, *Tech 3250 – Specification of the digital audio interface (the AES/EBU interface)*, 3rd ed. 2004, https://tech.ebu.ch/docs/tech/tech3250.pdf, accessed 2026-10-22, verified-primary
9. RME, *Babyface Pro FS User's Guide*, https://www.rme-audio.de/downloads/bface_pro_fs_e.pdf, accessed 2026-10-22, verified-primary
