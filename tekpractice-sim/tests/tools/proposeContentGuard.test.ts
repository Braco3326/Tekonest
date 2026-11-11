/**
 * Task 0.2 (Wave 0, Review Focus 1): `npm run sync:kb` regenerates the proposals file wholesale, so a promotion must survive it.
 * The pure merge lives in tools/proposalMerge.ts (propose-content.ts is a script: importing it would run it).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mergeProposals, type Proposal } from '../../tools/proposalMerge'
import { loadPlan, type PlanRow } from '../../tools/equipmentPlan'

const prop = (id: string, over: Record<string, unknown> = {}): Proposal => ({
  id,
  label: `Label ${id}`,
  levels: [],
  realWorld: { brand: 'B', model: id, category: 'amplifier', typicalUse: 'u', notes: 'n' },
  ports: [{ portId: 'in-1', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro' }],
  ...over,
})

const row = (id: string, over: Partial<PlanRow> = {}): PlanRow => ({
  id,
  status: 'beta',
  category: 'amplifier',
  manufacturer: 'B',
  product: id,
  sizeMm: { w: 483, d: 400, h: 88 },
  portsSummary: '',
  family: 'rack-box-v2',
  dataQuality: 'datasheet',
  tier: 1,
  wave: 1,
  sources: [],
  notes: '',
  traits: [],
  sizeConfidence: 'ok',
  ...over,
})

describe('mergeProposals', () => {
  it('skips ids present in the catalogue', () => {
    const r = mergeProposals([prop('a'), prop('in-cat')], [], [], new Set(['in-cat']))
    expect(r.devices.map((d) => d.id)).toEqual(['a'])
    expect(r.dropped).toEqual([{ id: 'in-cat', reason: expect.stringContaining('catalogue') }])
  })

  it('skips a promoted plan row even when the catalogue set does not list it yet (the marker is enough: no resurrection)', () => {
    const r = mergeProposals([prop('a'), prop('p')], [prop('p')], [row('p', { promoted: true }), row('a')], new Set())
    expect(r.devices.map((d) => d.id)).toEqual(['a'])
    expect(r.dropped[0]).toMatchObject({ id: 'p', reason: expect.stringContaining('promoted') })
  })

  it('never creates a proposal for a plan row that is a new device (status new): one id, one place', () => {
    const r = mergeProposals([prop('n'), prop('a')], [], [row('n', { status: 'new' })], new Set())
    expect(r.devices.map((d) => d.id)).toEqual(['a'])
  })

  it('but a new row that was beta-modelled keeps its hand-built proposal (the sync neither drops nor regenerates it)', () => {
    const bm = prop('nb', { sizeMm: { w: 1, d: 1, h: 1 } })
    const r = mergeProposals([prop('a')], [bm], [row('nb', { status: 'new', betaModelled: true })], new Set())
    expect(r.devices.map((d) => d.id)).toEqual(['a', 'nb'])
    expect(r.devices[1]).toBe(bm)
  })

  it("does not overwrite a beta-modelled proposal: the existing entry (its sizeMm, ports, label) is kept as it is", () => {
    const existing = prop('bm', { label: 'Edité', sizeMm: { w: 100, d: 50, h: 20 }, ports: [{ portId: 'main-out', dir: 'out', connector: 'xlr3-m', signal: 'mic-level' }] })
    const generated = prop('bm', { label: 'Régénéré' })
    const r = mergeProposals([generated], [existing], [row('bm', { betaModelled: true })], new Set())
    expect(r.devices).toEqual([existing])
    expect(r.devices[0]).toBe(existing)
  })

  it('keeps a beta-modelled proposal the knowledge base no longer generates, but not an ordinary stale one', () => {
    const bm = prop('bm', { sizeMm: { w: 1, d: 2, h: 3 } })
    const stale = prop('stale')
    const r = mergeProposals([prop('a')], [bm, stale], [row('bm', { betaModelled: true })], new Set())
    expect(r.devices.map((d) => d.id)).toEqual(['a', 'bm'])
  })

  it('a beta-modelled id that became promoted or entered the catalogue is dropped even though it is kept otherwise', () => {
    const bm = prop('bm')
    expect(mergeProposals([], [bm], [row('bm', { betaModelled: true, promoted: true })], new Set()).devices).toEqual([])
    expect(mergeProposals([], [bm], [row('bm', { betaModelled: true })], new Set(['bm'])).devices).toEqual([])
  })

  it('gives an ordinary proposal the plan size (the axes the plan has, none when it has none): the placeholder box uses it', () => {
    const r = mergeProposals(
      [prop('full'), prop('part'), prop('none'), prop('unplanned')],
      [],
      [row('full'), row('part', { dataQuality: 'estimate', sizeMm: { w: 25, h: 155.7 } }), row('none', { dataQuality: 'missing', sizeMm: {} })],
      new Set(),
    )
    const size = (id: string) => r.devices.find((d) => d.id === id)!.sizeMm
    expect(size('full')).toEqual({ w: 483, d: 400, h: 88 })
    expect(size('part')).toEqual({ w: 25, h: 155.7 })
    expect(size('none')).toBeUndefined()
    expect(size('unplanned')).toBeUndefined()
  })

  it('does not mutate its inputs', () => {
    const g = [prop('a')]
    const e = [prop('a')]
    const before = JSON.stringify([g, e])
    mergeProposals(g, e, [row('a')], new Set())
    expect(JSON.stringify([g, e])).toBe(before)
  })

  it('running twice yields identical output (idempotent), also when beta-modelled entries are involved', () => {
    const generated = [prop('a'), prop('bm', { label: 'Régénéré' }), prop('p')]
    const existing = [prop('bm', { label: 'Edité', sizeMm: { w: 9, d: 9, h: 9 } })]
    const plan = [row('a'), row('bm', { betaModelled: true }), row('p', { promoted: true })]
    const once = mergeProposals(generated, existing, plan, new Set())
    const twice = mergeProposals(generated, once.devices, plan, new Set())
    expect(twice.devices).toEqual(once.devices)
    expect(JSON.stringify(twice.devices)).toBe(JSON.stringify(once.devices))
  })
})

describe('the committed proposals file against the plan', () => {
  const file = JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as { devices: Proposal[] }
  const catalogIds = new Set((JSON.parse(readFileSync('content/catalog.json', 'utf8')) as { devices: { id: string }[] }).devices.map((d) => d.id))
  const plan = loadPlan()

  it('is a fixed point of the guard: feeding it back changes nothing (a sync cannot overwrite it)', () => {
    const r = mergeProposals(file.devices, file.devices, plan, catalogIds)
    expect(r.devices).toEqual(file.devices)
    expect(r.dropped).toEqual([])
  })

  it('holds no promoted id and no id of the catalogue, and every non-promoted Bêta plan row is in it', () => {
    const ids = new Set(file.devices.map((d) => d.id))
    for (const r of plan.filter((x) => x.promoted)) expect(ids.has(r.id), `${r.id} is promoted but still a proposal`).toBe(false)
    for (const id of catalogIds) expect(ids.has(id), `${id} is in the catalogue and in the proposals`).toBe(false)
    for (const r of plan.filter((x) => x.status === 'beta' && !x.promoted)) expect(ids.has(r.id), `${r.id} fell out of the proposals`).toBe(true)
  })

  it('carries the plan size on every Bêta proposal that has one (the placeholder reads it)', () => {
    for (const r of plan.filter((x) => x.status === 'beta' && !x.promoted && Object.keys(x.sizeMm).length)) {
      const d = file.devices.find((x) => x.id === r.id)!
      expect(d.sizeMm, r.id).toEqual(r.sizeMm)
    }
  })
})
