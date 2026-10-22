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
| **tekdesigner** | One design system across site and game: art direction, tokens, components, 2D motion, 3D scene look (formerly `designer`) | Any UI, theme, visual, art-direction or motion work | /superpowers:brainstorming, /frontend-design, /anthropic-skills:theme-factory, /anthropic-skills:brand-guidelines, /design:accessibility-review | 2026-10-22 (renamed; created July 2026) |
| **tekdeveloper** | Engineering for all codebases: architecture, logic, tests, performance, CI, deploy (formerly `developer`) | Engine, logic, data model, tests, performance, CI, deploy | /superpowers:writing-plans, /superpowers:test-driven-development, /superpowers:subagent-driven-development, /superpowers:systematic-debugging, /anthropic-skills:expert-council, /anthropic-skills:deep-scan | 2026-10-22 (renamed; created July 2026) |

**Pending (waiting for the founder's names):**
- creative direction
- brand design
- UX writing
- frontend design

Brand design and frontend design overlap with **tekdesigner**. The founder will decide whether tekdesigner takes them on or whether separate agents are named.
