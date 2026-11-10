import { describe, expect, it, vi } from 'vitest'
import { ControlBank, normaliseValue } from '../../src/controls/controlBank'
import type { ControlDef } from '../../src/controls/controlTypes'

const d = (over: Partial<ControlDef> & { id: string }): ControlDef => ({ kind: 'knob', face: 'top', xMm: 0, yMm: 0, sizeMm: { w: 1, h: 1, d: 1 }, axis: 'z', default: 0, ...over })

describe('ControlBank', () => {
  const defs = [d({ id: 'f', kind: 'fader', axis: 'y', travelMm: 100, default: 0.75 }), d({ id: 'b', kind: 'button', default: 1 }), d({ id: 's', kind: 'switch', positions: 3 }), d({ id: 'n' })]

  it('starts at the defaults', () => {
    const bank = new ControlBank(defs)
    expect(bank.snapshot()).toEqual({ f: 0.75, b: 1, s: 0, n: 0 })
  })

  it('clamps a fader / knob, snaps a button to 0 / 1 and a switch to a valid index, ignores NaN', () => {
    const bank = new ControlBank(defs)
    bank.set('f', 5)
    bank.set('n', -2)
    bank.set('b', 0.2)
    bank.set('s', 9)
    expect(bank.snapshot()).toEqual({ f: 1, b: 0, s: 2, n: 0 })
    bank.set('f', Number.NaN)
    expect(bank.get('f')).toBe(0.75) // NaN falls back to the default
    expect(normaliseValue(defs[1], 0.5)).toBe(1)
  })

  it('notifies once per real change, with the origin, and the unsubscribe stops it', () => {
    const bank = new ControlBank(defs)
    const fn = vi.fn()
    const off = bank.subscribe(fn)
    expect(bank.set('f', 0.75)).toBe(false) // unchanged
    expect(bank.set('nope', 1)).toBe(false) // unknown
    expect(fn).not.toHaveBeenCalled()
    expect(bank.set('f', 0.5, 'user')).toBe(true)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('f', 0.5, 'user')
    off()
    bank.set('f', 0.6)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('reset returns to the default with origin reset; restore applies stored values and skips unknown ids', () => {
    const bank = new ControlBank(defs)
    const fn = vi.fn()
    bank.subscribe(fn)
    bank.set('f', 0.1)
    bank.reset('f')
    expect(bank.get('f')).toBe(0.75)
    expect(fn).toHaveBeenLastCalledWith('f', 0.75, 'reset')
    bank.restore({ f: 0.3, ghost: 1 })
    expect(bank.get('f')).toBe(0.3)
  })

  it('radio group: pressing one key releases the others of its group, not other keys', () => {
    const bank = new ControlBank([
      d({ id: 'on', kind: 'button', group: 'ch1', default: 1 }),
      d({ id: 'off', kind: 'button', group: 'ch1' }),
      d({ id: 'solo', kind: 'button' }),
      d({ id: 'other-on', kind: 'button', group: 'ch2', default: 1 }),
    ])
    const fn = vi.fn()
    bank.subscribe(fn)
    bank.set('off', 1, 'user')
    expect(bank.snapshot()).toEqual({ on: 0, off: 1, solo: 0, 'other-on': 1 })
    expect(fn).toHaveBeenCalledWith('on', 0, 'user')
  })
})

describe('detented knobs', () => {
  it('a knob with detents sits only on its clicks (an enum with 5 options: 0, .25, .5, .75, 1)', () => {
    const bank = new ControlBank([d({ id: 'pan', detents: 5, default: 0.5 })])
    bank.set('pan', 0.36)
    expect(bank.get('pan')).toBe(0.25)
    bank.set('pan', 0.4)
    expect(bank.get('pan')).toBe(0.5)
    bank.set('pan', 9)
    expect(bank.get('pan')).toBe(1)
    expect(normaliseValue(d({ id: 'x', detents: 2 }), 0.4)).toBe(0)
  })
})
