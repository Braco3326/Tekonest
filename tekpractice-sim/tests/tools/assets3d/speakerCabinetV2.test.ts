/**
 * Tests for speaker-cabinet-v2 (Wave 3, Task 3.1): a loudspeaker enclosure with an elevation (side) profile, handle recesses, a pole socket, rigging points, a grille recess and
 * rear pockets. Params and their checks run without Blender; the geometry runs through the real builder (skipped when Blender is not installed).
 *
 * Frame of the built mesh: bottom at y = 0, centred on x and z, the io (rear) face at z = +d/2, the baffle at the front (z = -d/2).
 * The rounding stretches the cabinet back to its exact size, so elevation numbers are compared with a tolerance of a few millimetres, never exactly.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildAsset } from '../../../tools/assets3d/build-asset'
import { findBlender } from '../../../tools/assets3d/env'
import { inspectGlb } from '../../../tools/assets3d/inspect'
import { loadSpecs } from '../../../tools/assets3d/loadSpecs'
import { runBuilder } from '../../../tools/assets3d/runBuilder'
import { BUILD_SHAPES, SHAPE_SPECS, SPEAKER_V2_PARAMS, speakerV2Elevation, validateBuild } from '../../../tools/assets3d/shapes'
import { AssetSpec } from '../../../tools/assets3d/specSchema'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'
import { buildPlanRaw, fingerprint } from './rawBuild'

const BLENDER = findBlender()
const MM = 0.001
/** A subwoofer box (the L-Acoustics KS28 class), a line-array element and a floor wedge. w x h x d. */
const SUB = { w: 600, h: 550, d: 700 }
const ARRAY = { w: 700, h: 290, d: 450 }
const WEDGE = { w: 600, h: 330, d: 380 }
const HANDLES = { handleCount: 2, handleLenMm: 160, handleWidthMm: 40, handleDepthMm: 14, handleFromRearMm: 150, handlePitchMm: 400, handleYMm: 300 }
const EVERYTHING = { ...HANDLES, poleSocketDiaMm: 36, poleSocketDepthMm: 30, rigPoints: 4, rigDiaMm: 14, rigDepthMm: 0.8, grilleMarginMm: 20, grilleDepthMm: 1.5 }
const TRAPEZOID = { rearTopDropMm: 40, rearBottomRiseMm: 40 }

function spec(id: string, size: { w: number; h: number; d: number }, params: Record<string, number>, over: Partial<AssetSpecT> = {}): AssetSpecT {
  const base = loadSpecs().find((s) => s.id === 'apple-mac-mini') as AssetSpecT
  return { ...base, id, realSizeMm: size, ports: [], controls: [], texture: undefined, portsDocumented: undefined, portsSource: undefined, build: { shape: 'speaker-cabinet-v2', params }, ...over }
}

describe('speaker-cabinet-v2 params (no Blender)', () => {
  it('is registered as a device shape with ports and flat zones', () => {
    expect(BUILD_SHAPES).toContain('speaker-cabinet-v2')
    expect(SHAPE_SPECS['speaker-cabinet-v2']).toMatchObject({ kind: 'device', usesPorts: true, usesFlatZones: true, needsMatingOuter: false })
    expect(SHAPE_SPECS['speaker-cabinet-v2'].params).toEqual([...SPEAKER_V2_PARAMS])
    for (const n of ['rearTopDropMm', 'frontTopSetMm', 'handleCount', 'poleSocketDiaMm', 'rigPoints', 'grilleMarginMm']) expect(SPEAKER_V2_PARAMS).toContain(n)
  })

  it('accepts a sub with everything, a trapezoid array element with a tapered plan and a wedge, through the zod schema', () => {
    for (const [size, params] of [
      [SUB, EVERYTHING],
      [ARRAY, { ...TRAPEZOID, rearWidthMm: 500, midWidthMm: 650, taperDepthMm: 200 }],
      [WEDGE, { frontTopSetMm: 180, handleCount: 1, handleLenMm: 120, handleWidthMm: 30, handleFromRearMm: 150, handleYMm: 200, grilleMarginMm: 15 }],
    ] as const) {
      const s = spec('x', size, params)
      expect(AssetSpec.safeParse(s).success).toBe(true)
      expect(validateBuild(s)).toEqual([])
    }
  })

  it('computes the elevation corners: the rear height is the height less the top drop and the bottom rise, the wedge front leans back', () => {
    const a = speakerV2Elevation(ARRAY, TRAPEZOID)
    expect(a.rearHeightMm).toBe(290 - 40 - 40)
    expect(a.frontHeightMm).toBe(290)
    expect(a.fb).toEqual([-225, 0])
    expect(a.rt).toEqual([225, 250])
    const w = speakerV2Elevation(WEDGE, { frontTopSetMm: 180 })
    expect(w.ft).toEqual([-190 + 180, 330])
    expect(w.rearHeightMm).toBe(330)
    expect(w.frontHeightMm).toBeCloseTo(Math.hypot(180, 330), 9)
  })

  it('rejects an unknown param by name and a non positive one', () => {
    expect(validateBuild(spec('x', SUB, { nonsenseMm: 2 }))[0]).toMatch(/no param 'nonsenseMm'/)
    expect(validateBuild(spec('x', SUB, { edgeRadiusMm: 0 }))[0]).toMatch(/positive number/)
  })

  it('refuses an elevation that does not touch the whole bounding box, is not convex, or leaves no rear face', () => {
    expect(validateBuild(spec('x', ARRAY, { rearTopDropMm: 40, frontTopDropMm: 10 }))[0]).toMatch(/must touch the top.*at most one of rearTopDropMm and frontTopDropMm/)
    expect(validateBuild(spec('x', ARRAY, { rearBottomRiseMm: 40, frontBottomRiseMm: 10 }))[0]).toMatch(/touch the base/)
    expect(validateBuild(spec('x', WEDGE, { frontTopSetMm: 100, frontBottomSetMm: 50 }))[0]).toMatch(/touch the baffle plane/)
    expect(validateBuild(spec('x', ARRAY, { rearTopDropMm: 140, rearBottomRiseMm: 140 }))[0]).toMatch(/rear face is only 10.0 mm high/)
    expect(validateBuild(spec('x', ARRAY, { frontTopDropMm: 280 }))[0]).toMatch(/front face is only/)
  })

  it('refuses the plan the way speaker-cabinet does, and a rounding that is too big or has a bad segment count', () => {
    expect(validateBuild(spec('x', SUB, { rearWidthMm: 400 }))[0]).toMatch(/needs taperDepthMm/)
    expect(validateBuild(spec('x', SUB, { midWidthMm: 700 }))[0]).toMatch(/midWidthMm \(700\) cannot be wider than the width 600/)
    expect(validateBuild(spec('x', SUB, { taperDepthMm: 100 }))[0]).toMatch(/taperDepthMm .*no effect/)
    expect(validateBuild(spec('x', ARRAY, { ...TRAPEZOID, edgeRadiusMm: 120 }))[0]).toMatch(/edgeRadiusMm \(120\) must be less than half the smallest side/)
    expect(validateBuild(spec('x', SUB, { edgeSegments: 9 }))[0]).toMatch(/edgeSegments.*1 to 8/)
    expect(validateBuild(spec('x', SUB, { edgeSegments: 2.5 }))[0]).toMatch(/edgeSegments/)
    expect(validateBuild(spec('x', SUB, { bodyGrey: 250 }))[0]).toMatch(/bodyGrey/)
  })

  it('wants the handle numbers together, a pitch only with two handles, and the handles on the cabinet', () => {
    expect(validateBuild(spec('x', SUB, { handleCount: 1, handleLenMm: 160 }))[0]).toMatch(/the handles need handleCount, handleLenMm, handleWidthMm, handleFromRearMm, handleYMm \(missing handleWidthMm, handleFromRearMm, handleYMm\)/)
    const noPitch: Record<string, number> = { ...HANDLES }
    delete noPitch.handlePitchMm
    expect(validateBuild(spec('x', SUB, noPitch))[0]).toMatch(/two handles need handlePitchMm/)
    expect(validateBuild(spec('x', SUB, { ...noPitch, handleCount: 1, handlePitchMm: 300 }))[0]).toMatch(/handlePitchMm has no effect with one handle/)
    expect(validateBuild(spec('x', SUB, { ...HANDLES, handlePitchMm: 100 }))[0]).toMatch(/handlePitchMm \(100\) must be at least handleLenMm/)
    expect(validateBuild(spec('x', SUB, { ...HANDLES, handleFromRearMm: 50 }))[0]).toMatch(/runs out of the io face/)
    expect(validateBuild(spec('x', SUB, { ...HANDLES, handleFromRearMm: 500 }))[0]).toMatch(/beyond the depth 700/)
    expect(validateBuild(spec('x', SUB, { ...HANDLES, handleYMm: 540 }))[0]).toMatch(/outside the height 550/)
    expect(validateBuild(spec('x', SUB, { ...HANDLES, handleDepthMm: 200 }))[0]).toMatch(/handleDepthMm/)
    expect(validateBuild(spec('x', SUB, { ...HANDLES, handleWidthMm: 200 }))[0]).toMatch(/handleWidthMm/)
  })

  it('wants a pole socket in a flat bottom, a grille depth with its margin, and rigging points as 2 or 4 shallow recesses', () => {
    expect(validateBuild(spec('x', SUB, { poleSocketDepthMm: 30 }))[0]).toMatch(/poleSocketDepthMm has no effect without poleSocketDiaMm/)
    expect(validateBuild(spec('x', ARRAY, { ...TRAPEZOID, poleSocketDiaMm: 36 }))[0]).toMatch(/pole socket is cut into a bottom that stands flat/)
    expect(validateBuild(spec('x', SUB, { poleSocketDiaMm: 700 }))[0]).toMatch(/poleSocketDiaMm \(700\)/)
    expect(validateBuild(spec('x', SUB, { grilleDepthMm: 2 }))[0]).toMatch(/grilleDepthMm has no effect without grilleMarginMm/)
    expect(validateBuild(spec('x', SUB, { rigDiaMm: 14 }))[0]).toMatch(/rigDiaMm has no effect without rigPoints/)
    expect(validateBuild(spec('x', SUB, { rigPoints: 3 }))[0]).toMatch(/rigPoints must be 2 .* or 4/)
    expect(validateBuild(spec('x', SUB, { rigPoints: 2, rigDiaMm: 10, rigDepthMm: 6 }))[0]).toMatch(/shallow recess/)
  })

  it('checks that a pocket belongs to the io face and is not deeper than half the depth', () => {
    const port = { portId: 'in', face: 'opposite' as const, xMm: 100, yMm: 100, confidence: 'guess' as const, insetMm: 8 }
    expect(validateBuild(spec('x', SUB, {}, { ports: [port] }))[0]).toMatch(/is on the opposite face: a pocket is cut on the io face only/)
    expect(validateBuild(spec('x', SUB, {}, { ports: [{ ...port, face: 'io', insetMm: 400 }] }))[0]).toMatch(/deeper than half the depth/)
  })
})

describe(`speaker-cabinet-v2 with real Blender (${BLENDER ? `using ${BLENDER}` : 'SKIPPED, Blender not found: install Blender or set BLENDER_EXE'})`, () => {
  let dir = ''
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tekpractice-spk2-'))
  })
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  let count = 0
  type V3 = [number, number, number]
  async function build(size: { w: number; h: number; d: number }, params: Record<string, number>, extra: Record<string, unknown> = {}): Promise<{ bytes: Uint8Array; sha256: string; tris: number; verts: V3[]; measure: Record<string, number> }> {
    const plan = { id: `sp-${count}`, kind: 'device', shape: 'speaker-cabinet-v2', sizeMm: size, params, flatZones: [], ...extra }
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
    // the exporter splits a vertex wherever the normal or the colour changes: one entry per distinct position
    const seen = new Set<string>()
    for (let i = verts.length - 1; i >= 0; i--) {
      const key = verts[i].map((c) => Math.round(c * 1e7)).join(',')
      if (seen.has(key)) verts.splice(i, 1)
      else seen.add(key)
    }
    return { bytes: r.bytes, sha256: r.sha256, tris: (await inspectGlb(r.bytes)).triangles, verts, measure: r.measure }
  }
  const extent = (verts: V3[], k: 0 | 1 | 2): [number, number] => [Math.min(...verts.map((v) => v[k])) / MM, Math.max(...verts.map((v) => v[k])) / MM]

  it.skipIf(!BLENDER)('size exact: the sub, the trapezoid array element (tapered plan) and the wedge are the spec size on every axis, bottom at 0, centred on x and z', async () => {
    for (const [size, params] of [[SUB, EVERYTHING], [ARRAY, { ...TRAPEZOID, rearWidthMm: 500, midWidthMm: 650, taperDepthMm: 200 }], [WEDGE, { frontTopSetMm: 180, grilleMarginMm: 15 }]] as const) {
      const { verts } = await build(size, params)
      const [x0, x1] = extent(verts, 0)
      const [y0, y1] = extent(verts, 1)
      const [z0, z1] = extent(verts, 2)
      expect(x1 - x0).toBeCloseTo(size.w, 2)
      expect(y1 - y0).toBeCloseTo(size.h, 2)
      expect(z1 - z0).toBeCloseTo(size.d, 2)
      expect(y0).toBeCloseTo(0, 3)
      expect(x0 + x1).toBeCloseTo(0, 2)
      expect(z0 + z1).toBeCloseTo(0, 2)
    }
  }, 240_000)

  it.skipIf(!BLENDER)('elevation profile height at the back: a trapezoid element is as high as its rear face (210 mm), the front still 290 mm, a box is full height at both ends', async () => {
    const { verts } = await build(ARRAY, TRAPEZOID)
    const strip = (lo: number, hi: number): V3[] => verts.filter((v) => v[2] / MM >= lo && v[2] / MM <= hi)
    const rear = strip(ARRAY.d / 2 - 6, ARRAY.d / 2)
    const front = strip(-ARRAY.d / 2, -ARRAY.d / 2 + 6)
    const rearTop = Math.max(...rear.map((v) => v[1] / MM))
    const rearBottom = Math.min(...rear.map((v) => v[1] / MM))
    expect(rearTop).toBeLessThanOrEqual(250 + 1.5)
    expect(rearTop).toBeGreaterThan(250 - 8)
    expect(rearBottom).toBeGreaterThanOrEqual(40 - 1.5)
    expect(rearBottom).toBeLessThan(40 + 8)
    expect(Math.max(...front.map((v) => v[1] / MM))).toBeGreaterThan(290 - 2)
    expect(Math.min(...front.map((v) => v[1] / MM))).toBeLessThan(2)
    const box = (await build(ARRAY, {})).verts
    expect(Math.max(...box.filter((v) => v[2] / MM > ARRAY.d / 2 - 6).map((v) => v[1] / MM))).toBeGreaterThan(290 - 0.5)
  }, 240_000)

  it.skipIf(!BLENDER)('a wedge baffle leans back: at the front plane the wedge is low, at the rear it is full height, and the top is flat', async () => {
    const { verts } = await build(WEDGE, { frontTopSetMm: 180 })
    const front = verts.filter((v) => v[2] / MM < -WEDGE.d / 2 + 20)
    expect(Math.max(...front.map((v) => v[1] / MM))).toBeLessThan(0.4 * 330)
    expect(Math.max(...verts.filter((v) => v[2] / MM > 0).map((v) => v[1] / MM))).toBeGreaterThan(330 - 0.01)
    // the top face is flat and runs from the set-back front edge (z = -190 + 180 = -10) to the rear (z = 190), less the rounding
    const top = verts.filter((v) => v[1] / MM > 329.99)
    expect(Math.min(...top.map((v) => v[2] / MM))).toBeGreaterThan(-10)
    expect(Math.min(...top.map((v) => v[2] / MM))).toBeLessThan(-10 + 10)
    expect(Math.max(...top.map((v) => v[2] / MM))).toBeGreaterThan(190 - 10)
  }, 240_000)

  it.skipIf(!BLENDER)('handle recesses: two per side, a stadium 160 x 40 mm, 14 mm deep, centred where asked, the floor parallel to the side', async () => {
    const { verts, measure } = await build(SUB, HANDLES)
    expect(measure.handleRecesses).toBe(4)
    expect(measure.handleDepthMm).toBe(14)
    for (const side of [-1, 1]) {
      const floor = verts.filter((v) => Math.abs(Math.abs(v[0]) / MM - (300 - 14)) < 0.01 && Math.sign(v[0]) === side)
      expect(floor.length).toBeGreaterThanOrEqual(2 * 26)   // two stadiums of 26 points
      const ys = floor.map((v) => v[1] / MM)
      expect(Math.min(...ys)).toBeCloseTo(300 - 20, 1)
      expect(Math.max(...ys)).toBeCloseTo(300 + 20, 1)
      const zs = floor.map((v) => v[2] / MM)
      // first handle 150 mm from the rear (z = 350 - 150 = 200), second 400 mm further toward the front (z = -200); each 160 mm long
      expect(Math.max(...zs)).toBeCloseTo(200 + 80, 1)
      expect(Math.min(...zs)).toBeCloseTo(-200 - 80, 1)
      // the mouth lies on the side plane
      const mouth = verts.filter((v) => Math.abs(Math.abs(v[0]) / MM - 300) < 0.01 && Math.sign(v[0]) === side && Math.abs(v[1] / MM - 300) < 20.01 && Math.abs(v[2] / MM - 200) < 80.01)
      expect(mouth.length).toBeGreaterThanOrEqual(26)
    }
  }, 240_000)

  it.skipIf(!BLENDER)('pole socket: a round recess in the bottom, 36 mm across and 30 mm deep, centred on x and on the middle of the depth', async () => {
    const { verts, measure } = await build(SUB, { poleSocketDiaMm: 36 })
    expect(measure.poleSocketDiaMm).toBe(36)
    expect(measure.poleSocketDepthMm).toBe(30)
    const floor = verts.filter((v) => Math.abs(v[1] / MM - 30) < 0.01 && Math.hypot(v[0], v[2]) / MM < 18.01)
    expect(floor.length).toBe(24)
    expect(Math.max(...floor.map((v) => Math.hypot(v[0], v[2]) / MM))).toBeCloseTo(18, 2)
    const mouth = verts.filter((v) => Math.abs(v[1] / MM) < 1e-3 && Math.hypot(v[0], v[2]) / MM < 18.01)
    expect(mouth.length).toBe(24)
    // off the middle: 100 mm from the rear face
    const off = await build(SUB, { poleSocketDiaMm: 36, poleSocketFromRearMm: 100 })
    const c = off.verts.filter((v) => Math.abs(v[1] / MM) < 1e-3 && Math.hypot(v[0], v[2] / MM * MM - 250 * MM) / MM < 18.01)
    expect(c.length).toBe(24)
  }, 240_000)

  it.skipIf(!BLENDER)('rigging points: four shallow 0.8 mm recess markers in each side, in from the corners', async () => {
    const { verts, measure } = await build(SUB, { rigPoints: 4, rigDiaMm: 14, rigDepthMm: 0.8 })
    expect(measure.rigPoints).toBe(8)
    expect(measure.rigDepthMm).toBe(0.8)
    for (const side of [-1, 1]) {
      const floor = verts.filter((v) => Math.abs(Math.abs(v[0]) / MM - (300 - 0.8)) < 0.005 && Math.sign(v[0]) === side)
      expect(floor.length).toBe(4 * 16)
    }
    const two = await build(SUB, { rigPoints: 2 })
    expect(two.measure.rigPoints).toBe(4)
  }, 240_000)

  it.skipIf(!BLENDER)('grille recess: a shallow panel in the baffle, 20 mm in from the flat face, 1.5 mm deep', async () => {
    const { verts, measure } = await build(SUB, { grilleMarginMm: 20, grilleDepthMm: 1.5 })
    expect(measure.grilleDepthMm).toBe(1.5)
    const floor = verts.filter((v) => Math.abs(v[2] / MM - (-350 + 1.5)) < 0.005)
    expect(floor.length).toBe(4)
    const xs = floor.map((v) => v[0] / MM)
    const ys = floor.map((v) => v[1] / MM)
    // the flat baffle face ends one fillet in from the edge (about 4 mm with the default rounding): the panel stands 20 mm inside that
    expect(Math.max(...xs)).toBeGreaterThan(300 - 4.2 - 20.1)
    expect(Math.max(...xs)).toBeLessThan(300 - 3.5 - 19.9)
    expect(Math.max(...ys)).toBeLessThan(550 - 3.5 - 19.9)
  }, 240_000)

  it.skipIf(!BLENDER)('rear pockets stay behind the inset ports: a round pocket per port, its floor insetMm behind the rear face, on the elevation of a trapezoid element too', async () => {
    const ports = [{ portId: 'in-a', xMm: 200, yMm: 130, insetMm: 10, openingMm: 24 }, { portId: 'power-in', xMm: 420, yMm: 130, insetMm: 14 }]
    for (const [size, params] of [[SUB, {}], [ARRAY, TRAPEZOID]] as const) {
      const { verts } = await build(size, params, { ports })
      const rearZ = size.d / 2
      const floorA = verts.filter((v) => Math.abs(v[2] / MM - (rearZ - 10)) < 0.01 && Math.hypot(v[0] / MM - (200 - size.w / 2), v[1] / MM - 130) < 12.01)
      expect(floorA.length).toBe(16)
      const floorB = verts.filter((v) => Math.abs(v[2] / MM - (rearZ - 14)) < 0.01 && Math.hypot(v[0] / MM - (420 - size.w / 2), v[1] / MM - 130) < 12.01)
      expect(floorB.length).toBe(16)
      const mouthA = verts.filter((v) => Math.abs(v[2] / MM - rearZ) < 0.01 && Math.hypot(v[0] / MM - (200 - size.w / 2), v[1] / MM - 130) < 12.01)
      expect(mouthA.length).toBe(16)
    }
  }, 240_000)

  it.skipIf(!BLENDER)('writes the measured fillet (the effective radius of the facets), a feature that does not fit is refused with a one-line message', async () => {
    const { measure } = await build(SUB, { edgeRadiusMm: 10, edgeSegments: 4 })
    expect(measure.filletMm).toBeGreaterThan(0.8 * 10)
    expect(measure.filletMm).toBeLessThanOrEqual(10.01)
    const bad = async (size: { w: number; h: number; d: number }, params: Record<string, number>, extra: Record<string, unknown> = {}): Promise<string> => build(size, params, extra).then(() => 'built', (e: Error) => e.message)
    expect(await bad(SUB, { handleCount: 1, handleLenMm: 160, handleWidthMm: 40, handleFromRearMm: 80, handleYMm: 300 })).toMatch(/handle 1 of the left side .* does not fit in the flat sideL0 face/)
    expect(await bad(SUB, { poleSocketDiaMm: 595 })).toMatch(/does not fit in the flat bottom face/)
    expect(await bad(SUB, { grilleMarginMm: 400 })).toMatch(/grilleMarginMm/)
    expect(await bad(SUB, {}, { ports: [{ portId: 'far', xMm: 598, yMm: 100, insetMm: 8 }] })).toMatch(/pocket of port 'far'.*does not fit in the flat rear face/)
    expect(await bad(SUB, { rigPoints: 4, rigInsetMm: 3 })).toMatch(/rigging point/)
    expect(await bad(SUB, { edgeRadiusMm: 400 })).toMatch(/edgeRadiusMm .* too large/)
    expect(await bad(SUB, { handleCount: 1, handleLenMm: 160, handleWidthMm: 40, handleFromRearMm: 150, handleYMm: 300, rigPoints: 4, rigInsetMm: 250, rigDiaMm: 100 })).toMatch(/overlaps/)
    // a handle over the flat zone of a control on the left face is refused
    const zone = [{ face: 'left', x0: 300, x1: 400, y0: 250, y1: 350 }]
    expect(await bad(SUB, { handleCount: 1, handleLenMm: 160, handleWidthMm: 40, handleFromRearMm: 400, handleYMm: 300 }, { flatZones: zone })).toMatch(/overlaps a flat zone of a control/)
  }, 300_000)

  it.skipIf(!BLENDER)('deterministic: twelve parallel builds of the sub with everything, of the tapered trapezoid and of the wedge with pockets are byte-identical', async () => {
    const ports = [{ portId: 'in-a', xMm: 200, yMm: 130, insetMm: 10, openingMm: 24 }]
    const a = await Promise.all(Array.from({ length: 12 }, () => build(SUB, EVERYTHING, { ports })))
    expect(new Set(a.map((r) => r.sha256)).size).toBe(1)
    const b = await Promise.all(Array.from({ length: 12 }, () => build(ARRAY, { ...TRAPEZOID, rearWidthMm: 500, midWidthMm: 650, taperDepthMm: 200 })))
    expect(new Set(b.map((r) => r.sha256)).size).toBe(1)
    const c = await Promise.all(Array.from({ length: 12 }, () => build(WEDGE, { frontTopSetMm: 180, handleCount: 1, handleLenMm: 120, handleWidthMm: 30, handleFromRearMm: 150, handleYMm: 200, grilleMarginMm: 15 }, { ports })))
    expect(new Set(c.map((r) => r.sha256)).size).toBe(1)
  }, 600_000)

  it.skipIf(!BLENDER)('sample triangle counts stay in the speaker class (up to 4000)', async () => {
    for (const [size, params] of [[SUB, EVERYTHING], [ARRAY, { ...TRAPEZOID, rearWidthMm: 500, midWidthMm: 650, taperDepthMm: 200 }], [WEDGE, { frontTopSetMm: 180, grilleMarginMm: 15 }]] as const) {
      const { tris } = await build(size, params)
      expect(tris).toBeGreaterThan(150)
      expect(tris).toBeLessThanOrEqual(4000)
    }
  }, 240_000)

  it.skipIf(!BLENDER)('the old output is unchanged: speaker-cabinet (hexagon, pockets) and the Wave 2 shapes keep their pinned geometry, and the byte-stable ones their pinned bytes (the hexagon with pockets fills its rear face with bmesh beauty fill, which Wave 2 found is not byte-stable once the script text changes: fingerprint only)', async () => {
    const pins = JSON.parse(await readFile(new URL('./fixtures/builder-pins-wave3.json', import.meta.url), 'utf8')) as Record<string, { fingerprint: string; sha256?: string; plan: unknown }>
    expect(Object.keys(pins)).toHaveLength(8)
    const bad: string[] = []
    for (const [name, pin] of Object.entries(pins)) {
      const r = await buildPlanRaw(BLENDER as string, dir, `pin-${name}`, pin.plan)
      if ((await fingerprint(r.bytes)) !== pin.fingerprint) bad.push(`${name}: geometry changed`)
      if (pin.sha256 !== undefined && r.sha256 !== pin.sha256) bad.push(`${name}: bytes changed`)
    }
    expect(bad).toEqual([])
  }, 300_000)

  it.skipIf(!BLENDER)('builds from a spec through runBuilder and the real gates: size, ports on the pocket floors (portSurface), detail, fillet', async () => {
    const ports = [
      { portId: 'in-line', face: 'io' as const, xMm: 200, yMm: 130, confidence: 'guess' as const, openingMm: 24, insetMm: 10 },
      { portId: 'power-in', face: 'io' as const, xMm: 420, yMm: 130, confidence: 'guess' as const, openingMm: 24, insetMm: 10 },
    ]
    const s = AssetSpec.parse(spec('spk-gates', SUB, { ...EVERYTHING, edgeRadiusMm: 6 }, { ports, build: { shape: 'speaker-cabinet-v2', params: { ...EVERYTHING, edgeRadiusMm: 6 }, budget: { min: 600, max: 4000 }, minFilletMm: 4 } }))
    const raw = join(dir, 'spk-gates.glb')
    const measured = await runBuilder(s, raw)
    expect(measured.filletMm).toBeGreaterThanOrEqual(4)
    expect(measured.handleRecesses).toBe(4)
    expect(measured.poleSocketDiaMm).toBe(36)
    const catalog = { devices: [{ id: s.id, ports: ports.map((p) => ({ portId: p.portId })), controls: [] }] }
    const report = await buildAsset(s.id, { maxAttempts: 1, scripted: true, dryRun: true }, {
      loadSpec: () => s,
      loadCatalog: () => catalog as never,
      paths: { assetsDir: join(dir, 'assets'), sourceDir: join(dir, 'source'), manifestPath: join(dir, 'manifest.json') },
      log: () => undefined,
      renderSheet: null,
    })
    const gates = report.attempts[report.attempts.length - 1].gates
    expect(report.error).toBeUndefined()
    expect(gates.filter((g) => !g.ok)).toEqual([])
    expect(gates.map((g) => g.gate)).toEqual(expect.arrayContaining(['size', 'portSurface', 'detail', 'fillet']))
  }, 300_000)
})
