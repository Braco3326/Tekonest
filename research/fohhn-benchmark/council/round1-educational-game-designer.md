# Round 1: educational game designer (Karim Benali)

**Persona.** I am a learning designer and taught BTS MAV option Son for 12 years, 6 of them as an E3/E4 examiner. Now I design serious games for vocational training.
My first question is always: which competency, and how would a teacher see that it was learned?

## Findings

| # | Claim (file§) | Verdict | Why | Fix |
|---|---|---|---|---|
| 1 | S1 success criterion "back-row spread improved by ≥ 3 dB vs Essai A" (brief §1 S1) | **Wrong, teaches a misconception** | With fidelity (b)'s incoherent energy sum, delay does not change level at all. The wireframe makes it worse: A is "sans retard" and B is "rappels retardés", but the student's note says B *adds* the delays. The +3,9 dB comes from the added speakers, and the label credits the delay. Students learn "le retard rend plus fort". | Split S1: Essai A = delays placed, 0 ms; Essai B = only the delay changed. Judge B on **arrival order and gap** at the overlap point (main first, delay 5–15 ms behind), not on level. |
| 2 | S1 maps to `set-delay-and-fill-speakers` (P1) | Partly | Curriculum criteria: Δd/c *noted* and then *confirmed by measurement*; the image stays towards the stage. The brief's own S1 feedback lists arrival times per point, but the wireframe shows only a dB(A) map, so the key evidence is missing from the UI. | Require the Δd/c calculation in the note **before** the first Évaluer. Add an "arrivées (ms)" view per named point. Take localisation as "main arrives first, delay within the Haas window". |
| 3 | S1 "±2 ms of Δd/c + offset" (brief §1) | Unfair as written | The offset is "a few ms" and never fixed, so two teachers would grade it differently. Numeric feedback also lets students hill-climb the delay by trial and error without calculating. | State the offset per scenario (e.g. 10 ms ± 5). Cap evaluations, or grade the noted value written before evaluation. |
| 4 | S2 maps to `run-basic-pa-system-check` (D7) | Weak | D7's success criteria are each speaker sounding alone on the right way, and polarity. S2 assesses neither; coverage only appears in the procedure. | Map S2 to the concept `coverage-angle` (D7) plus B1. Or add a polarity/"appel enceinte par enceinte" step before placement. |
| 5 | S2 "front/back ≤ 6 dB" + "−6 dB per doubling" in a small bar (brief §1 S2) | Misconception risk | In a small bar, the reverberant field dominates beyond the critical distance (a B1 notion), so free-field decay is not what students would measure. Two different "−6 dB" also sit side by side: the coverage edge and the distance law. | Label it "en champ direct". Show the critical-distance ring once (b) exists. Always write "−6 dB hors axe" or "−6 dB par doublement de distance", never a bare "−6 dB". |
| 6 | S3 maps to `monitor-public-spl-compliance` (B8) | Good goal, risky numbers | "Most exposed point" and the mitigations are real practice. But a direct-only level in the 250 Hz–4 kHz band underestimates the total, and it cannot say anything about the dB(C) limit, which the low end drives. | Teach it with **relative** levels (front row vs FOH, in dB). No absolute dB(A) next to "102". Drop LCeq from S3. |
| 7 | Incoherent sum at the main/delay overlap (brief §3 (b)) | Silent misconception | P1 lists the fault `comb-filtering-two-sources`. A smooth map at the overlap teaches that overlap is harmless. | Hatch the overlap zone with "interférences non modélisées ici". |
| 8 | Values with one decimal ("95,1 dB", A/B/Δ table) against a "±3 dB" claim (wireframes) | False precision | Novices read the decimals as truth. | Round to whole dB at fidelity (b). Show Δ only when it is ≥ 3 dB, otherwise "≈ identique". |
| 9 | Phase 1 "compare as a list of what moved" (brief §4.1) | Mostly developer value | A diff with no consequence is a QA log. Without outcome evidence, "one change at a time" stays a slogan. | Each Essai freezes the existing **LevelState + R1–R8 violations**, plus a required **prediction** field ("Je change… je m'attends à…"). Flag Essais that change more than one variable. Then phase 1 teaches the method. |
| 10 | Cognitive load of S1 (brief §2.3, layout) | Too high for 1st year | Wiring + placement + aim + tilt + delay + tree + caption with grandeur/bande/pondération + 5 new keys. | 1st year: flat list of at most 3 Essais, A/B only, one quantity, caption reduced, toolbar buttons first. Tree, bands and weighting from 2nd year. S2 first, S1 calculation (D1) next, full S1 (P1) and S3 in 2nd year. |
| 11 | Teacher view (data model §4: localStorage only, notes editable) | Missing | A teacher cannot see a tree that lives in the student's browser. Notes editable after the fact are not evidence. Exam results are not persisted (current-state §2.10). | Phase 1 must include the export (JSON + "Fiche de calage") and a read-only teacher import view. Lock a note once a child Essai exists; mark later edits. Give a 4-line rubric: prediction, single change, correct reading, justification. |
| 12 | Exam mode (not addressed) | Gap | E4 assesses method, so freezing and comparing is legitimate. But hints and target contours give the answer away. | Essais are allowed in the exam: no coach, no target band, evaluations counted and capped. The trail is exported with `ExamScore`, and exam results must be persisted first. |
| 13 | "Essai" as the learner-facing word (data model naming) | Good | It matches workshop talk ("on fait un essai") and is neutral. Risk: "essai-erreur", meaning random tries. | Keep it. Frame the panel as "hypothèse → essai → constat". Never show "Trial" in the UI. |
| 14 | French copy (wireframes, brief §2) | Needs work | "fidélité (b)" means nothing to a student. "≙" is unknown. "large bande 250 Hz–4 kHz" contradicts itself. "Repartir de cet essai" and "Revenir à l'essai" name the same action twice. "périmé" reads like food. | "Modèle : illustration / simplifié", "soit 14,0 m", "bande 250 Hz – 4 kHz", one verb "Repartir de cet essai", "Résultat à refaire : le montage a changé". |
| 15 | Phase 1 verbs "Figer" vs "Évaluer" (brief §4.1 vs §2.7) | Confusing | In phase 1 there is nothing acoustic to evaluate. | Phase 1: one verb, "Figer l'essai". "Évaluer" appears only when a model exists. |

## Position

**Option C, staged, but capped at fidelity (a) for now, not (b).** In practice that is B plus phase 2.

The competencies that are actually assessed (Δd/c, coverage angle, −6 dB per doubling, "the most exposed point") are all teachable with geometry and relative levels. Absolute dB(A) from fidelity (b) adds misconception risk (findings 1, 6, 7, 8) and little assessed value.

Conditions:
1. Phase 1 is rebuilt around evidence (finding 9) and ships with the teacher export (finding 11).
2. S1 is redesigned (findings 1–3) before any code.
3. Phase 3 (b) is reopened only after one classroom trial of B + (a), with a teacher reading the exported trails.

## Non-negotiables

- Every scenario names one competency id, and each criterion is observable in an exported Essai.
- No criterion credits a change for an effect it does not cause (delay ≠ level).
- The prediction is written before the result is shown; the calculation is written before the first evaluation in S1.
- A teacher can read a student's Essai trail without the student's browser.
- In exam mode: no coach, no target band, evaluations capped and logged.
- No absolute dB(A) shown next to a legal limit.
- The 1st-year UI shows at most 3 Essais, A/B only.

POSITION: C capped at fidelity (a) = B with an evidence-based phase 1 + phase 2 only; (b) after a classroom trial | CONFIDENCE: 75% | RISK: I would block S1 as drafted (delay credited with level gain), absolute dB(A) beside the decree limits, and phase 1 shipped without the prediction field and teacher export
