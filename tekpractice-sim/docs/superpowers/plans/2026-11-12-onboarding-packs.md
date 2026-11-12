# Onboarding packs: implementation plan

Version 2, 2026-11-12 (amended after council round 2; see « Council 2: what changed » at the end).

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. One fresh implementer per task, one independent reviewer
> per task (a different agent), the ledger updated after every task. Steps use checkbox (`- [ ]`) syntax. The controller follows the
> « Overnight runbook » section.

**Goal:** the first visit, the tutorial, the new Oscar character and five design packages of the spec, as one engine with a typed package table,
with the stand-alone honesty and first-sound fixes first.

**Spec (read it first):** `docs/superpowers/specs/2026-11-12-onboarding-packs-design.md` (version 2).

**Ledger:** `E:\dev\Tekonest-wt\onboarding\.superpowers\ledger.md` (git-excluded). After each task: task id, commit, gate result (with the failing
assertion line pasted for the red run), reviewer verdict, anything parked.

**Tech:** TypeScript strict, Babylon.js 7, Vite, zod, vitest (environment `node`: no DOM; logic in pure modules, DOM proven in e2e), Playwright with
`@axe-core/playwright`.

## Global constraints (every task)

- Worktree `E:\dev\Tekonest-wt\onboarding` (git root), code in `tekpractice-sim`; branch `design/onboarding-packs`, upstream unset,
  `push.default=nothing`. **Never push, never deploy.** Git needs `-c safe.directory=E:/dev/Tekonest-wt/onboarding`. Never touch another
  worktree or `E:\dev\Tekonest`.
- Commit after every task, `git add` **explicit paths only**, ASCII message, ending with the `Co-Authored-By` trailer of the model that did the work.
- Public repo: no private file names, no names of people, nothing about money, nothing from private folders.
- `src/engine` untouched (`git diff c51dc87 -- tekpractice-sim/src/engine` empty). **No edit of `content/catalog.json`** (rule texts go through the
  override accessor, T1.5). Legacy route and exams unchanged; `?oscar=0` silences the guide; Oscar and the tutorial absent on exam addresses.
- No `?design` = today's behaviour plus the T1 fixes.
- Pinned honesty strings byte-identical. Every new user string = COPY key + deck row, « à valider (tekuxwriter) », French « vous ».
- `src/creation/**` never imports `src/guide/**`; only `store.ts` imports `ConnectionGraph` in `src/creation`; only `src/main.ts` imports
  `src/guide/vendor` from outside `src/guide`.
- New code reachable from the boot stays lazy; a budget failure means lazy-load it, **never loosen the budget**.
- No editing of a pinned test without a ledger line saying why.
- PowerShell for Playwright; `npm.cmd` / `npx.cmd`. Ports **4391** (suites), **4392** (captures and the founder's local run). Never 4173, 4174,
  4181, 5173, 3060.
- **E2E always on a fresh build:** `npm.cmd run build; $env:E2E_PORT='4391'; npx.cmd playwright test <files>` (T0.2 adds `npm run e2e:fresh`).
- Tests first: write the named tests, run them, paste the failing assertion in the ledger (red for the right reason), implement, green.
  Characterization tests (they pass on today's code) are labelled so and each gets one mutation that must turn it red.

## Hot files (one writer at a time; every task touching one is serialised)

`src/creation/boot.ts`, `src/guide/mount.ts`, `src/creation/copy.ts` + `docs/copy/creation-mode.md` (always together),
`src/creation/shell/creation.css`, `src/creation/shell/layout.ts`. The controller holds a « hot file lock » line in the ledger: task id + file;
a task needing a locked file waits. Wiring goes into small new modules (`src/creation/onboarding/wire.ts`, `src/guide/tutorial.ts`) so each hot
file gets one call site.

## Pre-flight (once)

- [ ] `status -sb` shows `design/onboarding-packs`, no upstream, clean tree; `config --get push.default` prints `nothing`.
- [ ] Ports 4391 and 4392 free (`Get-NetTCPConnection -LocalPort 4391,4392 -ErrorAction SilentlyContinue` returns nothing).
- [ ] Baseline gate, counts in the ledger: `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run validate:catalog`, `npm.cmd test`,
  `npm.cmd run build`, `npm.cmd run budget`, `$env:E2E_PORT='4391'; npx.cmd playwright test creation- guide-creation exam guide-legacy`.
- [ ] Record `rulesRevOf(catalog.rules)` (src/trials/fingerprint.ts) in the ledger (T1.5 asserts it never changes).
- [ ] Engine diff empty.
- [ ] Record the controller rulings in the ledger: the vendored patch is allowed (T1.2 has no wait); no catalog edit; « Oscar, assistant IA » stays.
- Red baseline: see runbook.

## Gate (after every task)

1. `npx.cmd tsc --noEmit`, `npm.cmd run lint` clean.
2. `npm.cmd test` green.
3. `npm.cmd run validate:catalog` green.
4. **`npm.cmd run build`, then** the task's e2e files on port 4391 (`npm.cmd run e2e:fresh -- <files>` once T0.2 exists). Phase close: the full
   baseline e2e set too.
5. Engine diff empty.
6. `npm.cmd run budget` when the task touched anything reachable from the boot.
7. Independent review (a different agent) against the spec section and the acceptance criteria; verdict in the ledger.
8. Phase close: deep scan of the whole phase diff (leftovers, dead code, unpinned strings, claims the tests do not back).

Opus (most capable) independent reviews: after T3, after T5, after T7, and the whole branch at T10.

## Dependency graph

```
PF ─► T0.1 ─► T0.2
        │
        ├─► T1.1 ─► T1.2a ─► T1.2b
        ├─► T1.3a ─► T1.3b ─────────────────────────┐
        ├─► T1.4                                    │
        ├─► T1.5a ─► T1.5b                          │
        ├─► T1.6                                    │
        └─► T1.7 (after T1.5a, T1.6 for its lists)  │
                    │ T1 close                      │
        T2.1 ─► T2.2 ─► T2.3 ─► T2.4a ─► T2.4b ─► T2.5
                                   │ T2 close        │
        T3.1a ─► T3.1b ─► T3.1c ─► T3.2 ─► T3.4      │
                         T3.3 (needs T1.3b, T3.2) ───┘
                                   │ T3 close + opus review
        T4.1 (needs T0.1, T3.1a) ─► T4.2 ─► T4.3 ─► T4.4
        T5.1 ─► T5.2 ─► T5.3 ─► T5.4 ─► T5.5 (T5.5 needs T4.1)
                                   │ T5 close + opus review
        T6.1 (T3.2, T4.3) ─► T6.2 ─► T6.3 (T1.6) ─► T6.4
        T7.1a, T7.1b, T7.1c (after T6) ─► T7.2 ─► T7.3 ─► T7.4
                                   │ T7 close + opus review
        T8.1 ─► T9.1 ─► T9.2 ─► T10
```

**Parallel-safe lanes** (disjoint files, no hot file in common): T1.1 || T1.3a || T1.6's content file; T1.4, T1.5a, T1.6 and T1.3b all write
copy.ts and are serialised on it; T3.1a || T5.1; T7.1a, T7.1b and T7.1c can be written in parallel but **run one after the other on port 4391**
(one port for suites; e2e runs never overlap).

## File map (main)

Create: `src/design/packages.ts`, `src/design/packages.css`, `src/design/events.ts`; `src/creation/onboarding/{state,profiles,startScreen,wire}.ts`;
`src/creation/checklistModel.ts`, `src/creation/shell/checklist.ts`; `src/creation/powerHelper.ts`; `src/creation/ruleTexts.ts`;
`src/guide/{tutorial,stepCard,character}.ts`, `src/guide/character.css`, `src/guide/VENDOR-PATCHES.md`; `content/templates/premier-son-pret.json`;
`tools/onboarding-local.mjs`; tests listed per task; docs: ADRs 0016 to 0018, `docs/tutorial/storyboard.md`, `docs/guides/tester-les-5-designs.md`.

---

## Phase T0: skeleton and scripts

### T0.1 Design package skeleton
- **Goal:** `?design` parsing and the table skeleton exist before anything reads them.
- **Files:** create `src/design/packages.ts` (types of spec 7.1; five entries with placeholder colours = today's tokens and distinct placeholder
  layouts; `designFromSearch`; `activePackage(search)`), `src/design/events.ts` (event name constant), `tests/design/packages.test.ts`,
  `tests/design/noDesignBranching.test.ts`; modify `src/creation/boot.ts` (one line: `html[data-design]` when a package is active).
- **Tests first:** `designFromSearch`: `?design=1`..`5` → id; `0`, `6`, `abc`, empty, two `design` keys → null (real red: the module does not
  exist). Lint: a crafted `if (design === 2)` trips it; the real scan finds none. « no `?design` → no `data-design` attribute ».
- **Acceptance:** no visible change without `?design`. **Depends:** pre-flight. **Tier:** standard. **Risk:** boot.ts lock.

### T0.2 Fresh-build e2e script and local runner
- **Files:** `package.json` (`e2e:fresh` = `npm run build && playwright test`; `onboarding:local` = `node tools/onboarding-local.mjs`), create
  `tools/onboarding-local.mjs` (build, `vite preview --port 4392 --strictPort`, prints the five `?design=n` addresses and the reset tip).
- **Tests first:** `tests/tools/onboardingLocal.test.ts`: the script's address list has exactly five entries on port 4392 (pure function exported).
- **Depends:** T0.1. **Tier:** cheap.

---

## Phase T1: stand-alone honesty and first-sound fixes

### T1.1 Resting insets for the open panels and the drawer
- **Files:** `src/guide/mount.ts` (`hostInsets`), `tests/guide/mount.test.ts`, create `tests/e2e/guide-overlap.spec.ts`.
- **Tests first:** unit: props open → right 260; collapsed → 32; none → bars only; throw → zero (the open drawer is **not** a `hostInsets` entry: it is an obstacle, `hostObstacles`, T1.2b; its height exceeds the widget's inset cap). e2e at
  1366 x 768: rect intersection of the resting icon with every visible shell control = none (red today: « Connecter à… »).
- **Acceptance:** 1366 x 768 green. The 1024 and 820 cases are **not** in this task (they need T1.2; no `fixme`).
- **Depends:** T0.1. **Tier:** standard. **Hot:** mount.ts.

### T1.2a Vendored placement patch (`placeBeside` avoid)
- **Files:** `src/guide/vendor/core/motion.ts`, `src/guide/vendor/VENDOR.json` (new hashes, a `patches` field naming patched files and the pin
  test), create `src/guide/VENDOR-PATCHES.md`, `tests/guide/vendorPatches.test.ts`.
- **Tests first:** avoid rect beside the target → another side (triggers); no avoid list → identical candidates to the old code (characterization +
  mutation); everything avoided → least overlap, `crowded`; « every patch in VENDOR-PATCHES.md is in VENDOR.json `patches` and its symbol exists ».
- **Depends:** T1.1. **Tier:** most capable.

### T1.2b Obstacles from the host, three viewports
- **Files:** `src/guide/vendor/ui/widget.ts` (`MountOptions.obstacles`, used by `applyTarget`, the resting position and the bubble's placement
  against non-target controls), `VENDOR.json`, `VENDOR-PATCHES.md`, `src/guide/mount.ts` (obstacles: visible shell buttons, menu items, inputs,
  cached `RECT_CACHE_MS`), `tests/e2e/guide-overlap.spec.ts` (1024 x 768 and 820 x 1180 with Propriétés open; icon and bubble; during each step of
  `premier-montage`).
- **Tests first:** the 820 x 1180 case (about 55 px overlap today) red, then green.
- **Depends:** T1.2a. **Tier:** most capable. **Hot:** mount.ts.

### T1.3a Checklist model (pure)
- **Files:** create `src/creation/checklistModel.ts`, `tests/creation/checklistModel.test.ts`.
- **Tests first:** exhaustive `Record<ReasonCode, Row | 'mic'>`; blocked row = `text_fr` verbatim; rows after the first blocked gate =
  not-yet-checked; all ticked only when `playbackReady` (triggers / does not); the mic line: « câblé mais pas entendu » only with a mic cable,
  `NO_MIC` text otherwise.
- **Depends:** T0.1. **Tier:** standard.

### T1.3b Checklist DOM and wiring
- **Files:** create `src/creation/shell/checklist.ts`; modify `statusBar.ts` (chip slot), `menuModel.ts` (line under the greyed Écoute items),
  `src/creation/onboarding/wire.ts` (created here if absent) + one call in `boot.ts`, COPY `checklist` + deck, `tests/e2e/creation-status.spec.ts`.
- **Tests first (e2e):** chip on a silent rig in `blank`; non-modal list with « Lecture console » blocked; « Aller à » selects and `design()` is
  unchanged; hidden when `playbackReady`; Échap closes, focus back; axe; works with `?oscar=0`.
- **Depends:** T1.3a. **Tier:** standard. **Hot:** boot.ts, copy.ts.

### T1.4 Oscar says what to do
- **Files:** `src/guide/verdict.ts`, COPY `assist` + deck, `tests/guide/verdict.test.ts`, `brain.test.ts`, `tests/e2e/guide-creation.spec.ts`.
- **Tests first:** per code « label = reason + action » (triggers); a rule error adds nothing (does not); no action sentence trips the banned list.
- **Depends:** T0.1. **Tier:** standard. **Hot:** copy.ts.

### T1.5a Rule text accessor and override texts
- **Files:** create `src/creation/ruleTexts.ts` (`creationRuleRows`, `ruleText`), COPY section `ruleOverride` + deck (Appendix A texts),
  `tests/creation/ruleOverrides.test.ts`.
- **Tests first:** override applied for R1 to R5; R6 to R8 return the catalog text; an unknown id falls back as `ruleTextFor` does; the catalog
  file is byte-identical and `rulesRevOf(catalog.rules)` equals the pre-flight value; every catalog `teach_fr` that trips the banned list has an
  override (offender list = override keys).
- **Depends:** T0.1. **Tier:** standard. **Hot:** copy.ts.

### T1.5b Use the accessor at the four read sites
- **Files:** `src/creation/boot.ts` (line 281), `src/creation/shell/connectModel.ts` (line 62 default), `src/guide/mount.ts` (line 243: creation
  route passes `creationRuleRows(rules)`; legacy passes the catalog rows), `tests/creation/ruleTexts.test.ts`, create
  `tests/e2e/rule-texts.spec.ts`.
- **Tests first:** e2e for R1 (an XLR into a jack), R2 (mic into a line input), R3 (out to out): the status list, the connect dialog's
  « Incompatibles » reason, Oscar's answer to the rule's title and the verdict bubble all show the same override text; on `?level=a1` the old text
  remains (legacy untouched).
- **Depends:** T1.5a. **Tier:** standard. **Hot:** boot.ts, mount.ts.

### T1.6 Playable template, honest pitches
- **Files:** create `content/templates/premier-son-pret.json`; COPY `picker.templatesPitch` rewritten + per-template note keys + deck;
  `src/creation/shell/placePicker.ts` (note line per template card), `tests/creation/templates.test.ts`, `tests/e2e/creation-picker.spec.ts`
  (count 2), `creation-keyboard-patch.spec.ts` (two templates), `creation-polish.spec.ts` (pitch).
- **Tests first:** the new template through `templateToDesign` + `APPLY_DESIGN` + `signalPath` is `playbackReady` (also proves `controls` are
  applied); every template that is not `playbackReady` carries the « À compléter » note; positions inside 24 x 14 m; name does not match
  `/Concert simple/` and says it is pre-wired.
- **Depends:** T0.1. **Tier:** standard. **Hot:** copy.ts.

### T1.7 Honesty lint (extended) and pinned strings
- **Files:** create `tests/creation/honesty.test.ts`, `tests/creation/pinnedStrings.test.ts`.
- **Tests first:** each banned family of spec 9 trips on a crafted string and a near miss passes; the real scan over every listed surface; pinned
  strings incl. the Bêta tooltip (characterization, each with one mutation).
- **Depends:** T1.5a, T1.6. **Tier:** cheap.

**T1 close:** full baseline e2e, deep scan, ledger.

---

## Phase T2: profile, offer, start screen

### T2.1 Onboarding state machine (pure)
- **Files:** `src/creation/onboarding/state.ts`, `tests/creation/onboardingState.test.ts`.
- **Tests first:** every transition of spec 4.1; no `?design` never yields the start screen; blocked storage in memory; corrupt record replaced;
  `request` increments on « Faire le tutoriel » and on Aide « Premiers pas ».
- **Depends:** T1 close. **Tier:** standard.

### T2.2 ProfilePreset table
- **Files:** `src/creation/onboarding/profiles.ts`, `tests/creation/profiles.test.ts`, COPY `onboarding` + deck.
- **Tests first:** four entries, unique keys, offer focus per spec 3, every label key in COPY.
- **Depends:** T2.1. **Tier:** cheap. **Hot:** copy.ts.

### T2.3 Start screen as a picker stage
- **Files:** `src/creation/shell/placePicker.ts` (`showStart`, stage switch, the stage's own Échap and digit handlers, start panel added to the
  confirm dialog's `setInert` set), create `src/creation/onboarding/startScreen.ts`, `creation.css`, create `tests/e2e/onboarding-start.spec.ts`.
- **Tests first (e2e `/?design=1`):** four equal buttons + « Tous les lieux »; keys 1 to 4; offer buttons equal (±1 px), « conseillé »,
  « étapes, à votre rythme », no minutes; focus per `offerFocus`; Échap on each stage (red today: picker Échap is gated on `closable`); covers
  inert while open and not inert after « Tous les lieux » + a card; no `?design` → today's picker.
- **Depends:** T2.2. **Tier:** standard. **Hot:** creation.css.

### T2.4a Apply the profile
- **Files:** `src/creation/onboarding/wire.ts` (apply: neutral room through the existing `pick(card, 'empty')`, drawer tab, panels),
  `src/creation/shell/inventoryDrawer.ts` (`open({ tab })`), one call in `boot.ts`, `tests/e2e/onboarding-start.spec.ts`.
- **Tests first:** profile 2 + « Passer » → `blank`, both panels open, drawer on Consoles; reload → project kept, chip shown, no start screen.
- **Depends:** T2.3. **Tier:** standard. **Hot:** boot.ts.

### T2.4b Aide « Premiers pas », profile chip, `tutorialAllowed`
- **Files:** `src/creation/shell/menuModel.ts`, `src/main.ts`, `src/creation/debug.ts` (reader `onboarding()`), `wire.ts`,
  `tests/guide/mainTail.test.ts`, `tests/creation/menuModel.test.ts`, `tests/e2e/creation-shortcuts.spec.ts`, `onboarding-start.spec.ts`.
- **Tests first:** Aide « Premiers pas » with no place open opens `blank` first; `?design=1&oscar=0` and `&mode=exam` → no offer; mainTail passes
  `tutorialAllowed: false` on an exam address.
- **Depends:** T2.4a. **Tier:** standard.

### T2.5 First-sound framing
- **Files:** `wire.ts` (apply `framing` of the active package via `host.rig.flyToPreset`), `src/design/packages.ts` (framing values).
- **Tests first:** e2e at 1366 x 768: QL1, SM58, K12.2 placed in view are each >= 40 px on their widest axis (`bodyBoundsInRoot` + `worldScreen`,
  allowed in a geometry test); `/` keeps the 19.2 m overview.
- **Acceptance:** met, or radius tuned and recorded; stop and report if it needs < 2 m. **Depends:** T2.4b. **Tier:** standard.

**T2 close:** ADR 0016 (start screen as a picker stage, `?design`-only), full baseline e2e, deep scan, ledger.

---

## Phase T3: tutorial and helper

### T3.1a Tutorial logic (pure)
- **Files:** create `src/guide/tutorial.ts` (role table from the catalog, `annotateDevice`, `annotateConnect`, `annotatePlayback`,
  `nextConnectionStepFor(pair)`, anchor resolvers as pure functions, the step list data with COPY keys), `tests/guide/tutorial.test.ts`.
- **Tests first:** per step one completing event and the closest non-completing one (ISA One for step 1; a Genelec in a console pair; the
  phantom toggle for step 6; a `disconnect` for step 4); `source-console` read from the catalog (today only `yamaha-ql1`); step ids unique;
  package 5 order `ecoute`, `debrancher`, `rebrancher`.
- **Depends:** T2 close. **Tier:** most capable.

### T3.1b Tutorial copy
- **Files:** COPY `tutorial` + deck (spec 6.3 lines, the power note, the helper offer sentence, the conditional mic line by key reuse),
  `tests/guide/tutorial.test.ts` (words <= 200 with `listen.simple`; banned list).
- **Depends:** T3.1a. **Tier:** cheap. **Hot:** copy.ts.

### T3.1c Tutorial wiring
- **Files:** `src/guide/flows.creation.ts` (the flow from the data), `src/guide/mount.ts` (one call into `tutorial.ts` for annotations and
  anchors), `src/guide/bridge/creationBridge.ts` (`audioState` reader, `playStarted`), `bridge/shared.ts` (`nav:ecoute`, `nav:checklist-power`,
  `nav:inventory.tab`, `.item`, `nav:connect.from`), `tests/guide/flows.test.ts`, `strings.test.ts`, `mount.test.ts`.
- **Tests first:** the flow list contains `premiers-pas` with the data's steps; `premier-montage` unchanged; anchors resolve on a fake bridge.
- **Depends:** T3.1b. **Tier:** standard. **Hot:** mount.ts.

### T3.2 Start, persist, resume, skip
- **Files:** `src/guide/tutorial.ts` (`oscar-guide.onboarding.v1`: `handledRequest`, `step`, `status`), `mount.ts` (start on
  `request > handledRequest`), `wire.ts` (Aide « Reprendre à l’étape {k} » / « Recommencer »), create `tests/e2e/onboarding-tutorial.spec.ts`.
- **Tests first (e2e `/?design=1`):** « Faire le tutoriel » rings step 1; steps 1 to 10 by hand end on the test signal; **reload at step 6 →
  step 6 current and ringed**; **finish, reload → no restart**; « Passer le tutoriel » then Aide re-offers; `PAGE_LISTENERS` unchanged.
- **Depends:** T3.1c, T2.4b. **Tier:** standard. **Hot:** mount.ts.

### T3.3 Power helper with the tutorial gate
- **Files:** create `src/creation/powerHelper.ts`, `tests/creation/powerHelper.test.ts`; `checklist.ts` (button, disabled reason), `wire.ts`
  (listens to `tekpractice:tutorial`, status line, `shown`), COPY `assist` + deck.
- **Tests first (unit, real store + History):** two CONNECTs, one undo entry, one undo removes both; not offered without a strip, with a Bêta
  strip, when powered, when the strip is full; refusal → rollback, nothing recorded; never `SET_CONTROL` or `SPAWN`; a Propriétés burst open
  (`onBeforeCommand`). e2e: in a tutorial run at step 8 the button is disabled with its reason until `helperUnlocked`; outside a run it is enabled
  once a strip exists; Ctrl+Z removes both cables.
- **Depends:** T1.3b, T3.2. **Tier:** most capable. **Hot:** copy.ts.

### T3.4 Escalation to the helper
- **Files:** `src/guide/tutorial.ts` (`hintAfterMs` from the package pacing on steps 8 and 9; third tier rings `nav:checklist-power` and sends
  `helperUnlocked`), `tests/guide/tutorial.test.ts`.
- **Tests first:** no unlock before a strip and before tier 3 (does not trigger); unlock at tier 3 (triggers); helper-done steps recorded
  `shown`, no celebrate.
- **Depends:** T3.3. **Tier:** standard.

**T3 close:** **opus review** of T3.1a to T3.4 against spec 6; full baseline e2e; deep scan; ledger.

---

## Phase T4: package colours, tokens, layouts

### T4.1 Five colour maps and contrast (declared)
- **Files:** `src/design/packages.ts` (spec 7.2 / 7.3 rows), `tests/design/packages.test.ts`, COPY package names + deck.
- **Tests first:** every declared pair >= 4.5 text / >= 3 UI; a crafted Ambre-on-Papier text pair fails; **no two packages share a colour map;
  no two share a layout preset; no `oscarCorner: 'tl'`**; pacing ids exist in the step list.
- **Depends:** T0.1, T3.1a. **Tier:** standard. **Hot:** copy.ts.

### T4.2 Role tokens and guide theme
- **Files:** `src/design/creationTokens.ts` (`injectCreationTokens(root, roles?)`; new `--cr-focus`, `--cr-select` default Ambre),
  `creation.css` (the 53 `--cr-ambre` uses classified: focus, select, hover, border, state; focus/select/hover/border move to the role tokens),
  `src/guide/theme.css`, `src/design/packages.css`, `tests/creation/creationTokens.test.ts`.
- **Tests first:** no package → exactly today's computed values (characterization + mutation); package 3 resolves focus to Nuit.
- **Depends:** T4.1. **Tier:** standard. **Hot:** creation.css.

### T4.3 Layout presets
- **Files:** `layout.ts` (initial panels, surface style class; the phone accordion still wins under 760 px), `inventoryDrawer.ts` (`stay-open`),
  `mount.ts` (corner default via the storage wrapper), `creation.css`.
- **Tests first:** e2e package 2 opens both panels; package 1 keeps the drawer open after a placement; under 760 px the accordion rule holds.
- **Depends:** T4.2. **Tier:** standard. **Hot:** layout.ts, mount.ts, creation.css.

### T4.4 Contrast in use
- **Files:** create `tests/e2e/onboarding-contrast.spec.ts`.
- **Tests first:** per package, computed focus-ring, hover-border and dialog-border colours against their resolved backgrounds; axe
  `color-contrast` on package 3; a CSS scan that no rule under package 3 resolves Ambre as text, outline or border on Papier.
- **Depends:** T4.3. **Tier:** standard.

**T4 close:** ADR 0017; full baseline e2e; deep scan; ledger.

---

## Phase T5: the new Oscar

### T5.1 Character construction
- **Files:** create `src/guide/character.ts` (spec 10.2 construction; pure `stateFor(vendorState, hostEvent)` mapping and timer plan),
  `tests/guide/character.test.ts`.
- **Tests first:** DOM-call construction only (fake document; no `innerHTML`, no raster, no data URI); groups head / cups / arm / led; mapping
  `no` → shrug; host states end after their duration; timers cleared on destroy.
- **Depends:** T1 close. **Tier:** standard.

### T5.2 Motion sheet and 24 px silhouette
- **Files:** create `src/guide/character.css` (timing sheet; every animation finite; vendored infinite animations overridden under the host
  class), create `tests/e2e/character.spec.ts`.
- **Tests first:** 24 px silhouette pairs >= 6 % pixel difference and idle vs a plain circle; 6 s after any state `getAnimations()` empty; reduced
  motion: no animation, distinct static poses.
- **Depends:** T5.1. **Tier:** most capable.

### T5.3 Skin wiring and pointing direction
- **Files:** `src/guide/mount.ts` (append the character, `MutationObserver` on `data-state`, `data-dir` from the ring bearing), `theme.css` (hide
  `svg.oscar-mascot`), `tests/guide/mount.test.ts`, `tests/e2e/character.spec.ts`, `guide-creation.spec.ts`.
- **Tests first:** pin test on `.oscar-icon`, `.oscar-mascot`, `data-state`; host SVG fits the 56 px icon; at every tutorial step the arm vector
  dot the vector to the ring > 0; a refused connection shows shrug; listener count unchanged.
- **Depends:** T5.2. **Tier:** most capable. **Hot:** mount.ts.

### T5.4 « Oscar · Assistant » badge
- **Files:** `src/guide/character.ts` (badge element in the bubble header, >= 12 px), `theme.css`, COPY + deck, `tests/e2e/character.spec.ts`.
- **Tests first:** the badge is visible with every open bubble, font size >= 12 px, text « Oscar · Assistant »; the icon's accessible name stays
  « Oscar, assistant IA ».
- **Depends:** T5.3. **Tier:** cheap. **Hot:** copy.ts.

### T5.5 Oscar policy per package and profile
- **Files:** `mount.ts` (muted on first mount for `proactive: false` or the engineer, only with no stored mute), `tests/guide/mount.test.ts`.
- **Tests first:** engineer + nothing stored → muted; a learner who unmuted stays unmuted. Record every `muted` effect read in `controller.ts`.
- **Depends:** T5.4, T4.1. **Tier:** cheap. **Hot:** mount.ts.

**T5 close:** **opus review** (character, motion, vendor seam, patch list); ADR 0018; ledger.

---

## Phase T6: presenters and package behaviour

### T6.1 Step card in a reserved slot
- **Files:** `layout.ts` + `creation.css` (`[data-testid="tutorial-slot"]` grid row, present only while a tutorial runs), create
  `src/guide/stepCard.ts`, `tests/guide/stepCard.test.ts`.
- **Tests first:** progress only (« Étape k sur n », ticks, « passée », « montré », « Passer le tutoriel »); never the bubble's sentence; never
  « réussi »; n follows the package pacing; e2e: not a dialog, no trap, Aide « Aller à l’étape » focuses it.
- **Depends:** T3.2, T4.3. **Tier:** standard. **Hot:** layout.ts, creation.css.

### T6.2 Checklist panel form, package configs
- **Files:** `checklist.ts` (panel form), `src/design/packages.ts` (final rows), `menuBar.ts` (shortcuts beside controls), e2e per package.
- **Tests first:** the presenter and checklist form named in the table are the ones on screen; package 4: no proactive bubble in 60 s.
- **Depends:** T6.1. **Tier:** standard.

### T6.3 Package 5: the playable model route
- **Files:** `wire.ts` (start on `premier-son-pret`), `tutorial.ts` pacing, `tests/e2e/onboarding-tutorial.spec.ts`.
- **Tests first:** opens the model; step 1 is `ecoute`; after `debrancher` the voice count drops by one and the text names one speaker;
  `rebrancher` restores it.
- **Depends:** T6.2, T1.6. **Tier:** standard.

### T6.4 Entrepreneur after the first sound
- **Files:** `wire.ts`, COPY + deck, `tests/e2e/onboarding-tutorial.spec.ts`.
- **Tests first:** profile 3 only, after the first `playStarted`: the own-gear line and three generic venue cards labelled « salle d’exemple, non
  vérifiée », no digit in any card; profile 1 sees nothing.
- **Depends:** T6.3. **Tier:** cheap. **Hot:** copy.ts.

**T6 close:** full baseline e2e; deep scan; ledger.

---

## Phase T7: the suite

### T7.1a Parity and journeys per profile
- **Files:** create `tests/e2e/onboarding-parity.spec.ts`: DOM parity (11.1), 4 profiles x package 1, exam / `?oscar=0` absence (11.10).
- **Depends:** T6 close. **Tier:** standard.

### T7.1b Geometry and axe
- **Files:** create `tests/e2e/onboarding-geometry.spec.ts`: 11.3 (icon, bubble, step card; three viewports; per step at 1366) and 11.4.
  `test.describe.configure({ mode: 'parallel' })` per package, `expect.poll` for the 500 ms bridge poll.
- **Depends:** T6 close. **Tier:** standard.

### T7.1c Keyboard journey and runtime honesty scan
- **Files:** create `tests/e2e/onboarding-keyboard.spec.ts`: 11.6 keyboard-only first sound per package; 11.11 runtime scan of visible text,
  `aria-label` and `title` at every step.
- **Depends:** T6 close. **Tier:** standard.

### T7.2 Scripted route with per-step checks
- **Files:** create `tests/e2e/first-timer-proxy.spec.ts` (11.8).
- **Acceptance:** dialog route <= 34 actions for packages 1 to 3; packages 4, 5 and the port-click route: first green run recorded, then held at
  measured + 10 % (only lowered later); words <= 200; the ledger gets the modelled floor per package, labelled « floor for a known route ».
- **Depends:** T7.1c. **Tier:** most capable.

### T7.3 Engine neutrality in the browser
- **Files:** create `tests/e2e/engine-neutrality.spec.ts` (11.9 with the perturbed fixture), `tests/engineImports.test.ts` (import scan).
- **Depends:** T7.2. **Tier:** standard.

### T7.4 Visual baseline, then assert
- **Files:** create `tests/e2e/onboarding-visual.spec.ts` (11.7 squint test + 11.13 snapshots, retries off, state waits, canvas masked); the
  baseline images under the spec's snapshot folder, committed in this task.
- **Steps:** create the baseline once (`--update-snapshots`), look at every image, commit, run again without the flag: green. Never update
  outside this task.
- **Depends:** T7.3. **Tier:** standard.

**T7 close:** **opus review** of the suite (do the tests prove the spec, or only themselves?); `package.json` `test:onboarding`; ledger.

---

## Phase T8 to T10

### T8.1 Captures and storyboard (stills only)
- **Gate:** the founder's grant for stills and storyboards is in the ledger (2026-11-12). No video.
- **Files:** create `tests/e2e/tutorial-captures.spec.ts` (`CAPTURE=1`, port 4392, local build; overlay per spec 12; pixel check that no label
  box sits on Papier), `docs/tutorial/storyboard.md`. Captures to `docs/tutorial/captures/`, **not committed**.
- **Depends:** T7 close. **Tier:** standard.

### T9.1 Copy deck pass
- **Files:** deck (status legend « à valider (tekuxwriter) », notes on every new row), `copy.ts`. List every new key in the ledger.
- **Depends:** T8.1. **Tier:** cheap. **Hot:** copy.ts.

### T9.2 Docs and founder deliverables
- **Files:** `docs/design-system.md` (section « Packages de design »: identities, role maps, contrast table), `docs/guides/tester-les-5-designs.md`
  (French: `npm run onboarding:local`, the five addresses, what to look at, reset of the first visit, what is not measured), ADRs 0016 to 0018.
- **Depends:** T9.1. **Tier:** cheap.

### T10 Final gate and report
- [ ] Full gate green; counts against the baseline; engine diff empty; `rulesRevOf` unchanged.
- [ ] **Opus review of the whole branch** against spec v2, the council decisions and the founder's answers.
- [ ] `git log --oneline origin/guide/oscar-wiring..HEAD`: every commit local, explicit paths, no private names.
- [ ] Report (runbook « Deliverables »). Stop: no push, no deploy.
- **Tier:** most capable.

---

## Overnight runbook (controller)

**Loop per task.** (1) Pick the next task whose dependencies are done and whose hot files are free; write the hot-file lock line. (2) Dispatch a
fresh implementer with: the task text, the spec sections it names, the global constraints, the gate. (3) The implementer writes the tests, runs
them, pastes the red assertion, implements, runs the gate, commits with explicit paths, reports. (4) Dispatch a different agent as reviewer with
the diff and the acceptance criteria. (5) Fix findings in the same task (counts as a retry if the gate is re-run red). (6) Ledger line; release
the lock.

**Retry cap.** At most **3** failed gate runs per task. On the third: stop the task, revert its uncommitted changes (`git checkout -- <its
paths>`; never `reset --hard`), write a « PARKED » ledger entry (task, last red assertion, hypothesis), continue with tasks that do not depend on
it.

**Stuck / timeout rule for implementers.** More than 90 minutes on one task, or more than 3 failed gate runs: stop and report, do not improvise a
workaround (no test seams in the proxy, no loosened budgets or thresholds, no `--update-snapshots`, no skipped tests, no edits of pinned tests
without a ledger reason).

**What may be parked without breaking the branch.** Any task whose dependants are also parked; specifically safe to park alone: T1.6 (then T6.3
parks, package 5 falls back to the neutral room with a ledger note), T1.7 extensions, T2.5 (framing stays default), T4.4, T5.2's 24 px test (not
the motion caps), T5.4, T6.4, T7.4, T8.1, T9.x. **Never park:** T0.1, T1.2a/b, T1.5a/b, T2.1, T2.3, T3.1a to T3.2, T3.3's tutorial gate, T7.2,
T7.3: if one of these parks, stop the phase and report.

**Red baseline.** If pre-flight finds red tests: rerun once on a fresh build. Still red: record the failing tests as pre-existing in the ledger
with their assertion lines, exclude exactly those from gate comparisons (by name), and never count them green; if a pre-existing red touches a hot
file of the next task, park that task and report.

**Reviews, in order.** Per-task independent review always. Opus reviews at T3 close, T5 close, T7 close, then the whole branch at T10. A Critical
from an opus review blocks the next phase until fixed or explicitly rejected in the ledger with a reason.

**Ports and checkout hygiene.** 4391 for suites, 4392 for captures and the local run; free them after each run; never another worktree, never
`E:\dev\Tekonest`, never a shared `dist` from another checkout (each run builds this worktree's `dist`).

**Local commits only.** Before T10: `git log origin/guide/oscar-wiring..HEAD` reviewed; no push, no deploy, no upstream set.

**Deliverables for the founder (T10).** (1) A report in the ledger and in the final message: what was built, parked items with reasons, the
modelled floors per package (labelled), the open decisions. (2) One command to run the five packages locally: `npm.cmd run onboarding:local`
(prints the five addresses on port 4392). (3) The test guide `docs/guides/tester-les-5-designs.md`.

## Open founder decisions (short)

Helper scope; « IA » in Oscar's name (kept for now); the reference template (note or fix in place); « 3 minutes » wording; the rule override
texts and the legacy route keeping the old ones; captures with product-photo-derived textures; the default package; celebrate on the first
connection or only at the first sound.

## Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Real beginners take longer than 3 minutes | high | high | no minutes in UI; scripted route proves only no dead end; founder times people later | founder |
| Vendored patch lost at a re-vendor | medium | medium | `VENDOR.json` `patches`, patch list, pin test; send upstream | guide owner |
| Character skin breaks on renamed vendored classes | low | medium | pin test | T5.3 |
| Hot-file conflicts overnight | high | medium | hot-file lock, one writer, wiring modules | controller |
| Start screen leaks into the default | low | high | `?design`-only rule, does-not-trigger tests, 45 specs as guard | T2 |
| Stale `dist` gives a false green | medium | high | build before every e2e, `e2e:fresh` | every implementer |
| Override texts drift from the four sites | low | high | one accessor, the four-site e2e | T1.5 |
| Five packages judged on taste (N = 1) | high | medium | said in the guide; squint test proves only distinctness | founder |
| Snapshot flake on software GL | medium | low | own file, retries off, state waits, canvas masked, baseline task | T7.4 |
| Budget exceeded | medium | medium | lazy chunks, never loosen | each implementer |
| 40 px needs < 2 m radius | low | medium | T2.5 stops and reports | T2.5 |

**Task count: 47** (T0.1 to T10).

---

## Council 2: what changed

Every Critical and Should-fix finding of round 2, with its answer. « Fixed » = the text now says it (section named); « Rejected » = not taken, with
the reason.

### Architecture and tests (READY WITH CONDITIONS, 70 %)
- **C1 ordering:** fixed. New T0.1 skeleton before every reader; T4.1 only fills colours.
- **C2 stale build:** fixed. Gate step 4 builds first; `e2e:fresh` (T0.2); the red assertion is pasted in the ledger.
- **C3 proxy:** fixed. Budgets from arithmetic (dialog route 28 to 34) and measurement (+10 %, only lowered); steps ring the tab, the item and the
  Propriétés « Connecter à… » button (new reserved anchors, spec 6.3); relabelled « scripted route with per-step checks » (spec 1, 11.8).
- **C4 restart on reload:** fixed. `request` / `handledRequest` (spec 4.4); e2e « finish, reload: no restart » (T3.2).
- **C5 neutrality:** fixed. Browser-level e2e with a perturbed fixture (spec 11.9, T7.3); node test kept only as an import scan.
- **C6 geometry:** fixed. Rect intersection; icon, bubble and step card; step card in a reserved grid slot (spec 6.6); 820 px overlap stated as
  about 55 px (spec 8.1); 1024 / 820 cases in T1.2b, no `fixme`.
- **S1 hot files:** fixed (« Hot files », `wire.ts`). **S2 sizing:** fixed (T3.1 → a/b/c, T2.4 → a/b, T7.1 → a/b/c, T1.2, T1.3, T1.5 split).
- **S3 start stage:** fixed (own Échap, confirm `setInert` set, Aide with no place, « Tous les lieux » un-inert test; spec 4.2, T2.3, T2.4b).
- **S4 snapshots:** fixed (T7.4 baseline task; never update outside it). Layout assertions are the gate elsewhere.
- **S5 flake:** fixed (parallel per package, `expect.poll`, per-step geometry at 1366 only).
- **S6 contrast in use:** fixed (T4.4, spec 11.2).
- **S7 stuck protocol:** fixed (runbook; budgets never loosened; pinned tests need a ledger reason; vendor ruling in pre-flight).
- **S8 character testability:** fixed (pure mapping and timers, destroy clears timers, e2e size check; T5.1, T5.3).
- **S9 VENDOR.json sourceCommit:** fixed (`patches` field).
- **S10 characterization tests:** fixed (labelled, one mutation each).

### Honesty (READY WITH CONDITIONS, 76 %)
- **1 rule-text override:** fixed per the controller ruling: no catalog edit; one accessor at the four sites (spec 8.4, T1.5a/b); texts in spec
  Appendix A with the current text beside each; R1 to R5 overridden (R4 and R5 added by the sweep), R6 to R8 reviewed and kept; the legacy
  route keeps the old texts and this is reported.
- **2 package 5:** fixed (`ecoute` first; per-speaker wording; voice-count assertion; spec 7.2, T6.3).
- **3 mic line:** fixed (only with a mic cabled; spec 6.3, 6.4, T1.3a).
- **4 template pitch:** fixed (rewritten pitch, per-template notes, every-template test; spec 8.5, T1.6).
- **5 helper gate:** fixed (disabled with reason during steps 8 and 9 until `helperUnlocked`; offer sentence written; spec 6.5, T3.3).
- **6 mains teaching:** fixed (power note in step 7).
- **7 « Assistant IA »:** per the controller ruling the name stays; the keyword-lookup fact is flagged for the founder; the badge is built (T5.4).
- **8 banned list:** fixed (extended families and surfaces, runtime scan; spec 9, 11.11, T1.7, T7.1c).
- **9 « convient »:** fixed (« est compatible »). **10 step 2:** fixed (names the SM58; condenser case marked unverified).
- **11 « never disagree »:** fixed (claim dropped; spec 6.3). **12 entrepreneur:** fixed (own-gear line; generic venue cards, no figures; T6.4).
- **13 test-signal scope:** fixed (`listen.simple` by key).

### Character, brand, five designs (READY WITH CONDITIONS, 72 %)
- **C1 new character:** fixed (character brief, construction, face rules, 24 px test; spec 10.2, T5.1, T5.2).
- **C2 five identities:** fixed (identity table with tells, distinct colour maps and layouts, contrast numbers; spec 7.2, 7.3; distinctness and
  squint tests; T4.1, T7.4). Package 3's Ambre focus, hover and dialog borders move to role tokens (T4.2).
- **C3 looping motion:** fixed (timing sheet, every loop capped, `getAnimations()` test; shrug is a head tilt).
- **S1 point direction:** fixed (`data-dir`, dot-product test; T5.3).
- **S2 one sentence once:** fixed (step card = progress only; canvas centre free).
- **S3 celebration inflation:** partly taken: connections nod, celebrate only at the first accepted connection and the first sound. **Rejected in
  part:** « nod only on connections », because the founder's own brief says Oscar « celebrates a correct connection »; listed as founder
  decision 8.
- **S4 Zzz:** fixed (standby LED, closed lids, 70 %). **S5 badge:** fixed (bubble header, >= 12 px; T5.4).
- **S6 corner:** fixed (`oscarCorner` per package; `tl` forbidden).

### Not resolved here (needs a run or the founder)
The 7 m framing, the live audio reaction to an unplug while playing, whether a condenser blocks « Micro OK », every effect of `muted`, and the
founder decisions above.
