/**
 * Essais (ADR-0012 Décision 10): the declarative `.essai.json` file. Pure: no
 * DOM (the UI turns the string into a download), no storage writes.
 *
 * - exportTrails(trials) → { formatVersion: 1, exportedAt, app: 'tekpractice',
 *   declaratif: true, trials }. "Déclaratif": the file is what the learner
 *   entered and froze; it is NOT signed and can be forged (a trace, not proof).
 * - importTrails(json): envelope checked strictly, then EACH trial gets the
 *   strict store schema + its fp1 fingerprint re-derived; failures are counted
 *   in `rejected`, never thrown. The round trip is exact.
 * - exportQuarantine(storage): what the store set aside (quarantine items +
 *   the raw main key, which is the only full copy when the quarantine copy was
 *   truncated), as the same kind of envelope with `kind: 'quarantine'`, so a
 *   learner can save it while the store is read-only; the saved-rig quarantine
 *   (`audio-sim/rigs.v2.quarantine`) rides along as `rigItems`. Read-only: no
 *   "acknowledge / clear" step here (open decision, ADR-0012 Décision 6).
 */
import { z } from 'zod'
import { canonicalize, FP_PREFIX, sha256hex, type Hasher } from './fingerprint'
import { QUARANTINE_KEY, quarantineSchema, TRIALS_KEY, trialSchema, type QuarantineItem, type TrialStorage } from './store'
import { cloneData, deepFreeze, type Trial } from './trial'
// Pure module (zod + types only): the saved-rig quarantine is exported alongside.
import { RIGS_QUARANTINE_KEY } from '../ui/rigStore'

export const EXPORT_FORMAT_VERSION = 1
export const EXPORT_APP = 'tekpractice'

export type ImportFailure = 'corrupt' | 'format' | 'version' | 'crypto-unavailable'
export type ImportResult = { ok: true; trials: Trial[]; rejected: number } | { ok: false; reason: ImportFailure }
export type QuarantineExport = { ok: true; json: string; items: number } | { ok: false; reason: 'empty' | 'storage' }

const toIso = (d: Date | string): string => (typeof d === 'string' ? new Date(d) : d).toISOString()

export function exportTrails(trials: readonly Trial[], exportedAt: Date | string = new Date()): string {
  return JSON.stringify({
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: toIso(exportedAt),
    app: EXPORT_APP,
    declaratif: true,
    trials,
  })
}

const envelopeSchema = z
  .object({
    formatVersion: z.literal(EXPORT_FORMAT_VERSION),
    exportedAt: z.string().datetime({ offset: true }),
    app: z.literal(EXPORT_APP),
    declaratif: z.literal(true),
    trials: z.array(z.unknown()),
  })
  .strict()

export async function importTrails(json: string, hash: Hasher = sha256hex): Promise<ImportResult> {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'corrupt' }
  }
  const fv = (data as { formatVersion?: unknown } | null)?.formatVersion
  if (typeof fv === 'number' && fv > EXPORT_FORMAT_VERSION) return { ok: false, reason: 'version' }
  const env = envelopeSchema.safeParse(data)
  if (!env.success) return { ok: false, reason: 'format' }
  try {
    await hash('')
  } catch {
    return { ok: false, reason: 'crypto-unavailable' }
  }

  const trials: Trial[] = []
  const seen = new Set<string>()
  let rejected = 0
  for (const raw of env.data.trials) {
    const t = trialSchema.safeParse(raw)
    if (!t.success || seen.has(t.data.id)) {
      rejected++
      continue
    }
    let fp: string
    try {
      fp = FP_PREFIX + (await hash(canonicalize(t.data.design)))
    } catch {
      rejected++
      continue
    }
    if (fp !== t.data.fingerprint) {
      rejected++
      continue
    }
    seen.add(t.data.id)
    // The strict schema allows no extra keys, so the file's own object IS the
    // trial; keeping it (not zod's rebuilt copy) keeps the key order: exact round trip.
    trials.push(deepFreeze(cloneData(raw)) as Trial)
  }
  return { ok: true, trials, rejected }
}

export function exportQuarantine(storage: TrialStorage, exportedAt: Date | string = new Date()): QuarantineExport {
  const at = toIso(exportedAt)
  let qRaw: string | null
  let trialsRaw: string | null
  let rigRaw: string | null
  try {
    qRaw = storage.getItem(QUARANTINE_KEY)
    trialsRaw = storage.getItem(TRIALS_KEY)
    rigRaw = storage.getItem(RIGS_QUARANTINE_KEY)
  } catch {
    return { ok: false, reason: 'storage' }
  }
  const items = readItems(qRaw, at)
  const rigItems = readItems(rigRaw, at)
  if (items.length === 0 && rigItems.length === 0 && trialsRaw === null) return { ok: false, reason: 'empty' }
  const json = JSON.stringify({
    formatVersion: EXPORT_FORMAT_VERSION,
    kind: 'quarantine',
    exportedAt: at,
    app: EXPORT_APP,
    declaratif: true,
    items,
    trialsRaw,
    rigItems,
  })
  return { ok: true, json, items: items.length + rigItems.length }
}

/** Both quarantines share the { version: 1, items: { at, raw, reason, truncated? }[] } shape. */
function readItems(raw: string | null, at: string): QuarantineItem[] {
  if (raw === null) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = undefined
  }
  const q = quarantineSchema.safeParse(parsed)
  // An unreadable quarantine is exported whole, as one item: never dropped.
  return q.success ? q.data.items : [{ at, raw, reason: 'quarantine-unreadable' }]
}
