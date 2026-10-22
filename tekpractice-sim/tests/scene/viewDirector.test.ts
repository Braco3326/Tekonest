import { describe, expect, it } from 'vitest'
import { Vector3 } from '@babylonjs/core'
import { poseFromEye } from '../../src/scene/ViewDirector'

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
