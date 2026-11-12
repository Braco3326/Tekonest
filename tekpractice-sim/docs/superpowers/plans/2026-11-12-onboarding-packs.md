# Onboarding packs: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. One fresh implementer per task, one independent
> reviewer per task (a different agent from the implementer), and the ledger updated after every task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** the first visit, the tutorial, the new Oscar character and five design packages of the spec, built as one engine with a typed package
table, with the stand-alone honesty and first-sound fixes shipped first.

**Spec (read it first; this plan only decides files, tests and order):** `docs/superpowers/specs/2026-11-12-onboarding-packs-design.md`.

**Ledger:** `E:\dev\Tekonest-wt\onboarding\.superpowers\ledger.md` (git-excluded). After each task append one line: task id, commit, gate result,
reviewer verdict, anything parked. Founder answers and rulings go there too, verbatim, with the date.

**Tech:** TypeScript strict, Babylon.js 7, Vite, zod, vitest (environment `node`: no DOM in unit tests, so DOM behaviour is proven in e2e and the
logic lives in pure modules), Playwright with `@axe-core/playwright`.

## Global constraints (every task)

- Worktree `E:\dev\Tekonest-wt\onboarding` (git root), code in `tekpractice-sim`. Branch `design/onboarding-packs`, upstream unset,
  `push.default=nothing`. **Never push, never deploy.** Git needs `-c safe.directory=E:/dev/Tekonest-wt/onboarding`.
- Commit after every task, `git add` with **explicit paths only**, ASCII message, ending with the `Co-Authored-By` trailer of the model that did
  the work.
- The repo is public: no private file names, no names of people, nothing about money, nothing from private folders.
- **`src/engine` untouched:** `git diff c51dc87 -- tekpractice-sim/src/engine` must stay empty. Legacy route and exams unchanged; `?oscar=0` still
  silences the guide; Oscar and the tutorial absent on any exam address.
- **No `?design` = today's behaviour** plus the stand-alone fixes of T1 (spec section 2).
- Pinned honesty strings byte-identical (spec 9). Every new user string = a COPY key + a deck row, status « à valider (tekuxwriter) », French
  « vous ». No STI / SPL / « réaliste » / exam-success / safety claims; no minutes figure; Ambre text on Papier never.
- Catalog = source of truth: never edit `content/catalog.json` without a founder yes recorded in the ledger (only T1.5 asks).
- `src/creation/**` never imports `src/guide/**` (`tests/guide/creationIsolation.test.ts`); nothing in `src/creation` but `store.ts` imports
  `ConnectionGraph` (`tests/creation/shellImports.test.ts`); nothing outside `src/guide` imports `src/guide/vendor` except `src/main.ts`.
- New lazy code stays lazy: run `npm.cmd run budget` after any task that adds a module reachable from `src/creation/boot.ts` (the creation start
  may not exceed the legacy start x 1.15; the start screen, tutorial and character load in lazy chunks).
- PowerShell for Playwright; `npm.cmd` / `npx.cmd`. Ports: **4391** for suites, **4392** for captures. Never 4173, 4174, 4181, 5173, 3060.
  E2E: `$env:E2E_PORT='4391'; npx.cmd playwright test <files>` (the preview serves `dist/`: run `npm.cmd run build` first).
- Tests first: write the named tests, run them, see them fail for the right reason (red), then implement. Every rule-like behaviour gets a
  « triggers » case and a « does not trigger » case.

## Pre-flight (once, before T1)

- [ ] `git -c safe.directory=E:/dev/Tekonest-wt/onboarding status -sb` shows `design/onboarding-packs` with no upstream, clean tree.
- [ ] `git -c safe.directory=E:/dev/Tekonest-wt/onboarding config --get push.default` prints `nothing`.
- [ ] Ports free: `Get-NetTCPConnection -LocalPort 4391,4392 -ErrorAction SilentlyContinue` returns nothing.
- [ ] Baseline gate, recorded in the ledger with counts (tests passed / skipped):
  `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run validate:catalog`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run budget`,
  `$env:E2E_PORT='4391'; npx.cmd playwright test creation- guide-creation exam guide-legacy`.
- [ ] Engine baseline: `git diff c51dc87 -- tekpractice-sim/src/engine` is empty.
- A red baseline is fixed or recorded as pre-existing **before** T1 starts (otherwise later gates cannot be read).

## Gate (after every task)

1. `npx.cmd tsc --noEmit` and `npm.cmd run lint` clean.
2. `npm.cmd test` green (all vitest, including the copy deck, vendor, isolation and shell-imports tests).
3. `npm.cmd run validate:catalog` green.
4. The task's own e2e files on port 4391 green; at the end of each phase (T1, T2, …) the full baseline e2e set too.
5. `git diff c51dc87 -- tekpractice-sim/src/engine` empty.
6. `npm.cmd run build` and `npm.cmd run budget` green when the task touched anything reachable from the boot.
7. Independent review (a different agent): reads the diff against the spec section and this task's acceptance criteria; verdict in the ledger.
8. Deep scan before each phase is closed (the whole phase diff, not the last task only): a reviewer re-reads every changed file for leftovers,
   dead code, unpinned strings and claims the tests do not back.

**Opus reviews (most capable tier, independent):** after T3 (tutorial + helper), after T5 (character + vendor seam), after T7 (test suite) and the
whole branch at T10.

## Parallel lanes

Tasks touching `src/creation/boot.ts` are serialised (it is the hot file). Safe in parallel (disjoint files):
- T1.1 (guide mount) || T1.3 model part (new creation module) || T1.6 (content + two specs) || T1.7 (new test file).
- T4.1 (src/design) || T3.1 data part (flows + COPY tutorial section) once T2.1 is merged.
- T5.1 (character module) || T6.1 (step card) once T3.2 is merged.
- T8.1 and T9.2 after T7.

## File map

Create:
- `src/creation/onboarding/state.ts` (pure state machine + storage), `profiles.ts` (ProfilePreset table), `startScreen.ts` (DOM stage of the picker)
- `src/creation/checklistModel.ts` (pure), `src/creation/shell/checklist.ts` (DOM)
- `src/creation/powerHelper.ts` (pure planner + executor over History)
- `src/design/packages.ts` (DesignPackage table, `designFromSearch`, `activePackage`), `src/design/packages.css`
- `src/guide/character.ts` (SVG character, skin wiring), `src/guide/character.css`
- `src/guide/stepCard.ts`, `src/guide/tutorial.ts` (annotations, reserved anchors, start / resume glue)
- `src/guide/VENDOR-PATCHES.md`
- `content/templates/premier-son-pret.json`
- Tests: `tests/creation/onboardingState.test.ts`, `profiles.test.ts`, `checklistModel.test.ts`, `powerHelper.test.ts`, `honesty.test.ts`,
  `pinnedStrings.test.ts`, `tests/design/packages.test.ts`, `tests/design/noDesignBranching.test.ts`, `tests/guide/tutorial.test.ts`,
  `tests/guide/character.test.ts`, `tests/guide/vendorPatches.test.ts`, `tests/guide/stepCard.test.ts`, `tests/engineNeutrality.test.ts`,
  `tests/e2e/guide-overlap.spec.ts`, `onboarding-start.spec.ts`, `onboarding-tutorial.spec.ts`, `onboarding-packages.spec.ts`,
  `first-timer-proxy.spec.ts`, `tutorial-captures.spec.ts` (skipped unless `CAPTURE=1`)
- Docs: `docs/adr/0016-onboarding-start-screen.md`, `0017-design-packages.md`, `0018-guide-character-and-vendor-patch.md`,
  `docs/tutorial/storyboard.md`, `docs/guides/tester-les-5-designs.md`

Modify (main ones): `src/creation/boot.ts`, `src/main.ts`, `src/creation/shell/placePicker.ts`, `layout.ts`, `statusBar.ts`, `menuModel.ts`,
`inventoryDrawer.ts`, `src/creation/copy.ts`, `docs/copy/creation-mode.md`, `src/creation/debug.ts` (two readers), `src/design/creationTokens.ts`,
`src/guide/mount.ts`, `flows.creation.ts`, `verdict.ts`, `bridge/creationBridge.ts`, `bridge/shared.ts`, `theme.css`, `docs/design-system.md`.

---

## Phase T1: honesty and first-sound fixes that stand alone (default and every package)

### T1.1 Oscar's resting position clears the open panels and the drawer
- **Goal:** the resting icon never covers a control of Projet, Propriétés, the drawer or the bars.
- **Files:** modify `src/guide/mount.ts` (`hostInsets`), `tests/guide/mount.test.ts`; create `tests/e2e/guide-overlap.spec.ts`.
- **Tests first:** `mount.test.ts` « hostInsets adds the open Propriétés width on the right » (fake doc: props rect 260 wide → `right` 260),
  « a collapsed panel counts its 32 px rail », « an open inventory drawer adds its height to bottom », « no panel, no drawer: bars only »
  (does-not-trigger), « a throwing getBoundingClientRect gives no insets ». e2e `guide-overlap.spec.ts`: at 1366 x 768, 1024 x 768,
  820 x 1180 with a place open and Propriétés open, `elementFromPoint` at the centre of every visible `button, [role=menuitem], input, select`
  of the shell never returns a node inside `[data-oscar-root]` (red today: the icon covers « Connecter à… »).
- **Steps:** read the panels' rects from `[data-testid="project-tree"]`, `[data-testid="properties"]`, `[data-testid="inventory-drawer"][data-open="true"]`;
  keep the try/catch; leave the vendored cap (quarter of the viewport) alone and note in the test why 1024 px still needs T1.2.
- **Acceptance:** unit tests green; e2e green at 1366 x 768 and 820 x 1180; at 1024 x 768 the only failures are the 4 px cap case, marked
  `test.fixme` with a pointer to T1.2.
- **Depends on:** pre-flight. **Tier:** standard. **Risk:** `guide-creation.spec.ts` asserts the resting position clear of the status bar only;
  re-run it.

### T1.2 Obstacle avoidance in the vendored placement (gated vendor patch)
- **Gate before starting:** the ledger records the decision « local vendor patch, listed, pinned » (spec 10.3). Without it, skip T1.2, keep the
  T1.1 fixme and list the residual in the T10 report.
- **Goal:** the walking / pointing icon never lands on a control; the 1024 px case passes.
- **Files:** modify `src/guide/vendor/core/motion.ts` (`MotionInput.avoid`, `placeBeside(..., avoid)` skips candidate boxes intersecting any
  avoid rect, falls back to the least-overlap box), `src/guide/vendor/ui/widget.ts` (`MountOptions.obstacles?: () => Rect[]`, passed to
  `planMotion` in `applyTarget`; resting position nudged off an obstacle), `src/guide/vendor/VENDOR.json` (new hashes), `src/guide/mount.ts`
  (supplies obstacles: visible shell buttons, menu items, inputs, cached `RECT_CACHE_MS`); create `src/guide/VENDOR-PATCHES.md`,
  `tests/guide/vendorPatches.test.ts`.
- **Tests first:** `vendorPatches.test.ts`: « placeBeside with an avoid rect beside the target picks another side » (triggers), « no avoid list:
  same result as before » (does not trigger, byte-for-byte the old candidates), « every rect avoided: least overlap, crowded true »; « every
  patch listed in VENDOR-PATCHES.md names a file whose hash is in VENDOR.json » and « the patched symbols exist » (fails if a re-vendor drops
  the patch). e2e: un-fixme T1.1's 1024 px case; add « during each step of premier-montage » positions.
- **Steps:** patch, recompute hashes with the same sha256 the vendor test uses, write the patch list (file, function, reason, pin test, « to send
  upstream »).
- **Acceptance:** `tests/guide/vendor.test.ts` green with the new hashes; overlap spec green on all three viewports, resting and pointing.
- **Depends on:** T1.1. **Tier:** most capable. **Risk:** a later re-vendor overwrites it (the pin test catches it); keep the diff minimal.

### T1.3 The checklist « Pourquoi je n'entends rien ? »
- **Goal:** a read-only view over the signal path's reasons, beside the greyed Écoute items and in the status bar.
- **Files:** create `src/creation/checklistModel.ts`, `src/creation/shell/checklist.ts`, `tests/creation/checklistModel.test.ts`; modify
  `src/creation/shell/statusBar.ts` (chip slot), `src/creation/shell/menuModel.ts` (a link line under the greyed Écoute items), `src/creation/boot.ts`
  (wire `path` and the selection), `src/creation/copy.ts` + deck (section `checklist`), `tests/e2e/creation-status.spec.ts`.
- **Tests first (unit):** « every ReasonCode maps to exactly one row or to the mic line » (exhaustive `Record`), for each code « blocked row
  shows the reason's text_fr verbatim », « rows after the first blocked gate are not-yet-checked, never ticked » (`SOURCE_OFF` with nothing powered),
  « all rows ticked only when playbackReady » (triggers) and « not ticked when playbackReady is false and no reason » (does not trigger), « the
  fixed mic line is always present ». e2e: on the blank room with QL1 + SM58 + K12.2 cabled, the chip is visible, opens a non-modal list with
  the « Lecture console » row blocked; « Aller à » selects the console and changes nothing in `design()`; hidden when `playbackReady`; Échap
  closes it and focus returns to the chip; axe clean.
- **Acceptance:** works with `?oscar=0`; the status bar's existing texts unchanged; deck mirror green.
- **Depends on:** pre-flight. **Tier:** standard. **Risk:** status-bar width at 820 px (check `creation-narrow.spec.ts`).

### T1.4 Oscar says what to do
- **Goal:** the next-step verdict keeps the reason verbatim and adds one « vous » action sentence per reason code.
- **Files:** modify `src/guide/verdict.ts`, `src/creation/copy.ts` + deck (section `assist`: one key per ReasonCode), `tests/guide/verdict.test.ts`,
  `tests/guide/brain.test.ts`, `tests/e2e/guide-creation.spec.ts` (bubble texts).
- **Tests first:** for each code « the verdict's label is `<reason> <action>` with the action from COPY.assist » (triggers); « a rule error still
  quotes the catalog text and adds nothing » (does not trigger); « no action sentence contains a digit or a banned phrase ».
- **Acceptance:** chips no longer repeat the status bar alone (e2e checks « Prochaine étape » on a SOURCE_OFF bench contains « Lecture
  console » and « Propriétés »).
- **Depends on:** pre-flight. **Tier:** standard. **Risk:** guide strings rules (`TP_STRINGS` impersonal, no digit) do not apply to COPY; keep
  the new text in COPY only.

### T1.5 Rule texts as simulator rules (founder-gated catalog edit)
- **Gate:** the founder's yes on the exact new `teach_fr` of R1 and R3 is in the ledger. Without it: only add the two ids to the honesty test's
  pending list (T1.7) and stop.
- **Goal:** R1 and R3 stop making real-world safety claims.
- **Files:** `content/catalog.json` (two `teach_fr`), `docs/copy/creation-mode.md` (« Textes des règles », « Propositions en attente »),
  `tests/creation/ruleTexts.test.ts` if it pins them.
- **Tests first:** honesty test (T1.7) without the pending exception for R1 / R3 goes red, then green after the edit.
- **Acceptance:** `validate:catalog` green; R2's « 40 dB » untouched and listed for the founder.
- **Depends on:** T1.7. **Tier:** cheap. **Risk:** catalog drift; touch only `teach_fr`.

### T1.6 A playable model in the neutral room (content-only)
- **Goal:** a template that plays the test signal on open, without changing the reference template.
- **Files:** create `content/templates/premier-son-pret.json` (room `blank`; QL1, SM58, K12.2 x 2, multiprise; mic cable, two line cables
  `out-main-l -> k12-g.in-line-a` and `out-main-r -> k12-d.in-line-a`, three mains cables, `controls: { ql1: { 'playback-usb': true } }`; display
  name without « Concert simple »; positions inside 24 x 14 m); modify `tests/creation/templates.test.ts` (new expectations),
  `tests/e2e/creation-picker.spec.ts` (template count 2), `tests/e2e/creation-keyboard-patch.spec.ts` (arrows move between two templates).
- **Tests first:** unit « premier-son-pret: `templateToDesign` + `APPLY_DESIGN` in a CreationStore gives `playbackReady` true through
  `signalPath` » (red until the file exists; also proves the store applies `controls`), « every position is inside BLANK_SIZE », « the name does
  not match /Concert simple/ » (keeps 22 specs' locator unique).
- **Acceptance:** `it.each(files)` schema and `canConnect` tests green; the 22 specs using the reference template untouched and green.
- **Depends on:** pre-flight. **Tier:** cheap. **Risk:** the founder may prefer fixing the reference in place (open decision 3); this file does
  not block that.

### T1.7 Honesty lint and pinned strings
- **Goal:** one test bans the phrases of spec 9 everywhere copy lives, and pins the honesty strings.
- **Files:** create `tests/creation/honesty.test.ts`, `tests/creation/pinnedStrings.test.ts`.
- **Tests first:** honesty: each banned pattern trips on a crafted string (triggers) and a near miss passes (does not trigger: « simulation
  simple », « non vérifié », `splPending`); then the real scan over COPY, `TP_STRINGS`, catalog `teach_fr`, `index.html` text, with a
  `PENDING = ['R1', 'R3']` list that must equal the catalog's actual offenders (a stale entry fails). Pinned: the exact current values of the spec 9
  list.
- **Acceptance:** green on today's code with only the pending list.
- **Depends on:** pre-flight. **Tier:** cheap. **Risk:** false positives on « SPL » inside the pinned `splPending`; allow-list by key.

**Phase T1 close:** full baseline e2e, deep scan, ledger.

---

## Phase T2: profile, offer, state machine, start screen

### T2.1 Onboarding state machine (pure)
- **Goal:** one module decides start screen / picker / workspace and stores the record.
- **Files:** create `src/creation/onboarding/state.ts`, `tests/creation/onboardingState.test.ts`.
- **Tests first:** transitions of spec 4.1 one by one (no autosave + no record → profile stage; record with profile → picker + chip; autosave →
  workspace + chip; Échap on profile → picker with `profile: null`; offer taken / skipped); « no `?design` → never the start screen » (does not
  trigger); blocked storage keeps the record in memory; a corrupt record is replaced; `?design` never written.
- **Acceptance:** 100 % branch coverage of the transition function (asserted by listing every state x event).
- **Depends on:** T1 closed. **Tier:** standard. **Risk:** none beyond naming.

### T2.2 ProfilePreset table
- **Files:** create `src/creation/onboarding/profiles.ts`, `tests/creation/profiles.test.ts`; COPY section `onboarding` + deck.
- **Tests first:** four entries, keys 1 to 4 unique, offer focus as in spec 3, every `labelKey` exists in COPY, no profile names a device number.
- **Depends on:** T2.1. **Tier:** cheap.

### T2.3 The start screen as a stage of the place picker (single `inert` owner)
- **Goal:** profile buttons and the inline offer, inside `mountPlacePicker`, sharing its `inert` handling.
- **Files:** modify `src/creation/shell/placePicker.ts` (`showStart(opts)`, a stage switch, Échap and digit keys), `src/creation/shell/creation.css`;
  create `src/creation/onboarding/startScreen.ts` (DOM of the stage, lazy with the picker chunk); create `tests/e2e/onboarding-start.spec.ts`.
- **Tests first (e2e, `/?design=1`, fresh storage):** the profile stage shows 4 equal buttons and « Tous les lieux »; keys 1 to 4 choose; the offer
  shows two equal buttons (same box size ±1 px) with « conseillé » and « étapes, à votre rythme » and no minutes figure; focus follows
  `offerFocus` (profile 1 → tutorial, profile 4 → Passer); Échap on each stage; `[tree, viewport, props]` are inert while the start screen is open
  and not inert after (one owner); « Tous les lieux » shows today's grids; axe clean; no `?design` → today's picker (does not trigger).
- **Acceptance:** `creation-picker.spec.ts` and every spec opening `/` unchanged and green.
- **Depends on:** T2.1, T2.2. **Tier:** standard. **Risk:** the picker file grows; keep the start stage DOM in its own module.

### T2.4 Boot wiring: profile applied, chip, Aide « Premiers pas », `tutorialAllowed`
- **Files:** modify `src/creation/boot.ts` (`restore()` branch, apply the profile: neutral room via the existing `pick(card, 'empty')` path,
  inventory tab, panels), `src/creation/shell/menuModel.ts` (Aide > « Premiers pas »), `src/creation/shell/inventoryDrawer.ts` (`open({ tab })`),
  `src/main.ts` (`bootCreation({ tutorialAllowed })` from `guideRouteAllowed` + `guideMode`), `src/creation/debug.ts` (reader `onboarding()`),
  `tests/guide/mainTail.test.ts`, `tests/creation/menuModel.test.ts`, `tests/e2e/creation-shortcuts.spec.ts`.
- **Tests first:** e2e « profile 2 + Passer opens the neutral room with both panels open and the drawer on Consoles »; « reload keeps the project
  and shows the chip, not the start screen »; « `?design=1&oscar=0`: profile buttons, no offer » and « `?design=1&mode=exam`: no offer »; unit
  mainTail « passes tutorialAllowed false on an exam address ».
- **Depends on:** T2.3. **Tier:** standard. **Risk:** boot.ts conflicts; this task owns boot.ts for its duration.

### T2.5 First-sound camera framing
- **Files:** modify `src/creation/boot.ts` (apply `FIRST_SOUND_FRAMING` through `host.rig.flyToPreset` once after the neutral room opens from the
  start screen); add the default framing to the package table stub (T4.1 owns the table; until then a constant in `onboarding/profiles.ts`).
- **Tests first:** e2e geometry at 1366 x 768: after placing a QL1, an SM58 and a K12.2 inside the framed view, each projected body is at least
  40 px on its widest axis (readers `bodyBoundsInRoot` + `worldScreen`, allowed in a geometry test); « the default `/` keeps the 19.2 m overview »
  (does not trigger).
- **Acceptance:** the 40 px target met, or the radius tuned and recorded; if 40 px needs a radius under 2 m (the lower limit), stop and record it
  for the founder.
- **Depends on:** T2.4. **Tier:** standard. **Risk:** the 7 m estimate is from one measurement.

**Phase T2 close:** full baseline e2e, deep scan, ADR `0016-onboarding-start-screen.md` written (why a picker stage, why `?design`-only), ledger.

---

## Phase T3: the tutorial engine, the step list, the helper

### T3.1 Step list `premiers-pas` and event annotations
- **Files:** modify `src/guide/flows.creation.ts` (the flow, steps 1 to 10 + `debrancher` / `rebrancher`, reserved anchors), create
  `src/guide/tutorial.ts` (role table from the catalog, `annotateDevice`, `annotateConnect`, `annotatePlayback`, `nextConnectionStepFor(role pair)`),
  modify `src/guide/mount.ts` (annotations, anchor resolution), `src/guide/bridge/creationBridge.ts` (reader `audioState`, event `playStarted`),
  `src/guide/bridge/shared.ts` (`nav:ecoute`, `nav:checklist-power`), COPY section `tutorial` + deck; create `tests/guide/tutorial.test.ts`;
  update `tests/guide/flows.test.ts`, `tests/guide/strings.test.ts`.
- **Tests first:** per step « the annotated event completes it » and « the closest wrong event does not » (an ISA One in step 1; a Genelec cable
  in step 5's place; the phantom toggle in step 6; a `disconnect` in step 4); « only devices with a control-sourced route are `source-console` »
  (today only `yamaha-ql1`, read from the catalog, not hard-coded); « step texts are unique » (the step card relies on it); « total Oscar words
  <= 180 »; « no step text has a banned phrase ».
- **Depends on:** T2 closed. **Tier:** most capable. **Risk:** the vendored flow matcher compares data fields exactly; keep annotation values
  primitive.

### T3.2 Start, resume, skip
- **Files:** modify `src/guide/mount.ts` (watch the `onboarding()` request counter in the existing poll; `send({ type: 'flow', control: { action:
  'start', flowId } })`; package pacing selects step ids), `src/creation/boot.ts` (Aide « Premiers pas » → « Reprendre à l'étape {k} » /
  « Recommencer »), create `tests/e2e/onboarding-tutorial.spec.ts`.
- **Tests first (e2e `/?design=1`):** « Faire le tutoriel » starts step 1 with the ring on the inventory; completing steps 1 to 10 by hand ends
  on the test signal playing; reload mid-way resumes at the same step; « Passer le tutoriel » stops it and Aide re-offers it; `PAGE_LISTENERS`
  pinned count unchanged in `guide-creation.spec.ts`.
- **Depends on:** T3.1, T2.4. **Tier:** standard. **Risk:** the controller's persisted flow is validated against the flows list; keep the id stable.

### T3.3 The power helper (cabling only, one transaction)
- **Files:** create `src/creation/powerHelper.ts`, `tests/creation/powerHelper.test.ts`; modify `src/creation/shell/checklist.ts` (button on the
  « Alimenté » row with `data-testid="checklist-power-helper"`), `src/creation/boot.ts` (status line, `shown` in the onboarding record), COPY
  `assist` keys + deck.
- **Tests first (unit, with a real CreationStore + History):** « QL1 + K12.2 + learner strip: two CONNECT intents strip.out-k → power-in, one
  undo entry, one undo removes both » (triggers); « no strip → not offered », « Bêta strip → not offered », « everything powered → not offered »,
  « strip full → not offered » (does not trigger); « the second pair refused → rollback, nothing recorded, design unchanged » (forced through a
  store stub); « never dispatches SET_CONTROL »; « never SPAWN ». e2e: the button appears only after a strip is placed; after a click the status
  line lists what was added and Ctrl+Z removes both cables.
- **Acceptance:** pre-check with `store.canConnect` so no refusal reaches `onRefused` in the normal path.
- **Depends on:** T1.3. **Tier:** most capable. **Risk:** `history.do` inside a transaction while a Propriétés burst is open (`onBeforeCommand`
  closes foreign bursts: test it).

### T3.4 Oscar's escalation to the helper
- **Files:** `src/guide/flows.creation.ts` (`hintAfterMs` on steps 8 and 9 from the package pacing), `src/guide/mount.ts` (third tier points at
  `nav:checklist-power`), `tests/guide/tutorial.test.ts`.
- **Tests first:** « before the learner placed a strip, no helper offer » (does not trigger); « on step 8, after point then say, the third tier
  rings the helper button » (triggers); « steps done by the helper are recorded `shown`, no celebrate event ».
- **Depends on:** T3.2, T3.3. **Tier:** standard.

**Phase T3 close:** **independent opus review** of T3.1 to T3.4 against spec 6; full baseline e2e; deep scan; ledger.

---

## Phase T4: the DesignPackage table

### T4.1 Table, types, `?design`, contrast
- **Files:** create `src/design/packages.ts`, `tests/design/packages.test.ts`; COPY `onboarding` package names + deck.
- **Tests first:** `designFromSearch` (`?design=1`..`5` → id; `0`, `6`, `abc`, empty, two `design` keys → null); five entries complete; every
  colour is a brand colour or a `CREATION_TOKENS.color` value; every declared text pair >= 4.5 and UI pair >= 3 (spec 7.3), and a crafted
  Ambre-on-Papier text pair fails (triggers); pacing step ids all exist in the step list.
- **Depends on:** T3.1 (step ids). Can start with a stub id list. **Tier:** standard.

### T4.2 Tokens and guide theme per package
- **Files:** modify `src/design/creationTokens.ts` (`injectCreationTokens(root, roles?)`), `src/creation/boot.ts` (one line: active package),
  `src/guide/theme.css` (`--og-*` from the same roles), create `src/design/packages.css`; update `tests/creation/creationTokens.test.ts`.
- **Tests first:** « no package → exactly today's properties » (does not trigger); « package 3 sets the surface to Papier and ink to Nuit »;
  `html[data-design]` set once.
- **Depends on:** T4.1. **Tier:** standard.

### T4.3 Layout presets and the no-branching lint
- **Files:** modify `src/creation/shell/layout.ts` (initial panels from the preset, today's width rules kept when no package),
  `src/creation/shell/inventoryDrawer.ts` (`stay-open` option), `src/guide/mount.ts` (corner default through the storage wrapper); create
  `tests/design/noDesignBranching.test.ts`.
- **Tests first:** lint: a crafted `if (design === 2)` in a fixture string trips the matcher, the real scan of `src/` finds none outside
  `packages.ts`; e2e « package 2 opens with both panels at 1366 x 768 », « package 1 keeps the drawer open after a placement ».
- **Depends on:** T4.2. **Tier:** standard. **Risk:** the phone accordion in layout.ts must still win under 760 px.

**Phase T4 close:** ADR `0017-design-packages.md`; full baseline e2e; deep scan; ledger.

---

## Phase T5: the Oscar character

### T5.1 The SVG character and its poses
- **Files:** create `src/guide/character.ts`, `src/guide/character.css`, `tests/guide/character.test.ts`.
- **Tests first:** « builds only SVG elements through DOM calls (no innerHTML, no image, no raster data URI) » (string scan + a fake document);
  « one class per state for the nine states »; « every state has a static-pose rule inside `prefers-reduced-motion` and `.oscar-reduced` »
  (CSS text scan); « `aria-hidden="true"` on the root ».
- **Depends on:** T1 closed. **Tier:** standard. **Risk:** tone (childish): keep it stylised, shapes only.

### T5.2 Skin wiring, host states, label
- **Files:** modify `src/guide/mount.ts` (append the character to `.oscar-icon`, `MutationObserver` on the vendored `data-state`, `no` drawn as
  shrug, host `nod` on a step done and `wave` on the first open, 1.5 s max; `labels: { iconName }` from COPY once the founder decides), 
  `src/guide/theme.css` (hide `svg.oscar-mascot`); update `tests/guide/mount.test.ts`, `tests/e2e/guide-creation.spec.ts`.
- **Tests first:** pin test « the vendored icon still has `.oscar-icon` and its mascot still carries `data-state` » (fails loudly on a re-vendor);
  e2e « a refused connection shows the shrug pose », « a step done shows nod then returns », « reduced motion: no running animation », one
  screenshot per state (canvas masked); listener count unchanged.
- **Depends on:** T5.1. **Tier:** most capable. **Risk:** coupling to vendored class names (pinned).

### T5.3 Oscar policy per package and profile
- **Files:** `src/guide/mount.ts` (muted on first mount for `oscar.proactive: false` or the engineer profile, only when no mute value is stored),
  `tests/guide/mount.test.ts`.
- **Tests first:** « engineer profile, no stored mute → muted » (triggers); « a learner who unmuted stays unmuted » (does not trigger); read
  `controller.ts` and record in the ledger every effect of `muted` (spec 3 marks it unverified).
- **Depends on:** T5.2, T4.1. **Tier:** cheap.

**Phase T5 close:** **independent opus review** (character, vendor seam, patch list); ADR `0018-guide-character-and-vendor-patch.md`; ledger.

---

## Phase T6: presenters and the five package configurations

### T6.1 Step card presenter
- **Files:** create `src/guide/stepCard.ts`, `tests/guide/stepCard.test.ts` (pure mapping part); mount it from `src/guide/mount.ts`.
- **Tests first:** « a step view maps to « Étape k sur n » with the package's selected steps » (n changes with the pacing); « an unknown bubble
  text keeps the last step »; « shown steps read « montré », skipped « passée » »; e2e: not a dialog, no focus trap, `aria-live` on the sentence
  only, Tab reaches « Passer le tutoriel ».
- **Depends on:** T3.2, T4.1. **Tier:** standard.

### T6.2 Checklist panel form and package configs
- **Files:** `src/creation/shell/checklist.ts` (`panel` form), `src/design/packages.ts` (final rows), `src/creation/shell/menuModel.ts` /
  `menuBar.ts` (shortcuts beside controls when the preset says so), `content/templates/premier-son-pret.json` used by package 5's start.
- **Tests first:** e2e per package « the presenter named in the table is the one on screen »; package 5 « opens the playable model and the first
  step is « débranchez » »; package 4 « no proactive bubble in 60 s ».
- **Depends on:** T6.1, T4.3, T1.6. **Tier:** standard.

### T6.3 Venue cards after the first sound (entrepreneur)
- **Files:** `src/creation/boot.ts` (after the first `playStarted` in the neutral room with profile 3: a note with three room cards, each labelled
  « salle d'exemple, non vérifiée »), COPY + deck.
- **Tests first:** « shown once, after the first sound, for profile 3 only » (triggers / does not trigger for profile 1).
- **Depends on:** T6.2. **Tier:** cheap. **Risk:** the rooms are unreviewed; the label is mandatory (honesty test checks it).

**Phase T6 close:** full baseline e2e; deep scan; ledger.

---

## Phase T7: the parametrised suite, the proxy, the scripts

### T7.1 One suite over the five packages
- **Files:** create `tests/e2e/onboarding-packages.spec.ts`.
- **Content:** spec 11 items 1 (DOM parity), 3 (geometry, three viewports, rest + each step), 4 (axe), 5 (reduced motion), 6 (keyboard-only
  first sound), 7 (4 profiles x package 1), 10 (exam / `?oscar=0` absence), 11 (snapshots 5 x 3, canvas masked).
- **Depends on:** T6 closed. **Tier:** standard. **Risk:** run time; split by `test.describe.parallel` per package, one worker per port.

### T7.2 Scripted first-timer proxy
- **Files:** create `tests/e2e/first-timer-proxy.spec.ts`.
- **Content:** spec 11.8. A guard test asserts the spec file never calls `window.__creation` before the last action (text scan of its own source
  between two markers).
- **Acceptance:** per package, actions <= 25, Oscar words <= 180, test signal playing; the printed floor is copied into the ledger, labelled
  « floor for a known route ».
- **Depends on:** T7.1. **Tier:** most capable.

### T7.3 Engine neutrality by behaviour, scripts
- **Files:** create `tests/engineNeutrality.test.ts` (unit: corpus of designs → events, `playbackReady`, reason texts identical with each package
  and profile applied to the shell modules; import scan of `src/engine`, `src/flow`, `src/logic`, `src/creation/store.ts`); modify `package.json`
  (scripts `test:onboarding` = the new e2e files, `test:proxy`).
- **Depends on:** T7.1. **Tier:** standard.

**Phase T7 close:** **independent opus review** of the whole test suite (do the tests prove the spec, or only themselves?); ledger.

---

## Phase T8: tutorial visuals (stills and storyboard only)

### T8.1 Annotated captures and storyboard
- **Gate:** the founder's grant for stills and storyboards is in the ledger (it is, 2026-11-12); **no video**.
- **Files:** create `tests/e2e/tutorial-captures.spec.ts` (skipped unless `CAPTURE=1`; port **4392**; local build only), the SVG annotation
  overlay inside the spec (Ambre arrows and step numbers on Nuit areas only, Tektur numbers, square shapes), `docs/tutorial/storyboard.md`.
- **Steps:** `$env:E2E_PORT='4392'; $env:CAPTURE='1'; npx.cmd playwright test tutorial-captures`; output to `docs/tutorial/captures/`, **not
  committed** until the founder has looked (open decision 7); the storyboard references them by step id.
- **Acceptance:** one capture per step at 1366 x 768; a check in the spec that no annotation puts Ambre on a Papier pixel region (sample the
  pixels under each label box).
- **Depends on:** T7 closed. **Tier:** standard.

---

## Phase T9: copy and docs

### T9.1 Copy deck pass
- **Files:** `docs/copy/creation-mode.md` (status legend gains « à valider (tekuxwriter) »; every new row has a « Où / notes »), `src/creation/copy.ts`.
- **Acceptance:** deck mirror and honesty tests green; a list of every new key in the ledger for the copy owner.
- **Depends on:** T8.1 (or T7 if T8 is parked). **Tier:** cheap.

### T9.2 Docs
- **Files:** `docs/design-system.md` (section « Packages de design (onboarding) »: the role maps and the contrast table), `docs/guides/tester-les-5-designs.md`
  (French, for the founder: the five addresses, what to look at, how to reset the first visit by clearing the onboarding key, what is not
  measured), ADRs 0016 to 0018 final.
- **Depends on:** T9.1. **Tier:** cheap.

---

## T10: final gate and report

- [ ] Full gate (pre-flight list) green; counts compared with the baseline in the ledger.
- [ ] `git diff c51dc87 -- tekpractice-sim/src/engine` empty.
- [ ] **Independent opus review of the whole branch** against the spec, the council decision and the founder's answers; findings fixed or listed.
- [ ] `git log --oneline origin/guide/oscar-wiring..HEAD` reviewed: every commit local, explicit paths, no private names.
- [ ] Report in the ledger: what was built, the proxy floors per package, the open founder decisions (spec 13), what was parked and why.
- **Tier:** most capable. Stop here: no push, no deploy.

---

## Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Real beginners take longer than 3 minutes | high | high (the founder's success test) | no minutes figure in the UI; the proxy reports a floor; the founder times 5 people per package later | founder |
| The vendor patch is lost at the next re-vendor | medium | medium (icon covers controls again) | patch list + pin test; send upstream | T1.2 implementer, then the guide owner |
| The character skin breaks on renamed vendored classes | low | medium | pin test on `.oscar-icon`, `.oscar-mascot`, `data-state` | T5.2 |
| boot.ts merge conflicts between tasks | high | medium | serialise every boot.ts task; one owner at a time | lead |
| The start screen leaks into the default and breaks 45 specs | low | high | `?design`-only rule, a does-not-trigger test in T2.1 and T2.3, full e2e at each phase close | T2 |
| Five packages judged on taste (N = 1) | high | medium | say so in the founder guide; the proxy and the real-people test are the evidence | founder |
| The playable template hides the « Lecture console » lesson | medium | low | used only by package 5, whose tutorial is unplug / replug; labelled as a model | founder |
| Captures show textures derived from product photos | medium | medium (standing rule) | captures stay uncommitted until the founder rules | founder |
| Chunk budget exceeded by the new code | medium | medium | lazy chunks; `budget` in the gate | each implementer |
| Muting has effects beyond « no auto-raise » | low | low | T5.3 reads the controller and records them | T5.3 |
| The 40 px mic target needs a radius below the camera's lower limit | low | medium | T2.5 measures and stops for the founder if so | T2.5 |

Task count: 32 (T1.1 to T10).
