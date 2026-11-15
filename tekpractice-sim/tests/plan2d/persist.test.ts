import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLAN2D_KEY_PREFIX, loadPlan, parsePlan, planKey, savePlan } from '../../src/plan2d/persist'
import { applyIntent, emptyPlan, type Plan2D } from '../../src/plan2d/model'

/** A Storage in memory; `fail` makes every call throw (a blocked or full storage). */
function memory(fail: Partial<Record<'get' | 'set' | 'remove', boolean>> = {}): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem(k: string) {
      if (fail.get) throw new Error('blocked')
      return data.has(k) ? data.get(k)! : null
    },
    setItem(k: string, v: string) {
      if (fail.set) throw new Error('QuotaExceededError')
      data.set(k, v)
    },
    removeItem(k: string) {
      if (fail.remove) throw new Error('blocked')
      data.delete(k)
    },
  }
}

const sample = (): Plan2D => {
  let p = emptyPlan('room:concert-hall-medium')
  for (const deviceId of ['qsc-k12-2', 'midas-m32']) {
    const r = applyIntent(p, { type: 'place', deviceId, x: 1.25, z: -0.5, rot: 90 })
    if (r.ok) p = r.plan
  }
  const c = applyIntent(p, { type: 'connect', a: { dev: 'midas-m32-1', port: 'out-1' }, b: { dev: 'qsc-k12-2-1', port: 'in-line-a' }, cableType: 'analog-bal' })
  return c.ok ? c.plan : p
}

describe('plan persistence: its own key per project and place', () => {
  it('the key is audio-sim/plan2d.v1.<project>@<place>, both parts encoded; an untitled project has an empty name part', () => {
    expect(PLAN2D_KEY_PREFIX).toBe('audio-sim/plan2d.v1.')
    expect(planKey('Concert du 12', 'room:concert-hall-medium')).toBe('audio-sim/plan2d.v1.Concert%20du%2012@room%3Aconcert-hall-medium')
    expect(planKey(null, 'blank')).toBe('audio-sim/plan2d.v1.@blank')
    expect(planKey('a@b', 'blank')).not.toBe(planKey('a', 'b@blank'))
  })

  it('round trip: what is saved is read back equal', () => {
    const s = memory()
    const key = planKey('P', 'blank')
    expect(savePlan(s, key, sample())).toBe(true)
    expect(loadPlan(s, key)).toEqual({ plan: sample(), dropped: false })
    expect(loadPlan(s, planKey('Q', 'blank'))).toEqual({ plan: null, dropped: false })
  })

  it('a corrupt, foreign-version or wrong-shape record is dropped (removed, said), never thrown', () => {
    const key = planKey(null, 'blank')
    for (const raw of ['{not json', JSON.stringify({ ...sample(), v: 2 }), JSON.stringify({ v: 1, roomId: 3, devices: [], cables: [] }), JSON.stringify({ ...sample(), devices: [{ id: 'a', deviceId: 'b', x: 'x', z: 0, rot: 0 }] }), 'null']) {
      const s = memory()
      s.data.set(key, raw)
      expect(loadPlan(s, key), raw).toEqual({ plan: null, dropped: true })
      expect(s.data.has(key), raw).toBe(false)
    }
  })

  it('a cable whose end names no device of the plan, or two devices with one id, make the record unusable', () => {
    const p = sample()
    expect(parsePlan({ ...p, cables: [{ id: 'c1', a: { dev: 'nope', port: 'x' }, b: { dev: 'midas-m32-1', port: 'y' } }] })).toBeNull()
    expect(parsePlan({ ...p, devices: [p.devices[0], p.devices[0]] })).toBeNull()
    expect(parsePlan(p)).toEqual(p)
  })

  it('every storage call is guarded: a blocked or full storage, or none at all, never throws', () => {
    const key = planKey(null, 'blank')
    expect(loadPlan(memory({ get: true }), key)).toEqual({ plan: null, dropped: false })
    expect(savePlan(memory({ set: true }), key, sample())).toBe(false)
    const s = memory({ remove: true })
    s.data.set(key, '{bad')
    expect(loadPlan(s, key)).toEqual({ plan: null, dropped: true })
    expect(loadPlan(null, key)).toEqual({ plan: null, dropped: false })
    expect(savePlan(null, key, sample())).toBe(false)
  })

  it('the plan is not in the 3D design: store.ts and the autosave know nothing of it', () => {
    const root = join(__dirname, '..', '..')
    for (const f of ['src/creation/store.ts', 'src/creation/persistence.ts', 'src/trials/trial.ts']) expect(readFileSync(join(root, f), 'utf8'), f).not.toMatch(/plan2d/i)
  })
})
