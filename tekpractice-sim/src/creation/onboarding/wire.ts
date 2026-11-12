/**
 * The wiring of the onboarding layers that live in Mode Création (plan: boot.ts gets one call per layer, the rest stays in small modules).
 * T1.3b: the checklist « Pourquoi je n’entends rien ? ». It is a layer, not a package feature: it needs no guide (works with `?oscar=0`) and does not read
 * `?design`, so it is the same in every package and profile.
 * The first visit (start screen, profile, chip, Aide « Premiers pas ») lives in `firstVisit.ts`: it loads lazily, under `?design` only (plan: new boot code stays lazy).
 */
import { checklistView, type GoTo } from '../checklistModel'
import { mountChecklist, type Checklist } from '../shell/checklist'
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
