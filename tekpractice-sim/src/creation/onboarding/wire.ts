/**
 * The wiring of the onboarding layers that live in Mode Création (plan: boot.ts gets one call per layer, the rest stays in small modules).
 * T1.3b: the checklist « Pourquoi je n’entends rien ? ». It is a layer, not a package feature: it needs no guide (works with `?oscar=0`) and does not read
 * `?design`, so it is the same in every package and profile.
 * T2.3 to T2.4b: the first visit (`wireOnboarding`, below): the start screen under `?design`, the profile applied to the first room, the profile chip and
 * Aide « Premiers pas ». It touches no storage without `?design`.
 */
import { checklistView, type GoTo } from '../checklistModel'
import { COPY } from '../copy'
import type { InventoryTab } from '../inventory'
import { mountChecklist, type Checklist } from '../shell/checklist'
import type { PlacePicker } from '../shell/placePicker'
import { mountProfileChip } from './profileChip'
import { panelsFor, profileById } from './profiles'
import { chipProfile, createOnboardingStore, entryStage, type OnboardingRecord, type OnboardingStore, type ProfileId, type StorageLike } from './state'
import type { PathResult } from '../../flow/signalPath'

export interface ChecklistWiring {
  doc: Document
  /** The status bar's slot for the chip (statusBar.ts `checklistSlot`). */
  slot: HTMLElement
  /** The shell root the list is appended to while open. */
  root: HTMLElement
  /**
   * The signal path of the live design, read AT RENDER TIME (never cached here). The owner computes it from the store on each call, so the order of the store's
   * subscribers cannot leave the list one change behind (tests/creation/wire.test.ts).
   */
  path(): Pick<PathResult, 'playbackReady' | 'reasons' | 'micReasons'>
  /** A place is open (the design has a room). */
  placeOpen(): boolean
  /** The store's `subscribe`: the list follows every change of the design. */
  subscribe(fn: () => void): unknown
  /** « Yamaha QL1 (ql1) ». */
  deviceLabel(instance: string): string
  /** « Aller à » a device: selects it (the camera follows); never edits the design. */
  select(instance: string): void
  /** « Aller à » the inventory: opens the drawer on this tab. */
  openInventory(tab: 'consoles'): void
  /** The page takes the focus back (the 3D view). */
  returnFocus(): void
}

export function wireChecklist(w: ChecklistWiring, mount: typeof mountChecklist = mountChecklist): Checklist {
  const goTo = (t: GoTo): void => (t.kind === 'select' ? w.select(t.instance) : w.openInventory(t.tab))
  const list = mount({
    doc: w.doc,
    slot: w.slot,
    root: w.root,
    view: () => checklistView(w.path(), { placeOpen: w.placeOpen() }),
    deviceLabel: w.deviceLabel,
    goTo,
    returnFocus: w.returnFocus,
  })
  w.subscribe(() => list.render())
  list.render()
  return list
}


export interface OnboardingWiring {
  /** A valid `?design=1..5` is on the address (the boot read it with `applyDesignAttribute`). Without it nothing here exists: no store, no chip, no key read or written. */
  design: boolean
  storage: StorageLike | null
  /** Steps of the active package's tutorial (the offer says how many). */
  stepCount: number
  /** The guide may run on this address (main.ts: no `?oscar=0`, no exam address). False = no offer on the start screen, no Aide « Premiers pas »; a profile choice is final. */
  tutorialAllowed: boolean
  /** The active package's `layout.panels`: what a profile that leaves the panels to the package opens the first room with. */
  panels: { tree: boolean; props: boolean }
  doc: Document
  /** The status bar's checklist slot: the profile chip goes before it. */
  chipSlot: HTMLElement
  picker: Pick<PlacePicker, 'showStart' | 'hide'>
  /** A place is open (the design has a room). */
  placeOpen(): boolean
  /** Open the neutral room through the picker's own choice path (the `blank` card, « Salle vide », no dialog). Resolves when that is over, whatever the result. */
  openNeutralRoom(): Promise<void>
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
  /** The text of the profile chip, or null while it is hidden. */
  chip: string | null
}

export interface Onboarding {
  /** The record's store, or null without `?design`. */
  readonly store: OnboardingStore | null
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
  requestTutorial(): Promise<void>
  snapshot(): OnboardingDebug
}

const CHIP_TEXT = (id: ProfileId): string => COPY.onboarding!.chip!.replace('{profile}', COPY.onboarding![profileById(id).labelKey]!)

/**
 * The first visit and what follows (plan T2.3 to T2.4b, spec 4): the start screen when it is due, the profile applied to the first room (the neutral room
 * through the picker's own path, the profile's panels, the drawer on its tab), the profile chip, and Aide « Premiers pas ». boot.ts makes one call; this owns
 * the rest. It touches no storage without `?design`.
 */
export function wireOnboarding(w: OnboardingWiring, mountChip: typeof mountProfileChip = mountProfileChip): Onboarding {
  const store = w.design ? createOnboardingStore(w.storage) : null
  const chip = store
    ? mountChip({
        doc: w.doc,
        slot: w.chipSlot,
        label: () => {
          const id = chipProfile({ design: true, record: store.read() })
          return id === null ? null : CHIP_TEXT(id)
        },
        hint: COPY.onboarding!.chipHint!,
        onClick: () => openStart(),
      })
    : null
  chip?.render()

  /** A first-room profile: panels, then the drawer tab. */
  const applyProfile = (id: ProfileId): void => {
    const preset = profileById(id)
    const p = panelsFor(preset, w.panels)
    w.setPanel('tree', p.tree)
    w.setPanel('props', p.props)
    w.openInventory(preset.inventoryTab)
  }

  /** Each opening of the start stage is answered once: a second click on the same button (or Enter then click) while the room opens does nothing. */
  let answered = false
  const openStart = (): void => {
    if (!store) return
    answered = false
    w.picker.showStart({
      closable: w.placeOpen(), // reopened over a project (the chip): its grids can be closed back to it
      stepCount: w.stepCount,
      offerAllowed: w.tutorialAllowed,
      onProfile: (id) => {
        store.dispatch({ type: 'profile', id })
        chip?.render()
      },
      onResult: (r) => {
        if (answered) return
        answered = true
        if (r.kind === 'all-places') {
          store.dispatch({ type: 'all-places' })
          return
        }
        if (r.offer === 'taken') store.dispatch({ type: 'tutorial' })
        else if (r.offer === 'skipped') store.dispatch({ type: 'skip' })
        void (async () => {
          if (w.placeOpen()) {
            // « changer » over a project: the room is the learner's, it is not replaced; only the profile is applied
            w.picker.hide()
            w.returnFocus()
          } else {
            await w.openNeutralRoom()
            if (!w.placeOpen()) return // the picker shows why
          }
          applyProfile(r.profile)
        })()
      },
    })
  }

  let asking: Promise<void> | null = null
  const premiersPas = store !== null && w.tutorialAllowed
  return {
    store,
    premiersPas,
    startFirstVisit() {
      if (!store) return false
      if (entryStage({ design: true, restored: false, record: store.read() }) !== 'start') return false
      openStart()
      return true
    },
    requestTutorial() {
      if (!store || !premiersPas) return Promise.resolve()
      if (asking) return asking
      // Cleared by `finally` on the promise itself: an async body with no await would run its own cleanup before `asking` is assigned.
      asking = (async () => {
        if (!w.placeOpen()) {
          await w.openNeutralRoom()
          if (!w.placeOpen()) return
        }
        store.dispatch({ type: 'request' })
      })().finally(() => {
        asking = null
      })
      return asking
    },
    snapshot() {
      const record = store ? store.read() : null
      const id = chipProfile({ design: store !== null, record })
      return { design: store !== null, tutorialAllowed: w.tutorialAllowed, record, blocked: store?.blocked ?? false, premiersPas, chip: id === null ? null : CHIP_TEXT(id) }
    },
  }
}
