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


## Gap-fill pass (commits `e06b1c8`, `45e981d`)
- Playout systems added (ENCO DAD, WinMedia, Netia Radio-Assist, RCS Zetta), along with Zoom F6 and the class-AB QSC RMX 850/1450. The class-A sub-type is still empty: no pro product page explicitly states class A.
- 15 reference mics added (DPA 4011/4060/4088, Rode NT1/NT5/NT-SF1, AT4040/4050, Shure KSM32C/Beta 91A/MV7+, AKG C451 B, Sennheiser MKE 2/MD 441-U, Behringer ECM8000). Total: 357 devices.

## Phase 4: fundamentals (commit `7e98335`)
- 19 files, about 180 numbered sources. The BTS savoir codes could not be verified: `sti.eduscol.education.fr` and `eduscol.education.fr` reset every connection from this PC (WebFetch, PowerShell and Python all failed). All mappings are `verified: false`.
- Two possible errors in existing `learning-platform` course content were found and logged in OPEN_QUESTIONS #10–11. They were not edited.

## Phase 5: learning resources (commit `3d5c692`)
- 56 entries. Audinate, AES, Avid, Allen & Heath, Yamaha and ENS Louis-Lumière returned 403, so they are not included and are logged.

## Phase 7: QA
- `validate.py`: 0 errors, 20 warnings (no primary source).
- `check_urls.py`: the first run misreported URLs containing spaces as errors (a checker bug, fixed by percent-encoding as browsers do) and treated prose in not_found_logs as URLs (now classed `not-a-url`). Final result: 1,508 ok, 121 blocked, 8 dead, 5 server/connection errors.
- Independent spot-check of 36 devices: 175 fields, 170 match, no contradicted spec. 1 fail (`lawo-ruby` status) was fixed, and 4 minor fixes were applied with `[QA 2026-10-22]` notes. 1 dead `manual_url` (Sennheiser e 906) was repointed.

## Phase 8: delivery
- README, OPEN_QUESTIONS, QUALITY_REPORT written. One row added to the root README (diff checked: +1 line).
- **Push not done.** `git push -u origin research/sound-equipment-database` failed with "could not read Username for 'https://github.com': terminal prompts disabled". The PC has no stored GitHub credentials, and the run deliberately did not open an interactive login. All commits are local on the branch in `C:\Users\brro\dev\Tekonest`. Oscar needs to push once (see the morning summary).

- Process note: the brainstorming skill normally asks for approval before implementation. Oscar asked for an unattended run, so the decisions are recorded in `docs/DESIGN.md` and the open points in `OPEN_QUESTIONS.md`.

---

# Run 2: TEK Brain (Track A, branch `research/tekbrain`)

Master prompt: `knowledge-base/docs/prompts/tekbrain-and-explore-controls.md` (v2). Track B (explore controls) is logged in `tekpractice-sim/docs/NIGHT_LOG.md` on branch `feature/tekpractice-explore-controls`.

## 2026-10-22 09:40 setup
- Oscar pushed `research/sound-equipment-database` (remote at `9d9d021`, two commits ahead with the master prompt). All three checkouts were fast-forwarded to it.
- Worktrees (outside the repo, so no `.gitignore` change): `C:\Users\brro\dev\Tekonest-wt\tekbrain` (Track A) and `C:\Users\brro\dev\Tekonest-wt\explore` (Track B). The main checkout stays on `research/sound-equipment-database`.
- Skills loaded: using-superpowers, using-git-worktrees, brainstorming. **Unavailable** in this install, done by hand following their intent: `product-management:write-spec` (specs written as DESIGN.md / ADR), `pdf-reading` (the `anthropic-skills:pdf` skill or a stdlib extractor is used instead), `frontend-design`, `design:ux-copy`, `design:accessibility-review` (Track B does these checks by hand).
- Baseline in Track B worktree: `npm ci` ok, vitest 164/164 pass.

## A1 design (09:45)
- `tek-brain/DESIGN.md`: data model for concept, skill, procedure, rule (JSON condition DSL), fault, scenario, glossary, room template; layout `tek-brain/<entity>/<domain>.json`; 17 frozen domains in `tek-brain/domains.json` with seed concepts and 32 planned room ids.
- `tools/validate_tekbrain.py` (stdlib): envelopes, required fields, enums, ids, sources, formula→source link, condition DSL, room geometry, cross-references (warnings, errors with `--strict`). Smoke-tested on a good and a bad record (14 expected errors caught).
- `tek-brain/AGENT_BRIEF.md`: rules, search budget (≤ 6 WebSearch per agent), examples for every entity.
- Self-answered design questions logged as OPEN_QUESTIONS #17–22.

## A2 domains (10:00–15:30)
- 17 research agents in parallel, one per domain, following `tek-brain/AGENT_BRIEF.md`. At about 10:00 a network (DNS) outage stopped all 17 before they had written anything. They were resumed with their context and nothing was lost.
- All 17 domains were committed one by one: 414 concepts, 60 skills, 96 procedures, 82 rules (9 mirrors of R1–R8), 101 faults, 41 scenarios, 780 terms. Cross-domain glossary id collisions were fixed by the agents themselves (renamed or dropped).
- Notable sourced findings: the worker peak limit is 140 dB(C), not 137 (137 is the upper action value); EBU Tech 3326 makes G.722 the safe common codec; the d&b vs NEXO speakON pin pairs; Dante clock-leader election; ADAT S/MUX halves the channels at 96 kHz; ARCEP 2015-0830 sets the PMSE limit at 50 mW ERP in 470–694 MHz.
- Mistake: the first acoustics commit used `git add knowledge-base/tek-brain` and swept in another agent's half-written concepts file. It validated, and later commits went domain by domain.

## A3 rooms and 3D (12:30–16:30)
- 5 room agents wrote the 32 planned room templates (`ROOMS_BRIEF.md`). Sources include EBU Tech 3276, ITU-R BS.1116, BBC TC1, Studios de Paris, Studios Ferber, Zéniths, Stageco, French theatres' fiches techniques, Portuguese church acoustics papers, ISO 2603 via AIIC and Microsoft Teams room sizes. All are `needs-oscar-review`, with estimates logged.
- 4 3D agents (`MODELS_BRIEF.md`). There is no Sketchfab token, so Sketchfab is catalogue-only, and the per-model API was rate-limited (429). Results: Sketchfab venues 232, Sketchfab props 326, CC0 libraries 275 + 25 glb, Smithsonian/Objaverse/CAD 99 + 19 glb.
- `tools/merge_3d.py` produced 983 entries with `id`/`kind`; 64 committed glb (26.2 MB) are linked; rooms got `licensed_dressing`.

## A4 resources and curriculum (14:30–17:00)
- 3 agents (French + standards, open courseware + MOOCs, manufacturer academies). `tools/merge_resources.py` produced 315 resources, 260 free, 75 in French, plus `learning-resources-catalogue.md`.
- The 56 run-1 entries were backfilled with `licence` and `concept_ids`.
- Fix: the merge script used to wipe link-check fields on re-run; it now keeps merged entries.
- `tek-brain/curriculum.md`: 24 modules, all 414 concepts placed.

## A5 retrieval index
- `tools/build_index.py` (TDD, 9 tests) builds 1,832 chunks of own-words content with source URLs. `AI_USAGE.md` covers retrieval, `[kb:id]` citations and silence in exam mode. TekPractice's coach cites these chunks (Track B).

## A6 QA
- `check_urls.py` now also covers TEK Brain: 3,161 URLs, 2,788 ok, 276 blocked, 68 "dead". 52 of those were Objaverse URLs with a literal `<shard>` placeholder written by an agent. They were replaced by the object id plus "not found", and the validator now rejects placeholder URLs. 16 links are really dead.
- Independent spot-check of 207 records: 157 pass, 49 minor, 1 fail. All 57 findings were fixed by a separate agent: 15 claims deleted, 6 newly sourced, 163 confidence labels corrected.
- Deep-scan gap hunt found:
  - JSON Schemas promised but missing → `schema/tek-brain.schema.json` and `room.schema.json`, plus `tools/schema_check.py` (151 files, 0 errors)
  - DSL `ref` and wall convention undocumented → added to DESIGN
  - run-1 glb not linked → linked
  - stale coach pack in TekPractice → `npm run sync:kb`
- Final: `validate_tekbrain.py --strict` gives 0 errors, 0 warnings, 0 unresolved references.
- Pushes: credentials became available this run, so `research/tekbrain` is pushed and no bundle was needed.
---

# Morning summary — run 2 (2026-10-22)

## What was built

**Track A, TEK Brain** (`knowledge-base/tek-brain/`, branch `research/tekbrain`)

| Entity | Count (target) |
|---|---|
| Concepts | 414 (≥ 300) |
| Skills | 60 |
| Procedures | 96 (≥ 80) |
| Rules | 82 (≥ 60): 9 mirror R1–R8, 73 proposed, 15 evaluable with today's catalog |
| Faults | 101 (≥ 80) |
| Scenarios | 41 (≥ 40) |
| Glossary FR↔EN | 780 (≥ 600) |
| Parametric room templates | 32 (every planned venue type) |
| Curriculum | 24 modules, all 414 concepts placed |
| Retrieval index | 1,832 own-words chunks with source URLs + `AI_USAGE.md` |
| 3D catalogue | 983 candidates (≥ 400); **64 committed glb** (44 new, CC0/CC-BY, 26.2 MB, ≤ 2.74 MB each) |
| Learning resources | 315 (≥ 200); **260 legally free** (≥ 80); 75 in French |

Quality:
- `validate_tekbrain.py --strict`: 0 errors, 0 unresolved references.
- JSON Schemas checked: 151 files, 0 errors.
- Independent spot-check of 207 records: 157 pass, 49 minor, 1 fail, and all 57 findings were fixed.
- URL check: 3,161 URLs, 16 really dead. 52 placeholder URLs were caught and fixed.

**Track B, TekPractice Explore** (`tekpractice-sim/`, branch `feature/tekpractice-explore-controls`)
- **Explore view (ADR-0010)**:
  - Walking with WASD/ZQSD (physical keys, AZERTY labels), Shift, Q/E, arrow keys and PageUp/PageDown.
  - Mouse only: left-drag looks, right-drag moves, click interacts, wheel zooms the FOV.
  - Automatic pointer lock with a crosshair.
  - Esc chain, collisions (slide along walls, step over cables, door landings), V toggles Explore ⇄ Orbit.
  - ADR-0008 Focus & Patch unchanged.
- **Inventory (Space)**:
  - Catalog grouped by taxonomy, with search and KB sheets (specs, connectors, official manual).
  - Sandbox placement with ghost, 0.25 m grid, R to rotate, click or F to place.
  - Pick up with X or the "Ramasser" button, with undo.
  - No inventory in exams.
- **Help, settings and pause**:
  - Help (H) in French; settings with key remapping (Esc, Tab and Enter fixed); pause menu.
  - Reduced motion, FOV, sensitivity, invert Y.
- **Generated rooms**: `?level=sandbox&room=<id>` builds any of the 32 rooms from the TEK Brain templates (raised stages, FOH spawn).
- **Data pipeline**:
  - The coach cites TEK Brain fiches (`[kb:id]`, validated, silent in exams).
  - 134 catalog proposals and 15 level drafts, in separate files (`catalog.json` untouched).
  - `npm run sync:kb` regenerates them.
- **Docs**: `docs/CONTROLS.md` (FR + EN, diagrams), ADR-0010, a plan, REVIEW-ME §13 (12 items).

## Test results

| Check | Result |
|---|---|
| Unit tests (vitest) | **301 pass** (164 before this run) |
| tsc | clean |
| `validate:catalog` | OK |
| e2e (Playwright) | 54 pass, 16 skipped (opt-in QA crawl), **1 pre-existing flaky**: `focusPatch` "A1 wired…". It double-clicks a small device and fails the same way on the starting commit 9d9d021; it passes 6/6 when run alone. |
| New e2e | 23 explore/rooms tests: WASD walk, mouse-only look and move, Space inventory, place a device, focus and patch a cable, back to Explore, rooms, review fixes. A1 is still winnable (existing spec). |
| QA web crawl | 8 pages × 2 viewports: 0 findings after fixing one real visual bug |
| Frame rate | 24.5 fps on a calm machine, 13–16 fps on a loaded one, in a medium room. This is headless Chromium with software rendering on this PC, so the ≥ 50 fps target on a mid laptop with integrated GPU **is not measured**. |
| Startup bundle | 328.95 → 365.47 kB (+11.1 %), gzip 95.6 → 107.9 kB (+12.8 %); budget +15 %. Rooms, panels, KB sheets and the coach pack load on demand. |

## The 10 most important findings

1. **The worker peak noise limit is 140 dB(C)** (137 is the upper action value); thresholds are 80/85/87 dB(A). Décret 2017-1244 sets 102 dB(A) / 118 dB(C) over 15 min, or 94/104 with children under 6. Both are sourced via INRS, ARS and DGS (Légifrance would not render for scripts).
2. **There is no single dBu ↔ dBFS alignment**: EBU uses 0 dBu = −18 dBFS, while French broadcast practice has 0 dBFS = +22 dBu. This confirms the course error flagged in OPEN_QUESTIONS #10.
3. **Mains hum** is 50 Hz at the fundamental but often heard at 100 Hz (Wikipedia sources disagree), so "hum = 50 Hz" should not be taught as an absolute.
4. **French PMSE (ARCEP decision 2015-0830)**: 470–694 MHz at 50 mW ERP, licence-free but without protection; 694–790 MHz closed since 2019-07-01. Intermodulation formulas and spacing margins are sourced from Shure.
5. **speakON pin pairs differ by manufacturer**: d&b subs use 2±, tops 1±, and NEXO GEO M10 passes 1± through. This is the classic "no sub" fault, now a proposed rule.
6. **EBU Tech 3326**: G.722 is the safe common codec between brands (Opus is optional). Loudness: −23 LUFS, ±1 LU live only, otherwise ±0.2 LU in QC.
7. **"Lock is not sync"** (RME): two clocks left on internal still click. ADAT halves its channels at 96 kHz.
8. **Gain before feedback is mostly geometry** (Shure PAG): ringing out adds only 3–9 dB, and only in-ears break the loop.
9. **Interpretation booth standards changed in 2024**: ISO 2603 and 4043 were replaced by ISO 17651-1/-2.
10. **Agents can invent quietly**: 52 template URLs (`<shard>`) and some unsourced "field practice" sentences were caught only by QA. The validator now rejects placeholder URLs, and a second QA pass on unsampled procedures and faults is recommended.

## What is missing

- **BTS savoir codes** are still unverified: eduscol refuses every connection from this PC.
- **The ≥ 50 fps check** needs a real GPU browser.
- **Pointer lock** (crosshair click, Esc grace) needs a manual test; it can't be automated headless.
- **The flaky `focusPatch` A1 test** is pre-existing and should be stabilised.
- **Sketchfab**: 525 catalogue licences come from the search API (re-check before download); there is no token, so no Sketchfab downloads.
- **Rooms**: about half the templates use estimates (all logged).
- **Equipment gaps**: no DJ gear, AEC conference DSP, IR interpretation system, loop driver or small-diaphragm omni in the equipment KB.
- **Proposed rules**: 67 need catalog fields that don't exist yet.
- **Not this run** (seams ready): touch and gamepad controls.

## Top questions for Oscar

- OPEN_QUESTIONS #23–25: which proposed rules, catalog fields, catalog proposals and level drafts to adopt first.
- REVIEW-ME §13.3: should levels default to Explore?
- REVIEW-ME §13.11: allow KB sheets in the exam?
- OPEN_QUESTIONS #29–31: confirm the regulatory figures on Légifrance; choose the monitor-calibration convention and how to teach null angles.
- OPEN_QUESTIONS #12/#20: send or open the BTS référentiel so the BTS mappings can be verified.

## Branches

The branches are `research/tekbrain` and `feature/tekpractice-explore-controls`. Both were created from `research/sound-equipment-database`, both are **pushed to GitHub**, and neither is merged. The feature branch merges `research/tekbrain` (it needs the room templates and the index). Last commits: see the final line of this summary, and `git log -1` on each branch.

Credentials worked this run, so no push command is needed. To re-push by hand from `C:\Users\brro\dev\Tekonest`:
```
& "$env:LOCALAPPDATA\MinGit\cmd\git.exe" push -u origin research/tekbrain feature/tekpractice-explore-controls
```