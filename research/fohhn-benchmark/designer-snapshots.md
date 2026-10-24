# Designer Snapshots: the full journey (priority deliverable)

- **Audit:** tekinspi, 2026-10-24. I tested this live on a **duplicate** of "Example - Hall", named "Audit copy - Hall (tekinspi, delete me)". The originals were not edited.
- **Evidence labels:**
  - **[Obs: ID]** — live, with the capture ID.
  - **[Doc: HC-nnn]** — Help Centre article (paraphrased in `research_notes/…/help_centre.md`).
  - **[Inf]** — inference.
  - **[Unk]** — unknown.
- Where Observed and Documented disagree, both are shown.

## 1. In one paragraph

A Designer snapshot is a **named, timestamped, immutable record of one calculation**. It holds:

- the loudspeaker setup (positions included);
- the listener planes;
- the room's acoustic parameters;
- the simulation settings;
- the results for every band.

You never press "save snapshot". Instead:

1. Running a simulation creates one.
2. Editing anything while a calculated snapshot is shown silently creates an uncalculated child ("clone-on-edit").
3. Snapshots form a **tree**, so trying an alternative is a branch.
4. Selecting any node restores that state in the 3D scene, results included.
5. Display choices (result type, band, broadband, weighting) re-view stored results; no simulation toast or progress appeared [Inf from the session].

Room **geometry** stays outside snapshots. When it changes, Designer warns that it no longer matches a calculated snapshot [Doc: HC-124].

## 2. The snapshot browser

### 2.1 List view [Obs: D-14, D-21, D-36]

- **Default:** this is the left panel whenever nothing else is selected [Doc: HC-018].
- **Search box:** "Search…" at the top [Obs: D-14]. Its matching rules were not tested [Unk]. The docs do not mention it.
- **Rows:** each row has a **name** and a **timestamp** "YYYY-MM-DD HH:MM". Rows are sorted newest first, and the selected row is highlighted blue [Obs: D-21, D-36]. The docs don't mention dates.
- **Timestamps on duplicates:** duplicating a project **keeps the original creation timestamps** (2020-11-02 16:43) [Obs: D-21].
- **Description flyout:** hovering a row shows its description [Doc: HC-130]. Not captured.
- **Delete multiple** sits at the bottom of the panel.

### 2.2 Tree view [Obs: D-15, D-41, D-42]

- **Shape:**
  - A root square (the project or empty state) at the top [Inf].
  - Then document icons with truncated names ("PT-70 and …").
  - Edges show parent → child.
  - A **filled** icon means calculated; an **outlined** icon means a draft that is not calculated yet [Obs: D-42].
  - The selected node is blue.
- **Toolbar:** centre the whole tree; centre the current node; rename (pencil); delete (bin).
- **Numbering:** the documented dot-numbering ("1.2.1") was **not visible** in either view [Obs: D-15, D-21 vs Doc: HC-057]. Depth is shown only graphically.

### 2.3 Naming, rename, delete

- **Naming:**
  - The name is set **before** calculation, in Simulation settings → General → Name [Obs: D-33].
  - The field is prefilled with the selected snapshot's name.
  - Clone-on-edit auto-names drafts with **the next free trailing number**. "PS-852" was created as a child of "PS-850", because "PS-851" already existed [Obs: D-42].
  - This explains the example names: the numbers are a counter, not product models [Inf].
- **Rename:** the "Rename snapshot" dialog is prefilled with the current name; Cancel / Rename [Obs: D-22].
- **Delete one:** a confirmation that says it "**cannot be undone!**"; Cancel / Delete [Obs: D-23].
- **Delete multiple:** a checklist with "Select all" and "Invert selection" [Obs: D-24]. A "keep currently selected" default exists for delete-all [Doc: HC-126], but I didn't see it in this dialog [Unk].
- **Grouping or folders:** none beyond the tree [Obs; Doc silent].

### 2.4 Comparing

- **Switching only:** you click between nodes. There is **no side-by-side view, difference map or overlay** [Obs: D-16, D-40; Doc: HC-057].
- **Fixed label positions:** result labels stay at the same physical points when you switch, so their values can be compared by flipping, for example 121.20 → 121.65 dB at the same label [Obs: D-14 vs D-16]. This is the de facto comparison tool [Inf].
- **Peer tools:** no peer tool documents a difference map either (`peer_tools_snapshot_patterns.md`).

## 3. What a snapshot captures

| Element | Verdict | Evidence |
|---|---|---|
| Loudspeakers: set, type, gain, delay, EQ | **Captured** | [Doc: HC-057]; erasing a speaker in a child, then reselecting the parent, brought the speaker back [Obs: D-42 → D-44] |
| Loudspeaker positions and aim | **Captured** | Selecting the older snapshot moved a speaker [Obs: D-16]; [Doc: HC-057] gives position as the example edit |
| Listener planes | **Captured** (Observed). The docs contradict each other | Erased in the draft, back on the parent [Obs: D-43 → D-44]. The article says excluded [Doc: HC-057]; the course says included [Doc: HC-090] |
| Room acoustic parameters (RT per band, absorption) | **Captured** [Doc] | [Doc: HC-057, HC-090, HC-121]. Not changed live [Unk live] |
| Wall materials | **Unknown** | No source names them; not tested |
| Room geometry (mesh) | **Not captured** [Doc] | [Doc: HC-057, HC-090]; a mismatch warning since 1.7.0 [Doc: HC-124]. Not tested live (it would affect every snapshot) |
| Simulation settings (band type, background noise, early reflections, air damping, temperature/humidity/pressure, complex-summation limit, …) | **Captured** | [Doc: HC-057]; the settings panel shows the selected snapshot's name as the base [Obs: D-33] |
| Results: Direct SPL, Total SPL, STI per band | **Captured** | Switching mode or band showed no simulation toast or progress [Obs: D-17, D-18, D-20]. Values persist across later runs [Obs: D-40]. **STIPA:** in this snapshot every label read 1.000 on an uncoloured plane, so there is probably no STIPA result stored [Obs: D-19; Inf] |
| Name and creation timestamp | **Captured** | [Obs: D-21, D-33] |
| Description | Documented only | The Simulation settings have a Description section [Obs: D-33]; its display per snapshot is [Doc: HC-130], not seen live |
| Parent link (tree position) | **Captured** | [Obs: D-41] |
| IEC 60268-16 compliance flag | Shown per snapshot | Status-bar badge [Obs: D-14; Doc: HC-121] |
| Camera | **Not captured** (project-level presets 1–3) | [Doc: HC-036, HC-018]; the camera did not change when switching [Obs: D-16] |
| Display choices: result type, band or broadband range, weighting | **Not captured** as a whole; broadband cutoffs are restored per snapshot | The render mode and band (Direct SPL, 500 Hz) stayed when switching snapshots [Obs: D-20 → D-40, D-44]; [Doc: HC-126] for cutoffs |
| Colour-scale limits | Project or user option, not per snapshot | Options → Colour scale [Obs: D-51]; [Doc: HC-019] |
| Result labels (positions) | Project-level positions; values read from the selected snapshot | Same label spots with different values [Obs: D-14/D-16]; [Doc: HC-134] |

## 4. Reading results

### 4.1 Modes

- **Direct SPL:** the speaker sum without the room tail.
- **Total SPL:** direct plus the reverberant field.
- **STI** and **STIPA(IR)**.
- **Mode-dependent controls:**
  - Broadband applies to the SPL modes only [Obs: D-18; Doc: HC-058].
  - In STI mode the broadband and weighting controls disappear and the frequency is greyed [Obs: D-18].
- **Weighting:** none, A or C, for SPL [Obs: D-14].

### 4.2 Frequency

- **Broadband:** on by default in the example. It has lower and upper limits chosen from octave values (16 Hz–8 kHz and 32 Hz–16 kHz); the example used **250 Hz – 4000 Hz** [Obs: D-14].
- **Single band:** turning broadband off gives a band drop-down with −/+ steppers [Obs: D-20].
- **Band resolution:** octave or 1/3 octave, set **before** calculation [Obs: D-33].

### 4.3 Legend and colour

- **SPL:** a continuous rainbow from 60 dB (black-blue) to 120 dB (red), labelled every 5 dB, unit dB. The default limits are 60/120 and editable [Obs: D-14, D-51; Doc: HC-019].
- **STI:** 0–1 in 0.1 steps on a continuous multi-hue ramp, distinct from the SPL ramp. Labels have 3 decimals [Obs: D-18; Doc: HC-128].
- **Thresholds:** no pass/fail colour bands for targets such as STI ≥ 0.50 [Obs; Doc silent].

### 4.4 Overlay and labels

- **Heatmap:** painted on the listener-plane triangles in 3D. The evaluation points are triangle centres [Doc: HC-027].
- **Result labels:** white callouts with values [Obs: D-14].
- **Spectrum:** at a clicked point [Obs: D-45].
- **Statistics:** a histogram plus mean, σ, μ−σ, min, max and the point count [Obs: D-46].

### 4.5 Status bar

It always states **which snapshot, which mode and which band** are shown [Obs: D-14…D-20]. Example: "PT-70 and PS-850 / STI - 250 Hz - 4000 Hz".

## 5. Calculating

1. **Setup:** Simulation → Setup (Shift+F9) opens the settings in the left panel [Obs: D-33, D-34].
   - **General:** Name, frequency band.
   - **Description.**
   - **Background noise:** octave levels 125 Hz–8 kHz, used only when "Include in STI calculation" is on.
   - **Early reflections** (experimental flask icon): Order 1, Time lag 50 ms in this project. The documented default for new projects is 35 ms [Doc: HC-060].
   - **Advanced:**
     - Multi-Source as Single-Source;
     - Include travel times in STI (makes the result non-IEC);
     - Consider air damping (on);
     - Consider room collision;
     - atmosphere 20 °C / 60 % / 101.325 kPa;
     - Complex summation limit.
   - **Show results directly:** on.
2. **Simulate** (or F9). A toast says it is starting, a progress percentage shows, then "finished after 2s". The calculation is **server-side** [Obs: D-36; Doc: HC-121].
3. **The new snapshot:**
   - It appears at the top of the list with the current time and is auto-selected.
   - It becomes a **child of the snapshot that was selected** when you pressed Simulate [Obs: D-41].
   - The project **autosaves** [Obs: D-36, D-47].
4. **Failure and limit states** [Doc only; none met live]:
   - a warning above 20,000 points;
   - oversized jobs are rejected with a reason;
   - "reverberation not plausible" warns but still allows the run;
   - a leaky room gives a wrong volume, which makes STI wrong.

## 6. Trust: what must stay immutable

The live test showed:

- **After a later run**, the parent's labels were unchanged to 0.01 dB [Obs: D-40].
- **Deleting a speaker or a listener plane in a draft** did not change the parent [Obs: D-44].
- **One weak spot:** right after an edit that creates a draft, the scene shows the edited geometry with the parent's heatmap still painted on it. It gives no "results out of date" warning [Obs: D-42]. The only cues are the outlined tree icon and the new name in the status bar. A novice could read stale numbers [Inf].

So, for a trustworthy result, these must be frozen together:

1. the inputs (speakers, planes, room acoustics, settings);
2. the results, per band;
3. the **identity and version of the speaker data and the calculation engine** (not shown anywhere [Unk]);
4. the **room-geometry fingerprint**, since geometry lives outside the snapshot. Designer handles this with a mismatch warning [Doc: HC-124].

## 7. Export

- **No snapshot file export:** there is no export or import of a snapshot or of project data on the projects page or in the Snapshots panel [Obs: D-02, D-14, D-30]. So there is **no example file structure to document**.
- **Exports that exist** [Obs: D-31; Doc: HC-016, HC-042…046]:
  - PDF reports, each bound to one snapshot (the PDF link is valid for 1 day);
  - an image ZIP;
  - a screenshot;
  - a loudspeaker table and list;
  - Fohhn Audio Soft beams (FFC) and project.
- None was generated, because the guardrails rule out downloads.

## 8. How a novice reads a result (observed affordances, then gaps)

- **Helps:**
  - the status bar names snapshot, mode and band;
  - the legend has units;
  - labels give exact values;
  - the statistics panel turns a heatmap into a few numbers (mean, σ, min, max);
  - the IEC badge says whether STI is standard-compliant.
- **Missing for a learner** [Inf]:
  - no plain-language meaning of Direct vs Total SPL, or of STI bands, in the UI;
  - no target or threshold colouring ("STI ≥ 0.50 here?");
  - no "results are stale" warning (§6);
  - no side-by-side comparison;
  - no explanation of why a value changed between two snapshots.

## 9. Observed lifecycle (Fohhn, as seen)

```
[select calculated snapshot S]
      │ edit (speaker, plane, room acoustics, settings)
      ▼
[draft child D of S]  (auto-named N+1, outline icon, S's heatmap still shown)
      │ further edits accumulate in D
      │ Simulate (server, ~2 s here)
      ▼
[calculated D]  (timestamp, filled icon, auto-selected, autosave)
      │ select S again → S restored exactly (inputs + results)
      │ Simulate from S again → new sibling branch
      ▼
rename (dialog) · delete (confirm, irreversible) · delete multiple · report (bound to one snapshot)
geometry change → affects all snapshots → mismatch warning [Doc]
```

## 10. What the evidence could not settle

1. Whether wall materials and absorption tables are stored per snapshot.
2. What happens to an uncalculated draft when you switch away: is it kept?
   - In the test, the draft "PS-852" stayed in the tree after switching back to the parent [Obs: D-44], **so drafts persist**.
   - What happens when the project closes was not tested.
3. Whether results store every band or only the calculated range. Switching bands triggered no calculation, so they are probably stored [Inf].
4. The calculation engine version and the speaker-data version per snapshot: not shown [Unk].
5. How geometry replacement is shown on old snapshots in practice [Doc only].
