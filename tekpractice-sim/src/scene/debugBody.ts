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

/**
 * e2e oracle for the front of a loudspeaker model (Task 43c, L34): the x-extent of the body vertices in the 8 % slab of the z range at each end, read from
 * the live meshes in WORLD axes (use it at yaw 0, no tilt). A cabinet wider at one end than at the other (the K12.2: 14 in baffle, 6.6 in amplifier end) says
 * which end its baffle is on, independently of the catalog's declared axis and of the spawner's transform maths. Null when there is no body mesh.
 */
export function debugBodyEnds(inst: { root: { getChildMeshes(direct: boolean): AbstractMesh[] } }): { plusZ: number; minusZ: number; depth: number } | null {
  const pts: Vector3[] = []
  for (const m of inst.root.getChildMeshes(false)) {
    if (m.metadata?.isDeviceBody !== true || !m.isEnabled()) continue
    const data = m.getVerticesData('position')
    if (!data) continue
    const w = m.computeWorldMatrix(true)
    for (let i = 0; i + 2 < data.length; i += 3) pts.push(Vector3.TransformCoordinates(new Vector3(data[i], data[i + 1], data[i + 2]), w))
  }
  if (!pts.length) return null
  const zLo = Math.min(...pts.map((p) => p.z))
  const zHi = Math.max(...pts.map((p) => p.z))
  const depth = zHi - zLo
  const xSpan = (sel: (p: Vector3) => boolean): number => {
    const xs = pts.filter(sel).map((p) => p.x)
    return xs.length ? Math.max(...xs) - Math.min(...xs) : 0
  }
  return { plusZ: xSpan((p) => p.z >= zHi - 0.08 * depth), minusZ: xSpan((p) => p.z <= zLo + 0.08 * depth), depth }
}
