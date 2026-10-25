# Mode Création — decision & progress log

Branch `feature/tekpractice-creative-mode` (from `feature/tekpractice-designer-nav` @ 36cfa5a). Worktree `C:\Users\brro\dev\Tekonest-wt\creative`.
Brief: Oscar's "Mode Création only" prompt (2026-10-24). Autonomous run; defaults from brief §7 apply unless noted.

## Defaults taken (brief §7 — Oscar can overturn)

- [ ] Similarity to Fohhn: same interaction model and layout logic; Tekonest look; no Fohhn assets, wording, code or name.
- [ ] dB display: relative by default; "≈ dB SPL estimé" only with sourced data.
- [ ] Demo song: royalty-free/CC0 tracks + local file picker; nothing copyrighted bundled.
- [ ] Levels / exams: hidden behind `?legacy=1` (`FEATURES.levels = false`), code and tests kept.
- [ ] Catalog proposals: shown only in "Bêta", badge "non vérifié".
- [ ] Ear height: 1.2 m seated by default, 1.7 m standing selectable.
- [ ] Branch: `feature/tekpractice-creative-mode` from the designer-nav branch; site deploys from `design/tekonest-umbrella-brand`.

## Decisions taken during the run

(appended as they happen)

- **L1 (inventory, a8214cc).** `content/rooms/` (32) and the TEK Brain templates (32) are the same set, so the start screen shows 32 room cards, plus the 3 `.glb` venue sets and "blanc". Only 3 of the 7 environment presets have `.glb` sets, not 7 as the brief assumed.
- **L2.** Template gear matches the game catalog only 22 % (77/350). "Avec le matériel du modèle" therefore places only the matched devices; the others are listed as « matériel non disponible dans le jeu ».
- **L4 (after Task 7).** Rooms and placeholder devices still use the old 3D look (pale grey floor, saturated boxes), which clashes with the dark Tekonest interface. The plan had no task for this, so **Task 14b « Look 3D Mode Création »** (tekdesigner) is added before the Phase 1 gate.
- **L5 (Task 14 review).** The brief's status bar reads "Signal OK / X erreurs". « Signal OK » with a green ✓ is shown **only when the signal path really reaches a powered speaker** (`playbackReady`, from Task 34). Until then, 0 errors reads « Aucune erreur détectée » in neutral ink, and an empty rig reads « Rien de branché ». **Why:** the brief's honesty rule; an empty rig must never show « Signal OK ».
- **L6 (Task 14b review).** The 3D canvas focus ring is **Papier**, not Ambre: inside the viewport Ambre means "selected", so an Ambre frame around the whole canvas read as "everything selected". Every other control keeps the plan's 2 px Ambre + 1 px Nuit ring. Deferred from 14b: cables keep the legacy palette; the project title (`.cr-title`) stays Tektur until its e2e is updated.
- **L7 (Phase 1 review).** Recalling a view while orbit inertia still runs leaves ≤ 0.1 rad of drift after landing. It predates this branch (legacy too). **Deferred to Phase 2** (camera Tasks 16–21) as a `CameraRig` option `stopInertiaOnFlight` (default false = legacy unchanged, true in Mode Création), with a NullEngine unit test and the e2e settle check. **Why not now:** changing the shared tween would change legacy behaviour.
- **L8 (Phase 1 gate).** Known e2e flakes under machine load, each green when run alone: cameraFeel « N12 recalling a view », explore « holding W walks forward » and « click a device », focusPatch « A1 wired », creation-keyboard « arrows orbit », creation-boot « legacy HUD back-arrow », essais « final review #1 compare flips », creation-tree « idle = 0 renders », creation-properties « review fixes 1-2 » (stepper burst split by the 600 ms window), one cameraFeel toast timing. Rule: a gate counts only a full-suite run with 0 failures; a flake is re-run alone 3× and logged.
- **L9 (Phase 1 review).** French copy marked « à valider (tekuxwriter) »: tekuxwriter pass run at the Phase 1 close (see Progress).
- **L10 (Phase 1 review).** No-WebGL / failed-load fallback: a persistent alert « Vue 3D indisponible » with « Ouvrir la version 2D » → `?level=a1&render=2d` (the playable 2D board; `?legacy=1` only opens the dashboard), or « Recharger la page » when a chunk fails. Under the open place picker only Annuler/Rétablir and the rig shortcuts are off (menus, Ctrl+S and help stay usable). Commit 8a34cd9's message says "menus inert"; 15c79fb replaced that behaviour (history not rewritten).
- **L11 (Phase 1 review).** `index.html` modulepreloads the 5.2 MB Babylon chunk on every route, including the `?legacy=1` dashboard and no-WebGL machines (pre-existing; Vite's preload helper lives in that chunk). **Fix with `manualChunks` before the Phase 5 deploy.**
- **L12 (copy pass).** tekuxwriter signed off 228 strings (211 kept, 15 rewritten). When browser storage is full, the message no longer advises « Enregistrer sous » or "free up space": both write to the same full storage, and the app can't delete a project. It now says only what's true (autosave paused, the work on screen stays while the page is open, nothing saved is deleted). **To build later:** « Exporter le projet… » / « Importer… » (file download/upload) and deleting a project, so a full storage has a real way out. **Question for Oscar:** zone type `gallery` is used for both a church organ « Tribune » and a TV « Régie »; it reads « Galerie » for now. Split the type in the room data (your call, D6) or pick one word?
- **L3.** The reference setup QL1 + SM58 + 2 active speakers exists in no template, so it gets its own starter template, « Concert simple (référence) ».

## Progress

- **Phase 1 : done (2026-10-25).** Whole-phase review by tekreviwer (c51dc87..07d865d): one Important (no-WebGL dead end) fixed, copy signed off by tekuxwriter (L9, L12). Final checks: `tsc` 0; vitest 1069; lint 0; Playwright 183 passed / 0 failed / 16 skipped (full suite after the review fixes), creation e2e 76/76 after the copy pass; start chunk −2.9 % vs legacy; idle = 0 renders; `smoke:site` OK. Open for Oscar: « Galerie » (L12). Carried to later phases: L7, L11, project export/import/delete (L12), minors in the SDD ledger.

- Phase 0 (audit): started.
- Phase 1 : gate run (Task 15, before review). `tsc` 0 errors; vitest 98 files / 1064 tests green; `npm run lint` green (lint debt fixed); Playwright 179 passed, 16 skipped (`zz-qa-crawl`, needs `QA_CRAWL=1`), 0 failed. Start chunks (entry + static imports, KiB): creation `boot` 5470.2 raw / 1234.1 gzip vs legacy `legacyMain` 5635.6 raw / 1281.1 gzip = **−2.9 % raw** (budget ≤ +15 %); without the shared Babylon chunk 240.6 vs 406.0 (−40.7 %). Creation idle = 0 renders over 2 s (new e2e). Site build boots Mode Création and `?legacy=1` with 0 console errors (`npm run smoke:site`). Decision: the camera e2e settle check now asks the game whether a flight or inertia is still running (`__audioSim.cameraMoving`, debug only), because under render on demand two equal camera samples did not prove the camera had stopped.
