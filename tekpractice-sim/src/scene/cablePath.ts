/**
 * cablePath — pure math for cable rendering (no Babylon imports, unit-testable).
 * Catenary approximated by a parabola sag: cheap, stable, visually right.
 * CableBudget enforces the CLAUDE.md perf guard: when the global point budget
 * is exceeded, new/updated cables degrade to a STRAIGHT LINE (2 points)
 * before the render loop ever drops frames.
 */

export interface P3 {
  x: number
  y: number
  z: number
}

export const SEGMENTS_FULL = 24
export const SAG_FACTOR = 0.15
export const MIN_SAG = 0.05

/** How far above the surface a resting cable's centre sits (m): a committed cable's radius is 12 mm (CableRenderer), so 15 mm lays it ON the floor, its underside 3 mm above it. */
export const FLOOR_CLEARANCE = 0.015

/**
 * The surface a cable lies on: `floorAt(x, z)` is the height of the floor under a point (a raised deck included), `clearance` the height of the cable's centre above
 * it (the cable's radius, plus a hair so the tube never fights the floor's own drawing).
 */
export interface FloorRest {
  floorAt(x: number, z: number): number
  clearance: number
}

/**
 * segments+1 points from a to b with parabolic sag (t·(1−t) profile). segments=1 → straight.
 * Founder, 2026-11-15: « the cables are shown underground ». The sag (15 % of the run, at least 5 cm) pulls the middle of a cable BELOW the line between its ports, so a
 * cable between two low ports went under the floor. With `rest` every inner point is lifted to the floor under it plus the clearance: the cable lies on the surface
 * (on a deck, on the deck), and the two ends stay exactly on the ports. Without `rest` (the legacy callers) the shape is the old one.
 * Mission 3 A (« gravity first »): a cable renderer given a floor no longer draws with this parabola but with `gravityPath` (cableGravity.ts), which
 * drops from a raised port and lies on the surface instead of flying; this function stays as it was for the legacy callers.
 */
export function catenaryPoints(a: P3, b: P3, segments: number, rest?: FloorRest): P3[] {
  const sag = segments <= 1 ? 0 : Math.max(MIN_SAG, Math.hypot(b.x - a.x, b.z - a.z) * SAG_FACTOR)
  const pts: P3[] = []
  for (let i = 0; i <= segments; i++) {
    if (i === 0 || i === segments) {
      pts.push(i === 0 ? { x: a.x, y: a.y, z: a.z } : { x: b.x, y: b.y, z: b.z }) // the ends are the ports exactly, not a + (b - a) with its rounding
      continue
    }
    const t = i / segments
    const x = a.x + (b.x - a.x) * t
    const z = a.z + (b.z - a.z) * t
    const y = a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t)
    pts.push({ x, y: rest ? Math.max(y, rest.floorAt(x, z) + rest.clearance) : y, z })
  }
  return pts
}

/** Length of a polyline in metres (0 for fewer than two points). A cable's drawn length is this over its path points. */
export function polylineLength(points: readonly P3[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y, points[i].z - points[i - 1].z)
  return total
}

/**
 * Point at parametric position t (0..1) along a polyline, arc-length accurate.
 * Drives the signal-flow pulses (motion = pedagogical feedback: the signal
 * VISIBLY travels out → in along live cables).
 */
export function pointAlong(points: readonly P3[], t: number): P3 {
  if (points.length === 0) return { x: 0, y: 0, z: 0 }
  if (points.length === 1 || t <= 0) return { ...points[0] }
  const lengths: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const l = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    lengths.push(l)
    total += l
  }
  if (total === 0 || t >= 1) return { ...points[points.length - 1] }
  let target = t * total
  for (let i = 0; i < lengths.length; i++) {
    if (target > lengths[i]) {
      target -= lengths[i]
      continue
    }
    const a = points[i]
    const b = points[i + 1]
    const k = lengths[i] === 0 ? 0 : target / lengths[i]
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k }
  }
  return { ...points[points.length - 1] }
}

export class CableBudget {
  private granted = new Map<string, number>()

  constructor(private maxPoints = 1200) {}

  /** Points already granted to everyone else. */
  private othersTotal(excluding: string): number {
    let sum = 0
    for (const [id, pts] of this.granted) if (id !== excluding) sum += pts
    return sum
  }

  /** Ask segments for a cable; returns SEGMENTS if it fits the budget, else 1 (straight line). */
  grant(cableId: string, desired = SEGMENTS_FULL): number {
    const wanted = desired + 1
    const segments = this.othersTotal(cableId) + wanted <= this.maxPoints ? desired : 1
    this.granted.set(cableId, segments + 1)
    return segments
  }

  /** Would `points` more for this cable (its own previous grant aside) fit the budget? (Mission 3 A: a gravity path has as many points as it needs.) */
  fits(cableId: string, points: number): boolean {
    return this.othersTotal(cableId) + points <= this.maxPoints
  }

  /** Book `points` for this cable, whatever the budget (its coarse shape, never dropped: a cable is always drawn). */
  take(cableId: string, points: number): void {
    this.granted.set(cableId, points)
  }

  release(cableId: string): void {
    this.granted.delete(cableId)
  }
}
