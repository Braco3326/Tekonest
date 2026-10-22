---
id: 12-larsen-feedback
title_fr: Effet Larsen — mécanisme, gain acoustique potentiel et prévention
title_en: Acoustic feedback — mechanism, potential acoustic gain and prevention
bts_mapping:
  - epreuve: E3
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Référentiel PDF injoignable (ECONNRESET). Le choix de directivité contre le larsen figure dans l'unité e3-u3 de la plateforme (annales E3)."
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Placement micros/retours, égalisation et 'ring out' sont des gestes de sonorisation évalués en pratique (E4); codes non lus."
tekpractice_rules: [R6]
last_checked: 2026-10-22
---

# Effet Larsen (Acoustic feedback)

## En bref / In short
L'effet Larsen (acoustic feedback, howl) est une boucle de rétroaction positive : le microphone capte le son du haut-parleur qui diffuse ce même microphone, le système le réamplifie, et ainsi de suite [1]. L'oscillation démarre à une fréquence où le déphasage total de la boucle est un multiple de 360° et où le gain de boucle atteint 1 [1][2]. Le gain utilisable avant larsen (gain before feedback) est d'abord une affaire de géométrie (distances source–micro, micro–enceinte, enceinte–auditeur), modélisée par le gain acoustique potentiel (PAG, potential acoustic gain) [3]. On l'améliore par le placement, la directivité des micros et des enceintes, l'égalisation et, en dernier recours, par des filtres anti-larsen [4][2]. Le phénomène porte le nom du physicien danois Søren Larsen [1][5].

## Notions clés (Key concepts)
- **Condition d'accrochage** : gain de boucle ≥ 1 à une fréquence où la phase de boucle est nulle (multiple de 360°) ; le bruit à cette fréquence croît jusqu'à ce que l'écrêtage ramène le gain à 1 [1]. Rane : le larsen est « à la fois une question d'amplitude et de phase » [2].
- **Une seule fréquence qui « sonne »** : quand on monte trop le gain, le système produit une seule hauteur, celle que le couple système/salle amplifie le plus ; une réponse en fréquence plus plate donne plus de gain disponible, d'où l'égalisation [6].
- **Marge de sécurité** : au gain maximal théorique, le son renvoyé au micro égale le son d'origine ; en pratique, rester au moins ≈ 3 dB en dessous [6][7].
- **Vitesse de croissance** : avec 10 ms de délai de boucle et +0,5 dB de gain par tour, le larsen croît de ≈ 50 dB/s [2].
- **Facteurs géométriques (PAG)** : on gagne en éloignant l'enceinte du micro, en rapprochant l'enceinte de l'auditeur, en rapprochant la source du micro [4]. Rapprocher la source de moitié donne ≈ +6 dB de PAG [8].
- **Limite de la distance critique** : éloigner l'enceinte du micro ne sert plus au-delà de la distance critique, où le champ réverbéré égale le champ direct [4].
- **Nombre de micros ouverts (NOM, number of open mics)** : chaque doublement du NOM coûte ≈ 3 dB de PAG [8].
- **Directivité des micros** : placer le retour de scène (wedge) dans le zéro du diagramme. Angles DPA : nul à 180° pour le cardioïde, vers ± 135° pour le supercardioïde, ± 115° pour l'hypercardioïde (lobe arrière en polarité inversée) [9]. Voir 04-microphones.
- **Omni vs directif** : les directifs décrochent souvent en aigu et brutalement ; les omnis plutôt en bas-médium/grave et plus progressivement ; un omni permet un gain avant larsen plus constant sur scène quand l'artiste bouge [10]. Couvrir la grille avec la main (cupping) augmente le risque de larsen [11].
- **Directivité des enceintes** : utiliser des enceintes plus directives fait partie des moyens « techniques » d'augmenter le PAG [4].
- **Moniteurs intra-auriculaires (IEM, in-ear monitors)** : ils suppriment les retours au sol, donc un chemin enceinte → micro très court. Bénéfice logique non chiffré dans une source lue (gap).
- **Coupure des écoutes à l'ouverture du micro (monitor mute)** : en studio radio, les écoutes de régie sont coupées automatiquement quand le micro de la même pièce est ouvert ; c'est la règle TekPractice R6 (source interne `catalog.json`, pas de source externe vérifiée cette session).
- **Filtres anti-larsen (feedback suppressors)** : ils placent automatiquement des filtres coupe-bande (notch), décalent légèrement la fréquence (frequency shift) ou utilisent des algorithmes adaptatifs [1]. Rane : un auto-notch apporte typiquement seulement « quelques dB » de gain supplémentaire ; un modèle à filtre adaptatif peut dépasser 10 dB ; un décalage de 6–12 Hz a donné ≈ 2 dB dans une salle sèche et près de 6 dB dans une salle réverbérante [2].
- **Réglage des notchs** : préférer des notchs larges et peu profonds (« quelques dB, pas des dizaines ») ; un notch automatique de 20 dB ou plus signale un problème ; placer les filtres après tous les réglages qui affectent la phase (délais, filtrage) ; filtres fixes alloués avant les filtres flottants [2].

## Formules (Formulas)
- **Gain acoustique potentiel** (modèle simplifié : sources et micros omnidirectionnels, décroissance en 1/r², sans réverbération) [3] :
  PAG = 20·log10[(D1 / Ds) · (D0 / D2)] en dB,
  avec Ds = distance source → micro, D1 = distance micro → enceinte, D0 = distance source → auditeur, D2 = distance enceinte → auditeur (mêmes unités). Sens : augmenter D1, diminuer Ds et D2 augmente le gain possible.
  Exemple (valeurs par défaut du calculateur HyperPhysics) : Ds = 2 ft, D1 = 32 ft, D0 = 128 ft, D2 = 128 ft → PAG = 20·log10(16 × 1) ≈ 24 dB [3]. Retirer ≈ 3 dB de marge de sécurité [7].
- **Effet du nombre de micros ouverts** : −3 dB par doublement du NOM, soit ΔPAG = −10·log10(NOM) [8] (source secondaire ; forme logarithmique déduite de la règle des 3 dB).
- **Fréquences candidates au larsen** (phase de boucle nulle) : espacement Δf = 1 / t_délai (t en s, f en Hz) ; Rane donne la relation générale t = −Δφ / (Δf × 360) [2]. Sens : plus le trajet enceinte → micro est long, plus les fréquences candidates sont rapprochées.
- **Décroissance en champ libre** : −6 dB par doublement de distance pour une source ponctuelle [7][12].
- Équation NAG (needed acoustic gain) : non trouvée dans une source lue (gap) ; ne pas l'enseigner sans référence (ex. Davis & Jones, *The Sound Reinforcement Handbook*, cité par [8], non consulté).

## Erreurs fréquentes (Common mistakes)
- Pointer le micro vers le retour ou la façade : il faut orienter le zéro de captation vers la source de larsen [1][9].
- Croire qu'un hypercardioïde rejette tout ce qui est derrière : son lobe arrière capte le retour placé à 180° ; un cardioïde y est meilleur [9].
- Tenir le micro par la grille (cupping) : la directivité s'effondre [11].
- Corriger le larsen par des notchs très étroits et profonds en cascade : préférer des coupes larges et modérées, après avoir réglé délais et filtrages [2].
- Multiplier les micros ouverts « au cas où » : chaque doublement coûte ≈ 3 dB [8] ; couper les micros inutilisés.
- Laisser les écoutes de régie actives micro ouvert dans la même pièce (R6).
- Compter sur l'éloignement de l'enceinte au-delà de la distance critique [4].

## Lien avec le matériel (Equipment links)
- Anti-larsen / mixage automatique : `dbx-afs2`, `shure-scm820`.
- Micros : `shure-sm58` (cardioïde), `shure-beta-58a` (supercardioïde), `ev-re50` (omni).
- Retours : `yamaha-dbr12` (wedge actif), IEM `shure-psm-300`, `shure-psm-900`, `sennheiser-ew-iem-g4`.
- Radio : `axia-iq` (contrôle `monitor-mute`, écoutes `isMonitorOut`), `genelec-8030c`.
- TekPractice **R6** : ouvrir un micro dans la pièce où des sorties `isMonitorOut` sont actives doit les couper, sinon « feedback loop detected ».

## Pour aller plus loin (Best sources)
- [3][4][6][7] HyperPhysics (Georgia State University) : modèle géométrique du PAG avec calculateur interactif, parfait pour un TD.
- [2] RaneNote 158 *Understanding Acoustic Feedback & Suppressors* : phase, vitesse de croissance, efficacité réelle des notchs/décalage de fréquence.
- [9][10][11] DPA : choix de directivité et comportement omni/directif vis-à-vis du larsen.
- [1][5] Wikipedia (EN/FR) : historique (Larsen, Fletcher 1926, Boner) et vue d'ensemble ; source secondaire.

## Sources
1. Wikipedia, "Audio feedback", https://en.wikipedia.org/wiki/Audio_feedback, accessed 2026-10-22, verified-secondary
2. Rane (Dana Troxel), "RaneNote 158 – Understanding Acoustic Feedback & Suppressors", https://www.ranecommercial.com/legacy/note158.html, accessed 2026-10-22, verified-primary
3. C. R. Nave, "Potential Acoustic Gain", HyperPhysics, Georgia State University, http://hyperphysics.phy-astr.gsu.edu/hbase/audio/pag.html, accessed 2026-10-22, verified-primary
4. C. R. Nave, "Increasing Potential Acoustic Gain", HyperPhysics, http://hyperphysics.phy-astr.gsu.edu/hbase/audio/pagi.html, accessed 2026-10-22, verified-primary
5. Wikipédia, "Effet Larsen", https://fr.wikipedia.org/wiki/Effet_Larsen, accessed 2026-10-22, verified-secondary
6. C. R. Nave, "Feedback in Sound Amplification Systems", HyperPhysics, http://hyperphysics.phy-astr.gsu.edu/hbase/audio/fback.html, accessed 2026-10-22, verified-primary
7. C. R. Nave, "Sound Amplification Systems", HyperPhysics, http://hyperphysics.phy-astr.gsu.edu/hbase/audio/pa.html, accessed 2026-10-22, verified-primary
8. Wikipedia, "Gain before feedback" (cites Shure, *Microphone Techniques: Live Sound Reinforcement*, 2007), https://en.wikipedia.org/wiki/Gain_before_feedback, accessed 2026-10-22, verified-secondary
9. DPA Microphones, "Listen to your polar pattern", https://www.dpamicrophones.com/mic-university/technology/listen-to-your-polar-pattern/, accessed 2026-10-22, verified-primary
10. DPA Microphones, "Directional vs. omnidirectional microphones", https://www.dpamicrophones.com/mic-university/technology/directional-vs-omnidirectional-microphones/, accessed 2026-10-22, verified-primary (manufacturer claims)
11. DPA Microphones, "15 points to consider when choosing a vocal mic", https://www.dpamicrophones.com/mic-university/background-knowledge/15-points-to-consider-when-choosing-a-vocal-mic/, accessed 2026-10-22, verified-primary
12. DPA Microphones, "Proximity effect in microphones explained" (6 dB per doubling for a point source), https://www.dpamicrophones.com/mic-university/background-knowledge/proximity-effect-in-microphones-explained/, accessed 2026-10-22, verified-primary
