# TekPractice 3D model rebuild: design

Status: DRAFT for founder review (2026-10-29). Not committed. Nothing implemented.
Research notes: `E:\CLAUDE BU\research_notes\3d-models\` (A: AI image-to-3D, B: Claude/MCP tooling, C: sources and photogrammetry, D: parametric CAD and QA).

## 1. Intent

Every device and connector in the trainer should look like the real product, be at real size, and have every port and control where the real panel has it. The important parts (controls and ports) must be separate objects so the app can animate, highlight or swap them. Fidelity is tiered: hero gear (mics, QL1, Rio3224, speakers, patchbay) detailed and photo-faithful; connectors and plain rack boxes clean, accurate and correctly scaled. The project goes commercial later, so licence and provenance must stay clean.

Founder decisions (2026-10-29):
- Tiered fidelity.
- Product photos found by Claude, plus the manuals and technical sheets in the repo and `knowledge-base`.
- Approach B: AI image-to-3D (Meshy) for devices AND connectors, with scripted fix-up and gates. (Claude recommended a spec-driven parametric build, approach A; the founder chose B. Connectors were offered as a parametric exception and the founder declined it.)
- Controls and ports are separate named objects.
- Meshy plan bought by the founder; API key stored by the founder as the user environment variable `MESHY_API_KEY`.

## 2. Current state (verified in the repo)

- 25 catalog devices (79 ports, 25 controls) and 26 connector types in `content/catalog.json`; 50 GLB in `public/assets/`.
- `src/scene/DeviceSpawner.ts` `normalizeModel` rescales by height only from a hand-typed `REAL_SIZE_M` table (24 entries). Width and depth are never checked. A model that is rotated or authored in cm is scaled wrongly.
- Port markers come from `port_<portId>` empties in the GLB (`portEmpty`, `reanchorPorts`); without them the app uses a generic grid on the -Z face. Connector GLBs have no empties. Some devices have empties placed heuristically, not from the real panels.
- QL1, Rio3224 and RE50 are boxes or near-boxes; some models are old Sketchfab imports never reconciled; `multiprise-secteur` has no GLB (placeholder box).
- Machine: Windows 11, RTX 3060 Ti 8 GB, Blender 5.1 installed (not on PATH), no Python, Node 24, `@gltf-transform/*` present.
- `knowledge-base/equipment/*.json` holds real dimensions, connector lists and manual links for 357 devices; `knowledge-base/3d-models.json` holds 80 vetted candidates (kept as reference, not the chosen route).

## 3. Approaches considered

- A. Spec-driven parametric build (Blender headless from a mm spec; AI only for organic shapes). Claude's recommendation: ports and size correct by construction, no licence risk. Not chosen.
- B. AI image-to-3D for everything, with fix-up and gates. CHOSEN. Research warns no AI tool gets scale or port position right on its own and that tiny connectors are unreliable; the design compensates with hard gates and a pilot.
- C. Download and rig. Not chosen: no usable model for most rack gear, and several CC-BY uploads are re-uploads of manufacturer CAD (provenance risk).

## 4. Design

### 4.1 Pipeline per asset

Inputs (private folder `assets-source/<id>/`, gitignored):
- `photos/`: 1-4 manufacturer front, back and side images (Claude finds them; used as private reference and as generation input only).
- `spec.json`: real size in mm; the full control and port list with the exact catalog ids; panel coordinates (x, y from the panel's bottom-left, mm) read from the manual or datasheet; source notes (manual URL, page).

Stages:
1. Generate. Meshy multi-image to 3D (`meshy-7.1`, quad topology), from rectified photos. Device bodies are generated blank or flat-faced on the panel side where controls will be added. Download immediately (Meshy keeps results 3 days).
2. Fix-up (Blender 5.1 headless, `blender --background --python`): clean mesh (merge by distance, fill holes, recalc normals), orient the I/O face toward -Z (Note, R9/R15: "toward -Z" is Babylon world space after loading; in the GLB file itself the I/O face is at +Z.), rescale to the spec's real W x H x D, set the pivot at bottom-centre, remove baked logos and brand text from textures.
3. Parts: each port becomes an empty `port_<portId>` at its spec coordinates with the outward axis; the real socket is cut into the panel. Each control becomes its own object `ctrl_<controlId>` with its pivot on its rotation or slide axis. Names match `catalog.json` exactly.
4. Export: GLB at 1 unit = 1 m, Y-up, with `extras` on the root: `realSizeMm`, `ports[]`, `controls[]`. Draco compression, then re-verify.

### 4.2 Gates (run on every asset; a failure means regenerate, then flag)

- Size: world bounding box matches `realSizeMm` within max(0.5 mm, 0.5 %). If proportions are off by more than about 5 %, reject and regenerate.
- Orientation: pivot bottom-centre, no rotation, no negative scale, I/O toward -Z. (Note, R9/R15: "toward -Z" is Babylon world space after loading; in the GLB file itself the I/O face is at +Z.)
- Parts: exactly one `port_<id>` per catalog port and one `ctrl_<id>` per catalog control, no extras. Each port lies on the face plane (+-0.2 mm), inside the face rectangle, within 0.3 mm of its spec coordinates. No port left at the origin.
- Connector fit: a plug's outer size is 0 to 0.3 mm under its socket's opening; the plug origin sits at the mating plane.
- Budgets and format: polygon and texture limits (connectors 300-800 tris, devices 800-4000 tris unless the founder approves more for hero gear), one material per object, glTF validator reports 0 errors.
- After compression: re-measure the shipped file; parts around 6 mm skip heavy quantization (Draco can distort tiny bounding boxes).
- Visual: orthographic front, back and side renders on a contact sheet next to the reference photo; Claude reviews. Numeric gates decide pass or fail; the visual review is a sanity layer only.
- Rebuild determinism: the fix-up and gate stages give identical output for identical input.

### 4.3 App-side change (minimal, backward compatible)

`DeviceSpawner` reads `extras` from the GLB (real size, port anchors, control pivots) when present and uses scale 1. When `extras` is absent it keeps today's behaviour (`REAL_SIZE_M`, height-only scaling, grid fallback), so migration is per model and nothing breaks mid-rollout. This is the only engine change and needs its own review. The `catalog.json` working-tree changes already present in the repo belong to other work and are not touched.

### 4.4 Pilot, rollout, manifest

Pilot (6 models, roughly 200-400 credits): devices `shure-sm58`, `yamaha-ql1`, `yamaha-rio3224-d2`; connectors `xlr3-f`, `trs-quarter`, `rj45`. Success: at least 5 of 6 pass all numeric gates within 3 attempts and the founder approves the look in the app. Go or no-go after the pilot. Fallbacks if connectors fail: build only those parametric from standards, or try Tripo.

Rollout order after a go: (1) connector kit, reused on every device; (2) hero devices: mics, QL1, Rio, speakers, patchbay; (3) remaining rack gear. One commit per model.

`public/assets/ASSET_MANIFEST.json` gains per asset: tool and version, date, source photos (reference only), spec source, genericized-logo flag, gate results.

### 4.5 Deliberate deviations (2026-10-29)

Recorded after the whole-branch review; each is a conscious choice for the pilot, not an oversight.

- Controls are named empties (`ctrl_<id>`) with the real pivot and axis and no geometry in the pilot. The control's geometry can be parented under its empty later without changing names or pivots.
- `checkConnectorFit` exists and is tested, but it is not wired into a build: there are no socket specs to pair the plug specs with yet. It runs once socket specs exist.
- Fix-up determinism ("Rebuild determinism" above) needs Blender, which is not installed on the build PC: fixup.py and render_views.py are written blind and are untested. Node-side determinism (texture step, Draco, gates, report) is tested.
- The numeric gates validate our own construction against the measured bounding box: a port empty floating in front of a recessed panel, or a model whose real panel is set back from its bbox face, still passes. A per-port surface ray-cast gate in fixup.py is needed before the rollout.
- Polygon budgets are ceilings only (R5: connectors <= 800, devices <= 4000 triangles), no floor. Meshy is asked for triangle topology (not quad as stage 1 says) with a target of max(100, 0.7 x ceiling - 100 per socket recess), because a GLB is triangulated and a quad target doubles.
- Retries buy a new Meshy task only for failures of the model itself (proportion drift, budget); a failure of a gate that checks our own fix-up or compression aborts (stage table above says "regenerate" for every gate).
- `asset:build` ships nothing by default; shipping needs `--ship --logos-removed` (the founder asserts the textures are logo-free) and any Meshy spending needs `--yes`.

## 5. Risks and open items

- Credits: Meshy API usage is prepaid and may be billed separately from the plan's monthly credits (the docs do not say). Check the balance on the Developer Platform before the pilot. Full run estimate 1,500-3,000 credits. Free retries may apply only on the web.
- AI shapes drift in proportions and fine sockets; the gates will reject many attempts. Expect manual fix-up on some hero devices.
- Control and port positions need panel drawings. Where a manual has none, positions come from photos and are marked lower-confidence in the spec.
- Trade dress: a faithful lookalike of a branded product still needs a legal check before commercial launch (carried from the earlier sourcing doc). Logos and brand text are removed from shipped textures.
- Source photos are manufacturer images: private reference only, never committed, never shipped.
- Catalog has only 25 controls today, so `ctrl_` parts cover those; more physical controls need catalog additions (out of scope here).
- `multiprise-secteur` currently has no GLB and is included in the rollout.
- Meshy's multi-image request fields and API rate limits were not documented on the pages checked; confirm when the key is available.
- Authority: all Meshy calls use `Authorization: Bearer $MESHY_API_KEY`; the key never enters the repo, logs or chat.

## 6. Out of scope

Animation rigs, the 357-device knowledge-base devices beyond the 25 in the catalog, environment/room GLBs, and any change to `catalog.json` content.

## 7. Next step

On founder approval of this spec: invoke writing-plans to produce the implementation plan (pilot first).
