/**
 * The data behind a place (C3), loaded on demand: a room template + its layout
 * (one lazy chunk per room, as the legacy sandbox), a set's environment preset,
 * or the neutral blank room. Never throws: an unknown or broken place falls
 * back to the blank room data (warned), assets never block the shell.
 */
import type { RoomLayout } from '../explore/roomLayout'
import type { RoomFileT } from '../explore/roomSchema'
import type { EnvironmentT } from '../../tools/schemas'
import { BLANK_SIZE, placeKey, type PlaceRef } from './places'

export { BLANK_SIZE }

export interface PlaceBounds {
  width: number
  length: number
  floorAt(x: number, z: number): number
}

/** `fallback`: the place asked for could not be loaded, this is the blank room instead (the shell tells the learner). */
export type PlaceData = (
  | ({ kind: 'room'; file: RoomFileT; layout: RoomLayout } & PlaceBounds)
  | ({ kind: 'set'; env: EnvironmentT } & PlaceBounds)
  | ({ kind: 'blank' } & PlaceBounds)
) & { fallback?: true }

const flat = (): number => 0
export const blankData = (fallback = false): PlaceData => ({ kind: 'blank', ...BLANK_SIZE, floorAt: flat, ...(fallback ? { fallback: true as const } : {}) })

const roomLoaders = import.meta.glob<{ default: unknown }>('../../content/rooms/*.json')
const envLoaders = import.meta.glob<{ default: unknown }>('../../content/environments/*.json')

export async function loadPlaceData(place: PlaceRef): Promise<PlaceData> {
  try {
    if (place.kind === 'room') {
      const loader = roomLoaders[`../../content/rooms/${place.id}.json`]
      if (!loader || place.id === 'index') throw new Error('salle inconnue')
      const [m, { RoomFile }, { roomLayout }] = await Promise.all([loader(), import('../explore/roomSchema'), import('../explore/roomLayout')])
      const parsed = RoomFile.safeParse(m.default)
      if (!parsed.success) throw new Error(`salle invalide: ${parsed.error.issues[0]?.message}`)
      const layout = roomLayout(parsed.data)
      return { kind: 'room', file: parsed.data, layout, width: layout.width, length: layout.length, floorAt: layout.floorAt }
    }
    if (place.kind === 'set') {
      const loader = envLoaders[`../../content/environments/${place.envId}.json`]
      if (!loader) throw new Error('décor inconnu')
      const [m, { Environment }] = await Promise.all([loader(), import('../../tools/schemas')])
      const parsed = Environment.safeParse(m.default)
      if (!parsed.success) throw new Error(`décor invalide: ${parsed.error.issues[0]?.message}`)
      const [width, length] = parsed.data.backdrop.floorSize
      return { kind: 'set', env: parsed.data, width, length, floorAt: flat }
    }
  } catch (e) {
    console.warn(`[creation] lieu ${placeKey(place)} indisponible, salle vide neutre`, e instanceof Error ? e.message : e)
    return blankData(true)
  }
  return blankData()
}
