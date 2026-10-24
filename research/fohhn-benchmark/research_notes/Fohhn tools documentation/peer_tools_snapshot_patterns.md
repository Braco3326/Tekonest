# Peer loudspeaker-prediction tools: snapshot, scene and version patterns (benchmark for Fohhn Designer and input for TekPractice)

Access date for every source below: 2026-10-24. Labels: **[D]** = Documented (official source and section named), **[I]** = Inferred (reasoned from documented facts), **[U]** = Unknown (not found). Everything is paraphrased and no vendor assets are reproduced. Where a source is press or a third party rather than the vendor's own manual, the line says so.

### Source register

| # | Publisher | URL | Section(s) used | What it covers |
|---|---|---|---|---|
| S1 | Meyer Sound | https://docs.meyersound.com/products/en/user-guide---mapp-3d.html | Saving projects; Pressure Map Settings; SPL tab parameters / Resolution; Processor Settings > Snapshot Library tab; Measurement View > Trace management; Export documents | Official MAPP 3D user guide |
| S2 | d&b audiotechnik | https://www.dbaudio.com/assets/products/downloads/software/arraycalc/dbaudio-release-notes-arraycalc-v10.26.4.pdf | Release notes V10.x (2017–2026), multiple entries | ArrayCalc 3D plot memories, snapshots, project report, colour scale, cloud save |
| S3 | d&b audiotechnik | https://www.dbaudio.com/assets/products/downloads/ti/dbaudio-technical-information-ti385-10.4-en.pdf | §1.1 ArrayCalc | ArrayCalc scope (no snapshot or memory content) |
| S4 | AFMG | https://engineering.purdue.edu/ece40020/DesPrj/EASE_Focus_3_User_Guide.pdf (copy of the AFMG guide hosted by Purdue; the official download page is https://www.afmg.eu/en/ease-focus-3-users-guide) | §4.1 Mapping Toolbar; §4.2 Calculations Background; §4.3 Mapping Options; §4.4 Levels; §4.8 Sound Source Groups; §4.9 Audience Area Groups; §4.11 Creating Reports; shortcuts table | EASE Focus 3 user's guide |
| S5 | AFMG | https://www.afmg.eu/en/ease-focus-upgrade-history | v3.0.x–v3.1.310 entries | EASE Focus release history (report, XLD/XGLC export) |
| S6 | AFMG | https://www.afmg.eu/en/ease-upgrade-history | v5.53, 5.63, 5.68.3, 5.71, 5.74, 5.75, 5.82, 5.84 | EASE 5 Simulation Configurations, Acousteer real-time engine, colour scales, STI |
| S7 | AFMG | https://www.afmg.eu/en/version-comparison-ease and https://www.afmg.eu/en/ease | Feature lists | EASE 5 saving, loading and labelling of mapping results; legend colours and isolines (seen through search summary only) |
| S8 | AFMG | https://www.afmg.eu/en/speech-intelligibility-live-ease-584-brings-sti-mapping-acousteer-engine | News item | Real-time STI mapping in EASE 5.84 (seen through search summary only) |
| S9 | L-Acoustics | https://www.l-acoustics.com/products/soundvision/ | Product page feature list | Real-Time Mapping, delay mode, Installation Report, Bridge |
| S10 | FOH Magazine (article by Scott Sugden of L-Acoustics, 5 March 2019) | https://fohonline.com/articles/power-tools/the-art-of-noise-exploring-l-acoustics-soundvision/ | Whole article, Fig. 2A/B | Soundvision 3.1 mapping and coverage modes, iterations, Autosplay and Autofilter |
| S11 | Martin Audio (press release, 21 September 2026) | https://martin-audio.com/news/press-release/martin-audio-releases-next-generation-prediction-and-optimisation-software-display | Press release | DISPLAY 3 optimisation snapshots, Don't Care and Hard Avoid zones |
| S12 | ProSoundWeb (press) | https://www.prosoundweb.com/martin-audio-releases-display-3-audio-prediction-optimization-software/ | Article | DISPLAY 3 snapshot recall performance (seen through search summary only) |
| S13 | Adamson Systems | https://legacy.adamson.ai/product/system-control/blueprint-av | Product page | Blueprint AV capture function |
| S14 | JBL Professional | https://jblpro.com/products/venue-synthesis | Product page | Venue Synthesis feature list (seen through search summary only) |
| S15 | PTC Onshape | https://cad.onshape.com/help/Content/Document/versions_and_history.htm | Versions and history | Immutable versions, branches, workspaces, compare, restore, merge |
| S16 | Figma | https://help.figma.com/hc/en-us/articles/360038006754-View-a-file-s-version-history | Create and name versions; Restore a previous version; Duplicate a version | Autosave versus named versions; non-destructive restore |
| S17 | Wikipedia (secondary) | https://en.wikipedia.org/wiki/Speech_transmission_index | Rating table | STI quality bands per IEC 60268-16 |
| S18 | TW AUDiO (vendor quick start for EASE Focus) | https://twaudio.de/wp-content/-pdf_files/TW_AUDiO_Ease_Focus3_Quick_Setup_Guide_EN_1.0.pdf | Mapping / Level range | Recommended 30 dB mapping window (seen through search summary only) |

---

## Q1. L-Acoustics Soundvision: snapshots or configurations, how mappings are stored and compared, and what is frozen versus live

### Takeaway
L-Acoustics' public material presents Soundvision mapping as **live, real-time** prediction and lets you compare **several array iterations kept side by side in one project**. I found **no public documentation of a named "snapshot" feature** for Soundvision's acoustic state. Its official snapshot-like behaviour is a hand-off: Soundvision data goes downstream into LA Network Manager and L-ISA Controller.

### Cited Findings
- [D] The product page lists "Real-Time Mapping". It predicts SPL for one loudspeaker or the whole system over a chosen frequency range, displays results in dBA, dBC or unweighted dB, and has a delay mode for aligning sources. — [L-Acoustics, Soundvision product page (S9)](https://www.l-acoustics.com/products/soundvision/)
- [D] A mechanical "Installation Report" provides load-in information. "Bridge" imports Soundvision project data into Network Manager and L-ISA Controller. — [S9](https://www.l-acoustics.com/products/soundvision/)
- [D, vendor-authored press] Soundvision has two display modes: **Mapping** (high-resolution colour fields) and **Coverage** (low-resolution colour dots). A delay view marks in red the areas where two sources arrive at different times. — [FOH, Sugden 2019, Fig. 2A/B (S10)](https://fohonline.com/articles/power-tools/the-art-of-noise-exploring-l-acoustics-soundvision/)
- [D, vendor-authored press] Several array iterations can exist at once, and the user switches between them to judge which performs best. Gains and delays for each iteration can be reviewed and pre-aligned. EQ, gain, delay and presets can sync to LA Network Manager. — [S10](https://fohonline.com/articles/power-tools/the-art-of-noise-exploring-l-acoustics-soundvision/)
- [D, vendor-authored press] Autosplay sets enclosure angles to meet SPL targets in about 10 s and can be overridden by the user. Autofilter applies FIR correction for mid and high frequencies. — [S10](https://fohonline.com/articles/power-tools/the-art-of-noise-exploring-l-acoustics-soundvision/)
- [D] The 3.12 readme notes that in LA Network Manager 3.3.1, Autoclimate does not work unless Autofilter has been **recalculated** in Soundvision 3.9.0 or later. Derived data can therefore become stale across a version or tool hand-off. — [Soundvision 3.12.0 readme (Japanese, distributed by Bestec)](https://bestecaudio.com/wp/wp-content/uploads/Soundvision_3.12.0_readme_JP.pdf)

### Inferences
- [I] Soundvision's comparison model is **"keep several live alternatives in the scene and toggle between them"**, not "freeze a result image". Every alternative stays live, so editing one changes its map immediately.
- [I] The readme note on Autofilter recalculation shows a pattern worth copying: **derived artefacts (filters) carry a computed-with version** and must be regenerated when their basis changes. This is the "invalidate" concept TekPractice needs.

### Gaps
- [U] Whether Soundvision has a named snapshot or "configuration" list, how it stores mapping images, and its colour-scale settings (range, step). The online Soundvision Help was not found, and the readmes are in Japanese and focus on fixes.
- [U] Whether a difference (A–B) map exists in Soundvision.

---

## Q2. d&b ArrayCalc: snapshots and memories, and their comparison views

### Takeaway
ArrayCalc separates two concepts. **"3D plot memories"** are stored results, which can be printed and loaded back as a project state. **"Snapshots"** are a separate list of system and amplifier settings, apparently aimed at the R1 remote software. The live 3D plot and the memory views share one colour scale. A **"Project report"** window turns invalid states into warnings and errors you can click through to the cause.

### Cited Findings
- [D] Release notes record that 3D plot memories show venue elements and the mapping aligned correctly. They also record a fix for a crash when **loading a project from the 3D plot memory**, and a fix for adding planes after loading a memory. — [d&b ArrayCalc V10 release notes (S2)](https://www.dbaudio.com/assets/products/downloads/software/arraycalc/dbaudio-release-notes-arraycalc-v10.26.4.pdf)
- [D] A change in **colour scale** now applies to the 3D plot live view **and** to the 3D plot memory views. — [S2](https://www.dbaudio.com/assets/products/downloads/software/arraycalc/dbaudio-release-notes-arraycalc-v10.26.4.pdf)
- [D] Fixes listed: memory slots of the 3D plot were missing the **description of the simulated signal**; printouts from live and memory diagrams differed; and the "saving 3D plot to memory workflow" was optimised. — [S2](https://www.dbaudio.com/assets/products/downloads/software/arraycalc/dbaudio-release-notes-arraycalc-v10.26.4.pdf)
- [D] The Snapshot view now opens as a separate window from the main menu. A snapshot can be added quickly with a toolbar icon or Ctrl/Cmd+T. A confirmation dialog was added when deleting snapshots. Snapshot entries in Additional amplifier groups had wrong mute or invalid values fixed. Several fixes concern "conflicted snapshots" when the project is loaded in R1. — [S2](https://www.dbaudio.com/assets/products/downloads/software/arraycalc/dbaudio-release-notes-arraycalc-v10.26.4.pdf)
- [D] Project issues appear in a separate "Project report" window. Double-clicking an entry navigates to the source of the issue. A toolbar flag turns yellow for a warning and red for an error. "Validate project" moved into this window. Projects can be saved even with amplifier issues. — [S2](https://www.dbaudio.com/assets/products/downloads/software/arraycalc/dbaudio-release-notes-arraycalc-v10.26.4.pdf)
- [D] A 3D plot calculation is **interrupted** when a source group is duplicated, so an edit cancels a running calculation. Cloud and OneDrive save warnings were also fixed. — [S2](https://www.dbaudio.com/assets/products/downloads/software/arraycalc/dbaudio-release-notes-arraycalc-v10.26.4.pdf)
- [D] ArrayCalc calculates level distribution in 3D over the defined listening planes for selectable bands, and d&b states that its line arrays must be designed with ArrayCalc. — [d&b TI 385 v10.4, §1.1 (S3)](https://www.dbaudio.com/assets/products/downloads/ti/dbaudio-technical-information-ti385-10.4-en.pdf)

### Inferences
- [I] A memory captures the **result plus enough project state to be reloaded** ("load project from memory"), together with signal metadata. Its colour scale stays live, so memories can be compared on the same legend.
- [I] Because "snapshots" conflict in R1 and relate to amplifier groups and mutes, an ArrayCalc snapshot is most likely an **operational device-settings preset** (mute and level states sent to amplifiers), not an acoustic result.
- [I] Edits interrupt the calculation, so the live plot is recomputed on change. Memories are the frozen counterpart.

### Gaps
- [U] The exact number of memory slots, whether memories show an A/B difference, and the default dB range and step of the ArrayCalc colour scale. Detailed use is documented only in the in-app Help, which was not accessible.

---

## Q3. Meyer MAPP 3D, AFMG EASE Focus 3 and EASE 5, Martin Audio DISPLAY 3, Adamson Blueprint AV, JBL Venue Synthesis, Bose Modeler

### Takeaway
The tools fall into three patterns. **(a) Explicit "Predict" plus stored traces:** MAPP 3D. **(b) Live mapping plus saved visibility groups and presets:** EASE Focus, and EASE 5's Simulation Configurations, which AFMG itself says serve as both presets and saved results. **(c) Named optimisation snapshots or captures inside one model:** DISPLAY 3 and Blueprint AV. Only MAPP 3D documents a true overlay comparison, for virtual-microphone traces. No vendor documented a spatial difference map.

### Cited Findings

**Meyer Sound MAPP 3D**
- [D] Prediction runs on demand. PREDICT (Cmd-R) generates the pressure plot and CLEAR removes it. It needs a visible loudspeaker, a visible prediction plane, and an assigned, unmuted processor channel. Geometry must be flagged for prediction. — [MAPP 3D User Guide, Pressure Map Settings / Model View (S1)](https://docs.meyersound.com/products/en/user-guide---mapp-3d.html)
- [D] Changing the display **Resolution** only re-renders the existing data and does not recalculate. Pressure-map opacity is a display-only setting. Mesh density changes calculation time. — [S1](https://docs.meyersound.com/products/en/user-guide---mapp-3d.html)
- [D] SPL values apply to the predicted frequency range, not to broadband SPL. Broadband figures come from the Headroom tab. — [S1](https://docs.meyersound.com/products/en/user-guide---mapp-3d.html)
- [D] **Snapshot Library tab** (per processor): CREATE NEW stores all processor settings as a snapshot, each processor starts with a "Factory Defaults" snapshot, names are edited by double-clicking, UPDATE overwrites the selected snapshot with the current settings, and RECALL overwrites the processor with the snapshot. SAVE OUTPUT CHANNELS writes the output settings to a file. — [S1](https://docs.meyersound.com/products/en/user-guide---mapp-3d.html)
- [D] **Trace comparison:** "Store Live Trace" saves a named trace that includes both the Headroom and the Frequency/IFFT data. Up to **5 traces** (the live trace plus 4 stored) can be overlaid. Each trace is labelled by output channel, microphone and propagation delay, and has a dB offset, a show/hide toggle and a colour. Trace Management deletes traces. — [S1, Measurement View](https://docs.meyersound.com/products/en/user-guide---mapp-3d.html)
- [D] **Project versioning is a manual practice.** The guide advises saving early and often under versioned file names (v1, v2) as fallback points. A MAPP Backup folder is auto-saved every 10 min. Projects use the .mapp format. — [S1, Saving](https://docs.meyersound.com/products/en/user-guide---mapp-3d.html)
- [D] The project data model holds layers (visibility and lock), geometry with prediction, through and ground-plane flags, one DXF and one SKP import, loudspeaker systems (limit 50 per array), GALAXY processors, microphones (combined limit of 100 with geometry), and saved **cameras**. — [S1](https://docs.meyersound.com/products/en/user-guide---mapp-3d.html)
- [D] Exports include PNG or JPEG screenshots of the model and measurement views, microphone data as XLS, inventory as XLS, a processor patch list as PDF, a DXF of loudspeakers, and a per-system "Loudspeaker System Report" as PDF. — [S1, Export documents](https://docs.meyersound.com/products/en/user-guide---mapp-3d.html)

**AFMG EASE Focus 3**
- [D] The SPL mapping is shown with a SHOW MAPPING toggle. TYPE selects Z, A-weighting or Signal-to-Noise (Extended mode). FREQUENCY and BANDWIDTH select broadband, 1/3, 1 or 3 octaves. A **RELATIVE** option highlights points outside a tolerance around the average level. — [EASE Focus 3 User's Guide §4.1 (S4)](https://engineering.purdue.edu/ece40020/DesPrj/EASE_Focus_3_User_Guide.pdf)
- [D] Calculation is **progressive**: lower resolutions are computed and displayed first, while higher resolutions are still processing, with a progress bar showing the remaining time. Each resolution step multiplies the number of points by about 10. — [S4 §4.3](https://engineering.purdue.edu/ece40020/DesPrj/EASE_Focus_3_User_Guide.pdf)
- [D] The model covers the direct field only, plus ISO 9613 air attenuation. Shadowing, reflections and wind are not modelled. Summation is complex within an array. Between arrays it is a power sum at mid and high frequencies and complex at low frequencies by default, and the user can choose. — [S4 §4.2](https://engineering.purdue.edu/ece40020/DesPrj/EASE_Focus_3_User_Guide.pdf)
- [D] **Sound Source Groups** and **Audience Area Groups:** switch items on or off, then MANAGE GROUPS > STORE CURRENT SELECTION AS A GROUP under a name, and later recall, rename or delete it. Mappings are always calculated for all areas, including hidden ones, and the Distribution Graph includes hidden areas. — [S4 §4.8–4.9](https://engineering.purdue.edu/ece40020/DesPrj/EASE_Focus_3_User_Guide.pdf)
- [D] Undo and Redo are available (Ctrl+Z / Ctrl+Y). PASTE SETUP WITH OPTIONS copies chosen settings between arrays. — [S4 §2, shortcuts](https://engineering.purdue.edu/ece40020/DesPrj/EASE_Focus_3_User_Guide.pdf)
- [D] FILE > CREATE REPORT asks which details to include and saves as PDF or RTF. The document is meant to contain everything needed to install the system. — [S4 §4.11](https://engineering.purdue.edu/ece40020/DesPrj/EASE_Focus_3_User_Guide.pdf)
- [D] v3.1.220 (2023-08-23) added XLD export of the sound-system configuration: name, type, location, aiming, delay and filter curve for each source. v3.1.310 (2025-12-02) loads XGLC configurations from EASE, third-party tools or another Focus project. v3.1.1 added source status messages to the print report. — [EASE Focus upgrade history (S5)](https://www.afmg.eu/en/ease-focus-upgrade-history)

**AFMG EASE 5 (including the AURA / Room Mapping lineage)**
- [D] **Simulation Configurations** (v5.71, 2025-02-28) are calculation parameter sets stored in the project. They hold frequency, bandwidth, spatial resolution, colour scale and isolines, and the active or inactive state of loudspeakers and audience areas. They can be labelled, switched, copied, deleted and reset. AFMG says they "can be understood and used as both calculation presets and saved results." — [EASE 5 upgrade history (S6)](https://www.afmg.eu/en/ease-upgrade-history)
- [D] v5.74 made activating items within a configuration a **calculation setting**, so these changes are excluded from undo and redo. — [S6](https://www.afmg.eu/en/ease-upgrade-history)
- [D] Acousteer (v5.68.3, 2024-11-11) calculates direct-SPL maps fast enough that any parameter or model change applies instantly, in real time. v5.84 (2026-07-14) added real-time STI mapping according to IEC 60268-16:2020. The STI Optimizer (v5.53) adjusts signal and noise after the calculation. — [S6](https://www.afmg.eu/en/ease-upgrade-history); [AFMG news (S8)](https://www.afmg.eu/en/speech-intelligibility-live-ease-584-brings-sti-mapping-acousteer-engine)
- [D] Comparability tools: v5.68.3 added a user-defined scale that fixes the colours for the highest and lowest SPL "to make mapping displays comparable". v5.75 added a "Fixed Interval" setting for comparing spread when absolute levels differ. v5.82 stores Analyze-Location points so frequency-response curves can be overlaid. v5.63 renders many mapping pictures in one run for reports. — [S6](https://www.afmg.eu/en/ease-upgrade-history)
- [D, via search summary] EASE 5 can label, save and load mapping results. Legend colours and isoline steps are adjustable. — [AFMG version comparison / EASE page (S7)](https://www.afmg.eu/en/version-comparison-ease)

**Martin Audio DISPLAY 3**
- [D, press release] Multiple **optimisation snapshots** can be stored in one model, each holding different settings for different audience sizes or environmental conditions. The workflow is design, optimise, redesign and re-optimise to compare outcomes. Targets are user-defined SPL and frequency response. "Don't Care" areas are excluded from optimisation, and "Hard Avoid" zones can apply up to 30 dB of reduction. The release is dated 2026-09-21. — [Martin Audio press release (S11)](https://martin-audio.com/news/press-release/martin-audio-releases-next-generation-prediction-and-optimisation-software-display)
- [D, press via search summary] Performance was improved for snapshot recall and large project trees. — [ProSoundWeb (S12)](https://www.prosoundweb.com/martin-audio-releases-display-3-audio-prediction-optimization-software/)

**Adamson Blueprint AV**
- [D] A "capture function" saves several simulations for easy comparison. Simulations cover SPL, time and directivity, plus virtual microphones placed anywhere. — [Adamson Blueprint AV page (S13)](https://legacy.adamson.ai/product/system-control/blueprint-av)

**JBL Venue Synthesis**
- [D, via search summary of vendor page] Features include 3D Full System Mapping on audience and architectural planes with shadowing (pillars, balconies), Direct SPL Mapping from 1/12-octave data with pink-noise or speech signals, Headroom Analysis, a Delay Optimizer, Mechanics Mode with Array Statistics, export to Performance Manager and ArrayLink through QR codes, and SketchUp, DWG, DXF and EASE import. — [JBL Venue Synthesis page (S14)](https://jblpro.com/products/venue-synthesis)

### Inferences
- [I] **Two kinds of "snapshot" exist across the industry**, and TekPractice must not mix them up. *Device or operational snapshots* hold processor settings: MAPP 3D's Snapshot Library and, most likely, ArrayCalc's Snapshots. *Design or result snapshots* hold a captured simulation: ArrayCalc's 3D plot memories, Blueprint's captures, DISPLAY 3's optimisation snapshots and EASE 5's Simulation Configurations.
- [I] Every design or result snapshot shown keeps a **label** and **calculation metadata**. ArrayCalc fixed a missing signal description on memory slots, and EASE 5 configurations bundle frequency, bandwidth and resolution. A snapshot without its "how calculated" context is treated as a defect.
- [I] The trend is toward **live recompute**: EASE Acousteer, Soundvision real-time mapping, and EASE Focus's progressive resolution. Frozen copies are then needed *only* for comparison, which explains why comparison tools (fixed colour scale, overlays) appear alongside real-time engines.
- [I] MAPP 3D and EASE Focus keep display parameters (resolution step, colour) separate from calculation parameters. Changing the display never invalidates results. Changing the calculation (bandwidth, sources, geometry) does.

### Gaps
- [U] Bose Modeler: no current official documentation was retrieved. Modeler is believed to be a legacy EASE-derived tool, but that is unverified, so no claims are made.
- [U] JBL Venue Synthesis: whether it has a snapshot, capture or compare feature. Only the product feature list was available.
- [U] Martin Audio DISPLAY 3: the exact contents of a snapshot (geometry? DSP only?) and any compare view. The official help was not found; only press coverage.
- [U] No vendor document found describes a **spatial difference (A−B) map**. The closest are EASE 5's fixed colour scales and fixed interval, and MAPP 3D's trace overlay.

---

## Q4. Cross-tool view of state captured, immutability versus recalculation, naming and ordering, A/B, and report export

### Takeaway
Across the peers, the frozen artefact is either a **named result** (memory or capture) or a **named parameter set** (configuration, group or processor snapshot). The live model is recomputed after edits. Comparison relies on **shared colour scales** and **overlays**, not computed differences. Reports are snapshot-independent exports of the current state, as PDF, RTF, XLS or DXF.

### Cited Findings (summary matrix; every cell traces to the findings above)

| Tool | Snapshot-like object | What it captures | Frozen or live | Naming and order | Compare mechanism | Report export |
|---|---|---|---|---|---|---|
| MAPP 3D | Processor Snapshot; stored trace; versioned .mapp files | Processor settings; Headroom plus Frequency/IFFT trace data | Snapshot recalled by overwrite; prediction run on demand | Editable names; "Factory Defaults" seed | Overlay of up to 5 traces with dB offset and colour | PDF system report, patch list; XLS mics and inventory; DXF; PNG/JPEG — [S1](https://docs.meyersound.com/products/en/user-guide---mapp-3d.html) |
| ArrayCalc | 3D plot memory; Snapshot (device) | Plot plus loadable project state plus signal description; device settings | Memories frozen; colour scale live across memories | Slots; toolbar or Ctrl+T adds a snapshot; confirmation on delete | Same colour scale on live and memory views; printouts | "Project report" validation window; printing — [S2](https://www.dbaudio.com/assets/products/downloads/software/arraycalc/dbaudio-release-notes-arraycalc-v10.26.4.pdf) |
| EASE Focus 3 | Source and Area groups | On/off selection sets | Mapping live and progressive | Named groups | RELATIVE tolerance view; Distribution Graph | PDF/RTF report; XLD export — [S4](https://engineering.purdue.edu/ece40020/DesPrj/EASE_Focus_3_User_Guide.pdf), [S5](https://www.afmg.eu/en/ease-focus-upgrade-history) |
| EASE 5 | Simulation Configuration; saved mapping results | Calculation, display and active-item states | Real-time (Acousteer); configurations act as saved results | Labelled, copy, reset | Fixed colour scale; fixed interval; FR overlay | Batch picture rendering; XLD — [S6](https://www.afmg.eu/en/ease-upgrade-history) |
| Soundvision | Multiple iterations in one project | Arrays, gains, delays | Real-time | Unknown | Toggle between iterations | Installation Report; Bridge — [S9](https://www.l-acoustics.com/products/soundvision/), [S10](https://fohonline.com/articles/power-tools/the-art-of-noise-exploring-l-acoustics-soundvision/) |
| DISPLAY 3 | Optimisation snapshot | Settings per audience or environment scenario | Re-optimise | Unknown | Re-optimise and compare | Unknown — [S11](https://martin-audio.com/news/press-release/martin-audio-releases-next-generation-prediction-and-optimisation-software-display) |
| Blueprint AV | Capture | Simulation result | Frozen capture (inferred) | Unknown | "Easy comparison" | DXF (press) — [S13](https://legacy.adamson.ai/product/system-control/blueprint-av) |

- [D] Camera or view state is captured as part of the project in MAPP 3D (saved cameras), but not inside a snapshot. — [S1](https://docs.meyersound.com/products/en/user-guide---mapp-3d.html)
- [D] EASE 5 activation changes inside a configuration are excluded from undo, a documented trade-off between history and calculation settings. — [S6](https://www.afmg.eu/en/ease-upgrade-history)

### Inferences
- [I] No tool documents automatic staleness flags on stored results. ArrayCalc's Project report, a traffic-light validator, is the closest pattern to a "this result is invalid or out of date" indicator. TekPractice could combine the two: a snapshot badge that turns amber when the live model diverges from the snapshot's basis.
- [I] Camera state is not part of any documented acoustic snapshot. For a teaching game, saving the camera *with* a snapshot is an original design choice, not an industry norm.

### Gaps
- [U] Ordering rules (chronological versus manual) for ArrayCalc memories, DISPLAY 3 snapshots and Blueprint captures.
- [U] Whether any tool embeds snapshots or memories in its PDF report.

---

## Q5. Display conventions: SPL colour scales, STI bands, and novice guidance

### Takeaway
The scale is **automatic by default, with an optional user-fixed maximum and range**. Common step choices are full resolution or 0.5, 1, 3 and 6 dB. A typical working window is about 30 dB. Out-of-range values are clipped to marker colours. STI is reported on the IEC 0–1 scale with five verbal bands, and the IEC A+ to U letter scale also exists.

### Cited Findings
- [D] MAPP 3D: **Max Value** is the loudest level plotted, and anything above it shows **white**. **Min Range** is the span below the maximum, and anything below it shows **black**. An Attenuation mode sets the loudest point to 0 dB. **Resolution** is full, or 0.5, 1, 3 or 6 dB per colour, and 6 dB steps are suggested for seeing 6 dB-down points. If plots look mostly white or mostly black, adjust the values. A White colour scheme is recommended outdoors. Headroom colours are pink for Pink noise, blue for B-Noise and yellow for M-Noise. The SPL Data panel shows max, min and the spread across planes. — [S1, SPL tab / Resolution](https://docs.meyersound.com/products/en/user-guide---mapp-3d.html)
- [D] EASE Focus 3: the colour scale is **automatic by default** or bounded by user-defined values, set separately for SPL and S/N, and it can be inverted. Clicking the legend opens the setting. The automatic legend is optimised for Top View by default, with a shortcut to re-optimise. The Levels and FR plots also have automatic or manual dB scales. — [S4 §4.3–4.4, shortcuts](https://engineering.purdue.edu/ece40020/DesPrj/EASE_Focus_3_User_Guide.pdf)
- [D, vendor quick start via search summary] TW AUDiO recommends an 80–110 dB window, i.e. a **30 dB dynamic range**, for the mapping and the Level and FR tabs. — [TW AUDiO EASE Focus 3 quick start (S18)](https://twaudio.de/wp-content/-pdf_files/TW_AUDiO_Ease_Focus3_Quick_Setup_Guide_EN_1.0.pdf)
- [D] EASE 5: the default scale is automatic per map (its own min and max). A user-defined fixed scale makes maps comparable (v5.68.3), and Fixed Interval compares spread (v5.75). — [S6](https://www.afmg.eu/en/ease-upgrade-history)
- [D] ArrayCalc applies the colour scale to the live view and the memory views alike. — [S2](https://www.dbaudio.com/assets/products/downloads/software/arraycalc/dbaudio-release-notes-arraycalc-v10.26.4.pdf)
- [D, secondary] STI quality bands per IEC 60268-16: 0–0.30 bad, 0.30–0.45 poor, 0.45–0.60 fair, 0.60–0.75 good, 0.75–1.00 excellent. At least 0.5 is desirable for most applications. Edition 4 also defines a letter scale running from U to A+. — [Wikipedia, Speech transmission index (S17)](https://en.wikipedia.org/wiki/Speech_transmission_index)
- [D] Novice aids seen in the sources: EASE Focus's RELATIVE tolerance highlight and Distribution Graph statistics ([S4](https://engineering.purdue.edu/ece40020/DesPrj/EASE_Focus_3_User_Guide.pdf)); MAPP 3D's troubleshooting note about all-white or all-black plots and its requirements for a valid prediction ([S1](https://docs.meyersound.com/products/en/user-guide---mapp-3d.html)); ArrayCalc's click-through Project report with traffic-light severity ([S2](https://www.dbaudio.com/assets/products/downloads/software/arraycalc/dbaudio-release-notes-arraycalc-v10.26.4.pdf)); and Soundvision's Autosplay as an overridable starting point ([S10](https://fohonline.com/articles/power-tools/the-art-of-noise-exploring-l-acoustics-soundvision/)).

### Inferences
- [I] An automatic scale *per map* makes two snapshots visually incomparable. Peers fix this with a locked, shared scale (EASE 5, ArrayCalc). In TekPractice, A/B mode should force a shared scale by default.
- [I] Clipping to distinct marker colours (MAPP 3D's white and black) is a cheap way to teach "over target" and "below range" without a legend lookup.

### Gaps
- [U] The exact palettes (rainbow versus perceptual) are not described in text by any vendor document retrieved.
- [U] The STI letter-band numeric ranges (A+ to U) were not available as text in the retrieved source. Use the IEC 60268-16 Annex directly.
- [U] No vendor document retrieved describes a colour palette specifically for STI maps.

---

## Q6. Outside audio: snapshot and version UX in CAD and design tools (branch, restore, invalidate)

### Takeaway
Onshape and Figma both pair **automatic fine-grained history** with **named, deliberate checkpoints**. Onshape makes versions **immutable and view-only**, so any edit must happen in a branch. Figma makes **restore non-destructive** by checkpointing the present before restoring. Both are strong models for a teaching game's "save attempt, try a variant, roll back" loop.

### Cited Findings
- [D] Onshape: a version is a named, saved state of the document. It is **immutable** and view-only, separate from workspaces. Opening an old version is read-only. To edit from it, "Branch to create workspace" creates a new branch with its own workspace and further versions. Compare works between versions and workspaces at any history point. Merge brings a source into the active workspace and is shown explicitly in the Versions and history graph. A full history of every user's changes is kept and can be searched by tab, user and date. Automatic versions can be created, e.g. on reference updates. When drawings have pending updates, the dialog prompts to update them before a version is created. — [Onshape Help, Versions and history (S15)](https://cad.onshape.com/help/Content/Document/versions_and_history.htm)
- [D] Figma: autosave checkpoints are taken every 30 min and on a crash or disconnect. Named versions have a title (clipped at 25 characters) and a description (140 characters shown). An autosave can be named later. **Restore is non-destructive**: it adds a checkpoint of the current state and one of the restored state. "Duplicate" creates a new file from a version. History retention is 30 days on Starter or drafts and unlimited on paid plans. — [Figma Help, View a file's version history (S16)](https://help.figma.com/hc/en-us/articles/360038006754-View-a-file-s-version-history)

### Inferences
- [I] Onshape's rule of updating pending drawings before versioning is a direct analogue for "recalculate the mapping before freezing a snapshot", so a snapshot never freezes a stale result.
- [I] Combining the peer patterns gives a defensible TekPractice model. Snapshots are immutable, like Onshape versions. "Try from here" branches. Restore checkpoints the present first, like Figma. A snapshot is flagged as diverged when the live model's inputs hash differs from the snapshot's basis, extending ArrayCalc's traffic-light validator. A/B uses a locked shared colour scale, like EASE 5 and ArrayCalc.

### Gaps
- [U] Onshape's restore semantics (whether restore adds a new history node) were not stated on the retrieved page.
- [U] Other simulation tools (e.g. COMSOL or Ansys parametric sweeps) were not researched because of the call budget.
