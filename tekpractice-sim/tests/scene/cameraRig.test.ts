/**
 * CameraRig ⇄ real Babylon ArcRotateCamera (NullEngine, headless).
 * Carry-over fix: Babylon's setTarget(Vector3) STORES the reference, so a reused
 * scratch vector made every later setTarget early-return (equals → return),
 * skipping rebuildAnglesAndRadius and onMeshTargetChangedObservable.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ArcRotateCamera, NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { asTweenCamera, CameraRig } from '../../src/scene/CameraRig'
import { ENSEMBLE_LOWER_RADIUS, radiusLimitFor } from '../../src/camera/orbitFeel'
import { setMotionOverride } from '../../src/design/tokens'

function cam(): ArcRotateCamera {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  return new ArcRotateCamera('c', 0, 1, 10, Vector3.Zero(), scene)
}

/** Let the rig's flight-completion microtasks run (reduced motion = instant cut). */
const settle = () => new Promise((r) => setTimeout(r, 0))

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

describe('CameraRig.repivot (Task 4: orbit around a floor point)', () => {
  beforeEach(() => setMotionOverride(false))
  afterEach(() => setMotionOverride(null))

  it('moves only the target: alpha, beta and radius are kept', async () => {
    const c = cam()
    c.alpha = 0.7
    c.beta = 1.1
    c.radius = 9
    const rig = new CameraRig(c)
    rig.repivot(new Vector3(2, 0, -3))
    await settle()
    expect(c.target.asArray()).toEqual([2, 0, -3])
    expect(c.alpha).toBeCloseTo(0.7, 9)
    expect(c.beta).toBeCloseTo(1.1, 9)
    expect(c.radius).toBeCloseTo(9, 9)
  })

  it('never clamps the radius when re-pivoting from a close focus', async () => {
    const c = cam()
    const rig = new CameraRig(c)
    rig.flyToDevice({ center: new Vector3(0, 0.3, 0), boundingRadius: 0.1 }) // radius 0.9
    await settle()
    rig.repivot(new Vector3(1, 0, 1))
    await settle()
    expect(c.radius).toBeCloseTo(0.9, 6)
  })
})

describe('CameraRig dolly floor (Task 3: focus lets you come close, Ensemble does not)', () => {
  beforeEach(() => setMotionOverride(false)) // cuts: deterministic, no render loop needed
  afterEach(() => setMotionOverride(null))

  it('focus sets lowerRadiusLimit = radiusLimitFor(boundingRadius)', async () => {
    const c = cam()
    c.lowerRadiusLimit = ENSEMBLE_LOWER_RADIUS
    const rig = new CameraRig(c)
    rig.flyToDevice({ center: new Vector3(1, 0.5, 0), boundingRadius: 0.2 })
    await settle()
    expect(c.lowerRadiusLimit).toBeCloseTo(radiusLimitFor(0.2), 9)
  })

  it('back to Ensemble restores the env default (2)', async () => {
    const c = cam()
    c.lowerRadiusLimit = ENSEMBLE_LOWER_RADIUS
    const rig = new CameraRig(c)
    rig.flyToDevice({ center: new Vector3(1, 0.5, 0), boundingRadius: 0.2 })
    await settle()
    rig.flyToEnsemble()
    await settle()
    expect(c.lowerRadiusLimit).toBe(ENSEMBLE_LOWER_RADIUS)
  })

  it('never clamps the camera mid-way: the limit never exceeds the radius it is leaving', async () => {
    const c = cam()
    const rig = new CameraRig(c)
    rig.flyToDevice({ center: new Vector3(0, 0.3, 0), boundingRadius: 0.1 }) // close-up, radius 0.9
    await settle()
    expect(c.radius).toBeCloseTo(0.9, 6)
    rig.flyToDevice({ center: new Vector3(3, 1, 0), boundingRadius: 2 }) // big device: limit 2.4
    // At the start of the new flight the floor must not exceed where the camera stood (0.9).
    expect(c.lowerRadiusLimit).not.toBeNull()
    expect(c.lowerRadiusLimit!).toBeLessThanOrEqual(0.9 + 1e-6)
    await settle()
    expect(c.lowerRadiusLimit).toBeCloseTo(radiusLimitFor(2), 9)
  })
})

describe('CameraRig.flyToPreset (Task 5)', () => {
  beforeEach(() => setMotionOverride(false))
  afterEach(() => setMotionOverride(null))

  it('under reduced motion it is a cut: the pose lands at once and the flight time is 0', async () => {
    const c = cam()
    const rig = new CameraRig(c)
    const ms = rig.flyToPreset({ alpha: 1.2, beta: 0.9, radius: 4, target: new Vector3(1, 0.5, -2) })
    await settle()
    expect(ms).toBe(0)
    expect(c.alpha).toBeCloseTo(1.2, 9)
    expect(c.beta).toBeCloseTo(0.9, 9)
    expect(c.radius).toBeCloseTo(4, 9)
    expect(c.target.asArray()).toEqual([1, 0.5, -2])
  })
})
