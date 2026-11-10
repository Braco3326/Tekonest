# Finish all models and clean port markers

Status 2026-11-10. Branch `assets/3d-rebuild`. Founder away, autonomous run: no push, no deploy, no Meshy spend.
Approval gates of the brainstorming skill are waived by the founder's explicit instruction ("work everything in autonomy").

## 1. Understanding (what the founder said, what I assume)

Said:
- Every model still left must be modelled and "perfectly designed", clean, smooth, as real as possible; focus on shapes.
- The Genelec is not a square box, it is curved.
- The coloured port discs hide the equipment (screenshot: QL1 rear panel, three yellow and two blue discs over XLR groups, one big orange disc over the etherCON).
- Come back and find all equipment usable and fixed.

Assumed:
- "Same way as the latest models" = scripted Blender shape + the real product photo as the picture (hybrid), numeric gates, in-engine check.
- "Usable" = the device spawns at the right size, its ports are on real surfaces and patchable, the existing controls layer still works. New hand-measured control layouts are a stretch, not the core.
- The camera, selection, patching, audio and e2e budgets must not regress.

Success: every catalog device has a scripted or hybrid model with real silhouette detail, passes the gates, passes a contact-sheet review against its photo, markers no longer hide connectors, full e2e stays green, nothing pushed.

## 2. Inventory (what is weak today)

| group | devices | now | target |
|---|---|---|---|
| curved speakers | genelec-8030c | hexagon cabinet, 220 tris | curved die-cast enclosure |
| cabinets | qsc-k12-2, yamaha-dbr12 | hexagon, 3-segment bevel, 308 / 332 tris | smooth filleted cabinets, handles, grille |
| rack gear | avid-hd-io, antelope-ocx-hd, grace-m905, focusrite-isa-one, switchcraft patch bay, aeta-scoop5-s, aeta-scoopy-plus-s, playout-pc, avid-protools-hdx (+ studio boxes) | 44-triangle boxes | ears, handles, panel inset, vents, feet, filleted edges |
| consoles | yamaha-ql1 (224 tris), axia-iq (92 tris) | plain wedge | side cheeks, filleted wedge, feet, arm rest, slot plates |
| mics | shure-sm57, ev-re20, ev-re50, neumann-u87-ai | Meshy, ~10k tris, uneven | scripted revolve with real profile and wrap picture |
| stand | km-210-9 | Meshy 2.7k tris | keep unless a scripted tripod wins the A/B |
| no model | multiprise-secteur | fallback box, no spec | spec + scripted power strip |
| done tonight | rio, sm58, mika, litt, mogami, connectors | scripted | untouched |

## 3. Council result (Tier 3, 82 %, see transcript)

- Parametric families, not bespoke meshes; per-device parameters live in the asset spec `build` block.
- Photo stays the picture; modelled detail is silhouette and recess detail only (ears, handles, insets, vents, feet, port recesses, fillets).
- Never model what the controls rig draws: a device with a layout in `content/control-layouts` keeps its fader / knob / key area flat in the GLB (the rig adds caps; a modelled copy would double them).
- No normal / metallic maps (precedent: they starved software-GL timers); a baked shading hint inside the colour map is allowed.
- Class budgets (triangles): rack gear 1.5k to 3.5k, consoles up to 6k, speakers up to 4k, mics up to 6k, strip / small gear up to 2k.
- Meshy geometry is replaced only if the scripted result wins an A/B against the product photo; otherwise the Meshy model stays (recorded in the report).

## 4. Design

### 4.1 Port markers: outline rings sized from the connector

Today: a 50 mm opaque cylinder (`MARKER_DIAMETER`), shrunk only to its nearest catalog neighbour, grown to at least 50 mm when highlighted. On a QL1 rear (XLR pitch 25 mm) it covers three connectors.

Change:
- New pure module `src/scene/portMarkerSize.ts`: `markerDiameterMm(connector, openingMm?)` from a connector table (xlr 24, trs 14, ts 14, 3.5 mm 8, bantam 11, rj45 16, ethercon 24, speakon 26, powercon 30, iec 30, schuko 30, usb-a 14, usb-b 12, usb-c 10, bnc 14, rca 13, toslink 9, dsub25 40, gpio 40, digilink 12; unknown 20). The spec's `openingMm` wins when present. Marker outer diameter = size x 1.25.
- Marker mesh = a flat ring (annulus, 32 segments, 64 triangles, thickness 12 % of the diameter, at least 1.2 mm), same direction colours, emissive, no fill, depth-tested. The invisible pick sphere is unchanged (the 24 px hit area stays).
- Hover / patch states: ring grows to `HIGHLIGHT_PX` on screen (never below its rest size), colour changes, a faint 25 % fill is allowed only in those states. The orange "pending" no longer fills a 50 mm disc.
- Screen-space floor: in `PortProxies.refresh`, a ring never draws under 9 CSS px outer diameter (far views), never above 1.6x its rest size at close range.
- `restScale` metadata stays as the "size it rests at" contract (now 1 for every marker, the diameter being per connector).

### 4.2 Shape families (Blender, `tools/assets3d/blender/build_from_spec.py`)

- `curved-cabinet` (new): plan outline from a rounded superellipse (flat or slightly crowned front baffle, side arcs, rounded back), extruded along Y; top / bottom edges filleted with an elliptic profile (6 to 12 segments); optional baffle features: round tweeter waveguide ring, woofer ring (shallow recess), port slot, handle recess, rear amplifier plate recess with real port pockets (as `speaker-cabinet` does). Params: `planFrontMm`, `sideBulgeMm`, `backRadiusMm`, `edgeRadiusMm`, `edgeSegments`, `crown`. Genelec 8030C uses large radii (about 40 mm plan, 30 mm edge); K12.2 and DBR12 re-ship on it with their own params.
- `rack-device` v2 (extends `rack-box`): params `ears` (width, thickness, screw holes), `handles` (count, projection), `plateInsetMm` (raised front plate over chassis), `chamferMm` / `filletMm`, `ventSlots` (rect recesses on top / sides), `feet`, `bodyWidthMm` (chassis narrower than the 482.6 mm front), `rearInsetMm`. 1U strip, desktop box and tower presets.
- `console-wedge` v2: filleted wedge, side cheeks, rear connector recess, rubber feet, arm rest, slot plates where the spec says (QL1 option slots).
- `revolve` mics: profile from datasheet / photo silhouette, 64 segments, wrap picture (grille weave, bands) as for the SM58; no brand marks.
- `power-strip` (new, small): multiprise-secteur (extruded rounded bar, Schuko sockets as recesses, switch). Needs a spec: size from the product the catalog names, ports from catalog.
- `tripod-stand` (only if time and the A/B says so).

### 4.3 Pipeline and gates

- All builds go through `npm run asset:build -- <id> --scripted` (or `--project` for hybrids); the output is Draco, manifest row `tool: scripted | hybrid`.
- New gates in `tools/assets3d/gates.ts`: `detail` (triangles between the class floor and ceiling declared in the spec `build.budget`) and `fillet` (the spec declares the minimum bevel / fillet radius; the builder writes the measured value into extras; the gate checks it). Existing gates stay: size, transform, parts, portPositions, portSurface, budget, proportionDrift, textures, validator.
- Determinism: building twice yields byte-identical GLBs (test for each new shape).
- Controls: for every device with a layout the builder receives the layout's control rectangles as `flatZones` and keeps them flat (no raised parts). Tested by a parity test.

### 4.4 Verification (not only gates)

- Contact sheet per device: front, rear, 3/4, side, next to the product photo, rendered in the engine (`AUDIT_OUT` look audit, `render_views.py`). The implementing agent must look at every sheet and fix or record.
- Full unit suite, `validate:assets`, `tsc`, `eslint`, creation e2e (`E2E_PORT=4181`), chunk budget.
- Idle render budget and frame cost: scene stats on the reference rig before / after (geometry is the only variable).

## 5. Waves (learner impact first)

0. Markers (4.1).
1. `curved-cabinet`; Genelec 8030C, K12.2, DBR12.
2. `rack-device` v2; nine rack / box devices.
3. `console-wedge` v2: QL1, Axia iQ (keep controls flat).
4. Mics SM57, RE20, RE50, U87 (A/B), multiprise-secteur spec and model, stand (A/B).
5. Audit: all contact sheets, brands register and credits (Meshy rows removed where replaced), full gates, report in `E:\CLAUDE BU\reports`, memory update.
6. Stretch only if everything above is green: hand-measured control layouts for devices with real controls (Grace m905 knobs, Avid HD I/O meters, Antelope OCX display, Scoop5 S keypad).

## 6. Stop rules for autonomous work

- A device that fails its gates or the contact-sheet review after three attempts keeps its current model; the report lists it with the reason.
- Never push, deploy, spend Meshy credits, or touch another checkout.
- Commit after every device with explicit paths; run the affected tests before each commit; run the full suites after each wave.
- No change to the audio engine, catalog semantics or saved-project format.

## 7. Out of scope

Console software, real meter levels, saving control positions, connector GLBs in the scene, deploy.
