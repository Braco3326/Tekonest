/**
 * Essais (Task 11): write-once store, quarantine (never removeItem), byte budget.
 * Storage is injected; it deliberately has NO removeItem.
 */
import { describe, expect, it, vi } from 'vitest'
import { CryptoUnavailableError, sha256hex } from '../../src/trials/fingerprint'
import { createTrial, type Trial } from '../../src/trials/trial'
import {
  type QuarantineItem,
  QUARANTINE_RAW_CAP,
  QUARANTINE_CAP,
  QUARANTINE_KEY,
  TRIALS_BUDGET,
  TRIALS_KEY,
  TrialStore,
  type TrialStorage,
} from '../../src/trials/store'
import { input, NOW } from './fixtures'

class MemStorage implements TrialStorage {
  data = new Map<string, string>()
  failNextSet: unknown = null
  failAllSets: unknown = null
  writes: string[] = []
  getItem(k: string): string | null {
    return this.data.has(k) ? (this.data.get(k) as string) : null
  }
  setItem(k: string, v: string): void {
    if (this.failAllSets) throw this.failAllSets
    if (this.failNextSet) {
      const e = this.failNextSet
      this.failNextSet = null
      throw e
    }
    this.writes.push(k)
    this.data.set(k, v)
  }
}

const quota = () => new DOMException('full', 'QuotaExceededError')

const trialA = () => createTrial(input(), NOW, 'tr_a')
async function trialB(parent: Trial) {
  const i = input({ parent, name: 'Essai B' })
  i.design.placements[1].position_m = [-3, 2.2, -9]
  return createTrial(i, NOW, 'tr_b')
}

const quarantineItems = (s: MemStorage) => JSON.parse(s.getItem(QUARANTINE_KEY) ?? 'null')?.items as { at: string; raw: string; reason: string }[]

describe('TrialStore: basics', () => {
  it('has the 1.5 MB budget and no removeItem in its storage contract', () => {
    const store = new TrialStore(new MemStorage())
    expect(store.budget).toBe(1_500_000)
    expect(TRIALS_BUDGET).toBe(1_500_000)
    expect(TRIALS_KEY).toBe('audio-sim/trials')
    expect(QUARANTINE_KEY).toBe('audio-sim/trials.quarantine')
  })

  it('loads empty when nothing is stored', async () => {
    const r = await new TrialStore(new MemStorage()).load()
    expect(r).toEqual({ trials: [], quarantined: false, warnings: [] })
  })

  it('appends and reloads as {version:1, trials}', async () => {
    const s = new MemStorage()
    const store = new TrialStore(s)
    await store.load()
    expect(await store.append(await trialA())).toEqual({ ok: true, warnings: [] })
    expect(JSON.parse(s.getItem(TRIALS_KEY) as string)).toMatchObject({ version: 1, trials: [{ id: 'tr_a' }] })
    const r = await new TrialStore(s).load()
    expect(r.quarantined).toBe(false)
    expect(r.trials.map((t) => t.id)).toEqual(['tr_a'])
    expect(Object.isFrozen(r.trials[0].design)).toBe(true)
  })

  it('refuses a duplicate id (append-only, never overwrite)', async () => {
    const store = new TrialStore(new MemStorage())
    await store.load()
    await store.append(await trialA())
    expect(await store.append(await trialA())).toEqual({ ok: false, reason: 'duplicate-id' })
  })

  it('refuses a trial whose fingerprint does not match its design', async () => {
    const store = new TrialStore(new MemStorage())
    await store.load()
    const t = JSON.parse(JSON.stringify(await trialA()))
    t.fingerprint = 'fp1:' + '0'.repeat(64)
    expect(await store.append(t)).toEqual({ ok: false, reason: 'invalid' })
  })
})

describe('TrialStore: concurrency (one serial queue)', () => {
  it('a write started during load() never clobbers the stored trials', async () => {
    const s = new MemStorage()
    const seed = new TrialStore(s)
    await seed.load()
    const a = await trialA()
    await seed.append(a)
    const b = await trialB(a)

    // The first hash (load's re-verification) is slow: it opens the race window.
    let calls = 0
    const slowFirst = async (text: string) => {
      await new Promise((r) => setTimeout(r, calls++ === 0 ? 30 : 0))
      return sha256hex(text)
    }
    const store = new TrialStore(s, { hash: slowFirst })
    const loading = store.load() // not awaited
    const appending = store.append(b) // not awaited
    await Promise.all([loading, appending])
    expect((await appending).ok).toBe(true)
    expect((await new TrialStore(s).load()).trials.map((t) => t.id)).toEqual(['tr_a', 'tr_b'])
  })

  it('a write with no prior load() loads first', async () => {
    const s = new MemStorage()
    const seed = new TrialStore(s)
    await seed.load()
    const a = await trialA()
    await seed.append(a)
    const store = new TrialStore(s)
    await store.append(await trialB(a))
    expect(store.list().map((t) => t.id)).toEqual(['tr_a', 'tr_b'])
  })

  it('append() then load() without awaiting: no deadlock, load sees the write', async () => {
    const store = new TrialStore(new MemStorage())
    const a = await trialA()
    const [w, r] = await Promise.all([store.append(a), store.load()])
    expect(w.ok).toBe(true)
    expect(r.trials.map((t) => t.id)).toEqual(['tr_a'])
  })

  it('two concurrent appends of the same id: one stored, the other duplicate-id', async () => {
    const s = new MemStorage()
    const store = new TrialStore(s)
    const a = await trialA()
    const [r1, r2] = await Promise.all([store.append(a), store.append(a)])
    expect([r1.ok, r2]).toEqual([true, { ok: false, reason: 'duplicate-id' }])
    expect((await new TrialStore(s).load()).trials).toHaveLength(1)
  })
})

describe('TrialStore: write-once', () => {
  it('rename changes only the name', async () => {
    const s = new MemStorage()
    const store = new TrialStore(s)
    await store.load()
    const a = await trialA()
    await store.append(a)
    expect((await store.rename('tr_a', 'Essai A – micro')).ok).toBe(true)
    const [t] = (await new TrialStore(s).load()).trials
    expect(t.name).toBe('Essai A – micro')
    expect({ ...t, name: a.name }).toEqual(a)
  })

  it('rename refuses an empty name and an unknown id', async () => {
    const store = new TrialStore(new MemStorage())
    await store.load()
    await store.append(await trialA())
    expect(await store.rename('tr_a', '  ')).toEqual({ ok: false, reason: 'empty' })
    expect(await store.rename('nope', 'x')).toEqual({ ok: false, reason: 'not-found' })
  })

  it('amendNote appends {text, at}; the note itself never changes', async () => {
    const s = new MemStorage()
    const store = new TrialStore(s)
    await store.load()
    await store.append(await trialA())
    await store.amendNote('tr_a', 'Le câble était inversé.', '2026-10-24T10:10:00.000Z')
    await store.amendNote('tr_a', 'Corrigé.', new Date('2026-10-24T10:11:00.000Z'))
    const [t] = (await new TrialStore(s).load()).trials
    expect(t.evidence.note).toBe('Premier montage.')
    expect(t.evidence.noteAmendments).toEqual([
      { text: 'Le câble était inversé.', at: '2026-10-24T10:10:00.000Z' },
      { text: 'Corrigé.', at: '2026-10-24T10:11:00.000Z' },
    ])
  })

  it('once a child exists, the parent note stays locked: only amendments, design untouched', async () => {
    const s = new MemStorage()
    const store = new TrialStore(s)
    await store.load()
    const a = await trialA()
    await store.append(a)
    await store.append(await trialB(a))
    expect((await store.amendNote('tr_a', 'Ajout après B.', NOW)).ok).toBe(true)
    const t = store.list().find((x) => x.id === 'tr_a') as Trial
    expect(t.evidence.note).toBe(a.evidence.note)
    expect(t.design).toEqual(a.design)
    expect(t.fingerprint).toBe(a.fingerprint)
    expect('setNote' in store).toBe(false)
  })

  it('amendNote refuses empty text', async () => {
    const store = new TrialStore(new MemStorage())
    await store.load()
    await store.append(await trialA())
    expect(await store.amendNote('tr_a', '', NOW)).toEqual({ ok: false, reason: 'empty' })
  })

  it('remove is an explicit learner action and keeps the rest', async () => {
    const s = new MemStorage()
    const store = new TrialStore(s)
    await store.load()
    const a = await trialA()
    await store.append(a)
    await store.append(await trialB(a))
    expect((await store.remove('tr_a')).ok).toBe(true)
    expect((await new TrialStore(s).load()).trials.map((t) => t.id)).toEqual(['tr_b'])
    expect(await store.remove('tr_a')).toEqual({ ok: false, reason: 'not-found' })
  })

  it('list() hands out frozen trials', async () => {
    const store = new TrialStore(new MemStorage())
    await store.load()
    await store.append(await trialA())
    expect(Object.isFrozen(store.list())).toBe(true)
    expect(Object.isFrozen(store.list()[0])).toBe(true)
  })
})

describe('TrialStore: quarantine (never removeItem)', () => {
  it('corrupt JSON → raw copied to quarantine, quarantined:true, empty list', async () => {
    const s = new MemStorage()
    s.data.set(TRIALS_KEY, '{"version":1,"trials":[{oops')
    const r = await new TrialStore(s, { now: () => NOW }).load()
    expect(r.quarantined).toBe(true)
    expect(r.trials).toEqual([])
    const items = quarantineItems(s)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ at: NOW, raw: '{"version":1,"trials":[{oops', reason: 'json' })
  })

  it('schema failure (strict: unknown field) → quarantine', async () => {
    const s = new MemStorage()
    const t = { ...(JSON.parse(JSON.stringify(await trialA())) as object), extra: 1 }
    s.data.set(TRIALS_KEY, JSON.stringify({ version: 1, trials: [t] }))
    const r = await new TrialStore(s).load()
    expect(r.quarantined).toBe(true)
    expect(quarantineItems(s)[0].reason).toMatch(/^schema/)
  })

  it('unknown version → quarantine (not reset)', async () => {
    const s = new MemStorage()
    s.data.set(TRIALS_KEY, JSON.stringify({ version: 2, trials: [] }))
    expect((await new TrialStore(s).load()).quarantined).toBe(true)
  })

  it('tampered fingerprint → quarantine', async () => {
    const s = new MemStorage()
    const store = new TrialStore(s)
    await store.load()
    await store.append(await trialA())
    const file = JSON.parse(s.getItem(TRIALS_KEY) as string)
    file.trials[0].design.placements[0].position_m[0] = 5 // edited by hand, fingerprint now stale
    const raw = JSON.stringify(file)
    s.data.set(TRIALS_KEY, raw)
    const r = await new TrialStore(s).load()
    expect(r.quarantined).toBe(true)
    expect(r.trials).toEqual([])
    expect(quarantineItems(s)[0]).toMatchObject({ raw, reason: 'fingerprint:tr_a' })
  })

  it('appends to an existing quarantine, never overwrites it', async () => {
    const s = new MemStorage()
    s.data.set(TRIALS_KEY, 'garbage-1')
    await new TrialStore(s).load()
    s.data.set(TRIALS_KEY, 'garbage-2')
    await new TrialStore(s).load()
    expect(quarantineItems(s).map((i) => i.raw)).toEqual(['garbage-1', 'garbage-2'])
  })

  it('does not quarantine the same raw twice on reload', async () => {
    const s = new MemStorage()
    s.data.set(TRIALS_KEY, 'garbage')
    await new TrialStore(s).load()
    await new TrialStore(s).load()
    expect(quarantineItems(s)).toHaveLength(1)
  })

  it(`caps the quarantine at ${QUARANTINE_CAP} items, dropping the oldest`, async () => {
    const s = new MemStorage()
    for (let i = 1; i <= QUARANTINE_CAP + 2; i++) {
      s.data.set(TRIALS_KEY, `garbage-${i}`)
      await new TrialStore(s).load()
    }
    const items = quarantineItems(s)
    expect(QUARANTINE_CAP).toBe(5)
    expect(items.map((i) => i.raw)).toEqual(['garbage-3', 'garbage-4', 'garbage-5', 'garbage-6', 'garbage-7'])
  })

  it('keeps an unreadable quarantine as an item instead of overwriting it', async () => {
    const s = new MemStorage()
    s.data.set(QUARANTINE_KEY, 'not json')
    s.data.set(TRIALS_KEY, 'garbage')
    await new TrialStore(s).load()
    const items = quarantineItems(s)
    expect(items.map((i) => [i.raw, i.reason])).toEqual([
      ['not json', 'quarantine-unreadable'],
      ['garbage', 'json'],
    ])
  })

  it('if the quarantine copy fails, the store goes read-only and the original is untouched', async () => {
    const s = new MemStorage()
    s.data.set(TRIALS_KEY, 'garbage')
    s.failAllSets = quota()
    const store = new TrialStore(s)
    const r = await store.load()
    expect(r.quarantined).toBe(true)
    expect(r.warnings).toContain('quarantine-failed')
    s.failAllSets = null
    expect(await store.append(await trialA())).toEqual({ ok: false, reason: 'read-only' })
    expect(s.getItem(TRIALS_KEY)).toBe('garbage')
  })

  it(`truncates a quarantined raw payload to ${QUARANTINE_RAW_CAP} chars, flagged truncated`, async () => {
    const s = new MemStorage()
    const big = 'x'.repeat(QUARANTINE_RAW_CAP + 50_000)
    s.data.set(TRIALS_KEY, big)
    await new TrialStore(s).load()
    const [item] = quarantineItems(s) as (QuarantineItem & { truncated?: boolean })[]
    expect(QUARANTINE_RAW_CAP).toBe(200_000)
    expect(item.raw.length).toBe(QUARANTINE_RAW_CAP)
    expect(item.truncated).toBe(true)
    // reloading the same big payload is still recognised (no duplicate item)
    await new TrialStore(s).load()
    expect(quarantineItems(s)).toHaveLength(1)
  })

  it('a truncated quarantine copy is incomplete → read-only, quarantine-truncated, main key untouched', async () => {
    const s = new MemStorage()
    const big = '{' + 'x'.repeat(QUARANTINE_RAW_CAP + 10)
    s.data.set(TRIALS_KEY, big)
    const store = new TrialStore(s)
    const r = await store.load()
    expect(r.quarantined).toBe(true)
    expect(r.warnings).toContain('quarantine-truncated')
    expect(await store.append(await trialA())).toEqual({ ok: false, reason: 'read-only' })
    expect(await store.remove('anything')).toEqual({ ok: false, reason: 'read-only' })
    expect(s.getItem(TRIALS_KEY)).toBe(big)
    // still protected on the next session
    const again = new TrialStore(s)
    expect((await again.load()).warnings).toContain('quarantine-truncated')
    expect(await again.append(await trialA())).toEqual({ ok: false, reason: 'read-only' })
    expect(s.getItem(TRIALS_KEY)).toBe(big)
  })

  it('warns quarantine-evicted when the cap drops the oldest item', async () => {
    const s = new MemStorage()
    const warnings: string[][] = []
    for (let i = 1; i <= QUARANTINE_CAP + 1; i++) {
      s.data.set(TRIALS_KEY, `garbage-${i}`)
      warnings.push((await new TrialStore(s).load()).warnings)
    }
    expect(warnings.slice(0, QUARANTINE_CAP).every((w) => !w.includes('quarantine-evicted'))).toBe(true)
    expect(warnings[QUARANTINE_CAP]).toContain('quarantine-evicted')
  })

  it('a quarantine item whose `at` is not an ISO date makes the file unreadable (kept as an item)', async () => {
    const s = new MemStorage()
    const bad = JSON.stringify({ version: 1, items: [{ at: 'hier', raw: 'r', reason: 'json' }] })
    s.data.set(QUARANTINE_KEY, bad)
    s.data.set(TRIALS_KEY, 'garbage')
    await new TrialStore(s).load()
    expect(quarantineItems(s).map((i) => [i.raw, i.reason])).toEqual([
      [bad, 'quarantine-unreadable'],
      ['garbage', 'json'],
    ])
  })

  it('exposes the quarantine read-only for export', async () => {
    const s = new MemStorage()
    s.data.set(TRIALS_KEY, 'garbage')
    const store = new TrialStore(s)
    await store.load()
    expect(store.quarantine().map((i) => i.raw)).toEqual(['garbage'])
    expect(Object.isFrozen(store.quarantine())).toBe(true)
  })
})

describe('TrialStore: thrown errors never escape', () => {
  const failingHash = async (): Promise<string> => {
    throw new Error('no crypto')
  }

  it('a canonicalise RangeError on load → quarantine', async () => {
    const s = new MemStorage()
    const t = JSON.parse(JSON.stringify(await trialA()))
    t.design.placements[0].position_m = [1e300, 0, 0] // finite, valid JSON, but cannot be quantised
    s.data.set(TRIALS_KEY, JSON.stringify({ version: 1, trials: [t] }))
    const r = await new TrialStore(s).load()
    expect(r.quarantined).toBe(true)
    expect(quarantineItems(s)[0].reason).toBe('canonicalize:tr_a')
  })

  it('a canonicalise RangeError on append → {ok:false, reason:"invalid"}', async () => {
    const store = new TrialStore(new MemStorage())
    const t = JSON.parse(JSON.stringify(await trialA()))
    t.design.placements[0].position_m = [1e300, 0, 0]
    expect(await store.append(t)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('no hasher (crypto.subtle missing) → read-only, crypto-unavailable, no quarantine', async () => {
    const s = new MemStorage()
    const seed = new TrialStore(s)
    await seed.append(await trialA())
    const before = s.getItem(TRIALS_KEY)
    const store = new TrialStore(s, { hash: failingHash })
    const r = await store.load()
    expect(r).toEqual({ trials: [], quarantined: false, warnings: ['crypto-unavailable'] })
    expect(s.getItem(QUARANTINE_KEY)).toBeNull()
    expect(await store.append(await trialA())).toEqual({ ok: false, reason: 'read-only' })
    expect(s.getItem(TRIALS_KEY)).toBe(before)
  })

  it('the default hasher with crypto.subtle stubbed away → crypto-unavailable', async () => {
    vi.stubGlobal('crypto', {})
    try {
      await expect(sha256hex('x')).rejects.toBeInstanceOf(CryptoUnavailableError)
      const r = await new TrialStore(new MemStorage()).load()
      expect(r.warnings).toEqual(['crypto-unavailable'])
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('TrialStore: writes and byte budget', () => {
  it('QuotaExceededError on write → {ok:false, reason:"quota"}, memory unchanged', async () => {
    const s = new MemStorage()
    const store = new TrialStore(s)
    await store.load()
    s.failNextSet = quota()
    expect(await store.append(await trialA())).toEqual({ ok: false, reason: 'quota' })
    expect(store.list()).toEqual([])
  })

  it('other storage errors → reason "storage" (never thrown, never silent)', async () => {
    const s = new MemStorage()
    const store = new TrialStore(s)
    await store.load()
    s.failNextSet = new DOMException('blocked', 'SecurityError')
    expect(await store.append(await trialA())).toEqual({ ok: false, reason: 'storage' })
  })

  it('bytesUsed() is the stored JSON length', async () => {
    const s = new MemStorage()
    const store = new TrialStore(s)
    await store.load()
    expect(store.bytesUsed()).toBe(0)
    await store.append(await trialA())
    expect(store.bytesUsed()).toBe((s.getItem(TRIALS_KEY) as string).length)
  })

  it('the budget is global: bytesUsed() = trials + quarantine (UTF-16 code units)', async () => {
    const s = new MemStorage()
    s.data.set(TRIALS_KEY, 'garbage')
    const a = await trialA()
    const oneTrialBytes = JSON.stringify({ version: 1, trials: [a] }).length
    const store = new TrialStore(s, { budget: oneTrialBytes + 10 })
    await store.load()
    const qBytes = (s.getItem(QUARANTINE_KEY) as string).length
    expect(store.bytesUsed()).toBe(qBytes)
    // the trial alone would fit, but not with the quarantine on top
    expect(await store.append(a)).toEqual({ ok: false, reason: 'budget' })
    const roomy = new TrialStore(s, { budget: oneTrialBytes + qBytes })
    expect((await roomy.append(a)).ok).toBe(true)
    expect(roomy.bytesUsed()).toBe(oneTrialBytes + qBytes)
  })

  it('append refuses when it would exceed the budget', async () => {
    const s = new MemStorage()
    const a = await trialA()
    const oneTrialBytes = JSON.stringify({ version: 1, trials: [a] }).length
    const store = new TrialStore(s, { budget: oneTrialBytes + 10 })
    await store.load()
    expect((await store.append(a)).ok).toBe(true)
    expect(await store.append(await trialB(a))).toEqual({ ok: false, reason: 'budget' })
    expect(store.list()).toHaveLength(1)
    // removing is always possible, even near the cap
    expect((await store.remove('tr_a')).ok).toBe(true)
  })

  it('warns near-budget at ≥ 80 %, on write and on load', async () => {
    const s = new MemStorage()
    const a = await trialA()
    const bytes = JSON.stringify({ version: 1, trials: [a] }).length
    const store = new TrialStore(s, { budget: Math.floor(bytes / 0.8) })
    await store.load()
    expect(await store.append(a)).toEqual({ ok: true, warnings: ['near-budget'] })
    expect((await new TrialStore(s, { budget: Math.floor(bytes / 0.8) }).load()).warnings).toEqual(['near-budget'])
    expect((await new TrialStore(s, { budget: Math.ceil(bytes / 0.79) }).load()).warnings).toEqual([])
  })

  it('a failed getItem (blocked storage) is reported, not thrown', async () => {
    const s = new MemStorage()
    s.getItem = () => {
      throw new DOMException('blocked', 'SecurityError')
    }
    const store = new TrialStore(s)
    const r = await store.load()
    expect(r).toMatchObject({ trials: [], warnings: ['storage-unavailable'] })
    expect(await store.append(await trialA())).toEqual({ ok: false, reason: 'read-only' })
  })
})
