# Acoustics fidelity ladder for TekPractice (BTS MAV option Son): which predictions a browser game can make honestly

All sources accessed 2026-10-24. Confidence tags on each claim:
- **[H]** = read in the fetched source text during this session.
- **[M]** = taken from a search snippet or a secondary source (forum, vendor blog, patent), or the fetched text was partial.
- **[L]** = standard textbook knowledge that I could NOT verify from a fetched source in this session. Treat [L] items as "must verify against the standard or textbook before they ship". They are flagged in the Gaps sections.

Ladder used throughout: **(a) illustrative** = shows a trend, no number promised; **(b) simplified validated** = closed-form formula, unit-tested against worked examples, stated validity range; **(c) advanced** = geometric/wave simulation (image source, ray tracing, FDTD).

---

## Q1. Direct SPL from a point source (inverse square, sensitivity + 10·log P, Q/DI, air absorption) and line-source behaviour

### Takeaway
At level (b) a game can honestly compute free-field direct SPL as sensitivity + 10·log10(P) − 20·log10(r) + DI − air absorption, provided it states "far field, free field, on-axis or with a stated directivity". Air absorption per ISO 9613-1:1993 is a closed-form formula that is cheap to implement and matters only above about 2 kHz and over tens of metres. Line-array "−3 dB per doubling" is only a trend inside a frequency-dependent near field, with real ripples of about ±2 dB. It belongs at level (a), or at (c) if modelled as a sum of elements.

### Cited Findings
- **Direct field term.** The indoor level equation Lp = LN + 10·log(D/(4πr²) + 4/R) contains the free-field direct term 10·log(D/(4πr²)), where D is the directivity coefficient (Q) and r is the distance in m. Without the reverberant term this is the inverse-square law: −6 dB per doubling of distance. [H] — [Engineering ToolBox, "Room Acoustics: Indoor Sound Propagation", sound-propagation-indoor-d_72](https://www.engineeringtoolbox.com/sound-propagation-indoor-d_72.html) (Engineering ToolBox; section: indoor SPL equation; covers direct + reverberant SPL and the room constant).
- **Directivity.** D (Q) is "typically 1 for receivers in the middle of the room" (an omnidirectional source). [H] — same Engineering ToolBox page.
- **Critical distance uses the directivity γ (Q).** d_c = ¼·√(γA/π) ≈ 0.057·√(γV/RT60), where γ = 1 for an omnidirectional source. [H] — [Wikipedia, "Critical distance"](https://en.wikipedia.org/wiki/Critical_distance) (section: formula).
- **Air absorption (ISO 9613-1:1993).** The formula as implemented in the open-source `acoustic_toolbox.standards.iso_9613_1_1993` [H] — [acoustic-toolbox docs, atmosphere module](https://acoustic-toolbox.readthedocs.io/en/latest/atmosphere/) (Read the Docs; section: atmosphere / ISO 9613-1 functions):
  - f_rO = (p_a/p_r)·(24 + 4.04×10⁴·h·(0.02 + h)/(0.391 + h))
  - f_rN = (p_a/p_r)·(T/T0)^(−1/2)·(9 + 280·h·exp(−4.170·[(T/T0)^(−1/3) − 1]))
  - α [dB/m] = 8.686·f²·[1.84×10⁻¹¹·(p_r/p_a)·(T/T0)^(1/2) + (T/T0)^(−5/2)·(0.01275·e^(−2239.1/T)/(f_rO + f²/f_rO) + 0.1068·e^(−3352.0/T)/(f_rN + f²/f_rN))]
  - h = h_r·p_sat/p_a; p_sat = p_r·10^C with C = −6.8346·(T01/T)^1.261 + 4.6151. Constants: T0 = 293.15 K, T01 = 273.16 K (triple point), p_r = 101.325 kPa.
  - Variables in the formula: frequency, temperature, humidity and pressure. Per the standard's abstract, the formulas apply from 50 Hz to 10 kHz at 101.325 kPa, with wider-range formulas given separately. [M] — [ANSI webstore preview of ISO 9613-1:1993](https://webstore.ansi.org/preview-pages/ISO/preview_ISO+9613-1-1993.pdf) (search snippet only; scope).
  - An online calculator for cross-checks: [sengpielaudio air-damping calculator](https://sengpielaudio.com/calculator-air.htm). [M] (not fetched)
- **Line source near field.** Within the near field the level falls at about −3 dB per doubling of distance, with undulations, and beyond the "transition distance" at −6 dB per doubling. "The true variations are easily +/-2 dB" around the 3 dB trend. [M] — [Q-SYS white paper "Line arrays in cinema"](https://www.qsys.com/resource-files/whitepapers/q_wp_cin_linearraysincinema.pdf) (search snippet).
- **Transition distance formulas disagree between sources** [M]:
  - Q-SYS uses D = A²/λ (A = largest source dimension). For a 2 m array: 5.8 m at 500 Hz, 11.6 m at 1 kHz, 23.3 m at 2 kHz. [M] — [Q-SYS white paper](https://www.qsys.com/resource-files/whitepapers/q_wp_cin_linearraysincinema.pdf)
  - Heil, Urban & Bauman (AES 2001, L-Acoustics WST) use an empirical expression with F in kHz and H in m. There is no near field below about 1/(3H) kHz; for example, a 4 m array is in far field below about 80 Hz. [M] — [L-Acoustics, "Wavefront Sculpture Technology" convention paper](https://www.l-acoustics.com/wp-content/uploads/2026/06/Wavefront_Sculpture_Technology_convention.pdf)
  - Griffin: d = 1.5·f·H² (f in kHz, H in m). This is cited on a forum, so it is unverified. [M] — [diyAudio post](https://www.diyaudio.com/community/goto/post?id=7768321)

### Inferences
- **Level (b) direct SPL**: Lp(r) = S_1W1m + 10·log10(P_W) + DI(θ) − 20·log10(r/1 m) − α(f)·r. Safe claim: "free-field, far-field estimate, valid when r ≫ source size and r > transition distance". The 10·log10(P) term assumes the sensitivity is specified at 1 W into the nominal impedance and that the driver is linear (no power compression). Typical error is a few dB at high drive levels, not quantified here (see Gaps).
- **Air absorption** is only worth showing per octave band for r above about 20 m or f ≥ 4 kHz. A game can use the ISO formula at octave centre frequencies. For broadband signals the standard itself warns that pure-tone coefficients are an approximation (the ISO 9613-1 scope is pure tones).
- **Line arrays**: at level (a), show 3 dB vs 6 dB slopes and a frequency-dependent transition. Do not output a single "line array SPL at x m" number at level (b), because the three published transition formulas differ by a factor of about 6 to 8. Level (c) would sum N point sources coherently (see Q4).

### Gaps
- No fetched source for "sensitivity (dB SPL @1 W/1 m) + 10·log10(P)" or for DI = 10·log10(Q). Both are textbook-standard [L]. Cite Long, *Architectural Acoustics*, or Davis & Patronis, *Sound System Engineering*, after checking.
- No quantified typical error for the point-source model versus measurement (power compression, near field of large horns).
- The full ISO 9613-1 validity table (temperature −20 to +50 °C, humidity 10–100 %, and so on) was not read directly; the standard is paywalled. [L]

---

## Q2. Total SPL in a room: diffuse-field / statistical model (Hopkins-Stryker, room constant, critical distance), Sabine vs Eyring, and failure modes

### Takeaway
Hopkins-Stryker plus Sabine/Eyring is a legitimate level-(b) model in mid/high frequencies for "reasonably shaped" rooms above the Schroeder frequency. It gives a spatially averaged reverberant level, not the level at a specific seat. It fails below f_s = 2000·√(T/V), in coupled or very non-diffuse rooms, and with highly non-uniform absorption. For the game: label it "average room estimate".

### Cited Findings
- **Hopkins-Stryker (as given):** Lp = LN + 10·log(D/(4πr²) + 4/R), with LN the sound power level, R = A/(1 − α_m) = ΣSiαi/(1 − α_m) (m² Sabine), and α_m the mean absorption coefficient. [H] — [Engineering ToolBox](https://www.engineeringtoolbox.com/sound-propagation-indoor-d_72.html)
- **Worked example on that page:** LN = 90 dB, A = 12.2 m², α_m = 0.2, R ≈ 15.3, r = 2 m, D = 1. The page states Lp ≈ 84.8 dB. Recomputing gives 10·log(1/(4π·4) + 4/15.25) = 10·log(0.0199 + 0.2623) ≈ −5.50 dB, so **Lp ≈ 84.5 dB**. The page appears to contain an arithmetic slip [H, recomputed]. A useful unit-test case: assert 84.5 ± 0.1 dB and document the discrepancy.
- **Assumptions of Hopkins-Stryker** rely on a local spatial average around the measurement point. A BYU thesis found that small local spatial averages improved agreement, and that generalised energy density did better than squared pressure. [M] — [BYU ScholarsArchive etd/5724](https://scholarsarchive.byu.edu/etd/5724) (search snippet)
- **Sabine:** T60 = (24·ln10/c20)·V/(S·a) ≈ 0.1611·V/(S·a). It has no room-shape or air-loss term ("does not take into account room shape or losses from the sound traveling through the air (important in larger spaces)"). It is suited to live rooms and over-predicts T in small, absorptive rooms. [H] — [Wikipedia, "Reverberation", section Sabine equation](https://en.wikipedia.org/wiki/Reverberation)
- **Eyring:** T60 ≈ −0.161·V/(S·ln(1 − a)). It is derived from an image-source argument, is more valid for small, highly absorptive rooms, and converges to Sabine for live rooms. It is used for control rooms and home studios. [H] — same page, section Eyring equation.
- **Critical distance:** d_c = ¼·√(γA/π) ≈ 0.057·√(γV/RT60), assuming a diffuse reverberant field and using Sabine's relation RT60 = V/(6A) (sic, as printed). [H] — [Wikipedia, "Critical distance"](https://en.wikipedia.org/wiki/Critical_distance). Note: the Reverberation article gives the same 0.057·√(V/RT60) for γ = 1. [H]
- **Schroeder frequency:** f_s = 2000·√(T/V) (T in s, V in m³). It marks the transition from modal behaviour below to statistical behaviour above. The criterion is about 3 overlapping modes per modal bandwidth; Schroeder's 1954 version used 10-fold overlap, giving the constant 4000. "Diffuse-field formulas like Sabine are unreliable below the Schroeder frequency." [M] — [akutek.info, "Stochastic nature of room acoustics"](https://akutek.info/articles_files/stochastics.htm); [samesound, "The transition frequency"](https://acoustic.samesound.ru/en/learn/schroeder-frequency) (search snippets)
- **Worked example:** V = 45 m³, RT60 = 0.4 s gives f_s ≈ 189 Hz. A large concert hall gives about 23 Hz. [M] — same sources. Recomputed: 2000·√(0.4/45) = 188.6 Hz ✓.
- **The Schroeder frequency is a soft limit.** One article argues it works better as a lower limit for the "HF" region than as an upper limit for the "LF" region, and measured no observable crossover in one room. [M] — [akutek.info](https://akutek.info/articles_files/stochastics_2.htm)
- **Geometric and statistical models break down outside mid frequencies.** In the 3rd round robin, "most algorithms produced clear model errors once geometrical-acoustics assumptions broke down" and were unreliable "for room acoustic parameters outside the mid-frequency range". [H] — [Brinkmann et al. 2019, JASA 145(4):2746–2760, doi:10.1121/1.5096178, CC BY 4.0](https://depositonce.tu-berlin.de/items/9b719f33-8772-4739-920a-c4ade8a48572/full)

### Inferences
- **Level (b) room calculator**: inputs V, surfaces with α per octave band, source power or sensitivity, Q, and r. Outputs T (Sabine and Eyring both shown; warn when ᾱ > about 0.2 that they diverge), R, d_c, Lp(r), and f_s. Grey out any band below f_s with a "modes dominate" label.
- **Level (a) modes**: for rectangular rooms the axial/tangential/oblique mode list f = (c/2)·√((nx/Lx)² + (ny/Ly)² + (nz/Lz)²) is a valid illustrative tool [L, Rayleigh formula, not fetched]. Showing a "mode map" is honest; predicting the level at a seat from it without damping data is not.
- **Do not claim** a level at a specific seat in coupled spaces (stage house plus hall, open-plan with alcoves), long or flat rooms (factory, corridor), or rooms with all absorption on one surface (classroom with an absorbent ceiling only). These are classic non-diffuse cases where Sabine/Eyring errors can be large. No numeric error is sourced here.

### Gaps
- Eyring-based room constant, Millington-Sette and Fitzroy/Arau-Puchades formulas for non-uniform absorption were not fetched. Arau-Puchades is implemented in the MIT-licensed "band" simulator (see Q5).
- No sourced numeric typical error of Sabine/Eyring versus measurement (often quoted as ±10–20 % in diffuse rooms [L]).
- The Kuttruff (*Room Acoustics*, CRC) and Long (*Architectural Acoustics*, Academic Press) publisher pages were not fetched in this session.

---

## Q3. STI and STIPA (IEC 60268-16), qualification bands, voice-alarm targets, prediction from RT and SNR, STIPA(IR)

### Takeaway
IEC 60268-16 is at **Edition 5 (2020)**, with a corrigendum from 2025-07 folded into the copy sold today. The bad/poor/fair/good/excellent bands are at 0.30/0.45/0.60/0.75. Since Ed. 4 (2011) there is also a letter-category scale from U to A+. The standard itself sets no voice-alarm pass criteria: the 0.50 average / 0.45 minimum targets come from application standards (CEN/TS 54-32:2015, NFPA 72). The RT+SNR MTF formula is a diffuse-field, exponential-decay idealisation suitable for level (b) as an "upper bound" STI. It cannot see echoes, direct-sound benefit or loudspeaker coverage, which need IR-based (level (c)) STI.

### Cited Findings
- **Edition:** IEC 60268-16:2020 cancels and replaces the fourth edition of 2011. Changes include a new male speech test spectrum, removal of the female spectrum and weighting factors, verification information for STI meters, and updated STI relationships in Annex E. A corrigendum from 2025-07 is included in the copy sold today. [M] — [AFNOR boutique IEC 60268-16:2020](https://www.boutique.afnor.org/en-gb/standard/iec-60268162020/sound-system-equipment-part-16-objective-rating-of-speech-intelligibility-b/xs137999/250690); [IEC webstore 26771](https://webstore.iec.ch/en/publication/26771) (search snippets)
- **No certification criteria in the standard:** it "does not provide STI criteria for certification of transmission channels (e.g. criteria for a voice-alarm system)", but Annex G gives typical application values. [M] — same listing.
- **Qualification table (attributed to IEC 60268-16), native listeners** [H] — [Wikipedia, "Speech transmission index"](https://en.wikipedia.org/wiki/Speech_transmission_index):

  | STI | Quality | Syllables | Words | Sentences |
  |---|---|---|---|---|
  | 0–0.3 | bad | 0–34 % | 0–67 % | 0–89 % |
  | 0.3–0.45 | poor | 34–48 % | 67–78 % | 89–92 % |
  | 0.45–0.6 | fair | 48–67 % | 78–87 % | 92–95 % |
  | 0.6–0.75 | good | 67–90 % | 87–94 % | 95–96 % |
  | 0.75–1 | excellent | 90–96 % | 94–96 % | 96–100 % |

- **Letter scale:** Ed. 4 (2011) introduced the U to A+ categories. The band values were not available as text. [H, existence only]
- **History:** RASTI was standardised in 1988 and declared obsolete in June 2011. Rev. 3 added level-dependent auditory masking; rev. 4 added methods for non-native and hearing-impaired listeners. [H] — Wikipedia STI.
- **STIPA:** a simplified, single-measurement STI that modulates each of 7 octave bands with 2 of 14 modulation frequencies, so the MTF matrix is sampled sparsely. A measurement takes about 15–25 s. [H] — Wikipedia STI. The full STI uses 14 modulation frequencies (0.63–12.5 Hz, ⅓-octave spacing) × 7 octave bands (125 Hz–8 kHz). [M] — [IOA, Barnett, BS 7443 overview](https://www.ioa.org.uk/system/files/publications/PW%20BARNETT%20BS%207443%20SOUND%20SYSTEMS%20FOR%20EMERGENCY%20PURPOSES%20AND%20SPEECH%20INTELLIGIBILITY%20-%20AN%20OVERVIEW.pdf); [sonicfield library summary of Houtgast & Steeneken](https://labs.sonicfield.org/library/the-modulation-transfer-function-as-a-link-between-room-acoustics-and-speech-int) (snippets)
- **Indirect / IR method (the basis of "STIPA(IR)" and "STI from IR"):** assumes a linear channel and derives the full MTF matrix from an impulse response (Schroeder's method). It is preferred in very large spaces with likely echoes, but can mislead when non-linear components such as loudspeakers are in the chain. IEC 60268-16 rev. 4 does not prohibit it for PA but "warns that critical analysis is required". STIPA is generally preferred with loudspeakers. [H] — Wikipedia STI.
- **Voice alarm targets.** CEN/TS 54-32:2015 (planning, design, installation, commissioning, use and maintenance of voice alarm systems) has a normative annex on speech intelligibility measurement. [M] — [SAI Global CEN/TS 54-32:2015](https://infostore.saiglobal.com/en-au/standards/cen-ts-54-32-2015-341067_saig_cen_cen_781447/); [BSI Knowledge](https://knowledge.bsigroup.com/products/fire-detection-and-fire-alarm-systems-planning-design-installation-commissioning-use-and-maintenance-of-voice-alarm-systems)
  - A summary of UNE 23007-32 / CEN TS 54-32 says "the average speech intelligibility must be higher than 0,5 STI in 90% of the enclosure" and that "0,45 STI is the minimum intelligibility allowed". It also covers Acoustically Differentiable Areas (ADA), multiple evenly distributed points per ADA, measurement heights of 1.6 m standing and 1.2 m seated, and §8.4.5 for the procedure. It notes UNE EN 60268-16:2011 recommends a minimum of 0.46 STI for VA. STIPA is accepted; RASTI and STITEL are not. [H, secondary vendor source] — [LDA Audiotech, "Intelligibility in voice evacuation systems" (2020-12-16)](https://lda-audiotech.com/en/2020/12/16/intelligibility-in-voice-evacuation-systems/)
  - NFPA 72 (US): at least 90 % of measurement locations must have STI ≥ 0.45, and the average must be ≥ 0.50. [M] — [patent US9026439 citing NFPA](https://patents.google.com/patent/US9026439) (snippet)
  - BS 5839-8:2023 renamed ADA to ADS (Acoustically Distinguishable Space). Its thresholds were not found. [M] — [Hawkins](https://www.hawkins.biz/?p=28168)
  - **EN 54-24 is a loudspeaker product standard, and ISO 7240-19 is the ISO design/installation code for sound systems for emergency purposes. Neither was verified here as the source of the 0.50 figure**; the verifiable European source is CEN/TS 54-32. [L for the EN 54-24 / ISO 7240-19 roles]
- **Prediction from RT and SNR.** The MTF concept quantifies modulation loss from reverberation and noise (Houtgast & Steeneken, JASA 1985). A simplified model assumes exponential decay; one IOA paper writes the SNR term with B = 10^(0.1·S/N). [M] — [sonicfield library](https://labs.sonicfield.org/library/the-modulation-transfer-function-as-a-link-between-room-acoustics-and-speech-int); [IOA, Doany, "Interpretation of STI measurements in practise"](https://www.ioa.org.uk/system/files/publications/P%20DOANY%20INTERPRETATION%20OF%20STI%20MEASUREMENTS%20IN%20PRACTISE.pdf) (snippet; the URL now returns 404)
  - The formula **m(F) = [1 + (2πF·T/13.8)²]^(−1/2) · [1 + 10^(−SNR/10)]^(−1)** is the widely cited Houtgast-Steeneken diffuse-field form; 13.8 = 6·ln10 comes from the 60 dB decay. **[L] — I could not extract it verbatim from any fetched source in this session** (the PDFs that likely contain it were image-based or returned 404). Primary references to check: Houtgast, Steeneken & Plomp (1980), *Acustica* 46:60–72, and IEC 60268-16 annexes.
  - The remaining STI steps [L, same caveat]: apparent SNR = 10·log10(m/(1 − m)), clipped to ±15 dB; TI = (SNR_app + 15)/30; average TI over the modulation frequencies; weight and sum over octave bands (with redundancy correction in rev. 2+); and level-dependent masking plus the hearing threshold in rev. 3+.
- **Accuracy of model-based STI.** Bose (Jacob, Birkle & Ickler, AES preprint, 1990) claims its prediction "without in-room measurements" is about as accurate as predictions from in-room measurements. It notes an earlier Houtgast/Steeneken program was accurate only for "an omnidirectional source in a rectangular room". No numeric error was extractable. [H, partial text] — [Bose Professional white paper](https://assets.boseprofessional.com/m/2b93cf6a7a791d50/original/wp_sti_prediction_without_measurements_1.pdf)
- **Echoes over 100 ms** are a known limit (RASTI/STIPA issues with strong echoes). [H] — Wikipedia STI.

### Inferences
- **Level (a)**: an STI "gauge" driven by RT and SNR sliders using the m(F) formula, showing the trend that both reverberation and noise lower STI. Safe claim: "illustrative STI from reverberation and noise only".
- **Level (b)**: the same formula per octave band (125 Hz–8 kHz, 14 F values) with the [L] STI steps, unit-tested against IEC 60268-16 annex examples once obtained. Safe claim: "diffuse-field estimate; ignores direct sound, echoes and loudspeaker coverage. Real STI near a loudspeaker is usually higher, and with late echoes lower." Do **not** label results "EN 54 compliant" or "voice alarm pass/fail". Instead say "the 0.50 target used by CEN/TS 54-32 and NFPA 72 for voice alarm".
- A direct-sound extension (m depends on the direct-to-reverberant ratio, e.g. the Doany paper "simple expressions for STI as a function of RT, D/R ratio and SNR") exists. [M] — [IOA, Doany, "A comparison of STI and %ALcons"](https://www.ioa.org.uk/system/files/publications/P%20DOANY%20A%20COMPARISON%20OF%20STI%20AND%20ALCONS%20APPLICATIONS%20IN%20SPEECH%20INTELLIGIBILITY%20ANALYSIS.pdf). The formula was not extracted.
- **Level (c)**: compute the MTF from a simulated IR via Schroeder's integral, m(F) = |∫h²(t)e^(−j2πFt)dt| / ∫h²(t)dt [L], plus the SNR term. That is the "STI(IR)/STIPA(IR)" equivalent, and it inherits the simulation's errors (see Q5/Q7).

### Gaps
- The exact m(F) formula, the STI steps and the U–A+ category boundaries were not verified from primary text [L]. Obtain IEC 60268-16:2020 (Annex A and the annex on the simplified model) or Houtgast/Steeneken 1980/1985.
- The ISO 7240-19 STI target and the exact clause of CEN/TS 54-32 (normative annex) were not read; the 0.50/0.45/90 % values are from secondary sources.
- No numeric typical error of RT/SNR-based STI predictions versus measurement was found.
- The meaning of "STIPA(IR)" as a vendor term (e.g. in EASE, Odeon or NTi tools) was not confirmed; the indirect method is confirmed (above).

---

## Q4. Frequency handling: octave bands, broadband summation, A/C weighting, coherent vs energetic summation

### Takeaway
Compute everything per octave band. Use 125 Hz–8 kHz, the 7 STI bands; 250 Hz–4 kHz is a common reduced set for RT. Sum to broadband energetically (10·log10 Σ10^(L/10)) after applying A or C weighting at band centres. Sum several loudspeakers energetically by default at level (b). Coherent (complex) summation is valid only for correlated signals at a single frequency or a narrow band with known phase/delay, so it belongs at levels (a) (interference demo) and (c).

### Cited Findings
- **A-weighting (IEC 61672-1, analytic):** R_A(f) = 12194²·f⁴ / [(f² + 20.6²)·√((f² + 107.7²)(f² + 737.9²))·(f² + 12194²)]; A(f) = 20·log10 R_A(f) + 2.00 dB. [H] — [Wikipedia, "A-weighting", section Function realisation](https://en.wikipedia.org/wiki/A-weighting)
- **C-weighting:** R_C(f) = 12194²·f² / [(f² + 20.6²)(f² + 12194²)]; C(f) = 20·log10 R_C(f) + 0.06 dB. The offsets normalise to 0 dB at 1 kHz. [H] — same.
- **STI frequency range:** 7 octave bands, 125 Hz to 8 kHz. [M] — [IOA, Barnett BS 7443](https://www.ioa.org.uk/system/files/publications/PW%20BARNETT%20BS%207443%20SOUND%20SYSTEMS%20FOR%20EMERGENCY%20PURPOSES%20AND%20SPEECH%20INTELLIGIBILITY%20-%20AN%20OVERVIEW.pdf); Wikipedia STI (7 bands) [H].
- **Round Robin 1** compared parameters only in the 1 kHz octave band. Round Robin 2 used six octave bands. [H] — [PTB Round Robin page](https://www.ptb.de/cms/ptb/fachabteilungen/abt1/fb-16/ag-163/round-robin-in-room-acoustics.html); [M] Bork IOA paper snippet.

### Inferences
- **Energetic summation** L_tot = 10·log10 Σ 10^(Li/10) [L, textbook]: valid for uncorrelated sources (different programme material, or noise), for broadband sums across bands, and as the spatial or frequency average of correlated sources (comb-filter peaks and dips average out over an octave). This is the level (b) default for "two speakers on stage".
- **Coherent summation** p_tot = |Σ p_i·e^(−jk r_i)| [L]: two identical in-phase sources give +6 dB on axis versus +3 dB energetic, and cancellation where the path difference is λ/2. Use it in a level (a) interference/comb-filter visualiser at a single frequency, and at level (c) for arrays and subwoofer cardioid setups. Claiming coherent results at octave-band level without phase data would be dishonest.
- Octave-band A-weighting values at 125 Hz–8 kHz (−16.1, −8.6, −3.2, 0, +1.2, +1.0, −1.1 dB) are commonly tabulated [L]. Compute them from the formula above in a unit test rather than hard-coding them.

### Gaps
- No fetched source for the 250 Hz–4 kHz convention (e.g. ISO 3382-2 "engineering" method or the T_mf averages) [L].
- No source fetched for coherent-summation formulas or for the correlation rule of thumb.

---

## Q5. Ray tracing and image-source methods: what they add, cost, open-source/browser implementations and licences

### Takeaway
Image-source (ISM) and ray/beam tracing add what statistical models cannot: position-dependent early reflections, echoes, shadowing by geometry, and an impulse response from which C50/C80/D50 and IR-based STI can be computed. They are still geometric-acoustics methods, unreliable at low frequencies and for diffraction; even the best commercial tools produce audibly wrong auralisations (Round Robin 3). For a browser game, the realistic options are a shoebox ISM (cheap, exact for rectangular rooms with specular reflections) and porting or reference-testing against MIT-licensed code.

### Cited Findings
- **pyroomacoustics**: Python package with an image-source RIR generator; the core ISM and ray tracing are implemented in C++ in newer versions. Licence MIT (per ecosyste.ms metadata; LICENSE file not opened). Citation: Scheibler, Bezzam & Dokmanić, "Pyroomacoustics: A Python package for audio room simulations and array processing algorithms", Proc. IEEE ICASSP 2018. [M] — [pyroomacoustics docs](https://pyroomacoustics.readthedocs.io/); [ecosyste.ms LCAV/pyroomacoustics](https://awesome.ecosyste.ms/projects/github.com%2Flcav%2Fpyroomacoustics)
- **band (gregzanch)**: a browser room-acoustics simulator (live demo at band-gregzanch.vercel.app) with an interactive 3D editor. Solvers: Sabine, Eyring and Arau-Puchades RT60; stochastic ray tracing to an IR; image source for early reflections; FDTD for modal analysis. **MIT licence.** Work in progress (v0.1.0, 61 commits, 2 stars); it rewrites the older "cram". [H] — [github.com/gregzanch/band](https://github.com/gregzanch/band)
- **Wayverb**: hybrid waveguide plus ray tracer on GPU (C++/JUCE), not under active development. Licence not confirmed. [M] — [github.com/Alemusica/wayverb (fork)](https://github.com/Alemusica/wayverb)
- **GSound-SIR**: Python spatial-IR ray tracing, Apache 2.0. [M] — [arXiv 2503.17866](https://www.arxiv.org/pdf/2503.17866)
- **RoomAcoustiC++**: C++ real-time room acoustics, GPL v3. [M] — [roomacousticpp.readthedocs.io](https://roomacousticpp.readthedocs.io/)
- **Aussal & Gueguen** Matlab/Blender ray-tracing/ISM hybrid, GPL 3.0. [M] — [ar5iv 1811.05784](https://ar5iv.labs.arxiv.org/html/1811.05784)
- **Limits of geometric methods.** Round Robin 3: errors appear when geometrical-acoustics assumptions break down. Auralisations are "plausible but not authentic"; differences from measured IRs "always clearly audible". The main causes were simplified random-incidence absorption and scattering data and weak modelling of diffraction in early reflections. [H] — [Brinkmann et al. 2019 (CC BY 4.0)](https://depositonce.tu-berlin.de/items/9b719f33-8772-4739-920a-c4ade8a48572/full)
- **History of ISM validity:** Eyring's T formula itself derives from an image-source argument. [H] — [Wikipedia Reverberation](https://en.wikipedia.org/wiki/Reverberation)

### Inferences
- **Cost**: ISM image count grows roughly as (order)³ in a shoebox and exponentially with order in arbitrary polyhedra [L, Allen & Berkley 1979 / Borish 1984, not fetched]. A shoebox ISM to order 10–20 at a few receivers is feasible in a browser in JS/WASM; arbitrary geometry plus ray tracing (10⁴–10⁵ rays) is feasible with WebGL/WebGPU or Web Workers but needs care.
- **Recommended path**: write a shoebox ISM in TypeScript and unit-test it against pyroomacoustics output (MIT, so test vectors can be generated and shipped). Study band's MIT code for browser architecture. Avoid copying GPL code (RoomAcoustiC++, Aussal) into a non-GPL game.
- **Safe claims at level (c)**: "Geometric simulation: early reflections and echo pattern are indicative; levels below about 250 Hz and diffraction effects are not reliable." Do not claim "auralisation = what the room sounds like".
- **Not found**: Google Resonance Audio (Apache 2.0) and Steam Audio (Apache 2.0) are known spatial-audio engines with some reverb/geometry features [L, not verified this session].

### Gaps
- No mature, browser-native, permissively licensed room-acoustics ray tracer was confirmed besides the early-stage "band".
- Licences of Wayverb, I-Simpa, Pachyderm and EVERTims were not checked.
- No numeric ISM/ray-tracing benchmark timings in JS were found.

---

## Q6. Open data: absorption coefficients and loudspeaker directivity

### Takeaway
The cleanest openly licensed absorption data is the **BRAS database (TU Berlin, CC BY-SA 4.0)**, which includes fitted absorption and scattering data for its reference rooms. PTB publishes the Round Robin 3 studio absorption/scattering coefficients as Excel files with no stated licence. CLF loudspeaker files are produced by manufacturers and the free viewer is freeware, but no licence for the format or data was found. For an open game, synthetic directivity models (piston, cardioid) avoid licensing issues.

### Cited Findings
- **BRAS (Benchmark for Room Acoustical Simulation):** freely available, CC BY-SA 4.0. It contains reference scenes that isolate single phenomena (single reflection, diffraction at an infinite wedge) plus complex rooms. The complex rooms have higher measurement uncertainty, so they are not direct references. Fitted random-incidence absorption coefficients for Complex Room 2 have been used in later studies. A 2026 extension, RS8 (finite curved reflector), adds about 3,000 measured IRs. [M] — [BRAS on DepositOnce](https://depositonce.tu-berlin.de/items/38410727-febb-4769-8002-9c710ba393c4/full); [BRAS concept paper](https://depositonce.tu-berlin.de/items/457e9d28-8ce0-4f57-a6b2-08b1f57efa53/full); [BRAS RS8](https://depositonce.tu-berlin.de/items/326fed8c-636a-47f2-977d-b4fd6a0ce771/full) (search snippets; licence stated in the repository record)
- **PTB Round Robin 3 data:** studio coordinates and absorption/scattering coefficients (phase 3) plus measurement results, as Excel 97 downloads. **No licence or terms stated.** PTB has stopped room-acoustics research and gives no further support. [H] — [PTB, "Round Robin in Room Acoustics"](https://www.ptb.de/cms/ptb/fachabteilungen/abt1/fb-16/ag-163/round-robin-in-room-acoustics.html)
- **CLF (Common Loudspeaker Format):** a platform-independent loudspeaker data format with polar and balloon data (e.g. 5° resolution). It can be produced by manufacturers or independent labs, and the CLF viewer is freeware (clfgroup.org). Early providers included Bose, QSC, Martin Audio and Yamaha. CATT-A, Ulysses, LARA, Odeon and CadnaA import it. **No licence terms for the spec or the data were found.** [M] — [ProSoundTraining, "What is the Common Loudspeaker File Format"](https://www.prosoundtraining.com/?p=2649); [CadnaA docs, user-defined directivities](https://doku.datakustik.com/CadnaA/en/RichtwirkungFrequenz.html)

### Inferences
- **Absorption tables**: ship a small table that cites its origin per row: BRAS data (CC BY-SA, so share-alike obligations apply to that data file) and the textbook tables in Long or Kuttruff (facts are not copyrightable, but copying a whole table verbatim may be a problem; cite and paraphrase values) [L, legal note, not verified].
- **Synthetic directivity** [L, standard textbook models, not fetched]: the baffled circular piston D(θ) = 2·J1(ka·sinθ)/(ka·sinθ); cardioid D(θ) = (1 + cosθ)/2; and Q from D by integration. These are free of data licensing and good for level (a)/(b) teaching ("why a speaker beams at high frequencies").
- Do not ship manufacturer CLF/GLL files without each manufacturer's permission.

### Gaps
- clfgroup.org licence terms not fetched.
- The "PTB absorption data" the brief mentions was found only as the Round Robin 3 Excel files, which have no licence.
- No openly licensed broad material-absorption database (hundreds of materials) was confirmed.

---

## Q7. Validation: benchmark cases for unit tests

### Takeaway
Use three tiers of tests. (1) Closed-form arithmetic tests built from the worked examples below, which are deterministic. (2) Cross-implementation tests against pyroomacoustics (MIT) for shoebox ISM. (3) Measurement benchmarks (BRAS CC BY-SA; PTB Round Robin) used only qualitatively. The Round Robins show that even professional tools disagree with measurement, so they are not pass/fail references for a game.

### Cited Findings
- **PTB Round Robins** [H] — [PTB](https://www.ptb.de/cms/ptb/fachabteilungen/abt1/fb-16/ag-163/round-robin-in-room-acoustics.html):
  - RR1 (1994): 16 participants from 7 countries, PTB auditorium. Compared T30, EDT, D50, C80, TS, G, LF and LFC at 1 kHz. The spread was so large that "a reliable prediction for this room seemed impossible".
  - RR2 (1996–98): 16 participants from 9 countries, 13 programs, ELMIA hall (Jönköping). Much better results, but the complex design caused problems.
  - RR3 (from 1999): PTB studio in 3 phases (uniform absorption → real α → full detail).
  - Publications: Lundeby et al. 1995; Bork 2000; Bork 2005, Parts I & II.
- RR2: nine ISO 3382 parameters, six octave bands, 12 source–receiver pairs. [M] — [Bork, IOA proceedings](https://www.ioa.org.uk/system/files/proceedings/i_bork_simulation_and_measurement_of_auditorium_acoustics_-_the_round_robins_on_room_acoustical_simulation.pdf) (snippet; the PDF returned 404 on fetch)
- **Round Robin (TU Berlin/RWTH 2019):** 6 scenes plus 3 real rooms. Findings as quoted in Q5. Paper CC BY 4.0, data in BRAS (CC BY-SA 4.0). [H]/[M] — [Brinkmann et al. 2019](https://depositonce.tu-berlin.de/items/9b719f33-8772-4739-920a-c4ade8a48572/full)
- **Deterministic worked examples usable as unit tests:**
  1. Hopkins-Stryker: LN 90 dB, A 12.2 m², ᾱ 0.2, r 2 m, Q 1 gives R = 15.25 m² and Lp = 84.5 dB (the source page states 84.8; recomputed). [H] — [Engineering ToolBox](https://www.engineeringtoolbox.com/sound-propagation-indoor-d_72.html)
  2. Schroeder frequency: V 45 m³, T 0.4 s gives 188.6 Hz. [M] — [samesound](https://acoustic.samesound.ru/en/learn/schroeder-frequency)
  3. Line array transition (Q-SYS A²/λ): A = 2 m gives 5.8 m @ 500 Hz, 11.6 m @ 1 kHz, 23.3 m @ 2 kHz (c ≈ 343 m/s). [M] — [Q-SYS](https://www.qsys.com/resource-files/whitepapers/q_wp_cin_linearraysincinema.pdf)
  4. A/C weighting: A(1000 Hz) = 0.00 dB and C(1000 Hz) = 0.00 dB (± rounding) by construction of the +2.00/+0.06 offsets. [H] — [Wikipedia A-weighting](https://en.wikipedia.org/wiki/A-weighting)
  5. Sabine vs Eyring convergence: for small ᾱ, −ln(1 − ᾱ) → ᾱ, so the two T values converge. Test that their ratio approaches 1 as ᾱ → 0. [H] — [Wikipedia Reverberation](https://en.wikipedia.org/wiki/Reverberation)
  6. ISO 9613-1: compare against the standard's Table 1 values or the sengpielaudio calculator at, for example, 20 °C, 50 % RH, 101.325 kPa [values not retrieved; generate the test vector from the calculator]. [M]
  7. STI: the boundary values 0.30/0.45/0.60/0.75 map to their labels; the m(F) formula with SNR → ∞ and T → 0 gives m = 1 and STI = 1. [H for bands; L for the formula]

### Inferences
- Tolerance policy for a game: arithmetic tests ±0.1 dB; cross-implementation ISM tests (pyroomacoustics) on energy decay or T30 within a few percent; measured benchmarks used only to show "how far simple models are off" in a teaching panel, without pass/fail.
- The ISO 3382 parameters (C80, D50, EDT, G) are appropriate outputs only at level (c).

### Gaps
- Numeric RR deviation statistics (e.g. in JND units) were not retrieved; the Bork 2005 papers (Acta Acustica united with Acustica) were not accessed.
- No textbook worked example (Kuttruff/Long) was retrieved verbatim; publisher pages not fetched.
- The French BTS MAV référentiel (Éducation nationale) was not searched in this session for acoustics competencies. This is an open item for curriculum alignment.
