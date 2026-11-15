// @vitest-environment jsdom
/**
 * « Envoyer dans la scène 3D » (mission 2, stage 2; spec §1 item 6, §2 `spawn3d.ts`, §5): the 2D plan becomes 3D gear through the store's existing
 * intents (SPAWN, CONNECT; APPLY_DESIGN for the replace path) inside ONE history entry, against a real CreationStore and History (the 3D page's own):
 *  - every device at the SAME metres (x, z; y = the floor there, as a drop), the same yaw, floor-mounted; the plan's cables become the connections,
 *    port ids as the catalogue has them; reading the store back gives the plan to the millimetre, and the 3D front axis is the plan's;
 *  - one undo removes everything, a redo restores it; the 3D gear already there is never moved or replaced;
 *  - a device outside the room (the drop's own rule: `clampToRoom` with no margin) or on top of another device (3D gear or an earlier plan device) is
 *    REPORTED and not created, with the cables that needed it; a cable the connection rules refuse is reported with the rule's own title and text;
 *  - nothing to add = nothing dispatched.
 */
import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { History } from '../../src/creation/history'
import type { DesignState } from '../../src/trials/trial'
import { applyIntent, emptyPlan, type Plan2D, type PlanIntent } from '../../src/plan2d/model'
import { createPatchRules } from '../../src/plan2d/patchRules'
import { localToWorld } from '../../src/plan2d/geometry'
import { footprintOf } from '../../src/plan2d/symbols'
import { planSpawn, spawnInto, type SpawnTarget } from '../../src/plan2d/spawn3d'

const registry = loadCatalog(catalogJson)
const SM58_OUT = registry.deviceById.get('shure-sm58')!.ports[0]!.portId

const step = (p: Plan2D, i: PlanIntent): Plan2D => {
  const r = applyIntent(p, i)
  if (!r.ok) throw new Error(r.message)
  return r.plan
}
const build = (...intents: PlanIntent[]): Plan2D => intents.reduce(step, emptyPlan('blank'))

/** The 3D page's own pieces: a CreationStore, its History, and the closures the boot hands the page (never the store itself). */
export function scene(initial?: DesignState, floorAt: (x: number, z: number) => number = () => 0) {
  const store = new CreationStore(registry, creationEvaluator(registry), initial)
  const history = new History(store)
  const shown: string[] = []
  const target: SpawnTarget = {
    design: () => store.design(),
    roomBounds: () => ({ minX: -12, maxX: 12, minZ: -7, maxZ: 7 }),
    floorAt,
    apply: (intents, label) => history.doAll(intents, label),
    replace: (design, label) => history.do({ type: 'APPLY_DESIGN', design }, label).ok,
    undoLabel: () => 'Ctrl+Z',
    show: (ids) => void shown.push(...ids),
  }
  return { store, history, target, shown }
}

const withGear = (): DesignState => ({
  roomId: 'blank',
  rig: { instances: [{ instanceId: 'qsc-k12-2-1', deviceId: 'qsc-k12-2' }, { instanceId: 'midas-m32-1', deviceId: 'midas-m32' }], connections: [{ a: { instance: 'midas-m32-1', port: 'out-main-l' }, b: { instance: 'qsc-k12-2-1', port: 'in-line-a' } }], controls: {} },
  placements: [
    { instanceId: 'qsc-k12-2-1', deviceId: 'qsc-k12-2', position_m: [5, 0, 5], yawDeg: 30 },
    { instanceId: 'midas-m32-1', deviceId: 'midas-m32', position_m: [-6, 0, -4], yawDeg: 180 },
  ],
})

/** A console, a speaker turned 90° and a microphone at 15°, at awkward metres; console main left into the speaker. */
const bench = (): Plan2D =>
  build(
    { type: 'place', deviceId: 'midas-m32', x: 1.25, z: -2.5 },
    { type: 'place', deviceId: 'qsc-k12-2', x: -3.1, z: 4.05, rot: 90 },
    { type: 'place', deviceId: 'shure-sm58', x: 0.37, z: 1.234, rot: 15 },
    { type: 'connect', a: { dev: 'midas-m32-1', port: 'out-main-l' }, b: { dev: 'qsc-k12-2-1', port: 'in-line-a' } },
    { type: 'connect', a: { dev: 'shure-sm58-1', port: SM58_OUT }, b: { dev: 'midas-m32-1', port: 'in-mic-1' } },
  )

const placementOf = (d: DesignState, id: string) => d.placements.find((p) => p.instanceId === id)

describe('spawn: the plan becomes 3D gear at the same metres, the same yaw, with its cables', () => {
  it('every device is created at x / z of the plan (y = the floor there), its yaw = the plan rotation, floor-mounted; reading the store back gives the plan to 1 mm', () => {
    const deck = (_x: number, z: number): number => (z < -2 ? 0.6 : 0) // a raised stage deck at the back: a device dropped there stands on it
    const { store, target } = scene(undefined, deck)
    const plan = bench()
    const r = spawnInto(registry, plan, target, 'add', 'Envoyer')
    expect(r.ok).toBe(true)
    const d = store.design()
    expect(d.rig.instances.map((i) => i.deviceId).sort()).toEqual(['midas-m32', 'qsc-k12-2', 'shure-sm58'])
    for (const pd of plan.devices) {
      const created = r.plan.devices.find((x) => x.planId === pd.id)!
      const p = placementOf(d, created.instanceId)!
      expect(p.deviceId).toBe(pd.deviceId)
      expect(Math.abs(p.position_m[0] - pd.x)).toBeLessThan(1e-3)
      expect(Math.abs(p.position_m[2] - pd.z)).toBeLessThan(1e-3)
      expect(p.position_m[1]).toBe(deck(pd.x, pd.z))
      expect(p.yawDeg).toBe(pd.rot)
      expect(p.mount ?? 'floor').toBe('floor')
      // the rotation maps: the 3D front axis (sin yaw, cos yaw), as coverageLayer aims a speaker, is the plan symbol's front (local +z)
      const t = (p.yawDeg * Math.PI) / 180
      const front = localToWorld(pd, 0, 1)
      expect(Math.sin(t)).toBeCloseTo(front.x - pd.x, 9)
      expect(Math.cos(t)).toBeCloseTo(front.z - pd.z, 9)
    }
    // the spacing is kept exactly: the distance between two devices is the plan's
    const [a, b] = [r.plan.devices[0]!, r.plan.devices[1]!]
    const pa = placementOf(d, a.instanceId)!.position_m
    const pb = placementOf(d, b.instanceId)!.position_m
    expect(Math.hypot(pa[0] - pb[0], pa[2] - pb[2])).toBeCloseTo(Math.hypot(1.25 - -3.1, -2.5 - 4.05), 9)
  })

  it('the plan cables become the 3D connections, by the catalogue port ids, through the plan id -> instance id map', () => {
    const { store, target } = scene()
    const r = spawnInto(registry, bench(), target, 'add', 'Envoyer')
    expect(r.ok).toBe(true)
    const conns = store.design().rig.connections.map((c) => `${c.a.instance}.${c.a.port}>${c.b.instance}.${c.b.port}`).sort()
    expect(conns).toEqual(['midas-m32-1.out-main-l>qsc-k12-2-1.in-line-a', `shure-sm58-1.${SM58_OUT}>midas-m32-1.in-mic-1`].sort())
    expect(r.plan.cables.map((c) => c.planId)).toEqual(['c1', 'c2'])
    expect(r.plan.refusedDevices).toEqual([])
    expect(r.plan.refusedCables).toEqual([])
  })

  it('is ONE history entry: one undo removes every device and cable, a redo puts them back at the same places', () => {
    const { store, history, target } = scene(withGear())
    const before = store.design()
    const size = history.sizes.undo
    expect(spawnInto(registry, bench(), target, 'add', 'Envoyer le schéma').ok).toBe(true)
    expect(history.sizes.undo).toBe(size + 1)
    expect(history.undoLabel).toBe('Envoyer le schéma')
    const after = store.design()
    expect(history.undo()).toBe(true)
    expect(store.design()).toEqual(before)
    expect(history.redo()).toBe(true)
    expect(store.design().placements).toEqual(after.placements)
    expect(store.design().rig.connections).toEqual(after.rig.connections)
  })

  it('the 3D gear already there is untouched: same ids, same places, same cables; the new devices get fresh ids beside it', () => {
    const { store, target } = scene(withGear())
    const before = store.design()
    const r = spawnInto(registry, bench(), target, 'add', 'Envoyer')
    expect(r.ok).toBe(true)
    const d = store.design()
    for (const p of before.placements) expect(placementOf(d, p.instanceId)).toEqual(p)
    for (const c of before.rig.connections) expect(d.rig.connections).toContainEqual(c)
    expect(r.plan.devices.map((x) => x.instanceId)).toEqual(['midas-m32-2', 'qsc-k12-2-2', 'shure-sm58-1'])
    expect(d.rig.instances).toHaveLength(before.rig.instances.length + 3)
  })

  it('pure planning dispatches nothing: the store and the history are as before', () => {
    const { store, history, target } = scene(withGear())
    const rev = store.revision
    const p = planSpawn(registry, bench(), target, 'add')
    expect(p.intents.filter((i) => i.type === 'SPAWN')).toHaveLength(3)
    expect(p.intents.filter((i) => i.type === 'CONNECT')).toHaveLength(2)
    expect(store.revision).toBe(rev)
    expect(history.sizes.undo).toBe(0)
  })
})

describe('spawn: what does not fit is reported, never forced', () => {
  it('a device outside the room (the drop rule: its centre past a wall) is not created, nor the cables that needed it; the rest is', () => {
    const { store, target } = scene()
    const plan = build(
      { type: 'place', deviceId: 'midas-m32', x: 0, z: 0 },
      { type: 'place', deviceId: 'qsc-k12-2', x: 12.5, z: 0 },
      { type: 'connect', a: { dev: 'midas-m32-1', port: 'out-main-l' }, b: { dev: 'qsc-k12-2-1', port: 'in-line-a' } },
    )
    const r = spawnInto(registry, plan, target, 'add', 'Envoyer')
    expect(r.ok).toBe(true)
    expect(r.plan.refusedDevices).toEqual([{ planId: 'qsc-k12-2-1', deviceId: 'qsc-k12-2', reason: 'outside' }])
    expect(r.plan.refusedCables).toEqual([{ planId: 'c1', a: { dev: 'midas-m32-1', port: 'out-main-l' }, b: { dev: 'qsc-k12-2-1', port: 'in-line-a' }, reason: 'device', device: 'qsc-k12-2-1' }])
    expect(store.design().rig.instances.map((i) => i.deviceId)).toEqual(['midas-m32'])
    expect(store.design().rig.connections).toEqual([])
  })

  it('a device on top of 3D gear, or on top of an earlier plan device, is reported with what it overlaps; side by side (touching) is fine', () => {
    const { store, target } = scene(withGear())
    const w = footprintOf('qsc-k12-2').w
    const plan = build(
      { type: 'place', deviceId: 'shure-sm58', x: 5.05, z: 5 }, // inside the K12.2 already in 3D at (5, 5)
      { type: 'place', deviceId: 'qsc-k12-2', x: 0, z: 0 },
      { type: 'place', deviceId: 'qsc-k12-2', x: 0.1, z: 0.1 }, // on the previous one
      { type: 'place', deviceId: 'qsc-k12-2', x: w, z: 0 }, // exactly beside the first: touching, not overlapping
    )
    const r = spawnInto(registry, plan, target, 'add', 'Envoyer')
    expect(r.ok).toBe(true)
    expect(r.plan.refusedDevices).toEqual([
      { planId: 'shure-sm58-1', deviceId: 'shure-sm58', reason: 'overlap', with: { id: 'qsc-k12-2-1', deviceId: 'qsc-k12-2', inScene: true } },
      { planId: 'qsc-k12-2-2', deviceId: 'qsc-k12-2', reason: 'overlap', with: { id: 'qsc-k12-2-1', deviceId: 'qsc-k12-2', inScene: false } },
    ])
    expect(r.plan.devices.map((x) => x.planId)).toEqual(['qsc-k12-2-1', 'qsc-k12-2-3'])
    expect(store.design().rig.instances).toHaveLength(4)
  })

  it('an overlap follows the rotation: a long device turned 90° clears a neighbour its unturned box would have hit', () => {
    const { target } = scene()
    const m = footprintOf('midas-m32') // 0.891 wide, 0.612 deep
    const plan = build(
      { type: 'place', deviceId: 'midas-m32', x: 0, z: 0, rot: 90 }, // now 0.612 across x
      { type: 'place', deviceId: 'shure-sm58', x: m.d / 2 + 0.1, z: 0 }, // within m.w / 2 but past m.d / 2
    )
    expect(planSpawn(registry, plan, target, 'add').refusedDevices).toEqual([])
  })

  it('a cable the connection rules refuse is reported with the rule’s own title and text (the same as the 3D status bar), not forced', () => {
    const { store, target } = scene()
    const plan = build(
      { type: 'place', deviceId: 'midas-m32', x: 0, z: 0 },
      { type: 'place', deviceId: 'qsc-k12-2', x: 3, z: 0 },
      // output into output: the plan model only refuses structural errors, the rules refuse this one
      { type: 'connect', a: { dev: 'midas-m32-1', port: 'out-main-l' }, b: { dev: 'qsc-k12-2-1', port: 'thru-out-a' } },
    )
    const expected = createPatchRules(registry).verdict(plan, plan.cables[0]!.a, plan.cables[0]!.b)
    expect(expected.ok).toBe(false)
    const r = spawnInto(registry, plan, target, 'add', 'Envoyer')
    expect(r.ok).toBe(true)
    expect(r.plan.refusedCables).toHaveLength(1)
    const c = r.plan.refusedCables[0]!
    expect(c.reason).toBe('rule')
    if (expected.ok || c.reason !== 'rule') throw new Error('unreachable')
    expect(c.code).toBe(expected.code)
    expect(c.title).toBe(expected.title)
    expect(c.detail).toBe(expected.detail)
    expect(store.design().rig.instances).toHaveLength(2)
    expect(store.design().rig.connections).toEqual([])
  })

  it('a device the catalogue does not know is reported, never invented', () => {
    const { target } = scene()
    const plan: Plan2D = { v: 1, roomId: 'blank', devices: [{ id: 'nope-1', deviceId: 'nope', x: 0, z: 0, rot: 0 }], cables: [] }
    expect(planSpawn(registry, plan, target, 'add').refusedDevices).toEqual([{ planId: 'nope-1', deviceId: 'nope', reason: 'unknown-device' }])
  })

  it('nothing that fits = nothing dispatched, no history entry', () => {
    const { store, history, target } = scene()
    const rev = store.revision
    const r = spawnInto(registry, build({ type: 'place', deviceId: 'qsc-k12-2', x: 30, z: 0 }), target, 'add', 'Envoyer')
    expect(r.ok).toBe(false)
    expect(store.revision).toBe(rev)
    expect(history.sizes.undo).toBe(0)
    expect(spawnInto(registry, emptyPlan('blank'), target, 'add', 'Envoyer').ok).toBe(false)
  })

  it('a second send of the same plan adds no duplicate: every device sits on its own copy, so all are reported as overlapping', () => {
    const { store, target } = scene()
    expect(spawnInto(registry, bench(), target, 'add', 'Envoyer').ok).toBe(true)
    const n = store.design().rig.instances.length
    const again = planSpawn(registry, bench(), target, 'add')
    expect(again.devices).toEqual([])
    expect(again.refusedDevices.map((x) => x.reason)).toEqual(['overlap', 'overlap', 'overlap'])
    expect(spawnInto(registry, bench(), target, 'add', 'Envoyer').ok).toBe(false)
    expect(store.design().rig.instances).toHaveLength(n)
  })
})

describe('spawn: the replace path (only when the learner picks it)', () => {
  it('APPLY_DESIGN of the plan alone, in the same place, as one undoable entry; the old gear comes back with one undo', () => {
    const { store, history, target } = scene(withGear())
    const before = store.design()
    const r = spawnInto(registry, bench(), target, 'replace', 'Remplacer')
    expect(r.ok).toBe(true)
    const d = store.design()
    expect(d.roomId).toBe('blank')
    expect(d.rig.instances.map((i) => i.instanceId)).toEqual(['midas-m32-1', 'qsc-k12-2-1', 'shure-sm58-1'])
    expect(placementOf(d, 'qsc-k12-2-1')!.position_m).toEqual([-3.1, 0, 4.05])
    expect(d.rig.connections).toHaveLength(2)
    expect(history.sizes.undo).toBe(1)
    history.undo()
    expect(store.design()).toEqual(before)
  })

  it('in replace mode the old gear is no obstacle (it goes), the plan devices still are to each other', () => {
    const { target } = scene(withGear())
    const plan = build({ type: 'place', deviceId: 'shure-sm58', x: 5.05, z: 5 }, { type: 'place', deviceId: 'shure-sm58', x: 5.05, z: 5.01 })
    expect(planSpawn(registry, plan, target, 'replace').refusedDevices.map((x) => x.planId)).toEqual(['shure-sm58-2'])
  })
})
