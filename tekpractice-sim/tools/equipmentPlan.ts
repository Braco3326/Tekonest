/**
 * equipmentPlan: the machine-readable "build all equipment" plan (content/proposals/equipment-plan.json).
 *
 * One row per device of the research table (134 Bêta + 181 additions). The file is generated ONCE from the research CSV by
 * tools/import-equipment-plan.ts and edited by hand afterwards; it holds numbers and URLs only, never a photo.
 *
 * Two grades are kept per row, on purpose:
 *  - `sourceGrade`: what the research CSV said (datasheet / dealer / estimate / missing);
 *  - `dataQuality`: what the SIZE actually supports (`effectiveQuality`). A "datasheet" row that carries only one or two of the
 *    three dimensions is an `estimate` (the missing axes would be guessed), and one with none is `missing`. Promotion reads
 *    `dataQuality`, so a partial size can never reach the verified catalogue as if it were measured (Review Focus 3).
 *
 * `promoted` / `betaModelled` are set by tools/promoteDevice.ts (Task 0.4) and read by tools/propose-content.ts (Task 0.2).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

/** Shape families the plan may name: the existing ones, then the new ones of Tasks 2.1 to 4.1. */
export const KNOWN_FAMILIES = [
  'rack-box-v2',
  'console-wedge-v2',
  'revolve',
  'curved-cabinet',
  'tripod-stand',
  'power-strip',
  'cable-assembly',
  'generic-panel',
  'rack-box-v3b',
  'moulded-box',
  'revolve-v2-oval',
  'round-base-stand',
  'speaker-cabinet-v2',
  'cable-assembly-v2',
  'rack-box-v3-slope',
  'assembly',
] as const
export type Family = (typeof KNOWN_FAMILIES)[number]

export const DataQuality = z.enum(['datasheet', 'dealer', 'estimate', 'missing'])
export type DataQualityT = z.infer<typeof DataQuality>

const dim = z.number().finite().positive()
export const SizeMm = z.object({ w: dim.optional(), d: dim.optional(), h: dim.optional() }).strict()
export type SizeMmT = z.infer<typeof SizeMm>

const hasFullSize = (s: SizeMmT): boolean => (s.w ?? 0) > 0 && (s.d ?? 0) > 0 && (s.h ?? 0) > 0

/** The grade a size supports: the research grade only when all three dimensions are there; a partial size is an estimate; none is missing. */
export function effectiveQuality(grade: DataQualityT, size: SizeMmT): DataQualityT {
  if (grade === 'missing') return 'missing' // the research found no source: stay blocked even if a number is parsable
  const n = [size.w, size.d, size.h].filter((v) => (v ?? 0) > 0).length
  if (n === 0) return 'missing'
  if (n < 3) return 'estimate'
  return grade
}

export const PlanRow = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'plan id must be a kebab-case slug'),
    status: z.enum(['beta', 'new']),
    category: z.string().min(1),
    manufacturer: z.string().min(1),
    product: z.string().min(1),
    sizeMm: SizeMm,
    weightKg: z.number().finite().positive().optional(),
    portsSummary: z.string(),
    family: z.enum(KNOWN_FAMILIES),
    dataQuality: DataQuality,
    sourceGrade: DataQuality.optional(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    wave: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    sources: z.array(z.string().regex(/^https?:\/\/\S+$/, 'a source is an http(s) URL')),
    notes: z.string(),
    promoted: z.boolean().optional(),
    betaModelled: z.boolean().optional(),
  })
  .strict()
  .refine((r) => (r.dataQuality !== 'datasheet' && r.dataQuality !== 'dealer') || hasFullSize(r.sizeMm), {
    path: ['sizeMm'],
    message: 'a datasheet or dealer row needs all three sizes (w, d, h) positive; a partial size is an estimate',
  })
export type PlanRow = z.infer<typeof PlanRow>

export const PlanFile = z.object({ version: z.literal(1), generated: z.string().min(1), rows: z.array(PlanRow) }).strict()
export type PlanFileT = z.infer<typeof PlanFile>

export const PLAN_PATH = fileURLToPath(new URL('../content/proposals/equipment-plan.json', import.meta.url))

/** Validate a parsed plan file; throws with the JSON path of the first problem, and on a duplicate id. */
export function parsePlan(raw: unknown): PlanRow[] {
  const r = PlanFile.safeParse(raw)
  if (!r.success) {
    const i = r.error.issues[0]
    throw new Error(`equipment plan invalid at ${i?.path.join('.')}: ${i?.message}`)
  }
  const seen = new Set<string>()
  for (const row of r.data.rows) {
    if (seen.has(row.id)) throw new Error(`equipment plan: duplicate id "${row.id}"`)
    seen.add(row.id)
  }
  return r.data.rows
}

/** Load and validate the plan (zod; throws on a duplicate id). `path` is for tests that work on a temporary copy. */
export function loadPlan(path: string = PLAN_PATH): PlanRow[] {
  return parsePlan(JSON.parse(readFileSync(path, 'utf8')))
}

/** Write the plan back (stable key order, one trailing newline). Validates first, so a bad edit never reaches the disk. */
export function savePlan(rows: readonly PlanRow[], path: string = PLAN_PATH, generated?: string): void {
  let prev = ''
  try {
    prev = (JSON.parse(readFileSync(path, 'utf8')) as { generated?: string }).generated ?? ''
  } catch {
    /* a new file */
  }
  const file = { version: 1 as const, generated: generated ?? (prev || new Date().toISOString().slice(0, 10)), rows: [...rows] }
  parsePlan(file)
  writeFileSync(path, JSON.stringify(file, null, 1) + '\n')
}

export interface PlanFilter {
  wave?: number
  family?: string
  tier?: number
  status?: string
}

/** The rows that match every given filter, in plan order. */
export function planRows(filter: PlanFilter = {}, rows: readonly PlanRow[] = loadPlan()): PlanRow[] {
  return rows.filter(
    (r) =>
      (filter.wave === undefined || r.wave === filter.wave) &&
      (filter.family === undefined || r.family === filter.family) &&
      (filter.tier === undefined || r.tier === filter.tier) &&
      (filter.status === undefined || r.status === filter.status),
  )
}
