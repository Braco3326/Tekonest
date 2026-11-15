/**
 * « Choisir un lieu » as data (Task 12, C15, L1, L2): the cards and the grid
 * keyboard. Pure: no DOM; `placePicker.ts` renders it.
 * Mission 1 (spec 1.3): `cardVisible` adds the room filter of a stored goal to the type filter: a room card and a template card (by its place) show when their room
 * is one of the goal's; the empty room and the sets show only without a goal filter.
 */
import { COPY } from '../copy'

export interface PlaceCard {
  /** placeKey ('room:<id>' | 'set:<envId>' | 'blank') or 'template:<id>'. */
  key: string
  title: string
  /** « L × l × h m » (« l × L m » for a bare floor), French decimal comma. */
  sizeLabel: string
  typeLabel: string
  /** File name under `public/room-thumbs/`. */
  thumb: string
  /** « Avec le matériel du modèle » is offered (L2). */
  withGear: boolean
  /** Catalog devices the model would install (a template: its device count). */
  withGearCount: number
  /** A template card's note line (COPY `picker.templateNote-<id>`, T1.6): what the model already does or what is left to do. Absent on places. */
  note?: string
  /** A template card's place key (`room:<id>`, `blank`...): the goal filter follows it. Absent on places. */
  room?: string
}

export interface PlaceCardInput {
  rooms: { id: string; name_fr: string; family: string; size: string; dims?: [number, number, number]; catalogGear: number }[]
  sets: { envId: string; name: string; floor?: [number, number] }[]
}

/**
 * L2: the 5 rooms whose KB gear matches the catalog the most (count of
 * matched `gear_positions`, ties by id), computed from the data in
 * tests/creation/placePickerModel.test.ts.
 */
export const WITH_GEAR_ROOMS: readonly string[] = [
  'post-atmos-mix-room-medium',
  'radio-talk-studio-medium',
  'concert-hall-medium',
  'foley-dubbing-stage-medium',
  'radio-studio-self-op-small',
]

/** « Salle vide neutre »: the BLANK_SIZE of placeData.ts. */
const BLANK_FLOOR: [number, number] = [24, 14]

const num = (v: number): string => String(Math.round(v * 10) / 10).replace('.', ',')
const dimsLabel = (d: readonly number[]): string => `${d.map(num).join(' × ')} m`
const typeOf = (k: string): string => COPY.placeType![k] ?? COPY.placeType!.other!

export function placeCards(input: PlaceCardInput): PlaceCard[] {
  const P = COPY.picker!
  const blank: PlaceCard = {
    key: 'blank',
    title: P.blank!,
    sizeLabel: dimsLabel(BLANK_FLOOR),
    typeLabel: typeOf('blank'),
    thumb: 'blank.svg',
    withGear: false,
    withGearCount: 0,
  }
  const sets = input.sets.map<PlaceCard>((s) => ({
    key: `set:${s.envId}`,
    title: P[`set-${s.envId}`] ?? s.name,
    sizeLabel: s.floor ? dimsLabel(s.floor) : '',
    typeLabel: typeOf('set'),
    thumb: `set-${s.envId}.svg`,
    withGear: false,
    withGearCount: 0,
  }))
  const rooms = [...input.rooms]
    .sort((a, b) => a.name_fr.localeCompare(b.name_fr, 'fr'))
    .map<PlaceCard>((r) => ({
      key: `room:${r.id}`,
      title: r.name_fr,
      sizeLabel: r.dims ? dimsLabel(r.dims) : '',
      typeLabel: typeOf(r.family),
      thumb: `${r.id}.svg`,
      withGear: WITH_GEAR_ROOMS.includes(r.id),
      withGearCount: r.catalogGear,
    }))
  return [blank, ...sets, ...rooms]
}

/** The « Modèles » row: a template is offered only when its place is a card. */
export function templateCards(templates: { id: string; name_fr: string; roomId: string; devices: number }[], places: readonly PlaceCard[]): PlaceCard[] {
  const out: PlaceCard[] = []
  for (const t of templates) {
    const room = places.find((p) => p.key === t.roomId)
    if (!room) continue
    const note = COPY.picker![`templateNote-${t.id}`]
    out.push({
      key: `template:${t.id}`,
      title: t.name_fr,
      sizeLabel: room.sizeLabel,
      typeLabel: typeOf('template'),
      thumb: room.thumb,
      withGear: false,
      withGearCount: t.devices,
      room: t.roomId,
      ...(note ? { note } : {}),
    })
  }
  return out
}

/** The room id a card opens: a room card's, a template card's place when it is a room; null for the empty room, a set, or a template on one of them. */
export function cardRoom(card: PlaceCard): string | null {
  const key = card.key.startsWith('template:') ? (card.room ?? '') : card.key
  const m = /^room:(.+)$/.exec(key)
  return m ? m[1]! : null
}

/**
 * Whether a card shows: `type` is the type filter's value ('' = every type), `rooms` the room filter of the stored goal (null = none, every card; `[]` = no card, the
 * empty state). Both apply together.
 */
export function cardVisible(card: PlaceCard, f: { type: string; rooms: readonly string[] | null }): boolean {
  if (f.type !== '' && card.typeLabel !== f.type) return false
  if (f.rooms === null) return true
  const room = cardRoom(card)
  return room !== null && f.rooms.includes(room)
}

export type GridKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'

/** The next highlighted card (CA-13: moving never commits). Always in [0, count). */
export function gridMove(index: number, key: GridKey, count: number, columns: number): number {
  if (count <= 0) return 0
  const last = count - 1
  const cols = Math.max(1, Math.floor(columns))
  const i = Math.min(Math.max(0, index), last)
  switch (key) {
    case 'ArrowLeft':
      return Math.max(0, i - 1)
    case 'ArrowRight':
      return Math.min(last, i + 1)
    case 'ArrowUp':
      return i - cols >= 0 ? i - cols : i
    case 'ArrowDown':
      if (i + cols <= last) return i + cols
      // a shorter last row below: land on its last card
      return Math.floor(i / cols) < Math.floor(last / cols) ? last : i
    case 'Home':
      return 0
    case 'End':
      return last
  }
}
