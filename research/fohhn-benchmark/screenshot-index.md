# Screenshot index: Fohhn browser audit, 2026-10-24

All captures were taken by tekinspi on 2026-10-24 (about 02:40–03:45 Europe/Paris) in a visible Chromium window (Playwright 1.x, profile in the session scratchpad), signed in by Oscar with a Fohhn Services account (the account's display name is a student's and is redacted). Desktop viewport is 1600 × 1000 unless the ID says `mobile`.

**Where the files are.** The PNGs are in `screenshots/` on this PC only. The Tekonest repo is public, and these images show third-party software (and the account display name), so `.gitignore` keeps them out of git. Treat them as internal research evidence. Do not publish or reuse them.

**Prefixes:**
- `V-` Speaker Viewer
- `O-` Optimizer
- `D-` Designer and dashboard
- `H-` Help Centre

Each row gives:
- **Action:** what I did just before the capture.
- **Observation:** what the capture shows, in my own words.
- **Used in:** the deliverable that relies on it.

`✓` means a person-level visual check of the PNG was done during the audit. `t` means the observation comes from the probe's text and DOM record for that capture, and the image was checked later in the cross-check pass (see the end of this file).

## Speaker Viewer (`/fsd-viewer/`)

| ID | Action | Observation | Check | Used in |
|---|---|---|---|---|
| V-00-landing | Open `/fsd-viewer/` signed out | Redirect to the "Sign in to Fohhn Services" login. Links to Imprint, Privacy, Terms. | t | interface-inventory §0 |
| V-01-terms | Click "Terms of use" (opened elsewhere) | Still the login page; the terms opened in another tab. | t | source-ledger |
| V-02-initial | Signed in, open viewer | Restored state: speaker list with one checked entry and the Directivity Index tab active. DI line chart, log frequency axis 100 Hz–10 kHz, DI 0–40 dB. | ✓ | inventory §1.1–1.2 |
| V-03-cabinet | Cabinet tab | 3D cabinet (three.js) on a grid floor with RGB axis lines; "Reset View" button. | ✓ | inventory §1.3 |
| V-04-balloon | Balloon tab | 3D balloon coloured on a 0 to −40 dB scale (red → black). "Select Frequency" drop-down at 1000 Hz with 21 third-octave values from 100 Hz to 10 kHz. | ✓ | inventory §1.3 |
| V-05-freqresp | Frequency Response tab | One curve, "Sensitivity [dB]" from −40 to +40 around 0 (normalised), 20 Hz–20 kHz. Badge "Smoothed 1/6 octave". | ✓ | inventory §1.3 |
| V-06-impedance | Impedance tab | Impedance [Ω] 0–100 against log frequency 20 Hz–20 kHz. Badge "Smoothed 1/6 octave". | t | inventory §1.3 |
| V-07-isobars | Isobars tab | Angle (−180…180°) against log frequency (100 Hz–10 kHz) contour plot. Five 3-dB bands (0/−3/−6/−9/−12 dB). The −6 dB edge is drawn as a heavy black line. Horizontal/Vertical toggles. Badge "1/3 octave interpolated". | ✓ | inventory §1.3 |
| V-08-polar | Polar tab | Polar plot with rings from +10 to −35 dB. Horizontal (red) and vertical (black) traces at 1000 Hz. Badge "Cardinal spline interpolated". | ✓ | inventory §1.3 |
| V-09-addspeaker | "Add speaker" | Modal: "Show discontinued loudspeakers" toggle switch, a picker reading "No speaker selected.", Cancel/Add. | t | inventory §1.4 |
| V-10-picker-open | Open the picker | Catalogue grouped by product family. Dispersion variants are separate entries (e.g. "AT-10 40x60 / 60x40 / 60x90 / 90x60"); presets are separate entries; "New" badges. | t | inventory §1.4 |
| V-11-two-speakers-polar | Add a second speaker (a cardioid PT-70 variant) | It is added **unchecked**; the chart is unchanged. Each list card shows family + model + variant and a product thumbnail. | ✓ | inventory §1.4 |
| V-12-both-checked-polar | Check the second speaker | The view becomes **small multiples**: two polar panels side by side, each with a header in that speaker's colour (blue, green). The list card borders use the same colours. | ✓ | inventory §1.4, crosswalk |
| V-13-cmp-cabinet | Cabinet, 2 checked | Two 3D canvases side by side. | t | inventory §1.4 |
| V-14-cmp-balloon | Balloon, 2 checked | Two balloons, each with its own colour legend; one shared frequency selector. | ✓ | inventory §1.4 |
| V-15-cmp-freqresp | Frequency Response, 2 checked | **One overlaid** chart with two coloured curves, plus a small legend icon row ("●" + document icon). | ✓ | inventory §1.4 |
| V-16-cmp-impedance | Impedance, 2 checked | Overlaid curves in one chart. | t | inventory §1.4 |
| V-17-cmp-isobars | Isobars, 2 checked | Two isobar panels side by side, each with its own legend. | t | inventory §1.4 |
| V-18-cmp-di | DI, 2 checked | Overlaid curves in one chart. | t | inventory §1.4 |
| V-19-cmp-balloon-rotated | Left-drag on the balloon | Orbit rotation of the 3D view. | t | inventory §1.5 |
| V-20-cmp-balloon-zoom | Wheel on the balloon | **No zoom visible.** The frequency select stepped from 1000 to 1250 Hz instead, so wheel-zoom is not demonstrated (cross-check). | ✓ (reviewer) | inventory §1.5 |
| V-21-balloon-250Hz | Frequency → 250 Hz | Both balloons redraw for 250 Hz. The camera differs from V-20; it is kept from V-21 to V-22. | ✓ (reviewer) | inventory §1.5 |
| V-22-balloon-4000Hz | Frequency → 4000 Hz | Balloons narrow and turn green/yellow off-axis; the rotated camera is kept. | ✓ | inventory §1.5 |
| V-23-isobars-vertical | Isobars → Vertical | The vertical-plane isobar is shown. | t | inventory §1.3 |
| V-24-fr-hover | Hover a curve | The hovered curve thickens; a tooltip shows speaker name, frequency (2 decimals, Hz) and level (dB, 2 decimals). | ✓ | inventory §1.5 |
| V-25-fr-legend-icons | Hover the legend dot | A tooltip names the speaker ("PT-70"); the icon elements have no title attribute. | t | technical §2 |
| V-26-fr-doc-hover | Hover the document icon | Tooltip "Measured with preset" (a data-provenance badge for the second speaker). | ✓ | inventory §1.5, crosswalk |
| V-27-lang-de | Language → de | Full German UI ("Lautsprecher", "Gehäuse", "Ballon", "Frequenzgang", "Bündelungsmaß"…). Reverted to `en` afterwards. | t | inventory §1.6 |
| V-28-mobile-390 | Viewport 390 × 844 | Responsive layout: tabs become a select ("Frequency Response"), the chart fills the width, and a bottom bar reads "Multiple speakers selected" with a ⋮ menu. | ✓ | inventory §1.6 |
| V-29-mobile-polar | Scroll down at 390 px | Same as V-28 (single-screen layout). | t | inventory §1.6 |
| V-30-empty-none-checked | Uncheck both speakers | Empty state: "No speaker selected." centred. | ✓ | inventory §1.2 |
| V-31-remove-confirm | Re-check the first speaker; click the bin on the second | The speaker is removed **immediately, with no confirmation**. | t | inventory §1.4 |
| V-32-reload-restored | Reload | Selection and active tab are restored. The server-side settings requests (`me/settings/…`) are recorded in the V-02 network record. | t | inventory §1.2, technical §2 |

## Optimizer (`/fohhn-optimizer/`)

| ID | Action | Observation | Check | Used in |
|---|---|---|---|---|
| O-00-optimizer-initial | Open the Optimizer | "Select a microphone" split view: left "Use a microphone from an external device" (blank 600 × 300 canvas, the expected QR area), right "Use a local microphone" with a greyed **Start Measuring** button. Help (?) and settings icons top right. | ✓ | inventory §2 |
| O-01-qr-wait | Wait 4 s | The QR canvas stays blank in this automated window. | t | inventory §2 (unavailable states) |
| O-02-help | Click ? | The Help Centre opens in a **new tab** (Optimizer category). | ✓ | inventory §2 |
| O-03-settings | Click the gear | Settings drawer: Application / Measurement / EQ groups (values in inventory §2.3). Version 1.7.0; "Reset settings". | t | inventory §2.3 |
| O-04-settings-closed | Close the drawer; grant mic permission | No change in the start view. | t | inventory §2 |
| O-05-measuring | Try "Start Measuring" | Greyed and not clickable (click timeout), after microphone permission was granted (O-04). The `is-disabled` class and an available audio input were seen in a one-off DOM query that wasn't kept as a file. **No measurement was possible.** | t | inventory §2, open questions |

## Designer: dashboard (`/designer/projects`)

| ID | Action | Observation | Check | Used in |
|---|---|---|---|---|
| D-00-terms | Open Terms of use | Terms of use dated 2021-09-29 (text read, not stored in git). | t | source-ledger, README guardrails |
| D-01-welcome | Open `/dashboard/auth/welcome` | "Get your free Fohhn Services Account": an email field plus privacy consent. | t | source-ledger |
| D-02-projects | Open the projects page | Header: Projects, Documentation, account name (redacted in our docs). "You have access to 3 projects"; New project; search with a filter chevron; three example cards with thumbnail, "Last modified", Details, and five icon actions (edit, delete, duplicate, archive, share). Support chat bubble. | ✓ | inventory §3.1 |
| D-03-details | Expand Details on a card | Owner, Created (2020-05-29), Authors ("2 authors"). | t | inventory §3.1 |
| D-04-search-filter | Open the filter chevron | Filter by owner (All / Own / Shared with me), "Archived projects: Show", sorting (Last edited / Project name / Created) and Ascending/Descending. | t | inventory §3.1 |
| D-05-duplicate-dialog | Duplicate "Example - Hall" | Dialog with Name* prefilled "… - Copy", Description, Cancel/Duplicate. | t | inventory §3.1 |
| D-06-duplicated | Confirm with name "Audit copy - Hall (tekinspi, delete me)" | URL `?sm=duplicated`; a "successfully duplicated" toast and a loading spinner; "4 projects". | t | inventory §3.1 |
| D-07-list-after-dup | Wait | The new card is first (sorted by last edited) and shows its description. | t | inventory §3.1 |
| D-08-delete-dialog | Delete icon (audit copy) → cancel | "Are you sure you want to delete the project …?" Cancel / Yes. | t | inventory §3.1 |
| D-09-archive-dialog | Archive icon → cancel | Explains that archived projects leave the page and can be shown again with the filter. Cancel / Ok. | t | inventory §3.1 |
| D-10-share-dialog | Share icon → cancel | Persons ("No persons set", Add), Comment, Cancel/Share. | t | inventory §3.1 |
| D-11-edit-dialog | Edit icon → cancel | Name*, Description, Cancel/Save. | t | inventory §3.1 |
| D-12-newproject-dialog | New project → Esc | Name*, Description, Cancel/Add. | t | inventory §3.1 |

## Designer: editor (`/designer/editor/<projectId>`, audit copy only)

| ID | Action | Observation | Check | Used in |
|---|---|---|---|---|
| D-13-project-open | Open the audit copy | Loading: a dark overlay with a spinner for over 10 s. | t | inventory §3.2 (loading state) |
| D-14-editor-loaded | Wait | Top menu (Project, Room, Listener plane, Loudspeaker, Simulation, Snapshots, Export, View) plus ?, bell, gear, profile. **Left panel = Snapshots** (List/Tree, search, 2 entries with timestamps, Delete multiple). Frequency 250 Hz–4000 Hz with −/+. Render (Direct SPL / Total SPL / STI / STIPA(IR)), Broadband toggle, Lower/Upper frequency, weighting. 3D view with a view cube, an SPL heatmap on the listener plane, 4 result labels in dB and a legend from 60 to 120 dB. Right tool rail. Status bar: cursor XYZ, "snapshot / Direct SPL - 250 Hz - 4000 Hz", green IEC badge. | ✓ | snapshots §2, inventory §3.2 |
| D-15-snap-tree | Tree view | Root node (black square) → "PT-70 and …" → child "PT-70 and …" (selected, blue). Toolbar: centre-tree, centre-current, rename (pencil), delete (bin). | ✓ | snapshots §2.2 |
| D-16-snap-select-850 | Click the parent snapshot | **The scene changes**: a speaker moves to another position and the label values change (e.g. 121.20 → 121.65 dB). The status bar names the selected snapshot. | ✓ | snapshots §3 |
| D-17-total-spl | Render → Total SPL | Status "Total SPL - 250 Hz - 4000 Hz"; same 60–120 dB legend. | t | snapshots §4 |
| D-18-sti | Render → STI | Legend 0…1 in 0.1 steps with a categorical palette. Labels show 3-decimal STI values (0.636, 0.642, 0.607, 0.592). The broadband and weighting controls disappear, and frequency is greyed. | ✓ | snapshots §4 |
| D-19-stipa | Render → STIPA(IR) | Status "STIPA - 250 Hz - 4000 Hz"; 0–1 legend. **All labels read 1.000 on an uncoloured plane**, so there is probably no STIPA result stored for this snapshot [Inf]. | t | snapshots §4 |
| D-20-directspl-1khz-band | Direct SPL; Broadband off | Single-band mode: the frequency becomes a drop-down (500 Hz) with −/+ steppers; status "Direct SPL - 500 Hz". **No recalculation** (instant). | ✓ | snapshots §4 |
| D-21-list-dates | List view | Each entry shows "YYYY-MM-DD HH:MM". After duplication, the original creation times are kept (2020-11-02 16:43 and 2026-10-22 17:03). | t | snapshots §2.1 |
| D-22-snap-rename | Pencil | "Rename snapshot – Enter a new name for the snapshot:" prefilled. Cancel/Rename (cancelled). | t | snapshots §2.3 |
| D-23-snap-delete-dialog | Bin | "Do you really want to delete the selected snapshot? This action cannot be undone!" Cancel/Delete (cancelled). | t | snapshots §2.3 |
| D-24-delete-multiple | Delete multiple | Checklist of snapshots, "Select all", "Invert selection", Cancel/Delete (cancelled). | t | snapshots §2.3 |
| D-25-menu-simulation | Simulation menu | Start (F9), Stop, Setup… (Shift+F9). | t | inventory §3.3 |
| D-26-menu-project | Project menu | Undo (Ctrl+Z), Redo (Ctrl+Y), Edit project details, New, Open, Save (Ctrl+S), Save as (Ctrl+Shift+S). Shortcut labels read "Crtl" (typo in the UI). | t | inventory §3.3 |
| D-27-menu-room | Room menu | Select all walls, Global room properties, Create (Ctrl+Alt+R), Import…, Invert room surfaces, Manage materials, List… | t | inventory §3.3 |
| D-28-menu-listenerplane | Listener plane menu | Select all listener planes, Draw, Create by offset, Import…, List… | t | inventory §3.3 |
| D-29-menu-loudspeaker | Loudspeaker menu | Select all, Add (Ctrl+Alt+L), Duplicate, Mirror…, Aim at point, Align…, Copy/Paste beams, Copy/Paste EQ, Import EASE speaker setup…, List… | t | inventory §3.3 |
| D-30-menu-snapshots | Snapshots menu | Show (Ctrl+Alt+M), Result Labels. | t | inventory §3.3 |
| D-31-menu-export | Export menu | Report configurator, Loudspeaker table, Loudspeaker list, Screenshot, Fohhn Audio Soft. | t | inventory §3.3 |
| D-32-menu-view | View menu | Camera, Wireframe, Show all hidden objects, Show scale figure, Gizmo Orientation, Change origin. | t | inventory §3.3 |
| D-33-sim-setup | Shift+F9 | Left panel "Simulation settings": General (Name prefilled with the **selected** snapshot's name; Frequency band "Octave"), Description, Background noise, Early reflections (flask icon), Advanced options, "Show results directly" (on), Simulate. | ✓ | snapshots §5 |
| D-34-sim-setup-expanded | Expand the sections (General and Description ended up collapsed) | Background noise: 7 octave fields (125 Hz–8 kHz, 0.00 dB, disabled until "Include in STI calculation"). Early reflections: Order 1, Time Lag 50.00 ms (disabled until enabled). Advanced: Multi-Source as Single-Source (off), Include travel times in STI (off), Consider air damping (**on**), Consider room collision (off), 20.00 °C, 60.00 %, 101.3250 kPa, Restore Atmospheric Defaults, Complex summation limit (None, 16 Hz … 16 kHz). | t | snapshots §5, technical §4 |
| D-35-sim-before-run | Name "Audit run A (no air damping)"; untick air damping | Settings set before the run. (The "*" unsaved marker was already in the title from D-16, and it clears at D-37 after the autosave.) | t | snapshots §5 |
| D-36-sim-running-1s | Simulate | Toasts "Starting simulation…", progress "4.7%", then "Simulation of … finished after 2s." The new snapshot sits on top of the list with the current timestamp and is auto-selected. A "Save project" toast with a progress bar (autosave after simulation). | ✓ | snapshots §5 |
| D-37…39-sim-running-t2…t4 | Wait 5 s each | The result is stable; 3 snapshots in the list. Status shows the new snapshot. | ✓/t | snapshots §5 |
| D-40-reselect-850-after-run | Reselect the original parent | Its label values are **unchanged** (120.85 / 120.49 / 117.94 / 116.32 dB at 500 Hz): an immutable result. | t | snapshots §3 |
| D-41-tree-after-run | Tree | The new run is a **sibling branch** of the previous child under the selected parent (the parent has 2 children). | ✓ | snapshots §3 |
| D-42-erase-speaker | Eraser tool; click a speaker while the parent is displayed | Toast "Create new snapshot 'PT-70 and PS-852'". A new **unsimulated** child (outline icon) is auto-named by incrementing the trailing number. The speaker is gone, but the **old heatmap and labels stay displayed** with no stale warning. | ✓ | snapshots §3, crosswalk (invalidation) |
| D-43-erase-listenerplane | Eraser on the listener plane (still in the draft) | The plane, heatmap and labels disappear from the draft. | ✓ | snapshots §3 |
| D-44-select-850-after-plane-erase | Select the parent | **The plane and the speaker are both back** with the original results, so listener planes are captured per snapshot. | ✓ | snapshots §3 |
| D-45-spectrum-tool | Spectrum tool; click a point | Bottom panel "Spectrum": SPL 60–120 dB against 20 Hz–20 kHz with a Direct SPL / Total SPL legend. Empty (the click landed under the panel). | ✓ | inventory §3.4 |
| D-46-statistics-tool | Statistics tool | "Histogram for all listener planes" (relative distribution against dB) plus descriptive values: mean 117.70 dB, σ 2.41 dB, μ−σ 115.29 dB, max 121.72, min 111.73, 636 points. | ✓ | inventory §3.4 |
| D-47-history-bell | Bell | History log with timestamps: project loaded, snapshot created, simulation start/finish (2 s), save successful, "Trigger auto save…". Filter field. | t | inventory §3.4 |
| D-48-options-gear | Gear (first click) | Gear highlighted, no panel (toggled closed). | ✓ | — |
| D-49-options-panel | Gear | Options groups: Application, Camera, Colour scale, Listener plane, Loudspeakers, Project, Room, Scene, Simulation, Statistics. | t | inventory §3.5 |
| D-50-colour-legend-click | Click on the legend | Options panel still open (no legend editor reached this way). | t | — |
| D-51-options-colourscale | Options → Colour scale | Direct SPL min 60 / max 120 dB (allowed −60…140 / −40…160). | t | inventory §3.5 |
| D-52, D-53 | Options → Simulation / Camera | **Click failed** (label clash with the top menu). Not inspected. | — | not-inspected list |
| D-54-options-scene | Options → Scene | Show grid (on), grid size 50 m, gap 1 m, auto-adjust (on), axis (on). | t | inventory §3.5 |
| D-55-options-application | Options → Application | Language en/de, Confirm on close (on), font 16 px, result-label size "normal", axis highlight (off). | t | inventory §3.5 |
| D-56-options-statistics | Options → Statistics | STI and SPL histogram ranges and resolution (STI 0.20, SPL 5 dB), max distribution 70 %, AutoScale off. | t | inventory §3.5 |
| D-57-loudspeaker-list | Loudspeaker → List… | The visible panel reads "No loudspeaker selected". Its template fields come from the DOM record (Open Product Website, Change; Name, Gain, Mute, Delay + distance, Position XYZ, Rotation XYZ, Acoustic centre, Filter, EQ chart ±12 dB, Meta data). List "5 Loudspeakers" with columns #, Name, Type, Group, Gain, Mute, Delay, Position X/Y/Z. | ✓ | inventory §3.3, data model |
| D-58-export-report-configurator / D-58-report-configurator | Export → Report configurator (the first capture shows only the open Export menu, because the click timed out; the second shows the configurator) | "Simulation report configurator": New report; an existing "Example - Report" (EN, last modified at duplication time), so duplication copied the report. | t | inventory §3.6 |
| D-59-room-global-props | Room → Global room properties | Volume 1802.2 m³, surface 1106.5 m², model status ✓ with "Show Errors", position XYZ with "move loudspeakers/listener planes accordingly". RT chart (about 0.9–1.1 s across 100 Hz–10 kHz) with a Reverberation time / Absorption toggle. | ✓ | inventory §3.3, data model |
| D-60-editor-mobile-390 | Viewport 390 × 844 | The editor is not adapted for phones: menus stack, panels overlap the 3D view, and the legend covers the scene. | ✓ | inventory §3.7 |

## Help Centre (`/hc/`)

| ID | Action | Observation | Check | Used in |
|---|---|---|---|---|
| H-00-helpcentre | Opened by Optimizer "?" | Optimizer category: Courses, FAQs, Articles (General; UI: Optimization and EQ export, Select a microphone, Settings, **Take Snapshots**). | t | source-ledger |
| H-01-hc-root | `/hc/` | Four categories: Fohhn Designer, Dashboard, Fohhn Speaker Viewer, Fohhn Optimizer. | t | source-ledger |

## Not captured, or blocked

- **Oscar's 9 screenshots:** not received in the conversation, so not used. The same views (Arc AT-05 on six tabs; the Snapshots panel with List/Tree, "PT-70 and PS-850", 250 Hz–4 kHz, the four render modes, broadband and the SPL legend) were re-captured live as V-02…V-08 and D-14…D-20.
- **No captures** of: a running Optimizer measurement, the QR hand-off on a phone, an EQ proposal, Optimizer snapshots; PDF generation; the screenshot export; the Fohhn Audio Soft export; drawing listener planes; the room wizard; materials; early reflections; auralisation; Conference Room / Theatre examples (opened only as cards). See `interface-inventory.md` §4.

## Cross-check log

See the "Screenshot cross-check" section at the end of `interface-inventory.md` for the pass that compared every PNG with this index.
