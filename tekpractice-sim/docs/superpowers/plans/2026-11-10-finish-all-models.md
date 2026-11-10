# Finish All Models and Outline Port Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every catalog device gets a scripted or hybrid model with real silhouette detail (curved Genelec, rack ears and handles, filleted consoles, scripted mics), and port markers stop hiding connectors.

**Architecture:** Parametric Blender shape families in `tools/assets3d/blender/build_from_spec.py` driven by the asset spec `build` block, wearing the real product photo as the picture (hybrid). Port markers become thin outline rings sized from the connector, with the invisible 24 px pick sphere unchanged. New gates (`detail`, `fillet`) and per-device contact-sheet review replace eyeballing alone.

**Tech Stack:** Blender 5.x at `D:\Blender\blender.exe` (env `BLENDER_EXE`), TypeScript tools run with tsx, zod asset specs, Babylon.js 7, vitest, Playwright (`E2E_PORT=4181`).

**Spec:** `docs/superpowers/specs/2026-11-10-finish-all-models-design.md` (read it first; this plan only decides names, files, tests and order).

## Global Constraints

- Working dir `E:\dev\Tekonest-wt\assets3d\tekpractice-sim`, branch `assets/3d-rebuild`; git needs `-c safe.directory='*'`. **Never push, never deploy, never spend Meshy credits, never touch `E:\dev\Tekonest`.**
- Commit after every task with **explicit paths only** (`git add <path>…`); message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Sizes come from `realSizeMm`, never from `build.params`; the size gate is `max(0.5 mm, 0.5 %)`. One material per GLB; no normal / metallic maps; hybrid atlas ≤ 2048 px; Draco.
- Triangle budget classes (declared in each spec as `build.budget`): rack gear 1500–3500, console ≤ 6000, speaker ≤ 4000, mic ≤ 6000, small gear ≤ 2000; the existing tier ceiling (`TRIANGLE_CEILING`: standard 4000, hero 15000) still applies.
- No brand marks or logos on any picture (existing blanking stays). No model detail where `content/control-layouts/<id>.json` places a control (the rig draws it).
- Builds must be deterministic: two builds of the same spec give byte-identical GLBs.
- Env for Blender tests: `$env:BLENDER_EXE='D:\Blender\blender.exe'`. E2E runs: `$env:E2E_PORT='4181'; npx playwright test <file>` (port 4173 may serve another checkout's build).
- Device build loop (**DBL**, used by every device task): (1) read the spec and its `sources`, open the real photos the spec cites; (2) set the `build` block (shape, params, budget); (3) `npm run asset:build -- <id> --scripted --project` (the route the device already uses; see `tools/assets3d/build-asset.ts --help`); (4) all gates green in `npm run validate:assets -- <id>`; (5) render the contact sheet (`npm run asset:sheet -- <id>`, plus the in-engine look audit `AUDIT_OUT=<dir> E2E_PORT=4181 npx playwright test tests/e2e/look-audit.spec.ts`) and **look at every image** next to the product photo; fix until the silhouette, edges, recesses and picture read right; (6) record the result (before / after tris, what was compared) in `docs/superpowers/notes/2026-11-10-models-log.md`; (7) commit the spec, the GLB under `public/assets/`, the manifest row and the log. After three failed attempts keep the current model and log the reason.

## Review Focus

1. A connector with no table entry or no `openingMm` must still get a sensible marker (fallback 20 mm), never 0 or NaN (Task 0.1 test).
2. A far camera: rings never fall under 9 CSS px outer diameter and never exceed 1.6x rest size at close range (Task 0.3 test).
3. Modelled detail (vents, handles, insets) overlapping a control rectangle would double the rig's caps: the builder must refuse it (Task 2.3 test).
4. The nine existing rack devices must stay byte-identical when the new rack params are absent (Task 2.2 regression test).
5. Ports must sit on a real surface after ears / plate insets move the front plane: `portSurface` gate on every rebuilt device (DBL step 4).

## File Map

- Create `src/scene/portMarkerSize.ts` — connector → marker diameter (pure).
- Create `src/scene/portMarkerMesh.ts` — flat ring VertexData / mesh factory (pure geometry + one Babylon call).
- Modify `src/scene/DeviceSpawner.ts` (marker creation ~l.738, `reanchorPorts` ~l.584), `src/creation/portProxies.ts` (`refresh`, `restyle`).
- Modify `tools/assets3d/shapes.ts` (new shapes / params), `specSchema.ts` (`build.budget`, `build.minFilletMm`), `gates.ts` (`checkDetail`, `checkFillet`), `runBuilder.ts` (flatZones), `blender/build_from_spec.py` (shapes).
- Tests: `tests/scene/portMarkerSize.test.ts`, `tests/scene/portMarkerMesh.test.ts`, `tests/creation/portProxies.test.ts` (extend), `tests/tools/assets3d/shapes.test.ts`, `builder.test.ts` (Blender integration), new `tests/tools/assets3d/gatesDetail.test.ts`, `tests/tools/assets3d/flatZones.test.ts`.
- Log: `docs/superpowers/notes/2026-11-10-models-log.md`.

---

## Wave 0 — Outline port markers

### Task 0.1: Marker size from the connector

**Files:** Create `src/scene/portMarkerSize.ts`; Test `tests/scene/portMarkerSize.test.ts`.
**Interfaces:** Produces `markerDiameterM(connector: string, openingMm?: number): number` (outer diameter in metres, = size × 1.25) and `CONNECTOR_MM: Record<string, number>`.

- [ ] **Step 1: Write the failing test.** `xlr3-f` → 0.030 m (24 × 1.25); `openingMm: 30` on xlr3-f → 0.0375; unknown id `nope` → 0.025 (20 × 1.25); `undefined` / `''` / `NaN` opening → table or fallback, always finite and > 0; every connector id in `content/catalog.json` ports has a table entry (list the missing ones in the failure message).
- [ ] **Step 2:** `npx vitest run tests/scene/portMarkerSize.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** with the table from spec 4.1 (xlr3-f/m, xlr5-f/m 24; trs-quarter/ts-quarter 14; trs-35mm 8; tt-bantam 11; rj45 16; ethercon 24; speakon-nl4 26; powercon-blue/true1 30; iec-c13/c14 30; schuko-plug/socket 30; usb-a 14, usb-b 12, usb-c 10; bnc 14; rca 13; toslink 9; dsub25 40; gpio-terminal 40; digilink 12). `openingMm` wins only when finite and > 0.
- [ ] **Step 4:** run the test → PASS. **Step 5:** commit `src/scene/portMarkerSize.ts tests/scene/portMarkerSize.test.ts`.

### Task 0.2: Ring mesh and spawner

**Files:** Create `src/scene/portMarkerMesh.ts`; Modify `src/scene/DeviceSpawner.ts`; Test `tests/scene/portMarkerMesh.test.ts`, extend `tests/creation/portProxies.test.ts` if it asserts marker size.
**Interfaces:** Consumes `markerDiameterM`. Produces `ringVertexData(outerM: number, thickness = 0.12): VertexData` (flat annulus in the XY plane, 32 segments, 64 triangles; outer radius = outerM / 2, ring width = max(thickness × outerM, 0.0012), so the inner radius = outer radius − ring width), and `createMarkerRing(scene: Scene, name: string, outerM: number): Mesh`.

- [ ] **Step 1: Failing tests.** Ring has 64 triangles; its bounding box is `outerM` wide; width ≥ 1.2 mm for a 10 mm ring; no NaN; a catalog device spawned in a NullEngine scene (see `portProxies.test.ts` setup) has every `portMarkers` mesh with a bounding size equal to `markerDiameterM(port.connector, specOpening)` ± 1 %, and `metadata.restScale === 1`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** In `DeviceSpawner.makeMarkers` replace the `CreateCylinder` by `createMarkerRing(..., markerDiameterM(port.connector, openingMm))` (opening from the loaded GLB extras port record when available, else undefined); keep `rotation.x = Math.PI/2` only if the ring is built in XY (the marker must face −Z of the device: check with the existing marker orientation test); keep material and `isPickable = false`. In `reanchorPorts` delete the neighbour-shrink block (restScale is 1) but keep the `metadata.restScale = 1` line so `portProxies.restScale` stays valid. Remove the `MARKER_DIAMETER` constant if unused (`portProxies.ts` has its own `MARKER_DIAMETER_M`, fixed in 0.3).
- [ ] **Step 4:** `npx vitest run tests/scene tests/creation` → PASS. **Step 5:** commit the touched files.

### Task 0.3: Screen-space floor and highlight rule

**Files:** Modify `src/creation/portProxies.ts`; Test `tests/creation/portProxies.test.ts`.
**Interfaces:** Produces exported constants `RING_MIN_PX = 9`, `RING_MAX_GROW = 1.6`, and `ringScale(restM: number, distanceM: number, fov: number, viewportPx: number): number` returning the uniform scale for a marker of rest diameter `restM` (≥ `RING_MIN_PX` on screen, ≤ `RING_MAX_GROW` × rest at close range, 1 in between).

- [ ] **Step 1: Failing tests.** `ringScale(0.03, 0.3, FOV, H) === 1` (close: the ring is bigger than 9 px, scale stays 1); at 20 m it returns a scale such that `0.03 × scale` spans ≥ 9 px; never above 1.6 when the ring already spans ≥ 9 px; finite for distance 0 / NaN (Review Focus 2). A highlighted marker (`mark` with `ok`/`pending`/hover) is never smaller than its rest size and never more than `HIGHLIGHT_PX` wide at far range; at close range (< 0.5 m) a pending marker on a 24 mm connector is ≤ 1.6 × its ring (not 50 mm).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** Replace `MARKER_DIAMETER_M` use: marker rest diameter is read from the mesh bounding box (`getBoundingInfo().boundingBox.extendSize.x * 2` at scale 1). In `refresh()` apply `ringScale` to every visible marker (the loop already walks entries; do the marker only when `s.scaling` target changed beyond 2 %, like the pick sphere). In `restyle`, a grown marker scales to `max(rest, labelScale(d, HIGHLIGHT_PX))` clamped by `RING_MAX_GROW × rest` when the camera is closer than 1 m. `firstClickRadiusPx` / `tightWorld` use the marker's real rest radius instead of 0.025.
- [ ] **Step 4:** `npx vitest run tests/creation/portProxies.test.ts` → PASS. **Step 5:** commit.

### Task 0.4: Look and e2e

- [ ] **Step 1:** start a private dev server (`npm run dev -- --port 3072`), open Mode Création, template with the QL1, camera on its rear; screenshot with the built-in browser (`window.__creation.frameDevice('<id>')`, `turnCamera`). Compare with the founder's screenshot: rings sit around each XLR, no disc hides a connector, the pending (orange) one is a ring around the etherCON.
- [ ] **Step 2:** run the creation e2e that touch ports: `$env:E2E_PORT='4181'; npx playwright test tests/e2e/creation-keyboard-patch.spec.ts tests/e2e/creation-modal.spec.ts tests/e2e/focusPatch.spec.ts tests/e2e/a1.spec.ts` → green (fix tests that read the old 50 mm size, with the reason in the commit).
- [ ] **Step 3:** commit; note in the log file. **Wave 0 review:** one fresh reviewer agent reads `git diff 042ff01..HEAD -- src tests` (read only) for click targets (24 px proxies unchanged), idle renders (refresh only on camera change), restScale contract.

---

## Wave 1 — Curved cabinets

### Task 1.1: Register `curved-cabinet`, budget and fillet fields

**Files:** Modify `tools/assets3d/shapes.ts`, `tools/assets3d/specSchema.ts`; Test `tests/tools/assets3d/shapes.test.ts`.
**Interfaces:** Produces shape id `'curved-cabinet'` with params `planFrontMm, sideBulgeMm, backRadiusMm, edgeRadiusMm, edgeSegments, crownMm, wooferRingMm, tweeterRingMm`, `usesPorts: true`; spec `build.budget?: { min: number; max: number }` and `build.minFilletMm?: number`.

- [ ] **Step 1:** extend the shapes test: `BUILD_SHAPES` contains `curved-cabinet`; the Python registry lists the same set (existing parity test); a spec with `build.budget {min:1500,max:3500}` parses, `{min:5,max:1}` is rejected.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement in shapes.ts and zod (`budget` refine min ≤ max, both positive integers). **Step 4:** PASS. **Step 5:** commit.

### Task 1.2: Gates `detail` and `fillet`

**Files:** Modify `tools/assets3d/gates.ts`, `tools/assets3d/build-asset.ts` (call them); Test `tests/tools/assets3d/gatesDetail.test.ts`.
**Interfaces:** Produces `checkDetail(report: GlbReport, spec: AssetSpecT): GateResult` (triangles within `build.budget`; passes when no budget declared) and `checkFillet(extrasFilletMm: number | null, spec: AssetSpecT): GateResult` (measured ≥ `build.minFilletMm`; passes when none declared; fails closed on NaN).

- [ ] **Step 1: Failing tests:** 44 tris vs budget 1500–3500 fails with the numbers in `detail`; 2000 passes; no budget passes; fillet 12 vs min 30 fails; NaN fails; null with a declared minimum fails.
- [ ] **Step 2–5:** implement, wire into the orchestrator so both gates appear in the manifest `gates`, run `npx vitest run tests/tools/assets3d/gatesDetail.test.ts tests/tools/assets3d/gates.test.ts`, commit.

### Task 1.3: Blender `build_curved_cabinet`

**Files:** Modify `tools/assets3d/blender/build_from_spec.py` (function + `SHAPES` entry); Test `tests/tools/assets3d/builder.test.ts` (Blender integration, skipped without `BLENDER_EXE`).
**Interfaces:** Consumes `plan` as the other cabinet shapes (`size_m`, `param_m`, `plan.ports`). Produces a body whose plan outline is: flat (or `crownMm`-crowned) baffle of width `planFrontMm`, side arcs bulging `sideBulgeMm`, back corners of radius `backRadiusMm`; extruded to height h; top and bottom edges filleted with `edgeRadiusMm` in `edgeSegments` (6–12) segments; optional shallow rings `wooferRingMm`, `tweeterRingMm` (recess 2 mm) on the baffle; rear pockets for ports with `insetMm` exactly as `build_speaker_cabinet`; writes `filletMm` (measured) into the GLB extras next to `realSizeMm`.

- [ ] **Step 1: Failing Blender tests** (use the existing helper in `builder.test.ts`): a 189×299×178 spec with the Genelec params builds; measured size equals the spec to 0.01 mm (stretch step as in `build_speaker_cabinet`); triangles within 1500–4000; no vertex has |x| > w/2; two builds are byte-identical; a pocket port gets a surface (`portSurface` input); `edgeRadiusMm` larger than half the smallest side raises `BuildError`; extras contain `filletMm` ≥ 0.9 × `edgeRadiusMm`.
- [ ] **Step 2:** `$env:BLENDER_EXE='D:\Blender\blender.exe'; npx vitest run tests/tools/assets3d/builder.test.ts -t curved` → FAIL.
- [ ] **Step 3: Implement** (build the plan outline as an N-gon from the arcs with ≥ 48 points, `extrude_xz`, bevel with `segments=edgeSegments` and `profile=0.5`, shade smooth + the existing auto-smooth/normal approach used by `revolve`). Rings: inset faces + a darker vertex colour zone via `body.done(CABINET_POCKET)` pattern.
- [ ] **Step 4:** PASS. **Step 5:** commit.

### Task 1.4: Genelec 8030C

**Files:** Modify `content/asset-specs/genelec-8030c.json`, `public/assets/genelec-8030c.glb`, `public/assets/ASSET_MANIFEST.json`, thumbnails if the pipeline writes them.

- [ ] Follow **DBL**. Params start at: `planFrontMm 150, sideBulgeMm 22, backRadiusMm 60, edgeRadiusMm 32, edgeSegments 10, wooferRingMm 128, tweeterRingMm 36`, `budget {min 1500,max 4000}`, `minFilletMm 25`. Compare against `8030CP-k10_web.jpg` and the `8030c_views.pdf` drawings: front must show a rounded enclosure, not a hexagon; the rear amplifier plate recess and IEC / XLR pockets keep their port positions. Keep `projection` of `io / opposite / left`; re-check `blankRects`. Run `npx vitest run tests/tools/assets3d tests/scene` (a Genelec test pins the old `modelFront`; update it with the reason if the front axis result is unchanged it needs no edit).

### Task 1.5: QSC K12.2 and Yamaha DBR12

- [ ] Follow **DBL** for each (`curved-cabinet`, smaller radii: K12.2 `edgeRadiusMm 22`, DBR12 `16`; keep their real front / rear photos and pocket ports; budgets speaker ≤ 4000). Compare silhouettes with the cited photos (K12.2 has rounded polypropylene walls; DBR12 a trapezoid with a wide handle recess: add a 90 × 22 mm handle recess on each side only if the photo shows it).

### Task 1.6: Wave 1 verification

- [ ] `npx vitest run tests/tools tests/scene tests/creation` green; `npm run validate:assets` all ok; creation e2e for audio / speakers (`tests/e2e/creation-front.spec.ts` and any spec naming K12 / 8030) green with `E2E_PORT=4181`; in-engine contact sheet of the three speakers committed to the log. One fresh reviewer agent reviews `git diff` of the wave (builder determinism, gate fail-closed, no change to realSizeMm).

---

## Wave 2 — Rack device v2

### Task 2.1: Params and schema

**Files:** Modify `tools/assets3d/shapes.ts`, `specSchema.ts`; Test `shapes.test.ts`.
**Interfaces:** `rack-box` accepts new optional params `earWidthMm, earThicknessMm, earHoleMm, handleCount, handleProjectionMm, plateInsetMm, filletMm, ventSlots, ventDepthMm, feetMm, bodyWidthMm, rearInsetMm`.

- [ ] Test: a spec with each new param parses; unknown param still rejected. Implement; commit.

### Task 2.2: Blender implementation (defaults identical)

**Files:** Modify `build_rack_box` in `build_from_spec.py`; Test `builder.test.ts`.

- [ ] **Step 1: Failing tests (Blender):** (a) **regression:** each of the nine existing rack specs built before this task (snapshot hashes taken from `public/assets/*.glb` with the unchanged defaults → rebuild with the new code and params absent) is byte-identical (Review Focus 4: record the nine sha256 in the test as constants before editing the Python); (b) ears: `earWidthMm 20, earThicknessMm 3, earHoleMm 6` on a 482.6 mm front with `bodyWidthMm 438` gives a chassis 438 wide and ears reaching ±241.3 mm, 2 slotted holes per ear; (c) `plateInsetMm 2` raises the front plate 2 mm over the chassis and the front port plane moves to the plate face (extras `ioFaceOffsetMm`); (d) handles: 2 handles project `handleProjectionMm`; (e) vents: N rect recesses on top; (f) fillet: measured `filletMm`; (g) determinism; (h) triangle count inside 1500–3500 for a 1U sample.
- [ ] **Step 2:** FAIL. **Step 3: Implement.** Defaults (all new params absent) must follow the old code path exactly. Use bmesh bevel with `segments=3` for `filletMm` only when set. **Step 4:** PASS. **Step 5:** commit.

### Task 2.3: Flat zones from control layouts

**Files:** Modify `tools/assets3d/runBuilder.ts`, `build_from_spec.py`; Test `tests/tools/assets3d/flatZones.test.ts` (+ Blender case).
**Interfaces:** `flatZonesFor(deviceId: string): { face: string; x0: number; y0: number; x1: number; y1: number }[]` (mm, face-local, from the control layout's control footprints + 3 mm), written to `plan.flatZones`; the builder raises `BuildError` when a vent / handle / inset edge intersects a zone on the same face.

- [ ] Tests: ISA One has ≥ 8 zones; a vent over a zone raises; a vent outside passes; a device with no layout gets `[]`. Implement; commit.

### Task 2.4: 1U / 2U rack units

**Devices:** `avid-hd-io` (2U 88.9 mm: ears, two front handles absent per photo → check), `antelope-ocx-hd` (1U: ears, front plate inset), `grace-m905` (1U half-rack look: check the photo; its front plate is padded with ears already), `switchcraft-studiopatch-9625` (1U: ears, no handles), `aeta-scoop5-s` (1U).

- [ ] For each, follow **DBL**: ears from the standard (EIA-310: ear 482.6 wide, holes 465.1 mm apart, 6.35 × 15.9 slots, 1U = 44.45 mm); chassis width 438–450 mm per the spec sources; handles only if the cited photo shows them; vent slots on the top only where the photo shows them; budget 1500–3500. Do not model controls where a layout exists (`grace-m905`, ISA). Commit per device.

### Task 2.5: Desktop boxes

**Devices:** `focusrite-isa-one`, `aeta-scoopy-plus-s`, `playout-pc`.

- [ ] **DBL**: fillet 4–6 mm, rubber feet 4 × (Ø 14 mm, 4 mm), side vents (PC: grille vents on the side per the generic panel spec), front plate inset 1.5 mm. ISA One: flat front zone from its layout. Budget ≤ 2000 (PC ≤ 3500).

### Task 2.6: Tower

**Device:** `avid-protools-hdx` (169 × 386 × 445 mm tower: rounded vertical edges, top handle recess if the generic panel shows one, side vent grid, feet).

- [ ] **DBL**, budget 2000–3500.

### Task 2.7: Wave 2 verification

- [ ] Full `npx vitest run tests/tools tests/scene tests/creation tests/controls`; `npm run validate:assets` (all ok, every rack device ≥ 1500 tris); controls e2e (`tests/e2e/creation-controls.spec.ts`) green (controls still sit on flat plates); contact sheets in the log; fresh reviewer on the wave diff.

---

## Wave 3 — Consoles

### Task 3.1: `console-wedge` v2 params

**Files:** `shapes.ts`, `specSchema.ts`, `build_from_spec.py` (`build_console_wedge`), tests as 2.1/2.2.
**Interfaces:** new optional params `filletMm, cheekMm, feetMm, armRestMm, slotPlates` (list of rects on the top profile).

- [ ] Tests: regression (current QL1 and Axia builds byte-identical with params absent), cheeks add width-neutral side plates, fillet measured, determinism, flat zones respected (controls areas are the top face). Implement; commit.

### Task 3.2: Yamaha QL1 and Axia iQ

- [ ] **DBL** for `yamaha-ql1` (arm rest rail front, side cheeks, four rubber feet, two option-slot plates at the rear (`SLOT 1/2` per the screenshot), budget ≤ 6000) and `axia-iq` (wedge fillets, feet, rear recess; budget ≤ 3500). The top stays flat under the rig's controls. After building, run `$env:E2E_PORT='4181'; npx playwright test tests/e2e/creation-controls.spec.ts tests/e2e/creation-front.spec.ts` and compare the in-engine QL1 with the official photo; the controls layout's `topProfile` must still equal the spec profile (parity test).

### Task 3.3: Wave 3 verification and review

- [ ] unit + controls + creation e2e green; contact sheets in the log; fresh reviewer on the diff.

---

## Wave 4 — Mics, power strip, stand

### Task 4.1: Scripted mics with A/B

**Devices:** `shure-sm57`, `ev-re20`, `ev-re50`, `neumann-u87-ai` (specs already have `build.revolve`).

- [ ] For each: follow **DBL** to a scripted candidate **without overwriting the Meshy GLB** (build to a temp output; `--out` flag or copy aside), render candidate and the current Meshy model side by side with the product photo. Accept the candidate only if its silhouette (grille, ring, body taper, connector end) matches the photo at least as well; otherwise keep Meshy and log why. Candidate triangles ≤ 6000, `tool: scripted` or `hybrid` (wrap picture: grille weave, bands, no brand mark), brands register row updated for an accepted candidate (Meshy → internal).

### Task 4.2: `power-strip` and multiprise-secteur

**Files:** `shapes.ts`, `specSchema.ts`, `build_from_spec.py` (`build_power_strip`), create `content/asset-specs/multiprise-secteur.json`; Test shapes + Blender.
**Interfaces:** shape `'power-strip'`, params `sockets, pitchMm, switchMm, cableDia, lenMm`; ports from the catalog device (`multiprise-secteur`).

- [ ] **Step 1:** read the catalog entry and any sources it cites; `npm run asset:spec -- multiprise-secteur` for a skeleton. **Step 2: failing tests:** schema parse, Blender build size exact, sockets as recesses with ports on their floors, determinism. **Step 3:** implement shape and spec (size from the catalog / product source; mark estimates). **Step 4:** DBL; add the id to the `ASSET_MANIFEST` through the build (the drift test must pass). **Step 5:** commit.

### Task 4.3: K&M 210/9 stand (optional)

- [ ] Only after 4.1 and 4.2: A/B a scripted `tripod-stand` against the Meshy stand with the same rule as 4.1. If no clear win keep Meshy; log.

### Task 4.4: Wave 4 verification

- [ ] unit + `validate:assets` + e2e subset (`creation-front`, mics / audio specs) green; contact sheets; fresh reviewer.

---

## Wave 5 — Audit and report

### Task 5.1: Whole-catalog audit

- [ ] Run the in-engine look audit for all 25 devices (`AUDIT_OUT=<dir> E2E_PORT=4181 npx playwright test tests/e2e/look-audit.spec.ts`), look at every sheet, fix any device that reads as a plain box, a hexagon where the real one is curved, or has markers hiding it. Re-run the gates. Update `docs/legal/BRANDS_AND_CREDITS.md` for any model whose origin changed (Meshy rows only where Meshy geometry remains).

### Task 5.2: Full verification

- [ ] `npx tsc --noEmit`, `npx eslint src tools`, `npm run validate:assets`, `npm run validate:catalog`, `npx vitest run` (all but e2e), chunk budget check (`npm run build` then the budget script already used in the earlier gate), full e2e `$env:E2E_PORT='4181'; npx playwright test` (build a private preview first as in earlier runs). Idle-render and frame-cost numbers from `window.__creation.sceneStats()` / `renderBench(n)` on the reference rig compared with the pre-wave numbers in the log (no regression > 10 %).

### Task 5.3: Final review, report, memory

- [ ] One independent reviewer (fresh agent, read only) over `git diff 042ff01..HEAD` focusing on the Review Focus list. Fix what it finds with tests.
- [ ] Write `E:\CLAUDE BU\reports\TekPractice night 4 - all models finished.md` (what each device became with before / after triangles, what was kept and why, gates, test numbers, open items, nothing pushed). Update the memory file `project_tekpractice_3d_rebuild.md` and the `MEMORY.md` line (unpushed commit count, new shapes, markers).
- [ ] Final state: `git log origin/assets/3d-rebuild..HEAD` listed in the report; **no push**.

## Stretch (only if every task above is green)

### Task 6.1: Hand-measured layouts for more devices

- [ ] Layouts for `grace-m905` knobs, `avid-hd-io` meters, `antelope-ocx-hd` display, `aeta-scoop5-s` keypad following `docs/superpowers/specs/2026-11-10-interactive-controls-design.md` ("Adding a device"); run `tests/controls`; the parity test must pass.

---

## Self-review notes

- Spec coverage: 4.1 → Wave 0; 4.2 families → Waves 1–4 (curved-cabinet 1.3, rack 2.2, wedge 3.1, revolve 4.1, power-strip 4.2, tripod 4.3); 4.3 gates / determinism / flat zones → 1.2, each Blender task, 2.3; 4.4 verification → each wave end and 5.1–5.2; stop rules → DBL step 7 and Global Constraints; stretch → Task 6.1.
- Names used across tasks (`markerDiameterM`, `createMarkerRing`, `ringScale`, `checkDetail`, `checkFillet`, `flatZonesFor`, `build.budget`, `build.minFilletMm`) match their defining tasks.
- Review Focus 1–5 each have an owning test: 0.1, 0.3, 2.3, 2.2, and DBL step 4.
