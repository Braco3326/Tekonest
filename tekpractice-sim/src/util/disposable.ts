/**
 * DisposableBag: collects teardown functions so a controller can release every
 * listener and observer it registered with one idempotent dispose() (C3).
 */
// The handler is typed any, not never: DOM targets declare an overloaded
// addEventListener, which a never-typed handler rejects under strict.
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ListenTarget {
  addEventListener(type: string, fn: (e: any) => void, opts?: boolean | AddEventListenerOptions): void
  removeEventListener(type: string, fn: (e: any) => void, opts?: boolean | EventListenerOptions): void
}
export interface ObservableLike<T> {
  add(fn: (v: T) => void): unknown
  remove(o: unknown): boolean
}

export class DisposableBag {
  /** debug/e2e: listeners registered through any bag and not yet removed */
  static liveListeners = 0
  private fns: (() => void)[] = []
  private done = false
  get disposed(): boolean {
    return this.done
  }
  /** Runs immediately if the bag is already disposed. */
  add(fn: () => void): void {
    if (this.done) fn()
    else this.fns.push(fn)
  }
  listen(target: ListenTarget, type: string, fn: (e: any) => void, opts?: boolean | AddEventListenerOptions): void {
    target.addEventListener(type, fn, opts)
    DisposableBag.liveListeners++
    this.add(() => {
      target.removeEventListener(type, fn, opts)
      DisposableBag.liveListeners--
    })
  }
  observe<T>(observable: ObservableLike<T>, fn: (v: T) => void): void {
    const o = observable.add(fn)
    this.add(() => void observable.remove(o))
  }
  /** LIFO, idempotent, one failing disposer never stops the others. */
  dispose(): void {
    if (this.done) return
    this.done = true
    for (const fn of this.fns.splice(0).reverse()) {
      try {
        fn()
      } catch (e) {
        console.warn('[dispose]', e)
      }
    }
  }
}
