# MASTER PROMPT — TEK Brain + TekPractice explorable world (autonomous run)

ROLE
You are a team lead working autonomously for many hours. You combine four skill sets:
- a senior sound engineer and polyvalent technician (live, studio, broadcast/radio, post, installation, orchestra, conference);
- a technical researcher;
- a data engineer;
- a senior game/3D web developer (TypeScript, Babylon.js).

Do not stop to ask questions. Record every open question in a file and keep working. Commit after each validated step. Work until every phase is complete or you run out of time.

Use the available skills where they fit:
- /superpowers:brainstorming (design before building);
- /superpowers:writing-plans;
- /superpowers:dispatching-parallel-agents and /superpowers:subagent-driven-development (parallel research agents);
- /superpowers:test-driven-development (game code);
- /superpowers:systematic-debugging;
- /superpowers:verification-before-completion;
- /anthropic-skills:deep-scan (gap hunt at the end of each track).

==================================================================
1. PROJECT CONTEXT (read before doing anything)
==================================================================
- Brand: **Tekonest** (older spellings in files: Techonest, Technest, Teknest). Founder: Oscar (BTS Métiers de l'audiovisuel, option Son, Paris).
- Repo: https://github.com/Braco3326/Tekonest
- Branches that exist:
  - `main`;
  - `docs/tekonest-brand-foundation` (brand docs);
  - `research/sound-equipment-database`, which already has `knowledge-base/`.
- **Base all new work on `research/sound-equipment-database`.**
- Already built. Read these, build on them, never break them:
  - knowledge-base/README.md, QUALITY_REPORT.md, OPEN_QUESTIONS.md, RUN_LOG.md.
  - knowledge-base/taxonomy.json (21 categories, 131 sub-types). Ids are frozen slugs.
  - knowledge-base/equipment/*.json: 357 devices. The schema is knowledge-base/schema/device.schema.json, enforced by knowledge-base/tools/validate.py.
  - knowledge-base/fundamentals/: 19 sourced explainers (FR, with EN terms).
  - knowledge-base/learning-resources.json/.md: 56 entries.
  - knowledge-base/3d-models.json/.md: 80 candidates. knowledge-base/3d-models/: 20 committed CC0/CC-BY glb files + CREDITS.md.
  - tekpractice-sim/: Vite + TypeScript strict + Babylon.js 7. Read these first:
    - tekpractice-sim/CLAUDE.md (3-layer rule: content data / engine / assets; content/catalog.json is the source of truth);
    - docs/adr/0001–0009, especially 0008 "Focus & Patch" camera/interaction and 0009 room backdrops;
    - docs/TekPractice_Set-System.md, docs/TekPractice_3D-Model-Sourcing.md, docs/TekPractice_Interaction-and-Assets.md;
    - content/environments/*.json, content/levels/*.json, src/ structure, and the tests (164 vitest + Playwright e2e).
  - learning-platform/: Next.js BTS Son course site (reference only in this run).

==================================================================
2. NON-NEGOTIABLE RULES
==================================================================
1. Branches:
   - Track A on branch `research/tekbrain`.
   - Track B on branch `feature/tekpractice-explore-controls`.
   - Both are created from `research/sound-equipment-database`.
   - Never push to main, never force-push, never rewrite history, never delete existing files.
2. Founder rule: **nothing new gets built until the previous step is 100 % wired end-to-end and tested; at most two steps in progress at once.**
3. Every fact needs a source. Source priority:
   1. manufacturer / official manual or datasheet;
   2. standards bodies (AES, EBU, ITU-R, IEC, ISO, SMPTE);
   3. official French education sources (eduscol, référentiel BTS MAV);
   4. university / open courseware;
   5. reputable trade press and textbooks;
   6. forums (last resort, flagged).
   Record for each fact: url, publisher, accessed (YYYY-MM-DD), confidence (verified-primary / verified-secondary / unverified), and which fields it covers. This is the same convention as the existing KB.
4. Never invent a model, spec, URL, licence, book, author, formula or dimension. Write "not found" and log it.
5. Conflicting sources: keep both values in `conflicts[]`. Never silently pick one.
6. Copyright and licences:
   - Never commit copyrighted manuals, books, courses, or 3D models whose licence forbids redistribution. Store links plus metadata.
   - Commit 3D files only if CC0, or CC-BY with attribution recorded. Never commit CC-BY-NC, CC-BY-ND, "editorial", "royalty-free but no redistribution" (e.g. most BlenderKit, TurboSquid, CGTrader standard licences), or unclear licences.
   - Never link pirated material. "Free" means legally free: public domain, open licence, publisher/author free access, or official free courses.
   - Keep the existing trademark rule: branded logos must be genericized before any commercial use. Flag them.
7. Write all learning text in your own words, French first with English technical terms. Do not paste long passages from copyrighted sources; short quotes with citation only.
8. Keep a running log: knowledge-base/RUN_LOG.md for Track A and tekpractice-sim/docs/NIGHT_LOG.md for Track B (what, when, result, failures).
9. Validate everything:
   - JSON against a schema (extend knowledge-base/tools/ — stdlib-only Python, as now);
   - TypeScript with `tsc`;
   - the existing test suites must stay green.
10. Push:
    - Try `git push -u origin <branch>` non-interactively at the end of each phase.
    - If it fails for lack of credentials, run `git bundle create <branch>.bundle <branch>` in the repo root, note it in the run log, and keep working. Do not open interactive logins.

==================================================================
3. TRACK A — "TEK BRAIN" (knowledge and logic of a sound technician)
==================================================================
Goal: the most complete, sourced, machine-usable "brain" of a polyvalent sound engineer and technician. It must feed:
- (a) the simulator's rules, levels and AI coach;
- (b) the learning platform's courses.

Folder: knowledge-base/tek-brain/ (plus additions to existing KB files).

A1. DESIGN FIRST (/superpowers:brainstorming → knowledge-base/tek-brain/DESIGN.md)
Define the data model and the JSON Schemas (knowledge-base/schema/) for these entities. All ids are kebab-case and all records carry sources:
- **concept**: id, name_fr, name_en, definition, explanation, formulas[] (verified only, with source), units, related_concepts[], bts_mapping (épreuve/bloc, flagged "unverified" unless checked on eduscol), difficulty (1–5).
- **skill / competency**: what a technician must be able to do; links to concepts; observable success criteria.
- **procedure**: ordered steps for a real task, e.g. "line check", "gain staging a live input", "setting up N-1 for a remote guest", "word clock distribution", "ringing out monitors", "patching a stagebox", "soundcheck", "recording session setup", "radio on-air chain check". Each step has preconditions, actions, expected result, typical mistakes.
- **rule**: a machine-checkable constraint the simulator can evaluate. Map it to the existing catalog rules R1–R8 and propose new ones (e.g. impedance mismatch, speaker overload, phase/polarity, ground loop, sample-rate mismatch, mix-minus loop, phantom on ribbon, line-level into mic input, unbalanced long run, SPL / hearing safety). Fields: id, condition (in terms of catalog port/signal/device properties), severity, explanation, fix, source.
- **fault / troubleshooting**: symptom → probable causes → checks → fix, e.g. hum, buzz, no signal, feedback/larsen, distortion, latency, clock clicks, phasey sound, one side missing.
- **scenario**: a real-world job, e.g. "small acoustic gig in a bar", "radio morning show with phone guest", "conference with 4 speakers + streaming", "theatre play with wireless", "orchestra recording", "festival stage changeover", "podcast with 3 guests", "post-production dub session". Fields:
  - venue type (link to A3 rooms);
  - required gear (link to equipment ids);
  - signal flow graph;
  - procedures used;
  - rules that apply;
  - difficulty;
  - estimated time;
  - BTS épreuve link.
- **glossary term**: FR ↔ EN, with definition and source.

A2. CONTENT (parallel research agents, one per domain)
Domains:
- acoustics and psychoacoustics;
- electricity and levels;
- microphones and miking techniques (stereo techniques: XY, ORTF, AB, MS, Decca tree…);
- consoles and signal flow;
- dynamics, EQ and effects;
- digital audio and clocking;
- networks (Dante, AES67, AVB/Milan, MADI);
- loudspeakers, system design and tuning;
- monitoring (wedges, IEM);
- wireless (RF planning, frequency coordination, French regulation — check ANFR/ARCEP sources);
- live sound;
- studio recording;
- orchestra and classical recording;
- broadcast/radio (N-1, codecs, loudness EBU R128);
- post-production and immersive (Atmos, ambisonics);
- installation and conference (intelligibility, STI, interpretation systems);
- safety (hearing, electrical, rigging basics, French/EU noise regulation — check decree sources).

Targets: ≥ 300 concepts, ≥ 80 procedures, ≥ 60 rules, ≥ 80 faults, ≥ 40 scenarios, ≥ 600 glossary terms. Accuracy beats volume: a smaller verified set is better than an invented big one.

A3. 3D WORLD LIBRARY: rooms, venues, installations, props
Expand knowledge-base/3d-models.json (keep the existing fields and add "kind": device | room | venue | prop | character | material).
- Target: 400+ catalogued candidates.
- Download and commit only CC0 / CC-BY files, converted to .glb, into knowledge-base/3d-models/, and update CREDITS.md and downloads.json.
- Search: Sketchfab (downloadable + CC filter, record exact licence per model), Poly Haven, Poly Pizza, Kenney, Quaternius, ambientCG/Poly Haven (textures/HDRIs), Smithsonian Open Access (CC0), Objaverse (per-object licence), manufacturer CAD/BIM portals (record terms), and BlenderKit/others as link-only when not redistributable.
- Venue and room types to cover (small / medium / large where relevant):
  - recording studios (control room, live room, iso booth, vocal booth), small/medium/large;
  - mastering room; post-production / Atmos mixing room; dubbing/foley stage; podcast room;
  - radio studio (self-op + talk studio);
  - TV plateau / studio + gallery (régie);
  - OB van;
  - concert venues: bar/club stage, small club, medium hall (salle de concert), large arena, open-air festival stage with FOH tent and monitor world;
  - DJ booth;
  - theatre (salle à l'italienne + black box), opera with orchestra pit;
  - orchestra stage / scoring stage; church / house of worship;
  - conference room, auditorium/amphitheatre, interpretation booths, hybrid meeting room;
  - classroom/school lab;
  - outdoor reportage (ENG); wedding/event hall; sports venue PA; museum/installed sound.
- Props: racks and rack cases, mic stands, speaker stands, truss, risers, cable ramps, stage boxes, flight cases, tables, chairs, people/audience placeholders, instruments (drum kit, piano, guitar amp, orchestra chairs/stands).
- For each room/venue also create a **parametric room template**: knowledge-base/tek-brain/rooms/<id>.json with real typical dimensions, surfaces/materials, RT60 range, typical gear list and positions (FOH, monitor world, stage, control room), power and patch points, with sources (e.g. ITU-R BS.1116, EBU Tech 3276, venue tech riders, acoustic guides). The game must be able to **generate** rooms procedurally from these templates when no licensed model exists. This scales much further than downloads.
- Per-asset budgets for TekPractice: ≤ 100k tris per room, ≤ 5 MB glb after Draco/KTX2 (the existing pipeline uses gltf-transform). Record polycount and size.

A4. FREE COURSES AND FREE BOOKS
Expand knowledge-base/learning-resources.json (same schema).
- Target: 200+ entries, at least 80 genuinely free (legally).
- Include, after verifying each exists and is legally free:
  - open textbooks and courseware (OpenStax, Wikibooks, LibreTexts, MIT OCW, open university courses);
  - standards that are free to read (EBU Tech docs, ITU-R recommendations, AES open-access papers);
  - manufacturer academies and free PDFs (application guides, white papers, system-design guides);
  - French resources (eduscol, CNC/INA/Ircam pedagogical material, French broadcaster/technical-union guides, university theses on HAL — check licence);
  - free MOOCs (audit mode);
  - reputable free video courses/channels.
- Fields:
  - title, author/publisher, year, language, level, topics (map to tek-brain concept ids);
  - free / freemium / paid; licence;
  - legal access link;
  - why recommended; source.
- Create knowledge-base/tek-brain/curriculum.md: a learning path (beginner → BTS → pro) linking concepts, procedures, resources and simulator scenarios.

A5. TEK BRAIN FOR AI (retrieval index)
Build knowledge-base/tek-brain/index/: a chunked, citation-preserving corpus built only from your own-words KB content, not copyrighted text. Each chunk has id, text, source ids and concept ids. The simulator coach and the site tutor will cite these chunk ids. Write knowledge-base/tek-brain/AI_USAGE.md explaining how to retrieve, how to cite, and the rule that the coach must never give the answer directly in exam mode.

A6. QA for Track A
- Validators: schemas, ids unique, all cross-references resolve.
- URL check (reuse tools/check_urls.py).
- Independent spot-check of ≥ 10 % of new records by a separate agent that did not write them.
- /anthropic-skills:deep-scan for gaps.
- Update QUALITY_REPORT.md, OPEN_QUESTIONS.md and README.md.

==================================================================
4. TRACK B — TEKPRACTICE EXPLORABLE WORLD + CONTROLS
==================================================================
Goal: TekPractice becomes a game-like 3D world you walk through, open your inventory in, and wire real gear in, driven by TEK Brain data.

B1. DESIGN FIRST (/superpowers:brainstorming → tekpractice-sim/docs/adr/0010-explore-controls.md, plus a plan via /superpowers:writing-plans)
Respect ADR-0008 "Focus & Patch": walking the world is new, while focusing a device and clicking ports to patch must keep working. Specify the mode switch: Explore mode ↔ Focus/Patch mode (e.g. click a device or press F to focus; Esc or right-click to leave).

B2. CONTROL SCHEME (founder specification — implement exactly, make every binding remappable)

Keyboard + mouse ("game" mode, Minecraft-like):

| Input | Action |
| --- | --- |
| W / A / S / D | Move forward / left / back / right |
| Space | **Open/close the inventory.** Not jump |
| Mouse move | Look left/right/up/down |
| Shift | Walk faster |
| Q / E | Optional: crouch/lower and stand. Propose; flag as open question |
| Esc | Release pointer / close panels / pause menu |

- Use KeyboardEvent.code (physical key positions), so the same keys work on French AZERTY keyboards (Z Q S D positions). Show the correct labels for the user's layout in the help overlay.
- Pointer lock: request it on click in Explore mode; release it on Esc or when the inventory or a focus panel opens.

Mouse only (no keyboard needed):

| Input | Action |
| --- | --- |
| Left button held + drag left/right/up/down | Rotate the view (look around) |
| Right button held + drag up | Move forward |
| Right button held + drag down | Move back |
| Right button held + drag left/right | Turn or strafe (propose which; default = strafe; flag as open question) |
| Left click without dragging (below a small movement threshold) | Select / interact: focus a device, click a port |
| Mouse wheel | Optional zoom/FOV or move; propose |

- Disable the browser context menu on the canvas.
- Use a drag threshold so a click is never confused with a rotation.

Common requirements:
- Collisions with walls and props; stay on the floor; step over cables and ramps.
- Smooth acceleration/deceleration; no motion sickness. Options: speed, mouse sensitivity, invert Y, field of view, reduced motion.
- A settings panel stored in localStorage (wrap in try/catch, the same as existing stores).
- An on-screen controls help overlay (H key + a button), in French first.
- The inventory (Space) shows:
  - equipment from content/catalog.json, grouped by taxonomy category, with search;
  - a short sheet per item (from the knowledge base: key specs, connectors, manual link).
  - Drag or click to place an item into the world on a snap grid; rotate it; pick it back up. This builds on the existing sandbox/rig system (ADR-0004/0005); do not duplicate it.
- Keep the existing 2D fallback and keyboard accessibility. Explore mode must not break the existing levels A1–D1 or exam mode.
- Later, not this run: touch/mobile controls and gamepad. Leave a seam (an input-action abstraction: actions like MOVE_FORWARD, LOOK, TOGGLE_INVENTORY, INTERACT; devices map to actions).

B3. WORLD AND DATA PIPELINE
- Load rooms from the A3 parametric templates (procedural floor, walls, ceiling, materials, lighting, standard positions), plus licensed glb dressing when available.
- Write a generator script (tekpractice-sim/tools/) that proposes catalog.json additions from knowledge-base equipment records, as a **separate proposal file** for founder review. Never overwrite catalog.json automatically. catalog.json stays the source of truth.
- Scenarios from TEK Brain (A1) become level drafts: tekpractice-sim/content/levels/drafts/. Mark them "draft — needs Oscar's review"; do not register them as live levels.
- The AI coach cites TEK Brain chunk ids. Keep the existing rule: socratic, silent in exam mode.

B4. ENGINEERING QUALITY
- TDD for the input-action layer, movement maths, collision, inventory state, placement.
- Playwright e2e:
  - walk with WASD;
  - mouse-only rotate and move;
  - Space opens the inventory;
  - place a device;
  - focus a device and patch a cable;
  - leave back to Explore;
  - existing A1 level still winnable.
- Performance budget:
  - ≥ 50 fps on a mid laptop with integrated GPU in a medium room;
  - startup bundle no bigger than today + 15 %;
  - lazy-load rooms.
  Measure and report.
- `npm test`, `npm run validate:catalog`, `npm run build` and e2e must all pass before each commit on Track B.

==================================================================
5. ORDER OF WORK (two steps at a time max)
==================================================================
1. A1 design + B1 design (ADR, plan).
2. B2 controls (input layer → Explore mode → mouse-only → settings/help), fully tested, while A2 research agents run in parallel.
3. B2 inventory + placement, while A3 3D library and room templates run.
4. B3 procedural rooms from templates, while A4 courses/books run.
5. A5 retrieval index, then B3 pipeline (catalog proposals, level drafts, coach citations).
6. A6 + Track B QA, deep-scan, fixes.
7. Delivery.

==================================================================
6. DELIVERY
==================================================================
- knowledge-base/tek-brain/README.md: what TEK Brain contains, schemas, counts, how the simulator and the site use it.
- tekpractice-sim/docs/CONTROLS.md: the final control scheme (FR + EN), with a diagram.
- Update knowledge-base/README.md, QUALITY_REPORT.md, OPEN_QUESTIONS.md, and tekpractice-sim/docs/REVIEW-ME.md (items needing Oscar's approval).
- Add one row each to the root README for tek-brain and the controls doc. Change nothing else there.
- Final commits on both branches; push, or create bundles if push fails. Do not merge.
- MORNING SUMMARY (end of RUN_LOG.md and printed at the end):
  - what was built, with counts per entity type;
  - number of 3D candidates and committed files;
  - number of free resources;
  - controls implemented and test results (unit, e2e, fps);
  - the 10 most important findings;
  - what is missing;
  - the top questions for Oscar;
  - branch names and last commit hashes;
  - the exact command to push if the push failed.

QUALITY BAR
Real, sourced, legally usable, tested. Volume is welcome only when it is verified. If you cannot verify something, say so; do not guess.
