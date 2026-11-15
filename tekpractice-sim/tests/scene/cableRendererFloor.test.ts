/** CableRenderer with a floor (founder, 2026-11-15: the cables rest on the surface, never under it): committed cables, the cable in hand, a raised deck, and the legacy default. */
import { NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CableRenderer } from '../../src/scene/CableRenderer'
import { CableBudget } from '../../src/scene/cablePath'

const p = (x: number, y = 0.05, z = 0): Vector3 => new Vector3(x, y, z)

describe('CableRenderer rests cables on the floor', () => {
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
  /** The lowest vertex of a mesh (y) and the lowest point of the drawn path. */
  const lowestVertex = (name: string): number => {
    const pos = scene.getMeshByName(name)!.getVerticesData('position')!
    let lo = Infinity
    for (let i = 1; i < pos.length; i += 3) lo = Math.min(lo, pos[i]!)
    return lo
  }

  it('legacy: with no floor given the long cable still sags under y = 0 (every caller that passes none is unchanged)', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false })
    c.addCable('c1', p(0), p(6))
    expect(lowestVertex('cable:c1')).toBeLessThan(-0.5)
  })

  it('with a floor, a 6 m cable between two floor-level ports is wholly on or above the floor (its tube too), and its drawn path says so', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false, floorAt: () => 0 })
    c.addCable('c1', p(0), p(6))
    expect(lowestVertex('cable:c1')).toBeGreaterThanOrEqual(0)
    const path = c.paths().find(([id]) => id === 'c1')![1]
    expect(Math.min(...path.slice(1, -1).map((q) => q.y))).toBeGreaterThanOrEqual(0.015 - 1e-9)
    expect(path[0]).toMatchObject({ x: 0, y: 0.05 })
    expect(path.at(-1)).toMatchObject({ x: 6, y: 0.05 })
  })

  it('a dashed cable too (its dashes follow the same path)', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false, floorAt: () => 0, dashFor: () => true })
    c.addCable('c2', p(0), p(6), [{ instance: 'a', port: 'o' }, { instance: 'b', port: 'i' }])
    expect(lowestVertex('cable:c2')).toBeGreaterThanOrEqual(0)
  })

  it('the cable in hand rests on the floor too, wherever the pointer goes', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false, floorAt: () => 0 })
    c.beginDrag(p(0))
    for (const x of [0.5, 2, 6, 12]) {
      c.updateDrag(p(x), 'ok')
      expect(lowestVertex('cable:drag')).toBeGreaterThanOrEqual(0)
    }
    c.endDrag()
  })

  it('it follows a raised deck under the cable', () => {
    const deck = (x: number): number => (x >= 2 && x <= 4 ? 0.6 : 0)
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false, floorAt: (x) => deck(x) })
    c.addCable('c3', p(0), p(6))
    const path = c.paths().find(([id]) => id === 'c3')![1]
    for (const q of path.slice(1, -1)) expect(q.y).toBeGreaterThanOrEqual(deck(q.x) + 0.015 - 1e-9)
  })

  it('the length a hover reads is the length of the cable as drawn (on the floor, never under the straight line)', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false, floorAt: () => 0 })
    c.addCable('c4', p(0), p(6))
    const path = c.paths().find(([id]) => id === 'c4')![1]
    let len = 0
    for (let i = 1; i < path.length; i++) len += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y, path[i]!.z - path[i - 1]!.z)
    expect(len).toBeGreaterThanOrEqual(6 - 1e-9)
  })
})
