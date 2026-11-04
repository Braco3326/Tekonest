/**
 * Night 2 wave 5, P2-2: one tap of an arrow key must turn the camera even when no frame renders while the key is down (a slow PC). The step logic, headless.
 */
import { describe, expect, it } from 'vitest'
import { ORBIT_FEEL } from '../../src/camera/orbitFeel'
import { ArrowTap, tapDirection, tapStepOffset, tapStepTravel, type TapCamera } from '../../src/scene/keyboardOrbitTap'

const LEFT = 37
const UP = 38
const RIGHT = 39
const DOWN = 40
const cam = (inertia: number = ORBIT_FEEL.inertia): TapCamera => ({ inertia, inertialAlphaOffset: 0, inertialBetaOffset: 0 })
/** A key press with a frame counter the test moves by hand (the number of frames rendered). */
const harness = (c: TapCamera = cam()) => {
  let frames = 0
  const tap = new ArrowTap(c, () => frames, () => 0.01)
  return { c, tap, frame: () => void frames++ }
}

describe('the step', () => {
  it('is what one default frame gives once the inertia has played out: 0.01 / (1 - 0.85) rad, about 3.8 degrees', () => {
    expect(tapStepTravel(0.01)).toBeCloseTo(0.0667, 3)
    expect((tapStepTravel(0.01) * 180) / Math.PI).toBeGreaterThan(3.5)
    expect((tapStepTravel(0.01) * 180) / Math.PI).toBeLessThan(4.2)
  })
  it('travels the same total whatever the inertia (the offset is the travel times 1 - inertia): reduced motion has none', () => {
    for (const inertia of [0, 0.5, 0.85, 0.95]) expect(tapStepOffset(0.01, inertia) / (1 - inertia)).toBeCloseTo(tapStepTravel(0.01), 9)
    expect(tapStepOffset(0.01, 0)).toBeCloseTo(0.0667, 3) // no glide: the offset IS the turn
    expect(tapStepOffset(0.01, ORBIT_FEEL.inertia)).toBeCloseTo(0.01, 9) // the default: exactly one Babylon frame
  })
  it('a bad inertia falls back to the default instead of exploding', () => {
    expect(tapStepOffset(0.01, Number.NaN)).toBeCloseTo(0.01, 9)
    expect(Number.isFinite(tapStepOffset(0.01, 5))).toBe(true)
  })
})

describe('directions (Babylon: left alpha -, right alpha +, up beta -, down beta +)', () => {
  it('maps the four arrows and nothing else', () => {
    expect(tapDirection(LEFT)).toEqual({ axis: 'alpha', sign: -1 })
    expect(tapDirection(RIGHT)).toEqual({ axis: 'alpha', sign: 1 })
    expect(tapDirection(UP)).toEqual({ axis: 'beta', sign: -1 })
    expect(tapDirection(DOWN)).toEqual({ axis: 'beta', sign: 1 })
    expect(tapDirection(65)).toBeNull()
  })
})

describe('ArrowTap', () => {
  it('a tap released before any frame adds exactly one step, the right way', () => {
    const h = harness()
    h.tap.down({ keyCode: LEFT })
    h.tap.up({ keyCode: LEFT })
    expect(h.c.inertialAlphaOffset).toBeCloseTo(-0.01, 9)
    expect(h.c.inertialBetaOffset).toBe(0)
    h.tap.down({ keyCode: DOWN })
    h.tap.up({ keyCode: DOWN })
    expect(h.c.inertialBetaOffset).toBeCloseTo(0.01, 9)
  })

  it('a key that was down while a frame rendered adds nothing: Babylon already moved the camera (no double count)', () => {
    const h = harness()
    h.tap.down({ keyCode: RIGHT })
    h.frame()
    h.tap.up({ keyCode: RIGHT })
    expect(h.c.inertialAlphaOffset).toBe(0)
  })

  it('a hold (many frames) adds nothing either, and a held key repeating (OS key-repeat) is ignored', () => {
    const h = harness()
    h.tap.down({ keyCode: LEFT })
    for (let i = 0; i < 5; i++) {
      h.frame()
      h.tap.down({ keyCode: LEFT, repeat: true })
    }
    h.tap.up({ keyCode: LEFT })
    expect(h.c.inertialAlphaOffset).toBe(0)
  })

  it('a repeat that comes first (the keydown was missed) never counts as a tap', () => {
    const h = harness()
    h.tap.down({ keyCode: LEFT, repeat: true })
    h.tap.up({ keyCode: LEFT })
    expect(h.c.inertialAlphaOffset).toBe(0)
  })

  it('two quick taps are two steps', () => {
    const h = harness()
    for (let i = 0; i < 2; i++) {
      h.tap.down({ keyCode: RIGHT })
      h.tap.up({ keyCode: RIGHT })
    }
    expect(h.c.inertialAlphaOffset).toBeCloseTo(0.02, 9)
  })

  it('two keys tapped together are one step each, on their own axis', () => {
    const h = harness()
    h.tap.down({ keyCode: LEFT })
    h.tap.down({ keyCode: UP })
    h.tap.up({ keyCode: LEFT })
    h.tap.up({ keyCode: UP })
    expect(h.c.inertialAlphaOffset).toBeCloseTo(-0.01, 9)
    expect(h.c.inertialBetaOffset).toBeCloseTo(-0.01, 9)
  })

  it('Ctrl (pan), Alt (zoom) and Meta chords are left to Babylon, and so are other keys', () => {
    const h = harness()
    for (const mod of ['ctrlKey', 'altKey', 'metaKey'] as const) {
      h.tap.down({ keyCode: LEFT, [mod]: true })
      h.tap.up({ keyCode: LEFT, [mod]: true })
    }
    h.tap.down({ keyCode: 65 })
    h.tap.up({ keyCode: 65 })
    expect(h.c.inertialAlphaOffset).toBe(0)
    expect(h.c.inertialBetaOffset).toBe(0)
  })

  it('a keyup with no keydown (the key went down elsewhere) adds nothing; reset() forgets a key that was down (focus lost)', () => {
    const h = harness()
    h.tap.up({ keyCode: LEFT })
    expect(h.c.inertialAlphaOffset).toBe(0)
    h.tap.down({ keyCode: LEFT })
    h.tap.reset()
    h.tap.up({ keyCode: LEFT })
    expect(h.c.inertialAlphaOffset).toBe(0)
  })

  it('with no inertia (reduced motion) a tap turns the full step at once', () => {
    const h = harness(cam(0))
    h.tap.down({ keyCode: RIGHT })
    h.tap.up({ keyCode: RIGHT })
    expect(h.c.inertialAlphaOffset).toBeCloseTo(0.0667, 3)
  })
})
