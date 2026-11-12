/**
 * The power helper « Je branche pour vous (dans le simulateur) » (onboarding spec 6.5, plan T3.3): real CreationStore + real History.
 * Each condition has a case that triggers and one that does not; one undo entry; rollback on a late refusal; never SPAWN nor SET_CONTROL;
 * a Propriétés stepper burst still open (onBeforeCommand) never swallows the helper's cables; the tutorial gate of the button.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { CreationStore, creationEvaluator, type DispatchResult } from '../../src/creation/store'
import { History } from '../../src/creation/history'
import { helperButton, powerHelperPlan, runPowerHelper } from '../../src/creation/powerHelper'
import { parseProposals, registerProposals } from '../../src/creation/betaDevices'
import { signalPath } from '../../src/flow/signalPath'
import { POWER_HELPER_KEY, parsePowerHelperUse, readPowerHelperUse, recordPowerHelperUse } from '../../src/design/powerHelperUse'
import type { Intent } from '../../src/ui/intents'

const LABEL = 'Branchement au courant (aide)'
const proposals = JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as unknown

function setup(intents: Intent[] = [], beta = false) {
  const registry = makeRegistry()
  if (beta) registerProposals(registry, parseProposals(proposals, registry).devices)
  const store = new CreationStore(registry, creationEvaluator(registry))
  for (const i of intents) expect(store.dispatch(i).ok, JSON.stringify(i)).toBe(true)
  const history = new History(store)
  return { registry, store, history }
}
const spawn = (deviceId: string, instanceId: string): Intent => ({ type: 'SPAWN', deviceId, instanceId, position: [0, 0, 0] })
const connect = (a: string, ap: string, b: string, bp: string): Intent => ({ type: 'CONNECT', a: { instance: a, port: ap }, b: { instance: b, port: bp } })
const QL1 = spawn('yamaha-ql1', 'ql1')
const K12 = spawn('qsc-k12-2', 'k12')
const SM58 = spawn('shure-sm58', 'sm58')
const STRIP = spawn('multiprise-secteur', 'strip')
const PLAYING = [QL1, SM58, K12, connect('ql1', 'out-main-l', 'k12', 'in-line-a'), { type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true } as Intent]
const mains = (s: CreationStore) => s.design().rig.connections.filter((c) => c.a.port === 'power-in' || c.b.port === 'power-in')

describe('powerHelperPlan: when it is offered', () => {
  it('triggers: a verified strip and the console and speaker unpowered: console first, then the speaker, on free outlets', () => {
    const { store, registry } = setup([...PLAYING, STRIP])
    const plan = powerHelperPlan(store, registry)
    expect(plan).toEqual({
      offered: true,
      instances: ['ql1', 'k12'],
      cables: [
        { a: { instance: 'strip', port: 'out-1' }, b: { instance: 'ql1', port: 'power-in' } },
        { a: { instance: 'strip', port: 'out-2' }, b: { instance: 'k12', port: 'power-in' } },
      ],
    })
  })

  it('console first even when the speaker was placed before it (G8 review S6: the guide sees the console cable first)', () => {
    const { store, registry } = setup([K12, STRIP, QL1])
    const plan = powerHelperPlan(store, registry)
    expect(plan.offered && plan.instances).toEqual(['ql1', 'k12'])
  })

  it('does not trigger without a strip (it never places one)', () => {
    const { store, registry } = setup(PLAYING)
    expect(powerHelperPlan(store, registry)).toEqual({ offered: false, why: 'no-strip' })
  })

  it('does not trigger with a Bêta mains outlet only (unverified data supplies nothing), even with the flag tampered in', () => {
    const { store, registry } = setup([...PLAYING, spawn('shure-axient-digital-ad4d', 'beta')], true)
    expect(powerHelperPlan(store, registry)).toEqual({ offered: false, why: 'no-strip' })
    const port = registry.deviceById.get('shure-axient-digital-ad4d')!.ports.find((p) => p.portId === 'out-ac-power-cascade-locking')!
    port.flags = [...(port.flags ?? []), 'isMainsSource']
    expect(powerHelperPlan(store, registry)).toEqual({ offered: false, why: 'no-strip' })
  })

  it('does not trigger when everything is already powered; a device already cabled to a strip is left alone', () => {
    const { store, registry } = setup([...PLAYING, STRIP, connect('strip', 'out-3', 'ql1', 'power-in'), connect('strip', 'out-4', 'k12', 'power-in')])
    expect(signalPath(store.design(), registry, store.events()).playbackReady).toBe(true)
    expect(powerHelperPlan(store, registry)).toEqual({ offered: false, why: 'nothing-to-cable' })
  })

  it('a mains cable that already exists is never doubled nor moved: only the device left without one is cabled', () => {
    const { store, registry } = setup([...PLAYING, STRIP, connect('strip', 'out-1', 'ql1', 'power-in')])
    expect(powerHelperPlan(store, registry)).toEqual({ offered: true, instances: ['k12'], cables: [{ a: { instance: 'strip', port: 'out-2' }, b: { instance: 'k12', port: 'power-in' } }] })
  })

  it('a power-in cabled to a Bêta outlet is the learner’s: not unplugged, not offered for it', () => {
    const { store, registry } = setup([QL1, STRIP, spawn('shure-axient-digital-ad4d', 'beta'), connect('beta', 'out-ac-power-cascade-locking', 'ql1', 'power-in')], true)
    expect(powerHelperPlan(store, registry)).toEqual({ offered: false, why: 'nothing-to-cable' })
  })

  it('does not trigger when the strip has fewer free outlets than devices to cable; triggers with exactly enough', () => {
    const k = (n: number) => spawn('qsc-k12-2', `k${n}`)
    const full = setup([QL1, STRIP, k(1), k(2), k(3), k(4), connect('strip', 'out-1', 'k1', 'power-in')])
    expect(powerHelperPlan(full.store, full.registry)).toEqual({ offered: false, why: 'strip-full' })
    const enough = setup([QL1, STRIP, k(1), k(2), k(3), connect('strip', 'out-1', 'k1', 'power-in')])
    const plan = powerHelperPlan(enough.store, enough.registry)
    expect(plan.offered && plan.instances).toEqual(['ql1', 'k2', 'k3'])
  })

  it('only playback devices (the source console, the speakers): a mic, a Bêta device, a stage box are not cabled', () => {
    const { store, registry } = setup([QL1, SM58, STRIP, spawn('yamaha-rio3224-d2', 'rio')])
    const plan = powerHelperPlan(store, registry)
    expect(plan.offered && plan.instances).toEqual(['ql1'])
  })
})

describe('runPowerHelper: one History transaction', () => {
  it('two CONNECTs, ONE undo entry; one undo removes both; redo puts both back; the rig then plays', () => {
    const { store, history, registry } = setup([...PLAYING, STRIP])
    const before = store.design()
    const r = runPowerHelper(store, history, registry, LABEL)
    expect(r).toEqual({ ok: true, instances: ['ql1', 'k12'] })
    expect(history.sizes).toEqual({ undo: 1, redo: 0 })
    expect(history.undoLabel).toBe(LABEL)
    expect(history.peekUndo()!.forward.map((i) => i.type)).toEqual(['CONNECT', 'CONNECT'])
    expect(mains(store)).toHaveLength(2)
    expect(signalPath(store.design(), registry, store.events()).playbackReady).toBe(true)
    expect(history.undo()).toBe(true)
    expect(store.design()).toEqual(before)
    expect(history.redo()).toBe(true)
    expect(mains(store)).toHaveLength(2)
  })

  it('never SPAWN nor SET_CONTROL: the store sees CONNECTs only; « Lecture console » and « Alimentation » keep the learner’s values', () => {
    const { store, history, registry } = setup([QL1, K12, STRIP, { type: 'SET_CONTROL', instance: 'k12', control: 'power', value: false }])
    const seen: string[] = []
    store.subscribe((c) => seen.push(...c.intents.map((i) => i.type)))
    expect(runPowerHelper(store, history, registry, LABEL).ok).toBe(true)
    expect(seen).toEqual(['CONNECT', 'CONNECT'])
    expect(store.design().rig.controls.ql1['playback-usb']).toBe(false)
    expect(store.design().rig.controls.k12.power).toBe(false)
    expect(store.design().rig.instances.map((i) => i.instanceId)).toEqual(['ql1', 'k12', 'strip'])
  })

  it('a refusal of the second CONNECT rolls back: the real store reverts the first, nothing is recorded, the refusal is reported once', () => {
    const { store, registry } = setup([...PLAYING, STRIP])
    // The real store behind a door whose group gets a second CONNECT the store refuses (the plan's dry run passed: a refusal between the check and the do).
    const door = {
      dispatch: (i: Intent): DispatchResult => store.dispatch(i),
      dispatchAll: (intents: readonly Intent[]) => store.dispatchAll(intents.map((i, k) => (k === 1 && i.type === 'CONNECT' ? { ...i, a: { instance: 'strip', port: 'no-such-port' } } : i))),
    }
    const history = new History(door)
    const refused: Intent[] = []
    history.onRefused((i) => refused.push(i))
    const before = store.design()
    const changes: number[] = []
    store.subscribe(() => changes.push(store.revision))
    expect(runPowerHelper(store, history, registry, LABEL)).toEqual({ ok: false, why: 'refused-late' })
    expect(store.design()).toEqual(before)
    expect(changes).toEqual([]) // the store never showed the half-done state
    expect(history.sizes).toEqual({ undo: 0, redo: 0 })
    expect(history.inTransaction).toBe(false)
    expect(refused).toHaveLength(1)
  })

  it('a store without a group dispatch: begin, one do per cable, rollback on the refusal of the second (nothing stays, nothing recorded)', () => {
    const { store, registry } = setup([...PLAYING, STRIP])
    let connects = 0
    const door = {
      dispatch(i: Intent): DispatchResult {
        if (i.type === 'CONNECT' && ++connects === 2) return { ok: false, error: { code: 'TEST', message: 'refused' }, subjects: [] }
        return store.dispatch(i)
      },
    }
    const history = new History(door)
    const before = store.design()
    expect(runPowerHelper(store, history, registry, LABEL)).toEqual({ ok: false, why: 'refused-late' })
    expect(store.design()).toEqual(before)
    expect(history.sizes).toEqual({ undo: 0, redo: 0 })
    expect(history.inTransaction).toBe(false)
  })

  it('ONE store change for both cables, console first (the status line never announces an in-between state; the guide reads the console cable first)', () => {
    const { store, history, registry } = setup([K12, STRIP, QL1])
    const changes: Intent[][] = []
    store.subscribe((c) => changes.push(c.intents))
    expect(runPowerHelper(store, history, registry, LABEL).ok).toBe(true)
    expect(changes).toEqual([
      [
        { type: 'CONNECT', a: { instance: 'strip', port: 'out-1' }, b: { instance: 'ql1', port: 'power-in' } },
        { type: 'CONNECT', a: { instance: 'strip', port: 'out-2' }, b: { instance: 'k12', port: 'power-in' } },
      ],
    ])
    expect(mains(store).map((c) => c.b.instance)).toEqual(['ql1', 'k12'])
  })

  it('not offered = nothing done, nothing recorded, no refusal reported', () => {
    const { store, history, registry } = setup(PLAYING)
    const refused: Intent[] = []
    history.onRefused((i) => refused.push(i))
    expect(runPowerHelper(store, history, registry, LABEL)).toEqual({ ok: false, why: 'no-strip' })
    expect(history.sizes).toEqual({ undo: 0, redo: 0 })
    expect(refused).toEqual([])
  })

  it('a Propriétés stepper burst still open (onBeforeCommand) is closed first: two entries, and one undo removes the cables only', () => {
    const { store, history, registry } = setup([...PLAYING, STRIP])
    // propertiesPanel.ts: a burst is `begin` + `do(SET_POSE)`, closed by its own `commit` from the before-command hook of a foreign command.
    let burst = false
    let stepping = false
    history.onBeforeCommand(() => {
      if (!stepping && burst) {
        burst = false
        history.commit()
      }
    })
    history.begin('Ajuster X')
    burst = true
    stepping = true
    expect(history.do({ type: 'SET_POSE', instanceId: 'k12', position: [1, 0, 0], yawDeg: 0, tiltDeg: 0, mount: 'floor' }).ok).toBe(true)
    stepping = false
    expect(history.inTransaction).toBe(true)
    expect(runPowerHelper(store, history, registry, LABEL).ok).toBe(true)
    expect(history.sizes.undo).toBe(2)
    expect(history.undoLabel).toBe(LABEL)
    expect(history.undo()).toBe(true)
    expect(mains(store)).toEqual([])
    expect(store.design().placements.find((p) => p.instanceId === 'k12')!.position_m).toEqual([1, 0, 0])
  })

  it('a drag still in progress (a transaction no hook closes) is « busy »: nothing is done', () => {
    const { store, history, registry } = setup([...PLAYING, STRIP])
    history.begin('Déplacer')
    expect(runPowerHelper(store, history, registry, LABEL)).toEqual({ ok: false, why: 'busy' })
    expect(mains(store)).toEqual([])
  })
})

describe('helperButton: the tutorial gate (spec 6.5)', () => {
  const offered = { offered: true as const, cables: [], instances: ['ql1', 'k12'] }
  it('not shown when not offered, in or out of a run', () => {
    expect(helperButton({ offered: false, why: 'no-strip' }, null)).toEqual({ shown: false })
    expect(helperButton({ offered: false, why: 'strip-full' }, { step: 'courant-console', helperUnlocked: true })).toEqual({ shown: false })
  })
  it('during a tutorial run: disabled with its reason until the guide unlocks it, then enabled', () => {
    expect(helperButton(offered, { step: 'courant-console', helperUnlocked: false })).toEqual({ shown: true, enabled: false, reason: 'tutorial' })
    expect(helperButton(offered, { step: 'console', helperUnlocked: false })).toEqual({ shown: true, enabled: false, reason: 'tutorial' })
    expect(helperButton(offered, { step: 'courant-console', helperUnlocked: true })).toEqual({ shown: true, enabled: true, instances: ['ql1', 'k12'] })
  })
  it('outside a run (no tutorial, or `?oscar=0`): enabled once a strip is there', () => {
    expect(helperButton(offered, null)).toEqual({ shown: true, enabled: true, instances: ['ql1', 'k12'] })
    expect(helperButton(offered, { step: null, helperUnlocked: false })).toEqual({ shown: true, enabled: true, instances: ['ql1', 'k12'] })
  })
})

describe('the use record (tekpractice.power-helper.v1): what the guide reads to mark the steps « montré »', () => {
  class Mem {
    m = new Map<string, string>()
    getItem(k: string) {
      return this.m.get(k) ?? null
    }
    setItem(k: string, v: string) {
      this.m.set(k, v)
    }
  }
  it('counts up with the devices cabled; malformed or blocked = null / false, never a throw', () => {
    const s = new Mem()
    expect(readPowerHelperUse(s)).toBeNull()
    expect(recordPowerHelperUse(s, ['ql1', 'k12'])).toBe(true)
    expect(readPowerHelperUse(s)).toEqual({ v: 1, n: 1, instances: ['ql1', 'k12'] })
    expect(recordPowerHelperUse(s, ['k12'])).toBe(true)
    expect(readPowerHelperUse(s)).toEqual({ v: 1, n: 2, instances: ['k12'] })
    for (const bad of ['x', '[]', JSON.stringify({ v: 2, n: 1, instances: [] }), JSON.stringify({ v: 1, n: -1, instances: [] }), JSON.stringify({ v: 1, n: 1, instances: [3] })])
      expect(parsePowerHelperUse(bad), bad).toBeNull()
    const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(readPowerHelperUse(blocked)).toBeNull()
    expect(recordPowerHelperUse(blocked, ['ql1'])).toBe(false)
    expect(POWER_HELPER_KEY).toBe('tekpractice.power-helper.v1')
  })
})

// ── the wiring (wire.ts): the gate from the guide's event and record, the click, the status line ─────────────────────────
import { wirePowerHelper, type HelperWiring } from '../../src/creation/onboarding/wire'
import * as powerHelperModule from '../../src/creation/powerHelper'
import { COPY } from '../../src/creation/copy'
import { TUTORIAL_EVENT } from '../../src/design/events'
import { TUTORIAL_RECORD_KEY } from '../../src/design/tutorialRecord'

describe('wirePowerHelper', () => {
  class Mem {
    m = new Map<string, string>()
    getItem(k: string) {
      return this.m.get(k) ?? null
    }
    setItem(k: string, v: string) {
      this.m.set(k, v)
    }
  }
  const running = (helper: boolean) => JSON.stringify({ v: 1, handledRequest: 1, step: 'courant-console', k: 8, n: 10, status: 'running', early: [], shown: [], helper })
  async function wired(over: Partial<HelperWiring> = {}, record: string | null = null) {
    const { store, history, registry } = setup([...PLAYING, STRIP])
    const storage = new Mem()
    if (record !== null) storage.setItem(TUTORIAL_RECORD_KEY, record)
    const said: string[] = []
    const win = new EventTarget()
    let renders = 0
    const h = wirePowerHelper(
      { store, history, registry, announce: (m) => said.push(m), tutorialAllowed: true, storage: () => storage as unknown as Storage, load: async () => powerHelperModule, ...over },
      { win: win as unknown as Window, deviceLabel: (id) => `«${id}»`, render: () => renders++ },
    )
    await h.ready
    return { h, store, history, storage, said, win, renders: () => renders }
  }
  const tell = (win: EventTarget, detail: unknown) => win.dispatchEvent(new CustomEvent(TUTORIAL_EVENT, { detail }))

  it('outside a run: enabled, the note says exactly what a click cables; the click cables, marks the use, and the status line lists what was added', async () => {
    const w = await wired()
    expect(w.h.view()).toEqual({ shown: true, enabled: true, note: 'Relie à la multiprise posée : «ql1», «k12». Rien n’est posé ni réglé.' })
    w.h.run()
    expect(mains(w.store)).toHaveLength(2)
    expect(w.history.sizes.undo).toBe(1)
    expect(w.said).toEqual(['Branché au courant : «ql1», «k12». Ctrl+Z pour annuler.'])
    expect(readPowerHelperUse(w.storage)).toEqual({ v: 1, n: 1, instances: ['ql1', 'k12'] })
    expect(w.h.view()).toEqual({ shown: false }) // nothing left to cable
  })

  it('a running tutorial (the guide’s record at load): disabled with its reason, a click does nothing; the guide’s event unlocks it', async () => {
    const w = await wired({}, running(false))
    expect(w.h.view()).toEqual({ shown: true, enabled: false, note: COPY.checklist!.helperLocked })
    w.h.run()
    expect(mains(w.store)).toEqual([])
    expect(w.said).toEqual([])
    const before = w.renders()
    tell(w.win, { step: 'courant-console', helperUnlocked: true })
    expect(w.renders()).toBe(before + 1)
    expect(w.h.view()).toMatchObject({ shown: true, enabled: true })
    // the run ends (step null): no gate any more
    tell(w.win, { step: null, helperUnlocked: false })
    expect(w.h.view()).toMatchObject({ shown: true, enabled: true })
    tell(w.win, { step: 'courant-enceinte', helperUnlocked: false })
    expect(w.h.view()).toMatchObject({ shown: true, enabled: false })
    tell(w.win, { step: 3 }) // not a gate: ignored
    expect(w.h.view()).toMatchObject({ shown: true, enabled: false })
  })

  it('`?oscar=0` (no tutorial may run): a stale running record is never read, the event is not listened to', async () => {
    const w = await wired({ tutorialAllowed: false }, running(false))
    expect(w.h.view()).toMatchObject({ shown: true, enabled: true })
    tell(w.win, { step: 'courant-console', helperUnlocked: false })
    expect(w.h.view()).toMatchObject({ shown: true, enabled: true })
  })

  it('before its chunk is loaded: no button; a late refusal says nothing changed', async () => {
    let release!: (m: typeof powerHelperModule) => void
    const { store, history, registry } = setup([...PLAYING, STRIP])
    const said: string[] = []
    const h = wirePowerHelper(
      { store, history, registry, announce: (m) => said.push(m), tutorialAllowed: false, storage: () => null, load: () => new Promise((r) => (release = r)) },
      { win: null, deviceLabel: (id) => id, render: () => undefined },
    )
    expect(h.view()).toEqual({ shown: false })
    h.run()
    expect(mains(store)).toEqual([])
    release({ ...powerHelperModule, runPowerHelper: () => ({ ok: false, why: 'refused-late' }) })
    await h.ready
    h.run()
    expect(said).toEqual([COPY.checklist!.helperFailed])
  })
})
