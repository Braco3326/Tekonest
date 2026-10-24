/**
 * View state of Mode Création (selection, hidden devices, panels, ear height).
 * Never undoable (brief §4): it lives beside the store, never inside it.
 */
export interface ViewStateData {
  selection: string | null
  hidden: string[]
  treeOpen: boolean
  propsOpen: boolean
  earHeight: 1.2 | 1.7
}

const DEFAULTS: ViewStateData = { selection: null, hidden: [], treeOpen: true, propsOpen: true, earHeight: 1.2 }

export class ViewState {
  private data: ViewStateData = structuredClone(DEFAULTS)
  private subs = new Set<() => void>()

  /** A copy: mutating it never changes the state. */
  get(): Readonly<ViewStateData> {
    return structuredClone(this.data)
  }

  /** Merge a patch; subscribers are notified only when something changed. */
  set(patch: Partial<ViewStateData>): void {
    const next = { ...this.data, ...structuredClone(patch) }
    if (JSON.stringify(next) === JSON.stringify(this.data)) return
    this.data = next
    for (const fn of [...this.subs]) {
      try {
        fn()
      } catch (e) {
        console.error('[creation] view state subscriber failed', e)
      }
    }
  }

  subscribe(fn: () => void): () => void {
    this.subs.add(fn)
    return () => {
      this.subs.delete(fn)
    }
  }
}
