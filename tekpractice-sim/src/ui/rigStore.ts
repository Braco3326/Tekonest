/**
 * Saved rigs v2 (ADR-0012 Décision 9): the pure core behind the shelf's rig
 * save box. Storage is injected and has NO removeItem, on purpose (same
 * invariants as the Essais store, ADR-0012 Décision 6):
 *
 * - `audio-sim/rigs.v2` = { version: 2, rigs: SavedRig[] }: a NEW key, so an
 *   old build (which only knows `audio-sim/rigs`) can never overwrite it.
 * - First load with no v2 key: the v1 file is COPIED into v2 (`roomId: null`);
 *   v1 is never written. Once v2 exists, v1 is never read again.
 * - Strict zod parse on load; positions must be 4 finite numbers. Any failure
 *   copies the raw string into `audio-sim/rigs.v2.quarantine` (append-only,
 *   deduplicated, capped at 5: evicting the oldest is warned) and the list
 *   starts empty. Quarantine write failure → read-only. Never a reset.
 * - Every failure is RETURNED (warnings / reasons), never thrown, never silent.
 */
import { z } from 'zod'
import type { ControlValue } from '../engine/types'

export const RIGS_V1_KEY = 'audio-sim/rigs'
export const RIGS_KEY = 'audio-sim/rigs.v2'
export const RIGS_QUARANTINE_KEY = 'audio-sim/rigs.v2.quarantine'
export const RIGS_VERSION = 2
export const RIG_QUARANTINE_CAP = 5

/** Deliberately no removeItem: rigs can be quarantined, never erased. */
export type RigStorage = Pick<Storage, 'getItem' | 'setItem'>

/** Explore placement (ADR-0010): [x, y, z, yawDeg], 4 finite numbers. */
export type RigPosition = [number, number, number, number]

export interface SavedRig {
  name: string
  savedAt: string
  /** The procedural room the rig was built in (null = environment preset / v1). */
  roomId: string | null
  instances: { instanceId: string; deviceId: string }[]
  connections: { a: { instance: string; port: string }; b: { instance: string; port: string } }[]
  controls: Record<string, Record<string, ControlValue>>
  /** Optional: rigs without positions use the spawn grid. */
  positions?: Record<string, RigPosition>
}

export type RigWarning =
  | 'migrated'
  | 'migration-failed'
  | 'quarantined'
  | 'quarantine-evicted'
  | 'quarantine-failed'
  | 'storage-unavailable'
export interface RigLoad {
  rigs: SavedRig[]
  warnings: RigWarning[]
  readOnly: boolean
}
export type RigSaveFailure = 'exists' | 'invalid' | 'empty' | 'read-only' | 'quota' | 'storage'
export type RigSaveResult = { ok: true; replaced: boolean; warnings: RigWarning[] } | { ok: false; reason: RigSaveFailure }

// ---- strict schema ----
const finite = z.number().refine(Number.isFinite)
const position = z.tuple([finite, finite, finite, finite])
const portRef = z.object({ instance: z.string(), port: z.string() }).strict()
const rigFields = {
  name: z.string(),
  savedAt: z.string(),
  instances: z.array(z.object({ instanceId: z.string(), deviceId: z.string() }).strict()),
  connections: z.array(z.object({ a: portRef, b: portRef }).strict()),
  controls: z.record(z.string(), z.record(z.string(), z.union([z.boolean(), z.string()]))),
}
const rigSchema = z.object({ ...rigFields, roomId: z.string().nullable(), positions: z.record(z.string(), position).optional() }).strict()
const fileSchema = z.object({ version: z.literal(RIGS_VERSION), rigs: z.array(rigSchema) }).strict()
/** v1 was written by looser code: unknown extra fields are dropped, positions filtered below. */
const v1Schema = z.object({
  version: z.literal(1),
  rigs: z.array(z.object({ ...rigFields, positions: z.record(z.string(), z.unknown()).optional() })),
})
const quarantineSchema = z
  .object({ version: z.literal(1), items: z.array(z.object({ at: z.string(), raw: z.string(), reason: z.string() }).strict()) })
  .strict()

export interface RigQuarantineItem {
  at: string
  raw: string
  reason: string
}

const isQuota = (err: unknown): boolean => {
  const e = err as { name?: string; code?: number } | null
  return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)
}

const issueReason = (prefix: string, err: z.ZodError): string => {
  const issue = err.issues[0]
  return `${prefix}schema:${issue ? issue.path.join('.') || issue.message : '?'}`
}

const parseRaw = <T>(raw: string, schema: z.ZodType<T>, prefix = ''): { ok: true; data: T } | { ok: false; reason: string } => {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, reason: `${prefix}json` }
  }
  const r = schema.safeParse(json)
  return r.success ? { ok: true, data: r.data } : { ok: false, reason: issueReason(prefix, r.error) }
}

const validPosition = (v: unknown): v is RigPosition =>
  Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === 'number' && Number.isFinite(n))

/**
 * v1 → v2 (copy): roomId null. Position entries that are not 4 finite numbers
 * are not copied: the v1 loader already ignored them (grid fallback), so the
 * rig loads exactly as before, and v1 itself keeps them.
 */
function fromV1(rigs: z.infer<typeof v1Schema>['rigs']): SavedRig[] {
  return rigs.map((r) => {
    const out: SavedRig = {
      name: r.name,
      savedAt: r.savedAt,
      roomId: null,
      instances: r.instances,
      connections: r.connections,
      controls: r.controls,
    }
    if (r.positions) out.positions = Object.fromEntries(Object.entries(r.positions).filter(([, v]) => validPosition(v))) as Record<string, RigPosition>
    return out
  })
}

/** Appends raw to the rig quarantine (deduplicated, capped). An unreadable quarantine is itself kept as an item. */
function quarantine(storage: RigStorage, raw: string, reason: string, at: string): { saved: boolean; evicted: boolean } {
  let items: RigQuarantineItem[]
  try {
    const qRaw = storage.getItem(RIGS_QUARANTINE_KEY)
    if (qRaw === null) items = []
    else {
      const q = parseRaw(qRaw, quarantineSchema)
      items = q.ok ? q.data.items : [{ at, raw: qRaw, reason: 'quarantine-unreadable' }]
    }
  } catch {
    return { saved: false, evicted: false }
  }
  if (items.some((i) => i.raw === raw)) return { saved: true, evicted: false }
  items.push({ at, raw, reason })
  const evicted = items.length > RIG_QUARANTINE_CAP
  items = items.slice(-RIG_QUARANTINE_CAP)
  try {
    storage.setItem(RIGS_QUARANTINE_KEY, JSON.stringify({ version: 1, items }))
  } catch {
    return { saved: false, evicted: false }
  }
  return { saved: true, evicted }
}

const quarantined = (storage: RigStorage, raw: string, reason: string, now: () => string): RigLoad => {
  const q = quarantine(storage, raw, reason, now())
  if (!q.saved) return { rigs: [], warnings: ['quarantine-failed'], readOnly: true }
  return { rigs: [], warnings: q.evicted ? ['quarantined', 'quarantine-evicted'] : ['quarantined'], readOnly: false }
}

const isoNow = (): string => new Date().toISOString()

export function loadRigs(storage: RigStorage, now: () => string = isoNow): RigLoad {
  let raw: string | null
  try {
    raw = storage.getItem(RIGS_KEY)
  } catch {
    return { rigs: [], warnings: ['storage-unavailable'], readOnly: true }
  }
  if (raw !== null) {
    const file = parseRaw(raw, fileSchema)
    return file.ok ? { rigs: file.data.rigs as SavedRig[], warnings: [], readOnly: false } : quarantined(storage, raw, file.reason, now)
  }

  // No v2 yet: one-time COPY migration from v1 (v1 is never written).
  let rawV1: string | null
  try {
    rawV1 = storage.getItem(RIGS_V1_KEY)
  } catch {
    return { rigs: [], warnings: ['storage-unavailable'], readOnly: true }
  }
  if (rawV1 === null) return { rigs: [], warnings: [], readOnly: false }
  const v1 = parseRaw(rawV1, v1Schema, 'v1:')
  if (!v1.ok) return quarantined(storage, rawV1, v1.reason, now)
  const rigs = fromV1(v1.data.rigs)
  try {
    storage.setItem(RIGS_KEY, JSON.stringify({ version: RIGS_VERSION, rigs }))
  } catch {
    return { rigs, warnings: ['migration-failed'], readOnly: false }
  }
  return { rigs, warnings: ['migrated'], readOnly: false }
}

/**
 * Saves a rig. Same name → `{ ok:false, reason:'exists' }` unless the learner
 * confirmed (`overwrite: true`). Load warnings (migration, quarantine) are passed on.
 */
export function saveRig(
  storage: RigStorage,
  rig: SavedRig,
  opts: { overwrite?: boolean; now?: () => string } = {},
): RigSaveResult {
  if (!rig.name.trim()) return { ok: false, reason: 'empty' }
  const parsed = rigSchema.safeParse(rig)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const loaded = loadRigs(storage, opts.now)
  if (loaded.readOnly) return { ok: false, reason: 'read-only' }
  const replaced = loaded.rigs.some((r) => r.name === rig.name)
  if (replaced && !opts.overwrite) return { ok: false, reason: 'exists' }
  const rigs = [...loaded.rigs.filter((r) => r.name !== rig.name), parsed.data as SavedRig]
  try {
    storage.setItem(RIGS_KEY, JSON.stringify({ version: RIGS_VERSION, rigs }))
  } catch (err) {
    return { ok: false, reason: isQuota(err) ? 'quota' : 'storage' }
  }
  return { ok: true, replaced, warnings: loaded.warnings }
}
