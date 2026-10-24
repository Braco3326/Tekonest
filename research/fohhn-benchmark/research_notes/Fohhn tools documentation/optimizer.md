# Fohhn Optimizer: Workflow, Requirements and Room-EQ Background (research notes)

All sources accessed 2026-10-24. These are research-only notes. I did not sign in and ran no measurement.
Labels: **[Documented]** = official Fohhn source plus section; **[Inferred]** = my reasoning from sources; **[Unknown]** = not found; **[Secondary]** = trade press, third-party or search-summary only.

Source register:
| # | URL | Publisher | Section used | Covers |
|---|-----|-----------|--------------|--------|
| S1 | https://services.fohhn.com/fohhn-optimizer/ | Fohhn Audio AG | Login screen (whole page) | Login gate only; supported-browser notice. No Optimizer help text without signing in |
| S2 | https://www.fohhn.com/en/catalog/fohhn-optimizer | Fohhn Audio AG | Product page (intro, "how it works" text, FAQ-style blocks, Register/Login links) | Main official description: purpose, pink noise, QR hand-off, mic, Famsa, copy to Audio Soft, Windows |
| S3 | https://www.fohhn.com/de/katalog/fohhn-optimizer | Fohhn Audio AG | German product page | Same content in German; the EQ is described as a starting point; no app install ("über die Website") |
| S4 | https://fohhn.com/en/series/software | Fohhn Audio AG | Software series overview, "Fohhn Optimizer" tile | One-line purpose: web tool for small projects without an engineer |
| S5 | https://www.fohhn.com/en/products/fohhn-audio-soft | Fohhn Audio AG | Fohhn Audio Soft product page | Free, Windows download, USB/Fohhn Net/Ethernet/Dante/Optocore, presets, offline mode, available since 2005 |
| S6 | https://www.youtube.com/watch?v=AeBPjx30xEk | YouTube (third-party channel, not resolved) | Video title only | "InfoComm 2022 … Adds Brand New Fohhn Optimizer Software" **[Secondary]** |
| S7 | https://www.youtube.com/watch?v=JSYAUh5f4iA and https://www.youtube.com/watch?v=DOP6hGrj1D0 | Fohhn (presumed FohhnTV) | Titles only; descriptions did not load | "Fohhn Optimizer - tuning via smartphone" / "Einfach einmessen mit dem Smartphone" |
| S8 | https://www.fohhn.com/en/fohhn/news-press | Fohhn Audio AG | News list (first page) | No Optimizer item found |
| S9 | https://eprints.soton.ac.uk/468661 and https://aes2.org/publications/elibrary-page/?id=6063 | Univ. of Southampton / AES | Abstract of Elliott & Nelson, JAES 37(11) 1989 | Multi-point least-squares room EQ |
| S10 | https://researchportalplus.anu.edu.au/en/publications/equalization-in-an-acoustic-reverberant-environment-robustness-re/ | Australian National University | Abstract of Radlović, Williamson & Kennedy, IEEE TSAP 8(3) 2000 | Single-point EQ breaks down when you move a fraction of a wavelength |
| S11 | https://users.cecs.anu.edu.au/~rod/papers/2000/00876311.pdf | ANU (author copy, IEEE TSAP 2000) | Radlović & Kennedy, non-minimum-phase equalization | Phase errors in minimum-phase EQ of non-minimum-phase rooms (from search summary) |
| S12 | https://www.mdpi.com/2076-3417/8/1/16 | MDPI Applied Sciences ("Room Response Equalization—A Review", 2018) | Search-summary snippet only (page returned HTTP 403) | Exact inversion impossible for non-minimum-phase rooms; equalized zone is a fraction of a wavelength **[Secondary: not read directly]** |
| S13 | https://ict.usc.edu/pubs/New%20Factors%20in%20Room%20Equalization%20Using%20a%20Fuzzy%20Logic%20Approach.pdf | USC Institute for Creative Technologies | Search snippet | Responses a few cm apart can differ 15–20 dB in small rooms **[Secondary: snippet only]** |
| S14 | https://acousticfrontiers.com/blogs/articles/hard-proof-that-equalization-kills-room-modes | Acoustic Frontiers (blog) | Search snippet | Low-frequency modes treated as minimum phase (Toole); excess group delay as a test **[Secondary, non-academic]** |

---

## 1. Purpose, launch date and supported devices

### Takeaway
The Optimizer is Fohhn's login-gated web tool. It measures how a room colours a Fohhn system playing pink noise and proposes an EQ for the device's built-in DSP. The proposal is copied into Fohhn Audio Soft (Windows) and sent to the hardware from there. Fohhn says it works with "practically any Fohhn device" but names no minimum firmware or Audio Soft version. The tool most likely launched around InfoComm 2022, but only a third-party video title supports that date.

### Cited Findings
- [Documented] The tool analyses the influence of local acoustics and suggests an EQ setting for the integrated signal processor. The suggestion can be transferred into Fohhn Audio Soft. — [S2 Fohhn product page, intro](https://www.fohhn.com/en/catalog/fohhn-optimizer)
- [Documented] It is aimed at small projects without a sound engineer on site. Fohhn designed it for conference rooms but says it is not limited to them: medium-sized installations and live shows are also mentioned. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer); [S3 German page](https://www.fohhn.com/de/katalog/fohhn-optimizer); [S4 software series tile](https://fohhn.com/en/series/software)
- [Documented] The page claims the process avoids wrong settings and gives consistent results without expert knowledge. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer)
- [Documented] Fohhn says it works with "practically any Fohhn device". No device list, firmware minimum or Audio Soft minimum version is given. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer); [S3](https://www.fohhn.com/de/katalog/fohhn-optimizer)
- [Documented] It is based on Fohhn's "Famsa" algorithm, which the page says has been used in thousands of high-end references. The page says nothing more about the algorithm. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer); [S3 "basiert auf dem bekannten Fohhn Famsa Algorithmus"](https://www.fohhn.com/de/katalog/fohhn-optimizer)
- [Documented] It is developed and hosted in Germany, and the servers run on renewable energy. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer)
- [Secondary] A YouTube video titled "InfoComm 2022: Fohhn Audio Overviews Its Audio Systems, Adds Brand New Fohhn Optimizer Software" points to a 2022 introduction. — [S6](https://www.youtube.com/watch?v=AeBPjx30xEk)
- [Documented] Fohhn's news-press listing (first page) has no Optimizer launch item. The only 2022 item is the Hybrid-1 sustainability award (2022-10-24). — [S8](https://www.fohhn.com/en/fohhn/news-press)
- [Documented] Fohhn Audio Soft is free, offered as a Windows download, and controls more than 200 Fohhn products via USB converters, Fohhn Net, Ethernet, Dante or Optocore. It supports offline configuration and has been available since 2005. — [S5](https://www.fohhn.com/en/products/fohhn-audio-soft)

### Inferences
- [Inferred] "Practically any Fohhn device" probably means any device with an integrated Fohhn DSP and user-EQ that Audio Soft can address. Passive speakers would be tuned through the Fohhn amplifier or DSP that drives them.
- [Inferred] I could find no public documentation of "Famsa", even under searches that returned only the unrelated bioinformatics tool FAMSA. It should be treated as a proprietary black box. A game must not claim to reproduce it.
- [Inferred] Launch year 2022 has medium confidence: it rests on one third-party video title and no Fohhn press release.

### Gaps
- [Unknown] Exact launch date and any version history or release notes for the Optimizer.
- [Unknown] Minimum firmware and minimum Fohhn Audio Soft version. No public manual or release note found. The help text is behind login (S1).
- [Unknown] Whether some product families (for example beam-steering Focus or Linea) are excluded or handled differently.
- [Unknown] What "Famsa" stands for and how it works (filter types, number of bands, smoothing).

## 2. Session setup and device connection

### Takeaway
The workflow runs in a browser after a Fohhn Services login. A desktop session hands off to a phone by QR code, and the phone measures through the website with no app. The Optimizer does not appear to talk to the amplifier directly. The user starts the noise from Audio Soft or another source, and the EQ goes back to the hardware by copy and paste into Audio Soft.

### Cited Findings
- [Documented] Steps: register or sign in at Fohhn Services and follow the on-screen instructions, link the mobile device to the desktop via QR code, measure, review, then copy the optimization into the hardware via Fohhn Audio Soft. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer); [S3](https://www.fohhn.com/de/katalog/fohhn-optimizer)
- [Documented] The tool needs only a current browser, with no installation. The German page says measurement happens via the website, with no app installation. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer); [S3](https://www.fohhn.com/de/katalog/fohhn-optimizer)
- [Documented] The services login page lists supported browsers: Firefox 70+, Chrome 78+, Edge (Chromium) 80+, Opera 65+, Vivaldi 2+. It warns that unsupported browsers may lose functions. — [S1](https://services.fohhn.com/fohhn-optimizer/)
- [Documented] Fohhn Audio Soft requires a Windows PC. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer); [S5 download form "for Microsoft Windows"](https://www.fohhn.com/en/products/fohhn-audio-soft)
- [Documented] Fohhn shows a video by "Henning from the development department" as a walkthrough, but the page gives no direct link to it. The YouTube titles "Fohhn Optimizer - tuning via smartphone" and "Fohhn Optimizer - Einfach einmessen mit dem Smartphone" exist, but their descriptions could not be retrieved. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer); [S7](https://www.youtube.com/watch?v=JSYAUh5f4iA)

### Inferences
- [Inferred] The phone and the desktop are linked through Fohhn's cloud session, not over the local network. The QR code probably carries a session token or URL. The Optimizer itself has no documented network connection to the amplifier.
- [Inferred] The Web Audio and getUserMedia microphone APIs most likely explain the browser minimums, but this is not documented.
- [Inferred] The desktop-to-phone handoff by QR code and the copy and paste into Audio Soft are UI workflow steps. A classroom simulation could reproduce them without hardware.

### Gaps
- [Unknown] Whether the desktop and phone must share a LAN, and whether the tool works offline.
- [Unknown] Whether a PC alone, with a USB measurement mic, can run the whole measurement without a phone. The page implies a PC with an external mic is possible.
- [Unknown] The exact clipboard or text format of the "copy" step.

## 3. Measurement method

### Takeaway
The test signal is pink noise. It usually comes from the internal noise generator of an active Fohhn device, switched on in Audio Soft. The microphone can be the phone's built-in mic or a professional measurement mic. Fohhn makes no public statement on calibration, positions, averaging or "snapshots".

### Cited Findings
- [Documented] The measurement signal is pink noise. All active Fohhn devices have an internal noise generator, controlled in Fohhn Audio Soft. Any other source that provides pink noise is also acceptable. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer); [S3](https://www.fohhn.com/de/katalog/fohhn-optimizer)
- [Documented] For multi-amplifier systems, all amplifiers should be fed from the same noise generator. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer)
- [Documented] The built-in smartphone mic is acceptable. Fohhn says its lab tests of various smartphones showed that critical frequencies are captured accurately enough. No frequency range is stated. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer); [S3](https://www.fohhn.com/de/katalog/fohhn-optimizer)
- [Documented] An external measurement mic can be connected to a smartphone or PC for higher accuracy. This bypasses the phone's standard low-pass filter. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer); [S3](https://www.fohhn.com/de/katalog/fohhn-optimizer)
- [Documented] The room's acoustic influence is visualized in real time. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer)

### Inferences
- [Inferred] Pink noise plus a real-time display suggests an RTA-style magnitude-only measurement, such as a fractional-octave spectrum averaged over time. A sweep or impulse-response measurement seems less likely. A magnitude-only method cannot separate minimum-phase from non-minimum-phase behaviour, so the tool can only propose magnitude EQ.
- [Inferred] With no published calibration step, the absolute level and the phone mic's response are presumably either uncalibrated or corrected by internal per-phone assumptions. Results at low frequencies are likely the least reliable.

### Gaps
- [Unknown] Number of measurement positions, spatial averaging, time averaging, measurement duration, and frequency resolution or smoothing.
- [Unknown] Whether "snapshots" or saved measurements exist. No public text uses the term.
- [Unknown] Mic calibration-file support and per-phone mic compensation.
- [Unknown] The phone low-pass cutoff the page refers to.

## 4. The EQ proposal workflow

### Takeaway
The Optimizer proposes an EQ automatically, and Fohhn frames it as a starting point. The user applies it by copying it into Fohhn Audio Soft, which writes it to the device. Fohhn does not document manual adjustment inside the Optimizer, undo, export formats, target curves or boost and cut limits.

### Cited Findings
- [Documented] The algorithm proposes EQ settings as a starting point. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer); [S3](https://www.fohhn.com/de/katalog/fohhn-optimizer)
- [Documented] The suggestion "can simply be copied into Fohhn Audio Soft" and then used on Fohhn hardware. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer); [S4](https://fohhn.com/en/series/software)
- [Documented] Audio Soft offers sound-shaping and DSP tools, preset recall that can be password-protected, and a speaker preset database. The page does not mention Optimizer integration or a noise generator. — [S5](https://www.fohhn.com/en/products/fohhn-audio-soft)

### Inferences
- [Inferred] Transfer is a manual copy and paste through Audio Soft, not a direct push from the cloud to the device. Undo and fine adjustment therefore probably happen in Audio Soft, through the device EQ controls and presets.
- [Inferred] Saving the pre-tuning preset in Audio Soft before pasting is the practical rollback. Fohhn does not document this.

### Gaps
- [Unknown] Whether the proposal can be edited in the browser, and whether there is a target curve (flat, house curve, speech-tilt), a maximum boost or cut, a band count, filter types, or a frequency range limit.
- [Unknown] Undo and history inside the Optimizer, and file export (PDF report, CSV, preset file).

## 5. Data storage, failure and recovery, documented limitations

### Takeaway
Fohhn documents only that the tool is hosted in Germany behind a Fohhn Services account. It does not say where measurements are stored, how errors are handled or what happens on a failure. The documented constraints are a Windows PC for Audio Soft, a current browser, the phone mic's low-pass limit, and a shared noise generator for multi-amp systems.

### Cited Findings
- [Documented] An account is required (Register and Login at services.fohhn.com), and the tool is hosted in Germany. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer); [S1](https://services.fohhn.com/fohhn-optimizer/)
- [Documented] Constraints: a Windows PC for Audio Soft, a current browser, the smartphone mic low-pass (an external mic is recommended for accuracy), and one common noise generator for multi-amp systems. — [S2](https://www.fohhn.com/en/catalog/fohhn-optimizer); [S3](https://www.fohhn.com/de/katalog/fohhn-optimizer)
- [Documented] Browsers outside the supported list may lose functions. — [S1](https://services.fohhn.com/fohhn-optimizer/)

### Inferences
- [Inferred] Measurement sessions are probably stored server-side in the user's Fohhn Services account, because the desktop and phone share a session. The final EQ persists on the device via Audio Soft. Neither point is documented.

### Gaps
- [Unknown] Data retention and privacy for audio captured on the phone, and whether raw audio or only spectra are uploaded.
- [Unknown] Error and recovery behaviour: lost connection, noisy room, clipping, a phone going to sleep, or an expired QR session.
- [Unknown] Any documented list of limitations or FAQ beyond the product page. A Fohhn Audio Soft manual covering the paste function was not found publicly in the sources I checked.

## 6. Background: what automatic room EQ can and cannot fix (for TekPractice accuracy)

### Takeaway
Research shows that single-point EQ is fragile. It is valid only within a fraction of a wavelength around the mic, and that zone shrinks at higher frequencies. Multi-point or spatially averaged EQ gives a more uniform result over an area but cannot be exact anywhere. Non-minimum-phase parts of a room response cannot be inverted with one source. The game should therefore teach that EQ corrects broad, consistent tonal balance and some low-frequency minimum-phase peaks. It cannot fix reverberation, position-dependent dips or echoes.

### Cited Findings
- Elliott and Nelson (JAES 1989) designed EQ filters that minimize the squared error over several room points. Such filters give a more uniform response over a larger volume than a filter designed for one point. They simulated this in a room with car-interior dimensions and damping. — [S9 Southampton abstract](https://eprints.soton.ac.uk/468661); [AES e-library 6063](https://aes2.org/publications/elibrary-page/?id=6063)
- Radlović, Williamson and Kennedy (IEEE TSAP 2000) found that an inverse filter's performance degrades badly when the source or mic moves by only a few tenths of a wavelength, and that the effect is worst at high frequencies, which matter for speech. — [S10 ANU abstract](https://researchportalplus.anu.edu.au/en/publications/equalization-in-an-acoustic-reverberant-environment-robustness-re/)
- Radlović and Kennedy (2000) argue that the phase errors left when a minimum-phase EQ is applied to a non-minimum-phase room response can harm perceived quality. — [S11](https://users.cecs.anu.edu.au/~rod/papers/2000/00876311.pdf) (from the search summary)
- [Secondary] A non-minimum-phase room response has no exact stable and causal inverse with a single source. Exact equalization holds at one location only, and the equalized zone is a fraction of a wavelength. — [S12 MDPI review, via search snippet; direct fetch blocked](https://www.mdpi.com/2076-3417/8/1/16)
- [Secondary] In small rooms, responses measured a few cm apart can differ by 15–20 dB at some frequencies. — [S13 USC ICT, snippet](https://ict.usc.edu/pubs/New%20Factors%20in%20Room%20Equalization%20Using%20a%20Fuzzy%20Logic%20Approach.pdf)
- [Secondary, non-academic] Low-frequency room resonances are often treated as minimum phase (Toole), so EQ can reduce modal peaks. Excess group delay is suggested as a check of which regions are minimum phase. — [S14](https://acousticfrontiers.com/blogs/articles/hard-proof-that-equalization-kills-room-modes)

### Inferences
- [Inferred] Safe lessons for a game: cut peaks rather than boosting deep dips. Dips are often position-dependent cancellations, and boosting them wastes headroom without filling them elsewhere. Average several positions. Use EQ for broad tonal balance. EQ does not shorten reverberation or remove echoes or flutter.
- [Inferred] Lessons to avoid: "flat at one mic point means good everywhere", "EQ fixes a boomy reverberant room", and "the automatic proposal is final". Fohhn itself frames the proposal as a starting point (S2/S3).
- [Inferred] Feasibility split for TekPractice:
  - **Classroom-safe simulation (no hardware):** the QR handoff and session flow; choosing and justifying mic positions; reading a pink-noise RTA display; spotting peaks and dips; picking cuts vs boosts; comparing the proposal with the target; the copy-to-Audio-Soft step and saving a rollback preset first; recognizing what EQ cannot fix.
  - **Needs real hardware or validated DSP:** generating and capturing real pink noise; phone-mic response and calibration; real spatial averaging; the actual proposal algorithm (proprietary Famsa); writing EQ to a Fohhn DSP; verifying the result by re-measuring. Any synthetic room model in a game should be clearly labelled as illustrative, not as a stand-in for Fohhn's algorithm.

### Gaps
- I could not read the MDPI review (HTTP 403) or the full AES papers, so S12 is used only through its snippet.
- I found no university lecture notes in this pass. Toole's *Sound Reproduction* and the AES literature on spatial averaging (for example the USC "Robustness of Spatial Averaging Equalization Methods" paper at ict.usc.edu) are the recommended next reads.
