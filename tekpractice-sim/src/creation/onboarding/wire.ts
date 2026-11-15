/**
 * The wiring of the onboarding layers that live in Mode Création (plan: boot.ts gets one call per layer, the rest stays in small modules).
 * T1.3b: the checklist « Pourquoi je n’entends rien ? ». It is a layer, not a package feature: it needs no guide (works with `?oscar=0`) and does not read
 * `?design`, so it is the same in every package and profile.
 * T3.3: the power helper « Je branche pour vous (dans le simulateur) » on its « Alimentation » row, only when the owner hands `helper` (boot: a valid `?design`
 * on a practice address; never on an exam address, never without `?design`). Its code is a lazy chunk. The tutorial gate comes from the guide's event
 * `tekpractice:tutorial` `{ step, helperUnlocked }` (and, until the first event, the guide's record): during a run the button is disabled with its reason until
 * the guide unlocks it. With `?oscar=0` there is no run (`tutorialAllowed` false): the gate is never read and the button follows the bench alone.
 * The guide learns whether the helper is offered and how often it was used on this page through two readers of the debug hook
 * (`helperOffered()`, `helperUses()`, src/design/powerHelperUse.ts), never through storage.
 * The first visit (start screen, profile, chip, Aide « Premiers pas ») lives in `firstVisit.ts`: it loads lazily, under `?design` only (plan: new boot code stays lazy).
 */
import { checklistView, type GoTo } from '../checklistModel'
import { COPY } from '../copy'
import { fillUndo } from '../undoWording'
import { mountChecklist, type Checklist, type HelperView } from '../shell/checklist'
import type { PathResult } from '../../flow/signalPath'
import type { Registry } from '../../engine/CatalogLoader'
import type { HelperStore, TutorialGate } from '../powerHelper'
import type { History } from '../history'
import { TUTORIAL_EVENT } from '../../design/events'
import { lookOfRoot } from '../../design/packages'
import { tutorialGateOf } from '../../design/tutorialRecord'
import type { PowerHelperUses } from '../../design/powerHelperUse'

type PowerHelperModule = typeof import('../powerHelper')

export interface HelperWiring {
  store: HelperStore
  history: Pick<History, 'doAll' | 'settle' | 'inTransaction'>
  registry: Registry
  /** The status line (the shell's announcer): what the helper added, or that nothing changed. */
  announce(message: string): void
  /** The guide's tutorial may run here (not `?oscar=0`): only then is the tutorial gate read. */
  tutorialAllowed: boolean
  /** The page's storage (the guide's record, read for the gate until the guide's first event), or null when blocked. */
  storage(): Storage | null
  /** The app's undo key label (boot.ts `undoLabel`, « Ctrl+Z » by default) for the status line after the helper. */
  undoLabel?(): string
  /** The helper's code (default: the lazy chunk). */
  load?(): Promise<PowerHelperModule>
}

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
  /** The power helper (T3.3), only under `?design` on a practice address. */
  helper?: HelperWiring
  /**
   * Where the PANEL form docks the list (T6.2): given, the list is docked there; null, the chip form. Absent = read from the page: a package whose `layout.checklist` is `panel` (a valid
   * `?design` on a practice address) docks it at the foot of the Projet panel; anything else (no `?design`, an exam address, the other packages) keeps the chip.
   */
  dock?: HTMLElement | null
}

/** The gate as the guide's event says it, or null for a detail that is not one. */
function gateOfDetail(detail: unknown): TutorialGate | null {
  if (detail === null || typeof detail !== 'object') return null
  const d = detail as { step?: unknown; helperUnlocked?: unknown }
  const e = detail as { hasPowerSteps?: unknown; powerAhead?: unknown }
  if (d.step !== null && typeof d.step !== 'string') return null
  return {
    step: d.step,
    helperUnlocked: d.helperUnlocked === true,
    ...(typeof e.hasPowerSteps === 'boolean' ? { hasPowerSteps: e.hasPowerSteps } : {}),
    ...(typeof e.powerAhead === 'boolean' ? { powerAhead: e.powerAhead } : {}),
  }
}

/**
 * The helper's part of the list: the button's view, the click, the tutorial gate. Exported for the unit test (no DOM: the window is an EventTarget).
 * Its chunk is fetched by `load()` (idempotent), which the list calls once a place is open: never during the first-visit start screen, whose own lazy chunk
 * must not wait behind it.
 */
export function wirePowerHelper(
  h: HelperWiring,
  deps: { win: Pick<Window, 'addEventListener'> | null; deviceLabel(instance: string): string; render(): void },
): { view(): HelperView; run(): void; load(): Promise<void>; offered(): boolean; uses(): PowerHelperUses } {
  let mod: PowerHelperModule | null = null
  /** The helper's uses on this page: the guide reads them through the debug hook, never through storage. */
  let used: PowerHelperUses = { n: 0, instances: [] }
  let gate: TutorialGate | null = h.tutorialAllowed ? tutorialGateOf(h.storage()) : null
  if (h.tutorialAllowed)
    deps.win?.addEventListener(TUTORIAL_EVENT, (e: Event) => {
      const next = gateOfDetail((e as CustomEvent<unknown>).detail)
      if (next === null) return
      gate = next
      deps.render()
    })
  const names = (ids: readonly string[]): string => ids.map((id) => deps.deviceLabel(id)).join(', ')
  const A = (): Readonly<Record<string, string>> => COPY.checklist!
  const view = (): HelperView => {
    if (mod === null) return { shown: false }
    const b = mod.helperButton(mod.powerHelperPlan(h.store, h.registry), gate)
    if (!b.shown) return b
    if (b.enabled) return { shown: true, enabled: true, note: A().helperWhat!.replace('{devices}', names(b.instances)) }
    // S5: the offer is promised only while a power step is current or ahead
    return { shown: true, enabled: false, note: b.reason === 'tutorial' ? A().helperLocked! : A().helperLockedRun! }
  }
  const run = (): void => {
    if (mod === null) return
    // the gate again at the click: a stale button never runs
    const v = view()
    if (!v.shown || !v.enabled) return
    const r = mod.runPowerHelper(h.store, h.history, h.registry, A().helperEntry!)
    if (r.ok) {
      used = { n: used.n + 1, instances: [...r.instances] }
      h.announce(fillUndo(A().helperDone!.replace('{devices}', names(r.instances)), h.undoLabel?.() || 'Ctrl+Z'))
    } else h.announce(r.why === 'busy' ? A().helperBusy! : A().helperFailed!) // S9: the list closed on the click, so every refusal is said
  }
  /** S3: the button would be shown now, and enabled once the tutorial gate opens (the guide offers the helper only then). False before the chunk is loaded. */
  const offered = (): boolean => {
    try {
      return mod !== null && mod.powerHelperPlan(h.store, h.registry).offered
    } catch {
      return false
    }
  }
  let loading: Promise<void> | null = null
  const load = (): Promise<void> =>
    (loading ??= (h.load ?? (() => import('../powerHelper')))().then(
      (m) => {
        mod = m
        deps.render()
      },
      (e: unknown) => console.warn('[creation] power helper unavailable', e),
    ))
  return { view, run, load, offered, uses: () => ({ n: used.n, instances: [...used.instances] }) }
}

/** The checklist, plus the two readers the debug hook exposes to the guide (S2, S3): whether the helper is offered now, and its uses on this page. */
export type WiredChecklist = Checklist & { helperOffered(): boolean; helperUses(): PowerHelperUses }

/** The Projet panel when this page's package asks for the panel form; null otherwise (never throws: a fake or partial document has no look). */
export function dockOf(doc: Document, root: HTMLElement): HTMLElement | null {
  try {
    const look = doc.documentElement ? lookOfRoot(doc.documentElement) : null
    return look?.layout.checklist === 'panel' ? root.querySelector<HTMLElement>('[data-testid="project-tree"]') : null
  } catch {
    return null
  }
}

export function wireChecklist(w: ChecklistWiring, mount: typeof mountChecklist = mountChecklist): WiredChecklist {
  const goTo = (t: GoTo): void => (t.kind === 'select' ? w.select(t.instance) : w.openInventory(t.tab))
  let list: Checklist | null = null
  const dock = w.dock === undefined ? dockOf(w.doc, w.root) : w.dock
  const helper = w.helper ? wirePowerHelper(w.helper, { win: w.doc.defaultView, deviceLabel: w.deviceLabel, render: () => list?.render() }) : null
  list = mount({
    doc: w.doc,
    slot: w.slot,
    root: w.root,
    view: () => checklistView(w.path(), { placeOpen: w.placeOpen() }),
    deviceLabel: w.deviceLabel,
    goTo,
    returnFocus: w.returnFocus,
    ...(helper ? { helper: { view: helper.view, run: helper.run } } : {}),
    ...(dock ? { dock } : {}),
  })
  // the helper's chunk once a place is open (a room is the earliest a strip can exist)
  const wake = (): void => {
    if (helper !== null && w.placeOpen()) void helper.load()
  }
  w.subscribe(() => {
    wake()
    list?.render()
  })
  wake()
  list.render()
  const shown = list
  return {
    render: () => shown.render(),
    get isOpen() {
      return shown.isOpen
    },
    open: () => shown.open(),
    close: (returnFocus?: boolean) => shown.close(returnFocus),
    helperOffered: () => helper?.offered() ?? false,
    helperUses: () => helper?.uses() ?? { n: 0, instances: [] },
  }
}
