/**
 * Tests for assets3d/validateGltf (the Khronos glTF validator) and the `validator` gate.
 */
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { dracoCompress, optimizeTextures } from '../../../tools/assets3d/compress'
import { checkValidator } from '../../../tools/assets3d/gates'
import { validateGltf } from '../../../tools/assets3d/validateGltf'
import { makeBoxGlb } from './helpers'

const SIZE = { w: 0.1, h: 0.05, d: 0.2 }
const NODES = [{ name: 'port_in', pos: [0.02, 0.025, 0.1] as [number, number, number] }]

describe('validateGltf', () => {
  it('a plain makeBoxGlb has 0 errors and 0 warnings', async () => {
    const v = await validateGltf(await makeBoxGlb({ sizeM: SIZE, nodes: NODES }))
    expect(v).toEqual({ errors: 0, warnings: 0, messages: [] })
  })

  it('the pipeline output (WebP textures, then Draco) still validates: Draco is an info, never an error', async () => {
    const textured = await makeBoxGlb({ sizeM: SIZE, nodes: NODES, texture: { sizePx: 256, pbr: true } })
    const final = await dracoCompress(await optimizeTextures(textured, { maxPx: 128 }), { quantizePositionBits: 14 })
    const v = await validateGltf(final)
    expect(v.errors).toBe(0)
    expect(checkValidator(v).ok).toBe(true)
  })

  it('a truncated GLB has errors, with the code in the messages', async () => {
    const glb = await makeBoxGlb({ sizeM: SIZE })
    const v = await validateGltf(glb.slice(0, 200))
    expect(v.errors).toBeGreaterThan(0)
    expect(v.messages.join(' ')).toMatch(/GLB_/)
  })

  it('a textured mesh without TEXCOORD_0 has errors naming the material slot', async () => {
    const v = await validateGltf(await makeBoxGlb({ sizeM: SIZE, texture: { sizePx: 64 }, noTexcoord: true }))
    expect(v.errors).toBeGreaterThan(0)
    expect(v.messages[0]).toMatch(/^MESH_PRIMITIVE_TOO_FEW_TEXCOORDS .*\(\/meshes\/0\/primitives\/0\/material\)$/)
  })

  it('loads under plain node + tsx, the way the CLIs run it', () => {
    const script = "const m = await import('./tools/assets3d/validateGltf.ts'); console.log(typeof m.validateGltf)"
    const out = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { cwd: process.cwd(), encoding: 'utf8' })
    expect(out.trim()).toBe('function')
  }, 60_000)
})

describe('checkValidator', () => {
  it('fails on errors, passes with warnings listed in the detail', () => {
    expect(checkValidator({ errors: 0, warnings: 0, messages: [] })).toEqual({ gate: 'validator', ok: true, detail: 'glTF validator: 0 errors, 0 warnings' })
    const warned = checkValidator({ errors: 0, warnings: 1, messages: ['NODE_SKINNED_MESH_WITHOUT_SKIN x'] })
    expect(warned.ok).toBe(true)
    expect(warned.detail).toContain('1 warning: NODE_SKINNED_MESH_WITHOUT_SKIN x')
    const bad = checkValidator({ errors: 2, warnings: 0, messages: ['A a', 'B b'] })
    expect(bad.ok).toBe(false)
    expect(bad.detail).toBe('glTF validator: 2 errors, 0 warnings: A a; B b')
  })

  it('fails closed on non-finite counts', () => {
    expect(checkValidator({ errors: Number.NaN, warnings: 0, messages: [] }).ok).toBe(false)
    expect(checkValidator({ errors: 0, warnings: Number.POSITIVE_INFINITY, messages: [] }).ok).toBe(false)
  })
})
