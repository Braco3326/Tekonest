/**
 * Placement maths (Task 24, CA-10; Task 25): pure, no Babylon. Position snaps to a 0.25 m grid
 * and yaw to 15° steps; Alt lifts the snap ("free") everywhere: a drag or a drop moves freely
 * with Alt held, and Alt+R / Alt+Shift+R turn by 1° instead of 15°.
 * Y is never snapped here: the floor height comes from the room.
 */
import type { Mount } from '../trials/trial'

export const SNAP_M = 0.25
export const SNAP_DEG = 15
/** Ctrl+D: the copy stands this far along x from the original. */
export const DUPLICATE_OFFSET_M = 0.5

type V3 = [number, number, number]

/** Adding 0 turns -0 into 0 (a pose must not print or fingerprint as « -0 »). */
const clean = (n: number): number => n + 0

/** x and z to the 0.25 m grid unless `free` (Alt); y is kept. Always a new array. */
export function snapPosition(p: V3, free: boolean): V3 {
  if (free) return [p[0], p[1], p[2]]
  return [clean(Math.round(p[0] / SNAP_M) * SNAP_M), p[1], clean(Math.round(p[2] / SNAP_M) * SNAP_M)]
}

const wrap360 = (deg: number): number => clean(((deg % 360) + 360) % 360)

/** Yaw to 15° steps (free: whole degrees), in [0, 360). */
export function snapYaw(deg: number, free: boolean): number {
  const step = free ? 1 : SNAP_DEG
  return wrap360(Math.round(deg / step) * step) % 360
}

/** R / Shift+R: one step of 15° either way; free (Alt+R, Alt+Shift+R): 1°. In [0, 360). */
export function rotateStep(yawDeg: number, dir: 1 | -1, free: boolean): number {
  const next = wrap360(yawDeg + dir * (free ? 1 : SNAP_DEG))
  // 1e-9: float drift of repeated additions never leaves 14.999999999999998 behind.
  return wrap360(Math.round(next * 1e9) / 1e9) % 360
}

export interface RoomBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** A device's pose as the SET_POSE intent carries it. */
export interface Pose {
  position: V3
  yawDeg: number
  tiltDeg: number
  mount: Mount
}

/**
 * Where Ctrl+D puts the copy: 0.5 m further along x, snapped to the grid, same yaw / tilt / mount.
 * With the room's `bounds`, a copy that would land past the far wall goes 0.5 m the other way
 * instead, so it never sits exactly on its original.
 */
export function duplicatePose(p: Pose, bounds?: RoomBounds): Pose {
  let dx = DUPLICATE_OFFSET_M
  if (bounds && p.position[0] + dx > bounds.maxX) dx = -dx
  return {
    position: snapPosition([p.position[0] + dx, p.position[1], p.position[2]], false),
    yawDeg: p.yawDeg,
    tiltDeg: p.tiltDeg,
    mount: p.mount,
  }
}

const clampAxis = (v: number, lo: number, hi: number, margin: number): number => {
  const a = lo + margin
  const b = hi - margin
  return a > b ? (lo + hi) / 2 : Math.min(b, Math.max(a, v))
}

/** Keep x and z inside the room, `margin` m from its walls (default 0.5); an over-narrow room centres. */
export function clampToRoom(p: V3, bounds: RoomBounds, margin = 0.5): V3 {
  return [
    clean(clampAxis(p[0], bounds.minX, bounds.maxX, margin)),
    p[1],
    clean(clampAxis(p[2], bounds.minZ, bounds.maxZ, margin)),
  ]
}
