/**
 * Mission 3 B, stage 1: routes are saved with the project (spec §3). `routes` is an optional field of the saved design: a project saved before it opens
 * exactly as it did; a stored route round-trips (autosave and named projects); a route whose cable no longer exists is dropped with it; a corrupt
 * `routes` value is dropped without breaking the project (and without a quarantine note). The dirty marker sees a route change. And the scene plan:
 * a route change redraws that cable only.
 */
import { describe, expect, it } from 'vitest'
import { designFingerprint, isDirty, loadAutosave, loadProject, parseDesign, readQuarantine, saveAutosave, saveProject, AUTOSAVE_KEY } from '../../src/creation/persistence'
import { cableKey, planSceneOps } from '../../src/creation/sceneDiff'
import type { DesignState } from '../../src/trials/trial'

class MemStorage implements Storage {
  map = new Map<string, string>()
  get length(): number {
    return this.map.size
  }
  clear(): void {
    this.map.clear()
  }
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v))
  }
}

const MIC = { instance: 'shure-sm58-1', port: 'out-xlr' }
const DESK = { instance: 'yamaha-ql1-1', port: 'in-mic-1' }
const KEY = cableKey(MIC, DESK)

const design = (): DesignState => ({
  roomId: 'room:concert-hall-medium',
  rig: {
    instances: [
      { instanceId: 'shure-sm58-1', deviceId: 'shure-sm58' },
      { instanceId: 'yamaha-ql1-1', deviceId: 'yamaha-ql1' },
    ],
    connections: [{ a: MIC, b: DESK }],
    controls: { 'yamaha-ql1-1': { 'phantom-1': false } },
  },
  placements: [
    { instanceId: 'shure-sm58-1', deviceId: 'shure-sm58', position_m: [1, 0, 2], yawDeg: 90 },
    { instanceId: 'yamaha-ql1-1', deviceId: 'yamaha-ql1', position_m: [3, 0, -1], yawDeg: 0 },
  ],
})
const routed = (): DesignState => ({ ...design(), routes: { [KEY]: [[1.25, 0.5], [2.75, 0.5]] } })
const autosave = (d: DesignState) => ({ version: 1 as const, savedAt: '2026-11-15T10:00:00.000Z', name: 'Concert', design: d, savedFingerprint: null })

describe('routes in the saved design', () => {
  it('a project saved before routes opens exactly as before (no routes field appears)', () => {
    const old = design()
    expect(parseDesign(JSON.parse(JSON.stringify(old)))).toEqual(old)
    expect(JSON.stringify(parseDesign(JSON.parse(JSON.stringify(old))))).toBe(JSON.stringify(old))
    const s = new MemStorage()
    s.setItem(AUTOSAVE_KEY, JSON.stringify(autosave(old)))
    const r = loadAutosave(s)
    expect(r.status).toBe('ok')
    if (r.status === 'ok') expect(JSON.stringify(r.data.design)).toBe(JSON.stringify(old))
  })

  it('a stored route round-trips through the autosave and a named project', () => {
    const s = new MemStorage()
    expect(saveAutosave(s, autosave(routed()))).toBe('ok')
    const r = loadAutosave(s)
    expect(r.status === 'ok' && r.data.design.routes).toEqual({ [KEY]: [[1.25, 0.5], [2.75, 0.5]] })
    expect(saveProject(s, 'Concert', routed())).toBe('ok')
    expect(loadProject(s, 'Concert')).toEqual(routed())
  })

  it('a route whose cable is not in the design is dropped with it; an empty route is no route', () => {
    const d = { ...design(), routes: { [KEY]: [[1, 1]], 'ghost a|ghost b': [[0, 0]], [cableKey(DESK, { instance: 'shure-sm58-1', port: 'x' })]: [] } }
    expect(parseDesign(d)?.routes).toEqual({ [KEY]: [[1, 1]] })
    const none = { ...design(), routes: { 'ghost a|ghost b': [[0, 0]] } }
    expect('routes' in parseDesign(none)!).toBe(false)
  })

  it('a corrupt routes value is dropped without breaking the project, and nothing is quarantined for it', () => {
    for (const bad of ['x', 42, null, [[0, 0]], { [KEY]: 'x' }, { [KEY]: [[0, Number.NaN]] }, { [KEY]: [[0, 0, 0]] }, { [KEY]: [['0', 0]] }]) {
      const s = new MemStorage()
      s.setItem(AUTOSAVE_KEY, JSON.stringify(autosave({ ...design(), routes: bad } as unknown as DesignState))) // NaN is stored as null: corrupt too
      const r = loadAutosave(s)
      expect(r.status, JSON.stringify(bad)).toBe('ok')
      if (r.status === 'ok') {
        expect(r.data.design.rig.connections).toHaveLength(1)
        expect(r.data.design.routes).toBeUndefined()
      }
      expect(readQuarantine(s)).toEqual([])
    }
  })

  it('one bad route among good ones: only the bad one goes', () => {
    const other = { a: { instance: 'yamaha-ql1-1', port: 'out-main-l' }, b: { instance: 'shure-sm58-1', port: 'out-xlr' } }
    const d = { ...design(), rig: { ...design().rig, connections: [...design().rig.connections, other] }, routes: { [KEY]: [[1, 1]], [cableKey(other.a, other.b)]: 'bad' } }
    expect(parseDesign(d)?.routes).toEqual({ [KEY]: [[1, 1]] })
  })

  it('the dirty marker sees a route change', () => {
    const fp = designFingerprint(routed())
    expect(isDirty(routed(), fp)).toBe(false)
    expect(isDirty({ ...routed(), routes: { [KEY]: [[1.25, 0.5]] } }, fp)).toBe(true)
    expect(isDirty(design(), fp)).toBe(true)
    expect(designFingerprint(design())).not.toBe(fp)
  })
})

describe('planSceneOps: a route change redraws that cable only', () => {
  const two = (): DesignState => {
    const d = design()
    const out = { a: { instance: 'yamaha-ql1-1', port: 'out-main-l' }, b: { instance: 'k', port: 'in-line-a' } }
    return {
      ...d,
      rig: { ...d.rig, instances: [...d.rig.instances, { instanceId: 'k', deviceId: 'qsc-k12-2' }], connections: [...d.rig.connections, out] },
    }
  }
  const empty = { spawn: [], remove: [], move: [], cablesAdd: [], cablesRemove: [], reloadPlace: false }

  it('a new, changed or cleared route: that cable is drawn again (cablesAdd), nothing else', () => {
    const route = { ...two(), routes: { [KEY]: [[1, 1]] as [number, number][] } }
    const cable = { key: KEY, a: MIC, b: DESK }
    expect(planSceneOps(two(), route)).toEqual({ ...empty, cablesAdd: [cable] })
    expect(planSceneOps(route, { ...two(), routes: { [KEY]: [[1, 1], [2, 1]] } })).toEqual({ ...empty, cablesAdd: [cable] })
    expect(planSceneOps(route, two())).toEqual({ ...empty, cablesAdd: [cable] })
    expect(planSceneOps(route, { ...two(), routes: {} })).toEqual({ ...empty, cablesAdd: [cable] })
  })

  it('the same route (or none on both sides, or an empty one) is no change', () => {
    const route = { ...two(), routes: { [KEY]: [[1, 1]] as [number, number][] } }
    expect(planSceneOps(route, structuredClone(route))).toEqual(empty)
    expect(planSceneOps(two(), { ...two(), routes: {} })).toEqual(empty)
    expect(planSceneOps(two(), { ...two(), routes: { [KEY]: [] } })).toEqual(empty)
  })

  it('a removed cable with a route is removed, not redrawn', () => {
    const route = { ...two(), routes: { [KEY]: [[1, 1]] as [number, number][] } }
    const gone = { ...two(), rig: { ...two().rig, connections: two().rig.connections.slice(1) } }
    expect(planSceneOps(route, gone)).toEqual({ ...empty, cablesRemove: [KEY] })
  })
})
