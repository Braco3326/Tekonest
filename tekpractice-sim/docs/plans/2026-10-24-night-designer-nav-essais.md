# Night build 2026-10-24 — designer-grade navigation, view cube, Essais (phase 1), ship on tekonest.com

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (this run). Steps use checkboxes. Each task is TDD (superpowers:test-driven-development): failing test → minimal code → green → commit.

- **Goal:** moving the view feels like a pro design tool. Clicking a device flies to it and makes it the orbit pivot. A view cube snaps to named views. Students freeze, compare and restore "Essais" (no acoustic numbers). The game is playable at tekonest.com/tekpractice/jouer/.
- **Architecture:**
  - Pure maths and state live in `src/camera/*`, `src/trials/*` and `scene/focusMachine.ts`, all unit-tested.
  - Babylon and DOM adapters stay thin: `scene/cameraTween.ts`, `ui/viewCube.ts`, `ui/essaisPanel.ts`.
  - Every adapter costs zero per frame when idle.
  - Essais follow `research/fohhn-benchmark/tekpractice-data-model.md`, trimmed to phase 1: no `TrialResult`.
- **Tech stack:** TypeScript strict, Babylon.js 7, Vite, zod, vitest, Playwright. Website: static HTML built by `website-prototype/src/build.py` (stdlib Python) on branch `design/tekonest-umbrella-brand` (Cloudflare Pages, no build command).
- **Approved by:** Oscar, via the night prompt (2026-10-24). Executed without a further approval gate. Decisions taken by default are logged in `docs/NIGHT-2026-10-24.md` (repo root).

## Global constraints (verbatim from the brief; bind every task)

**Branches and shipping:**
- Branch `feature/tekpractice-designer-nav`, created from `feature/tekpractice-explore-controls` and rebased onto `origin/main` (clean). Website work on `design/tekonest-umbrella-brand` (worktree `C:\Users\brro\dev\Tekonest-wt\site`).
- Each phase ends green, reviewed by **tekreviwer** (never the author), committed and pushed. Never force-push a shared branch. Never commit `screenshots/` or secrets. Do not change Cloudflare or GitHub settings. Leave no background process running.

**Fohhn rules:**
- Nothing user-facing may carry Fohhn's name, data, wording, styling or assets.
- Code comments may say "inspired by pro acoustic-design tools".
- Copy the **behaviour**, never the look, names or code.

**Acoustic honesty:** no dB values, no STI, no "±x dB" claims tonight.

**Engine invariants (`tekpractice-sim/CLAUDE.md`):**
- catalog and levels are the source of truth;
- the engine never imports `logic/*`;
- the UI dispatches intents only;
- R1–R3 are engine invariants;
- real DSP is out of scope.

**Keep, don't replace:** ADR-0008 (Focus & Patch) and ADR-0010 (Explore/Orbit, Esc chain, V) are extended, not replaced. Explore keeps the ADR-0010 mouse rules.

**Accessibility:**
- every action has a named button;
- visible focus;
- `prefers-reduced-motion` or `ExploreSettings.reducedMotion` → cuts, not flights;
- target 1366×768.

**Performance:**
- no per-frame work when the camera is idle (no `onBeforeRender` observer left registered when no tween is active);
- log FPS before and after for a medium room, labelled headless.

**Input:**
- new actions go in `src/input/actions.ts` and the bindings, by `KeyboardEvent.code`, remappable and AZERTY-safe;
- keys never fire while a text field has focus.

**Tokens (view cube look):**
- Nuit `#131114` faces at 85 % opacity;
- Papier `#F3EDE3` labels in IBM Plex Sans 11 px;
- active face outlined in Ambre `#DD9349`;
- square corners (radius 0);
- an original design.

**Words:**
- the learner-facing word is **Essai**, the code word is `Trial`, never "snapshot" (`RigSnapshot` is already an engine term);
- French UI copy comes from the copy deck `docs/copy/designer-nav-essais.md` (tekuxwriter).

**Deploy:**
- Vite `base: '/tekpractice/jouer/'` for the deploy build only (local dev stays `/`);
- Cloudflare limits: 25 MiB per file, 20 000 files;
- run `python website-prototype/src/build.py` after any page edit.

**Agents:** only the named agents in `.claude/agents/REGISTRY.md`. Implementers act as **tekdeveloper**, UI as **tekfrontenddesigner**, copy as **tekuxwriter**, reviews as **tekreviwer**.

## Decisions taken by default (also in docs/NIGHT-2026-10-24.md)

| # | Decision |
|---|---|
| D1 | Scope: C capped at (a)+, **only phase 1 (Essais without acoustics) tonight** |
| D2 | Essais are **off in exam mode** unless a level declares them; `ExamScore` is persisted |
| D3 | Storage full → "Exporter puis archiver" prompt; hard stop only at the absolute budget |
| D4 | "Essai" / `Trial`; never "snapshot" |
| D5 | Critical-distance ring: not tonight |
| D6 | Room data untouched |
| D7 | Branch as above (rebase was clean) |
| D8 | The Fohhn account is not touched |
| N1 | **Single click on a device now focuses it** (pivot + fly) in Orbit view too. The brief overrides ADR-0008's "single click = select". Double-click still focuses. ADR-0008 gets an addendum, and the e2e tests that relied on select-on-click are updated |
| N2 | The focus flight keeps the current framing angle (ports facing the camera, `FOCUS_ALPHA`). Only the pivot changes |
| N3 | **View-cube "Face"** = looking from the audience toward the stage. In rooms (front = −z, audience = +z; ROOMS_BRIEF), the camera sits at +z: `alpha = +π/2`. In levels without a room, "Face" = the side the main devices' port panels do **not** face, i.e. `alpha = +π/2` too (panels face −Z, DeviceSpawner). "Arrière" = `alpha = −π/2` (port side). Recorded in ADR-0011-nav |
| N4 | Flight duration 450 ms, ease-in-out cubic, for all camera tweens (the token `focus.flyMs` becomes 450) |

---

## Phase A — designer-grade camera

### Task 1: pure tween maths `src/camera/tween.ts`

- **Files:** create `src/camera/tween.ts`; tests in `tests/camera/tween.test.ts`.
- **Interfaces:** produces the following.

  ```ts
  export interface PoseValues { alpha: number; beta: number; radius: number; target: [number, number, number] }
  export function easeInOutCubic(t: number): number          // t clamped to [0,1]
  export function shortestAngle(a: number, b: number): number // moved here from CameraRig (re-export from CameraRig for compat)
  export function planTween(from: PoseValues, to: PoseValues): PoseValues // `to` with alpha rewritten to from.alpha + shortestAngle
  export function samplePose(from: PoseValues, to: PoseValues, t: number): PoseValues // eased lerp of all fields
  export function clampPose(p: PoseValues, lim: { lowerRadius?: number; upperRadius?: number; lowerBeta?: number; upperBeta?: number }): PoseValues
  export class TweenClock { constructor(durationMs: number); start(nowMs: number): void; progress(nowMs: number): number /*0..1*/; cancel(): void; get active(): boolean; get done(): boolean }
  ```

- [ ] **Tests:**
  - easing endpoints and symmetry;
  - shortest arc across ±π (e.g. from 3.0 to −3.0 is +0.283);
  - `planTween` never travels more than π in alpha;
  - `samplePose` at 0, 0.5 and 1;
  - clamping;
  - `TweenClock`: progress over time, `cancel()` → `active` false, `done` at the end.
- [ ] Implement, get green, commit `feat(camera): pure tween maths`.

### Task 2: `src/scene/cameraTween.ts` adapter and CameraRig on top of it

- **Files:** create `src/scene/cameraTween.ts`; modify `src/scene/CameraRig.ts` and `src/design/tokens.ts` (`flyMs: 450`). Tests: `tests/scene/cameraTween.test.ts`, using a fake camera and scene object (a plain object with `alpha/beta/radius/target/setTarget` and an `onBeforeRenderObservable`-like add/remove), with no Babylon engine.
- **Interface:**
  - `class CameraTween { constructor(camera: TweenCamera, scene: TweenScene, now = () => performance.now()); to(pose: PoseValues, ms?: number): Promise<'done'|'cancelled'>; cancel(): void; get active(): boolean }`
  - `TweenCamera` and `TweenScene` are minimal structural types.
- **Behaviour:**
  - The observer is registered **only while** a tween is active and removed on done or cancel.
  - With reduced motion (`motionEnabled()` false), the pose is applied instantly and the call resolves `'done'` synchronously.
  - A new `to()` cancels the previous tween.
  - `cancelOnUserInput(canvas)` attaches `pointerdown`, `wheel` and `keydown` listeners once; any of them calls `cancel()`.
- **CameraRig:** `fly()` uses `CameraTween` (no Babylon `Animation`). `flyToPose()` returns the planned ms. The public API is unchanged.
- [ ] **Tests:**
  - no observer registered when idle;
  - the observer is removed after done and after cancel;
  - reduced motion means an instant set;
  - a second `to()` cancels the first.
- [ ] Run the full vitest suite plus `npx tsc --noEmit`, then commit `feat(camera): cancellable zero-idle-cost tween; CameraRig uses it`.

### Task 3: smooth orbit "feel"

- **Files:** create `src/camera/orbitFeel.ts` (pure config) and `tests/camera/orbitFeel.test.ts`; modify `src/game.ts` (camera setup near line 164) and `src/scene/ViewDirector.ts` (it re-applies limits when it hands the camera back to orbit, around line 82).
- **Interface:** `export const ORBIT_FEEL = { inertia: 0.85, panningInertia: 0.85, wheelDeltaPercentage: 0.02, zoomToMouseLocation: true, upperBetaLimit: Math.PI/2 - 0.02, lowerBetaLimit: 0.05, upperRadiusLimit: 60 } as const`, plus `export function radiusLimitFor(boundingRadius: number): number` (= `max(0.3, boundingRadius*1.2)`), plus `export function applyOrbitFeel(cam: OrbitCam): void`, using a structural type with those fields and `panningSensibility`.
- **Controls:**
  - left-drag orbits; right-drag pans (Babylon's default button 2); Shift + left-drag pans (set `useCtrlForPanning=false` and `_useShiftForPanning`, or a small pointer filter; document the choice);
  - the wheel dollies toward the cursor;
  - Explore is untouched.
- **Focus:** on focus, `lowerRadiusLimit = radiusLimitFor(frame.boundingRadius)`; on return to Ensemble, it goes back to the env default (2).
- [ ] **Tests:** `applyOrbitFeel` sets every field; `radiusLimitFor` bounds.
- [ ] **e2e** in `tests/e2e/cameraFeel.spec.ts`: in a1, after `page.mouse.wheel` over the canvas, `__audioSim.camera()` (a new debug hook returning `{alpha, beta, radius, target}`) shows the radius decreasing over several frames. That proves inertia, not an instant jump.
- [ ] Commit `feat(camera): designer-grade orbit feel`.

### Task 4: click-to-focus with pivot = device, re-pivot, home (focusMachine)

- **Files:** modify `src/scene/focusMachine.ts`, `src/scene/FocusPatch.ts`, `src/scene/CameraRig.ts`, `src/game.ts`, `docs/adr/0008-focus-patch-camera.md` (addendum, decision N1); tests in `tests/scene/focusMachine.test.ts` plus the e2e that assumed click = select.
- **Machine changes (pure):**
  - `DEVICE_CLICK` → same as `DEVICE_DOUBLE_CLICK` (focus + `flyToDevice`) when no cable is held **or** a cable is held. Refocusing another device keeps the held cable (as today).
  - New event `FLOOR_DOUBLE_CLICK { point: [x,y,z] }` → command `{ kind: 'repivot', point }`. The mode stays the same; in focus it leaves focus (mode `ensemble`, focused `null`) but the camera **does not** fly back to the Ensemble pose.
  - New event `HOME` → `flyToEnsemble`, mode `ensemble`, held kept (same as RIGHT_CLICK in focus; in ensemble it also flies home).
- **Rig:**
  - `CameraDirector` gains `repivot(point: Vector3): void`, which tweens only the target (alpha, beta and radius kept).
  - `flyToDevice` uses the **world bounding-box centre**: `DeviceInstance.root.getHierarchyBoundingVectors()`.
  - When `modelReady` resolves for the focused instance, it re-frames the target only (no camera jump if the centre moves < 2 cm).
- **Wiring:**
  - `FocusPatch.onDoubleTap` on empty floor: a pick on the ground or the room floor gives `FLOOR_DOUBLE_CLICK`.
  - `Alt+H` (action `CAMERA_HOME`, code `KeyH` + altKey; plain `H` stays help) and a "Vue d'ensemble" button in the top HUD (copy deck) dispatch `HOME`.
  - ViewDirector (Explore) implements `repivot` as a no-op in walk mode.
- [ ] **Tests (machine):**
  - single click focuses and emits `flyToDevice`;
  - a click while holding keeps `held`;
  - `FLOOR_DOUBLE_CLICK` emits `repivot` and no `flyToEnsemble`;
  - `HOME` from focus and from ensemble;
  - all existing tests still green, or updated with a comment citing N1.
- [ ] **e2e** in `cameraFeel.spec.ts`:
  1. Click the console in a1. `view().mode === 'focus'`, and the `camera().target` is within 5 cm of the console's bbox centre.
  2. Drag horizontally: the target is unchanged and alpha changes.
  3. Press Alt+H: the camera is back at the ensemble pose ±0.05 rad.
- [ ] Update every e2e that clicked once to "select" (grep `DEVICE_CLICK` semantics in `tests/e2e/*.ts`).
- [ ] Commit `feat(camera): click-to-focus pivots on the device; floor re-pivot; Alt+H home`.

### Task 5: camera presets "Vue 1 / 2 / 3"

- **Files:**
  - create `src/camera/presets.ts` (pure store), `src/ui/cameraPresets.ts` (DOM buttons) and `tests/camera/presets.test.ts`;
  - modify `src/input/actions.ts`, `src/input/bindings.ts` (`CAMERA_PRESET_1..3` → `Digit1..3`), `src/game.ts`;
  - e2e: extend `cameraFeel.spec.ts`.
- **Store:**
  - key `audio-sim/camera-presets`, value `{ version: 1, rooms: Record<roomKey, (CameraPoseJSON|null)[3]> }`;
  - `roomKey` is the room id, else `level:<levelId>`;
  - zod-validated; a version mismatch resets with no crash;
  - API `loadPresets(storage, roomKey)`, `savePreset(storage, roomKey, slot, pose)`.
- **UI:**
  - three buttons "Vue 1/2/3" next to the view cube;
  - click recalls via a tween (an empty slot shows the tooltip "Clic droit ou appui long pour enregistrer");
  - right-click or a 600 ms long-press saves, with a toast "Vue 2 enregistrée";
  - keys `Digit1..3` recall unless a text field (`input`, `textarea`, `[contenteditable]`) has focus;
  - in Explore walk view the presets are hidden (orbit-only feature; walk has its own eye).
- [ ] **Tests:** save and load round-trip; a corrupt payload falls back to empty; 3 slots per room.
- [ ] **e2e:** save slot 1 by right-click, move the camera, then press 1 to come back within 0.02 rad.
- [ ] Commit `feat(camera): three camera presets per room`.

### Phase A gate

- [ ] Full vitest, `tsc`, build, and the full Playwright suite (the pre-existing focusPatch "A1 wired" flake is noted, not "fixed" by retries).
- [ ] Dispatch **tekreviwer** on the Phase A range.
- [ ] Fix Critical/Important findings, then push the branch.

---

## Phase B — view cube

### Task 6: copy deck (tekuxwriter)

- **File:** `tekpractice-sim/docs/copy/designer-nav-essais.md`. French first, plus an English gloss column.
- **Content:**
  - **View cube:** face labels "Face", "Arrière", "Gauche", "Droite", "Dessus", "Dessous"; ¾ views "Face-gauche", "Face-droite", "Arrière-gauche", "Arrière-droite"; rotate buttons "Tourner à gauche (90°)", "Tourner à droite (90°)"; home "Vue d'ensemble"; aria-labels "Vue de face", …; the tooltip hint "côté jardin / côté cour" explained (from the audience, jardin = left, cour = right).
  - **Coach hint:** "Cliquez une face pour tourner autour de l'objet sélectionné."
  - **Presets:** "Vue 1/2/3", the empty-slot tooltip, the save toast.
  - **Every Essais string** (panel title, the "Montage actuel" row states, buttons, prediction placeholder "Je change…, je m'attends à…", caption "Affiché : …", "Résultat à refaire", compare labels, export, quarantine and storage messages, 1st-year limit message, teacher page strings).
  - **Website copy** for `tekpractice.html` ("Jouer maintenant", "Nouveau cette nuit", status "En développement · version d'essai").
- **Facts:** jardin/cour must be checked against `knowledge-base/tek-brain/glossary/` (cite the term id); if absent, write it as common theatre usage and flag it.
- [ ] Commit `docs(copy): designer-nav + Essais copy deck`.

### Task 7: pure view-cube maths `src/camera/viewCube.ts`

- **Interfaces:**
  - `type FaceId = 'face'|'arriere'|'gauche'|'droite'|'dessus'|'dessous'|'face-gauche'|'face-droite'|'arriere-gauche'|'arriere-droite'`
  - `function faceAngles(face: FaceId, frontAlpha = Math.PI/2): {alpha: number; beta: number}`
    - face: alpha = front, beta = π/2 − 0.25 (slightly above);
    - arriere: front + π;
    - droite: front − π/2 (camera on the right, seen from the audience);
    - gauche: front + π/2;
    - dessus: beta = 0.0001 (alpha kept = the current alpha snapped to the nearest quadrant);
    - dessous: beta = π − 0.0001, allowed only for this request; the adapter lifts `upperBetaLimit` temporarily;
    - ¾ views: front ± π/4.
  - `function nearestFace(alpha, beta, frontAlpha = Math.PI/2): FaceId` (beta < 0.35 → dessus; beta > π − 0.35 → dessous; otherwise the nearest of 8 azimuths);
  - `function rotate90(alpha, dir: 1|-1): number` (snaps to the next multiple of π/2 relative to front);
  - `function cubeCssRotation(alpha, beta, frontAlpha): {rx: number; ry: number}` in degrees, so the "Face" face points at the viewer when looking from the front.
- [ ] **Tests:** each face → angles; round-trip `nearestFace(faceAngles(f)) === f` for every f; rotate90 wraps; css rotation at face = (≈ −14°, 0).
- [ ] Commit.

### Task 8: DOM view cube `src/ui/viewCube.ts` + CSS, keys, coach hint

- **Files:** create `src/ui/viewCube.ts` and `src/ui/viewCube.css` (or inject into `index.html` like the explore panels); modify `src/input/actions.ts`, `bindings.ts`, `layoutLabels.ts` (Numpad labels), `src/game.ts`, `ui/coach.ts` (a coach-seen id `view-cube`). e2e `tests/e2e/viewCube.spec.ts`.
- **Look and behaviour (perf-first):**
  - a DOM/CSS 3D cube (`transform-style: preserve-3d`), 96 px, or 72 px when `innerWidth < 1366`;
  - **top-left** of the 3D view, below any existing top-left HUD (check for overlaps at 1366×768 and 390×844);
  - rotated from the camera only via `camera.onViewMatrixChangedObservable` (fires only on change), throttled to one update per animation frame;
  - no second canvas.
- **Buttons:**
  - 6 face `<button>`s;
  - 4 small ¾ corner buttons;
  - ↻ ↺ rotate buttons;
  - a ⌂ home button;
  - `aria-label`s from the copy deck;
  - the current face label is shown under the cube;
  - hover highlights a face; focus ring visible; the active face is outlined in Ambre;
  - tokens per the global constraints. Add the tokens to `src/design/tokens.ts` / CSS vars if they are missing (`--tk-nuit`, `--tk-papier`, `--tk-ambre`), with IBM Plex Sans falling back to the system UI.
- **Actions:**
  - clicking a face → `CameraTween.to(faceAngles(...), keeping the current target and radius)`. The pivot is the current `camera.target`, i.e. the focused device after Task 4.
  - `Dessous` temporarily sets `upperBetaLimit = π − 0.01` and restores it on the next user orbit.
- **Keys (actions):**

  | Action | Key |
  |---|---|
  | `VIEW_FACE` | `Numpad1` |
  | `VIEW_ARRIERE` | `Numpad1` + Ctrl |
  | `VIEW_DROITE` | `Numpad3` |
  | `VIEW_GAUCHE` | `Numpad3` + Ctrl |
  | `VIEW_DESSUS` | `Numpad7` |
  | `VIEW_ROT_LEFT` / `VIEW_ROT_RIGHT` | `Numpad4` / `Numpad6` |

  - The bindings model may need a modifier field: if `bindings.ts` only stores codes, add `"Ctrl+Numpad1"` string support in the matcher with a unit test.
  - Ignored when a text field has focus.
  - In Explore **walk** view the cube is hidden; it shows in Orbit and Focus.
- **Coach hint:** first display only, a one-line tip under the cube (copy deck); seen-state through the existing coach-seen mechanism.
- [ ] **Tests (unit):** the modifier matcher; the cube-state helper (which face is active).
- [ ] **e2e:**
  1. In a1, click the console, then the "Arrière" button: `camera().alpha ≈ frontAlpha+π` (±1°, wrapped) and `camera().target` is still the console centre (±5 cm).
  2. Numpad7 → beta < 0.05.
  3. The cube is visible at 1366×768 and does not overlap the top-right HUD.
  4. A screenshot is saved to `test-results/`.
- [ ] Write **ADR-0011-nav** `docs/adr/0011-designer-navigation.md`: the camera feel, click-to-focus (N1), presets, the cube and the face convention (N3), the perf rules, and the fact that this is inspired by pro acoustic-design tools' behaviour only.
- [ ] Commit `feat(ui): CSS 3D view cube with named views`.

### Phase B gate

Same as Phase A: full suites, tekreviwer, fixes, push.

---

## Phase C — Essais (phase 1, no acoustic numbers)

Contract: `research/fohhn-benchmark/tekpractice-data-model.md` (on branch `research/fohhn-benchmark`; read with `git show origin/research/fohhn-benchmark:research/fohhn-benchmark/tekpractice-data-model.md`). Phase-1 trim: no `TrialResult`, no `consumed.speakers`. `consumed.room` = `{ roomId|null, geometryRev|null }` only.

### Task 9: ADR-0011 "Essais et acoustique pédagogique"

- **File:** `docs/adr/0012-essais.md`. The number is 0012, because 0011 is the navigation ADR. Log the renumbering. The title is "Essais et acoustique pédagogique".
- **Decisions to record:**
  - embed by value;
  - write-once;
  - quarantine (never `removeItem`);
  - a global byte budget of 1.5 MB with a warning at 80 %;
  - exam policy D2;
  - naming D4;
  - the fidelity cap (a)+, with phase 1 having no acoustics;
  - `fp1` canonicalisation;
  - `rigs.v2`;
  - export is "déclaratif" (not exam proof).
- **Status:** "Accepté par défaut — en attente de validation d'Oscar".
- [ ] Commit.

### Task 10: `src/trials/fingerprint.ts` + `src/trials/trial.ts` (pure)

- **Interfaces:**
  - `canonicalize(value): string`: sorted keys; arrays kept in order **except** connection lists, which are sorted by a normalised `a<b` key; numbers quantised by field-name rules (positions → 0.001, angles in degrees → 0.1, `delayMs` → 0.01, others → 1e-6), `-0` → `0`, no exponent drift.
  - `fingerprint(design): Promise<string>` → `'fp1:' + sha256hex(canonicalize(design))` via `crypto.subtle` (available in browsers and Node 20+).
  - `type Trial = DeepReadonly<{ formatVersion:1; id:string; name:string; frozenAt:string; parentId:string|null; fingerprint:string; design: DesignState; consumed:{ room:{ roomId:string|null; geometryRev:string|null } }; evidence: Evidence; view: { pose: CameraPoseJSON; pivot:[number,number,number] }; levelId?: string }>`.
  - `DesignState`: `{ roomId, rig: { instances, connections, controls }, placements: {instanceId, deviceId, position_m, yawDeg}[] }`; phase 1 has no pitch.
  - `Evidence`: `{ prediction:{text, writtenAt}; ruleResults: TeachingEvent[]; levelState: LevelState|null; rulesRev: string; note:string; noteAmendments:{text,at}[]; changedSinceParent:string[] }`.
  - `createTrial(input, now, id): Promise<Trial>`: requires a non-empty prediction (else it throws `TrialError('prediction-required')`), `writtenAt <= frozenAt`, and returns a deep-frozen object.
  - `diffDesign(a, b): string[]`, used for `changedSinceParent`, e.g. `['placement:spk-l','connection:+1','control:mic-1.phantom']`.
- [ ] **Tests:**
  - fingerprint stable under key reorder, connection order, float noise (1e-9) and −0;
  - fingerprint changes when a position moves 2 mm;
  - `createTrial` rejects an empty prediction;
  - the result is frozen (mutating it throws in strict mode);
  - `diffDesign` cases.
- [ ] Commit.

### Task 11: `src/trials/store.ts` (write-once, quarantine, budget)

- **Storage:**
  - keys `audio-sim/trials` (`{version:1, trials: Trial[]}`) and `audio-sim/trials.quarantine`;
  - storage injected (`Pick<Storage,'getItem'|'setItem'>`); there is **no removeItem in the API**.
- **API:** `load(): {trials, quarantined:boolean, warnings}`, `append(trial)`, `rename(id, name)`, `amendNote(id, text, now)`, `remove(id)` (an explicit learner action with confirmation in the UI), `bytesUsed()`, `budget = 1_500_000`.
- **Load:** a zod strict parse, plus `fingerprint` re-verified per trial. On failure: copy the raw string to `.quarantine` (append, never overwrite an existing quarantine — use a timestamped array), return `quarantined: true`, and keep going with an empty list.
- **Writes:**
  - every write is wrapped: a `QuotaExceededError` → return `{ ok:false, reason:'quota' }` (shown by the UI);
  - `append` refuses when it would exceed the budget → `{ok:false, reason:'budget'}`;
  - at ≥ 80 % → `warnings: ['near-budget']`.
- **Write-once:** append-only; rename and amendments change only `name` and `evidence.noteAmendments`; the note itself is locked once a child exists.
- [ ] **Tests:** each rule above, including a corrupt payload → quarantine, a tampered fingerprint → quarantine, quota → reason, and the 80 % warning.
- [ ] Commit.

### Task 12: SavedRig v2 + tests + ExamScore persistence

- **Files:** modify `src/ui/shelf.ts`; create `src/ui/rigStore.ts` (pure, storage-injected) if it helps testing; modify `src/ui/exam.ts` and `ui/ProgressStore.ts` (add `exams: {levelId, score20, at}[]` capped at 50; bump the version with a migration v2 → v3 that keeps everything).
- **Rigs:**
  - `audio-sim/rigs.v2` = `{version:2, rigs: SavedRigV2[]}`, where `SavedRigV2` = v1 + `roomId: string|null` + `positions` validated (4 finite numbers);
  - **copy** migration from `audio-sim/rigs` v1 on first load, leaving v1 untouched;
  - saving the same name asks for confirmation (the UI already overwrote silently; add a confirm with copy-deck text);
  - **clobber test:** simulate an old build writing a v1 file after v2 exists; the v2 key is unaffected and nothing reads v1 again once v2 exists.
- [ ] **Tests:** `saveRig`/`loadRigs` round-trip with positions; migration; clobber; ProgressStore v2 → v3 keeps the data and stores exam scores.
- [ ] **e2e:** extend `sandbox.spec.ts`: save, reload, positions restored (±1 cm).
- [ ] Commit.

### Task 13: `src/trials/compare.ts` + `src/trials/export.ts`

- **compare:**
  - `compareTrials(a, b)` → `{ changed: string[] (diffDesign), rules: { fixed: ruleId[], broken: ruleId[] }, predictionA, predictionB }`.
  - No acoustic values.
- **export:**
  - `exportTrails(trials): string` → JSON `{ formatVersion:1, exportedAt, app:'tekpractice', declaratif:true, trials }`;
  - `importTrails(json)` → a zod parse + per-trial fingerprint re-verification → `{ trials, rejected: number }`;
  - the round-trip test must be exact.
- [ ] Commit.

### Task 14: Essais panel UI + wiring (sandbox; levels if they declare it; never exam by default)

- **Files:** create `src/ui/essaisPanel.ts`; modify `src/game.ts`, `src/input/actions.ts` (`FREEZE_ESSAI` `KeyG`, `COMPARE_FLIP` `KeyB`), `index.html` CSS; e2e `tests/e2e/essais.spec.ts`.
- **Panel:**
  - a left panel; only one side panel at a time (it closes the inventory and help panels it would overlap);
  - a toggle button "Essais" in the existing explore toolbar.
- **Content (copy deck):**
  - the pinned **"Montage actuel"** row (identical to `<Essai X>` / modified since `<Essai X>`);
  - the list (2nd year: indented by parent; 1st year — `ExploreSettings.year === 1`, a new setting defaulting to 2 — flat list with max 3: the 4th freeze shows a message to export and archive);
  - the prediction textarea "Je change…, je m'attends à…";
  - the note;
  - buttons "Figer l'essai (G)", "Comparer (B)", "Repartir de cet essai", "Exporter pour l'enseignant (.essai.json)", "Importer".
- **Freeze:**
  - builds the `DesignState` from the graph snapshot + `poseOf()` + the room id;
  - the evidence comes from `runner.check(graph)` + `evaluator.evaluate(graph)` + `rulesRev` (a hash of the catalog rules);
  - the view = the current camera pose + `camera.target` as pivot;
  - a no-op (toast "Rien n'a changé depuis l'essai X") when the fingerprint **and** refs equal the displayed trial's.
- **Stale:**
  - after any graph/placement change, recompute the live fingerprint (debounced 200 ms) and compare it with the displayed trial's;
  - if different, the caption shows "Résultat à refaire" and the row "modifié".
- **Caption bar (DOM, bottom):** "Affiché : Essai B · … · Montage actuel : identique|modifié".
- **Compare:**
  - pick two essais;
  - `KeyB` or the button flips the **displayed setup** A ⇄ B by restoring each trial's design into a **read-only preview**, then restoring the live design on close, **and** tweens to the trial's stored `view` so the camera is identical;
  - a DOM side table: what changed, rules fixed/broken, both predictions;
  - Esc closes it (insert into the Esc chain after "close top panel").
  - Implementation hint: reuse `loadRigByName`'s logic, extracted into `applyDesign(design)`. Keep the live design in memory and re-apply it on close. Never write the preview into the trial store.
- **Restore:** "Repartir de cet essai" → apply the design to the live setup; the next freeze has `parentId` = that trial.
- **Exam:** the panel is not created when `level.examSeconds` is set and the level doesn't declare `essais: true` (D2).
- [ ] **e2e (sandbox):**
  1. Place 2 devices and write a prediction.
  2. Press G → 1 essai.
  3. Move a device → caption "Résultat à refaire".
  4. Write a prediction and press G → essai B with `parentId` A.
  5. Open compare and press B → camera pose equal to essai A's (±0.01) and devices at A's positions.
  6. Esc → the live setup is back.
  7. Export → download text → import → same trials.
  8. A screenshot is saved.
- [ ] Commit.

### Task 15: teacher page `teacher.html`

- **Files:** create `tekpractice-sim/teacher.html` (Vite multi-page input in `vite.config.ts` `build.rollupOptions.input`) and `src/teacher/main.ts` (DOM only, **no Babylon import**, so its chunk stays small).
- **Behaviour:**
  - a file picker + drag-and-drop for `.essai.json` → `importTrails`;
  - renders per trial: name, time, parent, prediction (with time), changes since parent, rules fixed/broken, notes and amendments, and a static 2D SVG top view of the placements (room rect + device dots with labels);
  - a "déclaratif" disclaimer from the copy deck;
  - the 4-line rubric from the prototype brief (checkboxes, not saved);
  - works offline.
- [ ] **e2e:** load the exported file from Task 14's fixture (commit a small fixture under `tests/fixtures/essais-sample.essai.json`, generated by the code, not hand-written) → the names and predictions are visible.
- [ ] Commit.

### Phase C gate

Full suites, tekreviwer, fixes, push.

---

## Phase D — ship on tekonest.com

### Task 16: in-game site link + title + deploy build

- **Files:** `index.html` (title "TekPractice — Tekonest"; a top-right DOM link "← tekonest.com" to `/`, with a visible focus ring, not overlapping the HUD at 1366×768 and 390×844), `vite.config.ts` (`base: process.env.TEKPRACTICE_BASE ?? '/'`), `package.json` script `"build:site": "cross-env TEKPRACTICE_BASE=/tekpractice/jouer/ vite build --outDir dist-site"` (or a PowerShell-safe node script if cross-env is absent: `node tools/build-site.mjs`).
- **Checks:**
  - the build succeeds;
  - list every file > 20 MiB (the limit is 25 MiB) and the total file count;
  - any `.glb` above the limit is **excluded** from the copy and logged (the game falls back to placeholders — assets never block gameplay).
- [ ] Commit `feat(site): tekonest.com link, title, site build`.

### Task 17: website pages (branch `design/tekonest-umbrella-brand`)

- **Worktree:** `C:\Users\brro\dev\Tekonest-wt\site` (create from `origin/design/tekonest-umbrella-brand`; fetch first; it may have moved).
- **Commit 1, "deploy: TekPractice build <sha>":** copy `dist-site/` → `website-prototype/tekpractice/jouer/`, with no source maps (strip `*.map`).
- **Commit 2, "site: TekPractice page and Se former link":**
  - edit `website-prototype/src/pages/tekpractice.html` (hero "TekPractice, le simulateur de câblage"; the big **"Jouer maintenant"** button → `tekpractice/jouer/`; "Nouveau cette nuit" with cube de vue, rotation autour de l'objet and Essais; the FR controls table from `docs/CONTROLS.md` plus the new actions; status "En développement · version d'essai");
  - use the existing design system only (`tokens.css`, `site.css`, Cadre / Médaillon / Bande);
  - on the home "Se former" door, add an inner link "Jouer à TekPractice";
  - run `python website-prototype/src/build.py` and commit the generated HTML.
- **Push:** before pushing, `git fetch` + `git rebase origin/design/tekonest-umbrella-brand` (never force). Then push. This deploys to production.
- [ ] Verify the build output with a local static server (`python -m http.server` in `website-prototype`, stopped afterwards): `/tekpractice/jouer/?level=a1` loads with no 404 in the console.

### Task 18: live verification + morning report

- [ ] After about 60 s, run Playwright against `https://tekonest.com/tekpractice/` and `https://tekonest.com/tekpractice/jouer/?level=a1` and `?level=sandbox`, at 1366×768 and 390×844. Check:
  - no console errors;
  - the cube is visible;
  - click a device, then "Arrière", and it works;
  - log an FPS sample;
  - save 3 screenshots + a short GIF (or a 3-frame strip if GIF tooling is absent) into `docs/night-2026-10-24/` (our own game only, OK to commit).
- [ ] If production didn't update, record it (Cloudflare "skipped" deploy) and do **not** change Cloudflare settings.
- [ ] Write `docs/NIGHT-2026-10-24.md` (repo root, on the feature branch):
  - the links;
  - what works and what doesn't;
  - tests before → after (vitest, Playwright);
  - FPS before and after (headless);
  - bundle size;
  - the defaults checklist D1–D8 + N1–N4 + any new ones;
  - the phase 2 proposal and its gates.
- [ ] **Final whole-branch review:** tekreviwer on the most capable model. Fix, push the feature branch, then a short morning summary to Oscar.
