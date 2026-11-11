# Build All Equipment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote or model every row of the 315-row equipment plan (134 Bêta devices + 181 researched additions) so TekPractice offers full equipment in all categories, with real-size scripted 3D models, correct behaviour per category, and nothing pushed.

**Architecture:** One machine-readable plan table (`content/proposals/equipment-plan.json`) drives a promotion tool that writes catalogue entries (promoted outcome) or proposal updates (beta-modelled outcome) plus asset-spec skeletons; devices are then built through the existing per-device build loop on existing or new Blender shape families, in five waves, with batched pinned-test changes and an independent review per wave.

**Tech Stack:** TypeScript (tsx, vitest, zod), Babylon.js 7 / Vite, Blender 5 builder (`tools/assets3d/blender/build_from_spec.py`, `D:\Blender\blender.exe` via `BLENDER_EXE`), Playwright (`E2E_PORT=4181`, private preview on a scratch outDir, run from PowerShell).

**Spec:** `docs/superpowers/specs/2026-11-11-build-all-equipment-design.md` (read it and `docs/superpowers/plans/2026-11-10-finish-all-models.md`; the Device Build Loop here reuses that plan's gates). Research inputs: `E:\CLAUDE BU\reports\TekPractice Beta equipment gap analysis.md`, its `... - priority table.csv`, notes in `E:\CLAUDE BU\research_notes\TekPractice Beta equipment gap analysis\`.

## Global Constraints

- Never push, deploy, spend Meshy credits, rewrite history, or touch another checkout. Founder-away autonomous run.
- Commit with explicit paths only (`git add <paths>`); never `git add -A` or `.`. Git needs `git -c safe.directory='*'`. Never stage logo SVGs. Public repo: no keys, no manufacturer photos, no contact sheets (the folder `docs/superpowers/notes/img/` is git-ignored).
- Commit messages end with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Generic panel artwork only (no manufacturer photo, no logo) for every new device. Size numbers come from the plan's sources; never invent a number: missing data means the device is blocked, not guessed. Estimates are marked `confidence: guess` / `dataQuality: estimate`.
- Two outcomes: **promoted** (datasheet or dealer size AND documented connector set; goes into `content/catalog.json`) or **beta-modelled** (stays in the proposals file with a model; badge « Bêta — dimensions estimées »; patch-only). A device with `dataQuality: missing` gets neither.
- Port ids at most 19 characters (the catalogue maximum). Every mains inlet gets a `power` toggle control. Existing 25 devices and the old shapes stay byte-identical (sha256 pins).
- Triangle classes: rack gear 1500-3500, desks up to 6000, speakers up to 4000, mics up to 6000, small gear up to 2000, headphones up to 4000. Per-device GLB average at most 250 KB, total `public/assets` GLBs at most 120 MB, any file under 25 MiB; generic-panel textures at most 1024 px.
- Env for builds and tests: `BLENDER_EXE=D:\Blender\blender.exe`. Playwright only with `E2E_PORT=4181` on a private preview built into a NEW scratch outDir (never port 4173; dist-* folders can be ACL-locked). Builds from PowerShell.
- Audio engine, rule semantics and the saved-project format change only through the additive schema fields of Task 0.3 (with migration and tests). Asset copy is French, answers and logs English.
- Builds are deterministic (byte-identical twice); new shapes ship with a determinism test.
- Stop rules: three failed attempts on a device (gates or contact-sheet review) keep its previous state and put it in the report; a wave with more than half its rows blocked on data is reported and the run moves on with the ready rows; each wave ends with the full suites and an independent read-only review.

## Review Focus

1. **`sync:kb` resurrects or overwrites promoted ids**: running `npm run sync:kb` after a promotion must not re-add the id to the proposals file nor change the catalogue entry (Task 0.2).
2. **Id and port-id collisions**: a new row whose id exists in the catalogue or the proposals, a port id over 19 characters, duplicate port ids inside a device, a promoted id still left in the proposals file (Tasks 0.1, 0.4).
3. **Estimate shown as verified**: a device with `dataQuality` `estimate` or `missing` promoted into the catalogue, a 0 x 0 x 0 mm size reaching a spec, a beta-modelled device losing its badge (Tasks 0.4, 0.6).
4. **Category without a tab or pinned count drift**: a promoted device whose category has no `CATEGORY_TAB` line falls into « Autres »; literal pins (25 devices, 16 categories) break on the first promotion (Task 0.5).
5. **Runtime model failures**: manifest row without file or file without row, a spec whose ports differ from the catalogue ports (placement and marker mismatch), a GLB over the size budget, saved projects that reference an id whose device changed state (Tasks 0.5, DBL step 6).

## File Structure

- `content/proposals/equipment-plan.json` (new): the plan table, source of truth for ids, sizes, sources, tiers, waves, families.
- `tools/equipmentPlan.ts` (new): zod schema, `loadPlan()`, `planRows(filter)`; `tools/import-equipment-plan.ts` (new, one-off CSV to JSON).
- `tools/behaviourTemplates.ts` (new): per-category port/control/routing templates; `tools/promoteDevice.ts` + `tools/promote-device.ts` (new): the promotion logic and CLI (`npm run promote -- <id>`).
- `tools/propose-content.ts` (modify): skip promoted and planned ids.
- `content/catalog.json`, `content/catalog.schema.json`, `tools/schemas.ts`, `tools/generate-schema.ts`, `tools/validate-catalog.ts` (modify): schema fields, connectors, signals, devices.
- `src/scene/portMarkerSize.ts` (modify): connector marker sizes for new connectors.
- `src/creation/inventory.ts`, `src/creation/betaDevices.ts`, `src/scene/DeviceSpawner.ts` (modify): tabs, badge, placeholder size.
- `tools/assets3d/shapes.ts`, `tools/assets3d/blender/build_from_spec.py` (modify): new families; `content/asset-specs/<id>.json`, `content/generic-panels/<id>.json`, `public/assets/<id>.glb`, `public/assets/ASSET_MANIFEST.json` (new per device).
- `tools/brandsRegister.ts` (new): generates `docs/legal/BRANDS_AND_CREDITS.md` device rows from the manifest.
- `docs/superpowers/notes/2026-11-11-equipment-log.md` (new): the log each wave agent appends to (counts: promoted / beta-modelled / blocked, gates, open items).
- Tests: `tests/tools/equipmentPlan.test.ts`, `promoteDevice.test.ts`, `behaviourTemplates.test.ts`, `proposeContentGuard.test.ts`, `brandsRegister.test.ts`; `tests/creation/inventory.test.ts`, `betaDevices.test.ts` (modify); `tests/scene/modelIds.test.ts` (modify); Blender shape tests next to the existing ones in `tests/tools/assets3d/`.

## Device Build Loop (DBL, used by every device task)

For each device row of the task's batch (rows come from `planRows({ wave, family })`, never hand-listed):
1. If `dataQuality` is `missing`: append to the log's "blocked" list and skip.
2. `npm run promote -- <id> --dry-run`, then `npm run promote -- <id>`: writes the catalogue entry (promoted) or proposal update (beta-modelled), short port ids, power toggle, behaviour template, spec skeleton (via `asset:spec`).
3. Fill `content/asset-specs/<id>.json`: size, ports with positions and confidence (datasheet or `guess`), `build` params with `budget` and `minFilletMm`, sources, notes marking estimates. Draw `content/generic-panels/<id>.json` and run `npm run asset:panel -- <id>`.
4. `npm run asset:build -- <id> --scripted` (dry run first), then look at the contact sheet (`npm run asset:sheet -- <id>`; front, rear, 3/4, side): compare proportions with the datasheet numbers, fix or record. The sheets stay local.
5. Ship through the gates (size, transform, parts, portPositions, portSurface, budget, proportionDrift, textures, validator, detail, fillet): `npm run asset:build -- <id> --scripted --ship`; `npm run validate:assets` must stay all ok.
6. Run `npx vitest run tests/scene/modelIds.test.ts tests/tools tests/creation` (with `BLENDER_EXE` set), then commit explicit paths: spec, panel, GLB, manifest row, catalogue or proposal change, tests.
Batch up to 10 devices of one family per commit series; the catalogue edit and the pinned-test edit happen once per batch.

## Wave 0: Foundations

### Task 0.1: Plan table and loader

**Files:** Create `tools/equipmentPlan.ts`, `tools/import-equipment-plan.ts`, `content/proposals/equipment-plan.json`; Test `tests/tools/equipmentPlan.test.ts`.

**Interfaces:**
- Produces: `type PlanRow = { id: string; status: 'beta'|'new'; category: string; manufacturer: string; product: string; sizeMm: {w?: number; d?: number; h?: number}; weightKg?: number; portsSummary: string; family: string; dataQuality: 'datasheet'|'dealer'|'estimate'|'missing'; tier: 1|2|3; wave: 1|2|3|4|5; sources: string[]; notes: string }`; `loadPlan(): PlanRow[]` (zod-validated, throws on duplicate ids); `planRows(filter: {wave?: number; family?: string; tier?: number; status?: string}): PlanRow[]`.

- [ ] **Step 1: Write failing tests** in `equipmentPlan.test.ts`: `loads 315 rows with unique ids`; `every beta row id exists in catalog-proposals.json`; `no row id exists in catalog.json`; `rows with dataQuality datasheet or dealer have all three sizes positive`; `planRows({wave: 1}).length` equals 49; `rows with family not in the known family list are rejected`.
- [ ] **Step 2: Run** `npx vitest run tests/tools/equipmentPlan.test.ts`; expected FAIL (module missing).
- [ ] **Step 3: Implement** the schema and loader in `tools/equipmentPlan.ts`; implement `tools/import-equipment-plan.ts <csv>` converting `E:\CLAUDE BU\reports\TekPractice Beta equipment gap analysis - priority table.csv` (columns id, status, category, manufacturer, product, width_mm, depth_mm, height_mm, weight_kg, ports_summary, shape_family, data_quality, priority_tier, wave, notes; source URLs are taken from the notes column and the research note files, blank when absent) into `content/proposals/equipment-plan.json`; run it once and commit the JSON. Known families: rack-box-v2, console-wedge-v2, revolve, curved-cabinet, tripod-stand, power-strip, cable-assembly, generic-panel, plus the new ones named in Tasks 2.1 to 4.1 (`rack-box-v3b`, `moulded-box`, `revolve-v2-oval`, `round-base-stand`, `speaker-cabinet-v2`, `cable-assembly-v2`, `rack-box-v3-slope`, `assembly`).
- [ ] **Step 4: Run** the test file; expected PASS.
- [ ] **Step 5: Commit** the four paths.

### Task 0.2: `sync:kb` guard

**Files:** Modify `tools/propose-content.ts`; Test `tests/tools/proposeContentGuard.test.ts`.

**Interfaces:** Consumes `loadPlan()`. Produces: `propose-content` skips every id that exists in `content/catalog.json` or whose plan row has been promoted (a `promoted: true` marker on the plan row, set by Task 0.4), and keeps beta-modelled ids in the proposals file with their size and badge fields untouched.

- [ ] **Step 1: Failing tests**: `skips ids present in the catalogue`; `does not overwrite a beta-modelled proposal's sizeMm`; `running twice yields identical output (idempotent)`.
- [ ] **Step 2: Run** `npx vitest run tests/tools/proposeContentGuard.test.ts`; expect FAIL.
- [ ] **Step 3: Implement** the guard in `propose-content.ts` as a pure `mergeProposals(generated, existing, planRows, catalogIds)` function exported for tests.
- [ ] **Step 4: Run** the test and `npx vitest run tests/tools`; expect PASS.
- [ ] **Step 5: Commit.**

### Task 0.3: Schema fields and connectors

**Files:** Modify `tools/schemas.ts`, `tools/generate-schema.ts` (regenerates `content/catalog.schema.json`), `content/catalog.json` (connectorTypes, signalTypes), `src/scene/portMarkerSize.ts` (marker sizes), `tools/validate-catalog.ts`; Test `tests/tools/schemas.test.ts`, `tests/scene/portMarkerSize.test.ts`.

**Interfaces:** Produces port flags `isRibbon`, `isUnbalanced`, `isInsert`, `isSendReturn`, `isMixMinus`, `isTally`; device optional fields `loadOhms?: number`, `minLoadOhms?: number`, `impedanceOhms?: number`; connector ids `dc-barrel`, `midi-din5`, `xlr4`, `bnc-antenna-50ohm`, `mini-xlr-ta4`, `euroblock`, `speakon-nl8`, `binding-post`, `opticalcon`, `sc-fibre`, `lemo`, `hirose` with `matesWith` and cable style; marker sizes in `CONNECTOR_MM` for each (face size from the manufacturer or a documented estimate, ring = 1.2 x face). The `aoip` split into dante / aes67 / avb / aes50 is attempted only behind a spike: if rules R5 to R8 stay green with the split it ships, otherwise it is recorded as open in the log.

- [ ] **Step 1: Failing tests**: `each new connector has matesWith both ways`; `portMarkerSize has an entry for every connector id in the catalogue` (pins no connector is left at the 20 mm fallback unintentionally); `schema accepts the new flags and rejects an unknown flag`; `existing 25 devices still validate unchanged`.
- [ ] **Step 2: Run** the three files; expect FAIL.
- [ ] **Step 3: Implement** schema and data additions; run `npm run generate:schema` (see package.json for the exact script name) so the JSON schema matches; update `validate-catalog.ts` rules (port id length at most 19, unique port ids per device).
- [ ] **Step 4: Run** `npx vitest run tests/tools tests/scene/portMarkerSize.test.ts` and `npm run validate:catalog`; expect PASS.
- [ ] **Step 5: Commit** explicit paths.

### Task 0.4: Behaviour templates and the promotion tool

**Files:** Create `tools/behaviourTemplates.ts`, `tools/promoteDevice.ts`, `tools/promote-device.ts` (add `"promote": "tsx tools/promote-device.ts"` to `package.json`); Test `tests/tools/behaviourTemplates.test.ts`, `tests/tools/promoteDevice.test.ts`.

**Interfaces:**
- `applyTemplate(category: string, row: PlanRow, ports: PlanPort[]): { ports: CatalogPort[]; controls: CatalogControl[]; routing?: Routing[]; acoustic?: Acoustic }` following the spec's section 4.3 table.
- `promoteDevice(id: string, opts: { dryRun?: boolean }): PromotionResult` returning `{ outcome: 'promoted'|'beta-modelled'|'blocked'; changes: string[] }`; writes the catalogue entry or proposal update and runs the spec skeleton; sets `promoted: true` on the plan row.

- [ ] **Step 1: Failing tests**: `microphone template: one mic-level out, no power control`; `every mains port gets a power toggle`; `active speaker routes in to transducer and carries nominal acoustic with a source`; `short port ids are at most 19 chars and unique`; `blocked row writes nothing`; `estimate row becomes beta-modelled, not promoted`; `promoting twice is a no-op`; `promoted id is removed from the proposals file`; `dry-run changes no file`. Use three fixture rows from different categories (a mic, a rack stage box, an active monitor).
- [ ] **Step 2: Run** both files; expect FAIL.
- [ ] **Step 3: Implement** the templates and the tool; reuse `spec-skeleton.ts`; port id shortening is deterministic (lowercase, hyphen, role-number).
- [ ] **Step 4: Run** the files plus `npm run validate:catalog`; expect PASS.
- [ ] **Step 5: Commit.**

### Task 0.5: Tabs, derived pins, placeholder size

**Files:** Modify `src/creation/inventory.ts` (`CATEGORY_TAB`, tabs), `src/scene/DeviceSpawner.ts` (placeholder size from the plan or proposal size), `tests/creation/inventory.test.ts` (pins), `tests/scene/modelIds.test.ts`.

**Interfaces:** Produces tab entries for categories amplifier, speaker, outboard, wireless, di-box, broadcast, headphones, recorder, measurement, plus the tabs « Amplis », « Câbles et DI », « Pieds et accroches »; `deviceFootprint(id): {w:number; d:number; h:number}` using proposal size when present, else the category footprint, else the 0.4 x 0.3 x 0.3 m default.

- [ ] **Step 1: Failing tests**: `every catalogue category and every proposal category has a tab` (no device falls into « Autres »); `inventory pins derive counts from catalog.json rather than literals`; `placeholder box uses the proposal size when present`; `no id is listed in two tabs`.
- [ ] **Step 2: Run** `npx vitest run tests/creation/inventory.test.ts tests/creation/betaDevices.test.ts tests/scene`; expect FAIL.
- [ ] **Step 3: Implement**; replace literal counts (25 devices, 16 categories) by values derived from the catalogue.
- [ ] **Step 4: Run** the same command and `npx tsc --noEmit`; expect PASS.
- [ ] **Step 5: Commit.**

### Task 0.6: Register generator and the beta-modelled badge

**Files:** Create `tools/brandsRegister.ts`; Modify `docs/legal/BRANDS_AND_CREDITS.md` (device section between generated markers), `src/creation/betaDevices.ts` (badge « Bêta — dimensions estimées » for proposals with a manifest model); Test `tests/tools/brandsRegister.test.ts`, `tests/creation/betaDevices.test.ts`.

- [ ] **Step 1: Failing tests**: `register has exactly one row per manifest device row`; `generated block is stable (second run no diff)`; `a proposal with a manifest model shows the estimated-size badge`; `a proposal without a model shows the plain Bêta badge`.
- [ ] **Step 2: Run** both files; expect FAIL.
- [ ] **Step 3: Implement** `renderRegister(manifest, specs): string` and the badge; add `"register": "tsx tools/brandsRegister.ts"`.
- [ ] **Step 4: Run** the files; expect PASS.
- [ ] **Step 5: Commit.**

### Task 0.7: Two spikes (results recorded, nothing shipped)

**Files:** Create `docs/superpowers/notes/2026-11-11-equipment-log.md` (Wave 0 section).

- [ ] **Step 1:** Build a throwaway dry-run of a sloped desktop interface (Focusrite Scarlett 2i2 4th gen) on `console-wedge` v2 and of a rectangular monitor (Neumann KH 120 II) on `curved-cabinet` into a scratch folder; compare to the datasheet size and note validator refusals.
- [ ] **Step 2:** Record in the log: pass or fail, the params used, and the consequence (if the console-wedge spike fails, Task 3.3 becomes mandatory; if curved-cabinet fails for rectangular monitors, they use `rack-box-v2` boxes with rounded edges).
- [ ] **Step 3:** Run the wave gate (below) and commit the log.

### Wave 0 gate and review

- [ ] Run `npx tsc --noEmit`, `npm run lint`, `npm run validate:catalog`, `npm run validate:assets`, `BLENDER_EXE=D:\Blender\blender.exe npx vitest run`, `npm run build` into a scratch outDir then `npm run budget`.
- [ ] Spawn one independent read-only reviewer over `git diff <wave-start>..HEAD` against Review Focus; fix findings test-first; log the numbers.

## Wave 1: Existing recipes (49 rows)

Each task below is the DBL over `planRows({ wave: 1, family: <family> })`; the agent lists the ids it got in the log first.

### Task 1.1: Revolve devices (mics and handhelds) 
Family `revolve`. Expect Shure Beta 58A, Sennheiser MD 421-II, SM7B, e 835, MKH 416, Neumann KM 184 and TLM 103, RODE NT1 5th gen, Royer R-121, SLXD2 handheld, K&M 232 table stand. Use the SM57/RE20 lathe recipes (station list from the datasheet profile; generic wrap picture; no brand mark). Extra test per device: `size within 0.5 mm of plan` via the size gate; `triangle count within 1500-6000`.
- [ ] Run DBL for every row; commit per family batch.

### Task 1.2: Rack-box devices 
Family `rack-box-v2`: DI boxes (Radial JDI, ProDI, J48, Countryman Type 85), stage boxes (A&H AR2412, Midas DL16, Behringer S16), preamps (AMS Neve 1073SPX, dbx 286s, ADA8200), interfaces (Scarlett 2i2 / 18i20, Apollo Twin X, MOTU 828), headphone amps (HA400, HP4), processors (DriveRack PA2, DCX2496, MUTEC MC-3+, Samson S-Patch), wireless racks (PSM 300, SLX-D, ew 100 G4), Furman M-8x2, JK Audio Broadcast Host, Mac mini and Mac Studio, UA 1176LN, Soundcraft Ui24R. Flat zones come from the generated power layouts. Per device: front or rear connector rows laid out from the datasheet order (confidence `guess` unless a drawing is cited).
- [ ] Run DBL for every row; batch of at most 10 per commit.

### Task 1.3: Console-wedge devices 
Family `console-wedge-v2`: Mackie ProFX12v3 and 1202VLZ4, Rodecaster Pro II, Yamaha TF5. Use the QL1 params as a template; slot plates only where the datasheet shows option slots.
- [ ] Run DBL for every row.

### Task 1.4: Curved-cabinet devices 
Family `curved-cabinet`: Neumann KH 120 II, Yamaha HS5, JBL 305P MkII (per Task 0.7 result). Active-speaker template: line in, mains, routing to `transducer`, nominal acoustic with source.
- [ ] Run DBL for every row.

### Task 1.5: Stands 
Family `tripod-stand`: K&M 25400, 210/6, 259. Pose-dependent heights: use the datasheet's working height; folded size in notes.
- [ ] Run DBL for every row.

### Task 1.6: Wave 1 gate and review
- [ ] Wave gate commands as in Wave 0; scene-stats comparison against the 44f5dd7 numbers; look audit sheet of the wave (local); independent review; log counts (promoted / beta-modelled / blocked).

## Wave 2: First new families and the rest of the top teaching devices (87 rows)

### Task 2.1: `rack-box-v3b` (front vents, windows, ear handles)
**Files:** `tools/assets3d/shapes.ts`, `blender/build_from_spec.py`, `tools/assets3d/specSchema.ts`; Test `tests/tools/assets3d/rackBoxV3b.test.ts`.
- [ ] Failing tests: `front vent slots cut through the plate`, `meter window recess depth`, `ear handles sit outside the plate and clear the ears`, `flat zones refuse a vent over a control`, `old rack-box v2 output unchanged (sha256 of the nine pinned boxes)`, `two builds byte-identical`. Implement as params on the existing builder (extension, not a fork). Run the Blender tests; commit.

### Task 2.2: `moulded-box` (recess, lid, hinge)
Generalise from `curved-cabinet`; test names: `recess depth`, `lid seam`, `hinged laptop opens to the plan angle`, `size exact`, `deterministic`, `old curved-cabinet sha256 unchanged`.
- [ ] Failing tests, implement, run Blender tests, commit.

### Task 2.3: `revolve-v2-oval` 
Oval section lathe for the C414 and ribbons: tests `section width and depth match the plan`, `round revolve output unchanged (SM58 sha256)`, `wrap picture maps on an oval`, `deterministic`. After it passes, re-run the rejected U 87 Ai candidate as a spike and record the A/B (Meshy model stays unless the scripted one wins).
- [ ] Failing tests, implement, run, commit.

### Task 2.4: `round-base-stand`
Variant of `tripod-stand` for round-base stands (K&M 26125): tests `base disc diameter`, `boom length`, `deterministic`.
- [ ] Failing tests, implement, run, commit.

### Task 2.5 to 2.7: Device batches
- 2.5: remaining Wave 2 rows on existing families (consoles A&H SQ-5, X32 and X32 Compact, XR18, DM3, TF1; power amps Crown XLS 2502, XTi 4002, EP4000; outboard; Dante switches; recorders; monitor controllers).
- 2.6: rows on `rack-box-v3b` (compressors with windows, power amplifiers with handles).
- 2.7: rows on `moulded-box` and `revolve-v2-oval` and `round-base-stand` (recorders, bodypacks, antennas, boundary mics, C414, K&M 26125).
- [ ] Run DBL for every row of each batch (family filter per task).

### Task 2.8: Wave 2 gate and review (same as 1.6).

## Wave 3: Speakers, cables, long tail (92 rows)

### Task 3.1: `speaker-cabinet-v2` 
Elevation profile, handles, pole socket, splay for line-array elements. Tests: `elevation profile height at back`, `handle recess`, `pole socket diameter`, `rear pockets still behind inset ports`, `old curved-cabinet sha256 unchanged`, `deterministic`.
- [ ] Failing tests, implement, run, commit.

### Task 3.2: `cable-assembly-v2` and typed cable items
Cables stay typed items (D5): add end-kind codes to `cable-assembly`, and the catalogue-side typed item (`connectorA`, `connectorB`, `lengthM`) only if the spec decision stands; tests: `end kinds render`, `mated connectors match`, `old cable-assembly (Mogami loom) sha256 unchanged`. The snake box and fan-out are normal devices.
- [ ] Failing tests, implement, run, commit.

### Task 3.3: `rack-box-v3-slope` (conditional)
Only if Task 0.7 recorded that console-wedge cannot carry sloped desktop gear; otherwise skip and log. Tests: `slope angle`, `ports on the sloped face are on a real surface`, `old rack-box output unchanged`.

### Task 3.4 to 3.6: Device batches
- 3.4: speaker rows (passive, line-array elements, subwoofers, wedges) on `speaker-cabinet-v2`; passive speakers need the amplifier-in-chain rule: add rule R-load in `content/catalog.json` with French teach text and a test in `tests/tools/schemas.test.ts` (`R-load fires on a passive speaker without an amplifier, not on an active speaker`).
- 3.5: cable and power rows (Eaton UPS, powerCON distribution, Whirlwind splitter and Medusa, Radial JS3).
- 3.6: long-tail rack gear on existing families.
- [ ] Run DBL for every row.

### Task 3.7: Wave 3 gate and review.

## Wave 4: Headphones, arms, furniture, lavaliers (70 rows)

### Task 4.1: `assembly` family
Data-driven multi-part: `parts: [{ kind: 'box'|'cylinder'|'torus'|'lathe', size, pos, rot, fillet }]` in the spec; tests: `parts compose to the declared bounding box`, `symmetry mirror option`, `triangle budget respected`, `deterministic`, `all older shapes sha256 unchanged`, `flat zones respected`.
- [ ] Failing tests, implement, run, commit.

### Task 4.2 to 4.4: Device batches
4.2 headphones (DT 770, HD 25, M50x, MDR-7506, HD 280, DT 990, K240) with 3.5 and 6.3 mm ports and the cup size measured from the plan's source or marked `estimate` (then beta-modelled); 4.3 arms, pop filter, shock mounts, lavaliers and earsets, racks and furniture; 4.4 remaining.
- [ ] Run DBL for every row.

### Task 4.5: Wave 4 gate and review.

## Wave 5: Tail and close

### Task 5.1: Tail triage
- [ ] For each Wave 5 row: build if data exists, else list as blocked with the missing datasheet; no invented numbers.

### Task 5.2: Whole-run verification and report
- [ ] Run: `npx tsc --noEmit`, `npm run lint`, `npm run validate:catalog`, `npm run validate:assets`, `BLENDER_EXE=D:\Blender\blender.exe npx vitest run`, `npm run build` (scratch outDir) + `npm run budget`, the full Playwright suite on a private preview (`E2E_PORT=4181`), scene-stats comparison with 44f5dd7; total GLB size check (at most 120 MB, none over 25 MiB).
- [ ] Independent read-only review of `git diff a38c685..HEAD` against Review Focus; fix findings test-first.
- [ ] Write `E:\CLAUDE BU\reports\TekPractice night 5 - all equipment built.md` (per wave: promoted / beta-modelled / blocked counts, per-device table, gates, test numbers, open items, the `git log origin/assets/3d-rebuild..HEAD` list, the validation checklist for the founder) and a test checklist like the night 4 one; update memory (`project_tekpractice_3d_rebuild.md` and the MEMORY.md line).

### Task 6.1 (stretch, only if everything above is green)
- [ ] Hand-measured control layouts for the desks and strips with real controls (Rodecaster Pro II, Mackie 1604VLZ4, X32, A&H SQ-5), one layout per commit with a layout-parity test.
