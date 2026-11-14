import { Matrix, Vector3, type AbstractMesh } from '@babylonjs/core'

type Root = { getChildMeshes(direct: boolean): AbstractMesh[]; computeWorldMatrix(force?: boolean): Matrix }

/**
 * A device's body as the camera shows it, in page CSS px. The box of the body meshes' own bounding boxes in the frame of the instance root (so a yaw does not
 * blur it), its eight corners through the root and `project`, and the box of those points. Cheap: eight corners per body mesh, never the vertices. It holds the
 * vertex box of the same frame (a box of boxes is never smaller). Null when there is no enabled body mesh or a corner does not project (behind the camera).
 */
export function deviceScreenBox(root: Root, project: (world: Vector3) => { x: number; y: number } | null): { x: number; y: number; w: number; h: number } | null {
  const rootWorld = root.computeWorldMatrix(true)
  const inv = Matrix.Invert(rootWorld)
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  const p = new Vector3()
  for (const m of root.getChildMeshes(false)) {
    if (m.metadata?.isDeviceBody !== true || !m.isEnabled()) continue
    const { minimum, maximum } = m.getBoundingInfo()
    const toRoot = m.computeWorldMatrix(true).multiply(inv)
    for (const x of [minimum.x, maximum.x])
      for (const y of [minimum.y, maximum.y])
        for (const z of [minimum.z, maximum.z]) {
          Vector3.TransformCoordinatesFromFloatsToRef(x, y, z, toRoot, p)
          lo[0] = Math.min(lo[0], p.x); lo[1] = Math.min(lo[1], p.y); lo[2] = Math.min(lo[2], p.z)
          hi[0] = Math.max(hi[0], p.x); hi[1] = Math.max(hi[1], p.y); hi[2] = Math.max(hi[2], p.z)
        }
  }
  if (lo[0] === Infinity) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const x of [lo[0], hi[0]])
    for (const y of [lo[1], hi[1]])
      for (const z of [lo[2], hi[2]]) {
        const s = project(Vector3.TransformCoordinates(new Vector3(x, y, z), rootWorld))
        if (s === null || !Number.isFinite(s.x) || !Number.isFinite(s.y)) return null
        x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x); y1 = Math.max(y1, s.y)
      }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}
