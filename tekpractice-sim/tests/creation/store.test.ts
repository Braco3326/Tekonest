import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { CreationStore } from '../../src/creation/store'
import { creationEvaluator } from '../../src/creation/store'

const store = () => { const r = makeRegistry(); return new CreationStore(r, creationEvaluator(r)) }

describe('CreationStore drives the reference rig through intents only', () => {
  it('spawns with fixed ids, connects, sets controls, poses', () => {
    const s = store()
    for (const [id, dev, x] of [['ql1', 'yamaha-ql1', 0], ['sm58', 'shure-sm58', 1], ['k12-g', 'qsc-k12-2', 6], ['k12-d', 'qsc-k12-2', -6]] as const)
      expect(s.dispatch({ type: 'SPAWN', deviceId: dev, instanceId: id, position: [x, 0, 0] }).ok).toBe(true)
    expect(s.dispatch({ type: 'CONNECT', a: { instance: 'sm58', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }).ok).toBe(true)
    expect(s.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }).ok).toBe(true)
    expect(s.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [6, 2.7, -7.5], yawDeg: 15, tiltDeg: -5, mount: 'stand' }).ok).toBe(true)
    const d = s.design()
    expect(d.rig.instances.map((i) => i.instanceId).sort()).toEqual(['k12-d', 'k12-g', 'ql1', 'sm58'])
    expect(d.rig.connections).toHaveLength(2)
    expect(d.placements.find((p) => p.instanceId === 'k12-g')).toMatchObject({ position_m: [6, 2.7, -7.5], yawDeg: 15, tiltDeg: -5, mount: 'stand' })
  })
  it('a rejected CONNECT is a result, not an exception, and changes nothing', () => {
    const s = store()
    s.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k' })
    s.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'q' })
    const r = s.dispatch({ type: 'CONNECT', a: { instance: 'k', port: 'power-in' }, b: { instance: 'q', port: 'in-mic-2' } })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.ruleId).toBe('R3')
    expect(s.design().rig.connections).toHaveLength(0)
  })
  it('returns inverse intents', () => {
    const s = store()
    const sp = s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [1, 0, 2] })
    expect(sp.ok && sp.inverse).toEqual([{ type: 'REMOVE', instanceId: 'm' }])
    s.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'q' })
    const c = s.dispatch({ type: 'CONNECT', a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'q', port: 'in-mic-1' } })
    expect(c.ok && c.inverse).toEqual([{ type: 'UNPLUG', a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'q', port: 'in-mic-1' } }])
    const id = c.ok ? c.connectionId! : ''
    const dc = s.dispatch({ type: 'DISCONNECT', connectionId: id })
    expect(dc.ok && dc.normalized).toEqual({ type: 'UNPLUG', a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'q', port: 'in-mic-1' } })
    expect(dc.ok && dc.inverse).toEqual([{ type: 'CONNECT', a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'q', port: 'in-mic-1' } }])
  })
  it('REMOVE inverse brings the device back with its pose, controls and cables', () => {
    const s = store()
    s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [1, 0, 2] })
    s.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'q' })
    s.dispatch({ type: 'CONNECT', a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'q', port: 'in-mic-1' } })
    const r = s.dispatch({ type: 'REMOVE', instanceId: 'q' })
    expect(r.ok).toBe(true)
    for (const i of r.ok ? r.inverse : []) s.dispatch(i)
    expect(s.design().rig.connections).toHaveLength(1)
    expect(s.design().rig.instances.some((i) => i.instanceId === 'q')).toBe(true)
  })
  it('REMOVE inverse restores pose (incl. tilt/mount), controls and cables exactly', () => {
    const s = store()
    s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [1, 0, 2] })
    s.dispatch({ type: 'SPAWN', deviceId: 'axia-iq', instanceId: 'x', position: [3, 1, -2], rotationY: 40, tiltDeg: -5, mount: 'stand' })
    s.dispatch({ type: 'SET_CONTROL', instance: 'x', control: 'monitor-mute', value: true })
    s.dispatch({ type: 'CONNECT', a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'x', port: 'in-mic-1' } })
    const before = s.design()
    const r = s.dispatch({ type: 'REMOVE', instanceId: 'x' })
    for (const i of r.ok ? r.inverse : []) expect(s.dispatch(i).ok).toBe(true)
    const after = s.design()
    expect(after.placements.find((p) => p.instanceId === 'x')).toEqual(before.placements.find((p) => p.instanceId === 'x'))
    expect(after.rig.controls.x).toEqual(before.rig.controls.x)
    expect(after.rig.controls.x['monitor-mute']).toBe(true)
    expect(after.rig.connections).toEqual(before.rig.connections)
  })
  it('APPLY_DESIGN replaces everything; its inverse is the previous design', () => {
    const s = store()
    s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
    const before = s.design()
    const r = s.dispatch({ type: 'APPLY_DESIGN', design: { roomId: 'concert-hall-medium', rig: { instances: [], connections: [], controls: {} }, placements: [] } })
    expect(s.design().rig.instances).toHaveLength(0)
    expect(s.design().roomId).toBe('concert-hall-medium')
    expect(r.ok && r.inverse).toEqual([{ type: 'APPLY_DESIGN', design: before }])
  })
  it('notifies subscribers once per dispatch, and never mutates a returned design', () => {
    const s = store(); let n = 0; s.subscribe(() => n++)
    s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
    const d = s.design(); d.rig.instances.length = 0
    expect(n).toBe(1)
    expect(s.design().rig.instances).toHaveLength(1)
  })
  it('newInstanceId never reuses an id', () => {
    const s = store()
    const a = s.newInstanceId('shure-sm58'); s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: a })
    s.dispatch({ type: 'REMOVE', instanceId: a })
    expect(s.newInstanceId('shure-sm58')).not.toBe(a)
  })
})

describe('CreationStore edge cases', () => {
  it('SET_CONTROL returns the previous value as its inverse and rejects bad values as results', () => {
    const s = store()
    s.dispatch({ type: 'SPAWN', deviceId: 'axia-iq', instanceId: 'q' })
    const snap = s.snapshot().instances.find((i) => i.instanceId === 'q')!
    const [control, prev] = Object.entries(snap.controls).find(([, v]) => typeof v === 'boolean')!
    const r = s.dispatch({ type: 'SET_CONTROL', instance: 'q', control, value: !prev })
    expect(r.ok && r.inverse).toEqual([{ type: 'SET_CONTROL', instance: 'q', control, value: prev }])
    expect(s.design().rig.controls.q[control]).toBe(!prev)
    const bad = s.dispatch({ type: 'SET_CONTROL', instance: 'q', control, value: 'nope' })
    expect(bad.ok).toBe(false)
  })
  it('SET_POSE on a missing instance is UNKNOWN_INSTANCE; its inverse is the previous pose', () => {
    const s = store()
    const miss = s.dispatch({ type: 'SET_POSE', instanceId: 'x', position: [0, 0, 0], yawDeg: 0, tiltDeg: 0, mount: 'floor' })
    expect(!miss.ok && miss.error.code).toBe('UNKNOWN_INSTANCE')
    s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [1, 0, 2], rotationY: 30 })
    const r = s.dispatch({ type: 'SET_POSE', instanceId: 'm', position: [3, 0, 3], yawDeg: 0, tiltDeg: 0, mount: 'floor' })
    expect(r.ok && r.inverse).toEqual([{ type: 'SET_POSE', instanceId: 'm', position: [1, 0, 2], yawDeg: 30, tiltDeg: 0, mount: 'floor' }])
  })
  it('UNPLUG of two ports that are not cabled together is an error and changes nothing', () => {
    const s = store()
    s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
    s.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'q' })
    s.dispatch({ type: 'CONNECT', a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'q', port: 'in-mic-1' } })
    const r = s.dispatch({ type: 'UNPLUG', a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'q', port: 'in-mic-2' } })
    expect(r.ok).toBe(false)
    expect(s.design().rig.connections).toHaveLength(1)
  })
  it('a failed dispatch neither bumps the revision nor notifies', () => {
    const s = store(); let n = 0; s.subscribe(() => n++)
    const rev = s.revision
    s.dispatch({ type: 'REMOVE', instanceId: 'nobody' })
    expect(s.revision).toBe(rev)
    expect(n).toBe(0)
  })
  it('legacy-only intents are UNSUPPORTED', () => {
    const r = store().dispatch({ type: 'LOAD_RIG', name: 'x' })
    expect(!r.ok && r.error.code).toBe('UNSUPPORTED')
  })
  it('SPAWN applies initial controls and an unknown device is a result', () => {
    const s = store()
    expect(s.dispatch({ type: 'SPAWN', deviceId: 'no-such-device' }).ok).toBe(false)
    const q = s.newInstanceId('axia-iq')
    s.dispatch({ type: 'SPAWN', deviceId: 'axia-iq', instanceId: q })
    const [control, prev] = Object.entries(s.snapshot().instances[0].controls).find(([, v]) => typeof v === 'boolean')!
    s.dispatch({ type: 'SPAWN', deviceId: 'axia-iq', instanceId: 'q2', controls: { [control]: !prev } })
    expect(s.design().rig.controls.q2[control]).toBe(!prev)
    expect(s.dispatch({ type: 'SPAWN', deviceId: 'axia-iq', instanceId: 'q3', controls: { [control]: 'bad' } }).ok).toBe(false)
    expect(s.design().rig.instances.some((i) => i.instanceId === 'q3')).toBe(false)
    expect(s.newInstanceId('axia-iq')).not.toBe(q)
  })
  it('loads an initial design and skips unknown devices', () => {
    const r = makeRegistry()
    const s = new CreationStore(r, creationEvaluator(r), {
      roomId: 'r',
      rig: { instances: [{ instanceId: 'm', deviceId: 'shure-sm58' }, { instanceId: 'z', deviceId: 'gone' }], connections: [], controls: {} },
      placements: [{ instanceId: 'm', deviceId: 'shure-sm58', position_m: [1, 2, 3], yawDeg: 4 }],
    })
    expect(s.design().rig.instances.map((i) => i.instanceId)).toEqual(['m'])
    expect(s.design().placements[0].position_m).toEqual([1, 2, 3])
    expect(s.design().roomId).toBe('r')
  })
  it('APPLY_DESIGN with only unknown devices is UNKNOWN_DEVICE', () => {
    const s = store()
    const r = s.dispatch({ type: 'APPLY_DESIGN', design: { roomId: null, rig: { instances: [{ instanceId: 'z', deviceId: 'gone' }], connections: [], controls: {} }, placements: [] } })
    expect(!r.ok && r.error.code).toBe('UNKNOWN_DEVICE')
  })
})

describe('CreationStore review fixes (Task 4 Fix 1)', () => {
  /** A small rig with a pose, a non-default control and a cable. */
  const rigged = () => {
    const s = store()
    s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [1, 0, 2] })
    s.dispatch({ type: 'SPAWN', deviceId: 'axia-iq', instanceId: 'x', position: [3, 0, 0], rotationY: 90 })
    s.dispatch({ type: 'SET_CONTROL', instance: 'x', control: 'monitor-mute', value: true })
    const c = s.dispatch({ type: 'CONNECT', a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'x', port: 'in-mic-1' } })
    return { s, connectionId: c.ok ? c.connectionId! : '' }
  }
  const bad: [string, unknown][] = [
    ['missing rig', { roomId: null, placements: [] }],
    ['rig.instances not an array', { roomId: null, rig: { instances: 3, connections: [], controls: {} }, placements: [] }],
    ['missing placements', { roomId: null, rig: { instances: [], connections: [], controls: {} } }],
    ['null design', null],
    ['non-finite placement', { roomId: null, rig: { instances: [{ instanceId: 'm2', deviceId: 'shure-sm58' }], connections: [], controls: {} }, placements: [{ instanceId: 'm2', deviceId: 'shure-sm58', position_m: [NaN, 0, 0], yawDeg: 0 }] }],
    ['only unknown devices', { roomId: null, rig: { instances: [{ instanceId: 'z', deviceId: 'gone' }], connections: [], controls: {} }, placements: [] }],
  ]
  for (const [name, design] of bad)
    it(`a failed APPLY_DESIGN (${name}) never throws and leaves the previous design, ids and revision intact, without notifying`, () => {
      const { s, connectionId } = rigged()
      const before = s.design()
      const rev = s.revision
      let n = 0
      s.subscribe(() => n++)
      let r: ReturnType<typeof s.dispatch> | undefined
      expect(() => (r = s.dispatch({ type: 'APPLY_DESIGN', design: design as never }))).not.toThrow()
      expect(r!.ok).toBe(false)
      expect(s.design()).toEqual(before)
      expect(s.design().rig.controls.x['monitor-mute']).toBe(true)
      expect(s.connectionAt({ instance: 'm', port: 'out-xlr' })).toBe(connectionId)
      expect(s.revision).toBe(rev)
      expect(n).toBe(0)
    })
  it('APPLY_DESIGN reports dropped devices, cables and controls instead of dropping them silently', () => {
    const s = store()
    const r = s.dispatch({
      type: 'APPLY_DESIGN',
      design: {
        roomId: null,
        rig: {
          instances: [{ instanceId: 'm', deviceId: 'shure-sm58' }, { instanceId: 'x', deviceId: 'axia-iq' }, { instanceId: 'z', deviceId: 'gone' }],
          connections: [
            { a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'x', port: 'in-mic-1' } },
            { a: { instance: 'x', port: 'power-in' }, b: { instance: 'x', port: 'in-line-1' } },
            { a: { instance: 'z', port: 'out' }, b: { instance: 'x', port: 'in-line-1' } },
          ],
          controls: { x: { 'monitor-mute': true, 'no-such-control': true }, z: { k: true } },
        },
        placements: [],
      },
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.dropped?.devices).toEqual(['z'])
    expect(r.dropped?.cables.map((c) => [c.a.instance, c.a.port, c.b.instance, c.b.port])).toEqual([
      ['x', 'power-in', 'x', 'in-line-1'],
      ['z', 'out', 'x', 'in-line-1'],
    ])
    expect(r.dropped?.controls.map((c) => `${c.instance}.${c.control}`)).toEqual(['x.no-such-control', 'z.k'])
    expect(s.design().rig.connections).toHaveLength(1)
    expect(s.design().rig.controls.x['monitor-mute']).toBe(true)
  })
  it('a clean APPLY_DESIGN reports nothing dropped', () => {
    const s = store()
    const r = s.dispatch({ type: 'APPLY_DESIGN', design: { roomId: null, rig: { instances: [{ instanceId: 'm', deviceId: 'shure-sm58' }], connections: [], controls: {} }, placements: [] } })
    expect(r.ok && r.dropped).toEqual({ devices: [], cables: [], controls: [] })
  })
  it('an invalid initial design never throws: the store starts empty and says why', () => {
    const r = makeRegistry()
    let s: CreationStore | undefined
    expect(() => (s = new CreationStore(r, creationEvaluator(r), { roomId: null } as never))).not.toThrow()
    expect(s!.design().rig.instances).toEqual([])
    expect(s!.initialLoad.ok).toBe(false)
  })
  it('SET_POSE on a device without a placement: undo restores "no placement" exactly', () => {
    const r = makeRegistry()
    const s = new CreationStore(r, creationEvaluator(r), { roomId: null, rig: { instances: [{ instanceId: 'm', deviceId: 'shure-sm58' }], connections: [], controls: {} }, placements: [] })
    const before = s.design()
    const p = s.dispatch({ type: 'SET_POSE', instanceId: 'm', position: [1, 0, 1], yawDeg: 10, tiltDeg: 0, mount: 'floor' })
    expect(s.design().placements).toHaveLength(1)
    for (const i of p.ok ? p.inverse : []) expect(s.dispatch(i).ok).toBe(true)
    expect(s.design()).toEqual(before)
    expect(s.design().placements).toEqual([])
  })
  it('REMOVE of a device without a placement: undo brings it back still without a placement', () => {
    const r = makeRegistry()
    const s = new CreationStore(r, creationEvaluator(r), { roomId: null, rig: { instances: [{ instanceId: 'm', deviceId: 'shure-sm58' }], connections: [], controls: {} }, placements: [] })
    const before = s.design()
    const rm = s.dispatch({ type: 'REMOVE', instanceId: 'm' })
    for (const i of rm.ok ? rm.inverse : []) expect(s.dispatch(i).ok).toBe(true)
    expect(s.design()).toEqual(before)
  })
  it('a throwing subscriber does not stop the others, and dispatch still returns its result', () => {
    const s = store()
    const errors: unknown[] = []
    const orig = console.error
    console.error = (...a: unknown[]) => void errors.push(a)
    try {
      let n = 0
      s.subscribe(() => { throw new Error('boom') })
      s.subscribe(() => n++)
      const r = s.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
      expect(r.ok).toBe(true)
      expect(n).toBe(1)
      expect(errors).toHaveLength(1)
    } finally {
      console.error = orig
    }
  })
  it('events() is the R4–R8 evaluation after the last change (U 87 into an ISA One without +48 V → R4)', () => {
    const s = store()
    expect(s.events()).toEqual([])
    s.dispatch({ type: 'SPAWN', deviceId: 'neumann-u87-ai', instanceId: 'u' })
    s.dispatch({ type: 'SPAWN', deviceId: 'focusrite-isa-one', instanceId: 'p' })
    s.dispatch({ type: 'CONNECT', a: { instance: 'u', port: 'out-xlr' }, b: { instance: 'p', port: 'in-mic' } })
    expect(s.events().map((e) => e.ruleId)).toContain('R4')
    s.dispatch({ type: 'SET_CONTROL', instance: 'p', control: 'phantom-48v', value: true })
    expect(s.events().map((e) => e.ruleId)).not.toContain('R4')
  })
})
