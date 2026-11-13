// G14b: what the icon and the bubble keep clear of besides the page's controls: a margin around what a step points at, and the centre of the 3D view.
import { describe, expect, it } from 'vitest'
import { CENTRE_SHARE, CENTRE_MIN_WINDOW_PX, RING_CLEARANCE_PX, TARGET_CLEARANCE_PX, chooseClearance, clearanceChoice, guideClearance, haloOf, minus } from '../../src/guide/clearance'
import type { Rect } from '../../src/guide/vendor/core/types'

const area = (rs: readonly Rect[]): number => rs.reduce((s, r) => s + r.w * r.h, 0)
const meets = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const centreIn = (a: Rect, t: Rect): boolean => a.x + a.w / 2 >= t.x && a.x + a.w / 2 <= t.x + t.w && a.y + a.h / 2 >= t.y && a.y + a.h / 2 <= t.y + t.h
const WIN = { w: 1366, h: 768 }
const VIEW: Rect = { x: 32, y: 81, w: 1302, h: 659 }
const CONSOLE: Rect = { x: 594, y: 297, w: 178, h: 159 }

describe('haloOf: four strips around a target', () => {
  it('surrounds the target at the clearance, corners included, and never covers it', () => {
    const h = haloOf(CONSOLE, 34)
    expect(h).toHaveLength(4)
    for (const s of h) expect(meets(s, CONSOLE), JSON.stringify(s)).toBe(false)
    // every point within 34 px of the target (corners too) is under a strip
    for (const [x, y] of [[CONSOLE.x - 33, CONSOLE.y - 33], [CONSOLE.x + CONSOLE.w + 33, CONSOLE.y + CONSOLE.h + 33], [CONSOLE.x + 50, CONSOLE.y - 1], [CONSOLE.x - 1, CONSOLE.y + 50]])
      expect(h.some((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h), `${x},${y}`).toBe(true)
    // the widget drops an obstacle whose centre lies in the target (it is the target): no strip is dropped
    for (const s of h) expect(centreIn(s, CONSOLE)).toBe(false)
  })
})

describe('minus: a rect without another', () => {
  it('is the rect itself when they do not meet, nothing when it is covered, else up to four disjoint pieces of the right area', () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 100 }
    expect(minus(a, { x: 200, y: 0, w: 10, h: 10 })).toEqual([a])
    expect(minus(a, { x: -10, y: -10, w: 200, h: 200 })).toEqual([])
    const hole: Rect = { x: 40, y: 40, w: 20, h: 20 }
    const parts = minus(a, hole)
    expect(parts).toHaveLength(4)
    expect(area(parts)).toBe(100 * 100 - 20 * 20)
    for (const p of parts) expect(meets(p, hole)).toBe(false)
  })
})

describe('guideClearance', () => {
  it('at rest (no target): the centre box of the view, 20 % x 20 %', () => {
    const c = guideClearance({ view: VIEW, targets: [], window: WIN })
    expect(c).toEqual([{ x: VIEW.x + VIEW.w * 0.4, y: VIEW.y + VIEW.h * 0.4, w: VIEW.w * CENTRE_SHARE, h: VIEW.h * CENTRE_SHARE }])
  })

  it('pointing at the console in the middle: the margin around it, and the part of the centre box the console does not cover, none of it on the console', () => {
    const c = guideClearance({ view: VIEW, targets: [CONSOLE], window: WIN })
    for (const r of c) expect(meets(r, CONSOLE), JSON.stringify(r)).toBe(false)
    for (const r of c) expect(centreIn(r, CONSOLE)).toBe(false)
    const centre = { x: VIEW.x + VIEW.w * 0.4, y: VIEW.y + VIEW.h * 0.4, w: VIEW.w * 0.2, h: VIEW.h * 0.2 }
    // the centre box without the console: the console itself is the target (the widget keeps the icon and the bubble off it already)
    expect(c.slice(4)).toEqual(minus(centre, CONSOLE))
    expect(c.slice(4).length).toBeGreaterThan(0)
    // the margin: TARGET_CLEARANCE_PX = the ledger's 30 px from the RING, which the widget draws 4 px outside the target, + 2 px of rounding
    expect(TARGET_CLEARANCE_PX).toBe(36)
    expect(c.slice(0, 4)).toEqual(haloOf(CONSOLE, TARGET_CLEARANCE_PX))
  })

  it('a target larger than a quarter of the window (the place picker) gets no margin: the guide would have nowhere left to stand', () => {
    const big: Rect = { x: 100, y: 100, w: 900, h: 500 }
    const c = guideClearance({ view: VIEW, targets: [big], window: WIN })
    expect(c.every((r) => !meets(r, big))).toBe(true)
    expect(c).toEqual(minus({ x: VIEW.x + VIEW.w * 0.4, y: VIEW.y + VIEW.h * 0.4, w: VIEW.w * 0.2, h: VIEW.h * 0.2 }, big))
  })

  it('a window narrower than CENTRE_MIN_WINDOW_PX (a phone: the bubble spans it) keeps no centre box, the margin stays', () => {
    expect(CENTRE_MIN_WINDOW_PX).toBe(768)
    expect(guideClearance({ view: { x: 0, y: 32, w: 390, h: 600 }, targets: [], window: { w: 390, h: 844 } })).toEqual([])
    const t: Rect = { x: 100, y: 300, w: 40, h: 40 }
    expect(guideClearance({ view: { x: 0, y: 32, w: 390, h: 600 }, targets: [t], window: { w: 390, h: 844 } })).toEqual(haloOf(t, TARGET_CLEARANCE_PX))
  })

  it('no view, or a malformed rect: nothing from it (never a throw)', () => {
    expect(guideClearance({ view: null, targets: [], window: WIN })).toEqual([])
    expect(guideClearance({ view: { x: NaN, y: 0, w: 10, h: 10 }, targets: [{ x: 0, y: 0, w: Infinity, h: 3 }], window: WIN })).toEqual([])
  })
})

describe('a target on a device body (the ring is the 56 px marker on the console)', () => {
  const MARKER: Rect = { x: 655, y: 349, w: 56, h: 56 }
  it('keeps off the whole body (less the marker), then 36 px around the BODY, then the centre less the body', () => {
    const c = guideClearance({ view: VIEW, targets: [MARKER], window: WIN, bodies: [{ x: 10, y: 10, w: 50, h: 50 }, CONSOLE] })
    const body = c.slice(0, 4)
    expect(body).toEqual(minus(CONSOLE, MARKER))
    expect(area(body)).toBe(CONSOLE.w * CONSOLE.h - MARKER.w * MARKER.h)
    for (const r of c) expect(meets(r, MARKER) || centreIn(r, MARKER), JSON.stringify(r)).toBe(false)
    expect(c.slice(4, 8)).toEqual(haloOf(CONSOLE, TARGET_CLEARANCE_PX))
    for (const r of c.slice(8)) expect(meets(r, CONSOLE), JSON.stringify(r)).toBe(false)
  })
  it('chooseClearance: the body while the bubble has room off it; with no room at all, only the strips off the ring around it (the placement of the widget from before)', () => {
    const roomy = chooseClearance({ view: VIEW, targets: [MARKER], window: WIN, bodies: [CONSOLE], controls: [], bubble: { w: 352, h: 300 }, restIcon: null })
    expect(roomy).toEqual(guideClearance({ view: VIEW, targets: [MARKER], window: WIN, bodies: [CONSOLE] }))
    const controls = [{ x: 0, y: 0, w: 1366, h: 300 }, { x: 0, y: 460, w: 1366, h: 308 }, { x: 0, y: 0, w: 20, h: 20 }]
    const got = chooseClearance({ view: VIEW, targets: [MARKER], window: WIN, bodies: [CONSOLE], controls, bubble: { w: 352, h: 300 }, restIcon: null })
    expect(got).toEqual(haloOf(CONSOLE, RING_CLEARANCE_PX))
  })
  it('chooseClearance, while a step points at something, counts the icon where the widget will put it, not where it is now (mid-glide it would make the choice depend on timing)', () => {
    const controls = [{ x: 0, y: 0, w: 1366, h: 81 }, { x: 0, y: 0, w: 520, h: 768 }, { x: 1180, y: 0, w: 186, h: 768 }, { x: 0, y: 600, w: 1366, h: 168 }]
    const free = chooseClearance({ view: VIEW, targets: [MARKER], window: WIN, bodies: [CONSOLE], controls, bubble: { w: 352, h: 300 }, restIcon: null })
    const passing = chooseClearance({ view: VIEW, targets: [MARKER], window: WIN, bodies: [CONSOLE], controls, bubble: { w: 352, h: 300 }, restIcon: { x: 950, y: 300, w: 56, h: 56 } })
    expect(free).toEqual(guideClearance({ view: VIEW, targets: [MARKER], window: WIN, bodies: [CONSOLE] }))
    expect(passing).toEqual(free)
    // at rest the icon is where it is: standing in the only place the bubble had, it leaves none
    const whole: Rect = { x: 0, y: 0, w: 1366, h: 768 }
    const atRest = (restIcon: Rect | null) => chooseClearance({ view: whole, targets: [], window: WIN, controls: [{ x: 0, y: 0, w: 900, h: 768 }], bubble: { w: 352, h: 500 }, restIcon })
    expect(atRest(null)).toEqual(guideClearance({ view: whole, targets: [], window: WIN }))
    expect(atRest({ x: 1100, y: 350, w: 56, h: 56 })).toEqual([])
  })
  it('a target off every body: its own zone (no body pieces)', () => {
    expect(guideClearance({ view: VIEW, targets: [MARKER], window: WIN, bodies: [{ x: 0, y: 0, w: 40, h: 40 }] })).toEqual(guideClearance({ view: VIEW, targets: [MARKER], window: WIN }))
  })
})

describe('chooseClearance: soft obstacles, given up when they would push the bubble onto a control', () => {
  const W = { w: 1000, h: 600 }
  const FULL: Rect = { x: 0, y: 0, w: 1000, h: 600 }
  const BUBBLE = { w: 300, h: 500 }

  it('room for everything: the margin and the centre (and both while no bubble is open)', () => {
    const t: Rect = { x: 860, y: 100, w: 40, h: 40 }
    const all = guideClearance({ view: FULL, targets: [t], window: W })
    expect(chooseClearance({ view: FULL, targets: [t], window: W, controls: [], bubble: BUBBLE, restIcon: null })).toEqual(all)
    expect(chooseClearance({ view: FULL, targets: [t], window: W, controls: [{ x: 0, y: 0, w: 1000, h: 600 }], bubble: null, restIcon: null })).toEqual(all)
  })

  it('the only place clear of the controls is over the centre: the centre is given up (a control is never covered to keep a measure free)', () => {
    // controls on the left and the right leave one 310 px column, across the centre box (400..600 x 240..360); the bubble is 500 tall: it must cross the centre
    const controls: Rect[] = [{ x: 0, y: 0, w: 400, h: 600 }, { x: 710, y: 0, w: 290, h: 600 }]
    expect(chooseClearance({ view: FULL, targets: [], window: W, controls, bubble: BUBBLE, restIcon: { x: 920, y: 520, w: 56, h: 56 } })).toEqual([])
    // the same column, wide enough beside the centre box: kept
    const wide: Rect[] = [{ x: 0, y: 0, w: 50, h: 600 }]
    expect(chooseClearance({ view: FULL, targets: [], window: W, controls: wide, bubble: BUBBLE, restIcon: { x: 920, y: 520, w: 56, h: 56 } })).toEqual(guideClearance({ view: FULL, targets: [], window: W }))
  })

  it('the centre is given up before the margin: with a target, a column that crosses the centre keeps the margin', () => {
    // one free column 400..760 crossing the centre; the target sits low in it, far from where the bubble goes
    const controls: Rect[] = [{ x: 0, y: 0, w: 400, h: 600 }, { x: 760, y: 0, w: 240, h: 600 }]
    const t: Rect = { x: 690, y: 560, w: 30, h: 30 }
    const got = chooseClearance({ view: FULL, targets: [t], window: W, controls, bubble: { w: 280, h: 300 }, restIcon: null })
    expect(got).toEqual(haloOf(t, TARGET_CLEARANCE_PX))
  })

  it('no room at all: only the thin strips that keep the bubble off the ring (never on the ring where a place off it exists)', () => {
    const t: Rect = { x: 100, y: 100, w: 40, h: 40 }
    const got = chooseClearance({ view: FULL, targets: [t], window: W, controls: [{ x: 0, y: 0, w: 1000, h: 600 }], bubble: BUBBLE, restIcon: null })
    expect(RING_CLEARANCE_PX).toBe(6)
    expect(got).toEqual(haloOf(t, RING_CLEARANCE_PX))
    // and no target: nothing
    expect(chooseClearance({ view: FULL, targets: [], window: W, controls: [{ x: 0, y: 0, w: 1000, h: 600 }], bubble: BUBBLE, restIcon: null })).toEqual([])
  })

  it('clearanceChoice never goes back to a stricter level than from (the mount keeps the level while the key holds)', () => {
    const t: Rect = { x: 860, y: 100, w: 40, h: 40 }
    const roomy = { view: FULL, targets: [t], window: W, controls: [], bubble: BUBBLE, restIcon: null }
    expect(clearanceChoice(roomy).level).toBe(0)
    expect(clearanceChoice(roomy, 1)).toEqual({ level: 1, rects: haloOf(t, TARGET_CLEARANCE_PX) })
    expect(clearanceChoice(roomy, 2).level).toBe(2)
  })

  it('a throw anywhere: nothing (the widget places as before)', () => {
    expect(chooseClearance({ view: FULL, targets: [], window: W, controls: null as unknown as Rect[], bubble: BUBBLE, restIcon: null })).toEqual([])
  })
})
