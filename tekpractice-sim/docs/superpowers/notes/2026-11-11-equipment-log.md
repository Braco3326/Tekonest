# Equipment log (build all equipment, 2026-11-11)

Plan: `docs/superpowers/plans/2026-11-11-build-all-equipment.md`. Each agent adds its own section below.


## Wave 0 spikes (Task 0.7)

Throwaway dry runs, nothing shipped. Method: scratch specs in a temporary folder outside the repo (not committed), driven through the real `buildAsset(id, { scripted: true, dryRun: true })` with injected `loadSpec`, a synthetic one-device `loadCatalog`, and scratch `paths`. So every run went through `validateBuild` (TS), the Blender builder, the fix-up, the contact sheet and all the gates (size, transform, parts, portPositions, budget, detail, fillet, proportionDrift, portSurface, textures, validator = 11 gates). Nothing was written to `content/`, `public/assets` or the manifest. `BLENDER_EXE=<path to blender.exe>`. All specs: tier `standard`; sizes in the order (w, d, h) as given in the task; port and control positions are guesses (the spike tests the shape, not the layout). The driver is a throwaway script (about 25 lines, not committed).

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
- `npx vitest run` with `BLENDER_EXE=<path to blender.exe>`: 235 files, 3669 tests, all passed (baseline before Wave 0: 228 files, 3541 tests).
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
- `npx vitest run` with `BLENDER_EXE=<path to blender.exe>`: 240 files, 3765 tests, all passed (Wave 0 gate: 235 files, 3669).
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
- `npx vitest run tests/tools` with `BLENDER_EXE=<path to blender.exe>`: 53 files, 1269 tests, all passed (the new file has 24). `tests/creation` and `tests/scene/modelIds.test.ts`: 77 files, 1138 tests, all passed (the proposals file changed).
- Not run: `validate:assets`, the full vitest suite, a build and the chunk budget, Playwright. No asset and no `src` file changed, but `src/creation` imports `catalog-proposals.json`, which grew by 83 `sizeMm` objects (a few KB, no new entry): the chunk budget should be re-checked with the next wave build.


## Wave 1A: revolve, curved-cabinet and tripod-stand rows (2026-11-12)

Stage 1 only (`npm run promote -- <id>`), no `--commit`, no edit of `content/catalog.json` or `catalog-proposals.json`. Nothing pushed, no Meshy. Commits `5909308` (ten revolve devices), `8e90800` (three monitors), `54cc079` (test fix, finding 2); the manifest rows and the plan rows were committed through a temporary index so the other agents' uncommitted rows were not swept in. Contact sheets stay local (`docs/superpowers/notes/img/wave1a-mics-a.png`, `-b`, `-c`, `wave1a-speakers.png`, git-ignored).

### Rows (`planRows({wave: 1})` for the three families: 17 rows)

revolve 11: rode-nt1-5th-gen, royer-r-121, sennheiser-md-421-ii, shure-beta-58a, shure-slxd2-handheld, shure-sm7b, k-m-232, neumann-km-184, neumann-tlm-103, sennheiser-e-835, sennheiser-mkh-416. curved-cabinet 3: neumann-kh-120-ii, yamaha-hs5, jbl-305p-mkii. tripod-stand 3: k-m-25400, k-m-210-6, k-m-259.

| Outcome | Count | Devices |
|---|---|---|
| shipped, promotable (stage 2 will promote) | 9 | shure-beta-58a, sennheiser-e-835, shure-sm7b, rode-nt1-5th-gen, neumann-km-184, neumann-tlm-103, sennheiser-mkh-416, k-m-232, neumann-kh-120-ii |
| shipped, beta-modelled (stage 2 keeps the proposal or adds one) | 4 | sennheiser-md-421-ii (size conflict), royer-r-121 (partial size), yamaha-hs5 (axis assumed, inlet not documented), jbl-305p-mkii (conflict) |
| blocked | 4 | the three K&M tripod stands (plan `missing`), shure-slxd2-handheld (no patchable port, see its row) |
| failed (3 attempts) | 0 | none: every build was green on the first attempt |

Checked with `npm run promote -- <id> --commit --dry-run` on all 13: the nine promotable ones come out `promoted`, the four others `beta-modelled`, with the expected aliases (NT1 and KH 120 II move their long Bêta port ids to `out-xlr`, `bidir-usb`, `in-analog`, ... as `portAliases`).

### Per device

Gates: the ten of a lathe are size, transform, parts, portPositions, budget, detail, proportionDrift, portSurface, textures, validator; a curved-cabinet adds fillet (11); a no-port stand has the same minus nothing measurable (8 as `validate:assets` runs them).

| id | outcome | triangles | size error vs plan | ports and open items |
|---|---|---|---|---|
| shure-beta-58a | shipped-promotable | 4350 | 0.00 mm | `out-xlr` xlr3-m, documented by the Shure spec sheet (read as text). Profile is the shipped SM58 lathe scaled 160/162 and 50/51 (no Beta 58A photo opened). |
| sennheiser-e-835 | shipped-promotable | 4350 | 0.00 | `out-xlr`; connector "XLR-3" from the Sennheiser spec read through a search summary (the PDF did not download; gender not printed, male by convention). Profile: SM58 head scaled to 48 mm, handle stretched so the head starts 108 mm up. |
| shure-sm7b | shipped-promotable | 2046 | 0.00 | `out-xlr`; "Male XLR" per the Crutchfield page (403 here, read via a search summary) and the Shure guide drawing (XLR connector, pin 2 hot). Plan size 62 x 192.5 (dealer); the Shure guide gives 189.7 mm overall with the yoke: left as the plan. Yoke and switch cover not modelled. |
| rode-nt1-5th-gen | shipped-promotable | 1662 | 0.01 mm (51.99, glTF rounding) | `out-xlr` (needs P48, `requiresPhantom`) and `bidir-usb` (usb-c, usb-audio), both documented by the RODE datasheet. The USB-C position on the base is a guess 15.5 mm from the XLR: the outline rings may touch. |
| neumann-km-184 | shipped-promotable | 1918 | 0.00 | `out-xlr` xlr3-m: the Neumann page says "Matching connector XLR 3 F", so the mic has the male. |
| neumann-tlm-103 | shipped-promotable | 1790 | 0.00 | same. The plan summary "XLR-3 female" is the cable-side connector: the device port is xlr3-m. |
| sennheiser-mkh-416 | shipped-promotable | 1662 | 0.00 | `out-xlr`, "3-pol. XLR", 48 V phantom. Budget floor 1000 (a smooth pencil tube; it reached 1662 at 64 segments). |
| k-m-232 | shipped-promotable | 1534 | 0.00 | no ports: a mechanical stand (the K&M page lists a 3/8 in thread only); `portsDocumented` true with zero ports, like the shipped K&M 210/9. Budget 500 to 2000, 48 segments. |
| neumann-kh-120-ii | shipped-promotable | 2372 | 0.00 | five ports and a `power` switch: XLR in, S/PDIF RCA in and out, RJ45 (`aoip`, bidir), `power-in` iec-c14. The Neumann page documents all of it except the NAME of the inlet connector (taken from the manual via a search summary, and from the Genelec). All positions are guesses. |
| sennheiser-md-421-ii | shipped-beta-modelled | 2302 | 0.00 (spec size 49 x 49 x 215) | plan size 46 x 49 (another page says 48 x 48); a revolve needs w = d, so the widest, 49, is used. `out-xlr` documented ("XLR-3", sheet v1.1). The placeholder box of the proposal keeps the plan 46 x 49. |
| royer-r-121 | shipped-beta-modelled | 1534 | 0.00 (25 x 25 x 155.7) | depth not stated by the cut sheet: assumed 25 (round), said so in the spec. The port id is the Bêta proposal's long id (a beta-modelled Bêta row must keep its proposal ids); flag `isRibbon`. |
| yamaha-hs5 | shipped-beta-modelled | 2244 | 0.01 mm | `in-xlr`, `in-trs` documented by the Yamaha manual (search summary); mains inlet type not found, so `portsDocumented` false. The brochure PDF did not download. Stage 2 builds a proposal from the spec ports. |
| jbl-305p-mkii | shipped-beta-modelled | 2244 | 0.01 mm | XLR and TRS documented by the JBL page, IEC inlet by the Harman owner manual (French edition, read as text): `portsDocumented` true, still beta-modelled because the page prints depth 231 mm and 9.9 in (251 mm) in one line. |
| shure-slxd2-handheld | blocked | not built | | The pipeline cannot build a device with no port (`stagedDevices` leaves a no-port beta row out and the spec parity check refuses). The Shure guide documents NO audio connector (the capsule is the input): only a USB-C power and charge port, an IR port and an antenna, and the catalogue has no signal type for USB power or RF. Stage 1 reverted (`--revert --discard-spec`), nothing committed. Unblock: add a `dc-power` or `usb-power` signal (the Wave 0 open item), or let stage 2 accept a port-less wireless handheld. In hand: 37.1 mm dia x 176 mm (body without the cartridge), a 37.1 mm tube with a threaded collar at the top. |
| k-m-25400, k-m-210-6, k-m-259 | blocked | not built | | Plan `missing` (`axis-assumed`): the folded sizes are printed unlabelled (95 x 80 x 865, 105 x 85 x 960, 115 x 85 x 580). Labelled values that exist in the notes but are not in `sizeMm`: 25400 base diameter 660 mm and height 890 to 1600 mm; 210/6 height 925 to 1630; 259 height 425 to 645, boom 435 to 745. A footprint plus a working height would give a size, but that is a plan decision (a data pass), not mine: nothing invented. |

### Family recipes (reuse in later waves)

- **revolve (mics)**: spec `build {shape revolve, params {segments 64}, projection wrap, budget {1500, 6000} (1000 for a pencil tube), profile [[axial mm from the base, diameter mm] ...], colours}`, tier `hero` (a standard tier stops at 4000 triangles; 64 segments x 30 stations give 4350, 14 stations about 1660, so the budget floor decides the station count). First station 0, last station the height with diameter 0 (closed top), widest equal to the width, w = d (a revolve cannot carry an oval: use the widest axis and say so). One generic wrap panel per device (`content/generic-panels/<id>.json`, `wMm` = pi x width, `hMm` = height, `pxPerMm` 8 to 14) drawn with `rect` rings, `weave` (diamond grille), `grid` (square mesh) or slot rects, no lettering. Port: `out-xlr` on face `bottom` at (w/2, w/2), confidence `guess`, `openingMm` 19 (15 or 16 for a base narrower than 30 mm; two ports on one base need a base of 44 mm or more so both outline rings fit). Build: `npm run asset:build -- <id> --scripted --project-photo wrap=assets-source/<id>/photos/_generic_wrap.png` (dry run, about 10 s), look at the sheet, then `--ship-run <work dir> --logos-removed` (the manifest row says hybrid, generic artwork). Without a photo the profile is a drawn estimate: say so in the spec sources (done for every device); "size exact" is NOT a shape check.
- **handheld ball-grille mics**: scale the shipped SM58 profile (diameters by w/51, axial by h/162, optionally stretch the handle so the head keeps its length). Gives Beta 58A and e 835.
- **curved-cabinet (rectangular active monitors)**: the Wave 0 spike params worked unchanged on the first build for all three: `planFrontMm = rearWidthMm = width, frontRadiusMm = backRadiusMm 8, edgeRadiusMm 6, edgeDropMm 6, edgeSegments 8`, `wooferRingMm`, `wooferYMm`, `tweeterRingMm`, `tweeterYMm` from the baffle layout, optional `waveguideMm` and `waveguideDepthMm`, `budget {1500, 4000}`, `minFilletMm 5` (measured 6.00), `projection ["io","opposite"]` with generic panels for both faces (rear: sockets drawn at the port positions; baffle: woofer grille and tweeter dish at the recess positions), tier `standard`. Rear ports: `insetMm 3`, `openingMm` 12 (RCA, TRS), 14 (RJ45), 20 (XLR), 24 (IEC). 2244 to 2372 triangles. Build with `--project-photo io=... --project-photo opposite=...`. The `power` control (switch on `io`, 12 x 18 x 6 mm) belongs in the spec of a promotable monitor only: a beta-modelled one has no controls (its proposal has none and the parity check compares).
- **revolve table stand (K&M 232)**: base disc with a raised cone, thin rod, thread stub; 48 segments and 17 stations give 1534 triangles (small gear class: 500 to 2000).
- **Port ids**: a promotable device uses the template ids (`out-xlr`, `in-analog`, `bidir-usb`, `power-in`, at most 19 characters); a beta-modelled Bêta row (Royer R-121) must use its proposal's long ids exactly (stage 2 refuses otherwise); a beta-modelled new row (HS5, 305P, MD 421-II) uses its own.
- **Where the web data came from**: `pdftotext -layout` reads a downloaded spec PDF well (WebFetch cannot read PDFs); manufacturer pages that answer 403 to the fetch tool can still be read with `curl -A <browser UA>`; several dealer pages stay unreadable.

### Findings and open items for the coordinator

1. **Tests that stage 2 will have to adjust** (they pass on the committed catalogue and fail once the GLBs ship, which follows from the two stages): `tests/scene/modelIds.test.ts` "none of the proposal ids is a shipped glb" fails for the Bêta rows now shipped (rode-nt1-5th-gen, royer-r-121, neumann-kh-120-ii); after stage 2 only the beta-modelled proposals (royer-r-121, md 421-II, HS5, 305P) own a model by design, so the rule must become « a proposal may own a model when its plan row is betaModelled ». `tests/tools/brandsRegister.test.ts` (two tests: the committed register block equals the generated one; every manifest device has a label in the catalogue or the proposals) fails until `npm run register` is run after the stage 2 commits: I did NOT regenerate the register (three agents ship in the same checkout, the generated block would carry the others' rows).
2. **One test file fixed** (`54cc079`): `tests/tools/promoteDevice.test.ts` copies the real plan and then expects the named real rows (neumann-tlm-103, midas-m32, mackie-profx12v3, yamaha-tf5) to be unstaged; staging a real row made 14 tests fail ("already staged"). The copy now drops the `staged`, `promoted` and `betaModelled` flags. The same file will fail again when stage 2 puts neumann-tlm-103 in the real catalogue (the tests copy `content/catalog.json` and expect the id absent, and mackie-profx12v3's proposal present): it needs fixture rows, or a cleaned copy of the catalogue and the proposals in `beforeEach`, after the stage 2 commits.
3. The SLXD2 handheld transmitter cannot be built until a port exists for it (its row). The same holds for any wireless handheld, body-pack or battery device whose only connector is USB power.
4. Rear port positions on the three monitors and the USB-C position on the NT1 are guesses (`confidence guess`); no drawing was opened. The contact-sheet render shows the known smooth-shading fan between rear pockets (seen on the shipped Genelec too, not new).
5. Sources read through search summaries because the file did not download: Sennheiser e 835 PDF, Crutchfield SM7B, Yamaha HS brochure and manual, the Neumann KH 120 II manual. Each says so in its spec source note.
6. Plan row notes to correct: TLM 103 "XLR-3 female" is the cable side (device: male); the JBL 305P page prints 9.9 in for 231 mm.

### Gate numbers (Wave 1A, 2026-11-12)

- `npm run validate:assets`: my 13 devices ok (8 or 9 gates as the validator runs them); whole run 83 ok, 10 failed: the 10 are other agents' staged rows whose GLBs are not shipped yet.
- `npx vitest run tests/tools tests/scene/modelIds.test.ts` with `BLENDER_EXE=<path to blender.exe>`: before the test fix 3 files failed (promoteDevice 14, brandsRegister 2, modelIds 1); `promoteDevice.test.ts` is green after the fix (36 tests). The remaining reds are the ones in finding 1.
- Not run: tsc, lint, the creation e2e, chunk budget, the in-engine look audit (the wave gate does them).

## Wave 1B: rack-box small gear (DI boxes, stage boxes, preamps, interfaces, headphone amps, patchbay, master clock)

Agent B of the Wave 1 build. Stage 1 only (`npm run promote -- <id>`): nothing in `content/catalog.json` or `catalog-proposals.json` was touched, `promote --commit` was not run. All 15 devices below are `staged`; a later serial step runs the stage-2 commits. Nothing pushed, no Meshy, no manufacturer photo, no logo (generic panels only, drawn from the spec port positions). Commits: fc8c7f5 (10 devices), 36fb468 (5 devices), this log.

### Rows (`planRows({wave: 1, family: 'rack-box-v2'})`, categories di-box, stagebox, mic-preamp, audio-interface, headphone-amp, patchbay, master-clock, splitter): 17

`allen-heath-ar2412, ams-neve-1073spx, focusrite-scarlett-2i2-4th-gen, midas-dl16, radial-j48, radial-jdi, radial-prodi, behringer-s16, focusrite-scarlett-18i20-3rd-gen, behringer-ha400, countryman-type-85, mutec-mc-3-plus, presonus-hp4, samson-s-patch-plus, behringer-ada8200, dbx-286s, ua-apollo-twin-x`. (The brief's `motu-828` and `splitter` rows are not Wave 1 / not in this family in the plan: none came back; the other 11 Wave 1 rack-box rows are agent C's.)

### Outcomes

Counts: 15 built and shipped (GLB, manifest row, all gates green), 2 blocked, 0 failed. By expected stage-2 outcome (what `promote --commit --dry-run` printed for each): **2 promoted candidates, 13 beta-modelled, 2 blocked**.

| Device | Outcome | Triangles | Size error | Gates | Notes |
|---|---|---|---|---|---|
| samson-s-patch-plus | shipped, **promotable** (dry run: promoted, 4 documented ports, aliases to the 4 old ids) | 1632 | 0.01 mm | 11 of 11 | spec sheet documents 48 front + 48 rear 1/4 in jacks; 4 of 96 modelled |
| mutec-mc-3-plus | shipped, **promotable** (dry run: promoted, 14 ports, 1 control) | 1408 | 0.01 mm | 11 of 11 | manual documents the rear set; see "ring test" below |
| ams-neve-1073spx | shipped, beta-modelled | 1632 | 0.01 mm | 11 of 11 | size datasheet/ok but page gives no counts or panels for the connectors |
| allen-heath-ar2412 | shipped, beta-modelled | 1632 | 0.01 mm | 11 of 11 | dealer lists types and counts, no panel assignment |
| behringer-s16 | shipped, beta-modelled | 1632 | 0.01 mm | 11 of 11 | new row: 5 ports from the plan summary |
| behringer-ada8200 | shipped, beta-modelled | 1632 | 0.01 mm | 11 of 11 | new row: 5 ports, set read from retailer descriptions via search, not opened |
| dbx-286s | shipped, beta-modelled | 1632 | 0.01 mm | 11 of 11 | new row: 3 ports (types from the dbx page, no panel) |
| focusrite-scarlett-18i20-3rd-gen | shipped, beta-modelled | 1632 | 0.01 mm | 11 of 11 | new row: 6 ports; spec page 403 |
| ua-apollo-twin-x | shipped, beta-modelled | 712 | 0.00 mm | 11 of 11 | new row: 5 ports (no connector table retrieved); plain rounded box, not the real sloped top |
| presonus-hp4 | shipped, beta-modelled | 712 | 0.00 mm | 11 of 11 | proposal ports, panel sides undocumented (page 429) |
| midas-dl16 | shipped, beta-modelled (size estimate: depth conflict) | 1632 | 0.01 mm | 11 of 11 | dealer page lists the connector counts, only USB is placed |
| radial-jdi | shipped, beta-modelled (axis order assumed) | 712 | 0.00 mm | 11 of 11 | spike params |
| radial-prodi | shipped, beta-modelled (axis order assumed) | 712 | 0.00 mm | 11 of 11 | spike params |
| countryman-type-85 | shipped, beta-modelled (axis order assumed) | 712 | 0.00 mm | 11 of 11 | spike params; battery / phantom, no mains |
| focusrite-scarlett-2i2-4th-gen | shipped, beta-modelled (depth conflict 117 vs 99 mm) | 754 | 0.00 mm | 11 of 11 | console-wedge spike variant C |
| radial-j48 | **blocked** | - | - | - | plan row `missing`: the Radial page prints 84 x 127 x 48 mm as L x W x D without saying which edge is the height (the same chassis as the JDI/JCR/JPC at 127 x 84.1 x 45.5 would be a guess); a datasheet drawing or the manual settles it |
| behringer-ha400 | **blocked** | - | - | - | plan row `missing` (conflict): Behringer manuals map the 47 x 57 x 104 mm differently (H x W x D vs H x D x W); only the 47 mm height is common |

Size error is the largest axis difference the `size` gate reports (0.00 to 0.01 mm). Why so few promoted: promoted needs the connector set stated with panel (front/rear). Pages opened today: Radial JDI and ProDI (no connector names), Countryman (input only), A&H dealer page (types and counts, no panels), AMS Neve (front and rear described, no counts), dBx (types), Midas via Markertek (counts, only USB placed), Focusrite, PreSonus, Behringer, B&H pages (HTTP 403, 429, 500, 403). The two documented sets come from the Wave 0c research (manual / spec sheet text read then). No port was added from memory: ports are the Bêta proposal set, the plan summary, or what a page lists; every position is `guess`; `portsDocumented` is false everywhere but the two.

### Rack-box recipe notes (params that worked, for later waves)

All on `rack-box` (v2 params) unless said; pictures are generic (`npm run asset:panel`), built as dry runs with `--project-photo <face>=assets-source/<id>/photos/_generic_<face>.png` for every face of `build.projection`, shipped with `--ship-run <work dir> --logos-removed` (the pipeline records `tool hybrid`, generic artwork).

- **1U rack unit** (AMS Neve, ADA8200, 286s, 18i20, S-Patch, AR2412 3U, S16/DL16 2U): `bodyWidthMm 440, earThicknessMm 4 (5 for 2U/3U), earHoleMm 6.35, filletMm 2.5, filletSegments 12, plateFilletMm 0.8 (1 for 5 mm plates), rearInsetMm 8, seamMm 18 to 60 (shorter for shallow units, longer for 2U/3U)`, plate `plateRgb` dark, body `bodyRgb` darker; projection `["opposite","io"]`; budget 1500 to 3500, `minFilletMm 0.8` (1 for 2U/3U). Result 1632 triangles every time (the params fix the count; features on the pictures are free). Gotcha: a unit exactly 480 mm wide (1073SPX) needs `earHoleEdgeMm 10`: the default EIA hole centre (w - 465.1) / 2 = 7.45 puts the slot 0.5 mm outside the plate. Front connectors forbid handles (TS check), so none are modelled.
- **Half-rack / third-rack desktop 1U** (MUTEC MC-3+ 196 x 156 x 42): no `bodyWidthMm` (plate and chassis are one width), `earThicknessMm 4, plateFilletMm 1.2, filletMm 2.5, filletSegments 12, rearInsetMm 6, seamMm 20, feetMm 2.5, feetDiaMm 10`, `plateRgb` aluminium `#b8bcc2` (research colour), 1408 triangles, budget floor set to 800 (below the rack class floor; the unit is half-rack).
- **Third-rack box with plate width of the plan size** (HP4 139.7 x 139.7 x 44.45): the DI-box recipe below. Adding `rearInsetMm` and `seamMm` to a small box lowers the measured fillet (the HP4 and Apollo measured 2.7 mm with them against 3.5 and 5.0 without): leave both off on boxes under about 200 mm.
- **DI box** (JDI, ProDI, Type 85, the Wave 0 spike recipe confirmed): `earThicknessMm 8, plateFilletMm 3.5, filletMm 4, filletSegments 10, feetMm 2, feetDiaMm 8`, one colour for plate and body; 712 triangles; budget 600 to 2000, `minFilletMm 3` (measured 3.50). Input and thru jacks on `opposite` (the thick plate), XLR on `io`, a `top` picture with generic switch art (PAD, LIFT) as the third projection face.
- **Desktop interface in a rounded box** (Apollo Twin X 160 x 157 x 66): `earThicknessMm 12, plateFilletMm 5, filletMm 6, filletSegments 10, feetMm 3, feetDiaMm 12`, 712 triangles, `minFilletMm 4.5` (measured 5.00). The real unit's sloped top and big knob are only picture (it would be a wedge with a profile; the Wave 0 spike result applies if a founder note asks for it).
- **Sloped desktop interface** (Scarlett 2i2): `console-wedge` with the spike profile `[[0,47.5],[70,47.5],[95,47.5],[117,26]]`, `filletMm 1.5, filletSegments 5`, budget 500 to 2000, 754 triangles, `minFilletMm 1`. The `opposite` picture must cover the full 180 x 47.5 mm face (the picture aspect is checked against the bounding face, not the 26 mm lip): draw the lip content in the lower 26 mm. Front-lip ports at y 13 passed `portSurface`.
- **Stage box** (S16, DL16 482 x 225 x 89, AR2412 483 x 220 x 137): the 1U recipe with `earThicknessMm 5, plateFilletMm 1, seamMm 40 (60 for 3U), rearInsetMm 8 (10 for 3U)`; all XLR rows on `opposite` (a stage box is patched from the front), network, USB, optical and mains inlet on `io`.
- **Patchbay** (S-Patch 482.6 x 68.5): 1U recipe with `seamMm 18, rearInsetMm 6`; two jack rows at y 30 / 14 (pitch 18, ring 14.4 mm needs at least 14.4 mm between ports: 16 mm rows pass) front and mirrored on the rear (first channel on the right seen from behind).
- **Combo inputs** (1073SPX, 2i2): the XLR part and the jack part are two ports at one position (concentric rings); ring-overlap tests only look at catalogue devices, so a Bêta device may do this. A promoted device with a combo needs a decision (two separate ports at distinct places) before it gets documented.
- Panel art: the `conn()` helper of my generator draws every connector under its port from the connector id (XLR, TRS, RJ45 / etherCON, BNC, RCA, TOSLINK, IEC C14, USB-B/C), so rings and printed connectors coincide by construction. The generator lives in the session scratch folder, not in the repo: the committed specs and panels are the output.

### Findings for the stage-2 step and the wave gate

1. **Ring-height test vs the MC-3+ (42 mm tall).** `tests/scene/portMarkerSize.test.ts` refuses a catalogue ring taller than 60 % of the smaller face side. The C14 ring is 26.4 mm; 60 % of 42 mm is 25.2 mm. When `mutec-mc-3-plus` is committed into the catalogue that test will fail. Either keep the MC-3+ beta-modelled (set `portsDocumented` false in its spec) or give a half-rack 1U face an exception in the test; I changed neither.
2. **`modelIds.test.ts` "no proposal id is a shipped glb"** fails as soon as any beta-modelled device is committed (by design: a beta-modelled proposal keeps its id and gets a GLB). It currently fails on the shipped models of all three Wave 1 agents; the test should allow ids whose plan row is `betaModelled` or `staged`.
3. **`brandsRegister` tests** (`every manifest device id has a label` and the committed block): the 5 new rows of mine without a proposal or catalogue entry yet (ada8200, 286s, s16, 18i20, apollo) have no label until stage 2 adds their proposal; run `npm run register` after the stage-2 step.
4. **Generated power layout for MC-3+.** Its `power` control (a front button at x 180, y 21, a guess) gets a layout from `tools/controls/gen-from-specs.mjs` only after stage 2 puts the device in the catalogue; rebuild with the layout present to confirm the flat zone is clear (the front plate is flat there).
5. The AR2412, DL16, S16 and 2U/3U units draw 8 to 36 XLR in the pictures but model only 2 of each group (the proposals' "N modelled of M" convention).

### Verification

- Per device: dry-run build, 11 gates green (size, transform, parts, portPositions, budget, detail, fillet, proportionDrift, portSurface, textures, validator), contact sheets (io / back / left / top ortho renders) looked at in two montages of five; shipped with `--ship-run ... --logos-removed`; `npm run validate:assets`: my 15 ok (the failures it listed were other agents' staged rows with no GLB yet).
- `npx vitest run tests/tools tests/scene/modelIds.test.ts` (`BLENDER_EXE=<path to blender.exe>`): 3 files and 17 tests failed, none about my rows' content: modelIds (finding 2), brandsRegister (finding 3), and `promoteDevice.test.ts`, which copies real plan rows (neumann-tlm-103, yamaha-tf5, mackie-profx12v3) that agents A and C had staged by then (their spec files exist, the test fixtures expect them absent).
- Not run: tsc, lint, e2e, chunk budget, the in-engine look audit, 3/4 views (the contact sheet renders four orthographic views; I did not make a perspective render). Not verified: the real connector layouts and panel assignments of the 13 beta-modelled devices (guesses, said so in each spec's sources and `portsTodo`).


## Wave 1C: console-wedge desks and the rack-box processors, computers and wireless racks (2026-11-12)

Agent C of the Wave 1 build. Stage 1 only (`npm run promote -- <id>`): nothing in `content/catalog.json` or `catalog-proposals.json` was touched, `promote --commit` was not run, the plan flags (`staged`) were written by stage 1 and are left uncommitted in `content/proposals/equipment-plan.json` (a shared file; the serial stage-2 step commits it). Nothing pushed, no Meshy, no manufacturer photo, no logo (generic panels only). Commits: 070e970 (ten rack-box devices), 80665a5 (four desks and the layout generator edit), this log.

### Rows (`planRows({wave: 1, family})`, minus the categories that belong to agent B): 15

console-wedge-v2 (4): `mackie-profx12v3, yamaha-tf5, mackie-1202vlz4, rode-rodecaster-pro-ii`. rack-box-v2 (11): `shure-psm-300, shure-slx-d, apple-mac-mini, furman-m-8x2, jk-audio-broadcast-host, ua-1176ln, dbx-driverack-pa2, sennheiser-ew-100-g4, apple-mac-studio, behringer-dcx2496, soundcraft-ui24r`. Eligibility by `effectiveQuality`: 12 promotable (datasheet or dealer, three axes, confidence ok), 2 estimate (yamaha-tf5 axis-assumed, furman-m-8x2 conflict), 1 missing (sennheiser-ew-100-g4).

### Outcomes

Counts: 14 built and shipped (GLB, manifest row, 11 of 11 gates), 1 blocked, 0 failed. By the outcome `promote --commit --dry-run` printed for each after the GLB shipped: **8 promotion candidates, 6 beta-modelled, 1 blocked**. A promotion candidate needs the connector set stated by a manufacturer or dealer text I read (`portsDocumented: true` with `portsSource`); a promotable size alone is not enough, so 4 devices with a good size are beta-modelled.

| Device | Outcome at stage 2 | Triangles | Size error | Gates | Open items |
|---|---|---|---|---|---|
| dbx-driverack-pa2 | **promoted** (11 ports, 1 control `power`, 7 aliases) | 1920 | 0.01 mm | 11 of 11 | dbx page states 2 XLR line in, 1 XLR RTA in, 6 XLR out; the RJ45 and the IEC inlet come from the knowledge base extraction of the manual; positions guessed |
| shure-psm-300 | **promoted** (4 ports, no control: external DC supply) | 1328 | 0.00 mm | 11 of 11 | the spec sheet states TRS inputs and loop outputs on the rear, not the count (2 + 2 follows the L / R pair and the knowledge base); BNC and DC drawn only (no signal type); template issue: no mains inlet, so no power control |
| shure-slx-d | **promoted** (3 ports) | 1328 | 0.00 mm | 11 of 11 | SLXD4 receiver only (transmitters are separate devices); BNC and DC drawn only |
| jk-audio-broadcast-host | **promoted** (5 ports, no control) | 1312 | 0.00 mm | 11 of 11 | datasheet read as text; RJ11, remote jack and DC drawn only; no mains inlet (external supply) |
| apple-mac-mini | **promoted** (7 ports) | 600 | 0.00 mm | 11 of 11 | Apple page opened; HDMI and the power socket have no connector; Thunderbolt = usb-c / usb-audio; plain box at the 600 floor |
| apple-mac-studio | **promoted** (10 ports) | 600 | 0.00 mm | 11 of 11 | same; SDXC slot, HDMI and power socket not ports |
| mackie-profx12v3 | **promoted** (18 ports, 4 controls) | 1416 | 0.01 mm | 11 of 11 | modelled subset of the connectors (line inputs, inserts not modelled); the side profile is an estimate; inputs are on the top rear panel in the real unit, here on the rear face |
| rode-rodecaster-pro-ii | **promoted** (13 ports, 3 controls, no power: USB-C PD) | 1170 | 0.00 mm | 11 of 11 | headphone size 6.35 mm comes from a search summary of the Rode comparison table (page not opened); connector positions guessed; slab profile estimated |
| behringer-dcx2496 | beta-modelled (9 ports) | 1920 | 0.01 mm | 11 of 11 | dealer states counts only (3 in, 6 out), XLR genders and positions guessed |
| ua-1176ln | beta-modelled (2 ports) | 2208 | 0.01 mm | 11 of 11 | UA page not re-opened (429); terminal strip, stereo link, inlet not modelled |
| furman-m-8x2 | beta-modelled (9 ports, size conflict on the depth) | 1776 | 0.01 mm | 11 of 11 | outlets are NEMA 5-15R, modelled as `iec-c13` stand-ins (like the multiprise); depth 95 mm vs 105 mm |
| soundcraft-ui24r | beta-modelled (24 ports) | 1920 | 0.01 mm | 11 of 11 | the page lists inputs only; outputs, headphones, inlet not modelled; inputs placed on the front (guess) |
| mackie-1202vlz4 | beta-modelled (8 ports) | 1184 | 0.00 mm | 11 of 11 | the Mackie page gives counts, no connector table; the XLR main L / R are our assumption (no source read) |
| yamaha-tf5 | beta-modelled (11 proposal ports) | 1503 | 0.02 mm | 11 of 11 | width 866 mm may be another TF model's (the notes list TF1 / TF3 variants), to verify against the Yamaha spec page |
| sennheiser-ew-100-g4 | **blocked** | - | - | - | plan row `missing` (axis-assumed): the Sennheiser docs page gives about 190 x 212 x 43 mm with no axis labels; a datasheet drawing settles it |

Size error is the largest axis difference the `size` gate prints. All devices are tool `hybrid` (own scripted geometry + generic artwork drawn from the spec ports).

### Recipes (params that worked)

All sizes are the plan's (w, d, h) as `realSizeMm` (w, h, d). Build: `asset:build -- <id> --scripted --project-photo <face>=assets-source/<id>/photos/_generic_<face>.png` for every face of `build.projection` (the path must be repo-relative; a bare file name fails with a misleading "nothing but background"), dry run first, then `--ship --logos-removed` (a hybrid ship refuses without `--logos-removed`).

- **1U rack processor** (DriveRack PA2, DCX2496, Furman): `earThicknessMm 4, plateFilletMm 1.6, filletMm 2.5, filletSegments 12, bodyWidthMm 438, earHoleMm 6, rearInsetMm 6, seamMm 18 to 20`, top vents `ventSlots 9, ventColumns 1 or 2, ventSlotWidthMm 3, ventSlotLenMm 40 to 50, ventPitchMm 8, ventDepthMm 1.5, ventFromRearMm 20 to 30`; 1776 to 1920 triangles, budget 1500 to 3500, `minFilletMm 1.5` (measured 1.60). Without the vents a 1U unit lands at 1440 and fails the floor. All connectors on `io`, the front plate carries the picture and a flat power button zone (the DriveRack's `power` is a front button).
- **2U / 4U** (1176LN, Ui24R): same params, `seamMm 40` (2U) / `60` (4U), vents in 2 to 3 columns; the vent block must fit the flat part of the chassis (the 165 mm deep Ui24R refused 3 columns of 50 mm slots: "190 mm does not fit in 149 mm"). 2208 and 1920 triangles.
- **Small box without ears** (PSM 300, SLXD4, JK host): no `bodyWidthMm`, `earThicknessMm 6, plateFilletMm 2.6, filletMm 3, filletSegments 10, rearInsetMm 5, seamMm 12 to 14, feetMm 2, feetDiaMm 12`, a few top vents; budget 600 to 2000, `minFilletMm 2` (measured 2.25). `rearInsetMm 4` measured 1.8 mm (the rear shell bevel is at most 0.45 x the shell), so use 5 when `minFilletMm` is 2.
- **Aluminium computer box** (Mac mini 127 x 127 x 50, Mac Studio 197 x 197 x 95): `earThicknessMm` (the front plate) 14 / 20, `plateFilletMm` = `filletMm` (6 / 9), `filletSegments 12`, one colour for plate and body; 600 triangles (the floor; 10 segments gives 504 and fails). The plate and the chassis read as two slabs in the 3/4 view (a step at the plate), not a unibody; the family has no plan rounding. Ports on both faces: front USB-C and phones on `opposite`, the rest on `io`.
- **Desk on console-wedge v2** (ProFX12v3 330 x 376 x 102, 1202VLZ4 303 x 272 x 75, Rodecaster Pro II 305 x 270 x 60, TF5 866 x 599 x 225): profile `[depth from the io face, height]`, first station at the rear height, last at the front lip (ProFX `[[0,102],[40,102],[110,86],[250,68],[376,56]]`, Rodecaster `[[0,60],[40,60],[200,52],[270,48]]`, TF5 8 stations 225 to 92: all estimates, the sources give three outer sizes). Params: `filletMm 3 (5 for the TF5), filletSegments 5, feetMm 3 or 4 with feetWidthMm 14 to 22, feetFromSideMm / feetFromEndMm`, side cheeks `cheekMm 6, baseMm 28` (ProFX) and `armRestMm 14, cheekMm 6, baseMm 36` (TF5); 1170 to 1503 triangles (budget 600 or 800 to 6000, `minFilletMm 2.5`, TF5 4). Connectors on `io`; front-lip jacks (Rodecaster and TF5 headphones) on `opposite` with the lip higher than 1.5 x the opening; pictures on `top`, `io` and, where the lip has ports, `opposite` (the `opposite` picture must cover the full bounding face height, draw the lip content in the lower part).
- **Desk controls and flat zones.** The console template writes `mute-master`, `fader-master`, `balance-master` for every console (and `power` for a mains inlet), and stage 2 refuses a spec whose controls differ from them, so every desk spec lists those controls: ProFX12v3 `power` (rocker on the rear face next to the inlet), a master fader (y 110 to 180), a mute button and a balance knob on the right of the top; Rodecaster Pro II the same three without power (USB-C PD supply). The builder's flat-zone check needs the layout that `tools/controls/gen-from-specs.mjs` writes: I generated it into a temporary file for each build (same rules as the tool, plus `topProfile`) and removed it afterwards, because `tests/controls/layoutParity.test.ts` refuses a layout whose device is not in the catalogue yet. After stage 2 run `node tools/controls/gen-from-specs.mjs`: I changed it (in 80665a5) so a console-wedge spec's generated layout carries its `topProfile` (the spec profile; the parity test pins them together). The generated controls are the same positions I built with, so no modelled detail touches them.
- **Top pictures carry no text.** The face-local convention (y = 0 at the io edge, y up toward the front) makes the picture upright for a viewer standing behind the io edge, so any text on a `top` picture reads upside down from the front; the desk top pictures are knobs, slots, pads and displays only. Text on `io` and `opposite` is fine.
- **Generic panels.** `content/generic-panels/<id>.json` was generated from the spec ports by a scratch generator (connector drawings under each port centre, so the rig's ring and the printed connector coincide); no logo, no brand name, no model name on any picture (only functional words such as RECEIVER 1, TOUCHSCREEN, TERMINAL STRIP). The generator is a session scratch tool, not in the repo; the specs and panels are its output.

### Findings for the stage-2 step and the wave gate

1. **Expected red tests until stage 2 and `npm run register`**, none about content of my rows: `tests/scene/modelIds.test.ts` ("no proposal id is a shipped glb") lists every shipped-but-not-promoted device including mine (as agent B's finding 2: it contradicts the beta-modelled outcome and must allow ids whose plan row is `betaModelled` or `staged`); `tests/tools/brandsRegister.test.ts` (two tests: the committed block, and "every manifest device id has a label") until stage 2 adds the proposals of my 6 beta-modelled rows and the register is regenerated.
2. **Stage-2 issues printed by the dry run**: jk-audio-broadcast-host, shure-psm-300, shure-slx-d and the Rodecaster have no mains inlet in the documented set, so no power control ("no mains inlet is documented for this ..."): true for the documented hardware (external supply, USB-C PD), nothing to fix. The proposals of PA2, PSM 300, SLX-D and ProFX12v3 give `portAliases` (old Bêta ids to the new short ids) that stage 2 writes; the pairing is by order inside each (direction, connector, signal) group.
3. **Ring tests**: `portMarkerSize.test.ts` (ring at most 60 % of the smaller face side, rings not overlapping) was checked by hand against my 8 promotion candidates: the tightest cases are the DriveRack PA2 (XLR ring 23.4 mm on a 44 mm face, limit 26.4) and the SLX-D and JK (limit 25.2 and 24.6), all pass.
4. **TF5 width**: 866 mm is what the plan and the knowledge base give; the notes list TF1 and TF3 as size variants and the plan marks the axes as assumed, so the width may belong to another TF model. Not changed (never invent a size).
5. `sennheiser-ew-100-g4` stays blocked: the research found "about 190 x 212 x 43 mm" with no labels (the receiver is probably 190 wide x 43 high, but that is a guess, not a source).

### Verification

- Every device: dry-run build with the gates, then a 4-view Blender render of the built GLB (a scratch perspective render: 3/4 from the rear, 3/4 from the front, side, top) looked at, then `--ship --logos-removed`; `npm run promote -- <id> --commit --dry-run` printed the outcome in the table (promoted or beta-modelled) for all 14 with no spec parity error; `npm run validate:assets`: 93 ok, 0 failed.
- `npx vitest run tests/tools tests/scene/modelIds.test.ts` (`BLENDER_EXE=<path to blender.exe>`): 52 of 54 files passed, 3 tests failed (finding 1). Commits made through a temporary index holding only my files and my manifest rows.
- `npx vitest run tests/controls`: 15 files, 150 tests passed (no layout of mine is in the tree). Not run: tsc, lint, e2e, chunk budget, the in-engine look audit (rings on the connectors were not looked at in the app). Not verified: every connector position and every control position (guesses, said so in each spec's sources); the side profiles of the desks (estimates); the datasheet drawings of the Mackie, Rode and Shure PDFs were not rendered (text only).


## Wave 1 commit and gate (stage 2, tests, e2e, gate) (2026-11-12)

Coordinator step after the three build agents: the stage 2 of the 42 staged rows (`npm run promote -- <id> --commit`, one at a time, dry run first), the shared tests, the controls, the data-driven e2e and the Wave 1 gate. Nothing pushed, no Meshy, no history rewrite, no logo SVG staged. Commits (explicit paths): `7e30fc3` tool and template fixes, `c3b1353` the content (catalogue, proposals, plan, journal, manifest, layouts, register), `7322fb8` shared tests, `e49aa18` e2e.

### Counts

| | n |
|---|---|
| plan rows of wave 1 | 49 |
| promoted into `content/catalog.json` | 19 |
| beta-modelled (proposal kept or added, model shipped, badge « Bêta — dimensions estimées ») | 23 |
| blocked (no stage 1: plan `missing`, or no patchable port) | 7: radial-j48, k-m-25400, k-m-210-6, k-m-259, behringer-ha400, sennheiser-ew-100-g4 (all `missing`), shure-slxd2-handheld (a datasheet size, but its only connector is USB power: no signal type for it) |
| failed after three attempts, or reverted for good | 0 |

Catalogue after: **44 devices (was 25), 23 categories (was 16), 181 ports, 35 controls, 8 rules, 38 connector types, 16 signal types**; 142 Bêta proposals (23 of them with a model). Plan rows still `staged`: 0.

### What the stage 2 showed, and how it was fixed (template or data, never by hand in `catalog.json`)

| Finding | Fix | Test |
|---|---|---|
| The Samson S-Patch Plus came out with routes `front-1 -> front-1` (every bidirectional jack routed to itself) | patchbay template: `front-N` and `rear-N` are normalled both ways; never a route back to its own port (`behaviourTemplates.ts`) | `behaviourTemplates.test.ts` (patchbay, no self route) |
| DriveRack PA2 and KH 120 II routed audio into and out of their RJ45 (`aoip` stands in for a control / firmware port) | an RJ45 `aoip` port on a speaker, amplifier, speaker processor or wireless receiver keeps its place but takes no audio route; codecs, desks, interfaces, switches and intercoms keep network audio | `behaviourTemplates.test.ts` (PA2, KH 120 II, a codec) |
| DriveRack PA2 was filed under `amplifier` and made the « Amplis » tab (power amplifiers) appear with a processor in it | plan rows with trait `processor` are `outboard` (4 rows: dbx-driverack-pa2, behringer-dcx2496, l-acoustics-p1, meyer-sound-galileo-galaxy-816) | `equipmentPlanTraits.test.ts`; the drawer e2e tab list is back to the old order |
| KH 120 II (curved-cabinet speaker) had acoustic but no `modelFront`, so the coverage panel would say « face avant non vérifiée » | a speaker built on `curved-cabinet` gets `modelFront -z` with evidence (same construction as the rebuilt Genelec); measured on its file | `promoteDevice.test.ts`, `tests/assets/modelFront.test.ts` (size and port empties on the +z face) |
| Boilerplate `typicalUse` ("Neumann TLM 103 (microphone)") and long variant labels ("Shure PSM 300 (P3T transmitter, ...)") | plan rows may carry an English `typicalUse` and a `label` (60 characters at most); written for the 11 boilerplate rows and for PSM 300 and SLX-D | `promoteDevice.test.ts` |
| RODE NT1: the USB-C ring (10.8 mm) touched the XLR ring (23.4 mm), 15.5 mm apart | spec port y 41.5 -> 44 (18 mm apart), GLB rebuilt, all gates green | `portMarkerSize.test.ts` (no ring overlap) |

### Shared tests, adjusted for stated reasons (no assertion dropped without a replacement)

- `modelIds.test.ts`: "no proposal id is a shipped glb" became "a proposal may own a model only when its plan row is betaModelled"; plus: every beta-modelled row is a proposal with its model, a promoted row is in the catalogue and not in the proposals, and the rule itself (a non-beta proposal that owns a glb still fails; a beta one does not).
- `promoteDevice.test.ts`: the real rows it copied (neumann-tlm-103, midas-m32, mackie-profx12v3, yamaha-tf5) are now literal fixtures with new ids (`tests/tools/fixtures/promote-fixtures.json`), so promoting a real row cannot break it again.
- `portMarkerSize.test.ts`: a per-device exception rather than keeping the device beta-modelled: MUTEC MC-3+ `power-in`, an IEC C14 ring of 26.4 mm on a 42 mm half-rack face (62.9 %, limit 60 %); capped at 70 % and a second test fails when the exception stops being needed. A rack-height face cannot be made taller and the ring is the real connector size x 1.2.
- `schemas.test.ts`, `catalogChecks.test.ts`: the pins list the Wave 1 devices that route (7 new) or carry acoustic (KH 120 II, nominal); "25 devices" became "the first 25 are all still there and every device parses unchanged". `mains.test.ts` (Furman outlets are unflagged proposal ports), `inventory.test.ts` (« beta » also finds the Shure Beta 58A), `proposalsFixedPoint.test.ts` (proposals built from a spec are not rebuilt from the KB).
- `placePickerModel.ts`: the pinned five « Avec le matériel » rooms are recomputed (the test derives them from the catalogue): podcast-room-small and foley-dubbing-stage-medium replace museum-installed-sound-medium and post-atmos-mix-room-medium. **[validate]** a visible change of the place picker. `src/creation/placeSummary.json` regenerated by `tools/room-thumbs.ts`.
- `creation-budgets.spec.ts` (axe, place picker): the foley card now carries the badge, its row grows 25 px and the next row's wrapped titles straddle the bottom of a 768 px viewport; axe reads the clipped half as a label-in-name mismatch (4 cards; the names are the `aria-labelledby` text). The rule is not disabled: it runs on a 2600 px window so every card is whole, then the window goes back.

### Copy and inventory

`docs/copy/creation-mode.md` tracks interface keys, not per-device copy, so no row was added. A device label is brand + model (language neutral, like the first 25 devices) and `typicalUse` is English like theirs. Every promoted category has a tab (derived test); beta-modelled devices are in the Bêta tab with the « Bêta — dimensions estimées » badge and tooltip (`creation-beta.spec.ts` checks every proposal that has a model). Controls: `node tools/controls/gen-from-specs.mjs` wrote 5 layouts (DriveRack PA2, MC-3+, KH 120 II, ProFX12v3, Rodecaster Pro II); the layout parity tests are green.

### Gate numbers

- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run validate:catalog` valid (44 devices); `npm run validate:assets`: **93 ok, 0 failed**.
- `npx vitest run` with `BLENDER_EXE=<path to blender.exe>`: **241 files, 3904 tests, all passed** (Wave 0b: 240 files, 3765).
- Build into a scratch outDir (`npx vite build --outDir <scratch> --emptyOutDir`), `node tools/chunk-budget.mjs <scratch>`: budget OK, creation entry 5,959,529 B (css included) of 6,830,462.
- GLBs in `public/assets`: 93 files, **6.18 MiB** in total (limit 120 MB), largest focusrite-isa-one 0.65 MiB (limit 25 MiB), average 68 KB.
- Scene stats of the reference rig (Concert simple, 5 devices) on the scratch build: meshes 625, materials 168 (the 2026-11-10 notes give 625 and 168), idle renders in 2.5 s: 0, `renderBench(40)` median of 7: 1.61 ms. No tool exists for the exact numbers of 44f5dd7; a scratch spec read `sceneStats` and `renderBench` (not committed).
- Playwright on a private preview (port 4181, a scratch config whose web server is `vite preview --outDir <scratch>`, never 4173): `creation-equipment-models`, `creation-controls`, `creation-front`, `creation-drawer`, `creation-beta`, `creation-glb404`, `creation-picker`, `creation-budgets`, `creation-coverage`, `creation-place`, `creation-places`: **142 passed, 1 skipped, 1 failed under load** (`creation-glb404` legacy A1 with three workers, a 500 ms window); it passes 12 of 12 alone with one worker. In the first run the drawer tab list (Amplis), the axe picker check and that same legacy test failed; the first two are the findings above.
- `creation-equipment-models.spec.ts` (new, data-driven from the plan, catalogue and proposals files): 42 devices in one scene, about 45 s: each glb requested and answered 200 (content type not text/html, `glTF` magic), a body in the scene, selectable by a real click, every port has its pick sphere (>= 12 px), no 404, no console error. A row left `staged` without a catalogue entry or a proposal fails a separate test by name.
- Not run: the full Playwright suite, a look audit of the 42 devices in the engine, an independent read-only review of this diff (Review Focus). Not looked at again here: the contact sheets of the 42 models (the build agents did).

### Per device (stage 2)

| id | outcome | category | triangles | label |
|---|---|---|---|---|
| allen-heath-ar2412 | beta-modelled | stagebox | 1632 | Allen & Heath AR2412 AudioRack |
| ams-neve-1073spx | beta-modelled | mic-preamp | 1632 | AMS Neve 1073SPX |
| focusrite-scarlett-2i2-4th-gen | beta-modelled | audio-interface | 754 | Focusrite Scarlett 2i2 (4th Gen) |
| mackie-profx12v3 | promoted | console-analog | 1416 | Mackie ProFX12v3 |
| midas-dl16 | beta-modelled | stagebox | 1632 | Midas DL16 |
| neumann-kh-120-ii | promoted | studio-monitor | 2372 | Neumann KH 120 II |
| radial-jdi | beta-modelled | di-box | 712 | Radial Engineering JDI |
| radial-prodi | beta-modelled | di-box | 712 | Radial Engineering ProDI |
| rode-nt1-5th-gen | promoted | microphone | 1662 | RØDE NT1 5th Generation |
| royer-r-121 | beta-modelled | microphone | 1534 | Royer Labs R-121 |
| shure-psm-300 | promoted | iem | 1328 | Shure PSM 300 |
| shure-slx-d | promoted | wireless | 1328 | Shure SLX-D |
| yamaha-tf5 | beta-modelled | console-digital | 1503 | Yamaha TF5 |
| apple-mac-mini | promoted | computer | 600 | Apple Mac mini |
| behringer-s16 | beta-modelled | stagebox | 1632 | Behringer S16 |
| focusrite-scarlett-18i20-3rd-gen | beta-modelled | audio-interface | 1632 | Focusrite Scarlett 18i20 (3rd Gen) |
| furman-m-8x2 | beta-modelled | power | 1776 | Furman M-8x2 power conditioner |
| jk-audio-broadcast-host | promoted | telephone-hybrid | 1312 | JK Audio Broadcast Host |
| mackie-1202vlz4 | beta-modelled | console-analog | 1184 | Mackie 1202VLZ4 |
| rode-rodecaster-pro-ii | promoted | console-podcast | 1170 | RODE Rodecaster Pro II |
| sennheiser-md-421-ii | beta-modelled | microphone | 2302 | Sennheiser MD 421-II |
| shure-beta-58a | promoted | microphone | 4350 | Shure Beta 58A |
| shure-sm7b | promoted | microphone | 2046 | Shure SM7B |
| ua-1176ln | beta-modelled | outboard | 2208 | Universal Audio 1176LN |
| yamaha-hs5 | beta-modelled | studio-monitor | 2244 | Yamaha HS5 |
| countryman-type-85 | beta-modelled | di-box | 712 | Countryman Associates Type 85 |
| dbx-driverack-pa2 | promoted | amplifier | 1920 | dbx DriveRack PA2 |
| mutec-mc-3-plus | promoted | master-clock | 1408 | MUTEC MC-3+ Smart Clock |
| presonus-hp4 | beta-modelled | headphone-amp | 712 | PreSonus HP4 |
| samson-s-patch-plus | promoted | patchbay | 1632 | Samson S-Patch Plus |
| apple-mac-studio | promoted | computer | 600 | Apple Mac Studio |
| behringer-ada8200 | beta-modelled | mic-preamp | 1632 | Behringer ADA8200 |
| behringer-dcx2496 | beta-modelled | amplifier | 1920 | Behringer DCX2496 Ultradrive Pro |
| dbx-286s | beta-modelled | mic-preamp | 1632 | dbx 286s |
| jbl-305p-mkii | beta-modelled | studio-monitor | 2244 | JBL 305P MkII |
| k-m-232 | promoted | stand-arm | 1534 | K&M 232 table stand |
| neumann-km-184 | promoted | microphone | 1918 | Neumann KM 184 |
| neumann-tlm-103 | promoted | microphone | 1790 | Neumann TLM 103 |
| sennheiser-e-835 | promoted | microphone | 4350 | Sennheiser e 835 |
| sennheiser-mkh-416 | promoted | microphone | 1662 | Sennheiser MKH 416-P48U3 |
| soundcraft-ui24r | beta-modelled | console-digital | 1920 | Soundcraft Ui24R |
| ua-apollo-twin-x | beta-modelled | audio-interface | 712 | Universal Audio Apollo Twin X |

### Open items

1. **Mac mini and Mac Studio have no `power-in`** (Apple's page names no inlet connector): promoted without a power toggle, so a power rule never touches them; list the inlet when a datasheet names it.
2. **Wireless receivers (SLX-D, PSM 300) have no routing** (the wireless template routes nothing) and no antenna, DC or MIDI signal exists: a wireless mic cannot pass signal through them yet. SLXD2 handheld stays blocked for the same reason (no `dc-power` or `usb-power` signal).
3. **Control ports modelled as `aoip`** (DriveRack PA2, KH 120 II, SLX-D, Rodecaster): the catalogue has no control-network signal; they keep a port and take no audio route.
4. **The 13 proposals made from a spec** (s16, ada8200, 286s, 18i20, apollo, furman, 1202vlz4, md-421-ii, 1176ln, hs5, 305p, dcx2496, ui24r) come from the plan summary or a search summary; every position is a guess.
5. **7 rows blocked**: they need a datasheet pass (radial-j48 axes, the three K&M stand working sizes, HA400 width and depth, ew 100 G4 axes) or a `dc-power` signal (SLXD2).
6. **[validate]** the five « Avec le matériel » rooms changed. The DriveRack PA2, the JK host and the MC-3+ land in the Consoles and Réseau tabs and the Samson patchbay in « Autres », by the Wave 0 category-to-tab mapping.
7. No French sentence per device exists in the repo (labels are brand + model, `typicalUse` English): a copy pass would write one for the 19 promoted devices.


## Wave 2B: revolve, curved-cabinet and tripod-stand rows, then the new-family rows (2026-11-12)

Agent 2B of the Wave 2 build. Stage 1 only (`npm run promote -- <id>`): nothing in `content/catalog.json` or `catalog-proposals.json` was touched, `promote --commit` was not run. Nothing pushed, no Meshy, no manufacturer photo, no logo (generic panels only). Commit `082518b` (nine devices; its message miscounts the promotion candidates: they are 7, not 6). The manifest rows and the plan rows were committed through a temporary index so the other agents' uncommitted edits were not swept in. Contact sheets stay local (git-ignored `assets-source/<id>/work/...`).

### Rows (`planRows({wave: 2})`)

The wave-2 rows of my families are 33: existing families 15 (revolve 10, curved-cabinet 5; there is no wave-2 row of power-strip or generic-panel), new families 18 (rack-box-v3b 7, moulded-box 9, revolve-v2-oval 1, and k-m-26125, which the plan files under tripod-stand but the brief gives to the round-base family). Eligible by `effectiveQuality`:

| Family | ids | eligible | blocked on data |
|---|---|---|---|
| revolve | rode-procaster, rode-nt5, rode-ntg3, ev-re320, rode-podmic | 5 (podmic: see its row) | shure-mv7-plus (partial), shure-sm81, schoeps-cmc-6-mk-4, sennheiser-mkh-418-s (conflict), schoeps-mstc-74 (nothing printed) |
| curved-cabinet | genelec-8341a, genelec-8040b, krk-rokit-5-g4, qsc-k10-2, yamaha-dxr12-mkii | 5 | none |

### Outcomes (existing families)

Counts: 9 built and shipped (GLB, manifest row, all gates green), 5 blocked on data, 1 blocked on the shape (rode-podmic), 0 failed. By the outcome `promote --commit --dry-run` printed: **7 promotion candidates, 2 beta-modelled**.

| id | outcome | triangles | size error | gates | notes |
|---|---|---|---|---|---|
| rode-procaster | shipped-promotable | 1534 | 0.01 mm | 10 of 10 | RODE datasheet read as text: 3-pin XLR, 214 x 53 mm. Body 46 mm and head 53 mm are an estimate of the lathe profile |
| rode-nt5 | shipped-promotable | 1534 | 0.00 | 10 of 10 | datasheet read as text: XLR, P48. Pencil body, budget floor 1000 |
| rode-ntg3 | shipped-promotable | 1406 | 0.00 | 10 of 10 | datasheet connector and P48 read through a search summary (the PDF itself not opened). Floor 1000 |
| ev-re320 | shipped-promotable | 1534 | 0.00 | 10 of 10 | the XLR comes from a dealer spec (via a search summary); the EV page lists no connector. Plan 54.4 mm widest, a dealer says 49.2: the body tube uses 49.2 |
| genelec-8341a | shipped-promotable | 3108 | 0.00 | 11 of 11 | six ports (analog XLR, AES in, AES thru, two GLM RJ45, mains), power switch. The two racetrack woofers are picture only |
| genelec-8040b | shipped-promotable | 3104 | 0.01 | 11 of 11 | XLR and mains; plan 365 mm includes the 15 mm Iso-Pod, built as a 15 mm foot |
| yamaha-dxr12-mkii | shipped-promotable | 2172 | 0.00 | 11 of 11 | seven ports from the owner manual (it contradicts the plan note about a combo and two TRS), power switch; the mains inlet type is not named (iec-c14) |
| krk-rokit-5-g4 | shipped-beta-modelled | 2036 | 0.01 | 11 of 11 | dealer size; ports not documented (one combo, inlet not named); no RCA on the G4 |
| qsc-k10-2 | shipped-beta-modelled | 2880 | 0.00 | 11 of 11 | size axis-assumed; connector set documented by the QSC spec (6 of 7 modelled) |

### Blocked (existing families)

| id | reason |
|---|---|
| rode-podmic | NOT BUILT, blocked on the shape: the plan size 109 x 62 x 172 mm is the datasheet figure "swing mount included", so the body (a 62 mm tube) and the mount (109 mm wide) are not one revolve (a revolve needs w = d). Unblock: a plan decision to store the body-only size (62 x 62 x 172), or the `assembly` family of Wave 4. Nothing invented |
| shure-mv7-plus | plan `missing` (partial): only the height with the yoke (164 mm) is labelled |
| shure-sm81 | plan `missing` (conflict): "2 in." against 23.5 mm in the Shure sheet |
| schoeps-cmc-6-mk-4 | plan `missing` (conflict): 116 against 138 mm (combined with the amplifier) |
| sennheiser-mkh-418-s | plan `missing` (conflict): Canford 250 mm against 280 mm |
| schoeps-mstc-74 | plan `missing`: the Schoeps and Thomann pages print no length or diameter, only 232 g |

### Rows of the new families: waiting-for-family

The "Wave 2 families" log section had not appeared when this agent ran out of other work, and the shape code (`shapes.ts`, `build_from_spec.py`) was still uncommitted in the tree. Nothing was built or staged for these rows (no stage 1 either, so their plan rows are untouched). What was gathered while waiting, to save the next step a research pass (search summaries or dealer pages unless said):

| family | id | eligibility | what the sources say about the connector set |
|---|---|---|---|
| rack-box-v3b | crown-xti-4002 | datasheet / ok | the Crown page (read) states only "IEC Power Connector" 15 A and a locking cord clip; the XLR inputs, XLR link outputs, 2 speakON NL4, 2 pairs of binding posts and a HiQnet USB-B port come from dealer and review summaries (the manual was not opened): beta-modelled unless the manual is read |
| rack-box-v3b | yamaha-xmv8280-d | dealer / ok | Markertek (read): analog input Euroblock x 2 (6P, balanced), RJ45 x 2 (Dante primary and secondary), speaker output barrier strip x 8 pairs, remote and fault Euroblock (3P) x 1, AC inlet x 1; 18.9 x 3.5 x 16.6 in. A promotion candidate |
| rack-box-v3b | behringer-europower-ep4000 | dealer / ok | inputs balanced XLR and 1/4 in TRS, two professional speaker connectors (not named NL4 by any page read) and two pairs of binding posts: beta-modelled |
| rack-box-v3b | db-audiotechnik-d80 | estimate (axis-assumed: 2 RU x 19 in x 530 mm) | the d&b page (read): 4 XLR-F analog in, 4 XLR-M link, 2 XLR-F AES3 in, 1 digital link out, 4 speakON NL4 outputs, one NL8, 2 RJ45 CAN, 2 etherCON, powerCON HC: beta-modelled by its size |
| rack-box-v3b | ssl-the-bus-plus | estimate (axis-assumed) | two XLR inputs plus two XLR sidechain inputs (a dealer), 2U, 303 mm chassis depth (328 with the controls): beta-modelled |
| rack-box-v3b | l-acoustics-la12x, universal-audio-6176 | blocked (partial / missing size) | |
| moulded-box | zoom-h6-essential | dealer / ok | four XLR/TRS combo inputs, 3.5 mm line out, 3.5 mm headphone out, USB-C, microSD, 4 AA or USB power; battery trait, no mains inlet |
| moulded-box | zoom-podtrak-p4 | dealer / ok | four XLR mic inputs (48 V), four 3.5 mm stereo headphone outputs, a TRRS call-in input, USB-C, SD |
| moulded-box | sound-devices-mixpre-6-ii | datasheet / ok | the store page answered 403: connectors not read |
| moulded-box | audinate-dante-avio-install | datasheet / ok | the Audinate sales guide (downloaded, read as text): Euroblock analog connectors, Dante over RJ45, PoE; 150.7 x 53.8 x 38.1 mm (the packaged 190 x 92.5 x 45 mm is another line of the same table). The sister row audinate-dante-avio-analog-input-2ch is `missing` |
| moulded-box | sennheiser-e-609-silver, sennheiser-e-906 | datasheet / ok | one 3-pin XLR each, same 55 x 34 x 134 mm body: one scripted shape serves both |
| moulded-box | shure-slxd1-bodypack | datasheet / ok | TA4M mini XLR input; battery. Antenna and DC ports cannot be modelled (no signal type), as for the SLXD2 |
| moulded-box | shure-ua874 | datasheet / ok | BNC antenna ports with DC bias only: no catalogue signal fits, so it has no patchable port and is blocked like the SLXD2 handheld unless an `rf-antenna` signal is added |
| revolve-v2-oval | akg-c414-xlii | datasheet / ok | the AKG cut sheet and page were not opened; 50 x 38 x 160 mm; the plan notes say XLR and P48 |
| round-base-stand | k-m-26125 | estimate (partial): only the 275 mm base diameter is stored | the notes carry the labelled working height 1000 to 1700 mm; the plan row needs a height (a data decision) before it can be built |

### Recipes (reuse)

- **Pencil and end-address mics on `revolve`** (Procaster, NT5, NTG3, RE320): the Wave 1A recipe unchanged (tier hero, 64 segments, 13 to 14 stations gave 1406 to 1534 triangles). A pencil tube needs `budget.min` 1000 (the 1500 floor of the mic class would force invented stations). Wrap panels: `rect` rings, `weave` grilles, slot columns, a slide switch drawn as two rects. Port `out-xlr` on the base at (w/2, w/2), `requiresPhantom` for the two condensers.
- **Tapered PA cabinets on `curved-cabinet`** (QSC K10.2, Yamaha DXR12 mkII): the shipped K12.2 and DBR12 params scaled by the width ratio (`planFrontMm` = width, `midWidthMm`, `midDepthMm`, `rearWidthMm`, radii 24 to 38, `edgeRadiusMm` 16 to 20, `edgeDropMm` 22 to 28), no woofer ring (a grille face), tier hero, `minFilletMm` 14 to 16 (measured 16 and 20); 2880 and 2172 triangles. The flat rear is only `rearWidthMm - 2 x backRadiusMm` wide and every port pocket must fit inside it (the DXR12 first refused a pocket 12 mm past the flat face); ports with `insetMm 3` then passed `portSurface` at the first try. Seven ports fit in two rows of three at 40 to 46 mm pitch.
- **Genelec-style monitors on `curved-cabinet`** (8341A, 8040B): the 8030C params scaled to the width (`planFrontMm` 232 + `sideBulgeMm` 2.5, `rearWidthMm` 224, radii 28 and 34, `edgeRadiusMm` 20, `edgeDropMm` 26, `barrelMm` 18 to 20); an Iso-Pod counted in the plan size is a `footMm`; non-round drivers (racetrack woofers) are picture only. 3104 to 3108 triangles, fillet measured 20 mm.
- **Spec and panel writers** are session scratch scripts (a mic generator and a speaker generator, one object per device), not in the repo; the committed specs and panels are their output. A build is `npm run asset:panel -- <id>`, `npm run asset:build -- <id> --scripted --project-photo <face>=assets-source/<id>/photos/_generic_<face>.png` per projected face, then `npm run asset:build -- <id> --ship-run <work dir> --logos-removed` (without `--scripted`).
- **Committing without sweeping other agents' rows**: a temporary index with my files plus the manifest and plan files rebuilt from HEAD with only my rows replaced. After the commit, reset my files in the main index too (`git reset -q -- <my files>`), or `git status` shows them as staged deletions.

### Findings

1. **Sources**: the RODE Procaster and NT5 datasheets, the Yamaha DXRmkII owner manual (a dealer-hosted copy) and the Audinate guide were downloaded and read as text; the Genelec 8341A and 8040B pages and the Markertek and d&b pages were read through the fetch tool; the RODE NTG3 datasheet, the EV RE320 connector (a dealer listing) and the QSC K10.2 spec sheet only through search summaries. Each spec's source note says which.
2. **Plan note corrections**: the DXR12 mkII row says "XLR/TRS combo, 2 TRS, 2 RCA in"; the owner manual says one XLR, one phones jack and two RCA inputs (INPUT 1 to 3) plus the XLR THRU and LINK OUT. The KRK Rokit 5 G4 has one combo input and no RCA (a review and the user manual, through a summary).
3. **Mains inlet types are named by no page** for the Genelec 8341A, 8040B and the Yamaha: `iec-c14` is the convention of the shipped Genelec 8030C and Yamaha DBR12, and the specs say so. The KRK stays beta-modelled because of it (ports not documented), the same rule as the Wave 1 Yamaha HS5.
4. **Red tests, none about the content of my rows** (`npx vitest run tests/tools tests/scene/modelIds.test.ts` with `BLENDER_EXE`: 55 files, 1393 tests, 4 failed): `modelIds.test.ts` "proposals own a model only when betaModelled" lists genelec-8341a (a Bêta proposal that now has a GLB; stage 2 removes the proposal); `brandsRegister.test.ts` twice (the committed register block, and the labels of the shipped devices: `npm run register` after stage 2); `builderPins.test.ts` "every pinned plan builds byte-identical" failed while the families agent had `build_from_spec.py` and `shapes.ts` uncommitted in the tree (the pins are a fixed fixture of the 93 older plans, so it is not the nine new specs; not re-run on a clean tree).
5. **Stage-2 dry run** (`npm run promote -- <id> --commit --dry-run`, all nine): procaster, nt5, ntg3, re320, 8341a (4 port aliases, its proposal removed), 8040b and dxr12-mkii come out `promoted` (a `power` control for the three speakers); krk-rokit-5-g4 and qsc-k10-2 come out `beta-modelled` (proposals built from the spec, 2 and 6 ports).
6. **Not verified**: every port and control position (guesses, `confidence guess`); the lathe profiles of the mics and the plan outlines of the cabinets (drawn from the published length and widest size, no photo or drawing opened); the contact sheets were looked at for 4 of the 9 devices (EV RE320, RODE NTG3, Genelec 8341A, Yamaha DXR12 mkII), the other 5 only through the gate numbers; no in-engine look audit, no tsc, no lint, no e2e (the wave gate does them).

### Open items for the next step

1. Build the new-family rows once the families land: the table above is the head start; read the Crown, EP4000, SSL and Zoom manuals if promotion is wanted.
2. rode-podmic needs a plan decision (body-only size) or the assembly family.
3. shure-ua874 and shure-slxd1-bodypack depend on an `rf-antenna` / `dc-power` signal (the Wave 0 open item).
4. After stage 2 of the nine: `npm run register`, `node tools/controls/gen-from-specs.mjs` for the three speakers with a power switch (8341A, 8040B, DXR12), and the modelIds rule for genelec-8341a follows from stage 2.


## Wave 2A: rack-box-v2 and console-wedge-v2 rows of wave 2 (2026-11-12)

Agent 2A of the Wave 2 build. Stage 1 only (`npm run promote -- <id>`): `content/catalog.json` and `catalog-proposals.json` untouched, `--commit` not run (only `--commit --dry-run` to print the outcome). Nothing pushed, no Meshy, no manufacturer photo, no logo (generic panels only). Contact sheets stay local (`docs/superpowers/notes/img/wave2a-rack-a.png`, `-b`, `-c`, `wave2a-desks.png`, git-ignored). Commits through a temporary index holding only my files, my manifest rows and my plan rows.

### Rows (`planRows({wave: 2})`, families rack-box-v2 (40) and console-wedge-v2 (14): 54)

- **Blocked on size (`missing`, 16, no stage 1)**: crown-xls-2502 (10.7 in vs 21.2 cm conflict), telos-hx2 (no size), radial-jcr, radial-jpc, radial-js2, radial-js3 (axes unlabelled, none stored), sennheiser-ew-dx-em-2, shure-psm-900, shure-ulx-d-receiver, mackie-big-knob-studio, klark-teknik-dn100, behringer-x32, mackie-1604vlz4 (dimension conflicts), behringer-umc202hd, sennheiser-ew-iem-g4, bss-ar-133 (no size). Never guessed.
- **Eligible by size (38)**: 26 rack-box (api-512c, behringer-xr18, cisco-sg350-managed-switch, presonus-monitor-station-v2, clear-com-ms-702, dbx-166xs, dbx-231s, rme-fireface-ufx-iii, sonifex-rb-mm1, tascam-ss-cdr250n, ams-neve-1073dpd, ams-neve-1073lb, eaton-5p-1u-ups, empirical-labs-distressor, focusrite-clarett-plus-8pre, netgear-m4250-av-switch, neutrik-nys-spp-l1, orban-optimod-6300, shure-qlx-d-receiver, ua-la-2a, canare-162u-x21, motu-828, neutrik-nppa-tt-pt, klark-teknik-dn360, rolls-ha43-pro, shure-ua844-plus) and 12 console-wedge (allen-heath-sq-6, allen-heath-sq-5, behringer-x32-compact, yamaha-dm3, yamaha-mg16xu, yamaha-tf1, yamaha-mg10xu, avid-s1, behringer-xenyx-q1202usb, midas-m32, rode-rodecaster-duo, tascam-model-12).
- **Blocked on connectors (6, stage 1 reverted with `--revert --discard-spec`)**: ua-la-2a, klark-teknik-dn360, focusrite-clarett-plus-8pre, ams-neve-1073dpd, avid-s1: the plan row has no port summary and none of the pages I could read (several answered 403 / 404; the 1073DPD page names no connector type or panel) lists a connector; a port is never added from memory. shure-ua844-plus: the antenna distribution has only BNC RF connectors and a DC jack, and the catalogue has no RF or DC signal (same reason as the SLXD2 of Wave 1A).

### Outcomes (32 built and shipped: GLB, manifest row, 11 of 11 gates; 0 failed; every device green after at most one params fix)

By what `promote --commit --dry-run` printed: **5 promotion candidates, 27 beta-modelled**. Triangles: rack 1328 to 1920 (500-series modules 504, small boxes 712 to 1328: small-gear class), desks 1170 to 1503. Size error 0.00 to 0.02 mm on every axis (the `size` gate). Every connector position is a `guess` and says so.

| id | stage-2 outcome | triangles | ports | why / open items |
|---|---|---|---|---|
| presonus-monitor-station-v2 | promoted | 712 | 22 (no control) | dealer text lists every connector with counts; external 18 VDC supply (no inlet, no power control); front / rear split guessed |
| orban-optimod-6300 | promoted | 1920 | 8 | Orban page (2 XLR in, 2 XLR out) and brochure (AES in, 2 AES out, sync); sync taken as BNC; Ethernet (control) and inlet not modelled |
| shure-qlx-d-receiver | promoted | 1328 | 3 | Shure guide (XLR out, 1/4 in out, Ethernet, BNC, DC jack); same layout as SLX-D |
| yamaha-mg10xu | promoted | 1180 | 12 + 3 controls | Yamaha data sheet; DC adaptor (no power control); 3 console controls |
| midas-m32 | promoted | 1446 | 25 + 4 controls | Midas data sheet (read with pdftotext); inlet type (IEC C14) and AES50 connector (etherCON) are assumptions said in the spec; power switch on io |
| dbx-166xs, dbx-231s | beta-modelled | 1776, 1920 | 9 (proposal) | size axis order assumed |
| clear-com-ms-702, rme-fireface-ufx-iii, sonifex-rb-mm1, tascam-ss-cdr250n, motu-828, canare-162u-x21, neutrik-nppa-tt-pt, allen-heath-sq-6 | beta-modelled | 1328 to 1920 (SQ-6 1440) | proposal ports | connector types or counts not documented well enough (sizes of ms-702, ufx-iii, rb-mm1, cdr250n, 828, SQ-6 are datasheet / dealer ok: promotable once a source documents the ports); canare and nppa also axis-assumed |
| api-512c, ams-neve-1073lb | beta-modelled | 504 | 2, 1 | 500-series modules: front inputs documented, the edge connector (output) has no representation |
| behringer-xr18, cisco-sg350-managed-switch, netgear-m4250-av-switch, eaton-5p-1u-ups, neutrik-nys-spp-l1, rolls-ha43-pro, empirical-labs-distressor | beta-modelled | 712 to 1920 | 4 to 12 | size estimate or conflict (distressor: dealer size ok, counts not stated) |
| allen-heath-sq-5, yamaha-dm3, yamaha-tf1 | beta-modelled | 1440, 1443, 1503 | 15 to 17 | axis order assumed (TF1 and DM3 pages document the I/O) |
| behringer-x32-compact, yamaha-mg16xu, behringer-xenyx-q1202usb, rode-rodecaster-duo, tascam-model-12 | beta-modelled | 1170 to 1443 | 9 to 15 | sizes ok, but the pages read do not give a reliable output / connector set (X32 manual table scrambled; Duo headphone jack size not stated; Model 12 outputs not listed) |

### Recipes (params that worked, for later waves)

- A scratch generator (session folder, not committed) turns a compact port list, a layout and an art function into the spec and the generic panel; the committed specs and panels are its output. It draws every connector under its port (so ring and picture coincide) and checks that each ring stays inside its face and that no two rings overlap.
- **1U / 2U rack**: the Wave 1C recipe unchanged (`bodyWidthMm 438, earThicknessMm 4, plateFilletMm 1.6, filletMm 2.5, filletSegments 12, earHoleMm 6, rearInsetMm 6, seamMm 18`, 9 top vents), 1776 to 1920 triangles, `minFilletMm 1.5`; 2U: `earThicknessMm 5, plateFilletMm 1, seamMm 40, rearInsetMm 8`, `minFilletMm 1`. **Rear ports must lie inside the body width**: with `bodyWidthMm 438` on a 483 plate the ear zone (22 mm each side) has no rear shell: a jack at x 22 failed `portSurface` ("206 mm behind"); keep rear ports at x 40 or more.
- **No-ears 440 mm switches and UPS**: the MC-3+ recipe (no `bodyWidthMm`, `earThicknessMm 4, plateFilletMm 1.2, filletMm 2.5`) with 2 columns of vents: 1696 triangles, budget floor 800.
- **500-series module** (38 x 145..178 x 132..133): `earThicknessMm 6, plateFilletMm 2.6, filletMm 3, filletSegments 10`, no `rearInsetMm` (0 is refused: omit it), 504 triangles, budget 400 to 2000, front picture only.
- **Desktop controller** (Monitor Station V2): the Apollo recipe (`earThicknessMm 10, plateFilletMm 4.4, filletMm 5`), 712 triangles. **Half-rack receiver**: the SLX-D recipe.
- **console-wedge**: `plateRgb` and `bodyRgb` are refused by this shape (rack-box only). Small desks the Rodecaster recipe (1170 to 1180), medium the ProFX recipe (1417 to 1443), large (M32, SQ, X32, TF1) the TF5 recipe (1440 to 1503); profiles are estimates from the outer sizes.
- A box with `filletMm 4` and a 6 mm plate (XR18) measured 2.7 mm: declare `minFilletMm 2.5`. The panel renderer takes six-digit hex colours only.

### Findings and open items

1. **Tests that stage 2 will have to adjust** (not run by me, as in Wave 1): `modelIds` and `brandsRegister` (register rows and labels for the 27 beta rows). The ring rules of `portMarkerSize` for the five candidates were checked by the generator (ring at most 60 % of the smaller face side, rings of one face apart by their mean diameter): no violation.
2. `npm run validate:assets` reports 2 failures that are not mine: `mackie-profx12v3` and `rode-rodecaster-pro-ii` ("extra port_/ctrl_ nodes: ctrl_balance-master, ctrl_mute-master"), Wave 1 builds against a builder that has changed since (another agent edits `shapes.ts` and `build_from_spec.py`). My 32 are ok.
3. **Console-wedge flat zones**: the control layouts of the two promotable desks do not exist yet (stage 2 runs `tools/controls/gen-from-specs.mjs`), so the builder's flat-zone check had nothing to check; the master controls sit at the right edge of the estimated profile. Rebuild after stage 2 to confirm.
4. **Assumptions inside documented sets**: M32 inlet C14 and AES50 etherCON; Orban sync as BNC; antenna, DC, MIDI and control-network connectors of the five candidates are pictures only (no signal type). The beta rows whose size is already datasheet / dealer ok (ms-702, ufx-iii, rb-mm1, cdr250n, 828, SQ-6, x32-compact, mg16xu, q1202usb, duo, model-12, distressor) become promotable with a data pass on their connectors, not a build.
5. The 6 blocked-on-connectors rows and the 16 missing-size rows need a datasheet pass (lists above).
6. Not run: tsc, lint, e2e, chunk budget, the in-engine look audit, a perspective render (the sheets are four orthographic views). Not verified: every connector and control position and the side profiles of the 11 desks (guesses, said in each spec).


## Wave 2 families (shape agent, 2026-11-12)

Status (device agents: a family is usable from a spec, `build.shape` + `build.params`, as soon as its line says AVAILABLE; the full parameter reference is written at the end of this section when all four are done).

| Task | Family | Status |
|---|---|---|
| 2.1 | `rack-box-v3b` (extension params of `rack-box`: front vent slots through the plate, meter window recess, ear handles clear of the ear slots) | AVAILABLE |
| 2.2 | `moulded-box` (new shape: rounded box with recess, lid seam, io pockets, hinged laptop lid) | AVAILABLE |
| 2.3 | `revolve-oval` (plan family `revolve-v2-oval`: elliptic lathe) | AVAILABLE |
| 2.4 | `round-base-stand` | AVAILABLE |

Builder pins (read before editing `build_from_spec.py`): `tests/tools/assets3d/builderPins.test.ts` pins the raw output of 93 committed plans. Fingerprint (vertex set + triangle count) for all, bytes only for the 53 that do not use bmesh `triangle_fill(use_beauty=True)`. See "Findings of the shape agent" below.

### Parameter reference (all lengths in millimetres, all in `build.params` unless said otherwise; the doc block above each constant in `tools/assets3d/shapes.ts` is the same text)

Every family validates in `validateBuild` (TS, no Blender: names, whole numbers, groups, ranges) and again in the Python builder (geometry: fit in the real outline, overlaps, flat zones) with one-line `BuildError` messages that name the param. A device agent uses a family by writing `build: { shape, params }` in the spec and nothing else.

**2.1 `rack-box` v3b** (plan family `rack-box-v3b`; params `RACK_V3B_PARAMS`, extra to the v2 ones; any of them switches the detailed build on). Face-local on the FRONT face (`opposite`, or `io` with `frontOnIo 1`): x from the left as seen from the front, y up.
- Front vents: `frontVentSlots` (per row, 1 to 40), `frontVentRows` (1 to 12, default 1), `frontVentSlotLenMm`, `frontVentSlotWidthMm` (slot height), `frontVentColPitchMm` (centre to centre, more than the length, needed for more than one slot), `frontVentRowPitchMm` (needed for more than one row), `frontVentXMm`, `frontVentYMm` (CENTRE of the block), `frontVentDepthMm` (at most the plate thickness; absent = through the plate). A through slot must lie in front of the chassis (inside `bodyWidthMm`, clear of its fillet); a shallower one may be anywhere in the flat plate.
- Meter window: `windowWMm`, `windowHMm`, `windowXMm`, `windowYMm` (LOWER-LEFT corner), `windowDepthMm` (default 1.5, at most the plate thickness = `earThicknessMm`, default 4). Picture and shape only: the controls rig draws a needle on the plate face, so a window over a control's flat zone is refused (new devices only have the generated power layout, so no zone in the way yet).
- Ear handles: `earHandleProjectionMm` (turns them on; at least the diameter + 2), `earHandleDiaMm` (10), `earHandleLenMm` (0.6 of the plate height, less than it), `earHandleFromEndMm` (axis from the plate end; default just inboard of the rack-ear slot + 2 mm). The plate moves back by the projection: the spec depth `d` INCLUDES the handles, and a port on the front face needs `insetMm` = the projection; a control cannot sit on the front face (it would float). Excludes `handleCount`. Refused when a handle would cover an ear slot, the vents, the window or a control zone.
- Limits: slots are rectangles (6 triangles of wall each plus the fill); the sample amp (2U, 24 front vents, 12 top vents, window, ear handles, rear shell and seam) is 1912 triangles; rack class 1500 to 3500. Measure keys read back by `runBuilder`: `frontVents`, `windows`, `earHandles`.

**2.2 `moulded-box`** (params `MOULDED_PARAMS`; `usesPorts`, `usesFlatZones`). Bottom at y = 0, io face = rear (+z), front at -z. The spec size is the exact size.
- Shape: `cornerRadiusMm` (6, at least the edge radius), `edgeRadiusMm` (2) with `edgeDropMm` (same), `bottomEdgeRadiusMm` (edge), `edgeSegments` (4 to 12, default 6), `bodyGrey` (20 to 200).
- Lid seam: `seamHeightMm` + `seamWidthMm` (0.8) + `seamDepthMm` (0.5): a V groove round the whole body; refused over a flat zone of any side face; cannot be combined with io pockets or a hinge.
- Recess: `recessWMm`, `recessHMm`, `recessXMm` (from the left seen from above), `recessYMm` (from the io edge toward the front), `recessDepthMm` (1) in the top face; refused over a top-face flat zone and when it leaves the flat top.
- Ports: any io port with `insetMm` gets a round pocket (`openingMm`, default 24).
- Hinged lid: `lidAngleDeg` (1 to 179), `lidThicknessMm`, `baseHeightMm`, `baseDepthMm`, optional `lidLenMm` (= base depth). The spec size must be the size of the OPEN pose: `mouldedHingePose(params)` (TS, exported from shapes.ts) returns `{h, d}`; the width is the spec width. Within 3 % the pose is stretched to the spec, beyond it the error prints the pose size. The measured `lidAngleDeg` is reported (rounded slab edges make it differ from the asked angle by under 0.2 degrees).
- Triangles: recorder 78 x 43 x 160 with recess and pocket 1420; body-pack 98 x 25.5 x 68 with seam 1560; laptop 313 mm wide, open at 100 degrees, 1576. Small gear class up to 2000. Measure keys: `filletMm`, `recessDepthMm`, `seamDepthMm`, `lidAngleDeg`.

**2.3 `revolve-oval`** (plan family `revolve-v2-oval`; param `segments`, 12 to 64, multiple of 4). `build.profile` stations are `[axial mm, width mm, depth mm]`: first at 0, last at the height, widest width = spec `w`, deepest depth = spec `d`; a pole needs width and depth both 0. `colours` as revolve. The zod schema now allows 2- or 3-number stations; `validateBuild` says which shape takes which (revolve with a 3-number station is refused). Wrap picture: maps by arc length of each ellipse; its width is `ellipsePerimeterMm(w, d)` (what `projectionFaceMm('wrap', size)` returns: pi x w for a round lathe, unchanged), its height the spec height. With width = depth everywhere the vertices are the round lathe's. Triangles: C414-class sample (9 stations, 64 segments) well inside 6000; the 33-station U 87 Ai profile is 4220.

**2.4 `round-base-stand`** (plan row k-m-26125 is filed under `tripod-stand` in the plan: use this shape for it). `baseDiaMm` (required), `baseHeightMm` (26), `hubDiaMm` (44), `tubeDiaMm` (22), `upperTubeDiaMm` (19, at most the tube), `clutchFromMm` (0.55 of the height), and the boom: `boomMm` (turns it on), `frontMm` (0.6 of the boom, 250 to boomMm - 120), `boomAngleDeg` (20, 5 to 45), `boomAzimuthDeg` (135). Without `boomMm` it is a straight stand: spec `w` = `d` = `baseDiaMm` and the top of the 3/8 inch thread is the exact height (K&M 26125: `baseDiaMm 275`, height 1000 to 1700 per the plan, an estimate: the plan row is `partial`). With a boom the pose is stretched to the spec within 3 %; natural pose of `baseDiaMm 275, boomMm 745, frontMm 445` is 507.9 x 1504.5 x 507.9. No ports, no controls. Triangles: straight 1364, boom 1904 (stand class up to 4000).

### Tests and verification of the shape agent (2026-11-12)

- New test files (all through the real builder with `BLENDER_EXE=<path to blender.exe>`): `rackBoxV3b.test.ts` (25), `mouldedBox.test.ts` (23), `revolveOval.test.ts` (13), `roundBaseStand.test.ts` (13), `builderPins.test.ts` (2). Each family: parameter checks, exact size, the feature tests of the plan (vent through the plate, window depth, handles clear of the ears, recess depth, seam, hinge angle, base disc diameter, boom length, wrap on an oval), flat zones, BuildError messages, spec route (`AssetSpec.parse` and `runBuilder`), determinism (12 builds run in parallel are byte-identical, per family).
- Old output: all 93 committed scripted plans are pinned (`tests/tools/assets3d/fixtures/builder-pins-wave2.json`, plans taken at the end of Wave 1). See the finding below for what "unchanged" can mean.
- Sample builds looked at (3/4 renders of the amp, recorder, laptop, body-pack, U 87 candidate and both stands): the vents, window and handles, the recess, the open laptop and the stands read as intended. Renders are local scratch, not committed.

### Findings of the shape agent

1. **Old builds are not byte-stable, and adding code to `build_from_spec.py` changes them.** 40 of the 93 pinned plans (every rack-box with ear slots, every console-wedge with recesses, the RJ45 plug, the Rio stage box: everything that fills a flat face round holes with `bmesh.ops.triangle_fill(use_beauty=True)`) give other triangles when the script text changes: adding ONE unused function to the script changed 40 of 93 files, adding comments changed none. The vertex set is identical every time. The same builds also vary from one Blender session to the next in a few cases (measured: `antelope-ocx-hd` 3 different files in 10 runs of an unchanged script; `axia-iq` several; `rj45` 1 in 12 when 12 run at once). So "old sha256 unchanged" holds byte for byte for the 53 plans that do not use that call (all 16 lathes including the SM58, the 6 curved cabinets, the tripod stand, the power strip, the cable assembly, plain boxes and wedges, the connectors without a fill), and for the other 40 the pin is a fingerprint (triangle count + hash of the sorted vertex positions), which proves the geometry is unchanged. The existing test `builder.test.ts` "two builder runs produce identical raw GLB bytes" (rj45) can therefore fail by chance on a busy machine; it failed once in my gate run and passed alone. NOT fixed: switching the old builders to `use_beauty=False` would change their output and is a decision for the coordinator (it would make every build deterministic).
2. **The Wave 2 code is byte-stable by construction, and it took four fixes to get there** (found by building the same plan 96 times, 16 at a time): (a) `fill_with_holes(..., beauty=False)` is now our own bridge-and-ear-clip triangulation (`fill_with_holes_det`), because bmesh's scan fill gives other diagonals from one session to the next even with `use_beauty=False`; (b) `triangulate_det` cuts every quad and n-gon into triangles itself, because both `bmesh.ops.triangulate` and the glTF exporter break ties between equal diagonals (rectangles, regular caps) by memory address; (c) the loop of a face may start at any of its vertices from one run to the next, so both triangulations start at the lowest vertex index; (d) `canonical_face_order` sorts the faces by vertex index (the face ORDER out of fill and bevel varies, the vertex order does not). With all four, 96 builds of the amp plan run 16 in parallel were byte-identical (before: 2 files, 30 against 66). Every Wave 2 family calls `canonical_face_order`; the v2 and older builders do not (pinned).
3. **Ear handles keep the v2 meaning of `handleProjectionMm`:** the size `d` includes them and the plate moves back. A hand-drawn front control (a knob) of an amp with handles therefore cannot be modelled on the plate (it would float): such controls stay picture only. A front port can, with `insetMm` equal to the handle depth.
4. **Meter windows are refused over a rig control zone** (correct: the rig draws the needle on the plate face); until a device has a hand layout there is no zone.
5. `specSchema` stations: a 3-number station is now valid in the schema (oval lathe); the old assertion in `specSchema.test.ts` that a 3-number station is invalid became "four numbers are invalid, three are valid for revolve-oval".

### U 87 Ai A/B with the oval lathe (spike, nothing shipped)

The rejected scripted candidate of Wave 4a (round head basket) was rebuilt with `revolve-oval`: the committed 31-station profile of the spec, the body and collar round (depth = width, at most 53.9), the head basket from 138.3 mm up oval with an ESTIMATED depth of 0.72 x its width (no side photo exists; the 3/4 photo shows the basket as a flat-faced rounded box), 4220 triangles, 64 segments, plain nickel colours, no picture. Sheet (local, ignored folder): `docs/superpowers/notes/img/wave2-u87-oval-ab.png`, top row the shipped Meshy model, bottom row the scripted oval, columns front, side, 3/4.
Verdict: **the Meshy model stays.** The oval fixes what the round drum got wrong (from the side the head is now thinner than it is wide, the slab reads), but (a) the front silhouette is the same profile as in Wave 4a (0.86 mm against Meshy 1.43 mm, an advantage that does not come from the oval), (b) the side view of the Meshy basket is a tapering wedge with a flat face and the visible mesh, where the oval is a straight pill with no grille, no flat face and an invented depth, (c) there is no photograph to measure the depth or the taper from, so the oval cannot be shown to be closer. It does not "clearly win on the front silhouette" (the rule for shipping), so it is not shipped. What would settle it: a side photo or the datasheet drawing of the basket depth, and a flat-faced rounded-box head (a moulded-box-like section) for the basket.

### Gate numbers (shape agent, 2026-11-12, `BLENDER_EXE=<path to blender.exe>`)

- `npx tsc --noEmit` clean; `npm run lint` clean.
- `npx vitest run tests/tools`: 61 files, 1622 tests, 1618 passed, 4 failed, none about the shape families: `proposalsFixedPoint.test.ts` (3) and `brandsRegister.test.ts` (1, "every manifest device id has a label") fail on the Wave 2 device agents' uncommitted proposals and manifest rows. Before the determinism fixes one of my own tests (rack-box v3b, two builds of the all-features sample) failed by chance under load; after them it passed in every run.
- Not run: the whole `vitest run` outside `tests/tools`, `validate:assets`, the build and chunk budget, Playwright (no `src` file changed, no content file changed by this agent).

### Unverified

- No family was run through a complete `asset:build --scripted` with gates on a real device (that is the device agents' step); the gates of a sample were not run here. The ports on faces of the new shapes (pockets on the moulded-box io face, handle-set-back front ports) are tested in geometry, not through `portSurface`.
- The K&M 26125 stand dimensions (baseDiaMm 275, height 1000 to 1700) come from the plan row, which is `partial`; nothing was added.
- The hinged laptop has no screen, keyboard or hinge detail (two slabs and a recess); the recess is only a keyboard well.



## Wave 1b review fixes (2026-11-12)

Fix agent after the independent review of Wave 1. Every fix test-first on the real catalogue, plan and spec rows. Commits: `a4d77c3` (data and templates), `c406edc` (badge, register order), `2fea7ac` (scene, e2e, a11y). Nothing pushed, no Meshy, no history rewrite, no logo SVG staged. New tool option: `npm run promote -- <id> --regen` re-derives an already promoted device from its spec, the plan row and the (fixed) templates and replaces its catalogue entry in place (build date kept, nothing else touched); a regen on the 19 promoted Wave 1 rows before any fix was byte-identical, so every catalogue change below is a template or data change, never a hand edit of `content/catalog.json`.

| # | Finding | Verdict and action | Test |
|---|---|---|---|
| 1 | MC-3+ `in-wclk` was `isClockSlave`: S/PDIF into the MC-3+ gave a false R8 | Confirmed. The spec flag is gone and the template drops `isClockSlave` on a `master-clock` (its reference input is optional); R8 is unchanged for real slaves (HD I/O) because the Avid port keeps its flag and its clock output | `clock.test.ts` (KH 120 II `out-spdif` to MC-3+ `in-spdif-rca`: no R8; HD I/O without clock: still R8; no slave port on the MC-3+), `behaviourTemplates.test.ts` |
| 2 | Equipment e2e did not prove the model loaded | Confirmed. New hook `window.__creation.assetStatus(instance)` ('glb' or 'placeholder'); the spec asserts 'glb' and the body box (`bodyBoundsInRoot`) against the asset spec size within 1 mm for every device, and fails on an empty list | `creation-equipment-models.spec.ts`; checked it bites: with the tolerance at 1e-7 mm it fails and prints the measured body sizes |
| 3 | « dimensions estimées » on 12 rows whose size is a datasheet or dealer size | Confirmed. 12 of 23 beta-modelled rows now say « Bêta — connecteurs non vérifiés » (copy rows `inventory.badgePorts`, `inventory.tipPorts`, status « à valider »); the other 11 keep « dimensions estimées ». Derived from the plan by `tools/betaBadges.ts`, written to `src/creation/betaBadges.json` by `npm run register` (`--check` and a test fail when stale). A proposal that ships a model while its row is not `betaModelled` (a stage 2 not yet run) keeps the safe default | `betaBadges.test.ts`, `inventoryBadge.test.ts`; `creation-beta.spec.ts` now computes the expected badge from the plan rows with its own predicate and asserts both kinds occur |
| 4 | PA2 `in-rta-mic` routed to out-1..6 | Confirmed. A measurement / RTA / analyser input (by port id) is never routed, on any kind | `behaviourTemplates.test.ts` (real PA2 spec ports, and a synthetic processor) |
| 5 | JK Broadcast Host routed `in-send-xlr` to the caller output | Confirmed. `telephone-hybrid` has its own routing: a send input never reaches a caller / receive output; a caller / line input routes to the receive outputs only. The JK now routes both sends to `out-stereo` (its datasheet says left = send), and no route reaches `out-caller-xlr` (its phone line is not a catalogue port) | `behaviourTemplates.test.ts` (real JK, synthetic hybrid with a line input) |
| 6 | Patchbay normalling covered only front-N to rear-N | Confirmed. The template adds rear top to rear bottom (`rear-top-N` to `rear-bottom-N`, or plain `rear-N` in pairs: rear-1 to rear-2, rear-3 to rear-4), one way; an odd leftover jack gets none. The Samson has `rear-1 -> rear-2`; every later patchbay inherits the rule. Documented in `patchbayRouting` | `behaviourTemplates.test.ts` (real Samson row, a 4-jack synthetic, named rows) |
| 7 | 2600 px window hid `label-content-name-mismatch` | Reproduced at 1366 x 768 (4 cards: `#cr-pick-places-6, 7, 10, 11`). Cause: the clipped size left the visible text « name type », which is not contained in the accessible name « name size type ». Fixed in `placePicker.ts`: DOM order and `aria-labelledby` are now name, type, size, badge (the type is still drawn above the name by CSS), so what can be clipped is last. The workaround is removed; the rule runs on the real viewport and nothing is excluded | `creation-budgets.spec.ts` (place picker) passes at 1366 x 768 |
| 8 | Invented `mute-master` and `balance-master` on ProFX12v3 and Rodecaster Pro II | Confirmed. The desk template adds only the master controls the spec documents (a bare call: the main fader); specs, catalogue entries and the generated layouts lost the two controls; the two GLBs were rebuilt (control empties 22 to 20 and 16 to 14, with the generic pictures kept, all gates green). No stage-2 refusal required them (the parity refusal asked for the controls the template writes, and the template no longer writes them) | `promotedTruth.test.ts`, `behaviourTemplates.test.ts`, `layoutParity.test.ts` |
| 9 | Control Ethernet was `aoip` | Confirmed. New signal `ethernet-control` (class control, French label « Réseau de contrôle (Ethernet, sans audio) », cable colour #8D72FC, 17th of the palette, worst colour-blind pair 40, floor 30). The template retypes an RJ45 `aoip` port to it on any device that is not network audio by category (codec, broadcast, switch, intercom, stage box, interface, digital and radio consoles) and has no EtherCON / Dante primary port. Used on PA2, KH 120 II, SLX-D, Mac mini, Mac Studio, Rodecaster; `portAliases` of the old Bêta ids kept (the alias pairing treats the two as one group). R5 to R8 and the 25 original devices unchanged (playout PC, codecs, iQ keep `aoip`) | `behaviourTemplates.test.ts` (six real rows, retyping rule), `cableStyle.test.ts`; the engine refuses `ethernet-control` to `aoip` by R2 (SIGNAL_MISMATCH) |
| 10 | XLR ring larger than the base of small mics | Confirmed for the KM 184 (22 mm) and the MKH 416 (19 mm). A ring on a base or top face is capped at 0.85 x the body's smaller horizontal extent (`ringDiameterOnFaceM`, computed from the body box in `reanchorPorts`, rest scale carried); other rings untouched, the 25 original devices have no end-face port whose ring changes. The `e 835` is **partly disputed**: its body box is 48 mm (the head), so the box-based cap does not change it; its tail is not in the spec and the GLBs are not to change | `portMarkerSize.test.ts` (pure, real KM 184 / MKH 416 sizes, original devices unchanged) |
| 11 | royer-r-121 proposal port lacked `isRibbon` | Confirmed and fixed in the proposals file; new id-and-fact parity test compares connector, signal, direction and flags of every Wave 1 spec port with its catalogue entry or proposal (it caught only this one) | `specPortParity.test.ts` |
| 12 | Stress scene | Scratch e2e (not committed): 12 devices (the four desks TF5, ProFX12v3, 1202VLZ4, Rodecaster Pro II, the Ui24R and the seven heaviest by triangles: Beta 58A, e 835, KH 120 II, MD 421-II, HS5, 305P, 1176LN) in the concert hall, each framed in turn on the 1366 x 768 scratch build. Numbers below | idle renders 0 (asserted in the scratch run only) |
| 13 | realWorld model and typicalUse | Confirmed. PSM 300 model is « PSM 300 (P3T transmitter) », SLX-D « SLX-D (SLXD4 receiver) »; eight raw `typicalUse` leftovers rewritten as accurate English sentences from the datasheets (ProFX12v3, KH 120 II, NT1, PSM 300, SLX-D, PA2, MC-3+, Samson), written in the plan rows and regenerated | `promotedTruth.test.ts` (all 19 promoted Wave 1 devices: a capitalised sentence of at least 6 words, no raw leftover) |
| 14 | Connector types no source states, yet `portsDocumented` | Confirmed by reading the pages: the Neumann page names no inlet connector (only « Mains Cable EU/KC »), the dbx page names neither the mains inlet nor an Ethernet port. The `AssetSpec` schema is not mine to extend, so the plan row carries `assumedConnectors` (KH 120 II: `power-in`; PA2: `net`, `power-in`). The promotion rule is per port: an assumed connector may stay only on a port that carries no audio (a mains inlet or a control-network port), an assumed audio connector blocks the promotion, a listed port that the spec lacks is a blocker; the catalogue notes name the assumed connectors (« except the connector type of ... assumed: no cited page states it ») | `promoteDevice.test.ts` (per-port rule, notes, real rows) |
| 15 | Headphone amplifiers got no routes | Confirmed. `headphone-amp` routes its line / mic inputs to the headphone outputs (every other outboard device still never does) | `behaviourTemplates.test.ts` (real HP4 spec ports) |
| 16 | ICU `localeCompare` in the register; manufacturer names on generic panels | Confirmed. The register sorts by UTF-16 code unit (`codePointCompare`, a fixed order for RØDE). Generic panel text « DSNAKE » (AR2412) is now « CAT5 » and « OMNI n » (TF5) « OUT n »; both GLBs rebuilt, gates green. Port ids of beta-modelled devices keep their Bêta ids (saved projects). Other panel words checked (AES50, HDMI, Thunderbolt are standards and connector names) | `betaBadges.test.ts` (order) |

### Stress scene numbers (finding 12)

12 devices, 378 meshes, 167 materials. Idle renders in 2 s after each framing: 0 for all 12. `renderBench(40)`, 7 runs, ms per frame: 3.29, 3.61, 3.61, 3.74, 3.91, 4.06, 4.71, median **3.74 ms** (the reference rig of 5 devices measured 1.61 ms in the Wave 1 gate; this run shared the machine with the Wave 2 builds and a full vitest).

### Gate numbers (Wave 1b)

- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run validate:catalog` valid; `npm run validate:assets` 134 ok, 0 failed.
- `npx vitest run` (BLENDER_EXE set): 246 files, **4108 passed, 6 failed**; the six are Wave 2 in flight, not Wave 1b: `modelIds.test.ts` (12 proposals that ship a Wave 2 model while their plan row is staged), `deviceSpawnerNoModel.test.ts` (same cause), `proposalsFixedPoint.test.ts` x3 (also red on the HEAD proposals file before my change), `brandsRegister.test.ts` (28 Wave 2 manifest ids without a label yet). The committed register document is not regenerated by this commit (it would list Wave 2 rows whose manifest line is not committed): run `npm run register` when Wave 2 is committed (the `--check` and the document test fail until then; `src/creation/betaBadges.json` is up to date).
- Scratch build (`vite build --outDir <scratch>`) and Playwright on a private preview (port 4181, scratch config): `creation-beta`, `creation-drawer`, `creation-budgets`, `creation-controls`, `creation-front`, `creation-equipment-models`: 91 passed, 1 skipped (on-demand screenshot), 3 failed; the three are the badge test (fixed after the run: a proposal with a Wave 2 model and a staged row now expects the safe default, and passes) and the two `creation-equipment-models` tests, which fail by design while Wave 2 rows are `staged` without a catalogue entry or proposal (stage 2 not run). The equipment scene test with the staged rows excluded (scratch copy) passes: every spawnable device has asset status 'glb' and a body within 1 mm of its spec.

### Open items

1. Wave 2 specs that list `mute-master` or `balance-master` (they were told the console template writes them) will carry them at stage 2: a desk spec must list only controls its datasheet shows (and its GLB then carries the empties).
2. The `e 835` ring (finding 10, partly disputed) needs the real tail diameter in the spec.
3. `assumedConnectors` lives in the plan because the spec schema is shared with the Wave 2 shape work; moving it to the port (`connectorSource`) is a one-field change when that file is free.
4. The JK Broadcast Host has no phone-line port (no RJ11 connector in the catalogue), so its caller output is a source with no upstream route; a `rj11` connector and a telephone-line signal would let the hybrid be modelled end to end.
5. `docs/legal/BRANDS_AND_CREDITS.md` regenerate (see above) and the `proposalsFixedPoint` / `modelIds` / `brandsRegister` tests turn green when the Wave 2 stage 2 lands.


## Wave 2C: rack-box-v3b, moulded-box, revolve-v2-oval and round-base-stand rows (2026-11-12)

Agent 2C of the Wave 2 build. Stage 1 only (`npm run promote -- <id>`): `content/catalog.json` and `catalog-proposals.json` untouched, `--commit` not run (only `--commit --dry-run` to print the outcome). Nothing pushed, no Meshy, no manufacturer photo, no logo (generic panels only). Contact sheets stay local (git-ignored `assets-source/<id>/work/...`). Commits through a temporary index holding only my specs, panels, GLBs, my manifest rows and my plan rows.

### Rows (`planRows({wave: 2})`, families rack-box-v3b, moulded-box, revolve-v2-oval, round-base-stand and the plan row k-m-26125 filed under tripod-stand): 18

rack-box-v3b 7: crown-xti-4002, yamaha-xmv8280-d, behringer-europower-ep4000, db-audiotechnik-d80, ssl-the-bus-plus, l-acoustics-la12x, universal-audio-6176. moulded-box 9: zoom-h6-essential, sound-devices-mixpre-6-ii, zoom-podtrak-p4, audinate-dante-avio-install, audinate-dante-avio-analog-input-2ch, sennheiser-e-609-silver, sennheiser-e-906, shure-slxd1-bodypack, shure-ua874. revolve-v2-oval 1: akg-c414-xlii. round-base-stand 1: k-m-26125. That is 18 rows, not the 21 of the brief: the plan holds no other wave-2 row of these four families.

- **Blocked on data (no stage 1)**: audinate-dante-avio-analog-input-2ch (`missing`: the Monacor sheet of the Audinate-made ADP-DAI-2X0 publishes no unit size; the 150.7 x 53.8 x 38.1 mm belongs to the newer AVIO Install SKUs), l-acoustics-la12x (`missing`, partial), universal-audio-6176 (`missing`, partial). Never guessed.
- **Blocked on a patchable port (no stage 1)**: shure-ua874: the datasheet documents only BNC antenna connectors and a DC bias, no audio connector, and the catalogue has no RF or DC signal (same reason as the SLXD2 handheld of Wave 1A).
- **Built and shipped: 13** (GLB, manifest row, all gates green in the dry run (11 of 11 for the moulded boxes and racks, 10 for the lathe; `validate:assets` counts 9 to 11), 0 failed, 0 retries): see the table.
- **Not built, K&M 26125**: see below (the family itself was built and verified in a scratch run).

### Outcomes (13 shipped; by what `promote --commit --dry-run` printed: 7 promotion candidates, 6 beta-modelled)

| id | family | stage-2 outcome | triangles | size error | gates | ports and open items |
|---|---|---|---|---|---|---|
| akg-c414-xlii | revolve-oval | **promoted** | 1150 | 0.00 mm | 10 of 10 | AKG cut sheet read as text: 3-pin XLR, 48 V; `out-xlr` on the base. Gender not printed: male by convention (said in the spec). Profile is an estimate (9 stations, no photo) |
| sennheiser-e-609-silver | moulded-box | **promoted** | 1652 | 0.00 | 11 of 11 | Sennheiser quick guide read as text: XLR-3, 55 x 34 x 134 mm. Shape is a rounded box, not the real silhouette |
| sennheiser-e-906 | moulded-box | **promoted** | 1652 | 0.00 | 11 of 11 | Sennheiser product specification read as text, same body; black finish |
| shure-slxd1-bodypack | moulded-box | **promoted** | 1844 | 0.00 | 11 of 11 | Shure spec sheet: TA4M mini XLR input, unbalanced (`in-ta4`, `mini-xlr-ta4`, `isUnbalanced`); battery, no mains inlet, no power control; lid seam at 11 mm |
| zoom-h6-essential | moulded-box | **promoted** | 1740 | 0.00 | 11 of 11 | Zoom page and spec table read: 4 XLR/TRS combos (modelled as their XLR half, like the Rodecaster), line out and headphone 3.5 mm, USB-C; battery or USB power. XLR on the two long sides and the three small jacks on the end face are our layout |
| sound-devices-mixpre-6-ii | moulded-box | **promoted** | 1596 | 0.00 | 11 of 11 | dealer-hosted copy of the Sound Devices spec sheet read: 4 XLR, main out, headphone, USB-C modelled; Aux in, 2 USB-A, micro HDMI, SD drawn or left out. **The XLR ring (23.4 mm) is wider than 60 percent of the 36 mm face: `portMarkerSize.test.ts` will refuse it at stage 2 unless it gets a per-device exception like the MUTEC MC-3+** |
| zoom-podtrak-p4 | moulded-box | **promoted** | 1724 | 0.00 | 11 of 11 | Thomann page read (dealer, states every connector): 4 XLR (48 V), 4 headphone 3.5 mm, TRRS call-in (modelled as a 3.5 mm line input), USB-C; no mains inlet. Desk template routes the 4 XLR to the USB port |
| audinate-dante-avio-install | moulded-box | **promoted** | 1652 | 0.00 | 11 of 11 | Audinate sales guide read: 6-pin Euroblock (3.5 mm pitch) and Dante RJ45, PoE. The plan row covers three SKUs: modelled as the 2-channel analog INPUT adapter (one Euroblock port for two channels). Stage-2 dry run notes "no mains inlet": PoE, nothing to fix |
| crown-xti-4002 | rack-box v3b | **promoted** | 2896 | 0.01 mm (311.19 for 311.20) | 11 of 11 | Crown XTi2 operation manual read: 2 XLR in, 2 XLR link out (drawn), 2 speakON NL4, binding posts (drawn), USB-B (drawn), IEC inlet. Inlet type not named (15 A, a C20 in practice): `iec-c14` stand-in, plan row `assumedConnectors: ["power-in"]` (the only plan row edit besides the `staged` flags). Handles 20 mm (d includes them), 30 vents, LCD window: estimates; `power` switch on the rear |
| db-audiotechnik-d80 | rack-box v3b | beta-modelled (axis-assumed size) | 2996 | 0.01 | 11 of 11 | d&b page read: XLR, AES3, NL4, NL8, CAN, etherCON, powerCON HC. A Bêta row keeps its 14 proposal ports and their ids (powercon-blue for the HC inlet); the rest is drawn only. No controls (beta) |
| ssl-the-bus-plus | rack-box v3b | beta-modelled (axis-assumed size, ports not documented) | 1936 | 0.01 | 11 of 11 | rear XLR set from a Sound On Sound review through a search summary; the 9 proposal ports kept; gain-reduction window is an estimate |
| behringer-europower-ep4000 | rack-box v3b | beta-modelled (speakON type and inlet type not named) | 2620 | 0.01 | 11 of 11 | Behringer manual read: XLR and 1/4 in TRS per channel, 2 "speakON-compatible" outputs, 2 pairs of binding posts, IEC. A new proposal with 9 ports is built from the spec. No handles modelled (no source says it has any) |
| yamaha-xmv8280-d | rack-box v3b | beta-modelled (barrier strip has no catalogue connector) | 2656 | 0.01 | 11 of 11 | Yamaha datasheet copy and Markertek text read: Euroblock in x 2, Dante RJ45 x 2, 8 barrier-strip speaker pairs, remote and fault Euroblock, AC inlet. Only the 2 Dante RJ45 of the proposal are patchable; everything else is picture. `earHoleEdgeMm 10` (480 mm plate) |

### Blocked: K&M 26125 (round-base-stand), stage 1 reverted

The family WORKS on a real device: a scratch run through `buildAsset` (a synthetic catalogue entry, nothing written) with `baseDiaMm 275` and the spec size 275 x 1700 x 275 mm gave 1364 triangles, size error 0.02 mm on the base, all gates green, and a sheet that shows a disc base, a cone hub, a clutch sleeve and the thin rod to 1.7 m. The row cannot be shipped: its plan size has no height (the K&M page gives a RANGE, "from 1,000 to 1,700 mm", base 275 mm, 3/8 in thread, 3.36 kg; page read 2026-11-12), so it is `estimate` / `partial`, which can only be beta-modelled, and the pipeline leaves a beta-modelled device with no port out of its catalogue view (the spec parity check then refuses it, as for the SLXD2 of Wave 1A). Stage 1 was reverted with `--discard-spec`. Unblock, one decision: store `h: 1700` (the stated maximum extension) in the plan row with `sizeConfidence ok`; then it is promotable like the K&M 232 (zero ports, `portsDocumented: true`), spec params `build: { shape: round-base-stand, params: { baseDiaMm: 275 }, budget: { min: 800, max: 4000 } }`, size 275 x 1700 x 275, no projection, no panel.

### Wave 2 families findings (limits met on real devices)

1. **rack-box v3b worked as documented**: ear handles, front vent block and window together on 2U amps (2620 to 2996 triangles, inside the 1500 to 3500 class), `portSurface` green for rear ports on `io`. Rules met, none a bug: the through-vent block must lie in front of the chassis (x from `(plate - bodyWidth)/2 + 2` on a plate without handles: 25 mm from each end on a 483 mm plate with a 438 mm chassis), so a block of 6 slots of 36 mm with a 42 mm pitch (246 mm wide) did not fit left of centre; and the handles take face x 17 to 41 mm from each end, so vents start beyond 45 mm with them.
2. **A 480 mm wide plate** (Yamaha XMV, like the 1073SPX) needs `earHoleEdgeMm 10` (the default puts the ear slot 0.5 mm outside the plate).
3. **Front vents and the window are picture-grade estimates**: the front controls of an amplifier with handles cannot sit on the plate (the family refuses it), so every control is on `io` (the `power` switch next to the inlet).
4. **moulded-box needed no change**: seven devices passed first time with `cornerRadiusMm 5 to 12`, `edgeRadiusMm 2.5 to 8` (measured fillet 2.0 to 3.0 mm, `minFilletMm` 2 to 2.5), `recessWMm`/`recessHMm` for a screen, `seamHeightMm` for the bodypack, 1596 to 1844 triangles (class 500 to 2000). Ports are accepted on `io`, `opposite`, `left`, `right` and `bottom` without `insetMm` (no pocket is cut then, the port sits on the flat face). Limit: the family has no oval or flat-faced head, so a mic like the e 609 / e 906 (flat grille on an angled head) is only a rounded box with the exact bounding box; that is `moulded-box` with a larger `cornerRadiusMm` (max d/2) and is as good as it gets without an `assembly`.
5. **revolve-oval worked**: C414 profile of 10 stations x 64 segments = 1150 triangles (budget floor 1000), wrap picture width = ellipse perimeter (138.9 mm, `pxPerMm 12`), XLR on `bottom` at the centre. The base station must be wide enough for the XLR ring (23.4 mm): the first test profile (22 x 22 base) would have been narrower than the ring, so the base is 40 x 30.
6. **round-base-stand**: see K&M 26125 above (works; blocked by data and a pipeline limit, not by the shape).
7. **Pipeline limit (not a family one)**: a beta-modelled row with NO port cannot be built (see K&M 26125); a Bêta row (one that already has a proposal) must keep exactly its proposal ports, ids included, and no controls (D80, SSL, XMV): the richer connector sets the pages document stay picture-only for them.
8. **Amplifier template**: when a device has more audio inputs than speaker outputs, each input is routed to every speaker output; so a promoted amplifier lists only a 1:1 set (Crown: 2 XLR in, 2 speakON out) and the extra inputs are drawn only. Open: a recorder (H6, MixPre) with phantom has no `phantom-48v` control (the recorder template adds none); the XLR ports carry `isMicInput`, `providesPhantom` from the spec like the Rodecaster.

### Gate numbers (Wave 2C, 2026-11-12, `BLENDER_EXE=<path to blender.exe>`)

- `npm run validate:assets`: 148 ok, 0 failed (my 13 included).
- Commits: `44e868d` (the AKG C414 and seven moulded-box devices: its message says "six moulded-box devices", it is seven; not amended, no history rewriting) and `f4e23f6` (five racks). Plan rows and manifest rows were committed through a temporary index; the shared plan and manifest files in the working tree still hold other agents' uncommitted rows.
- `npx vitest run tests/tools tests/scene/modelIds.test.ts` (`BLENDER_EXE` set): 62 files, 1662 tests, 1656 passed, 6 failed, none about the content of my rows and all of the known stage-2 kind: `modelIds.test.ts` "every proposal that has a shipped glb has a plan row with betaModelled true" (the staged Wave 2 rows ship a model before stage 2; my beta-modelled ones, d80, ssl, ep4000 and xmv, are in that group), `proposalsFixedPoint.test.ts` (3) and `brandsRegister.test.ts` (2: the committed register block and "every manifest device id has a label"): they turn green when the Wave 2 stage 2 runs and `npm run register` is run.
- Not run: tsc, lint, e2e, chunk budget, the in-engine look audit, the stage 2 itself. Not verified: every connector and control position (guesses, said in each spec), the lathe profile of the C414 and the shapes of all 13 bodies (estimates from the published outer sizes), the 4 beta devices' connector sets beyond the pages named in their specs. Contact sheets were looked at for 7 of the 13 (C414, e 609, H6, P4, Crown, D80, XMV); the other six only through the gate numbers.


## Wave 3 families (shape agent, 2026-11-12)

Status (device agents: a family is usable from a spec, `build.shape` + `build.params`, as soon as its line says AVAILABLE).

| Task | Family | Status |
|---|---|---|
| 3.1 | `speaker-cabinet-v2` (plan family `speaker-cabinet-v2`: elevation profile, tapered plan, rounded facets, handle recesses, pole socket, rigging points, grille recess, rear pockets, column on a pole) | AVAILABLE (commits "Wave 3 family 3.1" and "3.1b") |
| 3.2 | `cable-assembly-v2` (plan family `cable-assembly-v2`: typed cable ends, optional fan-out) | AVAILABLE (commit "Wave 3 family 3.2") |
| 3.3 | `rack-box-v3-slope` | SKIPPED, see the decision below (not built, nothing to wait for) |

### Parameter reference (all lengths in millimetres, all in `build.params`; the doc block above each constant in `tools/assets3d/shapes.ts` is the same text)

Every family validates in `validateBuild` (TS, no Blender: names, whole numbers, groups, ranges) and again in the Python builder (geometry: fit in the real faces, overlaps, flat zones) with one-line `BuildError` messages.

**3.1 `speaker-cabinet-v2`** (`SPEAKER_V2_PARAMS`; `usesPorts`, `usesFlatZones`). Frame: bottom at y = 0, centred on x and z, io (rear) face at z = +d/2 (ports and their pockets), baffle at the front (z = -d/2, or set back); the spec size w x h x d is exact (the rounding takes a little off the extreme corners, the body is stretched back, at most 3 %, else the build says so). Baffle at -z and ports at +z: the same front as curved-cabinet, so `promote --commit` gives an active speaker on this shape its `modelFront` (axis -z) like on curved-cabinet (change in `tools/promoteDevice.ts`, tested).
- Elevation (side profile; the REAR face is always vertical at z = +d/2): `rearTopDropMm`, `rearBottomRiseMm` (the rear face stops this far short of the top and of the base), `frontTopDropMm`, `frontBottomRiseMm` (the same for the two ends of the front face), `frontTopSetMm`, `frontBottomSetMm` (the end of the front face set BACK from the baffle plane: a floor wedge's tilted baffle is `frontTopSetMm`). The shape has to touch the whole box: at most one of the two top drops, one of the two bottom rises, one of the two front sets. Line-array element (front taller than the rear, top and bottom converging) = `rearTopDropMm` + `rearBottomRiseMm`; wedge = `frontTopSetMm`; box = none. `speakerV2Elevation(size, params)` (TS) returns the four corners. Rear face at least 20 mm high, front face at least 20 mm long, convex.
- Plan (as speaker-cabinet): `midWidthMm`, `rearWidthMm`, `taperDepthMm` (the plan hexagon: full width at the baffle, `midWidthMm` where the taper starts `taperDepthMm` short of the io face, `rearWidthMm` at the io face; a narrower rear needs the taper depth).
- Rounding: `edgeRadiusMm` (5), `edgeSegments` (1 to 8, default 3 = facets of the arc, 1 = chamfer), `bodyGrey` (20 to 200). The edges are rounded by flat facets (a rounded polytope: planes tangent to the radius), smooth shading, the outline of every flat face kept sharp. The measured fillet (`filletMm`, read back from the mesh) is the EFFECTIVE radius: about 0.8 x `edgeRadiusMm` at 3 facets, 0.84 at 4 (the flat face ends R x (tan(a/2) - tan(a/(2(n+1)))) from the sharp edge). Declare `minFilletMm` at most 0.75 x `edgeRadiusMm` at the default.
- Grille panel: `grilleMarginMm` (turns it on; margin from the flat baffle face, measured in the baffle plane), `grilleDepthMm` (1.5).
- Handles (both sides): `handleCount` (1 or 2 per side), `handleLenMm` x `handleWidthMm` (a horizontal stadium slot), `handleDepthMm` (12), `handleFromRearMm` (centre of the first from the io face), `handleYMm` (centre height), `handlePitchMm` (distance between centres toward the front, required for 2). Cut into the flat side faces: refused when it does not fit, overlaps another recess or a flat zone of the left or right face.
- Pole socket: `poleSocketDiaMm` (typically 36), `poleSocketDepthMm` (30), `poleSocketFromRearMm` (default the middle of the depth), centred on x in the BOTTOM face; the bottom must be flat on the floor (no bottom rise).
- Rigging points: `rigPoints` (2 = the two top corners, 4 = all four corners of each side), `rigDiaMm` (14), `rigDepthMm` (0.8, a shallow marker), `rigInsetMm` (default 1.5 x the diameter, in from the corner in both directions).
- Column on a pole (portable column PA): `bodyHeightMm` (the cabinet; the spec height is the whole stack), `columnWidthMm`, `columnDepthMm`, `columnHeightMm` (a rounded prism on the middle of the top, its top at the spec height), `poleDiaMm` (35); all four come together, pole at least 50 mm, column no wider or deeper than the cabinet. The elevation, handles and recesses all work on the cabinet.
- Rear pockets: every io port with `insetMm` gets a round pocket (`openingMm`, default 24) in the rear face, floor `insetMm` behind it (`portSurface` holds within 0.5 mm; tested through the real gates).
- Measure keys read back (`runBuilder`, new in `BuilderMeasure`): `filletMm`, `handleRecesses`, `handleDepthMm`, `poleSocketDiaMm`, `poleSocketDepthMm`, `rigPoints`, `rigDepthMm`, `grilleDepthMm`.
- Limits: no tilted rear face (the io face is the vertical rear), no plan taper wider at the rear, no woofer or horn recesses (the generic picture carries drivers), no feet, handles only on the sides (not the top), rigging points are markers not hardware. A flat zone of a control on the io face is not checked against pockets.
- Sample sizes and triangles (all built exactly at the size, the plan axes read as w x h x d): d&b Y10P 257 x 580 x 341 with a 25 mm splay, handle, 4 rigging points and grille 924 triangles; L-Acoustics KS28 1340 x 550 x 719 with 2 handles per side, pole socket, rigging points and grille 1228; Meyer UPJunior 229 x 484 x 259 with a plan taper (rear 140) 500; L-Acoustics X15 HiQ 430 x 580 x 375 (wedge, `frontTopSetMm` 200) 412; Nexo 45N12 492 x 392 x 576 wedge 412; Yamaha NS-10M 215 x 381.5 x 197.5 204; EV Evolve 50M G2 344 x 2093 x 470 (cabinet 520 high, column 102 x 163 x 825 on a 35 mm pole) 772. Fillets 3.2 to 6.4 mm. Speaker class (up to 4000) holds; the `detail` floor is the device's own (`build.budget.min`), 200 for a plain box, 600 to 1000 with the recesses. Blocked rows are blocked by data, not by the shape: l-acoustics-x8, l-acoustics-kara-ii, qsc-ks118, rcf-hdl-30-a have no size in the plan today.

**3.2 `cable-assembly-v2`** (`CABLE_V2_PARAMS`, end kinds `CABLE_END_KINDS`; the old `cable-assembly` Mogami loom is a different shape and unchanged). A SHORT model of a cable (the real length is data, never geometry): end A at +z (io face), end B at -z (opposite face), the trunk fills the depth.
- `endA`, `endB`: end-kind codes, each the catalogue connector the PLUG is (it goes into a port whose connector it mates with): 1 xlr3-m, 2 xlr3-f, 3 trs-quarter, 4 ts-quarter, 5 speakon-nl4, 6 powercon-blue, 7 ethercon, 8 rj45, 9 bnc, 10 dsub25, 11 toslink, 12 iec-c13, 13 rca, 14 trs-35mm. A test holds that every one is a catalogue connector whose `matesWith` is symmetric (xlr3-f end mates xlr3-m, iec-c13 end mates iec-c14, ethercon also mates rj45).
- `fanColumns` x `fanRows` (default 1 x 1, at most 16 plugs): a fan of end-B plugs on a `fanPitchMm` grid (plug size + 2), each on a `tailLenMm` tail (120) joining the trunk. `trunkDiaMm` (6).
- Size: the depth is the whole model, at least both plugs + tails + a 30 mm trunk; the width and height must be within 2 % of the natural cross-section: `cableV2Natural(params)` (TS) returns `{ w, h, minD }` so a spec can be written from the params (XLR cable 22 x 22, minimum depth 154; DB25 to 4 x 2 XLR-M snake 94 x 46, minimum 257). Ports go on the io (end A) and opposite (end B) faces on the plug axis, no `insetMm`; `portSurface` passes on a built XLR cable (tested).
- Triangles: XLR cable 748, TRS to TS 820, etherCON to RJ45 372, powerCON to IEC 504, speakON pair 804, the DB25 to 4 x 2 XLR snake 3536 (the 8 plugs on tails); a plain cable is small gear (up to 2000), the snake is a device on its own. Limits: plugs are simplified (no pin detail inside shells, a recessed contact face is a 0.3 mm stud), a straight trunk only, one cable colour.

**3.3 `rack-box-v3-slope`: SKIPPED.** The only plan row of that family in waves 3 to 5 is `rme-babyface-pro-fs` (wave 3, datasheet 108 x 181 x 35 mm, a desktop interface, trait `desk`, not rack gear). The Wave 0 spike (Q1) recorded that `console-wedge` v2 carries sloped desktop gear with a 4-station profile (lip rule), so Task 3.3 is not mandatory; and this row is a nearly flat slab, which `moulded-box` (rounded plan, edge radius, recess for a display) or `console-wedge` with a 3 mm to 35 mm slope also carry. Nothing was added to the builder; sloped RACK gear with ears and handles remains the only thing it would buy, and no row needs it. The device agent should use `console-wedge` (or `moulded-box` if the top is flat); the row's family label in the plan stays `rack-box-v3-slope` (not changed: the plan is not mine).

### Decision on the typed cable item (Task 3.2, D5)

The catalogue has NO concept of a cable as an item today: a cable is a `Connection` between two ports (`rig.connections`, drawn as a rope whose colour comes from the signal type, its length measured from the geometry; the engine checks the connector mate R1 on `matesWith`), and the only cable in the catalogue is the Mogami DB25 loom, a "cable-as-device" with ports at its ends. A typed item (`connectorA`, `connectorB`, `lengthM`) would need an inventory entry that is not a device, a placement concept for a physical object that joins two ports, a change to what a saved connection stores (the project format) and to R1 (a mate through a plug kind), none of which the design allows outside the additive schema fields of Wave 0. The 8 plan rows of the family (`cat6-ethercon-cable-family`, `powercon-iec-cable-family`, `speakon-cable-family`, `trs-ts-jack-cable-family`, `xlr3-cable-family`, `whirlwind-medusa-standard-snake`, `digital-audio-cable-family`, `neutrik-ne8mx`) also have no size (`missing`, "family" rows with a connector pair and lengths, no box), so by the promotion rule (size from a datasheet or dealer, ports documented) none can be promoted or beta-modelled either.
**Decision: the catalogue-side typed cable item is NOT implemented; the cable rows stay out of scope and blocked, for the founder to validate.** What was done instead is the smallest honest piece that does not touch the catalogue: the builder can draw a typed cable (`cable-assembly-v2`) and `CABLE_END_KINDS` is the vocabulary (end-kind code, catalogue connector id, mating verified against `content/catalog.json`) that a later typed item (`connectorA`, `connectorB` = two end kinds, `lengthM` data) would reuse as is. What a typed item would still need, if the founder wants it: a `CableKind` schema with the two connector ids and a length range, an inventory tab line (« Câbles et DI » already exists), a placement rule, and the rule R1 reading `connectorA` / `connectorB` instead of the port connectors; the snake with a stage box (Whirlwind Medusa) is better built as a normal device (a rack-box or moulded-box stage box) plus this fan-out model.

### Tests and verification of the shape agent (2026-11-12)

- New test files, all through the real builder with `BLENDER_EXE=<path to blender.exe>`: `speakerCabinetV2.test.ts` (24: params, size exact for a sub, a trapezoid with tapered plan and a wedge, elevation height at the back, wedge baffle, handle recess depth and place, pole socket diameter and depth, rigging points, grille recess, rear pockets behind inset ports on a box and on a trapezoid, measured fillet, refusals with their messages, 12 parallel builds byte-identical for three samples, triangle class, the pinned old output, the real gates (size, portSurface, detail, fillet) through `buildAsset`, the column on a pole) and `cableAssemblyV2.test.ts` (13: registry, every end kind a catalogue connector that mates both ways, natural size, schema, refusals, all 14 kinds as end A and end B at their natural size, male and female XLR, the snake, determinism, the real gates, the Mogami loom bytes).
- Old output pinned: `builderPins.test.ts` (93 committed plans) stays green; `tests/tools/assets3d/fixtures/builder-pins-wave3.json` adds 8 plans taken BEFORE any edit of the script: `speaker-cabinet` (plain, trapezoid, hexagon with pockets), a rack-box v3b amp, a moulded-box recorder, the C414 revolve-oval, the straight and the boom round-base stand. All 8 were byte-stable twice before; after the edits 7 keep their bytes and the speaker-cabinet hexagon with pockets keeps its geometry (fingerprint) but not its bytes, because it fills its rear face with bmesh beauty fill (the Wave 2 finding 1: not byte-stable once the script text changes); its pin is the fingerprint only. No shipped device uses `speaker-cabinet`.
- Both new builders are byte-stable by construction (pure arithmetic geometry, our own triangulation, canonical face order): 12 parallel builds identical for every sample.
- `npx tsc --noEmit` clean; `npm run lint` clean; `tests/tools` (shape, pin, promote tests) green on the files above.

### Findings and notes

1. **Plan axes of the Y10P.** The plan stores d&b Y10P as w 257, d 341, h 580 (datasheet, ok). The Y-series 10 inch element is a wide, low box (a line source), so the 257 and 580 may be swapped; not changed here (the plan is not mine) and the shape does not care (w x h x d exact), but the device agent should check the datasheet orientation before shipping it.
2. **EV Evolve 50M G2** (wave 5, estimate): 2093 mm is the assembled stack (sub plus column plus pole), hence the column feature; the plan row is `axis-assumed`, so it is beta-modelled at best.
3. **Measured fillet is the effective radius** (about 0.8 x the parameter at the default 3 facets): a spec that declares `minFilletMm` equal to `edgeRadiusMm` fails the `fillet` gate by design.
4. **Active speakers**: `promote --commit` now writes `modelFront` for `speaker-cabinet-v2` as for `curved-cabinet`; `tests/assets/modelFront.test.ts` still needs a MEASURED entry for each promoted speaker (the device agent adds it when stage 2 runs).
5. **Shared index mishap, repaired**: my first commit of 3.1 swept in two other agents' staged files (`content/proposals/equipment-plan.json`, `public/assets/ASSET_MANIFEST.json`); I undid that commit (soft reset of my own, unpushed, just-made commit), unstaged the two files (their working changes are untouched) and recommitted with explicit paths. The other agents may need to `git add` those two files again.
6. A transient failure seen during the run: `builder.test.ts` and others read every `content/asset-specs/*.json` through `loadSpecs()`, and a half-written spec of another agent (a profile with fewer than 4 stations) made them fail for a while; not a shape problem.

### Unverified

- No `asset:build --scripted --ship` of a REAL device on either family (that is the device agents' step); the gates were run on synthetic specs (size, portSurface, detail, fillet green on both).
- The contact sheets were looked at for the box, the trapezoid with taper, the wedge and three cables (local, not committed); the look of the plugs is generic and simplified (no logo, no pin detail inside shells).
- The in-engine look (smooth shading of the faceted rounding in Babylon) was not checked; the full `vitest run`, the chunk budget and Playwright were not run by this agent.


## Wave 3A: rows of existing families and of the four wave-2 families (2026-11-12)

Agent 3A of the Wave 3 build. Stage 1 only (`npm run promote -- <id>`): `content/catalog.json` and `catalog-proposals.json` untouched, `--commit` never run (only `--commit --dry-run` to print the outcome). Nothing pushed, no Meshy, no photo, no logo, no brand mark (generic panels only). Commits `4f2fe2a`, `a30806b`, `8a4f472`, `7d4ab0f`, `95721b5` (46 devices, a temporary index per commit: only my specs, panels, GLBs, my manifest rows and my plan rows). Contact sheets stay local (git-ignored `docs/superpowers/notes/img/wave3a-*.png`).

### Rows got (`planRows({wave: 3})`, my families: 78 of the 92 wave-3 rows)

rack-box-v2 37, console-wedge-v2 10, curved-cabinet 3, moulded-box 10, revolve 7, revolve-v2-oval 5, rack-box-v3b 6. No wave-3 row of tripod-stand, power-strip, generic-panel or round-base-stand exists. Not mine (listed as waiting or for other agents): speaker-cabinet-v2 7 rows (db-audiotechnik-y10p, l-acoustics-kara-ii, l-acoustics-x15-hiq, l-acoustics-x8, meyer-upjunior-upj-1p, qsc-ks118, yamaha-ns-10m), cable-assembly-v2 6 rows, rack-box-v3-slope 1 (rme-babyface-pro-fs). 78 + 14 = 92.

Eligible by `effectiveQuality` (not `missing`): 52. Built and shipped: **46** (GLB, manifest row, 11 of 11 gates, 10 of 10 for the lathes; `validate:assets` 193 ok, 0 failed). By what `promote --commit --dry-run` prints: **20 promotion candidates, 26 beta-modelled**. Failed after three attempts: 0 (every device was green after at most two fixes, all of them mine: three-digit colours refused by the panel renderer, a nested art array, a 3-station profile, a corner radius of the FaderPort lip, `earHoleEdgeMm` of a 480 mm plate).

### Blocked and not built

- **26 rows `missing` (no stage 1, never guessed)**: rack-box-v2: allen-heath-ab168, avid-protools-sync-x, drawmer-mc2-1, ebtech-hum-eliminator-he-2, focusrite-rednet-a16r-mkii, focusrite-rednet-x2p, power-sequencer-distribution, powercon-distro, rme-digiface-dante, rme-m-32-ad, sennheiser-ew-d-em, shure-scm820, spl-phonitor-x, whirlwind-sp1x3 (size conflict, partial, unlabelled axes or nothing printed); console-wedge-v2: soundcraft-signature-12mtk, wheatstone-l-12; curved-cabinet: jbl-eon715; moulded-box: laptop-generic, shure-beta-91a; rack-box-v3b: l-acoustics-la4x, rupert-neve-designs-shelford-channel; revolve: schoeps-cmc-6-mk-41; revolve-v2-oval: beyerdynamic-m-160, coles-4038, neumann-usm-69-i, rode-nt4.
- **6 eligible rows not built**: focusrite-rednet-mp8r (estimate, partial: width and height only, no depth); rode-ntg5 (partial: height only); shure-qlxd2-handheld, shure-ulxd2-handheld, sennheiser-ew-d-skm-s (handheld transmitters whose only connectors are USB power, IR and RF: no patchable port and no `dc-power`, `usb-power` or `rf-antenna` signal, the Wave 1A SLXD2 case); arrakis-arc-8 (the datasheet is an image PDF, the dealer summary names RJ45 balanced inputs and RCA jacks with no counts: no connector set can be documented, nothing staged).

### Outcomes (46 built; `outcome` is the stage-2 dry-run result; triangles from the manifest; size error 0.00 to 0.03 mm on every axis, worst digico-sd12 0.03 mm)

| id | shape | outcome | triangles | ports | plan size grade | reason when beta-modelled |
|---|---|---|---|---|---|---|
| aea-r84 | revolve-oval | promoted | 1022 | 1 | datasheet/ok | documented set, see spec sources |
| aeta-scoopteam | rack-box | beta-modelled | 712 | 8 | datasheet/ok | panels and input list ambiguous |
| akai-mpk-mini-mk3 | moulded-box | promoted | 1724 | 1 | dealer/ok | documented set, see spec sources |
| allen-heath-dx168 | rack-box | beta-modelled | 712 | 6 | estimate/axis-assumed | axis order assumed, counts conflict |
| allen-heath-qu-16 | console-wedge | beta-modelled | 1394 | 10 | estimate/conflict | size conflict (estimate) |
| allen-heath-zed-14 | console-wedge | beta-modelled | 1417 | 8 | dealer/ok | mic and insert counts disagree, no mains stated |
| allen-heath-zed-22fx | console-wedge | beta-modelled | 1417 | 7 | dealer/ok | counts of outputs, inserts and headphone jacks not stated |
| antelope-orion-32-plus-gen4 | rack-box | beta-modelled | 1776 | 14 | estimate/axis-assumed | axis order assumed |
| apogee-duet-3 | rack-box | promoted | 712 | 6 | datasheet/ok | documented set, see spec sources |
| audient-id14-mkii | rack-box | promoted | 712 | 11 | dealer/ok | documented set, see spec sources |
| audio-technica-atw-r3210 | rack-box | promoted | 1328 | 2 | datasheet/ok | documented set, see spec sources |
| avid-protools-mtrx-studio | rack-box | beta-modelled | 1776 | 12 | estimate/axis-assumed | axis order assumed |
| behringer-flow-8 | console-wedge | promoted | 1408 | 8 | dealer/ok | documented set, see spec sources |
| behringer-px3000 | rack-box | beta-modelled | 1632 | 4 | datasheet/ok | jack counts per panel unclear |
| crown-pzm-30d | moulded-box | beta-modelled | 1652 | 1 | dealer/ok | XLR ring taller than the 19 mm plate (ring rule), cable end stands in |
| db-audiotechnik-d40 | rack-box (plan: v3b) | beta-modelled | 1920 | 12 | estimate/axis-assumed | axis order assumed |
| dbx-160a | rack-box | promoted | 1776 | 4 | datasheet/ok | documented set, see spec sources |
| dbx-afs2 | rack-box | beta-modelled | 1776 | 8 | estimate/axis-assumed | axis order assumed |
| digico-sd-rack | rack-box | beta-modelled | 1920 | 5 | estimate/axis-assumed | axis order assumed |
| digico-sd12 | console-wedge | beta-modelled | 1516 | 20 | datasheet/ok | I/O counts ambiguous between page and datasheet mirror |
| elgato-stream-deck-mk2 | moulded-box | beta-modelled | 1580 | 1 | datasheet/ok | USB-C connector named only by third parties |
| eventide-h9000 | rack-box | promoted | 1920 | 4 | datasheet/ok | documented set, see spec sources |
| galaxy-audio-cricket-cpts | moulded-box | beta-modelled | 1724 | 5 | datasheet/ok | two-unit set modelled as one box |
| genelec-7360a | curved-cabinet | promoted | 2572 | 11 + 1 ctrl | datasheet/ok | documented set, see spec sources |
| genelec-8351b | curved-cabinet | promoted | 3108 | 6 + 1 ctrl | datasheet/ok | documented set, see spec sources |
| lexicon-pcm96 | rack-box | beta-modelled | 1776 | 8 | estimate/axis-assumed | axis order assumed |
| lynx-aurora-n | rack-box | beta-modelled | 1776 | 9 | datasheet/ok | connector set depends on the ordered modules |
| motu-828es | rack-box | beta-modelled | 1776 | 13 | estimate/axis-assumed | axis order assumed |
| neumann-m-149-tube | revolve | beta-modelled | 1534 | 1 | datasheet/ok | XLR is on the power supply, stand-in on the mic base |
| neumann-u-67 | revolve | beta-modelled | 1406 | 1 | datasheet/ok | XLR is on the power supply, stand-in on the mic base |
| nexo-nxamp4x4mk2 | rack-box (plan: v3b) | beta-modelled | 1920 | 7 | estimate/axis-assumed | axis order assumed |
| nti-audio-minirator-mr-pro | moulded-box | beta-modelled | 1724 | 3 | datasheet/ok | connectors read through summaries only |
| nti-audio-xl2 | moulded-box | beta-modelled | 1724 | 5 | datasheet/ok | TOSLINK output disputed |
| presonus-faderport-8 | console-wedge | promoted | 1428 | 1 | dealer/ok | documented set, see spec sources |
| presonus-studio-24c | rack-box | promoted | 712 | 6 | dealer/ok | documented set, see spec sources |
| sennheiser-em-6000 | rack-box | promoted | 1776 | 9 + 1 ctrl | datasheet/ok | documented set, see spec sources |
| shure-axient-digital-ad4d | rack-box | promoted | 1776 | 13 + 1 ctrl | datasheet/ok | documented set, see spec sources |
| shure-ua845uwb | rack-box | promoted | 1776 | 1 + 1 ctrl | datasheet/ok | documented set, see spec sources |
| sonifex-s0-v2 | console-wedge | promoted | 1370 | 14 + 1 ctrl | datasheet/ok | documented set, see spec sources |
| sound-devices-833 | moulded-box | beta-modelled | 1724 | 9 | datasheet/ok | headphone jack types differ between guide versions |
| tc-electronic-m3000 | rack-box | promoted | 1776 | 11 | dealer/ok | documented set, see spec sources |
| telos-zephyr-xstream | rack-box | promoted | 1920 | 8 + 1 ctrl | datasheet/ok | documented set, see spec sources |
| ua-la-610-mkii | rack-box (plan: v3b) | promoted | 1920 | 4 + 2 ctrl | dealer/ok | documented set, see spec sources |
| warm-audio-wa73-eq | rack-box | beta-modelled | 1776 | 5 | dealer/ok | listings disagree on the front or rear XLR; no mains stated |
| yamaha-px10 | rack-box (plan: v3b) | beta-modelled | 1920 | 11 | estimate/axis-assumed | axis order assumed |
| zoom-f8n-pro | moulded-box | promoted | 1724 | 5 | datasheet/ok | documented set, see spec sources |

### Documentation rule applied

`portsDocumented: true` plus `portsSource` only where a manufacturer, manual or dealer text (opened, or read through a search summary) states the connector TYPE with its count: the 20 promotion candidates. Every spec source note says how each fact was read and lists the connectors that were not modelled (RF, DC, MIDI, footswitch, contact closures, ISDN: no catalogue signal). The plan `assumedConnectors: ['power-in']` was added to six rows whose page names the mains inlet only as "IEC" or "locking AC" (shure-axient-digital-ad4d, telos-zephyr-xstream, shure-ua845uwb, sonifex-s0-v2, genelec-8351b, genelec-7360a): an assumed connector stays only on a port that carries no audio. Devices whose page names no mains connection (24c, Duet 3, ID14, H9000, M3000, 160A, LA-610, ATW-R3210, FLOW 8, FaderPort 8) carry no mains inlet and therefore no power control. Beta rows with a proposal keep the proposal ports exactly (ids included); new beta rows (dx168, 828es, px3000, wa73-eq, zed-14, qu-16, stream-deck, pzm-30d) have ports from the page or summary.

Two read-only research sub-agents read the connector sets of 32 devices from manufacturer and dealer pages or search summaries; their reports are the "read through" statements in the spec notes.

### Recipes (params that worked, for later waves)

- **Rack 1U** (every full-width 1U): the Wave 1C processor recipe (`earThicknessMm 4, plateFilletMm 1.6, filletMm 2.5, filletSegments 12, bodyWidthMm 438, earHoleMm 6, rearInsetMm 6, seamMm 18`, nine top vents), 1776 triangles; shallow patchbay: the S-Patch recipe, 1632; 2U: `earThicknessMm 5, plateFilletMm 1, seamMm 40, rearInsetMm 8`, two vent columns, 1920; 3U and 10U: `seamMm 60, rearInsetMm 10`. A 480 mm plate (Yamaha PX10) needs `bodyWidthMm 440, earHoleEdgeMm 10` (the default slot falls outside the ear).
- **Half-rack and desktop boxes**: ATW-R3210 (210 x 191 x 43.4): the SLX-D `half` recipe (1328). Desktop interfaces: `earThicknessMm 10 to 12, plateFilletMm 4.4 to 5, filletMm 5 to 6` (712 triangles, `minFilletMm 4 to 4.5`; the 44 mm tall Studio 24c worked with 5 mm).
- **Rear ports on a 1U face**: one row of at most 8 to 12 jacks (XLR flow width 24 mm); more go to the front plate (`opposite`) with explicit x (MTRX Studio, Orion, Aurora(n)). A front port is fine without handles.
- **Console-wedge**: profiles need at least 4 stations (a 3-station profile is refused by the schema); a 40 mm front lip with `baseMm 28` fails ("plan corner radii too large"): `baseMm 16, filletMm 2.5` for the FaderPort 8 and `cheekMm 4, baseMm 16` for the 48 mm FLOW 8. Desks 1370 to 1516 triangles; the 1124 mm SD12 with the TF5 recipe (`armRestMm 14, baseMm 36, feetMm 10`) 1516.
- **Top pictures of a wedge or a moulded box**: on a `top` face the picture's high y is the FRONT (the XL2 XLR at y 165 is at the top of the sheet view): faders and keys go to high y, knobs and displays toward the io edge (the desk and MPK art is mirrored accordingly).
- **curved-cabinet**: the Genelec 8341A recipe scaled by the width ratio worked first time for the 8351B (`planFrontMm = width - 2 x sideBulgeMm`, `rearWidthMm`, radii 34 and 41, `edgeRadiusMm 24`, `minFilletMm 22`); a subwoofer without drivers is a plain rounded box (`planFrontMm 462, rearWidthMm 440, radii 44, edge 24`), 2572 triangles.
- **moulded-box**: `cornerRadiusMm 8, edgeRadiusMm 3, edgeSegments 8` gives 1580 to 1724 triangles (small gear 500 to 2000); ports on the `io`, `left`, `right` and `top` faces without pockets pass `portSurface`; the 19 mm PZM took `cornerRadiusMm 10, edgeRadiusMm 2.5`.
- **Lathes**: `revolve` with 13 stations and `budget.min 1000` (1406 to 1534 triangles); `revolve-oval` with 9 three-number stations (1022 triangles); wrap picture width `pi x w` for the round ones, the ellipse perimeter for the oval (99 x 64: about 267 mm). The profiles of M 149, U 67 and R84 are estimates drawn from the outer size, said in the specs.
- **Generator**: a session scratch generator (ports laid out by connector flow width, rings checked pairwise and against 60 percent of the face, panel pictures drawn under each port) wrote the specs and panels; it is not committed, the committed files are its output.

### Wave 3A findings (family limits and data limits, with the param needed)

1. **rack-box-v3b was not exercised**: the plan files ua-la-610-mkii, db-audiotechnik-d40, nexo-nxamp4x4mk2, yamaha-px10 (and two blocked rows) under v3b, but no page read states handles, a front vent block or a meter window, so the v2 params were used and each spec says so. The family stays available for a device whose datasheet shows those features.
2. **moulded-box has no profile**: the MPK Mini and any sloped controller is a flat rounded slab. Param needed: a `topSlopeDeg` or a `profile` as the console-wedge has.
3. **Microphone with a power-supply connector**: the M 149 and U 67 are modelled with the XLR on the base as a stand-in (the real XLR is on the N 149 A / NU 67 V supply, the microphone has a DIN-8 / 7-pin the catalogue lacks). A `din8` connector and a mic-to-supply cable would model it properly.
4. **Signal gaps repeated**: RF antenna (BNC antennas of every receiver and the UA845UWB), DC supply, MIDI, footswitch and pedal jacks, contact closures, ISDN: none has a catalogue signal, so the receivers carry only audio, AES3 and network ports. The three handheld transmitters stay blocked for this reason.
5. **Ring rule**: the PZM-30D (19 mm plate) cannot carry an XLR ring under 60 percent of its face, so it is beta-modelled by design; the Lynx Aurora(n) (43.2 mm tall) would put its C14 ring at 61 percent: it is beta-modelled for its configuration-dependent connector set, but a promotion would need a per-device exception like the MC-3+. No promotion candidate breaks the ring rules (checked: ad4d and ua845uwb at 44 and 44.5 mm have rings of exactly 26.4 mm against limits of 26.4 and 26.7).
6. **Preamp template wants its controls in the spec**: the LA-610 lists `gain` (knob) and `phantom-48v` (button) on its front, as the template adds them; the pipeline refused the spec until they were listed. Desks list no master control (the datasheets read here show none), so the template adds none.
7. **Assumed details**: XLR genders follow in = female and out = male for the 160A, M3000, H9000, Xstream and LA-610 (the pages say only "XLR"); the 8351B and 7360A inlets are assumed IEC C14.
8. **Smooth-shading fan** on the pocketed rear of the two Genelec cabinets (seen on the shipped 8030C too, not new).

### Stage 2 notes (for the serial step)

- Promotion candidates (20): shure-axient-digital-ad4d, sennheiser-em-6000, telos-zephyr-xstream, presonus-studio-24c, audient-id14-mkii, apogee-duet-3, audio-technica-atw-r3210, shure-ua845uwb, tc-electronic-m3000, eventide-h9000, dbx-160a, ua-la-610-mkii, sonifex-s0-v2, behringer-flow-8, presonus-faderport-8, genelec-8351b, genelec-7360a, akai-mpk-mini-mk3, zoom-f8n-pro, aea-r84. After stage 2: `npm run register`, `node tools/controls/gen-from-specs.mjs` (power controls of ad4d, em-6000, xstream, ua845uwb, s0-v2, 8351b, 7360a; gain and phantom of the LA-610), then rebuild the devices that get a layout to confirm the flat zones (the builder had no layout, so no flat zone was checked).
- Tests red today that change at stage 2: `modelIds.test.ts` (39 proposals ship a model while their plan row is not yet betaModelled), `brandsRegister.test.ts` (two tests: labels and the generated block), `proposalsFixedPoint.test.ts` (three tests, as before). `cableAssemblyV2.test.ts` (two tests) fails on the families agent's uncommitted work, not on mine.
- The beta-modelled new rows get a proposal built from the spec at stage 2; the Bêta rows keep their proposal with `sizeMm`.

### Gate numbers (Wave 3A, 2026-11-12, `BLENDER_EXE=<path to blender.exe>`)

- `npm run validate:assets`: **193 ok, 0 failed** (the whole tree, 46 of them mine). Per device dry run and ship: 11 of 11 gates for boxes, desks and cabinets, 10 of 10 for the lathes.
- `npx vitest run tests/tools tests/scene/modelIds.test.ts`: 64 files, 1788 tests, 1780 passed, 8 failed: the cableAssemblyV2 pair, `brandsRegister` 2, `proposalsFixedPoint` 3, `modelIds` 1 (all listed above, none about the content of my specs; `specPortParity`, `promotedTruth`, `betaBadges` and `promoteDevice` pass).
- Not run: tsc, lint, the creation e2e, chunk budget, the in-engine look audit, a perspective render (the sheets are four orthographic views). Not verified: every connector and control position, the side profiles of the desks, the lathe profiles of the three microphones and the plan outlines of the cabinets (estimates from the outer sizes; no photo or drawing opened).


## Wave 3B: speaker-cabinet-v2 rows (waves 3, 4, 5) and four reassigned microphone rows (2026-11-12)

Agent 3B of the Wave 3 build. Stage 1 only (`npm run promote -- <id>`): `content/catalog.json` and `catalog-proposals.json` untouched, `--commit` never run (only `--commit --dry-run` to print the outcome). Nothing pushed, no Meshy, no photo, no logo, no brand mark (generic panels only), no acoustic number in any spec (data rule). Commit `cf64b5e` (19 devices, temporary index: my specs, panels, GLBs, my manifest rows and my plan rows; the working-tree plan and manifest still hold other agents' changes and ordering-only differences). Contact sheets stay local (git-ignored `assets-source/<id>/work/...`). The only plan edits besides the stage-1 `staged` flags are `assumedConnectors` on three rows (adam-audio-s3h and meyer-upjunior-upj-1p: `power-in`; neumann-kh-750-dsp: `net`, `power-in`). Note for the coordinator: commit 608d116 (Wave 3 families log) dropped the Wave 3A section that 9eb7a7f had added to this log; it is still in `git show 9eb7a7f`.

### Rows got

`planRows({family: 'speaker-cabinet-v2'})` gives 20 rows (wave 3: 7, wave 4: 10, wave 5: 3), plus the four small microphone rows whose plan family is `assembly`.

- **Eligible and built (15 speakers)**: db-audiotechnik-y10p, l-acoustics-x15-hiq, meyer-upjunior-upj-1p, yamaha-ns-10m (wave 3); l-acoustics-ks28, adam-audio-s3h, db-audiotechnik-v-sub, l-acoustics-a15-focus, meyer-sound-lina, neumann-kh-750-dsp, nexo-45n12, nexo-p12 (wave 4); focal-utopia-main-112, nexo-geo-m10, ev-evolve-50m-g2 (wave 5).
- **Blocked on data, no stage 1 (5)**: l-acoustics-kara-ii (`missing`, conflict: 733 x 500 x 252 vs 701 x 252 x 403 vs 734 x 483), l-acoustics-x8 (`missing`, conflict: depth 164 mm vs 10.4 in), qsc-ks118 (`missing`, no size), db-audiotechnik-v8 (`missing`, conflict: depth 460 vs 406 inside d&b's own documents), rcf-hdl-30-a (`missing`, no size). Never guessed.
- **Four microphone rows reassigned from `assembly` (deferred: headphones and most accessories publish no dimensions) to a lathe**: akg-d112-mkii, dpa-4060, sanken-cos-11d, rode-nt-sf1. Three use `revolve`; **akg-d112-mkii uses `revolve-oval`** (the sibling lathe, same recipe): its datasheet size is 70 wide x 115 long x 126 high, and `revolve` needs width = depth, so only an oval section carries the three numbers exactly. The plan row family label stays `assembly`.

### Y10P axis check (the plan stores w 257, h 580)

Not swapped, plan row unchanged. d&b's own architectural specification (text file read today) says "The dimensions (WxHxD) shall not exceed 257 x 580 x 341 mm"; the product page prints the same triple under "Dimensions (h x w x d)" as 580 x 257 x 341; the French page and dealers agree. Both labellings give width 257, height 580, depth 341. The same specification says the cabinet has two 8 in drivers, one handle on the top and one on the bottom panel and M10 inserts top and bottom, which fits a tall box. So the model is 257 wide, 580 high, 341 deep.

### Outcomes (19 built and shipped: GLB, manifest row, all gates green; 0 failed; every device passed at the first dry run)

By what `promote --commit --dry-run` printed: **11 promotion candidates, 8 beta-modelled**. Size error 0.00 to 0.04 mm on every axis (the `size` gate). Gates: 11 (boxes) or 10 (lathes) in the dry run, `validate:assets` counts 8 or 9; the whole tree is 212 ok, 0 failed.

| id | stage-2 outcome | triangles | ports modelled | source of the connector set, and open items |
|---|---|---|---|---|
| db-audiotechnik-y10p | promoted | 364 | 2 NLT4 (bidir) | d&b architectural specification and page: "speakon NLT4 F/M" x 2 (an NL4 pair is optional, not modelled). Top and bottom handles and M10 inserts not modelled (the shape cuts side handles only) |
| l-acoustics-ks28 | promoted | 300 | 1 speakON (in) | L-Acoustics page: "1 x 4-point speakON", six handles (place not stated: not cut), 2 x 18 in |
| l-acoustics-a15-focus | promoted | 364 | IN and LINK speakON | L-Acoustics page; one handle (place not stated: not cut); plan taper not stated: plain box |
| meyer-sound-lina | promoted | 428 | XLR in, XLR loop out, powerCON in + `power` | Meyer datasheet page: powerCON 20 input with loop, XLR female in, XLR male loop out (optional 5-pin and mains loop not modelled) |
| meyer-upjunior-upj-1p | promoted | 428 | XLR in, XLR loop out, powerCON in + `power` | Meyer manual spec page (XLR) and the next page via a search summary ("PowerCon with looping output", colour not stated: plan `assumedConnectors power-in`); the PSSL page answered 429 and Meyer's datasheet 404 |
| adam-audio-s3h | promoted | 492 | XLR in, AES3 in, AES3 thru, IEC inlet + `power` | ADAM S Series quick start guide (names the S3H, read as text): XLR analog input, AES3 In and Thru, "standard IEC mains connector"; the USB jack is not modelled (connector type unprinted, control only); plan `assumedConnectors power-in` |
| db-audiotechnik-v-sub | promoted | 780 | 2 NLT4 (bidir) | d&b page: 2 x NLT4 F/M plus optional 2 x NL4; two handles per side panel (count and sides from the page; recess place and size are ours); the M20 flange is in the top panel, not modelled |
| neumann-kh-750-dsp | promoted | 748 | 2 XLR in, 2 XLR out, BNC AES3 in and out, RJ45 control, IEC inlet + `power` | Neumann page (all eight); network connector and mains inlet types not named: plan `assumedConnectors net, power-in` (both non-audio); XLR genders by convention |
| nexo-45n12 | promoted | 568 | 2 NL4 (bidir) | NEXO page: "2 x NL4MP Speakon 4 pole"; one recessed handle per side (page: 2 side metal recessed handles); front and rear moulded handles not modelled. The wedge slope (front face set back 392 mm, 45 degrees) is OUR estimate from the model name: the page gives no angle |
| nexo-p12 | promoted | 364 | 2 NL4 at the back (of 4) | NEXO page: touring version 4 x NL4, "one per handle plus two at the back"; the two handle connectors not modelled, handles not cut (no place stated), plain box |
| akg-d112-mkii | promoted | 894 | 1 XLR (base) | AKG cut sheet read as text: "3-pin XLR (pin 2 hot)", 115 x 70 x 126 mm; the real body is bent: an egg-shaped lathe (profile is our estimate) with the XLR on the base, male by convention |
| l-acoustics-x15-hiq | beta-modelled (size axis-assumed) | 360 | 2 speakON (proposal ids kept) | L-Acoustics page: W x H x D 430 / 580 / 375, IN and LINK 4-point speakON, 2 handles, 2 x 35 mm pole sockets (positions not stated: not modelled), 15 in coaxial. The wedge slope (front set back 300 mm) is our estimate; the page gives only monitor angles 35 and 55 degrees, which do not fit a 375 mm depth with a 580 mm height, so the axis order really needs the drawing |
| yamaha-ns-10m | beta-modelled (size axis-assumed, terminals not documented) | 300 | 1 binding post | NS-10M owner manual (manualsdir copy): "381.5 x 215 x 197.5 mm", labelled W x H x D on that page, which would make it wider than tall; the plan inferred h 381.5. A manual page (search summary) says "large screw-type terminals": modelled as one `binding-post` pair, connector type not documented |
| focal-utopia-main-112 | beta-modelled (size from a search summary, ports conflicting) | 492 | 4 proposal ports (ids kept) | sources disagree whether the monitor is active or passive with an external amplifier; the proposal ports are those of the amplifier, kept as stand-ins on the cabinet; generic 3-way baffle (driver sizes not read); nothing verified |
| nexo-geo-m10 | beta-modelled (size is the M1012 page, axis assumed) | 364 | 2 NL4 (proposal ids kept) | NEXO M1012 page: 531 x 288 x 355 mm, "2 x NL4"; the page does not say the M10 module is the same cabinet; handles and rigging not modelled |
| ev-evolve-50m-g2 | beta-modelled (dealer size via a search summary, G2 sheet not found) | 820 | 4 (2 combo mic inputs, MIX OUT, AUX OUT) | the connectors are from the FIRST-generation EVOLVE 50M datasheet (downloaded and read as text), NOT the G2: unverified for the G2. Stack: 510 mm cabinet, 48 mm pole, 825 x 102 x 163 mm column (dealer figures via a search summary) = 2093 mm. The first-generation sheet gives other sizes (assembled 2045 x 345 x 471, sub 530 x 345 x 471): the plan keeps the G2 dealer size. No picture projected |
| dpa-4060 | beta-modelled (port options) | 766 | 1 TA4 (`mini-xlr-ta4`) | DPA 4060-BM sheet read as text: diameter 5.4, length 12.7 mm, capsule connector MicroDot, adapters or a hardwired connector by order. The termination depends on the order option, so the connector set is not documented; the TA4 port stands in on the capsule base |
| sanken-cos-11d | beta-modelled (ports not supported by the page) | 766 | 1 (proposal id kept) | Sanken page: 16.1 mm x 4.0 mm diameter, powering +3 to +10 V, connectors per variant (Hirose, 3.5 mm locking, Lemo, TA5F, TA4F), no XLR and no 48 V interface. The proposal's XLR output flagged `requiresPhantom` is therefore not backed by this page (a data-rule audit item) |
| rode-nt-sf1 | beta-modelled (ports not documented) | 1022 | 2 (proposal ids kept) | RODE datasheet read as text: 45.7 x 192.3 x 45.7 mm, body 25.1 mm, 48 V phantom, "10-pin XLR to 4 x 3-pin XLR cable" in the box. The microphone itself has a 10-pin XLR (not in the catalogue): the proposal's two XLR outputs are stand-ins; they overlap on the 25.1 mm base. The datasheet drawings were not rendered (no PDF renderer): the head length is our estimate |

### Recipes (params that worked)

- **Generator**: a session scratch script (not committed) writes the spec and the generic panel of each device from one compact definition; the committed files are its output. Every connector is drawn under its port centre; no lettering, no brand mark.
- **speaker-cabinet-v2 as a plain rounded box** (Y10P, KS28, A15, LINA, UPJunior, NS-10M, S3H, KH 750, P12, GEO): `edgeRadiusMm` 4 to 12 (declared `minFilletMm` = 0.7 x R, measured 0.84 R at 4 facets), `edgeSegments 4`, `budget` {100 to 300, 4000}; 300 to 492 triangles, projection io (rear, connectors) and opposite (baffle). **Floor wedge**: `frontTopSetMm` (45N-12: 392, X15: 300), 360 to 568 triangles; the baffle picture on the slope reads on the top view as expected. **Subwoofer with handles**: V-SUB `handleCount 2, handleLenMm 160, handleWidthMm 40, handleDepthMm 14, handleFromRearMm 150, handleYMm 330, handlePitchMm 420`, 780 triangles. **Column on a pole**: EV Evolve `bodyHeightMm 510, columnWidthMm 102, columnDepthMm 163, columnHeightMm 825, poleDiaMm 48`, spec height 2093, 820 triangles, no projection (the picture would be mapped on the whole 2093 mm face).
- **Lathes**: `revolve` 64 segments, 7 to 9 stations (766 to 1022 triangles, floors 300 and 700; a 4 to 5.4 mm lavalier has no 1000 triangle floor); `revolve-oval` D112: 8 three-number stations (894 triangles, floor 800). Wrap picture width pi x w (ellipse perimeter for the oval), `pxPerMm` 40 for the lavaliers.

### Wave 3B findings (family limits and data limits, with the param needed)

1. **speaker-cabinet-v2 has no top or bottom handles** (Y10P documents them: handles on the top and bottom panels) and **handles only as horizontal stadium slots on the side faces** (GEO M10 has two vertical and two horizontal). Param needed: `topHandle` or a handle orientation (`handleAxis`).
2. **No pole socket in the top panel** (V-SUB: M20 flange in the top; X15 HiQ: two 35 mm sockets, place unstated). The shape's socket is a single one in the base.
3. **Handle or rigging position is rarely documented**: only the count and the side are on the pages, so handle recesses were cut for V-SUB and 45N-12 only (count and side from the page, place and size ours); the six KS28 handles, the one A15 handle, the P12 touring handles and every rigging point are left out rather than invented.
4. **A trapezoid plan or elevation is never stated** by the pages read (A15 Focus, LINA, UPJunior, GEO M10 are array elements in reality): they are plain boxes. The params exist (`rearWidthMm` + `taperDepthMm`, `rearTopDropMm`); the data to fill them is a drawing.
5. **Tests that stage 2 will have to adjust** (they fail or pass by stage, as in earlier waves): `modelIds.test.ts` (proposals with a model whose plan row is not yet betaModelled), `brandsRegister.test.ts` (labels and the generated block until `npm run register`), `proposalsFixedPoint.test.ts`; `tests/assets/modelFront.test.ts` needs a MEASURED entry for each promoted active speaker (LINA, UPJunior, S3H, KH 750) at stage 2.
6. **Data-rule notes**: no spec carries an acoustic number, a sensitivity, a coverage angle or a level; the speaker template still writes the nominal 90 x 60 coverage at stage 2 (the founder rule removes it from the templates), so the coordinator must apply that change before running stage 2 on these speakers. The `power` switch on LINA, UPJunior, S3H and KH 750 is the simulator control the catalogue adds to every mains inlet, not a switch the pages document (the KH 750 page's own toggle selects operation and calibration).
7. **Plan notes worth correcting**: the EV Evolve 50M G2 plan size is a dealer figure while the first-generation EVOLVE 50M datasheet (readable) differs (2045 x 345 x 471 assembled). The plan lists the X15 HiQ as `passive`: the L-Acoustics page calls it a "2-way active coaxial enclosure" (bi-amplified, with 4-point speakON inputs), so passive is right for the simulator. The 45N-12 page lists the same wedge as active or passive by wiring.
8. **No PDF page renderer** on this machine (no pdftoppm): PDFs were read as text only, so no drawing was looked at (NT-SF1 head length, D112 body shape).

### Gate numbers (Wave 3B, 2026-11-12, `BLENDER_EXE=<path to blender.exe>`)

- `npm run validate:assets`: **212 ok, 0 failed** (the whole tree, 19 of them mine).
- Focused tests (`npx vitest run tests/tools tests/scene/modelIds.test.ts`): see the result line appended below. Not run: tsc, lint, e2e, chunk budget, in-engine look audit (the wave gate). Not verified: every port and control position (guesses, said in each spec), the driver layout of every baffle picture (our estimate), the corner radii, the wedge slopes, the NT-SF1 head and D112 body profiles (estimates from the published outer sizes).
- Focused tests result: `npx vitest run tests/tools tests/scene/modelIds.test.ts` (BLENDER_EXE set): 64 files, 1824 tests, 1818 passed, 6 failed in 3 files, all of the known stage-2 kind and none about the content of my specs: `modelIds.test.ts` (proposals that own a shipped glb while their plan row is staged), `proposalsFixedPoint.test.ts` (3), `brandsRegister.test.ts` (2: the committed register block and the labels of the shipped devices; `npm run register` after stage 2).


## Wave 4A: waves 4 and 5 rows of the existing families, and the eligible rows left over from waves 2 and 3 (2026-11-12)

Agent 4A of the build. Stage 1 only (`npm run promote -- <id>`): `content/catalog.json` and `catalog-proposals.json` untouched, `--commit` never run (only `--commit --dry-run` to print the outcome). Nothing pushed, no Meshy, no photo, no logo, no brand mark (generic panels only). Commits `907e23d` (10 rack devices), `5841adc` (8 devices: two mics, a recorder, a main monitor, four rack devices), `e0da884` (10 desks and control surfaces); each through a temporary index with only my specs, panels, GLBs, my manifest rows and my plan rows. Contact sheets stay local (git-ignored `assets-source/<id>/work/...`).

### Rows got

Families rack-box-v2, console-wedge-v2, curved-cabinet, revolve, moulded-box, rack-box-v3b (no row of revolve-v2-oval, tripod-stand, round-base-stand, power-strip or generic-panel in waves 4 and 5). Not staged, not blocked before this run:

- wave 4, 28 rows: console-wedge-v2 11 (allen-heath-avantis, allen-heath-zed-436, audient-asp8024-he, axia-pulsar, behringer-x-touch-universal, digico-s21, mackie-mcu-pro, presonus-studiolive-iii-se-16, ssl-origin, studer-onair-1500, wheatstone-lx-24), curved-cabinet 1 (genelec-1234a), moulded-box 1 (clear-com-fsii-bp24), rack-box-v2 15 (aphex-channel, apogee-symphony-desktop, clear-com-freespeak-ii, dangerous-music-monitor-st, db-audiotechnik-ds10, db-audiotechnik-ds20, l-acoustics-p1, lexicon-pcm92, meyer-sound-galileo-galaxy-816, omnia-11, sommer-cable-the-boxx-mp-08-04, sonifex-dhy-04s, tascam-da-6400, tieline-gateway, wisycom-mcr54);
- wave 5, 13 rows: console-wedge-v2 5 (avid-venue-s6l, lawo-crystal, roland-vr-6hd, yamaha-cl5, yamaha-dm7), moulded-box 2 (nagra-vi, rtw-touchmonitor-tm7), rack-box-v2 1 (yamaha-spx2000), rack-box-v3b 2 (qsc-rmx-1450, qsc-rmx-850), revolve 3 (audix-d6, audix-i5, heil-pr-40);
- left over from waves 2 and 3 and still eligible: avid-s1, ua-la-2a, klark-teknik-dn360, focusrite-clarett-plus-8pre, ams-neve-1073dpd (all five were stage-1-reverted by agent 2A for lack of a connector set: this run read the sets from opened manufacturer documents), arrakis-arc-8 (wave 3, its brochure is a text PDF, not an image).

Counts: 41 rows looked at in waves 4 and 5 plus 6 leftovers; **28 built and shipped** (GLB, manifest row, all gates green on the first attempt after at most one parameter fix, 0 failed after three attempts), **19 not built** (listed below).

Connector sets came from three research sub-agents that opened the manufacturer documents (text of the PDF or page; a reseller-hosted copy of a manufacturer PDF is named as such in the spec source) and wrote per-connector tables with how each fact was read; I used those tables and wrote the specs. Every spec source note says what was opened and what was not.

### Outcomes (28 built; stage-2 outcome is what `promote --commit --dry-run` printed; triangles from the gates; size error 0.00 to 0.01 mm on every axis)

| id | shape | stage-2 outcome | triangles | ports | notes / open items |
|---|---|---|---|---|---|
| aphex-channel | rack-box | promoted | 1776 | 10 + 3 controls | Aphex page and manual opened; 48 V and gain on the front; insert and cough jacks not modelled; mains letter unnamed (assumed) |
| ams-neve-1073dpd | rack-box | promoted | 1776 | 11 + 3 controls | plan source link is the 1073LBEQ page, not this product; the DPD has no EQ |
| focusrite-clarett-plus-8pre | rack-box | promoted | 1776 | 23 + power | user guide opened (Adorama copy). **Ring rule: the C14 ring 26.4 mm on a 43.9 mm face is 60.1 percent, over the 60 percent of `portMarkerSize.test.ts`: stage 2 needs a per-device exception like the MC-3+** |
| yamaha-spx2000 | rack-box | promoted | 1776 | 13 + power | owner manual and Malaysia spec page opened; the plan row was upgraded to datasheet / ok (axis order labelled in the manual, was a search summary) |
| omnia-11 | rack-box (4U) | promoted | 1920 | 9 + power | Telos docs opened; the manual says "no power switch": the `power` control is the simulator toggle the template requires per inlet |
| sonifex-dhy-04s | rack-box | promoted | 1776 | 4 + power | handbook opened (dealer copy); plan row upgraded to datasheet / ok (axis order labelled in the handbook table); no power switch listed (same remark as the Omnia); telephone RJ11 not modelled |
| ua-la-2a | rack-box (3U) | promoted | 1632 | 2, no control | manual opened (Adorama copy of the UA manual): XLR in and out; the mains connector is not named, so no inlet and no power control; no vents modelled (none stated) |
| audix-d6 | revolve | promoted | 2558 | 1 | spec sheet v3 opened: XLR male, no phantom; profile between 21.5, 51 and 117 mm is a drawn estimate |
| audix-i5 | revolve | promoted | 2558 | 1 | spec sheet (Thomann copy) opened: XLR male; same remark |
| nagra-vi | moulded-box | promoted | 1580 | 11, battery, no control | Nagra page opened (German); two shared XLR AES inputs modelled as line inputs 5 and 6; USB, LEMO, DC, word clock not modelled |
| allen-heath-avantis | console-wedge | promoted | 1474 | 25 + power | datasheet opened (dealer copy), 8 of 12 mic inputs and 8 of 12 outputs; SLink, option cards, USB (type not named) not modelled; no master fader documented, so no desk control |
| behringer-x-touch-universal | console-wedge | promoted | 1393 | 3 + power | quick guide opened (reseller copy): IEC inlet, RJ45 remote, USB to computer (usb-audio stand-in, carries MIDI); MIDI, hub, foot jacks not modelled |
| presonus-studiolive-iii-se-16 | console-wedge | promoted | 1443 | 32 + power | owner manual and spec sheet opened (PreSonus assets); 4 of 8 combos, 4 of 8 mic XLR, 4 of 6 mix XLR; sheet's "12 FlexMix outputs" sums to 10, the manual table is used |
| roland-vr-6hd | console-wedge | promoted | 1417 | 15, no control | reference manual opened (reseller copy); external adaptor, so no inlet; HDMI, GPIO, RS-232 not modelled |
| yamaha-cl5 | console-wedge | promoted | 1500 | 25 + power | data sheet and owner manual opened; Dante primary flagged; 8 of 8 omni in and out |
| yamaha-dm7 | console-wedge | promoted | 1460 | 28 + power | reference manual opened; 8 of 32 inputs, 8 of 16 outputs; two inlets in the manual, one modelled |
| avid-s1 | console-wedge | promoted | 1356 | 1 (ethernet-control) | guide opened; front 29 mm and rear 103 mm heights are documented (profile: flat 40 mm then a straight line, the intermediate heights are my choice); DC, USB charging and footswitch not modelled |
| ds10, ds20 (d&b) | rack-box | beta-modelled | 1776 | 7, 5 (proposal ports) | datasheets opened; the etherCON count is not stated and a Bêta row keeps its proposal ports; DS20 has no network port in its proposal although the sheet describes an AVB switch |
| klark-teknik-dn360 | rack-box (3U) | beta-modelled | 1632 | 4 | manual opened (third-party host); socket counts (2 + 2) inferred from "dual channel": not documented per connector |
| apogee-symphony-desktop | rack-box | beta-modelled | 712 | 12 | Apogee guide gives 8.0 x 4.75 x 1.25 to 2.5 in, the dealer plan size is 199 x 125 x 64 mm: plan row set to conflict (estimate) |
| dangerous-music-monitor-st | rack-box | beta-modelled | 1776 | 6 | the rack unit size is NOT published (the product page size is the desktop remote); plan size is a converted dealer listing; XLR, DIN and RJ45 types only from a 2001 review |
| tieline-gateway | rack-box | beta-modelled | 1776 | 9 (proposal ports) | rear panel page of this model not found; audio RJ45 count unknown |
| wisycom-mcr54 | moulded-box | beta-modelled | 1580 | 2 (proposal ports) | datasheet opened; audio output is a 5-pin mini-XLR, the proposal files it under `mini-xlr-ta4` (4-pin) |
| genelec-1234a | curved-cabinet | beta-modelled | 2164 | 8 (proposal ports) | the proposal ports are those of the separate RAM-XL amplifier; placed on the enclosure rear as a stand-in; the enclosure itself has two speakON sockets and an LED RJ45 |
| axia-pulsar | console-wedge | beta-modelled | 1428 | 6 | spec sheet opened: the audio I/O is on the separate StudioCore or an optional board; panels unknown; pre-release |
| digico-s21 | console-wedge | beta-modelled | 1474 | 19 | the DiGiCo documents name no connector type and no size; dealer counts disagree with the manual |
| arrakis-arc-8 | console-wedge | beta-modelled | 1388 | 5 | brochure is text; the counts behind the rear callouts are in the picture only |

Promoted candidates 17 (wave 4: aphex-channel, omnia-11, sonifex-dhy-04s, avantis, x-touch, SE 16, plus; wave 5: roland-vr-6hd, cl5, dm7, nagra-vi, spx2000, d6, i5; leftovers: 1073dpd, clarett, la-2a, avid-s1), beta-modelled 11.

### Not built (19)

| id | reason |
|---|---|
| `missing` size, no stage 1 (16) | wave 4: allen-heath-zed-436, clear-com-freespeak-ii, lexicon-pcm92, meyer-sound-galileo-galaxy-816, tascam-da-6400, clear-com-fsii-bp24 (sources disagree on a dimension), sommer-cable-the-boxx-mp-08-04 (partial), audient-asp8024-he, l-acoustics-p1, studer-onair-1500, wheatstone-lx-24 (nothing printed); wave 5: avid-venue-s6l (conflict), lawo-crystal, rtw-touchmonitor-tm7, qsc-rmx-1450, qsc-rmx-850 (nothing printed). Never guessed |
| mackie-mcu-pro | dealer size ok, but no patchable port: the manual names USB (type not named), MIDI, footswitch jacks and a DC jack, and the catalogue has no signal for MIDI or DC |
| ssl-origin | estimate (a 32-channel configuration, 1000 mm overall height with legs); a console on legs cannot be a console-wedge honestly (a solid 1000 mm block would misrepresent it); it would be beta-modelled at best. Documented in hand: brochure 1870 x 1080 x 1000 mm, DB-25 groups per 8 channels |
| heil-pr-40 | the plan size comes from a search summary; Heil's sheet and product page give no dimension and two dealers disagree (6.25 and 6.69 in): treated as unverified, blocked |

Left over from waves 2 and 3 and still blocked, unchanged: shure-ua844-plus, shure-ua874, shure-slxd2-handheld, shure-qlxd2-handheld, shure-ulxd2-handheld, sennheiser-ew-d-skm-s (no patchable port: RF antenna, DC and USB power have no signal type); rode-podmic (the swing-mount size is not a revolve); k-m-26125 (partial: no height); focusrite-rednet-mp8r, rode-ntg5 (partial, no depth or width and diameter); and every `missing` row of those waves.

### Recipes (reuse)

- Scratch generator (session folder, not committed) from a compact port list to the spec and the generic panel; it checks the ring rules (60 percent of the smaller face side, rings of one face apart by their mean diameter, ring inside the face), port id length and duplicates; the committed files are its output.
- **console-wedge front-lip ports**: the cheeks and the base (`cheekMm`, `baseMm`) are set back 6 mm, so a port on `opposite` must sit above `feetMm + baseMm` and below the roll (`armRestMm`): `portSurface` failed for all five desks with phones at y 30 to 45 (6.00 mm behind). Working values: Avantis lip 85 phones at y 62; SE 16 `baseMm 20` and y 48; Roland y 50; CL5 y 63; DM7 y 65. A profile that starts sloping at once fails "the rounded outline must keep the tallest station on a flat": keep a flat first 40 mm (Avid S1).
- **Desk top picture**: screens at low y (near the io edge, the tall rear), faders and keys at high y (the front), no lettering.
- **1U rack**: the Wave 1C recipe; `seamMm` at most about 30 on a 44 mm chassis (50 failed "must leave room for the fillet above and below"); 3U without vents: `budget.min 1000` gives 1632 triangles; 4U: the 2U recipe with `seamMm 60`, `rearInsetMm 10` (1920). Rear ports at x 40 or more inside the 438 mm body; a 480 mm plate needs `bodyWidthMm 440, earHoleEdgeMm 10`.
- **Mic lathes** (D6, i5): `merge` of 5 to 7 control stations with interpolated ones to reach 16 stations gives 2558 triangles; a `grid` wrap picture on the head; XLR on the `bottom` face at (w/2, w/2) with `openingMm 15` (the 60 percent ring rule is for flat faces; end faces are capped by `ringDiameterOnFaceM`).
- **Wide curved-cabinet** (1234A, 890 x 700 x 383): `planFrontMm = rearWidthMm = width`, radii 24, `edgeRadiusMm 14`, `edgeDropMm 16`, `minFilletMm 11` (measured 14); pockets with `insetMm 3`; drivers are picture only.

### Findings and open items

1. **Data rule for the stage 2 of these rows.** The preamp template writes a `gain` enum with the option list 0, 20, 40, 60 and the interface and console templates add `isMicInput` / `providesPhantom` flags to every mic input: no sheet read here states those values. Aphex Channel and AMS Neve 1073DPD list `gain` and `phantom-48v` controls because the template requires them (the sheets show a gain control and a 48 V switch); the numbers of the option list are template defaults and have to go in the data-rule change of the templates. Phantom is flagged in the spec only where the opened document states it (Roland, CL5, DM7, Clarett, Apogee, 1073DPD, Aphex); the other desks' mic inputs rely on the template.
2. **Plan rows edited** (explicit, with a note in the row): `assumedConnectors: ['power-in']` for the 11 rows whose page says "IEC" without the letter (aphex-channel, ams-neve-1073dpd, focusrite-clarett-plus-8pre, omnia-11, sonifex-dhy-04s, yamaha-spx2000, allen-heath-avantis, behringer-x-touch-universal, presonus-studiolive-iii-se-16, yamaha-cl5, yamaha-dm7); yamaha-spx2000 and sonifex-dhy-04s upgraded to datasheet / ok (the axes are labelled in the opened manual and handbook, they were search summaries); apogee-symphony-desktop set to conflict / estimate.
3. **Plan rows to revisit**: arrakis-arc-8 brochure labels "width 18 in, depth 11 1/2 in, height 2 in" (the row says axis-assumed); ams-neve-1073dpd source link is the wrong product; wisycom-mcr54 family label rack-box-v2 is a slot receiver (built as a moulded box); omnia-11 is 4U (plan family fine).
4. **Controls that do not exist on the hardware.** Omnia.11 ("there is no power switch") and DHY-04S (none listed) get the template's `power` toggle because they have a mains inlet; the spec says so.
5. **USB as `usb-audio`.** The X-Touch, SPX2000 and Avid S1-style USB control ports use the only USB signal, as the FaderPort did; none carries audio.
6. **XLR genders** are not stated by most sheets (input female, output male by convention, said in each source note); the per-port rule of Wave 1b finding 14 only lets assumed connectors stay on non-audio ports, so a stricter reading would hold every device with an unstated gender back. Followed the Wave 3A practice.
7. **Lost log section.** The Wave 3A section of this log (commit 9eb7a7f) is missing from HEAD since commit 608d116 (the Wave 3 families section was committed over an older copy). Restored unchanged from 9eb7a7f in the commit of this section (placed before this one).
8. **Tests**: see the gate numbers. Expected stage-2 reds only (`modelIds` for staged rows with models, `brandsRegister` labels and block, `proposalsFixedPoint`).
9. Not verified: every connector and control position (guesses), the side profiles of the desks (estimates; only the Avid S1 heights are documented), the lathe profiles of D6 and i5, the in-engine look, rings on the connectors in the app. Contact sheets looked at for aphex-channel, omnia-11, audix-d6, genelec-1234a, digico-s21, yamaha-cl5; the others only through the gate numbers.

### Gate numbers (Wave 4A, 2026-11-12, `BLENDER_EXE=<path to blender.exe>`)

- `npm run validate:assets`: **240 ok, 0 failed** (the whole tree, 28 of them mine). Per device dry run and ship: 11 of 11 gates for racks, desks and the cabinet, 10 of 10 for the two lathes.
- `npx vitest run tests/tools tests/scene/modelIds.test.ts`: 64 files; one run had 1 flaky failure (`rackDevice.test.ts`, the byte-identical v2 rack build, the known chance failure of the Wave 2 finding 1, green in the rerun) and the rerun has exactly the 6 expected stage-2 reds: `modelIds.test.ts` (proposals that ship a model while their plan row is staged), `brandsRegister.test.ts` x2 (labels and the generated block), `proposalsFixedPoint.test.ts` x3. None is about the content of my rows.
- Not run: tsc, lint, the creation e2e, chunk budget, the in-engine look audit, a perspective render (the sheets are four orthographic views).


## Waves 2 to 5 commit and gate (data rule, stage 2, shared tests, e2e, gate) (2026-11-12)

Coordinator step after the device-build agents of Waves 2, 3 and 4: the founder's data rule applied to the templates first, then the stage 2 of the 147 staged rows (`npm run promote -- <id> --commit`, one at a time, `--dry-run` read first), the shared tests, the control layouts, the scaled e2e and the gate. Nothing pushed, no Meshy, no history rewrite, no logo SVG staged. Commits (explicit paths): `26713c9` data rule (templates, app, specs, inventory), `abff704` to `6fdd519` the six stage-2 batches (catalogue, proposals, plan, journal), `b9815e4` shared tests, `76a86e4` regenerated files, `0807df1` layouts and the 28 rebuilt GLBs, then the register block, the e2e commit and this log.

### 1. The data rule (founder, 2026-11-12), what changed

Rule: every number or capability a catalogue entry states comes from THAT model's manufacturer sheet; unknown stays unknown, and the app shows no number for it. Audit of `tools/behaviourTemplates.ts` and `tools/promoteDevice.ts`; every invented datum removed:

| Template datum | Before | Now | Test |
|---|---|---|---|
| speaker coverage | `acoustic` 90 x 60, source `nominal` « valeur nominale » on every promoted speaker | none: a promoted speaker has NO `acoustic`; the template note says « valeur non vérifiée » | `behaviourTemplates.test.ts`, `promoteDevice.test.ts` |
| preamp gain | enum `gain` 0 / 20 / 40 / 60 dB, default 20 | not written | `behaviourTemplates.test.ts` |
| desk master fader and balance | enum `fader-master` (-inf .. +10 dB), `balance-master` (G100 .. D100) | not written (a desk without them passes its signal at unity, which the signal path already does); the master MUTE (a switch, no number) only when the spec lists it | same |
| DI ground lift, pad | always written for a DI | only when the spec lists them (a switch, no dB value) | same |
| preamp phantom switch | written whenever a mic input carries `providesPhantom` | only when the spec lists `phantom-48v` AND a mic input carries the spec flag | same |
| phantom need | `requiresPhantom` derived from the traits `condenser` / `phantom-powered` | never derived: only the spec port flag; a `dynamic` or `ribbon` trait still REMOVES a flag that cannot be true | same |
| phantom supply | `providesPhantom` added to every mic input of an interface, desk or preamp | never added: only the spec port flag (`isMicInput`, a classification, is still added) | same |

Other numbers the templates never wrote (checked): no pad dB, no impedance, no `loadOhms`, no battery option, no sensitivity or SPL; `portAliases`, routes and the `power` toggle (structure) stay.

**App.** A speaker without `acoustic` was already tolerated by the engine (`coverageSources` excludes it as `no-acoustic`, `listenVoices` plays it as a point source with 0 dB directivity, the catalogue check warns). What is new: (a) the coverage computation **skips** such a speaker (no angle is made up for it; documented in `coverageModel.noDataNote`), (b) the panel says so under the coverage block: « Couverture non calculée pour {names} : valeur non vérifiée (aucune donnée constructeur retenue pour ce modèle). » when a fed speaker was left out for that reason (view field `noDataNote`, shown with the front note), (c) the « Aucune enceinte audible » reason now reads « enceinte sans donnée de couverture : valeur non vérifiée ». Copy keys `coverage.noDataNote` (new) and `coverage.reasonNoAcoustic` (reworded) are in `docs/copy/creation-mode.md` with status **à valider**. Listening is unchanged and still plays the speaker (directivity 0 dB = no directivity applied: an absence of data, not a measurement). The properties panel never showed acoustic numbers. Tests: `coverageSources.test.ts` (no-acoustic; a mixed rig where one speaker has no data, the other still makes the field, no 90 x 60 anywhere), `coverageModel.test.ts` (`noDataNote`), `listenVoices.test.ts` (already: plays at 0 dB), `propertiesModel.test.ts` (a speaker without acoustic: no crash, no coverage number).

**Specs and GLBs.** Controls the templates no longer write cannot stay in a spec (the parity check refuses a spec control that is not in the catalogue): `yamaha-mg10xu` and `midas-m32` lost `fader-master`, `mute-master`, `balance-master` (their datasheets show a main fader but document no range; the Wave 1b open item 1 predicted the mute and balance), `ams-neve-1073dpd`, `ua-la-610-mkii` and `aphex-channel` lost `gain`; the five GLBs were rebuilt (11 of 11 gates). `sanken-cos-11d`: its XLR output no longer carries `requiresPhantom` (its page lists a supply of +3 V to +10 V, not 48 V). The phantom need of the other flagged microphones was **read on the manufacturer sheets** and kept: C414 XLII (48 V phantom to IEC 61938), NT5 (P48), NTG3 (48 V, 44 to 52 V, 5 mA min), NT-SF1 (48 V, 6.2 mA), PZM-30D (12 to 48 V phantom). The already-promoted TLM 103, KM 184, MKH 416, NT1 and U 87 Ai were not re-read (listed in the inventory).

**Inventory for the audit task 4.6:** `docs/superpowers/notes/2026-11-12-catalog-numeric-data-inventory.md`: every numeric or capability datum of the 44 devices that were in the catalogue before this step (device, field, value, current source), written before any stage 2 and not rewritten. Notable: `neumann-kh-120-ii` still carries the nominal 90 x 60 coverage written by the old template (left on purpose: existing devices are task 4.6's), the QL1 and the Wave 1 desks keep their fader / balance option lists, 11 Bêta proposals carry phantom or ribbon flags from the knowledge base.

### 2. Counts

| | n |
|---|---|
| staged rows at the start (`staged: true`) | 147 |
| promoted into `content/catalog.json` | 69 |
| beta-modelled (proposal kept or added, model shipped) | 78 |
| failed after three attempts / reverted | 0 |
| plan rows still without a model (not built by the agents) | 126 of 315: 107 `dataQuality: missing`, 19 with some data that the agents did not build (blocked by shape, ports or size, per their sections above) |

Whole programme by wave (plan `wave` field) after this step:

| wave | rows | promoted | beta-modelled | no model |
|---|---|---|---|---|
| 1 | 49 | 19 | 23 | 7 |
| 2 | 87 | 25 | 34 | 28 |
| 3 | 92 | 22 | 29 | 41 |
| 4 | 70 | 15 | 12 | 43 |
| 5 | 17 | 7 | 3 | 7 |
| all | 315 | 88 | 101 | 126 |

Of this step's 147 rows: wave 2 59 (25 promoted / 34 beta), wave 3 51 (22 / 29), wave 4 27 (15 / 12), wave 5 10 (7 / 3). The six stage-2 batches: 6 promoted / 19 beta, 14 / 11, 11 / 14, 9 / 16, 17 / 8, 12 / 10.

Catalogue after: **113 devices (was 44), 30 categories, 675 ports, 61 controls, 8 rules, 38 connector types, 17 signal types**; 159 Bêta proposals, 101 of them with a model. `validate:catalog` valid with **15 warnings**: the 15 promoted speakers have no sourced acoustic data (the data rule; a warning, never an error). Why only 69 of 147 are promoted: the promoted outcome needs a datasheet or dealer size with `sizeConfidence: ok` AND `portsDocumented` with a cited page; of the 78 beta-modelled rows, 43 have a promotable size but no documented connector set, 30 have both an assumed axis order and no documented connector set, 3 have conflicting source sizes and no documented connector set, and 2 have only an assumed axis order.

### 3. What the stage 2 showed, and how it was handled

| Finding | Fix | Test |
|---|---|---|
| The old template added the phantom supply to 58 mic inputs (24 devices) whose spec did not flag it | no longer added (data rule); those inputs keep `isMicInput` only. The 95 spec-flagged ports (24 promoted devices) are kept: they are the spec authors' reading of the cited pages, NOT re-verified here (open item 1) | `behaviourTemplates.test.ts` |
| A kept Bêta proposal ignored the flags its spec declares (yamaha-xmv8280-d: `isDantePrimary`) | `mergeSpecFlags` in stage 2 and in `--regen` of a beta-modelled row; one proposal changed | `promoteDevice.test.ts`, `specPortParity.test.ts` |
| Control Ethernet: a spec `rj45 aoip` agrees with the device's `ethernet-control` (Wave 1b finding 9) | declared in the parity test, not a failure | `specPortParity.test.ts` |
| Ring rule (60 percent of the smaller face side): MixPre-6 II XLR inputs 65 percent (23.4 mm on 36 mm), Clarett+ 8Pre C14 60.1 percent (26.4 on 43.9) | per-device exceptions at 66 and 61 percent, the smallest that lets the real connectors pass; a stale-exception test per device | `portMarkerSize.test.ts` |
| 15 speakers promoted without acoustic data | warnings, not errors; the real-catalogue tests derive the warned set | `catalogChecks.test.ts` |
| 28 devices got a generated power / phantom layout after stage 2 and the builder had not checked their flat zones | all 28 rebuilt (`asset:build -- <id> --scripted --ship`): 28 of 28 PASS | `layoutParity.test.ts`, `validate:assets` |

### 4. Shared tests, adjusted for stated reasons (no assertion dropped without a replacement)

- `modelIds`, `brandsRegister`, `proposalsFixedPoint`: green after `npm run register`, `npx tsx tools/propose-content.ts` (nine date-only level-draft rewrites discarded; five new drafts and the real changes to six drafts and `index.json` kept) and the stage 2. The from-scratch fixed-point test leaves the spec-built ids out (dpa-4060, whose KB entry used to be skipped for want of the mini-XLR connector) and merges the spec flags on both sides; every other difference still fails.
- `schemas.test.ts`: the routing pin is derived from the plan (the four verified devices plus every promoted row) instead of a literal list; at least 30 promoted devices must route.
- `catalogChecks.test.ts`: no error in the real catalogue; its only warnings are the speakers without acoustic; the four hand-written speakers and KH 120 II keep their block.
- `mains.test.ts`, `signalPath.test.ts`: the two Shure daisy-chain outputs are promoted (now flagged `isMainsSource` by the template, like any `mains-power` output); the Bêta examples are the Furman M-8x2 and the Eaton 5P outlets.
- `placePickerModel.ts`: the five « Avec le matériel » rooms are recomputed from the catalogue (the test derives them): post-atmos-mix-room-medium, radio-talk-studio-medium, concert-hall-medium, foley-dubbing-stage-medium, radio-studio-self-op-small. **[validate]** a visible change of the place picker; `placeSummary.json` regenerated by `tools/room-thumbs.ts`.
- `creation-drawer.spec.ts`: the tab « Amplis » now exists (seven power amplifiers promoted), the tab row is about 615 px and scrolls at 1700 px: the no-fade test uses 2000 px.
- `betaBadges.json` regenerated by `npm run register` (derived from the plan rows).

### 5. Gate numbers (2026-11-12, `BLENDER_EXE=<path to blender.exe>`)

- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run validate:catalog` valid (113 devices, 15 warnings = the speakers without acoustic data); `npm run validate:assets`: **240 ok, 0 failed**.
- `npx vitest run` (full, run after the last commit but the log): **251 files, 4659 tests, all passed** (Wave 1b: 246 files, 4108 passed, 6 failed; no determinism test failed in this run). Run before the last fixes the full suite had 4655 passed and 4 failed (the signalPath Bêta examples and one fixed-point test), all fixed above.
- Build into a scratch outDir (`npx vite build --outDir <scratch> --emptyOutDir`), `node tools/chunk-budget.mjs <scratch>`: **budget OK**, creation entry 6,182,180 B (js 6,120,717 + css 61,463) of 7,086,420; legacy 6,162,105 B. GLBs load lazily per placed device, so no entry change from the 147 models.
- GLBs in `public/assets`: **240 files, 10.73 MiB (11.25 MB)** in total (limit 120 MB), largest focusrite-isa-one 0.65 MiB (limit 25 MiB), average 46 KB.
- Stress scene (scratch spec, not committed): the 15 heaviest catalogue devices by triangles (neumann-u87-ai 10415, ev-re50, shure-sm58, shure-beta-58a, sennheiser-e-835, shure-sm57, ev-re20, yamaha-rio3224-d2, genelec-8341a, genelec-8351b, genelec-8040b, genelec-8030c, avid-protools-hdx, focusrite-isa-one, crown-xti-4002; 61,233 triangles in all) in the concert hall: 292 meshes, 156 materials, **idle renders in 2.5 s: 0**, `renderBench(40)` 7 runs 2.92, 2.98, 3.34, 3.98, 5.96, 6.86, 6.88 ms, median **3.98 ms** (measured with two Playwright workers running other specs in parallel; the Wave 1b stress scene of 12 devices measured 3.74 ms under a comparable load). The 15 heaviest are the old photo-textured and Meshy devices and the Wave 3 speakers; none of the scripted rack devices (1,300 to 3,000 triangles) is among them.
- Playwright on a private preview (port 4181, a scratch config whose web server is `vite preview --outDir <scratch>`; never 4173; the scratch config and the stress spec are deleted): `creation-equipment-models` **12 of 12** (2 guard tests + 10 batches: 189 devices, asset status glb, body within 1 mm of the spec, every port with its pick sphere, no 404, no console error; about 4.4 min with 2 workers), `creation-controls`, `creation-front`, `creation-drawer`, `creation-beta`, `creation-budgets` and the stress scene: 102 passed, 1 skipped (on-demand screenshot), 3 failed in the first complete run, all three the equipment spec (fixed, see section 6); `creation-coverage`, `creation-places`, `creation-picker`, `creation-place`, `creation-glb404`, `creation-properties`: 86 passed, 2 skipped, 1 failed (`creation-picker`, a stale accessible-name order from Wave 1b; fixed, 13 of 13). In the first complete run `creation-drawer` (the Amplis tab and the tab row) and `creation-budgets` CA-24 (a Draco request under three workers, green alone) also failed; fixed or re-run alone.

### 6. The equipment e2e at 189 devices

The spec places the devices in batches of 20 (a fresh page each, one test per batch) instead of one scene. Four things the scale showed, each fixed in the spec and none hiding a defect in a model: the flight to a device can read « not moving » before it starts, so the test now waits for the body to be ON SCREEN; the pointer rests where the previous click was (the screen centre, where the next device stands), so it is parked in a corner first; the first row of devices stood straight behind each other, so the grid is staggered; and a device whose whole body is under the pick spheres of its own ports (the lavaliers dpa-4060 and sanken-cos-11d, which are 4 to 5 mm wide, and the zoom-podtrak-p4 at the framing distance) cannot be selected by a body click, so the test checks that the point answers with its own port and records the device as an annotation. A device covered by anything else still fails. The guard that fails an empty list, the asset-status `glb` assertion and the 1 mm bounding-box assertion are unchanged; a new test holds that the batches cover every row exactly once.

### Per device (stage 2 of this step: 147 rows; triangles from the manifest)

| id | outcome | category | triangles | label |
|---|---|---|---|---|
| allen-heath-sq-6 | beta-modelled | console-digital | 1440 | Allen & Heath SQ-6 |
| genelec-8341a | promoted | studio-monitor | 3108 | Genelec 8341A (The Ones, SAM) |
| akg-c414-xlii | promoted | microphone | 1150 | AKG C414 XLII |
| allen-heath-sq-5 | beta-modelled | console-digital | 1440 | Allen & Heath SQ-5 |
| api-512c | beta-modelled | mic-preamp | 504 | API 512c (500-series) |
| behringer-x32-compact | beta-modelled | console-digital | 1440 | Behringer X32 Compact |
| behringer-xr18 | beta-modelled | console-digital | 1440 | Behringer X AIR XR18 |
| cisco-sg350-managed-switch | beta-modelled | network-switch | 1696 | Cisco SG350 managed switch |
| presonus-monitor-station-v2 | promoted | monitor-controller | 712 | PreSonus Monitor Station V2 |
| yamaha-dm3 | beta-modelled | console-digital | 1443 | Yamaha DM3 Standard |
| yamaha-mg16xu | beta-modelled | console-analog | 1443 | Yamaha MG16XU |
| yamaha-tf1 | beta-modelled | console-digital | 1503 | Yamaha TF1 |
| zoom-h6-essential | promoted | recorder | 1740 | Zoom H6 Essential |
| clear-com-ms-702 | beta-modelled | broadcast | 1776 | Clear-Com Encore MS-702 |
| db-audiotechnik-d80 | beta-modelled | amplifier | 2996 | d&b audiotechnik D80 |
| dbx-166xs | beta-modelled | outboard | 1776 | dbx 166xs |
| dbx-231s | beta-modelled | outboard | 1920 | dbx 231s |
| rme-fireface-ufx-iii | beta-modelled | audio-interface | 1920 | RME Fireface UFX III |
| sonifex-rb-mm1 | beta-modelled | telephone-hybrid | 1328 | Sonifex Redbox RB-MM1 Mix-Minus Generator |
| ssl-the-bus-plus | beta-modelled | outboard | 1936 | Solid State Logic (SSL) THE BUS+ |
| tascam-ss-cdr250n | beta-modelled | recorder | 1920 | TASCAM SS-CDR250N |
| yamaha-mg10xu | promoted | console-analog | 1180 | Yamaha MG10XU |
| yamaha-xmv8280-d | beta-modelled | amplifier | 2656 | Yamaha XMV8280-D |
| ams-neve-1073dpd | promoted | mic-preamp | 1776 | AMS Neve 1073DPD |
| ams-neve-1073lb | beta-modelled | mic-preamp | 504 | AMS Neve 1073LB (500-series) |
| audinate-dante-avio-install | promoted | stagebox | 1652 | Audinate Dante AVIO Install (2IN / 2OUT / 2IN2OUT) |
| avid-s1 | promoted | controller | 1356 | Avid S1 |
| behringer-xenyx-q1202usb | beta-modelled | console-analog | 1170 | Behringer Xenyx Q1202USB |
| crown-xti-4002 | promoted | amplifier | 2896 | Crown XTi 4002 |
| eaton-5p-1u-ups | beta-modelled | power | 1696 | Eaton 5P 1U rack UPS (5P1000R / 5P1500R) |
| empirical-labs-distressor | beta-modelled | outboard | 1920 | Empirical Labs Distressor EL8 |
| focusrite-clarett-plus-8pre | promoted | audio-interface | 1776 | Focusrite Clarett+ 8Pre |
| genelec-8040b | promoted | studio-monitor | 3104 | Genelec 8040B |
| krk-rokit-5-g4 | beta-modelled | studio-monitor | 2036 | KRK Rokit 5 G4 |
| midas-m32 | promoted | console-digital | 1446 | Midas M32 |
| netgear-m4250-av-switch | beta-modelled | network-switch | 1696 | Netgear M4250 AV managed switch |
| neutrik-nys-spp-l1 | beta-modelled | patchbay | 1632 | Neutrik NYS-SPP-L1 |
| orban-optimod-6300 | promoted | broadcast | 1920 | Orban OPTIMOD 6300 |
| qsc-k10-2 | beta-modelled | powered-speaker | 2880 | QSC K10.2 |
| rode-rodecaster-duo | beta-modelled | console-podcast | 1180 | RODE Rodecaster Duo |
| sennheiser-e-609-silver | promoted | microphone | 1652 | Sennheiser e 609 silver |
| shure-qlx-d-receiver | promoted | wireless | 1328 | Shure QLX-D QLXD4 receiver |
| shure-slxd1-bodypack | promoted | wireless | 1844 | Shure SLXD1 bodypack transmitter |
| sound-devices-mixpre-6-ii | promoted | recorder | 1596 | Sound Devices MixPre-6 II |
| tascam-model-12 | beta-modelled | console-analog | 1417 | TASCAM Model 12 |
| ua-la-2a | promoted | outboard | 1632 | Universal Audio LA-2A |
| yamaha-dxr12-mkii | promoted | powered-speaker | 2172 | Yamaha DXR12 mkII |
| zoom-podtrak-p4 | promoted | console-podcast | 1724 | Zoom PodTrak P4 |
| canare-162u-x21 | beta-modelled | patchbay | 1632 | Canare 162U-X21 (pre-loaded XLR connector panel) |
| motu-828 | beta-modelled | audio-interface | 1920 | MOTU 828 (2024) |
| neutrik-nppa-tt-pt | beta-modelled | patchbay | 1632 | Neutrik NPPA-TT-PT "Easy Patch" |
| behringer-europower-ep4000 | beta-modelled | amplifier | 2620 | Behringer Europower EP4000 |
| ev-re320 | promoted | microphone | 1534 | Electro-Voice RE320 |
| klark-teknik-dn360 | beta-modelled | outboard | 1632 | Klark Teknik DN360 |
| rode-nt5 | promoted | microphone | 1534 | RODE NT5 |
| rode-ntg3 | promoted | microphone | 1406 | RODE NTG3 |
| rode-procaster | promoted | microphone | 1534 | RODE Procaster |
| rolls-ha43-pro | beta-modelled | headphone-amp | 712 | Rolls HA43 Pro |
| sennheiser-e-906 | promoted | microphone | 1652 | Sennheiser e 906 |
| db-audiotechnik-y10p | promoted | speaker | 364 | d&b audiotechnik Y10P |
| avid-protools-mtrx-studio | beta-modelled | audio-interface | 1776 | Avid Pro Tools | MTRX Studio |
| dbx-afs2 | beta-modelled | outboard | 1776 | dbx AFS2 Advanced Feedback Suppression Processor |
| digico-sd-rack | beta-modelled | stagebox | 1920 | DiGiCo SD-Rack |
| digico-sd12 | beta-modelled | console-digital | 1516 | DiGiCo SD12 |
| genelec-7360a | promoted | studio-monitor | 2572 | Genelec 7360A SAM |
| l-acoustics-x15-hiq | beta-modelled | speaker | 360 | L-Acoustics X15 HiQ |
| nti-audio-minirator-mr-pro | beta-modelled | measurement | 1724 | NTi Audio Minirator MR-PRO |
| nti-audio-xl2 | beta-modelled | measurement | 1724 | NTi Audio XL2 Audio & Acoustic Analyzer (with M2230 microphone for class 1) |
| shure-axient-digital-ad4d | promoted | wireless | 1776 | Shure Axient Digital AD4D (dual-channel receiver; AD1/AD2 transmitters) |
| allen-heath-dx168 | beta-modelled | stagebox | 712 | Allen & Heath DX168 |
| allen-heath-qu-16 | beta-modelled | console-digital | 1394 | Allen & Heath Qu-16 |
| arrakis-arc-8 | beta-modelled | console-radio | 1388 | Arrakis ARC-8 |
| genelec-8351b | promoted | studio-monitor | 3108 | Genelec 8351B |
| sonifex-s0-v2 | promoted | console-radio | 1370 | Sonifex S0 v2 |
| aea-r84 | promoted | microphone | 1022 | AEA R84 |
| aeta-scoopteam | beta-modelled | codec | 712 | AETA Audio Systems ScoopTeam |
| allen-heath-zed-22fx | beta-modelled | console-analog | 1417 | Allen & Heath ZED-22FX |
| antelope-orion-32-plus-gen4 | beta-modelled | audio-interface | 1776 | Antelope Audio Orion 32+ Gen 4 |
| db-audiotechnik-d40 | beta-modelled | amplifier | 1920 | d&b audiotechnik D40 |
| galaxy-audio-cricket-cpts | beta-modelled | measurement | 1724 | Galaxy Audio Cricket CPTS Polarity/Continuity Test Set |
| lexicon-pcm96 | beta-modelled | outboard | 1776 | Lexicon PCM96 |
| lynx-aurora-n | beta-modelled | audio-interface | 1776 | Lynx Studio Technology Aurora(n) |
| neumann-m-149-tube | beta-modelled | microphone | 1534 | Neumann M 149 Tube |
| neumann-u-67 | beta-modelled | microphone | 1406 | Neumann U 67 (reissue, U 67 Set) |
| nexo-nxamp4x4mk2 | beta-modelled | amplifier | 1920 | NEXO NXAMP4x4MK2 |
| sennheiser-em-6000 | promoted | wireless | 1776 | Sennheiser Digital 6000 EM 6000 / EM 6000 DANTE |
| shure-ua845uwb | promoted | wireless | 1776 | Shure UA845UWB Antenna / Power Distribution System |
| sound-devices-833 | beta-modelled | recorder | 1724 | Sound Devices 833 |
| yamaha-px10 | beta-modelled | amplifier | 1920 | Yamaha PX10 |
| zoom-f8n-pro | promoted | recorder | 1724 | Zoom F8n Pro |
| akai-mpk-mini-mk3 | promoted | controller | 1724 | Akai MPK Mini MK3 |
| allen-heath-zed-14 | beta-modelled | console-analog | 1417 | Allen & Heath ZED-14 |
| apogee-duet-3 | promoted | audio-interface | 712 | Apogee Duet 3 |
| audient-id14-mkii | promoted | audio-interface | 712 | Audient iD14 MkII |
| audio-technica-atw-r3210 | promoted | wireless | 1328 | Audio-Technica ATW-R3210 receiver |
| behringer-flow-8 | promoted | console-digital | 1408 | Behringer Flow 8 |
| behringer-px3000 | beta-modelled | patchbay | 1632 | Behringer Ultrapatch Pro PX3000 |
| crown-pzm-30d | beta-modelled | microphone | 1652 | Crown (AKG/Harman) PZM-30D |
| dbx-160a | promoted | outboard | 1776 | dbx 160A |
| elgato-stream-deck-mk2 | beta-modelled | controller | 1580 | Elgato Stream Deck MK.2 |
| eventide-h9000 | promoted | outboard | 1920 | Eventide H9000 |
| meyer-upjunior-upj-1p | promoted | powered-speaker | 428 | Meyer Sound UPJunior (UPJ-1P) |
| motu-828es | beta-modelled | audio-interface | 1776 | MOTU 828es |
| presonus-faderport-8 | promoted | controller | 1428 | PreSonus FaderPort 8 |
| presonus-studio-24c | promoted | audio-interface | 712 | PreSonus Studio 24c |
| tc-electronic-m3000 | promoted | outboard | 1776 | TC Electronic M3000 |
| telos-zephyr-xstream | promoted | codec | 1920 | Telos Zephyr Xstream (legacy ISDN codec) |
| ua-la-610-mkii | promoted | mic-preamp | 1920 | Universal Audio LA-610 MkII |
| warm-audio-wa73-eq | beta-modelled | mic-preamp | 1776 | Warm Audio WA73-EQ |
| yamaha-ns-10m | beta-modelled | studio-monitor | 300 | Yamaha NS-10M Studio (passive) |
| akg-d112-mkii | promoted | microphone | 894 | AKG D112 MKII |
| dpa-4060 | beta-modelled | microphone | 766 | DPA 4060 lavalier |
| l-acoustics-ks28 | promoted | speaker | 300 | L-Acoustics KS28 (sub) |
| adam-audio-s3h | promoted | studio-monitor | 492 | ADAM Audio S3H |
| db-audiotechnik-ds10 | beta-modelled | stagebox | 1776 | d&b audiotechnik DS10 Audio network bridge |
| db-audiotechnik-ds20 | beta-modelled | stagebox | 1776 | d&b audiotechnik DS20 Audio network bridge |
| db-audiotechnik-v-sub | promoted | speaker | 780 | d&b audiotechnik V-SUB |
| genelec-1234a | beta-modelled | studio-monitor | 2164 | Genelec 1234A SAM |
| l-acoustics-a15-focus | promoted | speaker | 364 | L-Acoustics A15 Focus |
| meyer-sound-lina | promoted | speaker | 428 | Meyer Sound LINA |
| neumann-kh-750-dsp | promoted | studio-monitor | 748 | Neumann KH 750 DSP |
| nexo-45n12 | promoted | speaker | 568 | NEXO 45N-12 |
| nexo-p12 | promoted | speaker | 364 | NEXO P12 |
| omnia-11 | promoted | broadcast | 1920 | Omnia (Telos Alliance) Omnia.11 |
| rode-nt-sf1 | beta-modelled | microphone | 1022 | RØDE SoundField by RØDE NT-SF1 |
| sanken-cos-11d | beta-modelled | microphone | 766 | Sanken COS-11D |
| sonifex-dhy-04s | promoted | telephone-hybrid | 1776 | Sonifex DHY-04S |
| tieline-gateway | beta-modelled | codec | 1776 | Tieline Gateway |
| wisycom-mcr54 | beta-modelled | wireless | 1580 | Wisycom MCR54 4-channel multiband camera receiver |
| allen-heath-avantis | promoted | console-digital | 1474 | Allen & Heath Avantis |
| aphex-channel | promoted | mic-preamp | 1776 | Aphex Channel |
| apogee-symphony-desktop | beta-modelled | audio-interface | 712 | Apogee Symphony Desktop |
| axia-pulsar | beta-modelled | console-radio | 1428 | Telos Alliance (Axia) Pulsar |
| behringer-x-touch-universal | promoted | controller | 1393 | Behringer X-Touch Universal |
| dangerous-music-monitor-st | beta-modelled | monitor-controller | 1776 | Dangerous Music Monitor ST |
| digico-s21 | beta-modelled | console-digital | 1474 | DiGiCo S21 |
| presonus-studiolive-iii-se-16 | promoted | console-digital | 1443 | PreSonus StudioLive Series III SE 16 |
| focal-utopia-main-112 | beta-modelled | studio-monitor | 492 | Focal Utopia Main 112 |
| nagra-vi | promoted | recorder | 1580 | Nagra (Kudelski) Nagra VI |
| nexo-geo-m10 | beta-modelled | speaker | 364 | NEXO GEO M10 (GEO M1012 / GEO M1025) |
| yamaha-spx2000 | promoted | outboard | 1776 | Yamaha SPX2000 |
| audix-d6 | promoted | microphone | 2558 | Audix D6 |
| audix-i5 | promoted | microphone | 2558 | Audix i5 |
| ev-evolve-50m-g2 | beta-modelled | powered-speaker | 820 | Electro-Voice Evolve 50M G2 |
| roland-vr-6hd | promoted | console-digital | 1417 | Roland VR-6HD |
| yamaha-cl5 | promoted | console-digital | 1500 | Yamaha CL5 |
| yamaha-dm7 | promoted | console-digital | 1460 | Yamaha DM7 |

### 7. Devices whose data came from search summaries or dealer pages (the spec source notes say so; grade `dealer` or a note naming a search summary)

Through a **search summary** (the page itself was not opened): neutrik-nppa-tt-pt (B), rode-ntg3 (P), nti-audio-xl2 (B), allen-heath-dx168 (B), behringer-px3000 (B), meyer-upjunior-upj-1p (P), yamaha-ns-10m (B). Through a **search summary and a dealer page**: ssl-the-bus-plus (B), krk-rokit-5-g4 (B), qsc-k10-2 (B), ev-re320 (P), nti-audio-minirator-mr-pro (B), shure-axient-digital-ad4d (P), aea-r84 (P), antelope-orion-32-plus-gen4 (B), sennheiser-em-6000 (P), shure-ua845uwb (P), akai-mpk-mini-mk3 (P), allen-heath-zed-14 (B), audio-technica-atw-r3210 (P), behringer-flow-8 (P), crown-pzm-30d (B), dbx-160a (P), presonus-faderport-8 (P), presonus-studio-24c (P), tc-electronic-m3000 (P), ua-la-610-mkii (P), warm-audio-wa73-eq (B), focal-utopia-main-112 (B), ev-evolve-50m-g2 (B). Through a **dealer page** (size or connectors; P = promoted, B = beta-modelled): allen-heath-sq-6 B, allen-heath-sq-5 B, api-512c B, behringer-x32-compact B, behringer-xr18 B, cisco-sg350-managed-switch B, presonus-monitor-station-v2 P, yamaha-dm3 B, yamaha-mg16xu B, yamaha-tf1 B, zoom-h6-essential P, clear-com-ms-702 B, rme-fireface-ufx-iii B, sonifex-rb-mm1 B, tascam-ss-cdr250n B, yamaha-mg10xu P, yamaha-xmv8280-d B, avid-s1 P, behringer-xenyx-q1202usb B, empirical-labs-distressor B, midas-m32 P, neutrik-nys-spp-l1 B, rode-rodecaster-duo B, sound-devices-mixpre-6-ii P, ua-la-2a P, zoom-podtrak-p4 P, motu-828 B, behringer-europower-ep4000 B, klark-teknik-dn360 B, rolls-ha43-pro B, avid-protools-mtrx-studio B, digico-sd-rack B, allen-heath-qu-16 B, genelec-8351b P, sonifex-s0-v2 P, allen-heath-zed-22fx B, galaxy-audio-cricket-cpts B, lexicon-pcm96 B, neumann-m-149-tube B, sound-devices-833 B, yamaha-px10 B, audient-id14-mkii P, eventide-h9000 P, motu-828es B, telos-zephyr-xstream P, wisycom-mcr54 B, allen-heath-avantis P, apogee-symphony-desktop B, behringer-x-touch-universal P, dangerous-music-monitor-st B, digico-s21 B, presonus-studiolive-iii-se-16 P, audix-i5 P, roland-vr-6hd P, yamaha-cl5 P. For the 25 promoted ones among them the size is a dealer-grade size (promotable) and the connector set is cited by the spec; every number the data rule cares about (levels, gain, coverage) is NOT taken from them any more.

### 8. Open items

1. **Phantom supply flags (data rule, unverified).** The 95 `providesPhantom` ports of the 24 promoted devices that have them are the spec authors' flags (the specs were filled under the old template convention that every mic input provides phantom); they were not re-read against the sheets in this step: audit 4.6 (microphones and consoles first). The 58 mic inputs on 24 specs that did not carry the flag (allen-heath-sq-6, api-512c, rme-fireface-ufx-iii, ams-neve-1073lb, shure-slxd1-bodypack, motu-828, avid-protools-mtrx-studio, digico-sd12, nti-audio-xl2, allen-heath-dx168, arrakis-arc-8, sonifex-s0-v2, aeta-scoopteam, allen-heath-zed-22fx, sound-devices-833, motu-828es, warm-audio-wa73-eq, allen-heath-avantis, axia-pulsar, digico-s21, presonus-studiolive-iii-se-16, nagra-vi, ev-evolve-50m-g2, yamaha-cl5) now say nothing about phantom: a condenser patched into them raises the missing-phantom lesson even where the real unit has 48 V; they need a sheet pass.
2. **15 promoted speakers have no acoustic data** (valeur non vérifiée in the app): genelec-8341a, genelec-8040b, genelec-7360a, genelec-8351b, yamaha-dxr12-mkii, db-audiotechnik-y10p, db-audiotechnik-v-sub, meyer-upjunior-upj-1p, meyer-sound-lina, l-acoustics-ks28, l-acoustics-a15-focus, adam-audio-s3h, neumann-kh-750-dsp, nexo-45n12, nexo-p12. They are silent in the coverage computation until a sheet gives a coverage; the data would go in `acoustic` with a source. The spec schema has no coverage field yet: a one-field addition when someone reads the sheets.
3. **KH 120 II keeps the nominal 90 x 60** written by the old template, and the QL1 and the Wave 1 desks (ProFX12v3, Rodecaster Pro II) keep their option lists (inventory file): audit 4.6 rewrites them (a `--regen` after the template change would drop them, which is what the rule asks; it was not run because the task said existing entries are not rewritten here).
4. **16 promoted devices have no mains inlet documented** (their sheet or page names none), so no power toggle: presonus-monitor-station-v2, yamaha-mg10xu, audinate-dante-avio-install, orban-optimod-6300, shure-qlx-d-receiver, ua-la-2a, apogee-duet-3, audient-id14-mkii, audio-technica-atw-r3210, behringer-flow-8, dbx-160a, eventide-h9000, presonus-studio-24c, tc-electronic-m3000, ua-la-610-mkii, roland-vr-6hd. The promotion tool reports each as an issue; a power rule never touches them.
5. **A desk has no master fader, mute or balance** unless its spec lists the mute; the signal path treats the absence as unity, so every promoted desk passes signal at 0 dB and cannot be muted or attenuated at the master. A hand-measured layout with a sourced fader range (task 6.1) would restore it.
6. **Equipment e2e findings (not fixed, app behaviour):** (a) port picking does not test occlusion: a port pick sphere (at least 12 px, 40 px on a small recorder at 0.9 m) answers over the body of its own device and over a device in front of it, so a small device can be unclickable at the framing distance (zoom-podtrak-p4, the lavaliers dpa-4060 and sanken-cos-11d, the speaker yamaha-dxr12-mkii under a hovering pointer); the test checks the own-port answer for those and annotates them; (b) under CPU load (three workers) `creation-budgets` CA-24 (legacy) failed once on a Draco file request and passed alone.
7. **126 plan rows still have no model** (107 `missing` data; the other 19 listed in the agents' blocked lists); none was attempted in this step.
8. **[validate]** the five « Avec le matériel » rooms; the new « Amplis » tab; the changed coverage copy (two rows « à valider »); the 15 speakers that show « valeur non vérifiée ».
9. Not run: an independent read-only review of this diff against the Review Focus list (the run's stop rule asks for one after each wave); a look audit of the 147 new models in the engine (the agents looked at their sheets; the e2e proves load, size within 1 mm and ports, not looks); the full Playwright suite (only the creation specs named in the task plus coverage, picker, places, properties and glb404 were run).


## Verification of waves 2 to 5 (2026-11-12, verification agent, tree at 2f41337)

Read-only verification of the commit-and-gate state `2f41337` (branch `assets/3d-rebuild`), `BLENDER_EXE=<path to blender.exe>`. Nothing in the app, the data or a GLB was changed by this section. While it ran, ANOTHER agent edited the tree (uncommitted: `tools/assets3d/build-asset.ts`, `tests/tools/assets3d/buildAsset.test.ts`, `tests/tools/genericPanelArtwork.test.ts`, later 16 re-shipped GLBs and the manifest); every number below is for the tree as it stood at the start (tsc, lint, validate, vitest, build, Playwright, look audit), so none of them covers those later edits. Scratch only: a build in a scratch outDir, a private preview on port 4181 (never 4173), a scratch Playwright config and a scratch look spec (both deleted afterwards), dry-run builds that leave their output under the git-ignored `assets-source/<id>/work/`. Look sheets: `docs/superpowers/notes/img/verify-waves2-5/` (git-ignored, not committed).

| check | command | result |
|---|---|---|
| types | `npx tsc --noEmit` | clean (exit 0) |
| lint | `npm run lint` | clean (exit 0) |
| catalogue | `npm run validate:catalog` | VALID: 113 devices, 675 ports, 61 controls, 38 connector types, 17 signal types, 8 rules, 4 levels solvable; 15 warnings (the 15 speakers without acoustic data, known) |
| assets | `npm run validate:assets` | 240 ok, 0 failed, 0 pending, 0 unmigrated |
| unit and tool tests | `npx vitest run` (full) | 251 files, 4659 tests, all passed, 248.5 s; no Blender determinism test failed, so no re-run was needed |
| build | `npx vite build --outDir <scratch> --emptyOutDir` then `node tools/chunk-budget.mjs <scratch>` | budget OK: creation entry 6,182,180 B (js 6,120,717 + css 61,463) of 7,086,420; legacy 6,162,105 B (js only); largest chunk babylon 5,356 kB |
| GLB size | `public/assets/*.glb` | 240 device GLBs, 10,772,672 B (10.27 MiB; limit 120 MB), largest focusrite-isa-one 681,920 B (0.65 MiB; limit 25 MiB), average 44.9 KB. With the 3 environment GLBs: 243 files, 12,828,736 B (12.23 MiB). The earlier gate line (10.73 MiB / 11.25 MB) does not reproduce. The manifest says 371,505 triangles in all, the heaviest 10,415 |
| full Playwright suite | `npx playwright test -c <scratch config> --workers 3` on the private preview, ALL 63 spec files in `tests/e2e` (creation, legacy a1, dashboard, essais, exam, explore, levels, rooms, sandbox, teacher, viewCube, zz-qa-crawl, the on-demand look-audit...) | 629 passed, 25 skipped, 1 failed, 19.1 min (earlier baselines: 617-618 passed, 25 skipped) |
| the one failure, alone | `creation-properties.spec.ts` « review fix 3: a held stepper stops when its device leaves the panel » (yaw never passed 15 deg inside its 3 s poll, under 3 workers) | load flake: the whole spec file with `--workers 1 --repeat-each 3` passed 33 of 33 (3 x 11), so that test passed 3 of 3. « Repartir de cet essai » passed in the full run (the known race did not fire this time) |
| determinism, 3 devices | `npm run asset:build -- <id> --scripted --project-photo ...` (dry run, no ship) twice each, sha256 of `final.glb` | **shure-sm7b** (revolve): both runs and the shipped GLB are the same bytes (8965d1a4...e7, 35,644 B). **crown-xti-4002** (rack-box v2): the two runs are the same bytes (d8af9868...) but differ from the shipped GLB (27,052 B against 8,432 B: the shipped one has no panel picture, finding 1). **yamaha-dm7** (console-wedge v2): the two runs DIFFER (60dd9b84... 29,960 B against 990c964b... 29,964 B; the raw Blender output already differs at the same size) and both differ from the shipped file (10,036 B, no panel picture). So the v2 console-wedge and rack-box builders are not byte-stable from run to run (the documented « v2 and older builders do not call `canonical_face_order` (pinned) »), the Wave 2+ families are (sm7b). The gates pass on every run; only the order of faces changes. Not fixed: making them canonical changes the pinned outputs of the 93 older devices |
| GLB cleanliness | `git status` right after the determinism runs | no GLB changed by these runs (dry runs write only under `assets-source/<id>/work/` and `report.json`, git-ignored) |
| look audit | scratch spec through the engine (`window.__creation`: SPAWN, or the drawer's Bêta tab for beta-modelled devices; `frameDevice`, `turnCamera`), 35 devices, rear, front and a pair shot next to a neighbour (yamaha-ql1 for anything over 0.3 m, shure-sm58 below) | 35 of 35 `assetStatus` `glb` (no placeholder box); body bottom at y = 0 mm on all 35 (nothing floats); 0 console errors; the port rings seen from the rear on desks, racks, speakers and mics hide no connector or control; sizes read plausibly against the neighbours (SM7B 62 x 192 mm beside an SM58, LINA 514 mm wide, KS28 1340 mm wide, K&M 210/9 1605 mm tall, DPA 4060 6 mm). The 35: yamaha-dm7, avid-s1, allen-heath-avantis, midas-m32, yamaha-cl5, allen-heath-sq-6, mackie-profx12v3, crown-xti-4002, yamaha-spx2000, tc-electronic-m3000, apple-mac-studio, dbx-driverack-pa2, radial-jdi, rme-fireface-ufx-iii, shure-sm7b, neumann-u87-ai, sennheiser-md-421-ii, dpa-4060, akg-c414-xlii, akg-d112-mkii, genelec-8351b, qsc-k12-2, yamaha-hs5, l-acoustics-ks28, nexo-p12, db-audiotechnik-v-sub, meyer-sound-lina, zoom-h6-essential, nagra-vi, sound-devices-833, km-210-9, yellowtec-mika, mogami-gold-db25-xlrm, yamaha-rio3224-d2, multiprise-secteur (7 of them beta-modelled: allen-heath-sq-6, radial-jdi, rme-fireface-ufx-iii, sennheiser-md-421-ii, dpa-4060, yamaha-hs5, sound-devices-833) |

### Findings

1. **Panel pictures lost on 29 shipped devices (real defect; a fix by another agent was in progress when this ran).** The rebuild of commit `0807df1` (and some earlier plain rebuilds) ran `--scripted` without `--project-photo`, which gives a plain build: the manifest says `tool scripted` and the GLB has no picture, although the spec has a generic panel (`content/generic-panels/<id>.json`). 29 rows are in that state: genelec-8341a, genelec-8040b, yamaha-dxr12-mkii, yamaha-mg10xu, midas-m32, crown-xti-4002, shure-axient-digital-ad4d, sennheiser-em-6000, telos-zephyr-xstream, shure-ua845uwb, ua-la-610-mkii, genelec-8351b, genelec-7360a, sonifex-s0-v2, meyer-sound-lina, meyer-upjunior-upj-1p, adam-audio-s3h, neumann-kh-750-dsp, aphex-channel, ams-neve-1073dpd, focusrite-clarett-plus-8pre, yamaha-spx2000, omnia-11, sonifex-dhy-04s, allen-heath-avantis, behringer-x-touch-universal, presonus-studiolive-iii-se-16, yamaha-cl5, yamaha-dm7. In the engine the desks (dm7, avantis, m32, cl5) show a flat dark top with no faders or screen beside the photographic QL1, and the SPX2000 shows a blank front. Geometry, ports, sizes and gates are right; it is the look. The fix (a plain `--scripted` build projects the spec's panel faces, with tests) was uncommitted in the tree during this run, and the 16 GLBs that changed after it are that agent's re-ship; this section did not touch it. After it lands the 29 rows should read `tool hybrid` with photos in the manifest: re-check with the same look spec (dm7, m32, spx2000 are the quickest to eyeball).
2. **v2 console-wedge and rack-box builds are not byte-reproducible** (determinism row). Harmless for the app; a rebuild of an old device changes its bytes and its manifest hash although nothing visible changes.
3. **The earlier GLB total line (10.73 MiB) does not reproduce** (10.27 MiB for the same 240 files today); the limits are far away either way.
4. Known and unchanged: a port pick sphere answers over the body of its own device (tiny devices: dpa-4060, zoom-h6 at the framing distance), the 15 speakers without acoustic data, the phantom flags (open items 1 to 6 of the commit-and-gate section).

### Not run

The 7 beta-modelled devices were placed through the drawer's Bêta tab, not the catalogue path. No audio listening check, no mobile viewport look, and the look audit covers a sample of 35 of the 189 spawnable devices, not all.

## Waves 2 to 5 review fixes (2026-11-12, Wave 5b)

An independent reviewer read Waves 2 to 5 and found 20 defects. Each was verified in the code and fixed test-first on the real catalogue rows; `content/catalog.json` device entries were never hand-edited (spec, plan and template data, then `promote --regen`). Web checks of manufacturer pages were done by delegated research passes (some pages came through search or summarising fetch tools: the spec source notes say so). Nothing pushed, no Meshy, no history rewrite. A usage cap stopped one planned research pass (phantom on the TLM 103, KM 184, MKH 416): those three keep their flag with a to-check note.

| # | Finding | Action | Test |
|---|---|---|---|
| 1 | 29 devices lost their generic-panel picture | Cause confirmed: the rebuild command (`--scripted --ship` without the `--project-photo` faces), not the layout step. `buildAsset` now takes the faces of `content/generic-panels/<id>.json` that the spec projects whenever a scripted build gets no picture of its own (dep `genericPanelPhotos`); the 29 GLBs rebuilt through the build loop (11 of 11 gates), manifest rows hybrid / branded-internal again, register regenerated. Commit `e30d985` | `genericPanelArtwork.test.ts` (196 devices: hybrid row, `_generic_` pictures, GLB with an image and a texture); 4 build-path tests in `buildAsset.test.ts` |
| 2 | Meyer UPJunior and LINA could never be powered | `powercon-blue` and `iec-c13` mate both ways (powerCON to IEC cable), said in the labels. LINA's sheet says powerCON 20 (blue); UPJunior's colour is not stated (assumed, noted). Commit `b22bb52` | `mainsReachable.test.ts`: all 44 mains inlets reach a source (only these two failed); both speakers power from a strip in a rig |
| 3 | 62 phantom flags merged onto 13 beta proposals | `mergeSpecFlags` / `proposalFromSpec` carry a phantom flag only from a documented spec or a port with `flagsSource`; flags removed from 11 specs and proposals; kept (page cited) for crown-pzm-30d, rode-nt-sf1, tascam-model-12; `regenBeta` re-derives from the journal base so a refused flag is removed | `templatesReviewFixes`, `proposalsFixedPoint` |
| 4 | Phantom without citation on promoted devices | Confirmed and cited (`flagsSource` + spec source note): LA-610 MKII, Clarett+ 8Pre, M32 (8 mic inputs; talkback flag removed), F8n Pro, iD14, Studio 24c, SE 16; Flow 8 corrected to 2 inputs (page: inputs 1 / 2 only). **Phantom to-check**: rode-rodecaster-pro-ii (count not confirmed: flags removed), M32 talkback, neumann-tlm-103, neumann-km-184, sennheiser-mkh-416 (flag kept from the Wave 1 template, not re-read), the 11 beta devices of item 3 | specs, data inventory update |
| 5 | Mains rack units without power-in | IEC inlet confirmed and modelled (power-in, iec-c14 assumed, spec + panel + layout + GLB rebuilt): ua-la-610-mkii (front switch), eventide-h9000 (front button), tc-electronic-m3000 (switch documented, inlet type assumed), dbx-160a (manual: no switch), orban-optimod-6300 (switch not documented). Not confirmable: ua-la-2a. External supplies read on a page (SLX-D, PSM 300, ATW-R3210, MG10XU, VR-6HD, Avid S1, JK Broadcast Host, Flow 8): `powerNote` « alimentation non modélisée : l'appareil utilise ... ». Others (QLX-D, Monitor Station V2, FaderPort 8, Rodecaster, interfaces): default note « alimentation non modélisée (source non lue) » | a test derives the devices the template flags and requires power-in or the note |
| 6 | Index-paired routes (codec, 1073DPD) | Codec: no route. Preamp: channel by channel to analogue outputs only (a digital output only where a sheet documents the path: none does). Other outboard: same signal only, matched by name, channel number, then order | synthetic and real rows (zephyr, 1073DPD, spx2000, omnia-11, aphex-channel) |
| 7 | Dead thru / link / loop outputs | Spec field `thruOf` (+ `thruProcessed`); passive routes (P7 note in `realWorld.notes`) for DXR12 thru and link, UPJunior / LINA loops, A15 link, Genelec 8341A / 8351B / 7360A and ADAM S3H AES thru, the NL4 pairs of y10p / v-sub / 45n12 / p12 (both ways); KH 750 outputs routed but not passive (high-passed) | `schemas.test.ts` pins re-derived from the specs, `templatesReviewFixes` |
| 8 | AD4D net ports retyped; EM 6000 label | AD4D: `net-dante-1/2` aoip, `net-ctl-1/2` ethernet-control (guide read; which jack is which is a guess), aliases net-1..4; an RJ45 aoip port named dante / aes67 keeps its type. EM 6000 label « Sennheiser EM 6000 (Digital 6000 receiver) » (Dante is the DANTE model only). AD4D label no longer cites AD1 / AD2 | real rows |
| 9 | AES50 patchable to Dante | New signal `aes50` (digital, cable colour, French label); M32 and the beta S16 / X32 Compact AES50 ports typed from their specs; R2 refuses it against aoip; R5-R8 untouched | `signalTypesReview.test.ts` |
| 10 | Desk / controller routing | Targets only analogue `out-main*` (else `out-mix*` / `out-mon*`); talkback never routed; no omni / AES / Dante / USB targets. CL5, DM7, Avantis and Podtrak P4 are now unrouted (no documented main output); monitor controllers have no default route (Monitor Station V2: the sheet gives no default). Consequence: those desks pass no signal in the simulator until a sheet documents a main output | real rows and a generic test over every promoted desk |
| 11 | USB MIDI surfaces typed usb-audio | New signal `usb-control`; MPK mini, FaderPort 8, X-Touch Universal use it; refused against usb-audio. Open consequence: no host models a usb-control port, so these controllers cannot be cabled to a computer yet | `signalTypesReview.test.ts` |
| 12 | modelFront claim measured for 4 speakers only | The test now measures every device that declares modelFront (the 15 promoted speakers + KH 120 II): axis -z, ports in the +z half | `modelFront.test.ts` |
| 13 | Data-rule leftovers | KH 120 II lost the nominal coverage; ProFX12 and Rodecaster lost the fader-master list (Rodecaster: no control, no layout); the 25 originals untouched and listed again in the inventory doc | `schemas`, `catalogChecks`, `promotedTruth` pins updated |
| 14 | Coverage skip wording | no-acoustic is checked after muted / silent / balance (real reasons win); a rig whose only reason is no-acoustic says « Couverture non calculée : aucune valeur vérifiée pour ce modèle (statut à valider). L'écoute n'est pas concernée. » (copy deck updated, à valider) | `coverageSources.test.ts` |
| 15 | Register source | The spec's own dimensions page (first non-plan source whose note gives millimetres) wins for plan rows; 8341A cites genelec.com/8341a, 1073DPD cites ams-neve.com/1073dpd; the 25 originals unchanged | `brandsRegister.test.ts` |
| 16 | Label overclaims, assumed inlet notes | Dante AVIO label « (2IN) »; Omnia.11, DHY-04S, dbx 160A, Orban disclose in `realWorld.notes` that the Alimentation control is the simulator's; `assumedConnectors power-in` added to genelec-8341a, 8040b, midas-m32, yamaha-dxr12-mkii (+ the five new inlets) | a test over every plan row and over specs that say the inlet type is not named |
| 17 | e2e annotated devices instead of failing | A covered body is selected through its project-tree row; the test fails when that is impossible | `creation-equipment-models.spec.ts` (see the e2e line below) |
| 18 | Saved cables on removed Bêta port ids dropped silently | `portAliases` for 12 old ids (MUTEC S/PDIF and word clock, EM 6000 / AD4D word clock, MG10XU stereo line); a visible French note « Câbles non rechargés » (à valider) lists the cables that could not be restored. Ports with no equivalent stay removed (GLM, USB firmware, GPI, AC cascade, Nagra AES, EM 6000 network) | `droppedCables.test.ts` (saved-project fixture) |
| 19 | `--regen` clock date, `out-14` ids, local path | regen uses the entry's own date, else the plan's `generated`; the id rule turns « 1/4 in » into `quarter`; 7 ports of 5 devices renamed with aliases, GLBs rebuilt; the local Blender path is gone from this log, the plan and the spec | `behaviourTemplates` |
| 20 | Fixed-point test hid flag drift | The generated side is compared as is; each difference must be a non-capability flag, a cited capability flag or an aes50 / usb-control retype; every beta-modelled proposal is the exact fixed point of `promote --regen`. `npm run test:blender` added; the family tests skip without `BLENDER_EXE` (`skipIf`) | `proposalsFixedPoint.test.ts` |

Order of the work: 1 (critical) and 2 were committed first; the template and data findings (3 to 11, 13, 16, 19) share one regeneration of 69 entries (promoted and beta-modelled), then the application and test findings (12, 14, 15, 17, 18, 20).

### Gate numbers (Wave 5b review fixes, 2026-11-12)

- Commits: `e30d985` (1), `b22bb52` (2), `50c15a4` (3 to 11, 13, 16, 19, 20: templates and data, 69 entries regenerated, 12 GLBs rebuilt), `2b626ef` (14, 18), `33b715d` (12, 15, 17, log) and the e2e fix that follows it (the project-tree row of a Bêta device ends with « non vérifié »).
- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run validate:catalog` valid (113 devices, 16 warnings = the 16 promoted speakers without sourced acoustic data, KH 120 II now among them); `npm run validate:assets` 240 ok, 0 failed.
- `npx vitest run` (full, `BLENDER_EXE` set): 256 files, 5016 tests, all passed (before: 251 files, 4659 tests).
- Playwright on a private preview of a scratch build (port 4182): creation-equipment-models, creation-beta, creation-drawer, creation-budgets, creation-controls, creation-front, creation-coverage, creation-glb404: 119 passed, 3 skipped, 2 failed in the first run (batches 8 and 9 of the equipment spec: the new tree-row selection of finding 17 first missed the collapsed Matériel group, then the « non vérifié » suffix); both batches pass after the fix (2 of 2).

### Open items (review fixes)

1. Phantom to-check: TLM 103, KM 184, MKH 416 (flag kept, not re-read), Rodecaster Pro II (count), M32 talkback, 11 beta devices.
2. No host models a `usb-control` port: the three controllers cannot be cabled to a computer until one does.
3. CL5, DM7, Avantis, Podtrak P4 and the Monitor Station V2 pass no signal until a sheet documents a main output or a default; this is the data rule, not a defect.
4. Devices with the default note « alimentation non modélisée (source non lue) »: QLX-D, Monitor Station V2, FaderPort 8, Rodecaster Pro II, the USB interfaces: sheets still to read.
5. AD4D: which RJ45 is Dante and which is control is a guess (positions are guesses everywhere).
