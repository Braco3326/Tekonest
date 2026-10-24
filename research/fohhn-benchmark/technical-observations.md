# Technical observations (what a normal browser session shows)

- **Audit:** tekinspi, 2026-10-24.
- **Method:** I recorded the visible DOM element types, the canvas `data-engine` attribute and the resource **names** from the browser's Performance API. I did **not** read or store script contents, response bodies (including speaker data), or page source.
- **Terms:** Fohhn's Terms of use (2021-09-29) forbid copying, reverse engineering and deriving source code. Everything here is surface observation, and none of it is a reconstruction of Fohhn's implementation. Every schema or algorithm idea in the TekPractice documents is our own design.

## 1. Platform

| Fact | Evidence |
|---|---|
| One account system ("Fohhn Services") gates all three apps; free account | [Obs: V-00, D-01] |
| The apps are separate front-ends under one host: `/dashboard/`, `/fsd-viewer/`, `/fohhn-optimizer/`, `/designer/`, `/hc/` | URLs [Obs] |
| Build or version markers in file names: dashboard `-215`, viewer `-124`, optimizer `eq-optimizer-1.7.0.js` and "Version: 1.7.0" in Settings | Resource names [Obs: V-00, V-02, O-05, O-03] |
| Shared UI kit: Open Sans plus an icon font, so the three apps look alike | Resource names [Obs] |
| Language en/de, stored as a user preference (`dashboard/language/current`) | [Obs: V-02, V-27] |

## 2. Speaker Viewer

- **Rendering:**
  - Cabinet and Balloon use a WebGL canvas; the element's `data-engine` attribute reads "three.js r149" [Obs: V-03, V-04].
  - Every chart is SVG: line chart, isobar chart, polar chart and colour-map legend [Obs: V-02, V-05…V-08]. Being SVG, they are crisp and selectable [Inf].
- **Data access (request names only):** a REST service `fsd-rest/api/fsd/viewer/…`, including one request per speaker id and a `series/map` request. User settings are server-side under `fsd-viewer/me/settings/{selected-speakers, active-content-view}`, and texts come from an i18n endpoint [Obs: V-02 network names].
  - Consequence: the comparison set follows the account across devices [Inf].
- **Data processing labels:** the UI says outright "Smoothed 1/6 octave" (FR, impedance), "1/3 octave interpolated" (isobars) and "Cardinal spline interpolated" (polar) [Obs].
  - I count this as good practice: the processing step is part of the chart label.
- **Data provenance:** "Measured with preset" icon per speaker [Obs: V-26].
- **What "FSD" stands for and its format:** not published [Doc: researcher notes]. Not inferred here.

## 3. Optimizer

- **Single page.** The whole client is one script (`eq-optimizer-1.7.0.js`) with one canvas [Obs: O-05 DOM]. The canvas is the QR or plot area [Inf].
- **Microphone:** uses the browser's microphone API. Permission was granted, yet "Start Measuring" stayed disabled [Obs: O-05].
- **Phone link:** the phone hand-off works through a session link encoded in a QR code [Doc: HC-075]. How the session syncs is not observed [Unk].

## 4. Designer

- **Rendering:** a WebGL canvas (three.js r149) for the scene, plus a second 120 × 120 three.js canvas for the navigation cube. The legend is SVG [Obs: D-14].
- **Calculation:** server-side, about 2 s for the Hall example at octave resolution. The client reports progress (%) and the end-to-end time [Obs: D-36; Doc: HC-121].
  - Evaluation points are listener-plane triangle centres. The example had 636 points [Obs: D-46; Doc: HC-027].
- **Persistence:**
  - The project is stored server-side.
  - A dirty marker "*" appears in the title.
  - It autosaves after a simulation and on a timer, and Save/Save as exist too [Obs: D-35, D-36, D-47].
  - History is a session-only notification log [Doc: HC-021].
- **Undo/redo:** Project menu, Ctrl+Z/Y [Obs: D-26]. Switching snapshot is part of undo [Doc: HC-134].
- **Physics, as documented** (not verified by us) [Doc: HC-054, HC-055]:
  - geometric acoustics;
  - early reflections by the image-source method;
  - STI and STIPA(IR) from a statistical impulse response per IEC 60268-16 Ed. 5;
  - reverberation time entered or computed (Sabine/Eyring);
  - coherent summation below a set "complex summation limit" and energetic summation above it;
  - air absorption from temperature, humidity and pressure.
- **What "Total SPL" means is undefined in the Fohhn docs.** That direct plus diffuse field = Hopkins-Stryker-style is an **inference** from an older distributor training PDF (`designer_and_snapshots.md`) and must not be presented as Fohhn's algorithm.
- **Concurrency:** a warning when the same project is open twice [Doc: HC-134].

## 5. Accessibility (surface check only)

- **Viewer:**
  - tabs are `<li>` elements with no tab role and no keyboard focus; a hidden `<select>` mirrors them for small screens;
  - card checkboxes are visually custom;
  - delete links carry a "Remove speaker" title [Obs: DOM records V-02, V-03].
- **Designer:**
  - tool-rail buttons have **no accessible name**, only an icon class and a hover tooltip [Obs: D-14 control list];
  - the radio and checkbox inputs are 1 × 1 px and styled with custom boxes.
- **Takeaway for TekPractice:** keep real button names, roles and focus order (the qa-web crawl already checks these).

## 6. Performance (rough, from this machine, headed Chromium)

- **Viewer:** charts appeared within about 4 s of a tab switch, frequency changes were instant, and no jank was noticed. Not measured [Unk].
- **Designer:** about 20 s from open to an interactive editor (D-13 → D-14). Snapshot switching took 1–5 s, and band or mode switching was instant [Obs]. The UI shows no frame rate.

## 7. Implications for TekPractice (inferences, ours)

- Both tools use the **same split TekPractice already has**:
  - a 3D WebGL view (three.js there, Babylon here) for space;
  - plain 2D charts (SVG there) for numbers.
  - TekPractice should keep charts in the DOM (SVG or HTML), not inside Babylon, so they stay sharp, accessible and testable in Playwright.
- **Server-side calculation** is what Fohhn needs for real geometric acoustics. TekPractice's fidelity levels (a) and (b) can run **client-side, deterministically and in unit tests** (see the fidelity ladder in `prototype-brief.md`). Level (c) would need a worker or a server.
- **Processing labels and a provenance badge** are cheap and teach good habits. Adopt both.
