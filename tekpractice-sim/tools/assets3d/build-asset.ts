/**
 * assets3d/build-asset: the orchestrator of the 3D-asset pipeline, one asset per run.
 *
 *   npm run asset:build -- <id> [--raw file.glb] [--attempts 3] [--yaw 0|90|180|270] [--dry-run]
 *   npm run asset:pilot [-- --attempts 3 --yaw 0 --dry-run]      (the six pilot ids, one after the other)
 *
 * Per attempt n (1..maxAttempts):
 *  1. raw GLB: the `--raw` file (only one attempt is meaningful then, zero Meshy calls), else Meshy multi-image-to-3D
 *     from assets-source/<id>/photos (sorted by name, at most 4), downloaded right away, credits noted
 *  2. the raw bytes are saved to assets-source/<id>/work/<run>/attempt-N.raw.glb, where <run> is the run's start time
 *     (from deps.now, Windows-safe): a rerun never overwrites earlier, paid output. The Meshy task id of each attempt is
 *     recorded in the report right after the paid create call
 *  3. runFixup (Blender) writes work/<run>/attempt-N.fixed.glb
 *  4. inspectGlb + runGates on the fixed GLB, plus checkProportionDrift on the fix-up's pre-scale size (6th gate)
 *  5. all pass: optimize the textures (WebP, longest side <= TEXTURE_MAX_PX of the tier), THEN Draco-compress (connector
 *     16 position bits, other tiers 14), and RE-MEASURE the final bytes with the same five gates, because quantization
 *     moves vertices, plus the seventh gate `textures` (texture size and file size). A connector whose compressed bytes
 *     fail ships the texture-optimized, uncompressed GLB (compression 'none'). Any failure on the final bytes is a
 *     defect of our own settings, not of the Meshy model: the failing gates go on the attempt, the bytes are saved as
 *     attempt-N.final.glb and the build aborts (no new paid task)
 *  6. pass: write public/assets/<id>.glb and record the manifest entry (both skipped on --dry-run). `ok` (and `finalGlb`)
 *     are set only after BOTH succeeded; a failed write or manifest record is an error, never a PASS
 * After maxAttempts failures nothing is written to public/assets or the manifest. The report
 * (assets-source/<id>/report.json, gitignored, with the run's `workDir`) is always written, even on a dry run.
 *
 * Money and safety rules:
 *  - a Meshy 402 or 429 aborts at once (no further attempt); the message is surfaced and `stopped` is set
 *  - any other error thrown inside an attempt (Blender, download, compress, re-measure, I/O) also aborts instead of
 *    retrying: the Meshy task is already paid for and the cause would repeat
 *  - a failed attempt buys a new Meshy task ONLY when every failing gate is in RETRYABLE_GATES {proportionDrift,
 *    budget}: properties of the Meshy model. The fix-up scales to the exact spec size and places every port_/ctrl_ at
 *    its planned position, so a size, transform, parts or portPositions failure (or any final-bytes failure) is a
 *    defect of OUR code, identical on every attempt: it aborts with an error naming the gates and the work dir
 *  - the pilot stops at the first asset whose report carries an error of any kind
 *  - the manifest is validated before the first paid call (a dry run skips this, it never writes the manifest)
 *  - nothing here logs a request body or header; every error text is scrubbed of MESHY_API_KEY before it reaches the
 *    report, the console or report.json
 *  - with the real Blender fix-up, a missing Blender is detected before the first Meshy call
 * All I/O is injectable through BuildDeps so the whole flow is unit-tested without Meshy or Blender.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dracoCompress, optimizeTextures } from './compress'
import type { CompressOpts, TextureOpts } from './compress'
import { findBlender, redact, requireMeshyKey } from './env'
import { checkProportionDrift, checkTextures, runGates, TEXTURE_MAX_PX, TRIANGLE_CEILING } from './gates'
import type { GateResult } from './gates'
import { inspectGlb } from './inspect'
import type { GlbReport } from './inspect'
import { loadSpecs } from './loadSpecs'
import { isMainModule } from './mainModule'
import { assertManifestUsable, recordAsset } from './manifest'
import { createMultiImageTask, downloadGlb, MESHY_MODEL, MeshyError, waitForTask } from './meshy'
import type { MeshyOpts, MeshyTask } from './meshy'
import { buildPlacement } from './placement'
import { runFixup } from './runFixup'
import type { FixupOpts, FixupReport, YawDeg } from './runFixup'
import type { AssetSpecT } from './specSchema'

const MAX_PHOTOS = 4
const QUANTIZE_BITS = { connector: 16, standard: 14, hero: 14 } as const
const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
const YAWS = [0, 90, 180, 270]

/** The pilot set: one hero-ish mic, a console, a stagebox and three connectors. */
export const PILOT_IDS = ['shure-sm58', 'yamaha-ql1', 'yamaha-rio3224-d2', 'xlr3-f', 'trs-quarter', 'rj45']

/** Triangles the fix-up adds per socket recess (fixup.py, a 24-segment boolean cylinder), with margin. */
const RECESS_TRIANGLES = 100
/** Share of the tier's triangle ceiling Meshy is asked for: the rest is headroom for clean-up and recesses. */
const CEILING_SHARE = 0.7
const MIN_POLYCOUNT = 100

/**
 * The triangle count requested from Meshy (triangle topology, so it is the unit of the budget gate):
 * max(100, floor(0.7 x the tier's triangle ceiling) - 100 per port with an opening). Connector 560, a device 2800
 * minus the recesses. A quad target would double after triangulation and fail the budget on every paid attempt.
 */
export function targetPolycount(spec: AssetSpecT): number {
  const recesses = spec.ports.filter((p) => p.openingMm !== undefined).length
  return Math.max(MIN_POLYCOUNT, Math.floor(CEILING_SHARE * TRIANGLE_CEILING[spec.tier]) - RECESS_TRIANGLES * recesses)
}

/** Repo root (tekpractice-sim/), two folders above this file. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

export interface BuildPaths {
  /** Where the shipped <id>.glb goes (public/assets). */
  assetsDir: string
  /** The assets-source folder: <id>/photos, <id>/work, <id>/report.json. */
  sourceDir: string
  manifestPath: string
}

export interface BuildDeps {
  meshy: {
    createMultiImageTask: (images: string[], opts: MeshyOpts) => Promise<string>
    /** Polls until the task ends; `onProgress` is called once per poll. */
    waitForTask: (id: string, onProgress?: (task: MeshyTask) => void) => Promise<MeshyTask>
    downloadGlb: (task: MeshyTask) => Promise<Uint8Array>
  }
  runFixup: (inGlb: string, outGlb: string, spec: AssetSpecT, opts?: FixupOpts) => Promise<FixupReport>
  compress: (bytes: Uint8Array, opts: CompressOpts) => Promise<Uint8Array>
  /** The texture budget step: runs before `compress`. */
  optimizeTextures: (bytes: Uint8Array, opts: TextureOpts) => Promise<Uint8Array>
  /** The spec of `id`; throws when there is none. */
  loadSpec: (id: string) => AssetSpecT
  /** The reference photos of `id` as image data URIs, in order, at most 4 ([] when there are none). */
  readPhotos: (id: string) => Promise<string[]>
  paths: BuildPaths
  now: () => Date
  /** Progress lines (task id and work dir right after each paid create, poll status). Default console.log. */
  log: (line: string) => void
}

export interface BuildOpts {
  maxAttempts: number
  /** A hand-made raw GLB: no Meshy, one attempt. */
  rawGlb?: string
  /** Run everything and write the report, but never write public/assets or the manifest. */
  dryRun?: boolean
  yawDeg?: YawDeg
}

export interface BuildAttempt {
  n: number
  /** The Meshy task created for this attempt (absent for --raw); set right after the paid create call. */
  taskId?: string
  /** Meshy credits this attempt consumed; null for --raw or when the attempt stopped before a task finished. */
  credits: number | null
  gates: GateResult[]
  /** Geometry compression of the shipped file. */
  compression?: 'draco' | 'none'
  /** 'webp' when the shipped file carries textures (all re-encoded as WebP by the texture step), 'none' when it has none. */
  textures?: 'webp' | 'none'
}

export interface BuildReport {
  id: string
  ok: boolean
  attempts: BuildAttempt[]
  /** The shipped file; absent on a failure and on a dry run. */
  finalGlb?: string
  dryRun: boolean
  /** This run's folder of raw and fixed GLBs: assets-source/<id>/work/<run start time>. */
  workDir: string
  /** Why the build stopped early (scrubbed of the API key). */
  error?: string
  /** Set when Meshy answered 402 (out of credits) or 429 (rate limit): callers must not start another build. */
  stopped?: 'meshy-402' | 'meshy-429'
}

/** Reads the photo files of `dir` as data URIs: png / jpg / jpeg / webp only, sorted by name, at most 4. */
export async function readPhotosFrom(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  const names = (await readdir(dir)).filter((f) => MIME[extname(f).toLowerCase()] !== undefined).sort()
  const out: string[] = []
  for (const name of names.slice(0, MAX_PHOTOS)) {
    const bytes = await readFile(join(dir, name))
    out.push(`data:${MIME[extname(name).toLowerCase()]};base64,${bytes.toString('base64')}`)
  }
  return out
}

/** The deps with the real modules and the repo paths wherever the caller gave none. The Meshy key is only read on first use. */
function resolveDeps(deps: Partial<BuildDeps>): BuildDeps {
  const paths: BuildPaths = deps.paths ?? {
    assetsDir: join(REPO_ROOT, 'public', 'assets'),
    sourceDir: join(REPO_ROOT, 'assets-source'),
    manifestPath: join(REPO_ROOT, 'public', 'assets', 'ASSET_MANIFEST.json'),
  }
  const key = (): { key: string } => ({ key: requireMeshyKey() })
  return {
    meshy: deps.meshy ?? {
      createMultiImageTask: (images, opts) => createMultiImageTask(images, opts, key()),
      waitForTask: (id, onProgress) => waitForTask(id, key(), { onProgress }),
      downloadGlb: (task) => downloadGlb(task),
    },
    runFixup: deps.runFixup ?? ((inGlb, outGlb, spec, opts) => runFixup(inGlb, outGlb, spec, opts)),
    compress: deps.compress ?? dracoCompress,
    optimizeTextures: deps.optimizeTextures ?? optimizeTextures,
    loadSpec:
      deps.loadSpec ??
      ((id) => {
        const spec = loadSpecs().find((s) => s.id === id)
        if (!spec) throw new Error(`no asset spec "${id}" in content/asset-specs (create it with npm run asset:spec)`)
        return spec
      }),
    readPhotos: deps.readPhotos ?? ((id) => readPhotosFrom(join(paths.sourceDir, id, 'photos'))),
    paths,
    now: deps.now ?? (() => new Date()),
    log: deps.log ?? ((line) => console.log(line)),
  }
}

/** Writes `bytes` to `path` through a temp file and a rename, so a reader never sees half a file. */
async function writeAtomic(target: string, bytes: Uint8Array): Promise<void> {
  await mkdir(dirname(target), { recursive: true })
  const temp = `${target}.${process.pid}.tmp`
  try {
    await writeFile(temp, bytes)
    await rename(temp, target)
  } catch (e) {
    // a stray .tmp in public/assets would be shipped by Vite
    await rm(temp, { force: true })
    throw e
  }
}

/** The five asset gates over the bytes of a GLB, measured fresh with inspectGlb (the report is kept for the textures gate). */
async function measure(bytes: Uint8Array, spec: AssetSpecT): Promise<{ gates: GateResult[]; triangles: number; report: GlbReport }> {
  const report = await inspectGlb(bytes)
  return { gates: runGates(report, spec, buildPlacement(spec)), triangles: report.triangles, report }
}

const allOk = (gates: GateResult[]): boolean => gates.every((g) => g.ok)

/**
 * The only gates whose failure is a property of the Meshy model itself, so a new (paid) task may do better: its
 * proportions (checked before the fix-up scales it to the spec) and its triangle / material budget. Every other gate
 * checks what OUR fix-up built (exact size, pivot, port_/ctrl_ nodes at their planned places) or what our compression
 * produced: it would fail identically on every attempt, so it aborts instead of buying another task.
 */
export const RETRYABLE_GATES: ReadonlySet<string> = new Set(['proportionDrift', 'budget'])

/** Names of the failing gates, in order. */
const failingNames = (gates: GateResult[]): string[] => gates.filter((g) => !g.ok).map((g) => g.gate)

/** The abort error for a failure of one of our own steps (not retryable): names the gates and the work dir. */
function pipelineDefectError(failed: string[], stage: string, work: string): Error {
  return new Error(
    `${stage}: gate${failed.length === 1 ? '' : 's'} ${failed.join(', ')} failed. They check the pipeline's own output, so a new Meshy task ` +
      `would fail the same way: no further task bought. The paid raw GLB and the attempt files stay in ${work}`,
  )
}

interface Shipped {
  bytes: Uint8Array
  triangles: number
  gates: GateResult[]
  compression: 'draco' | 'none'
  textures: 'webp' | 'none'
}

/** The abort error for a measured `textures` failure: our own settings are at fault, so no new paid Meshy task. */
function textureBudgetError(gate: GateResult): Error {
  return new Error(`${gate.detail} (lower TEXTURE_MAX_PX or FILE_BYTES_MAX in gates.ts)`)
}

/** The outcome of the final-bytes step: the file to ship, or the final bytes that failed and every gate result. */
type Regate = { ok: true; shipped: Shipped } | { ok: false; gates: GateResult[]; bytes: Uint8Array }

/**
 * Optimizes the textures of a fixed GLB that passed its gates, Draco-compresses the result and re-measures the FINAL
 * bytes (five gates plus `textures`). Throws when a step throws. Returns the file to ship, or (`ok: false`) the bytes
 * that would have shipped with all their gate results: geometry failures are marked "after Draco" when a
 * non-connector cannot ship compressed. Any final-bytes failure is a defect of our own settings: the caller aborts.
 */
async function optimizeAndRegate(
  fixed: Uint8Array,
  drift: GateResult,
  spec: AssetSpecT,
  d: Pick<BuildDeps, 'compress' | 'optimizeTextures'>,
): Promise<Regate> {
  // A throw from a step or from a re-measurement is not a measured failure: it propagates and aborts the build.
  const textured = await d.optimizeTextures(fixed, { maxPx: TEXTURE_MAX_PX[spec.tier] })
  const bytes = await d.compress(textured, { quantizePositionBits: QUANTIZE_BITS[spec.tier] })
  const compressed = await measure(bytes, spec)

  let final: { bytes: Uint8Array; triangles: number; gates: GateResult[]; report: GlbReport; compression: 'draco' | 'none' }
  if (allOk(compressed.gates)) {
    final = { bytes, triangles: compressed.triangles, gates: compressed.gates, report: compressed.report, compression: 'draco' }
  } else if (spec.tier === 'connector') {
    // A tiny connector can lose its tolerance to quantization: ship the texture-optimized file, re-measured, without Draco.
    const plain = await measure(textured, spec)
    if (!allOk(plain.gates)) return { ok: false, gates: [...plain.gates, drift, checkTextures(plain.report, spec)], bytes: textured }
    final = { bytes: textured, triangles: plain.triangles, gates: plain.gates, report: plain.report, compression: 'none' }
  } else {
    const textures = checkTextures(compressed.report, spec)
    return { ok: false, gates: [...compressed.gates.map((g) => (g.ok ? g : { ...g, detail: `after Draco: ${g.detail}` })), drift, textures], bytes }
  }

  const textures = checkTextures(final.report, spec)
  if (!textures.ok) return { ok: false, gates: [...final.gates, drift, textures], bytes: final.bytes }
  const hasWebp = final.report.textures.length > 0 && final.report.textures.every((t) => t.mimeType === 'image/webp')
  return {
    ok: true,
    shipped: { bytes: final.bytes, triangles: final.triangles, gates: [...final.gates, drift, textures], compression: final.compression, textures: hasWebp ? 'webp' : 'none' },
  }
}

/** Builds one asset. Precondition problems (unknown spec, no photos, unreadable --raw, no Blender) throw; everything else is in the report. */
export async function buildAsset(id: string, opts: BuildOpts, deps: Partial<BuildDeps> = {}): Promise<BuildReport> {
  const d = resolveDeps(deps)
  const spec = d.loadSpec(id)
  const dryRun = opts.dryRun === true
  const apiKey = process.env.MESHY_API_KEY ?? ''
  const scrub = (text: string): string => redact(text, apiKey)

  let rawBytes: Uint8Array | null = null
  let photos: string[] = []
  if (opts.rawGlb) {
    rawBytes = new Uint8Array(await readFile(opts.rawGlb))
  } else {
    photos = await d.readPhotos(id)
    if (photos.length === 0) {
      throw new Error(`no photos for ${id}: put 1 to ${MAX_PHOTOS} reference images (png, jpg or webp) in ${join(d.paths.sourceDir, id, 'photos')}`)
    }
  }
  if (deps.runFixup === undefined && !findBlender()) {
    throw new Error('Blender is not installed (not found at the default 5.1 path): install Blender 5.1 or set BLENDER_EXE to blender.exe')
  }

  // Fail before the first paid call if the manifest could not be written afterwards.
  if (!dryRun) assertManifestUsable(d.paths.manifestPath)

  const dir = join(d.paths.sourceDir, id)
  const runStamp = d.now().toISOString().replace(/[:.]/g, '-')
  const work = join(dir, 'work', runStamp)
  await mkdir(work, { recursive: true })

  const report: BuildReport = { id, ok: false, attempts: [], dryRun, workDir: work }
  const maxAttempts = rawBytes ? 1 : opts.maxAttempts
  const reportText = (): string => scrub(JSON.stringify(report, null, 2)) + '\n'
  /**
   * Writes the report into this run's work dir after every step (create, download, fix-up, gates, compress), so a
   * Ctrl-C or a kill still leaves the paid task id on disk, plus the summary copy at assets-source/<id>/report.json.
   */
  const persist = async (): Promise<void> => {
    const text = reportText()
    await writeFile(join(work, 'report.json'), text)
    await writeFile(join(dir, 'report.json'), text)
  }

  for (let n = 1; n <= maxAttempts && !report.ok; n++) {
    const attempt: BuildAttempt = { n, credits: null, gates: [] }
    report.attempts.push(attempt)
    try {
      let raw: Uint8Array
      if (rawBytes) {
        raw = rawBytes
      } else {
        const taskId = await d.meshy.createMultiImageTask(photos, { targetPolycount: targetPolycount(spec), topology: 'triangle' })
        attempt.taskId = taskId
        d.log(`task ${taskId} created, workDir ${work}`)
        await persist()
        let lastPoll = ''
        const task = await d.meshy.waitForTask(taskId, (t) => {
          const line = `task ${taskId}: ${t.status} ${t.progress}%`
          if (line !== lastPoll) d.log(line)
          lastPoll = line
        })
        attempt.credits = task.consumed_credits ?? null
        raw = await d.meshy.downloadGlb(task)
      }
      const rawPath = join(work, `attempt-${n}.raw.glb`)
      const fixedPath = join(work, `attempt-${n}.fixed.glb`)
      await writeFile(rawPath, raw)
      await persist()

      const fixup = await d.runFixup(rawPath, fixedPath, spec, { yawDeg: opts.yawDeg ?? 0 })
      await persist()
      const fixed = new Uint8Array(await readFile(fixedPath))
      const fixedMeasure = await measure(fixed, spec)
      const drift = checkProportionDrift(fixup.preScaleSizeM, spec)
      attempt.gates = [...fixedMeasure.gates, drift]
      await persist()
      const failed = failingNames(attempt.gates)
      if (failed.length > 0) {
        // Only a failure of the Meshy model itself buys a new task; anything our fix-up produced aborts.
        if (failed.every((g) => RETRYABLE_GATES.has(g))) continue
        throw pipelineDefectError(failed, `attempt ${n}, fixed GLB`, work)
      }

      const result = await optimizeAndRegate(fixed, drift, spec, d)
      attempt.gates = result.ok ? result.shipped.gates : result.gates
      await persist()
      if (!result.ok) {
        // The final bytes are ours (texture step, Draco): keep them and every gate for the post-mortem, then abort.
        attempt.gates = result.gates
        await writeFile(join(work, `attempt-${n}.final.glb`), result.bytes)
        const textures = result.gates.find((g) => g.gate === 'textures' && !g.ok)
        throw textures ? textureBudgetError(textures) : pipelineDefectError(failingNames(result.gates), `attempt ${n}, final bytes`, work)
      }
      const { shipped } = result
      attempt.gates = shipped.gates
      attempt.compression = shipped.compression
      attempt.textures = shipped.textures
      if (!dryRun) {
        const target = join(d.paths.assetsDir, `${id}.glb`)
        await writeAtomic(target, shipped.bytes)
        try {
          recordAsset(d.paths.manifestPath, {
            id,
            kind: spec.kind,
            status: 'ok',
            tris: shipped.triangles,
            ports: spec.ports.length,
            tool: rawBytes ? 'raw' : 'meshy',
            toolVersion: rawBytes ? 'raw' : MESHY_MODEL,
            date: d.now().toISOString(),
            specSource: spec.sources[0]?.url ?? 'spec',
            logosRemoved: false,
            gates: shipped.gates.map((g) => ({ gate: g.gate, ok: g.ok })),
          })
        } catch (e) {
          throw new Error(`the GLB was written to ${target} but the manifest was not updated: ${e instanceof Error ? e.message : String(e)}`)
        }
        report.finalGlb = target
      }
      report.ok = true
    } catch (e) {
      const message = scrub(e instanceof Error ? e.message : String(e))
      report.error = message
      if (e instanceof MeshyError && (e.status === 402 || e.status === 429)) report.stopped = e.status === 402 ? 'meshy-402' : 'meshy-429'
      break
    }
  }

  // The last word on disk: the work-dir copy and the summary copy are the same final report.
  await persist()
  return report
}

/** A readable gate table per attempt, the credits, and the verdict. */
export function formatReport(report: BuildReport): string {
  const lines = [`asset ${report.id}${report.dryRun ? '  (dry run: nothing written to public/assets or the manifest)' : ''}`]
  for (const a of report.attempts) {
    lines.push(`attempt ${a.n}  credits: ${a.credits === null ? 'n/a' : String(a.credits)}`)
    if (a.gates.length === 0) lines.push('  (no gates ran)')
    for (const g of a.gates) lines.push(`  ${g.ok ? 'PASS' : 'FAIL'}  ${g.gate.padEnd(16)}${g.detail}`)
    if (a.compression) lines.push(`  compression: ${a.compression}, textures: ${a.textures ?? 'none'}`)
  }
  if (report.error) lines.push(`error: ${report.error}`)
  if (report.ok) lines.push(report.finalGlb ? `result: PASS, shipped ${report.finalGlb}` : report.dryRun ? 'result: PASS (dry run)' : 'result: PASS')
  else lines.push('result: FAIL')
  return lines.join('\n')
}

const USAGE =
  'usage: npm run asset:build -- <id> [--raw file.glb] [--attempts 3] [--yaw 0|90|180|270] [--dry-run]   |   npm run asset:pilot [-- --attempts 3 --yaw 0 --dry-run]'

interface CliArgs {
  id?: string
  pilot: boolean
  opts: BuildOpts
}

/** Parses the command line; returns the parsed arguments or an error message that includes the usage. */
function parseArgs(argv: string[]): CliArgs | { error: string } {
  const bad = (why: string): { error: string } => ({ error: `${why}\n${USAGE}` })
  const opts: BuildOpts = { maxAttempts: 3 }
  let id: string | undefined
  let pilot = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') opts.dryRun = true
    else if (a === '--pilot') pilot = true
    else if (a === '--raw') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) return bad('--raw needs a .glb file path')
      opts.rawGlb = v
    } else if (a === '--attempts') {
      const n = Number(argv[++i])
      if (!Number.isInteger(n) || n < 1) return bad('--attempts must be a whole number of at least 1')
      opts.maxAttempts = n
    } else if (a === '--yaw') {
      const n = Number(argv[++i])
      if (!YAWS.includes(n)) return bad('--yaw must be 0, 90, 180 or 270')
      opts.yawDeg = n as YawDeg
    } else if (a.startsWith('--')) return bad(`unknown option ${a}`)
    else if (id === undefined) id = a
    else return bad(`unexpected argument ${a}`)
  }
  if (pilot && (id !== undefined || opts.rawGlb)) return bad('--pilot takes no id and no --raw')
  if (!pilot && id === undefined) return bad('an asset id is required')
  return { id, pilot, opts }
}

type Print = (line: string) => void

/**
 * Runs the pilot ids one after the other and prints a summary table. It stops at the FIRST error of any kind (a Meshy
 * 402 / 429, a pipeline defect, a thrown precondition): the next asset would most likely hit the same cause and pay
 * for it. Running out of attempts on retryable gates is a plain FAIL and the pilot goes on. Returns the exit code.
 */
async function runPilot(opts: BuildOpts, deps: Partial<BuildDeps>, print: Print): Promise<number> {
  const rows: { id: string; result: string; attempts: string; credits: string; note: string }[] = []
  let stoppedAt: string | undefined
  let allOk = true
  for (const id of PILOT_IDS) {
    if (stoppedAt) {
      rows.push({ id, result: 'not run', attempts: '-', credits: '-', note: `stopped at ${stoppedAt}` })
      continue
    }
    try {
      const report = await buildAsset(id, opts, deps)
      print(formatReport(report))
      print('')
      const credits = report.attempts.reduce((sum, a) => sum + (a.credits ?? 0), 0)
      const result = report.stopped ? 'STOPPED' : report.ok ? 'PASS' : 'FAIL'
      rows.push({ id, result, attempts: String(report.attempts.length), credits: String(credits), note: report.stopped ? `${report.stopped}: ${report.error ?? ''}` : (report.error ?? '') })
      if (!report.ok) allOk = false
      if (report.error !== undefined) {
        stoppedAt = id
        print(`pilot stopped at ${id}: ${report.error}`)
      }
    } catch (e) {
      allOk = false
      const note = redact(e instanceof Error ? e.message : String(e), process.env.MESHY_API_KEY ?? '')
      rows.push({ id, result: 'ERROR', attempts: '-', credits: '-', note })
      stoppedAt = id
      print(`pilot stopped at ${id}: ${note}`)
    }
  }
  const stopped = stoppedAt !== undefined
  print('pilot summary')
  for (const r of rows) print(`  ${r.id.padEnd(20)} ${r.result.padEnd(8)} attempts ${r.attempts.padEnd(2)} credits ${r.credits.padEnd(4)} ${r.note}`.trimEnd())
  return allOk && !stopped ? 0 : 1
}

/** CLI entry: returns the exit code (0 when the build passed). `deps` and `print` are injectable for tests. */
export async function main(argv: string[], deps: Partial<BuildDeps> = {}, print: Print = console.log): Promise<number> {
  const args = parseArgs(argv)
  if ('error' in args) {
    print(args.error)
    return 1
  }
  // progress lines (task ids, polls) go where the rest of the CLI output goes
  deps = { ...deps, log: deps.log ?? print }
  if (args.pilot) return runPilot(args.opts, deps, print)
  try {
    const report = await buildAsset(args.id as string, args.opts, deps)
    print(formatReport(report))
    return report.ok ? 0 : 1
  } catch (e) {
    print(`error: ${redact(e instanceof Error ? e.message : String(e), process.env.MESHY_API_KEY ?? '')}`)
    return 1
  }
}

/** Re-exported from the light shared module (kept here for the existing callers and tests). */
export { isMainModule }

if (isMainModule(process.argv[1], import.meta.url)) void main(process.argv.slice(2)).then((code) => process.exit(code))
