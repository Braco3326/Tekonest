# TekPractice "Mode Création": Phase 0 audit (2026-10-24)

- **Auditor:** tekfrontenddesigner (autonomous run; Oscar unavailable, assumptions logged in §8).
- **Brief:** `tekpractice-sim/docs/plans/2026-10-24-creative-mode-brief.md` §1.
- **Builds audited:**
  - **live:** `https://tekonest.com/tekpractice/jouer/` (build `e8e489b`);
  - **local:** branch `feature/tekpractice-creative-mode` (`36cfa5a`), `npm run build` + `vite preview` on port 4173.
- **No code was changed.** Only this report, `docs/audit/screens/` and the root `.gitignore` are committed.
- **Method:** Playwright 1.61 + Chromium, **headless**. Scripts lived in the session scratchpad and are not committed.
  - 13 scripted runs: P1 ×4 (live/local × 1366×768/1920×1080), P2 ×3, P3 ×3 (`reducedMotion: 'reduce'`), 1 patch diagnostic, 3 FPS runs.
  - Every step has a screenshot; 54 meaningful ones are in `screens/`.
  - Console messages, page errors, failed requests and every toast (via a MutationObserver) were recorded.
- **Fohhn:** compared from `research/fohhn-benchmark/interface-inventory.md` §3 and the local, git-ignored screenshots (D-14, D-46). They were viewed only, never copied. Fohhn is described in my own words.

---

## 1. Summary

TekPractice today is a **level-based wiring trainer with a free Sandbox**. It is not yet a design tool. A technician can build the reference rig (QL1 + SM58 + 2 × QSC K12.2) in the Sandbox, and the engine rules work. But almost every step feels like a game, not a pro tool:

- **Placing gear:**
  - you have to walk;
  - the ghost is a box;
  - rotation only comes in 90° steps, and only before the drop;
  - moving a device means picking it up and placing it again, which unplugs its cables.
- **Navigation:** the view cube has 10 zones, not 26. From any pose only 3–5 of them can be clicked.
- **Patching:** port labels hide the ports.
- **Errors:** they are English toasts that disappear.
- **Changing room:** the page reloads and the setup is lost.
- **Sound:** there is none, and no "signal OK" either.

Keyboard-only users are **blocked**:

- Tab never leaves the 3D canvas, so no HUD control can be reached;
- no key picks a port.

Reduced motion is honoured: camera flights become cuts, settled in about 250 ms.

- **Health:** 0 console errors and 0 page errors on all 13 runs.
  - The only warning is the expected `[rejected DIRECTION_MISMATCH R3]` log.
  - Every "failed request" is an `ERR_ABORTED` caused by our own navigation (room change, `goto`), plus one runtime fetch of the Draco decoder from `cdn.babylonjs.com` (CA-24).
- **FPS:** at 60 fps with a real GPU. With software GL (school-laptop proxy) it drops to 8–16 fps, and **idle costs as much as orbiting** (CA-18).

**Counts:** **3 P0 · 15 P1 · 9 P2** (27 issues, CA-01…CA-27).

---

## 2. FPS (rAF counter, 10 s idle + 10 s orbit drag)

| Build | Viewport | Renderer | Scene | Idle fps (worst frame) | Orbit fps (worst frame) |
|---|---|---|---|---|---|
| local | 1366×768 | SwiftShader (software GL, headless) | bar-club-stage-small + saved rig (4 devices) | **14.5** (133 ms) | **12.7** (150 ms) |
| local | 1920×1080 | SwiftShader | same | **9.6** (200 ms) | **9.2** (233 ms) |
| live | 1366×768 | SwiftShader | same | **14.4** (150 ms) | **14.4** (133 ms) |
| live | 1920×1080 | SwiftShader | same | **8.2** (233 ms) | **8.0** (267 ms) |
| local | 1366×768 | SwiftShader | concert-hall-medium + QL1/SM58/2×K12 | 15.7 (117 ms) | 14.6 (117 ms) |
| local | 1366×768 | **GPU** (RTX 3060 Ti, ANGLE D3D11, headless) | concert-hall-medium + 4 devices | **60** (17 ms, vsync) | **60** (17 ms) |
| live | 1920×1080 | **GPU** | same | **60** | **60** |
| baseline | — | about:blank, same browser | — | 59.8 | — |

**Reading:**

- Idle ≈ orbit on software GL. So the scene is re-rendered every frame even when nothing moves: `babylon.runRenderLoop(() => scene.render())` in `src/game.ts:1207`.
- The night build's "no per-frame work at idle" holds for the cube, the tween and the presets, **not for the renderer**.
- On a school laptop with an iGPU, this burns battery and heat for nothing. On software GL it caps interactivity at about 10–15 fps.
- **Caveat:** the runs were headless, so the SwiftShader numbers are a pessimistic proxy, not a real school laptop. The GPU numbers are capped at vsync.

---

## 3. Persona journeys

Screenshot names are in `docs/audit/screens/`. "1366" means 1366×768. All four P1 runs gave the same functional results; only the differences are noted.

### P1: Oscar, technicien (Yamaha QL1 + Shure SM58 + 2 active speakers)

- **Speakers:** the catalog has two powered speakers, `qsc-k12-2` (PA top) and `yamaha-dbr12` (wedge), plus the studio monitor `genelec-8030c`. I used **2 × QSC K12.2** as L/R.
- **No power:** no device in the catalog provides `mains-power`, so the speakers' `power-in` can never be fed (see CA-03).

| # | Journey step | What happened | Screens |
|---|---|---|---|
| 1 | Open `?level=sandbox` | Boots in about 1.5 s into **Explore (walking)** in a white studio. The guided palette shows 3 items. The objectives card (top-left) and the "Étagères" shelf (bottom-left) cover about 30 % of the viewport at 1366. No view cube in Explore | `p1-01-open-sandbox-1366` |
| 2 | Choose a place | The only path is a `<select>` "Salle générée (TEK Brain)" with 32 rooms, inside the shelf. Picking one **reloads the page** (1.9–2.7 s live/local). The room is grey/black boxes; the stage is a flat yellow slab | `p1-02-place-chosen-concert-hall` |
| 3 | Space → inventory | A centred modal (920×511) with search, 12 category groups, 24 devices and **no thumbnails**. The sheet shows sourced specs, connectors and a manual link | `p1-03-inventory-space`, `p1-04-inventory-sheet-ql1` |
| 4 | Find + place | Search "QL1" → item → **Placer dans le monde** → you must aim at the floor in **walk view**. The ghost is a **0.5 m translucent box**, not the console. A click places it (0.25 m snap). The two K12s jumped to the side walls (x = ±5.75 m) from a cursor at 30 %/70 % of the screen width | `p1-05-placing-ghost-box`, `p1-06-placed-ql1-sm58-2xk12` |
| 5 | Move | No drag, no gizmo, no properties. Dragging a placed QL1 only turns the walking camera. The documented path: aim + **X** = pick up (it goes back to the inventory with an "Annuler" toast), then re-place from the inventory. **The instance id changes and its cables are unplugged** | `p1-07-move-is-pickup-x` |
| 6 | Rotate | **R** = +90°, only while the ghost is in hand. A placed device can't be rotated; there is no tilt and no height | `p1-05…` (rotationY 90 after R) |
| 7 | Select + zoom/orbit | **V** → Orbit. A click on the QL1 flies to it (pivot = body centre, OK). The wheel dollies to the cursor and a drag orbits; all of this works and feels right. In focus, **port and device labels are huge white boards** that cover the panel and each other | `p1-08-orbit-view`, `p1-09-select-ql1-focus-labels`, `p1-10-zoom-in`, `p1-11-orbit-around-ql1`, `p1-34-live-1920-focus-ql1` |
| 8 | View cube, every zone | **13 buttons** = 6 faces + **4 vertical ¾ edge tabs** (face-gauche, face-droite, arrière-gauche, arrière-droite) + ↺ ⌂ ↻. **No 8 corners and no 8 other edges** (top or bottom edges). So no "¾ from above" view exists. Mouse reachability by pose is in §3.1 | `p1-20…24-cube-*` |
| 9 | Reach every side of the structure | Front, back, left, right and top (and ¾) all reachable with the cube (by keyboard when the face is hidden). From the overview distance (25.6 m) the four devices are 10–20 px specks with unreadable labels. The top view keeps the heading, so the stage shows on the right. The back view sees the stage cut by the room box | `p1-12…19-side-*` |
| 10 | Patch cables | Focus the SM58 → click `out-xlr` (cable in hand) → right-click back to the overview (the cable is kept) → focus the QL1 → click `in-mic-1` → a green cable appears. **It worked for 1–2 of the 3 connections per run.** The last K12 sat under the shelf panel and could not be focused in any of the 4 runs. One connection (local 1920) failed silently. In a clean diagnostic layout (devices in the middle of the room), 3/3 worked (CA-08/CA-09) | `p1-25-patch-cable-in-hand`, `p1-26-patch-ports-under-labels`, `p1-36-k12-ports-labels`, `p1-37-patched-overview` |
| 11 | Read errors | K12 `power-in` → QL1 `in-mic-2` gives a red toast **"DIRECTION MISMATCH — Signal flows one way…" in English**. It is followed by a coach toast **"CONSEIL D'OSCAR [À REMPLACER PAR OSCAR — …]"** (placeholder copy, live). The error is not shown at the port, and there is no persistent error list or status | `p1-28-error-toast-english` |
| 12 | Overview after patching | The cables are barely visible from the overview: thin dark lines, no colour per signal, no legend. Nothing says "Signal OK" | `p1-27-overview-cables-invisible`, `p1-37-patched-overview` |
| 13 | Save & reload | "Nom du rig…" + **Sauver** at the bottom of the shelf → "Montage « Oscar QL1 test » enregistré." (rigs.v2: 4 instances, the connections, roomId). A **plain reload loses everything** (0 devices; there is no autosave). Loading the rig from the shelf restores 4 devices. The rig is listed collapsed as "▶ Oscar QL1 test" | `p1-29-rig-saved`, `p1-30-reload-loses-scene`, `p1-31-rig-loaded` |
| 14 | Change place | The select → **full reload; 0 devices kept**, with no warning | `p1-33-change-place-empties-scene` |
| 15 | Esc chain | Orbit + focus + held cable + inventory open: Esc 1 closes the inventory, Esc 2 drops the cable, Esc 3 leaves focus, Esc 4+ does nothing in Orbit. **This matches CONTROLS.md.** In Explore with nothing open, Esc opens Pause (documented) | `p1-32-esc-stack-open` |
| 16 | FPS | See §2 | `p1-38-fps-scene` |

#### 3.1 View cube: what exists, precisely

- **Source:** `src/camera/viewCube.ts` (`ALL_FACES`), `src/ui/viewCube.ts`.
- **Zones:** face, arrière, gauche, droite, dessus, dessous, plus 4 ¾ tabs on the vertical edges (all at the side elevation β = 75.7°). So there are **10 view zones** + 3 buttons (↺ ⌂ ↻). The e2e test asserts exactly 13 buttons.
- **Missing compared with the brief's 26 zones:**
  - the 8 corners (¾-from-above views);
  - the 4 top edges (e.g. Face + Dessus at 45°);
  - the 4 bottom edges.
- **Size:** the stage is 96 px at 1366 (72 px under 1366 width).
- **Mouse hit test:** 2 px grid of `elementFromPoint` over the cube after each view.

| Camera pose | Zones the mouse can hit | Zones only by keyboard (Tab + Enter) from this pose |
|---|---|---|
| Face | Face, Dessus, Face-gauche, Face-droite | Droite, Gauche, Arrière, Dessous, both arrière ¾ |
| Droite | Droite, Dessus, Face-droite, Arrière-droite | Face, Gauche, Arrière, Dessous, … |
| Arrière | Arrière, Dessus, Arrière-gauche, Arrière-droite | Face, … |
| Dessus | **Dessus only** | everything else (incl. Dessous) |
| ¾ face-droite | Face, Droite, Dessus, Face-droite | … |

- **Edge tabs on screen:** at the focus pose they measured **7–15 px wide × 37–51 px tall** (bounding boxes). A Playwright click on a ¾ tab or a non-front face timed out ("element intercepts pointer") in 9 of the 10 face/edge attempts. Only Dessus and the 3 round buttons were clickable from the pose before.
- **Dessous:** never clickable by mouse from above; it has no key either.
- **Other observations:**
  - from the Face pose the Dessus label is a clipped sliver;
  - there is no compass ring and no drag-the-cube-to-orbit.

### P2: first-year BTS student, first visit, no instructions

| # | Step | What happened | Screens |
|---|---|---|---|
| 1 | Open the default URL (fresh storage) | Onboarding card: the exam date + 2 radio questions + "C'est parti — mets-moi aux manettes" + a faint "Passer" link. No 3D, no mention of a place or of creating a setup. Clear, calm, French | `p2-01-first-screen-onboarding` |
| 2 | Answer "Aucune idée" + "Débutant" | Lands in **level A1**. The title is **"A1 — First PA: vocal + guitar amp"** and the brief and checklist are in English, with raw port ids (`out-xlr → in-mic-1`, `dante-primary`). The cube says **"Arrière"** although this is the first view | `p2-02-landed-a1-english`, `p2-03-landed-a1-1920` |
| 3 | Clicks the middle, drags, scrolls | The click hits nothing (stays in overview). Drag = orbit, wheel = zoom: intuitive | — |
| 4 | Presses Space | The inventory opens, but it is read-only in a level ("Le placement libre est disponible dans la Sandbox"). She can't build anything | `p2-04-space-in-level-readonly` |
| 5 | Presses H | A clear 3-table help; bilingual labels such as "(Move forward)" | `p2-05-help-overlay` |
| 6 | Looks for a free mode | The only route is the small "Sandbox" chip in the level nav. It opens a **white empty studio in walk view** with "Palette guidée". A click on "Yamaha QL1" in the shelf spawns it immediately at a default spot | `p2-06-sandbox-white-studio`, `p2-07-shelf-item-click` |
| 7 | Back to the start URL | A readiness dashboard (R1–R8, BC01–04, E3/E4/E51), still nothing like "Mode Création" | `p2-08-dashboard` |

**Verdict:** P2 never finds "choose a place, build, listen". The product steers her into an English level about Dante on her first visit.

### P3: keyboard only + `prefers-reduced-motion: reduce`

| # | Step | What happened | Screens |
|---|---|---|---|
| 1 | Load, press H / Space without clicking | Both work. Focus goes to the panel's close button, with a visible blue ring | `p3-01-help-on-load` |
| 2 | **Tab from the page** | **45 Tabs: focus stays on `<body>`, with no ring.** `FocusPatch.onKey` takes Tab on the body/canvas to cycle devices, so **no HUD control can ever be reached by Tab**: level nav, room select, save, Vue 1/2/3, cube buttons, Essais. Device selection by Tab changes `selected`, but nothing visible marks it | `p3-02-tab-stuck-on-body` |
| 3 | Room select (focused programmatically) | **ArrowDown immediately navigates** to the next room (bar-club → church), which is a full reload (WCAG 3.2.2) | `p3-03-arrow-on-select-navigated` |
| 4 | Inventory by keyboard | Space → type "QL1" → Tab → Enter → Tab to "Placer dans le monde" → Enter → walk with S → R → **F places**. It works | `p3-04-inventory-keyboard`, `p3-05-placing-keyboard` |
| 5 | Select + focus a device | Tab (on the canvas) selects, Enter focuses (the camera cuts, reduced motion OK). The arrows orbit in focus | `p3-06-keyboard-focus-device-overlaps` |
| 6 | **Patch by keyboard** | In focus, Tab cycles **devices**, not ports. Enter re-focuses. **No key picks a port, so no cable can be made** (WCAG 2.1.1) | `p3-07-keyboard-no-port-selection` |
| 7 | Cube by keyboard | Numpad 1/3/7, Ctrl+Numpad 1/3, Numpad 4/6 and Alt+H all work, as cuts (about 250 ms including polling). The 13 cube buttons are reachable by Tab **only if focus is already in the HUD** (see 2). There is no key for the ¾ views or Dessous. **"V then arrows" does not exist:** V toggles walk/orbit | `p3-08-cube-keyboard-34` |
| 8 | Esc chain | Help → Esc closes it; nothing else open → stays in Orbit. OK | — |
| 9 | Save | Enter in "Nom du rig…" **does not save**; Tab → Enter on Sauver saves | — |

Reduced motion is respected everywhere I measured: flights are cuts, and the cube re-orients instantly.

---

## 4. Fohhn Designer vs TekPractice, per journey

Fohhn is described from the inventory (§3) and two local screenshots, in my own words. TekPractice must copy the **interaction model and layout ideas only**, never their look, icons, wording or data.

| Journey | Fohhn Designer does | TekPractice does | Gap | Sev. |
|---|---|---|---|---|
| Open | Opens a project from a list of project cards (thumbnail, last edit). The editor then shows a large 3D view with a menu bar across the top, a context panel on the left, a tool rail on the right and a status bar | Onboarding → a level, or the dashboard. The Sandbox is a walk view with two floating cards | No project/place concept, no editor shell. The viewport is fragmented by floating cards | P1 |
| Choose a place | The room is part of the project, with a room menu, global room properties, and room import or a wizard | A `<select>` of 32 generated rooms in the shelf; a full reload | No visual place picker; switching loses work | P1 |
| Inventory | "Add loudspeaker" from a menu, with a searchable product picker grouped by family | Space → modal, grouped and searchable, with KB sheets (good) | No thumbnails or tabs; a modal, not a drawer; few PA devices | P2 |
| Place / move / rotate | Objects have numeric position and rotation XYZ in a properties panel; tools for duplicate, mirror, aim at point and align | Walk + aim + click; a box ghost; R = 90° before the drop; move = pick up and re-place | No properties, no numeric pose, no move or rotate after placing, no duplicate or aim | P1 |
| Select + orbit/zoom | Left-drag orbits around a pivot, the wheel dollies to the cursor, right-drag pans, 3 camera presets | Same gestures in Orbit, a click flies to the device, Vue 1/2/3 | **Parity (good).** Only the placement forcing walk view breaks the flow | — |
| Navigation cube | A small cube with its own canvas in the corner of the view; clicking a face snaps to that view; axis lines | A DOM cube with 6 faces + 4 vertical ¾ tabs + ↺ ⌂ ↻, numpad keys | Fohhn's evidence covers faces only. The brief asks for 26 zones; we have 10, with tiny ¾ tabs and no corners | P1 |
| Reach all sides | Snap views + orbit around a clean, light room shell; grid and axes | Snap views + orbit. Gear becomes specks at overview distance, the room box clips, the top view is rotated | Readability at overview; no "fit selection" | P2 |
| Patch cables | (Fohhn has no cabling; a speaker system is designed, not wired) | Focus a device → click a port → right-click out → focus the target → click a port. Labels hide the ports | TekPractice's own strength, but the port legibility and target size hurt | P1 |
| Read results / errors | A colour legend with fixed limits in the top corner, result labels on the plane, a statistics panel (mean, σ, max, min, count), and a status bar naming the active result. A "*" title marks unsaved changes | A transient toast in English; no status, no legend, no persistent list | No status bar, no error list, no error at the port, no French | P1 |
| Listen / results | Simulation run (F9) → coloured SPL map on the listener plane + histogram | **No audio, no coverage, no "signal OK"** | The heart of the brief is missing (Phase 4) | P0 |
| Save & reload | Explicit save + timed autosave; snapshots as an immutable history tree | A manual named rig at the bottom of the shelf; no autosave; a reload loses the scene | No autosave, no dirty marker | P1 |
| Change place | The room is edited inside the project; the speakers can move with it | Reload; the setup is dropped | Lost work | P1 |
| Esc | Esc returns to the select tool (documented) | A documented 6-step priority chain; it works | Parity | — |
| Keyboard | Ctrl+Z/Y, Ctrl+S, Del, Alt+H, numpad views | Numpad views, Alt+H, Space/H/V/R/X/F; **no undo/redo, no Del, no save key**; Tab trapped on the canvas | Undo/redo is missing; keyboard access is blocked | P0 (a11y), P1 (undo) |
| Performance | Not measured (Fohhn shows a long dark loading overlay on open) | 60 fps GPU; 8–16 fps software GL; renders continuously at idle | Idle rendering | P1 |

---

## 5. Bug table

The severity scale is the brief's: **P0** blocks use · **P1** hurts a lot · **P2** polish. "Suspected file" comes from grepping `src/`, `content/` and `index.html`; the line numbers are from `36cfa5a`.

| ID | Persona | Steps | Expected | Actual | Screenshot | Sev. | Suspected file |
|---|---|---|---|---|---|---|---|
| CA-01 | P3 | Load `?level=sandbox`; press Tab repeatedly | Tab walks through the HUD (level nav, room, save, cube, presets), with a visible ring | Focus stays on `<body>` for 45 Tabs, with no ring: Tab is swallowed to cycle devices. No HUD control is reachable without a mouse, and there is no skip link | `p3-02-tab-stuck-on-body.png` | **P0** | `src/scene/FocusPatch.ts:261-277` (`onKey` Tab when `inHud` is false), `src/scene/focusMachine.ts:164` |
| CA-02 | P3 | Focus a device with Tab + Enter; try to take a cable | A key cycles the ports, Enter picks a port / connects (ADR-0008 a11y) | Tab cycles devices and Enter re-focuses; there is no keyboard path to a port. Patching is impossible without a mouse (WCAG 2.1.1) | `p3-07-keyboard-no-port-selection.png` | **P0** | `src/scene/focusMachine.ts` (`TAB`/`ENTER` reducers), `src/scene/FocusPatch.ts` |
| CA-03 | P1 | Wire the QL1 + SM58 + 2 × K12; look for sound or "signal OK" | ▶ test with a song when the chain is valid; "Micro OK"; the speakers come alive; a status "Signal OK / X erreurs" | Nothing. Only a "RIG PROPRE" toast. The catalog has no mains source, so `power-in` can't be fed and "powered" can't be modelled. No audio code exists | `p1-37-patched-overview.png` | **P0** (feature gap, Phase 4) | `content/catalog.json` (no `mains-power` source), new `src/acoustics/`, `src/game.ts` |
| CA-04 | P2, P1 | Open the default URL as a newcomer | Opens in "Mode Création" → "Choisir un lieu" cards | Onboarding → level A1 → readiness dashboard. The place choice is buried in the Sandbox shelf | `p2-01-first-screen-onboarding.png`, `p2-02-landed-a1-english.png` | P1 (gap, Phase 1) | `src/main.ts` (router), `src/ui/onboarding.ts`, `src/ui/dashboard.ts` |
| CA-05 | P1, P3 | Click every cube zone from Face, Droite, Arrière, Dessus and ¾ | 26 zones (6 faces, 12 edges, 8 corners), generous hit areas, every view in one click | 10 zones (6 faces + 4 vertical ¾ tabs). No corners or top/bottom edges. From a pose only 3–5 zones are hittable; the ¾ tabs are 7–15 px wide; Dessous is never mouse-reachable from above and has no key | `p1-20-cube-face.png` … `p1-24-cube-34-face-droite.png` | P1 | `src/camera/viewCube.ts` (`ALL_FACES`), `src/ui/viewCube.ts` |
| CA-06 | P1, P3 | 1366×768, Sandbox, Orbit view | Cube, presets and coach hint never overlap other HUD | ↺ ⌂ ↻, "Vue 1/2/3", "Enregistrer ici" and the coach bubble sit on top of the "Étagères" shelf (the room select and palette chips are hidden). Fine at 1920 | `p1-12-home-overview.png`, `p3-06-keyboard-focus-device-overlaps.png` | P1 | `index.html` (`#view-dock` l.500, `#hud-shelf` l.339), `src/ui/cameraPresets.ts` |
| CA-07 | P1 | Focus the QL1 or a K12 | Ports readable and clickable; labels small, on hover | Device and port labels are huge white planes stacked over the panel; the port pins are hidden behind them | `p1-09-select-ql1-focus-labels.png`, `p1-26-patch-ports-under-labels.png`, `p1-36-k12-ports-labels.png` | P1 | `src/scene/DeviceSpawner.ts` (`labelPlane`, `PORT_LABEL_OFFSET` l.127/340/365) |
| CA-08 | P1 | Place a speaker on the left side of the room; click it | Any visible device is clickable; the viewport is ≥ 60 % free | The objectives card + shelf cover about 30 % of the 3D view at 1366. A K12 at x ≈ −5.75 m sat under the shelf, and focusing it failed in all 4 P1 runs | `p1-27-overview-cables-invisible.png` | P1 | `index.html` (`#hud-objectives`, `#hud-shelf`), `src/ui/hud.ts`, `src/ui/shelf.ts` |
| CA-09 | P1 | Patch SM58 → QL1 in-mic-1 (cable in hand, target focused, click the port) | Either it connects or a message says why not | 1 of 12 attempts across the runs failed with **no feedback at all** (no toast, cable dropped). The likely cause is a click landing on a label or an off-port pixel (see CA-07) | `p1-26-patch-ports-under-labels.png` | P1 | `src/scene/FocusPatch.ts` (port pick / `portUnderPointer`) |
| CA-10 | P1 | Move a placed QL1 | Drag (or a gizmo / properties x, y, z) moves it; cables follow | Dragging only turns the camera. Move = X (pick up, cables unplugged, new instance id) then re-place from the inventory | `p1-07-move-is-pickup-x.png` | P1 | `src/scene/ExploreController.ts:334`, `src/scene/Placement.ts`, `src/game.ts:518-560` |
| CA-11 | P1 | Rotate a placed speaker | R rotates by 15° (Shift free); tilt and height steppers | R works only on the ghost, in 90° steps; no rotate after placement, no tilt, no height | `p1-05-placing-ghost-box.png` | P1 | `src/explore/placement.ts` (`rotateStep`), `src/scene/Placement.ts:62` |
| CA-12 | P1 | Inventory → "Placer dans le monde" from Orbit | Ghost of the real model in the current view, snapping to floor/stage/stands | Switches to walk view; the ghost is a 0.5 m amber box; aiming depends on walking | `p1-05-placing-ghost-box.png`, `p3-05-placing-keyboard.png` | P1 | `src/ui/exploreHud.ts:210-214` (`ensureExplore`), `src/scene/Placement.ts:24-59` |
| CA-13 | P1, P3 | Change the room with the select (mouse or ArrowDown) | Change place without reload; warn or keep the setup; keyboard browsing doesn't commit | A full page reload; all devices and cables are lost with no warning. ArrowDown on the closed select navigates at once (WCAG 3.2.2) | `p1-33-change-place-empties-scene.png`, `p3-03-arrow-on-select-navigated.png` | P1 | `src/ui/shelf.ts:111-113` |
| CA-14 | P1, P3 | Build a rig; reload; press Enter in "Nom du rig…" | Autosave of the live setup, a dirty marker, Enter saves | A reload loses everything; save is manual only; Enter does nothing | `p1-30-reload-loses-scene.png` | P1 | `src/ui/rigStore.ts`, `src/ui/shelf.ts` (rig form) |
| CA-15 | P1, P2 | Make a wrong connection (power-in → in-mic-2) | A French explanation at the port, plus a persistent error count/list | A transient English toast ("DIRECTION MISMATCH — Signal flows one way…"); nothing at the port, no status bar | `p1-28-error-toast-english.png` | P1 | `content/catalog.json:467` (rules `teach` text), `src/ui/hud.ts` (toast) |
| CA-16 | P1, P2 | Make any rule mistake | Real mentor tip, or nothing | "CONSEIL D'OSCAR [À REMPLACER PAR OSCAR — …]" ships live; 14 placeholders | `p1-28-error-toast-english.png` | P1 | `content/coach/tips.json`, `src/ui/coach.ts` |
| CA-17 | P2 | Land in A1 after onboarding | A French UI with English technical terms only | Title, brief and checklist are in English; raw port ids (`dante-primary`, `out-mix-1`) | `p2-02-landed-a1-english.png` | P1 | `content/levels/a1.json` … `d1.json` (`title`, brief), `src/ui/hud.ts` |
| CA-18 | all | Leave the scene idle for 10 s (software GL) | No per-frame work when idle | Idle fps = orbit fps (14.5 vs 12.7 local 1366; 8.2 vs 8.0 live 1920): it renders every frame | `p1-38-fps-scene.png` | P1 | `src/game.ts:1207` (`runRenderLoop(() => scene.render())`) |
| CA-19 | P1 | Overview after patching 3 cables | Cables visible, coloured by signal type, with a legend | Thin dark lines on the dark floor, nearly invisible; no legend | `p1-27-overview-cables-invisible.png`, `p1-37-patched-overview.png` | P2 | `src/scene/CableRenderer.ts`, `src/design/tokens.ts` (`cable`) |
| CA-20 | P1 | Home / side / top / back views | Gear readable from the overview; "fit selection"; top view north-up | Devices are 10–20 px specks at 25.6 m; the top view keeps the heading (the stage shows on the right); the back view is clipped by the room box | `p1-12…19-side-*.png` | P2 | `src/scene/ViewDirector.ts`, `src/scene/CameraRig.ts`, `src/camera/viewCube.ts` (`faceAngles` dessus) |
| CA-21 | all | Look at the chrome | Nuit/Papier/Ambre, Tektur + IBM Plex Sans, square corners | White rounded cards, blue `#2E5FE6` accent, system UI font; the brand palette exists only on the cube | `p1-01-open-sandbox-1366.png` | P2 (Phase 1 restyle) | `src/design/tokens.ts:11-50`, `index.html` (57 `border-radius` rules) |
| CA-22 | P2, P3 | Read the small grey text | ≥ 4.5:1 | `--tk-ink-faint #8B93A3` is used for 11 px text ("ÉTAGÈRES · PALETTE GUIDÉE", `#hud-counter`, the onboarding "Passer" link, win-card headings) = **3.1:1** on white | `p2-01-first-screen-onboarding.png` | P2 | `index.html:117,234,346,441`, `src/design/tokens.ts:20` |
| CA-23 | P1, P2 | Space | A bottom drawer with category tabs and 3D thumbnails, drag-and-drop | A centred modal over the scene, a text list, no thumbnails or tabs; 2 PA speakers in total | `p1-03-inventory-space.png` | P2 (gap, Phase 3) | `src/ui/exploreHud.ts:140-215`, `src/ui/inventoryModel.ts` |
| CA-24 | all | Open A1 on a school network | All assets same-origin | Babylon fetches `https://cdn.babylonjs.com/draco_decoder_gltf.wasm` at runtime (third party; blocked by filters or offline). No repo `.glb` uses Draco | — | P2 | `src/scene/DeviceSpawner.ts` (glTF loader config; set `DracoCompression` to local or off) |
| CA-25 | P3 | Reach the ¾ or Dessous views by keyboard; try "V then arrows" | Every named view on a key or a keyboard menu (`V` + arrows) and as **Vue** menu buttons | Only face/arrière/gauche/droite/dessus and ↺↻ have keys; V toggles walk/orbit | `p3-08-cube-keyboard-34.png` | P2 | `src/input/bindings.ts`, `src/input/actions.ts` |
| CA-26 | P2 | Land in A1 | The first view reads "Face" (audience side) | The cube says "Arrière" on the very first view | `p2-02-landed-a1-english.png` | P2 | `src/game.ts` (initial orbit alpha) vs `src/camera/viewCube.ts` (N3 `DEFAULT_FRONT_ALPHA`) |
| CA-27 | P1 | Placement in walk view: cursor at 30 % / 70 % of the width | The ghost under the cursor | Near the horizon the ray hits far away, and the ghost clamps to the side walls (x = ±5.75 m) | `p1-06-placed-ql1-sm58-2xk12.png` | P2 | `src/scene/Placement.ts:82-96` (`follow`, clamp) |

### Console and network (all runs)

- **Console errors:** 0; **page errors:** 0.
- **Warnings:** only `[rejected DIRECTION_MISMATCH R3] both power-in and in-mic-2 are inputs`, the intended log of the error test.
- **Failed requests:** all `net::ERR_ABORTED`, from our own navigations (room select, `goto`) cancelling in-flight chunks, thumbnails and `.glb` files. None is a 4xx or 5xx. There is one third-party fetch (CA-24).

---

## 6. What works well (keep it)

- **Orbit feel:** the camera handling is at parity with pro tools.
  - click-to-pivot on the body centre, wheel dolly to the cursor, pan, inertia;
  - Alt+H home, Vue 1/2/3, numpad views;
  - reduced-motion cuts.
- **The engine rules (R1–R3)** reject wrong patches reliably. The inventory sheets are sourced, with manual links.
- **Esc priority chain** behaves exactly as documented.
- **Dialogs** (panels, the rig-overwrite confirm) trap Tab, return focus and close on Esc.
- **No errors** in the console on any run; there are named buttons for every cube action.

---

## 7. P0/P1 list

**P0: blocks use**

- CA-01: Tab is trapped on the canvas, so keyboard users can't reach any HUD control (`src/scene/FocusPatch.ts`).
- CA-02: no keyboard path to pick or connect a port (`src/scene/focusMachine.ts`, `src/scene/FocusPatch.ts`).
- CA-03: no sound check, no "signal OK", no mains source for powered speakers (`content/catalog.json`, new `src/acoustics/`, `src/game.ts`).

**P1: hurts a lot**

- CA-04: no "Mode Création" / place-first start; newcomers land in an English level (`src/main.ts`).
- CA-05: the view cube has 10 zones, not 26; tiny ¾ tabs; no corners or top/bottom edges (`src/camera/viewCube.ts`, `src/ui/viewCube.ts`).
- CA-06: the cube dock overlaps the Sandbox shelf at 1366×768 (`index.html` `#view-dock`/`#hud-shelf`).
- CA-07: focus labels hide the ports (`src/scene/DeviceSpawner.ts`).
- CA-08: floating HUD cards cover about 30 % of the viewport; devices under them can't be clicked (`index.html`, `src/ui/hud.ts`, `src/ui/shelf.ts`).
- CA-09: a port click can fail silently (`src/scene/FocusPatch.ts`).
- CA-10: moving a device means picking it up and re-placing it, which unplugs its cables (`src/scene/Placement.ts`, `src/game.ts`).
- CA-11: rotation only on the ghost, in 90° steps; no tilt or height (`src/explore/placement.ts`).
- CA-12: placement forces walk view; the ghost is a box (`src/ui/exploreHud.ts`, `src/scene/Placement.ts`).
- CA-13: changing place reloads and loses the setup; ArrowDown on the select navigates (`src/ui/shelf.ts`).
- CA-14: no autosave; Enter doesn't save (`src/ui/rigStore.ts`, `src/ui/shelf.ts`).
- CA-15: errors are transient English toasts, not shown at the port, with no status (`content/catalog.json`, `src/ui/hud.ts`).
- CA-16: placeholder coach copy "[À REMPLACER PAR OSCAR]" is live (`content/coach/tips.json`).
- CA-17: levels A1–D1 are in English, with raw port ids (`content/levels/*.json`).
- CA-18: renders every frame at idle (`src/game.ts:1207`).

---

## 8. Assumptions and limits (logged; Oscar unavailable)

1. **Headless only.** The real-GPU numbers come from headless Chromium with ANGLE D3D11 on this PC (RTX 3060 Ti), not from a school laptop. The SwiftShader numbers stand in for a weak machine.
2. **Speakers:** "2 active speakers" = 2 × `qsc-k12-2`, the only powered PA top (DBR12 is the wedge in A1). The catalog has no mains source, so power stays unwired in every run.
3. **Patch diagnostic:** to separate "patching is broken" from "my layout was bad", one run set up the devices with the documented `SPAWN` intent (`window.__audioSim.dispatch`). All the patching itself was done with real mouse clicks; 3/3 worked.
4. **Paths:** the report sits at the worktree root `docs/audit/`, next to `audit-for-claude.zip`, not in `tekpractice-sim/docs/`.
5. **Fohhn:** severity in §4 rates TekPractice's gap, not Fohhn. Fohhn's view cube is documented only as "click a face"; the 26-zone target comes from the expert council in the brief.
6. **Evidence format:** the qa-web skill's evidence layout (`docs/verify/...`) was not used; the brief's deliverable paths take precedence. No video or trace was kept.
7. **Screens:** the screenshots were reduced from about 275 captures to 54. The largest were palette-quantised (≤ 300 KB each, about 4.6 MB in total). They are TekPractice only.
