/**
 * The front correction of a shipped .glb (Task 43c, L34, decision L30 viii): pure maths, Babylon's math types only (no scene, no loader).
 *
 * Mode Création's convention: yaw 0 = the device front faces +z, and the acoustics (coverage, the listening mix) aim along that front. A catalog
 * device may carry `modelFront.axis`, where the front of its .glb faces in glTF model space (measured on the file). DeviceSpawner carries that axis
 * through the root of the imported model (the loader's own turn, the uniform scale) to a direction in the instance frame, then turns the model
 * about y until the direction is +z. Nothing here reads the engine or the catalog: the spawner passes the pieces in.
 */
import { Matrix, Vector3, type AbstractMesh, type TransformNode } from '@babylonjs/core'

/** The four horizontal axes a front can face in glTF model space. */
export const FRONT_AXES = ['+x', '-x', '+z', '-z'] as const
export type FrontAxis = (typeof FRONT_AXES)[number]

const AXIS_VECTOR: Record<FrontAxis, readonly [number, number, number]> = {
  '+x': [1, 0, 0],
  '-x': [-1, 0, 0],
  '+z': [0, 0, 1],
  '-z': [0, 0, -1],
}

/** The declared axis as a vector in glTF model space. */
export const axisVector = (axis: FrontAxis): Vector3 => new Vector3(...AXIS_VECTOR[axis])

/**
 * The unit direction the front faces after the transform `m` (the glb root's matrix, relative to the frame you want the answer in).
 * A direction is transformed, not a point: translation does not enter, and a mirror (a negative scale) is carried as the matrix says.
 */
export function frontDirection(axis: FrontAxis, m: Matrix): Vector3 {
  return Vector3.TransformNormal(axisVector(axis), m).normalize()
}

/**
 * The rotation about +y, in radians, that carries a horizontal direction onto +z. Babylon is left-handed: a turn of θ about +y sends +z to
 * (sin θ, 0, cos θ), so a direction at azimuth atan2(x, z) needs −that. 0 when the direction has no horizontal part (nothing to turn).
 */
export function yawOntoPlusZ(d: { x: number; z: number }): number {
  return Math.hypot(d.x, d.z) < 1e-9 ? 0 : -Math.atan2(d.x, d.z)
}

/** An axis-aligned box. */
export interface Box3 {
  min: Vector3
  max: Vector3
}

/** The 8 corners of every vertex-bearing mesh of `root`'s hierarchy, in the frame of `parent` (a node whose world matrix may include yaw / tilt). */
function localCorners(root: AbstractMesh, parent: TransformNode): Vector3[] {
  parent.computeWorldMatrix(true)
  const inv = Matrix.Invert(parent.getWorldMatrix())
  const out: Vector3[] = []
  for (const m of [root, ...root.getChildMeshes(false)]) {
    if (m.getTotalVertices() === 0) continue
    m.computeWorldMatrix(true)
    for (const c of m.getBoundingInfo().boundingBox.vectorsWorld) out.push(Vector3.TransformCoordinates(c, inv))
  }
  return out
}

/**
 * The bounds of a model in the frame of its parent node (Task 43c fix round). `getHierarchyBoundingVectors` is WORLD-aligned: under a turned or
 * tilted parent it is not the box of the model in the parent's frame, and writing its numbers into the model's local position put the device off its
 * placement (a K12.2 loaded at yaw 180 landed 35 cm away). Mode Création measures here instead.
 */
export function localBounds(root: AbstractMesh, parent: TransformNode): Box3 {
  const min = new Vector3(Infinity, Infinity, Infinity)
  const max = new Vector3(-Infinity, -Infinity, -Infinity)
  for (const p of localCorners(root, parent)) {
    min.minimizeInPlace(p)
    max.maximizeInPlace(p)
  }
  return { min, max }
}

/** The rear face (the −z end, in the parent's frame) of a model: where its connector markers belong. */
export interface RearFace {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  /** The rear plane (min z). */
  z: number
}

/** Vertices within 8 % of the depth of the −z end, measured in the parent's frame (the same slab as the e2e oracle `debugBodyEnds`). */
export function rearFace(root: AbstractMesh, parent: TransformNode): RearFace | null {
  parent.computeWorldMatrix(true)
  const inv = Matrix.Invert(parent.getWorldMatrix())
  const pts: Vector3[] = []
  for (const m of [root, ...root.getChildMeshes(false)]) {
    const data = m.getVerticesData('position')
    if (!data) continue
    const mat = m.computeWorldMatrix(true).multiply(inv)
    for (let i = 0; i + 2 < data.length; i += 3) pts.push(Vector3.TransformCoordinates(new Vector3(data[i], data[i + 1], data[i + 2]), mat))
  }
  if (!pts.length) return null
  const zs = pts.map((p) => p.z)
  const zLo = Math.min(...zs)
  const depth = Math.max(...zs) - zLo
  const slab = pts.filter((p) => p.z <= zLo + 0.08 * depth)
  return {
    xMin: Math.min(...slab.map((p) => p.x)),
    xMax: Math.max(...slab.map((p) => p.x)),
    yMin: Math.min(...slab.map((p) => p.y)),
    yMax: Math.max(...slab.map((p) => p.y)),
    z: zLo,
  }
}

/**
 * Marker positions for `n` ports laid on a rear face: a grid centred on the face, its pitch the labels' pitch (`pitchX` / `pitchY`) shrunk to
 * 70 % of the face so a marker never hangs beside a narrow cabinet; 1.5 cm behind the plane, like the placeholder grid.
 */
export function rearGrid(n: number, face: RearFace, pitchX: number, pitchY: number): Vector3[] {
  if (n === 0) return []
  const cols = Math.min(4, Math.ceil(Math.sqrt(n)))
  const rows = Math.ceil(n / cols)
  const sx = cols > 1 ? Math.min(pitchX, (0.7 * (face.xMax - face.xMin)) / (cols - 1)) : 0
  const sy = rows > 1 ? Math.min(pitchY, (0.7 * (face.yMax - face.yMin)) / (rows - 1)) : 0
  const cx = (face.xMin + face.xMax) / 2
  const cy = (face.yMin + face.yMax) / 2
  const out: Vector3[] = []
  for (let i = 0; i < n; i++) out.push(new Vector3(cx + ((i % cols) - (cols - 1) / 2) * sx, cy + ((rows - 1) / 2 - Math.floor(i / cols)) * sy, face.z - 0.015))
  return out
}
