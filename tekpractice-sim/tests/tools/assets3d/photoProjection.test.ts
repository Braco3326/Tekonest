/**
 * Tests for assets3d/photoProjection: a straight-on product photo (white background) as the picture of one face.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { liftChannel } from '../../../tools/assets3d/look'
import { parsePhotoArg, photoProjection } from '../../../tools/assets3d/photoProjection'

const SIZE = { w: 400, h: 100, d: 200 }

/** A photo: `bg` margins around a 400 x 100 px product whose left half is red (200, 30, 30) and right half blue (30, 30, 200). */
async function photo(dir: string, over: { productW?: number; productH?: number; bg?: number } = {}): Promise<string> {
  const pw = over.productW ?? 400
  const ph = over.productH ?? 100
  const bg = over.bg ?? 255
  const W = pw + 120
  const H = ph + 80
  const px = Buffer.alloc(W * H * 3, bg)
  for (let y = 40; y < 40 + ph; y++) for (let x = 60; x < 60 + pw; x++) px.set(x < 60 + pw / 2 ? [200, 30, 30] : [30, 30, 200], (y * W + x) * 3)
  const file = join(dir, 'p.png')
  await writeFile(file, await sharp(px, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer())
  return file
}

describe('photoProjection', () => {
  it('trims the background, keeps the product at the face aspect and lifts the colours', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'photoproj-'))
    try {
      const out = await photoProjection(await photo(dir), 'io', SIZE)
      expect(out.faceMm).toEqual({ w: 400, h: 100 })
      const { data, info } = await sharp(Buffer.from(out.png)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      expect([info.width, info.height]).toEqual([400, 100])
      const at = (x: number, y: number): number[] => Array.from(data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3))
      expect(at(5, 50)).toEqual([liftChannel(200), liftChannel(30), liftChannel(30)])
      expect(at(info.width - 5, 50)).toEqual([liftChannel(30), liftChannel(30), liftChannel(200)])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('uses the top face size (width x depth) for a top photo', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'photoproj-'))
    try {
      const out = await photoProjection(await photo(dir, { productW: 400, productH: 200 }), 'top', SIZE)
      expect(out.faceMm).toEqual({ w: 400, h: 200 })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('refuses a photo whose product aspect is more than 8 percent off the face (not straight-on, or extras in the frame)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'photoproj-'))
    try {
      await expect(photoProjection(await photo(dir, { productW: 400, productH: 140 }), 'io', SIZE)).rejects.toThrow(/aspect/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('an explicit crop (pixels of the ORIGINAL photo, no trimming) fixes a photo with extras around the product', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'photoproj-'))
    try {
      // the product is 400 x 140 px at (60, 40) in the original; the crop keeps its top 100 rows: 400 x 100 matches the face
      const out = await photoProjection(await photo(dir, { productW: 400, productH: 140 }), 'io', SIZE, { crop: [60, 40, 400, 100] })
      const meta = await sharp(Buffer.from(out.png)).metadata()
      expect([meta.width, meta.height]).toEqual([400, 100])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('caps the width at 2048 px, keeping the aspect', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'photoproj-'))
    try {
      const out = await photoProjection(await photo(dir, { productW: 3000, productH: 750 }), 'io', SIZE)
      const meta = await sharp(Buffer.from(out.png)).metadata()
      expect([meta.width, meta.height]).toEqual([2048, 512])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('refuses a photo that is all background', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'photoproj-'))
    try {
      const file = join(dir, 'blank.png')
      await writeFile(file, await sharp({ create: { width: 200, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } } }).png().toBuffer())
      await expect(photoProjection(file, 'io', SIZE)).rejects.toThrow(/nothing|empty|background/i)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('parsePhotoArg', () => {
  it('parses face=file and face=file@x,y,w,h', () => {
    expect(parsePhotoArg('io=assets-source/x/photos/rear.jpg')).toEqual({ face: 'io', file: 'assets-source/x/photos/rear.jpg' })
    expect(parsePhotoArg('top=a b/c.jpg@10,20,300,400')).toEqual({ face: 'top', file: 'a b/c.jpg', crop: [10, 20, 300, 400] })
  })
  it('refuses an unknown face, a missing file and a bad crop', () => {
    expect(() => parsePhotoArg('bottom=x.jpg')).toThrow(/face/)
    expect(() => parsePhotoArg('io=')).toThrow(/file/)
    expect(() => parsePhotoArg('io=x.jpg@1,2,3')).toThrow(/crop/)
    expect(() => parsePhotoArg('nonsense')).toThrow(/face=file/)
  })
})
