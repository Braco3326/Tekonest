import { describe, expect, it } from 'vitest'
import {
  clampPose,
  easeInOutCubic,
  planTween,
  samplePose,
  shortestAngle,
  TweenClock,
  type PoseValues,
} from '../../src/camera/tween'

const pose = (o: Partial<PoseValues> = {}): PoseValues => ({
  alpha: 0,
  beta: 1,
  radius: 10,
  target: [0, 0, 0],
  ...o,
})

describe('easeInOutCubic', () => {
  it('hits the endpoints and midpoint', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 12)
  })
  it('is symmetric: f(t) + f(1-t) = 1', () => {
    for (const t of [0.1, 0.25, 0.4, 0.7]) expect(easeInOutCubic(t) + easeInOutCubic(1 - t)).toBeCloseTo(1, 12)
  })
  it('clamps t to [0,1]', () => {
    expect(easeInOutCubic(-3)).toBe(0)
    expect(easeInOutCubic(7)).toBe(1)
  })
})

describe('shortestAngle', () => {
  it('crosses ±π the short way', () => {
    expect(shortestAngle(3.0, -3.0)).toBeCloseTo(2 * Math.PI - 6, 9) // +0.283
    expect(shortestAngle(3.0, -3.0)).toBeCloseTo(0.283, 3)
    expect(shortestAngle(-3.0, 3.0)).toBeCloseTo(-0.283, 3)
  })
  it('stays in (−π, π]', () => {
    expect(shortestAngle(0, Math.PI)).toBeCloseTo(Math.PI, 12)
    expect(shortestAngle(0, -Math.PI)).toBeCloseTo(Math.PI, 12)
  })
})

describe('planTween', () => {
  it('rewrites alpha to from.alpha + shortest arc, other fields untouched', () => {
    const to = pose({ alpha: -3.0, beta: 0.5, radius: 4, target: [1, 2, 3] })
    const p = planTween(pose({ alpha: 3.0 }), to)
    expect(p.alpha).toBeCloseTo(3.0 + 0.283, 3)
    expect(p.beta).toBe(0.5)
    expect(p.radius).toBe(4)
    expect(p.target).toEqual([1, 2, 3])
  })
  it('never travels more than π in alpha', () => {
    for (let a = -20; a <= 20; a += 0.7) {
      for (let b = -20; b <= 20; b += 1.3) {
        const p = planTween(pose({ alpha: a }), pose({ alpha: b }))
        expect(Math.abs(p.alpha - a)).toBeLessThanOrEqual(Math.PI + 1e-9)
      }
    }
  })
})

describe('samplePose', () => {
  const from = pose({ alpha: 0, beta: 1, radius: 10, target: [0, 0, 0] })
  const to = pose({ alpha: 2, beta: 0.5, radius: 4, target: [2, 4, 6] })
  it('t=0 is from, t=1 is to', () => {
    expect(samplePose(from, to, 0)).toEqual(from)
    expect(samplePose(from, to, 1)).toEqual(to)
  })
  it('t=0.5 is the midpoint (ease midpoint is 0.5)', () => {
    const m = samplePose(from, to, 0.5)
    expect(m.alpha).toBeCloseTo(1, 12)
    expect(m.beta).toBeCloseTo(0.75, 12)
    expect(m.radius).toBeCloseTo(7, 12)
    expect(m.target[0]).toBeCloseTo(1, 12)
    expect(m.target[1]).toBeCloseTo(2, 12)
    expect(m.target[2]).toBeCloseTo(3, 12)
  })
  it('is eased, not linear, at t=0.25', () => {
    expect(samplePose(from, to, 0.25).alpha).toBeLessThan(0.5)
  })
})

describe('clampPose', () => {
  it('clamps radius and beta to the limits', () => {
    const p = clampPose(pose({ radius: 100, beta: 3 }), { lowerRadius: 1, upperRadius: 20, lowerBeta: 0.1, upperBeta: 1.5 })
    expect(p.radius).toBe(20)
    expect(p.beta).toBe(1.5)
    const q = clampPose(pose({ radius: 0.1, beta: -1 }), { lowerRadius: 1, upperRadius: 20, lowerBeta: 0.1, upperBeta: 1.5 })
    expect(q.radius).toBe(1)
    expect(q.beta).toBe(0.1)
  })
  it('leaves values alone when no limits are given', () => {
    const p = pose({ radius: 99, beta: 9 })
    expect(clampPose(p, {})).toEqual(p)
  })
})

describe('TweenClock', () => {
  it('is idle before start: progress 0, not active, not done', () => {
    const c = new TweenClock(450)
    expect(c.progress(1000)).toBe(0)
    expect(c.active).toBe(false)
    expect(c.done).toBe(false)
  })
  it('progresses with time and is done at the end', () => {
    const c = new TweenClock(400)
    c.start(1000)
    expect(c.active).toBe(true)
    expect(c.progress(1000)).toBe(0)
    expect(c.progress(1100)).toBeCloseTo(0.25, 12)
    expect(c.done).toBe(false)
    expect(c.progress(1400)).toBe(1)
    expect(c.done).toBe(true)
    expect(c.active).toBe(false)
    expect(c.progress(9999)).toBe(1)
  })
  it('cancel() makes it inactive and not done', () => {
    const c = new TweenClock(400)
    c.start(0)
    c.cancel()
    expect(c.active).toBe(false)
    expect(c.done).toBe(false)
  })
  it('a zero duration finishes immediately', () => {
    const c = new TweenClock(0)
    c.start(5)
    expect(c.progress(5)).toBe(1)
    expect(c.done).toBe(true)
  })
})
