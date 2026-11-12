/**
 * Tests for rack-box v3b (Wave 2, Task 2.1): front vent slots cut through the front plate, a meter window recess, and ear handles that stand
 * clear of the rack-ear slots. They are extension params of the existing `rack-box` shape (RACK_V3B_PARAMS), not a fork: every old rack-box
 * output stays byte-identical (the 93 pins of builderPins.test.ts, and five detailed boxes here). The param checks run without Blender;
 * the geometry runs through the real builder (skipped when Blender is not installed, like rackDevice.test.ts).
 *
 * Conventions used below: the front plate is at z = -d/2 in the built frame (the `opposite` face, frontOnIo off). Face-local x of a feature on the
 * front face is measured from the LEFT as seen from the front, so a feature at face x = u is at built x = w/2 - u.
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
import { RACK_V2_PARAMS, RACK_V3B_PARAMS, SHAPE_SPECS, validateBuild } from '../../../tools/assets3d/shapes'
import { AssetSpec } from '../../../tools/assets3d/specSchema'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'
import { buildPlanRaw, fingerprint } from './rawBuild'

const BLENDER = findBlender()
const MM = 0.001
const ONE_U = { w: 482.6, h: 44.45, d: 300 }
const TWO_U = { w: 482.6, h: 88.9, d: 300 }

/** A rack-box device spec of the given size (the catalogue parity is not needed by the builder). */
function rackSpec(id: string, size: { w: number; h: number; d: number }, params: Record<string, number>, over: Partial<AssetSpecT> = {}): AssetSpecT {
  const base = loadSpecs().find((s) => s.id === 'avid-hd-io') as AssetSpecT
  return { ...base, id, realSizeMm: size, ports: [], controls: [], texture: undefined, build: { shape: 'rack-box', params }, ...over }
}

/** The chassis and the 1U plate every geometry test starts from: a 438 mm chassis behind a 482.6 mm plate, ear slots, 4 mm plate. */
const BASE = { bodyWidthMm: 438, earThicknessMm: 4, earHoleMm: 6.35, filletMm: 1.5, filletSegments: 4 }
/** A row of 8 x 2 slots, 30 x 3 mm, centred on the plate. */
const VENTS = { frontVentSlots: 8, frontVentRows: 2, frontVentSlotLenMm: 30, frontVentSlotWidthMm: 3, frontVentColPitchMm: 36, frontVentRowPitchMm: 9, frontVentXMm: 241.3, frontVentYMm: 22.2 }
const WINDOW = { windowWMm: 60, windowHMm: 28, windowXMm: 40, windowYMm: 8, windowDepthMm: 2.5 }
const EAR_HANDLES = { earHandleProjectionMm: 22, earHandleDiaMm: 10 }

describe('rack-box v3b params (no Blender)', () => {
  it('lists the v3b params after the v2 ones, and switches the detailed build on', () => {
    expect(SHAPE_SPECS['rack-box'].params).toEqual(['chamferMm', ...RACK_V2_PARAMS, ...RACK_V3B_PARAMS])
    for (const n of ['frontVentSlots', 'frontVentRows', 'frontVentSlotLenMm', 'frontVentSlotWidthMm', 'frontVentColPitchMm', 'frontVentRowPitchMm', 'frontVentXMm', 'frontVentYMm', 'frontVentDepthMm', 'windowWMm', 'windowHMm', 'windowXMm', 'windowYMm', 'windowDepthMm', 'earHandleProjectionMm', 'earHandleDiaMm', 'earHandleLenMm', 'earHandleFromEndMm']) {
      expect(RACK_V3B_PARAMS, n).toContain(n)
    }
    for (const n of RACK_V3B_PARAMS) expect(RACK_V2_PARAMS as readonly string[], n).not.toContain(n)
  })

  it('accepts each feature alone and all three together, through the zod schema', () => {
    for (const params of [{ ...BASE, ...VENTS }, { ...BASE, ...WINDOW }, { ...BASE, ...EAR_HANDLES }, { ...BASE, ...VENTS, ...WINDOW, ...EAR_HANDLES, frontVentXMm: 300, windowXMm: 15, windowWMm: 30 }]) {
      const spec = rackSpec('amp', TWO_U, params)
      expect(AssetSpec.safeParse(spec).success).toBe(true)
      expect(validateBuild(spec)).toEqual([])
    }
  })

  it('refuses a half-given front vent block, naming what is missing', () => {
    const e = validateBuild(rackSpec('x', ONE_U, { ...BASE, frontVentSlots: 4, frontVentSlotLenMm: 30 }))
    expect(e).toHaveLength(1)
    expect(e[0]).toMatch(/front vents need .*frontVentSlotWidthMm.*frontVentXMm.*frontVentYMm/)
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, frontVentRowPitchMm: 9 }))[0]).toMatch(/front vents need/)
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, frontVentDepthMm: 2 }))[0]).toMatch(/front vents need/)
  })

  it('wants a pitch for every extra column or row, a pitch wider than the slot, and whole counts', () => {
    const single: Record<string, number> = { ...VENTS }
    delete single.frontVentColPitchMm
    delete single.frontVentRowPitchMm
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, ...single, frontVentSlots: 3, frontVentRows: 1 }))[0]).toMatch(/frontVentColPitchMm/)
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, ...single, frontVentSlots: 1, frontVentRows: 2 }))[0]).toMatch(/frontVentRowPitchMm/)
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, ...VENTS, frontVentColPitchMm: 30 }))[0]).toMatch(/frontVentColPitchMm.*more than.*slot/)
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, ...VENTS, frontVentRowPitchMm: 3 }))[0]).toMatch(/frontVentRowPitchMm.*more than.*slot/)
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, ...VENTS, frontVentSlots: 2.5 }))[0]).toMatch(/frontVentSlots.*whole number/)
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, ...VENTS, frontVentRows: 13 }))[0]).toMatch(/frontVentRows.*whole number/)
  })

  it('refuses a vent or window deeper than the plate is thick (the plate is earThicknessMm, default 4 mm)', () => {
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, ...VENTS, frontVentDepthMm: 6 }))[0]).toMatch(/frontVentDepthMm \(6\).*plate thickness \(4/)
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, ...WINDOW, windowDepthMm: 5 }))[0]).toMatch(/windowDepthMm \(5\).*plate thickness \(4/)
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, earThicknessMm: 8, ...WINDOW, windowDepthMm: 5 }))).toEqual([])
  })

  it('wants the four window numbers together and a window that is inside the plate', () => {
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, windowWMm: 60, windowHMm: 28 }))[0]).toMatch(/window needs .*windowXMm.*windowYMm/)
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, windowDepthMm: 2 }))[0]).toMatch(/window needs/)
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, ...WINDOW, windowXMm: 440 }))[0]).toMatch(/window.*outside the plate width/)
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, ...WINDOW, windowYMm: 30 }))[0]).toMatch(/window.*above the height/)
  })

  it('refuses ear handles that are not one handle diameter plus 2 mm deep, or that clash with the v2 handles', () => {
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, earHandleProjectionMm: 11, earHandleDiaMm: 10 }))[0]).toMatch(/earHandleProjectionMm \(11\).*at least the handle diameter plus 2 mm/)
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, ...EAR_HANDLES, handleCount: 2, handleProjectionMm: 20 }))[0]).toMatch(/ear handles and handleCount/)
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, earHandleDiaMm: 10 }))[0]).toMatch(/earHandleDiaMm has no effect without earHandleProjectionMm/)
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, ...EAR_HANDLES, earHandleLenMm: 90 }))[0]).toMatch(/earHandleLenMm \(90\).*height/)
  })

  it('refuses a control on the front face behind ear handles, and a front port that is not set back by the handle depth', () => {
    const control = { controlId: 'power', kind: 'switch', face: 'opposite', xMm: 10, yMm: 10, axis: 'x', sizeMm: { w: 8, h: 8, d: 4 } } as const
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, ...EAR_HANDLES }, { controls: [control] }))[0]).toMatch(/ear handles move the front plate back.*power/)
    const flush = { portId: 'p', face: 'opposite', xMm: 10, yMm: 10, confidence: 'photo' } as const
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, ...EAR_HANDLES }, { ports: [flush] }))[0]).toMatch(/insetMm 22/)
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, ...EAR_HANDLES }, { ports: [{ ...flush, insetMm: 22 }] }))).toEqual([])
    expect(validateBuild(rackSpec('x', ONE_U, { ...BASE, ...EAR_HANDLES }, { ports: [{ ...flush, face: 'io' }] }))).toEqual([])
  })

  it('keeps the old rules: v2 handles still refuse a front port', () => {
    const withPort = rackSpec('x', ONE_U, { handleCount: 2, handleProjectionMm: 20 }, { ports: [{ portId: 'p', face: 'opposite', xMm: 10, yMm: 10, confidence: 'photo' }] })
    expect(validateBuild(withPort)[0]).toMatch(/handles move the front plate back.*opposite/)
  })
})

describe(`rack-box v3b with real Blender (${BLENDER ? `using ${BLENDER}` : 'SKIPPED, Blender not found: install Blender or set BLENDER_EXE'})`, () => {
  let dir = ''
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tekpractice-rack3b-'))
  })
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  let count = 0
  type V3 = [number, number, number]
  /** Builds a plan raw (flat zones given by hand) and returns the bytes, triangles, vertices (metres, glTF space) and the measure file. */
  async function build(size: { w: number; h: number; d: number }, params: Record<string, number>, flatZones: unknown[] = []): Promise<{ bytes: Uint8Array; sha256: string; tris: number; verts: V3[]; measure: Record<string, number> }> {
    const plan = { id: `r3b-${count}`, kind: 'device', shape: 'rack-box', sizeMm: size, params, ...(flatZones.length > 0 ? { flatZones } : { flatZones: [] }) }
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
  /** The distinct vertex positions in the plane z = `z` mm inside the box x0..x1, y0..y1 mm (the exporter splits a vertex at every hard edge, so the raw list repeats a corner three times). */
  const at = (verts: V3[], z: number, x0: number, x1: number, y0: number, y1: number): V3[] => {
    const seen = new Map<string, V3>()
    for (const v of verts) {
      if (Math.abs(v[2] - z * MM) < 1e-7 && v[0] >= x0 * MM - 1e-7 && v[0] <= x1 * MM + 1e-7 && v[1] >= y0 * MM - 1e-7 && v[1] <= y1 * MM + 1e-7) seen.set(v.map((c) => Math.round(c * 1e7)).join(','), v)
    }
    return [...seen.values()]
  }

  it.skipIf(!BLENDER)('front vent slots cut through the plate: mouths on the front plane, rims on the back plane, 16 slots counted', async () => {
    const { verts, measure } = await build(ONE_U, { ...BASE, ...VENTS })
    expect(measure.frontVents).toBe(16)
    // the block is centred on the plate (face x 241.3 = built x 0); 7 * 36 + 30 = 282 mm wide: its slots reach |x| = 141
    const block: [number, number, number, number] = [-142, 142, 12, 33]
    expect(at(verts, -150, ...block).length).toBeGreaterThanOrEqual(16 * 4)             // mouths in the plate's front plane
    expect(at(verts, -146, ...block).length).toBeGreaterThanOrEqual(16 * 4)             // the slot reaches the plate's back plane: it is through the plate
    expect(Math.min(...verts.map((v) => v[2])) / MM).toBeCloseTo(-150, 3)               // the plate face is still the bounding-box face
    // rows at face y = 22.2 -/+ 4.5 -> 17.7 and 26.7, each 3 mm high
    const ys = [...new Set(at(verts, -150, ...block).map((v) => Math.round(v[1] / MM * 100) / 100))]
    for (const y of [16.2, 19.2, 25.2, 28.2]) expect(ys.some((v) => Math.abs(v - y) < 0.02), `a vertex row at y ${y}`).toBe(true)
  }, 120_000)

  it.skipIf(!BLENDER)('a shallower vent (frontVentDepthMm) is a recess whose floor stays inside the plate', async () => {
    const { verts, measure } = await build(ONE_U, { ...BASE, ...VENTS, frontVentDepthMm: 2 })
    expect(measure.frontVents).toBe(16)
    const block: [number, number, number, number] = [-142, 142, 12, 33]
    expect(at(verts, -148, ...block).length).toBeGreaterThanOrEqual(16 * 4)
    expect(at(verts, -146, ...block).length).toBe(0)
  }, 120_000)

  it.skipIf(!BLENDER)('the meter window recess is windowDepthMm deep with its floor inside the plate, at the face position given', async () => {
    const { verts, measure } = await build(ONE_U, { ...BASE, ...WINDOW })
    expect(measure.windows).toBe(1)
    // face x 40 to 100 from the left as seen from the front = built x 201.3 to 141.3 (the front plate is seen from -z)
    const floor = at(verts, -150 + 2.5, 141.3, 201.3, 8, 36)
    expect(floor.length).toBe(4)
    expect(Math.min(...floor.map((v) => v[0])) / MM).toBeCloseTo(141.3, 3)
    expect(Math.max(...floor.map((v) => v[0])) / MM).toBeCloseTo(201.3, 3)
    expect(Math.min(...floor.map((v) => v[1])) / MM).toBeCloseTo(8, 3)
    expect(Math.max(...floor.map((v) => v[1])) / MM).toBeCloseTo(36, 3)
    expect(at(verts, -150, 141.3, 201.3, 8, 36).length).toBe(4)       // the mouth, in the front plane
    expect(at(verts, -146, 141.3, 201.3, 9, 35).length).toBe(0)       // not through
  }, 120_000)

  it.skipIf(!BLENDER)('ear handles sit outside the plate (in front of it, in the bounding box) and clear the ear slots', async () => {
    const { verts, measure } = await build(ONE_U, { ...BASE, ...EAR_HANDLES })
    expect(measure.earHandles).toBe(2)
    expect(measure.earHoles).toBe(4)
    expect(Math.min(...verts.map((v) => v[2])) / MM).toBeCloseTo(-150, 3)
    // the plate's front face is 22 mm behind the bounding-box face, and nothing but the handles is in front of it
    const proud = verts.filter((v) => v[2] < (-150 + 21.8) * MM)
    expect(proud.length).toBeGreaterThan(40)
    // both ends carry a handle, and every handle vertex is inboard of the ear slots: slot mouths span 224.6 to 240.5 mm from the centre
    expect(proud.some((v) => v[0] > 0) && proud.some((v) => v[0] < 0)).toBe(true)
    expect(Math.max(...proud.map((v) => Math.abs(v[0]))) / MM).toBeLessThan(224.6)
    expect(Math.min(...proud.map((v) => Math.abs(v[0]))) / MM).toBeGreaterThan(200)
    // the slots are still cut in the plate
    expect(at(verts, -150 + 22, 224.5, 240.6, 3, 9.7).length).toBeGreaterThanOrEqual(20)
    // the handle bar is inside the plate's height
    expect(Math.max(...proud.map((v) => v[1])) / MM).toBeLessThan(44.45)
    expect(Math.min(...proud.map((v) => v[1])) / MM).toBeGreaterThan(0)
  }, 120_000)

  it.skipIf(!BLENDER)('earHandleFromEndMm and earHandleLenMm place the bar: a longer, further-in handle', async () => {
    const { verts } = await build(TWO_U, { ...BASE, ...EAR_HANDLES, earHandleFromEndMm: 40, earHandleLenMm: 60 })
    const proud = verts.filter((v) => v[2] < (-150 + 21.8) * MM)
    expect(Math.max(...proud.map((v) => Math.abs(v[0]))) / MM).toBeCloseTo(241.3 - 40 + 5, 1)   // the bar's outer edge: axis at 40 mm from the end, radius 5
    expect(Math.max(...proud.map((v) => v[1])) / MM - Math.min(...proud.map((v) => v[1])) / MM).toBeCloseTo(60, 1)
  }, 120_000)

  it.skipIf(!BLENDER)('all three features at once keep the exact size and a rack-gear triangle count', async () => {
    const { verts, tris, measure } = await build(TWO_U, { ...BASE, rearInsetMm: 6, seamMm: 30, ventSlots: 6, ventColumns: 2, ventSlotLenMm: 40, ventSlotWidthMm: 3, ventPitchMm: 8, ventColPitchMm: 60, ...VENTS, ...WINDOW, ...EAR_HANDLES, frontVentXMm: 330, frontVentColPitchMm: 18, frontVentSlots: 6, frontVentRows: 3, frontVentSlotLenMm: 12, frontVentYMm: 44.45, windowXMm: 30 })
    expect(measure.frontVents).toBe(18)
    expect(measure.windows).toBe(1)
    expect(measure.earHandles).toBe(2)
    const ext = (k: 0 | 1 | 2): number => (Math.max(...verts.map((v) => v[k])) - Math.min(...verts.map((v) => v[k]))) / MM
    expect(ext(0)).toBeCloseTo(482.6, 3)
    expect(ext(1)).toBeCloseTo(88.9, 3)
    expect(ext(2)).toBeCloseTo(300, 3)
    expect(tris).toBeGreaterThanOrEqual(1500)
    expect(tris).toBeLessThanOrEqual(3500)
  }, 120_000)

  it.skipIf(!BLENDER)('frontOnIo mirrors the front features to the io face', async () => {
    const { verts, measure } = await build(ONE_U, { ...BASE, ...VENTS, ...WINDOW, frontOnIo: 1 })
    expect(measure.frontVents).toBe(16)
    expect(Math.max(...verts.map((v) => v[2])) / MM).toBeCloseTo(150, 3)
    // seen from the io side the left-hand x runs the other way: the window floor (face x 40..100 from the left) is at built x -141.3 to -201.3 -> +141.3..+201.3 mirrored
    expect(at(verts, 150 - 2.5, -201.3, -141.3, 8, 36).length).toBe(4)
  }, 120_000)

  describe('flat zones: a feature over a control is refused, one beside it builds', () => {
    // a control zone on the front face (`opposite`): face x 100 to 140 mm from the left, y 5 to 40
    const zone = [{ face: 'opposite', x0: 100, y0: 5, x1: 140, y1: 40 }]
    it.skipIf(!BLENDER)('a front vent over a control', async () => {
      await expect(build(ONE_U, { ...BASE, ...VENTS, frontVentXMm: 120, frontVentSlots: 1, frontVentRows: 1 }, zone)).rejects.toThrow(/a front vent slot .*overlaps a flat zone of a control/)
    }, 120_000)
    it.skipIf(!BLENDER)('a window over a control', async () => {
      await expect(build(ONE_U, { ...BASE, ...WINDOW, windowXMm: 90 }, zone)).rejects.toThrow(/the meter window .*overlaps a flat zone of a control/)
    }, 120_000)
    it.skipIf(!BLENDER)('an ear handle over a control', async () => {
      // the zone at the right-hand end of the front (face x 440 to 460 from the left, clear of the ear slot at 466 to 482): the handle there is refused; the other end is free
      await expect(build(ONE_U, { ...BASE, ...EAR_HANDLES }, [{ face: 'opposite', x0: 440, y0: 2, x1: 460, y1: 42 }])).rejects.toThrow(/an ear handle .*overlaps a flat zone of a control/)
    }, 120_000)
    it.skipIf(!BLENDER)('the same features beside the zone build', async () => {
      const r = await build(ONE_U, { ...BASE, ...VENTS, ...WINDOW, windowXMm: 40, windowWMm: 50, frontVentXMm: 300, frontVentSlots: 4, frontVentColPitchMm: 36, ...EAR_HANDLES }, zone)
      expect(r.measure.frontVents).toBe(8)
    }, 120_000)
  })

  it.skipIf(!BLENDER)('BuildError: a vent block off the plate, over an ear slot, over the window; a handle over an ear slot', async () => {
    await expect(build(ONE_U, { ...BASE, ...VENTS, frontVentXMm: 60 })).rejects.toThrow(/front vent block .*does not fit/)
    await expect(build(ONE_U, { ...BASE, ...VENTS, frontVentRows: 6, frontVentRowPitchMm: 9 })).rejects.toThrow(/front vent block .*does not fit/)
    await expect(build(ONE_U, { ...BASE, ...WINDOW, windowXMm: 20, windowWMm: 60, ...VENTS, frontVentXMm: 60, frontVentSlots: 2 })).rejects.toThrow(/(front vent|window).*overlap/)
    await expect(build(ONE_U, { ...BASE, ...WINDOW, windowXMm: 470 })).rejects.toThrow(/the meter window .*does not fit/)
    await expect(build(ONE_U, { ...BASE, ...EAR_HANDLES, earHandleFromEndMm: 8 })).rejects.toThrow(/an ear handle .*covers an ear slot/)
    await expect(build(ONE_U, { ...BASE, ...EAR_HANDLES, earHandleLenMm: 60 })).rejects.toThrow(/earHandleLenMm/)
    await expect(build(ONE_U, { ...BASE, ...VENTS, frontVentDepthMm: 6 })).rejects.toThrow(/frontVentDepthMm.*plate thickness/)
  }, 240_000)

  it.skipIf(!BLENDER)('a vent in the ear strip is refused when it would be a through hole into the open (the chassis is narrower than the plate)', async () => {
    await expect(build(ONE_U, { ...BASE, frontVentSlots: 1, frontVentRows: 1, frontVentSlotLenMm: 10, frontVentSlotWidthMm: 3, frontVentXMm: 10, frontVentYMm: 22 })).rejects.toThrow(/front vent block .*chassis/)
  }, 120_000)

  it.skipIf(!BLENDER)('two builds with all three features are byte-identical, and so are twelve builds of the vents alone (no triangulation that depends on memory addresses)', async () => {
    const params = { ...BASE, ...VENTS, ...WINDOW, ...EAR_HANDLES, frontVentXMm: 330, frontVentSlots: 6, frontVentColPitchMm: 18, frontVentSlotLenMm: 12, windowXMm: 30 }
    const a = await build(TWO_U, params)
    const b = await build(TWO_U, params)
    expect(a.sha256).toBe(b.sha256)
    const runs = await Promise.all(Array.from({ length: 12 }, () => build(ONE_U, { ...BASE, ...VENTS, ...WINDOW })))
    expect(new Set(runs.map((r) => r.sha256)).size).toBe(1)
  }, 300_000)

  it.skipIf(!BLENDER)('the old output is unchanged: five detailed rack boxes of the Wave 1 pins keep their geometry (the whole set, with the byte-pins, is in builderPins.test.ts)', async () => {
    const pins = JSON.parse(await readFile(new URL('./fixtures/builder-pins-wave2.json', import.meta.url), 'utf8')) as Record<string, { fingerprint: string; plan: { shape: string; params: Record<string, number> } }>
    const detailed = Object.entries(pins).filter(([, p]) => p.plan.shape === 'rack-box' && Object.keys(p.plan.params).length > 6).slice(0, 5)
    expect(detailed.length).toBe(5)
    for (const [id, p] of detailed) {
      const r = await buildPlanRaw(BLENDER as string, dir, `old-${id}`, p.plan)
      expect(await fingerprint(r.bytes), id).toBe(p.fingerprint)
    }
  }, 300_000)

  it.skipIf(!BLENDER)('a spec with v3b params builds through runBuilder (usable from an asset spec) and reports the counts', async () => {
    const spec = AssetSpec.parse(rackSpec('amp-from-spec', TWO_U, { ...BASE, ...VENTS, ...WINDOW, ...EAR_HANDLES, frontVentXMm: 330, frontVentSlots: 6, frontVentColPitchMm: 18, frontVentSlotLenMm: 12, windowXMm: 30 }))
    const out = join(dir, 'from-spec.glb')
    const measure = await runBuilder(spec, out)
    expect(measure.frontVents).toBe(12)
    expect(measure.windows).toBe(1)
    expect(measure.earHandles).toBe(2)
  }, 120_000)
})
