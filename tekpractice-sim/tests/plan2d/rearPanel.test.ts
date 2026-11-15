import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { CONNECTOR_GLYPH, rearLayout } from '../../src/plan2d/rearPanel'
import { portCableType } from '../../src/plan2d/cableStyle2d'

const registry = loadCatalog(catalogJson)

describe('rear panels come from the catalogue, port for port', () => {
  it('every catalogue device yields a layout whose ports are exactly its catalogue ports: count, order, connector, signal, direction', () => {
    for (const d of registry.catalog.devices) {
      const l = rearLayout(registry, d.id)
      expect(l, d.id).not.toBeNull()
      expect(l!.ports.map((p) => [p.portId, p.dir, p.connector, p.signal]), d.id).toEqual(d.ports.map((p) => [p.portId, p.dir, p.connector, p.signal]))
    }
  })

  it('every connector of the catalogue has its own glyph entry (no fallback hides a new one), and the gender is the catalogue’s', () => {
    for (const c of registry.catalog.connectorTypes) expect(CONNECTOR_GLYPH[c.id], c.id).toBeDefined()
    const l = rearLayout(registry, 'qsc-k12-2')!
    expect(l.ports.map((p) => [p.portId, p.gender, p.glyph])).toEqual([
      ['in-line-a', 'female', 'xlr'],
      ['thru-out-a', 'male', 'xlr'],
      ['power-in', 'male', 'iec'],
    ])
  })

  it('each port carries its French connector and signal names and its cable type', () => {
    const p = rearLayout(registry, 'qsc-k12-2')!.ports[0]!
    expect(p.connectorLabel.length).toBeGreaterThan(0)
    expect(p.signalLabel.length).toBeGreaterThan(0)
    expect(p.cableType).toBe(portCableType(registry.deviceById.get('qsc-k12-2')!.ports[0]!))
  })

  it('the layout is a plain row in catalogue order and says so (the real position on the panel is not read); unknown device = null', () => {
    const l = rearLayout(registry, 'yamaha-ql1')!
    expect(l.plainRow).toBe(true)
    expect(l.columns).toBe(Math.min(8, l.ports.length))
    expect(rearLayout(registry, 'not-a-device')).toBeNull()
  })
})
