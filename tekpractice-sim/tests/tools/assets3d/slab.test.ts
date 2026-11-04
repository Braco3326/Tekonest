/**
 * Tests for assets3d/slab: orientSlab turns a slab-like Meshy model (a front panel photographed from the front: the thin axis is the
 * panel's depth) so its thin axis is the casing's depth, and restores the spec's depth proportion, before the fix-up's proportion
 * match (which would otherwise lay the slab flat, since a flat slab matches a 1U / 2U box's proportions less badly than an upright one).
 */
import { describe, expect, it } from 'vitest'
import { inspectGlb } from '../../../tools/assets3d/inspect'
import { orientSlab } from '../../../tools/assets3d/slab'
import { makeBoxGlb } from './helpers'

const SPEC = { w: 480, h: 220, d: 368 }
const ext = async (bytes: Uint8Array): Promise<number[]> => {
  const r = await inspectGlb(bytes)
  return r.bboxM.max.map((v, i) => +(v - r.bboxM.min[i]).toFixed(4))
}

describe('orientSlab', () => {
  it('puts the largest extent on x, the middle one on y, and the thinnest on z stretched to the spec depth proportion', async () => {
    // a slab whose thin axis is y: x 0.30, y 0.02, z 0.10
    const out = await orientSlab(await makeBoxGlb({ sizeM: { w: 0.3, h: 0.02, d: 0.1 } }), SPEC)
    expect(await ext(out)).toEqual([0.3, 0.1, 0.23]) // z = 0.3 x 368 / 480
  })

  it('leaves a slab that already has the thin axis on z as it is, only stretched in depth', async () => {
    const out = await orientSlab(await makeBoxGlb({ sizeM: { w: 0.3, h: 0.12, d: 0.02 } }), SPEC)
    expect(await ext(out)).toEqual([0.3, 0.12, 0.23])
  })

  it('is a proper rotation: no mirrored (negative-determinant) wrapper', async () => {
    const out = await orientSlab(await makeBoxGlb({ sizeM: { w: 0.02, h: 0.3, d: 0.1 } }), SPEC)
    const { NodeIO } = await import('@gltf-transform/core')
    const doc = await new NodeIO().readBinary(out)
    const wrapper = doc.getRoot().listScenes()[0].listChildren()[0]
    const m = wrapper.getMatrix()
    // the 3 x 3 part: det of the rotation columns (the z scale only stretches, so use the sign of the cross product of the first two columns against the third)
    const c0 = [m[0], m[1], m[2]]
    const c1 = [m[4], m[5], m[6]]
    const c2 = [m[8], m[9], m[10]]
    const cross = [c0[1] * c1[2] - c0[2] * c1[1], c0[2] * c1[0] - c0[0] * c1[2], c0[0] * c1[1] - c0[1] * c1[0]]
    expect(cross[0] * c2[0] + cross[1] * c2[1] + cross[2] * c2[2]).toBeGreaterThan(0)
  })

  it('refuses a model that is not slab-like enough (the thinnest axis over 60 percent of the middle one)', async () => {
    await expect(orientSlab(await makeBoxGlb({ sizeM: { w: 0.3, h: 0.2, d: 0.18 } }), SPEC)).rejects.toThrow(/not a slab/)
  })
})
