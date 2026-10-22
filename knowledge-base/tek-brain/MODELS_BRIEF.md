# 3D library agent brief (A3)

Goal: expand the 3D catalogue for TekPractice (rooms, venues, props, instruments, people placeholders, materials/HDRIs, devices) to 400+ candidates overall, and commit the few that are legally redistributable and fit the budget.

Read first: `knowledge-base/3d-models.md` and `knowledge-base/3d-models.json` (80 existing entries: keep their field names), `knowledge-base/3d-models/CREDITS.md`, `knowledge-base/3d-models/downloads.json`, `tekpractice-sim/docs/TekPractice_3D-Model-Sourcing.md`, `tekpractice-sim/CLAUDE.md` (trademark rule: generic visuals).

## Output (never edit the shared files — the lead merges)

1. `knowledge-base/3d-models/candidates/<your-agent-id>.json` — `{ "agent": "<id>", "generated": "2026-10-22", "models": [ ... ], "not_found_log": [ ... ] }`. Each model uses the existing fields **plus**:
   - `"id"`: kebab-case slug, unique, prefixed by source (`sf-…`, `ph-…`, `pp-…`, `kenney-…`, `quat-…`, `si-…`, `objv-…`, `cad-…`).
   - `"kind"`: device | room | venue | prop | character | material.
   - `"room_ids"`: planned room ids from `tek-brain/domains.json` it could dress (may be []).
   - `"device_id"`: equipment/catalog id or null.
   - `"polygon_count"`, `"formats"`, `"licence"` (exact wording from the model's own page), `"licence_url"`, `"attribution_text_required"`, `"shows_brand_logos"` (true/false/"unknown"), `"redistribution_allowed"`, `"suitable_for_tekpractice"` (yes / no / with work) + reason, `"accessed"`, `"model_url"` (the model's own page).
2. Downloads (only when allowed, see below) into `knowledge-base/3d-models/<id>.glb`, plus a fragment `knowledge-base/3d-models/candidates/<your-agent-id>.downloads.json` (same fields as `downloads.json`) and `knowledge-base/3d-models/candidates/<your-agent-id>.CREDITS.md` (same style as `CREDITS.md`).

## Licence rules (hard)

- Verify the licence **on the model's own page** (or the source's API for that model). Library-wide claims are not enough when the page says otherwise.
- Commit files ONLY if CC0, or CC-BY (any version) with the attribution recorded. Never NC, ND, "Standard"/"Editorial", "royalty-free no redistribution" (BlenderKit, TurboSquid, CGTrader standard), GrabCAD, manufacturer CAD without explicit redistribution terms, or unclear licences. Those are catalogue (link) only, `redistribution_allowed: "no"`.
- Visible real brand logos on a CC-BY/CC0 model: catalogue it, flag `shows_brand_logos: true`, and do not download it unless the logo is trivially removable (say so).
- **No Sketchfab API token is available**: Sketchfab models are catalogue-only (search via `https://api.sketchfab.com/v3/search?type=models&downloadable=true&q=...` and `https://api.sketchfab.com/v3/models/<uid>` give licence + face counts without a token).

## Download budget

- Per file ≤ 5 MB after optimisation, ≤ 100k triangles. Per agent ≤ 25 files and ≤ 40 MB total.
- Convert/optimise with Node using the gltf-transform libraries already installed in `C:\Users\brro\dev\Tekonest-wt\explore\tekpractice-sim\node_modules` (`@gltf-transform/core`, `@gltf-transform/functions`, `@gltf-transform/extensions`, `draco3dgltf`, `sharp`). Write your script in your scratch folder and set `NODE_PATH` to that node_modules folder. Typical pipeline: read → `dedup()`, `prune()`, `weld()`, `simplify` only if > 100k tris, `textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] })`, `draco()` → write `.glb`. Record triangles and final size.
- Put downloaded archives in a NEW empty folder under your scratch folder (untrusted data); never run anything from inside it.

## Search budget

≤ 6 WebSearch calls. Use the sources' own search APIs/pages via WebFetch: Sketchfab API, `https://api.polyhaven.com/assets?t=models` / `?t=hdris` / `?t=textures`, `https://api.polyhaven.com/info/<id>` and `/files/<id>`, poly.pizza pages, kenney.nl/assets, quaternius.com, ambientcg.com (`https://ambientcg.com/api/v2/full_json?type=Material`), Smithsonian Open Access (`https://api.si.edu` needs a key — use `https://3d.si.edu` pages), Objaverse (per-object licence via Hugging Face dataset `allenai/objaverse` metadata — the Hugging Face MCP tools may be available to you).

## Validate before hand-back

Your candidates file must be valid JSON; every downloaded file must exist and be ≤ 5 MB. Scratch: `C:\Users\brro\AppData\Local\Temp\claude\C--Users-brro\0abcb094-5eae-40a6-b310-8dddc16a4448\scratchpad\models-<your-agent-id>\`. Never run git.

## Hand-back

Counts by kind and by licence; how many downloaded (size, tris); top 5 most useful finds for TekPractice rooms; licence or trademark issues found. No JSON pasted.
