/**
 * Tests for assets3d/contactSheet. Three layers:
 *  - the pure maths (specRectInView, computeFraming, cameraViews), numbers worked by hand;
 *  - composeSheet with synthetic solid-colour views (sharp only, no Blender);
 *  - renderContactSheet with an injected fake exec (the Node <-> Blender contract), and one integration test
 *    that runs the real tools/assets3d/blender/render_views.py and is skipped when Blender is not installed.
 */
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  GREY_SRGB,
  OVERLAY_RGB,
  PANEL_PX,
  RENDER_SCRIPT,
  VIEW_NAMES,
  cameraViews,
  composeSheet,
  computeFraming,
  renderContactSheet,
  specRectInView,
} from '../../../tools/assets3d/contactSheet'
import type { Framing, ViewName, ViewPngs } from '../../../tools/assets3d/contactSheet'
import { findBlender } from '../../../tools/assets3d/env'
import type { ExecResult } from '../../../tools/assets3d/runFixup'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'
import { makeBoxGlb } from './helpers'

function spec(over: Partial<AssetSpecT> = {}): AssetSpecT {
  return {
    id: 'test-desk',
    kind: 'device',
    tier: 'standard',
    realSizeMm: { w: 400, h: 100, d: 200 },
    ports: [],
    controls: [],
    sources: [],
    ...over,
  }
}

const COLOURS: Record<ViewName, [number, number, number]> = {
  io: [200, 40, 40],
  back: [40, 200, 40],
  left: [40, 40, 200],
  top: [200, 200, 40],
}

/** A solid-colour 512 x 512 PNG. */
function solid(rgb: [number, number, number], w = PANEL_PX, h = PANEL_PX): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toBuffer()
}

async function writeViews(dir: string): Promise<ViewPngs> {
  const out = {} as Record<ViewName, string>
  for (const name of VIEW_NAMES) {
    out[name] = join(dir, `${name}.png`)
    await writeFile(out[name], await solid(COLOURS[name]))
  }
  return { ...out, framing: { centreM: [0, 0.05, 0], orthoScaleM: 0.5 } }
}

interface Raw {
  data: Buffer
  width: number
  height: number
  channels: number
}

async function readRaw(path: string): Promise<Raw> {
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, channels: info.channels }
}

function pixel(img: Raw, x: number, y: number): [number, number, number] {
  const i = (y * img.width + x) * img.channels
  return [img.data[i], img.data[i + 1], img.data[i + 2]]
}

const GREY: [number, number, number] = [GREY_SRGB, GREY_SRGB, GREY_SRGB]

describe('specRectInView (hand-worked)', () => {
  // Spec 400 x 100 x 200 mm, ortho scale 0.5 m on 512 px: 1 m = 1024 px.
  it('io and back show width x height, centred', () => {
    // w: 0.4 m -> 409.6 px, h: 0.1 m -> 102.4 px. x = (512-409.6)/2 = 51.2, right edge 460.8; y = 204.8, bottom 307.2.
    const want = { x: 51, y: 205, w: 410, h: 102 }
    expect(specRectInView('io', spec(), 0.5, 512)).toEqual(want)
    expect(specRectInView('back', spec(), 0.5, 512)).toEqual(want)
  })

  it('left shows depth x height', () => {
    // d: 0.2 m -> 204.8 px, h: 102.4 px. x = 153.6 -> 154, right edge 358.4 -> 358; y as above.
    expect(specRectInView('left', spec(), 0.5, 512)).toEqual({ x: 154, y: 205, w: 204, h: 102 })
  })

  it('top shows width (horizontal) x depth (vertical)', () => {
    // w: 409.6 px, d: 204.8 px. x = 51.2 -> 51, right 460.8 -> 461; y = 153.6 -> 154, bottom 358.4 -> 358.
    expect(specRectInView('top', spec(), 0.5, 512)).toEqual({ x: 51, y: 154, w: 410, h: 204 })
  })

  it('whole numbers stay whole: half the frame is 256 px', () => {
    // 1.024 m frame = 500 px per m; 0.512 m = 256 px, 0.256 m = 128 px.
    const s = spec({ realSizeMm: { w: 512, h: 256, d: 128 } })
    expect(specRectInView('io', s, 1.024, 512)).toEqual({ x: 128, y: 192, w: 256, h: 128 })
    expect(specRectInView('left', s, 1.024, 512)).toEqual({ x: 224, y: 192, w: 64, h: 128 })
    expect(specRectInView('top', s, 1.024, 512)).toEqual({ x: 128, y: 224, w: 256, h: 64 })
  })

  it('connectors use the same logic', () => {
    const s = spec({ kind: 'connector', tier: 'connector', realSizeMm: { w: 512, h: 256, d: 128 } })
    expect(specRectInView('io', s, 1.024, 512)).toEqual({ x: 128, y: 192, w: 256, h: 128 })
  })
})

describe('computeFraming', () => {
  it('centres on the bbox and leaves a 20 percent margin around the largest extent', () => {
    const f = computeFraming({ min: [-0.25, 0, -0.1], max: [0.25, 0.1, 0.1] })
    expect(f.centreM).toEqual([0, 0.05, 0])
    expect(f.orthoScaleM).toBeCloseTo(0.6, 12) // 0.5 m * 1.2
  })

  it('also fits the spec rectangle when it is larger than the model', () => {
    const f = computeFraming({ min: [-0.05, 0, -0.05], max: [0.05, 0.1, 0.05] }, spec({ realSizeMm: { w: 400, h: 100, d: 200 } }))
    expect(f.orthoScaleM).toBeCloseTo(0.48, 12) // 0.4 m * 1.2
  })

  it('rejects a flat or non-finite bbox', () => {
    expect(() => computeFraming({ min: [0, 0, 0], max: [0, 0, 0] })).toThrow(/empty|flat/i)
    expect(() => computeFraming({ min: [0, 0, 0], max: [Infinity, 1, 1] })).toThrow(/finite/i)
  })
})

/** Blender XYZ euler (degrees) -> rotation matrix R = Rz Ry Rx, applied to a vector. */
function eulerApply(deg: [number, number, number], v: [number, number, number]): [number, number, number] {
  const [rx, ry, rz] = deg.map((d) => (d * Math.PI) / 180)
  const [x0, y0, z0] = v
  const y1 = y0 * Math.cos(rx) - z0 * Math.sin(rx)
  const z1 = y0 * Math.sin(rx) + z0 * Math.cos(rx)
  const x2 = x0 * Math.cos(ry) + z1 * Math.sin(ry)
  const z2 = -x0 * Math.sin(ry) + z1 * Math.cos(ry)
  const x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz)
  const y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz)
  return [x3, y3, z2]
}

function cross(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

describe('cameraViews', () => {
  const framing: Framing = { centreM: [0.1, 0.2, 0.3], orthoScaleM: 0.6 } // glTF (x, y, z); Blender centre (0.1, -0.3, 0.2)
  const views = cameraViews(framing, 0.5)

  it('has the four views in order, with the camera outside the model on the right side', () => {
    expect(views.map((v) => v.name)).toEqual(['io', 'back', 'left', 'top'])
    const loc = Object.fromEntries(views.map((v) => [v.name, v.location]))
    const d = views[0].distanceM
    expect(d).toBeGreaterThan(0.5)
    expect(loc.io[1]).toBeCloseTo(-0.3 - d, 12) // glTF +Z = Blender -Y
    expect(loc.back[1]).toBeCloseTo(-0.3 + d, 12)
    expect(loc.left[0]).toBeCloseTo(0.1 - d, 12)
    expect(loc.top[2]).toBeCloseTo(0.2 + d, 12)
  })

  it.each([
    ['io', [0, 1, 0], [0, 0, 1], [1, 0, 0]],
    ['back', [0, -1, 0], [0, 0, 1], [-1, 0, 0]],
    ['left', [1, 0, 0], [0, 0, 1], [0, -1, 0]], // image right = Blender -Y = glTF +Z: the io side is on the right
    ['top', [0, 0, -1], [0, 1, 0], [1, 0, 0]], // image up = Blender +Y: the io side (-Y) is at the bottom
  ] as const)('%s looks along %j with image-up %j and image-right %j', (name, forward, up, right) => {
    const v = views.find((x) => x.name === name)!
    const f = eulerApply(v.rotationDeg, [0, 0, -1]) // a Blender camera looks down its local -Z
    const u = eulerApply(v.rotationDeg, [0, 1, 0]) // and has image-up along its local +Y
    f.forEach((c, i) => expect(c).toBeCloseTo(forward[i], 9))
    u.forEach((c, i) => expect(c).toBeCloseTo(up[i], 9))
    cross(f, u).forEach((c, i) => expect(c).toBeCloseTo(right[i], 9))
  })

  it('every camera looks at the bbox centre', () => {
    const centre = [0.1, -0.3, 0.2]
    for (const v of views) {
      const f = eulerApply(v.rotationDeg, [0, 0, -1])
      const at = v.location.map((c, i) => c + f[i] * v.distanceM)
      at.forEach((c, i) => expect(c).toBeCloseTo(centre[i], 9))
    }
  })
})

describe('composeSheet', () => {
  let dir = ''
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tekpractice-sheet-'))
  })
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('lays the four views side by side: 4 x 512 wide, 512 high, each panel in its own colour', async () => {
    const views = await writeViews(dir)
    const out = join(dir, 'four.png')
    await composeSheet(views, null, out)
    const img = await readRaw(out)
    expect([img.width, img.height]).toEqual([4 * PANEL_PX, PANEL_PX])
    VIEW_NAMES.forEach((name, i) => {
      expect(pixel(img, i * PANEL_PX + 256, 400)).toEqual(COLOURS[name])
    })
  })

  it('adds a fifth 512 px panel for the reference photo, letterboxed and not stretched', async () => {
    const views = await writeViews(dir)
    const photo = join(dir, 'photo-2to1.png')
    await writeFile(photo, await solid([250, 10, 10], 400, 200)) // 2:1 -> 512 x 256 inside the panel
    const out = join(dir, 'five.png')
    await composeSheet(views, photo, out)
    const img = await readRaw(out)
    expect([img.width, img.height]).toEqual([5 * PANEL_PX, PANEL_PX])
    const x = 4 * PANEL_PX + 256
    expect(pixel(img, x, 10)).toEqual(GREY) // top bar
    expect(pixel(img, x, 120)).toEqual(GREY) // still the bar (bars are 128 px)
    expect(pixel(img, x, 400)).toEqual(GREY) // bottom bar
    expect(pixel(img, x, 500)).toEqual(GREY)
    const mid = pixel(img, x, 256)
    expect(mid[0]).toBeGreaterThan(240) // the photo, red
    expect(mid[1]).toBeLessThan(20)
    // full width: the photo touches the left and right edge of its panel (scaled up, not pillar-boxed).
    expect(pixel(img, 4 * PANEL_PX + 2, 256)[0]).toBeGreaterThan(240)
    expect(pixel(img, 5 * PANEL_PX - 3, 256)[0]).toBeGreaterThan(240)
  })

  it('letterboxes a tall photo with grey bars left and right', async () => {
    const views = await writeViews(dir)
    const photo = join(dir, 'photo-tall.png')
    await writeFile(photo, await solid([10, 10, 250], 100, 200)) // 1:2 -> 256 x 512
    const out = join(dir, 'tall.png')
    await composeSheet(views, photo, out)
    const img = await readRaw(out)
    expect(pixel(img, 4 * PANEL_PX + 10, 256)).toEqual(GREY)
    expect(pixel(img, 5 * PANEL_PX - 10, 256)).toEqual(GREY)
    expect(pixel(img, 4 * PANEL_PX + 256, 256)[2]).toBeGreaterThan(240)
  })

  it('draws the spec rectangle outline in each view at the specRectInView coordinates', async () => {
    const views = await writeViews(dir) // ortho scale 0.5 m
    const out = join(dir, 'overlay.png')
    const s = spec()
    await composeSheet(views, null, out, s)
    const img = await readRaw(out)
    const oc = [...OVERLAY_RGB]
    VIEW_NAMES.forEach((name, i) => {
      const r = specRectInView(name, s, 0.5, PANEL_PX)
      const ox = i * PANEL_PX
      const my = r.y + Math.floor(r.h / 2)
      const mx = r.x + Math.floor(r.w / 2)
      // the stroke is 2 px wide, straddling each edge: [edge-1, edge+1)
      expect(pixel(img, ox + r.x - 1, my)).toEqual(oc)
      expect(pixel(img, ox + r.x, my)).toEqual(oc)
      expect(pixel(img, ox + r.x + r.w - 1, my)).toEqual(oc)
      expect(pixel(img, ox + r.x + r.w, my)).toEqual(oc)
      expect(pixel(img, ox + mx, r.y - 1)).toEqual(oc)
      expect(pixel(img, ox + mx, r.y)).toEqual(oc)
      expect(pixel(img, ox + mx, r.y + r.h - 1)).toEqual(oc)
      expect(pixel(img, ox + mx, r.y + r.h)).toEqual(oc)
      // inside and outside the outline, the view shows through
      expect(pixel(img, ox + mx, my)).toEqual(COLOURS[name])
      expect(pixel(img, ox + r.x - 3, my)).toEqual(COLOURS[name])
      expect(pixel(img, ox + r.x + r.w + 2, my)).toEqual(COLOURS[name])
    })
  })

  it('draws no overlay when the spec is omitted', async () => {
    const views = await writeViews(dir)
    const out = join(dir, 'nooverlay.png')
    await composeSheet(views, null, out)
    const img = await readRaw(out)
    let hits = 0
    for (let i = 0; i < img.width * img.height; i++) {
      const o = i * img.channels
      if (img.data[o] === OVERLAY_RGB[0] && img.data[o + 1] === OVERLAY_RGB[1] && img.data[o + 2] === OVERLAY_RGB[2]) hits++
    }
    expect(hits).toBe(0)
  })

  it('creates the output folder when it does not exist', async () => {
    const views = await writeViews(dir)
    const out = join(dir, 'deep', 'er', 'sheet.png')
    await composeSheet(views, null, out)
    expect(existsSync(out)).toBe(true)
  })
})

interface Call {
  file: string
  args: string[]
  plan: Record<string, unknown>
  tmp: string
}

function argAfter(args: string[], flag: string): string {
  const i = args.indexOf(flag)
  if (i < 0 || i + 1 >= args.length) throw new Error(`no ${flag} in ${args.join(' ')}`)
  return args[i + 1]
}

/** A fake exec: records the call and writes the four solid-colour views into --out-dir, as render_views.py would. */
function fakeExec(reply: { code?: number; stderr?: string; skipViews?: boolean } = {}): {
  exec: (file: string, args: string[]) => Promise<ExecResult>
  calls: Call[]
} {
  const calls: Call[] = []
  const exec = async (file: string, args: string[]): Promise<ExecResult> => {
    const planPath = argAfter(args, '--plan')
    const plan = JSON.parse(await readFile(planPath, 'utf8')) as Record<string, unknown>
    calls.push({ file, args, plan, tmp: dirname(planPath) })
    if (!reply.skipViews) {
      const outDir = argAfter(args, '--out-dir')
      await mkdir(outDir, { recursive: true })
      for (const name of VIEW_NAMES) await writeFile(join(outDir, `${name}.png`), await solid(COLOURS[name]))
    }
    return { code: reply.code ?? 0, stdout: 'Blender 5.1\n', stderr: reply.stderr ?? '' }
  }
  return { exec, calls }
}

describe('renderContactSheet (unit, injected exec)', () => {
  let dir = ''
  let glb = ''
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tekpractice-sheet-run-'))
    glb = join(dir, 'box.glb')
    // 0.5 x 0.1 x 0.2 m box, pivot bottom-centre: bbox x [-0.25, 0.25], y [0, 0.1], z [-0.1, 0.1].
    await writeFile(glb, await makeBoxGlb({ sizeM: { w: 0.5, h: 0.1, d: 0.2 } }))
  })
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('runs Blender headless on render_views.py with the glb, plan and out-dir paths', async () => {
    const { exec, calls } = fakeExec()
    await renderContactSheet(glb, null, join(dir, 'a.png'), undefined, { exec, blender: 'C:/fake/blender.exe' })
    expect(calls).toHaveLength(1)
    const c = calls[0]
    expect(c.file).toBe('C:/fake/blender.exe')
    expect(c.args.slice(0, 6)).toEqual(['--background', '--factory-startup', '--python-exit-code', '1', '--python', RENDER_SCRIPT])
    expect(c.args[6]).toBe('--')
    expect(argAfter(c.args, '--in')).toMatch(/box\.glb$/)
    expect(argAfter(c.args, '--plan')).toMatch(/plan\.json$/)
    expect(argAfter(c.args, '--out-dir')).toBeTruthy()
    expect(RENDER_SCRIPT).toMatch(/render_views\.py$/)
    expect(existsSync(RENDER_SCRIPT)).toBe(true)
  })

  it('writes plan.json with the camera, clip, size and background values measured from the GLB', async () => {
    const { exec, calls } = fakeExec()
    await renderContactSheet(glb, null, join(dir, 'b.png'), undefined, { exec, blender: 'C:/fake/blender.exe' })
    const plan = calls[0].plan as {
      sizePx: number
      orthoScaleM: number
      clipStartM: number
      clipEndM: number
      backgroundLinear: number[]
      views: { name: string; location: number[]; rotationDeg: number[] }[]
    }
    expect(plan.sizePx).toBe(512)
    expect(plan.orthoScaleM).toBeCloseTo(0.6, 9) // 0.5 m * 1.2
    expect(plan.clipStartM).toBe(0.001) // 1 mm: a larger clip start cut 2-3 cm connectors in the old pipeline
    expect(plan.clipEndM).toBeGreaterThan(5 * 0.5)
    expect(plan.backgroundLinear).toHaveLength(3)
    plan.backgroundLinear.forEach((v) => {
      expect(v).toBeGreaterThan(0.5) // sRGB 224 is about 0.745 linear
      expect(v).toBeLessThan(1)
    })
    expect(plan.views.map((v) => v.name)).toEqual(['io', 'back', 'left', 'top'])
    // Blender centre of the bbox: glTF (0, 0.05, 0) -> (0, -0, 0.05); the io camera sits on Blender -Y, level with it.
    const io = plan.views[0]
    expect(io.location[0]).toBeCloseTo(0, 6)
    expect(io.location[2]).toBeCloseTo(0.05, 6) // float32 positions
    expect(io.location[1]).toBeLessThan(-0.5)
    expect(io.rotationDeg).toEqual([90, 0, 0])
  })

  it('composes the sheet from the rendered views (with the photo and the spec overlay when given)', async () => {
    const { exec } = fakeExec()
    const photo = join(dir, 'ref.png')
    await writeFile(photo, await solid([250, 10, 10], 300, 150))
    const out = join(dir, 'c.png')
    await renderContactSheet(glb, photo, out, spec({ realSizeMm: { w: 500, h: 100, d: 200 } }), { exec, blender: 'C:/fake/blender.exe' })
    const meta = await sharp(out).metadata()
    expect([meta.width, meta.height]).toEqual([5 * PANEL_PX, PANEL_PX])
    const img = await readRaw(out)
    // the spec rectangle uses the same ortho scale that went to Blender (0.6 m): 0.5 m wide = 426.67 px
    const r = specRectInView('io', spec({ realSizeMm: { w: 500, h: 100, d: 200 } }), 0.6, PANEL_PX)
    expect(pixel(img, r.x, r.y + 10)).toEqual([...OVERLAY_RGB])
  })

  it('throws with the stderr tail when Blender exits non-zero', async () => {
    const { exec } = fakeExec({ code: 1, stderr: 'Traceback...\nRENDER_FAIL no camera\n' })
    await expect(renderContactSheet(glb, null, join(dir, 'd.png'), undefined, { exec, blender: 'C:/fake/blender.exe' })).rejects.toThrow(
      /exit 1.*RENDER_FAIL no camera/s,
    )
    expect(existsSync(join(dir, 'd.png'))).toBe(false)
  })

  it('says how to install Blender or set BLENDER_EXE when none is found', async () => {
    const { exec, calls } = fakeExec()
    await expect(renderContactSheet(glb, null, join(dir, 'e.png'), undefined, { exec, blender: null })).rejects.toThrow(/Blender is not installed.*BLENDER_EXE/s)
    expect(calls).toHaveLength(0)
  })

  it('throws when Blender exits 0 but a view is missing', async () => {
    const { exec } = fakeExec({ skipViews: true })
    await expect(renderContactSheet(glb, null, join(dir, 'f.png'), undefined, { exec, blender: 'C:/fake/blender.exe' })).rejects.toThrow(/io\.png|view/)
  })

  it('cleans up its temp dir on success and on failure', async () => {
    const ok = fakeExec()
    await renderContactSheet(glb, null, join(dir, 'g.png'), undefined, { exec: ok.exec, blender: 'C:/fake/blender.exe' })
    expect(existsSync(ok.calls[0].tmp)).toBe(false)
    const bad = fakeExec({ code: 2, stderr: 'boom' })
    await expect(renderContactSheet(glb, null, join(dir, 'h.png'), undefined, { exec: bad.exec, blender: 'C:/fake/blender.exe' })).rejects.toThrow()
    expect(existsSync(bad.calls[0].tmp)).toBe(false)
  })

  it('rejects an output that is not a .png before starting Blender', async () => {
    const { exec, calls } = fakeExec()
    await expect(renderContactSheet(glb, null, join(dir, 'x.jpg'), undefined, { exec, blender: 'C:/fake/blender.exe' })).rejects.toThrow(/\.png/)
    expect(calls).toHaveLength(0)
  })
})

const BLENDER = findBlender()

describe(`renderContactSheet (integration, real Blender${BLENDER ? '' : ': SKIPPED, Blender is not installed; install Blender 5.1 or set BLENDER_EXE'})`, () => {
  let dir = ''
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tekpractice-sheet-it-'))
  })
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it.skipIf(!BLENDER)(
    'renders a 4-view sheet with the expected pixel size and the box fully in frame in every view',
    async () => {
      const glb = join(dir, 'box.glb')
      await writeFile(glb, await makeBoxGlb({ sizeM: { w: 0.468, h: 0.044, d: 0.23 } }))
      const out = join(dir, 'sheet.png')

      await renderContactSheet(glb, null, out, spec({ realSizeMm: { w: 468, h: 44, d: 230 } }))

      const img = await readRaw(out)
      expect([img.width, img.height]).toEqual([4 * PANEL_PX, PANEL_PX])
      // Fully in frame: the outermost pixel ring of every panel is background, never model.
      for (let i = 0; i < 4; i++) {
        for (const [x, y] of [[0, 0], [PANEL_PX - 1, 0], [0, PANEL_PX - 1], [PANEL_PX - 1, PANEL_PX - 1]]) {
          const p = pixel(img, i * PANEL_PX + x, y)
          p.forEach((c, k) => expect(Math.abs(c - GREY[k])).toBeLessThanOrEqual(4))
        }
        // and the model is there: the panel centre is not background
        const c = pixel(img, i * PANEL_PX + 256, 256)
        expect(c.some((v, k) => Math.abs(v - GREY[k]) > 8)).toBe(true)
      }
    },
    180_000,
  )

  it.skipIf(!BLENDER)(
    'a model matching the spec fills the spec rectangle exactly in the io view',
    async () => {
      const glb = join(dir, 'box2.glb')
      await writeFile(glb, await makeBoxGlb({ sizeM: { w: 0.468, h: 0.044, d: 0.23 } }))
      const out = join(dir, 'sheet2.png')
      await renderContactSheet(glb, null, out, spec({ realSizeMm: { w: 468, h: 44, d: 230 } }))
      const img = await readRaw(out)
      const r = specRectInView('io', spec({ realSizeMm: { w: 468, h: 44, d: 230 } }), 0.468 * 1.2, PANEL_PX)
      // just inside the outline the box is rendered (not background); just outside it, background.
      const my = r.y + Math.floor(r.h / 2)
      const inside = pixel(img, r.x + 4, my)
      expect(inside.some((v, k) => Math.abs(v - GREY[k]) > 8)).toBe(true)
      const outside = pixel(img, r.x - 6, my)
      outside.forEach((c, k) => expect(Math.abs(c - GREY[k])).toBeLessThanOrEqual(4))
    },
    180_000,
  )
})
