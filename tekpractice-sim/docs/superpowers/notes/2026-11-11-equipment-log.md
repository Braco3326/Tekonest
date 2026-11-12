# Equipment log (build all equipment, 2026-11-11)

Plan: `docs/superpowers/plans/2026-11-11-build-all-equipment.md`. Each agent adds its own section below.


## Wave 0 spikes (Task 0.7)

Throwaway dry runs, nothing shipped. Method: scratch specs in a temporary folder outside the repo (not committed), driven through the real `buildAsset(id, { scripted: true, dryRun: true })` with injected `loadSpec`, a synthetic one-device `loadCatalog`, and scratch `paths`. So every run went through `validateBuild` (TS), the Blender builder, the fix-up, the contact sheet and all the gates (size, transform, parts, portPositions, budget, detail, fillet, proportionDrift, portSurface, textures, validator = 11 gates). Nothing was written to `content/`, `public/assets` or the manifest. `BLENDER_EXE=D:\Blender\blender.exe`. All specs: tier `standard`; sizes in the order (w, d, h) as given in the task; port and control positions are guesses (the spike tests the shape, not the layout). The driver is a throwaway script (about 25 lines, not committed).

Sanity check of the method: the shipped `genelec-8030c` spec run through the same driver gives 3088 triangles and 11 of 11 gates, the same as its manifest row.

### Q1. console-wedge v2 carrying a sloped desktop interface (Scarlett 2i2 4th gen, 180 x 117 x 47.5 mm): PASS (with one rule)

The vertical-front requirement is only that the last profile station (the front edge) has a positive height; it does not refuse a steeply sloped front face. A slope is a few profile stations, and the front lip is whatever height the last station has.

| Variant | Profile `[depth from io face, height]` | Params | Triangles | Size error | Gates |
|---|---|---|---|---|---|
| A, steep front slope, 3 mm lip, rear ports and 2 gain knobs on `top` | `[0,47.5] [60,47.5] [95,47.5] [117,3]` | `filletMm 1.2, filletSegments 4` | 568 | 0.00 mm on all three axes | 11 of 11 |
| B, gentle wedge, 26 mm lip with 2 combo inputs (opening 20) on `opposite` at y 13 | `[0,47.5] [40,47.5] [80,38] [117,26]` | `filletMm 1.5, filletSegments 5` | 836 | 0.00 mm | 11 of 11 |
| C, steep slope over the last 22 mm, then a 26 mm vertical lip with the 2 combo inputs | `[0,47.5] [70,47.5] [95,47.5] [117,26]` | `filletMm 1.5, filletSegments 5` | 754 | 0.00 mm | 11 of 11 |

All used `build.budget` 250 to 2000 and `minFilletMm 1`; measured fillet 1.2 / 1.5 / 1.5 mm. The contact sheet of C shows the slope in the side view as intended.

What the validator or builder refused (variants of A):
- Last station height 0 (knife edge): refused by `validateBuild`: "every height must be positive"; the fillet check then reads a smallest side of 0 mm.
- Last station 3 mm with `filletMm 1.6`: refused, `filletMm` must be smaller than half the lowest station (1.5 mm). So the fillet is bounded by half the front lip: a very steep, knife-like front means a small fillet (this matters for the `minFilletMm` gate).
- Station depths that go back (an overhang, `[95,47.5] [90,3]`): refused by the zod schema, "station positions must strictly increase". A face that leans forward over its base (top further forward than the bottom) cannot be expressed; a face that leans back (the usual wedge) can.
- Front ports (`opposite`, y 13) on a 3 mm lip: not refused by the validator, but the gate `portSurface` FAILS: "port_in-1 floats in front of the surface: the surface is 4.94 mm behind it". So ports must sit on a vertical lip (or on the io face), never on the slope. (This run came back `ok: false` with an empty `error` string: `portSurface` is not in the retryable set, the loop just ends.)
- A `frontRecess` of 60 x 20 mm on the 3 mm lip: Blender refuses, "expected one flat face ... spanning the recess".

Not covered by the spike: the flat-zone check against a control layout (needs `content/control-layouts/<id>.json`, which I must not create). The controls rig already puts `top` controls on a sloped top through `topProfile` in the layout (`src/controls/faceFrame.ts`), so knobs on the slope are a data question (the layout's `topProfile` repeats the spec profile), not a builder one. The gates only check control nodes against the placement, not that a knob sits on the real surface, so the knob positions on the slope were not checked against the surface.

Consequence: **Task 3.3 (`rack-box-v3-slope`) is NOT mandatory for sloped desktop gear.** Sloped-front and wedge desktop interfaces (Scarlett, Apollo Twin, Rodecaster-class, small desk mixers) use `console-wedge` v2 with a 4-station profile; keep Task 3.3 optional (only for sloped RACK gear that needs ears and handles, which console-wedge does not have). Rules for the build loop: the front must keep a vertical lip as tall as the tallest front port plus margin (about 1.5 x the opening); `filletMm` must be smaller than half the lowest profile station; no overhang; ports on `io` and on the lip only.

### Q2. curved-cabinet carrying a near-rectangular nearfield monitor: PASS

Neumann KH 120 II (182 x 227 x 287 mm, w x d x h) and Yamaha HS5 (170 x 222 x 285 mm). Params used (KH 120 II, `spike-kh120`):
`planFrontMm 182, rearWidthMm 182, frontRadiusMm 8, backRadiusMm 8, edgeRadiusMm 6, edgeDropMm 6, edgeSegments 8, wooferRingMm 130, wooferYMm 105, tweeterRingMm 28, tweeterYMm 232, waveguideMm 72, waveguideDepthMm 8`; ports `in-analog` (opening 22, inset 3) and `power-in` (opening 20, inset 3) on `io`, one `power` switch on `io`; `build.budget` 1500 to 4000, `minFilletMm 5`.
HS5 (`spike-hs5`): the same plan params, `wooferRingMm 120, wooferYMm 100, tweeterRingMm 30, tweeterYMm 232`, no waveguide, three rear ports (XLR, TRS, inlet).

| | Triangles | Size error vs datasheet | Measured fillet | Gates |
|---|---|---|---|---|
| KH 120 II | 2180 | 0.00 mm | 6.00 mm | 11 of 11 |
| HS5 | 2244 | 0.01 mm on w and d (169.99 x 221.99), height exact | 6.00 mm | 11 of 11 |

Tighter plan: `frontRadiusMm 5` or `4`, `backRadiusMm` the same, `edgeRadiusMm 3, edgeDropMm 3` passes too (KH, 2036 triangles, measured fillet 3.00 mm, size exact, 11 of 11). Refusals: `frontRadiusMm 4` with `edgeRadiusMm 6` is refused by `validateBuild` (plan radius must be at least the edge radius); `frontRadiusMm = backRadiusMm = edgeRadiusMm = 3` passes the validator but Blender refuses ("the fillet folds over at the plan corner"), so in practice the plan radius has to be strictly larger than the edge radius (use at least edge + 1 mm). Smallest working corner here: plan radius 4, edge radius 3. No width stretch was needed (`planFrontMm` = the width, no `sideBulgeMm`, so the 12 % limit does not bite). The baffle rings are cut into a flat baffle as the validator requires (no `crownMm`).
Caveat: the rear and the baffle read as shaded rounded faces with the same smooth-shading look as the shipped Genelec (compared with the same driver), and two rear port pockets at the same x are joined by a bridge in the sheet (also visible on the Genelec). Not investigated, not new.

Consequence: Task 1.4 is as planned: KH 120 II, HS5 and JBL 305P MkII go on `curved-cabinet`; rectangular monitors do NOT need `rack-box-v2` boxes. Rule for the build loop: plan radius at least edge radius + 1 mm, `minFilletMm` equal to the edge radius. Front-firing ports and slots are not modelled by this shape (picture only).

### Q3. rack-box v2 carrying a small DI box (Radial JDI, 127 x 84.1 x 45.5 mm): PASS (after one fix of the params)

First attempt `filletMm 4, filletSegments 6` (nothing else): FAIL gates `detail` (312 triangles under an invented floor of 500) and `fillet` (measured 1.80 mm against a declared 3 mm). Cause: in rack-box v2 the measured fillet is the smaller of the chassis bevel and the front PLATE bevel, and the plate bevel defaults to `min(filletMm, 0.45 x plate thickness)` with the default plate thickness 4 mm = 1.8 mm.
Fix and final params: `filletMm 4, filletSegments 10, earThicknessMm 8, plateFilletMm 3.5, feetMm 2, feetDiaMm 8` (`earThicknessMm` is the plate thickness, so the front plate is an 8 mm slab; `plateFilletMm` has to stay under half of it). Ports `in-jack`, `thru-jack` (opening 12), `out-xlr` (opening 22) and a `ground-lift` switch on `io`. Budget 250 to 2000 (the floor is mine; small gear has no floor in the plan), `minFilletMm 3`.
Result: 712 triangles, size exact (127.00 x 45.50 x 84.10, 0.00 mm), measured fillet 3.50 mm, 11 of 11 gates. Refusals: none from the validator.
Caveats: (a) the plate and the chassis are two beveled slabs, so there is a groove at their junction (a visible seam; give both the same `plateRgb` and `bodyRgb` to hide it in vertex colour); (b) 712 triangles at 10 segments is the low end of a small box: set the declared floor per class from this (about 600 for a small box); (c) rack-box cuts no pockets, so the ports stay on the bounding-box plane.

Consequence: Task 1.2 DI boxes (JDI, ProDI, J48, Type 85, and similar small boxes) work on `rack-box-v2` without a new shape. Rule for the build loop on small rack-box devices: set `earThicknessMm` (the plate thickness) to at least `plateFilletMm / 0.45` before declaring a `minFilletMm` above 1.8 mm.

### Summary of consequences for the plan
- Q1 PASS: Task 3.3 `rack-box-v3-slope` stays optional (skip unless a sloped RACK device needs it); sloped desktop gear goes on `console-wedge` v2 (Task 1.3 and the later desktop-interface rows), with the lip rule above.
- Q2 PASS: Task 1.4 unchanged; no rounded-box fallback needed.
- Q3 PASS: Task 1.2 unchanged; DI boxes use the plate-thickness rule above.
- Scratch contact sheets (kept in the temporary folder, not committed): the Scarlett (variant C), KH 120 II and Radial JDI runs each left an `attempt-1.sheet.png` there.


## Wave 0 foundations (Tasks 0.1 to 0.6)

Nothing pushed, nothing deployed, no Meshy, no real device promoted (the only content changes are the plan JSON, the proposals' `sizeMm`, schema, connectors, tabs, tools, tests, docs).

### Commits

| Task | Commit | What |
|---|---|---|
| 0.1 | d97e178 | `content/proposals/equipment-plan.json` (315 rows), `tools/equipmentPlan.ts` (zod, `loadPlan`, `planRows`), `tools/import-equipment-plan.ts` (one-off CSV to JSON, refuses to overwrite without `--force`) |
| 0.2 | f3fbb00 | `tools/proposalMerge.ts` (pure `mergeProposals`), wired into `propose-content.ts`; proposals carry the plan `sizeMm` |
| 0.3 | 297768f | 6 port flags, `loadOhms` / `minLoadOhms` / `impedanceOhms` / `sizeMm` on Device, 12 connector types (marker sizes, French labels), catalogue rules (port id at most 19, ribbon / tally flags, minLoad <= load) |
| 0.5a | 3a2cb7c | `src/scene/placeholderSize.ts`: placeholder box from the plan size, then category footprint, then 0.4 x 0.3 x 0.3 m (table moved out of the spawner unchanged) |
| 0.4 | ab03531 | `tools/behaviourTemplates.ts`, `tools/promoteDevice.ts`, `npm run promote`, `tools/catalogWithProposals.ts`, `Device.portAliases` + store migration |
| 0.5b | 5f870de | 12 tabs, `CATEGORY_TAB` for the 38 plan + 21 proposal + 16 catalogue categories, derived pins |
| 0.6 | b111d80 | `tools/brandsRegister.ts` (`npm run register`, `--check`), generated section 6 of the register, badge « Bêta — dimensions estimées » |
| gate | see git log | README of the proposals folder, drawer tab-focus fix, this log |

### The plan table (315 rows)

By `dataQuality` (what the size supports) and wave:

| Wave | datasheet | dealer | estimate | missing | total |
|---|---|---|---|---|---|
| 1 | 32 | 8 | 1 | 8 | 49 |
| 2 | 30 | 12 | 2 | 43 | 87 |
| 3 | 16 | 10 | 3 | 63 | 92 |
| 4 | 2 | 8 | 0 | 60 | 70 |
| 5 | 0 | 1 | 0 | 16 | 17 |
| all | 80 | 39 | 6 | 190 | 315 |

134 Bêta rows (13 datasheet, 3 dealer, 1 estimate, 117 missing) and 181 new rows (67, 36, 5, 73). 197 rows carry at least one source URL (the notes column first, then the research notes by product match on a table row or on the start of a bullet); none was invented. Wave 1 rows blocked on a size today: radial-j48, k-m-25400, behringer-ha400, mutec-mc-3-plus, samson-s-patch-plus, sennheiser-ew-100-g4, k-m-210-6, k-m-259 (the three K&M stands cite a datasheet URL: the Wave 1 agent has to read the heights and put them in the plan row).

### Decisions where the plan left a choice

1. **Two grades per row.** The CSV grades 34 rows `datasheet` or `dealer` that have no (or only some) of the three dimensions (e.g. `royer-r-121` 25 x ? x 155.7, the K&M stands 'xx'). The plan test requires a datasheet or dealer row to have all three sizes. So `sourceGrade` keeps the research grade and `dataQuality` is what the size supports: partial gives `estimate`, none gives `missing` (38 rows changed grade: 19 datasheet to missing, 11 dealer to missing, 4 estimate to missing, 3 datasheet to estimate, 1 dealer to estimate). Nothing partial can be promoted as measured.
2. **Family name** `rack-box-v3-sloped` in the CSV is `rack-box-v3-slope` in the plan (Task 3.3 name).
3. **`mergeProposals` lives in `tools/proposalMerge.ts`**, not exported from `propose-content.ts` (importing that script would run it). A plan row of status `new` is never a proposal unless it was beta-modelled. `generated` dates and note dates of the proposals file were not rewritten (sizes were merged in place).
4. **`sizeMm` on Device** (optional, any subset of w, d, h) is how the placeholder gets the plan size: proposals carry it, the plan file is not shipped to the browser.
5. **Category = plan category.** A promoted device keeps the plan's category (`console-analog`, `stand-arm`, ...); `CATEGORY_TAB` and `CATEGORY_KIND` list all of them (tests fail on a new unlisted category). Tabs: `amplifier` to Amplis; `cable`, `di-box`, `splitter` to Câbles et DI; `accessory`, `stand-arm`, `mic-arm`, `shock-mount`, `pop-filter` to Pieds et accroches; headphones and headphone amps to Enceintes; wireless and IEM to Micros; outboard, broadcast, hybrids to Consoles; recorder, measurement, controller to Sources; codec, clock, switch, intercom, interface to Réseau; furniture, patchbay, signaling to Autres. **[validate]** This moves the K&M 210/9, the Yellowtec m!ka and the Mogami loom from Autres to the new tabs (visible change on shipped devices; e2e list updated and run).
6. **Outcomes.** `promoted` needs datasheet or dealer grade with all three sizes AND at least one source URL; `beta-modelled` for `estimate` (the proposal stays, ports unchanged so saved cables survive, a new row gets a proposal built from the template, the spec gets a complete size with the estimated axes said in its sources and `guess` ports, no controls); `blocked` for `missing`, a cable row without documented ports, or an id collision. Plan rows gain optional `ports` (documented connector set), `traits` (condenser, ribbon, active, passive, processor), `promoted`, `betaModelled`.
7. **Short port ids** are a pure function (direction word and trailing number kept, filler words such as input / per / channel dropped, then words dropped from the end): `in-balanced-input-per-channel-1` gives `in-balanced-1`. Old Bêta ids go in the new additive `Device.portAliases` (old to current) and `CreationStore.build` loads a saved cable that names an old id onto the new one (tested). A mains inlet is always `power-in` with the toggle `power`.
8. **The asset pipeline sees proposals** (`catalogWithProposals`, used as the default `loadCatalog` of `asset:build`), otherwise a beta-modelled spec would fail the parity check.
9. **Spec skeleton** written by `promote`: ports at 0,0 marked `guess`; controls get placeholder positions (power on `io`, the others on `top`): measure them before running `tools/controls/gen-from-specs.mjs`.
10. **Badge**: inventory item badge is « Bêta — dimensions estimées » when a model ships for a proposal, else « non vérifié ». The Project tree and Properties still say « non vérifié » for such a device (not changed, still true).
11. Connector sizes of the 12 new connectors: documented estimates (marked `est.` in the table), the ring is only a hint.

### Open items

- **aoip split (spike, NOT shipped).** Tried in the tree and reverted: added `dante`, `aes67`, `avb`, `aes50`, moved QL1 and Rio3224-D2 to `dante`, Axia iQ, playout-pc and the two AETA codecs to `aes67`, added the four to the clock module's digital set. Result: `validate:catalog` valid, all four levels solvable, every logic / engine test green including R5 to R8; the only red tests were the 11 of `cableStyle.test.ts` (four more colours must be found with the existing 16 fixed, plus French labels and deck rows). Not shipped because (a) it changes the signal of 6 founder-verified devices and the Livewire / codec to AES67 mapping is a modelling call, and (b) 26 proposals (39 ports) carry `aoip`: unless the promotion maps each to the right protocol, a promoted Dante device would not connect to the migrated QL1. Recipe if the founder agrees: signals + palette search + labels + migration above + a protocol field in the plan row read by `promote`.
- **No signal types for RF antenna, DC supply or MIDI.** The connectors `bnc-antenna-50ohm`, `dc-barrel`, `midi-din5` exist but no signal fits (Task 0.3 lists none). Wireless and recorder templates therefore omit antenna and DC ports; adding `rf-antenna`, `dc-power`, `midi` needs three more cable colours (same palette search).
- Port ids in `portAliases` are aliased for cables only, not for control ids (a Bêta device has no controls, so none to alias).
- The templates are skeletons: a promoted device still needs its French `realWorld` copy, real port positions and, for speakers, a measured `modelFront` and real coverage (the template writes the 90 x 60 nominal, with its source).
- Hand-made notes per device (`notes`) are English template text.

### Gate numbers (2026-11-12)

- `npx tsc --noEmit`: clean. `npm run lint`: clean. `npm run validate:catalog`: valid (25 devices, 79 ports, 38 connector types, 16 signal types, 8 rules). `npm run validate:assets`: 51 ok, 0 failed.
- `npx vitest run` with `BLENDER_EXE=D:\Blender\blender.exe`: 235 files, 3669 tests, all passed (baseline before Wave 0: 228 files, 3541 tests).
- Build: `npx tsx tools/room-thumbs.ts`, `npx tsc`, `npx vite build --outDir <scratch>` (not blocked; `npm run build` itself cannot take an outDir), `node tools/chunk-budget.mjs <scratch>`: budget OK (creation start 5,899,986 B of the 6,761,988 limit). `room-thumbs` left no diff.
- Playwright on a private preview of the scratch build (`E2E_PORT=4181`, scratch config): `creation-drawer` and `creation-beta`, 60 passed, 1 skipped. One test needed a change: at 400 px wide the tab row is 152 px and « Pieds et accroches » (135 px) cannot clear both edge fades, so the focus handler of the drawer now centres a tab that wide (whole, not half out) and the S7 spec asserts that case separately.
- Independent read-only review (plan Review Focus): not run by this agent.


## Wave 0b review fixes (2026-11-12)

An independent reviewer found 12 defects in the Wave 0 code. The fixes were made test first (a failing test on the REAL plan rows, proposals and catalogue, fixtures only in addition), one commit per group, explicit paths, nothing pushed, no Meshy, sizes of the plan untouched. The finding numbers below follow the fix brief (the reviewer's own report was not among my inputs): 1 ports from a category template, 2 and 3 and 8 templates by trait (mic phantom, wireless, desk routing), 4 the port id regex, 5 importer sources, 6 partial state when a device fails its gates, 7 estimates reaching the catalogue, 9 a promoted device losing its size, 10 sync:kb, 11 and 12 hygiene.

### Design decisions applied

- **Promotion is two-stage.** `npm run promote -- <id>` (stage 1) writes only the asset-spec skeleton and marks the plan row `staged`. `npm run promote -- <id> --commit` (stage 2, DBL step 5) refuses unless the manifest has the row and `public/assets/<id>.glb` exists, then writes the catalogue entry (promoted) or keeps the proposal with its size and model (beta-modelled). `--revert` undoes the latest stage completely. Atomic (temporary files, renames, rollback) and idempotent. A revert journal `content/proposals/promotion-journal.json` is created by the first stage 2 (it remembers the proposal a stage 2 removed or replaced).
- **Ports come from the documented set.** The asset spec carries ports with connector, signal, dir, flags; `portsDocumented: true` + `portsSource` (a URL) is set by the person who fills the spec. Without it a row can only become beta-modelled. Stage 1 never writes a port: the proposal's ports or the plan's ports summary go into a `portsTodo` text.
- **Templates add behaviour only** (power toggle for every mains inlet, phantom, routes, acoustic, controls), chosen by category and by the row's `traits`.
- **The pipeline sees a staged device** as the catalogue entry stage 2 will write (`stagedDevices` in `tools/promoteDevice.ts`, used by the default `loadCatalog` of `asset:build`), so the spec parity check passes between the stages.

### Findings

| # | Finding | Action | Commit | Test |
|---|---|---|---|---|
| 4 | `shortPortId` regex `/^d+$/` for `/^\d+$/`: the channel number was dropped | regex fixed | da44485 | `behaviourTemplates.test.ts`: in-mic-preamp-input-balanced-per-channel-1 and -2, every long id of the real proposals (TF5, MOTU 828, ...) keeps its trailing number, unique, at most 19 characters |
| 7 | An estimate or an unsure full size could be promoted | `PlanRow.sizeConfidence` (ok, axis-assumed, conflict, partial); `effectiveQuality(grade, size, confidence)` is datasheet or dealer only with 3 axes AND ok; schema refuses otherwise; 21 rows demoted to estimate (radial-prodi, radial-jdi, countryman-type-85 and yamaha-tf5, yamaha-tf1, yamaha-dm3, allen-heath-sq-5, behringer-xr18, motu-828es, ... axis assumed or via a search summary; scarlett 2i2, midas-dl16, jbl-305p-mkii, qu-16, furman-m-8x2, md-421-ii, ua844+, nys-spp-l1, srk, ... conflict on a dimension) | 455495d | `equipmentPlanTraits.test.ts` (consistency on all 315 rows, the named rows, the schema refusals), `equipmentPlan.test.ts` |
| traits | Templates read a few traits and no row carried them | `PlanRow.traits` (16 known) on all 315 rows from category, product and notes | 455495d | `equipmentPlanTraits.test.ts` (one capsule trait per microphone, ribbon never phantom, handheld/bodypack are battery transmitters, amplifier is power-amp xor processor, consoles are desks, speakers active xor passive) |
| 5 | Importer sources: school inventories, sibling products, accessories, blogs | note-file links only from a line whose SUBJECT is the product (table first cell, bullet subject, exact match), multi-link bullets keep the links that name the product, schools, library guides, blogs, news, reviews, simulators and accessory pages never taken; `--refresh-sources` recomputes only `sources`; `sourceKind()` types a spec source (a retailer is `dealer`, a third-party manual host `manual`, never `datasheet`) | 455495d, eee45ac | `importSources.test.ts` (the nine examples on the verbatim note lines AND on the committed plan, PSA1 vs PSA1+, 828 vs 828es), `sourceKind.test.ts` |
| 1 | Catalogue ports came from a category template | ports come from the spec's documented set; `portsDocumented` gate; template adds behaviour only; mismatching port ids refused with the id to use | eee45ac | `promoteDevice.test.ts` (neumann-tlm-103 promoted with its documented port; the same row without portsDocumented is beta-modelled; `power-in` rename refused), `behaviourTemplates.test.ts` (a template never invents ports) |
| 2, 3, 8 | Templates by category only | traits: condenser/phantom-powered require phantom (active or battery condensers do not), ribbon/dynamic never; handheld, bodypack and battery have no mains and no power toggle (documenting one throws); `processor` routed like outboard gear even under amplifier (more outputs than inputs: each input to all outputs); desks routed to the `out-main*` outputs, else to every non-headphone, non-speaker output; passive studio monitor is a passive speaker | eee45ac | `behaviourTemplates.test.ts` with the real rows neumann-tlm-103, akg-c414-xlii, royer-r-121, shure-slxd1-bodypack, shure-slxd2-handheld, shure-qlx-d-receiver, dbx-driverack-pa2, yamaha-tf5, allen-heath-sq-5, plus midas-m32 promoted with routing in `promoteDevice.test.ts` |
| 6 | Partial state when a device fails its gates | two stages (stage 1 touches neither the catalogue nor the proposals), atomic writes with rollback, `--revert` | eee45ac | `promoteDevice.test.ts`: catalogue, proposals and journal byte-identical after stage 1; a failed rename restores every file and leaves no temporary file; revert restores the catalogue byte for byte and the proposal at its place; `removeDevice(appendDevice(x)) === x` |
| 9 | A promoted device lost `sizeMm` before any GLB existed | the catalogue entry only appears at stage 2 (GLB shipped); the proposal keeps its `sizeMm` until then; the spec carries the size; a promoted size must equal the plan size | eee45ac | `promoteDevice.test.ts` (mackie-profx12v3 proposal identical after stage 1; spec size equals the plan size) |
| 10 | `sync:kb` was not a fixed point (the 12 Wave 0.3 connectors never went through it) | `tools/proposalGenerate.ts` (pure core), `buildProposalsFile` keeps a committed entry that differs only by the date of its note and the committed `generated` date; `propose-content.ts` run and the file committed: 137 devices (3 new: clear-com-rs-701, l-acoustics-k2, dpa-4088), 16 devices gain a port (xlr4, speakon-nl8, mini-xlr-ta4, ...), no existing port id changed | f18834e | `proposalsFixedPoint.test.ts` on the real KB, catalogue and plan: committed file equals the generator output byte for byte on three different days; reproducible without the file; the old connector set gives fewer ports and proposals |
| 11 | S7 tolerance loosened, the inventory pins compared the registry with itself, copy rows marked validated | S7 back to `FADE - 0.5` (the tab too wide for both fades keeps its own weaker rule, commented); the drawer floors or ceils its scroll move away from the fade; independent assertion in `inventory.test.ts` (registry = `devices[]` of `content/catalog.json` read directly, every promoted plan row in the registry, no other plan row in it); the 17 Wave 0 copy rows and the reworded Autres tab go from « validé » to « à valider » | bdc0005, c65c8d0 | `creation-drawer` and `creation-beta` e2e; `inventory.test.ts`; see the S7 note below |
| 12 | Local paths in the log; register Dimensions source a file path; unchecked « no photo, no logo » claim | the spike scratch paths and session ids removed from this log; register cell is a plan `sources[0]` URL, else a manifest or spec http(s) URL, else « catalogue (ours) » (the SM58 panel path and the multiprise catalogue path are gone), register regenerated; panels checked | c65c8d0 | `brandsRegister.test.ts` (every cell is an http(s) URL or the literal; the fallback order), `genericPanelsClaim.test.ts` (only drawn item kinds, no picture reference, no brand name in a text item of any of the 7 panels) |

Importer, the nine named wrong examples (before to after): rode-procaster lost the zzounds PSM1 shock-mount page (kept on rode-psm1); radial-prodi lost the McGill library guide; scarlett-18i20 lost the Stanford CCRMA and American University pages; api-512c lost Bakersfield College and Berklee; behringer-x32 lost the Midas M32 data sheet and the Markertek M32 page (the data sheet stays as a labelled sibling reference in its notes, not in `sources`); whirlwind-sp1x3 lost the SPLIT6 pages of the Adorama and Rentex; sennheiser-hd-25 lost the coiled-cable accessory page; middle-atlantic-srk lost the RK2 sheet; mackie-1604vlz4 lost the SAE simulator blog and the Music Connection article (it has no source left, nor has clear-com-freespeak-ii whose only extras were its beltpacks). 27 rows changed their `sources`; 195 rows keep at least one URL (197 before). The `data-completion-*` research files are not read by the refresh: their sizes and links belong to the separate size-merge step.

### Outcome eligibility of the 315 plan rows (after the fixes)

| Wave | promotable (datasheet or dealer, 3 axes, confidence ok, a source) | beta-modelled (estimate) | blocked (missing) | total |
|---|---|---|---|---|
| 1 | 30 | 11 | 8 | 49 |
| 2 | 35 | 9 | 43 | 87 |
| 3 | 23 | 6 | 63 | 92 |
| 4 | 9 | 1 | 60 | 70 |
| 5 | 1 | 0 | 16 | 17 |
| all | 98 | 27 | 190 | 315 |

Before: 119 promotable, 6 estimate, 190 missing. A promotable row is promoted only when its spec also documents the ports (`portsDocumented: true`); otherwise it is beta-modelled.

### Notes and deviations

- **S7.** I could not reproduce the failure the 1 px tolerance was added for: S7 passes at `FADE - 0.5` with the Wave 0 drawer code as well as with the rounding, on this machine (Chromium, device pixel ratio 1). The rounding is the defensive fix (a browser that keeps `scrollLeft` on whole pixels); only the too-wide tab case keeps a weaker rule.
- **`isMainOut` flag not added.** It would be a schema change; the role of a desk output is carried by its id (`out-main*`), with the fallback above, and the rule is written in `behaviourTemplates.ts`, the plan DBL and the spec.
- **Port aliases.** Aliases of a Bêta device promoted with new short ids are paired in order inside each (direction, connector, signal) group (channel 1 to channel 1); a pairing is a modelling call, so stage 2 lists the aliases it wrote.
- The three proposals added by the regenerated file have no plan row (they are not in the 315); the plan tests only require the other direction.
- `tools/import-equipment-plan.ts --force` still regenerates the whole plan from the CSV and would drop traits, sizeConfidence and the promotion flags; use `--refresh-sources` on a populated plan.

### Gate numbers (Wave 0b, 2026-11-12)

- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run validate:catalog` valid; `npm run validate:assets` 51 ok, 0 failed.
- `npx vitest run` with `BLENDER_EXE=D:\Blender\blender.exe`: 240 files, 3765 tests, all passed (Wave 0 gate: 235 files, 3669).
- Build into a scratch outDir (`npx vite build --outDir <scratch>`), `node tools/chunk-budget.mjs <scratch>`: budget OK; `tools/room-thumbs.ts` left no diff.
- Playwright on a private preview (`E2E_PORT=4181`, scratch outDir, scratch config): `creation-drawer` and `creation-beta`, 60 passed, 1 skipped.
- Not run: an independent re-review of this diff; a real stage 1 and stage 2 on a real device with a shipped GLB (the tool is tested on temporary copies of the real files; the first real promotion will be the Wave 1 DBL); the full Playwright suite.

## Wave 0c size research merge (2026-11-12)

The four size-research result files (`data-completion-A..D.json`, 190 rows: exactly the rows that were `missing` in the plan) are merged into `content/proposals/equipment-plan.json` by `tools/merge-size-research.ts` (one-off, idempotent: a merged row carries the marker « Wave 0c size research » in its notes and is not changed again; `--dry-run` writes nothing). Tests: `tests/tools/mergeSizeResearch.test.ts` (24 tests, on fixtures and on the real plan). No number was invented, rounded or converted by the merge: every stored axis is a value the result file gives for that id; the 125 rows that were not researched are untouched (their sizes are pinned by `tests/tools/fixtures/plan-sizes-before-0c.json`).

The four result files are committed as `content/proposals/size-research/data-completion-{A,B,C,D}.json` (the tool and the test need them; the originals stay in the research notes folder). They hold numbers, URLs and our own research notes, no photo.

### Rules as applied

1. Only `missing` / `estimate` rows are touched. A datasheet or dealer row keeps its size and a disagreeing result is logged as a conflict (no such case in the real data: none of the 125 sized rows was researched; the fixture test covers it).
2. `sizeMm` is stored only for a complete triple with a source grade and no conflict. A partial result stores nothing in `sizeMm`: the axes that exist are copied into the notes (« Partial axes (not stored in sizeMm) ... »), `sizeConfidence` is `partial`.
3. `sizeConfidence`: `conflict` (a sentence of the notes says sources disagree about a dimension; `sizeMm` stays empty and the held-back value stays in the notes, even where the result file filled one source's value), then `partial`, then `axis-assumed` (axis order unstated, assumed, inferred, derived from rack units, mapped by us, read from a search summary, or a size that belongs to a variant the row only assumes), else `ok`. A conflict about the weight, the ports, a packaging figure or another variant is not a size conflict. The label comes from a text classifier plus `CURATED`, the rows where my full reading of the notes differs from the classifier, each with its reason in the code and in the row's notes (« [Wave 0c size research, grade ..., sizeConfidence ...: reason] »).
4. `dataQuality` is recomputed with `effectiveQuality`; a test holds it for all 315 rows.
5. Result URLs are added after the existing sources (manufacturer pages first, then manuals, dealers, others). An annotation such as « (search summary) » is cut and spaces are percent-encoded (9 URLs). 11 URLs were not taken, by the Wave 0b `isNonSource` rule plus Wikipedia and one reviewer site: Wikipedia (the three cable families, the 19-inch rack, Coles 4038), Sound On Sound (lexicon-pcm96), erinsaudiocorner (yamaha-ns-10m), Ken Rockwell (sony-mdr-7506), Radio World (wheatstone-lx-24), a Long & McQuade bundle page with an adapter in its slug (coles-4038), and the Canford page of the WL93 (its slug says « cable », the accessory rule; the Thomann and Adorama pages stay).
6. Round bodies: the result files already use w = d = diameter (widest), h = length, as `shure-beta-58a`; the merge copies them and a test holds it. The stepped bodies (beyerdynamic M 160, Rode NT4, Neumann USM 69 i, the Schoeps CMC 6 sets) were not mapped by the research and are not mapped here.
7. The 8 cable and connector rows (family `cable-assembly-v2`) store no size and stay `missing`; the connector pair goes in the notes (« Connector definition: ... »), lengths where the research found any (it found none from a manufacturer).
8. Telos « Xenon »: the plan has no such row (the research found no such product), so there is nothing to block. The merge blocks any row whose id or product says Xenon with « no such product found » (tested on a fixture).
9. Weights: a result weight is set where the plan had none (107 rows); two disagreements keep the plan value and are logged (k-m-26772 3.1 vs 3.41 kg, yamaha-ns-10m 6 vs 6.3 kg).

### Counts after the merge (315 rows)

| dataQuality / sizeConfidence | before | after |
|---|---|---|
| datasheet / ok | 63 | 112 |
| dealer / ok | 35 | 41 |
| estimate / axis-assumed | 14 | 42 |
| estimate / conflict | 9 | 9 |
| estimate / partial | 4 | 4 |
| missing / ok | 190 | 42 |
| missing / axis-assumed | 0 | 19 |
| missing / conflict | 0 | 40 |
| missing / partial | 0 | 6 |
| total | 315 | 315 |

Of the 190 researched rows: 55 are now promotable (datasheet or dealer, three axes, confidence ok), 28 are estimates with a size (beta-modelled eligible), 107 stay missing (blocked): 40 conflict, 19 axis order unknown (a figure exists, unlabelled, in the notes), 6 partial, 42 nothing usable (not found, generic rows, cable families, configuration-dependent consoles).

By wave (promotable / beta-modelled / blocked), before in brackets:

| Wave | promotable | beta-modelled | blocked | total |
|---|---|---|---|---|
| 1 | 32 (30) | 11 (11) | 6 (8) | 49 |
| 2 | 45 (35) | 18 (9) | 24 (43) | 87 |
| 3 | 41 (23) | 16 (6) | 35 (63) | 92 |
| 4 | 29 (9) | 5 (1) | 36 (60) | 70 |
| 5 | 6 (1) | 5 (0) | 6 (16) | 17 |
| all | 153 (98) | 55 (27) | 107 (190) | 315 |

By dataQuality and wave (waves 1 to 5): datasheet 25 / 30 / 30 / 22 / 5, dealer 7 / 15 / 11 / 7 / 1, estimate 11 / 18 / 16 / 5 / 5, missing 6 / 24 / 35 / 36 / 6.

Wave 1: **32 promotable, 11 beta-modelled, 6 blocked** (a promotable row is promoted only when its spec also documents the ports). The 6 blocked: radial-j48, k-m-25400, k-m-210-6, k-m-259, sennheiser-ew-100-g4 (a size exists in the notes but its axes are unlabelled) and behringer-ha400 (conflict on width and depth). Blocked share per wave: 12%, 28%, 38%, 51%, 35% (the more-than-half rule now touches only wave 4, 36 of 70; it was 60 of 70).

### Conflict list (40 rows, sizes null, both values in the notes)

- Wave 1: behringer-ha400 (Behringer manuals map width and depth differently).
- Wave 2: behringer-x32 (900 x 528 x 200 vs 900 x 550 x 230 on one dealer page), crown-xls-2502 (10.7 in is 272 mm, 21.2 cm is 212 mm, same page), mackie-1604vlz4 (two Thomann tables), sennheiser-ew-dx-em-2 (189 vs 206 mm in one document), shure-psm-900 (depth 177 labelled vs 166), mackie-big-knob-studio (three dealers vs one outlier), shure-sm81 (« 2 in. » vs 23.5 mm in the sheet), shure-ulx-d-receiver (Shure's mapping puts 42 mm as depth), schoeps-cmc-6-mk-4 (116 vs 138 mm combined), sennheiser-mkh-418-s (Canford 250 mm vs 280 mm), klark-teknik-dn100 (two generations).
- Wave 3: l-acoustics-kara-ii (EN page 733 x 500 x 252 vs FR 701 x 252 x 403 vs ProSoundWeb 734 x 483), avid-protools-sync-x (depth 343 vs 419), drawmer-mc2-1, ebtech-hum-eliminator-he-2, l-acoustics-la4x (depth 420 vs 406), neumann-usm-69-i, rme-m-32-ad (depth 200 vs 242), rode-nt4, rupert-neve-designs-shelford-channel (267 vs 260), spl-phonitor-x (depth 300 vs Thomann 335), allen-heath-ab168, focusrite-rednet-a16r-mkii, jbl-eon715 (702 x 438 x 351 vs 716 x 438 x 358 on one page), l-acoustics-x8 (depth 164 mm vs 10.4 in), schoeps-cmc-6-mk-41, soundcraft-signature-12mtk.
- Wave 4: rack-generic-6u-16u, db-audiotechnik-v8 (depth 460 vs 406 inside d&b's own documents), allen-heath-zed-436, clear-com-freespeak-ii (two Clear-Com sources), lexicon-pcm92, meyer-sound-galileo-galaxy-816, rode-lavalier-ii, tascam-da-6400 (two TASCAM documents), clear-com-fsii-bp24, shure-mx418d, shure-wl93.
- Wave 5: avid-venue-s6l (the sheet prints 36.9 in for 989 mm).

### Notes and deviations

- **Schema relaxed (one rule).** The Wave 0b schema said `partial` exactly when one or two axes are stored. The brief asks for partial results to be kept out of `sizeMm` with `sizeConfidence: partial`, which that rule refuses. It now says: one or two stored axes require `partial`, and `partial` never goes with a complete size (zero stored axes is allowed). `tools/equipmentPlan.ts` and one assertion of `equipmentPlanTraits.test.ts` (the consistency loop) changed; the schema-refusal tests pass unchanged.
- **Conflict rows lose their size.** The 9 rows Wave 0b marked `conflict` keep a size (beta-modelled eligible); the 40 conflicts of this merge store none, as the brief says (Kara II), so they are blocked until a datasheet pass settles them. The held-back values are in the notes, so restoring a size (estimate, beta-modelled) is a one-line decision per row. Where the manufacturer figure is probably right and a dealer is the outlier: spl-phonitor-x, sennheiser-mkh-418-s, shure-sm81, allen-heath-ab168.
- **Keyword hits judged not about the size** (labelled `ok` or `axis-assumed` by `CURATED`): « inferred » about connector counts (shure-axient-digital-ad4d, shure-ua845uwb), weight-only conflicts (allen-heath-sq-6, k-m-26772, lynx-aurora-n, audix-d6), packaging, older revisions or other variants (dpa-4060, neumann-u-67, l-acoustics-ks28, wisycom-mcr54). Rows whose size belongs to a variant the row only assumes are `axis-assumed` (cisco-sg350, netgear-m4250, eaton-5p-1u-ups, ssl-origin, nexo-geo-m10, argosy-universal-workstation). Heights and widths derived from rack units (db-audiotechnik-d80 and d40, nexo-nxamp4x4mk2, canare-162u-x21, avid-protools-mtrx-studio) are `axis-assumed`: derived, not printed.
- **Proposals regenerated.** The plan sizes feed the Bêta proposals (placeholder boxes), so `catalog-proposals.json` was regenerated with `npx tsx tools/propose-content.ts` only (not the whole `sync:kb`); the 15 level drafts it also rewrites (a date) were not kept. The proposal notes of the entries that gained a size carry the new date.
- **Do not run `import-equipment-plan.ts --refresh-sources` on this plan without re-running the merge** (`npx tsx tools/merge-size-research.ts` tops the sources up again; the notes marker keeps the rest idempotent).
- **Unverified.** I did not open any of the 378 URLs: the sizes are the research files' own, and many of those say a page returned 403 or 404 or was read from a search summary; those rows are `axis-assumed` or `conflict`, not `ok`. The merge never reads the `.md` companions of the research files; their prose is in the `notes` field of the JSON.

### Gate numbers (Wave 0c, 2026-11-12)

- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run validate:catalog` valid.
- `npx vitest run tests/tools` with `BLENDER_EXE=D:\Blender\blender.exe`: 53 files, 1269 tests, all passed (the new file has 24). `tests/creation` and `tests/scene/modelIds.test.ts`: 77 files, 1138 tests, all passed (the proposals file changed).
- Not run: `validate:assets`, the full vitest suite, a build and the chunk budget, Playwright. No asset and no `src` file changed, but `src/creation` imports `catalog-proposals.json`, which grew by 83 `sizeMm` objects (a few KB, no new entry): the chunk budget should be re-checked with the next wave build.
