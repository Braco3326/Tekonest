import { describe, expect, it } from 'vitest'
import { ACTIONS } from '../../src/input/actions'
import {
  actionsForCode,
  DEFAULT_BINDINGS,
  parseBindings,
  rebind,
  serializeBindings,
} from '../../src/input/bindings'
import { KeyboardState } from '../../src/input/keyboardState'
import { DRAG_THRESHOLD_PX, MouseGesture } from '../../src/input/mouseGesture'
import { detectLayout, labelFor } from '../../src/input/layoutLabels'

describe('bindings (KeyboardEvent.code = physical position)', () => {
  it('maps the WASD positions to movement on every layout', () => {
    expect(actionsForCode(DEFAULT_BINDINGS, 'KeyW')).toContain('MOVE_FORWARD')
    expect(actionsForCode(DEFAULT_BINDINGS, 'KeyA')).toContain('STRAFE_LEFT')
    expect(actionsForCode(DEFAULT_BINDINGS, 'KeyS')).toContain('MOVE_BACK')
    expect(actionsForCode(DEFAULT_BINDINGS, 'KeyD')).toContain('STRAFE_RIGHT')
  })

  it('maps Space to the inventory (never jump) and Q/E to down/up', () => {
    expect(actionsForCode(DEFAULT_BINDINGS, 'Space')).toEqual(['TOGGLE_INVENTORY'])
    expect(actionsForCode(DEFAULT_BINDINGS, 'KeyQ')).toContain('MOVE_DOWN')
    expect(actionsForCode(DEFAULT_BINDINGS, 'KeyE')).toContain('MOVE_UP')
    expect(actionsForCode(DEFAULT_BINDINGS, 'ShiftLeft')).toContain('RUN')
    expect(actionsForCode(DEFAULT_BINDINGS, 'ShiftRight')).toContain('RUN')
  })

  it('binds every action to at least one key', () => {
    for (const a of ACTIONS) expect(DEFAULT_BINDINGS[a].length, a).toBeGreaterThan(0)
  })

  it('rebinds an action and removes the code from any other action', () => {
    const b = rebind(DEFAULT_BINDINGS, 'MOVE_FORWARD', ['ArrowUp'])
    expect(b.MOVE_FORWARD).toEqual(['ArrowUp'])
    expect(actionsForCode(b, 'KeyW')).toEqual([])
    expect(actionsForCode(b, 'ArrowUp')).toEqual(['MOVE_FORWARD'])
    expect(DEFAULT_BINDINGS.MOVE_FORWARD).toContain('KeyW') // pure: input untouched
  })

  it('round-trips through serialize/parse and repairs unknown or missing actions', () => {
    const b = rebind(DEFAULT_BINDINGS, 'RUN', ['KeyC'])
    expect(parseBindings(serializeBindings(b))).toEqual(b)
    const partial = parseBindings({ RUN: ['KeyC'], NOT_AN_ACTION: ['KeyZ'] })
    expect(partial.RUN).toEqual(['KeyC'])
    expect(partial.MOVE_FORWARD).toEqual(DEFAULT_BINDINGS.MOVE_FORWARD)
    expect(parseBindings('garbage')).toEqual(DEFAULT_BINDINGS)
  })
})

describe('KeyboardState', () => {
  it('holds an action while its key is down', () => {
    const k = new KeyboardState(DEFAULT_BINDINGS)
    k.keyDown('KeyW')
    expect(k.held('MOVE_FORWARD')).toBe(true)
    k.keyUp('KeyW')
    expect(k.held('MOVE_FORWARD')).toBe(false)
  })

  it('keeps an action held while a second key for it is still down', () => {
    const k = new KeyboardState(DEFAULT_BINDINGS)
    k.keyDown('ShiftLeft')
    k.keyDown('ShiftRight')
    k.keyUp('ShiftLeft')
    expect(k.held('RUN')).toBe(true)
  })

  it('emits a pressed edge once per physical press (key repeat ignored)', () => {
    const k = new KeyboardState(DEFAULT_BINDINGS)
    k.keyDown('Space')
    k.keyDown('Space') // auto-repeat
    expect(k.consumePressed()).toEqual(['TOGGLE_INVENTORY'])
    expect(k.consumePressed()).toEqual([])
    k.keyUp('Space')
    k.keyDown('Space')
    expect(k.consumePressed()).toEqual(['TOGGLE_INVENTORY'])
  })

  it('reset() releases everything (window blur / alt-tab never leaves you walking)', () => {
    const k = new KeyboardState(DEFAULT_BINDINGS)
    k.keyDown('KeyW')
    k.keyDown('KeyD')
    k.reset()
    expect(k.held('MOVE_FORWARD')).toBe(false)
    expect(k.held('STRAFE_RIGHT')).toBe(false)
    expect(k.anyMovementUsed).toBe(true) // the session flag survives a blur
  })

  it('flags movement use (drives the auto pointer-lock decision)', () => {
    const k = new KeyboardState(DEFAULT_BINDINGS)
    k.keyDown('Space')
    expect(k.anyMovementUsed).toBe(false)
    k.keyDown('KeyS')
    expect(k.anyMovementUsed).toBe(true)
  })
})

describe('MouseGesture', () => {
  it('uses Babylon’s drag threshold so a gesture is never both tap and drag', () => {
    expect(DRAG_THRESHOLD_PX).toBe(10)
  })

  it('treats a release below the threshold as a click', () => {
    const g = new MouseGesture()
    g.down(0, 100, 100)
    expect(g.move(104, 103)).toEqual({ kind: 'none', dx: 0, dy: 0 })
    expect(g.up(104, 103)).toBe('click')
  })

  it('left drag beyond the threshold looks, and never ends in a click', () => {
    const g = new MouseGesture()
    g.down(0, 100, 100)
    expect(g.move(115, 100)).toEqual({ kind: 'look', dx: 15, dy: 0 })
    expect(g.move(120, 98)).toEqual({ kind: 'look', dx: 5, dy: -2 })
    expect(g.up(100, 100)).toBe('drag-end')
  })

  it('right drag moves (dy = forward/back, dx = strafe)', () => {
    const g = new MouseGesture()
    g.down(2, 50, 50)
    expect(g.move(50, 30)).toEqual({ kind: 'move', dx: 0, dy: -20 })
    expect(g.up(50, 30)).toBe('drag-end')
  })

  it('ignores middle button and moves without a press', () => {
    const g = new MouseGesture()
    expect(g.move(10, 10)).toEqual({ kind: 'none', dx: 0, dy: 0 })
    g.down(1, 0, 0)
    expect(g.move(50, 50)).toEqual({ kind: 'none', dx: 0, dy: 0 })
    expect(g.up(50, 50)).toBeNull()
  })
})

describe('layout labels', () => {
  it('shows AZERTY letters for the physical WASD/QE positions', () => {
    expect(labelFor('KeyW', 'azerty')).toBe('Z')
    expect(labelFor('KeyA', 'azerty')).toBe('Q')
    expect(labelFor('KeyQ', 'azerty')).toBe('A')
    expect(labelFor('KeyE', 'azerty')).toBe('E')
    expect(labelFor('KeyW', 'qwerty')).toBe('W')
  })

  it('names special keys in French', () => {
    expect(labelFor('Space', 'azerty')).toBe('Espace')
    expect(labelFor('ShiftLeft', 'qwerty')).toBe('Maj')
    expect(labelFor('Escape', 'azerty')).toBe('Échap')
    expect(labelFor('ArrowLeft', 'azerty')).toBe('←')
  })

  it('prefers the browser layout map when available', () => {
    const map = new Map([['KeyW', 'z']])
    expect(labelFor('KeyW', 'qwerty', map)).toBe('Z')
  })

  it('detects AZERTY from a French locale', () => {
    expect(detectLayout('fr-FR')).toBe('azerty')
    expect(detectLayout('fr-CA')).toBe('qwerty') // Canadian French is QWERTY
    expect(detectLayout('en-US')).toBe('qwerty')
    expect(detectLayout('fr-BE')).toBe('azerty')
  })
})
