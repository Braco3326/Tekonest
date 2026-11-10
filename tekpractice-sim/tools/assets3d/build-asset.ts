/**
 * assets3d/build-asset: the orchestrator of the 3D-asset pipeline, one asset per run.
 *
 *   npm run asset:build -- <id> [--raw file.glb] [--attempts 3] [--yaw 0|90|180|270] [--flip] [--yes] [--ship --logos-removed]
 *   npm run asset:build -- <id> --ship-run <work/run folder> [--logos-removed]   (ship an earlier run, build nothing)
 *   npm run asset:build -- <id> --scripted [--ship]   (our own Blender builder from the spec's `build` block: no Meshy, no spending)
 *   npm run asset:pilot -- --yes [--attempts 3] [--yaw 0] [--ship --logos-removed]   (the six pilot ids, in turn)
 *
 * By default NOTHING ships: the run does everything and leaves the result in its work dir (final.glb and report.json),
 * never in public/assets or the manifest. `--ship` writes public/assets/<id>.glb and the manifest entry, and it needs
 * `--logos-removed`: the founder asserts the textures carry no brand logos (recorded as logosRemoved: true). Any run
 * that calls Meshy (everything except --raw and --scripted, and always the pilot) first prints the most it can spend and
 * refuses to start without `--yes`. A `--scripted` run builds the raw GLB with runBuilder (tools/assets3d/blender/
 * build_from_spec.py) instead: one attempt, no photos, no Meshy, no texture, so logosRemoved is recorded as true by itself.
 *
 * Per attempt n (1..maxAttempts):
 *  1. raw GLB: the `--raw` file (only one attempt is meaningful then, zero Meshy calls), else Meshy multi-image-to-3D
 *     from assets-source/<id>/photos (sorted by name, at most 4), downloaded right away, credits noted
 *  2. the raw bytes are saved to assets-source/<id>/work/<run>/attempt-N.raw.glb, where <run> is the run's start time
 *     (from deps.now, Windows-safe): a rerun never overwrites earlier, paid output. The Meshy task id of each attempt is
 *     recorded in the report right after the paid create call
 *  3. runFixup (Blender) writes work/<run>/attempt-N.fixed.glb, and (Blender available, best effort) its contact sheet
 *     work/<run>/attempt-N.sheet.png; a failed sheet only logs a warning
 *  4. inspectGlb + runGates on the fixed GLB, plus checkProportionDrift on the fix-up's pre-scale size (6th gate)
 *  5. all pass: optimize the textures (WebP, longest side <= TEXTURE_MAX_PX of the tier), THEN Draco-compress (connector
 *     16 position bits, other tiers 14), and RE-MEASURE the final bytes with the same five gates, because quantization
 *     moves vertices, plus `textures` (texture size and file size) and `validator` (Khronos glTF validator, 0
 *     errors). A connector whose compressed bytes fail ships the texture-optimized, uncompressed GLB (compression 'none'). Any failure on the final bytes is a
 *     defect of our own settings, not of the Meshy model: the failing gates go on the attempt, the bytes are saved as
 *     attempt-N.final.glb and the build aborts (no new paid task)
 *  6. pass: the final bytes go to work/<run>/final.glb; with --ship (logos removed) also public/assets/<id>.glb and the
 *     manifest entry. `ok` (and `finalGlb`) are set only after BOTH succeeded; a failed write or record is an error
 * After maxAttempts failures nothing is written to public/assets or the manifest. The report is written into
 * work/<run>/report.json after every step (a Ctrl-C keeps the paid task id) and copied to assets-source/<id>/report.json
 * (gitignored, with the run's `workDir`), even on a dry run. Each paid create prints `task <id> created, workDir <dir>`.
 *
 * Money and safety rules:
 *  - a Meshy 402 or 429 aborts at once (no further attempt); the message is surfaced and `stopped` is set
 *  - any other error thrown inside an attempt (Blender, download, compress, re-measure, I/O) also aborts instead of
 *    retrying: the Meshy task is already paid for and the cause would repeat
 *  - a failed attempt buys a new Meshy task ONLY when every failing gate is in RETRYABLE_GATES {proportionDrift,
 *    budget}: properties of the Meshy model (a budget failure on the material count is ours, not retryable; a yaw of 90 or
 *    270 on a non-square footprint is refused before the first paid call). The fix-up scales to the exact spec size and places every port_/ctrl_ at
 *    its planned position, so a size, transform, parts or portPositions failure (or any final-bytes failure) is a
 *    defect of OUR code, identical on every attempt: it aborts with an error naming the gates and the work dir
 *  - the pilot stops at the first asset whose report carries an error of any kind
 *  - the manifest is validated before the first paid call (a dry run skips this, it never writes the manifest)
 *  - every Meshy request has a timeout (60 s API, 5 min download; meshy.ts)
 *  - nothing here logs a request body or header; every error text is scrubbed of MESHY_API_KEY before it reaches the
 *    report, the console or report.json
 *  - with the real Blender fix-up, a missing Blender is detected before the first Meshy call
 *  - the spec is checked against content/catalog.json (checkSpecParity) before the first Meshy call and before shipping
 * All I/O is injectable through BuildDeps so the whole flow is unit-tested without Meshy or Blender.
 */
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dracoCompress, optimizeTextures } from './compress'
import { renderContactSheet } from './contactSheet'
import type { CompressOpts, TextureOpts } from './compress'
import { findBlender, redact, requireMeshyKey } from './env'
import { blankBands } from './blank'
import { normaliseLook } from './look'
import { parsePhotoArg, photoProjection } from './photoProjection'
import type { PhotoArg } from './photoProjection'
import { renderProjection, shiftPictureX } from './projection'
import { orientSlab } from './slab'
import type { Projection, ProjectionFace } from './projection'
import { checkPortSurface, checkProportionDrift, checkTextures, checkValidator, runGates, DATA_TEXTURE_MAX_PX, textureMaxPx, TRIANGLE_CEILING } from './gates'
import type { GateResult } from './gates'
import { inspectGlb } from './inspect'
import type { GlbReport } from './inspect'
import { Catalog } from '../schemas'
import type { CatalogT } from '../schemas'
import { checkSpecParity, loadSpecs } from './loadSpecs'
import { isMainModule } from './mainModule'
import { assertManifestUsable, recordAsset } from './manifest'
import type { ManifestEntry } from './manifest'
import { createMultiImageTask, downloadGlb, MESHY_MODEL, MeshyError, waitForTask } from './meshy'
import type { MeshyOpts, MeshyTask } from './meshy'
import { buildPlacement } from './placement'
import { BUILDER_VERSION, runBuilder } from './runBuilder'
import type { BuildProjection } from './runBuilder'
import { runFixup } from './runFixup'
import type { FixupOpts, FixupReport, YawDeg } from './runFixup'
import { validateBuild } from './shapes'
import type { AssetSpecT } from './specSchema'
import { validateGltf } from './validateGltf'

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

/** Credits one meshy-7.1 multi-image task with 2K PBR textures costs (meshy.ts header): the pre-spend summary uses it. */
export const CREDITS_PER_TASK = 30

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
  /** The scripted builder: writes the raw GLB of a spec with a `build` block (default: runBuilder with Blender). */
  runBuilder: (spec: AssetSpecT, outGlb: string, projections?: BuildProjection[]) => Promise<void>
  /** The flat image of one face of a fixed-up Meshy model (default: renderProjection with Blender). */
  renderProjection: (glb: string, face: ProjectionFace, expectedMm?: { w: number; h: number; d: number }) => Promise<Projection>
  /** The picture of a face made from a straight-on photo (default: photoProjection). */
  photoProjection: (photo: PhotoArg, face: ProjectionFace, sizeMm: { w: number; h: number; d: number }) => Promise<Projection>
  compress: (bytes: Uint8Array, opts: CompressOpts) => Promise<Uint8Array>
  /** The texture budget step: runs before `compress`. */
  optimizeTextures: (bytes: Uint8Array, opts: TextureOpts) => Promise<Uint8Array>
  /** The spec of `id`; throws when there is none. */
  loadSpec: (id: string) => AssetSpecT
  /** content/catalog.json parsed with the zod Catalog schema: the spec's ports / controls are checked against it before paying. */
  loadCatalog: () => CatalogT
  /** The reference photos of `id`, in order, at most 4 ([] when there are none). */
  readPhotos: (id: string) => Promise<PhotoFile[]>
  paths: BuildPaths
  now: () => Date
  /** Progress lines (task id and work dir right after each paid create, poll status). Default console.log. */
  log: (line: string) => void
  /**
   * Renders the contact sheet of a GLB (renderContactSheet), or null when Blender is not available. Called once per
   * attempt on the fixed GLB; best effort: a failure is logged as a warning and never fails the build.
   */
  renderSheet: ((glb: string, photo: string | null, outPng: string, spec: AssetSpecT) => Promise<void>) | null
}

export interface BuildOpts {
  maxAttempts: number
  /** A hand-made raw GLB: no Meshy, one attempt. */
  rawGlb?: string
  /** With rawGlb: the model is a thin Meshy panel (CLI --slab): its thin axis becomes the depth and the spec's depth proportion is restored before the fix-up. */
  slab?: boolean
  /** With rawGlb or projectFrom: the id of the Meshy task the GLB was downloaded from by hand (CLI --meshy-task); the manifest then records Meshy provenance. */
  rawTaskId?: string
  /**
   * With scripted (CLI --project <glb>): a fixed-up Meshy GLB whose picture of the spec's `build.projection` face (default io) is
   * mapped onto the scripted shape: our exact geometry with Meshy's look. The texture comes from photos, so shipping needs logosRemoved.
   */
  projectFrom?: string
  /** With scripted (CLI --project-photo face=file[@l,t,w,h]): the picture of that face comes from a straight-on photo instead of the Meshy render. */
  projectPhotos?: PhotoArg[]
  /**
   * Build the raw GLB with our own scripted builder from the spec's `build` block (CLI --scripted): no Meshy, no photos,
   * one attempt, no retry. Excludes rawGlb. Logos are not an issue (no photo texture), so logosRemoved counts as true.
   */
  scripted?: boolean
  /**
   * Run everything and leave the result in the work dir (final.glb, report.json), never in public/assets or the
   * manifest. The CLI sets it to !--ship, so a CLI run is a dry run unless shipping was asked for.
   */
  dryRun?: boolean
  /**
   * The founder asserts the textures are free of logos. Shipping (dryRun false) is refused without it; it is what
   * the manifest records as logosRemoved.
   */
  logosRemoved?: boolean
  yawDeg?: YawDeg
  /** Turn the model upside down (180 degrees about glTF Z) in the fix-up, after the yaw (CLI --flip). */
  flipUpright?: boolean
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
  /** The shipped file in public/assets; absent on a failure and on a dry run. */
  finalGlb?: string
  /** The final bytes of the passing attempt in the work dir (work/<run>/final.glb), dry run or not. */
  builtGlb?: string
  dryRun: boolean
  /** Set (true) when the raw GLB came from the scripted builder. */
  scripted?: true
  /** Set (true) with scripted when a Meshy picture was projected onto the shape (--project). */
  hybrid?: true
  /** With hybrid: a Meshy render was projected (--project), so Meshy is part of the provenance. */
  meshyPicture?: true
  /** With hybrid: the file names of the photos used as pictures (--project-photo). */
  projectPhotoNames?: string[]
  /** This run's folder of raw and fixed GLBs: assets-source/<id>/work/<run start time>. */
  workDir: string
  /** Why the build stopped early (scrubbed of the API key). */
  error?: string
  /** Set when Meshy answered 402 (out of credits) or 429 (rate limit): callers must not start another build. */
  stopped?: 'meshy-402' | 'meshy-429'
}

/** One reference photo: its file name (recorded in the manifest), its path and its content as an image data URI. */
export interface PhotoFile {
  name: string
  path: string
  dataUri: string
}

/** Reads the photo files of `dir`: png / jpg / jpeg / webp only, sorted by name, at most 4. */
export async function readPhotosFrom(dir: string): Promise<PhotoFile[]> {
  if (!existsSync(dir)) return []
  const names = (await readdir(dir)).filter((f) => MIME[extname(f).toLowerCase()] !== undefined).sort()
  const out: PhotoFile[] = []
  for (const name of names.slice(0, MAX_PHOTOS)) {
    const path = join(dir, name)
    const bytes = await readFile(path)
    out.push({ name, path, dataUri: `data:${MIME[extname(name).toLowerCase()]};base64,${bytes.toString('base64')}` })
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
    runBuilder: deps.runBuilder ?? ((spec, outGlb, projections) => runBuilder(spec, outGlb, {}, projections)),
    renderProjection: deps.renderProjection ?? ((glb, face, expectedMm) => renderProjection(glb, face, {}, expectedMm)),
    photoProjection: deps.photoProjection ?? ((photo, face, sizeMm) => photoProjection(photo.file, face, sizeMm, photo.crop ? { crop: photo.crop } : {})),
    compress: deps.compress ?? dracoCompress,
    optimizeTextures: deps.optimizeTextures ?? optimizeTextures,
    loadSpec:
      deps.loadSpec ??
      ((id) => {
        const spec = loadSpecs().find((s) => s.id === id)
        if (!spec) throw new Error(`no asset spec "${id}" in content/asset-specs (create it with npm run asset:spec)`)
        return spec
      }),
    loadCatalog: deps.loadCatalog ?? (() => Catalog.parse(JSON.parse(readFileSync(join(REPO_ROOT, 'content', 'catalog.json'), 'utf8')))),
    readPhotos: deps.readPhotos ?? ((id) => readPhotosFrom(join(paths.sourceDir, id, 'photos'))),
    paths,
    now: deps.now ?? (() => new Date()),
    log: deps.log ?? ((line) => console.log(line)),
    renderSheet: deps.renderSheet !== undefined ? deps.renderSheet : findBlender() ? (glb, photo, out, spec) => renderContactSheet(glb, photo, out, spec) : null,
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

/** The two gates that only make sense on the FINAL bytes: textures (sizes, file size) and the Khronos glTF validator. */
async function finalGates(bytes: Uint8Array, report: GlbReport, spec: AssetSpecT): Promise<GateResult[]> {
  return [checkTextures(report, spec), checkValidator(await validateGltf(bytes))]
}

const allOk = (gates: GateResult[]): boolean => gates.every((g) => g.ok)

/**
 * The only gates whose failure is a property of the Meshy model itself, so a new (paid) task may do better: its
 * proportions (checked before the fix-up scales it to the spec) and its triangle / material budget. Every other gate
 * checks what OUR fix-up built (exact size, pivot, port_/ctrl_ nodes at their planned places) or what our compression
 * produced: it would fail identically on every attempt, so it aborts instead of buying another task.
 */
export const RETRYABLE_GATES: ReadonlySet<string> = new Set(['proportionDrift', 'budget', 'portSurface'])

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
  carried: GateResult[],
  spec: AssetSpecT,
  d: Pick<BuildDeps, 'compress' | 'optimizeTextures'>,
  scripted = false,
  hybrid = false,
): Promise<Regate> {
  // A throw from a step or from a re-measurement is not a measured failure: it propagates and aborts the build.
  // Mode Création has no environment map and dim lights: cap the metal and lift the colour map of a textured model (no-op without textures).
  // Brand text and logos of the spec's blank bands are repainted first (on the full-size map), then the look is normalised.
  // (a plain scripted model has no picture to clean: the spec's texture block applies to Meshy and hybrid models)
  const clean = spec.texture && (!scripted || hybrid) ? await blankBands(fixed, spec.texture.blankBandsMm ?? [], spec.texture.blankRects ?? []) : fixed
  // A scripted shape's palette is already lifted by the builder, and a projected picture was lifted when it was rendered: no second lift.
  const lit = scripted ? clean : await normaliseLook(clean)
  const textured = await d.optimizeTextures(lit, { maxPx: textureMaxPx(spec), dataMaxPx: DATA_TEXTURE_MAX_PX[spec.tier] })
  const bytes = await d.compress(textured, { quantizePositionBits: QUANTIZE_BITS[spec.tier] })
  const compressed = await measure(bytes, spec)

  let final: { bytes: Uint8Array; triangles: number; gates: GateResult[]; report: GlbReport; compression: 'draco' | 'none' }
  if (allOk(compressed.gates)) {
    final = { bytes, triangles: compressed.triangles, gates: compressed.gates, report: compressed.report, compression: 'draco' }
  } else if (spec.tier === 'connector') {
    // A tiny connector can lose its tolerance to quantization: ship the texture-optimized file, re-measured, without Draco.
    const plain = await measure(textured, spec)
    if (!allOk(plain.gates)) return { ok: false, gates: [...plain.gates, ...carried, ...(await finalGates(textured, plain.report, spec))], bytes: textured }
    final = { bytes: textured, triangles: plain.triangles, gates: plain.gates, report: plain.report, compression: 'none' }
  } else {
    const after = await finalGates(bytes, compressed.report, spec)
    return { ok: false, gates: [...compressed.gates.map((g) => (g.ok ? g : { ...g, detail: `after Draco: ${g.detail}` })), ...carried, ...after], bytes }
  }

  const after = await finalGates(final.bytes, final.report, spec)
  if (!allOk(after)) return { ok: false, gates: [...final.gates, ...carried, ...after], bytes: final.bytes }
  const hasWebp = final.report.textures.length > 0 && final.report.textures.every((t) => t.mimeType === 'image/webp')
  return {
    ok: true,
    shipped: { bytes: final.bytes, triangles: final.triangles, gates: [...final.gates, ...carried, ...after], compression: final.compression, textures: hasWebp ? 'webp' : 'none' },
  }
}

/** Builds one asset. Precondition problems (unknown spec, no photos, unreadable --raw, no Blender) throw; everything else is in the report. */
export async function buildAsset(id: string, opts: BuildOpts, deps: Partial<BuildDeps> = {}): Promise<BuildReport> {
  const d = resolveDeps(deps)
  const spec = d.loadSpec(id)
  const dryRun = opts.dryRun === true
  const scripted = opts.scripted === true
  if (scripted) {
    // Free of side effects: a bad scripted request fails before any directory or file exists.
    if (opts.rawGlb) throw new Error('scripted and rawGlb exclude each other: a scripted build makes its own raw GLB')
    if (!spec.build) throw new Error(`${id}: no build block in the spec, so it cannot be built with --scripted`)
    const errors = validateBuild(spec)
    if (errors.length > 0) throw new Error(errors.join('; '))
  } else if (opts.projectFrom || (opts.projectPhotos ?? []).length > 0) {
    throw new Error('projectFrom and projectPhotos go with scripted: the picture is mapped onto a scripted shape')
  }
  const hybrid = scripted && (opts.projectFrom !== undefined || (opts.projectPhotos ?? []).length > 0)
  // A yaw of 90 or 270 degrees swaps the model's width and depth after the fix-up has matched them to the spec, so on a
  // footprint that is not square the proportion gate fails the same way on every attempt: refuse before anything is spent.
  const yaw = opts.yawDeg ?? 0
  if ((yaw === 90 || yaw === 270) && Math.abs(spec.realSizeMm.w - spec.realSizeMm.d) / Math.max(spec.realSizeMm.w, spec.realSizeMm.d) > 0.005) {
    throw new Error(`yaw ${yaw} on ${id}: the footprint is non-square (${spec.realSizeMm.w} x ${spec.realSizeMm.d} mm) and this yaw swaps width and depth, so the model could never match the spec (use 0 or 180); nothing was spent`)
  }
  // A plain scripted model has no photo texture, so there is no logo to remove; a hybrid carries a Meshy picture made from photos.
  const logosRemoved = (scripted && !hybrid) || opts.logosRemoved === true
  if (!dryRun && !logosRemoved) {
    throw new Error(`refusing to ship ${id}: shipping writes public/assets and the manifest, and needs the assertion that the textures carry no logos (logosRemoved, the CLI flag --logos-removed)`)
  }
  const apiKey = process.env.MESHY_API_KEY ?? ''
  const scrub = (text: string): string => redact(text, apiKey)

  let rawBytes: Uint8Array | null = null
  let photos: PhotoFile[] = []
  if (opts.rawGlb) {
    rawBytes = new Uint8Array(await readFile(opts.rawGlb))
    // a hand-downloaded Meshy GLB: record the reference photos it was made from (listed, never sent anywhere)
    if (opts.rawTaskId) photos = await d.readPhotos(id)
  } else if (hybrid && opts.rawTaskId) {
    photos = await d.readPhotos(id) // the reference photos the Meshy picture was made from (listed in the manifest, never sent)
  } else if (!scripted) {
    photos = await d.readPhotos(id)
    if (photos.length === 0) {
      throw new Error(`no photos for ${id}: put 1 to ${MAX_PHOTOS} reference images (png, jpg or webp) in ${join(d.paths.sourceDir, id, 'photos')}`)
    }
  }
  if (deps.runFixup === undefined && !findBlender()) {
    throw new Error('Blender is not installed (not found at the default 5.1 path): install Blender 5.1 or set BLENDER_EXE to blender.exe')
  }

  // The schema check of loadSpec says nothing about the catalog: a port id that is not the device's would only show up
  // in the sim after paying. Check parity before the first Meshy call, and before anything ships.
  if (!rawBytes || !dryRun) {
    const errors = checkSpecParity(spec, d.loadCatalog())
    if (errors.length > 0) throw new Error(`spec ${id} does not match content/catalog.json, nothing was spent:\n  ${errors.join('\n  ')}`)
  }

  // Fail before the first paid call if the manifest could not be written afterwards.
  if (!dryRun) assertManifestUsable(d.paths.manifestPath)

  const dir = join(d.paths.sourceDir, id)
  const runStamp = d.now().toISOString().replace(/[:.]/g, '-')
  const work = join(dir, 'work', runStamp)
  await mkdir(work, { recursive: true })

  const report: BuildReport = { id, ok: false, attempts: [], dryRun, workDir: work }
  if (scripted) report.scripted = true
  if (hybrid) report.hybrid = true
  if (hybrid && opts.projectFrom) report.meshyPicture = true
  if (hybrid && (opts.projectPhotos ?? []).length > 0) report.projectPhotoNames = (opts.projectPhotos ?? []).map((p) => basename(p.file))
  const maxAttempts = rawBytes || scripted ? 1 : opts.maxAttempts
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
      const rawPath = join(work, `attempt-${n}.raw.glb`)
      let raw: Uint8Array | null = null
      if (scripted) {
        let projections: BuildProjection[] | undefined
        if (hybrid) {
          const wanted = spec.build?.projection ?? 'io'
          const faces = Array.isArray(wanted) ? wanted : [wanted]
          const photos = opts.projectPhotos ?? []
          for (const p of photos) {
            if (!faces.includes(p.face)) throw new Error(`--project-photo ${p.face}: the spec's build.projection is ${faces.join(', ')}, it has no ${p.face} face`)
          }
          projections = []
          for (const face of faces) {
            const photo = photos.find((p) => p.face === face)
            // a picture may be moved sideways (spec build.projectionShiftMm) so that it moves with the ports it shows
            const shifted = async (pr: Projection): Promise<Uint8Array> => {
              const mm = face === 'wrap' ? undefined : spec.build?.projectionShiftMm?.[face]
              return mm ? shiftPictureX(pr.png, mm, pr.faceMm.w) : pr.png
            }
            if (photo) {
              projections.push({ face, png: await shifted(await d.photoProjection(photo, face, spec.realSizeMm)) })
            } else if (opts.projectFrom) {
              projections.push({ face, png: await shifted(await d.renderProjection(opts.projectFrom, face, spec.realSizeMm)) })
            } else {
              throw new Error(`the ${face} face has no picture: give --project <fixed Meshy glb> or --project-photo ${face}=<photo>`)
            }
          }
          if (opts.rawTaskId) attempt.taskId = opts.rawTaskId
          d.log(`projecting ${faces.map((f) => (photos.some((p) => p.face === f) ? f + ' (photo)' : f + ' (Meshy)')).join(', ')}`)
        }
        await d.runBuilder(spec, rawPath, projections)
      } else if (rawBytes) {
        raw = opts.slab ? await orientSlab(rawBytes, spec.realSizeMm) : rawBytes
        if (opts.rawTaskId) attempt.taskId = opts.rawTaskId
      } else {
        const taskId = await d.meshy.createMultiImageTask(photos.map((ph) => ph.dataUri), { targetPolycount: targetPolycount(spec), topology: 'triangle' })
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
      const fixedPath = join(work, `attempt-${n}.fixed.glb`)
      if (raw) await writeFile(rawPath, raw)
      await persist()

      const fixup = await d.runFixup(rawPath, fixedPath, spec, { yawDeg: opts.yawDeg ?? 0, flipUpright: opts.flipUpright === true, ...(scripted ? { recess: false } : {}) })
      await persist()
      if (d.renderSheet) {
        // The review image for this attempt (yaw / flip are read off it). Best effort: never fails the build.
        const sheet = join(work, `attempt-${n}.sheet.png`)
        try {
          await d.renderSheet(fixedPath, photos[0]?.path ?? null, sheet, spec)
          d.log(`contact sheet ${sheet}`)
        } catch (e) {
          d.log(`warning: the contact sheet of attempt ${n} failed (the build goes on): ${scrub(e instanceof Error ? e.message : String(e))}`)
        }
      }
      const fixed = new Uint8Array(await readFile(fixedPath))
      const fixedMeasure = await measure(fixed, spec)
      const drift = checkProportionDrift(fixup.preScaleSizeM, spec)
      // The ray-cast gate runs when the fix-up measured the ports (always with Blender; fakes and old reports have none).
      const surface = fixup.portSurface ? [checkPortSurface(fixup.portSurface, spec, { recessCut: !scripted })] : []
      attempt.gates = [...fixedMeasure.gates, drift, ...surface]
      await persist()
      const failed = failingNames(attempt.gates)
      if (failed.length > 0) {
        // Only a failure of the Meshy model itself buys a new task; anything our fix-up produced aborts.
        if (attempt.gates.filter((g) => !g.ok).every((g) => g.retryable !== false && RETRYABLE_GATES.has(g.gate))) continue
        throw pipelineDefectError(failed, `attempt ${n}, fixed GLB`, work)
      }

      const result = await optimizeAndRegate(fixed, [drift, ...surface], spec, d, scripted, hybrid)
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
      const built = join(work, 'final.glb')
      await writeFile(built, shipped.bytes)
      report.builtGlb = built
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
            ...provenanceOf({
              scripted,
              hybrid,
              meshyPicture: hybrid && opts.projectFrom !== undefined,
              raw: rawBytes !== null,
              taskId: attempt.taskId ?? null,
              referencePhotos: photos.map((ph) => ph.name),
              projectPhotos: report.projectPhotoNames ?? [],
            }),
            date: d.now().toISOString(),
            specSource: spec.sources[0]?.url ?? 'spec',
            logosRemoved,
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

export interface ShipRunOpts {
  /** The founder checked the textures for logos (not needed for a scripted run, which has none). */
  logosRemoved?: boolean
}

/**
 * Ships the final.glb of a finished run (assets-source/<id>/work/<run>) to public/assets and the manifest WITHOUT building
 * anything again: no Meshy call, no fix-up, no compression. The earlier run must have passed; the bytes are re-measured
 * with every gate (the stored proportion-drift result stands in for the fix-up's pre-scale size, which is not on disk).
 * Throws on anything that does not hold, before writing a byte.
 */
export async function shipRun(id: string, runDir: string, opts: ShipRunOpts = {}, deps: Partial<BuildDeps> = {}): Promise<BuildReport> {
  const d = resolveDeps(deps)
  const spec = d.loadSpec(id)
  const dir = resolve(runDir)
  let stored: BuildReport
  try {
    stored = JSON.parse(await readFile(join(dir, 'report.json'), 'utf8')) as BuildReport
  } catch {
    throw new Error(`no readable report.json in ${dir}: it is not a run folder of assets-source/<id>/work`)
  }
  if (stored.id !== id) throw new Error(`the run in ${dir} belongs to ${stored.id}, not ${id}`)
  if (stored.ok !== true) throw new Error(`the run in ${dir} did not pass: only a passing run can be shipped`)
  const finalPath = join(dir, 'final.glb')
  if (!existsSync(finalPath)) throw new Error(`no final.glb in ${dir}`)
  const scripted = stored.scripted === true
  const hybrid = stored.hybrid === true
  if ((!scripted || hybrid) && opts.logosRemoved !== true) {
    throw new Error(`refusing to ship ${id}: its textures need the assertion that they carry no logos (--logos-removed)`)
  }

  const errors = checkSpecParity(spec, d.loadCatalog())
  if (errors.length > 0) throw new Error(`spec ${id} does not match content/catalog.json, nothing was shipped:\n  ${errors.join('\n  ')}`)
  assertManifestUsable(d.paths.manifestPath)

  const last = stored.attempts[stored.attempts.length - 1]
  const drift = last?.gates.find((g) => g.gate === 'proportionDrift')
  if (!drift || !drift.ok) throw new Error(`the run in ${dir} has no passing proportionDrift result: rebuild it`)
  const bytes = new Uint8Array(await readFile(finalPath))
  const measured = await measure(bytes, spec)
  const gates = [...measured.gates, drift, ...(await finalGates(bytes, measured.report, spec))]
  const failed = failingNames(gates)
  if (failed.length > 0) throw new Error(`the final.glb in ${dir} no longer passes: gate${failed.length === 1 ? '' : 's'} ${failed.join(', ')} failed`)

  const target = join(d.paths.assetsDir, `${id}.glb`)
  await writeAtomic(target, bytes)
  const taskId = last?.taskId ?? null
  try {
    recordAsset(d.paths.manifestPath, {
      id,
      kind: spec.kind,
      status: 'ok',
      tris: measured.triangles,
      ports: spec.ports.length,
      ...provenanceOf({
        scripted,
        hybrid,
        meshyPicture: stored.meshyPicture === true,
        raw: !scripted && !taskId,
        taskId,
        referencePhotos: taskId ? (await d.readPhotos(id)).map((ph) => ph.name) : [],
        projectPhotos: stored.projectPhotoNames ?? [],
      }),
      date: d.now().toISOString(),
      specSource: spec.sources[0]?.url ?? 'spec',
      logosRemoved: true,
      gates: gates.map((g) => ({ gate: g.gate, ok: g.ok })),
    })
  } catch (e) {
    throw new Error(`the GLB was written to ${target} but the manifest was not updated: ${e instanceof Error ? e.message : String(e)}`)
  }
  return { id, ok: true, attempts: stored.attempts, dryRun: false, workDir: dir, builtGlb: finalPath, finalGlb: target, ...(scripted ? { scripted: true as const } : {}), ...(hybrid ? { hybrid: true as const } : {}) }
}

/** The manifest's provenance fields of one build: how it was made, with what, from which photos, and what that means for the licence fields. */
export function provenanceOf(i: {
  scripted: boolean
  hybrid: boolean
  /** A Meshy render was projected onto the shape (hybrid only). */
  meshyPicture: boolean
  /** A hand-made / hand-downloaded raw GLB (no scripted build). */
  raw: boolean
  taskId: string | null
  referencePhotos: string[]
  projectPhotos: string[]
}): Pick<ManifestEntry, 'tool' | 'toolVersion' | 'photos' | 'taskId'> & Partial<Pick<ManifestEntry, 'source' | 'license' | 'trademark'>> {
  const meshyInvolved = i.taskId !== null && (!i.scripted || i.meshyPicture)
  const photos = [...new Set([...(meshyInvolved ? i.referencePhotos : []), ...i.projectPhotos])]
  const FROM_PHOTOS = 'generated or textured from manufacturer reference photos (private modelling reference, not redistributed); brand marks repainted where noticed'
  if (i.hybrid) {
    return {
      tool: 'hybrid',
      toolVersion: i.meshyPicture ? `${BUILDER_VERSION}+${MESHY_MODEL}` : BUILDER_VERSION,
      photos,
      taskId: meshyInvolved ? i.taskId : null,
      source: i.meshyPicture ? 'hybrid: own scripted geometry + Meshy render and/or official photo as texture' : 'hybrid: own scripted geometry + official photo as texture',
      license: FROM_PHOTOS,
      trademark: 'branded-internal',
    }
  }
  if (i.scripted) return { tool: 'scripted', toolVersion: BUILDER_VERSION, photos: [], taskId: null, source: 'modeled', license: 'internal (own work)', trademark: 'generic' }
  if (i.raw && i.taskId === null) return { tool: 'raw', toolVersion: 'raw', photos: [], taskId: null }
  return { tool: 'meshy', toolVersion: MESHY_MODEL, photos, taskId: i.taskId, source: 'ai-meshy', license: FROM_PHOTOS, trademark: 'branded-internal' }
}

/** A readable gate table per attempt, the credits, and the verdict. */
export function formatReport(report: BuildReport): string {
  const lines = [`asset ${report.id}${report.dryRun ? '  (not shipped: nothing written to public/assets or the manifest)' : ''}`]
  for (const a of report.attempts) {
    lines.push(`attempt ${a.n}  credits: ${a.credits === null ? 'n/a' : String(a.credits)}`)
    if (a.gates.length === 0) lines.push('  (no gates ran)')
    for (const g of a.gates) lines.push(`  ${g.ok ? 'PASS' : 'FAIL'}  ${g.gate.padEnd(16)}${g.detail}`)
    if (a.compression) lines.push(`  compression: ${a.compression}, textures: ${a.textures ?? 'none'}`)
  }
  if (report.error) lines.push(`error: ${report.error}`)
  if (report.ok && report.finalGlb) lines.push(`result: PASS, shipped ${report.finalGlb}`)
  else if (report.ok && report.dryRun) {
    lines.push(`result: PASS (dry run, not shipped): ${report.builtGlb ?? report.workDir}`)
    lines.push(`  review the contact sheet (npm run asset:sheet), then rerun with ${report.scripted ? '--ship' : '--ship --logos-removed'} to ship`)
  } else if (report.ok) lines.push('result: PASS')
  else lines.push('result: FAIL')
  return lines.join('\n')
}

const USAGE = [
  'usage: npm run asset:build -- <id> [--raw file.glb] [--attempts 3] [--yaw 0|90|180|270] [--flip] [--yes] [--ship --logos-removed]',
  '       npm run asset:build -- <id> --scripted [--ship]',
  '       npm run asset:build -- <id> --ship-run <assets-source/<id>/work/<run>> [--logos-removed]',
  '       npm run asset:pilot -- --yes [--attempts 3] [--yaw 0|90|180|270] [--flip] [--ship --logos-removed]',
  '  default       build and gate everything, leave final.glb and report.json in the run\'s work dir; ship nothing',
  '  --yes         allow the Meshy spending printed before the run (needed unless --raw)',
  '  --ship        also write public/assets/<id>.glb and the manifest entry (needs --logos-removed)',
  '  --logos-removed  you checked the textures: no brand logos (recorded as logosRemoved: true)',
  '  --raw         use a hand-made raw GLB: no Meshy call, one attempt',
  '  --project-photo  with --scripted: face=file[@left,top,width,height]: the picture of that face is a straight-on photo (repeatable); other faces come from --project',
  '  --slab        with --raw: the GLB is a thin Meshy panel: turn its thin axis into the depth and restore the spec depth proportion before the fix-up',
  '  --meshy-task  with --raw: the id of the Meshy task the GLB was downloaded from; the manifest records Meshy provenance',
  '  --ship-run    ship the final.glb of an earlier passing run (re-gated) without building again: no Meshy call, no fix-up',
  '  --scripted    build the raw GLB with our own Blender builder from the spec build block: no Meshy, no spending, one attempt; --ship needs no --logos-removed',
  '  --yaw / --flip  turn the model about glTF Y / upside down (about glTF Z) in the fix-up, read off the contact sheet',
].join('\n')

interface CliArgs {
  id?: string
  pilot: boolean
  /** --yes: the user accepted the printed Meshy spending. */
  yes: boolean
  opts: BuildOpts
  /** --ship-run <dir>: ship a finished run instead of building. */
  shipRunDir?: string
}

/** Parses the command line; returns the parsed arguments or an error message that includes the usage. */
function parseArgs(argv: string[]): CliArgs | { error: string } {
  const bad = (why: string): { error: string } => ({ error: `${why}\n${USAGE}` })
  const opts: BuildOpts = { maxAttempts: 3 }
  let id: string | undefined
  let pilot = false
  let ship = false
  let dryRunFlag = false
  let logosRemoved = false
  let yes = false
  let attemptsGiven = false
  let shipRunDir: string | undefined
  let yawGiven = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') dryRunFlag = true // the default anyway, kept so old command lines still work
    else if (a === '--ship') ship = true
    else if (a === '--logos-removed') logosRemoved = true
    else if (a === '--yes') yes = true
    else if (a === '--flip') opts.flipUpright = true
    else if (a === '--pilot') pilot = true
    else if (a === '--scripted') opts.scripted = true
    else if (a === '--slab') opts.slab = true
    else if (a === '--project-photo') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) return bad('--project-photo needs face=file (or face=file@left,top,width,height)')
      try {
        ;(opts.projectPhotos ??= []).push(parsePhotoArg(v))
      } catch (e) {
        return bad(e instanceof Error ? e.message : String(e))
      }
    } else if (a === '--project') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) return bad('--project needs the fixed-up Meshy .glb whose picture is projected (an earlier run\'s attempt-1.fixed.glb)')
      opts.projectFrom = v
    }
    else if (a === '--ship-run') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) return bad('--ship-run needs the run folder (assets-source/<id>/work/<run>)')
      shipRunDir = v
    }
    else if (a === '--raw') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) return bad('--raw needs a .glb file path')
      opts.rawGlb = v
    } else if (a === '--meshy-task') {
      const v = argv[++i]
      if (!v || !/^[0-9A-Za-z-]{8,64}$/.test(v)) return bad('--meshy-task needs the Meshy task id (letters, digits and dashes)')
      opts.rawTaskId = v
    } else if (a === '--attempts') {
      const n = Number(argv[++i])
      if (!Number.isInteger(n) || n < 1) return bad('--attempts must be a whole number of at least 1')
      opts.maxAttempts = n
      attemptsGiven = true
    } else if (a === '--yaw') {
      const n = Number(argv[++i])
      if (!YAWS.includes(n)) return bad('--yaw must be 0, 90, 180 or 270')
      opts.yawDeg = n as YawDeg
      yawGiven = true
    } else if (a.startsWith('--')) return bad(`unknown option ${a}`)
    else if (id === undefined) id = a
    else return bad(`unexpected argument ${a}`)
  }
  if (pilot && (id !== undefined || opts.rawGlb)) return bad('--pilot takes no id and no --raw')
  if (opts.rawTaskId && !opts.rawGlb && !opts.projectFrom && !(opts.projectPhotos ?? []).length) return bad('--meshy-task goes with --raw or --project: it names the Meshy task the GLB came from')
  if (opts.slab && !opts.rawGlb) return bad('--slab goes with --raw: it orients the thin Meshy panel in the GLB you give')
  if ((opts.projectFrom || (opts.projectPhotos ?? []).length > 0) && !opts.scripted) return bad('--project and --project-photo go with --scripted: the picture is mapped onto a scripted shape')
  if (shipRunDir !== undefined) {
    // Shipping a finished run builds nothing: every flag that shapes a build is meaningless and would be silently ignored.
    const clash = [opts.rawGlb ? '--raw' : '', opts.scripted ? '--scripted' : '', attemptsGiven ? '--attempts' : '', yawGiven ? '--yaw' : '', opts.flipUpright ? '--flip' : '', pilot ? '--pilot' : '', ship ? '--ship' : '', dryRunFlag ? '--dry-run' : ''].filter(Boolean)
    if (clash.length > 0) return bad(`--ship-run cannot be combined with ${clash.join(', ')}: it ships the final.glb of an earlier run without building`)
    if (id === undefined) return bad('an asset id is required')
    opts.logosRemoved = logosRemoved
    return { id, pilot: false, yes, opts, shipRunDir }
  }
  if (opts.scripted) {
    // A scripted build is already oriented, makes one attempt and has no photos: these flags would be silently ignored.
    const clash = [opts.rawGlb ? '--raw' : '', attemptsGiven ? '--attempts' : '', yawGiven ? '--yaw' : '', opts.flipUpright ? '--flip' : '', pilot ? '--pilot' : ''].filter(Boolean)
    if (clash.length > 0) return bad(`--scripted cannot be combined with ${clash.join(', ')}: a scripted build is already oriented, makes one attempt and has no photos`)
  }
  if (!pilot && id === undefined) return bad('an asset id is required')
  if (ship && dryRunFlag) return bad('--ship and --dry-run contradict each other')
  if (ship && !logosRemoved && (!opts.scripted || opts.projectFrom || (opts.projectPhotos ?? []).length > 0)) {
    return bad('--ship is refused without --logos-removed: open the textures, make sure no brand logo is left, then pass --ship --logos-removed (the manifest records logosRemoved: true)')
  }
  opts.dryRun = !ship
  if (ship) opts.logosRemoved = true
  return { id, pilot, yes, opts }
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
  if (args.shipRunDir !== undefined) {
    try {
      print(formatReport(await shipRun(args.id as string, args.shipRunDir, { logosRemoved: args.opts.logosRemoved }, deps)))
      return 0
    } catch (e) {
      print(`error: ${redact(e instanceof Error ? e.message : String(e), process.env.MESHY_API_KEY ?? '')}`)
      return 1
    }
  }
  if (args.pilot || (!args.opts.rawGlb && !args.opts.scripted)) {
    // Spending guard: say the most this run can spend, and spend nothing without an explicit --yes.
    const tasks = (args.pilot ? PILOT_IDS.length : 1) * args.opts.maxAttempts
    print(`will create up to ${tasks} Meshy task${tasks === 1 ? '' : 's'}, about ${CREDITS_PER_TASK} credits each, max ${tasks * CREDITS_PER_TASK} credits`)
    if (!args.yes) {
      print('refusing to call Meshy without --yes (add --yes to accept this spending, or use --raw file.glb for a free run)')
      return 1
    }
  }
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
