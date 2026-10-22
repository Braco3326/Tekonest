# Knowledge base: design spec (2026-10-22)

Autonomous overnight run. The brainstorming skill normally waits for approval at each step. Oscar asked for no interruptions, so this spec records the decisions made, and anything that really needs his input goes to `../OPEN_QUESTIONS.md`.

## Goal

A verified, sourced reference database of sound equipment and sound-engineering knowledge that feeds:
1. the course steps of `learning-platform/` (BTS MAV option Son), and
2. the devices, levels and 3D assets of `tekpractice-sim/`.

Accuracy over volume. Every fact traces to a URL that was actually opened during the run.

## Constraints (from the brief + repo)

- Branch `research/sound-equipment-database`. Everything lives under `knowledge-base/`. No edits elsewhere except one row in the root `README.md`.
- `tekpractice-sim/content/catalog.json` is the simulator's source of truth (see `tekpractice-sim/CLAUDE.md`). Read only. The knowledge base reuses its connector and signal ids and proposes new ones separately.
- Trademark rule from `tekpractice-sim/CLAUDE.md`: shipped visuals are generic. 3D candidates record `shows_brand_logos` so the rig pass knows what to strip.
- Copyright: manuals, books and 3D files are linked, not copied. Only CC0 / CC-BY files with a recorded licence may be committed.

## Architecture

```
knowledge-base/
  README.md  RUN_LOG.md  OPEN_QUESTIONS.md  QUALITY_REPORT.md
  taxonomy.json  taxonomy.md               Phase 1: category + sub_type ids (stable slugs)
  schema/device.schema.json                contract for every equipment record
  equipment/<category>.json                Phase 2-3: one file per category file-slug
  equipment/tekpractice-mapping.md
  equipment.csv                            generated from equipment/*.json, never hand-edited
  manuals-missing.md                       generated
  fundamentals/<nn>-<topic>.md             Phase 4
  learning-resources.json / .md            Phase 5
  3d-models.json / .md, 3d-models/CREDITS.md   Phase 6
  tools/validate.py  tools/build_csv.py  tools/check_urls.py   stdlib-only Python
  docs/DESIGN.md                           this file
```

Data flow: taxonomy ids feed equipment records. The validator checks the records against the schema and taxonomy. The build script generates the CSV, manuals-missing and stats, and the URL checker annotates `url_status`. The quality report is written from the validator output.

## Device record contract (summary; full contract in `schema/device.schema.json`)

The requested fields, plus three additions:
- `sources[].covers`: the list of fields or `key_specs.*` keys that each source supports. This gives per-fact traceability, and a spec counts as two-source verified when at least two sources cover it.
- `manuals[]`: `{url, language, file_type, version_or_date, official}`. `manual_url` keeps the primary one (French if it exists, otherwise English).
- `tekpractice`: `{in_catalog, catalog_id, connectors_mapped, proposed_new_connectors, proposed_new_signals}`.

Unknown values use the string `"not found"`, never a guess. Conflicts go in `conflicts[]` as `{field, values:[{value, source_url}], note}`.

## Execution

Research runs in parallel subagents, one per category file (about 12-18 devices each) so each agent's context stays small. Agents write JSON files only and never commit; the orchestrator validates and commits after each phase. Waves:
1. Taxonomy enrichment (one agent) + equipment wave A (about 10 agents)
2. Equipment wave B (about 11 agents)
3. Fundamentals (4 agents) + learning resources (1) + 3D models (2)
4. QA: validator, URL checker, independent spot-check agent (10% or more of devices re-fetched)
5. Delivery docs, push

## Deep-scan gap analysis of this plan (condensed)

| Gap | Severity | Mitigation |
|---|---|---|
| Subagents may write URLs or specs from memory (hallucination) | CRITICAL | Hard rule in every prompt: a URL must come from a tool result in the agent's session. Phase 7 URL checker plus an independent spot-check agent. Failed checks are downgraded to `unverified`. |
| Inconsistent fields across 20+ agent outputs | HIGH | One schema file plus a validator run after each wave. The orchestrator fixes or bounces bad records. |
| Taxonomy ids drift between agents | HIGH | Taxonomy ids are frozen before wave A. The validator rejects unknown category or sub_type values. |
| Manufacturer sites block bots (403/JS-only), so "broken" is a false negative | MEDIUM | The URL checker separates `blocked/403` from `404/dead`. Only 404/410/DNS failures count as broken. |
| Duplicate devices across categories (for example IEM in headphones vs wireless) | MEDIUM | Ownership per category file is fixed in the agent prompts. The validator checks for duplicate ids globally. |
| Push may fail: MinGit has no stored GitHub credentials on this PC | MEDIUM | Commit locally throughout. Try a non-interactive push at the end. On failure, log it and give Oscar the one command to run. |
| BTS épreuve mapping invented | HIGH | Map only to E1-E6 / BC01-BC04 as already sourced in `learning-platform/src/data/referentiel.ts` and the eduscol référentiel. Anything else is flagged `unverified`. |
| 3D licence misread (Sketchfab "Standard"/editorial) | HIGH | Download only when the page states CC0 or CC-BY and the licence string is recorded verbatim. Everything else is link-only. |
| Year introduced rarely on manufacturer pages | LOW | Allowed as `"not found"` or secondary-sourced. |
