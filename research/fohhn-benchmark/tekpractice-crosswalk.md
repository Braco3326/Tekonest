# Crosswalk: Fohhn observations → TekPractice mechanics

**Status:** proposal (tekinspi, 2026-10-24), **revised after the expert council** (`council/synthesis.md`).

**Overriding rules:**
- **Effort and confidence:** phase 1 carries no acoustic numbers. Acoustic rows (7, 9, 10, 12, 15, 16, 24) apply from phase 2 at fidelity (a)/(a)+ only, in **relative** values.
- **Teacher route:** the phone read-only mode is replaced by a teacher page fed by an export file.
- **Curriculum mapping:** S2 maps to coverage and B1, not to D7.
**Rule:** this file describes *patterns* only. Nothing user-facing in TekPractice may carry Fohhn's name, data, wording, icons or look.

## 1. Product distinction

| | Fohhn tools | TekPractice |
|---|---|---|
| Purpose | Plan, simulate and tune real installations of Fohhn products | Teach BTS MAV Son students to build, wire and reason about sound systems |
| User | Installer, consultant, sales engineer | Student (and teacher) |
| Truth source | Measured speaker data, room models, IEC-compliant calculation (with a no-liability disclaimer, L5) | Pedagogical models with an explicit **fidelity level**; sourced facts from TEK Brain |
| Output | A design that gets built; PDF reports; DSP settings | Understanding, demonstrated by passing level objectives and rules |
| What TekPractice learns from each tool | **Viewer:** clear views of directivity, processing labels, colour-per-item comparison. **Optimizer:** the measure → average → propose → review loop and its limits. **Designer:** immutable calculated states in a tree, instant re-view of stored results, labels at fixed points, statistics as a summary | — |
| What TekPractice leaves to professional software | IEC-grade STI/STIPA, ray tracing and auralisation, manufacturer balloons, real EQ proposals, voice-alarm sign-off, rigging validation | — |

## 2. Crosswalk table

Columns:
- **Effort:** S < 2 days, M < 1 week, L > 1 week, for one developer.
- **Conf.:** confidence that the mechanic is worth building, H / M / L.
- **Evidence:** where the observation comes from.

| # | Fohhn observation | Learner benefit | TekPractice mechanic | Required data | Effort | Conf. | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | A snapshot = an immutable calculated state; editing a calculated one forks a draft | Students can try an idea without losing the one that worked; they learn "measure, change one thing, compare" | **Essais (trials):** "Figer l'essai" freezes the setup plus its evidence (prediction, R1–R8 results, level state), and from phase 2 its result. Editing changes the autosaved "Montage actuel"; the next freeze becomes a child | Existing `SavedRig` + placements + room id + results (see data model) | M | H | D-16, D-40…D-44; HC-057 |
| 2 | Tree of snapshots with branching from any node | Shows the student's reasoning path, so a teacher can review it | A simple **Essai history**: a list with parent links, a mini tree, max depth unlimited but shown flat with indentation | `parentId` | S | M | D-15, D-41 |
| 3 | No stale warning: the old heatmap stays painted over edited geometry | (Gap.) Novices misread stale results | **Fix it:** a "Résultat périmé — réévaluer" banner and a greyed overlay as soon as the live setup's fingerprint ≠ the trial's | Fingerprint of the inputs | S | H | D-42 |
| 4 | Comparison = flip between snapshots; labels stay at fixed points | Before/after at the same seat is the core lesson of system tuning | **Compare 2 Essais:** split view or flip, with a **shared, locked colour scale** and a table of named listener points (A/B/Δ) | Named `ListenerPoint`s | M | H | D-14 vs D-16; peer tools S4/S6 |
| 5 | Status bar always says snapshot / mode / band | Removes "what am I looking at?" confusion | Persistent caption that starts with what is displayed: "Affiché : Essai B · niveau direct relatif · Montage actuel : modifié", plus a one-word chip "relatif" with a pop-over | — | S | H | D-14…D-20 |
| 6 | Mode switch (Direct/Total/STI) and band switch are re-views of stored results | Exploring results costs nothing, so students explore | Split `ComputeSettings` (fingerprinted) from `DisplaySettings` (not fingerprinted). Switching a display setting never creates a new Essai | — | S | H | D-17…D-20; council T1-3 |
| 7 | Statistics: histogram + mean, σ, μ−σ, min, max, points | Turns a colour map into numbers students can quote in an oral exam | "Bilan de zone": mean, spread (max−min), share of the zone within target ±3 dB | Grid results | S | H | D-46 |
| 8 | Result labels: click a point to pin its value | Students learn to probe specific seats (front row, back row, FOH) | Pre-placed **named points** per room (e.g. "1er rang", "Régie", "Fond de salle") + student pins | `ListenerPoint` in rooms | S | H | D-14, HC-087 |
| 9 | Colour legend with units; fixed gradient, editable limits | Legend literacy | Legend always shows unit + fidelity; **colour-blind-safe sequential palette** (not rainbow); limits locked during a compare | — | S | H | D-14, D-51; HC-019 |
| 10 | No threshold colouring | (Gap.) Learners need a target | Level **target band, relative only**: e.g. "within ±3 dB of the reference point", or "inside the −6 dB footprint". **Never an absolute dB(A) band** (council H1-14). Off in exam mode | `LessonObjective.target` | S | H | D-18 (absent) |
| 11 | IEC badge = compliance of the method | Teaches that a number's validity depends on the method | **Fidelity badge** (a)/(b)/(c) on every number and chart, with a "Ce que ce calcul ne sait pas faire" pop-over | `fidelity` on results | S | H | D-14; HC-121 |
| 12 | Viewer: isobars with the −6 dB line highlighted | "Coverage angle = −6 dB" is a classic BTS notion | **Fiche enceinte → onglet Dispersion**: synthetic isobar/polar from nominal coverage angles, −6 dB contour emphasised | Synthetic directivity (data model) | M | M | V-07 |
| 13 | Viewer: per-item colour shared by list, header and curve; small multiples for spatial views, overlays for curves | Comparison literacy | Apply to the speaker sheet (inventory) when 2 speakers are compared | — | S | M | V-12, V-15 |
| 14 | Viewer: processing labels ("Smoothed 1/6 octave") and provenance ("Measured with preset") | Students learn to ask "where does this curve come from?" | Every chart shows its processing and **source**: "Données synthétiques TekPractice" / "Fiche constructeur (lien)" | `provenance` | S | H | V-05, V-26 |
| 15 | Optimizer: max 5 measurement positions, averaged; empty proposal = "not possible" | Teaches spatial averaging and the limits of EQ | Mini-exercise: pick 3–5 mic positions in a room, see why one position lies; quiz "EQ can't fix this" | Synthetic room-mode curves (fidelity a) | M | M | HC-077, HC-074 |
| 16 | Optimizer: Moderate (50 %) vs Strict EQ, max Q, filter count | Teaches restraint (cut more than boost, few filters) | Rule-style feedback on a student EQ: "boost > +6 dB", "Q > 10 in the bass" | Simple PEQ maths | M | L | O-03 |
| 17 | Designer: geometry outside snapshots + mismatch warning | Data integrity | **Improve on it:** embed the consumed room and speaker numbers **by value** in each Essai, plus **tool-generated** `geometryRev`/`acousticsRev`/`contentHash`. A changed room shows "salle modifiée depuis", while the old Essai still shows what the student saw | Content hashes | S | H | HC-124; council T1-4, T1-6 |
| 18 | Designer: report bound to one snapshot | Exam and teacher deliverable | `.essai.json` **export + a read-only teacher page** (trail, predictions, rule results, notes, 2D map), plus a printable "Fiche de calage". This is the teacher's only route, because there is no backend | Trial, Evidence | M | H | HC-042…046; council K2, L1-15 |
| 19 | Designer: camera presets (3, right-click set / left-click use) | Fast re-framing during comparison | Each Essai remembers a **view pose** (unlike Fohhn), reused in compare | `CameraPose` (exists) | S | M | tooltip, HC-036 |
| 20 | Designer: aim-at-point tool | Aiming is a skill | "Viser" action in placement mode: the speaker yaws/tilts toward a clicked point; the angle is shown | pitch + yaw | M | M | D-14 rail |
| 21 | Designer: mirror tool | Symmetric L/R systems | "Symétriser" for L/R pairs about the room's centre line | Room axis (exists: x = 0) | S | M | D-29 |
| 22 | Designer: delay shown with its equivalent distance | Δd/c is a BTS competence (`set-delay-and-fill-speakers`) | Delay field shows "10 ms, soit 3,43 m" live; delay-speaker lesson scored on arrival timing (S1) | Speed of sound (temperature) | S | H | D-57; curriculum P1 |
| 23 | Designer: autosave + dirty marker | No lost work | Trials autosave to localStorage; `*` in the essai name when there are unsaved edits | — | S | M | D-35 |
| 24 | Designer: server-side calc, ~2 s, progress % | Feedback during waits | Fidelity (b) runs client-side in a Worker in under 200 ms for 32 rooms (target), so no progress UI is needed | — | M | M | D-36 |
| 25 | Designer: confirm before irreversible delete | Safety | Delete an Essai → confirm; keep a 1-step "Annuler" toast (pattern already in ADR-0010) | — | S | H | D-23 |

## 3. Deliberately not copied

- **Rainbow colour maps.** We use a perceptually ordered, colour-blind-safe palette instead (inferred risk: rainbow maps mislead and exclude colour-blind users).
- **Dot-numbered tree IDs** (documented but not visible). We use letters: Essai A, B, B1.
- **Tool-rail icons without names** (accessibility gap, technical-observations §5).
- **STI/STIPA as headline numbers.** In TekPractice, STI appears only as a fidelity-(c) concept explanation unless a validated model and an ADR say otherwise (see the fidelity ladder).
- **Anything resembling Fohhn's layout, iconography, colours or terms in user-facing UI.**
