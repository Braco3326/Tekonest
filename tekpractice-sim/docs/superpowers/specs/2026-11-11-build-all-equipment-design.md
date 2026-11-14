# Build all equipment: promote the Bêta devices and fill the missing categories

Status 2026-11-11. Branch `assets/3d-rebuild` (pushed 44f5dd7, deployed as site commit b7dbba8). Founder away, autonomous run: no push, no deploy, no Meshy spend, no history rewriting, explicit paths in every commit.
The interactive approval gates of the brainstorming skill are waived by the founder's explicit instruction ("build in autonomy, I will come back when everything is built to validate"), as in the 2026-11-10 run. Every decision below that the founder may overrule is marked **[validate]**.

Inputs: a report kept outside the repository, its CSV `... - priority table.csv` (315 rows: 134 Bêta + 181 new) and the six note files in the research notes folder (kept outside the repository).

## 1. Understanding

Said by the founder: the biggest mission now is to build ALL of the Bêta equipment so TekPractice has full equipment of all sorts of categories; research what is missing, plan it, build it in autonomy, then he validates.

Assumed:
- "Built" means: the device exists in the app with a real-size 3D model, ports on real surfaces, the right behaviour for its category (it can be a source, a processor, a speaker, a mains consumer), a French label, and it passes the same gates as the 25 verified devices. A box with a port grid is not "built".
- "All categories" means the 24 roles in the research matrix (microphones to intercom). Lighting, DJ, backline, conference and hearing-protection gear are out of scope (the research did not cover them).
- Quality bar for look: the finish-all-models bar (scripted shape with real silhouette detail, clean fillets), not Meshy-grade realism.

Success: every row of the plan that reaches its wave's gates is promoted or modelled; every completed wave is self-contained, green and shippable; nothing is pushed; the morning report lists per device what was done, the data quality, and what the founder must validate.

## 2. Defaults chosen for the founder's validation

| # | Question (from the research) | Default chosen | Why |
|---|---|---|---|
| D1 | Product naming (Telos "Xenon") | Never model or name a product no source documents. The radio-console row uses verified Telos Alliance names only (Axia iQ is verified; Pulsar and Quasar documented). | The notes found no "Xenon". |
| D2 | Which devices to promote | All rows of the plan, wave by wave, through two outcomes (section 4.1): **promoted** (datasheet or dealer-grade size and documented ports) or **beta-modelled** (model with estimated size, still badged Bêta). | Honest about data quality; keeps the "verified" claim true. |
| D3 | Artwork | Generic panel artwork drawn by our pipeline for every new device, no manufacturer photo, no logo. Model names appear only as the app's own labels. | Repo policy (`docs/legal/BRANDS_AND_CREDITS.md`), no brand-permission risk, no photo reaches the public repo. |
| D4 | Patch-only until a model exists | Yes. A Bêta device without a model stays inert. Beta-modelled devices keep patch-only behaviour and a distinct badge « Bêta — dimensions estimées ». Only promoted devices get behaviour. | A modelled box must not read as verified. |
| D5 | Cables | Not devices with SKUs. Cables stay typed items; Wave 3 only adds what the research marks tier 1 (patch cables as typed items, snake and stage-box fan-out as devices). | Decided before Wave 3; the report's recommendation. |
| D6 | Scope | The 315 rows in five waves; the run executes waves in order and stops by the rules in section 6. Lighting, DJ, backline, conference, hearing protection, console software, saved fader positions: out. | Research coverage. |
| D7 | Manufacturer photos on already-shipped devices | Unchanged (12 shipped rows are photo-textured; three still print a manufacturer name). Not touched in this run. | Separate decision; already live. |

## 3. Inventory (what exists, what is missing)

- Verified catalogue: 25 devices, 26 connector types, 16 signal types, 79 ports, 8 rules (`content/catalog.json`). Every verified device has `ports`, `controls` (at least a `power` toggle where a mains port exists), `routing` where it is a processor, `acoustic` for speakers, `modelFront`, an asset spec and a GLB.
- Bêta: 134 devices in `content/proposals/catalog-proposals.json` (generated 2026-10-22 from the knowledge base by `tools/propose-content.ts`). No spec, model, control layout, routing or acoustic data. Port ids can exceed 40 characters. 9 categories exist only as Bêta (amplifier, speaker, outboard, wireless, di-box, broadcast, headphones, recorder, measurement).
- Plan table: 315 rows = 134 Bêta + 181 new candidates, tiered 1 to 3 and assigned to waves 1 to 5. Shape-family fit: 212 rows fit existing families (rack-box v2 121, console-wedge v2 44, revolve 31, curved-cabinet 12, tripod-stand 4); 103 need a new or extended family.
- Data quality of the plan: 16 Bêta devices have complete datasheet-grade size, 8 partial, 15 parsable from the knowledge base, 95 none. All numbers keep the research notes' own grade tags.

## 4. Design

### 4.1 Two outcomes per device

- **Promoted** (goes into `content/catalog.json`): requires a size from a datasheet or dealer source (never estimate-only) with all three axes and `sizeConfidence: ok` (not an assumed axis order, not a conflict between sources, not a partial size), AND a connector set the datasheet documents (the asset spec says `portsDocumented: true` and names its `portsSource`). Gets short stable port ids, `controls` (power toggle where there is a mains port, plus category controls), `routing`, flags, `acoustic` for speakers, `modelFront`, an asset spec, a GLB with gates green, a French label and `realWorld` text.
- **Beta-modelled** (stays in the proposals file): size is estimated, uncertain or partial, or the ports are not documented. Gets an asset spec marked `confidence: guess` on size, a GLB through the same gates, and a manifest row. The proposals loader keeps it badged Bêta with the extra label « dimensions estimées ». No behaviour.
- A device with no data at all gets neither and is listed in the report as blocked on a datasheet pass.
- Ports are never invented: a category template adds behaviour (power toggle for every mains inlet, phantom, routes, acoustic, controls) on top of the ports the datasheet documents, chosen by category and by the plan row's traits (condenser, ribbon, phantom-powered, battery, handheld, bodypack, receiver, processor, desk and so on). A hand-held or body-pack device has no mains inlet and no power toggle.

### 4.2 Source of truth and the two-stage promotion tool

- New `content/proposals/equipment-plan.json` (committed): the plan table in machine form (id, status, category, manufacturer, product, mm size, kg, ports summary, shape family, dataQuality, sizeConfidence, traits, tier, wave, per-field source URL and grade). Generated once from the CSV; edited by hand afterwards. Contains numbers and URLs only, no photos. `import-equipment-plan --refresh-sources` recomputes only the sources (a note line gives a link only when its subject IS the product).
- New `tools/promote-device.ts` (`npm run promote -- <id>`) in two stages. **Stage 1** writes only the asset-spec skeleton (size, typed sources, a to-do note about the ports, no ports) and marks the plan row `staged`; it never touches the catalogue or the proposals file. **Stage 2** (`--commit`, run after the GLB shipped and the gates are green) refuses unless the manifest has the device's row and `public/assets/<id>.glb` exists, then writes the catalogue entry (promoted outcome, from the documented ports of the spec) or leaves the proposal in place with its size and model (beta-modelled outcome), and sets `promoted` or `betaModelled`. `--revert` undoes the latest stage completely. Both stages are atomic (temporary files, renames, rollback) and idempotent; `--dry-run` writes nothing. A staged device is seen by the asset pipeline as the catalogue entry stage 2 will write, so the spec's parity check passes between the stages.
- `tools/propose-content.ts` / `npm run sync:kb` regenerates the proposals file from a pure generator (`tools/proposalGenerate.ts`) through the same guard: it skips ids that are already promoted or listed in the plan so a sync cannot resurrect or overwrite them, and a test holds that the committed file is a fixed point of the generator on the real knowledge base.

### 4.3 Behaviour templates per category (derived from the 25 verified devices)

| Category | Template |
|---|---|
| Microphone | out port `mic-level`, no power, phantom-needed flag for condensers (`requiresPhantom`), `isRibbon` for ribbons |
| DI box | in instrument/line, out mic-level, ground-lift and pad controls, phantom flag only if active |
| Preamp / channel strip | mic in, line out, gain control, phantom control, power |
| Interface / converter / stage box | mic and line ports with `isMicInput` + `providesPhantom`, Dante or USB port, power toggle, clock flags |
| Console (analog, digital, radio, podcast) | channel inputs, mains, master outs, power toggle, same pattern as QL1/Axia (reduced port counts, "N of M modelled" note) |
| Speaker (active) / monitor | line in, mains, `routing` in to `transducer`, `acoustic` (nominal coverage with source), `modelFront` |
| Speaker (passive) | speaker-level in (speakON), routing to `transducer`, requires an amplifier in the chain (rule R-load) |
| Power amplifier | line in, speaker-level out, mains, power toggle, load field |
| Outboard / effects / broadcast processor | in, out, insert or send/return where the product has them, power |
| Wireless / IEM | receiver (antenna, line out, power) and transmitter as separate devices |
| Headphones / headphone amp | headphone out/in with 3.5 mm and 6.3 mm, power for amps |
| Recorder / measurement | in, out, battery or USB power |
| Computer / controller | USB, network, power |
| Cable / power distribution | as 4.1 and D5 |

Schema additions needed (Wave 0, batched so pinned tests change once): `isRibbon`, `isUnbalanced`, insert/send-return semantics, speaker load and impedance fields, mix-minus and tally flags. New connector ids by device count: dc-barrel, midi-din5, xlr4, bnc-antenna-50ohm, mini-xlr-ta4, euroblock, speakon-nl8, binding-post, opticalcon and SC, lemo, hirose. Split `aoip` into dante, aes67, avb, aes50 only if rules R5 to R8 stay green (spike first).

### 4.4 Shape families

Existing (no work): rack-box v2, console-wedge v2, revolve, curved-cabinet, tripod-stand, power-strip, cable-assembly, generic panels.
New or extended, in build order (sizes from the builder analysis): rack-box v3b (S: front vents, windows, ear handles), moulded-box (S-M: recess, lid, hinge for laptops), revolve v2 with oval sections (M: unlocks the C414 and the rejected U 87 Ai profile), round-base stand variant (S), speaker-cabinet v2 (M: elevation profile, handles, pole socket), cable-assembly v2 (S-M: end-kind codes), `assembly` (L: data-driven multi-part for headphones, arms, pop filters, racks). Rack-box v3 sloped front only if a Wave 0 spike shows console-wedge cannot carry sloped desktop gear.
Each new family ships with parameter validation, a Blender test (exact size, triangle class, determinism: byte-identical builds, ports on real surfaces), a registration in `tools/assets3d/shapes.ts` and `build_from_spec.py`, and the `detail`/`fillet` gates. Old shapes stay byte-identical (existing sha256 pins).
Triangle classes: rack gear 1500-3500, desks up to 6000, speakers up to 4000, mics up to 6000, small gear up to 2000, headphones up to 4000.

### 4.5 Artwork and ports (generic artwork policy, D3)

- Generic panels (`content/generic-panels`, `asset:panel`) draw the face: connectors, knobs, switches, vents, meters as the datasheet describes them. No logos. Colours from the datasheet when stated, else a category default.
- Port and control positions come from the datasheet description (layout order, spacing, section names); confidence `guess` unless a datasheet drawing or photo gives a measured position, in which case `photo` or `datasheet` and the source is recorded. The `portSurface`, `portPositions` and `size` gates still apply.
- Flat zones: a device with a control layout keeps its control areas flat; new devices get the generated power layout only (hand-measured layouts are a stretch, 4.9).

### 4.6 Inventory and UI

- Tab lines for the nine new categories and the three tabs the original brief planned (Amplis, Câbles et DI, Pieds et accroches) in `CATEGORY_TAB` (`src/creation/...`); pinned tab/category counts become derived from the catalogue instead of literals so promotions stop editing tests one by one (test the derivation).
- Placeholder boxes for Bêta devices without a model use the plan's dimensions when present (small spawner change, tested) instead of the 0.4 x 0.3 x 0.3 m default.
- French labels and `realWorld` copy for each promoted device; English stays the source language of the plan.

### 4.7 Manifest, size and performance budgets

- Per-device Draco GLB: textures at most 1024 px for generic panels, target at most 250 KB average; total `public/assets` GLBs at most 120 MB for the whole programme; any single GLB under 25 MiB (deploy limit). `deploy-guard` and the chunk budget must stay green; GLBs load lazily per placed device (no entry-chunk change), checked by the chunk-budget script and a scene-stats run (device count in a reference scene unchanged).
- Manifest drift test (every manifest row has a file and vice versa) stays green.

### 4.8 Legal register

`docs/legal/BRANDS_AND_CREDITS.md` gets one row per device from the manifest: tool, source of dimensions (URL), picture origin (generic artwork), Meshy no, trademark flag. Wave 0 teaches the register generator to emit rows from the manifest so it cannot drift.

### 4.9 Controls and interactivity

Generated basic layouts (power key/rocker) for every promoted device with a power toggle (existing generator). Hand-measured layouts for desks and strips with real controls are a stretch task at the end of the run, only if everything else is green.

## 5. Device build loop (per device)

1. Read the plan row; if data quality is `missing` stop and list it.
2. `promote-device` stage 1 (`npm run promote -- <id>`) writes ONLY the asset-spec skeleton (size, typed sources, a to-do note about the ports) and marks the plan row staged; the catalogue and the proposals file are not touched.
3. Fill the spec: size, the ports the datasheet documents (connector, signal, direction, flags, positions, confidence) with `portsDocumented: true` and `portsSource` only when the datasheet documents the connector set, `build` params and `budget`, sources, notes marking every estimate.
4. `asset:panel` for the generic pictures; `asset:build -- <id> --scripted` (dry run first).
5. Look at the contact sheet (front, rear, 3/4, side); compare proportions to the datasheet numbers; fix or record. Contact sheets go to the ignored `docs/superpowers/notes/img/` folder, never committed.
6. Ship through the gates (size, transform, parts, portPositions, portSurface, budget, proportionDrift, textures, validator, detail, fillet); then stage 2 (`npm run promote -- <id> --commit`: promoted or beta-modelled; `--revert` undoes a stage); tests for the device (spawner, modelIds, manifest drift); commit with explicit paths.
Batch up to 10 devices of one family per commit series; the catalogue edit is batched per wave.

## 6. Waves, order and stop rules

| Wave | Content | Rows | New families |
|---|---|---|---|
| 0 | Foundations: plan JSON, `promote-device`, sync:kb guard, schema and connector additions, tabs, derived pins, register generator, two spikes (console-wedge sloped desktop; curved-cabinet for rectangular monitors) | none | none |
| 1 | Existing recipes with data in hand | 49 | none |
| 2 | First new families, remaining top-teaching devices | 87 | rack-box v3b, moulded-box, revolve oval, round-base stand |
| 3 | Speakers, cables as typed items, long-tail rack gear | 92 | speaker-cabinet v2, cable-assembly v2, optional sloped rack-box |
| 4 | Headphones, arms, furniture, lavaliers | 70 | assembly |
| 5 | Tail: discontinued, large-format, no data (stay Bêta unless data appears) | 17 | none |

Stop rules for autonomous work:
- Waves run in order; a wave ends with the full suites (tsc, lint, validate:assets, validate:catalog, vitest with Blender, chunk budget, the creation e2e specs touched, scene stats) and a log section. A completed wave is self-contained.
- A device that fails its gates or the contact-sheet review after three attempts keeps its previous state; the report lists it with the reason.
- A wave whose data blocks more than half its rows is reported and the run moves to the next wave with the ready rows.
- After each wave and at the end: an independent read-only review of the diff against the plan's Review Focus list, findings fixed with tests.
- Never push, deploy, spend Meshy credits, rewrite history, or touch another checkout. No change to the audio engine, rule semantics or the saved-project format except the additive schema fields above (migrated, tested). Public repo: scan every commit for keys and for brand photos.

## 7. Verification

Unit suite with `BLENDER_EXE=<path to blender.exe>` (builder tests, shape determinism), `validate:assets`, `validate:catalog`, `tsc`, `eslint src tools`, chunk budget, creation e2e on a private preview (`E2E_PORT=4181`, new scratch outDir), a look audit of every device (engine contact sheet), a scene-stats comparison for frame cost and idle renders, and a per-wave count table in the models log: promoted, beta-modelled, blocked.

## 8. Risks

- Data is the bottleneck: 95 Bêta devices have no size; they stay blocked or beta-modelled with category defaults, never invented numbers.
- Generic artwork looks generic; it is the safe default and the founder may later license manufacturer photos per device.
- Pinned counts and tabs: batched through derived pins; one wave touching them at a time.
- Total effort about 800 agent-hours (480 to 1130) for all waves (report estimate, not measured); waves are ordered so that stopping anywhere leaves a coherent catalogue.
- Shared checkout hazards: commit with explicit paths, list `origin..HEAD` before any push.

## 9. Out of scope

Lighting and show control, DJ and backline gear, conference and loop systems, hearing protection, console software, real meter levels, saving control positions, new audio-engine behaviour, deploy.
