/**
 * Tests for round-base-stand (Wave 2, Task 2.4): a microphone stand on a round cast base (K&M 26125 class), straight or with a boom, a variant of tripod-stand.
 * Params and checks run without Blender; the geometry runs through the real builder (skipped when Blender is not installed).
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findBlender } from '../../../tools/assets3d/env'
import { inspectGlb } from '../../../tools/assets3d/inspect'
import { loadSpecs } from '../../../tools/assets3d/loadSpecs'
import { runBuilder } from '../../../tools/assets3d/runBuilder'
import { BUILD_SHAPES, ROUND_BASE_PARAMS, SHAPE_SPECS, validateBuild } from '../../../tools/assets3d/shapes'
import { AssetSpec } from '../../../tools/assets3d/specSchema'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'
import { buildPlanRaw } from './rawBuild'

const BLENDER = findBlender()
const MM = 0.001

function spec(id: string, size: { w: number; h: number; d: number }, params: Record<string, number>, over: Partial<AssetSpecT> = {}): AssetSpecT {
  const base = loadSpecs().find((s) => s.id === 'k-m-232') as AssetSpecT
  return { ...base, id, realSizeMm: size, ports: [], controls: [], texture: undefined, portsDocumented: undefined, portsSource: undefined, build: { shape: 'round-base-stand', params }, ...over }
}

/** The K&M 26125 class: 275 mm base disc, 1000 mm high straight stand (the plan gives 1000 to 1700 mm; the low end). */
const STRAIGHT = { w: 275, h: 1000, d: 275 }
/** A boom version: the natural pose of baseDiaMm 275 with a 745 mm boom, 445 mm of it in front of the pivot (measured on a first build). */
const BOOM = { baseDiaMm: 275, boomMm: 745, frontMm: 445 }
const BOOM_SIZE = { w: 508, h: 1504.5, d: 508 }

describe('round-base-stand params (no Blender)', () => {
  it('is registered as a device shape, with no profile, ports or flat zones', () => {
    expect(BUILD_SHAPES).toContain('round-base-stand')
    expect(SHAPE_SPECS['round-base-stand']).toMatchObject({ kind: 'device', needsMatingOuter: false })
    expect(SHAPE_SPECS['round-base-stand'].params).toEqual([...ROUND_BASE_PARAMS])
    expect(SHAPE_SPECS['round-base-stand'].usesProfile).toBeUndefined()
  })

  it('accepts a straight stand and a boom stand through the zod schema', () => {
    for (const [size, params] of [[STRAIGHT, { baseDiaMm: 275 }], [BOOM_SIZE, BOOM], [STRAIGHT, { baseDiaMm: 275, tubeDiaMm: 25, upperTubeDiaMm: 22, hubDiaMm: 50, baseHeightMm: 30, clutchFromMm: 600 }]] as const) {
      const s = spec('x', size, params)
      expect(AssetSpec.safeParse(s).success).toBe(true)
      expect(validateBuild(s)).toEqual([])
    }
  })

  it('needs baseDiaMm and refuses an unknown param, ports and controls', () => {
    expect(validateBuild(spec('x', STRAIGHT, {}))[0]).toMatch(/needs baseDiaMm \(the diameter of the base disc\)/)
    expect(validateBuild(spec('x', STRAIGHT, { baseDiaMm: 275, nonsenseMm: 1 }))[0]).toMatch(/no param 'nonsenseMm'/)
    const withPort = spec('x', STRAIGHT, { baseDiaMm: 275 }, { ports: [{ portId: 'p', face: 'io', xMm: 1, yMm: 1, confidence: 'guess' }] })
    expect(validateBuild(withPort)[0]).toMatch(/has no ports/)
  })

  it('base disc diameter: a straight stand is as wide as its base, and a boom stand cannot be narrower than it', () => {
    expect(validateBuild(spec('x', { ...STRAIGHT, w: 300 }, { baseDiaMm: 275 }))[0]).toMatch(/as wide as its base.*275/)
    expect(validateBuild(spec('x', { ...STRAIGHT, d: 270 }, { baseDiaMm: 275 }))[0]).toMatch(/as wide as its base/)
    expect(validateBuild(spec('x', { w: 200, h: 1500, d: 200 }, BOOM))[0]).toMatch(/footprint .* is smaller than the base disc/)
    expect(validateBuild(spec('x', STRAIGHT, { baseDiaMm: 275, hubDiaMm: 280 }))[0]).toMatch(/hubDiaMm .* less than baseDiaMm/)
  })

  it('boom length: frontMm and the angle must be sensible, and boom params need boomMm', () => {
    expect(validateBuild(spec('x', BOOM_SIZE, { ...BOOM, frontMm: 700 }))[0]).toMatch(/frontMm \(700\).* 120 mm less than boomMm \(745\)/)
    expect(validateBuild(spec('x', BOOM_SIZE, { ...BOOM, frontMm: 200 }))[0]).toMatch(/frontMm \(200\) must be more than 250/)
    expect(validateBuild(spec('x', BOOM_SIZE, { ...BOOM, boomAngleDeg: 50 }))[0]).toMatch(/boomAngleDeg \(50\)/)
    expect(validateBuild(spec('x', STRAIGHT, { baseDiaMm: 275, frontMm: 400 }))[0]).toMatch(/frontMm has no effect without boomMm/)
  })

  it('refuses an upper tube thicker than the lower, a base that is too tall, and a clutch with no room', () => {
    expect(validateBuild(spec('x', STRAIGHT, { baseDiaMm: 275, tubeDiaMm: 19, upperTubeDiaMm: 22 }))[0]).toMatch(/upperTubeDiaMm .* thicker than tubeDiaMm/)
    expect(validateBuild(spec('x', STRAIGHT, { baseDiaMm: 275, baseHeightMm: 300 }))[0]).toMatch(/baseHeightMm .* quarter of the height/)
    expect(validateBuild(spec('x', STRAIGHT, { baseDiaMm: 275, clutchFromMm: 900 }))[0]).toMatch(/clutchFromMm/)
  })
})

describe(`round-base-stand with real Blender (${BLENDER ? `using ${BLENDER}` : 'SKIPPED, Blender not found: install Blender or set BLENDER_EXE'})`, () => {
  let dir = ''
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tekpractice-rbase-'))
  })
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  let count = 0
  type V3 = [number, number, number]
  async function build(size: { w: number; h: number; d: number }, params: Record<string, number>): Promise<{ sha256: string; tris: number; verts: V3[] }> {
    const r = await buildPlanRaw(BLENDER as string, dir, `b${count++}`, { id: 'rb', kind: 'device', shape: 'round-base-stand', sizeMm: size, params, ports: [] })
    const doc = await new NodeIO().readBinary(r.bytes)
    const verts: V3[] = []
    for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')!
      for (let i = 0; i < pos.getCount(); i++) verts.push(pos.getElement(i, [0, 0, 0]) as V3)
    }
    return { sha256: r.sha256, tris: (await inspectGlb(r.bytes)).triangles, verts }
  }
  const extent = (verts: V3[], k: 0 | 1 | 2): number => (Math.max(...verts.map((v) => v[k])) - Math.min(...verts.map((v) => v[k]))) / MM

  it.skipIf(!BLENDER)('base disc diameter: the straight stand is exactly baseDiaMm wide and deep and the spec height high, bottom at y = 0, and the disc is round', async () => {
    const { verts } = await build(STRAIGHT, { baseDiaMm: 275 })
    expect(extent(verts, 0)).toBeCloseTo(275, 2)
    expect(extent(verts, 2)).toBeCloseTo(275, 2)
    expect(extent(verts, 1)).toBeCloseTo(1000, 2)
    expect(Math.min(...verts.map((v) => v[1]))).toBeCloseTo(0, 7)
    const rim = verts.filter((v) => v[1] < 1e-7)               // the underside of the rubber ring and the foot of the disc
    expect(rim.length).toBeGreaterThan(40)
    for (const v of rim) expect(Math.hypot(v[0], v[2]) / MM).toBeLessThanOrEqual(137.5 + 1e-3)
    const disc = verts.filter((v) => Math.abs(v[1] - 2 * MM) < 1e-7 || Math.abs(v[1] - 14.3 * MM) < 1e-7)
    expect(Math.max(...disc.map((v) => Math.hypot(v[0], v[2]))) / MM).toBeCloseTo(137.5, 3)
  }, 120_000)

  it.skipIf(!BLENDER)('a different base diameter changes the footprint and nothing else: baseDiaMm 300 gives a 300 mm disc', async () => {
    const { verts } = await build({ w: 300, h: 1000, d: 300 }, { baseDiaMm: 300 })
    expect(extent(verts, 0)).toBeCloseTo(300, 2)
    expect(extent(verts, 2)).toBeCloseTo(300, 2)
  }, 120_000)

  it.skipIf(!BLENDER)('boom length: the tip of the boom is the top of the model, frontMm x cos(angle) from the axis, and the rear end is boomMm - frontMm behind it', async () => {
    const { verts, tris } = await build(BOOM_SIZE, BOOM)
    expect(extent(verts, 0)).toBeCloseTo(508, 2)
    expect(extent(verts, 1)).toBeCloseTo(1504.5, 2)
    const top = verts.filter((v) => v[1] > (1504.5 - 0.01) * MM)
    expect(top.length).toBeGreaterThan(0)
    // the boom points to azimuth 135 degrees (x = cos, z = sin): the tip is 445 * cos(20) = 418.2 mm from the stand axis along it, the pose is centred on its bounding box
    const horizontal = (v: V3): number => Math.hypot(v[0], v[2]) / MM
    expect(Math.min(...top.map(horizontal))).toBeGreaterThan(150)
    const reach = (v: V3): number => (v[0] * Math.cos((135 * Math.PI) / 180) + v[2] * Math.sin((135 * Math.PI) / 180)) / MM
    const alongBoom = verts.map(reach)
    const span = Math.max(...alongBoom) - Math.min(...alongBoom)
    // front 445 mm + the rear arm: the boom is 745 mm long and rises 20 degrees: its horizontal span is 745 * cos(20) = 700 mm (the counterweight grip is 12.5 mm round, the tip 4.8 mm)
    expect(span).toBeGreaterThan(745 * Math.cos((20 * Math.PI) / 180) - 4)
    expect(span).toBeLessThan(745 * Math.cos((20 * Math.PI) / 180) + 30)
    expect(tris).toBeGreaterThanOrEqual(1200)
    expect(tris).toBeLessThanOrEqual(4000)
  }, 120_000)

  it.skipIf(!BLENDER)('a boom pose up to 3 % off the spec is stretched to the exact spec size, more is refused with the pose size', async () => {
    const { verts } = await build({ w: 510, h: 1500, d: 505 }, BOOM)
    expect(extent(verts, 0)).toBeCloseTo(510, 2)
    expect(extent(verts, 1)).toBeCloseTo(1500, 2)
    expect(extent(verts, 2)).toBeCloseTo(505, 2)
    await expect(build({ w: 700, h: 1500, d: 700 }, BOOM)).rejects.toThrow(/pose is [\d.]+ mm in width, the spec size says 700\.0 mm/)
  }, 180_000)

  it.skipIf(!BLENDER)('BuildError: no base diameter, a straight stand that is not as wide as its base, boom params without a boom', async () => {
    await expect(build(STRAIGHT, {})).rejects.toThrow(/needs params\.baseDiaMm/)
    await expect(build({ ...STRAIGHT, w: 300 }, { baseDiaMm: 275 })).rejects.toThrow(/as wide as its base/)
    await expect(build(STRAIGHT, { baseDiaMm: 275, frontMm: 400 })).rejects.toThrow(/frontMm has no effect without params\.boomMm/)
    await expect(build(STRAIGHT, { baseDiaMm: 275, upperTubeDiaMm: 30 })).rejects.toThrow(/upperTubeDiaMm cannot be thicker/)
  }, 240_000)

  it.skipIf(!BLENDER)('deterministic: twelve parallel builds of the straight stand and of the boom stand are byte-identical', async () => {
    const a = await Promise.all(Array.from({ length: 12 }, () => build(STRAIGHT, { baseDiaMm: 275 })))
    expect(new Set(a.map((r) => r.sha256)).size).toBe(1)
    const b = await Promise.all(Array.from({ length: 12 }, () => build(BOOM_SIZE, BOOM)))
    expect(new Set(b.map((r) => r.sha256)).size).toBe(1)
  }, 300_000)

  it.skipIf(!BLENDER)('the old tripod-stand output is unchanged (the committed K&M 210/9 plan keeps its pinned bytes), and a stand builds from a spec through runBuilder', async () => {
    const pins = JSON.parse(await readFile(new URL('./fixtures/builder-pins-wave2.json', import.meta.url), 'utf8')) as Record<string, { sha256?: string; plan: { shape: string } }>
    const [id, pin] = Object.entries(pins).find(([, p]) => p.plan.shape === 'tripod-stand') as [string, { sha256?: string; plan: unknown }]
    expect(pin.sha256, id).toBeDefined()
    expect((await buildPlanRaw(BLENDER as string, dir, 'tripod', pin.plan)).sha256).toBe(pin.sha256)
    const s = AssetSpec.parse(spec('rb-from-spec', STRAIGHT, { baseDiaMm: 275 }))
    const out = join(dir, 'from-spec.glb')
    await runBuilder(s, out)
    expect((await inspectGlb(new Uint8Array(await readFile(out)))).triangles).toBeGreaterThan(500)
  }, 120_000)
})
