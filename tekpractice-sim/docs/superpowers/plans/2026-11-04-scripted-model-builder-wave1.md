# Scripted model builder, wave 1: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `xlr3-f`, `trs-quarter`, `rj45` and `yamaha-rio3224-d2` from their asset specs in headless Blender (no Meshy), through the existing fix-up, gates, Draco and manifest, with `npm run asset:build -- <id> --scripted`.

**Architecture:** The spec JSON gets an optional `build` block (`shape` + numeric `params`). A new Python script `build_from_spec.py` creates one exact-proportion mesh per shape and exports a raw GLB; Node (`runBuilder.ts`) feeds it a `plan.json`, exactly like `runFixup.ts`. `buildAsset` treats that GLB as the raw input of attempt 1, so the existing fix-up (24-rotation match, exact scale, pivot, `port_*`/`ctrl_*` empties, recesses, `tekpractice` extras) and every gate run unchanged.

**Tech Stack:** TypeScript (tsx, vitest, zod), Python 3 inside Blender 5.2.3 (`bpy`, `bmesh`), `@gltf-transform/*`.

**Spec:** `docs/superpowers/specs/2026-11-04-scripted-model-builder-design.md` (builds on `2026-10-29-3d-model-rebuild-design.md`). Work in `E:\dev\Tekonest-wt\assets3d\tekpractice-sim`, branch `assets/3d-rebuild`.

## Global Constraints

- Windows; use `npx.cmd` / `npm.cmd`. Blender is `D:\blender.exe`, found through the user variable `BLENDER_EXE` (`findBlender()` in `tools/assets3d/env.ts`). Integration tests skip when Blender is missing.
- Style: no semicolons, single quotes, doc header on each file; Python typed like `fixup.py`.
- Stage only the files a task names; never `git add -A`; never edit `content/catalog.json`; no network, no Meshy call, never read `MESHY_API_KEY`.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- In the GLB file the `io` face is at glTF +Z, Y up, metres (R9/R15). Connector: pivot = centre of the mating face, body along +Z, mating face at z = 0. Device: pivot bottom-centre.
- Gates stay as they are: size within max(0.5 mm, 0.5 %); connectors <= 800 triangles, standard/hero <= 4000; exactly one material; names exactly `port_<id>` / `ctrl_<id>`; glTF validator 0 errors.
- Builder output is deterministic (no randomness, no timestamps).
- Wave-1 `rack-box` has no panel inset and no ear flanges: ports are placed on the bounding-box face, so an inset would leave them floating until the per-port surface gate exists (2026-10-29 spec 4.5).
- Do not run `asset:build` with `--ship` in this plan: shipping overwrites the existing `public/assets/*.glb` and waits for the founder's approval of the look.

## Review Focus

1. A `build` block with an unknown or misspelled param (`frontLenmm`) must be rejected by name, not silently ignored (Task 1, Task 2).
2. `--scripted` on a spec with no `build` block must fail before any work directory or file is created (Task 6).
3. A shape used on the wrong kind (`rack-box` on a connector, `cylinder-plug` on a device) must be refused with both names in the message (Task 1).
4. The square cross-section XLR (19.2 x 19.2 x 72.5 mm) must come out of the fix-up unrotated (`rotatedDegrees` 0), because the rotation search ties between w and h (Task 3).
5. Non-finite, zero or negative params must fail with the param name (Task 1) and the script must exit non-zero with a one-line `BUILD_FAIL <reason>` (Task 3).

---

### Task 1: `build` block in the spec schema, shape table and validation

**Files:**
- Create: `tools/assets3d/shapes.ts`
- Modify: `tools/assets3d/specSchema.ts` (add `BuildSpec`, `build` on `AssetSpec`, export `BuildSpecT`)
- Test: `tests/tools/assets3d/shapes.test.ts` (new), `tests/tools/assets3d/specSchema.test.ts` (additions)

**Interfaces:**
- Produces in `shapes.ts` (no runtime imports; `import type` of `AssetSpecT` only):
  - `export const BUILD_SHAPES = ['cylinder-plug', 'trs-plug', 'rj45-plug', 'rack-box'] as const` and `export type BuildShape = (typeof BUILD_SHAPES)[number]`
  - `export const SHAPE_SPECS: Record<BuildShape, { kind: 'device' | 'connector'; params: readonly string[]; needsMatingOuter: boolean }>` with: `cylinder-plug` connector, params `['frontLenMm']`, needs mating outer; `trs-plug` connector, `['barrelMm']`, needs mating outer; `rj45-plug` connector, `[]`, no; `rack-box` device, `['chamferMm']`, no.
  - `export function validateBuild(spec: AssetSpecT): string[]` returns error strings (empty = ok; also empty when `spec.build` is absent).
- Produces in `specSchema.ts`: `BuildSpec` = `z.object({ shape: z.enum(BUILD_SHAPES), params: z.record(z.string(), z.number().finite()).optional() }).strict()`; `AssetSpec.build: BuildSpec.optional()`.

- [ ] **Step 1: Write the failing tests** in `shapes.test.ts`, with a `specWith(build, over)` helper returning a valid `AssetSpecT` (copy the shape of `deviceSpec` in `fixup.test.ts`). Cases, each asserting the exact error text fragments:
  - no `build` block returns `[]`.
  - `cylinder-plug` on `kind: 'device'` returns one error containing both `cylinder-plug` and `device`.
  - `rack-box` on a connector returns an error containing `rack-box` and `connector`.
  - `params: { frontLenmm: 12 }` returns an error containing `frontLenmm` and the allowed names (`frontLenMm`).
  - `params: { frontLenMm: 0 }`, `-1` returns an error containing `frontLenMm` and `positive`; `NaN` is rejected by the schema (add that to `specSchema.test.ts`: `AssetSpec.safeParse` fails for `NaN` and for an unknown shape `'cube'`).
  - `cylinder-plug` without `mating.outerMm` returns an error containing `mating.outerMm`.
  - a valid `cylinder-plug` with `mating.outerMm: 15.75` and `params: { frontLenMm: 12 }` returns `[]`.
  - `specSchema.test.ts`: a spec without `build` still parses; a spec with `build: { shape: 'rack-box' }` parses; `build: { shape: 'rack-box', extra: 1 }` fails (strict).
- [ ] **Step 2: Run to verify failure.** `npx.cmd vitest run tests/tools/assets3d/shapes.test.ts tests/tools/assets3d/specSchema.test.ts` — expect FAIL (module not found / unknown key).
- [ ] **Step 3: Implement** `shapes.ts` and the schema change as specified in Interfaces. `validateBuild` messages name the asset id, the shape and the param.
- [ ] **Step 4: Run** the same command plus `npx.cmd tsc --noEmit` — expect PASS and no type errors.
- [ ] **Step 5: Commit.** `git add tools/assets3d/shapes.ts tools/assets3d/specSchema.ts tests/tools/assets3d/shapes.test.ts tests/tools/assets3d/specSchema.test.ts` then `git commit -m "Add build block and shape table to the asset spec schema"` (with the trailer).

### Task 2: `runBuilder.ts` (Node side of the builder)

**Files:**
- Create: `tools/assets3d/runBuilder.ts`
- Test: `tests/tools/assets3d/runBuilder.test.ts` (new)

**Interfaces:**
- Consumes: `defaultExec`, `ExecResult`, `FixupDeps` from `./runFixup`; `findBlender` from `./env`; `validateBuild` from `./shapes`; `AssetSpecT` from `./specSchema`.
- Produces:
  - `export const BUILD_SCRIPT: string` (absolute path of `blender/build_from_spec.py`, same technique as `FIXUP_SCRIPT`)
  - `export const BUILDER_VERSION = 'blender-builder-1'`
  - `export async function runBuilder(spec: AssetSpecT, outGlb: string, deps: FixupDeps = {}): Promise<void>`
  - Blender command line: `--background --factory-startup --python-exit-code 1 --python <BUILD_SCRIPT> -- --plan <plan.json> --out <outGlb>`.
  - `plan.json`: `{ id, kind, shape, sizeMm: {w,h,d}, matingOuterMm?: number, params: Record<string, number> }` (`params` is `{}` when the spec gives none).

- [ ] **Step 1: Write the failing tests** (fake `exec` like `fakeExec` in `fixup.test.ts`; it records the call, reads `plan.json`, and writes nothing):
  - the command line is exactly the one above and `plan` equals the expected object for an `xlr3-f`-like spec (`matingOuterMm: 15.75`, `params: { frontLenMm: 12 }`).
  - a spec without `build` rejects with a message containing `no build block` and the id, and the fake exec is never called.
  - `validateBuild` errors are thrown joined, before any exec (use the misspelled param).
  - `deps.blender: null` rejects with `Blender is not installed`.
  - exit code 1 with stderr `BUILD_FAIL negative size` rejects with a message containing `negative size` and the id.
  - output path not ending in `.glb` rejects.
  - the temp dir is removed after success and after failure.
- [ ] **Step 2: Run** `npx.cmd vitest run tests/tools/assets3d/runBuilder.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `runBuilder` mirroring `runFixup` (temp dir via `mkdtemp`, `plan.json`, error tail 2000 chars, `rm` in `finally`).
- [ ] **Step 4: Run** the test file plus `npx.cmd eslint tools/assets3d tests/tools/assets3d` — expect PASS.
- [ ] **Step 5: Commit** `tools/assets3d/runBuilder.ts tests/tools/assets3d/runBuilder.test.ts` — "Add runBuilder: Node side of the scripted builder".

### Task 3: `build_from_spec.py` skeleton and `cylinder-plug` (XLR3-F)

**Files:**
- Create: `tools/assets3d/blender/build_from_spec.py`
- Test: `tests/tools/assets3d/builder.test.ts` (new; Blender integration, `it.skipIf(!BLENDER)` like `fixup.test.ts`)

**Interfaces:**
- Consumes: `runBuilder` (Task 2), `runFixup`, `inspectGlb`, `runGates`.
- Produces (Python): `SHAPES: dict[str, Callable[[dict], bpy.types.Object]]` with one entry per shape name, each key written as `"cylinder-plug": build_cylinder_plug,` on its own line (a test greps these); `class BuildError(Exception)`; on failure the script prints `BUILD_FAIL <reason>` to stderr and exits 1; `main()` reads `--plan`/`--out`, wipes the scene, builds the shape, exports a GLB (copy the `export_glb` options of `fixup.py`: +Y up, no cameras/lights).
- Authoring rule: build vertices in glTF space (x, y, z) in metres and place them at Blender `(x, -z, y)` (as `g2b` in `fixup.py`). Connectors: the mating face at z = 0, the body along +Z. One material named `tekpractice-body`, dark grey, no textures. Fixed object and mesh names, no randomness.

- [ ] **Step 1: Write the failing test file** `builder.test.ts` with a `buildAndFix(spec)` helper (builder -> `attempt.raw.glb` in a temp dir, `runFixup` -> `fixed.glb`, `inspectGlb`, `runGates`) and these cases:
  - `registry lists exactly BUILD_SHAPES`: read `build_from_spec.py`, collect `^\s+"([a-z0-9-]+)": build_` matches, compare as sets with `BUILD_SHAPES` (no Blender needed).
  - `xlr3-f builds at 19.2 x 19.2 x 72.5 mm`: take the spec from `loadSpecs()`; before Task 5 the spec has no `build` block, so test with `{ ...spec, build: { shape: 'cylinder-plug', params: { frontLenMm: 12 } } }`. Assert the raw GLB's bounding box is within 0.01 mm of the spec size, the mating end (the smaller-diameter end) is at the minimum-z side, and `triangles <= 800`.
  - `xlr3-f goes through the fix-up unrotated`: `runFixup` report has `rotatedDegrees === 0` (Review Focus 4) and every `runGates` result is `ok`.
  - `a negative size exits non-zero with BUILD_FAIL`: call `runBuilder` with `sizeMm.d = -1` bypassing zod via a cast; expect the rejection message to contain `BUILD_FAIL`'s reason.
- [ ] **Step 2: Run** `npx.cmd vitest run tests/tools/assets3d/builder.test.ts` — expect FAIL (script missing).
- [ ] **Step 3: Implement** the skeleton (`parse_args`, `wipe_scene`, `export_glb`, `main`, `BuildError` handling) and `build_cylinder_plug(plan)`: a shell cylinder of diameter `min(w, h)` from z = `frontLenMm` to z = d, a front cylinder of diameter `matingOuterMm` from z = 0 to z = `frontLenMm` (default `frontLenMm` 12), 32 segments each, and three blind pin holes (1.5 mm diameter, 3 mm deep) on the front face at 120 degrees on a 4.4 mm radius. The pin layout is stylised, not a measured copy; no gate depends on it. Build with `bmesh` (no boolean modifiers, so output is deterministic); validate that every dimension is finite and positive and that `matingOuterMm < min(w, h)`.
- [ ] **Step 4: Run** the test file — expect PASS (the Blender cases take about 15 s each).
- [ ] **Step 5: Commit** `tools/assets3d/blender/build_from_spec.py tests/tools/assets3d/builder.test.ts` — "Add Blender builder skeleton and the XLR plug shape".

### Task 4: `trs-plug` and `rj45-plug`

**Files:**
- Modify: `tools/assets3d/blender/build_from_spec.py` (two functions and two registry lines)
- Modify: `tests/tools/assets3d/builder.test.ts`

**Interfaces:**
- Produces: `build_trs_plug(plan)` and `build_rj45_plug(plan)` registered in `SHAPES`.
  - `trs-plug`: tip-end barrel of diameter `matingOuterMm` and length `barrelMm` (default 19) from z = 0 with a rounded tip and two insulator grooves, then a body cylinder of diameter `min(w, h)` to z = d.
  - `rj45-plug`: a box of w x h x d with a latch step on the +Y side (a 1.5 mm lower back half of the top, from 60 % of the length to the far end), eight contact slots (0.6 mm wide, 1 mm deep, 1.02 mm pitch) on the mating face at z = 0, body along +Z, h = 8.00 mm in Y with the latch side up.

- [ ] **Step 1: Write the failing tests** (same helper): for `trs-quarter` (spec plus `build: { shape: 'trs-plug', params: { barrelMm: 19 } }`) and `rj45` (spec plus `build: { shape: 'rj45-plug' }`): raw bounding box within 0.01 mm of the spec size, `triangles <= 800`, fix-up `rotatedDegrees === 0` and all gates `ok`. For `trs-quarter` also assert the barrel end is at minimum z and its diameter is `6.29 mm` within 0.01 mm (measure the vertex ring nearest z = 0.5 mm).
- [ ] **Step 2: Run** `npx.cmd vitest run tests/tools/assets3d/builder.test.ts -t "trs|rj45"` — expect FAIL (shape not registered).
- [ ] **Step 3: Implement** both builders with `bmesh`, same validation style as Task 3.
- [ ] **Step 4: Run** the full `builder.test.ts` — expect PASS.
- [ ] **Step 5: Commit** — "Add TRS and RJ45 plug shapes".

### Task 5: `rack-box` (Rio3224-D2)

**Files:**
- Modify: `tools/assets3d/blender/build_from_spec.py`, `tests/tools/assets3d/builder.test.ts`

**Interfaces:**
- Produces: `build_rack_box(plan)` registered in `SHAPES`: a w x h x d box centred in x and z with its bottom at y = 0, all twelve edges chamfered by `chamferMm` (default 1) via `bmesh.ops.bevel` with one segment, flat faces (no inset), no ear flanges.

- [ ] **Step 1: Write the failing tests**: with the `yamaha-rio3224-d2` spec plus `build: { shape: 'rack-box', params: { chamferMm: 1 } }`: raw bounding box 480 x 220 x 368 mm within 0.01 mm; after fix-up `rotatedDegrees === 0`, all gates `ok` (this exercises the six port empties on the `io` and `opposite` faces and the four 24 mm recesses), `triangles <= 4000`. A `chamferMm` of 300 (larger than half the smallest side) makes the script exit with `BUILD_FAIL` naming `chamferMm`.
- [ ] **Step 2: Run** `npx.cmd vitest run tests/tools/assets3d/builder.test.ts -t "rack"` — expect FAIL.
- [ ] **Step 3: Implement** `build_rack_box`.
- [ ] **Step 4: Run** the full `builder.test.ts` — expect PASS.
- [ ] **Step 5: Commit** — "Add the rack-box shape".

### Task 6: `--scripted` in `buildAsset` and the CLI

**Files:**
- Modify: `tools/assets3d/build-asset.ts` (`BuildOpts.scripted`, `BuildDeps.runBuilder`, the attempt-1 raw step, manifest `tool`, `parseArgs`, `main`, `USAGE`), `tools/assets3d/manifest.ts` (`tool?: 'meshy' | 'raw' | 'scripted'`)
- Test: `tests/tools/assets3d/buildAsset.test.ts` (additions; reuse its existing fakes)

**Interfaces:**
- Consumes: `runBuilder`, `BUILDER_VERSION` (Task 2), `validateBuild` (Task 1).
- Produces: `BuildOpts.scripted?: boolean`; `BuildDeps.runBuilder: (spec: AssetSpecT, outGlb: string) => Promise<void>` (default wraps `runBuilder`); CLI flag `--scripted`.
- Behaviour: with `scripted`, no photos are read, `maxAttempts` is 1, the raw GLB is `work/attempt-1.raw.glb` written by `d.runBuilder`, the rest of the loop is unchanged; manifest `tool: 'scripted'`, `toolVersion: BUILDER_VERSION`, `photos: []`, `taskId: null`, `logosRemoved: true`. Catalog parity is checked before building (it is free, and a bad spec should fail the same way). `main` prints no spending line and needs no `--yes`.
- CLI: `--scripted` together with `--raw`, `--attempts`, `--yaw`, `--flip` or `--pilot` is refused with a message naming both flags; `--ship --scripted` does not require `--logos-removed` and sets `opts.logosRemoved = true`.

- [ ] **Step 1: Write the failing tests** (all with the existing fake deps; none touches Meshy or Blender):
  - `scripted build creates no Meshy task and reads no photos`: assert `meshy.createMultiImageTask`, `readPhotos` never called, `runBuilder` called once with the spec and `<work>/attempt-1.raw.glb`, report `ok`.
  - `scripted ship records tool scripted`: with `dryRun: false` and fake paths, the manifest entry has `tool: 'scripted'`, `toolVersion: 'blender-builder-1'`, `taskId: null`, `photos: []`, `logosRemoved: true`, with no `logosRemoved` option passed.
  - `scripted without a build block fails before any file is created`: rejects with `no build block`, the work dir does not exist (Review Focus 2).
  - `scripted with a shape for the wrong kind` rejects with both names (Review Focus 3).
  - `a gate failure on a scripted build aborts after one builder call` (no retry).
  - CLI via `main(argv, deps, print)`: `['xlr3-f', '--scripted']` returns 0 without printing `will create`; `['xlr3-f', '--scripted', '--raw', 'x.glb']`, `--attempts 2`, `--yaw 90`, `--flip` each return 1 with output naming both flags; `['xlr3-f', '--scripted', '--ship']` is accepted.
- [ ] **Step 2: Run** `npx.cmd vitest run tests/tools/assets3d/buildAsset.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the changes listed above. Update `USAGE` with one `--scripted` line. Run `npx.cmd tsc --noEmit` and fix every consumer of `ManifestEntry.tool` the compiler flags.
- [ ] **Step 4: Run** `npx.cmd vitest run tests/tools/assets3d` and `npx.cmd eslint tools/assets3d tests/tools/assets3d` — expect PASS.
- [ ] **Step 5: Commit** `tools/assets3d/build-asset.ts tools/assets3d/manifest.ts tests/tools/assets3d/buildAsset.test.ts` — "Add --scripted to asset:build".

### Task 7: `build` blocks in the four specs and end-to-end tests

**Files:**
- Modify: `content/asset-specs/xlr3-f.json`, `trs-quarter.json`, `rj45.json`, `yamaha-rio3224-d2.json` (add a top-level `build` after `sources`' sibling keys; do not touch other keys)
- Modify: `tests/tools/assets3d/builder.test.ts` (replace the inline `build` overrides with the real specs)
- Test: `tests/tools/assets3d/pilotSpecs.test.ts` must stay green

**Interfaces:**
- Produces the values: `xlr3-f` `{ "shape": "cylinder-plug", "params": { "frontLenMm": 12 } }`; `trs-quarter` `{ "shape": "trs-plug", "params": { "barrelMm": 19 } }`; `rj45` `{ "shape": "rj45-plug" }`; `yamaha-rio3224-d2` `{ "shape": "rack-box", "params": { "chamferMm": 1 } }`. The `sources` arrays stay unchanged: the build parameters are generic styling, not measured; only the size and the port positions are measured.

- [ ] **Step 1: Write the failing tests** in `builder.test.ts`: for each of the four ids, `loadSpecs()` returns a spec with a `build` block, and an end-to-end case runs `buildAsset(id, { maxAttempts: 1, scripted: true, dryRun: true }, { paths: <temp dirs> })` with the real Blender and real gates: `report.ok === true`, the work dir holds `final.glb`, and nothing exists in the real `public/assets` for that run (temp `paths`). Add `two builder runs produce identical bytes`: `runBuilder` twice to different paths, compare buffers; if Blender's exporter is not byte-deterministic, report it and compare the fixed GLBs' `inspectGlb` reports instead, naming the difference.
- [ ] **Step 2: Run** `npx.cmd vitest run tests/tools/assets3d/builder.test.ts` — expect FAIL (specs have no `build` block).
- [ ] **Step 3: Edit the four JSON specs** as listed.
- [ ] **Step 4: Run** `npx.cmd vitest run tests/tools/assets3d` — expect PASS, including `pilotSpecs.test.ts`.
- [ ] **Step 5: Commit** the four JSON files and `builder.test.ts` — "Add build blocks to the four wave-1 specs".

### Task 8: Build the four for real and review the contact sheets

**Files:** none changed; outputs land in the git-ignored `assets-source/<id>/work/`.

- [ ] **Step 1: Build each asset (no shipping).** In `tekpractice-sim`: `npm.cmd run asset:build -- xlr3-f --scripted`, then the same for `trs-quarter`, `rj45`, `yamaha-rio3224-d2`. Expected: `result: PASS (dry run, not shipped)` for each, and `credits: n/a`.
- [ ] **Step 2: Render and look at the sheets.** `npm.cmd run asset:sheet -- <id>` for each; open the PNGs and check proportions, the mating end, the 24 mm recesses and port markers on the Rio. Write what you see (and anything stylised) in `assets-source/wave1-review.md`.
- [ ] **Step 3: Report to the founder** with the four sheets. Shipping (`--ship`, which overwrites `public/assets/<id>.glb`) is the founder's decision after viewing them in the simulator; leave it unticked here.

### Task 9: Wave-1 close

**Files:**
- Modify: `docs/superpowers/specs/2026-11-04-scripted-model-builder-design.md` (4.3 `rack-box` bullet and open items, to match the Global Constraints above)

- [ ] **Step 1: Verify.** `npx.cmd eslint tools src/scene tests/tools tests/scene`, `npx.cmd tsc --noEmit`, `npx.cmd vitest run` (whole suite once). Expect clean lint/types and green tests; report the counts.
- [ ] **Step 2: Run `npm.cmd run validate:assets`** and record its output (it must still exit 0).
- [ ] **Step 3: One review of the wave.** Ask the founder whether to run one `/code-review medium` of the branch diff since `dc0fce2`; fix Critical and Important findings only.
- [ ] **Step 4: Update the memory note** `project_tekpractice_3d_rebuild.md` (wave 1 done or not, what is shipped) and commit the spec edit — "Close scripted-builder wave 1".
