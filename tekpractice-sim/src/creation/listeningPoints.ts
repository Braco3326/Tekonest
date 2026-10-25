/**
 * Named listening points (Task 20, council: only « Régie » is mandatory). Pure: no Babylon.
 * - « Régie »: the centre of the first `foh` zone, else of the first `control-room` zone (French
 *   « régie », as `roomLayout.spawn`), else the room centre at 2/3 depth from the stage wall; a
 *   blank place / venue set (no room layout) has one « Centre » point instead (decision L16).
 * - Every point looks at the stage; a room without a stage looks at the middle of its front
 *   wall (−z: the « stage / far end » of roomLayout, where a studio's monitors and window are).
 * - Keys 1 / 2 / 3 are fixed slots (`keySlot`): 1 = Régie (or Centre), 2 = Premier rang, 3 = Fond de salle.
 * - « Premier rang »: 2 m in front of the stage edge, on the audience floor (only when an
 *   audience zone lies in front of the stage).
 * - « Fond de salle »: 1 m before the back of the last audience zone.
 * Every point sits at floor + ear height (1.2 m seated / 1.7 m standing, Task 19). Room
 * coordinates are the RoomBuilder's own (x across, z toward the audience, front wall = −z), so
 * a point lands on the zone drawn there (the left/right mirror of ADR-0011 is left untouched).
 */
import type { RoomLayout } from '../explore/roomLayout'
import { ORBIT_FEEL } from '../camera/orbitFeel'
import { COPY } from './copy'

export interface ListeningPoint {
  id: string
  label: string
  position: [number, number, number]
}

/** Every id a place may offer, in menu / digit order of a room (the blank place has `centre` only). */
export const POINT_IDS = ['regie', 'premier-rang', 'fond-de-salle', 'centre'] as const

/** The default active listening point (`viewState.listenerPoint`). */
export const DEFAULT_LISTENER_POINT = 'regie'

type Zone = RoomLayout['zones'][number]
const P = (): Readonly<Record<string, string>> => COPY.points!
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
/** v inside [c − half + m, c + half − m], m = min(margin, half). */
const inside = (v: number, c: number, half: number, margin: number): number => {
  const m = Math.min(margin, half)
  return clamp(v, c - half + m, c + half - m)
}
const front = (z: Zone): number => z.z + z.d / 2
const back = (z: Zone): number => z.z - z.d / 2
/** Horizontal distance from (x, z) to a zone's rectangle (0 inside). */
const distTo = (zn: Zone, x: number, z: number): number =>
  Math.hypot(Math.max(0, Math.abs(x - zn.x) - zn.w / 2), Math.max(0, Math.abs(z - zn.z) - zn.d / 2))

/** The listening points of a place, Régie (or Centre) first. */
export function defaultPoints(layout: RoomLayout | null, earHeight: number): ListeningPoint[] {
  if (!layout) return [{ id: 'centre', label: P().centre!, position: [0, earHeight, 0] }]
  const at = (id: string, label: string, x: number, z: number): ListeningPoint => ({
    id,
    label,
    position: [x, layout.floorAt(x, z) + earHeight, z],
  })
  // foh → control-room (French « régie » is also the studio control room; as roomLayout.spawn) → 2/3 depth.
  const desk = layout.zones.find((z) => z.kind === 'foh') ?? layout.zones.find((z) => z.kind === 'control-room')
  const out: ListeningPoint[] = [
    desk
      ? at('regie', P().regie!, desk.x, desk.z)
      : at('regie', P().regie!, 0, -layout.length / 2 + (2 / 3) * layout.length),
  ]
  const stages = layout.zones.filter((z) => z.kind === 'stage')
  const edge = stages.length ? Math.max(...stages.map(front)) : null
  const refX = stages[0]?.x ?? 0
  const audience = layout.zones.filter((z) => z.kind === 'audience' && (edge === null || front(z) > edge))
  if (audience.length) {
    // The audience zone nearest the spot 2 m off the stage edge (no stage: the one nearest the front wall).
    const firstRow =
      edge !== null
        ? audience.reduce((a, b) => (distTo(b, refX, edge + 2) < distTo(a, refX, edge + 2) ? b : a))
        : audience.reduce((a, b) => (back(b) < back(a) || (back(b) === back(a) && Math.abs(b.x) < Math.abs(a.x)) ? b : a))
    const fz = edge !== null ? edge + 2 : back(firstRow) + 2
    out.push(at('premier-rang', P().premierRang!, inside(refX, firstRow.x, firstRow.w / 2, 1), inside(fz, firstRow.z, firstRow.d / 2, 1)))
    const last = audience.reduce((a, b) =>
      front(b) > front(a) || (front(b) === front(a) && Math.abs(b.x - refX) < Math.abs(a.x - refX)) ? b : a
    )
    out.push(at('fond-de-salle', P().fondDeSalle!, inside(refX, last.x, last.w / 2, 1), inside(front(last) - 1, last.z, last.d / 2, 1)))
  }
  // « when the room allows »: a point within 1 m of an earlier one is the same place to listen from.
  return out.filter((p, i) => out.slice(0, i).every((q) => Math.hypot(p.position[0] - q.position[0], p.position[2] - q.position[2]) >= 1))
}

/** Fixed key slots (review Fix 1): 1 = Régie (Centre without a layout), 2 = Premier rang, 3 = Fond de salle. */
const SLOTS: Readonly<Record<string, 1 | 2 | 3>> = { regie: 1, centre: 1, 'premier-rang': 2, 'fond-de-salle': 3 }

/** The key (1 / 2 / 3) of a point id; null for an id without one. */
export function keySlot(id: string): 1 | 2 | 3 | null {
  return SLOTS[id] ?? null
}

/** The point behind key `n` in this place; null when the place has none (a dropped point never renumbers the keys). */
export function pointForKey(points: readonly ListeningPoint[], n: number): ListeningPoint | null {
  return points.find((p) => keySlot(p.id) === n) ?? null
}

/** The point with this id, else the first one (Centre in a blank place); null when there is none. */
export function activePoint(points: readonly ListeningPoint[], id: string): ListeningPoint | null {
  return points.find((p) => p.id === id) ?? points[0] ?? null
}

/** What a listener at `point` looks at: the stage centre (1.2 m above its deck), else the front wall's middle. */
export function pointLookAt(layout: RoomLayout | null, point: ListeningPoint): [number, number, number] {
  const [x, , z] = point.position
  if (!layout) return [x, 1.2, z - 5]
  const stage = layout.zones.find((zn) => zn.kind === 'stage')
  if (stage) return [stage.x, stage.y + 1.2, stage.z]
  return [0, 1.2, -layout.length / 2 + 0.5]
}

/** Orbit-camera pose (ArcRotateCamera) for a listener's view. */
export interface PointPose {
  alpha: number
  beta: number
  radius: number
  target: [number, number, number]
}

/** Keeps the pose inside the orbit's beta guard (Babylon would clamp it, moving the camera off the point). */
const BETA_MARGIN = 0.04
const MIN_RADIUS = 2

/**
 * The orbit camera standing exactly on `position`, turned toward `look`. The target is moved,
 * never the camera: kept ≥ 2 m away horizontally, low enough for the orbit's beta guard
 * (the designer orbit never looks up), and pulled along the line when it is farther than `maxRadius`.
 */
export function pointPose(position: readonly number[], look: readonly number[], maxRadius: number): PointPose {
  const [px, py, pz] = position
  let [tx, ty, tz] = look
  let dx = tx - px
  let dz = tz - pz
  let h = Math.hypot(dx, dz)
  if (h < MIN_RADIUS) {
    const [ux, uz] = h > 1e-9 ? [dx / h, dz / h] : [0, -1] // nothing ahead: look toward the stage end (−z)
    dx = ux * MIN_RADIUS
    dz = uz * MIN_RADIUS
    h = MIN_RADIUS
    tx = px + dx
    tz = pz + dz
  }
  const maxBeta = ORBIT_FEEL.upperBetaLimit - BETA_MARGIN
  const minBeta = ORBIT_FEEL.lowerBetaLimit + BETA_MARGIN
  // beta = angle from +y of (camera − target): drop = py − ty = h / tan(beta).
  ty = clamp(ty, py - h / Math.tan(minBeta), py - h / Math.tan(maxBeta))
  let o = [px - tx, py - ty, pz - tz]
  let r = Math.hypot(o[0], o[1], o[2])
  const rMax = Math.max(MIN_RADIUS, maxRadius)
  if (r > rMax) {
    const k = rMax / r
    o = o.map((v) => v * k)
    tx = px - o[0]
    ty = py - o[1]
    tz = pz - o[2]
    r = rMax
  }
  return { alpha: Math.atan2(o[2], o[0]), beta: Math.acos(o[1] / r), radius: r, target: [tx, ty, tz] }
}
