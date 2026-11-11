/**
 * Task 0.1 (build-all-equipment, Wave 0): the machine-readable equipment plan.
 * The data under test is content/proposals/equipment-plan.json, generated once from the research CSV by
 * tools/import-equipment-plan.ts; the fixtures only exercise the loader's failure paths.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  KNOWN_FAMILIES,
  PlanFile,
  effectiveQuality,
  loadPlan,
  parsePlan,
  planRows,
  type PlanRow,
} from '../../tools/equipmentPlan'
import { parseCsv, rowFromCsv, urlsIn } from '../../tools/import-equipment-plan'

const rows = loadPlan()
const proposals = JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as { devices: { id: string }[] }
const catalog = JSON.parse(readFileSync('content/catalog.json', 'utf8')) as { devices: { id: string }[] }

const sample = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: 'fixture-device',
  status: 'new',
  category: 'microphone',
  manufacturer: 'Marque',
  product: 'Modele',
  sizeMm: { w: 10, d: 10, h: 10 },
  portsSummary: 'xlr',
  family: 'revolve',
  dataQuality: 'datasheet',
  tier: 1,
  wave: 1,
  sources: [],
  notes: '',
  ...over,
})

describe('the plan file', () => {
  it('loads 315 rows with unique ids (134 Bêta + 181 new)', () => {
    expect(rows).toHaveLength(315)
    expect(new Set(rows.map((r) => r.id)).size).toBe(315)
    expect(rows.filter((r) => r.status === 'beta')).toHaveLength(134)
    expect(rows.filter((r) => r.status === 'new')).toHaveLength(181)
  })

  it('every beta row id exists in catalog-proposals.json, and no new row does (one id, one place)', () => {
    const proposalIds = new Set(proposals.devices.map((d) => d.id))
    for (const r of rows.filter((x) => x.status === 'beta')) expect(proposalIds.has(r.id), r.id).toBe(true)
    for (const r of rows.filter((x) => x.status === 'new')) expect(proposalIds.has(r.id), `${r.id} is in the proposals`).toBe(false)
  })

  it('no row id exists in catalog.json (promoted ids are flagged on the row and leave the proposals, never the reverse)', () => {
    const catalogIds = new Set(catalog.devices.map((d) => d.id))
    const promoted = rows.filter((r) => r.promoted === true).map((r) => r.id)
    for (const r of rows) {
      if (r.promoted) continue // a promoted row IS in the catalogue (Task 0.4)
      expect(catalogIds.has(r.id), r.id).toBe(false)
    }
    for (const id of promoted) expect(catalogIds.has(id), id).toBe(true)
  })

  it('rows with dataQuality datasheet or dealer have all three sizes positive (a partial size is an estimate, never a datasheet)', () => {
    for (const r of rows.filter((x) => x.dataQuality === 'datasheet' || x.dataQuality === 'dealer'))
      for (const k of ['w', 'd', 'h'] as const) expect(r.sizeMm[k], `${r.id}.${k}`).toBeGreaterThan(0)
  })

  it('a missing row carries no complete size and an estimate row says what was estimated: nothing is promoted on guessed numbers', () => {
    for (const r of rows.filter((x) => x.dataQuality === 'missing')) {
      const n = (['w', 'd', 'h'] as const).filter((k) => (r.sizeMm[k] ?? 0) > 0).length
      expect(n, `${r.id} has a full size but is graded missing`).toBeLessThan(3)
    }
    for (const r of rows.filter((x) => x.dataQuality === 'estimate')) expect(r.sourceGrade, r.id).toBeDefined()
  })

  it('no size is zero, negative or NaN', () => {
    for (const r of rows)
      for (const v of Object.values(r.sizeMm)) expect(Number.isFinite(v) && (v as number) > 0, `${r.id}: ${String(v)}`).toBe(true)
  })

  it('every row has a wave 1 to 5, a tier 1 to 3 and a known family', () => {
    for (const r of rows) {
      expect([1, 2, 3, 4, 5], r.id).toContain(r.wave)
      expect([1, 2, 3], r.id).toContain(r.tier)
      expect(KNOWN_FAMILIES, r.id).toContain(r.family)
    }
  })

  it('sources are http(s) URLs, never blank strings', () => {
    for (const r of rows) for (const s of r.sources) expect(s, r.id).toMatch(/^https?:\/\/\S+$/)
  })

  it('counts by wave match the research table: 49 / 87 / 92 / 70 / 17', () => {
    expect([1, 2, 3, 4, 5].map((w) => planRows({ wave: w }).length)).toEqual([49, 87, 92, 70, 17])
  })
})

describe('planRows', () => {
  it('planRows({ wave: 1 }) is 49 rows, filters combine, and a filter matching nothing gives an empty list', () => {
    expect(planRows({ wave: 1 })).toHaveLength(49)
    const w1rack = planRows({ wave: 1, family: 'rack-box-v2' })
    expect(w1rack.length).toBeGreaterThan(0)
    for (const r of w1rack) expect([r.wave, r.family]).toEqual([1, 'rack-box-v2'])
    expect(planRows({ wave: 1, family: 'no-such-family' })).toEqual([])
    expect(planRows({ status: 'new', tier: 1 }).every((r) => r.status === 'new' && r.tier === 1)).toBe(true)
    expect(planRows({}).length).toBe(315)
  })
})

describe('parsePlan (the loader)', () => {
  const file = (r: unknown[]) => ({ version: 1, generated: '2026-11-11', rows: r })

  it('throws on a duplicate id', () => {
    expect(() => parsePlan(file([sample(), sample()]))).toThrow(/duplicate/i)
  })

  it('rejects a family that is not in the known list', () => {
    expect(() => parsePlan(file([sample({ family: 'made-up-family' as 'revolve' })]))).toThrow(/family/i)
    expect(parsePlan(file([sample({ family: 'rack-box-v3b' })]))).toHaveLength(1)
  })

  it('rejects a datasheet or dealer row with a partial size, and a negative or zero size', () => {
    expect(() => parsePlan(file([sample({ sizeMm: { w: 10, h: 10 } })]))).toThrow(/size/i)
    expect(() => parsePlan(file([sample({ sizeMm: { w: 0, d: 10, h: 10 } })]))).toThrow()
    expect(() => parsePlan(file([sample({ sizeMm: { w: -1, d: 10, h: 10 } })]))).toThrow()
    expect(parsePlan(file([sample({ dataQuality: 'estimate', sizeMm: { w: 10 } })]))).toHaveLength(1)
    expect(parsePlan(file([sample({ dataQuality: 'missing', sizeMm: {} })]))).toHaveLength(1)
  })

  it('rejects a wave or tier out of range and a malformed file', () => {
    expect(() => parsePlan(file([sample({ wave: 6 as 5 })]))).toThrow()
    expect(() => parsePlan(file([sample({ tier: 4 as 3 })]))).toThrow()
    expect(() => parsePlan({})).toThrow()
    expect(PlanFile.safeParse(null).success).toBe(false)
  })

  it('rejects a source that is not an http(s) URL', () => {
    expect(() => parsePlan(file([sample({ sources: ['see the datasheet'] })]))).toThrow()
  })
})

describe('effectiveQuality (what the research graded vs what a size actually supports)', () => {
  it('keeps datasheet / dealer for a complete size, estimate for a partial one, missing for none', () => {
    expect(effectiveQuality('datasheet', { w: 1, d: 1, h: 1 })).toBe('datasheet')
    expect(effectiveQuality('dealer', { w: 1, d: 1, h: 1 })).toBe('dealer')
    expect(effectiveQuality('datasheet', { w: 25, h: 155.7 })).toBe('estimate')
    expect(effectiveQuality('dealer', {})).toBe('missing')
    expect(effectiveQuality('missing', {})).toBe('missing')
    expect(effectiveQuality('estimate', { w: 1, d: 1, h: 1 })).toBe('estimate')
    expect(effectiveQuality('missing', { w: 1, d: 1, h: 1 })).toBe('missing') // the research said no source: stay blocked
  })
})

describe('the importer (CSV to plan row)', () => {
  it('parses quoted fields, commas and doubled quotes', () => {
    expect(parseCsv('a,b\n1,"x, ""y"""\n')).toEqual([['a', 'b'], ['1', 'x, "y"']])
  })

  it('takes URLs from a notes column, drops trailing punctuation, and keeps the first occurrence only', () => {
    expect(urlsIn('Source: https://a.example/x.pdf, and (https://b.example/y). Again https://a.example/x.pdf;')).toEqual([
      'https://a.example/x.pdf',
      'https://b.example/y',
    ])
    expect(urlsIn('no link here')).toEqual([])
  })

  it('maps a CSV row: blank sizes are absent (never 0), the CSV grade is kept, rack-box-v3-sloped is the plan name rack-box-v3-slope', () => {
    const csv = {
      id: 'x', status: 'new', category: 'microphone', manufacturer: 'M', product: 'P', width_mm: '25', depth_mm: '', height_mm: '155.7',
      weight_kg: '', ports_summary: 'xlr', shape_family: 'rack-box-v3-sloped', data_quality: 'datasheet', priority_tier: '2', wave: '3', notes: 'n https://z.example/a',
    }
    const row = rowFromCsv(csv)
    expect(row.sizeMm).toEqual({ w: 25, h: 155.7 })
    expect(row.weightKg).toBeUndefined()
    expect(row.family).toBe('rack-box-v3-slope')
    expect(row.sourceGrade).toBe('datasheet')
    expect(row.dataQuality).toBe('estimate')
    expect(row.sources).toEqual(['https://z.example/a'])
    expect([row.tier, row.wave, row.status]).toEqual([2, 3, 'new'])
  })
})
