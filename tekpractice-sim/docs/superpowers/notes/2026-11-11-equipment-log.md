# Equipment log (build all equipment, 2026-11-11)

Plan: `docs/superpowers/plans/2026-11-11-build-all-equipment.md`. Each agent adds its own section below.


## Wave 0 spikes (Task 0.7)

Throwaway dry runs, nothing shipped. Method: scratch specs in `C:\Users\braco\AppData\Local\Temp\claude\dd4283adc5f44d8e\4e0e33cf-26fa-4a45-94ed-a586d8113ebb\scratchpad\spike\` (outside the repo), driven through the real `buildAsset(id, { scripted: true, dryRun: true })` with injected `loadSpec`, a synthetic one-device `loadCatalog`, and scratch `paths`. So every run went through `validateBuild` (TS), the Blender builder, the fix-up, the contact sheet and all the gates (size, transform, parts, portPositions, budget, detail, fillet, proportionDrift, portSurface, textures, validator = 11 gates). Nothing was written to `content/`, `public/assets` or the manifest. `BLENDER_EXE=D:\Blender\blender.exe`. All specs: tier `standard`; sizes in the order (w, d, h) as given in the task; port and control positions are guesses (the spike tests the shape, not the layout). The driver is `spike/driver.mts` (about 25 lines, not committed).

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
- Scratch contact sheets (not committed): `C:\Users\braco\AppData\Local\Temp\claude\dd4283adc5f44d8e\4e0e33cf-26fa-4a45-94ed-a586d8113ebb\scratchpad\spike\out-scC2\src\spike-scarlett-c\work\2026-11-11T22-44-46-392Z\attempt-1.sheet.png`, `...\spike\out-kh-1\src\spike-kh120\work\2026-11-11T22-45-44-303Z\attempt-1.sheet.png`, `...\spike\out-jdi2\src\spike-radial-jdi\work\2026-11-11T22-43-32-613Z\attempt-1.sheet.png`.
