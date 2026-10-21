# Tekonest

**Tekonest** is a brand and umbrella for several services, founded by Oscar. Some of the services may connect over time; others will stay independent. The vision is still being developed. These documents keep apart what the founder has **decided**, what is **proposed**, what is **built**, and what is still **open**.

> Status, 21 Oct 2026: no legal structure, no signed partner, no paying customers. All money figures are estimates. Nothing here is legal, financial or immigration advice.

## Start here

| Read | For |
| --- | --- |
| [Umbrella vision](brand/01-umbrella-vision.md) | What Tekonest is, how it grew, candidate values, brand-architecture options |
| [Service map](brand/02-service-map.md) | How the services connect, with each link marked exists / planned / possible / needs decision |
| [Status map](brand/03-status-map.md) | What is existing, under development, proposed or historical |
| [Decisions & questions](brand/04-decisions-and-questions.md) | Founder decisions, open decisions, dated conflicts, top questions |
| [Sources & evidence](brand/05-sources-and-evidence.md) | Source inventory, evidence labels, founder briefs, links to the detailed registers |

## Services

The [status map](brand/03-status-map.md) is the canonical source for status; the column below is a summary.

| Service | Status | Vision | Working folder |
| --- | --- | --- | --- |
| Event & cultural programme (Paris nights) | Proposed · current vision | [vision](brand/services/event-programme.md) | [`event-project/`](event-project/) |
| Artist & technician network | Proposed · current vision | [vision](brand/services/creative-network.md) | (none yet) |
| BTS Son learning platform ("Tech Nest") | Under development · code exists | [vision](brand/services/learning-platform.md) | [`learning-platform/`](learning-platform/) |
| TekPractice 3D simulator | Under development · code exists | [vision](brand/services/tekpractice.md) | [`tekpractice-sim/`](tekpractice-sim/) |
| Production & crew services | Proposed | [vision](brand/services/production-and-crew-services.md) | (none) |
| Equipment rental | Proposed | [vision](brand/services/equipment-rental.md) | (none) |
| Other ideas (themed series, community, internship finder, AI audio feedback, …) | Ideas, classified | [list](brand/services/other-ideas.md) | (none) |

## Repository layout

```
brand/                     canonical overview docs (start here)
  services/                one vision per service
  evidence/                detailed evidence registers (audit notes)
event-project/             event programme: pilot overview, legal guide, plan, deck, model
learning-platform/         Next.js app (imported from repo "Technest", full history)
tekpractice-sim/           Vite + Babylon.js app (imported from repo "Technest-Sim", full history)
archive/                   historical copies and July 2026 planning docs; not current
```

Each code folder is independent. Run `npm ci` and its other commands from inside that folder.

## Names

The canonical name is **Tekonest**. Older files keep the spellings they were written with (Techonest, Technonest, Technest, TechNest, Tech Nest, Teknest, TEKNEST, Thechnest) and sub-names (Tekskol, TekPractice, audio-sim), so their history stays traceable.
