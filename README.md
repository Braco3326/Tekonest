# Techonest

Working files for **Techonest** — a Paris project for culturally mixed events (Arab music from the Middle East to Morocco, Afro, electronic and more) and a community that gives artists and technicians fairly paid work.

**Status (21 Oct 2026):** idea stage. No legal structure, no agreement with Rebels Collectif, all figures are estimates until replaced by quotes. Nothing here is legal advice.

## Contents

| Path | What it is |
| --- | --- |
| `presentation/Techonest_Vision_and_Project_Plan.pptx` | Main deck — 26 slides + 9 appendix, speaker notes with sources |
| `presentation/Techonest_Vision_and_Project_Plan.pdf` | PDF preview of the deck |
| `presentation/pptx-source/build.js` | pptxgenjs script that generates the deck |
| `presentation/slides-web/` | Earlier 23-slide web deck (Slides artifact source) |
| `docs/01-legal-structure-guide.md` | Legal structures in France, compared for Techonest |
| `docs/02-meeting-brief.md` | Pre-read for the cofounders |
| `docs/03-working-project-plan.md` | Detailed working plan (sections A–I) |
| `docs/04-deck-companion-notes.md` | Change log, assumption register, sources, decisions |
| `docs/05-everything-explained.md` | Everything the founder explained, with contradictions and gaps |
| `model/pilot_model.py` | Financial model for one pilot night (run: `python3 model/pilot_model.py`) |

## Rebuild the deck

```bash
cd presentation/pptx-source
npm install pptxgenjs
node build.js
```

`build.js` writes to a scratchpad path and calls a theme helper from the original build environment; adjust the output path and remove the `applyTheme` call to run it elsewhere.
