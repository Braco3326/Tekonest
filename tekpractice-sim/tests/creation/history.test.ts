import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { History } from '../../src/creation/history'
import type { Intent } from '../../src/ui/intents'

const setup = (limit?: number) => {
  const r = makeRegistry()
  const store = new CreationStore(r, creationEvaluator(r))
  return { store, history: new History(store, limit) }
}
const ids = (s: CreationStore) => s.design().rig.instances.map((i) => i.instanceId)
const pose = (instanceId: string, x: number): Intent => ({ type: 'SET_POSE', instanceId, position: [x, 0, 0], yawDeg: 0, tiltDeg: 0, mount: 'floor' })
const MIC = { instance: 'm', port: 'out-xlr' }
const DESK = { instance: 'q', port: 'in-mic-1' }

describe('History: undo/redo command stack', () => {
  it('do(SPAWN), undo → gone, redo → back with the same id', () => {
    const { store, history } = setup()
    expect(history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [1, 0, 2] }).ok).toBe(true)
    expect(history.undo()).toBe(true)
    expect(ids(store)).toEqual([])
    expect(history.redo()).toBe(true)
    expect(ids(store)).toEqual(['m'])
    expect(store.design().placements[0].position_m).toEqual([1, 0, 2])
  })

  it('a DISCONNECT by id redoes as an UNPLUG by ports, valid after the id changed (P1)', () => {
    const { store, history } = setup()
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
    history.do({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'q' })
    const c = history.do({ type: 'CONNECT', a: MIC, b: DESK })
    const id = c.ok ? c.connectionId! : ''
    expect(history.do({ type: 'DISCONNECT', connectionId: id }).ok).toBe(true)
    expect(history.undo()).toBe(true)
    expect(store.design().rig.connections).toHaveLength(1)
    expect(history.undo()).toBe(true)
    expect(store.design().rig.connections).toHaveLength(0)
    expect(history.redo()).toBe(true)
    expect(store.design().rig.connections).toHaveLength(1)
    expect(store.connectionAt(MIC)).not.toBe(id)
    expect(history.redo()).toBe(true)
    expect(store.design().rig.connections).toHaveLength(0)
  })

  it('a transaction of 30 SET_POSE is 1 entry; undo returns the original pose', () => {
    const { store, history } = setup()
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [1, 0, 2], rotationY: 30 })
    const original = store.design()
    history.begin('Déplacer')
    for (let i = 0; i < 30; i++) expect(history.do(pose('m', i)).ok).toBe(true)
    history.commit()
    expect(history.sizes).toEqual({ undo: 2, redo: 0 })
    expect(history.undoLabel).toBe('Déplacer')
    expect(history.undo()).toBe(true)
    expect(store.design()).toEqual(original)
    expect(history.redo()).toBe(true)
    expect(store.design().placements[0].position_m).toEqual([29, 0, 0])
  })

  it('an entry can carry side state (meta): undo hands back `before`, redo `after` (Task 13 fix: name travels with the rig)', () => {
    const { store, history } = setup()
    const seen: unknown[] = []
    history.onMeta((m) => seen.push(m))
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' }, 'Ouvrir', { before: { name: 'A' }, after: { name: 'B' } })
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'n' }) // no meta
    expect(history.undo()).toBe(true)
    expect(seen).toEqual([]) // an entry without meta says nothing
    expect(history.undo()).toBe(true)
    expect(seen).toEqual([{ name: 'A' }])
    expect(ids(store)).toEqual([])
    expect(history.redo()).toBe(true)
    expect(seen).toEqual([{ name: 'A' }, { name: 'B' }])
  })

  it('inTransaction is true between the outer begin and its commit / rollback (autosave waits on it, Task 13)', () => {
    const { history } = setup()
    expect(history.inTransaction).toBe(false)
    history.begin('a')
    history.begin('b')
    expect(history.inTransaction).toBe(true)
    history.commit()
    expect(history.inTransaction).toBe(true)
    history.commit()
    expect(history.inTransaction).toBe(false)
    history.begin('c')
    history.rollback()
    expect(history.inTransaction).toBe(false)
  })

  it('consecutive SET_POSE of one instance in a transaction keep the first inverse and the last forward', () => {
    const { history } = setup()
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [1, 0, 2] })
    history.begin('Déplacer')
    history.do(pose('m', 5))
    history.do(pose('m', 6))
    history.do(pose('m', 7))
    history.commit()
    const entry = history.peekUndo()!
    expect(entry.forward).toEqual([pose('m', 7)])
    expect(entry.inverse).toEqual([{ type: 'SET_POSE', instanceId: 'm', position: [1, 0, 2], yawDeg: 0, tiltDeg: 0, mount: 'floor' }])
  })

  it('SET_POSE of the same instance separated by another change is not coalesced', () => {
    const { store, history } = setup()
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [1, 0, 2] })
    history.begin('Mixte')
    history.do(pose('m', 5))
    history.do({ type: 'REMOVE', instanceId: 'm' })
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [8, 0, 0] })
    history.do(pose('m', 9))
    history.commit()
    const before = store.design()
    expect(history.peekUndo()!.forward).toHaveLength(4)
    history.undo()
    expect(store.design().placements[0].position_m).toEqual([1, 0, 2])
    history.redo()
    expect(store.design()).toEqual(before)
  })

  it('rollback() restores the state at begin and records nothing', () => {
    const { store, history } = setup()
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [1, 0, 2] })
    const atBegin = store.design()
    history.begin('Déplacer')
    history.do(pose('m', 4))
    history.do({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'q' })
    history.rollback()
    expect(store.design()).toEqual(atBegin)
    expect(history.sizes).toEqual({ undo: 1, redo: 0 })
  })

  it('an empty transaction records nothing; nested begin is counted', () => {
    const { history } = setup()
    history.begin('a')
    history.commit()
    expect(history.sizes.undo).toBe(0)
    history.begin('outer')
    history.begin('inner')
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
    history.commit()
    expect(history.sizes.undo).toBe(0)
    history.commit()
    expect(history.sizes.undo).toBe(1)
    expect(history.undoLabel).toBe('outer')
  })

  it('a failed dispatch records nothing and does not clear the redo stack', () => {
    const { history } = setup()
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
    history.undo()
    expect(history.do({ type: 'REMOVE', instanceId: 'nobody' }).ok).toBe(false)
    expect(history.sizes).toEqual({ undo: 0, redo: 1 })
  })

  it('a new do() after undo() clears the redo stack', () => {
    const { history } = setup()
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
    history.undo()
    history.do({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'q' })
    expect(history.canRedo).toBe(false)
    expect(history.redo()).toBe(false)
  })

  it('limit drops the oldest entries', () => {
    const { store, history } = setup(3)
    for (let i = 1; i <= 5; i++) history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: `m${i}` }, `spawn ${i}`)
    expect(history.sizes.undo).toBe(3)
    while (history.undo()) { /* empty */ }
    expect(ids(store)).toEqual(['m1', 'm2'])
  })

  it('default limit is 200', () => {
    const { history } = setup()
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
    for (let i = 0; i < 250; i++) history.do(pose('m', i))
    expect(history.sizes.undo).toBe(200)
  })

  it('labels, canUndo/canRedo, clear() and onChange', () => {
    const { history } = setup()
    let n = 0
    const off = history.onChange(() => n++)
    expect(history.canUndo).toBe(false)
    expect(history.undoLabel).toBeNull()
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' }, 'Ajouter')
    expect(history.canUndo).toBe(true)
    expect(history.undoLabel).toBe('Ajouter')
    history.undo()
    expect(history.redoLabel).toBe('Ajouter')
    expect(history.undoLabel).toBeNull()
    history.clear()
    expect(history.sizes).toEqual({ undo: 0, redo: 0 })
    expect(n).toBe(3)
    off()
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
    expect(n).toBe(3)
  })

  it('undo of a REMOVE is one store change: subscribers never see the device back at [0,0,0] without its cables', () => {
    const { store, history } = setup()
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [1, 0, 2] })
    history.do({ type: 'SPAWN', deviceId: 'axia-iq', instanceId: 'x', position: [3, 1, -2], rotationY: 40, tiltDeg: -5, mount: 'stand' })
    history.do({ type: 'SET_CONTROL', instance: 'x', control: 'monitor-mute', value: true })
    history.do({ type: 'CONNECT', a: MIC, b: { instance: 'x', port: 'in-mic-1' } })
    const before = store.design()
    history.do({ type: 'REMOVE', instanceId: 'x' })
    const seen: unknown[] = []
    store.subscribe(() => seen.push(store.design()))
    expect(history.undo()).toBe(true)
    expect(seen).toEqual([before])
  })

  it('redo of a multi-intent entry is one store change too', () => {
    const { store, history } = setup()
    history.begin('Patch')
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
    history.do({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'q' })
    history.do({ type: 'CONNECT', a: MIC, b: DESK })
    history.commit()
    history.undo()
    let n = 0
    store.subscribe(() => n++)
    history.redo()
    expect(n).toBe(1)
    history.undo()
    expect(n).toBe(2)
  })

  it('an undo whose inverse no longer applies changes nothing and keeps the entry', () => {
    const { store, history } = setup()
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
    // Out-of-band change behind the history's back makes the inverse (REMOVE m) invalid.
    store.dispatch({ type: 'REMOVE', instanceId: 'm' })
    const before = store.design()
    expect(history.undo()).toBe(false)
    expect(store.design()).toEqual(before)
    expect(history.sizes).toEqual({ undo: 1, redo: 0 })
  })

  it('undo/redo are refused while a transaction is open', () => {
    const { history } = setup()
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
    history.begin('Déplacer')
    history.do(pose('m', 1))
    expect(history.undo()).toBe(false)
    history.commit()
    expect(history.undo()).toBe(true)
  })
})

describe('History.onBeforeCommand (Task 10 review): a foreign command closes an open burst first', () => {
  it('fires before do / undo / redo; a listener that commits the open transaction keeps the next do a separate entry', () => {
    const { history } = setup()
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm', position: [0, 0, 0] })
    const calls: string[] = []
    let own = false
    let open = false
    const off = history.onBeforeCommand((kind) => {
      calls.push(kind)
      if (!own && open) {
        open = false
        history.commit()
      }
    })
    const burstStep = (x: number) => {
      if (!open) {
        history.begin('Régler X')
        open = true
      }
      own = true
      history.do(pose('m', x))
      own = false
    }
    const u0 = history.sizes.undo
    burstStep(1)
    burstStep(2)
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'n' }) // a foreign command (e.g. Suppr) during the burst
    expect(history.sizes.undo).toBe(u0 + 2)
    expect(history.peekUndo()!.label).toBe('SPAWN')
    // an undo right after a burst undoes the burst (it is closed first, not refused)
    burstStep(5)
    expect(history.undo()).toBe(true)
    expect(history.peekUndo()!.label).toBe('SPAWN')
    expect(history.redo()).toBe(true)
    expect(calls).toEqual(['do', 'do', 'do', 'do', 'undo', 'redo'])
    off()
    history.do(pose('m', 9))
    expect(calls).toHaveLength(6)
  })
})
describe('History.onRefused (Task 14): a refused learner intent is reported once, nothing recorded', () => {
  it('a refused CONNECT calls the listener with the intent and the failure; a valid one does not', () => {
    const { history } = setup()
    history.do({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'm' })
    history.do({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'q' })
    const seen: { type: string; code: string }[] = []
    history.onRefused((intent, r) => seen.push({ type: intent.type, code: r.error.code }))
    expect(history.do({ type: 'CONNECT', a: MIC, b: MIC }).ok).toBe(false)
    expect(seen).toEqual([{ type: 'CONNECT', code: 'SELF_CONNECTION' }])
    expect(history.do({ type: 'CONNECT', a: MIC, b: DESK }).ok).toBe(true)
    expect(seen).toHaveLength(1)
    expect(history.sizes.undo).toBe(3)
  })
})