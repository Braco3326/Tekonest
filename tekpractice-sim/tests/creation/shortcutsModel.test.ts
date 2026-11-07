/**
 * Night 2 wave 5, P2-1: the « Raccourcis clavier » list is built from the live key map. It names every key the 3D view's label promises, follows a rebound action, and leaves out
 * an action that has no key.
 */
import { describe, expect, it } from 'vitest'
import { COPY } from '../../src/creation/copy'
import { DEFAULT_CREATION_BINDINGS, parseCreationBindings } from '../../src/creation/input/creationActions'
import { shortcutGroups } from '../../src/creation/shell/shortcutsModel'

const rows = (b = DEFAULT_CREATION_BINDINGS) => shortcutGroups(b).flatMap((g) => g.rows)
const keysOf = (id: string, b = DEFAULT_CREATION_BINDINGS): string[] | undefined => rows(b).find((r) => r.id === id)?.keys

describe('shortcut groups', () => {
  it('has the three groups, each with its rows, with French titles from COPY', () => {
    const g = shortcutGroups(DEFAULT_CREATION_BINDINGS)
    expect(g.map((x) => x.title)).toEqual([COPY.shortcuts!.groupView, COPY.shortcuts!.groupDevices, COPY.shortcuts!.groupProject])
    for (const x of g) expect(x.rows.length).toBeGreaterThan(2)
  })

  it('names the keys of the 3D view label: arrows, [ ], Entrée, 1 2 3, G, Échap, Ctrl+Z', () => {
    expect(keysOf('orbit')).toEqual(['Flèches'])
    expect(keysOf('next')).toEqual([']'])
    expect(keysOf('prev')).toEqual(['['])
    expect(keysOf('frame')).toEqual(['F', 'Entrée'])
    expect(keysOf('points')).toEqual(['1', '2', '3'])
    expect(keysOf('snap')).toEqual(['G'])
    expect(keysOf('cancel')).toEqual(['Échap'])
    expect(keysOf('undo')).toEqual(['Ctrl+Z'])
    expect(keysOf('help')).toEqual(['H'])
    expect(keysOf('quarter-left')).toEqual(['Pavé num. 4'])
    expect(keysOf('walk')).toEqual(['Maj+V'])
  })

  it('every row has a name and at least one key, and no key label is empty', () => {
    for (const r of rows()) {
      expect(r.name, r.id).not.toBe('')
      expect(r.keys.length, r.id).toBeGreaterThan(0)
      for (const k of r.keys) expect(k, r.id).not.toBe('')
    }
  })

  it('follows a rebound action (the label is the live one), and an AZERTY chord shows the printed letter', () => {
    const b = parseCreationBindings({ UNDO: ['Ctrl+key:u'], FRAME_SELECTION: ['KeyK'] })
    expect(keysOf('undo', b)).toEqual(['Ctrl+U'])
    expect(keysOf('frame', b)).toEqual(['K', 'Entrée'])
  })

  it('leaves out an action that has no key, and keeps the fixed key of a row that still has one', () => {
    const b = { ...DEFAULT_CREATION_BINDINGS, DELETE: [], FRAME_SELECTION: [] }
    expect(keysOf('delete', b)).toBeUndefined()
    expect(keysOf('frame', b)).toEqual(['Entrée'])
  })
})
