import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import footprintsJson from '../../src/plan2d/footprints.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { CATEGORY_FAMILY, DEFAULT_BOX_M, GLYPHS, familyOf, footprintOf } from '../../src/plan2d/symbols'
import { deriveFootprints } from '../../tools/plan2d-footprints'

const registry = loadCatalog(catalogJson)

describe('footprints: one number, one place (the asset spec of each device)', () => {
  it('src/plan2d/footprints.json is exactly what the asset specs say (npm run footprints:plan2d)', () => {
    expect(footprintsJson).toEqual(deriveFootprints())
  })
  it('every catalogue device has a footprint from its own spec file', () => {
    for (const d of registry.catalog.devices) {
      const f = footprintOf(d.id)
      expect(f.known, d.id).toBe(true)
      expect(f.source, d.id).toBe(`content/asset-specs/${d.id}.json`)
    }
  })
  it('metres from millimetres, unchanged (QSC K12.2: 356 x 350 mm in its spec)', () => {
    expect(footprintOf('qsc-k12-2')).toMatchObject({ w: 0.356, d: 0.35, known: true })
  })
  it('a device with no footprint gets the default box and says so (known: false, no source); never an invented size', () => {
    expect(footprintOf('not-a-device')).toEqual({ w: DEFAULT_BOX_M, d: DEFAULT_BOX_M, known: false, source: null })
  })
})

describe('symbols: one glyph per device family (sheet §1.5)', () => {
  it('every category of the catalogue is mapped explicitly (none falls into « unknown » by accident)', () => {
    for (const d of registry.catalog.devices) expect(CATEGORY_FAMILY[d.realWorld.category], `${d.id}: ${d.realWorld.category}`).toBeDefined()
  })
  it('the families of the sheet', () => {
    expect(familyOf('microphone')).toBe('micro')
    expect(familyOf('powered-speaker')).toBe('speaker')
    expect(familyOf('studio-monitor')).toBe('speaker')
    expect(familyOf('headphones')).toBe('headphones')
    expect(familyOf('amplifier')).toBe('amp')
    expect(familyOf('console-digital')).toBe('console')
    expect(familyOf('stagebox')).toBe('rack')
    expect(familyOf('di-box')).toBe('box')
    expect(familyOf('a-category-nobody-knows')).toBe('unknown')
  })
  it('each glyph is path data in the unit square, with the sheet’s confidence tag and its words', () => {
    for (const [family, g] of Object.entries(GLYPHS)) {
      expect(g.d, family).toMatch(/^M/)
      for (const n of g.d.match(/-?\d*\.?\d+/g) ?? []) expect(Math.abs(Number(n)), `${family}: ${n}`).toBeLessThanOrEqual(0.5)
      expect(g.confidence, family).toBe('OUR PROPOSAL')
    }
    expect(GLYPHS.speaker.after).toMatch(/IEC 60617 S01059 \(drawing unseen\)/)
    expect(GLYPHS.amp.after).toMatch(/UNVERIFIED/)
    expect(GLYPHS.unknown.labelled).toBe(true)
  })
})
