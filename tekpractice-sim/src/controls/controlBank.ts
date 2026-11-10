/**
 * controls/controlBank: the live values of one device's controls. One bank per device instance; the 3D rig renders it, the pointer
 * controller writes it ('user'), and the console software of a later phase reads and writes it too ('software'): the same
 * numbers drive the cap you see and the signal the engine will process. Plain TypeScript, no Babylon.
 */
import type { ControlDef } from './controlTypes'

export type ChangeOrigin = 'user' | 'software' | 'reset'
export type ChangeListener = (id: string, value: number, origin: ChangeOrigin) => void

/** Clamp / quantise a raw value to what a control of this kind can hold. */
export function normaliseValue(def: ControlDef, raw: number): number {
  if (!Number.isFinite(raw)) return def.default
  switch (def.kind) {
    case 'button':
    case 'led':
      return raw >= 0.5 ? 1 : 0
    case 'switch': {
      const top = (def.positions ?? 2) - 1
      return Math.min(top, Math.max(0, Math.round(raw)))
    }
    case 'meter':
    case 'screen':
      return 0
    case 'knob': {
      const v = Math.min(1, Math.max(0, raw))
      return def.detents ? Math.round(v * (def.detents - 1)) / (def.detents - 1) : v
    }
    default:
      return Math.min(1, Math.max(0, raw))
  }
}

export class ControlBank {
  private readonly defs = new Map<string, ControlDef>()
  private readonly values = new Map<string, number>()
  private readonly listeners = new Set<ChangeListener>()

  constructor(defs: readonly ControlDef[]) {
    for (const d of defs) {
      this.defs.set(d.id, d)
      this.values.set(d.id, normaliseValue(d, d.default))
    }
  }

  /** Every definition, in layout order. */
  all(): ControlDef[] {
    return [...this.defs.values()]
  }

  def(id: string): ControlDef | undefined {
    return this.defs.get(id)
  }

  has(id: string): boolean {
    return this.defs.has(id)
  }

  get(id: string): number {
    return this.values.get(id) ?? 0
  }

  /** Set a value; returns whether it changed (an unknown id or an unchanged value changes nothing and notifies no one). */
  set(id: string, raw: number, origin: ChangeOrigin = 'software'): boolean {
    const def = this.defs.get(id)
    if (!def) return false
    const next = normaliseValue(def, raw)
    if (this.values.get(id) === next) return false
    this.values.set(id, next)
    for (const l of [...this.listeners]) l(id, next, origin)
    // Radio group: pressing one key releases the others of its group (an ON / OFF pair).
    if (def.group && next === 1) for (const other of this.defs.values()) if (other.id !== id && other.group === def.group) this.set(other.id, 0, origin)
    return true
  }

  reset(id: string): boolean {
    const def = this.defs.get(id)
    return def ? this.set(id, def.default, 'reset') : false
  }

  /** Subscribe to changes; returns the unsubscribe. */
  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** The values by id (a plain object: what a project file or the software layer stores). */
  snapshot(): Record<string, number> {
    return Object.fromEntries(this.values)
  }

  /** Apply stored values (unknown ids are ignored). */
  restore(values: Record<string, number>, origin: ChangeOrigin = 'software'): void {
    for (const [id, v] of Object.entries(values)) this.set(id, v, origin)
  }
}
