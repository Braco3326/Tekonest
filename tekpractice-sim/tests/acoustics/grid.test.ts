/**
 * Task 36: the listener grid. Zones are the room zones as roomLayout gives them: { x, z } is the CENTRE of the rectangle, { w, d } its size
 * along x and z, y the floor height. The boundary rule (pinned below so it is deterministic): the lattice is centred on the zone, its cells
 * are `stepM` wide exactly, a point is the centre of a cell, so no point ever lies on the zone edge (the nearest is stepM/2 inside) and a
 * strip narrower than one step at the border is left out. A zone smaller than one cell gets a single point at its centre.
 */
import { describe, expect, it } from 'vitest'
import { listenerGrid } from '../../src/acoustics/grid'

type Z = { x: number; z: number; w: number; d: number; y: number }
const zone = (over: Partial<Z> = {}): Z => ({ x: 0, z: 0, w: 4, d: 2, y: 0, ...over })
const xyz = (g: { points: Float32Array }): [number, number, number][] => {
  const out: [number, number, number][] = []
  for (let i = 0; i < g.points.length; i += 3) out.push([g.points[i], g.points[i + 1], g.points[i + 2]])
  return out
}

describe('listenerGrid: lattice and boundary rule', () => {
  it('a 4 × 2 zone centred at (10, 20), floor 0.4, ear 1.2: 8 × 4 = 32 points at 0.5 m, rows by z then x', () => {
    // nx = floor(4/0.5) = 8, nz = floor(2/0.5) = 4. x_i = 10 + (i − 3.5)·0.5 = 8.25 … 11.75; z_j = 20 + (j − 1.5)·0.5 = 19.25 … 20.75
    const g = listenerGrid([zone({ x: 10, z: 20, y: 0.4 })], 1.2)
    expect(g.stepM).toBe(0.5)
    const p = xyz(g)
    expect(p).toHaveLength(32)
    expect(p[0][0]).toBeCloseTo(8.25, 6)
    expect(p[0][2]).toBeCloseTo(19.25, 6)
    expect(p[1][0]).toBeCloseTo(8.75, 6) // x runs fastest
    expect(p[1][2]).toBeCloseTo(19.25, 6)
    expect(p[8][0]).toBeCloseTo(8.25, 6) // next row
    expect(p[8][2]).toBeCloseTo(19.75, 6)
    expect(p[31][0]).toBeCloseTo(11.75, 6)
    expect(p[31][2]).toBeCloseTo(20.75, 6)
    for (const q of p) expect(q[1]).toBeCloseTo(1.6, 6) // zone floor 0.4 + ear 1.2
  })
  it('no point lies on the zone edge: a 1 × 1 zone at 0.5 m gives the four cell centres (±0.25, ±0.25)', () => {
    const p = xyz(listenerGrid([zone({ w: 1, d: 1 })], 1.2))
    expect(p.map((q) => [q[0], q[2]])).toEqual([[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]])
  })
  it('a width that is not a whole number of steps: 7.3 wide gives 14 columns, centred (0.15 m left over on each side), still strictly inside', () => {
    // floor(7.3/0.5) = 14 cells = 7.0 m; the outer centres are at ±(7 − 0.5)/2 = ±3.25, the edge is at ±3.65 (0.4 m away, ≥ step/2)
    const p = xyz(listenerGrid([zone({ w: 7.3, d: 1 })], 1.2))
    expect(p).toHaveLength(14 * 2)
    const xs = p.map((q) => q[0])
    expect(Math.min(...xs)).toBeCloseTo(-3.25, 6)
    expect(Math.max(...xs)).toBeCloseTo(3.25, 6)
  })
  it('a zone smaller than one step gets one point at its centre', () => {
    const p = xyz(listenerGrid([zone({ x: 3, z: -2, w: 0.3, d: 0.2, y: 1 })], 1.7))
    expect(p).toHaveLength(1)
    expect(p[0][0]).toBeCloseTo(3, 6)
    expect(p[0][1]).toBeCloseTo(2.7, 6)
    expect(p[0][2]).toBeCloseTo(-2, 6)
  })
  it('every point of every step is strictly inside its zone (x and z), whatever the zone and the step', () => {
    const zs = [zone({ x: -5, z: 3, w: 7.3, d: 5.1 }), zone({ x: 9, z: 9, w: 0.7, d: 12.9, y: 2 }), zone({ x: 0, z: 0, w: 13.37, d: 0.4 })]
    for (const maxPoints of [20000, 50, 5]) {
      const g = listenerGrid(zs, 1.2, maxPoints)
      const p = xyz(g)
      expect(p.length).toBeGreaterThan(0)
      for (const q of p) {
        const inside = zs.some((zn) => Math.abs(q[0] - zn.x) < zn.w / 2 && Math.abs(q[2] - zn.z) < zn.d / 2)
        expect(inside, `${q} at maxPoints ${maxPoints}`).toBe(true)
      }
    }
  })
  it('y = the zone\'s own floor + the ear height, per zone', () => {
    const g = listenerGrid([zone({ y: 0 }), zone({ x: 20, y: 0.8 })], 1.7)
    const ys = new Set(xyz(g).map((q) => Math.round(q[1] * 1000) / 1000))
    expect([...ys].sort()).toEqual([1.7, 2.5])
  })
  it('seated 1.2 and standing 1.7 differ by exactly 0.5 m in y and nothing else', () => {
    const a = xyz(listenerGrid([zone()], 1.2))
    const b = xyz(listenerGrid([zone()], 1.7))
    expect(a).toHaveLength(b.length)
    a.forEach((q, i) => {
      expect(b[i][1] - q[1]).toBeCloseTo(0.5, 6)
      expect(b[i][0]).toBe(q[0])
      expect(b[i][2]).toBe(q[2])
    })
  })
  it('zones with no area (w or d ≤ 0, or not finite) give no points; no zones give none and the finest step', () => {
    for (const bad of [{ w: 0 }, { d: 0 }, { w: -3 }, { d: NaN }, { w: Infinity }]) expect(listenerGrid([zone(bad)], 1.2).points).toHaveLength(0)
    expect(listenerGrid([], 1.2)).toEqual({ points: new Float32Array(0), stepM: 0.5 })
  })
  it('is deterministic and does not mutate the zones', () => {
    const zs = [zone({ x: 1.5, w: 6.1 })]
    const copy = structuredClone(zs)
    const a = listenerGrid(zs, 1.2)
    const b = listenerGrid(zs, 1.2)
    expect(Array.from(a.points)).toEqual(Array.from(b.points))
    expect(zs).toEqual(copy)
  })
})

describe('listenerGrid: step 0.5 m, then 1 m, then 2 m while the count exceeds maxPoints', () => {
  const big = (d: number) => [zone({ w: 100, d })]
  it('exactly 20000 points at 0.5 m is allowed (the limit is inclusive): 100 × 50 m → 200 × 100', () => {
    const g = listenerGrid(big(50), 1.2)
    expect(g.stepM).toBe(0.5)
    expect(g.points.length / 3).toBe(20000)
  })
  it('20200 points at 0.5 m (100 × 50.5 m → 200 × 101) exceeds it → 1 m: 100 × 50 = 5000', () => {
    const g = listenerGrid(big(50.5), 1.2)
    expect(g.stepM).toBe(1)
    expect(g.points.length / 3).toBe(5000)
  })
  it('1 m exceeds a custom limit too → 2 m: with maxPoints 4999, 5000 at 1 m is too many → 50 × 25 = 1250', () => {
    const g = listenerGrid(big(50), 1.2, 4999)
    expect(g.stepM).toBe(2)
    expect(g.points.length / 3).toBe(1250)
  })
  it('exactly maxPoints at 1 m is accepted: maxPoints 5000 on the 100 × 50.5 zone → 1 m', () => {
    expect(listenerGrid(big(50.5), 1.2, 5000).stepM).toBe(1)
    expect(listenerGrid(big(50.5), 1.2, 5000).points.length / 3).toBe(5000)
  })
  it('2 m is the coarsest: a 300 × 300 m zone is returned at 2 m (22500 points) even though it exceeds 20000', () => {
    const g = listenerGrid([zone({ w: 300, d: 300 })], 1.2)
    expect(g.stepM).toBe(2)
    expect(g.points.length / 3).toBe(150 * 150)
  })
  it('the step is chosen for ALL the zones together: two 16000-point zones (32000 total) → 1 m for both', () => {
    const one = listenerGrid([zone({ w: 100, d: 40 })], 1.2)
    expect(one.stepM).toBe(0.5)
    expect(one.points.length / 3).toBe(16000)
    const both = listenerGrid([zone({ w: 100, d: 40 }), zone({ x: 200, w: 100, d: 40 })], 1.2)
    expect(both.stepM).toBe(1)
    expect(both.points.length / 3).toBe(8000)
  })
  it('the default maxPoints is 20000', () => {
    expect(listenerGrid(big(50), 1.2).stepM).toBe(0.5)
    expect(listenerGrid(big(50), 1.2, 19999).stepM).toBe(1)
  })
  it('a normal room stays at 0.5 m: 18 × 24 m = 36 × 48 = 1728 points', () => {
    const g = listenerGrid([zone({ w: 18, d: 24 })], 1.2)
    expect(g.stepM).toBe(0.5)
    expect(g.points.length / 3).toBe(1728)
  })
})
