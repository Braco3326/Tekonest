/**
 * DeferredEmptyClick — "an empty click in Focus leaves focus", deferred by the
 * double-click window so the first half of a floor double-click (re-pivot) does
 * not start the flight home (Task 4). The view ({mode, focused}) is captured
 * when scheduled; if it changed by the time the timer fires (refocus, Esc,
 * Alt+H, pick-up…), the deferred click is dropped. No Babylon, no DOM.
 */
/**
 * How long after a click-focus a tap / double-tap "confirms" that focus instead
 * of re-picking (the view is flying). Reduced motion = a cut = 0: nothing moves.
 */
export function confirmWindowMs(ms: number, motion: boolean): number {
  return motion ? ms : 0
}

export interface ViewKey {
  readonly mode: string
  readonly focused: string | null
}

export class DeferredEmptyClick {
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly delayMs: number,
    private readonly view: () => ViewKey,
    private readonly fire: () => void,
  ) {}

  get pending(): boolean {
    return this.timer !== null
  }

  schedule(): void {
    this.cancel()
    const { mode, focused } = this.view()
    this.timer = setTimeout(() => {
      this.timer = null
      const now = this.view()
      if (now.mode !== mode || now.focused !== focused) return // the view moved on: stale click
      this.fire()
    }, this.delayMs)
  }

  /** Drop a pending click. Returns true if one was pending. */
  cancel(): boolean {
    if (this.timer === null) return false
    clearTimeout(this.timer)
    this.timer = null
    return true
  }
}
