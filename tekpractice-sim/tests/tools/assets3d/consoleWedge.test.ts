/**
 * Tests for console-wedge v2 (Wave 3): the optional params and their checks (no Blender needed), the regression that the plain wedge stays
 * byte-identical when no v2 param is given (the two consoles as they were built before v2: Yamaha QL1 and Axia iQ), and the geometry of the
 * fillets, the cheeks over the base, the feet, the arm rest, the option-slot plates and the front recess through the real Blender builder
 * (skipped when Blender is not installed, like builder.test.ts).
 */
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findBlender } from '../../../tools/assets3d/env'
import { inspectGlb } from '../../../tools/assets3d/inspect'
import { loadSpecs } from '../../../tools/assets3d/loadSpecs'
import { BUILD_SCRIPT, runBuilder } from '../../../tools/assets3d/runBuilder'
import { CONSOLE_V2_PARAMS, SHAPE_SPECS, validateBuild } from '../../../tools/assets3d/shapes'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'

const BLENDER = findBlender()
const MM = 0.001

type Profile = [number, number][]

/** The side profiles and chamfers the two consoles were built with BEFORE console-wedge v2 (copied from their specs of 2026-11-10; the specs themselves are now v2). */
const QL1_OLD_PROFILE: Profile = [[0, 272], [6, 272], [20, 266], [40, 257], [80, 231], [120, 205], [161, 178], [201, 152], [241, 140], [281, 132], [321, 126], [361, 121], [401, 112], [442, 110], [482, 104], [522, 98], [562, 95]]
const AXIA_OLD_PROFILE: Profile = [[0, 111.2], [45, 111.2], [70, 82], [300, 74], [430, 66], [482.9, 56]]

/** sha256 of the RAW builder output (no picture) of the two plain wedges, taken before v2 existed (2026-11-10, Blender 5). */
const OLD_WEDGES: { id: string; size: { w: number; h: number; d: number }; profile: Profile; chamferMm: number; sha256: string }[] = [
  { id: 'yamaha-ql1', size: { w: 468, h: 272, d: 562 }, profile: QL1_OLD_PROFILE, chamferMm: 1.5, sha256: '8d388f649d3bc3fd7ecf738e43c6738496393bbafea003e622a6bef21880ab87' },
  { id: 'axia-iq', size: { w: 519.3, h: 111.2, d: 482.9 }, profile: AXIA_OLD_PROFILE, chamferMm: 2, sha256: '20cbdc9945c523c856b734d55aa887bdcf145109de7c96cdd4c19109b1669297' },
]

/** A console spec of the given size and profile (ports and controls are replaced: the builder only reads them through plan.ports and plan.flatZones). */
function wedgeSpec(id: string, size: { w: number; h: number; d: number }, profile: Profile, params: Record<string, number>, over: Partial<AssetSpecT> = {}): AssetSpecT {
  const base = loadSpecs().find((s) => s.id === 'yamaha-ql1') as AssetSpecT
  return { ...base, id, realSizeMm: size, ports: [], controls: [], texture: undefined, build: { shape: 'console-wedge', profile, params }, ...over }
}

const QL1 = { w: 468, h: 272, d: 562 }
const AXIA = { w: 519.3, h: 111.2, d: 482.9 }

/** The params the shipped QL1 is built with (kept in step with its spec by a test of consoleWedgeSpecs.test.ts). */
const QL1_V2: Record<string, number> = { filletMm: 3.5, filletSegments: 5, armRestMm: 14, cheekMm: 5, baseMm: 30, feetMm: 12.7, feetWidthMm: 21.6, feetFromSideMm: 41.8, feetFromEndMm: 28, slotPlates: 2, slotPlateWMm: 121, slotPlateHMm: 40, slotPlateXMm: 193.6, slotPlateYMm: 15.7, slotPlatePitchMm: 127, slotPlateDepthMm: 1.2, frontRecessWMm: 100.6, frontRecessHMm: 22, frontRecessXMm: 335.6, frontRecessYMm: 18, frontRecessDepthMm: 2 }

describe('console-wedge params (no Blender)', () => {
  it('lists the v2 params next to chamferMm and asks for the control zones and the ports', () => {
    expect(SHAPE_SPECS['console-wedge'].params).toEqual(['chamferMm', ...CONSOLE_V2_PARAMS])
    for (const n of ['filletMm', 'cheekMm', 'feetMm', 'armRestMm', 'slotPlates']) expect(CONSOLE_V2_PARAMS).toContain(n)
    expect(SHAPE_SPECS['console-wedge'].usesFlatZones).toBe(true)
    expect(SHAPE_SPECS['console-wedge'].usesPorts).toBe(true)
  })

  it('accepts each v2 param and rejects an unknown one', () => {
    const ok = (params: Record<string, number>): string[] => validateBuild(wedgeSpec('x', QL1, QL1_OLD_PROFILE, params))
    expect(ok({ chamferMm: 1.5 })).toEqual([])
    expect(ok({ filletMm: 5, filletSegments: 4 })).toEqual([])
    expect(ok({ filletMm: 5, armRestMm: 12 })).toEqual([])
    expect(validateBuild(wedgeSpec('x', { w: 519.3, h: 111.2, d: 482.9 }, AXIA_OLD_PROFILE, { tierYMm: 74, tierWMm: 372, tierXMm: 2 }))).toEqual([])
    expect(ok({ cheekMm: 5, baseMm: 30, feetMm: 8 })).toEqual([])
    expect(ok({ feetMm: 8, feetWidthMm: 22, feetFromSideMm: 30, feetFromEndMm: 40 })).toEqual([])
    expect(ok({ slotPlates: 2, slotPlateWMm: 120, slotPlateHMm: 42, slotPlateXMm: 193, slotPlateYMm: 14, slotPlatePitchMm: 127.6, slotPlateDepthMm: 1.2 })).toEqual([])
    expect(ok({ frontRecessWMm: 100, frontRecessHMm: 28, frontRecessXMm: 300, frontRecessYMm: 10, frontRecessDepthMm: 2 })).toEqual([])
    expect(ok({ nonsenseMm: 3 })[0]).toMatch(/no param 'nonsenseMm'/)
  })

  it('refuses params that cannot work together or do not fit', () => {
    const bad = (params: Record<string, number>): string => validateBuild(wedgeSpec('x', QL1, QL1_OLD_PROFILE, params))[0] ?? ''
    expect(bad({ filletSegments: 4 })).toMatch(/filletSegments.*filletMm/)
    expect(bad({ filletMm: 5, filletSegments: 2.5 })).toMatch(/filletSegments/)
    expect(bad({ filletMm: 5, filletSegments: 40 })).toMatch(/filletSegments/)
    expect(bad({ filletMm: 150 })).toMatch(/filletMm.*smaller/)
    expect(bad({ filletMm: 8, armRestMm: 10 })).toMatch(/armRestMm.*at least 1.6 times filletMm/)
    expect(bad({ tierYMm: 100 })).toMatch(/tierYMm and tierWMm go together/)
    expect(bad({ tierYMm: 100, tierWMm: 500 })).toMatch(/tierWMm|tierYMm/)
    expect(bad({ armRestMm: 12 })).toMatch(/armRestMm.*filletMm/)
    expect(bad({ cheekMm: 5 })).toMatch(/cheekMm.*baseMm/)
    expect(bad({ cheekMm: 200, baseMm: 30 })).toMatch(/cheekMm/)
    expect(bad({ baseMm: 300, cheekMm: 5 })).toMatch(/baseMm/)
    expect(bad({ feetWidthMm: 20 })).toMatch(/feetWidthMm.*feetMm/)
    expect(bad({ slotPlates: 2.5, slotPlateWMm: 100, slotPlateHMm: 30, slotPlateXMm: 10, slotPlateYMm: 10 })).toMatch(/slotPlates/)
    expect(bad({ slotPlates: 2, slotPlateWMm: 100 })).toMatch(/slotPlateHMm|slotPlateXMm|slotPlateYMm/)
    expect(bad({ slotPlates: 2, slotPlateWMm: 100, slotPlateHMm: 30, slotPlateXMm: 10, slotPlateYMm: 10 })).toMatch(/slotPlatePitchMm/)
    expect(bad({ frontRecessWMm: 100 })).toMatch(/frontRecess/)
  })
})

describe(`console-wedge v2 with real Blender (${BLENDER ? `using ${BLENDER}` : 'SKIPPED, Blender not found: install Blender or set BLENDER_EXE'})`, () => {
  let dir = ''
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tekpractice-console-'))
  })
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  let count = 0
  /** Builds `spec` raw and returns its bytes, triangle count, vertices (metres, glTF space) and what the builder measured. */
  async function build(spec: AssetSpecT): Promise<{ bytes: Uint8Array; tris: number; verts: [number, number, number][]; measure: Awaited<ReturnType<typeof runBuilder>> }> {
    const out = join(dir, `b${count++}.glb`)
    const measure = await runBuilder(spec, out)
    const bytes = new Uint8Array(await readFile(out))
    const doc = await new NodeIO().readBinary(bytes)
    const verts: [number, number, number][] = []
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh()
      if (!mesh) continue
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')
        if (!pos) continue
        for (let i = 0; i < pos.getCount(); i++) verts.push(pos.getElement(i, [0, 0, 0]) as [number, number, number])
      }
    }
    return { bytes, tris: (await inspectGlb(bytes)).triangles, verts, measure }
  }

  it.skipIf(!BLENDER).each(OLD_WEDGES)('regression: $id built with the new code and no v2 param is byte-identical to the old plain wedge', async ({ id, size, profile, chamferMm, sha256 }) => {
    const { bytes } = await build(wedgeSpec(id, size, profile, { chamferMm }))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256)
  }, 120_000)

  const bbox = (verts: [number, number, number][]): { w: number; h: number; d: number } => ({
    w: (Math.max(...verts.map((v) => v[0])) - Math.min(...verts.map((v) => v[0]))) / MM,
    h: (Math.max(...verts.map((v) => v[1])) - Math.min(...verts.map((v) => v[1]))) / MM,
    d: (Math.max(...verts.map((v) => v[2])) - Math.min(...verts.map((v) => v[2]))) / MM,
  })

  it.skipIf(!BLENDER)('size gate exact: the detailed QL1 is 468 x 272 x 562 mm and the detailed Axia 519.3 x 111.2 x 482.9 mm to 0.01 mm, with every v2 feature on', async () => {
    const ql1 = bbox((await build(wedgeSpec('ql1-v2', QL1, QL1_OLD_PROFILE, QL1_V2))).verts)
    expect(ql1.w).toBeCloseTo(468, 2)
    expect(ql1.h).toBeCloseTo(272, 2)
    expect(ql1.d).toBeCloseTo(562, 2)
    const axia = bbox((await build(wedgeSpec('axia-v2', AXIA, AXIA_OLD_PROFILE, { filletMm: 5, filletSegments: 5, armRestMm: 26, tierYMm: 82, tierWMm: 380, feetMm: 6 }))).verts)
    expect(axia.w).toBeCloseTo(519.3, 2)
    expect(axia.h).toBeCloseTo(111.2, 2)
    expect(axia.d).toBeCloseTo(482.9, 2)
  }, 180_000)

  it.skipIf(!BLENDER)('fillet: the rim of the side caps is rounded (no vertex left in the cap corner) and the builder measures the radius it built', async () => {
    const plain = await build(wedgeSpec('w-nofillet', QL1, QL1_OLD_PROFILE, { feetMm: 5 }))
    const rounded = await build(wedgeSpec('w-fillet', QL1, QL1_OLD_PROFILE, { filletMm: 3.5, filletSegments: 5, feetMm: 5 }))
    const corner = (verts: [number, number, number][]): number => verts.filter((v) => Math.abs(v[0]) > 233.99 * MM && v[1] > 271.99 * MM).length
    expect(corner(plain.verts)).toBeGreaterThan(0)
    expect(corner(rounded.verts)).toBe(0)
    expect(rounded.measure.filletMm).toBeGreaterThanOrEqual(3.5 * 0.9)
    expect(rounded.measure.filletMm).toBeLessThanOrEqual(3.5 * 1.001)
    expect(plain.measure.filletMm).toBeUndefined()
    expect(rounded.tris).toBeGreaterThan(plain.tris + 200)
  }, 180_000)

  it.skipIf(!BLENDER)('cheeks: the side plates keep the full width above the base, the base is cheekMm narrower and set back at the front, the rear stays flush', async () => {
    const { verts } = await build(wedgeSpec('w-cheek', QL1, QL1_OLD_PROFILE, { cheekMm: 5, baseMm: 30, feetMm: 10, filletMm: 3.5 }))
    const base = verts.filter((v) => v[1] > 9.99 * MM && v[1] < 39.99 * MM) // the core's underside: nothing else lies between the underside and the plates
    expect(base.length).toBeGreaterThan(10)
    expect(Math.max(...base.map((v) => Math.abs(v[0]))) / MM).toBeCloseTo(229, 3)
    expect(Math.min(...base.map((v) => v[2])) / MM).toBeCloseTo(-281 + 5, 3)
    expect(Math.max(...base.map((v) => v[2])) / MM).toBeCloseTo(281, 3)
    const shell = verts.filter((v) => v[1] > 39.99 * MM)
    expect(Math.max(...shell.map((v) => Math.abs(v[0]))) / MM).toBeCloseTo(234, 3)
    expect(Math.min(...shell.map((v) => v[2])) / MM).toBeCloseTo(-281, 3)
  }, 180_000)

  it.skipIf(!BLENDER)('feet: four round rubber feet reach the table, the body starts at their height', async () => {
    const { verts } = await build(wedgeSpec('w-feet', QL1, QL1_OLD_PROFILE, { feetMm: 12.7, feetWidthMm: 21.6, feetFromSideMm: 41.8, feetFromEndMm: 28 }))
    expect(Math.min(...verts.map((v) => v[1]))).toBeCloseTo(0, 7)
    const low = verts.filter((v) => v[1] < 1e-7)
    expect(low.length).toBeGreaterThanOrEqual(4 * 14)
    expect(new Set(low.map((v) => `${Math.sign(v[0])}${Math.sign(v[2])}`)).size).toBe(4)
    // centres 41.8 mm from the sides, 28 mm from the ends; the foot at the table is 0.72 of its top diameter, less the rounded edge
    const lowRadius = 0.72 * 10.8 - 1
    expect(Math.max(...low.map((v) => v[0])) / MM).toBeCloseTo(234 - 41.8 + lowRadius, 1)
    expect(Math.max(...low.map((v) => v[2])) / MM).toBeCloseTo(281 - 28 + lowRadius, 0) // 14 segments: the farthest vertex is 0.17 mm short of the radius
    // between the feet and the body (0 < y < 12.7 mm) there is only the feet
    const between = verts.filter((v) => v[1] > 0.1 * MM && v[1] < 12.69 * MM)
    expect(between.every((v) => Math.hypot(Math.abs(v[0]) - (234 - 41.8) * MM, Math.abs(v[2]) - (281 - 28) * MM) < 11 * MM)).toBe(true)
  }, 180_000)

  it.skipIf(!BLENDER)('arm rest: the front-top edge is a roll (the front face ends well below the top edge)', async () => {
    const plain = await build(wedgeSpec('w-arm0', QL1, QL1_OLD_PROFILE, { filletMm: 3.5 }))
    const roll = await build(wedgeSpec('w-arm1', QL1, QL1_OLD_PROFILE, { filletMm: 3.5, armRestMm: 14 }))
    const frontTop = (verts: [number, number, number][]): number => Math.max(...verts.filter((v) => Math.abs(v[2] + 281 * MM) < 1e-7).map((v) => v[1])) / MM
    expect(frontTop(plain.verts)).toBeGreaterThan(88) // the 5.6 mm corner of the outline
    expect(frontTop(roll.verts)).toBeLessThan(84)
    expect(frontTop(roll.verts)).toBeGreaterThan(72)
  }, 180_000)

  it.skipIf(!BLENDER)('slot plates: two 121 x 40 mm recesses 1.2 mm deep in the io face, the floors behind the rear plane', async () => {
    const { verts } = await build(wedgeSpec('w-slots', QL1, QL1_OLD_PROFILE, { slotPlates: 2, slotPlateWMm: 121, slotPlateHMm: 40, slotPlateXMm: 193.6, slotPlateYMm: 15.7, slotPlatePitchMm: 127, slotPlateDepthMm: 1.2, feetMm: 8 }))
    const floor = verts.filter((v) => Math.abs(v[2] - (281 - 1.2) * MM) < 1e-7)
    expect(floor.length).toBeGreaterThanOrEqual(8)
    expect(Math.min(...floor.map((v) => v[0])) / MM).toBeCloseTo(193.6 - 234, 3)
    expect(Math.max(...floor.map((v) => v[0])) / MM).toBeCloseTo(193.6 + 127 + 121 - 234, 3)
    expect(Math.min(...floor.map((v) => v[1])) / MM).toBeCloseTo(15.7, 3)
    expect(Math.max(...floor.map((v) => v[1])) / MM).toBeCloseTo(55.7, 3)
    expect(new Set(floor.map((v) => Math.round(v[0] / MM))).size).toBe(4) // two plates: four distinct x edges
  }, 180_000)

  it.skipIf(!BLENDER)('front recess: a panel cut into the set-back front face; seen from the front it lies at the right', async () => {
    const { verts } = await build(wedgeSpec('w-front', QL1, QL1_OLD_PROFILE, { cheekMm: 5, baseMm: 30, feetMm: 12.7, frontRecessWMm: 100.6, frontRecessHMm: 22, frontRecessXMm: 335.6, frontRecessYMm: 18, frontRecessDepthMm: 2 }))
    const floor = verts.filter((v) => Math.abs(v[2] - (-281 + 5 + 2) * MM) < 1e-7)
    expect(floor.length).toBeGreaterThanOrEqual(4)
    // u from the left as seen from the front: gx = w/2 - u, so u = 335.6 .. 436.2 is x = -202.2 .. -101.6 in glTF
    expect(Math.min(...floor.map((v) => v[0])) / MM).toBeCloseTo(234 - 436.2, 3)
    expect(Math.max(...floor.map((v) => v[0])) / MM).toBeCloseTo(234 - 335.6, 3)
    expect(Math.min(...floor.map((v) => v[1])) / MM).toBeCloseTo(18, 3)
    expect(Math.max(...floor.map((v) => v[1])) / MM).toBeCloseTo(40, 3)
  }, 180_000)

  it.skipIf(!BLENDER)('tier: everything above tierYMm is only tierWMm wide (a meter bridge), the deck keeps the full width', async () => {
    const { verts } = await build(wedgeSpec('w-tier', AXIA, AXIA_OLD_PROFILE, { tierYMm: 82, tierWMm: 380, filletMm: 4 }))
    const above = verts.filter((v) => v[1] > 82.01 * MM)
    expect(above.length).toBeGreaterThan(8)
    expect(Math.max(...above.map((v) => Math.abs(v[0]))) / MM).toBeCloseTo(190, 3)
    const deck = verts.filter((v) => v[1] <= 82.01 * MM)
    expect(Math.max(...deck.map((v) => Math.abs(v[0]))) / MM).toBeCloseTo(259.65, 3)
    expect(Math.max(...verts.map((v) => v[1])) / MM).toBeCloseTo(111.2, 3)
  }, 180_000)

  it.skipIf(!BLENDER)('determinism: two builds of the detailed QL1 are byte-identical', async () => {
    const a = await build(wedgeSpec('w-det', QL1, QL1_OLD_PROFILE, QL1_V2))
    const b = await build(wedgeSpec('w-det', QL1, QL1_OLD_PROFILE, QL1_V2))
    expect(createHash('sha256').update(a.bytes).digest('hex')).toBe(createHash('sha256').update(b.bytes).digest('hex'))
  }, 180_000)

  it.skipIf(!BLENDER)('rear recess: a port in it needs insetMm = its depth; a port cut through by it, or an inset port outside every recess, is refused', async () => {
    const port = (portId: string, xMm: number, yMm: number, insetMm?: number): AssetSpecT['ports'][number] => ({ portId, face: 'io', xMm, yMm, confidence: 'guess', openingMm: 24, ...(insetMm !== undefined ? { insetMm } : {}) })
    const params = { rearRecessWMm: 60, rearRecessHMm: 34, rearRecessXMm: 38, rearRecessYMm: 9, rearRecessDepthMm: 2.5, feetMm: 6 }
    const withPorts = (ports: AssetSpecT['ports']): AssetSpecT => wedgeSpec('w-rear', AXIA, AXIA_OLD_PROFILE, params, { ports })
    const built = await build(withPorts([port('a', 68, 26, 2.5), port('c', 300, 70)]))
    expect(built.verts.some((v) => Math.abs(v[2] - (241.45 - 2.5) * MM) < 1e-7)).toBe(true)
    await expect(runBuilder(withPorts([port('a', 68, 26, 1)]), join(dir, 'x1.glb'))).rejects.toThrow(/port 'a' lies in the rear recess.*insetMm must be 2.50/)
    await expect(runBuilder(withPorts([port('a', 100, 26, 2.5)]), join(dir, 'x2.glb'))).rejects.toThrow(/cuts through the connector of port 'a'/)
    await expect(runBuilder(withPorts([port('a', 68, 26, 2.5), port('z', 400, 40, 2.5)]), join(dir, 'x3.glb'))).rejects.toThrow(/port 'z' has an insetMm but lies in no recess/)
  }, 240_000)

  describe('flat zones', () => {
    let n = 0
    /** Runs the builder script on a plan (zones given directly): resolves with stderr, or 'built'. */
    async function planFails(params: Record<string, number>, flatZones: unknown[], size = QL1, profile: Profile = QL1_OLD_PROFILE): Promise<string> {
      const plan = { id: 'zone-test', kind: 'device', shape: 'console-wedge', sizeMm: size, params, profile, flatZones }
      const planPath = join(dir, `plan-${n++}.json`)
      await writeFile(planPath, JSON.stringify(plan))
      return new Promise((resolve) => {
        execFile(BLENDER as string, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', BUILD_SCRIPT, '--', '--plan', planPath, '--out', join(dir, 'never.glb')], (err, _out, stderr) => resolve(err ? stderr : 'built'))
      })
    }

    it.skipIf(!BLENDER)('a control on the top face is refused where the fillet, the arm-rest roll or the rear rounding reach it, and accepted on the plain surface', async () => {
      const params = { filletMm: 3.5, armRestMm: 14 }
      expect(await planFails(params, [{ face: 'top', x0: 100, y0: 100, x1: 300, y1: 400 }])).toBe('built')
      expect(await planFails(params, [{ face: 'top', x0: 100, y0: 540, x1: 300, y1: 560 }])).toMatch(/BUILD_FAIL modelled detail reaches a flat zone of a control .*on the top face/)
      expect(await planFails(params, [{ face: 'top', x0: 1, y0: 100, x1: 5, y1: 400 }])).toMatch(/BUILD_FAIL modelled detail reaches a flat zone/)
      expect(await planFails(params, [{ face: 'top', x0: 100, y0: 0.5, x1: 300, y1: 3 }])).toMatch(/BUILD_FAIL modelled detail reaches a flat zone/)
    }, 240_000)

    it.skipIf(!BLENDER)('the io zone: a slot plate over it is refused, a zone beside it builds; a tier that does not carry a top control is refused', async () => {
      const slots = { slotPlates: 1, slotPlateWMm: 121, slotPlateHMm: 40, slotPlateXMm: 193.6, slotPlateYMm: 15.7 }
      expect(await planFails(slots, [{ face: 'io', x0: 200, y0: 20, x1: 230, y1: 50 }])).toMatch(/BUILD_FAIL a slot plate .*overlaps a flat zone of a control/)
      expect(await planFails(slots, [{ face: 'io', x0: 100, y0: 60, x1: 140, y1: 100 }])).toBe('built')
      // the narrower tier: a control on the bridge top outside its width has no surface under it
      const tier = { tierYMm: 82, tierWMm: 200 }
      expect(await planFails(tier, [{ face: 'top', x0: 190, y0: 10, x1: 330, y1: 30 }], AXIA, AXIA_OLD_PROFILE)).toBe('built')
      expect(await planFails(tier, [{ face: 'top', x0: 10, y0: 10, x1: 50, y1: 30 }], AXIA, AXIA_OLD_PROFILE)).toMatch(/BUILD_FAIL modelled detail reaches a flat zone|BUILD_FAIL a flat zone of a control .*has no surface/)
    }, 240_000)

    it.skipIf(!BLENDER)('runBuilder passes the control layout of the device: the QL1 layout leaves every v2 detail alone; on the Axia a bridge corner rounder than 12 mm reaches the meters and is refused', async () => {
      const ql1 = loadSpecs().find((s) => s.id === 'yamaha-ql1') as AssetSpecT
      await expect(runBuilder({ ...ql1, build: { shape: 'console-wedge', profile: QL1_OLD_PROFILE, params: QL1_V2 } }, join(dir, 'ql1-layout.glb'))).resolves.toBeTruthy()
      const axia = loadSpecs().find((s) => s.id === 'axia-iq') as AssetSpecT
      const tiered = (params: Record<string, number>): AssetSpecT => ({ ...axia, ports: [], build: { shape: 'console-wedge', profile: AXIA_OLD_PROFILE, params: { tierYMm: 82, tierWMm: 380, ...params } } })
      await expect(runBuilder(tiered({ filletMm: 5, armRestMm: 26 }), join(dir, 'axia-ok.glb'))).resolves.toBeTruthy()
      // the meters start 12.5 mm from the rear edge of the bridge: a 10 mm fillet makes the rear-top corner 16 mm round
      await expect(runBuilder(tiered({ filletMm: 10, armRestMm: 26 }), join(dir, 'axia-round.glb'))).rejects.toThrow(/flat zone of a control/)
    }, 240_000)
  })
})
