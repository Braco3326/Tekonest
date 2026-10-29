/**
 * Tests for assets3d/build-asset (the orchestrator) and compress. Everything runs in temp dirs through deps.paths and
 * injected fakes: a fake Meshy, a stubbed Blender fix-up (it writes a prepared "fixed" GLB), and either the real Draco
 * compressor or a stub. The real public/assets and ASSET_MANIFEST.json are never touched.
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildAsset, formatReport, isMainModule, main, PILOT_IDS, readPhotosFrom, targetPolycount } from '../../../tools/assets3d/build-asset'
import type { BuildDeps, BuildReport } from '../../../tools/assets3d/build-asset'
import { dracoCompress, optimizeTextures } from '../../../tools/assets3d/compress'
import { inspectGlb } from '../../../tools/assets3d/inspect'
import { MeshyError } from '../../../tools/assets3d/meshy'
import type { MeshyTask } from '../../../tools/assets3d/meshy'
import { buildPlacement } from '../../../tools/assets3d/placement'
import type { FixupReport } from '../../../tools/assets3d/runFixup'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'
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
  fixup: { inGlb: string; outGlb: string; yawDeg: number | undefined; inBytes: Uint8Array }[]
  compress: { bits: number }[]
  optimize: { maxPx: number }[]
  /** The order the texture and Draco steps ran in. */
  order: ('optimize' | 'compress')[]
  /** The progress lines buildAsset logged. */
  log: string[]
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
    JSON.stringify({ generated: 'g', assets: [{ id: 'other', status: 'ok', tris: 7 }, { id: 'test-mixer', kind: 'device', optimized: true, tris: 5, status: 'ok', note: 'old' }] }, null, 2),
  )
  calls = { create: [], wait: [], download: [], fixup: [], compress: [], optimize: [], order: [], log: [] }
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
      calls.fixup.push({ inGlb, outGlb, yawDeg: opts?.yawDeg, inBytes: new Uint8Array(await readFile(inGlb)) })
      const bytes = rig.fixed[Math.min(attempt, rig.fixed.length - 1)]
      const report = rig.fixupReports ? rig.fixupReports[Math.min(attempt, rig.fixupReports.length - 1)] : (rig.fixupReport ?? FIXUP_OK)
      attempt++
      await writeFile(outGlb, bytes)
      return report
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
        calls.optimize.push({ maxPx: opts.maxPx })
        return optimizeTextures(bytes, opts)
      }),
    loadSpec: (id) => {
      if (id !== rig.spec.id) throw new Error(`no asset spec "${id}"`)
      return rig.spec
    },
    paths,
    now: () => new Date('2026-10-29T12:00:00.000Z'),
    log: (line) => calls.log.push(line),
  }
}

async function readManifest(): Promise<{ assets: Record<string, unknown>[] }> {
  return JSON.parse(await readFile(paths.manifestPath, 'utf8'))
}

describe('buildAsset', () => {
  it('a passing attempt copies the GLB, records the manifest entry with logosRemoved false and the gates', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['b.png', 'a.png'])
    const fixed = await goodGlb(spec)
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [fixed] }))

    expect(report.ok).toBe(true)
    expect(report.dryRun).toBe(false)
    expect(report.attempts).toHaveLength(1)
    expect(report.attempts[0]).toMatchObject({ n: 1, credits: 20, compression: 'draco' })
    expect(report.attempts[0].gates.map((g) => g.gate)).toEqual(['size', 'transform', 'parts', 'portPositions', 'budget', 'proportionDrift', 'textures'])
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
      note: 'old',
      optimized: true,
      tool: 'meshy',
      toolVersion: 'meshy-7.1',
      date: '2026-10-29T12:00:00.000Z',
      specSource: 'https://example.com/mixer.pdf',
      logosRemoved: false,
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
      [deviceSpec({ id: 'test-hero', tier: 'hero' }), 2800], // floor(0.7 * 4000), the one port has no opening
      [deviceSpec({ id: 'test-ql', tier: 'hero', ports: withOpenings(5) }), 2300], // 2800 - 5 recesses
      [deviceSpec({ id: 'test-many', ports: withOpenings(40) }), 100], // floor
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
    expect((await readdir(work)).sort()).toEqual(['attempt-1.fixed.glb', 'attempt-1.raw.glb', 'attempt-2.fixed.glb', 'attempt-2.raw.glb', 'report.json'])
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
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReport: FIXUP_DRIFT }))

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
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReports: [FIXUP_DRIFT, FIXUP_OK] }))
    expect(report.ok).toBe(true)
    expect(report.attempts.map((a) => a.n)).toEqual([1, 2])
    expect(calls.create).toHaveLength(2)
    expect(existsSync(join(paths.assetsDir, 'test-mixer.glb'))).toBe(true)
  })

  it('proportion drift alone fails an attempt', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const drifted: FixupReport = { ...FIXUP_OK, preScaleSizeM: { w: 10, h: 10, d: 20 } }
    const report = await buildAsset(spec.id, { maxAttempts: 2 }, makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReport: drifted }))
    expect(report.ok).toBe(false)
    expect(report.attempts).toHaveLength(2)
    const failed = report.attempts[0].gates.filter((g) => !g.ok)
    expect(failed.map((g) => g.gate)).toEqual(['proportionDrift'])
    expect(existsSync(join(paths.assetsDir, 'test-mixer.glb'))).toBe(false)
  })

  it('a budget-only failure retries (a Meshy model property), then passes on a lighter model', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await heavyGlb(spec), await goodGlb(spec)] }))
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
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [fixed] }))
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
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [scaled] }))
    expect(calls.create).toHaveLength(1)
    expect(report.attempts[0].gates.filter((g) => !g.ok).map((g) => g.gate)).toContain('transform')
    expect(report.error).toMatch(/transform/)
  })

  it('mixed drift + parts failures abort (the parts failure is ours, a new task cannot fix it)', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await partlessGlb(spec)], fixupReport: FIXUP_DRIFT }))
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
    const report = await buildAsset(spec.id, { maxAttempts: 1 }, makeDeps({ spec, fixed: [fixed], compress, fixupReport: { ...FIXUP_OK, preScaleSizeM: { w: 6, h: 6, d: 20 } } }))

    expect(calls.compress).toEqual([{ bits: 16 }])
    expect(report.ok).toBe(true)
    expect(report.attempts[0].compression).toBe('none')
    expect(report.attempts[0].gates.every((g) => g.ok)).toBe(true)
    expect(new Uint8Array(await readFile(join(paths.assetsDir, 'test-jack.glb')))).toEqual(fixed)
    const manifest = await readManifest()
    expect(manifest.assets.find((a) => a.id === 'test-jack')).toMatchObject({ id: 'test-jack', kind: 'connector', status: 'ok', specSource: 'spec', logosRemoved: false })
  })

  it('a compression failure on a device tier is our defect: it aborts after ONE create and keeps the final bytes', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const bad = await tallGlb(spec)
    const compress: BuildDeps['compress'] = async (_bytes, opts) => {
      calls.compress.push({ bits: opts.quantizePositionBits })
      return bad
    }
    const report = await buildAsset(spec.id, { maxAttempts: 2 }, makeDeps({ spec, fixed: [await goodGlb(spec)], compress }))

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
    const report = await buildAsset(spec.id, { maxAttempts: 2 }, makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReports: [FIXUP_DRIFT, FIXUP_OK], credits: 35 }))
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
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await goodGlb(spec)], downloadError }))
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
    const report = await buildAsset(spec.id, { maxAttempts: 3, rawGlb: rawPath }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))
    expect(calls.create).toHaveLength(0)
    expect(calls.wait).toHaveLength(0)
    expect(calls.download).toHaveLength(0)
    expect(report.ok).toBe(true)
    expect(report.attempts).toHaveLength(1)
    expect(report.attempts[0].credits).toBeNull()
    expect(new Uint8Array(await readFile(join(report.workDir, 'attempt-1.raw.glb')))).toEqual(RAW_BYTES)
    const entry = (await readManifest()).assets.find((a) => a.id === 'test-mixer')
    expect(entry).toMatchObject({ tool: 'raw', toolVersion: 'raw', logosRemoved: false })
  })

  it('--raw makes only one attempt even when it fails', async () => {
    const spec = deviceSpec()
    const rawPath = join(root, 'hand-made.glb')
    await writeFile(rawPath, RAW_BYTES)
    const report = await buildAsset(spec.id, { maxAttempts: 3, rawGlb: rawPath }, makeDeps({ spec, fixed: [await tallGlb(spec)] }))
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
      const report = await buildAsset(spec.id, { maxAttempts: 1, rawGlb: rawPath }, makeDeps({ spec, fixed: [fixed] }))
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
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await goodGlb(spec)], createError }))
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
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await goodGlb(spec)], createError }))
    expect(calls.create).toHaveLength(1)
    expect(report.stopped).toBe('meshy-429')
  })

  it('no photos -> clear error and zero Meshy calls', async () => {
    const spec = deviceSpec()
    await expect(buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))).rejects.toThrow(/no photos/i)
    await mkdir(join(paths.sourceDir, spec.id, 'photos'), { recursive: true })
    await writeFile(join(paths.sourceDir, spec.id, 'photos', 'readme.txt'), 'not an image')
    await expect(buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))).rejects.toThrow(/no photos/i)
    expect(calls.create).toHaveLength(0)
    expect(calls.fixup).toHaveLength(0)
  })

  it('an unknown spec id throws before anything runs', async () => {
    const spec = deviceSpec()
    await expect(buildAsset('nope', { maxAttempts: 1 }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))).rejects.toThrow(/no asset spec "nope"/)
    expect(calls.create).toHaveLength(0)
  })

  it('a failing fix-up (Blender error) aborts without a second paid attempt', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const deps = makeDeps({ spec, fixed: [await goodGlb(spec)] })
    deps.runFixup = async () => {
      throw new Error('Blender fix-up of test-mixer failed (exit 1): FIXUP_FAIL no mesh')
    }
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, deps)
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
    const report = await buildAsset(spec.id, { maxAttempts: 2 }, makeDeps({ spec, fixed: [await goodGlb(spec)], fixupReports: [FIXUP_DRIFT, FIXUP_OK] }))
    expect(report.attempts.map((a) => a.taskId)).toEqual(['task-1', 'task-2'])
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
    expect(calls.log.slice(1)).toEqual(['task task-1: IN_PROGRESS 40%', 'task task-1: SUCCEEDED 100%'])
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
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, deps)
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
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))
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
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, deps)
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
    expect(await main([spec.id], deps2, (l) => out.push(l))).toBe(1)
    expect(out.join(String.fromCharCode(10))).not.toMatch(/result: PASS/)
  })

  it('an invalid manifest fails before any Meshy call', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    for (const content of ['{ nope', '{"generated":"x"}']) {
      await writeFile(paths.manifestPath, content)
      await expect(buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))).rejects.toThrow(/manifest/)
    }
    await rm(paths.manifestPath)
    await expect(buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))).rejects.toThrow(/manifest/)
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
      const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await goodGlb(spec)], compress, fixupReport }))
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
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await goodGlb(spec)], compress }))
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
  it('textures are optimized before Draco and the shipped file is re-gated', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const fixed = await goodGlb(spec, 0, { sizePx: 2048, pbr: true })
    expect((await inspectGlb(fixed)).textures).toHaveLength(3)
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [fixed] }))

    expect(report.ok).toBe(true)
    expect(calls.order).toEqual(['optimize', 'compress'])
    expect(calls.optimize).toEqual([{ maxPx: 1024 }])
    expect(calls.compress).toEqual([{ bits: 14 }])

    const shipped = await inspectGlb(new Uint8Array(await readFile(join(paths.assetsDir, 'test-mixer.glb'))))
    expect(shipped.textures).toHaveLength(3)
    for (const t of shipped.textures) expect(t).toMatchObject({ width: 1024, height: 1024, mimeType: 'image/webp' })
    expect(shipped.triangles).toBe(12)

    const gates = report.attempts[0].gates
    expect(gates.map((g) => g.gate)).toEqual(['size', 'transform', 'parts', 'portPositions', 'budget', 'proportionDrift', 'textures'])
    expect(gates.every((g) => g.ok)).toBe(true)
    expect(gates[6].detail).toContain(String(shipped.fileBytes))
    const entry = (await readManifest()).assets.find((a) => a.id === 'test-mixer')
    expect((entry?.gates as { gate: string }[]).map((g) => g.gate)).toContain('textures')
  })

  it('a connector gets the 512 px limit', async () => {
    const spec = connectorSpec()
    await addPhotos(spec.id, ['a.png'])
    const report = await buildAsset(spec.id, { maxAttempts: 1 }, makeDeps({ spec, fixed: [await goodGlb(spec, 0, { sizePx: 1024 })], fixupReport: { ...FIXUP_OK, preScaleSizeM: { w: 6, h: 6, d: 20 } } }))
    expect(report.ok).toBe(true)
    expect(calls.optimize).toEqual([{ maxPx: 512 }])
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

  it('an oversize final file aborts without a second Meshy create and keeps the raw GLB', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const manifestBefore = await readFile(paths.manifestPath, 'utf8')
    // a no-op texture step on three 1024 px noise maps leaves roughly 9 MB: far over the 1.5 MB standard limit
    const optimize: BuildDeps['optimizeTextures'] = async (bytes) => bytes
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await goodGlb(spec, 0, { sizePx: 1024, noise: true, pbr: true })], optimize }))

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
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await goodGlb(spec, 0, { sizePx: 2048 })], optimize }))
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
      const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await goodGlb(spec)], optimize, fixupReport }))
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
    const report = await buildAsset(spec.id, { maxAttempts: 1 }, makeDeps({ spec, fixed: [await goodGlb(spec, 0, { sizePx: 1024 })], compress, fixupReport: { ...FIXUP_OK, preScaleSizeM: { w: 6, h: 6, d: 20 } } }))
    expect(report.ok).toBe(true)
    expect(report.attempts[0]).toMatchObject({ compression: 'none', textures: 'webp' })
    expect(report.attempts[0].gates.at(-1)).toMatchObject({ gate: 'textures', ok: true })
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
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [noisy], optimize, compress, fixupReport: { ...FIXUP_OK, preScaleSizeM: { w: 6, h: 6, d: 20 } } }))
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
    const report = await buildAsset(spec.id, { maxAttempts: 2 }, makeDeps({ spec, fixed: [await goodGlb(spec)], compress }))
    expect(report.attempts).toHaveLength(1)
    expect(calls.create).toHaveLength(1)
    expect(report.attempts[0].gates.at(-1)?.gate).toBe('textures')
  })

  it('a textures failure on the final bytes keeps the failing gate on the attempt and saves attempt-N.final.glb', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const optimize: BuildDeps['optimizeTextures'] = async (bytes) => bytes
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await goodGlb(spec, 0, { sizePx: 2048 })], optimize }))
    expect(report.ok).toBe(false)
    const textures = report.attempts[0].gates.find((g) => g.gate === 'textures')
    expect(textures?.ok).toBe(false)
    expect(textures?.detail).toMatch(/2048/)
    expect(report.attempts[0].gates.map((g) => g.gate)).toEqual(['size', 'transform', 'parts', 'portPositions', 'budget', 'proportionDrift', 'textures'])
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
    const code = await main([spec.id, '--attempts', '2', '--dry-run'], makeDeps({ spec, fixed: [await goodGlb(spec)] }), (l) => out.push(l))
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
    const code = await main([spec.id, '--attempts', '1'], makeDeps({ spec, fixed: [await tallGlb(spec)] }), (l) => out.push(l))
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
    const code = await main(['--pilot', '--attempts', '2'], deps, (l) => out.push(l))
    expect(code).toBe(1)
    expect(calls.create).toHaveLength(1)
    const text = out.join('\n')
    expect(text).toMatch(/shure-sm58\s+STOPPED/)
    expect(text).toMatch(/yamaha-ql1\s+not run/)
    expect(text).toMatch(/402/)
  })
})

describe('pilot stop rule', () => {
  it('stops at the first report.error of any kind (here a pipeline defect), says which asset stopped', async () => {
    const spec = deviceSpec({ id: 'shure-sm58' })
    const deps = makeDeps({ spec, fixed: [await tallGlb(spec)] })
    deps.loadSpec = () => spec
    for (const id of PILOT_IDS) await addPhotos(id, ['a.png'])
    const out: string[] = []
    const code = await main(['--pilot', '--attempts', '3', '--dry-run'], deps, (l) => out.push(l))
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
    expect(await main(['--pilot', '--attempts', '1', '--dry-run'], deps, (l) => out.push(l))).toBe(1)
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
    const code = await main(['--pilot', '--attempts', '1', '--dry-run'], deps, (l) => out.push(l))
    expect(code).toBe(0) // dry runs never write, so no failure here
    out.length = 0
    const code2 = await main(['--pilot', '--attempts', '1'], deps, (l) => out.push(l))
    expect(code2).toBe(1)
    expect(out.join(String.fromCharCode(10))).toMatch(/shure-sm58\s+FAIL/)
  })
})

describe('formatReport', () => {
  it('says dry run only for a dry run', () => {
    const base: BuildReport = { id: 'x', ok: true, dryRun: true, workDir: 'w', attempts: [] }
    expect(formatReport(base)).toContain('PASS (dry run)')
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
