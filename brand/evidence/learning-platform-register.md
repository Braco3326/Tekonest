# Audit — `learning-platform/` (Tekonest repo)

Audited 2026-10-21. Read-only on the repository. Original history = 17 commits on `5db50e6^2`, all dated 2026-07-13 → 2026-07-16, author "Claude Code", trailer `Co-Authored-By: Claude Fable 5`. Imported into Tekonest on 2026-10-21 (`5db50e6`, git-subtree-split `8c015de`). After 2026-07-16 there is no further original commit.

Brand names seen in this folder: **"Tech Nest"** (UI, logo, JSON-LD, prompts), **"TechNest"** (prompt file name, research files `TechNest_*.md`), **"Thechnest"** (parent folder name in the prompt), **"teknest"** (domain `teknest.fr`, `sim.teknest.fr`, Vercel team `teknest`, project `teknest-simu`), `technest.*` (localStorage keys), npm name `tech-nest-web`. The name "Tekonest" does not appear anywhere in this folder.

---

## A. Source list

| Path | Last original commit (first) | Description | Author type |
|---|---|---|---|
| learning-platform/docs/Prompt-TechNest-Website-Base.md | 2026-07-13 (2026-07-13) | Mission prompt "3rd Claude Code window, Fable 5": build the Tech Nest platform base, Dante-Certification model, E3 real course, annales, mock auth, certificates, Vercel deploy | Founder brief (prompt the owner issued; likely AI-assisted wording) |
| learning-platform/README.md | 2026-07-13 | Product summary (free platform, BTS MAV Son, RNCP37196), prod URL, stack, dev commands, "28 tests" | AI-generated doc |
| learning-platform/docs/ASSUMPTIONS.md | 2026-07-16 (2026-07-13) | 15 autonomous-build assumptions (header says "11 July 2026"; #14–15 added night of 16 July) | AI-generated doc |
| learning-platform/docs/PRODUCT-LATER.md | 2026-07-13 | Architecture seams (Auth/Progress/AiTutor), Supabase sketch, certificate verification, simulator embed in E4, later features incl. paid tier | AI-generated doc |
| learning-platform/docs/REVIEW-ME.md | 2026-07-16 (2026-07-13) | Expert review pack for E3 content: admits 100 % of physics content is from model knowledge; lists suspected errors; banner "RELU ET VALIDÉ le 15 juillet 2026 par le propriétaire"; §6 stub drafts pending review | AI-generated doc (+ recorded founder validation) |
| learning-platform/docs/adr/0001-assistant-ia-tuteur.md | 2026-07-13 | ADR: socratic grounded tutor, lexical RAG, citation validator, Claude Opus 4.8 default, privacy | AI-generated doc |
| learning-platform/docs/adr/0002-seam-fournisseur-llm.md | 2026-07-15 | ADR: TutorLlm seam, Claude + Gemini selectable by env; motivated by owner's Gemini free-tier request | AI-generated doc (records founder request) |
| learning-platform/docs/design-system.md | 2026-07-15 (2026-07-13) | Visual identity tokens: dark "studio-grade", metering semantics (amber/green/red/blue), fonts | AI-generated doc |
| learning-platform/docs/drafts/plans-cours-stubs.md | 2026-07-16 | Draft syllabi E1, E2, E52, E6 sourced from research files; status BROUILLON | AI-generated doc |
| learning-platform/.gitignore | 2026-07-16 (2026-07-13) | Ignores env, .vercel, screenshots, lh-*.json, `/source` ("Documents personnels (jamais commit)") | Code/config |
| learning-platform/package.json | 2026-07-15 (2026-07-13) | `tech-nest-web` 0.1.0; Next 15, React 19, `@anthropic-ai/sdk`, `@google/genai`, Tailwind 4, Vitest, Playwright | Code/config |
| learning-platform/next.config.ts | 2026-07-13 | Empty Next config | Code/config |
| learning-platform/vitest.config.ts | 2026-07-15 (2026-07-13) | Loads `.env.local` for live integration tests | Code/config |
| learning-platform/scripts/check-live.mjs | 2026-07-15 | Playwright smoke check of prod (default `tech-nest-web-gamma.vercel.app`) | Code |
| learning-platform/scripts/check-tutor.mjs | 2026-07-15 | Playwright E2E of live tutor (grounding citation + socratic refusal) | Code |
| learning-platform/scripts/screenshots.mjs | 2026-07-15 | Visual QA screenshots desktop/mobile | Code |
| learning-platform/src/** (skimmed: app routes, data, lib/ai, lib/auth, lib/progress, components) | 2026-07-13 → 2026-07-16 | Next.js App Router implementation | Code |

No CLAUDE.md, no `.env.example` (referenced by ADR 0001 but absent from the repo), no `postcss`/`tsconfig` content of note.

---

## B. Evidence register

| ID | Claim | Source | Date | Type |
|---|---|---|---|---|
| LP-01 | Purpose: "an AI-integrated learning platform that helps students pass the French BTS Métiers de l'audiovisuel, option Métiers du Son" | docs/Prompt-TechNest-Website-Base.md l.9 | 2026-07-13 | founder brief |
| LP-02 | Model copied from the **Dante Certification Program (Audinate)**: free tiered courses, units, exam gating, certificate after units + survey, 3-year validity. "Our twist: credits become BTS référentiel competencies. No competitor does this." | Prompt l.4–5 | 2026-07-13 | founder brief |
| LP-03 | Differentiator: every course maps to an épreuve (E1–E6) and a bloc RNCP37196 BC01–BC04 with real coefficient; certificate names competencies demonstrated | Prompt l.30–31; landing `src/app/page.tsx` | 2026-07-13 | founder brief / implementation fact |
| LP-04 | Positioning: transparency vs competitors' "100 % de réussite" claims; "conforme au référentiel officiel (arrêté du 4 juin 2013, RNCP37196)"; "Free core, like Dante" | Prompt l.56–57; `src/app/a-propos/page.tsx` | 2026-07-13 | founder brief |
| LP-05 | Problem stated on landing: "Les plateformes de révision s'arrêtent au bac ou traitent les cinq options du BTS MAV en bloc. Personne ne couvre l'option Son en profondeur" | src/app/page.tsx ("Pourquoi Tech Nest existe") | 2026-07-13 | proposal (marketing claim, unverified) |
| LP-06 | Audience: students of BTS MAV option Son; "développé indépendamment, par et pour des étudiants de la filière son" | src/app/a-propos/page.tsx | 2026-07-13 | proposal (self-description) |
| LP-07 | Referentiel facts: 7 compulsory épreuves, total 17 coefficients; E3 PTES coef 4, written 6 h (3h+3h); E4 coef 4; E51 coef 4; E1 2; E2/E52/E6 1 | src/data/referentiel.ts; landing FAQ | 2026-07-13 | research finding (seeded from founder's research CSVs, not re-verified by me) |
| LP-08 | Research inputs (outside this folder): `TechNest_BTS-Son_Knowledge-Base.md`, `db_*.csv` (épreuves, grille, blocs, annales index), `TechNest_Competitive-Landscape.md` | Prompt l.13–16; drafts/plans-cours-stubs.md | 2026-07-13 | founder brief |
| LP-09 | E3/PTES chosen as the one real course because it is "the only épreuve with official public annales (2017–2025)"; E4/E51 stubbed because the Audio Simulator plugs in there — "which is the whole moat" | Prompt Notes l.92 | 2026-07-13 | founder brief |
| LP-10 | Course catalogue in code: 7 courses (E1, E2, E3, E4, E51, E52, E6); only E3 `status` available, other 6 `stub` with "En préparation" | src/data/courses/index.ts | 2026-07-13 | implementation fact |
| LP-11 | E3 content: 6 units (acoustique, électricité, transducteurs, audionumérique, traitement, supports), 10 quiz questions each, survey, 24-question exam | src/data/courses/e3/*.ts (counted) | 2026-07-13 | implementation fact |
| LP-12 | "100 % du contenu technique des 6 unités E3 et de l'examen blanc … provient des connaissances générales du modèle d'IA"; "Personne n'a ouvert les PDF des annales" | docs/REVIEW-ME.md §1, §1.b | 2026-07-13 | AI self-assessment (proposal/risk) |
| LP-13 | "RELU ET VALIDÉ le 15 juillet 2026 par le propriétaire du projet (diplômé BTS Métiers du Son) : aucun point n'a nécessité de correction, y compris les suspicions listées en section 2" | REVIEW-ME.md banner; commit 0b04de7 | 2026-07-15 | founder statement/decision (as recorded by AI) |
| LP-14 | Suspected error still present in code: "+4 dBu ↔ −18 dBFS" attributed to EBU R68 (unit1 l.103, unit6 l.59); c ≈ 344 m/s kept | src/data/courses/e3/unit1-acoustique.ts, unit6-supports.ts | 2026-07-13 (unchanged since) | implementation fact |
| LP-15 | Exam is 24 annales-style MCQs, not the real 6 h written paper — stated on exam page; unlimited attempts, best score | ASSUMPTIONS #4 | 2026-07-13 | proposal/decision (AI assumption) |
| LP-16 | Gating: exam unlocks only after all units + survey; unit quiz and exam pass ≥ 70 %; certificate valid 3 years, code `TN-XXXX-XXXX` via `Math.random` | src/lib/progress/model.ts; ASSUMPTIONS #1,#6 | 2026-07-13 | implementation fact |
| LP-17 | Certificate is an "attestation pédagogique indépendante, non délivrée par le ministère"; PDF via browser print (`window.print()`) | src/app/certificats/[id]/page.tsx; ASSUMPTIONS #5,#9 | 2026-07-13 | implementation fact |
| LP-18 | Auth & progress are mocks in localStorage (`technest.users.v1`, `technest.session.v1`), passwordless, labelled "Version bêta"; verification is device-local | src/lib/auth/localAuthProvider.ts; src/components/AuthForm.tsx; src/app/verification/page.tsx | 2026-07-13 | implementation fact |
| LP-19 | Planned backend: Supabase (profiles, course_progress, certificates tables) swapped in via 3 lines in providers.tsx | docs/PRODUCT-LATER.md §1 | 2026-07-13 | proposal |
| LP-20 | Routes present: `/`, `/cours`, `/cours/[slug]`, `/unite/[unitSlug]`, `/quiz`, `/enquete`, `/examen`, `/certificats`, `/certificats/[id]`, `/profil`, `/connexion`, `/inscription`, `/verification`, `/annales`, `/annales/[slug]`, `/tuteur`, `/a-propos`, `/api/tutor`, sitemap, robots, OG image | src/app/** | 2026-07-13 → 07-16 | implementation fact (code present) |
| LP-21 | Annales library: 18 entries (17 official, 1 third-party); E3 sessions 2017, 2019–2025 + sujet zéro on sti.eduscol; one page per entry (links only, "sans copie") | src/data/annales.ts; commit 60c812c | 2026-07-13 / 07-16 | implementation fact |
| LP-22 | AI tutor implemented: `/api/tutor` server route, lexical retrieval over ~80 passages (top-6), socratic prompt rules ("jamais la réponse toute faite"), post-generation citation validator, streaming text; limits 24 msgs / 4 000 chars / 2048 tokens / 60 s | src/app/api/tutor/route.ts; src/lib/ai/*; ADR 0001 | 2026-07-13 | implementation fact (code present; not run live by me) |
| LP-23 | LLM provider seam: Anthropic (`claude-opus-4-8` default, adaptive thinking, effort medium, prompt caching) and Gemini (`gemini-2.5-flash`); `TUTOR_PROVIDER` forces, else Anthropic key first; no key → HTTP 501 "non configuré" | src/lib/ai/llm.ts, llm.factory.ts; ADR 0002 | 2026-07-15 | implementation fact |
| LP-24 | Founder request: "peut-on connecter Gemini au tuteur ?" because Google AI Studio free tier "permet d'activer le tuteur sans coût" | ADR 0002 Contexte | 2026-07-15 | founder statement/decision |
| LP-25 | "TUTOR_PROVIDER=gemini set on Vercel production (env, out of band)" — "Lock production tutor to Gemini; prep for key activation" | commit 5400811 message | 2026-07-15 | founder decision (recorded by AI; env not verifiable) |
| LP-26 | Weak-spot detection computed client-side from progress (quiz < 70 %, < 85 %, exam failed, unit not started) and sent to tutor | src/lib/ai/weakSpots.ts; ADR 0001 §6 | 2026-07-13 | implementation fact |
| LP-27 | Privacy: tutor conversations not persisted server-side; transit via provider API | ADR 0001 §7 | 2026-07-13 | proposal/decision |
| LP-28 | Tech stack: Next.js 15 (App Router), TypeScript, Tailwind 4, Vitest; Playwright for scripts | package.json; README | 2026-07-13 | implementation fact |
| LP-29 | Hosting: Vercel, prod URL `https://tech-nest-web-gamma.vercel.app` | README; commit bedb2a9; scripts defaults | 2026-07-13 | implementation fact (URL in config; not reachable from audit sandbox) |
| LP-30 | Canonical SEO domain switched to `https://teknest.fr` "sur instruction du propriétaire"; DNS still pointed to Wix (error page) at the time; Vercel project moved by owner into team `teknest`; simulator lives in `teknest-simu` | ASSUMPTIONS #14; commit d46f864; src/app/layout.tsx | 2026-07-16 | founder decision (recorded) + implementation fact |
| LP-31 | SEO: JSON-LD (EducationalOrganization, Course, FAQPage), OG image, per-route canonical, robots disallow /profil /certificats /api | commit d46f864; src/components/JsonLd.tsx | 2026-07-16 | implementation fact |
| LP-32 | Design identity: "Studio-grade, precise, dark… pro-audio, not a kids' app"; metering colour semantics; Space Grotesk / Inter / JetBrains Mono; logo = fader cap forming the "T" | docs/design-system.md; Prompt l.70; src/components/Logo.tsx | 2026-07-13/15 | founder brief + implementation fact |
| LP-33 | Monetisation: courses free; "Paid tier (human review, coaching) — keep courses free (positioning); gate the human-escalation features only" | docs/PRODUCT-LATER.md §5 | 2026-07-13 | proposal |
| LP-34 | Later features proposed: AI feedback on uploaded mixes (E4), exam analytics, teacher/parent dashboards | PRODUCT-LATER.md §5 | 2026-07-13 | proposal |
| LP-35 | Stub notes announce future features: E2 "entraînement oral avec IA prévu"; E51 "assistant de cadrage de dossier et simulation de revues de production prévus"; E6 "chercheur de stages/alternances prévu" | src/data/courses/index.ts | 2026-07-13 | proposal |
| LP-36 | Draft syllabi for E1, E2, E52, E6 shown in UI as "brouillon — à valider par l'expert"; E52 least documented; bloc↔épreuve mappings are hypotheses "par similarité de nom" | docs/drafts/plans-cours-stubs.md; REVIEW-ME §6; src/data/courses/draftPlans.ts | 2026-07-16 | proposal (pending founder review) |
| LP-37 | Survey answers stored locally, "read by no one" | ASSUMPTIONS #11; PRODUCT-LATER §6 | 2026-07-13 | implementation fact (per docs) |
| LP-38 | Tests: 57 defined (gating 21, store 7, tutor unit 26, tutor live integration 3). Verified by running in a copy: 54 passed, 3 skipped (no API key). `tsc --noEmit` passed | src/lib/**/*.test.ts; my run 2026-10-21 | 2026-10-21 | implementation fact (verified by running) |
| LP-39 | `npm run build` failed in the audit sandbox only because `next/font` could not fetch Google Fonts (network); not a code error. Original docs say Vercel CI builds were "Ready" on 16 July and local builds OOM'd | my run; ASSUMPTIONS #15 | 2026-10-21 / 2026-07-16 | implementation fact (environment-limited) |
| LP-40 | Operations: built in autonomous long-running Claude Code missions ("Don't stop to ask"), parallel windows; "never run it while an unattended overnight mission is going (quota contention)" | Prompt l.11, l.93 | 2026-07-13 | founder brief |
| LP-41 | Dev machine: Windows user `C:\Users\iB_K\...`; builds hang inside Documents (OneDrive/Controlled Folder Access suspected); canonical repo later `C:\dev\tech-nest-web` | ASSUMPTIONS #13; REVIEW-ME §4.13 | 2026-07-13 | implementation fact (per docs) |
| LP-42 | Personal study documents kept in `/source`, never committed | .gitignore; commit 8c015de | 2026-07-16 | founder decision |
| LP-43 | People/roles: "le propriétaire du projet" (BTS Son graduate per REVIEW-ME) decides/validates; AI (Claude Code, "Claude Fable 5") builds and documents; ADR 0001 "à ratifier par le propriétaire du produit" | REVIEW-ME; ADR 0001; commit trailers | 2026-07-13/15 | founder statement (recorded) / inference |
| LP-44 | Risks noted: falsifiable client-side verification codes; spoofable progress sent to tutor; lexical recall gaps; QCM ≠ real exam (false confidence); legal disclaimer protection; Gemini behaviour untested vs Claude-tuned prompt | ASSUMPTIONS; ADR 0001/0002; REVIEW-ME §4 | 2026-07-13/15 | proposal (risk statements) |
| LP-45 | No live tutor run is evidenced in repo: integration tests skip without key; `check-tutor.mjs` exists but no committed result | src/lib/ai/tutor.integration.test.ts; scripts | 2026-07-15 | inference |
| LP-46 | Status statements: README/About say E3 "complet", others "en préparation"; UI "Version bêta" / tutor section "Nouveau". No "paused", "dead" or "abandoned" statement exists in this folder. Last original activity 2026-07-16 | README; a-propos; AuthForm; git log | 2026-07-13 → 07-16 | implementation fact / inference |
| LP-47 | Founder (per the audit brief) describes this as a current service vision under development during the website-creation phase | Task brief (not in repo) | 2026-10-21 | founder statement (external to folder) |

---

## C. Links to other Tekonest services

- **Audio Simulator / 3D simulator (likely what is elsewhere called simulator/TekPractice — that name does not appear here):**
  - Prompt l.2, l.9: work "must NOT touch `audio-sim/` — that's the other window"; l.37: "E4 … (the Audio Simulator will embed here later — leave a clear seam + a 'bientôt' state)"; l.92: "that's where the **Audio Engineering Simulator** plugs in, which is the whole moat." (2026-07-13)
  - `src/data/courses/index.ts` E4 stubNote: "Bientôt : le Simulateur Audio Tech Nest s'intégrera ici — câbler de vrais équipements (consoles, boîtiers de scène, patchbays) en 3D et apprendre des erreurs classiques (fantôme, larsen, N-1, horloge)." (2026-07-13)
  - `src/components/SimulatorEmbed.tsx`: probes `NEXT_PUBLIC_SIM_URL` default `https://sim.teknest.fr`, iframe "Simulateur audio 3D Tech Nest" if reachable, else "bientôt" card (commit 7bdecdf, 2026-07-16).
  - ASSUMPTIONS #14: "le simulateur vit dans `teknest-simu`" (Vercel) (2026-07-16). PRODUCT-LATER §3: simulator's own ProgressStore "shares this architecture, so a common backend can serve both" (2026-07-13).
- **Internship/jobs finder (possible link to a network/jobs service):** E6 stubNote "chercheur de stages/alternances prévu" (2026-07-13).
- **Events, equipment rental, production, network:** no mention in this folder.

---

## D. Conflicts / contradictions

1. **Test count:** README (2026-07-13) "28 tests"; actual 57 (54 run + 3 live-skipped) after tutor added 2026-07-13/15.
2. **Production domain:** README/ASSUMPTIONS #7 (2026-07-13) `tech-nest-web-gamma.vercel.app` vs ASSUMPTIONS #14 / code (2026-07-16) canonical `teknest.fr` (DNS then still on Wix). Scripts still default to the vercel.app URL.
3. **LLM provider:** ADR 0001 (2026-07-13) and PRODUCT-LATER table say Claude API / `claude-opus-4-8`; code still defaults to Anthropic-first; commit 5400811 (2026-07-15) says production locked to Gemini via env set out of band. ADR 0002 itself says Gemini must pass integration tests "avant de mettre Gemini en production" — no evidence they were run.
4. **Content validation:** REVIEW-ME §1–2 (2026-07-13) lists self-suspected errors (EBU R68 attribution, 344 m/s, etc.) and says annales PDFs were never opened; banner (2026-07-15) says the owner validated with "aucun point n'a nécessité de correction, y compris les suspicions". The EBU R68 attribution remains in code.
5. **Owner profile:** REVIEW-ME/commit 0b04de7 call the owner a "diplômé BTS Métiers du Son"; the audit brief describes Oscar as a current BTS Son student; About page says "par et pour des étudiants de la filière son". (Inference: either a different reviewer, a loose description, or inaccurate wording — unresolved.)
6. **E3 format:** this folder says E3 = PTES, coef 4, written 6 h (3h+3h). The attached project's own instructions (outside the repo) describe E3 / TES as coefficient 3, written 3 h. Not resolvable from this folder; could reflect E3 being split into parts. Flag for verification against the arrêté.
7. **Assumptions date:** ASSUMPTIONS.md header "11 July 2026" vs first commit 2026-07-13.
8. **Canonical source location:** Prompt says folder `Thechnest/tech-nest-web/`; ASSUMPTIONS #13 says source of truth `Documents\...\tech-nest-web` (build mirror `C:\Users\iB_K\tn-build`); REVIEW-ME §4.13 says canonical repo is now `C:\dev\tech-nest-web`.
9. **Simulator embed design:** PRODUCT-LATER §3 (2026-07-13) proposes E4 become "available" with a `{type:"sim"}` LessonBlock; actual (2026-07-16) is a page-level `SimulatorEmbed` on the still-stub E4 page.
10. **E2 scope:** code titles E2 "Anglais technique de l'audiovisuel" (2026-07-13); drafts (2026-07-16) say technical English is "plausible mais AUCUNE source ne le dit".
11. **Honesty positioning vs unverified claims:** landing says "Tech Nest est la seule plateforme dédiée au BTS … option Métiers du son" and course text claims notions are "récurrente dans les annales" — REVIEW-ME §1.b flags the latter as unsourced.
12. **Brand spelling:** Tech Nest / TechNest / Thechnest / teknest / technest vs current umbrella "Tekonest".

---

## E. Not inspected / not verified

- Live deployments (`tech-nest-web-gamma.vercel.app`, `teknest.fr`, `sim.teknest.fr`): unreachable from the audit sandbox (curl → no connection); current live status unknown.
- Vercel env (`TUTOR_PROVIDER`, API keys) and whether the tutor has ever answered live in production.
- Live tutor behaviour (integration tests skipped; no key used).
- Production build: failed locally only on Google Fonts fetch (sandbox network); not verified end-to-end. `tsc` and unit tests verified.
- Research inputs outside the folder (`TechNest_BTS-Son_Knowledge-Base.md`, `db_*.csv`, `TechNest_Competitive-Landscape.md`), the `/source` personal documents, and `../audio-sim` — not in this folder.
- Accuracy of physics content and référentiel facts (not independently checked against the arrêté/RNCP).
- Identity of the "propriétaire" who validated REVIEW-ME; whether the "Fable 5" model name is accurate.
- Visual rendering / Lighthouse scores (screenshots not committed).

---

## F. Plain-language summary

1. "Tech Nest" (domain teknest.fr) is a free online learning platform for students of the BTS Métiers de l'audiovisuel, option Son.
2. It copies Audinate's Dante Certification model: units → quiz → survey → final exam (≥ 70 %) → certificate valid 3 years with a verification code.
3. Its stated edge is mapping every course to the official épreuves, coefficients and RNCP37196 skill blocks, plus transparency about sources.
4. Only the E3 (physics/technology) course is built: 6 lessons with 60 quiz questions and a 24-question mock exam; the 6 other épreuves are "en préparation" shells, 4 with draft syllabi.
5. An index of 18 past papers (mostly official éduscol links) and a sources/about page exist.
6. A socratic AI tutor is coded (server route, lexical retrieval, citation checks), switchable between Claude and Gemini; production was reportedly set to Gemini to use its free tier.
7. Accounts, progress and certificates are browser-only mocks; Supabase is planned but not built.
8. The E4 page probes and would embed a separate 3D Audio Simulator (sim.teknest.fr) — framed as "the whole moat".
9. All code and docs were written by Claude Code in autonomous missions on 13–16 July 2026; the owner validated the E3 content on 15 July, though the AI's own flagged doubts remain in the text.
10. No activity after 16 July 2026 in this history; no paused/dead statement here; the founder now presents it as a current service under development; unit tests pass, live status unverified.
