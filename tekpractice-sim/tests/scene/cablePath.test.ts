import { describe, expect, it } from 'vitest'
import { CableBudget, catenaryPoints, pointAlong, polylineLength, SEGMENTS_FULL } from '../../src/scene/cablePath'

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
