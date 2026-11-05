# TekPractice scripted model builder: design

Status: DRAFT for founder review (2026-11-04). Design approved in chat by the founder on 2026-11-04. Scope widened the same day, on the founder's instruction, from four assets to the whole catalog, delivered in waves (section 4.1). Wave 1 implemented the same day (not shipped: the four models wait for the founder's look review).
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
| 1 (proof) | `xlr3-f`, `trs-quarter`, `rj45`, `yamaha-rio3224-d2` | `cylinder-plug`, `trs-plug`, `rj45-plug`, `stagebox-rio3224` (`rack-box` stays for wave 3) | scripted, no credits |
| 2 (connector kit) | the other 22 connector types: `xlr3-m`, `xlr5-m/f`, `ts-quarter`, `trs-35mm`, `rca`, `ethercon`, `speakon-nl4`, `powercon-blue/true1`, `iec-c13/c14`, `schuko-plug/socket`, `bnc`, `tt-bantam`, `dsub25`, `toslink`, `usb-a/b/c`, `digilink`, `gpio-terminal` | the wave-1 shapes plus `rect-plug` and `schuko` | scripted |
| 3 (rack and desktop boxes) | `axia-iq`, `avid-hd-io`, `avid-protools-hdx`, `focusrite-isa-one`, `grace-m905`, `switchcraft-studiopatch-9625`, `antelope-ocx-hd`, `aeta-scoop5-s`, `aeta-scoopy-plus-s`, `playout-pc`, `multiprise-secteur` | `rack-box` (parameters for ears, knobs as empties) | scripted |
| 4 (shaped gear) | mics `shure-sm58`, `shure-sm57`, `ev-re20`, `ev-re50`, `neumann-u87-ai`; speakers `qsc-k12-2`, `yamaha-dbr12`, `genelec-8030c`; console `yamaha-ql1`; stand and arms `km-210-9`, `yellowtec-mika`, `yellowtec-litt`; loom `mogami-gold-db25-xlrm` | `revolve` (mics, from a silhouette profile), `speaker-box`, `assembly` (tubes, arms, loom), QL1 as `rack-box` | scripted first; Meshy only where a hero look is wanted and the scripted result is judged too plain |

**Delivery order (revised 2026-11-04, after the wave-1 review): 1, then 3 and 4, then 2.** The sim does not load connector GLBs: `xlr3-f`, `trs-quarter` and `rj45` appear in the app only as French labels in `src/creation/copy.ts`, while devices load `public/assets/<deviceId>.glb` (inventory drawer, DeviceSpawner). Until a cable-plug renderer exists, a connector model is never seen by the user, so the visible devices of waves 3 and 4 come before the connector kit of wave 2. The wave numbers stay as they are (other notes refer to them); only the order changes. Wave 2 moves up again if a plug renderer is added.

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

Runs as `blender --background --factory-startup --python-exit-code 1 --python build_from_spec.py -- --plan <plan.json> --out <raw.glb>` (plan.json: id, kind, shape, sizeMm, matingOuterMm, params; written by Node from the spec), via a new `tools/assets3d/runBuilder.ts` that mirrors `runFixup.ts` (injectable exec, same error handling).

- A small registry maps each `shape` to a function that creates one mesh at exact size, in millimetres converted to metres, already in final orientation (mating or I/O face at +Z in file space, Y up, bottom-centre pivot for devices, mating-face-centre pivot for connectors).
- It builds geometry only: body, shell, panel plates, bevels where the real part has them. It does not place `port_*`/`ctrl_*` empties; the existing fix-up does that, so port logic is not duplicated. Scripted models build their own sockets, so the fix-up's per-port recess cut (made for the solid panels of Meshy models) is skipped for them (`recess: false`, section 4.3b).
- One material, no textures, so shipped files stay tiny and there are no logos to remove.
- Deterministic: no random operations, no timestamps in the output. Two runs produce byte-identical raw GLBs (tested on one machine; the fix-up and Draco output are not compared).
- Shapes for slice 1 (redesigned on 2026-11-04 from the reference research, report "Wave 1 model reference geometry"; the first versions were plain cylinders and boxes and were rejected by the founder as not clean or well shaped):
  - `cylinder-plug` (XLR3-F): revolved profile of 13 points at 20 segments: dark front insert (15.75 mm), cone, 19.2 mm nickel shell, black bushing with one groove (about 20.3 mm, the widest round part), tapering boot; nickel latch lug on +Y; the real pin layout (pin holes at (-4.05, 0), (4.05, 0), (0, -3.95), key slot at 12 o'clock). Founder decision 2026-11-04: the box includes the bushing and the lug, so `realSizeMm` is 20.3 x 21.0 x 72.5 and the axis sits 0.35 mm below the box centre. 640 triangles.
  - `trs-plug`: 23-point lathe at 16 segments: pointed arrowhead tip, neck with a bead, two thin black insulator bands (about 9.6 and 16.7 mm from the tip, read from the CC0 Commons photo), nickel barrel with `barrelMm` 30.5 (real plugs have 30 to 31 mm of barrel; the first version used 19), conical nose, nickel shell, black tapering boot. 732 triangles.
  - `rj45-plug`: bare 8P8C plug: 6.6 mm high insertion part, 8 mm cable end (the first version had this step upside down), hinged latch tab between two guard shoulders, eight gold contact slots in the front face and gold blades underneath, dark cable hole. 384 triangles.
  - `stagebox-rio3224`: the Rio3224-D2 (5U, not 4 RU): chassis, slate front panel flush with two 27 mm black ears (the 480 mm includes them) with side flanges and rack-hole slots, three raised plates, 52 round connector bezels 11.5 mm proud of the panel (their tips are the bounding-box face, so the port nodes lie on it), display strip, knob, buttons, rocker; flat back with two chrome-ringed fans, two power inlets, two etherCON ports 6 mm proud. No handles (the datasheet shows none). 3704 triangles. Layout lives in the builder, only datasheet sizes are params (`earMm`, `flangeDepthMm`, `frontStepMm`, `rearStepMm`).
  - `revolve` (added 2026-11-04 night, first user: the microphones): a surface of revolution about the vertical axis from `build.profile`, at least four `[y mm from the base, diameter mm]` stations with strictly increasing y; first station at 0 (the base), last at `realSizeMm.h`, widest = `realSizeMm.w` = `realSizeMm.d` (a round footprint, validated). A diameter of 0 is a pole, a first or last station with a diameter is closed by a flat cap. `build.colours` (`[{fromMm, colour}]`, real-part sRGB, first at 0) colours zones along the axis; the builder lifts them x3 for the creation lighting. `params.segments` (12 to 64, multiple of 4, default 32). The profile is MEASURED, never invented: the spec's `sources` say how (alpha silhouette of a side-on photo scaled by the known length, or the path data of a vector dimension drawing), and the widest station is rescaled to the published diameter. The SM58's profile was checked by overlaying the model's silhouette on the photo (mean width difference 0.6 mm).
  - `rack-box`: width x height x depth box (bottom-centre pivot) with all twelve edges chamfered by `chamferMm` (default 1 mm, one segment), flat faces. Kept for the other wave-3 boxes; no longer used by the Rio.

### 4.3b Look rules (verified in Blender 5.2 and Babylon 7 with the creation scene's lights)

- Smooth shading with sharp edges above 40 degrees (`Mesh.shade_smooth` then `set_sharp_from_angle`); vertex colours (COLOR_0, one per face corner) through the single material (metallic 0.25, roughness 0.45, backface culling), so one material still holds. The fix-up keeps exactly one colour attribute and makes it the active one (otherwise the exporter writes a fake white COLOR_0). Tests assert COLOR_0 (VEC3, two or more colours) and shared vertices after the fix-up and after Draco.
- Scripted builds skip the fix-up's socket recess cut (`recess: false`): the builder models its own sockets and the cut would shorten four Rio bezels by 2 mm. `openingMm` stays in the extras.
- The creation scene lights vertical faces with about a quarter of fill + key (hemispheric 0.5 from above, key 0.5): a colour that is right on the real part renders near black. The Rio palette is therefore lifted (about x3.5 in linear terms); plug colours stay close to the real parts. Judge new shapes in Babylon with those lights, not only in Blender.
- The contact sheet renders vertex colours (Workbench VERTEX mode) when the model has them.

### 4.4 Pipeline hook

New flag: `npm run asset:build -- <id> --scripted`.

1. `runBuilder` writes `attempt-1.raw.glb` into the run's work dir.
2. From there the run is identical to a `--raw` run: fix-up (orientation check, exact size, empties, recesses, `tekpractice` extras), gates, textures step (a no-op without textures), Draco, re-gate of the final bytes, then ship only with `--ship`.
3. One attempt, no retry, no `--yes` (nothing is spent). Any gate failure is a defect of the builder or the spec and aborts with the failing gate named.
4. Manifest: `tool: 'scripted'`, `toolVersion` = builder version string, `taskId: null`, no photos. `logosRemoved` is recorded as true automatically because no photo texture is involved, so `--ship` does not require `--logos-removed` for `--scripted` runs.
5. `--scripted` conflicts with `--raw`, `--attempts`, `--yaw`, `--flip` (a scripted build is already oriented); the CLI refuses the combination with a clear message.

### 4.5 Gates

Unchanged: size, transform, parts, port positions, budget (connectors ≤ 800, standard/hero ≤ 4000 triangles), textures, glTF validator, proportion drift. A scripted asset also gets the contact sheet from `asset:sheet` for the visual review. The per-port surface ray-cast gate listed in the 2026-10-29 deviations exists since 2026-11-04 (`portSurface`, section 4.5b).

### 4.5b Per-port surface gate (added 2026-11-04)

fixup.py casts a ray per port, from 10 mm outside the port inward (BVH tree of the final mesh), and writes `portSurface` into report.json: how far the real surface lies behind the port (0 = on it, positive = behind, negative = port sunk, null = the ray missed). `checkPortSurface` (gates.ts) fails a port more than 0.5 mm off the surface; a port with an opening may sit 2 mm in front when the fix-up cut the socket recess. It is a Meshy-model property, so a failure is retryable like proportion drift. All six Rio ports pass (they lie on the bezel tips and rear housings); a synthetic test with a panel recessed 10 mm fails a port in front of it. Because the gate exists, a later Rio version may recess its panel and let the ports float behind the bbox face.

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

- Rio3224-D2 (done after the reference research): built as a 5U stage box with ears, flanges, plates and 52 bezels whose tips are the bounding-box faces, so the ports lie on them without a recessed panel. A recessed panel with ports floating behind the bbox face needs the per-port surface gate, which now exists (4.5b), plus a decision on how ports then relate to the face-plane gate. The datasheet drawings show no handle.
- The sim does not render connector models (see the delivery order in 4.1): the wave-1 connectors are built and gated but only visible in the contact sheets until a cable-plug renderer exists.
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

## 8. Night of 2026-11-04 (evening): Meshy tried, and the hybrid that came out of it

The founder said the scripted models lacked visible detail and precision and asked for Meshy to be tried and compared with perfect sources. An expert council (3 personas + a neutral solver) preceded the work; its recommendation was a bounded trial, not a commitment. What was measured (Meshy API, `meshy-7.1`, 30 credits per task, balance 3100 before; 22 tasks, 3 of them wasted on poor inputs):

| Class | Meshy alone | Our scripted shape alone | Verdict |
|---|---|---|---|
| Microphones (SM58, SM57, RE20, RE50, U87 Ai) | Right silhouette, real grille mesh, finish, rings (drift 1 to 4 %); text and logos garbled but present; metallic factor 1 reads black in our lights | Exact profile, smooth grey lathe, no texture | Meshy direct, after the look step and logo repaint |
| Speakers (K12.2, DBR12, 8030C) | Recognisable cabinets, drivers, feet, rear amp plates with the real connector layout; depth guessed (drift 4 to 22 %); the rear panel is recessed 5 to 37 mm | No shape yet (speaker-box not built) | Meshy direct with `insetMm` and `driftLimit` per spec |
| Rack units seen from the front (Rio3224-D2) | A flat slab, depth lost (drift 92 %), rear missing | Exact box, exact port positions | Hybrid: our shape, Meshy's rectified front picture |
| Consoles (QL1) | Excellent top (faders, scribble strips, screen, knobs), messy sides and rear | Needs the wedge profile | Hybrid: measured wedge, Meshy top, official rear photo |
| Flat connector panels with a straight-on photo | Not needed | Exact | Hybrid with the photo itself as the picture |

Conclusion: Meshy owns APPEARANCE, our builder owns GEOMETRY. The pipeline now has four routes, chosen per device class:
1. `asset:build -- <id> --scripted` (connectors, plain boxes, lathe parts), no Meshy.
2. `asset:build -- <id> --raw <meshy.glb> --meshy-task <id> [--yaw n] [--flip] [--slab]`: a Meshy GLB (downloaded by `assets-source/_scratch/meshy-trial.mts`, a scratch tool) fixed up to the spec: mics, speakers.
3. `asset:build -- <id> --scripted --project <fixed meshy glb>`: our exact shape wearing a face picture rendered orthographically from the fixed Meshy model (`tools/assets3d/projection.ts`): Rio, QL1 top.
4. `asset:build -- <id> --scripted --project-photo face=file[@l,t,w,h]`: the picture is a straight-on official photo (`photoProjection.ts`): QL1 rear, Avid HD I/O, Antelope OCX HD.
Routes 3 and 4 may be mixed face by face (`build.projection` is a face or a list); the builder puts every picture and a palette strip for the remaining faces into ONE atlas (one material, one texture).

New pieces (all tested, TDD):
- `meshy.ts`: optional `geometryResolution`, `shouldRemesh`, `imageEnhancement`, `textureResolution` (sent only when asked).
- Gates: hero triangle ceiling 15000 (was 4000; the Meshy target follows: 10500), data maps (normal, metallic-roughness) at half the colour limit, a per-spec `driftLimit` (at most 0.35), a per-port `insetMm` (a jack inside a recessed panel: the port node sits behind the face plane and the portPositions gate follows).
- `look.ts`: caps the metallic factor at 0.15 and lifts the colour map (linear x 3 + 0.012, capped 0.85, never darker): a Meshy PBR set is black in Mode Création's IBL-less lights otherwise.
- `blank.ts`: repaints logos and brand text per TEXEL (interpolated 3D position), by height band or by rectangle in the spec's face-local millimetres (`texture.blankBandsMm`, `texture.blankRects`). A Meshy atlas is shattered, so image-space patching is impossible; a logo printed on one big flat triangle is removed exactly. A region that covers no texel is an error.
- `slab.ts` and `--slab`: a thin Meshy panel gets its thin axis turned into the depth before the fix-up (otherwise the proportion matcher lays it flat).
- `console-wedge` shape: a side profile `[depth from the io face, height]` extruded across the width (QL1: 17 measured stations, chamfer 1.5 mm).
- Manifest: `tool: 'hybrid'`, `toolVersion: blender-builder-1+meshy-7.1`, the task id and the reference photos are recorded; `--meshy-task` records provenance of a hand-downloaded Meshy GLB.

Logos: every texture here derives from manufacturer photos. The repaint removes the brand marks it was asked to; the manifest's `logosRemoved` was set after viewing each result, but the founder asserts it for the commercial track (CLAUDE.md: generic visual equivalents only). Model names such as the "RIO3224-D2" print and the "HD I/O" mark were left (nominative); see the night log.

Not done and why: the OCX HD, Scoop5 and QL1-class rear faces that only have perspective renders were not projected (the aspect check refuses them); the Focusrite ISA One, Grace m905, StudioPatch and Axia iQ have no straight-on photos; the K&M stand, m!ka arm, litt lamp and Mogami loom need an `assembly` shape (see section 7).
