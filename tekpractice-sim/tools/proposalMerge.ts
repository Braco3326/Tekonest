/**
 * proposalMerge: the pure guard `tools/propose-content.ts` (npm run sync:kb) applies to the proposals file (Task 0.2).
 *
 * The proposals file is regenerated wholesale from the knowledge base, so without a guard a sync would
 *  - bring back a device that was promoted into content/catalog.json (resurrection: one id in two places),
 *  - overwrite the hand-edited entry of a beta-modelled device (its ports, its size),
 *  - or make a proposal of a plan row that is a NEW device (status `new`: not a KB proposal).
 * The merge decides what survives; it never reads or writes a file (propose-content.ts does, and is a script: importing it would run it).
 */
import type { PlanRow } from './equipmentPlan'

export type Proposal = { id: string } & Record<string, unknown>

export interface MergeResult {
  devices: Proposal[]
  /** What was left out of the output and why (for the sync's log line). */
  dropped: { id: string; reason: string }[]
}

/** The axes the plan knows, as a proposal's `sizeMm` (the placeholder box reads it); undefined when the plan has none. */
function planSize(row: PlanRow | undefined): Record<string, number> | undefined {
  if (!row) return undefined
  const out: Record<string, number> = {}
  for (const k of ['w', 'd', 'h'] as const) if ((row.sizeMm[k] ?? 0) > 0) out[k] = row.sizeMm[k] as number
  return Object.keys(out).length ? out : undefined
}

/**
 * @param generated  the entries the knowledge base produces this run (already validated)
 * @param existing   the entries of the committed proposals file (raw: they may carry hand-edited fields)
 * @param plan       the equipment plan rows
 * @param catalogIds ids of content/catalog.json
 */
export function mergeProposals(
  generated: readonly Proposal[],
  existing: readonly Proposal[],
  plan: readonly PlanRow[],
  catalogIds: ReadonlySet<string>,
): MergeResult {
  const rowById = new Map(plan.map((r) => [r.id, r]))
  const existingById = new Map(existing.map((d) => [d.id, d]))
  const dropped: { id: string; reason: string }[] = []

  /** Why an id may not be a proposal at all, or undefined. */
  const barred = (id: string): string | undefined => {
    if (catalogIds.has(id)) return 'already in the catalogue (content/catalog.json is the source of truth)'
    const row = rowById.get(id)
    if (row?.promoted === true) return 'promoted: the plan row is flagged promoted'
    if (row?.status === 'new') return 'plan row is a new device, not a knowledge-base proposal'
    return undefined
  }

  const out: Proposal[] = []
  const seen = new Set<string>()
  for (const g of generated) {
    if (seen.has(g.id)) continue
    seen.add(g.id)
    const why = barred(g.id)
    if (why) {
      dropped.push({ id: g.id, reason: why })
      continue
    }
    const row = rowById.get(g.id)
    const kept = row?.betaModelled === true ? existingById.get(g.id) : undefined
    if (kept) {
      out.push(kept) // a beta-modelled proposal is hand-built: the regenerated entry never replaces it
      continue
    }
    const size = planSize(row)
    out.push(size ? { ...g, sizeMm: size } : { ...g })
  }
  // A beta-modelled entry stays even when the knowledge base stopped producing it; any other stale entry goes (wholesale regeneration).
  for (const e of existing) {
    if (seen.has(e.id) || rowById.get(e.id)?.betaModelled !== true) continue
    seen.add(e.id)
    const why = barred(e.id)
    if (why) dropped.push({ id: e.id, reason: why })
    else out.push(e)
  }
  return { devices: out, dropped }
}
