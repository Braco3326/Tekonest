---
id: 13-acoustique-des-salles
title_fr: Acoustique des salles, traitement et isolation
title_en: Room acoustics, treatment and sound insulation
bts_mapping:
  - epreuve: E3
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://www.francecompetences.fr/recherche/rncp/37196/
    # Bloc BC02 vérifié sur la fiche RNCP37196. Codes de savoirs non vérifiés : le PDF du référentiel (sti.eduscol) a renvoyé ECONNRESET.
    # Le calcul du TR60 avec Sabine et les modes propres font partie de l'écrit E3 (cf. unit1-acoustique.ts, exercices TR60).
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://www.francecompetences.fr/recherche/rncp/37196/
    # E4 : choix d'un lieu de prise de son, placement des enceintes et du point d'écoute, traitement d'une régie. Mapping par jugement pédagogique.
tekpractice_rules: [R6]
last_checked: 2026-10-22
---

# Acoustique des salles, traitement et isolation (Room acoustics, treatment and sound insulation)

## En bref / In short
Dans une salle, l'auditeur reçoit le son direct, puis les réflexions précoces (early reflections), puis le champ réverbéré (reverberant field) [1]. Le temps de réverbération (reverberation time, RT60 ou TR60) est la durée nécessaire pour que le niveau baisse de 60 dB ; on l'estime avec la formule de Sabine à partir du volume et de l'aire d'absorption équivalente [2][3]. Dans le grave, les dimensions de la pièce créent des modes propres (room modes) qui rendent la réponse très inégale selon la position [4][5]. Il faut bien séparer deux métiers : la **correction acoustique** (traitement intérieur : absorption, diffusion) et l'**isolation acoustique** (empêcher le son de passer d'un local à l'autre) [3][6].

## Notions clés (Key concepts)
- **Son direct, réflexions précoces, réverbération** : l'EBU appelle réflexions précoces celles qui arrivent dans les 15 ms après le son direct ; la réverbération correspond aux réflexions plus tardives [1].
- **Temps de réverbération (RT60)** : temps pour que le son décroisse de 60 dB. On le mesure en pratique sur une partie de la décroissance (5 à 25 dB sous le niveau initial selon l'EBU, ou 10, 20, 30 dB selon sengpielaudio) puis on extrapole [1][2]. Il dépend de la fréquence [1][2].
- **Aire d'absorption équivalente (equivalent absorption area, A)** : somme des surfaces multipliées par leur coefficient d'absorption, en m² Sabine [2].
- **Coefficient d'absorption (α)** : de 0 (réflexion totale) à 1 [5]. Exemples à 125 Hz / 1 kHz / 4 kHz : brique non vitrifiée 0,03 / 0,04 / 0,07 ; vitrage 0,35 / 0,12 / 0,04 ; moquette sur béton 0,02 / 0,37 / 0,65 ; rideau lourd 0,14 / 0,72 / 0,65 ; laine de verre 5 cm environ 0,17 / 0,90 / 0,80 [7]. Pour un local nu non traité, le CIDB propose une valeur moyenne de 0,1 [3].
- **Types d'absorbants** : poreux, efficaces dans l'aigu (α > 0,7), et jusqu'à environ 100 Hz s'ils sont décollés de 25 à 30 cm d'une paroi ; résonateurs, surtout dans le médium (200 Hz à 5 kHz) ; membranes, pour le grave (α de 0,2 à 0,3 à la résonance) [5].
- **Diffusion** : les diffuseurs répartissent l'énergie au lieu de l'absorber. Pour une régie, DPA conseille des diffuseurs efficaces au-dessus d'environ 600 à 800 Hz [5]. L'EBU demande un champ réverbéré assez diffus pour éviter les échos flottants (flutter echoes) [1].
- **Valeurs cibles** : DPA cite, à 500 Hz, 0,1-0,2 s pour une cabine voix, 0,2-0,3 s pour une régie, 0,4-0,6 s pour un studio d'enregistrement, 1,8-2,2 s pour une salle de concert classique [5]. L'EBU demande pour une régie un TR nominal Tm (moyenne des tiers d'octave de 200 Hz à 4 kHz) compris entre 0,2 et 0,4 s [1].
- **Exigences EBU pour une régie** : réflexions précoces au moins 10 dB sous le son direct de 1 à 8 kHz ; bruit de fond de préférence sous la courbe NR 10 et jamais au-dessus de NR 15 ; le plateau de la console est une source importante de réflexions précoces [1].
- **Modes propres (room modes)** : ondes stationnaires dans le grave. Les modes axiaux (deux parois parallèles) sont les plus forts ; les tangentiels (quatre parois) sont environ 3 dB plus faibles, les obliques (six parois) environ 6 dB plus faibles [4]. Selon la position, une fréquence peut être 20 à 30 dB plus faible qu'ailleurs [5].
- **Champ direct et champ réverbéré** : ajouter de l'absorption baisse le niveau du champ réverbéré mais ne change pas le champ direct. Près de la source, l'absorption est donc presque inefficace ; loin de la source, le gain est limité à « l'amplification du local », souvent quelques dB (environ 4 dB à 4 m dans l'exemple du CIDB) [3].
- **Écran acoustique** : un écran entre une source et un point d'écoute est contourné par l'énergie réfléchie par les parois. Il marche près de la source et se combine avec un traitement absorbant [3].
- **Isolation (isolement) entre locaux** : le son passe par la paroi de séparation, mais aussi par les parois latérales (jusqu'à 13 voies de transmission) et par des fuites (trous, gaines, joints). Il faut diagnostiquer les voies principales avant de renforcer la cloison [6].
- **Indice d'affaiblissement (R) et isolement (D)** : R caractérise une paroi seule, mesurée en laboratoire sans transmissions latérales ; l'isolement réel entre deux locaux est souvent plus faible de plus de 5 dB [6].
- **Point faible d'une paroi** : une porte ou un trou limite l'isolation globale. Exemple CIDB : 8 m² de béton (R = 45 dB) avec une porte de 2 m² (R = 20 dB) donnent R ≈ 27 dB, et doubler la cloison ne change rien tant que la porte reste la même [6].

## Formules (Formulas)
- **Sabine** : RT60 = 0,161 · V / A, avec RT60 en s, V en m³, A en m². La constante vient de 24·ln(10)/c, avec c = 343 m/s [2]. Le CIDB et beaucoup de cours arrondissent à 0,16 [3].
- **Aire d'absorption équivalente** : A = Σ αi · Si, avec Si en m² [2].
- **Absorption à ajouter** : A = 0,16 · V / T (A souhaitée), puis A − A0, où A0 = 0,1 × surface totale des parois pour un local nu [3].
- **TR conseillé pour un local de parole** (500-1000 Hz) : T ≈ 0,1 · V^(1/3) ; on tolère 30 % de plus dans le grave [3].
- **TR nominal d'une régie EBU** : Tm = 0,25 · (V / V0)^(1/3) s, avec V0 = 100 m³, dans la plage 0,2 < Tm < 0,4 s [1].
- **Mode axial** : f1 = c / (2L), et fk = k · c / (2L) pour les harmoniques (L = distance entre parois parallèles, en m) [4][5]. Formule générale : f = (c/2)·√((nx/L)² + (ny/B)² + (nz/H)²), avec L, B, H = longueur, largeur, hauteur (m) et nx, ny, nz entiers ; c = 343 m/s à 20 °C [4].
- **Isolement brut** : D = L1 − L2 (dB) ; **normalisé** : Dn = L1 − L2 − 10·log10(A / A0), A0 = 10 m² ; **standardisé** : DnT = L1 − L2 + 10·log10(T / T0), T0 = 0,5 s [6].
- **Indice d'affaiblissement** : R = L1 − L2 − 10·log10(A / S), S = surface de la paroi [6].
- **Indice limite avec un élément figé** : Rlim = R2 − 10·log10(S2 / S) [6].

## Erreurs fréquentes (Common mistakes)
- **Confondre isolation et correction.** De la mousse sur les murs réduit la réverbération mais n'empêche pas le son de sortir ni d'entrer. L'isolation dépend des parois, des jonctions et des fuites [3][6].
- **Traiter seulement l'aigu.** Une mousse mince absorbe surtout l'aigu ; le grave demande des absorbants épais et décollés, ou des membranes [5][7]. Une salle « trop mate » dans l'aigu et boomy dans le grave est un résultat typique.
- **Oublier que le TR dépend de la fréquence.** Donnez toujours la bande (500 Hz, 1 kHz…) ou la moyenne utilisée [1][2].
- **Compter sur l'absorption pour baisser le niveau près d'une source.** Près de la source, c'est le champ direct qui domine [3].
- **Renforcer une cloison sans traiter la porte.** L'indice global est limité par le point faible [6].
- **Placer le point d'écoute ou un micro au hasard dans une petite pièce.** Les modes propres créent des creux et des bosses de 20 à 30 dB dans le grave selon la position [5].
- **Utiliser Sabine dans une salle très absorbante sans réserve.** Les sources consultées ne détaillent pas cette limite (formule d'Eyring) ; considérez Sabine comme une estimation pour les salles assez réverbérantes.

## Lien avec le matériel (Equipment links)
- Enceintes de contrôle (placement, réflexions, modes) : `genelec-8030c`, `genelec-8341a`, `neumann-kh-120-ii`, `yamaha-hs8`, `adam-audio-a7v`.
- Micro de mesure (TR, réponse de la salle) : `earthworks-m23`.
- Réverbérations artificielles (TR simulés) : `bricasti-design-m7`, `lexicon-pcm96`.
- Règle TekPractice **R6** (larsen) : dans une salle réverbérante, le champ réverbéré renvoie plus d'énergie vers le micro, ce qui favorise le larsen. Lien pédagogique, pas une formule vérifiée. Voir aussi `dbx-afs2` (suppresseur de larsen).

## Pour aller plus loin (Best sources)
- [1] **EBU Tech 3276** : exigences chiffrées pour une régie (TR, réflexions précoces, bruit de fond, niveau d'écoute). Document primaire et gratuit.
- [3][6] **Fiches CIDB A4 et A5** : en français, avec des exemples chiffrés (classe, restaurant, cloison avec porte). Très bonnes pour les exercices.
- [5] **DPA** : version courte et pratique (cibles de TR, types d'absorbants, diffuseurs).
- [2][4][7] **sengpielaudio** : calculateurs RT60 et modes propres, table de coefficients d'absorption.

## Sources
1. EBU Tech 3276 (1998), « Listening conditions for the assessment of sound programme material: monophonic and two-channel stereophonic », EBU, https://tech.ebu.ch/files/live/sites/tech/files/shared/tech/tech3276.pdf (page : https://tech.ebu.ch/publications/tech3276), accessed 2026-10-22, verified-primary
2. « Reverb time RT60 after Sabine calculation », sengpielaudio, http://www.sengpielaudio.com/calculator-RT60.htm, accessed 2026-10-22, verified-secondary
3. Fiche A4 « Les grands principes de traitement acoustique d'un local », CIDB, https://www.bruit.fr/images/stories/pdf/A4_correction_acoustique.pdf, accessed 2026-10-22, verified-secondary
4. « Room modes calculation – axial, tangential, and oblique modes », sengpielaudio, http://www.sengpielaudio.com/calculator-roommodes.htm, accessed 2026-10-22, verified-secondary
5. « 10 important facts about acoustics for microphone users », DPA Microphones, Mic University, https://www.dpamicrophones.com/mic-university/background-knowledge/10-important-facts-about-acoustics-for-microphone-users/, accessed 2026-10-22, verified-primary (manufacturer education)
6. Fiche A5 « Isolement acoustique entre deux locaux », CIDB, https://www.bruit.fr/images/stories/pdf/A5_isolement_acoustique.pdf, accessed 2026-10-22, verified-secondary
7. « Absorption coefficients of building materials and finishes », sengpielaudio, http://www.sengpielaudio.com/calculator-RT60Coeff.htm, accessed 2026-10-22, verified-secondary
