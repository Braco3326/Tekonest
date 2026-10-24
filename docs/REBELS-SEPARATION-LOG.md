# Rebels × Tekonest separation: decision log

Date: 2026-10-24. Brief: Oscar (founder) clarified that Tekonest is a Paris umbrella for the craft of sound and live production (*Se former*, *Créer avec nous*, *Rejoindre le réseau*), and that the cultural-mix idea belongs only to the separate project Rebels × Tekonest.

## Plan (approved by the brief)

1. Inventory (read-only) → [`rebels-inventory.md`](rebels-inventory.md).
2. Create `projects/rebels-x-tekonest/` and `git mv` everything wholly about the idea into it.
3. Edit the Tekonest brand docs, design docs and the website so they no longer carry the cultural-mix claims.
4. Rebuild the site, check links, screenshots at 1440 and 390.
5. Commit in small steps, push `design/tekonest-umbrella-brand` and `main`, check the live site.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| 1 | Moved with `git mv`, so `git log --follow` works. `event-project/README.md` became `projects/rebels-x-tekonest/PILOT-OVERVIEW.md` to avoid two READMEs. | The project README is new and describes the collaboration. |
| 2 | `soirees.html` (fragment and built file) removed with `git rm`; its three review screenshots moved to `site-prototype-screens/`. | Brief §3. History keeps the page. |
| 3 | `scene-ambre.*` moved: its only use was the removed "Notre direction" section. | Brief §2. |
| 4 | "Notre direction" nav item, section, photo and the "La diversité crée de la richesse" quote removed (home call-to-action and L'histoire). | The quote is the cultural-mix conviction. |
| 5 | `design/02-directions`, `design/08-colour-review`, `design/research/*` kept unchanged with a dated "superseded framing" note at the top. | They are records of what was studied; rewriting them would falsify the record. The 3 research files that study the Paris Arab/Afro scene stay because they are cited by the design work. |
| 6 | Brand registers keep the Rebels rows (O-04…O-06, C-11…C-15, D-05, D-06) tagged `[Rebels × Tekonest]` rather than deleting them. | The canonical register must still point to the open questions. Evidence IDs (EV-xx) are unchanged. |
| 7 | Added **D-08** (brand decision) and **FB-12** (founder brief, 24 Oct 2026); FB-03 marked superseded. | Records the clarification in the brand's own decision trail. |
| 8 | Service map links L7, L8, L10, L13, L14 (event programme) removed; numbers not reused. | They described the event service. |
| 9 | Public site says "projet" / "événement" instead of "soirée". The L'histoire sentence about a musician and a DJ cofounding stays. | Only the cultural-mix wording was in scope. The cofounder sentence is open: it may belong to the Rebels project. **Open question for Oscar.** |
| 10 | Dead CSS (`.direction*`, `.medaillons`) and the halo block in `home.js` left in place. | Harmless, null-guarded, and not content. Can be cleaned later. |
| 11 | The design logo SVGs (`design/09-logo-nest/*.svg`) had uncommitted changes in this worktree before the task. They were **not** staged or committed. | Not part of this task; not mine to commit. |

## Branches

No branch is only about the idea. `docs/tekonest-brand-foundation` and `design/tekonest-umbrella-brand` contain event material but are brand/site branches. The `feature/*` and `research/*` branches only inherit `event-project/` from `main`; when they next merge `main`, git will follow the rename.
