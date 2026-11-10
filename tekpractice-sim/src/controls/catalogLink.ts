/**
 * controls/catalogLink: a 3D control can stand for a setting the simulation already has (the catalog's `controls`: a power toggle,
 * a « channel open » toggle, a master fader with dB steps). This maps one to the other, both ways, so the cap you move changes the
 * simulated setting and the Properties panel moves the cap. Pure.
 *   toggle  <- a key / switch (pressed = true), or a fader (open above a small threshold, closed at the bottom)
 *   enum    <- a fader whose options are dB steps (« -inf », « -10 », « +6 »): nearest step; or any knob / switch by index
 */
import type { ControlDef } from './controlTypes'
import { controlDb, controlPosition } from './tapers'

export type CatalogValue = boolean | string

export interface CatalogControl {
  id: string
  type: 'toggle' | 'enum'
  options?: string[]
}

/** A fader this near the bottom of its travel counts as closed for a toggle. */
const CLOSED_BELOW = 0.05
/** Where a fader lands when a toggle opens it from closed (0 dB on the console scale, about). */
const OPEN_AT = 0.8

/** « -inf » -> -90, « +6 » -> 6, anything that is not a number -> null. */
export function optionDb(option: string): number | null {
  const s = option.trim().toLowerCase()
  if (s === '-inf' || s === '−inf' || s === '-∞') return -90
  return /^[+-]?\d+(\.\d+)?$/.test(s) ? Number(s) : null
}

/** The catalog value a 3D control's value stands for. */
export function toCatalog(def: ControlDef, cat: CatalogControl, v: number): CatalogValue {
  if (cat.type === 'toggle') return (def.kind === 'fader' ? v > CLOSED_BELOW : v >= 0.5) !== (def.invert === true)
  const options = cat.options ?? []
  if (!options.length) return ''
  if (def.kind === 'fader' && options.every((o) => optionDb(o) !== null)) {
    const db = Math.max(-90, controlDb(def, v))
    let best = options[0]
    let bestD = Infinity
    for (const o of options) {
      const d = Math.abs((optionDb(o) as number) - db)
      if (d < bestD) {
        bestD = d
        best = o
      }
    }
    return best
  }
  const top = options.length - 1
  const span = def.kind === 'switch' ? Math.max(1, (def.positions ?? 2) - 1) : 1
  const frac = def.kind === 'switch' ? v / span : v
  return options[Math.min(top, Math.max(0, Math.round(frac * top)))]
}

/**
 * The 3D value for a catalog value, or null when the catalog value already matches what the control shows (so a fader that sits at -12 dB
 * is not snapped to the nearest enum step just because the panel was redrawn).
 */
export function fromCatalog(def: ControlDef, cat: CatalogControl, value: CatalogValue, current: number): number | null {
  if (cat.type === 'toggle') {
    const want = (value === true) !== (def.invert === true)
    if (def.kind === 'fader') {
      if (want === current > CLOSED_BELOW) return null
      return want ? OPEN_AT : 0
    }
    if (want === current >= 0.5) return null
    return want ? 1 : 0
  }
  const options = cat.options ?? []
  const idx = options.indexOf(String(value))
  if (idx < 0) return null
  if (toCatalog(def, cat, current) === String(value)) return null
  if (def.kind === 'fader' && options.every((o) => optionDb(o) !== null)) {
    const db = optionDb(String(value)) as number
    return db <= -90 ? 0 : controlPosition(def, db)
  }
  const top = Math.max(1, options.length - 1)
  if (def.kind === 'switch') return Math.round((idx / top) * Math.max(1, (def.positions ?? 2) - 1))
  return idx / top
}
