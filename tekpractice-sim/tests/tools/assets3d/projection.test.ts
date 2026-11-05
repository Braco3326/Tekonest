/**
 * Tests for assets3d/projection: renderProjection turns a textured (Meshy) model into the flat image of one of its faces, ready to be
 * mapped onto our exact scripted shape. Blender is replaced by a fake exec that writes the view the way render_views.py would.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { findBlender } from '../../../tools/assets3d/env'
import { liftChannel } from '../../../tools/assets3d/look'
import { PROJECTION_PX, projectionFaceMm, renderProjection, shiftPictureX } from '../../../tools/assets3d/projection'
import type { ExecResult } from '../../../tools/assets3d/runFixup'
import { makeBoxGlb } from './helpers'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'

const SIZE = { w: 0.4, h: 0.1, d: 0.2 } // metres: 400 x 100 x 200 mm

const argAfter = (args: string[], flag: string): string => args[args.indexOf(flag) + 1]

/** A fake render: for the one requested view writes a 2048 square whose left half is red (200, 30, 30) and right half blue (30, 30, 200). */
function fakeExec(): { exec: (file: string, args: string[]) => Promise<ExecResult>; plans: Record<string, unknown>[] } {
  const plans: Record<string, unknown>[] = []
  const exec = async (_file: string, args: string[]): Promise<ExecResult> => {
    const plan = JSON.parse(await readFile(argAfter(args, '--plan'), 'utf8')) as { views: { name: string }[] } & Record<string, unknown>
    plans.push(plan)
    const outDir = argAfter(args, '--out-dir')
    await mkdir(outDir, { recursive: true })
    const half = PROJECTION_PX / 2
    const px = Buffer.alloc(PROJECTION_PX * PROJECTION_PX * 3)
    for (let y = 0; y < PROJECTION_PX; y++) {
      for (let x = 0; x < PROJECTION_PX; x++) px.set(x < half ? [200, 30, 30] : [30, 30, 200], (y * PROJECTION_PX + x) * 3)
    }
    const png = await sharp(px, { raw: { width: PROJECTION_PX, height: PROJECTION_PX, channels: 3 } }).png().toBuffer()
    for (const v of plan.views) await writeFile(join(outDir, `${v.name}.png`), png)
    return { code: 0, stdout: '', stderr: '' }
  }
  return { exec, plans }
}

async function glbFile(dir: string): Promise<string> {
  const p = join(dir, 'm.glb')
  await mkdir(dirname(p), { recursive: true })
  await writeFile(p, await makeBoxGlb({ sizeM: SIZE }))
  return p
}

describe('projectionFaceMm', () => {
  it('is width x height on the io and opposite faces, width x depth on the top, depth x height on the left', () => {
    const s = { w: 400, h: 100, d: 200 }
    expect(projectionFaceMm('io', s)).toEqual({ w: 400, h: 100 })
    expect(projectionFaceMm('opposite', s)).toEqual({ w: 400, h: 100 })
    expect(projectionFaceMm('top', s)).toEqual({ w: 400, h: 200 })
    expect(projectionFaceMm('left', s)).toEqual({ w: 200, h: 100 })
  })
  it('refuses a face the renderer has no view for', () => {
    expect(() => projectionFaceMm('bottom' as never, { w: 1, h: 1, d: 1 })).toThrow(/bottom/)
  })
})

describe('shiftPictureX', () => {
  /** A 400 x 100 px picture (1 px = 1 mm on a 400 mm wide face): red left half (x < 200), blue right half. */
  const picture = async (): Promise<Uint8Array> => {
    const px = Buffer.alloc(400 * 100 * 3)
    for (let y = 0; y < 100; y++) for (let x = 0; x < 400; x++) px.set(x < 200 ? [200, 30, 30] : [30, 30, 200], (y * 400 + x) * 3)
    return new Uint8Array(await sharp(px, { raw: { width: 400, height: 100, channels: 3 } }).png().toBuffer())
  }
  const column = async (png: Uint8Array, x: number): Promise<number[]> => {
    const { data, info } = await sharp(Buffer.from(png)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    return Array.from(data.subarray((50 * info.width + x) * 3, (50 * info.width + x) * 3 + 3))
  }

  it('moves the picture to the right by the given millimetres, keeping its size and filling the gap with the edge colour', async () => {
    const out = await shiftPictureX(await picture(), 100, 400)
    const meta = await sharp(Buffer.from(out)).metadata()
    expect([meta.width, meta.height]).toEqual([400, 100])
    expect(await column(out, 10)).toEqual([200, 30, 30]) // the gap on the left: the old left edge, replicated
    expect(await column(out, 290)).toEqual([200, 30, 30]) // the red half now ends at 300
    expect(await column(out, 310)).toEqual([30, 30, 200])
  })

  it('moves it to the left for a negative shift, and leaves the same bytes for zero', async () => {
    const src = await picture()
    const out = await shiftPictureX(src, -100, 400)
    expect(await column(out, 90)).toEqual([200, 30, 30]) // the red half now ends at 100
    expect(await column(out, 110)).toEqual([30, 30, 200])
    expect(await column(out, 395)).toEqual([30, 30, 200]) // the gap on the right: the old right edge
    expect(await shiftPictureX(src, 0, 400)).toBe(src)
  })

  it('scales the shift by the picture width over the face width (a 2000 px picture of a 400 mm face: 5 px per mm)', async () => {
    const big = new Uint8Array(await sharp(Buffer.from(await picture())).resize(2000, 500, { kernel: 'nearest' }).png().toBuffer())
    const out = await shiftPictureX(big, 20, 400) // 100 px
    const { data, info } = await sharp(Buffer.from(out)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const at = (x: number): number[] => Array.from(data.subarray((250 * info.width + x) * 3, (250 * info.width + x) * 3 + 3))
    expect(at(1090)).toEqual([200, 30, 30]) // the red half ended at 1000 px, now at 1100
    expect(at(1110)).toEqual([30, 30, 200])
  })
})

describe('renderProjection', () => {
  it('asks Blender for ONE flat-lit view at 2048 px and crops it to the face rectangle, lifted for Mode Création', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'projection-'))
    try {
      const { exec, plans } = fakeExec()
      const out = await renderProjection(await glbFile(dir), 'io', { exec, blender: 'C:/fake/blender.exe' })
      expect(plans).toHaveLength(1)
      expect(plans[0]).toMatchObject({ sizePx: PROJECTION_PX, light: 'FLAT' })
      expect((plans[0].views as { name: string }[]).map((v) => v.name)).toEqual(['io'])
      // frame = 1.02 x the larger face side (400 mm) = 408 mm: the 400 x 100 mm face is 2008 x 502 px
      expect(out.faceMm).toEqual({ w: 400, h: 100 })
      const meta = await sharp(Buffer.from(out.png)).metadata()
      expect([meta.width, meta.height]).toEqual([2008, 502])
      const { data, info } = await sharp(Buffer.from(out.png)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      const at = (x: number, y: number): number[] => Array.from(data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3))
      // left of the face stays left (face-local x runs to the right seen from outside): red there, blue on the right, both lifted
      expect(at(10, 250)).toEqual([liftChannel(200), liftChannel(30), liftChannel(30)])
      expect(at(info.width - 10, 250)).toEqual([liftChannel(30), liftChannel(30), liftChannel(200)])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('refuses a source model whose size differs from the spec by more than 0.5 percent (a raw, not fixed-up, Meshy model would stretch the picture)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'projection-'))
    try {
      const { exec } = fakeExec()
      const glb = await glbFile(dir) // 400 x 100 x 200 mm
      await expect(renderProjection(glb, 'io', { exec, blender: 'C:/fake/blender.exe' }, { w: 400, h: 100, d: 220 })).rejects.toThrow(/FIXED-UP/)
      await expect(renderProjection(glb, 'io', { exec, blender: 'C:/fake/blender.exe' }, { w: 400, h: 100, d: 200.5 })).resolves.toBeDefined()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('maps the opposite face to the back view and the top face to the top view, with their own crop sizes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'projection-'))
    try {
      const glb = await glbFile(dir)
      const a = fakeExec()
      const back = await renderProjection(glb, 'opposite', { exec: a.exec, blender: 'C:/fake/blender.exe' })
      expect((a.plans[0].views as { name: string }[])[0].name).toBe('back')
      expect(back.faceMm).toEqual({ w: 400, h: 100 })
      const b = fakeExec()
      const top = await renderProjection(glb, 'top', { exec: b.exec, blender: 'C:/fake/blender.exe' })
      expect((b.plans[0].views as { name: string }[])[0].name).toBe('top')
      const meta = await sharp(Buffer.from(top.png)).metadata()
      expect([meta.width, meta.height]).toEqual([2008, 1004]) // 400 x 200 mm in a 408 mm frame
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('names Blender in the error when it is missing, and the stderr tail when the render fails', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'projection-'))
    try {
      const glb = await glbFile(dir)
      await expect(renderProjection(glb, 'io', { blender: null })).rejects.toThrow(/Blender is not installed/)
      const exec = async (): Promise<ExecResult> => ({ code: 1, stdout: '', stderr: 'RENDER_FAIL no mesh' })
      await expect(renderProjection(glb, 'io', { exec, blender: 'C:/fake/blender.exe' })).rejects.toThrow(/RENDER_FAIL no mesh/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe.skipIf(!findBlender())('renderProjection with the real Blender', () => {
  it('renders a flat-lit, face-sized image of a box', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'projection-'))
    try {
      const out = await renderProjection(await glbFile(dir), 'io', {})
      const meta = await sharp(Buffer.from(out.png)).metadata()
      expect(meta.width).toBeGreaterThan(1900)
      expect(meta.height).toBeGreaterThan(450)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }, 120_000)
})
