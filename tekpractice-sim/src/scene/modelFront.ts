/**
 * The front correction of a shipped .glb (Task 43c, L34, decision L30 viii): pure maths, Babylon's math types only (no scene, no loader).
 *
 * Mode Création's convention: yaw 0 = the device front faces +z, and the acoustics (coverage, the listening mix) aim along that front. A catalog
 * device may carry `modelFront.axis`, where the front of its .glb faces in glTF model space (measured on the file). DeviceSpawner carries that axis
 * through the root of the imported model (the loader's own turn, the uniform scale) to a direction in the instance frame, then turns the model
 * about y until the direction is +z. Nothing here reads the engine or the catalog: the spawner passes the pieces in.
 */
import { Matrix, Vector3 } from '@babylonjs/core'

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
