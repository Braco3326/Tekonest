/**
 * What the « Choisir un lieu » cards need to know about every place, without
 * loading 32 room files at start: generated with the thumbnails by
 * `tools/room-thumbs.ts` into `placeSummary.json` (a drift test compares it to
 * the room data). Pure.
 */
import type { RoomFileT } from '../explore/roomSchema'
import type { SetEnvId } from './places'
import summaryJson from './placeSummary.json'

export interface RoomSummary {
  id: string
  name_fr: string
  family: string
  size: string
  /** Typical length × width × height, metres. */
  dims: [number, number, number]
  /** `gear_positions` whose `equipment_id` is a catalog device (L2). */
  catalogGear: number
}
export interface SetSummary {
  envId: SetEnvId
  name: string
  /** Floor width × length, metres. */
  floor: [number, number]
}
export interface PlaceSummary {
  rooms: RoomSummary[]
  sets: SetSummary[]
}

export function summarizeRoom(room: RoomFileT, catalogIds: ReadonlySet<string>): RoomSummary {
  const d = room.dimensions_m
  return {
    id: room.id,
    name_fr: room.name_fr,
    family: room.family ?? 'other',
    size: room.size ?? 'medium',
    dims: [d.length.typical, d.width.typical, d.height.typical],
    catalogGear: (room.gear_positions ?? []).filter((g) => catalogIds.has(g.equipment_id)).length,
  }
}

export const placeSummary = (): PlaceSummary => summaryJson as PlaceSummary
