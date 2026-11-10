/**
 * Tests for assets3d/rectify: straightens a quadrilateral of a perspective photo (the top of a console seen from the front, a rack unit seen from a
 * 3/4 angle) into a flat rectangular face picture, by a homography with bilinear sampling.
 */
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { rectifyQuad, solveHomography } from '../../../tools/assets3d/rectify'

type Pt = [number, number]

/** A W x H RGB image from a per-pixel colour function. */
async function image(w: number, h: number, colour: (x: number, y: number) => [number, number, number]): Promise<Uint8Array> {
  const px = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.set(colour(x, y), (y * w + x) * 3)
  return new Uint8Array(await sharp(px, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer())
}

async function pixel(png: Uint8Array, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(Buffer.from(png)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const o = (y * info.width + x) * 3
  return [data[o], data[o + 1], data[o + 2]]
}

describe('solveHomography', () => {
  it('maps the four source points exactly onto the four destination points', () => {
    const src: Pt[] = [[10, 20], [190, 30], [170, 150], [30, 140]]
    const dst: Pt[] = [[0, 0], [100, 0], [100, 80], [0, 80]]
    const h = solveHomography(src, dst)
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i]
      const w = h[6] * x + h[7] * y + 1
      expect((h[0] * x + h[1] * y + h[2]) / w).toBeCloseTo(dst[i][0], 6)
      expect((h[3] * x + h[4] * y + h[5]) / w).toBeCloseTo(dst[i][1], 6)
    }
  })

  it('refuses four collinear points (no unique mapping)', () => {
    expect(() => solveHomography([[0, 0], [1, 1], [2, 2], [3, 3]], [[0, 0], [1, 0], [1, 1], [0, 1]])).toThrow(/degenerate|collinear|singular/i)
  })
})

describe('rectifyQuad', () => {
  // a 200 x 200 photo: the quad (a trapezoid, narrower at the top like a face seen in perspective) is red on its left half and blue on its right half
  const quad: [Pt, Pt, Pt, Pt] = [[60, 40], [140, 40], [180, 160], [20, 160]] // top-left, top-right, bottom-right, bottom-left
  const inside = (x: number, y: number): boolean => {
    if (y < 40 || y > 160) return false
    const t = (y - 40) / 120
    return x >= 60 - 40 * t && x <= 140 + 40 * t
  }
  const centreX = (): number => 100
  const photo = () => image(200, 200, (x, y) => (inside(x, y) ? (x < centreX() ? [200, 30, 30] : [30, 30, 200]) : [255, 255, 255]))

  it('outputs the requested size, with the quad flattened: no white from outside it, red on the left half, blue on the right half', async () => {
    const out = await rectifyQuad(await photo(), quad, 160, 120)
    const meta = await sharp(Buffer.from(out)).metadata()
    expect([meta.width, meta.height]).toEqual([160, 120])
    expect(await pixel(out, 5, 5)).toEqual([200, 30, 30]) // top-left corner of the face
    expect(await pixel(out, 154, 5)).toEqual([30, 30, 200]) // top-right
    expect(await pixel(out, 5, 114)).toEqual([200, 30, 30]) // bottom-left
    expect(await pixel(out, 154, 114)).toEqual([30, 30, 200]) // bottom-right
    expect(await pixel(out, 40, 60)).toEqual([200, 30, 30])
    expect(await pixel(out, 120, 60)).toEqual([30, 30, 200])
  })

  it('keeps the orientation: the first corner is the top-left of the result, the second the top-right', async () => {
    // the same photo with the corners given in another start order lands rotated: red on the TOP half when the order starts at the bottom-left
    const out = await rectifyQuad(await photo(), [quad[3], quad[0], quad[1], quad[2]], 160, 120)
    // corners now: top-left = old bottom-left (red side), top-right = old top-left (red), bottom-right = old top-right (blue), bottom-left = old bottom-right (blue)
    expect(await pixel(out, 80, 5)).toEqual([200, 30, 30])
    expect(await pixel(out, 80, 114)).toEqual([30, 30, 200])
  })

  it('refuses a size below 1 px and a quad with a point outside the photo', async () => {
    await expect(rectifyQuad(await photo(), quad, 0, 10)).rejects.toThrow(/size/)
    await expect(rectifyQuad(await photo(), [[60, 40], [140, 40], [180, 260], [20, 160]], 50, 50)).rejects.toThrow(/outside/)
  })
})
