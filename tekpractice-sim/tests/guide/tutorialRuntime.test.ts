// The tutorial at run time (plan T3.2, G8 review C2): start / resume / restart / skip on the onboarding request, the guide's record
// `oscar-guide.onboarding.v1`, a reload mid-way, and steps whose result is already on the bench (« déjà en place »). Real vendored controller, no DOM.
import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { COPY } from '../../src/creation/copy'
import { packageById } from '../../src/design/packages'
import { TUTORIAL_RECORD_KEY, parseTutorialRecord, tutorialInProgress, type TutorialRecord } from '../../src/design/tutorialRecord'
import type { TpState } from '../../src/guide/bridge/types'
import { CREATION_STRINGS, premiersPasFlow } from '../../src/guide/flows.creation'
import { createTutorialRuntime, type TutorialDetail, type TutorialRequest } from '../../src/guide/tutorial'
import { createController } from '../../src/guide/vendor/core/controller'
import type { GuideBrain } from '../../src/guide/vendor/core/brain'
import type { ControllerInput, Flow, GuideView, HostEvent } from '../../src/guide/vendor/core/types'

const registry = makeRegistry()
const brain: GuideBrain = { ask: async () => ({ kind: 'refusal', text: 'x', lines: [], verdict: null }), judge: async () => ({ verdict: null, needInfo: null }) }

function stateOf(devices: [string, string][], connections: TpState['connections'] = [], controls: TpState['controls'] = {}): TpState {
  const own: TpState['controls'] = {}
  for (const [id, deviceId] of devices) {
    const values: Record<string, boolean | string> = {}
    for (const c of registry.deviceById.get(deviceId)?.controls ?? []) values[c.id] = c.type === 'toggle' ? c.default : c.defaultOption
    own[id] = { ...values, ...(controls[id] ?? {}) }
  }
  return {
    route: 'creation',
    placeKnown: true,
    instances: devices.map(([id, deviceId]) => ({ id, deviceId, label: deviceId })),
    connections,
    controls: own,
    events: [],
    playbackReady: false,
    firstReason: null,
  }
}

class MemStorage {
  map = new Map<string, string>()
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v))
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
}
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

/** A page: the real controller fed through the runtime's storage, as mount.ts wires it. */
function page(storage: MemStorage | null, pacing = packageById(1).pacing.steps, extra: Flow[] = [], records: TutorialRecord[] = []) {
  const clock = { t: 1 }
  const flow = premiersPasFlow(registry, pacing)
  const sent: ControllerInput[] = []
  const told: TutorialDetail[] = []
  const focused: (string | null)[] = []
  let view: GuideView | null = null
  // eslint-disable-next-line prefer-const
  let controller: ReturnType<typeof createController>
  const rt = createTutorialRuntime({
    flow,
    registry,
    storage,
    now: () => clock.t++,
    send: (i) => {
      sent.push(i)
      void controller.dispatch(i).then((v) => (view = v))
    },
    emit: (detail) => told.push(detail),
    focus: (instance) => focused.push(instance),
    onRecord: (r) => records.push(r),
  })
  controller = createController({ brain, flows: [flow, ...extra], clock: () => clock.t++, strings: CREATION_STRINGS, storage: rt.storage })
  return {
    rt,
    flow,
    sent,
    told,
    focused,
    controller,
    view: () => view,
    title: () => controller.getView().bubble?.title,
    text: () => controller.getView().bubble?.lines.map((l) => l.text).join(' ') ?? '',
    ev: async (e: Omit<HostEvent, 'at'>) => {
      view = await controller.dispatch({ type: 'hostEvent', event: { ...e, at: clock.t++ } as HostEvent })
    },
    /** A host event as mount.ts sends it: the runtime is told first (`sawEvent`), then the controller (T6.1: what separates a step done from a step passed). */
    seen: async (e: Omit<HostEvent, 'at'>) => {
      const full = { ...e, at: clock.t++ } as HostEvent
      rt.sawEvent(full)
      view = await controller.dispatch({ type: 'hostEvent', event: full })
    },
    init: async () => {
      await controller.dispatch({ type: 'setContext', context: { page: 'workbench', mode: 'practice' } })
    },
  }
}
const ask = (n: number, kind: TutorialRequest['kind'] = 'start', allowed = true): TutorialRequest => ({ n, kind, allowed })
/** `tekpractice:tutorial` as the runtime sends it (T3 close review S5: with `hasPowerSteps` and `powerAhead`). */
const D = (step: string | null, helperUnlocked = false, powerAhead = step !== null, hasPowerSteps = true): TutorialDetail => ({ step: step as TutorialDetail['step'], helperUnlocked, hasPowerSteps, powerAhead })
const step = (k: number, n = 10): string => `Parcours « Premiers pas » : étape ${k} sur ${n}.`

/** `sawEvent` reads an event's type and data, never its `at` (the order is the call order; T6 review N3): the stamp is a constant, not a made-up time. */
const unstamped = (e: object): HostEvent => ({ ...e, at: 0 }) as HostEvent

describe('the tutorial record (oscar-guide.onboarding.v1)', () => {
  it('parses only a well-formed record; tutorialInProgress reads a running one and is null otherwise or on a throwing storage', () => {
    expect(TUTORIAL_RECORD_KEY).toBe('oscar-guide.onboarding.v1')
    const ok = { v: 1, handledRequest: 2, step: 'micro', k: 2, n: 10, status: 'running', early: ['console'] }
    // T3.3 / T3.4 added `shown` and `helper`: a record written before them reads as empty / false
    // T6.1 added `passed` (the steps passed with « Passer cette étape »): a record written before it reads as empty (pinned assertion extended, see the ledger)
    expect(parseTutorialRecord(JSON.stringify(ok))).toEqual({ ...ok, shown: [], passed: [], helper: false })
    const full = { ...ok, shown: ['courant-console'], passed: ['micro'], helper: true }
    expect(parseTutorialRecord(JSON.stringify(full))).toEqual(full)
    for (const bad of ['', 'x', '[]', JSON.stringify({ ...ok, v: 2 }), JSON.stringify({ ...ok, status: 'won' }), JSON.stringify({ ...ok, handledRequest: -1 }), JSON.stringify({ ...ok, early: [1] }), JSON.stringify({ ...ok, shown: [1] }), JSON.stringify({ ...ok, passed: [1] }), JSON.stringify({ ...ok, helper: 'yes' })])
      expect(parseTutorialRecord(bad), bad).toBeNull()
    const s = new MemStorage()
    s.setItem(TUTORIAL_RECORD_KEY, JSON.stringify(ok))
    expect(tutorialInProgress(s)).toEqual({ k: 2, n: 10 })
    s.setItem(TUTORIAL_RECORD_KEY, JSON.stringify({ ...ok, status: 'done' }))
    expect(tutorialInProgress(s)).toBeNull()
    expect(tutorialInProgress(null)).toBeNull()
    expect(tutorialInProgress({ getItem: () => { throw new Error('blocked') } })).toBeNull()
  })
})

describe('start, persist, resume, skip', () => {
  it('a request above handledRequest starts premiers-pas once, at step 1; the same request again does nothing', async () => {
    const s = new MemStorage()
    const p = page(s)
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(0) })
    await flush()
    expect(p.sent).toEqual([])
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    expect(p.sent).toEqual([{ type: 'flow', control: { action: 'start', flowId: 'premiers-pas' } }])
    expect(p.title()).toBe(step(1))
    expect(parseTutorialRecord(s.getItem(TUTORIAL_RECORD_KEY))).toEqual({ v: 1, handledRequest: 1, step: 'console', k: 1, n: 10, status: 'running', early: [], shown: [], passed: [], helper: false })
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    expect(p.sent).toHaveLength(1)
  })

  it('nothing starts where the tutorial is not allowed, nor without a request reader', async () => {
    const p = page(new MemStorage())
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(3, 'start', false) })
    p.rt.update({ state: stateOf([]), audio: null, request: null })
    await flush()
    expect(p.sent).toEqual([])
  })

  it('each completion is recorded; a reload at step 6 has step 6 current again and does not re-handle the request', async () => {
    const s = new MemStorage()
    const p = page(s)
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    for (let i = 0; i < 5; i++) await p.controller.dispatch({ type: 'flow', control: { action: 'skip' } })
    expect(p.title()).toBe(step(6))
    expect(parseTutorialRecord(s.getItem(TUTORIAL_RECORD_KEY))).toMatchObject({ step: 'lecture-console', k: 6, status: 'running' })
    // reload: a new page on the same storage
    const q = page(s)
    await q.init()
    q.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    expect(q.sent).toEqual([])
    const v = await q.controller.dispatch({ type: 'chip', id: 'next' })
    expect(v.bubble?.title).toBe(step(6))
    expect(v.target?.anchor).toBe('control:suggest.playback')
    expect(tutorialInProgress(s)).toEqual({ k: 6, n: 10 })
  })

  it('finished: the record says done and a reload starts nothing', async () => {
    const s = new MemStorage()
    const p = page(s, packageById(5).pacing.steps)
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    await p.ev({ type: 'playStarted', data: { source: 'test' } })
    await p.ev({ type: 'disconnect', data: { a: 'x', b: 'y', pair: 'console-speaker' } })
    await p.ev({ type: 'connect', data: { a: 'x', b: 'y', pair: 'console-speaker', restored: true } }) // as annotated: it leaves every speaker fed (T6 review S2)
    expect(parseTutorialRecord(s.getItem(TUTORIAL_RECORD_KEY))).toMatchObject({ status: 'done', step: null })
    const q = page(s, packageById(5).pacing.steps)
    await q.init()
    q.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    expect(q.sent).toEqual([])
    expect(q.controller.getView().bubble).toBeNull()
  })

  it('skip stops the run and records skipped (no nag); a later start request starts again at step 1', async () => {
    const s = new MemStorage()
    const p = page(s)
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    await p.controller.dispatch({ type: 'flow', control: { action: 'skip' } })
    p.rt.update({ state: stateOf([]), audio: null, request: ask(2, 'skip') })
    await flush()
    expect(p.sent.at(-1)).toEqual({ type: 'flow', control: { action: 'stop' } })
    expect(parseTutorialRecord(s.getItem(TUTORIAL_RECORD_KEY))).toMatchObject({ status: 'skipped', handledRequest: 2, step: null })
    expect(tutorialInProgress(s)).toBeNull()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(3) })
    await flush()
    expect(p.title()).toBe(step(1))
  })

  it('a start request while it runs resumes (same step, its bubble shown); restart goes back to step 1', async () => {
    const s = new MemStorage()
    const p = page(s)
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    await p.controller.dispatch({ type: 'flow', control: { action: 'skip' } })
    await p.controller.dispatch({ type: 'chip', id: 'close' })
    p.rt.update({ state: stateOf([]), audio: null, request: ask(2) })
    await flush()
    expect(p.sent.at(-1)).toEqual({ type: 'chip', id: 'next' })
    expect(p.title()).toBe(step(2))
    p.rt.update({ state: stateOf([]), audio: null, request: ask(3, 'restart') })
    await flush()
    expect(p.title()).toBe(step(1))
    expect(parseTutorialRecord(s.getItem(TUTORIAL_RECORD_KEY))).toMatchObject({ k: 1, handledRequest: 3, early: [] })
  })

  it('blocked storage: the record lives in memory, the tutorial still starts; a corrupt record is replaced', async () => {
    const p = page(null)
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    expect(p.title()).toBe(step(1))
    expect(p.rt.record()).toMatchObject({ handledRequest: 1, k: 1, status: 'running' })
    const s = new MemStorage()
    s.setItem(TUTORIAL_RECORD_KEY, '{not json')
    const q = page(s)
    await q.init()
    q.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    expect(parseTutorialRecord(s.getItem(TUTORIAL_RECORD_KEY))).toMatchObject({ handledRequest: 1, status: 'running' })
  })
})

describe('déjà en place (G8 review C2)', () => {
  const Q: [string, string] = ['q', 'yamaha-ql1']
  const M: [string, string] = ['m', 'shure-sm58']
  const K: [string, string] = ['k', 'qsc-k12-2']
  const P: [string, string] = ['p', 'multiprise-secteur']

  it('steps whose result is on the bench are completed once each, and the next bubble says so; a real completion clears the note', async () => {
    const s = new MemStorage()
    const p = page(s)
    await p.init()
    p.rt.update({ state: stateOf([Q, M]), audio: null, request: ask(1) })
    await flush()
    await flush()
    expect(p.title()).toBe(step(3))
    const note = COPY.tutorial!.alreadyInPlace!.replace('{steps}', ['1', '2'].map((k) => COPY.tutorial!.alreadyStep!.replace('{k}', k)).join(', '))
    expect(note).toBe('Déjà en place : étape 1, étape 2.')
    expect(p.text()).toBe(`${note} ${COPY.tutorial!.enceinte}`)
    expect(parseTutorialRecord(s.getItem(TUTORIAL_RECORD_KEY))!.early).toEqual(['console', 'micro'])
    const early = p.sent.filter((i) => i.type === 'hostEvent')
    expect(early).toHaveLength(2)
    // the learner places the speaker: a real completion, step 4 has no note
    await p.ev({ type: 'deviceAdded', data: { device: 'device:k', role: 'speaker' } })
    p.rt.update({ state: stateOf([Q, M, K]), audio: null, request: ask(1) })
    await flush()
    expect(p.title()).toBe(step(4))
    expect(p.text()).toBe(COPY.tutorial!.consoleEnceinte)
    expect(p.sent.filter((i) => i.type === 'hostEvent')).toHaveLength(2)
  })

  it('« Lecture console » switched on during step 2 (the status bar asks for it) is « déjà en place » when step 6 comes', async () => {
    const p = page(new MemStorage())
    await p.init()
    const on = { q: { 'playback-usb': true } }
    p.rt.update({ state: stateOf([Q], [], on), audio: null, request: ask(1) })
    await flush()
    expect(p.title()).toBe(step(2))
    const out = { a: { instance: 'q', port: 'out-main-l' }, b: { instance: 'k', port: 'in-line-a' } }
    const mic = { a: { instance: 'm', port: 'out-xlr' }, b: { instance: 'q', port: 'in-mic-1' } }
    await p.ev({ type: 'deviceAdded', data: { device: 'device:m', role: 'mic' } })
    await p.ev({ type: 'deviceAdded', data: { device: 'device:k', role: 'speaker' } })
    await p.ev({ type: 'connect', data: { a: 'x', b: 'y', pair: 'console-speaker' } })
    await p.ev({ type: 'connect', data: { a: 'x', b: 'y', pair: 'mic-console' } })
    p.rt.update({ state: stateOf([Q, M, K], [out, mic], on), audio: null, request: ask(1) })
    await flush()
    expect(p.title()).toBe(step(7))
    expect(p.text().startsWith('Déjà en place : étape 6.')).toBe(true)
  })

  it('S6: the helper’s two mains cables in one poll, the speaker’s first: step 8 ends on the console cable, step 9 is déjà en place, step 10 is current', async () => {
    const p = page(new MemStorage())
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    for (let i = 0; i < 7; i++) await p.controller.dispatch({ type: 'flow', control: { action: 'skip' } })
    expect(p.title()).toBe(step(8))
    const pk = { a: { instance: 'p', port: 'out-2' }, b: { instance: 'k', port: 'power-in' } }
    const pq = { a: { instance: 'p', port: 'out-1' }, b: { instance: 'q', port: 'power-in' } }
    await p.ev({ type: 'connect', data: { a: 'x', b: 'y', pair: 'mains-speaker' } })
    await p.ev({ type: 'connect', data: { a: 'x', b: 'y', pair: 'mains-console' } })
    p.rt.update({ state: stateOf([Q, K, P], [pk, pq]), audio: null, request: ask(1) })
    await flush()
    expect(p.title()).toBe(step(10))
  })

  it('package 5: the test signal already playing when the tutorial starts completes « ecoute » (a second click could not fire playStarted)', async () => {
    const p = page(new MemStorage(), packageById(5).pacing.steps)
    await p.init()
    p.rt.update({ state: stateOf([Q, K]), audio: 'test', request: ask(1) })
    await flush()
    expect(p.title()).toBe(step(2, 3))
    // debrancher is event-only: the bench never completes it
    p.rt.update({ state: stateOf([Q, K]), audio: 'test', request: ask(1) })
    await flush()
    expect(p.title()).toBe(step(2, 3))
  })
})

describe('tekpractice:tutorial (plan T3.3): the run as Mode Création sees it, for the power helper’s gate', () => {
  it('start: the current step, helper locked; each step change once; skip or the end: no run (step null)', async () => {
    const s = new MemStorage()
    const p = page(s)
    await p.init()
    expect(p.told).toEqual([])
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    // first « no run » (the request is handled), then the run at step 1: a stale record on the creation side is corrected either way
    expect(p.told).toEqual([D(null), D('console')])
    await p.controller.dispatch({ type: 'flow', control: { action: 'skip' } })
    expect(p.told.at(-1)).toEqual(D('micro'))
    const n = p.told.length
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) }) // same request, same step: nothing new
    await flush()
    expect(p.told).toHaveLength(n)
    p.rt.update({ state: stateOf([]), audio: null, request: ask(2, 'skip') })
    await flush()
    expect(p.told.at(-1)).toEqual(D(null))
  })
})

// ── T3.4: Oscar's third tier unlocks the helper; the steps the helper did are « montré » ───────────────────────────────────────
// T3 close review S2 / S3: the helper's state comes through the bridge (`helper`: offered now, uses on this page), never through storage.
import type { PowerHelperReading } from '../../src/design/powerHelperUse'

const OFFERED: PowerHelperReading = { offered: true, n: 0, instances: [] }
const used = (n: number, instances: string[]): PowerHelperReading => ({ offered: false, n, instances })

describe('T3.4: the escalation to the power helper', () => {
  const Q: [string, string] = ['q', 'yamaha-ql1']
  const K: [string, string] = ['k', 'qsc-k12-2']
  const P: [string, string] = ['p', 'multiprise-secteur']
  const pq = { a: { instance: 'p', port: 'out-1' }, b: { instance: 'q', port: 'power-in' } }
  const pk = { a: { instance: 'p', port: 'out-2' }, b: { instance: 'k', port: 'power-in' } }
  const offer = COPY.tutorial!.helperOffer!

  /** Started on an empty bench, « Passer cette étape » to step 8, then the bench is what the caller says (nothing of it completes step 8). */
  async function atStep8(bench: TpState, s: MemStorage | null = new MemStorage(), helper: PowerHelperReading | null = OFFERED) {
    const p = page(s)
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1), helper })
    await flush()
    for (let i = 0; i < 7; i++) await p.controller.dispatch({ type: 'flow', control: { action: 'skip' } })
    p.rt.update({ state: bench, audio: null, request: ask(1), helper })
    await flush()
    expect(p.title()).toBe(step(8))
    return { p, s }
  }
  const unlocked = (p: ReturnType<typeof page>) => p.rt.record().helper

  it('does not trigger before tier 3: « Un indice de plus » twice (tiers 1 and 2) leaves the helper locked', async () => {
    const { p } = await atStep8(stateOf([Q, K, P]))
    await p.controller.dispatch({ type: 'chip', id: 'hint' })
    await p.controller.dispatch({ type: 'chip', id: 'hint' })
    await flush()
    expect(unlocked(p)).toBe(false)
    expect(p.told.at(-1)).toEqual(D('courant-console'))
  })

  it('does not trigger while the helper is not offered (no strip: step 7 passed without placing one), even at tier 3; triggers once it is offered', async () => {
    const { p } = await atStep8(stateOf([Q, K]), new MemStorage(), { ...OFFERED, offered: false })
    await p.controller.dispatch({ type: 'chip', id: 'show' }) // « Montre-moi »: tier 3 at once
    await flush()
    expect(unlocked(p)).toBe(false)
    p.rt.update({ state: stateOf([Q, K, P]), audio: null, request: ask(1), helper: OFFERED })
    await flush()
    expect(unlocked(p)).toBe(true)
  })

  it('triggers at tier 3 (« Un indice de plus » a third time): unlocked, told to Mode Création, the step’s bubble shown again with the offer', async () => {
    const s = new MemStorage()
    const { p } = await atStep8(stateOf([Q, K, P]), s)
    for (let i = 0; i < 3; i++) await p.controller.dispatch({ type: 'chip', id: 'hint' })
    await flush()
    await flush()
    expect(unlocked(p)).toBe(true)
    expect(parseTutorialRecord(s.getItem(TUTORIAL_RECORD_KEY))).toMatchObject({ helper: true, step: 'courant-console' })
    expect(p.told.at(-1)).toEqual(D('courant-console', true))
    expect(p.sent.at(-1)).toEqual({ type: 'chip', id: 'next' })
    expect(p.text()).toBe(`${COPY.tutorial!.courantConsole} ${offer}`)
    expect(p.controller.getView().target?.anchor).toBe('nav:connect.from.mains-console') // the mount resolves it to the helper (tutorial.test.ts)
  })

  it('tier 3 on a step that is not a power step does not trigger', async () => {
    const p = page(new MemStorage())
    await p.init()
    p.rt.update({ state: stateOf([P]), audio: null, request: ask(1), helper: OFFERED })
    await flush()
    await p.controller.dispatch({ type: 'chip', id: 'show' })
    await flush()
    expect(unlocked(p)).toBe(false)
  })

  it('by Oscar alone (package 1 pacing, no bubble open: here after a reload at step 8): after hintAfterMs it says, then points, then the third tier unlocks', async () => {
    // Verified in the vendored controller: a proactive hint never replaces a bubble the learner opened, nor shows after « Fermer » (`proactiveAllowed`);
    // a reload restores the run with no bubble, the case where Oscar escalates alone.
    const s = new MemStorage()
    await atStep8(stateOf([Q, K, P]), s)
    const clock = { t: 1 }
    const flow = premiersPasFlow(registry, packageById(1).pacing.steps, packageById(1).pacing.hintAfterMs)
    const told: TutorialDetail[] = []
    // eslint-disable-next-line prefer-const
    let controller: ReturnType<typeof createController>
    const rt = createTutorialRuntime({ flow, registry, storage: s, now: () => clock.t, send: (i) => void controller.dispatch(i), emit: (d) => told.push(d) })
    controller = createController({ brain, flows: [flow], clock: () => clock.t, strings: CREATION_STRINGS, storage: rt.storage })
    await controller.dispatch({ type: 'setContext', context: { page: 'workbench', mode: 'practice' } })
    rt.update({ state: stateOf([Q, K, P]), audio: null, request: ask(1), helper: OFFERED })
    await flush()
    expect(rt.record()).toMatchObject({ status: 'running', step: 'courant-console', helper: false })
    const tick = async (ms: number) => {
      clock.t += ms
      await controller.dispatch({ type: 'tick' })
      await flush()
    }
    await tick(19_000)
    expect(controller.getView().bubble).toBeNull() // before hintAfterMs: nothing
    await tick(2_000)
    expect(controller.getView().bubble?.lines.map((l) => l.text).join(' ')).toContain(COPY.tutorial!.courantConsole) // tier 1: says
    expect(controller.getView().target).toBeNull()
    expect(rt.record().helper).toBe(false)
    await tick(46_000) // tier 2: points
    expect(controller.getView().target?.anchor).toBe('nav:connect.from.mains-console')
    expect(rt.record().helper).toBe(false)
    await tick(46_000) // tier 3
    await flush()
    expect(rt.record().helper).toBe(true)
    expect(told.at(-1)).toEqual(D('courant-console', true))
    expect(controller.getView().bubble?.lines.map((l) => l.text).join(' ')).toContain(COPY.tutorial!.helperOffer)
  })

  for (const order of ['console first', 'speaker first'] as const) {
    it(`helper-done steps (${order}, one poll): « montré » (shown), never « déjà en place », no celebration; step 10 is current`, async () => {
      const s = new MemStorage()
      const { p } = await atStep8(stateOf([Q, K, P]), s)
      await p.controller.dispatch({ type: 'chip', id: 'show' })
      await flush()
      expect(unlocked(p)).toBe(true)
      // Mode Création: the helper cabled both (its use count goes up), then the bridge's one poll brings both connect events in design order
      const pairs = order === 'console first' ? ['mains-console', 'mains-speaker'] : ['mains-speaker', 'mains-console']
      for (const pair of pairs) await p.ev({ type: 'connect', data: { a: 'x', b: 'y', pair, fed: true } })
      p.rt.update({ state: stateOf([Q, K, P], order === 'console first' ? [pq, pk] : [pk, pq]), audio: null, request: ask(1), helper: used(1, ['q', 'k']) })
      await flush()
      await flush()
      expect(p.title()).toBe(step(10))
      const rec = parseTutorialRecord(s.getItem(TUTORIAL_RECORD_KEY))!
      expect(rec.shown).toEqual(['courant-console', 'courant-enceinte'])
      expect(rec.early).toEqual([])
      expect(p.text()).not.toContain('Déjà en place')
      expect(p.controller.getView().bubble?.kind).not.toBe('celebrate')
    })
  }

  it('cabled by hand (no use of the helper): a real completion, not « montré » (does not trigger)', async () => {
    const s = new MemStorage()
    const { p } = await atStep8(stateOf([Q, K, P]), s)
    await p.ev({ type: 'connect', data: { a: 'x', b: 'y', pair: 'mains-console', fed: true } })
    p.rt.update({ state: stateOf([Q, K, P], [pq]), audio: null, request: ask(1), helper: OFFERED })
    await flush()
    expect(p.title()).toBe(step(9))
    expect(parseTutorialRecord(s.getItem(TUTORIAL_RECORD_KEY))!.shown).toEqual([])
  })

  it('a use of the helper before the guide’s first look is not this run’s; restart clears helper and shown', async () => {
    const s = new MemStorage()
    const { p } = await atStep8(stateOf([Q, K, P]), s, used(1, ['q', 'k']))
    await p.ev({ type: 'connect', data: { a: 'x', b: 'y', pair: 'mains-console', fed: true } })
    p.rt.update({ state: stateOf([Q, K, P], [pq]), audio: null, request: ask(1), helper: { ...used(1, ['q', 'k']), offered: true } })
    await flush()
    expect(parseTutorialRecord(s.getItem(TUTORIAL_RECORD_KEY))!.shown).toEqual([])
    await p.controller.dispatch({ type: 'chip', id: 'show' })
    await flush()
    p.rt.update({ state: stateOf([Q, K, P], [pq]), audio: null, request: ask(2, 'restart'), helper: OFFERED })
    await flush()
    expect(p.rt.record()).toMatchObject({ helper: false, shown: [] }) // (the bench then completes steps 1, 3 and 7 again: « déjà en place »)
  })
})

// ── T3 close review (C1, C2, S2 to S5, N4) ────────────────────────────────────────────────────────────────────────────────
import { CREATION_FLOWS } from '../../src/guide/flows.creation'
import { annotateTutorialEvent } from '../../src/guide/tutorial'

describe('T3 close review: the runtime', () => {
  const Q: [string, string] = ['q', 'yamaha-ql1']
  const K: [string, string] = ['k', 'qsc-k12-2']
  const P: [string, string] = ['p', 'multiprise-secteur']
  const pq = { a: { instance: 'p', port: 'out-1' }, b: { instance: 'q', port: 'power-in' } }
  const pk = { a: { instance: 'p', port: 'out-2' }, b: { instance: 'k', port: 'power-in' } }
  const skipTo = async (p: ReturnType<typeof page>, k: number) => {
    for (let i = 1; i < k; i++) await p.controller.dispatch({ type: 'flow', control: { action: 'skip' } })
  }

  it('C1: two speakers, the audio on #2: plugging #1 in does not end step 9 (by event nor by bench); plugging #2 in does', async () => {
    const K1: [string, string] = ['k1', 'qsc-k12-2']
    const K2: [string, string] = ['k2', 'qsc-k12-2']
    const audio2 = { a: { instance: 'q', port: 'out-main-l' }, b: { instance: 'k2', port: 'in-line-a' } }
    const p1 = { a: { instance: 'p', port: 'out-2' }, b: { instance: 'k1', port: 'power-in' } }
    const p2 = { a: { instance: 'p', port: 'out-3' }, b: { instance: 'k2', port: 'power-in' } }
    const anchors = { anchorOfDevice: (id: string) => `device:${id}`, anchorOfPort: (r: { instance: string; port: string }) => `port:${r.instance}.${r.port}`, anchorOfControl: (i: string, c: string) => `control:${i}.${c}` }
    const connectEvent = (c: typeof p1, state: TpState) =>
      annotateTutorialEvent({ type: 'connect', at: 1, data: { a: anchors.anchorOfPort(c.a), b: anchors.anchorOfPort(c.b) } }, { state, prev: state, bridge: anchors, registry })
    const p = page(new MemStorage())
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    await skipTo(p, 9)
    const bench = stateOf([Q, K1, K2, P], [audio2, pq])
    p.rt.update({ state: bench, audio: null, request: ask(1) })
    await flush()
    expect(p.title()).toBe(step(9))
    const one = stateOf([Q, K1, K2, P], [audio2, pq, p1])
    await p.ev(connectEvent(p1, one))
    p.rt.update({ state: one, audio: null, request: ask(1) })
    await flush()
    expect(p.title()).toBe(step(9)) // the wrong speaker: still step 9
    const both = stateOf([Q, K1, K2, P], [audio2, pq, p1, p2])
    await p.ev(connectEvent(p2, both))
    expect(p.title()).toBe(step(10))
  })

  it('C2: another flow started mid-run (a question to Oscar): the record goes idle, Aide reads « Premiers pas », the gate opens; early/shown/helper kept until a genuine start clears them', async () => {
    const s = new MemStorage()
    const p = page(s, packageById(1).pacing.steps, [CREATION_FLOWS[0]])
    await p.init()
    p.rt.update({ state: stateOf([Q]), audio: null, request: ask(1), helper: OFFERED })
    await flush()
    await flush()
    expect(p.title()).toBe(step(2))
    expect(p.rt.record()).toMatchObject({ status: 'running', k: 2, early: ['console'] })
    await p.controller.dispatch({ type: 'flow', control: { action: 'start', flowId: 'premier-montage' } })
    await flush()
    expect(parseTutorialRecord(s.getItem(TUTORIAL_RECORD_KEY))).toMatchObject({ status: 'idle', step: null, k: 0, early: ['console'] })
    expect(tutorialInProgress(s)).toBeNull() // Aide: « Premiers pas », not « Reprendre à l’étape 2 »
    expect(p.told.at(-1)).toEqual(D(null)) // the helper's gate opens
    // « Premiers pas »: a genuine start, at step 1, with the old notes cleared
    p.rt.update({ state: stateOf([]), audio: null, request: ask(2), helper: OFFERED })
    await flush()
    expect(p.title()).toBe(step(1))
    expect(p.rt.record()).toMatchObject({ status: 'running', k: 1, early: [], shown: [], helper: false })
  })

  it('S2: blocked storage: the helper’s two cables end steps 8 and 9 « montré » (never a success, never « déjà en place ») through the bridge’s use count', async () => {
    const p = page(null)
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1), helper: OFFERED })
    await flush()
    await skipTo(p, 8)
    p.rt.update({ state: stateOf([Q, K, P]), audio: null, request: ask(1), helper: OFFERED })
    await flush()
    await p.controller.dispatch({ type: 'chip', id: 'show' })
    await flush()
    expect(p.rt.record().helper).toBe(true)
    await p.ev({ type: 'connect', data: { a: 'x', b: 'y', pair: 'mains-console', fed: true } })
    await p.ev({ type: 'connect', data: { a: 'x', b: 'y', pair: 'mains-speaker', fed: true } })
    p.rt.update({ state: stateOf([Q, K, P], [pq, pk]), audio: null, request: ask(1), helper: used(1, ['q', 'k']) })
    await flush()
    await flush()
    expect(p.title()).toBe(step(10))
    expect(p.rt.record()).toMatchObject({ shown: ['courant-console', 'courant-enceinte'], early: [] })
    expect(p.text()).not.toContain('Déjà en place')
  })

  it('S3: tier 3 with a strip on the bench but the helper not offered (strip full, speaker on a Bêta outlet): no unlock, no offer said; offered again: unlocked', async () => {
    const p = page(new MemStorage())
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    await skipTo(p, 8)
    const notOffered = { ...OFFERED, offered: false }
    p.rt.update({ state: stateOf([Q, K, P]), audio: null, request: ask(1), helper: notOffered })
    await flush()
    await p.controller.dispatch({ type: 'chip', id: 'show' })
    await flush()
    expect(p.rt.record().helper).toBe(false)
    expect(p.text()).not.toContain(COPY.tutorial!.helperOffer)
    expect(p.told.at(-1)).toEqual(D('courant-console'))
    p.rt.update({ state: stateOf([Q, K, P]), audio: null, request: ask(1) }) // no reader at all: never offered
    await flush()
    expect(p.rt.record().helper).toBe(false)
    p.rt.update({ state: stateOf([Q, K, P]), audio: null, request: ask(1), helper: OFFERED })
    await flush()
    expect(p.rt.record().helper).toBe(true)
  })

  it('S4: « Écoute » current while the bench cannot play: its sentence adds the checklist hint (by key); once the bench can play, the plain sentence', async () => {
    const p = page(new MemStorage())
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    await skipTo(p, 10)
    expect(p.title()).toBe(step(10))
    p.rt.update({ state: { ...stateOf([Q, K]), playbackReady: false }, audio: null, request: ask(1) })
    expect(p.flow.steps[9].say).toBe(`${COPY.tutorial!.ecoute} ${COPY.checklist!.menuHint}`)
    p.rt.update({ state: { ...stateOf([Q, K]), playbackReady: true }, audio: null, request: ask(1) })
    expect(p.flow.steps[9].say).toBe(COPY.tutorial!.ecoute)
  })

  it('W1 (G14c fix): `look` gives the runtime the new bench BEFORE the change\'s events reach the controller, so the next step\'s bubble is rendered from it (no stale checklist hint at step 10)', async () => {
    const p = page(new MemStorage())
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    await skipTo(p, 9)
    // step 9 current, the bench cannot play yet (the speaker's mains cable is missing)
    p.rt.update({ state: { ...stateOf([Q, K]), playbackReady: false }, audio: null, request: ask(1) })
    expect(p.flow.steps[9].say).toBe(`${COPY.tutorial!.ecoute} ${COPY.checklist!.menuHint}`)
    // the cable lands: mount.ts tells the runtime the new bench first (look), then sends the event that ends step 9
    p.rt.look({ state: { ...stateOf([Q, K]), playbackReady: true }, audio: null })
    expect(p.flow.steps[9].say).toBe(COPY.tutorial!.ecoute)
    await p.seen({ type: 'connect', data: { pair: 'mains-speaker', fed: true } })
    expect(p.title()).toBe(step(10))
    expect(p.text()).toContain(COPY.tutorial!.ecoute)
    expect(p.text()).not.toContain(COPY.checklist!.menuHint!)
    // `look` never acts: no request handled, nothing sent
    const sent = p.sent.length
    p.rt.look({ state: stateOf([]), audio: null })
    await flush()
    expect(p.sent.length).toBe(sent)
  })

  it('G14c fix (b): the runtime names the device the current step points at (`focus`), on each change only: the console at steps 4, 6 and 8, the mic at step 5, the speaker at step 9, none on a placement or Écoute step', async () => {
    const S: [string, string] = ['s', 'shure-sm58']
    const bench = stateOf([Q, K, S, P])
    const p = page(new MemStorage())
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    expect(p.focused).toEqual([null]) // step 1 (a placement): no device
    const at = async (k: number): Promise<string | null> => {
      await skipTo(p, k)
      p.rt.update({ state: bench, audio: null, request: ask(1) })
      await flush()
      return p.focused.at(-1) ?? null
    }
    expect(await at(4)).toBe('q') // console-enceinte: from the console
    expect(await at(2)).toBe('s') // step 5, micro-console: from the mic
    expect(await at(2)).toBe('q') // step 6, lecture-console: the console (skipTo moves on from the current step)
    // step 7 (the strip) is already on this bench: it completes at once (« déjà en place ») and step 8 points at the console's mains inlet
    expect(await at(2)).toBe('q')
    expect(p.rt.record().k).toBe(8)
    expect(await at(2)).toBe('k') // step 9, courant-enceinte: from the speaker's mains inlet
    const n = p.focused.length
    p.rt.update({ state: bench, audio: null, request: ask(1) }) // the same step, the same bench: nothing new told
    await flush()
    expect(p.focused.length).toBe(n)
  })

  it('S5: the detail says whether the run has a power step and whether one is still ahead (step 10: none ahead; package 5 data: none at all)', async () => {
    const p = page(new MemStorage())
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    expect(p.told.at(-1)).toEqual({ step: 'console', helperUnlocked: false, hasPowerSteps: true, powerAhead: true })
    await skipTo(p, 9)
    expect(p.told.at(-1)).toEqual({ step: 'courant-enceinte', helperUnlocked: false, hasPowerSteps: true, powerAhead: true })
    await skipTo(p, 2)
    expect(p.told.at(-1)).toEqual({ step: 'ecoute', helperUnlocked: false, hasPowerSteps: true, powerAhead: false })
    const q = page(new MemStorage(), packageById(5).pacing.steps)
    await q.init()
    q.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    expect(q.told.at(-1)).toEqual({ step: 'ecoute', helperUnlocked: false, hasPowerSteps: false, powerAhead: false })
  })

  it('N4: a lost or corrupt guide record never starts the tutorial on an old request by itself; a request raised on this page still does', async () => {
    const s = new MemStorage()
    s.setItem(TUTORIAL_RECORD_KEY, '{not json')
    const p = page(s)
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: { ...ask(3), atLoad: 3 } })
    await flush()
    expect(p.sent).toEqual([])
    p.rt.update({ state: stateOf([]), audio: null, request: { ...ask(4), atLoad: 3 } }) // « Premiers pas » on this page
    await flush()
    expect(p.title()).toBe(step(1))
    // lost (no record at all), the creation counter already at 2 when the page loaded: nothing by itself
    const q = page(new MemStorage())
    await q.init()
    q.rt.update({ state: stateOf([]), audio: null, request: { ...ask(2), atLoad: 2 } })
    await flush()
    expect(q.sent).toEqual([])
    // a known record: a request it has not handled yet is acted on, whatever the page load saw (a reload before the guide's poll)
    const r = new MemStorage()
    r.setItem(TUTORIAL_RECORD_KEY, JSON.stringify({ v: 1, handledRequest: 1, step: null, k: 0, n: 10, status: 'idle', early: [] }))
    const w = page(r)
    await w.init()
    w.rt.update({ state: stateOf([]), audio: null, request: { ...ask(2), atLoad: 2 } })
    await flush()
    expect(w.title()).toBe(step(1))
  })
})

// ── T6.1: what the step card reads: passed steps, the card's own skip, the record changes ───────────────────────────────────────
describe('T6.1: a step PASSED is told from a step done (the marks the card reads; see S1 below for the events that count)', () => {
  const TEN = packageById(1).pacing.steps
  const started = async (s = new MemStorage(), records: TutorialRecord[] = []) => {
    const p = page(s, TEN, [], records)
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    return p
  }
  const q = { type: 'deviceAdded', data: { device: 'device:q', role: 'source-console' } }
  const mic = { type: 'deviceAdded', data: { device: 'device:m', role: 'mic' } }

  it('a step the learner passes (no event of that step) is recorded « passed »; a step ended by its own event is not (triggers / does not trigger)', async () => {
    const p = await started()
    await p.seen(q)
    expect(p.rt.record()).toMatchObject({ k: 2, passed: [] })
    await p.controller.dispatch({ type: 'flow', control: { action: 'skip' } })
    expect(p.rt.record()).toMatchObject({ k: 3, passed: ['micro'] })
    await p.seen({ type: 'deviceAdded', data: { device: 'device:k', role: 'speaker' } })
    expect(p.rt.record()).toMatchObject({ k: 4, passed: ['micro'] })
  })

  it('the record on storage says it too (a reload keeps the marks)', async () => {
    const s = new MemStorage()
    const p = await started(s)
    await p.controller.dispatch({ type: 'flow', control: { action: 'skip' } })
    expect(parseTutorialRecord(s.getItem(TUTORIAL_RECORD_KEY))).toMatchObject({ passed: ['console'] })
    const again = page(s)
    expect(again.rt.record().passed).toEqual(['console'])
  })

  it('a passed step done afterwards (back, then its event) is not « passed » any more', async () => {
    const p = await started()
    await p.controller.dispatch({ type: 'flow', control: { action: 'skip' } })
    expect(p.rt.record().passed).toEqual(['console'])
    await p.controller.dispatch({ type: 'flow', control: { action: 'back' } })
    await p.seen(q)
    expect(p.rt.record()).toMatchObject({ k: 2, passed: [] })
  })

  it('an event that belongs to another step (the mic placed during step 1) does not make a later skip of that step look done', async () => {
    const p = await started()
    await p.seen(mic) // not the current step: no advance
    expect(p.rt.record()).toMatchObject({ k: 1 })
    await p.controller.dispatch({ type: 'flow', control: { action: 'skip' } }) // step 1 passed (its own event never came)
    expect(p.rt.record().passed).toEqual(['console'])
  })

  it('steps found already done are « déjà en place », never passed', async () => {
    const p = page(new MemStorage(), TEN)
    await p.init()
    p.rt.update({ state: stateOf([['q', 'yamaha-ql1'], ['m', 'shure-sm58']]), audio: null, request: ask(1) })
    await flush()
    await flush()
    expect(p.rt.record()).toMatchObject({ early: ['console', 'micro'], passed: [] })
  })

  it('S6 burst: two mains cables in one poll (the speaker’s first) end step 8 by its event and step 9 « déjà en place »: neither is passed', async () => {
    const p = await started()
    for (let i = 0; i < 7; i++) await p.controller.dispatch({ type: 'flow', control: { action: 'skip' } })
    expect(p.rt.record().passed).toHaveLength(7)
    const spk = { type: 'connect', data: { a: 'x', b: 'y', pair: 'mains-speaker', fed: true } }
    const con = { type: 'connect', data: { a: 'x', b: 'y', pair: 'mains-console', fed: true } }
    p.rt.sawEvent(unstamped(spk))
    p.rt.sawEvent(unstamped(con))
    await p.ev(spk)
    await p.ev(con)
    const pk = { a: { instance: 'p', port: 'out-2' }, b: { instance: 'k', port: 'power-in' } }
    const pq = { a: { instance: 'p', port: 'out-1' }, b: { instance: 'q', port: 'power-in' } }
    p.rt.update({ state: stateOf([['q', 'yamaha-ql1'], ['k', 'qsc-k12-2'], ['p', 'multiprise-secteur']], [pk, pq]), audio: null, request: ask(1) })
    await flush()
    const r = p.rt.record()
    expect(r.step).toBe('ecoute')
    expect(r.passed).not.toContain('courant-console')
    expect(r.passed).not.toContain('courant-enceinte')
    expect(r.early).toContain('courant-enceinte')
  })

  it('a restart clears every mark', async () => {
    const p = await started()
    await p.controller.dispatch({ type: 'flow', control: { action: 'skip' } })
    expect(p.rt.record().passed).toEqual(['console'])
    p.rt.update({ state: stateOf([]), audio: null, request: ask(2, 'restart') })
    await flush()
    expect(p.rt.record()).toMatchObject({ k: 1, passed: [], early: [], shown: [] })
  })
})

describe('T6.1: skip() is the card’s « Passer le tutoriel »', () => {
  it('stops the run, records skipped (no step, no helper), keeps handledRequest, and nothing restarts by itself', async () => {
    const s = new MemStorage()
    const p = page(s)
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    p.rt.skip()
    await flush()
    expect(p.sent.at(-1)).toEqual({ type: 'flow', control: { action: 'stop' } })
    expect(parseTutorialRecord(s.getItem(TUTORIAL_RECORD_KEY))).toMatchObject({ status: 'skipped', step: null, k: 0, helper: false, handledRequest: 1 })
    expect(tutorialInProgress(s)).toBeNull()
    expect(p.told.at(-1)).toEqual(D(null))
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    expect(p.rt.record().status).toBe('skipped')
  })

  it('does not trigger when no tutorial runs: nothing is sent, nothing is written', async () => {
    const s = new MemStorage()
    const p = page(s)
    await p.init()
    p.rt.skip()
    await flush()
    expect(p.sent).toEqual([])
    expect(s.getItem(TUTORIAL_RECORD_KEY)).toBeNull()
  })
})

describe('T6.1: onRecord tells the card on every change of the record', () => {
  it('a copy of the record at the start and at each step; changing the copy changes nothing', async () => {
    const seen: TutorialRecord[] = []
    const p = page(new MemStorage(), packageById(1).pacing.steps, [], seen)
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    expect(seen.at(-1)).toMatchObject({ status: 'running', k: 1 })
    seen.at(-1)!.early.push('console')
    expect(p.rt.record().early).toEqual([])
    await p.controller.dispatch({ type: 'flow', control: { action: 'skip' } })
    expect(seen.at(-1)).toMatchObject({ status: 'running', k: 2, passed: ['console'] })
  })

  it('a callback that throws never stops the tutorial', async () => {
    const bad = {
      push: () => {
        throw new Error('the page’s card failed')
      },
    } as unknown as TutorialRecord[]
    const p = page(new MemStorage(), packageById(1).pacing.steps, [], bad)
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    expect(p.title()).toBe(step(1))
  })
})

// ── T6a review S1 and N3: an event for a LATER step never turns a skip into a tick ──────────────────────────────────────────────
describe('S1 (T6a review): a step is DONE only by an event seen while it, or a chain of steps leading to it, was current', () => {
  const TEN = packageById(1).pacing.steps
  const started = async () => {
    const p = page(new MemStorage(), TEN)
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    return p
  }
  const skip = (p: Awaited<ReturnType<typeof started>>) => p.controller.dispatch({ type: 'flow', control: { action: 'skip' } })
  const console_ = { type: 'deviceAdded', data: { device: 'device:q', role: 'source-console' } }
  const speaker = { type: 'deviceAdded', data: { device: 'device:k', role: 'speaker' } }

  it('the reviewer’s repro: the speaker is spawned while step 2 is current, then removed; steps 2 and 3 are skipped within the window: step 3 reads « passée », not done', async () => {
    const p = await started()
    await p.seen(console_) // step 1 done -> step 2 (micro) current
    await p.seen(speaker) // the event of step 3, seen while step 2 is current: no advance
    expect(p.rt.record()).toMatchObject({ k: 2 })
    await skip(p) // step 2 passed
    await skip(p) // step 3 passed: the speaker is long gone, only its stale event is buffered
    expect(p.rt.record()).toMatchObject({ k: 4, passed: ['micro', 'enceinte'] })
  })

  it('same with a cable connected then removed (connect console-speaker is the event of step 4, seen while step 3 is current)', async () => {
    const p = await started()
    await p.seen(console_)
    await skip(p) // 2 passed
    await p.seen({ type: 'connect', data: { a: 'x', b: 'y', pair: 'console-speaker' } }) // step 4's event while step 3 is current
    await skip(p) // 3 passed
    await skip(p) // 4 passed: its cable was removed again
    expect(p.rt.record().passed).toEqual(['micro', 'enceinte', 'console-enceinte'])
  })

  it('does not trigger: the burst of one poll still counts (step 8 then 9 sent together, the speaker’s first, both ended by their events)', async () => {
    const p = await started()
    for (let i = 0; i < 7; i++) await skip(p)
    const spk = { type: 'connect', data: { a: 'x', b: 'y', pair: 'mains-speaker', fed: true } }
    const con = { type: 'connect', data: { a: 'x', b: 'y', pair: 'mains-console', fed: true } }
    // the controller takes the console cable first this time: step 8 ends, then the speaker's cable (already sent) ends step 9
    p.rt.sawEvent(unstamped(con))
    p.rt.sawEvent(unstamped(spk))
    await p.ev(con)
    await p.ev(spk)
    expect(p.rt.record()).toMatchObject({ step: 'ecoute', k: 10 })
    expect(p.rt.record().passed).not.toContain('courant-console')
    expect(p.rt.record().passed).not.toContain('courant-enceinte')
  })

  it('does not trigger: an ordinary completion (its own event while it is current) is done, and an event from the window before is not needed', async () => {
    const p = await started()
    await p.seen(console_)
    await p.seen({ type: 'deviceAdded', data: { device: 'device:m', role: 'mic' } })
    await p.seen(speaker)
    expect(p.rt.record()).toMatchObject({ k: 4, passed: [] })
  })
})

describe('N3 (T6a review): a restart the controller does by itself (not through the runtime) clears the marks', () => {
  it('going back to step 1 from a later step drops early, shown, passed and the helper unlock', async () => {
    const p = page(new MemStorage(), packageById(1).pacing.steps)
    await p.init()
    p.rt.update({ state: stateOf([]), audio: null, request: ask(1) })
    await flush()
    await p.controller.dispatch({ type: 'flow', control: { action: 'skip' } })
    await p.controller.dispatch({ type: 'flow', control: { action: 'skip' } })
    expect(p.rt.record().passed).toEqual(['console', 'micro'])
    await p.controller.dispatch({ type: 'flow', control: { action: 'restart' } })
    expect(p.rt.record()).toMatchObject({ k: 1, early: [], shown: [], passed: [], helper: false })
  })
})
