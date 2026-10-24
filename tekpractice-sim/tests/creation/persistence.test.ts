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
  readProjectList,
  exportBundle,
  isForeignWrite,
  QUARANTINE_MAX_ITEMS,
  QUARANTINE_MAX_CHARS,
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
  it('the project stamp (two-tab check) round-trips too', () => {
    const s = new MemStorage()
    saveAutosave(s, data({ stamp: 'abc' }))
    expect(loadAutosave(s)).toEqual({ status: 'ok', data: data({ stamp: 'abc' }) })
  })
  it('nothing stored → empty', () => {
    expect(loadAutosave(new MemStorage())).toEqual({ status: 'empty' })
  })
  it('a version 2 payload → reset/version, and the raw data is quarantined, never deleted', () => {
    const s = new MemStorage()
    const raw = JSON.stringify({ ...data(), version: 2 })
    s.map.set(AUTOSAVE_KEY, raw)
    expect(loadAutosave(s)).toMatchObject({ status: 'reset', reason: 'version', kept: 'kept' })
    expect(s.map.get(AUTOSAVE_KEY)).toBe(raw) // untouched
    expect(readQuarantine(s).map((q) => q.raw)).toEqual([raw])
  })
  it('invalid JSON → reset/corrupt (quarantined)', () => {
    const s = new MemStorage()
    s.map.set(AUTOSAVE_KEY, '{nope')
    expect(loadAutosave(s)).toMatchObject({ status: 'reset', reason: 'corrupt', kept: 'kept' })
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
  it('quarantine write failing on quota → reset with kept: full and the raw data (the caller holds it for export)', () => {
    const s = new MemStorage()
    s.map.set(AUTOSAVE_KEY, '{nope')
    s.failSet = quota()
    expect(loadAutosave(s)).toMatchObject({ status: 'reset', reason: 'corrupt', kept: 'full', raw: '{nope' })
  })
  it('setAsideAutosave copies the current autosave into the quarantine (the store refused part of it)', () => {
    const s = new MemStorage()
    saveAutosave(s, data())
    expect(setAsideAutosave(s, 'dropped')).toEqual({ kept: 'kept', raw: JSON.stringify(data()) })
    expect(readQuarantine(s)[0]).toMatchObject({ key: AUTOSAVE_KEY, reason: 'dropped', raw: JSON.stringify(data()) })
    expect(s.map.has(AUTOSAVE_KEY)).toBe(true)
    expect(setAsideAutosave(new MemStorage(), 'x')).toEqual({ kept: 'kept', raw: null }) // nothing to keep
    expect(setAsideAutosave(null, 'x')).toEqual({ kept: 'blocked', raw: null })
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
  it('an unreadable project list is reported (not « no project »), set aside at once, and the next save says it restarted the list', () => {
    const s = new MemStorage()
    s.map.set(PROJECTS_KEY, '{broken')
    expect(readProjectList(s)).toMatchObject({ status: 'unreadable', kept: 'kept', raw: '{broken' })
    expect(s.map.get(PROJECTS_KEY)).toBe('{broken') // reading never rewrites
    expect(readQuarantine(s).map((q) => q.raw)).toEqual(['{broken'])
    expect(saveProject(s, 'A', design())).toBe('list-reset')
    expect(readQuarantine(s).map((q) => q.raw)).toEqual(['{broken']) // still there, once
    expect(listProjects(s).map((p) => p.name)).toEqual(['A'])
  })
  it('an unreadable project list that cannot be set aside is never overwritten: quarantine-full (not « full »)', () => {
    const s = new MemStorage()
    s.map.set(PROJECTS_KEY, '{broken')
    s.failSet = quota()
    expect(readProjectList(s)).toMatchObject({ status: 'unreadable', kept: 'full' })
    expect(saveProject(s, 'A', design())).toBe('quarantine-full')
    expect(s.map.get(PROJECTS_KEY)).toBe('{broken')
  })
  it('once the learner exported the unreadable list it held (`unreadableExported`), a save may start a new list', () => {
    const s = new MemStorage()
    for (let i = 0; i < QUARANTINE_MAX_ITEMS; i++) {
      s.map.set(AUTOSAVE_KEY, `bad${i}`)
      loadAutosave(s)
    }
    s.map.set(PROJECTS_KEY, '{broken')
    expect(saveProject(s, 'A', design())).toBe('quarantine-full')
    expect(saveProject(s, 'A', design(), { unreadableExported: '{broken' })).toBe('list-reset')
    // only that exact list: a different unreadable content is still protected
    s.map.set(PROJECTS_KEY, '{other')
    expect(saveProject(s, 'B', design(), { unreadableExported: '{broken' })).toBe('quarantine-full')
  })
  it('readProjectList: blocked storage → blocked; rows carry a stamp', () => {
    const g = new MemStorage()
    g.failGet = new Error('x')
    expect(readProjectList(g)).toEqual({ status: 'blocked' })
    const s = new MemStorage()
    saveProject(s, 'A', design(), { stamp: 's1' })
    expect(readProjectList(s)).toEqual({ status: 'ok', projects: [{ name: 'A', savedAt: expect.any(String), stamp: 's1' }] })
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

describe('quarantine cap (ADR-0012: 5 items × 200 000 chars): refuses, never drops', () => {
  it(`a ${QUARANTINE_MAX_ITEMS + 1}th item is refused (kept: 'full'), the ${QUARANTINE_MAX_ITEMS} kept ones are untouched`, () => {
    const s = new MemStorage()
    for (let i = 0; i < QUARANTINE_MAX_ITEMS; i++) {
      s.map.set(AUTOSAVE_KEY, `bad${i}`)
      expect(loadAutosave(s)).toMatchObject({ status: 'reset', kept: 'kept' })
    }
    s.map.set(AUTOSAVE_KEY, 'bad-last')
    expect(loadAutosave(s)).toEqual({ status: 'reset', reason: 'corrupt', kept: 'full', raw: 'bad-last' })
    expect(readQuarantine(s).map((q) => q.raw)).toEqual(['bad0', 'bad1', 'bad2', 'bad3', 'bad4'])
    expect(s.map.get(AUTOSAVE_KEY)).toBe('bad-last') // not overwritten by the load
  })
  it(`an item over ${QUARANTINE_MAX_CHARS} chars is refused (full), nothing else changes`, () => {
    const s = new MemStorage()
    const big = 'x'.repeat(QUARANTINE_MAX_CHARS + 1)
    s.map.set(AUTOSAVE_KEY, big)
    expect(loadAutosave(s)).toMatchObject({ status: 'reset', kept: 'full' })
    expect(readQuarantine(s)).toEqual([])
  })
  it('a storage error while setting aside → blocked', () => {
    const s = new MemStorage()
    s.map.set(AUTOSAVE_KEY, '{bad')
    s.failSet = new Error('SecurityError')
    expect(loadAutosave(s)).toMatchObject({ status: 'reset', kept: 'blocked' })
  })
  it('exportBundle: every quarantined item plus what could not be set aside, as JSON; nothing is removed', () => {
    const s = new MemStorage()
    s.map.set(AUTOSAVE_KEY, '{bad')
    loadAutosave(s)
    const pending = [{ at: 't', key: AUTOSAVE_KEY, reason: 'corrupt', raw: 'not kept' }]
    const out = JSON.parse(exportBundle(s, pending, '2026-10-24T12:00:00.000Z'))
    expect(out).toMatchObject({ format: 'tekpractice-creation-export', version: 1, exportedAt: '2026-10-24T12:00:00.000Z' })
    expect(out.quarantine.map((q: { raw: string }) => q.raw)).toEqual(['{bad'])
    expect(out.pending).toEqual(pending)
    expect(readQuarantine(s)).toHaveLength(1)
  })
})

describe('two tabs on one storage (ADR-0012 §6)', () => {
  it('a named project saved by another tab since this one loaded it is set aside before the overwrite (conflict-kept)', () => {
    const s = new MemStorage()
    saveProject(s, 'P', design(1), { stamp: 's0' })
    // both tabs open P (stamp s0)
    const tabA = readProjectList(s)
    const tabB = readProjectList(s)
    const stampOf = (r: ReturnType<typeof readProjectList>) => (r.status === 'ok' ? r.projects[0].stamp : null)
    expect(saveProject(s, 'P', design(2), { expectStamp: stampOf(tabA), stamp: 'sA' })).toBe('ok')
    expect(saveProject(s, 'P', design(3), { expectStamp: stampOf(tabB), stamp: 'sB' })).toBe('conflict-kept')
    const kept = readQuarantine(s)
    expect(kept).toHaveLength(1)
    expect(kept[0]).toMatchObject({ key: PROJECTS_KEY, reason: 'conflict' })
    expect(JSON.parse(kept[0].raw)).toMatchObject({ name: 'P', stamp: 'sA', design: design(2) })
    expect(loadProject(s, 'P')).toEqual(design(3))
  })
  it('a new name that another tab created meanwhile is set aside too (expectStamp null)', () => {
    const s = new MemStorage()
    saveProject(s, 'N', design(1), { stamp: 'other' })
    expect(saveProject(s, 'N', design(2), { expectStamp: null })).toBe('conflict-kept')
  })
  it('a conflict that cannot be set aside saves nothing: quarantine-full', () => {
    const s = new MemStorage()
    for (let i = 0; i < QUARANTINE_MAX_ITEMS; i++) {
      s.map.set(AUTOSAVE_KEY, `bad${i}`)
      loadAutosave(s)
    }
    saveProject(s, 'P', design(1), { stamp: 'other' })
    expect(saveProject(s, 'P', design(2), { expectStamp: 'mine' })).toBe('quarantine-full')
    expect(loadProject(s, 'P')).toEqual(design(1))
  })
  it('isForeignWrite: another tab writing the autosave or the projects (or clearing) concerns us; other keys do not', () => {
    expect(isForeignWrite({ key: AUTOSAVE_KEY })).toBe(true)
    expect(isForeignWrite({ key: PROJECTS_KEY })).toBe(true)
    expect(isForeignWrite({ key: null })).toBe(true)
    expect(isForeignWrite({ key: 'audio-sim/rigs.v2' })).toBe(false)
    expect(isForeignWrite({ key: AUTOSAVE_QUARANTINE_KEY })).toBe(false)
  })
  it('two tabs: once tab B hears tab A write, B pauses and writes nothing until resumed', () => {
    vi.useFakeTimers()
    const s = new MemStorage()
    const tab = (name: string) => createAutosave({ storage: s, snapshot: () => data({ name }), busy: () => false, ms: 1000 })
    const a = tab('A')
    const b = tab('B')
    a.schedule()
    vi.advanceTimersByTime(1000)
    expect(JSON.parse(s.map.get(AUTOSAVE_KEY)!).name).toBe('A')
    b.pause() // the shell calls this on a `storage` event where isForeignWrite
    expect(b.paused).toBe(true)
    b.schedule()
    vi.advanceTimersByTime(2000)
    b.flush()
    expect(JSON.parse(s.map.get(AUTOSAVE_KEY)!).name).toBe('A')
    b.resume() // e.g. Ctrl+S in tab B: « I am the active tab »
    vi.advanceTimersByTime(1000)
    expect(JSON.parse(s.map.get(AUTOSAVE_KEY)!).name).toBe('B')
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
