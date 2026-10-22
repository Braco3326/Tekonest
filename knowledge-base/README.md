# Tekonest knowledge base: sound equipment & sound engineering

A sourced reference database of sound equipment and sound-engineering knowledge. It feeds:
1. the course steps of [`learning-platform/`](../learning-platform/) (BTS MAV option Son), and
2. the devices, levels and 3D assets of [`tekpractice-sim/`](../tekpractice-sim/).

Built 2026-10-22 on branch `research/sound-equipment-database`. **Every fact links to a source**, and gaps are written as `"not found"` instead of guesses. Quality numbers are in [QUALITY_REPORT.md](QUALITY_REPORT.md).

## What's inside

| Path | What | Size |
|---|---|---|
| [`taxonomy.json`](taxonomy.json) / [`taxonomy.md`](taxonomy.md) | Categories and sub-types with FR/EN description, working principle, uses, sources. Ids are frozen slugs. | 21 categories, 131 sub-types |
| [`equipment/*.json`](equipment/) | Device records, one file per category (or category part) | 22 files, **357 devices** |
| [`equipment.csv`](equipment.csv) | Flat export of all devices (generated) | 357 rows |
| [`equipment/tekpractice-mapping.md`](equipment/tekpractice-mapping.md) | Catalog coverage, next devices to add, missing connector/signal ids. Generated tables are in `tekpractice-mapping.generated.md`. | — |
| [`manuals-missing.md`](manuals-missing.md) | Devices with no official manual found, plus every agent's not-found log (generated) | — |
| [`fundamentals/`](fundamentals/) | "How sound works": 19 sourced explainers in French with English terms | 19 files |
| [`tek-brain/`](tek-brain/README.md) | **TEK Brain (run 2):** concepts, skills, procedures, machine-checkable rules, faults, scenarios, FR↔EN glossary, parametric room templates, curriculum, retrieval index for the AI coach/tutor | 414 concepts, 60 skills, 96 procedures, 82 rules, 101 faults, 41 scenarios, 780 terms, 32 rooms, 1,832 chunks |
| [`learning-resources.json`](learning-resources.json) / [`.md`](learning-resources.md) / [`-catalogue.md`](learning-resources-catalogue.md) | Books, standards, academies, courses, channels (legal links only), each with `licence` and TEK Brain `concept_ids` | 315 entries, 260 legally free |
| [`3d-models.json`](3d-models.json) / [`.md`](3d-models.md) / [`-catalogue.md`](3d-models-catalogue.md) | 3D candidates with exact licences, `id` and `kind` (device, room, venue, prop, character, material), link only unless committed | 983 entries |
| [`3d-models/`](3d-models/) | Redistributable glb files (CC0 / CC-BY) + `CREDITS.md` + `downloads.json` | 64 files, 26 MB |
| [`schema/`](schema/) | `device.schema.json` (run 1), `tek-brain.schema.json`, `room.schema.json` (run 2) | — |
| [`qa/spot-check.md`](qa/spot-check.md) | Independent re-check of 36 devices against their sources | — |
| [`QUALITY_REPORT.md`](QUALITY_REPORT.md) | Counts, coverage, URL check, conflicts, licence issues | — |
| [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md) | Decisions for Oscar | 16 questions |
| [`RUN_LOG.md`](RUN_LOG.md) | What was done, when, what failed | — |
| [`schema/device.schema.json`](schema/device.schema.json) | Contract for every device record | — |
| [`tools/`](tools/) | Stdlib-only Python: `validate.py`, `build_csv.py`, `check_urls.py`, `tekpractice_mapping.py` | — |
| [`docs/`](docs/) | Design spec and the research briefs given to each agent | — |

## Device record in one glance

Each device in `equipment/*.json` has:
- **Identity:** `id` (kebab-case; the TekPractice catalog id when the device is in the catalog), `brand`, `model`, `category` / `sub_type` (taxonomy ids), `technology`, `year_introduced`, `status`.
- **Description:** `why_it_is_a_classic`, `typical_uses`, `key_specs` (values copied with units, as the source states them).
- **Wiring:** `connectors[]` and `signal_types[]`, using TekPractice connector and signal ids or the proposed ids listed in `taxonomy.json`.
- **Documents:** `manual_url`, `datasheet_url`, `product_page_url`, `manuals[]` (language, file type, version, official flag).
- **Sources:** `sources[]`. Each entry has `url`, `publisher`, `accessed`, a `confidence` of verified-primary / verified-secondary / unverified, and `covers`, the list of fields that source supports.
- **Doubts:** `conflicts[]`, where both values are kept, plus `notes`.
- **Simulator link:** `tekpractice`, giving `in_catalog`, `catalog_id`, `sim_value`, and proposed new ids.

The full contract is `schema/device.schema.json`; `tools/validate.py` enforces it.

## How to use it

**Learning platform (course writers).**
- Start from `fundamentals/NN-*.md`. Each file gives the key concepts, verified formulas with numbered sources, common mistakes and equipment links. The `bts_mapping` frontmatter says which épreuve it serves, but the savoir codes are **not yet verified** (see OPEN_QUESTIONS #12).
- To illustrate a concept with real gear, filter `equipment.csv` by `category` / `sub_type`. Link `manual_url` (French where one exists).
- `learning-resources.md` has a "Par où commencer" section for first-year students.
- Two possible errors in existing course content are listed in OPEN_QUESTIONS #10–11.

**TekPractice.**
- `equipment/tekpractice-mapping.md` ranks the next devices to add. Each one already has its real connectors mapped to catalog ids.
- To turn a KB record into a catalog device, copy `id`, brand and model into `realWorld`. Then pick the teaching-relevant subset of `connectors[]` as `ports` (the catalog simplifies port counts on purpose) and keep `catalog.json` as the source of truth (`tekpractice-sim/CLAUDE.md`). The KB never edits `catalog.json`.
- 3D: use `3d-models.md` for candidates. Only CC0 / CC-BY files are committed (`3d-models/`), and they still need the rig pass described in `tekpractice-sim/docs/TekPractice_3D-Model-Sourcing.md` and genericizing for the trademark rule.

**Maintaining the data.**
1. Edit the JSON, never the CSV.
2. Run `python knowledge-base/tools/validate.py` (must show 0 errors).
3. Run `python knowledge-base/tools/build_csv.py`, then `python knowledge-base/tools/tekpractice_mapping.py`.
4. Run `python knowledge-base/tools/check_urls.py` from time to time; manufacturer links rot.

To add a category or sub-type, add it to `taxonomy.json`, and add the file name to that category's `equipment_files`.

## TEK Brain (run 2)

See [`tek-brain/README.md`](tek-brain/README.md) for the entity model, validation commands and how TekPractice (`npm run sync:kb`) and the learning site use it. Quality numbers are in [QUALITY_REPORT.md](QUALITY_REPORT.md#run-2-tek-brain-2026-10-22), and the decisions waiting for Oscar are in OPEN_QUESTIONS sections E–F.

## Next steps

1. **Second research pass** with a higher web-search budget, or by hand in a browser, for the blocked manufacturers. Targets: the Yamaha manual library, Neumann downloads, Behringer/Midas, AKG, Sony, Audio-Technica, Sound Devices, Electro-Voice, avid.com. See `manuals-missing.md`.
2. **Verify BTS savoir codes** against the référentiel PDF and flip `verified: true` in `fundamentals/*.md`.
3. **TekPractice:** decide the open questions in section A of OPEN_QUESTIONS (add DI + passive PA + ribbon; new connector ids).
4. **Fix the two flagged course-content discrepancies** in `learning-platform` (OPEN_QUESTIONS #10–11).
5. **Gaps:** `year_introduced` pass via trade press; class-A amplifier sub-type; more French manuals.
