/**
 * « Envoyer dans la scène 3D » (mission 2, stage 2; spec §1 item 6, §2): the 2D plan becomes 3D gear through the store's EXISTING intents, as one undoable step.
 *
 * - Identity transform (spec §3): a plan device at (x, z, rot) is a `SPAWN` at [x, floor(x, z), z] with `rotationY: rot`, floor-mounted, the very intent the
 *   inventory's drop dispatches (src/creation/placementController.ts `drop`): y is the floor under the device, a raised deck included, as for a drop. The
 *   plan's cables are `CONNECT`s between the new instances, by the catalogue's own port ids, through a plan id -> instance id map (plan ids may collide
 *   with 3D ids). Everything goes through ONE `history.doAll` (src/creation/history.ts): one Ctrl+Z removes it all, a redo restores it.
 * - Never silent: what does not fit is REPORTED, not created and not moved:
 *     · outside the room: the drop's own rule, `clampToRoom(position, roomBounds, 0)` (a drop or a drag never leaves the floor; here the device would have
 *       to move, so it is refused instead);
 *     · on top of another device: its footprint (symbols.ts `footprintOf`, the asset spec's real size, turned by its yaw) overlaps a floor device of the
 *       3D scene or an earlier device of the plan (touching is fine). The 3D page has no overlap rule of its own (a drop may land on a device); a send
 *       of a whole plan must not stack gear, so this check is the plan's, said as such in the report;
 *     · a device the catalogue does not know;
 *     · a cable whose device was not created, or that the 3D connection rules refuse: the rule's own title and text (the status bar's `rejectionOf`).
 * - Existing 3D gear is never moved or replaced in 'add' mode (the new devices stand beside it, with fresh ids). The 'replace' mode is the existing
 *   replace path's intent (an `APPLY_DESIGN` of the plan alone in the same place, as « Remplacer le matériel » does for a model), asked by the page first.
 * - The planning runs on a private, throw-away CreationStore holding a copy of the 3D design (the store's code is not changed; the 3D store is never
 *   handed here): the intents are checked in order there, so the real dispatch applies exactly what was checked.
 */
import type { Registry } from '../engine/CatalogLoader'
import type { PortRef } from '../engine/types'
import type { Intent } from '../ui/intents'
import type { DesignState } from '../trials/trial'
import { CreationStore, creationEvaluator } from '../creation/store'
import { clampToRoom, type RoomBounds } from '../creation/placementMath'
import { creationRuleText } from '../creation/ruleTexts'
import { rejectionOf, type RuleRow } from '../creation/shell/statusModel'
import { footprintCorners } from './geometry'
import type { Plan2D, PortEnd } from './model'
import { footprintOf } from './symbols'

/** What the 3D page lends the 2D page for a send: closures over its store and history, never the store itself (boot.ts builds it). */
export interface SpawnTarget {
  /** A copy of the 3D design now. */
  design(): DesignState
  /** The floor's bounds (the drop clamps to them). */
  roomBounds(): RoomBounds
  /** The floor height at (x, z) (a raised deck included), as a drop reads it. */
  floorAt(x: number, z: number): number
  /** `history.doAll`: all or nothing, ONE entry. */
  apply(intents: readonly Intent[], label: string): { ok: true } | { ok: false; index: number }
  /** The replace path: `history.do({ type: 'APPLY_DESIGN', design }, label)`. */
  replace(design: DesignState, label: string): boolean
  /** The undo key's label in the 3D view (« Ctrl+Z »). */
  undoLabel(): string
  /** Select and frame these new instances in the 3D view (the page is closed first). */
  show(ids: readonly string[]): void
}

export type SpawnMode = 'add' | 'replace'

export interface SpawnedDevice {
  planId: string
  instanceId: string
  deviceId: string
  position: [number, number, number]
  rotationY: number
}
export interface SpawnedCable {
  planId: string
  a: PortRef
  b: PortRef
}
export type DeviceRefusal =
  | { planId: string; deviceId: string; reason: 'unknown-device' | 'outside' }
  | { planId: string; deviceId: string; reason: 'overlap'; with: { id: string; deviceId: string; inScene: boolean } }
  | { planId: string; deviceId: string; reason: 'store'; code: string; message: string }
export type CableRefusal =
  | { planId: string; a: PortEnd; b: PortEnd; reason: 'device'; device: string }
  | { planId: string; a: PortEnd; b: PortEnd; reason: 'rule'; code: string; title: string; detail: string }

export interface SpawnPlan {
  mode: SpawnMode
  /** In order: every SPAWN, then every CONNECT ('add'); [] in 'replace' (see `design`). */
  intents: Intent[]
  devices: SpawnedDevice[]
  cables: SpawnedCable[]
  refusedDevices: DeviceRefusal[]
  refusedCables: CableRefusal[]
  /** 'replace': the whole design to apply (the plan's gear alone, the same place). */
  design?: DesignState
}

type Pt = { x: number; z: number }

/** Two convex quads overlap (separating axis test); sharing an edge or a corner is NOT an overlap. */
export function quadsOverlap(p: readonly Pt[], q: readonly Pt[], eps = 1e-6): boolean {
  for (const poly of [p, q])
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!
      const b = poly[(i + 1) % poly.length]!
      const nx = -(b.z - a.z)
      const nz = b.x - a.x
      const len = Math.hypot(nx, nz) || 1
      const proj = (s: readonly Pt[]): [number, number] => {
        let lo = Infinity
        let hi = -Infinity
        for (const v of s) {
          const t = (v.x * nx + v.z * nz) / len
          if (t < lo) lo = t
          if (t > hi) hi = t
        }
        return [lo, hi]
      }
      const [p0, p1] = proj(p)
      const [q0, q1] = proj(q)
      if (p1 <= q0 + eps || q1 <= p0 + eps) return false
    }
  return true
}

const EMPTY_RIG = { instances: [], connections: [], controls: {} }

/** The send, planned and checked on a scratch store: nothing is dispatched to the 3D page. */
export function planSpawn(registry: Registry, plan: Plan2D, target: Pick<SpawnTarget, 'design' | 'roomBounds' | 'floorAt'>, mode: SpawnMode): SpawnPlan {
  const current = target.design()
  const base: DesignState = mode === 'add' ? current : { roomId: current.roomId, rig: structuredClone(EMPTY_RIG), placements: [] }
  const scratch = new CreationStore(registry, creationEvaluator(registry), base)
  const text = creationRuleText(registry.catalog.rules as readonly RuleRow[])
  const bounds = target.roomBounds()
  const out: SpawnPlan = { mode, intents: [], devices: [], cables: [], refusedDevices: [], refusedCables: [] }

  // what a new device may not stand on: the floor gear of the scene kept ('add'), then each plan device created before it
  const obstacles: { id: string; deviceId: string; inScene: boolean; corners: Pt[] }[] = base.placements
    .filter((p) => (p.mount ?? 'floor') === 'floor')
    .map((p) => ({ id: p.instanceId, deviceId: p.deviceId, inScene: true, corners: footprintCorners({ x: p.position_m[0], z: p.position_m[2], rot: p.yawDeg }, footprintOf(p.deviceId)) }))

  const idOf = new Map<string, string>()
  for (const dv of plan.devices) {
    if (!registry.deviceById.has(dv.deviceId)) {
      out.refusedDevices.push({ planId: dv.id, deviceId: dv.deviceId, reason: 'unknown-device' })
      continue
    }
    const kept = clampToRoom([dv.x, 0, dv.z], bounds, 0)
    if (kept[0] !== dv.x || kept[2] !== dv.z) {
      out.refusedDevices.push({ planId: dv.id, deviceId: dv.deviceId, reason: 'outside' })
      continue
    }
    const corners = footprintCorners(dv, footprintOf(dv.deviceId))
    const hit = obstacles.find((o) => quadsOverlap(o.corners, corners))
    if (hit) {
      out.refusedDevices.push({ planId: dv.id, deviceId: dv.deviceId, reason: 'overlap', with: { id: hit.id, deviceId: hit.deviceId, inScene: hit.inScene } })
      continue
    }
    const instanceId = scratch.newInstanceId(dv.deviceId)
    const position: [number, number, number] = [dv.x, target.floorAt(dv.x, dv.z), dv.z]
    const intent: Intent = { type: 'SPAWN', deviceId: dv.deviceId, instanceId, position, rotationY: dv.rot, mount: 'floor' }
    const r = scratch.dispatch(intent)
    if (!r.ok) {
      out.refusedDevices.push({ planId: dv.id, deviceId: dv.deviceId, reason: 'store', code: r.error.code, message: r.error.message })
      continue
    }
    idOf.set(dv.id, instanceId)
    out.intents.push(intent)
    out.devices.push({ planId: dv.id, instanceId, deviceId: dv.deviceId, position, rotationY: dv.rot })
    obstacles.push({ id: dv.id, deviceId: dv.deviceId, inScene: false, corners })
  }

  for (const c of plan.cables) {
    const ia = idOf.get(c.a.dev)
    const ib = idOf.get(c.b.dev)
    const ends = { planId: c.id, a: { dev: c.a.dev, port: c.a.port }, b: { dev: c.b.dev, port: c.b.port } }
    if (ia === undefined || ib === undefined) {
      out.refusedCables.push({ ...ends, reason: 'device', device: ia === undefined ? c.a.dev : c.b.dev })
      continue
    }
    const a: PortRef = { instance: ia, port: c.a.port }
    const b: PortRef = { instance: ib, port: c.b.port }
    const intent: Intent = { type: 'CONNECT', a, b }
    const r = scratch.dispatch(intent)
    if (!r.ok) {
      const t = rejectionOf(r.error, [a, b], text)
      out.refusedCables.push({ ...ends, reason: 'rule', code: r.error.code, title: t.title, detail: t.detail })
      continue
    }
    out.intents.push(intent)
    out.cables.push({ planId: c.id, a, b })
  }

  if (mode === 'replace') {
    out.design = scratch.design()
    out.intents = []
  }
  return out
}

/** Plan and dispatch the send as ONE history entry. Not ok (nothing dispatched) when nothing fits, or when the 3D page refused it. */
export function spawnInto(registry: Registry, plan: Plan2D, target: SpawnTarget, mode: SpawnMode, label: string): { ok: boolean; plan: SpawnPlan } {
  const p = planSpawn(registry, plan, target, mode)
  if (p.devices.length === 0) return { ok: false, plan: p }
  const ok = mode === 'replace' ? target.replace(p.design!, label) : target.apply(p.intents, label).ok
  return { ok, plan: p }
}
