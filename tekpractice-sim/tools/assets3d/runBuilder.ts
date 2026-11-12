/**
 * assets3d/runBuilder: runs the Blender builder (tools/assets3d/blender/build_from_spec.py) that makes a raw GLB from a
 * spec's `build` block, with no Meshy involved. It mirrors runFixup: Node writes plan.json into a fresh temp dir,
 * Python does only the geometry and writes the GLB, or exits non-zero with a one-line `BUILD_FAIL <reason>` on stderr.
 * Command line (`--python-exit-code 1` turns an uncaught Python error into exit 1):
 *
 *   blender --background --factory-startup --python-exit-code 1 --python build_from_spec.py -- --plan <plan.json> --out <glb>
 *
 * plan.json: { id, kind, shape, sizeMm: {w,h,d}, matingOuterMm?, params, profile?, colours?, ports? (io-face ports, for shapes that cut socket pockets), flatZones? (control rectangles the shape must keep flat), projections? } (profile and colours only for revolve, revolve-oval and console-wedge; projections = [{ face, png }] map a picture of each face onto the shape). Sizes always come from the spec's realSizeMm.
 * The GLB is the raw input of attempt 1 of buildAsset: the fix-up and every gate run on it unchanged.
 * `exec` and `blender` are injectable so the contract is unit-tested without Blender.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findBlender } from './env'
import { flatZonesFor } from './flatZones'
import type { ProjectionFace } from './projection'
import { SHAPE_SPECS } from './shapes'
import { defaultExec } from './runFixup'
import type { FixupDeps } from './runFixup'
import { validateBuild } from './shapes'
import type { AssetSpecT } from './specSchema'

/** A picture of one face of a Meshy model to map onto the scripted shape (tools/assets3d/projection.ts makes it). */
export interface BuildProjection {
  face: ProjectionFace
  png: Uint8Array
}

/** What the builder measured on the mesh it made (written by build_from_spec.py next to its output, read back here). */
export interface BuilderMeasure {
  /** The smallest edge fillet the builder built, in millimetres (curved-cabinet, detailed rack-box): the 'fillet' gate checks it against build.minFilletMm. */
  filletMm?: number
  /** rack-box v2: how far the front plate stands in front of the chassis (the plate face is the bounding-box face the ports sit on), in millimetres. */
  ioFaceOffsetMm?: number
  /** rack-box v2: slotted ear holes and vent slots the builder cut. */
  earHoles?: number
  ventSlots?: number
  /** rack-box v3b: front vent slots, meter windows and ear handles the builder cut or built. */
  frontVents?: number
  windows?: number
  earHandles?: number
  /** moulded-box: the depth of the top recess and of the lid seam as built, and the angle the hinged lid was opened to, as measured. */
  recessDepthMm?: number
  seamDepthMm?: number
  lidAngleDeg?: number
  /** speaker-cabinet-v2: the recesses the builder cut (counts, depths and the pole socket diameter, all as built, in millimetres). */
  handleRecesses?: number
  handleDepthMm?: number
  poleSocketDiaMm?: number
  poleSocketDepthMm?: number
  rigPoints?: number
  rigDepthMm?: number
  grilleDepthMm?: number
}

/** Where the builder writes its measurements: next to the GLB, <name>.measure.json. */
export function measurePathOf(outGlb: string): string {
  return resolve(outGlb).replace(/\.glb$/i, '.measure.json')
}

/** Absolute path of the Python script Blender runs. */
export const BUILD_SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'blender', 'build_from_spec.py')

/** Recorded in the manifest as toolVersion of scripted assets. Bump it when the builder's output changes. */
export const BUILDER_VERSION = 'blender-builder-1'

/** How much of stderr goes into a thrown message when there is no BUILD_FAIL line. */
const STDERR_TAIL = 2000

/**
 * Builds the raw GLB `outGlb` for `spec` with Blender. Throws when the spec has no (valid) build block, Blender is
 * missing, or the script fails (the message carries the BUILD_FAIL reason). Nothing is created before the spec is checked.
 */
export async function runBuilder(spec: AssetSpecT, outGlb: string, deps: FixupDeps = {}, projection?: BuildProjection | BuildProjection[]): Promise<BuilderMeasure> {
  if (!spec.build) throw new Error(`${spec.id}: no build block in the spec, so it cannot be built with --scripted`)
  const errors = validateBuild(spec)
  if (errors.length > 0) throw new Error(errors.join('; '))
  if (!/\.glb$/i.test(outGlb)) throw new Error(`the builder output must be a .glb file, got ${outGlb}`)

  const blender = deps.blender === undefined ? findBlender() : deps.blender
  if (!blender) {
    throw new Error('Blender is not installed (not found at the default path): install Blender or set BLENDER_EXE to blender.exe')
  }
  const exec = deps.exec ?? ((file: string, args: string[]) => defaultExec(file, args))

  const plan = {
    id: spec.id,
    kind: spec.kind,
    shape: spec.build.shape,
    sizeMm: spec.realSizeMm,
    ...(spec.mating?.outerMm !== undefined ? { matingOuterMm: spec.mating.outerMm } : {}),
    params: spec.build.params ?? {},
    ...(spec.build.profile ? { profile: spec.build.profile } : {}),
    ...(spec.build.colours ? { colours: spec.build.colours } : {}),
    // a shape that keeps the controls rig's areas flat needs where they are (the device's control layout; none = no zones)
    ...(SHAPE_SPECS[spec.build.shape].usesFlatZones ? { flatZones: flatZonesFor(spec.id) } : {}),
    // a shape that cuts a pocket behind each inset port needs where they are (io face only: that is the face it cuts)
    ...(SHAPE_SPECS[spec.build.shape].usesPorts
      ? {
          ports: spec.ports
            .filter((p) => p.face === 'io')
            .map((p) => ({ portId: p.portId, xMm: p.xMm, yMm: p.yMm, ...(p.insetMm !== undefined ? { insetMm: p.insetMm } : {}), ...(p.openingMm !== undefined ? { openingMm: p.openingMm } : {}) })),
        }
      : {}),
  }

  const tmp = await mkdtemp(join(tmpdir(), 'tekpractice-builder-'))
  try {
    const planPath = join(tmp, 'plan.json')
    let planOut: Record<string, unknown> = plan
    const list = projection === undefined ? [] : Array.isArray(projection) ? projection : [projection]
    if (list.length > 0) {
      const projections = []
      for (const [i, pr] of list.entries()) {
        const pngPath = join(tmp, `projection-${i}.png`)
        await writeFile(pngPath, pr.png)
        projections.push({ face: pr.face, png: pngPath })
      }
      planOut = { ...plan, projections }
    }
    await writeFile(planPath, JSON.stringify(planOut, null, 2))
    const args = [
      '--background',
      '--factory-startup',
      '--python-exit-code', '1',
      '--python', BUILD_SCRIPT,
      '--',
      '--plan', planPath,
      '--out', resolve(outGlb),
    ]
    const res = await exec(blender, args)
    if (res.code !== 0) {
      const fail = /^BUILD_FAIL (.*)$/m.exec(res.stderr)
      const reason = fail ? fail[1].trim() : res.stderr.trim().slice(-STDERR_TAIL) || '(no stderr)'
      throw new Error(`Blender build of ${spec.id} failed (exit ${res.code}): ${reason}`)
    }
    return await readMeasure(measurePathOf(outGlb), spec.id)
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

/** Reads the measurements the builder wrote; {} when it wrote none (most shapes measure nothing). A malformed file is an error, never silently ignored. */
async function readMeasure(path: string, id: string): Promise<BuilderMeasure> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch {
    return {}
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Blender build of ${id} wrote a malformed measurement file (not JSON): ${path}`)
  }
  if (parsed === null || typeof parsed !== 'object') return {}
  const out: BuilderMeasure = {}
  for (const key of ['filletMm', 'ioFaceOffsetMm', 'earHoles', 'ventSlots', 'frontVents', 'windows', 'earHandles', 'recessDepthMm', 'seamDepthMm', 'lidAngleDeg', 'handleRecesses', 'handleDepthMm', 'poleSocketDiaMm', 'poleSocketDepthMm', 'rigPoints', 'rigDepthMm', 'grilleDepthMm'] as const) {
    const v = (parsed as Record<string, unknown>)[key]
    if (v === undefined) continue
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Blender build of ${id} wrote a ${key} that is not a finite number: ${String(v)}`)
    out[key] = v
  }
  return out
}
