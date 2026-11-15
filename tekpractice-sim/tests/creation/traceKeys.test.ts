/**
 * Mission 3 B stage 2: the keys of a tracing and of a selected cable's points (spec §2: full keyboard). They must not clash with the existing key map: the only
 * overlaps are Échap (CANCEL: the same meaning, « annuler ») and, in the points zone of Propriétés, Suppr (DELETE acts only on the 3D view, so it never deletes a
 * device from there). They act only while tracing; none is a character key (WCAG 2.1.4 stays as it is). The shortcuts list names them in their own group.
 */
import { describe, expect, it } from 'vitest'
import { COPY } from '../../src/creation/copy'
import { CREATION_ACTIONS, DEFAULT_CREATION_BINDINGS, creationActionsFor } from '../../src/creation/input/creationActions'
import { CANVAS_ONLY, isPlainCharacterChord } from '../../src/creation/input/keyboard'
import { POINT_ZONE_CHORDS, TRACE_CHORDS, arrowToGrid, traceKeyOf } from '../../src/creation/input/traceKeys'
import { shortcutGroups } from '../../src/creation/shell/shortcutsModel'

const ev = (chord: string) => {
  const parts = chord.split('+')
  const code = parts.pop()!
  const key = code === 'NumpadEnter' ? 'Enter' : code
  return { code, key, shiftKey: parts.includes('Shift'), ctrlKey: false, altKey: false, metaKey: false }
}

describe('traceKeyOf', () => {
  it('maps the arrows, Entrée, Maj+Entrée, Retour arrière and Échap', () => {
    expect(traceKeyOf(ev('ArrowLeft'))).toEqual({ kind: 'arrow', key: 'ArrowLeft', big: false })
    expect(traceKeyOf(ev('Shift+ArrowUp'))).toEqual({ kind: 'arrow', key: 'ArrowUp', big: true })
    expect(traceKeyOf(ev('Enter'))).toEqual({ kind: 'place' })
    expect(traceKeyOf(ev('NumpadEnter'))).toEqual({ kind: 'place' })
    expect(traceKeyOf(ev('Shift+Enter'))).toEqual({ kind: 'finish' })
    expect(traceKeyOf(ev('Backspace'))).toEqual({ kind: 'remove' })
    expect(traceKeyOf(ev('Escape'))).toEqual({ kind: 'cancel' })
  })
  it('leaves every other key alone, and every key with Ctrl, Alt or Meta (Ctrl+Z stays the undo)', () => {
    for (const code of ['KeyZ', 'Space', 'Delete', 'Tab', 'KeyF', 'Digit1', 'BracketLeft', 'PageUp'])
      expect(traceKeyOf({ code, key: code, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false }), code).toBeNull()
    expect(traceKeyOf({ ...ev('Enter'), ctrlKey: true })).toBeNull()
    expect(traceKeyOf({ ...ev('ArrowLeft'), altKey: true })).toBeNull()
    expect(traceKeyOf({ ...ev('Backspace'), metaKey: true })).toBeNull()
    expect(traceKeyOf(ev('Shift+Backspace'))).toBeNull()
  })
})

describe('no clash with the key map', () => {
  it('every tracing chord is bound to no action of the default map, except Échap = CANCEL (same meaning)', () => {
    for (const chord of TRACE_CHORDS) {
      const actions = creationActionsFor(DEFAULT_CREATION_BINDINGS, ev(chord))
      expect(actions, chord).toEqual(chord === 'Escape' ? ['CANCEL'] : [])
    }
  })
  it('the points zone keys: Page préc. / Page suiv. and the arrows are free; Suppr is DELETE, which acts only on the 3D view (never from Propriétés)', () => {
    for (const chord of POINT_ZONE_CHORDS) {
      const actions = creationActionsFor(DEFAULT_CREATION_BINDINGS, ev(chord))
      expect(actions, chord).toEqual(chord === 'Delete' ? ['DELETE'] : [])
    }
    expect(CANVAS_ONLY.has('DELETE')).toBe(true)
  })
  it('none is a character key (WCAG 2.1.4)', () => {
    for (const chord of [...TRACE_CHORDS, ...POINT_ZONE_CHORDS]) expect(isPlainCharacterChord(chord), chord).toBe(false)
  })
  it('no existing action is bound to Retour arrière, Page préc. or Page suiv. (so none is shadowed while tracing)', () => {
    const all = CREATION_ACTIONS.flatMap((a) => DEFAULT_CREATION_BINDINGS[a])
    for (const k of ['Backspace', 'PageUp', 'PageDown', 'Shift+Enter', 'key:Backspace']) expect(all.some((c) => c === k || c.endsWith(`+${k}`)), k).toBe(false)
  })
})

describe('arrowToGrid: the arrows move as seen from the camera, one room axis at a time', () => {
  it('camera on the -z side looking +z (alpha = -π/2): up = +z, right = +x', () => {
    expect(arrowToGrid('ArrowUp', -Math.PI / 2)).toEqual({ dx: 0, dz: 1 })
    expect(arrowToGrid('ArrowDown', -Math.PI / 2)).toEqual({ dx: 0, dz: -1 })
    expect(arrowToGrid('ArrowRight', -Math.PI / 2)).toEqual({ dx: 1, dz: 0 })
    expect(arrowToGrid('ArrowLeft', -Math.PI / 2)).toEqual({ dx: -1, dz: 0 })
  })
  it('camera on the +x side (alpha = 0): up = -x, right = +z', () => {
    expect(arrowToGrid('ArrowUp', 0)).toEqual({ dx: -1, dz: 0 })
    expect(arrowToGrid('ArrowRight', 0)).toEqual({ dx: 0, dz: 1 })
  })
  it('a diagonal view snaps to the nearer axis, and every result is one step on one axis', () => {
    for (let a = -7; a <= 7; a += 0.37)
      for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const) {
        const g = arrowToGrid(k, a)
        expect(Math.abs(g.dx) + Math.abs(g.dz), `${k} at ${a}`).toBe(1)
      }
  })
})

describe('the « Raccourcis clavier » list', () => {
  it('has no cable group when the feature is off (the list as it was)', () => {
    expect(shortcutGroups(DEFAULT_CREATION_BINDINGS).map((g) => g.id)).toEqual(['view', 'devices', 'project'])
  })
  it('with the feature on: its own group, after the devices, naming every key of a tracing and of the points', () => {
    const g = shortcutGroups(DEFAULT_CREATION_BINDINGS, { cables: true })
    expect(g.map((x) => x.id)).toEqual(['view', 'devices', 'cables', 'project'])
    const cables = g.find((x) => x.id === 'cables')!
    const S = COPY.shortcuts!
    const K = COPY.keys!
    expect(cables.title).toBe(S.groupCables)
    const keys = Object.fromEntries(cables.rows.map((r) => [r.id, r.keys]))
    expect(keys).toEqual({
      'trace-cursor': [S.keyArrows, S.keyShiftArrows],
      'trace-place': [K.enter],
      'trace-remove': [K.backspace],
      'trace-finish': [`${K.shift}+${K.enter}`],
      'trace-cancel': [K.escape],
      'point-move': [S.keyArrows],
      'point-next': [K.pageDown, K.pageUp],
      'point-delete': [K.delete],
    })
    for (const r of cables.rows) expect(r.name, r.id).toBeTruthy()
  })
})
