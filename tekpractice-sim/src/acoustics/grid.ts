/**
 * Listener grid (Task 36, ADR-0015). Pure.
 *
 * Zones are the room's `audience` / `foh` zones as `roomLayout` gives them: `{ x, z }` is the CENTRE of the rectangle, `w` its size along x,
 * `d` along z, `y` the floor height. Points are at `y + earHeight` (1.2 m seated, 1.7 m standing).
 *
 * Boundary rule (deterministic): per zone the lattice is centred on the zone and its cells are exactly `stepM` wide; a point is the centre
 * of a cell. So no point lies on the zone edge (the nearest is stepM/2 inside), a border strip narrower than one cell is left out, and a
 * zone smaller than one cell gets one point at its centre. Points are ordered zone by zone, rows by z then x. A zone with no area
 * (w or d not > 0 and finite) gives no point and hides nothing.
 *
 * Overlapping zones (the shipped rooms have them: a `foh` rectangle inside the `audience` one): a listener position is counted once. A
 * candidate point of a zone is DROPPED when it lies inside (edges included, as `roomLayout.floorAt`) the rectangle of an EARLIER zone of the
 * list whose floor height is the same (within FLOOR_TOLERANCE_M); zones at another floor height (a balcony above the floor) never hide each
 * other. The earlier zone wins, so list the zone whose lattice you want to keep first. The step choice below counts the points that are kept.
 * Known limit: a point in a border strip of the earlier zone that its own lattice leaves out is dropped too (at most one cell wide).
 *
 * Step: 0.5 m, then 1 m, then 2 m, the first one whose TOTAL kept point count (all zones) is ≤ `maxPoints` (default 20 000, inclusive). 2 m is
 * the coarsest: a very large room is returned at 2 m even when that still exceeds `maxPoints`.
 */
export const DEFAULT_MAX_POINTS = 20000
/** Two floor heights closer than this (1 mm) are the same floor. */
export const FLOOR_TOLERANCE_M = 0.001
const STEPS = [0.5, 1, 2] as const

type Zone = { x: number; z: number; w: number; d: number; y: number }
const cells = (size: number, step: number): number => (size > 0 && Number.isFinite(size) ? Math.max(1, Math.floor(size / step)) : 0)
const hasArea = (zn: Zone): boolean => cells(zn.w, 1) > 0 && cells(zn.d, 1) > 0

/** Calls `emit(x, y, z)` for each kept point of the grid at `step`, in output order; returns how many were kept. */
function walk(zones: readonly Zone[], earHeight: number, step: number, emit?: (x: number, y: number, z: number) => void): number {
  let kept = 0
  for (let k = 0; k < zones.length; k++) {
    const zn = zones[k]
    const nx = cells(zn.w, step)
    const nz = cells(zn.d, step)
    // earlier zones of the same floor height that have an area: they own the positions inside their rectangle
    const owners = zones.slice(0, k).filter((o) => hasArea(o) && Math.abs(o.y - zn.y) <= FLOOR_TOLERANCE_M)
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = zn.x + (i - (nx - 1) / 2) * step
        const z = zn.z + (j - (nz - 1) / 2) * step
        if (owners.some((o) => Math.abs(x - o.x) <= o.w / 2 && Math.abs(z - o.z) <= o.d / 2)) continue
        kept++
        emit?.(x, zn.y + earHeight, z)
      }
    }
  }
  return kept
}

export function listenerGrid(zones: readonly Zone[], earHeight: number, maxPoints: number = DEFAULT_MAX_POINTS): { points: Float32Array; stepM: 0.5 | 1 | 2 } {
  let stepM: 0.5 | 1 | 2 = STEPS[0]
  let count = 0
  for (const s of STEPS) {
    stepM = s
    count = walk(zones, earHeight, s)
    if (count <= maxPoints) break
  }
  const points = new Float32Array(count * 3)
  let o = 0
  walk(zones, earHeight, stepM, (x, y, z) => {
    points[o++] = x
    points[o++] = y
    points[o++] = z
  })
  return { points, stepM }
}
