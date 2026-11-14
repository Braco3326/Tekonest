/**
 * Tests for moulded-box (Wave 2, Task 2.2): a rounded-plan box generalised from curved-cabinet for recorders, body-packs, controllers and laptops.
 * Params and their checks run without Blender; the geometry runs through the real builder (skipped when Blender is not installed).
 *
 * Face-local conventions used below: on the top face x runs from the left (seen from above), y from the io edge (the rear, +z) toward the front (-z):
 * a point at top (x, y) is at glTF x - w/2, z = d/2 - y.
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
import { BUILD_SHAPES, MOULDED_PARAMS, SHAPE_SPECS, mouldedHingePose, validateBuild } from '../../../tools/assets3d/shapes'
import { AssetSpec } from '../../../tools/assets3d/specSchema'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'
import { buildPlanRaw } from './rawBuild'

const BLENDER = findBlender()
const MM = 0.001
/** A small field recorder, 78 x 43 x 160 mm (w x h x d, the Zoom H6 Essential of the plan). */
const RECORDER = { w: 78, h: 43, d: 160 }
const BASE = { cornerRadiusMm: 8, edgeRadiusMm: 3, edgeSegments: 6 }

function spec(id: string, size: { w: number; h: number; d: number }, params: Record<string, number>, over: Partial<AssetSpecT> = {}): AssetSpecT {
  const base = loadSpecs().find((s) => s.id === 'apple-mac-mini') as AssetSpecT
  return { ...base, id, realSizeMm: size, ports: [], controls: [], texture: undefined, portsDocumented: undefined, portsSource: undefined, build: { shape: 'moulded-box', params }, ...over }
}

describe('moulded-box params (no Blender)', () => {
  it('is registered as a device shape with ports and flat zones', () => {
    expect(BUILD_SHAPES).toContain('moulded-box')
    expect(SHAPE_SPECS['moulded-box']).toMatchObject({ kind: 'device', usesPorts: true, usesFlatZones: true, needsMatingOuter: false })
    expect(SHAPE_SPECS['moulded-box'].params).toEqual([...MOULDED_PARAMS])
  })

  it('accepts a plain box, a seam, a recess, and a hinged laptop through the zod schema', () => {
    const laptop = { cornerRadiusMm: 6, edgeRadiusMm: 2, lidAngleDeg: 100, lidThicknessMm: 8, baseHeightMm: 14, baseDepthMm: 220 }
    const pose = mouldedHingePose(laptop)
    for (const [size, params] of [
      [RECORDER, BASE],
      [RECORDER, { ...BASE, seamHeightMm: 22 }],
      [RECORDER, { ...BASE, recessWMm: 40, recessHMm: 30, recessXMm: 19, recessYMm: 60, recessDepthMm: 1.5 }],
      [{ w: 313, h: pose.h, d: pose.d }, { ...laptop, recessWMm: 200, recessHMm: 80, recessXMm: 56, recessYMm: 60 }],
    ] as const) {
      const s = spec('x', size, params)
      expect(AssetSpec.safeParse(s).success).toBe(true)
      expect(validateBuild(s)).toEqual([])
    }
  })

  it('rejects an unknown param by name', () => {
    expect(validateBuild(spec('x', RECORDER, { ...BASE, nonsenseMm: 2 }))[0]).toMatch(/no param 'nonsenseMm'/)
  })

  it('refuses radii that fold over or leave nothing of the sides', () => {
    expect(validateBuild(spec('x', RECORDER, { cornerRadiusMm: 2, edgeRadiusMm: 3 }))[0]).toMatch(/cornerRadiusMm \(2\) must be at least the edge radius \(3\)/)
    expect(validateBuild(spec('x', RECORDER, { cornerRadiusMm: 30, edgeRadiusMm: 25 }))[0]).toMatch(/edgeRadiusMm .*less than half the smallest side/)
    expect(validateBuild(spec('x', RECORDER, { ...BASE, edgeDropMm: 30 }))[0]).toMatch(/edgeDropMm \(30\) must be less than half the height/)
    expect(validateBuild(spec('x', RECORDER, { ...BASE, edgeSegments: 3 }))[0]).toMatch(/edgeSegments.*4 to 12/)
    expect(validateBuild(spec('x', RECORDER, { ...BASE, bodyGrey: 250 }))[0]).toMatch(/bodyGrey/)
  })

  it('refuses a seam that has no wall to sit in, one given without its height, and one that is too deep', () => {
    expect(validateBuild(spec('x', RECORDER, { ...BASE, seamHeightMm: 3 }))[0]).toMatch(/seamHeightMm \(3\) leaves no wall for the groove/)
    expect(validateBuild(spec('x', RECORDER, { ...BASE, seamHeightMm: 41 }))[0]).toMatch(/seamHeightMm \(41\) leaves no wall/)
    expect(validateBuild(spec('x', RECORDER, { ...BASE, seamWidthMm: 1 }))[0]).toMatch(/seamWidthMm has no effect without seamHeightMm/)
    expect(validateBuild(spec('x', RECORDER, { ...BASE, seamHeightMm: 22, seamDepthMm: 9 }))[0]).toMatch(/seamDepthMm/)
  })

  it('wants the four recess numbers together, inside the top face', () => {
    expect(validateBuild(spec('x', RECORDER, { ...BASE, recessWMm: 40, recessHMm: 30 }))[0]).toMatch(/recess needs .*recessXMm.*recessYMm/)
    expect(validateBuild(spec('x', RECORDER, { ...BASE, recessDepthMm: 1 }))[0]).toMatch(/recess needs/)
    expect(validateBuild(spec('x', RECORDER, { ...BASE, recessWMm: 40, recessHMm: 30, recessXMm: 50, recessYMm: 10 }))[0]).toMatch(/recess \(x 50 to 90 mm\) is outside the width 78 mm/)
    expect(validateBuild(spec('x', RECORDER, { ...BASE, recessWMm: 40, recessHMm: 30, recessXMm: 10, recessYMm: 140 }))[0]).toMatch(/recess \(y 140 to 170 mm from the io edge\) is outside the depth 160 mm/)
  })

  it('computes the open pose of a hinged lid: at 90 degrees the lid stands upright behind the base edge, past 90 it leans back', () => {
    const p = { baseHeightMm: 14, baseDepthMm: 220, lidThicknessMm: 8, lidAngleDeg: 90 }
    const up = mouldedHingePose(p)
    expect(up.h).toBeCloseTo(14 + 220, 6)       // the lid length (default = the base depth) stands on the base
    expect(up.d).toBeCloseTo(220 + 8, 6)        // the lid's thickness sticks out behind the hinge
    const back = mouldedHingePose({ ...p, lidAngleDeg: 120 })
    expect(back.d).toBeGreaterThan(220 + 8)     // leaning back: the lid's top is behind the base
    expect(back.h).toBeLessThan(up.h + 1e-6)
    const closed = mouldedHingePose({ ...p, lidAngleDeg: 1 })
    expect(closed.d).toBeCloseTo(220 + 8 * Math.sin((1 * Math.PI) / 180), 3)
    expect(mouldedHingePose({ ...p, lidLenMm: 150 }).h).toBeCloseTo(14 + 150, 6)
  })

  it('refuses a hinged lid with a missing number, a bad angle, a seam, or a spec size that is not the open pose', () => {
    const lid = { cornerRadiusMm: 6, edgeRadiusMm: 2, lidAngleDeg: 100, lidThicknessMm: 8, baseHeightMm: 14, baseDepthMm: 220 }
    const pose = mouldedHingePose(lid)
    const size = { w: 313, h: pose.h, d: pose.d }
    expect(validateBuild(spec('x', size, lid))).toEqual([])
    const noDepth: Record<string, number> = { ...lid }
    delete noDepth.baseDepthMm
    expect(validateBuild(spec('x', size, noDepth))[0]).toMatch(/a hinged lid needs .*baseDepthMm.*\(missing baseDepthMm\)/)
    expect(validateBuild(spec('x', size, { ...lid, lidAngleDeg: 180 }))[0]).toMatch(/lidAngleDeg \(180\) must be from 1 to 179/)
    expect(validateBuild(spec('x', size, { ...lid, seamHeightMm: 8 }))[0]).toMatch(/a hinged lid has its own gap/)
    const off = validateBuild(spec('x', { w: 313, h: pose.h * 1.1, d: pose.d }, lid))
    expect(off).toHaveLength(1)
    expect(off[0]).toMatch(/the open pose is 313 x \d+\.\d x \d+\.\d mm \(w x h x d\) but the spec size is/)
    expect(validateBuild(spec('x', { w: 313, h: pose.h * 1.02, d: pose.d * 0.98 }, lid))).toEqual([])   // 2 % off: stretched, allowed
  })
})

describe(`moulded-box with real Blender (${BLENDER ? `using ${BLENDER}` : 'SKIPPED, Blender not found: install Blender or set BLENDER_EXE'})`, () => {
  let dir = ''
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tekpractice-moulded-'))
  })
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  let count = 0
  type V3 = [number, number, number]
  async function build(size: { w: number; h: number; d: number }, params: Record<string, number>, extra: Record<string, unknown> = {}): Promise<{ bytes: Uint8Array; sha256: string; tris: number; verts: V3[]; measure: Record<string, number> }> {
    const plan = { id: `mb-${count}`, kind: 'device', shape: 'moulded-box', sizeMm: size, params, flatZones: [], ...extra }
    const r = await buildPlanRaw(BLENDER as string, dir, `b${count++}`, plan)
    const doc = await new NodeIO().readBinary(r.bytes)
    const verts: V3[] = []
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh()
      if (!mesh) continue
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')
        if (!pos) continue
        for (let i = 0; i < pos.getCount(); i++) verts.push(pos.getElement(i, [0, 0, 0]) as V3)
      }
    }
    return { bytes: r.bytes, sha256: r.sha256, tris: (await inspectGlb(r.bytes)).triangles, verts, measure: r.measure }
  }
  const extent = (verts: V3[], k: 0 | 1 | 2): [number, number] => [Math.min(...verts.map((v) => v[k])) / MM, Math.max(...verts.map((v) => v[k])) / MM]

  it.skipIf(!BLENDER)('size exact: the box is the spec size on all three axes, centred on x and z, bottom at y = 0', async () => {
    const { verts } = await build(RECORDER, BASE)
    expect(extent(verts, 0)[0]).toBeCloseTo(-39, 3)
    expect(extent(verts, 0)[1]).toBeCloseTo(39, 3)
    expect(extent(verts, 1)[0]).toBeCloseTo(0, 3)
    expect(extent(verts, 1)[1]).toBeCloseTo(43, 3)
    expect(extent(verts, 2)[0]).toBeCloseTo(-80, 3)
    expect(extent(verts, 2)[1]).toBeCloseTo(80, 3)
  }, 120_000)

  it.skipIf(!BLENDER)('the measured fillet is the smaller of the edge radius and the drop, as built on the mesh', async () => {
    const { measure } = await build(RECORDER, { ...BASE, edgeRadiusMm: 3, edgeDropMm: 2.5 })
    expect(measure.filletMm).toBeCloseTo(2.5, 2)
    expect((await build(RECORDER, BASE)).measure.filletMm).toBeCloseTo(3, 2)
  }, 120_000)

  it.skipIf(!BLENDER)('rounded plan corners: the footprint corner is cut by cornerRadiusMm, not a square corner', async () => {
    const { verts } = await build(RECORDER, { ...BASE, cornerRadiusMm: 10 })
    // the point of the outline nearest the square corner (39, 80) is 10 * (sqrt(2) - 1) = 4.14 mm from it, measured on the wall
    const wall = verts.filter((v) => Math.abs(v[1] - 3 * MM) < 1e-7)   // the lowest ring of the straight wall (the bottom edge is 3 mm)
    const nearest = Math.min(...wall.map((v) => Math.hypot(v[0] / MM - 39, v[2] / MM - 80)))
    expect(nearest).toBeCloseTo(10 * (Math.SQRT2 - 1), 1)
  }, 120_000)

  it.skipIf(!BLENDER)('recess depth: the floor is recessDepthMm under the top face, at the face position asked, and the mouth is in the top plane', async () => {
    // top (x 19 to 59 from the left, y 60 to 90 from the io edge): glTF x -20 to 20, z 80 - 90 = -10 to 80 - 60 = 20
    const params = { ...BASE, recessWMm: 40, recessHMm: 30, recessXMm: 19, recessYMm: 60, recessDepthMm: 1.5 }
    const { verts, measure, tris } = await build(RECORDER, params)
    const at = (y: number): V3[] => verts.filter((v) => Math.abs(v[1] - y * MM) < 1e-7 && Math.abs(v[0]) <= 20.001 * MM && v[2] >= -10.001 * MM && v[2] <= 20.001 * MM)
    const floor = [...new Map(at(43 - 1.5).map((v) => [v.map((c) => Math.round(c * 1e7)).join(','), v])).values()]
    expect(floor).toHaveLength(4)
    expect(Math.min(...floor.map((v) => v[0])) / MM).toBeCloseTo(-20, 3)
    expect(Math.max(...floor.map((v) => v[0])) / MM).toBeCloseTo(20, 3)
    expect(Math.min(...floor.map((v) => v[2])) / MM).toBeCloseTo(-10, 3)
    expect(Math.max(...floor.map((v) => v[2])) / MM).toBeCloseTo(20, 3)
    expect(at(43).length).toBeGreaterThanOrEqual(4)                // the mouth, in the top plane
    expect(measure.recessDepthMm).toBeCloseTo(1.5, 3)
    expect(extent(verts, 1)[1]).toBeCloseTo(43, 3)
    expect(tris).toBeLessThanOrEqual(2000)
  }, 120_000)

  it.skipIf(!BLENDER)('lid seam: a groove seamDepthMm deep runs round the body at the seam height and the box keeps its size', async () => {
    const { verts, measure } = await build(RECORDER, { ...BASE, seamHeightMm: 22, seamWidthMm: 1, seamDepthMm: 0.6 })
    const widest = (y: number): number => Math.max(...verts.filter((v) => Math.abs(v[1] - y * MM) < 1e-7).map((v) => Math.abs(v[0]))) / MM
    expect(widest(22)).toBeCloseTo(39 - 0.6, 3)         // the bottom of the groove
    expect(widest(21.5)).toBeCloseTo(39, 3)             // its lips, half the width above and below
    expect(widest(22.5)).toBeCloseTo(39, 3)
    const deepest = (y: number): number => Math.max(...verts.filter((v) => Math.abs(v[1] - y * MM) < 1e-7).map((v) => Math.abs(v[2]))) / MM
    expect(deepest(22)).toBeCloseTo(80 - 0.6, 3)        // all the way round: the rear and the front too
    expect(measure.seamDepthMm).toBeCloseTo(0.6, 3)
    expect(extent(verts, 1)[1]).toBeCloseTo(43, 3)
    expect(extent(verts, 0)[1]).toBeCloseTo(39, 3)
  }, 120_000)

  it.skipIf(!BLENDER)('hinged laptop opens to the plan angle: the lid leans back lidAngleDeg from closed, and the open pose is the spec size', async () => {
    const lid = { cornerRadiusMm: 6, edgeRadiusMm: 2, lidAngleDeg: 100, lidThicknessMm: 8, baseHeightMm: 14, baseDepthMm: 220 }
    const pose = mouldedHingePose(lid)
    const { verts, measure } = await build({ w: 313, h: pose.h, d: pose.d }, lid)
    expect(Math.abs(measure.lidAngleDeg - 100)).toBeLessThan(0.2)
    expect(extent(verts, 0)[1] - extent(verts, 0)[0]).toBeCloseTo(313, 3)
    expect(extent(verts, 1)[1]).toBeCloseTo(pose.h, 2)
    expect(extent(verts, 2)[1] - extent(verts, 2)[0]).toBeCloseTo(pose.d, 2)
    expect(extent(verts, 1)[0]).toBeCloseTo(0, 3)
    // other angles
    for (const angle of [45, 90, 135]) {
      const p = { ...lid, lidAngleDeg: angle }
      const o = mouldedHingePose(p)
      const r = await build({ w: 313, h: o.h, d: o.d }, p)
      expect(Math.abs(r.measure.lidAngleDeg - angle), `${angle} degrees`).toBeLessThan(0.2)   // the rounded slab edges make the real pose a little smaller than the sharp one the size comes from
      expect(extent(r.verts, 1)[1], `${angle} degrees: height`).toBeCloseTo(o.h, 2)
    }
  }, 240_000)

  it.skipIf(!BLENDER)('a hinged pose up to 3 % off the spec is stretched to the exact spec size (the angle moves by less than 2 degrees); more is refused with the pose size', async () => {
    const lid = { cornerRadiusMm: 6, edgeRadiusMm: 2, lidAngleDeg: 100, lidThicknessMm: 8, baseHeightMm: 14, baseDepthMm: 220 }
    const pose = mouldedHingePose(lid)
    const { verts, measure } = await build({ w: 313, h: pose.h * 1.02, d: pose.d * 0.98 }, lid)
    expect(extent(verts, 1)[1]).toBeCloseTo(pose.h * 1.02, 2)
    expect(extent(verts, 2)[1] - extent(verts, 2)[0]).toBeCloseTo(pose.d * 0.98, 2)
    expect(Math.abs(measure.lidAngleDeg - 100)).toBeLessThan(2)
    await expect(build({ w: 313, h: pose.h * 1.1, d: pose.d }, lid)).rejects.toThrow(/the open pose is 313(\.0)? x [\d.]+ x [\d.]+ mm .* spec size/)
  }, 240_000)

  it.skipIf(!BLENDER)('a laptop keyboard well (recess) cuts the top of the base, not the lid', async () => {
    const lid = { cornerRadiusMm: 6, edgeRadiusMm: 2, lidAngleDeg: 100, lidThicknessMm: 8, baseHeightMm: 14, baseDepthMm: 220, recessWMm: 200, recessHMm: 80, recessXMm: 56, recessYMm: 60, recessDepthMm: 1 }
    const pose = mouldedHingePose(lid)
    const { verts, measure } = await build({ w: 313, h: pose.h, d: pose.d }, lid)
    expect(measure.recessDepthMm).toBeCloseTo(1, 3)
    // the floor is a plane 1 mm under the base top (y = 14 - 1 = 13): at least 4 vertices of it
    expect(verts.filter((v) => Math.abs(v[1] - 13 * MM) < 0.1 * MM).length).toBeGreaterThanOrEqual(4)   // (the pose is stretched by about 0.2 % to the spec height)
  }, 120_000)

  it.skipIf(!BLENDER)('ports with insetMm get a round pocket in the rear face; a port too near the rounded corner is refused', async () => {
    const ports = [{ portId: 'p1', xMm: 39, yMm: 20, insetMm: 4, openingMm: 14 }]
    const { verts } = await build({ w: 78, h: 43, d: 160 }, BASE, { ports })
    // the pocket floor: vertices 4 mm in front of the rear plane (z = 76), around x = 0, y = 20
    const floor = verts.filter((v) => Math.abs(v[2] - 76 * MM) < 1e-7 && Math.abs(v[0]) < 7.5 * MM && Math.abs(v[1] - 20 * MM) < 7.5 * MM)
    expect(floor.length).toBeGreaterThanOrEqual(16)
    await expect(build({ w: 78, h: 43, d: 160 }, BASE, { ports: [{ portId: 'p1', xMm: 5, yMm: 20, insetMm: 4, openingMm: 14 }] })).rejects.toThrow(/the pocket of port 'p1'.*does not fit in the flat rear face/)
  }, 240_000)

  describe('flat zones: detail over a control is refused, beside it builds', () => {
    it.skipIf(!BLENDER)('a recess over a control of the top face', async () => {
      const zone = [{ face: 'top', x0: 25, y0: 70, x1: 45, y1: 85 }]
      const params = { ...BASE, recessWMm: 40, recessHMm: 30, recessXMm: 19, recessYMm: 60 }
      await expect(build(RECORDER, params, { flatZones: zone })).rejects.toThrow(/the recess .*overlaps a flat zone of a control/)
      const ok = await build(RECORDER, { ...params, recessYMm: 100 }, { flatZones: zone })
      expect(ok.measure.recessDepthMm).toBeGreaterThan(0)
    }, 240_000)
    it.skipIf(!BLENDER)('a seam across a control of a side face', async () => {
      const params = { ...BASE, seamHeightMm: 22 }
      await expect(build(RECORDER, params, { flatZones: [{ face: 'io', x0: 30, y0: 15, x1: 48, y1: 30 }] })).rejects.toThrow(/the lid seam .*overlaps a flat zone of a control/)
      await expect(build(RECORDER, params, { flatZones: [{ face: 'left', x0: 60, y0: 20, x1: 100, y1: 25 }] })).rejects.toThrow(/the lid seam .*overlaps a flat zone of a control/)
      const ok = await build(RECORDER, params, { flatZones: [{ face: 'io', x0: 30, y0: 3, x1: 48, y1: 12 }] })
      expect(ok.measure.seamDepthMm).toBeGreaterThan(0)
    }, 240_000)
  })

  it.skipIf(!BLENDER)('BuildError: a recess off the flat top, a seam with no wall, plan corners tighter than the fillet', async () => {
    await expect(build(RECORDER, { ...BASE, recessWMm: 40, recessHMm: 30, recessXMm: 1, recessYMm: 60 })).rejects.toThrow(/the recess .*does not fit in the flat top/)
    await expect(build(RECORDER, { cornerRadiusMm: 2, edgeRadiusMm: 3 })).rejects.toThrow(/cornerRadiusMm/)
    await expect(build(RECORDER, { ...BASE, seamHeightMm: 2 })).rejects.toThrow(/seamHeightMm/)
    await expect(build(RECORDER, { ...BASE, nonsenseMm: 1 })).rejects.toThrow(/moulded-box has no param 'nonsenseMm'/)
  }, 240_000)

  it.skipIf(!BLENDER)('deterministic: twelve parallel builds of a box with recess and pocket, and of one with recess and seam, are byte-identical, and a hinged one twice', async () => {
    const recess = { recessWMm: 40, recessHMm: 30, recessXMm: 19, recessYMm: 60 }
    const ports = [{ portId: 'p1', xMm: 39, yMm: 20, insetMm: 4, openingMm: 14 }]
    const withPocket = await Promise.all(Array.from({ length: 12 }, () => build(RECORDER, { ...BASE, ...recess }, { ports })))
    expect(new Set(withPocket.map((r) => r.sha256)).size).toBe(1)
    const withSeam = await Promise.all(Array.from({ length: 12 }, () => build(RECORDER, { ...BASE, ...recess, seamHeightMm: 22 })))
    expect(new Set(withSeam.map((r) => r.sha256)).size).toBe(1)
    const lid = { cornerRadiusMm: 6, edgeRadiusMm: 2, lidAngleDeg: 100, lidThicknessMm: 8, baseHeightMm: 14, baseDepthMm: 220 }
    const pose = mouldedHingePose(lid)
    const [a, b] = await Promise.all([build({ w: 313, h: pose.h, d: pose.d }, lid), build({ w: 313, h: pose.h, d: pose.d }, lid)])
    expect(a.sha256).toBe(b.sha256)
  }, 300_000)

  it.skipIf(!BLENDER)('the old curved-cabinet output is unchanged: the six committed curved cabinets (pins of builderPins.test.ts) keep their bytes', async () => {
    const pins = JSON.parse(await readFile(new URL('./fixtures/builder-pins-wave2.json', import.meta.url), 'utf8')) as Record<string, { sha256?: string; plan: { shape: string } }>
    const cabinets = Object.entries(pins).filter(([, p]) => p.plan.shape === 'curved-cabinet')
    expect(cabinets).toHaveLength(6)
    for (const [id, p] of cabinets) {
      expect(p.sha256, `${id} is byte-pinned`).toBeDefined()
      const r = await buildPlanRaw(BLENDER as string, dir, `cab-${id}`, p.plan)
      expect(r.sha256, id).toBe(p.sha256)
    }
  }, 300_000)

  it.skipIf(!BLENDER)('a recorder-class sample stays inside the small-gear triangle class (up to 2000) and builds from a spec through runBuilder', async () => {
    const s = AssetSpec.parse(spec('recorder-from-spec', RECORDER, { ...BASE, recessWMm: 40, recessHMm: 30, recessXMm: 19, recessYMm: 60, edgeSegments: 8 }, { ports: [{ portId: 'p1', face: 'io', xMm: 39, yMm: 20, insetMm: 4, openingMm: 14, confidence: 'guess' }] }))
    const out = join(dir, 'from-spec.glb')
    const measure = await runBuilder(s, out)
    expect(measure.filletMm).toBeCloseTo(3, 2)
    const tris = (await inspectGlb(new Uint8Array(await readFile(out)))).triangles
    expect(tris).toBeGreaterThanOrEqual(700)
    expect(tris).toBeLessThanOrEqual(2000)
  }, 120_000)
})
