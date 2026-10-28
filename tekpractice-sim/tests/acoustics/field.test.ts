/**
 * Task 36: computeField (energetic sum, relative level, overlap flag) and its edge cases. The golden formulas live in golden.test.ts.
 * Contract tested here: an unfed / muted / unpowered source is simply absent from `sources` (the caller's job, Task 37); a feed at −Infinity
 * (fader at −inf) behaves exactly like an absent one; the field never contains NaN (sentinel: −Infinity = no sound, see ADR-0015).
 */
import { describe, expect, it } from 'vitest'
import { computeField, levelDb, type AcSource } from '../../src/acoustics/field'

type V3 = [number, number, number]
const mk = (id: string, position: V3, over: Partial<AcSource> = {}): AcSource => ({ id, pose: { position, yawDeg: 0, tiltDeg: 0 }, hDeg: 90, vDeg: 60, lRefDb: 0, ...over })
const pts = (...p: V3[]): Float32Array => new Float32Array(p.flat())
const none = (a: ArrayLike<number>): boolean => Array.from(a).every((v) => !Number.isNaN(v))

describe('computeField: relative level', () => {
  it('the loudest point is exactly 0 dB, every other point is ≤ 0, and maxDb is its absolute level', () => {
    const f = computeField([mk('a', [0, 0, 0])], pts([0, 0, 2], [0, 0, 4], [0, 0, 8]))
    expect(Array.from(f.relDb).map((v) => Math.round(v * 100) / 100)).toEqual([0, -6.02, -12.04])
    expect(f.maxDb).toBeCloseTo(-6.0206, 4) // −20·log10(2)
  })
  it('lRefDb moves maxDb but not the relative field', () => {
    const a = computeField([mk('a', [0, 0, 0])], pts([0, 0, 2], [0, 0, 4]))
    const b = computeField([mk('a', [0, 0, 0], { lRefDb: 7 })], pts([0, 0, 2], [0, 0, 4]))
    expect(b.maxDb - a.maxDb).toBeCloseTo(7, 9)
    expect(Array.from(b.relDb)).toEqual(Array.from(a.relDb))
  })
  it('two equal collocated sources add +3.01 dB (energetic sum) and the relative field is unchanged', () => {
    const one = computeField([mk('a', [0, 0, 0])], pts([0, 0, 2], [0, 0, 4]))
    const two = computeField([mk('a', [0, 0, 0]), mk('b', [0, 0, 0])], pts([0, 0, 2], [0, 0, 4]))
    expect(two.maxDb - one.maxDb).toBeCloseTo(3.0103, 4)
    expect(Array.from(two.relDb)).toEqual(Array.from(one.relDb))
  })
  it('a source facing away adds only its −30 dB rear lobe: 10·log10(1 + 10^−3) = +0.0043 dB', () => {
    const front = mk('a', [0, 0, 0])
    const back = mk('b', [0, 0, 0], { pose: { position: [0, 0, 0], yawDeg: 180, tiltDeg: 0 } })
    const alone = computeField([front], pts([0, 0, 5]))
    const both = computeField([front, back], pts([0, 0, 5]))
    expect(both.maxDb - alone.maxDb).toBeCloseTo(0.004341, 5)
  })
  it('the order of the sources does not matter', () => {
    const a = mk('a', [-4, 0, 0])
    const b = mk('b', [4, 0, 1], { lRefDb: -2, pose: { position: [4, 0, 1], yawDeg: -20, tiltDeg: 5 } })
    const p = pts([0, 0, 6], [3, 0, 2], [-5, 1, -1], [0, 0, 0])
    const f1 = computeField([a, b], p)
    const f2 = computeField([b, a], p)
    expect(Array.from(f1.relDb)).toEqual(Array.from(f2.relDb))
    expect(f1.maxDb).toBeCloseTo(f2.maxDb, 12)
    expect(Array.from(f1.overlap)).toEqual(Array.from(f2.overlap))
  })
  it('does not mutate its inputs', () => {
    const s = [mk('a', [1, 2, 3])]
    const p = pts([0, 0, 6], [3, 0, 2])
    const sCopy = structuredClone(s)
    const pCopy = Array.from(p)
    computeField(s, p)
    expect(s).toEqual(sCopy)
    expect(Array.from(p)).toEqual(pCopy)
  })
  it('a points array that is not a whole number of xyz triples is refused', () => {
    expect(() => computeField([mk('a', [0, 0, 0])], new Float32Array(4))).toThrow(RangeError)
  })
  it('relDb has one entry per point and overlap one flag per point', () => {
    const f = computeField([mk('a', [0, 0, 0])], pts([0, 0, 1], [0, 0, 2], [0, 0, 3]))
    expect(f.relDb).toHaveLength(3)
    expect(f.overlap).toHaveLength(3)
  })
})

describe('computeField: nothing to hear (−Infinity sentinel, never NaN)', () => {
  const p = pts([0, 0, 2], [1, 0, 5])
  it('no sources: every relDb is −Infinity, maxDb is −Infinity, no overlap', () => {
    const f = computeField([], p)
    expect(Array.from(f.relDb)).toEqual([-Infinity, -Infinity])
    expect(f.maxDb).toBe(-Infinity)
    expect(Array.from(f.overlap)).toEqual([0, 0])
  })
  it('every source at −Infinity (fader at −inf): the same, and no NaN', () => {
    const f = computeField([mk('a', [0, 0, 0], { lRefDb: -Infinity }), mk('b', [1, 0, 0], { lRefDb: -Infinity })], p)
    expect(Array.from(f.relDb)).toEqual([-Infinity, -Infinity])
    expect(f.maxDb).toBe(-Infinity)
    expect(Array.from(f.overlap)).toEqual([0, 0])
    expect(none(f.relDb)).toBe(true)
  })
  it('no points: empty arrays, maxDb −Infinity', () => {
    const f = computeField([mk('a', [0, 0, 0])], new Float32Array(0))
    expect(f.relDb).toHaveLength(0)
    expect(f.overlap).toHaveLength(0)
    expect(f.maxDb).toBe(-Infinity)
  })
  it('a source at −Infinity next to a live one is exactly as if it were absent (no overlap either)', () => {
    const live = mk('a', [0, 0, 0])
    const dead = mk('b', [0, 0, 0], { lRefDb: -Infinity })
    const withDead = computeField([live, dead], p)
    const without = computeField([live], p)
    expect(Array.from(withDead.relDb)).toEqual(Array.from(without.relDb))
    expect(withDead.maxDb).toBe(without.maxDb)
    expect(Array.from(withDead.overlap)).toEqual([0, 0])
  })
  it('the unmuted source alone is the field: a muted/unfed source left out of the list changes nothing', () => {
    // contract with Task 37: it filters `speakers` by muted and gainDb before building AcSource[]
    const f = computeField([mk('a', [0, 0, 0])], p)
    expect(f.maxDb).toBeCloseTo(-6.0206, 4)
  })
})

describe('computeField: overlap = the top two contributors are within 6 dB', () => {
  // Two equal speakers at x = −4 and x = +4, both facing +z; listeners 6 m ahead.
  const A = mk('a', [-4, 0, 0])
  const B = mk('b', [4, 0, 0])
  it('midway between two equal speakers (levels equal, diff 0 dB) the flag is set', () => {
    expect(computeField([A, B], pts([0, 0, 6])).overlap[0]).toBe(1)
  })
  it('right in front of one: A on axis at 6 m = −15.56 dB; B at r = 10 m, 53.13° off = −8.36 − 20 = −28.36 dB; 12.8 dB apart: not set', () => {
    // sanity of the hand numbers through levelDb itself
    expect(levelDb(A, [-4, 0, 6])).toBeCloseTo(-15.563, 3)
    expect(levelDb(B, [-4, 0, 6])).toBeCloseTo(-28.364, 2)
    expect(computeField([A, B], pts([-4, 0, 6])).overlap[0]).toBe(0)
  })
  it('both cases in one call, in order', () => {
    expect(Array.from(computeField([A, B], pts([0, 0, 6], [-4, 0, 6], [4, 0, 6])).overlap)).toEqual([1, 0, 0])
  })
  it('a single source never overlaps itself', () => {
    expect(Array.from(computeField([A], pts([0, 0, 6], [-4, 0, 6])).overlap)).toEqual([0, 0])
  })
  it('the threshold is 6 dB: collocated sources 5.99 dB apart overlap, 6.01 dB apart do not', () => {
    const quiet = (db: number) => mk('q', [0, 0, 0], { lRefDb: -db })
    expect(computeField([mk('a', [0, 0, 0]), quiet(5.99)], pts([0, 0, 5])).overlap[0]).toBe(1)
    expect(computeField([mk('a', [0, 0, 0]), quiet(6.01)], pts([0, 0, 5])).overlap[0]).toBe(0)
  })
  it('only the TOP TWO count: a loud pair and a quiet third that is far below still overlap; a loud one over two quiet ones does not', () => {
    const q = (id: string, db: number) => mk(id, [0, 0, 0], { lRefDb: -db })
    expect(computeField([q('1', 0), q('2', 1), q('3', 40)], pts([0, 0, 5])).overlap[0]).toBe(1)
    expect(computeField([q('1', 0), q('2', 10), q('3', 11)], pts([0, 0, 5])).overlap[0]).toBe(0)
  })
})

describe('computeField: tilt (+ aims up) through the whole chain', () => {
  const at = (tilt: number, p: V3): number => computeField([mk('a', [0, 0, 0], { pose: { position: [0, 0, 0], yawDeg: 0, tiltDeg: tilt } })], new Float32Array(p)).maxDb
  it('tilt −10 and +10 each cost the level-ahead listener 6·(10/30)² = 0.667 dB, tilt 0 costs nothing', () => {
    const level = at(0, [0, 0, 5])
    expect(level).toBeCloseTo(-13.9794, 4) // −20·log10(5)
    expect(at(-10, [0, 0, 5]) - level).toBeCloseTo(-0.6667, 4)
    expect(at(10, [0, 0, 5]) - level).toBeCloseTo(-0.6667, 4)
  })
  it('tilt −10 (down) favours a listener below the axis, tilt +10 (up) one above it', () => {
    const below: V3 = [0, -2, 5]
    const above: V3 = [0, 2, 5]
    expect(at(-10, below)).toBeGreaterThan(at(0, below))
    expect(at(10, below)).toBeLessThan(at(0, below))
    expect(at(10, above)).toBeGreaterThan(at(0, above))
    expect(at(-10, above)).toBeLessThan(at(0, above))
  })
})
