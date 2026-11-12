/**
 * The wiring of the onboarding layers that live in Mode Création (plan: boot.ts gets one call per layer, the rest stays in small modules).
 * T1.3b: the checklist « Pourquoi je n’entends rien ? ». It is a layer, not a package feature: it needs no guide (works with `?oscar=0`) and does not read
 * `?design`, so it is the same in every package and profile.
 * T2.3: the first visit. `startFirstVisit` shows the start screen (a stage of the place picker) under `?design` when no autosave was restored and no
 * onboarding record exists, and records what the learner answers. It touches no storage without `?design`.
 */
import { checklistView, type GoTo } from '../checklistModel'
import { mountChecklist, type Checklist } from '../shell/checklist'
import type { PlacePicker } from '../shell/placePicker'
import { createOnboardingStore, entryStage, type OnboardingStore, type StorageLike } from './state'
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

export interface FirstVisitWiring {
  /** A valid `?design=1..5` is on the address (the boot read it with `applyDesignAttribute`). */
  design: boolean
  storage: StorageLike | null
  /** Steps of the active package's tutorial (the offer says how many). */
  stepCount: number
  /** The guide can run on this address (T2.4b computes it in main.ts; until then the offer is always made under `?design`). */
  offerAllowed: boolean
  picker: Pick<PlacePicker, 'showStart'>
  /** Open the neutral room through the picker's own choice path (« Salle vide », no dialog). */
  openNeutralRoom(): void
}

/**
 * Called once, after `restore()` returned false (nothing was reopened). Returns whether the start screen is showing; when it is not, the caller shows the
 * picker as it always did. `store` is the onboarding record's store, or null without `?design` (no key is read or written then).
 */
export function startFirstVisit(w: FirstVisitWiring): { shown: boolean; store: OnboardingStore | null } {
  if (!w.design) return { shown: false, store: null }
  const store = createOnboardingStore(w.storage)
  if (entryStage({ design: true, restored: false, record: store.read() }) !== 'start') return { shown: false, store }
  w.picker.showStart({
    stepCount: w.stepCount,
    offerAllowed: w.offerAllowed,
    onProfile: (id) => void store.dispatch({ type: 'profile', id }),
    onResult: (r) => {
      if (r.kind === 'all-places') return void store.dispatch({ type: 'all-places' })
      if (r.offer === 'taken') store.dispatch({ type: 'tutorial' })
      else if (r.offer === 'skipped') store.dispatch({ type: 'skip' })
      w.openNeutralRoom()
    },
  })
  return { shown: true, store }
}
