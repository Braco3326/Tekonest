/** logic/clock — R8 unlocked slave on the REAL D1 level. */
import { describe, expect, it } from 'vitest'
import { ConnectionGraph } from '../../src/engine/ConnectionGraph'
import { clockCheck } from '../../src/logic/clock'
import { makeLevel, makeRegistry, wireChain } from '../helpers'

const registry = makeRegistry()
const d1 = makeLevel('d1')
const rules = (g: ConnectionGraph) => clockCheck(g.snapshot()).map((v) => v.ruleId)

// d1 chain indexes: 0 u87→isa, 1 hdx↔hdio (digilink), 2 hdio→loom, 3-4 loom→m905,
// 5-6 m905→gen, 7 clock→hdio wordclock-in

describe('R8 — word clock master/slave', () => {
  it('triggers: digital audio flowing (DigiLink) but the HD I/O slave input is unlocked', () => {
    const g = new ConnectionGraph(registry, d1.devices)
    wireChain(g, d1, [7]) // everything except the word clock line
    const events = clockCheck(g.snapshot())
    expect(events.map((v) => v.ruleId)).toContain('R8')
    expect(events[0].subjects[0]).toEqual({ instance: 'hdio-1', port: 'wordclock-in' })
  })

  it("doesn't trigger: slaved to the OCX HD house clock", () => {
    const g = new ConnectionGraph(registry, d1.devices)
    wireChain(g, d1)
    expect(rules(g)).toEqual([])
  })

  it("doesn't trigger: no digital audio connection at all (idle rig)", () => {
    const g = new ConnectionGraph(registry, d1.devices)
    expect(rules(g)).toEqual([])
  })

  it("doesn't trigger: analog-only wiring never needs a clock", () => {
    const g = new ConnectionGraph(registry, d1.devices)
    wireChain(g, d1, [1, 7]) // no digilink, no clock — analog paths only
    expect(rules(g)).toEqual([])
  })
})

describe('R8 — sample-rate mismatch (ADR-0007, enum controls)', () => {
  it('triggers: the two ends of the DigiLink run different rates (44.1 vs 48)', () => {
    const g = new ConnectionGraph(registry, d1.devices)
    wireChain(g, d1) // full chain: slave is locked, so the ONLY R8 source is the rate clash
    g.setControl('hdio-1', 'sample-rate', '44100') // hdx-1 stays at the 48000 default
    const events = clockCheck(g.snapshot())
    expect(events.map((v) => v.ruleId)).toEqual(['R8'])
    const ends = events[0].subjects.map((s) => s.instance).sort()
    expect(ends).toEqual(['hdio-1', 'hdx-1'])
  })

  it("doesn't trigger: both ends share the default 48 kHz", () => {
    const g = new ConnectionGraph(registry, d1.devices)
    wireChain(g, d1)
    expect(rules(g)).toEqual([]) // matching rates + locked slave = clean
  })

  it("doesn't trigger: rate set but the digital link is not wired", () => {
    const g = new ConnectionGraph(registry, d1.devices)
    wireChain(g, d1, [1, 7]) // no DigiLink cable between hdx and hdio
    g.setControl('hdio-1', 'sample-rate', '96000')
    expect(rules(g)).toEqual([]) // no shared link to clash on
  })

  it('ignores a digital link whose devices have no sample-rate control (nothing to compare)', () => {
    // Playout PC → Axia iQ over AoIP: a real digital link, but neither device
    // declares a sample-rate control, so there is nothing to clash — no R8.
    const g = new ConnectionGraph(registry, [
      { instanceId: 'p', deviceId: 'playout-pc' },
      { instanceId: 'q', deviceId: 'axia-iq' },
    ])
    g.connect({ instance: 'p', port: 'aoip' }, { instance: 'q', port: 'livewire' })
    expect(rules(g)).toEqual([])
  })
})

describe('R8 — a master clock does not need a reference (Wave 1b finding 1, real MUTEC MC-3+ row)', () => {
  const mutecRig = () =>
    new ConnectionGraph(registry, [
      { instanceId: 'kh', deviceId: 'neumann-kh-120-ii' },
      { instanceId: 'mc3', deviceId: 'mutec-mc-3-plus' },
    ])

  it("doesn't trigger: S/PDIF patched into the MC-3+ with no word-clock cable (it is the master, its reference input is optional)", () => {
    const g = mutecRig()
    expect(g.connect({ instance: 'kh', port: 'out-spdif' }, { instance: 'mc3', port: 'in-spdif-rca' }).ok).toBe(true)
    expect(rules(g)).toEqual([])
  })

  it('the MC-3+ carries no isClockSlave port, its clock outputs stay masters', () => {
    const dev = registry.deviceById.get('mutec-mc-3-plus')!
    expect(dev.ports.filter((p) => p.flags?.includes('isClockSlave'))).toEqual([])
    expect(dev.ports.filter((p) => p.flags?.includes('isClockMaster')).length).toBeGreaterThan(0)
  })

  it('still triggers: a real slave (Avid HD I/O) with digital audio and no word clock', () => {
    const g = new ConnectionGraph(registry, d1.devices)
    wireChain(g, d1, [7]) // the word clock line is the one left out
    expect(rules(g)).toContain('R8')
  })
})
