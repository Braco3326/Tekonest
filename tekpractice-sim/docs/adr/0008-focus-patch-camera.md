# ADR-0008 — "Focus & Patch" : state machine caméra + interaction clic-clic

- **Status:** Accepted (run autonome long, 2026-07-18) — exécution de la spec
  docs/TekPractice_Interaction-and-Assets.md §1-§5 (council-validated Tier 3)
- **Beat servi:** 3 (le geste métier : trouver le bon port sur le vrai panneau EST la
  compétence d'examen E4 — la friction est pédagogique, spec §0)
- **Remplace:** le drag-to-connect 3D (src/scene/Interaction.ts) — l'anti-pattern que la
  spec §1 rejette explicitement. On ne garde PAS les deux flows (décision d'Oscar).

## Décision 1 — Trois modules, séparation stricte

| Module | Rôle | Importe |
|---|---|---|
| `scene/focusMachine.ts` | **QUOI** — state machine PURE : ensemble⇄focus, curseur sélection, câble en main. Entrée = FocusEvent, sortie = état + FocusCommand[]. | uniquement le TYPE PortRef |
| `scene/CameraRig.ts` | **Vol caméra** : ensemble↔focus, eased 250-350 ms, auto-frame du panneau actif, reduced-motion = cut. | Babylon (caméra seulement) |
| `scene/FocusPatch.ts` | **Adaptateur** : pointeur/clavier → events ; exécute les commands (vol, câble tenu via CableRenderer, glow, dispatch CONNECT). | Babylon + closures injectées |

**Aucun de ces modules n'importe ConnectionGraph** (test statique). La validation reste
`canConnect` injecté (dry-run), la mutation reste le dispatch d'intents → orchestrateur.
La caméra ne mute JAMAIS le graphe (spec §5, CLAUDE.md).

## Décision 2 — Politique Esc (ambiguïté de la spec tranchée)

La spec §2 liste Esc à la fois dans « Back to Ensemble » et « Cancel held cable ».
**Résolution : Esc annule l'engagement le PLUS RÉCENT** — câble en main → 1er Esc lâche le
câble (on reste en focus), 2e Esc revient en Ensemble. **Clic droit et clic dans le vide
reviennent en Ensemble EN GARDANT le câble en main** — c'est le cœur du flow §1 étape 4
(revenir, voir les devices compatibles glow, plonger sur la cible).

## Décision 3 — Connexion refusée = câble regardé en main

Sur le 2e clic port, la machine émet `connect` et libère la main (optimiste). FocusPatch
consulte le dry-run `canConnect` AVANT le dispatch : refusé → l'intent part quand même
(le toast enseignant EST la leçon R1-R3) puis `repickup()` re-arme le câble — l'élève
réessaie sans re-cliquer la source. Aucune dépendance nouvelle vers le graphe.

## Décision 4 — Auto-frame du « panneau actif »

Les ports des placeholders vivent sur la face −Z (DeviceSpawner). L'auto-frame vise donc
alpha=−π/2 (caméra côté −Z), beta≈1.15, radius = 2.6 × rayon englobant (borné) — les ports
te font face en arrivant, l'orbite libre (drag) montre le vrai arrière. Quand les .glb
remplaceront les boîtes, le même contrat tient (bounding réel du root).

## Décision 5 — Entrées touch-portables (mapping maintenant, tactile plus tard)

| Action | Desktop (implémenté) | Touch (même event Babylon, plus tard) |
|---|---|---|
| Focus device | double-clic (POINTERDOUBLETAP) | double-tap (même observable) |
| Orbite | drag gauche (ArcRotateCamera) | 1 doigt |
| Zoom fin | molette | pincement |
| Port / poser câble | clic (POINTERTAP) | tap |
| Retour Ensemble | Esc / clic droit / clic vide | 2 doigts (à mapper) / bouton retour |
| Annuler câble | Esc / re-clic sur le port tenu | tap sur le port tenu |

Clavier : Tab cycle les devices, Entrée focus, flèches orbitent (accessibilité).

## Rejeté
- **Garder le drag en parallèle du clic-clic** : deux grammaires d'entrée = confusion +
  double surface de bugs ; la spec impose le remplacement.
- **HighlightLayer Babylon pour le glow** : exige le stencil buffer à la création de
  l'Engine ; `renderOutline` par mesh fait le même travail sans toucher au bootstrap.
- **State machine dans game.ts** : intestable headless ; la pureté de focusMachine donne
  les tests unitaires exigés par la spec §7.

## Conséquences
- Interaction.ts (drag) et nearestPort/snap-radius disparaissent ; snap.ts se réduit au
  type PortPoint. `window.__audioSim.snap` remplacé par `view()` (mode/focused/held).
- Indices mode-gated (spec §3) : glow devices + tint ok/bad SEULEMENT si hints() —
  ON Learn/Levels, OFF Examen, toggle Sandbox. Le 2D (Render2D) suit la même règle.
- e2e pilotables à la vraie souris : `deviceScreen()`/`portScreen()` projettent en continu.

## Addendum 2026-10-24 — navigation « designer » (nuit, Tasks 3–4, décisions N1/N2)

Étend la décision, ne la remplace pas : Esc, clic droit, câble tenu, Tab/Entrée et
l'architecture des trois modules restent tels quels.

- **N1 — un clic simple sur un appareil le met en focus** (pivot = l'appareil + vol),
  en Orbite comme en Exploration. Cela **remplace** « clic simple = sélection » (spec §1,
  tableau Décision 5 ligne « Focus device ») ; le double-clic focus toujours.
  `DEVICE_CLICK` produit la même transition que `DEVICE_DOUBLE_CLICK`, câble tenu conservé.
  Exception : un clic sur l'appareil **déjà** cadré ne relance pas le vol (un clic qui rate
  un port ne doit pas annuler l'angle choisi par l'élève). La dep `clickFocuses()` de
  FocusPatch (ADR-0010) disparaît : la machine décide seule.
- **N2 — le vol de focus garde le cadrage de la Décision 4** (`FOCUS_ALPHA`, ports face à
  la caméra) ; seul le pivot change. Pivot = **centre de la boîte englobante monde** de la
  hiérarchie (`root.getHierarchyBoundingVectors()`). Quand le `.glb` arrive après le vol
  (`modelReady`), seul le pivot est recadré, et seulement si le centre bouge d'au moins
  2 cm (pendant le vol : le même cadrage repart sur le bon centre).
- **Re-pivot au sol** : nouvel event `FLOOR_DOUBLE_CLICK { point }` → commande `repivot`
  (cible seule ; alpha, beta, rayon gardés). En focus, on sort du focus **sans** revoler
  vers l'Ensemble. Pick = sol blanc, sol et zones de salle, set d'environnement (meta
  `pivotSurface`), jamais appareils ni ports ; rien sous le curseur = rien. Pour que le
  1er clic d'un double-clic au sol ne lance pas le retour Ensemble, le « clic dans le
  vide » en focus attend la fenêtre de double-clic (`Scene.DoubleClickDelay`, 300 ms).
  En marche (Exploration sans focus) : pas de pivot, ADR-0010 inchangé.
- **HOME** : nouvel event → `flyToEnsemble`, mode ensemble, câble gardé (comme le clic
  droit en focus, mais aussi depuis l'Ensemble après un pan ou un re-pivot). Action
  `CAMERA_HOME` = **Alt+H** (binding remappable `'Alt+KeyH'`, H seul reste l'aide) et
  bouton « Vue d'ensemble » dans la barre du haut (deck `viewCube.home.*`), masqué en
  marche.
- **Plancher de dolly** : en focus `lowerRadiusLimit = max(0.3, 1.2 × rayon englobant)`,
  retour Ensemble = 2 ; jamais au-dessus du rayon de départ (pas de saut par clamp).
- Mise à jour du tableau Décision 5 : Focus device = **clic** (ou double-clic) ; pan =
  drag droit, Maj + drag gauche (ou Ctrl + drag gauche) ; re-pivot = double-clic au sol ;
  Retour Ensemble = Esc / clic droit / clic vide / Alt+H.
