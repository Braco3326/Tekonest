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
