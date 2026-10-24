# Rebels × Tekonest: inventory

Run 2026-10-24 after `git fetch --all`. Search: `git grep -i -E "rebels|arabe|arab|afro|métiss|metiss|mélange culturel|moyen-orient|maroc|soirée|soiree|billet|pilot"` on all 8 remote branches plus the working tree.

Hit counts (files with a match): `design/tekonest-umbrella-brand` 111, `feature/tekpractice-explore-controls` 95, `feature/tekpractice-designer-nav` 94, `research/tekbrain` 90, `docs/tekonest-brand-foundation` 52, `research/sound-equipment-database` 50, `research/fohhn-benchmark` 42, `main` 39. Most are the same files seen from different branches. Matches in `archive/`, `tekpractice-sim/`, `knowledge-base/` and `learning-platform/` are code or data false positives (camera "pilot", "billet" in venue data, "afro" inside words, wedding-hall room data); checked, **keep**.

Branch column: `D` = `design/tekonest-umbrella-brand`, `M` = `main`, `B` = `docs/tekonest-brand-foundation`. Other branches only carry `event-project/` inherited from `main`.

## Wholly about the idea → moved to `projects/rebels-x-tekonest/`

| path | branch | type | decision |
| --- | --- | --- | --- |
| `event-project/**` (README, docs 01–05, model, presentation) | M, D, B + inherited by all others | wholly | move |
| `brand/services/event-programme.md` | D, B | wholly | move → `tekonest-notes/` |
| `brand/evidence/event-project-register.md` | D, B | wholly | move → `tekonest-notes/` |
| `design/13-images/chatgpt-prompts.md` | D | wholly (crowd/party prompts) | move → `images/` |
| `website-prototype/assets/img/photos/scene-ambre.{jpg,webp}` | D | wholly (used only by the "Notre direction" section) | move → `images/` |
| `design/07-review/screens/soirees-{375,768,1440}.jpg` | D | wholly | move → `site-prototype-screens/` |
| `website-prototype/soirees.html`, `src/pages/soirees.html` | D | wholly | `git rm` (history keeps them) |

## Only mentions the idea → edited

| path | branch | type | decision |
| --- | --- | --- | --- |
| `README.md` | D, B | mention (services table, layout) | edit out |
| `brand/01-umbrella-vision.md` … `05-sources-and-evidence.md` | D, B | mention | edit out |
| `brand/03-status-map.md` | D, B | mention | edit out |
| `brand/README.md`, `brand/evidence/README.md` | D, B | link to moved files | fix links |
| `brand/services/creative-network.md`, `equipment-rental.md`, `production-and-crew-services.md`, `other-ideas.md` | D, B | mention (Rebels fee, pilot, links) | edit out |
| `brand/evidence/tekpractice-register.md`, `thechnest-2026-07-register.md` | D, B | mention in a "not mentioned" note | keep (they state the absence) |
| `design/01-positioning.md`, `design/04-design-system.md`, `design/05-site-map.md`, `design/README.md`, `design/03-logos/README.md` | D | mention | edit out |
| `design/12-design-system/README.md`, `tokens.json`, `components/Cover/preview.html` | D | mention (voice rules, sample text) | edit out |
| `design/11-damas/marqueterie-system.html`, `motion-lab.html` | D | mention (hero text, "Notre direction") | edit out |
| `design/02-directions/` (README, 3 boards, `gen_boards.py`) | D | mention (dated option boards) | keep as record, add a "superseded" note |
| `design/08-colour-review/**`, `design/07-review/README.md` | D | mention (dated council record) | keep as record, add a note |
| `design/research/*` | D | mentions (research on the Paris Arab/Afro scene) | keep as dated research, add a note |
| `website-prototype/src/pages/{index,histoire,reseau,organiser,contact}.html` + built `*.html` | D | mention | edit out |
| `website-prototype/src/build.py` | D | mention (nav, footer) | edit out |
| `website-prototype/assets/css/{site,tokens}.css` (`--cable-soirees`) | D | mention (token name, unused once the page is gone) | remove soirées rules |
| `website-prototype/tekpractice/jouer/assets/*.js` | D | false positive (bundled library, "wedding event hall" room) | keep |
| `learning-platform/**`, `tekpractice-sim/**` | all | false positive | keep (checked, nothing to change) |

## Branches

No branch is only about the idea. See the "Branches" section of `projects/rebels-x-tekonest/README.md`.
