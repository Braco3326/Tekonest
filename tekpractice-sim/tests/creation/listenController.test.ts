/**
 * Task 39: the listen controller's LIFECYCLE with a fake engine, a fake panel, a manual frame loop and a counting lease (no DOM, no Web Audio).
 * Plays only on a valid chain; the lease and the loop exist only while playing; Stop / a place change / dispose / a newer « Lecture » leave nothing;
 * an engine that arrives after Stop is disposed unused; the voices follow the rig, the listener and the mute; each event is said once.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DisposableBag } from '../../src/util/disposable'
import type { MixVoice } from '../../src/audio/listenerMix'
import type { PlaySource } from '../../src/audio/engine'
import { ListenController, METER_MS, type EngineLike, type ListenDeps } from '../../src/creation/listenController'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { templateToDesign } from '../../src/creation/templates'
import { Template } from '../../src/creation/templateSchema'
import { signalPath } from '../../src/flow/signalPath'
import type { ListenerPose } from '../../src/creation/listenVoices'
import type { ListenView } from '../../src/creation/listenModel'
import type { PortRef } from '../../src/engine/types'
import { makeRegistry } from '../helpers'

const registry = makeRegistry()
const ref = (s: string): PortRef => {
  const [instance, port] = s.split(' ')
  return { instance, port }
}

class FakeEngine implements EngineLike {
  played: PlaySource[] = []
  /** How many `update()` calls had happened when `play()` was called (the voices must come first). */
  updatesAtPlay: number[] = []
  updates: MixVoice[][] = []
  stops = 0
  disposes = 0
  levelReads = 0
  onEnded: (() => void) | null = null
  onFailed: (() => void) | null = null
  playGate: { resolve(): void; reject(e: unknown): void } | null = null
  /** Set by a test: make play() wait for `release()` / `fail()`. */
  deferPlay = false
  failPlay: Error | null = null
  private closeIt!: () => void
  readonly closed = new Promise<void>((r) => (this.closeIt = r))
  async play(s: PlaySource): Promise<void> {
    this.played.push(s)
    this.updatesAtPlay.push(this.updates.length)
    if (this.failPlay) throw this.failPlay
    if (this.deferPlay) await new Promise<void>((resolve, reject) => (this.playGate = { resolve, reject }))
  }
  stop(): void {
    this.stops++
  }
  update(v: MixVoice[]): void {
    this.updates.push(v)
  }
  peaks(): { voices: Record<string, number>; output: number } {
    return { voices: { 'k12-g': 0.25 }, output: 0.3 }
  }
  levels(): Record<string, number> {
    this.levelReads++
    return { 'k12-g': 0.25 }
  }
  dispose(): void {
    this.disposes++
    this.closeIt()
  }
  /** What the engine does by itself a moment after stop(). */
  settle(): void {
    this.closeIt()
  }
}

function make(opts: { deferEngine?: boolean; engineFails?: boolean; powered?: boolean; configure?: (e: FakeEngine) => void } = {}) {
  const t = Template.parse(JSON.parse(readFileSync('content/templates/concert-simple-reference.json', 'utf8')))
  const store = new CreationStore(registry, creationEvaluator(registry), templateToDesign(t))
  const dispatch = (i: Parameters<CreationStore['dispatch']>[0]): void => void expect(store.dispatch(i).ok).toBe(true)
  if (opts.powered !== false) {
    dispatch({ type: 'CONNECT', a: ref('ql1 out-main-l'), b: ref('k12-g in-line-a') })
    dispatch({ type: 'CONNECT', a: ref('ql1 out-main-r'), b: ref('k12-d in-line-a') })
    dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true })
  }
  const st = {
    path: signalPath(store.design(), registry, store.events()),
    listener: { position: [0, 1.2, 0.5], right: [-1, 0, 0] } as ListenerPose | null,
    propsOpen: true,
    now: 0,
  }
  const engines: FakeEngine[] = []
  /** The contexts handed to createEngine, in order, and the ones the controller closed itself (never adopted by an engine). */
  const handed: (AudioContext | null)[] = []
  const closed: (AudioContext | null)[] = []
  const created = { n: 0 }
  const gates: { resolve(): void; reject(e: unknown): void }[] = []
  const views: ListenView[] = []
  const announced: string[] = []
  const leases = { held: 0, taken: 0, released: 0, names: [] as string[] }
  const frames: { fn: () => void; cancelled: boolean }[] = []
  const subscribers = new Set<() => void>()
  const bag = new DisposableBag()
  let startDefault = 0
  let handlers!: { toggle(): void }
  const deps: ListenDeps = {
    registry,
    design: () => store.design(),
    path: () => st.path,
    listener: () => st.listener,
    hold: (name) => {
      leases.held++
      leases.taken++
      leases.names.push(name)
      let done = false
      return () => {
        if (done) return
        done = true
        leases.held--
        leases.released++
      }
    },
    announce: (m) => void announced.push(m),
    deviceLabel: (id) => `Nom ${id}`,
    subscribe: (fn) => {
      subscribers.add(fn)
      return () => void subscribers.delete(fn)
    },
    propsOpen: () => st.propsOpen,
    startDefault: () => void startDefault++,
    bag,
    container: {} as HTMLElement,
    before: null,
    frame: (fn) => {
      const f = { fn, cancelled: false }
      frames.push(f)
      return () => void (f.cancelled = true)
    },
    now: () => st.now,
    closeContext: (c) => void closed.push(c),
    createEngine: async (c) => {
      created.n++
      handed.push(c)
      if (opts.engineFails) throw new Error('chunk failed')
      if (opts.deferEngine) await new Promise<void>((resolve, reject) => gates.push({ resolve, reject }))
      const e = new FakeEngine()
      opts.configure?.(e)
      engines.push(e)
      return e
    },
    createPanel: (h) => {
      handlers = h
      return { render: (v) => void views.push(v) }
    },
  }
  const c = new ListenController(deps)
  const refreshPath = (): void => {
    st.path = signalPath(store.design(), registry, store.events())
    for (const fn of [...subscribers]) fn()
  }
  /** Run the pending animation frame (if any) at the clock `st.now`. */
  const frame = (): void => {
    const f = frames.filter((x) => !x.cancelled).pop()
    if (f) {
      f.cancelled = true
      f.fn()
    }
  }
  const pending = (): number => frames.filter((f) => !f.cancelled).length
  return { c, st, store, handed, closed, dispatch, engines, created, views, announced, leases, frames, frame, pending, refreshPath, bag, subscribers, handlers: () => handlers, startDefault: () => startDefault, release: () => gates.splice(0).forEach((g) => g.resolve()) }
}
const TEST = { kind: 'test' } as const
/** Let the pending promise callbacks run. */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}
const lastView = (m: ReturnType<typeof make>): ListenView => m.views[m.views.length - 1]

describe('play: only on a valid chain, lazily', () => {
  it('an unpowered / unplayable rig: nothing is created, no lease, the first reason is said', async () => {
    const m = make({ powered: false })
    await m.c.play(TEST)
    expect(m.created.n).toBe(0)
    expect(m.leases.taken).toBe(0)
    expect(m.c.state).toBe('stopped')
    expect(m.announced).toEqual([`Lecture impossible. ${m.st.path.reasons[0].text_fr}`])
    expect(m.st.path.reasons[0].text_fr).toBe('La lecture console est coupée.')
    expect(m.pending()).toBe(0)
  })
  it('on a valid chain: the engine is made at the first play, gets the voices BEFORE the source starts, then the lease and ONE frame loop', async () => {
    const m = make()
    expect(m.created.n).toBe(0) // constructing the controller creates nothing audio
    await m.c.play(TEST)
    expect(m.created.n).toBe(1)
    const e = m.engines[0]
    expect(e.updates).toHaveLength(1)
    expect(e.updates[0].map((v) => v.instanceId)).toEqual(['k12-d', 'k12-g'])
    expect(e.played).toEqual([{ kind: 'test' }])
    expect(e.updatesAtPlay).toEqual([1]) // the voices were in place when the source started: never a moment of unpanned sound
    expect(m.c.state).toBe('playing')
    expect(m.leases.names).toEqual(['meters'])
    expect(m.leases.held).toBe(1)
    expect(m.pending()).toBe(1)
    expect(m.announced).toEqual(['Lecture en cours : signal de test (simulation simple).'])
    expect(lastView(m)).toMatchObject({ state: 'playing', line: 'Lecture en cours : signal de test (simulation simple).', canStart: true })
  })
  it('a file and a song are named in the line and handed to the engine as such', async () => {
    const m = make()
    const file = new File([new Uint8Array(4)], 'mon-mix.wav')
    await m.c.play({ kind: 'file', file })
    expect(m.engines[0].played).toEqual([{ kind: 'file', file }])
    expect(m.announced.at(-1)).toBe('Lecture en cours : fichier mon-mix.wav (simulation simple).')
    await m.c.play({ kind: 'song', id: 's', title: 'Titre', url: '/audio/songs/s.mp3' })
    expect(m.engines[1].played).toEqual([{ kind: 'song', url: '/audio/songs/s.mp3' }])
    expect(m.announced.at(-1)).toBe('Lecture en cours : Titre (simulation simple).')
  })
  it('the voices carry the mix of the live design: k12-g (world +x) pans left of the Régie listener, both equidistant', async () => {
    const m = make()
    await m.c.play(TEST)
    const v = m.engines[0].updates[0]
    expect(v.find((x) => x.instanceId === 'k12-g')!.pan).toBeLessThan(0)
    expect(v.find((x) => x.instanceId === 'k12-d')!.pan).toBeGreaterThan(0)
  })
  it('the panel lists one row per speaker as text (name, level, gain, delay, pan) once the meters have run', async () => {
    const m = make()
    await m.c.play(TEST)
    m.st.now = METER_MS
    m.frame()
    const rows = lastView(m).rows
    expect(rows.map((r) => r.id)).toEqual(['k12-d', 'k12-g'])
    const g = rows.find((r) => r.id === 'k12-g')!
    expect(g.text).toMatch(/^Nom k12-g : niveau de sortie −12,0 dBFS, gain 0,0 dB, retard 0,0 ms, pan gauche \d+ %$/)
    expect(g.bar).toBeGreaterThan(0)
  })
})

describe('stop and the lease', () => {
  it('Stop: the engine fades out, the lease and the loop go, the event is said once; a second Stop says nothing', async () => {
    const m = make()
    await m.c.play(TEST)
    m.announced.length = 0
    m.c.stop()
    expect(m.engines[0].stops).toBe(1)
    expect(m.leases.held).toBe(0)
    expect(m.leases.released).toBe(1)
    expect(m.pending()).toBe(0)
    expect(m.c.state).toBe('stopped')
    expect(m.announced).toEqual(['Lecture arrêtée.'])
    m.c.stop()
    expect(m.announced).toEqual(['Lecture arrêtée.'])
    expect(m.engines[0].stops).toBe(1)
  })
  it('the engine stays "retiring" while it fades, and is forgotten once closed', async () => {
    const m = make()
    await m.c.play(TEST)
    m.c.stop()
    expect(m.c.debug().retiring).toBe(1)
    m.engines[0].settle()
    await m.engines[0].closed
    await Promise.resolve()
    expect(m.c.debug().retiring).toBe(0)
  })
  it('the file reaching its end stops by itself: « Lecture terminée. », lease released', async () => {
    const m = make()
    await m.c.play({ kind: 'file', file: new File([new Uint8Array(1)], 'a.wav') })
    m.announced.length = 0
    m.engines[0].onEnded!()
    expect(m.c.state).toBe('stopped')
    expect(m.leases.held).toBe(0)
    expect(m.announced).toEqual(['Lecture terminée.'])
  })
  it('idle is free: stopped = no frame, no lease, and a rig change does no work at all', async () => {
    const m = make()
    m.refreshPath()
    expect(m.pending()).toBe(0)
    expect(m.leases.taken).toBe(0)
    expect(m.created.n).toBe(0)
    await m.c.play(TEST)
    m.c.stop()
    m.engines[0].updates.length = 0
    m.refreshPath()
    expect(m.engines[0].updates).toHaveLength(0)
    expect(m.pending()).toBe(0)
  })
})

describe('stale results are ignored', () => {
  it('Stop while the engine chunk is loading: the engine that arrives is disposed unused; no lease, no loop, nothing said twice', async () => {
    const m = make({ deferEngine: true })
    const p = m.c.play(TEST)
    expect(m.c.state).toBe('starting')
    expect(m.c.active).toBe(true)
    m.c.stop()
    expect(m.c.state).toBe('stopped')
    m.release()
    await p
    expect(m.engines[0].disposes).toBe(1)
    expect(m.engines[0].played).toEqual([])
    expect(m.leases.taken).toBe(0)
    expect(m.pending()).toBe(0)
    expect(m.c.state).toBe('stopped')
    expect(m.announced).toEqual(['Lecture arrêtée.'])
  })
  it('a place change while the engine loads: same, and the place change says so', async () => {
    const m = make({ deferEngine: true })
    const p = m.c.play(TEST)
    m.c.reset()
    m.release()
    await p
    expect(m.engines[0].disposes).toBe(1)
    expect(m.leases.taken).toBe(0)
    expect(m.announced).toEqual(['Lecture arrêtée : le lieu a changé.'])
  })
  it('Stop while the source is starting (engine.play pending): it ends stopped with no lease and no loop, whatever play() later does', async () => {
    const m = make({ configure: (e) => (e.deferPlay = true) })
    const p = m.c.play(TEST)
    await flush()
    expect(m.engines[0].played).toEqual([{ kind: 'test' }])
    expect(m.c.state).toBe('starting')
    m.c.stop()
    m.engines[0].playGate!.resolve()
    await p
    expect(m.c.state).toBe('stopped')
    expect(m.engines[0].stops).toBe(1)
    expect(m.leases.taken).toBe(0)
    expect(m.pending()).toBe(0)
    expect(m.announced).toEqual(['Lecture arrêtée.'])
  })
  it('engine.play failing AFTER a Stop is not announced as a failure', async () => {
    const m = make({ configure: (e) => (e.deferPlay = true) })
    const p = m.c.play({ kind: 'file', file: new File([new Uint8Array(1)], 'a.wav') })
    await flush()
    m.c.stop()
    m.engines[0].playGate!.reject(new Error('aborted'))
    await p
    expect(m.announced).toEqual(['Lecture arrêtée.'])
  })
  it('a newer « Lecture » replaces the older one: the old engine is stopped, one lease at a time, one loop', async () => {
    const m = make()
    await m.c.play(TEST)
    await m.c.play({ kind: 'file', file: new File([new Uint8Array(1)], 'b.wav') })
    expect(m.engines).toHaveLength(2)
    expect(m.engines[0].stops).toBe(1)
    expect(m.leases.taken).toBe(2)
    expect(m.leases.released).toBe(1)
    expect(m.leases.held).toBe(1)
    expect(m.pending()).toBe(1)
    expect(m.c.state).toBe('playing')
  })
  it('two « Lecture » in a row while the first engine loads: the first engine is disposed unused, only the second plays, one lease', async () => {
    const m = make({ deferEngine: true })
    const a = m.c.play(TEST)
    const b = m.c.play({ kind: 'file', file: new File([new Uint8Array(1)], 'b.wav') })
    m.release()
    await Promise.all([a, b])
    expect(m.engines).toHaveLength(2)
    expect(m.engines[0].disposes).toBe(1)
    expect(m.engines[0].played).toEqual([])
    expect(m.engines[1].played).toHaveLength(1)
    expect(m.leases.taken).toBe(1)
    expect(m.leases.held).toBe(1)
    expect(m.c.debug().source).toBe('file')
  })
})

describe('failures leave nothing running', () => {
  it('the engine chunk fails to load: said, stopped, no lease', async () => {
    const m = make({ engineFails: true })
    await m.c.play(TEST)
    expect(m.c.state).toBe('stopped')
    expect(m.leases.taken).toBe(0)
    expect(m.announced).toEqual(['La lecture n’a pas pu se charger. Rechargez la page.'])
    expect(m.pending()).toBe(0)
  })
  it('a file that cannot be played: said as such, the engine is stopped, no lease; any other source failing says the general message', async () => {
    const m = make({ configure: (e) => (e.failPlay = new Error('NotSupportedError')) })
    await m.c.play({ kind: 'file', file: new File([new Uint8Array(1)], 'x.txt') })
    expect(m.c.state).toBe('stopped')
    expect(m.engines[0].stops).toBe(1)
    expect(m.leases.taken).toBe(0)
    expect(m.pending()).toBe(0)
    expect(m.announced).toEqual(['Ce fichier n’a pas pu être lu. Essayez un fichier MP3, WAV ou OGG.'])
    await m.c.play(TEST)
    expect(m.announced.at(-1)).toBe('La lecture n’a pas pu démarrer.')
  })
})

describe('following the rig, the listener and the mute', () => {
  it('a rig change that changes nothing audible gives the engine nothing; a mute gives it gain 0 and the block says so, playback goes on', async () => {
    const m = make()
    await m.c.play(TEST)
    const e = m.engines[0]
    e.updates.length = 0
    m.refreshPath() // same design
    expect(e.updates).toHaveLength(0)
    m.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'mute-master', value: true })
    m.refreshPath()
    expect(m.c.state).toBe('playing') // mute never gates
    expect(e.stops).toBe(0)
    expect(e.updates).toHaveLength(1)
    expect(e.updates[0].map((v) => v.gain)).toEqual([0, 0])
    expect(lastView(m).silent).toBe(true)
    expect(m.leases.held).toBe(1)
    m.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'mute-master', value: false })
    m.refreshPath()
    expect(e.updates.at(-1)!.every((v) => v.gain > 0)).toBe(true)
    expect(lastView(m).silent).toBe(false)
  })
  it('the fader at −inf is silence too (gain exactly 0), still playing', async () => {
    const m = make()
    await m.c.play(TEST)
    m.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'fader-master', value: '-inf' })
    m.refreshPath()
    expect(m.c.state).toBe('playing')
    expect(m.engines[0].updates.at(-1)!.map((v) => v.gain)).toEqual([0, 0])
  })
  it('the chain turning invalid while playing (the console switched off) stops it, with the reason, and frees everything', async () => {
    const m = make()
    await m.c.play(TEST)
    m.announced.length = 0
    m.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'power', value: false })
    m.refreshPath()
    expect(m.c.state).toBe('stopped')
    expect(m.engines[0].stops).toBe(1)
    expect(m.leases.held).toBe(0)
    expect(m.pending()).toBe(0)
    expect(m.announced).toEqual(['Lecture arrêtée. ' + m.st.path.reasons[0].text_fr])
    expect(m.announced[0]).toContain('La console n’est pas alimentée.')
  })
  it('a moved listener (the walk camera) is noticed on the next frame only, and only a real move gives the engine new voices', async () => {
    const m = make()
    await m.c.play(TEST)
    const e = m.engines[0]
    e.updates.length = 0
    m.frame() // no move
    expect(e.updates).toHaveLength(0)
    m.st.listener = { position: [3, 1.2, 0.5], right: [-1, 0, 0] }
    expect(e.updates).toHaveLength(0) // nothing happens between frames
    m.frame()
    expect(e.updates).toHaveLength(1)
    const g = e.updates[0].find((x) => x.instanceId === 'k12-g')!
    expect(g.pan).toBeCloseTo(-3 / Math.hypot(3, 8), 9) // 3 m to the left-of-view side of k12-g
    m.frame()
    expect(e.updates).toHaveLength(1) // settled
    m.st.listener = { position: [3, 1.2, 0.5], right: [1, 0, 0] } // turned around: right is now +x
    m.frame()
    expect(e.updates.at(-1)!.find((x) => x.instanceId === 'k12-g')!.pan).toBeGreaterThan(0)
  })
  it('the frame loop keeps going while playing (one pending frame) and the meters are read about every 100 ms, not per frame', async () => {
    const m = make()
    await m.c.play(TEST)
    const e = m.engines[0]
    for (let i = 0; i < 5; i++) {
      m.st.now = i * 16
      m.frame()
      expect(m.pending()).toBe(1)
    }
    expect(e.levelReads).toBe(1) // 0..64 ms: one read (the first)
    m.st.now = 200
    m.frame()
    expect(e.levelReads).toBe(2)
  })
  it('Propriétés folded: the block is not redrawn at the meter rate, the sound and the loop go on', async () => {
    const m = make()
    await m.c.play(TEST)
    m.st.propsOpen = false
    const n = m.views.length
    m.st.now = 500
    m.frame()
    m.st.now = 900
    m.frame()
    expect(m.views.length).toBe(n)
    expect(m.pending()).toBe(1)
    m.st.propsOpen = true
    m.st.now = 1300
    m.frame()
    expect(m.views.length).toBe(n + 1)
  })
})

describe('place change and dispose', () => {
  it('a place change while playing stops it (said), frees the lease and the loop; while stopped it says nothing', async () => {
    const m = make()
    m.c.reset()
    expect(m.announced).toEqual([])
    await m.c.play(TEST)
    m.announced.length = 0
    m.c.reset()
    expect(m.announced).toEqual(['Lecture arrêtée : le lieu a changé.'])
    expect(m.leases.held).toBe(0)
    expect(m.pending()).toBe(0)
    expect(m.engines[0].stops).toBe(1)
  })
  it('dispose while playing: stopped silently, lease and loop freed, still-fading engines disposed, the rig subscription removed; later changes do nothing', async () => {
    const m = make()
    await m.c.play(TEST)
    const e = m.engines[0]
    m.announced.length = 0
    m.c.dispose()
    expect(e.stops).toBe(1)
    expect(e.disposes).toBe(1) // the fading engine is released at once
    expect(m.leases.held).toBe(0)
    expect(m.pending()).toBe(0)
    expect(m.subscribers.size).toBe(0)
    expect(m.announced).toEqual([])
    m.refreshPath()
    await m.c.play(TEST)
    expect(m.created.n).toBe(1) // a disposed controller never starts again
  })
  it('the shell bag disposes it (the page teardown)', async () => {
    const m = make()
    await m.c.play(TEST)
    m.bag.dispose()
    expect(m.leases.held).toBe(0)
    expect(m.engines[0].disposes).toBe(1)
  })
  it('dispose while the engine loads: the late engine is disposed unused', async () => {
    const m = make({ deferEngine: true })
    const p = m.c.play(TEST)
    m.c.dispose()
    m.release()
    await p
    expect(m.engines[0].disposes).toBe(1)
    expect(m.engines[0].played).toEqual([])
    expect(m.leases.taken).toBe(0)
  })
})

describe('the block', () => {
  it('while stopped the block follows the chain: its button is live when the chain can play and off, with the first reason, when it cannot', () => {
    const m = make()
    expect(lastView(m)).toMatchObject({ canStart: true, reason: '' })
    m.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'power', value: false })
    m.refreshPath()
    expect(lastView(m)).toMatchObject({ canStart: false, reason: 'La console n’est pas alimentée.' })
    m.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'power', value: true })
    m.refreshPath()
    expect(lastView(m)).toMatchObject({ canStart: true, reason: '' })
    expect(m.created.n).toBe(0) // and nothing audio was made for it
    expect(m.pending()).toBe(0)
  })
  it('its button starts the chosen source when stopped and stops when playing', async () => {
    const m = make()
    m.handlers().toggle()
    expect(m.startDefault()).toBe(1)
    await m.c.play(TEST)
    m.handlers().toggle()
    expect(m.c.state).toBe('stopped')
    expect(m.startDefault()).toBe(1)
  })
  it('its view carries the first reason when the chain cannot play, and the block is shown from the start', () => {
    const m = make({ powered: false })
    expect(lastView(m)).toMatchObject({ shown: true, state: 'stopped', canStart: false, line: 'Lecture arrêtée.' })
    expect(lastView(m).reason).toBe(m.st.path.reasons[0].text_fr)
  })
})

describe('review round 1: the context is made in the click, handed in, and never leaked', () => {
  const ctxA = { id: 'A' } as unknown as AudioContext
  it('the context made in the click is handed to the engine factory, SYNCHRONOUSLY from play() (before any await), and never closed by the controller when an engine adopts it', async () => {
    const m = make()
    const p = m.c.play(TEST, ctxA)
    expect(m.created.n).toBe(1) // the factory was called before play() yielded
    expect(m.handed).toEqual([ctxA])
    await p
    expect(m.closed).toEqual([]) // the engine owns it now
    m.c.stop()
    expect(m.closed).toEqual([]) // and closes it itself
  })
  it('a chain that cannot play: the context made for the click is closed, no engine is made', async () => {
    const m = make({ powered: false })
    await m.c.play(TEST, ctxA)
    expect(m.created.n).toBe(0)
    expect(m.closed).toEqual([ctxA])
  })
  it('the engine could not be made: the context is closed (once) and it is said', async () => {
    const m = make({ engineFails: true })
    await m.c.play(TEST, ctxA)
    expect(m.closed).toEqual([ctxA])
    expect(m.announced).toEqual(['La lecture n’a pas pu se charger. Rechargez la page.'])
  })
  it('a disposed controller closes the context it is handed', async () => {
    const m = make()
    m.c.dispose()
    await m.c.play(TEST, ctxA)
    expect(m.closed).toEqual([ctxA])
    expect(m.created.n).toBe(0)
  })
  it('stale: Stop while the engine is being made: the late engine (which adopted the context) is disposed; the controller does not close it a second time', async () => {
    const m = make({ deferEngine: true })
    const p = m.c.play(TEST, ctxA)
    m.c.stop()
    m.release()
    await p
    expect(m.engines[0].disposes).toBe(1)
    expect(m.closed).toEqual([])
  })
  it('a context that never starts (ResumeTimeout) says the GENERAL failure, even for a file, and frees everything', async () => {
    const m = make({ configure: (e) => (e.failPlay = Object.assign(new Error('AudioContext.resume() did not settle'), { name: 'ResumeTimeout' })) })
    await m.c.play({ kind: 'file', file: new File([new Uint8Array(1)], 'a.wav') })
    expect(m.announced).toEqual(['La lecture n’a pas pu démarrer.'])
    expect(m.c.state).toBe('stopped')
    expect(m.engines[0].stops).toBe(1)
    expect(m.leases.taken).toBe(0)
    expect(m.pending()).toBe(0)
  })
  it('a media element that fails mid-stream: said (the file message), the lease and the loop are released, the engine is stopped; after a Stop it is ignored', async () => {
    const m = make()
    await m.c.play({ kind: 'file', file: new File([new Uint8Array(1)], 'a.wav') })
    m.announced.length = 0
    m.engines[0].onFailed!()
    expect(m.c.state).toBe('stopped')
    expect(m.leases.held).toBe(0)
    expect(m.pending()).toBe(0)
    expect(m.engines[0].stops).toBe(1)
    expect(m.announced).toEqual(['Ce fichier n’a pas pu être lu. Essayez un fichier MP3, WAV ou OGG.'])
    const m2 = make()
    await m2.c.play(TEST)
    const failed = m2.engines[0].onFailed!
    m2.c.stop()
    m2.announced.length = 0
    expect(m2.engines[0].onFailed).toBeNull() // detached at stop
    failed()
    expect(m2.announced).toEqual([])
  })
  it('INTEGRATION with the real engine and a context whose resume() never settles: after the bounded wait the controller is stopped, said, and every context is closed', async () => {
    const { AudioEngine, RESUME_TIMEOUT_MS } = await import('../../src/audio/engine')
    const { fakeEnv } = await import('../audio/fakeAudio')
    const h = fakeEnv()
    const announced: string[] = []
    const base = make()
    const c = new ListenController({
      registry,
      design: () => base.store.design(),
      path: () => base.st.path,
      listener: () => base.st.listener,
      hold: () => () => undefined,
      announce: (x) => void announced.push(x),
      deviceLabel: (id) => id,
      subscribe: () => () => undefined,
      propsOpen: () => true,
      startDefault: () => undefined,
      bag: new DisposableBag(),
      container: {} as HTMLElement,
      before: null,
      frame: () => () => undefined,
      createEngine: async (ctx) => {
        const e = await AudioEngine.create(h.env, ctx)
        h.contexts[0].deferResume = true
        return e
      },
      createPanel: () => ({ render: () => undefined }),
    })
    const mine = h.env.createContext()
    const p = c.play(TEST, mine)
    await flush()
    expect(c.state).toBe('starting')
    h.timers.find((t) => t.ms === RESUME_TIMEOUT_MS)!.fn()
    await p
    expect(c.state).toBe('stopped')
    expect(announced).toEqual(['La lecture n’a pas pu démarrer.'])
    h.flushTimers()
    await flush()
    expect(h.contexts[0].closeCalls).toBe(1) // the click's context was closed with the engine
  })
})
