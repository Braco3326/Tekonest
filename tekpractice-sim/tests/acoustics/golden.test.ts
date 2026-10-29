/**
 * Task 36 (C13, P9, P10): golden tests of the direct-field model. Every expected number below was derived by hand (the arithmetic is in the
 * comment next to it), not by running the code. The plan's #6 (« 89° off axis = −30 ») was wrong: u² = (89/45)² = 3.9116 gives −23.47 dB, so
 * the floor is tested where the formula really reaches it, and at the exact boundary u² = 5.
 */
import { describe, expect, it } from 'vitest'
import { computeField, directivityDb, energeticSumDb, levelDb } from '../../src/acoustics/field'
import { offAxis } from '../../src/acoustics/geometry'
import { scaleBin } from '../../src/acoustics/scale'

type V3 = [number, number, number]
const src = (over = {}) => ({ id: 's', pose: { position: [0, 0, 0] as V3, yawDeg: 0, tiltDeg: 0 }, hDeg: 90, vDeg: 60, lRefDb: 0, ...over })
const pose = (yawDeg: number, tiltDeg: number, position: V3 = [0, 0, 0]) => ({ position, yawDeg, tiltDeg })

describe('golden (council Q5)', () => {
  // 20·log10(8/4) = 20·log10(2) = 6.0206
  it('#1 doubling the distance on axis = −6.02 dB', () => expect(levelDb(src(), [0, 0, 8]) - levelDb(src(), [0, 0, 4])).toBeCloseTo(-6.02, 2))
  // u² = (45/45)² + 0 = 1 → −6·1
  it('#2 −6.00 dB at half the H coverage', () => expect(directivityDb(45, 0, 90, 60, false)).toBeCloseTo(-6.0, 6))
  // u² = 0 + (30/30)² = 1 → −6·1
  it('#3 −6.00 dB at half the V coverage', () => expect(directivityDb(0, 30, 90, 60, false)).toBeCloseTo(-6.0, 6))
  // 10·log10(2) = 3.0103
  it('#4 two equal sources = +3.01 dB', () => expect(energeticSumDb([0, 0])).toBeCloseTo(3.01, 2))
  it('#5 rear hemisphere = −30 dB (P9)', () => expect(directivityDb(170, 0, 90, 60, true)).toBe(-30))
  it('#6 the −30 dB floor is reached off axis where u² ≥ 5, not before', () => {
    // The plan\'s case: u² = (89/45)² = 7921/2025 = 3.9116 → −6·3.9116 = −23.47, NOT −30
    expect(directivityDb(89, 0, 90, 60, false)).toBeCloseTo(-23.4696, 4)
    // u² = 3.9116 + (59/30)² = 3.9116 + 3481/900 = 3.9116 + 3.8678 = 7.7794 > 5 → −46.7 → floored to −30
    expect(directivityDb(89, 59, 90, 60, false)).toBe(-30)
    // Exact boundary, with a coverage of 2° × 2° (half = 1°): u² = (1/1)² + (2/1)² = 1 + 4 = 5 → −6·5 = −30 exactly
    expect(directivityDb(1, 2, 2, 2, false)).toBe(-30)
    // just inside: u² = 1 + 1.9² = 1 + 3.61 = 4.61 → −6·4.61 = −27.66 (not floored)
    expect(directivityDb(1, 1.9, 2, 2, false)).toBeCloseTo(-27.66, 9)
    // just outside: u² = 1 + 2.1² = 1 + 4.41 = 5.41 → −32.46 → floored to −30
    expect(directivityDb(1, 2.1, 2, 2, false)).toBe(-30)
  })
  it('#6b on axis the directivity is exactly 0 (+0, not −0)', () => {
    expect(Object.is(directivityDb(0, 0, 90, 60, false), 0)).toBe(true)
  })
  it('#6c the coefficient is −6 and u uses HALF the coverage', () => {
    // 90° × 60° at (22.5°, 15°): u² = 0.25 + 0.25 = 0.5 → −3 dB; at (45°, 30°): u² = 2 → −12 dB
    expect(directivityDb(22.5, 15, 90, 60, false)).toBeCloseTo(-3, 9)
    expect(directivityDb(45, 30, 90, 60, false)).toBeCloseTo(-12, 9)
    // 120° × 40°: at (60°, 20°) u² = 1 + 1 = 2 → −12; at (30°, 0) u² = 0.25 → −1.5
    expect(directivityDb(60, 20, 120, 40, false)).toBeCloseTo(-12, 9)
    expect(directivityDb(30, 0, 120, 40, false)).toBeCloseTo(-1.5, 9)
  })
  it('#6d the directivity is symmetric left/right and up/down', () => {
    expect(directivityDb(-30, 0, 90, 60, false)).toBe(directivityDb(30, 0, 90, 60, false))
    expect(directivityDb(0, -20, 90, 60, false)).toBe(directivityDb(0, 20, 90, 60, false))
  })
  it('a coverage that is not positive and finite is refused (it would give NaN), never silently used', () => {
    for (const [h, v] of [[0, 60], [90, 0], [-90, 60], [90, NaN], [Infinity, 60]]) expect(() => directivityDb(0, 0, h, v, false), `${h} x ${v}`).toThrow(RangeError)
  })

  // yaw 90: lx = dx·cos90 − dz·sin90 = 0 and lz = dx·sin90 + dz·cos90 = 5 → straight ahead.
  // NOTE: #7 alone cannot tell a correct yaw from one with a flipped lx sign (the point is on axis either way); the (5, 0, 5) / (5, 0, −5)
  // test in « sign conventions » below ("yaw 90 faces +x, and its left is +z") is what pins the left/right sign. Do not trim it.
  it('#7 yaw 90° faces +x', () => expect(offAxis({ position: [0, 0, 0], yawDeg: 90, tiltDeg: 0 }, [5, 0, 0]).thetaHdeg).toBeCloseTo(0, 6))
  // 20·log10(1/0.5) = 6.0206 at 0.5 m and at 0.1 m (floored); at 0.6 m: −20·log10(0.6) = +4.437
  it('#8 r is floored at 0.5 m: the level at 0.1 m equals the level at 0.5 m, and that level is +6.02 dB', () => {
    expect(levelDb(src(), [0, 0, 0.1])).toBeCloseTo(levelDb(src(), [0, 0, 0.5]), 9)
    expect(levelDb(src(), [0, 0, 0.1])).toBeCloseTo(6.0206, 4) // pins the floor at 0.5 (a floor of 1 m would give 0)
    expect(levelDb(src(), [0, 0, 0.6])).toBeCloseTo(4.437, 3) // and 0.5 is a floor, not a constant
    expect(levelDb(src(), [0, 0, 0.6])).toBeLessThan(levelDb(src(), [0, 0, 0.5]))
  })
  it('#8b a listener exactly at the speaker (r = 0) gives a finite level', () => {
    expect(levelDb(src(), [0, 0, 0])).toBeCloseTo(6.0206, 4)
  })
  it('#9 scale bins: 0 → 0, −3 → 1, −23.9 → 7, −40 → 7', () => {
    // floor(−c/3): 0/3 = 0; 3/3 = 1; 23.9/3 = 7.97 → 7; −40 clamps to −24 → 24/3 = 8 → capped at 7
    expect([0, -3, -23.9, -40].map(scaleBin)).toEqual([0, 1, 7, 7])
  })
  it('field is relative: its max point is 0 dB', () => {
    const f = computeField([src()], new Float32Array([0, 0, 2, 0, 0, 4]))
    expect(Math.max(...f.relDb)).toBe(0)
    expect(f.relDb[1]).toBeCloseTo(-6.02, 2)
  })
})

describe('levels add up as the formula says', () => {
  it('rear point at 4 m, lRef 0: 0 − 30 − 20·log10(4) = −30 − 12.04 = −42.04 dB', () => {
    expect(levelDb(src(), [0, 0, -4])).toBeCloseTo(-42.0412, 4)
  })
  it('on axis at 10 m: 20·log10(10) = 20 exactly, so −20; lRef +5 shifts the level by exactly +5', () => {
    expect(levelDb(src(), [0, 0, 10])).toBeCloseTo(-20, 9)
    expect(levelDb(src({ lRefDb: 5 }), [0, 0, 10])).toBeCloseTo(-15, 9)
  })
  it('a feed at −Infinity gives −Infinity', () => {
    expect(levelDb(src({ lRefDb: -Infinity }), [0, 0, 3])).toBe(-Infinity)
  })
  it('energeticSumDb: [] → −Infinity; [x] → x; a −Infinity is silent; −Infinity only → −Infinity', () => {
    expect(energeticSumDb([])).toBe(-Infinity)
    expect(energeticSumDb([-7.5])).toBeCloseTo(-7.5, 12)
    expect(energeticSumDb([0, -Infinity])).toBeCloseTo(0, 12)
    expect(energeticSumDb([-Infinity, -Infinity])).toBe(-Infinity)
  })
  it('energeticSumDb: 0 and −10 → 10·log10(1 + 0.1) = 0.4139; three equal → 10·log10(3) = 4.77; no underflow far below zero', () => {
    expect(energeticSumDb([0, -10])).toBeCloseTo(0.4139, 4)
    expect(energeticSumDb([0, 0, 0])).toBeCloseTo(4.7712, 4)
    // 10^(−4000/10) underflows to 0 in the plain formula; two equal levels are still 3.01 above themselves
    expect(energeticSumDb([-4000, -4000])).toBeCloseTo(-4000 + 3.0103, 3)
  })
})

describe('the known step at the speaker plane (P9, ADR-0015)', () => {
  // Front side of the plane at θH ≈ 90°: D = −6·(90/(H/2))²; rear side: −30. Same distance on both sides.
  const step = (hDeg: number): number => levelDb(src({ hDeg }), [3, 0, 0.001]) - levelDb(src({ hDeg }), [3, 0, -0.001])
  it('H = 90: front −6·(90/45)² = −24, rear −30 → a 6 dB step', () => {
    expect(directivityDb(90, 0, 90, 60, false)).toBeCloseTo(-24, 9)
    expect(step(90)).toBeGreaterThan(5.9)
    expect(step(90)).toBeLessThan(6.1)
  })
  it('H = 120: front −6·(90/60)² = −13.5, rear −30 → a 16.5 dB step', () => {
    expect(directivityDb(90, 0, 120, 60, false)).toBeCloseTo(-13.5, 9)
    expect(step(120)).toBeGreaterThan(16.4)
    expect(step(120)).toBeLessThan(16.6)
  })
  it('H = 80: front −6·(90/40)² = −30.4 → floored to −30, so no step (H ≤ ~80.5° has none)', () => {
    expect(directivityDb(90, 0, 80, 60, false)).toBe(-30)
    expect(Math.abs(step(80))).toBeLessThan(1e-9)
  })
})

describe('sign conventions (Babylon left-handed, yaw about +y, 0 = facing +z, tilt > 0 aims up)', () => {
  it('yaw 0 faces +z: straight ahead is on axis, not rear', () => {
    const a = offAxis(pose(0, 0), [0, 0, 5])
    expect(a.thetaHdeg).toBeCloseTo(0, 9)
    expect(a.thetaVdeg).toBeCloseTo(0, 9)
    expect(a.rear).toBe(false)
    expect(a.r).toBeCloseTo(5, 12)
  })
  it('thetaH > 0 is to the right of the axis (+x when facing +z); < 0 is to the left', () => {
    expect(offAxis(pose(0, 0), [5, 0, 5]).thetaHdeg).toBeCloseTo(45, 9)
    expect(offAxis(pose(0, 0), [-5, 0, 5]).thetaHdeg).toBeCloseTo(-45, 9)
  })
  it('yaw 90 faces +x, and its left is +z: the point (5, 0, 5) is at −45°, (5, 0, −5) at +45°', () => {
    // local x = dx·cos90 − dz·sin90 = −dz; local z = dx·sin90 + dz·cos90 = dx
    const a = offAxis(pose(90, 0), [5, 0, 5])
    expect(a.thetaHdeg).toBeCloseTo(-45, 9)
    expect(a.rear).toBe(false)
    expect(offAxis(pose(90, 0), [5, 0, -5]).thetaHdeg).toBeCloseTo(45, 9)
  })
  it('yaw 180 faces −z: a point at +z is behind (rear, thetaH = ±180)', () => {
    const a = offAxis(pose(180, 0), [0, 0, 5])
    expect(a.rear).toBe(true)
    expect(Math.abs(a.thetaHdeg)).toBeCloseTo(180, 9)
    expect(offAxis(pose(180, 0), [0, 0, -5]).rear).toBe(false)
  })
  it('rear is local z < 0: just behind the speaker plane is rear, just in front is not (yaw 0)', () => {
    expect(offAxis(pose(0, 0), [3, 0, -0.01]).rear).toBe(true)
    expect(offAxis(pose(0, 0), [3, 0, 0.01]).rear).toBe(false)
    expect(offAxis(pose(0, 0), [0, 0, -4]).thetaHdeg).toBeCloseTo(180, 9)
  })
  it('the speaker plane itself (local z = 0) counts as front, not rear: thetaH = 90', () => {
    const a = offAxis(pose(0, 0), [3, 0, 0])
    expect(a.rear).toBe(false)
    expect(a.thetaHdeg).toBeCloseTo(90, 9)
  })
  it('rear is decided AFTER the tilt, in the speaker\'s own frame: tilt +80 (nearly straight up), a point 1 m below and 0.5 m ahead is behind it', () => {
    // local z = dy·sin80° + dz·cos80° = −0.985 + 0.087 = −0.898 < 0 (the yaw-only z, 0.5, would say « front »)
    const below = offAxis(pose(0, 80), [0, -1, 0.5])
    expect(below.rear).toBe(true)
    // and 1 m above, 0.5 m behind the origin plane: local z = 0.985 − 0.087 = +0.898 > 0 (the yaw-only z, −0.5, would say « rear »)
    expect(offAxis(pose(0, 80), [0, 1, -0.5]).rear).toBe(false)
  })
  it('tilt +10 aims UP: a listener at the same height straight ahead is BELOW the axis (thetaV = −10)', () => {
    const a = offAxis(pose(0, 10), [0, 0, 5])
    expect(a.thetaVdeg).toBeCloseTo(-10, 9)
    expect(a.thetaHdeg).toBeCloseTo(0, 9)
  })
  it('tilt −10 aims DOWN: the same listener is ABOVE the axis (thetaV = +10)', () => {
    expect(offAxis(pose(0, -10), [0, 0, 5]).thetaVdeg).toBeCloseTo(10, 9)
  })
  it('tilt +10: 5 m out along the tilted axis = (0, 5·sin10°, 5·cos10°) = (0, 0.868241, 4.924039) is on axis', () => {
    const a = offAxis(pose(0, 10), [0, 0.868241, 4.924039])
    expect(a.thetaVdeg).toBeCloseTo(0, 4)
    expect(a.thetaHdeg).toBeCloseTo(0, 4)
  })
  it('yaw and tilt compose: yaw 90, tilt 10: axis = (cos10°, sin10°, 0); 5 m out = (4.92404, 0.868241, 0) is on axis', () => {
    const a = offAxis(pose(90, 10), [4.924039, 0.868241, 0])
    expect(a.thetaHdeg).toBeCloseTo(0, 4)
    expect(a.thetaVdeg).toBeCloseTo(0, 4)
  })
  it('tilt acts in the speaker\'s own frame: yaw 37, tilt 10, a level point straight ahead along the yawed horizontal is still −10', () => {
    const y = (37 * Math.PI) / 180
    const a = offAxis(pose(37, 10), [5 * Math.sin(y), 0, 5 * Math.cos(y)])
    expect(a.thetaVdeg).toBeCloseTo(-10, 9)
    expect(a.thetaHdeg).toBeCloseTo(0, 9)
  })
  it('the position is subtracted: a speaker at (2, 3, 4) looking +z sees (2, 3, 9) straight ahead at r = 5', () => {
    const a = offAxis(pose(0, 0, [2, 3, 4]), [2, 3, 9])
    expect(a.r).toBeCloseTo(5, 12)
    expect(a.thetaHdeg).toBeCloseTo(0, 9)
    expect(a.thetaVdeg).toBeCloseTo(0, 9)
  })
  it('through the whole chain: a listener 1 m below, 5 m ahead, hears more with tilt −10 than 0, and more with 0 than +10', () => {
    // elevation = −atan(1/5) = −11.31°. thetaV = −11.31 (tilt 0), −1.31 (tilt −10), −21.31 (tilt +10), V = 60 so half = 30:
    // D = −6·(11.31/30)² = −0.853;  −6·(1.31/30)² = −0.0114;  −6·(21.31/30)² = −3.027. Same r, so same distance loss.
    const at = (tilt: number) => levelDb(src({ pose: pose(0, tilt) }), [0, -1, 5])
    expect(at(-10)).toBeGreaterThan(at(0))
    expect(at(0)).toBeGreaterThan(at(10))
    expect(at(0) - at(-10)).toBeCloseTo(-0.853 + 0.0114, 2)
    expect(at(10) - at(0)).toBeCloseTo(-3.027 + 0.853, 2)
  })
})
