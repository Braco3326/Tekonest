# TekPractice (3D sound-equipment simulator) — service vision

| | |
| --- | --- |
| **Status** | Current vision · **under development** (founder, 21 Oct 2026). Playable code exists locally; last code change 19 Jul 2026 |
| **Folder** | [`tekpractice-sim/`](../../tekpractice-sim/) (Vite + Babylon.js app, imported from repo `Technest-Sim`) · early copies in [`archive/`](../../archive/) |
| **Names used** | "TekPractice" (product, page title), "audio-sim" (package/repo), "Audio Engineering Simulator", "Audio Sim" (early builds) |
| **Source dates** | 7 Jul – 19 Jul 2026 · 21 Oct 2026 (founder status) |
| **Evidence IDs** | `TP-xx` [TekPractice register](../evidence/tekpractice-register.md) · `LT-xx` [July 2026 register](../evidence/thechnest-2026-07-register.md) · `FB-xx` [founder briefs](../05-sources-and-evidence.md#founder-briefs-chat) |

Labels: **[F]** founder · **[FB]** founder brief · **[P]** proposal · **[R]** research · **[E]** estimate · **[I]** implementation fact · **[Inf]** inference · **[Rec]** Claude's recommendation.

---

## 1. What it is and why it exists

- A browser-based 3D "reactive smart sound simulation". You wire real professional audio gear (mics, consoles, stageboxes, codecs, patchbays), and a rules engine explains each mistake **[FB]** (TP-01, LT-02, LT-12).
- It covers four domains: live sound, radio/broadcast, remote duplex (N-1) and post-production **[FB]** (TP-01).
- **How it started.** It began as the founder's personal revision tool: "pas d'auth, pas de paiement" **[FB]** (TP-02, LT-08). His success test: "je dois pouvoir câbler un studio radio self-op et un N-1 correct sans notes" **[FB]** (TP-03).
- **How it grew.** By 16–17 Jul 2026 it was framed as the flagship and "moat" of the BTS Son offer **[P]** (LT-02, LT-07, TP-05).
- **Status.** The founder states it is a current service vision under development **[FB]** (FB-04).

## 2. Who it is for, and what it answers

- **Who.** BTS Métiers du son students, illustrated by the fictional persona "Nadia, 19, first year, terrified of the physics (E3) and the practical exam (E4)" **[P]** (TP-05).
- **What it answers.** Practical wiring skills are assessed in E4/E51, and there are no public papers to practise them **[R]** (LT-60). Videos and PDFs "didn't stick" **[P]** (TP-06).

## 3. The experience

- **Graded levels [I]** (TP-25):
  - A1 First PA;
  - B1 Radio studio;
  - C1 Remote duplex on N-1;
  - D1 Post room with house clock.
- **Sandbox.** A free-wiring area unlocked by mastery, with saved rigs **[I]** (TP-35).
- **Exam mode.** Timed, no hints, scored out of 20 **[I]** (TP-29).
- **Readiness dashboard.** Shows exam readiness by épreuve and skill block, "never vanity", with no XP **[I]/[P]** (TP-09, TP-27).
- **Mentor layer.** "Conseils d'Oscar", the founder's own tips, plus an optional AI "Pourquoi ?" coach **[P]/[I]** (TP-08, TP-32).
- **Interaction.** "Focus & Patch": finding the right port on a real panel *is* the exam skill **[P]/[I]** (TP-36, TP-37).
- **Planned, not built [P]** (LT-14, TP-40):
  - a Learn mode with micro-lessons from the learning platform ("Tekskol");
  - a community of graduates.

## 4. Distinct identity and value

- The July research found no competitor offering hands-on practice with real gear for BTS Son **[R]** (LT-49 white space C, LP-09).
- Look: calm, "gallery-white", designed to lower exam anxiety **[P]** (LT-18).
- The founder's own voice is meant as the human trust layer **[P]** (LT-22).

## 5. What exists today vs what is proposed

| Item | State | Evidence |
| --- | --- | --- |
| 4 levels, 7 room presets (3 with real 3D rooms), sandbox, exam mode, onboarding, 2D fallback for weak PCs | **Built** | TP-25, TP-26, TP-30, TP-38 **[I]** |
| Equipment catalogue: 24 real devices, 8 rules | Built ("teaching-simplified") | TP-23, TP-48 **[I]** |
| Unit tests 164/164, catalogue check, production build | **Pass (re-run 21 Oct 2026)**; browser e2e tests not run | TP-49, TP-50 **[I]** |
| AI coach (Anthropic) | Code present; off unless the user supplies their own key | TP-32, TP-33 **[I]** |
| 13 "Conseils d'Oscar" tips | **All still placeholders** | TP-31 **[I]** |
| Live deployment (`www.teknest.fr`) | Served a stale build on 17 Jul 2026; fix not confirmed | TP-15, TP-16 **[R]** |
| Learn mode, Set Editor, patchbay normalling | Not built (spec or proposal only) | TP-39–TP-41 **[P]** |
| 3D models | Mostly CC-BY downloads still showing brand logos; must be de-branded before commercial use | TP-42–TP-44 **[I]/[R]** |

## 6. What it would require

- **People.**
  - The founder as content reviewer and mentor voice (TP-12, TP-31).
  - 3D asset work (TP-42).
  - Engineering, done in July by autonomous AI runs (TP-52) **[I]/[P]**.
- **Technology.**
  - Hosting: the Vercel project must be reconnected **[R]** (TP-15).
  - An AI provider budget, or a server proxy instead of keys in the browser **[P]/[Inf]** (TP-60).
- **Assets and rights.** Licensing and trademark clearance before any commercial launch **[R]/[P]** (TP-43, LT-67).

## 7. How it might sustain itself

- **The only discussed model is a proposal [P]** (TP-10, LT-19, LT-20): "free = one room + a few levels; subscription = full sandbox + tests + analytics".
- **Benchmark.** About €7–14 a month across the market **[R]/[E]** (LT-51).
- **No pricing decision is recorded [Inf].**

## 8. Decisions, dependencies, risks, unknowns

- **Open founder decisions** recorded in July:
  - asset licence floor (CC0 only, or CC0 + CC-BY) and AI image-to-3D (LT-68);
  - patchbay normalling, ADR-0002 (TP-39);
  - a fix to the QL1 connector (TP-47).
- **Dependency.** Close links with the learning platform:
  - an embed on the E4 page;
  - micro-lessons, a shared design system, and possibly a shared domain and progress backend (see [service map](../02-service-map.md)).
- **Risks.**
  - Unverified readiness coefficients: E3/E4/E51 = 4 each, from a CSV absent from the repo (TP-28).
  - "Data-only levels" is promised but not true: levels are hard-coded (TP-22).
  - A 5 MB 3D bundle on low-end laptops (TP-58).
- **Naming conflict.** "Not a game" (15 Jul) vs "The Educative Game" (16 Jul) **[F] vs [P]** (LT-12, LT-13).
- **Ownership.** A July prompt mentions reconciling the catalogue with another person's "v0.2" (TP-54). Ownership and authorship should be confirmed **[Inf]**.

## 9. Claude's recommendations (not founder decisions)

- **[Rec]** Fix the deployment first, so there is one known-good public build, then write the 13 tips. They are the founder-only piece no AI can replace.
- **[Rec]** Resolve asset licensing before showing it beyond personal or school use.

## 10. Sources

[`tekpractice-sim/CLAUDE.md`](../../tekpractice-sim/CLAUDE.md) · [`docs/VISION_TekPractice-StudentJourney.md`](../../tekpractice-sim/docs/VISION_TekPractice-StudentJourney.md) · [`docs/NIGHT_LOG.md`](../../tekpractice-sim/docs/NIGHT_LOG.md) · [`docs/REVIEW-ME.md`](../../tekpractice-sim/docs/REVIEW-ME.md) · [`docs/adr/`](../../tekpractice-sim/docs/adr/) · [`equipment-catalog.md`](../../tekpractice-sim/equipment-catalog.md) · July plans: [`VISION_TekPractice-Game.md`](../../archive/thechnest-local-2026-07/VISION_TekPractice-Game.md), [`TEKNEST-MASTER-BUILD.md`](../../archive/thechnest-local-2026-07/TEKNEST-MASTER-BUILD.md), [`TEKNEST-FINAL-REPORT.md`](../../archive/thechnest-local-2026-07/TEKNEST-FINAL-REPORT.md), [`MASTER-PLAN.md`](../../archive/thechnest-local-2026-07/MASTER-PLAN.md).
