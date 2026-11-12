// The tutorial at run time (plan T3.2, G8 review C2): start / resume / restart / skip on the onboarding request, the guide's record
// `oscar-guide.onboarding.v1`, a reload mid-way, and steps whose result is already on the bench (« déjà en place »). Real vendored controller, no DOM.
import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { COPY } from '../../src/creation/copy'
import { packageById } from '../../src/design/packages'
import { TUTORIAL_RECORD_KEY, parseTutorialRecord, tutorialInProgress } from '../../src/design/tutorialRecord'
import type { TpState } from '../../src/guide/bridge/types'
import { CREATION_STRINGS, premiersPasFlow } from '../../src/guide/flows.creation'
import { createTutorialRuntime, type TutorialRequest } from '../../src/guide/tutorial'
import { createController } from '../../src/guide/vendor/core/controller'
import type { GuideBrain } from '../../src/guide/vendor/core/brain'
import type { ControllerInput, GuideView, HostEvent } from '../../src/guide/vendor/core/types'

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
function page(storage: MemStorage | null, pacing = packageById(1).pacing.steps) {
  const clock = { t: 1 }
  const flow = premiersPasFlow(registry, pacing)
  const sent: ControllerInput[] = []
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
  })
  controller = createController({ brain, flows: [flow], clock: () => clock.t++, strings: CREATION_STRINGS, storage: rt.storage })
  return {
    rt,
    flow,
    sent,
    controller,
    view: () => view,
    title: () => controller.getView().bubble?.title,
    text: () => controller.getView().bubble?.lines.map((l) => l.text).join(' ') ?? '',
    ev: async (e: Omit<HostEvent, 'at'>) => {
      view = await controller.dispatch({ type: 'hostEvent', event: { ...e, at: clock.t++ } as HostEvent })
    },
    init: async () => {
      await controller.dispatch({ type: 'setContext', context: { page: 'workbench', mode: 'practice' } })
    },
  }
}
const ask = (n: number, kind: TutorialRequest['kind'] = 'start', allowed = true): TutorialRequest => ({ n, kind, allowed })
const step = (k: number, n = 10): string => `Parcours « Premiers pas » : étape ${k} sur ${n}.`

describe('the tutorial record (oscar-guide.onboarding.v1)', () => {
  it('parses only a well-formed record; tutorialInProgress reads a running one and is null otherwise or on a throwing storage', () => {
    expect(TUTORIAL_RECORD_KEY).toBe('oscar-guide.onboarding.v1')
    const ok = { v: 1, handledRequest: 2, step: 'micro', k: 2, n: 10, status: 'running', early: ['console'] }
    expect(parseTutorialRecord(JSON.stringify(ok))).toEqual(ok)
    for (const bad of ['', 'x', '[]', JSON.stringify({ ...ok, v: 2 }), JSON.stringify({ ...ok, status: 'won' }), JSON.stringify({ ...ok, handledRequest: -1 }), JSON.stringify({ ...ok, early: [1] })])
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
    expect(parseTutorialRecord(s.getItem(TUTORIAL_RECORD_KEY))).toEqual({ v: 1, handledRequest: 1, step: 'console', k: 1, n: 10, status: 'running', early: [] })
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
    await p.ev({ type: 'connect', data: { a: 'x', b: 'y', pair: 'console-speaker' } })
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
