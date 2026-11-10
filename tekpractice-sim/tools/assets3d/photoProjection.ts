/**
 * assets3d/photoProjection: a straight-on product photo as the picture of one face (the alternative to a Meshy render).
 *
 * For a FLAT panel (a rack unit's front or rear, a console's connector panel) the manufacturer's straight-on photo, on a white
 * background, is a better picture than anything Meshy makes: it is sharp and exactly rectified by the photographer. This module trims
 * the background, checks that the product has the face's aspect (a photo that is not straight-on, or shows extras, would stretch the
 * picture: refused with the two aspects), optionally crops first (pixels of the trimmed photo), resizes to the face aspect (at most
 * 2048 px wide) and lifts the colours for Mode Création's dim lights (the look step's rule). The result has the same shape as
 * `renderProjection`'s, and the builder maps it the same way. The photo stays private reference: a logo on it is repainted by the
 * spec's texture block like any other (the manifest records logosRemoved only when the founder side asserts it).
 *
 * Background fill (opt-in, `fillBackground` / the CLI suffix ",fill"): the product of a rounded casing does not fill its rectangle, so the corners of the
 * trimmed or cropped picture are white background. Mapped onto a curved shape (a filleted cabinet) those corners would land on the model as white specks.
 * With the option, the near-white pixels connected to the border (flood fill) are repainted row by row with the nearest product colour; a white
 * interior (a label) is not touched, and a picture that is mostly border-connected white (a white product) is left alone.
 */
import sharp from 'sharp'
import { liftChannel } from './look'
import { projectionFaceMm } from './projection'
import type { Projection, ProjectionFace } from './projection'

/** Widest image written, in pixels. */
const MAX_PX = 2048
/** How far the product's aspect may be from the face's before the photo is refused. */
const ASPECT_TOLERANCE = 0.08
/** A pixel counts as background when every channel is at least this bright. */
const BACKGROUND_FLOOR = 240

export interface PhotoOpts {
  /** [left, top, width, height] in pixels of the ORIGINAL photo: when given, the photo is cropped to it and NOT trimmed (a render with a reflection or a perspective top has no clean white margin). */
  crop?: [number, number, number, number]
  /** Repaint the border-connected background with the nearest product colour (see the file header). */
  fillBackground?: boolean
}

export interface PhotoArg {
  face: ProjectionFace
  file: string
  crop?: [number, number, number, number]
  /** The CLI suffix ",fill": see PhotoOpts.fillBackground. */
  fillBackground?: boolean
}

/** The most of the picture the border-connected white may cover before it is taken for a white product and left alone. */
const FILL_MAX_SHARE = 0.4
/** How many pixels inside the product the fill takes its colour from (its edge pixels are anti-aliased blends with the background). */
const FILL_EDGE_INSET = 4

const FACES: ProjectionFace[] = ['io', 'opposite', 'top', 'left', 'right', 'wrap']

/** `face=file`, `face=file@left,top,width,height`, either with the suffix `,fill` (the CLI's --project-photo). */
export function parsePhotoArg(arg: string): PhotoArg {
  const eq = arg.indexOf('=')
  if (eq < 0) throw new Error(`--project-photo needs face=file (or face=file@left,top,width,height), got "${arg}"`)
  const face = arg.slice(0, eq) as ProjectionFace
  if (!FACES.includes(face)) throw new Error(`--project-photo: face must be one of ${FACES.join(', ')}, got "${face}"`)
  let rest = arg.slice(eq + 1)
  const fillBackground = /,fill$/.test(rest)
  if (fillBackground) rest = rest.slice(0, -5)
  let crop: [number, number, number, number] | undefined
  const at = rest.lastIndexOf('@')
  if (at >= 0) {
    const nums = rest.slice(at + 1).split(',').map(Number)
    if (nums.length !== 4 || !nums.every((n) => Number.isInteger(n) && n >= 0) || nums[2] < 1 || nums[3] < 1) {
      throw new Error(`--project-photo: the crop must be four whole numbers left,top,width,height, got "${rest.slice(at + 1)}"`)
    }
    crop = nums as [number, number, number, number]
    rest = rest.slice(0, at)
  }
  if (!rest) throw new Error('--project-photo: no file after the face')
  return { face, file: rest, ...(crop ? { crop } : {}), ...(fillBackground ? { fillBackground } : {}) }
}

/** The face picture made from `file`, for a casing of size `sizeMm` (the spec's real size). */
export async function photoProjection(
  file: string,
  face: ProjectionFace,
  sizeMm: { w: number; h: number; d: number },
  opts: PhotoOpts = {},
): Promise<Projection> {
  const faceMm = projectionFaceMm(face, sizeMm)
  let img = sharp(file).rotate().flatten({ background: { r: 255, g: 255, b: 255 } })
  if (opts.crop) {
    const [left, top, width, height] = opts.crop
    img = sharp(await img.png().toBuffer()).extract({ left, top, width, height })
  } else {
    try {
      img = sharp(await img.trim({ background: '#ffffff', threshold: 255 - BACKGROUND_FLOOR + 1 }).png().toBuffer())
    } catch {
      throw new Error(`photoProjection: ${file} has nothing but background (an empty photo)`)
    }
  }
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let darkest = 255
  for (let i = 0; i < data.length; i++) if (data[i] < darkest) darkest = data[i]
  if (info.width < 16 || info.height < 8 || darkest >= BACKGROUND_FLOOR) throw new Error(`photoProjection: ${file} has nothing but background left after trimming (${info.width} x ${info.height} px)`)
  if (opts.fillBackground) fillBorderBackground(data, info.width, info.height)
  const aspect = info.width / info.height
  const faceAspect = faceMm.w / faceMm.h
  const off = Math.abs(aspect / faceAspect - 1)
  if (off > ASPECT_TOLERANCE) {
    throw new Error(
      `photoProjection: the product in ${file} is ${info.width} x ${info.height} px (aspect ${aspect.toFixed(3)}), the ${face} face is ${faceMm.w} x ${faceMm.h} mm (aspect ${faceAspect.toFixed(3)}): ${(off * 100).toFixed(1)} % apart, over ${ASPECT_TOLERANCE * 100} %. ` +
        'The photo is not straight-on or shows extras: give a crop (face=file@left,top,width,height, pixels of the original photo) or another photo',
    )
  }
  const width = Math.min(MAX_PX, info.width)
  const height = Math.max(1, Math.round((width * faceMm.h) / faceMm.w))
  const resized = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
    .resize(width, height, { fit: 'fill' })
    .raw()
    .toBuffer()
  for (let i = 0; i < resized.length; i++) resized[i] = liftChannel(resized[i])
  const png = await sharp(resized, { raw: { width, height, channels: 3 } }).png().toBuffer()
  return { png: new Uint8Array(png), faceMm }
}

/**
 * Repaints, in place, the near-white pixels connected to the border of the RGB picture `data` (width x height, 3 channels) with the nearest non-background
 * pixel of the same row (left side from the first product pixel to its right, right side from the last to its left); a row with no product copies the nearest row
 * that has some. Does nothing when more than FILL_MAX_SHARE of the picture is border-connected white.
 */
export function fillBorderBackground(data: Buffer, width: number, height: number): void {
  const isBg = (i: number): boolean => data[i * 3] >= BACKGROUND_FLOOR && data[i * 3 + 1] >= BACKGROUND_FLOOR && data[i * 3 + 2] >= BACKGROUND_FLOOR
  const mask = new Uint8Array(width * height)
  const stack: number[] = []
  const push = (x: number, y: number): void => {
    const i = y * width + x
    if (mask[i] === 0 && isBg(i)) {
      mask[i] = 1
      stack.push(i)
    }
  }
  for (let x = 0; x < width; x++) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    push(0, y)
    push(width - 1, y)
  }
  let count = 0
  while (stack.length > 0) {
    const i = stack.pop() as number
    count++
    const x = i % width
    const y = (i - x) / width
    if (x > 0) push(x - 1, y)
    if (x < width - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < height - 1) push(x, y + 1)
  }
  if (count === 0 || count > FILL_MAX_SHARE * width * height) return
  const rowHasProduct = new Uint8Array(height)
  for (let y = 0; y < height; y++) {
    let first = -1
    let last = -1
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] === 0) {
        if (first < 0) first = x
        last = x
      }
    }
    if (first < 0) continue
    rowHasProduct[y] = 1
    // the colour comes a few pixels inside the product: its anti-aliased edge pixels are blends with the white background and would paint a light fringe
    const fromLeft = Math.min(first + FILL_EDGE_INSET, last)
    const fromRight = Math.max(last - FILL_EDGE_INSET, first)
    for (let x = 0; x < first; x++) data.copyWithin((y * width + x) * 3, (y * width + fromLeft) * 3, (y * width + fromLeft) * 3 + 3)
    for (let x = last + 1; x < width; x++) data.copyWithin((y * width + x) * 3, (y * width + fromRight) * 3, (y * width + fromRight) * 3 + 3)
  }
  for (let y = 0; y < height; y++) {
    if (rowHasProduct[y] === 1) continue
    let src = -1
    for (let d = 1; d < height && src < 0; d++) {
      if (y - d >= 0 && rowHasProduct[y - d] === 1) src = y - d
      else if (y + d < height && rowHasProduct[y + d] === 1) src = y + d
    }
    if (src >= 0) data.copyWithin(y * width * 3, src * width * 3, (src + 1) * width * 3)
  }
}
