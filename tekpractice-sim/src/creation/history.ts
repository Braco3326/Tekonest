/**
 * History (Mode Création, C5/P1): the undo/redo command stack over store
 * intents. Each entry keeps the normalized forward intents and their inverse
 * (in application order). A drag or a stepper burst is ONE entry: `begin` /
 * `commit` group the steps, and consecutive SET_POSE of one instance coalesce
 * (first inverse, last forward: both are absolute poses).
 *
 * Undo/redo/rollback apply a whole entry through `store.dispatchAll` when the
 * store has it, so subscribers see one change and a failing step leaves the
 * store as it was (the entry then stays where it is). Selection and camera
 * never come through here: they are not intents.
 */
import type { BatchResult, DispatchResult } from './store'
import type { Intent } from '../ui/intents'

export interface HistoryEntry {
  label: string
  forward: Intent[]
  /** In application order: the last change is undone first. */
  inverse: Intent[]
}

export interface HistoryStore {
  dispatch(i: Intent): DispatchResult
  /** Optional atomic group (CreationStore has it); without it steps run one by one. */
  dispatchAll?(intents: readonly Intent[]): BatchResult
}

export const DEFAULT_HISTORY_LIMIT = 200

export class History {
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private tx: HistoryEntry | null = null
  private depth = 0
  private listeners = new Set<() => void>()

  constructor(
    private store: HistoryStore,
    private limit = DEFAULT_HISTORY_LIMIT,
  ) {}

  /** Dispatch and record. A failed dispatch records nothing and keeps the redo stack. */
  do(intent: Intent, label: string = intent.type): DispatchResult {
    const r = this.store.dispatch(intent)
    if (!r.ok) return r
    const step: HistoryEntry = { label, forward: [r.normalized], inverse: [...r.inverse] }
    if (this.tx) this.merge(this.tx, step)
    else this.push(step)
    return r
  }

  /** Open a transaction; a nested begin only counts depth (the outer label wins). */
  begin(label: string): void {
    if (this.depth++ === 0) this.tx = { label, forward: [], inverse: [] }
  }

  /** Close the transaction at depth 0; an empty one records nothing. */
  commit(): void {
    if (this.depth === 0 || --this.depth > 0) return
    const tx = this.tx
    this.tx = null
    if (tx && tx.forward.length) this.push(tx)
  }

  /** Undo everything since the outer `begin` and record nothing. */
  rollback(): void {
    const tx = this.tx
    this.tx = null
    this.depth = 0
    if (!tx) return
    if (tx.inverse.length && !this.applyGroup(tx.inverse).ok) console.error('[creation] history rollback failed', tx.label)
    this.emit()
  }

  /** False when there is nothing to undo, a transaction is open, or the inverse no longer applies (nothing changes). */
  undo(): boolean {
    const e = this.undoStack[this.undoStack.length - 1]
    if (!e || this.tx) return false
    const r = this.applyGroup(e.inverse)
    if (!r.ok) {
      console.warn('[creation] undo refused by the store', e.label, r.error)
      return false
    }
    this.undoStack.pop()
    this.redoStack.push(e)
    this.emit()
    return true
  }

  /** Replays the forward intents; the inverse is recomputed (ids may differ). */
  redo(): boolean {
    const e = this.redoStack[this.redoStack.length - 1]
    if (!e || this.tx) return false
    const r = this.applyGroup(e.forward)
    if (!r.ok) {
      console.warn('[creation] redo refused by the store', e.label, r.error)
      return false
    }
    this.redoStack.pop()
    this.undoStack.push({ label: e.label, forward: e.forward, inverse: r.inverse })
    this.emit()
    return true
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0
  }
  get undoLabel(): string | null {
    return this.undoStack[this.undoStack.length - 1]?.label ?? null
  }
  get redoLabel(): string | null {
    return this.redoStack[this.redoStack.length - 1]?.label ?? null
  }
  get sizes(): { undo: number; redo: number } {
    return { undo: this.undoStack.length, redo: this.redoStack.length }
  }

  /** A copy of the entry the next undo would apply. */
  peekUndo(): HistoryEntry | null {
    const e = this.undoStack[this.undoStack.length - 1]
    return e ? structuredClone(e) : null
  }

  /** Forget everything (e.g. a new project); an open transaction is dropped as is. */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.tx = null
    this.depth = 0
    this.emit()
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** Inverse order: the last change is undone first. Consecutive SET_POSE of one instance coalesce. */
  private merge(tx: HistoryEntry, step: HistoryEntry): void {
    const f = step.forward[0]
    const last = tx.forward[tx.forward.length - 1]
    if (f.type === 'SET_POSE' && last?.type === 'SET_POSE' && last.instanceId === f.instanceId) {
      tx.forward[tx.forward.length - 1] = f // keep the first inverse, the last forward
      return
    }
    tx.forward.push(...step.forward)
    tx.inverse.unshift(...step.inverse)
  }

  private push(e: HistoryEntry): void {
    this.undoStack.push(e)
    while (this.undoStack.length > Math.max(1, this.limit)) this.undoStack.shift()
    this.redoStack = []
    this.emit()
  }

  /** Apply intents as one group: atomic through the store when it can, else one by one with a manual revert. */
  private applyGroup(intents: readonly Intent[]): { ok: true; inverse: Intent[] } | { ok: false; error: unknown } {
    if (this.store.dispatchAll) {
      const r = this.store.dispatchAll(intents)
      return r.ok ? { ok: true, inverse: r.inverse } : { ok: false, error: r.error }
    }
    const applied: Intent[][] = []
    for (const i of intents) {
      const r = this.store.dispatch(i)
      if (!r.ok) {
        for (const inv of applied.reverse().flat()) this.store.dispatch(inv)
        return { ok: false, error: r.error }
      }
      applied.push(r.inverse)
    }
    return { ok: true, inverse: applied.reverse().flat() }
  }

  private emit(): void {
    for (const fn of [...this.listeners]) {
      try {
        fn()
      } catch (e) {
        console.error('[creation] history listener failed', e)
      }
    }
  }
}
