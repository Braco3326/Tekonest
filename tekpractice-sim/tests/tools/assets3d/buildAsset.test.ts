/**
 * Tests for assets3d/build-asset (the orchestrator) and compress. Everything runs in temp dirs through deps.paths and
 * injected fakes: a fake Meshy, a stubbed Blender fix-up (it writes a prepared "fixed" GLB), and either the real Draco
 * compressor or a stub. The real public/assets and ASSET_MANIFEST.json are never touched.
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildAsset, formatReport, isMainModule, main, PILOT_IDS, readPhotosFrom, shipRun, targetPolycount } from '../../../tools/assets3d/build-asset'
import type { BuildDeps, BuildReport } from '../../../tools/assets3d/build-asset'
import { dracoCompress, optimizeTextures } from '../../../tools/assets3d/compress'
import { inspectGlb } from '../../../tools/assets3d/inspect'
import { liftChannel } from '../../../tools/assets3d/look'
import { MeshyError } from '../../../tools/assets3d/meshy'
import type { MeshyTask } from '../../../tools/assets3d/meshy'
import { buildPlacement } from '../../../tools/assets3d/placement'
import type { FixupReport } from '../../../tools/assets3d/runFixup'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'
import type { CatalogT } from '../../../tools/schemas'
import { boxGeometry, makeBoxGlb, makeMeshGlb } from './helpers'
import type { MakeMeshGlbOpts } from './helpers'

const FAKE_KEY = 'msy_FAKE_KEY_do_not_leak_0123456789'

function deviceSpec(over: Partial<AssetSpecT> = {}): AssetSpecT {
  return {
    id: 'test-mixer',
    kind: 'device',
    tier: 'standard',
    realSizeMm: { w: 100, h: 50, d: 200 },
    ports: [{ portId: 'in-mic-1', face: 'io', xMm: 20, yMm: 25, confidence: 'manual' }],
    controls: [{ controlId: 'gain', kind: 'knob', face: 'top', xMm: 30, yMm: 100, axis: 'y', sizeMm: { w: 10, h: 10, d: 10 } }],
    sources: [{ kind: 'datasheet', url: 'https://example.com/mixer.pdf', note: 'manual' }],
    ...over,
  }
}

function connectorSpec(over: Partial<AssetSpecT> = {}): AssetSpecT {
  return {
    id: 'test-jack',
    kind: 'connector',
    tier: 'connector',
    realSizeMm: { w: 6, h: 6, d: 20 },
    ports: [],
    controls: [],
    mating: { role: 'plug', outerMm: 3.4 },
    sources: [],
    ...over,
  }
}

/** A fixed (post Blender) GLB that clears every gate for `spec`. `shiftXM` moves a connector body sideways. */
async function goodGlb(spec: AssetSpecT, shiftXM = 0, texture?: MakeMeshGlbOpts['texture']): Promise<Uint8Array> {
  const placement = buildPlacement(spec)
  if (spec.kind === 'connector') {
    return makeBoxGlb({ sizeM: placement.sizeM, texture, meshOnChild: { pos: [shiftXM, -placement.sizeM.h / 2, placement.sizeM.d / 2] } })
  }
  const nodes = [...placement.ports.map((p) => ({ name: p.name, pos: p.pos })), ...placement.controls.map((c) => ({ name: c.name, pos: c.pos }))]
  return makeBoxGlb({ sizeM: placement.sizeM, nodes, texture })
}

/** A device GLB 3 mm too tall: the size gate fails. */
async function tallGlb(spec: AssetSpecT): Promise<Uint8Array> {
  const placement = buildPlacement(spec)
  const nodes = [...placement.ports.map((p) => ({ name: p.name, pos: p.pos })), ...placement.controls.map((c) => ({ name: c.name, pos: c.pos }))]
  return makeBoxGlb({ sizeM: { ...placement.sizeM, h: placement.sizeM.h + 0.003 }, nodes })
}

const FIXUP_OK: FixupReport = { preScaleSizeM: { w: 10, h: 5, d: 20 }, scaleApplied: [0.01, 0.01, 0.01], rotatedDegrees: 0 }
/** A Meshy model whose proportions are off (h twice too tall): only proportionDrift fails, a retryable failure. */
const FIXUP_DRIFT: FixupReport = { ...FIXUP_OK, preScaleSizeM: { w: 10, h: 10, d: 20 } }

/** A device GLB that passes every gate but has 12 + 4000 triangles: only the budget gate fails (retryable). */
async function heavyGlb(spec: AssetSpecT): Promise<Uint8Array> {
  const placement = buildPlacement(spec)
  const nodes = [...placement.ports.map((p) => ({ name: p.name, pos: p.pos })), ...placement.controls.map((c) => ({ name: c.name, pos: c.pos }))]
  const inside = [0, placement.sizeM.h / 2, 0]
  const filler = { positions: Array.from({ length: 4000 * 3 }, () => inside).flat() }
  return makeMeshGlb({ prims: [boxGeometry(placement.sizeM), filler], nodes })
}

/** A device GLB whose port node is missing: the parts and portPositions gates fail (a defect of our fix-up). */
async function partlessGlb(spec: AssetSpecT): Promise<Uint8Array> {
  const placement = buildPlacement(spec)
  return makeBoxGlb({ sizeM: placement.sizeM, nodes: placement.controls.map((c) => ({ name: c.name, pos: c.pos })) })
}
const RAW_BYTES = new Uint8Array([103, 108, 84, 70, 1, 2, 3, 4])
const PHOTO_BYTES = new Uint8Array([137, 80, 78, 71, 1, 2, 3])

interface Calls {
  create: { images: string[]; targetPolycount: number; topology?: string }[]
  wait: string[]
  download: string[]
  fixup: { inGlb: string; outGlb: string; yawDeg: number | undefined; flipUpright: boolean | undefined; recess: boolean | undefined; inBytes: Uint8Array }[]
  compress: { bits: number }[]
  optimize: { maxPx: number; dataMaxPx: number | undefined }[]
  /** The order the texture and Draco steps ran in. */
  order: ('optimize' | 'compress')[]
  /** The progress lines buildAsset logged. */
  log: string[]
  sheet: { glb: string; photo: string | null; out: string; specId: string }[]
  /** The scripted builder calls: spec id and the raw GLB path it was asked to write. */
  build: { specId: string; outGlb: string }[]
}

interface Rig {
  spec: AssetSpecT
  /** The fixed GLB the fake fix-up writes for attempt n (the last entry repeats). */
  fixed: Uint8Array[]
  fixupReport?: FixupReport
  /** Per attempt n, the fix-up report (the last entry repeats); wins over fixupReport. */
  fixupReports?: FixupReport[]
  compress?: BuildDeps['compress']
  optimize?: BuildDeps['optimizeTextures']
  createError?: Error
  downloadError?: Error
  credits?: number
  /** The catalog checkSpecParity sees; default: one that matches `spec` exactly. */
  catalog?: CatalogT
  /** The contact sheet renderer; default a recorder, null = no Blender. */
  renderSheet?: BuildDeps['renderSheet']
  /** Runs inside the fake waitForTask, i.e. after the paid create and before the task finishes. */
  onWait?: (id: string) => void
}

let root: string
let paths: { assetsDir: string; sourceDir: string; manifestPath: string }
let calls: Calls
let savedKey: string | undefined

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'tekpractice-build-'))
  paths = { assetsDir: join(root, 'public', 'assets'), sourceDir: join(root, 'assets-source'), manifestPath: join(root, 'public', 'assets', 'ASSET_MANIFEST.json') }
  await mkdir(paths.assetsDir, { recursive: true })
  await writeFile(
    paths.manifestPath,
    JSON.stringify({ generated: 'g', assets: [{ id: 'other', status: 'ok', tris: 7 }, { id: 'test-mixer', kind: 'device', optimized: true, tris: 5, status: 'ok', reviewer: 'old' }] }, null, 2),
  )
  calls = { create: [], wait: [], download: [], fixup: [], compress: [], optimize: [], order: [], log: [], sheet: [], build: [] }
  savedKey = process.env.MESHY_API_KEY
})
afterEach(async () => {
  if (savedKey === undefined) delete process.env.MESHY_API_KEY
  else process.env.MESHY_API_KEY = savedKey
  await rm(root, { recursive: true, force: true })
})

/** Writes reference photos so the default readPhotos finds them. */
async function addPhotos(id: string, names: string[]): Promise<void> {
  const dir = join(paths.sourceDir, id, 'photos')
  await mkdir(dir, { recursive: true })
  for (const n of names) await writeFile(join(dir, n), PHOTO_BYTES)
}

function makeDeps(rig: Rig): Partial<BuildDeps> {
  let attempt = 0
  return {
    meshy: {
      createMultiImageTask: async (images, opts) => {
        calls.create.push({ images, targetPolycount: opts.targetPolycount, topology: opts.topology })
        if (rig.createError) throw rig.createError
        return `task-${calls.create.length}`
      },
      waitForTask: async (id, onProgress): Promise<MeshyTask> => {
        calls.wait.push(id)
        rig.onWait?.(id)
        onProgress?.({ id, status: 'IN_PROGRESS', progress: 40 })
        onProgress?.({ id, status: 'IN_PROGRESS', progress: 40 })
        onProgress?.({ id, status: 'SUCCEEDED', progress: 100 })
        return { id, status: 'SUCCEEDED', progress: 100, consumed_credits: rig.credits ?? 20, model_urls: { glb: 'https://assets.example/x.glb' } }
      },
      downloadGlb: async (task) => {
        calls.download.push(task.id)
        if (rig.downloadError) throw rig.downloadError
        return RAW_BYTES
      },
    },
    runFixup: async (inGlb, outGlb, _spec, opts) => {
      calls.fixup.push({ inGlb, outGlb, yawDeg: opts?.yawDeg, flipUpright: opts?.flipUpright, recess: opts?.recess, inBytes: new Uint8Array(await readFile(inGlb)) })
      const bytes = rig.fixed[Math.min(attempt, rig.fixed.length - 1)]
      const report = rig.fixupReports ? rig.fixupReports[Math.min(attempt, rig.fixupReports.length - 1)] : (rig.fixupReport ?? FIXUP_OK)
      attempt++
      await writeFile(outGlb, bytes)
      return report
    },
    runBuilder: async (spec, outGlb) => {
      calls.build.push({ specId: spec.id, outGlb })
      await writeFile(outGlb, RAW_BYTES)
    },
    compress:
      rig.compress ??
      (async (bytes, opts) => {
        calls.order.push('compress')
        calls.compress.push({ bits: opts.quantizePositionBits })
        return dracoCompress(bytes, opts)
      }),
    optimizeTextures:
      rig.optimize ??
      (async (bytes, opts) => {
        calls.order.push('optimize')
        calls.optimize.push({ maxPx: opts.maxPx, dataMaxPx: opts.dataMaxPx })
        return optimizeTextures(bytes, opts)
      }),
    loadCatalog: () => rig.catalog ?? catalogFor(rig.spec),
    loadSpec: (id) => {
      if (id !== rig.spec.id) throw new Error(`no asset spec "${id}"`)
      return rig.spec
    },
    paths,
    now: () => new Date('2026-10-29T12:00:00.000Z'),
    log: (line) => calls.log.push(line),
    renderSheet:
      rig.renderSheet !== undefined
        ? rig.renderSheet
        : async (glb, photo, out, spec) => {
            calls.sheet.push({ glb, photo, out, specId: spec.id })
          },
  }
}

/** The smallest catalog checkSpecParity accepts for `spec` (only the fields it reads). */
function catalogFor(spec: AssetSpecT): CatalogT {
  const device = { id: spec.id, ports: spec.ports.map((p) => ({ portId: p.portId })), controls: spec.controls.map((c) => ({ id: c.controlId })) }
  return { devices: spec.kind === 'device' ? [device] : [], connectorTypes: spec.kind === 'connector' ? [{ id: spec.id }] : [] } as unknown as CatalogT
}

async function readManifest(): Promise<{ assets: Record<string, unknown>[] }> {
  return JSON.parse(await readFile(paths.manifestPath, 'utf8'))
}

describe('buildAsset', () => {
  it('a passing attempt copies the GLB, records the manifest entry with logosRemoved true and the gates', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['b.png', 'a.png'])
    const fixed = await goodGlb(spec)
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [fixed] }))

    expect(report.ok).toBe(true)
    expect(report.dryRun).toBe(false)
    expect(report.attempts).toHaveLength(1)
    expect(report.attempts[0]).toMatchObject({ n: 1, credits: 20, compression: 'draco' })
    expect(report.attempts[0].gates.map((g) => g.gate)).toEqual(['size', 'transform', 'parts', 'portPositions', 'budget', 'proportionDrift', 'textures', 'validator'])
    expect(report.attempts[0].gates.every((g) => g.ok)).toBe(true)
    expect(calls.create).toHaveLength(1)
    expect(calls.create[0]).toMatchObject({ targetPolycount: 2800, topology: 'triangle' })
    expect(calls.compress).toEqual([{ bits: 14 }])

    const shipped = join(paths.assetsDir, 'test-mixer.glb')
    expect(report.finalGlb).toBe(shipped)
    const shippedReport = await inspectGlb(new Uint8Array(await readFile(shipped)))
    expect(shippedReport.triangles).toBe(12)
    expect(shippedReport.nodeNames).toContain('port_in-mic-1')

    const manifest = await readManifest()
    expect(manifest.assets).toHaveLength(2)
    const entry = manifest.assets.find((a) => a.id === 'test-mixer')
    expect(entry).toMatchObject({
      id: 'test-mixer',
      status: 'ok',
      reviewer: 'old',
      optimized: true,
      tool: 'meshy',
      toolVersion: 'meshy-7.1',
      date: '2026-10-29T12:00:00.000Z',
      specSource: 'https://example.com/mixer.pdf',
      logosRemoved: true,
      photos: ['a.png', 'b.png'],
      taskId: 'task-1',
      tris: 12,
    })
    expect(entry?.gates).toEqual(report.attempts[0].gates.map((g) => ({ gate: g.gate, ok: g.ok })))
    expect(manifest.assets.find((a) => a.id === 'other')).toEqual({ id: 'other', status: 'ok', tris: 7 })
  })

  it('sends the photos sorted by name, at most four, as data URIs with the right mime', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['e.webp', 'c.jpg', 'a.png', 'd.jpeg', 'b.png', 'notes.txt'])
    await buildAsset(spec.id, { maxAttempts: 1, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))
    const images = calls.create[0].images
    expect(images).toHaveLength(4)
    const b64 = Buffer.from(PHOTO_BYTES).toString('base64')
    expect(images).toEqual([`data:image/png;base64,${b64}`, `data:image/png;base64,${b64}`, `data:image/jpeg;base64,${b64}`, `data:image/jpeg;base64,${b64}`])
  })

  it('asks Meshy for triangles: 70 % of the tier ceiling minus 100 per port with an opening, never under 100', async () => {
    const withOpenings = (n: number): AssetSpecT['ports'] =>
      Array.from({ length: n }, (_, i) => ({ portId: `p${i}`, face: 'io' as const, xMm: 10 + i, yMm: 25, confidence: 'manual' as const, openingMm: 3 }))
    const cases: [AssetSpecT, number][] = [
      [connectorSpec(), 560], // floor(0.7 * 800)
      [deviceSpec({ id: 'test-hero', tier: 'hero' }), 10500], // floor(0.7 * 15000), the one port has no opening
      [deviceSpec({ id: 'test-ql', tier: 'hero', ports: withOpenings(5) }), 10000], // 10500 - 5 recesses
      [deviceSpec({ id: 'test-many', ports: withOpenings(40) }), 100], // floor (standard tier: 2800 - 40 recesses)
    ]
    for (const [spec, expected] of cases) {
      expect(targetPolycount(spec)).toBe(expected)
    }
    for (const [spec, expected] of cases.slice(0, 2)) {
      calls.create.length = 0
      await addPhotos(spec.id, ['a.png'])
      await buildAsset(spec.id, { maxAttempts: 1, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))
      expect(calls.create[0]).toMatchObject({ targetPolycount: expected, topology: 'triangle' })
    }
  })

  it('the requested target plus the recesses stays under the triangle ceiling for every pilot spec', async () => {
    const { loadSpecs } = await import('../../../tools/assets3d/loadSpecs')
    const { TRIANGLE_CEILING } = await import('../../../tools/assets3d/gates')
    const specs = loadSpecs()
    expect(specs.length).toBeGreaterThan(0)
    for (const spec of specs) {
      const recesses = spec.ports.filter((p) => p.openingMm !== undefined).length
      expect(targetPolycount(spec) + 100 * recesses, spec.id).toBeLessThanOrEqual(TRIANGLE_CEILING[spec.tier])
    }
  })

  it('saves the raw bytes and the fixed GLB of every attempt under work/ and passes the yaw to the fix-up', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const report = await buildAsset(spec.id, { maxAttempts: 2, yawDeg: 180, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReports: [FIXUP_DRIFT, FIXUP_OK] }))
    const work = join(paths.sourceDir, spec.id, 'work', '2026-10-29T12-00-00-000Z')
    expect(report.workDir).toBe(work)
    expect((await readdir(work)).sort()).toEqual(['attempt-1.fixed.glb', 'attempt-1.raw.glb', 'attempt-2.fixed.glb', 'attempt-2.raw.glb', 'final.glb', 'report.json'])
    expect(new Uint8Array(await readFile(join(work, 'attempt-1.raw.glb')))).toEqual(RAW_BYTES)
    expect(calls.fixup.map((c) => c.yawDeg)).toEqual([180, 180])
    expect(calls.fixup[0].inGlb).toBe(join(work, 'attempt-1.raw.glb'))
    expect(calls.fixup[0].outGlb).toBe(join(work, 'attempt-1.fixed.glb'))
  })

  it('a drift-only failure retries up to maxAttempts then leaves public/assets and the manifest untouched', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const manifestBefore = await readFile(paths.manifestPath, 'utf8')
    const filesBefore = await readdir(paths.assetsDir)
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReport: FIXUP_DRIFT }))

    expect(report.ok).toBe(false)
    expect(report.error).toBeUndefined()
    expect(report.finalGlb).toBeUndefined()
    expect(report.attempts).toHaveLength(3)
    expect(calls.create).toHaveLength(3)
    expect(report.attempts.map((a) => a.credits)).toEqual([20, 20, 20])
    for (const a of report.attempts) {
      expect(a.gates.filter((g) => !g.ok).map((g) => g.gate)).toEqual(['proportionDrift'])
      expect(a.compression).toBeUndefined()
    }
    expect(calls.compress).toHaveLength(0)
    expect(await readFile(paths.manifestPath, 'utf8')).toBe(manifestBefore)
    expect(await readdir(paths.assetsDir)).toEqual(filesBefore)
  })

  it('stops at the first passing attempt', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReports: [FIXUP_DRIFT, FIXUP_OK] }))
    expect(report.ok).toBe(true)
    expect(report.attempts.map((a) => a.n)).toEqual([1, 2])
    expect(calls.create).toHaveLength(2)
    expect(existsSync(join(paths.assetsDir, 'test-mixer.glb'))).toBe(true)
  })

  it('proportion drift alone fails an attempt', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const drifted: FixupReport = { ...FIXUP_OK, preScaleSizeM: { w: 10, h: 10, d: 20 } }
    const report = await buildAsset(spec.id, { maxAttempts: 2, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReport: drifted }))
    expect(report.ok).toBe(false)
    expect(report.attempts).toHaveLength(2)
    const failed = report.attempts[0].gates.filter((g) => !g.ok)
    expect(failed.map((g) => g.gate)).toEqual(['proportionDrift'])
    expect(existsSync(join(paths.assetsDir, 'test-mixer.glb'))).toBe(false)
  })

  it('yaw 90 or 270 on a non-square device is refused before any paid call: it swaps width and depth, so the drift gate fails on every attempt', async () => {
    const spec = deviceSpec() // 100 x 50 x 200 mm: w != d
    await addPhotos(spec.id, ['a.png'])
    for (const yawDeg of [90, 270] as const) {
      await expect(buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true, yawDeg }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))).rejects.toThrow(/yaw.*(90|270).*non-square|non-square.*yaw/s)
    }
    expect(calls.create).toHaveLength(0)
    expect(existsSync(join(paths.sourceDir, spec.id, 'work'))).toBe(false)
    // 0 and 180 are fine on any device, and 90 / 270 on a square footprint (w = d) too.
    for (const yawDeg of [0, 180] as const) {
      const report = await buildAsset(spec.id, { maxAttempts: 1, dryRun: true, yawDeg }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))
      expect(report.ok).toBe(true)
    }
    const square = deviceSpec({ realSizeMm: { w: 100, h: 50, d: 100 } })
    await expect(buildAsset(square.id, { maxAttempts: 1, dryRun: true, yawDeg: 90 }, makeDeps({ spec: square, fixed: [await goodGlb(square)], fixupReport: { ...FIXUP_OK, preScaleSizeM: { w: 10, h: 5, d: 10 } } }))).resolves.toMatchObject({ ok: true })
  })

  it('the CLI reports the yaw refusal as an error with exit 1 and no Meshy call', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const out: string[] = []
    expect(await main([spec.id, '--yaw', '90', '--yes'], makeDeps({ spec, fixed: [await goodGlb(spec)] }), (l) => out.push(l))).toBe(1)
    expect(out.join('\n')).toMatch(/non-square/)
    expect(calls.create).toHaveLength(0)
  })

  it('adds a portSurface gate when the fix-up measured the ports; a port floating in front of a recessed panel is a model property: retried', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const flush = { ...FIXUP_OK, portSurface: [{ name: 'port_in-mic-1', offsetM: 0 }] }
    const floating = { ...FIXUP_OK, portSurface: [{ name: 'port_in-mic-1', offsetM: 0.011 }] }
    const report = await buildAsset(spec.id, { maxAttempts: 3, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReports: [floating, flush] }))
    expect(calls.create).toHaveLength(2)
    expect(report.attempts[0].gates.filter((g) => !g.ok).map((g) => g.gate)).toEqual(['portSurface'])
    expect(report.attempts[0].gates.find((g) => g.gate === 'portSurface')?.detail).toMatch(/port_in-mic-1.*11\.00 mm behind/)
    expect(report.ok).toBe(true)
    expect(report.attempts[1].gates.map((g) => g.gate)).toContain('portSurface')
    expect(report.attempts[1].gates.every((g) => g.ok)).toBe(true)
  })

  it('a material-count failure is not a Meshy property: it aborts after ONE create, no retry', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const placement = buildPlacement(spec)
    const nodes = [...placement.ports.map((p) => ({ name: p.name, pos: p.pos })), ...placement.controls.map((c) => ({ name: c.name, pos: c.pos }))]
    const two = await makeMeshGlb({ prims: [boxGeometry(placement.sizeM), boxGeometry({ w: 0.01, h: 0.01, d: 0.01 })], nodes, separateMaterials: true })
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [two, await goodGlb(spec)] }))
    expect(calls.create).toHaveLength(1)
    expect(report.attempts).toHaveLength(1)
    expect(report.ok).toBe(false)
    expect(report.attempts[0].gates.find((g) => g.gate === 'budget')?.detail).toMatch(/2 materials/)
    expect(report.error).toMatch(/gate budget failed.*no further task bought/)
  })

  it('a budget-only failure retries (a Meshy model property), then passes on a lighter model', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await heavyGlb(spec), await goodGlb(spec)] }))
    expect(calls.create).toHaveLength(2)
    expect(report.attempts[0].gates.filter((g) => !g.ok).map((g) => g.gate)).toEqual(['budget'])
    expect(report.attempts[0].gates.find((g) => g.gate === 'budget')?.detail).toMatch(/4012 triangles/)
    expect(report.ok).toBe(true)
    expect(report.error).toBeUndefined()
  })

  it.each([
    ['size', 'tallGlb'],
    ['parts, portPositions', 'partlessGlb'],
  ] as const)('a %s failure (our fix-up) aborts after ONE create, naming the gates and the work dir', async (names, which) => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const fixed = which === 'tallGlb' ? await tallGlb(spec) : await partlessGlb(spec)
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [fixed] }))
    expect(calls.create).toHaveLength(1)
    expect(report.attempts).toHaveLength(1)
    expect(report.ok).toBe(false)
    expect(report.error).toContain(`gate${names.includes(',') ? 's' : ''} ${names} failed`)
    expect(report.error).toContain(report.workDir)
    expect(report.error).toMatch(/no further task bought/)
    expect(calls.compress).toHaveLength(0)
    expect(existsSync(join(report.workDir, 'attempt-1.raw.glb'))).toBe(true)
  })

  it('a transform failure aborts after one create too', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const placement = buildPlacement(spec)
    const nodes = [...placement.ports.map((p) => ({ name: p.name, pos: p.pos })), ...placement.controls.map((c) => ({ name: c.name, pos: c.pos }))]
    const scaled = await makeBoxGlb({ sizeM: { w: placement.sizeM.w * 2, h: placement.sizeM.h * 2, d: placement.sizeM.d * 2 }, nodes, scale: 0.5 })
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [scaled] }))
    expect(calls.create).toHaveLength(1)
    expect(report.attempts[0].gates.filter((g) => !g.ok).map((g) => g.gate)).toContain('transform')
    expect(report.error).toMatch(/transform/)
  })

  it('mixed drift + parts failures abort (the parts failure is ours, a new task cannot fix it)', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await partlessGlb(spec)], fixupReport: FIXUP_DRIFT }))
    expect(calls.create).toHaveLength(1)
    expect(report.attempts).toHaveLength(1)
    expect(report.attempts[0].gates.filter((g) => !g.ok).map((g) => g.gate)).toEqual(['parts', 'portPositions', 'proportionDrift'])
    expect(report.error).toContain('gates parts, portPositions, proportionDrift failed')
  })

  it('compression that shifts a 6 mm connector past tolerance falls back to the uncompressed GLB and records compression none', async () => {
    const spec = connectorSpec()
    await addPhotos(spec.id, ['a.png'])
    const fixed = await goodGlb(spec)
    const shifted = await goodGlb(spec, 0.0006)
    const compress: BuildDeps['compress'] = async (_bytes, opts) => {
      calls.compress.push({ bits: opts.quantizePositionBits })
      return shifted
    }
    const report = await buildAsset(spec.id, { maxAttempts: 1, logosRemoved: true }, makeDeps({ spec, fixed: [fixed], compress, fixupReport: { ...FIXUP_OK, preScaleSizeM: { w: 6, h: 6, d: 20 } } }))

    expect(calls.compress).toEqual([{ bits: 16 }])
    expect(report.ok).toBe(true)
    expect(report.attempts[0].compression).toBe('none')
    expect(report.attempts[0].gates.every((g) => g.ok)).toBe(true)
    expect(new Uint8Array(await readFile(join(paths.assetsDir, 'test-jack.glb')))).toEqual(fixed)
    const manifest = await readManifest()
    expect(manifest.assets.find((a) => a.id === 'test-jack')).toMatchObject({ id: 'test-jack', kind: 'connector', status: 'ok', specSource: 'spec', logosRemoved: true })
  })

  it('a compression failure on a device tier is our defect: it aborts after ONE create and keeps the final bytes', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const bad = await tallGlb(spec)
    const compress: BuildDeps['compress'] = async (_bytes, opts) => {
      calls.compress.push({ bits: opts.quantizePositionBits })
      return bad
    }
    const report = await buildAsset(spec.id, { maxAttempts: 2, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], compress }))

    expect(report.ok).toBe(false)
    expect(report.attempts).toHaveLength(1)
    expect(calls.create).toHaveLength(1)
    expect(report.error).toMatch(/final bytes: gate size failed/)
    expect(report.error).toContain(report.workDir)
    const size = report.attempts[0].gates.find((g) => g.gate === 'size')
    expect(size?.ok).toBe(false)
    expect(size?.detail).toMatch(/after Draco/)
    expect(report.attempts[0].compression).toBeUndefined()
    expect(new Uint8Array(await readFile(join(report.workDir, 'attempt-1.final.glb')))).toEqual(bad)
    expect(existsSync(join(paths.assetsDir, 'test-mixer.glb'))).toBe(false)
    expect((await readManifest()).assets.find((a) => a.id === 'test-mixer')).not.toHaveProperty('tool')
  })

  it('the report has credits per attempt and no secret', async () => {
    process.env.MESHY_API_KEY = FAKE_KEY
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const report = await buildAsset(spec.id, { maxAttempts: 2, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReports: [FIXUP_DRIFT, FIXUP_OK], credits: 35 }))
    expect(report.attempts.map((a) => a.credits)).toEqual([35, 35])
    expect(JSON.stringify(report)).not.toContain(FAKE_KEY)
    const onDisk = await readFile(join(paths.sourceDir, spec.id, 'report.json'), 'utf8')
    expect(onDisk).not.toContain(FAKE_KEY)
    expect(JSON.parse(onDisk)).toEqual(JSON.parse(JSON.stringify(report)))
  })

  it('scrubs the key from an error that carries it', async () => {
    process.env.MESHY_API_KEY = FAKE_KEY
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const downloadError = new MeshyError(0, `download failed for Bearer ${FAKE_KEY}`)
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], downloadError }))
    expect(report.ok).toBe(false)
    expect(report.error).toContain('download failed')
    expect(JSON.stringify(report)).not.toContain(FAKE_KEY)
    expect(await readFile(join(paths.sourceDir, spec.id, 'report.json'), 'utf8')).not.toContain(FAKE_KEY)
    // a thrown error is not retried: the task was already paid for
    expect(calls.create).toHaveLength(1)
  })

  it('--raw performs zero Meshy calls', async () => {
    const spec = deviceSpec()
    const rawPath = join(root, 'hand-made.glb')
    await writeFile(rawPath, RAW_BYTES)
    const report = await buildAsset(spec.id, { maxAttempts: 3, rawGlb: rawPath, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))
    expect(calls.create).toHaveLength(0)
    expect(calls.wait).toHaveLength(0)
    expect(calls.download).toHaveLength(0)
    expect(report.ok).toBe(true)
    expect(report.attempts).toHaveLength(1)
    expect(report.attempts[0].credits).toBeNull()
    expect(new Uint8Array(await readFile(join(report.workDir, 'attempt-1.raw.glb')))).toEqual(RAW_BYTES)
    const entry = (await readManifest()).assets.find((a) => a.id === 'test-mixer')
    expect(entry).toMatchObject({ tool: 'raw', toolVersion: 'raw', logosRemoved: true, photos: [], taskId: null })
  })

  it('--raw with rawTaskId (a Meshy GLB downloaded by hand) records Meshy provenance and the task id, and still makes zero Meshy calls', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const rawPath = join(root, 'meshy-by-hand.glb')
    await writeFile(rawPath, RAW_BYTES)
    const report = await buildAsset(spec.id, { maxAttempts: 1, rawGlb: rawPath, rawTaskId: 'task-abc', logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))
    expect(calls.create).toHaveLength(0)
    expect(report.ok).toBe(true)
    expect(report.attempts[0].taskId).toBe('task-abc')
    const entry = (await readManifest()).assets.find((a) => a.id === 'test-mixer')
    expect(entry).toMatchObject({ tool: 'meshy', toolVersion: 'meshy-7.1', taskId: 'task-abc', photos: ['a.png'] })
  })

  it('--raw with slab turns a thin Meshy panel upright before the fix-up sees it (thin axis to depth, spec depth proportion)', async () => {
    const spec = deviceSpec() // 100 x 50 x 200 mm
    const rawPath = join(root, 'slab.glb')
    // a slab: x 0.30, y 0.02 (thin), z 0.10
    await writeFile(rawPath, await makeBoxGlb({ sizeM: { w: 0.3, h: 0.02, d: 0.1 } }))
    await buildAsset(spec.id, { maxAttempts: 1, rawGlb: rawPath, slab: true, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))
    expect(calls.fixup).toHaveLength(1)
    const r = await inspectGlb(calls.fixup[0].inBytes)
    const e = r.bboxM.max.map((v, i) => +(v - r.bboxM.min[i]).toFixed(4))
    expect(e).toEqual([0.3, 0.1, 0.6]) // x the largest, y the middle, z = 0.3 x 200 / 100
  })

  it('--raw without slab hands the fix-up the raw bytes untouched', async () => {
    const spec = deviceSpec()
    const rawPath = join(root, 'plain.glb')
    await writeFile(rawPath, RAW_BYTES)
    await buildAsset(spec.id, { maxAttempts: 1, rawGlb: rawPath, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], renderSheet: null }))
    expect(calls.fixup[0].inBytes).toEqual(RAW_BYTES)
  })

  it('--raw makes only one attempt even when it fails', async () => {
    const spec = deviceSpec()
    const rawPath = join(root, 'hand-made.glb')
    await writeFile(rawPath, RAW_BYTES)
    const report = await buildAsset(spec.id, { maxAttempts: 3, rawGlb: rawPath, logosRemoved: true }, makeDeps({ spec, fixed: [await tallGlb(spec)] }))
    expect(report.ok).toBe(false)
    expect(report.attempts).toHaveLength(1)
    expect(calls.fixup).toHaveLength(1)
  })

  it('the same raw GLB and spec give byte-identical output and an identical report twice', async () => {
    const spec = deviceSpec()
    const rawPath = join(root, 'hand-made.glb')
    await writeFile(rawPath, RAW_BYTES)
    const fixed = await goodGlb(spec)
    const run = async (): Promise<{ glb: Uint8Array; report: BuildReport; reportFile: string; manifest: string }> => {
      const report = await buildAsset(spec.id, { maxAttempts: 1, rawGlb: rawPath, logosRemoved: true }, makeDeps({ spec, fixed: [fixed] }))
      return {
        glb: new Uint8Array(await readFile(join(paths.assetsDir, 'test-mixer.glb'))),
        report,
        reportFile: await readFile(join(paths.sourceDir, spec.id, 'report.json'), 'utf8'),
        manifest: await readFile(paths.manifestPath, 'utf8'),
      }
    }
    const first = await run()
    const second = await run()
    expect(first.report.attempts[0].compression).toBe('draco')
    expect(second.glb).toEqual(first.glb)
    expect(second.report).toEqual(first.report)
    expect(second.reportFile).toBe(first.reportFile)
    expect(second.manifest).toBe(first.manifest)
  })

  it('a 402 aborts after the first attempt with the message', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const createError = new MeshyError(402, 'Meshy request failed with HTTP 402: insufficient credits, top up the API balance')
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], createError }))
    expect(calls.create).toHaveLength(1)
    expect(report.ok).toBe(false)
    expect(report.attempts).toHaveLength(1)
    expect(report.attempts[0].credits).toBeNull()
    expect(report.error).toContain('insufficient credits')
    expect(report.stopped).toBe('meshy-402')
    expect(existsSync(join(paths.assetsDir, 'test-mixer.glb'))).toBe(false)
  })

  it('a 429 aborts immediately too', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const createError = new MeshyError(429, 'Meshy request failed with HTTP 429: slow down')
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], createError }))
    expect(calls.create).toHaveLength(1)
    expect(report.stopped).toBe('meshy-429')
  })

  it('no photos -> clear error and zero Meshy calls', async () => {
    const spec = deviceSpec()
    await expect(buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))).rejects.toThrow(/no photos/i)
    await mkdir(join(paths.sourceDir, spec.id, 'photos'), { recursive: true })
    await writeFile(join(paths.sourceDir, spec.id, 'photos', 'readme.txt'), 'not an image')
    await expect(buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))).rejects.toThrow(/no photos/i)
    expect(calls.create).toHaveLength(0)
    expect(calls.fixup).toHaveLength(0)
  })

  it('an unknown spec id throws before anything runs', async () => {
    const spec = deviceSpec()
    await expect(buildAsset('nope', { maxAttempts: 1, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))).rejects.toThrow(/no asset spec "nope"/)
    expect(calls.create).toHaveLength(0)
  })

  it('a failing fix-up (Blender error) aborts without a second paid attempt', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)] })
    deps.runFixup = async () => {
      throw new Error('Blender fix-up of test-mixer failed (exit 1): FIXUP_FAIL no mesh')
    }
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, deps)
    expect(report.ok).toBe(false)
    expect(report.error).toContain('FIXUP_FAIL no mesh')
    expect(calls.create).toHaveLength(1)
    expect(report.attempts).toHaveLength(1)
    expect(report.attempts[0].credits).toBe(20)
    expect(existsSync(join(report.workDir, 'attempt-1.raw.glb'))).toBe(true)
  })

  it('records the Meshy task id of each attempt in the report', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const report = await buildAsset(spec.id, { maxAttempts: 2, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReports: [FIXUP_DRIFT, FIXUP_OK] }))
    expect(report.attempts.map((a) => a.taskId)).toEqual(['task-1', 'task-2'])
    // the manifest records the task of the SHIPPED attempt
    expect((await readManifest()).assets.find((a) => a.id === 'test-mixer')).toMatchObject({ taskId: 'task-2', photos: ['a.png'] })
    const onDisk = JSON.parse(await readFile(join(paths.sourceDir, spec.id, 'report.json'), 'utf8')) as BuildReport
    expect(onDisk.workDir).toBe(report.workDir)
    expect(onDisk.attempts[0].taskId).toBe('task-1')
  })

  it('prints the task id and the work dir right after the paid create, then one line per distinct poll', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const order: string[] = []
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)], onWait: () => order.push(`wait after ${calls.log.length} log lines`) })
    const report = await buildAsset(spec.id, { maxAttempts: 1, dryRun: true }, deps)
    expect(calls.log[0]).toBe(`task task-1 created, workDir ${report.workDir}`)
    expect(order).toEqual(['wait after 1 log lines'])
    // the same status and percent twice prints once
    expect(calls.log.slice(1).filter((l) => l.startsWith('task '))).toEqual(['task task-1: IN_PROGRESS 40%', 'task task-1: SUCCEEDED 100%'])
  })

  it('the paid task id is on disk in the work dir before the wait (a Ctrl-C keeps it)', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const seen: BuildReport[] = []
    const work = join(paths.sourceDir, spec.id, 'work', '2026-10-29T12-00-00-000Z')
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)], onWait: () => { seen.push(JSON.parse(readFileSync(join(work, 'report.json'), 'utf8')) as BuildReport) } })
    await buildAsset(spec.id, { maxAttempts: 1, dryRun: true }, deps)
    expect(seen).toHaveLength(1)
    expect(seen[0].attempts[0].taskId).toBe('task-1')
    expect(seen[0].workDir).toBe(work)
    expect(JSON.parse(readFileSync(join(paths.sourceDir, spec.id, 'report.json'), 'utf8')).attempts[0].taskId).toBe('task-1')
  })

  it('report.json is rewritten after every step: the fix-up sees the download step, the compress step sees the gates', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const work = join(paths.sourceDir, spec.id, 'work', '2026-10-29T12-00-00-000Z')
    const snapshots: { step: string; report: BuildReport }[] = []
    const snap = (step: string): void => {
      snapshots.push({ step, report: JSON.parse(readFileSync(join(work, 'report.json'), 'utf8')) as BuildReport })
    }
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)], credits: 30 })
    const fix = deps.runFixup as NonNullable<BuildDeps['runFixup']>
    deps.runFixup = async (...args) => {
      snap('fixup')
      return fix(...args)
    }
    deps.optimizeTextures = async (bytes) => {
      snap('textures')
      return bytes
    }
    const report = await buildAsset(spec.id, { maxAttempts: 1, dryRun: true }, deps)
    expect(snapshots[0].report.attempts[0]).toMatchObject({ taskId: 'task-1', credits: 30, gates: [] })
    expect(snapshots[1].report.attempts[0].gates.map((g) => g.gate)).toEqual(['size', 'transform', 'parts', 'portPositions', 'budget', 'proportionDrift'])
    // the work-dir copy and the summary copy end identical to the returned report
    const final = JSON.parse(await readFile(join(work, 'report.json'), 'utf8'))
    expect(final).toEqual(JSON.parse(JSON.stringify(report)))
    expect(JSON.parse(await readFile(join(paths.sourceDir, spec.id, 'report.json'), 'utf8'))).toEqual(final)
  })

  it('keeps the task id when the wait fails after the paid create', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)] })
    deps.meshy = { ...(deps.meshy as NonNullable<BuildDeps['meshy']>), waitForTask: async () => { throw new MeshyError(0, 'Meshy task task-1 timed out') } }
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, deps)
    expect(report.ok).toBe(false)
    expect(report.attempts).toHaveLength(1)
    expect(report.attempts[0].taskId).toBe('task-1')
  })

  it('a rerun writes its own work folder and leaves the earlier paid output alone', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const first = await buildAsset(spec.id, { maxAttempts: 1, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))
    const later = makeDeps({ spec, fixed: [await goodGlb(spec)] })
    later.now = () => new Date('2026-10-30T08:30:00.000Z')
    const second = await buildAsset(spec.id, { maxAttempts: 1, dryRun: true }, later)
    expect(second.workDir).not.toBe(first.workDir)
    expect(second.workDir).toBe(join(paths.sourceDir, spec.id, 'work', '2026-10-30T08-30-00-000Z'))
    expect(existsSync(join(first.workDir, 'attempt-1.raw.glb'))).toBe(true)
    expect(existsSync(join(second.workDir, 'attempt-1.raw.glb'))).toBe(true)
    // the work folder name is valid on Windows
    expect(first.workDir.slice(paths.sourceDir.length)).not.toMatch(/[:*?"<>|]/)
  })

  it('a write failure after a pass is not a PASS: ok false, error set, no temp file left behind', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    // a folder where the GLB must go makes the final rename fail
    await mkdir(join(paths.assetsDir, 'test-mixer.glb'))
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))
    expect(report.ok).toBe(false)
    expect(report.finalGlb).toBeUndefined()
    expect(report.error).toBeTruthy()
    expect(calls.create).toHaveLength(1)
    expect((await readdir(paths.assetsDir)).filter((f) => f.endsWith('.tmp'))).toEqual([])
    expect((await readManifest()).assets.find((a) => a.id === 'test-mixer')).not.toHaveProperty('tool')
    expect(formatReport(report)).toContain('result: FAIL')
    expect(formatReport(report)).not.toMatch(/result: PASS/)
  })

  it('recordAsset throwing after the GLB write is not a PASS: ok false, error set, exit code 1', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)] })
    const fix = deps.runFixup as NonNullable<BuildDeps['runFixup']>
    // the manifest is valid at the pre-flight check and corrupted while the build runs
    deps.runFixup = async (...args) => {
      await writeFile(paths.manifestPath, '{ broken')
      return fix(...args)
    }
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, deps)
    expect(report.ok).toBe(false)
    expect(report.finalGlb).toBeUndefined()
    expect(report.error).toMatch(/not valid JSON/)
    expect(calls.create).toHaveLength(1)

    const out: string[] = []
    const deps2 = makeDeps({ spec, fixed: [await goodGlb(spec)] })
    const fix2 = deps2.runFixup as NonNullable<BuildDeps['runFixup']>
    deps2.runFixup = async (...args) => {
      await writeFile(paths.manifestPath, '{ broken')
      return fix2(...args)
    }
    await writeFile(paths.manifestPath, JSON.stringify({ assets: [] }))
    expect(await main([spec.id, '--yes', '--ship', '--logos-removed'], deps2, (l) => out.push(l))).toBe(1)
    expect(out.join(String.fromCharCode(10))).not.toMatch(/result: PASS/)
  })

  it('an invalid manifest fails before any Meshy call', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    for (const content of ['{ nope', '{"generated":"x"}']) {
      await writeFile(paths.manifestPath, content)
      await expect(buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))).rejects.toThrow(/manifest/)
    }
    await rm(paths.manifestPath)
    await expect(buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))).rejects.toThrow(/manifest/)
    expect(calls.create).toHaveLength(0)
    expect(calls.fixup).toHaveLength(0)
  })

  it('a dry run does not need a valid manifest', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    await writeFile(paths.manifestPath, '{ nope')
    const report = await buildAsset(spec.id, { maxAttempts: 1, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))
    expect(report.ok).toBe(true)
  })

  it('a compress throw aborts after one Meshy create, on a device and on a connector', async () => {
    for (const spec of [deviceSpec(), connectorSpec()]) {
      calls.create.length = 0
      await addPhotos(spec.id, ['a.png'])
      const compress: BuildDeps['compress'] = async () => {
        throw new Error('draco encoder blew up')
      }
      const fixupReport = spec.kind === 'connector' ? { ...FIXUP_OK, preScaleSizeM: { w: 6, h: 6, d: 20 } } : undefined
      const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], compress, fixupReport }))
      expect(report.ok).toBe(false)
      expect(report.error).toContain('draco encoder blew up')
      expect(report.attempts).toHaveLength(1)
      expect(calls.create).toHaveLength(1)
      expect(existsSync(join(paths.assetsDir, `${spec.id}.glb`))).toBe(false)
    }
  })

  it('a re-measure throw on the compressed bytes aborts too', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const compress: BuildDeps['compress'] = async () => new Uint8Array([1, 2, 3, 4])
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], compress }))
    expect(report.ok).toBe(false)
    expect(report.error).toBeTruthy()
    expect(report.attempts).toHaveLength(1)
    expect(calls.create).toHaveLength(1)
  })

  it('dry-run writes nothing to public/assets or the manifest, but still writes the report', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const manifestBefore = await readFile(paths.manifestPath, 'utf8')
    const filesBefore = await readdir(paths.assetsDir)
    const report = await buildAsset(spec.id, { maxAttempts: 1, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))
    expect(report.ok).toBe(true)
    expect(report.dryRun).toBe(true)
    expect(report.finalGlb).toBeUndefined()
    expect(await readFile(paths.manifestPath, 'utf8')).toBe(manifestBefore)
    expect(await readdir(paths.assetsDir)).toEqual(filesBefore)
    const onDisk = JSON.parse(await readFile(join(paths.sourceDir, spec.id, 'report.json'), 'utf8')) as BuildReport
    expect(onDisk.dryRun).toBe(true)
    expect(onDisk.ok).toBe(true)
  })
})

describe('buildAsset texture budget', () => {
  it('a glTF validator error on the final bytes aborts after ONE create, keeping the bytes and the gate', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const placement = buildPlacement(spec)
    const nodes = [...placement.ports.map((p) => ({ name: p.name, pos: p.pos })), ...placement.controls.map((c) => ({ name: c.name, pos: c.pos }))]
    const invalid = await makeBoxGlb({ sizeM: placement.sizeM, nodes, texture: { sizePx: 64 }, noTexcoord: true })
    const compress: BuildDeps['compress'] = async () => invalid
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], compress }))
    expect(report.ok).toBe(false)
    expect(calls.create).toHaveLength(1)
    const validator = report.attempts[0].gates.find((g) => g.gate === 'validator')
    expect(validator?.ok).toBe(false)
    expect(validator?.detail).toMatch(/MESH_PRIMITIVE_TOO_FEW_TEXCOORDS/)
    expect(report.error).toMatch(/gate validator failed/)
    expect(existsSync(join(report.workDir, 'attempt-1.final.glb'))).toBe(true)
    expect(existsSync(join(paths.assetsDir, 'test-mixer.glb'))).toBe(false)
  })

  it('textures are optimized before Draco and the shipped file is re-gated', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const fixed = await goodGlb(spec, 0, { sizePx: 2048, pbr: true })
    expect((await inspectGlb(fixed)).textures).toHaveLength(3)
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [fixed] }))

    expect(report.ok).toBe(true)
    expect(calls.order).toEqual(['optimize', 'compress'])
    expect(calls.optimize).toEqual([{ maxPx: 1024, dataMaxPx: 512 }]) // data maps (normal, metallic-roughness) at half the colour limit
    expect(calls.compress).toEqual([{ bits: 14 }])

    const shipped = await inspectGlb(new Uint8Array(await readFile(join(paths.assetsDir, 'test-mixer.glb'))))
    expect(shipped.textures).toHaveLength(3)
    expect(shipped.textures.map((t) => t.width).sort((x, y) => x - y)).toEqual([512, 512, 1024]) // the colour map at 1024, normal and metallic-roughness at 512
    for (const t of shipped.textures) expect(t).toMatchObject({ mimeType: 'image/webp' })
    expect(shipped.triangles).toBe(12)

    const gates = report.attempts[0].gates
    expect(gates.map((g) => g.gate)).toEqual(['size', 'transform', 'parts', 'portPositions', 'budget', 'proportionDrift', 'textures', 'validator'])
    expect(gates.every((g) => g.ok)).toBe(true)
    expect(gates[6].detail).toContain(String(shipped.fileBytes))
    expect(gates[7]).toMatchObject({ gate: 'validator', ok: true, detail: expect.stringMatching(/^glTF validator: 0 errors/) })
    const entry = (await readManifest()).assets.find((a) => a.id === 'test-mixer')
    expect((entry?.gates as { gate: string }[]).map((g) => g.gate)).toContain('textures')
  })

  it('a connector gets the 512 px limit', async () => {
    const spec = connectorSpec()
    await addPhotos(spec.id, ['a.png'])
    const report = await buildAsset(spec.id, { maxAttempts: 1, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec, 0, { sizePx: 1024 })], fixupReport: { ...FIXUP_OK, preScaleSizeM: { w: 6, h: 6, d: 20 } } }))
    expect(report.ok).toBe(true)
    expect(calls.optimize).toEqual([{ maxPx: 512, dataMaxPx: 256 }])
    expect((await inspectGlb(new Uint8Array(await readFile(join(paths.assetsDir, 'test-jack.glb'))))).textures[0]).toMatchObject({ width: 512, mimeType: 'image/webp' })
  })

  it('attempt records textures webp', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const textured = await buildAsset(spec.id, { maxAttempts: 1, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec, 0, { sizePx: 256 })] }))
    expect(textured.attempts[0]).toMatchObject({ compression: 'draco', textures: 'webp' })
    const onDisk = JSON.parse(await readFile(join(paths.sourceDir, spec.id, 'report.json'), 'utf8')) as BuildReport
    expect(onDisk.attempts[0].textures).toBe('webp')

    const plain = await buildAsset(spec.id, { maxAttempts: 1, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))
    expect(plain.attempts[0]).toMatchObject({ compression: 'draco', textures: 'none' })
  })

  it('the texture step receives a model already normalised for Mode Création (metal capped, colour map lifted)', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    let seen: Uint8Array | undefined
    const optimize: BuildDeps['optimizeTextures'] = async (bytes) => {
      seen = bytes
      return bytes
    }
    await buildAsset(spec.id, { maxAttempts: 1, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec, 0, { sizePx: 64, pbr: true })], optimize }))
    expect(seen).toBeDefined()
    const m = (await new NodeIO().readBinary(seen!)).getRoot().listMaterials()[0]
    expect(m.getMetallicFactor()).toBeLessThanOrEqual(0.15)
    expect(m.getBaseColorTexture()).not.toBeNull()
  })

  it('repaints the spec blank bands (logos) before the look and texture steps, and not at all without a texture block', async () => {
    const read = async (bytes: Uint8Array): Promise<number[]> => {
      const img = (await new NodeIO().readBinary(bytes)).getRoot().listMaterials()[0].getBaseColorTexture()!.getImage()!
      const { data } = await sharp(Buffer.from(img)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      return [data[0], data[1], data[2]]
    }
    // the helper writes all-zero UVs (degenerate triangles): give every triangle the corner (0,0), (1,0), (0,1) so its texels exist
    const withRealUvs = async (bytes: Uint8Array): Promise<Uint8Array> => {
      const io = new NodeIO()
      const doc = await io.readBinary(bytes)
      for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
        const uv = prim.getAttribute('TEXCOORD_0')!
        const arr = uv.getArray() as Float32Array
        for (let i = 0; i < arr.length / 2; i++) arr.set([[0, 0], [1, 0], [0, 1]][i % 3], i * 2)
        uv.setArray(arr)
      }
      return io.writeBinary(doc)
    }
    const run = async (spec: AssetSpecT): Promise<number[]> => {
      await addPhotos(spec.id, ['a.png'])
      let seen: Uint8Array | undefined
      const optimize: BuildDeps['optimizeTextures'] = async (bytes) => {
        seen = bytes
        return bytes
      }
      await buildAsset(spec.id, { maxAttempts: 1, logosRemoved: true }, makeDeps({ spec, fixed: [await withRealUvs(await goodGlb(spec, 0, { sizePx: 16, pbr: true }))], optimize }))
      return read(seen!)
    }
    const lifted = liftChannel(0x20)
    expect(await run(deviceSpec({ texture: { blankBandsMm: [{ fromMm: 0, toMm: 1000, fill: '#202020' }] } }))).toEqual([lifted, lifted, lifted])
    expect((await run(deviceSpec())).every((v) => v === liftChannel(0x80))).toBe(true) // untouched flat grey, only lifted
  })

  it('an oversize final file aborts without a second Meshy create and keeps the raw GLB', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const manifestBefore = await readFile(paths.manifestPath, 'utf8')
    // a no-op texture step on three 1024 px noise maps leaves roughly 9 MB: far over the 1.5 MB standard limit
    const optimize: BuildDeps['optimizeTextures'] = async (bytes) => bytes
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec, 0, { sizePx: 1024, noise: true, pbr: true })], optimize }))

    expect(report.ok).toBe(false)
    expect(report.error).toMatch(/^file size budget exceeded: \d+ > 1500000 \(lower TEXTURE_MAX_PX or FILE_BYTES_MAX in gates\.ts\)$/)
    expect(report.attempts).toHaveLength(1)
    expect(report.attempts[0].credits).toBe(20)
    expect(calls.create).toHaveLength(1)
    expect(existsSync(join(report.workDir, 'attempt-1.raw.glb'))).toBe(true)
    expect(existsSync(join(paths.assetsDir, 'test-mixer.glb'))).toBe(false)
    expect(await readFile(paths.manifestPath, 'utf8')).toBe(manifestBefore)
  })

  it('an oversize texture on the final bytes also aborts, naming the texture', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const optimize: BuildDeps['optimizeTextures'] = async (bytes) => bytes
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec, 0, { sizePx: 2048 })], optimize }))
    expect(report.ok).toBe(false)
    expect(report.error).toMatch(/baseColor/)
    expect(report.error).toMatch(/2048/)
    expect(report.error).toMatch(/TEXTURE_MAX_PX/)
    expect(report.attempts).toHaveLength(1)
    expect(calls.create).toHaveLength(1)
    expect(existsSync(join(report.workDir, 'attempt-1.raw.glb'))).toBe(true)
    expect(existsSync(join(paths.assetsDir, 'test-mixer.glb'))).toBe(false)
  })

  it('a throw in optimizeTextures aborts for every tier', async () => {
    for (const spec of [connectorSpec(), deviceSpec(), deviceSpec({ id: 'test-hero', tier: 'hero' })]) {
      calls.create.length = 0
      calls.compress.length = 0
      await addPhotos(spec.id, ['a.png'])
      const optimize: BuildDeps['optimizeTextures'] = async () => {
        throw new Error('sharp blew up')
      }
      const fixupReport = spec.kind === 'connector' ? { ...FIXUP_OK, preScaleSizeM: { w: 6, h: 6, d: 20 } } : undefined
      const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], optimize, fixupReport }))
      expect(report.ok).toBe(false)
      expect(report.error).toContain('sharp blew up')
      expect(report.attempts).toHaveLength(1)
      expect(calls.create).toHaveLength(1)
      expect(calls.compress).toHaveLength(0)
      expect(existsSync(join(paths.assetsDir, `${spec.id}.glb`))).toBe(false)
    }
  })

  it('the connector fallback ships the optimized, uncompressed file and gates its textures', async () => {
    const spec = connectorSpec()
    await addPhotos(spec.id, ['a.png'])
    const shifted = await goodGlb(spec, 0.0006)
    const compress: BuildDeps['compress'] = async () => shifted
    const report = await buildAsset(spec.id, { maxAttempts: 1, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec, 0, { sizePx: 1024 })], compress, fixupReport: { ...FIXUP_OK, preScaleSizeM: { w: 6, h: 6, d: 20 } } }))
    expect(report.ok).toBe(true)
    expect(report.attempts[0]).toMatchObject({ compression: 'none', textures: 'webp' })
    expect(report.attempts[0].gates.at(-2)).toMatchObject({ gate: 'textures', ok: true })
    expect(report.attempts[0].gates.at(-1)).toMatchObject({ gate: 'validator', ok: true })
    const shipped = await inspectGlb(new Uint8Array(await readFile(join(paths.assetsDir, 'test-jack.glb'))))
    expect(shipped.textures[0]).toMatchObject({ width: 512, height: 512, mimeType: 'image/webp' })
  })

  it('the connector fallback aborts when the file it would ship breaks the texture budget', async () => {
    const spec = connectorSpec()
    await addPhotos(spec.id, ['a.png'])
    // 512 px noise x3 is still far over 250 kB, and the Draco output is rejected on its geometry
    const noisy = await goodGlb(spec, 0, { sizePx: 512, noise: true, pbr: true })
    const optimize: BuildDeps['optimizeTextures'] = async (bytes) => bytes
    const compress: BuildDeps['compress'] = async () => goodGlb(spec, 0.0006)
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [noisy], optimize, compress, fixupReport: { ...FIXUP_OK, preScaleSizeM: { w: 6, h: 6, d: 20 } } }))
    expect(report.ok).toBe(false)
    expect(report.error).toMatch(/file size budget exceeded: \d+ > 250000/)
    expect(report.attempts).toHaveLength(1)
    expect(calls.create).toHaveLength(1)
    expect(existsSync(join(paths.assetsDir, 'test-jack.glb'))).toBe(false)
  })

  it('a geometry failure after Draco aborts (our compression, not the Meshy model), with the textures gate in the report', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const bad = await tallGlb(spec)
    const compress: BuildDeps['compress'] = async () => bad
    const report = await buildAsset(spec.id, { maxAttempts: 2, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], compress }))
    expect(report.attempts).toHaveLength(1)
    expect(calls.create).toHaveLength(1)
    expect(report.attempts[0].gates.slice(-2).map((g) => g.gate)).toEqual(['textures', 'validator'])
  })

  it('a textures failure on the final bytes keeps the failing gate on the attempt and saves attempt-N.final.glb', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const optimize: BuildDeps['optimizeTextures'] = async (bytes) => bytes
    const report = await buildAsset(spec.id, { maxAttempts: 3, logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec, 0, { sizePx: 2048 })], optimize }))
    expect(report.ok).toBe(false)
    const textures = report.attempts[0].gates.find((g) => g.gate === 'textures')
    expect(textures?.ok).toBe(false)
    expect(textures?.detail).toMatch(/2048/)
    expect(report.attempts[0].gates.map((g) => g.gate)).toEqual(['size', 'transform', 'parts', 'portPositions', 'budget', 'proportionDrift', 'textures', 'validator'])
    const final = await inspectGlb(new Uint8Array(await readFile(join(report.workDir, 'attempt-1.final.glb'))))
    expect(final.textures[0]).toMatchObject({ width: 2048 })
    const onDisk = JSON.parse(await readFile(join(paths.sourceDir, spec.id, 'report.json'), 'utf8')) as BuildReport
    expect(onDisk.attempts[0].gates.find((g) => g.gate === 'textures')?.ok).toBe(false)
  })
})

describe('readPhotosFrom', () => {
  it('returns [] for a missing folder', async () => {
    expect(await readPhotosFrom(join(root, 'missing'))).toEqual([])
  })

  it('returns the file name, the path and the data URI of each photo', async () => {
    await addPhotos('x', ['b.jpg', 'a.png'])
    const dir = join(paths.sourceDir, 'x', 'photos')
    const got = await readPhotosFrom(dir)
    expect(got.map((p) => p.name)).toEqual(['a.png', 'b.jpg'])
    expect(got[0].path).toBe(join(dir, 'a.png'))
    expect(got[1].dataUri).toBe(`data:image/jpeg;base64,${Buffer.from(PHOTO_BYTES).toString('base64')}`)
  })
})

describe('dracoCompress', () => {
  it('quantizes the positions and keeps the nodes, and the bbox stays within a hundredth of a millimetre', async () => {
    const spec = deviceSpec()
    const fixed = await goodGlb(spec)
    const out = await dracoCompress(fixed, { quantizePositionBits: 14 })
    expect(Buffer.from(out).includes(Buffer.from('KHR_draco_mesh_compression'))).toBe(true)
    const a = await inspectGlb(fixed)
    const b = await inspectGlb(out)
    expect(b.nodeNames).toEqual(a.nodeNames)
    expect(b.triangles).toBe(a.triangles)
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(b.bboxM.min[i] - a.bboxM.min[i])).toBeLessThan(0.00001)
      expect(Math.abs(b.bboxM.max[i] - a.bboxM.max[i])).toBeLessThan(0.00001)
    }
  })

  it('is deterministic: the same input and bits give the same bytes', async () => {
    const fixed = await goodGlb(deviceSpec())
    const one = await dracoCompress(fixed, { quantizePositionBits: 14 })
    const two = await dracoCompress(fixed, { quantizePositionBits: 14 })
    expect(two).toEqual(one)
  })
})

describe('CLI main', () => {
  it('prints the gate table and the credits, and exits 0 on a pass', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const out: string[] = []
    const code = await main([spec.id, '--attempts', '2', '--dry-run', '--yes'], makeDeps({ spec, fixed: [await goodGlb(spec)] }), (l) => out.push(l))
    const text = out.join('\n')
    expect(code).toBe(0)
    expect(text).toMatch(/PASS\s+size/)
    expect(text).toMatch(/PASS\s+proportionDrift/)
    expect(text).toMatch(/credits: 20/)
    expect(text).toMatch(/dry run/i)
  })

  it('exits 1 and shows FAIL with the detail on a failed build', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const out: string[] = []
    const code = await main([spec.id, '--attempts', '1', '--yes'], makeDeps({ spec, fixed: [await tallGlb(spec)] }), (l) => out.push(l))
    expect(code).toBe(1)
    expect(out.join('\n')).toMatch(/FAIL\s+size.*h measures/)
  })

  it('rejects bad arguments with exit 1 and zero builds', async () => {
    const spec = deviceSpec()
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)] })
    for (const argv of [[], [spec.id, '--attempts', '0'], [spec.id, '--yaw', '45'], [spec.id, '--bogus'], [spec.id, '--raw']]) {
      const out: string[] = []
      expect(await main(argv, deps, (l) => out.push(l))).toBe(1)
      expect(out.join('\n')).toMatch(/usage|must|unknown|needs/i)
    }
    expect(calls.create).toHaveLength(0)
  })

  it('--raw passes the file through and never calls Meshy', async () => {
    const spec = deviceSpec()
    const rawPath = join(root, 'box.glb')
    await writeFile(rawPath, RAW_BYTES)
    const out: string[] = []
    const code = await main([spec.id, '--raw', rawPath, '--dry-run'], makeDeps({ spec, fixed: [await goodGlb(spec)] }), (l) => out.push(l))
    expect(code).toBe(0)
    expect(calls.create).toHaveLength(0)
    expect(out.join('\n')).toMatch(/credits: n\/a/)
  })

  it('--pilot runs the six ids in order and stops at the first 402', async () => {
    const spec = deviceSpec({ id: 'shure-sm58' })
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)], createError: new MeshyError(402, 'out of credits') })
    deps.loadSpec = () => spec
    await addPhotos('shure-sm58', ['a.png'])
    await addPhotos('yamaha-ql1', ['a.png'])
    const out: string[] = []
    const code = await main(['--pilot', '--attempts', '2', '--yes'], deps, (l) => out.push(l))
    expect(code).toBe(1)
    expect(calls.create).toHaveLength(1)
    const text = out.join('\n')
    expect(text).toMatch(/shure-sm58\s+STOPPED/)
    expect(text).toMatch(/yamaha-ql1\s+not run/)
    expect(text).toMatch(/402/)
  })
})

describe('CLI ship and spend guards', () => {
  it('by default nothing ships: final.glb and report.json land in the work dir, public/assets and the manifest untouched', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const manifestBefore = await readFile(paths.manifestPath, 'utf8')
    const filesBefore = await readdir(paths.assetsDir)
    const out: string[] = []
    expect(await main([spec.id, '--attempts', '1', '--yes'], makeDeps({ spec, fixed: [await goodGlb(spec)] }), (l) => out.push(l))).toBe(0)
    expect(await readFile(paths.manifestPath, 'utf8')).toBe(manifestBefore)
    expect(await readdir(paths.assetsDir)).toEqual(filesBefore)
    const work = join(paths.sourceDir, spec.id, 'work', '2026-10-29T12-00-00-000Z')
    expect(existsSync(join(work, 'final.glb'))).toBe(true)
    expect(existsSync(join(work, 'report.json'))).toBe(true)
    expect((await inspectGlb(new Uint8Array(await readFile(join(work, 'final.glb'))))).nodeNames).toContain('port_in-mic-1')
    const text = out.join('\n')
    expect(text).toContain(`result: PASS (dry run, not shipped): ${join(work, 'final.glb')}`)
    expect(text).toMatch(/--ship --logos-removed/)
  })

  it('--ship without --logos-removed is refused before anything runs', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const out: string[] = []
    expect(await main([spec.id, '--yes', '--ship'], makeDeps({ spec, fixed: [await goodGlb(spec)] }), (l) => out.push(l))).toBe(1)
    expect(out.join('\n')).toMatch(/--ship is refused without --logos-removed/)
    expect(calls.create).toHaveLength(0)
    expect(calls.fixup).toHaveLength(0)
    expect(existsSync(join(paths.assetsDir, 'test-mixer.glb'))).toBe(false)
  })

  it('the library refuses to ship without logosRemoved, with zero Meshy calls', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    await expect(buildAsset(spec.id, { maxAttempts: 1 }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))).rejects.toThrow(/refusing to ship test-mixer.*logos/)
    expect(calls.create).toHaveLength(0)
  })

  it('--ship --logos-removed writes the GLB and the manifest entry with logosRemoved true', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const out: string[] = []
    expect(await main([spec.id, '--attempts', '1', '--yes', '--ship', '--logos-removed'], makeDeps({ spec, fixed: [await goodGlb(spec)] }), (l) => out.push(l))).toBe(0)
    expect(existsSync(join(paths.assetsDir, 'test-mixer.glb'))).toBe(true)
    expect((await readManifest()).assets.find((a) => a.id === 'test-mixer')).toMatchObject({ logosRemoved: true, tool: 'meshy' })
    expect(out.join('\n')).toMatch(/result: PASS, shipped/)
  })

  it('without --yes there is no Meshy call: the pre-spend line is printed and the run is refused', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const out: string[] = []
    expect(await main([spec.id, '--attempts', '3'], makeDeps({ spec, fixed: [await goodGlb(spec)] }), (l) => out.push(l))).toBe(1)
    expect(out[0]).toBe('will create up to 3 Meshy tasks, about 30 credits each, max 90 credits')
    expect(out.join('\n')).toMatch(/refusing to call Meshy without --yes/)
    expect(calls.create).toHaveLength(0)
    expect(calls.fixup).toHaveLength(0)
  })

  it('asset:pilot needs --yes too, and counts six assets times the attempts', async () => {
    const spec = deviceSpec({ id: 'shure-sm58' })
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)] })
    deps.loadSpec = () => spec
    const out: string[] = []
    expect(await main(['--pilot', '--attempts', '2'], deps, (l) => out.push(l))).toBe(1)
    expect(out[0]).toBe('will create up to 12 Meshy tasks, about 30 credits each, max 360 credits')
    expect(calls.create).toHaveLength(0)
  })

  it('--raw needs no --yes (no Meshy call) and prints no spending line', async () => {
    const spec = deviceSpec()
    const rawPath = join(root, 'box.glb')
    await writeFile(rawPath, RAW_BYTES)
    const out: string[] = []
    expect(await main([spec.id, '--raw', rawPath], makeDeps({ spec, fixed: [await goodGlb(spec)] }), (l) => out.push(l))).toBe(0)
    expect(out.join('\n')).not.toMatch(/will create/)
  })

  it('--ship with --dry-run is a contradiction', async () => {
    const spec = deviceSpec()
    const out: string[] = []
    expect(await main([spec.id, '--yes', '--ship', '--logos-removed', '--dry-run'], makeDeps({ spec, fixed: [await goodGlb(spec)] }), (l) => out.push(l))).toBe(1)
    expect(out.join('\n')).toMatch(/contradict/)
  })
})

describe('--flip', () => {
  it('passes flipUpright to the fix-up (false by default, true with --flip)', async () => {
    // A square footprint: a 90 degree yaw is allowed there (it would be refused on a non-square device).
    const spec = deviceSpec({ realSizeMm: { w: 100, h: 50, d: 100 } })
    const square = { ...FIXUP_OK, preScaleSizeM: { w: 10, h: 5, d: 10 } }
    const rawPath = join(root, 'box.glb')
    await writeFile(rawPath, RAW_BYTES)
    expect(await main([spec.id, '--raw', rawPath, '--yaw', '90'], makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReport: square }), () => undefined)).toBe(0)
    expect(await main([spec.id, '--raw', rawPath, '--flip'], makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReport: square }), () => undefined)).toBe(0)
    expect(calls.fixup.map((c) => [c.yawDeg, c.flipUpright])).toEqual([[90, false], [0, true]])
  })
})

describe('contact sheet per attempt', () => {
  it('renders one sheet per attempt from the fixed GLB, with the first photo and the spec', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['b.png', 'a.png'])
    const report = await buildAsset(spec.id, { maxAttempts: 2, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReports: [FIXUP_DRIFT, FIXUP_OK] }))
    expect(calls.sheet).toEqual([1, 2].map((n) => ({
      glb: join(report.workDir, `attempt-${n}.fixed.glb`),
      photo: join(paths.sourceDir, spec.id, 'photos', 'a.png'),
      out: join(report.workDir, `attempt-${n}.sheet.png`),
      specId: spec.id,
    })))
  })

  it('a failing sheet only logs a warning: the build passes and nothing extra is bought', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const renderSheet: BuildDeps['renderSheet'] = async () => {
      throw new Error('Blender contact sheet failed (exit 1): RENDER_FAIL')
    }
    const report = await buildAsset(spec.id, { maxAttempts: 3, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], renderSheet }))
    expect(report.ok).toBe(true)
    expect(report.error).toBeUndefined()
    expect(calls.create).toHaveLength(1)
    expect(calls.log.some((l) => /^warning: the contact sheet of attempt 1 failed .*RENDER_FAIL/.test(l))).toBe(true)
  })

  it('without Blender (renderSheet null) no sheet is attempted', async () => {
    const spec = deviceSpec()
    const rawPath = join(root, 'hand-made.glb')
    await writeFile(rawPath, RAW_BYTES)
    const report = await buildAsset(spec.id, { maxAttempts: 1, rawGlb: rawPath, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], renderSheet: null }))
    expect(report.ok).toBe(true)
    expect(calls.sheet).toHaveLength(0)
    expect(calls.log.some((l) => /contact sheet/.test(l))).toBe(false)
  })
})

describe('catalog parity before paying', () => {
  it('a spec with a port the catalog device does not have aborts with zero Meshy calls, listing the errors', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const catalog = catalogFor(deviceSpec({ ports: [{ portId: 'in-mic-2', face: 'io', xMm: 20, yMm: 25, confidence: 'manual' }] }))
    const err = await buildAsset(spec.id, { maxAttempts: 3, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], catalog })).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toMatch(/nothing was spent/)
    expect((err as Error).message).toContain('spec port "in-mic-1" is not in the catalog')
    expect((err as Error).message).toContain('catalog port "in-mic-2" is missing from the spec')
    expect(calls.create).toHaveLength(0)
    expect(calls.fixup).toHaveLength(0)
    expect(existsSync(join(paths.sourceDir, spec.id, 'work'))).toBe(false)
  })

  it('the CLI reports it as an error with exit 1 and no Meshy call', async () => {
    const spec = connectorSpec()
    await addPhotos(spec.id, ['a.png'])
    const out: string[] = []
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)], catalog: catalogFor(connectorSpec({ id: 'other-jack' })) })
    expect(await main([spec.id, '--yes'], deps, (l) => out.push(l))).toBe(1)
    expect(out.join('\n')).toMatch(/not in catalog\.connectorTypes/)
    expect(calls.create).toHaveLength(0)
  })

  it('the default catalog loader parses the real content/catalog.json with the zod schema', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)] })
    delete deps.loadCatalog
    // test-mixer is not a catalog device: the real catalog is read and the parity error proves it was consulted
    await expect(buildAsset(spec.id, { maxAttempts: 1, dryRun: true }, deps)).rejects.toThrow(/device spec "test-mixer": not in catalog\.devices/)
    expect(calls.create).toHaveLength(0)
  })
})

describe('pilot stop rule', () => {
  it('stops at the first report.error of any kind (here a pipeline defect), says which asset stopped', async () => {
    const spec = deviceSpec({ id: 'shure-sm58' })
    const deps = makeDeps({ spec, fixed: [await tallGlb(spec)] })
    deps.loadSpec = () => spec
    for (const id of PILOT_IDS) await addPhotos(id, ['a.png'])
    const out: string[] = []
    const code = await main(['--pilot', '--attempts', '3', '--yes'], deps, (l) => out.push(l))
    expect(code).toBe(1)
    expect(calls.create).toHaveLength(1)
    const text = out.join('\n')
    expect(text).toMatch(/pilot stopped at shure-sm58: .*gate size failed/)
    expect(text).toMatch(/shure-sm58\s+FAIL/)
    for (const id of PILOT_IDS.slice(1)) expect(text).toMatch(new RegExp(`${id}\\s+not run.*stopped at shure-sm58`))
  })

  it('a FAIL that only ran out of retryable attempts does not stop the pilot', async () => {
    const spec = deviceSpec({ id: 'shure-sm58' })
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReport: FIXUP_DRIFT })
    deps.loadSpec = () => spec
    for (const id of PILOT_IDS) await addPhotos(id, ['a.png'])
    const out: string[] = []
    expect(await main(['--pilot', '--attempts', '1', '--yes'], deps, (l) => out.push(l))).toBe(1)
    expect(calls.create).toHaveLength(PILOT_IDS.length)
    expect(out.join('\n')).not.toMatch(/pilot stopped/)
  })
})

describe('pilot with a failing write', () => {
  it('marks the row FAIL and exits 1', async () => {
    const spec = deviceSpec({ id: 'shure-sm58' })
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)] })
    deps.loadSpec = () => spec
    for (const id of ['shure-sm58', 'yamaha-ql1', 'yamaha-rio3224-d2', 'xlr3-f', 'trs-quarter', 'rj45']) await addPhotos(id, ['a.png'])
    await mkdir(join(paths.assetsDir, 'shure-sm58.glb'))
    const out: string[] = []
    const code = await main(['--pilot', '--attempts', '1', '--yes'], deps, (l) => out.push(l))
    expect(code).toBe(0) // the default never ships, so no write and no failure here
    out.length = 0
    const code2 = await main(['--pilot', '--attempts', '1', '--yes', '--ship', '--logos-removed'], deps, (l) => out.push(l))
    expect(code2).toBe(1)
    expect(out.join(String.fromCharCode(10))).toMatch(/shure-sm58\s+FAIL/)
  })
})

describe('formatReport', () => {
  it('says dry run only for a dry run', () => {
    const base: BuildReport = { id: 'x', ok: true, dryRun: true, workDir: 'w', attempts: [] }
    expect(formatReport(base)).toContain('PASS (dry run, not shipped)')
    expect(formatReport({ ...base, dryRun: false })).not.toMatch(/dry run/)
  })

  it('lists each gate once per attempt with PASS or FAIL', () => {
    const report: BuildReport = {
      id: 'x',
      ok: false,
      dryRun: false,
      workDir: 'work',
      attempts: [{ n: 1, credits: 20, gates: [{ gate: 'size', ok: false, detail: 'w is off' }, { gate: 'budget', ok: true, detail: 'fine' }] }],
    }
    const text = formatReport(report)
    expect(text).toContain('FAIL  size')
    expect(text).toContain('PASS  budget')
    expect(text).toContain('w is off')
  })
})

describe('isMainModule', () => {
  const url = 'file:///E:/dev/Tekonest-wt/assets3d/tekpractice-sim/tools/assets3d/build-asset.ts'

  it('matches the same path', () => {
    expect(isMainModule('E:/dev/Tekonest-wt/assets3d/tekpractice-sim/tools/assets3d/build-asset.ts', url, 'win32')).toBe(true)
  })

  it('on win32 ignores the case of the drive letter and the folders', () => {
    expect(isMainModule('e:/DEV/tekonest-wt/assets3d/tekpractice-sim/tools/assets3d/build-asset.ts', url, 'win32')).toBe(true)
  })

  it('on linux stays case-sensitive', () => {
    expect(isMainModule('/repo/Tools/build-asset.ts', 'file:///repo/tools/build-asset.ts', 'linux')).toBe(false)
    expect(isMainModule('/repo/tools/build-asset.ts', 'file:///repo/tools/build-asset.ts', 'linux')).toBe(true)
  })

  it('is false for another script or none', () => {
    expect(isMainModule('E:/other/script.ts', url, 'win32')).toBe(false)
    expect(isMainModule(undefined, url, 'win32')).toBe(false)
  })
})

describe('Meshy model constant', () => {
  it('build-asset records the model the Meshy client requests', async () => {
    const { MESHY_MODEL } = await import('../../../tools/assets3d/meshy')
    expect(MESHY_MODEL).toBe('meshy-7.1')
  })
})

describe('scripted build (--scripted)', () => {
  /** A 6 x 6 x 20 mm connector with a build block, and the fix-up report of a model that is already exactly that shape. */
  const jack = (over: Partial<AssetSpecT> = {}): AssetSpecT => connectorSpec({ build: { shape: 'cylinder-plug', params: { frontLenMm: 5 } }, ...over })
  const FIXUP_JACK: FixupReport = { preScaleSizeM: { w: 6, h: 6, d: 20 }, scaleApplied: [1, 1, 1], rotatedDegrees: 0 }

  it('creates no Meshy task and reads no photos: the builder writes attempt-1.raw.glb and the rest of the loop runs', async () => {
    const spec = jack()
    let photoReads = 0
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReport: FIXUP_JACK })
    deps.readPhotos = async () => {
      photoReads++
      return []
    }
    const report = await buildAsset(spec.id, { maxAttempts: 3, scripted: true, dryRun: true }, deps)

    expect(report.ok).toBe(true)
    expect(calls.create).toHaveLength(0)
    expect(calls.wait).toHaveLength(0)
    expect(photoReads).toBe(0)
    expect(calls.build).toEqual([{ specId: spec.id, outGlb: join(report.workDir, 'attempt-1.raw.glb') }])
    expect(calls.fixup).toHaveLength(1)
    expect(calls.fixup[0].inGlb).toBe(join(report.workDir, 'attempt-1.raw.glb'))
    expect(report.attempts[0].credits).toBeNull()
    expect(report.attempts[0].taskId).toBeUndefined()
  })

  describe('hybrid: --project maps a Meshy picture onto the scripted shape', () => {
    const box = (over: Partial<AssetSpecT> = {}): AssetSpecT => deviceSpec({ build: { shape: 'rack-box' }, ...over })
    const hybridDeps = async (spec: AssetSpecT) => {
      const seen: { face?: string; faces?: string[]; png?: number[]; projectedFrom?: string } = {}
      const deps = makeDeps({ spec, fixed: [await goodGlb(spec)] })
      deps.renderProjection = async (glb, face) => {
        seen.face = face
        seen.projectedFrom = glb
        return { png: new Uint8Array([9, 8, 7]), faceMm: { w: 100, h: 50 } }
      }
      deps.runBuilder = async (_spec, outGlb, projections) => {
        seen.png = projections?.[0] ? Array.from(projections[0].png) : undefined
        seen.faces = projections?.map((p) => p.face)
        await writeFile(outGlb, RAW_BYTES)
      }
      return { deps, seen }
    }

    it('renders the face of the fixed Meshy GLB (default io) and hands the picture to the builder; the attempt keeps the task id', async () => {
      const spec = box()
      const { deps, seen } = await hybridDeps(spec)
      const report = await buildAsset(spec.id, { maxAttempts: 1, scripted: true, projectFrom: '/some/attempt-1.fixed.glb', rawTaskId: 'task-xyz-123', dryRun: true }, deps)
      expect(report.ok).toBe(true)
      expect(seen).toMatchObject({ face: 'io', faces: ['io'], projectedFrom: '/some/attempt-1.fixed.glb', png: [9, 8, 7] })
      expect(report.hybrid).toBe(true)
      expect(report.attempts[0].taskId).toBe('task-xyz-123')
      expect(calls.create).toHaveLength(0)
    })

    it('uses the face the spec names in build.projection', async () => {
      const spec = box({ build: { shape: 'rack-box', projection: 'top' } })
      const { deps, seen } = await hybridDeps(spec)
      await buildAsset(spec.id, { maxAttempts: 1, scripted: true, projectFrom: '/x.glb', dryRun: true }, deps)
      expect(seen.faces).toEqual(['top'])
    })

    it('moves a face picture sideways by the spec projectionShiftMm (face-local x, millimetres) before the builder sees it, and leaves the other faces alone', async () => {
      const spec = box({ realSizeMm: { w: 400, h: 100, d: 200 }, build: { shape: 'rack-box', projection: ['io', 'top'], projectionShiftMm: { io: 100 } } })
      const px = Buffer.alloc(400 * 100 * 3)
      for (let y = 0; y < 100; y++) for (let x = 0; x < 400; x++) px.set(x < 200 ? [200, 30, 30] : [30, 30, 200], (y * 400 + x) * 3)
      const original = new Uint8Array(await sharp(px, { raw: { width: 400, height: 100, channels: 3 } }).png().toBuffer())
      const { deps } = await hybridDeps(spec)
      deps.renderProjection = async () => ({ png: original, faceMm: { w: 400, h: 100 } })
      const got: Record<string, Uint8Array> = {}
      deps.runBuilder = async (_spec, outGlb, projections) => {
        for (const p of projections ?? []) got[p.face] = p.png
        await writeFile(outGlb, RAW_BYTES)
      }
      await buildAsset(spec.id, { maxAttempts: 1, scripted: true, projectFrom: '/x.glb', dryRun: true }, deps)
      const redEnd = async (png: Uint8Array): Promise<number> => {
        const { data, info } = await sharp(Buffer.from(png)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
        let x = 0
        while (x < info.width && data[(50 * info.width + x) * 3] > 100) x++
        return x
      }
      expect(await redEnd(got.io)).toBe(300) // 200 + the 100 mm shift
      expect(await redEnd(got.top)).toBe(200) // untouched
    })

    it('renders every face a spec lists, in order, and hands them all to the builder', async () => {
      const spec = box({ build: { shape: 'rack-box', projection: ['top', 'io'] } })
      const { deps, seen } = await hybridDeps(spec)
      await buildAsset(spec.id, { maxAttempts: 1, scripted: true, projectFrom: '/x.glb', dryRun: true }, deps)
      expect(seen.faces).toEqual(['top', 'io'])
    })

    it('a hybrid repaints the spec blank bands on the model it builds (the texture block applies to hybrids, not to plain scripted models)', async () => {
      const spec = box({ texture: { blankBandsMm: [{ fromMm: 0, toMm: 1000, fill: '#202020' }] } })
      await addPhotos(spec.id, ['a.png'])
      // the model the (fake) builder-and-fix-up chain hands to the texture step: a textured box with real UVs
      const withRealUvs = async (bytes: Uint8Array): Promise<Uint8Array> => {
        const io = new NodeIO()
        const doc = await io.readBinary(bytes)
        for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
          const uv = prim.getAttribute('TEXCOORD_0')!
          const arr = uv.getArray() as Float32Array
          for (let i = 0; i < arr.length / 2; i++) arr.set([[0, 0], [1, 0], [0, 1]][i % 3], i * 2)
          uv.setArray(arr)
        }
        return io.writeBinary(doc)
      }
      const read = async (bytes: Uint8Array): Promise<number> => {
        const img = (await new NodeIO().readBinary(bytes)).getRoot().listMaterials()[0].getBaseColorTexture()!.getImage()!
        const { data } = await sharp(Buffer.from(img)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
        return data[0]
      }
      const fixed = await withRealUvs(await goodGlb(spec, 0, { sizePx: 16, pbr: true }))
      const run = async (s: AssetSpecT): Promise<number> => {
        let seen: Uint8Array | undefined
        const deps = makeDeps({ spec: s, fixed: [fixed], optimize: async (bytes) => ((seen = bytes), bytes) })
        deps.photoProjection = async () => ({ png: new Uint8Array([2]), faceMm: { w: 1, h: 1 } })
        await buildAsset(s.id, { maxAttempts: 1, scripted: true, projectPhotos: [{ face: 'io', file: 'r.jpg' }], logosRemoved: true, dryRun: true }, deps)
        return read(seen!)
      }
      expect(await run(spec)).toBe(0x20) // painted with the fill (scripted: no second lift)
      expect(await run(box())).toBe(0x80) // no texture block: the flat grey of the helper texture, untouched
    })

    it('photos only: the manifest names the builder alone, no Meshy, no task, the photo file names, and replaces the licence fields of the model it replaces', async () => {
      const spec = box({ build: { shape: 'rack-box', projection: 'io' } })
      await addPhotos(spec.id, ['a.png'])
      const { deps } = await hybridDeps(spec)
      deps.photoProjection = async () => ({ png: new Uint8Array([2]), faceMm: { w: 1, h: 1 } })
      // an old downloaded-model entry (CC-BY Sketchfab) that this build replaces
      const manifest = JSON.parse(await readFile(paths.manifestPath, 'utf8'))
      Object.assign(manifest.assets.find((a: { id: string }) => a.id === spec.id), { source: 'download-ccby', author: 'Someone', license: 'CC-BY', attributionText: 'old credit', sourceUrl: 'https://x', trademark: 'branded-internal', note: 'old model' })
      await writeFile(paths.manifestPath, JSON.stringify(manifest))
      const report = await buildAsset(spec.id, { maxAttempts: 1, scripted: true, projectPhotos: [{ face: 'io', file: '/some/dir/rear.jpg' }], logosRemoved: true }, deps)
      expect(report.ok).toBe(true)
      const entry = (await readManifest()).assets.find((a) => a.id === spec.id) as Record<string, unknown>
      expect(entry).toMatchObject({ tool: 'hybrid', toolVersion: 'blender-builder-1', taskId: null, photos: ['rear.jpg'] })
      for (const k of ['author', 'attributionText', 'sourceUrl', 'note']) expect(entry, k).not.toHaveProperty(k)
      expect(String(entry.source)).toMatch(/hybrid/)
      expect(String(entry.license)).not.toMatch(/CC-BY/)
    })

    it('a face given as a photo takes its picture from the photo, the other faces from the Meshy render', async () => {
      const spec = box({ build: { shape: 'rack-box', projection: ['top', 'io'] } })
      const { deps, seen } = await hybridDeps(spec)
      const asked: string[] = []
      deps.renderProjection = async (_glb, face) => {
        asked.push('meshy:' + face)
        return { png: new Uint8Array([1]), faceMm: { w: 1, h: 1 } }
      }
      deps.photoProjection = async (photo, face, sizeMm) => {
        asked.push('photo:' + face + ':' + photo.file + ':' + sizeMm.w + 'x' + sizeMm.h + 'x' + sizeMm.d)
        return { png: new Uint8Array([2]), faceMm: { w: 1, h: 1 } }
      }
      await buildAsset(spec.id, { maxAttempts: 1, scripted: true, projectFrom: '/x.glb', projectPhotos: [{ face: 'io', file: 'rear.jpg' }], dryRun: true }, deps)
      expect(asked).toEqual(['meshy:top', 'photo:io:rear.jpg:100x50x200'])
      expect(seen.faces).toEqual(['top', 'io'])
    })

    it('photos alone are enough (no Meshy GLB) when every face has one; a face with neither is refused naming it', async () => {
      const spec = box({ build: { shape: 'rack-box', projection: ['top', 'io'] } })
      const { deps } = await hybridDeps(spec)
      deps.photoProjection = async () => ({ png: new Uint8Array([2]), faceMm: { w: 1, h: 1 } })
      const ok = await buildAsset(spec.id, { maxAttempts: 1, scripted: true, projectPhotos: [{ face: 'top', file: 't.jpg' }, { face: 'io', file: 'r.jpg' }], dryRun: true }, deps)
      expect(ok.ok).toBe(true)
      expect(ok.hybrid).toBe(true)
      const missing = await buildAsset(spec.id, { maxAttempts: 1, scripted: true, projectPhotos: [{ face: 'io', file: 'r.jpg' }], dryRun: true }, deps)
      expect(missing.ok).toBe(false)
      expect(missing.error).toMatch(/top face has no picture/)
    })

    it('a photo for a face the spec does not project is refused', async () => {
      const spec = box()
      const { deps } = await hybridDeps(spec)
      const wrong = await buildAsset(spec.id, { maxAttempts: 1, scripted: true, projectPhotos: [{ face: 'top', file: 't.jpg' }], dryRun: true }, deps)
      expect(wrong.ok).toBe(false)
      expect(wrong.error).toMatch(/no top face/)
    })

    it('refuses projectFrom without scripted before anything is spent or written', async () => {
      const spec = box()
      const { deps } = await hybridDeps(spec)
      await expect(buildAsset(spec.id, { maxAttempts: 1, projectFrom: '/x.glb', dryRun: true }, deps)).rejects.toThrow(/go with scripted/)
      expect(calls.create).toHaveLength(0)
    })

    it('shipping needs the logos assertion (the picture comes from photos), and the manifest says hybrid with the task id and both versions', async () => {
      const spec = box()
      await addPhotos(spec.id, ['a.png'])
      const { deps } = await hybridDeps(spec)
      await expect(buildAsset(spec.id, { maxAttempts: 1, scripted: true, projectFrom: '/x.glb', rawTaskId: 'task-xyz-123' }, deps)).rejects.toThrow(/logos/)
      const report = await buildAsset(spec.id, { maxAttempts: 1, scripted: true, projectFrom: '/x.glb', rawTaskId: 'task-xyz-123', logosRemoved: true }, (await hybridDeps(spec)).deps)
      expect(report.ok).toBe(true)
      const entry = (await readManifest()).assets.find((a) => a.id === spec.id)
      expect(entry).toMatchObject({ tool: 'hybrid', toolVersion: 'blender-builder-1+meshy-7.1', taskId: 'task-xyz-123', logosRemoved: true, photos: ['a.png'] })
    })
  })

  it('ship records tool scripted, the builder version, no task, no photos, logosRemoved true without being asked', async () => {
    const spec = jack()
    const report = await buildAsset(spec.id, { maxAttempts: 1, scripted: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReport: FIXUP_JACK }))
    expect(report.ok).toBe(true)
    const entry = (await readManifest()).assets.find((a) => a.id === spec.id)
    expect(entry).toMatchObject({ tool: 'scripted', toolVersion: 'blender-builder-1', taskId: null, photos: [], logosRemoved: true, status: 'ok' })
  })

  it('without a build block it fails before any file is created', async () => {
    const spec = connectorSpec()
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReport: FIXUP_JACK })
    await expect(buildAsset(spec.id, { maxAttempts: 1, scripted: true, dryRun: true }, deps)).rejects.toThrow(/no build block/)
    expect(existsSync(join(paths.sourceDir, spec.id))).toBe(false)
    expect(calls.build).toHaveLength(0)
  })

  it('a shape for the wrong kind is refused with both names, before any file is created', async () => {
    const spec = jack({ build: { shape: 'rack-box' } })
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReport: FIXUP_JACK })
    await expect(buildAsset(spec.id, { maxAttempts: 1, scripted: true, dryRun: true }, deps)).rejects.toThrow(/rack-box.*connector/)
    expect(existsSync(join(paths.sourceDir, spec.id))).toBe(false)
  })

  it('a scripted build asks the fix-up not to cut port recesses (the builder models its own sockets); other builds keep them', async () => {
    const spec = jack()
    await buildAsset(spec.id, { maxAttempts: 1, scripted: true, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReport: FIXUP_JACK }))
    const device = deviceSpec()
    const rawPath = join(root, 'plain.glb')
    await writeFile(rawPath, RAW_BYTES)
    await buildAsset(device.id, { maxAttempts: 1, rawGlb: rawPath, dryRun: true }, makeDeps({ spec: device, fixed: [await goodGlb(device)] }))
    expect(calls.fixup.map((c) => c.recess)).toEqual([false, undefined])
  })

  it('a gate failure aborts after one builder call: no retry', async () => {
    const spec = deviceSpec({ build: { shape: 'rack-box' } })
    const report = await buildAsset(spec.id, { maxAttempts: 3, scripted: true, dryRun: true }, makeDeps({ spec, fixed: [await tallGlb(spec)] }))
    expect(report.ok).toBe(false)
    expect(report.attempts).toHaveLength(1)
    expect(calls.build).toHaveLength(1)
    expect(calls.fixup).toHaveLength(1)
    expect(report.error).toMatch(/gate size failed/)
  })

  it('--raw together with scripted is refused by the library too', async () => {
    const spec = jack()
    const rawPath = join(root, 'x.glb')
    await writeFile(rawPath, RAW_BYTES)
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReport: FIXUP_JACK })
    await expect(buildAsset(spec.id, { maxAttempts: 1, scripted: true, rawGlb: rawPath, dryRun: true }, deps)).rejects.toThrow(/scripted.*rawGlb|rawGlb.*scripted/)
  })

  it('CLI --scripted builds with no spending line and no --yes', async () => {
    const spec = jack()
    const out: string[] = []
    const code = await main([spec.id, '--scripted'], makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReport: FIXUP_JACK }), (l) => out.push(l))
    expect(code).toBe(0)
    expect(out.join('\n')).not.toMatch(/will create/)
    expect(out.join('\n')).toMatch(/PASS \(dry run/)
    expect(calls.create).toHaveLength(0)
  })

  it('CLI --scripted is refused with --raw, --attempts, --yaw, --flip and --pilot, naming both flags', async () => {
    const spec = jack()
    for (const extra of [['--raw', 'x.glb'], ['--attempts', '2'], ['--yaw', '90'], ['--flip'], ['--pilot']]) {
      const out: string[] = []
      const argv = extra[0] === '--pilot' ? ['--scripted', ...extra] : [spec.id, '--scripted', ...extra]
      expect(await main(argv, makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReport: FIXUP_JACK }), (l) => out.push(l))).toBe(1)
      expect(out.join('\n')).toContain('--scripted')
      expect(out.join('\n')).toContain(extra[0])
    }
    expect(calls.build).toHaveLength(0)
  })

  it('CLI --scripted --ship ships without --logos-removed', async () => {
    const spec = jack()
    const out: string[] = []
    expect(await main([spec.id, '--scripted', '--ship'], makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReport: FIXUP_JACK }), (l) => out.push(l))).toBe(0)
    expect(existsSync(join(paths.assetsDir, `${spec.id}.glb`))).toBe(true)
    expect(out.join('\n')).toMatch(/shipped/)
  })
})

describe('ship from a finished run (--ship-run)', () => {
  /** A dry-run Meshy build, whose work dir is then shipped. */
  async function dryRun(spec: AssetSpecT, over: Partial<Rig> = {}): Promise<BuildReport> {
    await addPhotos(spec.id, ['a.png'])
    const report = await buildAsset(spec.id, { maxAttempts: 1, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)], ...over }))
    expect(report.ok).toBe(true)
    return report
  }

  it('ships the final.glb of an earlier run without calling Meshy or the fix-up again, and records the manifest', async () => {
    const spec = deviceSpec()
    const first = await dryRun(spec)
    const before = { create: calls.create.length, fixup: calls.fixup.length, compress: calls.compress.length }
    const report = await shipRun(spec.id, first.workDir, { logosRemoved: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))

    expect(report.ok).toBe(true)
    expect(report.finalGlb).toBe(join(paths.assetsDir, 'test-mixer.glb'))
    expect(new Uint8Array(await readFile(join(paths.assetsDir, 'test-mixer.glb')))).toEqual(new Uint8Array(await readFile(join(first.workDir, 'final.glb'))))
    expect({ create: calls.create.length, fixup: calls.fixup.length, compress: calls.compress.length }).toEqual(before)
    const entry = (await readManifest()).assets.find((a) => a.id === 'test-mixer')
    expect(entry).toMatchObject({ status: 'ok', tool: 'meshy', logosRemoved: true, taskId: 'task-1', photos: ['a.png'] })
    expect((entry?.gates as { gate: string; ok: boolean }[]).every((g) => g.ok)).toBe(true)
  })

  it('a scripted run ships without --logos-removed; a Meshy run is refused without it, and nothing is written', async () => {
    const jack = connectorSpec({ build: { shape: 'cylinder-plug' } })
    const scripted = await buildAsset(jack.id, { maxAttempts: 1, scripted: true, dryRun: true }, makeDeps({ spec: jack, fixed: [await goodGlb(jack)], fixupReport: { ...FIXUP_OK, preScaleSizeM: { w: 6, h: 6, d: 20 } } }))
    const shipped = await shipRun(jack.id, scripted.workDir, {}, makeDeps({ spec: jack, fixed: [await goodGlb(jack)] }))
    expect(shipped.ok).toBe(true)
    expect((await readManifest()).assets.find((a) => a.id === jack.id)).toMatchObject({ tool: 'scripted', toolVersion: 'blender-builder-1', logosRemoved: true, taskId: null })

    const spec = deviceSpec()
    const meshy = await dryRun(spec)
    await expect(shipRun(spec.id, meshy.workDir, {}, makeDeps({ spec, fixed: [await goodGlb(spec)] }))).rejects.toThrow(/logos/)
    expect(existsSync(join(paths.assetsDir, 'test-mixer.glb'))).toBe(false)
  })

  it('refuses a run of another asset, a failed run, a missing final.glb, and bytes that no longer pass the gates', async () => {
    const spec = deviceSpec()
    const run = await dryRun(spec)
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)] })
    await expect(shipRun('other-asset', run.workDir, { logosRemoved: true }, { ...deps, loadSpec: () => ({ ...spec, id: 'other-asset' }) })).rejects.toThrow(/belongs to test-mixer/)

    const reportPath = join(run.workDir, 'report.json')
    const original = await readFile(reportPath, 'utf8')
    await writeFile(reportPath, original.replace('"ok": true', '"ok": false'))
    await expect(shipRun(spec.id, run.workDir, { logosRemoved: true }, deps)).rejects.toThrow(/did not pass/)
    await writeFile(reportPath, original)

    await writeFile(join(run.workDir, 'final.glb'), await tallGlb(spec))
    await expect(shipRun(spec.id, run.workDir, { logosRemoved: true }, deps)).rejects.toThrow(/gate size/)
    await rm(join(run.workDir, 'final.glb'))
    await expect(shipRun(spec.id, run.workDir, { logosRemoved: true }, deps)).rejects.toThrow(/no final\.glb/)
    expect(existsSync(join(paths.assetsDir, 'test-mixer.glb'))).toBe(false)
  })

  it('CLI --ship-run ships, needs --logos-removed for a Meshy run, and excludes the flags that build', async () => {
    const spec = deviceSpec()
    const run = await dryRun(spec)
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)] })
    const out: string[] = []
    expect(await main([spec.id, '--ship-run', run.workDir], deps, (l) => out.push(l))).toBe(1)
    expect(out.join('\n')).toMatch(/logos/)
    out.length = 0
    expect(await main([spec.id, '--ship-run', run.workDir, '--logos-removed'], deps, (l) => out.push(l))).toBe(0)
    expect(out.join('\n')).toMatch(/shipped/)
    expect(existsSync(join(paths.assetsDir, 'test-mixer.glb'))).toBe(true)
    for (const extra of [['--raw', 'x.glb'], ['--scripted'], ['--attempts', '2'], ['--yaw', '180'], ['--flip'], ['--ship']]) {
      out.length = 0
      expect(await main([spec.id, '--ship-run', run.workDir, '--logos-removed', ...extra], deps, (l) => out.push(l))).toBe(1)
      expect(out.join('\n')).toContain('--ship-run')
      expect(out.join('\n')).toContain(extra[0])
    }
  })
})
