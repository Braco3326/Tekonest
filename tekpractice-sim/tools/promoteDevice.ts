/**
 * promoteDevice: turn a plan row into a device (Wave 0, Task 0.4). `npm run promote -- <id> [--dry-run]`.
 *
 * Two outcomes (spec 4.1) plus one refusal:
 *  - promoted      the size is a datasheet or dealer one (all three axes) and the row has a source: the device goes into content/catalog.json with
 *                  short port ids, a power toggle for every mains inlet, the behaviour template of its category, and an asset-spec skeleton;
 *                  its Bêta proposal (if any) is removed; the plan row is flagged `promoted`.
 *  - beta-modelled the size is an estimate (partial or flagged so): the device STAYS a Bêta proposal (patch-only, badge « dimensions estimées »)
 *                  with an asset-spec skeleton whose size is complete but marked estimated; the plan row is flagged `betaModelled`.
 *  - blocked       dataQuality `missing`, or no ports for a cable row, or an id collision: nothing is written, the reason says why.
 * Idempotent: promoting a row already promoted (or beta-modelled) changes nothing. `dryRun` computes everything and writes nothing.
 *
 * Nothing is invented: a size comes from the plan row (a partial one is completed from the category footprint and SAID so in the spec's sources
 * and the notes), ports come from the plan row, else from the Bêta proposal (renamed to short ids, the old ids kept in `portAliases`), else from the
 * category template (said so in the notes).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { estimateSizeMm } from '../src/scene/placeholderSize'
import { applyTemplate, kindOf, type Template } from './behaviourTemplates'
import { checkCatalog } from './catalogChecks'
import { loadPlan, savePlan, type PlanPort, type PlanRow } from './equipmentPlan'
import { buildSkeleton } from './assets3d/spec-skeleton'
import { AssetSpec, type AssetSpecT, type SpecSourceT } from './assets3d/specSchema'
import { Catalog, Device, type CatalogT } from './schemas'

type CatalogDevice = CatalogT['devices'][number]

export interface Paths {
  plan: string
  catalog: string
  proposals: string
  specDir: string
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_PATHS: Readonly<Paths> = {
  plan: join(ROOT, 'content', 'proposals', 'equipment-plan.json'),
  catalog: join(ROOT, 'content', 'catalog.json'),
  proposals: join(ROOT, 'content', 'proposals', 'catalog-proposals.json'),
  specDir: join(ROOT, 'content', 'asset-specs'),
}

export interface PromoteOptions {
  dryRun?: boolean
  paths?: Partial<Paths>
  /** YYYY-MM-DD, for the notes and the nominal-coverage source (default today). */
  today?: string
}

export interface PromotionResult {
  id: string
  outcome: 'promoted' | 'beta-modelled' | 'blocked'
  changes: string[]
  /** Why it is blocked, or a note for a no-op. */
  reason?: string
}

type ProposalFile = { devices: Record<string, unknown>[] } & Record<string, unknown>

// ── catalogue text: append one device in the file's own style, touching nothing else ───────────────────────────────────

/** `{ "a": 1, "b": [x, y] }` on one line, the catalogue's inline style. */
function inline(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`
  if (v !== null && typeof v === 'object') {
    const e = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined)
    return e.length ? `{ ${e.map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }` : '{}'
  }
  return JSON.stringify(v)
}

/** One field of a device, one line per array item, one line per key of an object (acoustic, modelFront). */
function field(key: string, v: unknown, pad: string): string {
  if (Array.isArray(v) && v.length && v.every((x) => x !== null && typeof x === 'object')) {
    return `${pad}${JSON.stringify(key)}: [\n${v.map((x) => `${pad}  ${inline(x)}`).join(',\n')}\n${pad}]`
  }
  if (v !== null && typeof v === 'object' && !Array.isArray(v) && key !== 'realWorld') {
    const e = Object.entries(v as Record<string, unknown>)
    return `${pad}${JSON.stringify(key)}: {\n${e.map(([k, x]) => `${pad}  ${JSON.stringify(k)}: ${inline(x)}`).join(',\n')}\n${pad}}`
  }
  return `${pad}${JSON.stringify(key)}: ${inline(v)}`
}

const KEY_ORDER = ['id', 'label', 'levels', 'realWorld', 'ports', 'controls', 'acoustic', 'modelFront', 'modelBody', 'routing', 'loadOhms', 'minLoadOhms', 'impedanceOhms', 'portAliases', 'sizeMm']

/** A device as text, indented to sit inside `"devices": [ ... ]` of content/catalog.json (4 spaces for the braces, 6 for the keys). */
export function formatDevice(d: CatalogDevice): string {
  const rec = d as unknown as Record<string, unknown>
  const keys = [...KEY_ORDER.filter((k) => rec[k] !== undefined), ...Object.keys(rec).filter((k) => !KEY_ORDER.includes(k) && rec[k] !== undefined)]
  const rw = d.realWorld
  const parts = keys.map((k) => {
    if (k === 'realWorld') {
      return `      "realWorld": {\n        "brand": ${JSON.stringify(rw.brand)}, "model": ${JSON.stringify(rw.model)}, "category": ${JSON.stringify(rw.category)},\n        "typicalUse": ${JSON.stringify(rw.typicalUse)},\n        "notes": ${JSON.stringify(rw.notes)}\n      }`
    }
    return field(k, rec[k], '      ')
  })
  return `    {\n${parts.join(',\n')}\n    }`
}

const DEVICES_END = '\n    }\n  ],\n\n  "rules"'

/** The catalogue text with `device` appended to `devices` (everything before the insertion point is byte-identical). */
export function appendDevice(catalogText: string, device: CatalogDevice): string {
  const at = catalogText.indexOf(DEVICES_END)
  if (at < 0 || catalogText.indexOf(DEVICES_END, at + 1) >= 0) throw new Error('content/catalog.json: cannot find the end of the devices array (expected `    }\\n  ],\\n\\n  "rules"`)')
  return `${catalogText.slice(0, at)}\n    },\n${formatDevice(device)}${catalogText.slice(at + '\n    }'.length)}`
}

// ── building a device ─────────────────────────────────────────────────────────────────────────────────────────────────

const isFullSize = (s: PlanRow['sizeMm']): boolean => (s.w ?? 0) > 0 && (s.d ?? 0) > 0 && (s.h ?? 0) > 0
const fmtSize = (s: { w: number; d: number; h: number }): string => `${s.w} x ${s.d} x ${s.h} mm (w x d x h)`

/** Plan ports for a row: its own list, else the Bêta proposal's ports (old ids kept so they can be aliased), else none (the template default). */
function givenPorts(row: PlanRow, proposal: Record<string, unknown> | undefined): { ports: PlanPort[]; from: 'plan' | 'proposal' | 'template' } {
  if (row.ports?.length) return { ports: row.ports, from: 'plan' }
  const ports = (proposal?.ports as { portId: string; dir: 'in' | 'out' | 'bidir'; connector: string; signal: string; flags?: PlanPort['flags'] }[] | undefined) ?? []
  if (!ports.length) return { ports: [], from: 'template' }
  return {
    from: 'proposal',
    ports: ports.map((p) => ({ id: p.portId, role: 'port', dir: p.dir, connector: p.connector, signal: p.signal, ...(p.flags?.length ? { flags: p.flags } : {}) })),
  }
}

function buildNotes(row: PlanRow, today: string, t: Template, from: string, size: string): string {
  const src = row.sources[0] ? ` Size source: ${row.sources[0]}.` : ''
  const extra = t.notes.length ? ` ${t.notes.map((n) => n.charAt(0).toUpperCase() + n.slice(1)).join('. ')}.` : ''
  return `Built from the equipment plan (${today}); size ${size} (${row.dataQuality}).${src} Ports: ${from === 'plan' ? 'documented in the plan' : from === 'proposal' ? 'from the Bêta proposal (knowledge base), long ids shortened' : 'category template, to be checked against the datasheet'}.${extra}`
}

/** The spec skeleton: complete size, ports on the io face at 0,0 marked `guess` (nothing is measured), one control entry per catalogue control. */
function specFor(device: CatalogDevice, size: { w: number; d: number; h: number }, sources: SpecSourceT[]): AssetSpecT {
  const cat = { devices: [device], connectorTypes: [], signalTypes: [], rules: [], version: 1, meta: {} } as unknown as CatalogT
  const base = buildSkeleton(device.id, cat, { w: size.w, h: size.h, d: size.d }, sources)
  const controls = base.controls.map((c, i, all) => {
    const power = c.controlId === 'power'
    const n = all.filter((x) => x.controlId !== 'power').length
    const rank = all.slice(0, i).filter((x) => x.controlId !== 'power').length
    return power
      ? { ...c, kind: 'switch' as const, face: 'io' as const, axis: 'x' as const, xMm: Math.max(10, size.w - 20), yMm: Math.max(10, size.h / 2), sizeMm: { w: 10, h: 10, d: 3 } }
      : { ...c, face: 'top' as const, xMm: Math.round((size.w * (rank + 1)) / (n + 1)), yMm: Math.round(size.d / 2), sizeMm: c.kind === 'switch' ? { w: 10, h: 10, d: 3 } : { w: 15, h: 15, d: 10 } }
  })
  const spec: AssetSpecT = {
    ...base,
    ports: base.ports.map((p) => ({ ...p, confidence: 'guess' as const })),
    controls,
    sources,
  }
  return AssetSpec.parse(spec)
}

/** The plan's source URLs as spec sources; the first one carries `note` (what is a placeholder or an estimate), so the spec says it. */
const planSources = (row: PlanRow, note: string): SpecSourceT[] =>
  row.sources.map((url, i) => ({ kind: 'datasheet' as const, url, note: `equipment plan source (research grade: ${row.sourceGrade ?? row.dataQuality})${i === 0 ? `; ${note}` : ''}` }))

/** Short ids that changed: old -> new (only explicit ids that were renamed). */
const aliasesOf = (renamed: Record<string, string>): Record<string, string> | undefined => (Object.keys(renamed).length ? renamed : undefined)

// ── the tool ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export function promoteDevice(id: string, opts: PromoteOptions = {}): PromotionResult {
  const paths: Paths = { ...DEFAULT_PATHS, ...opts.paths }
  const today = opts.today ?? new Date().toISOString().slice(0, 10)
  const rows = loadPlan(paths.plan)
  const row = rows.find((r) => r.id === id)
  if (!row) throw new Error(`promote: "${id}" is not a row of the equipment plan`)
  const blocked = (reason: string): PromotionResult => ({ id, outcome: 'blocked', changes: [], reason })

  if (row.promoted === true) return { id, outcome: 'promoted', changes: [], reason: 'already promoted: nothing to do' }
  if (row.betaModelled === true) return { id, outcome: 'beta-modelled', changes: [], reason: 'already beta-modelled: nothing to do' }
  if (row.dataQuality === 'missing') return blocked(`dataQuality is missing for ${id}: no size to build from (a datasheet pass is needed first)`)

  const catalogText = readFileSync(paths.catalog, 'utf8')
  const catalog = Catalog.parse(JSON.parse(catalogText))
  if (catalog.devices.some((d) => d.id === id)) throw new Error(`promote: "${id}" is already in content/catalog.json but its plan row is not flagged promoted (id collision): fix the plan by hand`)
  const proposalFile = existsSync(paths.proposals) ? (JSON.parse(readFileSync(paths.proposals, 'utf8')) as ProposalFile) : undefined
  const proposal = proposalFile?.devices.find((d) => d.id === id)
  if (row.status === 'new' && proposal) throw new Error(`promote: "${id}" is a new plan row but already a proposal (id collision): fix the plan or the proposals by hand`)

  const promoting = row.dataQuality === 'datasheet' || row.dataQuality === 'dealer'
  if (promoting && !row.sources.length) return blocked(`${id}: no source URL recorded for the size: add one to the plan row before promoting`)

  const { ports: given, from } = givenPorts(row, proposal)
  const kind = kindOf(row.category, row.traits)
  if (kind === 'cable' && !given.length) return blocked(`${id}: a cable row needs its documented ports (row.ports): the template has no default ends`)

  const tpl = applyTemplate(row.category, row, given, today)
  const changes: string[] = []

  // size: the plan's, or the plan's completed from the category (beta-modelled only; said so)
  let size: { w: number; d: number; h: number }
  let sizeNote: string
  if (promoting) {
    if (!isFullSize(row.sizeMm)) return blocked(`${id}: ${row.dataQuality} grade but the size is not complete (w, d, h): fix the plan row`)
    size = row.sizeMm as { w: number; d: number; h: number }
    sizeNote = fmtSize(size)
  } else {
    const est = estimateSizeMm(row.category, row.sizeMm)
    size = est.sizeMm
    sizeNote = est.estimated.length ? `${fmtSize(size)} with ${est.estimated.join(', ')} ESTIMATED from the category footprint` : fmtSize(size)
  }

  const label = (proposal?.label as string | undefined) ?? `${row.manufacturer} ${row.product}`
  const rw = proposal?.realWorld as { typicalUse?: string } | undefined

  if (promoting) {
    const aliases = aliasesOf(tpl.renamed)
    const device = Device.parse({
      id,
      label,
      levels: [],
      realWorld: {
        brand: row.manufacturer,
        model: row.product,
        category: row.category,
        typicalUse: rw?.typicalUse ?? `${row.manufacturer} ${row.product} (${row.category})`,
        notes: buildNotes(row, today, tpl, from, sizeNote),
      },
      ports: tpl.ports,
      ...(tpl.controls.length ? { controls: tpl.controls } : {}),
      ...(tpl.acoustic ? { acoustic: tpl.acoustic } : {}),
      ...(tpl.routing ? { routing: tpl.routing } : {}),
      ...(aliases ? { portAliases: aliases } : {}),
    })
    const nextText = appendDevice(catalogText, device)
    const next = Catalog.parse(JSON.parse(nextText))
    const hard = checkCatalog(next, { modelIds: new Set(next.devices.map((d) => d.id)) }).filter((i) => i.level === 'error')
    if (hard.length) throw new Error(`promote ${id}: the generated device fails the catalogue checks:\n  ${hard.map((i) => `${i.path}: ${i.message}`).join('\n  ')}`)
    const spec = specFor(device, size, planSources(row, `size ${sizeNote}; port and control positions are placeholders (confidence guess) until measured`))

    changes.push(`catalog: add devices["${id}"] (${device.ports.length} ports, ${(device.controls ?? []).length} control(s), category ${row.category}, template ${tpl.kind})`)
    if (aliases) changes.push(`catalog: portAliases ${JSON.stringify(aliases)} (saved cables to the old Bêta port ids follow)`)
    if (proposal) changes.push(`proposals: remove ${id}`)
    changes.push(`spec: write content/asset-specs/${id}.json (${sizeNote}; ports and controls at placeholder positions)`)
    changes.push(`plan: ${id} promoted`)
    if (!opts.dryRun) {
      writeFileSync(paths.catalog, nextText)
      if (proposalFile && proposal) {
        proposalFile.devices = proposalFile.devices.filter((d) => d.id !== id)
        writeFileSync(paths.proposals, JSON.stringify(proposalFile, null, 1) + '\n')
      }
      writeSpec(paths.specDir, spec)
      savePlan(rows.map((r) => (r.id === id ? { ...r, promoted: true } : r)), paths.plan)
    }
    return { id, outcome: 'promoted', changes }
  }

  // beta-modelled: the device stays a proposal
  const pRef = proposalFile
  if (!pRef) throw new Error(`promote: no proposals file at ${paths.proposals}`)
  let entry: Record<string, unknown>
  if (proposal) {
    entry = { ...proposal, sizeMm: planSize(row) }
    changes.push(`proposals: update ${id} (sizeMm from the plan, ports unchanged: saved projects keep their cables)`)
  } else {
    const ports = tpl.ports.map(({ flags, ...p }) => {
      const kept = (flags ?? []).filter((f) => f !== 'isMainsSource')
      return kept.length ? { ...p, flags: kept } : p
    })
    entry = {
      id,
      label,
      levels: [],
      realWorld: { brand: row.manufacturer, model: row.product, category: row.category, typicalUse: `${row.manufacturer} ${row.product} (${row.category})`, notes: `PROPOSITION (${today}) built from the equipment plan: ${buildNotes(row, today, tpl, from, sizeNote)}` },
      ports,
      sizeMm: planSize(row),
    }
    const check = Device.safeParse(entry)
    if (!check.success) throw new Error(`promote ${id}: the proposal entry is invalid: ${check.error.issues[0]?.path.join('.')} ${check.error.issues[0]?.message}`)
    changes.push(`proposals: add ${id} (${ports.length} ports from the ${from} list, patch-only, badge Bêta)`)
  }
  const proposalDevice = Device.parse({ ...entry, controls: undefined, routing: undefined, acoustic: undefined })
  const spec = specFor({ ...proposalDevice, controls: [] }, size, planSources(row, `size ${sizeNote}: ESTIMATE, the model is badged « dimensions estimées »`))
  changes.push(`spec: write content/asset-specs/${id}.json (${sizeNote}; ports at placeholder positions, confidence guess, no controls: a proposal has none)`)
  changes.push(`plan: ${id} beta-modelled`)
  if (!opts.dryRun) {
    pRef.devices = proposal ? pRef.devices.map((d) => (d.id === id ? entry : d)) : [...pRef.devices, entry]
    writeFileSync(paths.proposals, JSON.stringify(pRef, null, 1) + '\n')
    writeSpec(paths.specDir, spec)
    savePlan(rows.map((r) => (r.id === id ? { ...r, betaModelled: true } : r)), paths.plan)
  }
  return { id, outcome: 'beta-modelled', changes }
}

/** The plan size as a proposal's sizeMm (the axes it has). */
function planSize(row: PlanRow): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of ['w', 'd', 'h'] as const) if ((row.sizeMm[k] ?? 0) > 0) out[k] = row.sizeMm[k] as number
  return out
}

function writeSpec(dir: string, spec: AssetSpecT): void {
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${spec.id}.json`)
  if (existsSync(path)) return // never overwrite an existing spec (a hand-filled one wins)
  writeFileSync(path, JSON.stringify(spec, null, 2) + '\n')
}
