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
 * A third axis of doubt, `sizeConfidence` (Wave 0b finding 7): a full size can still be unsure (the axis order was assumed, two sources disagree on
 * a dimension, the number came from a search summary, only some axes are known). `effectiveQuality` lets a row stay datasheet / dealer (promotable)
 * only when the confidence is 'ok'; anything else is an estimate (beta-modelled at best).
 *
 * `staged` / `promoted` / `betaModelled` are set by tools/promoteDevice.ts (stage 1 sets `staged`, stage 2 sets `promoted` or `betaModelled`)
 * and read by tools/propose-content.ts (Task 0.2).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { PortFlag } from './schemas'

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

/**
 * How far a size can be trusted beyond "it is there":
 *  - ok            labelled axes, one source (or sources that agree);
 *  - axis-assumed  the axis order was assumed, inferred, re-ordered by us or read from a search summary instead of the document;
 *  - conflict      two sources disagree on a dimension of the size (not only on the weight);
 *  - partial       one or two axes only (the missing ones would be guessed).
 */
export const SizeConfidence = z.enum(['ok', 'axis-assumed', 'conflict', 'partial'])
export type SizeConfidenceT = z.infer<typeof SizeConfidence>

/** How many of the three axes are present. */
export const axisCount = (s: SizeMmT): number => [s.w, s.d, s.h].filter((v) => (v ?? 0) > 0).length

/**
 * The grade a size supports. A row is promotable (datasheet or dealer) only when ALL THREE axes are present AND its sizeConfidence is 'ok';
 * a partial size, an assumed axis order or a conflict between sources makes it an estimate (beta-modelled at best, never in the verified
 * catalogue); no axis at all is missing. The research found no source (grade missing): blocked even if a number is parsable.
 */
export function effectiveQuality(grade: DataQualityT, size: SizeMmT, confidence: SizeConfidenceT = 'ok'): DataQualityT {
  if (grade === 'missing') return 'missing'
  const n = axisCount(size)
  if (n === 0) return 'missing'
  if (n < 3 || confidence !== 'ok') return 'estimate'
  return grade
}

/**
 * One port (or a run of identical ports) of a plan row, as the datasheet documents it. `id` is optional: when absent the id is built
 * from the direction and the role ("in" + "mic" + count 2 gives in-mic-1, in-mic-2); a given id is kept when valid and short, else shortened.
 */
export const PlanPort = z
  .object({
    id: z.string().min(1).optional(),
    role: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'a role is a kebab-case slug'),
    dir: z.enum(['in', 'out', 'bidir']),
    connector: z.string().min(1),
    signal: z.string().min(1),
    flags: z.array(PortFlag).optional(),
    count: z.number().int().min(1).max(16).optional(),
  })
  .strict()
export type PlanPort = z.infer<typeof PlanPort>

/**
 * What the plan knows about how the device behaves, where the category alone cannot say (a condenser needs phantom, a ribbon must not get it, a
 * body-pack runs on batteries, a DriveRack is a processor although its category says amplifier). tools/behaviourTemplates.ts reads them.
 *  condenser / ribbon / dynamic   capsule type of a microphone;
 *  phantom-powered                a microphone (or DI) that needs 48 V phantom from the chain;
 *  battery                        runs on batteries, no mains inlet (body-packs, handhelds, field recorders on batteries);
 *  receiver / transmitter         the two halves of a wireless or IEM system (a rack transmitter has the `rack` trait too and a mains inlet);
 *  bodypack / handheld            the battery transmitter forms: never a mains inlet, no power toggle;
 *  processor / power-amp          signal processors (compressors, EQs, speaker processors) and power amplifiers, whatever their category;
 *  monitor-controller             a monitor controller;
 *  active / passive               powered speaker or DI that needs power / passive parts, or an externally powered microphone;
 *  rack / desk                    a rack-mounted unit / a desk, console or desktop unit.
 */
export const TRAITS = [
  'condenser', 'ribbon', 'dynamic', 'phantom-powered', 'battery', 'receiver', 'transmitter', 'bodypack', 'handheld', 'processor', 'power-amp',
  'passive', 'active', 'monitor-controller', 'rack', 'desk',
] as const
export const Trait = z.enum(TRAITS)
export type TraitT = z.infer<typeof Trait>

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
    /** Behaviour traits (see TRAITS): required on every row, possibly empty. */
    traits: z.array(Trait),
    /** Whether the size can be trusted beyond being present (see SizeConfidence). */
    sizeConfidence: SizeConfidence,
    /** Stage 1 of the promotion has run (asset-spec skeleton written); stage 2 (--commit) turns it into promoted or beta-modelled. */
    staged: z.boolean().optional(),
    promoted: z.boolean().optional(),
    betaModelled: z.boolean().optional(),
  })
  .strict()
  .refine((r) => (r.dataQuality !== 'datasheet' && r.dataQuality !== 'dealer') || hasFullSize(r.sizeMm), {
    path: ['sizeMm'],
    message: 'a datasheet or dealer row needs all three sizes (w, d, h) positive; a partial size is an estimate',
  })
  .refine((r) => (r.dataQuality !== 'datasheet' && r.dataQuality !== 'dealer') || r.sizeConfidence === 'ok', {
    path: ['sizeConfidence'],
    message: 'a datasheet or dealer row needs sizeConfidence ok; an assumed axis order, a conflict between sources or a partial size makes the row an estimate',
  })
  .refine((r) => (axisCount(r.sizeMm) >= 1 && axisCount(r.sizeMm) <= 2) === (r.sizeConfidence === 'partial'), {
    path: ['sizeConfidence'],
    message: "sizeConfidence is 'partial' exactly when one or two of the three axes are known",
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
