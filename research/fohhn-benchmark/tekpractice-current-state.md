# TekPractice current state: three refs, ten areas, snapshot readiness

> **Product distinction, kept throughout this study:** TekPractice is an *educational wiring and set-building game* for BTS MAV option Son. Fohhn's tools are *professional acoustic planning and measurement tools*. This file describes only TekPractice as it is today. Proposals are in `tekpractice-crosswalk.md`, `tekpractice-data-model.md` and `prototype-brief.md`.

**Five facts that shape every proposal:**

1. TEK Brain rooms already hold **350 speaker and gear placements** (with yaw) and **17 broadband RT60 ranges**, but `tools/sync-rooms.ts` drops them before they reach the game (§2.5, gap 1).
2. The catalog has **no acoustic fields**. Speaker specs exist only as free-text strings in the KB (§2.3).
3. **`RigSnapshot` is already an engine term** (the pure graph view, ADR-0001), so the new feature must not be called "snapshot" in code (§3).
4. `SavedRig` (localStorage, v1) is the closest thing to a saved state. It has no room id, no pitch, no tests for the position round-trip, and it overwrites silently (gaps 12–13).
5. The rule system is closed (`^R[1-8]$`, 4 logic modules), so placement or SPL checks need an ADR plus schema work (gaps 8–9).

- **Auditor:** tekinspi (read-only). Scan date: 2026-10-24.
- **Refs scanned:**
  - `origin/main` = f90f9a2, read from worktree `Tekonest-wt/fohhn` (HEAD 72d06ef = main plus 2 agent-registry files, no `tekpractice-sim` difference).
  - `feature/tekpractice-explore-controls` = 92a005e, worktree `Tekonest-wt/explore`. It merges `research/tekbrain`, and its `knowledge-base/` is byte-identical to tekbrain's (`git diff --stat research/tekbrain feature/... -- knowledge-base` is empty).
  - `research/tekbrain` = 26b5a0f, worktree `Tekonest-wt/tekbrain`. Inside `tekpractice-sim/` it differs from main only in `.claude/agents/{designer,developer}.md`. All its value is in `knowledge-base/`, which does **not exist at all on main**.
- **Branch shape:** merge-base with main is fcaa9d8. The feature branch is 74 commits ahead of it, tekbrain 59. Main is 2 commits ahead of the merge-base (agent registry only). `git diff --stat origin/main feature/... -- tekpractice-sim` shows 130 files, +18 374 / −47.
- **Evidence labels:** **[code]** = I read the code or data. **[run]** = I confirmed it by running something: vitest in the explore worktree, or PowerShell scripts that parsed the JSON files. **[derived]** = computed from [run] output and is not a separate run.

## 0. Method (deep-scan passes 0–2)

The deep-scan skill folder holds only `SKILL.md`. The files `modules/00-artifact-classifier.md`, `01-pass-surface.md` and `02-pass-structural.md` it points to **do not exist**, so I applied the passes as `SKILL.md` describes them. The Oasis recurring patterns were skipped, as instructed.

- **Pass 0 (classifier):** the artifact is a code + content-data system (a TS engine, a Babylon scene/UI, JSON content, plus a separate knowledge base). For this question, "complete" means each of the 10 areas has: a typed model, a data source, persistence (where relevant) and tests, plus a clear path for room/speaker data to reach the engine.
  - **Business invariants** (from `tekpractice-sim/CLAUDE.md`): `catalog.json` and `levels/*.json` are the source of truth and are never generated over. The engine never imports `logic/*`. The UI dispatches intents and never mutates the graph. R1–R3 are engine invariants, and R4–R8 come only through `logicChecks`. Assets never block gameplay. A localStorage version mismatch means reset + notice. Real DSP is out of scope (YAGNI).
- **Pass 1 (surface):** the file inventory per ref, the data shapes and the test inventory (sections 1–4).
- **Pass 2 (structural):** seams. How room data flows (KB → sync tool → content → zod → layout → scene), how a saved rig flows (graph + scene → localStorage → reload), and where spatial data stops: it never reaches the rule engine (sections 5–6).

## 1. Status of the 10 areas

| # | Area | Status | Main evidence |
|---|---|---|---|
| 1 | Game loop | **Implemented on main**. Explore adds walk/placement wiring. | `src/main.ts` router → `src/game.ts:bootGame` (main 108–569; explore 126–814) |
| 2 | Levels | **Implemented on main** (a1, b1, c1, d1). **15 draft levels only on feature** (`content/levels/drafts/*`, not loaded by the game). | `tools/schemas.ts:95-111` `Level`; `src/main.ts:29` hard-coded `LEVELS` |
| 3 | Device catalog | **Implemented on main**: 24 devices, 26 connector types, 16 signals, 8 rules. **Feature adds** `kb-sheets.json` (23 sheets) and `proposals/catalog-proposals.json` (134 proposed devices, unreviewed). **Rich specs only on research/tekbrain** (`knowledge-base/equipment/*.json`). | `tools/schemas.ts:50-91`; `content/catalog.json` |
| 4 | Connector / signal model | **Implemented on main** | `src/engine/ConnectionGraph.ts:94-119` (R1/R2/R3); `types.ts` |
| 5 | Room / environment data | Main: **7 environment presets** (backdrop colours + camera + optional glb set). Feature: **32 procedural rooms** (`content/rooms/*`). research/tekbrain: **full room templates** with RT60, surfaces, gear positions, power and patch points. | `schemas.ts:114-141`; `src/explore/roomSchema.ts`; `knowledge-base/tek-brain/rooms/*.json` |
| 6 | 3D scene structure | **Implemented on main** (Babylon, DeviceSpawner, CableRenderer, glb env set). **Procedural room geometry only on feature** (`RoomBuilder.ts`). | `game.ts`, `scene/*` |
| 7 | Camera & controls | Main: ArcRotate orbit + Focus fly (ADR-0008). **Explore walk view + remappable input only on feature** (ADR-0010). | `scene/CameraRig.ts`, `scene/ExploreController.ts`, `src/input/*` |
| 8 | Interaction system | Main: Focus & Patch click-click state machine + intents. Feature adds placement ghost, `SPAWN{position,rotationY}`, `REMOVE`, pick-up undo toast, inventory. | `scene/focusMachine.ts`, `ui/intents.ts`, `scene/Placement.ts` |
| 9 | Rule evaluation | **Implemented on main** (R1–R3 at connect time, R4–R8 through injected logic modules). **82 machine-checkable rules exist as data only on research/tekbrain**, 15 marked `evaluable_now`, none wired. | `engine/RuleEvaluator.ts`, `engine/LevelRunner.ts`, `logic/*` |
| 10 | Save / load state | Main: `ProgressStore` (v2), named rigs `SavedRig` v1 (no positions), onboarding, render pref, coach-seen. Feature adds `SavedRig.positions` and `explore-settings`. **Exam results are not persisted.** | `ui/ProgressStore.ts`, `ui/shelf.ts:108-154` |

## 2. Area details (files, types, data)

### 2.1 Game loop [code]

- **`src/main.ts`** routes by URL:
  - no `?level` → dashboard / onboarding (pure DOM, Babylon never boots);
  - `?level=sandbox` → `bootGame` with a synthetic level (`devices: []`, `logicChecks: R4..R8`, `environment: 'studio'`);
  - `?level=<id>` → `bootGame`, or `bootGame2D` when `decideRenderer` picks 2D.
  - On the feature branch, the sandbox branch also lazy-loads `?room=<id>` through `import.meta.glob('../content/rooms/*.json')` plus `roomLayout` and `RoomBuilder` (explore `src/main.ts` ≈42–88).
- **`src/game.ts` `bootGame(registry, rawLevel, opts: BootOptions)`** is the composition root. It builds `ConnectionGraph` → `RuleEvaluator` (logic modules injected) → `LevelRunner`, then the scene, HUD and exam. The loop is **event-driven, not ticked**: `dispatch(intent)` → graph mutation → `refresh()` → `runner.check(graph)` → HUD, toasts, progress (main 288–331, 407–440). Babylon `runRenderLoop` only renders.
- **`BootOptions`:**
  - main: `{ sandboxGuided?: boolean }`;
  - feature (game.ts 111–121): adds `room?: { file: RoomFileT; layout: RoomLayout; build(scene) }` and `roomIndex?: {id,name_fr}[]`.
- **`window.__audioSim`** (test hook): `dispatch, state, level, canConnect, portScreen, deviceScreen, view, glowCount, hints, assets`. The feature adds `explore()`.
- **Tests:** e2e `a1.spec.ts`, `levels.spec.ts`, `sandbox.spec.ts`, `dashboard.spec.ts`, `onboarding.spec.ts`, `render2d.spec.ts`. Unit tests cover engine pieces (see §4). No unit test covers `bootGame` itself.

### 2.2 Levels [code]

- **Schema** `tools/schemas.ts:95-111` `Level`:

  ```ts
  { id; version; domain: 'live'|'radio'|'duplex'|'post'; title; brief;
    devices: {instanceId, deviceId}[]; requiredChain: {from: PortRef, to: PortRef}[];
    logicChecks: string[]; successMessage; examSeconds?; environment?;
    layout?: Record<instanceId, [x,y,z]> }   // .passthrough()
  ```

  - `layout` is **position only: no rotation, no mount, no room**.
- **Data:** `content/levels/{a1,b1,c1,d1}.json`, registered by hand in `main.ts:29` (REVIEW-ME §6 blocker 1: the level list is hard-coded in 3 places).
- **Excerpt** `content/levels/a1.json`:

  ```json
  "requiredChain": [ { "from": {"instance":"sm58-1","port":"out-xlr"}, "to": {"instance":"rio-1","port":"in-mic-1"} }, ... ],
  "logicChecks": [], "examSeconds": 240, "environment": "plateau",
  "layout": { "k12-1": [-2.4, 0, 0.3], "dbr12-1": [-0.7, 0, 0.1], ... }
  ```

- **Feature only:** `content/levels/drafts/*.json` (15 drafts + `index.json`), generated from TEK Brain scenarios. They are not in `LEVELS` and not validated as playable. Each carries the room as metadata only:

  ```json
  "draft": {"status":"draft — needs Oscar's review","from_scenario":"knowledge-base/tek-brain/scenarios/monitoring.json#band-soundcheck-four-wedge-mixes",
            "room_id":"bar-club-stage-small","difficulty":3,"unmapped_nodes":[...],"unresolved_edges":[...]}
  ```

- **TEK Brain scenarios** (research/tekbrain): 41 scenarios, **41/41 have `room_id`** [run], plus `required_gear`, `signal_flow`, `rule_ids`, `procedure_ids`.
- **Tests:** `tests/engine/evaluatorRunner.test.ts` (8), e2e `levels.spec.ts` (5), `a1.spec.ts` (3). Feature: `tests/tools/proposals.test.ts` (4) covers draft/proposal generation.

### 2.3 Device catalog [code + run]

- **Schema** `schemas.ts:50-63` `Device`:

  ```ts
  { id (kebab); label; levels: string[];
    realWorld: { brand, model, category, typicalUse, notes };
    ports: Port[]; controls?: (ToggleControl | EnumControl)[] }
  ```

  - `Port = { portId; dir: 'in'|'out'|'bidir'; connector; signal; flags?: PortFlag[] }`.
  - `PortFlag` = `providesPhantom | requiresPhantom | isClockMaster | isClockSlave | isMicInput | isMonitorOut | isOnAirTally | isDantePrimary`.
  - **No dimensions, no specs, no SPL/coverage/sensitivity, no impedance.** The Set-System doc *plans* `dimensions: {w,h,d}` (§2.5).
- **`content/catalog.json`** [run]: version 1, 26 connectorTypes, 16 signalTypes, 24 devices, 8 rules. Its `meta.scope` says "Only gear required by starter levels A1–D1".
  - Speaker-type devices: `qsc-k12-2`, `yamaha-dbr12` (powered-speaker), `genelec-8030c` (studio-monitor).
  - A grep for `spl|coverage|dispersion` returns 0 hits [run].

  ```json
  { "id": "qsc-k12-2", "label": "QSC K12.2", "levels": ["a1"],
    "realWorld": { "brand": "QSC", "model": "K12.2", "category": "powered-speaker", ... },
    "ports": [ { "portId": "in-line-a", "dir": "in", "connector": "xlr3-f", "signal": "line-level-pro" },
               { "portId": "thru-out-a", "dir": "out", ... }, { "portId": "power-in", ... "signal": "mains-power" } ] }
  ```

- **Feature only:** `content/kb-sheets.json`, generated by `tools/build-kb-sheets.ts`. It has 23 device sheets for catalog ids. Specs are **free-text tuples**:

  ```json
  "qsc-k12-2": { "category": "loudspeakers", "subType": "active-powered",
    "keySpecs": [["max spl","132 dB @ 1 m peak; 126 dB @ 1 m continuous"], ["coverage","75° nominal, axisymmetric"], ...],
    "connectors": [...], "manualUrl": "...", "productUrl": "..." }
  ```

  - Typed as `KbSheet` / `InventoryModel` in `src/ui/inventoryModel.ts`. It is shown in the inventory panel only; the engine never reads it.
- **Feature only:** `content/proposals/catalog-proposals.json`: `{generated, status: "proposal — needs Oscar's review", devices[134], skipped[23]}`. Same `Device` shape as the catalog (no specs). It includes 19 speakers/monitors, for example `l-acoustics-kara-ii`, `db-audiotechnik-v-sub`, `nexo-p12` [run].
- **research/tekbrain:** `knowledge-base/equipment/*.json` (22 category files) with `schema/device.schema.json`.
  - Each device has `key_specs` (free keys, string values with units), `connectors`, `manuals`, `sources` (with confidence) and `tekpractice: {in_catalog, catalog_id, sim_value}`.
  - Speakers [run]: `loudspeakers.json` has 18 devices, **18/18 with a max-SPL key and 18/18 with a directivity/coverage key**, 5 with sensitivity. `studio-monitors.json` has 16 (13 with SPL). `measurement-tools.json` has 13 (SPL meters, Smaart, REW).

  ```json
  "id": "l-acoustics-kara-ii", "sub_type": "line-array",
  "key_specs": { "max_spl": "142 dB ([KARA II 70]) (peak level at 1 m, free field, pink noise crest factor 4)",
                 "directivity": "Vertical: depending on number of elements...; Horizontal: 70° / 110° symmetric or 90° asymmetric (-6 dB)",
                 "rigging": "...inter-enclosure angles [deg]: 0, 1, 2, 3, 4, 5, 7.5, 10", "weight": "26 kg / 57 lb" },
  "tekpractice": { "in_catalog": false, "catalog_id": null, "sim_value": "high" }
  ```

- **Tests:** `catalogLoader.test.ts` (4), `tests/tools/kbSheets.test.ts` (2, feature), `tests/ui/inventoryModel.test.ts` (5, feature), `npm run validate:catalog` (`tools/validate-catalog.ts`). KB side: `knowledge-base/tools/validate.py`, `validate_tekbrain.py`, `tests/test_build_index.py`.

### 2.4 Connector / signal model [code]

- **`src/engine/types.ts`:**
  - `PortRef {instance, port}`.
  - `ErrorCode` (12 codes).
  - `ControlValue = boolean | string`.
  - `ConnectResult = Ok | TypedError{code, ruleId?: 'R1'|'R2'|'R3', message}`.
- **`ConnectionGraph.ts`:**
  - private maps `instances: Map<id, {device, controls: Map}>`, `connections: Map<connId, {a,b}>`, `occupied: Map<portKey, connId>`;
  - methods `addInstance`, `removeInstance`, `clear`, `canConnect` (dry run), `connect`, `disconnect`, `connectionAt`, `getConnections`, `setControl`, `getControl`, `snapshot()`.
- **Invariants** are enforced in `canConnect` (lines 94–119): R3 direction, R1 `connectorById.matesWith`, R2 signal identity. Port occupancy is one cable per port.
- `snapshot(): RigSnapshot` exposes **effective** flags: a toggle with `enables` gates a flag (lines 172–198).
- **Tests:** `connectionGraph.test.ts` (21), `decoupling.test.ts` (1: the engine never imports logic).

### 2.5 Room / environment data [code + run]

**Main: `content/environments/*.json` (7 presets).** These are `plateau`, `radio`, `studio`, `theatre`, `plein-air`, `reportage` and `blanc`. The schema is `schemas.ts:114-141` `Environment`:

```ts
{ id; name; backdrop: { clearColor, floorColor, floorSize: [w, d] };
  set?: { glb; position?; rotationY?; scale? }; camera: { alpha, beta, radius, target } }
```

The environments are imported by hand in `game.ts:74-91`. Three glb rooms exist: `public/assets/environments/{live-stage,radio-booth,theatre-stage}.glb`. Excerpt from `theatre.json`:

```json
{ "id": "theatre", "name": "Théâtre", "backdrop": { "clearColor": "#F6F4F2", "floorColor": "#FBF9F6", "floorSize": [20, 16] },
  "camera": { "alpha": -1.5708, "beta": 0.85, "radius": 10, "target": [0, 0.5, 0.6] }, "set": { "glb": "theatre-stage.glb" } }
```

**Feature: `content/rooms/*.json` (32 rooms + `index.json`).** They are produced by `tools/sync-rooms.ts` from the KB. That tool's `KEEP` list (line 17) is `id, name_fr, name_en, family, size, review, dimensions_m, zones, openings, procedural, lighting`, plus a derived `source_count`. It therefore **drops `rt60_s`, `surfaces`, `gear_positions`, `power_points`, `patch_points`, `licensed_dressing`, `sources`, `description` and `not_found_log`.**

The zod schema is `src/explore/roomSchema.ts:9-42` `RoomFile`. It is a plain `z.object`, **not passthrough**, so unknown keys would be stripped anyway:

```ts
{ id; name_fr; name_en?; family?; size?: 'small'|'medium'|'large'; review?;
  dimensions_m: { length|width|height: {min, typical, max} };
  zones: { id; kind: string; rect_m: [cx, cz, w, d]; floor_y_m? }[];
  openings: { wall: 'front'|'rear'|'left'|'right'; kind; offset_m; width_m; height_m }[];
  procedural: { wall_color, floor_color, ceiling_color, prop_hints[] }; lighting: { mood, color_temp_k }; source_count? }
```

`src/explore/roomLayout.ts:13-42` builds the layout. `RoomTemplate` → `roomLayout()` → `RoomLayout`, which has these fields:

- `width`, `length`, `height`;
- `wallSegments: WallSegment[]`;
- `colliders: Box[]`;
- `zones: {id, kind, x, z, w, d, y}[]`;
- `floorAt(x, z)`;
- `spawn: {x, z, yaw}`, which is the FOH zone, or else the control-room zone.

Excerpt from `content/rooms/concert-hall-medium.json`:

```json
"dimensions_m": { "length": {"min":25,"typical":32,"max":40}, "width": {...,"typical":18.1}, "height": {...,"typical":9} },
"zones": [ {"id":"scene","kind":"stage","rect_m":[0,-11.5,14,9],"floor_y_m":1.3},
           {"id":"fosse","kind":"audience","rect_m":[0,3,18.1,20],"floor_y_m":0},
           {"id":"regie-facade","kind":"foh","rect_m":[0,8,4,3],"floor_y_m":0}, ... ],
"lighting": { "mood": "salle noire, ...", "color_temp_k": 3200 }
```

**research/tekbrain: `knowledge-base/tek-brain/rooms/*.json` (32 rooms).** The schema is `knowledge-base/schema/room.schema.json`. Its required fields are:

- `id`, `name_fr`, `name_en`, `family`, `size`, `description`;
- `dimensions_m`, `coordinate_system`, `surfaces`, `rt60_s`;
- `zones`, `gear_positions`, `power_points`, `patch_points`, `openings`;
- `lighting`, `procedural`, `licensed_dressing`, `sources`, `review`.

Key sub-shapes:

- `rt60_s`: `"not found" | {min, max, band_note?, source_url?}`.
- zone `kind` enum: `stage | foh | monitor-world | control-room | live-room | iso-booth | vocal-booth | audience | backstage | gallery | booth | pit | desk | machine-room | other`.
- `gear_positions[]`: `{equipment_id, zone, position_m: [x,y,z], rotation_deg? (yaw, 0 = facing +z), note?}`.

Excerpt from the tekbrain `concert-hall-medium.json`:

```json
"rt60_s": { "min": 0.6, "max": 1.6, "band_note": "Valeur préférée à 500 Hz ... non mesurée dans ces salles", "source_url": "https://www.dpamicrophones.com/..." },
"surfaces": [ { "surface": "walls", "material": "murs noirs traités acoustiquement, pendrillons...", "finish_note": "..." }, ... ],
"gear_positions": [ {"equipment_id":"l-acoustics-kara-ii","zone":"scene","position_m":[-6.5,6,-7.2],"rotation_deg":0,"note":"Ligne gauche accrochée"},
                    {"equipment_id":"l-acoustics-ks28","zone":"scene","position_m":[-4,0,-7.4],"rotation_deg":0},
                    {"equipment_id":"l-acoustics-x15-hiq","zone":"scene","position_m":[0,1.3,-9],"rotation_deg":180,"note":"Wedge chant"} ],
"power_points": [ {"position_m":[-8.6,1.3,-15.2],"type":"p17-125a-3ph"} ], "patch_points": [ {"position_m":[8.4,1.3,-13.6],"type":"stage-box-32ch-dante"} ]
```

Room statistics [run]:

- 32 rooms; **17/32 have a numeric RT60** (all broadband min–max), 15 are `"not found"`.
- 350 `gear_positions` in total (5–15 per room).
- Every room has power and patch points (`eng-outdoor-reportage` has 0 patch points).
- 12/32 rooms have an `audience` zone. There are no explicit listener points or seats.
- All rooms are `review: needs-oscar-review`, and many dimensions are estimates listed in `not_found_log`.

**Tests:**

- `tests/explore/roomSchema.test.ts`: 35 tests (parameterized: every content room parses).
- `tests/explore/roomLayout.test.ts`: 7.
- e2e `rooms.spec.ts`: 4 (FOH spawn, raised stage eye height, unknown room fallback, fps report).
- No test checks that the KB → content sync is lossless. It is lossy on purpose.

### 2.6 3D scene structure [code]

- **Main:** one `Engine` + `Scene`, `ArcRotateCamera`, hemispheric + directional light, a ground mesh sized by `env.backdrop.floorSize`, and an optional glb `env:set` loaded non-blocking (game.ts 129–187).
  - `DeviceSpawner.spawn(deviceId, position, instanceId): DeviceInstance` (`scene/DeviceSpawner.ts:25-35,143`).
  - `DeviceInstance` = `{ instanceId; deviceId; root: TransformNode; portMarkers: Map<portId, Mesh>; assetStatus: 'glb'|'placeholder'; modelReady: Promise<boolean>; dispose() }`.
  - A placeholder box is sized by category (`console: [1.0, 0.25, 0.55]`, ...).
  - `CableRenderer` draws catenary cables (`cablePath.ts`, `CableBudget`).
  - `PortPoint` (`snap.ts`) = world-space port anchors, re-anchored when the glb loads.
- **Device poses** live **only in the scene** (`inst.root.position/rotation`), never in `ConnectionGraph`.
- **Feature:** `scene/RoomBuilder.ts:28-87` `buildRoom(scene, room, layout)`. It builds the floor, a ceiling plane, door-cut wall planes, raised-zone boxes (`floor_y_m > 0.05`) or tinted zone decals (`ZONE_TINT` by kind) and a hemispheric light coloured by `kelvinToColor(color_temp_k)`. Room meshes are not pickable.
  - When a room is active, the room footprint replaces the env floor and camera (game.ts 160–196).
- **2D fallback** (`game2d.ts`, `render/Render2D.ts`): levels only, no sandbox, no rooms (REVIEW-ME §7).
- **Tests:** `cablePath.test.ts` (9), `focusArchitecture.test.ts` (5: the scene never imports the graph), `detect.test.ts` (8), e2e `render2d.spec.ts` (3). `RoomBuilder` has no unit test; it is covered only by `rooms.spec.ts`.

### 2.7 Camera & controls [code]

- **Main:** `scene/CameraRig.ts`.
  - `CameraPose {alpha, beta, radius, target}` and `FrameTarget {center, boundingRadius}`.
  - It flies between the env "Ensemble" pose and an auto-framed Focus pose (ADR-0008). Reduced motion turns flights into cuts.
- **Feature** (ADR-0010):
  - `CameraDirector` interface (`flyToDevice`, `flyToEnsemble`); `CameraRig.flyToPose()`.
  - `scene/ViewDirector.ts` hands the camera between the walker and focus (`Walker`, `poseFromEye`).
  - `scene/ExploreController.ts` (442 lines) has `BaseView = 'explore'|'orbit'`, a UniversalCamera, pointer lock, the crosshair, the Esc chain and `snapshot()`.
  - Pure layers:
    - `src/input/actions.ts`: 18 `Action`s.
    - `src/input/bindings.ts`: `Bindings = Record<Action, string[]>` by `KeyboardEvent.code`; `RESERVED_CODES` = `Escape`, `Tab`, `Enter`, `NumpadEnter`.
    - `src/input/keyboardState.ts`, `mouseGesture.ts` (drag threshold 10 px), `layoutLabels.ts` (AZERTY/QWERTY).
    - `src/explore/movement.ts`: `WALK_SPEED 1.4`, `RUN_MULT 2`, `EYE {0.9, 1.65, 1.9}`, `PITCH_LIMIT 85°`.
    - `src/explore/collision.ts`: circle r 0.3 against AABB, `STEP_HEIGHT 0.25`.
    - `src/explore/escChain.ts`, `src/explore/intent.ts`.
  - Settings: `ui/exploreSettings.ts` `ExploreSettings {speedMult, sensitivity, invertY, fovDeg, reducedMotion, pointerLock, levelView, bindings}` under key `audio-sim/explore-settings`, version 1.
- **Controls in `docs/CONTROLS.md`** (feature only), keyed by physical code, remappable except Esc / Tab / Enter:

| Input (QWERTY code) | Action |
|---|---|
| W / S | Move forward / back (Z/S on AZERTY) |
| A / D | Strafe left / right (Q/D on AZERTY) |
| Q / E | Eye height down / up, 0.9–1.9 m (A/E on AZERTY) |
| Shift | Walk faster (×2) |
| Space | Toggle inventory (no jump) |
| Mouse (locked) | Look |
| ← / → | Turn (keyboard-only) |
| Page Up / Page Down | Look up / down |
| F | Focus the aimed device (also confirms a placement) |
| X | Pick up the aimed device (Sandbox) |
| R | Rotate the object being placed (90°) |
| V | Explore ⇄ Orbit |
| H | Controls help |
| Esc | Chain: free pointer → cancel placement → close top panel → drop cable → leave focus → pause menu |
| Mouse only | Left-drag = look; right-drag up/down = forward/back, left/right = strafe; left click = interact; wheel = FOV zoom |

  Defaults: the Sandbox opens in Explore; levels and the exam open in Orbit (`?view=explore|orbit` overrides). In Focus, ADR-0008 rules are unchanged.

- **Tests:** `focusMachine.test.ts` (15), `viewDirector.test.ts` (4), `tests/explore/explore.test.ts` (28), `intent.test.ts` (5), `purity.test.ts` (12: input/explore import no Babylon or engine), `tests/input/input.test.ts` (21), `exploreSettings.test.ts` (5), `controlsHelp.test.ts` (4). e2e `focusPatch.spec.ts` (6), `explore.spec.ts` (19).

### 2.8 Interaction system [code]

- **Intents** `ui/intents.ts`:
  - main: `CONNECT{a,b} | DISCONNECT{connectionId} | SET_CONTROL{instance,control,value} | SPAWN{deviceId} | LOAD_RIG{name}`;
  - feature: `SPAWN{deviceId, position?: [x,y,z], rotationY?: number}` plus a new `REMOVE{instanceId}`.
- **`scene/focusMachine.ts`** (a pure reducer):
  - `FocusState {mode: 'ensemble'|'focus', focused, selected, held: PortRef|null}`;
  - `FocusEvent` (double-click, click, port click, empty click, right click, Esc, Tab, Enter);
  - `FocusCommand` (`flyToDevice | flyToEnsemble | pickup | dropHeld | connect`).
  - `FocusPatch.ts` is the Babylon adapter.
- **Feature:**
  - `scene/Placement.ts`: a fixed 0.5×0.4×0.5 ghost box on a 0.25 m grid (`explore/placement.ts` `GRID_STEP`, `snapToGrid`), **yaw only in 90° steps** (`rotateStep`), y = `floorAt(x, z)`. Confirm dispatches `SPAWN` with pose.
  - Pick-up `removeDevice` (game.ts 440–479) snapshots the instance's wires, controls and pose, removes it, and offers a **single "Annuler" toast** that restores everything.
  - Inventory panel: `ui/exploreHud.ts` (`PanelId = inventory|help|settings|pause`), `ui/exploreToolbar.ts`, `ui/inventoryModel.ts`.
  - **Placement and pick-up are sandbox-only** (game.ts 535–543, 683–689). The exam has no inventory.
- **Tests:** `focusMachine.test.ts` (15), `inventoryModel.test.ts` (5), e2e `explore.spec.ts` (place → pick up → undo; Ramasser button; F confirms placement), `sandbox.spec.ts` (4).

### 2.9 Rule evaluation [code]

- **Catalog rules** (`schemas.ts:65-73`): `id` matches `^R[1-8]$`; `module` is `engine | logic/phantom | logic/gpio | logic/mixMinus | logic/clock`; plus `severity`, `title`, `check`, `teach`.
  - R1–R3 engine (error), R4 phantom, R5 tally (warning), R6 monitor mute, R7 mix-minus, R8 wordclock.
- **`RuleEvaluator.evaluate(graph): TeachingEvent[]`** routes the declared `logicChecks` to injected `LogicCheck = (snapshot: RigSnapshot) => ViolationDraft[]` functions. `LogicModuleName` is a **closed union of 4 modules** (`types.ts:85`).
- **`LevelRunner.check(graph): LevelState`** returns `{chainComplete, connectedRequired, totalRequired, missing, violations, won}`. A win needs the full requiredChain and zero declared violations. **No spatial or positional objective exists.**
- `RigSnapshot = {instances: {instanceId, deviceId, ports: SnapshotPort[], controls}[], connections}` (`types.ts:41-63`). It has **no position, room or acoustic data**.
- **Exam:** `ui/exam.ts` `examScore()`: score = 60 % wiring + 40 % checks − 0.5 per mistake. `ExamScore {score20, completion, checksClean, mistakes, elapsedSeconds, timedOut}` is rendered only.
- **research/tekbrain:** `knowledge-base/tek-brain/rules/*.json` (17 domain files) hold **82 rules, 15 `evaluable_now: true`** [run]. They are not wired into TekPractice. Rules that need room or position data [run]:
  - `control-room-rt60-out-of-range` (`room.rt60_tm_s`)
  - `listening-position-too-close-to-walls` (`room.listening_position_min_wall_distance_m`)
  - `monitor-wall-distance-sbir` (`room.monitor_rear_wall_distance_m`)
  - `three-to-one-spacing` (`gear_positions.mic_to_source_distance_m`, ...)
  - `mic-max-spl-exceeded` (`device.specs.max_spl_db`, `session.source_spl_at_mic_db`)
  - `spl-exposure-limit`, `spl-exposure-limit-children` (`session.spl_dba_leq15`, `session.spl_dbc_leq15`)
  - `iem-transmitter-next-to-mic-receiver`, `iem-tx-near-mic-receivers`, `antenna-distance` (`room.gear_positions`, `room.rf.*`)
  - `rigging-without-safety` (`room.flown_loads[]`)
  - `spot-mic-delay-missing`
  - Loudspeaker rules (`amp-load-impedance-too-low`, `amplifier-power-mismatch`, `speakon-pin-mismatch-sub`, `sub-top-polarity-misalignment`, `bridge-mode-load-too-low`) are all `evaluable_now: false`.
- **Tests:** `evaluatorRunner.test.ts` (8), `logic/{phantom 4, gpio 7, mixMinus 5, clock 8}`, `exam.test.ts` (6), e2e `exam.spec.ts` (3).

### 2.10 Save / load state [code]

localStorage and sessionStorage keys (all prefixed `audio-sim/`):

| Key | Owner | Shape | Versioning |
|---|---|---|---|
| `audio-sim/progress` | `ui/ProgressStore.ts` | `ProgressData {version: 2, levels: Record<id, {completedAt?, wins, mistakes: {ruleId, at}[] (cap 50)}>, activity: string[]}` | v1→v2 migrated; else reset with notice |
| `audio-sim/rigs` | `ui/shelf.ts:108-154` | `{version: 1, rigs: SavedRig[]}` | other version → ignored (`[]`) |
| `audio-sim/onboarding` | `ui/onboarding.ts:27` | `{examDate, weakRules, choices}` | — |
| `audio-sim/render` | `render/detect.ts:45` | `'2d'`/`'3d'` | — |
| `audio-sim/coach-seen` (sessionStorage) | `ui/coach.ts:71` | tip id array | — |
| `audio-sim/explore-settings` (feature) | `ui/exploreSettings.ts:26` | `{version: 1, settings: ExploreSettings}` | other version → defaults |

`SavedRig` (main `shelf.ts:110-116`; the feature adds the last field):

```ts
interface SavedRig {
  name: string; savedAt: string;
  instances: { instanceId: string; deviceId: string }[];
  connections: { a: PortRef; b: PortRef }[];
  controls: Record<instanceId, Record<controlId, ControlValue>>;
  positions?: Record<instanceId, [x, y, z, yawDeg]>;   // feature only, ADR-0010 Décision 8; still RIGS_VERSION 1
}
```

How rigs are saved and loaded:

- **Save** (sandbox only): main game.ts 477–503, feature 720–742. It copies `graph.snapshot()`; the feature adds `poseOf()`. Saving the same name overwrites silently. A rig with ≥2 connections and 0 violations calls `progress.recordWin('sandbox')`.
- **Load:** `LOAD_RIG` → `loadRigByName` (main 382–405, feature 481–509) clears the stage, respawns exact ids (the feature uses `positions` when they are 4 finite numbers, otherwise the grid), reconnects and re-applies controls. A device missing from the catalog triggers a "partiellement chargé" toast.
- **A rig does not record which room, environment or level it was built in.**

Other state:

- **Undo:** only the single pick-up "Annuler" toast (feature). There is no general history or undo stack.
- **Exam results:** not persisted (only mistakes and wins reach `ProgressStore`).

Tests:

- `progressStore.test.ts` (10), `exploreSettings.test.ts` (5), `onboarding.test.ts` (7).
- **No unit test for `saveRig`/`loadRigs`.** e2e `sandbox.spec.ts` covers "a named rig can be saved" and "a saved rig reloads" (instances, cables, readiness) but **does not check `positions`**. `explore.spec.ts` tests the pick-up undo, not a rig position round-trip.

## 3. Does anything resembling "snapshots" already exist?

| Candidate | Where | Ref | Spatial? | Notes |
|---|---|---|---|---|
| `RigSnapshot` | `src/engine/types.ts:41-63`, `ConnectionGraph.snapshot()` | main | **No** | The pure-data graph view for logic modules (ADR-0001). **The name is taken.** A "room snapshot" feature needs a different term (for example *scene preset*, *placement snapshot*, *stage plot*). |
| `SavedRig` named rigs | `src/ui/shelf.ts` | main (+`positions` on feature) | Feature: pose per instance `[x,y,z,yawDeg]` | The closest existing thing. It lacks room id, speaker aim (pitch), listener data, an export format and tests. |
| Pick-up undo | explore `src/game.ts:440-479` | feature | Yes (one pose) | Single-step, toast-scoped, not a history. |
| Level `layout` | `schemas.ts:110`, `levels/*.json` | main | Positions only | Authored per level; no rotation; no room. |
| Environment presets | `content/environments/*.json` | main | Camera pose + backdrop | A "view preset", not a placement. |
| Explore settings | `audio-sim/explore-settings` | feature | No | Comfort and bindings only. |
| Exam results | `src/ui/exam.ts` | main | No | Computed and shown; **not stored**. |
| Room templates with zones | `content/rooms/*` (feature), KB rooms (tekbrain) | feature / tekbrain | Zones `[cx,cz,w,d]` + `floor_y_m` | Listener areas exist only as `kind: "audience"` rectangles in 12/32 rooms; there are no listener points. |
| Speaker positions | KB `gear_positions` | **tekbrain only** (dropped by `sync-rooms.ts`) | `position_m` + yaw `rotation_deg` | 350 positions across 32 rooms, with real ids (Kara II flown at y = 6 m, KS28, X15 wedges). Most speaker ids are not in `catalog.json`. |
| SPL / coverage specs | KB `key_specs.max_spl`, `directivity`; `kb-sheets.json` `keySpecs` | tekbrain; feature (23 sheets) | n/a | Free-text strings with units; nothing numeric. |
| Acoustic room fields | KB `rt60_s`, `surfaces` | tekbrain only | n/a | 17/32 with a broadband RT60 range; surfaces are free-text materials (no absorption coefficients). |
| STI | KB curriculum, `installation-conference` domain | tekbrain (docs) | n/a | Mentioned as a learning objective; no data field or rule. |

## 4. Tests

**Vitest** [run on feature/tekpractice-explore-controls, 2026-10-24]: **32 files, 301 tests, all pass** (5.0 s).

| Area | Vitest file (tests) | Ref |
|---|---|---|
| Engine / connector | `engine/connectionGraph` (21), `engine/catalogLoader` (4), `engine/decoupling` (1), `engine/evaluatorRunner` (8) | main |
| Rules | `logic/clock` (8), `logic/gpio` (7), `logic/mixMinus` (5), `logic/phantom` (4) | main |
| Scene / camera | `scene/cablePath` (9), `scene/focusArchitecture` (5), `scene/focusMachine` (15), `render/detect` (8) | main |
| UI / save | `ui/progressStore` (10), `ui/readiness` (16), `ui/exam` (6), `ui/coach` (10), `ui/onboarding` (7), `ui/format` (3) | main |
| AI coach | `ai/aiCoach` (17) | main |
| Explore / rooms | `explore/explore` (28), `explore/intent` (5), `explore/purity` (12), `explore/roomLayout` (7), `explore/roomSchema` (35), `input/input` (21), `scene/viewDirector` (4) | feature |
| Feature UI / tools | `ui/exploreSettings` (5), `ui/controlsHelp` (4), `ui/inventoryModel` (5), `tools/kbSheets` (2), `tools/proposals` (4), `ai/kbGrounding` (5) | feature |

- **Main vitest:** 19 files, **164 tests** [derived]. These are the same files, unchanged on the feature branch, so the counts come from the feature run. Not separately run on main.
- **Feature-only vitest:** 13 files, 137 tests [run].
- **Playwright** (not run, as instructed; counted by a static grep of `test(` calls) [code]:
  - Main: 8 specs, 30 tests: `a1` 3, `dashboard` 3, `exam` 3, `focusPatch` 6, `levels` 5, `onboarding` 3, `render2d` 3, `sandbox` 4.
  - Feature: 11 specs, 54 tests. It adds `explore` 19, `rooms` 4 and `zz-qa-crawl` 1, and modifies `focusPatch`.
  - REVIEW-ME §13.10 flags `focusPatch.spec` "A1 wired…" as flaky before this work.
- **KB tests** (tekbrain): `knowledge-base/tools/tests/test_build_index.py`, plus the validators `validate.py`, `validate_tekbrain.py`, `schema_check.py` (not run).
- **Untested seams relevant to snapshots:**
  - `saveRig`/`loadRigs` (no unit test);
  - the `SavedRig.positions` round-trip (no e2e);
  - `sync-rooms.ts` field loss (no test; lossy by design);
  - `RoomBuilder` (e2e only);
  - `Placement` adapter (e2e only).

## 5. ADRs, plans and docs

### ADRs (`tekpractice-sim/docs/adr/`)

| ADR | Status | One line |
|---|---|---|
| 0001 device-state | Accepted | Toggles (+48 V) are graph state; `setControl`; `snapshot()` exposes effective flags to logic. |
| 0002 patchbay-normalling | **Proposed, not implemented** | Normalled / half-normalled derived edges in `snapshot()` (awaiting Oscar's GO). |
| 0003 readiness-model | Accepted | Rule → BTS competency/épreuve mapping; score = ratio × coverage. |
| 0004 sandbox-free-graph | Accepted | Sandbox = level without requiredChain; dynamic `addInstance`; mastery-gated shelves. |
| 0005 remove-instance-rig-load | Accepted | `removeInstance`/`clear`, named rig save + reload, "clean rig" readiness credit. |
| 0006 ai-coach | Accepted | On-demand Claude "Pourquoi ?" coach, grounded and Socratic; off without a key. |
| 0007 enum-controls | Accepted | Enum controls (sample rate) for R8. |
| 0008 focus-patch-camera | Accepted | Ensemble ⇄ Focus camera state machine + click-click patching. |
| 0009 room-backdrops | Accepted | Realistic glb room backdrops as environment data (décor phase only). |
| 0010 explore-controls | Accepted (feature only) | Explore walk view, input actions, inventory, placement / pick-up, remappable settings, `SavedRig.positions`. |

### Plans and design docs mentioning rooms or placement

- `docs/plans/2026-10-22-explore-mode.md` (feature): the ADR-0010 task plan. It declares rigs gain optional `positions`, and covers perf budgets for rooms.
- `docs/TekPractice_Set-System.md` (main) is **planned, not implemented**:
  - catalog `dimensions {w,h,d}` and per-port offsets;
  - level `layout: {<instanceId>: {position, rotation, mount}}`;
  - a new `content/mounts.json` (`speaker-tripod`, `mic-stand`, `foh-desk`, `rack`);
  - floor zones;
  - a dev "Set Editor" at `?edit=1` that saves back to the level JSON.
  - This is the closest existing plan to speaker-placement snapshots.
- `docs/REVIEW-ME.md` §13 (feature): the explore decisions awaiting Oscar. Rooms are `needs-oscar-review`, and medium-room perf measured 13–25 fps in headless Chromium.

### Grep for acoustics / SPL / STI / RT60 / snapshot / coverage / listener

- **`tekpractice-sim/**/*.md`:** 19 hits in 10 files. Every one is about `RigSnapshot` (ADR-0001/0002/0007, prompts) or `coverage` in the readiness or 3D-sourcing sense. **No doc in `tekpractice-sim` mentions SPL, STI, RT60 or acoustics.**
- **`knowledge-base/**/*.md`** (tekbrain): 353 hits in 40 files. The relevant ones:
  - `fundamentals/13-acoustique-des-salles.md` (17), `14-diffusion-amplification-calage.md` (14), `12-larsen-feedback.md` (12), `02-decibels-gain-staging.md` (12);
  - `tek-brain/curriculum.md`: competencies `acoustic-calculations-bts`, `set-delay-and-fill-speakers`, `monitor-public-spl-compliance` (decree 2017-1244: LAeq,15 min ≤ 102 dB(A), LCeq ≤ 118 dB(C)); procedures `calculate-rt60-sabine`, `position-studio-monitors`; fault `uneven-coverage`; STI/STIPA under installation-conference;
  - `tek-brain/DESIGN.md` §6 and `ROOMS_BRIEF.md`: room coordinates and `gear_positions` conventions; front loudspeakers face the audience (`rotation_deg` 0);
  - `tek-brain/README.md:67` and `OPEN_QUESTIONS.md` #19 and #24: rules that need SPL, impedance or cable length are `evaluable_now: false` and become catalog proposals; "session fields (SPL Leq, loudness)" are listed as missing;
  - `docs/prompts/tekbrain-and-explore-controls.md`: the master prompt, which lists "SPL / hearing safety" and "intelligibility, STI" as target topics.

## 6. Gaps for a room / speaker-snapshot feature

Each gap has an evidence pointer. All are **[code]** unless marked otherwise.

### Data

1. **Speaker placements never reach the game.** `tools/sync-rooms.ts:17` `KEEP` omits `gear_positions`, `rt60_s`, `surfaces`, `power_points` and `patch_points`. `RoomFile` (`src/explore/roomSchema.ts:9`) is non-passthrough, so they would be stripped at runtime anyway. [run: KB rooms have 350 positions and 17 RT60 ranges; content rooms have none of these keys.]
2. **The catalog has no acoustic or physical fields.** `Device` (`tools/schemas.ts:50-63`) has no `max_spl`, coverage angles, sensitivity, dimensions or weight. The KB holds them only as unit-bearing strings (`key_specs.max_spl: "142 dB (...)"`), and `kb-sheets.json` as display tuples. A numeric, sourced field set has to be defined and parsed. [run: 0 `spl/coverage` hits in `catalog.json`.]
3. **Most room speakers are not catalog devices.** KB `gear_positions` reference `l-acoustics-kara-ii`, `l-acoustics-ks28`, `l-acoustics-x15-hiq`, ... with `tekpractice.in_catalog: false`. They exist only in `content/proposals/catalog-proposals.json` ("needs Oscar's review"). The catalog has 2 PA speakers + 1 monitor (`content/catalog.json`; `meta.scope` = A1–D1 only).
4. **No listener model.** The only listener areas are zone rectangles of `kind: "audience"` (12/32 rooms [run]) or `desk`/`control-room`. There are no listener points, seat grids or measurement positions. The KB rule `listening-position-too-close-to-walls` already asks for `room.listening_position_min_wall_distance_m` (`knowledge-base/tek-brain/rules/*.json`).
5. **The acoustic room description is thin.** RT60 is a single broadband `{min, max}` in 17/32 rooms (15 `"not found"`). `surfaces[].material` is free text with no absorption coefficients. Every room is `needs-oscar-review` with estimated dimensions (`not_found_log`).
6. **Levels cannot name a room.** `Level` has `environment` (preset id) and `layout` (positions, no yaw) but no `room` field (`schemas.ts:95-111`). Drafts keep `room_id` only inside `draft` metadata (`content/levels/drafts/*.json`). Rooms load only in the sandbox branch of `main.ts`.
7. **No speaker-aim or rigging data.** Placement is yaw-only in 90° steps (`src/explore/placement.ts:10` `rotateStep`), y = floor height (`scene/Placement.ts:95`). There is no pitch/tilt, no flown height (the Kara II sits at y = 6 m in the KB), no array splay (the KB `rigging` string lists the angles) and no mounts (`content/mounts.json` is only planned in `docs/TekPractice_Set-System.md`).

### Engine

8. **Spatial data is invisible to rules.** `RigSnapshot` (`src/engine/types.ts:41-63`) has no position, rotation or room, so poses live only on `DeviceInstance.root` in the scene. `logic/*` (pure, snapshot-only) cannot evaluate placement. Any placement-aware check needs a new pure input type (for example a placement or room view), passed without breaking the rule that the engine never imports logic (`tests/engine/decoupling.test.ts`).
9. **The rule system is closed to new modules.** `Rule.id` matches `^R[1-8]$` and `Rule.module` is a fixed 5-value enum (`schemas.ts:65-73`). `LogicModuleName` is a closed union (`types.ts:85`). The coach and onboarding triggers also hard-code `^R[1-8]$` (`schemas.ts:164,189`). Adding R9+ (SPL, coverage, RT60) needs schema changes in several places.
10. **No acoustic computation exists.** There is no inverse-square SPL, no coverage cone and no delay/time-alignment or STI estimate anywhere in `src/`. Real DSP is explicitly YAGNI (`CLAUDE.md` "Out of scope"), so any model must be a simple geometric/teaching model. That boundary needs an ADR.
11. **No placement objective in levels.** `LevelRunner.check` wins on `requiredChain` + violations only (`src/engine/LevelRunner.ts:21-46`). `LevelState` has no score for "speaker covers the audience zone" or similar.

### State / save

12. **The `SavedRig` scope is too narrow for a snapshot.** It does not record room / env / level id, and has no pitch, no listener data, no description, no thumbnail and no schema validation beyond `version === 1`. Same-name saves overwrite silently (`shelf.ts:147`). `positions` was added without a version bump (`shelf.ts`, feature), so a v2 snapshot format needs a migration like `ProgressStore`'s v1→v2.
13. **Nothing tests rig persistence.** There is no unit test for `saveRig`/`loadRigs` [code: grep of `tests/`]. `tests/e2e/sandbox.spec.ts` checks save and reload but not `positions`.
14. **Undo and history are minimal.** There is only the one-shot pick-up "Annuler" toast (explore `game.ts:440-479`), with no stack of states to compare or restore.
15. **Exam results are not stored.** `ExamScore` is only rendered (`src/ui/exam.ts:97-116`), so a "snapshot at exam end" has nothing to attach to.
16. **Snapshots stay inside one browser.** There is no export/import or sharing of rigs (ADR-0005 turned "save & share" into "save & reload"), and all state is localStorage.

### UI / scene

17. **No visual layer for acoustics.** There is no SPL heatmap, coverage cone or listener marker. `RoomBuilder` only tints zones by kind (`scene/RoomBuilder.ts:19-26,69-80`).
18. **No snapshot UI.** The shelf rig box is a name field plus a list of play buttons (`shelf.ts:61-81`). There is no compare, diff, rename or delete, and it exists only in the sandbox.
19. **Changing room means a page reload** (`shelf.ts` room picker sets `location.href`; ADR-0010 notes there is no `dispose()`). A snapshot that changes room would need a reload or a teardown path. The 2D fallback has no rooms or sandbox (REVIEW-ME §7).
20. **Performance risk.** A medium room ran at 13–25 fps in headless software rendering against a ≥50 fps target (REVIEW-ME §13.9; `rooms.spec.ts` only reports fps). Adding coverage overlays will add to this cost. [code: reported by a previous run, not re-measured here.]

### Process (confidence notes)

- The three deep-scan module files are missing, so passes 0–2 followed `SKILL.md` only.
- I did not run Playwright, the catalog validator or the KB validators. Playwright counts are from a static grep.
- KB room and speaker statistics were computed by parsing the JSON [run]. TS types, line ranges and the semantic claims (for example "stripped at runtime") are [code].
