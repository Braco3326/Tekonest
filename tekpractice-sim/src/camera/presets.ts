/**
 * Camera presets store (designer nav, Task 5) - pure: storage is injected.
 * Three view slots per room, persisted as { version: 1, rooms: { [roomKey]: pose|null x3 } }.
 * zod-validated; corrupt data or a version mismatch reads as empty (the next
 * save rewrites a clean file). Every storage access is guarded: private mode
 * or a full quota must never break the game.
 */
import { z } from 'zod'

export const PRESETS_KEY = 'audio-sim/camera-presets'
export const PRESETS_VERSION = 1
export const PRESET_SLOTS = 3

const finite = z.number().refine(Number.isFinite)
const poseSchema = z.object({
  alpha: finite,
  beta: finite,
  radius: finite.refine((r) => r > 0),
  target: z.tuple([finite, finite, finite]),
})
const slotsSchema = z.tuple([poseSchema.nullable(), poseSchema.nullable(), poseSchema.nullable()])
const fileSchema = z.object({ version: z.literal(PRESETS_VERSION), rooms: z.record(z.string(), z.unknown()) })

/** Same shape as window.__audioSim.camera(). */
export type CameraPoseJSON = z.infer<typeof poseSchema>
export type PresetSlots = [CameraPoseJSON | null, CameraPoseJSON | null, CameraPoseJSON | null]

const empty = (): PresetSlots => [null, null, null]

/** The room id when a procedural room is loaded, else `level:<levelId>` (sandbox included). */
export const roomKeyFor = (roomId: string | undefined, levelId: string): string => roomId ?? `level:${levelId}`

/** Whole file, tolerant: anything invalid reads as "no rooms". */
function readRooms(storage: Pick<Storage, 'getItem'>): Record<string, unknown> {
  try {
    const raw = storage.getItem(PRESETS_KEY)
    if (!raw) return {}
    const file = fileSchema.safeParse(JSON.parse(raw))
    return file.success ? file.data.rooms : {}
  } catch {
    return {}
  }
}

export function loadPresets(storage: Pick<Storage, 'getItem'>, roomKey: string): PresetSlots {
  const slots = slotsSchema.safeParse(readRooms(storage)[roomKey])
  return slots.success ? slots.data : empty()
}

/** Returns false when the slot is out of range, the pose is invalid, or the write failed (the UI toasts it). */
export function savePreset(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  roomKey: string,
  slot: number,
  pose: CameraPoseJSON,
): boolean {
  if (!Number.isInteger(slot) || slot < 0 || slot >= PRESET_SLOTS) return false
  const parsed = poseSchema.safeParse(pose)
  if (!parsed.success) return false
  try {
    const rooms = readRooms(storage)
    // Other rooms' corrupt entries are dropped rather than carried forward.
    const clean: Record<string, PresetSlots> = {}
    for (const [k, v] of Object.entries(rooms)) {
      const s = slotsSchema.safeParse(v)
      if (s.success) clean[k] = s.data
    }
    const slots = clean[roomKey] ?? empty()
    slots[slot] = parsed.data
    clean[roomKey] = slots
    storage.setItem(PRESETS_KEY, JSON.stringify({ version: PRESETS_VERSION, rooms: clean }))
    return true
  } catch {
    return false
  }
}
