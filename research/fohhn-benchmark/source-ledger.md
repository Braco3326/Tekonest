# Source ledger

All sources were accessed on **2026-10-24** unless a row says otherwise. Sources are listed by priority: our own live observation, then Fohhn official sources, then standards and academic sources, then vendors and the trade press. Forums and blogs are flagged.

**Claim-level citations:**
- Fohhn claims cite `[HC-nnn]` (see `research_notes/Fohhn tools documentation/help_centre.md`, with the full URL per article).
- Other claims cite `[Sn]` in the other research-notes files.
- This ledger is the index of those sources.

**Licence and use notes:**
- Nothing listed here was copied into TekPractice.
- Fohhn material is under Fohhn's Terms of use (no copying, no derivative works).
- Standards are paywalled; we cite abstracts and secondary summaries only, flagged.

## A. Live observation (signed in by Oscar; account display name redacted)

| ID | URL | What | Covers |
|---|---|---|---|
| L1 | https://services.fohhn.com/fsd-viewer/ | Fohhn Speaker Viewer (client build 124) | interface-inventory §1, captures V-00…V-32 |
| L2 | https://services.fohhn.com/fohhn-optimizer/ | Fohhn Optimizer 1.7.0 | inventory §2, O-00…O-05 |
| L3 | https://services.fohhn.com/designer/projects and `/designer/editor/<audit copy>` | Fohhn Designer: projects page and editor | inventory §3, designer-snapshots, D-02…D-60 |
| L4 | https://services.fohhn.com/hc/ | Help Centre, read page by page (141 pages) then paraphrased | help_centre.md (HC-000…HC-140), H-00, H-01 |
| L5 | https://services.fohhn.com/dashboard/legal/terms-of-use | Terms of use, dated 2021-09-29 | README guardrails; Designer "guideline, no legal claim" statement |
| L6 | https://services.fohhn.com/dashboard/auth/welcome | Free account request page | inventory §0 |

## B. Fohhn official sources (public)

| ID | URL | Publisher | Covers | Confidence |
|---|---|---|---|---|
| F1 | https://www.fohhn.com/en/products | Fohhn Audio AG | Names "Fohhn Speaker Viewer", Optimizer, Designer, simulation data; viewer described in one line | Documented |
| F2 | https://www.fohhn.com/en/products/fohhn-designer | Fohhn Audio AG | Designer feature list; "evolutionary concept development based on snapshots"; modification history | Documented |
| F3 | https://www.fohhn.com/en/catalog/fohhn-optimizer and https://www.fohhn.com/de/katalog/fohhn-optimizer | Fohhn Audio AG | Optimizer purpose, pink noise, QR hand-off, phone mic, "Famsa", copy to Audio Soft | Documented |
| F4 | https://fohhn.com/en/series/software | Fohhn Audio AG | Software line-up | Documented |
| F5 | https://www.fohhn.com/en/products/fohhn-audio-soft | Fohhn Audio AG | Audio Soft: free, Windows-only | Documented |
| F6 | https://fohhn.com/en/products/at-05 | Fohhn Audio AG | AT-05 public specs (passive 2-way, 90° × 90°, 60 Hz–20 kHz −10 dB, 88 dB 2.83 V/1 m, 110 dB max, 8 Ω) | Documented (the page is internally inconsistent on the enclosure material) |
| F7 | https://services.fohhn.com/webtools/simple-room-generator/ ; https://www.fohhn.com/en/room-model-service | Fohhn Audio AG | Room-model helpers | Documented |
| F8 | https://cloud.fohhn.com/en/tutorials ; YouTube playlists PLF5B4Vw0YGp… | Fohhn | Tutorials (titles only; consent redirect) | Partial |
| F9 | https://www.fohhn.com/en/fohhn/news-press | Fohhn Audio AG | No Optimizer launch item found | Documented absence |

## C. Third-party sources about Fohhn tools (secondary, flagged)

| ID | URL | Publisher | Covers | Flag |
|---|---|---|---|---|
| T1 | https://tpimagazine.com/?p=33251 | TPi Magazine | Designer announcement, 10 April 2019 | Trade press |
| T2 | https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf | novelty group (French distributor), V1 of 17/04/2020 | Training slides: snapshot tree, menus, statistical theory slides (Sabine/Eyring) | Distributor; dated; the theory slides are **not** Fohhn's official algorithm |
| T3 | https://www.youtube.com/watch?v=AeBPjx30xEk | Third-party channel | InfoComm 2022 "brand new" Optimizer (title only) | Secondary |

## D. Standards, academic and technical sources (acoustics fidelity ladder)

Full per-formula citations and confidence tags ([H] read in source, [M] snippet or secondary, [L] unverified) are in `acoustics_fidelity_ladder.md`.

| ID | Source | Covers | Flag |
|---|---|---|---|
| A1 | IEC 60268-16:2020 Ed. 5 (webstore.iec.ch/en/publication/26771; AFNOR listing) | STI and STIPA definitions; the indirect (IR) method | Paywalled; scope and abstract only |
| A2 | ISO 9613-1:1993 (preview PDF at ANSI) + acoustic-toolbox docs (acoustic-toolbox.readthedocs.io/en/latest/atmosphere/) | Air absorption equations | [H] via the open implementation's docs |
| A3 | IEC 61672-1 A/C weighting formulas (summarised on en.wikipedia.org/wiki/A-weighting) | Weighting | Secondary for the formulas |
| A4 | CEN/TS 54-32:2015 (SAI Global, BSI listings); LDA Audiotech article; patent US9026439 | Voice-alarm STI targets (≥ 0.50 average, 0.45 minimum over 90 % of the area) | Targets from secondary sources only; verify in the standard |
| A5 | Engineering ToolBox "sound propagation indoor" | Hopkins-Stryker worked example (our recomputation gives 84.5 dB, not the page's 84.8) | Secondary; used only as a unit-test case |
| A6 | PTB Round Robins (ptb.de …/round-robin-in-room-acoustics.html); Bork, IoA proceedings | Validation history of room-acoustic simulation | Primary institution |
| A7 | Brinkmann et al. 2019, JASA 145(4):2746, CC BY 4.0 (arXiv 1811.05784); BRAS database (depositonce.tu-berlin.de, CC BY-SA 4.0) | Simulation vs measurement limits; open absorption and scattering data | Open licence |
| A8 | pyroomacoustics (pyroomacoustics.readthedocs.io), MIT per its package metadata | Reference implementation for testing an image-source shoebox model | Licence to re-check from the LICENSE file before any use |
| A9 | gregzanch/band (github.com/gregzanch/band), MIT, v0.1 | A browser room-acoustics toolkit | Early-stage; licence to re-check |
| A10 | RoomAcoustiC++ (roomacousticpp.readthedocs.io), wayverb | GPL / other: **do not copy into TekPractice** | Licence risk |
| A11 | Bose white paper "STI prediction without measurements"; IoA papers (Doany; Barnett) | STI prediction practice and limits | Vendor or professional body |
| A12 | L-Acoustics WST paper; QSC/Q-SYS line-array white paper; prosoundtraining.com | Line-source near and far field (formulas disagree by about 6–8×) | Vendor; keep line arrays illustrative |
| A13 | Houtgast, Steeneken & Plomp 1980, *Acustica* 46:60–72 | The MTF from RT and SNR (the formula in the notes is **[L] unverified**) | Must be verified before shipping any STI estimate |

## E. Speaker-data formats and room-EQ background

| ID | URL | Covers | Flag |
|---|---|---|---|
| E1 | http://www.clfgroup.org/faq.htm ; /clfdocuments.htm ; /viewer.htm | CLF resolutions (Type 1 octave/10°, Type 2 third-octave/5°); secure binary; authors | No open licence found |
| E2 | https://www.afmg.eu/en/gll-viewer ; …/ease-focus-3-licensing-manufacturers | GLL viewer is free; manufacturers pay for authorisation | No reuse licence |
| E3 | http://www.aes.org/standards/blog/2019/8/updated-and-reaffirmed-version-of-aes56 | AES56 (polar measurement) reaffirmed | Standard paywalled |
| E4 | QSC white paper; Brusi/DoctorProAudio; Odeon directivity files; AES e-Brief 230 (Sridhar et al.) | DI, isobars, −6 dB coverage, angular spacing | Search summaries; re-check before quoting |
| E5 | Elliott & Nelson JAES 1989; Radlović, Williamson & Kennedy IEEE TSAP 2000; MDPI Appl. Sci. 2018 review | Limits of room EQ (multi-point vs single-point, non-minimum phase) | Abstracts / snippets |

## F. Peer tools (snapshot and comparison patterns)

| ID | URL | Covers |
|---|---|---|
| P1 | https://docs.meyersound.com/products/en/user-guide---mapp-3d.html | MAPP 3D Snapshot Library (device), predict-on-demand, trace overlay |
| P2 | https://www.dbaudio.com/assets/products/downloads/software/arraycalc/dbaudio-release-notes-arraycalc-v10.26.4.pdf | ArrayCalc 3D plot memories and project report |
| P3 | AFMG EASE Focus 3 User's Guide (https://www.afmg.eu/en/ease-focus-3-users-guide) ; https://www.afmg.eu/en/ease-upgrade-history | EASE Focus mapping; EASE 5 Simulation Configurations; Acousteer real-time engine |
| P4 | https://www.l-acoustics.com/products/soundvision/ ; FOH Magazine article (Sugden, 2019) | Soundvision real-time mapping, iterations |
| P5 | Martin Audio DISPLAY 3 press release (2026-09-21) ; ProSoundWeb | Optimisation snapshots (press only) |
| P6 | https://legacy.adamson.ai/product/system-control/blueprint-av | Blueprint AV capture |
| P7 | https://cad.onshape.com/help/Content/Document/versions_and_history.htm | Immutable versions, branches, restore |
| P8 | https://help.figma.com/hc/en-us/articles/360038006754 | Autosave vs named versions; non-destructive restore |

## G. TekPractice and Tekonest (internal)

| ID | Location | Covers |
|---|---|---|
| R1 | `origin/main` f90f9a2, `tekpractice-sim/` | Engine, levels, catalog, SavedRig, ADR-0001…0009 |
| R2 | `feature/tekpractice-explore-controls` 92a005e | ADR-0010, explore controls, rooms, placement, `CONTROLS.md` |
| R3 | `research/tekbrain` 26b5a0f, `knowledge-base/` | Room templates (gear positions, RT60), 82 rules, curriculum, equipment specs |

## Not accessible

- The Optimizer commissioning-checklist PDF and the Help Centre FAQ answers (download or capture not attempted).
- The Fohhn webinar page (404).
- The YouTube descriptions (consent redirect).
- The 2020 Fohhn exercise page (expired certificate).
- IEC, ISO and EN standard full texts (paywalled).
- Oscar's 9 screenshots (not received).
