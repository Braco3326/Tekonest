/**
 * Click-to-patch on the scene's ports (Task 26, CA-19, CA-20, C18, C6).
 *
 * - Hover (or focus, Task 27) shows the port's label, never a permanent one (`ui.showHover`); a port is
 *   found by `host.portAtPoint`, which sees the enlarged invisible proxies (`portProxies.ts`, >= 24 px).
 * - Click a free port A: it is `pending`; every port that `store.canConnect(A, X).ok` glows green, the rest dim
 *   (`host.markPorts`). Click a port B: `history.do(CONNECT)`, ONE undo entry. A refusal is a result, never an
 *   exception: the rule's title is pinned at B (`ui.pinError`, `role="alert"`), the cable stays in hand for a
 *   retry, and `history.onRefused` (the shell) lists it in the status bar. A second click on A cancels.
 * - Click an occupied port with nothing pending: the bubble offers « Débrancher » (`UNPLUG`, one entry).
 * - Échap (`cancel`) drops the cable, the error and the offer. Dragging from port to port is NOT built (cut list).
 *
 * Inert while a placement ghost or a drag owns the pointer (`opts.busy`) and in the walk view. Intents only: the
 * controller never touches the graph. No `onBeforeRender` observer and no timer: it reacts to pointer events and
 * to the camera's view-matrix observer (only while a label is on screen), so an idle page renders nothing.
 */
import type { PortRef } from '../engine/types'
import type { DisposableBag } from '../util/disposable'
import { COPY } from './copy'
import type { History } from './history'
import { portKey, type PortMark } from './portProxies'
import type { RenderScheduler } from './renderScheduler'
import { isClick } from './selection'
import type { CreationStore, DispatchFail } from './store'

type Pt = { x: number; y: number }

/** What the controller needs of the SceneHost (structural: SceneHost satisfies it, tests fake it). */
export interface PatchHost {
  readonly canvasElement: HTMLElement
  readonly walking: boolean
  /**
   * The port under a canvas point (CSS px, canvas-relative), proxies included. `generous` false: over a device's
   * body only a click right on the connector counts, so the body stays selectable (a cable in hand = generous).
   */
  portAtPoint(x: number, y: number, generous: boolean): PortRef | null
  /** A port's page position (CSS px), for the labels' anchors. */
  portScreen(ref: PortRef): Pt | null
  /** Restyle the markers: hover + the patch glow (null, null = back to normal). */
  markPorts(hover: PortRef | null, marks: ReadonlyMap<string, PortMark> | null): void
  /** Called when the camera's view changed (a label on screen follows its port). */
  onPortViewChange: (() => void) | null
}

/** The DOM labels (`shell/portLabel.ts`); tests fake it. Points are page px. */
export interface PatchUi {
  showHover(text: string, at: Pt): void
  moveHover(at: Pt): void
  hideHover(): void
  pinError(text: string, at: Pt): void
  moveError(at: Pt): void
  clearError(): void
  offerUnplug(o: { text: string; buttonName: string; at: Pt; onUnplug(): void }): void
  moveOffer(at: Pt): void
  clearOffer(): void
  /** The keyboard focus is inside one of the labels (the offer's button). */
  hasFocus(): boolean
}

export interface PatchOptions {
  ui: PatchUi
  /** A placement ghost or a drag owns the pointer: patching is inert. */
  busy(): boolean
  /** The hover label text (« in-mic-1 · XLR3 femelle · Niveau micro »). */
  describe(ref: PortRef): string
  /** « Appareil · prise », for history labels, the status line and the offer. */
  portName(ref: PortRef): string
  /** Every port of the rig (the candidates of the glow). */
  allPorts(): PortRef[]
  /** The refusal's rule title (the status bar's list uses the same). */
  rejectionTitle(error: DispatchFail['error'], subjects: readonly PortRef[]): string
  /** A line for the status bar (announced). */
  announce?(message: string): void
  /** The undo key's label (« Ctrl+Z »). */
  undoLabel?(): string
  /** Called just before an intent is dispatched (the shell closes a stepper burst still open). */
  beforeDispatch?(): void
}

const same = (a: PortRef | null, b: PortRef | null): boolean => !!a && !!b && a.instance === b.instance && a.port === b.port
const fill = (s: string, vars: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)

interface Press {
  x: number
  y: number
  t: number
  pointerId: number
}

export class PatchController {
  private _pending: PortRef | null = null
  private _errorAt: PortRef | null = null
  private offerAt: PortRef | null = null
  private hover: PortRef | null = null
  private press: Press | null = null
  private disposed = false

  constructor(
    private readonly host: PatchHost,
    private readonly history: History,
    private readonly store: CreationStore,
    private readonly scheduler: Pick<RenderScheduler, 'invalidate'>,
    bag: DisposableBag,
    private readonly opts: PatchOptions
  ) {
    const canvas = host.canvasElement
    // Capture on the press: it only records (nothing is stopped here), so it runs before the placement's
    // capture-phase drag start and sees every press. Nothing here ever stops an event: the camera must see them all.
    bag.listen(canvas, 'pointerdown', (e: PointerEvent) => this.onDown(e), { capture: true })
    bag.listen(canvas, 'pointerup', (e: PointerEvent) => this.onUp(e))
    bag.listen(canvas, 'pointercancel', () => (this.press = null))
    bag.listen(canvas, 'pointermove', (e: PointerEvent) => this.onMove(e))
    bag.listen(canvas, 'pointerleave', () => this.setHover(null))
    bag.add(this.store.subscribe((change) => this.onStore(change.intents.some((i) => i.type === 'APPLY_DESIGN'))))
    host.onPortViewChange = () => this.reposition()
    bag.add(() => {
      host.onPortViewChange = null
      this.disposed = true
      this.reset()
    })
  }

  /** The first port clicked, waiting for the second. */
  get pending(): PortRef | null {
    return this._pending
  }

  /** The port that carries the pinned refusal, if any. */
  get errorAt(): PortRef | null {
    return this._errorAt
  }

  /** Échap: drop the cable, the pinned error and the offer. False when there was none of them. */
  cancel(): boolean {
    const had = this._pending !== null || this._errorAt !== null || this.offerAt !== null
    if (!had) return false
    const refocus = this.opts.ui.hasFocus()
    const wasPending = this._pending !== null
    this.reset()
    if (refocus) this.host.canvasElement.focus?.() // the offer's button was focused and is gone
    if (wasPending) this.opts.announce?.(COPY.patch!.statusCancelled!)
    return true
  }

  /** A place change or teardown: nothing of the old scene's ports survives. */
  reset(): void {
    const had = this._pending !== null || this.hover !== null
    this._pending = null
    this.dropError()
    this.dropOffer()
    this.hover = null
    this.opts.ui.hideHover()
    if (had) this.host.markPorts(null, null)
    this.press = null
  }

  /** A press-and-release at a canvas point was a click: patch it if it is on a port. */
  clickAt(x: number, y: number): boolean {
    const ref = this.portUnder(x, y)
    return ref ? this.click(ref) : false
  }

  /**
   * A click here would be a patch click (the shell's pick / miss handlers leave it alone). Pure: asks, changes nothing,
   * so the shell can ask before this controller's own release handler runs.
   */
  wouldTake(x: number, y: number): boolean {
    return this.portUnder(x, y) !== null
  }

  /** The port a click at (x, y) would patch: none while inert; the whole proxy with a cable in hand, else only right on the connector over a body. */
  private portUnder(x: number, y: number): PortRef | null {
    return this.inert() ? null : this.host.portAtPoint(x, y, this._pending !== null)
  }

  /** The state machine. False (nothing done) while inert. */
  click(ref: PortRef): boolean {
    if (this.inert()) return false
    this.dropOffer()
    if (!this._pending) {
      const other = this.otherEnd(ref)
      if (other) {
        this.dropError()
        this.offer(ref, other)
        return true
      }
      this.dropError()
      this._pending = ref
      this.applyMarks()
      this.opts.announce?.(fill(COPY.patch!.statusPending!, { port: this.opts.portName(ref) }))
      return true
    }
    if (same(this._pending, ref)) {
      this.cancel()
      return true
    }
    this.connect(this._pending, ref)
    return true
  }

  // ── pointer events ──────────────────────────────────────────────────────────

  private onDown(e: PointerEvent): void {
    this.press = null
    if (e.button !== 0 || !e.isPrimary) return
    this.dropOffer() // a press elsewhere closes the offer (a click on a port re-opens it on release)
    if (e.shiftKey || e.ctrlKey || e.metaKey) return // pan gestures stay the camera's
    this.press = { x: e.offsetX, y: e.offsetY, t: e.timeStamp, pointerId: e.pointerId }
  }

  private onUp(e: PointerEvent): void {
    const press = this.press
    this.press = null
    if (!press || e.button !== 0 || e.pointerId !== press.pointerId) return
    // Busy: the release belongs to the placement (a drop, the end of a drag, the click on the selected device).
    if (this.inert()) return
    if (!isClick(press, { x: e.offsetX, y: e.offsetY, t: e.timeStamp })) return
    // NOT stopped: the camera's own pointer input must see the release (else it keeps orbiting as if the button
    // were down). The shell keeps a port click from being a selection or a miss (`portAtPoint` in its pick / miss).
    this.clickAt(e.offsetX, e.offsetY)
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerType === 'touch' || e.buttons !== 0 || this.inert()) return this.setHover(null)
    this.setHover(this.portUnder(e.offsetX, e.offsetY))
  }

  // ── the label and the glow ──────────────────────────────────────────────────

  private setHover(ref: PortRef | null): void {
    if (same(this.hover, ref) || (!this.hover && !ref)) return
    this.hover = ref
    this.host.markPorts(ref, this.marks())
    const at = ref ? this.host.portScreen(ref) : null
    // One label per port: the pinned error and the offer are the label of their own port.
    if (ref && at && !same(ref, this._errorAt) && !same(ref, this.offerAt)) this.opts.ui.showHover(this.opts.describe(ref), at)
    else this.opts.ui.hideHover()
    this.scheduler.invalidate()
  }

  /** The camera moved: a label on screen follows its port. */
  private reposition(): void {
    if (this.disposed) return
    const place = (ref: PortRef | null, move: (at: Pt) => void): void => {
      const at = ref ? this.host.portScreen(ref) : null
      if (at) move(at)
    }
    place(this.hover, (at) => this.opts.ui.moveHover(at))
    place(this._errorAt, (at) => this.opts.ui.moveError(at))
    place(this.offerAt, (at) => this.opts.ui.moveOffer(at))
  }

  /** ok / dim for every port against the pending one; null while nothing is pending. */
  private marks(): Map<string, PortMark> | null {
    const a = this._pending
    if (!a) return null
    const marks = new Map<string, PortMark>()
    for (const x of this.opts.allPorts()) {
      if (same(a, x)) marks.set(portKey(x), 'pending')
      else marks.set(portKey(x), this.store.canConnect(a, x).ok ? 'ok' : 'dim')
    }
    return marks
  }

  private applyMarks(): void {
    this.host.markPorts(this.hover, this.marks())
    this.scheduler.invalidate()
  }

  // ── actions ─────────────────────────────────────────────────────────────────

  private connect(a: PortRef, b: PortRef): void {
    this.opts.beforeDispatch?.()
    const names = { a: this.opts.portName(a), b: this.opts.portName(b) }
    const r = this.history.do({ type: 'CONNECT', a, b }, fill(COPY.patch!.entryConnect!, names))
    if (r.ok) {
      this.dropError()
      this._pending = null
      this.applyMarks()
      this.opts.announce?.(fill(COPY.patch!.statusConnected!, { ...names, undo: this.opts.undoLabel?.() ?? 'Ctrl+Z' }))
      return
    }
    // A refusal is a message, not an exception: pinned at B; the cable stays in hand (the status list got it from history.onRefused).
    const at = this.host.portScreen(b)
    this.dropError()
    this._errorAt = b
    if (this.hover && same(this.hover, b)) this.opts.ui.hideHover() // one label per port
    if (at) this.opts.ui.pinError(fill(COPY.patch!.errorLabel!, { title: this.opts.rejectionTitle(r.error, r.subjects) }), at)
    this.scheduler.invalidate()
  }

  private offer(ref: PortRef, other: PortRef): void {
    const at = this.host.portScreen(ref)
    if (!at) return
    this.offerAt = ref
    if (same(this.hover, ref)) this.opts.ui.hideHover() // one label per port
    this.opts.ui.offerUnplug({
      text: fill(COPY.patch!.offerText!, { port: this.opts.portName(ref), other: this.opts.portName(other) }),
      buttonName: fill(COPY.patch!.offerName!, { port: this.opts.portName(ref), other: this.opts.portName(other) }),
      at,
      onUnplug: () => this.unplug(ref, other),
    })
    this.scheduler.invalidate()
  }

  private unplug(a: PortRef, b: PortRef): void {
    if (this.disposed || this.inert()) return
    const refocus = this.opts.ui.hasFocus()
    this.dropOffer()
    this.opts.beforeDispatch?.()
    const names = { a: this.opts.portName(a), b: this.opts.portName(b) }
    const r = this.history.do({ type: 'UNPLUG', a, b }, fill(COPY.patch!.entryUnplug!, names))
    if (r.ok) this.opts.announce?.(fill(COPY.patch!.statusUnplugged!, { ...names, undo: this.opts.undoLabel?.() ?? 'Ctrl+Z' }))
    if (refocus) this.host.canvasElement.focus?.()
    this.scheduler.invalidate()
  }

  // ── internals ───────────────────────────────────────────────────────────────

  private inert(): boolean {
    return this.disposed || this.host.walking || this.opts.busy()
  }

  /** The port at the other end of ref's cable, or null when ref is free. */
  private otherEnd(ref: PortRef): PortRef | null {
    for (const c of this.store.design().rig.connections) {
      if (same(c.a, ref)) return { instance: c.b.instance, port: c.b.port }
      if (same(c.b, ref)) return { instance: c.a.instance, port: c.a.port }
    }
    return null
  }

  private dropError(): void {
    if (this._errorAt === null) return
    this._errorAt = null
    this.opts.ui.clearError()
  }

  private dropOffer(): void {
    if (this.offerAt === null) return
    this.offerAt = null
    this.opts.ui.clearOffer()
  }

  /** A rig change: a pending port whose device left drops; the glow follows the new occupancy; a new design clears all. */
  private onStore(newDesign: boolean): void {
    if (this.disposed) return
    if (newDesign) return this.reset()
    const present = new Set(this.store.design().rig.instances.map((i) => i.instanceId))
    if (this._pending && !present.has(this._pending.instance)) {
      this._pending = null
      this.host.markPorts(this.hover, null)
    } else if (this._pending) this.applyMarks()
    if (this._errorAt && !present.has(this._errorAt.instance)) this.dropError()
    // An offer is about a cable that may be gone or changed: re-ask rather than keep a stale one.
    if (this.offerAt) this.dropOffer()
  }
}
