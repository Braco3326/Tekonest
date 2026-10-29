/**
 * assets3d/contactSheet: the review image of one model, four orthographic views plus the reference photo.
 *
 * Split in two so that almost everything is testable without Blender:
 *  - renderContactSheet measures the GLB (inspectGlb), plans four cameras and asks Blender
 *    (tools/assets3d/blender/render_views.py) to render ONE thing: four 512 px PNGs, io / back / left / top. Blender
 *    measures nothing and converts nothing: plan.json carries the camera locations and rotations in Blender space, the
 *    ortho scale, the clip range and the background colour. Command line (`--python-exit-code 1` turns an uncaught
 *    Python error into exit 1):
 *
 *      blender --background --factory-startup --python-exit-code 1 --python render_views.py --
 *              --in <glb> --plan <plan.json> --out-dir <dir>      (writes <dir>/{io,back,left,top}.png)
 *
 *  - composeSheet (pure sharp) puts the four views in a row, adds the reference photo as a fifth panel letterboxed
 *    into 512 x 512 on the same grey (never stretched), labels each panel, and, when a spec is given, draws the spec's
 *    bounding rectangle outline in every view in that view's projection.
 *
 * Views, in file space (glTF, +Y up, the I/O face at +Z; Blender is Z-up with that face at -Y, glTF (x, y, z) =
 * Blender (x, -z, y)):
 *   io    camera at the I/O face looking at the model: width horizontal, height vertical
 *   back  the opposite face: width x height, mirrored left to right
 *   left  camera at glTF -X: depth horizontal (the I/O side is on the right), height vertical
 *   top   camera above: width horizontal, depth vertical, the I/O side at the bottom of the image
 * All four share one ortho scale and aim at the bbox centre, so the sheet is comparable and the overlay maths
 * (specRectInView) needs only the scale: a model that matches the spec fills the rectangle exactly. The clip start
 * is 1 mm: an older pipeline cut 2-3 cm connectors with a larger one.
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import type { OverlayOptions } from 'sharp'
import { findBlender } from './env'
import { inspectGlb } from './inspect'
import type { ExecResult } from './runFixup'
import type { AssetSpecT } from './specSchema'

/** Absolute path of the Python script Blender runs. */
export const RENDER_SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'blender', 'render_views.py')

/** The four rendered views, in sheet order. */
export const VIEW_NAMES = ['io', 'back', 'left', 'top'] as const
export type ViewName = (typeof VIEW_NAMES)[number]

/** Side of one square panel, in pixels. */
export const PANEL_PX = 512
/** Flat background of the views and of the photo's letterbox bars, sRGB 8 bit. */
export const GREY_SRGB = 224
/** Colour of the spec rectangle outline. */
export const OVERLAY_RGB = [255, 0, 170] as const
/** Outline thickness in pixels; it straddles the rectangle edge: [edge - 1, edge + 1) for 2. */
const STROKE_PX = 2
/** The model's largest extent fills 1 / MARGIN of the frame (20 percent margin). */
const MARGIN = 1.2
/** Camera clip start, metres (1 mm). */
export const CLIP_START_M = 0.001

/** Blender wall-clock limit; four Workbench renders take seconds. */
const TIMEOUT_MS = 5 * 60 * 1000
const MAX_BUFFER = 64 * 1024 * 1024
const STDERR_TAIL = 2000

type Vec3 = [number, number, number]

/** What the cameras look at: the bbox centre (glTF space, metres) and the ortho scale shared by every view. */
export interface Framing {
  centreM: Vec3
  orthoScaleM: number
}

/** The four rendered view files (paths or encoded bytes) and the framing they were rendered with. */
export interface ViewPngs extends Record<ViewName, string | Uint8Array> {
  framing: Framing
}

/** One camera, in Blender space (metres, XYZ euler degrees). A Blender camera looks along its local -Z, up is +Y. */
export interface CameraView {
  name: ViewName
  location: Vec3
  rotationDeg: Vec3
  /** Distance from the aim point. */
  distanceM: number
}

export interface ContactSheetDeps {
  /** Runs `file` with `args` and resolves with the exit code; it must not reject on a non-zero exit. */
  exec?: (file: string, args: string[]) => Promise<ExecResult>
  /** Blender executable; undefined = findBlender(), null = none found. */
  blender?: string | null
}

/** child_process.execFile as a promise that resolves with the exit code instead of rejecting. */
function defaultExec(file: string, args: string[]): Promise<ExecResult> {
  return new Promise((done) => {
    execFile(file, args, { maxBuffer: MAX_BUFFER, timeout: TIMEOUT_MS, windowsHide: true }, (err, stdout, stderr) => {
      const raw = err ? (err as NodeJS.ErrnoException & { code?: number | string }).code : 0
      const code = typeof raw === 'number' ? raw : err ? 1 : 0
      const extra = err && typeof raw !== 'number' ? `\n${err.message}` : ''
      done({ code, stdout: String(stdout), stderr: String(stderr) + extra })
    })
  })
}

const MM = 0.001

/**
 * Centre and shared ortho scale for a model bbox (glTF world space, metres). The scale is the largest extent times
 * 1.2; when a spec is given its size counts too, so the overlay rectangle always stays in frame.
 */
export function computeFraming(bboxM: { min: Vec3; max: Vec3 }, spec?: AssetSpecT): Framing {
  const ext = bboxM.max.map((v, i) => v - bboxM.min[i])
  const all = [...bboxM.min, ...bboxM.max]
  if (!all.every(Number.isFinite)) throw new Error('the model bbox is not finite')
  const biggest = Math.max(...ext, ...(spec ? [spec.realSizeMm.w * MM, spec.realSizeMm.h * MM, spec.realSizeMm.d * MM] : []))
  if (!(biggest > 0)) throw new Error('the model bbox is empty or flat')
  const centreM = bboxM.min.map((v, i) => (v + bboxM.max[i]) / 2) as Vec3
  return { centreM, orthoScaleM: biggest * MARGIN }
}

/** glTF point (x, y, z) -> Blender (x, -z, y); `+ 0` turns -0 into 0. */
function toBlender(p: Vec3): Vec3 {
  return [p[0] + 0, -p[2] + 0, p[1] + 0]
}

/**
 * The four cameras in Blender space. `maxExtentM` is the largest model extent; the cameras sit 2 x that far from the
 * centre, outside the model on the side their name says (io = Blender -Y = glTF +Z).
 */
export function cameraViews(framing: Framing, maxExtentM: number): CameraView[] {
  const c = toBlender(framing.centreM)
  const d = 2 * maxExtentM
  const at = (dx: number, dy: number, dz: number): Vec3 => [c[0] + dx, c[1] + dy, c[2] + dz]
  return [
    { name: 'io', location: at(0, -d, 0), rotationDeg: [90, 0, 0], distanceM: d },
    { name: 'back', location: at(0, d, 0), rotationDeg: [90, 0, 180], distanceM: d },
    { name: 'left', location: at(-d, 0, 0), rotationDeg: [90, 0, -90], distanceM: d },
    { name: 'top', location: at(0, 0, d), rotationDeg: [0, 0, 0], distanceM: d },
  ]
}

/** sRGB 8 bit -> linear 0..1 (Blender's world colour is linear). */
function srgbToLinear(v8: number): number {
  const c = v8 / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/**
 * Pixel rectangle of the spec's bounding box in a view of `px` x `px` pixels rendered at `orthoScaleM` (the frame's
 * side in metres), centred because the cameras aim at the model's bbox centre. io / back show width x height, left
 * shows depth x height, top shows width x depth. Edges are rounded to whole pixels.
 */
export function specRectInView(view: ViewName, spec: AssetSpecT, orthoScaleM: number, px: number): { x: number; y: number; w: number; h: number } {
  const { w, h, d } = spec.realSizeMm
  const [horizontalMm, verticalMm] = view === 'left' ? [d, h] : view === 'top' ? [w, d] : [w, h]
  const wPx = ((horizontalMm * MM) / orthoScaleM) * px
  const hPx = ((verticalMm * MM) / orthoScaleM) * px
  const x0 = Math.round((px - wPx) / 2)
  const y0 = Math.round((px - hPx) / 2)
  const x1 = Math.round((px + wPx) / 2)
  const y1 = Math.round((px + hPx) / 2)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** Outline pixels of a rectangle (panel-local) into an RGBA buffer `width` px wide at panel offset `ox`. */
function strokeRect(buf: Buffer, width: number, height: number, ox: number, r: { x: number; y: number; w: number; h: number }): void {
  const put = (x: number, y: number): void => {
    if (x < ox || x >= ox + PANEL_PX || x >= width || y < 0 || y >= PANEL_PX || y >= height) return
    const i = (y * width + x) * 4
    buf[i] = OVERLAY_RGB[0]
    buf[i + 1] = OVERLAY_RGB[1]
    buf[i + 2] = OVERLAY_RGB[2]
    buf[i + 3] = 255
  }
  const half = STROKE_PX / 2
  const x0 = ox + r.x
  const x1 = ox + r.x + r.w
  const y0 = r.y
  const y1 = r.y + r.h
  for (let t = -half; t < half; t++) {
    for (let x = x0 - half; x < x1 + half; x++) {
      put(x, y0 + t)
      put(x, y1 + t)
    }
    for (let y = y0 - half; y < y1 + half; y++) {
      put(x0 + t, y)
      put(x1 + t, y)
    }
  }
}

/** SVG with one small label per panel (a missing system font only drops the text, never fails the sheet). */
function labelsSvg(names: string[], width: number): Buffer {
  const texts = names
    .map((n, i) => `<text x="${i * PANEL_PX + 10}" y="22" class="t">${n}</text>`)
    .join('')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${PANEL_PX}">` +
    '<style>.t{font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;fill:#202020}</style>' +
    `${texts}</svg>`
  return Buffer.from(svg)
}

/**
 * Writes the contact sheet PNG: the four views in a row, then (when given) the reference photo letterboxed into a
 * 512 x 512 panel, labels, and (when `spec` is given) the spec rectangle outline in every view. Pure sharp, no Blender.
 */
export async function composeSheet(views: ViewPngs, referencePhoto: string | null, outPng: string, spec?: AssetSpecT): Promise<void> {
  const bg = { r: GREY_SRGB, g: GREY_SRGB, b: GREY_SRGB }
  const panels = referencePhoto ? VIEW_NAMES.length + 1 : VIEW_NAMES.length
  const width = panels * PANEL_PX

  const layers: OverlayOptions[] = []
  for (const [i, name] of VIEW_NAMES.entries()) {
    const input = await sharp(views[name]).flatten({ background: bg }).resize(PANEL_PX, PANEL_PX, { fit: 'contain', background: bg }).png().toBuffer()
    layers.push({ input, left: i * PANEL_PX, top: 0 })
  }
  if (referencePhoto) {
    const input = await sharp(referencePhoto)
      .rotate() // honour the EXIF orientation of a phone photo
      .flatten({ background: bg })
      .resize(PANEL_PX, PANEL_PX, { fit: 'contain', background: bg }) // contain = letterbox, never stretch
      .png()
      .toBuffer()
    layers.push({ input, left: VIEW_NAMES.length * PANEL_PX, top: 0 })
  }

  if (spec) {
    const overlay = Buffer.alloc(width * PANEL_PX * 4) // transparent
    for (const [i, name] of VIEW_NAMES.entries()) {
      strokeRect(overlay, width, PANEL_PX, i * PANEL_PX, specRectInView(name, spec, views.framing.orthoScaleM, PANEL_PX))
    }
    layers.push({ input: overlay, raw: { width, height: PANEL_PX, channels: 4 }, left: 0, top: 0 })
  }
  layers.push({ input: labelsSvg([...VIEW_NAMES, ...(referencePhoto ? ['ref'] : [])], width), left: 0, top: 0 })

  await mkdir(dirname(resolve(outPng)), { recursive: true })
  await sharp({ create: { width, height: PANEL_PX, channels: 3, background: bg } })
    .composite(layers)
    .png()
    .toFile(outPng)
}

/**
 * Renders `glb` with Blender (four orthographic views) and writes the composed contact sheet to `outPng`.
 * Throws when Blender is missing, exits non-zero (the message carries the tail of stderr) or leaves a view out.
 */
export async function renderContactSheet(
  glb: string,
  referencePhoto: string | null,
  outPng: string,
  spec?: AssetSpecT,
  deps: ContactSheetDeps = {},
): Promise<void> {
  if (!/\.png$/i.test(outPng)) throw new Error(`the contact sheet output must be a .png file, got ${outPng}`)
  const blender = deps.blender === undefined ? findBlender() : deps.blender
  if (!blender) {
    throw new Error('Blender is not installed (not found at the default 5.1 path): install Blender 5.1 or set BLENDER_EXE to blender.exe')
  }
  const exec = deps.exec ?? defaultExec

  const report = await inspectGlb(new Uint8Array(await readFile(glb)))
  const framing = computeFraming(report.bboxM, spec)
  const maxExtentM = framing.orthoScaleM / MARGIN
  const views = cameraViews(framing, maxExtentM)
  const plan = {
    sizePx: PANEL_PX,
    orthoScaleM: framing.orthoScaleM,
    clipStartM: CLIP_START_M,
    clipEndM: views[0].distanceM + 4 * maxExtentM,
    backgroundLinear: [srgbToLinear(GREY_SRGB), srgbToLinear(GREY_SRGB), srgbToLinear(GREY_SRGB)],
    views: views.map((v) => ({ name: v.name, location: v.location, rotationDeg: v.rotationDeg })),
  }

  const tmp = await mkdtemp(join(tmpdir(), 'tekpractice-sheet-'))
  try {
    const planPath = join(tmp, 'plan.json')
    const outDir = join(tmp, 'views')
    await writeFile(planPath, JSON.stringify(plan, null, 2))
    const args = [
      '--background',
      '--factory-startup',
      '--python-exit-code', '1',
      '--python', RENDER_SCRIPT,
      '--',
      '--in', resolve(glb),
      '--plan', planPath,
      '--out-dir', outDir,
    ]
    const res = await exec(blender, args)
    if (res.code !== 0) {
      throw new Error(`Blender contact sheet of ${basename(glb)} failed (exit ${res.code}): ${res.stderr.trim().slice(-STDERR_TAIL) || '(no stderr)'}`)
    }

    const paths = {} as Record<ViewName, string>
    for (const name of VIEW_NAMES) {
      paths[name] = join(outDir, `${name}.png`)
      if (!existsSync(paths[name])) throw new Error(`Blender contact sheet of ${basename(glb)} exited 0 but wrote no ${name} view (${paths[name]})`)
    }
    await composeSheet({ ...paths, framing }, referencePhoto, outPng, spec)
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}
