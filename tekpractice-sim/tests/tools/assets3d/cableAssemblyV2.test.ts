/**
 * Tests for cable-assembly-v2 (Wave 3, Task 3.2): a typed cable with a plug of one end kind at each end and an optional fan-out at the B end. Params and their checks
 * run without Blender; the geometry runs through the real builder (skipped when Blender is not installed). The old cable-assembly (the Mogami DB25 to XLR loom) keeps
 * its own shape: its pinned bytes are held by builderPins.test.ts, and here by a check that the shape is untouched.
 *
 * Frame of the built mesh: bottom at y = 0, centred on x and z, end A (params.endA) at z = +d/2 (io), end B at z = -d/2 (opposite).
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
import { BUILD_SHAPES, CABLE_END_KINDS, CABLE_V2_PARAMS, SHAPE_SPECS, cableV2Natural, validateBuild } from '../../../tools/assets3d/shapes'
import type { CableEndKind } from '../../../tools/assets3d/shapes'
import { AssetSpec } from '../../../tools/assets3d/specSchema'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'
import { buildPlanRaw } from './rawBuild'

const BLENDER = findBlender()
const MM = 0.001
const catalog = JSON.parse(await readFile(new URL('../../../content/catalog.json', import.meta.url), 'utf8')) as { connectorTypes: { id: string; gender: string; matesWith: string[] }[] }
const connector = (id: string): { id: string; gender: string; matesWith: string[] } => catalog.connectorTypes.find((c) => c.id === id) as { id: string; gender: string; matesWith: string[] }
const CODES = Object.keys(CABLE_END_KINDS).map(Number) as CableEndKind[]

/** The size a cable of these params must have: the natural cross-section, and a depth of `d` mm. */
function sizeOf(params: Record<string, number>, d: number): { w: number; h: number; d: number } {
  const n = cableV2Natural(params)
  return { w: n.w, h: n.h, d }
}

function spec(id: string, size: { w: number; h: number; d: number }, params: Record<string, number>, over: Partial<AssetSpecT> = {}): AssetSpecT {
  const base = loadSpecs().find((s) => s.id === 'apple-mac-mini') as AssetSpecT
  return { ...base, id, realSizeMm: size, ports: [], controls: [], texture: undefined, portsDocumented: undefined, portsSource: undefined, build: { shape: 'cable-assembly-v2', params }, ...over }
}

const XLR_CABLE = { endA: 2, endB: 1 }
const SNAKE = { endA: 10, endB: 1, fanColumns: 4, fanRows: 2 }

describe('cable-assembly-v2 params (no Blender)', () => {
  it('is registered as a device shape with no ports or flat zones of its own, next to the untouched cable-assembly', () => {
    expect(BUILD_SHAPES).toContain('cable-assembly-v2')
    expect(BUILD_SHAPES).toContain('cable-assembly')
    expect(SHAPE_SPECS['cable-assembly-v2']).toMatchObject({ kind: 'device', needsMatingOuter: false })
    expect(SHAPE_SPECS['cable-assembly-v2'].params).toEqual([...CABLE_V2_PARAMS])
    expect(SHAPE_SPECS['cable-assembly'].params).toEqual(['hoodWidthMm', 'hoodHeightMm', 'hoodLenMm', 'plugDiaMm', 'plugLenMm', 'tailLenMm', 'trunkDiaMm', 'pitchMm', 'columns', 'rows'])
  })

  it('end kinds are catalogue connectors that mate both ways: each plug fits the port its connector mates with, and the mating is symmetric', () => {
    expect(CODES).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
    for (const code of CODES) {
      const kind = CABLE_END_KINDS[code]
      const c = connector(kind.connector)
      expect(c, `${kind.name} is a catalogue connector`).toBeDefined()
      expect(c.matesWith.length, kind.name).toBeGreaterThan(0)
      for (const mate of c.matesWith) expect(connector(mate).matesWith, `${mate} mates back with ${kind.name}`).toContain(kind.connector)
    }
    // a cable XLR-F to XLR-M: its A end (female) goes into a male port, its B end (male) into a female port
    expect(connector(CABLE_END_KINDS[2].connector).matesWith).toEqual(['xlr3-m'])
    expect(connector(CABLE_END_KINDS[1].connector).matesWith).toEqual(['xlr3-f'])
    // a powerCON to IEC cable: the blue plug goes into a powerCON port, the C13 end into a C14 inlet
    expect(connector(CABLE_END_KINDS[6].connector).matesWith).toContain('powercon-blue')
    // the C13 end goes into a C14 inlet, and (waves 2 to 5 review, finding 2) into the powerCON end of a powerCON to IEC adapter cable, so the strip outlets reach the Meyer speakers
    expect(connector(CABLE_END_KINDS[12].connector).matesWith).toEqual(['iec-c14', 'powercon-blue'])
    // an etherCON plug also goes into a plain RJ45 port
    expect(connector(CABLE_END_KINDS[7].connector).matesWith).toContain('rj45')
  })

  it('computes the natural size from the end kinds and the fan-out: the widest plug, the grid, the shortest depth', () => {
    expect(cableV2Natural(XLR_CABLE)).toEqual({ w: 22, h: 22, minD: 62 + 62 + 30 })
    expect(cableV2Natural({ endA: 3, endB: 4 })).toEqual({ w: 12, h: 12, minD: 154 })
    // the snake: a 62 x 17 D-sub hood at A, a 4 x 2 grid of 22 mm XLR plugs on a 24 mm pitch at B
    expect(cableV2Natural(SNAKE)).toEqual({ w: 3 * 24 + 22, h: 24 + 22, minD: 45 + 62 + 120 + 30 })
    expect(cableV2Natural({ ...SNAKE, fanPitchMm: 30, tailLenMm: 200 })).toEqual({ w: 3 * 30 + 22, h: 30 + 22, minD: 45 + 62 + 200 + 30 })
  })

  it('accepts a mic cable, a patch cable, a powerCON cable, a speaker cable and a snake through the zod schema', () => {
    for (const [params, d] of [[XLR_CABLE, 300], [{ endA: 3, endB: 4 }, 300], [{ endA: 6, endB: 12 }, 300], [{ endA: 5, endB: 5, trunkDiaMm: 10 }, 320], [SNAKE, 500]] as const) {
      const s = spec('x', sizeOf(params, d), params)
      expect(AssetSpec.safeParse(s).success).toBe(true)
      expect(validateBuild(s)).toEqual([])
    }
  })

  it('names what is missing or wrong: both ends are required and must be known kinds', () => {
    expect(validateBuild(spec('x', { w: 22, h: 22, d: 300 }, { endA: 2 }))[0]).toMatch(/a cable needs endB, the end kind code \(1 xlr3-m, 2 xlr3-f, 3 trs-quarter/)
    expect(validateBuild(spec('x', { w: 22, h: 22, d: 300 }, { endA: 2, endB: 99 }))[0]).toMatch(/endB \(99\) is not an end kind/)
    expect(validateBuild(spec('x', { w: 22, h: 22, d: 300 }, { nonsenseMm: 2, ...XLR_CABLE }))[0]).toMatch(/no param 'nonsenseMm'/)
  })

  it('refuses a fan-out that is too big or half given, a trunk as thick as the plug, and a spec size that is not the natural one', () => {
    expect(validateBuild(spec('x', { w: 94, h: 46, d: 500 }, { ...SNAKE, fanColumns: 17 }))[0]).toMatch(/fanColumns' must be a whole number from 1 to 16/)
    expect(validateBuild(spec('x', { w: 94, h: 46, d: 500 }, { ...SNAKE, fanColumns: 5, fanRows: 4 }))[0]).toMatch(/fan-out has 20 plugs: at most 16/)
    expect(validateBuild(spec('x', { w: 22, h: 22, d: 300 }, { ...XLR_CABLE, tailLenMm: 100 }))[0]).toMatch(/tailLenMm has no effect without a fan-out/)
    expect(validateBuild(spec('x', { w: 22, h: 22, d: 300 }, { ...XLR_CABLE, trunkDiaMm: 22 }))[0]).toMatch(/trunkDiaMm \(22\) must be less than the smallest plug side \(22 mm\)/)
    expect(validateBuild(spec('x', { w: 30, h: 22, d: 300 }, XLR_CABLE))[0]).toMatch(/width of the cable is 22 mm .* but the spec size says 30 mm/)
    expect(validateBuild(spec('x', { w: 22, h: 22, d: 100 }, XLR_CABLE))[0]).toMatch(/depth 100 mm is too short for these ends: at least 154 mm/)
    expect(validateBuild(spec('x', { w: 22.3, h: 21.8, d: 300 }, XLR_CABLE))).toEqual([])   // within 2 %
  })

  it('wants the ports on the two ends and no pocket', () => {
    const port = { portId: 'a', face: 'io' as const, xMm: 11, yMm: 11, confidence: 'guess' as const }
    expect(validateBuild(spec('x', { w: 22, h: 22, d: 300 }, XLR_CABLE, { ports: [port, { ...port, portId: 'b', face: 'opposite' }] }))).toEqual([])
    expect(validateBuild(spec('x', { w: 22, h: 22, d: 300 }, XLR_CABLE, { ports: [{ ...port, insetMm: 4 }] }))[0]).toMatch(/a cable end has no pocket/)
    expect(validateBuild(spec('x', { w: 22, h: 22, d: 300 }, XLR_CABLE, { ports: [{ ...port, face: 'top' }] }))[0]).toMatch(/ports of a cable sit on its two ends/)
  })
})

describe(`cable-assembly-v2 with real Blender (${BLENDER ? `using ${BLENDER}` : 'SKIPPED, Blender not found: install Blender or set BLENDER_EXE'})`, () => {
  let dir = ''
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tekpractice-cable2-'))
  })
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  let count = 0
  type V3 = [number, number, number]
  async function build(size: { w: number; h: number; d: number }, params: Record<string, number>): Promise<{ bytes: Uint8Array; sha256: string; tris: number; verts: V3[] }> {
    const plan = { id: `c2-${count}`, kind: 'device', shape: 'cable-assembly-v2', sizeMm: size, params }
    const r = await buildPlanRaw(BLENDER as string, dir, `b${count++}`, plan)
    const doc = await new NodeIO().readBinary(r.bytes)
    const seen = new Set<string>()
    const verts: V3[] = []
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')!
        for (let i = 0; i < pos.getCount(); i++) {
          const v = pos.getElement(i, [0, 0, 0]) as V3
          const key = v.map((c) => Math.round(c * 1e7)).join(',')
          if (!seen.has(key)) {
            seen.add(key)
            verts.push(v)
          }
        }
      }
    }
    return { bytes: r.bytes, sha256: r.sha256, tris: (await inspectGlb(r.bytes)).triangles, verts }
  }
  const extent = (verts: V3[], k: 0 | 1 | 2): [number, number] => [Math.min(...verts.map((v) => v[k])) / MM, Math.max(...verts.map((v) => v[k])) / MM]

  it.skipIf(!BLENDER)('end kinds render: every kind builds as an end A and as an end B at its natural size, the exact depth, centred, bottom at 0, a few hundred triangles', async () => {
    const shas = new Set<string>()
    for (const code of CODES) {
      for (const params of [{ endA: code, endB: 1 }, { endA: 2, endB: code }]) {
        const size = sizeOf(params, 300)
        const { verts, tris, sha256 } = await build(size, params)
        expect(extent(verts, 2)[1] - extent(verts, 2)[0], `${CABLE_END_KINDS[code].name} ${JSON.stringify(params)} depth`).toBeCloseTo(300, 2)
        expect(extent(verts, 0)[1] - extent(verts, 0)[0]).toBeCloseTo(size.w, 2)
        expect(extent(verts, 1)[1] - extent(verts, 1)[0]).toBeCloseTo(size.h, 2)
        expect(extent(verts, 1)[0]).toBeCloseTo(0, 3)
        expect(extent(verts, 0)[0] + extent(verts, 0)[1]).toBeCloseTo(0, 2)
        expect(tris).toBeGreaterThan(100)
        expect(tris).toBeLessThanOrEqual(2000)
        shas.add(sha256)
      }
    }
    // 14 kinds x 2 ends, with (1, 1) and (2, 2) and the mirrored pairs the same file only where the pair is the same
    expect(shas.size).toBeGreaterThanOrEqual(26)
  }, 600_000)

  it.skipIf(!BLENDER)('a male XLR end has gold pins 1.1 mm across, a female end sockets 1.4 mm across; the plugs sit at the right ends', async () => {
    const male = await build(sizeOf({ endA: 1, endB: 2 }, 300), { endA: 1, endB: 2 })
    // end A (male) at +z: the studs on the tip face, 1.1 mm radius, around the pin positions (-4.05, 0), (4.05, 0), (0, -3.95) from the axis (y = 11)
    const tipA = male.verts.filter((v) => v[2] / MM > 150 - 0.31 && Math.hypot(v[0] / MM - 4.05, v[1] / MM - 11) < 1.5)
    expect(Math.max(...tipA.map((v) => Math.hypot(v[0] / MM - 4.05, v[1] / MM - 11)))).toBeCloseTo(1.1, 1)
    // end B (female) at -z: the sockets 1.4 mm across
    const tipB = male.verts.filter((v) => v[2] / MM < -150 + 0.31 && Math.hypot(v[0] / MM - 4.05, v[1] / MM - 11) < 1.9)
    expect(Math.max(...tipB.map((v) => Math.hypot(v[0] / MM - 4.05, v[1] / MM - 11)))).toBeCloseTo(1.4, 1)
    // a shell 19.2 mm across at the A end, the boot 22 mm across
    const shell = male.verts.filter((v) => v[2] / MM > 150 - 25 && v[1] / MM < 11)
    expect(Math.max(...shell.map((v) => Math.hypot(v[0] / MM, v[1] / MM - 11)))).toBeCloseTo(9.6, 1)
  }, 240_000)

  it.skipIf(!BLENDER)('the snake: a D-sub hood at A and a 4 x 2 grid of XLR plugs on a 24 mm pitch at B, tails and trunk between them, inside the cable class', async () => {
    const size = sizeOf(SNAKE, 500)
    const { verts, tris } = await build(size, SNAKE)
    expect(size).toEqual({ w: 94, h: 46, d: 500 })
    expect(extent(verts, 2)[1] - extent(verts, 2)[0]).toBeCloseTo(500, 2)
    // the 8 plug tips at -z: the shell face of every plug lies in the tip plane, so it spans the whole grid (3 x 24 pitch + the 19.2 mm shell)
    const tip = verts.filter((v) => v[2] / MM < -250 + 0.31)
    expect(extent(tip, 0)[1] - extent(tip, 0)[0]).toBeCloseTo(3 * 24 + 19.2, 1)
    const columns = new Set(tip.map((v) => Math.round(v[0] / MM / 12)))
    expect(columns.size).toBeGreaterThanOrEqual(8)
    // the D-sub nose at +z is 53 mm wide, 12.5 high
    const nose = verts.filter((v) => v[2] / MM > 250 - 0.01)
    expect(extent(nose, 0)[1] - extent(nose, 0)[0]).toBeCloseTo(53, 1)
    expect(extent(nose, 1)[1] - extent(nose, 1)[0]).toBeCloseTo(12.5, 1)
    expect(tris).toBeGreaterThan(500)
    expect(tris).toBeLessThanOrEqual(4000)
  }, 240_000)

  it.skipIf(!BLENDER)('refuses a size that is not the natural one, a depth too short, an unknown kind and a missing end with a one-line message', async () => {
    const bad = async (size: { w: number; h: number; d: number }, params: Record<string, number>): Promise<string> => build(size, params).then(() => 'built', (e: Error) => e.message)
    expect(await bad({ w: 30, h: 22, d: 300 }, XLR_CABLE)).toMatch(/the cable's width is 22.0 mm .* the spec size says 30.0 mm/)
    expect(await bad({ w: 22, h: 22, d: 100 }, XLR_CABLE)).toMatch(/depth 100.0 mm is too short for these ends: at least 154.0 mm/)
    expect(await bad({ w: 22, h: 22, d: 300 }, { endA: 2, endB: 99 })).toMatch(/endB must be a whole number from 1 to 14/)
    expect(await bad({ w: 22, h: 22, d: 300 }, { endA: 2 })).toMatch(/needs params.endB/)
    expect(await bad({ w: 22, h: 22, d: 300 }, { ...XLR_CABLE, tailLenMm: 50 })).toMatch(/tailLenMm has no effect without a fan-out/)
  }, 240_000)

  it.skipIf(!BLENDER)('deterministic: twelve parallel builds of a mic cable, an ethercon to RJ45 cable and the snake are byte-identical', async () => {
    for (const [params, d] of [[XLR_CABLE, 300], [{ endA: 7, endB: 8 }, 280], [SNAKE, 500]] as const) {
      const runs = await Promise.all(Array.from({ length: 12 }, () => build(sizeOf(params, d), params)))
      expect(new Set(runs.map((r) => r.sha256)).size).toBe(1)
    }
  }, 600_000)

  it.skipIf(!BLENDER)('builds from a spec through the real gates with a port at each plug tip (portSurface within 0.5 mm), and the old Mogami loom keeps its shape and bytes', async () => {
    const params = { endA: 2, endB: 1 }
    const size = sizeOf(params, 300)
    const ports = [
      { portId: 'end-a', face: 'io' as const, xMm: 11, yMm: 11, confidence: 'guess' as const },
      { portId: 'end-b', face: 'opposite' as const, xMm: 11, yMm: 11, confidence: 'guess' as const },
    ]
    const s = AssetSpec.parse(spec('cable-gates', size, params, { ports, build: { shape: 'cable-assembly-v2', params, budget: { min: 100, max: 2000 } } }))
    const cat = { devices: [{ id: s.id, ports: ports.map((p) => ({ portId: p.portId })), controls: [] }] }
    const report = await buildAsset(s.id, { maxAttempts: 1, scripted: true, dryRun: true }, {
      loadSpec: () => s,
      loadCatalog: () => cat as never,
      paths: { assetsDir: join(dir, 'assets'), sourceDir: join(dir, 'source'), manifestPath: join(dir, 'manifest.json') },
      log: () => undefined,
      renderSheet: null,
    })
    const gates = report.attempts[report.attempts.length - 1].gates
    expect(report.error).toBeUndefined()
    expect(gates.filter((g) => !g.ok)).toEqual([])
    expect(gates.map((g) => g.gate)).toEqual(expect.arrayContaining(['size', 'portSurface', 'detail']))
    // the old shape: the committed Mogami loom plan builds to its pinned bytes
    const pins = JSON.parse(await readFile(new URL('./fixtures/builder-pins-wave2.json', import.meta.url), 'utf8')) as Record<string, { sha256?: string; plan: { shape: string } }>
    const [id, pin] = Object.entries(pins).find(([, p]) => p.plan.shape === 'cable-assembly') as [string, { sha256?: string; plan: unknown }]
    expect(pin.sha256, id).toBeDefined()
    expect((await buildPlanRaw(BLENDER as string, dir, 'mogami', pin.plan)).sha256).toBe(pin.sha256)
  }, 300_000)
})
