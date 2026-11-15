# Hand-drawn cables: unroll a cable on the floor, point by point on a grid

Status: design agreed with the founder in chat on 2026-11-15 (eight questions, every answer was the recommended one). Not built yet. Branch `deploy/mode-creation-only-20261115`.
Founder's words: « when clicking on a cable [there] must add an option to draw the cable with some quantisation so i deroll it on the ground as i need, develop this as much as possible ».

## 1. What the learner does

1. **Select a cable.** A click on a cable (the same hit test as the hover) selects it; so does its row in the project tree (« Câbles »). Nothing else changes: a selected cable is drawn with the Papier stroke the hover already uses, and **Propriétés** shows a **cable panel**: what it joins, its signal, its drawn length, and the button **« Tracer le câble »** (and, once a route exists, **« Remettre le tracé automatique »**).
2. **Start tracing**, two ways (both): the button, or a **double-click on the cable**. The tracing mode begins; a small **drawing bar** appears under the menu bar (not over the 3D view): the snap size, « Angles droits », the live length, « Terminer », « Annuler ».
3. **Trace.** The floor shows a grid at the chosen snap size around the cursor. Each click puts a **point** on the nearest grid crossing; a dashed preview runs from the last point to the cursor and on to the cable's far port. Points show as dots; the length counts up in metres.
4. **Finish** with « Terminer », Maj+Entrée or a double-click on the last point; **cancel** with « Annuler » or Échap (the cable keeps its previous shape). Undo (Ctrl+Z) takes back the whole tracing as ONE step.
5. **Edit afterwards.** With the cable selected its points show as handles: **drag** a point to another grid crossing, **click a segment** to add a point there, **select a point and press Suppr** (or its « Supprimer le point » button) to remove it. Every change is one undo step.
6. **Remettre le tracé automatique** removes the route: the cable goes back to its automatic shape (lying between its ports on the floor, see §4).

## 2. Decisions (all confirmed by the founder)

| Question | Decision |
|---|---|
| How to start | The button « Tracer le câble » **and** the double-click on the cable |
| Snap size | **25 cm** by default, switchable to **10 cm, 25 cm, 50 cm, 1 m** (a small selector in the drawing bar); the grid is drawn on the floor while tracing |
| Bends | **Any angle, every point on the grid**; an optional switch « Angles droits » keeps each new segment along one of the room's two axes |
| Length | **The route sets the length**, shown live while tracing and in the cable's hover and panel. No cap and no slack yet |
| Editing afterwards | Drag a point, add one on a segment, delete one; undo and redo cover each |
| Keyboard | **Full keyboard** as well as mouse and touch: arrows move the cursor by one snap step, Entrée places a point, Retour arrière removes the last point, Échap cancels, Maj+Entrée finishes; every action has a button |
| In the room | **Flat on the floor** (on a raised deck it follows the deck); the grid is under the cursor; the route is **saved with the project** and comes back when reopened |
| Ends | The two ends **stay on their two ports**; you only draw what is between them; « Remettre le tracé automatique » restores the automatic shape |

## 3. Data model (the route is design data, not engine data)

- `DesignState` (`src/creation/store.ts`) gets an optional `routes`: a map from the cable's key (`cableKey(a, b)`) to its points, each `[x, z]` in metres on the floor (the height is the floor's, so a route stays valid when a deck moves). Absent or empty = automatic shape. **`rig.connections` is untouched**: the engine, the signal flow and the logic checks do not read a route, so a route can change nothing a learner hears or is told. (`src/engine`, `src/flow` and `src/logic` keep showing no diff.)
- Persistence (`src/creation/persistence.ts`) reads and writes `routes` as an optional field of the saved design: a project saved before it opens as it did; a route whose cable no longer exists is dropped with the cable (the project's existing quarantine note is not involved).
- Intents (the store's own, one `history.do` each): `SET_ROUTE { key, points | null }` (trace finished, a point dragged, added or removed, automatic shape restored). A connection that is unplugged takes its route with it; re-plugging starts automatic. Undo and redo restore routes with the rest of the design (snapshot entries already hold the whole design).
- A route longer than the room, or a point outside the room's floor, is refused at the intent (clamped to the room's rectangle on the grid).

## 4. Drawing

- `catenaryPoints` (already floor-resting since 2026-11-15, commit d948f15) stays the automatic shape. A route is drawn as the polyline: port A, the route's points lifted to `floorAt(x, z) + clearance`, port B. Corners are rounded by a short arc (radius up to 0.15 m, never more than a third of the segment) so a routed cable does not look like a wire frame; the length counted and read in the hover is the length of the drawn, rounded path.
- On a raised deck the path follows the deck; where a segment crosses a deck edge, points are added at the edge so the cable climbs it instead of cutting through.
- Cable budget: a routed cable counts its points against the same point budget (`CableBudget`); over budget it is drawn with its corners unrounded, never dropped.
- Colour, dashes, hover, signal pulses, the legend and the cable pick (`cablePick.ts`) all read the same drawn path, so they follow a route with no change of their own.

## 5. Where the code goes

| Piece | File | Notes |
|---|---|---|
| Route geometry: snap, corner rounding, deck crossing, length | `src/scene/cableRoute.ts` (new, pure, no Babylon) | the unit-tested heart |
| Routed polyline in the renderer | `src/scene/CableRenderer.ts` | `addCable(..., route?)`; the cable in hand keeps its own shape |
| Floor grid + preview + point handles | `src/creation/cableTracer.ts` (new, scene adapter) | a lazy chunk, loaded on first « Tracer » |
| Tracing state machine (points, cursor, keys, undo of the last point) | `src/creation/cableTraceModel.ts` (new, pure) | keyboard and pointer feed the same model |
| Cable selection + panel + drawing bar | `src/creation/shell/cablePanel.ts` (new, DOM) | « Tracer le câble », « Remettre le tracé automatique », the bar |
| Store intent + persistence | `src/creation/store.ts`, `persistence.ts`, `sceneDiff.ts` | `routes`, `SET_ROUTE` |
| Texts | `src/creation/copy.ts`, `docs/copy/creation-mode.md` | French « vous », « à valider (tekuxwriter) » |
| Keyboard map | the shortcuts table and the Aide « Raccourcis clavier » | no clash with the existing keys; the keys act only while tracing or while a cable is selected |

## 6. Tests (red first)

- `tests/scene/cableRoute.test.ts`: snap to each of the four sizes (ties, negative coordinates, the room's edge), « angles droits » snapping, corner rounding (length, never beyond a third of a segment, collinear points), floor lift and deck crossing in every room of `content/rooms`, the length of a route, an empty or one-point route.
- `tests/creation/cableTraceModel.test.ts`: the state machine (place, remove last, finish, cancel, cursor steps, « angles droits »), one undo for a whole tracing.
- `tests/creation/store.test.ts`/`persistence.test.ts` additions: `SET_ROUTE`, undo and redo, unplug drops the route, an old project opens unchanged, a stored route round-trips.
- End to end (`tests/e2e/creation-cable-route.spec.ts`): select a cable, trace with the mouse, trace with the keyboard only, edit a point, remettre le tracé automatique, save and reopen, no console error, `cablePoints` above the floor.
- Engine neutrality (`tests/engineDiff.test.ts` base moved to the commit before this work) and an honesty scan of the new texts.

## 7. Not in this feature (decided, not forgotten)

A cap or standard lengths for cables; slack allowance; moving a cable's end to another port while tracing; a route in the air (rack drops, ceiling runs); cable protectors and ramps; routes on the learning pages (they are off). Each can be asked for later.

## 8. Deploy

Not before the founder has tried it. The floor fix (d948f15) may ship alone first, on his word.
