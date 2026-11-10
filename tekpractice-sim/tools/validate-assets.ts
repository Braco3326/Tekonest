/**
 * validate-assets: measures every shipped GLB in public/assets against its asset spec (content/asset-specs/<id>.json).
 *
 *   npm run validate:assets [-- --assets <dir>] [--specs <dir>]
 *
 * Per id (union of the top-level `<id>.glb` files and the `<id>.json` specs, sorted):
 *  - a GLB without a spec is `unmigrated`: info only, never a failure, so the old models keep shipping
 *  - a spec and a GLB WITHOUT the `tekpractice` extras on its root is `pending`: a legacy model that predates the
 *    pipeline (the spec exists, the rebuild has not shipped yet). Info only, never a failure
 *  - a spec and a GLB WITH the extras (built by the pipeline): the shipped bytes are inspected, then the five asset gates plus `textures` and `validator` run (the
 *    final-bytes set build-asset runs on the file it ships); `failed` when any result is not ok. checkConnectorFit (plug / socket
 *    pairs) is out of scope here
 *  - a spec without a GLB is `failed` (gate `missing-glb`): a spec means the asset is supposed to be migrated
 *  - an unreadable or invalid spec (gate `spec`) or an unreadable GLB (gate `glb`) fails that entry only
 * Only the top level of the assets folder is read: environments/ and thumbnails are ignored. A missing folder is empty.
 * Prints `id  status  detail` rows, then `N ok, M failed, K pending, L unmigrated`; exit code 1 when any entry failed.
 */
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkTextures, checkValidator, declaredGates, runGates } from './assets3d/gates'
import type { GateResult } from './assets3d/gates'
import { inspectGlb } from './assets3d/inspect'
import { DEFAULT_SPEC_DIR } from './assets3d/loadSpecs'
import { isMainModule } from './assets3d/mainModule'
import { buildPlacement } from './assets3d/placement'
import { AssetSpec } from './assets3d/specSchema'
import { validateGltf } from './assets3d/validateGltf'
import type { AssetSpecT } from './assets3d/specSchema'

export type AssetStatus = 'ok' | 'failed' | 'pending' | 'unmigrated'

export interface AssetValidation {
  id: string
  status: AssetStatus
  results: GateResult[]
}

/** Repo root (tekpractice-sim/), one folder above this file. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_ASSETS_DIR = join(REPO_ROOT, 'public', 'assets')

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))
const fail = (gate: string, detail: string): GateResult => ({ gate, ok: false, detail })

/** The file names of `dir` ending in `ext` (top level, files only), sorted; a missing folder is empty. */
async function listFiles(dir: string, ext: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true })
  return entries.filter((e) => e.isFile() && e.name.endsWith(ext)).map((e) => e.name).sort()
}

/** Reads and parses one spec file. Throws with a readable message on bad JSON, a bad shape or an id that is not the file name. */
async function readSpec(file: string): Promise<AssetSpecT> {
  let raw: unknown
  try {
    raw = JSON.parse(await readFile(file, 'utf8'))
  } catch (e) {
    throw new Error(`cannot read ${basename(file)}: ${message(e)}`)
  }
  const parsed = AssetSpec.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new Error(`invalid ${basename(file)}: ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  }
  if (parsed.data.id !== basename(file, '.json')) throw new Error(`invalid ${basename(file)}: id "${parsed.data.id}" does not match the file name`)
  return parsed.data
}

/** True when a root's extras carry the pipeline's `tekpractice` object (written by fixup.py on every built GLB). */
function hasPipelineExtras(extras: unknown): boolean {
  if (extras === null || typeof extras !== 'object') return false
  const t = (extras as Record<string, unknown>).tekpractice
  return t !== null && typeof t === 'object'
}

/** Validates one id; never throws. */
async function validateOne(id: string, glbFile: string | undefined, specFile: string | undefined): Promise<AssetValidation> {
  if (specFile === undefined) return { id, status: 'unmigrated', results: [] }
  let spec: AssetSpecT
  try {
    spec = await readSpec(specFile)
  } catch (e) {
    return { id, status: 'failed', results: [fail('spec', message(e))] }
  }
  if (glbFile === undefined) {
    return { id, status: 'failed', results: [fail('missing-glb', `${id}.glb is not in the assets folder, but a spec exists for ${id}`)] }
  }
  let results: GateResult[]
  try {
    const bytes = new Uint8Array(await readFile(glbFile))
    const report = await inspectGlb(bytes)
    // A legacy GLB (no pipeline extras) is not measured against the new spec: its rebuild is pending.
    if (!hasPipelineExtras(report.extras)) return { id, status: 'pending', results: [] }
    results = [...runGates(report, spec, buildPlacement(spec)), ...declaredGates(report, spec), checkTextures(report, spec), checkValidator(await validateGltf(bytes))]
  } catch (e) {
    return { id, status: 'failed', results: [fail('glb', `cannot read ${basename(glbFile)}: ${message(e)}`)] }
  }
  return { id, status: results.every((r) => r.ok) ? 'ok' : 'failed', results }
}

/**
 * Validates every shipped GLB of `assetsDir` against the specs of `specsDir` (see the file header). One entry per id,
 * sorted by id; a problem with one asset fails that entry and never throws for the whole run.
 */
export async function validateAssets(assetsDir: string, specsDir: string): Promise<AssetValidation[]> {
  const glbs = new Map((await listFiles(assetsDir, '.glb')).map((f) => [basename(f, '.glb'), join(assetsDir, f)]))
  const specs = new Map((await listFiles(specsDir, '.json')).map((f) => [basename(f, '.json'), join(specsDir, f)]))
  const ids = [...new Set([...glbs.keys(), ...specs.keys()])].sort()
  const out: AssetValidation[] = []
  for (const id of ids) out.push(await validateOne(id, glbs.get(id), specs.get(id)))
  return out
}

/** The detail column of a row. */
function detailOf(entry: AssetValidation): string {
  if (entry.status === 'unmigrated') return 'no spec yet (old model, still shipping)'
  if (entry.status === 'pending') return 'spec ready, the shipped GLB predates the pipeline (no tekpractice extras): rebuild pending'
  if (entry.status === 'ok') return `${entry.results.length} gates passed`
  return entry.results.filter((r) => !r.ok).map((r) => `${r.gate}: ${r.detail}`).join('; ')
}

type Print = (line: string) => void

/** Prints the table and the summary; returns the exit code (1 when any entry failed). */
export function report(entries: AssetValidation[], print: Print): number {
  const width = Math.max(2, ...entries.map((e) => e.id.length))
  print(`${'id'.padEnd(width)}  ${'status'.padEnd(10)}  detail`)
  for (const e of entries) print(`${e.id.padEnd(width)}  ${e.status.padEnd(10)}  ${detailOf(e)}`)
  const count = (s: AssetStatus): number => entries.filter((e) => e.status === s).length
  print(`${count('ok')} ok, ${count('failed')} failed, ${count('pending')} pending, ${count('unmigrated')} unmigrated`)
  return count('failed') > 0 ? 1 : 0
}

/** CLI entry: returns the exit code. `--assets` and `--specs` override the default folders; `print` is injectable for tests. */
export async function main(argv: string[], print: Print = console.log): Promise<number> {
  let assetsDir = DEFAULT_ASSETS_DIR
  let specsDir = DEFAULT_SPEC_DIR
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const value = argv[i + 1]
    if ((a === '--assets' || a === '--specs') && value !== undefined && !value.startsWith('--')) {
      if (a === '--assets') assetsDir = resolve(value)
      else specsDir = resolve(value)
      i++
    } else {
      print(`usage: npm run validate:assets [-- --assets <dir>] [--specs <dir>]${a.startsWith('--') ? '' : `   (unexpected argument ${a})`}`)
      return 1
    }
  }
  try {
    return report(await validateAssets(assetsDir, specsDir), print)
  } catch (e) {
    print(`error: ${message(e)}`)
    return 1
  }
}

if (isMainModule(process.argv[1], import.meta.url)) void main(process.argv.slice(2)).then((code) => process.exit(code))
