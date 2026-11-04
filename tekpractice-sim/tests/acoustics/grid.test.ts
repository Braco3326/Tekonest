/**
 * Task 36: the listener grid. Zones are the room zones as roomLayout gives them: { x, z } is the CENTRE of the rectangle, { w, d } its size
 * along x and z, y the floor height. The boundary rule (pinned below so it is deterministic): the lattice is centred on the zone, its cells
 * are `stepM` wide exactly, a point is the centre of a cell, so no point ever lies on the zone edge (the nearest is stepM/2 inside) and a
 * strip narrower than one step at the border is left out. A zone smaller than one cell gets a single point at its centre.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_MAX_POINTS, listenerGrid } from '../../src/acoustics/grid'

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

describe('listenerGrid: zones that overlap (real room data)', () => {
  /** The audience and foh zones of a shipped room, exactly as roomLayout reads them (rect_m = centre x, centre z, w, d). */
  const room = (id: string): Z[] => {
    const r = JSON.parse(readFileSync(resolve(__dirname, `../../content/rooms/${id}.json`), 'utf8')) as {
      zones: { kind: string; rect_m: [number, number, number, number]; floor_y_m?: number }[]
    }
    return r.zones.filter((z) => z.kind === 'audience' || z.kind === 'foh').map((z) => ({ x: z.rect_m[0], z: z.rect_m[1], w: z.rect_m[2], d: z.rect_m[3], y: z.floor_y_m ?? 0 }))
  }
  const key = (q: [number, number, number]): string => q.map((v) => v.toFixed(4)).join(',')

  it('premise: bar-club-stage-small has an audience zone that contains its foh zone, at the same floor height', () => {
    const [aud, foh] = room('bar-club-stage-small')
    expect(aud).toBeDefined()
    expect(foh).toBeDefined()
    expect(foh.y).toBe(aud.y)
    expect(Math.abs(foh.x - aud.x) + foh.w / 2).toBeLessThanOrEqual(aud.w / 2)
    expect(Math.abs(foh.z - aud.z) + foh.d / 2).toBeLessThanOrEqual(aud.d / 2)
  })
  it('bar-club-stage-small: no listener position appears twice, and the foh zone adds nothing to the audience grid', () => {
    const zs = room('bar-club-stage-small')
    const g = listenerGrid(zs, 1.2)
    const p = xyz(g)
    expect(new Set(p.map(key)).size).toBe(p.length)
    // the audience zone alone: 9.8 / 0.5 = 19 columns, 11.2 / 0.5 = 22 rows
    expect(p).toHaveLength(19 * 22)
    expect(xyz(listenerGrid([zs[0]], 1.2))).toEqual(p)
    // the two lattices of the old behaviour are offset, so the duplicates were NOT identical triples: no two points may be closer than one step
    let nearest = Infinity
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) nearest = Math.min(nearest, Math.hypot(p[i][0] - p[j][0], p[i][2] - p[j][2]))
    expect(nearest).toBeGreaterThanOrEqual(0.5 - 1e-6)
  })
  it('dj-booth-small and concert-hall-medium (same floor height): no duplicate listener position', () => {
    for (const id of ['dj-booth-small', 'concert-hall-medium']) {
      const p = xyz(listenerGrid(room(id), 1.2))
      expect(new Set(p.map(key)).size, id).toBe(p.length)
    }
  })
  it('a zone inside another at a DIFFERENT floor height is kept: both lattices are present', () => {
    const outer = zone({ x: 0, z: 0, w: 4, d: 4, y: 0 })
    const inner = zone({ x: 0, z: 0, w: 2, d: 2, y: 3 })
    const p = xyz(listenerGrid([outer, inner], 1.2))
    expect(p).toHaveLength(8 * 8 + 4 * 4)
    expect(p.filter((q) => Math.abs(q[1] - 4.2) < 1e-6)).toHaveLength(16)
    expect(p.filter((q) => Math.abs(q[1] - 1.2) < 1e-6)).toHaveLength(64)
  })
  it('floor heights equal within 1 mm count as the same height; 2 mm apart do not', () => {
    const outer = zone({ w: 4, d: 4, y: 1 })
    expect(listenerGrid([outer, zone({ w: 2, d: 2, y: 1.0004 })], 1.2).points.length / 3).toBe(64)
    expect(listenerGrid([outer, zone({ w: 2, d: 2, y: 1.002 })], 1.2).points.length / 3).toBe(64 + 16)
  })
  it('only EARLIER zones hide a point: the inner zone listed first keeps its points and the outer one loses the ones it contains', () => {
    const outer = zone({ w: 4, d: 4 })
    const inner = zone({ w: 2, d: 2 })
    const p = xyz(listenerGrid([inner, outer], 1.2))
    expect(p).toHaveLength(16 + (64 - 16)) // inner 4 x 4; outer 8 x 8 minus the 16 outer points inside the inner rectangle
    expect(new Set(p.map(key)).size).toBe(p.length)
  })
  it('partial overlap: a point inside an earlier zone of the same height is dropped, the rest of the later zone stays', () => {
    const a = zone({ x: 0, z: 0, w: 4, d: 2 }) // x from −2 to 2
    const b = zone({ x: 2, z: 0, w: 4, d: 2 }) // x from 0 to 4: half of it lies in a
    const p = xyz(listenerGrid([a, b], 1.2))
    // a: 8 columns x 4 rows = 32. b: 8 x 4 = 32 centres, columns at x = 0.25, 0.75 … 3.75; the 4 columns with x ≤ 1.75 lie inside a
    // (x ≤ 2), so b keeps 4 columns x 4 rows = 16
    expect(p).toHaveLength(32 + 16)
    expect(new Set(p.map(key)).size).toBe(p.length)
  })
  it('the step choice counts the points that are kept: two stacked copies of a zone at the same height count once', () => {
    const z = zone({ w: 100, d: 50 }) // exactly 20000 at 0.5 m
    const g = listenerGrid([z, { ...z }], 1.2)
    expect(g.stepM).toBe(0.5)
    expect(g.points.length / 3).toBe(20000)
  })
  it('an earlier zone with no area hides nothing, even a point lying exactly on its (degenerate) line', () => {
    expect(xyz(listenerGrid([zone({ w: 0, d: 0 }), zone({ w: 1, d: 1 })], 1.2))).toHaveLength(4)
    // the earlier zone is the line x = 0 (w = 0); the later 1.5 x 1.5 zone has a column of points exactly on it (x = −0.5, 0, 0.5): all 9 stay
    expect(xyz(listenerGrid([zone({ w: 0, d: 100 }), zone({ w: 1.5, d: 1.5 })], 1.2))).toHaveLength(9)
  })
  it('the edge of an earlier zone belongs to it (as roomLayout.floorAt): a point exactly on that edge is dropped', () => {
    const a = zone({ x: 0, z: 0, w: 4, d: 4 }) // x from −2 to 2, z from −2 to 2: 8 x 8 = 64 points
    const b = zone({ x: 2, z: 0, w: 1.5, d: 1.5 }) // 3 x 3 points at x = 1.5, 2, 2.5 and z = −0.5, 0, 0.5; x = 1.5 and x = 2 (on the edge) are inside a
    const p = xyz(listenerGrid([a, b], 1.2))
    expect(p).toHaveLength(64 + 3) // only the x = 2.5 column of b is kept
  })

  it('sports-venue-pa-large (four stands and a raised foh): 2 m, within the default limit', () => {
    const zs = room('sports-venue-pa-large')
    const g = listenerGrid(zs, 1.2)
    expect(g.stepM).toBe(2)
    expect(g.points.length / 3).toBeLessThanOrEqual(DEFAULT_MAX_POINTS)
    expect(g.points.length / 3).toBeGreaterThan(0)
    // the step above would have been too many: 1 m gives more than the limit
    const at1m = zs.reduce((s, zn) => s + Math.floor(zn.w) * Math.floor(zn.d), 0)
    expect(at1m).toBeGreaterThan(DEFAULT_MAX_POINTS)
  })
})
