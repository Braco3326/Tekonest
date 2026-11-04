/**
 * Tests for the scripted builder (tools/assets3d/blender/build_from_spec.py). The registry test reads the script and
 * needs no Blender; the rest run the real builder, then the real fix-up and gates through Blender and are skipped when
 * Blender is not installed (like fixup.test.ts). Builder output is the raw GLB of attempt 1: it must come out of the
 * fix-up unrotated and pass every gate.
 */
import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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
import type { AssetSpecT, BuildSpecT } from '../../../tools/assets3d/specSchema'

const BLENDER = findBlender()
const MM = 0.001
const TOL_M = 0.01 * MM

/** The shipped spec of `id` with `build` swapped in (until the real specs carry their own block). */
function specWithBuild(id: string, build: BuildSpecT): AssetSpecT {
  const spec = loadSpecs().find((s) => s.id === id)
  if (!spec) throw new Error(`no spec ${id}`)
  return { ...spec, build }
}

interface Built {
  raw: GlbReport
  rawBytes: Uint8Array
  fix: FixupReport
  fixed: GlbReport
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
        const fix = await runFixup(rawPath, fixedPath, spec)
        const fixed = await inspectGlb(new Uint8Array(await readFile(fixedPath)))
        return { raw: await inspectGlb(rawBytes), rawBytes, fix, fixed, gates: runGates(fixed, spec, buildPlacement(spec)) }
      })()
      cache.set(key, hit)
    }
    return hit
  }

  const xlr = (): AssetSpecT => specWithBuild('xlr3-f', { shape: 'cylinder-plug', params: { frontLenMm: 12 } })

  it.skipIf(!BLENDER)('xlr3-f builds at 19.2 x 19.2 x 72.5 mm with the small mating end at minimum z', async () => {
    const spec = xlr()
    const { raw, rawBytes } = await buildAndFix(spec)
    const size = [0, 1, 2].map((k) => raw.bboxM.max[k] - raw.bboxM.min[k])
    expect(Math.abs(size[0] - 19.2 * MM)).toBeLessThan(TOL_M)
    expect(Math.abs(size[1] - 19.2 * MM)).toBeLessThan(TOL_M)
    expect(Math.abs(size[2] - 72.5 * MM)).toBeLessThan(TOL_M)
    expect(raw.triangles).toBeLessThanOrEqual(800)
    expect(raw.materials).toBe(1)

    const verts = await vertices(rawBytes)
    const zMin = raw.bboxM.min[2]
    const zMax = raw.bboxM.max[2]
    expect(Math.abs(radiusAtZ(verts, zMin) - 15.75 * MM / 2)).toBeLessThan(TOL_M)
    expect(Math.abs(radiusAtZ(verts, zMax) - 19.2 * MM / 2)).toBeLessThan(TOL_M)
  }, 120_000)

  it.skipIf(!BLENDER)('xlr3-f goes through the fix-up unrotated and passes every gate', async () => {
    const { fix, gates } = await buildAndFix(xlr())
    expect(fix.rotatedDegrees).toBe(0)
    expect(gates.filter((g) => !g.ok)).toEqual([])
  }, 120_000)

  it.skipIf(!BLENDER)('a negative size exits non-zero with the BUILD_FAIL reason', async () => {
    const base = xlr()
    const bad = { ...base, realSizeMm: { ...base.realSizeMm, d: -1 } } as AssetSpecT
    await expect(runBuilder(bad, join(dir, 'bad.glb'))).rejects.toThrow(/sizeMm\.d must be a positive/)
  }, 120_000)
})
