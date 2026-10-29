/**
 * Test helpers for the assets3d tools: builds small in-memory GLB files with @gltf-transform/core.
 */
import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'

export interface MakeBoxGlbOpts {
  /** Box size in metres. The box pivot is bottom-centre: x in [-w/2, w/2], y in [0, h], z in [-d/2, d/2]. */
  sizeM: { w: number; h: number; d: number }
  /** Empty child nodes of the root (ports, controls), positions local to the root node. */
  nodes?: { name: string; pos: [number, number, number] }[]
  /** Written on the root node's extras. */
  extras?: object
  /** Compress the mesh with KHR_draco_mesh_compression. */
  draco?: boolean
  /** Uniform scale applied to the ROOT node (a file authored in centimetres uses 0.01). */
  scale?: number
  /** Rotation about Y in degrees applied to the ROOT node, stored as a quaternion. */
  rotateYDeg?: number
}

/** Builds an indexed box (24 vertices, 12 triangles, one material) under one root node, and returns the GLB bytes. */
export async function makeBoxGlb(opts: MakeBoxGlbOpts): Promise<Uint8Array> {
  const { w, h, d } = opts.sizeM
  const doc = new Document()
  const buffer = doc.createBuffer()

  // One quad per face so each face has its own vertices (24 in total).
  const x0 = -w / 2, x1 = w / 2, y0 = 0, y1 = h, z0 = -d / 2, z1 = d / 2
  const quads: number[][][] = [
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], // +z
    [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], // -z
    [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], // +x
    [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], // -x
    [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], // +y
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], // -y
  ]
  const positions = new Float32Array(quads.flat(2))
  const indices = new Uint16Array(quads.flatMap((_, q) => [0, 1, 2, 0, 2, 3].map((i) => q * 4 + i)))

  const position = doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer)
  const index = doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer)
  const material = doc.createMaterial('body')
  const prim = doc.createPrimitive().setAttribute('POSITION', position).setIndices(index).setMaterial(material)
  const mesh = doc.createMesh('box').addPrimitive(prim)

  const root = doc.createNode('root').setMesh(mesh)
  if (opts.scale !== undefined) root.setScale([opts.scale, opts.scale, opts.scale])
  if (opts.rotateYDeg !== undefined) {
    const half = (opts.rotateYDeg * Math.PI) / 360
    root.setRotation([0, Math.sin(half), 0, Math.cos(half)])
  }
  if (opts.extras) root.setExtras(opts.extras as Record<string, unknown>)
  for (const n of opts.nodes ?? []) root.addChild(doc.createNode(n.name).setTranslation(n.pos))
  doc.createScene('scene').addChild(root)

  const io = new NodeIO()
  if (opts.draco) {
    doc.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({ method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER })
    io.registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'draco3d.encoder': await draco3d.createEncoderModule(),
      'draco3d.decoder': await draco3d.createDecoderModule(),
    })
  }
  return io.writeBinary(doc)
}
