/**
 * assets3d/slab: orients a slab-like Meshy model before the fix-up.
 *
 * Meshy makes a rack unit or a console from front photos as a thin panel: its thinnest axis is the panel's depth, and its depth
 * proportion is a guess. The fix-up picks the 24-rotation match by bounding-box proportions only, and a flat slab (x wide, y thin,
 * z medium) fits a 2U box's proportions less badly than an upright one, so it lays the panel on its back. `orientSlab` removes the
 * ambiguity: a wrapper node rotates the slab so its largest extent is x, the middle one y and the thinnest z (a proper rotation, no
 * mirror), and stretches z so the model has the spec's depth proportion (depth / width of the spec times the new x extent). The
 * fix-up then matches the identity rotation. Front versus back (z sign) and up versus down are left to `--yaw 180` and `--flip`.
 * Used by `asset:build --raw <glb> --slab`.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { inspectGlb } from './inspect'

/** The thinnest axis must be under this share of the middle one for the model to count as a slab. */
const SLAB_RATIO = 0.6

/** Returns `bytes` with every scene root wrapped in a node that orients the slab as described in the file header. */
export async function orientSlab(bytes: Uint8Array, specMm: { w: number; h: number; d: number }): Promise<Uint8Array> {
  const report = await inspectGlb(bytes)
  const ext = report.bboxM.max.map((v, i) => v - report.bboxM.min[i])
  const order = [0, 1, 2].sort((a, b) => ext[b] - ext[a]) // axis indices, largest first
  const [big, mid, thin] = order
  if (!(ext[big] > 0) || !(ext[thin] <= SLAB_RATIO * ext[mid])) {
    throw new Error(`orientSlab: not a slab: the extents are ${ext.map((v) => (v * 1000).toFixed(1)).join(' x ')} mm, the thinnest axis must be under ${SLAB_RATIO * 100} % of the middle one`)
  }
  // rows of R: new x <- big, new y <- mid, new z <- thin; flip the z row when the permutation is odd so the result is a rotation
  const rows: number[][] = [big, mid, thin].map((axis) => [0, 0, 0].map((_, j) => (j === axis ? 1 : 0)))
  const det =
    rows[0][0] * (rows[1][1] * rows[2][2] - rows[1][2] * rows[2][1]) -
    rows[0][1] * (rows[1][0] * rows[2][2] - rows[1][2] * rows[2][0]) +
    rows[0][2] * (rows[1][0] * rows[2][1] - rows[1][1] * rows[2][0])
  if (det < 0) rows[2] = rows[2].map((v) => -v)
  // stretch z so the new depth is spec d / spec w of the new width
  const k = ((specMm.d / specMm.w) * ext[big]) / ext[thin]
  // column-major 4 x 4: M = diag(1, 1, k) * R
  const m = [
    rows[0][0], rows[1][0], rows[2][0] * k, 0,
    rows[0][1], rows[1][1], rows[2][1] * k, 0,
    rows[0][2], rows[1][2], rows[2][2] * k, 0,
    0, 0, 0, 1,
  ]
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await io.readBinary(bytes)
  for (const scene of doc.getRoot().listScenes()) {
    const wrapper = doc.createNode('slab_orient').setMatrix(m as never)
    for (const child of scene.listChildren()) {
      scene.removeChild(child)
      wrapper.addChild(child)
    }
    scene.addChild(wrapper)
  }
  return io.writeBinary(doc)
}
