# Audit — founder's old local folder `Thechnest` (copied into `archive/thechnest-local-2026-07/`)

Audit date: 2026-10-21. Read-only audit; no source file was changed. Dates are the last-modified dates on the founder's PC, as given in the brief. Where a doc gives its own date in the text, that date is shown too. Spellings are kept as each document wrote them (Tech Nest, TECH NEST, Teknest, TEKNEST, Tekskol, TekPractice, Technest).

Method: I read every .md and .csv file in full. I converted each PDF to text with `pdftotext -layout` and compared its vocabulary with the .md file of the same name. I ran `diff` against the repo copies in tekpractice-sim/docs/ and learning-platform/docs/. I also spot-checked repo files (README.md, NIGHT_LOG.md, ADR-0006, ADR 0002) to find conflicts.

---

## A. Source list

| # | File | Date (PC) | One-line description | Author type | Duplicate of |
|---|---|---|---|---|---|
| 1 | MASTER-PLAN.md | 2026-07-11 (text says "Written Fri 10 July 2026") | "TECH NEST / AUDIO SIM — Master Plan & Fable 5 Sprint": simulator as flagship, build inventory, plan for a weekend sprint (Fri 10 to Sun 12 July) with Missions 1–6 prompts | AI-generated plan written for the founder (some founder decisions recorded, marked "yours") | none in repo |
| 2 | STATUS.md | 2026-07-15 (text: "Last updated: 15 July 2026") | "TECH NEST — Project Status & Map": vision, window/folder map, done / in progress / not started, decisions, problems, founder to-do | AI-generated status report | none |
| 3 | TechNest_BTS-Son_Knowledge-Base.md | 2026-07-07 | BTS MAV option Son facts: identity card, exam rules, timetable, RNCP blocs, annales links, sources, feature ideas | research (AI-compiled from official sources, "Verified July 2026") | data overlaps db_*.csv |
| 4 | TechNest_Competitive-Landscape.md | 2026-07-07 | About 70 platforms in 4 clusters, 3 white spaces, best practices to reuse, business levers, Phase 3 research proposals | research (AI-compiled) | db_competitors_matrix.csv is a subset |
| 5 | db_annales_index.csv | 2026-07-07 | 18 rows of annales and resource links (E3 PTES 2017–2025, CAA, hubs) | data | same as KB §5–6 |
| 6 | db_blocs_competences.csv | 2026-07-07 | 4 RNCP37196 blocs | data | KB §4 |
| 7 | db_competitors_matrix.csv | 2026-07-07 | 41-row competitor matrix (cluster, type, AI, business model, best point, weakness, URL) | data | Competitive-Landscape |
| 8 | db_epreuves_coefficients.csv | 2026-07-07 | Épreuves E1–E6 + EF1, coefficients, total 17 | data | KB §2 |
| 9 | db_grille_horaire.csv | 2026-07-07 | Weekly hours per subject, total 31 h/week, 930 h/year | data | KB §3 |
| 10 | idea-sphere/Fable5-Prompt-IdeaSphere.md | 2026-07-10 | Build prompt for `idea-sphere.html`, a 3D project-tracker "idea sphere" pre-filled with Tech Nest + Audio Sim nodes | AI-written prompt for the founder (tool spec) | none |
| 11 | VISION_TekPractice-Game.md | 2026-07-16 | "TekPractice — The Educative Game (Vision & Structure)": 4 modes, environments, screen flow, stats, white art direction, pros/cons, phases | AI-generated vision ("Council-validated (Tier 3, 82%)") built on founder intent | not in repo docs |
| 12 | TekPractice-Vision.pdf | 2026-07-16 | 5-page WeasyPrint PDF | render | vocabulary identical to #11, so a render of VISION_TekPractice-Game.md (no extra content) |
| 13 | VISION_TekPractice-StudentJourney.md | 2026-07-16 | 6 "beats" of the student persona Nadia, 9 creator laws, failure modes | AI-generated vision | identical (`diff` shows nothing) to tekpractice-sim/docs/VISION_TekPractice-StudentJourney.md |
| 14 | TEKNEST-MASTER-BUILD.md | 2026-07-17 | "TEKNEST — Master Build Plan (TekPractice first)": move to D:\teknest, designer/developer agents, phases 0–6, Prompts 1–7 | AI-generated plan; "Decisions locked" record founder decisions | none |
| 15 | TEKNEST-Master-Build-Plan.pdf | 2026-07-17 | 7-page WeasyPrint PDF | render | render of #14 (only difference: the token "portId" is split by a line break) |
| 16 | TekPractice_Interaction-and-Assets.md | 2026-07-17 | "Focus & Patch" interaction spec + datasheet/photo asset pipeline ("Council-validated (Tier 3, 84%)") | AI-generated design spec | identical to tekpractice-sim/docs/ copy |
| 17 | TEKNEST-FINAL-REPORT.md | 2026-07-19 (text: "Updated 2026-07-18") | "TEKNEST — Final Report & Prompt Pack": two products, done/left, student-beat status, founder manual actions, prompts A–G | AI-generated report | none |
| 18 | TEKNEST-Final-Report.pdf | 2026-07-19 | 4-page WeasyPrint PDF | render | render of #17, no extra content |
| 19 | TekPractice_3D-Model-Sourcing.md | 2026-07-19 | 3D model sourcing strategy (CC0/CC-BY/AI image-to-3D), licence and trademark layers, rig pass | AI research and spec | identical to tekpractice-sim/docs/ copy |
| 20 | TekPractice_Set-System.md | 2026-07-19 | "Real Set" system: real dimensions, staging/mounts, I/O clarity, in-app Set Editor | AI spec; header says decisions were "Approved" | identical to tekpractice-sim/docs/ copy |
| 21 | tech-nest-web_DEAD_DO_NOT_USE/docs/ASSUMPTIONS.md | 2026-07-13 (text: "11 July 2026") | 13 assumptions from the website's autonomous build | AI build log | older version of learning-platform/docs/ASSUMPTIONS.md: the repo adds items 14–15 (teknest.fr canonical, night of 16 July) |
| 22 | tech-nest-web_DEAD_DO_NOT_USE/docs/PRODUCT-LATER.md | 2026-07-11 | Website seams: Auth + ProgressStore, certificate check, where the simulator embeds, later features | AI design doc | older version of the repo copy: the repo version has "three swappable interfaces" (adds the `AiTutor` seam and ADR 0001) |

Folders not copied (code): `audio-sim/` (early copy of the simulator) and `tech-nest-web_DEAD_DO_NOT_USE/` (website code apart from the two docs above).

---

## B. Evidence register

Type key: FS = founder statement/decision (as recorded by a doc), FB = founder brief, P = proposal, R = research finding, E = estimate, IF = implementation fact (reported; code not inspected), I = inference (mine).

| ID | Claim | Source (+section) | Date | Type |
|---|---|---|---|---|
| LT-01 | Brand at the time = "Tech Nest": "the best **AI-integrated** platform to help students pass the French BTS Métiers de l'audiovisuel, option Son (Paris/France). Goal: #1 at making students succeed." | STATUS.md "The vision" | 07-15 | FS/FB (as recorded) |
| LT-02 | "Two products under it": (1) Tech Nest website, "courses + certificates (Dante-style), mapped to the official référentiel"; (2) Audio Engineering Simulator, a "reactive 3D 'smart sound simulation'… This is the moat" | STATUS.md "The vision" | 07-15 | FB |
| LT-03 | Products renamed: "**TekPractice** — the reactive 3D 'smart sound simulation' (the game)… ← the active focus" and "**Tekskol** — the theoretical course/certificate site… **PAUSED** until TekPractice is validated." Brand is spelled Tech Nest / TEKNEST. | TEKNEST-FINAL-REPORT.md §1 | 07-18/19 | FS (status statement) |
| LT-04 | "IDENTITÉ : Tekskol — le site/école théorique de Teknest. EN PAUSE : ne pas développer tant que TekPractice n'est pas validé." | TEKNEST-MASTER-BUILD.md "Identities" | 07-17 | FS (status, conditional pause) |
| LT-05 | "Hosting now: TekPractice → teknest.fr root (theoretical site paused; game IS the site for now)" | TEKNEST-MASTER-BUILD.md "Decisions locked" | 07-17 | FS |
| LT-06 | Earlier domain plan: "root `technest.fr` → site; `sim.technest.fr` → simulator (two Vercel projects, one domain)" | STATUS.md "Key decisions" | 07-15 | FS (later replaced, see LT-05) |
| LT-07 | "The Audio Engineering Simulator is the flagship of Tech Nest." | MASTER-PLAN.md §1 | 07-10/11 | P/FS |
| LT-08 | Positioning: "personal now, product later": build for the founder to master audio engineering; "No accounts, no backend, no payments, no DSGVO gate", but "architect so it can become a product without a rewrite" | MASTER-PLAN.md §1 ("Positioning decision (yours)") | 07-10/11 | FS |
| LT-09 | Success criterion: "you can wire a self-op radio studio and build a correct N-1 without notes", measured by the mistake history "trending to zero" | MASTER-PLAN.md §1 | 07-10/11 | FS/P |
| LT-10 | "The mistake history is the product… later it's the data an AI tutor reasons over." | MASTER-PLAN.md §1 rule 3 | 07-10/11 | P |
| LT-11 | Simulator covers 4 domains: Live Sound, Radio/Broadcast, Duplex/Remote (mix-minus), Post-Production; real gear (Yamaha QL1, SM58, Rio stagebox, Pro Tools rigs, TT patchbays) | MASTER-PLAN.md §1 | 07-10/11 | FB/P |
| LT-12 | Positioning: "not a game — a **reactive smart sound simulation**. Trust/anti-cheat AI is the differentiator." | STATUS.md "Key decisions" | 07-15 | FS |
| LT-13 | Yet the later vision calls it "The Educative Game"… "a reactive smart sound simulation that is also a curriculum" | VISION_TekPractice-Game.md title, §0 | 07-16 | P |
| LT-14 | TekPractice has 4 modes sharing "one progression brain": Learn (E3/PTES), Levels (E4), Tests (E3/E4/E51 exam mode), Sandbox/Freeplay, plus a Coach layer | VISION_TekPractice-Game.md §2 | 07-16 | P |
| LT-15 | Environments = cheap "scene presets": "Studio son · Studio radio (self-op) · Plateau TV · Théâtre · Plein-air/concert · Reportage extérieur (ENG) · Événementiel/restaurant" | VISION_TekPractice-Game.md §3 | 07-16 | P |
| LT-16 | Screen flow is placed "inside Tekskol": Onboarding, Dashboard, Learn, Levels, Tests, Sandbox, Coach/Mentor, Progress, "Profile / Certificates — ties into the Tekskol certificate system" | VISION_TekPractice-Game.md §4 | 07-16 | P |
| LT-17 | Progress measured as "Exam-readiness, not XP": radar per bloc BC01–BC04 and épreuve E3/E4/E51; no punishing leaderboards | VISION_TekPractice-Game.md §5 | 07-16 | P |
| LT-18 | White art direction: "Gallery-white, calm, premium — think Teenage Engineering × Apple × a real studio"; "White = lowers anxiety" | VISION_TekPractice-Game.md §6 | 07-16 | P |
| LT-19 | Business model: "free taster (1 environment, a few levels) → subscription for full sandbox + tests + analytics; certificates tie-in; shared rigs drive growth" | VISION_TekPractice-Game.md §8 Business | 07-16 | P |
| LT-20 | "Free tier gives away the value → fix: free = one room + a few levels; subscription = full sandbox + tests + analytics" | VISION_TekPractice-StudentJourney.md "Honest failure modes" | 07-16 | P |
| LT-21 | Website seam doc: "Paid tier (human review, coaching) — keep courses free (positioning); gate the human-escalation features only" | DEAD/docs/PRODUCT-LATER.md §5 | 07-11 | P |
| LT-22 | Founder's own voice is central: "Conseils d'Oscar"… "the trust and self-efficacy layer no competitor and no AI can fake" | VISION_TekPractice-Game.md §11 | 07-16 | P (built on founder role) |
| LT-23 | Persona: "Nadia. 19, first year BTS Métiers du son in Paris… Terrified of the physics (E3/PTES) and of the practical exam (E4)" | VISION_TekPractice-StudentJourney.md intro | 07-16 | P (fictional persona) |
| LT-24 | Beat 6: graduates become "community + mentor content"; "partage ta config préférée / laisse un conseil aux prochains" | VISION_TekPractice-StudentJourney.md Beat 6 | 07-16 | P |
| LT-25 | Beat 6 status: "◻️ design goal; community later" | TEKNEST-FINAL-REPORT.md §4 | 07-18/19 | IF (reported) |
| LT-26 | People: "started as Ali's vision; **you (Oscar)** are building it on **Windows**." This names another person (not the founder); recorded verbatim as a historical claim only. See open question on ownership (C-18) | STATUS.md "The vision", Note | 07-15 | FS (as recorded) |
| LT-27 | Founder role: "you, the graduate, are the review gate; nothing ships unverified"; "Write the 13 coach tips… the one thing no AI should fake" | StudentJourney "failure modes"; FINAL-REPORT §6 | 07-16 / 07-18 | FS/P |
| LT-28 | Team for building = AI agents: "designer" (one white design system for site + game) and "developer" (engineering), in `~/.claude/agents/` | TEKNEST-MASTER-BUILD.md "Agents & identities"; FINAL-REPORT §1 | 07-17 | P / IF |
| LT-29 | GitHub: site = `Braco3326/Technest`, simulator = `Braco3326/Technest-Sim` | STATUS.md window map; FINAL-REPORT §1 | 07-15 / 07-18 | IF (reported) |
| LT-30 | Folder moves: `C:\dev\tech-nest-web` and `C:\dev\audio-sim`, then everything under `D:\teknest\` (tekpractice / tekskol / docs); old folders renamed `_DEAD` as "backup gelé" | STATUS.md; TEKNEST-MASTER-BUILD.md Prompt 1 step 6 | 07-15 / 07-17 | IF/P |
| LT-31 | The `_DEAD` suffix means "frozen backup, impossible to use by mistake" after the copy to D:, not that the product was abandoned | TEKNEST-MASTER-BUILD.md Prompt 1 step 6 | 07-17 | I (from quoted step) |
| LT-32 | Website status: "Next.js, French, dark pro-audio design. Real E3/PTES course (6 units + exam), 6 stub courses, annales library (18 papers), certificate portal, mock auth… 28 tests green. Deployed + QA'd" | STATUS.md "What's done" | 07-15 | IF (reported) |
| LT-33 | Website "AI tutor — built as UI, NOT live. Needs `ANTHROPIC_API_KEY`" | STATUS.md "Not started" | 07-15 | IF (reported) |
| LT-34 | Website later: "SEO pass, AI-tutor UI on landing (wired to Gemini, not yet live)" | FINAL-REPORT §3 | 07-18/19 | IF (reported) |
| LT-35 | Website mock rules: unit-quiz pass mark 70%; final exam = "24 annales-style MCQs"; certificates "independent pedagogical attestations, not ministry diplomas"; codes `TN-XXXX-XXXX` | DEAD/docs/ASSUMPTIONS.md items 1,4,6,9 | 07-11/13 | IF (reported) |
| LT-36 | Website temporary URL `https://tech-nest-web-gamma.vercel.app` "until a real domain exists" | DEAD/docs/ASSUMPTIONS.md item 7 | 07-11/13 | IF (reported) |
| LT-37 | Seam: simulator embeds in course `e4-tmo` through a `{ type: "sim"; levelId }` LessonBlock / `<AudioSimEmbed>` iframe | DEAD/docs/PRODUCT-LATER.md §3 | 07-11 | P |
| LT-38 | Simulator (07-15): catalog v1 "26 connectors, 16 signals, 24 devices, 8 rules R1–R8"; A1 playable; 49 tests | STATUS.md "What's done" | 07-15 | IF (reported) |
| LT-39 | Simulator (07-18): "a **real, playable product on localhost**"; 4 levels A1–D1 winnable; readiness dashboard, exam mode, sandbox v1, coach system, onboarding, 2D motion, Focus & Patch; "164 vitest + 32 e2e" | FINAL-REPORT §2–3 | 07-18/19 | IF (reported) |
| LT-40 | "Coach system… (⚠️ tips are placeholders)"; "AI Coach (real-time, RAG-grounded, socratic) — not started; needs an API key" | FINAL-REPORT §3, §5 | 07-18/19 | IF (reported) |
| LT-41 | Live state: "`www.teknest.fr` serves a stale bundle — Vercel Git reconnect + redeploy" | FINAL-REPORT §5 | 07-18/19 | IF (reported) |
| LT-42 | Domain DNS: "apex `teknest.fr` A record → `216.198.79.1` at Wix (www already works)" | FINAL-REPORT §6 item 6 | 07-18/19 | IF (reported) |
| LT-43 | Roadmap TekPractice phases 0–6: Foundation; White skin + Dashboard + Readiness; Modes spine; Sandbox v1; Environments + 2D motion + assets; Coach + mentor; Polish/perf; "Each phase ends playable on teknest.fr" | TEKNEST-MASTER-BUILD.md "The phases" | 07-17 | P |
| LT-44 | Alternative phase list P0–P5 (P4 = AI coach + mentor library; P5 = "Polish, perf, low-end fallback, community") | VISION_TekPractice-Game.md §9 | 07-16 | P |
| LT-45 | Recommended order: "A (ship) → … → B (real set) → E (polish) → C (AI coach…) → D (your tips) → then F (Tekskol) when you unpause." | FINAL-REPORT §7 | 07-18/19 | P |
| LT-46 | After the sprint: "build the **Tech Nest website**… later, the **AI audio-feedback layer** (`ai-integrate`, RAG on the référentiel + annales, local on the Mac Studio)" | MASTER-PLAN.md §7 | 07-10/11 | P |
| LT-47 | "THE ONE THING TO REMEMBER: Both products are strong but **contain zero live AI** — the first word of the brief." | STATUS.md last section | 07-15 | IF/P |
| LT-48 | Market: "**personne ne possède le créneau « BTS MAV option Son »**"; 4 clusters each miss a piece | Competitive-Landscape §0 | 07-07 | R |
| LT-49 | 3 white spaces: "A. Spécialisation Son + alignement référentiel officiel", "B. IA pédagogique « teach, don't cheat »", "C. Feedback IA sur le geste audio… inexistant partout" | Competitive-Landscape §0 | 07-07 | R |
| LT-50 | Closest competitor: "btsmav.fr est le concurrent le plus proche mais reste générique et sans IA" (~14 € one-shot); Nomad Education ~7.5 €/mo, "Son superficiel" | Competitive-Landscape §1; db_competitors_matrix.csv | 07-07 | R |
| LT-51 | Price benchmark: "Prix grand public ~7–14€/mo; premium justifiable (0 concurrent direct)" | Competitive-Landscape §5 Business | 07-07 | R/E |
| LT-52 | Business levers: "crédit d'impôt 50 % / CESU (si agrément SAP)", "B2B écoles/CFA", "échelle IA gratuite → expert humain payant" | Competitive-Landscape §5 | 07-07 | R/P |
| LT-53 | Market signal: "un CFA à 50 % en 2025" success rate; no dedicated community found | Competitive-Landscape §0 | 07-07 | R |
| LT-54 | Things Tech Nest can beat include "Pas de communauté trouvable → communauté moderne dédiée" | Competitive-Landscape §6 item 5 | 07-07 | R/P |
| LT-55 | Utility "quick wins": simulateur de notes, calendrier d'examen, "chercheur de stage/alternance", annuaire d'écoles, Parcoursup orientation | Competitive-Landscape §5 | 07-07 | P |
| LT-56 | Schools (INA, Louis-Lumière) are "ancres de crédibilité et une destination post-BTS… pas des concurrents produit" | Competitive-Landscape §1 | 07-07 | R |
| LT-57 | Phase 3 research left to do: student interviews, pass rates, référentiel Annexe I/V, OCR of annales, SEO, SAP/Qualiopi/OPCO, AI-audio feasibility, RGPD (possible minors) | Competitive-Landscape §7 | 07-07 | P |
| LT-58 | BTS: RNCP37196, Niveau 5 (Bac+2), 120 ECTS, "fin de validité annoncée : 31/08/2027"; arrêté du 4 juin 2013; first session 2016 | KB §1 | 07-07 | R |
| LT-59 | Coefficients option Son: E1 CAA 2, E2 Anglais 1, E3 PTES 4 (6 h, 3h+3h), E4 4, E51 4, E52 1, E6 1; "Total obligatoire = 17"; EF1 optional | KB §2; db_epreuves_coefficients.csv | 07-07 | R |
| LT-60 | "Il n'existe pas d'épreuve « prise de son » isolée": practical skills are assessed in E4 and E51; E4/E5/E6 have no public papers | KB §2, §6 | 07-07 | R |
| LT-61 | Timetable 31 h/week, 930 h/year, 1 860 h over 2 years; internship 8–10 weeks at the end of year 1 | KB §1, §3; db_grille_horaire.csv | 07-07 | R |
| LT-62 | Blocs: BC01 Mise en place d'un projet; BC02 "Mise en œuvre des savoir-faire des métiers du son" (Son-specific); BC03 Participation à une production; BC04 Analyse de situation professionnelle | KB §4; db_blocs_competences.csv | 07-07 | R |
| LT-63 | E3 PTES annales officially available 2017, 2019–2025 + Sujet 0; corrigés not published officially | KB §5–6; db_annales_index.csv | 07-07 | R |
| LT-64 | Feature ideas: "Générateur d'entraînement E3-PTES", "Coach CAA", "Assistant projet E51/E6", simulator for E4/E5/E6 | KB §8 | 07-07 | P |
| LT-65 | Set System decisions "Approved: in-app Set Editor · white studio kept but grounded/staged · connection issue is visual/layout (rules stay)" | TekPractice_Set-System.md header | 07-19 | FS (as recorded) |
| LT-66 | Interaction principle: "finding the right port on a real panel IS the exam skill (E4)… Some friction is pedagogy." | TekPractice_Interaction-and-Assets.md §0 | 07-17 | P |
| LT-67 | Legal/IP: commercial launch requires genericizing brands; "Never ship GrabCAD or CC-BY-NC"; `assets-source/` gitignored | TekPractice_3D-Model-Sourcing.md; Interaction-and-Assets §6 | 07-17/19 | P/R |
| LT-68 | Open founder decisions: licence floor "CC0-only vs CC0 + CC-BY (recommended)"; "Use AI image-to-3D? (recommended yes)" | TekPractice_3D-Model-Sourcing.md "Decisions for Oscar" | 07-19 | P (pending decision) |
| LT-69 | Risks: "The catalog is the single point of failure"; perf on low-end laptops → 2D fallback; "Assessment rigor must be real"; founder time to write mentor content | MASTER-PLAN §8; VISION_Game §7 | 07-10/16 | P |
| LT-70 | Problems hit: `Documents` folder "strangled all Node builds"; reference files never existed ("Cas 3"); date confusion "said July 10, it was 13"; "Fable 5 access uncertain" | STATUS.md "Problems we hit" | 07-15 | IF (reported) |

---

## C. What is IdeaSphere?

**What it is.** IdeaSphere is a personal tool for tracking projects. It is not a Tekonest/TechNest product or service. The only file is a build prompt: idea-sphere/Fable5-Prompt-IdeaSphere.md (2026-07-10). It asks an AI model ("Fable 5") to "Build a single self-contained HTML file called `idea-sphere.html` — a 3D interactive 'idea sphere' for tracking my projects. Think Obsidian's graph view, but far nicer visually and in 3D."

- **Data model:** nodes typed "project|module|idea|task" with status "idea|in-progress|done|blocked", a progress percentage, notes and tags. Links typed "child|relates|depends".
- **Tech:** three.js from a CDN, opened by double-clicking the file. Saves to localStorage (key "ideaSphere:v1") and supports JSON export/import.
- **UI:** colour by status, size by type, a side panel for editing, a toolbar (add node, link mode, search/filter, export/import/reset).
- **Seed data:** Tech Nest (project, 30%) with modules KB (done), Competitive Landscape (done), Phase 3 Research, Website Build; and Audio Engineering Simulator (project, 20%) with CLAUDE.md+Scaffold, Catalog authoring ("blocked", Cas 3), Engine + A1, Levels B1/C1/D1, 3D Assets, Verify & Ship.
- **Link between the two projects in the seed:** `audio-sim→tech-nest (kind:"relates", note conceptually: simulator fills Tech Nest's "AI feedback on practical sound skills" white space)`.
- **Later ideas in the file:** reading an Obsidian vault directly, or auto-syncing status from the Claude Code task list or git.

**Status:** STATUS.md (07-15) says "**Idea Sphere** — `idea-sphere.html`, 3D project tracker, built + logic-tested", and in the window map, "W2 … was idea-sphere | Idea Sphere is DONE — this window may be free/reusable". This is reported; the HTML was not in the copied folder.

**How it relates to Tekonest.** It is a separate internal side tool, used to visualise and track the TechNest projects. It is not a learner-facing service. No doc lists it as a TechNest product: STATUS.md lists "Two products", and IdeaSphere sits under "What's done" as a tool. The Final Report and Master Build do not mention it. Its only tie to Tekonest is that its seed content is the TechNest projects. (Inference: its role as a project tracker overlaps with the "weekly tracker" kind of tooling, not with the brand's offer.)

---

## D. Links between services described in these docs

- **Simulator inside the brand.** "The Audio Engineering Simulator is the flagship of Tech Nest." (MASTER-PLAN §1, 07-10/11). Also "Two products under it… This is the moat (no competitor has it)." (STATUS, 07-15).
- **Simulator embedded in the website's E4 course.** "The course `e4-tmo`… is the seam… E4 becomes a `status: "available"` course whose units carry… `{ type: "sim"; levelId: string }` rendered by an `<AudioSimEmbed levelId>`" (DEAD PRODUCT-LATER §3, 07-11). Repeated in FINAL-REPORT Prompt F step 3: "INTÈGRE LE SIMULATEUR dans le cours E4 (iframe https://teknest.fr ou sim.teknest.fr — le seam est documenté)" (07-18).
- **Shared progress backend.** "The simulator's own `ProgressStore` (mistake history) shares this architecture, so a common backend can serve both once accounts are real." (DEAD PRODUCT-LATER §3). MASTER-PLAN §2 row 8 lists "Tech Nest embed" as a product-later seam.
- **Content flows from site to game.** "Learn (theory · maps to E3/PTES). Micro-lessons + retrieval quizzes from the Tekskol courses" (VISION_Game §2A). The screen flow is placed "inside Tekskol", and "Profile / Certificates — ties into the Tekskol certificate system" (§4). The repo NIGHT_LOG says "Mode Learn (micro-lecons Tekskol) : pas commence".
- **One design system.** "UN seul design system, partagé site+jeu" (designer agent, MASTER-BUILD). "One design system… shared by site + game so `teknest.fr` and the game feel like one product" (VISION_Game §10).
- **Domain split over time.** 07-15: "root `technest.fr` → site; `sim.technest.fr` → simulator". 07-17: "TekPractice → teknest.fr root (theoretical site paused; game IS the site for now)".
- **IdeaSphere tracks both.** The seed link `audio-sim→tech-nest` is "relates" (Fable5-Prompt-IdeaSphere).
- **AI layer spans both.** The site has an AI tutor (RAG on référentiel + annales) and the game has an AI coach ("distinct des Conseils d'Oscar authorés"). MASTER-PLAN §7 adds an "AI audio-feedback layer"; Competitive-Landscape white space C.
- **Community.** Graduates "become community + mentor content" (StudentJourney Beat 6); "community later" (FINAL-REPORT §4). There is no community product spec.
- **Events/technicians: no link.** Nothing in these docs mentions cultural events, Rebels, a technician network or equipment rental. "événementiel" appears only as a BTS job sector (KB §4) and as a simulator environment preset (VISION_Game §3; MASTER-BUILD Phase 4).

---

## E. Conflicts and contradictions

1. **Website status changes from doc to doc, and the repo differs again.**
   - "Site DONE, deployed" (STATUS 07-15).
   - "PAUSED until TekPractice is validated" (FINAL-REPORT 07-18) and "EN PAUSE" (MASTER-BUILD 07-17).
   - The repo README (2026-10-21) lists learning-platform as "Live on Vercel".
   - Founder instruction (current): the learning platform is a current vision under development.
   - Reading: the July "pause" was a conditional sequencing decision ("until TekPractice is validated"). It was not an abandonment.
2. **"DEAD" folder name versus a live product.** `tech-nest-web_DEAD_DO_NOT_USE` is the frozen pre-move backup (MASTER-BUILD Prompt 1 step 6). The product continued as `D:\teknest\tekskol`, and the repo docs are newer (ASSUMPTIONS has items 14–15 dated "nuit du 16 juillet"; PRODUCT-LATER has the third `AiTutor` seam). The DEAD docs are older snapshots of the same product.
3. **AI coach status.** FINAL-REPORT (07-18/19) says "AI Coach… — not started; needs an API key". The repo's tekpractice-sim/docs/NIGHT_LOG.md "Run coach IA (2026-07-17)" and ADR-0006 ("Accepted (run autonome, 2026-07-17)") report an AiCoach/AnthropicProvider layer built, with 17 tests, that degrades to "unconfigured" when no key is set. The report is either stale or means "not live".
4. **AI provider for the site tutor.** STATUS (07-15): "Needs `ANTHROPIC_API_KEY`". FINAL-REPORT (07-18): "wired to Gemini". The repo ADR 0002 (15 July) makes Claude and Gemini interchangeable. These fit together once ADR 0002 is known, but no single doc states it.
5. **Domain.** STATUS 07-15 plans `technest.fr` + `sim.technest.fr`. MASTER-BUILD 07-17 and FINAL-REPORT use `teknest.fr` (game at root). Repo ASSUMPTIONS item 14 says the site's canonical is `teknest.fr` and the simulator lives in Vercel project `teknest-simu`; the repo learning-platform layout.tsx uses `metadataBase: https://teknest.fr`. So both the site and the game claim teknest.fr at different times.
6. **"Not a game" versus "The Educative Game".** STATUS 07-15: "not a game — a reactive smart sound simulation". VISION 07-16 and FINAL-REPORT call TekPractice "the game".
7. **Monetisation.** VISION_Game and StudentJourney: free taster, then subscription. DEAD PRODUCT-LATER: "keep courses free (positioning)", paid only for human escalation. MASTER-PLAN: "no payments", personal first. Competitive-Landscape: ~7–14 €/mo, CESU, B2B. The repo README calls the learning platform "free". No pricing decision is recorded.
8. **Phase lists.** VISION_Game §9 uses P0–P5, MASTER-BUILD uses Phases 0–6, MASTER-PLAN uses Missions 1–6. They overlap but number and group the work differently.
9. **Design direction.** The website was built in a "dark pro-audio design" (STATUS 07-15), and MASTER-PLAN Mission 5 asks for "Dark, precise, studio-grade". From 07-16/17 the direction is "white, calm, gallery-grade" and "UN seul design system, partagé site+jeu". It is unclear whether the site was ever re-skinned.
10. **Dates inside docs.** STATUS admits a date error ("said July 10, it was 13"), which affects MASTER-PLAN's "Written Fri 10 July". The Final Report text says "Updated 2026-07-18" but the file date is 07-19. ASSUMPTIONS says "11 July" but the file date is 07-13.
11. **Test counts move over time:** 49 (07-15) → 113/130 (repo NIGHT_LOG 07-17) → 164 vitest + 32 e2e (07-18). This is a progression, not a contradiction.
12. **Brand naming.** These docs use Tech Nest / TECH NEST / Teknest / TEKNEST / Technest (repos). The repo README (10-21) uses **Tekonest** and says older files use "Techonest". The July docs never use "Tekonest" or "Techonest".
13. **Brand scope.** The July docs define the brand only as an AI exam-success platform for BTS Son, with 2 products. The repo README (10-21) defines Tekonest as "a Paris nest of services around culturally mixed events… and a community that gives artists and technicians fairly paid work", with the learning platform and simulator as services among others. The scope has clearly widened since July.
14. **Identity.** STATUS.md says it "started as Ali's vision". All other docs address Oscar as the founder. This names another person, not the founder; recorded only as a historical claim (see C-18).

---

## F. What could not be inspected

- **Code:** `audio-sim/` and `tech-nest-web_DEAD_DO_NOT_USE/` were not copied (only 2 docs), so every implementation fact above is "reported".
- **IdeaSphere output:** `idea-sphere.html` itself was not copied; only the prompt was.
- **Files named in the docs but absent from the copy:** `docs/REVIEW-ME.md` (website version from July), `content/coach/tips.json`, `ASSET_MANIFEST.json`, `assets-source/`, `D:\teknest\README.md`, and the "BTS personal docs zip" / `C:\dev\bts-content`.
- **PDF visuals:** the PDFs were checked as text only. All three are WeasyPrint renders whose vocabulary matches the .md sources, so no extra content was found. Images or layout were not examined.
- **Live checks:** I did not check whether www.teknest.fr, the Vercel projects or the GitHub repos `Braco3326/*` are live today. I did not verify the BTS facts against official sources again; they are recorded as the doc's July 2026 research.
- **"Council-validated (Tier 3, 82%/84%)":** this refers to an AI council process with no record in the folder. I could not verify it.

---

## G. Plain-language summary (15 lines)

1. In July 2026 the brand was called "Tech Nest" (later "Teknest"). It was an AI-powered platform to help students pass the BTS Audiovisuel, option Son, in France.
2. The stated goal was to be "#1 at making students succeed", with trust and "teach, don't cheat" AI as the main difference from competitors.
3. Research on about 70 competitors found that nobody specialises in BTS Son. There were three openings: Son-specific content aligned with the official syllabus, honest tutoring AI, and AI feedback on real audio work.
4. Two products were planned: a theory website (later named "Tekskol": courses, past papers, certificates, AI tutor) and a 3D wiring simulator (later named "TekPractice").
5. The simulator was meant to be the flagship and "moat". You wire real pro gear and the rules engine teaches the classic mistakes (phantom power, N-1, clock).
6. TekPractice was to have four modes: Learn, Levels, exam-style Tests, and a Sandbox of real rooms (studio, radio, TV set, theatre, open-air, reportage, event).
7. Progress was to be shown as "exam readiness" mapped to the official skill blocs and exams, not XP. The look was to be calm and white.
8. Oscar's own voice ("Conseils d'Oscar") was the human layer, along with an AI coach. Graduates were to become a community of mentors later.
9. The business ideas were a free taster then a subscription (about 7–14 €/month was the market benchmark), school/CFA deals, and tax-credit routes. Nothing was decided, and one doc says courses stay free.
10. In mid-July the website was reported built and deployed. On 17–18 July it was "paused until TekPractice is validated" so the work could focus on the game. This was a sequencing choice, not an abandonment.
11. By 18 July the simulator was reported as "a real, playable product on localhost" with levels A1–D1, exam mode, a sandbox and a dashboard. It was still waiting for a redeploy, the founder's coach tips, real 3D assets and live AI.
12. "DEAD_DO_NOT_USE" only marks the old copies of the folders after the move to D:\teknest. The products themselves continued.
13. IdeaSphere was a private 3D project tracker for these projects, not a product of the brand.
14. None of these July docs mentions events, Rebels, technician networks or equipment rental. That wider "Tekonest" scope comes later (repo README, Oct 2026).
15. The founder's current position is that the learning platform and the simulator are current visions under development. The July "pause" should be read as a dated status, not as a final verdict.
