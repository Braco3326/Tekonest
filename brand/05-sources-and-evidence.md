# Tekonest — source inventory and evidence register

Audit date: **21 Oct 2026**, on branch `docs/tekonest-brand-foundation`.

## How to read the evidence labels

| Label | Meaning |
| --- | --- |
| **[F]** founder statement / decision | The founder said or decided it, as recorded in a source |
| **[FB]** founder brief | Instructions the founder issued: prompt files, kickoff briefs, chat instructions |
| **[P]** proposal | A document proposes or plans it. Most documents were AI-written for the founder |
| **[R]** research finding | An external fact cited in a source (law, référentiel, competitor) |
| **[E]** estimate | Any money, attendance or effort figure not yet measured |
| **[I]** implementation fact | Verified in code, config, or by running tests |
| **[Inf]** inference | Claude's reading of the evidence; not stated in any source |
| **[Rec]** recommendation | Claude's advice; never a founder decision |

**Important.** Almost every document in this repo was written by AI sessions: Claude Code in July, Claude in October. Some record what the founder said; most propose. The registers below keep these apart.

## Detailed registers (≈ 270 claims with sources and dates)

| Register | Covers | IDs |
| --- | --- | --- |
| [event-project-register.md](../projects/rebels-x-tekonest/tekonest-notes/event-project-register.md) | `projects/rebels-x-tekonest/` docs, deck, model | EV-01…EV-90 |
| [learning-platform-register.md](evidence/learning-platform-register.md) | `learning-platform/` docs and code | LP-01…LP-47 |
| [tekpractice-register.md](evidence/tekpractice-register.md) | `tekpractice-sim/` docs and code, plus `archive/teknest*` | TP-01…TP-60 |
| [thechnest-2026-07-register.md](evidence/thechnest-2026-07-register.md) | Founder's July 2026 local folder (now in `archive/thechnest-local-2026-07/`) | LT-01…LT-70 |

These are working audit notes. Each one also lists conflicts, what it could not verify, and a plain-language summary.

## Founder briefs (chat)

These are statements the founder made directly in chat on 20–21 Oct 2026. They are not stored as files elsewhere. They outrank older documents (FB-07).

| ID | Statement | Date | Type |
| --- | --- | --- | --- |
| FB-01 | The canonical brand name is **Tekonest**. Older spellings (Techonest, Technest, Thechnest…) are kept for historical traceability | 21 Oct 2026 | [FB] |
| FB-02 | Tekonest is a brand or umbrella with several possible services and ideas that may connect over time; "kind of a nest of multiservices" | 21 Oct 2026 | [FB] |
| FB-03 | `projects/rebels-x-tekonest/` is a current event and cultural-programming vision. **Superseded by FB-12**: the folder is now `projects/rebels-x-tekonest/` | 21 Oct 2026 | [FB] |
| FB-04 | `learning-platform/` and `tekpractice-sim/` are **current** service visions, under development during the website-creation phase. Do not classify them as abandoned | 21 Oct 2026 | [FB] |
| FB-05 | `archive/` holds older copies or historical material | 21 Oct 2026 | [FB] |
| FB-06 | The founder's local `Thechnest` project folder (on his PC) is historical evidence, not authority over the current vision | 21 Oct 2026 | [FB] |
| FB-07 | The latest direct instructions take priority. Where sources conflict, record the conflict and its dates | 21 Oct 2026 | [FB] |
| FB-08 | The vision is still being developed. Keep decided, proposed, built and open separate | 21 Oct 2026 | [FB] |
| FB-09 | "The plan is to make everything about Tekonest in one repo", with each service in its own independent folder | 21 Oct 2026 | [FB] |
| FB-10 | Founder statements made on 20–21 Oct about the event idea are recorded in [`projects/rebels-x-tekonest/docs/05-everything-explained.md`](../projects/rebels-x-tekonest/docs/05-everything-explained.md) | 20–21 Oct 2026 | [F] |
| FB-11 | Oscar (GitHub account Braco3326) is the person developing Tekonest; another person named in some older files is someone else | 21 Oct 2026 | [FB] |
| FB-12 | Tekonest is a Paris umbrella for the craft of sound and live production (Se former · Créer avec nous · Rejoindre le réseau). The cultural-mix idea, the Rebels Collectif nights, tickets, deck, legal guide and night financial model belong only to the separate project Rebels × Tekonest | 24 Oct 2026 | [FB] |

## Source inventory

| Source | Dates | Kind | How it was inspected |
| --- | --- | --- | --- |
| [`projects/rebels-x-tekonest/PILOT-OVERVIEW.md`](../projects/rebels-x-tekonest/PILOT-OVERVIEW.md) | 21 Oct 2026 | AI synthesis of founder statements and proposals | Read in full |
| [`projects/rebels-x-tekonest/docs/01`–`05`](../projects/rebels-x-tekonest/docs/) | 20–21 Oct 2026 | AI research and proposals; `05` records founder statements | Read in full |
| [`projects/rebels-x-tekonest/presentation/`](../projects/rebels-x-tekonest/presentation/) (.pptx, .pdf, build.js, slides-web) | 20–21 Oct 2026 | Deck v2 (35 slides + notes); v1 web deck (23 slides, superseded) | Slide and note text extracted; PDF page count matched; visuals not re-checked |
| [`projects/rebels-x-tekonest/model/pilot_model.py`](../projects/rebels-x-tekonest/model/pilot_model.py) | 21 Oct 2026 | Financial model (estimates) | **Run**; outputs compared with the deck (C-13) |
| [`learning-platform/`](../learning-platform/) README, docs, ADRs, config | 13–16 Jul 2026 | Founder brief (prompt) + AI docs | Read in full |
| `learning-platform/src/**` | 13–16 Jul 2026 | Next.js code | Skimmed for routes and features; **unit tests and type-check run 21 Oct** (54 pass, 3 skipped); build blocked by sandbox network |
| [`tekpractice-sim/`](../tekpractice-sim/) CLAUDE.md, kickoff/prompt files, docs, ADRs, logs | 7–19 Jul 2026 | Founder briefs + AI docs and logs | Read in full |
| `tekpractice-sim/src/**`, `content/**`, assets | 11–19 Jul 2026 | Code, data, 3D models | Skimmed; **164 unit tests, catalogue check and build run 21 Oct**; e2e and 3D visuals not checked |
| [`archive/teknest/`](../archive/teknest/), [`archive/teknest-simu/`](../archive/teknest-simu/) | 15 Jul 2026 | Snapshot copies of the simulator | Diffed against `tekpractice-sim` history |
| [`archive/thechnest-local-2026-07/`](../archive/thechnest-local-2026-07/) (22 files) | 7–19 Jul 2026 | July plans, status reports, research, CSV data, PDF renders | Read in full; PDFs checked as text (renders of the .md files) |
| Git history of all imported repos | 11 Jul – 21 Oct 2026 | Commit messages, dates | Read (155 + 17 original commits, plus 2 one-commit snapshot repos; original commits all authored as "Claude Code") |
| Founder chat, 20–21 Oct 2026 | 20–21 Oct 2026 | Founder briefs | See FB table above |

## What could not be inspected

- **Live services.** No live URL could be reached from the audit environment, so their state today is unknown:
  - `teknest.fr`, `sim.teknest.fr`;
  - `tech-nest-web-gamma.vercel.app`, `teknest-simu.vercel.app`.
- **Vercel settings and API keys.** Not seen, so it is unknown whether either AI tutor or coach has ever run live.
- **Code left on the founder's PC.** Not imported; only their docs were copied:
  - the local `audio-sim/` and `tech-nest-web_DEAD_DO_NOT_USE/` folders;
  - `idea-sphere.html`;
  - `assets-source/` (datasheets and photos);
  - the `/source` personal study documents.
- **Referenced but missing.** `VISION_TekPractice-Game.md` is present in the archive, but the `D:\teknest\` workspace is not, nor are `blender-pipeline.md` and the `docs/db_*.csv` copies inside the simulator.
- **Not run or not checked visually.**
  - TekPractice browser e2e tests;
  - 3D models and licence attribution;
  - deck and PDF design.
- **Not re-verified for accuracy.**
  - Legal and immigration citations; they are recorded as the documents state them;
  - BTS référentiel facts (see C-16);
  - physics and technical course content.
- **External parties.** No contact was made with Rebels Collectif, venues, EICAR or anyone else.
