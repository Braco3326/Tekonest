/**
 * promoteDevice: turn a plan row into a device in TWO STAGES (Wave 0, Task 0.4; reworked in Wave 0b). `npm run promote -- <id> [options]`.
 *
 *  Stage 1  `npm run promote -- <id>`            writes ONLY the asset-spec skeleton (size, sources, a to-do note about the ports) and marks the plan
 *                                                  row `staged: true`. It never touches content/catalog.json or the proposals file, so a device that
 *                                                  later fails its gates leaves nothing half-promoted.
 *  Stage 2  `npm run promote -- <id> --commit`   run after the GLB shipped and its gates are green (DBL step 5). It refuses unless the manifest has the
 *                                                  device's row and public/assets/<id>.glb exists. Two outcomes:
 *     promoted       the plan size is promotable (datasheet or dealer, all three axes, sizeConfidence ok, a source) AND the spec says
 *                    `portsDocumented: true` (with `portsSource`): the catalogue entry is written from the spec's DOCUMENTED ports plus the behaviour
 *                    template, the id leaves the proposals file, the plan row is flagged `promoted`.
 *     beta-modelled  anything else with a model: the device stays a Bêta proposal (its size and ports; a new row gets a proposal built from the spec's
 *                    ports), badge « dimensions estimées », the plan row is flagged `betaModelled`.
 *  Revert   `npm run promote -- <id> --revert`   undoes the latest stage completely: stage 2 (the catalogue entry or the proposal edit goes, the proposal
 *                                                  is restored from the journal, the row is `staged` again), else stage 1 (the untouched skeleton goes).
 *
 * Every stage is atomic: all new file contents are computed and validated first, written to temporary files, then renamed; if a rename fails the
 * files already renamed are restored. Every stage is idempotent (a second run changes nothing). `--dry-run` computes everything and writes nothing.
 *
 * Nothing is invented. The ports of a promoted device are the ones the datasheet documents (the spec's `ports`, each with connector, signal and
 * direction): the category template (tools/behaviourTemplates.ts) only adds behaviour on top (power toggle for every mains inlet, phantom, routes,
 * controls; NO acoustic or gain numbers: data rule). A spec without `portsDocumented: true` can never be promoted. A Bêta row's proposal ports go into the skeleton as a TO-DO NOTE
 * (text), never as ports.
 *
 * The asset pipeline sees a staged device as the catalogue it would become (`stagedDevices`, used as the default catalogue of `asset:build`), so the
 * spec's parity check passes between the stages.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { estimateSizeMm } from '../src/scene/placeholderSize'
import { applyTemplate, shortPortId, type Template } from './behaviourTemplates'
import { checkCatalog } from './catalogChecks'
import { loadPlan, parsePlan, type PlanPort, type PlanRow } from './equipmentPlan'
import { sourceKind } from './sourceKind'
import { checkSpecParity } from './assets3d/loadSpecs'
import { AssetSpec, type AssetSpecT, type SpecSourceT } from './assets3d/specSchema'
import { Catalog, Device, type CatalogT } from './schemas'

type CatalogDevice = CatalogT['devices'][number]

export interface Paths {
  plan: string
  catalog: string
  proposals: string
  specDir: string
  /** public/assets/ASSET_MANIFEST.json and the folder of the GLBs: stage 2 refuses unless the device's row and file are there. */
  manifest: string
  assetsDir: string
  /** The revert journal: what stage 2 changed that cannot be recomputed (the proposal it removed or replaced). */
  journal: string
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_PATHS: Readonly<Paths> = {
  plan: join(ROOT, 'content', 'proposals', 'equipment-plan.json'),
  catalog: join(ROOT, 'content', 'catalog.json'),
  proposals: join(ROOT, 'content', 'proposals', 'catalog-proposals.json'),
  specDir: join(ROOT, 'content', 'asset-specs'),
  manifest: join(ROOT, 'public', 'assets', 'ASSET_MANIFEST.json'),
  assetsDir: join(ROOT, 'public', 'assets'),
  journal: join(ROOT, 'content', 'proposals', 'promotion-journal.json'),
}

export interface PromoteOptions {
  dryRun?: boolean
  /** Stage 2. */
  commit?: boolean
  /** Undo the latest stage. */
  revert?: boolean
  /**
   * Re-derive an already PROMOTED device from its spec and the (possibly fixed) templates and replace its catalogue entry in place. Everything else is
   * untouched; the entry's build date is kept. A no-op when nothing changed.
   */
  regen?: boolean
  /** With revert of stage 1: delete the spec even when it has hand edits. */
  discardSpec?: boolean
  paths?: Partial<Paths>
  /** YYYY-MM-DD, for the notes (default today). */
  today?: string
  /** Test hook: called with each target path just before its temporary file is renamed into place (throw to simulate a failure). */
  beforeRename?: (path: string) => void
}

export interface PromotionResult {
  id: string
  outcome: 'staged' | 'promoted' | 'beta-modelled' | 'blocked' | 'reverted'
  changes: string[]
  /** Why it is blocked, or a note for a no-op. */
  reason?: string
  /** Things to look at (from the template), never silently fixed. */
  issues?: string[]
}

type Json = Record<string, unknown>
type ProposalFile = { devices: Json[] } & Json
interface JournalEntry {
  outcome: 'promoted' | 'beta-modelled'
  /** The proposal as it was before stage 2 (null when the device had none), and its position in the file. */
  proposalBefore: Json | null
  proposalIndex: number | null
}
interface Journal {
  version: 1
  entries: Record<string, JournalEntry>
}

// ── catalogue text: append / remove one device in the file's own style, touching nothing else ─────────────────────────

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

/** The catalogue text without the device `id` (the inverse of appendDevice for a device that tool wrote: `appendDevice` then `removeDevice` is the identity). */
export function removeDevice(catalogText: string, id: string): string {
  const start = catalogText.indexOf(`\n    {\n      "id": ${JSON.stringify(id)},`)
  if (start < 0) throw new Error(`content/catalog.json: device "${id}" not found in the file's device layout`)
  const end = catalogText.indexOf('\n    }', start + 1)
  if (end < 0) throw new Error(`content/catalog.json: cannot find the end of device "${id}"`)
  const after = catalogText.slice(end + '\n    }'.length)
  // a device in the middle is followed by ",\n    {": drop the comma that follows; the last one is preceded by ",": drop that one
  if (after.startsWith(',')) return catalogText.slice(0, start) + after.slice(1)
  const before = catalogText.slice(0, start)
  if (!before.endsWith(',')) throw new Error(`content/catalog.json: unexpected text before device "${id}"`)
  return before.slice(0, -1) + after
}

/**
 * The catalogue text with the device `id` replaced IN PLACE by `device` (same position, everything else byte-identical). Used by `--regen`: a template or
 * spec fix is applied to an already promoted device by re-deriving it from its spec, never by editing content/catalog.json by hand.
 */
export function replaceDevice(catalogText: string, id: string, device: CatalogDevice): string {
  const start = catalogText.indexOf(`\n    {\n      "id": ${JSON.stringify(id)},`)
  if (start < 0) throw new Error(`content/catalog.json: device "${id}" not found in the file's device layout`)
  const end = catalogText.indexOf('\n    }', start + 1)
  if (end < 0) throw new Error(`content/catalog.json: cannot find the end of device "${id}"`)
  return `${catalogText.slice(0, start)}\n${formatDevice(device)}${catalogText.slice(end + '\n    }'.length)}`
}

// ── atomic writes ────────────────────────────────────────────────────────────────────────────────────────────────────

interface Write {
  path: string
  /** null deletes the file. */
  content: string | null
}

/**
 * Applies several file writes as one unit: every new content goes to a temporary file first, then each is renamed into place; when a rename (or the
 * hook) fails, the files already replaced are restored from memory, the temporary files are removed and the error is rethrown.
 */
export function applyWrites(writes: readonly Write[], beforeRename?: (path: string) => void): void {
  const before = new Map<string, string | null>()
  for (const w of writes) before.set(w.path, existsSync(w.path) ? readFileSync(w.path, 'utf8') : null)
  const tmp = new Map<string, string>()
  const done: Write[] = []
  try {
    for (const w of writes) {
      if (w.content === null) continue
      mkdirSync(dirname(w.path), { recursive: true })
      const t = `${w.path}.tmp-${process.pid}`
      writeFileSync(t, w.content)
      tmp.set(w.path, t)
    }
    for (const w of writes) {
      beforeRename?.(w.path)
      if (w.content === null) rmSync(w.path, { force: true })
      else renameSync(tmp.get(w.path)!, w.path)
      done.push(w)
    }
  } catch (e) {
    for (const w of done.reverse()) {
      const old = before.get(w.path) ?? null
      if (old === null) rmSync(w.path, { force: true })
      else writeFileSync(w.path, old)
    }
    throw e
  } finally {
    for (const t of tmp.values()) rmSync(t, { force: true })
  }
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8').replace(new RegExp('^' + String.fromCharCode(0xfeff)), '')) as T
const stringify = (v: unknown): string => JSON.stringify(v, null, 1) + '\n'

// ── plan helpers ────────────────────────────────────────────────────────────────────────────────────────────────────────

const isFullSize = (s: PlanRow['sizeMm']): boolean => (s.w ?? 0) > 0 && (s.d ?? 0) > 0 && (s.h ?? 0) > 0
const fmtSize = (s: { w: number; d: number; h: number }): string => `${s.w} x ${s.d} x ${s.h} mm (w x d x h)`
const isPromotable = (row: PlanRow): boolean => row.dataQuality === 'datasheet' || row.dataQuality === 'dealer'

/** The plan size as a proposal's sizeMm (the axes it has). */
function planSize(row: PlanRow): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of ['w', 'd', 'h'] as const) if ((row.sizeMm[k] ?? 0) > 0) out[k] = row.sizeMm[k] as number
  return out
}

/** The spec size the skeleton gets: the plan's for a promotable row, else the plan's completed from the category (said so). */
function skeletonSize(row: PlanRow): { size: { w: number; d: number; h: number }; note: string } {
  if (isPromotable(row)) {
    const size = row.sizeMm as { w: number; d: number; h: number }
    return { size, note: fmtSize(size) }
  }
  const est = estimateSizeMm(row.category, row.sizeMm)
  const doubt = row.sizeConfidence === 'axis-assumed' ? 'axis order assumed' : row.sizeConfidence === 'conflict' ? 'sources disagree on a dimension' : ''
  return {
    size: est.sizeMm,
    note: `${fmtSize(est.sizeMm)}${est.estimated.length ? ` with ${est.estimated.join(', ')} ESTIMATED from the category footprint` : ''}${doubt ? ` (${doubt})` : ''}`,
  }
}

/** The plan's source URLs as spec sources; the first one carries `note`. The kind says what the page is (a retailer is `dealer`, never `datasheet`). */
const planSources = (row: PlanRow, note: string): SpecSourceT[] =>
  row.sources.map((url, i) => ({ kind: sourceKind(row.manufacturer, url), url, note: `equipment plan source (research grade: ${row.sourceGrade ?? row.dataQuality})${i === 0 ? `; ${note}` : ''}` }))

type ProposalPort = { portId: string; dir: 'in' | 'out' | 'bidir'; connector: string; signal: string; flags?: string[] }

/** The to-do note of a skeleton: the proposal's ports or the plan's ports summary, as TEXT. */
function portsTodoFor(row: PlanRow, proposal: Json | undefined): string {
  const how =
    'Fill `ports` with the connector set the datasheet documents (portId at most 19 characters, connector, signal, dir, face, xMm, yMm, confidence), the mains inlet as power-in, and the matching controls; then set portsDocumented true and portsSource to the page that documents it. Without portsDocumented the device cannot be promoted (it stays a Bêta proposal).'
  const props = (proposal?.ports as ProposalPort[] | undefined) ?? []
  const listed = props.length
    ? `Ports of the Bêta proposal (knowledge base, to check against the datasheet, NOT copied as ports): ${props.map((p) => `${p.portId} [${p.connector} ${p.signal} ${p.dir}]`).join('; ')}.`
    : `Plan ports summary: ${row.portsSummary.trim() || '(none)'}.`
  return `${listed} ${how}`
}

function skeletonSpec(row: PlanRow, proposal: Json | undefined): { spec: AssetSpecT; sizeNote: string } {
  const { size, note } = skeletonSize(row)
  const sources = planSources(row, `size ${note}; port and control positions are placeholders until measured`)
  const spec: AssetSpecT = AssetSpec.parse({
    id: row.id,
    kind: 'device',
    tier: 'standard',
    realSizeMm: { w: size.w, h: size.h, d: size.d },
    ports: [],
    controls: [],
    sources,
    portsTodo: portsTodoFor(row, proposal),
  })
  return { spec, sizeNote: note }
}

// ── building a device from a spec ─────────────────────────────────────────────────────────────────────────────────────

/** The spec's ports as plan ports; a port without connector, signal and direction cannot be turned into a catalogue port. */
function planPortsOf(spec: AssetSpecT): PlanPort[] {
  return spec.ports.map((p) => {
    if (p.connector === undefined || p.signal === undefined || p.dir === undefined) throw new Error(`spec port "${p.portId}" lacks its connector, signal or dir`)
    return {
      id: p.portId, role: 'port', dir: p.dir, connector: p.connector, signal: p.signal,
      ...(p.flags?.length ? { flags: p.flags } : {}),
      ...(p.thruOf ? { thruOf: p.thruOf, ...(p.thruProcessed ? { thruProcessed: true } : {}) } : {}),
      ...(p.flagsSource ? { flagsSource: p.flagsSource } : {}),
    }
  })
}

/**
 * Old proposal port id -> the spec's port that takes its place: inside each (direction, connector, signal) group the ports are paired in order
 * (channel 1 to channel 1), as many as both sides have. A pairing is a modelling call, so the report lists the aliases it wrote.
 */
function aliasesFor(proposalPorts: readonly ProposalPort[], specPorts: readonly PlanPort[]): Record<string, string> {
  // a control-network RJ45 (Wave 1b finding 9) takes the place of the Bêta proposal's `aoip` RJ45, so the old port id still maps to it
  const key = (p: { dir: string; connector: string; signal: string }): string => `${p.dir}|${p.connector}|${p.signal === 'ethernet-control' ? 'aoip' : p.signal}`
  const out: Record<string, string> = {}
  const groups = new Set(proposalPorts.map(key))
  for (const g of groups) {
    const olds = proposalPorts.filter((p) => key(p) === g)
    const news = specPorts.filter((p) => key(p) === g)
    olds.slice(0, news.length).forEach((o, i) => {
      const nid = news[i]!.id!
      if (o.portId !== nid) out[o.portId] = nid
    })
  }
  return out
}

/**
 * The model front of a loudspeaker built by our curved-cabinet or speaker-cabinet-v2 shape: the I/O face with the connector empties is at glTF +z and the baffle (woofer, tweeter) is
 * the opposite face, glTF -z, the same construction as the rebuilt Genelec 8030C. The coverage panel counts a speaker without `modelFront` as « face avant
 * non vérifiée », which would be wrong for a model whose front is fixed by construction; tests/assets/modelFront.test.ts measures it on the file.
 */
const scriptedCabinetFront = (id: string, shape: string): { axis: '-z'; evidence: string } => ({
  axis: '-z',
  evidence: `Scripted ${shape} model (public/assets/${id}.glb, our Blender builder): the I/O face with the connector and control empties is at glTF +z and the baffle with the woofer and tweeter is the opposite face, glTF -z, as on the rebuilt Genelec 8030C; measured on the file by tests/assets/modelFront.test.ts.`,
})

function buildNotes(row: PlanRow, today: string, t: Template, size: string, spec: AssetSpecT): string {
  const src = row.sources[0] ? ` Size source: ${row.sources[0]}.` : ''
  const extra = t.notes.length ? ` ${t.notes.map((n) => n.charAt(0).toUpperCase() + n.slice(1)).join('. ')}.` : ''
  // Wave 1b finding 14: the claim is per port. A port whose connector type no cited page states is named, so the notes never say more than the sources do.
  const assumed = (row.assumedConnectors ?? []).map((id) => {
    const p = spec.ports.find((x) => x.portId === id)
    return p?.connector ? `${id} (${p.connector})` : id
  })
  const ports =
    spec.portsDocumented === true
      ? `documented in the asset spec (${spec.portsSource})${assumed.length ? `, except the connector type of ${assumed.join(', ')}, assumed: no cited page states it` : ''}`
      : 'listed in the asset spec (not documented)'
  return `Built from the equipment plan (${today}); size ${size} (${row.dataQuality}, size confidence ${row.sizeConfidence}).${src} Ports: ${ports}.${extra}`
}

/**
 * The catalogue device a spec describes: documented ports from the spec, behaviour from the template (by category and traits). Throws when the
 * template would rename a spec port (the spec must already use the short ids, the mains inlet being `power-in`).
 */
export function deviceFromSpec(row: PlanRow, spec: AssetSpecT, proposal: Json | undefined, today: string, sizeNote: string): { device: CatalogDevice; template: Template; aliases?: Record<string, string> } {
  const given = planPortsOf(spec)
  const template = applyTemplate(row.category, row, given, today, spec.controls.map((c) => c.controlId), { ...(spec.powerNote ? { powerNote: spec.powerNote } : {}) })
  const specIds = spec.ports.map((p) => p.portId)
  const ids = template.ports.map((p) => p.portId)
  if (JSON.stringify(ids) !== JSON.stringify(specIds)) {
    const moved = specIds.filter((s, i) => s !== ids[i])
    throw new Error(`the spec port ids must be the catalogue ids (at most 19 characters, unique, the mains inlet named power-in): rename ${moved.map((s) => `"${s}" to "${ids[specIds.indexOf(s)] ?? shortPortId(s)}"`).join(', ')} in the spec`)
  }
  const proposalPorts = (proposal?.ports as ProposalPort[] | undefined) ?? []
  const aliases: Record<string, string> = { ...(proposalPorts.length ? aliasesFor(proposalPorts, given) : {}) }
  // a port the spec renamed (findings 8, 18, 19): the old id follows, unless it is still a port
  for (const [old, now] of Object.entries(spec.portAliases ?? {})) if (!specIds.includes(old) && specIds.includes(now)) aliases[old] = now
  const rw = proposal?.realWorld as { typicalUse?: string } | undefined
  const device = Device.parse({
    id: row.id,
    label: row.label ?? (proposal?.label as string | undefined) ?? `${row.manufacturer} ${row.product}`,
    levels: [],
    realWorld: {
      brand: row.manufacturer,
      model: row.product,
      category: row.category,
      typicalUse: row.typicalUse ?? rw?.typicalUse ?? `${row.manufacturer} ${row.product} (${row.category})`,
      notes: buildNotes(row, today, template, sizeNote, spec),
    },
    ports: template.ports,
    ...(template.controls.length ? { controls: template.controls } : {}),
    ...(template.acoustic ? { acoustic: template.acoustic } : {}),
    ...((template.kind === 'speaker-active' || template.kind === 'speaker-passive') && (spec.build?.shape === 'curved-cabinet' || spec.build?.shape === 'speaker-cabinet-v2') ? { modelFront: scriptedCabinetFront(row.id, spec.build.shape) } : {}),
    ...(template.routing ? { routing: template.routing } : {}),
    ...(Object.keys(aliases).length ? { portAliases: aliases } : {}),
  })
  return { device, template, ...(Object.keys(aliases).length ? { aliases } : {}) }
}

/**
 * The ports of a kept Bêta proposal with the flags the SPEC declares for the same port id added (Wave 2-5 gate: the spec parity test found a proposal whose spec
 * says isDantePrimary). A proposal never carries isMainsSource (verified data only); no flag is removed and no port is added or renamed (saved projects keep
 * their cables).
 */
export function mergeSpecFlags(proposalPorts: readonly ProposalPort[], specPorts: readonly PlanPort[], documented = false): ProposalPort[] {
  return proposalPorts.map((p) => {
    const sp = specPorts.find((s) => s.id === p.portId)
    // Waves 2 to 5 review, finding 3: a phantom flag is a CAPABILITY claim. It crosses to a proposal only from a spec whose ports are documented (portsDocumented) or from a port that
    // names its page (flagsSource): a Bêta spec whose connector set is not documented never puts a phantom supply on a proposal.
    const cited = documented || sp?.flagsSource !== undefined
    const add = (sp?.flags ?? []).filter((f) => f !== 'isMainsSource' && !(p.flags ?? []).includes(f) && (cited || !CAPABILITY_FLAGS.includes(f)))
    let q: ProposalPort = add.length ? { ...p, flags: [...(p.flags ?? []), ...add] } : p
    // the port id says it is AES50 / a USB control link (structure, not capability): the spec's signal wins (findings 9 and 11)
    if (sp && SPEC_TYPED_SIGNALS.has(sp.signal) && q.signal !== sp.signal) q = { ...q, signal: sp.signal }
    return q
  })
}

/** The flags that state what a manufacturer sheet must support: a phantom supply or need. */
export const CAPABILITY_FLAGS: readonly string[] = ['providesPhantom', 'requiresPhantom']
/** Signals a spec may retype on a Bêta proposal port (the port id says AES50, or a USB control link). */
const SPEC_TYPED_SIGNALS: ReadonlySet<string> = new Set(['aes50', 'usb-control'])

/** A Bêta proposal entry for a new row from the spec's ports (patch-only: no controls, routing or acoustic, never a mains source). */
function proposalFromSpec(row: PlanRow, spec: AssetSpecT, today: string, sizeNote: string): Json {
  const ports = planPortsOf(spec).map((p) => {
    const cited = spec.portsDocumented === true || p.flagsSource !== undefined
    const kept = (p.flags ?? []).filter((f) => f !== 'isMainsSource' && (cited || !CAPABILITY_FLAGS.includes(f)))
    return { portId: p.id!, dir: p.dir, connector: p.connector, signal: p.signal, ...(kept.length ? { flags: kept } : {}) }
  })
  const entry = {
    id: row.id,
    label: `${row.manufacturer} ${row.product}`,
    levels: [],
    realWorld: {
      brand: row.manufacturer,
      model: row.product,
      category: row.category,
      typicalUse: row.typicalUse ?? `${row.manufacturer} ${row.product} (${row.category})`,
      notes: `PROPOSITION (${today}) built from the equipment plan: size ${sizeNote} (${row.dataQuality}, size confidence ${row.sizeConfidence}); ports from the asset spec${spec.portsDocumented === true ? ` (documented: ${spec.portsSource})` : ' (not documented)'}.`,
    },
    ports,
    sizeMm: planSize(row),
  }
  const check = Device.safeParse(entry)
  if (!check.success) throw new Error(`the proposal entry is invalid: ${check.error.issues[0]?.path.join('.')} ${check.error.issues[0]?.message}`)
  return entry
}

// ── outcome decision, shared by stage 2 and the pipeline's catalogue view ────────────────────────────────────────────────

/** Why a staged row cannot be promoted into the verified catalogue (empty = it can). */
export function promotionBlockers(row: PlanRow, spec: AssetSpecT): string[] {
  const why: string[] = []
  if (!isPromotable(row)) why.push(`the size is ${row.dataQuality} (size confidence ${row.sizeConfidence}): only a datasheet or dealer size with confidence ok is promoted`)
  if (isPromotable(row) && !row.sources.length) why.push('no source URL is recorded for the size')
  if (spec.portsDocumented !== true) why.push('the spec does not say portsDocumented: true (the connector set is not documented)')
  // per port (Wave 1b finding 14): an assumed connector may stay only on a port that carries no audio (a mains inlet, a control network port)
  for (const id of row.assumedConnectors ?? []) {
    const p = spec.ports.find((x) => x.portId === id)
    if (!p) why.push(`the plan lists "${id}" as an assumed connector but the spec has no such port`)
    else if (p.signal !== 'mains-power' && p.signal !== 'ethernet-control') why.push(`the connector type of the audio port "${id}" is assumed (no cited page states it): only a mains inlet or a control port may be assumed in a promoted device`)
  }
  if (isPromotable(row)) {
    const r = spec.realSizeMm
    const p = row.sizeMm
    if (Math.abs(r.w - (p.w ?? 0)) > 0.05 || Math.abs(r.d - (p.d ?? 0)) > 0.05 || Math.abs(r.h - (p.h ?? 0)) > 0.05)
      why.push(`the spec size ${r.w} x ${r.d} x ${r.h} differs from the plan size ${p.w} x ${p.d} x ${p.h}: a promoted size is the plan's`)
  }
  return why
}

// ── the tool ──────────────────────────────────────────────────────────────────────────────────────────────────────────

function loadJournal(path: string): Journal {
  return existsSync(path) ? readJson<Journal>(path) : { version: 1, entries: {} }
}

function readSpecFile(dir: string, id: string): AssetSpecT {
  const path = join(dir, `${id}.json`)
  if (!existsSync(path)) throw new Error(`no asset spec at ${path}: run \`npm run promote -- ${id}\` (stage 1) first`)
  const parsed = AssetSpec.safeParse(readJson(path))
  if (!parsed.success) throw new Error(`asset spec ${id}.json: ${parsed.error.issues[0]?.path.join('.') || '(root)'}: ${parsed.error.issues[0]?.message}`)
  return parsed.data
}

export function promoteDevice(id: string, opts: PromoteOptions = {}): PromotionResult {
  const paths: Paths = { ...DEFAULT_PATHS, ...opts.paths }
  const today = opts.today ?? new Date().toISOString().slice(0, 10)
  const rows = loadPlan(paths.plan)
  const row = rows.find((r) => r.id === id)
  if (!row) throw new Error(`promote: "${id}" is not a row of the equipment plan`)
  const blocked = (reason: string): PromotionResult => ({ id, outcome: 'blocked', changes: [], reason })
  const withPlan = (patch: Partial<PlanRow>, drop: (keyof PlanRow)[] = []): PlanRow[] =>
    rows.map((r) => {
      if (r.id !== id) return r
      const next = { ...r, ...patch } as Record<string, unknown>
      for (const k of drop) delete next[k]
      return next as PlanRow
    })
  const commit = (writes: Write[], result: PromotionResult): PromotionResult => {
    if (!opts.dryRun) applyWrites(writes, opts.beforeRename)
    return result
  }
  const planWrite = (next: PlanRow[]): Write => {
    const file = { version: 1 as const, generated: readJson<{ generated: string }>(paths.plan).generated, rows: next }
    parsePlan(file) // a bad edit never reaches the disk
    return { path: paths.plan, content: stringify(file) }
  }

  if (opts.revert) return revert()
  if (opts.regen) return regen()

  if (opts.commit) return stage2()
  return stage1()

  // ── stage 1 ────────────────────────────────────────────────────────────────────────────────────────────────────────
  function stage1(): PromotionResult {
    if (row!.promoted === true) return { id, outcome: 'promoted', changes: [], reason: 'already promoted: nothing to do' }
    if (row!.betaModelled === true) return { id, outcome: 'beta-modelled', changes: [], reason: 'already beta-modelled: nothing to do' }
    if (row!.staged === true) return { id, outcome: 'staged', changes: [], reason: 'already staged: nothing to do (fill the spec, then `--commit` once the GLB shipped)' }
    if (row!.dataQuality === 'missing') return blocked(`dataQuality is missing for ${id}: no size to build from (a datasheet pass is needed first)`)
    const catalog = Catalog.parse(readJson(paths.catalog))
    if (catalog.devices.some((d) => d.id === id)) throw new Error(`promote: "${id}" is already in content/catalog.json but its plan row is not flagged promoted (id collision): fix the plan by hand`)
    const proposalFile = existsSync(paths.proposals) ? readJson<ProposalFile>(paths.proposals) : undefined
    const proposal = proposalFile?.devices.find((d) => d.id === id)
    if (row!.status === 'new' && proposal) throw new Error(`promote: "${id}" is a new plan row but already a proposal (id collision): fix the plan or the proposals by hand`)
    if (isPromotable(row!) && !row!.sources.length) return blocked(`${id}: no source URL recorded for the size: add one to the plan row before promoting`)
    if (isPromotable(row!) && !isFullSize(row!.sizeMm)) return blocked(`${id}: ${row!.dataQuality} grade but the size is not complete (w, d, h): fix the plan row`)

    const { spec, sizeNote } = skeletonSpec(row!, proposal)
    const specPath = join(paths.specDir, `${id}.json`)
    const writes: Write[] = []
    const changes: string[] = []
    if (existsSync(specPath)) changes.push(`spec: content/asset-specs/${id}.json already exists and is kept (a hand-filled spec wins)`)
    else {
      writes.push({ path: specPath, content: JSON.stringify(spec, null, 2) + '\n' })
      changes.push(`spec: write content/asset-specs/${id}.json (${sizeNote}; no ports yet: portsTodo says what to document)`)
    }
    writes.push(planWrite(withPlan({ staged: true })))
    changes.push(`plan: ${id} staged (the catalogue and the proposals file are not touched until --commit)`)
    return commit(writes, { id, outcome: 'staged', changes })
  }

  // ── stage 2 ────────────────────────────────────────────────────────────────────────────────────────────────────────
  function stage2(): PromotionResult {
    if (row!.promoted === true) return { id, outcome: 'promoted', changes: [], reason: 'already promoted: nothing to do' }
    if (row!.betaModelled === true) return { id, outcome: 'beta-modelled', changes: [], reason: 'already beta-modelled: nothing to do' }
    if (row!.staged !== true) return blocked(`${id} is not staged: run \`npm run promote -- ${id}\` (stage 1), fill the spec and ship the GLB first`)
    const spec = readSpecFile(paths.specDir, id)
    // the model must have shipped: a manifest row and the file
    const manifest = existsSync(paths.manifest) ? readJson<{ assets?: { id: string; kind?: string }[] }>(paths.manifest) : { assets: [] }
    const mrow = (manifest.assets ?? []).find((a) => a.id === id)
    if (!mrow) return blocked(`${id} has no row in the asset manifest: build and ship its GLB (asset:build --ship) before --commit`)
    if (!existsSync(join(paths.assetsDir, `${id}.glb`))) return blocked(`public/assets/${id}.glb does not exist: ship the model before --commit`)

    const catalogText = readFileSync(paths.catalog, 'utf8')
    const catalog = Catalog.parse(JSON.parse(catalogText))
    if (catalog.devices.some((d) => d.id === id)) throw new Error(`promote: "${id}" is already in content/catalog.json but its plan row is not flagged promoted (id collision): fix the plan by hand`)
    const proposalFile = existsSync(paths.proposals) ? readJson<ProposalFile>(paths.proposals) : undefined
    const proposalIndex = proposalFile ? proposalFile.devices.findIndex((d) => d.id === id) : -1
    const proposal = proposalIndex >= 0 ? proposalFile!.devices[proposalIndex] : undefined
    const journal = loadJournal(paths.journal)
    const blockers = promotionBlockers(row!, spec)
    const { note: sizeNote } = isPromotable(row!) ? { note: fmtSize(spec.realSizeMm) } : skeletonSize(row!)

    if (!blockers.length) {
      // promoted: the catalogue entry from the documented ports
      const { device, template, aliases } = deviceFromSpec(row!, spec, proposal, today, sizeNote)
      const nextText = appendDevice(catalogText, device)
      const next = Catalog.parse(JSON.parse(nextText))
      const hard = checkCatalog(next, { modelIds: new Set(next.devices.map((d) => d.id)) }).filter((i) => i.level === 'error')
      if (hard.length) throw new Error(`promote ${id}: the generated device fails the catalogue checks:\n  ${hard.map((i) => `${i.path}: ${i.message}`).join('\n  ')}`)
      const parity = checkSpecParity(spec, next)
      if (parity.length) return blocked(`the spec does not match the catalogue entry it would produce (add the controls the template writes, with positions):\n  ${parity.join('\n  ')}`)
      const writes: Write[] = [{ path: paths.catalog, content: nextText }]
      const changes = [`catalog: add devices["${id}"] (${device.ports.length} ports from the documented set, ${(device.controls ?? []).length} control(s), category ${row!.category}, template ${template.kind})`]
      if (aliases) changes.push(`catalog: portAliases ${JSON.stringify(aliases)} (saved cables to the old Bêta port ids follow)`)
      if (proposalFile && proposal) {
        writes.push({ path: paths.proposals, content: stringify({ ...proposalFile, devices: proposalFile.devices.filter((d) => d.id !== id) }) })
        changes.push(`proposals: remove ${id}`)
      }
      writes.push({ path: paths.journal, content: stringify({ ...journal, entries: { ...journal.entries, [id]: { outcome: 'promoted', proposalBefore: proposal ?? null, proposalIndex: proposal ? proposalIndex : null } } }) })
      writes.push(planWrite(withPlan({ promoted: true }, ['staged'])))
      changes.push(`plan: ${id} promoted`)
      return commit(writes, { id, outcome: 'promoted', changes, ...(template.issues.length ? { issues: template.issues } : {}) })
    }

    // beta-modelled: the device stays a proposal
    if (!proposalFile) throw new Error(`promote: no proposals file at ${paths.proposals}`)
    let entry: Json
    const changes: string[] = []
    if (proposal) {
      const specIds = new Set(spec.ports.map((p) => p.portId))
      const propIds = ((proposal.ports as ProposalPort[]) ?? []).map((p) => p.portId)
      const missing = propIds.filter((p) => !specIds.has(p))
      const extra = [...specIds].filter((p) => !propIds.includes(p))
      if (missing.length || extra.length)
        return blocked(`a beta-modelled device keeps its proposal ports (saved projects keep their cables): the spec ports must be exactly ${propIds.join(', ')}${missing.length ? ` (missing ${missing.join(', ')})` : ''}${extra.length ? ` (extra ${extra.join(', ')})` : ''}`)
      entry = { ...proposal, sizeMm: planSize(row!), ports: mergeSpecFlags(proposal.ports as ProposalPort[], planPortsOf(spec), spec.portsDocumented === true) }
      changes.push(`proposals: update ${id} (sizeMm from the plan, port ids unchanged: saved projects keep their cables; the flags the spec declares are added)`)
    } else {
      if (!spec.ports.length) return blocked(`the spec of ${id} lists no ports: a Bêta proposal needs at least the ports that are documented; fill the spec first`)
      try {
        entry = proposalFromSpec(row!, spec, today, sizeNote)
      } catch (e) {
        return blocked(e instanceof Error ? e.message : String(e))
      }
      changes.push(`proposals: add ${id} (${spec.ports.length} ports from the spec, patch-only, badge Bêta)`)
    }
    const nextFile: ProposalFile = { ...proposalFile, devices: proposal ? proposalFile.devices.map((d) => (d.id === id ? entry : d)) : [...proposalFile.devices, entry] }
    const writes: Write[] = [
      { path: paths.proposals, content: stringify(nextFile) },
      { path: paths.journal, content: stringify({ ...journal, entries: { ...journal.entries, [id]: { outcome: 'beta-modelled', proposalBefore: proposal ?? null, proposalIndex: proposal ? proposalIndex : null } } }) },
      planWrite(withPlan({ betaModelled: true }, ['staged'])),
    ]
    changes.push(`plan: ${id} beta-modelled (${blockers.join('; ')})`)
    return commit(writes, { id, outcome: 'beta-modelled', changes, reason: blockers.join('; ') })
  }

  // ── revert ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  function regen(): PromotionResult {
    if (row!.betaModelled === true) return regenBeta()
    if (row!.promoted !== true) return blocked(`${id} is not promoted: --regen only re-derives a device that is already in the catalogue`)
    const spec = readSpecFile(paths.specDir, id)
    const catalogText = readFileSync(paths.catalog, 'utf8')
    const catalog = Catalog.parse(JSON.parse(catalogText))
    const current = catalog.devices.find((d) => d.id === id)
    if (!current) throw new Error(`promote --regen: "${id}" is flagged promoted but is not in content/catalog.json`)
    const blockers = promotionBlockers(row!, spec)
    if (blockers.length) return blocked(`${id} no longer meets the promotion rules with its spec: ${blockers.join('; ')}`)
    const entry = loadJournal(paths.journal).entries[id]
    // deterministic (finding 19): the date the entry already carries, else the plan's own date: never the clock
    const built = /\((\d{4}-\d{2}-\d{2})\)/.exec(current.realWorld.notes ?? '')?.[1] ?? readJson<{ generated: string }>(paths.plan).generated
    const { device, template } = deviceFromSpec(row!, spec, (entry?.proposalBefore ?? undefined) as Json | undefined, built, fmtSize(spec.realSizeMm))
    const nextText = replaceDevice(catalogText, id, device)
    if (nextText === catalogText) return { id, outcome: 'promoted', changes: [], reason: 'regen: the entry is already what the spec and the templates give' }
    const next = Catalog.parse(JSON.parse(nextText))
    const hard = checkCatalog(next, { modelIds: new Set(next.devices.map((d) => d.id)) }).filter((i) => i.level === 'error')
    if (hard.length) throw new Error(`promote --regen ${id}: the regenerated device fails the catalogue checks:\n  ${hard.map((i) => `${i.path}: ${i.message}`).join('\n  ')}`)
    const parity = checkSpecParity(spec, next)
    if (parity.length) return blocked(`the spec does not match the regenerated entry:\n  ${parity.join('\n  ')}`)
    return commit([{ path: paths.catalog, content: nextText }], { id, outcome: 'promoted', changes: [`catalog: regenerate devices["${id}"] in place from its spec and the templates`], ...(template.issues.length ? { issues: template.issues } : {}) })
  }

  /** --regen of a beta-modelled row: re-merge the spec's port flags into its proposal (nothing else changes). */
  function regenBeta(): PromotionResult {
    const spec = readSpecFile(paths.specDir, id)
    const proposalFile = existsSync(paths.proposals) ? readJson<ProposalFile>(paths.proposals) : undefined
    const proposal = proposalFile?.devices.find((d) => d.id === id)
    if (!proposalFile || !proposal) return blocked(`${id} is beta-modelled but has no proposal`)
    // The base is the proposal as it was BEFORE stage 2 (the journal), so a flag a later rule refuses is removed, not just never added; a new row has no such base and
    // takes its ports from the spec.
    const base = loadJournal(paths.journal).entries[id]?.proposalBefore?.ports as ProposalPort[] | undefined
    const ports = base
      ? mergeSpecFlags(base, planPortsOf(spec), spec.portsDocumented === true)
      : (proposalFromSpec(row!, spec, readJson<{ generated: string }>(paths.plan).generated, '').ports as ProposalPort[])
    if (JSON.stringify(ports) === JSON.stringify(proposal.ports)) return { id, outcome: 'beta-modelled', changes: [], reason: 'regen: the proposal already carries the spec flags' }
    const next: ProposalFile = { ...proposalFile, devices: proposalFile.devices.map((d) => (d.id === id ? { ...d, ports } : d)) }
    return commit([{ path: paths.proposals, content: stringify(next) }], { id, outcome: 'beta-modelled', changes: [`proposals: re-derive the port flags and signals of ${id} from its spec`] })
  }

  function revert(): PromotionResult {
    const journal = loadJournal(paths.journal)
    const entry = journal.entries[id]
    const dropEntry = (): Journal => {
      const entries = { ...journal.entries }
      delete entries[id]
      return { ...journal, entries }
    }
    if (row!.promoted === true || row!.betaModelled === true) {
      const writes: Write[] = []
      const changes: string[] = []
      const proposalFile = existsSync(paths.proposals) ? readJson<ProposalFile>(paths.proposals) : undefined
      if (row!.promoted === true) {
        writes.push({ path: paths.catalog, content: removeDevice(readFileSync(paths.catalog, 'utf8'), id) })
        changes.push(`catalog: remove devices["${id}"]`)
        if (entry?.proposalBefore && proposalFile) {
          const list = proposalFile.devices.filter((d) => d.id !== id)
          list.splice(Math.min(entry.proposalIndex ?? list.length, list.length), 0, entry.proposalBefore)
          writes.push({ path: paths.proposals, content: stringify({ ...proposalFile, devices: list }) })
          changes.push(`proposals: restore ${id} from the journal`)
        } else if (row!.status === 'beta') changes.push(`proposals: no journal entry for ${id}: run \`npm run sync:kb\` to regenerate its proposal`)
      } else if (proposalFile) {
        const list = proposalFile.devices.filter((d) => d.id !== id)
        if (entry?.proposalBefore) list.splice(Math.min(entry.proposalIndex ?? list.length, list.length), 0, entry.proposalBefore)
        writes.push({ path: paths.proposals, content: stringify({ ...proposalFile, devices: list }) })
        changes.push(entry?.proposalBefore ? `proposals: restore ${id} as it was before the commit` : `proposals: remove ${id} (it was added by the commit)`)
      }
      writes.push({ path: paths.journal, content: stringify(dropEntry()) })
      writes.push(planWrite(withPlan({ staged: true }, [row!.promoted === true ? 'promoted' : 'betaModelled'])))
      changes.push(`plan: ${id} back to staged (the spec is kept)`)
      return commit(writes, { id, outcome: 'reverted', changes })
    }
    if (row!.staged === true) {
      const specPath = join(paths.specDir, `${id}.json`)
      const changes: string[] = []
      const writes: Write[] = []
      if (existsSync(specPath)) {
        const proposalFile = existsSync(paths.proposals) ? readJson<ProposalFile>(paths.proposals) : undefined
        const untouched = JSON.stringify(readJson(specPath)) === JSON.stringify(skeletonSpec(row!, proposalFile?.devices.find((d) => d.id === id)).spec)
        if (untouched || opts.discardSpec) {
          writes.push({ path: specPath, content: null })
          changes.push(`spec: remove content/asset-specs/${id}.json${untouched ? '' : ' (hand edits discarded)'}`)
        } else changes.push(`spec: content/asset-specs/${id}.json has hand edits and is kept (delete it by hand, or pass --discard-spec)`)
      }
      writes.push(planWrite(withPlan({}, ['staged'])))
      changes.push(`plan: ${id} no longer staged`)
      return commit(writes, { id, outcome: 'reverted', changes })
    }
    return { id, outcome: 'reverted', changes: [], reason: 'nothing to revert: the row is neither staged nor promoted nor beta-modelled' }
  }
}

// ── the pipeline's view of a staged device ───────────────────────────────────────────────────────────────────────────────

/**
 * The devices of the rows that are STAGED (stage 1 done, stage 2 not yet), as the catalogue or the proposals would hold them after `--commit`, so
 * that the asset pipeline's parity check (spec ports and controls against the catalogue) passes between the stages:
 *  - a row that would be promoted (promotionBlockers is empty): the catalogue device built from the spec; it REPLACES the same id in the proposals;
 *  - a new row that would be beta-modelled: the proposal entry built from the spec's ports (patch-only);
 *  - a Bêta row that would stay a proposal: nothing (its proposal already is what the pipeline checks).
 * A row whose spec is missing, unparsable or lacks connector / signal / dir on its ports is left out, so the parity check says « not in catalog.devices ».
 */
export function stagedDevices(paths: Partial<Paths> = {}, today: string = new Date().toISOString().slice(0, 10)): { devices: CatalogDevice[] } {
  const p: Paths = { ...DEFAULT_PATHS, ...paths }
  if (!existsSync(p.plan)) return { devices: [] }
  const proposalFile = existsSync(p.proposals) ? readJson<ProposalFile>(p.proposals) : undefined
  const out: CatalogDevice[] = []
  for (const row of loadPlan(p.plan).filter((r) => r.staged === true && r.promoted !== true && r.betaModelled !== true)) {
    try {
      const spec = readSpecFile(p.specDir, row.id)
      const proposal = proposalFile?.devices.find((d) => d.id === row.id)
      const { note } = isPromotable(row) ? { note: fmtSize(spec.realSizeMm) } : skeletonSize(row)
      if (!promotionBlockers(row, spec).length) out.push(deviceFromSpec(row, spec, proposal, today, note).device)
      else if (!proposal && spec.ports.length) out.push(Device.parse(proposalFromSpec(row, spec, today, note)))
    } catch {
      /* an unfinished spec: the parity check reports it */
    }
  }
  return { devices: out }
}
