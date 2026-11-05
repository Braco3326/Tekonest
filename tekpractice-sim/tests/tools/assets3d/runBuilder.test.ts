/**
 * Tests for assets3d/runBuilder (unit, injected exec; no Blender needed): the command line, plan.json, error paths and
 * temp-dir clean-up of the Node side of the scripted builder.
 */
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUILDER_VERSION, BUILD_SCRIPT, runBuilder } from '../../../tools/assets3d/runBuilder'
import type { ExecResult } from '../../../tools/assets3d/runFixup'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'

/** An XLR3-F like connector spec with a build block. */
function plugSpec(over: Partial<AssetSpecT> = {}): AssetSpecT {
  return {
    id: 'test-xlr',
    kind: 'connector',
    tier: 'connector',
    realSizeMm: { w: 19.2, h: 19.2, d: 72.5 },
    ports: [],
    controls: [],
    mating: { role: 'plug', outerMm: 15.75 },
    sources: [],
    build: { shape: 'cylinder-plug', params: { frontLenMm: 12 } },
    ...over,
  }
}

interface Call {
  file: string
  args: string[]
  plan: unknown
  tmp: string
}

function argAfter(args: string[], flag: string): string {
  const i = args.indexOf(flag)
  if (i < 0 || i + 1 >= args.length) throw new Error(`no ${flag} in ${args.join(' ')}`)
  return args[i + 1]
}

/** A fake exec: records the call and reads plan.json; writes nothing. */
function fakeExec(reply: { code?: number; stderr?: string } = {}): { exec: (file: string, args: string[]) => Promise<ExecResult>; calls: Call[] } {
  const calls: Call[] = []
  const exec = async (file: string, args: string[]): Promise<ExecResult> => {
    const planPath = argAfter(args, '--plan')
    const plan: unknown = JSON.parse(await readFile(planPath, 'utf8'))
    calls.push({ file, args, plan, tmp: dirname(planPath) })
    return { code: reply.code ?? 0, stdout: 'Blender 5.2\n', stderr: reply.stderr ?? '' }
  }
  return { exec, calls }
}

describe('runBuilder (unit, injected exec)', () => {
  it('runs Blender headless on build_from_spec.py with the plan and out paths', async () => {
    const { exec, calls } = fakeExec()
    await runBuilder(plugSpec(), 'out/raw.glb', { exec, blender: 'C:/fake/blender.exe' })

    expect(calls).toHaveLength(1)
    const { file, args, plan, tmp } = calls[0]
    expect(file).toBe('C:/fake/blender.exe')
    expect(args).toEqual([
      '--background',
      '--factory-startup',
      '--python-exit-code', '1',
      '--python', BUILD_SCRIPT,
      '--',
      '--plan', join(tmp, 'plan.json'),
      '--out', resolve('out/raw.glb'),
    ])
    expect(plan).toEqual({
      id: 'test-xlr',
      kind: 'connector',
      shape: 'cylinder-plug',
      sizeMm: { w: 19.2, h: 19.2, d: 72.5 },
      matingOuterMm: 15.75,
      params: { frontLenMm: 12 },
    })
  })

  it('writes an empty params object and no matingOuterMm when the spec gives none', async () => {
    const { exec, calls } = fakeExec()
    await runBuilder(plugSpec({ build: { shape: 'rj45-plug' }, mating: undefined }), 'out/raw.glb', { exec, blender: 'b' })
    expect(calls[0].plan).toEqual({
      id: 'test-xlr',
      kind: 'connector',
      shape: 'rj45-plug',
      sizeMm: { w: 19.2, h: 19.2, d: 72.5 },
      params: {},
    })
  })

  it('puts the lathe profile and the zone colours into plan.json', async () => {
    const { exec, calls } = fakeExec()
    const profile: [number, number][] = [[0, 23.4], [20, 26], [117, 33], [140, 51], [162, 5]]
    const colours = [{ fromMm: 0, colour: '#3b3b3e' }, { fromMm: 117, colour: '#9a9a9e' }]
    const spec = plugSpec({ kind: 'device', tier: 'hero', mating: undefined, realSizeMm: { w: 51, h: 162, d: 51 }, build: { shape: 'revolve', params: { segments: 24 }, profile, colours } })
    await runBuilder(spec, 'out/raw.glb', { exec, blender: 'b' })
    expect(calls[0].plan).toMatchObject({ shape: 'revolve', params: { segments: 24 }, profile, colours })
  })

  it('puts the io-face ports with their inset and opening into plan.json for a shape that cuts pockets, and for no other shape', async () => {
    const { exec, calls } = fakeExec()
    const ports: AssetSpecT['ports'] = [
      { portId: 'in-line-a', face: 'io', xMm: 180, yMm: 129, confidence: 'photo', openingMm: 24, insetMm: 27.5 },
      { portId: 'power-in', face: 'io', xMm: 200, yMm: 46, confidence: 'photo', insetMm: 25.8 },
      { portId: 'mic-front', face: 'opposite', xMm: 100, yMm: 100, confidence: 'photo' },
    ]
    const speaker = plugSpec({ id: 'test-speaker', kind: 'device', tier: 'hero', mating: undefined, realSizeMm: { w: 356, h: 602, d: 350 }, ports, build: { shape: 'speaker-cabinet', params: { rearWidthMm: 168, taperDepthMm: 120, chamferMm: 3 } } })
    await runBuilder(speaker, 'out/raw.glb', { exec, blender: 'b' })
    expect((calls[0].plan as { ports: unknown }).ports).toEqual([
      { portId: 'in-line-a', xMm: 180, yMm: 129, insetMm: 27.5, openingMm: 24 },
      { portId: 'power-in', xMm: 200, yMm: 46, insetMm: 25.8 },
    ])
    const box = plugSpec({ kind: 'device', tier: 'hero', mating: undefined, realSizeMm: { w: 100, h: 44, d: 200 }, ports, build: { shape: 'rack-box' } })
    await runBuilder(box, 'out/raw.glb', { exec, blender: 'b' })
    expect(calls[1].plan).not.toHaveProperty('ports')
  })

  it('exposes the builder version recorded in the manifest', () => {
    expect(BUILDER_VERSION).toBe('blender-builder-1')
  })

  it('rejects a spec without a build block, naming the id, before running anything', async () => {
    const { exec, calls } = fakeExec()
    await expect(runBuilder(plugSpec({ build: undefined }), 'out/raw.glb', { exec, blender: 'b' })).rejects.toThrow(/test-xlr.*no build block|no build block.*test-xlr/)
    expect(calls).toHaveLength(0)
  })

  it('throws the validateBuild errors joined, before running anything', async () => {
    const { exec, calls } = fakeExec()
    const spec = plugSpec({ build: { shape: 'cylinder-plug', params: { frontLenmm: 12 } } })
    await expect(runBuilder(spec, 'out/raw.glb', { exec, blender: 'b' })).rejects.toThrow(/frontLenmm/)
    expect(calls).toHaveLength(0)
  })

  it('rejects when Blender is not installed', async () => {
    const { exec } = fakeExec()
    await expect(runBuilder(plugSpec(), 'out/raw.glb', { exec, blender: null })).rejects.toThrow('Blender is not installed')
  })

  it('surfaces the BUILD_FAIL reason of a non-zero exit with the id', async () => {
    const { exec } = fakeExec({ code: 1, stderr: 'noise\nBUILD_FAIL negative size\n' })
    await expect(runBuilder(plugSpec(), 'out/raw.glb', { exec, blender: 'b' })).rejects.toThrow(/test-xlr.*negative size/)
  })

  it('rejects an output path that is not a .glb', async () => {
    const { exec, calls } = fakeExec()
    await expect(runBuilder(plugSpec(), 'out/raw.gltf', { exec, blender: 'b' })).rejects.toThrow(/\.glb/)
    expect(calls).toHaveLength(0)
  })

  it('removes the temp dir after success and after failure', async () => {
    const ok = fakeExec()
    await runBuilder(plugSpec(), 'out/raw.glb', { exec: ok.exec, blender: 'b' })
    expect(existsSync(ok.calls[0].tmp)).toBe(false)

    const bad = fakeExec({ code: 1, stderr: 'BUILD_FAIL boom' })
    await expect(runBuilder(plugSpec(), 'out/raw.glb', { exec: bad.exec, blender: 'b' })).rejects.toThrow()
    expect(existsSync(bad.calls[0].tmp)).toBe(false)
  })
})

describe('runBuilder with a projection (unit, injected exec)', () => {
  const boxSpec = (): AssetSpecT => ({
    id: 'test-rack',
    kind: 'device',
    tier: 'hero',
    realSizeMm: { w: 482.6, h: 88.9, d: 300 },
    ports: [],
    controls: [],
    sources: [],
    build: { shape: 'rack-box' },
  })

  it('writes the picture next to plan.json and puts { face, png } in the plan (the picture exists while Blender runs)', async () => {
    const seen: { exists: boolean; bytes: number[] }[] = []
    const calls: Call[] = []
    const exec = async (file: string, args: string[]): Promise<ExecResult> => {
      const planPath = argAfter(args, '--plan')
      const plan = JSON.parse(await readFile(planPath, 'utf8')) as { projections?: { face: string; png: string }[] }
      calls.push({ file, args, plan, tmp: dirname(planPath) })
      seen.push({ exists: existsSync(plan.projections![0].png), bytes: Array.from(await readFile(plan.projections![0].png)) })
      return { code: 0, stdout: '', stderr: '' }
    }
    await runBuilder(boxSpec(), 'out/raw.glb', { exec, blender: 'C:/fake/blender.exe' }, { face: 'io', png: new Uint8Array([1, 2, 3, 4]) })
    const plan = calls[0].plan as { projections: { face: string; png: string }[] }
    expect(plan.projections.map((p) => p.face)).toEqual(['io'])
    expect(dirname(plan.projections[0].png)).toBe(calls[0].tmp)
    expect(seen[0]).toEqual({ exists: true, bytes: [1, 2, 3, 4] })
    expect(existsSync(calls[0].tmp)).toBe(false) // cleaned up afterwards
  })

  it('leaves the plan without a projections key when none is given', async () => {
    const { exec, calls } = fakeExec()
    await runBuilder(boxSpec(), 'out/raw.glb', { exec, blender: 'C:/fake/blender.exe' })
    expect(calls[0].plan).not.toHaveProperty('projections')
  })

  it('writes one picture per face when given a list, in order', async () => {
    const files: string[] = []
    const calls: Call[] = []
    const exec = async (file: string, args: string[]): Promise<ExecResult> => {
      const planPath = argAfter(args, '--plan')
      const plan = JSON.parse(await readFile(planPath, 'utf8')) as { projections: { face: string; png: string }[] }
      calls.push({ file, args, plan, tmp: dirname(planPath) })
      for (const p of plan.projections) files.push(`${p.face}:${Array.from(await readFile(p.png)).join(',')}`)
      return { code: 0, stdout: '', stderr: '' }
    }
    await runBuilder(boxSpec(), 'out/raw.glb', { exec, blender: 'C:/fake/blender.exe' }, [{ face: 'top', png: new Uint8Array([1]) }, { face: 'io', png: new Uint8Array([2, 3]) }])
    expect(files).toEqual(['top:1', 'io:2,3'])
  })
})
