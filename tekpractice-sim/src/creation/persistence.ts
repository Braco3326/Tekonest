/**
 * Mode Création persistence (C16, CA-14): the autosave, the named projects,
 * the dirty marker's fingerprint and the debounce. Pure: the storage is
 * injected (per-origin localStorage in the shell), no DOM, no Babylon.
 *
 * Data safety (ADR-0012 spirit):
 * - Only the two Mode Création keys (+ their quarantine) are ever written; the
 *   legacy rig / progress / Essais keys are never read nor touched here.
 * - Nothing is ever removed (no removeItem). Unreadable data (bad JSON, other
 *   version, wrong shape) is COPIED into `audio-sim/creation.v1.quarantine`
 *   (append-only, deduplicated) before the caller may write over it; when that
 *   copy cannot be made, the result says so (`kept: false`) and the caller
 *   must not write the key.
 * - Every failure is a returned value, never a throw: blocked storage →
 *   'blocked', quota → 'full'.
 * - Untrusted designs are zod-checked; bad placement entries are dropped one
 *   by one (`sanitizePlacements`), the device itself is kept.
 */
import { z } from 'zod'
import type { DesignState } from '../trials/trial'
import { canonicalize } from '../trials/fingerprint'
import { sanitizePlacements } from '../scene/designApplier'
import { PlacementSchema, PortRef } from './templateSchema'

export const AUTOSAVE_KEY = 'audio-sim/creation.v1'
export const PROJECTS_KEY = 'audio-sim/creation-projects.v1'
export const AUTOSAVE_QUARANTINE_KEY = 'audio-sim/creation.v1.quarantine'
export const PROJECTS_MAX = 20

export interface AutosaveV1 {
  version: 1
  savedAt: string
  name: string | null
  design: DesignState
  savedFingerprint: string | null
}

export type LoadResult =
  | { status: 'ok'; data: AutosaveV1 }
  | { status: 'empty' }
  /** `kept`: the unreadable data was copied to the quarantine (false → do not overwrite the key). */
  | { status: 'reset'; reason: 'version' | 'corrupt'; kept: boolean }
  | { status: 'blocked' }

export type SaveResult = 'ok' | 'blocked' | 'full'

export interface QuarantineItem {
  at: string
  key: string
  reason: string
  raw: string
}

// ── schemas ────────────────────────────────────────────────────────────────

const ControlValue = z.union([z.boolean(), z.string()])
const DesignSchema = z.object({
  roomId: z.string().nullable(),
  rig: z.object({
    instances: z.array(z.object({ instanceId: z.string(), deviceId: z.string() })),
    connections: z.array(z.object({ a: PortRef, b: PortRef })),
    controls: z.record(z.record(ControlValue)),
  }),
  // Checked one by one below: a bad entry is dropped, never the whole design.
  placements: z.array(z.unknown()),
})
const AutosaveSchema = z.object({
  version: z.literal(1),
  savedAt: z.string(),
  name: z.string().nullable(),
  design: z.unknown(),
  savedFingerprint: z.string().nullable(),
})
const ProjectsSchema = z.object({
  version: z.literal(1),
  projects: z.array(z.object({ name: z.string(), savedAt: z.string(), design: z.unknown() })),
})
const QuarantineSchema = z.object({
  version: z.literal(1),
  items: z.array(z.object({ at: z.string(), key: z.string(), reason: z.string(), raw: z.string() })),
})

/** An untrusted design → a clean DesignState, or null when its shape is unusable. */
export function parseDesign(v: unknown): DesignState | null {
  const r = DesignSchema.safeParse(v)
  if (!r.success) return null
  const shaped = r.data.placements.filter((p) => PlacementSchema.safeParse(p).success) as DesignState['placements']
  const d = r.data as unknown as DesignState
  return {
    roomId: d.roomId,
    rig: { instances: d.rig.instances, connections: d.rig.connections, controls: d.rig.controls },
    placements: sanitizePlacements({ ...d, placements: shaped }),
  }
}

// ── storage helpers ────────────────────────────────────────────────────────

const isQuota = (err: unknown): boolean => {
  const e = err as { name?: string; code?: number } | null
  return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)
}

type Read = { ok: true; raw: string | null } | { ok: false }
const read = (storage: Storage | null, key: string): Read => {
  if (!storage) return { ok: false }
  try {
    return { ok: true, raw: storage.getItem(key) }
  } catch {
    return { ok: false }
  }
}

const write = (storage: Storage | null, key: string, value: string): SaveResult => {
  if (!storage) return 'blocked'
  try {
    storage.setItem(key, value)
    return 'ok'
  } catch (e) {
    return isQuota(e) ? 'full' : 'blocked'
  }
}

const parseJson = (raw: string): { ok: true; v: unknown } | { ok: false } => {
  try {
    return { ok: true, v: JSON.parse(raw) }
  } catch {
    return { ok: false }
  }
}

/** Everything ever quarantined (oldest first); an unreadable quarantine is returned as one item. */
export function readQuarantine(storage: Storage | null): QuarantineItem[] {
  const r = read(storage, AUTOSAVE_QUARANTINE_KEY)
  if (!r.ok || r.raw === null) return []
  const j = parseJson(r.raw)
  const q = j.ok ? QuarantineSchema.safeParse(j.v) : null
  return q?.success ? q.data.items : [{ at: '', key: AUTOSAVE_QUARANTINE_KEY, reason: 'quarantine-unreadable', raw: r.raw }]
}

/** Append `raw` to the quarantine (deduplicated). True when it is (now) kept there. */
function quarantine(storage: Storage | null, key: string, raw: string, reason: string): boolean {
  const r = read(storage, AUTOSAVE_QUARANTINE_KEY)
  if (!r.ok) return false
  const items = readQuarantine(storage)
  if (items.some((i) => i.raw === raw)) return true
  items.push({ at: new Date().toISOString(), key, reason, raw })
  return write(storage, AUTOSAVE_QUARANTINE_KEY, JSON.stringify({ version: 1, items })) === 'ok'
}

// ── autosave ───────────────────────────────────────────────────────────────

export function loadAutosave(storage: Storage | null): LoadResult {
  const r = read(storage, AUTOSAVE_KEY)
  if (!r.ok) return { status: 'blocked' }
  if (r.raw === null) return { status: 'empty' }
  const reset = (reason: 'version' | 'corrupt'): LoadResult => ({ status: 'reset', reason, kept: quarantine(storage, AUTOSAVE_KEY, r.raw!, reason) })
  const j = parseJson(r.raw)
  if (!j.ok) return reset('corrupt')
  const version = (j.v as { version?: unknown } | null)?.version
  if (version !== 1) return reset(typeof version === 'number' ? 'version' : 'corrupt')
  const a = AutosaveSchema.safeParse(j.v)
  if (!a.success) return reset('corrupt')
  const design = parseDesign(a.data.design)
  if (!design) return reset('corrupt')
  return { status: 'ok', data: { version: 1, savedAt: a.data.savedAt, name: a.data.name, design, savedFingerprint: a.data.savedFingerprint } }
}

/**
 * Copy the stored autosave into the quarantine as is (the store refused or
 * dropped part of it, so the next autosave would lose it). True when it is
 * kept (or there is nothing to keep); false → do not overwrite the key.
 */
export function setAsideAutosave(storage: Storage | null, reason: string): boolean {
  const r = read(storage, AUTOSAVE_KEY)
  if (!r.ok) return false
  return r.raw === null || quarantine(storage, AUTOSAVE_KEY, r.raw, reason)
}

export function saveAutosave(storage: Storage | null, data: AutosaveV1): SaveResult {
  return write(storage, AUTOSAVE_KEY, JSON.stringify(data))
}

// ── named projects ─────────────────────────────────────────────────────────

type ProjectRow = { name: string; savedAt: string; design?: unknown }
/** The stored list: rows, empty, unreadable (raw kept for the quarantine) or blocked. */
function readProjects(storage: Storage | null): { ok: true; rows: ProjectRow[] } | { ok: false; raw: string } | { ok: false; raw: null } {
  const r = read(storage, PROJECTS_KEY)
  if (!r.ok) return { ok: false, raw: null }
  if (r.raw === null) return { ok: true, rows: [] }
  const j = parseJson(r.raw)
  const p = j.ok ? ProjectsSchema.safeParse(j.v) : null
  return p?.success ? { ok: true, rows: p.data.projects } : { ok: false, raw: r.raw }
}

export function listProjects(storage: Storage | null): { name: string; savedAt: string }[] {
  const p = readProjects(storage)
  return p.ok ? p.rows.map(({ name, savedAt }) => ({ name, savedAt })) : []
}

/** Max PROJECTS_MAX; the same name overwrites (the UI confirms first). Never removes another project. */
export function saveProject(storage: Storage | null, name: string, design: DesignState): SaveResult {
  const n = name.trim()
  if (!n) throw new RangeError('saveProject: empty name')
  const p = readProjects(storage)
  let rows: ProjectRow[]
  if (p.ok) rows = p.rows
  else if (p.raw === null) return 'blocked'
  else {
    // Unreadable list: kept in the quarantine first, else never overwritten.
    if (!quarantine(storage, PROJECTS_KEY, p.raw, 'corrupt')) return 'full'
    rows = []
  }
  const at = rows.findIndex((r) => r.name === n)
  if (at < 0 && rows.length >= PROJECTS_MAX) return 'full'
  const row: ProjectRow = { name: n, savedAt: new Date().toISOString(), design }
  const next = at < 0 ? [...rows, row] : rows.map((r, i) => (i === at ? row : r))
  return write(storage, PROJECTS_KEY, JSON.stringify({ version: 1, projects: next }))
}

export function loadProject(storage: Storage | null, name: string): DesignState | null {
  const p = readProjects(storage)
  if (!p.ok) return null
  const row = p.rows.find((r) => r.name === name)
  return row ? parseDesign(row.design) : null
}

// ── dirty marker ───────────────────────────────────────────────────────────

/** cyrb53: a fast 53-bit string hash (sync, unlike the Essais SHA-256 `fingerprint`). */
function cyrb53(s: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/** 'c1:' + hash of the canonical design (order-free, quantised: same rules as the Essais fingerprint). */
export function designFingerprint(design: DesignState): string {
  return 'c1:' + cyrb53(canonicalize(design))
}

/** Unsaved changes: differs from the last save; with no save yet, any gear or cable counts. */
export function isDirty(design: DesignState, savedFingerprint: string | null): boolean {
  if (savedFingerprint === null) return design.rig.instances.length > 0 || design.rig.connections.length > 0
  return designFingerprint(design) !== savedFingerprint
}

// ── debounce + autosave scheduler ──────────────────────────────────────────

export function debounce<T extends unknown[]>(fn: (...a: T) => void, ms: number): ((...a: T) => void) & { flush(): void; cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  let args: T | null = null
  const run = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    const a = args
    args = null
    if (a) fn(...a)
  }
  const d = (...a: T): void => {
    args = a
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(run, ms)
  }
  d.flush = (): void => {
    if (args) run()
  }
  d.cancel = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    args = null
  }
  return d
}

export interface AutosaveDeps {
  storage: Storage | null
  /** What to save now; null = nothing worth saving (no place chosen yet). */
  snapshot(): AutosaveV1 | null
  /** A history transaction is open (drag, stepper burst): never save its in-between state. */
  busy(): boolean
  ms?: number
  onResult?(r: SaveResult): void
}

/** The debounced autosave (C16, 1000 ms): one write per burst of changes, after the transaction commits. */
export function createAutosave(d: AutosaveDeps): { schedule(): void; flush(): void; cancel(): void } {
  const ms = d.ms ?? 1000
  const tick = debounce(() => {
    if (d.busy()) return tick() // try again after the commit
    const snap = d.snapshot()
    if (!snap) return
    const r = saveAutosave(d.storage, snap)
    d.onResult?.(r)
  }, ms)
  return {
    schedule: () => tick(),
    // beforeunload: save now, unless a transaction is open (the last committed autosave stays).
    flush: () => {
      if (!d.busy()) tick.flush()
    },
    cancel: () => tick.cancel(),
  }
}
