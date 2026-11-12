# Onboarding packs: first visit, tutorial, Oscar and five design packages (Mode Création)

Status 2026-11-12: design, not built. Branch `design/onboarding-packs` (local only, never pushed). Base: the live code (`ee396da`).
Plan: `docs/superpowers/plans/2026-11-12-onboarding-packs.md`. Binding design input: the council decision of 2026-11-12 (round 1, two rounds,
consensus) and the founder's answers; this spec turns them into checked facts, names and states. Where this spec departs from the council it
says so and why (search « Departs from the council »).

Every fact about the code below was read in the code on 2026-11-12 (file and symbol named). Anything that could not be verified is marked
**[unverified]** with what would settle it.

---

## 1. Goal and success test

**Goal.** A complete beginner opens Mode Création, says who they are in one click, and reaches a **first sound** without outside help: a place
chosen, a console, a mic and a speaker placed and connected, the test signal heard. The same codebase offers **five complete packages**
(first-visit journey + game layout + colour balance) so the founder can compare them on his PC with `?design=1..5`.

**The founder's test.** « A complete beginner reaches a first sound in under 3 minutes, unaided. »

| What | Can we prove it now? | How |
|---|---|---|
| A path to the first sound exists in every package, with no dead end, using only what is on screen | yes | scripted first-timer proxy (section 11.8), real UI only |
| A modelled time for that path (a floor, not a human time) | yes, as a floor | the proxy adds 1.5 s per click or key and 3 s per Oscar sentence to the measured machine time; reported, never published |
| The action count and the words Oscar says | yes | proxy asserts actions <= 25 and Oscar words <= 180 |
| A real beginner does it in under 3 minutes | **no** | needs people: 5 first-timers per package, unaided, screen-recorded, timed by the founder later |

The scripted floors measured on production before this work were 27 to 94 s on a known route (33 to 36 actions); the experts' estimate for real
first-timers with this design is 4 to 6 minutes. Neither is a measurement with people. **No minutes figure appears in the UI** (section 9).

## 2. Scope switch: what a visitor sees without `?design`

`?design=1..5` is read from the address only, never stored. **A visitor with no `?design` gets today's Mode Création plus the stand-alone
honesty and first-sound fixes of section 8** (they are fixes, not a package). The start screen, the profiles, the tutorial, the character and the
package layouts exist only under `?design=1..5`. Promoting one package to the default is a later founder decision (section 13).

Consequence (verified, it matters for the test suite): 45 Mode Création e2e specs open `/` and expect the place picker on a fresh load
(`tests/e2e/creation-*.spec.ts`, `guide-creation.spec.ts`). Keeping the default unchanged keeps them valid; the new behaviour is tested by new
specs that open `/?design=n`.

A reload switches packages; the autosave keeps the project (it is keyed `audio-sim/creation.v1`, unrelated to `?design`). No live switching in v1.

## 3. Personas and profiles

Four profile buttons, labelled by situation, keys 1 to 4. Profiles and packages are two separate axes: a profile changes defaults inside the
package the address chose. Tests cover 5 packages x 1 profile and 4 profiles x 1 package, never 20 combinations.

`ProfilePreset` (data, `src/creation/onboarding/profiles.ts`):

```ts
type ProfileId = 'decouvre' | 'etudie' | 'projet' | 'metier'
interface ProfilePreset {
  id: ProfileId
  key: '1' | '2' | '3' | '4'
  labelKey: string                 // COPY key, e.g. 'onboarding.profileDecouvre'
  offerFocus: 'tutorial' | 'skip'  // which offer button has focus (Enter accepts it)
  inventoryTab: InventoryTab       // tab the drawer opens on ('consoles' | 'micros'), src/creation/inventory.ts
  panels: { tree: boolean; props: boolean } | 'package' // 'package' = the package's own layout preset decides
  oscarProactive: boolean          // false = Oscar starts muted (no auto-raise), the icon stays
  afterFirstSound: 'none' | 'venue-cards' // what is suggested once the first sound is heard
}
```

| Profile (button text) | Who | offerFocus | inventoryTab | panels | oscarProactive | afterFirstSound |
|---|---|---|---|---|---|---|
| « Je découvre » | complete beginner, curious public, musician starting | tutorial | consoles | package | true | none |
| « J'étudie le son » | BTS / bachelor sound student | skip | consoles | { tree: true, props: true } | true | none |
| « Je monte un projet » | entrepreneur (bar, hall, event), learning, also about his own gear | tutorial | consoles | package | true | venue-cards |
| « Je travaille dans le son » | working sound engineer | skip | consoles | { tree: true, props: true } | false | none |

Notes:
- Every profile's first sound happens in the **neutral room** (section 5). The entrepreneur's venue cards come after the first sound, each labelled
  « salle d'exemple, non vérifiée » (every room file carries a pending review flag; no room claims a real venue).
- `inventoryTab` is `consoles` for all four in v1: the tutorial starts with the console. The field exists so a package or a later profile can
  change it as data.
- The engineer profile still sees the offer (the founder wants the tutorial advised for everyone); focus is on « Passer ». Oscar starts muted
  for this profile: the controller's auto-raise is skipped while muted (`dueForAutoRaise(..., tone.muted, ...)`, vendored `core/controller.ts`).
  **[unverified]** that muting has no other effect a learner would read as « Oscar is off »; settle in T5.3 by reading `controller.ts` muted paths.
- No profile locks a feature. No profile changes the catalog, the rules or the engine.

## 4. The first-visit flow

### 4.1 States

```
                 ┌──────────── autosave present (restore() true) ──────────────► WORKSPACE (chip « Profil : X · changer »)
 page load ──────┤
                 └── no autosave ──┬── onboarding record has a profile ───────► PICKER (today's picker, chip shown)
                                   └── no record ──► START: PROFILE ──1-4/click──► START: OFFER
                                                         │ Échap / « Tous les lieux »      │ « Faire le tutoriel »   │ « Passer » / Échap
                                                         ▼                                 ▼                         ▼
                                                      PICKER (record: profile null)   TUTORIAL (non-modal,      WORKSPACE (neutral room,
                                                                                       neutral room, framed)     framed), « Premiers pas » in Aide
```

- **Only under `?design=1..5`**, and only when `restore()` returned false and no onboarding record exists. With `?design` and an autosave, the
  project reopens as today and the chip « Profil : X · changer » is shown.
- `restore()` (src/creation/boot.ts) reopens the last autosave directly (no picker) when `loadAutosave(storage)` is `ok` with a room; otherwise the
  boot calls `picker.show({ closable: false, focus: false })`. The start screen replaces that one call: `picker.showStart(...)` instead of
  `picker.show(...)` when the conditions above hold.
- **No auto-start.** A profile click is not consent to a tutorial. The offer is inline on the same screen.
- **Skip never re-nags.** Once the offer is answered, it is not shown again on this device. Re-open from Aide > « Premiers pas » (new menu item) and
  from the profile chip.
- **Resume.** A tutorial that was running when the tab closed resumes on the next visit at its step (the vendored controller persists its flow
  state, see 4.4). Aide > « Premiers pas » then offers « Reprendre à l'étape {n} » and « Recommencer ».

### 4.2 The start screen

Built **inside the place picker** (`src/creation/shell/placePicker.ts`), as a second stage of the same section, so `inert` keeps ONE owner:

- Verified: `mountPlacePicker` makes its `covers` (`[shell.tree, shell.viewport, shell.props]`, boot.ts) `inert = true` in `show()` and
  `inert = false` unconditionally in `hide()`. A second overlay setting `inert` on the same nodes would be cleared by the picker's `hide()`. So the
  start screen is not a second overlay: it is a stage of the picker (`showStart()` shows the start panel and hides the picker's head and grids;
  « Tous les lieux » switches to the grids stage; choosing a profile and an offer calls the same `onChoose` path with the neutral room card, which
  closes the picker through `showCanvas()` exactly as a card click does today).
- The menubar stays usable (it is not covered today either).
- Content, top to bottom: title (`h2`), one line « Vous pourrez changer de profil à tout moment. », four large equal buttons (keys 1 to 4), a
  « Tous les lieux » button (the classic picker). After a profile choice, inline below the buttons, two **equal** buttons:
  « Faire le tutoriel (conseillé · {n} étapes, à votre rythme) » and « Passer, je connais ».
- With the guide not allowed on this address (`?oscar=0`, or any `mode`, `level`, `legacy` parameter: `guideRouteAllowed` + `guideMode`,
  src/guide/mode.ts) the offer is not shown (there is no Oscar to lead it); the profile buttons still are. The boot cannot import the guide
  (`tests/guide/creationIsolation.test.ts`), so `main.ts` computes `tutorialAllowed` and passes it to `bootCreation({ tutorialAllowed })`
  (`tests/guide/mainTail.test.ts` pins the current call and is updated).

### 4.3 Keyboard and focus

| Where | Keys | Focus rule |
|---|---|---|
| Profile stage | Tab (4 buttons, then « Tous les lieux »), 1 to 4 choose, Enter on the focused button, Échap = « Tous les lieux » | focus lands on the first profile button when the stage opens |
| Offer stage | Tab between the two offer buttons, Enter, Échap = « Passer, je connais » | focus on the button named by the profile's `offerFocus` |
| After the offer | the place opens (neutral room) | focus goes to the canvas (as `showCanvas()` does today when focus was in the picker) |
| Tutorial | nothing is inert; the step card is not a dialog and holds no focus trap | the step card's buttons are in the tab order after the status bar |

Digits 1 to 4 are only read on the profile stage (the 3D view uses 1 2 3 for listening points; the picker covers it then).

### 4.4 Stored state (localStorage, every access in try/catch)

| Key | Owner | Content |
|---|---|---|
| `audio-sim/creation-onboarding.v1` | new, creation | `{ v: 1, profile: ProfileId \| null, offer: 'taken' \| 'skipped' \| null, shown: StepId[] }` |
| `oscar-guide.state.v1` | existing, vendored controller | the running flow and its step (resume) |
| `oscar-guide.ui.v1` | existing, vendored widget | the icon's resting corner chosen by the learner |
| `audio-sim/creation.v1` | existing | the autosave (unchanged) |

Blocked storage: the record lives in memory for the page's life (the start screen can show again on the next visit; stated, accepted). A record
that does not parse is replaced by a fresh one (no notice: it holds no learner work). `?design` is never stored.

## 5. First room and camera framing

- **The neutral room is the place key `blank`** (« Salle vide neutre », `BLANK_SIZE` 24 x 14 m, flat; src/creation/places.ts). There is no
  `room:neutral-empty`. It is the only place that claims no real venue.
- Default camera (src/creation/sceneHost.ts `buildScene`): `ArcRotateCamera` alpha pi/2, beta 1.05, target (0, 1, 0),
  radius = clamp(max(width, length) x 0.8, 8, 55) = **19.2 m** for `blank`; `lowerRadiusLimit` 2 (`ENSEMBLE_LOWER_RADIUS`), upper
  max(40, 1.5 x radius). Babylon's default fov 0.8 rad (the orbit feel code assumes it: src/camera/orbitFeel.ts).
- Measured on production by the persona walks: a placed SM58 is about 15 px wide at that default view at 1366 x 768. Screen size scales with
  1 / distance, so **about 7 m** of radius should give about 40 px **[unverified: estimate from one measurement; the CI geometry test decides]**.
- **Feasible with the existing API:** `host.rig.flyToPreset({ alpha, beta, radius, target })` (src/scene/CameraRig.ts, already used by
  `goToPoint` in boot.ts). No engine change. The tutorial framing is a named preset `FIRST_SOUND_FRAMING` (data in the package table, default
  radius 7, target (0, 0.5, 2)), applied once when the tutorial or the « Passer » path opens the neutral room. The learner places devices where
  they click, so everything placed lands inside the framed area.
- CI target: at 1366 x 768 every placed tutorial device is at least 40 px on its widest screen axis (projected body bounds through the existing
  `bodyBoundsInRoot` and `worldScreen` readers; a geometry test may use those readers, the first-timer proxy may not).

## 6. The tutorial

### 6.1 One machine, one step list

The tutorial is one flow of the vendored guide controller, id `premiers-pas`, declared as data in `src/guide/flows.creation.ts` next to the
existing flows. Reasons (verified in the vendored code):
- the controller already runs flows step by step, rings the anchor, walks the icon there, offers « Montre-moi », « Un indice de plus » and
  « Passer cette étape », escalates hints after `Step.hintAfterMs`, persists the flow state and restores it after a reload
  (`core/controller.ts` `restore()` / `persist()`);
- the host can start it: `handle.send({ type: 'flow', control: { action: 'start', flowId: 'premiers-pas' } })` (`ControllerInput`,
  `core/types.ts`);
- a step ends on a host event with an optional data `match` (`core/flow.ts` `dataMatches`); the mount already annotates events
  (`annotateToggle` marks the suggested phantom switch).

The packages never get their own step list: each package's pacing selects step ids from this one list (section 7).

**How the creation side asks the guide to start it** (creation must not import the guide): the start screen writes `offer: 'taken'` in the
onboarding record and a request counter; a new reader `onboarding()` on the debug hook (`window.__creation`, already the bridge's only input)
exposes them; the bridge's existing 500 ms poll sees the new request and the mount sends the flow start. No new page listener (the listener count
is pinned in `tests/e2e/guide-creation.spec.ts`).

### 6.2 Host event annotations (mount.ts, like `annotateToggle`)

| Bridge event | Added data | From |
|---|---|---|
| `deviceAdded` | `role: 'source-console' \| 'mic' \| 'speaker' \| 'mains-strip' \| 'other'` | the catalog: `source-console` = a device with a route `from: 'control:...'` (today only `yamaha-ql1`, `routing` of content/catalog.json); `mic` = `realWorld.category` `microphone`; `speaker` = `powered-speaker` or `studio-monitor`; `mains-strip` = a device with an `isMainsSource` port (`multiprise-secteur`) |
| `connect` | `pair: 'console-speaker' \| 'mic-console' \| 'mains-console' \| 'mains-speaker' \| 'other'` | the two ends' roles and the port signal (`mains-power`) |
| `toggle` | `playback: true` when the control is the source console's playback control (`playback-usb`) | catalog route `from` |
| new `playStarted` | `source: 'test'` | a new reader `audioState()` added to the bridge's `CreationReader` pick (it already exists on the hook) |

Only the source console counts as « the console »: in the « Consoles » tab sit the QL1, a stage box, a broadcast console, a preamp and a monitor
controller, and only the QL1 has a playback source. The step line names it by its catalog label.

### 6.3 The step list (data)

New reserved anchors resolved in mount.ts from the live state (as `port:suggest.from` is today): `port:suggest.speaker.from/to` (a free source
console output to a free speaker input the engine accepts), `port:suggest.mic.from/to`, `port:suggest.mains.console.from/to`,
`port:suggest.mains.speaker.from/to`, `control:suggest.playback`. They reuse `nextConnectionStep`'s rule (the engine's own `canConnect`), filtered by
role. New shell anchors in `NAV_SELECTORS`: `nav:ecoute` (`#cr-menu-ecoute`), `nav:checklist-power` (the checklist's helper button).

| # | id | Anchor | Done when | Oscar (one sentence, « vous ») | Words |
|---|---|---|---|---|---|
| 1 | `console` | `nav:inventory` | `deviceAdded` role `source-console` | « Ouvrez l’inventaire (Espace), onglet Consoles, et posez la {console} sur le sol. » | 14 |
| 2 | `micro` | `nav:inventory` | `deviceAdded` role `mic` | « Posez un micro, onglet Micros. » | 5 |
| 3 | `enceinte` | `nav:inventory` | `deviceAdded` role `speaker` | « Posez une enceinte, onglet Enceintes : c’est elle qui diffuse le son. » | 12 |
| 4 | `console-enceinte` | `port:suggest.speaker.from` -> `.to` | `connect` pair `console-speaker` | « Sélectionnez la console, puis « Connecter à… » : la prise proposée va vers l’enceinte. » | 14 |
| 5 | `micro-console` | `port:suggest.mic.from` -> `.to` | `connect` pair `mic-console` | « Faites de même du micro vers la console : la prise proposée convient. » | 12 |
| 6 | `lecture-console` | `control:suggest.playback` | `toggle` playback, value true | « Dans Propriétés, activez « Lecture console » : c’est la source de test du simulateur. » | 14 |
| 7 | `multiprise` | `nav:inventory` | `deviceAdded` role `mains-strip` | « Dans ce simulateur, la console et l’enceinte ont besoin de courant : posez une multiprise, onglet Secteur. » | 17 |
| 8 | `courant-console` | `port:suggest.mains.console.from` -> `.to` | `connect` pair `mains-console` | « Reliez la console à la multiprise. » | 6 |
| 9 | `courant-enceinte` | `port:suggest.mains.speaker.from` -> `.to` | `connect` pair `mains-speaker` | « Reliez aussi l’enceinte à la multiprise. » | 6 |
| 10 | `ecoute` | `nav:ecoute` | `playStarted` source `test` | « Ouvrez Écoute, puis Signal de test. » | 6 |

After a `connect` step the character celebrates and the bubble says « Connexion acceptée. » (2 words, never « bien réglé », « bravo, c'est
correct » or a judgement of gain). After step 10: « Vous entendez le signal de test : une simulation simple. » and the fixed line
« Le micro est câblé mais n’est pas entendu : le signal de test entre à la console. » Total Oscar words on the whole path, with four
« Connexion acceptée. »: about 150 (budget 180, asserted by the proxy).

**Departs from the council (order).** The council listed power before « Lecture console ». The signal path checks, in order: a source exists,
the source is on, the console is powered, a path reaches a speaker, the speaker is powered (src/flow/signalPath.ts returns at the first of the
first three). With power first, the status bar would say « La lecture console est coupée. » while Oscar asks for a multiprise. Steps 6 to 9
follow the engine's own order, so the status bar and Oscar never disagree.

**Steps 4 and 5 order** follow the same logic: the sound needs the console-to-speaker cable; the mic cable gives « Micro OK » only (the test
signal enters at the console). Both are taught; the mic is never claimed to be heard.

**Skipping a step.** The controller's « Passer cette étape » stays. A skipped step is not recorded as done; the step card shows it as
« passée ».

### 6.4 The checklist « Pourquoi je n’entends rien ? »

A **creation-side** read-only view (it works with `?oscar=0`, in every package, every profile, every template), shown when a place is open
and `playbackReady` is false: a chip in the status bar and a line under the greyed Écoute items (their reason line `#cr-menu-desc-test-signal`
already exists). It opens a non-modal list:

| Row | Reason codes (src/flow/signalPath.ts `ReasonCode`) | Text when blocked | « Aller à » |
|---|---|---|---|
| Source | `NO_SOURCE` | the engine's `text_fr` verbatim (COPY.playback.noSource) | opens the inventory on Consoles |
| Lecture console | `SOURCE_OFF` | verbatim | selects the console (Propriétés shows the toggle) |
| Alimenté | `HOST_UNPOWERED`, `SPEAKER_UNPOWERED` | verbatim | selects the first subject's device; the helper button (6.5) when its conditions hold |
| Câblé | `NO_PATH`, `RULE_ERROR` | verbatim | selects the first subject's device |
| (fixed line) | — | « Le micro est câblé mais n’est pas entendu : le signal de test entre à la console. » | — |

- Mapping is a `Record<ReasonCode, Row | 'mic'>` so a new reason code fails to compile until it is placed (`NO_MIC` belongs to the mic line, not to
  playback).
- **Tri-state, never a false tick.** The signal path stops at the first failing gate for the first three codes, so rows after the first blocked
  one are « pas encore vérifié », not ticked. Every row is ticked only when `playbackReady`.
- It changes nothing: « Aller à » only selects or opens. No rule is recomputed in the UI.

### 6.5 The power helper « Je branche pour vous (dans le simulateur) »

Cabling only, one undo entry, offered only after the learner placed a power strip themselves.

- **Conditions (all):** a verified `multiprise-secteur` instance is in the design (placed by the learner or the template); at least one verified
  device in the design has a free `power-in` port that is not cabled to a mains source; the strip has enough free `out-k` ports; the address is
  practice (no `mode` parameter).
- **Never:** at project open; at a tutorial power step before the learner tried (the offer comes as Oscar's third escalation: point, then say,
  then offer, timed by the package's `hintAfterMs`); in exams; for a Bêta strip (`isMainsSourceRef` is always false for unverified devices,
  src/creation/mains.ts). It never places a strip and never touches « Lecture console » (no `SET_CONTROL`).
- **Intents (verified):** for each device to power, `{ type: 'CONNECT', a: { instance: <strip>, port: 'out-k' }, b: { instance: <device>,
  port: 'power-in' } }` (src/ui/intents.ts). Inlets: `power-in` on every verified device that takes mains (QL1, K12.2, DBR12, 8030C and the
  rest; content/catalog.json, connector `iec-c14`, signal `mains-power`); strip outlets `out-1` to `out-4` (connector `iec-c13`, flag
  `isMainsSource`). The planner picks free outlets with `isMainsSourceRef` and checks each pair with `store.canConnect(a, b)` (CreationStore;
  src/creation may not import `ConnectionGraph` itself, `tests/creation/shellImports.test.ts`). It does **not** use the guide's
  `nextConnectionStep` (guide code, and it prefers audio pairs).
- **One transaction (verified in src/creation/history.ts):** `history.begin(label)`, `history.do(CONNECT)` per device, `history.commit()` = one
  undo entry (an empty transaction records nothing). If any `do` is refused: `history.rollback()` undoes what was applied and records nothing.
  Caveat: a refused `do` inside the transaction still notifies `onRefused` (the status bar lists the refusal), so the planner pre-checks every pair
  with `canConnect` and never dispatches one it knows will fail. The store notifies its subscribers per intent, so the scene shows the cables one
  by one; the undo is still one entry.
- **After:** the status line lists what was added (« Branché au courant : {devices}. Ctrl+Z pour annuler. »); in the tutorial, the steps it
  completed are recorded in the onboarding record's `shown` and the step card marks them « montré », not « réussi », with no celebration.

### 6.6 Presenters (at most two)

- **Step card** (guide-side, `src/guide/stepCard.ts`): « Étape {k} sur {n} », the current step's sentence (the same text as Oscar's bubble),
  « Passer le tutoriel », and the ticked / « passée » / « montré » state of earlier steps. It subscribes to the controller's views
  (`controller.subscribe`, created in mount.ts) and maps the bubble's step text to its step id through the step list (every step text is unique,
  tested). Non-modal, `aria-live="polite"` on the sentence only, no focus trap.
- **Checklist** (creation-side, 6.4) in two forms set by the package: a chip that opens the list, or a permanent panel.

Everything else that differs between packages is configuration of these two and of the shell.

## 7. The design packages

### 7.1 The table (typed data, `src/design/packages.ts`)

`src/design` is imported by both the creation shell and the guide (the guide may import creation code, never the reverse).

```ts
type DesignId = 1 | 2 | 3 | 4 | 5
interface RoleColours {            // every value is one of the four brand colours or an existing CREATION_TOKENS tint
  ground: Hex; surface: Hex; ink: Hex; inkMuted: Hex
  accent: Hex; accentInk: Hex      // accent = the ONE next action (fill or text on a dark ground); accentInk = text on an accent fill
  secondary: Hex; secondaryInk: Hex
}
interface LayoutPreset {
  panels: { tree: boolean; props: boolean }
  drawer: 'close-after-place' | 'stay-open'
  density: 'comfortable' | 'dense'
  oscarCorner: 'br' | 'bl' | 'tr' | 'tl'   // default resting corner when the learner has not chosen one
  shortcutsBesideControls: boolean
  checklist: 'chip' | 'panel'
  start: 'neutral-room' | 'playable-model'
}
interface Pacing { steps: readonly StepId[]; hintAfterMs: number; celebrate: boolean }
interface OscarPolicy { leads: boolean; proactive: boolean }
interface DesignPackage {
  id: DesignId; nameKey: string; colours: RoleColours; layout: LayoutPreset
  pacing: Pacing; presenter: 'step-card' | 'checklist'; oscar: OscarPolicy; framing: CameraPose
}
export const DESIGN_PACKAGES: Readonly<Record<DesignId, DesignPackage>>
export function designFromSearch(search: string): DesignId | null   // '?design=1'..'5' only; anything else null (today's behaviour)
```

`designFromSearch` result is set once at boot as `html[data-design="n"]`; colours go through `injectCreationTokens` (src/design/creationTokens.ts)
as role overrides of the same `--cr-*` properties, and through `--og-*` in src/guide/theme.css for the guide.

**Lint rule (test): no design branching outside the table.** A test scans `src/` and fails on `design ===`, `designId ===`, `data-design` reads
or `DESIGN_PACKAGES[` outside `src/design/packages.ts` and the one boot line that applies it; CSS may select `html[data-design]` only in a
dedicated package stylesheet. Components read fields of the active package object, never its id.

### 7.2 The five packages

| | 1 « Pas à pas » | 2 « Atelier » | 3 « Salle d’abord » | 4 « Pupitre » | 5 « Modèle d’abord » |
|---|---|---|---|---|---|
| Who it fits | newbie | student | entrepreneur | engineer | mixed |
| Help is delivered by | Oscar leads, spotlight + step card | permanent checklist, Oscar on demand | room-first framing, role words, coverage legend « estimation » | nothing by default; offer shown; keyboard first | a wired playable model; tutorial = « défaites un câble, refaites-le » |
| Presenter | step card | checklist (panel) | step card | checklist (chip) | step card |
| Panels | both collapsed | both open | tree collapsed, props open | both open | tree open, props collapsed |
| Drawer | stay open | stay open | stay open | close after place (today) | close after place |
| Density | comfortable | dense | comfortable | dense | comfortable |
| Shortcuts beside controls | no | yes | no | yes | no |
| Oscar | leads, proactive | proactive, does not lead | leads, proactive | not proactive (muted), does not lead | leads, proactive |
| Pacing steps | 1-10 | 1-10 | 1-10 | 1-10 (if taken) | `debrancher`, `rebrancher`, 10 |
| hintAfterMs | 20 000 | 30 000 | 20 000 | 0 (no hint) | 25 000 |
| Start | neutral room | neutral room | neutral room | neutral room | playable model (8.6) |
| Risk | patronising, hides context | dense at 1366 x 768 | relies on unreviewed rooms after first sound | a beginner is lost (a profile fit more than a beginner design) | depends on the playable model content change |

Package 5 needs two more steps in the one list: `debrancher` (done on a `disconnect` of the console-to-speaker cable, « Débranchez le câble de la
console vers l’enceinte : le son s’arrête. ») and `rebrancher` (done on `connect` pair `console-speaker`, « Rebranchez-le : la prise proposée
convient. »). They are in the list; only package 5's pacing selects them.

Packages differ by who drives and where help lives, not by palette.

### 7.3 Colour maps over Nuit / Papier / Ambre / Prune, contrast computed

Computed with `contrastRatio` (src/design/creationTokens.ts, WCAG 2.1) on 2026-11-12:

| Pair | Ratio | Use allowed |
|---|---|---|
| Papier #F3EDE3 on Nuit #131114 | 16.13 | text |
| Papier on panel #1C191D | 14.95 | text |
| Ambre #DD9349 on Nuit | 7.46 | text, UI |
| Ambre on panel | 6.92 | text, UI |
| Nuit on Ambre (fill) | 7.46 | text on an Ambre button |
| Prune #612D45 on Papier | 9.16 | text |
| Papier on Prune | 9.16 | text |
| inkMuted #B3AAA0 on panel / Nuit | 7.61 / 8.21 | text |
| inkMuted on Prune | 4.66 | text (just) |
| Ambre on Prune | 4.24 | **not body text**; large text (>= 24 px, or 18.66 px bold) and UI only |
| **Ambre on Papier** | **2.16** | **never as text, and not even as a UI boundary (< 3)**: an Ambre fill on Papier needs a Nuit border |
| inkMuted on Papier | 1.97 | never |
| danger #F08A7E / ok #8CCB9B on Papier | 2.09 / 1.62 | never (use Nuit text + glyph on Papier) |
| Prune on Nuit | 1.76 | never as text; decorative zones only |

| Role | 1 Pas à pas | 2 Atelier | 3 Salle d’abord | 4 Pupitre | 5 Modèle d’abord |
|---|---|---|---|---|---|
| ground | Nuit | Nuit | Papier (start screen, step card) | Nuit | Nuit |
| surface | panel | panel | Papier | panel | Prune |
| ink | Papier (14.95) | Papier (14.95) | Nuit (16.13) | Papier (14.95) | Papier (9.16) |
| inkMuted | inkMuted (7.61) | inkMuted (7.61) | Prune (9.16) | inkMuted (7.61) | inkMuted (4.66) |
| accent | Ambre on panel (6.92), one target only | Ambre for state (6.92) | Ambre fill, Nuit text (7.46), Nuit border | Ambre for state (6.92) | Ambre fill, Nuit text (7.46) |
| secondary / ink | Prune / Papier (9.16) | Prune / Papier (9.16) | Prune / Papier (9.16) | panelLine (decor) | Nuit / Papier (16.13) |

Fixed across packages: the menubar and the status bar stay Nuit / panel (the danger and ok tokens are only legible there); the 3D scene look
(`CREATION_TOKENS.scene`) is unchanged; square corners; Tektur titles, IBM Plex Sans UI. The contrast test checks every declared text pair
>= 4.5 and every UI pair >= 3 for every package.

## 8. First-sound fixes that stand alone (default and every package)

1. **Oscar never rests on a control.**
   - Resting position: `hostInsets` (src/guide/mount.ts) returns only the menu bar and status bar today. Add the open Projet and Propriétés
     widths (tree 200 px, props 260 px, rail 32 px when collapsed: `CREATION_TOKENS.size`) and the open inventory drawer's height. Host-only, about
     ten lines. **Limit found:** the vendored `cleanInsets` caps each side at a quarter of the viewport (`ui/layout.ts`): at 1024 px wide the cap is
     256 px, under the 260 px Propriétés column, so insets alone leave a 4 px overlap there; the obstacle list below covers it.
   - Walking / pointing position: the vendored `placeBeside(target, vp, s)` (`core/motion.ts`) avoids only the target rect, so the icon can land on
     a neighbouring menu title or button. Fix: an optional `avoid` list in `placeBeside` and `MotionInput`, fed by an `obstacles` callback that
     `mountGuide` accepts and mount.ts fills (visible buttons, menu items, inputs of the shell; cached `RECT_CACHE_MS`). This edits vendored code:
     see 10.3.
   - Resting corner: decided by the vendored `DEFAULT_CORNER = 'br'` (`ui/layout.ts`), overridden by the learner's stored corner
     (`oscar-guide.ui.v1`, arrows or drag). A package default is applied host-side by handing `mountGuide` a `storage` wrapper whose
     `getItem(key)` returns the package corner when nothing is stored (no vendor edit).
2. **The checklist** (6.4).
3. **Oscar says what to do, not the state.** Today the verdict for a not-yet-playable bench is the signal path's first reason verbatim
   (src/guide/verdict.ts, last branch), the same sentence as the status bar. Keep the reason verbatim and add one « vous » action sentence per
   `ReasonCode` (new COPY keys), e.g. `SOURCE_OFF`: « Sélectionnez la console, puis activez « Lecture console » dans Propriétés. »
4. **Rule texts that make real-world claims.** Catalog R1 `teach_fr` ends « il ne faut jamais forcer »; R3 `teach_fr` ends « Deux sorties qui
   se battent peuvent endommager le matériel. » These are catalog data (source of truth); the copy deck already holds pending founder proposals
   for both (« Propositions en attente (fondateur) »). Proposed v1: say them as simulator rules (« Dans le simulateur, … »). **Founder gate:** the
   catalog is edited only after his yes; until then the honesty lint lists them as known, pending exceptions. R2 `teach_fr` carries « trop faible de
   40 dB » with no visible source record: flagged for the founder, not changed.
5. **A playable model.** The template « Concert simple (référence) » (content/templates/concert-simple-reference.json) is silent: it has the mic
   cable and three mains cables, but no cable from the QL1's `out-main-l` / `out-main-r` to the speakers' `in-line-a`, and `controls` is `{}`, so
   « Lecture console » stays at its catalog default (off). What sound needs: `ql1.out-main-l -> k12-g.in-line-a`,
   `ql1.out-main-r -> k12-d.in-line-a` (the e2e budget spec adds exactly these two plus the toggle to build « the powered rig »; the persona walk heard the test
   signal after the same three actions) and `controls: { ql1: {
   'playback-usb': true } }`.
   **Fixing it in place is not content-only in practice:** `tests/creation/templates.test.ts` pins 4 connections and `controls: {}`, and 22 e2e
   specs open this template and add those two cables and the toggle themselves (`tests/e2e/creation-budgets.spec.ts` and others), which would then be
   refused (port busy). Decision for v1: **a new template file** in the neutral room (`content/templates/premier-son-pret.json`, display name
   without the words « Concert simple » so the specs' `/Concert simple/` locator stays unique), content-only, validated by the existing
   `it.each(files)` schema and `canConnect` test. Two specs pin the template count and are updated: `creation-picker.spec.ts` (count 1) and
   `creation-keyboard-patch.spec.ts` (« one template: the arrows stay on it »). The reference template and its pitch « le plus simple pour
   commencer » are a founder decision (13). **[unverified]** that `APPLY_DESIGN` applies a template's `controls` value `playback-usb: true`; T1.6
   proves it with a unit test before anything depends on it.

## 9. Copy and honesty rules

- Every new user string is a COPY key (src/creation/copy.ts, new sections `onboarding`, `tutorial`, `checklist`, `assist`) and a row of
  docs/copy/creation-mode.md with status « à valider (tekuxwriter) » (a new status value, added to the deck's legend);
  `tests/creation/copyDeck.test.ts` enforces the mirror. French « vous ». Guide code reads these through `COPY` (guide may import creation).
  The guide's own table `TP_STRINGS` (impersonal, no digit, tested by `tests/guide/strings.test.ts`) is not used for the tutorial.
- **Pinned byte-identical** (a test asserts them before and after): `coverage.unit`, `coverage.method`, `coverage.hatched`,
  `coverage.splPending`, `coverage.frontCaveat`, `coverage.source*`, `listen.simple`, `listen.playing`, `coverage.chip` (« estimation »).
- **Banned phrases test** (one list, applied to COPY, the step list, the catalog `teach_fr`, `TP_STRINGS` and index.html text): « réussir / prépare
  au BTS » (and « examen » success verbs), « réaliste », « vrai matériel » without « simplifié », STI, SPL (outside the pinned `splPending`), RT60,
  « conforme », electrical-safety claims, « la seule prise qui convient », « passé par votre câblage », « bien réglé », any minutes figure
  (`\d+\s*min`), and any device number in tutorial or checklist strings. Pending founder exceptions (R1, R3) are listed by id in the test.
- No minutes figure: « {n} étapes, à votre rythme » and « Étape {k} sur {n} ». The founder's « environ 3 minutes » stays a design target.
- Oscar is labelled « Assistant » (the landmark already is, `TP_STRINGS.landmark`). The icon's accessible name today is « Oscar, assistant IA »
  (vendored `strings.fr.ts` `widget.iconName`, pinned in two e2e specs); it can be changed host-side through `mountGuide`'s `labels` option.
  Which wording ships is a founder decision (13); the answers seen are local rule lookups, so the council keeps « Assistant » and never claims a
  tutor that answers anything.
- Bêta stays « non vérifié »; no device number without its own manufacturer sheet record; unknown = no number shown.

## 10. Oscar

### 10.1 Behaviour

- Docked: rests in its corner clear of the bars and the open panels (8.1); never over a control at rest or while pointing (geometry test 11.3).
- One sentence per step, says what to do and where; never repeats the status bar alone (8.3); « Je n'ai pas encore d'information sur ce point. »
  stays its out-of-scope answer.
- Labelled « Assistant »; no sound; silent and absent in exams (`guideMode` 'exam' for any `mode` parameter on Mode Création and for every
  non-practice level page; the mount returns null before creating anything, and tears down if the address turns to an exam one: verified in
  mount.ts and index.ts); `?oscar=0` removes it everywhere.
- Muted (not proactive) by default for the engineer profile and in package 4.

### 10.2 The new character

**Personality principles:** friendly through motion, not words; brief; points at the thing, then steps aside; celebrates what the simulator
accepted, never what it cannot judge; shrugs gently on a refusal, never scolds; honest about being an assistant; never sits on a control.

**Construction:** pure SVG in a 64 x 64 viewBox built with DOM calls (no raster, no `innerHTML`), shapes only: a round head, headphones (band +
two cups) as the brand link, two eyes, a mouth, one arm with a hand, sparks, three think dots, z marks. Colours from the `--og-m-*` tokens
(theme.css). Decorative: `aria-hidden="true"`, the button keeps its accessible name.

| State | Motion (<= 1.5 s, CSS only) | Static pose (reduced motion) | When |
|---|---|---|---|
| idle | slow breathing (scale 1 to 1.02) | eyes open, small smile | at rest |
| walk | bob while gliding | leaning forward | moving to a target |
| point | arm extends, hand pulses once | arm out, hand open | beside the target |
| think | dots fade in sequence | dots shown, eyes up | waiting for an answer |
| celebrate | small hop, sparks | sparks shown, wide smile | « Connexion acceptée » |
| shrug | shoulders up, head tilt | head tilted, flat mouth | a refusal (vendored state `no` is drawn as shrug) |
| nod | head dips twice | head lowered, smile | a step done |
| wave | hand waves twice | hand raised | first appearance in a session |
| sleep | z marks drift | eyes shut, z marks | muted / idle for long |

The vendored controller emits seven states (`MascotState`: idle, walk, point, think, celebrate, no, sleep). `nod` and `wave` are host states:
the mount triggers them from annotated events (a tutorial step done; the first open), for at most 1.5 s, then hands back to the controller's state.

### 10.3 The seam (verified)

- `src/guide/vendor/**` is vendored from a private source: `VENDOR.json` holds a source commit and a sha256 per file, and
  `tests/guide/vendor.test.ts` fails if any vendored file differs from its hash or if a file is added to or removed from the folder. The commit
  that last changed the widget's insets says it was « re-vendored ». No vendoring tool and no `docs/guide-*.md` exist in this repo.
- `mountGuide` (`ui/widget.ts`) builds its mascot internally with `createMascot(doc)`; its options take `labels`, `insets`, `storage`,
  `storageKey`, `reducedMotion`, `zIndex`, `getRect`, `root`, but **no mascot or skin**.
- **Character: host-side skin, no vendor edit (recommended).** After `mountGuide`, a host module (`src/guide/character.ts`) appends its own SVG to
  the icon button, hides the vendored `svg.oscar-mascot` with theme.css, and mirrors the vendored `data-state` attribute with a
  `MutationObserver` (not an event listener, so the pinned listener count does not move). Risk: it depends on the vendored class names
  `.oscar-icon` / `.oscar-mascot` and the `data-state` attribute; a pin test fails loudly if a re-vendor renames them.
- **Obstacles: the smallest vendor patch (recommended, gated).** `avoid?: readonly Rect[]` in `MotionInput` and `placeBeside`, and
  `obstacles?: () => Rect[]` in `MountOptions`, passed through `applyTarget`. Applied locally with VENDOR.json hashes updated, and listed in
  `src/guide/VENDOR-PATCHES.md` (outside the vendor folder: the manifest test forbids extra files inside it) with file, function, reason and the
  test that pins it (`tests/guide/vendorPatches.test.ts`, which fails if a re-vendor drops the patch). It should also be sent to the source
  upstream (out of this repo's reach). Risk: drift from the source until it is upstream; a re-vendor without the patch is caught by the pin test.
  Fallback if the patch is refused: insets + corner only, and the residual (the pointing icon may cover a neighbour for the length of a step) is
  listed as a known limit.

## 11. Testing

One parametrised suite over the five packages (`tests/e2e/onboarding-packages.spec.ts`, `for (const design of [1, 2, 3, 4, 5])`), plus unit
tests per module. Ports 4391 (suites) and 4392 (captures); `E2E_PORT=4391 npx.cmd playwright test <file>` in PowerShell.

1. **DOM parity:** the same landmarks and the same set of `data-testid` values across the five packages at the start screen and in the workspace
   (a package cannot add DOM; it configures).
2. **Contrast:** every declared role pair per package (7.3) through `contrastRatio`: text >= 4.5, UI >= 3. Unit test, no browser.
3. **Geometry:** at 1366 x 768, 1024 x 768 and 820 x 1180, `elementFromPoint` at the centre of every visible button, menu item and input never
   returns an Oscar node, at rest and at each tutorial step. A control the icon would cover is an obstacle by construction, so this tests the real
   overlap, not a `pointer-events` trick (the icon keeps its pointer events).
4. **axe** on the start screen (both stages), the workspace, each tutorial step, the checklist and the connect dialog.
5. **Reduced motion** (`emulateMedia`): no running animation on the character or the step card; every state still distinguishable by its static
   pose (screenshot per state).
6. **Keyboard only:** the first-sound journey with keys only (profile 1, Enter, Space for the inventory, Enter to place, the connect dialog, the
   Propriétés toggle, the Écoute menu); no focus loss after any step; Échap on each start stage.
7. **Profiles:** 4 profiles x package 1 (offer focus, panels, Oscar muted for the engineer).
8. **Scripted first-timer proxy** (`tests/e2e/first-timer-proxy.spec.ts`), per package: real UI only (clicks and keys on visible controls; no
   `window.__creation` call, no `dispatch`, no test seam); follows only what Oscar rings or the step card names; asserts the test signal plays
   (the audio state is read only to assert the end, after the last action), actions <= 25, Oscar words <= 180; prints machine time, action count,
   sentence count and the modelled floor (machine + 1.5 s x actions + 3 s x sentences). Reported as « floor for a known route ».
9. **Engine neutrality, by behaviour:** for a fixed corpus of designs (empty, each reason code, the reference template, the playable template),
   the store's rule events, the signal path's `playbackReady` and reason texts are identical with and without `?design=n` and for each profile.
   An import scan also proves `src/engine`, `src/flow`, `src/logic` and the store never import `src/design/packages.ts` or the onboarding code.
   The directory check `git diff c51dc87 -- tekpractice-sim/src/engine` stays empty as well.
10. **Exam absence:** with `?mode=exam` and with `?oscar=0` and a `?design=n`: no start-screen offer, no step card, no character, no guide
    chunk requested; the legacy route (`?level=`, `?legacy=1`) is untouched (existing exam and guide-legacy specs stay green).
11. **Visual snapshots:** 5 packages x 3 viewports, start screen and workspace, the 3D canvas masked (WebGL output is not stable across machines).
12. **Unit, triggers and does-not-trigger:** every tutorial step's completion (one event that completes it, one close event that does not);
    every checklist row (blocked, not yet checked, ticked); the helper (offered / not offered for each condition; one undo entry; rollback on a
    refusal; never a `SET_CONTROL`); the onboarding state machine (each transition, blocked storage, corrupt record); `designFromSearch` (1 to 5,
    0, 6, `abc`, repeated key); the banned-phrases lint (a phrase that trips it, a near miss that does not).

Existing tests this work changes (grep of `tests/`, 2026-11-12), each to be updated in the task that changes its subject:
- `tests/guide/mount.test.ts` (`hostInsets` bars-only expectations; flows), `tests/guide/flows.test.ts`, `tests/guide/strings.test.ts`
  (`premier-montage` flow list and texts), `tests/e2e/guide-creation.spec.ts` (« Premier montage », « Prochaine étape », `.oscar-icon`, the
  icon name « Oscar, assistant IA », `PAGE_LISTENERS`, resting position clear of the status bar), `tests/e2e/guide-legacy.spec.ts` (icon name),
  `tests/guide/verdict.test.ts` and `tests/guide/brain.test.ts` (verdict texts « Le lieu est vide… », « Aucun lieu n’est encore choisi… », the
  first-reason branch), `tests/guide/mainTail.test.ts` (the `bootCreation()` call), `tests/guide/vendor.test.ts` (hashes, if the patch lands).
- `tests/creation/templates.test.ts` (template list), `tests/e2e/creation-picker.spec.ts` (template count 1),
  `tests/e2e/creation-keyboard-patch.spec.ts` (one template), `tests/creation/menuModel.test.ts` and `tests/e2e/creation-shortcuts.spec.ts` (Aide
  items), `tests/creation/copyDeck.test.ts` (new sections), `tests/creation/statusModel.test.ts`, `tests/e2e/creation-status.spec.ts`,
  `tests/e2e/creation-listen.spec.ts` (the status bar gains the checklist chip; « La lecture console est coupée. » stays verbatim).
- Specs that read `place-picker` / « Choisir un lieu » on a fresh load (16 and 13 files) are unaffected because the default has no start screen
  (section 2); they are the regression guard for that.

## 12. Visuals (stills and storyboard; no video)

- **Annotated real captures:** a Playwright script against the LOCAL production build (port 4392) walks the tutorial and saves one PNG per step
  at 1366 x 768. Annotations are drawn in the page before the capture as an SVG overlay: Ambre arrows and step numbers on Nuit areas only (never
  Ambre text on Papier), Tektur numbers, square shapes, no other colour. Output: `tekpractice-sim/docs/tutorial/captures/` (kept local until the
  founder has looked: the 3D models wear pictures derived from product photos, see 13).
- **Storyboard:** `tekpractice-sim/docs/tutorial/storyboard.md`, one row per step (capture, Oscar's line, what the learner does, the character
  state). **No video is made**; a video only after the founder has seen the storyboard.

## 13. Risks and open founder decisions

Risks (the plan's risk table carries likelihood, impact, mitigation, owner):
- the 3-minute claim is unmeasured with people; the proxy proves a path, not learning;
- the vendor patch drifts from its private source;
- the character skin depends on vendored class names;
- the start screen inside the picker grows the picker's file and its tests;
- five packages may be judged on taste on one PC (N = 1);
- packages 3 and 5 lean on content changes (unreviewed rooms; a new template).

Open founder decisions (none is decided by this spec):
1. **Helper scope:** v1 cables only; the council's minority view would also let it place the multiprise in a rapid start.
2. **« Assistant » vs « IA »** in the icon's name (today « Oscar, assistant IA »).
3. **Rooms and templates:** the new playable template in the neutral room; what to do with « Concert simple (référence) » and its pitch « le plus
   simple pour commencer » (relabel, fix in place with the 22-spec update, or keep); the venue rooms shown after a first sound (all pending review).
4. **« 3 minutes »** wording: the UI says « {n} étapes, à votre rythme » until at least 5 timed first-timers exist.
5. **R1 / R3 rule rewording** (catalog) and the « 40 dB » line of R2.
6. **The vendor patch** (local patch + upstream later, or insets-only with the residual).
7. **Captures:** the 3D models wear textures derived from product photos; whether captures of them may be shown follows the standing rule on
   manufacturer photos.
8. **Which package becomes the default**, after his comparison.

## 14. Out of scope

- Any change to `src/engine`, to the rules R1 to R8 logic, to the catalog defaults (« Lecture console » stays off by default; nothing powers itself).
- Accounts, classes, teacher administration, analytics, any network call.
- Live switching between packages; persisting `?design`; more than two presenters; in-world pins in the 3D view.
- A second register of wording per profile (one register in v1).
- Video; marketing pages; the public site's honesty fixes (« Réussir le BTS Son » on the site is outside Mode Création and is reported
  separately).
- Mobile phone layouts beyond today's (desktop first, tablet comfortable).
- Timing real people (the founder's later test).
