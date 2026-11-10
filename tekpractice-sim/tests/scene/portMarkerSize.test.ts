import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { CONNECTOR_MM, markerDiameterM } from '../../src/scene/portMarkerSize'

describe('markerDiameterM (outer ring diameter of a port marker, metres)', () => {
  it('is the connector size x 1.25: an XLR (24 mm) gets 30 mm', () => {
    expect(markerDiameterM('xlr3-f')).toBeCloseTo(0.03, 9)
    expect(markerDiameterM('xlr3-m')).toBeCloseTo(0.03, 9)
    expect(markerDiameterM('trs-35mm')).toBeCloseTo(0.01, 9)
  })

  it('a finite, positive openingMm from the spec wins over the table', () => {
    expect(markerDiameterM('xlr3-f', 30)).toBeCloseTo(0.0375, 9)
  })

  it('an unknown connector falls back to 20 mm (25 mm outer)', () => {
    expect(markerDiameterM('nope')).toBeCloseTo(0.025, 9)
  })

  it('never 0 or NaN: a missing, empty, zero, negative or NaN opening and an empty id give a finite size > 0', () => {
    for (const opening of [undefined, Number.NaN, 0, -4, Number.POSITIVE_INFINITY]) {
      for (const id of ['xlr3-f', 'nope', '']) {
        const d = markerDiameterM(id, opening)
        expect(Number.isFinite(d), `${id}/${String(opening)}`).toBe(true)
        expect(d, `${id}/${String(opening)}`).toBeGreaterThan(0)
      }
    }
    expect(markerDiameterM('xlr3-f', Number.NaN)).toBeCloseTo(0.03, 9)
    expect(markerDiameterM('', undefined)).toBeCloseTo(0.025, 9)
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
})
