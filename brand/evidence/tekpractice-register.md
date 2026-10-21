# Audit: `tekpractice-sim/` (TekPractice 3D audio-equipment simulator) and archive snapshots

Audit date: 2026-10-21. The repo was read only. Tests and build were run on a copy in the scratchpad (see §F).
Repo-relative paths are given from ``. Inside `tekpractice-sim/`, the original-history paths have no prefix.

**Git facts.** `tekpractice-sim/` was imported on 2026-10-21 15:30 +0200 by GitHub user `Braco3326` as a git subtree: commit `d068c9d`, "Import Technest-Sim (TekPractice simulator) with full history", split `35ad095`.
- The original history has **155 commits, 2026-07-11 → 2026-07-19**.
- **All 155 are authored as "Claude Code"**, and messages are prefixed "Claude Code …".
- No commits exist after 2026-07-19. There is a 3-month gap before the import.
- Original repo name per NIGHT_LOG: `Braco3326/Technest-Sim`.

---

## A. Source list

| Path (under `tekpractice-sim/` unless noted) | Date (git first→last; in-doc date) | Description | Author type |
|---|---|---|---|
| `Claude-Code-Kickoff.md` | git 2026-07-11; header "Généré 2026-07-07" | Build plan for the A1 vertical slice (weeks 1-2), 7 gated steps, paste-ready Prompt 1 | Founder brief (AI-drafted in Cowork, issued by founder) |
| `Claude-Code-Prompt-Pack.md` | git 2026-07-11; "Généré 2026-07-07" | Master prompt pack for weeks 1-8 (Prompts 0, 1, A–G), skills map, "Hors P1" AI-audio idea | Founder brief |
| `Prompt-0.5-Catalog-Authoring.md` | 2026-07-11 | Catalog-authoring prompt with invented device names (SB-16, DMX-32…) | Founder brief (superseded) |
| `Prompt-0.5b-Real-Gear-Catalog.md` | 2026-07-11 | "SUPERSEDES Prompt 0.5": real-gear catalog (Yamaha QL1, SM58…) | Founder brief |
| `Prompt-Assets-Overnight.md` | 2026-07-11 | Autonomous overnight Blender MCP asset-generation prompt | Founder brief |
| `CLAUDE.md` | 2026-07-11 → 07-13 | Durable rules: 3 layers, contracts, R1–R8, stack, out-of-scope, "no-drift du vendredi" | AI-generated from founder brief (Prompt 0 text) |
| `equipment-catalog.md` | 2026-07-11 → 07-15 | Human-readable mirror of catalog.json: real gear per level, rules↔levels, assumptions | AI-generated doc |
| `ASSET_LOG.md` | 2026-07-15 → 07-16 | Asset runs 1–3 (Blender MCP failed; CLI headless 50/50; MCP mic re-models) | Log |
| `docs/VISION_TekPractice-StudentJourney.md` | git 2026-07-17 (commit "import Oscar's approved specs") | Six-beat student journey ("Nadia"), creator laws, failure modes, free/subscription line | Vision doc. Commit calls it "Oscar's approved specs"; drafting likely AI-assisted (inference) |
| `docs/TekPractice_Interaction-and-Assets.md` | git 2026-07-17 (same import) | "Focus & Patch" interaction spec, §6 datasheet/photo sourcing; "Council-validated (Tier 3, 84%)" | Spec approved by founder (AI-drafted, inference) |
| `docs/TekPractice_3D-Model-Sourcing.md` | git 2026-07-19; "Research-backed, July 2026" | License guide, sources, tiered hybrid sourcing, "Decisions for Oscar" | AI-generated research/proposal |
| `docs/TekPractice_Set-System.md` | git 2026-07-19 | Real-scale staging, mounts, I/O clarity, in-app Set Editor; "Approved decisions" | Spec (AI-drafted; header claims approved decisions) |
| `docs/design-system.md` | 2026-07-17 → 07-18 | "Teknest Design System — v1": white gallery, tokens, a11y | AI-generated doc |
| `docs/NIGHT_LOG.md` | 2026-07-17 → 07-19 | Logs of autonomous runs; handoff briefings; Vercel/teknest.fr notes | Log (AI) |
| `docs/REVIEW-ME.md` | 2026-07-17 → 07-19 | Items awaiting Oscar's review: coach placeholders, ADR-0002, datasheet flags, sourcing | AI-generated doc |
| `docs/adr/0001…0009` | 0001: 07-13; 0002: 07-15; 0003–0007: 07-17; 0008: 07-18; 0009: 07-19 | Architecture decisions (device state, patchbay, readiness, sandbox, rig load, AI coach, enum controls, Focus & Patch, rooms) | AI-generated docs (0001 "Accepted (Oscar)") |
| `docs/prompts/01…08` | 2026-07-17 → 07-18 | Paste-ready follow-up prompts written by the agent for later sessions | AI-generated prompts |
| `.claude/agents/designer.md`, `developer.md` | 2026-07-17 | Sub-agent definitions ("Teknest design authority", "Teknest engineering authority") | AI-generated config |
| `package.json` | — | `"name": "audio-sim"`, v0.1.0, private; deps Babylon 7, zod, @anthropic-ai/sdk | Code/config |
| `vercel.json`, `.github/workflows/ci.yml` | 2026-07-15 | Vite build to `dist`; CI: validate, vitest, build, Playwright | Config |
| `.env.example` | 2026-07-17 | Names only: `VITE_AI_COACH_KEY`, `VITE_AI_COACH_PROVIDER`, `VITE_AI_COACH_MODEL` | Config |
| `content/catalog.json`, `levels/*.json`, `environments/*.json`, `coach/tips.json`, `readiness.json`, `onboarding.json` | 2026-07-11 → 07-19 | Pure data layer (source of truth) | Code/data (AI-authored, founder-approved catalog per Prompt 0.5b gate) |
| `src/**`, `tests/**`, `tools/**` | 2026-07-13 → 07-19 | Engine, scene, UI, AI coach, tests, Blender/sourcing tooling | Code |
| `public/assets/ASSET_MANIFEST.json` + 50 device/connector `.glb` + 3 room `.glb` | 2026-07-15 → 07-19 | 3D assets, licence metadata | Code/assets |
| `archive/teknest/` (repo root) | Original commit `d7ac143` 2026-07-15 21:54 UTC; imported 2026-10-21 | Snapshot of the simulator (see §D) | Code snapshot |
| `archive/teknest-simu/` (repo root) | Original commit `53c37df` 2026-07-15 19:21 UTC; imported 2026-10-21 | Earlier snapshot (see §D) | Code snapshot |

Referenced but **absent** from the folder:
- `VISION_TekPractice-Game.md` (designer agent puts it at `D:\teknest\docs\`)
- `blender-pipeline.md`, `docs/db_*.csv` (BTS référentiel)
- `assets-source/` (gitignored), including `SOURCING-QUEUE.md` and `CREDITS.md`
- the "design spec" the kickoff calls approved
- the Python catalog validator

---

## B. Evidence register

| ID | Claim | Source (+section) | Date | Type |
|---|---|---|---|---|
| TP-01 | Product = "simulateur 3D navigateur d'ingénierie audio pro (4 domaines : Live Sound, Radio/Broadcast, Duplex/Remote N-1, Post-Production)" | `Claude-Code-Prompt-Pack.md` Prompt 0 | 2026-07-07 (gen.) / 07-11 (git) | Founder brief |
| TP-02 | Originally framed as "**Outil d'apprentissage perso** — pas d'auth, pas de paiement, pas de gate DSGVO" | `Claude-Code-Prompt-Pack.md` Prompt 0 | 2026-07-07 | Founder brief |
| TP-03 | Personal success criterion: "je dois pouvoir câbler un studio radio self-op et un N-1 correct sans notes" | `Claude-Code-Prompt-Pack.md` Prompt F | 2026-07-07 | Founder brief |
| TP-04 | Real gear allowed because "This is a personal learning tool, so real brand/model names are allowed as reference data"; Oscar must approve content before engine code | `Prompt-0.5b-Real-Gear-Catalog.md` | 2026-07-11 | Founder brief/decision |
| TP-05 | Target audience shifts to BTS students: persona "Nadia. 19, first year BTS Métiers du son in Paris… Terrified of the physics (E3/PTES) and of the practical exam (E4)" | `docs/VISION_TekPractice-StudentJourney.md` intro | 2026-07-17 (git) | Proposal (vision; commit says founder-approved) |
| TP-06 | Problem: "She's tried YouTube and PDFs; nothing stuck"; aim to turn "revision into making, anxiety into a readiness plan, lonely grind into a mentored journey" | VISION intro + "Bottom line" | 2026-07-17 | Proposal |
| TP-07 | Six-beat journey: Day-0 onboarding with 90-s first win and no signup wall; daily loop of "one next action"; mastery-gated sandbox; motivation dip with streak forgiveness; exam simulation; post-exam community | VISION Beats 1–6 | 2026-07-17 | Proposal |
| TP-08 | Mentor voice: "Conseil d'Oscar" context-triggered tips. Oscar's "I nearly quit too" is called "the single most powerful retention asset" | VISION Beats 2, 4; law 6 | 2026-07-17 | Proposal |
| TP-09 | Test mode "mapped to E3/E4/E51 and BC01–BC04"; "Readiness, never vanity" (no XP) | VISION Beat 5, law 7 | 2026-07-17 | Proposal |
| TP-10 | **Monetisation (only mention):** "free = one room + a few levels; subscription = full sandbox + tests + analytics" | VISION "Honest failure modes" | 2026-07-17 | Proposal |
| TP-11 | Community/marketing loop: graduates "become community + mentor content"; "a graduate who credits you becomes your most credible marketing" | VISION Beat 6 | 2026-07-17 | Proposal |
| TP-12 | Content QA role: "Content correctness drifts → fix: *you*, the graduate, are the review gate; nothing ships unverified" | VISION failure modes | 2026-07-17 | Proposal (assigns role to founder) |
| TP-13 | Naming: repo/package "audio-sim" (CLAUDE.md title, `package.json` name, localStorage keys `audio-sim/*`); catalog meta "audio-sim catalog" | `CLAUDE.md` l.1; `package.json`; `content/catalog.json` meta | 2026-07-11 → | Implementation fact |
| TP-14 | Naming: product "TekPractice" (page `<title>TekPractice</title>` since commit b88c553; AI prompt "coach IA de TekPractice"). Brand "Teknest" (design system "Teknest Design System — v1"; agents "Teknest design/engineering authority"). Original GitHub repo "Technest-Sim". Earlier snapshots titled "Audio Sim" | `index.html`; `src/ai/prompt.ts`; `docs/design-system.md`; `.claude/agents/*`; NIGHT_LOG l.93; `archive/*/index.html` | 2026-07-15 → 07-17 | Implementation fact |
| TP-15 | Domain `www.teknest.fr` existed and served the sim: it "répond MAIS sert un bundle vieux de 2 jours (pre-dashboard, titre "Audio Sim")"; Vercel project not rebuilding on push; "teknest-simu.vercel.app est mort en 404". Fix needs the founder ("autre compte Vercel") | `docs/NIGHT_LOG.md` "URGENT" l.90-95 | 2026-07-17 | Research finding (agent observation) |
| TP-16 | Later in the day the same problem was still open: "www.teknest.fr sert toujours un bundle d'avant-hier… ~25 commits attendent en ligne" | NIGHT_LOG "RESTE EN HAUT DE LA PILE" l.183 | 2026-07-17 | Research finding |
| TP-17 | Earlier deploy gate: "prod URL smoke proof (teknest-simu.vercel.app - A1 winnable, no page errors)" | git commit `9c5d5a1` message | 2026-07-15 | Implementation fact (claimed in commit; not re-verified) |
| TP-18 | Weekly rule: "Le build de la semaine doit être jouable sur l'URL Vercel chaque vendredi" | `CLAUDE.md` "Règle no-drift du vendredi" | 2026-07-11 | Founder brief |
| TP-19 | Stack: TypeScript strict, Babylon.js 7, Vite 5, zod, vitest, Playwright, gltf-transform (Draco + KTX2), GitHub Actions, Vercel; no backend or accounts | `CLAUDE.md` Stack; `package.json`; `vercel.json` | 2026-07-11 → 07-15 | Implementation fact |
| TP-20 | Out of scope: "DSP audio réel, multiplayer, VR, comptes/backend, builds mobile natifs" — the sim does not process real audio | `CLAUDE.md` Out of scope | 2026-07-11 | Founder brief |
| TP-21 | Architecture: 3 layers (Content data / Engine / Assets); "Nouveau matériel/leçon = édition data uniquement" | `CLAUDE.md` Architecture | 2026-07-11 | Founder brief |
| TP-22 | The "data-only levels" promise is **not met**: the level list is hard-coded in `src/main.ts`, `src/ui/hud.ts`, `tools/validate-catalog.ts`; proposed fix in `docs/prompts/06` (not executed) | `docs/REVIEW-ME.md` §6 blocage 1; prompts/06 | 2026-07-17 | Implementation fact (agent-reported) |
| TP-23 | Catalog: 26 connector types, 16 signal types, 24 real devices (Yamaha QL1, Rio3224-D2, Shure SM58/SM57, QSC K12.2, Yamaha DBR12, Axia iQ, EV RE20/RE50B, Genelec 8030C, AETA Scoop5 S / Scoopy+ S, Avid HDX/HD I/O, Focusrite ISA One, Grace m905, Neumann U 87 Ai, Switchcraft 9625, Antelope OCX HD, Mogami loom, Yellowtec m!ka/litt, K&M 210/9, playout PC); 8 rules R1–R8 | `content/catalog.json` (counted); `equipment-catalog.md` | 2026-07-11 → | Implementation fact |
| TP-24 | Rules: R1 connector, R2 signal, R3 direction (engine invariants); R4 phantom, R5 ON-AIR tally, R6 monitor mute, R7 mix-minus N-1 echo, R8 word clock and sample rate (logic modules) | `content/catalog.json` rules; `CLAUDE.md` | 2026-07-11 → 07-17 | Implementation fact |
| TP-25 | Levels present: a1 "First PA" (plateau, 240 s), b1 "Radio studio" (radio, R5/R6, 300 s), c1 "Remote duplex: reporter on N-1" (radio, R7, 300 s), d1 "Post room… house clock" (studio, R4/R8, 420 s). The validator reports all 4 chains solvable | `content/levels/*.json`; validator output | 2026-07-11 → 07-17; verified 2026-10-21 | Implementation fact (verified by running) |
| TP-26 | Rooms: 7 environment presets (blanc, plateau, plein-air, radio, reportage, studio, theatre). Only 3 use real 3D room models (live-stage, radio-booth, theatre-stage); "Studio (D1) reste blanc" for lack of a CC model | `content/environments/*.json`; ADR-0009; REVIEW-ME §12 | 2026-07-17 → 07-19 | Implementation fact |
| TP-27 | Readiness model: score per rule = ratio × coverage; radar BC01–BC04 (BC01/BC04 greyed "inGame:false"); epreuves E3/E4/E51; mapping "JUGEMENT PEDAGOGIQUE DE LA NUIT - a relire par Oscar" | ADR-0003; `content/readiness.json` | 2026-07-17 | Implementation fact (mapping = AI estimate pending review) |
| TP-28 | `readiness.json` sets coefficient 4 for each of E3 "Physique et technique (PTES)", E4, E51. Source csv not in repo; values not verified against the official référentiel | `content/readiness.json` | 2026-07-17 | Estimate (unverified) |
| TP-29 | Exam mode: timer, no hints, score /20 = 60% wiring + 40% domain checks − 0.5 pt/error; "a relire" | NIGHT_LOG Tâche 3; `src/ui/exam.ts` | 2026-07-17 | Implementation fact + proposal (scale) |
| TP-30 | Onboarding: exam date + 2 questions, "AUCUN mur d'inscription, jamais", redirect to recommended level | `content/onboarding.json`; NIGHT_LOG run 2 Tâche 2 | 2026-07-17 | Implementation fact |
| TP-31 | Coach tips: 13 tips in `content/coach/tips.json`, **all 13 still "[À REMPLACER PAR OSCAR]" placeholders** | `content/coach/tips.json` (counted); REVIEW-ME §1 | 2026-07-17 (unchanged since) | Implementation fact |
| TP-32 | AI coach: "Pourquoi ?" button on error toasts. Provider Anthropic via `@anthropic-ai/sdk` in browser (`dangerouslyAllowBrowser`), default model `claude-opus-4-8`. Strict grounding: reply must cite `[Rn]`/`[catalog:id]` or it is rejected. Socratic ("ne nomme jamais le port exact"). Silent in exam | ADR-0006; `src/ai/anthropic.ts` l.10; `src/ai/prompt.ts` | 2026-07-17 | Implementation fact (code present) |
| TP-33 | The AI coach is **inactive without a user-supplied key**. The key is the user's own in `.env` (`VITE_AI_COACH_KEY`). Only provider `anthropic` is implemented; Gemini/Ollama are proposed in prompts/05. ADR rejects a backend proxy as YAGNI | `src/ai/index.ts` l.44-50; ADR-0006 D2; REVIEW-ME §5 | 2026-07-17 | Implementation fact |
| TP-34 | AI provider rationale: local models (Ollama/MLX) are "rédhibitoire pour le public cible"; cloud is chosen for "un étudiant BTS sur son laptop" | ADR-0006 D1 | 2026-07-17 | Proposal/decision (AI, Accepted) |
| TP-35 | Sandbox: free graph, catalog shelves, mastery gate at 15% readiness (guided 3-item palette otherwise), cap of 24 devices, named rigs saved and reloaded in localStorage; "rig propre" credits R1–R3 only | ADR-0004, ADR-0005; NIGHT_LOG | 2026-07-17 | Implementation fact |
| TP-36 | Interaction "Focus & Patch" (double-click focus, click ports) **replaced drag-to-connect**: "autorisation d'Oscar de faire LE gros build et de REMPLACER le drag" | ADR-0008; NIGHT_LOG 2026-07-18 | 2026-07-18 | Founder decision (reported by agent) + implementation fact |
| TP-37 | Core pedagogical principle: "finding the right port on a real panel IS the exam skill (E4)… Some friction is pedagogy" | `docs/TekPractice_Interaction-and-Assets.md` §0 | 2026-07-17 | Proposal (approved spec) |
| TP-38 | 2D WebGL-free fallback board for weak PCs (levels a1–d1 only; sandbox 3D-only) | NIGHT_LOG durcissement; `src/render/Render2D.ts` | 2026-07-17 | Implementation fact |
| TP-39 | Not built: patchbay normalling. ADR-0002 is "Proposed… requires Oscar's OK", never accepted | ADR-0002; REVIEW-ME §4; NIGHT_LOG | 2026-07-15 → 07-18 | Implementation fact (absence) |
| TP-40 | Not built: "Mode Learn (micro-lecons Tekskol) : pas commence - le prochain gros morceau P1 de la vision" | NIGHT_LOG l.186 | 2026-07-17 | Status statement |
| TP-41 | Not built: In-app Set Editor (`?edit=1`), real dimensions in catalog, mounts.json. Spec only | `docs/TekPractice_Set-System.md`; no `content/mounts.json` | 2026-07-19 | Proposal |
| TP-42 | Assets: manifest lists 50 items. 18 are "download-ccby" (Creative Commons Attribution, `trademark: branded-internal`) and 5 are "modeled"/"internal (own work)"; 27 entries have no licence fields (procedural CLI generation, per ASSET_LOG). Plus 3 CC-BY room models | `public/assets/ASSET_MANIFEST.json` (counted) | 2026-07-15 → 07-19 | Implementation fact |
| TP-43 | Licensing policy: "Now (personal/learning): fine. Commercial launch: genericize… or get clearance"; never ship CC-BY-NC/GrabCAD; "ZERO CC0 pertinent" found, so everything is CC-BY with attribution | `docs/TekPractice_3D-Model-Sourcing.md`; NIGHT_LOG sourcing; REVIEW-ME §11 | 2026-07-18/19 | Research finding + proposal |
| TP-44 | Trademark contradiction risk: CLAUDE.md says "Équivalents visuels génériques uniquement", but 18 shipped glb are `branded-internal` (logo textures); "debranding = passe commerciale" | `CLAUDE.md` Trademark; NIGHT_LOG sourcing | 2026-07-11 vs 07-19 | Risk (inference from sources) |
| TP-45 | Manufacturer datasheets and photos are kept in a gitignored `assets-source/` "never published", at `D:\teknest\tekpractice\assets-source\` | Interaction-and-Assets §6 | 2026-07-17 | Founder brief/proposal |
| TP-46 | ASSET_LOG claimed port empties exist; later diagnosis: "AUCUN des 50 glb… ne contient les empties port_*". Fixed for 22/24 devices by the rig pass of 2026-07-18/19 | REVIEW-ME §10; NIGHT_LOG sourcing (a) | 2026-07-18/19 | Implementation fact (agent-reported) |
| TP-47 | Datasheet fidelity flag pending founder OK: QL1 `dante-primary` is `rj45` in catalog but "réel = ethercon". A commit `49a9213` "fix: QL1 Dante etherCON" appears on 2026-07-17 (current catalog value not re-checked) | REVIEW-ME §8.1; git log | 2026-07-17 | Open question / implementation |
| TP-48 | Catalog is "teaching-simplified" ("2 of the Rio's 32 mic-ins"); depth of b1/d1 is capped by this | `equipment-catalog.md` Assumptions; REVIEW-ME §6, §8.2 | 2026-07-15/17 | Implementation fact |
| TP-49 | Tests: 19 vitest files / **164 unit tests passed**; catalog validator green; `tsc && vite build` succeeded (Babylon chunk 5.36 MB, 1.18 MB gzip) | Run on scratch copy 2026-10-21 | 2026-10-21 | Implementation fact (verified by running) |
| TP-50 | e2e: 9 Playwright spec files, 30 `test(` calls. Last log claims "164 vitest + 32 e2e… verts" (count differs; see §E) | `tests/e2e/*`; NIGHT_LOG | 2026-07-18/19 | Implementation fact (e2e NOT run) |
| TP-51 | Dev environment: briefs target "Mac Studio (repo `audio-sim`)"; actual runs were on a "PC Windows" with Blender 5.1. Paths live in `D:\teknest` ("C:\... interdit") | Kickoff header; ASSET_LOG Run 1; `.claude/agents/developer.md` | 2026-07-07 → 07-17 | Implementation fact / founder brief |
| TP-52 | Work mode: autonomous overnight AI runs while "Oscar dort"; the founder is the review gate (REVIEW-ME); he supplies keys and logins (Sketchfab key "fournie par Oscar") | NIGHT_LOG title; REVIEW-ME; NIGHT_LOG sourcing | 2026-07-17 → 07-19 | Implementation fact (operations) |
| TP-53 | Fallback planning: "SI FABLE DISPARAIT CE WEEK-END" — prompts "calibré pour un modèle plus faible" | NIGHT_LOG l.97-102 | 2026-07-17 | Founder-operations note (meaning of "Fable" unclear) |
| TP-54 | People and roles named: Oscar (approver, mentor voice, content reviewer, Vercel and account owner). "Ali" appears once: "préviens Ali que ce catalog est la v1 canonique à réconcilier avec son éventuelle v0.2" (another person is named here; see open question on ownership) second-person reference, role unexplained | `Prompt-0.5-Catalog-Authoring.md` "Après validation"; passim | 2026-07-11 | Founder brief (as written) |
| TP-55 | Status at last commit (2026-07-19): 4 levels, sandbox, dashboard, exam, onboarding, coach (placeholders), AI coach, 2D fallback, Focus & Patch, 18 CC-BY models and 3 rooms are present. Open items: Vercel reconnection, coach texts, ADR-0002, prompts 06/07/08, studio room, Set Editor | NIGHT_LOG end; REVIEW-ME §§1-12 | 2026-07-19 | Status statement (AI logs) |
| TP-56 | No document in this folder says the simulator is "paused" or abandoned. The only "pause" is about Blender runs. The founder states (per the task brief, 2026-10) that it is a current service vision in the website-creation phase | grep of folder; task brief | 2026-10-21 | Founder statement (external to folder) |
| TP-57 | Future idea: "Feedback IA audio (analyser une prise/mix uploadé → critique explicable) — c'est le white space identifié dans le landscape concurrentiel" | `Claude-Code-Prompt-Pack.md` "Hors P1" | 2026-07-07 | Proposal (mentions an unseen competitive analysis) |
| TP-58 | Performance risks and mitigations: device cap 24, pulse cap 12, catenary budget, 2D fallback; Babylon bundle > 5 MB | NIGHT_LOG; build output | 2026-07-17 / 10-21 | Implementation fact / risk |
| TP-59 | Privacy/data: all progress lives in browser localStorage (versioned ProgressStore v2 with migration); no accounts or backend | ADR-0003 §4; `CLAUDE.md` | 2026-07-17 | Implementation fact |
| TP-60 | AI coach cost/key risk: the per-user key sits in the browser bundle env; "claude-haiku-4-5 = ~5x moins cher si le volume devient un sujet" | REVIEW-ME §5; ADR-0006 | 2026-07-17 | Estimate/risk |

---

## C. Links to other Tekonest services

- **Shared design system with a website.** The designer agent: "UN seul design system, partagé **site+jeu**"; the developer agent "Drills **both codebases**" and cites "les CLAUDE.md des repos" (`.claude/agents/designer.md`, `developer.md`, 2026-07-17). Inference: a separate website repo existed or was planned in July 2026.
- **Learning platform naming.** NIGHT_LOG l.186 (2026-07-17): "Mode Learn (micro-lecons **Tekskol**)". "Tekskol" is a sub-brand for micro-lessons that is not otherwise defined here.
- **Domain.** `www.teknest.fr` served the simulator via Vercel (NIGHT_LOG, 2026-07-17). The domain was used for the sim, not for a separate site, at that date.
- **Vision companion.** `VISION_TekPractice-Game.md` and `D:\teknest\docs\VISION_*.md` are referenced (`D:\teknest` = umbrella workspace; `D:\teknest\tekpractice` = this repo). Not available.
- **Community and mentoring.** VISION Beat 6 mentions graduates becoming "community + mentor content" and sharing rigs. This is a community/network idea, but only inside the product.
- **Not mentioned at all:** events, equipment rental, production services, technician network, Rebels.

## D. Archive snapshots

| Snapshot | Original commit | Content equals Technest-Sim commit | Difference |
|---|---|---|---|
| `archive/teknest-simu/` (repo `teknest-simu`) | `53c37df` "Initial commit", 2026-07-15 19:21 UTC | `9a89974` (2026-07-15 19:34 +0200, "step 7: Playwright smoke suite, GitHub Actions CI, Vercel config…") | Identical tree except `.github/workflows/ci.yml` is missing (1 file, 42 lines) |
| `archive/teknest/` (repo `teknest`) | `d7ac143` "Initial commit", 2026-07-15 21:54 UTC | `4987a0c` (2026-07-15 21:50 +0200, "ui: data-driven ControlsPanel…, B1/C1/D1 layouts; ADR-0002") | Identical tree except `.github/workflows/ci.yml` is missing |

What this shows:
- Both are **one-commit copies of the same codebase at two points on 2026-07-15**. They are not forks with their own changes.
- Each was pushed as a fresh "Initial commit" roughly 0–2 h after the matching Technest-Sim commit.
- Both have the title "Audio Sim", drag-to-connect (`src/scene/Interaction.ts`), and no dashboard, readiness, exam, sandbox, AI coach, design tokens, environments, or VISION/TekPractice docs.
- `teknest` adds ControlsPanel, gpio/mixMinus/clock logic and tests, and ADR-0002 over `teknest-simu`.

Probable purpose (inference): separate repos linked to Vercel projects. NIGHT_LOG says `teknest-simu.vercel.app` was the earlier prod URL and teknest.fr was another Vercel project. The missing CI file is consistent with pushing without workflow scope. Neither is later than Technest-Sim.

## E. Conflicts and contradictions

1. **Purpose.** On 2026-07-07/11 it is a "personal learning tool… pas de paiement" (Prompt Pack, catalog meta). On 2026-07-17 the VISION targets BTS students and proposes a subscription tier, while the sourcing docs (07-18/19) talk of a "commercial launch". The catalog meta still says "personal learning tool".
2. **Trademark.** CLAUDE.md (07-11) says generic visuals only. On 07-19, 18 shipped glb are "branded-internal" with logo textures.
3. **Data-only levels.** CLAUDE.md promises "nouveau niveau = data". REVIEW-ME §6 (07-17) shows level ids are hard-coded in 3 places.
4. **Port empties.** ASSET_LOG (07-15/16) claims empties exist. REVIEW-ME §10 (07-18) says none of the 50 glb had them.
5. **Test counts.** Logs claim "164 vitest + 32 e2e" (07-18/19). Running gives 164 unit tests, but the e2e specs contain 30 `test(` calls (parametrised tests could explain 32; not run).
6. **ADR numbering.** prompts/02 asked for "0006-enum-controls"; it became ADR-0007 because 0006 = AI coach (noted in ADR-0007). prompts/02 is marked obsolete in NIGHT_LOG but still present.
7. **Device names.** Prompt 0.5 and Prompt-Assets-Overnight use invented ids (sb-16, dmx-32…). Prompt 0.5b (same day) supersedes them with real-gear slugs, which the code uses.
8. **Dev machine.** The kickoff says execution is on the "Mac Studio"; ASSET_LOG Run 1 runs on a "PC Windows" where the Blender MCP was unavailable.
9. **Coefficients.** `readiness.json` gives E3/E4/E51 coefficient 4 each, from an absent csv. Not verified; may conflict with official BTS coefficients.
10. **teknest.fr.** It served a stale "Audio Sim" bundle on 07-17. No later log confirms it was fixed.

## F. Not inspected or not verified

- **Not run:** Playwright e2e (no browser installed; not attempted), `npm run lint`, 3D rendering, gameplay, and the AI coach (needs a key; no `.env` present, none created).
- **Run on the copy only:** `npm ci --ignore-scripts` (≈9 s), `validate:catalog` (green), `vitest run` (164/164 pass), `npm run build` (success).
- **Live checks not done:** teknest.fr, teknest-simu.vercel.app, the Vercel projects, and the GitHub repos `Technest-Sim`, `teknest`, `teknest-simu`.
- **Absent files:** `VISION_TekPractice-Game.md`, `blender-pipeline.md`, `docs/db_*.csv`, `assets-source/` (SOURCING-QUEUE, CREDITS.md), the "design spec", and the Python validator.
- **Skimmed, not read line by line:** src/ files beyond `src/ai/*`, `catalog.json` port details, all level JSON fields, and glb contents and thumbnails.
- **No visual check** of the 3D models for licence or attribution correctness beyond the manifest fields.
- **Not confirmed in the current catalog:** whether REVIEW-ME §8.1 (QL1 etherCON) was resolved by commit `49a9213`.
- **Unclear terms:** "Fable" (NIGHT_LOG), "Tekskol", the "council-validated (Tier 3, 84%)" method, and who "Ali" is in Prompt 0.5.

## G. Plain-language summary

1. TekPractice is a browser-based 3D simulator where you wire real pro-audio gear (mics, consoles, stageboxes, codecs) and the app tells you, rule by rule, what you got wrong.
2. It began on 2026-07-07/11 as Oscar's personal revision tool ("audio-sim") for his BTS Métiers du son.
3. By 2026-07-17 the vision targeted all BTS sound students, with a calm mentor-led journey and an exam-readiness score.
4. 155 commits, all written by Claude Code over 9 days (2026-07-11 → 07-19), built 4 graded levels (live, radio, remote duplex, post), plus a sandbox, dashboard, exam mode, onboarding, a 2D fallback and 7 rooms.
5. An optional AI "Pourquoi ?" coach (Anthropic, user's own key) is coded but off by default. All 13 "Conseils d'Oscar" texts are still placeholders.
6. Today the code builds, and its 164 unit tests and catalog check pass. Browser e2e tests were not run.
7. It was deployed on Vercel at www.teknest.fr, but on 2026-07-17 the site served a stale build. Nothing confirms a fix.
8. The 3D models are mostly CC-BY downloads that still carry brand logos. That is fine for personal use, but they must be de-branded before any commercial launch.
9. The only business idea in the folder is a free tier (one room, a few levels) versus a subscription (full sandbox, tests, analytics). Nothing here mentions events, rental or other services; it only notes a design system shared with a website and a "Tekskol" micro-lesson mode.
10. The two archive folders are earlier same-day copies (2026-07-15) of this same code, not separate products. No document here calls the project paused.
