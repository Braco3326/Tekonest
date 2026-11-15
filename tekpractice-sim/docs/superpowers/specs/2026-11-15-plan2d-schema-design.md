# Mission 2: the 2D schema page (floor plan to scale, technical symbols, rear panels, patching)

Status: design from the founder's brief of 2026-11-15 (relayed by the Tekonest Master, « MISSION 2 »). The founder is away: the choices below are the brief's own words plus the smallest sensible defaults; each open choice is listed in §9 for him. Branch `deploy/mode-creation-only-20261115`. Owner: TekoPractice Build-Up.
Sources of truth: `E:\CLAUDE BU\reports\2D schema - colour and symbol sheet.md` (symbols, connectors, colours, line styles: proposals tagged STANDARD / TRADE PRACTICE / OUR PROPOSAL, the founder may correct them) and the equipment catalogue (`content/` devices: the real ports, connectors, directions; never invent a port or a number: one sheet per device number, unknown = nothing shown).

## 1. What the learner does

1. In the project (Mode Création) a button **« Schéma 2D »** (menu *Affichage* and a button in the toolbar/status area) opens an **independent 2D page** over the 3D view. It is blank at first. It is a **floor plan of the current room, to scale, in metres**: the room outline, a metre grid, a scale bar, orientation labels (public at the bottom, jardin left, cour right, per the sheet), the room's name.
2. **Place equipment as technical symbols.** A palette (the same device families as the inventory drawer, the same names, search) lists devices; a click or drag puts a symbol on the plan, at a grid snap (25 cm default, 10 cm / 50 cm / 1 m switchable), each symbol drawn at its real footprint (width x depth in metres from the catalogue; unknown footprint = a labelled default box, said). Move (drag, arrows), rotate (R, 90 deg steps and free), delete, duplicate, undo/redo, multi-select. Everything is keyboard-operable.
3. **Flip to the rear panel while holding a cable.** Tapping a device **flips it** (a short flip animation, reduced-motion = a cut) and **zooms** to its **rear panel**, drawn with the **real ports** of the catalogue (position order, connector shape, label, direction) while the learner **holds a cable**: ports that can accept the cable's other end light up, the ones that cannot are dimmed with the reason in a tooltip/live text (the existing connection rules decide: `src/creation/connectModel.ts` and the catalogue compatibility, never a second rule set). Clicking a lit port ends the cable there; Échap drops the cable. Then the view **returns to the general view**.
4. **The general view shows the patching**: each cable is a line between the two devices' port anchors, in the colour and line style of its cable type per the sheet (analogue blue solid, speaker vermilion thick solid, digital purple dashed, network green dotted, clock/control grey, mains brown with a lightning glyph), with an arrow, a short type tag and a legend (colour is never the only cue). Selecting a cable lists what it joins; Suppr removes it.
5. **It works on its own.** The 2D page has its own plan data and never changes the 3D scene by itself. The page can be used with an empty 3D room.
6. **Optional: « Envoyer dans la scène 3D ».** When the learner presses it, everything in the 2D plan is **created in the 3D space at the same positions** (metres, precise spacing, same rotation), and its patching becomes the 3D connections, as **one undoable step**. It never silently replaces existing 3D gear: a dialog says how many devices/cables will be added and asks (same pattern as the existing « Remplacer le matériel » dialog); a device that does not fit (outside the room, on top of another) is reported, not hidden.
7. Leaving the page (« Fermer », Échap on the page) returns to the 3D view; the plan is kept (autosaved with the project's name, see §3).

## 2. Architecture

New folder `src/plan2d/` (all pure, no Babylon, no DOM except the view files), a lazy chunk loaded on first open (like the account UI), behind a product switch `plan2d` (true in the product table; the all-on test table true; the deploy guard accepts only the known product values).

| Piece | File | Notes |
|---|---|---|
| Plan model + intents (place, move, rotate, remove, connect, disconnect, select), undo/redo | `model.ts`, `history.ts` | pure, unit-tested; ids stable |
| Geometry (metre to pixel transform, snap, scale bar, footprint, port anchor on a symbol outline, pan/zoom) | `geometry.ts` | pure |
| Symbols (glyph per device family, from the sheet) | `symbols.ts` | SVG path data, one place |
| Rear panel layout (real ports from the catalogue, order, connector glyphs) | `rearPanel.ts` | reads the catalogue; unknown layout = a plain port row, said |
| Cable types, colours, line styles, tags, legend | `cableStyle2d.ts` | the sheet's table as data; contrast pinned by a test (3:1 on Nuit and Papier) |
| Patch rules | `patchRules.ts` | adapter over the existing connection rules (`connectModel`/catalogue); no new rules |
| Persistence | `persist.ts` | own localStorage key per project name (`audio-sim/plan2d.v1.<key>`), try/catch everywhere, versioned; NOT in `DesignState` and not in `store.ts` (engine neutrality stays) |
| View (SVG, pointer + keyboard + touch) | `view.ts`, `plan2d.css`, `palette.ts`, `rearView.ts` | accessible: roles, labels, live status, focus order |
| Spawn into 3D | `spawn3d.ts` | converts plan data to the store's existing intents inside one `history.do`; never edits the store's code |
| Wiring | `src/creation/plan2dWiring.ts` + a menu entry | lazy `import()` only when opened |

French copy in `src/creation/copy.ts` + `docs/copy/creation-mode.md` (« vous », no first person from the page, legal/standards claims worded « conventions courantes » unless the standard text was read: the sheet says most were not).

## 3. Data

`Plan2D v1 = { v:1, roomId, devices:[{id, deviceId, x, z, rot}], cables:[{id, a:{dev,port}, b:{dev,port}, type?}] }`, x/z in metres from the room's own origin, the same axes as the 3D placements (so spawn is the identity transform). The cable type is derived from the two ports' connector and signal, never typed by the learner. The 2D plan of a project that never opened it is absent.

## 4. Honesty rules

One source sheet per device number (footprint, rated numbers): unknown = no number, shown as such. Symbols are our drawings after the conventions: the sheet's tags (STANDARD / TRADE PRACTICE / OUR PROPOSAL) go in a « Légende et sources » panel; nothing says « conforme IEC/AES ».

## 5. Tests (red first)

Unit: geometry (snap, scale, anchors, orientation), model (place/move/rotate/remove/connect, undo/redo, ids), rearPanel (every catalogue device yields a layout; ports match the catalogue exactly: count, connector, direction), cableStyle2d (every cable type in the catalogue has a style; contrast; distinct line pattern per type), patchRules (the same accept/refuse answers as `connectModel` on a table of pairs, including the refusal reasons), persistence round trip + corrupt record dropped, spawn (positions identical in metres, connections created, one undo step, refusal for outside the room / overlap, existing gear untouched). Copy/wording tests stay green. E2E (`tests/e2e/plan2d.spec.ts`, all-on build and product build): open the page, blank, place console + speaker, hold a cable, flip to the rear panel, connect, back to the general view with the coloured line and legend, keyboard-only path, close and reopen (kept), spawn into 3D (devices and cable exist at the same metres; one Ctrl+Z removes them), exam address shows none of it, no console error.

## 6. Deploy

Auto-deploy was asked by the Master; the founder's own yes is asked in chat before the push. The 2D page ships ON after that yes.

## 7. Staging

Stage 1: model, geometry, symbols, rear panels, patch rules, cable styles, persistence, view, wiring (everything except spawn). Stage 2: spawn into 3D, its dialog, and the e2e that crosses both.

## 8. Not in this mission

Dimension lines and drawing tools beyond the room outline, import of a venue plan, printing/PDF export, stage-plot symbols for people and instruments, multi-room plans, the patch-bay normalling drawing (a later item: sheet §5).

## 9. For the founder (decisions)

The glyph set and the cable colours (sheet §a, §3); whether « conventions courantes » wording is acceptable until the paid standards are read; footprints for devices that have none in the catalogue; whether the plan should be per room or per project; where the button lives (menu Affichage + toolbar).
