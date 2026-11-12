/**
 * merge-size-research: ONE-OFF merge of the four size-research result files (data-completion-A..D.json, 190 rows) into
 * content/proposals/equipment-plan.json (Wave 0c). Honesty first: no number is invented, rounded or "improved"; a figure the research left
 * in doubt is kept out of `sizeMm` and stays readable in the row's `notes`.
 *
 *   npx tsx tools/merge-size-research.ts [--dir <folder of data-completion-*.json>] [--plan <file>] [--dry-run]
 *
 * Rules (the numbers refer to the Wave 0c brief):
 *  1. Only rows whose dataQuality is `missing` or `estimate` are touched. A datasheet / dealer row keeps its size; a result that disagrees
 *     with it is logged as a conflict, never written.
 *  2. A row gets `sizeMm` only when the result gives all three axes AND a source grade AND the size is not in conflict. A partial result
 *     writes no `sizeMm`: the axes that exist are copied into `notes`, and `sizeConfidence` is `partial` (the schema allows `partial` with
 *     zero stored axes for exactly this case, see equipmentPlan.ts).
 *  3. `sizeConfidence`: `conflict` when the notes say sources disagree on a dimension (the held-back value stays in the notes, `sizeMm`
 *     stays empty, even when the result file filled one source's value, e.g. L-Acoustics Kara II); `partial` for one or two axes;
 *     `axis-assumed` when the axis order is unstated, assumed, inferred, derived from rack units, re-ordered by us, taken from a search
 *     summary, or the figure belongs to a variant the row only assumes; `ok` only for a complete, labelled triple of a datasheet or dealer.
 *     Precedence: conflict, partial, axis-assumed, ok. The baseline is a text classifier; `CURATED` records the rows where a human reading of
 *     the notes differs from it, each with its reason (and `classify()` is the only way a label is chosen).
 *  4. `dataQuality` is recomputed with `effectiveQuality` (equipmentPlan.ts), never set by hand.
 *  5. The result's URLs are added to `sources` (existing ones stay first; annotations and spaces are cleaned; Wikipedia, reviews and news
 *     pages are not taken, as in Wave 0b finding 5). The kind (datasheet / dealer / manual) is derived by `sourceKind` when a spec is written.
 *  6. Round bodies keep the plan convention (w = d = diameter, h = length): the result files already follow it and the merge copies them.
 *  7. Cable and connector definition rows (family cable-assembly*) have no box size: the connector pair and lengths go in `notes`.
 *  8. A row for a product no source documents (Telos "Xenon") is blocked with the note « no such product found »; the plan has no such row.
 *
 * The merge is idempotent: a row whose notes already carry the Wave 0c marker is not changed again (its sources are still topped up).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  PLAN_PATH,
  axisCount,
  effectiveQuality,
  loadPlan,
  savePlan,
  type DataQualityT,
  type PlanRow,
  type SizeConfidenceT,
  type SizeMmT,
} from './equipmentPlan'
import { isNonSource } from './import-equipment-plan'
import { sourceKind } from './sourceKind'

export const WAVE_0C_MARK = 'Wave 0c size research'

/** Where the committed copy of the four result files lives (the originals are in the research notes folder). */
export const RESEARCH_DIR = fileURLToPath(new URL('../content/proposals/size-research/', import.meta.url))

const axis = z.number().finite().positive().nullable()
export const ResearchResult = z
  .object({
    id: z.string().min(1),
    sizeMm: z.object({ w: axis, d: axis, h: axis }).strict(),
    weightKg: z.number().finite().positive().nullable(),
    sourceGrade: z.enum(['datasheet', 'dealer']).nullable(),
    sources: z.array(z.string()),
    portsText: z.string().nullable(),
    colour: z.string().nullable(),
    notes: z.string(),
  })
  .strict()
export type ResearchResultT = z.infer<typeof ResearchResult>

/** Read data-completion-A..D.json from `dir`; throws on a malformed row or a duplicate id. */
export function loadResults(dir: string = RESEARCH_DIR): ResearchResultT[] {
  const out: ResearchResultT[] = []
  for (const k of ['A', 'B', 'C', 'D']) {
    const file = join(dir, `data-completion-${k}.json`)
    const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown
    const parsed = z.array(ResearchResult).safeParse(raw)
    if (!parsed.success) {
      const i = parsed.error.issues[0]
      throw new Error(`${file}: ${i?.path.join('.')}: ${i?.message}`)
    }
    out.push(...parsed.data)
  }
  const seen = new Set<string>()
  for (const r of out) {
    if (seen.has(r.id)) throw new Error(`size research: duplicate id "${r.id}"`)
    seen.add(r.id)
  }
  return out
}

/** The non-null axes of a result as a plan size. */
export const axesOf = (s: ResearchResultT['sizeMm']): SizeMmT => ({
  ...(s.w != null ? { w: s.w } : {}),
  ...(s.d != null ? { d: s.d } : {}),
  ...(s.h != null ? { h: s.h } : {}),
})
const fullTriple = (s: ResearchResultT['sizeMm']): boolean => s.w != null && s.d != null && s.h != null

// ── sizeConfidence ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Classification {
  confidence: SizeConfidenceT
  reason: string
}

const DIM = /\b(depth|width|height|length|diameter|dims?|dimensions?|sizes?|axes|axis)\b/
const DIM_FIGURE = /\d\s?(mm|cm|in)\b|\d\s?x\s?\d/
const CONFLICT_WORDS = /conflict|disagree|inconsisten|contradict|differs\b/
const sentences = (notes: string): string[] => notes.split(/(?<=[.;])\s+/)
const aboutDimensions = (t: string): boolean => DIM.test(t) || DIM_FIGURE.test(t)

/** A sentence that says sources disagree about a DIMENSION (a conflict about the weight, the ports or the generation alone is not one). */
export function sizeConflictSentence(notes: string): string | undefined {
  for (const s of sentences(notes)) {
    const t = s.toLowerCase()
    if (!CONFLICT_WORDS.test(t) || !aboutDimensions(t)) continue
    if (/^\W*(weight|dealer weights?)\b/.test(t) && !/\b(depth|width|height|length|diameter)\b/.test(t)) continue
    return s.trim()
  }
  return undefined
}

const AXIS_WORDS =
  /unlabell?ed|not labell?ed|no axis labels?|axes? (are )?(not|left|unlabell?ed)|axis order (not|unstated|unknown|unresolved|assumed|inferred)|which edge|did not state which|not stated which|inferred|assumed|derived|search[- ]result summar|search summar|snippet-level|by 1u geometry|height axis not identified|unknown so sizes/

/** A sentence about the dimensions that says the axis order is unstated or assumed, or that the figure comes from a summary. */
export function axisDoubtSentence(notes: string): string | undefined {
  for (const s of sentences(notes)) {
    const t = s.toLowerCase()
    if (AXIS_WORDS.test(t) && aboutDimensions(t) && !/^\W*(weight|net weight)\b/.test(t)) return s.trim()
  }
  return undefined
}

/**
 * The text classifier: conflict (a sentence about a dimension that says sources disagree), then partial (one or two axes), then axis-assumed
 * (a sentence about the dimensions that says the axis order is unstated, assumed, inferred, derived, or read from a search summary), else ok.
 * A row without any axis and without a doubt is ok (nothing to doubt; it stays graded missing).
 */
export function baselineClassification(notes: string, size: ResearchResultT['sizeMm']): Classification {
  const conflict = sizeConflictSentence(notes)
  if (conflict) return { confidence: 'conflict', reason: `notes: ${conflict.slice(0, 90)}` }
  const n = axisCount(axesOf(size))
  if (n >= 1 && n <= 2) return { confidence: 'partial', reason: `${n} of 3 axes in the result` }
  const doubt = axisDoubtSentence(notes)
  if (doubt) return { confidence: 'axis-assumed', reason: `notes: ${doubt.slice(0, 90)}` }
  return { confidence: 'ok', reason: 'labelled axes, no disagreement in the notes' }
}

/**
 * Rows where a human reading of the notes (all 190 were read in full) differs from the baseline. Each entry says why. Keyed by plan id.
 *  - keyword hits that are about the weight, the ports, a packaging figure or another variant, not about the size of THIS product;
 *  - disagreements the text does not call a conflict (two current manufacturer documents, a dealer outlier the researcher kept out);
 *  - a size that belongs to a variant or configuration the row only assumes.
 */
export const CURATED: Readonly<Record<string, Classification>> = {
  'k-m-25400': { confidence: 'axis-assumed', reason: 'folded size 95 x 80 x 865 printed without axis labels; the boom-length disagreement (680 vs 805) is not the size' },
  'shure-beta-91a': { confidence: 'axis-assumed', reason: 'three unlabelled drawing callouts (95.1, 139.1, 20.3 mm); the dealer axis assignments disagree and were not used' },
  'sennheiser-mke-2': { confidence: 'ok', reason: 'no size at all (capsule length not found); the dealer disagreement is about the cable and a 1 g weight' },
  'heil-pr-40': { confidence: 'axis-assumed', reason: 'dimensions read from a search-result summary of the Heil sheet (the PDF returned 403)' },
  'rme-fireface-ufx-iii': { confidence: 'ok', reason: 'Thomann labels W / D / H; the search-summary figures are an alternative without ears, not a disagreement on the same measure' },
  'canare-162u-x21': { confidence: 'axis-assumed', reason: 'page prints 88.1 x 482.6 x 217 without axis labels; mapped by us as H x W x D from 2 RU and 19 in' },
  'avid-protools-mtrx-studio': { confidence: 'axis-assumed', reason: 'single dealer; height and width derived from 1U and 19 in, only the depth (200 mm) is stated' },
  'digico-sd12': { confidence: 'ok', reason: 'DiGiCo page labels W, D, H; the search summary only adds a fader count' },
  'antelope-orion-32-plus-gen4': { confidence: 'axis-assumed', reason: 'Andertons prints 483 x 44 x 280 unlabelled, mapped by us as W x H x D from 1U; the conflict is the weight' },
  'clear-com-fsii-bp24': { confidence: 'conflict', reason: 'depth 45 vs 38, height 97 vs 100 between the product page and another Clear-Com summary' },
  'db-audiotechnik-d80': { confidence: 'axis-assumed', reason: 'height and width derived from 2 RU and 19 in; only the depth is printed in mm; the inconsistency is about the output connectors' },
  'dbx-afs2': { confidence: 'axis-assumed', reason: 'page axes unlabelled, read as H x W x D from the 1U height' },
  'whirlwind-sp1x3': { confidence: 'ok', reason: 'no size (not found); the summaries only show packaging figures' },
  'l-acoustics-a15-focus': { confidence: 'ok', reason: 'manufacturer page labels W x H x D; the search summary concerns the A15i Focus, another product' },
  'lexicon-pcm92': { confidence: 'conflict', reason: 'dealer listings give depth 241, 194 or 318 mm and different weights' },
  'neumann-kh-750-dsp': { confidence: 'ok', reason: 'page labels H x W x D; the search summary only gives packed dimensions' },
  'qsc-rmx-850': { confidence: 'ok', reason: 'no per-model size on the manual page; the unused summary figures are for a revision' },
  'sonifex-dhy-04s': { confidence: 'axis-assumed', reason: 'values from a search-result excerpt of the Sonifex table (the page returned 404); the base DHY-04 differs' },
  'l-acoustics-kara-ii': { confidence: 'conflict', reason: 'EN page 733 x 500 x 252 vs FR page 701 x 252 x 403 and ProSoundWeb 734 x 483 (Wave 0c brief: sizes null, both values kept in the notes)' },
  'db-audiotechnik-v8': { confidence: 'conflict', reason: "depth 460 (product page) vs 406 (d&b's own architectural specification text)" },
  'mackie-1604vlz4': { confidence: 'conflict', reason: 'Thomann description 445 x 129 x 440 vs Thomann table 440 x 129 x 433; axis order unresolved' },
  'rode-lavalier-ii': { confidence: 'conflict', reason: 'one dealer only; its 5 mm body height is smaller than the 6 mm capsule other dealers give' },
  'mackie-big-knob-studio': { confidence: 'conflict', reason: 'three dealers agree, one (Chuck Levin) gives 79 x 137 x 142; the researcher flags the earlier conflict' },
  'behringer-ha400': { confidence: 'conflict', reason: 'Behringer manuals map the width and depth differently (47 x 57 x 104 H x W x D vs H x D x W)' },
  'shure-psm-900': { confidence: 'conflict', reason: 'depth 177 (user guide, labelled) vs 166 (spec sheet, unlabelled)' },
  'shure-ulx-d-receiver': { confidence: 'conflict', reason: "Shure's own H x W x D mapping (42 as depth) contradicts dealers and the 1U-height geometry" },
  'sennheiser-ew-dx-em-2': { confidence: 'conflict', reason: 'unlabelled figures that disagree inside the same document (189 vs 206 mm, 169 mm on the Dante sheet)' },
  'schoeps-cmc-6-mk-4': { confidence: 'conflict', reason: 'combined length 138 (sum, sonovente) vs 116 (tanotis, B&H); Schoeps publishes no combined figure' },
  'schoeps-cmc-6-mk-41': { confidence: 'conflict', reason: 'combined length 138 (sum, B&H via summary) vs 116 (MK xx manual); Schoeps publishes no combined figure' },
  'neumann-usm-69-i': { confidence: 'conflict', reason: 'diameter 30 + 48 mm not attributed on the datasheet; dealers give 48, 56 or 60 mm' },
  'rode-nt4': { confidence: 'conflict', reason: 'datasheet table 41 mm diameter vs drawing 61 mm vs dealer 61 x 33 mm' },
  'shure-mx418d': { confidence: 'conflict', reason: 'base figures unlabelled; Adorama 161.9 x 115, Crutchfield 4.507 x 2.198 x 6.277 in' },
  'shure-wl93': { confidence: 'conflict', reason: 'diameter 6.1 (Thomann) vs 5.84 mm (Adorama)' },
  'universal-audio-6176': { confidence: 'partial', reason: 'depth 311 and height 89 only; the 9 in width is implausible for 2U (search summary)' },
  'allen-heath-zed-14': { confidence: 'ok', reason: 'Thomann labelled spec table, Reverb and ProAcoustics agree; the other listings differ by 1 to 3 mm (rounding); the weight conflict is weight only' },
  'wisycom-mcr54': { confidence: 'ok', reason: 'datasheet labels H x W x D; one dealer shows 87.6 mm, two dealers and the datasheet show 85' },
  'allen-heath-sq-6': { confidence: 'ok', reason: 'A&H drawing labelled, Thomann agrees; the 13.3 kg conflict is weight only' },
  'k-m-26772': { confidence: 'ok', reason: 'base dimensions labelled; h is the stated maximum height of an adjustable stand; the weight conflict is weight only' },
  'audix-d6': { confidence: 'ok', reason: 'current manufacturer sheet labelled; the older sheet and dealer figures concern the weight' },
  'audix-i5': { confidence: 'ok', reason: 'manufacturer sheet labelled; the other figures concern the weight' },
  'dpa-4060': { confidence: 'ok', reason: 'spec sheet labelled; the 17 mm length belongs to the heavy-duty variant' },
  'neumann-u-67': { confidence: 'ok', reason: 'Neumann set page labelled; retailer outliers of 1 mm and the weight are not a size conflict' },
  'shure-axient-digital-ad4d': { confidence: 'ok', reason: 'spec sheet labels H x W x D; "inferred" refers to the rear connector counts, not the size' },
  'shure-ua845uwb': { confidence: 'ok', reason: 'guide labels H x W x D; "inferred" refers to the output count, not the size' },
  'neumann-ku-100': { confidence: 'ok', reason: 'Neumann table labels height, width, depth; dealers agree' },
  'yamaha-xmv8280-d': { confidence: 'ok', reason: 'Markertek page (fetched) labels W x H x D in inches and the summaries agree in mm; the 8.1 kg outliers are weight only' },
  'lynx-aurora-n': { confidence: 'ok', reason: 'Lynx page labels depth, width, height; the 8 lb conflict is weight only' },
  'l-acoustics-ks28': { confidence: 'ok', reason: 'manufacturer page labelled W x H x D (two fetches); the 565 and 1351 mm values are older documents or dealers' },
  'db-audiotechnik-d40': { confidence: 'axis-assumed', reason: 'height and width derived from 2 RU and 19 in; depth differs between datasheet revisions 1.6 and 1.7' },
  'eaton-5p-1u-ups': { confidence: 'axis-assumed', reason: 'figures are for the 5P1000R only; the 5P1500R sibling and the 230 V variants were not verified' },
  'cisco-sg350-managed-switch': { confidence: 'axis-assumed', reason: 'the row names no port count; the 28-port non-PoE variant is assumed, the PoE variants are deeper' },
  'netgear-m4250-av-switch': { confidence: 'axis-assumed', reason: 'only the M4250-26G4F-PoE+ was measured; other family members are larger' },
  'ssl-origin': { confidence: 'axis-assumed', reason: 'the generic row takes the 32-channel configuration (16 channels is narrower); height is the overall height with legs' },
  'argosy-universal-workstation': { confidence: 'axis-assumed', reason: 'configuration-specific (90V desk, 46 in insert, two racks); height is to the desk surface' },
  'avid-venue-s6l': { confidence: 'conflict', reason: 'generic row; the sheet prints 36.9 in for a width that is 989 mm (38.9 in); the S6L-24D surface is assumed' },
  'nexo-geo-m10': { confidence: 'axis-assumed', reason: 'values are the GEO M1012 page; the M1025 is assumed to share the size (brochure summary)' },
  'l-acoustics-x15-hiq': { confidence: 'axis-assumed', reason: 'overview labels W x H x D, the physical row repeats the numbers unlabelled; the researcher asks for a check against the drawing' },
  'meyer-sound-lina': { confidence: 'ok', reason: 'datasheet page labels H, W, D in inches (labels read by the fetch tool)' },
}

/** The label of a result: the curated reading when there is one, else the text classifier. */
export function classify(id: string, result: ResearchResultT): Classification {
  return CURATED[id] ?? baselineClassification(result.notes, result.sizeMm)
}

// ── sources ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A source URL fit for the plan: an annotation such as « (search summary) » dropped, spaces percent-encoded. Undefined when it is not a URL. */
export function cleanSourceUrl(raw: string): string | undefined {
  let u = raw.trim().replace(/\s+\((?:search summary|\d{3} [^)]*)\)$/, '')
  u = u.replace(/ /g, '%20')
  return /^https?:\/\/\S+$/.test(u) ? u : undefined
}

/** Pages that are not a source of a size: Wave 0b `isNonSource` (schools, blogs, news, reviews, simulators, accessory pages) plus an encyclopaedia and a reviewer site. */
const NOT_A_SOURCE_HOST = /(^|\.)(wikipedia\.org|kenrockwell\.com)$/

const KIND_RANK: Record<string, number> = { datasheet: 0, manual: 1, dealer: 2, reference: 3 }

/** The URLs of a result that may be added to a row, in plan order: manufacturer pages first, then manuals, dealers, references. */
export function sourcesToAdd(manufacturer: string, category: string, urls: readonly string[]): { add: string[]; dropped: string[] } {
  const keep: { url: string; rank: number; i: number }[] = []
  const dropped: string[] = []
  urls.forEach((raw, i) => {
    const url = cleanSourceUrl(raw)
    if (!url) return void dropped.push(raw)
    let host = ''
    try {
      host = new URL(url).hostname.toLowerCase()
    } catch {
      return void dropped.push(raw)
    }
    if (NOT_A_SOURCE_HOST.test(host) || isNonSource(url, category)) return void dropped.push(url)
    keep.push({ url, rank: KIND_RANK[sourceKind(manufacturer, url)] ?? 3, i })
  })
  keep.sort((a, b) => a.rank - b.rank || a.i - b.i)
  return { add: keep.map((k) => k.url), dropped }
}

// ── the merge ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type MergeEventKind =
  | 'size-set'
  | 'size-held-back'
  | 'partial-in-notes'
  | 'no-size'
  | 'kept-existing-size'
  | 'existing-size-disagrees'
  | 'weight-set'
  | 'weight-disagrees'
  | 'blocked'
  | 'source-dropped'
export interface MergeEvent {
  id: string
  kind: MergeEventKind
  detail: string
}

const isCableRow = (row: PlanRow): boolean => row.family === 'cable-assembly' || row.family === 'cable-assembly-v2' || row.category === 'cable'
const fmtAxes = (s: SizeMmT): string => (['w', 'd', 'h'] as const).filter((k) => s[k] != null).map((k) => `${k} ${s[k]}`).join(', ')
const sameSize = (a: SizeMmT, b: SizeMmT): boolean => a.w === b.w && a.d === b.d && a.h === b.h
const tidy = (s: string): string => s.trim().replace(/\s+/g, ' ')

/** Merge one result into one row. Pure: returns the new row and what happened. */
export function mergeRow(row: PlanRow, result: ResearchResultT): { row: PlanRow; events: MergeEvent[] } {
  const events: MergeEvent[] = []
  const id = row.id
  const next: PlanRow = { ...row }

  // sources: always topped up (idempotent), never removed
  const { add, dropped } = sourcesToAdd(row.manufacturer, row.category, result.sources)
  for (const d of dropped) events.push({ id, kind: 'source-dropped', detail: d })
  next.sources = [...row.sources, ...add.filter((u) => !row.sources.includes(u))]

  if (/xenon/i.test(`${row.id} ${row.product}`)) {
    events.push({ id, kind: 'blocked', detail: 'no such product found' })
    return { row: { ...next, sizeMm: {}, sizeConfidence: 'ok', dataQuality: 'missing', notes: `${row.notes} [${WAVE_0C_MARK}] no such product found; blocked.`.trim() }, events }
  }

  const old = row.dataQuality
  if (old === 'datasheet' || old === 'dealer') {
    // rule 1: the size is kept; a disagreeing result is logged, not written
    if (fullTriple(result.sizeMm) && !sameSize(row.sizeMm, axesOf(result.sizeMm)))
      events.push({ id, kind: 'existing-size-disagrees', detail: `plan ${fmtAxes(row.sizeMm)} vs research ${fmtAxes(axesOf(result.sizeMm))}` })
    return { row: next, events }
  }
  if (row.notes.includes(WAVE_0C_MARK)) return { row: next, events }

  const cls = classify(id, result)
  const axes = axesOf(result.sizeMm)
  const full = fullTriple(result.sizeMm)
  const cable = isCableRow(row)
  const keepSize = full && result.sourceGrade !== null && cls.confidence !== 'conflict' && cls.confidence !== 'partial' && !cable
  const hadSize = axisCount(row.sizeMm) > 0

  let confidence: SizeConfidenceT = cls.confidence
  if (keepSize) next.sizeMm = axes
  else if (hadSize) confidence = row.sizeConfidence // an existing estimate keeps its size and its label; the notes carry the new doubt
  else next.sizeMm = {}
  // a full triple without any source grade cannot be called ok
  if (full && result.sourceGrade === null && confidence === 'ok') confidence = 'axis-assumed'
  // 'partial' is only honest while one or two axes exist somewhere (stored or in the notes)
  next.sizeConfidence = confidence

  const grade: DataQualityT = keepSize ? (result.sourceGrade as DataQualityT) : (row.sourceGrade ?? row.dataQuality)
  if (keepSize) next.sourceGrade = grade
  next.dataQuality = effectiveQuality(grade, next.sizeMm, next.sizeConfidence)

  // weight: only a result weight, only when the plan has none; a different one is logged
  if (result.weightKg != null) {
    if (row.weightKg == null) {
      next.weightKg = result.weightKg
      events.push({ id, kind: 'weight-set', detail: `${result.weightKg} kg` })
    } else if (row.weightKg !== result.weightKg) events.push({ id, kind: 'weight-disagrees', detail: `plan ${row.weightKg} kg vs research ${result.weightKg} kg (plan kept)` })
  }

  // notes: the result's own text, then what the structure could not carry
  const parts: string[] = [`[${WAVE_0C_MARK}, grade ${result.sourceGrade ?? 'none'}, sizeConfidence ${confidence}: ${cls.reason}]`, tidy(result.notes)]
  if (cls.confidence === 'conflict' && !keepSize && axisCount(axes) > 0) parts.push(`Held-back size (sources disagree, not stored in sizeMm): ${fmtAxes(axes)} mm.`)
  if (cls.confidence === 'partial' && !keepSize) parts.push(`Partial axes (not stored in sizeMm, the missing ones would be guessed): ${fmtAxes(axes)} mm.`)
  if (cable && axisCount(axes) > 0) parts.push(`Result size not stored (a cable definition has no box size): ${fmtAxes(axes)} mm.`)
  if (cable && result.portsText) parts.push(`Connector definition: ${tidy(result.portsText)}`)
  if (result.colour) parts.push(`Colour (research): ${tidy(result.colour)}.`)
  next.notes = tidy(`${row.notes} ${parts.join(' ')}`)

  if (keepSize) events.push({ id, kind: 'size-set', detail: `${fmtAxes(axes)} mm, grade ${grade}, ${confidence}, dataQuality ${next.dataQuality}` })
  else if (confidence === 'conflict' || cls.confidence === 'conflict') events.push({ id, kind: 'size-held-back', detail: `${cls.reason}${axisCount(axes) ? ` (held back: ${fmtAxes(axes)} mm)` : ''}` })
  else if (axisCount(axes) > 0) events.push({ id, kind: 'partial-in-notes', detail: fmtAxes(axes) })
  else events.push({ id, kind: 'no-size', detail: confidence })
  if (!keepSize && hadSize) events.push({ id, kind: 'kept-existing-size', detail: fmtAxes(row.sizeMm) })
  return { row: next, events }
}

/** Merge every result into the plan (rows in plan order; a result id that is not in the plan throws). */
export function mergeAll(rows: readonly PlanRow[], results: readonly ResearchResultT[]): { rows: PlanRow[]; events: MergeEvent[] } {
  const byId = new Map(results.map((r) => [r.id, r]))
  const planIds = new Set(rows.map((r) => r.id))
  for (const r of results) if (!planIds.has(r.id)) throw new Error(`size research: "${r.id}" is not a plan row`)
  const events: MergeEvent[] = []
  const out = rows.map((row) => {
    const res = byId.get(row.id)
    if (!res) return row
    const m = mergeRow(row, res)
    events.push(...m.events)
    return m.row
  })
  return { rows: out, events }
}

// ── report ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const count = <T>(xs: readonly T[], key: (x: T) => string): Record<string, number> =>
  xs.reduce<Record<string, number>>((a, x) => ((a[key(x)] = (a[key(x)] ?? 0) + 1), a), {})

/** Counts for the log: by (dataQuality, sizeConfidence), by wave, and the outcome eligibility per wave. */
export function summarize(rows: readonly PlanRow[]): {
  byQualityConfidence: Record<string, number>
  byWave: Record<string, Record<string, number>>
} {
  const byQualityConfidence = count(rows, (r) => `${r.dataQuality} / ${r.sizeConfidence}`)
  const byWave: Record<string, Record<string, number>> = {}
  for (const w of [1, 2, 3, 4, 5]) {
    const rs = rows.filter((r) => r.wave === w)
    const q = count(rs, (r) => r.dataQuality)
    byWave[String(w)] = {
      promotable: (q.datasheet ?? 0) + (q.dealer ?? 0),
      'beta-modelled': q.estimate ?? 0,
      blocked: q.missing ?? 0,
      total: rs.length,
    }
  }
  return { byQualityConfidence, byWave }
}

function main(): void {
  const args = process.argv.slice(2)
  const valueOf = (flag: string): string | undefined => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined)
  const dir = valueOf('--dir') ?? RESEARCH_DIR
  const planPath = valueOf('--plan') ?? PLAN_PATH
  const dry = args.includes('--dry-run')
  if (!existsSync(dir)) throw new Error(`no research folder ${dir}`)
  const rows = loadPlan(planPath)
  const results = loadResults(dir)
  const { rows: next, events } = mergeAll(rows, results)
  const changed = next.filter((r, i) => JSON.stringify(r) !== JSON.stringify(rows[i]))
  console.log(`results ${results.length}, plan rows changed ${changed.length} of ${rows.length}${dry ? ' (dry run, nothing written)' : ''}`)
  const sum = summarize(next)
  console.log('by dataQuality / sizeConfidence:', JSON.stringify(sum.byQualityConfidence))
  console.log('by wave (promotable / beta-modelled / blocked):', JSON.stringify(sum.byWave))
  const byKind = count(events, (e) => e.kind)
  console.log('events:', JSON.stringify(byKind))
  for (const e of events.filter((x) => x.kind === 'size-held-back' || x.kind === 'existing-size-disagrees' || x.kind === 'weight-disagrees' || x.kind === 'blocked'))
    console.log(`  ${e.kind}: ${e.id}: ${e.detail}`)
  if (!dry) savePlan(next, planPath)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
