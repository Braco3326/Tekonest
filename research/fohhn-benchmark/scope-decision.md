# Scope decision memo: should TekPractice add room acoustics and speaker placement?

- **For:** Oscar (decides).
- **By:** tekinspi, 2026-10-24.
- **Challenged by:** the expert council (4 experts + a neutral synthesiser + a validator), see `council/`.
- **Status:** a recommendation. **Nothing is built or merged.**

## 1. The question

Today TekPractice teaches *wiring*: connectors, signals, rules R1–R8, and levels A1–D1. On the feature branch it also has a walkable 3D world with procedural rooms and gear placement. Fohhn's tools show a mature pattern for *designing in a room*: speaker placement and aim, listener zones, and immutable calculated "snapshots" that can be compared. Should TekPractice grow in that direction, and how far?

## 2. Options

| | **A. No** | **B. Essais, no acoustics** | **C. Staged acoustics** |
|---|---|---|---|
| **What ships** | Nothing new | Phase 1: freeze, compare and restore **setups** (placement + wiring + room) as "Essais", built around evidence: the student's written prediction, frozen R1–R8 results and level state, a note, a `.essai.json` export and a read-only teacher page. It also fixes the untested `SavedRig` persistence | B, then phase 2 at fidelity **(a)/(a)+**: nominal coverage footprints, aim and tilt, the Δd/c **arrival timeline**, and **relative** direct level. **(b)** only after a new decision; **(c)** not planned |
| **Cost (1 developer, rough)** | 0 | ~1.5–2 weeks (store, fingerprint, export, teacher page, tests, small panel) | B + ~2–3 weeks for phase 2, plus data review by Oscar (room points, speaker coverage numbers) |
| **Learning value** | Wiring only | The **method**: one change at a time, predict, then compare, keeping the evidence. That supports oral and practical exams | Method **plus** competencies `set-delay-and-fill-speakers` (P1), coverage and B1 calculations (−6 dB per doubling of direct sound), and public-exposure awareness (B8) |
| **Main risks** | Leaves the acoustics topics of the référentiel unpractised | Low. Exam integrity (forgeable exports) is handled in ADR-0011 | Students over-trusting numbers; performance on school laptops; speaker-data licensing; scope creep into a pro tool |
| **Acoustic honesty** | n/a | No acoustic numbers at all | Relative values only, with a fidelity chip, hatched "interférences non modélisées", no STI value, and no absolute dB next to legal limits |

## 3. Recommendation (council, 80 % posterior confidence)

**Option C, staged and capped at fidelity (a)+ for now. Phase 1 = B, built around evidence.** Fidelity (b) is **not committed**: it is a separate future decision. The key reason:
- The BTS skills in play are Δd/c, the coverage angle, −6 dB per doubling of direct sound, and the most exposed point.
- They need only **geometry, timing and relative level**.
- Everything (b) would add has **no validated error bound**: absolute drive, a statistical total level, A-weighting.

| Phase | Entry gate | Exit gate |
|---|---|---|
| **0. Decide** | This memo | Oscar's answers to §5; ADR-0011 accepted |
| **1. B, evidence-first** | ADR-0011 (embed by value, quarantine, byte budget, exam policy, naming) | Write-once store; canonical `fp1` fingerprint re-checked on load; quarantine; global byte budget with every failure visible; `rigs.v2` key plus the clobber test; export → import round-trip; teacher page; live autosave; "Montage actuel" row; layout checked at 1366 × 768 |
| **2. Fidelity (a)/(a)+** | Phase 1 exited; directivity/Lw/DI written in ADR-0011; **overlay ≤ 10 % frame-time on a real school laptop** | Footprint, aim and tilt (stepper), arrival timeline, relative level, hatched overlap; golden fixtures per `engineVersion`; S1 and S2 playable |
| **3. Fidelity (b), relative only** | A **new decision** after a classroom trial **and** a measurement campaign (≥ 5 points, with provenance) | Error bounds only for the measured room |

**Rejected:**
- **Option A:** all four experts found standalone value in B.
- **"C up to (b) now":** that was my pre-council draft. It was withdrawn after the council found unsupported claims ("±3 dB"), a scenario that taught a misconception (a delay credited with a level gain), and absolute dB(A) next to the 102 dB(A) limit.

## 4. Dissent worth noting

- **Hélène (audio):** "Verification is not validation." Hashes and tests prove the *same* number comes back every time, not that it is right. Even relative (b) maps borrow credibility until a measurement campaign exists.
- **Karim (pedagogy):** labels don't protect novices. Honesty must come from what is shown (hatching, relative values, no STI), not from captions.
- **Tomás (data):** an exported file can be forged. It is a trace, not exam proof.
- **Lena (3D):** her gate for (b) adds a real-laptop performance figure; she is the only expert not requiring a measurement campaign.
- **Validator:** the four confidence scores rose 3–5 points while converging (mild conformity), and the 80 % does not price in the two open items below.

## 5. Decisions needed from Oscar

| # | Decision | Options | Council lean |
|---|---|---|---|
| D1 | **Scope** | A / B / C capped at (a)+ | C capped at (a)+, with B first |
| D2 | **Exam mode** (contested, C2) | Essais **on** as the examiner's method trail, with overlays, coach and targets off (Karim) / **off** unless a level declares them (Lena) | Split. Either way, persist `ExamScore` first |
| D3 | **Storage full** (C5) | "Exporter puis archiver" prompt, with a hard stop only at the absolute budget / a hard stop at about 150 Essais | Prompt first |
| D4 | **Learner word** | "Essai" (recommended) / "Version" / "Prise" | "Essai"; `Trial` in code; "snapshot" banned |
| D5 | **Critical-distance ring at (a)+** (C7) | Yes, illustrative (Hélène) / only with (b) (Karim r1) | Yes, illustrative, so the −6 dB quiz isn't misread |
| D6 | **Room data review** | Approve adding named listener points and a reference point to the 32 TEK Brain rooms (all are still `needs-oscar-review`) | Needed for phase 2 |
| D7 | **Branch** | Build phase 1 on `feature/tekpractice-explore-controls`, or wait for it to merge into `main` | Wait for the merge (or rebase) |
| D8 | **Delete the Fohhn audit copy** | The project "Audit copy - Hall (tekinspi, delete me)" in the Fohhn account, which also holds a test snapshot "Audit run A" and a draft "PS-852" | Your call; nothing else in the account was changed |

## 6. Questions the evidence could not answer (ranked by how much each would change the design)

1. **Does an Essai-based method actually improve learning in a BTS class?** (It decides whether phase 2 is worth it; a classroom trial is needed.)
2. **Frame rate on real school hardware** with rooms plus an overlay. (It could force a 2D top view instead of a 3D overlay; only headless 13–25 fps is known.)
3. **Exam policy and integrity.** (It changes the data model: signing, server storage, or none.)
4. **The precedence offset and window for the delay scenario.** (It sets S1's success criterion; currently unsourced, so a TEK Brain source must come first.)
5. **Decree 2017-1244 measurement clause** (reference point, offset; Légifrance check). (It changes S3's wording.)
6. **The real size of an Essai in localStorage.** (It sets the budget; 3 KB is an estimate.)
7. **Whether Designer stores wall materials per snapshot,** and what happens to drafts when a project closes. (A minor influence on our model, which embeds by value anyway.)
8. **The Optimizer's measurement and EQ UI** (not reachable in automation). (It only matters if an EQ exercise is added later; Oscar on a phone could capture it.)
9. **Whether the QSC K12.2 datasheet publishes a 1 W sensitivity.** (It confirms the headroom-based drive design.)
10. **Oscar's 9 screenshots** were not received. (Low impact: the same views were re-captured live.)
