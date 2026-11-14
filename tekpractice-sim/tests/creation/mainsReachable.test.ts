/**
 * Waves 2 to 5 review, finding 2: the two Meyer speakers have a `power-in` of connector powercon-blue, the only mains sources are the C13 outlets of the
 * power strip and the connection graph refuses connectors that do not mate: they could never be powered. The fix is connector data (a powerCON to IEC
 * cable joins the two, said in the labels), and a generic test holds that EVERY mains inlet of the catalogue can reach a mains source.
 */
import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { isPowered } from '../../src/flow/signalPath'
import { COPY } from '../../src/creation/copy'

const registry = makeRegistry()
const store = (): CreationStore => new CreationStore(registry, creationEvaluator(registry))
const spawn = (s: CreationStore, deviceId: string): void => {
  expect(s.dispatch({ type: 'SPAWN', deviceId, instanceId: deviceId }).ok, `spawn ${deviceId}`).toBe(true)
}

describe('every mains inlet of the catalogue can be reached from a mains source', () => {
  const sources = registry.catalog.devices.flatMap((d) => d.ports.filter((p) => p.dir === 'out' && p.signal === 'mains-power' && (p.flags ?? []).includes('isMainsSource')))
  const sourceConnectors = new Set(sources.map((p) => p.connector))
  const inlets = registry.catalog.devices.flatMap((d) => d.ports.filter((p) => p.dir === 'in' && p.signal === 'mains-power').map((p) => ({ id: d.id, port: p })))

  it('there are mains sources and inlets to check', () => {
    expect(sources.length).toBeGreaterThan(0)
    expect(inlets.length).toBeGreaterThan(40)
  })
  it.each(inlets.map((i) => [`${i.id} ${i.port.portId} (${i.port.connector})`, i] as const))('%s mates with a connector of a mains source', (_name, i) => {
    const mates = registry.connectorById.get(i.port.connector)?.matesWith ?? []
    expect(
      mates.some((m) => sourceConnectors.has(m)),
      `${i.id}: ${i.port.connector} mates ${mates.join(', ')}; the mains sources are ${[...sourceConnectors].join(', ')}: this device could never be powered`,
    ).toBe(true)
  })
})

describe.each(['meyer-upjunior-upj-1p', 'meyer-sound-lina'])('%s can be powered from a strip in a rig', (id) => {
  it('power-in cables to a strip outlet and the speaker is powered; unplugged it is not', () => {
    const s = store()
    spawn(s, 'multiprise-secteur')
    spawn(s, id)
    expect(isPowered(s.design(), registry, id)).toBe(false)
    const r = s.dispatch({ type: 'CONNECT', a: { instance: id, port: 'power-in' }, b: { instance: 'multiprise-secteur', port: 'out-1' } })
    expect(r.ok, JSON.stringify(r)).toBe(true)
    expect(isPowered(s.design(), registry, id)).toBe(true)
  })
})

describe('the powerCON / IEC adapter is said, not hidden', () => {
  it('the French label of powercon-blue says that a powerCON to IEC cable joins it to a C13 outlet', () => {
    expect(COPY.connector?.['powercon-blue'] ?? '').toMatch(/IEC/)
  })
  it('the catalogue mates powercon-blue and iec-c13 both ways (validate:catalog checks the symmetry)', () => {
    expect(registry.connectorById.get('powercon-blue')?.matesWith).toContain('iec-c13')
    expect(registry.connectorById.get('iec-c13')?.matesWith).toContain('powercon-blue')
  })
})
