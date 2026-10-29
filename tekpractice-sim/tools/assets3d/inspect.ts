/**
 * assets3d/inspect: reads a GLB and reports what the validator and the builder tests need to know about it.
 * Pure over bytes, no fs. Draco is decoded (decoder from draco3dgltf), and the bounding box is computed from the
 * decoded vertex data with every node's world matrix applied, never from accessor min/max (which a compressor or an
 * export bug can leave stale).
 *
 * Everything is in WORLD space, metres: the bbox includes the root node's scale and rotation, and `nodes[].worldPos`
 * are world positions. `rootScale` / `rootRotation` are the scale and quaternion (x, y, z, w) of the single
 * top-level node, identity ([1,1,1] / [0,0,0,1]) when there is none or more than one (check
 * `topLevelCount`: a valid asset has exactly one).
 */
import { NodeIO } from '@gltf-transform/core'
import type { Node } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'

type Vec3 = [number, number, number]
type Quat = [number, number, number, number]

export interface GlbReport {
  bboxM: { min: Vec3; max: Vec3 }
  /** Sum over mesh primitives of indices / 3, or vertices / 3 when the primitive is not indexed. */
  triangles: number
  materials: number
  nodeNames: string[]
  /** Every node of the scene graph (ports and controls included) with its world position in metres. */
  nodes: { name: string; worldPos: Vec3; hasMesh: boolean }[]
  /** Number of top-level nodes across the scenes (a valid asset has exactly 1). */
  topLevelCount: number
  rootScale: Vec3
  rootRotation: Quat
  /** The root node's extras, or null when it has none. */
  extras: unknown
}

/** Applies a column-major 4x4 matrix to a point. */
function transformPoint(m: ArrayLike<number>, x: number, y: number, z: number): Vec3 {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ]
}

/** All nodes of the scene graph, parents before children. */
function collectNodes(roots: Node[]): Node[] {
  const out: Node[] = []
  const walk = (n: Node): void => {
    out.push(n)
    n.listChildren().forEach(walk)
  }
  roots.forEach(walk)
  return out
}

/** Parses `bytes` (a .glb, Draco-compressed or not) and returns its measured report. */
export async function inspectGlb(bytes: Uint8Array): Promise<GlbReport> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
  })
  const doc = await io.readBinary(bytes)
  const root = doc.getRoot()

  const topLevel = root.listScenes().flatMap((s) => s.listChildren())
  const nodes = collectNodes(topLevel)

  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  let triangles = 0
  for (const node of nodes) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const world = node.getWorldMatrix()
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION')
      if (!position) continue
      const count = position.getCount()
      const el: number[] = [0, 0, 0]
      for (let i = 0; i < count; i++) {
        position.getElement(i, el)
        const p = transformPoint(world, el[0], el[1], el[2])
        for (let k = 0; k < 3; k++) {
          if (p[k] < min[k]) min[k] = p[k]
          if (p[k] > max[k]) max[k] = p[k]
        }
      }
      const indices = prim.getIndices()
      triangles += Math.floor((indices ? indices.getCount() : count) / 3)
    }
  }
  const hasGeometry = min[0] !== Infinity
  const single = topLevel.length === 1 ? topLevel[0] : undefined

  return {
    bboxM: hasGeometry ? { min, max } : { min: [0, 0, 0], max: [0, 0, 0] },
    triangles,
    materials: root.listMaterials().length,
    nodeNames: nodes.map((n) => n.getName()),
    nodes: nodes.map((n) => {
      const m = n.getWorldMatrix()
      return { name: n.getName(), worldPos: [m[12], m[13], m[14]] as Vec3, hasMesh: n.getMesh() !== null }
    }),
    topLevelCount: topLevel.length,
    rootScale: single ? (single.getScale().slice() as Vec3) : [1, 1, 1],
    rootRotation: single ? (single.getRotation().slice() as Quat) : [0, 0, 0, 1],
    extras: single && Object.keys(single.getExtras()).length > 0 ? single.getExtras() : null,
  }
}
