import { describe, expect, it } from 'vitest'
import { ACTIONS } from '../../src/input/actions'
import { DEFAULT_BINDINGS, rebind } from '../../src/input/bindings'
import { ACTION_LABELS, controlsHelp, MOUSE_HELP } from '../../src/ui/controlsHelp'

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

  it('reflects remapped keys', () => {
    const rows = controlsHelp(rebind(DEFAULT_BINDINGS, 'RUN', ['KeyC']), 'qwerty')
    expect(rows.find((r) => r.action === 'RUN')!.keys).toEqual(['C'])
  })

  it('lists the mouse-only scheme in French', () => {
    expect(MOUSE_HELP.map((m) => m.gesture)).toContain('Clic droit maintenu + glisser vers le haut')
    expect(MOUSE_HELP.some((m) => m.action.includes('Zoom'))).toBe(true)
  })
})
