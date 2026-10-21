# BTS Son learning platform — service vision

| | |
| --- | --- |
| **Status** | Current vision · **under development** (founder, 21 Oct 2026). Code exists; last code change 16 Jul 2026 |
| **Folder** | [`learning-platform/`](../../learning-platform/) (Next.js app, imported from repo `Technest`) |
| **Names used** | "Tech Nest" (site UI and logo), "Tekskol" (July plans: the theory site/school of Teknest), domain `teknest.fr` |
| **Source dates** | 7 Jul – 19 Jul 2026 (research, code, plans) · 21 Oct 2026 (founder status) |
| **Evidence IDs** | `LP-xx` [learning register](../evidence/learning-platform-register.md) · `LT-xx` [July 2026 register](../evidence/thechnest-2026-07-register.md) · `FB-xx` [founder briefs](../05-sources-and-evidence.md#founder-briefs-chat) |

Labels: **[F]** founder · **[FB]** founder brief · **[P]** proposal · **[R]** research · **[E]** estimate · **[I]** implementation fact · **[Inf]** inference · **[Rec]** Claude's recommendation.

---

## 1. What it is and why it exists

- An AI-integrated learning platform to help students pass the French **BTS Métiers de l'audiovisuel, option Métiers du Son** **[FB]** (LP-01, LT-01).
- Its July goal was to be "#1 at making students succeed" **[FB]** (LT-01).
- **Model.** It copies the Dante Certification programme: free courses, units with quizzes, an unlocked final exam, then a certificate. Its twist is that each course maps to a BTS épreuve and an official RNCP37196 skill block **[FB]** (LP-02, LP-03).
- **Status.** The founder states it is a current service vision under development during the website-creation phase **[FB]** (FB-04).
- **July pause.** On 17–18 Jul 2026 the July plans "paused" the site "until TekPractice is validated" (LT-03, LT-04). That was a sequencing decision recorded at that date, not an abandonment **[Inf]**.

## 2. Who it is for, and what it answers

- **Who.** Students of BTS MAV option Son, first and second year **[FB]** (LP-06).
- **Problem as framed in July [R]** (LT-48–LT-50):
  - no platform covers option Son in depth;
  - generic revision sites treat the five BTS options together;
  - the closest competitor (btsmav.fr) is generic and has no AI.
- These findings come from July 2026 desk research, not from student interviews (LT-57 lists interviews as "to do") **[Inf]**.

## 3. The experience

- **Course flow.** Lesson units with quizzes → survey → mock exam (pass ≥ 70 %) → a certificate valid 3 years with a verification code. The certificate is an "attestation pédagogique indépendante", not a diploma **[I]** (LP-16, LP-17).
- **Past papers.** An annales library of links to official past papers **[I]** (LP-21).
- **AI tutor.** A socratic tutor that never gives the answer outright and cites its sources **[I]** (LP-22).
- **Simulator link.** The 3D simulator (TekPractice) would plug into the E4 practical course **[P]/[I]** (LP-09; see [TekPractice](tekpractice.md)).

## 4. Distinct identity and value

- **Positioning [FB]/[R]** (LP-03, LP-04, LT-49):
  - Son-specific and aligned with the official référentiel;
  - honest about its sources;
  - AI that "teaches, doesn't cheat".
- **Design.** The July build uses a dark "studio-grade" design (LP-32). The later plan wants one white design system shared with the game (LT-28, see conflicts) **[I]/[P]**.

## 5. What exists today vs what is proposed

| Item | State | Evidence |
| --- | --- | --- |
| E3 (physics/technology) course: 6 units, 60 quiz questions, 24-question mock exam | **Built** | LP-10, LP-11 **[I]** |
| Other 6 épreuves | Stubs ("en préparation"); 4 have draft syllabi awaiting review | LP-10, LP-36 **[I]/[P]** |
| Annales library (18 entries, links only) | Built | LP-21 **[I]** |
| Certificates + verification page | Built, but local to the browser only | LP-17, LP-18 **[I]** |
| Accounts and progress | Mock (browser localStorage). Supabase backend proposed, not built | LP-18, LP-19 **[I]/[P]** |
| AI tutor (Claude or Gemini, switchable) | Code present; live use not evidenced | LP-22, LP-23, LP-45 **[I]/[Inf]** |
| Unit tests | 54 pass, 3 live tests skipped (no key); type-check passes. Re-run on 21 Oct 2026 | LP-38 **[I]** |
| Production build | Not verified here (Google Fonts fetch blocked in sandbox) | LP-39 **[I]** |
| Live site | URLs in code (`tech-nest-web-gamma.vercel.app`, `teknest.fr`), **current state unknown** | LP-29, LP-30 |
| Content accuracy | AI-written from model knowledge; recorded as validated by "the project owner" on 15 Jul 2026 **[F, as recorded]**, yet errors the AI flagged itself remain (see C-17) | LP-12, LP-13, LP-14 **[I]** |

## 6. What it would require

- **People.**
  - A subject-matter reviewer for every course, which the July docs assign to the founder (LT-27).
  - Content writers.
  - Someone to run accounts and support **[P]/[Inf]**.
- **Technology.**
  - Real accounts and progress storage (Supabase is proposed) **[P]** (LP-19).
  - An AI API key and budget **[I]** (LP-23).
  - Hosting on Vercel **[I]** (LP-29).
- **Content.**
  - Six more courses.
  - Exam-format practice beyond multiple-choice. The mock exam is MCQ, while the real E3 is a written paper **[I]** (LP-15).
- **Compliance [P]** (LT-57, LP-27):
  - GDPR, since some users may be minors;
  - certificate wording;
  - privacy of tutor conversations.

## 7. How it might sustain itself

- **No pricing decision is recorded [Inf].**
- Ideas in the sources disagree (LT conflict 7):
  - courses stay free, with a paid tier only for human review and coaching **[P]** (LP-33);
  - market benchmark of about €7–14 a month **[R]/[E]** (LT-51);
  - B2B deals with schools/CFAs, and tax-credit (CESU/SAP) routes **[R]/[P]** (LT-52);
  - free taster then subscription, proposed for the simulator **[P]** (LT-19).

## 8. Decisions, dependencies, risks, unknowns

- **Decision.** Is this the main "Tekonest website", or one service under it? The founder mentions a website-creation phase (FB-04), but no doc defines that website **[Inf]**.
- **Decision.** Which name: Tech Nest, Tekskol, or a Tekonest sub-name **[Inf]**.
- **Decision.** Which domain:
  - `technest.fr` was planned on 15 Jul **[F]** (LT-06);
  - `teknest.fr` was used for both the site and the simulator at different dates **[I]** (LT conflict 5).
- **Decision.** Free or paid, and design direction (dark vs white) **[Inf]**.
- **Risks.**
  - Unverified technical content.
  - Client-side certificates are easy to forge (LP-44).
  - Unverified référentiel facts: E3 coefficient 4 and 6 h in this folder, vs coefficient 3 and 3 h in another description of the E3/TES part; possibly both right if E3 has parts (open conflict C-16) **[I]** (LP conflict 6).
- **Unknown.**
  - Whether the live tutor ever answered in production.
  - Whether the deployed site is still up.
  - Who "the project owner (diplômé BTS Métiers du Son)" who validated the content is (LP-13, LP conflict 5).
- **Ownership.** A July status file says the platform "started as" another person's vision (LT-26). Ownership of the idea and code should be confirmed **[Inf]**.

## 9. Claude's recommendations (not founder decisions)

- **[Rec]** Re-verify E3 content and référentiel figures against the official arrêté before showing the platform to students.
- **[Rec]** Decide the site's relationship to the Tekonest umbrella (main site vs one service) before choosing domain and name.

## 10. Sources

[`learning-platform/README.md`](../../learning-platform/README.md) · [`docs/Prompt-TechNest-Website-Base.md`](../../learning-platform/docs/Prompt-TechNest-Website-Base.md) · [`docs/REVIEW-ME.md`](../../learning-platform/docs/REVIEW-ME.md) · [`docs/PRODUCT-LATER.md`](../../learning-platform/docs/PRODUCT-LATER.md) · [`docs/ASSUMPTIONS.md`](../../learning-platform/docs/ASSUMPTIONS.md) · [`docs/adr/`](../../learning-platform/docs/adr/) · July research: [`TechNest_BTS-Son_Knowledge-Base.md`](../../archive/thechnest-local-2026-07/TechNest_BTS-Son_Knowledge-Base.md), [`TechNest_Competitive-Landscape.md`](../../archive/thechnest-local-2026-07/TechNest_Competitive-Landscape.md), [`STATUS.md`](../../archive/thechnest-local-2026-07/STATUS.md), [`TEKNEST-FINAL-REPORT.md`](../../archive/thechnest-local-2026-07/TEKNEST-FINAL-REPORT.md).
