# TekPractice 3D model review: how to make a device look like the real one

The bar is the QL1: a model that, next to the manufacturer photo, reads as the same equipment (shape, curves, colours, front and rear detail). This page is the loop used for the quality pass. Everything here is a working method; the renders it makes are working files, never shipped.

## Tools (run from `tekpractice-sim`, Blender at `D:\Blender\blender.exe`)

In Git Bash the shell variable `BLENDER_EXE` is mangled: always prefix commands with `BLENDER_EXE='D:\Blender\blender.exe'`.

| need | command |
|---|---|
| side by side render: front and rear three-quarter of a model next to its first two photos | `node tools/assets3d/review-model.mjs <out-dir> <id>[@path/to/model.glb]` (the `@glb` form reviews a work-dir build that is not shipped yet) |
| overview grid of many review renders | `node tools/assets3d/review-grid.mjs <dir> <out-dir> <ids.json>` |
| which photos are straight enough for a face | `npx tsx tools/assets3d/photo-fit-scan.ts <id> ...` (aspect test only: a pass means the product's bounding box has the face's proportions) |
| build one device without shipping | `npm run -s asset:build -- <id> --scripted` (prints gates; the result is `assets-source/<id>/work/<run>/final.glb`) |
| ship a verified build (done by the integrator, not by the workers) | `npm run -s asset:build -- <id> --scripted --ship --logos-removed` |

## Where the picture of a face comes from

A scripted build makes the shape (`build.shape` and `build.params` in `content/asset-specs/<id>.json`) and maps one picture on each face listed in `build.projection`. By default each face takes the device's generic drawn panel (`content/generic-panels/<id>.json`). To use a real photo instead, add to the spec's `build` block:

```json
"photos": [ { "face": "opposite", "file": "front.png", "crop": [left, top, width, height], "fill": true } ]
```

- `file` is a file name in `assets-source/<id>/photos/` (git-ignored reference photos, each folder has a `SOURCES.md`).
- Faces: for a rack unit, a speaker or a stage box `opposite` is the FRONT and `io` is the REAR (connector side). For a console `top` is the control surface and `opposite` the front lip. Face-local millimetres: x to the right seen from outside, y UP from the bottom edge.
- `crop` is in pixels of the ORIGINAL photo and selects the straight-on face inside it (the face must have the aspect of the real face: `realSizeMm` w x h for io/opposite, w x d for top; the build refuses a photo more than 8 percent off). Without a crop the photo is trimmed to its non-white bounding box. `fill: true` repaints the white corners of a rounded casing.
- Faces without a `photos` entry keep the generic panel. Never project a rear photo onto `io` unless the connectors in the photo sit under the spec's port positions (the port markers must stay on the connectors); a front photo is safe.
- A perspective (three-quarter) photo cannot be used as is. Use a straight-on one, or rectify a quad first (`npm run asset:rectify -- <photo> <x1,y1,...,x4,y4> <outW> <outH> <out.png>`, corners top-left, top-right, bottom-right, bottom-left, then reference the PNG by copying it into `assets-source/<id>/photos/` under a new name such as `front_rectified.png`).

## Brand marks

The picture must not print a manufacturer name or logo, nor the model wordmark. Remove them with the spec's `texture.blankRects` (face-local mm, the same convention; `fill` is a `#rrggbb` close to the panel colour there; `marginMm` is the ring the automatic fill samples). Measure the logo in the trimmed photo: mm = pixel / pixelsOfFaceWidth x faceWidthMm. Small functional legends (INPUT, LEVEL, power symbol) stay. After a build, look at the render: no logo, no blank rectangle over a connector, knob or screen.

## Geometry (the shape)

Real proportions come from `realSizeMm` (datasheet value, never change it). The visual parameters in `build.params` can be adjusted when the photo shows it: edge fillets, ears, handles, feet, vents (see `tools/assets3d/shapes.ts` for the names of each shape), colours `bodyRgb` / `plateRgb` (decimal 0xRRGGBB, sampled from the photo), and a console's side `profile`. Keep the triangle budget (`build.budget`) and the fillet gate.

## Data rule

Every device dimension and number comes from the device's own manufacturer sheet (recorded in the spec `sources`); unknown means no number. The review pass only changes how the model LOOKS. Do not touch `realSizeMm`, the catalogue, the port ids or the control ids. You may refine a port or control position (`xMm`, `yMm`) when the photo clearly shows where it is on the face you project; set its `confidence` to `photo` and say so in the source note.

## Done means

For each device: before render (`reports/3d-quality/before/<id>.png`), after render beside the photo, all build gates PASS, no logo printed, colours and details close to the photo, and one line in the results file naming what was changed and what is still off.
