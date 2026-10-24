/**
 * Essais store (ADR-0012, Décisions 4, 6, 7). Pure: storage is injected and
 * has NO removeItem, on purpose. Nothing stored is ever silently deleted.
 *
 * - `audio-sim/trials` = { version: 1, trials: Trial[] }, append-only.
 * - Load: strict zod parse + every fingerprint re-verified. Any failure copies
 *   the raw string into `audio-sim/trials.quarantine`
 *   ({ version: 1, items: { at, raw, reason }[] }, append-only, capped at 5:
 *   the oldest item is the only bounded removal) and the list starts empty.
 *   This replaces, for Essais, CLAUDE.md's "version mismatch → reset".
 * - Writes never throw: QuotaExceededError → { ok:false, reason:'quota' };
 *   growth past the byte budget → { ok:false, reason:'budget' }; ≥ 80 % → 'near-budget'.
 * - Write-once: only `name` and `evidence.noteAmendments` change after a
 *   freeze; `remove` is an explicit learner action (confirmed in the UI).
 */
import { z } from 'zod'
import { fingerprint, sha256hex, type Hasher } from './fingerprint'
import { cloneData, deepFreeze, type Trial } from './trial'

export const TRIALS_KEY = 'audio-sim/trials'
export const QUARANTINE_KEY = 'audio-sim/trials.quarantine'
export const TRIALS_VERSION = 1
/** Bytes, measured as the stored JSON string length. */
export const TRIALS_BUDGET = 1_500_000
export const NEAR_BUDGET_RATIO = 0.8
export const QUARANTINE_CAP = 5

/** Deliberately no removeItem: the store can quarantine, never erase. */
export type TrialStorage = Pick<Storage, 'getItem' | 'setItem'>

export type StoreWarning = 'near-budget' | 'quarantine-failed' | 'storage-unavailable'
export type WriteFailure = 'quota' | 'storage' | 'budget' | 'not-found' | 'duplicate-id' | 'invalid' | 'empty' | 'read-only'
export type WriteResult = { ok: true; warnings: StoreWarning[] } | { ok: false; reason: WriteFailure }
export interface LoadResult {
  trials: readonly Trial[]
  quarantined: boolean
  warnings: StoreWarning[]
}
export interface QuarantineItem {
  at: string
  raw: string
  reason: string
}

// ---- strict schema (mirrors trial.ts types) ----
const finite = z.number().refine(Number.isFinite)
const iso = z.string().datetime({ offset: true })
const vec3 = z.tuple([finite, finite, finite])
const portRef = z.object({ instance: z.string(), port: z.string() }).strict()
const teachingEvent = z
  .object({ ruleId: z.string(), severity: z.enum(['error', 'warning']), title: z.string(), teach: z.string(), subjects: z.array(portRef) })
  .strict()
const levelState = z
  .object({
    chainComplete: z.boolean(),
    connectedRequired: finite,
    totalRequired: finite,
    missing: z.array(z.object({ from: portRef, to: portRef }).strict()),
    violations: z.array(teachingEvent),
    won: z.boolean(),
  })
  .strict()
const design = z
  .object({
    roomId: z.string().nullable(),
    rig: z
      .object({
        instances: z.array(z.object({ instanceId: z.string(), deviceId: z.string() }).strict()),
        connections: z.array(z.object({ a: portRef, b: portRef }).strict()),
        controls: z.record(z.string(), z.record(z.string(), z.union([z.boolean(), z.string()]))),
      })
      .strict(),
    placements: z.array(z.object({ instanceId: z.string(), deviceId: z.string(), position_m: vec3, yawDeg: finite }).strict()),
  })
  .strict()
const trialSchema = z
  .object({
    formatVersion: z.literal(1),
    id: z.string().min(1),
    name: z.string(),
    frozenAt: iso,
    parentId: z.string().nullable(),
    fingerprint: z.string().startsWith('fp1:'),
    design,
    consumed: z.object({ room: z.object({ roomId: z.string().nullable(), geometryRev: z.string().nullable() }).strict() }).strict(),
    evidence: z
      .object({
        prediction: z.object({ text: z.string().refine((t) => t.trim() !== ''), writtenAt: iso }).strict(),
        ruleResults: z.array(teachingEvent),
        levelState: levelState.nullable(),
        rulesRev: z.string(),
        note: z.string(),
        noteAmendments: z.array(z.object({ text: z.string(), at: iso }).strict()),
        changedSinceParent: z.array(z.string()),
      })
      .strict(),
    view: z
      .object({
        pose: z.object({ alpha: finite, beta: finite, radius: finite.refine((r) => r > 0), target: vec3 }).strict(),
        pivot: vec3,
      })
      .strict(),
    levelId: z.string().optional(),
  })
  .strict()
  .refine((t) => Date.parse(t.evidence.prediction.writtenAt) <= Date.parse(t.frozenAt), 'prediction written after freeze')
const fileSchema = z.object({ version: z.literal(TRIALS_VERSION), trials: z.array(trialSchema) }).strict()
const quarantineSchema = z
  .object({ version: z.literal(1), items: z.array(z.object({ at: z.string(), raw: z.string(), reason: z.string() }).strict()) })
  .strict()

const isQuota = (err: unknown): boolean => {
  const e = err as { name?: string; code?: number } | null
  return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)
}

const toIso = (d: Date | string): string => (typeof d === 'string' ? new Date(d) : d).toISOString()

export interface TrialStoreOptions {
  budget?: number
  now?: () => Date | string
  hash?: Hasher
}

export class TrialStore {
  readonly budget: number
  private trials: readonly Trial[] = deepFreeze([])
  private bytes = 0
  private loaded = false
  private readOnly = false
  private queue: Promise<unknown> = Promise.resolve()
  /** The latest load (public load() calls); writes queued after it wait for it. */
  loading: Promise<LoadResult> | null = null
  private quarantineItems: readonly QuarantineItem[] = deepFreeze([])
  private readonly now: () => Date | string
  private readonly hash: Hasher

  constructor(
    private readonly storage: TrialStorage,
    opts: TrialStoreOptions = {},
  ) {
    this.budget = opts.budget ?? TRIALS_BUDGET
    this.now = opts.now ?? (() => new Date())
    this.hash = opts.hash ?? sha256hex
  }

  /**
   * Every public operation runs on ONE serial queue: a write can never land
   * between load()'s reset and its re-verification (which would commit a
   * partial list over the stored file), and concurrent appends see each other.
   */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn)
    this.queue = run.catch(() => undefined)
    return run
  }

  load(): Promise<LoadResult> {
    const p = this.serial(() => this.doLoad())
    this.loading = p
    return p
  }

  private async doLoad(): Promise<LoadResult> {
    this.loaded = true
    this.readOnly = false
    this.trials = deepFreeze([])
    this.bytes = 0
    let raw: string | null
    try {
      raw = this.storage.getItem(TRIALS_KEY)
      this.quarantineItems = deepFreeze(this.readQuarantine().items)
    } catch {
      this.readOnly = true
      return { trials: this.trials, quarantined: false, warnings: ['storage-unavailable'] }
    }
    if (raw === null) return { trials: this.trials, quarantined: false, warnings: [] }

    const problem = await this.check(raw)
    if (problem.ok) {
      this.trials = deepFreeze(problem.trials)
      this.bytes = raw.length
      return { trials: this.trials, quarantined: false, warnings: this.budgetWarnings(this.bytes) }
    }
    const saved = this.toQuarantine(raw, problem.reason)
    if (!saved) this.readOnly = true // never let a later write clobber the only copy
    return { trials: this.trials, quarantined: true, warnings: saved ? [] : ['quarantine-failed'] }
  }

  /** Current trials (frozen). */
  list(): readonly Trial[] {
    return this.trials
  }

  /** Quarantined payloads, read-only, for export. */
  quarantine(): readonly QuarantineItem[] {
    return this.quarantineItems
  }

  bytesUsed(): number {
    return this.bytes
  }

  append(trial: Trial): Promise<WriteResult> {
    return this.serial(() => this.doAppend(trial))
  }

  private async doAppend(trial: Trial): Promise<WriteResult> {
    await this.ensureLoaded()
    if (this.readOnly) return { ok: false, reason: 'read-only' }
    if (this.trials.some((t) => t.id === trial.id)) return { ok: false, reason: 'duplicate-id' }
    const parsed = trialSchema.safeParse(trial)
    if (!parsed.success || (await fingerprint(parsed.data.design, this.hash)) !== parsed.data.fingerprint) {
      return { ok: false, reason: 'invalid' }
    }
    return this.commit([...this.trials, deepFreeze(cloneData(parsed.data) as Trial)])
  }

  rename(id: string, name: string): Promise<WriteResult> {
    const clean = name.trim()
    if (!clean) return Promise.resolve({ ok: false, reason: 'empty' })
    return this.serial(() => this.replace(id, (t) => ({ ...t, name: clean })))
  }

  /** Append-only amendment; the note itself is never rewritten (locked from creation). */
  amendNote(id: string, text: string, now: Date | string): Promise<WriteResult> {
    if (!text.trim()) return Promise.resolve({ ok: false, reason: 'empty' })
    const at = toIso(now)
    return this.serial(() =>
      this.replace(id, (t) => ({
        ...t,
        evidence: { ...t.evidence, noteAmendments: [...t.evidence.noteAmendments, { text, at }] },
      })),
    )
  }

  /** Explicit learner action (the UI confirms first). */
  remove(id: string): Promise<WriteResult> {
    return this.serial(async () => {
      await this.ensureLoaded()
      if (this.readOnly) return { ok: false, reason: 'read-only' }
      if (!this.trials.some((t) => t.id === id)) return { ok: false, reason: 'not-found' }
      return this.commit(this.trials.filter((t) => t.id !== id))
    })
  }

  // ---- internals (always called from inside the serial queue) ----

  /**
   * A queued load() has already finished by the time this runs (queue order).
   * Deliberately NOT `await this.loading` here: a load queued *after* this
   * write would wait on the write, which would wait on it (deadlock).
   */
  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) await this.doLoad()
  }

  private async replace(id: string, edit: (t: Trial) => Trial): Promise<WriteResult> {
    await this.ensureLoaded()
    if (this.readOnly) return { ok: false, reason: 'read-only' }
    const i = this.trials.findIndex((t) => t.id === id)
    if (i < 0) return { ok: false, reason: 'not-found' }
    const next = [...this.trials]
    next[i] = deepFreeze(cloneData(edit(this.trials[i])))
    return this.commit(next)
  }

  private commit(next: readonly Trial[]): WriteResult {
    const json = JSON.stringify({ version: TRIALS_VERSION, trials: next })
    if (json.length > this.budget && json.length > this.bytes) return { ok: false, reason: 'budget' }
    try {
      this.storage.setItem(TRIALS_KEY, json)
    } catch (err) {
      return { ok: false, reason: isQuota(err) ? 'quota' : 'storage' }
    }
    this.trials = deepFreeze([...next])
    this.bytes = json.length
    return { ok: true, warnings: this.budgetWarnings(json.length) }
  }

  private budgetWarnings(bytes: number): StoreWarning[] {
    return bytes >= this.budget * NEAR_BUDGET_RATIO ? ['near-budget'] : []
  }

  private async check(raw: string): Promise<{ ok: true; trials: Trial[] } | { ok: false; reason: string }> {
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      return { ok: false, reason: 'json' }
    }
    const file = fileSchema.safeParse(json)
    if (!file.success) {
      const issue = file.error.issues[0]
      return { ok: false, reason: `schema:${issue ? issue.path.join('.') || issue.message : '?'}` }
    }
    const seen = new Set<string>()
    for (const t of file.data.trials) {
      if (seen.has(t.id)) return { ok: false, reason: `duplicate-id:${t.id}` }
      seen.add(t.id)
      if ((await fingerprint(t.design, this.hash)) !== t.fingerprint) return { ok: false, reason: `fingerprint:${t.id}` }
    }
    return { ok: true, trials: file.data.trials as Trial[] }
  }

  private readQuarantine(): { items: QuarantineItem[] } {
    const raw = this.storage.getItem(QUARANTINE_KEY)
    if (raw === null) return { items: [] }
    try {
      const q = quarantineSchema.safeParse(JSON.parse(raw))
      if (q.success) return { items: q.data.items }
    } catch {
      /* fall through */
    }
    // An unreadable quarantine is itself kept, as an item, never overwritten away.
    return { items: [{ at: toIso(this.now()), raw, reason: 'quarantine-unreadable' }] }
  }

  /** Appends raw to the quarantine (deduplicated, capped). Returns false if it could not be saved. */
  private toQuarantine(raw: string, reason: string): boolean {
    let items: QuarantineItem[]
    try {
      items = this.readQuarantine().items
    } catch {
      return false
    }
    if (!items.some((i) => i.raw === raw)) items.push({ at: toIso(this.now()), raw, reason })
    items = items.slice(-QUARANTINE_CAP)
    try {
      this.storage.setItem(QUARANTINE_KEY, JSON.stringify({ version: 1, items }))
    } catch {
      return false
    }
    this.quarantineItems = deepFreeze(items)
    return true
  }
}
