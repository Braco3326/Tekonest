/**
 * Mission 3 B, stage 1: the renderer draws a hand-drawn route. `addCable(..., route)` lays the cable along the route's plan with rounded corners
 * (gravityPath with `round`), on the surface, ends on the ports; a routed cable's points count against the budget, and over budget it is drawn with
 * its corners unrounded (the coarse shape), never dropped.
 */
import { NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CableRenderer } from '../../src/scene/CableRenderer'
import { CableBudget, FLOOR_CLEARANCE } from '../../src/scene/cablePath'
import { buildSupport, gravityPath, supportReport } from '../../src/scene/cableGravity'

const v = (x: number, y: number, z = 0): Vector3 => new Vector3(x, y, z)
const A = { instance: 'desk', port: 'out' }
const B = { instance: 'spk', port: 'in' }
const ROUTE = [
  { x: 1, z: 0 },
  { x: 1, z: 2 },
  { x: 4, z: 2 },
]

describe('CableRenderer with a hand-drawn route', () => {
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
  const deck = (x: number, z: number): number => (x >= 2 && x <= 3 && z >= 1 && z <= 3 ? 0.4 : 0)
  const support = buildSupport(deck)
  const path = (c: CableRenderer, id: string) => c.paths().find(([k]) => k === id)?.[1]

  it('draws the routed gravity path with rounded corners, on the surface (the deck on the way included), ending on the ports', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false, floorAt: deck, support: () => support })
    c.addCable('k', v(0, 0.9), v(5, 0.3, 2), [A, B], ROUTE)
    const drawn = path(c, 'k')!
    expect(drawn).toEqual(gravityPath({ at: { x: 0, y: 0.9, z: 0 } }, { at: { x: 5, y: 0.3, z: 2 } }, support, { clearance: FLOOR_CLEARANCE, route: ROUTE, round: true }))
    expect(drawn[0]).toMatchObject({ x: 0, y: 0.9, z: 0 })
    expect(drawn.at(-1)).toMatchObject({ x: 5, y: 0.3, z: 2 })
    const r = supportReport(drawn, support, FLOOR_CLEARANCE)
    expect(r.minAboveM).toBeGreaterThanOrEqual(-1e-9)
    // the corner (1, 0) is rounded: no drawn point on it, but the cable passes close by
    expect(drawn.some((p) => Math.abs(p.x - 1) < 1e-9 && Math.abs(p.z) < 1e-9)).toBe(false)
    expect(Math.min(...drawn.map((p) => Math.hypot(p.x - 1, p.z)))).toBeLessThan(0.1)
    // on the deck at (2.5, 2): the drawn segment over it is at deck height (a flat run is one segment between the edges)
    const over = drawn.findIndex((p, i) => i > 0 && Math.abs(p.z - 2) < 1e-6 && Math.abs(drawn[i - 1]!.z - 2) < 1e-6 && drawn[i - 1]!.x <= 2.5 && p.x >= 2.5)
    expect(over).toBeGreaterThan(0)
    const [p, q] = [drawn[over - 1]!, drawn[over]!]
    expect(p.y + ((q.y - p.y) * (2.5 - p.x)) / (q.x - p.x || 1)).toBeCloseTo(0.4 + FLOOR_CLEARANCE, 6)
  })

  it('an empty route is the automatic shape', () => {
    const c = new CableRenderer(scene, new CableBudget(), { pulses: false, floorAt: deck, support: () => support })
    c.addCable('k', v(0, 0.9), v(5, 0.3, 2), [A, B], [])
    c.addCable('j', v(0, 0.9), v(5, 0.3, 2), [A, B])
    expect(path(c, 'k')).toEqual(path(c, 'j'))
  })

  it('over budget: the routed cable is still drawn, with its corners unrounded (the route corner is a drawn point), on the surface', () => {
    const tight = new CableBudget(40)
    const c = new CableRenderer(scene, tight, { pulses: false, floorAt: deck, support: () => support })
    c.addCable('first', v(0, 0.9, -3), v(5, 0.3, -3), [A, B]) // uses most of the budget
    c.addCable('k', v(0, 0.9), v(5, 0.3, 2), [A, B], ROUTE)
    const drawn = path(c, 'k')!
    expect(drawn).toBeDefined()
    expect(drawn.length).toBeGreaterThan(2)
    expect(drawn.some((p) => Math.abs(p.x - 1) < 1e-9 && Math.abs(p.z) < 1e-9)).toBe(true) // sharp corner
    expect(drawn[0]).toMatchObject({ x: 0, y: 0.9, z: 0 })
    expect(drawn.at(-1)).toMatchObject({ x: 5, y: 0.3, z: 2 })
    expect(supportReport(drawn, support, FLOOR_CLEARANCE).minAboveM).toBeGreaterThanOrEqual(-1e-9)
  })

  it('a routed cable books its points: the next cable finds less room', () => {
    const fine = gravityPath({ at: { x: 0, y: 0.9, z: 0 } }, { at: { x: 5, y: 0.3, z: 2 } }, support, { clearance: FLOOR_CLEARANCE, route: ROUTE, round: true }).length
    const budget = new CableBudget(fine + 5)
    const c = new CableRenderer(scene, budget, { pulses: false, floorAt: deck, support: () => support })
    c.addCable('k', v(0, 0.9), v(5, 0.3, 2), [A, B], ROUTE)
    expect(path(c, 'k')!.length).toBe(fine)
    expect(budget.fits('other', 6)).toBe(false)
    expect(budget.fits('other', 5)).toBe(true)
    c.removeCable('k')
    expect(budget.fits('other', fine)).toBe(true)
  })
})
