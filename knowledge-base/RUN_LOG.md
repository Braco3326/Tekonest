# Run log: knowledge-base build

Times are local (Europe/Paris). Run started 2026-10-22.

## Phase 0: setup
- No git on the PC. Downloaded portable MinGit 2.56.0.2 (git-for-windows GitHub release) into `%LOCALAPPDATA%\MinGit`, with no admin install.
- Cloned `https://github.com/Braco3326/Tekonest` (public) to `C:\Users\brro\dev\Tekonest`. Created branch `research/sound-equipment-database` from `main` @ `fcaa9d8`.
- Set repo-local git identity to `Braco3326 <l3lim3d@gmail.com>`, the same as the existing commits.
- Read `tekpractice-sim/content/catalog.json` (24 devices, 26 connectors, 16 signals, R1–R8), `public/assets/ASSET_MANIFEST.json`, `tekpractice-sim/CLAUDE.md` (trademark rule: generic visuals), `docs/TekPractice_3D-Model-Sourcing.md`, and `learning-platform/src/data/referentiel.ts` (E1–E6, BC01–BC04, official source URLs).
- Wrote `docs/DESIGN.md` (spec + deep-scan gap table), `taxonomy.json` (frozen ids), `schema/device.schema.json`, `tools/validate.py`, `docs/AGENT_BRIEF.md`.
- Wave A (taxonomy + 10 equipment agents) and wave B (6 of 12 equipment agents) launched in parallel. The other 6 hit the 20-concurrent-subagent cap and are launched as slots free up.
- **Blocker hit:** the session-wide WebSearch budget (200 calls shared by all agents, refilling at about 100 per hour) ran out early in wave A. All agents were told to use WebFetch navigation on manufacturer and official domains instead. Scraping search engines is not allowed, so it was not used as a workaround. Effect: fewer devices per category and more "not found" entries, by design (accuracy over volume).
- `processors-dynamics-eq.json` done: 18 devices, 10 with an official manual, 17 cross-checked against two sources, 34 conflicts. The weakest entry is the Distressor EL8 (retailer and snippet-level data).

## Phase 1: taxonomy (commit `6f3d0da`)
- 19 categories and 114 sub-types enriched with FR/EN description, principle, uses and sources. Proposed additions are flagged `proposed: true`: `power-distribution` and `show-control-interfaces` categories, plus sub-types `timecode-sync` and `sound-level-limiter-logger`.
- 53 taxonomy items have no source opened because of the search budget. They are listed in the taxonomy `not_found_log`.

## Phase 2–3: equipment + manuals (commits `5df7667` … `0b292da`)
- 22 equipment files, 335 devices, 0 validator errors, after the first pass. Each file was committed after it validated.
- Recurrent blockers: JavaScript-only manufacturer download centres (Yamaha, Neumann, Behringer/Midas, Steinberg, Electro-Voice), 403s (AKG/Harman, Sony, Audio-Technica, Sound Devices, avid.com, HBK, Belden), 503s (Eventide), dead domains (auratone.com, Mosses & Mitchell). The affected devices were swapped for reachable equivalents or logged in `not_found_log`.
- One agent (microphones-specialty) typed some manufacturer URLs from memory and kept them only if the fetch succeeded. This is a deviation from the "URL must come from a tool result" rule, but each URL was verified live. It is flagged in QUALITY_REPORT.
- Notable research findings: AETA lists both TekPractice codecs (Scoop5 S, Scoopy+ S) as discontinued. Aaton Digital was liquidated (Feb 2024). ARCEP PMSE bands are 470–694, 823–832 and 1785–1805 MHz, and 694–789 MHz has been closed to PMSE since 2019-07-01. d&b DS10 is Dante, while DS20 is the Milan bridge.
- Gap-fill agents launched for playout systems, class-AB amps and dropped reference mics (DPA, Rode, AT, Shure KSM, AKG).

## Phase 6: 3D models (commit `20f6aa0`)
- `3d-models.json/.md`: 80 link-only candidates with licences read from the Sketchfab API, the Poly Haven API and Poly Pizza pages. 11 are marked "no", including NC/ND/Standard licences, L-Acoustics CAD with no stated terms, and a CC-BY copy of a real broadcaster's set.
- `3d-models/`: 20 glb files (16 MB; 15 CC0, 5 CC-BY 3.0) with CREDITS.md. A Poly Pizza CC-BY server rack was downloaded, then deleted because its textures carried OVH and Tripp Lite logos. The orchestrator re-checked two CC-BY licences on poly.pizza.

- Process note: the brainstorming skill normally asks for approval before implementation. Oscar asked for an unattended run, so the decisions are recorded in `docs/DESIGN.md` and the open points in `OPEN_QUESTIONS.md`.
