/**
 * Essais store (ADR-0012, Décisions 4, 6, 7). Pure: storage is injected and
 * has NO removeItem, on purpose. Nothing stored is ever silently deleted.
 *
 * - `audio-sim/trials` = { version: 1, trials: Trial[] }, append-only.
 * - Load: strict zod parse + every fingerprint re-verified. Any failure copies
 *   the raw string into `audio-sim/trials.quarantine`
 *   ({ version: 1, items: { at, raw, reason, truncated? }[] }, append-only,
 *   raw capped at 200k chars, at most 5 items: evicting the oldest is the only
 *   bounded removal, warned 'quarantine-evicted') and the list starts empty.
 *   This replaces, for Essais, CLAUDE.md's "version mismatch → reset".
 * - One serial queue for every operation (load included).
 * - Two tabs: every write re-reads the key first; a list written by another
 *   tab is verified and merged by id (union, never drop an id; a clash keeps
 *   both, the stored copy quarantined as 'merge-conflict:<id>'). reload()
 *   re-reads on a `storage` event.
 * - Writes never throw: QuotaExceededError → { ok:false, reason:'quota' };
 *   growth past the GLOBAL budget (trials + quarantine, UTF-16 code units)
 *   → { ok:false, reason:'budget' }; ≥ 80 % → 'near-budget'.
 * - No crypto.subtle → read-only + 'crypto-unavailable', no quarantine.
 * - Write-once: only `name` and `evidence.noteAmendments` change after a
 *   freeze; `remove` is an explicit learner action (confirmed in the UI).
 */
import { z } from 'zod'
import { canonicalize, FP_PREFIX, sha256hex, type Hasher } from './fingerprint'
import { cloneData, deepFreeze, type Trial } from './trial'

export const TRIALS_KEY = 'audio-sim/trials'
export const QUARANTINE_KEY = 'audio-sim/trials.quarantine'
export const TRIALS_VERSION = 1
/** Bytes, measured as the stored JSON string length. */
export const TRIALS_BUDGET = 1_500_000
export const NEAR_BUDGET_RATIO = 0.8
export const QUARANTINE_CAP = 5
/** Each quarantined raw payload is truncated to this many chars (flag `truncated: true`): ≤ ~1 MB of quarantine in total. */
export const QUARANTINE_RAW_CAP = 200_000

/** Deliberately no removeItem: the store can quarantine, never erase. */
export type TrialStorage = Pick<Storage, 'getItem' | 'setItem'>

export type StoreWarning =
  | 'near-budget'
  | 'quarantine-failed'
  | 'quarantine-evicted'
  /** The corrupt payload was longer than QUARANTINE_RAW_CAP: read-only, main key kept intact. */
  | 'quarantine-truncated'
  | 'storage-unavailable'
  | 'crypto-unavailable'
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
  truncated?: true
}

// ---- strict schema (mirrors trial.ts types) ----
const finite = z.number().refine(Number.isFinite)
const iso = z.string().datetime({ offset: true })
const vec3 = z.tuple([finite, finite, finite])
const portRef = z.object({ instance: z.string(), port: z.string() }).strict()
/** Compact rule outcome: no title/teach text (rulesRev pins the catalog). */
const ruleResult = z.object({ ruleId: z.string(), severity: z.enum(['error', 'warning']), subjects: z.array(portRef) }).strict()
const levelState = z
  .object({
    chainComplete: z.boolean(),
    connectedRequired: finite,
    totalRequired: finite,
    missing: z.array(z.object({ from: portRef, to: portRef }).strict()),
    violations: z.array(ruleResult),
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
/** Strict Trial schema, shared with export.ts (import). */
export const trialSchema = z
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
        ruleResults: z.array(ruleResult),
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
/** Shared with export.ts (exportQuarantine). */
export const quarantineSchema = z
  .object({
    version: z.literal(1),
    items: z.array(z.object({ at: iso, raw: z.string(), reason: z.string(), truncated: z.literal(true).optional() }).strict()),
  })
  .strict()

const isQuota = (err: unknown): boolean => {
  const e = err as { name?: string; code?: number } | null
  return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)
}

const toIso = (d: Date | string): string => (typeof d === 'string' ? new Date(d) : d).toISOString()

/** Key-order-independent JSON (a parsed copy and an in-memory copy compare equal). */
const stable = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(stable).join(',')}]`
    : v !== null && typeof v === 'object'
      ? `{${Object.keys(v as object)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
          .join(',')}}`
      : JSON.stringify(v)
const sameTrial = (a: Trial, b: Trial): boolean => stable(a) === stable(b)

export interface TrialStoreOptions {
  budget?: number
  now?: () => Date | string
  hash?: Hasher
}

export class TrialStore {
  readonly budget: number
  private trials: readonly Trial[] = deepFreeze([])
  private bytes = 0
  private qBytes = 0
  private loaded = false
  private readOnly = false
  private queue: Promise<unknown> = Promise.resolve()
  private quarantineItems: readonly QuarantineItem[] = deepFreeze([])
  private readonly now: () => Date | string
  private readonly hash: Hasher
  /** The stored string this store last read or wrote: anything else was written by another tab. */
  private lastRaw: string | null = null

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
    return this.serial(() => this.doLoad())
  }

  /** Re-read the stored list (another tab wrote it: `storage` event). Same queue, same checks as load(). */
  reload(): Promise<LoadResult> {
    return this.load()
  }

  private async doLoad(): Promise<LoadResult> {
    this.loaded = true
    this.readOnly = false
    this.trials = deepFreeze([])
    this.bytes = 0
    let raw: string | null
    this.qBytes = 0
    try {
      raw = this.storage.getItem(TRIALS_KEY)
      this.lastRaw = raw
      const q = this.readQuarantine()
      this.quarantineItems = deepFreeze(q.items)
      this.qBytes = q.bytes
    } catch {
      this.readOnly = true
      return { trials: this.trials, quarantined: false, warnings: ['storage-unavailable'] }
    }
    // Without a hasher nothing can be verified: read-only, and NOT quarantined
    // (the data is probably fine; the browser is the problem).
    try {
      await this.hash('')
    } catch {
      this.readOnly = true
      return { trials: this.trials, quarantined: false, warnings: ['crypto-unavailable'] }
    }
    if (raw === null) return { trials: this.trials, quarantined: false, warnings: [] }

    const problem = await this.check(raw)
    if (problem.ok === 'crypto') {
      this.readOnly = true
      return { trials: this.trials, quarantined: false, warnings: ['crypto-unavailable'] }
    }
    if (problem.ok) {
      this.trials = deepFreeze(problem.trials)
      this.bytes = raw.length
      return { trials: this.trials, quarantined: false, warnings: this.budgetWarnings(this.bytesUsed()) }
    }
    const { saved, evicted } = this.toQuarantine(raw, problem.reason)
    if (!saved) {
      this.readOnly = true // never let a later write clobber the only copy
      return { trials: this.trials, quarantined: true, warnings: ['quarantine-failed'] }
    }
    const warnings: StoreWarning[] = evicted ? ['quarantine-evicted'] : []
    if (raw.length > QUARANTINE_RAW_CAP) {
      // The quarantine copy is incomplete: the main key is now the only full
      // copy, so nothing may overwrite it until the learner exports it.
      this.readOnly = true
      warnings.push('quarantine-truncated')
    }
    return { trials: this.trials, quarantined: true, warnings: [...warnings, ...this.budgetWarnings(this.bytesUsed())] }
  }

  /** Current trials (frozen). */
  list(): readonly Trial[] {
    return this.trials
  }

  /** Quarantined payloads, read-only, for export. */
  quarantine(): readonly QuarantineItem[] {
    return this.quarantineItems
  }

  /** Global usage, in UTF-16 code units (string.length): trials file + quarantine file. */
  bytesUsed(): number {
    return this.bytes + this.qBytes
  }

  append(trial: Trial): Promise<WriteResult> {
    return this.serial(() => this.doAppend(trial))
  }

  private async doAppend(trial: Trial): Promise<WriteResult> {
    await this.ensureLoaded()
    if (this.readOnly) return { ok: false, reason: 'read-only' }
    if (this.trials.some((t) => t.id === trial.id)) return { ok: false, reason: 'duplicate-id' }
    const parsed = trialSchema.safeParse(trial)
    if (!parsed.success) return { ok: false, reason: 'invalid' }
    const v = await this.verify(parsed.data.design, parsed.data.fingerprint)
    if (v === 'crypto') {
      this.readOnly = true
      return { ok: false, reason: 'read-only' }
    }
    if (v !== 'ok') return { ok: false, reason: 'invalid' }
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
    const d = typeof now === 'string' ? new Date(now) : now
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return Promise.resolve({ ok: false, reason: 'invalid' })
    const at = d.toISOString()
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
   * Never await another queued operation from here: anything queued *after*
   * this one would wait on it, and it on them (deadlock).
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

  /**
   * Another tab may have written since this store last read or wrote the key
   * (final review #2). Re-read it; when it changed, merge by id so nothing is
   * ever dropped: the other tab's new trials are kept, its edits to trials
   * this tab left untouched win, this tab's deliberate removals stay removed
   * (unless the other tab changed that trial meanwhile: that copy is
   * quarantined), and a true clash (both tabs changed one id) keeps this tab's
   * copy in the list and quarantines the stored one. A corrupt stored payload
   * is quarantined like on load. Any quarantine failure refuses the write.
   */
  private async mergeWithStored(
    next: readonly Trial[],
  ): Promise<{ ok: true; trials: readonly Trial[]; raw: string | null } | { ok: false; reason: WriteFailure }> {
    let raw: string | null
    try {
      raw = this.storage.getItem(TRIALS_KEY)
    } catch {
      return { ok: false, reason: 'storage' }
    }
    if (raw === this.lastRaw) return { ok: true, trials: next, raw }
    let theirs: readonly Trial[] = []
    if (raw !== null) {
      const c = await this.check(raw)
      if (c.ok === 'crypto') {
        this.readOnly = true
        return { ok: false, reason: 'read-only' }
      }
      if (c.ok) theirs = c.trials
      else {
        const { saved } = this.toQuarantine(raw, c.reason)
        // A truncated copy is incomplete: the stored key stays the only full copy.
        if (!saved || raw.length > QUARANTINE_RAW_CAP) {
          this.readOnly = true
          return { ok: false, reason: 'read-only' }
        }
      }
    }
    const base = new Map(this.trials.map((t) => [t.id, t]))
    const mine = new Map(next.map((t) => [t.id, t]))
    const out: Trial[] = []
    const aside: Trial[] = []
    for (const t of theirs) {
      const m = mine.get(t.id)
      const b = base.get(t.id)
      if (m) {
        mine.delete(t.id)
        if (sameTrial(m, t)) out.push(m)
        else if (b && sameTrial(m, b)) out.push(t) // untouched here: the other tab's edit wins
        else {
          out.push(m)
          if (!b || !sameTrial(t, b)) aside.push(t) // both changed it: keep both
        }
      } else if (!b) out.push(t) // new in the other tab
      else if (!sameTrial(t, b)) aside.push(t) // removed here, changed there meanwhile
    }
    for (const m of mine.values()) out.push(m) // new here (or removed by the other tab: never dropped)
    for (const t of aside) {
      if (!this.toQuarantine(JSON.stringify(t), `merge-conflict:${t.id}`).saved) return { ok: false, reason: 'storage' }
    }
    return { ok: true, trials: out, raw }
  }

  private async commit(proposed: readonly Trial[]): Promise<WriteResult> {
    // The merge awaits (fingerprint checks): the other tab may write again
    // meanwhile. Re-check synchronously right before setItem; merge again if so.
    let merged = await this.mergeWithStored(proposed)
    for (let attempt = 0; ; attempt++) {
      if (!merged.ok) return merged
      let now: string | null
      try {
        now = this.storage.getItem(TRIALS_KEY)
      } catch {
        return { ok: false, reason: 'storage' }
      }
      if (now === merged.raw) break
      if (attempt >= 3) return { ok: false, reason: 'storage' } // never write blind over a moving key
      merged = await this.mergeWithStored(proposed)
    }
    const next = merged.trials
    const json = JSON.stringify({ version: TRIALS_VERSION, trials: next })
    // Only growth is refused: removing is always possible, even over the cap.
    if (json.length + this.qBytes > this.budget && json.length > this.bytes) return { ok: false, reason: 'budget' }
    try {
      this.storage.setItem(TRIALS_KEY, json)
    } catch (err) {
      return { ok: false, reason: isQuota(err) ? 'quota' : 'storage' }
    }
    this.trials = deepFreeze(next.map((t) => (Object.isFrozen(t) ? t : deepFreeze(cloneData(t) as Trial))))
    this.bytes = json.length
    this.lastRaw = json
    return { ok: true, warnings: this.budgetWarnings(this.bytesUsed()) }
  }

  private budgetWarnings(bytes: number): StoreWarning[] {
    return bytes >= this.budget * NEAR_BUDGET_RATIO ? ['near-budget'] : []
  }

  private async check(raw: string): Promise<{ ok: true; trials: Trial[] } | { ok: false; reason: string } | { ok: 'crypto' }> {
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
      const v = await this.verify(t.design, t.fingerprint)
      if (v === 'crypto') return { ok: 'crypto' }
      if (v === 'canon') return { ok: false, reason: `canonicalize:${t.id}` }
      if (v === 'mismatch') return { ok: false, reason: `fingerprint:${t.id}` }
    }
    return { ok: true, trials: file.data.trials as Trial[] }
  }

  /** Re-derives fp1 without ever throwing: a bad number is 'canon', a hasher failure is 'crypto'. */
  private async verify(design: unknown, expected: string): Promise<'ok' | 'mismatch' | 'canon' | 'crypto'> {
    let canon: string
    try {
      canon = canonicalize(design)
    } catch {
      return 'canon'
    }
    let fp: string
    try {
      fp = FP_PREFIX + (await this.hash(canon))
    } catch {
      return 'crypto'
    }
    return fp === expected ? 'ok' : 'mismatch'
  }

  /** One quarantine item; `raw` capped at QUARANTINE_RAW_CAP chars so the quarantine stays bounded. */
  private item(raw: string, reason: string): QuarantineItem {
    const at = toIso(this.now())
    return raw.length > QUARANTINE_RAW_CAP ? { at, raw: raw.slice(0, QUARANTINE_RAW_CAP), reason, truncated: true } : { at, raw, reason }
  }

  private readQuarantine(): { items: QuarantineItem[]; bytes: number } {
    const raw = this.storage.getItem(QUARANTINE_KEY)
    if (raw === null) return { items: [], bytes: 0 }
    try {
      const q = quarantineSchema.safeParse(JSON.parse(raw))
      if (q.success) return { items: q.data.items, bytes: raw.length }
    } catch {
      /* fall through */
    }
    // An unreadable quarantine is itself kept, as an item, never overwritten away.
    return { items: [this.item(raw, 'quarantine-unreadable')], bytes: raw.length }
  }

  /** Appends raw to the quarantine (deduplicated, capped). */
  private toQuarantine(raw: string, reason: string): { saved: boolean; evicted: boolean } {
    let items: QuarantineItem[]
    try {
      items = this.readQuarantine().items
    } catch {
      return { saved: false, evicted: false }
    }
    const fresh = this.item(raw, reason)
    if (!items.some((i) => i.raw === fresh.raw)) items.push(fresh)
    const evicted = items.length > QUARANTINE_CAP
    items = items.slice(-QUARANTINE_CAP)
    const json = JSON.stringify({ version: 1, items })
    try {
      this.storage.setItem(QUARANTINE_KEY, json)
    } catch {
      return { saved: false, evicted: false }
    }
    this.quarantineItems = deepFreeze(items)
    this.qBytes = json.length
    return { saved: true, evicted }
  }
}
