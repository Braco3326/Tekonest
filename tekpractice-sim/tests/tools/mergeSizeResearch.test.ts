/**
 * Wave 0c: the merge of the four size-research files into the equipment plan (tools/merge-size-research.ts).
 * The data under test is the REAL plan (content/proposals/equipment-plan.json, after the merge) and the committed copy of the four result files
 * (content/proposals/size-research/); tests/tools/fixtures/plan-sizes-before-0c.json holds the sizes the plan carried before the merge
 * (125 rows). Fixtures only exercise the rules in isolation.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PlanFile, axisCount, effectiveQuality, loadPlan, parsePlan, type PlanRow, type SizeMmT } from '../../tools/equipmentPlan'
import {
  CURATED,
  WAVE_0C_MARK,
  baselineClassification,
  classify,
  cleanSourceUrl,
  loadResults,
  mergeAll,
  mergeRow,
  sourcesToAdd,
  summarize,
  type ResearchResultT,
} from '../../tools/merge-size-research'

const rows = loadPlan()
const byId = new Map(rows.map((r) => [r.id, r]))
const results = loadResults()
const resultById = new Map(results.map((r) => [r.id, r]))
const before = JSON.parse(readFileSync('tests/tools/fixtures/plan-sizes-before-0c.json', 'utf8')) as Record<string, SizeMmT>
const row = (id: string): PlanRow => {
  const r = byId.get(id)
  if (!r) throw new Error(`no plan row ${id}`)
  return r
}

const sample = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: 'fixture-device',
  status: 'new',
  category: 'outboard',
  manufacturer: 'Marque',
  product: 'Modele',
  sizeMm: {},
  portsSummary: '',
  family: 'rack-box-v2',
  dataQuality: 'missing',
  sourceGrade: 'datasheet',
  tier: 1,
  wave: 1,
  sources: ['https://www.marque.example/modele'],
  notes: 'Old note.',
  traits: [],
  sizeConfidence: 'ok',
  ...over,
})
const result = (over: Partial<ResearchResultT> = {}): ResearchResultT => ({
  id: 'fixture-device',
  sizeMm: { w: 482, d: 250, h: 44 },
  weightKg: 2.5,
  sourceGrade: 'datasheet',
  sources: ['https://www.marque.example/modele/specs'],
  portsText: 'XLR in, XLR out',
  colour: null,
  notes: 'Spec sheet labels W x D x H.',
  ...over,
})

describe('the merge rules, on fixtures', () => {
  it('rows already datasheet keep sizes (a disagreeing result is logged, not written)', () => {
    const old = sample({ dataQuality: 'datasheet', sizeMm: { w: 10, d: 20, h: 30 }, sizeConfidence: 'ok' })
    const m = mergeRow(old, result({ sizeMm: { w: 11, d: 21, h: 31 }, sourceGrade: 'dealer' }))
    expect(m.row.sizeMm).toEqual({ w: 10, d: 20, h: 30 })
    expect(m.row.dataQuality).toBe('datasheet')
    expect(m.row.notes).toBe(old.notes)
    expect(m.events.map((e) => e.kind)).toContain('existing-size-disagrees')
    // the same size is not a disagreement
    expect(mergeRow(old, result({ sizeMm: { w: 10, d: 20, h: 30 } })).events.map((e) => e.kind)).not.toContain('existing-size-disagrees')
    // a dealer row keeps it too
    const dealer = sample({ dataQuality: 'dealer', sizeMm: { w: 1, d: 2, h: 3 } })
    expect(mergeRow(dealer, result()).row.sizeMm).toEqual({ w: 1, d: 2, h: 3 })
  })

  it('rows already datasheet keep sizes (the real plan: every row that had a size before the merge still has it, untouched)', () => {
    expect(Object.keys(before)).toHaveLength(125)
    for (const [id, size] of Object.entries(before)) {
      expect(row(id).sizeMm, id).toEqual(size)
      expect(resultById.has(id), `${id} was not in the research`).toBe(false)
    }
  })

  it('a complete labelled triple of a datasheet gives sizeMm, the grade and datasheet quality; weight only when the plan has none', () => {
    const m = mergeRow(sample(), result())
    expect(m.row.sizeMm).toEqual({ w: 482, d: 250, h: 44 })
    expect(m.row.sizeConfidence).toBe('ok')
    expect(m.row.dataQuality).toBe('datasheet')
    expect(m.row.weightKg).toBe(2.5)
    expect(m.row.notes.startsWith('Old note.')).toBe(true)
    expect(m.row.notes).toContain(WAVE_0C_MARK)
    const keep = mergeRow(sample({ weightKg: 9 }), result())
    expect(keep.row.weightKg).toBe(9)
    expect(keep.events.map((e) => e.kind)).toContain('weight-disagrees')
    // a dealer result is dealer quality
    expect(mergeRow(sample(), result({ sourceGrade: 'dealer' })).row.dataQuality).toBe('dealer')
  })

  it('partial result writes no sizeMm (the numbers go to the notes, sizeConfidence partial, the row stays missing)', () => {
    const m = mergeRow(sample(), result({ sizeMm: { w: 482, d: null, h: 44 }, notes: 'Depth not printed.' }))
    expect(m.row.sizeMm).toEqual({})
    expect(m.row.sizeConfidence).toBe('partial')
    expect(m.row.dataQuality).toBe('missing')
    expect(m.row.notes).toMatch(/Partial axes .*w 482, h 44 mm/)
    expect(() => parsePlan({ version: 1, generated: '2026-11-12', rows: [m.row] })).not.toThrow()
    const real = row('shure-mv7-plus')
    expect(real.sizeMm).toEqual({})
    expect(real.sizeConfidence).toBe('partial')
    expect(real.notes).toMatch(/Partial axes .*h 164 mm/)
  })

  it('conflict note forces sizeConfidence conflict and null sizes (the held-back value stays in the notes)', () => {
    const m = mergeRow(sample(), result({ notes: 'CONFLICT on depth: product page 200 mm vs manual 242 mm.' }))
    expect(m.row.sizeConfidence).toBe('conflict')
    expect(m.row.sizeMm).toEqual({})
    expect(m.row.dataQuality).toBe('missing')
    expect(m.row.notes).toMatch(/Held-back size .*w 482, d 250, h 44 mm/)
    expect(m.row.notes).toContain('200 mm vs manual 242 mm')
    // a conflict about the weight, the ports or a packaging figure is not a size conflict
    const w = mergeRow(sample(), result({ notes: 'WEIGHT CONFLICT: 2.5 kg (manual) vs 3 kg (dealer). Spec sheet labels W x D x H.' }))
    expect(w.row.sizeConfidence).toBe('ok')
    expect(w.row.sizeMm).toEqual({ w: 482, d: 250, h: 44 })
  })

  it('an assumed or unlabelled axis order makes the size an estimate (kept in sizeMm, beta-modelled at best)', () => {
    for (const notes of ['Axes unlabelled; read as H x W x D.', 'Figures from a search summary, 482 x 250 x 44 mm.', 'Axis order assumed W x D x H.']) {
      const m = mergeRow(sample(), result({ notes }))
      expect(m.row.sizeConfidence, notes).toBe('axis-assumed')
      expect(m.row.sizeMm, notes).toEqual({ w: 482, d: 250, h: 44 })
      expect(m.row.dataQuality, notes).toBe('estimate')
    }
  })

  it('a full triple without a source grade is not stored and not ok', () => {
    const m = mergeRow(sample({ sourceGrade: 'missing' }), result({ sourceGrade: null }))
    expect(m.row.sizeMm).toEqual({})
    expect(m.row.dataQuality).toBe('missing')
    expect(m.row.sizeConfidence).not.toBe('ok')
  })

  it('a cable definition row keeps no box size: the connector pair goes in the notes and the quality stays missing', () => {
    const cable = sample({ category: 'cable', family: 'cable-assembly-v2' })
    const m = mergeRow(cable, result({ portsText: 'XLR3 female to XLR3 male, balanced', notes: 'Typical lengths 1.5, 3, 6 m.' }))
    expect(m.row.sizeMm).toEqual({})
    expect(m.row.dataQuality).toBe('missing')
    expect(m.row.family).toBe('cable-assembly-v2')
    expect(m.row.notes).toContain('Connector definition: XLR3 female to XLR3 male, balanced')
    expect(m.row.notes).toContain('Typical lengths 1.5, 3, 6 m.')
  })

  it('a product no source documents (Telos Xenon) is blocked: no such product found', () => {
    const m = mergeRow(sample({ id: 'telos-xenon', product: 'Xenon', manufacturer: 'Telos' }), result({ id: 'telos-xenon' }))
    expect(m.row.dataQuality).toBe('missing')
    expect(m.row.sizeMm).toEqual({})
    expect(m.row.notes).toMatch(/no such product found/)
    expect(m.events.map((e) => e.kind)).toContain('blocked')
    expect(rows.some((r) => /xenon/i.test(`${r.id} ${r.product}`)), 'the plan has no Xenon row').toBe(false)
  })

  it('the merge is idempotent: a merged row is not changed again (the real plan is a fixed point of the merge)', () => {
    const once = mergeRow(sample(), result())
    expect(mergeRow(once.row, result()).row).toEqual(once.row)
    const again = mergeAll(rows, results)
    expect(again.rows).toEqual(rows)
  })

  it('a source URL is cleaned (annotation dropped, spaces encoded) and only URLs the result gives are added, after the existing ones', () => {
    expect(cleanSourceUrl('https://x.example/a.pdf (403 on direct fetch; figures read from search-result summaries of it)')).toBe('https://x.example/a.pdf')
    expect(cleanSourceUrl('https://www.thomannmusic.com/neumann_usm_69i_501783.htm (search summary)')).toBe('https://www.thomannmusic.com/neumann_usm_69i_501783.htm')
    expect(cleanSourceUrl('https://edge.rode.com//pdf/products/75/NT4 Datasheet.pdf')).toBe('https://edge.rode.com//pdf/products/75/NT4%20Datasheet.pdf')
    expect(cleanSourceUrl('https://goknight.com/doc/Spec_EN (1) (2).pdf')).toBe('https://goknight.com/doc/Spec_EN%20(1)%20(2).pdf')
    expect(cleanSourceUrl('not a url')).toBeUndefined()
    const { add, dropped } = sourcesToAdd('Marque', 'outboard', [
      'https://www.thomannmusic.com/modele.htm',
      'https://en.wikipedia.org/wiki/Modele',
      'https://www.marque.example/modele/specs.pdf',
    ])
    expect(add).toEqual(['https://www.marque.example/modele/specs.pdf', 'https://www.thomannmusic.com/modele.htm'])
    expect(dropped).toEqual(['https://en.wikipedia.org/wiki/Modele'])
    const m = mergeRow(sample(), result({ sources: ['https://www.marque.example/modele', 'https://www.marque.example/modele/specs'] }))
    expect(m.row.sources).toEqual(['https://www.marque.example/modele', 'https://www.marque.example/modele/specs'])
  })

  it('the text classifier: conflict, then partial, then axis-assumed, then ok', () => {
    const full = { w: 1, d: 1, h: 1 }
    expect(baselineClassification('CONFLICT depth 117 vs 99 mm.', full).confidence).toBe('conflict')
    expect(baselineClassification('Weight conflict: 1.5 vs 1.2 kg.', full).confidence).toBe('ok')
    expect(baselineClassification('CONFLICT depth.', { w: 1, d: null, h: 1 }).confidence).toBe('conflict')
    expect(baselineClassification('Depth not printed.', { w: 1, d: null, h: 1 }).confidence).toBe('partial')
    expect(baselineClassification('Axes unlabelled: 3 x 5 x 2 in.', full).confidence).toBe('axis-assumed')
    expect(baselineClassification('Datasheet labels W x D x H.', full).confidence).toBe('ok')
    expect(baselineClassification('NOT FOUND.', { w: null, d: null, h: null }).confidence).toBe('ok')
  })
})

describe('the real plan after the merge', () => {
  it('Kara II ends with null size and conflict (both values kept in the notes)', () => {
    const k = row('l-acoustics-kara-ii')
    expect(k.sizeMm).toEqual({})
    expect(k.sizeConfidence).toBe('conflict')
    expect(k.dataQuality).toBe('missing')
    expect(k.notes).toContain('733')
    expect(k.notes).toContain('701')
    expect(resultById.get('l-acoustics-kara-ii')!.sizeMm).toEqual({ w: 733, d: 500, h: 252 }) // the research file did fill one source's value
  })

  it('dataQuality equals effectiveQuality for every row', () => {
    for (const r of rows) expect(r.dataQuality, r.id).toBe(effectiveQuality(r.sourceGrade ?? r.dataQuality, r.sizeMm, r.sizeConfidence))
    for (const r of rows.filter((x) => x.dataQuality === 'datasheet' || x.dataQuality === 'dealer')) {
      expect(r.sizeConfidence, r.id).toBe('ok')
      expect(axisCount(r.sizeMm), r.id).toBe(3)
    }
  })

  it('plan still validates: unique ids, 315 rows', () => {
    expect(rows).toHaveLength(315)
    expect(new Set(rows.map((r) => r.id)).size).toBe(315)
    expect(PlanFile.safeParse(JSON.parse(readFileSync('content/proposals/equipment-plan.json', 'utf8'))).success).toBe(true)
    expect(results).toHaveLength(190)
    expect(results.every((r) => byId.has(r.id))).toBe(true)
  })

  it('no size value in the plan is absent from the result files or the old plan', () => {
    for (const r of rows) {
      const stored = r.sizeMm
      if (axisCount(stored) === 0) continue
      const old = before[r.id]
      const res = resultById.get(r.id)
      for (const k of ['w', 'd', 'h'] as const) {
        if (stored[k] == null) continue
        const fromOld = old?.[k] === stored[k]
        const fromResult = res?.sizeMm[k] === stored[k]
        expect(fromOld || fromResult, `${r.id}.${k} = ${stored[k]}`).toBe(true)
      }
      // a size taken from the research is a whole triple the research gave, with its grade
      if (!old) {
        expect(res, `${r.id} has a size but no research`).toBeDefined()
        expect(stored).toEqual({ w: res!.sizeMm.w, d: res!.sizeMm.d, h: res!.sizeMm.h })
        expect(res!.sourceGrade, r.id).not.toBeNull()
      }
    }
  })

  it('nothing outside the research changed: the 125 rows that were not researched are untouched, the 190 only gain the merge', () => {
    for (const r of rows.filter((x) => !resultById.has(x.id))) expect(r.notes.includes(WAVE_0C_MARK), r.id).toBe(false)
    for (const r of rows.filter((x) => resultById.has(x.id))) expect(r.notes.includes(WAVE_0C_MARK), r.id).toBe(true)
  })

  it('sizeConfidence ok needs a complete size and a datasheet or dealer grade; conflict, partial and no-grade rows store no size', () => {
    for (const r of rows.filter((x) => resultById.has(x.id))) {
      const res = resultById.get(r.id)!
      if (r.sizeConfidence === 'conflict' || r.sizeConfidence === 'partial') expect(axisCount(r.sizeMm), r.id).toBe(0)
      if (axisCount(r.sizeMm) === 3) expect(res.sourceGrade, r.id).not.toBeNull()
      if (r.dataQuality === 'datasheet' || r.dataQuality === 'dealer') expect(r.dataQuality, r.id).toBe(res.sourceGrade)
    }
  })

  it('every result URL that may be a source is in its row, after the existing ones; nothing else was added', () => {
    for (const res of results) {
      const r = row(res.id)
      const { add } = sourcesToAdd(r.manufacturer, r.category, res.sources)
      for (const u of add) expect(r.sources, `${r.id}: ${u}`).toContain(u)
      const allowed = new Set(add)
      const extra = r.sources.filter((u) => allowed.has(u))
      expect(extra.length).toBe(add.length)
    }
    for (const r of rows) for (const u of r.sources) expect(/^https?:\/\/\S+$/.test(u), `${r.id}: ${u}`).toBe(true)
  })

  it('cable and connector definition rows keep no box size and stay missing, with their connector pair in the notes', () => {
    const cables = rows.filter((r) => resultById.has(r.id) && (r.family === 'cable-assembly' || r.family === 'cable-assembly-v2'))
    expect(cables.length).toBeGreaterThanOrEqual(8)
    for (const r of cables) {
      expect(r.sizeMm, r.id).toEqual({})
      expect(r.dataQuality, r.id).toBe('missing')
      if (resultById.get(r.id)!.portsText) expect(r.notes, r.id).toContain('Connector definition:')
    }
  })

  it('round bodies keep the plan convention: w = d = diameter for every microphone body the research mapped as one', () => {
    for (const r of rows.filter((x) => resultById.has(x.id) && axisCount(x.sizeMm) === 3 && /Round body/.test(resultById.get(x.id)!.notes))) {
      expect(r.sizeMm.w, r.id).toBe(r.sizeMm.d)
      expect(r.sizeMm.h!, r.id).toBeGreaterThan(r.sizeMm.w!)
    }
    // the existing convention, for reference
    expect(row('shure-beta-58a').sizeMm).toEqual({ w: 50, d: 50, h: 160 })
    expect(row('audix-d6').sizeMm).toEqual({ w: 51, d: 51, h: 117 })
    expect(row('neumann-u-67').sizeMm).toEqual({ w: 56, d: 56, h: 200 })
  })

  it('every curated reading has a reason, a known label, and names a row of the research', () => {
    for (const [id, c] of Object.entries(CURATED)) {
      expect(resultById.has(id), id).toBe(true)
      expect(c.reason.length, id).toBeGreaterThan(15)
      expect(['ok', 'axis-assumed', 'conflict', 'partial']).toContain(c.confidence)
      expect(classify(id, resultById.get(id)!)).toEqual(c)
    }
  })

  it('the named rows end where the reading of the notes puts them', () => {
    const expected: Record<string, [string, string]> = {
      'aea-r84': ['datasheet', 'ok'],
      'audix-d6': ['datasheet', 'ok'],
      'dbx-166xs': ['estimate', 'axis-assumed'], // axes unlabelled
      'yamaha-ns-10m': ['estimate', 'axis-assumed'], // axis order inferred
      'canare-162u-x21': ['estimate', 'axis-assumed'],
      'l-acoustics-kara-ii': ['missing', 'conflict'],
      'tascam-da-6400': ['missing', 'conflict'],
      'spl-phonitor-x': ['missing', 'conflict'],
      'shure-psm-900': ['missing', 'conflict'],
      'crown-xls-2502': ['missing', 'conflict'],
      'radial-j48': ['missing', 'axis-assumed'], // L x W x D printed, which edge is the height is not stated
      'k-m-25400': ['missing', 'axis-assumed'],
      'rode-psa1-plus': ['missing', 'partial'],
      'sommer-cable-the-boxx-mp-08-04': ['missing', 'partial'],
      'telos-hx2': ['missing', 'ok'], // nothing found
    }
    for (const [id, [q, c]] of Object.entries(expected)) {
      expect([row(id).dataQuality, row(id).sizeConfidence], id).toEqual([q, c])
    }
  })

  it('the counts of the merge: promotable plus beta-modelled plus blocked is the whole plan, per wave', () => {
    const s = summarize(rows)
    let promotable = 0
    for (const [w, c] of Object.entries(s.byWave)) {
      expect(c.promotable! + c['beta-modelled']! + c.blocked!, `wave ${w}`).toBe(c.total)
      promotable += c.promotable!
    }
    expect(promotable).toBe(rows.filter((r) => r.dataQuality === 'datasheet' || r.dataQuality === 'dealer').length)
  })
})
