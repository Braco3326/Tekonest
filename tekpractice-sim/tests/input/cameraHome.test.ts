/**
 * CAMERA_HOME = Alt+H (Task 4). Plain H stays TOGGLE_HELP; the chord is a
 * remappable binding string 'Alt+KeyH' (physical code, AZERTY-safe).
 */
import { describe, expect, it } from 'vitest'
import { ACTIONS } from '../../src/input/actions'
import {
  actionsForCode,
  chordFor,
  DEFAULT_BINDINGS,
  isModifierCode,
  parseBindings,
  rebind,
} from '../../src/input/bindings'
import { labelFor } from '../../src/input/layoutLabels'
import { ACTION_LABELS, controlsHelp } from '../../src/ui/controlsHelp'

describe('CAMERA_HOME (Alt+H)', () => {
  it('is an action, bound to Alt+KeyH by default', () => {
    expect(ACTIONS).toContain('CAMERA_HOME')
    expect(DEFAULT_BINDINGS.CAMERA_HOME).toEqual(['Alt+KeyH'])
  })

  it('plain H stays help, Alt+H is home only', () => {
    expect(actionsForCode(DEFAULT_BINDINGS, chordFor({ code: 'KeyH' }))).toEqual(['TOGGLE_HELP'])
    expect(actionsForCode(DEFAULT_BINDINGS, chordFor({ code: 'KeyH', altKey: true }))).toEqual(['CAMERA_HOME'])
  })

  it('chordFor: modifiers prefix the physical code; Shift is not a chord (RUN)', () => {
    expect(chordFor({ code: 'KeyH', altKey: true })).toBe('Alt+KeyH')
    expect(chordFor({ code: 'KeyH', ctrlKey: true, altKey: true })).toBe('Ctrl+Alt+KeyH')
    expect(chordFor({ code: 'KeyH', shiftKey: true })).toBe('KeyH')
    expect(chordFor({ code: 'AltLeft', altKey: true })).toBe('AltLeft') // the modifier key itself
  })

  it('isModifierCode', () => {
    for (const c of ['AltLeft', 'AltRight', 'ControlLeft', 'MetaRight', 'ShiftLeft']) expect(isModifierCode(c)).toBe(true)
    expect(isModifierCode('KeyH')).toBe(false)
  })

  it('remappable, and a saved chord survives a reload', () => {
    const b = rebind(DEFAULT_BINDINGS, 'CAMERA_HOME', ['Alt+KeyJ'])
    expect(b.CAMERA_HOME).toEqual(['Alt+KeyJ'])
    expect(b.TOGGLE_HELP).toEqual(['KeyH'])
    expect(parseBindings(JSON.parse(JSON.stringify(b))).CAMERA_HOME).toEqual(['Alt+KeyJ'])
  })

  it('an old save without CAMERA_HOME gets the default', () => {
    const { CAMERA_HOME: _drop, ...old } = DEFAULT_BINDINGS
    expect(parseBindings(old).CAMERA_HOME).toEqual(['Alt+KeyH'])
  })

  it('labels: « Alt+H » on any layout; FR row « Vue d’ensemble » from the copy deck', () => {
    expect(labelFor('Alt+KeyH', 'azerty')).toBe('Alt+H')
    expect(labelFor('Alt+KeyW', 'azerty')).toBe('Alt+Z')
    expect(ACTION_LABELS.CAMERA_HOME.fr).toBe("Vue d'ensemble")
    expect(controlsHelp(DEFAULT_BINDINGS, 'qwerty').find((r) => r.action === 'CAMERA_HOME')!.keys).toEqual(['Alt+H'])
  })
})
