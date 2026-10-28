/**
 * Placement maths (Task 24, CA-10): pure, no Babylon. Position snaps to a 0.25 m grid
 * and yaw to 15° steps; Alt (position) and Shift (yaw) lift the snap ("free").
 * Y is never snapped here: the floor height comes from the room.
 */
export const SNAP_M = 0.25
export const SNAP_DEG = 15

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

/** R / Shift+R: one step of 15° (free: 1°) either way, in [0, 360). */
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
