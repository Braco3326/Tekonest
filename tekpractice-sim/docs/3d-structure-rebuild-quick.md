# 3D structure rebuild, QUICK method (founder order 2026-11-15: good enough, not perfect)

The founder stopped the per-round reviewer loops: "don't do it perfect at 100 percent, it costs a lot of time and tokens, find a simpler way". This page replaces the heavy gate of `3d-structure-rebuild.md` for everything after the four pilots (AKAI MPK mini, ADAM S3H, AEA R84, AETA Scoopy+). Read that doc for the part kit, the schema and the pitfalls; the rules below are the process.

## The method (one pass, one quick check)

1. **One build pass per device with the part kit.** Correct silhouette, rounded edges as in the photo, every visible control and port as real 3D geometry (knobs, faders, buttons, keys, pads, sockets), the photo only for printed legends and a clean face picture, no logo. Skip fine millimetre measurement: scale from the datasheet size and the straight-on photo, good to a few millimetres is enough. Use the AKAI, ADAM, AEA and Scoopy+ specs as worked examples.
2. **ONE quick check at the end, done by the builder itself:** a single same-angle render beside the photo (`node tools/assets3d/review-compare.mjs <out> <id> <before.glb> <after.glb> "q1:215:28:1" <photo> 800`), and answer three points: (a) shape and edges right? (b) every visible control present as 3D? (c) no logo or brand text? No 16-point scoring, no separate reviewer agent.
3. **At most 2 build rounds per device**, then move on and list what is left (one line each).
4. **Batch**: a worker handles several devices; write one contact sheet per batch (photo | model, same angle), ready for the founder.
5. Nothing is shipped or pushed by the worker; gates must pass (`npm run -s asset:build -- <id> --scripted`, all PASS, triangles under the tier ceiling (hero 15000), GLB under 500 KB).

## Reminders that save time

- Face frames, `structure.topSeenFromFront`, `bodyHeightMm/WidthMm/DepthMm`, `pocket` (real recess), `prism`, `textured` parts, `zMm` lift, shape `extruded-body` (octagon outline, own front and rear edge radii): all in `3d-structure-rebuild.md` and `tools/assets3d/structure.ts`.
- The app has NO environment map: metallic materials render black, chrome is painted with light colours; one material per model; the colour lift flattens colours brighter than about sRGB 145 (pick source colours with the kit's smooth lift in mind).
- A part inside a pocket needs `zMm` = minus the pocket depth; a catalogue port inside a pocket needs a matching `insetMm`.
- Keep parts per sheet at 160 at most; budget triangles (the part kit costs: knob about 300, fader about 150, key about 40, XLR socket about 200).
- Real sizes only from the manufacturer sheet; never change `realSizeMm` or port ids.
