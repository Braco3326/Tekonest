# TekPractice 3D Model Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pipeline that turns product photos plus a millimetre spec into GLB models with correct real size, orientation, `port_*` empties and separate `ctrl_*` parts, then run it on a 6-model pilot and stop for a founder go/no-go.

**Architecture:** Node/TypeScript tools under `tools/assets3d/` own everything testable and deterministic: the per-asset spec, the placement math, the GLB inspector, the gates and the Meshy client. Blender 5.1 runs headless only as a dumb executor of a Node-computed placement plan (clean, orient, scale, add empties and control objects, export). The app reads real size and part positions from GLB `extras`, falling back to today's behaviour for models that lack them.

**Tech Stack:** TypeScript + tsx + vitest, zod, `@gltf-transform/core|extensions|functions`, `draco3dgltf`, `sharp`, Blender 5.1 `bpy` (Python only inside Blender), Meshy REST API (`https://api.meshy.ai/openapi/v1`), Babylon.js 7 (`NullEngine` for loader tests).

**Spec:** `docs/superpowers/specs/2026-10-29-3d-model-rebuild-design.md`. Research notes: `E:\CLAUDE BU\research_notes\3d-models\` (A-D).

## Global Constraints

- Units: 1 glTF unit = 1 metre; Y-up; the face that carries the modelled I/O points toward -Z; pivot bottom-centre; root scale 1, no rotation, no negative scale.
- Size gate: bounding box equals `realSizeMm` within max(0.5 mm, 0.5 %). Reject and regenerate if proportions drift more than 5 % before the fix-up rescale.
- Ports: node name exactly `port_<portId>`; on the face plane within 0.2 mm; within 0.3 mm of the spec coordinates. Controls: node name exactly `ctrl_<controlId>`. Names match `content/catalog.json` ids exactly (no `.001` suffixes).
- Connector fit: a plug's outer size is 0 to 0.3 mm under its socket's opening; the plug origin sits at the mating plane.
- Budgets: connectors 300-800 tris; devices 800-4000 tris (a hero device may exceed this only with founder approval); one material per object; glTF validator 0 errors. Re-measure after Draco; parts around 6 mm skip aggressive quantization.
- `MESHY_API_KEY` comes only from the environment, header `Authorization: Bearer <key>`; it never appears in the repo, logs, reports or chat. Meshy files expire (check `expires_at`): download immediately.
- `assets-source/` stays gitignored: manufacturer photos are private reference, never committed or shipped. Logos and brand text are removed from shipped textures.
- The repo has uncommitted changes from other work (`content/catalog.json`, `content/catalog.schema.json`, `src/creation/betaDevices.ts` and its tests). Never `git add -A`; stage only the files a task names; never edit `content/catalog.json` content. Work in a worktree or branch cut from `feature/tekpractice-creative-mode` (superpowers:using-git-worktrees).
- Windows: use `npm.cmd`/`npx.cmd`; Bash heredocs with apostrophes break, use the Write tool. Blender is at `C:\Program Files\Blender Foundation\Blender 5.1\blender.exe` per old scripts but was NOT found on this PC; Task 1 resolves that.

## Review Focus

- A model arrives in centimetres or millimetres (`km-210-9` is ~95 units) or rotated 90 degrees: the fix-up normalises by the spec's size and flags drift instead of scaling blindly (Task 7).
- Compression moves a 6 mm connector's bounding box: gates run again on the shipped GLB (Tasks 5, 9).
- Meshy returns 402 (no API credits) or 429 (rate limit): fail with a clear message, never loop and burn credits (Task 6).
- The exporter or Blender adds suffixes (`port_in-mic-1.001`) or leaves a stray default Cube/Camera/Light: exact-name and no-extra-node gates (Tasks 5, 7).
- A spec lists a port or control id the catalog lacks, or the catalog has one the spec lacks: rejected with the device and id named (Task 2).
- The API key leaks into a log, error message or report (Task 6).

---

### Task 1: Environment helpers

**Files:**
- Create: `tools/assets3d/env.ts`
- Test: `tests/tools/assets3d/env.test.ts`

**Interfaces:**
- Produces: `findBlender(deps?: { env: NodeJS.ProcessEnv; exists: (p: string) => boolean }): string | null` (order: `BLENDER_EXE`, `C:/Program Files/Blender Foundation/Blender 5.1/blender.exe`, null); `requireMeshyKey(env?: NodeJS.ProcessEnv): string` (throws `Error("MESHY_API_KEY is not set")`, never echoes the value); `redact(text: string, secret: string): string`.

- [ ] **Step 1: Write failing tests** `findBlender prefers BLENDER_EXE`, `findBlender falls back to the default install path`, `findBlender returns null when nothing exists`, `requireMeshyKey throws when unset`, `redact replaces every occurrence of the key with ***`.
- [ ] **Step 2: Run** `npx.cmd vitest run tests/tools/assets3d/env.test.ts` and confirm FAIL (module missing).
- [ ] **Step 3: Implement** the three functions above in `tools/assets3d/env.ts`.
- [ ] **Step 4: Run** the same command and confirm PASS.
- [ ] **Step 5: Locate Blender on this PC.** Run `where blender` and check the default path. If none exists, STOP and ask the founder to install Blender 5.1 (or give the path to set `BLENDER_EXE`); do not install software yourself. Confirm with `& "<path>" --version` printing 5.1.
- [ ] **Step 6: Commit** `git add tools/assets3d/env.ts tests/tools/assets3d/env.test.ts && git commit -m "feat(assets3d): environment helpers"`

### Task 2: Asset spec schema and catalog parity

**Files:**
- Create: `tools/assets3d/specSchema.ts`, `tools/assets3d/loadSpecs.ts`, `tools/assets3d/spec-skeleton.ts`, `content/asset-specs/.gitkeep`
- Modify: `package.json` (scripts `asset:spec`)
- Test: `tests/tools/assets3d/specSchema.test.ts`

**Interfaces:**
- Produces (zod + types in `specSchema.ts`): `AssetSpec = { id: string; kind: 'device'|'connector'; tier: 'hero'|'standard'|'connector'; realSizeMm: {w:number,h:number,d:number}; ports: PortSpec[]; controls: ControlSpec[]; mating?: { role: 'plug'|'socket'; outerMm?: number; openingMm?: number }; sources: { kind: 'manual'|'datasheet'|'photo'; url: string; note: string }[] }`; `PortSpec = { portId: string; face: 'io'|'opposite'|'top'|'bottom'|'left'|'right'; xMm: number; yMm: number; confidence: 'manual'|'photo' }` (face-local origin bottom-left seen from outside, x right, y up; 'io' is the face oriented to -Z); `ControlSpec = { controlId: string; kind: 'knob'|'fader'|'button'|'switch'|'led'; face: PortSpec['face']; xMm: number; yMm: number; axis: 'x'|'y'|'z'; travelMm?: number; sizeMm: {w:number,h:number,d:number} }`.
- Produces (`loadSpecs.ts`): `loadSpecs(dir?: string): AssetSpec[]`; `checkSpecParity(spec: AssetSpec, catalog: CatalogT): string[]` (error strings naming device and id for ports/controls missing on either side).
- `spec-skeleton.ts`: `npm run asset:spec -- <id>` writes `content/asset-specs/<id>.json` with ports/controls ids from the catalog, `realSizeMm` parsed from `knowledge-base/equipment/*.json` `key_specs.dimensions` when found, and zeroed coordinates marked `confidence: 'photo'` for a human to fill.

- [ ] **Step 1: Write failing tests** `rejects a non-positive size`, `rejects an unknown face`, `parity flags a spec port the catalog lacks, naming the device and port`, `parity flags a catalog port the spec lacks`, `parity passes when ids match exactly`.
- [ ] **Step 2: Run** the test file, confirm FAIL.
- [ ] **Step 3: Implement** schema, `checkSpecParity` and the skeleton CLI.
- [ ] **Step 4: Run** the tests, confirm PASS; run `npx.cmd tsx tools/assets3d/spec-skeleton.ts yamaha-ql1` and check the printed JSON has the catalog's 7 ports and `realSizeMm` 468 x 272 x 562 (the KB's W x H x D); delete the file after.
- [ ] **Step 5: Commit** (stage the named files plus `package.json`).

### Task 3: Placement plan

**Files:**
- Create: `tools/assets3d/placement.ts`
- Test: `tests/tools/assets3d/placement.test.ts`

**Interfaces:**
- Consumes: `AssetSpec` (Task 2).
- Produces: `buildPlacement(spec: AssetSpec): Placement` with `Placement = { sizeM: {w,h,d}; ports: { name: string; pos: [number,number,number]; outward: [number,number,number] }[]; controls: { name: string; pos: [number,number,number]; axis: 'x'|'y'|'z'; kind: string; sizeM: {w,h,d}; travelM?: number }[] }`, glTF space, metres, pivot bottom-centre. Face mapping: 'io' -> z=-d/2, outward (0,0,-1), x_world = xMm/1000 - w/2; 'opposite' -> z=+d/2 mirrored in x; 'top' -> y=h; 'bottom' -> y=0; 'left'/'right' -> x=-+w/2.
- The same module exports `toExtras(spec: AssetSpec, placement: Placement): AssetExtrasV1` (shape in Task 10).

- [ ] **Step 1: Write failing tests** `io face port lands at z=-d/2 and x offset from centre` (spec 468 x 272 x 562, port xMm 234, yMm 100 -> pos [0, 0.1, -0.281]), `opposite face mirrors x`, `bottom face port sits at y=0`, `control names are ctrl_<id>`, `outward vector matches the face`.
- [ ] **Step 2: Run**, confirm FAIL.
- [ ] **Step 3: Implement** `buildPlacement`.
- [ ] **Step 4: Run**, confirm PASS.
- [ ] **Step 5: Commit.**

### Task 4: GLB inspector

**Files:**
- Create: `tools/assets3d/inspect.ts`
- Test: `tests/tools/assets3d/inspect.test.ts`, `tests/tools/assets3d/helpers.ts` (`makeBoxGlb(opts: { sizeM:{w:number,h:number,d:number}; nodes?: {name:string; pos:[number,number,number]}[]; extras?: object; draco?: boolean }): Promise<Uint8Array>`, built with `@gltf-transform/core`)

**Interfaces:**
- Produces: `inspectGlb(bytes: Uint8Array): Promise<GlbReport>` with `GlbReport = { bboxM: {min:[n,n,n]; max:[n,n,n]}; triangles: number; materials: number; nodeNames: string[]; nodes: { name: string; worldPos: [n,n,n]; hasMesh: boolean }[]; rootScale: [n,n,n]; rootRotation: [n,n,n,n]; extras: unknown }`. It decodes Draco (register decoders from `draco3dgltf`) and computes the bounding box from decoded vertices, never from accessor min/max.

- [ ] **Step 1: Write failing tests** `reports the bounding box of a 0.2 x 0.1 x 0.3 box`, `lists nodes with world positions`, `counts triangles and materials`, `decodes a Draco-compressed file and still reports the true bbox` (quantization-safe tolerance 0.05 mm), `returns root extras`.
- [ ] **Step 2: Run**, confirm FAIL.
- [ ] **Step 3: Implement** `inspectGlb` with `NodeIO` + `KHRDracoMeshCompression` decoder; world positions by walking the scene graph.
- [ ] **Step 4: Run**, confirm PASS.
- [ ] **Step 5: Commit.**

### Task 5: Gates

**Files:**
- Create: `tools/assets3d/gates.ts`
- Test: `tests/tools/assets3d/gates.test.ts`

**Interfaces:**
- Consumes: `GlbReport` (Task 4), `AssetSpec` (Task 2), `Placement` (Task 3).
- Produces: `GateResult = { gate: string; ok: boolean; detail: string }`; `runGates(report: GlbReport, spec: AssetSpec, placement: Placement): GateResult[]`, composed of exported pure functions `checkSize`, `checkTransform` (pivot bottom-centre within 0.5 mm, scale 1, identity rotation, no negative scale), `checkParts` (exactly the placement's port and control names, exact match, no stray nodes such as `Cube`, `Camera`, `Light`), `checkPortPositions` (within 0.3 mm of placement; on the face plane within 0.2 mm; inside the face rectangle), `checkBudget` (triangles by `spec.tier`, one material), `checkConnectorFit(plug: AssetSpec, socket: AssetSpec): GateResult`, `checkProportionDrift(preScaleSizeM, spec): GateResult` (fail above 5 %).

- [ ] **Step 1: Write failing tests**, using `makeBoxGlb` reports: `size passes within 0.5 percent and fails at 1 percent`, `size tolerance is at least 0.5 mm for a 6 mm part`, `transform fails for a negative scale`, `parts fails on a suffixed name port_in-mic-1.001`, `parts fails on a stray Cube node`, `parts fails when a control is missing`, `port position fails at 0.4 mm off`, `port off the face plane fails`, `budget fails a connector at 900 triangles and passes at 800`, `connector fit passes 0.2 mm under and fails 0.5 mm under and fails oversize`, `proportion drift fails at 6 percent and passes at 4 percent`.
- [ ] **Step 2: Run**, confirm FAIL.
- [ ] **Step 3: Implement** the functions; `runGates` returns every result (never short-circuits) so reports show all failures.
- [ ] **Step 4: Run**, confirm PASS.
- [ ] **Step 5: Commit.**

### Task 6: Meshy client

**Files:**
- Create: `tools/assets3d/meshy.ts`
- Test: `tests/tools/assets3d/meshy.test.ts`

**Interfaces:**
- Consumes: `requireMeshyKey`, `redact` (Task 1).
- Produces: `createMultiImageTask(images: string[] /*data URIs, 1-4*/, opts: MeshyOpts, deps?: { fetch: typeof fetch; key: string }): Promise<string>` (POST `/openapi/v1/multi-image-to-3d`, returns `result`); `waitForTask(id: string, deps?, opts?: { pollMs: number; timeoutMs: number }): Promise<MeshyTask>` (GET `/openapi/v1/multi-image-to-3d/:id` until `SUCCEEDED|FAILED|CANCELED`); `downloadGlb(task: MeshyTask, deps?): Promise<Uint8Array>`; `MeshyTask = { id: string; status: string; progress: number; model_urls?: { glb?: string }; consumed_credits?: number; expires_at?: number; task_error?: { message: string } }`; `MeshyError` with `.status`. Default body: `ai_model: 'meshy-7.1'`, `geometry_resolution: 'standard'`, `should_texture: true`, `enable_pbr: true`, `texture_resolution: '2k'`, `should_remesh: true`, `topology: 'quad'`, `target_polycount` from `MeshyOpts`, `target_formats: ['glb']`, `auto_size: false`.

- [ ] **Step 1: Write failing tests with a fake `fetch`**: `sends the bearer header and the documented body`, `rejects more than 4 images before any request`, `402 throws a MeshyError that says to buy API credits and makes no retry`, `429 throws without retrying`, `waitForTask resolves on SUCCEEDED and returns consumed_credits`, `waitForTask throws with task_error.message on FAILED`, `error messages and thrown objects never contain the key` (use a recognisable fake key and assert `JSON.stringify(err)` and `err.message` exclude it), `downloadGlb refuses an expired task`.
- [ ] **Step 2: Run**, confirm FAIL.
- [ ] **Step 3: Implement** with injectable `fetch`; poll every 5 s by default; one attempt per call.
- [ ] **Step 4: Run**, confirm PASS.
- [ ] **Step 5: Live check (needs the founder's key).** Run `npx.cmd tsx tools/assets3d/meshy-balance.ts`, a tiny script that calls Meshy's account-balance endpoint (find its exact path in the API docs at `https://docs.meshy.ai/en/api`; not yet confirmed), prints only the integer, and never prints the key. Expected: an integer. If it prints 0, STOP: the API uses prepaid credits separate from the plan; tell the founder to buy a small API top-up.
- [ ] **Step 6: Commit.**

### Task 7: Blender fix-up

**Files:**
- Create: `tools/assets3d/blender/fixup.py`, `tools/assets3d/runFixup.ts`
- Test: `tests/tools/assets3d/fixup.test.ts` (integration; `it.skipIf(!findBlender())`)

**Interfaces:**
- Consumes: `Placement`, `toExtras` (Task 3), `findBlender` (Task 1).
- Produces: `runFixup(inGlb: string, outGlb: string, spec: AssetSpec): Promise<FixupReport>` with `FixupReport = { preScaleSizeM: {w,h,d}; scaleApplied: [n,n,n]; rotatedDegrees: number }`. It writes the Node-computed placement and extras to a temp JSON, runs `blender --background --factory-startup --python fixup.py -- --in --out --plan <json>`, and `fixup.py` only: wipes the factory scene, imports the GLB, merges by distance, fills holes, recalculates normals, detects the longest axis mismatch and rotates in 90-degree steps to match the spec's axis order (recording `rotatedDegrees`), scales to the plan size (non-uniform, recording `preScaleSizeM`), sets the pivot bottom-centre, creates `port_<portId>` empties and `ctrl_<controlId>` objects at the plan positions, cuts nothing yet beyond a shallow socket recess per port (kept simple: a boolean cylinder of the port's `sizeMm` when given), writes `extras` under the key `tekpractice` on the root, exports GLB with custom properties on, +Y up, no cameras or lights.

- [ ] **Step 1: Write the failing integration test.** Build a 0.5 x 0.1 x 0.2 m box GLB with `makeBoxGlb` deliberately modelled in centimetres (x100) and rotated 90 degrees about Y, plus a spec for 468 x 44 x 230 mm with one `io` port and one knob; run `runFixup`; then `inspectGlb` and `runGates` must all pass, and `FixupReport.rotatedDegrees` must be 90.
- [ ] **Step 2: Run**, confirm FAIL.
- [ ] **Step 3: Implement** `fixup.py` and `runFixup.ts`.
- [ ] **Step 4: Run**, confirm PASS (or the test is reported skipped with the reason "Blender not found").
- [ ] **Step 5: Add test** `proportion drift above 5 percent is reported, not hidden`: feed a box whose aspect is 20 percent off; the report's `preScaleSizeM` lets `checkProportionDrift` fail.
- [ ] **Step 6: Commit.**

### Task 8: Contact sheet

**Files:**
- Create: `tools/assets3d/blender/render_views.py`, `tools/assets3d/contactSheet.ts`
- Test: `tests/tools/assets3d/contactSheet.test.ts` (skipIf no Blender)

**Interfaces:**
- Produces: `renderContactSheet(glb: string, referencePhoto: string | null, outPng: string): Promise<void>`: front, back, left, top orthographic renders at 512 px with the camera clip start at 1 mm (an old pitfall cut 2-3 cm connectors) composed with `sharp` next to the reference photo; a per-view overlay of the spec's bounding rectangle.

- [ ] **Step 1: Write the failing test** `renders a 4-view sheet with the expected pixel size` for a fixture GLB.
- [ ] **Step 2: Run**, confirm FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run**, confirm PASS; open the PNG and check the box is fully in frame in every view.
- [ ] **Step 5: Commit.**

### Task 9: Orchestrator and manifest

**Files:**
- Create: `tools/assets3d/build-asset.ts`, `tools/assets3d/manifest.ts`
- Modify: `package.json` (scripts `asset:build`, `asset:pilot`), `public/assets/ASSET_MANIFEST.json` (new optional fields only, existing entries untouched)
- Test: `tests/tools/assets3d/buildAsset.test.ts`

**Interfaces:**
- Consumes: Tasks 2-8.
- Produces: `buildAsset(id: string, opts: { maxAttempts: number; rawGlb?: string; dryRun?: boolean }, deps?): Promise<BuildReport>`; `BuildReport = { id; attempts: { n: number; credits: number; gates: GateResult[] }[]; ok: boolean; finalGlb?: string }`; CLI `npm run asset:build -- <id> [--raw file.glb] [--attempts 3]`. Flow: load spec and photos from `assets-source/<id>/photos/`, generate (or reuse `--raw`), `runFixup`, `inspectGlb`, `runGates`, Draco compress with the existing `@gltf-transform` toolchain, **re-inspect and re-run the size and port gates on the compressed file**, write `assets-source/<id>/report.json` (credits per attempt, gate results, no key), and only on pass copy to `public/assets/<id>.glb` and add manifest fields `tool`, `toolVersion`, `date`, `specSource`, `logosRemoved`, `gates`. After `maxAttempts` failures it stops and leaves `public/assets` untouched.
- `manifest.ts`: `recordAsset(manifestPath, entry): void` that preserves the existing BOM-safe handling used by `tools/blender/update-manifest.mjs`.

- [ ] **Step 1: Write failing tests with a fake Meshy and a stubbed fix-up**: `a passing attempt copies the GLB and records the manifest entry`, `a failing attempt retries up to maxAttempts then leaves public/assets untouched`, `compression that shifts a 6 mm connector past tolerance fails the build`, `the report contains credits per attempt and no secret`, `--raw skips Meshy entirely` (zero fetch calls), `the same raw GLB and spec give a byte-identical output and an identical report twice` (spec's rebuild-determinism requirement).
- [ ] **Step 2: Run**, confirm FAIL.
- [ ] **Step 3: Implement** `buildAsset` and `recordAsset`.
- [ ] **Step 4: Run**, confirm PASS; run `npm.cmd run asset:build -- shure-sm58 --raw <a hand-made box GLB> --dry-run` and confirm it prints the gate table and writes nothing.
- [ ] **Step 5: Commit.**

### Task 10: App reads GLB extras

**Files:**
- Create: `src/scene/assetExtras.ts`
- Modify: `src/scene/DeviceSpawner.ts` (`normalizeModel`, `tryLoadModel`, `DeviceInstance`)
- Test: `tests/scene/assetExtras.test.ts`, `tests/scene/deviceSpawnerExtras.test.ts` (NullEngine + `SceneLoader`, pattern of `tests/creation/sceneHost.test.ts`)

**Interfaces:**
- Produces (`assetExtras.ts`): `interface AssetExtrasV1 { schema: 1; realSizeMm: {w:number;h:number;d:number}; ports: { portId: string; pos: [number,number,number] }[]; controls: { controlId: string; pos: [number,number,number]; axis: 'x'|'y'|'z'; kind: string }[] }`; `parseAssetExtras(raw: unknown): AssetExtrasV1 | null` (returns null for anything malformed, never throws); `findExtras(glbRoot: AbstractMesh): AssetExtrasV1 | null` reading `metadata.gltf.extras.tekpractice` on the root node or any descendant TransformNode.
- `DeviceInstance` gains `controlNodes: Map<string, TransformNode>` (the `ctrl_<id>` nodes), empty when the model has no extras.
- Behaviour: when extras are present `normalizeModel` uses scale 1 (no height scaling, no 180-degree flip), keeps grounding and centring as no-ops, and `reanchorPorts` is unchanged (it already prefers `port_<id>` empties). When absent, behaviour is identical to today (`REAL_SIZE_M`, height scaling, grid fallback).

- [ ] **Step 1: Write failing tests** `parseAssetExtras returns null for a wrong schema number`, `... for a missing realSizeMm`, `... accepts a valid object`, and a NullEngine test `a GLB with tekpractice extras loads at scale 1 and exposes ctrl nodes` (first confirm where Babylon puts node extras for a GLB built with gltf-transform; if it is not `metadata.gltf.extras`, adapt `findExtras` and record the finding in a code comment), plus `a GLB without extras still takes the height-scaling path` and `a malformed extras object falls back without throwing`.
- [ ] **Step 2: Run**, confirm FAIL.
- [ ] **Step 3: Implement** the new module and the two small changes in `DeviceSpawner.ts`.
- [ ] **Step 4: Run** `npx.cmd vitest run tests/scene tests/creation` and confirm all pass (no regression in the existing 5 spawner tests).
- [ ] **Step 5: Commit.**

### Task 11: Asset validation command

**Files:**
- Create: `tools/validate-assets.ts`
- Modify: `package.json` (script `validate:assets`)
- Test: `tests/tools/assets3d/validateAssets.test.ts`

**Interfaces:**
- Produces: `validateAssets(assetsDir: string, specsDir: string): Promise<{ id: string; results: GateResult[] }[]>`; the CLI runs gates over every `public/assets/<id>.glb` that has a spec, prints a table, exits 1 on any failure; GLBs without a spec are reported as `unmigrated` (info, not failure), so old models keep shipping.

- [ ] **Step 1: Write failing tests** `reports unmigrated for a GLB without a spec`, `fails when a shipped GLB breaks its spec`, `passes a GLB that meets its spec`.
- [ ] **Step 2: Run**, confirm FAIL. **Step 3: Implement.** **Step 4: Run**, confirm PASS; run `npm.cmd run validate:assets` and confirm it lists the current 50 GLB as unmigrated and exits 0.
- [ ] **Step 5: Commit.**

### Task 12: Pilot inputs (human in the loop)

**Files:**
- Create: `content/asset-specs/{shure-sm58,yamaha-ql1,yamaha-rio3224-d2,xlr3-f,trs-quarter,rj45}.json`; photos and notes under gitignored `assets-source/<id>/`
- Test: `tests/tools/assets3d/pilotSpecs.test.ts` (loads the 6 specs, asserts schema and catalog parity)

- [ ] **Step 1:** For each pilot id, collect 1-4 manufacturer images (front, back, side, plus a panel close-up where it exists) into `assets-source/<id>/photos/`, and record each source URL in the spec's `sources`.
- [ ] **Step 2:** Run `npm.cmd run asset:spec -- <id>`, then fill `realSizeMm` and every port/control coordinate from the manual, datasheet or panel drawing in the repo's `knowledge-base` (manual links in `knowledge-base/equipment/*.json`). Mark coordinates read from photos as `confidence: 'photo'`.
- [ ] **Step 3: Write the failing test** `pilot specs load and match the catalog`, run it, then make it pass by fixing the specs.
- [ ] **Step 4:** Founder check: show the 6 specs' coordinates as a short table and ask the founder to confirm anything marked `photo`.
- [ ] **Step 5: Commit** the 6 JSON specs and the test only (photos stay untracked).

### Task 13: Pilot run and go/no-go

**Files:**
- Create: `docs/superpowers/pilot/2026-10-29-pilot-report.md`

- [ ] **Step 1:** Check the API credit balance (Task 6 step 5); confirm at least 400 credits are available.
- [ ] **Step 2:** Run `npm.cmd run asset:pilot` (the six ids, 3 attempts each). Record credits per attempt and every gate result.
- [ ] **Step 3:** Run `renderContactSheet` for each result and `npm.cmd run validate:assets`; fix nothing by hand yet.
- [ ] **Step 4:** Start the dev server and view each model in the app (`npx.cmd tsx tools/asset-load-proof.ts` for the load proof, plus screenshots in the browser): port markers must sit on the sockets, scale must look right against the neighbouring devices, `ctrl_` nodes must exist.
- [ ] **Step 5:** Write the pilot report: pass/fail per model, credits spent, triangle counts against the budgets, what failed and why, and a recommendation among full rollout, parametric connectors, or Tripo for the failing class.
- [ ] **Step 6:** STOP. Present the report and the contact sheets to the founder for the go/no-go. The rollout (connector kit, hero devices, rest) gets its own plan after a go.
- [ ] **Step 7: Commit** the report (not the photos, not any raw generation output).
