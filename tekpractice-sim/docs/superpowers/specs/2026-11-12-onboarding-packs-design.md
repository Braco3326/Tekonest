# Onboarding packs: first visit, tutorial, Oscar and five design packages (Mode Création)

Version 2, 2026-11-12 (amended after council round 2). Status: design, not built. Branch `design/onboarding-packs` (local only, never pushed).
Base: the live code (`ee396da`). Plan: `docs/superpowers/plans/2026-11-12-onboarding-packs.md` (its last section, « Council 2: what changed »,
maps every round-2 finding to the text that answers it).

Every fact about the code below was read in the code on 2026-11-12 (file and symbol named). Anything not verified is marked **[unverified]**
with what would settle it. Where this spec departs from a council position it says so (search « Departs »).

---

## 1. Goal and success test

**Goal.** A complete beginner opens Mode Création, says who they are in one click, and reaches a **first sound** without outside help: a place
chosen, a console, a mic and a speaker placed and connected, the test signal heard. One codebase offers **five complete packages** (first-visit
journey + game layout + colour balance) that the founder compares on his PC with `?design=1..5`.

**The founder's test.** « A complete beginner reaches a first sound in under 3 minutes, unaided. »

| What | Provable now? | How |
|---|---|---|
| A route to the first sound exists in every package with no dead end, using only what is on screen | yes | the scripted route with per-step checks (11.8): at each step the ring is present and unobstructed, the step card says step k, the completion event fires |
| An action count per route, measured | yes | recorded on the first green run, then held at measured + 10 % |
| A modelled reading time | yes, as a model | 11.8; reported in the ledger, never in the UI |
| A real beginner does it in under 3 minutes | **no** | people: 5 first-timers per package, unaided, screen-recorded, timed by the founder later |

Scripted floors measured on production before this work: 27 to 94 s on a known route, 33 to 36 actions. Arithmetic on the dialog route with
this tutorial: **28 to 34 actions** (3 devices 9 to 12, the strip 3 to 4, four cables x 3, the toggle 2, listening 2); packages that close the
drawer after each placement cost more. The experts' estimate for real first-timers is 4 to 6 minutes. None of these is a human measurement.
**The scripted route proves the absence of dead ends, never a human time. No minutes figure appears in the UI** (section 9).

## 2. Scope switch: no `?design` = today's game plus the stand-alone fixes

`?design=1..5` is read from the address only, never stored. Without it a visitor gets today's Mode Création plus the stand-alone fixes of
section 8. Start screen, profiles, tutorial, new character and package layouts exist only under `?design=1..5`. Promoting a package to the
default is a later founder decision.

Verified consequence: 45 Mode Création e2e specs open `/` and expect the place picker on a fresh load (`tests/e2e/creation-*.spec.ts`,
`guide-creation.spec.ts`). They stay valid and act as the regression guard for « no start screen without `?design` ».

A reload switches packages; the autosave (`audio-sim/creation.v1`) keeps the project. No live switching in v1.

## 3. Personas and profiles

Four profile buttons, labelled by situation, keys 1 to 4. Profiles and packages are separate axes; tests cover 5 packages x 1 profile and
4 profiles x 1 package, never 20.

`ProfilePreset` (data, `src/creation/onboarding/profiles.ts`):

```ts
type ProfileId = 'decouvre' | 'etudie' | 'projet' | 'metier'
interface ProfilePreset {
  id: ProfileId
  key: '1' | '2' | '3' | '4'
  labelKey: string                  // COPY key
  offerFocus: 'tutorial' | 'skip'   // the offer button that has focus (Enter accepts it)
  inventoryTab: InventoryTab        // src/creation/inventory.ts
  panels: { tree: boolean; props: boolean } | 'package'
  oscarProactive: boolean           // false = Oscar starts muted (no auto-raise); the icon stays
  afterFirstSound: 'none' | 'own-gear-and-venues'
}
```

| Profile (button text) | Who | offerFocus | inventoryTab | panels | oscarProactive | afterFirstSound |
|---|---|---|---|---|---|---|
| « Je découvre » | complete beginner | tutorial | consoles | package | true | none |
| « J'étudie le son » | BTS / bachelor student | skip | consoles | { tree: true, props: true } | true | none |
| « Je monte un projet » | entrepreneur, learning, also about his own gear | tutorial | consoles | package | true | own-gear-and-venues |
| « Je travaille dans le son » | working engineer | skip | consoles | { tree: true, props: true } | false | none |

- Every first sound happens in the **neutral room** (section 5).
- **Entrepreneur, after the first sound:** one line « Votre matériel n’est peut-être pas dans l’inventaire : seuls les appareils listés sont
  dans le simulateur. » and three **generic** venue cards (types only, e.g. « Salle des fêtes », « Bar-concert », « Petite salle »), each
  labelled « salle d’exemple, non vérifiée », with **no capacity, size or other figure** (the picker's own cards show sizes; these do not). No
  named real venue. The honesty lint checks the label and the absence of digits.
- The engineer still sees the offer (focus on « Passer »). Oscar starts muted for him: the controller skips its auto-raise while muted
  (`dueForAutoRaise(..., tone.muted, ...)`, vendored `core/controller.ts`). **[unverified]** whether `muted` has other effects; T5.5 reads every
  `muted` path and records them.
- No profile locks a feature or changes catalog, rules or engine.

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

- Only under `?design=1..5`, and only when `restore()` returned false and no onboarding record exists. `restore()` (src/creation/boot.ts) reopens
  a valid autosave with no picker; otherwise the boot calls `picker.show({ closable: false, focus: false })`. The start screen replaces that one
  call with `picker.showStart(...)` when the conditions hold. The wiring lives in `src/creation/onboarding/wire.ts`; `boot.ts` gets one call.
- **No auto-start.** The offer is inline on the same screen.
- **Skip never re-nags.** Once answered, the offer is not shown again on this device. Re-open from Aide > « Premiers pas » and from the profile
  chip. Aide > « Premiers pas » with no place open opens the neutral room first, then the tutorial.
- **Resume after a reload** (section 6.1): the tutorial resumes at its persisted step; Aide offers « Reprendre à l’étape {k} » and « Recommencer ».

### 4.2 The start screen is a stage of the place picker (one `inert` owner)

- Verified: `mountPlacePicker` sets its `covers` (`[shell.tree, shell.viewport, shell.props]`) `inert = true` in `show()` and `inert = false`
  unconditionally in `hide()` (placePicker.ts). A second overlay would be cleared by that `hide()`. So the start screen is a stage of the same
  `section`: `showStart()` shows the start panel and hides the head and grids; « Tous les lieux » switches to the grids; a profile + offer choice
  calls the same `onChoose` path with the neutral room card, which closes the picker through `showCanvas()` as a card click does.
- **Its own Échap handler.** The picker's Échap handler is gated on `closable`, false on a first visit; the start stage handles Échap itself
  (profile stage: « Tous les lieux »; offer stage: « Passer, je connais »).
- The picker's confirm dialog calls `setInert(on)` on its head and scroll; the start panel is added to that set so the confirm dialog never leaves
  it reachable.
- Content: title (`h2`), « Vous pourrez changer de profil à tout moment. », four large equal buttons (keys 1 to 4), « Tous les lieux ». After a
  profile choice, inline: two **equal** buttons « Faire le tutoriel (conseillé · {n} étapes, à votre rythme) » and « Passer, je connais ».
- With the guide not allowed on the address (`?oscar=0`, or any `mode`, `level`, `legacy` parameter: `guideRouteAllowed` + `guideMode`,
  src/guide/mode.ts) the offer is hidden; the profile buttons stay. `main.ts` computes `tutorialAllowed` and passes it to
  `bootCreation({ tutorialAllowed })` (creation may not import the guide; `tests/guide/mainTail.test.ts` is updated).

### 4.3 Keyboard and focus

| Where | Keys | Focus |
|---|---|---|
| Profile stage | Tab (4 buttons, « Tous les lieux »), 1 to 4, Enter, Échap = « Tous les lieux » | first profile button |
| Offer stage | Tab, Enter, Échap = « Passer, je connais » | the button named by `offerFocus` |
| After the offer | the neutral room opens | the canvas (as `showCanvas()` does) |
| Tutorial | nothing inert, no focus trap; Échap stays the app's own cascade | step card buttons come after the status bar in tab order; Aide > « Aller à l’étape » focuses the card |

### 4.4 Stored state (localStorage, every access in try/catch)

| Key | Owner | Content |
|---|---|---|
| `audio-sim/creation-onboarding.v1` | creation | `{ v: 1, profile, offer: 'taken' \| 'skipped' \| null, request: number, shown: StepId[] }` |
| `oscar-guide.onboarding.v1` | guide (new) | `{ v: 1, handledRequest: number, step: StepId \| null, status: 'running' \| 'done' \| 'stopped' }` |
| `oscar-guide.state.v1` | vendored controller | its flow state (it persists and restores it: `restore()` / `persist()` in `core/controller.ts`) |
| `oscar-guide.ui.v1` | vendored widget | the learner's resting corner |

The guide starts the tutorial only when `request > handledRequest`, then writes `handledRequest`, so a reload after the end never restarts it
and never overwrites the resume. Blocked storage: both records live in memory for the page's life (the start screen may show again next visit;
stated, accepted). A corrupt record is replaced silently (no learner work in it). `?design` is never stored.

## 5. First room and camera framing

- The neutral room is the place key **`blank`** (« Salle vide neutre », `BLANK_SIZE` 24 x 14 m, flat; src/creation/places.ts).
- Default camera (sceneHost.ts `buildScene`): alpha pi/2, beta 1.05, target (0, 1, 0), radius clamp(max(w, l) x 0.8, 8, 55) = **19.2 m** for
  `blank`; lower limit 2 m (`ENSEMBLE_LOWER_RADIUS`), upper max(40, 1.5 r); Babylon's default fov 0.8.
- A placed SM58 measured about 15 px at that view (persona walk, 1366 x 768). About **7 m** of radius should give 40 px **[unverified: one
  measurement; T2.5 measures and tunes]**. Applied with the existing `host.rig.flyToPreset` (src/scene/CameraRig.ts; used by `goToPoint`). No
  engine change. If 40 px needs less than the 2 m lower limit, T2.5 stops and reports.

## 6. The tutorial

### 6.1 One machine, one step list, persisted

The tutorial is one flow of the vendored controller, id `premiers-pas`, data in `src/guide/flows.creation.ts`. Verified in vendored code: the
controller runs flows, rings the anchor, walks the icon, offers « Montre-moi », « Un indice de plus », « Passer cette étape », escalates after
`Step.hintAfterMs`, and **persists its flow state and restores it after a reload** (`core/controller.ts`). The host starts it with
`handle.send({ type: 'flow', control: { action: 'start', flowId: 'premiers-pas' } })`. A step ends on a host event with an optional data
`match` (`core/flow.ts`). The guide also writes the current step id into `oscar-guide.onboarding.v1` (the step card and Aide read it). A test
reloads mid-tutorial and asserts the same step is current and ringed.

Packages never get their own list: each package's pacing selects step ids from this one list (section 7).

**Creation asks, guide acts** (creation must not import the guide): the start screen increments `request` in the creation record; a reader
`onboarding()` on the debug hook (`window.__creation`, already the bridge's only input) exposes it; the bridge's existing 500 ms poll sees it and
the mount starts the flow. **Guide tells creation** (helper unlock, current step): a `CustomEvent` `tekpractice:tutorial` on `window` with
`{ step, helperUnlocked }`; its name is a constant in a neutral module (`src/design/events.ts`). The creation listener exists with and without
the guide, so the pinned guide listener difference in `tests/e2e/guide-creation.spec.ts` does not move.

### 6.2 Host event annotations (mount.ts, like `annotateToggle`)

| Bridge event | Added data | From |
|---|---|---|
| `deviceAdded` | `role: 'source-console' \| 'mic' \| 'speaker' \| 'mains-strip' \| 'other'` | catalog: `source-console` = a device with a route `from: 'control:...'` (today only `yamaha-ql1`); `mic` = `realWorld.category` `microphone`; `speaker` = `powered-speaker` or `studio-monitor`; `mains-strip` = a device with an `isMainsSource` port |
| `connect` / `disconnect` | `pair: 'console-speaker' \| 'mic-console' \| 'mains-console' \| 'mains-speaker' \| 'other'` | the two ends' roles, signal `mains-power` |
| `toggle` | `playback: true` for the source console's `playback-usb` | catalog route `from` |
| new `playStarted` | `source: 'test'` | reader `audioState()` added to the bridge's `CreationReader` pick (exists on the hook) |

Only the QL1 is a playback source in the catalog (the « Consoles » tab also holds a stage box, a broadcast console, a preamp and a monitor
controller). The step line names it by its catalog label.

### 6.3 The step list (data)

New reserved anchors, resolved in mount.ts from the live state like `port:suggest.from` today:
- `nav:inventory.tab` → the drawer tab named by the step when the drawer is open, else the « Matériel » menu button;
- `nav:inventory.item` → the inventory card of the step's device when that tab is shown;
- `nav:connect.from` → the source device of the pair while it is not selected, then its « Connecter à… » button in Propriétés (the dialog
  route, verified on production; the click-port-to-port route was never walked);
- `control:suggest.playback` → the console's « Lecture console » control (pad in the scene or the row in Propriétés);
- `nav:ecoute` → `#cr-menu-ecoute`; `nav:checklist-power` → the checklist's helper button.

| # | id | Anchor | Done when | Oscar's bubble (« vous ») | Words |
|---|---|---|---|---|---|
| 1 | `console` | `nav:inventory.tab` → `.item` | `deviceAdded` role `source-console` | « Ouvrez l’inventaire (Espace), onglet Consoles, et posez la {console} sur le sol. » | 14 |
| 2 | `micro` | idem | `deviceAdded` role `mic` | « Posez le micro {micro}, onglet Micros. » ({micro} = the SM58's catalog label) | 6 |
| 3 | `enceinte` | idem | `deviceAdded` role `speaker` | « Posez une enceinte, onglet Enceintes : c’est elle qui diffuse le son. » | 12 |
| 4 | `console-enceinte` | `nav:connect.from` | `connect` pair `console-speaker` | « Sélectionnez la console, puis « Connecter à… » : la prise proposée vers l’enceinte est compatible. » | 15 |
| 5 | `micro-console` | `nav:connect.from` | `connect` pair `mic-console` | « Faites de même du micro vers la console : la prise proposée est compatible. » | 13 |
| 6 | `lecture-console` | `control:suggest.playback` | `toggle` playback, value true | « Sélectionnez la console, puis activez « Lecture console » dans Propriétés : c’est la source de test du simulateur. » | 17 |
| 7 | `multiprise` | `nav:inventory.tab` → `.item` | `deviceAdded` role `mains-strip` | « Dans ce simulateur, la console et l’enceinte ont besoin de courant : posez une multiprise, onglet Secteur. » + note « Ici, la multiprise est la source de courant : le simulateur ne vérifie ni la prise murale ni la puissance. » | 17 + 16 |
| 8 | `courant-console` | `nav:connect.from` (strip pair) | `connect` pair `mains-console` | « Reliez la console à la multiprise. » | 6 |
| 9 | `courant-enceinte` | idem | `connect` pair `mains-speaker` | « Reliez aussi l’enceinte à la multiprise. » | 6 |
| 10 | `ecoute` | `nav:ecoute` | `playStarted` source `test` | « Ouvrez Écoute, puis Signal de test. » | 6 |

- After step 10 the bubble shows `COPY.listen.simple` **by key** (the pinned sentence, not new wording). Then, **only when a mic is cabled to a
  console input** (`signalPath(...).micOk` or its `micReasons` without `NO_MIC`): « Le micro est câblé mais n’est pas entendu : le signal de test
  entre à la console. »; with no mic cabled (a skipped step) the line is the engine's own `NO_MIC` text.
- An accepted connection gives « Connexion acceptée. » with a nod (section 10.2); never « bien réglé », « bravo », « correct ».
- Word budget: about 175 on the whole path including `listen.simple` and the conditional mic line; the budget is **200** across bubble, card and
  checklist (11.8).
- **Departs from the council (order):** « Lecture console » comes before power. The signal path checks source exists, source on, console powered
  (returns at the first failing one), then path, then speaker power (src/flow/signalPath.ts). From step 6 on, the status bar's reason and the
  current step name the same thing. **Not claimed:** during steps 2 to 5 the status bar already says « La lecture console est coupée. » (a QL1
  exists); the steps are not designed to agree there and no test asserts agreement.
- Steps 4 then 5: the sound needs the console-to-speaker cable; the mic cable gives « Micro OK » only.
- Step 2 names the dynamic SM58 so no hidden phantom prerequisite appears. **[unverified]** whether a condenser blocks « Micro OK » without
  +48 V; any mic still completes the step.
- « Passer cette étape » stays; a skipped step reads « passée ».

### 6.4 The checklist « Pourquoi je n’entends rien ? »

Creation-side, read-only (works with `?oscar=0`, every package, profile and template), shown when a place is open and `playbackReady` is false:
a chip in the status bar and a line under the greyed Écoute items (`#cr-menu-desc-test-signal` exists).

| Row | Reason codes (`ReasonCode`, signalPath.ts) | Blocked text | « Aller à » |
|---|---|---|---|
| Source | `NO_SOURCE` | the engine's `text_fr` verbatim | opens the inventory on Consoles |
| Lecture console | `SOURCE_OFF` | verbatim | selects the console |
| Alimenté | `HOST_UNPOWERED`, `SPEAKER_UNPOWERED` | verbatim | selects the first subject's device; helper button (6.5) |
| Câblé | `NO_PATH`, `RULE_ERROR` | verbatim | selects the first subject's device |
| Micro (separate line) | `NO_MIC` or `checklist.micCabled` | `NO_MIC` text, or « Le micro est câblé, mais Écoute ne le fait pas entendre : elle lit un morceau, un fichier ou le signal de test. » only when a mic is cabled | — |

- `Record<ReasonCode, Row | 'mic'>`: a new code fails to compile until placed.
- **Tri-state, never a false tick (amended 2026-11-12 after the G3 review):** the first three gates return early, so rows after the first blocked one read
  « pas encore vérifié ». Tick rule: **every row is ticked when `playbackReady`** (the list is hidden then), and **the Source and « Lecture console » rows are
  also ticked (tag « En place ») when a LATER row is the blocked one**, because `signalPath.ts` returns early at exactly those gates (line 149 `NO_SOURCE`,
  line 151 `SOURCE_OFF`): reaching a later reason proves both passed. The Alimenté and Câblé rows are ticked only when ready: the speakers' supply is evaluated
  in the same pass as the cables (lines 211 to 215), and a blocked cable leaves it unknown. The Alimenté row is therefore conservative: it reads « pas encore
  vérifié » above a blocked cable row although line 153 proved the console's own power; the row mixes the console's supply (checked early) and the speakers' (not).
- **The mic line is the checklist's own** (`checklist.micCabled`), not the 6.3 tutorial line: the list is shown only while playback is blocked, so a sentence about
  the test signal entering the console would be false there. It says only what Écoute plays (a song, a file or the test signal, never the mic).
- It changes nothing: « Aller à » only selects or opens.

### 6.5 The power helper « Je branche pour vous (dans le simulateur) »

Cabling only, one undo entry, after the learner placed a strip.

- **Conditions (all):** a verified `multiprise-secteur` in the design; at least one verified device with a free `power-in` not cabled to a mains
  source; enough free strip outlets; practice address.
- **Same gate everywhere:** during a tutorial run on steps 8 or 9, the checklist's helper button is **disabled with a visible reason**
  (« Essayez d’abord de relier vous-même ; je pourrai brancher pour vous ensuite. ») until the guide sends `helperUnlocked` (Oscar's third
  escalation tier: point, then say, then offer). Outside a tutorial run it follows the conditions above.
- Oscar's offer sentence: « Je peux brancher pour vous, dans le simulateur. »
- **Never:** at project open; before the learner tried inside a tutorial run; in exams; for a Bêta strip (`isMainsSourceRef` false for unverified
  devices, src/creation/mains.ts); never places a strip; never `SET_CONTROL`.
- **Intents (verified):** per device `{ type: 'CONNECT', a: { instance: <strip>, port: 'out-k' }, b: { instance: <device>, port: 'power-in' } }`
  (src/ui/intents.ts). Inlets `power-in` (`iec-c14`, `mains-power`) on every verified device that takes mains; outlets `out-1`..`out-4`
  (`iec-c13`, `isMainsSource`). Free outlets via `isMainsSourceRef`; each pair pre-checked with `store.canConnect(a, b)` (src/creation may not
  import `ConnectionGraph`: `tests/creation/shellImports.test.ts`). Not the guide's `nextConnectionStep` (guide code; prefers audio pairs).
- **One transaction (verified, src/creation/history.ts):** `begin(label)`, `do(CONNECT)` per device, `commit()` = one undo entry; on any refusal
  `rollback()` and nothing recorded. A refused `do` still notifies `onRefused`, hence the pre-check.
- **After:** status line « Branché au courant : {devices}. Ctrl+Z pour annuler. »; in the tutorial the completed steps go into `shown` and the
  card marks them « montré », no celebration.

### 6.6 Presenters (at most two)

- **Step card** (guide-side, `src/guide/stepCard.ts`): **progress only**: « Étape {k} sur {n} », a tick / « passée » / « montré » per step, and
  « Passer le tutoriel ». It never repeats the bubble's sentence and never shows « réussi ». It sits in a **reserved slot** of the shell grid
  (`[data-testid="tutorial-slot"]`, a row under the menubar that exists only while a tutorial runs), so it never overlays a control. It reads the
  current step from `oscar-guide.onboarding.v1` / the guide's own state, not by parsing bubble text.
- **Checklist** (6.4): a chip or a permanent panel, per package.

## 7. The design packages

### 7.1 The table (`src/design/packages.ts`)

`src/design` is neutral: the shell and the guide both import it. The skeleton (ids, `designFromSearch`, defaults, `html[data-design]`, the
no-branching lint) lands **first** (plan T0.1), before any task that reads it.

```ts
type DesignId = 1 | 2 | 3 | 4 | 5
interface RoleColours {           // brand colours or a declared derived tint, each with its computed pairs
  ground: Hex; surface: Hex; ink: Hex; inkMuted: Hex
  accent: Hex; accentInk: Hex; secondary: Hex; secondaryInk: Hex
  focus: Hex; select: Hex          // new role tokens --cr-focus, --cr-select (replace hard-coded Ambre in creation.css)
}
interface LayoutPreset {
  panels: { tree: boolean; props: boolean }
  drawer: 'close-after-place' | 'stay-open'
  density: 'comfortable' | 'dense'
  surfaceStyle: 'raised' | 'flat' | 'banded' | 'sheet' | 'framed'
  oscarCorner: 'br' | 'bl' | 'tr'   // 'tl' forbidden: the view cube sits there (120-130 px)
  shortcutsBesideControls: boolean
  checklist: 'chip' | 'panel'
  start: 'neutral-room' | 'playable-model'
}
interface Pacing { steps: readonly StepId[]; hintAfterMs: number }
interface OscarPolicy { leads: boolean; proactive: boolean }
interface DesignPackage {
  id: DesignId; nameKey: string; tell: string; colours: RoleColours; layout: LayoutPreset
  pacing: Pacing; presenter: 'step-card' | 'checklist'; oscar: OscarPolicy; framing: CameraPose
}
export function designFromSearch(search: string): DesignId | null // exactly one `design` key, value '1'..'5'; else null
```

Lint (test): no `design ===`, `designId ===`, `data-design` read or `DESIGN_PACKAGES[` outside `packages.ts` and the one line that applies it;
CSS may select `html[data-design]` only in `src/design/packages.css`. Components read fields of the active package, never its id. A test also
asserts **no two packages share a colour map and no two share a layout preset**.

### 7.2 Five identities

| | 1 « Pas à pas » | 2 « Atelier » | 3 « Salle d’abord » | 4 « Pupitre » | 5 « Modèle d’abord » |
|---|---|---|---|---|---|
| **Tell** (squint test) | one lit thing on a dark screen | Prune study-sheet bands | a daylight Papier sheet | flat, hairline console, no raised panel | a Prune stage frame around the 3D view |
| Prune share | about 3 % | about 20 % | ink and focus only | 0 % | about 45 % |
| Best for | newbie | student | entrepreneur | engineer | mixed |
| Help is delivered by | Oscar leads, spotlight, step card | permanent checklist, Oscar on demand | step card, plain role words, coverage legend « estimation » | nothing by default (offer shown), keyboard first | a wired playable model, unplug / replug |
| Presenter | step card | checklist (panel) | step card | checklist (chip) | step card |
| panels (tree / props) | collapsed / collapsed | open / open | collapsed / open | open / open | open / collapsed |
| drawer | stay open | stay open | stay open | close after place | close after place |
| density | comfortable | dense | comfortable | dense | comfortable |
| surfaceStyle | raised | banded | sheet | flat | framed |
| oscarCorner | br | bl | tr | br | bl |
| shortcuts beside controls | no | yes | no | yes | no |
| checklist | chip | panel | chip | chip | chip |
| start | neutral room | neutral room | neutral room | neutral room | playable model (8.5) |
| Oscar | leads, proactive | proactive, does not lead | leads, proactive | muted, does not lead | leads, proactive |
| Pacing steps | 1-10 | 1-10 | 1-10 | 1-10 if taken | `ecoute`, `debrancher`, `rebrancher` |
| hintAfterMs | 20 000 | 30 000 | 20 000 | 0 (no hint) | 25 000 |
| Risk | patronising | dense at 1366 x 768 | unreviewed rooms after the first sound | a beginner is lost (a profile fit) | depends on the playable model |

Package 4 and package 2 differ by drawer, checklist form, surface style, colours and corner (no shared preset). Package 5's pacing: `ecoute`
first (the model already plays), then `debrancher` (done on a `disconnect` of one console-to-speaker cable; « Débranchez le câble de la console
vers l’une des enceintes : cette enceinte se tait, l’autre continue. »), then `rebrancher` (done on `connect` pair `console-speaker`;
« Rebranchez-le : la prise proposée est compatible. »). The text never says sound stops before a sound was started. **[unverified]** the live
audio reaction to an unplug while playing; the scripted route asserts the voice count drops by one (`audioState().voices`).

### 7.3 Colour role maps, contrast computed (WCAG 2.1, `contrastRatio`, 2026-11-12)

Reference pairs: Papier on Nuit 16.13; Papier on panel 14.95; Ambre on Nuit 7.46; Ambre on panel 6.92; Nuit on Ambre 7.46; Prune on Papier
9.16; Papier on Prune 9.16; inkMuted on panel 7.61, on Nuit 8.21, on Prune 4.66; **Ambre on Prune 4.24** (UI and large text only);
**Ambre on Papier 2.16** (never as text, never as a UI boundary); Nuit 65 % over Papier `#615E5C` on Papier 5.53 (a derived tint);
inkMuted on Papier 1.97, danger / ok on Papier 2.09 / 1.62, Prune on Nuit 1.76, Prune on panel 1.63, panelLine on Nuit 1.53 (all never as text).

| Role | 1 Pas à pas | 2 Atelier | 3 Salle d’abord | 4 Pupitre | 5 Modèle d’abord |
|---|---|---|---|---|---|
| ground | Nuit | Nuit | Papier | Nuit | Nuit |
| surface | panel (raised) | panel + Prune bands | Papier sheets | Nuit (flat) | Prune frame and panels |
| ink | Papier on panel 14.95 | Papier on Prune 9.16 / panel 14.95 | Nuit 16.13 | Papier on Nuit 16.13 | Papier on Prune 9.16 |
| inkMuted | inkMuted on panel 7.61 | inkMuted on panel only 7.61 | `#615E5C` 5.53 | inkMuted on Nuit 8.21 (hairlines too) | inkMuted on Prune 4.66 |
| accent | Ambre fill + Nuit text 7.46, next target only | Ambre state on panel 6.92 | Ambre fill + Nuit text 7.46 + 2 px Nuit border | Ambre LED state on Nuit 7.46 | Ambre fill + Nuit text 7.46 (edge on Prune 4.24, UI only) |
| secondary | Prune step card, Papier text 9.16 | Prune bands, Papier 9.16 | Prune links and selection 9.16 | none | Nuit inset, Papier 16.13 |
| focus ring | Ambre on panel 6.92 | Ambre on panel 6.92 / Papier on Prune 9.16 | **Nuit 16.13** (Prune 9.16 for links) | Papier on Nuit 16.13 | Papier on Prune 9.16 |
| select | Ambre 6.92 | Ambre 6.92 | Prune 9.16 | Ambre 7.46 | Ambre fill + Nuit text 7.46 |

Fixed across packages: menubar and status bar stay Nuit / panel (danger and ok are only legible there); the 3D scene look is unchanged; square
corners; Tektur titles, IBM Plex Sans UI.

**Package 3 trap (verified):** `creation.css` uses Ambre for the shared focus outline (`.cr :focus-visible { outline: 2px solid var(--cr-ambre) }`),
hover borders and dialog borders (53 uses of `--cr-ambre` in that file). On Papier that is 2.16. Those uses move to `--cr-focus` / `--cr-select`
role tokens (default = Ambre, so nothing changes without `?design`), and tests check the **computed** styles in use (11.2).

## 8. First-sound and honesty fixes that stand alone (default and every package)

1. **Oscar never rests or points on a control.**
   - `hostInsets` (mount.ts) adds the open Projet / Propriétés widths (200 / 260 px, rail 32 px); the open inventory drawer is NOT an inset but an entry of `hostObstacles` (8.1, T1.2b: its height exceeds the cap below, and an inset of it made the icon rest on its « Fermer » button). **Limit (verified):**
     the vendored `cleanInsets` caps each side at a quarter of the viewport, so an open Propriétés (260 px) is clipped to 256 px at 1024 px wide
     (4 px overlap) and to **205 px at 820 px (about 55 px overlap)**. Insets alone cannot fix it.
   - **The vendored patch is needed and allowed** (controller ruling): an `avoid` list in `placeBeside` / `MotionInput` and an `obstacles` callback
     in `mountGuide`, used for the walking, pointing and resting positions; the bubble keeps clear of the current target and of the icon. Listed in
     `src/guide/VENDOR-PATCHES.md`, patched files recorded in `VENDOR.json` (a `patches` field: the `sourceCommit` no longer describes them), pinned
     by `tests/guide/vendorPatches.test.ts`.
   - Resting corner: vendored `DEFAULT_CORNER = 'br'`, overridden by the learner's stored corner (`oscar-guide.ui.v1`). The package corner is
     applied host-side through the `storage` wrapper handed to `mountGuide` (returns the package corner when nothing is stored).
2. **The checklist** (6.4).
3. **Oscar says what to do.** The verdict (src/guide/verdict.ts, last branch) keeps the reason verbatim and adds one « vous » action sentence
   per playback `ReasonCode` the verdict can carry (COPY `assist.*`: NO_SOURCE, SOURCE_OFF, HOST_UNPOWERED, NO_PATH, SPEAKER_UNPOWERED). `RULE_ERROR` adds nothing (the
   rule's own explanation is the fix) and `NO_MIC` never reaches the verdict (it lives in `micReasons`; the bridge reads `reasons[0]`). The NO_SOURCE sentence asks for
   a console that has the « Lecture console » command, because the Axia iQ is a console without one.
4. **Rule texts: one accessor, an override map, no catalog edit.** `src/creation/ruleTexts.ts` exports `creationRuleRows(rows)` (the catalog rows
   with Mode Création's `teach_fr` overrides applied, keyed by rule id) and `ruleText(ruleId)`; default = the catalog text. It is used at **all four
   read sites** (verified): the status list (`boot.ts:281` `ruleTextFor(registry.catalog.rules)`), the connect dialog's default
   (`connectModel.ts:62`), Oscar's answers (`brain.ts:116`, rows handed in by `mount.ts:243`, creation route only) and the verdict
   (`brain.ts:104/134` `buildVerdict(..., ruleTextFor(rules))`). The catalog stays byte-identical, so the legacy Essais rules fingerprint
   (`rulesRevOf(catalog.rules)`, src/trials/fingerprint.ts) is unchanged; **the legacy route keeps the old texts** (reported to the founder).
   The override texts are in Appendix A.
5. **Templates: a playable model and honest pitches.** « Concert simple (référence) » is silent: no cable from QL1 `out-main-l` / `out-main-r` to
   the speakers' `in-line-a`, and `controls: {}` (« Lecture console » off). Fixing it in place would break `tests/creation/templates.test.ts`
   (4 connections, `controls: {}`) and 22 e2e specs that add those cables and the toggle themselves. v1: a **new** template
   `content/templates/premier-son-pret.json` in `blank`, name « Premier son (déjà câblé et alimenté) » (no « Concert simple », so the specs'
   locator stays unique), with the two line cables, three mains cables, the mic cable and `controls: { ql1: { 'playback-usb': true } }`.
   The single pitch over the template row (`picker.templatesPitch`, copy.ts:239, « … le plus simple pour commencer ») is rewritten
   (« Un lieu avec du matériel déjà posé. ») and each template card gets a note: « Joue dès l’ouverture : déjà câblé et alimenté. » for the new
   one, « À compléter : sorties de la console vers les enceintes, Lecture console. » for the reference. A test runs every template through
   `APPLY_DESIGN` + `signalPath`: a template that is not `playbackReady` must carry the « À compléter » note. Two specs pin the template count
   (`creation-picker.spec.ts`, `creation-keyboard-patch.spec.ts`) and are updated. **[unverified]** that `APPLY_DESIGN` applies a template's
   `playback-usb: true`; T1.6 proves it first.

## 9. Copy and honesty

- New user strings: COPY keys (sections `onboarding`, `tutorial`, `checklist`, `assist`, `ruleOverride`) + deck rows, status « à valider
  (tekuxwriter) » (new status value in the deck legend). French « vous ». The guide reads them through `COPY`. `TP_STRINGS` (impersonal, no digit)
  is not used for the tutorial.
- **Pinned byte-identical:** `coverage.unit`, `.method`, `.hatched`, `.splPending`, `.frontCaveat`, `.source*`, `.chip` (« estimation »),
  `listen.simple`, `listen.playing`, and the Bêta tooltip « Fiche proposée, pas encore vérifiée : comportement approximatif. »
- **Banned phrases** (one list; lexical, so section 11 adds a runtime scan):
  - success and school: « réussir », « prépare au », BTS, E4, TMO, jury, examen in onboarding / tutorial / checklist / Oscar strings;
  - fidelity: « réaliste », « vrai matériel » without « simplifié », garanti, certifié, exact, fidèle, identique, « comme en vrai », « comme sur
    scène », « sonnera »;
  - safety and norms: endommag-, abîm-, griller, danger, sécurité, norme, « conforme »; STI, SPL (outside the pinned `splPending`), RT60;
  - judgement: bravo, parfait, correct, réussi, « bien réglé »;
  - false certainty: « la seule », « le seul », « passé par votre câblage », « vous entendez le micro »;
  - durations: `\d+\s*(s|sec|mn|min)\b`, « trois minutes » and other spelled-out durations;
  - figures in tutorial / checklist / Oscar strings: any dB, dBu, dBV, +48 figure, any digit except « Étape {k} sur {n} » placeholders;
  - Oscar's voice: « intelligent », « expert », « tuteur », « ingénieur ».
  Surfaces: COPY, the step list, `TP_STRINGS`, the rule override texts, template names and notes, venue-card labels, `index.html`, the storyboard
  and capture annotation text. The catalog's own `teach_fr` texts are **reported** (they stay in the catalog for the legacy route) and the test
  asserts that every catalog text that trips the list has an override (the offender list equals the override keys).
- No minutes figure. « Oscar, assistant IA » **stays as is** (the vendored `widget.iconName`, pinned in two e2e specs). The brain is a keyword
  lookup over the rule texts, with no model and no network call (src/guide/brain.ts): whether « IA » stays is the founder's call. An
  « Oscar · Assistant » badge (>= 12 px) is built in the bubble header (plan T5.4).
- Bêta stays « non vérifié »; no device number without its own manufacturer sheet record.

## 10. Oscar

### 10.1 Behaviour

Docked clear of the bars and open panels; never over a control at rest, while walking or pointing (11.3). One bubble sentence per step (plus the
power note), what to do and where. « Je n'ai pas encore d'information sur ce point. » stays its out-of-scope answer. No sound. Absent in exams and
with `?oscar=0` (mount.ts and index.ts gates, verified). Muted by default for the engineer profile and in package 4.

### 10.2 Character brief: a new character, not the vendored mascot

Today's vendored mascot (`ui/mascot.ts`) is a round smiley head with side cups. The new Oscar is a different character: **the headphones are the
character.**

- **Shape language:** square-ended strokes and rounded-rect cups (the brand's square corners), one circle (the head), no limbs except one arm.
- **Construction** (64 x 64 viewBox, built with DOM calls, no raster, no `innerHTML`): an Ambre headband (stroke 5, square caps) arching over a
  Papier head disc (r 15); two Ambre cups 14 x 22 (rx 3) on each side of the head; a Nuit outline 3 units on head and cups; all on a Prune coin
  that the band and cups break out of by 4 units (Ambre on Prune 4.24: a UI boundary >= 3; never Ambre on Papier). Separate groups: `head`
  (disc, eyes, mouth), `cups`, `arm` (one arm, square hand), `led` (standby dot).
- **Proportions:** head 30 units wide, cups 14 wide, band height 9 above the head; the silhouette (band + cups) is wider than tall, unlike a
  plain circle.
- **Face rules:** eyes are upright pills 4 x 7, Nuit; no mouth except in `shrug` (flat line) and `celebrate` (short open smile); no eyebrows, no
  cheeks, no teeth.
- **Silhouette that reads at 24 px:** the band and cups give the outline; test 11.5.
- **Pointer:** the arm points at the ring: the host sets `data-dir` (east / west / north / south) from the bearing between the icon and the
  vendored ring (`.oscar-ring`), mirroring the arm for west (the vendored arm is fixed to the right, and `placeBeside` can seat the icon on either
  side).
- Decorative: `aria-hidden="true"` on the SVG; the button keeps its accessible name.

**States and motion timing sheet** (host CSS; every animation finite; the vendored infinite animations are overridden: verified, the vendored
`guide.css` loops breathe, bob, dots, hop, pop, float and the ring pulse `infinite`):

| State | Motion | Duration / count | Easing | Static pose (reduced motion) |
|---|---|---|---|---|
| idle | one breath (head scale 1 → 1.02 → 1) and one blink | 4 000 ms once, then still | ease-in-out | eyes open, still |
| walk | bob while gliding | 550 ms per bob, only while the glide runs (<= 1 000 ms) | ease-in-out | leaning 6 deg toward the move |
| point | character still; arm extended toward the ring; the ring pulses | ring: 3 pulses x 600 ms, then steady | ease-out | arm extended, ring steady |
| think | three dots fade in sequence | 1 200 ms per cycle, at most 4 cycles | linear | three dots shown |
| celebrate | cups lift 2 units and pulse twice (the headphones react) | 1 000 ms once | cubic-bezier(.3,1.4,.5,1) | cups lifted, short smile |
| shrug | head tilts 8 deg, hand rises, flat mouth (not a headshake) | 700 ms once | ease-out | tilted head, hand up, flat mouth |
| nod | head dips twice | 600 ms once | ease-in-out | head lowered 3 units |
| wave | 120 ms anticipation, two swings of the hand | 1 200 ms once | ease-in-out | hand raised |
| sleep | lids closed, standby LED (Ambre dot) on, 70 % opacity | static (no loop) | — | same |

- The vendored controller emits seven states (idle, walk, point, think, celebrate, no, sleep). The host draws `no` as **shrug**; `nod` and
  `wave` are host states (a step done; the first open in a session), at most their duration, then back to the controller's state. The mapping and
  the timers are pure functions (testable in node); timers are cleared on destroy.
- **Celebrate sparingly:** the first accepted connection of a session and the first sound only; later accepted connections nod. This keeps the
  founder's « celebrates a correct connection » without five hops in a few minutes. **Departs** from the round-2 advice (nod only on connections):
  founder decision 8.

### 10.3 The seam (verified)

- `src/guide/vendor/**` is vendored from a private source; `VENDOR.json` holds a source commit and a sha256 per file; `tests/guide/vendor.test.ts`
  fails on any changed, added or removed file. No vendoring tool and no `docs/guide-*.md` in this repo.
- `mountGuide` builds its mascot internally (`createMascot(doc)`); its options include `labels`, `insets`, `storage`, `storageKey`,
  `reducedMotion`, `zIndex`, `getRect`, `root`, **no skin**.
- **Character = host-side skin, no vendor edit:** `src/guide/character.ts` appends its SVG to `.oscar-icon`, hides `svg.oscar-mascot` in
  theme.css, mirrors `data-state` with a `MutationObserver` (not an event listener, so the pinned count holds). A pin test fails if a re-vendor
  renames `.oscar-icon`, `.oscar-mascot` or `data-state`. An e2e check asserts the host SVG fits the 56 px icon (the vendored `.oscar-mascot`
  rule sets 100 % width and height; the host SVG takes the same box).
- **Obstacles = vendored patch** (8.1), allowed by the controller.

## 11. Testing

Ports 4391 (suites) and 4392 (captures). **Every e2e run is preceded by `npm.cmd run build`** (`playwright.config.ts` serves `dist/`; a stale
build gives a false green). Unit tests run in node (no DOM): DOM behaviour is e2e, logic lives in pure modules.

1. **DOM parity:** same landmarks and `data-testid` set across the five packages at the start screen and in the workspace (the tutorial slot is
   in all five).
2. **Contrast, in use:** (a) unit: every declared pair of 7.3 (text >= 4.5, UI >= 3); (b) e2e per package: `getComputedStyle` of the focus ring
   (`outline-color` against the element's resolved background), hover borders and dialog borders, compared with `contrastRatio`; (c) axe
   `color-contrast` on package 3's Papier screens; (d) a CSS scan: under package 3, no rule resolves Ambre as text colour, outline or border on a
   Papier surface.
3. **Geometry (rect intersection, not centre points):** at 1366 x 768, 1024 x 768 and 820 x 1180, every visible button, menu item and input of
   the shell is intersected against the Oscar icon, the Oscar **bubble** (except the current target, which the bubble may sit beside, never on)
   and the **step card**. Per-step at 1366 x 768; at rest and two steps on the other viewports (run time). The 820 px case with Propriétés open is
   in the suite (55 px overlap today). Also: bubble plus icon leave the canvas centre free at 1366 x 768.
4. **axe** on both start stages, the workspace, each tutorial step, the checklist and the connect dialog.
5. **Motion:** 6 s after any state change, `document.getAnimations()` on the icon and ring is empty (no loop survives); under reduced motion no
   animation runs and each state's static pose is distinct.
6. **24 px silhouette** (browser render in Playwright, not node): idle, point, celebrate and sleep rendered at 24 px; every pair differs in >= 6 %
   of pixels; idle differs from a plain filled circle of the same size by >= 6 %.
7. **Squint test:** each package's workspace screenshot (canvas masked) downsampled to 32 x 18; every pair of packages differs in >= 8 % of cells.
8. **Scripted route with per-step checks** (`tests/e2e/first-timer-proxy.spec.ts`), per package and per route (dialog route; port-click route
   once walked): real UI only (clicks and keys on visible controls; no `window.__creation` call before the last action, guarded by a scan of the
   spec's own source); at each step the ring is present and unobstructed, the step card says step k, the completion event fires; at the end the
   test signal plays. **Budgets from arithmetic, then measurement:** dialog route <= 34 actions for packages 1 to 3 (the arithmetic range is 28 to
   34), the measured count + 10 % for packages 4 and 5 (drawer closes after placement) and for the port-click route; the first green run records
   the counts in the ledger and the assertion holds them (only lowered, never loosened). Words <= 200 across bubble, card and checklist.
   **Reading-time model:** 0.3 s per word (200 words per minute), at least 2 s per bubble, plus 1 s per step-card change and 1.5 s per action;
   the ledger reports machine time + modelled time as « floor for a known route ». Package 5 also asserts the voice count drops by one after
   `debrancher`.
9. **Engine neutrality, in the browser:** one e2e boots `/` and `/?design=1..5`, applies a fixed corpus of designs through the hook (empty, each
   reason code, both templates), and compares the JSON of rule events, `playbackReady`, reason texts and the autosave written. The comparer is
   proven by a perturbed fixture that must fail. Plus an import scan (`src/engine`, `src/flow`, `src/logic`, `src/creation/store.ts` never import
   `src/design/packages.ts` or onboarding code) and `git diff c51dc87 -- tekpractice-sim/src/engine` empty.
10. **Exam absence:** `?mode=exam` and `?oscar=0` with `?design=n`: no offer, no step card, no character, no guide chunk; the legacy route
    untouched (existing exam and guide-legacy specs).
11. **Runtime honesty scan:** at every tutorial step and at the start screen, collect all visible text, `aria-label` and `title` in the page and
    run the banned list (catches strings outside COPY).
12. **Rule texts:** for every rule id, the status list, the connect dialog's reasons, Oscar's answer and the verdict return the same string, and
    it is the override where one exists; `rulesRevOf(catalog.rules)` equals the value recorded in pre-flight.
13. **Visual regression, only with a baseline workflow:** its own spec file (`onboarding-visual.spec.ts`), retries off, waits on state (models
    pending 0, renders idle), canvas masked; 5 packages x 3 viewports, start screen and workspace only. The baseline is created and committed in
    its own task (T7.4), then asserted. Never `--update-snapshots` outside that task.
14. **Unit, triggers and does-not-trigger:** each tutorial step's completion; each checklist row (blocked / not yet checked / ticked) and the
    conditional mic line; the helper (each condition; the tutorial gate; one undo entry; rollback; never `SET_CONTROL`); the onboarding state
    machine and the request / handled-request rule; `designFromSearch`; the banned list (a phrase that trips, a near miss that passes);
    characterization tests (pinned strings, « no avoid list = old result ») each with one mutation that turns them red.

Existing tests this work changes (grep of `tests/`, 2026-11-12): `tests/guide/mount.test.ts`, `flows.test.ts`, `strings.test.ts`,
`verdict.test.ts`, `brain.test.ts`, `mainTail.test.ts`, `vendor.test.ts`; `tests/e2e/guide-creation.spec.ts` (« Premier montage »,
« Prochaine étape », `.oscar-icon`, icon name kept, `PAGE_LISTENERS`, resting position), `guide-legacy.spec.ts` (icon name kept);
`tests/creation/templates.test.ts`, `copyDeck.test.ts`, `menuModel.test.ts`, `statusModel.test.ts`, `ruleTexts.test.ts`;
`tests/e2e/creation-picker.spec.ts`, `creation-keyboard-patch.spec.ts`, `creation-shortcuts.spec.ts`, `creation-status.spec.ts`,
`creation-listen.spec.ts`, `creation-polish.spec.ts` (template pitch).

## 12. Visuals (stills and storyboard; no video)

A Playwright script against the LOCAL production build (port 4392) walks the tutorial and saves one PNG per step at 1366 x 768. Annotations are
drawn in the page as an SVG overlay: Ambre numerals (Tektur 16 to 18 px) in a Nuit disc, arrows 3 px Ambre with a Nuit halo, at most two per
capture, numbers equal the card's « Étape k »; never Ambre on Papier. Output `tekpractice-sim/docs/tutorial/captures/`, not committed until the
founder has looked (the 3D models wear pictures derived from product photos). Storyboard `tekpractice-sim/docs/tutorial/storyboard.md`: one row
per step (capture, bubble line, learner action, character state). **No video.**

## 13. Risks and open founder decisions

Risks are in the plan's table. Open founder decisions:
1. Helper scope: cables only in v1 (or also place the strip in a rapid start).
2. « Oscar, assistant IA » stays for now; the brain is a keyword lookup: keep « IA » or not.
3. The reference template: keep with its « À compléter » note, or fix in place (22 specs to update).
4. « 3 minutes » stays a design target; the UI says « {n} étapes, à votre rythme ».
5. The rule override texts (Appendix A) and the fact that the legacy route keeps the old texts.
6. Captures: may captures of models wearing product-photo-derived textures be shown.
7. Which package becomes the default.
8. Celebrate on the first accepted connection (his words) or only at the first sound.

## 14. Out of scope

Any change to `src/engine`, rule logic, catalog files (including rule texts) or catalog defaults; accounts, classes, analytics, network calls; live
package switching, persisted `?design`, more than two presenters, in-world pins; a second wording register; video; marketing pages and the
public site's wording; phone layouts beyond today's; timing real people.

---

## Appendix A: rule text overrides for Mode Création (proposed, « à valider »)

Keyed by rule id, applied by `creationRuleRows` to `teach_fr` only (titles unchanged). French « vous », each a statement of what the simulator
accepts or refuses; no hardware outcome, no figure without a source record. R6 to R8 were reviewed and are kept (domain teaching; no safety
claim and no figure).

| Rule | Current catalog `teach_fr` (exact) | Mode Création override | Why |
|---|---|---|---|
| R1 | Un XLR mâle s’emboîte dans un XLR femelle ; une fiche TT s’emboîte dans un jack TT. Si ça ne rentre pas, ce n’est pas le bon câble : il ne faut jamais forcer. | Dans le simulateur, un XLR mâle se branche sur un XLR femelle et une fiche TT sur un jack TT. Deux connecteurs qui ne vont pas ensemble sont refusés : choisissez une autre prise ou un autre câble. | « il ne faut jamais forcer » is a real-world instruction |
| R2 | Un micro sur une entrée ligne est trop faible de 40 dB ; une ligne sur un préampli micro sature ; de l’AES3 dans une entrée analogique ne donne que du bruit ; du matériel grand public relié à du matériel pro sort 12 dB plus bas. | Dans le simulateur, les deux prises doivent porter le même type de signal : niveau micro, niveau ligne pro, niveau ligne grand public, numérique AES3… Un type différent est refusé : un micro va sur une entrée micro, une sortie ligne sur une entrée ligne. | the 40 dB and 12 dB figures have no source record; the engine's R2 is signal identity (ConnectionGraph: `SIGNAL_MISMATCH`), which the new text states |
| R3 | Le signal circule dans un seul sens : source → destination. Deux sorties qui se battent peuvent endommager le matériel. | Dans le simulateur, un câble va d’une sortie vers une entrée. Deux sorties reliées entre elles, ou deux entrées, sont refusées. | damage claim; the engine refuses out-out and in-in (ConnectionGraph R3) |
| R4 | Les micros à condensateur (U 87) restent muets sans alimentation fantôme +48 V. Les micros dynamiques (SM58, RE20) l’ignorent. Les micros à ruban d’époque peuvent être endommagés par elle. | Dans le simulateur, un micro à condensateur (U 87) reste muet sans alimentation fantôme +48 V ; un micro dynamique (SM58, RE20) fonctionne avec ou sans. | damage claim about ribbon mics |
| R5 | Le voyant rouge est un contrat de sécurité : micro ouvert = ON-AIR allumé, sinon quelqu’un entrera en parlant pendant le journal. | Dans le simulateur, le voyant ON-AIR doit être allumé dès qu’un micro est ouvert, et éteint sinon. | « contrat de sécurité » and a claim about people |


**Erratum (G1 fix, 2026-11-12):** the code in `src/design/packages.ts` uses `FramingPose` (a plain `{ alpha, beta, radius, target: [x, y, z] }`, no Babylon import) where section 7.1 says `CameraPose`, and a `StepId` type (the ten step ids of 6.3 plus `debrancher` and `rebrancher` of 7.2) for `Pacing.steps`.
