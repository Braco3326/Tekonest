/**
 * CableRenderer laid by gravity (mission 3 A): with a support surface every committed cable is `gravityPath` (it drops from a raised port, lies on
 * the floor, goes over a device), its tube never goes under the surface, over budget it keeps a coarse shape that still lies (never a flying straight
 * line), and the cable in hand keeps its point count and lies on the surface between the port and the pointer.
 */
import { NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CableRenderer } from '../../src/scene/CableRenderer'
import { CableBudget, FLOOR_CLEARANCE, SEGMENTS_FULL } from '../../src/scene/cablePath'
import { buildSupport, gravityPath, supportReport } from '../../src/scene/cableGravity'

const v = (x: number, y: number, z = 0): Vector3 => new Vector3(x, y, z)
const A = { instance: 'desk', port: 'out' }
const B = { instance: 'spk', port: 'in' }

describe('CableRenderer with a support surface', () => {
  let engine: NullEngine
  let scene: Scene
  beforeEach(() => {
    engine = new NullEngine()
    scene = new Scene(engine)
  })
  afterEach(() => {
    scene.dispose()
    engine.dispose()
  })
  const support = buildSupport(() => 0, [{ x: 3, z: 0, w: 0.5, d: 0.5, yawDeg: 0, base: 0, h: 0.27 }])
  const lowestVertex = (name: string): number => {
    const pos = scene.getMeshByName(name)!.getVerticesData('position')!
    let lo = Infinity
    for (let i = 1; i < pos.length; i += 3) lo = Math.min(lo, pos[i]!)
    return lo
  }

  it('draws exactly the gravity path, with each port leaving along its outward direction', () => {
    const outs = new Map([
      ['desk', { x: 1, y: 0, z: 0 }],
      ['spk', { x: -1, y: 0, z: 0 }],
    ])
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false, floorAt: () => 0, support: () => support, outwardFor: (r) => outs.get(r.instance) ?? null })
    c.addCable('k', v(0, 0.9), v(6, 0.3), [A, B])
    const drawn = c.paths().find(([id]) => id === 'k')![1]
    const want = gravityPath({ at: { x: 0, y: 0.9, z: 0 }, out: outs.get('desk') }, { at: { x: 6, y: 0.3, z: 0 }, out: outs.get('spk') }, support, { clearance: FLOOR_CLEARANCE })
    expect(drawn).toEqual(want)
    const r = supportReport(drawn, support, FLOOR_CLEARANCE)
    expect(r.minAboveM).toBeGreaterThanOrEqual(-1e-9)
    expect(r.longestUnsupportedM).toBeLessThan(0.2) // it flies nowhere (the old parabola: metres)
    // the tube sits on the floor: its underside is above it (radius 12 mm, centre 15 mm up)
    expect(lowestVertex('cable:k')).toBeGreaterThanOrEqual(0)
  })

  it('a port with no outward direction hangs straight down from it', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false, floorAt: () => 0, support: () => support })
    c.addCable('k', v(0, 1.5), v(6, 1.5), [A, B])
    const drawn = c.paths().find(([id]) => id === 'k')![1]
    expect(drawn[1]!.x).toBe(0)
    expect(drawn[1]!.z).toBe(0)
    expect(drawn[1]!.y).toBeLessThan(1.5)
  })

  it('over budget: the coarse shape (fewer points), still on the surface and ends on the ports, never a flying straight line', () => {
    const tight = new CableBudget(30)
    const c = new CableRenderer(scene, tight, { pulses: false, floorAt: () => 0, support: () => support })
    c.addCable('k1', v(0, 0.9), v(6, 0.3), [A, B])
    c.addCable('k2', v(0, 0.9, 1), v(6, 0.3, 1), [A, B])
    const k1 = c.paths().find(([id]) => id === 'k1')![1]
    const k2 = c.paths().find(([id]) => id === 'k2')![1]
    expect(k2.length).toBeLessThan(k1.length)
    expect(k2.length).toBeGreaterThan(2)
    expect(k2[0]).toMatchObject({ x: 0, y: 0.9, z: 1 })
    expect(k2.at(-1)).toMatchObject({ x: 6, y: 0.3, z: 1 })
    const r = supportReport(k2, support, FLOOR_CLEARANCE)
    expect(r.minAboveM).toBeGreaterThanOrEqual(-1e-9)
    expect(r.longestUnsupportedM).toBeLessThan(0.3)
  })

  it('the cable in hand keeps its point count and lies on the surface between the port and the pointer', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false, floorAt: () => 0, support: () => support })
    c.beginDrag(v(0, 1.0))
    const count = scene.getMeshByName('cable:drag')!.getTotalVertices()
    for (const to of [v(0.3, 1.0), v(2, 1.1), v(6, 0.8), v(9, 0.05)]) {
      c.updateDrag(to, 'ok')
      expect(scene.getMeshByName('cable:drag')!.getTotalVertices()).toBe(count) // updated in place: same tube
      expect(lowestVertex('cable:drag')).toBeGreaterThanOrEqual(-1e-6)
    }
    c.endDrag()
    expect(SEGMENTS_FULL).toBe(24)
  })

  it('the legacy renderer (no floor, no support) still draws the parabola', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false })
    c.addCable('k', v(0, 0.05), v(6, 0.05))
    expect(c.paths().find(([id]) => id === 'k')![1]).toHaveLength(SEGMENTS_FULL + 1)
  })
})
