/**
 * Tests for assets3d/build-asset (the orchestrator) and compress. Everything runs in temp dirs through deps.paths and
 * injected fakes: a fake Meshy, a stubbed Blender fix-up (it writes a prepared "fixed" GLB), and either the real Draco
 * compressor or a stub. The real public/assets and ASSET_MANIFEST.json are never touched.
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildAsset, formatReport, main, readPhotosFrom } from '../../../tools/assets3d/build-asset'
import type { BuildDeps, BuildReport } from '../../../tools/assets3d/build-asset'
import { dracoCompress } from '../../../tools/assets3d/compress'
import { inspectGlb } from '../../../tools/assets3d/inspect'
import { MeshyError } from '../../../tools/assets3d/meshy'
import type { MeshyTask } from '../../../tools/assets3d/meshy'
import { buildPlacement } from '../../../tools/assets3d/placement'
import type { FixupReport } from '../../../tools/assets3d/runFixup'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'
import { makeBoxGlb } from './helpers'

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
async function goodGlb(spec: AssetSpecT, shiftXM = 0): Promise<Uint8Array> {
  const placement = buildPlacement(spec)
  if (spec.kind === 'connector') {
    return makeBoxGlb({ sizeM: placement.sizeM, meshOnChild: { pos: [shiftXM, -placement.sizeM.h / 2, placement.sizeM.d / 2] } })
  }
  const nodes = [...placement.ports.map((p) => ({ name: p.name, pos: p.pos })), ...placement.controls.map((c) => ({ name: c.name, pos: c.pos }))]
  return makeBoxGlb({ sizeM: placement.sizeM, nodes })
}

/** A device GLB 3 mm too tall: the size gate fails. */
async function tallGlb(spec: AssetSpecT): Promise<Uint8Array> {
  const placement = buildPlacement(spec)
  const nodes = [...placement.ports.map((p) => ({ name: p.name, pos: p.pos })), ...placement.controls.map((c) => ({ name: c.name, pos: c.pos }))]
  return makeBoxGlb({ sizeM: { ...placement.sizeM, h: placement.sizeM.h + 0.003 }, nodes })
}

const FIXUP_OK: FixupReport = { preScaleSizeM: { w: 10, h: 5, d: 20 }, scaleApplied: [0.01, 0.01, 0.01], rotatedDegrees: 0 }
const RAW_BYTES = new Uint8Array([103, 108, 84, 70, 1, 2, 3, 4])
const PHOTO_BYTES = new Uint8Array([137, 80, 78, 71, 1, 2, 3])

interface Calls {
  create: { images: string[]; targetPolycount: number }[]
  wait: string[]
  download: string[]
  fixup: { inGlb: string; outGlb: string; yawDeg: number | undefined; inBytes: Uint8Array }[]
  compress: { bits: number }[]
}

interface Rig {
  spec: AssetSpecT
  /** The fixed GLB the fake fix-up writes for attempt n (the last entry repeats). */
  fixed: Uint8Array[]
  fixupReport?: FixupReport
  compress?: BuildDeps['compress']
  createError?: Error
  downloadError?: Error
  credits?: number
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
  calls = { create: [], wait: [], download: [], fixup: [], compress: [] }
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
        calls.create.push({ images, targetPolycount: opts.targetPolycount })
        if (rig.createError) throw rig.createError
        return `task-${calls.create.length}`
      },
      waitForTask: async (id): Promise<MeshyTask> => {
        calls.wait.push(id)
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
      attempt++
      await writeFile(outGlb, bytes)
      return rig.fixupReport ?? FIXUP_OK
    },
    compress:
      rig.compress ??
      (async (bytes, opts) => {
        calls.compress.push({ bits: opts.quantizePositionBits })
        return dracoCompress(bytes, opts)
      }),
    loadSpec: (id) => {
      if (id !== rig.spec.id) throw new Error(`no asset spec "${id}"`)
      return rig.spec
    },
    paths,
    now: () => new Date('2026-10-29T12:00:00.000Z'),
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
    expect(report.attempts[0].gates.map((g) => g.gate)).toEqual(['size', 'transform', 'parts', 'portPositions', 'budget', 'proportionDrift'])
    expect(report.attempts[0].gates.every((g) => g.ok)).toBe(true)
    expect(calls.create).toHaveLength(1)
    expect(calls.create[0].targetPolycount).toBe(3000)
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

  it('uses 600 triangles for a connector, 3500 for a hero', async () => {
    for (const [spec, expected] of [[connectorSpec(), 600], [deviceSpec({ id: 'test-hero', tier: 'hero' }), 3500]] as const) {
      calls.create.length = 0
      await addPhotos(spec.id, ['a.png'])
      await buildAsset(spec.id, { maxAttempts: 1, dryRun: true }, makeDeps({ spec, fixed: [await goodGlb(spec)] }))
      expect(calls.create[0].targetPolycount).toBe(expected)
    }
  })

  it('saves the raw bytes and the fixed GLB of every attempt under work/ and passes the yaw to the fix-up', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    await buildAsset(spec.id, { maxAttempts: 2, yawDeg: 180, dryRun: true }, makeDeps({ spec, fixed: [await tallGlb(spec), await goodGlb(spec)] }))
    const work = join(paths.sourceDir, spec.id, 'work')
    expect((await readdir(work)).sort()).toEqual(['attempt-1.fixed.glb', 'attempt-1.raw.glb', 'attempt-2.fixed.glb', 'attempt-2.raw.glb'])
    expect(new Uint8Array(await readFile(join(work, 'attempt-1.raw.glb')))).toEqual(RAW_BYTES)
    expect(calls.fixup.map((c) => c.yawDeg)).toEqual([180, 180])
    expect(calls.fixup[0].inGlb).toBe(join(work, 'attempt-1.raw.glb'))
    expect(calls.fixup[0].outGlb).toBe(join(work, 'attempt-1.fixed.glb'))
  })

  it('a failing attempt retries up to maxAttempts then leaves public/assets and the manifest untouched', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const manifestBefore = await readFile(paths.manifestPath, 'utf8')
    const filesBefore = await readdir(paths.assetsDir)
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await tallGlb(spec)] }))

    expect(report.ok).toBe(false)
    expect(report.finalGlb).toBeUndefined()
    expect(report.attempts).toHaveLength(3)
    expect(calls.create).toHaveLength(3)
    expect(report.attempts.map((a) => a.credits)).toEqual([20, 20, 20])
    for (const a of report.attempts) {
      expect(a.gates.find((g) => g.gate === 'size')?.ok).toBe(false)
      expect(a.compression).toBeUndefined()
    }
    expect(calls.compress).toHaveLength(0)
    expect(await readFile(paths.manifestPath, 'utf8')).toBe(manifestBefore)
    expect(await readdir(paths.assetsDir)).toEqual(filesBefore)
  })

  it('stops at the first passing attempt', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const report = await buildAsset(spec.id, { maxAttempts: 3 }, makeDeps({ spec, fixed: [await tallGlb(spec), await goodGlb(spec)] }))
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

  it('compression failure on a device tier fails the attempt', async () => {
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const bad = await tallGlb(spec)
    const compress: BuildDeps['compress'] = async (_bytes, opts) => {
      calls.compress.push({ bits: opts.quantizePositionBits })
      return bad
    }
    const report = await buildAsset(spec.id, { maxAttempts: 2 }, makeDeps({ spec, fixed: [await goodGlb(spec)], compress }))

    expect(report.ok).toBe(false)
    expect(report.attempts).toHaveLength(2)
    const size = report.attempts[0].gates.find((g) => g.gate === 'size')
    expect(size?.ok).toBe(false)
    expect(size?.detail).toMatch(/after Draco/)
    expect(report.attempts[0].compression).toBeUndefined()
    expect(existsSync(join(paths.assetsDir, 'test-mixer.glb'))).toBe(false)
    expect((await readManifest()).assets.find((a) => a.id === 'test-mixer')).not.toHaveProperty('tool')
  })

  it('the report has credits per attempt and no secret', async () => {
    process.env.MESHY_API_KEY = FAKE_KEY
    const spec = deviceSpec()
    await addPhotos(spec.id, ['a.png'])
    const report = await buildAsset(spec.id, { maxAttempts: 2 }, makeDeps({ spec, fixed: [await tallGlb(spec), await goodGlb(spec)], credits: 35 }))
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
    expect(new Uint8Array(await readFile(join(paths.sourceDir, spec.id, 'work', 'attempt-1.raw.glb')))).toEqual(RAW_BYTES)
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
    expect(existsSync(join(paths.sourceDir, spec.id, 'work', 'attempt-1.raw.glb'))).toBe(true)
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

describe('formatReport', () => {
  it('lists each gate once per attempt with PASS or FAIL', () => {
    const report: BuildReport = {
      id: 'x',
      ok: false,
      dryRun: false,
      attempts: [{ n: 1, credits: 20, gates: [{ gate: 'size', ok: false, detail: 'w is off' }, { gate: 'budget', ok: true, detail: 'fine' }] }],
    }
    const text = formatReport(report)
    expect(text).toContain('FAIL  size')
    expect(text).toContain('PASS  budget')
    expect(text).toContain('w is off')
  })
})
