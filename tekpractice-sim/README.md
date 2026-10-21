# TekPractice — 3D sound-equipment simulator

> **Tekonest service.** This is the TekPractice simulator of the **Tekonest** umbrella. It was imported with its full history from the former repo `Technest-Sim` (package name `audio-sim`).
> Vision and status: [`brand/services/tekpractice.md`](../brand/services/tekpractice.md).

TekPractice is a browser-based 3D simulator. Students of the BTS Métiers de l'audiovisuel, option Son, wire real professional audio gear, and a rules engine explains each mistake: connector, signal, direction, phantom power, ON-AIR tally, monitor mute, N-1 and word clock.

## State (checked 21 Oct 2026)

| Area | State |
| --- | --- |
| Gameplay | 4 levels (A1–D1), 7 rooms, sandbox, exam mode, readiness dashboard, onboarding, 2D fallback |
| Tests | 164/164 unit tests pass; catalogue check and production build pass. Browser e2e tests were not run |
| AI coach | Present in code. Off unless a key is supplied (`.env.example`) |
| Not yet done | The 13 "Conseils d'Oscar" tips are placeholders. Live deployment was stale on 17 Jul 2026. 3D models need de-branding before commercial use |
| Last code change | 19 Jul 2026 |

## Run locally

```bash
cd tekpractice-sim
npm ci
npm run dev                # local dev server (Vite)
npm test                   # unit tests (vitest)
npm run validate:catalog   # checks content/catalog.json and levels
npm run build              # type-check + production build
```

## Where to read next

| File | Content |
| --- | --- |
| [`CLAUDE.md`](CLAUDE.md) | Architecture rules: content / engine / assets |
| [`docs/VISION_TekPractice-StudentJourney.md`](docs/VISION_TekPractice-StudentJourney.md) | Student journey vision |
| [`docs/NIGHT_LOG.md`](docs/NIGHT_LOG.md) | Build logs, July 2026 |
| [`docs/REVIEW-ME.md`](docs/REVIEW-ME.md) | Items waiting for the founder's review |
| [`docs/adr/`](docs/adr/) | Architecture decisions 0001–0009 |
| [`equipment-catalog.md`](equipment-catalog.md) | Readable mirror of the equipment catalogue |

The CI workflow in `.github/workflows/ci.yml` does not run from this subfolder; GitHub only reads workflows at the repository root.
