# Tekonest

Master folder for **Tekonest** — a Paris nest of services around culturally mixed events (Arab music from the Middle East to Morocco, Afro, electronic and more) and a community that gives artists and technicians fairly paid work.

**Status (21 Oct 2026):** idea stage. No legal structure, no agreement with Rebels Collectif, all figures are estimates until replaced by quotes. Nothing here is legal advice.

## Services

Each service lives in its own independent folder.

| Folder | Service | Status |
| --- | --- | --- |
| [`event-project/`](event-project/) | **Tekonest Event Project** — culturally mixed nights in Paris, starting with the pilot. Holds the deck, legal guide, meeting brief, working plan and financial model. | Planning |
| [`learning-platform/`](learning-platform/) | **Tech Nest** — free learning platform for the BTS Métiers de l'audiovisuel, option Son (Next.js; courses, past papers, AI tutor). Imported from repo `Technest`. | Live on Vercel |
| [`tekpractice-sim/`](tekpractice-sim/) | **TekPractice** — 3D audio-equipment simulator (Babylon.js + Vite): wire real studio gear, levels A1–D1. Imported from repo `Technest-Sim`. | In development |
| [`knowledge-base/`](knowledge-base/) | **Sound knowledge base**: 357 sourced sound devices (specs, official manuals, TekPractice mapping), 19 "how sound works" explainers, learning resources and licensed 3D models. Feeds the learning platform and TekPractice. | Research (branch `research/sound-equipment-database`) |
| [`tekpractice-sim/docs/CONTROLS.md`](tekpractice-sim/docs/CONTROLS.md) | **TekPractice controls** (FR + EN): walk the 3D world (ZQSD/WASD or mouse only), inventory (Espace), place and pick up gear, generated rooms, Esc chain — ADR-0010. | Feature (branch `feature/tekpractice-explore-controls`) |
| [`knowledge-base/tek-brain/`](knowledge-base/tek-brain/README.md) | **TEK Brain**: the sourced "brain" of a sound technician — 414 concepts, 96 procedures, 82 machine-checkable rules, 101 faults, 41 scenarios, 780-term FR↔EN glossary, 32 room templates, curriculum and AI retrieval index. Feeds TekPractice and the learning platform. | Research (branch `research/tekbrain`) |
| [`archive/`](archive/) | Early simulator snapshots, kept for reference: `teknest/` and `teknest-simu/` (from repos `teknest`, `teknest-simu`). | Archived |

New services (e.g. technician network, equipment rental) get their own folder here.

Each imported folder keeps its full git history. Run commands (`npm install`, `npm run dev`) from inside that folder.

> Name note: older files use "Techonest"; the project name going forward is **Tekonest**.
