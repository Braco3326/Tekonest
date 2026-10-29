import { Document, NodeIO } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'
import { inspectGlb } from '../../../tools/assets3d/inspect'
import { makeBoxGlb } from './helpers'

const SIZE = { w: 0.2, h: 0.1, d: 0.3 }
const close = (a: number[], b: number[], tol = 1e-5): void => {
  expect(a).toHaveLength(b.length)
  a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThanOrEqual(tol))
}

describe('inspectGlb', () => {
  it('reports the bounding box of a 0.2 x 0.1 x 0.3 box', async () => {
    const r = await inspectGlb(await makeBoxGlb({ sizeM: SIZE }))
    close(r.bboxM.min, [-0.1, 0, -0.15])
    close(r.bboxM.max, [0.1, 0.1, 0.15])
    expect(r.rootScale).toEqual([1, 1, 1])
    expect(r.rootRotation).toEqual([0, 0, 0, 1])
  })

  it('lists nodes with world positions', async () => {
    const r = await inspectGlb(await makeBoxGlb({
      sizeM: SIZE,
      nodes: [{ name: 'port_in', pos: [0.05, 0.02, 0.15] }, { name: 'ctrl_gain', pos: [0, 0.1, 0] }],
    }))
    expect(r.nodeNames).toEqual(['root', 'port_in', 'ctrl_gain'])
    const port = r.nodes.find((n) => n.name === 'port_in')
    expect(port).toBeDefined()
    close(port!.worldPos, [0.05, 0.02, 0.15])
    expect(port!.hasMesh).toBe(false)
    expect(r.nodes.find((n) => n.name === 'root')!.hasMesh).toBe(true)
  })

  it('counts triangles and materials', async () => {
    const r = await inspectGlb(await makeBoxGlb({ sizeM: SIZE }))
    expect(r.triangles).toBe(12)
    expect(r.materials).toBe(1)
  })

  it('counts vertices / 3 for a non-indexed primitive', async () => {
    const doc = new Document()
    const buffer = doc.createBuffer()
    const pos = doc.createAccessor().setType('VEC3').setBuffer(buffer).setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    const mesh = doc.createMesh('tri').addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos))
    doc.createScene().addChild(doc.createNode('root').setMesh(mesh))
    const r = await inspectGlb(await new NodeIO().writeBinary(doc))
    expect(r.triangles).toBe(1)
    expect(r.materials).toBe(0)
  })

  it('decodes a Draco-compressed file and still reports the true bbox', async () => {
    const bytes = await makeBoxGlb({ sizeM: SIZE, draco: true })
    expect(new TextDecoder('latin1').decode(bytes)).toContain('KHR_draco_mesh_compression')
    const r = await inspectGlb(bytes)
    // quantization-safe tolerance: 0.05 mm = 5e-5 m
    close(r.bboxM.min, [-0.1, 0, -0.15], 5e-5)
    close(r.bboxM.max, [0.1, 0.1, 0.15], 5e-5)
    expect(r.triangles).toBe(12)
  })

  it('returns root extras', async () => {
    const extras = { schema: 1, realSizeMm: { w: 200, h: 100, d: 300 }, ports: [], controls: [] }
    const r = await inspectGlb(await makeBoxGlb({ sizeM: SIZE, extras }))
    expect(r.extras).toEqual(extras)
    expect((await inspectGlb(await makeBoxGlb({ sizeM: SIZE }))).extras).toBeNull()
  })

  it('reports the WORLD bbox and root transform for a scaled, rotated root', async () => {
    // Authored in cm (scale 0.01 on a 20 x 10 x 30 box), rotated 90 degrees about Y.
    const r = await inspectGlb(await makeBoxGlb({
      sizeM: { w: 20, h: 10, d: 30 },
      scale: 0.01,
      rotateYDeg: 90,
      nodes: [{ name: 'port_in', pos: [0, 5, 15] }],
    }))
    // After 90 degrees about Y, x' = z and z' = -x, so the world footprint is 0.3 (x) by 0.2 (z).
    close(r.bboxM.min, [-0.15, 0, -0.1])
    close(r.bboxM.max, [0.15, 0.1, 0.1])
    close(r.rootScale, [0.01, 0.01, 0.01])
    close(r.rootRotation, [0, Math.SQRT1_2, 0, Math.SQRT1_2])
    // Local (0, 5, 15) scales to (0, 0.05, 0.15), then rotates to x' = 0.15, z' = 0.
    close(r.nodes.find((n) => n.name === 'port_in')!.worldPos, [0.15, 0.05, 0])
  })
})
