import { describe, expect, it } from 'vitest'
import { nextDevice } from '../../src/creation/deviceCycle'

describe('nextDevice ([ / ] cycling, Task 8)', () => {
  const ids = ['a', 'b', 'c']
  it('moves forward and wraps', () => {
    expect(nextDevice(ids, 'a', 1)).toBe('b')
    expect(nextDevice(ids, 'c', 1)).toBe('a')
  })
  it('moves backward and wraps', () => {
    expect(nextDevice(ids, 'b', -1)).toBe('a')
    expect(nextDevice(ids, 'a', -1)).toBe('c')
  })
  it('no current → first (forward) or last (backward)', () => {
    expect(nextDevice(ids, null, 1)).toBe('a')
    expect(nextDevice(ids, null, -1)).toBe('c')
  })
  it('a current id no longer in the list behaves as no current', () => {
    expect(nextDevice(ids, 'gone', 1)).toBe('a')
    expect(nextDevice(ids, 'gone', -1)).toBe('c')
  })
  it('empty list → null', () => {
    expect(nextDevice([], null, 1)).toBeNull()
    expect(nextDevice([], 'a', -1)).toBeNull()
  })
})
