import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AUTOSAVE_KEY,
  AUTOSAVE_QUARANTINE_KEY,
  PROJECTS_KEY,
  PROJECTS_MAX,
  type AutosaveV1,
  createAutosave,
  debounce,
  designFingerprint,
  isDirty,
  listProjects,
  loadAutosave,
  loadProject,
  readQuarantine,
  saveAutosave,
  saveProject,
  setAsideAutosave,
} from '../../src/creation/persistence'
import type { DesignState } from '../../src/trials/trial'

/** An in-memory Storage; `fail` makes getItem / setItem throw. */
class MemStorage implements Storage {
  map = new Map<string, string>()
  failGet: Error | null = null
  failSet: Error | null = null
  get length(): number {
    return this.map.size
  }
  clear(): void {
    this.map.clear()
  }
  getItem(k: string): string | null {
    if (this.failGet) throw this.failGet
    return this.map.has(k) ? this.map.get(k)! : null
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
  setItem(k: string, v: string): void {
    if (this.failSet) throw this.failSet
    this.map.set(k, String(v))
  }
}
const quota = (): Error => Object.assign(new Error('full'), { name: 'QuotaExceededError' })

const design = (x = 1): DesignState => ({
  roomId: 'room:concert-hall-medium',
  rig: {
    instances: [
      { instanceId: 'shure-sm58-1', deviceId: 'shure-sm58' },
      { instanceId: 'yamaha-ql1-1', deviceId: 'yamaha-ql1' },
    ],
    connections: [{ a: { instance: 'shure-sm58-1', port: 'out-xlr' }, b: { instance: 'yamaha-ql1-1', port: 'in-mic-1' } }],
    controls: { 'yamaha-ql1-1': { 'phantom-1': false } },
  },
  placements: [
    { instanceId: 'shure-sm58-1', deviceId: 'shure-sm58', position_m: [x, 0, 2], yawDeg: 90 },
    { instanceId: 'yamaha-ql1-1', deviceId: 'yamaha-ql1', position_m: [3, 0, -1], yawDeg: 0, mount: 'stand', tiltDeg: 5 },
  ],
})
const data = (over: Partial<AutosaveV1> = {}): AutosaveV1 => ({
  version: 1,
  savedAt: '2026-10-24T10:00:00.000Z',
  name: 'Mon concert',
  design: design(),
  savedFingerprint: null,
  ...over,
})

afterEach(() => {
  vi.useRealTimers()
})

describe('autosave (C16)', () => {
  it('round-trips under audio-sim/creation.v1', () => {
    const s = new MemStorage()
    expect(saveAutosave(s, data())).toBe('ok')
    expect(s.map.has(AUTOSAVE_KEY)).toBe(true)
    expect(AUTOSAVE_KEY).toBe('audio-sim/creation.v1')
    const r = loadAutosave(s)
    expect(r).toEqual({ status: 'ok', data: data() })
  })
  it('nothing stored → empty', () => {
    expect(loadAutosave(new MemStorage())).toEqual({ status: 'empty' })
  })
  it('a version 2 payload → reset/version, and the raw data is quarantined, never deleted', () => {
    const s = new MemStorage()
    const raw = JSON.stringify({ ...data(), version: 2 })
    s.map.set(AUTOSAVE_KEY, raw)
    expect(loadAutosave(s)).toMatchObject({ status: 'reset', reason: 'version', kept: true })
    expect(s.map.get(AUTOSAVE_KEY)).toBe(raw) // untouched
    expect(readQuarantine(s).map((q) => q.raw)).toEqual([raw])
  })
  it('invalid JSON → reset/corrupt (quarantined)', () => {
    const s = new MemStorage()
    s.map.set(AUTOSAVE_KEY, '{nope')
    expect(loadAutosave(s)).toMatchObject({ status: 'reset', reason: 'corrupt', kept: true })
    expect(readQuarantine(s)[0]).toMatchObject({ raw: '{nope', reason: 'corrupt' })
  })
  it('a shape that is not a design → reset/corrupt', () => {
    const s = new MemStorage()
    s.map.set(AUTOSAVE_KEY, JSON.stringify({ ...data(), design: { roomId: 3 } }))
    expect(loadAutosave(s)).toMatchObject({ status: 'reset', reason: 'corrupt' })
  })
  it('quarantine is deduplicated and append-only', () => {
    const s = new MemStorage()
    s.map.set(AUTOSAVE_KEY, 'x1')
    loadAutosave(s)
    loadAutosave(s)
    s.map.set(AUTOSAVE_KEY, 'x2')
    loadAutosave(s)
    expect(readQuarantine(s).map((q) => q.raw)).toEqual(['x1', 'x2'])
    expect(s.map.has(AUTOSAVE_QUARANTINE_KEY)).toBe(true)
  })
  it('quarantine write failing → reset with kept: false (the caller must not overwrite)', () => {
    const s = new MemStorage()
    s.map.set(AUTOSAVE_KEY, '{nope')
    s.failSet = quota()
    expect(loadAutosave(s)).toMatchObject({ status: 'reset', reason: 'corrupt', kept: false })
  })
  it('setAsideAutosave copies the current autosave into the quarantine (the store refused part of it)', () => {
    const s = new MemStorage()
    saveAutosave(s, data())
    expect(setAsideAutosave(s, 'dropped')).toBe(true)
    expect(readQuarantine(s)[0]).toMatchObject({ key: AUTOSAVE_KEY, reason: 'dropped', raw: JSON.stringify(data()) })
    expect(s.map.has(AUTOSAVE_KEY)).toBe(true)
    expect(setAsideAutosave(new MemStorage(), 'x')).toBe(true) // nothing to keep
    expect(setAsideAutosave(null, 'x')).toBe(false)
  })
  it('a storage whose getItem throws → blocked; null storage → blocked', () => {
    const s = new MemStorage()
    s.failGet = new Error('SecurityError')
    expect(loadAutosave(s)).toEqual({ status: 'blocked' })
    expect(loadAutosave(null)).toEqual({ status: 'blocked' })
  })
  it('setItem throwing QuotaExceededError → full; another error → blocked; null → blocked', () => {
    const s = new MemStorage()
    s.failSet = quota()
    expect(saveAutosave(s, data())).toBe('full')
    s.failSet = new Error('SecurityError')
    expect(saveAutosave(s, data())).toBe('blocked')
    expect(saveAutosave(null, data())).toBe('blocked')
  })
  it('untrusted placements are dropped (non-finite, bad mount, unknown fields kept out)', () => {
    const s = new MemStorage()
    const d = design() as unknown as { placements: unknown[] }
    d.placements.push(
      { instanceId: 'a', deviceId: 'x', position_m: [null, 0, 0], yawDeg: 0 },
      { instanceId: 'b', deviceId: 'x', position_m: [0, 0, 0], yawDeg: 0, mount: 'ceiling' },
      { instanceId: 'c', deviceId: 'x', position_m: [0, 0], yawDeg: 0 },
      'junk',
    )
    s.map.set(AUTOSAVE_KEY, JSON.stringify({ ...data(), design: d }))
    const r = loadAutosave(s)
    expect(r.status).toBe('ok')
    if (r.status !== 'ok') return
    expect(r.data.design.placements.map((p) => p.instanceId)).toEqual(['shure-sm58-1', 'yamaha-ql1-1'])
  })
})

describe('named projects', () => {
  it('save, list, load round-trip under audio-sim/creation-projects.v1', () => {
    const s = new MemStorage()
    expect(PROJECTS_KEY).toBe('audio-sim/creation-projects.v1')
    expect(saveProject(s, 'Concert A', design(1))).toBe('ok')
    expect(saveProject(s, 'Concert B', design(2))).toBe('ok')
    expect(listProjects(s).map((p) => p.name)).toEqual(['Concert A', 'Concert B'])
    expect(loadProject(s, 'Concert B')).toEqual(design(2))
    expect(loadProject(s, 'nope')).toBeNull()
  })
  it('the same name overwrites (the UI asks first)', () => {
    const s = new MemStorage()
    saveProject(s, 'A', design(1))
    saveProject(s, 'A', design(5))
    expect(listProjects(s)).toHaveLength(1)
    expect(loadProject(s, 'A')!.placements[0].position_m[0]).toBe(5)
  })
  it(`at most ${PROJECTS_MAX} projects: a 21st new name → full, nothing removed`, () => {
    const s = new MemStorage()
    for (let i = 0; i < PROJECTS_MAX; i++) expect(saveProject(s, `P${i}`, design(i))).toBe('ok')
    expect(saveProject(s, 'one more', design())).toBe('full')
    expect(listProjects(s)).toHaveLength(PROJECTS_MAX)
    expect(saveProject(s, 'P3', design(9))).toBe('ok') // overwriting is still possible
  })
  it('quota → full; blocked storage → blocked', () => {
    const s = new MemStorage()
    s.failSet = quota()
    expect(saveProject(s, 'A', design())).toBe('full')
    expect(saveProject(null, 'A', design())).toBe('blocked')
    const g = new MemStorage()
    g.failGet = new Error('x')
    expect(saveProject(g, 'A', design())).toBe('blocked')
    expect(listProjects(g)).toEqual([])
    expect(listProjects(null)).toEqual([])
    expect(loadProject(null, 'A')).toBeNull()
  })
  it('an unreadable project list is quarantined before the first new save, never lost', () => {
    const s = new MemStorage()
    s.map.set(PROJECTS_KEY, '{broken')
    expect(listProjects(s)).toEqual([])
    expect(saveProject(s, 'A', design())).toBe('ok')
    expect(readQuarantine(s).map((q) => q.raw)).toContain('{broken')
    expect(listProjects(s).map((p) => p.name)).toEqual(['A'])
  })
  it('an unreadable project list whose quarantine fails is never overwritten', () => {
    const s = new MemStorage()
    s.map.set(PROJECTS_KEY, '{broken')
    s.failSet = quota()
    expect(saveProject(s, 'A', design())).toBe('full')
    expect(s.map.get(PROJECTS_KEY)).toBe('{broken')
  })
  it('a stored project with a bad design is skipped on load (null), the others still list', () => {
    const s = new MemStorage()
    saveProject(s, 'A', design())
    const file = JSON.parse(s.map.get(PROJECTS_KEY)!)
    file.projects.push({ name: 'Bad', savedAt: 'x', design: { roomId: 7 } })
    s.map.set(PROJECTS_KEY, JSON.stringify(file))
    expect(listProjects(s).map((p) => p.name)).toEqual(['A', 'Bad'])
    expect(loadProject(s, 'Bad')).toBeNull()
  })
  it('a blank name is refused', () => {
    expect(() => saveProject(new MemStorage(), '  ', design())).toThrow()
  })
})

describe('fingerprint and dirty marker', () => {
  it('same design in another order → same fingerprint; a moved device → different', () => {
    const a = design()
    const b = design()
    b.rig.instances.reverse()
    b.placements.reverse()
    expect(designFingerprint(a)).toBe(designFingerprint(b))
    expect(designFingerprint(design(1))).not.toBe(designFingerprint(design(1.5)))
  })
  it('dirty: an untitled empty rig is clean; any gear without a save is dirty; equal to the saved one is clean', () => {
    const empty: DesignState = { roomId: 'blank', rig: { instances: [], connections: [], controls: {} }, placements: [] }
    expect(isDirty(empty, null)).toBe(false)
    expect(isDirty(design(), null)).toBe(true)
    expect(isDirty(design(), designFingerprint(design()))).toBe(false)
    expect(isDirty(design(2), designFingerprint(design()))).toBe(true)
  })
})

describe('debounce', () => {
  it('5 calls within 1 s → 1 call with the last arguments', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 1000)
    for (let i = 0; i < 5; i++) {
      d(i)
      vi.advanceTimersByTime(150)
    }
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(4)
  })
  it('flush() runs now (once), cancel() drops the pending call', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 1000)
    d('a')
    d.flush()
    expect(fn).toHaveBeenCalledWith('a')
    vi.advanceTimersByTime(2000)
    expect(fn).toHaveBeenCalledTimes(1)
    d.flush() // nothing pending
    expect(fn).toHaveBeenCalledTimes(1)
    d('b')
    d.cancel()
    vi.advanceTimersByTime(2000)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('createAutosave: debounced, never mid-transaction', () => {
  const setup = (over: { busy?: () => boolean; snap?: () => AutosaveV1 | null } = {}) => {
    const s = new MemStorage()
    const results: string[] = []
    const auto = createAutosave({
      storage: s,
      snapshot: over.snap ?? (() => data()),
      busy: over.busy ?? (() => false),
      ms: 1000,
      onResult: (r) => results.push(r),
    })
    return { s, auto, results }
  }
  it('a burst of changes writes once, 1 s after the last', () => {
    vi.useFakeTimers()
    const { s, auto, results } = setup()
    const spy = vi.spyOn(s, 'setItem')
    for (let i = 0; i < 10; i++) {
      auto.schedule()
      vi.advanceTimersByTime(100)
    }
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(results).toEqual(['ok'])
  })
  it('while a transaction is open it waits, then saves after the commit', () => {
    vi.useFakeTimers()
    let busy = true
    const { s, auto } = setup({ busy: () => busy })
    auto.schedule()
    vi.advanceTimersByTime(1000)
    expect(s.map.has(AUTOSAVE_KEY)).toBe(false)
    auto.flush() // beforeunload mid-burst: still not saved
    expect(s.map.has(AUTOSAVE_KEY)).toBe(false)
    busy = false
    vi.advanceTimersByTime(1000)
    expect(s.map.has(AUTOSAVE_KEY)).toBe(true)
  })
  it('flush() saves a pending change now; nothing pending → no write', () => {
    vi.useFakeTimers()
    const { s, auto } = setup()
    const spy = vi.spyOn(s, 'setItem')
    auto.flush()
    expect(spy).not.toHaveBeenCalled()
    auto.schedule()
    auto.flush()
    expect(spy).toHaveBeenCalledTimes(1)
  })
  it('a null snapshot (no place yet) writes nothing', () => {
    vi.useFakeTimers()
    const { s, auto } = setup({ snap: () => null })
    auto.schedule()
    vi.advanceTimersByTime(2000)
    expect(s.map.size).toBe(0)
  })
})
