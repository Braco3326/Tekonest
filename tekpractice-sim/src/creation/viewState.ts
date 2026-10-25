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

/** View settings kept across reloads (Task 19: the ear height). Per origin, never in the rig. */
export const VIEW_PREFS_KEY = 'audio-sim/creation-view.v1'
export type ViewPrefs = Partial<Pick<ViewStateData, 'earHeight'>>

/** The saved view settings; {} (the defaults) when absent, unreadable, of another version or blocked. */
export function loadViewPrefs(storage: Pick<Storage, 'getItem'> | null): ViewPrefs {
  try {
    const raw = storage?.getItem(VIEW_PREFS_KEY)
    if (!raw) return {}
    const file = JSON.parse(raw) as { version?: unknown; earHeight?: unknown }
    if (file.version !== 1) return {}
    return file.earHeight === 1.2 || file.earHeight === 1.7 ? { earHeight: file.earHeight } : {}
  } catch {
    return {}
  }
}

/** Write the view settings; a blocked or full storage is ignored (the setting still applies now). */
export function saveViewPrefs(storage: Pick<Storage, 'setItem'> | null, prefs: Required<ViewPrefs>): void {
  try {
    storage?.setItem(VIEW_PREFS_KEY, JSON.stringify({ version: 1, earHeight: prefs.earHeight }))
  } catch {
    // blocked / quota: not worth a notice for a view setting
  }
}

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
