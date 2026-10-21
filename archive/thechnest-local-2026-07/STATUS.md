# TECH NEST — Project Status & Map
_Last updated: 15 July 2026. Your single source of truth when you get lost between windows._

## The vision (why any of this exists)
Build **Tech Nest** — the best **AI-integrated** platform to help students pass the French **BTS Métiers de l'audiovisuel, option Son** (Paris/France). Goal: #1 at making students succeed. Two products under it:
1. **Tech Nest website** — courses + certificates (Dante-style), mapped to the official référentiel.
2. **Audio Engineering Simulator** — a reactive 3D "smart sound simulation" where you wire real gear and it teaches you the classic mistakes. This is the moat (no competitor has it).

Note: started as Ali's vision; **you (Oscar)** are building it on **Windows**.

---

## THE WINDOW MAP (the thing you keep losing)
**Rule: one window per repo. Never two windows on the same folder. All projects live in `C:\dev\`, never `Documents`.**

| Window | Folder | Project | Job |
|---|---|---|---|
| **W1** | `C:\dev\tech-nest-web` | Tech Nest site | Site + AI tutor. Site DONE, deployed. |
| **W2** | (confirm with `!pwd`) | was idea-sphere | Idea Sphere is DONE — this window may be free/reusable |
| **W3** | `C:\dev\audio-sim` | Simulator | Engine DONE. Next: domain logic + 3D assets |
| **W4** | `C:\Users\iB_K` (home) | config only | Registered Blender/FreeCAD/Sketchfab MCPs. **Job done — closeable** |

GitHub repos: site = `Braco3326/Technest` · simulator = `Braco3326/Technest-Sim`.

---

## WHAT'S DONE ✅
- **BTS research** — knowledge base (référentiel, épreuves E1–E6, coefficients, grille, RNCP blocs), annales index (E3/PTES 2017–2025). Files in `Thechnest/`.
- **Competitive landscape** — ~70 platforms, 4 clusters. Finding: nobody owns BTS Son; 3 white spaces (Son specialization, teach-don't-cheat AI, AI feedback on real audio).
- **Idea Sphere** — `idea-sphere.html`, 3D project tracker, built + logic-tested.
- **Tech Nest site (W1)** — Next.js, French, dark pro-audio design. Real E3/PTES course (6 units + exam), 6 stub courses, annales library (18 papers), certificate portal, mock auth behind swappable interfaces. 28 tests green. Deployed + QA'd (16 screenshots). Landing shows the AI-tutor anti-cheat example. On GitHub.
- **Simulator engine (W3)** — real-gear catalog v1 (26 connectors, 16 signals, 24 devices, 8 rules R1–R8), levels a1 full + b1/c1/d1 stubs, validator. Engine core DONE + tested (49 tests): ConnectionGraph (R1/R2/R3 always-on), RuleEvaluator, LevelRunner, device-state (ADR-0001), logic/phantom (R4). **A1 is playable end-to-end**, CI wired, Playwright smoke green. On GitHub.

## IN PROGRESS 🔄
- **Simulator Vercel deploy** — waiting on you to connect `Technest-Sim` via vercel.com/new (Git integration).
- **3D assets** — just unblocked (Blender MCP installed, port 9876). 0 models built yet.

## NOT STARTED ❌ (the important gaps)
- **AI tutor (W1)** — built as UI, NOT live. Needs `ANTHROPIC_API_KEY` on Vercel. **This is the first line of the brief and it's still cold.**
- **AI coach (W3)** — the simulator's socratic coach. Not started.
- **Simulator domain logic** — `logic/gpio` (R5/R6 tally + monitor-mute), `logic/mixMinus` (R7 N-1 echo), `logic/clock` (R8), patchbay normalling. Still stubs. **This is the actual substance of the sim.**
- **Levels B1/C1/D1** — playable versions.
- **Your BTS personal docs** — zip on Desktop, ingestion prompt written, not yet run (own folder `C:\dev\bts-content`).

---

## KEY DECISIONS MADE
- **Architecture:** 3 layers (Content data / Engine / Assets). Content is pure JSON; assets never block gameplay (placeholders).
- **Cas 3:** reference files (catalog.json etc.) never existed on your PC → authored **fresh as canonical v1** with real gear.
- **R1/R2/R3** = engine invariants (always on, banned from logicChecks). **R4** = device state (ADR-0001: phantom is a switch, not a cable).
- **Personal now, product later:** no backend; but auth/progress behind swappable interfaces so a real backend drops in later.
- **Domain plan:** root `technest.fr` → site; `sim.technest.fr` → simulator (two Vercel projects, one domain).
- **Positioning:** not a game — a **reactive smart sound simulation**. Trust/anti-cheat AI is the differentiator.

## PROBLEMS WE HIT (add any I missed)
1. **`Documents` folder strangled all Node builds** (Defender/OneDrive real-time scan) — `npm build` never finished. Fixed by moving everything to `C:\dev\`. Hit BOTH projects.
2. **Cas 3** — reference files didn't exist anywhere → authored fresh.
3. **Two windows on the same repo** → collisions. Fixed with one-window-per-repo.
4. **No git at first** → `git init` + GitHub remotes = real backups.
5. **Blender MCP add-on wasn't installed** → now installed (official `blmcp`, port 9876, needs "Allow Online Access" on).
6. **Cowork sandbox disk-full** → the single multi-tab Excel of all data still not built (CSVs hold the data).
7. **Date confusion** (my error: said July 10, it was 13) → the "Fable before the 12th" sprint window was miscalculated.
8. **Fable 5 access uncertain** — running on credits; check `/model`.

---

## WAITING ON YOU (your to-do list)
- [ ] **Read `docs/REVIEW-ME.md` (W1)** — verify the E3 physics is correct. Only you can. It also grounds the AI tutor.
- [ ] **Buy the domain**, then wire root=site, `sim.`=simulator.
- [ ] **Connect GitHub↔Vercel** for both projects (auto-deploy on push).
- [ ] **Add `ANTHROPIC_API_KEY`** to light up the AI tutor.
- [ ] **Blender pre-flight** (restart, confirm port 9876, keep open, never-sleep) → start assets in W3.
- [ ] **Run the BTS-docs ingestion** in `C:\dev\bts-content`.
- [ ] **Decide:** simulator logic-first or assets-first (recommend logic-first; assets can run overnight).

## THE ONE THING TO REMEMBER
Both products are strong but **contain zero live AI** — the first word of the brief. After the current builds land, go straight to the two AI features (tutor + coach). Everything else (assets, polish, P2 content) is secondary.
