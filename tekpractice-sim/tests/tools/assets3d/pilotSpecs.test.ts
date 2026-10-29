import { describe, expect, it } from 'vitest'
import { checkSpecParity, loadSpecs } from '../../../tools/assets3d/loadSpecs'
import type { AssetSpecT, FaceT } from '../../../tools/assets3d/specSchema'
import { findKbEntry, parseDimensionsMm } from '../../../tools/assets3d/spec-skeleton'
import { makeRegistry } from '../../helpers'

const DEVICES = ['shure-sm58', 'yamaha-ql1', 'yamaha-rio3224-d2'] as const
const CONNECTORS = ['xlr3-f', 'trs-quarter', 'rj45'] as const
const PILOT = [...DEVICES, ...CONNECTORS]

const catalog = makeRegistry().catalog
const all = loadSpecs()
const byId = (id: string): AssetSpecT => {
  const spec = all.find((s) => s.id === id)
  if (!spec) throw new Error(`content/asset-specs/${id}.json is missing`)
  return spec
}

/** Width and height of a face rectangle, in mm, in the face-local frame (x right, y up; on top/bottom y runs from the I/O edge). */
function faceRect(spec: AssetSpecT, face: FaceT): { w: number; h: number } {
  const { w, h, d } = spec.realSizeMm
  switch (face) {
    case 'io':
    case 'opposite': return { w, h }
    case 'top':
    case 'bottom': return { w, h: d }
    case 'left':
    case 'right': return { w: d, h }
  }
}

describe('pilot specs load and match the catalog', () => {
  it('loads all six pilot specs', () => {
    const ids = all.map((s) => s.id)
    for (const id of PILOT) expect(ids, `${id} is missing from content/asset-specs`).toContain(id)
  })

  it.each(PILOT)('%s passes catalog parity with zero errors', (id) => {
    expect(checkSpecParity(byId(id), catalog)).toEqual([])
  })

  it.each(DEVICES)('%s is a hero device', (id) => {
    const spec = byId(id)
    expect(spec.kind).toBe('device')
    expect(spec.tier).toBe('hero')
  })

  it.each(CONNECTORS)('%s is a connector with a mating role, no ports, no controls', (id) => {
    const spec = byId(id)
    expect(spec.kind).toBe('connector')
    expect(spec.tier).toBe('connector')
    expect(spec.ports).toEqual([])
    expect(spec.controls).toEqual([])
    expect(spec.mating?.role).toBe('plug')
  })

  it('the XLR and jack plugs carry the diameter that goes into the socket', () => {
    expect(byId('xlr3-f').mating?.outerMm).toBeGreaterThan(0)
    expect(byId('trs-quarter').mating?.outerMm).toBeGreaterThan(0)
  })

  it.each(DEVICES)('%s: every port and control sits inside its face rectangle', (id) => {
    const spec = byId(id)
    for (const p of spec.ports) {
      const r = faceRect(spec, p.face)
      expect(p.xMm, `${id} ${p.portId} xMm`).toBeLessThanOrEqual(r.w)
      expect(p.yMm, `${id} ${p.portId} yMm`).toBeLessThanOrEqual(r.h)
      if (p.openingMm !== undefined) {
        // the whole round opening, not just its centre, must fit on the face
        expect(p.xMm - p.openingMm / 2, `${id} ${p.portId} opening left`).toBeGreaterThanOrEqual(0)
        expect(p.xMm + p.openingMm / 2, `${id} ${p.portId} opening right`).toBeLessThanOrEqual(r.w)
        expect(p.yMm - p.openingMm / 2, `${id} ${p.portId} opening bottom`).toBeGreaterThanOrEqual(0)
        expect(p.yMm + p.openingMm / 2, `${id} ${p.portId} opening top`).toBeLessThanOrEqual(r.h)
      }
    }
    for (const c of spec.controls) {
      const r = faceRect(spec, c.face)
      expect(c.xMm, `${id} ${c.controlId} xMm`).toBeLessThanOrEqual(r.w)
      expect(c.yMm, `${id} ${c.controlId} yMm`).toBeLessThanOrEqual(r.h)
    }
  })

  it('the I/O face of the QL1 and the Rio3224-D2 carries most of the modelled ports; the SM58 has no io face', () => {
    for (const id of ['yamaha-ql1', 'yamaha-rio3224-d2']) {
      const spec = byId(id)
      const onIo = spec.ports.filter((p) => p.face === 'io').length
      expect(onIo, `${id} ports on io`).toBeGreaterThan(spec.ports.length / 2)
    }
    expect(byId('shure-sm58').ports.every((p) => p.face === 'bottom')).toBe(true)
  })

  it.each(PILOT)('%s cites at least one https source', (id) => {
    const spec = byId(id)
    expect(spec.sources.length).toBeGreaterThan(0)
    expect(spec.sources.some((s) => s.url.startsWith('https://'))).toBe(true)
    for (const s of spec.sources) expect(s.url, `${id} source url`).toMatch(/^https:\/\//)
  })

  it('every manual-confidence port is justified by a manual or datasheet source', () => {
    for (const spec of all.filter((s) => PILOT.includes(s.id as (typeof PILOT)[number]))) {
      if (spec.ports.some((p) => p.confidence === 'manual'))
        expect(spec.sources.some((s) => s.kind === 'manual' || s.kind === 'datasheet'), spec.id).toBe(true)
    }
  })

  /**
   * Device size against knowledge-base/equipment key_specs.dimensions, within 2 mm.
   * The QL1 ("W 468mm x H 272mm x D 562mm") and the Rio3224-D2 ("W 480 mm x H 220 mm x D 368 mm") parse with the
   * skeleton's parser. The SM58's KB string is "162 mm (6-3/8 in.) L x 51 mm (2 in.) W": length and diameter only,
   * which parseDimensionsMm rightly refuses (no depth axis), so the mic is checked by hand: it stands upright with the
   * XLR end down, so h is its length (L) and w = d is its diameter (W).
   */
  it.each(DEVICES)('%s size matches the knowledge base within 2 mm', (id) => {
    const spec = byId(id)
    const kb = findKbEntry(id)
    expect(kb, `${id} is not in the knowledge base`).not.toBeNull()
    const parsed = parseDimensionsMm(kb?.dimensions)
    if (parsed) {
      expect(Math.abs(spec.realSizeMm.w - parsed.w)).toBeLessThanOrEqual(2)
      expect(Math.abs(spec.realSizeMm.h - parsed.h)).toBeLessThanOrEqual(2)
      expect(Math.abs(spec.realSizeMm.d - parsed.d)).toBeLessThanOrEqual(2)
      return
    }
    expect(id).toBe('shure-sm58')
    const m = kb?.dimensions?.match(/^(\d+(?:\.\d+)?)\s*mm[^x]*L\s*x\s*(\d+(?:\.\d+)?)\s*mm[^x]*W/i)
    expect(m, `cannot read "${kb?.dimensions ?? ''}"`).not.toBeNull()
    const length = Number(m?.[1])
    const diameter = Number(m?.[2])
    expect(Math.abs(spec.realSizeMm.h - length)).toBeLessThanOrEqual(2)
    expect(Math.abs(spec.realSizeMm.w - diameter)).toBeLessThanOrEqual(2)
    expect(Math.abs(spec.realSizeMm.d - diameter)).toBeLessThanOrEqual(2)
  })
})
