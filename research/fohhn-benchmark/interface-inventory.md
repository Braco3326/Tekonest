# Interface inventory: Fohhn Speaker Viewer, Optimizer, Designer

- **Audit:** tekinspi, 2026-10-24. Live browser session, signed in by Oscar with a Fohhn Services account. The account's display name is a student's, and it is redacted from every document. Screenshot IDs are in `screenshot-index.md`.
- **Records:** `[Obs: DOM eval]` marks a fact read with a one-off DOM query during the session. Its output was seen live but not kept as a file, so it is weaker evidence than a capture.
- **Evidence labels:**
  - **[Obs: ID]** — seen in the live UI; the ID is the capture.
  - **[Doc: HC-nnn]** — Fohhn Help Centre, login-gated; see `research_notes/…/help_centre.md`.
  - **[Doc: url]** — another official public page.
  - **[Inf]** — my inference.
  - **[Unk]** — not accessible or not determined.
- I did not save page source, scripts or data responses. Rendering technology is identified from DOM element types and the canvas `data-engine` attribute that three.js sets.

---

## 0. Access and shell

- **Login:** all three apps sit behind the same Fohhn Services login (`/dashboard/auth/login?redirectTo=…`) [Obs: V-00]. Accounts are free; registration takes an email and privacy consent [Obs: D-01]. The Terms of use say the free tools carry no support or functional warranty [Doc: Terms, 2021-09-29].
- **Shared shell:**
  - the login page lists browser support [Doc: researcher notes, login page];
  - fonts are Open Sans plus an icon font;
  - an en/de language switch [Obs: V-27].
- **Help:** the Optimizer's "?" and Designer's "Documentation" open the login-gated Help Centre, which has four categories [Obs: H-01].

---

## 1. Speaker Viewer (`/fsd-viewer/`, client 124)

### 1.1 Layout

Left rail "Speakers" (cards with a checkbox, family + model + variant, a product thumbnail and a red bin) + "Add speaker". Top tab strip with 7 views. Main chart area. Footer links: Dashboard, Imprint, Privacy [Obs: V-02].

### 1.2 States

| State | What shows | Evidence |
|---|---|---|
| Initial (returning user) | Previous speaker selection and tab restored from the server. Requests named `me/settings/selected-speakers` and `me/settings/active-content-view` (network names in the V-02 record); the restored state after reload is in V-32 | [Obs: V-02, V-32] |
| Empty (none checked) | "No speaker selected." centred; tabs still visible | [Obs: V-30] |
| Populated, 1 speaker | One chart | [Obs: V-02…V-08] |
| Populated, ≥2 speakers | Line charts overlay. Spatial views (cabinet, balloon, isobars, polar) become side-by-side small multiples | [Obs: V-12…V-18] |
| Loading | Not distinguishable; charts appeared within ~4 s | [Unk] |
| Error / unavailable | None met | [Unk] |
| Phone width | Tabs collapse into a select. Bottom bar "Multiple speakers selected ⋮" replaces the list | [Obs: V-28] |

### 1.3 Tabs

| Tab | The question it answers (for a learner) | Inputs | Axes, units, ranges | Normalisation / processing label | Rendering | Colour scale |
|---|---|---|---|---|---|---|
| **Cabinet** | What does the box look like, and where is its acoustic reference? | Speaker | 3D: grid floor, X/Y/Z axis lines (red/green/blue), dashed reference lines; orbit and zoom; "Reset View" | n/a | WebGL, three.js r149 canvas [Obs: V-03] | Flat grey model |
| **Balloon** | In which directions does sound go, at one frequency? | Speaker + "Select Frequency" (21 third-octave values, 100 Hz–10 kHz) | 3D surface around the speaker; radius and colour = relative level | Colour legend 0 dB (on-axis max) to −40 dB [Obs: V-04]. Normalised to the maximum [Inf] | three.js canvas + SVG legend | Continuous rainbow: red 0 → orange → yellow → green → blue → black at −40 dB |
| **Frequency Response** | Is it tonally flat? Where does it roll off? | Speaker | X: log 20 Hz–20 kHz (ticks 50/100/500/1k/2k/5k/10k/20k). Y: "Sensitivity [dB]", −40…+40, curve around 0 | Badge **"Smoothed 1/6 octave"**. Curve normalised around 0 dB, not absolute dB SPL [Obs: V-05] | SVG line chart | Each speaker has its own colour |
| **Impedance** | What load does the amplifier see? | Speaker | X: log 20 Hz–20 kHz. Y: "Impedance [Ω]" 0–100 | "Smoothed 1/6 octave" [Obs: V-06] | SVG | Each speaker has its own colour |
| **Isobars** | Over which angles and frequencies is it within −3/−6/−9/−12 dB? (Coverage at a glance) | Speaker; Horizontal / Vertical | X: log 100 Hz–10 kHz. Y: "Angles [°]" −180…+180 | Banded legend in 3 dB steps (0 / −3 / −6 / −9 / −12 / below); **the −6 dB contour is drawn as a heavy black line**; badge "1/3 octave interpolated" [Obs: V-07] | SVG contour | Categorical bands: red, yellow, green, blue, black |
| **Polar** | What is the dispersion shape in each plane at one frequency? | Speaker + frequency (third-octave list) | Angle 0° at the top; ±30° grid; ±180° at the bottom. Rings +10 dB down to −35 dB | Horizontal = red, Vertical = black; badge "Cardinal spline interpolated" [Obs: V-08] | SVG polar | Line colours only |
| **Directivity Index** | How much does it focus sound compared with an omni? | Speaker | X: log 100 Hz–10 kHz. Y: "Directivity Index [dB]" 0–40 | — [Obs: V-02] | SVG | Each speaker has its own colour |

### 1.4 Multi-speaker comparison

- **Add speaker:** opens a modal with a searchable picker grouped by product family [Obs: V-09, V-10].
  - Dispersion variants are separate entries ("40x60 / 60x40 / 60x90 / 90x60"). So are presets ("Preset: Background / Bass − / Standard"), and models carry "New" badges.
  - A "Show discontinued loudspeakers" toggle switch; the restored speaker (AT-05) is not in the default list, so it is probably discontinued [Inf].
- **Visibility:** a new speaker arrives **unchecked**. Checkboxes control what the chart shows; the list is the comparison set [Obs: V-11].
- **Identity colour:** each speaker gets a colour (blue, green) used on its list-card border, its panel header and its curve [Obs: V-12, V-15].
- **One shared frequency selector** drives all panels [Obs: V-14].
- **Removal:** the bin removes the speaker immediately, with **no confirmation** [Obs: V-31].

### 1.5 Interactions

- **3D views:** left-drag orbits [Obs: V-19], and there is a "Reset View" button.
  - **Wheel zoom is not demonstrated.** In V-20 the wheel event stepped the frequency select (1000 → 1250 Hz) instead of zooming [Obs: V-20], so wheel-zoom is [Unk].
  - The camera is kept when the frequency changes [Obs: V-21 → V-22].
- **Charts:** hovering a curve thickens it. The tooltip shows the speaker, the frequency in Hz (2 decimals) and the level in dB (2 decimals) [Obs: V-24].
- **Provenance badge:** a document icon has the tooltip **"Measured with preset"** [Obs: V-26]. So the data's measurement condition is surfaced per speaker.
- **Keyboard:** no shortcuts found [Unk].

### 1.6 Language and responsive behaviour

- **Language:** a full German UI ("Bündelungsmaß" = DI) [Obs: V-27].
- **Phone width:** see §1.2 [Obs: V-28].

### 1.7 Speaker metadata a similar TekPractice view would need

This is my inference from what the viewer shows; the data itself is Fohhn's and is not reused:

- family, model, variant (dispersion), preset and status (current / new / discontinued);
- a thumbnail;
- the cabinet mesh and the acoustic reference point;
- third-octave directivity on two planes (or a full balloon) at a fixed angular step;
- the on-axis response (normalised), impedance and DI per band;
- **provenance:** how the data was measured, or whether it is synthetic.

TekPractice must use its own synthetic or licensable data; see `tekpractice-data-model.md`.

---

## 2. Optimizer (`/fohhn-optimizer/`, client `eq-optimizer-1.7.0`)

### 2.1 Start view [Obs: O-00]

- **Heading:** "Select a microphone", split in two:
  - **External device:** a 600 × 300 canvas (the QR area [Inf]). It stayed blank in this automated window [Obs: O-01].
  - **Local microphone:** "Start Measuring". It stayed greyed and not clickable: the click timed out [Obs: O-05], after the microphone permission was granted [Obs: O-04 record].
    - A DOM query showed an `is-disabled` class and an available audio input [Obs: DOM eval].
    - The cause is undocumented [Doc: HC-075 is silent].
  - Plausible cause: the app waits for a device or session step that I could not complete in automation [Inf].
- **Hidden in the page:** a "Goto EQ Results" button exists but is hidden [Obs: DOM eval].
- **Header:** "?" opens the Help Centre in a new tab [Obs: O-02]; the gear opens Settings.

### 2.2 Documented workflow

[Doc: HC-072, HC-075, HC-077, HC-074]

1. In Fohhn Audio Soft, load a preset with no EQ.
2. Play pink noise (from the device's generator, or a file).
3. Measure at listener positions, either with the phone (via QR) or with a local microphone.
4. **"Take Snapshot"** stores the current spectrum, **at most 5**. The chart shows them normalised to 0 dB at 1 kHz, with the live trace in black.
5. "Calculate EQ" averages the snapshots and proposes parametric EQ. The chart shows the average (black), the result (orange) and the target (blue). An empty table means "not necessary or not possible".
6. "Copy to clipboard", then paste into Fohhn Audio Soft 5.7 or later.

No manual editing of the proposed filters is documented. Adjusting means changing Settings and recalculating.

### 2.3 Settings and defaults [Obs: O-03, DOM values]

| Group | Setting | Options | Default observed |
|---|---|---|---|
| Application | Language | en/de | English (the group was collapsed in O-03; value from [Obs: DOM eval]) |
| Application | Show preparation view | checkbox | (state not recorded) [Unk] |
| Measurement | Bands/Octave | 1/1, 1/3, 1/6, 1/12, 1/24 | **1/12** |
| Measurement | Sample time [s] | 0.1–1.0 | **0.2** |
| Measurement | Average | 1–5 | **4** |
| Measurement | Release | 1–5 | **5** |
| EQ | Working range min | 20, 40, 60, 80, 100, 200, 400 Hz | **20 Hz** |
| EQ | Working range max | 600, 800, 1000, 2000, 3000, 4000 Hz | **1000 Hz** |
| EQ | Maximum Q | 3…48 | **16** |
| EQ | Filter count | 1–10 | **6** |
| EQ | Optimization mode | Moderate / Strict | **Moderate** |
| EQ | Moderate level [%] | number | **50** |

The Help Centre states no defaults [Doc: HC-076], so these observed defaults are new evidence. The EQ working range tops out at 4 kHz, with a 1 kHz default. So the tool targets the low and mid band, where room effects dominate [Inf, consistent with the room-EQ literature in `optimizer.md`].

### 2.4 Measurement snapshots vs design snapshots

- **Optimizer snapshot:** one measured spectrum at one position, at most 5, averaged into an EQ [Doc: HC-077].
- **Designer snapshot:** an immutable versioned design state with its results, arranged in a tree (see `designer-snapshots.md`).
- They share only the word. TekPractice must name them differently (see the crosswalk).

### 2.5 Exercise or hardware?

| Step | Could be a TekPractice exercise | Needs real hardware or validated DSP |
|---|---|---|
| Choosing measurement positions in a room; why average 3–5 positions | Yes (illustrative; position choice can be scored geometrically) | — |
| Reading a normalised spectrum (0 dB at 1 kHz), spotting a room-mode bump | Yes, with synthetic curves (level a, see the fidelity ladder) | Real capture |
| Cut vs boost, max Q and filter count as constraints | Yes (simple parametric-EQ maths is deterministic) | — |
| "EQ cannot fix reverb or a single-point dip" | Yes (a concept check) | — |
| Copy EQ to the DSP; keep a rollback preset | Yes (a procedure, like the existing wiring rules) | Writing to a real DSP |
| Pink-noise generation, mic calibration, live RTA | No | Yes |
| The proposal algorithm | No (proprietary, undocumented) | Yes |

---

## 3. Designer (`/designer/…`)

### 3.1 Projects page [Obs: D-02…D-12]

- **Header:** Projects, Documentation, account menu. "You have access to N projects". New project.
- **Search:** a search field with a filter chevron [Obs: D-04]:
  - owner filter: All / My own / Shared with me;
  - "Archived projects – Show";
  - sort by Last edited / Project name / Created, ascending or descending (descending by default).
- **Card:** title, "Last modified YYYY-MM-DD HH:MM", optional description and a thumbnail of the last result.
  - "Details" [Obs: D-03]: Owner, Created, "N authors".
  - Five icon actions with titles: Edit project details, Delete project, Duplicate project, Archive project, Share project.
- **Dialogs:**

  | Action | Fields / text | Buttons | Evidence |
  |---|---|---|---|
  | New | Name*, Description | Cancel/Add | [Obs: D-12] |
  | Edit | Name*, Description | Cancel/Save | [Obs: D-11] |
  | Duplicate | Name prefilled "… - Copy", Description | Cancel/Duplicate | [Obs: D-05] |
  | Delete | "Are you sure…?" | Cancel/Yes | [Obs: D-08] |
  | Archive | Explains how to show archived projects again | Cancel/Ok | [Obs: D-09] |
  | Share | Persons (Add), Comment | Cancel/Share | [Obs: D-10] |

- **What duplication carries over:** snapshots with their **original timestamps** [Obs: D-21] and the reports [Obs: D-58]. The read-only flag per person is documented [Doc: HC-014].
- **No project export or import** on this page [Obs: D-02]. Room and listener-plane files are imported inside the editor.
- **Support:** a chat bubble bottom right [Obs: D-02].

### 3.2 Editor shell [Obs: D-14]

- **Top menus:** Project, Room, Listener plane, Loudspeaker, Simulation, Snapshots, Export, View. On the right: Help, History (bell), Options (gear), profile.
- **Left context panel:** shows Snapshots when nothing is selected [Doc: HC-018; Obs: D-14]. Otherwise it shows the selected object's properties [Obs: D-57, D-59].
- **3D view:**
  - navigation cube "Front" top left, with its own 120 × 120 canvas;
  - grid and axes;
  - colour legend top right;
  - result labels as white callouts on the plane.
- **Right tool rail (tooltips)** [Obs: DOM eval, a scripted hover over each button; icon class names are in the D-14 record]:
  - Select;
  - Erase ("Deletes an object through clicking");
  - Draw rectangular listener plane;
  - Listener plane from geometry;
  - Duplicate loudspeakers;
  - Mirror loudspeakers;
  - Aim at point ("points its acoustic direction to the spot below the cursor");
  - Alignment;
  - Distance measurement;
  - Result label ("click a point on the listener plane to get a label with the value");
  - Spectrum;
  - Statistics;
  - Early-reflection paths;
  - Auralisation;
  - Camera presets 1–3 ("Set: right mouse button. Use: left mouse button.").
- **Status bar:**
  - cursor XYZ in metres;
  - **"<snapshot name> / <mode> - <frequency or range>"**;
  - a green **IEC** badge (IEC 60268-16 compliance of the snapshot [Doc: HC-121]);
  - "Room selected" when the room is selected.
- **Title bar:** a "*" prefix marks unsaved changes.
  - It appeared as soon as a snapshot was selected [Obs: D-16 record title].
  - It cleared after the post-simulation autosave [Obs: D-37 record].
  - Autosave also runs on a timer ("Trigger auto save…") [Obs: D-36, D-47].
- **Loading:** a dark overlay with a spinner for over 10 s on open [Obs: D-13].

### 3.3 Menus (full lists in `screenshot-index.md`, D-25…D-32)

- **Project:** Undo/Redo, Save/Save as. Save is explicit, with autosave as well.
- **Room:** Global room properties [Obs: D-59]:
  - Volume and surface (read-only);
  - model status with "Show Errors";
  - room position, with options to move loudspeakers and listener planes along;
  - Advanced;
  - reverberation time per band, with a chart (about 0.9–1.1 s in the Hall example);
  - Average absorption, with an RT / Absorption toggle.
- **Listener plane:** Draw, Create by offset, Import, List.
- **Loudspeaker:** Add, Duplicate, Mirror, Aim at point, Align, Copy/Paste beams and EQ, Import EASE setup, List. Each speaker's property fields [Obs: D-57 record; the visible panel read "No loudspeaker selected", so the fields are those of the panel template in the DOM]:
  - Name, Gain, Mute, Delay (with the equivalent distance);
  - Position XYZ, Rotation XYZ, Acoustic centre;
  - Filter, EQ (chart ±12 dB);
  - Meta data;
  - Open Product Website, Change.
  - The list columns are: #, Name, Type, Group, Gain, Mute, Delay, Position X/Y/Z. The example had 5 speakers, 2 of them "-mirrored".
- **Simulation:** Start F9, Stop, Setup Shift+F9 (see `designer-snapshots.md` §5).
- **Snapshots:** Show (Ctrl+Alt+M), Result Labels.
- **Export:** Report configurator, Loudspeaker table, Loudspeaker list, Screenshot, Fohhn Audio Soft.
- **View:** Camera, Wireframe, Show hidden, Scale figure, Gizmo orientation, Change origin.

### 3.4 Analysis tools

- **Spectrum panel:** Direct and Total SPL on one chart, 60–120 dB against 20 Hz–20 kHz [Obs: D-45]. It needs a point click; it was empty in the capture.
- **Statistics panel:** "Histogram for all listener planes" (relative distribution in %, 5 dB bins) plus descriptive values: mean, σ, μ−σ, max, min and the number of points [Obs: D-46].
  - μ−σ is the evenness indicator a novice can learn [Inf].
- **History:** a timestamped notification log; session-only [Obs: D-47; Doc: HC-021].

### 3.5 Options [Obs: D-49…D-56]

- **Groups:** Application, Camera, Colour scale, Listener plane, Loudspeakers, Project, Room, Scene, Simulation, Statistics.
- **Colour-scale defaults:** Direct SPL 60–120 dB. The gradient is fixed; only the limits change [Doc: HC-019].
- **Statistics:** STI histogram resolution 0.20 and SPL 5 dB.
- **Application:** confirm on close; result-label size.
- **Not inspected:** the Simulation and Camera groups (click failed).

### 3.6 Export and reports

- **Report configurator:** lists the reports per project, with New report. Each report is bound to a snapshot, its language is fixed at creation, and it generates a PDF (the link is valid for 1 day) or an image ZIP [Obs: D-58; Doc: HC-042…046, HC-114…116].
- **Not run:** PDF generation and screenshot export (see §4).

### 3.7 Responsive

The editor is not built for phone widths: menus stack and panels overlap the canvas [Obs: D-60]. The projects page was not tested on a phone.

### 3.8 Controls (Designer)

[Doc: HC-039, HC-037; partly Obs]

- **Mouse:** left-drag orbits around a pivot; the wheel dollies to the cursor; right-drag pans; Ctrl + left-drag looks around.
- **Camera:** 3 project-level presets (right-click to save, left-click to recall) [Obs: tooltip].
- **Navigation cube:** clicking a face snaps to that view [Doc: HC-109].
- **Keys:** F9 / Shift+F9, Ctrl+Z/Y, Ctrl+S, Del, Esc (select tool), Alt+H home view, numpad views [Doc: HC-037].
- **Comparison with TekPractice:** TekPractice already uses left-drag to orbit in Orbit view and has a full walk scheme (ADR-0010), so no change of controls is needed (see the prototype brief).

---

## 4. Not inspected or inaccessible (the audit is NOT complete for these)

| Item | Reason |
|---|---|
| Optimizer measurement, QR phone hand-off, Optimizer snapshots, EQ proposal / copy | "Start Measuring" stayed disabled and the QR canvas stayed blank in the automated window. It needs Oscar on a phone, ideally with a Fohhn amplifier and pink noise |
| Optimizer "Show preparation view" default; commissioning-checklist PDF; FAQ answers | Not captured (the downloads were not followed, on purpose) |
| Designer Options → Simulation, Camera | The click failed (label clash) |
| Room wizard, Import, Manage materials, wall properties, Invert surfaces | Not opened (time; also, editing the geometry would apply to all snapshots) |
| Drawing or importing listener planes, Aim / Align / Mirror tools, beam parameters (no beam-steering speaker in the Hall example) | Not exercised |
| Early reflections, reflection paths, auralisation | Not run |
| Report generation (PDF), image ZIP, Screenshot export, loudspeaker table/list PDF, Fohhn Audio Soft export | Not run; each would download files, which the guardrails rule out |
| Conference Room and Theatre examples | Seen as cards only, not opened |
| Sharing with another user, read-only mode, Teams | Would contact a third party; not done |
| Designer at phone width beyond one capture; keyboard-only use | Partial |
| Viewer loading and error states; Viewer keyboard shortcuts | None encountered |
| Oscar's 9 screenshots | Not received |

---

## Screenshot cross-check

An independent review agent (tekreviwer role) opened all 103 PNGs on 2026-10-24 and compared each with `screenshot-index.md`, its probe record and every `[Obs]` claim. The full table is in `raw/screenshot-crosscheck.md`.

**Result:** 89 match, 11 minor mismatches, 3 mismatches, 0 missing.

**All corrected in this file and the index:**
- **V-20:** the wheel changed the frequency, not the zoom.
- **D-13:** the loading view has a spinner.
- **D-35 → D-16/D-37:** the right IDs for the "*" marker.
- **Minor mismatches:** V-09 is a toggle; V-21 camera; V-25 tooltip; D-06 toast; D-19 STIPA; D-34 sections; D-37 count; D-57 fields from the DOM; D-58 menu only.
- **Facts from one-off DOM queries** (`is-disabled`, "Goto EQ Results", tool-rail tooltips, the Optimizer language default) are now labelled `[Obs: DOM eval]` (seen live, not kept as a file).
- **One finding rejected:** the `me/settings` request names *are* in the V-02 record (`raw/probes/V-02-initial.json`).

**Priority evidence all confirmed:**
- D-14/D-16, D-18, D-40, D-41, D-42, D-43/D-44, D-46;
- V-07, V-12/V-15, V-26, V-28;
- O-00.

**Privacy:** no deliverable contains the account display name.
