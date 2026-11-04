/**
 * Where the learner listens from, and which way is RIGHT (Task 39, P14). The pan of every speaker is its direction projected on the listener's
 * RENDERED right vector, so that right is read off the view matrix the renderer uses and never assumed: in Babylon's left-handed world a camera
 * looking toward −z has world −x on its right (the P14 trap), and a handed-ness change would flip the pan silently if it were hard-coded.
 *
 *  - walk view: the scene's active camera (`getViewMatrix()`, `globalPosition`).
 *  - otherwise: the ACTIVE listening point (Task 20), standing there and looking toward the stage (`pointLookAt`); the same `LookAt` matrix Babylon
 *    builds for a camera placed there (left- or right-handed as the scene is).
 * `right` = the inverse view matrix applied to the camera-space +x, i.e. the camera's +x axis in the world.
 */
import { Matrix, Vector3 } from '@babylonjs/core'
import type { ListenerPose } from './listenVoices'

/** The camera's right vector in the world, from its view matrix. */
export function renderedRight(view: Matrix): [number, number, number] {
  const r = Vector3.TransformNormal(Vector3.Right(), view.clone().invert())
  return [r.x, r.y, r.z]
}

/** The walk (or any live) camera: its position and its rendered right. */
export function listenerFromCamera(camera: { getViewMatrix(force?: boolean): Matrix; globalPosition: Vector3 }): ListenerPose {
  const p = camera.globalPosition
  return { position: [p.x, p.y, p.z], right: renderedRight(camera.getViewMatrix(true)) }
}

/** A listening point looking at `lookAt` (up = +y). `rightHanded` = the scene's `useRightHandedSystem` (false in Mode Création). */
export function listenerAtPoint(position: readonly number[], lookAt: readonly number[], rightHanded = false): ListenerPose {
  const eye = Vector3.FromArray(position)
  const target = Vector3.FromArray(lookAt)
  // A look-at straight up or down has no horizontal heading: face the stage end (−z), as `pointPose` does.
  if (Math.hypot(target.x - eye.x, target.z - eye.z) < 1e-9) target.z = eye.z - 1
  const view = rightHanded ? Matrix.LookAtRH(eye, target, Vector3.Up()) : Matrix.LookAtLH(eye, target, Vector3.Up())
  return { position: [eye.x, eye.y, eye.z], right: renderedRight(view) }
}
