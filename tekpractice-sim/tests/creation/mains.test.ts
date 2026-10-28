/**
 * Task 32 (C7): the mains source is a flag on catalog data, `isMainsSource`, and it belongs to `multiprise-secteur`'s
 * outputs ONLY. The Bêta proposals shure-axient-digital-ad4d and shure-ua845uwb declare `mains-power` OUT ports without the
 * flag (unverified KB data): wired to a power-in they are accepted by the engine (same connector, same signal) but they
 * are NOT a mains source, and Task 34's « powered » test reads this flag.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { ConnectionGraph } from '../../src/engine/ConnectionGraph'
import { isMainsSourcePort } from '../../src/creation/mains'
import { parseProposals, registerProposals } from '../../src/creation/betaDevices'

const proposals = JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as unknown

/** A registry with every Bêta proposal registered, like the app after the Bêta tab opened. */
const withBeta = () => {
  const registry = makeRegistry()
  registerProposals(registry, parseProposals(proposals, registry).devices)
  return registry
}

describe('isMainsSource is only on the generic power strip', () => {
  it('catalog: the only ports flagged isMainsSource are multiprise-secteur out-1..out-4', () => {
    const flagged = makeRegistry().catalog.devices.flatMap((d) => d.ports.filter((p) => (p.flags ?? []).includes('isMainsSource')).map((p) => `${d.id} ${p.portId}`))
    expect(flagged).toEqual(['multiprise-secteur out-1', 'multiprise-secteur out-2', 'multiprise-secteur out-3', 'multiprise-secteur out-4'])
  })

  it('every flagged port is an output carrying mains-power; every verified mains-power output is flagged', () => {
    for (const d of makeRegistry().catalog.devices)
      for (const p of d.ports) {
        const flagged = (p.flags ?? []).includes('isMainsSource')
        if (flagged) expect(`${d.id} ${p.portId} ${p.dir} ${p.signal}`).toBe(`${d.id} ${p.portId} out mains-power`)
        if (p.signal === 'mains-power' && p.dir === 'out') expect(flagged, `${d.id} ${p.portId}`).toBe(true)
      }
  })

  it('Bêta proposals: not one declares isMainsSource (unverified data does not power anything)', () => {
    const r = withBeta()
    const mainsOutBeta = [...r.deviceById.values()].filter((d) => !r.catalog.devices.some((c) => c.id === d.id)).flatMap((d) => d.ports.filter((p) => p.signal === 'mains-power' && p.dir === 'out').map((p) => `${d.id} ${p.portId}`))
    // the premise of this test: the two proposals that have a mains OUT port are really in the registry
    expect(mainsOutBeta).toEqual(['shure-axient-digital-ad4d out-ac-power-cascade-locking', 'shure-ua845uwb out-ac-power-output-daisy-chain'])
    for (const d of r.deviceById.values())
      if (!r.catalog.devices.some((c) => c.id === d.id)) for (const p of d.ports) expect(p.flags ?? [], `${d.id} ${p.portId}`).not.toContain('isMainsSource')
  })

  it('isMainsSourcePort reads the flag: true on the strip outputs, false on inputs, unflagged outputs and unknown ids', () => {
    const r = withBeta()
    const get = (id: string) => r.deviceById.get(id)
    expect(isMainsSourcePort(get('multiprise-secteur'), 'out-1')).toBe(true)
    expect(isMainsSourcePort(get('multiprise-secteur'), 'out-4')).toBe(true)
    expect(isMainsSourcePort(get('multiprise-secteur'), 'out-5')).toBe(false)
    expect(isMainsSourcePort(get('qsc-k12-2'), 'power-in')).toBe(false)
    expect(isMainsSourcePort(get('shure-axient-digital-ad4d'), 'out-ac-power-cascade-locking')).toBe(false)
    expect(isMainsSourcePort(get('shure-ua845uwb'), 'out-ac-power-output-daisy-chain')).toBe(false)
    expect(isMainsSourcePort(undefined, 'out-1')).toBe(false)
  })
})

describe('the strip powers a K12.2 through the engine invariants (R1-R3), a Bêta mains output does not', () => {
  const peerPortOf = (g: ConnectionGraph, instance: string, port: string) => {
    const c = g.snapshot().connections.find((x) => (x.a.instance === instance && x.a.port === port) || (x.b.instance === instance && x.b.port === port))
    return c ? (c.a.instance === instance && c.a.port === port ? c.b : c.a) : null
  }

  it('connects k12-g power-in to mains out-1 (the mating connector, no engine change), and ql1, k12-d on out-2, out-3', () => {
    const r = makeRegistry()
    const g = new ConnectionGraph(r, [
      { instanceId: 'mains', deviceId: 'multiprise-secteur' },
      { instanceId: 'k12-g', deviceId: 'qsc-k12-2' },
      { instanceId: 'ql1', deviceId: 'yamaha-ql1' },
    ])
    expect(g.connect({ instance: 'k12-g', port: 'power-in' }, { instance: 'mains', port: 'out-1' }).ok).toBe(true)
    expect(g.connect({ instance: 'mains', port: 'out-2' }, { instance: 'ql1', port: 'power-in' }).ok).toBe(true)
    // the other direction is still R3: an input does not feed an input, an output does not feed an output
    expect(g.connect({ instance: 'mains', port: 'out-3' }, { instance: 'mains', port: 'out-4' }).ok).toBe(false)
  })

  it('a strip output is mains for the K12.2 it feeds', () => {
    const r = makeRegistry()
    const g = new ConnectionGraph(r, [{ instanceId: 'mains', deviceId: 'multiprise-secteur' }, { instanceId: 'k12-g', deviceId: 'qsc-k12-2' }])
    g.connect({ instance: 'k12-g', port: 'power-in' }, { instance: 'mains', port: 'out-1' })
    const peer = peerPortOf(g, 'k12-g', 'power-in')!
    expect(isMainsSourcePort(r.deviceById.get('multiprise-secteur'), peer.port)).toBe(true)
  })

  it.each([
    ['shure-axient-digital-ad4d', 'out-ac-power-cascade-locking'],
    ['shure-ua845uwb', 'out-ac-power-output-daisy-chain'],
  ])('a Bêta %s %s wired to a K12.2 power-in is accepted by the engine and is NOT mains', (deviceId, portId) => {
    const r = withBeta()
    const g = new ConnectionGraph(r, [{ instanceId: 'beta', deviceId }, { instanceId: 'k12-g', deviceId: 'qsc-k12-2' }])
    expect(g.connect({ instance: 'k12-g', port: 'power-in' }, { instance: 'beta', port: portId }).ok).toBe(true)
    const peer = peerPortOf(g, 'k12-g', 'power-in')!
    expect(peer).toEqual({ instance: 'beta', port: portId })
    expect(isMainsSourcePort(r.deviceById.get(deviceId), peer.port)).toBe(false)
  })
})
