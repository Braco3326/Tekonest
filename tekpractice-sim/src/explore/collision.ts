/**
 * Explore collisions (ADR-0010 Décision 7) — pure. The player is a circle in the
 * XZ plane; obstacles are axis-aligned boxes. Moves are sub-stepped (no tunnelling
 * through thin walls) and resolved per axis, which gives sliding along walls.
 * Boxes no taller than the step height (cables, ramps) are walked over.
 */
export interface Box {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  /** Top of the obstacle above the floor (m). */
  height: number
}

export interface XZ {
  x: number
  z: number
}

export const STEP_HEIGHT = 0.25
const MAX_SUBSTEP = 0.1

export function circleHitsBox(x: number, z: number, r: number, b: Box): boolean {
  const cx = Math.min(b.maxX, Math.max(b.minX, x))
  const cz = Math.min(b.maxZ, Math.max(b.minZ, z))
  return (x - cx) ** 2 + (z - cz) ** 2 < r * r
}

function blocked(x: number, z: number, r: number, boxes: readonly Box[]): boolean {
  return boxes.some((b) => circleHitsBox(x, z, r, b))
}

/** Furthest free point between a (free) and b along one axis — bisection, 10 steps. */
function furthestFree(a: number, b: number, test: (v: number) => boolean): number {
  if (!test(b)) return b
  let lo = a
  let hi = b
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2
    if (test(mid)) hi = mid
    else lo = mid
  }
  return lo
}

export function resolveMove(
  from: XZ,
  to: XZ,
  radius: number,
  obstacles: readonly Box[],
  stepHeight = STEP_HEIGHT,
): XZ {
  // Boxes already overlapping the start (a device dropped on the player) are
  // ignored so the player can always walk out instead of being frozen.
  const solid = obstacles.filter((b) => b.height > stepHeight && !circleHitsBox(from.x, from.z, radius, b))
  const dx = to.x - from.x
  const dz = to.z - from.z
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / MAX_SUBSTEP))
  let x = from.x
  let z = from.z
  for (let i = 0; i < steps; i++) {
    const nx = x + dx / steps
    x = furthestFree(x, nx, (v) => blocked(v, z, radius, solid))
    const nz = z + dz / steps
    z = furthestFree(z, nz, (v) => blocked(x, v, radius, solid))
  }
  return { x, z }
}

/** Four 0.2 m-thick walls just outside a width (X) × length (Z) room centred on the origin. */
export function roomWalls(width: number, length: number, height: number, thickness = 0.2): Box[] {
  const hw = width / 2
  const hl = length / 2
  return [
    { minX: -hw - thickness, maxX: hw + thickness, minZ: hl, maxZ: hl + thickness, height },
    { minX: -hw - thickness, maxX: hw + thickness, minZ: -hl - thickness, maxZ: -hl, height },
    { minX: hw, maxX: hw + thickness, minZ: -hl, maxZ: hl, height },
    { minX: -hw - thickness, maxX: -hw, minZ: -hl, maxZ: hl, height },
  ]
}
