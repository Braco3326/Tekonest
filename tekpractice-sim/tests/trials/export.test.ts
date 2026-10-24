/** Essais (Task 13): declarative export / strict import, and the quarantine export. */
import { describe, expect, it } from 'vitest'
import { exportQuarantine, exportTrails, importTrails } from '../../src/trials/export'
import { QUARANTINE_KEY, TRIALS_KEY, type TrialStorage } from '../../src/trials/store'
import { createTrial, type Trial } from '../../src/trials/trial'
import { RIGS_QUARANTINE_KEY } from '../../src/ui/rigStore'
import { input, NOW } from './fixtures'

const EXPORTED_AT = '2026-10-24T11:00:00.000Z'

async function trails(): Promise<Trial[]> {
  const a = await createTrial(input(), NOW, 'tr_a')
  const ib = input({ parent: a, name: 'Essai B', levelId: 'a1' })
  ib.design.placements[1].position_m = [-3.0004, 2.2, -9]
  ib.design.placements[1].yawDeg = -350
  const b = await createTrial(ib, NOW, 'tr_b')
  return [a, b]
}

const mem = (init: Record<string, string> = {}): TrialStorage => {
  const m = new Map(Object.entries(init))
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }
}

describe('exportTrails', () => {
  it('writes the declarative envelope, keys in the documented order', async () => {
    const t = await trails()
    const json = exportTrails(t, EXPORTED_AT)
    const parsed = JSON.parse(json)
    expect(Object.keys(parsed)).toEqual(['formatVersion', 'exportedAt', 'app', 'declaratif', 'trials'])
    expect(parsed).toMatchObject({ formatVersion: 1, exportedAt: EXPORTED_AT, app: 'tekpractice', declaratif: true })
    expect(parsed.trials).toHaveLength(2)
  })

  it('accepts a Date for exportedAt', async () => {
    expect(JSON.parse(exportTrails([], new Date(EXPORTED_AT))).exportedAt).toBe(EXPORTED_AT)
  })
})

describe('importTrails', () => {
  it('round trip is exact: same trials (deep equal), and re-export gives the same bytes', async () => {
    const t = await trails()
    const json = exportTrails(t, EXPORTED_AT)
    const r = await importTrails(json)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rejected).toBe(0)
    expect(r.trials).toEqual(t)
    expect(Object.isFrozen(r.trials[0])).toBe(true)
    expect(exportTrails(r.trials, EXPORTED_AT)).toBe(json)
  })

  it('a trial whose design was edited (fingerprint mismatch) is rejected, the others kept', async () => {
    const t = await trails()
    const env = JSON.parse(exportTrails(t, EXPORTED_AT))
    env.trials[1].design.placements[0].position_m[0] = 5
    const r = await importTrails(JSON.stringify(env))
    expect(r).toMatchObject({ ok: true, rejected: 1 })
    if (r.ok) expect(r.trials.map((x) => x.id)).toEqual(['tr_a'])
  })

  it('a trial failing the strict schema (extra field, empty prediction) is rejected', async () => {
    const t = await trails()
    const env = JSON.parse(exportTrails(t, EXPORTED_AT))
    env.trials[0].extra = 1
    env.trials[1].evidence.prediction.text = '  '
    const r = await importTrails(JSON.stringify(env))
    expect(r).toEqual({ ok: true, trials: [], rejected: 2 })
  })

  it('a duplicated id inside the file: the second copy is rejected', async () => {
    const [a] = await trails()
    const r = await importTrails(exportTrails([a, a], EXPORTED_AT))
    expect(r).toMatchObject({ ok: true, rejected: 1 })
    if (r.ok) expect(r.trials).toHaveLength(1)
  })

  it.each([
    ['not JSON', '{oops', 'corrupt'],
    ['another app', JSON.stringify({ formatVersion: 1, exportedAt: EXPORTED_AT, app: 'other', declaratif: true, trials: [] }), 'format'],
    ['missing declaratif', JSON.stringify({ formatVersion: 1, exportedAt: EXPORTED_AT, app: 'tekpractice', trials: [] }), 'format'],
    ['trials not an array', JSON.stringify({ formatVersion: 1, exportedAt: EXPORTED_AT, app: 'tekpractice', declaratif: true, trials: {} }), 'format'],
    ['a newer format', JSON.stringify({ formatVersion: 2, exportedAt: EXPORTED_AT, app: 'tekpractice', declaratif: true, trials: [] }), 'version'],
    ['a quarantine file', JSON.stringify({ formatVersion: 1, kind: 'quarantine', exportedAt: EXPORTED_AT, app: 'tekpractice', declaratif: true, items: [] }), 'format'],
  ])('%s → { ok:false, reason:%s } (envelope errors are returned, not thrown)', async (_l, json, reason) => {
    expect(await importTrails(json)).toEqual({ ok: false, reason })
  })

  it('no hasher → crypto-unavailable (nothing can be verified)', async () => {
    const t = await trails()
    const failing = async (): Promise<string> => {
      throw new Error('no subtle')
    }
    expect(await importTrails(exportTrails(t, EXPORTED_AT), failing)).toEqual({ ok: false, reason: 'crypto-unavailable' })
  })
})

describe('exportQuarantine', () => {
  const item = { at: '2026-10-24T09:00:00.000Z', raw: '{broken', reason: 'json' }

  it('wraps the quarantine items (and the raw main key, the only full copy when truncated) in a declarative envelope', () => {
    const s = mem({ [QUARANTINE_KEY]: JSON.stringify({ version: 1, items: [item] }), [TRIALS_KEY]: '{broken' })
    const r = exportQuarantine(s, EXPORTED_AT)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const env = JSON.parse(r.json)
    expect(Object.keys(env)).toEqual(['formatVersion', 'kind', 'exportedAt', 'app', 'declaratif', 'items', 'trialsRaw', 'rigItems'])
    expect(env).toEqual({
      formatVersion: 1,
      kind: 'quarantine',
      exportedAt: EXPORTED_AT,
      app: 'tekpractice',
      declaratif: true,
      items: [item],
      trialsRaw: '{broken',
      rigItems: [],
    })
    expect(r.items).toBe(1)
  })

  it('also carries the saved-rig quarantine (audio-sim/rigs.v2.quarantine) as rigItems', () => {
    const rigItem = { at: '2026-10-24T09:30:00.000Z', raw: '{"version":2,"rigs":[{"name":1}]}', reason: 'schema:rigs.0.name' }
    const s = mem({ [RIGS_QUARANTINE_KEY]: JSON.stringify({ version: 1, items: [rigItem] }) })
    const r = exportQuarantine(s, EXPORTED_AT)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const env = JSON.parse(r.json)
    expect(env.rigItems).toEqual([rigItem])
    expect(env.items).toEqual([])
    expect(env.trialsRaw).toBeNull()
    expect(r.items).toBe(1)
  })

  it('an unreadable quarantine is exported as one raw item, never dropped', () => {
    const s = mem({ [QUARANTINE_KEY]: 'garbage' })
    const r = exportQuarantine(s, EXPORTED_AT)
    expect(r.ok).toBe(true)
    if (r.ok) expect(JSON.parse(r.json).items).toEqual([{ at: EXPORTED_AT, raw: 'garbage', reason: 'quarantine-unreadable' }])
  })

  it('nothing set aside → { ok:false, reason:"empty" }', () => {
    expect(exportQuarantine(mem(), EXPORTED_AT)).toEqual({ ok: false, reason: 'empty' })
  })

  it('blocked storage → { ok:false, reason:"storage" } (returned, not thrown)', () => {
    const blocked: TrialStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => undefined,
    }
    expect(exportQuarantine(blocked, EXPORTED_AT)).toEqual({ ok: false, reason: 'storage' })
  })

  it('never writes to storage', () => {
    const writes: string[] = []
    const s = mem({ [QUARANTINE_KEY]: JSON.stringify({ version: 1, items: [item] }) })
    const spy: TrialStorage = { getItem: s.getItem, setItem: (k) => void writes.push(k) }
    exportQuarantine(spy, EXPORTED_AT)
    expect(writes).toEqual([])
  })

  it('a quarantine export is refused by importTrails (different kind)', async () => {
    const s = mem({ [QUARANTINE_KEY]: JSON.stringify({ version: 1, items: [item] }) })
    const r = exportQuarantine(s, EXPORTED_AT)
    if (r.ok) expect(await importTrails(r.json)).toEqual({ ok: false, reason: 'format' })
  })
})
