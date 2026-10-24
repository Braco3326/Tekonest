/**
 * View cube keys (designer nav, Task 8): Numpad codes, Ctrl chords for the
 * opposite views. Bindings stay on KeyboardEvent.code (AZERTY-safe, remappable).
 */
import { describe, expect, it } from 'vitest'
import { ACTIONS } from '../../src/input/actions'
import { actionsForCode, CHORD_ACTIONS, chordFor, DEFAULT_BINDINGS, parseBindings } from '../../src/input/bindings'
import { labelFor } from '../../src/input/layoutLabels'

describe('view cube actions and default keys', () => {
  it('exist with the brief keys', () => {
    for (const a of ['VIEW_FACE', 'VIEW_ARRIERE', 'VIEW_DROITE', 'VIEW_GAUCHE', 'VIEW_DESSUS', 'VIEW_ROT_LEFT', 'VIEW_ROT_RIGHT'])
      expect(ACTIONS).toContain(a)
    expect(DEFAULT_BINDINGS.VIEW_FACE).toEqual(['Numpad1'])
    expect(DEFAULT_BINDINGS.VIEW_ARRIERE).toEqual(['Ctrl+Numpad1'])
    expect(DEFAULT_BINDINGS.VIEW_DROITE).toEqual(['Numpad3'])
    expect(DEFAULT_BINDINGS.VIEW_GAUCHE).toEqual(['Ctrl+Numpad3'])
    expect(DEFAULT_BINDINGS.VIEW_DESSUS).toEqual(['Numpad7'])
    expect(DEFAULT_BINDINGS.VIEW_ROT_LEFT).toEqual(['Numpad4'])
    expect(DEFAULT_BINDINGS.VIEW_ROT_RIGHT).toEqual(['Numpad6'])
  })

  it('the modifier matcher: Ctrl+Numpad1 is Arrière only, plain Numpad1 is Face only', () => {
    expect(chordFor({ code: 'Numpad1', ctrlKey: true })).toBe('Ctrl+Numpad1')
    expect(actionsForCode(DEFAULT_BINDINGS, chordFor({ code: 'Numpad1', ctrlKey: true }))).toEqual(['VIEW_ARRIERE'])
    expect(actionsForCode(DEFAULT_BINDINGS, chordFor({ code: 'Numpad1' }))).toEqual(['VIEW_FACE'])
    expect(actionsForCode(DEFAULT_BINDINGS, chordFor({ code: 'Numpad3', ctrlKey: true }))).toEqual(['VIEW_GAUCHE'])
    expect(actionsForCode(DEFAULT_BINDINGS, chordFor({ code: 'Numpad3' }))).toEqual(['VIEW_DROITE'])
    // Ctrl+Alt is another chord: no view fires.
    expect(actionsForCode(DEFAULT_BINDINGS, chordFor({ code: 'Numpad1', ctrlKey: true, altKey: true }))).toEqual([])
  })

  it('chord actions are declared (the remap capture waits past a lone Ctrl)', () => {
    expect(CHORD_ACTIONS).toContain('VIEW_ARRIERE')
    expect(CHORD_ACTIONS).toContain('VIEW_GAUCHE')
  })

  it('stored bindings from before the cube still load (new actions fall back to defaults)', () => {
    const old = { CAMERA_HOME: ['Alt+KeyH'] }
    expect(parseBindings(old).VIEW_ARRIERE).toEqual(['Ctrl+Numpad1'])
  })

  it('labels: "Numpad 1", "Ctrl+Numpad 1" (physical key, as in CONTROLS.md)', () => {
    expect(labelFor('Numpad1', 'azerty')).toBe('Numpad 1')
    expect(labelFor('Ctrl+Numpad1', 'azerty')).toBe('Ctrl+Numpad 1')
    expect(labelFor('Numpad7', 'qwerty')).toBe('Numpad 7')
    // A layout map must not turn the numpad key into a bare digit.
    expect(labelFor('Numpad1', 'azerty', new Map([['Numpad1', '1']]))).toBe('Numpad 1')
  })
})
