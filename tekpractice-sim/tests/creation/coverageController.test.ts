/**
 * Task 37 fix round 1: the coverage controller's LIFECYCLE with a fake worker, a fake layer, a fake panel and a fake host (no DOM, no Babylon scene):
 * toggle on = one job; a rig change = one job after the debounce (none when no speaker changed); a place change terminates the worker and disposes
 * the layer, and a late answer for the old place is ignored; toggle off leaves nothing; folding Propriétés hides the layer without a job; the pin
 * obeys the shell's `canPin` gate; no audience = no job and no aim line. The real layer is covered by the e2e (meshes, draw calls).
 */
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Scene } from '@babylonjs/core'
import { DisposableBag } from '../../src/util/disposable'
import type { MessagePortLike } from '../../src/acoustics/client'
import type { CoverageJob, CoverageReply } from '../../src/acoustics/job'
import { runCoverageJob } from '../../src/acoustics/job'
import { CoverageController, type CoverageDeps, type LayerPort } from '../../src/creation/coverageController'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { templateToDesign } from '../../src/creation/templates'
import { Template } from '../../src/creation/templateSchema'
import { signalPath } from '../../src/flow/signalPath'
import { RoomFile } from '../../src/explore/roomSchema'
import { roomLayout, type RoomLayout } from '../../src/explore/roomLayout'
import type { CoverageView } from '../../src/creation/coverageModel'
import type { PortRef } from '../../src/engine/types'
import type { DesignState } from '../../src/trials/trial'
import { makeRegistry } from '../helpers'

const registry = makeRegistry()
const ref = (s: string): PortRef => {
  const [instance, port] = s.split(' ')
  return { instance, port }
}
const room = (id: string): RoomLayout => roomLayout(RoomFile.parse(JSON.parse(readFileSync(`content/rooms/${id}.json`, 'utf8'))))

function rig(): DesignState {
  const s = new CreationStore(registry, creationEvaluator(registry), templateToDesign(Template.parse(JSON.parse(readFileSync('content/templates/concert-simple-reference.json', 'utf8')))))
  for (const [a, b] of [['ql1 out-main-l', 'k12-g in-line-a'], ['ql1 out-main-r', 'k12-d in-line-a']]) expect(s.dispatch({ type: 'CONNECT', a: ref(a), b: ref(b) }).ok).toBe(true)
  expect(s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }).ok).toBe(true)
  return s.design()
}

class FakeWorker implements MessagePortLike {
  jobs: CoverageJob[] = []
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  terminated = 0
  postMessage(message: unknown): void {
    this.jobs.push(message as CoverageJob)
  }
  terminate(): void {
    this.terminated++
  }
  /** Answer a posted job as the real worker would (the pure runner). */
  answer(job: CoverageJob): CoverageReply {
    const r = runCoverageJob(structuredClone(job))
    this.onmessage?.({ data: r })
    return r
  }
}

class FakeLayer implements LayerPort {
  disposed = false
  visible = true
  shows = 0
  aim: string[][] = []
  pins: ([number, number, number] | null)[] = []
  cleared = 0
  constructor(readonly scene: Scene) {}
  show(): void {
    this.shows++
  }
  clearDots(): void {
    this.cleared++
  }
  setAim(sources: readonly { id: string }[]): void {
    this.aim.push(sources.map((s) => s.id))
  }
  setPin(at: [number, number, number] | null): void {
    this.pins.push(at)
  }
  setVisible(v: boolean): void {
    this.visible = v
  }
  /** Set by a test: the dot under the pointer. */
  dot: { index: number; position: [number, number, number] } | null = null
  pickDot() {
    return this.visible ? this.dot : null
  }
  get counts() {
    return { plain: 1, hatched: 0 }
  }
  get aimLines() {
    return []
  }
  get enabledMeshes(): string[] {
    return this.disposed || !this.visible ? [] : ['coverage']
  }
  drawCalls(): number {
    return 0
  }
  dispose(): void {
    this.disposed = true
  }
}

interface Rig {
  c: CoverageController
  workers: FakeWorker[]
  layers: FakeLayer[]
  views: CoverageView[]
  announced: string[]
  canvas: { handlers: Record<string, ((e: unknown) => void)[]>; capture: Record<string, unknown>; addEventListener(t: string, f: (e: unknown) => void, o?: unknown): void; removeEventListener(t: string, f: (e: unknown) => void): void; ownerDocument: unknown }
  state: { design: DesignState; scene: object | null; layout: RoomLayout | null; placeId: string | null; propsOpen: boolean; canPin: boolean; ear: number }
  placeBag: { current: DisposableBag }
  pinHandlers: { pin(id: string | null): void }
  notify(): void
  propsChanged(): void
  press(x?: number, y?: number): void
  bag: DisposableBag
}

function make(over: { layout?: RoomLayout | null } = {}): Rig {
  const workers: FakeWorker[] = []
  const layers: FakeLayer[] = []
  const views: CoverageView[] = []
  const announced: string[] = []
  const subs = new Set<() => void>()
  const propSubs = new Set<() => void>()
  const canvas = {
    handlers: {} as Record<string, ((e: unknown) => void)[]>,
    capture: {} as Record<string, unknown>,
    ownerDocument: {},
    addEventListener(t: string, f: (e: unknown) => void, o?: unknown) {
      ;(this.handlers[t] ??= []).push(f)
      this.capture[t] = o
    },
    removeEventListener(t: string, f: (e: unknown) => void) {
      this.handlers[t] = (this.handlers[t] ?? []).filter((x) => x !== f)
    },
  }
  const state = { design: rig(), scene: {} as object | null, layout: over.layout === undefined ? room('concert-hall-medium') : over.layout, placeId: 'room:concert-hall-medium' as string | null, propsOpen: true, canPin: true, ear: 1.2 }
  const placeBag = { current: new DisposableBag() }
  const bag = new DisposableBag()
  const panel = { handlers: { pin: (_id: string | null) => undefined } as { pin(id: string | null): void } }
  const deps: CoverageDeps = {
    host: {
      get scene() {
        return state.scene as Scene | null
      },
      camera: null,
      get layout() {
        return state.layout
      },
      get placeId() {
        return state.placeId
      },
      canvasElement: canvas as unknown as HTMLElement,
      get placeBag() {
        return placeBag.current
      },
    },
    registry,
    design: () => state.design,
    path: () => signalPath(state.design, registry, []),
    earHeight: () => state.ear,
    listeningPoints: () => [{ id: 'regie', label: 'Régie', position: [0, 1.2, 8] as [number, number, number] }],
    deviceAt: () => false,
    invalidate: () => undefined,
    announce: (m) => void announced.push(m),
    subscribe: (fn) => {
      subs.add(fn)
      return () => void subs.delete(fn)
    },
    propsOpen: () => state.propsOpen,
    onPropsChange: (fn) => {
      propSubs.add(fn)
      return () => void propSubs.delete(fn)
    },
    canPin: () => state.canPin,
    bag,
    container: {} as HTMLElement,
    before: null,
    makeWorker: () => {
      const w = new FakeWorker()
      workers.push(w)
      return w
    },
    createLayer: (scene) => {
      const l = new FakeLayer(scene)
      layers.push(l)
      return l
    },
    createPanel: (h) => {
      panel.handlers = h
      return { render: (v: CoverageView) => void views.push(v) }
    },
  }
  const c = new CoverageController(deps)
  return {
    c,
    workers,
    layers,
    views,
    announced,
    canvas,
    state,
    placeBag,
    bag,
    get pinHandlers() {
      return panel.handlers
    },
    notify: () => subs.forEach((f) => f()),
    propsChanged: () => propSubs.forEach((f) => f()),
    press: (x = 10, y = 10) => {
      const ev = (t: number) => ({ button: 0, isPrimary: true, offsetX: x, offsetY: y, timeStamp: t })
      for (const f of canvas.handlers.pointerdown ?? []) f(ev(100))
      for (const f of canvas.handlers.pointerup ?? []) f(ev(150))
    },
  }
}

const jobsOf = (r: Rig): number => r.workers.reduce((n, w) => n + w.jobs.length, 0)

beforeEach(() => void vi.useFakeTimers())
afterEach(() => void vi.useRealTimers())

describe('CoverageController lifecycle (fake worker, fake layer)', () => {
  it('stays inert until toggled on: no layer, no worker, no job, nothing announced', () => {
    const r = make()
    r.notify()
    vi.advanceTimersByTime(1000)
    expect(r.layers).toHaveLength(0)
    expect(r.workers).toHaveLength(0)
    expect(r.c.debug().on).toBe(false)
  })

  it('toggle on = ONE job after the debounce; its answer draws the dots and is announced once', () => {
    const r = make()
    r.c.setOn(true)
    expect(r.c.debug()).toMatchObject({ on: true, status: 'computing', worker: true })
    vi.advanceTimersByTime(149)
    expect(jobsOf(r)).toBe(0)
    vi.advanceTimersByTime(1)
    expect(jobsOf(r)).toBe(1)
    const job = r.workers[0].jobs[0]
    expect(job.sources.map((s) => s.id)).toEqual(['k12-d', 'k12-g'])
    expect(job.probes!.length).toBe(3) // the Régie
    r.workers[0].answer(job)
    expect(r.layers[0].shows).toBe(1)
    expect(r.c.debug()).toMatchObject({ status: 'ready', pending: false })
    expect(r.c.debug().stats!.max).toBe(0)
    expect(r.announced.filter((m) => m.startsWith('Couverture calculée'))).toHaveLength(1)
    expect(r.c.jobs).toBe(1)
    // idle: nothing more
    vi.advanceTimersByTime(5000)
    expect(jobsOf(r)).toBe(1)
  })

  it('a rig change that moves a speaker = exactly ONE new job after the debounce; one that touches no speaker = none', () => {
    const r = make()
    r.c.setOn(true)
    vi.advanceTimersByTime(150)
    r.workers[0].answer(r.workers[0].jobs[0])
    const p = r.state.design.placements.find((x) => x.instanceId === 'sm58')!
    p.position_m = [p.position_m[0] + 1, p.position_m[1], p.position_m[2]]
    r.notify() // the microphone moved: no speaker changed
    vi.advanceTimersByTime(1000)
    expect(jobsOf(r)).toBe(1)
    const g = r.state.design.placements.find((x) => x.instanceId === 'k12-g')!
    g.position_m = [g.position_m[0] - 1, g.position_m[1], g.position_m[2]]
    for (let i = 0; i < 5; i++) r.notify() // a burst
    expect(jobsOf(r)).toBe(1)
    vi.advanceTimersByTime(150)
    expect(jobsOf(r)).toBe(2)
    expect(r.layers[0].aim.at(-1)).toEqual(['k12-d', 'k12-g'])
    expect(r.c.jobs).toBe(2)
  })

  it('a PLACE CHANGE terminates the worker, disposes the layer, and a late answer for the old place is ignored', () => {
    const r = make()
    r.c.setOn(true)
    vi.advanceTimersByTime(150)
    const w0 = r.workers[0]
    const oldJob = w0.jobs[0]
    const l0 = r.layers[0]
    const lateHandler = w0.onmessage // captured BEFORE the teardown: a reply that arrives from the old worker after terminate()
    // the place goes: the scene host disposes the place bag FIRST, then builds the new scene
    r.placeBag.current.dispose()
    expect(w0.terminated).toBe(1)
    expect(l0.disposed).toBe(true)
    expect(r.c.debug().worker).toBe(false)
    expect(w0.onmessage).toBeNull() // detached
    expect(w0.onerror).toBeNull()
    r.placeBag.current = new DisposableBag()
    r.state.scene = {} // the new scene
    r.c.reset()
    expect(r.layers).toHaveLength(2)
    expect(r.layers[1].scene).not.toBe(l0.scene)
    // the OLD worker's answer arrives late: nothing is drawn, nothing changes
    const shownBefore = r.c.debug()
    expect(lateHandler).not.toBeNull()
    lateHandler!({ data: runCoverageJob(structuredClone(oldJob)) }) // the retained handler of the disposed client: dropped
    expect(l0.shows).toBe(0)
    expect(r.layers[1].shows).toBe(0)
    expect(r.c.debug().status).toBe(shownBefore.status)
    vi.advanceTimersByTime(150)
    expect(r.workers).toHaveLength(2) // a fresh worker for the new place
    r.workers[1].answer(r.workers[1].jobs[0])
    expect(r.layers[1].shows).toBe(1)
  })

  it('the stale-scene guard: an answer whose request belongs to another scene is dropped even if the worker survived', () => {
    const r = make()
    r.c.setOn(true)
    vi.advanceTimersByTime(150)
    const w = r.workers[0]
    const job = w.jobs[0]
    r.state.scene = {} // the scene changed under the request (reset() not yet called)
    w.answer(job)
    expect(r.layers[0].shows).toBe(0)
    expect(r.c.debug().status).not.toBe('ready')
  })

  it('toggle OFF leaves nothing: layer disposed, worker terminated, panel off, said once; toggling on again recomputes', () => {
    const r = make()
    r.c.setOn(true)
    vi.advanceTimersByTime(150)
    r.workers[0].answer(r.workers[0].jobs[0])
    r.c.setOn(false)
    expect(r.layers[0].disposed).toBe(true)
    expect(r.workers[0].terminated).toBe(1)
    expect(r.c.debug()).toMatchObject({ on: false, worker: false, meshes: [] })
    expect(r.views.at(-1)!.on).toBe(false)
    expect(r.announced.at(-1)).toBe('Couverture masquée.')
    r.notify() // a rig change while off: nothing
    vi.advanceTimersByTime(1000)
    expect(jobsOf(r)).toBe(1)
    r.c.setOn(true)
    vi.advanceTimersByTime(150)
    expect(jobsOf(r)).toBe(2)
    expect(r.workers).toHaveLength(2)
    expect(r.c.jobs).toBe(2) // counted over the page's life
  })

  it('a worker that fails: the panel says it is unavailable, and the NEXT change retries with a new worker', () => {
    const r = make()
    r.c.setOn(true)
    vi.advanceTimersByTime(150)
    r.workers[0].onerror?.({ message: 'chunk 404' })
    expect(r.c.debug().status).toBe('error')
    expect(r.c.debug().message).toBe('Calcul de la couverture indisponible (réessayez).')
    const g = r.state.design.placements.find((x) => x.instanceId === 'k12-g')!
    g.position_m = [g.position_m[0] - 1, g.position_m[1], g.position_m[2]]
    r.notify()
    vi.advanceTimersByTime(150)
    expect(r.workers).toHaveLength(2)
    expect(r.workers[1].jobs).toHaveLength(1)
  })

  it('no reply within the watchdog: an error is shown, not a « Calcul… » that never ends', () => {
    const r = make()
    r.c.setOn(true)
    vi.advanceTimersByTime(150)
    vi.advanceTimersByTime(10_000)
    expect(r.c.debug().status).toBe('error')
    expect(r.workers[0].terminated).toBe(1)
  })
})

describe('folding Propriétés hides the layer (the legend, the unit and the caveat are in it)', () => {
  it('fold: the layer is hidden, said once, no job; unfold: it is back, still no job', () => {
    const r = make()
    r.c.setOn(true)
    vi.advanceTimersByTime(150)
    r.workers[0].answer(r.workers[0].jobs[0])
    expect(r.c.debug()).toMatchObject({ hidden: false, meshes: ['coverage'] })
    r.state.propsOpen = false
    r.propsChanged()
    expect(r.layers[0].visible).toBe(false)
    expect(r.c.debug()).toMatchObject({ on: true, hidden: true, meshes: [] }) // the toggle stays on
    expect(r.announced.filter((m) => m === 'Couverture masquée : Propriétés est replié.')).toHaveLength(1)
    vi.advanceTimersByTime(3000)
    expect(jobsOf(r)).toBe(1)
    r.state.propsOpen = true
    r.propsChanged()
    expect(r.layers[0].visible).toBe(true)
    expect(r.c.debug().meshes).toEqual(['coverage'])
    vi.advanceTimersByTime(3000)
    expect(jobsOf(r)).toBe(1)
    expect(r.announced.filter((m) => m.includes('replié'))).toHaveLength(1)
    // unfolding RESTORES the current message in the status bar (the fold left « Couverture masquée … » there)
    expect(r.announced.at(-1)).toMatch(/^Couverture calculée : /)
    expect(r.announced.at(-1)).toBe(r.c.debug().message)
  })
  it('a rig change while folded STILL recomputes (one job), so unfolding shows a current result', () => {
    const r = make()
    r.c.setOn(true)
    vi.advanceTimersByTime(150)
    r.workers[0].answer(r.workers[0].jobs[0])
    const first = r.c.debug().stats!
    r.state.propsOpen = false
    r.propsChanged()
    const g = r.state.design.placements.find((x) => x.instanceId === 'k12-g')!
    g.position_m = [g.position_m[0] - 2, g.position_m[1], g.position_m[2]]
    r.notify()
    vi.advanceTimersByTime(150)
    expect(jobsOf(r)).toBe(2) // computed while hidden
    r.workers[0].answer(r.workers[0].jobs[1])
    expect(r.layers[0].shows).toBe(2) // the buffers are current, the meshes still hidden
    expect(r.layers[0].visible).toBe(false)
    expect(r.announced.at(-1)).toBe('Couverture masquée : Propriétés est replié.') // a result while folded does not replace the hidden message
    r.state.propsOpen = true
    r.propsChanged()
    expect(r.layers[0].visible).toBe(true)
    expect(jobsOf(r)).toBe(2) // unfolding computed nothing more
    const now = r.c.debug().stats!
    expect(now.mean).not.toBe(first.mean) // the shown result is the new one
    expect(r.announced.at(-1)).toBe(r.c.debug().message)
  })
  it('toggling on while Propriétés is already folded says so (nothing is visible), once, instead of « calculée »', () => {
    const r = make()
    r.state.propsOpen = false
    r.c.setOn(true)
    vi.advanceTimersByTime(150)
    r.workers[0].answer(r.workers[0].jobs[0])
    expect(r.c.debug()).toMatchObject({ status: 'ready', hidden: true, meshes: [] })
    expect(r.announced.filter((m) => m === 'Couverture masquée : Propriétés est replié.')).toHaveLength(1)
    expect(r.announced.some((m) => m.startsWith('Couverture calculée'))).toBe(false)
    r.state.propsOpen = true
    r.propsChanged()
    expect(r.announced.at(-1)).toMatch(/^Couverture calculée : /)
  })
  it('a layer built while Propriétés is folded starts hidden; folding while off says nothing', () => {
    const r = make()
    r.state.propsOpen = false
    r.propsChanged()
    expect(r.announced).toEqual([])
    r.c.setOn(true)
    expect(r.layers[0].visible).toBe(false)
  })
})

describe('the pin obeys the shell gate and the first-click rules', () => {
  const ready = (r: Rig): void => {
    r.c.setOn(true)
    vi.advanceTimersByTime(150)
    r.workers[0].answer(r.workers[0].jobs[0])
    r.layers[0].dot = { index: 0, position: [-3.25, 1.2, 0.25] }
  }
  it('a click on a dot pins it: one more job (the dot is a probe), announced once', () => {
    const r = make()
    ready(r)
    r.press()
    vi.advanceTimersByTime(150)
    expect(jobsOf(r)).toBe(2)
    expect(r.workers[0].jobs[1].probes!.length).toBe(6)
    r.workers[0].answer(r.workers[0].jobs[1])
    expect(r.c.debug().pinned).toMatch(/^Point épinglé \(−3,3 m ; 0,3 m\) : /)
    expect(r.announced.filter((m) => m.startsWith('Point épinglé'))).toHaveLength(1)
    // « Retirer l’épingle »: the status bar must not keep the pinned value; the next result says the current coverage message again
    r.pinHandlers.pin(null)
    vi.advanceTimersByTime(150)
    r.workers[0].answer(r.workers[0].jobs[2])
    expect(r.c.debug().pinned).toBeNull()
    expect(r.announced.at(-1)).toMatch(/^Couverture calculée : /)
  })
  it('canPin false (a device follows the pointer, a port, the walk view…): no pin, no job', () => {
    const r = make()
    ready(r)
    r.state.canPin = false
    r.press()
    vi.advanceTimersByTime(1000)
    expect(jobsOf(r)).toBe(1)
    expect(r.c.debug().pinned).toBeNull()
    expect(r.c.wouldTake(10, 10)).toBe(false) // so the shell's « missed click » is the shell's
  })
  it('the gate is checked at the PRESS too: a press the shell owned, released after it let go, is not a pin', () => {
    const r = make()
    ready(r)
    r.state.canPin = false
    const down = r.canvas.handlers.pointerdown ?? []
    for (const f of down) f({ button: 0, isPrimary: true, offsetX: 5, offsetY: 5, timeStamp: 100 })
    r.state.canPin = true // e.g. the placement controller dropped the device and is no longer « placing »
    for (const f of r.canvas.handlers.pointerup ?? []) f({ button: 0, isPrimary: true, offsetX: 5, offsetY: 5, timeStamp: 150 })
    vi.advanceTimersByTime(1000)
    expect(jobsOf(r)).toBe(1)
  })
  it('the listeners are capture listeners (they run before the placement controller drops the device)', () => {
    const r = make()
    expect(r.canvas.handlers.pointerdown).toHaveLength(1)
    expect(r.canvas.handlers.pointerup).toHaveLength(1)
    expect(r.canvas.capture.pointerdown).toEqual({ capture: true })
    expect(r.canvas.capture.pointerup).toEqual({ capture: true })
  })
  it('a hidden layer (Propriétés folded) cannot be pinned', () => {
    const r = make()
    ready(r)
    r.state.propsOpen = false
    r.propsChanged()
    r.press()
    vi.advanceTimersByTime(1000)
    expect(jobsOf(r)).toBe(1)
  })
})

describe('no audience, no aim line', () => {
  it('a room without an audience zone: no job, no dots, and the aim lines are cleared (the indicator is only for a visible coverage)', () => {
    const r = make({ layout: null })
    r.c.setOn(true)
    vi.advanceTimersByTime(1000)
    expect(jobsOf(r)).toBe(0)
    expect(r.c.debug().status).toBe('no-audience')
    expect(r.layers[0].aim.flat()).toEqual([]) // never drawn with a speaker in it
    expect(r.layers[0].aim.every((a) => a.length === 0)).toBe(true)
    expect(r.views.at(-1)!.legend.every((l) => l.count === null)).toBe(true)
  })
})
