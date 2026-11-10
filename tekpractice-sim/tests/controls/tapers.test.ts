import { describe, expect, it } from 'vitest'
import { faderDb, faderPosition, valueText } from '../../src/controls/tapers'
import type { ControlDef } from '../../src/controls/controlTypes'

const def = (over: Partial<ControlDef>): ControlDef => ({ id: 'x', kind: 'fader', face: 'top', xMm: 0, yMm: 0, sizeMm: { w: 1, h: 1, d: 1 }, axis: 'y', default: 0, ...over })

describe('fader taper', () => {
  it('puts 0 dB at three quarters, +10 at the top, -inf at the bottom', () => {
    expect(faderDb(0.75)).toBeCloseTo(0, 6)
    expect(faderDb(1)).toBeCloseTo(10, 6)
    expect(faderDb(0)).toBe(-Infinity)
    expect(faderDb(0.5)).toBeCloseTo(-10, 6)
  })
  it('is monotonic and its inverse round-trips', () => {
    let prev = -Infinity
    for (let v = 0.01; v <= 1; v += 0.01) {
      const db = faderDb(v)
      expect(db).toBeGreaterThan(prev)
      prev = db
      expect(faderPosition(db)).toBeCloseTo(v, 6)
    }
    expect(faderPosition(-Infinity)).toBe(0)
    expect(faderPosition(40)).toBe(1)
  })
})

describe('valueText', () => {
  it('reads dB on a fader, with the minus sign and -inf', () => {
    expect(valueText(def({ taper: 'fader-db' }), 0.75)).toBe('0.0 dB')
    expect(valueText(def({ taper: 'fader-db' }), 0.5)).toBe('−10.0 dB')
    expect(valueText(def({ taper: 'fader-db' }), 1)).toBe('+10.0 dB')
    expect(valueText(def({ taper: 'fader-db' }), 0)).toBe('−∞ dB')
  })
  it('reads the broadcast scale: 0 dB at 89.8 % of the travel', () => {
    expect(valueText(def({ taper: 'broadcast-db' }), 0.898)).toBe('0.0 dB')
  })
  it('reads a linear range, a button, a switch and a plain percentage', () => {
    expect(valueText(def({ kind: 'knob', range: { min: -20, max: 60, unit: 'dB' } }), 0.5)).toBe('+20.0 dB')
    expect(valueText(def({ kind: 'knob', range: { min: 20, max: 20000, unit: 'Hz' } }), 1)).toBe('20000 Hz')
    expect(valueText(def({ kind: 'button' }), 1)).toBe('ON')
    expect(valueText(def({ kind: 'switch', positions: 3 }), 2)).toBe('3 / 3')
    expect(valueText(def({ kind: 'knob' }), 0.5)).toBe('50 %')
  })
})
