---
name: 3d-structure-rebuild
description: Mandatory method for every TekPractice 3D equipment model. Rebuild the real STRUCTURE of a device as modelled geometry (rounded body, faders, 3D knobs, buttons, ports, keys, screws, feet) from several good source photos and the manufacturer sheet, then pass an independent look-alike review. A photo may only supply printed graphics and labels.
---

# 3D structure rebuild: the mandatory method

Why this exists. Round 1 of the quality pass put each photo on a box as a flat picture. It looks right straight-on and wrong from every other angle: sharp chamfers where the real part has a large radius, printed knobs and faders, a dark slab and a gap where keys run flush to the end cheeks. The founder's rule: faders perfect, 3D rotary knobs, buttons, ports, everything engraved or modelled, no more mistakes like these.

The test cases are the founder's own screenshots (reports folder `3d-quality/founder-feedback-2026-11-15`): ADAM S3H corner (large rounded edge radius), AEA stand, AETA Scoopy+ (curved silver frame, recessed keypad keys, big knurled knobs with collars), AKAI MPK mini end (keys flush to the red cheeks). Every worker checks those four first.

## The five steps, all mandatory

### a) Sources: at least 4 good views per device
Front, rear, side, top or three-quarter, at high resolution (>= 1000 px on the long side), from the manufacturer first, then retailers. Put them in `assets-source/<id>/photos/` with a row each in `SOURCES.md`. REJECT blurry, small, angled-only or wrong-variant photos and LOG each rejection in `SOURCES.md` (file, reason). If good views do not exist, say so in the structure sheet notes and mark the model NEEDS-SOURCES: never fake a part you cannot see.

### b) Structure sheet before modelling
Write the sheet in the spec, block `structure` (schema: `tools/assets3d/structure.ts`; the doc comment at the top of that file and the table below are the reference). Scale every photo with the datasheet dimensions (the spec's `realSizeMm` and any dimension drawing): measure the PHOTO in pixels, convert with mm per pixel on the same plane, never by eye. For each part list: position (face, xMm, yMm, face-local, x right and y up seen from outside; on top and bottom y runs from the io edge), size, edge radius, whether it is proud or recessed, colour. Also note the body radii, frame, recesses, screws, feet and handles. A part you cannot see in any photo is not in the sheet.

| kind | what it builds | main params (mm) |
|---|---|---|
| knob | revolved knob, optional collar, knurl flutes, pointer line | diaMm, heightMm, collarDiaMm, collarHeightMm, knurl (flute count), pointer (0/1), angleDeg, bevelMm, taper |
| button | rounded-rect or round button, proud, optional dark frame | widthMm, heightMm or diaMm, riseMm, cornerMm, bevelMm, frameMm |
| fader | slot with raised rails and a bevelled cap with an index line | slotLenMm, slotWidthMm, capWidthMm, capLenMm, capHeightMm, posFrac 0..1, horizontal |
| socket | collar, dark well, pins, by `type` (xlr, jack, trs, rca, bnc, usb, rj45, iec, powercon, speakon, din, ethercon, sfp, generic) | diaMm or widthMm and heightMm, collarMm, riseMm, wellMm |
| keys | piano keys: white keys with a front chamfer, black keys at the rear end | whiteCount, whitePitchMm, whiteLenMm, blackLenMm, blackWidthMm, riseMm, startNote |
| pocket | a RECESS cut into the body (exact boolean, deterministic): round or rounded-rectangle, walls and floor in the part colour | diaMm or widthMm and heightMm, cornerMm, depthMm |
| prism | any outline polygon (points, mm in the part frame) extruded outwards: wedge cheeks, plates, a raised deck (textured: 1 takes the face picture) | points, riseMm, bevelMm, textured |
| rod / ball / ring / driver | bar between two local points; sphere; annulus; loudspeaker cone with surround and dust cap | see structure.ts |
| screw | domed head with slot | diaMm, riseMm |
| led | dome or lens | diaMm or widthMm and heightMm, riseMm |
| slot | dark groove | lengthMm, widthMm, riseMm |
| foot | cylindrical foot on the bottom face | diaMm, heightMm |

Repeat a part with `count`, `cols`, `pitchXMm`, `pitchYMm` (a row of 24 faders, a grid of 8 pads). `colour` and `colour2` are the REAL colours of the part (the builder lifts them for the dim scene). `structure.bodyHeightMm`, `bodyWidthMm` and `bodyDepthMm` build the body smaller than the overall size when keys, knobs, faders or side cheeks stand on it (the overall size gate still checks `realSizeMm`, which is the datasheet's overall dimension).

Part gaps (build more kinds in `tools/assets3d/blender/structure_parts.py`, and add the name to `tools/assets3d/structure.ts`): if a real part has no kind (a handle, a hinge, a carrying rail, a yoke, a stand arm, a recessed LCD bezel), write it as the sheet notes AND build it: extend the kit with a new kind or use the closest kind combined (button plates make panels and cheeks, slot makes grooves). Do not leave it printed.

### Pitfalls found by the first independent review (read before you measure)

1. **Top face is mirrored.** The face frame of the top face has the io (rear) edge at the bottom, so x runs the opposite way to what a top-view photo or the player sees. Measure the photo the usual way (front edge at the bottom, x from the left of the picture, y from the REAR edge, the top of the picture) and set `structure.topSeenFromFront: true`: the builder converts x for you and runs key rows to the right. Without the flag, mirror x yourself (x = width - x_photo). Always check a top view against the photo: left and right must agree.
2. **Body lower than the overall size.** The datasheet height, width or depth includes the parts that stand on the body (keys, knobs, faders, side cheeks). Set `structure.bodyHeightMm`, `bodyWidthMm`, `bodyDepthMm` for the BODY alone; the parts bring the overall size back to `realSizeMm` (the size and proportion gates check the whole).
3. **Printed copies of the controls.** A product photo used as the face picture shows the real controls; the builder now paints out the footprint of every modelled part in the picture (with the colour around it), but check that no printed knob, pad or key shows beside a modelled one. Legends and scales outside the footprints stay.
4. **Wide parts and edges.** A key row or any part is placed by a ray cast onto the body: keep its anchor on the flat deck (a key row casts its ray at its middle). Never anchor a part on a rounded edge.
5. **Ports and sockets.** The catalogue port node sits on the face plane; a socket part draws its collar and well so that the well floor is flush with the panel plane (default wellMm = riseMm). If the real panel is recessed, give the port an `insetMm` and the matching `openingMm` (the body shapes that cut pockets need the room).
6. **Recesses.** Use kind `pocket` to cut a real recess (a recessed keypad key, an XLR cavity, a fader slot, a driver well, a port pocket). Parts are placed on the surface BEFORE the cut, so put a part that sits inside a pocket at zMm = minus its depth (a key cap 1.4 mm proud of a 1.2 mm pocket: zMm -1.2 and riseMm 2.6). A catalogue port inside a pocket needs the matching `insetMm` (the port gate measures the surface under the node). Many pockets are cut with ONE boolean.
6b. **Wedge-shaped parts** (end cheeks, sloped plates) use kind `prism` with `points` (outline polygon in the part frame, mm) and `riseMm` (thickness outwards).
7. **Blank rectangles** reach only `depthMm` behind the face plane (default at most 40 percent of the thickness): with a lower body give them a larger `depthMm`.
8. **Reviewers use straight-on views** as well (azimuth 180, 0, 90, 270 and elevation 88) next to the three-quarter ones: 215/35/125/305 are 35 degrees off the model axes.

### c) Real geometry
Modelled, bevelled and engraved; recessed, never printed. Body edges: use the shape's own radius parameters with enough segments to read as a real radius (a chamfer is wrong where the real edge is round). Sockets have collars and dark wells. A photo texture is allowed only for printed graphics and labels (legends, scales, the screen content); every logo and wordmark is still blanked (`texture.blankRects`). Parts take their own colours: the picture never covers them (the builder tags part faces).

Budget: parts cost triangles. Set `tier: "hero"` (ceiling 15000 triangles) and a declared `build.budget` for a part-heavy device; keep the GLB under 500 KB and the model loading fast (check `public/assets/<id>.glb` size). Use fewer segments on small parts, `count` for repeated ones.

### d) Review gate: same angles, large, independent
Render from the SAME angles as each source photo, side by side at large size (>= 1024 px), including three-quarter views and close-ups of the corners:

```
BLENDER_EXE='D:\Blender\blender.exe' node tools/assets3d/review-views.mjs <out-dir> <id>@<final.glb> "name:azimuth:elevation:zoom[:fx:fy:fz];..." 1100
```
(azimuth 215 = front three-quarter, 180 = straight front, 0 = rear, 90/270 = the sides; zoom < 1 is a close-up of the point fx,fy,fz of the bounding box; `review-compare.mjs` puts photo (cropped to the same spot), the old model and the new one side by side.)

Score each item 0, 1 or 2 with a MEASUREMENT, not an impression. Scale every photo with the datasheet size (mm per pixel on the same plane) and compare in millimetres.

1. **Silhouette.** Render orthographic-like straight views (front, side, top: azimuth 180/0/90/270, elevation 0 or 88) and compare the outline with the photo outline scaled to the same size. 2 = every point of every outline within 2 mm (or 1 percent of the long side, whichever is larger); 1 = within 5 mm; 0 = a visibly wrong proportion, slope or overhang.
2. **Edge radii and cross-section.** Measure each distinct edge radius or chamfer in the photo (a corner crop with a scale) and in the model (a cut section or a close-up at the same spot). 2 = every one within 2 mm or 25 percent; 1 = one or two off by more; 0 = a chamfer where the real edge is round, or the reverse.
3. **Controls as geometry.** List every control of the real unit (each fader, knob, button, key, pad, switch, LED) from the photos. 2 = the count and kind match exactly, each is modelled geometry (nothing printed), centre within 1.5 mm and size within 1 mm of the photo-scaled value, proud or recessed as the photo shows; 1 = one or two controls off by more, or one printed; 0 = a control missing, or a group printed instead of modelled.
4. **Ports as geometry.** Every connector present with the right type, opening size within 1 mm, depth shown, position within 1.5 mm. 2/1/0 as above.
5. **Colours and finishes.** Sample the body, plate, caps, keys, rings in a straight view of the model and the same areas of the photo (the same exposure): 2 = every area within 12 of 255 per channel; 1 = one or two areas off; 0 = a wrong colour family or a silver part white.
6. **Gaps, flushness and artefacts.** Every gap and step (key to cheek, panel to frame, seam) within 1 mm of the photo-scaled value; no part clipping another; no visible crease, streak or shading seam along an edge that is smooth in the photo; no hairline cracks. 2 = none wrong; 1 = one or two; 0 = a gap or crease that is plainly wrong.
7. **Cleanliness.** No logo, brand name or lettering of the maker; no printed copy of a control; no ghost graphics or baked shadows in the pictures; no floating or intersecting parts. 2 = none; 1 = one minor; 0 = a logo, a printed control or a floating part.
8. **Weight.** Triangles within the declared budget (15000 at most), GLB under 500 KB, loads without error. 2 = yes; 1 = over by up to 20 percent; 0 = over by more or fails to load.

**PASS = 13 of 16 or more, NO item at 0, AND every founder test point met.** Anything else is FAIL. A passed device is then shown to the founder as a same-angle photo/render pair in the chat before it counts as final.

The reviewer must be a SEPARATE agent that never saw the build: it gets only the device id, the final.glb path, the source photos, the founder test points and this checklist, and writes its own measurements, scores and a list of defects. The builder fixes and resubmits until the reviewer passes.

**Founder gate (hard).** Each example from the founder's screenshots carries a stated TEST POINT (ADAM S3H: the cabinet edge reads like his picture 1, a soft rounded transition, and NOT like picture 2, a sharp chamfer; AEA R84: the stand is the chrome yoke and black stand adapter of the photos; AETA Scoopy+: curved silver frame, recessed keypad keys, big black knurled knobs with collars well proud of the face; AKAI MPK mini: keys run flush to the red end cheeks with no dark slab or gap). If a test point FAILS the device FAILS, whatever its score; the bar is 13 of 16, no 0, every test point met. The reviewer must render the model at that spot from the SAME viewpoint as the founder's picture, CROP the photo to the same region, and judge them side by side at large size (review-compare.mjs takes a photo crop). Match the exposure of the renders to the photo.

### e) Report
Per device: the structure sheet (what parts), before and after renders at the photo angles, the reviewer's score, rejected sources, file size, triangles.

## Tools

- `node tools/assets3d/review-views.mjs` (large angled renders), `review-model.mjs` (front and rear next to the photos), `photo-fit-scan.ts`, `silhouette-profile.mjs` (round mics).
- Build without shipping: `BLENDER_EXE='D:\Blender\blender.exe' npm run -s asset:build -- <id> --scripted` (prints gates and the `final.glb` path). Shipping and committing are done by the integrator.
- Data rule: every device dimension and number comes from the device's own manufacturer sheet; the structure sheet only describes what the model LOOKS like (it adds no number to the catalogue). Unknown means no number is shown.
