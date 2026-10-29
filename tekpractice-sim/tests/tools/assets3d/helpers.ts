/**
 * Test helpers for the assets3d tools: builds small in-memory GLB files with @gltf-transform/core.
 */
import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'

type Vec3 = [number, number, number]

/** Indexed geometry: flat xyz positions, and triangle indices (omit for a non-indexed primitive). */
export interface PrimGeometry {
  positions: number[]
  indices?: number[]
}

/** An indexed box (24 vertices, 12 triangles), pivot bottom-centre: x in [-w/2, w/2], y in [0, h], z in [-d/2, d/2]. */
export function boxGeometry(sizeM: { w: number; h: number; d: number }): Required<PrimGeometry> {
  const { w, h, d } = sizeM
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
  return {
    positions: quads.flat(2),
    indices: quads.flatMap((_, q) => [0, 1, 2, 0, 2, 3].map((i) => q * 4 + i)),
  }
}

export interface MakeMeshGlbOpts {
  /** One mesh with one primitive per entry, all sharing one material. */
  prims: PrimGeometry[]
  /** Empty child nodes of the root (ports, controls), positions local to the root node. */
  nodes?: { name: string; pos: Vec3 }[]
  /** Written on the root node's extras. */
  extras?: object
  /** Compress the mesh with KHR_draco_mesh_compression. */
  draco?: boolean
  /** Uniform scale applied to the ROOT node (a file authored in centimetres uses 0.01). */
  scale?: number
  /** Rotation about Y in degrees applied to the ROOT node, stored as a quaternion. */
  rotateYDeg?: number
  /** Put the mesh on a child node of the root (named 'body') at this local position instead of on the root. */
  meshOnChild?: { pos: Vec3 }
  /** Extra top-level nodes next to the root, without mesh (optionally scaled). */
  strayRoots?: { name: string; scale?: number }[]
  /** Material baseColorFactor (linear RGBA); default is the glTF default [1, 1, 1, 1]. */
  baseColor?: [number, number, number, number]
}

/** Builds a GLB with one root node (carrying the mesh unless `meshOnChild`), and returns its bytes. */
export async function makeMeshGlb(opts: MakeMeshGlbOpts): Promise<Uint8Array> {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const material = doc.createMaterial('body')
  if (opts.baseColor) material.setBaseColorFactor(opts.baseColor)
  const mesh = doc.createMesh('mesh')
  for (const g of opts.prims) {
    const position = doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.positions)).setBuffer(buffer)
    const prim = doc.createPrimitive().setAttribute('POSITION', position).setMaterial(material)
    if (g.indices) prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(g.indices)).setBuffer(buffer))
    mesh.addPrimitive(prim)
  }

  const root = doc.createNode('root')
  if (opts.meshOnChild) root.addChild(doc.createNode('body').setTranslation(opts.meshOnChild.pos).setMesh(mesh))
  else root.setMesh(mesh)
  if (opts.scale !== undefined) root.setScale([opts.scale, opts.scale, opts.scale])
  if (opts.rotateYDeg !== undefined) {
    const half = (opts.rotateYDeg * Math.PI) / 360
    root.setRotation([0, Math.sin(half), 0, Math.cos(half)])
  }
  if (opts.extras) root.setExtras(opts.extras as Record<string, unknown>)
  for (const n of opts.nodes ?? []) root.addChild(doc.createNode(n.name).setTranslation(n.pos))
  const scene = doc.createScene('scene').addChild(root)
  for (const s of opts.strayRoots ?? []) {
    const stray = doc.createNode(s.name)
    if (s.scale !== undefined) stray.setScale([s.scale, s.scale, s.scale])
    scene.addChild(stray)
  }

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

export interface MakeBoxGlbOpts extends Omit<MakeMeshGlbOpts, 'prims'> {
  /** Box size in metres. */
  sizeM: { w: number; h: number; d: number }
}

/** A box (see boxGeometry) under one root node: 24 vertices, 12 triangles, one material. */
export async function makeBoxGlb(opts: MakeBoxGlbOpts): Promise<Uint8Array> {
  const { sizeM, ...rest } = opts
  return makeMeshGlb({ ...rest, prims: [boxGeometry(sizeM)] })
}

/** Reads the 4-byte-aligned chunks of a GLB: the JSON chunk parsed, and everything after it kept verbatim. */
function splitGlb(glb: Uint8Array): { json: Record<string, unknown>; rest: Uint8Array } {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength)
  const jsonLength = view.getUint32(12, true)
  if (view.getUint32(16, true) !== 0x4e4f534a) throw new Error('first GLB chunk is not JSON')
  const text = new TextDecoder().decode(glb.subarray(20, 20 + jsonLength))
  return { json: JSON.parse(text) as Record<string, unknown>, rest: glb.subarray(20 + jsonLength) }
}

/** Reassembles a GLB from a JSON object and the remaining chunks, re-padding the JSON chunk to 4 bytes with spaces. */
function joinGlb(json: Record<string, unknown>, rest: Uint8Array): Uint8Array {
  const raw = new TextEncoder().encode(JSON.stringify(json))
  const padded = new Uint8Array(Math.ceil(raw.length / 4) * 4).fill(0x20)
  padded.set(raw)
  const out = new Uint8Array(12 + 8 + padded.length + rest.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, 0x46546c67, true) // 'glTF'
  view.setUint32(4, 2, true)
  view.setUint32(8, out.length, true)
  view.setUint32(12, padded.length, true)
  view.setUint32(16, 0x4e4f534a, true) // 'JSON'
  out.set(padded, 20)
  out.set(rest, 20 + padded.length)
  return out
}

interface JsonAccessor { min?: number[]; max?: number[] }
interface JsonMesh { primitives: { attributes: { POSITION?: number } }[] }

/** The `min` / `max` written in the JSON of every POSITION accessor (what a lazy reader would trust). */
export function readPositionMinMax(glb: Uint8Array): { min?: number[]; max?: number[] }[] {
  const { json } = splitGlb(glb)
  const accessors = (json.accessors ?? []) as JsonAccessor[]
  const meshes = (json.meshes ?? []) as JsonMesh[]
  return meshes.flatMap((m) => m.primitives).flatMap((p) => (p.attributes.POSITION === undefined ? [] : [accessors[p.attributes.POSITION]]))
    .map((a) => ({ min: a.min, max: a.max }))
}

/**
 * Returns a copy of `glb` whose POSITION accessors declare a deliberately wrong `min` / `max`, with the JSON chunk
 * re-padded and the chunk and total lengths fixed. The vertex data itself is untouched.
 */
export function tamperPositionMinMax(glb: Uint8Array, min: Vec3 = [-9, -9, -9], max: Vec3 = [9, 9, 9]): Uint8Array {
  const { json, rest } = splitGlb(glb)
  const accessors = (json.accessors ?? []) as JsonAccessor[]
  for (const m of (json.meshes ?? []) as JsonMesh[]) {
    for (const p of m.primitives) {
      const a = p.attributes.POSITION === undefined ? undefined : accessors[p.attributes.POSITION]
      if (a) { a.min = min; a.max = max }
    }
  }
  return joinGlb(json, rest)
}
