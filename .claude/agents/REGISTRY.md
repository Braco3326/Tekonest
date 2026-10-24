# Tekonest — named agent registry

Rules:
- Ask the founder for a name before creating any new agent.
- Never invent names.
- Never create two agents with the same responsibility. Reuse an agent when its responsibility fits.
- Each agent's full definition is in `.claude/agents/<name>.md`.

| Agent | Responsibility | Invoke when | Approved skills | Since |
| --- | --- | --- | --- | --- |
| **tekauditor** | Read-only research audits; evidence registers (claim, source, date, type) | Before any synthesis, reorganisation or "what do we actually have" question | /pdf-reading, /file-reading, /anthropic-skills:deep-scan | 2026-10-22 (role used since 21 Oct) |
| **tekreviwer** | Independent fact-check and review of docs, data and code before commit or merge | End of every phase, before any merge; always a different agent from the author | /superpowers:requesting-code-review, /superpowers:verification-before-completion, /anthropic-skills:deep-scan | 2026-10-22 (role used since 21 Oct) |
| **tekresearcher** | Sourced research and data engineering for `knowledge-base/` (equipment, manuals, fundamentals, resources, 3D models, TEK Brain) | Any research or dataset task | /anthropic-skills:deep-research, /superpowers:dispatching-parallel-agents, /pdf-reading, /superpowers:verification-before-completion | 2026-10-22 (role used 21–22 Oct) |
| **tekdesigner** | Design system across site and game: tokens, components, 2D motion, 3D scene look (formerly `designer`); encodes brand and concept | Any UI, theme, visual, art-direction or motion work | /superpowers:brainstorming, /frontend-design, /anthropic-skills:theme-factory, /anthropic-skills:brand-guidelines, /design:accessibility-review | 2026-10-22 (renamed; created July 2026) |
| **tekdeveloper** | Engineering for all codebases: architecture, logic, tests, performance, CI, deploy (formerly `developer`) | Engine, logic, data model, tests, performance, CI, deploy | /superpowers:writing-plans, /superpowers:test-driven-development, /superpowers:subagent-driven-development, /superpowers:systematic-debugging, /anthropic-skills:expert-council, /anthropic-skills:deep-scan | 2026-10-22 (renamed; created July 2026) |

| **tekcreativedirector** | Creative vision and concept per experience; arbitrates brand / UI / copy; creative sign-off | Start and end of any design task | /superpowers:brainstorming, /anthropic-skills:expert-council, /design:design-critique | 2026-10-22 |
| **tekbranddesigner** | Tekonest brand identity: name usage, logo, brand colour/type, tone, sub-brand architecture | Logos, brand guidelines, anything outward-facing | /anthropic-skills:brand-guidelines, /anthropic-skills:theme-factory, /anthropic-skills:canvas-design, /marketing:brand-review | 2026-10-22 |
| **tekuxwriter** | All product words, FR first with EN technical terms; copy decks | Any interface text or microcopy | /design:ux-copy, /design:accessibility-review | 2026-10-22 |
| **tekinspi** | Benchmarks of external pro-audio / learning tools (first: Fohhn FSD Viewer, Optimizer, Designer) turned into original TekPractice design proposals; observe-only browser audits with evidence labels | Any "benchmark / audit / get inspired by <external tool>" task for TekPractice; branch `research/fohhn-benchmark` | /superpowers:using-superpowers, /anthropic-skills:deep-scan, /anthropic-skills:deep-research, /anthropic-skills:canvas-design, /expert-council | 2026-10-24 |
| **tekfrontenddesigner** | Screens and interactive UI of site and game HUD, built on the design system | Screen mockups, prototypes, UI implementation | /frontend-design, /design:accessibility-review, /design:design-handoff, /anthropic-skills:qa-web | 2026-10-22 |

**Who owns what (no overlap):** tekcreativedirector sets the concept → tekbranddesigner sets the identity → tekdesigner encodes both as tokens, components and the 3D look → tekfrontenddesigner builds screens → tekuxwriter writes the words → tekdeveloper wires the engine → tekreviwer checks.

Names: given by the founder (2026-10-22). The four design agents follow the founder's "tek + role" naming rule, as he asked.
