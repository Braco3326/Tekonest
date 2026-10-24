import { describe, expect, it } from 'vitest'
import { ACTIONS } from '../../src/input/actions'
import { DEFAULT_BINDINGS, rebind } from '../../src/input/bindings'
import { ACTION_LABELS, controlsHelp, ESSAIS_ACTIONS, MOUSE_HELP, ORBIT_HELP } from '../../src/ui/controlsHelp'

describe('controls help (FR first)', () => {
  it('has a French label for every action', () => {
    for (const a of ACTIONS) expect(ACTION_LABELS[a].fr.length, a).toBeGreaterThan(2)
  })

  it('shows AZERTY keys for the physical WASD block', () => {
    const rows = controlsHelp(DEFAULT_BINDINGS, 'azerty')
    const fwd = rows.find((r) => r.action === 'MOVE_FORWARD')!
    expect(fwd.keys).toEqual(['Z'])
    expect(fwd.label).toBe('Avancer')
    expect(rows.find((r) => r.action === 'MOVE_DOWN')!.keys).toEqual(['A'])
    expect(rows.find((r) => r.action === 'TOGGLE_INVENTORY')!.keys).toEqual(['Espace'])
  })

  it('Essais keys: listed with the panel (G / B), hidden where there is none', () => {
    const all = controlsHelp(DEFAULT_BINDINGS, 'azerty')
    expect(all.find((r) => r.action === 'FREEZE_ESSAI')!.keys).toEqual(['G'])
    expect(all.find((r) => r.action === 'COMPARE_FLIP')!.label).toBe('Comparer : alterner A et B')
    const exam = controlsHelp(DEFAULT_BINDINGS, 'azerty', undefined, ESSAIS_ACTIONS)
    expect(exam.some((r) => ESSAIS_ACTIONS.includes(r.action))).toBe(false)
    expect(exam).toHaveLength(all.length - 2)
  })

  it('reflects remapped keys', () => {
    const rows = controlsHelp(rebind(DEFAULT_BINDINGS, 'RUN', ['KeyC']), 'qwerty')
    expect(rows.find((r) => r.action === 'RUN')!.keys).toEqual(['C'])
  })

  it('lists the Orbit mouse gestures (designer nav): click focus, pan, floor pivot, home', () => {
    const text = ORBIT_HELP.map((r) => `${r.gesture} ${r.action}`).join(' | ')
    expect(text).toContain('Double-clic sur le sol')
    expect(text).toContain('Maj + glisser')
    expect(text).toContain('Ctrl + glisser')
    expect(text).toContain('Alt + H')
    expect(ORBIT_HELP.find((r) => r.gesture.startsWith('Clic sur un appareil'))).toBeDefined()
  })

  it('lists the mouse-only scheme in French', () => {
    expect(MOUSE_HELP.map((m) => m.gesture)).toContain('Clic droit maintenu + glisser vers le haut')
    expect(MOUSE_HELP.some((m) => m.action.includes('Zoom'))).toBe(true)
  })
})
