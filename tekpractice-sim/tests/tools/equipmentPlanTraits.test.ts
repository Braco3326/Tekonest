/**
 * Wave 0b findings 7 (sizeConfidence), 2, 3 and 8 (traits): the plan rows carry the traits the behaviour templates read and a size confidence that
 * keeps an unsure size out of the verified catalogue. Everything here runs on the REAL plan (content/proposals/equipment-plan.json), plus a few
 * fixtures for the schema's refusals.
 */
import { describe, expect, it } from 'vitest'
import { TRAITS, axisCount, effectiveQuality, loadPlan, parsePlan, type PlanRow } from '../../tools/equipmentPlan'
import { deriveSizeConfidence } from '../../tools/import-equipment-plan'

const rows = loadPlan()
const byId = new Map(rows.map((r) => [r.id, r]))
const row = (id: string): PlanRow => {
  const r = byId.get(id)
  if (!r) throw new Error(`no plan row ${id}`)
  return r
}
const has = (id: string, ...traits: string[]): boolean => traits.every((t) => (row(id).traits as string[]).includes(t))

describe('sizeConfidence (finding 7): an unsure size can never be promoted', () => {
  it('every row has one, and it is consistent with the size: one or two stored axes are partial, a complete size never is (Wave 0c: partial may also have none stored, its numbers are in the notes)', () => {
    for (const r of rows) {
      const n = axisCount(r.sizeMm)
      if (n >= 1 && n <= 2) expect(r.sizeConfidence, `${r.id}: ${n} axes`).toBe('partial')
      if (r.sizeConfidence === 'partial') expect(n, `${r.id}: partial`).toBeLessThanOrEqual(2)
    }
  })

  it('dataQuality is exactly what effectiveQuality says for the research grade, the size and the confidence (nothing promotable is unsure)', () => {
    for (const r of rows) expect(r.dataQuality, r.id).toBe(effectiveQuality(r.sourceGrade ?? r.dataQuality, r.sizeMm, r.sizeConfidence))
    for (const r of rows.filter((x) => x.dataQuality === 'datasheet' || x.dataQuality === 'dealer')) {
      expect(r.sizeConfidence, r.id).toBe('ok')
      expect(axisCount(r.sizeMm), r.id).toBe(3)
    }
  })

  it('the rows the reviewer named are no longer promotable: an assumed axis order, a conflict between sources, or only some axes', () => {
    const expected: Record<string, string> = {
      'radial-prodi': 'axis-assumed', // « axis order assumed W x D x H »
      'radial-jdi': 'axis-assumed',
      'countryman-type-85': 'axis-assumed',
      'behringer-xr18': 'axis-assumed', // « order inferred from 3U »
      'yamaha-tf5': 'axis-assumed', // figures read from a search summary
      'allen-heath-sq-5': 'axis-assumed',
      'focusrite-scarlett-2i2-4th-gen': 'conflict', // depth 117 against 99
      'midas-dl16': 'conflict', // depth 270 or 220
      'jbl-305p-mkii': 'conflict', // JBL US page prints another depth
      'allen-heath-qu-16': 'conflict',
      'royer-r-121': 'partial', // width and height only
      'focusrite-rednet-mp8r': 'partial',
    }
    for (const [id, conf] of Object.entries(expected)) {
      expect(row(id).sizeConfidence, id).toBe(conf)
      expect(['datasheet', 'dealer'], id).not.toContain(row(id).dataQuality)
    }
  })

  it('a conflict about the weight, the ports or the generation does not make the size unsure (labelled axes, one source)', () => {
    for (const id of ['zoom-h6-essential', 'klark-teknik-dn360', 'rode-procaster', 'audient-id14-mkii', 'akg-d112-mkii', 'telos-zephyr-xstream', 'yamaha-dxr12-mkii'])
      expect(row(id).sizeConfidence, id).toBe('ok')
  })

  it('the schema refuses a datasheet or dealer row whose confidence is not ok, and a partial flag that disagrees with the axes', () => {
    const file = (r: unknown) => ({ version: 1, generated: '2026-11-12', rows: [r] })
    const base = { ...row('shure-beta-58a'), id: 'fixture' }
    expect(() => parsePlan(file({ ...base, sizeConfidence: 'conflict' }))).toThrow(/sizeConfidence/)
    expect(() => parsePlan(file({ ...base, sizeConfidence: 'axis-assumed' }))).toThrow(/sizeConfidence/)
    expect(() => parsePlan(file({ ...base, dataQuality: 'estimate', sizeConfidence: 'conflict' }))).not.toThrow()
    expect(() => parsePlan(file({ ...base, dataQuality: 'estimate', sizeConfidence: 'partial' }))).toThrow(/partial/)
    expect(() => parsePlan(file({ ...base, dataQuality: 'estimate', sizeMm: { w: 1 }, sizeConfidence: 'ok' }))).toThrow(/partial/)
  })

  it('the importer derives the confidence from the notes the same way (a CONFLICT about the weight alone is not one)', () => {
    const full = { w: 1, d: 1, h: 1 }
    expect(deriveSizeConfidence('Radial spec page [M]. Axis order assumed W x D x H.', full)).toBe('axis-assumed')
    expect(deriveSizeConfidence('order inferred from 3U', full)).toBe('axis-assumed')
    expect(deriveSizeConfidence('figures via search', full)).toBe('axis-assumed')
    expect(deriveSizeConfidence('CONFLICT depth 117 (Focusrite) vs 99 (dealers)', full)).toBe('conflict')
    expect(deriveSizeConfidence('weight CONFLICT 354 g (catalog) / 385 (spec)', full)).toBe('ok')
    expect(deriveSizeConfidence('anything', { w: 1, h: 2 })).toBe('partial')
    expect(deriveSizeConfidence('anything', {})).toBe('ok')
  })
})

describe('traits (findings 2, 3, 8): known, complete and consistent', () => {
  it('every row has a traits list made only of known traits, without duplicates', () => {
    for (const r of rows) {
      expect(Array.isArray(r.traits), r.id).toBe(true)
      for (const t of r.traits) expect(TRAITS as readonly string[], `${r.id}: ${t}`).toContain(t)
      expect(new Set(r.traits).size, r.id).toBe(r.traits.length)
    }
  })

  it('every microphone has exactly one capsule trait; a ribbon is passive and never phantom-powered; a phantom-powered mic is a condenser', () => {
    for (const r of rows.filter((x) => x.category === 'microphone')) {
      const caps = r.traits.filter((t) => t === 'condenser' || t === 'ribbon' || t === 'dynamic')
      expect(caps, r.id).toHaveLength(1)
      if (r.traits.includes('ribbon')) {
        expect(r.traits, r.id).toContain('passive')
        expect(r.traits, r.id).not.toContain('phantom-powered')
      }
      if (r.traits.includes('phantom-powered')) expect(r.traits, r.id).toContain('condenser')
      if (r.traits.includes('dynamic')) expect(r.traits, r.id).not.toContain('phantom-powered')
    }
  })

  it('real microphones: TLM 103 and C414 are phantom-powered condensers, the R-121 and the 4038 ribbons, the SM7B a dynamic, a tube U 67 is externally powered', () => {
    expect(has('neumann-tlm-103', 'condenser', 'phantom-powered')).toBe(true)
    expect(has('akg-c414-xlii', 'condenser', 'phantom-powered')).toBe(true)
    expect(has('royer-r-121', 'ribbon')).toBe(true)
    expect(has('coles-4038', 'ribbon')).toBe(true)
    expect(has('shure-sm7b', 'dynamic')).toBe(true)
    expect(has('neumann-u-67', 'condenser', 'active')).toBe(true)
    expect(has('neumann-u-67', 'phantom-powered')).toBe(false)
  })

  it('wireless and IEM rows: a handheld or body-pack is a battery transmitter (no rack, no receiver); a receiver is rack-mounted; every row is one of the two halves or an antenna', () => {
    for (const r of rows.filter((x) => x.category === 'wireless' || x.category === 'iem')) {
      const t = r.traits as string[]
      if (t.includes('handheld') || t.includes('bodypack')) {
        expect(t, r.id).toEqual(expect.arrayContaining(['transmitter', 'battery']))
        expect(t, r.id).not.toContain('receiver')
        expect(t, r.id).not.toContain('rack')
      }
      if (t.includes('receiver')) expect(t, r.id).toContain('rack')
      expect(t.includes('receiver') || t.includes('transmitter') || t.includes('active'), `${r.id} is neither half of a system nor an antenna`).toBe(true)
    }
    expect(has('shure-slxd1-bodypack', 'transmitter', 'bodypack', 'battery')).toBe(true)
    expect(has('shure-slxd2-handheld', 'transmitter', 'handheld', 'battery')).toBe(true)
    expect(has('shure-qlx-d-receiver', 'receiver', 'rack')).toBe(true)
    expect(has('shure-psm-300', 'transmitter', 'rack')).toBe(true) // the rack IEM transmitter has a mains inlet
  })

  it('amplifier rows are power amplifiers or processors, never both; the DriveRack PA2, the DCX2496 and the compressors are processors', () => {
    for (const r of rows.filter((x) => x.category === 'amplifier')) expect(r.traits.filter((t) => t === 'power-amp' || t === 'processor'), r.id).toHaveLength(1)
    expect(has('dbx-driverack-pa2', 'processor')).toBe(true)
    expect(has('behringer-dcx2496', 'processor')).toBe(true)
    expect(has('crown-xls-2502', 'power-amp')).toBe(true)
    for (const id of ['ua-1176ln', 'dbx-166xs', 'ua-la-2a', 'dbx-160a']) expect(has(id, 'processor'), id).toBe(true)
  })

  it('consoles are desks (the template builds their routing), monitor controllers say so, speakers are active or passive', () => {
    for (const r of rows.filter((x) => x.category.startsWith('console'))) expect(r.traits, r.id).toContain('desk')
    expect(has('yamaha-tf5', 'desk')).toBe(true)
    expect(has('allen-heath-sq-5', 'desk')).toBe(true)
    for (const r of rows.filter((x) => x.category === 'monitor-controller')) expect(r.traits, r.id).toContain('monitor-controller')
    for (const r of rows.filter((x) => ['powered-speaker', 'studio-monitor', 'speaker'].includes(x.category)))
      expect(r.traits.filter((t) => t === 'active' || t === 'passive'), r.id).toHaveLength(1)
    expect(has('yamaha-ns-10m', 'passive')).toBe(true)
    expect(has('qsc-ks118', 'active')).toBe(true) // a powered subwoofer filed under « speaker »
  })

  it('active DI boxes need power from phantom or a battery, passive ones from nothing', () => {
    expect(has('radial-j48', 'active', 'phantom-powered')).toBe(true)
    expect(has('countryman-type-85', 'active', 'battery')).toBe(true)
    expect(has('radial-jdi', 'passive')).toBe(true)
    expect(has('radial-prodi', 'passive')).toBe(true)
  })
})
