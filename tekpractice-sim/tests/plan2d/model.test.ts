import { describe, expect, it } from 'vitest'
import { applyIntent, cableAt, emptyPlan, normRot, selectToggle, type Plan2D, type PlanIntent } from '../../src/plan2d/model'

const ok = (plan: Plan2D, intent: PlanIntent): { plan: Plan2D; created: string[] } => {
  const r = applyIntent(plan, intent)
  if (!r.ok) throw new Error(`${r.code}: ${r.message}`)
  return r
}

describe('plan model: data shape', () => {
  it('an empty plan is version 1 with the room id and nothing on it', () => {
    expect(emptyPlan('blank')).toEqual({ v: 1, roomId: 'blank', devices: [], cables: [] })
  })
})

describe('plan model: place, move, rotate, remove, duplicate', () => {
  it('place gives a stable id <deviceId>-<n> that only grows, never reuses a removed one', () => {
    let p = emptyPlan('blank')
    p = ok(p, { type: 'place', deviceId: 'qsc-k12-2', x: 1, z: 2 }).plan
    p = ok(p, { type: 'place', deviceId: 'qsc-k12-2', x: 3, z: 2, rot: 90 }).plan
    expect(p.devices.map((d) => d.id)).toEqual(['qsc-k12-2-1', 'qsc-k12-2-2'])
    expect(p.devices[1]).toEqual({ id: 'qsc-k12-2-2', deviceId: 'qsc-k12-2', x: 3, z: 2, rot: 90 })
    p = ok(p, { type: 'remove', ids: ['qsc-k12-2-2'] }).plan
    const r = ok(p, { type: 'place', deviceId: 'qsc-k12-2', x: 0, z: 0 })
    expect(r.created).toEqual(['qsc-k12-2-2'])
    // the highest number in use + 1: an id in the plan is never handed out twice
    const q = ok(ok(r.plan, { type: 'remove', ids: ['qsc-k12-2-1'] }).plan, { type: 'place', deviceId: 'qsc-k12-2', x: 0, z: 0 })
    expect(q.created).toEqual(['qsc-k12-2-3'])
  })

  it('never mutates the plan it is given (plans are immutable values)', () => {
    const p = ok(emptyPlan('blank'), { type: 'place', deviceId: 'a', x: 0, z: 0 }).plan
    const frozen = JSON.stringify(p)
    ok(p, { type: 'move', ids: ['a-1'], dx: 1, dz: 1 })
    ok(p, { type: 'remove', ids: ['a-1'] })
    expect(JSON.stringify(p)).toBe(frozen)
  })

  it('move shifts every listed device; positions are rounded to 0.1 mm (no float noise)', () => {
    let p = ok(emptyPlan('blank'), { type: 'place', deviceId: 'a', x: 0.1, z: 0.2 }).plan
    p = ok(p, { type: 'place', deviceId: 'b', x: 1, z: 1 }).plan
    p = ok(p, { type: 'move', ids: ['a-1', 'b-1'], dx: 0.2, dz: -0.1 }).plan
    expect(p.devices.map((d) => [d.x, d.z])).toEqual([[0.3, 0.1], [1.2, 0.9]])
  })

  it('rotate adds degrees, kept in [0, 360)', () => {
    expect(normRot(-90)).toBe(270)
    expect(normRot(450)).toBe(90)
    expect(normRot(360)).toBe(0)
    let p = ok(emptyPlan('blank'), { type: 'place', deviceId: 'a', x: 0, z: 0, rot: 270 }).plan
    p = ok(p, { type: 'rotate', ids: ['a-1'], by: 90 }).plan
    expect(p.devices[0]!.rot).toBe(0)
    p = ok(p, { type: 'rotate', ids: ['a-1'], by: -15 }).plan
    expect(p.devices[0]!.rot).toBe(345)
  })

  it('setPose places one device exactly', () => {
    const p = ok(ok(emptyPlan('blank'), { type: 'place', deviceId: 'a', x: 0, z: 0 }).plan, { type: 'setPose', id: 'a-1', x: 2.5, z: -1, rot: 180 }).plan
    expect(p.devices[0]).toMatchObject({ x: 2.5, z: -1, rot: 180 })
  })

  it('remove takes the device AND every cable on it', () => {
    let p = ok(emptyPlan('blank'), { type: 'place', deviceId: 'a', x: 0, z: 0 }).plan
    p = ok(p, { type: 'place', deviceId: 'b', x: 1, z: 0 }).plan
    p = ok(p, { type: 'place', deviceId: 'c', x: 2, z: 0 }).plan
    p = ok(p, { type: 'connect', a: { dev: 'a-1', port: 'out' }, b: { dev: 'b-1', port: 'in' } }).plan
    p = ok(p, { type: 'connect', a: { dev: 'b-1', port: 'out' }, b: { dev: 'c-1', port: 'in' } }).plan
    p = ok(p, { type: 'remove', ids: ['a-1'] }).plan
    expect(p.devices.map((d) => d.id)).toEqual(['b-1', 'c-1'])
    expect(p.cables.map((c) => c.id)).toEqual(['c2'])
  })

  it('duplicate copies the listed devices at an offset with new ids (cables are not copied)', () => {
    let p = ok(emptyPlan('blank'), { type: 'place', deviceId: 'a', x: 0, z: 0, rot: 90 }).plan
    p = ok(p, { type: 'place', deviceId: 'b', x: 1, z: 0 }).plan
    p = ok(p, { type: 'connect', a: { dev: 'a-1', port: 'out' }, b: { dev: 'b-1', port: 'in' } }).plan
    const r = ok(p, { type: 'duplicate', ids: ['a-1', 'b-1'], dx: 0.5, dz: 0.5 })
    expect(r.created).toEqual(['a-2', 'b-2'])
    expect(r.plan.devices.find((d) => d.id === 'a-2')).toEqual({ id: 'a-2', deviceId: 'a', x: 0.5, z: 0.5, rot: 90 })
    expect(r.plan.cables).toHaveLength(1)
  })

  it('refuses unknown ids, non-finite numbers and empty lists, and changes nothing', () => {
    const p = ok(emptyPlan('blank'), { type: 'place', deviceId: 'a', x: 0, z: 0 }).plan
    for (const intent of [
      { type: 'move', ids: ['nope'], dx: 1, dz: 0 },
      { type: 'remove', ids: [] },
      { type: 'place', deviceId: 'a', x: Number.NaN, z: 0 },
      { type: 'setPose', id: 'a-1', x: Infinity, z: 0 },
      { type: 'rotate', ids: ['a-1'], by: Number.NaN },
      { type: 'disconnect', ids: ['c9'] },
      { type: 'place', deviceId: '', x: 0, z: 0 },
    ] as PlanIntent[]) {
      const r = applyIntent(p, intent)
      expect(r.ok, JSON.stringify(intent)).toBe(false)
    }
  })
})

describe('plan model: connect and disconnect', () => {
  const two = (): Plan2D => ok(ok(emptyPlan('blank'), { type: 'place', deviceId: 'a', x: 0, z: 0 }).plan, { type: 'place', deviceId: 'b', x: 1, z: 0 }).plan

  it('a cable joins two ports; ids are c<n> above every cable present (the same rule as the device ids); the derived type is kept when given', () => {
    let p = ok(two(), { type: 'connect', a: { dev: 'a-1', port: 'out' }, b: { dev: 'b-1', port: 'in' }, cableType: 'analog-bal' }).plan
    expect(p.cables).toEqual([{ id: 'c1', a: { dev: 'a-1', port: 'out' }, b: { dev: 'b-1', port: 'in' }, type: 'analog-bal' }])
    expect(cableAt(p, { dev: 'b-1', port: 'in' })?.id).toBe('c1')
    expect(cableAt(p, { dev: 'b-1', port: 'out' })).toBeUndefined()
    p = ok(p, { type: 'connect', a: { dev: 'a-1', port: 'x' }, b: { dev: 'b-1', port: 'y' } }).plan
    expect(p.cables.map((c) => c.id)).toEqual(['c1', 'c2'])
    p = ok(p, { type: 'disconnect', ids: ['c1'] }).plan
    p = ok(p, { type: 'connect', a: { dev: 'a-1', port: 'out' }, b: { dev: 'b-1', port: 'in' } }).plan
    expect(p.cables.map((c) => c.id)).toEqual(['c2', 'c3'])
  })

  it('refuses a port already cabled, the same port twice, and an unknown device (the rules of the catalogue are patchRules’, not the model’s)', () => {
    const p = ok(two(), { type: 'connect', a: { dev: 'a-1', port: 'out' }, b: { dev: 'b-1', port: 'in' } }).plan
    expect(applyIntent(p, { type: 'connect', a: { dev: 'a-1', port: 'out' }, b: { dev: 'b-1', port: 'x' } })).toMatchObject({ ok: false, code: 'PORT_TAKEN' })
    expect(applyIntent(p, { type: 'connect', a: { dev: 'a-1', port: 'y' }, b: { dev: 'a-1', port: 'y' } })).toMatchObject({ ok: false, code: 'SAME_PORT' })
    expect(applyIntent(p, { type: 'connect', a: { dev: 'zz-1', port: 'y' }, b: { dev: 'a-1', port: 'z' } })).toMatchObject({ ok: false, code: 'UNKNOWN_DEVICE' })
  })
})

describe('selection helper', () => {
  it('a plain pick replaces the selection; an additive one toggles the id', () => {
    expect(selectToggle(['a'], 'b', false)).toEqual(['b'])
    expect(selectToggle(['a'], 'b', true)).toEqual(['a', 'b'])
    expect(selectToggle(['a', 'b'], 'a', true)).toEqual(['b'])
  })
})
