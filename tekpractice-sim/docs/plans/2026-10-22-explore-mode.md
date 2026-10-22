# Explore Mode Implementation Plan (ADR-0010)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. In this autonomous run the lead implements the pure modules inline (TDD) and uses subagents for independent review, because every later task depends on the exact interfaces below.

**Goal:** Walk through the 3D world (keyboard+mouse or mouse only), open an inventory with Space, place and pick up gear, and keep Focus & Patch (ADR-0008) intact.

**Architecture:** Pure, Babylon-free modules (`src/input/*`, `src/explore/*`) carry all logic and are unit-tested. Thin Babylon adapters (`src/scene/ExploreController.ts`, `src/scene/ViewDirector.ts`) apply their output to a `UniversalCamera`. DOM panels (`src/ui/inventory.ts`, `helpOverlay.ts`, `exploreSettings.ts`) dispatch intents; only `game.ts` touches the graph.

**Tech Stack:** TypeScript strict, Babylon.js 7, Vite 5, vitest 1.6, Playwright 1.44.

## Global Constraints

- `content/catalog.json` is the source of truth; never overwritten by tools (proposals go to separate files).
- Engine never imports `logic/*`; scene/UI never mutate the graph (intents only).
- Keys by `KeyboardEvent.code`; every binding remappable; French UI text first.
- localStorage access wrapped in try/catch; versioned keys.
- Existing suites stay green: `npm test`, `npm run validate:catalog`, `npm run build`, `npm run test:e2e` before each Track B commit.
- Budgets: startup bundle ≤ today + 15 %; ≥ 50 fps target in a medium room; rooms lazy-loaded.
- Drag threshold = Babylon `InputManager.DragMovementThreshold` (10 px).

## File map

| File | Responsibility |
|---|---|
| `src/input/actions.ts` | `Action` union + list |
| `src/input/bindings.ts` | default bindings, `actionsForCode`, `rebind`, (de)serialize |
| `src/input/keyboardState.ts` | held codes → active actions; edge "pressed" events; blur reset |
| `src/input/mouseGesture.ts` | pointer down/move/up → click / look-drag / move-drag deltas |
| `src/input/layoutLabels.ts` | display label for a code (AZERTY/QWERTY) |
| `src/explore/movement.ts` | `PlayerState`, `stepPlayer(state, input, dt, opts)` |
| `src/explore/collision.ts` | `AABB`, `resolveMove(from, to, radius, obstacles, stepHeight)` |
| `src/explore/escChain.ts` | pure Esc priority resolver |
| `src/explore/placement.ts` | grid snap, rotation steps, ghost pose |
| `src/ui/exploreSettings.ts` | settings model + `load/save` (versioned localStorage) |
| `src/ui/helpOverlay.ts` | H overlay, labels per layout |
| `src/ui/inventory.ts` | Space panel: catalog by taxonomy category, search, sheet, Placer |
| `src/scene/ViewDirector.ts` | explore ⇄ focus camera hand-off (`CameraDirector` impl) |
| `src/scene/ExploreController.ts` | Babylon adapter: keyboard/mouse → movement → camera; pointer lock; crosshair pick |
| `tools/build-kb-sheets.ts` | KB equipment → `content/kb-sheets.json` |
| `tests/input/*.test.ts`, `tests/explore/*.test.ts`, `tests/ui/exploreSettings.test.ts`, `tests/ui/inventory.test.ts` | unit tests |
| `tests/e2e/explore.spec.ts` | e2e: WASD, mouse-only, Space, place, focus+patch, back |

## Tasks

### Task 1: Input-action layer
- Produces: `type Action`; `DEFAULT_BINDINGS: Record<Action, string[]>`; `actionsForCode(b, code): Action[]`; `rebind(b, action, codes): Bindings`; `KeyboardState` with `keyDown(code)`, `keyUp(code)`, `held(action): boolean`, `consumePressed(): Action[]`, `reset()`; `MouseGesture` with `down(button, x, y)`, `move(x, y)` → `{ kind: 'look'|'move'|'none', dx, dy }`, `up(x, y)` → `'click'|'drag-end'|null`; `labelFor(code, layout)`.
- Tests: W/Z mapping (`KeyW` → MOVE_FORWARD on both layouts, label "Z" on AZERTY); rebind replaces; key held across down/up; blur reset clears; pressed edge fires once; mouse below 10 px = click, above = drag (left → look, right → move); click never emitted after a drag.

### Task 2: Movement + collision + Esc chain + placement (pure)
- Produces: `stepPlayer(p, intent, dt, opts) → PlayerState` (`intent = { forward, strafe, vertical, run, yawDelta, pitchDelta }`), constants `WALK_SPEED = 1.4`, `RUN_MULT = 2`, `EYE = { min: 0.9, stand: 1.65, max: 1.9 }`, `PITCH_LIMIT = 85°`; `resolveMove(from, to, radius, obstacles, stepHeight = 0.25)`; `resolveEsc(ctx) → EscAction`; `snapToGrid(v, step = 0.25)`, `rotateStep(deg, dir)`.
- Tests: accelerates toward target speed, decelerates to 0, diagonal speed not faster than straight, run doubles, pitch clamped, eye height clamped; collision slides along a wall, blocks a box, ignores a 0.2 m cable, stays inside room bounds; Esc order matches ADR Decision 5; snapping and 90° rotation wrap.

### Task 3: Settings store
- Produces: `ExploreSettings`, `DEFAULT_SETTINGS`, `loadSettings(storage)`, `saveSettings(storage, s)`, key `audio-sim/explore-settings`, version 1.
- Tests: defaults when empty/corrupt/old version; round-trip; storage throwing on get/set never throws.

### Task 4: Babylon adapters + game wiring
- `ViewDirector` implements `CameraDirector`; `FocusPatch` takes `CameraDirector` + optional deps `clickFocuses()`, `inputEnabled()`; `ExploreController` owns the UniversalCamera, pointer lock, crosshair, V toggle, `?view=`.
- Intents: `SPAWN` gains `position?: [number, number, number]`, `rotationY?: number`; new `REMOVE { instanceId }`.
- `window.__audioSim.explore()` → `{ view, position, yaw, pitch, inventoryOpen, fov }`.
- Tests: `focusArchitecture.test.ts` still passes (no graph import in scene); new static test: `src/input` and `src/explore` import nothing from Babylon or engine.

### Task 5: Help overlay + settings panel + pause menu
- French first; labels per layout; `role="dialog"`, focus trap, Esc closes; contrast from design tokens; reduced motion respected.

### Task 6: Inventory + placement + pick-up
- `tools/build-kb-sheets.ts` → `content/kb-sheets.json` (`{ [catalogId]: { category, subType, keySpecs, connectors, manualUrl, productUrl } }`).
- Inventory groups catalog devices by KB taxonomy category (fallback `realWorld.category`), search filters label/brand/model; sheet; "Placer" only in Sandbox.
- Placement ghost, R rotate, click confirm → SPAWN; X / focus button → REMOVE; undo toast restores instance, connections, controls; rigs gain optional `positions`.
- Tests: grouping, search, sandbox gating (pure `buildInventoryModel`); e2e place + pick up.

### Task 7: e2e + perf + docs
- `tests/e2e/explore.spec.ts`: WASD walk moves position; mouse-only right-drag moves, left-drag rotates; Space opens inventory; place a device in sandbox; click device → focus, patch a cable, Esc back to Explore; A1 still winnable (existing spec).
- Perf: measure fps via `engine.getFps()` in sandbox Explore and a medium room; bundle size before/after (`vite build` output).
- `docs/CONTROLS.md` FR + EN with diagram.
