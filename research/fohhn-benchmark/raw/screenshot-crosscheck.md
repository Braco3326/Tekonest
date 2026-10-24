# Screenshot cross-check (independent review)

- **Reviewer:** tekreviwer, 2026-10-24. Every PNG in `screenshots/` was opened and compared with its row in `screenshot-index.md`, then with `raw/probes/<ID>.json`.
- **Scope:** 103 PNGs (V 33, O 6, H 2, D 62, with two D-58 files). 103 probe files plus one stray `raw/probes/probe.json`. No deliverable was edited.

## Summary

| Result | Count |
|---|---|
| Match | 89 |
| Minor mismatch | 11 |
| Mismatch | 3 |
| Missing row / missing file | 0 (see notes) |

**Mismatches:** V-20 (no zoom visible; the frequency changed instead), D-13 (a spinner is visible, not a blank page), D-35 (the "*" was already in the title from D-16 on).

**Doc claims:** 5 weak or unsupported claims in `designer-snapshots.md` and 10 in `interface-inventory.md` (tables below). Every priority claim (D-14/D-16, D-18 labels, D-40, D-41, D-42, D-43/D-44, D-46, V-07, V-12/V-15, V-26, V-28, O-00) is supported. The exceptions are the O-05 `is-disabled` detail and the V-20 zoom claim.

**Privacy:** the account display name is visible in D-02 to D-12. The full name appears in D-03 and D-04 (Details → Owner). No `.md` file under `fohhn/` contains it. This file deliberately does not repeat it.

## Notes on rows and files

- Combined rows are fine: "D-37…39" covers 3 files, "D-52, D-53" covers 2 files and "D-58-… / D-58-…" covers 2 files. Each file has a row.
- `raw/probes/probe.json` (id "-", Global room properties state, viewport reset) has no PNG and no row. It is a stray probe and not a capture.
- Filenames that do not match their content: `V-29-mobile-polar` shows Frequency Response, and `D-20-directspl-1khz-band` shows 500 Hz. The rows describe the content correctly.
- `interface-inventory.md` ends with a "Screenshot cross-check" section that is only a placeholder, but the index (last section) points to it.

## Per-capture results

### Speaker Viewer

| ID | Result | Note / correction |
|---|---|---|
| V-00 | match | Login page also shows Sign up / Forgot password. Probe URL `/dashboard/auth/login?redirectTo=%2Ffsd-viewer%2F`. |
| V-01 | match | |
| V-02 | match | |
| V-03 | match | Probe: canvas `three.js r149`. |
| V-04 | match | 21 values from 100 Hz to 10 kHz confirmed in the probe. |
| V-05 | match | |
| V-06 | match | |
| V-07 | match | Legend 0/−3/−6/−9/−12. The 5th (black) band is open-ended (below −12 dB). The heavy black contour sits on the yellow/green (−6 dB) edge. |
| V-08 | match | |
| V-09 | **minor** | "Show discontinued loudspeakers" is a **toggle switch**, not a checkbox. |
| V-10 | match | Image shows Airea/Arc only. Variants, presets and "New" badges are confirmed by the probe text. |
| V-11 | match | |
| V-12 | match | |
| V-13 | match | |
| V-14 | match | |
| V-15 | match | |
| V-16 | match | |
| V-17 | match | |
| V-18 | match | |
| V-19 | match | Both panels rotate together (synced camera). |
| V-20 | **mismatch** | No zoom is visible (the balloon size matches V-19). **The frequency selector changed from 1000 to 1250 Hz**, and the balloons were redrawn for 1250 Hz. The wheel probably stepped the select. "Zoom in" is not supported. |
| V-21 | **minor** | The camera is **not** the V-20 camera (it is a different, tilted view). "The camera is kept" holds only from V-21 to V-22. |
| V-22 | match | Same camera as V-21. |
| V-23 | match | |
| V-24 | match | |
| V-25 | **minor** | Hovering the dot shows a dark tooltip **"PT-70"** (custom tooltip, not a `title` attribute). The row should say so. |
| V-26 | match | "Measured with preset" tooltip. A single legend row (green, PT-70). |
| V-27 | match | |
| V-28 | match | Select "Frequency Response", full-width overlaid chart, bottom bar "Multiple speakers selected ⋮". |
| V-29 | match | Identical to V-28 (the filename says polar). |
| V-30 | match | |
| V-31 | match | No dialog. The second speaker is gone. |
| V-32 | **minor** | The image supports the restored state. The "me/settings/…" requests are **not recorded** in the probe or anywhere in `raw/`. |

### Optimizer and Help Centre

| ID | Result | Note / correction |
|---|---|---|
| O-00 | match | Greyed "Start Measuring". The blank canvas is invisible (white). |
| O-01 | match | |
| O-02 | match | The original tab is unchanged; the Help Centre content is in H-00. |
| O-03 | match | Version 1.7.0 is in the probe text. A 4th drawer section (app info/version) is cut off at the bottom of the image. |
| O-04 | match | The probe confirms `grant: microphone`. |
| O-05 | **minor** | The image and the probe support "not clickable" (click timeout of 8 s). The **`is-disabled` class and "an audio input exists" are not recorded** in the probe. |
| H-00 | match | Articles list confirmed by the probe (below the fold in the image). |
| H-01 | match | |

### Designer dashboard and editor

| ID | Result | Note / correction |
|---|---|---|
| D-00 | match | Date 2021-09-29 legible at the bottom. |
| D-01 | match | Consent is a toggle. |
| D-02 | match | Shows the display name in the header. |
| D-03 | match | Shows the full owner name. |
| D-04 | match | Options confirmed in the probe; Descending is checked. Full owner name visible. |
| D-05 | match | |
| D-06 | **minor** | Add: a success toast "The project has been successfully duplicated!" and a loading spinner. The URL `?sm=duplicated` is in the probe only. |
| D-07 | match | |
| D-08 – D-12 | match | (5 files) |
| D-13 | **mismatch** | Not a blank page: a **dark overlay with a circular loading spinner** over the editor skeleton. |
| D-14 | match | Labels 121.20 / 120.61 / 118.03 / 116.36 dB. Selected = PS-851. |
| D-15 | match | |
| D-16 | match | The left wall speaker moved (about x 492 → 560 px). Labels 121.20→121.65, 120.61→120.94, 118.03→118.21, 116.36→116.47. Status "PT-70 and PS-850". |
| D-17 | match | Labels 125.83–126.85 dB exceed the 120 dB legend top, so the plane is saturated red. |
| D-18 | match | 0.636 / 0.642 / 0.607 / 0.592. The legend looks like a continuous hue ramp, and its 0.9–1 segment is blank. |
| D-19 | **minor** | Add: **all four labels read 1.000 and the plane is uncoloured (white)**, which suggests that no valid STIPA(IR) result exists. The row omits this. |
| D-20 | match | 500 Hz (the filename says 1 kHz). |
| D-21 – D-32 | match | (12 files) D-26 "Crtl" typo confirmed. |
| D-33 | match | The probe confirms Shift+F9. The Simulation menu also happens to be open in the image. |
| D-34 | **minor** | General and Description are **collapsed**, so this is not "every section". Pressure, Restore defaults and the summation list are below the fold (visible in D-35 and the probe). |
| D-35 | **mismatch** | No "*" is visible in the capture. The probe titles show the "*" **already present from D-16** (right after selecting a snapshot), so the D-35 edit did not add it. |
| D-36 | match | "4.7%" appears in the probe text only. The toasts and the new top row (03:37, selected) are visible. |
| D-37 | **minor** | The list has **3 entries** (2 originals + the new run), not "3 + 1". Also of interest: the title lost its "*" after the autosave (probe). |
| D-38, D-39 | match | |
| D-40 | match | 120.85 / 120.49 / 117.94 / 116.32 dB, identical to D-20. |
| D-41 | match | Parent PS-850 has 2 children (PS-851, Audit run). |
| D-42 | match | Toast, outline child PS-852, speaker gone, old heatmap and labels still shown, no warning. |
| D-43 | match | |
| D-44 | match | |
| D-45 | match | |
| D-46 | match | 117.70 / 2.41 / 115.29 / 121.72 / 111.73 / 636. |
| D-47 – D-56 | match | (10 files; D-52 and D-53 still show Colour scale because the click failed) |
| D-57 | **minor** | The visible left panel reads **"No loudspeaker selected"**. The property fields exist only in the DOM text. Position Y/Z columns are off-screen (probe). |
| D-58-export-report-configurator | **minor** | Shows only the open Export menu. The probe shows that the click on "Report configurator" timed out. |
| D-58-report-configurator | match | Last modified 2026-10-24 03:26 = duplication time. |
| D-59 | match | |
| D-60 | match | |

## Doc claims checked against cited captures

### designer-snapshots.md

| Line | Claim | Problem |
|---|---|---|
| 87 | "The render mode stayed when switching [Obs: D-17 → D-18]" | **Wrong ID.** D-17 → D-18 is a render-mode change on the same snapshot. Use D-40 / D-44 (Direct SPL 500 Hz kept after reselecting). |
| 82 | Results incl. STIPA "Captured"; mode/band switch "instant" [D-17…D-20] | D-19 shows 1.000 everywhere on an uncoloured plane, so it is not evidence of a stored STIPA result. "Instant" is not visible in the captures (the probes waited 4 s). |
| 58 | Auto-naming "PS-850 → PS-851 → PS-852" [D-42] | PS-852 is a child of **PS-850** (a sibling of PS-851). The evidence supports "next free number", not a parent→child increment chain. |
| 83 | Description captured [D-21, D-33] | Neither capture shows a snapshot description (D-33: the Description section is collapsed). |
| 112 | STI "categorical palette (grey, purple, red, yellow, green, blue…)" [D-18] | The legend reads as a hue ramp: grey → magenta/red → yellow → green → cyan → blue → violet, with 0.9–1 blank. "Categorical" and the colour order are not clearly supported. |

The priority checks are all supported: D-14 vs D-16 (§2.4, §3), D-40 (§6), D-41 (§5), D-42 (§6), D-43/D-44 (§3), D-18 3-decimal labels, D-46 values.

### interface-inventory.md

| Line | Claim | Problem |
|---|---|---|
| 213 | Loading "a blank page… no spinner captured [D-13]" | **Contradicted:** D-13 shows a spinner. |
| 212 | "*" marks unsaved changes [Obs: D-35] | **Wrong ID.** The "*" appears at D-16 (probe title) and disappears at D-37 after the autosave. D-35 does not show a title bar. |
| 67 | "the wheel zooms [Obs: V-20]" | **Unsupported:** V-20 shows a frequency change (1250 Hz), not a zoom. |
| 67 | "camera is kept when the frequency changes [Obs: V-22]" | Holds only from V-21 to V-22. The camera differs between V-20 and V-21. |
| 98 | `is-disabled`, permission granted, audio input existed [Obs: O-05] | Only "greyed + click timeout" is recorded (the permission grant is in the O-04 probe). The class and the audio input are not recorded. |
| 100 | Hidden "Goto EQ Results" button [Obs: O-05 DOM record] | Not present in the O-05 probe or anywhere in `raw/`. |
| 35 | `me/settings/...` requests [Obs: V-02, V-32] | No network record in the probes or `raw/`. |
| 120 | Optimizer Language en/de, English [Obs: O-03] | The Application group is collapsed in O-03. Not in the image or the probe text. |
| 185, 226 | Loudspeaker property fields [Obs: D-57] | Visible panel: "No loudspeaker selected". The fields are only in the DOM text. Cite as "DOM record". |
| 59 | "Show discontinued loudspeakers" checkbox [V-09] | It is a toggle switch. |
| 191 | Tool-rail tooltips [Obs: hover pass] | No capture ID, so this cannot be verified. |
| 295 | "Screenshot cross-check" section | Empty placeholder, although the index refers to it. |

The priority checks are supported: V-07 (bands, heavy −6 dB line), V-12 (small multiples) and V-15 (overlay), V-26 ("Measured with preset"), V-28 (phone layout), O-00 (greyed button).

## Privacy check

- **Images that show the account display name:** D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12 (header, truncated). The full first and last name appears in D-03 and D-04 (Owner). The Designer editor captures show only a profile icon.
- **Probe JSON with the full name:** D-02 to D-12 (`raw/probes/` is gitignored).
- **Markdown search:** all 105 `.md` files under `fohhn/` were searched case-insensitively for the first name, the surname and variants. **No hit.** Three regex hits on "student e…" were false positives ("student edit", "student edits").
- **Note:** `.gitignore` covers `screenshots/*`, `raw/probes/` and `raw/terms-of-use.txt` only. This file (`raw/screenshot-crosscheck.md`) is **not** ignored, so it names no one.
