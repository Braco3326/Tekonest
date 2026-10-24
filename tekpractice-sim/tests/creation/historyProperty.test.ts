import { describe, expect, it } from 'vitest'
import { fingerprint } from '../../src/trials/fingerprint'
import { makeRegistry } from '../helpers'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { History } from '../../src/creation/history'
import type { Registry } from '../../src/engine/CatalogLoader'
import type { ControlValue, PortRef } from '../../src/engine/types'
import type { Intent } from '../../src/ui/intents'
import type { Mount } from '../../src/trials/trial'

/** mulberry32: a tiny seeded PRNG in [0, 1) (no new dependency). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DEVICES = ['yamaha-ql1', 'shure-sm58', 'qsc-k12-2', 'axia-iq', 'focusrite-isa-one'] as const
const MOUNTS: Mount[] = ['floor', 'stand', 'flown']

const pick = <T,>(rand: () => number, xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]
const round = (v: number, q: number) => Math.round(v / q) * q

function randomPose(rand: () => number, instanceId: string): Intent {
  return {
    type: 'SET_POSE',
    instanceId,
    position: [round(rand() * 20 - 10, 0.01), round(rand() * 3, 0.01), round(rand() * 20 - 10, 0.01)],
    yawDeg: round(rand() * 360, 1),
    tiltDeg: pick(rand, [0, 0, -5, 10]),
    mount: pick(rand, MOUNTS),
  }
}

/** A random intent: mostly valid, sometimes not (a failed do() must record nothing). */
function pickIntent(rand: () => number, store: CreationStore, registry: Registry, fresh: () => string): Intent {
  const snap = store.snapshot()
  const insts = snap.instances
  const kind = insts.length === 0 ? 'SPAWN' : pick(rand, ['SPAWN', 'REMOVE', 'CONNECT', 'CONNECT', 'DISCONNECT', 'SET_CONTROL', 'SET_POSE'] as const)
  switch (kind) {
    case 'SPAWN': {
      const deviceId = rand() < 0.05 ? 'no-such-device' : pick(rand, DEVICES)
      const instanceId = rand() < 0.05 && insts.length ? pick(rand, insts).instanceId : fresh()
      return rand() < 0.5
        ? { type: 'SPAWN', deviceId, instanceId }
        : { type: 'SPAWN', deviceId, instanceId, position: [round(rand() * 10, 0.01), 0, round(rand() * 10, 0.01)], rotationY: round(rand() * 360, 1), mount: pick(rand, MOUNTS) }
    }
    case 'REMOVE':
      return { type: 'REMOVE', instanceId: rand() < 0.05 ? 'nobody' : pick(rand, insts).instanceId }
    case 'CONNECT': {
      const ports: PortRef[] = insts.flatMap((i) => i.ports.map((p) => ({ instance: i.instanceId, port: p.portId })))
      // Prefer a pair the graph accepts (70 %), else any random pair.
      const wantValid = rand() < 0.7
      for (let tries = 0; tries < 60; tries++) {
        const a = pick(rand, ports)
        const b = pick(rand, ports)
        if (!wantValid || store.canConnect(a, b).ok) return { type: 'CONNECT', a, b }
      }
      return { type: 'CONNECT', a: pick(rand, ports), b: pick(rand, ports) }
    }
    case 'DISCONNECT': {
      if (snap.connections.length === 0 || rand() < 0.05) return { type: 'DISCONNECT', connectionId: 'no-such-connection' }
      const c = pick(rand, snap.connections)
      return { type: 'DISCONNECT', connectionId: store.connectionAt(c.a)! }
    }
    case 'SET_CONTROL': {
      const inst = pick(rand, insts)
      const controls = registry.deviceById.get(inst.deviceId)?.controls ?? []
      if (controls.length === 0) return { type: 'SET_CONTROL', instance: inst.instanceId, control: 'no-such-control', value: true }
      const c = pick(rand, controls)
      const value: ControlValue = rand() < 0.05 ? 'bad-value' : c.type === 'toggle' ? rand() < 0.5 : pick(rand, c.options)
      return { type: 'SET_CONTROL', instance: inst.instanceId, control: c.id, value }
    }
    case 'SET_POSE':
      return rand() < 0.05 ? randomPose(rand, 'nobody') : randomPose(rand, pick(rand, insts).instanceId)
  }
}

function setup(seed: number) {
  const registry = makeRegistry()
  const store = new CreationStore(registry, creationEvaluator(registry))
  const history = new History(store)
  const rand = mulberry32(seed)
  let n = 0
  const fresh = () => `dev-${seed}-${++n}`
  const run = () => {
    for (let step = 1; step <= 40; step++) {
      if (step % 25 === 0 && store.snapshot().instances.length > 0) {
        history.begin('Déplacer')
        const count = 3 + Math.floor(rand() * 6)
        const target = pick(rand, store.snapshot().instances).instanceId
        for (let k = 0; k < count; k++) history.do(rand() < 0.8 ? randomPose(rand, target) : randomPose(rand, pick(rand, store.snapshot().instances).instanceId))
        history.commit()
      } else {
        history.do(pickIntent(rand, store, registry, fresh))
      }
    }
  }
  return { store, history, run }
}

describe('History property: undo all = initial fingerprint, redo all = final fingerprint', () => {
  it('200 random sequences', async () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { store, history, run } = setup(seed)
      const initial = await fingerprint(store.design())
      run()
      const final = await fingerprint(store.design())
      while (history.undo()) { /* empty */ }
      expect(history.sizes.undo, `seed ${seed} undo stack drained`).toBe(0)
      expect(await fingerprint(store.design()), `seed ${seed} undo`).toBe(initial)
      while (history.redo()) { /* empty */ }
      expect(history.sizes.redo, `seed ${seed} redo stack drained`).toBe(0)
      expect(await fingerprint(store.design()), `seed ${seed} redo`).toBe(final)
    }
  }, 60_000)
})
