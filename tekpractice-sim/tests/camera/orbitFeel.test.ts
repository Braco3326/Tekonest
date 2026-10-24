/**
 * Designer-grade orbit feel (Task 3) — pure config, no Babylon.
 */
import { describe, expect, it } from 'vitest'
import {
  applyOrbitFeel,
  ENSEMBLE_LOWER_RADIUS,
  ORBIT_FEEL,
  panningSensibilityFor,
  radiusLimitFor,
  type OrbitCam,
} from '../../src/camera/orbitFeel'

const blank = (): OrbitCam => ({
  inertia: 0,
  panningInertia: 0,
  wheelDeltaPercentage: 0,
  zoomToMouseLocation: false,
  upperBetaLimit: 0,
  lowerBetaLimit: 0,
  upperRadiusLimit: 0,
  panningSensibility: 0,
})

describe('ORBIT_FEEL values (brief, verbatim)', () => {
  it('matches the brief', () => {
    expect(ORBIT_FEEL).toEqual({
      inertia: 0.85,
      panningInertia: 0.85,
      wheelDeltaPercentage: 0.02,
      zoomToMouseLocation: true,
      upperBetaLimit: Math.PI / 2 - 0.02,
      lowerBetaLimit: 0.05,
      upperRadiusLimit: 60,
    })
  })
})

describe('applyOrbitFeel', () => {
  it('sets every field of the feel on the camera', () => {
    const cam = blank()
    applyOrbitFeel(cam)
    expect(cam.inertia).toBe(0.85)
    expect(cam.panningInertia).toBe(0.85)
    expect(cam.wheelDeltaPercentage).toBe(0.02)
    expect(cam.zoomToMouseLocation).toBe(true)
    expect(cam.upperBetaLimit).toBeCloseTo(Math.PI / 2 - 0.02, 12)
    expect(cam.lowerBetaLimit).toBe(0.05)
    expect(cam.upperRadiusLimit).toBe(60)
    expect(cam.panningSensibility).toBeGreaterThan(0) // pan enabled (0 disables it in Babylon)
  })

  it('never lowers a larger upper radius limit (big rooms keep their reach)', () => {
    const cam = { ...blank(), upperRadiusLimit: 82 }
    applyOrbitFeel(cam)
    expect(cam.upperRadiusLimit).toBe(82)
  })
})

describe('radiusLimitFor (focus: how close the dolly may go)', () => {
  it('is 1.2 × the bounding radius', () => {
    expect(radiusLimitFor(1)).toBeCloseTo(1.2, 12)
    expect(radiusLimitFor(2.5)).toBeCloseTo(3, 12)
  })
  it('never goes under 0.3 m (tiny gear such as a mic)', () => {
    expect(radiusLimitFor(0.05)).toBe(0.3)
    expect(radiusLimitFor(0)).toBe(0.3)
    expect(radiusLimitFor(0.25)).toBe(0.3)
  })
  it('stays sane on bad input', () => {
    expect(radiusLimitFor(Number.NaN)).toBe(0.3)
    expect(radiusLimitFor(-4)).toBe(0.3)
  })
  it('ensemble default is the env default (2)', () => {
    expect(ENSEMBLE_LOWER_RADIUS).toBe(2)
  })
})

describe('panningSensibilityFor (pan follows the cursor at any distance)', () => {
  const fov = 0.8
  const h = 800
  const worldPerPx = (r: number) => 1 / (panningSensibilityFor(r, h, fov) * (1 - ORBIT_FEEL.panningInertia))
  it('one pixel of drag moves the target about one pixel of world at the target depth', () => {
    for (const r of [0.5, 2, 10, 40]) {
      const expected = (2 * r * Math.tan(fov / 2)) / h
      expect(worldPerPx(r) / expected).toBeCloseTo(1, 6)
    }
  })
  it('is finite and positive for degenerate inputs', () => {
    for (const s of [panningSensibilityFor(0, h, fov), panningSensibilityFor(5, 0, fov), panningSensibilityFor(5, h, 0)]) {
      expect(Number.isFinite(s)).toBe(true)
      expect(s).toBeGreaterThan(0)
    }
  })
})
