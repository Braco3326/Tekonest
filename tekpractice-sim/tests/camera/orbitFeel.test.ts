/**
 * Designer-grade orbit feel (Task 3) — pure config, no Babylon.
 */
import { describe, expect, it } from 'vitest'
import {
  applyOrbitFeel,
  ENSEMBLE_LOWER_RADIUS,
  ORBIT_FEEL,
  orbitMotion,
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
  minZ: 1, // Babylon's default near plane
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

  it('near clip plane sits well inside the closest dolly (a focused mic is never clipped / unpickable)', () => {
    const cam = blank()
    applyOrbitFeel(cam)
    // Closest the camera can get to a pivot = the focus dolly floor, at least 0.3 m;
    // a device extends towards the camera by up to its bounding radius.
    expect(cam.minZ).toBeLessThanOrEqual(0.05)
    expect(cam.minZ).toBeGreaterThan(0)
    expect(cam.minZ).toBeLessThan(radiusLimitFor(0) - 0.2)
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
  it('with no pan inertia (reduced motion) one pixel still moves one pixel of world', () => {
    const r = 3
    const expected = (2 * r * Math.tan(fov / 2)) / h
    expect(1 / panningSensibilityFor(r, h, fov, 0) / expected).toBeCloseTo(1, 6)
  })
})

describe('orbitMotion (reduced motion: no glide, same travel — final review)', () => {
  it('normal motion = the designer feel', () => {
    expect(orbitMotion(false)).toEqual({
      inertia: ORBIT_FEEL.inertia,
      panningInertia: ORBIT_FEEL.panningInertia,
      wheelDeltaPercentage: ORBIT_FEEL.wheelDeltaPercentage,
      angularScale: 1,
    })
  })
  it('reduced motion: inertia and panningInertia 0', () => {
    const m = orbitMotion(true)
    expect(m.inertia).toBe(0)
    expect(m.panningInertia).toBe(0)
  })
  it('reduced motion keeps the travel per gesture: input / (1 − inertia) is unchanged', () => {
    const n = orbitMotion(false)
    const r = orbitMotion(true)
    // wheel: total = step / (1 − inertia)
    expect(r.wheelDeltaPercentage / (1 - r.inertia)).toBeCloseTo(n.wheelDeltaPercentage / (1 - n.inertia), 9)
    // orbit: total = px / (sensibility · (1 − inertia))
    expect(1 / (r.angularScale * (1 - r.inertia))).toBeCloseTo(1 / (n.angularScale * (1 - n.inertia)), 9)
  })
})
