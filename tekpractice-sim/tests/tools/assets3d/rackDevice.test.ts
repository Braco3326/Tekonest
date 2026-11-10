/**
 * Tests for the detailed rack-box (Wave 2): the params and their checks (no Blender needed), the regression that the nine
 * plain rack boxes stay byte-identical when the new params are absent, and the geometry of ears, plate, handles, vents, feet
 * and fillets through the real Blender builder (skipped when Blender is not installed, like builder.test.ts).
 */
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findBlender } from '../../../tools/assets3d/env'
import { inspectGlb } from '../../../tools/assets3d/inspect'
import { loadSpecs } from '../../../tools/assets3d/loadSpecs'
import { runBuilder } from '../../../tools/assets3d/runBuilder'
import { RACK_V2_PARAMS, SHAPE_SPECS, validateBuild } from '../../../tools/assets3d/shapes'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'

const BLENDER = findBlender()
const MM = 0.001

/** sha256 of the RAW builder output (no picture) of the nine plain rack boxes, taken before the detailed shape existed (2026-11-10, Blender 5). Size and chamfer are all the old shape used. */
const OLD_RACK_BOXES: { id: string; size: { w: number; h: number; d: number }; chamferMm: number; sha256: string }[] = [
  { id: 'aeta-scoop5-s', size: { w: 480, h: 44, d: 252 }, chamferMm: 1, sha256: 'ff0f08c5ef4abd88c14ead18659aa59ea1c1359dd0e2a2babb61cc7d5dfcdc51' },
  { id: 'aeta-scoopy-plus-s', size: { w: 155, h: 80, d: 234 }, chamferMm: 4, sha256: '0a20043ab6af95122c0e29dd15a04d36f15351552771ef0ad23e9631eb442edd' },
  { id: 'antelope-ocx-hd', size: { w: 482.6, h: 44, d: 230 }, chamferMm: 1, sha256: '1f3606c4453e4d016d38556bebc1ed29997a829a55415628d0f26ef29d9ec2f5' },
  { id: 'avid-hd-io', size: { w: 482.6, h: 88.9, d: 355.6 }, chamferMm: 1, sha256: 'a01509514a87c81afbe58438aaec9d59521de98699d84145907a2d9d89e061b5' },
  { id: 'avid-protools-hdx', size: { w: 169, h: 386, d: 445 }, chamferMm: 3, sha256: '0964d0fc016825eeb629a19b245ea72c9b1a47846c88e54f656cc6e2728b3ab2' },
  { id: 'focusrite-isa-one', size: { w: 220, h: 104, d: 290 }, chamferMm: 1.5, sha256: '06519d23b9f600287e040542a84b79f863d3522c25608fbffb5a528f09427b0a' },
  { id: 'grace-m905', size: { w: 482.6, h: 88.9, d: 266.7 }, chamferMm: 1, sha256: 'c3b234f4532b0f2b13882cbc3ed5dbdcc4f588748c02549e5cd62b46636acc24' },
  { id: 'playout-pc', size: { w: 290, h: 92.6, d: 292.8 }, chamferMm: 2, sha256: '03933acd2cc02c823625f47dee4191268da378a495c045195e5b8b713e3e41d9' },
  { id: 'switchcraft-studiopatch-9625', size: { w: 482.6, h: 44.45, d: 140 }, chamferMm: 1, sha256: 'f625f9282fb32956478957cf30191485b5a57a32c2b8240b3c1f905c8e830ad5' },
]

/** A device spec of the given size with the rack-box shape (the catalog parity is not needed by the builder). */
function rackSpec(id: string, size: { w: number; h: number; d: number }, params: Record<string, number>, over: Partial<AssetSpecT> = {}): AssetSpecT {
  const base = loadSpecs().find((s) => s.id === 'avid-hd-io') as AssetSpecT
  return { ...base, id, realSizeMm: size, ports: [], controls: [], texture: undefined, build: { shape: 'rack-box', params }, ...over }
}

const ONE_U = { w: 482.6, h: 44.45, d: 300 }

describe('rack-box params (no Blender)', () => {
  it('lists the detailed params next to chamferMm', () => {
    expect(SHAPE_SPECS['rack-box'].params).toEqual(['chamferMm', ...RACK_V2_PARAMS])
    for (const n of ['earWidthMm', 'earThicknessMm', 'earHoleMm', 'handleCount', 'handleProjectionMm', 'plateInsetMm', 'filletMm', 'ventSlots', 'ventDepthMm', 'feetMm', 'bodyWidthMm', 'rearInsetMm']) {
      expect(RACK_V2_PARAMS).toContain(n)
    }
    expect(SHAPE_SPECS['rack-box'].usesFlatZones).toBe(true)
  })

  it('accepts a spec with each new param and rejects an unknown one', () => {
    const base = { chamferMm: 1 }
    const good: Record<string, number> = { earWidthMm: 22.3, earThicknessMm: 3, earHoleMm: 6.35, handleCount: 2, handleProjectionMm: 20, plateInsetMm: 1.5, filletMm: 2, ventSlots: 6, ventDepthMm: 2, feetMm: 4, bodyWidthMm: 438, rearInsetMm: 2 }
    for (const [name, value] of Object.entries(good)) {
      if (name === 'earWidthMm' || name === 'bodyWidthMm') continue // the two must agree: tested below
      const extra: Record<string, number> = name === 'handleCount' ? { handleCount: 2, handleProjectionMm: 20 } : name === 'handleProjectionMm' ? { handleCount: 2, handleProjectionMm: 20 } : name === 'ventDepthMm' ? { ventSlots: 6, ventDepthMm: 2 } : { [name]: value }
      expect(validateBuild(rackSpec('x', ONE_U, { ...base, ...extra })), name).toEqual([])
    }
    expect(validateBuild(rackSpec('x', ONE_U, { earWidthMm: 22.3 }))).toEqual([])
    expect(validateBuild(rackSpec('x', ONE_U, { bodyWidthMm: 438 }))).toEqual([])
    expect(validateBuild(rackSpec('x', ONE_U, { bodyWidthMm: 438, earWidthMm: 22.3 }))).toEqual([])
    expect(validateBuild(rackSpec('x', ONE_U, { nonsenseMm: 3 }))[0]).toMatch(/no param 'nonsenseMm'/)
  })

  it('refuses ears that disagree with the chassis width, a chassis wider than the unit, and counts that are not whole', () => {
    expect(validateBuild(rackSpec('x', ONE_U, { earWidthMm: 20, bodyWidthMm: 438 }))[0]).toMatch(/earWidthMm.*bodyWidthMm.*disagree/)
    expect(validateBuild(rackSpec('x', ONE_U, { bodyWidthMm: 500 }))[0]).toMatch(/bodyWidthMm/)
    expect(validateBuild(rackSpec('x', ONE_U, { handleCount: 3, handleProjectionMm: 20 }))[0]).toMatch(/handleCount/)
    expect(validateBuild(rackSpec('x', ONE_U, { ventSlots: 2.5 }))[0]).toMatch(/ventSlots/)
    expect(validateBuild(rackSpec('x', ONE_U, { ventColumns: 2 }))[0]).toMatch(/ventColumns.*ventSlots/)
    expect(validateBuild(rackSpec('x', ONE_U, { handleCount: 2 }))[0]).toMatch(/handleProjectionMm/)
    expect(validateBuild(rackSpec('x', ONE_U, { plateInsetMm: 20 }))[0]).toMatch(/plateInsetMm/)
  })

  it('refuses handles on a unit that has a port or control on its front face (the plate moves back, the port would float)', () => {
    const withPort = rackSpec('x', ONE_U, { handleCount: 2, handleProjectionMm: 20 }, { ports: [{ portId: 'p', face: 'opposite', xMm: 10, yMm: 10, confidence: 'photo' }] })
    expect(validateBuild(withPort)[0]).toMatch(/handles move the front plate back.*opposite/)
    const frontIo = rackSpec('x', ONE_U, { handleCount: 2, handleProjectionMm: 20, frontOnIo: 1 }, { ports: [{ portId: 'p', face: 'opposite', xMm: 10, yMm: 10, confidence: 'photo' }] })
    expect(validateBuild(frontIo)).toEqual([]) // the front is the io face now: the opposite face (the rear) may carry ports
  })
})

describe(`rack-box v2 with real Blender (${BLENDER ? `using ${BLENDER}` : 'SKIPPED, Blender not found: install Blender or set BLENDER_EXE'})`, () => {
  let dir = ''
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tekpractice-rack-'))
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

  it.skipIf(!BLENDER).each(OLD_RACK_BOXES)('regression: $id built with the new code and no new params is byte-identical to the old plain box', async ({ id, size, chamferMm, sha256 }) => {
    const { bytes, tris } = await build(rackSpec(id, size, { chamferMm }))
    expect(tris).toBe(44)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256)
  }, 120_000)

  it.skipIf(!BLENDER)('ears: a 438 mm chassis behind a 482.6 mm plate, plate edges at 241.3 mm, 2 slotted holes per ear through the plate, EIA hole spacing 465.1 mm', async () => {
    const spec = rackSpec('rack-ears', ONE_U, { bodyWidthMm: 438, earThicknessMm: 3, earHoleMm: 6.35 })
    const { verts, measure } = await build(spec)
    const xMax = Math.max(...verts.map((v) => v[0]))
    expect(xMax / MM).toBeCloseTo(241.3, 3)
    // the chassis: everything behind the plate (z > -150 + 3 mm) is at most 219 mm from the centre
    const behind = verts.filter((v) => v[2] > (-150 + 3.5) * MM)
    expect(Math.max(...behind.map((v) => Math.abs(v[0]))) / MM).toBeCloseTo(219, 3)
    // slots: vertices at the plate's front plane inside an ear that are not on the plate outline -> the slot mouths
    const front = verts.filter((v) => Math.abs(v[2] + 150 * MM) < 1e-7 && Math.abs(v[0]) > 220.5 * MM && Math.abs(v[0]) < 240.5 * MM && v[1] > 3 * MM && v[1] < 41 * MM)
    const inEar = (sx: number, lo: number, hi: number): number => front.filter((v) => Math.sign(v[0]) === sx && v[1] > lo * MM && v[1] < hi * MM).length
    for (const sx of [-1, 1]) {
      expect(inEar(sx, 0, 22), `slot in the lower half of the ${sx < 0 ? 'left' : 'right'} ear`).toBeGreaterThanOrEqual(20)
      expect(inEar(sx, 22, 45), `slot in the upper half of the ${sx < 0 ? 'left' : 'right'} ear`).toBeGreaterThanOrEqual(20)
    }
    // hole centres 465.1 mm apart (slot mouths span 15.875 mm around 232.55)
    const xs = front.filter((v) => v[0] > 0 && v[1] < 22 * MM).map((v) => v[0] / MM)
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(232.55, 1)
    expect(measure.earHoles).toBe(4)
  }, 120_000)

  it.skipIf(!BLENDER)('a slot is a through hole when the chassis is narrower than the plate (back of the ear reached) and a recess when it is not', async () => {
    const through = await build(rackSpec('rack-through', ONE_U, { bodyWidthMm: 438, earThicknessMm: 3, earHoleMm: 6.35 }))
    const recess = await build(rackSpec('rack-recess', ONE_U, { earThicknessMm: 4, earHoleMm: 6.35 }))
    const backOf = (verts: [number, number, number][], z: number): number => verts.filter((v) => Math.abs(v[2] - z * MM) < 1e-7 && Math.abs(v[0]) > 225 * MM && Math.abs(v[0]) < 240 * MM && v[1] > 5 * MM && v[1] < 8 * MM).length
    expect(backOf(through.verts, -150 + 3)).toBeGreaterThan(0)   // the slot reaches the plate's back plane (-147 mm)
    expect(backOf(recess.verts, -150 + 4)).toBe(0)               // 3 mm deep only
    expect(backOf(recess.verts, -150 + 3)).toBeGreaterThan(0)
  }, 120_000)

  it.skipIf(!BLENDER)('a diagonal hole pattern has one slot per ear (top on the left, bottom on the right as seen from the front)', async () => {
    const { measure, verts } = await build(rackSpec('rack-diag', ONE_U, { bodyWidthMm: 440, earHoleMm: 5, earDiagonal: 1, earHoleEdgeMm: 10.4 }))
    expect(measure.earHoles).toBe(2)
    const mouth = verts.filter((v) => Math.abs(v[2] + 150 * MM) < 1e-7 && Math.abs(v[0]) > 222 * MM && Math.abs(v[0]) < 240 * MM && v[1] > 2 * MM && v[1] < 42 * MM)
    // front at -z: seen from the front the left ear is at +x
    expect(Math.max(...mouth.filter((v) => v[0] > 0).map((v) => v[1])) / MM).toBeGreaterThan(36)
    expect(Math.min(...mouth.filter((v) => v[0] > 0).map((v) => v[1])) / MM).toBeGreaterThan(30)
    expect(Math.min(...mouth.filter((v) => v[0] < 0).map((v) => v[1])) / MM).toBeLessThan(10)
  }, 120_000)

  it.skipIf(!BLENDER)('plateInsetMm 2 leaves the chassis 4 mm shorter than the plate and the plate face stays on the bounding box (ioFaceOffsetMm = plate thickness)', async () => {
    const { verts, measure } = await build(rackSpec('rack-inset', { w: 482.6, h: 88.9, d: 300 }, { bodyWidthMm: 440, earThicknessMm: 5, plateInsetMm: 2 }))
    expect(Math.min(...verts.map((v) => v[2])) / MM).toBeCloseTo(-150, 3) // the plate face is the bounding-box face
    expect(Math.max(...verts.map((v) => v[1])) / MM).toBeCloseTo(88.9, 3)
    const behind = verts.filter((v) => v[2] > (-150 + 5.5) * MM)
    expect(Math.max(...behind.map((v) => v[1])) / MM).toBeCloseTo(86.9, 3)
    expect(Math.min(...behind.map((v) => v[1])) / MM).toBeCloseTo(2, 3)
    expect(measure.ioFaceOffsetMm).toBe(5)
  }, 120_000)

  it.skipIf(!BLENDER)('handles: two bars stand handleProjectionMm in front of the plate inside the bounding box', async () => {
    const { verts } = await build(rackSpec('rack-handles', ONE_U, { handleCount: 2, handleProjectionMm: 22, handleDiaMm: 10, earThicknessMm: 4 }))
    expect(Math.min(...verts.map((v) => v[2])) / MM).toBeCloseTo(-150, 3)
    const barFront = verts.filter((v) => v[2] < (-150 + 10.2) * MM) // the bar's front half
    expect(barFront.length).toBeGreaterThan(20)
    expect(Math.max(...barFront.map((v) => Math.abs(v[0]))) / MM).toBeLessThan(241.3)
    // the plate's front face is 22 mm behind the bounding-box face
    const plate = verts.filter((v) => Math.abs(v[2] - (-150 + 22) * MM) < 1e-7)
    expect(plate.length).toBeGreaterThanOrEqual(8)
    // two bars: far from the centre on both sides
    expect(barFront.some((v) => v[0] > 200 * MM) && barFront.some((v) => v[0] < -200 * MM)).toBe(true)
    expect(barFront.every((v) => Math.abs(v[0]) > 200 * MM)).toBe(true)
  }, 120_000)

  it.skipIf(!BLENDER)('vents: N x columns rectangular recesses in the top, ventDepthMm deep', async () => {
    const { verts, measure } = await build(rackSpec('rack-vents', { w: 482.6, h: 88.9, d: 300 }, { bodyWidthMm: 440, ventSlots: 6, ventColumns: 3, ventDepthMm: 2, ventSlotLenMm: 40, ventSlotWidthMm: 3, ventPitchMm: 6, ventColPitchMm: 50 }))
    expect(measure.ventSlots).toBe(18)
    const floor = verts.filter((v) => Math.abs(v[1] - (88.9 - 2) * MM) < 1e-7)
    expect(floor.length).toBeGreaterThanOrEqual(18 * 4)
    expect(Math.max(...verts.map((v) => v[1])) / MM).toBeCloseTo(88.9, 3)
  }, 120_000)

  it.skipIf(!BLENDER)('side vents (ventSides) cut both side walls of the chassis', async () => {
    const { verts, measure } = await build(rackSpec('rack-sidevents', { w: 482.6, h: 88.9, d: 300 }, { bodyWidthMm: 431.8, ventSlots: 4, ventSides: 1, ventDepthMm: 2, ventSlotLenMm: 30, ventPitchMm: 8, ventColumns: 3, ventColPitchMm: 40 }))
    expect(measure.ventSlots).toBe(24)
    const leftFloor = verts.filter((v) => Math.abs(v[0] + (215.9 - 2) * MM) < 1e-7)
    const rightFloor = verts.filter((v) => Math.abs(v[0] - (215.9 - 2) * MM) < 1e-7)
    expect(leftFloor.length).toBeGreaterThanOrEqual(12 * 4)
    expect(rightFloor.length).toBeGreaterThanOrEqual(12 * 4)
  }, 120_000)

  it.skipIf(!BLENDER)('feet lift the chassis: four feet reach y = 0, the plate starts at the feet height', async () => {
    const { verts } = await build(rackSpec('rack-feet', { w: 220, h: 104, d: 290 }, { feetMm: 4, feetDiaMm: 14, earThicknessMm: 4 }))
    expect(Math.min(...verts.map((v) => v[1]))).toBeCloseTo(0, 7)
    const low = verts.filter((v) => v[1] < 1e-7)
    expect(low.length).toBeGreaterThanOrEqual(4 * 10)
    // the feet are inside the footprint, apart from each other
    expect(new Set(low.map((v) => `${Math.sign(v[0])}${Math.sign(v[2])}`)).size).toBe(4)
  }, 120_000)

  it.skipIf(!BLENDER)('rearInsetMm makes the rear panel a shell of its own (a seam in the fillets)', async () => {
    const plain = await build(rackSpec('rack-norear', ONE_U, { filletMm: 1.5, bodyWidthMm: 440 }))
    const seam = await build(rackSpec('rack-rear', ONE_U, { filletMm: 1.5, bodyWidthMm: 440, rearInsetMm: 6 }))
    expect(seam.tris).toBeGreaterThan(plain.tris + 20)
    expect(Math.max(...seam.verts.map((v) => v[2])) / MM).toBeCloseTo(150, 3)
  }, 120_000)

  it.skipIf(!BLENDER)('fillet: measured filletMm lands in the measure file (the plate edge may be smaller than the chassis fillet but never below the minimum)', async () => {
    const { measure } = await build(rackSpec('rack-fillet', ONE_U, { filletMm: 2, filletSegments: 4, bodyWidthMm: 440, earThicknessMm: 5 }))
    expect(measure.filletMm).toBeGreaterThanOrEqual(2 * 0.99)
    const thin = await build(rackSpec('rack-fillet2', ONE_U, { filletMm: 2, bodyWidthMm: 440, earThicknessMm: 3 }))
    expect(thin.measure.filletMm).toBeCloseTo(1.35, 2) // a 3 mm plate cannot take more than 0.45 x 3 mm on its edges
  }, 120_000)

  it.skipIf(!BLENDER)('frontOnIo puts the plate, ears and handles on the io (+z) face', async () => {
    const { verts } = await build(rackSpec('rack-io', ONE_U, { bodyWidthMm: 438, earThicknessMm: 3, earHoleMm: 6.35, frontOnIo: 1 }))
    const plateFront = verts.filter((v) => Math.abs(v[2] - 150 * MM) < 1e-7 && Math.abs(v[0]) > 220.5 * MM && Math.abs(v[0]) < 240.5 * MM && v[1] > 3 * MM && v[1] < 41 * MM)
    expect(plateFront.length).toBeGreaterThan(80)
    expect(Math.max(...verts.filter((v) => v[2] < 0).map((v) => Math.abs(v[0]))) / MM).toBeCloseTo(219, 3) // the rear is the chassis
  }, 120_000)

  it.skipIf(!BLENDER)('every triangle lying in an end plane of the bounding box faces outward (a bevel wider than the wall of a thin rear panel once turned them inside out)', async () => {
    const spec = rackSpec('rack-normals', ONE_U, { bodyWidthMm: 438, earThicknessMm: 3, earHoleMm: 6.35, handleCount: 2, handleProjectionMm: 22, filletMm: 3, filletSegments: 6, rearInsetMm: 3, seamMm: 20, ventSlots: 3, feetMm: 3 })
    const out = join(dir, 'normals.glb')
    await runBuilder(spec, out)
    const doc = await new NodeIO().readBinary(new Uint8Array(await readFile(out)))
    const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0]
    const pos = prim.getAttribute('POSITION')!
    const idx = prim.getIndices()!
    const planes: [number, number, number][] = [[2, 150 * MM, 1], [2, -150 * MM, -1], [1, 44.45 * MM, 1], [1, 0, -1]]
    for (let t = 0; t < idx.getCount(); t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => pos.getElement(idx.getScalar(t + k), [0, 0, 0]))
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      for (const [axis, value, sign] of planes) {
        if ([a, b, c].every((p) => Math.abs(p[axis] - value) < 1e-6)) expect(Math.sign(n[axis]), `triangle in the plane ${'xyz'[axis]} = ${value / MM} mm faces inward`).toBe(sign)
      }
    }
  }, 120_000)

  it.skipIf(!BLENDER)('a 1U sample with ears, handles, vents and fillets lands inside 1500 to 3500 triangles and is byte-identical across two builds', async () => {
    const spec = rackSpec('rack-1u', ONE_U, { bodyWidthMm: 438, earThicknessMm: 3, earHoleMm: 6.35, handleCount: 2, handleProjectionMm: 22, plateInsetMm: 1, filletMm: 1.5, filletSegments: 4, ventSlots: 8, ventColumns: 4, ventSlotLenMm: 30, ventPitchMm: 5, ventColPitchMm: 40, rearInsetMm: 4, feetMm: 3 })
    const a = await build(spec)
    const b = await build(spec)
    expect(a.tris).toBeGreaterThanOrEqual(1500)
    expect(a.tris).toBeLessThanOrEqual(3500)
    expect(Buffer.compare(Buffer.from(a.bytes), Buffer.from(b.bytes))).toBe(0)
  }, 180_000)

  it.skipIf(!BLENDER)('BuildError: ears that disagree, a slot outside the ear, a vent block that does not fit', async () => {
    await expect(build(rackSpec('e1', ONE_U, { bodyWidthMm: 438, earWidthMm: 20 }))).rejects.toThrow(/earWidthMm.*bodyWidthMm/)
    await expect(build(rackSpec('e2', ONE_U, { bodyWidthMm: 460, earHoleMm: 6.35 }))).rejects.toThrow(/ear slot.*does not lie in the ear/)
    await expect(build(rackSpec('e3', ONE_U, { bodyWidthMm: 438, ventSlots: 4, ventColumns: 12, ventSlotLenMm: 40, ventColPitchMm: 50 }))).rejects.toThrow(/vent block/)
    await expect(build(rackSpec('e4', ONE_U, { bodyWidthMm: 438, ventSlots: 30, ventPitchMm: 20 }))).rejects.toThrow(/vent slots/)
  }, 180_000)
})
