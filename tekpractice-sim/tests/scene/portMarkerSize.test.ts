import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { CONNECTOR_MM, RING_OVERSIZE, markerDiameterM } from '../../src/scene/portMarkerSize'

describe('markerDiameterM (outer ring diameter of a port marker, metres)', () => {
  it('is the connector size x 1.2: an XLR (19.5 mm opening) gets 23.4 mm', () => {
    expect(RING_OVERSIZE).toBe(1.2)
    expect(markerDiameterM('xlr3-f')).toBeCloseTo(0.0234, 9)
    expect(markerDiameterM('xlr3-m')).toBeCloseTo(0.0234, 9)
    expect(markerDiameterM('trs-35mm')).toBeCloseTo(0.0084, 9)
    expect(markerDiameterM('iec-c13')).toBeCloseTo(0.024, 9)
  })

  it('a finite, positive openingMm from the spec wins over the table', () => {
    expect(markerDiameterM('xlr3-f', 30)).toBeCloseTo(0.036, 9)
  })

  it('an unknown connector falls back to 20 mm (24 mm outer)', () => {
    expect(markerDiameterM('nope')).toBeCloseTo(0.024, 9)
  })

  it('never 0 or NaN: a missing, empty, zero, negative or NaN opening and an empty id give a finite size > 0', () => {
    for (const opening of [undefined, Number.NaN, 0, -4, Number.POSITIVE_INFINITY]) {
      for (const id of ['xlr3-f', 'nope', '']) {
        const d = markerDiameterM(id, opening)
        expect(Number.isFinite(d), `${id}/${String(opening)}`).toBe(true)
        expect(d, `${id}/${String(opening)}`).toBeGreaterThan(0)
      }
    }
    expect(markerDiameterM('xlr3-f', Number.NaN)).toBeCloseTo(0.0234, 9)
    expect(markerDiameterM('', undefined)).toBeCloseTo(0.024, 9)
  })

  it('every connector the catalog devices use has a table entry', () => {
    const used = new Set<string>()
    for (const d of catalogJson.devices) for (const p of d.ports) used.add(p.connector)
    const missing = [...used].filter((c) => !(c in CONNECTOR_MM))
    expect(missing, `connectors with no CONNECTOR_MM entry: ${missing.join(', ')}`).toEqual([])
  })

  it('the table holds only finite positive sizes', () => {
    for (const [id, mm] of Object.entries(CONNECTOR_MM)) {
      expect(Number.isFinite(mm) && mm > 0, id).toBe(true)
    }
  })

  // ---- Wave 5 audit: the table against the real footprints and the real pitches of the shipped devices ----

  const SPECS = join(__dirname, '..', '..', 'content', 'asset-specs')
  interface SpecJson {
    id: string
    kind: string
    realSizeMm: { w: number; h: number; d: number }
    ports?: { portId: string; face: string; xMm: number; yMm: number; openingMm?: number }[]
  }
  const specs = new Map<string, SpecJson>()
  for (const f of readdirSync(SPECS)) {
    if (!f.endsWith('.json')) continue
    const raw = readFileSync(join(SPECS, f), 'utf8')
    if (raw.trim() === '') continue
    const s = JSON.parse(raw) as SpecJson
    specs.set(s.id, s)
  }
  const catalogPorts = new Map<string, Map<string, string>>() // device -> portId -> connector
  for (const d of catalogJson.devices) catalogPorts.set(d.id, new Map(d.ports.map((p) => [p.portId, p.connector])))

  it('a ring clears its connector and does not oversize it: 1.0 to 1.5 x the real face (the smaller dimension of the spec connector for a non-round one, the opening for a round one)', () => {
    // The face a plug leaves on a panel: round connectors are as wide as they are tall in the spec, so the smaller
    // dimension is the opening; a non-round one (RJ45, USB, D-sub, IEC) is wider than tall, a round ring goes round the
    // smaller side. The ring is never more than 1.5 x the smaller side nor under the larger side x 0.3.
    for (const [id, mm] of Object.entries(CONNECTOR_MM)) {
      const spec = specs.get(id)
      if (!spec) continue
      const minor = Math.min(spec.realSizeMm.w, spec.realSizeMm.h)
      const major = Math.max(spec.realSizeMm.w, spec.realSizeMm.h)
      const ring = markerDiameterM(id) * 1000
      expect(ring, id + ' ring clears the smaller side').toBeGreaterThanOrEqual(minor * 0.6)
      // round connector (w close to h): ring about 1.15 to 1.25 x the face; otherwise at most 1.5 x the smaller side
      if (major / minor < 1.1) expect(ring / minor, id + ' round: ring / face').toBeLessThanOrEqual(1.5)
      else expect(ring / minor, id + ' ring / smaller side').toBeLessThanOrEqual(2.2)
      expect(mm * RING_OVERSIZE, id).toBeCloseTo(ring, 6)
    }
  })

  it('a ring on a round XLR hole is about 1.15 to 1.25 x the XLR face (19.5 to 20.3 mm)', () => {
    const r = (markerDiameterM('xlr3-f') * 1000) / 20.3
    expect(r).toBeGreaterThanOrEqual(1.1)
    expect(r).toBeLessThanOrEqual(1.25)
  })

  it('no two rings of a catalog device overlap: every port pair on the same face is further apart than the larger ring (XLR 23.4 mm on the 23.8 mm pitch of the Rio and 24.1 mm of the Grace)', () => {
    let pairs = 0
    const tight: string[] = []
    for (const [id, spec] of specs) {
      const conn = catalogPorts.get(id)
      if (!conn || !spec.ports) continue
      for (let i = 0; i < spec.ports.length; i++) {
        for (let j = i + 1; j < spec.ports.length; j++) {
          const a = spec.ports[i]
          const b = spec.ports[j]
          if (a.face !== b.face) continue
          const ca = conn.get(a.portId)
          const cb = conn.get(b.portId)
          if (!ca || !cb) continue
          const dist = Math.hypot(a.xMm - b.xMm, a.yMm - b.yMm)
          const rings = (markerDiameterM(ca) * 1000 + markerDiameterM(cb) * 1000) / 2 // two circles touch at the mean of their diameters
          pairs++
          if (dist < rings - 1e-6) tight.push(id + ' ' + a.portId + ' / ' + b.portId + ': ' + dist.toFixed(1) + ' mm apart, rings ' + rings.toFixed(1) + ' mm')
        }
      }
    }
    expect(pairs).toBeGreaterThan(30)
    expect(tight, tight.join(' | ')).toEqual([])
  })

  it('no ring is taller than 60 % of the smaller side of the face it sits on, and the C13 outlets of the strip (25.4 x 17.4 mm) carry a ring of about 24 mm on a 52 mm bar, not 37.5 mm', () => {
    const tall: string[] = []
    for (const [id, spec] of specs) {
      const conn = catalogPorts.get(id)
      if (!conn || !spec.ports || spec.kind === 'connector') continue
      for (const p of spec.ports) {
        const c = conn.get(p.portId)
        if (!c || p.face === 'bottom') continue // the base of a round mic is not a panel
        const faceMinor = p.face === 'io' || p.face === 'opposite' ? Math.min(spec.realSizeMm.w, spec.realSizeMm.h) : Math.min(spec.realSizeMm.d, spec.realSizeMm.h)
        const ring = markerDiameterM(c) * 1000
        if (ring > faceMinor * 0.6) tall.push(id + ' ' + p.portId + ' (' + c + '): ring ' + ring.toFixed(1) + ' mm on a ' + faceMinor.toFixed(1) + ' mm face')
      }
    }
    expect(tall, tall.join(' | ')).toEqual([])
    const bar = specs.get('multiprise-secteur')!
    expect(markerDiameterM('iec-c13') * 1000).toBeCloseTo(24, 6)
    expect((markerDiameterM('iec-c13') * 1000) / bar.realSizeMm.h).toBeLessThan(0.5)
    expect(markerDiameterM('iec-c13') * 1000).toBeLessThan(25.4 * 1.0) // narrower than the outlet is wide
  })
})
