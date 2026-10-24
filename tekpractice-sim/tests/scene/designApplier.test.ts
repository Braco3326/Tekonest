import { describe, expect, it } from 'vitest'
import { captureDesignFrom, isFinitePlacement, rigToDesign, sanitizePlacements } from '../../src/scene/designApplier'
import type { DesignState, Placement } from '../../src/trials/trial'
import type { RigSnapshot } from '../../src/engine/types'

const P = (over: Partial<Placement> = {}): Placement => ({ instanceId: 'm', deviceId: 'shure-sm58', position_m: [1, 2, 3], yawDeg: 45, ...over })

describe('isFinitePlacement', () => {
  it('accepts a placement of finite numbers (optional tilt/mount allowed)', () => {
    expect(isFinitePlacement(P())).toBe(true)
    expect(isFinitePlacement(P({ tiltDeg: -5, mount: 'stand' }))).toBe(true)
  })
  it('rejects NaN, Infinity, short arrays and non-objects', () => {
    expect(isFinitePlacement(P({ position_m: [NaN, 0, 0] }))).toBe(false)
    expect(isFinitePlacement(P({ position_m: [0, Infinity, 0] }))).toBe(false)
    expect(isFinitePlacement(P({ yawDeg: -Infinity }))).toBe(false)
    expect(isFinitePlacement({ ...P(), position_m: [0, 0] })).toBe(false)
    expect(isFinitePlacement(null)).toBe(false)
    expect(isFinitePlacement(undefined)).toBe(false)
    expect(isFinitePlacement({ instanceId: 'm' })).toBe(false)
  })
})

describe('sanitizePlacements', () => {
  const design = (placements: Placement[]): DesignState => ({ roomId: null, rig: { instances: [], connections: [], controls: {} }, placements })
  it('keeps finite placements, drops the others', () => {
    const out = sanitizePlacements(design([P(), P({ instanceId: 'x', position_m: [NaN, 0, 0] })]))
    expect(out.map((p) => p.instanceId)).toEqual(['m'])
  })
  it('the last placement of an instance wins, as the legacy Map did (an invalid last one drops it)', () => {
    expect(sanitizePlacements(design([P(), P({ position_m: [NaN, 0, 0] })]))).toEqual([])
    expect(sanitizePlacements(design([P({ yawDeg: 1 }), P({ yawDeg: 2 })]))[0].yawDeg).toBe(2)
  })
})

describe('rigToDesign (the legacy loadRigByName conversion)', () => {
  it('4 finite numbers → placement; anything else is dropped', () => {
    const d = rigToDesign({
      roomId: 'hall',
      instances: [{ instanceId: 'a', deviceId: 'shure-sm58' }, { instanceId: 'b', deviceId: 'shure-sm58' }, { instanceId: 'c', deviceId: 'shure-sm58' }, { instanceId: 'd', deviceId: 'shure-sm58' }],
      connections: [{ a: { instance: 'a', port: 'x' }, b: { instance: 'b', port: 'y' } }],
      controls: { a: { k: true } },
      positions: { a: [1, 2, 3, 90], b: [1, 2, NaN, 0], c: [1, 2, 3] },
    })
    expect(d.roomId).toBe('hall')
    expect(d.rig.instances).toHaveLength(4)
    expect(d.rig.connections).toHaveLength(1)
    expect(d.rig.controls).toEqual({ a: { k: true } })
    expect(d.placements).toEqual([{ instanceId: 'a', deviceId: 'shure-sm58', position_m: [1, 2, 3], yawDeg: 90 }])
  })
  it('a missing roomId or positions gives null and no placements', () => {
    const d = rigToDesign({ instances: [{ instanceId: 'a', deviceId: 'x' }], connections: [], controls: {} })
    expect(d.roomId).toBeNull()
    expect(d.placements).toEqual([])
  })
})

describe('captureDesignFrom', () => {
  const snap: RigSnapshot = {
    instances: [
      { instanceId: 'm', deviceId: 'shure-sm58', ports: [], controls: {} },
      { instanceId: 'q', deviceId: 'yamaha-ql1', ports: [], controls: { phantom: false } },
    ],
    connections: [{ a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'q', port: 'in-mic-1' } }],
  }
  it('maps snapshot + placements to a DesignState; controls are copies', () => {
    const placements = new Map([['q', P({ instanceId: 'q', deviceId: 'yamaha-ql1', tiltDeg: 3, mount: 'floor' })], ['gone', P({ instanceId: 'gone' })]])
    const d = captureDesignFrom(snap, placements, 'hall')
    expect(d.roomId).toBe('hall')
    expect(d.rig.instances).toEqual([{ instanceId: 'm', deviceId: 'shure-sm58' }, { instanceId: 'q', deviceId: 'yamaha-ql1' }])
    expect(d.rig.connections).toEqual(snap.connections)
    expect(d.rig.controls).toEqual({ m: {}, q: { phantom: false } })
    expect(d.rig.controls.q).not.toBe(snap.instances[1].controls)
    // only instances still in the graph keep a placement
    expect(d.placements).toEqual([{ instanceId: 'q', deviceId: 'yamaha-ql1', position_m: [1, 2, 3], yawDeg: 45, tiltDeg: 3, mount: 'floor' }])
  })
})
