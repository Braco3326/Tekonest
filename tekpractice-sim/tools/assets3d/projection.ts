/**
 * assets3d/projection: the flat image of one face of a textured (Meshy) model, to be mapped onto our exact scripted shape.
 *
 * Meshy gets the LOOK of a panel right (labels, sockets, screens, fader strips) and the DEPTH of a box wrong. The scripted builder has
 * the opposite strengths. So the hybrid keeps our geometry (exact size, ports at the measured positions) and takes the picture from
 * Meshy: this module renders the (already fixed-up, so exactly spec-sized) Meshy model with ONE orthographic, flat-lit Blender view
 * of the face, crops the frame to the face rectangle and lifts the colours for Mode Création's dim lights (the look step's rule), and
 * returns the PNG. build_from_spec.py then maps it planar onto the scripted faces that look the same way.
 *
 * Face-local orientation (as the spec's ports): the image's x runs to the right seen from OUTSIDE the face and y up, which is what the
 * io / back / left / top views of the contact sheet already show. Blender is injectable (`exec`, `blender`) so the contract is tested
 * without it.
 */
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import sharp from 'sharp'
import { CLIP_START_M, RENDER_SCRIPT, cameraViews } from './contactSheet'
import type { Framing, ViewName } from './contactSheet'
import { findBlender } from './env'
import { inspectGlb } from './inspect'
import { liftChannel } from './look'
import { defaultExec } from './runFixup'
import type { ExecResult } from './runFixup'

/** Side of the square frame Blender renders, in pixels. */
export const PROJECTION_PX = 2048
/** The frame's side is this much larger than the face's larger side (a hair of margin so the face edge is never cut). */
const FRAME_MARGIN = 1.02
const TIMEOUT_MS = 5 * 60 * 1000
const STDERR_TAIL = 2000
const MM = 0.001

export type ProjectionFace = 'io' | 'opposite' | 'top' | 'left'
const VIEW_OF: Record<ProjectionFace, ViewName> = { io: 'io', opposite: 'back', top: 'top', left: 'left' }

export interface ProjectionDeps {
  /** Runs `file` with `args` and resolves with the exit code; it must not reject on a non-zero exit. */
  exec?: (file: string, args: string[]) => Promise<ExecResult>
  /** Blender executable; undefined = findBlender(), null = none found. */
  blender?: string | null
}

export interface Projection {
  /** The face image, PNG, face-local x to the right and y up as seen from outside. */
  png: Uint8Array
  /** The face rectangle in millimetres (measured from the model, rounded to 0.01 mm). */
  faceMm: { w: number; h: number }
}

/** Width x height of a face in millimetres for a casing of size `s`. Throws for a face the renderer has no view of. */
export function projectionFaceMm(face: ProjectionFace, s: { w: number; h: number; d: number }): { w: number; h: number } {
  switch (face) {
    case 'io':
    case 'opposite': return { w: s.w, h: s.h }
    case 'top': return { w: s.w, h: s.d }
    case 'left': return { w: s.d, h: s.h }
    default: throw new Error(`cannot project the ${String(face)} face: only io, opposite, top and left have a render view`)
  }
}

const round2 = (v: number): number => Math.round(v * 100) / 100

/**
 * Renders the face `face` of `glb` (a fixed-up model: pivot bottom-centre, spec size) and returns its cropped, lifted image.
 * Throws when Blender is missing, exits non-zero (the message carries the stderr tail) or writes no image.
 */
export async function renderProjection(glb: string, face: ProjectionFace, deps: ProjectionDeps = {}): Promise<Projection> {
  const viewName = VIEW_OF[face]
  if (!viewName) throw new Error(`cannot project the ${String(face)} face: only io, opposite, top and left have a render view`)
  const blender = deps.blender === undefined ? findBlender() : deps.blender
  if (!blender) {
    throw new Error('Blender is not installed (not found at the default 5.1 path): install Blender 5.1 or set BLENDER_EXE to blender.exe')
  }
  const exec = deps.exec ?? ((file: string, args: string[]) => defaultExec(file, args, TIMEOUT_MS))

  const report = await inspectGlb(new Uint8Array(await readFile(glb)))
  const extM = report.bboxM.max.map((v, i) => v - report.bboxM.min[i])
  const sizeMm = { w: round2(extM[0] / MM), h: round2(extM[1] / MM), d: round2(extM[2] / MM) }
  const faceMm = projectionFaceMm(face, sizeMm)
  const orthoScaleM = Math.max(faceMm.w, faceMm.h) * MM * FRAME_MARGIN
  const maxExtentM = Math.max(...extM)
  const framing: Framing = {
    centreM: report.bboxM.min.map((v, i) => (v + report.bboxM.max[i]) / 2) as [number, number, number],
    orthoScaleM,
  }
  const view = cameraViews(framing, maxExtentM).find((v) => v.name === viewName)
  if (!view) throw new Error(`no camera for the ${viewName} view`)

  const plan = {
    sizePx: PROJECTION_PX,
    orthoScaleM,
    clipStartM: CLIP_START_M,
    clipEndM: view.distanceM + 4 * maxExtentM,
    backgroundLinear: [0.2, 0.2, 0.2],
    light: 'FLAT',
    views: [{ name: view.name, location: view.location, rotationDeg: view.rotationDeg }],
  }

  const tmp = await mkdtemp(join(tmpdir(), 'tekpractice-projection-'))
  try {
    const planPath = join(tmp, 'plan.json')
    const outDir = join(tmp, 'views')
    await writeFile(planPath, JSON.stringify(plan, null, 2))
    const res = await exec(blender, [
      '--background', '--factory-startup', '--python-exit-code', '1',
      '--python', RENDER_SCRIPT,
      '--',
      '--in', resolve(glb),
      '--plan', planPath,
      '--out-dir', outDir,
    ])
    if (res.code !== 0) {
      throw new Error(`Blender projection of ${basename(glb)} failed (exit ${res.code}): ${res.stderr.trim().slice(-STDERR_TAIL) || '(no stderr)'}`)
    }
    const viewPng = join(outDir, `${view.name}.png`)
    if (!existsSync(viewPng)) throw new Error(`Blender projection of ${basename(glb)} exited 0 but wrote no ${view.name} view (${viewPng})`)

    // Crop the frame to the face rectangle (the camera aims at the bbox centre, so the face is centred).
    const wPx = Math.round((faceMm.w * MM / orthoScaleM) * PROJECTION_PX)
    const hPx = Math.round((faceMm.h * MM / orthoScaleM) * PROJECTION_PX)
    const left = Math.max(0, Math.round((PROJECTION_PX - (faceMm.w * MM / orthoScaleM) * PROJECTION_PX) / 2))
    const top = Math.max(0, Math.round((PROJECTION_PX - (faceMm.h * MM / orthoScaleM) * PROJECTION_PX) / 2))
    const { data, info } = await sharp(viewPng)
      .extract({ left, top, width: Math.min(wPx, PROJECTION_PX - left), height: Math.min(hPx, PROJECTION_PX - top) })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    for (let i = 0; i < data.length; i++) data[i] = liftChannel(data[i])
    const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer()
    return { png: new Uint8Array(png), faceMm }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}
