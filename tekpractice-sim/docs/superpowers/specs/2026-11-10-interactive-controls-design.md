# Interactive controls: faders, knobs, keys, meters and screens on the 3D models

Status 2026-11-10: implemented on `assets/3d-rebuild` (local, not pushed). Scope: the 3D side only. The console software (a real
mixing engine, scenes, EQ pages) is a later phase; this layer is what it will plug into.

## What the learner can do now

On the **selected** device (a click on it selects it, as before), in Mode Création:

| control | gesture |
|---|---|
| fader | press the cap and drag along its slot; the cap follows the pointer exactly (the pointer ray is projected on the slot). `Shift` = fine (1/5). Double-click = back to 0 dB |
| knob | press and drag up / right to turn up (220 px = the whole sweep). `Shift` = fine. Double-click = default |
| key | click. A latching key stays pressed and lit; a momentary one is lit while held; keys of one **radio group** (an ON / OFF pair, SEL, fader bank) exclude each other |
| switch | click steps to the next position |
| meter | nothing to do: it moves (LED bars, VU needle with real ballistics) |
| screen | touch: the mixer-overview app drags a strip's fader or toggles its ON key, on the same values as the 3D faders. **Double-click on bare glass** flies the camera into the screen |

While a control is held, or the pointer rests on it, its name and value follow the pointer (« Fader 3 · −6.0 dB »). The controls are inert
while a device is being placed. A press that is not on a control is untouched (orbit, selection, placement, patching work as before).

## Layers

```
content/control-layouts/<deviceId>.json     data: what is on the surface, where, how it behaves
src/controls/controlTypes.ts                layout format + parser (repeat, overrides, radio groups, sloped top)
src/controls/controlBank.ts                 live values of one device; the same numbers the software will read and write
src/controls/tapers.ts                      fader scales (console 0 dB @ 75 %, Axia broadcast), value text
src/controls/meters.ts                      VU / LED-bar ballistics, a deterministic demo signal
src/controls/faceFrame.ts                   face-local mm -> device root frame (I/O face at -Z), sloped tops
src/controls/controlRig.ts                  Babylon: builds and drives the moving parts, hit pads, screens
src/controls/screenApp.ts                   the ScreenApp interface + the mixer-overview app
src/controls/screenView.ts                  camera pose to « go into » a screen
src/controls/catalogLink.ts                 a 3D control <-> a setting of the simulation (both ways)
src/controls/ticker.ts                      one 30 fps loop, only while a rig is live and near
src/controls/attach.ts                      lazy: layout lookup, bank + rig for an instance
src/creation/controlController.ts           the pointer layer (window capture phase, selected device only)
src/creation/sceneHost.ts                   wiring: ticker, LOD, design <-> bank sync, commit -> intent
```

The rig is a **lazy chunk** (26 KB): the creation entry stays inside its budget. A device with no layout, or a model without GLB extras
(no real size), gets nothing.

## The layout format (version 1)

Face-local millimetres, exactly as the asset specs: origin bottom-left of the face seen from outside, x right, y up; on `top` / `bottom`
y = 0 is the I/O edge. A fader's (xMm, yMm) is the centre of its cap at value 0; for everything else the centre.

```jsonc
{
  "schema": 1, "deviceId": "yamaha-ql1",
  "topProfile": [[0,272],[6,272], ...],        // optional: the sloped top (the spec's build.profile); parts on `top` sit on it, tilted to it
  "controls": [
    { "id": "fader-1", "kind": "fader", "face": "top", "xMm": 53.3, "yMm": 505.2, "axis": "y", "travelMm": 100,
      "reverse": true,                         // value 0 at (x, y), value 1 travelMm nearer the I/O edge
      "taper": "fader-db", "default": 0.75, "slot": true, "slotMm": {"w":13,"len":112},
      "colour": "#a3a8b0", "sizeMm": {"w":15,"h":27,"d":11}, "label": "Fader 1" },
    { "repeat": {"count": 8, "dxMm": 42.46, "dyMm": 0, "idFormat": "ch{n}-on"},   // a row of identical controls; {n} also in group / label / meter.source
      "kind": "button", "group": "ch{n}", "label": "ON", "lit": "#e5463b", ... },
    { "id": "screen", "kind": "screen", "face": "top", ..., "screen": {"app": "mixer-overview", "pxW": 1024, "pxH": 661} },
    { "id": "pgm-meter", "kind": "meter", ..., "meter": {"style": "bar", "source": "pgm1-l", "segments": 40, "fromDb": -48, "toDb": 0} }
  ],
  "overrides": { "fader-1": { "catalogControl": "fader-in-mic-1" } }   // link / legend / default of one control of an expanded row
}
```

Kinds: `fader`, `knob`, `button` (`latch`, `group`, `round`, `label`, `lit`, `ink`), `switch` (`positions`), `led`, `meter` (`bar` | `vu`),
`screen`. `repeat` expands to one control per index; ids must be unique; a layout with any error is refused whole (logged, nothing built).

Two **generators** write layouts from measured data (re-runnable, calibration constants at the top of each):

* `node tools/controls/gen-ql1-layout.mjs`: the QL1, from the official overhead photo.
* `node tools/controls/gen-from-specs.mjs`: a basic layout (power key / rocker, sample-rate knob, status LED) for every device whose
  asset spec lists controls and that has no hand-made layout. Files it owns carry `"generated": true`; remove that flag to take one over.

### Adding a device

1. The model must be a pipeline model with extras (real size in GLB extras).
2. Measure the controls on a straightened photo of the face (the pipeline's `asset:rectify`), convert to face-local mm.
3. Write `content/control-layouts/<id>.json` (or a small generator next to the QL1 one). `tests/controls/controlTypes.test.ts` validates every
   shipped layout; look at it in the app (`window.__creation.frameDevice(id)`, `turnCamera`, `setCameraRadius`).
4. Link what the simulation already models: a control whose `catalogControl` is a catalog control id (power, `phantom-48v`, a master fader
   enum…) is kept in step with the simulation both ways, with one undoable step per operation.

**Orientation rule for text.** A top-face legend or screen is turned half a turn about the face normal so it reads for the operator
standing at the front (the printed top pictures are already that way round); other faces read upright.

## The bank: the contract with the console software

`ControlBank` (one per device instance, `instance.controls.bank`) holds every control's normalised value:

```ts
bank.get(id): number            bank.set(id, value, origin): boolean
bank.subscribe((id, value, origin) => …): () => void      origin: 'user' | 'software' | 'reset'
bank.snapshot(): Record<string, number>      bank.restore(values)
```

* A fader / knob is 0..1 on its travel (the taper gives dB: `controlDb(def, v)` / `controlPosition(def, db)`), a key 0 / 1, a switch an index.
* The 3D rig draws the bank; the pointer controller and the screen apps write it with origin `'user'`; the software layer writes with
  `'software'` (it moves the cap and does **not** touch the simulation). Radio groups are enforced in `set`.
* **Meters read buses by name** (`ch1`, `pgm1-l`, `st-l`…): `rig.levels = (bus, tSec) => dBFS`. Today every bus is fed by
  `demoLevelDb` (a deterministic music-like level); the software layer replaces that one function with real levels. `rig.powered = false`
  makes every meter and screen read silence (it follows the simulation's `power` setting).
* A **screen app** implements `ScreenApp { animated; draw(ctx, w, h, {bank, levels, nowMs}); pointer(kind, x, y, ctx, w, h) → {handled, changed?} }`
  and is registered in `createScreenApp(name)`. It sees the same bank, so an app drawn on the glass and the 3D faders are one state. Pages,
  scenes, EQ curves and routing are more apps (or one app with pages) behind the same two calls.
* `window.__creation.controlValues(id)`, `setControlValue(id, control, v)`, `controlScreen(id, control)`, `focusScreen(id, control)`,
  `sceneStats()`, `renderBench(n)` are the test / debug seams.

## Simulation link (`catalogLink.ts`)

A toggle maps to a key or switch (pressed = true; `invert` for a « mute » shown by an ON key), or to a fader (open above 5 % of the travel;
opening from the panel lifts a closed fader to ~0 dB). An enum maps to the nearest dB step of a fader's own scale (`-inf, -30 … +10`) or to
an index on a knob / switch. A finished operation (key press, drag release, double-click reset, a screen touch released) sends one
`SET_CONTROL` through `onControlChange` → `history.do`, the path the Properties panel uses, so it is undoable and saved with the project; any
design change (panel, undo, load) is shown back on the caps (`syncControls`). A setting the design does not mention is at its catalog default.

## Cost

A console is a few hundred small meshes (the QL1: about 380 drawn parts and as many hit pads, 7.7 ms of extra frame time on a software GL).
The surface is therefore drawn only for the **selected** device and for devices within 3.5 m of the camera; an inactive rig draws nothing
and its meters / screens neither run nor ask for frames, so an overview with consoles in it renders at the old cost and an idle page
stays idle. Meters and live screens run on one ticker (30 fps, screens ~15 fps) and invalidate the render scheduler only when something redrew.

## Not done (by design or by time)

* Control values other than catalog-linked ones are not saved with the project (the bank has `snapshot` / `restore`; the store schema
  needs a `surface` map and an undo story: a decision for the founder).
* Real signal on the meters (the audio engine does not expose per-channel buses yet).
* Keyboard operation of controls, Alt + wheel on a knob, multi-touch (two faders at once).
* Layouts exist for the Axia iQ, QL1, ISA One, m905 and the generated power-key layouts; the Rio, mics and stands have none (nothing to operate).
* Mesh merging (vertex-colour LED bars, merged slot plates) would cut the draw count further if the LOD radius ever needs to grow.
