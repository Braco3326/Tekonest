/**
 * import-equipment-plan: ONE-OFF conversion of the research priority table (CSV) into content/proposals/equipment-plan.json, plus the
 * `--refresh-sources` mode that recomputes ONLY the `sources` of a plan that has been edited by hand since.
 *
 *   npx tsx tools/import-equipment-plan.ts "<priority table>.csv" ["<research notes dir>"] [--out <file>] [--force]
 *   npx tsx tools/import-equipment-plan.ts --refresh-sources "<priority table>.csv" "<research notes dir>" [--plan <file>]
 *
 * Source URLs per row come from two places, first the CSV `notes` column (authoritative: it names the source of the numbers),
 * then the research note files, ONLY for a note line whose SUBJECT is this very product (Wave 0b finding 5). The old matching took a URL
 * from any table row or bullet that merely mentioned the product, so school inventories (McGill, Stanford, Bakersfield), sibling products
 * (SPLIT6, RK2, the Midas M32), accessories (a coiled cable, a shock mount) and blog posts ended up as sources of a size. Now:
 *  - a table row counts when its first cell (its product cell) starts with the product (optionally preceded by the manufacturer);
 *  - a bullet counts when its subject (the text before the first ":" or dash) starts with the product, and only the links whose label or
 *    address names the product (or that are the bullet's only link) are kept;
 *  - a link to a school, a library guide, a blog, news, a review or an accessory page is never taken from the note files.
 * A row with no link stays empty (no URL is ever invented). The CSV grade is kept as `sourceGrade`; `dataQuality` is what the size supports
 * (see equipmentPlan.ts `effectiveQuality`).
 *
 * After the first run the JSON is edited by hand (traits, sizeConfidence, promotion flags): the full import is not re-run on a populated plan
 * unless `--force` is given (it would drop those edits). `--refresh-sources` keeps every other field, sizes included.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DataQuality,
  KNOWN_FAMILIES,
  PLAN_PATH,
  axisCount,
  effectiveQuality,
  loadPlan,
  parsePlan,
  savePlan,
  type PlanRow,
  type SizeConfidenceT,
  type SizeMmT,
} from './equipmentPlan'

/** Minimal RFC 4180 reader: quoted fields, commas and newlines inside quotes, doubled quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((f) => f !== ''))
}

/** The http(s) URLs of a text, in order, trailing punctuation removed, first occurrence only. */
export function urlsIn(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/https?:\/\/[^\s)\]>"'|<]+/g)) {
    const u = m[0].replace(/[.,;:!?'")\]]+$/, '')
    if (/^https?:\/\/[^\s/]+\.[^\s/]+/.test(u) && !out.includes(u)) out.push(u)
  }
  return out
}

/** The CSV used `rack-box-v3-sloped`; the plan (Task 3.3) names the family `rack-box-v3-slope`. */
const FAMILY_ALIAS: Record<string, string> = { 'rack-box-v3-sloped': 'rack-box-v3-slope' }

const num = (s: string | undefined): number | undefined => {
  const v = Number((s ?? '').trim())
  return (s ?? '').trim() !== '' && Number.isFinite(v) && v > 0 ? v : undefined
}

/**
 * sizeConfidence from the notes and the size, WITHOUT hand overrides (the plan file carries the hand-checked value):
 * one or two axes is 'partial'; an assumed, inferred or unconfirmed axis order, or a figure read from a search summary, is 'axis-assumed';
 * a note that says CONFLICT next to a dimension word (depth, width, height, dims, size) is 'conflict'. A CONFLICT about the weight, the
 * connectors or the generation alone does not make the size unsure. No axis at all is 'ok' (the row is graded missing anyway).
 */
export function deriveSizeConfidence(notes: string, size: SizeMmT): SizeConfidenceT {
  const n = axisCount(size)
  if (n >= 1 && n <= 2) return 'partial'
  if (n === 0) return 'ok'
  const t = notes.toLowerCase()
  if (/conflict[^.;]{0,40}\b(depth|width|height|dims?|dimensions?|size)\b|\b(depth|width|height|dims?|dimensions?|size)\b[^.;]{0,40}conflict/.test(t)) return 'conflict'
  if (/axis order (assumed|inferred|unlabelled|not (printed|stated|confirmed))|order (inferred|not confirmed)|assumed w x d x h|via search/.test(t)) return 'axis-assumed'
  return 'ok'
}

export type CsvRow = Record<string, string>

/** One CSV record → a plan row (sources from the notes column only; the notes-file match is added by `addNoteSources`). Traits start empty. */
export function rowFromCsv(r: CsvRow): PlanRow {
  const sizeMm: SizeMmT = {}
  const w = num(r.width_mm)
  const d = num(r.depth_mm)
  const h = num(r.height_mm)
  if (w !== undefined) sizeMm.w = w
  if (d !== undefined) sizeMm.d = d
  if (h !== undefined) sizeMm.h = h
  const grade = DataQuality.parse(r.data_quality)
  const family = FAMILY_ALIAS[r.shape_family] ?? r.shape_family
  const weight = num(r.weight_kg)
  const sizeConfidence = deriveSizeConfidence(r.notes ?? '', sizeMm)
  const row: PlanRow = {
    id: r.id,
    status: r.status === 'beta' ? 'beta' : 'new',
    category: r.category,
    manufacturer: r.manufacturer,
    product: r.product,
    sizeMm,
    ...(weight !== undefined ? { weightKg: weight } : {}),
    portsSummary: r.ports_summary,
    family: family as PlanRow['family'],
    dataQuality: effectiveQuality(grade, sizeMm, sizeConfidence),
    sourceGrade: grade,
    tier: Number(r.priority_tier) as PlanRow['tier'],
    wave: Number(r.wave) as PlanRow['wave'],
    sources: urlsIn(r.notes ?? ''),
    notes: r.notes ?? '',
    traits: [],
    sizeConfidence,
  }
  return row
}

// ── matching the research note files ────────────────────────────────────────────────────────────────────────────────────────

const fold = (s: string): string =>
  ` ${s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' ').replace(/\+/g, ' plus ').replace(/[^a-z0-9]+/g, ' ').trim()} `
const squash = (s: string): string => s.replace(/\s+/g, '')

export interface NoteLink {
  label: string
  url: string
}

export interface NoteLine {
  /** The subject of the line as written: the product cell of a table row, the text before the first ":" or dash of a bullet. */
  subject: string
  table: boolean
  links: NoteLink[]
}

/** The links of a line: markdown links with their label first, then bare URLs. */
function linksIn(line: string): NoteLink[] {
  const out: NoteLink[] = []
  for (const m of line.matchAll(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)) {
    const url = urlsIn(m[2]!)[0]
    if (url && !out.some((l) => l.url === url)) out.push({ label: m[1]!, url })
  }
  for (const url of urlsIn(line.replace(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, ' '))) if (!out.some((l) => l.url === url)) out.push({ label: '', url })
  return out
}

const stripLinks = (s: string): string => s.replace(/\[([^\]]*)\]\(https?:[^)]*\)/g, '$1').replace(/\*\*/g, '')

export function noteLines(text: string): NoteLine[] {
  const out: NoteLine[] = []
  for (const line of text.split(/\r?\n/)) {
    const links = linksIn(line)
    if (!links.length) continue
    const table = line.trim().startsWith('|')
    let subject: string
    if (table) {
      const cells = line.split('|').slice(1).map((c) => stripLinks(c).trim())
      subject = cells.find((c) => c !== '' && !/^\d+$/.test(c)) ?? ''
    } else {
      const text0 = stripLinks(line).replace(/^\s*(?:[-*+]|\d+[.)])\s*/, '')
      const cut = text0.search(/:\s|\s[—–]\s/)
      subject = cut >= 0 ? text0.slice(0, cut) : text0
    }
    out.push({ subject, table, links })
  }
  return out
}

/** The start of a name, before its first parenthesis, comma, plus or spaced slash: « Shure PSM300 (P3T/P3R) » gives « Shure PSM300 ». */
const headOf = (s: string): string => s.split(/\s\(|,|\s\+\s|\s\/\s/)[0]!

/** A parenthesis that names a generation or a variant (« 4th Gen », « MkII », « V2 »): the line is about THAT variant, not about the bare model. */
const GENERATION = /\b(\d(st|nd|rd|th) gen|gen ?\d|mk ?\d|mk ?i+|v ?\d|g ?\d|compact|mini|lite)\b/i

/** Words that describe what a product is, not which one: « UA844+ antenna distribution » is « UA844+ » to a note, « PSM1 shock mount » is « PSM1 ». */
const DESCRIPTORS = new Set(['receiver', 'transmitter', 'handheld', 'bodypack', 'antenna', 'distribution', 'microphone', 'mic', 'splitter', 'stand', 'boom', 'arm', 'studio', 'shock', 'mount', 'headphones', 'headphone', 'monitor', 'speaker', 'amplifier', 'interface', 'mixer', 'console', 'compressor', 'preamp', 'di', 'box', 'unit', 'system', 'beltpack', 'active', 'passive', 'earset', 'gooseneck', 'lavalier', 'headset'])

/** Product keys a subject may equal: the product, its head, and the head without its trailing descriptor words; each bare and with the manufacturer in front. */
export function productKeys(product: string, manufacturer = ''): string[] {
  const words = fold(headOf(product)).trim().split(' ').filter(Boolean)
  const prefixes: string[] = []
  for (let n = words.length - 1; n >= 1 && DESCRIPTORS.has(words[n]!); n--) prefixes.push(words.slice(0, n).join(''))
  const forms = [...new Set([squash(fold(product)), squash(fold(headOf(product))), ...prefixes])].filter((k) => k.length >= 2)
  const makerFull = squash(fold(manufacturer))
  const makerFirst = squash(fold(manufacturer).trim().split(' ')[0] ?? '')
  return [...new Set([...forms.filter((k) => k.length >= 4), ...forms.flatMap((k) => (makerFull ? [makerFull + k, makerFirst + k] : []))])]
}

/** Whether a note subject IS this product (an exact match, not a prefix: « 828es » is not « 828 », « X32 Compact » is not « X32 »). */
export function subjectIsProduct(subject: string, row: Pick<PlanRow, 'manufacturer' | 'product'>): boolean {
  const keys = new Set(productKeys(row.product, row.manufacturer))
  const whole = squash(fold(subject))
  if (keys.has(whole)) return true
  const paren = /\(([^)]*)\)/.exec(subject)?.[1] ?? ''
  if (paren && GENERATION.test(paren)) return false
  return keys.has(squash(fold(headOf(subject))))
}

const modelWords = (s: string): string[] => fold(s).trim().split(' ').filter((w) => w.length >= 3 && /\d/.test(w))

/** A link that is never a source of a product's size, whatever line it sits on: schools, library guides, blogs, news, reviews, simulators, accessory pages. */
export function isNonSource(url: string, category = ''): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return true
  }
  const host = u.hostname.toLowerCase()
  const path = decodeURIComponent(u.pathname).toLowerCase()
  if (/\.edu(\.[a-z]{2})?$/.test(host) || /(^|\.)(libraryguides|libguides)\./.test(host) || /(university|college|berklee|mcgill|stanford|ccrma)/.test(host)) return true
  if (/\/(blog|blogs|news|press|press-release|forum|forums|review|reviews)(\/|$)/.test(path) || /simulator/.test(path)) return true
  if (/(musicradar|soundonsound|prosoundweb|musicconnection|tvtechnology|radioworld|erinsaudiocorner|gearspace)/.test(host)) return true // reviews and news, not a spec
  const slug = path.split('/').filter(Boolean).pop() ?? ''
  if (/review|blog|news|press-release/.test(slug)) return true
  if (category !== 'cable' && /coiled|adapter|spare|cable|earpad|replacement/.test(slug)) return true
  return false
}

/**
 * URLs of the note lines whose SUBJECT is this product (see the file header). A table row gives all its links; a bullet with several links
 * gives the ones that name the product, or that name no other model (« [Adorama SPLIT6] » on the SP1X3 line is another model's page).
 */
export function matchNoteUrls(row: Pick<PlanRow, 'manufacturer' | 'product'> & { category?: string }, lines: readonly NoteLine[]): string[] {
  const own = productKeys(row.product, '')
  const ownModels = new Set(modelWords(row.product))
  const out: string[] = []
  for (const l of lines) {
    if (!subjectIsProduct(l.subject, row)) continue
    for (const link of l.links) {
      if (isNonSource(link.url, row.category) || out.includes(link.url)) continue
      if (!l.table && l.links.length > 1) {
        const path = decodeURIComponent(new URL(link.url).pathname)
        const text = link.label || (path.split('/').filter(Boolean).pop() ?? '')
        const hay = squash(fold(`${link.label} ${path}`))
        const names = own.some((k) => hay.includes(k)) || modelWords(row.product).some((m) => hay.includes(squash(m)))
        const foreign = modelWords(text).some((m) => ![...ownModels].some((o) => o.includes(m) || m.includes(o)))
        if (!names && foreign) continue
      }
      out.push(link.url)
    }
  }
  return out
}

const MAX_SOURCES = 6

/** Add the note-file URLs after the notes-column ones (deduplicated, at most MAX_SOURCES). */
export function addNoteSources(rows: readonly PlanRow[], lines: readonly NoteLine[]): PlanRow[] {
  return rows.map((r) => ({ ...r, sources: [...new Set([...r.sources, ...matchNoteUrls(r, lines)])].slice(0, MAX_SOURCES) }))
}

/**
 * Recompute ONLY the `sources` of an existing plan from the CSV notes column and the note files (the plan's other fields, sizes included,
 * are returned unchanged). A row whose id is not in the CSV keeps its sources.
 */
export function refreshSources(plan: readonly PlanRow[], csvNotesById: ReadonlyMap<string, string>, lines: readonly NoteLine[]): PlanRow[] {
  return plan.map((r) => {
    const csvNotes = csvNotesById.get(r.id)
    if (csvNotes === undefined) return r
    const sources = [...new Set([...urlsIn(csvNotes), ...matchNoteUrls(r, lines)])].slice(0, MAX_SOURCES)
    return { ...r, sources }
  })
}

export function importPlan(csvText: string, notesText: string[] = []): PlanRow[] {
  const [head, ...records] = parseCsv(csvText)
  const rows = records.map((rec) => {
    if (rec.length !== head.length) throw new Error(`CSV row with ${rec.length} fields (expected ${head.length}): ${rec[0]}`)
    return rowFromCsv(Object.fromEntries(head.map((k, i) => [k, rec[i]])))
  })
  for (const r of rows) if (!(KNOWN_FAMILIES as readonly string[]).includes(r.family)) throw new Error(`${r.id}: unknown family "${r.family}"`)
  const lines = notesText.flatMap(noteLines)
  const withSources = addNoteSources(rows, lines)
  parsePlan({ version: 1, generated: 'x', rows: withSources }) // fail fast on a duplicate id or a bad row
  return withSources
}

/** The CSV `notes` column by row id. */
export function csvNotes(csvText: string): Map<string, string> {
  const [head, ...records] = parseCsv(csvText)
  const idAt = head!.indexOf('id')
  const notesAt = head!.indexOf('notes')
  return new Map(records.map((rec) => [rec[idAt]!, rec[notesAt] ?? '']))
}

/**
 * The research note files of the gap analysis. The `data-completion-*` files hold sizes that are merged into the plan by a separate step; their
 * links come with that step, so they are not read here.
 */
const readNotesDir = (dir: string): string[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('data-completion'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))

function main(): void {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const refresh = args.includes('--refresh-sources')
  const valueOf = (flag: string): string | undefined => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined)
  const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out' && args[i - 1] !== '--plan')
  const csv = positional[0]
  const notesDir = positional[1]
  if (refresh) {
    if (!csv || !notesDir) throw new Error('usage: tsx tools/import-equipment-plan.ts --refresh-sources <priority table.csv> <research notes dir> [--plan <file>]')
    const planPath = valueOf('--plan') ?? PLAN_PATH
    const plan = loadPlan(planPath)
    const next = refreshSources(plan, csvNotes(readFileSync(csv, 'utf8')), readNotesDir(notesDir).flatMap(noteLines))
    const changed = next.filter((r, i) => JSON.stringify(r.sources) !== JSON.stringify(plan[i]!.sources))
    savePlan(next, planPath)
    console.log(`sources refreshed on ${changed.length} of ${plan.length} rows (other fields untouched): ${changed.map((r) => r.id).join(', ')}`)
    return
  }
  const out = valueOf('--out') ?? PLAN_PATH
  if (!csv) throw new Error('usage: tsx tools/import-equipment-plan.ts <priority table.csv> [<research notes dir>] [--out <file>] [--force]')
  if (existsSync(out) && !force) throw new Error(`${out} exists: the plan is edited by hand after the first import; pass --force to regenerate (this drops traits and other hand edits), or --refresh-sources to recompute only the sources`)
  const rows = importPlan(readFileSync(csv, 'utf8'), notesDir ? readNotesDir(notesDir) : [])
  const today = new Date().toISOString().slice(0, 10)
  writeFileSync(out, JSON.stringify({ version: 1, generated: today, rows }, null, 1) + '\n')
  const by = (f: (r: PlanRow) => string) => rows.reduce<Record<string, number>>((a, r) => ((a[f(r)] = (a[f(r)] ?? 0) + 1), a), {})
  console.log(`equipment plan: ${rows.length} rows -> ${out}`)
  console.log('by dataQuality:', JSON.stringify(by((r) => r.dataQuality)))
  console.log('by wave:', JSON.stringify(by((r) => String(r.wave))))
  console.log(`with at least one source URL: ${rows.filter((r) => r.sources.length).length}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
