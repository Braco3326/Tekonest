/**
 * CameraRig ⇄ real Babylon ArcRotateCamera (NullEngine, headless).
 * Carry-over fix: Babylon's setTarget(Vector3) STORES the reference, so a reused
 * scratch vector made every later setTarget early-return (equals → return),
 * skipping rebuildAnglesAndRadius and onMeshTargetChangedObservable.
 */
import { describe, expect, it } from 'vitest'
import { ArcRotateCamera, NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { asTweenCamera } from '../../src/scene/CameraRig'

function cam(): ArcRotateCamera {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  return new ArcRotateCamera('c', 0, 1, 10, Vector3.Zero(), scene)
}

describe('asTweenCamera (carry-over: per-frame setTarget must really reach Babylon)', () => {
  it('every frame of a flight notifies onMeshTargetChangedObservable', () => {
    const c = cam()
    const tc = asTweenCamera(c)
    let notified = 0
    c.onMeshTargetChangedObservable.add(() => notified++)
    tc.setTarget({ x: 1, y: 0, z: 0 })
    tc.setTarget({ x: 2, y: 0, z: 0 })
    tc.setTarget({ x: 3, y: 0, z: 0 })
    expect(notified).toBe(3)
    expect(c.target.x).toBe(3)
  })

  it('the camera never shares its target vector across frames', () => {
    const c = cam()
    const tc = asTweenCamera(c)
    tc.setTarget({ x: 1, y: 0, z: 0 })
    const first = c.target
    tc.setTarget({ x: 2, y: 0, z: 0 })
    expect(c.target).not.toBe(first)
    expect(first.x).toBe(1) // the previous frame's vector is left untouched
  })
})
