import { describe, expect, it } from 'vitest'
import {
  loadRigs,
  RIG_QUARANTINE_CAP,
  RIGS_KEY,
  RIGS_QUARANTINE_KEY,
  RIGS_V1_KEY,
  saveRig,
  type RigStorage,
  type SavedRig,
} from '../../src/ui/rigStore'

/** Storage with NO removeItem (the module must never need it) + a write log. */
const fakeStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial))
  const writes: string[] = []
  const s: RigStorage & { data: Map<string, string>; writes: string[] } = {
    data,
    writes,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      writes.push(k)
      data.set(k, v)
    },
  }
  return s
}

const rig = (over: Partial<SavedRig> = {}): SavedRig => ({
  name: 'Plateau simple',
  savedAt: '2026-10-24T10:00:00.000Z',
  roomId: 'salle-polyvalente',
  instances: [
    { instanceId: 'shure-sm58-s1', deviceId: 'shure-sm58' },
    { instanceId: 'yamaha-ql1-s2', deviceId: 'yamaha-ql1' },
  ],
  connections: [{ a: { instance: 'shure-sm58-s1', port: 'out-xlr' }, b: { instance: 'yamaha-ql1-s2', port: 'in-1' } }],
  controls: { 'yamaha-ql1-s2': { phantom: true, route: 'main' } },
  positions: { 'shure-sm58-s1': [1.234, 0, -2.5, 90], 'yamaha-ql1-s2': [-0.5, 0.8, 3, -45] },
  ...over,
})

const v1File = (rigs: unknown[]) => JSON.stringify({ version: 1, rigs })

describe('rigStore v2: save / load', () => {
  it('empty storage → no rigs, no warnings', () => {
    expect(loadRigs(fakeStorage())).toEqual({ rigs: [], warnings: [], readOnly: false })
  })

  it('round-trip keeps every field, positions included, under audio-sim/rigs.v2', () => {
    const s = fakeStorage()
    expect(saveRig(s, rig())).toEqual({ ok: true, replaced: false, warnings: [] })
    expect(loadRigs(s).rigs).toEqual([rig()])
    expect(JSON.parse(s.data.get(RIGS_KEY)!).version).toBe(2)
    expect(s.data.has(RIGS_V1_KEY)).toBe(false)
  })

  it('a rig without positions (grid layout) and with roomId null round-trips', () => {
    const s = fakeStorage()
    const r = rig({ roomId: null })
    delete r.positions
    expect(saveRig(s, r).ok).toBe(true)
    expect(loadRigs(s).rigs).toEqual([r])
  })

  it('same name → refused with "exists" unless overwrite is confirmed', () => {
    const s = fakeStorage()
    saveRig(s, rig())
    const before = s.data.get(RIGS_KEY)
    expect(saveRig(s, rig({ savedAt: '2026-10-24T11:00:00.000Z' }))).toEqual({ ok: false, reason: 'exists' })
    expect(s.data.get(RIGS_KEY)).toBe(before)
    expect(saveRig(s, rig({ savedAt: '2026-10-24T11:00:00.000Z' }), { overwrite: true })).toEqual({
      ok: true,
      replaced: true,
      warnings: [],
    })
    const rigs = loadRigs(s).rigs
    expect(rigs).toHaveLength(1)
    expect(rigs[0].savedAt).toBe('2026-10-24T11:00:00.000Z')
  })

  it('a different name is appended', () => {
    const s = fakeStorage()
    saveRig(s, rig())
    saveRig(s, rig({ name: 'Autre' }))
    expect(loadRigs(s).rigs.map((r) => r.name)).toEqual(['Plateau simple', 'Autre'])
  })

  it.each([
    ['NaN', [Number.NaN, 0, 0, 0]],
    ['Infinity', [0, Number.POSITIVE_INFINITY, 0, 0]],
    ['3 numbers', [0, 0, 0]],
    ['5 numbers', [0, 0, 0, 0, 0]],
  ])('positions are validated on save (%s → invalid, nothing written)', (_label, pos) => {
    const s = fakeStorage()
    const r = rig({ positions: { 'shure-sm58-s1': pos as unknown as [number, number, number, number] } })
    expect(saveRig(s, r)).toEqual({ ok: false, reason: 'invalid' })
    expect(s.writes).toEqual([])
  })

  it('an empty name is refused', () => {
    expect(saveRig(fakeStorage(), rig({ name: '   ' }))).toEqual({ ok: false, reason: 'empty' })
  })

  it('quota / blocked storage → returned, never thrown', () => {
    const quota = fakeStorage()
    quota.setItem = () => {
      throw Object.assign(new Error('full'), { name: 'QuotaExceededError' })
    }
    expect(saveRig(quota, rig())).toEqual({ ok: false, reason: 'quota' })
    const blocked = fakeStorage()
    blocked.setItem = () => {
      throw new Error('SecurityError')
    }
    expect(saveRig(blocked, rig())).toEqual({ ok: false, reason: 'storage' })
    const unreadable: RigStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => undefined,
    }
    expect(loadRigs(unreadable)).toEqual({ rigs: [], warnings: ['storage-unavailable'], readOnly: true })
    expect(saveRig(unreadable, rig())).toEqual({ ok: false, reason: 'read-only' })
  })
})

describe('rigStore v2: copy migration from audio-sim/rigs v1', () => {
  const v1Rig = (): Record<string, unknown> => {
    const r: Record<string, unknown> = { ...rig() }
    delete r.roomId
    return r
  }

  it('first load copies v1 into v2 with roomId null; v1 is left byte-for-byte untouched', () => {
    const raw = v1File([v1Rig()])
    const s = fakeStorage({ [RIGS_V1_KEY]: raw })
    const out = loadRigs(s)
    expect(out.warnings).toEqual(['migrated'])
    expect(out.rigs).toEqual([rig({ roomId: null })])
    expect(s.data.get(RIGS_V1_KEY)).toBe(raw)
    expect(JSON.parse(s.data.get(RIGS_KEY)!)).toEqual({ version: 2, rigs: [rig({ roomId: null })] })
    expect(s.writes).toEqual([RIGS_KEY])
    // second load: reads v2 only, migrates nothing
    expect(loadRigs(s)).toEqual({ rigs: [rig({ roomId: null })], warnings: [], readOnly: false })
  })

  it('v1 positions that the old loader already ignored (not 4 finite numbers) are not copied', () => {
    const r = v1Rig()
    r.positions = { 'shure-sm58-s1': [1, 2, 3, 4], 'yamaha-ql1-s2': [null, 0, 0, 0] }
    const s = fakeStorage({ [RIGS_V1_KEY]: v1File([r]) })
    expect(loadRigs(s).rigs[0].positions).toEqual({ 'shure-sm58-s1': [1, 2, 3, 4] })
  })

  it('a migration that cannot be written still returns the rigs, with a warning, and retries on save', () => {
    const s = fakeStorage({ [RIGS_V1_KEY]: v1File([v1Rig()]) })
    const real = s.setItem
    s.setItem = () => {
      throw Object.assign(new Error('full'), { name: 'QuotaExceededError' })
    }
    const out = loadRigs(s)
    expect(out.warnings).toEqual(['migration-failed'])
    expect(out.rigs).toHaveLength(1)
    s.setItem = real
    expect(saveRig(s, rig({ name: 'Nouveau' })).ok).toBe(true)
    expect(loadRigs(s).rigs.map((r) => r.name)).toEqual(['Plateau simple', 'Nouveau'])
  })

  it('an unreadable v1 is copied to the rig quarantine (never deleted), v1 untouched', () => {
    const s = fakeStorage({ [RIGS_V1_KEY]: '{broken' })
    const out = loadRigs(s, () => '2026-10-24T12:00:00.000Z')
    expect(out).toEqual({ rigs: [], warnings: ['quarantined'], readOnly: false })
    expect(s.data.get(RIGS_V1_KEY)).toBe('{broken')
    const q = JSON.parse(s.data.get(RIGS_QUARANTINE_KEY)!)
    expect(q.items).toEqual([{ at: '2026-10-24T12:00:00.000Z', raw: '{broken', reason: 'v1:json' }])
  })
})

describe('rigStore v2: clobber (an old build writes v1 after v2 exists)', () => {
  it('the v2 key is unaffected and v1 is never read again', () => {
    const s = fakeStorage()
    saveRig(s, rig())
    const v2Before = s.data.get(RIGS_KEY)
    // an old build (v1 code) saves a rig under the old key
    s.setItem(RIGS_V1_KEY, v1File([{ name: 'Ancien build', savedAt: 'x', instances: [], connections: [], controls: {} }]))
    s.writes.length = 0

    const out = loadRigs(s)
    expect(out.rigs.map((r) => r.name)).toEqual(['Plateau simple'])
    expect(out.warnings).toEqual([])
    expect(saveRig(s, rig({ name: 'Après' })).ok).toBe(true)
    expect(s.writes).toEqual([RIGS_KEY]) // never touches v1
    expect(JSON.parse(s.data.get(RIGS_V1_KEY)!).rigs[0].name).toBe('Ancien build')
    expect(JSON.parse(s.data.get(RIGS_KEY)!).rigs.map((r: SavedRig) => r.name)).toEqual(['Plateau simple', 'Après'])
    expect(JSON.parse(v2Before!).rigs[0]).toEqual(rig())
  })

  it('the old build cannot write the v2 key: it only knows audio-sim/rigs', () => {
    expect(RIGS_KEY).not.toBe(RIGS_V1_KEY)
    expect(RIGS_KEY.startsWith(RIGS_V1_KEY + '.')).toBe(true)
  })
})

describe('rigStore v2: quarantine instead of reset', () => {
  it('a corrupt v2 file is copied to the quarantine, the list starts empty, writes stay allowed', () => {
    const s = fakeStorage({ [RIGS_KEY]: '{"version":2,"rigs":[{"name":1}]}' })
    const out = loadRigs(s, () => '2026-10-24T12:00:00.000Z')
    expect(out.rigs).toEqual([])
    expect(out.warnings).toEqual(['quarantined'])
    expect(out.readOnly).toBe(false)
    const q = JSON.parse(s.data.get(RIGS_QUARANTINE_KEY)!)
    expect(q.version).toBe(1)
    expect(q.items[0].raw).toBe('{"version":2,"rigs":[{"name":1}]}')
    expect(q.items[0].reason).toMatch(/^schema:/)
  })

  it('a v2 file with an invalid position is quarantined (positions are validated on load too)', () => {
    const bad = JSON.stringify({ version: 2, rigs: [{ ...rig(), positions: { x: [0, 0, null, 0] } }] })
    const s = fakeStorage({ [RIGS_KEY]: bad })
    expect(loadRigs(s).warnings).toEqual(['quarantined'])
  })

  it('an unknown version is quarantined, not reset', () => {
    const s = fakeStorage({ [RIGS_KEY]: JSON.stringify({ version: 3, rigs: [] }) })
    expect(loadRigs(s).warnings).toEqual(['quarantined'])
    expect(s.data.get(RIGS_KEY)).toBe(JSON.stringify({ version: 3, rigs: [] }))
  })

  it('the same corrupt content is quarantined once; the cap evicts the oldest with a warning', () => {
    const s = fakeStorage({ [RIGS_KEY]: '{x' })
    loadRigs(s)
    loadRigs(s)
    expect(JSON.parse(s.data.get(RIGS_QUARANTINE_KEY)!).items).toHaveLength(1)
    for (let i = 0; i < RIG_QUARANTINE_CAP - 1; i++) {
      s.data.set(RIGS_KEY, `{x${i}`)
      expect(loadRigs(s).warnings).toEqual(['quarantined'])
    }
    s.data.set(RIGS_KEY, '{last')
    expect(loadRigs(s).warnings).toEqual(['quarantined', 'quarantine-evicted'])
    const items = JSON.parse(s.data.get(RIGS_QUARANTINE_KEY)!).items
    expect(items).toHaveLength(RIG_QUARANTINE_CAP)
    expect(items.at(-1).raw).toBe('{last')
  })

  it('quarantine write failure → read-only: nothing can overwrite the only copy', () => {
    const s = fakeStorage({ [RIGS_KEY]: '{x' })
    s.setItem = () => {
      throw new Error('blocked')
    }
    expect(loadRigs(s)).toEqual({ rigs: [], warnings: ['quarantine-failed'], readOnly: true })
    expect(saveRig(s, rig())).toEqual({ ok: false, reason: 'read-only' })
    expect(s.data.get(RIGS_KEY)).toBe('{x')
  })

  it('after a quarantine a save replaces the corrupt v2 file (its copy is in the quarantine)', () => {
    const s = fakeStorage({ [RIGS_KEY]: '{x' })
    const res = saveRig(s, rig())
    expect(res).toEqual({ ok: true, replaced: false, warnings: ['quarantined'] })
    expect(loadRigs(s).rigs).toEqual([rig()])
    expect(JSON.parse(s.data.get(RIGS_QUARANTINE_KEY)!).items[0].raw).toBe('{x')
  })
})
