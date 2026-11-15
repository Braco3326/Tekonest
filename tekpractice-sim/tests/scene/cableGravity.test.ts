/**
 * Gravity first (founder, 2026-11-15): « no cable may fly anywhere. A cable rests on the floor, on decks and on equipment, and hangs only where it
 * physically must. » The pure shape of a cable (src/scene/cableGravity.ts): it leaves its connector, drops onto the surface under it, runs ON that
 * surface (floor, deck, the top of a device resting there), and rises to the other port; two close raised ports hang as a small loop.
 */
import { describe, expect, it } from 'vitest'
import { catenaryPoints, FLOOR_CLEARANCE, polylineLength, SEGMENTS_FULL, type P3 } from '../../src/scene/cablePath'
import {
  BEND_R,
  buildSupport,
  gravityPath,
  hangInHand,
  LOOP_M,
  LOOP_SAG_MIN,
  RAMP_SLOPE,
  SAMPLE_M,
  supportReport,
  type Support,
  type SupportBox,
} from '../../src/scene/cableGravity'

const C = FLOOR_CLEARANCE
const flat = buildSupport(() => 0)
const pt = (x: number, y: number, z = 0): P3 => ({ x, y, z })
const box = (o: Partial<SupportBox> & { x: number; z: number }): SupportBox => ({ w: 0.5, d: 0.5, yawDeg: 0, base: 0, h: 0.27, ...o })

/** Every inner point and every segment's inner samples are on or above the surface plus the clearance (`tol` under it at most). */
function neverUnder(path: readonly P3[], s: Support, tol = 1e-6): void {
  for (let i = 1; i < path.length - 1; i++) {
    const p = path[i]!
    expect(p.y, `point ${i} (${p.x.toFixed(3)}, ${p.z.toFixed(3)}) under the surface`).toBeGreaterThanOrEqual(s.heightAt(p.x, p.z) + C - tol)
  }
  for (let i = 1; i < path.length; i++) {
    const p = path[i - 1]!
    const q = path[i]!
    for (const k of [0.25, 0.5, 0.75]) {
      const x = p.x + (q.x - p.x) * k
      const z = p.z + (q.z - p.z) * k
      const y = p.y + (q.y - p.y) * k
      // a segment that leaves a port (the connector's own face) is the port's business; every other one stays out of the surface
      if (i === 1 || i === path.length - 1) continue
      expect(y, `segment ${i} at ${k} (${x.toFixed(3)}, ${z.toFixed(3)}) goes into the surface`).toBeGreaterThanOrEqual(s.heightAt(x, z) + C - 1e-3)
    }
  }
}

/** The drawn height of a path over plan x (a path along the x axis). */
const yAtX = (path: readonly P3[], x: number): number => {
  for (let i = 1; i < path.length; i++) {
    const p = path[i - 1]!
    const q = path[i]!
    if ((p.x - x) * (q.x - x) <= 0 && p.x !== q.x) return p.y + ((q.y - p.y) * (x - p.x)) / (q.x - p.x)
  }
  return Number.NaN
}

const endsOnPorts = (path: readonly P3[], a: P3, b: P3): void => {
  expect(path[0]).toEqual(a)
  expect(path.at(-1)).toEqual(b)
}

describe('flat floor', () => {
  it('two connectors 5 cm up, 6 m apart, facing each other: the cable lies on the floor between two short bends', () => {
    const a = pt(0, 0.05)
    const b = pt(6, 0.05)
    const path = gravityPath({ at: a, out: pt(1, 0) }, { at: b, out: pt(-1, 0) }, flat, { clearance: C })
    endsOnPorts(path, a, b)
    neverUnder(path, flat)
    const r = supportReport(path, flat, C)
    expect(r.longestMidSpanM).toBe(0)
    expect(r.longestUnsupportedM).toBeLessThanOrEqual(2 * BEND_R + 1e-9)
    expect(path.filter((q) => q.x > 0.2 && q.x < 5.8).every((q) => Math.abs(q.y - C) < 1e-9)).toBe(true)
    expect(polylineLength(path)).toBeGreaterThanOrEqual(6 - 1e-9)
    expect(polylineLength(path)).toBeLessThan(6.1)
    expect(path.length).toBeLessThan(SEGMENTS_FULL) // a flat run is one straight segment: fewer points than the old parabola
  })
})

describe('deck step', () => {
  const deck = buildSupport((x) => (x >= 2 && x <= 4 ? 0.6 : 0))
  it('the cable climbs the deck, lies on it, and comes down: on the deck at deck height, never through its edge', () => {
    const a = pt(0, 0.05)
    const b = pt(6, 0.05)
    const path = gravityPath({ at: a, out: pt(1, 0) }, { at: b, out: pt(-1, 0) }, deck, { clearance: C })
    endsOnPorts(path, a, b)
    neverUnder(path, deck)
    for (const x of [2.1, 2.5, 3, 3.5, 3.9]) expect(yAtX(path, x)).toBeCloseTo(0.6 + C, 3)
    const r = supportReport(path, deck, C)
    expect(r.longestMidSpanM).toBeLessThanOrEqual(0.6 / RAMP_SLOPE + SAMPLE_M + 0.01) // the two ramps (their toe rounds over one sample step), nothing else off the surface
  })
})

describe('a device in the way', () => {
  const console27 = box({ x: 3, z: 0 })
  const s = buildSupport(() => 0, [console27])
  it('is crossed OVER (on its top), never through, with short ramps', () => {
    const a = pt(0, 0.05)
    const b = pt(6, 0.05)
    const path = gravityPath({ at: a, out: pt(1, 0) }, { at: b, out: pt(-1, 0) }, s, { clearance: C })
    endsOnPorts(path, a, b)
    neverUnder(path, s)
    for (const x of [2.76, 2.9, 3, 3.1, 3.24]) expect(yAtX(path, x)).toBeCloseTo(0.27 + C, 3)
    expect(supportReport(path, s, C).longestMidSpanM).toBeLessThanOrEqual(0.27 / RAMP_SLOPE + SAMPLE_M + 0.01)
  })
  it('turned 45 degrees it is still crossed over its real (rotated) footprint', () => {
    const turned = buildSupport(() => 0, [box({ x: 3, z: 0, w: 1, d: 0.3, yawDeg: 45 })])
    const path = gravityPath({ at: pt(0, 0.05), out: pt(1, 0) }, { at: pt(6, 0.05), out: pt(-1, 0) }, turned, { clearance: C })
    neverUnder(path, turned)
  })
  it('a raised device (on a stand: its base above the floor) is no support: the cable passes under it on the floor', () => {
    const raised = buildSupport(() => 0, [box({ x: 3, z: 0, base: 0.75 })])
    expect(raised.grounded).toHaveLength(0)
    const path = gravityPath({ at: pt(0, 0.05), out: pt(1, 0) }, { at: pt(6, 0.05), out: pt(-1, 0) }, raised, { clearance: C })
    expect(path.filter((q) => q.x > 1 && q.x < 5).every((q) => Math.abs(q.y - C) < 1e-9)).toBe(true)
  })
  it('a device standing on another one supports too (a stack)', () => {
    const stack = buildSupport(() => 0, [box({ x: 3, z: 0, w: 0.6, d: 0.6, h: 0.2 }), box({ x: 3, z: 0, w: 0.4, d: 0.4, base: 0.2, h: 0.1 })])
    expect(stack.grounded).toHaveLength(2)
    expect(stack.heightAt(3, 0)).toBeCloseTo(0.3, 12)
    expect(stack.heightAt(3.25, 0)).toBeCloseTo(0.2, 12)
  })
  it('an unknown height is ignored, never invented: the box is no support', () => {
    const unknown = buildSupport(() => 0, [box({ x: 3, z: 0, h: Number.NaN }), box({ x: 1, z: 0, h: 0 })])
    expect(unknown.grounded).toHaveLength(0)
    expect(unknown.heightAt(3, 0)).toBe(0)
    const path = gravityPath({ at: pt(0, 0.05), out: pt(1, 0) }, { at: pt(6, 0.05), out: pt(-1, 0) }, unknown, { clearance: C })
    expect(path.filter((q) => q.x > 1 && q.x < 5).every((q) => Math.abs(q.y - C) < 1e-9)).toBe(true)
  })
})

describe('raised ports', () => {
  it('a console on a table (0.75 m) to a speaker on the floor: from the connector the cable bends, then DROPS vertically onto the floor', () => {
    const speaker = box({ x: 5, z: 0, w: 0.36, d: 0.35, h: 0.6 })
    const s = buildSupport(() => 0, [speaker])
    const a = pt(0, 0.75 + 0.15) // a connector on the console's rear face
    const b = pt(5 - 0.175, 0.3) // the speaker's input on the face toward the console
    const path = gravityPath({ at: a, out: pt(1, 0) }, { at: b, out: pt(-1, 0) }, s, { clearance: C })
    endsOnPorts(path, a, b)
    neverUnder(path, s)
    const tip = path[3]! // the end of the connector bend (30, 60, 90 degrees)
    expect(tip.x).toBeCloseTo(BEND_R, 9)
    expect(tip.y).toBeCloseTo(a.y - BEND_R, 9)
    const foot = path[4]! // the foot of the drop: straight under the tip, one bend radius above the floor
    expect(foot.x).toBeCloseTo(tip.x, 12)
    expect(foot.z).toBeCloseTo(tip.z, 12)
    expect(foot.y).toBeCloseTo(C + BEND_R, 9)
    const r = supportReport(path, s, C)
    expect(r.minAboveM).toBeGreaterThanOrEqual(-1e-9)
    expect(r.longestMidSpanM).toBe(0)
    expect(r.longestUnsupportedM).toBeLessThanOrEqual(2 * BEND_R + 0.01) // the bends; the drop itself has no plan length
    // honest length: the drop, the floor run and the climb to the speaker's connector are all counted
    expect(polylineLength(path)).toBeGreaterThan(0.75 + 4.5)
  })

  it('a jack recessed 3 cm in its own device panel: the bend leaves the body straight out, it is not lifted onto the device top (e2e regression)', () => {
    const speaker = box({ x: 3, z: 4, w: 0.36, d: 0.35, h: 0.6 })
    const s = buildSupport(() => 0, [speaker])
    const jack = pt(2.97, 0.13, 4 + 0.175 - 0.03) // on the +z face, 3 cm inside the footprint
    const path = gravityPath({ at: pt(0, 0.05, 8), out: pt(0, 0, -1) }, { at: jack, out: pt(0, 0, 1) }, s, { clearance: C })
    const bend = path.slice(-4, -1)
    for (const q of bend) expect(q.y).toBeLessThan(0.2)
    const r = supportReport(path, s, C)
    expect(r.minAboveM).toBeGreaterThanOrEqual(-1e-6)
    expect(r.longestUnsupportedM).toBeLessThanOrEqual(2 * BEND_R + 0.02)
  })

  it('two raised ports far apart hang down to the floor: the lowest point is clamped to the surface, never under it', () => {
    const a = pt(0, 1.5)
    const b = pt(6, 1.5)
    const path = gravityPath({ at: a }, { at: b }, flat, { clearance: C })
    endsOnPorts(path, a, b)
    neverUnder(path, flat)
    expect(Math.min(...path.slice(1, -1).map((q) => q.y))).toBeCloseTo(C, 12)
    // the first move from a connector with no outward direction is straight down
    expect(path[1]!.x).toBe(0)
    expect(path[1]!.y).toBeLessThan(a.y)
    expect(supportReport(path, flat, C).longestUnsupportedM).toBeLessThanOrEqual(BEND_R + 1e-9)
  })

  it('two close raised ports (same rack row, 20 cm apart) make one small hanging loop, not a trip to the floor', () => {
    const a = pt(0, 1.0)
    const b = pt(0.2, 1.0)
    const path = gravityPath({ at: a }, { at: b }, flat, { clearance: C })
    endsOnPorts(path, a, b)
    const low = Math.min(...path.map((q) => q.y))
    expect(low).toBeLessThan(1.0 - LOOP_SAG_MIN * 0.9)
    expect(low).toBeGreaterThan(0.5)
    expect(supportReport(path, flat, C).longestUnsupportedM).toBeLessThanOrEqual(LOOP_M)
  })

  it('a rack drop: two ports one above the other, 1 m apart in height, hang as a loop whose lowest point is clamped to the floor', () => {
    const a = pt(0, 1.2, 0)
    const b = pt(0.1, 0.2, 0)
    const path = gravityPath({ at: a, out: pt(0, 0, -1) }, { at: b, out: pt(0, 0, -1) }, flat, { clearance: C })
    endsOnPorts(path, a, b)
    neverUnder(path, flat)
    expect(Math.min(...path.slice(1, -1).map((q) => q.y))).toBeLessThan(0.2)
  })
})

describe('a hand-drawn route (part B builds on it)', () => {
  it('the run goes through every route point, on the floor, and the ends stay on the ports', () => {
    const a = pt(0, 0.05)
    const b = pt(4, 0.05, 3)
    const route = [{ x: 2, z: 0 }, { x: 2, z: 3 }]
    const path = gravityPath({ at: a, out: pt(1, 0) }, { at: b, out: pt(-1, 0) }, flat, { clearance: C, route })
    endsOnPorts(path, a, b)
    for (const r of route) expect(path.some((q) => Math.abs(q.x - r.x) < 1e-9 && Math.abs(q.z - r.z) < 1e-9 && Math.abs(q.y - C) < 1e-9)).toBe(true)
    expect(polylineLength(path)).toBeGreaterThanOrEqual(2 + 3 + 2 - 0.1)
  })
})

describe('the cable in hand', () => {
  it('keeps its point count, starts at the port and ends at the pointer, lies on the floor between them, never under it', () => {
    for (const to of [pt(0.3, 1.0), pt(3, 1.2), pt(8, 0.4), pt(1, 0.02)]) {
      const from = pt(0, 1.0)
      const pts = hangInHand(from, to, SEGMENTS_FULL + 1, flat, C)
      expect(pts).toHaveLength(SEGMENTS_FULL + 1)
      expect(pts[0]).toEqual(from)
      expect(pts.at(-1)).toEqual(to)
      for (const q of pts.slice(1, -1)) expect(q.y).toBeGreaterThanOrEqual(C - 1e-9)
    }
    const far = hangInHand(pt(0, 1.0), pt(8, 1.0), SEGMENTS_FULL + 1, flat, C)
    expect(far.filter((q) => q.x > 1 && q.x < 7).every((q) => Math.abs(q.y - C) < 1e-6)).toBe(true) // it does not fly between port and hand
  })
})

describe('coarse shape (the budget)', () => {
  it('fewer points, still never under the surface, ends on the ports', () => {
    const s = buildSupport((x) => (x > 2 && x < 4 ? 0.4 : 0), [box({ x: 5, z: 0 })])
    const a = pt(0, 0.9)
    const b = pt(7, 0.05)
    const fine = gravityPath({ at: a, out: pt(1, 0) }, { at: b, out: pt(-1, 0) }, s, { clearance: C })
    const coarse = gravityPath({ at: a, out: pt(1, 0) }, { at: b, out: pt(-1, 0) }, s, { clearance: C, arcs: false, tolM: 0.05 })
    expect(coarse.length).toBeLessThan(fine.length)
    endsOnPorts(coarse, a, b)
    for (const q of coarse.slice(1, -1)) expect(q.y).toBeGreaterThanOrEqual(s.heightAt(q.x, q.z) + C - 1e-9)
  })
})

/** mulberry32: a seeded RNG, the same layouts every run. */
function rng(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

describe('property: random port pairs over random floors, decks and devices (seeded)', () => {
  it('ends on the ports, never under the surface, and off it only on short bends, drops, ramps and close loops', () => {
    const rand = rng(20261115)
    const between = (lo: number, hi: number): number => lo + (hi - lo) * rand()
    let checked = 0
    for (let n = 0; n < 400; n++) {
      const deckOn = rand() < 0.5
      const dk = { x: between(-3, 3), z: between(-3, 3), w: between(0.5, 4), d: between(0.5, 4), y: between(0.2, 1.3) }
      const floorAt = (x: number, z: number): number => (deckOn && Math.abs(x - dk.x) <= dk.w / 2 && Math.abs(z - dk.z) <= dk.d / 2 ? dk.y : 0)
      const boxes: SupportBox[] = []
      for (let k = Math.floor(between(0, 6)); k > 0; k--) {
        const x = between(-4, 4)
        const z = between(-4, 4)
        const raised = rand() < 0.25
        boxes.push(box({ x, z, w: between(0.05, 1.2), d: between(0.05, 0.8), yawDeg: between(0, 360), h: between(0.04, 0.7), base: floorAt(x, z) + (raised ? between(0.5, 1.5) : 0) }))
      }
      const s = buildSupport(floorAt, boxes)
      const port = (): { at: P3; out: P3 | null } => {
        const x = between(-5, 5)
        const z = between(-5, 5)
        const y = s.heightAt(x, z) + (rand() < 0.5 ? between(0.02, 0.4) : between(0.4, 2.5))
        const th = between(0, 2 * Math.PI)
        return { at: pt(x, y, z), out: rand() < 0.2 ? null : pt(Math.cos(th), 0, Math.sin(th)) }
      }
      const a = port()
      const b = port()
      const path = gravityPath(a, b, s, { clearance: C })
      endsOnPorts(path, a.at, b.at)
      // a connector's own bend may meet a support right beside it; every other point is on or above the surface
      for (let i = 1; i < path.length - 1; i++) {
        const q = path[i]!
        expect(q.y, `case ${n} point ${i}`).toBeGreaterThanOrEqual(s.heightAt(q.x, q.z) + C - 1e-6)
      }
      const r = supportReport(path, s, C)
      const maxTop = Math.max(deckOn ? dk.y : 0, ...s.grounded.map((g) => g.base + g.h), 0)
      const top = Math.max(a.at.y, b.at.y, maxTop + C)
      for (const q of path) expect(q.y, `case ${n}: nothing higher than its highest port or support`).toBeLessThanOrEqual(top + 1e-9)
      for (const sp of r.spans) {
        if (sp.atEnd) expect(sp.planM, `case ${n}: an end span (bend, drop, loop)`).toBeLessThanOrEqual(LOOP_M + 4 * BEND_R + 2 * maxTop / RAMP_SLOPE)
        else expect(sp.planM, `case ${n}: a mid span (ramps, a bridge between two supports)`).toBeLessThanOrEqual(4 * maxTop / RAMP_SLOPE + 0.1)
      }
      checked++
    }
    expect(checked).toBe(400)
  })

  it('the oracle can fail: the old parabola between a raised console and a floor speaker flies over most of its run', () => {
    const a = pt(0, 0.9)
    const b = pt(6, 0.3)
    const old = catenaryPoints(a, b, SEGMENTS_FULL, { floorAt: () => 0, clearance: C })
    const r = supportReport(old, flat, C)
    expect(r.longestUnsupportedM).toBeGreaterThan(1.5)
    const now = supportReport(gravityPath({ at: a, out: pt(1, 0) }, { at: b, out: pt(-1, 0) }, flat, { clearance: C }), flat, C)
    expect(now.longestUnsupportedM).toBeLessThan(0.2)
  })
})
