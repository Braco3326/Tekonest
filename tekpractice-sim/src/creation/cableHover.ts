/**
 * Cable hover (Task 27, C18): the cable under the pointer is highlighted and its text (« ql1 out-main-l → k12-g
 * in-line-a · ligne ») is shown in the one hover label of the shell (`PatchUi.showHover`, the port label's own element).
 *
 * - Priority: a port under the pointer (the enlarged proxies of Task 26) or a device body wins over a cable; the cable
 *   is hovered only when the pointer is over a cable and nothing else.
 * - ONE label at a time. The label is shared with the port hover (`PatchController`), which runs first on the same canvas
 *   events: this controller hides the label only when it OWNS it (it showed the cable text); when a port takes the
 *   pointer the label is the port's now and is left alone.
 * - Event-driven only: one projection of the cables per pointer move and per camera change while a pointer is on the
 *   canvas. No observer on the render loop, no timer: an idle page renders nothing. The highlight asks for one frame
 *   through the host (as the port glow does).
 * - A rig change drops the hover (the cable may be gone); a place change resets it; a camera move or a resize re-reads
 *   the cable under the last pointer position, so the label never sits where a cable no longer is.
 *
 * Intents: none. The controller never touches the graph; it reads, and tells the scene which cable to draw lighter.
 */
import type { PortRef } from '../engine/types'
import type { DisposableBag } from '../util/disposable'

type Pt = { x: number; y: number }

/** What the controller needs of the SceneHost (structural: SceneHost satisfies it, tests fake it). */
export interface CableHoverHost {
  readonly canvasElement: HTMLElement
  readonly walking: boolean
  /** The cable key within a few px of a canvas point (CSS px, canvas-relative), or null. */
  cableAtPoint(x: number, y: number): string | null
  /** The port under a canvas point, proxies included. */
  portAtPoint(x: number, y: number): PortRef | null
  /** Draw this cable lighter (null puts it back). The host asks for a frame. */
  setHoveredCable(key: string | null): void
  /** The camera moved or the canvas was resized. Returns the remover. */
  listenView(fn: () => void): () => void
}

/** The hover label (`shell/portLabel.ts`, shared with the port hover). Points are page px. */
export interface CableHoverUi {
  showHover(text: string, at: Pt): void
  moveHover(at: Pt): void
  hideHover(): void
}

export interface CableHoverOptions {
  ui: CableHoverUi
  /** A placement ghost or a drag owns the pointer. */
  busy(): boolean
  /** A device body is under a canvas point. */
  deviceAt(x: number, y: number): boolean
  /** The cable's text; null when the cable is not (or no longer) in the design. */
  describe(key: string): string | null
  /** Notified after every rig change (the shell's store); returns the remover. */
  subscribe(fn: () => void): () => void
}

interface Pointer {
  /** Canvas-relative (CSS px). */
  x: number
  y: number
  /** Page (CSS px), where the label goes. */
  page: Pt
}

export class CableHoverController {
  private key: string | null = null
  private pointer: Pointer | null = null

  constructor(
    private readonly host: CableHoverHost,
    bag: DisposableBag,
    private readonly opts: CableHoverOptions
  ) {
    const canvas = host.canvasElement
    bag.listen(canvas, 'pointermove', (e: PointerEvent) => this.onMove(e))
    bag.listen(canvas, 'pointerleave', () => {
      this.pointer = null
      this.release(true)
    })
    bag.add(host.listenView(() => this.again()))
    bag.add(opts.subscribe(() => this.release(true)))
    bag.add(() => {
      this.pointer = null
      this.release(true)
    })
  }

  /** The cable highlighted right now. */
  get hovered(): string | null {
    return this.key
  }

  /** A place change: nothing of the old scene survives, and the pointer is unknown until it moves again. */
  reset(): void {
    this.pointer = null
    this.release(true)
  }

  private inert(): boolean {
    return this.host.walking || this.opts.busy()
  }

  private onMove(e: PointerEvent): void {
    // A pressed button is an orbit / pan / drag; a touch has no hover.
    if (e.pointerType === 'touch' || e.buttons !== 0 || this.inert()) {
      this.pointer = null
      return this.release(true)
    }
    this.pointer = { x: e.offsetX, y: e.offsetY, page: { x: e.clientX, y: e.clientY } }
    this.evaluate()
  }

  /** The camera moved or the canvas resized: look again under the last pointer position. */
  private again(): void {
    if (this.pointer && !this.inert()) this.evaluate()
  }

  private evaluate(): void {
    const p = this.pointer
    if (!p) return
    // A port wins: the port label is the patch controller's now, never hidden from here.
    if (this.host.portAtPoint(p.x, p.y)) return this.release(false)
    if (this.opts.deviceAt(p.x, p.y)) return this.release(true)
    const key = this.host.cableAtPoint(p.x, p.y)
    if (key === null) return this.release(true)
    if (key === this.key) return this.opts.ui.moveHover(p.page)
    const text = this.opts.describe(key)
    if (text === null) return this.release(true)
    this.key = key
    this.host.setHoveredCable(key)
    this.opts.ui.showHover(text, p.page)
  }

  /** Put the cable back; hide the label only if it is ours (`hide`). */
  private release(hide: boolean): void {
    if (this.key === null) return
    this.key = null
    this.host.setHoveredCable(null)
    if (hide) this.opts.ui.hideHover()
  }
}
