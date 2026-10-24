/**
 * Camera presets store (designer nav, Task 5): three slots per room, versioned,
 * zod-validated; corrupt or mismatched payloads fall back to empty, never crash.
 */
import { describe, expect, it } from 'vitest'
import { PRESETS_KEY, loadPresets, roomKeyFor, savePreset, type CameraPoseJSON } from '../../src/camera/presets'

class MemStorage implements Pick<Storage, 'getItem' | 'setItem'> {
  data = new Map<string, string>()
  getItem(k: string): string | null {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v)
  }
}

const pose = (n: number): CameraPoseJSON => ({ alpha: n, beta: 1 + n / 10, radius: 5 + n, target: [n, 0.5, -n] })

describe('camera presets store', () => {
  it('uses the documented storage key', () => {
    expect(PRESETS_KEY).toBe('audio-sim/camera-presets')
  })

  it('an empty storage gives three empty slots', () => {
    expect(loadPresets(new MemStorage(), 'room-a')).toEqual([null, null, null])
  })

  it('save then load round-trips a pose in its slot', () => {
    const s = new MemStorage()
    expect(savePreset(s, 'room-a', 1, pose(2))).toBe(true)
    expect(loadPresets(s, 'room-a')).toEqual([null, pose(2), null])
  })

  it('keeps three independent slots per room, and rooms apart', () => {
    const s = new MemStorage()
    savePreset(s, 'room-a', 0, pose(1))
    savePreset(s, 'room-a', 1, pose(2))
    savePreset(s, 'room-a', 2, pose(3))
    savePreset(s, 'room-b', 0, pose(9))
    expect(loadPresets(s, 'room-a')).toEqual([pose(1), pose(2), pose(3)])
    expect(loadPresets(s, 'room-b')).toEqual([pose(9), null, null])
    savePreset(s, 'room-a', 1, pose(7)) // replace
    expect(loadPresets(s, 'room-a')).toEqual([pose(1), pose(7), pose(3)])
  })

  it('a corrupt payload falls back to empty and a later save repairs it', () => {
    const s = new MemStorage()
    s.setItem(PRESETS_KEY, '{not json')
    expect(loadPresets(s, 'room-a')).toEqual([null, null, null])
    expect(savePreset(s, 'room-a', 0, pose(1))).toBe(true)
    expect(loadPresets(s, 'room-a')).toEqual([pose(1), null, null])
  })

  it('a version mismatch resets without crashing', () => {
    const s = new MemStorage()
    s.setItem(PRESETS_KEY, JSON.stringify({ version: 2, rooms: { 'room-a': [pose(1), null, null] } }))
    expect(loadPresets(s, 'room-a')).toEqual([null, null, null])
  })

  it('an invalid pose (NaN, wrong shape, wrong slot count) is rejected', () => {
    const s = new MemStorage()
    s.setItem(PRESETS_KEY, JSON.stringify({ version: 1, rooms: { 'room-a': [{ alpha: 'x' }, null, null] } }))
    expect(loadPresets(s, 'room-a')).toEqual([null, null, null])
    s.setItem(PRESETS_KEY, JSON.stringify({ version: 1, rooms: { 'room-a': [null, null] } }))
    expect(loadPresets(s, 'room-a')).toEqual([null, null, null])
  })

  it('a throwing storage never crashes; save reports failure', () => {
    const bad = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('full')
      },
    }
    expect(loadPresets(bad, 'room-a')).toEqual([null, null, null])
    expect(savePreset(bad, 'room-a', 0, pose(1))).toBe(false)
  })

  it('rejects an out-of-range slot', () => {
    const s = new MemStorage()
    expect(savePreset(s, 'room-a', 3, pose(1))).toBe(false)
    expect(savePreset(s, 'room-a', -1, pose(1))).toBe(false)
  })

  it('roomKeyFor: room id when present, else level:<id> (sandbox included)', () => {
    expect(roomKeyFor('studio-1', 'a1')).toBe('studio-1')
    expect(roomKeyFor(undefined, 'a1')).toBe('level:a1')
    expect(roomKeyFor(undefined, 'sandbox')).toBe('level:sandbox')
  })
})
