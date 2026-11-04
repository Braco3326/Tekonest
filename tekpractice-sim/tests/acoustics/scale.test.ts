/**
 * Task 36 (P17): the locked relative scale (0 to −24 dB in 3 dB steps, 8 bins) and the statistics, which read the UNCLAMPED relative dB.
 */
import { describe, expect, it } from 'vitest'
import { SCALE_STEPS_DB, scaleBin, stats } from '../../src/acoustics/scale'

describe('SCALE_STEPS_DB', () => {
  it('is 0 to −24 in 3 dB steps (9 edges, 8 bins)', () => {
    expect([...SCALE_STEPS_DB]).toEqual([0, -3, -6, -9, -12, -15, -18, -21, -24])
  })
})

describe('scaleBin: bin k holds (−3(k+1), −3k], the last bin is open to −Infinity', () => {
  it('each step edge belongs to the bin it starts: floor(−c/3)', () => {
    // 0 → 0; −3 → 1; −6 → 2; … −21 → 7; −24 → 8 capped to 7
    expect([0, -3, -6, -9, -12, -15, -18, -21, -24].map(scaleBin)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 7])
  })
  it('just above an edge stays in the louder bin, just below is the quieter', () => {
    expect([-2.999, -3.001, -5.999, -6.001, -20.999, -21.001].map(scaleBin)).toEqual([0, 1, 1, 2, 6, 7])
  })
  it('clamps: −40 and −Infinity → 7; positive → 0', () => {
    expect([-40, -1e9, -Infinity].map(scaleBin)).toEqual([7, 7, 7])
    expect([0.0001, 3, Infinity].map(scaleBin)).toEqual([0, 0, 0])
  })
  it('returns +0 for 0 and −0 (never −0)', () => {
    expect(Object.is(scaleBin(0), 0)).toBe(true)
    expect(Object.is(scaleBin(-0), 0)).toBe(true)
  })
  it('NaN (which the field never produces) maps to the quietest bin, 7, rather than to an invalid index', () => {
    expect(scaleBin(NaN)).toBe(7)
  })
  it('the 9 edges of SCALE_STEPS_DB map to bins 0..7', () => {
    expect(SCALE_STEPS_DB.map(scaleBin)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 7])
  })
})

describe('stats: unclamped (P17), population standard deviation', () => {
  it('−30 dB is reported as −30, not clamped to the scale\'s −24', () => {
    // values 0, −3, −6, −30: mean = −39/4 = −9.75; deviations 9.75, 6.75, 3.75, −20.25;
    // squares 95.0625 + 45.5625 + 14.0625 + 410.0625 = 564.75; population variance = 564.75/4 = 141.1875; sd = 11.8822
    const s = stats(new Float32Array([0, -3, -6, -30]))
    expect(s.min).toBe(-30)
    expect(s.max).toBe(0)
    expect(s.mean).toBeCloseTo(-9.75, 9)
    expect(s.sd).toBeCloseTo(Math.sqrt(141.1875), 9)
    expect(s.sd).toBeCloseTo(11.8822, 4)
    expect(s.count).toBe(4)
  })
  it('sd is the POPULATION one (divides by n, not n−1): [0, −6] → mean −3, variance 9, sd 3 (sample sd would be 4.243)', () => {
    expect(stats(new Float32Array([0, -6])).sd).toBeCloseTo(3, 9)
  })
  it('one value: sd 0', () => {
    expect(stats(new Float32Array([-4]))).toEqual({ min: -4, max: -4, mean: -4, sd: 0, count: 1 })
  })
  it('all equal: sd exactly 0', () => {
    expect(stats(new Float32Array([-2, -2, -2])).sd).toBe(0)
  })
  it('count 0 (no points) gives the all-zero sentinel with count 0, no NaN, no ±Infinity', () => {
    expect(stats(new Float32Array(0))).toEqual({ min: 0, max: 0, mean: 0, sd: 0, count: 0 })
  })
  it('silent points (−Infinity: no sound) are not statistics: all silent → the same count 0 sentinel', () => {
    expect(stats(new Float32Array([-Infinity, -Infinity]))).toEqual({ min: 0, max: 0, mean: 0, sd: 0, count: 0 })
  })
  it('silent points mixed with live ones are left out of min, mean, sd and count', () => {
    const s = stats(new Float32Array([0, -Infinity, -6]))
    expect(s).toEqual({ min: -6, max: 0, mean: -3, sd: 3, count: 2 })
  })
  it('a large uniform field does not drift (two-pass variance): 100000 points at −12.5 → sd 0', () => {
    const a = new Float32Array(100000).fill(-12.5)
    expect(stats(a).sd).toBe(0)
    expect(stats(a).mean).toBeCloseTo(-12.5, 9)
  })
})
