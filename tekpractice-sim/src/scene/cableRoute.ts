/**
 * cableRoute — the plan geometry of a hand-drawn cable route (mission 3 B, spec docs/superpowers/specs/2026-11-15-hand-drawn-cables-design.md §3–§4).
 * Pure: no Babylon, no DOM. Every point is a plan point (x, z) in metres on the room floor; the room is centred on the origin (as roomLayout), so the
 * snap grid's crossings are the multiples of the step from the room centre.
 *
 * What lives here and what lives in cableGravity.ts (the split, decided for stage 1):
 * - HERE, in plan only: snapping to the grid (10 cm, 25 cm, 50 cm, 1 m), « Angles droits », clamping to the room's floor rectangle, the rounded corners
 *   (a short arc, radius up to 0.15 m and never more than a third of either adjacent segment) and the plan length of the drawn, rounded path.
 * - IN cableGravity.gravityPath (unchanged support logic): lifting the plan onto the surface. The rounded plan is the `route` its run follows; the run
 *   samples the surface along it, finds every deck edge (bisection) and every device edge (slab test) on it, and climbs each on a 5:1 ramp: a segment
 *   that crosses a deck edge gets points at the edge and climbs it instead of cutting through. `gravityPath(..., { route, round: true })` calls
 *   `roundCorners` on its own plan (the two connector-bend tips plus the route), so the arcs are measured on the path actually drawn.
 */
import type { XZ } from './cableGravity'

/** The snap sizes of the drawing bar (m), in the order the selector shows them. */
export const SNAP_STEPS_M = [0.1, 0.25, 0.5, 1] as const
export type SnapStepM = (typeof SNAP_STEPS_M)[number]
/** The snap size a tracing starts with (founder: 25 cm). */
export const DEFAULT_SNAP_M: SnapStepM = 0.25
/** Largest corner radius (m). */
export const CORNER_RADIUS_M = 0.15
/** A corner's arc never takes more than this share of either segment next to it (so two arcs never overlap). */
export const CORNER_SHARE = 1 / 3
/** The lattice every snap size sits on (m): the store clamps an outside point onto it, so a clamped point is on no foreign grid. */
export const ROUTE_LATTICE_M = 0.05
/** Most points one route may have (the store refuses more). */
export const MAX_ROUTE_POINTS = 256
/** Arc chords: one per this angle of turn at most (a right angle = 4 chords). */
const ARC_STEP_RAD = Math.PI / 8
/** Tie tolerance in grid units: 0.35 / 0.1 is 3.4999… in floating point, still a tie. */
const TIE_EPS = 1e-9

/** The room's floor rectangle (m). */
export interface FloorBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** The floor rectangle of a room `width` (x) by `length` (z), centred on the origin (roomLayout's convention). */
export function roomBounds(width: number, length: number): FloorBounds {
  return { minX: -width / 2, maxX: width / 2, minZ: -length / 2, maxZ: length / 2 }
}

/** A clean decimal: 0.3, not 0.30000000000000004, and never -0. */
const clean = (v: number): number => Math.round(v * 1e9) / 1e9 + 0

/** The nearest multiple of `step` (ties away from zero), kept within [min, max] on the grid when they are given. */
function snapCoord(v: number, step: number, min?: number, max?: number): number {
  let k = Math.sign(v) * Math.floor(Math.abs(v) / step + 0.5 + TIE_EPS)
  if (min !== undefined && max !== undefined) {
    const kMin = Math.ceil(min / step - TIE_EPS)
    const kMax = Math.floor(max / step + TIE_EPS)
    if (kMin > kMax) return clean(Math.min(max, Math.max(min, v))) // a room narrower than one step: the rectangle itself
    k = Math.min(kMax, Math.max(kMin, k))
  }
  return clean(k * step)
}

/**
 * The grid crossing nearest to `p` for a grid of `step` metres (ties away from zero, so a mirrored point snaps to the mirrored crossing). With `bounds`,
 * a point past a wall comes back to the last crossing inside the room's floor.
 */
export function snapToGrid(p: XZ, step: number, bounds?: FloorBounds | null): XZ {
  if (!(step > 0)) return { x: p.x, z: p.z }
  return bounds
    ? { x: snapCoord(p.x, step, bounds.minX, bounds.maxX), z: snapCoord(p.z, step, bounds.minZ, bounds.maxZ) }
    : { x: snapCoord(p.x, step), z: snapCoord(p.z, step) }
}

/** « Angles droits »: the segment last → candidate kept along one of the room's two axes (the longer one; a 45° candidate goes along x). */
export function snapRightAngle(last: XZ, candidate: XZ): XZ {
  return Math.abs(candidate.x - last.x) >= Math.abs(candidate.z - last.z) ? { x: candidate.x, z: last.z } : { x: last.x, z: candidate.z }
}

const samePoint = (p: XZ, q: XZ): boolean => Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.z - q.z) < 1e-9

/** Drop a point equal to the one before it. */
function dedupe(points: readonly XZ[]): XZ[] {
  const out: XZ[] = []
  for (const p of points) if (!out.length || !samePoint(out[out.length - 1]!, p)) out.push({ x: p.x, z: p.z })
  return out
}

/** Every point snapped onto the `step` grid inside the room's floor rectangle; a point equal to the one before it is dropped. */
export function clampRoute(points: readonly XZ[], bounds: FloorBounds, step: number): XZ[] {
  return dedupe(points.map((p) => snapToGrid(p, step, bounds)))
}

/**
 * The store's clamp (the intent does not know the snap size the learner chose): a point inside the room's floor is left exactly as it is; a coordinate
 * past a wall comes back to the last `ROUTE_LATTICE_M` crossing inside, a lattice every snap size sits on. Repeated points are dropped.
 */
export function clampToRoom(points: readonly XZ[], bounds: FloorBounds): XZ[] {
  const one = (v: number, min: number, max: number): number => (v < min || v > max ? snapCoord(Math.min(max, Math.max(min, v)), ROUTE_LATTICE_M, min, max) : v)
  return dedupe(points.map((p) => ({ x: one(p.x, bounds.minX, bounds.maxX), z: one(p.z, bounds.minZ, bounds.maxZ) })))
}

/** Plan length of a polyline (m). */
export function planLengthM(points: readonly XZ[]): number {
  let s = 0
  for (let i = 1; i < points.length; i++) s += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.z - points[i - 1]!.z)
  return s
}

/**
 * The plan with every bend rounded by a short arc (spec §4): radius up to `radius` (0.15 m), its tangent length never more than a third of either
 * segment next to it. The first and last points are kept as they are; a point on a straight line (collinear) or a U-turn is left unchanged; a repeated
 * point is no corner. Each arc is drawn with one chord per 22.5° of turn at most.
 */
export function roundCorners(plan: readonly XZ[], radius = CORNER_RADIUS_M): XZ[] {
  if (plan.length < 3) return plan.map((p) => ({ x: p.x, z: p.z }))
  const out: XZ[] = [{ x: plan[0]!.x, z: plan[0]!.z }]
  for (let i = 1; i + 1 < plan.length; i++) {
    const a = plan[i - 1]!
    const p = plan[i]!
    const b = plan[i + 1]!
    const la = Math.hypot(p.x - a.x, p.z - a.z)
    const lb = Math.hypot(b.x - p.x, b.z - p.z)
    if (la < 1e-9 || lb < 1e-9) {
      out.push({ x: p.x, z: p.z })
      continue
    }
    const d1 = { x: (p.x - a.x) / la, z: (p.z - a.z) / la }
    const d2 = { x: (b.x - p.x) / lb, z: (b.z - p.z) / lb }
    const cross = d1.x * d2.z - d1.z * d2.x
    const dot = d1.x * d2.x + d1.z * d2.z
    if (Math.abs(cross) < 1e-9) {
      out.push({ x: p.x, z: p.z }) // straight on (collinear) or straight back (U-turn): nothing to round
      continue
    }
    const theta = Math.atan2(Math.abs(cross), dot) // the turn, in (0, π)
    const half = Math.tan(theta / 2)
    const r = Math.min(radius, (CORNER_SHARE * Math.min(la, lb)) / half)
    const t = r * half
    const sign = cross > 0 ? 1 : -1
    const t1 = { x: p.x - d1.x * t, z: p.z - d1.z * t }
    const t2 = { x: p.x + d2.x * t, z: p.z + d2.z * t }
    const nrm = sign > 0 ? { x: -d1.z, z: d1.x } : { x: d1.z, z: -d1.x }
    const c = { x: t1.x + nrm.x * r, z: t1.z + nrm.z * r }
    const v0 = { x: t1.x - c.x, z: t1.z - c.z }
    const n = Math.max(2, Math.ceil(theta / ARC_STEP_RAD))
    out.push(t1)
    for (let k = 1; k < n; k++) {
      const ang = (sign * theta * k) / n
      const cs = Math.cos(ang)
      const sn = Math.sin(ang)
      out.push({ x: c.x + v0.x * cs - v0.z * sn, z: c.z + v0.x * sn + v0.z * cs })
    }
    out.push(t2)
  }
  out.push({ x: plan[plan.length - 1]!.x, z: plan[plan.length - 1]!.z })
  return out
}

/**
 * The plan length (m) of a cable from `a` through `route` to `b`, as drawn: corners rounded (`rounded: false`, the budget's coarse shape: sharp). The
 * drawn 3D length (`cableLengthM`, the hover, the panel) adds the drops and climbs at the two ports to it.
 */
export function routeLengthM(a: XZ, route: readonly XZ[], b: XZ, opts: { rounded?: boolean } = {}): number {
  const plan = dedupe([a, ...route, b])
  return planLengthM(opts.rounded === false ? plan : roundCorners(plan))
}

/** Stored route points (`[x, z]` m, the design's form) as plan points. */
export const toXZ = (points: readonly (readonly [number, number])[]): XZ[] => points.map(([x, z]) => ({ x, z }))
/** Plan points as stored route points. */
export const fromXZ = (points: readonly XZ[]): [number, number][] => points.map((p): [number, number] => [p.x, p.z])

/** An untrusted stored route: the points when it is an array of finite `[x, z]` pairs (at most MAX_ROUTE_POINTS), else null. */
export function readRoute(v: unknown): [number, number][] | null {
  if (!Array.isArray(v) || v.length > MAX_ROUTE_POINTS) return null
  const out: [number, number][] = []
  for (const p of v) {
    if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'number' || typeof p[1] !== 'number' || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null
    out.push([p[0], p[1]])
  }
  return out
}
