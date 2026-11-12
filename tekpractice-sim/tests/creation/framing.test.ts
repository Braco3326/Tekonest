/**
 * First-sound framing derived from the canvas height (plan T2.5, T2 review item 6, ruling R-D). A body's size on screen is proportional to the canvas height over
 * the camera distance, so the same pixel size at any height needs a radius proportional to the height; the browser proof is tests/e2e/onboarding-framing.spec.ts.
 */
import { describe, expect, it } from 'vitest'
import { FRAMING_REFERENCE_CANVAS_PX, framingForCanvas } from '../../src/creation/onboarding/framing'
import type { FramingPose } from '../../src/design/packages'

const pose: FramingPose = { alpha: Math.PI / 2, beta: 1.1, radius: 2.2, target: [0, 0, 0] }

describe('framingForCanvas', () => {
  it('keeps the pose at the reference height and scales the radius with the canvas height (the pixel size stays the same)', () => {
    expect(framingForCanvas(pose, FRAMING_REFERENCE_CANVAS_PX).radius).toBeCloseTo(2.2, 6)
    expect(framingForCanvas(pose, 708).radius).toBeCloseTo((2.2 * 708) / FRAMING_REFERENCE_CANVAS_PX, 6)
    expect(framingForCanvas(pose, 1000).radius).toBeCloseTo((2.2 * 1000) / FRAMING_REFERENCE_CANVAS_PX, 6)
  })
  it('never goes under the orbit camera\'s 2 m lower limit, on a short canvas', () => {
    expect(framingForCanvas(pose, 400).radius).toBe(2)
    expect(framingForCanvas(pose, 300).radius).toBe(2)
  })
  it('changes only the radius: angles and target are the package\'s', () => {
    const r = framingForCanvas(pose, 708)
    expect({ ...r, radius: 0 }).toEqual({ ...pose, radius: 0 })
  })
  it('a canvas height that is not a positive finite number leaves the pose alone (never NaN into the camera)', () => {
    for (const h of [0, -5, NaN, Infinity]) expect(framingForCanvas(pose, h)).toEqual(pose)
  })
  it('does not mutate the deep-frozen package pose', () => {
    const frozen = Object.freeze({ ...pose, target: Object.freeze([0, 0, 0]) as unknown as readonly [number, number, number] })
    expect(() => framingForCanvas(frozen, 708)).not.toThrow()
    expect(frozen.radius).toBe(2.2)
  })
})
