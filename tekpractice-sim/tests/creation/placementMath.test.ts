import { describe, expect, it } from 'vitest'
import {
  SNAP_DEG,
  SNAP_M,
  clampToRoom,
  rotateStep,
  snapPosition,
  snapYaw,
} from '../../src/creation/placementMath'

describe('constants', () => {
  it('snap values are the plan\'s', () => {
    expect(SNAP_M).toBe(0.25)
    expect(SNAP_DEG).toBe(15)
  })
})

describe('snapPosition', () => {
  it('snaps x and z to the 0.25 m grid and keeps y', () => {
    expect(snapPosition([1.13, 0.4, -2.3], false)).toEqual([1.25, 0.4, -2.25])
    expect(snapPosition([0.12, 0, 0.13], false)).toEqual([0, 0, 0.25])
    expect(snapPosition([-0.12, 0, 7.49], false)).toEqual([0, 0, 7.5])
  })
  it('never returns -0', () => {
    const [x, , z] = snapPosition([-0.01, 0, -0.1], false)
    expect(Object.is(x, -0)).toBe(false)
    expect(Object.is(z, -0)).toBe(false)
  })
  it('free (Alt) keeps the position exactly, as a copy', () => {
    const p: [number, number, number] = [1.13, 0.4, -2.38]
    const q = snapPosition(p, true)
    expect(q).toEqual(p)
    expect(q).not.toBe(p)
  })
  it('is idempotent', () => {
    const once = snapPosition([3.3, 1, 4.6], false)
    expect(snapPosition(once, false)).toEqual(once)
  })
})

describe('snapYaw', () => {
  it('snaps to 15° steps', () => {
    expect(snapYaw(7, false)).toBe(0)
    expect(snapYaw(8, false)).toBe(15)
    expect(snapYaw(100, false)).toBe(105)
  })
  it('wraps into [0, 360)', () => {
    expect(snapYaw(-15, false)).toBe(345)
    expect(snapYaw(360, false)).toBe(0)
    expect(snapYaw(-720 - 15, false)).toBe(345)
    expect(snapYaw(353, false)).toBe(0)
  })
  it('free keeps 1° steps', () => {
    expect(snapYaw(7.4, true)).toBe(7)
    expect(snapYaw(7.6, true)).toBe(8)
    expect(snapYaw(-1, true)).toBe(359)
    expect(snapYaw(359.6, true)).toBe(0)
  })
})

describe('rotateStep', () => {
  it('R / Shift+R: ±15°, wrapping', () => {
    expect(rotateStep(0, 1, false)).toBe(15)
    expect(rotateStep(0, -1, false)).toBe(345)
    expect(rotateStep(345, 1, false)).toBe(0)
  })
  it('free (Shift): ±1°, wrapping', () => {
    expect(rotateStep(10, 1, true)).toBe(11)
    expect(rotateStep(0, -1, true)).toBe(359)
    expect(rotateStep(359, 1, true)).toBe(0)
  })
  it('twenty-four 15° steps are a full turn', () => {
    let y = 30
    for (let i = 0; i < 24; i++) y = rotateStep(y, 1, false)
    expect(y).toBe(30)
  })
})

describe('clampToRoom', () => {
  const room = { minX: -5, maxX: 5, minZ: -4, maxZ: 4 }
  it('keeps a point inside the room as is', () => {
    expect(clampToRoom([1, 0.2, -2], room)).toEqual([1, 0.2, -2])
  })
  it('respects the default 0.5 m margin', () => {
    expect(clampToRoom([9, 0, -9], room)).toEqual([4.5, 0, -3.5])
    expect(clampToRoom([-4.8, 0, 3.9], room)).toEqual([-4.5, 0, 3.5])
  })
  it('takes another margin, 0 = the room bounds themselves', () => {
    expect(clampToRoom([9, 0, -9], room, 0)).toEqual([5, 0, -4])
  })
  it('a room narrower than twice the margin centres the point', () => {
    expect(clampToRoom([3, 0, 0], { minX: 0, maxX: 0.6, minZ: -4, maxZ: 4 })).toEqual([0.3, 0, 0])
  })
  it('never touches y', () => {
    expect(clampToRoom([0, 1.7, 0], room)[1]).toBe(1.7)
  })
})
