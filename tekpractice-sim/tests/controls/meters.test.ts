import { describe, expect, it } from 'vitest'
import { BarBallistics, VuBallistics, barLit, demoLevelDb } from '../../src/controls/meters'

describe('VuBallistics', () => {
  it('reads 0 VU (70.7 %) on a steady tone at the reference level, reaching 99 % of it in 300 ms', () => {
    const vu = new VuBallistics(-18)
    let pos = 0
    for (let t = 0; t < 300; t += 10) pos = vu.step(-18, 10)
    expect(pos).toBeGreaterThan(0.7079 * 0.97)
    expect(pos).toBeLessThanOrEqual(0.7079 + 1e-9)
    for (let t = 0; t < 2000; t += 10) pos = vu.step(-18, 10)
    expect(pos).toBeCloseTo(0.7079, 3)
  })
  it('is not instant: after 50 ms it is well short, and it falls back slowly', () => {
    const vu = new VuBallistics(-18)
    expect(vu.step(-18, 50)).toBeLessThan(0.7079 * 0.7)
    for (let t = 0; t < 1000; t += 10) vu.step(-18, 10)
    expect(vu.step(-120, 50)).toBeGreaterThan(0.3)
  })
  it('rests at the left on silence and pins at 1 for a hot signal', () => {
    const vu = new VuBallistics(-18)
    expect(vu.position).toBe(0)
    for (let t = 0; t < 1000; t += 10) vu.step(0, 10)
    expect(vu.position).toBe(1)
  })
})

describe('BarBallistics', () => {
  it('rises at once, falls at 20 dB per second, holds the peak 1.5 s then lets it fall', () => {
    const bar = new BarBallistics()
    bar.step(-6, 0, 16)
    expect(bar.level).toBe(-6)
    bar.step(-60, 1000, 1000)
    expect(bar.level).toBeCloseTo(-26, 6)
    expect(bar.peak).toBe(-6) // still held at t = 1000 ms
    bar.step(-60, 1600, 100)
    expect(bar.peak).toBeLessThan(-6)
  })
})

describe('barLit', () => {
  it('lights segments up to the level and marks the held peak', () => {
    expect(barLit(-60, -60, 10, -48, 0)).toEqual({ lit: 0, peak: -1 })
    expect(barLit(0, 0, 10, -48, 0)).toEqual({ lit: 10, peak: 9 })
    expect(barLit(-24, -12, 10, -48, 0)).toEqual({ lit: 5, peak: 6 })
  })
})

describe('demoLevelDb', () => {
  it('is deterministic, stays inside -60..0 dBFS, and moves', () => {
    const seen = new Set<number>()
    for (let t = 0; t < 30; t += 0.05) {
      const v = demoLevelDb('pgm1-l', t)
      expect(v).toBe(demoLevelDb('pgm1-l', t))
      expect(v).toBeGreaterThanOrEqual(-60)
      expect(v).toBeLessThanOrEqual(0)
      seen.add(Math.round(v))
    }
    expect(seen.size).toBeGreaterThan(8)
  })
  it('gives different buses different signals', () => {
    let differ = 0
    for (let t = 1; t < 10; t += 0.5) if (Math.abs(demoLevelDb('ch1', t) - demoLevelDb('ch2', t)) > 1) differ++
    expect(differ).toBeGreaterThan(3)
  })
})
