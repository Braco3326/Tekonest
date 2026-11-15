/**
 * Mission 3 B, stage 1: a cable's hand-drawn route is design data held by the store (spec §3). `SET_ROUTE { key, points | null }` is one intent (one
 * history entry); unplugging a connection takes its route with it and re-plugging starts automatic; undo / redo restore routes with the rest of the
 * design; a point outside the room is clamped and a route too long for the room is refused at the intent; `rig.connections` and the rule results never
 * change because of a route.
 */
import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { History } from '../../src/creation/history'
import { cableKey } from '../../src/creation/sceneDiff'
import { MAX_ROUTE_POINTS, roomBounds } from '../../src/scene/cableRoute'
import type { DesignState } from '../../src/trials/trial'

const registry = makeRegistry()
const store = (initial?: DesignState) => new CreationStore(registry, creationEvaluator(registry), initial)
const MIC = { instance: 'm', port: 'out-xlr' }
const DESK = { instance: 'q', port: 'in-mic-1' }
const OUT = { instance: 'q', port: 'out-main-l' }
const SPK = { instance: 'k', port: 'in-line-a' }
const KEY = cableKey(MIC, DESK)
const KEY2 = cableKey(OUT, SPK)

/** A design with its lists in id order (a device or cable put back by an undo is appended at the end of the graph's lists: that order is no change). */
const norm = (d: DesignState): DesignState => ({
  ...d,
  rig: {
    ...d.rig,
    instances: [...d.rig.instances].sort((x, y) => x.instanceId.localeCompare(y.instanceId)),
    connections: [...d.rig.connections].sort((x, y) => cableKey(x.a, x.b).localeCompare(cableKey(y.a, y.b))),
  },
  placements: [...d.placements].sort((x, y) => x.instanceId.localeCompare(y.instanceId)),
})

function rig(): CreationStore {
  const s = store()
  s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [1, 0, 2] })
  s.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'q', position: [0, 0, 0] })
  s.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k', position: [4, 0, -2] })
  expect(s.dispatch({ type: 'CONNECT', a: MIC, b: DESK }).ok).toBe(true)
  expect(s.dispatch({ type: 'CONNECT', a: OUT, b: SPK }).ok).toBe(true)
  return s
}

describe('SET_ROUTE: the route is design data', () => {
  it('a design with no route has no `routes` field at all (old designs stay byte-identical)', () => {
    const s = rig()
    expect('routes' in s.design()).toBe(false)
    expect(JSON.stringify(s.design())).not.toContain('routes')
  })

  it('stores the points under the cable key, returns its normalized form and the inverse (automatic shape again)', () => {
    const s = rig()
    const rev = s.revision
    const r = s.dispatch({ type: 'SET_ROUTE', key: KEY, points: [[0.5, 1], [0.5, 0.25]] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.normalized).toEqual({ type: 'SET_ROUTE', key: KEY, points: [[0.5, 1], [0.5, 0.25]] })
    expect(r.inverse).toEqual([{ type: 'SET_ROUTE', key: KEY, points: null }])
    expect(s.design().routes).toEqual({ [KEY]: [[0.5, 1], [0.5, 0.25]] })
    expect(s.route(KEY)).toEqual([[0.5, 1], [0.5, 0.25]])
    expect(s.route(KEY2)).toBeNull()
    expect(s.revision).toBe(rev + 1)
  })

  it('the key is direction-free: the same cable named from its other end', () => {
    const s = rig()
    expect(s.dispatch({ type: 'SET_ROUTE', key: cableKey(DESK, MIC), points: [[0, 1]] }).ok).toBe(true)
    expect(s.route(KEY)).toEqual([[0, 1]])
  })

  it('a returned route is a copy (mutating it never touches the store)', () => {
    const s = rig()
    s.dispatch({ type: 'SET_ROUTE', key: KEY, points: [[0, 1]] })
    s.route(KEY)![0]![0] = 99
    s.design().routes![KEY]![0]![0] = 99
    expect(s.route(KEY)).toEqual([[0, 1]])
  })

  it('null or [] goes back to the automatic shape; the inverse puts the route back', () => {
    const s = rig()
    s.dispatch({ type: 'SET_ROUTE', key: KEY, points: [[0, 1]] })
    for (const points of [null, [] as [number, number][]]) {
      s.dispatch({ type: 'SET_ROUTE', key: KEY, points: [[0, 1]] })
      const r = s.dispatch({ type: 'SET_ROUTE', key: KEY, points })
      expect(r.ok && r.normalized).toEqual({ type: 'SET_ROUTE', key: KEY, points: null })
      expect(r.ok && r.inverse).toEqual([{ type: 'SET_ROUTE', key: KEY, points: [[0, 1]] }])
      expect(s.route(KEY)).toBeNull()
      expect('routes' in s.design()).toBe(false)
    }
  })

  it('refuses a key that is no cable, bad points and too many points, changing nothing (no revision, no notify)', () => {
    const s = rig()
    let n = 0
    s.subscribe(() => n++)
    const rev = s.revision
    const before = s.design()
    const bad: [unknown, string][] = [
      [{ type: 'SET_ROUTE', key: 'nope|nada', points: [[0, 0]] }, 'UNKNOWN_CONNECTION'],
      [{ type: 'SET_ROUTE', key: KEY, points: [[0, Number.NaN]] }, 'INVALID_ROUTE'],
      [{ type: 'SET_ROUTE', key: KEY, points: [[0, 1, 2]] }, 'INVALID_ROUTE'],
      [{ type: 'SET_ROUTE', key: KEY, points: 'x' }, 'INVALID_ROUTE'],
      [{ type: 'SET_ROUTE', key: KEY, points: Array.from({ length: MAX_ROUTE_POINTS + 1 }, (_, i) => [i * 0.01, 0]) }, 'ROUTE_TOO_LONG'],
      [{ type: 'SET_ROUTE', key: 42, points: [[0, 0]] }, 'INVALID_ROUTE'],
    ]
    for (const [intent, code] of bad) {
      const r = s.dispatch(intent as never)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.code).toBe(code)
    }
    expect(s.revision).toBe(rev)
    expect(n).toBe(0)
    expect(s.design()).toEqual(before)
  })

  it('with the room known: a point outside the floor is clamped onto the room (5 cm lattice), a route longer than the room is refused', () => {
    const s = rig()
    s.setRouteBounds(() => roomBounds(12, 10)) // x in [-6, 6], z in [-5, 5]
    const r = s.dispatch({ type: 'SET_ROUTE', key: KEY, points: [[0.25, 0.5], [9, -7.3], [-6.02, 2]] })
    expect(r.ok && r.normalized).toEqual({ type: 'SET_ROUTE', key: KEY, points: [[0.25, 0.5], [6, -5], [-6, 2]] })
    // 2 × (12 + 10) m = 44 m: a back-and-forth of 6 × 11 m is 55 m
    const zigzag: [number, number][] = [[-5.5, 0], [5.5, 0], [-5.5, 0], [5.5, 0], [-5.5, 0], [5.5, 0]]
    const t = s.dispatch({ type: 'SET_ROUTE', key: KEY, points: zigzag })
    expect(t.ok).toBe(false)
    if (!t.ok) expect(t.error.code).toBe('ROUTE_TOO_LONG')
    expect(s.route(KEY)).toEqual([[0.25, 0.5], [6, -5], [-6, 2]])
  })

  it('a route never changes the rig, its connections or the rule results', () => {
    const s = rig()
    const snap = JSON.stringify(s.snapshot())
    const events = JSON.stringify(s.events())
    const rigBefore = JSON.stringify(s.design().rig)
    s.dispatch({ type: 'SET_ROUTE', key: KEY, points: [[0, 1], [2, 1]] })
    expect(JSON.stringify(s.snapshot())).toBe(snap)
    expect(JSON.stringify(s.events())).toBe(events)
    expect(JSON.stringify(s.design().rig)).toBe(rigBefore)
    expect(s.design().placements).toEqual(rig().design().placements)
  })
})

describe('routes follow their cable', () => {
  it('UNPLUG takes the route with it; its undo brings back cable and route; a fresh CONNECT is automatic', () => {
    const s = rig()
    s.dispatch({ type: 'SET_ROUTE', key: KEY, points: [[0, 1]] })
    const u = s.dispatch({ type: 'UNPLUG', a: DESK, b: MIC })
    expect(u.ok).toBe(true)
    expect(s.route(KEY)).toBeNull()
    expect('routes' in s.design()).toBe(false)
    expect(u.ok && u.inverse).toEqual([
      { type: 'CONNECT', a: DESK, b: MIC },
      { type: 'SET_ROUTE', key: KEY, points: [[0, 1]] },
    ])
    expect(s.dispatchAll(u.ok ? u.inverse : []).ok).toBe(true)
    expect(s.route(KEY)).toEqual([[0, 1]])
    // unplug again, plug again by hand: automatic
    s.dispatch({ type: 'UNPLUG', a: MIC, b: DESK })
    s.dispatch({ type: 'CONNECT', a: MIC, b: DESK })
    expect(s.route(KEY)).toBeNull()
  })

  it('DISCONNECT (by id) drops the route too', () => {
    const s = rig()
    s.dispatch({ type: 'SET_ROUTE', key: KEY, points: [[0, 1]] })
    const id = s.connectionAt(MIC)!
    expect(s.dispatch({ type: 'DISCONNECT', connectionId: id }).ok).toBe(true)
    expect(s.route(KEY)).toBeNull()
  })

  it('an UNPLUG of a cable with no route has exactly the old inverse', () => {
    const s = rig()
    const u = s.dispatch({ type: 'UNPLUG', a: MIC, b: DESK })
    expect(u.ok && u.inverse).toEqual([{ type: 'CONNECT', a: MIC, b: DESK }])
  })

  it('REMOVE a device drops the routes of its cables; its undo restores device, cables and routes', () => {
    const s = rig()
    s.dispatch({ type: 'SET_ROUTE', key: KEY, points: [[0, 1]] })
    s.dispatch({ type: 'SET_ROUTE', key: KEY2, points: [[2, -1]] })
    const before = s.design()
    const r = s.dispatch({ type: 'REMOVE', instanceId: 'q' })
    expect(r.ok).toBe(true)
    expect(s.design().routes).toBeUndefined()
    expect(s.dispatchAll(r.ok ? r.inverse : []).ok).toBe(true)
    expect(norm(s.design())).toEqual(norm(before))
    expect(s.design().routes).toEqual({ [KEY]: [[0, 1]], [KEY2]: [[2, -1]] })
  })

  it('REMOVE a device with no routed cable keeps exactly the old inverse (no SET_ROUTE in it)', () => {
    const s = rig()
    s.dispatch({ type: 'SET_ROUTE', key: KEY2, points: [[2, -1]] })
    const r = s.dispatch({ type: 'REMOVE', instanceId: 'm' })
    expect(r.ok && r.inverse.some((i) => i.type === 'SET_ROUTE')).toBe(false)
    expect(s.route(KEY2)).toEqual([[2, -1]])
  })
})

describe('undo / redo and whole designs', () => {
  it('one history.do = one entry; undo restores the previous route, redo the new one', () => {
    const s = rig()
    const h = new History(s)
    h.do({ type: 'SET_ROUTE', key: KEY, points: [[0, 1]] }, 'trace')
    h.do({ type: 'SET_ROUTE', key: KEY, points: [[0, 1], [1, 1]] }, 'move a point')
    expect(h.sizes.undo).toBe(2)
    expect(h.undo()).toBe(true)
    expect(s.route(KEY)).toEqual([[0, 1]])
    expect(h.undo()).toBe(true)
    expect(s.route(KEY)).toBeNull()
    expect(h.redo()).toBe(true)
    expect(h.redo()).toBe(true)
    expect(s.route(KEY)).toEqual([[0, 1], [1, 1]])
  })

  it('undo of an unplug through History brings the route back with the cable', () => {
    const s = rig()
    const h = new History(s)
    h.do({ type: 'SET_ROUTE', key: KEY, points: [[0, 1]] })
    h.do({ type: 'UNPLUG', a: MIC, b: DESK })
    expect(s.route(KEY)).toBeNull()
    h.undo()
    expect(s.route(KEY)).toEqual([[0, 1]])
    h.redo()
    expect(s.route(KEY)).toBeNull()
    expect(s.design().rig.connections).toHaveLength(1)
  })

  it('APPLY_DESIGN keeps the routes of cables it builds, drops the others and any corrupt one, and its inverse is the previous design with its routes', () => {
    const s = rig()
    s.dispatch({ type: 'SET_ROUTE', key: KEY, points: [[0, 1]] })
    const before = s.design()
    const next: DesignState = {
      ...rig().design(),
      routes: {
        [KEY2]: [[3, -1]],
        'ghost a|ghost b': [[1, 1]],
        [KEY]: [[0, Number.NaN]] as [number, number][],
      },
    }
    const r = s.dispatch({ type: 'APPLY_DESIGN', design: next })
    expect(r.ok).toBe(true)
    expect(s.design().routes).toEqual({ [KEY2]: [[3, -1]] })
    expect(r.ok && r.inverse).toEqual([{ type: 'APPLY_DESIGN', design: before }])
    expect(s.dispatch(r.ok ? r.inverse[0]! : (null as never)).ok).toBe(true)
    expect(s.design()).toEqual(before)
  })

  it('a non-object routes value is ignored (the design still loads, without routes)', () => {
    const d = { ...rig().design(), routes: 'garbage' } as unknown as DesignState
    const s = store(d)
    expect(s.initialLoad.ok).toBe(true)
    expect(s.design().rig.connections).toHaveLength(2)
    expect(s.design().routes).toBeUndefined()
  })

  it('the initial design brings its routes', () => {
    const d: DesignState = { ...rig().design(), routes: { [KEY]: [[0.5, 0.5]] } }
    expect(store(d).route(KEY)).toEqual([[0.5, 0.5]])
  })

  it('a failed group rolls the routes back with everything else', () => {
    const s = rig()
    s.dispatch({ type: 'SET_ROUTE', key: KEY, points: [[0, 1]] })
    const before = s.design()
    const r = s.dispatchAll([
      { type: 'SET_ROUTE', key: KEY, points: [[2, 2]] },
      { type: 'UNPLUG', a: MIC, b: DESK },
      { type: 'SET_ROUTE', key: 'nope', points: [[0, 0]] },
    ])
    expect(r.ok).toBe(false)
    expect(norm(s.design())).toEqual(norm(before))
    expect(s.route(KEY)).toEqual([[0, 1]])
  })
})
