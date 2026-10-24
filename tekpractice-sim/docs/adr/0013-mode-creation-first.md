# ADR-0013 — Mode Création d'abord

- **Status:** Accepté par défaut — en attente de validation d'Oscar (reconstruction « Mode Création », Task 1).
- **Sources :** brief `docs/plans/2026-10-24-creative-mode-brief.md` §2 ; audit `docs/audit/2026-10-24-creative-audit.md` (CA-04 route de démarrage, CA-17 niveaux masqués) ; conseil `docs/audit/2026-10-24-council.md` (C1, C2) ; décision S4.
- **Inspiration :** le *modèle d'interaction* des outils pro de conception acoustique (grande vue 3D, menu, arbre de projet, propriétés). Aucun nom, graphisme, libellé ni code n'en est repris.

## Contexte

L'URL par défaut ouvrait le tableau de bord (ou l'accueil de première visite), puis des niveaux. L'audit relève que l'apprenant n'arrive jamais directement dans l'outil de création (CA-04) et que les niveaux et examens occupent la porte d'entrée (CA-17). Le brief demande un seul mode, « Mode Création » : choisir un lieu, placer et câbler du vrai matériel, écouter.

## Décision

- **Route (C1).** Un routeur d'entrée pur, `decideRoute(search, features)` dans `src/routing.ts`, renvoie `'creation'` ou `'legacy'`. `?level=…` (sandbox, examen, niveaux) et `?legacy=1` vont vers l'app historique ; toute autre URL va vers Mode Création.
- **Drapeau.** `FEATURES.levels = false` dans `src/features.ts` : les niveaux sont masqués derrière `?legacy=1`. Code et tests conservés. Les niveaux deviendront plus tard des « missions » dans Mode Création.
- **Strangler (C2).** Le corps de l'ancien `src/main.ts` est déplacé tel quel dans `src/legacyMain.ts`. `src/main.ts` devient un routeur minuscule qui charge dynamiquement l'une ou l'autre entrée. Aucun code de fonctionnalité nouveau dans `bootGame` ; l'extraction depuis `game.ts` se fait seulement quand le shell en a besoin, avec les e2e historiques verts après chaque déplacement.
- **Shell.** `src/creation/boot.ts` (`bootCreation`) est d'abord un talon : il masque `#renderCanvas` et affiche « Choisir un lieu ». Toutes les chaînes du shell vivent dans `src/creation/copy.ts` (rédaction : tekuxwriter).

## Conséquences

- Les URL historiques (`?level=…`, `?legacy=1`) se comportent exactement comme avant ; les e2e de l'accueil (`dashboard`, `onboarding`) utilisent `/?legacy=1`.
- Deux chunks d'entrée (`legacyMain` et `creation/boot`) au lieu d'un seul ; le chunk de démarrage de Mode Création devra rester ≤ celui du sandbox historique + 15 %.
- Aucun lien vers un niveau, l'onboarding ou le tableau de bord n'apparaît dans Mode Création.
- Réversible : `FEATURES.levels = true` renvoie l'URL par défaut vers l'app historique.

## Addendum (Task 10) — conventions de pose lues par l'acoustique

- **Inclinaison (`Placement.tiltDeg`, P6).** Rotation autour de l'axe x propre à l'appareil, bornée à [−90°, 90°]. **Positif = l'avant (axe acoustique, z local +, P9 / ADR-0015) vise vers le haut** ; négatif = vers le bas (vers le public). `SceneHost` l'affiche ainsi (`rotation.x = −tiltDeg`, le +x de Babylon, repère main gauche, baissant le +z). L'acoustique (Task 36) lit `tiltDeg` avec ce signe.
- **Lacet (`yawDeg`).** Rotation autour de +y, ramenée dans [0°, 360°) par Propriétés.
- **Montage.** « Sol » pose l'appareil au sol (hauteur = sol du lieu, non modifiable) ; « Pied » et « Accroché » gardent une hauteur modifiable, jamais sous le sol.
- **Point à vérifier en Task 36 :** `DeviceSpawner` place la grille de prises des boîtes de remplacement sur la face −z ; il faut confirmer que la face avant (grille) des `.glb` d'enceintes regarde bien +z, sinon retourner modèle et axe ensemble.