/**
 * View state of Mode Création (selection, hidden devices, panels, ear height).
 * Never undoable (brief §4): it lives beside the store, never inside it.
 */
import { DEFAULT_LISTENER_POINT } from './listeningPoints'
export interface ViewStateData {
  selection: string | null
  hidden: string[]
  treeOpen: boolean
  propsOpen: boolean
  earHeight: 1.2 | 1.7
  /**
   * The active listening point (Task 20): what the Web Audio listener uses when not walking
   * (Task 39). A point id of `listeningPoints.ts`; a place without it falls back to its first point.
   * Session only: never in the view prefs file (point ids depend on the place); back to
   * `DEFAULT_LISTENER_POINT` whenever another place is shown (review Fix 1).
   */
  listenerPoint: string
}

const DEFAULTS: ViewStateData = {
  selection: null,
  hidden: [],
  treeOpen: true,
  propsOpen: true,
  earHeight: 1.2,
  listenerPoint: DEFAULT_LISTENER_POINT,
}

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

/** Absent, or a valid v1 file: the only cases this tab may write over. */
function ours(raw: string | null): boolean {
  if (raw === null) return true
  try {
    const f = JSON.parse(raw) as { version?: unknown; earHeight?: unknown } | null
    return !!f && typeof f === 'object' && !Array.isArray(f) && f.version === 1 && (f.earHeight === 1.2 || f.earHeight === 1.7)
  } catch {
    return false
  }
}

/**
 * Write the view settings (the setting applies for the session either way).
 * Data it cannot read (bad JSON, another version, a wrong shape) is never written over:
 * 'kept' (user data is never silently deleted). Blocked or full storage: 'blocked'.
 */
export function saveViewPrefs(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  prefs: Required<ViewPrefs>
): 'written' | 'kept' | 'blocked' {
  if (!storage) return 'blocked'
  try {
    if (!ours(storage.getItem(VIEW_PREFS_KEY))) return 'kept'
    storage.setItem(VIEW_PREFS_KEY, JSON.stringify({ version: 1, earHeight: prefs.earHeight }))
    return 'written'
  } catch {
    return 'blocked' // blocked / quota: not worth a notice for a view setting
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
