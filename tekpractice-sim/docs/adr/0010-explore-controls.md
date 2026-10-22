# ADR-0010 — Explore mode : marcher dans le monde, inventaire, contrôles remappables

- **Status:** Accepted (run autonome, 2026-10-22). Fondateur indisponible : les choix
  ouverts sont tranchés ici et listés dans `docs/REVIEW-ME.md` (section ADR-0010).
- **Spec source:** master prompt v2 §4 (B1–B4), `knowledge-base/docs/prompts/tekbrain-and-explore-controls.md`.
- **Respecte:** ADR-0008 (Focus & Patch) — inchangé en mode Focus. ADR-0004/0005 (sandbox,
  rigs) — étendus, pas dupliqués. ADR-0001 (contrôles = état). CLAUDE.md : 3 couches,
  l'UI dispatch des intents, ne mute jamais le graphe.

## Contexte

Aujourd'hui la caméra est une ArcRotateCamera : vue « Ensemble » (preset d'environnement)
⇄ « Focus » sur un device (ADR-0008). Le fondateur veut un monde 3D où l'on marche
(clavier + souris façon Minecraft, ou souris seule), un inventaire (Espace) et la pose de
matériel dans le monde, sans casser les niveaux A1–D1, l'examen ni le fallback 2D.

## Décision 1 — Trois vues, une seule machine Focus

| Vue | Caméra | Entrées |
|---|---|---|
| **Explore** (nouveau) | `UniversalCamera` sans inputs Babylon (on pilote la position nous-mêmes) | Actions (WASD, souris…) → `explore/movement.ts` + `explore/collision.ts` |
| **Orbite** (= l'« Ensemble » d'ADR-0008) | ArcRotateCamera, pose du preset | Inchangé |
| **Focus** | ArcRotateCamera auto-cadrée | Inchangé (ADR-0008) |

- `focusMachine.ts` reste la seule machine Focus/Patch. Son état « ensemble » signifie
  désormais « pas en focus » : la vue de retour est **Explore ou Orbite**, selon d'où l'on vient.
- `CameraRig` est vu par `FocusPatch` à travers une interface `CameraDirector`
  (`flyToDevice`, `flyToEnsemble`). En Explore, le directeur composite
  (`scene/ViewDirector.ts`) :
  - **entrer en focus** : place l'ArcRotateCamera exactement sur l'œil du joueur
    (alpha/beta/radius calculés depuis la position Explore vers le centre du device),
    l'active, puis vole (ou coupe si reduced-motion) ;
  - **sortir du focus** : revole jusqu'à l'œil mémorisé puis réactive la caméra Explore
    (position et regard restaurés).
- Les inputs de l'ArcRotateCamera sont détachés en Explore et rattachés en Focus/Orbite.

## Décision 2 — Couche d'actions (seam tactile/manette)

`src/input/` — pur, testé sans Babylon :

- `actions.ts` : `MOVE_FORWARD, MOVE_BACK, STRAFE_LEFT, STRAFE_RIGHT, MOVE_DOWN, MOVE_UP,
  RUN, TURN_LEFT, TURN_RIGHT, LOOK_UP, LOOK_DOWN, TOGGLE_INVENTORY, TOGGLE_HELP,
  TOGGLE_VIEW, FOCUS, PICK_UP, ROTATE_PLACEMENT, CANCEL`.
- `bindings.ts` : table action → liste de `KeyboardEvent.code` (positions physiques :
  `KeyW` est « Z » sur AZERTY, `KeyA` est « Q »). Remappable, sérialisée dans les réglages.
- `keyboardState.ts` : codes enfoncés → actions actives ; ignore les touches quand le
  focus clavier est dans un champ de saisie ou un bouton du HUD (a11y, même garde que
  FocusPatch) ; relâche tout sur `blur` (pas de marche infinie après alt-tab).
- `mouseGesture.ts` : pointerdown/move/up → `click` | `look-drag` (gauche) |
  `move-drag` (droit). Seuil = `InputManager.DragMovementThreshold` de Babylon (10 px),
  pour qu'un geste ne soit jamais à la fois un tap Babylon et un drag.
- `layoutLabels.ts` : libellé affiché pour un code (`navigator.keyboard.getLayoutMap()`
  si dispo, sinon heuristique AZERTY si `navigator.language` commence par `fr`).

Plus tard (pas ce run) : tactile et manette = nouveaux « devices » qui produisent les
mêmes actions.

## Décision 3 — Schéma de contrôle (spec fondateur, défauts §0)

Clavier + souris :

| Entrée (code physique) | Action |
|---|---|
| W A S D (Z Q S D en AZERTY) | Avancer / gauche / reculer / droite |
| Espace | Ouvrir/fermer l'inventaire (pas de saut) |
| Souris (pointeur capturé) | Regarder |
| Shift | Marcher plus vite |
| Q / E (A / E en AZERTY) | Descendre / monter (hauteur d'œil, accroupi ↔ debout) — défaut §0 |
| Flèches ←/→, PageUp/PageDown | Tourner / lever-baisser le regard (accès clavier seul) |
| F | Focus sur le device visé |
| X | Ramasser le device visé (Sandbox) |
| R | Tourner l'objet en cours de pose (90°) |
| V | Basculer Explore ⇄ Orbite |
| H | Aide des contrôles |
| Échap | Voir Décision 5 |

Souris seule :

| Entrée | Action |
|---|---|
| Gauche maintenu + glisser | Regarder |
| Droit maintenu + glisser haut/bas | Avancer / reculer |
| Droit maintenu + glisser gauche/droite | Pas de côté — défaut §0 |
| Clic gauche sans glisser | Interagir : focus du device, clic sur un port |
| Molette | Zoom par champ de vision (FOV) — défaut §0 |

En **Focus**, la souris garde exactement ADR-0008 (glisser = orbite, molette = rayon,
clic droit/clic vide = retour). En **Explore**, un clic gauche sur un device fait le focus
directement (un seul clic : on a marché jusqu'à lui) ; le double-clic marche toujours.

## Décision 4 — Capture du pointeur (conflit spec résolu)

Capturer le pointeur à chaque clic casserait le schéma souris seule (curseur caché,
impossible de viser un port). Réglage `pointerLock: 'auto' | 'always' | 'never'`,
**défaut `auto`** :

- clic sur le vide (rien d'interactif sous le curseur, sous le seuil de drag) → capture,
  **seulement si une touche de déplacement a déjà été utilisée dans la session** (signe
  d'un joueur clavier). `always` capture sans condition, `never` jamais ;
- clic sur un device/port → interaction, jamais de capture ;
- pointeur capturé : réticule au centre ; clic gauche → focus du device sous le réticule,
  puis libération du pointeur (on patche les ports avec un curseur visible) ;
- les taps Babylon sont ignorés pendant la capture (coordonnées figées).

## Décision 5 — Chaîne Échap (ordre de priorité)

1. Pointeur capturé → le navigateur le libère. Un Échap reçu < 150 ms après la libération est ignoré.
2. Fantôme de pose actif → annuler la pose.
3. Panneau ouvert (inventaire, aide, réglages, pause) → fermer le plus haut.
4. Câble en main → le lâcher (ADR-0008).
5. Focus → retour à la vue d'origine (Explore ou Orbite) (ADR-0008).
6. Explore sans rien d'ouvert → menu pause (reprendre, réglages, aide).
7. Orbite sans rien → rien (comportement actuel inchangé).

## Décision 6 — Vue par défaut

- **Sandbox : Explore par défaut.**
- **Niveaux A1–D1 et examen : Orbite par défaut**, Explore en option (V, bouton
  « Explorer », `?view=explore`). Les layouts des niveaux sont cadrés pour l'orbite et les
  e2e existants s'appuient dessus. Réglage « vue par défaut dans les niveaux ».
- `?view=orbit|explore` force la vue partout. Le fallback 2D n'est pas concerné.

## Décision 7 — Mouvement, collisions, confort

- `explore/movement.ts` (pur) : vitesse marche 1,4 m/s, course ×2 (Shift), multiplicateur
  de vitesse en réglage ; accélération/décélération exponentielles (pas d'à-coups) ;
  hauteur d'œil 1,65 m, Q/E entre 0,9 m et 1,9 m ; tangage borné ±85° ; invert Y,
  sensibilité, FOV 40–100° (défaut 70°).
- `explore/collision.ts` (pur) : joueur = cercle r = 0,3 m dans le plan XZ contre des AABB
  (murs de la pièce, devices, props) avec glissement le long des obstacles ; reste au sol
  (y = 0) ; **les obstacles de hauteur ≤ 0,25 m (câbles, rampes) sont enjambés**.
- Reduced motion (système ou réglage) : pas de head-bob (il n'y en a pas), vols caméra
  coupés, accélérations raccourcies.

## Décision 8 — Inventaire (Espace) et pose

- Panneau DOM (design system blanc) : matériel de `content/catalog.json` groupé par
  **catégorie de la taxonomie** KB, recherche texte, fiche courte par item (specs clés,
  connecteurs, lien manuel officiel) lue depuis `content/kb-sheets.json`, généré par
  `tools/build-kb-sheets.ts` à partir de `knowledge-base/equipment/*.json` (chargé en
  `import()` dynamique à la première ouverture : pas de poids au démarrage).
- Ouvrir l'inventaire libère le pointeur et suspend le déplacement.
- **Pose (Sandbox seulement)** : « Placer » → fantôme qui suit le sol sous le réticule
  (ou le curseur) sur une grille de 0,25 m ; R tourne de 90° ; clic = pose → intent
  `SPAWN { deviceId, position, rotationY }` (champs optionnels ajoutés à l'intent
  existant) ; Échap annule.
- **Ramasser** : X (ou bouton en Focus) → intent `REMOVE { instanceId }`
  (`ConnectionGraph.removeInstance` existe déjà) ; toast « Annuler » qui restaure device,
  câbles et contrôles.
- Les rigs sauvegardés gagnent un champ optionnel `positions` (rétro-compatible, version 1).
- En niveau : inventaire en lecture seule (fiches), pose désactivée avec une explication.

## Décision 9 — Réglages et aide

- `ui/exploreSettings.ts` : `localStorage['audio-sim/explore-settings']`, versionné,
  lecture/écriture en try/catch (comme `ProgressStore`), reset si version différente.
  Contenu : vitesse, sensibilité, invert Y, FOV, reduced motion (système/on/off),
  pointerLock, vue par défaut en niveau, bindings.
- Aide (H + bouton « ? ») en français d'abord, libellés selon la disposition du clavier.

## Rejeté

- **Capture du pointeur à chaque clic** : casse le schéma souris seule (Décision 4).
- **Explore par défaut dans les niveaux** : casse le cadrage et les e2e ; reste une option.
- **`camera.checkCollisions` de Babylon** : non testable sans moteur, pas de règle
  d'enjambement ; nos fonctions pures donnent les tests exigés.
- **Deuxième machine d'état pour le focus** : une seule grammaire (ADR-0008 l'exigeait déjà).

## Conséquences

- Nouveaux modules : `src/input/*`, `src/explore/*`, `src/scene/ViewDirector.ts`,
  `src/ui/inventory.ts`, `src/ui/helpOverlay.ts`, `src/ui/exploreSettings.ts`.
- Changements limités : `FocusPatch` (interface `CameraDirector`, deps `clickFocuses()` et
  `inputEnabled()`), intents `SPAWN` étendu + `REMOVE`, `game.ts` (composition).
- `window.__audioSim` gagne `explore()` (vue, position, yaw/pitch, inventaire ouvert)
  pour les e2e.
- Budget : bundle de démarrage ≤ +15 %, ≥ 50 fps en pièce moyenne ; pièces chargées à la
  demande.
