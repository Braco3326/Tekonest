import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ArcRotateCamera, NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { poseFromEye, ViewDirector, type Walker } from '../../src/scene/ViewDirector'
import { CameraRig } from '../../src/scene/CameraRig'
import { ORBIT_FEEL } from '../../src/camera/orbitFeel'
import { setMotionOverride } from '../../src/design/tokens'

describe('ViewDirector: parked Explore focus gets the floor guard back (review minor 2)', () => {
  beforeEach(() => setMotionOverride(false)) // cuts: flights end at once
  afterEach(() => setMotionOverride(null))

  const setup = () => {
    const scene = new Scene(new NullEngine())
    const arc = new ArcRotateCamera('arc', 0, 1, 10, Vector3.Zero(), scene)
    arc.lowerBetaLimit = ORBIT_FEEL.lowerBetaLimit
    arc.upperBetaLimit = ORBIT_FEEL.upperBetaLimit
    const walker: Walker = {
      exploreView: true,
      eyePosition: () => new Vector3(0, 0.3, -3), // crouched: looks UP at the device
      lookPoint: () => new Vector3(0, 0.3, 0),
      resume: () => undefined,
      suspend: () => undefined,
    }
    const director = new ViewDirector(scene, arc, new CameraRig(arc), walker)
    return { arc, director }
  }
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  it('relaxes the beta limits to park on the eye, then restores ORBIT_FEEL once the focus flight ends', async () => {
    const { arc, director } = setup()
    director.flyToDevice({ center: new Vector3(0, 1.4, 0), boundingRadius: 0.2 })
    await wait(40)
    expect(arc.lowerBetaLimit).toBeCloseTo(ORBIT_FEEL.lowerBetaLimit, 9)
    expect(arc.upperBetaLimit).toBeCloseTo(ORBIT_FEEL.upperBetaLimit, 9)
  })

  it('relaxes them again for the return flight to the eye (no clamp jump), restores at hand-back', async () => {
    const { arc, director } = setup()
    director.flyToDevice({ center: new Vector3(0, 1.4, 0), boundingRadius: 0.2 })
    await wait(40)
    director.flyToEnsemble()
    // Hand-back is synchronous with reduced motion.
    expect(arc.upperBetaLimit).toBeCloseTo(ORBIT_FEEL.upperBetaLimit, 9)
  })
})

/** ArcRotateCamera position for a pose: target + r·(cos α sin β, cos β, sin α sin β). */
const positionOf = (p: ReturnType<typeof poseFromEye>) =>
  new Vector3(
    p.target.x + p.radius * Math.cos(p.alpha) * Math.sin(p.beta),
    p.target.y + p.radius * Math.cos(p.beta),
    p.target.z + p.radius * Math.sin(p.alpha) * Math.sin(p.beta),
  )

describe('poseFromEye (explore → focus hand-off without a visual jump)', () => {
  it.each([
    [new Vector3(0, 1.65, -5), new Vector3(0, 0.5, 0)],
    [new Vector3(3, 1.2, 2), new Vector3(-1, 0.8, 1)],
    [new Vector3(-2, 2.5, 4), new Vector3(0.5, 0, -3)],
  ])('puts the orbit camera exactly on the eye %o looking at %o', (eye, target) => {
    const pose = poseFromEye(eye, target)
    const at = positionOf(pose)
    expect(at.x).toBeCloseTo(eye.x, 6)
    expect(at.y).toBeCloseTo(eye.y, 6)
    expect(at.z).toBeCloseTo(eye.z, 6)
    expect(pose.target.equals(target)).toBe(true)
  })

  it('never returns a zero radius (eye on the target)', () => {
    expect(poseFromEye(new Vector3(1, 1, 1), new Vector3(1, 1, 1)).radius).toBeGreaterThan(0)
  })
})
