/**
 * Wave 1b findings 8 and 13: what a promoted Wave 1 device SAYS must be what its datasheet and its model support.
 *  - 8: a desk carries only the controls its spec documents; the ProFX12v3 and the Rodecaster Pro II had an invented master mute and balance;
 *  - 13: realWorld.model names what is modelled (the PSM 300 is the P3T transmitter only, the SLX-D the SLXD4 receiver only) and typicalUse is an accurate
 *    short English sentence, not a raw knowledge-base leftover ("small PA" for a mixer, "home studio" for a patchbay, "live vocals" for a receiver).
 */
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadPlan } from '../../tools/equipmentPlan'

interface Dev { id: string; realWorld: { model: string; typicalUse: string; category: string }; controls?: { id: string }[] }
const catalog = (JSON.parse(readFileSync('content/catalog.json', 'utf8')) as { devices: Dev[] }).devices
const wave1 = loadPlan().filter((r) => r.wave === 1 && r.promoted === true)

describe('desk controls come from the spec (finding 8)', () => {
  for (const id of ['mackie-profx12v3', 'rode-rodecaster-pro-ii']) {
    it(`${id}: no invented master mute or balance, and its catalogue controls are exactly its spec's`, () => {
      const d = catalog.find((x) => x.id === id)!
      const ids = (d.controls ?? []).map((c) => c.id)
      expect(ids).not.toContain('mute-master')
      expect(ids).not.toContain('balance-master')
      const spec = JSON.parse(readFileSync(`content/asset-specs/${id}.json`, 'utf8')) as { controls: { controlId: string }[] }
      expect([...spec.controls.map((c) => c.controlId)].sort()).toEqual([...ids].sort())
      // review fix 13: the master fader range is not on any sheet read, so the Rodecaster has no control and no layout at all
      if (!existsSync(`content/control-layouts/${id}.json`)) return expect(ids, id).toEqual([])
      const layout = JSON.parse(readFileSync(`content/control-layouts/${id}.json`, 'utf8')) as { controls: { catalogControl?: string }[] }
      expect(layout.controls.map((c) => c.catalogControl)).not.toContain('mute-master')
      expect(layout.controls.map((c) => c.catalogControl)).not.toContain('balance-master')
      expect(layout.controls.map((c) => c.catalogControl)).not.toContain('fader-master')
    })
  }
})

describe('realWorld text of the promoted Wave 1 devices (finding 13)', () => {
  it('there are promoted Wave 1 devices to check', () => expect(wave1.length).toBeGreaterThanOrEqual(19))
  it('model names only what is modelled', () => {
    expect(catalog.find((d) => d.id === 'shure-psm-300')!.realWorld.model).toBe('PSM 300 (P3T transmitter)')
    expect(catalog.find((d) => d.id === 'shure-slx-d')!.realWorld.model).toBe('SLX-D (SLXD4 receiver)')
    for (const r of wave1) expect(catalog.find((d) => d.id === r.id)!.realWorld.model, r.id).not.toMatch(/P3R|bodypack|SLXD[123]\b/i)
  })
  it.each(wave1.map((r) => r.id))('%s: typicalUse is a full sentence (capitalised, at least 6 words), not a lower-case knowledge-base fragment', (id) => {
    const u = catalog.find((d) => d.id === id)!.realWorld.typicalUse
    expect(u).toMatch(/^[A-Z]/)
    expect(u.split(/\s+/).length).toBeGreaterThanOrEqual(6)
    expect(u).not.toMatch(/\(\w[\w -]*\)$/) // not the boilerplate "Brand Model (category)"
  })
  it('the raw leftovers are gone', () => {
    const all = catalog.filter((d) => wave1.some((r) => r.id === d.id)).map((d) => d.realWorld.typicalUse)
    for (const raw of ['small PA', 'small / medium PA', 'home studio', 'live vocals', 'near-field mixing', 'band in-ear monitoring', 'home and project studio vocals', 'master word clock for a small studio'])
      expect(all, raw).not.toContain(raw)
  })
})
