---
id: 01-acoustique-ondes-sonores
title_fr: Acoustique et ondes sonores
title_en: Acoustics and sound waves
bts_mapping:
  - epreuve: E3
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://www.francecompetences.fr/recherche/rncp/37196/
    # Bloc BC02 « Mise en œuvre des savoir-faire des métiers du son » vérifié sur la fiche RNCP37196.
    # Codes de savoirs non vérifiés : le PDF du référentiel (sti.eduscol) a renvoyé ECONNRESET à chaque essai.
    # E3 (Physique et technique des équipements et supports) est l'épreuve écrite où ces calculs (λ = c/f, loi en 1/r) sont évalués.
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://www.francecompetences.fr/recherche/rncp/37196/
    # E4 (pratique) : placement des micros et des enceintes, distance à la source, réflexions. Mapping par jugement pédagogique.
tekpractice_rules: []
last_checked: 2026-10-22
---

# Acoustique et ondes sonores (Acoustics and sound waves)

## En bref / In short
Le son est une variation de pression (sound pressure) qui se propage dans un milieu matériel, l'air dans la plupart des cas. Dans l'air, sa vitesse (célérité, speed of sound) dépend presque uniquement de la température : environ 331 m/s à 0 °C et 343 m/s à 20 °C [1]. La longueur d'onde (wavelength) relie la fréquence à une dimension physique, λ = c/f [2], et c'est elle qui explique comment le son interagit avec les obstacles, les murs et les micros. En champ libre, le niveau d'une source ponctuelle baisse d'environ 6 dB chaque fois que la distance double [3]. Dans une salle, le son direct se mélange aux réflexions (reflections) et à la réverbération (reverberation) [5].

## Notions clés (Key concepts)
- **Pression acoustique (sound pressure)** : petite variation de pression autour de la pression atmosphérique, mesurée en pascals (Pa). Le niveau en dB SPL se calcule par rapport à p0 = 20 µPa ; 1 Pa correspond à environ 94 dB SPL [4]. Voir le fichier 02 pour les décibels.
- **Célérité (speed of sound)** : environ 343 m/s dans l'air à 20 °C. La pression atmosphérique n'intervient pas et l'humidité a un effet négligeable ; la température est le facteur qui compte [1]. Les cours retiennent souvent 340 m/s pour simplifier, comme l'exemple de DPA [6].
- **Fréquence et période (frequency, period)** : f en hertz (Hz), T = 1/f en secondes [2].
- **Longueur d'onde (wavelength)** : distance parcourue pendant une période. Avec c = 343 m/s, 20 Hz donne environ 17 m, 1 kHz environ 34 cm et 20 kHz environ 1,7 cm (calcul à partir de [2]).
- **Champ libre (free field)** : espace sans réflexions (chambre anéchoïque, plein air dégagé). La loi de distance n'est exacte que là [3].
- **Source ponctuelle et source linéaire (point source, line source)** : une source ponctuelle rayonne une onde sphérique (−6 dB par doublement de distance). Une source linéaire rayonne une onde cylindrique (environ −3 dB par doublement). Un line array fini se comporte comme une source ponctuelle dans le grave [3].
- **Puissance et pression (sound power vs sound pressure)** : le niveau de puissance acoustique d'une source (LW) ne change pas avec la distance ; c'est le niveau de pression au point d'écoute qui baisse [3].
- **Réflexion (reflection)** : une surface dure renvoie l'énergie. Une réflexion unique qui s'ajoute au son direct crée un filtrage en peigne (comb filtering), avec des creux et des pics dans la réponse en fréquence [6]. Dans une régie, l'EBU appelle « réflexions précoces » (early reflections) celles qui arrivent dans les 15 premières ms après le son direct ; la table de mixage en est une source importante [5].
- **Diffraction** : une onde contourne un obstacle petit devant sa longueur d'onde. C'est pourquoi un écran doit être très grand pour arrêter les basses fréquences [6], et pourquoi un écran dans une pièce est contourné par l'énergie réfléchie par les parois [8].
- **Absorption** : un matériau absorbant transforme une partie de l'énergie en chaleur. Le coefficient d'absorption α va de 0 (réflexion totale) à 1 [6] et dépend fortement de la fréquence : une moquette sur béton passe d'environ 0,02 à 125 Hz à 0,65 à 4 kHz [7]. Voir le fichier 13.
- **Ondes stationnaires (standing waves)** : entre deux parois parallèles, certaines fréquences se renforcent ou s'annulent selon la position. DPA donne l'exemple de deux murs à 2,5 m : première onde stationnaire vers 68 Hz, avec des écarts de 20 à 30 dB selon l'endroit [6]. Voir le fichier 13.

## Formules (Formulas)
- **Célérité en fonction de la température** : c = 331,3 · √(1 + θ/273,15) ; approximation entre −35 °C et +35 °C : c ≈ 331,3 + 0,6·θ. c en m/s, θ en °C. Environ +0,6 m/s par degré [1].
- **Longueur d'onde** : λ = c / f, avec λ en m, c en m/s, f en Hz. Période : T = 1/f (s) [2].
- **Niveau de pression** : Lp = 20·log10(p / p0), p0 = 20 µPa. Lp en dB SPL, p en Pa [4].
- **Loi de distance, source ponctuelle en champ libre** : L2 = L1 − 20·log10(r2 / r1). Doubler la distance donne environ −6 dB (100 dB à 1 m → environ 94 dB à 2 m) [3].
- **Source linéaire (onde cylindrique)** : L2 = L1 − 10·log10(r2 / r1), soit environ −3 dB par doublement [3].

## Erreurs fréquentes (Common mistakes)
- **Appliquer −6 dB par doublement partout.** La loi ne vaut qu'en champ libre et pour une source ponctuelle. Dans une salle, loin de la source, le champ réverbéré domine et le niveau baisse beaucoup moins vite [3][8].
- **Confondre intensité et pression.** L'intensité varie en 1/r², la pression en 1/r. Les deux donnent la même chute de niveau en dB (−6 dB par doublement) car on prend 10·log pour l'intensité et 20·log pour la pression [3][4].
- **Croire que la pression ou l'altitude changent la vitesse du son.** Seule la température compte en pratique [1].
- **Oublier l'absorption de l'air.** À grande distance, les aigus sont atténués en plus de la loi de distance ; cet effet se calcule à part [3].
- **Oublier la longueur d'onde.** Un panneau mince ou un petit écran n'a presque aucun effet dans le grave, où λ se mesure en mètres [2][6].
- **Placer un micro près d'une surface réfléchissante** (pupitre, table, mur) sans y penser : la réflexion produit un filtrage en peigne [6].

## Lien avec le matériel (Equipment links)
- `earthworks-m23` (micro de mesure) : mesure de réponse en fréquence et de niveau dans une salle.
- `l-acoustics-k2`, `l-acoustics-kara-ii`, `meyer-sound-lina` (line arrays) : comportement en source linéaire et limite dans le grave [3].
- `genelec-8030c`, `neumann-kh-120-ii` : enceintes de contrôle, sensibles aux réflexions précoces de la console [5].
- Règles TekPractice : pas de règle R1-R8 directement liée. Ce fichier sert de socle à la R6 (larsen) via la distance micro/enceinte, mais il ne la porte pas.

## Pour aller plus loin (Best sources)
- [1][2][3][4] **sengpielaudio** : calculateurs clairs, avec les formules et leurs conditions de validité. Bon pour vérifier un exercice. C'est une source secondaire (Eberhard Sengpiel, UdK Berlin).
- [5] **EBU Tech 3276** : document primaire et gratuit sur le son direct, les réflexions précoces et la réverbération en régie. À lire pour le vocabulaire professionnel.
- [6] **DPA Mic University** : explications courtes pour preneurs de son (ondes stationnaires, absorbants, filtrage en peigne, diffusion).
- [7] Table de coefficients d'absorption (sengpielaudio), pour les exercices de calcul.
- [8] **CIDB, fiche A4** : en français ; explique champ direct, champ réverbéré et écrans.

## Sources
1. « Speed of sound calculator – temperature », sengpielaudio, http://www.sengpielaudio.com/calculator-speedsound.htm, accessed 2026-10-22, verified-secondary
2. « Frequency to wavelength conversion », sengpielaudio, http://www.sengpielaudio.com/calculator-wavelength.htm, accessed 2026-10-22, verified-secondary
3. « Damping (decrease) of sound level with distance », sengpielaudio, http://www.sengpielaudio.com/calculator-distance.htm, accessed 2026-10-22, verified-secondary
4. « Sound level SPL, pressure, pascal, and intensity level conversion », sengpielaudio, http://www.sengpielaudio.com/calculator-soundlevel.htm, accessed 2026-10-22, verified-secondary
5. EBU Tech 3276 (1998), « Listening conditions for the assessment of sound programme material: monophonic and two-channel stereophonic », EBU, https://tech.ebu.ch/files/live/sites/tech/files/shared/tech/tech3276.pdf, accessed 2026-10-22, verified-primary
6. « 10 important facts about acoustics for microphone users », DPA Microphones, Mic University, https://www.dpamicrophones.com/mic-university/background-knowledge/10-important-facts-about-acoustics-for-microphone-users/, accessed 2026-10-22, verified-primary (manufacturer education)
7. « Absorption coefficients of building materials and finishes », sengpielaudio, http://www.sengpielaudio.com/calculator-RT60Coeff.htm, accessed 2026-10-22, verified-secondary
8. Fiche A4 « Les grands principes de traitement acoustique d'un local », CIDB (Centre d'information sur le bruit), https://www.bruit.fr/images/stories/pdf/A4_correction_acoustique.pdf, accessed 2026-10-22, verified-secondary
