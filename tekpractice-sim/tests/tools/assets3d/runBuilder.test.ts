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
