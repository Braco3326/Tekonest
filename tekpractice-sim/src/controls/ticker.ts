/**
 * controls/ticker: the one animation loop for live meters. Idle pages draw nothing (the render scheduler renders on demand), so
 * a meter has to ask for frames itself: while any rig has meters, this runs at most `FPS` times a second, steps each rig and asks
 * for a frame (`onFrame`) only when a rig redrew. With no rig registered it holds no timer at all.
 */
import type { ControlRig } from './controlRig'

const FPS = 30

export class ControlTicker {
  private readonly rigs = new Set<ControlRig>()
  private raf = 0
  private last = 0

  constructor(
    /** Ask the host for a frame (the render scheduler's invalidate). */
    private readonly onFrame: () => void,
    private readonly now: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    private readonly request: (cb: () => void) => number = (cb) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : 0),
    private readonly cancel: (id: number) => void = (id) => {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id)
    }
  ) {}

  add(rig: ControlRig): void {
    if (!rig.hasMeters) return
    this.rigs.add(rig)
    this.start()
  }

  remove(rig: ControlRig): void {
    this.rigs.delete(rig)
    if (!this.rigs.size) this.stop()
  }

  get running(): boolean {
    return this.raf !== 0
  }

  dispose(): void {
    this.rigs.clear()
    this.stop()
  }

  private start(): void {
    if (this.raf) return
    this.raf = this.request(this.loop)
  }

  private stop(): void {
    if (this.raf) this.cancel(this.raf)
    this.raf = 0
  }

  private readonly loop = (): void => {
    this.raf = 0
    if (!this.rigs.size) return
    const t = this.now()
    if (t - this.last >= 1000 / FPS - 1) {
      this.last = t
      let drew = false
      for (const r of this.rigs) drew = r.update(t) || drew
      if (drew) this.onFrame()
    }
    this.raf = this.request(this.loop)
  }
}
