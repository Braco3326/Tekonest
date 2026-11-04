import { Document, NodeIO } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'
import { inspectGlb } from '../../../tools/assets3d/inspect'
import { boxGeometry, makeBoxGlb, makeMeshGlb, readPositionMinMax, tamperPositionMinMax } from './helpers'

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

  it('topLevelCount is 1 for a single root', async () => {
    const r = await inspectGlb(await makeBoxGlb({ sizeM: SIZE }))
    expect(r.topLevelCount).toBe(1)
  })

  it('topLevelCount is 2 with a stray root, and rootScale stays identity', async () => {
    const r = await inspectGlb(await makeBoxGlb({ sizeM: SIZE, strayRoots: [{ name: 'stray', scale: 3 }] }))
    expect(r.topLevelCount).toBe(2)
    expect(r.rootScale).toEqual([1, 1, 1])
    expect(r.rootRotation).toEqual([0, 0, 0, 1])
    expect(r.extras).toBeNull()
    expect(r.nodeNames).toEqual(['root', 'stray'])
  })

  it('applies a scaled, rotated parent to a mesh on a CHILD node', async () => {
    // Child at local (0, 0, 0.5) under a parent scaled 2 and rotated 90 degrees about Y (x' = z, z' = -x):
    // the child offset becomes (1, 0, 0); the 0.2 x 0.1 x 0.3 box becomes 0.6 (x) x 0.2 (y) x 0.4 (z) around it.
    const r = await inspectGlb(await makeMeshGlb({
      prims: [boxGeometry(SIZE)],
      scale: 2,
      rotateYDeg: 90,
      meshOnChild: { pos: [0, 0, 0.5] },
    }))
    close(r.bboxM.min, [0.7, 0, -0.2])
    close(r.bboxM.max, [1.3, 0.2, 0.2])
    expect(r.nodes.find((n) => n.name === 'root')!.hasMesh).toBe(false)
    expect(r.nodes.find((n) => n.name === 'body')!.hasMesh).toBe(true)
    close(r.nodes.find((n) => n.name === 'body')!.worldPos, [1, 0, 0])
  })

  it('sums the triangles of two primitives in one mesh and unions their bbox', async () => {
    const quad = { positions: [0, 0.5, 0, 1, 0.5, 0, 1, 0.5, 1, 0, 0.5, 1], indices: [0, 1, 2, 0, 2, 3] }
    const r = await inspectGlb(await makeMeshGlb({ prims: [boxGeometry(SIZE), quad] }))
    expect(r.triangles).toBe(12 + 2)
    close(r.bboxM.min, [-0.1, 0, -0.15])
    close(r.bboxM.max, [1, 0.5, 1])
  })
})

/** 300 scattered vertices (deterministic), so the Draco quantization error is non-zero on most axes. */
function scatteredGeometry(): { positions: number[]; indices: number[]; bbox: { min: number[]; max: number[] } } {
  let seed = 12345
  const rnd = (): number => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
  const positions: number[] = []
  for (let i = 0; i < 300; i++) positions.push(-0.45 + rnd() * 0.9, rnd() * 0.8, -0.3 + rnd() * 0.6)
  const indices: number[] = []
  for (let i = 0; i + 2 < 300; i++) indices.push(i, i + 1, i + 2)
  const f32 = Array.from(new Float32Array(positions))
  const axis = (k: number): number[] => f32.filter((_, i) => i % 3 === k)
  return {
    positions,
    indices,
    bbox: { min: [0, 1, 2].map((k) => Math.min(...axis(k))), max: [0, 1, 2].map((k) => Math.max(...axis(k))) },
  }
}

describe('inspectGlb takes the bbox from decoded vertices, not from accessor min/max', () => {
  it('recovers the true bbox of a scattered (non-corner) mesh after Draco', async () => {
    const g = scatteredGeometry()
    const bytes = await makeMeshGlb({ prims: [g], draco: true })
    expect(new TextDecoder('latin1').decode(bytes)).toContain('KHR_draco_mesh_compression')
    const r = await inspectGlb(bytes)
    close(r.bboxM.min, g.bbox.min, 5e-5)
    close(r.bboxM.max, g.bbox.max, 5e-5)
    expect(r.triangles).toBe(298)
  })

  for (const draco of [false, true]) {
    it(`ignores wrong POSITION min/max in the GLB JSON (draco: ${draco})`, async () => {
      const g = scatteredGeometry()
      const original = await makeMeshGlb({ prims: [g], draco })
      const tampered = tamperPositionMinMax(original)
      // The tamper really changed what the file declares, and left it a loadable GLB.
      expect(readPositionMinMax(original)[0].max).not.toEqual([9, 9, 9])
      expect(readPositionMinMax(tampered)).toEqual([{ min: [-9, -9, -9], max: [9, 9, 9] }])
      expect(tampered.length % 4).toBe(0)
      const before = await inspectGlb(original)
      const after = await inspectGlb(tampered)
      expect(after.bboxM).toEqual(before.bboxM)
      expect(after.triangles).toBe(before.triangles)
      close(after.bboxM.min, g.bbox.min, 5e-5)
      close(after.bboxM.max, g.bbox.max, 5e-5)
    })
  }
})

describe('inspectGlb textures and file size', () => {
  it('reports textures and fileBytes', async () => {
    const plain = await makeBoxGlb({ sizeM: SIZE })
    const none = await inspectGlb(plain)
    expect(none.textures).toEqual([])
    expect(none.fileBytes).toBe(plain.byteLength)

    const textured = await makeBoxGlb({ sizeM: SIZE, texture: { sizePx: 128, pbr: true } })
    const r = await inspectGlb(textured)
    expect(r.fileBytes).toBe(textured.byteLength)
    expect(r.textures).toEqual([
      { name: 'baseColor', width: 128, height: 128, mimeType: 'image/png' },
      { name: 'normal', width: 128, height: 128, mimeType: 'image/png' },
      { name: 'metallicRoughness', width: 128, height: 128, mimeType: 'image/png' },
    ])
  })

  it('fails loudly when a texture size cannot be read', async () => {
    const doc = new Document()
    const buffer = doc.createBuffer()
    const pos = doc.createAccessor().setType('VEC3').setBuffer(buffer).setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    const mesh = doc.createMesh('tri').addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos))
    const texture = doc.createTexture('broken').setImage(new Uint8Array([1, 2, 3, 4])).setMimeType('image/png')
    doc.createMaterial('m').setBaseColorTexture(texture)
    doc.createScene().addChild(doc.createNode('root').setMesh(mesh))
    await expect(inspectGlb(await new NodeIO().writeBinary(doc))).rejects.toThrow(/texture "broken".*size/i)
  })
})
