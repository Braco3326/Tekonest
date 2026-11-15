/**
 * Mission 3 B stage 2: the pure tracing and editing model of a hand-drawn cable (spec docs/superpowers/specs/2026-11-15-hand-drawn-cables-design.md §1, §2, §6).
 * Keyboard and pointer feed the same model; one whole tracing is ONE SET_ROUTE at « Terminer »; an edit is one SET_ROUTE; nothing is ever a no-op dispatch.
 */
import { describe, expect, it } from 'vitest'
import {
  BIG_STEP_FACTOR,
  anchorOf,
  candidateOf,
  canFinish,
  cancelTrace,
  deletePoint,
  finishTrace,
  insertOnSegment,
  liveLengthM,
  movePoint,
  nearestSegment,
  placePoint,
  pointerAt,
  removeLastPoint,
  sameRoute,
  setRightAngles,
  setStep,
  startTrace,
  stepCursor,
  stepPoint,
  type TraceState,
} from '../../src/creation/cableTraceModel'
import { DEFAULT_SNAP_M, MAX_ROUTE_POINTS, routeLengthM, type FloorBounds } from '../../src/scene/cableRoute'

const ROOM: FloorBounds = { minX: -5, maxX: 5, minZ: -4, maxZ: 4 }
const A = { x: -3.07, z: 1.12 }
const B = { x: 2.93, z: -0.41 }
const fresh = (o: Partial<Parameters<typeof startTrace>[0]> = {}): TraceState => startTrace({ from: A, to: B, bounds: ROOM, previous: null, ...o })
const onGrid = (v: number, step: number): boolean => Math.abs(v / step - Math.round(v / step)) < 1e-9

describe('starting a tracing', () => {
  it('starts with no point, the 25 cm step, « Angles droits » off, and the cursor on the crossing nearest the first port', () => {
    const s = fresh()
    expect(s.points).toEqual([])
    expect(s.step).toBe(DEFAULT_SNAP_M)
    expect(s.step).toBe(0.25)
    expect(s.rightAngles).toBe(false)
    expect(s.cursor).toEqual({ x: -3, z: 1 })
    expect(anchorOf(s)).toEqual({ x: -3, z: 1 })
    expect(canFinish(s)).toBe(false)
  })
  it('keeps the previous route aside (cancel gives it back), whatever is placed', () => {
    const prev = [{ x: 0, z: 0 }, { x: 1, z: 0 }]
    let s = fresh({ previous: prev })
    s = placePoint(pointerAt(s, { x: 2, z: 2 })).state
    expect(cancelTrace(s)).toEqual(prev)
    expect(cancelTrace(fresh())).toBeNull()
  })
  it('takes a chosen step and the right-angle switch from the last tracing', () => {
    const s = fresh({ step: 0.5, rightAngles: true })
    expect(s.step).toBe(0.5)
    expect(s.rightAngles).toBe(true)
    expect(s.cursor).toEqual({ x: -3, z: 1 })
  })
})

describe('the pointer and the grid', () => {
  it.each([0.1, 0.25, 0.5, 1] as const)('a pointer point snaps to the nearest %s m crossing', (step) => {
    const s = pointerAt(fresh({ step }), { x: 1.234, z: -2.071 })
    expect(onGrid(s.cursor.x, step) && onGrid(s.cursor.z, step)).toBe(true)
    expect(Math.abs(s.cursor.x - 1.234)).toBeLessThanOrEqual(step / 2 + 1e-9)
    expect(Math.abs(s.cursor.z + 2.071)).toBeLessThanOrEqual(step / 2 + 1e-9)
  })
  it('a pointer past a wall comes back to the last crossing inside the room', () => {
    expect(pointerAt(fresh(), { x: 9, z: -12 }).cursor).toEqual({ x: 5, z: -4 })
  })
  it('a click places the point on the cursor crossing, and the next one from there', () => {
    let s = fresh()
    const r1 = placePoint(pointerAt(s, { x: -1.1, z: 1.05 }))
    expect(r1.placed).toEqual({ x: -1, z: 1 })
    s = r1.state
    const r2 = placePoint(pointerAt(s, { x: -0.9, z: -1.4 }))
    expect(r2.placed).toEqual({ x: -1, z: -1.5 })
    expect(r2.state.points).toEqual([{ x: -1, z: 1 }, { x: -1, z: -1.5 }])
    expect(anchorOf(r2.state)).toEqual({ x: -1, z: -1.5 })
    expect(canFinish(r2.state)).toBe(true)
  })
  it('a click on the last point again places nothing (the first click of a double-click)', () => {
    const s = placePoint(pointerAt(fresh(), { x: 0, z: 0 })).state
    const again = placePoint(pointerAt(s, { x: 0.05, z: -0.04 }))
    expect(again.placed).toBeNull()
    expect(again.state.points).toHaveLength(1)
  })
  it('changing the step keeps the placed points and puts the cursor on the new grid', () => {
    let s = placePoint(pointerAt(fresh(), { x: 0.25, z: 0.75 })).state
    s = pointerAt(s, { x: 1.3, z: 0.6 })
    s = setStep(s, 1)
    expect(s.points).toEqual([{ x: 0.25, z: 0.75 }])
    expect(s.cursor).toEqual({ x: 1, z: 1 })
    expect(s.step).toBe(1)
  })
  it('refuses a step that is not one of the four sizes (keeps the state)', () => {
    const s = fresh()
    expect(setStep(s, 0.3 as never)).toBe(s)
  })
})

describe('« Angles droits »', () => {
  it('keeps each new segment along one of the room axes: the longer axis wins', () => {
    let s = setRightAngles(fresh(), true)
    s = placePoint(pointerAt(s, { x: 0, z: 1 })).state // from the port crossing (-3, 1): along x
    expect(s.points).toEqual([{ x: 0, z: 1 }])
    s = pointerAt(s, { x: 0.6, z: -1.8 }) // dz wins
    expect(candidateOf(s)).toEqual({ x: 0, z: -1.75 })
    s = placePoint(s).state
    expect(s.points[1]).toEqual({ x: 0, z: -1.75 })
  })
  it('the first segment starts at the crossing nearest the port, so every point stays on the grid', () => {
    const s = pointerAt(setRightAngles(fresh(), true), { x: -2.6, z: 3.3 })
    const c = candidateOf(s)
    expect(c).toEqual({ x: -3, z: 3.25 })
    expect(onGrid(c.x, 0.25) && onGrid(c.z, 0.25)).toBe(true)
  })
  it('off: any angle', () => {
    const s = pointerAt(fresh(), { x: 1, z: -2 })
    expect(candidateOf(s)).toEqual({ x: 1, z: -2 })
  })
})

describe('the keyboard cursor', () => {
  it('an arrow moves the cursor by one snap step; Maj multiplies it', () => {
    let s = fresh()
    s = stepCursor(s, 1, 0)
    expect(s.cursor).toEqual({ x: -2.75, z: 1 })
    s = stepCursor(s, 0, -1)
    expect(s.cursor).toEqual({ x: -2.75, z: 0.75 })
    s = stepCursor(s, -1, 0, true)
    expect(s.cursor).toEqual({ x: -2.75 - 0.25 * BIG_STEP_FACTOR, z: 0.75 })
    expect(BIG_STEP_FACTOR).toBe(4)
  })
  it('stops at the walls', () => {
    let s = fresh({ step: 1 })
    for (let i = 0; i < 20; i++) s = stepCursor(s, -1, 1, true)
    expect(s.cursor).toEqual({ x: -5, z: 4 })
  })
  it('the keyboard and the pointer give the same route (one model)', () => {
    let k = fresh()
    for (let i = 0; i < 8; i++) k = stepCursor(k, 1, 0)
    k = placePoint(k).state
    for (let i = 0; i < 6; i++) k = stepCursor(k, 0, -1)
    k = placePoint(k).state
    let p = fresh()
    p = placePoint(pointerAt(p, { x: -1.02, z: 1.01 })).state
    p = placePoint(pointerAt(p, { x: -0.98, z: -0.52 })).state
    expect(k.points).toEqual(p.points)
    expect(finishTrace(k)).toEqual(finishTrace(p))
  })
  it('with « Angles droits » the cursor still moves freely; only the placed point is held on the axis', () => {
    let s = setRightAngles(fresh(), true)
    s = stepCursor(stepCursor(stepCursor(s, 1, 0), 1, 0), 0, 1) // (-2.5, 1.25): dx 0.5 > dz 0.25
    expect(s.cursor).toEqual({ x: -2.5, z: 1.25 })
    expect(candidateOf(s)).toEqual({ x: -2.5, z: 1 })
  })
})

describe('remove last, finish, cancel', () => {
  it('Retour arrière removes the last point only (and nothing when there is none)', () => {
    let s = fresh()
    s = placePoint(pointerAt(s, { x: 0, z: 0 })).state
    s = placePoint(pointerAt(s, { x: 1, z: 0 })).state
    const r = removeLastPoint(s)
    expect(r.removed).toEqual({ x: 1, z: 0 })
    expect(r.state.points).toEqual([{ x: 0, z: 0 }])
    const r2 = removeLastPoint(removeLastPoint(r.state).state)
    expect(r2.removed).toBeNull()
    expect(r2.state.points).toEqual([])
  })
  it('finish gives the whole tracing as ONE route ([x, z] metres), the input of one SET_ROUTE', () => {
    let s = fresh()
    s = placePoint(pointerAt(s, { x: 0, z: 0 })).state
    s = placePoint(pointerAt(s, { x: 1, z: -2 })).state
    expect(finishTrace(s)).toEqual({ kind: 'commit', points: [[0, 0], [1, -2]] })
  })
  it('finish with no point commits nothing (« Terminer » is off until a point is placed)', () => {
    expect(finishTrace(fresh())).toEqual({ kind: 'empty' })
  })
  it('finish with exactly the previous route is « unchanged »: no no-op SET_ROUTE', () => {
    let s = fresh({ previous: [{ x: 0, z: 0 }, { x: 1, z: 0 }] })
    s = placePoint(pointerAt(s, { x: 0, z: 0 })).state
    s = placePoint(pointerAt(s, { x: 1, z: 0 })).state
    expect(finishTrace(s)).toEqual({ kind: 'unchanged' })
  })
  it('stops placing at the store limit of points', () => {
    let s = fresh({ step: 0.1 })
    let n = 0
    for (let i = 0; i < MAX_ROUTE_POINTS + 10; i++) {
      s = stepCursor(s, i % 2 === 0 ? 1 : -1, 0) // back and forth: never the last point again, never a wall
      if (placePoint(s).placed) n++
      s = placePoint(s).state
    }
    expect(n).toBe(MAX_ROUTE_POINTS)
    expect(s.points).toHaveLength(MAX_ROUTE_POINTS)
  })
})

describe('the live length', () => {
  it('is the plan length of port A → the placed points → port B, rounded corners (routeLengthM)', () => {
    let s = fresh()
    expect(liveLengthM(s)).toBeCloseTo(Math.hypot(B.x - A.x, B.z - A.z), 9)
    s = placePoint(pointerAt(s, { x: 0, z: 3 })).state
    expect(liveLengthM(s)).toBeCloseTo(routeLengthM(A, [{ x: 0, z: 3 }], B, { rounded: true }), 9)
    expect(liveLengthM(s)).toBeGreaterThan(Math.hypot(B.x - A.x, B.z - A.z))
  })
})

describe('editing afterwards (each completed edit = one SET_ROUTE, never a no-op)', () => {
  const R = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }]
  it('drag a point to another crossing', () => {
    expect(movePoint(R, 1, { x: 1.6, z: -0.4 }, 0.25, ROOM)).toEqual([{ x: 0, z: 0 }, { x: 1.5, z: -0.5 }, { x: 1, z: 1 }])
  })
  it('a drag that ends on the same crossing, or on a neighbour, changes nothing (null)', () => {
    expect(movePoint(R, 1, { x: 1.05, z: 0.04 }, 0.25, ROOM)).toBeNull()
    expect(movePoint(R, 1, { x: 0.02, z: 0.01 }, 0.25, ROOM)).toBeNull()
    expect(movePoint(R, 7, { x: 3, z: 3 }, 0.25, ROOM)).toBeNull()
  })
  it('arrows move the selected point by one step (Maj: four), clamped to the room', () => {
    expect(stepPoint(R, 2, 0, 1, false, 0.25, ROOM)).toEqual([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1.25 }])
    expect(stepPoint(R, 0, -1, 0, true, 0.5, ROOM)).toEqual([{ x: -2, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }])
    expect(stepPoint([{ x: 5, z: 0 }], 0, 1, 0, false, 0.25, ROOM)).toBeNull() // at the wall: nothing moves
  })
  it('a click on a segment adds a point there, on the grid, between its two ends', () => {
    // segments of [A, ...R, B]: 0 = A→R0, 1 = R0→R1, 2 = R1→R2, 3 = R2→B
    expect(nearestSegment(A, R, B, { x: 0.5, z: 0.1 })).toBe(1)
    expect(nearestSegment(A, R, B, { x: 1.1, z: 0.5 })).toBe(2)
    expect(nearestSegment(A, R, B, { x: -1.5, z: 0.55 })).toBe(0)
    expect(insertOnSegment(R, 1, { x: 0.55, z: 0.07 }, 0.25, ROOM)).toEqual([{ x: 0, z: 0 }, { x: 0.5, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }])
    expect(insertOnSegment(R, 0, { x: -1.4, z: 0.6 }, 0.25, ROOM)).toEqual([{ x: -1.5, z: 0.5 }, ...R])
    expect(insertOnSegment(R, 3, { x: 2, z: 0.4 }, 0.25, ROOM)).toEqual([...R, { x: 2, z: 0.5 }])
  })
  it('adding a point onto an existing end changes nothing (null)', () => {
    expect(insertOnSegment(R, 1, { x: 0.96, z: 0.02 }, 0.25, ROOM)).toBeNull()
    expect(insertOnSegment(R, 9, { x: 0.5, z: 0 }, 0.25, ROOM)).toBeNull()
  })
  it('delete a point; deleting the only one gives the automatic shape (an empty route)', () => {
    expect(deletePoint(R, 1)).toEqual([{ x: 0, z: 0 }, { x: 1, z: 1 }])
    expect(deletePoint([{ x: 1, z: 1 }], 0)).toEqual([])
    expect(deletePoint(R, 3)).toBeNull()
  })
  it('a delete that would leave two equal points side by side drops the repeat', () => {
    expect(deletePoint([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 0 }], 1)).toEqual([{ x: 0, z: 0 }])
  })
  it('sameRoute compares routes by their points', () => {
    expect(sameRoute(R, R.map((p) => ({ ...p })))).toBe(true)
    expect(sameRoute(R, R.slice(1))).toBe(false)
    expect(sameRoute([], null)).toBe(true)
  })
})
