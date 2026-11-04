/**
 * Task 43c (L34): the pure geometry of the front correction. A model's declared front axis (glTF model space) is carried through the glb root's
 * local transform to a direction in the instance frame; the correction is the rotation about +y that puts that direction on +z (Mode Création's
 * « yaw 0 = the front faces +z »). No scene, no loader: Babylon's math types only.
 */
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core'
import { describe, expect, it } from 'vitest'
import { FRONT_AXES, frontDirection, yawOntoPlusZ, type FrontAxis } from '../../src/scene/modelFront'

/** What a scaled import looks like once DeviceSpawner has set its uniform scale: the loader's root turn of 180 degrees about y, scaling positive. */
const scaledImport = (s = 0.025): Matrix => Matrix.Compose(new Vector3(s, s, s), new Quaternion(0, 1, 0, 0), Vector3.Zero())

const turn = (d: Vector3, yaw: number): Vector3 => Vector3.TransformNormal(d, Matrix.RotationY(yaw))

describe('yawOntoPlusZ', () => {
  it('is 0 for +z, and turns each of the four horizontal axes onto +z', () => {
    expect(yawOntoPlusZ({ x: 0, z: 1 })).toBeCloseTo(0, 12)
    for (const d of [{ x: 0, z: -1 }, { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0.6, z: -0.8 }]) {
      const out = turn(new Vector3(d.x, 0, d.z), yawOntoPlusZ(d))
      expect(out.x, JSON.stringify(d)).toBeCloseTo(0, 6)
      expect(out.z, JSON.stringify(d)).toBeCloseTo(1, 6)
    }
  })
  it('a direction with no horizontal part is left alone (0)', () => {
    expect(yawOntoPlusZ({ x: 0, z: 0 })).toBe(0)
  })
})

describe('frontDirection: the declared axis through the glb root transform', () => {
  it('the identity root leaves the four axes where they are', () => {
    for (const a of FRONT_AXES) {
      const d = frontDirection(a, Matrix.Identity())
      const want = a[1] === 'x' ? new Vector3(a[0] === '+' ? 1 : -1, 0, 0) : new Vector3(0, 0, a[0] === '+' ? 1 : -1)
      expect(Vector3.Distance(d, want), a).toBeLessThan(1e-6)
    }
  })
  it('a scaled import (root turned 180 degrees about y) sends glTF +z to scene -z and glTF -x to scene +x: unit length whatever the scale', () => {
    expect(Vector3.Distance(frontDirection('+z', scaledImport()), new Vector3(0, 0, -1))).toBeLessThan(1e-6)
    expect(Vector3.Distance(frontDirection('-x', scaledImport(3)), new Vector3(1, 0, 0))).toBeLessThan(1e-6)
  })
  it('after the correction every axis, through that import, faces +z', () => {
    for (const a of FRONT_AXES as readonly FrontAxis[]) {
      const d = frontDirection(a, scaledImport())
      const out = turn(d, yawOntoPlusZ(d))
      expect(Vector3.Distance(out, new Vector3(0, 0, 1)), a).toBeLessThan(1e-6)
    }
  })
})
