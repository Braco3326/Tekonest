import { describe, expect, it } from 'vitest'
import { screenViewPose, seesFront, type ScreenFrame } from '../../src/controls/screenView'

const FOV = 0.8
/** A top-face screen: normal up, picture-up toward the rear (-z), 0.21 x 0.135 m. */
const top: ScreenFrame = { center: [1, 0.2, 2], normal: [0, 1, 0], up: [0, 0, -1], w: 0.21, h: 0.135 }
/** A front-panel screen: normal toward the viewer on +z, picture-up is +y. */
const front: ScreenFrame = { center: [0, 0.3, 0], normal: [0, 0, 1], up: [0, 1, 0], w: 0.2, h: 0.1 }

describe('screenViewPose', () => {
  it('targets the glass centre and sees its front', () => {
    const p = screenViewPose(top, FOV, 1.6)
    expect(p.target).toEqual([1, 0.2, 2])
    expect(seesFront(top, p)).toBe(true)
  })

  it('a top screen is seen from above, leaned toward the operator by the tilt (beta = tilt from the vertical)', () => {
    const p = screenViewPose(top, FOV, 1.6, 22)
    expect(p.beta).toBeCloseTo((22 * Math.PI) / 180, 6)
    // leaning toward the bottom of the picture = toward +z (the front of the console): the camera sits at +z of the target
    expect(Math.sin(p.alpha) * Math.sin(p.beta)).toBeGreaterThan(0)
    expect(Math.cos(p.alpha) * Math.sin(p.beta)).toBeCloseTo(0, 6)
  })

  it('a front-panel screen is seen from its front, level with a slight lean down', () => {
    const p = screenViewPose(front, FOV, 1.6, 0)
    expect(p.beta).toBeCloseTo(Math.PI / 2, 6)
    expect(Math.sin(p.alpha)).toBeCloseTo(1, 6) // on the +z side
    const lean = screenViewPose(front, FOV, 1.6, 20)
    expect(lean.beta).toBeGreaterThan(Math.PI / 2) // camera below the screen's centre line? lean is toward the bottom of the picture
  })

  it('stands far enough for the whole glass to fit, and farther for a narrower canvas', () => {
    const wide = screenViewPose(top, FOV, 2)
    const narrow = screenViewPose(top, FOV, 0.8)
    // the glass fills about 82 % of the limiting side
    const seen = 2 * wide.radius * Math.tan(FOV / 2)
    expect(seen).toBeGreaterThanOrEqual(0.135 * Math.cos((22 * Math.PI) / 180))
    expect(narrow.radius).toBeGreaterThan(wide.radius)
  })

  it('never goes closer than 15 cm', () => {
    expect(screenViewPose({ ...top, w: 0.01, h: 0.01 }, FOV, 1.6).radius).toBe(0.15)
  })
})
