# Fohhn benchmark → TekPractice design proposals

- **Agent:** tekinspi (registered in `.claude/agents/REGISTRY.md`).
- **Date:** 2026-10-24.
- **Branch:** `research/fohhn-benchmark`.
- **Scope:** research and architecture only. TekPractice's engine, `website-prototype/` and the design branches were **not changed**.

## What this is

A live, evidence-labelled audit of Fohhn's three browser tools:
- **Speaker Viewer**: every tab;
- **Optimizer**: setup and settings;
- **Designer**: projects, editor and **Snapshots** (the priority).

It is backed by Fohhn's login-gated Help Centre (141 pages, paraphrased), public sources, acoustics literature and peer tools. The audit is turned into **original** proposals for the TekPractice web app, then challenged by an expert council.

**Product distinction kept throughout:**
- TekPractice = an *educational wiring and set-building game* (BTS MAV option Son).
- Fohhn = *professional acoustic planning and measurement*.
- Nothing user-facing in TekPractice may carry Fohhn's name, data, wording or look.

## Read in this order

| File | What it gives you |
|---|---|
| `scope-decision.md` | **The decision memo.** Options, cost, risk, the council recommendation and dissent, the decisions needed (D1–D8), and the ranked open questions |
| `designer-snapshots.md` | The full Snapshots journey: what is captured (Observed / Documented / Inferred / Unknown), the live tests of immutability and branching, the stale-result gap |
| `prototype-brief.md` | Learning scenarios S1–S3, interface direction, controls, state board, **fidelity ladder**, phased plan, smallest prototype, risks |
| `tekpractice-data-model.md` | Entity diagram, TypeScript interfaces, by-value vs by-ID, lifecycle, storage, example JSON, file changes |
| `tekpractice-crosswalk.md` | Fohhn observation → learner benefit → mechanic → data → effort → confidence |
| `wireframes/layout.svg`, `wireframes/states.svg` | Annotated wireframe (1366 × 768) and state-by-state board, original drawings. The PNG previews sit next to them |
| `interface-inventory.md` | Every app and tab: states, controls, units, axes, colour scales, comparison, responsive behaviour, and what was **not** inspected (§4) |
| `technical-observations.md` | Rendering (three.js r149 / SVG), data access names, persistence, accessibility, performance |
| `tekpractice-current-state.md` | TekPractice on `main`, `feature/tekpractice-explore-controls` and `research/tekbrain`: 10 areas, status per ref, 20 gaps |
| `source-ledger.md` | Every source with URL and access date, flagged by type |
| `screenshot-index.md` | 103 captures, each with its action and observation (the images stay local; see below) |
| `council/` | Round 1 and round 2 from 4 experts, the neutral synthesis and the validator |
| `research_notes/Fohhn tools documentation/` + `reports/Fohhn tools documentation.md` | The deep-research notes (6 files) and the documentation report (read its header note first) |

## Evidence labels

- **Observed:** URL + screenshot ID + action.
- **Observed (DOM eval):** a one-off query seen live and not kept as a file.
- **Documented:** an official source + section.
- **Inferred.**
- **Unknown or inaccessible.**

## Guardrails applied

**What I did:**
- Read Fohhn's **Terms of use** (2021-09-29) first. They forbid copying, reverse engineering and derivative works, so only what a normal session shows was recorded.
- Recorded **no page source, no scripts and no data responses**.
- Kept the Help Centre text in scratch for analysis only and **deleted it** after paraphrasing.
- Used Oscar's sign-in, done by Oscar. **No password was ever seen.** The account's display name is a student's and is **redacted** everywhere.
- Kept the **screenshots on the research PC only**. The repo is public, so `screenshots/` is git-ignored.
- **Tested on a duplicate** of "Example - Hall", named "Audit copy - Hall (tekinspi, delete me)". The examples were not edited. In the copy, one test simulation ran and one draft snapshot was created. Dialogs for delete, archive, share, edit and new project were opened and **cancelled**. Language and Viewer selection were restored.

**Incident, disclosed:** the Help Centre crawler followed six download links: a commissioning PDF and tutorial room-model files. Playwright stored them unopened in its temp folder. My delete was blocked by the session's protected-path guard, and they **were still there** after the browser closed. Oscar is asked to delete `%TEMP%\playwright-artifacts-lwJUGU` (6 files, about 530 KB). They were never opened, copied or committed.

## Skills used

- **`superpowers:using-superpowers`:** workflow discipline.
- **`anthropic-skills:deep-scan`:** the TekPractice map (passes 0–2; its module files are missing from the skill, so `SKILL.md` was used). The final gap pass took the form of the independent screenshot cross-check (`raw/screenshot-crosscheck.md`) plus the council validator.
- **`anthropic-skills:deep-research`:** 5 parallel researchers + 1 Help Centre analyst + the report writer.
- **`anthropic-skills:canvas-design`:** loaded. It is an art-poster skill, so only its craft rules were applied (margins, no overlaps, a limited palette) to the wireframes and boards. No "design philosophy" artwork was produced.
- **`expert-council`:** Tier 3: 4 dynamic personas, 2 rounds, a neutral synthesiser and a validator.
  - The approval gate is replaced by Oscar's decision in `scope-decision.md`, since the founder asked for the recommendation, not execution.
  - The council personas were one-off subagents, not persistent agents, so no naming was needed.

## Not covered (the audit is not complete for these)

See `interface-inventory.md` §4. In short:
- an Optimizer measurement and the QR phone flow;
- Designer room import, materials and the wizard;
- drawing and aiming tools;
- early reflections and auralisation;
- report, PDF and Audio Soft exports (no downloads);
- the Conference Room and Theatre examples opened only as cards;
- sharing with another user;
- Oscar's 9 screenshots (not received).
