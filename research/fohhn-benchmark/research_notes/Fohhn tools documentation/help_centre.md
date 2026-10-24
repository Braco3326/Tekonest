# Fohhn Help Centre: paraphrased research notes

- **Researcher:** tekinspi (benchmark research for TekPractice)
- **Source:** Fohhn Help Centre, services.fohhn.com/hc/ (141 pages captured as text, numbered HC-000 to HC-140)
- **Access date:** 2026-10-24
- **Evidence label for every claim below:** Documented (Fohhn Help Centre, login-gated)
- **Method:** I worked only from the captured page text. I did not visit the live site, and I did not copy images, videos or downloads. Everything is paraphrased. Short quoted phrases (12 words or fewer) appear only where the exact UI wording matters.
- **Citation format:** `[HC-NNN: page title, URL]`. Several release notes (0.15.0 to 1.6.0) are written in German on the site; I translated and paraphrased them.
- **Caveat:** many course chapters (HC-078 to HC-108, HC-135 to HC-140) are mostly video. Their captured text is only a few bullet lines, so whatever is shown only in the videos is not covered here.

---

## 1. Designer Snapshots (priority)

### 1.1 What a snapshot is

- Fohhn describes snapshots as the core idea of Designer. A sound-system design is developed step by step, one snapshot at a time. [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1]
- The definition: a snapshot is the total of all parameter changes made to the room, the loudspeakers and the simulation settings. The definition explicitly leaves out the room geometry itself and the audience areas (listener planes). [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1]
- **Immutability:** once a snapshot has been simulated, it can no longer be changed. [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1]
  - A release-note bug fix supports this. Before 1.10.0, the reverberation time of simulated snapshots could sometimes still be edited, and this was treated as a bug. [HC-121: 1.10.0, https://services.fohhn.com/hc/articles/he1MxiH7]
- The getting-started course calls snapshots "an intelligent history". [HC-090: Snapshots (course ch. 14), https://services.fohhn.com/hc/course/qxHZnWDl/article/0iyCVUz0]

### 1.2 When a snapshot is created, and branching

- Editing a parameter (the example given is a loudspeaker position) while a simulated snapshot is displayed makes Designer clone that snapshot automatically and apply the change to the clone. Every further change collects in the clone until it is simulated. So any simulated snapshot can be the starting point for a new one. [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1]
- Release-note bug fixes confirm that snapshots are created implicitly when you edit:
  - In some situations, changing simulation settings failed to create a new snapshot. This was fixed in 0.19.2. [HC-130: 0.19.2, https://services.fohhn.com/hc/articles/qf420TaR]
  - Rotating a listener plane on a simulated snapshot did not trigger a new snapshot. This was also fixed in 0.19.2. [HC-130: 0.19.2, https://services.fohhn.com/hc/articles/qf420TaR]
- **How the very first snapshot appears (in a new project) is not described.** The docs never say whether a snapshot exists before the first simulation. The docs explain only the clone-on-edit rule.
- **Naming at creation:** the simulation settings dialog has a Name field. The default name ends in a number that goes up by one each time, and the name can be changed now or later. The dialog also has an optional Description field. [HC-055: Simulation – Settings, https://services.fohhn.com/hc/articles/SFmj1bc0]
  - The docs do not say outright that the "simulation name" is the snapshot name, but they appear to be the same thing.
  - Since 0.19.2, hovering a snapshot entry shows the snapshot's comment in a flyout. Whether this "comment" is the Description field is not stated. [HC-130: 0.19.2, https://services.fohhn.com/hc/articles/qf420TaR]

### 1.3 Hierarchy (parent and child)

- Cloning creates parent/child relationships, so snapshots form a tree. [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1]
- Snapshot numbers use dot-separated digits, and the number of digits shows how deep the snapshot sits in the tree. For example, a number like "1.2.1" would be a grandchild. The docs illustrate this with a figure only. [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1]
- Fohhn's stated purpose for the tree is to develop alternative system designs side by side, for example different loudspeaker setups. [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1]

### 1.4 Snapshot view (List, Tree, actions)

- **Opening it:** use Snapshots > Show, or click the snapshot name in the status bar. [HC-058: Snapshots view, https://services.fohhn.com/hc/articles/J3w4qYbD]
  - The status bar, in its centre, shows the current snapshot and the frequency currently rendered. [HC-018: Interface Overview, https://services.fohhn.com/hc/articles/aoBQXEtv]
  - The shortcut is CTRL+ALT+M. [HC-037: Keyboard Shortcuts, https://services.fohhn.com/hc/articles/RnPzkYXF]
- **Default panel:** when nothing is selected, the left context panel shows the snapshot overview. [HC-018: Interface Overview, https://services.fohhn.com/hc/articles/aoBQXEtv]
- **List or Tree:** the view can be shown as a list or as a tree. Clicking a list item or a tree node switches to that snapshot. [HC-058: Snapshots view, https://services.fohhn.com/hc/articles/J3w4qYbD]
  - The list/tree choice was added in 0.17.0. [HC-132: 0.17.0, https://services.fohhn.com/hc/articles/L7ZeGFNI]
- **Hover icons:**
  - In the list, hovering an entry shows Rename and Delete icons.
  - In the tree, hovering shows "Center whole tree", "Center current snapshot", Rename and Delete.

  [HC-058: Snapshots view, https://services.fohhn.com/hc/articles/J3w4qYbD]
- **Delete multiple:** the "Delete Multiple" button opens a dialog for deleting several snapshots at once. It has "Select All" and "Invert Selection" helpers. The page warns that deleted snapshots cannot be restored. [HC-058: Snapshots view, https://services.fohhn.com/hc/articles/J3w4qYbD]
- **Delete all:** there is a separate "delete all snapshots" dialog.
  - Since 0.17.0 it offers to keep the currently selected snapshot. [HC-132: 0.17.0, https://services.fohhn.com/hc/articles/L7ZeGFNI]
  - Since 1.5.0 the "Keep currently selected" option is ticked by default. [HC-126: 1.5.0, https://services.fohhn.com/hc/articles/dcgKwlyM]
  - It is not clear whether this is the same dialog as "Delete Multiple" today.
- **Confirmation for a single delete:** not mentioned.
- **Search in the snapshot view:** not mentioned.
- **Dates and timestamps on snapshots:** not mentioned.
- **Grouping or folders (beyond the tree):** not mentioned.
- **Snapshot view controls:**
  - Frequency selector: a drop-down, +/- buttons, or the mouse wheel over the drop-down.
  - Render (result type) selector.

  [HC-058: Snapshots view, https://services.fohhn.com/hc/articles/J3w4qYbD]

### 1.5 What a snapshot captures

| Item | Status | Notes and sources |
|---|---|---|
| Room geometry | **Documented as excluded** | Left out of the definition [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1]. The course also lists "Room model" under what snapshots do not include [HC-090: Snapshots (course ch. 14), https://services.fohhn.com/hc/course/qxHZnWDl/article/0iyCVUz0]. A warning appears when the room no longer matches a simulated snapshot, for example after the room was replaced [HC-124: 1.7.0, https://services.fohhn.com/hc/articles/ZpRGFxjW]. |
| Room acoustic parameters (reverberation time and similar) | **Documented as included** | "Parameter changes of the room" [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1]. The course lists "Acoustic room parameters" [HC-090: Snapshots (course ch. 14), https://services.fohhn.com/hc/course/qxHZnWDl/article/0iyCVUz0]. Reverberation time per snapshot is implied by the 1.10.0 fix [HC-121: 1.10.0, https://services.fohhn.com/hc/articles/he1MxiH7] and by a 1.6.0 auralisation fix that compares reverberation between two snapshots [HC-125: 1.6.0, https://services.fohhn.com/hc/articles/x755Mjdh]. |
| Surfaces / wall materials | **Ambiguous** | Not named explicitly. They might count as "acoustic room parameters", but no page says so. |
| Listener planes | **Contradictory** | The article says audience areas are excluded [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1]. The course slide lists "Listener planes" as included [HC-090: Snapshots (course ch. 14), https://services.fohhn.com/hc/course/qxHZnWDl/article/0iyCVUz0]. Release notes say rotating a listener plane on a simulated snapshot should spawn a new snapshot [HC-130: 0.19.2, https://services.fohhn.com/hc/articles/qf420TaR], which suggests at least listener-plane transforms are tracked. Needs a live check. |
| Loudspeakers (type and settings) | **Documented as included** | [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1]. The course says "Speakertype and Settings" [HC-090: Snapshots (course ch. 14), https://services.fohhn.com/hc/course/qxHZnWDl/article/0iyCVUz0]. |
| Speaker positions / aim | **Documented as included** | Loudspeaker position is the example of an edit that triggers a clone [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1]. Rotation and aim are not named separately, but they are loudspeaker parameters. |
| Simulation parameters | **Documented as included** | [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1] and [HC-090: Snapshots (course ch. 14), https://services.fohhn.com/hc/course/qxHZnWDl/article/0iyCVUz0] |
| Results | **Implied as included** | The snapshot view is where you switch between the results of individual simulations [HC-058: Snapshots view, https://services.fohhn.com/hc/articles/J3w4qYbD]. "Result" is not listed as a component in so many words. |
| Camera | **Not mentioned** as part of a snapshot | The three camera presets are described as project-based toolbar slots [HC-018: Interface Overview, https://services.fohhn.com/hc/articles/aoBQXEtv] and [HC-036: Camera, https://services.fohhn.com/hc/articles/JJRFvV4N]. Nothing ties them to a snapshot. |
| Display options | **Partly / ambiguous** | Since 1.5.0, switching snapshots tries to restore the broadband lower and upper cutoff [HC-126: 1.5.0, https://services.fohhn.com/hc/articles/dcgKwlyM]. Since 1.16.0, beam-annotation display is "snapshot-based" [HC-061: 1.16.0, https://services.fohhn.com/hc/articles/SCzmy5rg]. The colour-scale limits are not described as per-snapshot. |
| Result labels | **Ambiguous** | Managed from the Snapshots menu (Snapshots > Result labels) [HC-087: Result Labels (course), https://services.fohhn.com/hc/course/qxHZnWDl/article/NpXEPks5]. Labels are saved permanently with the project [HC-134: 0.15.0, https://services.fohhn.com/hc/articles/lDLVCu8n]. No page says whether they are stored per snapshot. |

### 1.6 Later edits, restoring, comparing

- **Do later edits change earlier snapshots?** No, at least for simulated ones. Editing a simulated snapshot clones it, and simulated snapshots cannot be changed. [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1]
- **Exception, geometry:** geometry is outside the snapshot. Replacing the room therefore affects every snapshot, and Designer shows a warning when a simulated snapshot no longer matches the room. [HC-124: 1.7.0, https://services.fohhn.com/hc/articles/ZpRGFxjW]
  - In 1.6.0, a bug was fixed where replacing the room and then switching snapshots caused an error. [HC-125: 1.6.0, https://services.fohhn.com/hc/articles/x755Mjdh]
- **Unsimulated snapshots:** a snapshot that has not been simulated keeps collecting edits ("all further parameter changes are stored"). [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1]
- **Restoring and branching:** switching is done by clicking a snapshot. Any simulated snapshot can be the base for a new branch. [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1] and [HC-058: Snapshots view, https://services.fohhn.com/hc/articles/J3w4qYbD]
  - Switching snapshots takes part in undo/redo:
    - An undo/redo that switches snapshot opens the snapshot view. [HC-134: 0.15.0, https://services.fohhn.com/hc/articles/lDLVCu8n]
    - Undoing to a snapshot that had since been deleted used to cause an error, fixed in 1.4.0. [HC-127: 1.4.0, https://services.fohhn.com/hc/articles/x9Rq3bFa]
  - **There is no explicit "restore" or "revert" command.**
- **Comparing:** comparison is described only as quick switching between snapshots. [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1]
  - No side-by-side view, difference view or A/B overlay is documented.
  - The spectrum tool gained "a comparison line with values" in 1.7.0, but nothing says it compares snapshots. [HC-124: 1.7.0, https://services.fohhn.com/hc/articles/ZpRGFxjW]
- **Snapshots in the IEC badge:** a footer icon shows whether the currently selected snapshot complies with IEC 60268-16 (added in 1.10.0). [HC-121: 1.10.0, https://services.fohhn.com/hc/articles/he1MxiH7]
- **Snapshots in reports:** each report is based on one snapshot. Changing the report's snapshot regenerates all of its pictures and snapshot-based data. [HC-092: Quick Report Export as PDF (course), https://services.fohhn.com/hc/course/qxHZnWDl/article/rJIa3Igo] and [HC-043: Changing general settings in the report, https://services.fohhn.com/hc/articles/gssfrO08]

### 1.7 Camera presets

- There are three camera presets at the bottom of the toolbar. Each one stores a camera position and orientation. [HC-036: Camera, https://services.fohhn.com/hc/articles/JJRFvV4N]
  - **Save:** right-click a preset. The button then shows a small thumbnail.
  - **Recall:** left-click the preset.
- The Interface Overview describes them as saved "based on your project". [HC-018: Interface Overview, https://services.fohhn.com/hc/articles/aoBQXEtv]
- The preset icons were numbered in 1.3.0, and a border was added in 0.18.0. [HC-128: 1.3.0, https://services.fohhn.com/hc/articles/rHOUf6NM] and [HC-131: 0.18.0, https://services.fohhn.com/hc/articles/MMrUmyXB]
- **They are not documented as snapshot camera presets.** If the brief assumed they belong to snapshots, the docs do not support that.

### 1.8 Result labels

- The Result Label tool places value labels on listener planes. [HC-087: Result Labels (course), https://services.fohhn.com/hc/course/qxHZnWDl/article/NpXEPks5]
  - **Remove:** click the label.
  - **Manage:** Snapshots > Result labels.
- Labels are saved with the project and restored when it is reopened (since 0.15.0). [HC-134: 0.15.0, https://services.fohhn.com/hc/articles/lDLVCu8n]
- STI labels always show 3 decimals, to stay consistent with EASE (since 1.3.0). [HC-128: 1.3.0, https://services.fohhn.com/hc/articles/rHOUf6NM]
- Label visibility is respected by the screenshot tool (since 1.4.0). [HC-127: 1.4.0, https://services.fohhn.com/hc/articles/x9Rq3bFa]

### 1.9 The "History" feature and how it relates to snapshots

- History is a **notification log**, not a design history. Designer notifications (Info, Success, Error) disappear after a few seconds and can be read again in History, which sits at the top right of the menu bar. [HC-021: History, https://services.fohhn.com/hc/articles/UeUlq4a6]
  - It can be filtered by type, cleared and searched.
  - Since 0.17.0: CTRL+F search, and messages can be copied. [HC-132: 0.17.0, https://services.fohhn.com/hc/articles/L7ZeGFNI]
- History is **not saved with the project**. It lasts only until the project is closed. [HC-021: History, https://services.fohhn.com/hc/articles/UeUlq4a6]
- Exception errors can be reported to support straight from the log history (since 1.10.0). [HC-121: 1.10.0, https://services.fohhn.com/hc/articles/he1MxiH7]
- **Relationship to snapshots:** none is documented.
  - The only link is wording: the course calls snapshots "an intelligent history". [HC-090: Snapshots (course ch. 14), https://services.fohhn.com/hc/course/qxHZnWDl/article/0iyCVUz0]
  - Undo/redo (CTRL+Z / CTRL+Y) is a third, separate mechanism. [HC-037: Keyboard Shortcuts, https://services.fohhn.com/hc/articles/RnPzkYXF]

---

## 2. Simulation

### 2.1 Settings dialog

- **Opening it:** Simulation > Setup... (or SHIFT+F9). The Simulate button (or F9) runs the simulation. [HC-055: Simulation – Settings, https://services.fohhn.com/hc/articles/SFmj1bc0] and [HC-037: Keyboard Shortcuts, https://services.fohhn.com/hc/articles/RnPzkYXF]
- **General section:**
  - Name, auto-numbered.
  - Frequency band: octave or 1/3 octave.

  [HC-055: Simulation – Settings, https://services.fohhn.com/hc/articles/SFmj1bc0]
- **Description:** optional free text. [HC-055: Simulation – Settings, https://services.fohhn.com/hc/articles/SFmj1bc0]
- **Background noise:** matters only for STI. A toggle, "Include in STI calculation", controls it. The band frequencies follow IEC 60268-16 (the page cites Annex K). [HC-055: Simulation – Settings, https://services.fohhn.com/hc/articles/SFmj1bc0]
- **Early reflections:** switched on with "Calculate early reflections". [HC-055: Simulation – Settings, https://services.fohhn.com/hc/articles/SFmj1bc0]
  - They are computed with the image-source method; the page cites Vorländer, *Auralization*.
  - Order: the number of reflections.
  - Time Lag: the window after the direct sound in which reflections are counted.
  - The default Time Lag became 35 ms in 1.21.2. [HC-060: 1.21.2, https://services.fohhn.com/hc/articles/M8qCDT4r]
  - Without a room, early reflections are skipped even when switched on. [HC-060: 1.21.2, https://services.fohhn.com/hc/articles/M8qCDT4r]
- **Advanced options:** [HC-055: Simulation – Settings, https://services.fohhn.com/hc/articles/SFmj1bc0]
  - "Calculate Multi-Source as Single-Source": pre-computes a combined directivity. Near-field effects are lost.
  - "Include masking in STI calculation": masking per IEC 60268-16.
  - "Include travel times in STI calculation": the result is then no longer IEC-compliant.
  - "Consider air damping": uses temperature, humidity and air pressure.
  - "Consider room collision": checks source-to-point visibility against the room geometry.
    - It is switched off automatically when early reflections are on (since 1.10.0). [HC-121: 1.10.0, https://services.fohhn.com/hc/articles/he1MxiH7]
  - Temperature (°C), Humidity (%), Air pressure (kPa).
    - A button resets the atmospheric conditions to their defaults (0.16.0). [HC-133: 0.16.0, https://services.fohhn.com/hc/articles/BX7mEjQo]
  - "Complex summation limit": sources are summed coherently below this frequency and incoherently above it.
    - A default for it can be set in Options (1.21.2). [HC-060: 1.21.2, https://services.fohhn.com/hc/articles/M8qCDT4r]
- **"Use Acoustic Wall Materials":** the Wall Properties page names this simulation setting, but the Settings article does not describe it. [HC-118: Wall Properties, https://services.fohhn.com/hc/articles/07zLdJlb]

### 2.2 Result types, broadband and weighting

- There are four render types: Direct SPL, Total SPL, STI and STIPA(IR). [HC-058: Snapshots view, https://services.fohhn.com/hc/articles/J3w4qYbD]
- **Broadband:** available for Direct SPL and Total SPL. [HC-058: Snapshots view, https://services.fohhn.com/hc/articles/J3w4qYbD]
  - The lower and upper cutoff frequencies can be adjusted.
  - A- or C-weighting can be added.
  - The broadband controls were wrongly visible in STI mode until 1.3.0. [HC-128: 1.3.0, https://services.fohhn.com/hc/articles/rHOUf6NM]
- **Course structure:** the course covers Direct SPL per octave, broadband and weighted. [HC-086: Direct SPL (course), https://services.fohhn.com/hc/course/qxHZnWDl/article/AfmScaGe]
- **Direct vs Total SPL:** the docs never define the difference in words. The only hint is that Total SPL and STI need a proper room model with an accurate volume. [HC-095: Remark on Room Model (course), https://services.fohhn.com/hc/course/qxHZnWDl/article/ESYMUYQ1]
  - A wrong volume affects the diffuse sound field and speech intelligibility.
  - Direct-sound-only simulation tolerates flawed (non-solid) models. [HC-050: Room – General Information, https://services.fohhn.com/hc/articles/Yo5OgvJx]

### 2.3 STI and STIPA(IR)

- **Basis:** STI uses a statistical room impulse response after Houtgast et al. IEC 60268-16 calls this "statistical prediction", which is an indirect method. [HC-054: Simulation – General Information, https://services.fohhn.com/hc/articles/jYftIt24]
- **Standard:** STI follows IEC 60268-16 Edition 5.0 (2020-09). [HC-054: Simulation – General Information, https://services.fohhn.com/hc/articles/jYftIt24]
  - Direct-sound delays are ignored, so loudspeaker delay settings do not change STI.
  - The "Include travel times" option changes this, but the result is no longer compliant.
- **STIPA:** also follows Edition 5.0. "STIPA(IR)" in the interface means the indirect method, derived from an impulse response. [HC-054: Simulation – General Information, https://services.fohhn.com/hc/articles/jYftIt24]
  - STIPA(IR) was added in 1.16.0. [HC-061: 1.16.0, https://services.fohhn.com/hc/articles/SCzmy5rg]
- **Reverberation input:** IEC 60268-16 recommends a measured reverberation time, and Fohhn repeats that advice. [HC-054: Simulation – General Information, https://services.fohhn.com/hc/articles/jYftIt24]
- **STI Female removed:** STI Female was removed in 1.16.0, citing IEC 60268-16 (2020). [HC-061: 1.16.0, https://services.fohhn.com/hc/articles/SCzmy5rg]
- **Travel-times option:**
  - Added in 1.10.0. [HC-121: 1.10.0, https://services.fohhn.com/hc/articles/he1MxiH7]
  - In 1.14.0, the automatic switching of this option was removed. [HC-063: 1.14.0, https://services.fohhn.com/hc/articles/c6ws5TO9]

### 2.4 Reverberation input (measured vs calculated)

- **Where it is set:** Global Room Properties. [HC-051: Global Properties, https://services.fohhn.com/hc/articles/dttehbhz]
  - Reverberation time is entered per frequency band, and a read-only chart shows it.
  - "Calculate Wall Materials" computes reverberation time from the wall materials, using a choice of **Eyring** or **Sabine**.
  - If the entered reverberation time does not fit the materials, Designer shows a plausibility error. You can still simulate.
  - The equivalent absorption coefficients are derived from the reverberation time and are read-only.
- **The course's two routes:** reverberation time (RT-60) either comes from a measurement or an acoustic consultant, or is derived from the wall materials. [HC-094: Simulate with Reverberation (course), https://services.fohhn.com/hc/course/qxHZnWDl/article/RL8jvZVl]
- **Option "Reverberation time follows material":** this option is mentioned in a 1.10.0 bug fix. [HC-121: 1.10.0, https://services.fohhn.com/hc/articles/he1MxiH7]
- **When no reverberation time is given (1.6.0, German note):** the reverberation is now worked out automatically, and the note words this as being "from the various loudspeakers". Entering a reverberation time switches this off. [HC-125: 1.6.0, https://services.fohhn.com/hc/articles/x755Mjdh]
  - *The wording is ambiguous.* What "from the loudspeakers" means is not explained.
- **History of the feature:** reverberation handling was completely reworked in 0.18.0. [HC-131: 0.18.0, https://services.fohhn.com/hc/articles/MMrUmyXB]

### 2.5 Calculation method

- **Geometric acoustics:** the simulation is based on geometric acoustics (GA). [HC-054: Simulation – General Information, https://services.fohhn.com/hc/articles/jYftIt24]
  - Sound travels as straight "rays", and classical reflection laws apply.
  - The wave equation is reduced to one dimension, unlike FEM, so effects such as **diffraction are neglected**.
- **STI:** uses the statistical model described in 2.3.
- **Early reflections:** use the image-source method described in 2.1.
- **Ray tracing as a named method:** not mentioned beyond the "rays" simplification.
- **Auralisation:**
  - A tool was added as an alpha in 0.16.0. [HC-133: 0.16.0, https://services.fohhn.com/hc/articles/BX7mEjQo]
  - It became beta in 0.18.0. [HC-131: 0.18.0, https://services.fohhn.com/hc/articles/MMrUmyXB]
  - The 1.10.0 note lists "a tool for auralization" again as new, together with a reflection-path display tool. [HC-121: 1.10.0, https://services.fohhn.com/hc/articles/he1MxiH7]
  - Stereo output and a recording function arrived in 1.13.0. [HC-064: 1.13.0, https://services.fohhn.com/hc/articles/O2aIOD77]
  - A "Direct sound only" option is mentioned in 1.14.0. [HC-063: 1.14.0, https://services.fohhn.com/hc/articles/c6ws5TO9]
  - The auralisation reverberation is capped at 30 s. [HC-132: 0.17.0, https://services.fohhn.com/hc/articles/L7ZeGFNI]
  - **No Help Centre article documents the auralisation tool itself.**

### 2.6 Resolution

- **Evaluation points:** the simulation evaluates the centres of the triangles of each triangulated listener plane. The triangle edge length is the resolution. [HC-027: Listener Planes – General Information, https://services.fohhn.com/hc/articles/pLkhdMPG]
- **Per-plane resolution:** each plane has a "Resolution" (maximum triangle size). Changing it re-triangulates the plane. [HC-024: Listener Plane Properties, https://services.fohhn.com/hc/articles/BAgdNsyC]
- **Limits:** [HC-130: 0.19.2, https://services.fohhn.com/hc/articles/qf420TaR]
  - The minimum default resolution in Options is 1 m.
  - A warning icon appears for resolutions below 1 m.
  - A warning appears when a simulation has more than 20,000 points.

### 2.7 Calculation time and server

- Calculation runs on a server. Since 1.10.0 the displayed calculation time covers the whole wait until results appear, not just the server calculation. [HC-121: 1.10.0, https://services.fohhn.com/hc/articles/he1MxiH7]
- Log information is written when a simulation starts (1.9.0). [HC-122: 1.9.0, https://services.fohhn.com/hc/articles/wa9ZLTAD]
- Simulations can be stopped. This is implied by a 1.1.0 fix for an error when stopping simulations. [HC-129: 1.1.0, https://services.fohhn.com/hc/articles/QHuoMXZs]
- Shadowing simulation was sped up in 0.15.0. [HC-134: 0.15.0, https://services.fohhn.com/hc/articles/lDLVCu8n]
- **No typical durations or quotas are documented.**

### 2.8 Failed or limited states

- **Simulations that are too large** are rejected, and the reason is shown (since 0.19.2). [HC-130: 0.19.2, https://services.fohhn.com/hc/articles/qf420TaR]
- **Very detailed room models** make simulation slower and can crash the browser, because browser memory is limited. Such models have to be simplified. [HC-050: Room – General Information, https://services.fohhn.com/hc/articles/Yo5OgvJx]
- **Non-solid (leaking) models** give a wrong volume, which affects the diffuse field and STI. [HC-050: Room – General Information, https://services.fohhn.com/hc/articles/Yo5OgvJx]
- **Reverberation not plausible:** an error message is shown, but simulation is still possible. [HC-051: Global Properties, https://services.fohhn.com/hc/articles/dttehbhz]
- **Simulating during meshing:** a simulation could once be started while a listener plane was still being meshed. This was fixed in 1.6.0, which implies it is now blocked. [HC-125: 1.6.0, https://services.fohhn.com/hc/articles/x755Mjdh]
- **Planes with 0 m² area** caused simulation errors. Fixed in 0.16.0. [HC-133: 0.16.0, https://services.fohhn.com/hc/articles/BX7mEjQo]

### 2.9 IEC badge

- A footer icon shows whether the selected snapshot is IEC 60268-16 compliant (added in 1.10.0). [HC-121: 1.10.0, https://services.fohhn.com/hc/articles/he1MxiH7]
- Non-compliance is documented for one setting: "Include travel times in STI calculation". [HC-055: Simulation – Settings, https://services.fohhn.com/hc/articles/SFmj1bc0]
- **The full rule for what turns the badge off is not documented.**

---

## 3. Colour scale and result display

- **Placement and gradient:** the colour scale sits at the top right and colour-codes the results. Its gradient is fixed and cannot be changed. [HC-019: Colour Scale, https://services.fohhn.com/hc/articles/P8fRcnsg]
- **Limits:** only the lower and upper limits are user-editable. [HC-019: Colour Scale, https://services.fohhn.com/hc/articles/P8fRcnsg]
  - To edit, click the bold numbers, type a value, then press Enter or click beside the scale.
  - The intermediate values adjust, and existing results redraw immediately.
  - The upper limit may not be smaller than the lower.
- **Separate STI scale:** the page has a figure captioned "Colour Scale for STI mode", which implies a separate STI scale. The text does not describe it. [HC-019: Colour Scale, https://services.fohhn.com/hc/articles/P8fRcnsg]
- **Default limits:** set in Options, for example the Direct SPL upper and lower limits. [HC-019: Colour Scale, https://services.fohhn.com/hc/articles/P8fRcnsg] and [HC-022: Options, https://services.fohhn.com/hc/articles/bj4L5uap]
- **Mouse control:** since 1.7.0, the limits can be changed by scrolling or dragging with the mouse, described as "similar to Fohhn Audio Soft". [HC-124: 1.7.0, https://services.fohhn.com/hc/articles/ZpRGFxjW]
- **Related fixes:**
  - Setting equal lower and upper limits threw an exception. Fixed in 1.8.0. [HC-123: 1.8.0, https://services.fohhn.com/hc/articles/BLzYYqdu]
  - The colour for STI = 1 was displayed wrongly. Fixed in 0.18.0. [HC-131: 0.18.0, https://services.fohhn.com/hc/articles/MMrUmyXB]
- **Steps, units and legend:** the number of steps (bands) and the units shown on the legend are **not documented in text**.
- **Report colour scale:** reports have their own SPL min/max colour-scale fields in General settings. [HC-043: Changing general settings in the report, https://services.fohhn.com/hc/articles/gssfrO08]
- **Thresholds:** no threshold, target or pass/fail colouring is documented.
- **Point labels:** see 1.8 (Result Labels).
- **Spectrum tool:**
  - Click any point on a listener plane to see its frequency response. [HC-088: Spectrum Tool (course), https://services.fohhn.com/hc/course/qxHZnWDl/article/ex5h132C]
  - Direct and Total SPL always share one chart (0.17.0). [HC-132: 0.17.0, https://services.fohhn.com/hc/articles/L7ZeGFNI]
  - A comparison line with values was added (1.7.0). [HC-124: 1.7.0, https://services.fohhn.com/hc/articles/ZpRGFxjW]
  - The previously selected point is restored when the tool reopens, and the tool now refreshes after the simulation data changes (1.21.2). [HC-060: 1.21.2, https://services.fohhn.com/hc/articles/M8qCDT4r]
- **Statistics tool:**
  - With no listener plane selected, it shows the average over all planes. Its settings are adjustable. [HC-089: Statistic Tool (course), https://services.fohhn.com/hc/course/qxHZnWDl/article/nUC3eCV9]
  - The tool appears to have no dedicated article (none was captured).
- **Histogram:**
  - Gained an "Auto-scaling" option (0.17.0). [HC-132: 0.17.0, https://services.fohhn.com/hc/articles/L7ZeGFNI]
  - The order of the upper and lower bound fields was swapped, and an off-by-one bin bug that could drop values was fixed (0.18.0). [HC-131: 0.18.0, https://services.fohhn.com/hc/articles/MMrUmyXB]
  - Histogram screenshots include descriptive statistics (0.15.0). [HC-134: 0.15.0, https://services.fohhn.com/hc/articles/lDLVCu8n]

---

## 4. Projects and the Dashboard

- **Project Page:** lists your own projects plus projects shared with you. Projects are created, managed and shared from here. [HC-012: General Information about Projects, https://services.fohhn.com/hc/articles/fevrvKaa]
- **Create:** click the orange "New Project" button, enter a Name and an optional Description, then click Add. The project opens immediately. [HC-010: Create New Project, https://services.fohhn.com/hc/articles/10BcYzkc]
  - New users receive demo projects and a pop-up pointing to the tutorials (1.7.0). [HC-124: 1.7.0, https://services.fohhn.com/hc/articles/ZpRGFxjW]
- **Filter and sort:** [HC-011: Filter and Sort Projects, https://services.fohhn.com/hc/articles/qEaS2pmJ]
  - Search covers name and description; you can just start typing.
  - Projects can be grouped by owner: yours, team and shared.
  - Sorting options include name and creation date.
  - Archived projects are hidden unless shown via Settings.
  - These preferences persist.
  - The search also matches the owner, not just the author (1.5.0). [HC-126: 1.5.0, https://services.fohhn.com/hc/articles/dcgKwlyM]
- **Manage:** [HC-013: Manage Projects, https://services.fohhn.com/hc/articles/GocgLRsU]
  - **Details tab:** shows the Owner (a user or a team), the creation date, and the Authors (everyone who changed the project).
  - Available actions depend on your permissions.
  - **Edit:** name and description.
  - **Delete:** asks for confirmation first.
  - **Duplicate:** asks for a new name and copies the project including all reports. Since 1.5.0 the name gets an automatic language-specific postfix. [HC-126: 1.5.0, https://services.fohhn.com/hc/articles/dcgKwlyM]
  - **Share.**
  - **Remove:** drops a project someone shared with you. This removes only your access; you cannot delete other people's projects.
  - **Archive:** hides the project. Archived projects **cannot be edited**.
  - **Restore:** un-archives the project.
- **Share:** [HC-014: Share Projects, https://services.fohhn.com/hc/articles/PfQlAU4z]
  - Invitees must be registered with Fohhn and have Designer access.
  - The form takes one or more email addresses, a **read-only flag per person**, and an optional message.
  - The invitee accepts or rejects the invitation on their Project Page.
  - The owner sees who has access. An icon marks people without write permission, and "pending" marks invitations not yet accepted.
  - Clicking a name lets you edit or remove that person's access.
  - **Permissions are effectively two levels: read-only or edit.**
- **Sharing in the course:** you can share with other users "or Fohhn", with a read-only option and a notification by email. [HC-096: Appendix: Share Project (course), https://services.fohhn.com/hc/course/qxHZnWDl/article/R7Z50ZBY]
- **Sharing history:**
  - Sharing, archiving and read-only opening arrived in 0.15.0. [HC-134: 0.15.0, https://services.fohhn.com/hc/articles/lDLVCu8n]
  - Multiple addresses separated by semicolons (1.7.0). [HC-124: 1.7.0, https://services.fohhn.com/hc/articles/ZpRGFxjW]
  - Address suggestions (1.8.0). [HC-123: 1.8.0, https://services.fohhn.com/hc/articles/BLzYYqdu]
- **Teams:** added in 1.13.0. Each team has its own storage area, and every member sees every project in it. [HC-064: 1.13.0, https://services.fohhn.com/hc/articles/O2aIOD77]
- **Concurrency:**
  - You are warned when you open the same project in several tabs or browsers (0.15.0). [HC-134: 0.15.0, https://services.fohhn.com/hc/articles/lDLVCu8n]
  - The "project already open" message is a warning, not an error (1.3.0). [HC-128: 1.3.0, https://services.fohhn.com/hc/articles/rHOUf6NM]
- **Autosave:**
  - Options include an interval for automatic saving. [HC-022: Options, https://services.fohhn.com/hc/articles/bj4L5uap]
  - Since 0.18.0 the project also saves automatically after every successful simulation; this can be switched off in Options. [HC-131: 0.18.0, https://services.fohhn.com/hc/articles/MMrUmyXB]
  - Manual save is CTRL+S, and "Save as" is CTRL+SHIFT+S. [HC-037: Keyboard Shortcuts, https://services.fohhn.com/hc/articles/RnPzkYXF]
  - A "dirty" marker in the tab title shows unsaved edits (1.7.0). [HC-124: 1.7.0, https://services.fohhn.com/hc/articles/ZpRGFxjW]
- **Project versions or version history:** not mentioned. Snapshots are the only versioning concept.
- **Imported room file:** since 1.8.0 (beta), an imported room is stored in the project and can be downloaded again. [HC-123: 1.8.0, https://services.fohhn.com/hc/articles/BLzYYqdu]

---

## 5. Editor

### 5.1 Interface, options, navigation

- **Layout:** six areas. [HC-018: Interface Overview, https://services.fohhn.com/hc/articles/aoBQXEtv]
  1. Menu bar (left: functions; right: Options, Notifications, profile and Help).
  2. 3D editor.
  3. Context panel on the left. It depends on what is selected and shows the snapshots when nothing is selected.
  4. Toolbar: drawing, aiming, deleting and evaluation tools, plus the 3 camera presets.
  5. Additional-information pane: hidden by default and resizable.
  6. Status bar: cursor position, the current snapshot and frequency, and the selection.
- **Options:** cross-project settings. [HC-022: Options, https://services.fohhn.com/hc/articles/bj4L5uap]
  - They include language, perspective or orthographic camera, the autosave interval, and default values such as the Direct SPL limits.
  - Options are grouped and searchable, each has a "?" tooltip, and they can be reset to defaults.
- **Keyboard shortcuts:** grouped by context. [HC-037: Keyboard Shortcuts, https://services.fohhn.com/hc/articles/RnPzkYXF]
  - Copy/paste speakers.
  - Undo/redo.
  - Save / Save as.
  - Select or deselect all of a type.
  - CTRL+L for the list view.
  - CTRL+ALT+M for the snapshot view.
  - CTRL+ALT+L to add a loudspeaker.
  - CTRL+ALT+R for the room wizard.
  - F9 to simulate.
  - SHIFT+F9 for the simulation setup.
  - DEL to delete.
  - ESC for the select tool.
  - CTRL+ALT+C / CTRL+ALT+V for beam parameters.
  - ALT+H for the home camera.
  - ALT+C to centre the scene.
  - ALT+R to reveal the selection.
  - Numpad keys for standard views, ortho/perspective toggle, rotation and dolly.
- **Mouse navigation:** [HC-039: Mouse navigation, https://services.fohhn.com/hc/articles/kSsFWQUF]
  - Left-drag orbits around a pivot sphere. The pivot is the point hit, or else a fixed distance away.
  - The wheel dollies towards the cursor.
  - Right-drag pans.
  - CTRL + left-drag looks around.
- **Camera:** [HC-036: Camera, https://services.fohhn.com/hc/articles/JJRFvV4N]
  - Central (perspective) or parallel (orthographic) projection, set in Options.
  - Many camera options.
  - 3 presets.
  - Default views under View > Camera > Default Views, also reachable through the navigation cube.
  - Home view and Centre Scene.
- **Orientation aids:** [HC-109: Orientation Aids, https://services.fohhn.com/hc/articles/1JLNG7lS]
  - An axis triad at the bottom right.
  - A clickable navigation cube at the top left.
  - Back to Default View (definable in Options).
  - Centre Scene.
  - Show Selected Objects.
- **Move gizmo:** [HC-040: Move Gizmo, https://services.fohhn.com/hc/articles/FdFPLAip]
  - Moves along an axis, within a plane (XY, YZ or ZX), or in the camera-parallel plane.
  - Either drag, or click to start and click again to finish. ESC cancels.
  - Related release notes:
    - A gizmo orientation menu toggles world or object axes (1.7.0). [HC-124: 1.7.0, https://services.fohhn.com/hc/articles/ZpRGFxjW]
    - CTRL + gizmo translate clones speakers (1.10.0). [HC-121: 1.10.0, https://services.fohhn.com/hc/articles/he1MxiH7]
- **List views:** [HC-038: List Views, https://services.fohhn.com/hc/articles/K4HddDUs]
  - Available for loudspeakers, listener planes and walls.
  - Support search, multi-select (CTRL / SHIFT), paging, grouping, multi-column sort, column show/hide and reorder, and compact rows.
  - Settings are remembered.
  - **Inconsistency:** this page says to sort by right-clicking the header, while the loudspeaker and listener-plane list pages describe clicking an arrow icon. [HC-034: Loudspeaker List View, https://services.fohhn.com/hc/articles/bkw8SSvk]
  - Lists are read-only: select a row to edit it in the left panel. [HC-034: Loudspeaker List View, https://services.fohhn.com/hc/articles/bkw8SSvk]

### 5.2 Room

- **Fundamentals:** [HC-050: Room – General Information, https://services.fohhn.com/hc/articles/Yo5OgvJx]
  - The room is a triangle mesh and must be "solid" (watertight) for the volume, diffuse field and STI to be correct.
  - Keep the mesh simple.
  - The zero reference is the bottom centre of the bounding box.
  - The page recommends the SketchUp Solid Inspector plugin.
- **One room only:** there can be only one room per project. [HC-051: Global Properties, https://services.fohhn.com/hc/articles/dttehbhz]
- **Import formats:** [HC-052: Room – Import, https://services.fohhn.com/hc/articles/qEmniMGq]
  - Designer cannot build complex rooms itself.
  - **Collada (.dae):** faces must be triangulated and one-sided, with consistent winding.
  - **EASE face export (.xfc):** wall material names are imported too.
  - The course lists the allowed extensions as .xfc and .dae. [HC-080: Room Model (course), https://services.fohhn.com/hc/course/qxHZnWDl/article/KgEqRNCN]
  - On import, a dialog maps the imported materials to the Designer material library (0.15.0). [HC-134: 0.15.0, https://services.fohhn.com/hc/articles/lDLVCu8n]
- **SketchUp workflow:** [HC-049: Creating rooms with SketchUp, https://services.fohhn.com/hc/articles/f1ktANF3]
  1. Screenshot the top and side views of the DWG.
  2. Set up SketchUp: layers, X-Ray style, parallel projection.
  3. Import and scale the screenshots.
  4. Draw both outlines, extrude them and intersect.
  5. Draw the stage.
  6. Mirror the half-model and export it as Collada.
- **SketchUp course:** adds a "Simple in Meters" template, keeping only "wet" surfaces, and appendices on rotating the room, moving the origin, removing surfaces and reversing faces. [HC-006: SketchUp course Introduction, https://services.fohhn.com/hc/course/ar6yjy1H/article/28V4qYuu], [HC-097: Preparation, https://services.fohhn.com/hc/course/ar6yjy1H/article/AyPQL9N9] and [HC-108: Appendix: Face Orientation, https://services.fohhn.com/hc/course/ar6yjy1H/article/G0O6XcfU]
- **Corrections:** [HC-048: Corrections, https://services.fohhn.com/hc/articles/l3Bqp0JP]
  - One wall: Wall properties > Advanced > invert orientation.
  - All walls: Room > Invert room areas.
  - Import also checks and auto-corrects orientation (fixed in 1.4.0). [HC-127: 1.4.0, https://services.fohhn.com/hc/articles/x9Rq3bFa]
- **Global properties:** [HC-051: Global Properties, https://services.fohhn.com/hc/articles/dttehbhz]
  - Volume and total surface area.
  - "Visible" (moved to Advanced in 1.10.0).
  - "Show Model Errors": a red line marks an outer edge or hole, and a yellow line marks a bad connection.
  - Room position: moving the room can carry the speakers and listener planes with it.
  - Reverberation time per band.
  - Eyring or Sabine material calculation.
  - Read-only absorption coefficients.
  - Advanced options: solid render and transparency (1.10.0). [HC-121: 1.10.0, https://services.fohhn.com/hc/articles/he1MxiH7]
  - **Temperature, humidity and air pressure live in the simulation settings, not in the room properties.** [HC-055: Simulation – Settings, https://services.fohhn.com/hc/articles/SFmj1bc0]
  - **A unit system (metric or imperial) setting is not mentioned.** Values seen in the docs are metric: m, m², °C, %, kPa and ms.
- **Wall list:** opened with Room > Overview. The default columns are wall name, material, surface and colour. [HC-117: Wall List, https://services.fohhn.com/hc/articles/H6TMJDIA]
- **Wall properties:** [HC-118: Wall Properties, https://services.fohhn.com/hc/articles/07zLdJlb]
  - Every surface starts with the material "Global".
  - Read-only position and area.
  - Material picker.
  - The colour applies to every surface with the same material.
  - Advanced: invert orientation.
  - An absorption chart shows the selected material if "Use Acoustic Wall Materials" is on, and the Global material otherwise.
- **Wizard:** Room > Generate... builds a box from Length, Width and Height, plus a listener-plane Resolution and Height. [HC-119: Wizard, https://services.fohhn.com/hc/articles/G266TBSE]
  - The page says "simple square room", but the three independent dimensions imply a rectangular box.
- **Materials:**
  - Material management dialog with custom materials (0.15.0). [HC-134: 0.15.0, https://services.fohhn.com/hc/articles/lDLVCu8n]
  - A cross-project user material database (0.18.0). [HC-131: 0.18.0, https://services.fohhn.com/hc/articles/MMrUmyXB]
  - 117 extra wall materials (1.4.0). [HC-127: 1.4.0, https://services.fohhn.com/hc/articles/x9Rq3bFa]
  - Materials already added are shown again in the selection dialog, so their description is quicker to view (1.15.0). [HC-062: 1.15.0, https://services.fohhn.com/hc/articles/XETzpdH9]
- **FAQ titles only:** the FAQ list asks "Can I import my EASE project?" and why imported surfaces show different colours. The answers were not in the captured text. [HC-008: Fohhn Designer – FAQs, https://services.fohhn.com/hc/faqs/BKegJcYw]

### 5.3 Listener planes

- **Concept:** [HC-027: Listener Planes – General Information, https://services.fohhn.com/hc/articles/pLkhdMPG]
  - Planes are flat polygons at ear height. They may be non-convex and may have holes.
  - They are triangulated, and the triangle centres are the evaluation points.
  - Four ways to create them: draw, generate from geometry, import Collada, import EASE .xar.
- **Draw:** [HC-026: Draw a Listener Plane, https://services.fohhn.com/hc/articles/Ip8lnECC]
  - Rectangles only.
  - Either press-and-drag (the page says right mouse button) or click-move-click.
  - An inclined plane results if the second point lies in a different plane.
  - The plane is auto-triangulated at the default resolution.
  - Planes smaller than 0.2 m² are prevented. [HC-127: 1.4.0, https://services.fohhn.com/hc/articles/x9Rq3bFa]
  - Duplicate planes trigger a warning. [HC-064: 1.13.0, https://services.fohhn.com/hc/articles/O2aIOD77]
- **From geometry (Offset Tool):** hover a surface (shown by white outlines) and click. [HC-025: Create a Listener Plane based on a geometry, https://services.fohhn.com/hc/articles/dvDM2d3b]
  - The plane is offset along the surface normal by a distance d.
  - The default d is 1.2 m, set in Options > Listening Planes.
- **Import:** Listening Planes > Import... accepts EASE .xar or Collada .dae. Collada objects are split into individual surfaces. [HC-028: Import Listener Planes, https://services.fohhn.com/hc/articles/I1fETNCu]
- **Properties:** [HC-024: Listener Plane Properties, https://services.fohhn.com/hc/articles/BAgdNsyC]
  - Name.
  - Position in global Cartesian coordinates.
  - Rotation per axis, applied in a fixed order.
  - Surface area in m².
  - Transparency.
  - Resolution, with a Change button that re-triangulates.
- **Heights:** the default audience-area height is 1.2 m (1.5.0). [HC-126: 1.5.0, https://services.fohhn.com/hc/articles/dcgKwlyM]
  - The wizard has its own listener-plane Height field. [HC-119: Wizard, https://services.fohhn.com/hc/articles/G266TBSE]
- **List:** opened with Listener planes > List...; read-only, sortable, searchable, with column settings. [HC-110: Listener Plane List, https://services.fohhn.com/hc/articles/WcCcuClR]

### 5.4 Loudspeaker

- **Types:** Single Source, Beam Steering and Bass. The catalogue covers only Fohhn products and is updated from time to time. [HC-032: Loudspeaker – General Information, https://services.fohhn.com/hc/articles/nO383bLw]
- **Add:** Loudspeaker > Add opens a series-grouped list with a hover image and a product link. [HC-031: Loudspeaker – Add, https://services.fohhn.com/hc/articles/JWIER36d]
  - The chosen speaker "sticks" to the cursor until you click to place it.
  - Snapping: to the floor if there is no geometry, to the surface under the cursor (kept inside the room), or on top of another speaker, copying its orientation (a mechanical stack).
  - The list shows a speaker's status, such as "discontinued", and discontinued models are optionally visible (1.7.0). [HC-124: 1.7.0, https://services.fohhn.com/hc/articles/ZpRGFxjW]
- **Import:** Loudspeaker > Import EASE Speaker reads EASE .xld. [HC-033: Loudspeaker – Import, https://services.fohhn.com/hc/articles/DD3KKFRF]
  - Designer tries to map each type to a Fohhn model. Types it cannot map show "Ignore", and you pick a replacement.
  - Position and delay are editable per speaker before importing.
- **Properties:** [HC-030: Loudspeaker Properties, https://services.fohhn.com/hc/articles/2maslJnV]
  - Image, product link, and Change (replace the model).
  - Name.
  - Gain: attenuation only, no positive values. The range was set to −80 to 0 dB in 0.19.2. [HC-130: 0.19.2, https://services.fohhn.com/hc/articles/qf420TaR]
  - Mute: a label appears at the acoustic centre.
  - Delay in ms, with the equivalent distance shown.
  - Position and rotation, with rotations applied in a fixed order.
  - Acoustic centre: shown in local coordinates, read-only, with a "Show Always" toggle.
  - High-pass and low-pass filters with cutoffs.
  - An x-band EQ whose band count follows the simulation's frequency band (octave or 1/3 octave). Positive gains are not allowed.
  - A response chart.
  - Meta data: Group and cabinet size.
  - Beam Parameter (beam-steering speakers only):
    - Two Beam mode; Beam 2 is off by default.
    - Angle (vertical tilt).
    - Beam (width).
    - Optimize, with Centre available when Optimize is on.
    - Gain.
    - High Pass with Cutoff.
  - Variants, for example horn 90x50 vs 60x50.
  - Stacks: Stack Count.
  - Bass stacks:
    - Number of Speakers.
    - Array Direction.
    - Distance, measured between acoustic centres by default or between cabinets.
    - Invert polarity.
    - A single beam, which enables end-fire designs.
- **List view:** opened with Loudspeaker > Overview.... It is read-only and supports CTRL/SHIFT selection, CTRL+A/D, multi-sort with CTRL, column settings, grouping and search. [HC-034: Loudspeaker List View, https://services.fohhn.com/hc/articles/bkw8SSvk]
- **Aim:** the toolbar has "aligning" tools. [HC-018: Interface Overview, https://services.fohhn.com/hc/articles/aoBQXEtv]
  - An Aiming tool and a Mirror tool are mentioned. [HC-133: 0.16.0, https://services.fohhn.com/hc/articles/BX7mEjQo]
  - The course uses the Mirror tool and the Alignment tool's "Auto spacing". [HC-084: Mirror Speaker (course), https://services.fohhn.com/hc/course/qxHZnWDl/article/9RXZG2Ef] and [HC-085: Frontfills (course), https://services.fohhn.com/hc/course/qxHZnWDl/article/WzfML4Ay]
  - **No article documents the aiming tool itself.**
- **Beam parameter transfer:**
  - **Inside Designer:** Loudspeaker > Copy Beams / Paste Beams, or CTRL+ALT+C / V, to one or more targets. [HC-111: Transfer Beam Parameters, https://services.fohhn.com/hc/articles/cmJxZNO3]
  - **To Fohhn Audio Soft (FAS):** Export > Fohhn Audio Soft > Beams writes an FFC file, for all speakers or only the selected ones. Export > Fohhn Audio Soft > Project writes a complete FAS project. [HC-016: Fohhn Audio Soft (export), https://services.fohhn.com/hc/articles/pDKLmhtf]
  - The beam angle and width ranges were aligned with FAS in 1.8.0. [HC-123: 1.8.0, https://services.fohhn.com/hc/articles/BLzYYqdu]
- **EQ transfer:**
  - **Inside Designer:** Loudspeaker > Copy EQ / Paste EQ, between speakers. [HC-112: Transfer EQ data, https://services.fohhn.com/hc/articles/kW4K83kY]
  - **To FAS:** band EQs are converted to parametric EQs on FAS export (0.15.0). [HC-134: 0.15.0, https://services.fohhn.com/hc/articles/lDLVCu8n]
  - EQs can be fully enabled or disabled (1.13.0). [HC-064: 1.13.0, https://services.fohhn.com/hc/articles/O2aIOD77]

---

## 6. Export and Report Configurator

- **Purpose:** the configurator produces standardised reports. The layout is fixed, while the user chooses the content. [HC-042: What is the report configurator?, https://services.fohhn.com/hc/articles/ggjNTOaq]
  - A new report is pre-filled with defaults, so it can be generated right away.
  - Output is PDF.
- **New report:** Export > Report configurator > New Report. Enter a name and pick a language, which **cannot be changed later**. [HC-045: How do I add a new report?, https://services.fohhn.com/hc/articles/re7nkfBz]
  - Before creating it, set the snapshot, frequency, colour-scale limits and camera, because they become the defaults.
  - Since 1.14.0, the title page uses the current results-view settings. [HC-063: 1.14.0, https://services.fohhn.com/hc/articles/c6ws5TO9]
- **Managing reports:** [HC-114: How do I manage my reports?, https://services.fohhn.com/hc/articles/CUW1DED4]
  - The overview lists all reports, and only one can be loaded at a time; it is highlighted in orange.
  - Edits persist and are saved with the project.
  - Actions: edit the name and comment, delete permanently, duplicate (same language).
- **Interface:** [HC-115: The Configurator Interface, https://services.fohhn.com/hc/articles/JtB54m7o]
  - Chapters and subchapters, either of which can be optional or hidden.
  - Blocks for text, pictures and more; required blocks are flagged.
  - A validation pass runs before generation and shows chapters with errors in bold.
  - "Generate" produces the PDF.
  - "Export images" produces a ZIP.
- **Course chapters:** you can add a Total SPL and STI chapter and a speaker-table appendix. [HC-093: Modifying a Report (course), https://services.fohhn.com/hc/course/qxHZnWDl/article/8yejRGe9]
- **Resources:** [HC-116: What are resources?, https://services.fohhn.com/hc/articles/1rQHYV5r] and [HC-044: How can I integrate resources?, https://services.fohhn.com/hc/articles/Ee8WUDUO]
  - Resources are placeholder keys in the text: simulation data, images, tables, and project data such as the name and date.
  - The keys are replaced only when the PDF is generated.
  - **Global** resources apply across the whole report: "Insert key" / "Copy key".
  - **Template texts** have placeholders that the picker walks you through filling in.
  - **Local** resources belong to one block:
    - Uploaded images.
    - Designer screenshots taken with the Screenshot Tool.
    - **Screenshot series**: the same view rendered at several frequencies.
- **"Updates when data changes":** changing the report's snapshot or its SPL colour-scale min/max regenerates the report. All screenshots and resources are replaced to match. [HC-043: Changing general settings in the report, https://services.fohhn.com/hc/articles/gssfrO08] and [HC-116: What are resources?, https://services.fohhn.com/hc/articles/1rQHYV5r]
  - Changing General settings automatically refreshes the screenshots. [HC-044: How can I integrate resources?, https://services.fohhn.com/hc/articles/Ee8WUDUO]
  - The docs are silent on whether uploaded images or edited text are affected; presumably they are not.
- **PDF:** [HC-046: How do I export a report as a PDF?, https://services.fohhn.com/hc/articles/HFQDcMDM]
  - Generate opens a new window; you can keep working in the meantime.
  - The PDF link **lasts one day and works only for you**.
  - A custom PDF viewer has been used since 1.9.0. [HC-122: 1.9.0, https://services.fohhn.com/hc/articles/wa9ZLTAD]
- **Image ZIP:** "Export Images" compiles in the background and then downloads automatically. It is intended for building your own report. [HC-113: How do I export all images in a report as a ZIP?, https://services.fohhn.com/hc/articles/49wHbBbj]
- **Other exports:**
  - FAS beams (FFC) and FAS project (see 5.4). [HC-016: Fohhn Audio Soft (export), https://services.fohhn.com/hc/articles/pDKLmhtf]
  - Speaker lists as separate PDFs from the Export menu (0.15.0). [HC-134: 0.15.0, https://services.fohhn.com/hc/articles/lDLVCu8n]
  - Speaker list/table export sortable by type or name (0.19.2). [HC-130: 0.19.2, https://services.fohhn.com/hc/articles/qf420TaR]
  - All exports use the current UI language. [HC-130: 0.19.2, https://services.fohhn.com/hc/articles/qf420TaR]

---

## 7. Release-notes timeline (Designer)

Dates are as printed (DD.MM.YYYY). The list includes only changes relevant to snapshots, simulation, STI/STIPA, history, sharing, export and performance. Versions 1.2, 1.12 and 1.17–1.21.1 have no notes in the Help Centre.

- **0.15.0 – 21.08.2019** [HC-134: 0.15.0, https://services.fohhn.com/hc/articles/lDLVCu8n]
  - Project sharing, read-only opening, archiving.
  - Warning when the same project is open twice.
  - Speaker lists exportable as PDF.
  - Band EQ converted to parametric for FAS.
  - Result labels saved with the project.
  - Histogram screenshots include statistics.
  - Faster shadowing simulation.
  - Experimental early-reflection display.
  - Undo/redo that switches snapshot opens the snapshot view.
- **0.16.0 – 09.10.2019** [HC-133: 0.16.0, https://services.fohhn.com/hc/articles/BX7mEjQo]
  - Early-reflection visualisation tool.
  - Auralisation alpha.
  - Reset button for atmospheric conditions.
  - Snapshot name shown in the Rename dialog.
  - Fix: simulating 0 m² planes.
- **0.17.0 – 15.11.2019** [HC-132: 0.17.0, https://services.fohhn.com/hc/articles/L7ZeGFNI]
  - Snapshot view gains List/Tree toggle.
  - "Delete all snapshots" can keep the current one.
  - Spectrum tool shows Direct and Total SPL together.
  - Histogram auto-scaling.
  - History search (CTRL+F) and copy.
  - Share dialog improved.
  - Auralisation reverberation capped at 30 s.
- **0.18.0 – 16.01.2020** [HC-131: 0.18.0, https://services.fohhn.com/hc/articles/MMrUmyXB]
  - Reverberation handling rebuilt.
  - Autosave after each successful simulation (can be disabled).
  - User material database.
  - Early-reflection settings in Options.
  - Auralisation beta.
  - Fixes: snapshot rename not shown in the footer; STI = 1 colour; histogram bin; statistics crash with many values.
- **0.19.2 – 28.01.2020** [HC-130: 0.19.2, https://services.fohhn.com/hc/articles/qf420TaR]
  - Warning for more than 20,000 points.
  - Snapshot comment flyout.
  - Rejection reason shown for oversized simulations.
  - Minimum default resolution 1 m.
  - Fixes: listener-plane rotation and some simulation-setting changes failed to create a new snapshot.
- **1.1.0 – 13.02.2020** [HC-129: 1.1.0, https://services.fohhn.com/hc/articles/QHuoMXZs]
  - Beam copy shortcuts.
  - Fixes: statistics values in the screenshot tool; error when stopping a simulation; auralisation without a room.
- **1.3.0 – 30.03.2020** [HC-128: 1.3.0, https://services.fohhn.com/hc/articles/rHOUf6NM]
  - STI labels shown with 3 decimals (EASE-consistent).
  - Camera mode respected when re-shooting screenshots.
  - Large report images downscaled.
  - Own user management.
  - Fixes: broadband settings visible in STI mode; invalid global absorption blocking simulations.
- **1.4.0 – 17.04.2020** [HC-127: 1.4.0, https://services.fohhn.com/hc/articles/x9Rq3bFa]
  - Report respects camera mode.
  - Screenshot tool respects label visibility.
  - Fix: undo to a deleted snapshot.
- **1.5.0 – 22.06.2020** [HC-126: 1.5.0, https://services.fohhn.com/hc/articles/dcgKwlyM]
  - "Keep currently selected" is the default when deleting all snapshots.
  - Switching snapshots restores the broadband cutoffs.
  - Fix: an error when switching snapshots.
  - Fix: a rounding bug that made a project impossible to simulate after save and reload.
- **1.6.0 – 24.09.2020** [HC-125: 1.6.0, https://services.fohhn.com/hc/articles/x755Mjdh]
  - Automatic reverberation when no reverberation time is entered (wording ambiguous).
  - Fixes: simulating while a plane is meshing; auralisation reverberation not updating between snapshots; room replace followed by snapshot switch.
- **1.7.0 – 05.11.2020** [HC-124: 1.7.0, https://services.fohhn.com/hc/articles/ZpRGFxjW]
  - **Warning when the room no longer matches a simulated snapshot.**
  - Spectrum comparison line.
  - Colour-scale mouse scroll and drag.
  - Report title image uses the current render mode.
  - Semicolon-separated share addresses.
- **1.8.0 – 18.01.2021** [HC-123: 1.8.0, https://services.fohhn.com/hc/articles/BLzYYqdu]
  - Imported room stored in the project (beta).
  - Share address suggestions.
  - Fixes: equal colour-scale limits; early reflections with gain; multi-as-single-source with beam angle.
- **1.9.0 – 15.03.2021** [HC-122: 1.9.0, https://services.fohhn.com/hc/articles/wa9ZLTAD]
  - Custom PDF viewer.
  - Simulation start logging.
- **1.10.0 – 17.05.2021** [HC-121: 1.10.0, https://services.fohhn.com/hc/articles/he1MxiH7]
  - **Early reflections simulation.**
  - Reflection-path tool.
  - Auralisation tool.
  - "Include travel times in STI" option.
  - **IEC 60268-16 compliance icon** in the footer.
  - Displayed calculation time now end-to-end.
  - Room collision auto-off with early reflections.
  - Exceptions reportable from History.
  - Fixes: **simulated snapshots' reverberation time could be changed**; undo/redo when moving a plane in a simulated snapshot; snapshot-view frequency init; timestamp bug that left a project unopenable.
- **1.11.0 – 08.06.2021** [HC-120: 1.11.0, https://services.fohhn.com/hc/articles/skV9j0YU]
  - Company data in the profile.
  - Fix: EQ chart not refreshing after an EQ transfer.
- **1.13.0 – 29.09.2021** [HC-064: 1.13.0, https://services.fohhn.com/hc/articles/O2aIOD77]
  - Teams with shared storage.
  - Public registration.
  - EQ on/off.
  - Stereo auralisation and recording.
  - Duplicate listener-plane warning.
- **1.14.0 – 15.11.2021** [HC-063: 1.14.0, https://services.fohhn.com/hc/articles/c6ws5TO9]
  - Automatic switching of "Include travel times in STI" removed.
  - Report title page uses the current results view.
  - Login performance improved.
  - Fixes: large-room import; reverberation times below 63 Hz set to 0 s; team projects broke the filter; report resources not shown; auralisation mono vs stereo.
- **1.15.0 – 25.01.2022** [HC-062: 1.15.0, https://services.fohhn.com/hc/articles/XETzpdH9]
  - Grid and axes can be hidden in the screenshot tool.
- **1.16.0 – 19.04.2022** [HC-061: 1.16.0, https://services.fohhn.com/hc/articles/SCzmy5rg]
  - **STIPA(IR) added.**
  - **STI Female removed** (IEC 60268-16:2020).
  - Beam-annotation display made snapshot-based.
  - Error messages improved.
- **1.21.2 – 12.06.2023** [HC-060: 1.21.2, https://services.fohhn.com/hc/articles/M8qCDT4r]
  - Default complex summation limit option.
  - Default "optimize" beam flag option.
  - Default time lag 35 ms.
  - Spectrum tool restores its selected point.
  - Fixes: spectrum tool refresh after data change; ortho zoom during screenshot series; filter frequencies follow the band choice; no early reflections without a room.

---

## 8. Optimizer

- **Purpose:** a Fohhn Services web app that analyses how the room affects a loudspeaker system and proposes filter (EQ) settings for the built-in DSP. [HC-072: Optimizer – General information, https://services.fohhn.com/hc/articles/aCWZkCFm]
  - The algorithm is based on Fohhn's FAMSA measurement programme.
- **Procedure:** [HC-072: Optimizer – General information, https://services.fohhn.com/hc/articles/aCWZkCFm]
  1. In Fohhn Audio Soft, connect the amplifier and load a standard preset **without EQ**.
  2. Run pink noise at a suitable level. Use the device's noise generator for a one-amp system; otherwise feed pink noise into the system.
  3. Measure several listener positions in the Optimizer, calculate the EQ, and copy it to the output channel's EQ.
- **Course:** chapters are Prepare amplifier (FAS routing, manual chapter 5.2), Start, Switch on pink noise (pink-noise file offered), Measurement, Copy EQs and Summary. The Measurement, Copy EQs and Summary chapters are video-only in the captured text. [HC-135: Prepare amplifier, https://services.fohhn.com/hc/course/qMFUGjLh/article/MtdwLeMw], [HC-137: Switch on pink noise, https://services.fohhn.com/hc/course/qMFUGjLh/article/e4O3oiM0] and [HC-138: Measurement, https://services.fohhn.com/hc/course/qMFUGjLh/article/SWx3Q5md]
- **Commissioning checklist:** the page only offers a downloadable checklist. The file was not captured (the download failed), so **its content is unknown**. [HC-071: Commissioning checklist, https://services.fohhn.com/hc/articles/TnceCN0c]
- **Microphone choice:** two modes. [HC-075: Select a microphone, https://services.fohhn.com/hc/articles/3fZ0Xela]
  1. **External device via QR code.** Scanning the code opens a session link, for example on a smartphone, which then acts as a remote measurement mic. Results show on both devices.
  2. **Local microphone** attached to the PC. You start it with "Start measurement".
  - **Why "Start Measuring" might be disabled is not documented**, for example no microphone permission or no device.
- **Settings:** changes apply when the settings window closes. [HC-076: Optimizer – Settings, https://services.fohhn.com/hc/articles/WbTeAFIR]
  - *Application:* Language; "Show preparation view" checkbox.
  - *Measurement:*
    - Bands/Octave: frequency-domain averaging.
    - Sampling time: the measurement time.
    - Mean value: the number of samples averaged while the signal is rising.
    - Release: the number of samples averaged while the signal is falling.
  - *EQ:*
    - Working range Min and Max: the lower and upper cutoffs of the reference curve.
    - Maximum Q.
    - Number of Filters: the maximum count.
    - Optimization Mode: **Strict** applies the EQ gains unreduced; **Moderate** scales them down by the Moderate Level factor.
    - Moderate Level.
  - **No default values are stated for any setting.** Whether Moderate Level is a percentage is not stated; the text says "factor".
- **What an Optimizer snapshot is:** [HC-077: Take Snapshots, https://services.fohhn.com/hc/articles/ycTEuJKc]
  - A **stored frequency-response measurement** taken while pink noise plays, ideally at a typical listener position.
  - "Take Snapshot" saves the current measurement, and **at most five** snapshots can be stored.
  - The chart shows the saved snapshots in colour and the live response in black, normalised to 0 dB at 1 kHz.
  - "Calculate EQ" averages the snapshots and computes a proposal from them and the settings.
- **Contrast with Designer snapshots:** these share only a name.

  | | Optimizer snapshot | Designer snapshot |
  |---|---|---|
  | What it is | A single measured spectrum (one listener position) | A versioned state of the simulation parameters |
  | How many | Capped at 5 | Arranged in a tree |
  | Changes | No editing | Immutable after simulation, cloned on edit |

  Sources: [HC-077: Take Snapshots, https://services.fohhn.com/hc/articles/ycTEuJKc] and [HC-057: Snapshots – General Information, https://services.fohhn.com/hc/articles/z1mMgAg1]
  - Deleting or replacing individual Optimizer snapshots is **not documented**.
- **EQ proposal, review and export:** [HC-074: Optimization and EQ export, https://services.fohhn.com/hc/articles/rzIAFJMs]
  - The proposal appears automatically.
  - The chart shows the averaged snapshot response (black), the resulting response (orange) and the reference curve (blue).
  - A table lists the parametric EQ values. **An empty table means optimisation is not necessary or not possible.**
  - "Copy to clipboard" copies the values, which can be pasted straight into the EQ section of **Fohhn Audio Soft 5.7 or later**.
  - **Manual adjustment of the proposed filters in the Optimizer is not documented.** "Adjust" seems to happen only through the settings, followed by recalculating.
- **Documented limitations:**
  - At most 5 snapshots.
  - Requires FAS 5.7 or later for paste.
  - An empty result is possible.
  - Requires a no-EQ preset and pink noise.
- **FAQ titles only, answers not captured:** [HC-069: Fohhn Optimizer – FAQs, https://services.fohhn.com/hc/faqs/GXYOjbHl]
  - Whether it is limited to specific Fohhn hardware.
  - Use outside conference rooms.
  - Smartphone measurement trust and accuracy.
  - System requirements.
  - Where to get pink noise.

---

## 9. Speaker Viewer

- **Content available:** the Speaker Viewer category holds only one release note, so the Help Centre has no user documentation for it. [HC-003: Fohhn Speaker Viewer, https://services.fohhn.com/hc/categories/LHaQgzE5]
- **Tagline:** it "Visualizes loudspeaker data". [HC-000: Help Centre home, https://services.fohhn.com/hc/]
- **Release 1.4.0 (25.01.2022):** fixed wrong frequencies in the **polar chart** and the **balloon view**, and added a missing favicon. These are the only views named. [HC-066: Speaker Viewer 1.4.0, https://services.fohhn.com/hc/articles/ILnL66vY]
- **Normalisation, smoothing, interpolation, "Measured with preset":** **not mentioned anywhere** in the Help Centre.

---

## 10. What the Help Centre does NOT say

- **Snapshot creation:** how and when the very first snapshot is created.
- **Snapshot metadata:** whether snapshots carry dates or timestamps.
- **Snapshot view tools:** whether it has search, filtering or grouping.
- **Single-snapshot delete:** whether it asks for confirmation. The docs only warn that deletion cannot be undone.
- **Snapshot comparison:** no side-by-side, difference or overlay comparison is described. Comparison means switching.
- **Listener planes in snapshots:** the article and the course contradict each other.
- **Wall materials in snapshots:** not stated.
- **Per-snapshot settings:** whether camera, colour-scale limits and result labels are per snapshot.
- **Restore or revert:** no explicit command, and no rule for what happens to an unsimulated draft snapshot when you switch away.
- **Calculation detail:**
  - Direct vs Total SPL is not defined.
  - Ray-tracing details, statistical reverb tail details, and the colour-scale step count and units are missing.
  - The full rule for the IEC compliance icon is missing.
  - Typical calculation times and server quotas are missing.
- **Units and versions:**
  - No unit-system (metric or imperial) option.
  - No project version history apart from snapshots.
  - No documentation of the auralisation, reflection-path, aiming, mirror or alignment tools (they appear only in release notes or the course).
- **Optimizer:**
  - Default values for its settings.
  - Why "Start measurement" could be disabled.
  - How to delete or replace an Optimizer snapshot.
  - Manual EQ editing.
  - The checklist content.
  - The FAQ answers.
- **Speaker Viewer:** no user documentation at all.

---

## Claims for the audit to verify live

1. Editing any loudspeaker parameter while a **simulated** snapshot is shown creates a new child snapshot automatically, and the original's results stay unchanged.
2. A simulated snapshot's reverberation time and simulation settings cannot be edited in place.
3. Moving or rotating a listener plane on a simulated snapshot creates a new snapshot. This settles the article vs course contradiction about whether planes belong to snapshots.
4. Replacing the room shows a warning on previously simulated snapshots, and old snapshots keep their results.
5. Snapshot numbering uses dot-separated tree depth, for example 1, 1.1, 1.1.1.
6. Deleting a single snapshot asks for confirmation. *Not documented; the docs say only that deletion is irreversible.*
7. "Delete Multiple" offers Select All and Invert Selection, and deleting all snapshots defaults to keeping the current one.
8. Hovering a snapshot shows its description or comment as a flyout.
9. The snapshot list shows no creation dates and has no search box.
10. The three camera presets are shared across all snapshots in a project, not stored per snapshot.
11. Switching snapshots restores that snapshot's broadband cutoff frequencies.
12. With "Include travel times in STI calculation" on, the footer IEC 60268-16 icon shows non-compliance.
13. Changing a report's snapshot or its SPL colour-scale limits regenerates every screenshot in that report.
14. The generated PDF link expires after one day and does not open for another account.
15. The Optimizer refuses a sixth snapshot, and an empty EQ table can appear when no optimisation is possible.
