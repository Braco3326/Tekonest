/**
 * Undo / redo of the 2D plan (mission 2, spec §2). Plans are immutable values (model.ts), so a step is the plan before and after: undo and redo
 * restore whole plans and every id comes back as it was. Pure: no DOM. A refused intent is no step. The 3D history (src/creation/history.ts)
 * is a different object: nothing here reaches the 3D scene.
 */
import { applyIntent, type ApplyResult, type Plan2D, type PlanIntent } from './model'

interface Step {
  before: Plan2D
  after: Plan2D
  label: string
}

export class PlanHistory {
  private current: Plan2D
  private done: Step[] = []
  private undone: Step[] = []
  private subs = new Set<(plan: Plan2D) => void>()

  constructor(initial: Plan2D, private readonly limit = 200) {
    this.current = initial
  }

  get plan(): Plan2D {
    return this.current
  }
  get canUndo(): boolean {
    return this.done.length > 0
  }
  get canRedo(): boolean {
    return this.undone.length > 0
  }
  get undoLabel(): string | null {
    return this.done[this.done.length - 1]?.label ?? null
  }
  get redoLabel(): string | null {
    return this.undone[this.undone.length - 1]?.label ?? null
  }

  do(intent: PlanIntent, label: string): ApplyResult {
    const r = applyIntent(this.current, intent)
    if (!r.ok) return r
    this.done.push({ before: this.current, after: r.plan, label })
    if (this.done.length > this.limit) this.done.shift()
    this.undone = []
    this.set(r.plan)
    return r
  }

  /** Undoes the last step; returns its label, or null when there is none. */
  undo(): string | null {
    const s = this.done.pop()
    if (!s) return null
    this.undone.push(s)
    this.set(s.before)
    return s.label
  }

  redo(): string | null {
    const s = this.undone.pop()
    if (!s) return null
    this.done.push(s)
    this.set(s.after)
    return s.label
  }

  /** A new plan with no history (another project or room was opened). */
  reset(plan: Plan2D): void {
    this.done = []
    this.undone = []
    this.set(plan)
  }

  subscribe(fn: (plan: Plan2D) => void): () => void {
    this.subs.add(fn)
    return () => void this.subs.delete(fn)
  }

  private set(plan: Plan2D): void {
    this.current = plan
    for (const fn of [...this.subs]) fn(plan)
  }
}
