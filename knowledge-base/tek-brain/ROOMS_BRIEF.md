# Room template agent brief (A3)

You write parametric room templates: `knowledge-base/tek-brain/rooms/<room-id>.json`, one file per room id assigned to you (ids come from `tek-brain/domains.json` → `planned_rooms`). The TekPractice game will **generate** floor, walls, ceiling, zones and gear positions from these files when no licensed 3D model exists, so geometry must be coherent and real.

Read first: `tek-brain/DESIGN.md` §6 "room template" (field list) and the hard rules in `tek-brain/AGENT_BRIEF.md` (sources, never invent, search budget ≤ 6 WebSearch, own words, no git, scratch folder `C:\Users\brro\AppData\Local\Temp\claude\C--Users-brro\0abcb094-5eae-40a6-b310-8dddc16a4448\scratchpad\rooms-<your-family>\`).

## What makes a good template

- **Dimensions** (`dimensions_m.length|width|height` each `{min, typical, max}`, metres) come from sources: standards (ITU-R BS.1116 listening rooms, EBU Tech 3276 control rooms, ISO 20109/ISO 4043 interpretation booths via official summaries, theatre/opera technical specification PDFs published by real venues, festival/arena tech riders, studio booking pages that state room sizes, broadcaster technical guides, acoustic design guides). Several real venues' published sizes can give min/typical/max. If a dimension cannot be sourced, give your best engineering range ONLY if you mark the room `review: "needs-oscar-review"` and log it in a top-level `"not_found_log"` array explaining which numbers are estimates. Never present an estimate as sourced: sources' `covers` must name exactly which fields they support.
- **Coordinate system** (copy verbatim): `"origin = floor centre; x = right, y = up, z = toward the audience / listener; metres"`. Width is along x, length along z. Everything must fit inside the typical footprint: `|x| + w/2 ≤ width/2`, `|z| + d/2 ≤ length/2`.
- **RT60** `{min, max, band_note, source_url}` with `source_url` equal to one of `sources[].url`; or `"not found"`.
- **Zones** `rect_m: [x, z, w, d]` (centre x, centre z, width, depth). Kinds: stage, foh, monitor-world, control-room, live-room, iso-booth, vocal-booth, audience, backstage, gallery, booth, pit, desk, machine-room, other.
- **gear_positions**: real equipment ids from `knowledge-base/equipment/*.json` or `tekpractice-sim/content/catalog.json` (Grep `"id":`), in a zone, `position_m: [x, y, z]`, `rotation_deg` (yaw, 0 = facing +z). 4–15 items per room: what a technician would actually find there (console at FOH, stagebox on stage, mics on stands, monitors, codec rack…). Do not cite a source for typical positions unless one exists; positions are layout, the gear choice is the teaching.
- **power_points / patch_points**: where the mains distro and stage/wall patch boxes typically are (`type`: e.g. "schuko-16a", "p17-32a-3ph", "stage-box-48ch", "wall-patch-xlr-12", "dante-wall-port").
- **openings**: doors and windows (`wall`: front|rear|left|right, `offset_m` along that wall from its centre, `width_m`, `height_m`).
- **surfaces**: floor/walls/ceiling materials (e.g. "parquet", "moquette", "plâtre + absorbants laine minérale", "béton", "rideau velours noir") and a short finish note.
- **procedural**: `wall_color`, `floor_color`, `ceiling_color` (hex), `prop_hints` (e.g. ["rideaux de scène", "praticables 2×1 m", "racks 19\""]).
- **lighting**: `{ "mood": "...", "color_temp_k": 3200 }`.
- **licensed_dressing**: leave `[]` (the 3D agents fill `3d-models.json`; the lead links them later).
- **family**: one of studio, post, broadcast, live, theatre, classical, worship, conference, education, installed, outdoor.
- `sources`: same object as everywhere (url, publisher, accessed 2026-10-22, confidence, kind, covers).

## Validate

From `C:\Users\brro\dev\Tekonest-wt\tekbrain`: `python knowledge-base/tools/validate_tekbrain.py` → no ERROR line mentioning `rooms/` files you wrote. Warnings about zones outside the footprint must be fixed.

## Hand-back

Per room: id, typical L×W×H, RT60 range or "not found", number of sources, which numbers are estimates. Plus the 3 most useful real-world facts you found. Do not paste JSON.
