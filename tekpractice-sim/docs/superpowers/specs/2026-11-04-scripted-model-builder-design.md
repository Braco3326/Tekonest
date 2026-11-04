# TekPractice scripted model builder: design

Status: DRAFT for founder review (2026-11-04). Design approved in chat by the founder on 2026-11-04. Scope widened the same day, on the founder's instruction, from four assets to the whole catalog, delivered in waves (section 4.1). Nothing implemented.
Builds on: `2026-10-29-3d-model-rebuild-design.md` (the Meshy pipeline, gates, manifest and app-side extras, all kept).
Evidence: `E:\CLAUDE BU\reports\3D equipment sources scan.md` (Hotmart STAGE LAB pack, StageBuilder Pro thread, FreeCAD) and the notes in `E:\CLAUDE BU\research_notes\3D equipment sources scan\`.

## 1. Intent

Add our own builder that makes a model from numbers, so size and shape are right by construction and no AI credits are spent. The founder wants to "take what we need from the sources, get inspired, and create ours". It covers the whole catalog, starting with the assets where exact geometry matters most: connectors and plain boxy gear. Meshy stays available for the few assets that need an organic or photo-faithful look (for example the SM58 grille, the QL1 panel), decided per asset once its scripted version has been seen.

Founder decisions (2026-11-04): take the ideas from the three sources, create our own models, Meshy only for organic hero shapes. The target is everything in the catalog (25 devices and 26 connector types), not only the Shure and Yamaha pilot. Wave 1 is the proof slice (connectors and plain boxes). This revises the 2026-10-29 decision "Meshy for devices AND connectors" for the assets in section 4; the Meshy pipeline itself is untouched.

## 2. What we take from the sources

| Source | Taken | Not taken |
|---|---|---|
| Hotmart STAGE LAB (SketchUp pack, about 15 USD) | Nothing. It has no stage box, mic or XLR/TRS/RJ45 asset, shows no licence and is `.skp` only. | The models. Not bought; an email to the seller about commercial embedding is optional and not needed for this slice. |
| StageBuilder Pro (closed-source SaaS; its Terms forbid copying) | Ideas only: a real-world size stored per item, gear resting on surfaces (its changelog shows scale and floating-gear fixes were the first things engineers noticed), lazy per-model GLB loading, low polygon budgets. | Code and models. |
| FreeCAD (LGPL-2.1) and scripted-CAD alternatives | The idea of a parametric build from a spec. | FreeCAD itself: its glTF exporter has no tessellation control and headless export is unproven. CadQuery/build123d stay a later option. |
| Vendor CAD (Neutrik, Yamaha STEP) | Measurement only, if terms are ever confirmed. | The files. Terms were not readable; nothing is copied. |

Most of the "learn" items already exist in the Meshy pipeline (real-size spec per asset, pivot at bottom-centre, lazy loading, triangle budgets, numeric gates). The new work is the builder and its hook into the pipeline.

## 3. Approaches considered

- A. Python builder inside headless Blender. CHOSEN. Blender 5.2.3 LTS is installed at `D:\blender.exe` and the existing integration tests (fix-up, contact sheet) pass with it. One tool and one GLB path, direct control of triangle counts.
- B. CadQuery / build123d. Better parametric modelling, but a second toolchain and a mesh-to-GLB hand-off. Revisit only if Blender modelling proves clumsy.
- C. FreeCAD. Rejected for now (see section 2).

## 4. Design

### 4.1 Scope: the whole catalog, in waves

Inventory read from `content/catalog.json` on 2026-11-04 (read-only): 25 devices and 26 connector types, 51 assets. Each wave gets its own implementation plan; only wave 1 is planned in detail now, so the later plans can use what wave 1 teaches.

| Wave | Assets | Builder shape(s) | Track |
|---|---|---|---|
| 1 (proof) | `xlr3-f`, `trs-quarter`, `rj45`, `yamaha-rio3224-d2` | `cylinder-plug`, `trs-plug`, `rj45-plug`, `rack-box` | scripted, no credits |
| 2 (connector kit) | the other 22 connector types: `xlr3-m`, `xlr5-m/f`, `ts-quarter`, `trs-35mm`, `rca`, `ethercon`, `speakon-nl4`, `powercon-blue/true1`, `iec-c13/c14`, `schuko-plug/socket`, `bnc`, `tt-bantam`, `dsub25`, `toslink`, `usb-a/b/c`, `digilink`, `gpio-terminal` | the wave-1 shapes plus `rect-plug` and `schuko` | scripted |
| 3 (rack and desktop boxes) | `axia-iq`, `avid-hd-io`, `avid-protools-hdx`, `focusrite-isa-one`, `grace-m905`, `switchcraft-studiopatch-9625`, `antelope-ocx-hd`, `aeta-scoop5-s`, `aeta-scoopy-plus-s`, `playout-pc`, `multiprise-secteur` | `rack-box` (parameters for ears, knobs as empties) | scripted |
| 4 (shaped gear) | mics `shure-sm58`, `shure-sm57`, `ev-re20`, `ev-re50`, `neumann-u87-ai`; speakers `qsc-k12-2`, `yamaha-dbr12`, `genelec-8030c`; console `yamaha-ql1`; stand and arms `km-210-9`, `yellowtec-mika`, `yellowtec-litt`; loom `mogami-gold-db25-xlrm` | `revolve` (mics, from a silhouette profile), `speaker-box`, `assembly` (tubes, arms, loom), QL1 as `rack-box` | scripted first; Meshy only where a hero look is wanted and the scripted result is judged too plain |

Notes:
- The mics are surfaces of revolution, so a scripted `revolve` profile may give a better and exact result than an AI model. The decision to spend Meshy credits on any wave-4 asset is made per asset, after seeing the scripted version on a contact sheet.
- The bottleneck is not the builder but the specs: each device needs measured port and control positions (79 ports, 25 controls in the catalog). `asset:spec` creates skeletons with dimensions from `knowledge-base/equipment`; positions come from manuals and photos (confidence `manual` or `photo`), batched per wave.
- Meshy credits for wave 4 hero looks only: up to about 5 assets at 30 credits and 1-3 attempts, so about 150-450 credits, within the 3000 plan credits. Automation through the paid API is not needed at that volume (see section 7).

### 4.2 Data: optional `build` block in the asset spec

`specSchema.ts` (strict today) gains an optional field:

```
build: { shape: 'cylinder-plug' | 'trs-plug' | 'rj45-plug' | 'rack-box' | ..., params?: Record<string, number> }
```

The `shape` enum starts with the four wave-1 shapes and grows by one entry each time a later wave adds a shape (`rect-plug`, `schuko`, `revolve`, `speaker-box`, `assembly`); the Python registry and the zod enum are checked against each other by a test, so they cannot drift.

- Sizes always come from `realSizeMm`, never repeated in `params`; `params` holds only extra shape dimensions the datasheet gives (for example `frontMm` for the XLR front section, `earMm` for rack ears). A shape that needs a dimension that is missing fails with a message naming it.
- Specs without `build` behave exactly as today. `checkSpecParity` is unaffected.
- The four slice-1 specs get a `build` block, with the datasheet or drawing reference for each parameter in `sources[].note` (facts such as dimensions only; no vendor geometry is copied).

### 4.3 Builder: `tools/assets3d/blender/build_from_spec.py`

Runs as `blender --background --python build_from_spec.py -- --spec <file> --out <raw.glb>`, via a new `tools/assets3d/runBuilder.ts` that mirrors `runFixup.ts` (injectable exec, same error handling).

- A small registry maps each `shape` to a function that creates one mesh at exact size, in millimetres converted to metres, already in final orientation (mating or I/O face at +Z in file space, Y up, bottom-centre pivot for devices, mating-face-centre pivot for connectors).
- It builds geometry only: body, shell, panel inset, bevels where the real part has them. It does not place `port_*`/`ctrl_*` empties and does not apply per-port recesses; the existing fix-up still does that, so port logic is not duplicated.
- One material, no textures, so shipped files stay tiny and there are no logos to remove.
- Deterministic: no random operations, no timestamps in the output. Two runs produce byte-identical GLBs.
- Shapes for slice 1:
  - `cylinder-plug` (XLR3-F): 19.2 mm shell, 15.75 mm front section, three pin holes, length from `realSizeMm`. The latch lug stays out of the bounding box (spec note).
  - `trs-plug`: 6.35 mm tip/ring/sleeve plug with a sleeve and handle, from the spec size.
  - `rj45-plug`: body with latch, contact face with eight slots.
  - `rack-box`: width x height x depth box with chamfered edges. No panel inset and no ear flanges in wave 1: ports are placed on the bounding-box face, so an inset would leave them floating until the per-port surface gate exists (2026-10-29 spec 4.5); ears and inset come with that gate.

### 4.4 Pipeline hook

New flag: `npm run asset:build -- <id> --scripted`.

1. `runBuilder` writes `attempt-1.raw.glb` into the run's work dir.
2. From there the run is identical to a `--raw` run: fix-up (orientation check, exact size, empties, recesses, `tekpractice` extras), gates, textures step (a no-op without textures), Draco, re-gate of the final bytes, then ship only with `--ship`.
3. One attempt, no retry, no `--yes` (nothing is spent). Any gate failure is a defect of the builder or the spec and aborts with the failing gate named.
4. Manifest: `tool: 'scripted'`, `toolVersion` = builder version string, `taskId: null`, no photos. `logosRemoved` is recorded as true automatically because no photo texture is involved, so `--ship` does not require `--logos-removed` for `--scripted` runs.
5. `--scripted` conflicts with `--raw`, `--attempts`, `--yaw`, `--flip` (a scripted build is already oriented); the CLI refuses the combination with a clear message.

### 4.5 Gates

Unchanged: size, transform, parts, port positions, budget (connectors ≤ 800, standard/hero ≤ 4000 triangles), textures, glTF validator, proportion drift. A scripted asset also gets the contact sheet from `asset:sheet` for the visual review. The per-port surface ray-cast gate listed in the 2026-10-29 deviations remains future work.

### 4.6 App side

No change. Models carry the same `tekpractice` extras as Meshy models, so `DeviceSpawner` treats them identically.

## 5. Testing

- Unit tests (vitest, no Blender): schema accepts and rejects `build`, shape registry lists every shape, `runBuilder` builds the right command and surfaces errors, `buildAsset` with `--scripted` makes no Meshy call, skips retry, records `tool: 'scripted'`, refuses incompatible flags.
- Blender integration tests (skipped when Blender is missing, like the fix-up tests): each of the four builds passes every gate; two builds are byte-identical. The connector-fit check stays unwired (no socket specs are paired with plug specs yet, see 2026-10-29 section 4.5).
- Whole suite stays green. Before this work: 149 files, 2150 passed, 4 skipped (the Blender tests). With Blender installed those 4 now run, and the `tests/tools/assets3d` folder passes in full (413 tests, checked 2026-11-04); the whole suite has not been re-run since.

## 6. Success criteria

Wave 1:
1. `asset:build -- <id> --scripted` passes every gate for the four wave-1 assets with zero Meshy calls.
2. Contact sheets reviewed by Claude, and the founder approves the look of the four in the simulator.
3. Builds are deterministic.
4. The Meshy track is untouched and stays available for wave-4 hero looks.

Whole catalog (end of wave 4): every catalog device and connector type has a GLB with correct size, `port_*`/`ctrl_*` parts and `tekpractice` extras, passes every gate, and is recorded in the manifest; `validate:assets` reports no `pending` or `unmigrated` entries.

## 7. Risks and open items

- Rack ears and handle dimensions of the Rio3224-D2 are not in the sources read so far. If they cannot be measured from the Yamaha photos or manual, the slice ships a plain box and the ears become a follow-up.
- Fix-up picks the best of 24 rotations by size match. A symmetric builder output (for example a square cross-section) could tie; the builder emits final orientation, so the identity rotation must win ties. Verify in an integration test.
- Blender 5.2.3 differs from the 5.1 the pipeline was written against. The existing integration tests pass; the builder tests are the next check.
- A scripted connector is a generic standard shape (IEC 61076-2-103 style dimensions from the datasheet), not a copy of Neutrik trade dress. Dimensions are facts; no vendor geometry is used.
- Draco on tiny connectors can distort bounding boxes. The existing re-gate on the compressed bytes covers it.
- Credits and usage: the Meshy plan credits (3000) are web credits; the paid API may bill separately and its balance is unchecked (the key needs a Claude restart first). At the volume left for Meshy (about 5 assets) the web UI plus `--raw` is enough, so no API credits are bought unless the founder later chooses a Meshy-heavy rollout. Claude usage is kept down by executing plans inline in a fresh session, running only the test files touched while iterating, and one review per wave instead of per task.
- Spec work dominates the later waves: 79 ports and 25 controls need positions. Where only photos exist the confidence stays `photo` and the founder confirms the table, as in the pilot.
- The 4 open fixes from the final review (asset:sheet output location, ship-from-run path, material-count retry, yaw retries) stay open; none blocks scripted builds, but the first two should be fixed before merge.

## 8. Out of scope

Control geometry (controls remain named empties), Meshy-textured scripted boxes, CadQuery and FreeCAD, vendor CAD import, environment/room models, and any change to `catalog.json` content. Detailed plans for waves 2-4 are written after wave 1 (this spec covers their direction, not their tasks).

## 9. Next step

Invoke writing-plans for wave 1 only (builder, schema, `--scripted` flag, four assets).
