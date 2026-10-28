import { describe, expect, it } from 'vitest'
import {
  CREATION_ACTIONS,
  DEFAULT_CREATION_BINDINGS,
  bindingLabel,
  chordsFor,
  creationActionsFor,
  loadCreationBindings,
} from '../../src/creation/input/creationActions'

const D = DEFAULT_CREATION_BINDINGS

/** A minimal in-memory Storage. */
function storage(items: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(items))
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  }
}

describe('creation key map (Task 8, P3)', () => {
  it('Ctrl+Z follows the labelled key: AZERTY (code KeyW, key z) and QWERTY both undo', () => {
    expect(creationActionsFor(D, { code: 'KeyW', key: 'z', ctrlKey: true })).toEqual(['UNDO'])
    expect(creationActionsFor(D, { code: 'KeyZ', key: 'z', ctrlKey: true })).toEqual(['UNDO'])
  })
  it('Ctrl+Shift+Z and Ctrl+Y redo', () => {
    expect(creationActionsFor(D, { code: 'KeyZ', key: 'Z', ctrlKey: true, shiftKey: true })).toEqual(['REDO'])
    expect(creationActionsFor(D, { code: 'KeyY', key: 'y', ctrlKey: true })).toEqual(['REDO'])
  })
  it('spatial keys bind by code: the AZERTY $ key (BracketRight) is NEXT_DEVICE', () => {
    expect(creationActionsFor(D, { code: 'BracketRight', key: '$' })).toEqual(['NEXT_DEVICE'])
    expect(creationActionsFor(D, { code: 'BracketLeft', key: '^' })).toEqual(['PREV_DEVICE'])
  })
  it('the labelled [ and ] characters also cycle (AZERTY AltGr+( / AltGr+) reports Ctrl+Alt)', () => {
    expect(creationActionsFor(D, { code: 'Minus', key: ']', ctrlKey: true, altKey: true })).toEqual(['NEXT_DEVICE'])
    expect(creationActionsFor(D, { code: 'Digit5', key: '[', ctrlKey: true, altKey: true })).toEqual(['PREV_DEVICE'])
  })
  it('Shift is a chord prefix: Shift+V walks, V alone opens the view picker; R / Shift+R rotate', () => {
    expect(creationActionsFor(D, { code: 'KeyV', key: 'V', shiftKey: true })).toEqual(['WALK_TOGGLE'])
    expect(creationActionsFor(D, { code: 'KeyV', key: 'v' })).toEqual(['VIEW_PICKER'])
    expect(creationActionsFor(D, { code: 'KeyR', key: 'r' })).toEqual(['ROTATE_CW'])
    expect(creationActionsFor(D, { code: 'KeyR', key: 'R', shiftKey: true })).toEqual(['ROTATE_CCW'])
  })
  it('Alt is the free modifier: Alt+R and Alt+Shift+R also rotate (1°); the labels stay R and Maj+R', () => {
    expect(creationActionsFor(D, { code: 'KeyR', key: 'r', altKey: true })).toEqual(['ROTATE_CW'])
    expect(creationActionsFor(D, { code: 'KeyR', key: 'R', altKey: true, shiftKey: true })).toEqual(['ROTATE_CCW'])
    expect(bindingLabel(D, 'ROTATE_CW')).toBe('R')
    expect(bindingLabel(D, 'ROTATE_CCW')).toBe('Maj+R')
  })
  it('Ctrl+D follows the labelled key (like Ctrl+Z), Suppr is the Delete key', () => {
    expect(creationActionsFor(D, { code: 'KeyD', key: 'd', ctrlKey: true })).toEqual(['DUPLICATE'])
    expect(creationActionsFor(D, { code: 'KeyE', key: 'd', ctrlKey: true })).toEqual(['DUPLICATE']) // another layout
    expect(creationActionsFor(D, { code: 'KeyD', key: 'e', ctrlKey: true })).toEqual([])
    expect(creationActionsFor(D, { code: 'Delete', key: 'Delete' })).toEqual(['DELETE'])
    expect(bindingLabel(D, 'DUPLICATE')).toBe('Ctrl+D')
  })
  it('Tab never maps to an action', () => {
    expect(creationActionsFor(D, { code: 'Tab', key: 'Tab' })).toEqual([])
    expect(creationActionsFor(D, { code: 'Tab', key: 'Tab', shiftKey: true })).toEqual([])
  })
  it('chordsFor gives the code chord and the key chord, modifiers in Ctrl+Alt+Meta+Shift order', () => {
    expect(chordsFor({ code: 'KeyW', key: 'z', ctrlKey: true })).toEqual(['Ctrl+KeyW', 'Ctrl+key:z'])
    expect(chordsFor({ code: 'KeyZ', key: 'Z', ctrlKey: true, altKey: true, metaKey: true, shiftKey: true })).toEqual([
      'Ctrl+Alt+Meta+Shift+KeyZ',
      'Ctrl+Alt+Meta+Shift+key:z',
    ])
  })
  it('every action has a default binding', () => {
    for (const a of CREATION_ACTIONS) expect(D[a].length, a).toBeGreaterThan(0)
    expect(D.CAMERA_PRESET_2).toEqual(['Digit2'])
    expect(D.CANCEL).toEqual(['Escape'])
  })
  it('loading bindings that try to rebind Tab keeps the defaults; garbage is tolerated', () => {
    const s = storage({ 'audio-sim/creation-bindings.v1': JSON.stringify({ NEXT_DEVICE: ['Tab'], UNDO: ['Enter'] }) })
    const b = loadCreationBindings(s)
    expect(b.NEXT_DEVICE).toEqual(D.NEXT_DEVICE)
    expect(b.UNDO).toEqual(D.UNDO)
    expect(loadCreationBindings(storage({ 'audio-sim/creation-bindings.v1': '{not json' }))).toEqual(D)
    expect(loadCreationBindings(null)).toEqual(D)
  })
  it('a valid stored rebinding is kept, and CANCEL stays Escape', () => {
    const s = storage({ 'audio-sim/creation-bindings.v1': JSON.stringify({ FRAME_SELECTION: ['KeyG'], CANCEL: ['KeyQ'] }) })
    const b = loadCreationBindings(s)
    expect(b.FRAME_SELECTION).toEqual(['KeyG'])
    expect(b.CANCEL).toEqual(['Escape'])
  })
  it('French labels', () => {
    expect(bindingLabel(D, 'DELETE')).toBe('Suppr')
    expect(bindingLabel(D, 'UNDO')).toBe('Ctrl+Z')
    expect(bindingLabel(D, 'REDO')).toBe('Ctrl+Y')
    expect(bindingLabel(D, 'TOGGLE_INVENTORY')).toBe('Espace')
    expect(bindingLabel(D, 'PREV_DEVICE')).toBe('[')
    expect(bindingLabel(D, 'NEXT_DEVICE')).toBe(']')
    expect(bindingLabel(D, 'WALK_TOGGLE')).toBe('Maj+V')
    expect(bindingLabel(D, 'CAMERA_HOME')).toBe('Alt+H')
    expect(bindingLabel(D, 'CAMERA_PRESET_1')).toBe('1')
    expect(bindingLabel(D, 'CANCEL')).toBe('Échap')
  })
})
