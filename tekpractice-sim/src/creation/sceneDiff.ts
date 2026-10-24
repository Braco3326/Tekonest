/**
 * The scene reconciler's plan (P15): what to change in the Babylon scene to go
 * from the design it shows to the next one. State-based, so a grouped store
 * change (undo of a REMOVE = SPAWN + pose + cables, one notify) is planned in
 * one go and the scene never shows an in-between state. Poses compare with the
 * fingerprint's quantisation (`quantField`): float noise is no change. Pure.
 */
import type { PortRef } from '../engine/types'
import type { DesignState, Placement } from '../trials/trial'
import { quantField } from '../trials/fingerprint'

export interface SceneOps {
  /** New instances (with their pose). */
  spawn: Placement[]
  /** Instance ids. */
  remove: string[]
  /** Pose changed. */
  move: Placement[]
  cablesAdd: { key: string; a: PortRef; b: PortRef }[]
  /** Cable keys. */
  cablesRemove: string[]
  /** roomId changed. */
  reloadPlace: boolean
}

/** Direction-free cable key, e.g. 'k12-g in-line-a|ql1 out-main-l'. */
export const cableKey = (a: PortRef, b: PortRef): string => {
  const x = `${a.instance} ${a.port}`
  const y = `${b.instance} ${b.port}`
  return x <= y ? `${x}|${y}` : `${y}|${x}`
}

/** Every instance with its pose; an unplaced instance stands at the origin, yaw 0. */
function posed(d: DesignState): Map<string, Placement> {
  const byId = new Map(d.placements.map((p) => [p.instanceId, p]))
  const out = new Map<string, Placement>()
  for (const { instanceId, deviceId } of d.rig.instances)
    out.set(instanceId, byId.get(instanceId) ?? { instanceId, deviceId, position_m: [0, 0, 0], yawDeg: 0 })
  return out
}

const poseSig = (p: Placement): string =>
  [
    ...p.position_m.map((v) => quantField('position_m', v)),
    quantField('yawDeg', p.yawDeg),
    quantField('tiltDeg', p.tiltDeg ?? 0),
    p.mount ?? 'floor',
  ].join(',')

function cables(d: DesignState): Map<string, { key: string; a: PortRef; b: PortRef }> {
  const out = new Map<string, { key: string; a: PortRef; b: PortRef }>()
  for (const { a, b } of d.rig.connections) {
    const key = cableKey(a, b)
    out.set(key, { key, a: { instance: a.instance, port: a.port }, b: { instance: b.instance, port: b.port } })
  }
  return out
}

export function planSceneOps(prev: DesignState | null, next: DesignState): SceneOps {
  const was = prev ? posed(prev) : new Map<string, Placement>()
  const now = posed(next)
  const ops: SceneOps = { spawn: [], remove: [], move: [], cablesAdd: [], cablesRemove: [], reloadPlace: prev !== null && prev.roomId !== next.roomId }

  for (const [id, p] of was) {
    const q = now.get(id)
    if (!q || q.deviceId !== p.deviceId) ops.remove.push(id)
  }
  for (const [id, q] of now) {
    const p = was.get(id)
    if (!p || p.deviceId !== q.deviceId) ops.spawn.push(structuredClone(q))
    else if (poseSig(p) !== poseSig(q)) ops.move.push(structuredClone(q))
  }

  const cWas = prev ? cables(prev) : new Map<string, { key: string; a: PortRef; b: PortRef }>()
  const cNow = cables(next)
  for (const key of cWas.keys()) if (!cNow.has(key)) ops.cablesRemove.push(key)
  for (const [key, c] of cNow) if (!cWas.has(key)) ops.cablesAdd.push(c)
  return ops
}
