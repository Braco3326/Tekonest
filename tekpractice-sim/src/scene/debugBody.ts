import { Vector3, type AbstractMesh } from '@babylonjs/core'

/**
 * e2e oracle for the focus pivot (N9 review): the body-mesh box centre, written
 * independently of FocusPatch.bodyBounds/focusFrame (and of the shell's
 * `frameOf`) on purpose (mesh min/max corners, not the bounding-box helpers)
 * so a regression there cannot hide. Shared by legacy `__audioSim` and
 * `__creation` (Task 9).
 */
export function debugBodyCenter(inst: { root: { getChildMeshes(direct: boolean): AbstractMesh[] } }): [number, number, number] | null {
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const m of inst.root.getChildMeshes(false)) {
    if (m.metadata?.isDeviceBody !== true || !m.isEnabled()) continue
    const { minimum, maximum } = m.getBoundingInfo()
    const w = m.computeWorldMatrix(true)
    for (const x of [minimum.x, maximum.x])
      for (const y of [minimum.y, maximum.y])
        for (const z of [minimum.z, maximum.z]) {
          const p = Vector3.TransformCoordinates(new Vector3(x, y, z), w)
          lo[0] = Math.min(lo[0], p.x); lo[1] = Math.min(lo[1], p.y); lo[2] = Math.min(lo[2], p.z)
          hi[0] = Math.max(hi[0], p.x); hi[1] = Math.max(hi[1], p.y); hi[2] = Math.max(hi[2], p.z)
        }
  }
  return lo[0] === Infinity ? null : [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2]
}
