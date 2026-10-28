import { describe, expect, it } from 'vitest'
import { CABLE_HIT_PX, distToSegment, nearestCable } from '../../src/creation/cablePick'

describe('distToSegment', () => {
  it('perpendicular distance inside the segment, endpoint distance beyond it, point distance for a degenerate segment', () => {
    expect(distToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3)
    expect(distToSegment({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5)
    expect(distToSegment({ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5)
    expect(distToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5)
  })
})

describe('nearestCable', () => {
  const line = (y: number): { x: number; y: number }[] => [
    { x: 0, y },
    { x: 100, y },
  ]
  it('hits a cable within the tolerance and returns its id', () => {
    expect(nearestCable([['a', line(50)]], { x: 40, y: 50 + CABLE_HIT_PX - 1 })).toBe('a')
  })
  it('misses a cable farther than the tolerance', () => {
    expect(nearestCable([['a', line(50)]], { x: 40, y: 50 + CABLE_HIT_PX + 1 })).toBeNull()
    expect(nearestCable([], { x: 1, y: 1 })).toBeNull()
  })
  it('the nearest of two cables wins', () => {
    expect(nearestCable([['far', line(54)], ['near', line(48)]], { x: 20, y: 50 })).toBe('near')
    expect(nearestCable([['near', line(48)], ['far', line(54)]], { x: 20, y: 50 })).toBe('near')
  })
  it('a point behind the camera (null) breaks the line: its segments are not hit', () => {
    const broken = [{ x: 0, y: 50 }, null, { x: 100, y: 50 }]
    expect(nearestCable([['a', broken]], { x: 50, y: 50 })).toBeNull()
    expect(nearestCable([['a', [{ x: 0, y: 50 }, { x: 40, y: 50 }, null]]], { x: 20, y: 50 })).toBe('a')
  })
  it('a custom tolerance applies', () => {
    expect(nearestCable([['a', line(50)]], { x: 40, y: 60 }, 12)).toBe('a')
    expect(nearestCable([['a', line(50)]], { x: 40, y: 60 }, 5)).toBeNull()
  })
})
