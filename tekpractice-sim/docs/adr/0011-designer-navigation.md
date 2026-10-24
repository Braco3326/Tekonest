# ADR-0011-nav — Navigation « designer » : orbite, clic-focus, vues enregistrées, cube de vue

- **Status:** Accepted (night build 2026-10-24, phases A + B). Branch `feature/tekpractice-designer-nav`.
- **Sources:** night brief, Tasks 3 to 8; decisions N1 to N4, N9, N12 (`docs/NIGHT-2026-10-24.md`).
- **Extends, does not replace:** ADR-0008 (Focus & Patch: addendum for N1/N2) and ADR-0010 (Explore/Orbit, Esc chain, V). Explore keeps the ADR-0010 mouse rules: nothing below applies while walking.
- **Inspiration:** the *behaviour* of pro acoustic-design tools (soft orbit, click to pivot, saved views, a view cube). No look, name, wording, data or code is taken from any of them. Our look: Nuit / Papier / Ambre tokens, square corners.
- **Numbers:** navigation only. No acoustic value (no dB, no STI) anywhere in this work.

## Contexte

L'apprenant doit tourner autour du matériel comme dans un outil de conception : sans perdre le pivot, revenir à une vue connue, voir « de face », « de dessus ». La caméra orbite (ArcRotateCamera, Babylon 7, monde **gaucher**) existait (ADR-0008). Elle était sèche, pivotait sur le centre de la scène et n'avait aucune vue nommée.

## Décision 1 — Sensation d'orbite (Task 3)

- `src/camera/orbitFeel.ts` (pur) : `inertia 0.85`, `panningInertia 0.85`, `wheelDeltaPercentage 0.02`, molette qui avance vers le curseur (`zoomToMouseLocation`), `upperBetaLimit π/2 − 0.02` et `lowerBetaLimit 0.05` (jamais sous le sol), `upperRadiusLimit` = max(actuel, 60 m), `minZ 0.05`.
- Pan qui suit le curseur à toute distance (`panningSensibilityFor`, recalculé à chaque pointerdown, rien par frame). Maj + glisser, clic droit + glisser ou Ctrl + glisser = pan (`designerOrbitInput.ts`).
- Toutes les transitions caméra : **450 ms, ease-in-out cubic** (N4, `TOKENS.focus.flyMs`), `CameraTween` annulable par l'apprenant. `prefers-reduced-motion` ou `ExploreSettings.reducedMotion` → **coupe**, pas de vol.

## Décision 2 — Clic-focus et pivot (Task 4, N1, N2, N9)

- **Un clic** sur un appareil le met en focus (N1, aussi en Orbite). Le double-clic aussi. Un clic sur l'appareil déjà cadré ne fait rien.
- Le vol garde l'angle de cadrage (ports face à la caméra, `FOCUS_ALPHA`) ; seul le pivot change (N2). Pivot = **centre des meshes de corps** de l'appareil (N9), pas la boîte de la hiérarchie (étiquette et ombre exclues).
- Double-clic sur le sol (faces tournées vers le haut seulement) : nouveau pivot, angle et distance gardés.
- **Alt+H** ou « Vue d'ensemble » : retour à la pose d'ensemble ; le câble en main est gardé.

## Décision 3 — Vues enregistrées « Vue 1 / 2 / 3 » (Task 5, N12)

- 3 emplacements par salle (`audio-sim/camera-presets`, zod, clé = id de salle ou `level:<id>`). Digit1/2/3 rappellent ; clic droit, appui long 600 ms, Maj+Entrée ou le bouton « Enregistrer ici » enregistrent.
- Rappeler depuis un focus quitte le focus sans voler vers l'ensemble (N12).
- Orbite seulement. **Phase B : le groupe est ancré sous le cube de vue** (même dock en haut à gauche).

## Décision 4 — Cube de vue (Tasks 7 et 8)

### Convention « Face » (N3)

- **Face** = depuis le public vers la scène. Salles : scène à −z, public à +z → caméra à +z, `alpha = +π/2`. Niveaux sans salle : le côté que les panneaux de ports ne regardent **pas** (ils regardent −Z, DeviceSpawner) → aussi `alpha = +π/2`. **Arrière** = `alpha = −π/2` (côté ports).
- **Gauche / Droite** = gauche / droite **vus du public**. Babylon est **gaucher** : depuis la pose Face (caméra à +z regardant −z), le +x du monde est à **gauche** de l'écran, et `alpha` qui augmente déplace la caméra vers sa droite. Donc « caméra à droite vue du public » = `front + π/2`.
  - Le brief écrivait `front − π/2` (raisonnement droitier). Son intention écrite (« camera on the right, seen from the audience ») l'emporte ; le signe est la constante `SIDE_SIGN` de `src/camera/viewCube.ts`. Preuve : test unitaire (vecteur droite de LookAtLH) et e2e (projection écran réelle : après ↻ depuis Face, la caméra est du côté qui était à droite de l'écran).

| Vue | alpha | beta |
|---|---|---|
| face | front | π/2 − 0.25 (un peu au-dessus) |
| arriere | front + π | idem |
| droite / gauche | front + π/2 / front − π/2 | idem |
| ¾ face-droite / face-gauche | front ± π/4 | idem |
| ¾ arriere-droite / arriere-gauche | front ± 3π/4 | idem |
| dessus | alpha actuel arrondi au quart le plus proche (relatif à front) | 0.0001 |
| dessous | idem | π − 0.0001 |

- `nearestFace` : beta < 0.35 → dessus, beta > π − 0.35 → dessous, sinon le plus proche des 8 azimuts. `rotate90` : prochain multiple de π/2 depuis front dans le sens demandé (+1 = la caméra va vers sa droite : depuis Face, « Tourner à droite » mène à Droite).
- **Rotation CSS** (`cubeCssRotation`, appliquée en `rotateX(rx) rotateY(ry)`) : la base caméra envoie une direction monde d sur CSS (d·R, −d·U, d·B), R = (−sin α, 0, cos α). En identifiant avec RX(ψ)·RY(φ) : **φ = front − α, ψ = β − π/2**. À la pose Face : (−14,3°, 0). Faces du cube : face `translateZ`, droite `rotateY(90°)`, arriere `rotateY(180°)`, gauche `rotateY(−90°)`, dessus `rotateX(90°)`, dessous `rotateX(−90°)`. Test : pour chaque vue, la normale de la face correspondante pointe vers l'écran.

### Comportement

- Clic sur une face, une arête ¾, ↺ ↻ ou ⌂ : vol vers ces angles **autour du pivot actuel**, cible et distance gardées (le focus reste un focus). ⌂ = HOME.
- **Dessus / Dessous** sortent de la garde de beta : `CameraRig.flyToView` l'élargit pour cette demande seulement (bas 0.0001, haut π − 0.01) et la remet au prochain orbit de l'apprenant (pointerdown sur le canvas ; Babylon recale alors la pose, une coupe assumée).
- Touches (actions remappables, par `KeyboardEvent.code`, ignorées dans un champ texte) : `VIEW_FACE` Numpad1, `VIEW_ARRIERE` Ctrl+Numpad1, `VIEW_DROITE` Numpad3, `VIEW_GAUCHE` Ctrl+Numpad3, `VIEW_DESSUS` Numpad7, `VIEW_ROT_LEFT` / `VIEW_ROT_RIGHT` Numpad4 / Numpad6. Les accords Ctrl passent par `chordFor` (comme Alt+H). Dessous n'a pas de touche (pas dans le brief) : bouton seulement.
- **Visible** en Orbite et en focus d'Orbite ; **caché en Explore** (marche, et focus depuis Explore, comme les vues enregistrées : là, le marcheur possède le vol retour).
- Aspect : DOM/CSS 3D (`preserve-3d`), 96 px (72 px sous 1366 px de large), en haut à gauche sous le panneau d'objectifs (`dockBelow`, ResizeObserver). Faces Nuit `#131114` à 85 %, libellés Papier `#F3EDE3` IBM Plex Sans 11 px (police système si absente, aucun téléchargement), face active cerclée Ambre `#DD9349` **et** nommée sous le cube (jamais la couleur seule), coins carrés.
- Accessibilité : 13 boutons nommés (copy deck `viewCube.*`), suffixe « , vue actuelle » sur la face active, anneau de focus visible (une face arrière focalisée s'affiche, et le libellé sous le cube montre le bouton focalisé). Dans le HUD, Tab atteint le cube ; sur le canvas, Tab reste le parcours des appareils (ADR-0008).
- Astuce coach (copy `viewCube.coach.hint`) : une ligne sous le cube au premier affichage, id `view-cube` dans `audio-sim/coach-seen` (**sessionStorage** : une fois par session, pas une fois pour toujours).

## Décision 5 — Performance

- Aucun travail par frame caméra immobile : `CameraTween` n'a d'observer `onBeforeRender` que pendant un vol.
- Le cube ne suit la caméra que par `camera.onViewMatrixChangedObservable` (émis seulement si la vue change), regroupé en **un seul `requestAnimationFrame` en attente** (`CoalescedUpdate`), détaché quand le cube est caché. Pas de boucle rAF permanente, pas de second canvas. Prouvé par un test unitaire (aucun rAF sans signal) et un e2e (0 mutation de style en 800 ms caméra immobile).
- Mesure (headless Chromium, ce PC, salle `concert-hall-medium`) : marche 24,2 fps (phase A : 24,2) ; orbite en glisser continu, cube affiché 24,3 / 24,2 / 23,9 fps, dock retiré 24,6 / 23,8 / 24,3 fps : dans le bruit.

## Conséquences et points ouverts

- **Miroir des salles (à trancher, hors périmètre ce soir) :** les fichiers de salle disent « x = droite » vu du public (`coulisse-jardin` à x = −8), mais le rendu gaucher affiche ce −x à **droite** de l'écran depuis le public. Le cube suit ce que l'apprenant voit ; l'infobulle « Gauche = côté jardin » (copy deck) est donc juste pour la vue, mais la zone de données nommée « jardin » apparaît côté cour. Correctif possible : rendu des salles en miroir x, ou repère droitier. À décider avec Oscar / tekreviwer.
- Ctrl+Numpad1 / Ctrl+Numpad3 peuvent être pris par certains navigateurs ou systèmes avant la page ; les boutons du cube restent le chemin garanti (« Pas de pavé numérique ? Cliquez le cube. » dans l'aide).
- Le copy deck associait Numpad4 / Numpad6 à Gauche / Droite et Numpad3 aux coins ; les touches suivent le brief (rotation 90° et Droite/Gauche). Les infobulles affichent la touche réellement liée. À aligner par tekuxwriter.
