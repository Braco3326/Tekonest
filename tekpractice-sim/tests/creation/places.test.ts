import { describe, expect, it } from 'vitest'
import { placeFromKey, placeKey, type PlaceRef } from '../../src/creation/places'

describe('placeKey / placeFromKey (C3, stored in DesignState.roomId)', () => {
  const cases: [PlaceRef, string][] = [
    [{ kind: 'room', id: 'concert-hall-medium' }, 'room:concert-hall-medium'],
    [{ kind: 'set', envId: 'theatre' }, 'set:theatre'],
    [{ kind: 'set', envId: 'plateau' }, 'set:plateau'],
    [{ kind: 'set', envId: 'radio' }, 'set:radio'],
    [{ kind: 'blank' }, 'blank'],
  ]
  it.each(cases)('%o <-> %s round-trips', (place, key) => {
    expect(placeKey(place)).toBe(key)
    expect(placeFromKey(key)).toEqual(place)
    expect(placeKey(placeFromKey(placeKey(place)))).toBe(key)
  })
  it('null is the blank place', () => {
    expect(placeFromKey(null)).toEqual({ kind: 'blank' })
  })
  it('an unknown key is the blank place', () => {
    for (const k of ['', 'nope', 'set:studio', 'set:', 'room:', 'room', 'blank:x', 'ROOM:x'])
      expect(placeFromKey(k), k).toEqual({ kind: 'blank' })
  })
})
