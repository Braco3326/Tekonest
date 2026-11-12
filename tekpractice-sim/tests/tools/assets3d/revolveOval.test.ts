/**
 * Tests for revolve-oval (Wave 2, Task 2.3, plan family revolve-v2-oval): a lathe whose section is an ellipse (width != depth) for side-address condensers
 * (AKG C414), ribbons and stereo mics. Profile stations are [axial mm from the base, width mm, depth mm]. Params and checks run without Blender;
 * the geometry runs through the real builder (skipped when Blender is not installed).
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findBlender } from '../../../tools/assets3d/env'
import { inspectGlb } from '../../../tools/assets3d/inspect'
import { loadSpecs } from '../../../tools/assets3d/loadSpecs'
import { projectionFaceMm } from '../../../tools/assets3d/projection'
import { runBuilder } from '../../../tools/assets3d/runBuilder'
import { BUILD_SHAPES, SHAPE_SPECS, ellipsePerimeterMm, validateBuild } from '../../../tools/assets3d/shapes'
import { AssetSpec } from '../../../tools/assets3d/specSchema'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'
import { buildPlanRaw, fingerprint } from './rawBuild'

const BLENDER = findBlender()
const MM = 0.001
/** A side-address condenser, 50 wide x 38 deep x 160 high (the AKG C414 XLII of the plan): a cone base, a body, a head. */
const C414_PROFILE: [number, number, number][] = [[0, 22, 22], [3, 30, 28], [20, 44, 34], [60, 46, 36], [110, 48, 37], [130, 50, 38], [152, 50, 38], [158, 40, 30], [160, 0, 0]]
const C414 = { w: 50, h: 160, d: 38 }

function spec(id: string, size: { w: number; h: number; d: number }, profile: number[][], params: Record<string, number> | undefined = undefined, over: Partial<AssetSpecT> = {}): AssetSpecT {
  const base = loadSpecs().find((s) => s.id === 'shure-sm58') as AssetSpecT
  return { ...base, id, realSizeMm: size, ports: [], controls: [], texture: undefined, build: { shape: 'revolve-oval', profile: profile as never, ...(params ? { params } : {}) }, ...over }
}

describe('revolve-oval params (no Blender)', () => {
  it('is registered as a device lathe with 3-number stations', () => {
    expect(BUILD_SHAPES).toContain('revolve-oval')
    expect(SHAPE_SPECS['revolve-oval']).toMatchObject({ kind: 'device', usesProfile: true, profileKind: 'lathe-oval', params: ['segments'] })
  })

  it('accepts the C414 profile through zod and validateBuild, and still accepts the 2-number profile of a round revolve', () => {
    const s = spec('c414', C414, C414_PROFILE)
    expect(AssetSpec.safeParse(s).success).toBe(true)
    expect(validateBuild(s)).toEqual([])
    const round = { ...s, realSizeMm: { w: 50, h: 160, d: 50 }, build: { shape: 'revolve' as const, profile: [[0, 20], [3, 30], [100, 50], [160, 0]] as [number, number][] } }
    expect(AssetSpec.safeParse(round).success).toBe(true)
    expect(validateBuild(round)).toEqual([])
  })

  it('wants the widest width to be the spec width and the deepest depth the spec depth (section width and depth match the plan)', () => {
    expect(validateBuild(spec('x', { ...C414, w: 52 }, C414_PROFILE))[0]).toMatch(/widest station \(50 mm\) must equal the width 52 mm/)
    expect(validateBuild(spec('x', { ...C414, d: 40 }, C414_PROFILE))[0]).toMatch(/deepest station \(38 mm\) must equal the depth 40 mm/)
  })

  it('wants three numbers per station on revolve-oval, two on revolve, strictly increasing positions, the first at 0 and the last at the height', () => {
    expect(validateBuild(spec('x', C414, [[0, 22], [3, 30], [20, 44], [160, 0]]))[0]).toMatch(/station 0 must be \[position, width, depth\]/)
    const round = { ...spec('x', { w: 50, h: 160, d: 50 }, [[0, 20, 20], [3, 30, 30], [100, 50, 50], [160, 0, 0]]), build: { shape: 'revolve' as const, profile: [[0, 20, 20], [3, 30, 30], [100, 50, 50], [160, 0, 0]] as never } }
    expect(validateBuild(round)[0]).toMatch(/revolve takes \[position, diameter\] stations.*revolve-oval/)
    expect(validateBuild(spec('x', C414, C414_PROFILE.map((st, i) => (i === 0 ? [2, st[1], st[2]] : st))))[0]).toMatch(/first station must be at 0/)
    expect(validateBuild(spec('x', { ...C414, h: 170 }, C414_PROFILE))[0]).toMatch(/last station must be at the height 170/)
  })

  it('refuses a station that is a pole in one direction only, and bad segments', () => {
    expect(validateBuild(spec('x', C414, C414_PROFILE.map((st, i) => (i === 8 ? [160, 0, 5] : st))))[0]).toMatch(/station 8.*width and depth must both be 0/)
    expect(validateBuild(spec('x', C414, C414_PROFILE, { segments: 30 }))[0]).toMatch(/segments/)
    expect(validateBuild(spec('x', C414, C414_PROFILE, { segments: 64 }))).toEqual([])
  })

  it('computes the perimeter of the widest section (the width of a wrap picture): pi x width for a round one', () => {
    expect(ellipsePerimeterMm(50, 50)).toBeCloseTo(Math.PI * 50, 9)
    expect(ellipsePerimeterMm(50, 38)).toBeGreaterThan(Math.PI * 38)
    expect(ellipsePerimeterMm(50, 38)).toBeLessThan(Math.PI * 50)
    expect(ellipsePerimeterMm(50, 38)).toBeCloseTo(138.87, 1)
    expect(projectionFaceMm('wrap', { w: 50, h: 160, d: 38 }).w).toBeCloseTo(138.87, 1)
    expect(projectionFaceMm('wrap', { w: 51, h: 162, d: 51 }).w).toBeCloseTo(Math.round(Math.PI * 51 * 100) / 100, 9)   // a round lathe: unchanged
  })
})

describe(`revolve-oval with real Blender (${BLENDER ? `using ${BLENDER}` : 'SKIPPED, Blender not found: install Blender or set BLENDER_EXE'})`, () => {
  let dir = ''
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tekpractice-oval-'))
  })
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  let count = 0
  type V3 = [number, number, number]
  async function build(size: { w: number; h: number; d: number }, profile: number[][], params: Record<string, number> = {}, extra: Record<string, unknown> = {}): Promise<{ bytes: Uint8Array; sha256: string; tris: number; verts: V3[]; uvs: [number, number][] }> {
    const plan = { id: `ov-${count}`, kind: 'device', shape: 'revolve-oval', sizeMm: size, params, profile, ...extra }
    const r = await buildPlanRaw(BLENDER as string, dir, `b${count++}`, plan)
    const doc = await new NodeIO().readBinary(r.bytes)
    const verts: V3[] = []
    const uvs: [number, number][] = []
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')!
        const uv = prim.getAttribute('TEXCOORD_0')
        for (let i = 0; i < pos.getCount(); i++) {
          verts.push(pos.getElement(i, [0, 0, 0]) as V3)
          if (uv) uvs.push(uv.getElement(i, [0, 0]) as [number, number])
        }
      }
    }
    return { bytes: r.bytes, sha256: r.sha256, tris: (await inspectGlb(r.bytes)).triangles, verts, uvs }
  }
  const extent = (verts: V3[], k: 0 | 1 | 2): [number, number] => [Math.min(...verts.map((v) => v[k])) / MM, Math.max(...verts.map((v) => v[k])) / MM]

  it.skipIf(!BLENDER)('section width and depth match the plan: the bounding box is the spec size, and every ring is an ellipse of its own width and depth', async () => {
    const { verts } = await build(C414, C414_PROFILE)
    expect(extent(verts, 0)).toEqual([expect.closeTo(-25, 4), expect.closeTo(25, 4)])
    expect(extent(verts, 2)).toEqual([expect.closeTo(-19, 4), expect.closeTo(19, 4)])
    expect(extent(verts, 1)).toEqual([expect.closeTo(0, 4), expect.closeTo(160, 4)])
    for (const [y, w, d] of [[20, 44, 34], [60, 46, 36], [130, 50, 38]]) {
      const ring = verts.filter((v) => Math.abs(v[1] - y * MM) < 1e-7)
      expect(ring.length).toBeGreaterThanOrEqual(32)
      for (const v of ring) expect((v[0] / MM / (w / 2)) ** 2 + (v[2] / MM / (d / 2)) ** 2, `a vertex at y ${y}`).toBeCloseTo(1, 4)
      expect(Math.max(...ring.map((v) => Math.abs(v[0]))) / MM).toBeCloseTo(w / 2, 4)
      expect(Math.max(...ring.map((v) => Math.abs(v[2]))) / MM).toBeCloseTo(d / 2, 4)
    }
  }, 120_000)

  it.skipIf(!BLENDER)('an oval profile with equal width and depth is the round lathe: same geometry as revolve', async () => {
    const round = [[0, 28], [2, 34], [10, 44], [60, 49], [100, 51], [150, 51], [158, 40], [162, 0]]
    const oval = round.map(([y, dia]) => [y, dia, dia])
    const size = { w: 51, h: 162, d: 51 }
    const a = await buildPlanRaw(BLENDER as string, dir, 'round', { id: 'r', kind: 'device', shape: 'revolve', sizeMm: size, params: {}, profile: round })
    const b = await buildPlanRaw(BLENDER as string, dir, 'oval-round', { id: 'r', kind: 'device', shape: 'revolve-oval', sizeMm: size, params: {}, profile: oval })
    expect(await fingerprint(b.bytes)).toBe(await fingerprint(a.bytes))
  }, 120_000)

  it.skipIf(!BLENDER)('round revolve output unchanged: the SM58 lathe and the other byte-stable lathes keep their bytes (pins of builderPins.test.ts)', async () => {
    const pins = JSON.parse(await readFile(new URL('./fixtures/builder-pins-wave2.json', import.meta.url), 'utf8')) as Record<string, { sha256?: string; plan: { shape: string } }>
    expect(pins['shure-sm58']?.sha256).toBeDefined()
    for (const id of ['shure-sm58', 'shure-sm57', 'ev-re20']) {
      if (!pins[id]) continue
      const r = await buildPlanRaw(BLENDER as string, dir, `pin-${id}`, pins[id].plan)
      expect(r.sha256, id).toBe(pins[id].sha256)
    }
  }, 240_000)

  it.skipIf(!BLENDER)('wrap picture maps on an oval by arc length: u along a ring follows the ellipse arc, not the polar angle', async () => {
    const png = join(dir, 'wrap.png')
    await writeFile(png, await sharp({ create: { width: 256, height: 64, channels: 3, background: { r: 120, g: 120, b: 120 } } }).png().toBuffer())
    const profile = [[0, 30, 22], [10, 46, 34], [100, 50, 38], [150, 50, 38], [160, 0, 0]]
    const { verts, uvs } = await build({ w: 50, h: 160, d: 38 }, profile, { segments: 64 }, { projections: [{ face: 'wrap', png }] })
    expect(uvs.length).toBe(verts.length)
    const a = 25, b = 19
    // arc length fraction of the ellipse x = a cos t, z = b sin t, from t = -pi to t
    const speed = (t: number): number => Math.hypot(a * Math.sin(t), b * Math.cos(t))
    const total = (() => { let s = 0; const n = 4000; for (let i = 0; i < n; i++) s += speed(((i + 0.5) / n) * 2 * Math.PI) * (2 * Math.PI / n); return s })()
    const arc = (t: number): number => { let s = 0; const n = 2000; const h = (t + Math.PI) / n; for (let i = 0; i < n; i++) s += speed(-Math.PI + (i + 0.5) * h) * h; return s / total }
    const ring = verts.map((v, i) => ({ v, uv: uvs[i] })).filter((p) => Math.abs(p.v[1] - 100 * MM) < 1e-7)
    expect(ring.length).toBeGreaterThanOrEqual(64)
    // Blender's y is minus glTF z. A round lathe would use the polar angle atan2(y, x) / 2pi + 0.5; the oval uses the ellipse parameter atan2(y / b, x / a) and its arc share
    let worstArc = 0
    let worstPolar = 0
    for (const { v, uv } of ring) {
      const t = Math.atan2(-v[2] / MM / b, v[0] / MM / a)
      const polar = Math.atan2(-v[2], v[0]) / (2 * Math.PI) + 0.5
      const wrap = (u: number, ref: number): number => u - Math.round(u - ref)
      worstArc = Math.max(worstArc, Math.abs(wrap(uv[0], arc(t)) - arc(t)))
      worstPolar = Math.max(worstPolar, Math.abs(wrap(uv[0], polar) - polar))
    }
    expect(worstArc).toBeLessThan(1e-3)       // follows the arc length
    expect(worstPolar).toBeGreaterThan(0.01)  // and is visibly not the polar angle of a round lathe
  }, 120_000)

  it.skipIf(!BLENDER)('BuildError: stations of the wrong shape, a one-sided pole, a profile that does not start at the base', async () => {
    await expect(build(C414, [[0, 22], [3, 30], [20, 44], [160, 0]])).rejects.toThrow(/station 0 must be \[y_mm, width_mm, depth_mm\]/)
    await expect(build(C414, [[0, 22, 22], [3, 30, 28], [20, 44, 34], [160, 0, 5]])).rejects.toThrow(/width and depth must both be 0/)
    await expect(build(C414, [[5, 22, 22], [20, 44, 34], [100, 50, 38], [160, 0, 0]])).rejects.toThrow(/first profile station must be at 0/)
  }, 180_000)

  it.skipIf(!BLENDER)('deterministic: twelve parallel builds are byte-identical, and a C414-class sample is inside the mic class (up to 6000 triangles)', async () => {
    const runs = await Promise.all(Array.from({ length: 12 }, () => build(C414, C414_PROFILE, { segments: 64 })))
    expect(new Set(runs.map((r) => r.sha256)).size).toBe(1)
    expect(runs[0].tris).toBeLessThanOrEqual(6000)
    expect(runs[0].tris).toBeGreaterThanOrEqual(500)
  }, 240_000)

  it.skipIf(!BLENDER)('builds from a spec through runBuilder (usable from a spec) with colour zones', async () => {
    const s = AssetSpec.parse({ ...spec('c414-from-spec', C414, C414_PROFILE, { segments: 48 }), build: { shape: 'revolve-oval', params: { segments: 48 }, profile: C414_PROFILE, colours: [{ fromMm: 0, colour: '#9c9a96' }, { fromMm: 20, colour: '#bba98f' }] } })
    const out = join(dir, 'from-spec.glb')
    await runBuilder(s, out)
    const tris = (await inspectGlb(new Uint8Array(await readFile(out)))).triangles
    expect(tris).toBeGreaterThan(500)
    expect(tris).toBeLessThanOrEqual(6000)
  }, 120_000)
})
