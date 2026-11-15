import { describe, expect, it } from 'vitest'
import { CableBudget, catenaryPoints, FLOOR_CLEARANCE, pointAlong, polylineLength, SEGMENTS_FULL } from '../../src/scene/cablePath'

describe('polylineLength (the metres a cable hover reads)', () => {
  it('sums the segments of a known polyline: 3-4-5 then 12 up', () => {
    expect(polylineLength([{ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 4 }, { x: 3, y: 12, z: 4 }])).toBeCloseTo(17, 9)
  })
  it('0 for no point, one point or a repeated point', () => {
    expect(polylineLength([])).toBe(0)
    expect(polylineLength([{ x: 1, y: 2, z: 3 }])).toBe(0)
    expect(polylineLength([{ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 }])).toBe(0)
  })
  it('a drawn cable over 6 m of floor is a little longer than 6 m (its sag), never shorter than the straight line', () => {
    const len = polylineLength(catenaryPoints({ x: 0, y: 0, z: 0 }, { x: 6, y: 0, z: 0 }, SEGMENTS_FULL))
    expect(len).toBeGreaterThan(6)
    expect(len).toBeCloseTo(6.36, 1) // parabola sag 0.15 x run: 6 x (1 + 8/3 x 0.15^2)
  })
})

describe('catenaryPoints', () => {
  it('produces segments+1 points from a to b with downward sag in the middle', () => {
    const a = { x: 0, y: 1, z: 0 }
    const b = { x: 2, y: 1, z: 0 }
    const pts = catenaryPoints(a, b, SEGMENTS_FULL)
    expect(pts).toHaveLength(SEGMENTS_FULL + 1)
    expect(pts[0]).toEqual(a)
    expect(pts[SEGMENTS_FULL]).toEqual(b)
    const mid = pts[SEGMENTS_FULL / 2]
    expect(mid.y).toBeLessThan(1) // sag
    expect(mid.x).toBeCloseTo(1)
  })

  it('degrades to a straight 2-point line at segments=1 (budget guard shape)', () => {
    const pts = catenaryPoints({ x: 0, y: 1, z: 0 }, { x: 2, y: 1, z: 2 }, 1)
    expect(pts).toHaveLength(2)
    expect(pts[0].y).toBe(1)
    expect(pts[1].y).toBe(1) // no sag on straight lines
  })
})

/**
 * Founder, 2026-11-15: « the cables are shown underground, that's a bug, they must be on the surface, not under ».
 * Root cause: the cable is a parabola that sags by 15 % of its horizontal run (at least 5 cm) BELOW the line between its two ports, with no floor under it. Two ports
 * at floor level (a connector 5 cm up) 6 m apart: the middle of the cable is 0.05 - 0.9 = 0.85 m under the floor. Any cable between low ports dips under it.
 */
describe('catenaryPoints rests on the floor, never under it', () => {
  const flat = { floorAt: () => 0, clearance: FLOOR_CLEARANCE }
  const low = (x: number, y = 0.05, z = 0): { x: number; y: number; z: number } => ({ x, y, z })

  it('the root cause: with no floor given, two low ports 6 m apart make a cable that dips far under the floor (legacy behaviour, unchanged)', () => {
    const pts = catenaryPoints(low(0), low(6), SEGMENTS_FULL)
    expect(Math.min(...pts.map((q) => q.y))).toBeLessThan(-0.8)
  })

  it('with the floor, no point of the cable is lower than the floor plus the clearance, and the two ends are the ports exactly', () => {
    const a = low(0)
    const b = low(6)
    const pts = catenaryPoints(a, b, SEGMENTS_FULL, flat)
    expect(pts).toHaveLength(SEGMENTS_FULL + 1)
    expect(pts[0]).toEqual(a)
    expect(pts[SEGMENTS_FULL]).toEqual(b)
    for (const q of pts.slice(1, -1)) expect(q.y).toBeGreaterThanOrEqual(FLOOR_CLEARANCE - 1e-12)
  })

  it('a cable that stays above the floor is not changed by it (a high port, a short run)', () => {
    const a = low(0, 1.5)
    const b = low(1, 1.5)
    expect(catenaryPoints(a, b, SEGMENTS_FULL, flat)).toEqual(catenaryPoints(a, b, SEGMENTS_FULL))
  })

  it('it follows a raised deck: on the deck it rests on the deck, off it on the floor', () => {
    const deck = (x: number): number => (x >= 2 && x <= 4 ? 0.6 : 0)
    const pts = catenaryPoints(low(0, 0.05), low(6, 0.05), SEGMENTS_FULL, { floorAt: (x) => deck(x), clearance: FLOOR_CLEARANCE })
    for (const q of pts.slice(1, -1)) expect(q.y).toBeGreaterThanOrEqual(deck(q.x) + FLOOR_CLEARANCE - 1e-12)
    expect(pts.some((q) => q.x > 2.5 && q.x < 3.5 && Math.abs(q.y - (0.6 + FLOOR_CLEARANCE)) < 1e-9)).toBe(true)
  })

  it('a straight 2-point cable (the budget guard) is left alone: it has no inner point to lift', () => {
    const pts = catenaryPoints(low(0), low(6), 1, flat)
    expect(pts).toHaveLength(2)
  })

  it('a cable drawn on the floor is never shorter than the straight line between its ports', () => {
    const len = polylineLength(catenaryPoints(low(0), low(6), SEGMENTS_FULL, flat))
    expect(len).toBeGreaterThanOrEqual(6 - 1e-9)
  })
})

describe('pointAlong — signal pulse position (arc-length accurate)', () => {
  it('midpoint of a straight line', () => {
    const p = pointAlong([{ x: 0, y: 1, z: 0 }, { x: 2, y: 1, z: 0 }], 0.5)
    expect(p).toEqual({ x: 1, y: 1, z: 0 })
  })
  it('clamps at both ends', () => {
    const pts = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }]
    expect(pointAlong(pts, -0.5)).toEqual(pts[0])
    expect(pointAlong(pts, 1.5)).toEqual(pts[1])
  })
  it('weights segments by LENGTH, not by index', () => {
    // 3 points, first segment 9 long, second 1 long → t=0.5 sits inside segment 1
    const pts = [{ x: 0, y: 0, z: 0 }, { x: 9, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }]
    expect(pointAlong(pts, 0.5).x).toBeCloseTo(5)
    expect(pointAlong(pts, 0.95).x).toBeCloseTo(9.5)
  })
})

describe('CableBudget — degrade before dropping frames', () => {
  it('grants full segments while under budget', () => {
    const budget = new CableBudget(100)
    expect(budget.grant('c1', 24)).toBe(24)
    expect(budget.grant('c2', 24)).toBe(24)
  })

  it('grants a straight line once the budget would be exceeded', () => {
    const budget = new CableBudget(60)
    expect(budget.grant('c1', 24)).toBe(24) // 25 pts
    expect(budget.grant('c2', 24)).toBe(24) // 50 pts
    expect(budget.grant('c3', 24)).toBe(1) // would be 75 > 60 → straight
  })

  it('re-granting the same cable does not double-count it', () => {
    const budget = new CableBudget(30)
    expect(budget.grant('c1', 24)).toBe(24)
    expect(budget.grant('c1', 24)).toBe(24) // same id re-granted, still fits
  })

  it('released points return to the pool', () => {
    const budget = new CableBudget(60)
    budget.grant('c1', 24)
    budget.grant('c2', 24)
    expect(budget.grant('c3', 24)).toBe(1)
    budget.release('c1')
    expect(budget.grant('c3', 24)).toBe(24)
  })
})
