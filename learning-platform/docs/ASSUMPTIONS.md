# Assumptions log (autonomous build, 11 July 2026)

Decisions taken without asking, with rationale. Reverse any of them cheaply —
they are all localized.

1. **Unit quiz pass threshold = 70 %** (`UNIT_QUIZ_PASS` in
   `src/lib/progress/model.ts`). The spec fixes 70 % only for the final exam;
   using the same bar for unit quizzes keeps one mental rule. Retries unlimited,
   best score kept.
2. **Unit completion = lesson viewed + quiz passed.** Lesson is auto-marked
   read when a logged-in user opens it (frictionless; the quiz is the real gate).
3. **Learning-path prerequisites are a pedagogical recommendation, not a hard
   lock**: E3 → E4 → E51 chain; E1/E2/E52/E6 independent. Stubs can't be started
   anyway; the path shows "prérequis conseillé". Rationale: only one course is
   real today, hard-locking would add friction with no benefit.
4. **Exam format**: the real E3 is a 6 h written problem-solving paper; a
   web QCM cannot replicate it. The final exam is 24 annales-style MCQs and the
   exam page says so explicitly (honesty-first positioning). Unlimited attempts,
   best score counts.
5. **Certificate PDF via browser print dialog** (print-styled light document),
   not a PDF lib — zero dependencies, crisp output, re-downloadable forever from
   the portal. Assumption: acceptable for the mock stage.
6. **Verification codes** `TN-XXXX-XXXX` generated client-side with
   `Math.random` — fine for mock; swap for server CSPRNG later (noted in
   PRODUCT-LATER).
7. **Domain**: metadata/sitemap use the deployed production URL
   `https://tech-nest-web-gamma.vercel.app` until a real domain exists
   (update `layout.tsx`, `sitemap.ts`, `robots.ts` when one does).
8. **Course catalog design**: one course per épreuve including E51/E52 as
   separate courses (they are separate unités with separate coefficients in the
   règlement).
9. **French UI with vouvoiement**; "épreuve/unité/enquête/examen blanc"
   vocabulary. Certificates state they are independent pedagogical attestations,
   not ministry diplomas (legal safety).
10. **Content authorship**: units 2–6 + exam drafted by parallel sub-agents
    against a locked schema and the unit-1 exemplar, then reviewed; all
    référentiel facts (coefficients, durées, formes, blocs) come only from the
    seeded CSVs.
11. **Survey**: 5 scale questions (required) + 2 free-text (optional) — the
    Dante-style completion gate. Stored locally; nobody reads it yet (noted).
12. **Scaffold**: `create-next-app` failed on a corrupted npx cache; the app was
    scaffolded by hand (package.json pins Next 15 / React 19 / Tailwind 4 /
    Vitest 3). Behavior identical.
13. **Builds must run outside `Documents`.** `next build` (and Vitest at exit)
    hangs indefinitely inside `C:\Users\iB_K\Documents\...` (the same FS quirk
    that broke `mkdir` and Git Bash npm during scaffolding — likely OneDrive /
    Controlled Folder Access interference). Workaround used: mirror the project
    to `C:\Users\iB_K\tn-build` (robocopy, excluding `node_modules`/`.next`),
    build/test/deploy from there, and copy edited sources back. Source of truth
    remains `Documents\...\tech-nest-web`. Vercel builds remotely, so this only
    affects local builds.
14. **Canonical SEO = `https://teknest.fr`** (nuit du 16 juillet, sur instruction
    du propriétaire). Le DNS du domaine pointe encore vers Wix (page d'erreur) :
    tant qu'il n'est pas raccordé à Vercel, les canonicals/sitemap référencent
    un domaine pas encore servi — assumé, l'autorité SEO se consolidera dès le
    raccordement. Le projet Vercel a été déplacé par le propriétaire dans la
    team `teknest` (production : teknest.fr ; le simulateur vit dans
    `teknest-simu`).
15. **Nuit du 16 juillet — builds locaux impossibles** (OOM machine : RAM
    saturée par d'autres applications). Gates locales = tsc + vitest ;
    build faisant foi = CI Vercel (tous les commits de la nuit : Ready).
    Scores Lighthouse « après » à re-mesurer dès que la machine le permet.
