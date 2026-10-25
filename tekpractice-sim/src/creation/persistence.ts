/**
 * Mode Création persistence (C16, CA-14): the autosave, the named projects,
 * the dirty marker's fingerprint and the debounce. Pure: the storage is
 * injected (per-origin localStorage in the shell), no DOM, no Babylon.
 *
 * Data safety (ADR-0012 spirit):
 * - Only the two Mode Création keys (+ their quarantine) are ever written here; the
 *   legacy rig / progress / Essais keys are never read nor touched here.
 *   Every key Mode Création writes: `audio-sim/creation.v1` (autosave),
 *   `audio-sim/creation-projects.v1` (named projects), `audio-sim/creation.v1.quarantine`
 *   (this file) and `audio-sim/creation-view.v1` (view settings: the ear height, Task 19,
 *   `viewState.ts`: written only when absent or a valid v1 file, never over data it cannot
 *   read). `audio-sim/creation-bindings.v1` (key map) is only read.
 * - Nothing is ever removed (no removeItem). Unreadable data (bad JSON, other
 *   version, wrong shape) is COPIED into `audio-sim/creation.v1.quarantine`
 *   (append-only, deduplicated) before the caller may write over it. The
 *   quarantine is capped (ADR-0012: 5 items × 200 000 chars): when full it
 *   REFUSES the new item (never evicts an old one) and the result says so
 *   (`kept: 'full'`, with the raw data so the caller can offer it for export).
 *   Clearing the quarantine is not implemented (Oscar's decision N19).
 * - Two tabs (ADR-0012 §6): a named project overwritten since this tab read it
 *   (its `stamp` changed) is set aside first (`conflict-kept`); the shell
 *   pauses its autosave when another tab writes (`isForeignWrite`).
 * - Every failure is a returned value, never a throw: blocked storage →
 *   'blocked', quota → 'full', no room to set data aside → 'quarantine-full'.
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
/** ADR-0012 quarantine cap: items, and characters per item. */
export const QUARANTINE_MAX_ITEMS = 5
export const QUARANTINE_MAX_CHARS = 200_000

/** Setting data aside: kept (or already there), refused (cap or quota), or storage blocked. */
export type KeepResult = 'kept' | 'full' | 'blocked'

export interface AutosaveV1 {
  version: 1
  savedAt: string
  name: string | null
  design: DesignState
  savedFingerprint: string | null
  /** The named project's row stamp when this tab last read / wrote it (two-tab check). */
  stamp?: string | null
}

export type LoadResult =
  | { status: 'ok'; data: AutosaveV1 }
  | { status: 'empty' }
  /** `kept` ≠ 'kept': the unreadable `raw` is NOT in the quarantine; the caller must keep it (export) before overwriting. */
  | { status: 'reset'; reason: 'version' | 'corrupt'; kept: KeepResult; raw: string }
  | { status: 'blocked' }

export type SaveResult = 'ok' | 'blocked' | 'full'
/**
 * ok · conflict-kept: saved; another tab's newer copy was set aside first ·
 * list-reset: saved; the unreadable list was set aside and a new one started ·
 * blocked · full (20 projects or quota) · quarantine-full: something had to be
 * set aside first and could not be, so nothing was saved.
 */
export type ProjectSaveResult = 'ok' | 'conflict-kept' | 'list-reset' | 'blocked' | 'full' | 'quarantine-full'

export interface ProjectInfo {
  name: string
  savedAt: string
  /** Changes on every write of this row (two-tab check). */
  stamp: string
}

export type ProjectList =
  | { status: 'ok'; projects: ProjectInfo[] }
  /** The stored list cannot be read; it is set aside at once (`kept`), the key is not rewritten. */
  | { status: 'unreadable'; kept: KeepResult; raw: string }
  | { status: 'blocked' }

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
  stamp: z.string().nullable().optional(),
})
const ProjectsSchema = z.object({
  version: z.literal(1),
  projects: z.array(z.object({ name: z.string(), savedAt: z.string(), stamp: z.string().optional(), design: z.unknown() })),
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

/**
 * Append `raw` to the quarantine (deduplicated). Over the cap (items or
 * size) the item is refused, never an old one evicted. An unreadable
 * quarantine is never rewritten (it would be lost): refused too.
 */
function quarantine(storage: Storage | null, key: string, raw: string, reason: string): KeepResult {
  const r = read(storage, AUTOSAVE_QUARANTINE_KEY)
  if (!r.ok) return 'blocked'
  let items: QuarantineItem[] = []
  if (r.raw !== null) {
    const j = parseJson(r.raw)
    const q = j.ok ? QuarantineSchema.safeParse(j.v) : null
    if (!q?.success) return 'full'
    items = q.data.items
  }
  if (items.some((i) => i.raw === raw)) return 'kept'
  if (items.length >= QUARANTINE_MAX_ITEMS || raw.length > QUARANTINE_MAX_CHARS) return 'full'
  items.push({ at: new Date().toISOString(), key, reason, raw })
  const w = write(storage, AUTOSAVE_QUARANTINE_KEY, JSON.stringify({ version: 1, items }))
  return w === 'ok' ? 'kept' : w
}

/**
 * Everything set aside, plus what could not be (`pending`, held by the
 * shell), as one JSON document for « Exporter les données mises de côté… ».
 * Read-only: nothing is removed.
 */
export function exportBundle(storage: Storage | null, pending: QuarantineItem[], now: string = new Date().toISOString()): string {
  return JSON.stringify(
    { format: 'tekpractice-creation-export', version: 1, exportedAt: now, quarantine: readQuarantine(storage), pending },
    null,
    2,
  )
}

/** A `storage` event from another tab that concerns Mode Création (its autosave, its projects, or a clear()). */
export function isForeignWrite(e: { key: string | null }): boolean {
  return e.key === null || e.key === AUTOSAVE_KEY || e.key === PROJECTS_KEY
}

// ── autosave ───────────────────────────────────────────────────────────────

export function loadAutosave(storage: Storage | null): LoadResult {
  const r = read(storage, AUTOSAVE_KEY)
  if (!r.ok) return { status: 'blocked' }
  if (r.raw === null) return { status: 'empty' }
  const reset = (reason: 'version' | 'corrupt'): LoadResult => ({
    status: 'reset',
    reason,
    kept: quarantine(storage, AUTOSAVE_KEY, r.raw!, reason),
    raw: r.raw!,
  })
  const j = parseJson(r.raw)
  if (!j.ok) return reset('corrupt')
  const version = (j.v as { version?: unknown } | null)?.version
  if (version !== 1) return reset(typeof version === 'number' ? 'version' : 'corrupt')
  const a = AutosaveSchema.safeParse(j.v)
  if (!a.success) return reset('corrupt')
  const design = parseDesign(a.data.design)
  if (!design) return reset('corrupt')
  const { savedAt, name, savedFingerprint, stamp } = a.data
  return { status: 'ok', data: { version: 1, savedAt, name, design, savedFingerprint, ...(stamp !== undefined ? { stamp } : {}) } }
}

/**
 * Copy the stored autosave into the quarantine as is (the store refused or
 * dropped part of it, so the next autosave would lose it). `kept` ≠ 'kept':
 * the caller holds `raw` (export) before overwriting the key.
 */
export function setAsideAutosave(storage: Storage | null, reason: string): { kept: KeepResult; raw: string | null } {
  const r = read(storage, AUTOSAVE_KEY)
  if (!r.ok) return { kept: 'blocked', raw: null }
  if (r.raw === null) return { kept: 'kept', raw: null }
  return { kept: quarantine(storage, AUTOSAVE_KEY, r.raw, reason), raw: r.raw }
}

export function saveAutosave(storage: Storage | null, data: AutosaveV1): SaveResult {
  return write(storage, AUTOSAVE_KEY, JSON.stringify(data))
}

// ── named projects ─────────────────────────────────────────────────────────

type ProjectRow = { name: string; savedAt: string; stamp?: string; design?: unknown }
/** A row's write stamp; rows written before stamps existed use their savedAt. */
const stampOf = (r: ProjectRow): string => r.stamp ?? r.savedAt
/** A fresh write stamp (pass it to `saveProject` to know what this tab wrote). */
export const newStamp = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** The stored list: rows, empty, unreadable (raw) or blocked. Never writes. */
function readProjects(storage: Storage | null): { ok: true; rows: ProjectRow[] } | { ok: false; raw: string } | { ok: false; raw: null } {
  const r = read(storage, PROJECTS_KEY)
  if (!r.ok) return { ok: false, raw: null }
  if (r.raw === null) return { ok: true, rows: [] }
  const j = parseJson(r.raw)
  const p = j.ok ? ProjectsSchema.safeParse(j.v) : null
  return p?.success ? { ok: true, rows: p.data.projects } : { ok: false, raw: r.raw }
}

/** The saved projects; an unreadable list is reported (and set aside at once), never shown as « no project ». */
export function readProjectList(storage: Storage | null): ProjectList {
  const p = readProjects(storage)
  if (p.ok) return { status: 'ok', projects: p.rows.map((r) => ({ name: r.name, savedAt: r.savedAt, stamp: stampOf(r) })) }
  if (p.raw === null) return { status: 'blocked' }
  return { status: 'unreadable', kept: quarantine(storage, PROJECTS_KEY, p.raw, 'corrupt'), raw: p.raw }
}

export function listProjects(storage: Storage | null): { name: string; savedAt: string }[] {
  const p = readProjects(storage)
  return p.ok ? p.rows.map(({ name, savedAt }) => ({ name, savedAt })) : []
}

/**
 * Max PROJECTS_MAX; the same name overwrites (the UI confirms first). Never
 * removes another project. `expectStamp`: the stamp of this name's row when
 * this tab last read it (null: it did not exist); a different stored row was
 * written by another tab and is set aside before the overwrite.
 */
export function saveProject(
  storage: Storage | null,
  name: string,
  design: DesignState,
  opts: { expectStamp?: string | null; stamp?: string; unreadableExported?: string } = {},
): ProjectSaveResult {
  const n = name.trim()
  if (!n) throw new RangeError('saveProject: empty name')
  const p = readProjects(storage)
  let rows: ProjectRow[]
  let listReset = false
  if (p.ok) rows = p.rows
  else if (p.raw === null) return 'blocked'
  else {
    // Unreadable list: set aside first (or already exported by the learner, exactly this content), else never overwritten.
    const k = opts.unreadableExported === p.raw ? 'kept' : quarantine(storage, PROJECTS_KEY, p.raw, 'corrupt')
    if (k !== 'kept') return k === 'blocked' ? 'blocked' : 'quarantine-full'
    rows = []
    listReset = true
  }
  const at = rows.findIndex((r) => r.name === n)
  if (at < 0 && rows.length >= PROJECTS_MAX) return 'full'
  let conflict = false
  if (at >= 0 && opts.expectStamp !== undefined && stampOf(rows[at]) !== opts.expectStamp) {
    const k = quarantine(storage, PROJECTS_KEY, JSON.stringify(rows[at]), 'conflict')
    if (k !== 'kept') return k === 'blocked' ? 'blocked' : 'quarantine-full'
    conflict = true
  }
  const row: ProjectRow = { name: n, savedAt: new Date().toISOString(), stamp: opts.stamp ?? newStamp(), design }
  const next = at < 0 ? [...rows, row] : rows.map((r, i) => (i === at ? row : r))
  const w = write(storage, PROJECTS_KEY, JSON.stringify({ version: 1, projects: next }))
  if (w !== 'ok') return w
  return listReset ? 'list-reset' : conflict ? 'conflict-kept' : 'ok'
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
export interface Autosave {
  schedule(): void
  flush(): void
  cancel(): void
  /** Another tab writes: this one stops writing (its pending change stays pending) until `resume`. */
  pause(): void
  resume(): void
  readonly paused: boolean
}

export function createAutosave(d: AutosaveDeps): Autosave {
  const ms = d.ms ?? 1000
  let paused = false
  let pending = false
  const tick = debounce(() => {
    if (paused) return // kept pending: written on resume
    if (d.busy()) return tick() // try again after the commit
    pending = false
    const snap = d.snapshot()
    if (!snap) return
    const r = saveAutosave(d.storage, snap)
    d.onResult?.(r)
  }, ms)
  return {
    schedule: () => {
      pending = true
      tick()
    },
    // beforeunload: save now, unless a transaction is open (the last committed autosave stays) or paused.
    flush: () => {
      if (!d.busy() && !paused) tick.flush()
    },
    cancel: () => {
      pending = false
      tick.cancel()
    },
    pause: () => {
      paused = true
    },
    resume: () => {
      paused = false
      if (pending) tick()
    },
    get paused() {
      return paused
    },
  }
}
