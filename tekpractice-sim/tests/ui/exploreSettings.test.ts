import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  SETTINGS_KEY,
  SETTINGS_VERSION,
} from '../../src/ui/exploreSettings'
import { DEFAULT_BINDINGS, rebind } from '../../src/input/bindings'

class MemStorage {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
}
const throwing = {
  getItem(): string | null {
    throw new Error('SecurityError')
  },
  setItem(): void {
    throw new Error('QuotaExceeded')
  },
}

describe('explore settings store', () => {
  it('has the ADR-0010 defaults', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      speedMult: 1,
      sensitivity: 1,
      invertY: false,
      fovDeg: 70,
      reducedMotion: 'system',
      pointerLock: 'auto',
      levelView: 'orbit',
    })
    expect(DEFAULT_SETTINGS.bindings).toEqual(DEFAULT_BINDINGS)
  })

  it('returns defaults when storage is empty, corrupt or another version', () => {
    const s = new MemStorage()
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS)
    s.setItem(SETTINGS_KEY, '{nope')
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS)
    s.setItem(SETTINGS_KEY, JSON.stringify({ version: SETTINGS_VERSION + 1, settings: { fovDeg: 90 } }))
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips, including remapped bindings', () => {
    const s = new MemStorage()
    const mine = { ...DEFAULT_SETTINGS, fovDeg: 85, invertY: true, bindings: rebind(DEFAULT_BINDINGS, 'RUN', ['KeyC']) }
    saveSettings(s, mine)
    expect(loadSettings(s)).toEqual(mine)
  })

  it('clamps out-of-range numbers and rejects unknown enum values', () => {
    const s = new MemStorage()
    s.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        version: SETTINGS_VERSION,
        settings: { fovDeg: 500, speedMult: -3, sensitivity: 'x', pointerLock: 'sometimes', levelView: 'explore' },
      }),
    )
    const got = loadSettings(s)
    expect(got.fovDeg).toBe(100)
    expect(got.speedMult).toBe(0.25)
    expect(got.sensitivity).toBe(DEFAULT_SETTINGS.sensitivity)
    expect(got.pointerLock).toBe('auto')
    expect(got.levelView).toBe('explore')
  })

  it('year (Essais, Task 14): defaults to 2nd year, a file written before it keeps its other settings', () => {
    expect(DEFAULT_SETTINGS.year).toBe(2)
    const s = new MemStorage()
    // a settings file from before Task 14: same version, no `year`
    s.setItem(SETTINGS_KEY, JSON.stringify({ version: SETTINGS_VERSION, settings: { fovDeg: 85 } }))
    expect(loadSettings(s)).toMatchObject({ fovDeg: 85, year: 2 })
    for (const bad of [3, '1', null, 0]) {
      s.setItem(SETTINGS_KEY, JSON.stringify({ version: SETTINGS_VERSION, settings: { year: bad } }))
      expect(loadSettings(s).year, String(bad)).toBe(2)
    }
    saveSettings(s, { ...DEFAULT_SETTINGS, year: 1 })
    expect(loadSettings(s).year).toBe(1)
  })

  it('never throws when storage is blocked', () => {
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS)
    expect(() => saveSettings(throwing, DEFAULT_SETTINGS)).not.toThrow()
  })
})
