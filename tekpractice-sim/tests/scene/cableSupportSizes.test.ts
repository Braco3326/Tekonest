/**
 * Gravity first (mission 3 A): the devices a cable rests on. Their sizes are one number, one place (the device's own asset spec), a device with no
 * size is no support, a tilted device is no shelf, and a port's outward direction comes from the face it is on.
 */
import { describe, expect, it } from 'vitest'
import sizesJson from '../../src/scene/cableSupportSizes.json'
import { deriveSupportSizes } from '../../tools/cable-support-sizes'
import { deviceSizeM, portFaceLocal, supportBoxes } from '../../src/creation/cableSupport'
import { buildSupport } from '../../src/scene/cableGravity'

describe('support sizes: one number, one place (the asset spec of each device)', () => {
  it('src/scene/cableSupportSizes.json is exactly what the asset specs say (npm run sizes:cables)', () => {
    expect(sizesJson).toEqual(deriveSupportSizes())
  })
  it('the console of the reference rig has its sheet size; an unknown device has none (never invented)', () => {
    expect(deviceSizeM('yamaha-ql1')).toEqual({ w: 0.468, h: 0.272, d: 0.562 })
    expect(deviceSizeM('no-such-device')).toBeNull()
  })
})

describe('supportBoxes', () => {
  const at = (id: string, deviceId: string, y: number, extra: object = {}) => ({ instanceId: id, deviceId, position_m: [1, y, 2] as [number, number, number], yawDeg: 30, ...extra })
  it('one box per placed device with a size, at its bottom centre; unknown sizes and tilted devices are left out', () => {
    const boxes = supportBoxes([at('ql1', 'yamaha-ql1', 0), at('x', 'no-such-device', 0), at('k12', 'qsc-k12-2', 0, { tiltDeg: -10 })])
    expect(boxes).toEqual([{ id: 'ql1', x: 1, z: 2, w: 0.468, d: 0.562, yawDeg: 30, base: 0, h: 0.272 }])
  })
  it('a console on the floor supports a cable at its top; the same console on a 0.75 m stand does not', () => {
    expect(buildSupport(() => 0, supportBoxes([at('ql1', 'yamaha-ql1', 0)])).heightAt(1, 2)).toBeCloseTo(0.272, 12)
    expect(buildSupport(() => 0, supportBoxes([at('ql1', 'yamaha-ql1', 0.75)])).heightAt(1, 2)).toBe(0)
  })
})

describe('portFaceLocal: the face a port is on', () => {
  const size = { w: 0.4, d: 0.3 }
  it('a rear-panel port (local -z, the I/O face) leaves rearwards; a side port sideways', () => {
    expect(portFaceLocal({ x: 0.05, y: 0.1, z: -0.15 }, size)).toEqual({ x: 0, y: 0, z: -1 })
    expect(portFaceLocal({ x: 0.2, y: 0.1, z: 0.02 }, size)).toEqual({ x: 1, y: 0, z: 0 })
  })
  it('a port on no side face (under a microphone, the middle of a top panel) has no outward direction: the cable hangs from it', () => {
    expect(portFaceLocal({ x: 0, y: 0, z: 0 }, size)).toBeNull()
    expect(portFaceLocal({ x: 0.02, y: 0.3, z: 0.03 }, size)).toBeNull()
    expect(portFaceLocal({ x: 0.002, y: 0, z: 0.003 }, null)).toBeNull()
  })
  it('without a size the larger horizontal offset decides', () => {
    expect(portFaceLocal({ x: 0.01, y: 0, z: -0.2 }, null)).toEqual({ x: 0, y: 0, z: -1 })
  })
})
