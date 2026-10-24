# Prototype brief: "Essais" in TekPractice (scenarios, interface, fidelity ladder, plan)

- **Status:** proposal, **revised after the expert council** (`council/synthesis.md`, `council/validator.md`). Every change from the pre-council draft is listed in §6.
- **Wireframes:** `wireframes/layout.svg` (1366 × 768) and `wireframes/states.svg`, original Tekonest drawings.
- **Language:** French UI copy first; English technical term in brackets where useful.
- **Words:** the learner-facing word is **Essai**. The code name is **`Trial`**. "Snapshot" is banned in new identifiers, because the engine already has `RigSnapshot`.

---

## 1. Learning scenarios (wiring game + room and speaker decisions)

Curriculum ids come from `knowledge-base/tek-brain/curriculum.md` (branch research/tekbrain). Every scenario stays inside fidelity **(a)/(a)+**, defined in §3: geometry, timing and **relative** direct level. None shows an absolute dB SPL value.

### S1 — "Le rappel qui arrive trop tôt" (auditorium with delay speakers)

**Context**
- Competency: `set-delay-and-fill-speakers` (P1).
- Fault: `delay-speaker-heard-as-echo`.
- TEK Brain scenario: `auditorium-powered-pa-with-delays`.

**Learner actions**
1. Wire the main L/R and two delay speakers (the existing patch game, rules R1–R3).
2. Place the delays at the back third.
3. **Before the first evaluation**, write the prediction "Δd = … m, donc retard = … ms" in the Essai note.
4. Figer **Essai A**: the delays are placed, with delay = 0 ms.
5. Read the **arrival timeline** at the named reference point "Fond de salle": the delay speaker arrives *before* the main.
6. Set the delay and figer **Essai B**. **Only the delay changes.**

**Feedback**
- An arrival-time timeline (ms) per named point, showing which source arrives first and the gap.
- No level map in this scenario.

**Success criteria (graded on the value written before evaluating, so no evaluation cap is needed)**
- The written delay is within ±1 ms of Δd/c at the reference point (c = 343 m/s at 20 °C), plus the level's declared offset.
- At the reference point the main arrives first, with a gap in the declared window.
- The chain is wired with no R1–R3 error.

**Precedence offset**
- Each level declares the offset (e.g. +5 ms) and the window (e.g. 5–15 ms).
- The value is **to be sourced** before implementation; the Haas/precedence literature goes into TEK Brain first.

**Worked example (example coordinates in the data model)**
- Path difference to "Fond de salle" is 21.40 − 8.18 = **13.22 m**, so **38.5 ms** before the offset.
- The validator recomputed this; see `council/validator.md`.

### S2 — "Couvrir le public, pas les murs" (small bar gig)

**Context**
- Competencies: the coverage-angle notion plus `acoustic-calculations-bts` (B1: −6 dB per doubling of distance, *direct sound*).
- This scenario is no longer mapped to D7 `run-basic-pa-system-check`, which assesses solo and polarity checks.
- Optional add-on: a polarity step that maps to D7.

**Learner actions**
1. Place two powered speakers on stands.
2. Choose height, yaw and tilt (the "Viser" aim tool).
3. Figer A (straight) and B (toed-in).
4. Compare the share of the audience zone inside each speaker's nominal −6 dB footprint.
5. Quiz: "à 8 m au lieu de 4 m, le **niveau direct** baisse de combien ?" (answer: −6 dB).
6. Follow-up: "et ce que tu **entends** au fond d'un bar réverbérant ?"
   - The answer uses the illustrative critical-distance ring, which is decision C7.
   - Beyond the ring the room's sound dominates, so the drop is smaller.

**Feedback**
- Footprint coverage (%), plus a warning when a speaker aims at a wall less than 1 m away.

**Success criteria**
- ≥ 80 % of the audience zone inside a footprint.
- Quiz correct.
- The follow-up question is answered.

### S3 — "Où le public est-il le plus exposé ?" (concert hall, public SPL awareness)

**Context**
- Competency: `monitor-public-spl-compliance` (B8).

**Learner actions**
1. Place the sound-level-meter reference point at FOH.
2. Find the **most exposed** public point on the relative direct-level map, shown as "dB par rapport à la régie".
3. Explain why that point matters.

**Feedback**
- Relative values only, e.g. "1er rang : +6 dB par rapport à la régie".
- A fixed banner: "Le décret 2017-1244 s'applique à des **mesures réelles** du programme (Leq 15 min, dB(A) et dB(C)) ; ce jeu ne les calcule pas."

**Success criteria**
- The most exposed point is identified.
- One valid mitigation is proposed (distance, drive, delays instead of louder mains, splay).

**Not in this scenario**
- No absolute dB(A) appears next to 102.
- No dB(C) or LCeq estimate: the model has no low end and no programme Leq.
- The decree's measurement clause still has to be checked on Légifrance (OPEN_QUESTIONS #29).

**Not a scenario on purpose: STI or voice-alarm design.**
- STI appears only as a concept lesson, with no computed value.

---

## 2. Interface direction

### 2.1 Hierarchy

```
Salle ─┬─ Zones d'écoute + Points nommés (référence, 1er rang, régie, fond)
       ├─ Matériel placé (position, hauteur, orientation, inclinaison)
       ├─ Câblage (existing patch game, R1–R8)
       ├─ Montage actuel (live state, autosaved — never an Essai)
       └─ Essais (A, B, B1 …): figés ── preuves (prédiction, règles, état du niveau, note) ── comparaison
```

### 2.2 Layout (desktop), see `wireframes/layout.svg`

- **Design target: 1366 × 768** school laptops.
  - Only **one side panel** is open at a time.
  - The Babylon viewport keeps ≥ 60 % of the width.
- **Left panel "Essais".**
  - A pinned **"Montage actuel"** row at the top shows whether it is modified since the displayed Essai.
  - Then the Essais (name, time, state), shown as a flat list in 1st year (max 3, A/B only) and as a mini-tree in 2nd year.
  - The prediction field and the note (locked once a child exists; amendments allowed).
  - Buttons: **Figer l'essai**, **Comparer**, **Repartir de cet essai** (one label for restore).
- **Right panel (alternative to the left):** the "Fiche" of the selected speaker.
  - Dispersion: a synthetic polar view with the −6 dB line emphasised.
  - Réglages: gain ≤ 0 dB, delay "40 ms, soit 13,7 m", polarity.
- **Caption bar.** It always starts with what is displayed:
  - "Affiché : Essai B · niveau direct relatif · Montage actuel : modifié".
  - The fidelity chip shows one word, "**relatif**". Its pop-over explains the model's limits (direct field only, energetic sum, synthetic data). This answers C4 (label creep).
- **Overlays.**
  - The result layer is painted **on the top surface of each zone** (unlit), so it works on raised stages.
  - The ear height is stated.
  - Named points are **DOM pins** (HTML), not Babylon text.
  - "Vue de dessus" button.
- **Teacher view (replaces the phone mode).**
  - An exported Essai file (`.essai.json`) opens in a **read-only DOM page**: the trail, predictions, rule results, notes and a static 2D map.
  - It works offline on any device.

### 2.3 Viewport controls (consistent with TekPractice, not Fohhn)

ADR-0010 (walk, mouse-only, Esc chain, V) and ADR-0008 (Focus & Patch) are unchanged. New `Action`s use `KeyboardEvent.code`, are remappable, and **every action also has a named button**.

| Action | Default | Notes |
|---|---|---|
| `FREEZE_ESSAI` | `KeyG` + button "Figer l'essai" | No-op only when the fingerprint **and** the content refs are unchanged |
| `AIM_AT_POINT` | `KeyT` in placement mode | Shows the yaw and pitch angles |
| `TILT_UP` / `TILT_DOWN` | **unbound by default** + a ±2° stepper in the placement HUD | PageUp/PageDown stay "look up/down": keyboard-only users need them to aim the ghost, and many laptops reach them only through Fn |
| `TOGGLE_RESULT_OVERLAY` | `KeyO` | |
| `FLIP_COMPARE` | `KeyB` | A ⇄ B at the same camera pose. The "[ ]" keys are dropped: AZERTY has no physical bracket keys |
| Essais list | `ArrowUp`/`ArrowDown` when the panel has focus | |

**Esc chain:** "close compare" becomes step 3b, after "close top panel". That works only because compare is **read-only**.

### 2.4 Charts and comparison

- Charts are DOM SVG, never inside Babylon.
- **Compare = flip** at the same camera, plus a DOM side-by-side of 2D small multiples. There are never two Babylon viewports.
- The colour scale is shared and locked during a compare.
- Point table columns: A | B | Δ.
  - Δ is shown only when |Δ| ≥ 3 dB; otherwise "≈".
  - Values are in **whole dB**.
- The overlap zone between two speakers is **hatched** with the label "interférences non modélisées", so the smooth energetic sum doesn't teach "no comb filtering".
- Every chart states its processing ("somme énergétique") and its source ("données synthétiques TekPractice").

### 2.5 Novice explanations

- A "?" per quantity, 1–2 sentences with a TEK Brain link.
- **Stale result:**
  - hatched overlay, values replaced by "—";
  - the word "**Résultat à refaire**" as text;
  - the button "Refaire l'évaluation".
  - This fixes the Fohhn gap seen in D-42.
- **Prediction before evaluation** ("je change…, je m'attends à…"). An Essai that changes more than one thing gets the flag "plusieurs changements à la fois".

### 2.6 Exam mode (⚠ contested, Oscar decides; see `scope-decision.md` §5)

- **Common ground:** no coach, no target band, no result overlay in exams. Every evaluation is logged.
- **Contested:**
  - Essais on, as the examiner's method trail (Karim).
  - Off unless the level declares them (Lena).
- **Precondition either way:** `ExamScore` is persisted, and ADR-0011 decides the integrity mechanism, since an exported file can be forged.

### 2.7 State-by-state board (`wireframes/states.svg`)

| # | State | What the student sees | Exit |
|---|---|---|---|
| 1 | Room loaded, no Essai | "Aucun essai — placez le matériel, écrivez votre prédiction, puis Figer" | Figer |
| 2 | Evaluating | Busy button (target < 200 ms, Worker) | Done or failed |
| 3 | Displayed Essai = live setup | "Affiché : Essai A · à jour"; pins; timeline or footprint | Edit → 4; Compare → 5 |
| 4 | Live setup modified | Hatched overlay, "—", "Résultat à refaire"; "Montage actuel : modifié" | Figer (→ new child) or "Repartir de l'essai A" |
| 5 | Compare A/B (read-only) | Flip (B) + DOM table A/B/Δ; locked scale | Esc |
| 6 | Failed | "Données manquantes pour <appareil>"; live setup kept | Fix → Figer |
| 7 | Content changed since | "Salle ou fiche modifiée depuis cet essai" (result kept, never recomputed silently) | "Refaire avec les données actuelles" (→ new Essai) |
| 8 | Unreadable stored data | "Données d'essais illisibles — mises de côté (quarantaine), exportables" | Export / continue |
| 9 | Storage nearly full | "Exporter puis archiver les anciens essais" (⚠ C5; hard stop only at the absolute budget) | Export |
| 10 | Teacher page | Read-only trail from an `.essai.json` file | — |

---

## 3. Fidelity ladder (acoustic honesty), revised

Sources are in `research_notes/…/acoustics_fidelity_ladder.md`, tagged [H]/[M]/[L]. **Nothing tagged [L] ships.**

| Level | What it computes | Claims the game MAY make | Must NEVER make | Status |
|---|---|---|---|---|
| **(a) Illustrative** | Nominal −6 dB footprints from coverage angles; aim angles; Δd/c arrival timeline; "−6 dB per doubling" for **direct** sound | "zone approximativement couverte selon l'angle nominal", "retard théorique", "niveau direct relatif" | Absolute dB SPL; "conforme"; anything about intelligibility | **Phase 2** |
| **(a)+** | (a) plus a relative direct-level map (dB re a reference point, energetic sum, synthetic directivity), plus an **illustrative critical-distance ring** (C7) | "relatif à la régie", "au-delà de ce cercle, le son de la salle domine (ordre de grandeur)" | Absolute values, error bounds, a dB(A)/dB(C) estimate | **Phase 2** (the ring depends on C7) |
| **(b) Simplified, validated, relative only** | Point-source direct SPL with headroom-based drive; a statistical total-level estimate (Hopkins-Stryker, with surface area stored), labelled "moyenne statistique" | Relative values; error bounds **only for a room that has been measured** | Any figure such as "±3 dB" for unmeasured rooms; STI numbers; compliance | **Not committed.** It needs a new decision after a classroom trial and a measurement campaign |
| **(c) Advanced simulation** | Image source or ray tracing, STI from MTF, auralisation | Only with an ADR, a validated engine and licences | Any certification | **Not planned** |

### Model details required before phase 2 (from the audio expert, H1-4…H1-13)

- **Directivity:**
  - A written formula, e.g. a cosine-power lobe with exponent n fitted so the gain is −6 dB at half the nominal angle (n ≈ 3 for 75°).
  - A −20 dB floor behind the speaker.
  - Unit tests.
- **Drive:**
  - Powered speakers: drive is expressed as **headroom below the published max continuous SPL**, capped at 0 dB (limiter).
  - Passive speakers: sensitivity at 1 W or 2.83 V / 1 m. "1 W" is never used for powered speakers. For example, the QSC K12.2 publishes max SPL and coverage but no 1 W sensitivity.
- **Weighting:** A-weighting a broadband value requires a stated assumed spectrum. Before (b), stay unweighted and relative.
- **Air absorption (ISO 9613-1):** not shown below 4 kHz octaves. It is negligible against the model error inside 30 m.
- **Line arrays:** they stay illustrative because coherent per-element data is missing, **not** because the formulas disagree.
- **Octave mode:** badged "synthétique" (the directivity is not measured per band).

### Council non-negotiables carried into ADR-0011 (validator correction 6)

- **Every scenario and objective cites a TEK Brain curriculum competency id** (Karim).
- **Directivity, Lw and DI** are derived and written down in ADR-0011 **before any level map** ships (Hélène, NN6).
- **Colour-blind-safe sequential palette** for every map (Lena, NN6).
- **Every storage write failure is shown to the student** (Tomás, NN2).

### Speaker data policy

- `provenance` is required per field. Allowed:
  - our own **synthetic** directivity;
  - **single published spec numbers** with a link;
  - **TEK Brain** sourced records (`kb` kind).
- Measured balloons or polar tables from any manufacturer (including Fohhn FSD, GLL, CLF) are **not** allowed without a recorded licence.

---

## 4. Phased plan (tied to existing modules)

| Phase | Scope | Files and modules | Entry | Exit (tests) |
|---|---|---|---|---|
| **0. Decide** | Oscar's choices (§5 of the scope memo); **ADR-0011** "Essais et acoustique pédagogique" (embedding by value, quarantine, byte budget, exam policy, naming) | `tekpractice-sim/docs/adr/0011-…md` | This study | ADR accepted |
| **1. B, evidence-first** (the smallest useful prototype) | Figer, list, compare, restore **setups** (placements + wiring + room) with **no acoustic numbers**. Each Essai carries the prediction, frozen `ruleResults` and `levelState`, and a note with amendments. Plus: live autosave; quarantine; byte budget; `.essai.json` export and import; read-only teacher page; SavedRig v2 under `audio-sim/rigs.v2` | new `src/trials/{trial,fingerprint,store,compare,export}.ts`; `src/ui/shelf.ts`; a small left panel; `teacher.html` (DOM only) | ADR-0010 branch merged or rebased | vitest: write-once store; canonical `fp1:` fingerprint stable across key order and float noise; load re-verifies; quarantine on a corrupt payload; v1→v2 copy migration plus the clobber test; export→import round-trip; budget warning. e2e: figer → edit → "Résultat à refaire" → repartir; teacher page renders an export. Layout checked at 1366×768 |
| **2. Fidelity (a)/(a)+** | Footprints, aim tool, tilt stepper, arrival timeline, relative direct level, hatched overlap, d_c ring (if C7); S1 + S2 playable | `src/trials/evalA.ts` (Worker); `explore/placement.ts` (pitch, free yaw); `sync-rooms.ts` emits `content/rooms-acoustics/*.json` with **tool-generated** `geometryRev`/`acousticsRev` | Phase 1 exited; directivity formula specified; **real school laptop: overlay ≤ 10 % frame-time cost** | Geometry and timing unit tests; golden fixtures per `engineVersion`; e2e S1/S2 |
| **3. Fidelity (b), relative only** | Only if Oscar re-decides | `src/trials/evalB.ts`; `content/acoustics/speakers.json` (proposal → review) | Classroom trial of phase 1 + 2 with a teacher reading exported trails, **and** a documented measurement campaign (≥ 5 points, provenance, `geometryRev`) | Error bound published only for the measured room |
| **4. Fidelity (c)** | Not planned | — | — | — |

### 4.1 Smallest useful prototype = phase 1

In the Sandbox, a student:
1. builds a setup in a room;
2. writes "je change…, je m'attends à…";
3. clicks **Figer l'essai**;
4. changes one thing, gets "Résultat à refaire", and figes B;
5. compares A and B: what moved, which rules now pass or fail, and whether the prediction held;
6. exports the trail for the teacher.

This teaches the **method** with zero acoustic risk, and it repairs the untested `SavedRig` persistence.

### 4.2 Risks

| Risk | Mitigation |
|---|---|
| Over-trust in numbers | Phase 1 has none. Phase 2 is relative only, with a fidelity chip, hatched overlaps and no STI |
| A wrong model presented with confidence | Verification ≠ validation (council dissent, Hélène): no error bound without measurement |
| Performance (13–25 fps headless; real hardware unknown) | The overlay is a texture on the zone top, updated on Figer only; a real-laptop gate before phase 2 |
| localStorage quota | A global byte budget (about 150 trials / 1.5 MB, measured); grids int16 or recomputed; progress data never starved |
| Data loss | Quarantine instead of reset; `rigs.v2` key; export as the evidence of record |
| Exam integrity | Decided in ADR-0011; `ExamScore` persisted first |
| Licences | Synthetic directivity plus linked spec numbers; provenance required by zod |
| Scope creep | The fidelity cap is written into ADR-0011 |

---

## 5. Open items carried to the scope memo

These are C1–C7 from `council/synthesis.md`:
1. the gate for (b);
2. exam mode;
3. the evaluation cap (resolved by grading the written prediction);
4. caption labels (resolved by the one-word chip plus a pop-over);
5. storage-full behaviour;
6. draft persistence (resolved by autosaving the live state separately);
7. the d_c ring at (a)+.

## 6. Changes from the pre-council draft

- S1 rewritten: timing instead of level, delay-only A/B, prediction graded, example corrected to 38.5 ms.
- S2 remapped from D7, with the direct-sound wording and a critical-distance follow-up.
- S3 relative only, with no dB(C).
- The "±3 dB" claim removed.
- The fidelity ladder rewritten, with (b) no longer a planned phase.
- Keys:
  - PageUp/PageDown no longer overloaded for tilt;
  - `KeyB` replaces "[ ]";
  - buttons for every action.
- Layout: 1366 px with one panel; the "Montage actuel" row; captions start with "Affiché".
- The phone mode replaced by the teacher page.
- Exam mode added as a contested item.
- French copy fixes: "≙" → "soit", "périmé" → "Résultat à refaire", one restore label, "Figer l'essai".
