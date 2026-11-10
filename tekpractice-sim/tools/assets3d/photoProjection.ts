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
}

export interface PhotoArg {
  face: ProjectionFace
  file: string
  crop?: [number, number, number, number]
}

const FACES: ProjectionFace[] = ['io', 'opposite', 'top', 'left', 'wrap']

/** `face=file` or `face=file@left,top,width,height` (the CLI's --project-photo). */
export function parsePhotoArg(arg: string): PhotoArg {
  const eq = arg.indexOf('=')
  if (eq < 0) throw new Error(`--project-photo needs face=file (or face=file@left,top,width,height), got "${arg}"`)
  const face = arg.slice(0, eq) as ProjectionFace
  if (!FACES.includes(face)) throw new Error(`--project-photo: face must be one of ${FACES.join(', ')}, got "${face}"`)
  let rest = arg.slice(eq + 1)
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
  return { face, file: rest, ...(crop ? { crop } : {}) }
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
