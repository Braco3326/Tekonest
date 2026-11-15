/**
 * The first visit and what follows (onboarding packs, plan T2.3 to T2.5, spec 4): the start screen under `?design`, the profile applied to the
 * first room, the profile chip, Aide « Premiers pas », the framing. A LAZY chunk: boot.ts imports it only when the onboarding is on (a valid `?design`, practice mode), so
 * the plain game never loads it. The checklist's wiring stays in `wire.ts`.
 * Mission 1 (spec 1.2 and 1.3): with `goals` (the feature switch, on a package whose first question is the goals) the start screen asks the goal screens instead of
 * the profiles, the chip says « But : X · changer » (or « Choisir un but »), and the place picker shows only the rooms of the stored goal (`setRoomFilter`). A goal
 * answered where no offer was made (the tutorial is not on this address) is written at once and the picker shows the goal's rooms to choose from; once the offer
 * was answered (« Faire le tutoriel » or « Passer, je connais ») the first room opens first, as with a profile, and the goal's rooms are there the next time the picker opens.
 * Mission 1 (spec 4): with `plainTutorial` (boot.ts: the switch on, the guide off on this address, a package that asks the goals) the tutorial is the PLAIN one: the start screen
 * offers it after the goal screens, Aide has « Premiers pas », and its coach card (plainTutorialCard.ts) follows the bench through the facts the page already reads (plainTutorial.ts).
 * Decision (part A's open question): once the offer is answered the learner lands in the first room (the empty neutral room), with the card if the tutorial was taken; the
 * goal's filtered picker stays reachable from the menu (Lieu) and the chip changes the goal. Nothing here uses or loads the guide.
 */
import { COPY } from '../copy'
import type { InventoryTab } from '../inventory'
import type { PlacePicker } from '../shell/placePicker'
import { mountProfileChip } from './profileChip'
import { mountOwnGearCard } from './ownGearCard'
import { ownGearDue } from './ownGear'
import { panelsFor, profileById } from './profiles'
import { tutorialInProgress } from '../../design/tutorialRecord'
import { chipGoal, chipProfile, createOnboardingStore, entryStage, type OnboardingRecord, type OnboardingStore, type ProfileId, type RequestKind, type StorageLike } from './state'
import { findGoal, loadGoalTree, roomsForGoal, type GoalTree } from './goalTree'
import { nextStep, PLAIN_STEPS, plainProgress, restartPlain, settle, skipPlain, type PlainFacts, type PlainState, type PlainStepId } from './plainTutorial'
import { mountPlainTutorialCard, type PlainCard } from './plainTutorialCard'
import { PLAIN_STEP_COUNT } from './state'

/** What the page hands the plain tutorial (boot.ts). */
export interface PlainTutorialWiring {
  /** The four facts of the bench now (plainTutorial.ts `benchFacts` over the live design); `sounded` = a sound started in this session. */
  facts(sounded: boolean): PlainFacts
  /** Catalog labels the instructions name: the console that plays a test sound, an example speaker. */
  labels: { console: string; enceinte: string }
  /** The tutorial is over (its four steps done, or « Passer le tutoriel »): the account card may follow (spec 5). */
  onOver?(): void
  /** The card (tests pass a fake). */
  mountCard?: typeof mountPlainTutorialCard
}

export interface OnboardingWiring {
  /**
   * The onboarding is on: a valid `?design=1..5` (the boot read it with `applyDesignAttribute`) and not an exam address (a non-practice `?mode=` leaves the
   * onboarding entirely off). Without it nothing here exists: no store, no chip, no key read or written, no start screen, framing, panel or drawer change.
   */
  design: boolean
  storage: StorageLike | null
  /** Steps of the active package's tutorial (the offer says how many). */
  stepCount: number
  /** The guide may run on this address (main.ts: no `?oscar=0`). False = no offer on the start screen, no Aide « Premiers pas »; a profile choice is final. */
  tutorialAllowed: boolean
  /** The active package's `layout.panels`: what a profile that leaves the panels to the package opens the first room with. */
  panels: { tree: boolean; props: boolean }
  doc: Document
  /** The package's first room is the playable model (`layout.start`), not the empty neutral room: Aide « Premiers pas » over an open place then asks to open it first. */
  startsOnModel?: boolean
  /** The status line (the shell's announcer): what was NOT done and why. */
  announce?(message: string): void
  /**
   * The address is a practice one NOW: read live, not once at boot, because the page can be pushed to an exam address while it runs (history.pushState). Built in main.ts from
   * the guide's own mode gate (creation must not import the guide). Absent = true (a unit with no address). The entrepreneur's card is due only while it says true.
   */
  practiceNow?(): boolean
  /** The place picker's `covers` array and whether it is open: the card's slot is inert under the picker. */
  pickerCovers?: HTMLElement[]
  pickerOpen?(): boolean
  /** The shell root: the entrepreneur's card (T6.4) takes a reserved row of its grid. Absent = no card (a unit test with no DOM). */
  shellRoot?: HTMLElement
  /** The status bar's checklist slot: the profile chip goes before it. */
  chipSlot: HTMLElement
  picker: Pick<PlacePicker, 'showStart' | 'hide' | 'show' | 'startShowing'> & Partial<Pick<PlacePicker, 'setRoomFilter'>>
  /** The goal screens replace the profiles (mission 1: the feature switch `goals`, on a package whose `layout.firstQuestion` is `goals`). Absent = false. */
  goals?: boolean
  /** The goal tree (tests); absent = the bundled one (`loadGoalTree`). A tree that does not load leaves the profiles. */
  goalTree?: GoalTree | null
  /**
   * The plain tutorial « Premiers pas » (mission 1, spec 4) runs on this address instead of the guide's (boot.ts gives it only where `tutorialAllowed` is false). With it the offer,
   * Aide « Premiers pas » and the tutorial row exist as they do for the guide's tutorial, and the offer counts its four steps. Absent = none.
   */
  plainTutorial?: PlainTutorialWiring
  /** A place is open (the design has a room). */
  placeOpen(): boolean
  /**
   * Open the package's first room through the picker's own choice path, no dialog: the neutral room (the `blank` card, « Salle vide ») or, for a package whose `layout.start` is
   * `playable-model`, the template `premier-son-pret` (T6.3, `startRoomKey`). Resolves when that is over: true if that room is now open (`done`), false if it was not (declined, busy, failed).
   */
  openFirstRoom(): Promise<boolean>
  /** The camera goes to the active package's `framing` (first-sound framing, T2.5); `tutorialRow`: a tutorial is about to open its row (the step card's slot, `TUTORIAL_ROW_PX`), so the framing is for the canvas MINUS that row (T6.1: the same pixels once the row is there). Called only right after the first room (the neutral room or the playable model) was opened by the start screen or by Aide « Premiers pas »; never over a room that was already open. */
  frameFirstRoom(opts?: { tutorialRow?: boolean }): void
  setPanel(p: 'tree' | 'props', open: boolean): void
  /** The inventory drawer opens on this tab; the focus stays where it is (the 3D view). */
  openInventory(tab: InventoryTab): void
  /** The page takes the focus back (the 3D view): the picker that held it just closed. */
  returnFocus(): void
}

/** What `window.__creation.onboarding()` reports (tests): the stored record and the address's switches. */
export interface OnboardingDebug {
  design: boolean
  tutorialAllowed: boolean
  /** The record in memory (what storage holds, unless it is blocked), or null. */
  record: OnboardingRecord | null
  /** Storage could not be read or written: the record lives in memory for this page. */
  blocked: boolean
  /** Aide « Premiers pas » is offered. */
  premiersPas: boolean
  /** The text of the profile chip (« Choisir un profil » while none is stored), or null without the onboarding. */
  chip: string | null
  /** The plain tutorial (mission 1) is the tutorial of this address. */
  plainTutorial?: boolean
  /** What the last request asked for (plan T3.2: the guide acts on it once): start (or resume a run), restart, skip. Stored with the request. */
  requestKind?: TutorialAsk
  /**
   * The request counter when this page loaded. A guide whose own record is missing or corrupt cannot tell a handled request from a new one;
   * it then acts only on a request raised on this page (above this value), never on an old one by itself.
   */
  requestAtLoad?: number
}

/** What an Aide request asks the guide: « Premiers pas » / « Reprendre » (start; a running tutorial is resumed), « Recommencer », « Passer le tutoriel ». */
export type TutorialAsk = RequestKind

export interface Onboarding {
  /** The record's store, or null without `?design`. */
  readonly store: OnboardingStore | null
  /**
   * A sound started in this session (Écoute began to play: the first `playStarted`, T6.4): the entrepreneur's card is due from then on, for a profile whose `afterFirstSound` says so
   * and until the learner dismissed it (ownGear.ts). Idempotent; a no-op without the onboarding.
   */
  soundStarted(): void
  /** The inputs of the entrepreneur's card may have changed (the bench changed: a live switch of the address shows here): evaluate it again. A no-op without the onboarding. */
  refresh(): void
  /** Aide « Premiers pas » exists on this address (`?design` and `tutorialAllowed`). */
  readonly premiersPas: boolean
  /**
   * Called once, after `restore()` returned false (nothing was reopened). Returns whether the start screen is showing; when it is not, the caller shows the
   * picker as it always did.
   */
  startFirstVisit(): boolean
  /**
   * Aide « Premiers pas »: with no place open the neutral room opens first, then the request goes up (the guide starts the tutorial when `request` passes its
   * own `handledRequest`, T3.2). Idempotent while it runs. A room that did not open raises nothing. No-op where `premiersPas` is false.
   */
  requestTutorial(kind?: TutorialAsk): Promise<void>
  /**
   * The guide's running tutorial (its record `oscar-guide.onboarding.v1`, read from storage, src/design/tutorialRecord.ts): the step to resume at, or null (none
   * running, storage blocked, or the tutorial not allowed here). Aide then offers « Reprendre à l’étape {k} », « Recommencer le tutoriel », « Passer le tutoriel ».
   */
  progress(): { k: number; n: number } | null
  /** Why Aide « Premiers pas » must wait (the start stage is showing: it would open a room with no profile), or undefined. */
  waiting(): string | undefined
  snapshot(): OnboardingDebug
}

const chipText = (id: ProfileId | null): string =>
  id === null ? COPY.onboarding!.chipChoose! : COPY.onboarding!.chip!.replace('{profile}', COPY.onboarding![profileById(id).labelKey]!)

/** The goal chip's text: the stored goal's label (from the tree), or « Choisir un but » with none, or one the tree does not know. */
const goalChipText = (tree: GoalTree, record: OnboardingRecord | null): string => {
  const g = chipGoal({ design: true, record })
  const node = g ? findGoal(tree, g.id) : null
  return node ? COPY.onboarding!.goalChip!.replace('{goal}', node.label) : COPY.onboarding!.goalChipChoose!
}

/**
 * The first visit and what follows (plan T2.3 to T2.4b, spec 4): the start screen when it is due, the profile applied to the first room (the
 * neutral room through the picker's own path, the frame, the profile's panels, the drawer on its tab), the profile chip, and Aide « Premiers pas ». boot.ts makes
 * the calls; this owns the rest. It touches no storage without the onboarding.
 *
 * The record is written WITH the answer (profile and offer together) and only once the room is open: leaving mid-way, or a room that did not open, writes
 * nothing, so the `tutorial` request never goes up with no room to start it in.
 */
export function wireOnboarding(w: OnboardingWiring, mountChip: typeof mountProfileChip = mountProfileChip, mountGear: typeof mountOwnGearCard = mountOwnGearCard): Onboarding {
  const store = w.design ? createOnboardingStore(w.storage) : null
  const plainW = store ? (w.plainTutorial ?? null) : null
  /** A tutorial may be offered here: the guide's (`tutorialAllowed`) or the plain one. */
  const tutorialOn = w.tutorialAllowed || plainW !== null
  const stepCount = plainW ? PLAIN_STEP_COUNT : w.stepCount
  /** The goal tree when the goal screens are asked here; null = the four profiles. */
  const tree: GoalTree | null = store && w.goals === true ? (w.goalTree !== undefined ? w.goalTree : loadGoalTree()) : null
  const label = (record: OnboardingRecord | null): string => (tree ? goalChipText(tree, record) : chipText(chipProfile({ design: true, record })))
  const chip = store
    ? mountChip({
        doc: w.doc,
        slot: w.chipSlot,
        label: () => label(store.read()),
        hint: COPY.onboarding!.chipHint!,
        onClick: () => {
          if (!w.picker.startShowing) openStart({ mode: 'chip' }) // the start stage already showing is what the chip would open
        },
      })
    : null
  chip?.render()

  // The entrepreneur's card (T6.4): due once a sound started, for the profile whose data says so, until dismissed. Evaluated again whenever one of its inputs changes.
  let sounded = false
  const gear =
    store && w.shellRoot
      ? mountGear({
          doc: w.doc,
          root: w.shellRoot,
          ...(w.pickerCovers ? { covers: w.pickerCovers } : {}),
          ...(w.pickerOpen ? { covered: w.pickerOpen } : {}),
          onDismiss: () => {
            store.dispatch({ type: 'ownGear', value: 'dismissed' })
            refreshGear()
            w.returnFocus() // the focused button just left the page
          },
        })
      : null
  function refreshGear(): void {
    if (!gear || !store) return
    const record = store.read()
    if (ownGearDue({ onboarding: w.practiceNow?.() ?? true, profile: record?.profile ?? null, soundStarted: sounded, dismissed: record?.ownGear === 'dismissed' })) gear.show()
    else gear.hide()
  }

  // ── The plain tutorial (mission 1, spec 4): the record holds where it is; the card follows the bench on every change of the store and on the first sound.
  const PT = (): Readonly<Record<string, string>> => COPY.plainTutorial!
  const fill = (t: string): string => (plainW ? t.replace('{console}', plainW.labels.console).replace('{enceinte}', plainW.labels.enceinte) : t)
  const stepText = (id: PlainStepId): { text: string; hint: string } => ({ text: fill(PT()[id]!), hint: fill(PT()[`${id}Hint`]!) })
  /** The closing card is showing (the four steps done, until « Fermer »). */
  let closing = false
  /** The step last announced, so a redraw on an unrelated change of the bench says nothing. */
  let saidStep: number | null = null
  const plainFacts = (): PlainFacts => plainW!.facts(sounded)
  const plainState = (): PlainState | null => store?.read()?.plainTutorial ?? null
  const writePlain = (s: PlainState): void => void store?.dispatch({ type: 'plainTutorial', step: s.step, done: s.done })
  /** « Passer le tutoriel » (the card or Aide): over where it is; the card leaves, the focus goes back to the page. */
  function plainSkip(): void {
    plainCard?.hide()
    const s = plainState()
    closing = false
    if (s && !s.done) {
      writePlain(skipPlain(s))
      w.announce?.(PT().announceSkipped!)
      plainW?.onOver?.()
    }
    w.returnFocus()
  }
  const plainCard: PlainCard | null = plainW
    ? (plainW.mountCard ?? mountPlainTutorialCard)({
        doc: w.doc,
        ...(w.pickerCovers ? { covers: w.pickerCovers } : {}),
        ...(w.pickerOpen ? { covered: w.pickerOpen } : {}),
        onNext: () => plainMove((s) => nextStep(s, plainFacts())),
        onSkip: plainSkip,
        onClose: () => {
          closing = false
          plainCard?.hide()
          w.returnFocus()
        },
      })
    : null
  /** Draws the card for the state (and says a new step); hides it where it may not show (no place open, the address is no longer a practice one). */
  function drawPlain(s: PlainState | null): void {
    if (!plainCard) return
    if (!w.placeOpen() || !(w.practiceNow?.() ?? true)) return plainCard.hide()
    if (closing) {
      const said = saidStep === 0
      saidStep = 0 // the end is said once
      return plainCard.show({ kind: 'done', ...(said ? {} : { say: PT().announceDone! }) })
    }
    if (!s || s.done) return plainCard.hide()
    const t = stepText(PLAIN_STEPS[s.step - 1])
    const fresh = saidStep !== s.step
    saidStep = s.step
    plainCard.show({ kind: 'step', k: s.step, n: PLAIN_STEP_COUNT, ...t, ...(fresh ? { say: PT().announceStep!.replace('{k}', String(s.step)).replace('{n}', String(PLAIN_STEP_COUNT)).replace('{text}', t.text) } : {}) })
  }
  /** The tutorial just ended on its last step: the closing card, said once. */
  function plainEnded(): void {
    closing = true
    saidStep = null
    plainW?.onOver?.()
  }
  /** Applies a move to a running tutorial, writes it, and draws. */
  function plainMove(move: (s: PlainState) => PlainState): void {
    const s = plainState()
    if (!plainW || !s || s.done) return drawPlain(s)
    const next = move(s)
    if (next.step !== s.step || next.done !== s.done) writePlain(next)
    if (next.done) plainEnded()
    drawPlain(next)
  }
  /** The bench changed, or a sound started: the steps that are now true complete. */
  const plainSync = (): void => {
    if (plainW) plainMove((s) => settle(s, plainFacts()))
  }
  /** « Faire le tutoriel », Aide « Premiers pas » or « Recommencer »: step 1, then whatever the bench already has. */
  function plainBegin(): void {
    if (!plainW) return
    closing = false
    saidStep = null
    const s = restartPlain(plainFacts())
    writePlain(s)
    if (s.done) plainEnded()
    drawPlain(s)
  }

  /** The picker shows the rooms of the stored goal (the node's, else its parent's, else none: the empty state); no filter without a known goal. */
  const applyFilter = (): void => {
    if (!tree || !store) return
    const g = store.read()?.goal ?? null
    const node = g ? findGoal(tree, g.id) : null
    w.picker.setRoomFilter?.(g && node ? { rooms: roomsForGoal(tree, g), label: node.label, changeGoal: () => openStart({ mode: 'chip' }) } : null)
  }

  /** A first-room profile: panels, then the drawer tab. No profile (« Passer » on the goal screens): nothing changes. */
  const applyProfile = (id: ProfileId | null): void => {
    if (id === null) return
    const preset = profileById(id)
    const p = panelsFor(preset, w.panels)
    w.setPanel('tree', p.tree)
    w.setPanel('props', p.props)
    w.openInventory(preset.inventoryTab)
  }

  /** Each opening of the start stage is answered once: a second click on the same button (or Enter then click) while the room opens does nothing. */
  let answered = false
  const openStart = (o: { mode: 'first' | 'chip'; offerFor?: ProfileId }): void => {
    if (!store) return
    answered = false
    w.picker.showStart({
      closable: w.placeOpen(), // reopened over a project (the chip): its grids can be closed back to it
      stepCount,
      offerAllowed: tutorialOn,
      offerFor: o.offerFor,
      offerEscape: o.mode === 'chip' ? 'leave' : 'skip',
      ...(tree ? { goals: tree, ...(o.offerFor ? { offerGoal: store.read()?.goal ?? null } : {}) } : {}),
      onResult: (r) => {
        if (answered) return
        if (r.kind === 'all-places') return // nothing answered, nothing written: the next normal visit asks again
        answered = true
        if (r.kind === 'leave') {
          // reopened by the chip, left on the offer: no change at all
          if (w.placeOpen()) {
            w.picker.hide()
            w.returnFocus()
          } else w.picker.show({ closable: false, focus: true })
          return
        }
        if (tree && r.offer === null) {
          // the goal screens with no offer made: the goal is written now and the picker shows its rooms to choose from (closable back to a place that is open)
          store.dispatch({ type: 'answer', profile: r.profile, offer: r.offer, goal: r.goal ?? null })
          chip?.render()
          refreshGear()
          applyFilter()
          if (w.placeOpen()) applyProfile(r.profile)
          w.picker.show({ closable: w.placeOpen(), focus: true })
          return
        }
        void (async () => {
          if (w.placeOpen()) {
            // « changer » over a project: the room is the learner's, it is not replaced; only the profile is applied
            w.picker.hide()
            w.returnFocus()
          } else {
            await w.openFirstRoom()
            if (!w.placeOpen()) {
              answered = false // busy, cancelled or failed: the picker has the error or still shows the screen; nothing was written, the next answer is taken
              return
            }
            w.frameFirstRoom({ tutorialRow: r.offer === 'taken' && tutorialOn })
          }
          store.dispatch({ type: 'answer', profile: r.profile, offer: r.offer, ...(tree ? { goal: r.goal ?? null } : {}) })
          chip?.render()
          applyFilter()
          refreshGear() // a profile chosen after a sound (the chip) may be the entrepreneur's; one chosen instead of it takes the card away
          applyProfile(r.profile)
          if (r.offer === 'taken') plainBegin() // the plain tutorial starts in the room that is now open (the guide's acts on the request instead)
        })()
      },
    })
  }

  applyFilter() // a goal stored on an earlier visit: the picker shows its rooms from the start

  let asking: Promise<void> | null = null
  /** Aide for the plain tutorial: « Premiers pas » / « Reprendre » (a run resumes where it is and its card takes the focus; otherwise it starts again), « Recommencer », « Passer ». */
  function plainRequest(kind: TutorialAsk): Promise<void> {
    if (kind === 'skip') {
      plainSkip()
      return Promise.resolve()
    }
    asking = (async () => {
      if (!w.placeOpen()) {
        await w.openFirstRoom()
        if (!w.placeOpen()) return
        w.frameFirstRoom({ tutorialRow: true }) // « Premiers pas »: the tutorial follows
      }
      const s = plainState()
      if (kind === 'start' && s && !s.done) {
        saidStep = null
        plainSync()
        plainCard?.focus() // « Reprendre à l’étape {k} »: the learner lands on the card
      } else plainBegin()
    })().finally(() => {
      asking = null
    })
    return asking
  }
  const requestAtLoad = store?.read()?.request ?? 0
  const premiersPas = store !== null && tutorialOn
  const waiting = (): string | undefined => (premiersPas && w.picker.startShowing ? COPY.menu!.firstStepsWait : undefined)
  return {
    store,
    soundStarted() {
      sounded = true
      refreshGear()
      plainSync()
    },
    refresh() {
      refreshGear()
      plainSync()
    },
    premiersPas,
    startFirstVisit() {
      if (!store) return false
      const record = store.read()
      const stage = entryStage({ design: true, tutorialAllowed: tutorialOn, restored: false, record })
      if (stage === 'start') openStart({ mode: 'first' })
      else if (stage === 'offer' && record?.profile) openStart({ mode: 'first', offerFor: record.profile })
      else return false
      return true
    },
    requestTutorial(kind = 'start') {
      if (!store || !premiersPas || waiting()) return Promise.resolve()
      if (asking) return asking
      if (plainW) return plainRequest(kind)
      if (kind !== 'start') {
        // restart and skip act on the running tutorial: its room is open, nothing to open
        store.dispatch({ type: 'request', kind })
        return Promise.resolve()
      }
      // « Reprendre à l’étape {k} » (T6.1): the run's own step card takes the focus, so the learner lands on the progress and its « Passer le tutoriel », not on the page.
      // The card is the guide's; this only asks the page for it by test id (creation never imports the guide), and does nothing where there is none.
      const resuming = tutorialInProgress(w.storage) !== null
      // Cleared by `finally` on the promise itself: an async body with no await would run its own cleanup before `asking` is assigned.
      asking = (async () => {
        if (!w.placeOpen()) {
          await w.openFirstRoom()
          if (!w.placeOpen()) return
          w.frameFirstRoom({ tutorialRow: true }) // « Premiers pas »: the tutorial follows
        } else if (w.startsOnModel === true && !resuming) {
          // The three steps (sound, unplug, replug) are about the playable model's bench; on another bench `ecoute` cannot complete and `debrancher` has no cable. The model opens through
          // the picker's own template path, which asks first (the existing « Remplacer le matériel » dialog) when gear is on the bench: never replaced without the learner's yes. Declined: no run, said.
          const opened = await w.openFirstRoom()
          if (!opened) {
            w.announce?.(COPY.onboarding!.modelDeclined!)
            return
          }
          w.frameFirstRoom({ tutorialRow: true })
        }
        store.dispatch({ type: 'request', kind: 'start' })
        if (resuming) w.doc.querySelector<HTMLElement>('[data-testid="tutorial-card"]')?.focus()
      })().finally(() => {
        asking = null
      })
      return asking
    },
    waiting,
    progress: () => (!premiersPas ? null : plainW ? plainProgress(plainState() ?? undefined) : tutorialInProgress(w.storage)),
    snapshot() {
      const record = store ? store.read() : null
      return {
        design: store !== null,
        tutorialAllowed: w.tutorialAllowed,
        record,
        blocked: store?.blocked ?? false,
        premiersPas,
        ...(plainW ? { plainTutorial: true } : {}),
        chip: store ? label(record) : null,
        requestKind: record?.kind ?? 'start',
        requestAtLoad,
      }
    },
  }
}
