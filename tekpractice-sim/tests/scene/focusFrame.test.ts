/**
 * N9 (review of Tasks 3–4): the focus pivot is the device BODY bounds — label
 * billboards and the floor shadow blob never move it. Headless NullEngine.
 */
import { describe, expect, it } from 'vitest'
import { MeshBuilder, NullEngine, Scene, TransformNode, Vector3 } from '@babylonjs/core'
import { bodyBounds, bodyCenter, focusFrame } from '../../src/scene/FocusPatch'
import type { DeviceInstance } from '../../src/scene/DeviceSpawner'

function device(withBody = true): DeviceInstance {
  const scene = new Scene(new NullEngine())
  const root = new TransformNode('dev', scene)
  root.position = new Vector3(2, 0, -1)
  if (withBody) {
    const body = MeshBuilder.CreateBox('box', { width: 1, height: 0.4, depth: 0.6 }, scene)
    body.parent = root
    body.position.y = 0.2
    body.metadata = { isDeviceBody: true, instanceId: 'd' }
  }
  // Label billboard far above, shadow blob wide on the floor: NOT the body.
  const label = MeshBuilder.CreatePlane('label:d', { width: 0.8, height: 0.2 }, scene)
  label.parent = root
  label.position.y = 1.5
  const shadow = MeshBuilder.CreatePlane('shadow:d', { size: 3 }, scene)
  shadow.parent = root
  shadow.rotation.x = Math.PI / 2
  return { instanceId: 'd', root } as unknown as DeviceInstance
}

describe('focusFrame = body bounds (N9)', () => {
  it('centres on the body, ignoring label and shadow', () => {
    const f = focusFrame(device())
    expect(f.center.x).toBeCloseTo(2, 6)
    expect(f.center.y).toBeCloseTo(0.2, 6)
    expect(f.center.z).toBeCloseTo(-1, 6)
  })

  it('bounding radius is the body half-diagonal', () => {
    expect(focusFrame(device()).boundingRadius).toBeCloseTo(Math.hypot(1, 0.4, 0.6) / 2, 6)
  })

  it('agrees with bodyCenter (one shared loop)', () => {
    const inst = device()
    expect(focusFrame(inst).center.equalsWithEpsilon(bodyCenter(inst)!, 1e-9)).toBe(true)
    expect(bodyBounds(inst)).not.toBeNull()
  })

  it('falls back to hierarchy bounds when there is no body mesh', () => {
    const inst = device(false)
    expect(bodyBounds(inst)).toBeNull()
    const { min, max } = inst.root.getHierarchyBoundingVectors()
    expect(focusFrame(inst).center.equalsWithEpsilon(min.add(max).scale(0.5), 1e-9)).toBe(true)
  })
})
