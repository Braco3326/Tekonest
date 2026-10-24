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
- **L3.** The reference setup QL1 + SM58 + 2 active speakers exists in no template, so it gets its own starter template, « Concert simple (référence) ».

## Progress

- Phase 0 (audit): started.
