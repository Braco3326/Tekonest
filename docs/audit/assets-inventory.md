# Assets and rooms inventory (TekPractice "Choisir un lieu")

- Author: tekauditor (read-only audit), 2026-10-24, branch `feature/tekpractice-creative-mode`
- Asked by: creative-mode brief §2 (`tekpractice-sim/docs/plans/2026-10-24-creative-mode-brief.md`, "Inventory everything ... → `docs/audit/assets-inventory.md`")
- Method: files read directly; counts produced by Node scripts over the JSON (scratch copies, nothing in the repo modified); `git ls-tree` on every local and remote branch. "Code present" = seen in source; nothing in this file was verified by running the game.

## Headline numbers

| What | Count | Note |
|---|---|---|
| Procedural rooms in `tekpractice-sim/content/rooms/` | **32** (+ `index.json`) | all 32 are slim copies of the 32 TEK Brain templates (same ids) |
| TEK Brain room templates in `knowledge-base/tek-brain/rooms/` | **32** | |
| `gear_positions` across templates | **350** (5 to 15 per template, 148 distinct `equipment_id`) | matches the brief's "350" |
| Gear positions whose `equipment_id` is in `content/catalog.json` (24 devices) | **77 / 350 = 22.0 %** (18 / 148 distinct ids = 12.2 %) | |
| Gear positions whose id is in the KB equipment database (`knowledge-base/equipment/*.json`, 357 ids) | **348 / 350 = 99.4 %** | the 2 others are `playout-pc` (game catalog only); union = 350 / 350 |
| Environment presets (`content/environments/*.json`) | **7** | only **3** have a `.glb` set (brief says 7 "with `.glb` sets": see D1) |
| 3D files in the worktree (`.glb/.gltf/.fbx/.obj/.blend/.usdz`, excluding node_modules, dist*) | **217**, all `.glb` | 50 game devices/connectors, 3 environment sets, 64 KB models, 100 archive copies |
| 3D files on other branches not already on this branch | **0** (compared by blob hash) | |
| Files over 25 MiB | **0** (largest: `knowledge-base/3d-models/polyhaven-desk-lamp-arm.glb`, 2.74 MiB) | |

## 1. Procedural rooms (`tekpractice-sim/content/rooms/`)

- 32 room files + `index.json` (picker index: id, name_fr, family, size). Written by `tools/sync-rooms.ts` from the TEK Brain templates; last commit touching the rooms, templates and the script: `29bf9de` (2026-10-22).
- "Type" = template `family`. By family: studio 6, broadcast 6, live 5, conference 3, post 2, theatre 2, classical 2, education 2, installed 2, worship 1, outdoor 1. By size: small 13, medium 12, large 7.
- Fields kept per room: `id, name_fr, name_en, family, size, review, dimensions_m, zones[{id,kind,rect_m,floor_y_m}], openings[{wall,kind,offset_m,width_m,height_m}], procedural{wall_color,floor_color,ceiling_color,prop_hints}, lighting{mood,color_temp_k}, source_count`. No room file contains `gear_positions` (checked all 32).
- "References a template": no room file has an explicit template pointer. Each is linked to its template only by identical `id` / file name, plus `source_count` (= number of `sources` in the template; equal in all 32). Every room is `review: "needs-oscar-review"`.
- Rooms are 100 % procedural: built by `src/scene/RoomBuilder.ts` (`buildRoom(scene, room, layout)`) from dimensions, zones, openings and colours. No room uses a `.glb`. Loaded lazily in `src/main.ts` via `import.meta.glob('../content/rooms/*.json')` and `?room=<id>`; `src/game.ts:151` says a procedural room "replaces the env backdrop" (code present).
- Dimensions below are the template's `typical` values (min/max also exist). Gear columns come from the template (section 2), since the room files have none.

| # | id | name_fr | type (family) | size | typical L × W × H (m) | zones (id:kind) | gear_positions | of which in game catalog | licensed_dressing ids | sources |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `arena-large` | Grande salle type Zénith / arena (6 000–20 000 places) | live | large | 75 x 53 x 15.6 | espace-scenique:backstage, scene:stage, regie-retours:monitor-world, fosse:audience, regie-facade:foh, gradins:audience | 15 | 1 | 12 | 3 |
| 2 | `auditorium-amphitheatre-medium` | Amphithéâtre universitaire moyen (≈ 150-250 places) | education | medium | 20 x 16 x 6.5 | stage:stage, audience:audience, control-room:control-room, interp-booth:booth | 11 | 1 | 8 | 4 |
| 3 | `bar-club-stage-small` | Club / bar-concert avec scène (petite salle, 300–370 debout) | live | small | 16.2 x 9.8 x 4.7 | scene:stage, public:audience, regie-facade:foh, bar:other | 14 | 3 | 16 | 4 |
| 4 | `church-worship-medium` | Église de taille moyenne (nef de ~10 000 m³) pour le culte et les concerts | worship | medium | 38.1 x 27.2 x 16 | choeur:stage, nef:audience, bas-cote-gauche:audience, bas-cote-droit:audience, tribune-orgue:gallery, regie:desk | 11 | 0 | 2 | 3 |
| 5 | `classroom-lab-small` | Petite salle de TP son (salle de classe équipée) | education | small | 8 x 7 x 3 | teacher-desk:desk, student-benches:desk, rack-corner:machine-room, recording-corner:vocal-booth | 10 | 1 | 14 | 3 |
| 6 | `concert-hall-medium` | Salle de concert musiques actuelles (moyenne, 1 000–1 350 debout) | live | medium | 32 x 18.1 x 9 | scene:stage, regie-retours:monitor-world, coulisse-jardin:backstage, fosse:audience, regie-facade:foh, balcon:audience | 13 | 2 | 14 | 3 |
| 7 | `conference-room-small` | Petite salle de réunion | conference | small | 4.5 x 4.5 x 2.7 | front-av:other, table:desk, seating:audience, credenza-rack:machine-room | 8 | 2 | 10 | 2 |
| 8 | `dj-booth-small` | Club en configuration DJ (booth sur scène, petite salle) | live | small | 16.2 x 9.8 x 4.7 | scene:stage, booth-dj:booth, piste:audience, regie-facade:foh, bar:other | 14 | 2 | 13 | 4 |
| 9 | `eng-outdoor-reportage` | Reportage extérieur (zone de travail ENG / radio) | broadcast | small | 20 x 15 x 12 | interview-spot:other, vehicle-tech-base:other, passers-by:audience | 9 | 1 | 8 | 1 |
| 10 | `festival-open-air-large` | Grande scène de festival en plein air | outdoor | large | 120 x 80 x 13.1 | scene:stage, aile-son-gauche:other, aile-son-droite:other, regie-retours:monitor-world, coulisses:backstage, public:audience, regie-facade:foh, tour-delai-gauche:other, tour-delai-droite:other | 14 | 2 | 12 | 3 |
| 11 | `foley-dubbing-stage-medium` | Auditorium de bruitage (foley) et de postsynchronisation | post | medium | 11.7 x 10 x 5 | foley-floor:stage, dirt-pit:pit, gravel-pit:pit, water-tank:pit, adr-spot:other, control-room:control-room | 11 | 3 | 3 | 1 |
| 12 | `hybrid-meeting-room-small` | Petite salle de réunion hybride (visioconférence) | conference | small | 6 x 4.5 x 2.8 | front-av:other, table:desk, seating:audience, rack:machine-room | 8 | 2 | 8 | 2 |
| 13 | `interpretation-booth-small` | Cabine d'interprétation simultanée (2 interprètes) | conference | small | 2.4 x 2.5 x 2.3 | work-table:desk, interpreters:booth | 5 | 0 | 4 | 3 |
| 14 | `mastering-room-medium` | Studio de mastering | studio | medium | 8.1 x 6.2 x 3.3 | listening:control-room, desk:desk, speakers:other, racks:machine-room | 10 | 2 | 8 | 2 |
| 15 | `museum-installed-sound-medium` | Salle d'exposition sonorisée (musée) | installed | medium | 18 x 12 x 4.5 | gallery-a:other, av-alcove:other, listening-station:other, tech-cupboard:machine-room | 9 | 4 | 8 | 3 |
| 16 | `ob-van-small` | Car régie son (petit) | broadcast | small | 5 x 2.1 x 2.05 | equipment-bay:machine-room, audio-control:control-room, sound-desk:desk | 9 | 2 | 4 | 2 |
| 17 | `opera-house-pit-large` | Maison d'opéra avec fosse d'orchestre (grande salle, ~1 100 places) | classical | large | 44 x 24 x 21 | scene:stage, avant-scene:stage, fosse-mobile:pit, fosse-sous-scene:pit, parterre:audience, regie:foh | 13 | 0 | 7 | 3 |
| 18 | `podcast-room-small` | Studio podcast (petit, 4 voix) | studio | small | 5.5 x 4 x 2.6 | table:desk, producer:desk, camera-line:other | 9 | 0 | 7 | 3 |
| 19 | `post-atmos-mix-room-medium` | Salle de mixage Dolby Atmos (post-production, home entertainment) | post | medium | 6.4 x 5.49 x 3.05 | mix-position:control-room, desk:desk, front-lcr:other, surrounds:other, rack:machine-room, overheads:other | 15 | 4 | 8 | 5 |
| 20 | `radio-studio-self-op-small` | Studio radio self-op (petit) | broadcast | small | 4.5 x 3.8 x 2.8 | on-air-desk:desk, presenter-guest-seats:other, furniture-rack:other | 11 | 8 | 10 | 3 |
| 21 | `radio-talk-studio-medium` | Studio radio de débat + régie (moyen) | broadcast | medium | 10 x 6 x 3 | talk-studio:live-room, talk-table:desk, control-room:control-room, control-rack:machine-room | 14 | 9 | 11 | 2 |
| 22 | `scoring-stage-large` | Grand studio d'enregistrement orchestral (scoring stage) | classical | large | 27 x 20 x 11 | salle:live-room, orchestre:stage, choeur:stage, podium-chef:desk, cabine-iso:iso-booth | 13 | 1 | 2 | 5 |
| 23 | `sports-venue-pa-large` | Stade : sonorisation installée (match) et configuration concert | installed | large | 200 x 160 x 46 | pelouse:other, tribune-nord:audience, tribune-sud:audience, tribune-est:audience, tribune-ouest:audience, regie-sono:control-room, local-technique:machine-room, scene-concert:stage, regie-facade-concert:foh | 14 | 3 | 8 | 1 |
| 24 | `studio-control-room-large` | Grande régie d'enregistrement (console grand format) | studio | large | 7.8 x 5.8 x 3.5 | console:desk, listening:control-room, producer-desk:desk, racks:machine-room, front-wall:other | 12 | 0 | 8 | 4 |
| 25 | `studio-control-room-small` | Régie de studio (petite, home/project studio) | studio | small | 5 x 4 x 2.7 | desk:desk, listening:control-room, rack:other, overdub-corner:vocal-booth | 10 | 3 | 11 | 4 |
| 26 | `studio-live-room-medium` | Salle de prise de son (studio, taille moyenne) | studio | medium | 10.5 x 8.1 x 5 | live-main:live-room, drum-area:live-room, iso-booth:iso-booth, amp-corner:live-room | 11 | 3 | 16 | 3 |
| 27 | `studio-vocal-booth-small` | Cabine voix (petite) | studio | small | 1.78 x 1.78 x 2.03 | booth:vocal-booth | 5 | 2 | 4 | 3 |
| 28 | `theatre-black-box-small` | Boîte noire (studio de théâtre modulable, 60–100 places) | theatre | small | 13.5 x 11.5 x 5.2 | aire-de-jeu:stage, gradin:audience, regie:foh | 8 | 3 | 8 | 2 |
| 29 | `theatre-italian-medium` | Théâtre à l'italienne (salle municipale moyenne, 300–350 places) | theatre | medium | 23 x 16 x 10.5 | plateau:stage, coulisse-gauche:backstage, coulisse-droite:backstage, avant-scene:stage, fosse:pit, parterre:audience, regie:foh | 12 | 2 | 7 | 3 |
| 30 | `tv-gallery-regie-medium` | Régie de production TV + régie son (moyenne) | broadcast | medium | 6.5 x 13.5 x 3 | production-gallery:gallery, sound-control-room:control-room, sound-rack:machine-room | 11 | 2 | 1 | 2 |
| 31 | `tv-studio-plateau-large` | Plateau de télévision (grand) | broadcast | large | 32.9 x 30.5 x 13.4 | set:stage, cyclorama:other, camera-floor:other, audience-seating:audience, sound-floor-store:other | 11 | 3 | 1 | 5 |
| 32 | `wedding-event-hall-medium` | Salle des fêtes / salle de réception (mariage, soirée privée, 180–300 personnes) | live | medium | 20 x 13.8 x 3.85 | estrade:stage, regie-sono:desk, piste-de-danse:other, tables:audience, bar:other | 10 | 6 | 2 | 5 |

Rooms with no catalog gear at all: `church-worship-medium`, `interpretation-booth-small`, `opera-house-pit-large`, `podcast-room-small`, `studio-control-room-large` (5 of 32). Most catalog gear: `radio-talk-studio-medium` 9/14, `radio-studio-self-op-small` 8/11, `wedding-event-hall-medium` 6/10.

## 2. TEK Brain templates and `tools/sync-rooms.ts`

### 2.1 What the templates hold
32 files in `knowledge-base/tek-brain/rooms/`, schema `knowledge-base/schema/room.schema.json`. Top-level keys present in all 32: `id, name_fr, name_en, family, size, description, dimensions_m, coordinate_system, surfaces, rt60_s, zones, gear_positions, power_points, patch_points, openings, lighting, procedural, licensed_dressing, sources, review, not_found_log`; `conflicts` in 4 (interpretation-booth-small, podcast-room-small, post-atmos-mix-room-medium, tv-studio-plateau-large).

`gear_positions[]` entry (schema requires `equipment_id, zone, position_m`): `{ equipment_id, zone, position_m: [x, y, z] (metres), rotation_deg (yaw, 0 = front facing +z), note }`. Coordinate system (template field `coordinate_system`): origin = floor centre, x right, y up, z toward the audience/listener.

### 2.2 What `sync-rooms.ts` drops (precise)
`KEEP = ['id','name_fr','name_en','family','size','review','dimensions_m','zones','openings','procedural','lighting']` (line 17). Therefore dropped:

| Level | Dropped field | In how many templates |
|---|---|---|
| top level | `gear_positions` | 32 (350 positions) |
| top level | `licensed_dressing` (ids of KB 3D props, see §4.3) | 32 (44 distinct ids, all resolve to a file in `knowledge-base/3d-models/`) |
| top level | `power_points`, `patch_points` | 32 |
| top level | `description`, `coordinate_system`, `surfaces`, `rt60_s` | 32 |
| top level | `sources` (replaced by the integer `source_count`), `not_found_log` | 32 |
| top level | `conflicts` | 4 |
| `zones[]` | `note` (only `id, kind, rect_m, floor_y_m` kept, lines 25-27) | zones with a note in 6 templates |
| `openings[]` | `note` (only `wall, kind, offset_m, width_m, height_m` kept, lines 28-34) | openings with a note in 10 templates |

Second, independent filter: the slim object goes through `RoomFile.safeParse` (`src/explore/roomSchema.ts`) and `parsed.data` is what gets written (line 42). `RoomFile` is a plain `z.object` with no `gear_positions` key, and zod's default for `z.object` is to strip unknown keys. So adding `gear_positions` to `KEEP` alone would still drop it; the schema needs the field too (inference from zod default behaviour, not run).

### 2.3 How gear positions refer to devices
- They use **specific product ids** (e.g. `shure-sm7b`, `rode-psa1-plus`, `neumann-kh-120-ii`), not generic categories. No id looks generic (`generic`, `cat-`, `placeholder`: 0 hits).
- The id space is the KB equipment database: 348 / 350 positions resolve to an `id` in `knowledge-base/equipment/*.json` (357 ids). The 2 others are `playout-pc` (a role-based generic device that exists only in `content/catalog.json`; `knowledge-base/equipment/tekpractice-mapping.md` §1 says so).
- Against the game catalog (24 devices): 77 / 350 positions (22.0 %), 18 / 148 distinct ids (12.2 %). Catalog ids used, with position counts: `genelec-8030c` 22, `shure-sm58` 9, `yamaha-rio3224-d2` 7, `ev-re20` 7, `km-210-9` 4, `neumann-u87-ai` 4, `yamaha-dbr12` 4, `qsc-k12-2` 4, `shure-sm57` 3, `yamaha-ql1` 2, `yellowtec-mika` 2, `playout-pc` 2, `yellowtec-litt` 2, `ev-re50` 1, `avid-hd-io` 1, `grace-m905` 1, `antelope-ocx-hd` 1, `axia-iq` 1. Catalog devices never used in any template: `aeta-scoop5-s`, `aeta-scoopy-plus-s`, `avid-protools-hdx`, `focusrite-isa-one`, `switchcraft-studiopatch-9625`, `mogami-gold-db25-xlrm`.
- Consequence for "Avec le matériel du modèle": with today's catalog only 22 % of template gear can spawn as a real catalog device; the other 78 % (130 distinct KB ids) would need either catalog entries or a placeholder box (CLAUDE.md: "modèle manquant → placeholder boîte"), which a placeholder can show but cannot patch (no ports).

## 3. Environment presets (`tekpractice-sim/content/environments/`)

Loaded in `src/game.ts` (lines 119-140, `loadEnvironment`), set `.glb` fetched from `assets/environments/` (line 255). Design in ADR-0009 (`docs/adr/0009-room-backdrops.md`): set is optional, load failure falls back to the white studio.

| preset id | name | backdrop floorSize (m) | `set.glb` | used by level |
|---|---|---|---|---|
| `blanc` | Studio blanc | 24 × 14 | none | none (sandbox fallback) |
| `plateau` | Plateau / scene live | 24 × 14 | `live-stage.glb` (position y = -1.05, z = 2.5) | a1 |
| `plein-air` | Plein-air / concert | 30 × 20 | none | none |
| `radio` | Studio radio (self-op) | 16 × 10 | `radio-booth.glb` | b1, c1 |
| `reportage` | Reportage extérieur (ENG) | 10 × 8 | none | none |
| `studio` | Studio son / post-production | 18 × 12 | none (ADR-0009: "AUCUN candidat réaliste CC0/CC-BY") | d1 |
| `theatre` | Théâtre | 20 × 16 | `theatre-stage.glb` | none |

| path | size | provenance / licence | used by preset | web-usable |
|---|---|---|---|---|
| `tekpractice-sim/public/assets/environments/live-stage.glb` | 661 KiB | CC Attribution, Sketchfab, "Music_concert_stage_Low_poly" by Sameer.Uddin, modified (manifest `environments[]`, https://sketchfab.com/3d-models/music-concert-stage-low-poly-89629aceff334b34a76c30d42f8327bd) | `plateau` (level a1) | yes: glb, ≤ 25 MiB; attribution required |
| `tekpractice-sim/public/assets/environments/radio-booth.glb` | 971 KiB | CC Attribution, Sketchfab, "AB Radio Studio" by Amasah Blankson, modified (manifest `environments[]`, https://sketchfab.com/3d-models/ab-radio-studio-44a60d726b194b1e87614d7bcedcb074) | `radio` (levels b1, c1) | yes: glb, ≤ 25 MiB; attribution required |
| `tekpractice-sim/public/assets/environments/theatre-stage.glb` | 376 KiB | CC Attribution, Sketchfab, "Theatre stage" by mynameismary, modified (manifest `environments[]`, https://sketchfab.com/3d-models/theatre-stage-5c53624a0a334242ad04d7a11a2dcf8e) | `theatre` (no level) | yes: glb, ≤ 25 MiB; attribution required |

## 4. Every 3D file and room/design JSON

### 4.1 Search scope and result
- Worktree `C:\Users\brro\dev\Tekonest-wt\creative`, recursive, excluding `node_modules`, `.git`, `dist*`: 217 files, all `.glb`. No `.gltf`, `.fbx`, `.obj`, `.blend` or `.usdz` anywhere.
- Branches checked with `git ls-tree -r`: `main`, `design/tekonest-umbrella-brand`, `feature/tekpractice-creative-mode`, `feature/tekpractice-designer-nav`, `feature/tekpractice-explore-controls`, `research/fohhn-benchmark`, `research/sound-equipment-database`, `research/tekbrain`, `origin/docs/tekonest-brand-foundation`, `origin/main`. Every 3D blob on those branches is already on this branch. The only extra paths are build copies on `design/tekonest-umbrella-brand` under `website-prototype/tekpractice/jouer/assets/` (50 + 3 `.glb`, same blobs, deploy commit `52d1fba`, 2026-10-24). `research/sound-equipment-database` has an older 20-file subset of `knowledge-base/3d-models`.
- Provenance files found: `tekpractice-sim/ASSET_LOG.md`, `tekpractice-sim/public/assets/ASSET_MANIFEST.json` (50 `assets[]` + 3 `environments[]`), `knowledge-base/3d-models/CREDITS.md` (merged with `candidates/*.CREDITS.md`), `knowledge-base/3d-models/downloads.json`, `archive/teknest*/ASSET_LOG.md` + `ASSET_MANIFEST.json`. No `LICENSE` file covers the 3D assets.

### 4.2 Game device and connector models (`tekpractice-sim/public/assets/`, 50 files, 3.15 MiB)
All 24 catalog devices have a `.glb` (id = file name); the 26 others are connector models (not used by the v1 runtime per ASSET_LOG Run 3). Manifest `source`: 18 `download-ccby` (Creative Commons Attribution, Sketchfab, modified), 5 `modeled` (internal own work), 27 without a `source` field. Thumbnails: 50 files in `public/assets/thumbs/`.

| path | size | provenance / licence (source) | web-usable |
|---|---|---|---|
| `tekpractice-sim/public/assets/aeta-scoop5-s.glb` | 118 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/audio-interface-iem-transmitter-50ea58413e214a50b16e5bc726291190) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/aeta-scoopy-plus-s.glb` | 247 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/zoom-h6-handy-recorder-ef5389ec84b248e389c5a70097454159) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/antelope-ocx-hd.glb` | 259 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/alesis-midiverb-iii-8e96f1582bfa476fb87655d91e66a25c) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/avid-hd-io.glb` | 259 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/alesis-midiverb-iii-8e96f1582bfa476fb87655d91e66a25c) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/avid-protools-hdx.glb` | 19 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/computer-tower-ofice-pc-a55286be3fd54058b913d10b935c249e) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/axia-iq.glb` | 372 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/8-channel-audio-mixer-e28440b16df348dbaffbc7f20d7cb8bf) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/bnc.glb` | 12 KiB | no `source` field in manifest (kind: connector, 224 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/digilink.glb` | 3 KiB | no `source` field in manifest (kind: connector, 24 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/dsub25.glb` | 3 KiB | no `source` field in manifest (kind: connector, 24 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/ethercon.glb` | 8 KiB | no `source` field in manifest (kind: connector, 116 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/ev-re20.glb` | 58 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/shure-sm7b-microphone-blender-932fa222f4b14538828cac6da5747eec) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/ev-re50.glb` | 4 KiB | internal (own work), modeled in Blender (manifest) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/focusrite-isa-one.glb` | 257 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/tl-audio-fat-2-valve-preamp-compressor-a6b5c0e1bb9a4a3eba04bbaa66a2f3cb) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/genelec-8030c.glb` | 157 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/genelec-8340a-raw-ce1bff22430e45bf8e3cc2e4f353f4d9) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/gpio-terminal.glb` | 8 KiB | no `source` field in manifest (kind: connector, 124 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/grace-m905.glb` | 119 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/headphone-amplifier-b0c9d5c992e7416786c4bb5dad416f31) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/iec-c13.glb` | 2 KiB | no `source` field in manifest (kind: connector, 12 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/iec-c14.glb` | 7 KiB | no `source` field in manifest (kind: connector, 120 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/km-210-9.glb` | 113 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/microphone-stand-with-boom-arm-legged-9bee76120cd8472b9f68db91d820f5ff) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/mogami-gold-db25-xlrm.glb` | 3 KiB | internal (own work), modeled in Blender (manifest) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/neumann-u87-ai.glb` | 176 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/u87-0f0e14eee8fb4f56a9826bae9b061c55) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/playout-pc.glb` | 19 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/computer-tower-ofice-pc-a55286be3fd54058b913d10b935c249e) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/powercon-blue.glb` | 12 KiB | no `source` field in manifest (kind: connector, 208 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/powercon-true1.glb` | 12 KiB | no `source` field in manifest (kind: connector, 208 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/qsc-k12-2.glb` | 36 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/qsc-k122-42ddb9057e8647dd831e065106630d28) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/rca.glb` | 10 KiB | no `source` field in manifest (kind: connector, 196 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/rj45.glb` | 3 KiB | no `source` field in manifest (kind: connector, 24 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/schuko-plug.glb` | 11 KiB | no `source` field in manifest (kind: connector, 192 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/schuko-socket.glb` | 5 KiB | no `source` field in manifest (kind: connector, 92 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/shure-sm57.glb` | 174 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/sm57-68a4fa6898b14f07b3ee9f56b342f469) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/shure-sm58.glb` | 265 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/shure-sm58-89d38b9c53f8496a922ce1199ca57afc) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/speakon-nl4.glb` | 12 KiB | no `source` field in manifest (kind: connector, 208 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/switchcraft-studiopatch-9625.glb` | 3 KiB | internal (own work), modeled in Blender (manifest) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/toslink.glb` | 3 KiB | no `source` field in manifest (kind: connector, 24 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/trs-35mm.glb` | 19 KiB | no `source` field in manifest (kind: connector, 320 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/trs-quarter.glb` | 19 KiB | no `source` field in manifest (kind: connector, 320 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/ts-quarter.glb` | 19 KiB | no `source` field in manifest (kind: connector, 320 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/tt-bantam.glb` | 19 KiB | no `source` field in manifest (kind: connector, 320 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/usb-a.glb` | 3 KiB | no `source` field in manifest (kind: connector, 24 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/usb-b.glb` | 3 KiB | no `source` field in manifest (kind: connector, 24 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/usb-c.glb` | 3 KiB | no `source` field in manifest (kind: connector, 24 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/xlr3-f.glb` | 10 KiB | no `source` field in manifest (kind: connector, 184 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/xlr3-m.glb` | 15 KiB | no `source` field in manifest (kind: connector, 292 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/xlr5-f.glb` | 10 KiB | no `source` field in manifest (kind: connector, 184 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/xlr5-m.glb` | 18 KiB | no `source` field in manifest (kind: connector, 364 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/yamaha-dbr12.glb` | 154 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/stage-monitor-speaker-be94233262e24cbfa3723b607567afac) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/yamaha-ql1.glb` | 5 KiB | internal (own work), modeled in Blender (manifest) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/yamaha-rio3224-d2.glb` | 2 KiB | internal (own work), modeled in Blender (manifest) | yes: glb, ≤ 25 MiB |
| `tekpractice-sim/public/assets/yellowtec-litt.glb` | 144 KiB | CC Attribution, Sketchfab download, modified (manifest sourceUrl: https://sketchfab.com/3d-models/warning-light-3df0b1fc0e0a445c8edcaddf3dd6ceb5) | yes: glb, ≤ 25 MiB; attribution text in manifest |
| `tekpractice-sim/public/assets/yellowtec-mika.glb` | 15 KiB | no `source` field in manifest (kind: device, 292 tris); ASSET_LOG Run 2: generated by `gen_asset.py` in headless Blender, so own work (inference) | yes: glb, ≤ 25 MiB |

### 4.3 Environment sets
See the table at the end of §3.

### 4.4 Knowledge-base 3D models (`knowledge-base/3d-models/`, 64 files, 26.23 MiB)
Downloaded 2026-10-22 and re-packed with gltf-transform (CREDITS.md). All 64 appear in `CREDITS.md`: 38 CC0, 13 CC-BY 3.0, 13 CC-BY 4.0. They are props and dressing (furniture, people, instruments, truss, generic speakers/mics), not catalog devices; 44 of them are referenced by templates' `licensed_dressing`, which sync-rooms drops. None is copied to `tekpractice-sim/public/` yet.

| path | size | licence (`knowledge-base/3d-models/CREDITS.md`) | in room `licensed_dressing` | web-usable |
|---|---|---|---|---|
| `knowledge-base/3d-models/objv-battery-guitar-amp-camilote.glb` | 53 KiB | CC-BY 4.0 (Objaverse mirror of Sketchfab) | 1 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/objv-dj-table-lowpoly.glb` | 67 KiB | CC-BY 4.0 (Objaverse mirror of Sketchfab) | 2 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/objv-guitar-amp-futaba.glb` | 980 KiB | CC-BY 4.0 (Objaverse mirror of Sketchfab) | 2 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/objv-guitar-combo-amp-lowpoly.glb` | 204 KiB | CC-BY 4.0 (Objaverse mirror of Sketchfab) | 2 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/objv-hifi-sound-system.glb` | 221 KiB | CC-BY 4.0 (Objaverse mirror of Sketchfab) | 2 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/objv-home-stereo-speakers.glb` | 201 KiB | CC-BY 4.0 (Objaverse mirror of Sketchfab) | 2 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/objv-mid-century-microphone.glb` | 551 KiB | CC-BY 4.0 (Objaverse mirror of Sketchfab) | 2 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/objv-on-air-desk-microphone.glb` | 584 KiB | CC-BY 4.0 (Objaverse mirror of Sketchfab) | 2 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/objv-speaker-cabinet-rusov.glb` | 310 KiB | CC-BY 4.0 (Objaverse mirror of Sketchfab) | 2 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/objv-stage-monitor-wedge-saandy.glb` | 256 KiB | CC-BY 4.0 (Objaverse mirror of Sketchfab) | 3 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/objv-trs-jack-adapter.glb` | 171 KiB | CC-BY 4.0 (Objaverse mirror of Sketchfab) | 2 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/objv-usb-podcast-mic-generic.glb` | 90 KiB | CC-BY 4.0 (Objaverse mirror of Sketchfab) | 2 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/objv-vintage-microphone-klasy.glb` | 227 KiB | CC-BY 4.0 (Objaverse mirror of Sketchfab) | 2 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/ph-hand-truck.glb` | 524 KiB | CC0 (Poly Haven) | 12 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/ph-mid-century-lounge-chair.glb` | 265 KiB | CC0 (Poly Haven) | 10 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/ph-modern-ceiling-lamp-01.glb` | 138 KiB | CC0 (Poly Haven) | 10 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/ph-modern-coffee-table-01.glb` | 145 KiB | CC0 (Poly Haven) | 11 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/ph-plastic-crate-02.glb` | 219 KiB | CC0 (Poly Haven) | 9 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/ph-potted-plant-04.glb` | 368 KiB | CC0 (Poly Haven) | 13 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/ph-school-chair-01.glb` | 191 KiB | CC0 (Poly Haven) | 4 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/ph-school-desk-01.glb` | 116 KiB | CC0 (Poly Haven) | 2 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/ph-side-table-01.glb` | 170 KiB | CC0 (Poly Haven) | 10 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/ph-steel-frame-shelves-03.glb` | 367 KiB | CC0 (Poly Haven) | 10 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/ph-wooden-ladder-02.glb` | 327 KiB | CC0 (Poly Haven) | 11 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/polyhaven-desk-lamp-arm.glb` | 2.74 MiB | CC0 (Poly Haven) | - | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/polyhaven-metal-office-desk.glb` | 1.53 MiB | CC0 (Poly Haven) | - | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/polyhaven-metal-stool.glb` | 2.18 MiB | CC0 (Poly Haven) | - | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/polyhaven-modern-arm-chair.glb` | 2.57 MiB | CC0 (Poly Haven) | - | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/polyhaven-mounted-fluorescent-lights.glb` | 1.77 MiB | CC0 (Poly Haven) | - | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/polyhaven-worn-metal-rack.glb` | 1.92 MiB | CC0 (Poly Haven) | - | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/polypizza-bass-speakers.glb` | 21 KiB | CC-BY 3.0 (Poly Pizza) | - | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/polypizza-cable-long.glb` | 15 KiB | CC0 (Poly Pizza) | - | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/polypizza-guitar-amp.glb` | 173 KiB | CC-BY 3.0 (Poly Pizza) | - | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/polypizza-headphones.glb` | 41 KiB | CC0 (Poly Pizza) | - | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/polypizza-laptop.glb` | 12 KiB | CC0 (Poly Pizza) | - | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/polypizza-mic.glb` | 60 KiB | CC0 (Poly Pizza) | - | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/polypizza-microphone-lowpoly.glb` | 647 KiB | CC-BY 3.0 (Poly Pizza) | - | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/polypizza-mixing-desk.glb` | 864 KiB | CC-BY 3.0 (Poly Pizza) | - | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/polypizza-motorised-spotlight.glb` | 40 KiB | CC0 (Poly Pizza) | - | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/polypizza-radio.glb` | 48 KiB | CC0 (Poly Pizza) | - | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/polypizza-rolling-speaker-stand.glb` | 124 KiB | CC-BY 3.0 (Poly Pizza) | - | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/polypizza-speaker.glb` | 35 KiB | CC0 (Poly Pizza) | - | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/polypizza-stage.glb` | 418 KiB | CC0 (Poly Pizza) | - | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/polypizza-theater-spotlight.glb` | 81 KiB | CC0 (Poly Pizza) | - | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/pp-acoustic-guitar.glb` | 6 KiB | CC-BY 3.0 (Poly Pizza) | 6 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/pp-apelab-crowd.glb` | 108 KiB | CC-BY 3.0 (Poly Pizza) | 11 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/pp-dry-erase-board.glb` | 2 KiB | CC-BY 3.0 (Poly Pizza) | 3 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/pp-grand-piano.glb` | 8 KiB | CC-BY 3.0 (Poly Pizza) | 3 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/pp-kenney-desk-chair.glb` | 5 KiB | CC0 (Poly Pizza) | 10 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/pp-kenney-lounge-sofa.glb` | 4 KiB | CC0 (Poly Pizza) | 10 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/pp-quaternius-barrier-large.glb` | 40 KiB | CC0 (Poly Pizza) | 4 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/pp-quaternius-man.glb` | 267 KiB | CC0 (Poly Pizza) | 14 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/pp-quaternius-pallet.glb` | 2 KiB | CC0 (Poly Pizza) | 9 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/pp-quaternius-woman-casual.glb` | 272 KiB | CC0 (Poly Pizza) | 14 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/pp-simple-truss.glb` | 3 KiB | CC-BY 3.0 (Poly Pizza) | 13 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/pp-stage-keyboard.glb` | 53 KiB | CC-BY 3.0 (Poly Pizza) | 7 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/pp-theatre-seat.glb` | 5 KiB | CC-BY 3.0 (Poly Pizza) | 5 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/pp-zsky-drum-set.glb` | 17 KiB | CC-BY 3.0 (Poly Pizza) | 6 room(s) | yes: glb, ≤ 25 MiB; attribution required; not in `public/` yet |
| `knowledge-base/3d-models/si-chester-telegraph-relay.glb` | 687 KiB | CC0 (Smithsonian Open Access) | 2 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/si-cowbell-nmah.glb` | 477 KiB | CC0 (Smithsonian Open Access) | 2 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/si-henry-trough-battery.glb` | 555 KiB | CC0 (Smithsonian Open Access) | 2 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/si-morse-vail-telegraph-key.glb` | 546 KiB | CC0 (Smithsonian Open Access) | 2 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/si-page-induction-coil.glb` | 767 KiB | CC0 (Smithsonian Open Access) | 2 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |
| `knowledge-base/3d-models/si-tangent-galvanometer.glb` | 711 KiB | CC0 (Smithsonian Open Access) | 2 room(s) | yes: glb, ≤ 25 MiB; not in `public/` yet |

### 4.5 Archive copies (`archive/teknest/` and `archive/teknest-simu/`, 2 × 50 files, 0.49 MiB each)
Older Run-2 versions of the 50 game models (`ASSET_MANIFEST.json` generated 2026-07-15 07:07, no `source` fields). The two folders are byte-identical (spot check `shure-sm58.glb` with `fc /b`; same total size). Web-usable as files, but superseded by `tekpractice-sim/public/assets/`; do not ship.

<details><summary>100 archive files</summary>

| path | size |
|---|---|
| `archive/teknest/public/assets/aeta-scoop5-s.glb` | 8 KiB |
| `archive/teknest/public/assets/aeta-scoopy-plus-s.glb` | 8 KiB |
| `archive/teknest/public/assets/antelope-ocx-hd.glb` | 8 KiB |
| `archive/teknest/public/assets/avid-hd-io.glb` | 2 KiB |
| `archive/teknest/public/assets/avid-protools-hdx.glb` | 3 KiB |
| `archive/teknest/public/assets/axia-iq.glb` | 10 KiB |
| `archive/teknest/public/assets/bnc.glb` | 12 KiB |
| `archive/teknest/public/assets/digilink.glb` | 3 KiB |
| `archive/teknest/public/assets/dsub25.glb` | 3 KiB |
| `archive/teknest/public/assets/ethercon.glb` | 8 KiB |
| `archive/teknest/public/assets/ev-re20.glb` | 18 KiB |
| `archive/teknest/public/assets/ev-re50.glb` | 18 KiB |
| `archive/teknest/public/assets/focusrite-isa-one.glb` | 8 KiB |
| `archive/teknest/public/assets/genelec-8030c.glb` | 10 KiB |
| `archive/teknest/public/assets/gpio-terminal.glb` | 8 KiB |
| `archive/teknest/public/assets/grace-m905.glb` | 8 KiB |
| `archive/teknest/public/assets/iec-c13.glb` | 2 KiB |
| `archive/teknest/public/assets/iec-c14.glb` | 7 KiB |
| `archive/teknest/public/assets/km-210-9.glb` | 15 KiB |
| `archive/teknest/public/assets/mogami-gold-db25-xlrm.glb` | 13 KiB |
| `archive/teknest/public/assets/neumann-u87-ai.glb` | 18 KiB |
| `archive/teknest/public/assets/playout-pc.glb` | 3 KiB |
| `archive/teknest/public/assets/powercon-blue.glb` | 12 KiB |
| `archive/teknest/public/assets/powercon-true1.glb` | 12 KiB |
| `archive/teknest/public/assets/qsc-k12-2.glb` | 10 KiB |
| `archive/teknest/public/assets/rca.glb` | 10 KiB |
| `archive/teknest/public/assets/rj45.glb` | 3 KiB |
| `archive/teknest/public/assets/schuko-plug.glb` | 11 KiB |
| `archive/teknest/public/assets/schuko-socket.glb` | 5 KiB |
| `archive/teknest/public/assets/shure-sm57.glb` | 18 KiB |
| `archive/teknest/public/assets/shure-sm58.glb` | 18 KiB |
| `archive/teknest/public/assets/speakon-nl4.glb` | 12 KiB |
| `archive/teknest/public/assets/switchcraft-studiopatch-9625.glb` | 8 KiB |
| `archive/teknest/public/assets/toslink.glb` | 3 KiB |
| `archive/teknest/public/assets/trs-35mm.glb` | 19 KiB |
| `archive/teknest/public/assets/trs-quarter.glb` | 19 KiB |
| `archive/teknest/public/assets/ts-quarter.glb` | 19 KiB |
| `archive/teknest/public/assets/tt-bantam.glb` | 19 KiB |
| `archive/teknest/public/assets/usb-a.glb` | 3 KiB |
| `archive/teknest/public/assets/usb-b.glb` | 3 KiB |
| `archive/teknest/public/assets/usb-c.glb` | 3 KiB |
| `archive/teknest/public/assets/xlr3-f.glb` | 10 KiB |
| `archive/teknest/public/assets/xlr3-m.glb` | 15 KiB |
| `archive/teknest/public/assets/xlr5-f.glb` | 10 KiB |
| `archive/teknest/public/assets/xlr5-m.glb` | 18 KiB |
| `archive/teknest/public/assets/yamaha-dbr12.glb` | 10 KiB |
| `archive/teknest/public/assets/yamaha-ql1.glb` | 10 KiB |
| `archive/teknest/public/assets/yamaha-rio3224-d2.glb` | 2 KiB |
| `archive/teknest/public/assets/yellowtec-litt.glb` | 10 KiB |
| `archive/teknest/public/assets/yellowtec-mika.glb` | 15 KiB |
| `archive/teknest-simu/public/assets/aeta-scoop5-s.glb` | 8 KiB |
| `archive/teknest-simu/public/assets/aeta-scoopy-plus-s.glb` | 8 KiB |
| `archive/teknest-simu/public/assets/antelope-ocx-hd.glb` | 8 KiB |
| `archive/teknest-simu/public/assets/avid-hd-io.glb` | 2 KiB |
| `archive/teknest-simu/public/assets/avid-protools-hdx.glb` | 3 KiB |
| `archive/teknest-simu/public/assets/axia-iq.glb` | 10 KiB |
| `archive/teknest-simu/public/assets/bnc.glb` | 12 KiB |
| `archive/teknest-simu/public/assets/digilink.glb` | 3 KiB |
| `archive/teknest-simu/public/assets/dsub25.glb` | 3 KiB |
| `archive/teknest-simu/public/assets/ethercon.glb` | 8 KiB |
| `archive/teknest-simu/public/assets/ev-re20.glb` | 18 KiB |
| `archive/teknest-simu/public/assets/ev-re50.glb` | 18 KiB |
| `archive/teknest-simu/public/assets/focusrite-isa-one.glb` | 8 KiB |
| `archive/teknest-simu/public/assets/genelec-8030c.glb` | 10 KiB |
| `archive/teknest-simu/public/assets/gpio-terminal.glb` | 8 KiB |
| `archive/teknest-simu/public/assets/grace-m905.glb` | 8 KiB |
| `archive/teknest-simu/public/assets/iec-c13.glb` | 2 KiB |
| `archive/teknest-simu/public/assets/iec-c14.glb` | 7 KiB |
| `archive/teknest-simu/public/assets/km-210-9.glb` | 15 KiB |
| `archive/teknest-simu/public/assets/mogami-gold-db25-xlrm.glb` | 13 KiB |
| `archive/teknest-simu/public/assets/neumann-u87-ai.glb` | 18 KiB |
| `archive/teknest-simu/public/assets/playout-pc.glb` | 3 KiB |
| `archive/teknest-simu/public/assets/powercon-blue.glb` | 12 KiB |
| `archive/teknest-simu/public/assets/powercon-true1.glb` | 12 KiB |
| `archive/teknest-simu/public/assets/qsc-k12-2.glb` | 10 KiB |
| `archive/teknest-simu/public/assets/rca.glb` | 10 KiB |
| `archive/teknest-simu/public/assets/rj45.glb` | 3 KiB |
| `archive/teknest-simu/public/assets/schuko-plug.glb` | 11 KiB |
| `archive/teknest-simu/public/assets/schuko-socket.glb` | 5 KiB |
| `archive/teknest-simu/public/assets/shure-sm57.glb` | 18 KiB |
| `archive/teknest-simu/public/assets/shure-sm58.glb` | 18 KiB |
| `archive/teknest-simu/public/assets/speakon-nl4.glb` | 12 KiB |
| `archive/teknest-simu/public/assets/switchcraft-studiopatch-9625.glb` | 8 KiB |
| `archive/teknest-simu/public/assets/toslink.glb` | 3 KiB |
| `archive/teknest-simu/public/assets/trs-35mm.glb` | 19 KiB |
| `archive/teknest-simu/public/assets/trs-quarter.glb` | 19 KiB |
| `archive/teknest-simu/public/assets/ts-quarter.glb` | 19 KiB |
| `archive/teknest-simu/public/assets/tt-bantam.glb` | 19 KiB |
| `archive/teknest-simu/public/assets/usb-a.glb` | 3 KiB |
| `archive/teknest-simu/public/assets/usb-b.glb` | 3 KiB |
| `archive/teknest-simu/public/assets/usb-c.glb` | 3 KiB |
| `archive/teknest-simu/public/assets/xlr3-f.glb` | 10 KiB |
| `archive/teknest-simu/public/assets/xlr3-m.glb` | 15 KiB |
| `archive/teknest-simu/public/assets/xlr5-f.glb` | 10 KiB |
| `archive/teknest-simu/public/assets/xlr5-m.glb` | 18 KiB |
| `archive/teknest-simu/public/assets/yamaha-dbr12.glb` | 10 KiB |
| `archive/teknest-simu/public/assets/yamaha-ql1.glb` | 10 KiB |
| `archive/teknest-simu/public/assets/yamaha-rio3224-d2.glb` | 2 KiB |
| `archive/teknest-simu/public/assets/yellowtec-litt.glb` | 10 KiB |
| `archive/teknest-simu/public/assets/yellowtec-mika.glb` | 15 KiB |
</details>

### 4.6 Room and design JSON outside `content/rooms` and `tek-brain/rooms`
| path | what | usable for the start screen |
|---|---|---|
| `knowledge-base/schema/room.schema.json` | JSON Schema of the TEK Brain templates | reference for the sync fix |
| `tekpractice-sim/content/levels/drafts/*.json` (16 files, 15 with `room_id`) | draft levels; `room_id` points to 11 of the 32 rooms (e.g. `bar-club-stage-small` ×4) | later ("missions" in Mode Création) |
| `knowledge-base/3d-models/candidates/models-sketchfab-venues.json` | 232 candidate links, not downloaded: 116 `room`, 36 `venue`, 75 `prop`, 4 `character`, 1 `device`; licences 223 CC-BY, 5 CC-BY-SA, 2 NC (excluded), 1 "Free Standard", 1 CC0; room candidates cover 26 of 32 room ids | only after download, licence re-check and size budget (first candidate is 5 M faces) |
| `knowledge-base/3d-models/candidates/models-sketchfab-props.json`, `models-cc0-libraries.json`, `models-open-access-cad.json` (+ `.downloads.json`) | candidate lists behind the 64 downloaded files | no (lists) |
| `content/environments/*.json` | the 7 presets (§3) | yes |

## 5. Recommendation for the start screen

1. **Cards = the 32 procedural rooms** from `content/rooms/index.json` (id, `name_fr`, `family` as type, `size`), with typical L × W × H from the room file. They need no download and already load through `?room=<id>`. Thumbnails must be generated (none exist for rooms; only device thumbs exist).
2. **Keep the 3 `.glb` sets as extra cards** ("Plateau live", "Studio radio", "Théâtre": environment presets `plateau`, `radio`, `theatre`) because they are the only realistic, already-licensed venue models, and `blanc` as "Salle vide neutre". `plein-air`, `reportage`, `studio` are colour backdrops only; the procedural `festival-open-air-large`, `eng-outdoor-reportage` and `studio-control-room-small` cover the same places better.
3. **"Avec le matériel du modèle"**: all 32 templates carry gear (5-15 positions each), but only 27 have at least one catalog device, and only 22 % of positions overall map to catalog. Suggested first cards with the badge (highest catalog share): `radio-talk-studio-medium` (9/14), `radio-studio-self-op-small` (8/11), `wedding-event-hall-medium` (6/10), `museum-installed-sound-medium` (4/9), `post-atmos-mix-room-medium` (4/15). The others should be "Salle vide" until gear outside the catalog is handled (placeholder boxes without ports, or catalog proposals).
4. **Missing**:
   - The sync fix: add `gear_positions` (and probably `coordinate_system`, `licensed_dressing`, `power_points`, `patch_points`) to both `KEEP` and `RoomFile`; decide what to do with the 273 positions whose id is not in the catalog.
   - The reference case of the brief (QL1 + SM58 + 2 active speakers) exists in no single template: `yamaha-ql1` appears in 2 templates only (`festival-open-air-large`, `sports-venue-pa-large`), and neither has an SM58 or a catalog active speaker (DBR12 / K12.2). Offer the reference case as an empty room plus inventory, or as a hand-made starter layout.
   - Room thumbnails (headless build step), any realistic `.glb` for the 29 rooms without a set, and dressing: the 44 `licensed_dressing` props are on disk under `knowledge-base/` but not copied to `public/`, and CC-BY items need an in-game credits screen.
   - No licence file or `ASSET_LOG` entry for the 27 manifest entries without `source` (connectors + `yellowtec-mika`).

## A. Source list
| # | Path | Date |
|---|---|---|
| S1 | `tekpractice-sim/docs/plans/2026-10-24-creative-mode-brief.md` §2 | 2026-10-24 |
| S2 | `tekpractice-sim/tools/sync-rooms.ts` | commit 29bf9de, 2026-10-22 |
| S3 | `tekpractice-sim/src/explore/roomSchema.ts` | read 2026-10-24 |
| S4 | `knowledge-base/tek-brain/rooms/*.json` (32) | 2026-10-22 |
| S5 | `tekpractice-sim/content/rooms/*.json` (33) | 2026-10-22 |
| S6 | `tekpractice-sim/content/catalog.json` (24 devices) | read 2026-10-24 |
| S7 | `knowledge-base/equipment/*.json`, `tekpractice-mapping.md` | read 2026-10-24 |
| S8 | `tekpractice-sim/content/environments/*.json`, `src/game.ts`, `docs/adr/0009-room-backdrops.md` | 2026-07-18 (ADR) |
| S9 | `tekpractice-sim/public/assets/ASSET_MANIFEST.json`, `tekpractice-sim/ASSET_LOG.md` | 2026-07-15/16 |
| S10 | `knowledge-base/3d-models/CREDITS.md`, `candidates/*.json` | 2026-10-22 |
| S11 | `knowledge-base/schema/room.schema.json` | read 2026-10-24 |
| S12 | `git ls-tree -r` on 10 branch refs | 2026-10-24 |

## B. Evidence register
| ID | Claim | Source | Type |
|---|---|---|---|
| E1 | 32 templates, 32 synced rooms with identical ids, + index.json | S4, S5 | implementation fact (code present) |
| E2 | 350 gear positions, 148 distinct ids | S4 | implementation fact (counted) |
| E3 | 77/350 positions (22.0 %) and 18/148 ids (12.2 %) are catalog ids | S4, S6 | implementation fact (counted) |
| E4 | 348/350 positions resolve to KB equipment ids; 2 = `playout-pc` | S4, S7 | implementation fact (counted) |
| E5 | sync-rooms drops gear_positions, licensed_dressing, power/patch points, description, coordinate_system, surfaces, rt60_s, sources (→ source_count), not_found_log, conflicts, zone/opening notes | S2 line 17, 25-35 | implementation fact (code present) |
| E6 | `RoomFile` would also strip `gear_positions` (zod default strip) | S3, S2 line 36-42 | inference |
| E7 | 7 environment presets, 3 with `set.glb` | S8 | implementation fact (code present) |
| E8 | 217 `.glb`, no other 3D format, none over 25 MiB | walk of worktree | implementation fact (counted) |
| E9 | No 3D blob on another branch is missing from this branch | S12 | implementation fact (blob hashes compared) |
| E10 | 64 KB models all listed in CREDITS.md (38 CC0 / 13 CC-BY 3.0 / 13 CC-BY 4.0) | S10 | implementation fact (counted) |
| E11 | 27 game models have no `source` in the manifest; ASSET_LOG Run 2 says all 50 were generated by gen_asset.py | S9 | inference for those 27 |
| E12 | All 44 `licensed_dressing` ids resolve to a KB `.glb` | S4, S10 | implementation fact (counted) |

## C. Links to other services
Sketchfab, Poly Haven, Poly Pizza, Smithsonian Open Access and the Objaverse mirror on Hugging Face are named as sources in S9/S10. None was contacted during this audit; licences are as recorded in the repo files.

## D. Conflicts
- D1. Brief §2 (2026-10-24): "7 environment presets with `.glb` sets". Repo: 7 presets, only 3 with a `.glb` (S8). ADR-0009 (2026-07-18) explains why studio has none.
- D2. Brief §2 lists "32 rooms in `content/rooms/`" and "TEK Brain room templates" as two sets. Repo: they are the same 32 rooms; `content/rooms` is the slim copy (S2, S5).
- D3. `ev-re20.glb` is recorded as an SM7B mesh (`tekpractice-mapping.md`), so the model does not match the device.

## E. Not inspected
- Visual quality, polygon counts and scale of the 64 KB models and the 3 sets (no rendering done).
- Licence pages online (repo records trusted as written).
- Whether `RoomBuilder` behaves correctly for very large rooms (`sports-venue-pa-large` 200 × 160 × 46 m); game not run.
- `knowledge-base/3d-models/downloads.json` per-file details, beyond the CREDITS match.

## F. Plain-language summary
There are 32 places, and they exist twice: as rich TEK Brain fiches (with 350 gear positions, sources and prop lists) and as slim game copies that keep only walls, floor zones, doors and colours. The sync script throws the gear away, and the game's room schema would throw it away again, so both need changing. Gear positions name real products from the knowledge base (99 % resolve there), but only 22 % are devices the game can actually spawn and patch today. On the 3D side everything is `.glb`, small and licensed: 50 game models, 3 realistic venue sets (live stage, radio studio, theatre), and 64 CC0/CC-BY props sitting in the knowledge base that the game does not use yet. No other branch hides extra models. For the start screen: show the 32 procedural rooms plus the 3 venue sets, mark about five radio/event rooms as "Avec le matériel du modèle", and generate thumbnails.
