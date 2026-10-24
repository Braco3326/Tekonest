/**
 * « Avec le matériel du modèle » (L2): the KB template's gear_positions become a
 * design with the devices the catalog knows; the rest is listed as
 * « matériel non disponible dans le jeu ». Pure.
 */
import type { Registry } from '../engine/CatalogLoader'
import type { RoomFileT } from '../explore/roomSchema'
import type { DesignState } from '../trials/trial'

export interface GearSpawnPlan {
  design: DesignState
  unavailable: { equipmentId: string; zone: string; note?: string }[]
}

export function designFromRoomGear(room: RoomFileT, registry: Registry): GearSpawnPlan {
  const design: DesignState = { roomId: `room:${room.id}`, rig: { instances: [], connections: [], controls: {} }, placements: [] }
  const unavailable: GearSpawnPlan['unavailable'] = []
  const counts = new Map<string, number>()
  for (const g of room.gear_positions ?? []) {
    if (!registry.deviceById.has(g.equipment_id)) {
      unavailable.push({ equipmentId: g.equipment_id, zone: g.zone, ...(g.note !== undefined ? { note: g.note } : {}) })
      continue
    }
    const n = (counts.get(g.equipment_id) ?? 0) + 1
    counts.set(g.equipment_id, n)
    const instanceId = `${g.equipment_id}-g${n}`
    design.rig.instances.push({ instanceId, deviceId: g.equipment_id })
    design.placements.push({ instanceId, deviceId: g.equipment_id, position_m: [g.position_m[0], g.position_m[1], g.position_m[2]], yawDeg: g.rotation_deg ?? 0 })
  }
  return { design, unavailable }
}

/**
 * The note's list (« matériel non disponible dans le jeu »): one line per model, « × n » when repeated,
 * data order; the KB display name when `names` knows it, else the id.
 */
export function unavailableList(unavailable: GearSpawnPlan['unavailable'], names: Readonly<Record<string, string>> = {}): string[] {
  const counts = new Map<string, number>()
  for (const u of unavailable) counts.set(u.equipmentId, (counts.get(u.equipmentId) ?? 0) + 1)
  return [...counts].map(([id, n]) => {
    const label = names[id] ?? id
    return n > 1 ? `${label} × ${n}` : label
  })
}
