/**
 * Tests for assets3d/runFixup. The unit block injects a fake `exec` (no Blender needed) and pins the Node <-> Python
 * contract: the command line, plan.json, report.json, error paths and temp-dir clean-up. The integration block runs the
 * real tools/assets3d/blender/fixup.py through Blender and is skipped when Blender is not installed.
 */
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findBlender } from '../../../tools/assets3d/env'
import { checkProportionDrift, runGates } from '../../../tools/assets3d/gates'
import { inspectGlb } from '../../../tools/assets3d/inspect'
import { buildPlacement, toExtras } from '../../../tools/assets3d/placement'
import { FIXUP_SCRIPT, runFixup } from '../../../tools/assets3d/runFixup'
import type { ExecResult, FixupReport } from '../../../tools/assets3d/runFixup'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'
import { makeBoxGlb } from './helpers'

/** The brief's 468 x 44 x 230 mm device: one io port (with an opening, so the recess runs) and one knob on top. */
function deviceSpec(over: Partial<AssetSpecT> = {}): AssetSpecT {
  return {
    id: 'test-desk',
    kind: 'device',
    tier: 'standard',
    realSizeMm: { w: 468, h: 44, d: 230 },
    ports: [{ portId: 'in-mic-1', face: 'io', xMm: 100, yMm: 22, confidence: 'manual', openingMm: 10 }],
    controls: [{ controlId: 'gain-1', kind: 'knob', face: 'top', xMm: 300, yMm: 100, axis: 'y', sizeMm: { w: 12, h: 15, d: 12 } }],
    sources: [],
    ...over,
  }
}

const REPORT: FixupReport = { preScaleSizeM: { w: 50, h: 10, d: 20 }, scaleApplied: [0.00936, 0.0044, 0.0115], rotatedDegrees: 90 }

interface Call {
  file: string
  args: string[]
  plan: unknown
  tmp: string
}

/** Value following `flag` in an argument list. */
function argAfter(args: string[], flag: string): string {
  const i = args.indexOf(flag)
  if (i < 0 || i + 1 >= args.length) throw new Error(`no ${flag} in ${args.join(' ')}`)
  return args[i + 1]
}

/** A fake exec: records the call, reads plan.json, and writes `report` (unless null) to the --report path. */
function fakeExec(reply: { code?: number; stderr?: string; report?: unknown } = {}): {
  exec: (file: string, args: string[]) => Promise<ExecResult>
  calls: Call[]
} {
  const calls: Call[] = []
  const exec = async (file: string, args: string[]): Promise<ExecResult> => {
    const planPath = argAfter(args, '--plan')
    const plan: unknown = JSON.parse(await readFile(planPath, 'utf8'))
    calls.push({ file, args, plan, tmp: dirname(planPath) })
    const report = reply.report === undefined ? REPORT : reply.report
    if (report !== null) await writeFile(argAfter(args, '--report'), JSON.stringify(report))
    return { code: reply.code ?? 0, stdout: 'Blender 5.1\n', stderr: reply.stderr ?? '' }
  }
  return { exec, calls }
}

describe('runFixup (unit, injected exec)', () => {
  it('runs Blender headless on fixup.py with the in, out, plan and report paths', async () => {
    const { exec, calls } = fakeExec()
    await runFixup('raw/in.glb', 'out/fixed.glb', deviceSpec(), {}, { exec, blender: 'C:/fake/blender.exe' })

    expect(calls).toHaveLength(1)
    const { file, args, tmp } = calls[0]
    expect(file).toBe('C:/fake/blender.exe')
    expect(args).toEqual([
      '--background',
      '--factory-startup',
      '--python-exit-code', '1',
      '--python', FIXUP_SCRIPT,
      '--',
      '--in', resolve('raw/in.glb'),
      '--out', resolve('out/fixed.glb'),
      '--plan', join(tmp, 'plan.json'),
      '--report', join(tmp, 'report.json'),
    ])
  })

  it('points at the real fixup.py next to the module', () => {
    expect(FIXUP_SCRIPT.replace(/\\/g, '/')).toMatch(/tools\/assets3d\/blender\/fixup\.py$/)
    expect(existsSync(FIXUP_SCRIPT)).toBe(true)
  })

  it('writes plan.json with the id, kind, yawDeg, placement and extras', async () => {
    const spec = deviceSpec()
    const { exec, calls } = fakeExec()
    await runFixup('in.glb', 'out.glb', spec, { yawDeg: 180 }, { exec, blender: 'blender' })

    const placement = buildPlacement(spec)
    expect(calls[0].plan).toEqual({
      id: 'test-desk',
      kind: 'device',
      yawDeg: 180,
      flipUpright: false,
      placement: JSON.parse(JSON.stringify(placement)),
      extras: JSON.parse(JSON.stringify(toExtras(spec, placement))),
    })
  })

  it('defaults yawDeg to 0 and passes a connector kind through', async () => {
    const connector = deviceSpec({ id: 'test-jack', kind: 'connector', tier: 'connector', realSizeMm: { w: 6, h: 6, d: 20 }, ports: [], controls: [] })
    const { exec, calls } = fakeExec()
    await runFixup('in.glb', 'out.glb', connector, undefined, { exec, blender: 'blender' })
    expect(calls[0].plan).toMatchObject({ kind: 'connector', yawDeg: 0, flipUpright: false })
  })

  it('writes flipUpright true into plan.json when asked, next to the yaw', async () => {
    const { exec, calls } = fakeExec()
    await runFixup('in.glb', 'out.glb', deviceSpec(), { yawDeg: 90, flipUpright: true }, { exec, blender: 'blender' })
    expect(calls[0].plan).toMatchObject({ yawDeg: 90, flipUpright: true })
  })

  it('writes recess false into plan.json only when asked (a scripted model models its own sockets)', async () => {
    const { exec, calls } = fakeExec()
    await runFixup('in.glb', 'out.glb', deviceSpec(), { recess: false }, { exec, blender: 'blender' })
    await runFixup('in.glb', 'out.glb', deviceSpec(), {}, { exec, blender: 'blender' })
    expect(calls[0].plan).toMatchObject({ recess: false })
    expect(calls[1].plan).not.toHaveProperty('recess')
  })

  it('fixup.py skips the port recess cuts when the plan says recess false', () => {
    const py = readFileSync(FIXUP_SCRIPT, 'utf8')
    expect(py).toContain('recess = plan.get("recess", True) is not False')
    expect(py).toContain('if recess and port.get("openingM"):')
  })

  it('fixup.py reads flipUpright and applies FLIP_Z (180 degrees about glTF Z) after the yaw', () => {
    const py = readFileSync(FIXUP_SCRIPT, 'utf8')
    expect(py).toMatch(/flip = plan\.get\("flipUpright", False\) is True/)
    expect(py).toMatch(/FLIP_Z: Mat3 = \[\[-1\.0, 0\.0, 0\.0\], \[0\.0, -1\.0, 0\.0\], \[0\.0, 0\.0, 1\.0\]\]/)
    // composed after the yaw: FLIP_Z @ (yaw @ axis)
    const yawLine = py.indexOf('r_total_g = mat_mul(yaw_matrix(yaw), r_axis)')
    const flipLine = py.indexOf('r_total_g = mat_mul(FLIP_Z, r_total_g)')
    expect(yawLine).toBeGreaterThan(0)
    expect(flipLine).toBeGreaterThan(yawLine)
  })

  it('returns the report that fixup.py wrote', async () => {
    const { exec } = fakeExec()
    await expect(runFixup('in.glb', 'out.glb', deviceSpec(), {}, { exec, blender: 'blender' })).resolves.toEqual(REPORT)
  })

  it('throws with the exit code and stderr when Blender exits non-zero', async () => {
    const { exec } = fakeExec({ code: 1, stderr: 'FIXUP_FAIL the imported model has no mesh\n', report: null })
    const run = runFixup('in.glb', 'out.glb', deviceSpec(), {}, { exec, blender: 'blender' })
    await expect(run).rejects.toThrow(/test-desk.*exit 1/)
    await expect(runFixup('in.glb', 'out.glb', deviceSpec(), {}, { exec, blender: 'blender' })).rejects.toThrow(
      'FIXUP_FAIL the imported model has no mesh',
    )
  })

  it('throws when Blender exits 0 but writes no report', async () => {
    const { exec } = fakeExec({ report: null })
    await expect(runFixup('in.glb', 'out.glb', deviceSpec(), {}, { exec, blender: 'blender' })).rejects.toThrow(/no report/)
  })

  it('throws on a malformed report instead of returning it', async () => {
    const bad = [
      { ...REPORT, rotatedDegrees: 'ninety' },
      { ...REPORT, scaleApplied: [1, 1] },
      { ...REPORT, preScaleSizeM: { w: 1, h: 1 } },
      { preScaleSizeM: REPORT.preScaleSizeM, scaleApplied: REPORT.scaleApplied },
    ]
    for (const report of bad) {
      const { exec } = fakeExec({ report })
      await expect(runFixup('in.glb', 'out.glb', deviceSpec(), {}, { exec, blender: 'blender' })).rejects.toThrow(/malformed report/)
    }
  })

  it('says Blender is not installed (and names BLENDER_EXE) when none is found, without running anything', async () => {
    const { exec, calls } = fakeExec()
    const run = runFixup('in.glb', 'out.glb', deviceSpec(), {}, { exec, blender: null })
    await expect(run).rejects.toThrow(/Blender is not installed/)
    await expect(runFixup('in.glb', 'out.glb', deviceSpec(), {}, { exec, blender: null })).rejects.toThrow(/BLENDER_EXE/)
    expect(calls).toHaveLength(0)
  })

  it('rejects a yaw that is not a multiple of 90 degrees', async () => {
    const { exec, calls } = fakeExec()
    await expect(runFixup('in.glb', 'out.glb', deviceSpec(), { yawDeg: 45 as never }, { exec, blender: 'blender' })).rejects.toThrow(/yawDeg/)
    expect(calls).toHaveLength(0)
  })

  it('rejects an output path that is not a .glb', async () => {
    const { exec, calls } = fakeExec()
    await expect(runFixup('in.glb', 'out.gltf', deviceSpec(), {}, { exec, blender: 'blender' })).rejects.toThrow(/\.glb/)
    expect(calls).toHaveLength(0)
  })

  it('removes its temp dir after a success and after a failure', async () => {
    const ok = fakeExec()
    await runFixup('in.glb', 'out.glb', deviceSpec(), {}, { exec: ok.exec, blender: 'blender' })
    expect(existsSync(ok.calls[0].tmp)).toBe(false)

    const failing = fakeExec({ code: 3, stderr: 'FIXUP_FAIL x', report: null })
    await expect(runFixup('in.glb', 'out.glb', deviceSpec(), {}, { exec: failing.exec, blender: 'blender' })).rejects.toThrow()
    expect(existsSync(failing.calls[0].tmp)).toBe(false)
  })

  it('the default exec reports a real process exit code and stderr (node standing in for Blender)', async () => {
    // node rejects --background as a bad option (exit 9): proves the execFile wrapper resolves with code and stderr.
    const err = await runFixup('in.glb', 'out.glb', deviceSpec(), {}, { blender: process.execPath }).catch((e: Error) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toMatch(/exit [1-9]\d*/)
    expect((err as Error).message).toMatch(/bad option/)
  })
})

const BLENDER = findBlender()
const SKIP_REASON = 'Blender not found: install Blender 5.1 or set BLENDER_EXE'

describe(`runFixup with real Blender (${BLENDER ? `using ${BLENDER}` : `SKIPPED, ${SKIP_REASON}`})`, () => {
  let dir = ''
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tekpractice-fixup-it-'))
  })
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it.skipIf(!BLENDER)(
    'a box authored in centimetres and turned 90 degrees comes out at spec size, pivot, parts and extras: all gates pass',
    async () => {
      const spec = deviceSpec()
      const placement = buildPlacement(spec)
      const raw = join(dir, 'cm-rotated.glb')
      const out = join(dir, 'cm-rotated.fixed.glb')
      // 0.5 x 0.1 x 0.2 m box with a root scale of 100 (modelled in cm, read as metres) and a 90 degree yaw.
      await writeFile(raw, await makeBoxGlb({ sizeM: { w: 0.5, h: 0.1, d: 0.2 }, scale: 100, rotateYDeg: 90 }))

      const fix = await runFixup(raw, out, spec)

      expect(fix.rotatedDegrees).toBe(90)
      expect(fix.preScaleSizeM.w).toBeCloseTo(50, 3)
      expect(fix.preScaleSizeM.h).toBeCloseTo(10, 3)
      expect(fix.preScaleSizeM.d).toBeCloseTo(20, 3)
      expect(fix.scaleApplied[0]).toBeCloseTo(0.468 / 50, 6)
      expect(fix.scaleApplied[1]).toBeCloseTo(0.044 / 10, 6)
      expect(fix.scaleApplied[2]).toBeCloseTo(0.23 / 20, 6)

      const report = await inspectGlb(await readFile(out))
      const failed = runGates(report, spec, placement).filter((g) => !g.ok)
      expect(failed).toEqual([])

      const extras = (report.extras as { tekpractice?: ReturnType<typeof toExtras> } | null)?.tekpractice
      const wanted = toExtras(spec, placement)
      expect(extras?.schema).toBe(1)
      expect(extras?.realSizeMm).toEqual(wanted.realSizeMm)
      expect(extras?.ports.map((p) => p.portId)).toEqual(['in-mic-1'])
      expect(extras?.controls.map((c) => [c.controlId, c.axis, c.kind])).toEqual([['gain-1', 'y', 'knob']])
      extras?.ports[0].pos.forEach((v, i) => expect(v).toBeCloseTo(wanted.ports[0].pos[i], 6))
    },
    120_000,
  )

  it.skipIf(!BLENDER)(
    'proportion drift above 5 percent is reported, not hidden',
    async () => {
      const spec = deviceSpec()
      const placement = buildPlacement(spec)
      const raw = join(dir, 'wide.glb')
      const out = join(dir, 'wide.fixed.glb')
      // 20 percent too wide: the fix-up still scales it to the spec size, but the report keeps the evidence.
      await writeFile(raw, await makeBoxGlb({ sizeM: { w: 0.468 * 1.2, h: 0.044, d: 0.23 } }))

      const fix = await runFixup(raw, out, spec)

      expect(fix.rotatedDegrees).toBe(0)
      expect(fix.preScaleSizeM.w).toBeCloseTo(0.468 * 1.2, 4)
      const drift = checkProportionDrift(fix.preScaleSizeM, spec)
      expect(drift.ok).toBe(false)
      expect(drift.detail).toMatch(/drift/)

      const report = await inspectGlb(await readFile(out))
      expect(runGates(report, spec, placement).filter((g) => !g.ok)).toEqual([])
    },
    120_000,
  )
})
