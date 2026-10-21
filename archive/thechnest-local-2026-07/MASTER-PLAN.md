# TECH NEST / AUDIO SIM — Master Plan & Fable 5 Sprint
Written Fri 10 July 2026 · Fable 5 access ends **12 July** · Mode: Fable inside Claude Code (files + shell + Blender MCP)

---

## 1. THE HIGH END — what this becomes

**The Audio Engineering Simulator is the flagship of Tech Nest.**

A browser-based 3D simulator/game where you wire **real professional gear** (Yamaha QL1, SM58, Rio stagebox, Pro Tools rigs, TT patchbays) across four domains — Live Sound, Radio/Broadcast, Duplex/Remote (mix-minus), Post-Production — and the system *teaches you by catching the classic mistakes*: no phantom on a condenser, an open mic feeding the monitors, an N-1 echo, a clock master/slave clash.

Why this is the whole strategy: our competitive research found that **nobody in the market teaches hands-on sound skills, and nobody gives AI feedback on actual audio work.** Every competitor either sells generic PDFs or expensive human mentors. This simulator is the one thing that can't be copied quickly — and it maps directly onto the BTS Son épreuves (E4 practical, E51 project) that have **no public past papers**, i.e. exactly where students are most abandoned.

**Positioning decision (yours): personal now, product later.** So:
- Build it for *you* to master audio engineering. No accounts, no backend, no payments, no DSGVO gate. (YAGNI, per spec.)
- But **architect so it can become a product without a rewrite.** Three rules enforce that:
  1. **Content stays pure data.** Levels/gear/rules are JSON. Adding curriculum ≠ touching the engine.
  2. **Progress is an interface, not a place.** Persist via a `ProgressStore` abstraction (localStorage today) so an account-backed store can replace it later with zero engine changes.
  3. **The mistake history is the product.** It's your learning metric now, and later it's the data an AI tutor reasons over. Model it properly from day one.

Success criterion (unchanged): *you can wire a self-op radio studio and build a correct N-1 without notes* — measured by the simulator's own mistake history trending to zero.

---

## 2. FULL BUILD INVENTORY — everything that must exist

| # | Layer | What | Status |
|---|---|---|---|
| 0 | **Foundations** | `CLAUDE.md`, repo scaffold | ✅ done |
| 0 | | `catalog.json` (real gear: connectors, signals, devices, 8 rules) | ⛔ **blocker — next** |
| 0 | | `equipment-catalog.md` (human reference), catalog validator | ⛔ next |
| 0 | | Levels `a1`–`d1` (data) | ⛔ next |
| 1 | **Engine** | CatalogLoader (zod, fail-fast), ConnectionGraph (mate/signal/direction), RuleEvaluator, LevelRunner | ▫ to build |
| 2 | **Domain logic** (pure fns) | `phantom`, `gpio` (on-air tally, monitor mute), `mixMinus` (N-1 echo), `clock` (master/slave), patchbay normalling | ▫ to build — *the intellectual core* |
| 3 | **Scene / 3D** | DeviceSpawner (+ placeholder fallback), CableRenderer (catenary, drag, ≤15cm snap, green/red dry-run), Interaction, camera | ▫ to build |
| 4 | **UI overlay** | HUD goal checklist, teaching toasts, win screen w/ mistake summary, AoIP routing matrix, console bus assign, patchbay UI, **mistake-history dashboard** | ▫ to build |
| 5 | **Assets** | Connector kit (~22), ~20 device models, PBR materials, glTF + Draco/KTX2 pipeline | 🔄 overnight run |
| 6 | **Content depth** | 4× P1 levels → P2 depth on strongest domain | ▫ after P1 |
| 7 | **Ops** | vitest (graph matrices + every rule triggers/doesn't-trigger), Playwright smoke, GitHub Actions, Vercel | ▫ to build |
| 8 | **Product-later** (architect ≠ build) | ProgressStore interface, mistake-history schema, AI-feedback seam, Tech Nest embed, référentiel mapping | ▫ design only |

---

## 3. THE STRATEGIC INSIGHT — how to spend Fable

Fable 5's documented edge: **long-horizon autonomous agentic work** — it runs for days unattended, plans across stages, delegates to sub-agents, writes its own tests, and checks its own output with vision. *"The longer and more complex the task, the larger the lead."*

Therefore, until the 12th:

> **Never let Fable idle. Never use it for a quick chat. Give it long, self-verifying missions — especially while you sleep.**

And the move that decides whether this sprint was worth it:

> **Mission 6 (Sunday): make Fable write its own succession plan.** Specs, ADRs, exhaustive tests, and fully-written prompts for every remaining task. After the 12th, a lesser model executes *Fable's* plan instead of inventing its own. Its intelligence must end up in **files, not chat.**

---

## 4. THE CONTESTED CALL (debated, resolved)

You said assets + object logic are the most complex, so do them first. Half right — here's the sharper version:

- **Against assets-first:** assets are the *least* irreplaceable thing you own. The whole architecture says *assets never block gameplay* — placeholders work forever. Any model can drive Blender. Burning Fable's premium reasoning on mesh-pushing would be a waste.
- **For assets-first:** they're a laborious grind that must happen eventually, and grinding is precisely what an unattended agent does for free while you sleep.

**Resolution — split by resource, not by priority:**
- **Nights = assets.** Pure throughput, zero cost to your attention, uses the exact capability (long unattended runs) that vanishes on the 12th.
- **Days = object logic + engine + design.** Deep domain reasoning — the connector/signal/rule model, mix-minus, clock, normalling. *This* is where Fable's intelligence is irreplaceable, and it's the thing that, if wrong, poisons everything downstream.

You were right that the **object logic is the hardest part.** It is. That's why it gets Fable's daylight, not its night shift.

---

## 5. THE SPRINT — Fri 10 → Sun 12

### 🌙 TONIGHT (Fri) — two missions back to back
**Mission 1 · Object logic (2–3h, you review).** Paste **`audio-sim/Prompt-0.5b-Real-Gear-Catalog.md`**.
→ Real-gear `catalog.json` + `equipment-catalog.md` + `a1–d1` + TS validator, self-validated. **Review it before bed** — everything depends on it. *(Note: Prompt 1's mentions of "v0.2" and "port the Python validator" are obsolete — it's v1 and the validator is built here.)*

**Mission 2 · Asset factory (unattended, all night).** Paste **`audio-sim/Prompt-Assets-Overnight.md`**, adjusted to use the real device ids from Mission 1.
→ Connector kit + all four domain device sets. Commits each model, renders thumbnails to self-verify, logs and skips failures.
⚠️ Pre-flight: Blender open + MCP connected · Windows sleep = **Never** · git remote ready.

### ☀️ SATURDAY — the engine
**Mission 3 · Engine + Level A1 playable (long autonomous).** Paste **Prompt 1** from the master pack.
→ CatalogLoader/ConnectionGraph/RuleEvaluator/LevelRunner + scene + cables + UI + tests + CI + **live on Vercel**. Fable writes its own tests and gates itself.

### 🌙 SATURDAY NIGHT — the hard logic (unattended)
**Mission 4 · All domain logic + Levels B1/C1/D1.** (Prompt below.)
→ `gpio`, `mixMinus` (N-1), `clock`, patchbay normalling + the three levels + full test coverage. This is the deepest reasoning in the project — ideal for a long Fable run.

### ☀️ SUNDAY — see the game, then secure the future
**Mission 5 · The visual language + playable web shell.** (Prompt below.) → *This is your "visualize the project" ask.*
**Mission 6 · The Durability Pass.** (Prompt below.) → **Do not skip this one.**

---

## 6. NEW PROMPTS

### Mission 4 — Domain logic + Levels B1/C1/D1 (paste Saturday night)
```
Respecte CLAUDE.md. LONG AUTONOMOUS RUN — I'm asleep. Do not stop to ask; make reasonable calls, log them, keep going. Use sub-agents to parallelize where the work is independent.

Build ALL remaining domain logic and levels against the real-gear catalog (content/ + logic/ ONLY — zero engine changes; that constraint is the test of our layer separation).

1. logic/gpio.ts (pure): ON-AIR tally state; monitor-mute-on-open-mic (feedback). Level B1.
2. logic/mixMinus.ts (pure): N-1 echo detection — remote return must NOT contain the remote's own voice. This is the exam question in code. Level C1 + the AoIP routing-matrix UI.
3. logic/clock.ts (pure): wordclock master/slave mismatch (two masters, or slave with no master) + sample-rate mismatch. Level D1.
4. Patchbay normalling: normalled vs half-normalled behaviour (inserting a plug breaks the normal; half-normal taps without breaking). If this needs an interface extension, design it cleanly, document it in an ADR, and keep contracts stable.
5. logic/phantom.ts: condenser without +48V; warn if +48V hits a ribbon mic.

For EVERY rule write a vitest with a triggers case AND a doesn't-trigger case. Run the full suite; it must be green. Deploy to Vercel.

Write docs/adr/*.md for every non-obvious decision. Finish with a summary of what's done, what you assumed, and what's left.
```

### Mission 5 — Visual language + playable web shell (paste Sunday)
```
Respecte CLAUDE.md. Now make it FEEL like a real product — this is the "see the game in a website" pass.

1. Design system: define the visual language as tokens (color, type, spacing, elevation, motion) in one place. Dark, precise, studio-grade — think pro audio hardware, not a toy. Document it in docs/design-system.md.
2. Web shell around the canvas: a landing/level-select screen, the in-game HUD (goal checklist, live signal-flow readout), teaching toasts, and a win screen with the mistake summary. It should look like a product, not a demo.
3. Mistake-history dashboard: reads the ProgressStore, shows my personal weak spots and the trend over time (target: trending to zero).
4. Polish the core interaction: cable drag, catenary sag, snap feel, green/red dry-run, hover affordances. The wiring must feel GOOD — that's the whole game.
5. Use vision to check your own output against the design intent; iterate until it looks premium.

Deploy to Vercel. Show me screenshots.
```

### Mission 6 — THE DURABILITY PASS (paste Sunday evening — highest leverage)
```
Respecte CLAUDE.md. CRITICAL: after 12 July I lose access to you (Fable 5) and continue with a less capable model. Your job now is to make yourself unnecessary. Convert everything you know about this project into artifacts on disk so a weaker model can finish it without you.

Produce:
1. docs/ARCHITECTURE.md — the complete system: layers, contracts, data flow, invariants, and WHY each decision was made. Include every trap a future model could fall into.
2. docs/adr/ — an ADR for every non-obvious decision made so far (catalog design, rule modelling, normalling, mix-minus semantics, snap/interaction, persistence).
3. docs/ROADMAP.md — every remaining task, ordered, each with: goal, files touched, acceptance criteria, and how to verify.
4. prompts/ — for EACH remaining task, a fully-written, paste-ready prompt (like the ones that built this project) so the next model executes YOUR plan instead of inventing its own. Be explicit; assume the reader is less capable than you.
5. Test hardening: raise coverage so any regression a weaker model introduces is caught automatically. Every rule, every graph invariant, every level win-condition. Add a Playwright smoke test per level.
6. docs/PRODUCT-LATER.md — exactly how to add accounts, progress sync, AI audio feedback, and Tech Nest embedding WITHOUT a rewrite. Name the seams.
7. A CLAUDE.md update capturing any new durable rules.

Verify everything is committed and the full suite is green. Then give me a handover briefing: state of the project, what's solid, what's fragile, and what to do first on Monday.
```

---

## 7. AFTER THE 12TH — what the next model does
Fill P2 content · polish · fix whatever the tests catch · build the **Tech Nest website** (using the research + landscape docs) · later, the **AI audio-feedback layer** (`ai-integrate`, RAG on the référentiel + annales, local on the Mac Studio). All of it well-specified by Mission 6, so a lesser model just executes.

---

## 8. RISKS & GUARDRAILS
- **The catalog is the single point of failure.** A wrong domain model poisons every level and every rule. It's the one thing you must personally review tonight.
- **Unattended runs die from environment, not intelligence.** Blender disconnects, Windows sleeps, git not configured. Do the pre-flight every time.
- **Don't chase the product.** No auth, no backend, no payments before the four P1 levels ship. Architect the seams; build nothing.
- **Skipping Mission 6 wastes the sprint.** A brilliant codebase nobody can extend is worth less than a good one that's fully documented.
