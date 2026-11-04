/**
 * Tests for the scripted builder (tools/assets3d/blender/build_from_spec.py). The registry test reads the script and
 * needs no Blender; the rest run the real builder, then the real fix-up and gates through Blender and are skipped when
 * Blender is not installed (like fixup.test.ts). Builder output is the raw GLB of attempt 1: it must come out of the
 * fix-up unrotated and pass every gate.
 */
import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildAsset } from '../../../tools/assets3d/build-asset'
import { findBlender } from '../../../tools/assets3d/env'
import type { GateResult } from '../../../tools/assets3d/gates'
import { runGates } from '../../../tools/assets3d/gates'
import { inspectGlb } from '../../../tools/assets3d/inspect'
import type { GlbReport } from '../../../tools/assets3d/inspect'
import { loadSpecs } from '../../../tools/assets3d/loadSpecs'
import { buildPlacement } from '../../../tools/assets3d/placement'
import { BUILD_SCRIPT, runBuilder } from '../../../tools/assets3d/runBuilder'
import { runFixup } from '../../../tools/assets3d/runFixup'
import type { FixupReport } from '../../../tools/assets3d/runFixup'
import { BUILD_SHAPES } from '../../../tools/assets3d/shapes'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'

const BLENDER = findBlender()
const MM = 0.001
const TOL_M = 0.01 * MM

/** The shipped spec of `id` (content/asset-specs), with its own build block. */
function realSpec(id: string): AssetSpecT {
  const spec = loadSpecs().find((s) => s.id === id)
  if (!spec) throw new Error(`no spec ${id}`)
  return spec
}

/** The four wave-1 assets and the build block each spec must carry. */
const WAVE1: [string, AssetSpecT['build']][] = [
  ['xlr3-f', { shape: 'cylinder-plug', params: { frontLenMm: 12 } }],
  ['trs-quarter', { shape: 'trs-plug', params: { barrelMm: 30.5 } }],
  ['rj45', { shape: 'rj45-plug' }],
  ['yamaha-rio3224-d2', { shape: 'stagebox-rio3224', params: { earMm: 27, flangeDepthMm: 190, frontStepMm: 11.5, rearStepMm: 6 } }],
]

describe('wave-1 specs', () => {
  it.each(WAVE1)('%s carries its build block', (id, build) => {
    expect(realSpec(id).build).toEqual(build)
  })
})

interface Built {
  raw: GlbReport
  rawBytes: Uint8Array
  fix: FixupReport
  fixed: GlbReport
  fixedBytes: Uint8Array
  gates: GateResult[]
}

/** Vertices of every mesh of a GLB, world space, metres. */
async function vertices(bytes: Uint8Array): Promise<[number, number, number][]> {
  const doc = await new NodeIO().readBinary(bytes)
  const out: [number, number, number][] = []
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const m = node.getWorldMatrix()
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (!pos) continue
      const el: number[] = [0, 0, 0]
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, el)
        out.push([
          m[0] * el[0] + m[4] * el[1] + m[8] * el[2] + m[12],
          m[1] * el[0] + m[5] * el[1] + m[9] * el[2] + m[13],
          m[2] * el[0] + m[6] * el[1] + m[10] * el[2] + m[14],
        ])
      }
    }
  }
  return out
}

/** What a GLB carries for looks: vertex count, and the distinct COLOR_0 values (3 decimals) with the accessor type. */
async function looks(bytes: Uint8Array): Promise<{ vertices: number; colourType: string | null; colours: Set<string> }> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })
  const doc = await io.readBinary(bytes)
  let vertices = 0
  let colourType: string | null = null
  const colours = new Set<string>()
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      vertices += prim.getAttribute('POSITION')?.getCount() ?? 0
      const col = prim.getAttribute('COLOR_0')
      if (!col) continue
      colourType = col.getType()
      const el: number[] = [0, 0, 0, 1]
      for (let i = 0; i < col.getCount(); i++) {
        col.getElement(i, el)
        colours.add(el.slice(0, 3).map((v) => v.toFixed(3)).join(','))
      }
    }
  }
  return { vertices, colourType, colours }
}

/**
 * The model must look like the part: vertex colours (COLOR_0, a VEC3) with at least `minColours` distinct values, and
 * smooth shading (vertices shared between triangles: flat shading would give 3 vertices per triangle).
 */
async function expectLooks(bytes: Uint8Array, triangles: number, minColours: number): Promise<void> {
  const l = await looks(bytes)
  expect(l.colourType, 'COLOR_0 missing').toBe('VEC3')
  expect(l.colours.size).toBeGreaterThanOrEqual(minColours)
  expect(l.vertices, 'vertices per triangle: flat shading?').toBeLessThan(triangles * 1.8)
}

/** Largest distance from the z axis among the vertices whose z is within 1e-7 m of `z`. */
function radiusAtZ(verts: [number, number, number][], z: number): number {
  return Math.max(...verts.filter((v) => Math.abs(v[2] - z) < 1e-7).map((v) => Math.hypot(v[0], v[1])))
}

describe('build_from_spec.py registry', () => {
  it('registry lists exactly BUILD_SHAPES', () => {
    const text = readFileSync(BUILD_SCRIPT, 'utf8')
    const names = [...text.matchAll(/^\s+"([a-z0-9-]+)": build_/gm)].map((m) => m[1])
    expect(new Set(names)).toEqual(new Set(BUILD_SHAPES))
    expect(names).toHaveLength(BUILD_SHAPES.length)
  })
})

describe(`scripted builder with real Blender (${BLENDER ? `using ${BLENDER}` : 'SKIPPED, Blender not found: install Blender or set BLENDER_EXE'})`, () => {
  let dir = ''
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tekpractice-builder-it-'))
  })
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  const cache = new Map<string, Promise<Built>>()
  /** Builder -> raw GLB -> fix-up -> inspect -> gates, memoised per asset id and build block. */
  function buildAndFix(spec: AssetSpecT): Promise<Built> {
    const key = JSON.stringify([spec.id, spec.build])
    let hit = cache.get(key)
    if (!hit) {
      hit = (async () => {
        const rawPath = join(dir, `${spec.id}-${cache.size}.raw.glb`)
        const fixedPath = join(dir, `${spec.id}-${cache.size}.fixed.glb`)
        await runBuilder(spec, rawPath)
        const rawBytes = new Uint8Array(await readFile(rawPath))
        // As buildAsset does for a scripted build: the builder models its own sockets, the fix-up cuts no recess.
        const fix = await runFixup(rawPath, fixedPath, spec, { recess: false })
        const fixedBytes = new Uint8Array(await readFile(fixedPath))
        const fixed = await inspectGlb(fixedBytes)
        return { raw: await inspectGlb(rawBytes), rawBytes, fix, fixed, fixedBytes, gates: runGates(fixed, spec, buildPlacement(spec)) }
      })()
      cache.set(key, hit)
    }
    return hit
  }

  const xlr = (): AssetSpecT => realSpec('xlr3-f')

  it.skipIf(!BLENDER)('xlr3-f builds at 20.3 x 21 x 72.5 mm: 15.75 mm insert at minimum z, 19.2 mm shell, wider bushing, lug on top', async () => {
    const spec = xlr()
    const { raw, rawBytes, fixed, fixedBytes } = await expectBuiltTo(spec, 800)
    await expectLooks(rawBytes, raw.triangles, 3) // black, nickel, dark pin holes
    await expectLooks(fixedBytes, fixed.triangles, 3)

    const verts = await vertices(rawBytes)
    const zMin = raw.bboxM.min[2]
    // The axis sits 0.35 mm below the box centre (the lug rises above the bushing, nothing hangs below it).
    const axisY = -0.35 * MM
    const radius = (v: [number, number, number]): number => Math.hypot(v[0], v[1] - axisY)
    const inRange = (lo: number, hi: number): [number, number, number][] => verts.filter((v) => v[2] > zMin + lo * MM + 1e-7 && v[2] < zMin + hi * MM - 1e-7)
    expect(Math.abs(Math.max(...inRange(0.3, 12.1).map(radius)) - 15.75 * MM / 2)).toBeLessThan(TOL_M) // front insert
    expect(Math.abs(Math.max(...inRange(14.4, 30.1).filter((v) => v[1] - axisY < 9.5 * MM).map(radius)) - 19.2 * MM / 2)).toBeLessThan(TOL_M) // nickel shell
    expect(Math.abs(Math.max(...inRange(35.9, 43.1).map(radius)) - 20.3 * MM / 2)).toBeLessThan(TOL_M) // bushing: the widest round part
    // The latch lug is the highest thing, above the bushing, on the +Y side of the shell.
    const top = Math.max(...verts.map((v) => v[1]))
    expect(top).toBeCloseTo(10.5 * MM, 6)
    expect(Math.max(...inRange(14.4, 24.1).map((v) => v[1]))).toBeGreaterThan(axisY + 9.9 * MM)
    expect(Math.max(...inRange(30.9, 47.1).map((v) => v[1]))).toBeLessThan(top - 0.2 * MM)
  }, 120_000)

  it.skipIf(!BLENDER)('xlr3-f goes through the fix-up unrotated and passes every gate', async () => {
    const { fix, gates } = await buildAndFix(xlr())
    expect(fix.rotatedDegrees).toBe(0)
    expect(gates.filter((g) => !g.ok)).toEqual([])
  }, 120_000)

  /** Every wave-1 asset must come out of the builder at the spec size, inside the triangle budget, and through the fix-up unrotated. */
  async function expectBuiltTo(spec: AssetSpecT, budget: number): Promise<Built> {
    const built = await buildAndFix(spec)
    const { w, h, d } = spec.realSizeMm
    const size = [0, 1, 2].map((k) => built.raw.bboxM.max[k] - built.raw.bboxM.min[k])
    for (const [k, mm] of [w, h, d].entries()) expect(Math.abs(size[k] - mm * MM)).toBeLessThan(TOL_M)
    expect(built.raw.triangles).toBeLessThanOrEqual(budget)
    expect(built.raw.materials).toBe(1)
    expect(built.fix.rotatedDegrees).toBe(0)
    // No recess boolean ran: the fix-up neither adds nor drops a triangle (a cut would have changed the count).
    expect(built.fixed.triangles).toBe(built.raw.triangles)
    expect(built.gates.filter((g) => !g.ok)).toEqual([])
    return built
  }

  it.skipIf(!BLENDER)('trs-quarter builds at 14.5 x 14.5 x 93 mm with a 6.29 mm, 30.5 mm barrel at minimum z', async () => {
    const spec = realSpec('trs-quarter')
    const { raw, rawBytes, fixed, fixedBytes } = await expectBuiltTo(spec, 800)
    await expectLooks(rawBytes, raw.triangles, 2)
    await expectLooks(fixedBytes, fixed.triangles, 2) // the fix-up must keep colours and smooth normals
    const verts = await vertices(rawBytes)
    const zMin = raw.bboxM.min[2]
    // The barrel is every vertex before the nose step at z = 30.5 mm; the grooves are narrower, the tip is rounded.
    const barrel = verts.filter((v) => v[2] < zMin + 30.5 * MM - 1e-6)
    const barrelRadius = Math.max(...barrel.map((v) => Math.hypot(v[0], v[1])))
    expect(Math.abs(barrelRadius - 6.29 * MM / 2)).toBeLessThan(TOL_M)
    expect(radiusAtZ(verts, zMin)).toBeLessThan(6.29 * MM / 2)
    // The handle shell is the widest part (14.5 mm); the boot tapers toward the cable end.
    expect(Math.abs(Math.max(...verts.map((v) => Math.hypot(v[0], v[1]))) - 14.5 * MM / 2)).toBeLessThan(TOL_M)
    expect(radiusAtZ(verts, raw.bboxM.max[2])).toBeLessThan(14.5 * MM / 2 * 0.7)
  }, 120_000)

  it.skipIf(!BLENDER)('rj45 builds at 11.68 x 8 x 22.48 mm: 6.6 mm at the mating end, 8 mm at the cable end, latch side +Y', async () => {
    const spec = realSpec('rj45')
    const { raw, rawBytes, fixed, fixedBytes } = await expectBuiltTo(spec, 800)
    await expectLooks(rawBytes, raw.triangles, 3) // pale body, gold contacts, dark cable hole
    await expectLooks(fixedBytes, fixed.triangles, 3)
    const verts = await vertices(rawBytes)
    const zMin = raw.bboxM.min[2]
    const zMax = raw.bboxM.max[2]
    // Research report: the insertion part is 6.6 mm high (4 - 1.4 = +2.6 mm on the latch side, -4 mm on the contact side),
    // the cable end rises to the full 8 mm. The old builder had this step upside down.
    const front = verts.filter((v) => v[2] < zMin + 1 * MM)
    expect(Math.max(...front.map((v) => v[1]))).toBeCloseTo(2.6 * MM, 6)
    expect(Math.max(...verts.filter((v) => v[2] > zMax - 0.5 * MM).map((v) => v[1]))).toBeCloseTo(4 * MM, 6)
    // The gold contact blades stand under the front half, flush with the cable end's underside.
    expect(Math.min(...front.map((v) => v[1]))).toBeCloseTo(-4 * MM, 6)
  }, 120_000)

  it.skipIf(!BLENDER)('yamaha-rio3224-d2 builds as a 480 x 220 x 368 mm stage box: connectors define the front and rear faces, ears, colours', async () => {
    const spec = realSpec('yamaha-rio3224-d2')
    const { raw, rawBytes, fixed, fixedBytes } = await expectBuiltTo(spec, 4000)
    await expectLooks(rawBytes, raw.triangles, 6) // slate panel, plates, chassis, ears, bezels, dark cores, display...
    await expectLooks(fixedBytes, fixed.triangles, 6)
    // Bottom-centre pivot as built: the fix-up keeps it.
    expect(raw.bboxM.min[1]).toBeCloseTo(0, 6)
    // The fix-up added the six port empties (io and opposite faces) and the control, and cut no recess into the bezels.
    expect(fixed.nodeNames.filter((n) => n.startsWith('port_'))).toHaveLength(6)
    expect(fixed.nodeNames.filter((n) => n.startsWith('ctrl_'))).toHaveLength(1)

    const verts = await vertices(rawBytes)
    const zFront = raw.bboxM.max[2]
    const zBack = raw.bboxM.min[2]
    const rings = (z: number): number => verts.filter((v) => Math.abs(v[2] - z) < 1e-7).length
    // 52 connector bezels (two 10-sided rings each) reach the front face; the four rear housings reach the back face.
    expect(rings(zFront)).toBeGreaterThanOrEqual(52 * 10)
    expect(rings(zBack)).toBeGreaterThanOrEqual(4 * 8)
    // The panel stands 11.5 mm behind the front face. Every vertex is either at the panel (bezel bases, plates, ears), on a
    // bezel tip (exactly at the front face) or within 10 mm of the panel (rocker, knob, buttons): nothing but the
    // connectors comes closer to the front face than 1.5 mm.
    const panelZ = zFront - 11.5 * MM
    const strays = verts.filter((v) => v[2] > panelZ + 10 * MM + 1e-7 && v[2] < zFront - 1e-7)
    expect(strays).toEqual([])
    // Ears: the 480 mm width is the two 27 mm ears (the chassis and panel are 426 mm wide).
    const earVerts = verts.filter((v) => Math.abs(v[0]) > 213.5 * MM)
    expect(earVerts.length).toBeGreaterThan(0)
    expect(Math.max(...earVerts.map((v) => Math.abs(v[0])))).toBeCloseTo(240 * MM, 6)
  }, 120_000)

  it.skipIf(!BLENDER)('rack-box still builds a plain chamfered box at the spec size (shared by later wave-3 devices)', async () => {
    const spec: AssetSpecT = { ...realSpec('yamaha-rio3224-d2'), build: { shape: 'rack-box', params: { chamferMm: 1 } } }
    const { raw } = await expectBuiltTo(spec, 4000)
    expect(raw.triangles).toBeLessThan(100)
  }, 120_000)

  it.skipIf(!BLENDER)('a projection maps the picture onto the faces that look the same way and gives every other face a palette swatch (one material, one texture, no vertex colours)', async () => {
    const spec: AssetSpecT = { ...realSpec('yamaha-rio3224-d2'), build: { shape: 'rack-box', params: { chamferMm: 1 } } }
    // a 400 x 100 px picture: the left half red (200, 30, 30), the right half blue (30, 30, 200)
    const px = Buffer.alloc(400 * 100 * 3)
    for (let y = 0; y < 100; y++) for (let x = 0; x < 400; x++) px.set(x < 200 ? [200, 30, 30] : [30, 30, 200], (y * 400 + x) * 3)
    const png = new Uint8Array(await sharp(px, { raw: { width: 400, height: 100, channels: 3 } }).png().toBuffer())
    const out = join(dir, 'projected.raw.glb')
    await runBuilder(spec, out, {}, { face: 'io', png })
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).readBinary(new Uint8Array(await readFile(out)))
    const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())
    expect(doc.getRoot().listMaterials()).toHaveLength(1)
    const tex = doc.getRoot().listMaterials()[0].getBaseColorTexture()
    expect(tex, 'no base colour texture').not.toBeNull()
    expect(prims.every((p) => p.getAttribute('COLOR_0') === null), 'vertex colours left').toBe(true)
    const { data, info } = await sharp(Buffer.from(tex!.getImage()!)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const texel = (u: number, v: number): number[] => {
      const x = Math.min(info.width - 1, Math.floor(u * info.width))
      const y = Math.min(info.height - 1, Math.floor(v * info.height)) // glTF v runs down the image
      return Array.from(data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3))
    }
    const near = (a: number[], b: number[]): boolean => a.every((c, i) => Math.abs(c - b[i]) <= 3)
    const halfDepth = 0.5 * spec.realSizeMm.d * MM
    let front = 0
    let swatch = 0
    for (const prim of prims) {
      const pos = prim.getAttribute('POSITION')!
      const uv = prim.getAttribute('TEXCOORD_0')!
      const nrm = prim.getAttribute('NORMAL')!
      for (let i = 0; i < pos.getCount(); i++) {
        const p3 = pos.getElement(i, [0, 0, 0])
        const n3 = nrm.getElement(i, [0, 0, 0])
        const t = texel(...(uv.getElement(i, [0, 0]) as [number, number]))
        if (n3[2] > 0.99 && Math.abs(p3[2] - halfDepth) < 1e-4 && Math.abs(p3[0]) > 0.05) {
          // a vertex flat on the io face (glTF +z): its UV must show the picture, red on the left (x < 0), blue on the right
          front++
          expect(near(t, p3[0] < 0 ? [200, 30, 30] : [30, 30, 200]), 'front vertex x=' + p3[0] + ' got ' + t).toBe(true)
        } else if (n3[2] < -0.99 || Math.abs(n3[1]) > 0.99) {
          // the back, top and bottom faces: a swatch, never the picture's red or blue
          swatch++
          expect(near(t, [200, 30, 30]) || near(t, [30, 30, 200]), 'a non-projected face shows the picture').toBe(false)
        }
      }
    }
    expect(front).toBeGreaterThan(0)
    expect(swatch).toBeGreaterThan(0)
  }, 120_000)

  it.skipIf(!BLENDER)('console-wedge builds yamaha-ql1 at 468 x 272 x 562 mm with its measured side profile, ports on the flat io face, every gate passing', async () => {
    const spec = realSpec('yamaha-ql1')
    expect(spec.build?.shape).toBe('console-wedge')
    const { raw, fixed, fixedBytes, gates } = await expectBuiltTo(spec, 4000)
    expect(raw.triangles).toBeLessThan(400)
    expect(gates.filter((g) => !g.ok)).toEqual([])
    const verts = await vertices(fixedBytes)
    const heightAt = (depthMm: number): number => {
      const z = (0.5 * spec.realSizeMm.d - depthMm) * MM
      return Math.max(...verts.filter((v) => Math.abs(v[2] - z) < 2 * MM).map((v) => v[1])) / MM
    }
    expect(heightAt(0.5)).toBeGreaterThan(270) // the tall rear
    expect(Math.abs(heightAt(201) - 152)).toBeLessThan(2) // the sampling window is +-2 mm of depth, and the slope is 0.6
    expect(heightAt(561.5)).toBeLessThan(100) // the low front edge
    expect(fixed.triangles).toBeLessThan(400)
  }, 120_000)

  it.skipIf(!BLENDER)('a chamfer larger than half the smallest side exits with BUILD_FAIL naming chamferMm', async () => {
    const spec: AssetSpecT = { ...realSpec('yamaha-rio3224-d2'), build: { shape: 'rack-box', params: { chamferMm: 300 } } }
    await expect(runBuilder(spec, join(dir, 'big-chamfer.glb'))).rejects.toThrow(/chamferMm/)
  }, 120_000)

  it.skipIf(!BLENDER)('a TRS barrel too short for its two insulator bands is refused, naming barrelMm', async () => {
    const spec: AssetSpecT = { ...realSpec('trs-quarter'), build: { shape: 'trs-plug', params: { barrelMm: 15 } } }
    await expect(runBuilder(spec, join(dir, 'short-barrel.glb'))).rejects.toThrow(/barrelMm/)
  }, 120_000)

  it.skipIf(!BLENDER)('shure-sm58 builds as a lathe of its measured profile: 51 x 162 x 51 mm, every station at its diameter, bottom port on the base', async () => {
    const spec = realSpec('shure-sm58')
    const profile = spec.build?.profile
    expect(profile?.length).toBeGreaterThanOrEqual(4)
    const { raw, rawBytes, fixed, fixedBytes } = await expectBuiltTo(spec, 4000)
    await expectLooks(rawBytes, raw.triangles, 2) // grille and handle zones
    await expectLooks(fixedBytes, fixed.triangles, 2)
    expect(raw.bboxM.min[1]).toBeCloseTo(0, 6)
    // The axis is the pivot: every station ring has the profile's radius (within a hundredth of a millimetre).
    const verts = await vertices(rawBytes)
    for (const [yMm, diaMm] of profile ?? []) {
      const ring = verts.filter((v) => Math.abs(v[1] - yMm * MM) < 1e-7)
      expect(ring.length, `no vertices at y = ${yMm} mm`).toBeGreaterThan(0)
      expect(Math.abs(Math.max(...ring.map((v) => Math.hypot(v[0], v[2]))) - diaMm * MM / 2)).toBeLessThan(0.01 * MM)
    }
    // The bottom port (out-xlr) lies on the real base cap: the ray cast found the surface.
    const surface = fixed.nodes.find((n) => n.name === 'port_out-xlr')
    expect(surface?.worldPos[1]).toBeCloseTo(0, 6)
  }, 120_000)

  it.skipIf(!BLENDER)('a revolve profile with a station above the height is refused with BUILD_FAIL naming the station', async () => {
    const base = realSpec('shure-sm58')
    const bad = { ...base, build: { ...base.build!, profile: [[0, 20], [40, 30], [100, 51], [150, 30]] } } as AssetSpecT
    // validateBuild catches the last station before Blender runs; bypass it to prove the script also refuses
    const sneaky = { ...bad, build: { ...bad.build!, profile: [[0, 20], [40, 30], [30, 51], [162, 30]] } } as AssetSpecT
    await expect(runBuilder(bad, join(dir, 'bad-profile.glb'))).rejects.toThrow(/last station/)
    await expect(runBuilder(sneaky, join(dir, 'bad-profile2.glb'))).rejects.toThrow(/strictly|increas|above the previous/)
  }, 120_000)

  it.skipIf(!BLENDER)('a negative size exits non-zero with the BUILD_FAIL reason', async () => {
    const base = xlr()
    const bad = { ...base, realSizeMm: { ...base.realSizeMm, d: -1 } } as AssetSpecT
    await expect(runBuilder(bad, join(dir, 'bad.glb'))).rejects.toThrow(/sizeMm\.d must be a positive/)
  }, 120_000)

  it.skipIf(!BLENDER).each(WAVE1.map(([id]) => id))('%s: asset:build --scripted passes every gate end to end and ships nothing', async (id) => {
    const paths = { assetsDir: join(dir, 'e2e', id, 'public'), sourceDir: join(dir, 'e2e', id, 'assets-source'), manifestPath: join(dir, 'e2e', id, 'public', 'ASSET_MANIFEST.json') }
    const report = await buildAsset(id, { maxAttempts: 1, scripted: true, dryRun: true }, { paths, renderSheet: null, log: () => undefined })
    expect(report.error).toBeUndefined()
    expect(report.ok).toBe(true)
    expect(report.attempts[0].gates.filter((g) => !g.ok)).toEqual([])
    // The per-port ray cast ran on the real mesh and every port lies on its surface (the Rio's bezel tips and rear housings).
    expect(report.attempts[0].gates.map((g) => g.gate)).toContain('portSurface')
    expect(existsSync(join(report.workDir, 'final.glb'))).toBe(true)
    // The shipped bytes (fix-up, texture step, Draco, re-measure) keep the vertex colours and the smooth shading.
    const final = new Uint8Array(await readFile(join(report.workDir, 'final.glb')))
    await expectLooks(final, (await inspectGlb(final)).triangles, 2)
    expect(existsSync(join(paths.assetsDir, `${id}.glb`))).toBe(false)
    expect(existsSync(paths.manifestPath)).toBe(false)
  }, 180_000)

  it.skipIf(!BLENDER)('two builder runs produce identical raw GLB bytes', async () => {
    for (const [id] of WAVE1) {
      const a = join(dir, `det-${id}-a.glb`)
      const b = join(dir, `det-${id}-b.glb`)
      await runBuilder(realSpec(id), a)
      await runBuilder(realSpec(id), b)
      const [x, y] = [await readFile(a), await readFile(b)]
      expect(x.equals(y), `${id}: the two raw GLBs differ (${x.length} vs ${y.length} bytes)`).toBe(true)
    }
  }, 180_000)
})
