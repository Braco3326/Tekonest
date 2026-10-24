import { describe, expect, it } from 'vitest'
import { cableKey, planSceneOps } from '../../src/creation/sceneDiff'
import type { DesignState } from '../../src/trials/trial'

const base = (): DesignState => ({
  roomId: 'room:concert-hall-medium',
  rig: {
    instances: [
      { instanceId: 'ql1', deviceId: 'yamaha-ql1' },
      { instanceId: 'k12-g', deviceId: 'qsc-k12-2' },
      { instanceId: 'k12-d', deviceId: 'qsc-k12-2' },
    ],
    connections: [
      { a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } },
      { a: { instance: 'ql1', port: 'out-main-r' }, b: { instance: 'k12-d', port: 'in-line-a' } },
    ],
    controls: {},
  },
  placements: [
    { instanceId: 'ql1', deviceId: 'yamaha-ql1', position_m: [0, 0, 8], yawDeg: 180 },
    { instanceId: 'k12-g', deviceId: 'qsc-k12-2', position_m: [3, 0, -4], yawDeg: 0 },
    { instanceId: 'k12-d', deviceId: 'qsc-k12-2', position_m: [-3, 0, -4], yawDeg: 0, mount: 'stand', tiltDeg: 5 },
  ],
})

const empty = { spawn: [], remove: [], move: [], cablesAdd: [], cablesRemove: [], reloadPlace: false }

describe('cableKey', () => {
  it('is direction-free', () => {
    const a = { instance: 'ql1', port: 'out-main-l' }
    const b = { instance: 'k12-g', port: 'in-line-a' }
    expect(cableKey(a, b)).toBe('k12-g in-line-a|ql1 out-main-l')
    expect(cableKey(b, a)).toBe(cableKey(a, b))
  })
  it('different port pairs give different keys', () => {
    expect(cableKey({ instance: 'a', port: 'x' }, { instance: 'b', port: 'y' })).not.toBe(
      cableKey({ instance: 'a', port: 'y' }, { instance: 'b', port: 'x' }),
    )
  })
})

describe('planSceneOps (P15: the scene reconciler)', () => {
  it('from nothing: spawns everything (with its pose) and adds every cable', () => {
    const d = base()
    const ops = planSceneOps(null, d)
    expect(ops.spawn.map((p) => p.instanceId).sort()).toEqual(['k12-d', 'k12-g', 'ql1'])
    expect(ops.spawn.find((p) => p.instanceId === 'k12-d')).toEqual(d.placements[2])
    expect(ops.cablesAdd.map((c) => c.key).sort()).toEqual(['k12-d in-line-a|ql1 out-main-r', 'k12-g in-line-a|ql1 out-main-l'])
    expect(ops.cablesAdd[0].a).toEqual(d.rig.connections[0].a)
    expect(ops.remove).toEqual([])
    expect(ops.move).toEqual([])
    expect(ops.cablesRemove).toEqual([])
    expect(ops.reloadPlace).toBe(false)
  })
  it('an instance without a placement spawns at the origin, yaw 0', () => {
    const d = base()
    d.placements = d.placements.filter((p) => p.instanceId !== 'ql1')
    const ql1 = planSceneOps(null, d).spawn.find((p) => p.instanceId === 'ql1')
    expect(ql1).toEqual({ instanceId: 'ql1', deviceId: 'yamaha-ql1', position_m: [0, 0, 0], yawDeg: 0 })
  })
  it('the same design: every op is empty', () => {
    expect(planSceneOps(base(), base())).toEqual(empty)
  })
  it('float noise below the fingerprint quantum is no change; yaw 360 ≡ 0', () => {
    const n = base()
    n.placements[0].position_m = [0.0000001, 0, 8.0002]
    n.placements[1].yawDeg = 360
    n.placements[2].tiltDeg = 5.01
    expect(planSceneOps(base(), n)).toEqual(empty)
  })
  it('a moved instance → move only', () => {
    const n = base()
    n.placements[1].position_m = [3.5, 0, -4]
    const ops = planSceneOps(base(), n)
    expect(ops).toEqual({ ...empty, move: [n.placements[1]] })
  })
  it('a yaw, tilt or mount change is a move', () => {
    for (const edit of [
      (d: DesignState) => (d.placements[0].yawDeg = 90),
      (d: DesignState) => (d.placements[2].tiltDeg = 0),
      (d: DesignState) => (d.placements[2].mount = 'flown'),
    ]) {
      const n = base()
      edit(n)
      expect(planSceneOps(base(), n).move).toHaveLength(1)
    }
  })
  it('a removed instance → remove + its cables in cablesRemove', () => {
    const n = base()
    n.rig.instances = n.rig.instances.filter((i) => i.instanceId !== 'k12-g')
    n.rig.connections = n.rig.connections.filter((c) => c.b.instance !== 'k12-g')
    n.placements = n.placements.filter((p) => p.instanceId !== 'k12-g')
    expect(planSceneOps(base(), n)).toEqual({ ...empty, remove: ['k12-g'], cablesRemove: ['k12-g in-line-a|ql1 out-main-l'] })
  })
  it('one grouped change (undo of a REMOVE = SPAWN + pose + cable) is planned in one go', () => {
    const before = base()
    before.rig.instances = before.rig.instances.filter((i) => i.instanceId !== 'k12-g')
    before.rig.connections = before.rig.connections.filter((c) => c.b.instance !== 'k12-g')
    before.placements = before.placements.filter((p) => p.instanceId !== 'k12-g')
    const ops = planSceneOps(before, base())
    expect(ops.spawn).toEqual([base().placements[1]])
    expect(ops.cablesAdd.map((c) => c.key)).toEqual(['k12-g in-line-a|ql1 out-main-l'])
    expect(ops.remove).toEqual([])
    expect(ops.move).toEqual([])
  })
  it('a cable whose ends swap is not a change', () => {
    const n = base()
    const c = n.rig.connections[0]
    n.rig.connections[0] = { a: c.b, b: c.a }
    expect(planSceneOps(base(), n)).toEqual(empty)
  })
  it('a re-patched cable → one removed key, one added key', () => {
    const n = base()
    n.rig.connections[0] = { a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-b' } }
    const ops = planSceneOps(base(), n)
    expect(ops.cablesRemove).toEqual(['k12-g in-line-a|ql1 out-main-l'])
    expect(ops.cablesAdd.map((x) => x.key)).toEqual(['k12-g in-line-b|ql1 out-main-l'])
  })
  it('the same instance id with another device → remove then spawn', () => {
    const n = base()
    n.rig.instances[1] = { instanceId: 'k12-g', deviceId: 'yamaha-dbr12' }
    n.placements[1] = { ...n.placements[1], deviceId: 'yamaha-dbr12' }
    const ops = planSceneOps(base(), n)
    expect(ops.remove).toEqual(['k12-g'])
    expect(ops.spawn.map((p) => p.deviceId)).toEqual(['yamaha-dbr12'])
    expect(ops.move).toEqual([])
  })
  it('a roomId change → reloadPlace', () => {
    const n = base()
    n.roomId = 'blank'
    expect(planSceneOps(base(), n).reloadPlace).toBe(true)
    expect(planSceneOps(base(), { ...base(), roomId: null }).reloadPlace).toBe(true)
  })
})
