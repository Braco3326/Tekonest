/**
 * Mission 3 B, stage 1: the hand-drawn route's plan geometry (src/scene/cableRoute.ts) and how a routed cable lies on the surface (gravityPath with a
 * route, rounded corners). Spec docs/superpowers/specs/2026-11-15-hand-drawn-cables-design.md §4 and §6: snap to each of the four sizes (ties, negative
 * coordinates, the room's edge), « Angles droits », corner rounding (length, never beyond a third of a segment, collinear points), floor lift and deck
 * crossing in every room of content/rooms, the length of a route, an empty or one-point route, and a seeded property test of the length.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { roomLayout } from '../../src/explore/roomLayout'
import { RoomFile } from '../../src/explore/roomSchema'
import { FLOOR_CLEARANCE, type P3 } from '../../src/scene/cablePath'
import { RAMP_SLOPE, SAMPLE_M, buildSupport, gravityPath, supportReport, type XZ } from '../../src/scene/cableGravity'
import {
  CORNER_RADIUS_M,
  DEFAULT_SNAP_M,
  SNAP_STEPS_M,
  clampRoute,
  clampToRoom,
  planLengthM,
  roomBounds,
  roundCorners,
  routeLengthM,
  snapRightAngle,
  snapToGrid,
} from '../../src/scene/cableRoute'

const xz = (x: number, z: number): XZ => ({ x, z })
const near = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) <= eps
const onGrid = (v: number, step: number): boolean => near(v / step, Math.round(v / step), 1e-6)
const ROOM = roomBounds(12, 10) // x in [-6, 6], z in [-5, 5]

describe('snapToGrid: the nearest crossing of the chosen grid', () => {
  it('offers the four sizes of the design, 25 cm by default', () => {
    expect([...SNAP_STEPS_M]).toEqual([0.1, 0.25, 0.5, 1])
    expect(DEFAULT_SNAP_M).toBe(0.25)
  })

  it('snaps to each size', () => {
    expect(snapToGrid(xz(1.234, -2.371), 0.1)).toEqual(xz(1.2, -2.4))
    expect(snapToGrid(xz(1.234, -2.371), 0.25)).toEqual(xz(1.25, -2.25))
    expect(snapToGrid(xz(1.234, -2.371), 0.5)).toEqual(xz(1, -2.5))
    expect(snapToGrid(xz(1.234, -2.371), 1)).toEqual(xz(1, -2))
  })

  it('ties go away from zero, the same on both sides (a mirrored point snaps to the mirrored crossing)', () => {
    expect(snapToGrid(xz(0.125, -0.125), 0.25)).toEqual(xz(0.25, -0.25))
    expect(snapToGrid(xz(0.35, -0.35), 0.1)).toEqual(xz(0.4, -0.4)) // 0.35 / 0.1 is 3.4999… in floating point: still a tie
    expect(snapToGrid(xz(0.5, -1.5), 1)).toEqual(xz(1, -2))
    expect(snapToGrid(xz(0.75, -0.25), 0.5)).toEqual(xz(1, -0.5))
    for (const step of SNAP_STEPS_M)
      for (const v of [0.01, 0.37, 1.1, 2.62, 4.999]) {
        const p = snapToGrid(xz(v, v), step)
        const m = snapToGrid(xz(-v, -v), step)
        expect(m.x).toBe(-p.x === 0 ? 0 : -p.x)
        expect(m.z).toBe(-p.z === 0 ? 0 : -p.z)
      }
  })

  it('never returns -0 and keeps clean decimals (0.3, not 0.30000000000000004)', () => {
    const p = snapToGrid(xz(-0.04, 0.29), 0.1)
    expect(Object.is(p.x, -0)).toBe(false)
    expect(p).toEqual(xz(0, 0.3))
    expect(String(snapToGrid(xz(0.7, 0), 0.1).x)).toBe('0.7')
  })

  it('stays inside the room floor, on the grid: a point past the wall comes back to the last crossing inside', () => {
    expect(snapToGrid(xz(7.3, -9), 0.25, ROOM)).toEqual(xz(6, -5))
    const odd = roomBounds(5.3, 3.7) // x in [-2.65, 2.65], z in [-1.85, 1.85]
    expect(snapToGrid(xz(2.64, 1.9), 0.5, odd)).toEqual(xz(2.5, 1.5))
    expect(snapToGrid(xz(-3, -3), 1, odd)).toEqual(xz(-2, -1))
    expect(snapToGrid(xz(-3, -3), 0.1, odd)).toEqual(xz(-2.6, -1.8))
    // every snapped point is on the grid and inside
    for (const step of SNAP_STEPS_M)
      for (let i = 0; i < 50; i++) {
        const p = snapToGrid(xz(-4 + i * 0.173, 3 - i * 0.141), step, odd)
        expect(onGrid(p.x, step) && onGrid(p.z, step)).toBe(true)
        expect(p.x).toBeGreaterThanOrEqual(odd.minX)
        expect(p.x).toBeLessThanOrEqual(odd.maxX)
        expect(p.z).toBeGreaterThanOrEqual(odd.minZ)
        expect(p.z).toBeLessThanOrEqual(odd.maxZ)
      }
  })
})

describe('snapRightAngle: « Angles droits » keeps the new segment along one of the room axes', () => {
  it('keeps the longer axis and the last point on the other', () => {
    expect(snapRightAngle(xz(1, 1), xz(3, 1.4))).toEqual(xz(3, 1))
    expect(snapRightAngle(xz(1, 1), xz(0.8, -2))).toEqual(xz(1, -2))
    expect(snapRightAngle(xz(-1, 2), xz(-1, 2))).toEqual(xz(-1, 2))
  })
  it('a 45° candidate goes along x (a stated tie rule)', () => {
    expect(snapRightAngle(xz(0, 0), xz(1, 1))).toEqual(xz(1, 0))
    expect(snapRightAngle(xz(0, 0), xz(-1, 1))).toEqual(xz(-1, 0))
  })
  it('two grid points give a grid point', () => {
    const p = snapRightAngle(snapToGrid(xz(0.3, 0.6), 0.25), snapToGrid(xz(2.2, 1.1), 0.25))
    expect(onGrid(p.x, 0.25) && onGrid(p.z, 0.25)).toBe(true)
  })
})

describe('clampRoute / clampToRoom', () => {
  it('clamps every point onto the room rectangle on the grid and drops repeated points', () => {
    expect(clampRoute([xz(0, 0), xz(9, 0), xz(10, 0), xz(9, 7)], ROOM, 0.25)).toEqual([xz(0, 0), xz(6, 0), xz(6, 5)])
  })
  it('clampToRoom (the store): points inside are left exactly as they are; outside ones come to the 5 cm lattice inside the rectangle', () => {
    const odd = roomBounds(5.33, 4)
    expect(clampToRoom([xz(1.234, 0.5)], odd)).toEqual([xz(1.234, 0.5)])
    expect(clampToRoom([xz(9, -9)], odd)).toEqual([xz(2.65, -2)])
    expect(clampToRoom([xz(1, 1), xz(1, 1), xz(2, 1)], odd)).toEqual([xz(1, 1), xz(2, 1)])
  })
  it('an empty route stays empty', () => {
    expect(clampRoute([], ROOM, 0.25)).toEqual([])
    expect(clampToRoom([], ROOM)).toEqual([])
  })
})

describe('roundCorners: a short arc at every bend', () => {
  const L = (pts: readonly XZ[]): number => planLengthM(pts)

  it('an empty, one-point or two-point plan is returned as it is', () => {
    expect(roundCorners([])).toEqual([])
    expect(roundCorners([xz(1, 2)])).toEqual([xz(1, 2)])
    expect(roundCorners([xz(0, 0), xz(3, 0)])).toEqual([xz(0, 0), xz(3, 0)])
  })

  it('a right angle on long segments: radius 0.15 m, the ends kept, shorter than the sharp corner by about (2 - π/2) r', () => {
    const plan = [xz(0, 0), xz(2, 0), xz(2, 2)]
    const r = roundCorners(plan)
    expect(r[0]).toEqual(xz(0, 0))
    expect(r.at(-1)).toEqual(xz(2, 2))
    expect(r.length).toBeGreaterThan(3)
    const saved = L(plan) - L(r)
    expect(saved).toBeGreaterThan((2 - Math.PI / 2) * CORNER_RADIUS_M * 0.9)
    expect(saved).toBeLessThan((2 - Math.PI / 2) * CORNER_RADIUS_M * 1.1)
    // the arc starts 0.15 m before the corner and ends 0.15 m after it, every arc point at r from the centre (1.85, 0.15)
    expect(near(r[1]!.x, 1.85, 1e-9) && near(r[1]!.z, 0, 1e-9)).toBe(true)
    expect(near(r.at(-2)!.x, 2, 1e-9) && near(r.at(-2)!.z, 0.15, 1e-9)).toBe(true)
    for (const p of r.slice(1, -1)) expect(Math.hypot(p.x - 1.85, p.z - 0.15)).toBeCloseTo(CORNER_RADIUS_M, 9)
  })

  it('never takes more than a third of either adjacent segment', () => {
    const plan = [xz(0, 0), xz(0.3, 0), xz(0.3, 2)]
    const r = roundCorners(plan)
    const t = 0.3 - r[1]!.x // the tangent length on the short side
    expect(t).toBeLessThanOrEqual(0.1 + 1e-12)
    expect(t).toBeGreaterThan(0.099)
    // a zig-zag of short segments: the arcs of two corners never overlap (each keeps to its third)
    const zig = [xz(0, 0), xz(0.25, 0), xz(0.25, 0.25), xz(0.5, 0.25), xz(0.5, 0.5)]
    const rz = roundCorners(zig)
    for (let i = 1; i < rz.length; i++) {
      const forward = (rz[i]!.x - rz[i - 1]!.x) + (rz[i]!.z - rz[i - 1]!.z)
      expect(forward).toBeGreaterThan(-1e-12) // monotone staircase: never turns back
    }
  })

  it('collinear points are unchanged (kept, not moved), and a U-turn is left sharp', () => {
    expect(roundCorners([xz(0, 0), xz(1, 0), xz(2, 0)])).toEqual([xz(0, 0), xz(1, 0), xz(2, 0)])
    expect(roundCorners([xz(0, 0), xz(1, 1e-12), xz(2, 0)])).toEqual([xz(0, 0), xz(1, 1e-12), xz(2, 0)])
    expect(roundCorners([xz(0, 0), xz(1, 0), xz(0.5, 0)])).toEqual([xz(0, 0), xz(1, 0), xz(0.5, 0)])
  })

  it('a repeated point is not a corner (no NaN)', () => {
    const r = roundCorners([xz(0, 0), xz(1, 0), xz(1, 0), xz(1, 1)])
    for (const p of r) expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true)
  })

  it('turns either way with the arc inside the corner', () => {
    for (const end of [xz(2, 2), xz(2, -2)]) {
      const r = roundCorners([xz(0, 0), xz(2, 0), end])
      for (const p of r.slice(1, -1)) {
        expect(p.x).toBeLessThanOrEqual(2 + 1e-12)
        expect(Math.sign(p.z) === Math.sign(end.z) || near(p.z, 0, 1e-12)).toBe(true)
      }
    }
  })
})

describe('routeLengthM: the length of the drawn, rounded plan path', () => {
  it('a route between two ends', () => {
    const a = xz(0, 0)
    const b = xz(2, 2)
    expect(routeLengthM(a, [], b)).toBeCloseTo(Math.hypot(2, 2), 12)
    expect(routeLengthM(a, [xz(2, 0)], b)).toBeCloseTo(planLengthM(roundCorners([a, xz(2, 0), b])), 12)
    expect(routeLengthM(a, [xz(2, 0)], b)).toBeLessThan(4)
    expect(routeLengthM(a, [xz(2, 0)], b, { rounded: false })).toBeCloseTo(4, 12)
  })
  it('a one-point route on the straight line is the straight length', () => {
    expect(routeLengthM(xz(0, 0), [xz(1, 0)], xz(3, 0))).toBeCloseTo(3, 12)
  })

  it('seeded property: rounding only shortens, by at most two thirds of the shorter side per corner, never below the straight line; the drawn cable on a flat floor follows it', () => {
    let seed = 20261115
    const rnd = (): number => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0
      return seed / 2 ** 32
    }
    const flat = buildSupport(() => 0)
    for (let trial = 0; trial < 60; trial++) {
      const step = SNAP_STEPS_M[Math.floor(rnd() * SNAP_STEPS_M.length)]!
      const a: P3 = { x: -5 + rnd() * 2, y: 0.4 + rnd(), z: -4 + rnd() * 8 }
      const b: P3 = { x: 3 + rnd() * 2, y: 0.4 + rnd(), z: -4 + rnd() * 8 }
      const n = 1 + Math.floor(rnd() * 6)
      const route = clampRoute(
        Array.from({ length: n }, () => snapToGrid(xz(-4 + rnd() * 8, -4.5 + rnd() * 9), step, ROOM)),
        ROOM,
        step,
      )
      const sharp = routeLengthM(a, route, b, { rounded: false })
      const round = routeLengthM(a, route, b)
      expect(round).toBeLessThanOrEqual(sharp + 1e-9)
      expect(round).toBeGreaterThanOrEqual(Math.hypot(b.x - a.x, b.z - a.z) - 1e-9)
      const plan = [xz(a.x, a.z), ...route, xz(b.x, b.z)]
      let bound = 0
      for (let i = 1; i + 1 < plan.length; i++)
        bound += (2 / 3) * Math.min(Math.hypot(plan[i]!.x - plan[i - 1]!.x, plan[i]!.z - plan[i - 1]!.z), Math.hypot(plan[i + 1]!.x - plan[i]!.x, plan[i + 1]!.z - plan[i]!.z))
      expect(sharp - round).toBeLessThanOrEqual(bound + 1e-9)
      // the drawn cable (ports hanging straight down) runs that plan: its plan length equals the rounded route's
      const drawn = gravityPath({ at: a }, { at: b }, flat, { clearance: FLOOR_CLEARANCE, route, round: true })
      let planDrawn = 0
      for (let i = 1; i < drawn.length; i++) planDrawn += Math.hypot(drawn[i]!.x - drawn[i - 1]!.x, drawn[i]!.z - drawn[i - 1]!.z)
      expect(Math.abs(planDrawn - round)).toBeLessThan(0.08 + 0.01 * round) // the foot bends of the two drops, 5 cm each, cut their corner slightly
      const rep = supportReport(drawn, flat, FLOOR_CLEARANCE)
      expect(rep.minAboveM).toBeGreaterThanOrEqual(-1e-9)
      expect(drawn[0]).toEqual(a)
      expect(drawn.at(-1)).toEqual(b)
    }
  })
})

describe('a routed cable lies on the surface: the floor, a raised deck, a device', () => {
  const ROOMS = join(__dirname, '..', '..', 'content', 'rooms')
  const files = readdirSync(ROOMS).filter((f) => f.endsWith('.json') && f !== 'index.json')

  it('there are rooms, some with a raised deck', () => {
    expect(files.length).toBeGreaterThanOrEqual(30)
  })

  /** Ports at a rack's height near two walls, a staircase route on the 25 cm grid across the room: through every raised zone the room has. */
  for (const f of files) {
    it(`${f.replace('.json', '')}: never under the floor or a deck, climbs a deck edge on a ramp, ends on the ports, follows the route`, () => {
      const parsed = RoomFile.safeParse(JSON.parse(readFileSync(join(ROOMS, f), 'utf8')))
      expect(parsed.success).toBe(true)
      if (!parsed.success) return
      const layout = roomLayout(parsed.data)
      const bounds = roomBounds(layout.width, layout.length)
      const support = buildSupport(layout.floorAt)
      const hw = layout.width / 2
      const hl = layout.length / 2
      let cables = 0
      for (const [fx, fz] of [[-0.4, -0.4], [-0.4, 0.4], [0.4, -0.4], [0, -0.45]] as const) {
        const ax = fx * layout.width
        const az = fz * layout.length
        const a: P3 = { x: ax, y: layout.floorAt(ax, az) + 1.0, z: az }
        const b: P3 = { x: -ax || 0.3 * hw, y: layout.floorAt(-ax || 0.3 * hw, -az) + 0.05, z: -az }
        const route = clampRoute(
          [xz(ax * 0.5, az), xz(ax * 0.5, 0), xz(0, 0), xz(0, -az * 0.6), xz(-ax * 0.5, -az * 0.6), xz(-ax * 0.5, -0.9 * hl * Math.sign(az || 1))].map((p) => snapToGrid(p, 0.25, bounds)),
          bounds,
          0.25,
        )
        const drawn = gravityPath({ at: a }, { at: b }, support, { clearance: FLOOR_CLEARANCE, route, round: true })
        cables++
        expect(drawn[0]).toEqual(a)
        expect(drawn.at(-1)).toEqual(b)
        const rep = supportReport(drawn, support, FLOOR_CLEARANCE)
        expect(rep.minAboveM, `${f}: lowest point relative to the surface`).toBeGreaterThanOrEqual(-1e-9)
        // every stretch off the surface away from the ports is a ramp at an edge: its plan length is the step it climbs over RAMP_SLOPE (5:1), plus one
        // sampling step of the run (a gallery 6 m up is a 1.2 m climb; a 0.8 m deck 0.16 m), never a flying run
        for (const sp of rep.spans.filter((s) => !s.atEnd))
          expect(sp.planM, `${f}: span at ${sp.startM.toFixed(2)} m climbs ${sp.maxAboveM.toFixed(2)} m`).toBeLessThanOrEqual(sp.maxAboveM / RAMP_SLOPE + SAMPLE_M + 0.01)
        // the cable passes within 1 cm (plan) of every route point that is not cut by a rounded corner: the route's corners are where it bends
        for (const q of route) {
          let best = Infinity
          for (let i = 1; i < drawn.length; i++) best = Math.min(best, distToSeg(q, drawn[i - 1]!, drawn[i]!))
          expect(best, `${f}: route point (${q.x}, ${q.z})`).toBeLessThanOrEqual(CORNER_RADIUS_M)
        }
      }
      expect(cables).toBe(4)
    })
  }

  it('a deck crossed by a route: the run climbs the edge on a 5:1 ramp and lies on the deck (0.8 m)', () => {
    const deck = (x: number, z: number): number => (x >= 1 && x <= 3 && Math.abs(z) <= 2 ? 0.8 : 0)
    const support = buildSupport(deck)
    const a: P3 = { x: -1, y: 0.3, z: 0 }
    const b: P3 = { x: 5, y: 0.3, z: 0.5 }
    const drawn = gravityPath({ at: a }, { at: b }, support, { clearance: FLOOR_CLEARANCE, route: [xz(0, 0), xz(2, 0), xz(2, 0.5), xz(4, 0.5)], round: true })
    const rep = supportReport(drawn, support, FLOOR_CLEARANCE)
    expect(rep.minAboveM).toBeGreaterThanOrEqual(-1e-9)
    // on the deck the cable is at deck height
    const onDeck = drawn.filter((p) => p.x > 1.3 && p.x < 2.7)
    expect(onDeck.length).toBeGreaterThan(0)
    for (const p of onDeck) expect(p.y).toBeCloseTo(0.8 + FLOOR_CLEARANCE, 6)
    // the ramp: no stretch off the surface longer than 0.8 / 5 plus a hair, away from the ports
    expect(rep.longestMidSpanM).toBeLessThanOrEqual(0.8 / RAMP_SLOPE + SAMPLE_M + 0.01)
    expect(rep.longestMidSpanM).toBeGreaterThan(0.8 / RAMP_SLOPE - 0.02) // it is a ramp, not a vertical cut
  })

  it('the oracle can fail: the same route with its points dropped under the deck is caught', () => {
    const deck = (x: number): number => (x >= 1 && x <= 3 ? 0.8 : 0)
    const support = buildSupport((x) => deck(x))
    const cutThrough: P3[] = [{ x: -1, y: 0.3, z: 0 }, { x: 0, y: FLOOR_CLEARANCE, z: 0 }, { x: 4, y: FLOOR_CLEARANCE, z: 0 }, { x: 5, y: 0.3, z: 0 }]
    expect(supportReport(cutThrough, support, FLOOR_CLEARANCE).minAboveM).toBeLessThan(-0.5)
  })

  it('over a device on the route: crossed over, never through', () => {
    const support = buildSupport(() => 0, [{ x: 2, z: 0, w: 0.6, d: 0.6, yawDeg: 0, base: 0, h: 0.27 }])
    const drawn = gravityPath({ at: { x: 0, y: 0.5, z: 0 } }, { at: { x: 4, y: 0.5, z: 1 } }, support, {
      clearance: FLOOR_CLEARANCE,
      route: [xz(1, 0), xz(3, 0), xz(3, 1)],
      round: true,
    })
    expect(supportReport(drawn, support, FLOOR_CLEARANCE).minAboveM).toBeGreaterThanOrEqual(-1e-9)
    const over = drawn.filter((p) => Math.abs(p.x - 2) <= 0.3 + 1e-3 && Math.abs(p.z) < 0.3)
    expect(over.length).toBeGreaterThan(0)
    expect(Math.max(...over.map((p) => p.y))).toBeCloseTo(0.27 + FLOOR_CLEARANCE, 6)
  })

  it('without `round` the route corners stay sharp (the budget\'s coarse shape and part A are unchanged)', () => {
    const flat = buildSupport(() => 0)
    const route = [xz(1, 0), xz(1, 2)]
    const sharp = gravityPath({ at: { x: 0, y: 0.5, z: 0 } }, { at: { x: 3, y: 0.5, z: 2 } }, flat, { clearance: FLOOR_CLEARANCE, route })
    expect(sharp.some((p) => near(p.x, 1, 1e-9) && near(p.z, 0, 1e-9))).toBe(true)
    const round = gravityPath({ at: { x: 0, y: 0.5, z: 0 } }, { at: { x: 3, y: 0.5, z: 2 } }, flat, { clearance: FLOOR_CLEARANCE, route, round: true })
    expect(round.some((p) => near(p.x, 1, 1e-9) && near(p.z, 0, 1e-9))).toBe(false)
  })

  it('an empty route is the automatic shape', () => {
    const flat = buildSupport(() => 0)
    const a = { at: { x: 0, y: 0.5, z: 0 } }
    const b = { at: { x: 3, y: 0.5, z: 2 } }
    expect(gravityPath(a, b, flat, { clearance: FLOOR_CLEARANCE, route: [], round: true })).toEqual(gravityPath(a, b, flat, { clearance: FLOOR_CLEARANCE }))
  })
})

function distToSeg(q: XZ, p: P3, r: P3): number {
  const dx = r.x - p.x
  const dz = r.z - p.z
  const l2 = dx * dx + dz * dz
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((q.x - p.x) * dx + (q.z - p.z) * dz) / l2)) : 0
  return Math.hypot(p.x + dx * t - q.x, p.z + dz * t - q.z)
}
