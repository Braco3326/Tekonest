# TEK Brain

TEK Brain is the machine-usable knowledge of a polyvalent sound technician (live, studio, broadcast/radio, post-production, installation, orchestra, conference). It is sourced, written in French with English technical terms, and built to feed:
- the **TekPractice** simulator (rules, level drafts, generated rooms, the AI coach), and
- the **Tech Nest** learning site (course steps, glossary, tutor).

Built on 2026-10-22 (run 2) on branch `research/tekbrain`. Design and decisions: [DESIGN.md](DESIGN.md).

## What's inside

| Entity | Count | Folder | What it is |
|---|---|---|---|
| Concepts | 414 | `concepts/<domain>.json` | Definition, explanation, sourced formulas, units, related concepts, equipment, BTS mapping, difficulty 1–5 |
| Skills | 60 | `skills/` | What a technician must be able to do, with observable success criteria |
| Procedures | 96 | `procedures/` | Ordered steps: preconditions, action, expected result, typical mistakes |
| Rules | 82 | `rules/` | Machine-checkable constraints (JSON condition DSL). 9 mirror the catalog's R1–R8; the rest are proposed. `evaluable_now` and `needs_catalog_fields` say what the catalog must gain. |
| Faults | 101 | `faults/` | Symptom → probable causes (with likelihood) → checks → fixes |
| Scenarios | 41 | `scenarios/` | Real jobs: room, gear, signal-flow graph, procedures, rules, difficulty, time, BTS épreuve |
| Glossary | 780 | `glossary/` | French ↔ English terms with definition and source |
| Rooms | 32 | `rooms/<id>.json` | Parametric room templates (real dimensions, RT60, zones, gear positions, openings, power and patch points); the game generates rooms from them |

There are 17 frozen domains (`domains.json`): acoustics, electricity and levels, microphones, consoles, dynamics and EQ, digital audio and clocking, networks, loudspeakers and tuning, monitoring, wireless/RF, live, studio, orchestra, broadcast, post and immersive, installation and conference, safety.

Also in this folder:

| File | What |
|---|---|
| [`curriculum.md`](curriculum.md) | Learning path in 24 modules (Débutant → BTS → Pro). All 414 concepts are placed, each module has procedures, faults, a TekPractice level or scenario, and resources (free and French first). |
| [`AI_USAGE.md`](AI_USAGE.md) | How the coach and tutor retrieve and cite (`[kb:<chunk id>]`). The coach stays silent in exam mode. |
| `index/chunks.jsonl` + `manifest.json` | 1,832 retrieval chunks of the KB's own words, each with the URLs of its sources |
| `AGENT_BRIEF.md`, `ROOMS_BRIEF.md`, `MODELS_BRIEF.md` | The research briefs the agents followed (for reproducing or extending) |

## Sources and trust

- Every record has at least one source. Each source carries `url`, `publisher`, `accessed`, `confidence` (verified-primary / verified-secondary / unverified) and `covers` (the fields it supports). Disagreements are kept in `conflicts[]`.
- Numbers that could not be sourced are left out and logged in each file's `not_found_log`. Room dimensions that had to be estimated are listed there too, and those rooms are marked `review: "needs-oscar-review"`.
- An independent reviewer re-checked 207 records against their sources. Every fact tested held; the one wrong scenario and 56 minor issues were fixed. See [`../qa/tek-brain-spot-check.md`](../qa/tek-brain-spot-check.md) and the [quality report](../QUALITY_REPORT.md#run-2-tek-brain-2026-10-22).
- **BTS mappings are all `verified: false`.** eduscol refused every connection from this PC (see OPEN_QUESTIONS #12/#20).

## Schemas and tools

| | |
|---|---|
| `../schema/tek-brain.schema.json`, `../schema/room.schema.json` | JSON Schema 2020-12 contracts |
| `../tools/validate_tekbrain.py [--strict] [--domain d]` | Required fields, enums, ids, sources, formula→source links, condition DSL, room geometry, cross-references, and no placeholder URLs. Currently 0 errors, 0 unresolved references. |
| `../tools/schema_check.py` | Checks every file against the JSON Schemas (stdlib) |
| `../tools/build_index.py` | Rebuilds the retrieval index (tests in `../tools/tests/`) |
| `../tools/merge_resources.py`, `../tools/merge_3d.py` | Merge the learning-resource and 3D candidate fragments (idempotent) |
| `../tools/check_urls.py` | Link check across the whole KB |

After any edit:
```
python knowledge-base/tools/validate_tekbrain.py --strict
python knowledge-base/tools/schema_check.py
python knowledge-base/tools/build_index.py
python -m unittest discover -s knowledge-base/tools/tests
```

## How TekPractice uses it

From `tekpractice-sim/`, `npm run sync:kb` regenerates everything derived from the KB:
- `content/kb-sheets.json`: device sheets in the inventory
- `content/rooms/`: procedural rooms (`?level=sandbox&room=<id>`)
- `content/coach/kb-chunks.json`: fiches the AI coach may cite for R1–R8
- `content/proposals/catalog-proposals.json` and `content/levels/drafts/`: catalog additions and level drafts for Oscar to review. **Nothing is written to `catalog.json` or to the live levels.**

Rules marked `evaluable_now: true` can be implemented as new logic checks today. The others list the catalog fields they need (impedance, power, cable length, SPL…) in `needs_catalog_fields`.

## How the learning site uses it

- Course steps: use `concepts/` for the explanations and formulas (with their source links), `procedures/` for the "how to" steps, `faults/` for diagnosis exercises, and `glossary/` for the FR/EN glossary.
- `curriculum.md` gives the order. `../learning-resources.json` (315 resources, 260 legally free) links each resource to concept ids.
- The tutor follows `AI_USAGE.md`: grounded, cited and Socratic, and it refuses to solve graded work.
