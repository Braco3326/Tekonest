# Council validator (Tier 3, step 4)

I read all eight round files, `synthesis.md`, and checked the facts against `../tekpractice-data-model.md` §5 and `../prototype-brief.md` §1.

## 1. Persona and methodology consistency

- **Marchetti (H):** consistent. Physics first and "which model, how far off" in both rounds. No drift.
- **Benali (K):** consistent in both rounds. He starts from competencies and teacher evidence. **Undeclared position change:** in round 1 he capped C at (a) and gated (b) on a classroom trial only. In round 2 he accepts "(b) with relative dB only… as the cap" and adds Hélène's measurement campaign as a gate, but calls this "refines… rather than changing". It is a change, and the trigger is evidence (her relative-output rules remove his findings 1, 6 and 8). It should be marked as one.
- **Vogt (L):** consistent. Every finding is a visible-state, binding or layout issue. No drift.
- **Ferreira (T):** mostly consistent. His comments on exam integrity and forgery still sit within data integrity. No drift.

## 2. Round-2 changes: evidence or pressure?

| Expert | Trigger quoted | Assessment |
|---|---|---|
| H | "Karim's mapping showed the assessed competencies need no absolute or statistical level" | Evidence (an argument). But Karim's competency mapping is asserted, not checked against `curriculum.md`. |
| T | "Hélène #8/#12 and Karim #1 show that (b) results would be frozen with meanings that later turn out wrong" | Mostly evidence, and it fits his persona. The added "matching Karim and Lena" hints at some conformity: #8 and #12 can be fixed *inside* (b), so they justify gating (b) more than capping at (a). |
| L | "Benali #11, Marchetti #8, Ferreira #1 vs the ADR-0010 page reloads" | Evidence. Her cap on (b) barely moved. |
| K | (none declared) | Evidence, see §1. |

There is no sign of capitulation driven only by social pressure.

## 3. Confidence

Each expert gives one posterior: H 80, K 78, L 78, T 82. The mean is 79.5, which rounds to **80 %**, so the arithmetic holds. Calibration is plausible. All four rose by 3–5 points as they converged, which is a mild conformity signal. Two decisions are still open: exam mode (C2) and storage-full behaviour (C5). Also, K's cap differs from the other three: he would allow (b) relative, while they stop at (a). So 80 % is the top of the defensible range. I accept it, with a note that the open risks are not priced in.

## 4. Technical spot-check

- **S1 Δd.** Main `spk-l` (−4, 2.2, −9) to p3 (0, 1.2, 12): √(4² + 1² + 21²) = √458 = **21.401 m**. Delay `dly-l` (−4, 2.6, 5) to p3: √(4² + 1.4² + 7²) = √66.96 = **8.183 m**. Δd = **13.218 m**, and 13.218 / 343 = **38.54 ms**. ✔
  - Caveat 1: the example's 40.8 ms (14 m / 343) is 2.3 ms *from* Δd/c, which is **0.3 ms** outside ±2 ms. H1-8 says "2.3 ms outside", which is wrong.
  - Caveat 2: the brief's tolerance is "±2 ms of Δd/c **+ offset**". With any offset ≥ 0.3 ms, 40.8 ms would *pass*. The real error is the method (spacing instead of path difference), not the tolerance. K2 repeats "fail its ±2 ms criterion".
- **4.8 MB.** 50 trials × 32 rooms = 1,600 trials, and 1,600 × 3 KB = 4,800 KB ≈ **4.8 MB** (4.69 MiB). ✔ The 3 KB per trial is an unmeasured estimate. Related figures:
  - Grid: an 18 × 20 m zone at a 1 m step gives 19 × 21 = 399 cells. ✔
  - About 65 KB × 1,600 ≈ 104 MB, which matches "about 100 MB". ✔
  - int16 storage: 399 × 2 B = 798 B, which is about 1.06 KB in base64. ✔
  - Round 2: 150 × 4 KB = 600 KB. ✔
- **−6.02 dB per doubling.** 20·log₁₀(½) = **−6.0206 dB**. ✔ This holds for direct field and point source only, as all experts note.
- **+3.01 dB for two equal incoherent sources.** 10·log₁₀(2) = **+3.0103 dB**. ✔ Coherent in-phase sources give 20·log₁₀(2) = +6.02 dB, which supports H1-3.
- **Extras.**
  - n = ln 0.5 / ln cos 37.5° = −0.6931 / −0.2315 = **2.99**. ✔ This assumes g is a pressure ratio, which is not stated.
  - H-S test: 10·log₁₀(0.28219) = **−5.50 dB**. ✔
  - Lw = Lp(1 m) + 11 − DI is consistent with Lp = Lw − 11 − 20 log r + DI. ✔

## 5. Synthesis faithfulness

- **C1 misplaces K.** In K2 he *accepts* both gates ("after one classroom trial and Hélène's measurement campaign"; "her measurement validates the physics, the classroom trial validates the learning"). He criticises only the idea that one room bounds all 32. So H, T and K want both gates, and L wants classroom plus performance. C1 is narrower than shown.
- **C5 invents agreement.** "Both agree the export is the evidence of record" is wrong. T never says this. T2 calls the export "déclaratif" and forgeable.
- **Consensus 7 over-attributes.** "Whole dB, Δ only when ≥ 3 dB" comes from K1-8 only. H1-1 concerns the ±3 dB error claim, not rounding. L2 only notes that decimals disappear. Re-cite it as K1-8 (endorsed in substance by L2), and mark the Δ ≥ 3 dB threshold as K's proposal.
- **Consensus 11 overstates.** The STI and 1 W points come from H and T. K and L are silent on them. Call them "uncontested", not consensus.
- **Dropped non-negotiables:**
  - K: "Every scenario names one competency id, and each criterion is observable in an exported Essai."
  - H NN6: Lw/DI and the cone fit must be sourced or derived in the ADR. Only the precedence offset and the directivity formula are covered.
  - L NN6: colour-blind-safe palette.
  - T NN2: "every write failure is surfaced to the student". It appears only inside C5.
- **The §5 dissent for Karim** ("insufficient at any fidelity") is the synthesiser's inference. Label it as one.
- **"Fix the `delayMs` example to 38.5 ms"** drops the precedence offset that the brief's own rule adds. The example should read Δd/c + the stated offset, for example 38.5 + 10 = 48.5 ms, with the footnote showing the path difference.

## 6. Unsupported claims

- **Decree 2017-1244.** 102 dB(A) LAeq,15 min and 118 dB(C) LCeq,15 min match the decree as cited in `tekpractice-current-state.md`. H's further claims (limits apply at every accessible point; a reference point with a known offset; the arrêté of 17 April 2023) rest on a culture.gouv.fr press release and a bruit.fr fiche. H herself says the Légifrance clause is unchecked. The synthesis does not repeat these claims, which is correct. Any downstream text must carry "à vérifier sur Légifrance".
- **QSC K12.2 "not published" / 126 dB continuous** (§6). The sources are retail listings (Reverb, Gearank), not QSC's spec sheet. Check against the manufacturer's datasheet.
- **Precedence window 5–15 ms.** Sourcing it is already required. It is used in consensus 5 and in L2's timeline, so it must stay marked [L].
- **"Off-axis error 5–10 dB" (H1-1) and the ISO 9613-1 "< 1 dB"** figure are expert estimates with no source. The ISO figure is plausible: about 0.3 dB at 2 kHz and about 1 dB at 4 kHz over 30 m.
- **KEY REASON** depends on K's competency mapping, which no one checked against `tek-brain/curriculum.md`.

## Verdict: VALID WITH CORRECTIONS

1. C1: move K to the "both gates" side. The real split is H/T/K (classroom + measurement) vs L (classroom + laptop performance).
2. C5: delete "Both agree the export is the evidence of record". Add T2's "déclaratif / forgeable" point.
3. Consensus 7: re-cite as K1-8 (endorsed in substance by L2). Mark Δ ≥ 3 dB as K's proposal.
4. Consensus 11: reword as "uncontested (H, T)".
5. §4 data model: change the `delayMs` fix to "Δd/c (38.5 ms) + stated precedence offset", with the footnote showing the path-difference arithmetic.
6. §6 row `delayMs`: note that 40.8 ms is 0.3 ms beyond ±2 ms of Δd/c, and the error is the method (spacing vs path difference). Correct H1-8's "2.3 ms outside" if it is quoted.
7. Restore the dropped non-negotiables: K's competency-id rule, H NN6 (Lw/DI derivation), L NN6 (colour-blind safe), and T NN2 (surface every write failure).
8. Record K's undeclared round-2 position change.
9. Tag the QSC sensitivity and the precedence window as needing a primary source. Tag any decree or arrêté detail as "à vérifier sur Légifrance".
10. Confidence: keep 80 %, and add "open C2/C5 not priced in".
