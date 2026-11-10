import { describe, expect, it } from 'vitest'
import { fromCatalog, optionDb, toCatalog, type CatalogControl } from '../../src/controls/catalogLink'
import type { ControlDef } from '../../src/controls/controlTypes'
import { faderDb } from '../../src/controls/tapers'

const def = (over: Partial<ControlDef> & { kind: ControlDef['kind'] }): ControlDef => ({ id: 'x', face: 'top', xMm: 0, yMm: 0, sizeMm: { w: 1, h: 1, d: 1 }, axis: 'z', default: 0, ...over })
const toggle: CatalogControl = { id: 'power', type: 'toggle' }
const masterFader: CatalogControl = { id: 'fader-master', type: 'enum', options: ['-inf', '-30', '-20', '-10', '-6', '-3', '0', '+6', '+10'] }
const balance: CatalogControl = { id: 'balance-master', type: 'enum', options: ['G100', 'G50', 'C', 'D50', 'D100'] }

describe('optionDb', () => {
  it('reads dB steps and -inf, refuses anything else', () => {
    expect(optionDb('-inf')).toBe(-90)
    expect(optionDb('+6')).toBe(6)
    expect(optionDb('-30')).toBe(-30)
    expect(optionDb('0')).toBe(0)
    expect(optionDb('G100')).toBeNull()
    expect(optionDb('')).toBeNull()
  })
})

describe('toggle <-> key / switch', () => {
  it('a pressed key is true, and the catalog value moves the key only when they disagree', () => {
    const k = def({ kind: 'button' })
    expect(toCatalog(k, toggle, 1)).toBe(true)
    expect(toCatalog(k, toggle, 0)).toBe(false)
    expect(fromCatalog(k, toggle, true, 0)).toBe(1)
    expect(fromCatalog(k, toggle, false, 1)).toBe(0)
    expect(fromCatalog(k, toggle, true, 1)).toBeNull()
    expect(fromCatalog(k, toggle, false, 0)).toBeNull()
  })
  it('a switch counts as on from its upper position', () => {
    const s = def({ kind: 'switch', positions: 2 })
    expect(toCatalog(s, toggle, 1)).toBe(true)
    expect(toCatalog(s, toggle, 0)).toBe(false)
  })
})

describe('toggle <-> fader (channel open)', () => {
  const f = def({ kind: 'fader', axis: 'y', travelMm: 100 })
  it('open above the bottom of the travel, closed at it', () => {
    expect(toCatalog(f, toggle, 0.8)).toBe(true)
    expect(toCatalog(f, toggle, 0)).toBe(false)
    expect(toCatalog(f, toggle, 0.03)).toBe(false)
  })
  it('opening the channel from the panel lifts a closed fader to nominal; closing drops it; a fader already open is left where it is', () => {
    expect(fromCatalog(f, toggle, true, 0)).toBeCloseTo(0.8, 6)
    expect(fromCatalog(f, toggle, false, 0.5)).toBe(0)
    expect(fromCatalog(f, toggle, true, 0.3)).toBeNull()
    expect(fromCatalog(f, toggle, false, 0)).toBeNull()
  })
})

describe('enum <-> fader with dB steps (master fader)', () => {
  const f = def({ kind: 'fader', axis: 'y', travelMm: 100, taper: 'fader-db' })
  it('takes the nearest step on the console scale', () => {
    expect(toCatalog(f, masterFader, 0.75)).toBe('0')
    expect(toCatalog(f, masterFader, 1)).toBe('+10')
    expect(toCatalog(f, masterFader, 0)).toBe('-inf')
    expect(toCatalog(f, masterFader, 0.5)).toBe('-10')
  })
  it('sends the fader to the step\'s position, and leaves it alone when it already rounds to that step', () => {
    const p = fromCatalog(f, masterFader, '-10', 0.75)!
    expect(faderDb(p)).toBeCloseTo(-10, 6)
    expect(fromCatalog(f, masterFader, '0', 0.76)).toBeNull() // -0.x dB still reads « 0 »
    expect(fromCatalog(f, masterFader, '-inf', 0.5)).toBe(0)
    expect(fromCatalog(f, masterFader, 'unknown', 0.5)).toBeNull()
  })
  it('works on the broadcast scale too (0 dB at 89.8 %)', () => {
    const b = def({ kind: 'fader', axis: 'y', travelMm: 100, taper: 'broadcast-db' })
    expect(toCatalog(b, masterFader, 0.898)).toBe('0')
    expect(fromCatalog(b, masterFader, '0', 0.3)).toBeCloseTo(0.898, 3)
  })
})

describe('enum by index (a knob or a switch)', () => {
  it('a knob spreads the options over its travel', () => {
    const k = def({ kind: 'knob' })
    expect(toCatalog(k, balance, 0)).toBe('G100')
    expect(toCatalog(k, balance, 0.5)).toBe('C')
    expect(toCatalog(k, balance, 1)).toBe('D100')
    expect(fromCatalog(k, balance, 'D50', 0.5)).toBeCloseTo(0.75, 6)
  })
  it('a 3-position switch takes the options by position', () => {
    const s = def({ kind: 'switch', positions: 3 })
    const abc: CatalogControl = { id: 'mode', type: 'enum', options: ['a', 'b', 'c'] }
    expect(toCatalog(s, abc, 2)).toBe('c')
    expect(fromCatalog(s, abc, 'b', 0)).toBe(1)
  })
  it('no options, no value', () => {
    expect(toCatalog(def({ kind: 'knob' }), { id: 'e', type: 'enum' }, 0.5)).toBe('')
  })
})
