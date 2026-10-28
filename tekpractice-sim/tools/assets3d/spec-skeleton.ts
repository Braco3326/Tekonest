/**
 * assets3d/spec-skeleton: `npm run asset:spec -- <id> [--force]` writes content/asset-specs/<id>.json.
 *
 * The skeleton is a starting point for a human, not a finished spec:
 *  - the port and control ids come from the catalog (so checkSpecParity passes), every coordinate is 0 and every port is marked
 *    confidence 'photo' until someone reads the real position off the manual or a photo
 *  - realSizeMm is parsed from knowledge-base/equipment/*.json key_specs.dimensions when the axes are labelled (W/H/D) and metric;
 *    otherwise it stays 0 x 0 x 0 and the CLI says so. Zero sizes fail the AssetSpec schema, so loadSpecs refuses an unfinished skeleton
 *  - an existing spec is never overwritten unless `--force` is passed
 * A connector id (catalog.connectorTypes) gets a connector skeleton: no ports, no controls, a mating role from its gender.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CatalogT } from '../schemas'
import { DEFAULT_SPEC_DIR } from './loadSpecs'
import type { AssetSpecT, SpecSourceT } from './specSchema'

type SizeMm = AssetSpecT['realSizeMm']

const here = dirname(fileURLToPath(import.meta.url))
const DEFAULT_KB_DIR = resolve(here, '..', '..', '..', 'knowledge-base', 'equipment')
const CATALOG_PATH = resolve(here, '..', '..', 'content', 'catalog.json')

const NUM = '(\\d+(?:\\.\\d+)?)'
const AXIS: Record<string, keyof SizeMm> = { w: 'w', l: 'w', h: 'h', d: 'd', p: 'd' }

function complete(found: Partial<SizeMm>): SizeMm | null {
  const { w, h, d } = found
  return w !== undefined && h !== undefined && d !== undefined && w > 0 && h > 0 && d > 0 ? { w, h, d } : null
}

/**
 * Width / height / depth in millimetres from a KB dimension string, or null when it cannot be read with certainty:
 * the axes must be labelled (W 468mm, 482.6 (W), Height 104mm, or "A x B x C mm" followed or preceded by a label group
 * such as (H x W x D)) and metric. An unlabelled "A x B x C" is never guessed.
 */
export function parseDimensionsMm(text: string | undefined): SizeMm | null {
  if (!text) return null

  // 1. prefix letter: "W 468mm x H 272mm x D 562mm"
  const prefix: Partial<SizeMm> = {}
  for (const m of text.matchAll(new RegExp(`\\b([WHD])\\s*${NUM}\\s*mm`, 'g'))) prefix[AXIS[m[1].toLowerCase()]] ??= Number(m[2])
  if (complete(prefix)) return complete(prefix)

  // 2. number then letter: "482.6 (W) x 230 (D) x 44 (H) mm"
  const suffix: Partial<SizeMm> = {}
  for (const m of text.matchAll(new RegExp(`${NUM}\\s*\\(([WHDLP])\\)`, 'g'))) suffix[AXIS[m[2].toLowerCase()]] ??= Number(m[1])
  if (complete(suffix)) return complete(suffix)

  // 3. words: "Height 104mm / 4.1", Width 220mm / 8.7", Depth 290mm / 11.4""
  const words: Partial<SizeMm> = {}
  for (const m of text.matchAll(new RegExp(`\\b(height|width|depth)\\D*?${NUM}\\s*mm`, 'gi')))
    words[AXIS[m[1][0].toLowerCase()]] ??= Number(m[2])
  if (complete(words)) return complete(words)

  // 4. "A x B x C mm" with a label group "(H x W x D)" anywhere in the string
  const triple = text.match(new RegExp(`${NUM}\\s*[x×]\\s*${NUM}\\s*[x×]\\s*${NUM}\\s*mm`, 'i'))
  const labels = text.match(/\(\s*([A-Za-z])\s*[x×/]\s*([A-Za-z])\s*[x×/]\s*([A-Za-z])\b/)
  if (triple && labels) {
    const axes = [labels[1], labels[2], labels[3]].map((l) => AXIS[l.toLowerCase()])
    if (axes.every((a) => a !== undefined) && new Set(axes).size === 3) {
      const found: Partial<SizeMm> = {}
      axes.forEach((axis, i) => { found[axis] = Number(triple[i + 1]) })
      return complete(found)
    }
  }
  return null
}

/** The KB entry of a device: its dimension string and the best source it carries. */
export interface KbEntry {
  file: string
  dimensions: string | undefined
  sources: SpecSourceT[]
}

/** Looks `id` up in every knowledge-base/equipment/*.json (arrays under `devices`). */
export function findKbEntry(id: string, kbDir: string = DEFAULT_KB_DIR): KbEntry | null {
  if (!existsSync(kbDir)) return null
  for (const file of readdirSync(kbDir).filter((f) => f.endsWith('.json')).sort()) {
    const doc: unknown = JSON.parse(readFileSync(resolve(kbDir, file), 'utf8'))
    const devices = (doc as { devices?: unknown }).devices
    if (!Array.isArray(devices)) continue
    const entry = devices.find((e: { id?: unknown }) => e?.id === id) as Record<string, any> | undefined
    if (!entry) continue
    const dimensions: string | undefined = typeof entry.key_specs?.dimensions === 'string' ? entry.key_specs.dimensions : undefined
    const sources: SpecSourceT[] = []
    const note = `knowledge-base/equipment/${file} key_specs.dimensions${dimensions ? `: "${dimensions}"` : ' (absent)'}`
    if (typeof entry.datasheet_url === 'string' && entry.datasheet_url) sources.push({ kind: 'datasheet', url: entry.datasheet_url, note })
    else if (typeof entry.manual_url === 'string' && entry.manual_url) sources.push({ kind: 'manual', url: entry.manual_url, note })
    else if (typeof entry.product_page_url === 'string' && entry.product_page_url) sources.push({ kind: 'datasheet', url: entry.product_page_url, note: `${note} (product page)` })
    return { file, dimensions, sources }
  }
  return null
}

/** A skeleton spec for `id`: catalog ids, `size` (or 0 x 0 x 0), zeroed coordinates. Throws when `id` is neither a device nor a connector type. */
export function buildSkeleton(id: string, catalog: CatalogT, size: SizeMm | null, sources: SpecSourceT[]): AssetSpecT {
  const realSizeMm = size ?? { w: 0, h: 0, d: 0 }
  const device = catalog.devices.find((d) => d.id === id)
  if (device) {
    return {
      id,
      kind: 'device',
      tier: 'standard',
      realSizeMm,
      ports: device.ports.map((p) => ({ portId: p.portId, face: 'io' as const, xMm: 0, yMm: 0, confidence: 'photo' as const })),
      controls: (device.controls ?? []).map((c) => ({
        controlId: c.id,
        kind: c.type === 'toggle' ? ('switch' as const) : ('knob' as const),
        face: 'top' as const,
        xMm: 0,
        yMm: 0,
        axis: 'y' as const,
        sizeMm: { w: 0, h: 0, d: 0 },
      })),
      sources,
    }
  }
  const connector = catalog.connectorTypes.find((c) => c.id === id)
  if (connector) {
    const role = connector.gender === 'male' ? 'plug' : connector.gender === 'female' ? 'socket' : undefined
    return { id, kind: 'connector', tier: 'connector', realSizeMm, ports: [], controls: [], ...(role ? { mating: { role } } : {}), sources }
  }
  throw new Error(`"${id}" is neither a catalog device nor a catalog connector type`)
}

export interface WriteDeps {
  catalog: CatalogT
  specDir?: string
  kbDir?: string
}

/** Builds and writes content/asset-specs/<id>.json. Refuses to overwrite an existing file unless `force`. Returns the path and what was found. */
export function writeSkeleton(id: string, deps: WriteDeps, force = false): { path: string; spec: AssetSpecT; sizeFound: boolean } {
  const specDir = deps.specDir ?? DEFAULT_SPEC_DIR
  const path = resolve(specDir, `${id}.json`)
  if (existsSync(path) && !force) throw new Error(`${path} already exists; pass --force to overwrite it`)
  const kb = findKbEntry(id, deps.kbDir)
  const size = parseDimensionsMm(kb?.dimensions)
  const spec = buildSkeleton(id, deps.catalog, size, size && kb ? kb.sources : [])
  mkdirSync(specDir, { recursive: true })
  writeFileSync(path, JSON.stringify(spec, null, 2) + '\n')
  return { path, spec, sizeFound: size !== null }
}

/** CLI entry: `<id> [--force]`. JSON on stdout, notes on stderr. */
function main(argv: string[]): number {
  const force = argv.includes('--force')
  const id = argv.find((a) => !a.startsWith('--'))
  if (!id) {
    console.error('usage: npm run asset:spec -- <id> [--force]')
    return 2
  }
  try {
    const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as CatalogT
    const { path, spec, sizeFound } = writeSkeleton(id, { catalog }, force)
    console.log(JSON.stringify(spec, null, 2))
    console.error(`wrote ${path}`)
    if (!sizeFound) console.error('realSizeMm is 0 x 0 x 0: no labelled metric dimensions in the knowledge base, fill it in by hand')
    return 0
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)))
