/**
 * The tracing and editing model of a hand-drawn cable (mission 3 B stage 2, spec docs/superpowers/specs/2026-11-15-hand-drawn-cables-design.md §1, §2).
 * Pure: no DOM, no Babylon. The keyboard and the pointer feed the SAME functions (cableRouteController.ts), so a route traced with the arrows and Entrée is
 * the route the same crossings clicked give.
 *
 * Tracing:
 * - The cursor is always on a crossing of the chosen grid (10 cm, 25 cm, 50 cm, 1 m; 25 cm to start), inside the room's floor rectangle.
 * - The point a click or Entrée would place is the `candidate`: the cursor itself, or with « Angles droits » the cursor held on the room axis of the longer
 *   move from the anchor (the last point, or the crossing nearest the first port for the first one). The cursor itself keeps moving freely, so the arrows
 *   never get stuck on an axis.
 * - Arrows move the cursor one step; with Maj, BIG_STEP_FACTOR steps.
 * - A point equal to the last one is not placed (the first click of a double-click on the last point); at MAX_ROUTE_POINTS nothing more is placed.
 * - `finishTrace` gives the whole tracing as ONE route (the store's [x, z] points): the input of ONE SET_ROUTE. No point = nothing to commit; the same points
 *   as before = « unchanged » (the store records a no-op SET_ROUTE, so the caller sends none).
 * - `cancelTrace` gives the previous route back: nothing is dispatched, the cable keeps its shape.
 *
 * Editing (the cable selected, its route's points shown as handles): move a point to another crossing (drag or arrows), add one on a segment, delete one.
 * Each returns the new route, or null when nothing would change: the caller sends exactly one SET_ROUTE per change and never a no-op.
 */
import type { XZ } from '../scene/cableGravity'
import {
  DEFAULT_SNAP_M,
  MAX_ROUTE_POINTS,
  SNAP_STEPS_M,
  fromXZ,
  routeLengthM,
  snapRightAngle,
  snapToGrid,
  type FloorBounds,
  type SnapStepM,
} from '../scene/cableRoute'

/** Maj + an arrow moves this many snap steps (10 cm → 40 cm, 25 cm → 1 m, 50 cm → 2 m, 1 m → 4 m). */
export const BIG_STEP_FACTOR = 4

export interface TraceSetup {
  /** Port A and port B in plan (m): the route is drawn between them, its ends stay on them. */
  from: XZ
  to: XZ
  /** The room's floor rectangle (null: no room known, the grid is unbounded). */
  bounds: FloorBounds | null
  /** The cable's route before this tracing (null = automatic): « Annuler » keeps it. */
  previous: readonly XZ[] | null
  step?: SnapStepM
  rightAngles?: boolean
}

export interface TraceState {
  readonly from: XZ
  readonly to: XZ
  readonly bounds: FloorBounds | null
  readonly previous: readonly XZ[] | null
  /** The points placed so far, in order from port A. */
  readonly points: readonly XZ[]
  /** On a crossing of the grid, inside the room. */
  readonly cursor: XZ
  readonly step: SnapStepM
  readonly rightAngles: boolean
}

export type TraceOutcome = { kind: 'commit'; points: [number, number][] } | { kind: 'unchanged' } | { kind: 'empty' }

const snap = (p: XZ, step: number, bounds: FloorBounds | null): XZ => snapToGrid(p, step, bounds)
const same = (a: XZ, b: XZ): boolean => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.z - b.z) < 1e-9

export const isSnapStep = (v: unknown): v is SnapStepM => (SNAP_STEPS_M as readonly unknown[]).includes(v)

export function startTrace(s: TraceSetup): TraceState {
  const step = s.step && isSnapStep(s.step) ? s.step : DEFAULT_SNAP_M
  return {
    from: { ...s.from },
    to: { ...s.to },
    bounds: s.bounds,
    previous: s.previous ? s.previous.map((p) => ({ ...p })) : null,
    points: [],
    cursor: snap(s.from, step, s.bounds),
    step,
    rightAngles: s.rightAngles === true,
  }
}

/** Where the next segment starts: the last point, else the crossing nearest port A. */
export function anchorOf(s: TraceState): XZ {
  return s.points.length ? s.points[s.points.length - 1]! : snap(s.from, s.step, s.bounds)
}

/** The point a click or Entrée places now. */
export function candidateOf(s: TraceState): XZ {
  return s.rightAngles ? snapRightAngle(anchorOf(s), s.cursor) : s.cursor
}

/** The pointer is over this floor point: the cursor goes to the nearest crossing. */
export function pointerAt(s: TraceState, p: XZ): TraceState {
  const cursor = snap(p, s.step, s.bounds)
  return same(cursor, s.cursor) ? s : { ...s, cursor }
}

/** An arrow: one step along x (dx) or z (dz); `big` (Maj) = BIG_STEP_FACTOR steps. Stops at the walls. */
export function stepCursor(s: TraceState, dx: -1 | 0 | 1, dz: -1 | 0 | 1, big = false): TraceState {
  const k = s.step * (big ? BIG_STEP_FACTOR : 1)
  return pointerAt(s, { x: s.cursor.x + dx * k, z: s.cursor.z + dz * k })
}

export function placePoint(s: TraceState): { state: TraceState; placed: XZ | null } {
  const c = candidateOf(s)
  const last = s.points[s.points.length - 1]
  if ((last && same(last, c)) || s.points.length >= MAX_ROUTE_POINTS) return { state: s, placed: null }
  const placed = { ...c }
  return { state: { ...s, points: [...s.points, placed], cursor: placed }, placed }
}

export function removeLastPoint(s: TraceState): { state: TraceState; removed: XZ | null } {
  if (!s.points.length) return { state: s, removed: null }
  return { state: { ...s, points: s.points.slice(0, -1) }, removed: s.points[s.points.length - 1]! }
}

/** Another snap size: the placed points stay where they are, the cursor goes onto the new grid. A size that is not one of the four is refused. */
export function setStep(s: TraceState, step: SnapStepM): TraceState {
  if (!isSnapStep(step) || step === s.step) return s
  return { ...s, step, cursor: snap(s.cursor, step, s.bounds) }
}

export function setRightAngles(s: TraceState, on: boolean): TraceState {
  return s.rightAngles === on ? s : { ...s, rightAngles: on }
}

export const canFinish = (s: TraceState): boolean => s.points.length > 0

export function finishTrace(s: TraceState): TraceOutcome {
  if (!s.points.length) return { kind: 'empty' }
  if (sameRoute(s.points, s.previous)) return { kind: 'unchanged' }
  return { kind: 'commit', points: fromXZ([...s.points]) }
}

/** « Annuler » / Échap: the route the cable had (null = automatic); nothing to dispatch. */
export function cancelTrace(s: TraceState): XZ[] | null {
  return s.previous ? s.previous.map((p) => ({ ...p })) : null
}

/** The plan length (m) of port A → the placed points → port B, corners rounded as drawn (cableRoute.routeLengthM). */
export function liveLengthM(s: TraceState): number {
  return routeLengthM(s.from, s.points, s.to, { rounded: true })
}

export function sameRoute(a: readonly XZ[] | null | undefined, b: readonly XZ[] | null | undefined): boolean {
  const x = a ?? []
  const y = b ?? []
  return x.length === y.length && x.every((p, i) => same(p, y[i]!))
}

// ── editing ─────────────────────────────────────────────────────────────────

/** Drop consecutive repeats. */
function dedupe(route: readonly XZ[]): XZ[] {
  const out: XZ[] = []
  for (const p of route) if (!out.length || !same(out[out.length - 1]!, p)) out.push({ ...p })
  return out
}

/** Move point `i` to the crossing nearest `to`; null when it stays where it is, lands on a neighbour, or `i` is no point. */
export function movePoint(route: readonly XZ[], i: number, to: XZ, step: number, bounds: FloorBounds | null): XZ[] | null {
  if (!Number.isInteger(i) || i < 0 || i >= route.length) return null
  const p = snap(to, step, bounds)
  if (same(p, route[i]!)) return null
  if ((i > 0 && same(p, route[i - 1]!)) || (i < route.length - 1 && same(p, route[i + 1]!))) return null
  return route.map((q, k) => (k === i ? p : { ...q }))
}

/** Arrows on the selected point: one step (Maj: BIG_STEP_FACTOR), clamped to the room; null when nothing moves. */
export function stepPoint(route: readonly XZ[], i: number, dx: -1 | 0 | 1, dz: -1 | 0 | 1, big: boolean, step: number, bounds: FloorBounds | null): XZ[] | null {
  const q = route[i]
  if (!q) return null
  const k = step * (big ? BIG_STEP_FACTOR : 1)
  return movePoint(route, i, { x: q.x + dx * k, z: q.z + dz * k }, step, bounds)
}

/** Distance from p to the segment a-b (plan). */
function distToSeg(p: XZ, a: XZ, b: XZ): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len2 = dx * dx + dz * dz
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz))
}

/** The segment of port A → route → port B nearest the floor point p: 0 = port A → first point, route.length = last point → port B. */
export function nearestSegment(from: XZ, route: readonly XZ[], to: XZ, p: XZ): number {
  const line = [from, ...route, to]
  let best = 0
  let bestD = Infinity
  for (let i = 0; i + 1 < line.length; i++) {
    const d = distToSeg(p, line[i]!, line[i + 1]!)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/** Add a point on segment `seg` (nearestSegment's numbering) at the crossing nearest p; null when it would land on one of the segment's ends or `seg` is no segment. */
export function insertOnSegment(route: readonly XZ[], seg: number, p: XZ, step: number, bounds: FloorBounds | null): XZ[] | null {
  if (!Number.isInteger(seg) || seg < 0 || seg > route.length || route.length >= MAX_ROUTE_POINTS) return null
  const q = snap(p, step, bounds)
  const before = route[seg - 1]
  const after = route[seg]
  if ((before && same(before, q)) || (after && same(after, q))) return null
  return [...route.slice(0, seg).map((r) => ({ ...r })), q, ...route.slice(seg).map((r) => ({ ...r }))]
}

/** Delete point `i` ([] = the automatic shape); null when `i` is no point. Two equal points left side by side become one. */
export function deletePoint(route: readonly XZ[], i: number): XZ[] | null {
  if (!Number.isInteger(i) || i < 0 || i >= route.length) return null
  return dedupe(route.filter((_, k) => k !== i))
}
