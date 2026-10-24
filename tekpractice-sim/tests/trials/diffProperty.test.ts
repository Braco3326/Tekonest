/**
 * Essais: property-style check over seeded random designs.
 * Equal fp1 fingerprints ⇔ empty diffDesign (array order kept identical;
 * control maps are never empty, see report).
 */
import { describe, expect, it } from 'vitest'
import { fingerprint } from '../../src/trials/fingerprint'
import { cloneData, diffDesign, type DesignState } from '../../src/trials/trial'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DEVICES = ['sm58', 'mixer-8', 'powered-12', 'powered-15', 'di-box']
const PORTS = ['in', 'out', 'in-1', 'main-l', 'main-r']

function randomDesign(r: () => number): DesignState {
  const pick = <T>(xs: T[]): T => xs[Math.floor(r() * xs.length)]
  const n = 2 + Math.floor(r() * 5)
  const instances = Array.from({ length: n }, (_, i) => ({ instanceId: `i${i}`, deviceId: pick(DEVICES) }))
  const placements = instances
    .filter(() => r() < 0.8)
    .map((i) => ({
      instanceId: i.instanceId,
      deviceId: i.deviceId,
      position_m: [r() * 20 - 10, r() * 3, r() * 20 - 10] as [number, number, number],
      yawDeg: r() * 720 - 360,
    }))
  const connections = Array.from({ length: Math.floor(r() * 5) }, () => ({
    a: { instance: pick(instances).instanceId, port: pick(PORTS) },
    b: { instance: pick(instances).instanceId, port: pick(PORTS) },
  }))
  const controls: DesignState['rig']['controls'] = {}
  for (const i of instances) if (r() < 0.5) controls[i.instanceId] = { phantom: r() < 0.5, route: pick(['main', 'aux']) }
  return { roomId: r() < 0.8 ? 'salle' : null, rig: { instances, connections, controls }, placements }
}

/** One random edit; some are no-ops in quantised terms, some are real changes. */
function mutate(d: DesignState, r: () => number): DesignState {
  const m = cloneData(d)
  const p = m.placements[Math.floor(r() * m.placements.length)]
  switch (Math.floor(r() * 12)) {
    case 0:
      break
    case 1:
      if (p) p.position_m = p.position_m.map((v) => v + (r() - 0.5) * 2e-9) as [number, number, number]
      break
    case 2:
      if (p) p.position_m[Math.floor(r() * 3)] += (r() - 0.5) * 0.004 // ±2 mm: may or may not cross a mm
      break
    case 3:
      if (p) p.yawDeg += r() < 0.5 ? 360 : -720
      break
    case 4:
      if (p) p.yawDeg += (r() - 0.5) * 0.3
      break
    case 5:
      m.rig.connections = m.rig.connections.map((c) => ({ a: c.b, b: c.a }))
      break
    case 6:
      m.rig.connections.pop()
      break
    case 7: {
      const k = Object.keys(m.rig.controls)[0]
      if (k) m.rig.controls[k].phantom = !m.rig.controls[k].phantom
      break
    }
    case 8:
      m.rig.instances[0].deviceId = DEVICES[(DEVICES.indexOf(m.rig.instances[0].deviceId) + 1) % DEVICES.length]
      break
    case 9:
      m.roomId = m.roomId === null ? 'salle' : null
      break
    case 10:
      m.placements.pop()
      break
    case 11:
      m.rig.connections.push({ a: { instance: 'i0', port: 'out' }, b: { instance: 'i1', port: 'in' } })
      break
  }
  return m
}

describe('fp1 ⇔ diffDesign (seeded property)', () => {
  it('equal fingerprints ⇔ empty diff, over 400 random pairs', async () => {
    const r = mulberry32(20261024)
    let equalPairs = 0
    for (let i = 0; i < 400; i++) {
      const a = randomDesign(r)
      const b = mutate(a, r)
      const sameFp = (await fingerprint(a)) === (await fingerprint(b))
      const diff = diffDesign(a, b)
      if (sameFp) equalPairs++
      expect({ i, sameFp, diff }).toEqual({ i, sameFp, diff: sameFp ? [] : expect.arrayContaining([expect.any(String)]) })
    }
    // both branches are exercised
    expect(equalPairs).toBeGreaterThan(50)
    expect(equalPairs).toBeLessThan(350)
  })
})
