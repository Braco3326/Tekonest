# Council synthesis (Tier 3, step 5, final)

Neutral synthesiser. Sources: round 1 and round 2 files from Marchetti (audio, **H**), Benali (pedagogy, **K**), Vogt (3D interaction, **L**) and Ferreira (data, **T**). Citations such as `H1-8` mean round 1, finding 8; `T2` means Tomás's round 2. **[NN]** marks a non-negotiable.

## 1. Consensus

1. **Option A is rejected.** All four say B has standalone value. T adds that B also fixes the untested `SavedRig` persistence.
2. **Phase 1 = B (Essais, no acoustics) ships first** with no acoustic numbers and one verb, "Figer l'essai" (K1-15, L1-5).
3. **Phase 1 must produce evidence, not a diff log.** Each Essai freezes `LevelState` and the R1–R8 results, and carries a prediction written before the result (K1-9, T2, L2, H2).
4. **A self-contained file export plus a read-only teacher DOM page are part of phase 1.** They replace the phone mode (K2, L2, T1-14).
5. **The S1 draft is wrong.** Energetic summation ignores time, so a delay cannot change level. S1 is scored on arrival order and gap at a named reference point (H1-8, K1-1, T2).
6. **No absolute dB(A) or dB(C) next to the decree limits, and no LCeq estimate.** S3 is taught with relative or margin values (H1-9, K1-6).
7. **Relative levels are the default output.** Values are whole dB, and Δ is shown only when it is ≥ 3 dB (H1-1, K1-8, L2).
8. **Phase 2 is fidelity (a).** Fidelity (b) is **not committed**. It is gated on at least a classroom trial, and all four moved or held to this in round 2.
9. **Displayed vs live is always stated in words.** Compare is read-only and needs no second 3D render (L1-1, L1-9, endorsed by H2 and T2).
10. **Nothing is ever silently deleted or mutated.** Payloads are quarantined, not reset (T1-9, endorsed by K2 and L2).
11. **No computed STI value below (c).** No 1 W drive for powered speakers (H1-10, H1-12, T2).
12. **Keep "Essai" as the learner-facing word, `Trial` in code, and ban "snapshot"** (K1-13, T1-11).

## 2. Contested

| # | Issue | Side 1 | Side 2 | Evidence |
|---|---|---|---|---|
| C1 | **Gate for (b)** | H, T: classroom trial **and** a measurement campaign. Classroom data measures learning, not model error ("a class can like a heatmap 8 dB wrong", H2). | K: the classroom trial is the gate that matters. One room measured at 5 points does not bound 32 estimated rooms (K2; T2 agrees). L: classroom trial plus a real-laptop performance figure. | All 32 rooms are `needs-oscar-review` estimates (T2). Any bound must be tied to the measured room's `geometryRev`. |
| C2 | **Essais in exam mode** | L: Essais and overlays are off unless the level declares them. A heatmap or Δ table is a strong hint (L1-16). | K: E4 assesses method, so the trail is the examiner's evidence. Turn off the overlays and target band, not the Essais (K1-12, K2). | Both reject hints. They differ only on the trail. T: exam integrity needs `ExamScore` persisted plus a mechanism that ADR-0011 decides. |
| C3 | **Capped evaluations** | K: cap and count evaluations so students cannot hill-climb the delay (K1-3). | L: a cap makes G a scarce resource that an accidental press wastes. If capped, add a confirmation step and an "n/3" counter (L2). | K's alternative is to grade the noted value written before evaluation. That removes the need for a cap. |
| C4 | **Caveat labels** | H: label every result "champ direct / somme énergétique / spectre supposé / fidélité" (H1 NN7). | L: at 1366 px, labels that are always on get ignored. Use one word ("relatif") plus a pop-over on the fidelity chip (L2). K: novices ignore captions, so honesty must come from what is shown (K2). | No user data. This is resolvable by design: change what is shown (hatched overlap, d_c ring, relative values) and keep a short label. |
| C5 | **Storage full** | T: a global budget of about 150 trials / 1.5 MB, with a hard failure the student sees (T1-10). | K: blocking mid-lesson is a teaching failure. Prompt "exporter puis archiver" and treat the export as the evidence of record (K2). | Both agree the export is the evidence of record and that progress data must never be starved. |
| C6 | **Draft persistence** | T: never persist drafts. A Trial is written once (T1-1). | L: ADR-0010 reloads the page on every room or level change, so an unsaved live setup vanishes (L2). | Resolvable: autosave the live `DesignState` under its own key, never as a Trial. |
| C7 | **Critical-distance ring timing** | H: show an illustrative d_c ring at (a), "(a)+" (H2). | K (r1): show it once (b) exists (K1-5). | Without it, S2 teaches −6 dB per doubling in a reverberant bar (H1-5). |

## 3. Recommendation

**Option C, staged and capped at fidelity (a)+ for now.** (b) is a separate future decision, not a planned phase. The evidence: the assessed competencies (Δd/c, coverage angle, −6 dB per doubling of distance, most exposed point) need only geometry and relative direct level (K1, H2). Everything (b) adds (absolute drive, the Hopkins-Stryker total level, A-weighting) has no validated error bound.

| Phase | Entry criteria | Exit criteria |
|---|---|---|
| **1 – B, evidence-first** | Revised brief and data model accepted. ADR-0011 written (embedding by value, quarantine, budget). | Essai stores the prediction, `ruleResults`, `levelState` and a locked note with amendments. Fingerprint `fp1:` is canonical and quantised, and re-verified on load. Quarantine and a measured global byte budget are in place. `rigs.v2` key passes the clobber test. Export → import round-trips. Teacher DOM page works. Live state is autosaved. "Montage actuel" row is shown. Layout redrawn at 1366×768. Tests per T1-17 pass. |
| **2 – fidelity (a)** | Phase 1 exited. Directivity formula specified with unit tests (H1-4). S1 and S2 rewritten. Real school laptop: overlay costs ≤ 10 % of frame time (L1-14). | Footprint, aim, tilt, Δd/c and relative direct level work. Arrival-time timeline exists (L2). Overlap hatched. d_c ring is illustrative only, if C7 resolves for it. Golden fixtures per `engineVersion`. |
| **3 – fidelity (b), relative only** | Oscar re-decides after (i) one classroom trial of B + (a), with a teacher reading the exported trails, and (ii) one documented measurement campaign (≥ 5 points, stored with provenance and `geometryRev`). | Every result is relative by default. Absolute values are internal and tagged. Error bounds are shown only for the measured room. |

## 4. Required revisions

Items marked ⚠ have a conflict that Oscar resolves (see §2).

**prototype-brief.md**
- [ ] [NN] Rewrite S1: Essai A has the delays placed at 0 ms, and Essai B changes only the delay. Score arrival order and gap; no level criterion. Bound and source the precedence offset. Write the Δd/c note before the first evaluation (H1-8, K1-1..3; H NN5, K NN).
- [ ] [NN] S3: relative or margin values only; drop LCeq (H1-9, K1-6; H NN2, K NN).
- [ ] Delete "±3 dB" [NN] and the absolute band in crosswalk #10 (H1-1, H1-14; H NN1).
- [ ] S2: label "niveau direct", add a critical-distance follow-up question, remap to `coverage-angle` + B1 or add a polarity step (H1-5, K1-4, K1-5).
- [ ] Rewrite the fidelity ladder: (b) is gated per §3; line-array rationale rewritten (H1-11); ISO 9613-1 used at ≥ 4 kHz octaves only (H1-6); assumed spectrum for dB(A) (H1-7); octave mode badged "synthétique" (H1-13); "moyenne statistique" label and `surfaceM2` (H1-2).
- [ ] [NN] Keys: PageUp/PageDown unchanged, tilt keys unbound and remappable, `KeyB` flip, no "[ ]" in the copy, a named button for every action (L1-2, L1-3; L NN2, NN3).
- [ ] [NN] Esc step 3b; compare read-only (L1-4; L NN4).
- [ ] G: re-evaluation is a no-op only when `fp` **and** refs are equal (L1-5, T2).
- [ ] Heatmap on the zone top, unlit, ear height stated; stale shows "—" and "PÉRIMÉ" as text (L1-8, L1-10; L NN6).
- [ ] [NN] Exam mode: no coach, no target band, logged ⚠ C2 (Essais off, L NN7, vs Essais on, K NN) ⚠ C3 (caps).
- [ ] [NN] 1st-year UI: at most 3 Essais, A/B only, as a level setting (K NN, L2).
- [ ] [NN] Phase-1 exit tests per T1-17; performance gate before phase 2 (L NN7).
- [ ] Caption labels ⚠ C4 (H NN7 vs L2 "label creep").
- [ ] French copy fixes (K1-14).

**tekpractice-data-model.md**
- [ ] [NN] Write-once Trial, `DeepReadonly` type, append-only store API, strict zod parse, fingerprint re-verified on load (T1-1; T NN1).
- [ ] [NN] Canonical, quantised `fp1:` fingerprint; refs compared separately (T1-2; T NN4).
- [ ] Split `ComputeSettings` from `DisplaySettings` (T1-3).
- [ ] [NN] Tool-generated `geometryRev`/`acousticsRev`/content hashes; `engineVersion` guarded by golden fixtures (T1-4, T1-5; T NN5).
- [ ] [NN] Embed consumed inputs by value (T1-6; T NN6).
- [ ] [NN] `audio-sim/rigs.v2` key, copy migration, `roomId: null` (T1-8; T NN7).
- [ ] [NN] Quarantine, never `removeItem` (T1-9; T NN2).
- [ ] [NN] Global byte budget; grids as int16 or an evictable cache (T1-10; T NN3) ⚠ C5.
- [ ] Live `DesignState` autosave, separate from Trials ⚠ C6 (T1-1 vs L2).
- [ ] Add `prediction{text, writtenAt}` with `writtenAt < computedAt`; `ruleResults`, `levelState`, `rulesRev`; `noteAmendments` (K1-9, K1-11, T2; K NN).
- [ ] [NN] Drive as headroom or passive; `sensitivityDb1W1m` only for passive speakers; `assumedSpectrum`, `referencePointId`, directivity params (H1-12, T2; H NN4).
- [ ] Provenance with a `kb` kind, per field (T1-12); `O-` objective ids (T1-13); export envelope `formatVersion` marked "déclaratif" (T1-14, T2).
- [ ] Ear height cited as CEN/TS 54-32 (H1-15).
- [ ] Fix the `delayMs` example to 38.5 ms (H1-8).

**tekpractice-crosswalk.md**
- [ ] Row 6 band contradiction (T1-3); row 10 relative target (H1-14); row 17 revs (T1-4); row 18 fiche export as teacher route (L1-15, K2); D7 mapping (K1-4).

**wireframes (layout.svg, states.svg)**
- [ ] [NN] "Montage actuel" row; caption starts with "Affiché : …" (L1-1; L NN1).
- [ ] [NN] Redraw at 1366×768 with one panel open and a viewport ≥ 60 % wide (L1-12; L NN5).
- [ ] Explore-view frame, DOM pins (L1-13); flip compare plus 2D small multiples (L1-9); arrival timeline (L2).
- [ ] Remove the delay-credited +3,9 dB; whole dB values; replace state 8 (phone) with the teacher page (K1-1, K1-8, L1-15).
- [ ] Distinct wording for state 4, state 7 and corrupted (L1-10, L2); phase-1 verb "Figer" (K1-15).

## 5. Dissent worth noting

- **Hélène (H2):** verification is not validation. Hashes and golden fixtures prove the *same wrong number* comes back every time. Without a measurement campaign, even relative (b) maps borrow credibility.
- **Karim (K2):** labels do not protect novices. If this holds, H's label-based safeguards are insufficient at any fidelity, and design must carry the honesty.
- **Tomás (T2):** an exported file can be forged. A fingerprint detects drift, not tampering, so exam use needs its own mechanism.

## 6. Unsupported or wrong claims in the drafts

| Claim | Caught by | Correct statement |
|---|---|---|
| "±3 dB environ" at (b) | H1-1 | No quantified error exists. The tests verify arithmetic only. |
| S1 "spread improved ≥ 3 dB vs Essai A" | H1-8, K1-1 | A delay cannot change an energetic sum; score on timing. |
| `delayMs 40.8` example | H1-8 | Δd = 21.40 − 8.18 = 13.22 m → 38.5 ms. |
| QSC K12.2 1 W/1 m sensitivity | H1-12 | Not published. Use max SPL (126 dB continuous) and headroom. |
| Crosswalk #10 "94–100 dB(A) ±3 dB" | H1-14 | Absolute values from an unvalidated model; use relative ±3 dB around a reference point. |
| dB(C)/LCeq estimable for S3 | H1-9 | The model has no low end or programme Leq, so it cannot be estimated. |
| A-weighting of broadband sensitivity | H1-7 | Needs an assumed spectrum. |
| ISO 9613-1 meaningful at (b) | H1-6 | For pure tones; < 1 dB at < 30 m in the band. |
| Line arrays at (a) because "formulas disagree 6–8×" | H1-11 | Their definitions differ. The real reason is coherent per-element data. |
| Ear heights = "Designer's convention" | H1-15 | CEN/TS 54-32. |
| Trials "deep-frozen", immutable | T1-1 | `Object.freeze` does not survive JSON; needs a type, an API and re-verification. |
| Band switch "UI only" | T1-3 | The band is inside the fingerprinted `inputs`. |
| 50 trials/room fits storage | T1-10 | About 4.8 MB without grids, up to about 100 MB with grids. |
| Fohhn's geometry-by-reference is worth copying | T1-6 | Can detect drift but not show it; embed by value. |
| "[ ]" keys usable | L1-2 | AZERTY has no physical bracket keys. |
| 13–25 fps predicts hardware | L1-14 | Headless software GL; measure on a real laptop. |
| Phone review mode | L1-15 | Empty by construction without an export. |
| S2 maps to D7 `run-basic-pa-system-check` | K1-4 | S2 assesses neither the solo check nor polarity. |

## 6b. Corrections after the validator (applied by the coordinator, tekinspi)

The validator's verdict was **VALID WITH CORRECTIONS** (`validator.md`). These corrections override the text above where they conflict.

1. **C1:** Karim joined the "classroom trial **and** measurement campaign" side in round 2. He did this without declaring a position change, and it is now recorded. The real split is H/T/K (both gates) vs L (classroom trial + real-laptop performance).
2. **C5:** "Both agree the export is the evidence of record" is withdrawn. T calls the export *déclaratif* and forgeable. Exam integrity needs its own mechanism (ADR-0011).
3. **Consensus 7:** the Δ ≥ 3 dB display threshold is K's proposal (K1-8), and L agrees in substance. H1-1 concerns the ±3 dB error claim, not the display threshold.
4. **Consensus 11:** only H and T raised the STI and 1 W drive points. They are *uncontested*, not explicit consensus.
5. **`delayMs`:** stated as Δd/c = 38.5 ms **plus** the level's declared precedence offset.
   - The arithmetic: main at (−4, 2.2, −9), delay at (−4, 2.6, 5), point at (0, 1.2, 12).
   - Main path √458 = 21.40 m; delay path √66.96 = 8.18 m.
   - Δd = 13.22 m; at 343 m/s that is 38.5 ms.
   - The old 40.8 ms came from the speaker spacing, which is a method error.
6. **Non-negotiables restored:**
   - K: every scenario cites a curriculum competency id.
   - H NN6: derive Lw/DI and the directivity in ADR-0011 before any level map.
   - L NN6: a colour-blind-safe palette.
   - T NN2: every storage write failure is shown to the student.
7. **Sources still to verify:**
   - Check that the QSC K12.2 datasheet publishes no 1 W sensitivity. The current evidence is retail listings.
   - The 5–15 ms precedence window is **unsourced** until it is added to TEK Brain.
   - Decree and arrêté details are "à vérifier sur Légifrance". The 102 dB(A) / 118 dB(C) limits match the cited sources.
8. **Confidence:** 80 % (mean 79.5) holds. It does **not** price in the open exam-mode issue (C2) or storage-full behaviour (C5). All four scores rose 3–5 points as positions converged, a mild conformity signal noted by the validator.

## 7. Council summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COUNCIL SUMMARY
DECISION:     Option C staged and capped at fidelity (a)+: phase 1 = B evidence-first (prediction, frozen rule results, file export, teacher view); phase 2 = (a) relative direct level; (b) is NOT committed and needs a new decision after a classroom trial + a measurement campaign
CONFIDENCE:   80% | TIER: 3 | EXPERTS: 4 + neutral + validator
KEY REASON:   The assessed BTS competencies (Δd/c, coverage, −6 dB/doubling, most exposed point) need only geometry and relative level; everything (b) adds has no validated error bound
OPEN RISK:    Exam-mode policy (Essais on vs off) and storage-full behaviour unresolved; S1 draft actively teaches "delay = louder" until rewritten
NEXT ACTION:  Oscar decides (scope-decision.md); then /superpowers:write-plan for phase 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
