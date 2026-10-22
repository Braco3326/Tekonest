# TEK Brain: design spec (A1)

Status: accepted for the autonomous run of 2026-10-22. The founder was not available, so every clarifying question the brainstorming process would have asked is answered in §9 and copied into `../OPEN_QUESTIONS.md` (section D) for review.

## 1. Purpose

TEK Brain is the machine-usable knowledge of a polyvalent sound technician (live, studio, broadcast/radio, post, installation, orchestra, conference). It serves three consumers:

| Consumer | Reads | For |
|---|---|---|
| TekPractice simulator (`tekpractice-sim/`) | `rules/`, `scenarios/`, `rooms/`, `procedures/`, `index/` | New rule modules, level drafts, procedural rooms, coach citations |
| Learning platform (`learning-platform/`) | `concepts/`, `procedures/`, `faults/`, `glossary/`, `curriculum.md`, `index/` | Course steps, glossary, AI tutor |
| Humans (Oscar, teachers) | `README.md`, `curriculum.md`, the `.md` views | Review and teaching |

Non-goals: no audio DSP, no copy of copyrighted text, no exam answers for the coach in exam mode.

## 2. Approaches considered

1. **One big file per entity type** (e.g. `concepts.json` with 300 items). Simple, but 17 parallel research agents would collide on the same file.
2. **One file per domain holding every entity type.** No collisions, but validators and consumers must open every file to find one entity type.
3. **Chosen: `tek-brain/<entity>/<domain>.json`.** Each research agent owns one domain and writes one file per entity type. No write collisions, entity-typed files for consumers, and the existing KB already uses "one file per category".

## 3. Layout

```
knowledge-base/
  schema/tek-brain.schema.json      JSON Schema (2020-12), one $def per entity
  schema/room.schema.json           parametric room template
  tools/validate_tekbrain.py        stdlib-only validator (schemas, ids, cross-refs)
  tools/build_index.py              chunker for the retrieval index (A5)
  tek-brain/
    DESIGN.md  README.md  AGENT_BRIEF.md  curriculum.md  AI_USAGE.md
    domains.json                    the 17 domain ids + owner of each seed concept
    concepts/<domain>.json
    skills/<domain>.json
    procedures/<domain>.json
    rules/<domain>.json
    faults/<domain>.json
    scenarios/<domain>.json
    glossary/<domain>.json
    rooms/<room-id>.json            one file per parametric room template (A3)
    index/chunks.jsonl + index/manifest.json (A5)
```

Every entity file has the same envelope:

```json
{ "entity": "concept", "domain": "microphones-miking", "generated": "2026-10-22",
  "items": [ ... ], "not_found_log": [ { "what": "...", "searched": "..." } ] }
```

## 4. Domains (ids are frozen)

`acoustics-psychoacoustics`, `electricity-levels`, `microphones-miking`, `consoles-signal-flow`, `dynamics-eq-effects`, `digital-audio-clocking`, `audio-networks`, `loudspeakers-system-tuning`, `monitoring`, `wireless-rf`, `live-sound`, `studio-recording`, `orchestra-classical`, `broadcast-radio`, `post-immersive`, `installation-conference`, `safety`.

## 5. Common fields

- **id**: kebab-case, unique **within its entity type** across all domains. References are typed by field name (`concept_ids`, `procedure_ids`…), so a concept and a glossary term may share a slug.
- **sources[]**: same object as the equipment schema: `url`, `publisher`, `accessed` (YYYY-MM-DD), `confidence` (verified-primary / verified-secondary / unverified), `kind`, `covers[]`. At least one source per record. `covers` names the fields the source supports (e.g. `definition`, `formulas[0]`, `steps`).
- **conflicts[]**: `{ "field", "values": [{ "value", "source_url" }], "note" }`. Both values are kept.
- **review**: `"needs-oscar-review"` | `"ok"`. A label, never a blocker.
- **bts_mapping[]**: `{ "epreuve": "E1|E2|E3|E4|E51|E52|E6", "bloc": "BC01..BC04" | null, "note", "verified": false }`. `verified` stays false unless the statement was checked on an official eduscol / référentiel page in this run (eduscol resets connections from this PC, see OPEN_QUESTIONS #12).
- Text is written in the agent's own words, French first; English technical terms go in `name_en` / `term_en` and in parentheses in the text.

## 6. Entities

### concept
`id, name_fr, name_en, domain, definition, explanation, formulas[], units[], related_concepts[], equipment_ids[], bts_mapping[], difficulty (1–5), sources[], conflicts[], review`

- `formulas[]`: `{ "expr": "Lp = 20·log10(p/p0)", "vars": { "p0": "20 µPa" }, "source_url": "<one of sources[].url>" }`. Only formulas found in a source; the source must be in `sources`.
- `equipment_ids[]`: ids from `knowledge-base/equipment/*.json` (validated).

### skill (competency)
`id, name_fr, name_en, domain, description, level (beginner|bts|pro), concept_ids[], procedure_ids[], success_criteria[] (observable, e.g. "le niveau crête reste entre −18 et −12 dBFS sur 3 prises"), bts_mapping[], sources[], review`

### procedure
`id, name_fr, name_en, domain, context, duration_min (typical, or null), equipment_ids[], concept_ids[], rule_ids[], steps[], safety_notes[], sources[], conflicts[], review`

- `steps[]`: `{ "n", "preconditions[]", "action", "expected_result", "typical_mistakes[]" }`.

### rule (machine-checkable)
`id, name_fr, name_en, domain, catalog_rule (R1..R8 | null), status (existing|proposed), severity (error|warning|info), scope (connection|device|graph|room|session), condition, explanation, fix, evaluable_now (bool), needs_catalog_fields[], concept_ids[], sources[], review`

- `condition` is a small JSON DSL over catalog data, so the simulator can evaluate it without free text:
  ```json
  { "all": [
      { "path": "dst.port.flags", "op": "includes", "value": "isMicInput" },
      { "path": "src.port.signal", "op": "in", "value": ["line-level-pro", "line-level-consumer"] } ] }
  ```
  Operators: `eq, ne, in, not_in, includes, excludes, gt, gte, lt, lte, exists`. Combinators: `all, any, not`. Paths start with `src.` / `dst.` (connection scope: `port.signal`, `port.connector`, `port.dir`, `port.flags`, `device.id`, `device.category`, `device.controls.<id>`), `device.` (device scope), `graph.` (graph scope: `graph.count(<filter>)`), `room.` (room template fields) or `session.` (e.g. `session.spl_dba_leq15`).
- A leaf `value` may be `{ "ref": "<path>" }` to compare two fields (added during A2: the R1/R2 mirrors compare `src.port.connector` with `dst.port.connector`, and loudspeaker rules compare a load with a rating). The simulator's evaluator must resolve `ref` before comparing.
- When a condition needs a property the catalog does not have yet (impedance, power rating, cable length, SPL), the rule lists it in `needs_catalog_fields` and sets `evaluable_now: false`. Those fields become catalog proposals for Oscar; catalog.json is never edited from the KB.
- R1–R8 are mirrored with `status: existing` so every rule the simulator knows has a sourced explanation.

### fault (troubleshooting)
`id, name_fr, name_en, domain, symptom, contexts[], probable_causes[] ({ cause, likelihood: high|medium|low }), checks[] (ordered), fixes[], rule_ids[], concept_ids[], equipment_ids[], sources[], review`

### scenario
`id, name_fr, name_en, domain, brief, room_id (rooms/<id>.json or null), required_gear[] ({ equipment_id, qty, role }), signal_flow ({ nodes[{ id, equipment_id, label }], edges[{ from, to, signal, connector }] }), procedure_ids[], rule_ids[], difficulty (1–5), estimated_time_min, bts_mapping[], sources[], review`

- `signal_flow.edges[].signal` / `.connector` use TekPractice ids (or the proposed ids in `taxonomy.json`).

### glossary term
`id, term_fr, term_en, domain, definition, see_also[] (concept ids), sources[]`

### room template (`rooms/<id>.json`, schema `room.schema.json`)
`id, name_fr, name_en, family, size (small|medium|large), description, dimensions_m ({ length, width, height } each { min, typical, max }), coordinate_system ("origin = floor centre; x = right, y = up, z = toward the audience / listener; metres"), surfaces[] ({ surface: floor|walls|ceiling|front-wall|rear-wall|stage-floor, material, finish_note }), rt60_s ({ min, max, band_note, source_url } or "not found"), zones[] ({ id, kind: stage|foh|monitor-world|control-room|live-room|iso-booth|vocal-booth|audience|backstage|gallery|booth|pit|desk, rect_m: [x, z, w, d], floor_y_m }), gear_positions[] ({ equipment_id, zone, position_m: [x, y, z], rotation_deg, note }), power_points[] ({ position_m, type }), patch_points[] ({ position_m, type, note }), openings[] ({ wall, kind: door|window, offset_m, width_m, height_m }), lighting ({ mood, color_temp_k }), procedural ({ wall_color, floor_color, ceiling_color, prop_hints[] }), licensed_dressing[] (3d-models.json ids), sources[], review`

The game generates floor, walls, ceiling, zones and gear positions from `dimensions_m.typical` and the zones when no licensed model exists.

Wall names (fixed during A3): **front = −z** (stage / far end), **rear = +z** (back of the hall, where the audience faces from), **left = −x**, **right = +x**. An opening's `offset_m` runs along its wall from the wall centre. Seated people and FOH desks face −z (`rotation_deg` 180); front loudspeakers face the audience (`rotation_deg` 0). JSON Schemas: `schema/tek-brain.schema.json` and `schema/room.schema.json`.

## 7. Validation and quality

`tools/validate_tekbrain.py` (stdlib only) checks:
1. JSON well-formed, envelope present, `entity` matches folder, `domain` in `domains.json`.
2. Required fields per entity, enums, kebab-case ids, unique ids per entity type.
3. Every source object complete; every formula's `source_url` is in the record's sources.
4. Cross-references resolve: `concept_ids`, `related_concepts`, `procedure_ids`, `rule_ids`, `room_id`, `equipment_ids` (KB equipment), `catalog_rule`, signal/connector ids.
5. Unresolved references are **warnings** while research runs and **errors** with `--strict` (used in A6).

Exit code 1 on any error. `tools/check_urls.py` is reused for links.

## 8. Targets (accuracy first)

≥ 300 concepts, ≥ 80 procedures, ≥ 60 rules, ≥ 80 faults, ≥ 40 scenarios, ≥ 600 glossary terms, ≥ 25 room templates. Per domain this is about 18 concepts, 5 procedures, 4 rules, 5 faults, 2–3 scenarios, 35 terms. A smaller verified set wins over a larger invented one.

## 9. Self-answered design questions

| # | Question | Answer (default chosen) | Why |
|---|---|---|---|
| D1 | One file per entity, per domain, or per entity × domain? | Entity × domain | Parallel agents never write the same file |
| D2 | Must ids be unique across entity types? | No, within type only; refs are typed | Lets the glossary reuse concept slugs |
| D3 | Free-text or structured rule conditions? | JSON DSL + `evaluable_now` + `needs_catalog_fields` | The simulator can evaluate it; gaps become catalog proposals |
| D4 | Cross-domain refs before the target exists? | Warning during research, error in `--strict` final QA, with a fix-up pass | Agents run in parallel |
| D5 | BTS mapping without eduscol access? | Keep `verified: false`, explain in `note` | Never claim an unverified mapping |
| D6 | Room coordinates | Floor centre origin, metres, z toward audience | Matches Babylon's left-handed y-up world and the existing env presets |
| D7 | Glossary sources: one per term? | At least one; a standard's glossary or manufacturer glossary preferred | Same rule as every fact |
| D8 | Where does the game read rooms from? | A sync tool in `tekpractice-sim/tools/` copies validated templates into `content/rooms/` | Vercel builds only `tekpractice-sim/`; content layer stays data-only |
