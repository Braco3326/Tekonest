# Prompt — Tech Nest website base (3rd Claude Code window, Fable 5)
Run this in a **separate window, in this folder** (`Thechnest/tech-nest-web/`). It must NOT touch `audio-sim/` — that's the other window. Daytime mission (long autonomous, self-verifying).

> Model: the **Dante Certification Program** (Audinate) — free, tiered courses with prerequisites, self-paced units, an exam gating the certificate, certificate unlocked only after all units + survey, downloadable any time from a portal, 3-year validity, and industry credit.
> Our twist: **credits become BTS référentiel competencies.** No competitor does this.

```
ROLE
You are a senior full-stack engineer and product designer. Build the base of "Tech Nest" — an AI-integrated learning platform that helps students pass the French BTS Métiers de l'audiovisuel, option Métiers du Son. Work ONLY in this folder (tech-nest-web/). Do not touch ../audio-sim/.

This is a long autonomous mission. Don't stop to ask; make reasonable calls, log assumptions, keep going. Use sub-agents to parallelize independent work. Use vision to check your own screenshots against the design intent and iterate until it looks premium.

READ FIRST (real, verified source material — in the parent folder):
- ../TechNest_BTS-Son_Knowledge-Base.md  ← référentiel, épreuves E1–E6, coefficients, grille horaire, blocs RNCP, annales index
- ../db_epreuves_coefficients.csv, ../db_grille_horaire.csv, ../db_blocs_competences.csv, ../db_annales_index.csv
- ../TechNest_Competitive-Landscape.md   ← positioning, what competitors lack, how to differentiate
Everything you build must be consistent with these. Do NOT invent référentiel facts — if it's not in those files, don't claim it.

STACK
Next.js (App Router) + TypeScript + Tailwind. Deploy to Vercel. SEO matters (competitors win on SEO): proper metadata, semantic HTML, French-language UI, server-rendered course/annales pages.

THE MODEL (adapted from Dante Certification)
- Courses are FREE and self-paced.
- Each course = ordered UNITS (lesson + quiz) → a course SURVEY → a final EXAM.
- Gating rule (Dante's): the exam unlocks only when ALL units and the survey are complete. Passing the exam (≥70%) issues the CERTIFICATE.
- Certificates live in a portal ("Mes certificats") — the user can log back in and re-download any time. Validity: 3 years, with a unique verification code.
- Courses have prerequisites and form a visible learning path.
- IMPORTANT: replicate the MODEL, not Dante's visual identity or copy. Tech Nest gets its own brand and its own words.

THE DIFFERENTIATOR — map everything to the official BTS référentiel
Every course maps to an épreuve (E1–E6) and a bloc de compétences (RNCP37196 BC01–BC04), with the real coefficient. The certificate states which competencies the student has demonstrated. That's the thing no competitor offers.

COURSE CATALOG (metadata from the CSVs — correct coefficients, forms, durations)
- E1 — Culture audiovisuelle et artistique (coef 2, écrit 4h) — STUB
- E2 — Anglais (coef 1, oral 45min) — STUB
- E3 — Physique et technique des équipements et supports / PTES (coef 4, écrit 6h) — ★ BUILD THIS ONE FOR REAL
- E4 — Techniques et mise en œuvre (coef 4, pratique) — STUB (the Audio Simulator will embed here later — leave a clear seam + a "bientôt" state)
- E51 — Projet à caractère industriel (coef 4, oral) — STUB
- E52 — Environnement économique et juridique (coef 1, oral) — STUB
- E6 — Situation en milieu professionnel (coef 1, oral) — STUB
Stubs = real metadata + course shell + "en préparation", NOT fake lessons.

★ THE REAL COURSE — E3 / PTES (build fully)
It's the only Son-specific épreuve with public official annales, so the content is verifiable. Build units covering the PTES domains, each with a lesson + quiz:
1. Acoustique — propagation, niveaux (dB SPL/dBu/dBFS), psychoacoustique
2. Électricité & électronique audio — impédance, niveaux, symétrie/asymétrie, alimentation fantôme +48V
3. Transducteurs — micros (dynamique / condensateur / ruban), directivité; haut-parleurs
4. Audionumérique — échantillonnage, quantification, AES3, MADI, AoIP (Dante/AES67), wordclock, latence
5. Traitement du signal — EQ, dynamique/compression, loudness EBU R128
6. Supports & équipements — chaînes de production son
Each unit: a clear lesson (prose + diagrams), worked examples, then a quiz. Then the course survey, then a final exam in the real format (annales-style questions).

ANNALES LIBRARY (a real, unique feature — use ../db_annales_index.csv)
A dedicated page listing every official past paper with its direct link (E3/PTES Son 2017–2025 from éduscol, plus the shared CAA papers and sujets zéro). Mark official vs third-party. This alone beats every competitor.

TRUST & POSITIONING (from the landscape research)
Competitors make unverifiable "100% de réussite" claims. We do the opposite: cite sources, link the official texts, state clearly "conforme au référentiel officiel (arrêté du 4 juin 2013, RNCP37196)". Transparency IS the differentiator. Free core, like Dante.

AUTH & PERSISTENCE (mock now, real later — architect the seam)
- Mock auth: signup/login (name + email), stored locally. It must LOOK and FEEL like the real portal (profile, "Mes certificats").
- CRITICAL: put every auth and data call behind swappable interfaces — `AuthProvider` and `ProgressStore` (localStorage implementations now). A real backend (e.g. Supabase) must drop in later with ZERO changes to pages/components. Document the seams in docs/PRODUCT-LATER.md.

CERTIFICATE
Generated client-side, downloadable/printable (PDF). Contains: student name, course, épreuve + coefficient, bloc(s) de compétences demonstrated, date, 3-year validity, unique verification code, Tech Nest branding. Re-downloadable from the portal.

PAGES TO BUILD
Landing (value prop + why Tech Nest exists) · Course catalog with the learning path · Course detail · Unit/lesson · Quiz · Survey · Exam · Results · Certificate · Portal "Mes certificats" · Profile · Annales library · About/sources page (cite the official texts).

DESIGN
Create Tech Nest's OWN visual identity — do not imitate Dante's. Studio-grade, precise, dark-leaning, professional (this is pro-audio, not a kids' app). Define it as tokens (color, type, spacing, motion) in one place and document it in docs/design-system.md. It should look like a product a professional would trust.

QUALITY
- Tests for the gating logic (units+survey complete → exam unlocks; ≥70% → certificate) and for progress persistence.
- Lighthouse-decent, accessible, responsive.
- Deploy to Vercel and give me the URL.

BUILD ORDER
1. Scaffold + design system + tokens.
2. Data layer: course/unit/quiz content as typed data files, seeded from the research docs (content is DATA, not hardcoded in components — same rule as the simulator).
3. AuthProvider + ProgressStore interfaces (localStorage impls).
4. Core pages + the learning path + gating logic.
5. The real E3/PTES course content + exam.
6. Annales library from the CSV.
7. Certificate generation + portal.
8. Polish with vision checks, tests, deploy.
9. docs/PRODUCT-LATER.md (how to swap in a real backend, and where the Audio Simulator embeds into E4).

Finish with: the Vercel URL, screenshots, what's real vs stubbed, and every assumption you made.
```

## Notes
- **Why E3/PTES is the real course:** it's coefficient 4, specific to the Son option, and the *only* épreuve with official public annales (2017–2025) — so the content is verifiable, not invented. E4/E51 (the practical ones) are deliberately stubbed: that's where the **Audio Engineering Simulator** plugs in, which is the whole moat.
- **Window discipline:** this runs in its own folder. Never run this and the audio-sim window on the same repo, and never run it while an unattended overnight mission is going (quota contention).
