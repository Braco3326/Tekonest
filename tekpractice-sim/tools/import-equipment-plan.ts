/**
 * import-equipment-plan: ONE-OFF conversion of the research priority table (CSV) into content/proposals/equipment-plan.json.
 *
 *   npx tsx tools/import-equipment-plan.ts "<priority table>.csv" ["<research notes dir>"] [--out <file>]
 *
 * Source URLs per row come from two places, first the CSV `notes` column (authoritative: it names the source of the numbers),
 * then the research note files, by matching the product (and the manufacturer for short names) on a table row or bullet line that
 * holds a link. A row with no link stays empty (no URL is ever invented). The CSV grade is kept as `sourceGrade`;
 * `dataQuality` is what the size supports (see equipmentPlan.ts `effectiveQuality`).
 *
 * After the first run the JSON is edited by hand (and by tools/promoteDevice.ts): this script is not re-run on a populated plan
 * unless `--force` is given, so a later hand edit cannot be overwritten by accident.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DataQuality,
  KNOWN_FAMILIES,
  PLAN_PATH,
  effectiveQuality,
  parsePlan,
  type PlanRow,
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

export type CsvRow = Record<string, string>

/** One CSV record → a plan row (sources from the notes column only; the notes-file match is added by `addNoteSources`). */
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
    dataQuality: effectiveQuality(grade, sizeMm),
    sourceGrade: grade,
    tier: Number(r.priority_tier) as PlanRow['tier'],
    wave: Number(r.wave) as PlanRow['wave'],
    sources: urlsIn(r.notes ?? ''),
    notes: r.notes ?? '',
  }
  return row
}

// ── matching the research note files ────────────────────────────────────────────────────────────────────────────────────────

const fold = (s: string): string =>
  ` ${s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()} `

interface NoteLine {
  folded: string
  head: string // the first two cells of a table row, folded (the product column), or the whole line for a bullet
  table: boolean
  urls: string[]
}

export function noteLines(text: string): NoteLine[] {
  const out: NoteLine[] = []
  for (const line of text.split(/\r?\n/)) {
    const urls = urlsIn(line)
    if (!urls.length) continue
    const table = line.trim().startsWith('|')
    const cells = table ? line.split('|').slice(1, 3).join(' ') : line
    out.push({ folded: fold(line.replace(/\]\(https?:[^)]*\)/g, ']')), head: fold(cells.replace(/\]\(https?:[^)]*\)/g, ']')), table, urls })
  }
  return out
}

/** Product keys to look for in a note line: the product without its parenthetical, and with it. */
export function productKeys(product: string): string[] {
  const bare = fold(product.replace(/\([^)]*\)/g, ''))
  const full = fold(product)
  return [...new Set([bare, full].filter((k) => k.trim().length >= 4))]
}

/** How far into a bullet line the product name may appear and still count as the line's subject. */
const BULLET_HEAD_CHARS = 70

const contains = (hay: string, needle: string): boolean => hay.includes(needle)

/** URLs of the note lines that talk about this product (and manufacturer, for a short or generic product name). */
export function matchNoteUrls(row: Pick<PlanRow, 'manufacturer' | 'product'>, lines: readonly NoteLine[]): string[] {
  const keys = productKeys(row.product)
  const maker = fold(row.manufacturer).trim().split(' ')[0]
  const out: string[] = []
  for (const l of lines) {
    // A table row names its product in the first cells; a bullet names it at its start (« Focusrite Scarlett 2i2: 180 x 117 mm — [link] »).
    // A product mentioned late in a long bullet is usually a school inventory or a ranking that merely lists it: not a source of its numbers.
    const hay = l.table ? l.head : l.folded.slice(0, BULLET_HEAD_CHARS)
    const hit = keys.some((k) => contains(hay, k))
    if (!hit) continue
    const long = keys.some((k) => k.trim().length >= 9)
    const hasMaker = maker.length >= 2 && contains(l.folded, ` ${maker} `)
    if (!long && !hasMaker) continue
    for (const u of l.urls) if (!out.includes(u)) out.push(u)
  }
  return out
}

const MAX_SOURCES = 6

/** Add the note-file URLs after the notes-column ones (deduplicated, at most MAX_SOURCES). */
export function addNoteSources(rows: readonly PlanRow[], lines: readonly NoteLine[]): PlanRow[] {
  return rows.map((r) => ({ ...r, sources: [...new Set([...r.sources, ...matchNoteUrls(r, lines)])].slice(0, MAX_SOURCES) }))
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

function main(): void {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const outAt = args.indexOf('--out')
  const out = outAt >= 0 ? args[outAt + 1] : PLAN_PATH
  const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out')
  const csv = positional[0]
  const notesDir = positional[1]
  if (!csv) throw new Error('usage: tsx tools/import-equipment-plan.ts <priority table.csv> [<research notes dir>] [--out <file>] [--force]')
  if (existsSync(out) && !force) throw new Error(`${out} exists: the plan is edited by hand after the first import; pass --force to regenerate`)
  const notes = notesDir ? readdirSync(notesDir).filter((f) => f.endsWith('.md')).map((f) => readFileSync(join(notesDir, f), 'utf8')) : []
  const rows = importPlan(readFileSync(csv, 'utf8'), notes)
  const today = new Date().toISOString().slice(0, 10)
  writeFileSync(out, JSON.stringify({ version: 1, generated: today, rows }, null, 1) + '\n')
  const by = (f: (r: PlanRow) => string) => rows.reduce<Record<string, number>>((a, r) => ((a[f(r)] = (a[f(r)] ?? 0) + 1), a), {})
  console.log(`equipment plan: ${rows.length} rows -> ${out}`)
  console.log('by dataQuality:', JSON.stringify(by((r) => r.dataQuality)))
  console.log('by wave:', JSON.stringify(by((r) => String(r.wave))))
  console.log(`with at least one source URL: ${rows.filter((r) => r.sources.length).length}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
