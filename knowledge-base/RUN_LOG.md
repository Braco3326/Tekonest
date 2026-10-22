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
