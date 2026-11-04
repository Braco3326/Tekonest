import { Matrix, Vector3, type AbstractMesh } from '@babylonjs/core'

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
 * which end its baffle is on (and `rearX` / `rearZ`: where the rear face is, for the port markers), independently of the catalog's declared axis and of the spawner's transform maths. Null when there is no body mesh.
 */
export function debugBodyEnds(inst: { root: { getChildMeshes(direct: boolean): AbstractMesh[] } }): { plusZ: number; minusZ: number; depth: number; rearX: [number, number]; rearZ: number } | null {
  const pts: Vector3[] = []
  for (const m of inst.root.getChildMeshes(false)) {
    if (m.metadata?.isDeviceBody !== true || !m.isEnabled()) continue
    const data = m.getVerticesData('position')
    if (!data) continue
    const w = m.computeWorldMatrix(true)
    for (let i = 0; i + 2 < data.length; i += 3) pts.push(Vector3.TransformCoordinates(new Vector3(data[i], data[i + 1], data[i + 2]), w))
  }
  if (!pts.length) return null
  let zLo = Infinity
  let zHi = -Infinity
  for (const p of pts) {
    zLo = Math.min(zLo, p.z)
    zHi = Math.max(zHi, p.z)
  }
  const depth = zHi - zLo
  const xRange = (sel: (p: Vector3) => boolean): [number, number] => {
    let lo = Infinity
    let hi = -Infinity
    for (const p of pts) if (sel(p)) {
      lo = Math.min(lo, p.x)
      hi = Math.max(hi, p.x)
    }
    return lo === Infinity ? [0, 0] : [lo, hi]
  }
  const span = (r: [number, number]): number => r[1] - r[0]
  const plus = xRange((p) => p.z >= zHi - 0.08 * depth)
  const rear = xRange((p) => p.z <= zLo + 0.08 * depth)
  return { plusZ: span(plus), minusZ: span(rear), depth, rearX: rear, rearZ: zLo }
}

/**
 * e2e oracle for « the device lands on its placement » and « it stands on the floor » (Task 43c fix round): the box of the body's vertices in the FRAME OF THE
 * INSTANCE ROOT (the world vertices through the inverse of the root's world matrix), so a yaw cannot blur it the way a world-aligned box does
 * (`debugBodyCenter`, a box of boxes, reads ~2 cm off for a console turned 200 degrees). A body centred on its placement and grounded reads
 * lo = (-w/2, 0, -d/2), hi = (w/2, h, d/2) here. Null when there is no body mesh.
 */
export function debugBodyBoundsInRoot(inst: { root: { getChildMeshes(direct: boolean): AbstractMesh[]; computeWorldMatrix(force?: boolean): Matrix } }): { lo: [number, number, number]; hi: [number, number, number] } | null {
  const inv = Matrix.Invert(inst.root.computeWorldMatrix(true))
  const lo: [number, number, number] = [Infinity, Infinity, Infinity]
  const hi: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const m of inst.root.getChildMeshes(false)) {
    if (m.metadata?.isDeviceBody !== true || !m.isEnabled()) continue
    const data = m.getVerticesData('position')
    if (!data) continue
    const mat = m.computeWorldMatrix(true).multiply(inv)
    for (let i = 0; i + 2 < data.length; i += 3) {
      const p = Vector3.TransformCoordinates(new Vector3(data[i], data[i + 1], data[i + 2]), mat)
      lo[0] = Math.min(lo[0], p.x); lo[1] = Math.min(lo[1], p.y); lo[2] = Math.min(lo[2], p.z)
      hi[0] = Math.max(hi[0], p.x); hi[1] = Math.max(hi[1], p.y); hi[2] = Math.max(hi[2], p.z)
    }
  }
  return lo[0] === Infinity ? null : { lo, hi }
}
