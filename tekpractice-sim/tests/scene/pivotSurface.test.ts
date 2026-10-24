/**
 * Review minor 4: the floor re-pivot only lands on FLOORS (ground, room floor,
 * raised zone tops) — never walls, deck sides or ceilings.
 */
import { describe, expect, it } from 'vitest'
import { isUpFacing, nearestUpHit } from '../../src/scene/pivotSurface'

describe('isUpFacing (picked face normal, world space)', () => {
  it('accepts a floor / a deck top', () => {
    expect(isUpFacing({ x: 0, y: 1, z: 0 })).toBe(true)
    expect(isUpFacing({ x: 0.3, y: 0.95, z: 0 })).toBe(true) // gentle rake
  })
  it('rejects walls, deck sides, ceilings', () => {
    expect(isUpFacing({ x: 1, y: 0, z: 0 })).toBe(false)
    expect(isUpFacing({ x: 0, y: 0.5, z: 0.87 })).toBe(false)
    expect(isUpFacing({ x: 0, y: -1, z: 0 })).toBe(false)
  })
})

describe('nearestUpHit (a wall back-face in front of the floor must not block it)', () => {
  it('skips non-up hits and returns the nearest up-facing one', () => {
    const hits = [
      { distance: 3, normal: { x: 0, y: 0, z: 1 }, point: [0, 2, 5] as [number, number, number] }, // wall
      { distance: 9, normal: { x: 0, y: 1, z: 0 }, point: [1, 0, 2] as [number, number, number] }, // floor
      { distance: 7, normal: { x: 0, y: 1, z: 0 }, point: [1, 0.6, 3] as [number, number, number] }, // deck top
    ]
    expect(nearestUpHit(hits)).toEqual([1, 0.6, 3])
  })
  it('null when only walls were hit', () => {
    expect(nearestUpHit([{ distance: 1, normal: { x: 1, y: 0, z: 0 }, point: [0, 0, 0] }])).toBeNull()
    expect(nearestUpHit([])).toBeNull()
  })
})
