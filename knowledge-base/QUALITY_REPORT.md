# Quality report (2026-10-22)

The metrics come from `tools/validate.py`, `tools/build_csv.py` (`tools/stats.json`), `tools/check_urls.py` (`tools/url-check.json`) and an independent spot-check (`qa/spot-check.md`). Re-run all of them from the repo root:

```
python knowledge-base/tools/validate.py
python knowledge-base/tools/build_csv.py
python knowledge-base/tools/check_urls.py
python knowledge-base/tools/tekpractice_mapping.py
```

## 1. Headline numbers

| Metric | Value |
|---|---|
| Equipment files / devices | 22 files / **357 devices** in 18 categories |
| Validator (schema, taxonomy ids, connector/signal ids, duplicates) | **0 errors**, 20 warnings ("no verified-primary source") |
| Duplicate ids | 0 (checked globally across files) |
| Sources on devices | 958: 796 verified-primary, 161 verified-secondary, 1 unverified |
| Devices with ≥ 1 verified-primary source | 337 / 357 (**94 %**) |
| Devices with an official manufacturer manual link | 246 / 357 (**69 %**) |
| Devices with a French manual recorded | 69 / 357 (19 %). Undercounted: multilingual PDFs tagged `multi` are not counted. |
| Devices with ≥ 1 field confirmed by two non-unverified sources | 269 / 357 (**75 %**) |
| Recorded source conflicts (both values kept) | **200** |
| `year_introduced` sourced | 44 / 357 (manufacturers rarely state it) |
| `status` "not found" | 23 |
| Spec keys suffixed `_unverified` (snippet-level only) | 7, all in `processors-dynamics-eq.json` (Distressor EL8) |
| Per-file `not_found_log` entries | 305 |
| Taxonomy | 21 categories (2 proposed) / 131 sub-types (a few proposed) |
| Fundamentals | 19 files, about 180 numbered sources |
| Learning resources | 56 (19 FR, 30 EN, 7 multi; 17 free, 9 freemium, 30 paid) |
| 3D catalogue | 80 candidates (29 yes / 40 with work / 11 no) + 20 committed glb (15 CC0, 5 CC-BY 3.0) |

"Two-source" means at least two sources whose `covers` include the same field. The second source is often another document from the same manufacturer (product page + datasheet/manual). That is a real cross-check of the manufacturer's own consistency, but it is not independent.

## 2. Per category

| Category | Devices | Official manual | 2-source | Primary src | FR manual | Conflicts | In TekPractice |
|---|---|---|---|---|---|---|---|
| microphones | 63 | 42 | 52 | 58 | 3 | 40 | 5 |
| consoles | 30 | 23 | 21 | 28 | 5 | 9 | 2 |
| processors-outboard | 26 | 16 | 23 | 23 | 4 | 41 | 1 |
| cables-connectors | 22 | 3 | 1 | 22 | 0 | 4 | 1 |
| interfaces-converters-clocks | 18 | 15 | 15 | 17 | 3 | 9 | 3 |
| loudspeakers | 18 | 16 | 14 | 18 | 10 | 10 | 2 |
| broadcast-radio | 18 | 15 | 12 | 18 | 5 | 7 | 3 |
| recorders-playback | 18 | 11 | 18 | 13 | 5 | 4 | 0 |
| headphones-iem | 16 | 11 | 15 | 13 | 5 | 17 | 0 |
| studio-monitors | 16 | 13 | 13 | 16 | 2 | 4 | 2 |
| wireless-systems | 16 | 16 | 8 | 16 | 12 | 11 | 0 |
| amplifiers-processors | 16 | 16 | 13 | 16 | 7 | 4 | 0 |
| stageboxes-networking | 16 | 8 | 14 | 16 | 1 | 4 | 1 |
| accessories-mounting | 15 | 7 | 10 | 15 | 1 | 3 | 2 |
| software | 15 | 11 | 11 | 15 | 3 | 4 | 0 |
| di-splitters | 13 | 10 | 13 | 13 | 0 | 24 | 0 |
| measurement-tools | 13 | 9 | 9 | 12 | 3 | 4 | 0 |
| patchbays | 8 | 4 | 7 | 8 | 0 | 1 | 1 |

Cables and connectors have datasheets, not "manuals", which is why that column is low there. Sub-types with no device: `class-a` (amplifiers; no pro product explicitly states class A), and the proposed taxonomy categories (`power-distribution`, `show-control-interfaces`).

## 3. URL check (all JSON + fundamentals Markdown)

1,652 distinct strings checked, 10 of them prose rather than URLs (`not-a-url`, from not_found_logs).

| Status | Count | Meaning |
|---|---|---|
| ok | 1,508 (92 % of real URLs) | 2xx after redirects |
| blocked | 121 | 401/403/429/503 to a script: the page usually exists (AKG/Harman, Sony, avid.com, Yamaha, aes.org…) and opens in a browser |
| dead | 8 | 404/410, listed below |
| http-500 / 522 / 526 | 3 | Server-side errors (musictribe CDN, secure.aes.org forum, a rental shop) |
| error | 2 | `sti.eduscol.education.fr` (connection reset all night; see OPEN_QUESTIONS #12) and a Lille académie PDF |

Dead links and the action taken:
- **Sennheiser e 835 FR, e 906 EN/FR manual PDFs.** These signed asset links expired. They are flagged `url_status: dead`. The e 906 `manual_url` was repointed to its other official manual (the evolution wired notice d'emploi). The e 835 `manual_url` was already the evolution-wired notice, which is OK.
- **Yamaha QL5 FR reference manual** (de.yamaha.com) is flagged dead. It is not the record's `manual_url`.
- **Taxonomy sources**: aeq.es, LOM knowledge base, a Sonifex FAQ, and a videocraft.com.au retailer page. These are secondary sources in `taxonomy.json`, left in place with the dead status in `tools/url-check.json`.

`url_status` / `<field>_status` were written into every source and manual entry in equipment, learning-resources and 3d-models JSON.

## 4. Independent spot-check (`qa/spot-check.md`)

36 devices (≥ 10 % of 357): 30 drawn at random (seed 20261022) plus 2 each from the condenser, dynamic/ribbon and recorder files. 175 fields re-checked against the cited sources:
- **170 match, 3 partial, 1 mismatch, 1 unreachable.** No spec value contradicted its source.
- Device verdicts: 28 pass, 7 minor issues, **1 fail**: `lawo-ruby` was marked current, but its own cited page says it was replaced by Lawo diamond. **Fixed**: status set to discontinued.
- Other fixes applied: `km-210-9` (an unsourced white article number removed; manual language corrected to DE+EN), `yellowtec-litt` (two manual languages "not stated" set to EN), `sound-devices-mixpre-6-ii` (official product page added). Each fix is logged in the device's `notes` with a `[QA 2026-10-22]` tag.
- Not fixed: `akg-d112-mkii` (Thomann-only), `universal-audio-teletronix-la-2a` (manual is UA's own but hosted on Adorama), `riedel-bolero` (beltpack page is for a discontinued variant). These need a manufacturer source.
- **Pattern:** `status` is the weakest field. Three records base "current" on retailer pages. Retailer-derived specs did **not** drift from manufacturer figures in this sample.

## 5. Unverified / weak items to treat with care

- 20 devices without a verified-primary source (validator warnings): e.g. AKG D112 MKII, AKG C451 B and C414 XLS, Behringer X32 / X1204USB / ECM8000, Sony MDR-7506, ATH-M50x, Avid HD I/O, RCS Zetta, Sound Devices 888, MixPre-6 II, Zoom F8n Pro, Aaton Cantar-X, UA SOLO/610, Drawmer DS201, Eventide H9000, miniDSP UMIK-1. The cause is almost always a manufacturer site that blocks scripts (403) or renders by JavaScript.
- **Distressor EL8:** data comes from a stereo variant's retailer page plus search snippets. 7 keys are suffixed `_unverified`. Re-research or drop it.
- **XLR pin 2 hot:** sourced via Wikipedia, which cites EIA RS-297-A, because aes.org returned 403. It is marked secondary.
- **Fundamentals:** every BTS savoir mapping is `verified: false` (eduscol unreachable). The décret 2017-1244 limits are sourced via ARS Île-de-France and a CIDB/DGS presentation, not Légifrance.
- **Process deviation:** the `microphones-specialty` agent typed some manufacturer URLs from memory and kept only those that fetched successfully. Each one was live-verified, but this departs from the "URL must come from a tool result" rule. The affected records are in `microphones-specialty.json` (RØDE and Shure pages).

## 6. Licence issues

- **Committed 3D files:** 20 glb, all CC0 or CC-BY 3.0, with credits in `3d-models/CREDITS.md` and `3d-models/downloads.json`. The orchestrator re-checked the CC-BY licence on two Poly Pizza pages (Peter Simcoe mixing desk, Poly by Google microphone). One downloaded CC-BY model (server rack) was deleted because its textures carried OVH and Tripp Lite logos and photo-derived imagery. The Poly Haven models' "no logos" flag was assumed, not inspected.
- **Catalogue only (not committed):** 7 Sketchfab models under NC, ND or "Standard" licences, 3 L-Acoustics CAD files with no stated terms, and 1 CC-BY copy of a real broadcaster's set (ARD Tagesschau, trade-dress risk). All are marked "no".
- **Trademarks:** 40 "with work" entries show real brand logos. Per `tekpractice-sim/CLAUDE.md`, shipped visuals must be genericized.
- **Manuals and books:** none copied. Links only, no PDF in the repo. No pirate or shadow-library links: the learning resources point to publisher, bookseller (Eyrolles) or official free sources.

## 7. Known structural limits

- The session-wide **WebSearch cap (200 calls) ran out in the first hour**. Most research was done by navigating manufacturer sites directly. This is the main reason for the missing manuals and the dropped candidates (see `manuals-missing.md`).
- **Wikipedia** appears as a verified-secondary source in a few places, always alongside or in place of a blocked primary.
- The **"French manual" count** only counts entries tagged `fr`. Multilingual PDFs (`multi`) often include French but are not counted.

---

## Run 2: TEK Brain (2026-10-22)

Branch `research/tekbrain`. Re-run everything from the repo root:
```
python knowledge-base/tools/validate_tekbrain.py --strict
python knowledge-base/tools/schema_check.py
python -m unittest discover -s knowledge-base/tools/tests
python knowledge-base/tools/check_urls.py
```

### Counts (targets from the master prompt)

| Entity | Count | Target |
|---|---|---|
| Concepts | 414 | ≥ 300 ✓ |
| Procedures | 96 | ≥ 80 ✓ |
| Rules | 82: 9 mirror R1–R8, 73 proposed; 15 evaluable with today's catalog | ≥ 60 ✓ |
| Faults | 101 | ≥ 80 ✓ |
| Scenarios | 41 | ≥ 40 ✓ |
| Glossary terms | 780 | ≥ 600 ✓ |
| Skills | 60 | (not set) |
| Room templates | 32 (all planned venue types) | (A3) |
| Retrieval chunks | 1,832 | (A5) |
| Learning resources | 315 total; 260 added; **260 legally free**; 75 in French | ≥ 200, ≥ 80 free ✓ |
| 3D candidates | 983 (217 devices, 465 props, 112 rooms, 54 venues, 47 characters, 88 materials/HDRIs) | ≥ 400 ✓ |
| Committed 3D files | 64 glb (20 from run 1 + 44 new), 26.2 MB, largest 2.74 MB, all ≤ 100 k triangles, CC0 or CC-BY with credits | ≤ 5 MB each ✓ |

### Validation

- `validate_tekbrain.py --strict`: **0 errors, 0 warnings, 0 unresolved references**. Checks: schemas, unique ids, every source complete, formula → source link, condition DSL, room geometry, references to concepts, procedures, rules, rooms, equipment, signals, connectors and 3D models, and placeholder URLs.
- `schema_check.py`: 151 files against `schema/tek-brain.schema.json` and `schema/room.schema.json`, 0 errors. A deliberately broken record raises 15 errors.
- Index builder: 9 unit tests pass.

### Independent spot-check (`qa/tek-brain-spot-check.md`)

207 records were drawn with seed 20261022, at least 10 % of each group, and re-checked against their sources by an agent that wrote none of them. Results: **157 pass, 49 minor, 1 fail, 0 unreachable**. Every number tested was found in its source. That covers Crown XLS powers, ITU/EBU values, the R128 tolerances, the ARS 102/118 dB limits, room dimensions and RT60s, all 8 3D licences and all 26 resource links.
- **The fail.** A talk-show scenario fed 5 headphones from one 4-output amp. It was fixed, along with all 56 minor findings:
  - 15 unsupported sentences deleted
  - 6 claims newly sourced
  - 11 rewordings
  - 163 confidence labels raised to verified-primary for manufacturer and regulator documents
- **Pattern to watch.** Agents sometimes added a "field practice" sentence to a well-sourced field; `covers` then over-claims.

### Links

The `check_urls.py` run covered the whole KB: 3,161 distinct URLs (2,788 ok, 276 blocked, 68 dead, 9 other errors, 21 prose strings).
- **52 of the 68 "dead" were not dead pages.** They were Objaverse file URLs with a literal `<shard>` placeholder written by one 3D agent. They are now replaced by the object id plus "not found", and `validate_tekbrain.py` rejects placeholder URLs from now on.
- **16 links are genuinely dead (404).** These include 3 signed Sennheiser asset links, aeq.es, a broadcast-solutions page, a Yamaha FR PDF, an Ircam forum page, the LOM knowledge base, INA, Sonifex, ATSC, CNC and Radio France pages. They stay marked `dead`.
- **Blocked (276).** Mostly aes.org, yamaha.com, audinate.com, sweetwater, iso.org and legifrance. These are scripts being refused; the pages open in a browser.

### Known limits

- **BTS mappings** are all `verified: false` (eduscol unreachable from this PC).
- **Décret 2017-1244 figures** are sourced through ARS Île-de-France and Grand Est plus the DGS/DGPR 2023 note. Légifrance returned empty pages to scripts.
- **Sketchfab licences** for the 2 run-2 Sketchfab catalogues (525 entries after de-duplication) were read from the search API. The per-model endpoint returned HTTP 429 for 30+ minutes, so re-check each licence on the model page before downloading. No Sketchfab file was downloaded: there is no API token.
- **Room dimensions.** About half the room templates rely partly on estimates (listed per room); all 32 are `needs-oscar-review`.
- **Proposed rules.** 67 of 82 need catalog fields that do not exist yet (impedance, power, cable length, SPL, RF frequency…). They are listed per rule.
- **Equipment gaps** found while writing scenarios: no DJ gear, no conference DSP with AEC, no IR interpretation system, no hearing-loop driver and no small-diaphragm omni in the equipment KB.