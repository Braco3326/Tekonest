# Brief (Oscar, 2026-10-24): "Mode Création" only — audit like a real user, then rebuild to pro-design-tool quality

Source: founder prompt, copied verbatim in substance for subagents. Defaults in §7 are logged in `docs/CREATIVE-MODE-LOG.md`.

## 0. Expert council basis
- One "Mode Création" first, levels later.
- View cube needs **26 click zones** (6 faces, 12 edges, 8 corners), drag = orbit, generous hit areas.
- "Sound check with a song" is the heart: sound only when the chain is truly valid; each speaker audibly and visibly alive.
- Coverage dots: listener plane at ear height; per-speaker direct sound (−6 dB per doubling of distance + directivity); energetic sum; locked colour scale with legend; stats (min, max, mean, σ); click a dot to pin its value.
- Similarity to Fohhn Designer: reproduce the **interaction model and information layout** (big viewport, top menu, left project tree, right properties, nav cube top-left, colour legend, statistics); **never** Fohhn's graphics, icons, wording, code, data or brand; Tekonest design system.
- dB: default **relative dB** (0 dB = loudest point, scale to −24 dB); optional "≈ dB SPL estimé" only when every active speaker has sourced sensitivity/max SPL, labelled "estimation pédagogique"; no STI, no legal-limit claims.
- Song: ship 2–3 royalty-free/CC0 tracks + **"Choisir un fichier audio…"** (local, never uploaded or stored). Never bundle or link copyrighted songs.
- Honesty: hatched overlap zone "interférences non modélisées", "estimation" chip. Dots = thin instances computed in a Worker on change, never per frame. Target: school laptops.

## 1. Phase 0 — audit live game as a real client (no code changes)
Personas on `https://tekonest.com/tekpractice/jouer/` and local, at 1366×768 and 1920×1080:
- P1 "Oscar, technicien": Yamaha QL1 + Shure SM58 + 2 active speakers.
- P2 "étudiante BTS 1re année": first visit, no instructions.
- P3 keyboard-only + reduced-motion.
Journeys (screenshot each step): open; choose a place; inventory with Space; find/place/move a device; rotate; select + zoom-orbit; every nav-cube zone incl. corners/edges; reach every side of the structure (front, back, left, right, top, ¾); patch cables; read errors; save & reload; change place; Esc chain; FPS 10 s idle + 10 s orbit.
Compare with Fohhn Designer using local (git-ignored) Fohhn screenshots and `research/fohhn-benchmark/interface-inventory.md` §3: Fohhn does / TekPractice does / gap / severity (P0 blocks use, P1 hurts a lot, P2 polish).
Deliverables: `docs/audit/2026-10-24-creative-audit.md` (bug table: ID, persona, steps, expected, actual, screenshot, severity, suspected file); `docs/audit/screens/` (TekPractice screenshots only); `audit-for-claude.zip` at repo root (git-ignored). Then expert council Tier 3; every P0/P1 → plan task.

## 2. Phase 1 — single mode "Mode Création"
- Opens directly in Mode Création. A1, B1, C1, D1, Sandbox, Exam, onboarding, dashboard hidden not deleted: `?legacy=1` + `FEATURES.levels = false`; code+tests kept; ADR "Mode Création d'abord".
- Start screen "Choisir un lieu": cards (thumbnail, name, size, type). Inventory everything: 32 rooms in `content/rooms/`, TEK Brain room templates in `knowledge-base/tek-brain/rooms/` (350 gear positions), 7 environment presets with `.glb` sets, any other `.glb/.gltf/.fbx/.obj/.blend/.usdz` or room JSON in repo/branches → `docs/audit/assets-inventory.md` (path, size, licence/provenance, web-usable). Thumbnails generated headless at build time. Each card: "Salle vide" or "Avec le matériel du modèle" (fix: `tools/sync-rooms.ts` drops `gear_positions`). Change place without reload: scene teardown `dispose()`.
- Layout: top menu Projet · Lieu · Matériel · Câblage · Écoute · Vue · Aide; left "Projet" tree Lieu → Zones → Matériel → Câbles → Points d'écoute (click = select + fly, eye toggles); right "Propriétés" (name, x/y/z m, yaw/tilt steppers, height, mount floor/stand/flown, device controls gain/+48 V/mute/fader/EQ, connection list); viewport ≥ 60 % at 1366×768, collapsible panels; bottom status bar (selection, snapping, "Signal OK / X erreurs").
- Design: Nuit `#131114` chrome, Papier `#F3EDE3` text, Ambre `#DD9349` selection/active, Prune `#612D45`; Tektur titles, IBM Plex Sans UI, square corners; French UI with English technical terms (XLR, Dante, gain, fader).

## 3. Phase 2 — navigation
- View cube top-left ~110 px: real 3D cube via **second Babylon camera with own viewport + layer mask** (one engine, no second WebGL context); **26 pickable zones** with generous hit areas + Ambre hover; face labels Face, Arrière, Gauche, Droite, Dessus, Dessous; compass ring with 4 cardinal ticks; drag cube = orbit; ↻ ↺ rotate 90°, ⌂ home; every zone flies (tween) around the current pivot; every corner view reachable in one click. A11y: the 26 views as keyboard menu (`V` then arrows) and as buttons in **Vue**; remappable Actions by `KeyboardEvent.code`.
- Camera feel: inertia; wheel dolly to cursor; left-drag orbit, right-drag pan; click device → smooth flight, bbox centre = pivot; double-click floor → re-pivot; presets 1–3; reduced motion → cuts. No per-frame work when idle.
- Walk mode (Explore) stays available from **Vue** (ADR-0010).

## 4. Phase 3 — inventory, placement, cables
- Inventory (Space): bottom drawer, slides ≤ 200 ms, closes Space/Esc; tabs Consoles, Micros, Enceintes, Amplis, Stagebox/Dante, Câbles & DI, Pieds & accroches, Éclairage (if model); search; 3D thumbnails; drag-and-drop or click → ghost; all catalog devices with a 3D model; proposals with model in "Bêta" tab, badge "non vérifié".
- Placement: ghost snaps to floor/stage zones/stands; R rotates 15° (Shift free); height for flown; tilt stepper; alignment guides; Ctrl+D duplicate; Suppr delete; **undo/redo Ctrl+Z / Ctrl+Y** for every action.
- Cables: click port → click port (ADR-0008) and drag port → port; compatible ports glow; catenary cables coloured by signal type + legend; hover cable → type + length; wrong connection explained in French (R1–R8) **at the port**.
- Fix every P0/P1 from the audit before moving on.

## 5. Phase 4 — "Écoute": sound check with a song
- Gate: **▶ Tester avec une musique** appears only when valid: playback source connected (console playback/USB input, laptop/player device if in catalog, or explicit "Lecture console" source on the QL1); signal reaches ≥ 1 **powered** active speaker (or speaker + amp); no R1–R8 violation on the path. Reference case **must** work: QL1 + SM58 + 2 active speakers L/R. Also show "Micro OK" when SM58 → console input valid (dynamic, no +48 V).
- Songs: 2–3 royalty-free/CC0 tracks, licence in `ASSET_LOG.md`; "Choisir un fichier audio…" local only.
- Web Audio: per connected speaker `MediaElementSource → GainNode + DelayNode + StereoPannerNode`; values from speaker→listener geometry: 1/r gain, delay r/c (c = 343 m/s), pan from azimuth. Listener = camera or FOH; clicking a dot = "Écouter depuis ici". Unplugged/muted/unpowered speaker is silent. Console mute/fader/pan affect sound. Level meters on console and speakers. While playing, animated wavefronts/rays in each active speaker's coverage cone (respect reduced motion).
- Dots "Afficher les points": listener plane over audience zones (or floor) at 1.2 m seated / 1.7 m standing; grid 0.5 m (coarser if needed). Per speaker direct field: `L = L_ref + D(θ, φ) − 20·log10(r / 1 m)`, D smooth directivity reaching −6 dB at half nominal H and V coverage angles. Catalog fields `coverage_h_deg`, `coverage_v_deg`, `sensitivity_db`, `max_spl_db` each with a **source** (zod-required provenance); missing → nominal 90°×60°, flagged "valeur nominale". Energetic sum over speakers that receive signal. Display: thin-instance dots on a **locked colour scale** with legend + unit "dB relatif (0 = point le plus fort)", 3 dB steps to −24 dB; legend shows processing ("somme énergétique, champ direct") + source; stats panel min/max/mean/σ/count; click dot → pinned label; named points "1er rang / Régie / Fond de salle". Optional "≈ dB SPL estimé" only when every active speaker has sourced data, "estimation pédagogique". Honesty: hatched overlap "interférences non modélisées"; no STI; no legal-limit; fidelity chip "relatif" with pop-over. Performance: **Web Worker**, on change only (debounce 150 ms). Golden tests: 2× distance on axis = −6 dB; −6 dB at coverage edge; two equal sources sum = +3 dB.
- Bonus: "Délais" toggle (arrival-time differences ms + m at clicked point).

## 6. Phase 5 — ship and re-audit
Build to `website-prototype/tekpractice/jouer/` on `design/tekonest-umbrella-brand` (Vite base, ≤ 25 MiB/file). Update `src/pages/tekpractice.html` ("Mode Création" text, new controls table, 20-s GIF: place → Space → QL1, SM58, 2 speakers → patch → ▶ song → dots). `python website-prototype/src/build.py`; commit; push. Re-run Phase 0 audit live: every original P0/P1 fixed, before/after screenshots.

## 8. Rules
Engine invariants of `tekpractice-sim/CLAUDE.md` stay (catalog + levels source of truth; engine never imports `logic/*`; UI dispatches intents only; R1–R3 engine invariants). Acoustics = teaching model in pure `src/acoustics/` with an ADR. Never commit Fohhn screenshots, copyrighted audio, secrets. Every action has a named button; visible focus; target 1366×768. Small commits; push each green phase; never force-push shared branches. No background processes left running.

## 9. Final report → `docs/CREATIVE-MODE-REPORT.md`
Live link; before→after table per audit bug with screenshots; end-to-end status (QL1 + SM58 + 2 speakers → song → dots); tests (vitest + Playwright), FPS idle/orbit/dots, bundle; §7 decisions checklist; next: levels as "missions" inside Mode Création.
