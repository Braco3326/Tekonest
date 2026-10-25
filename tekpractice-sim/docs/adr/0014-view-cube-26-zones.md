# ADR-0014 — Cube de vue 26 zones

- **Status:** Accepté par défaut — en attente de validation d'Oscar (reconstruction « Mode Création », Task 16).
- **Sources :** brief `docs/plans/2026-10-24-creative-mode-brief.md` §3 ; audit `docs/audit/2026-10-24-creative-audit.md` (CA-05) ; conseil `docs/audit/2026-10-24-council.md` (C11) ; ADR-0011 (navigation du designer).
- **Inspiration :** le *modèle d'interaction* des outils pro de conception acoustique (un petit cube en haut à gauche de la vue 3D, cliquable par face, arête et coin). Aucun graphisme, icône, libellé, code ni nom n'en est repris, et aucune capture d'un tel outil n'entre dans le dépôt.

## Contexte

Le cube de vue historique (ADR-0011) offre 10 vues nommées (4 côtés, 4 trois-quarts, Dessus, Dessous). Le brief demande les 26 directions d'un cube : 6 faces, 12 arêtes, 8 coins, atteignables à la souris (clic), au clavier (`V` + flèches) et par glisser (orbite). Cette tâche ne livre que le **modèle pur** ; le rendu et les événements viennent en Phase 2.

## Décision

- **Repère du cube.** x = droite (+) / gauche (−), y = dessus (+) / dessous (−), z = face (+) / arrière (−). « Droite » est la droite vue depuis le public à la pose Face.
- **Classifieur analytique.** `classifyHit(local, threshold = 0.5)` : le point d'impact, ramené dans [−0,5 ; 0,5]³, est doublé et chaque axe est coupé en trois bandes (|v| > 0,5 donne ±1, sinon 0 ; la valeur 1 exacte sur la face touchée donne toujours ±1). Face = 1 axe non nul, arête = 2, coin = 3. Aucun mesh par zone : une seule boîte, un seul pick, 26 zones calculées. `zoneBox` donne la boîte de survol (en unités locales du cube, 0,01 au-dessus de la surface).
- **Angles.** `zoneAngles` renvoie (alpha, beta) pour la caméra ; `nearestZone` en est l'inverse (bandes d'élévation 25° et 70°), testé sur les 26 zones. Les coins sont à l'élévation isométrique vraie (acos(1/√3) ≈ 54,7°), les arêtes à 45°, les faces latérales à `FACE_BETA`.
- **Pôles « nord en haut ».** Dessus et Dessous gardent le cap de la vue Face (alpha de Face) : l'avant de la scène reste en haut de l'écran.
- **Menu `V`.** `viewPicker.ts` : 8 azimuts × 5 élévations, pôles réduits à une cellule chacun (8 × 3 + 2 = 26). Gauche/Droite font le tour des azimuts, Haut/Bas changent d'élévation ; depuis un pôle, Bas/Haut revient au bord Face.
- **Rendu (Phase 2, décision C11).** Une seconde caméra Babylon avec son propre viewport (coin haut gauche) et un layer mask ne voyant que le cube, sur le même `Engine`. Taille 120 px à 1366 px de large, 130 px à partir de 1600 px. Glisser = orbite de la caméra principale.
- **Étiquettes.** `zoneLabel` renvoie le français (« Dessus · Face », « Arrière · Gauche »…), joint par « · ». Rédaction à relire par tekuxwriter.

## Gauche et droite : convention conservée

Babylon est main gauche : à la pose Face (caméra à +z, regard vers −z), le +x du monde est à gauche de l'écran, et une hausse d'alpha déplace la caméra vers sa propre droite. Le plan de tâche note « x du cube = −(x Babylon) », ce qui revient à la même chose. Le code réutilise donc `SIDE_SIGN = 1` et `DEFAULT_FRONT_ALPHA` de `viewCube.ts`, déjà prouvés par l'e2e `viewCube.spec.ts` (décision N14) : Droite = alpha de Face + π/2. Rien n'est changé dans `viewCube.ts`.

## Pourquoi pas un second contexte WebGL

Un second `Engine` doublerait la mémoire GPU, les shaders compilés et les contextes (les navigateurs en plafonnent le nombre), et compliquerait la perte de contexte. Une seconde caméra sur la même scène, avec viewport et layer mask, coûte une passe de rendu de 12 triangles et partage tout le reste. Le rendu reste à la demande (pas de travail par image au repos).

## Pourquoi pas d'imagerie d'un outil existant

Seul le modèle d'interaction est repris ; l'habillage (Nuit, Papier, Ambre, angles droits, Tektur) est celui de Tekonest, et les libellés sont les nôtres.

## Conséquences

- Les 10 vues historiques sont un sous-ensemble des 26 zones ; `viewCube.ts` reste utilisé tel quel par le sandbox historique.
- Les zones sont purement testables sans moteur ; le classifieur ne dépend d'aucun pick Babylon.
- Un survol à 0,5 de seuil donne aux faces une bande centrale de 50 % et aux arêtes/coins des cibles généreuses.
