/**
 * Listener grid (Task 36, ADR-0015). Pure.
 *
 * Zones are the room's `audience` / `foh` zones as `roomLayout` gives them: `{ x, z }` is the CENTRE of the rectangle, `w` its size along x,
 * `d` along z, `y` the floor height. Points are at `y + earHeight` (1.2 m seated, 1.7 m standing).
 *
 * Boundary rule (deterministic): per zone the lattice is centred on the zone and its cells are exactly `stepM` wide; a point is the centre
 * of a cell. So no point lies on the zone edge (the nearest is stepM/2 inside), a border strip narrower than one cell is left out, and a
 * zone smaller than one cell gets one point at its centre. Points are ordered zone by zone, rows by z then x. A zone with no area
 * (w or d not > 0 and finite) gives no point. Zones are assumed not to overlap (an overlap gives duplicate points).
 *
 * Step: 0.5 m, then 1 m, then 2 m, the first one whose TOTAL point count (all zones) is ≤ `maxPoints` (default 20 000, inclusive). 2 m is the
 * coarsest: a very large room is returned at 2 m even when that still exceeds `maxPoints`.
 */
export const DEFAULT_MAX_POINTS = 20000
const STEPS = [0.5, 1, 2] as const

type Zone = { x: number; z: number; w: number; d: number; y: number }
const cells = (size: number, step: number): number => (size > 0 && Number.isFinite(size) ? Math.max(1, Math.floor(size / step)) : 0)

export function listenerGrid(zones: readonly Zone[], earHeight: number, maxPoints: number = DEFAULT_MAX_POINTS): { points: Float32Array; stepM: 0.5 | 1 | 2 } {
  const countAt = (step: number): number => zones.reduce((s, zn) => s + cells(zn.w, step) * cells(zn.d, step), 0)
  let stepM: 0.5 | 1 | 2 = STEPS[0]
  for (const s of STEPS) {
    stepM = s
    if (countAt(s) <= maxPoints) break
  }
  const points = new Float32Array(countAt(stepM) * 3)
  let o = 0
  for (const zn of zones) {
    const nx = cells(zn.w, stepM)
    const nz = cells(zn.d, stepM)
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        points[o++] = zn.x + (i - (nx - 1) / 2) * stepM
        points[o++] = zn.y + earHeight
        points[o++] = zn.z + (j - (nz - 1) / 2) * stepM
      }
    }
  }
  return { points, stepM }
}
