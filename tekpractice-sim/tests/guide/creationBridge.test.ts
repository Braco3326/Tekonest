// The Mode Création data bridge: window.__creation (read only) to the guide's plain state, derived host events, rects and anchors.
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { makeRegistry } from '../helpers'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { templateToDesign } from '../../src/creation/templates'
import { Template } from '../../src/creation/templateSchema'
import { signalPath } from '../../src/flow/signalPath'
import { isAnchor } from '../../src/guide/anchors'
import { createCreationBridge, NAV_SELECTORS, POLL_MS, stateHash, type CreationReader } from '../../src/guide/bridge/creationBridge'
import type { TpBridge, TpPortRef, TpState } from '../../src/guide/bridge/types'
import type { HostEvent } from '../../src/guide/vendor/core/types'
import type { PortRef, TeachingEvent } from '../../src/engine/types'
import type { DesignState } from '../../src/trials/trial'

const registry = makeRegistry()

// ── fakes ───────────────────────────────────────────────────────────────────────────────────────────────────────────

interface World {
  design: DesignState
  events: TeachingEvent[]
  place: string | null
  ports: Record<string, string[]>
  devicePoint: Record<string, { x: number; y: number } | null>
  portPoint: Record<string, { x: number; y: number } | null>
  controlPoint: Record<string, { x: number; y: number } | null>
}

const MUTATORS = ['dispatch', 'undo', 'redo', 'setControlValue', 'choosePlace', 'requestPlace', 'frameDevice', 'focusScreen', 'setCameraRadius', 'turnCamera', 'setMetersLive', 'legendPreview'] as const

function emptyDesign(): DesignState {
  return { roomId: null, rig: { instances: [], connections: [], controls: {} }, placements: [] }
}
function benchWorld(): World {
  return {
    design: {
      roomId: 'room:concert-hall-medium',
      rig: {
        instances: [
          { instanceId: 'ql1', deviceId: 'yamaha-ql1' },
          { instanceId: 'k12', deviceId: 'qsc-k12-2' },
        ],
        connections: [],
        controls: { ql1: { power: true, 'playback-usb': false, 'fader-master': '0' }, k12: { power: true } },
      },
      placements: [],
    },
    events: [],
    place: 'room:concert-hall-medium',
    ports: { ql1: ['in-mic-1', 'out-main-l', 'out-main-r'], k12: ['in-line-a', 'power-in'] },
    devicePoint: { ql1: { x: 300, y: 400 }, k12: { x: 600, y: 420 } },
    portPoint: { 'ql1 out-main-l': { x: 320, y: 410 }, 'k12 in-line-a': { x: 590, y: 430 } },
    controlPoint: { 'ql1 playback-usb': { x: 310, y: 380 } },
  }
}
const key = (a: string, b: string): string => `${a} ${b}`

/** A plain object with the readers the bridge may call, and every mutating method of the real hook as a spy. */
function fakeCreation(w: World): { reader: CreationReader; spies: Record<string, ReturnType<typeof vi.fn>>; reads: Record<string, number> } {
  const reads: Record<string, number> = {}
  const count = (n: string): void => {
    reads[n] = (reads[n] ?? 0) + 1
  }
  const readers: CreationReader = {
    design: () => {
      count('design')
      return w.design
    },
    events: () => {
      count('events')
      return w.events
    },
    place: () => {
      count('place')
      return w.place
    },
    devicePorts: (id) => {
      count('devicePorts')
      return w.ports[id] ?? []
    },
    portScreen: (r: PortRef) => {
      count('portScreen')
      return w.portPoint[key(r.instance, r.port)] ?? null
    },
    deviceScreen: (id) => {
      count('deviceScreen')
      return w.devicePoint[id] ?? null
    },
    controlScreen: (i, c) => {
      count('controlScreen')
      return w.controlPoint[key(i, c)] ?? null
    },
  }
  const spies: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of MUTATORS) spies[m] = vi.fn()
  const reader = { ...readers, ...spies } as CreationReader
  return { reader, spies, reads }
}

function fakeTimers() {
  let next = 1
  const active = new Map<number, () => void>()
  const periods: number[] = []
  return {
    setInterval: (fn: () => void, ms: number): number => {
      const id = next++
      active.set(id, fn)
      periods.push(ms)
      return id
    },
    clearInterval: (id: number): void => {
      active.delete(id)
    },
    tick: (): void => {
      for (const fn of [...active.values()]) fn()
    },
    count: (): number => active.size,
    periods,
  }
}

interface FakeEl {
  getBoundingClientRect(): { x: number; y: number; width: number; height: number }
}
function fakeDoc() {
  const listeners = new Map<string, Set<() => void>>()
  const els = new Map<string, FakeEl>()
  const doc = {
    hidden: false,
    addEventListener: (t: string, fn: () => void): void => {
      if (!listeners.has(t)) listeners.set(t, new Set())
      listeners.get(t)!.add(fn)
    },
    removeEventListener: (t: string, fn: () => void): void => {
      listeners.get(t)?.delete(fn)
    },
    querySelector: vi.fn((sel: string): FakeEl | null => els.get(sel) ?? null),
  }
  return {
    doc,
    els,
    listenerCount: (): number => [...listeners.values()].reduce((n, s) => n + s.size, 0),
    setHidden(h: boolean): void {
      doc.hidden = h
      for (const fn of [...(listeners.get('visibilitychange') ?? [])]) fn()
    },
    put(sel: string, r: { x: number; y: number; width: number; height: number }): void {
      els.set(sel, { getBoundingClientRect: () => r })
    },
  }
}

interface Rig {
  world: World
  win: { __creation?: CreationReader; innerWidth?: number; innerHeight?: number }
  timers: ReturnType<typeof fakeTimers>
  d: ReturnType<typeof fakeDoc>
  spies: Record<string, ReturnType<typeof vi.fn>>
  reads: Record<string, number>
  bridge: TpBridge
  clock: { t: number }
}
function make(world: World = benchWorld(), opts: { noCreation?: boolean } = {}): Rig {
  const { reader, spies, reads } = fakeCreation(world)
  const win: Rig['win'] = { innerWidth: 1280, innerHeight: 800 }
  if (!opts.noCreation) win.__creation = reader
  const timers = fakeTimers()
  const d = fakeDoc()
  const clock = { t: 1000 }
  const bridge = createCreationBridge({
    win,
    registry,
    doc: d.doc,
    now: () => clock.t++,
    setInterval: timers.setInterval,
    clearInterval: timers.clearInterval,
  })
  return { world, win, timers, d, spies, reads, bridge, clock }
}
const subscribe = (r: Rig): { cb: ReturnType<typeof vi.fn>; calls: () => [TpState, HostEvent[]][] } => {
  const cb = vi.fn()
  r.bridge.onChange(cb)
  return { cb, calls: () => cb.mock.calls as [TpState, HostEvent[]][] }
}
const types = (e: HostEvent[]): string[] => e.map((x) => x.type)
const err = (instance: string, port: string): TeachingEvent => ({ ruleId: 'R5', severity: 'error', title: 't', teach: 't', subjects: [{ instance, port }] })
const cable = (a: string, b: string): { a: PortRef; b: PortRef } => {
  const [ai, ap] = a.split(' ')
  const [bi, bp] = b.split(' ')
  return { a: { instance: ai, port: ap }, b: { instance: bi, port: bp } }
}

let errorSpy: MockInstance
let warnSpy: MockInstance
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

// ── snapshot ────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('snapshot', () => {
  it('is null when __creation is absent, with no console error', () => {
    const r = make(benchWorld(), { noCreation: true })
    expect(r.bridge.snapshot()).toBeNull()
    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('is null after a throw, and recovers when the hook works again, with no console error', () => {
    const r = make()
    expect(r.bridge.snapshot()).not.toBeNull()
    const design = r.win.__creation!.design
    r.win.__creation!.design = () => {
      throw new Error('boom')
    }
    expect(r.bridge.snapshot()).toBeNull()
    r.win.__creation!.design = design
    expect(r.bridge.snapshot()).not.toBeNull()
    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('is null for a half-built hook (missing methods, null design, no rig), with no console error', () => {
    const r = make()
    const halfBuilt: unknown[] = [
      {},
      { design: () => null, events: () => [], place: () => null, devicePorts: () => [] },
      { design: () => ({ rig: null }), events: () => [], place: () => null, devicePorts: () => [] },
      { design: () => ({ rig: { instances: 'x', connections: [], controls: {} } }), events: () => [], place: () => null, devicePorts: () => [] },
      { design: () => ({ rig: { instances: [], connections: [], controls: {} } }), events: () => null, place: () => null, devicePorts: () => [] },
      { design: () => ({ rig: { instances: [], connections: [], controls: {} } }), events: () => [], place: () => undefined, devicePorts: () => [] },
    ]
    for (const h of halfBuilt) {
      r.win.__creation = h as CreationReader
      expect(r.bridge.snapshot()).toBeNull()
    }
    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('maps design(), events(), place() and devicePorts into the guide state', () => {
    const w = benchWorld()
    w.design.rig.connections = [cable('ql1 out-main-l', 'k12 in-line-a')]
    w.events = [err('k12', 'in-line-a')]
    const s = make(w).bridge.snapshot()!
    expect(s.route).toBe('creation')
    expect(s.placeKnown).toBe(true)
    expect(s.instances).toEqual([
      { id: 'ql1', deviceId: 'yamaha-ql1', label: 'Yamaha QL1' },
      { id: 'k12', deviceId: 'qsc-k12-2', label: 'QSC K12.2' },
    ])
    expect(s.connections).toEqual([cable('ql1 out-main-l', 'k12 in-line-a')])
    expect(s.controls).toEqual({ ql1: { power: true, 'playback-usb': false, 'fader-master': '0' }, k12: { power: true } })
    expect(s.events).toEqual([{ ruleId: 'R5', severity: 'error', subjects: [{ instance: 'k12', port: 'in-line-a' }] }])
    const expected = signalPath(w.design, registry, w.events)
    expect(s.playbackReady).toBe(expected.playbackReady)
    expect(s.firstReason).toEqual(expected.reasons[0] ? { code: expected.reasons[0].code, text_fr: expected.reasons[0].text_fr, subjects: expected.reasons[0].subjects } : null)
  })

  it('no place on screen gives placeKnown false; an unknown device keeps its id as label', () => {
    const w = benchWorld()
    w.place = null
    w.design.rig.instances.push({ instanceId: 'x1', deviceId: 'not-in-the-catalog' })
    const s = make(w).bridge.snapshot()!
    expect(s.placeKnown).toBe(false)
    expect(s.instances.find((i) => i.id === 'x1')!.label).toBe('not-in-the-catalog')
  })

  it('an empty bench is a state, not null, with a first reason from the app', () => {
    const w = benchWorld()
    w.design = emptyDesign()
    w.place = null
    const s = make(w).bridge.snapshot()!
    expect(s.instances).toEqual([])
    expect(s.playbackReady).toBe(false)
    expect(s.firstReason).not.toBeNull()
    expect(s.firstReason!.text_fr.length).toBeGreaterThan(0)
  })

  it('is a pure copy: editing the returned state or the source does not touch the other', () => {
    const w = benchWorld()
    w.design.rig.connections = [cable('ql1 out-main-l', 'k12 in-line-a')]
    w.events = [err('k12', 'in-line-a')]
    const r = make(w)
    const s = r.bridge.snapshot()!
    const before = stateHash(s)
    w.design.rig.instances.push({ instanceId: 'z', deviceId: 'qsc-k12-2' })
    w.design.rig.controls.ql1.power = false
    w.design.rig.connections[0].a.port = 'changed'
    w.events[0].subjects[0].port = 'changed'
    expect(stateHash(s)).toBe(before)
    const again = r.bridge.snapshot()!
    s.instances.length = 0
    s.controls.ql1.power = 'x'
    s.connections[0].b.instance = 'y'
    expect(r.bridge.snapshot()!).toEqual(again)
  })

  it('playbackReady is true on the powered reference rig, taken from the real signal path', () => {
    const store = new CreationStore(registry, creationEvaluator(registry), templateToDesign(Template.parse(JSON.parse(readFileSync('content/templates/concert-simple-reference.json', 'utf8')))))
    const ref = (s: string): PortRef => {
      const [instance, port] = s.split(' ')
      return { instance, port }
    }
    expect(store.dispatch({ type: 'CONNECT', a: ref('ql1 out-main-l'), b: ref('k12-g in-line-a') }).ok).toBe(true)
    expect(store.dispatch({ type: 'CONNECT', a: ref('ql1 out-main-r'), b: ref('k12-d in-line-a') }).ok).toBe(true)
    expect(store.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }).ok).toBe(true)
    const w = benchWorld()
    w.design = store.design()
    w.events = store.events()
    w.ports = {}
    const s = make(w).bridge.snapshot()!
    expect(s.playbackReady).toBe(true)
    expect(s.instances.map((i) => i.id)).toEqual(['ql1', 'sm58', 'k12-g', 'k12-d', 'mains'])
  })
})

// ── stateHash ───────────────────────────────────────────────────────────────────────────────────────────────────────

describe('stateHash', () => {
  const base = (): TpState => {
    const w = benchWorld()
    w.design.rig.connections = [cable('ql1 out-main-l', 'k12 in-line-a')]
    return make(w).bridge.snapshot()!
  }
  const clone = (s: TpState): TpState => JSON.parse(JSON.stringify(s)) as TpState

  it('is equal for equal states, and for a cable written the other way round', () => {
    const a = base()
    expect(stateHash(a)).toBe(stateHash(clone(a)))
    const flipped = clone(a)
    flipped.connections = [{ a: a.connections[0].b, b: a.connections[0].a }]
    expect(stateHash(flipped)).toBe(stateHash(a))
    const reordered = clone(a)
    reordered.instances.reverse()
    expect(stateHash(reordered)).toBe(stateHash(a))
  })

  it('differs on device, cable, control, event, place or playbackReady change', () => {
    const a = base()
    const h = stateHash(a)
    const variants: Record<string, (s: TpState) => void> = {
      'a new device': (s) => s.instances.push({ id: 'z', deviceId: 'qsc-k12-2', label: 'QSC K12.2' }),
      'a device of another model': (s) => {
        s.instances[0].deviceId = 'qsc-k12-2'
      },
      'a device removed': (s) => s.instances.pop(),
      'a cable removed': (s) => {
        s.connections = []
      },
      'a cable moved to another port': (s) => {
        s.connections[0].b.port = 'power-in'
      },
      'a toggle control': (s) => {
        s.controls.ql1.power = false
      },
      'an enum control': (s) => {
        s.controls.ql1['fader-master'] = '-6'
      },
      'a new control': (s) => {
        s.controls.ql1.extra = true
      },
      'an event': (s) => s.events.push({ ruleId: 'R5', severity: 'error', subjects: [] }),
      'an event severity': (s) => {
        s.events.push({ ruleId: 'R5', severity: 'error', subjects: [] })
        const t = clone(s)
        t.events[0].severity = 'warning'
        expect(stateHash(t)).not.toBe(stateHash(s))
      },
      'the place': (s) => {
        s.placeKnown = !s.placeKnown
      },
      'playbackReady': (s) => {
        s.playbackReady = !s.playbackReady
      },
      'the first reason': (s) => {
        s.firstReason = { code: 'NO_PATH', text_fr: 'x', subjects: [] }
      },
    }
    for (const [name, mutate] of Object.entries(variants)) {
      const s = clone(a)
      mutate(s)
      expect(stateHash(s), name).not.toBe(h)
    }
  })

  it('ignores the label (derived from the model) and returns a string', () => {
    const a = base()
    const b = clone(a)
    b.instances[0].label = 'Other'
    expect(typeof stateHash(a)).toBe('string')
    expect(stateHash(b)).toBe(stateHash(a))
  })
})

// ── polling and derived events ──────────────────────────────────────────────────────────────────────────────────────

describe('polling', () => {
  it('polls every 500 ms, starts with the first listener only', () => {
    const r = make()
    expect(POLL_MS).toBe(500)
    expect(r.timers.count()).toBe(0)
    subscribe(r)
    expect(r.timers.count()).toBe(1)
    expect(r.timers.periods).toEqual([500])
  })

  it('a poll that sees no change calls no listener', () => {
    const r = make()
    const { cb } = subscribe(r)
    for (let i = 0; i < 5; i++) r.timers.tick()
    expect(cb).not.toHaveBeenCalled()
  })

  it('a change calls the listener once with the new state, and the next quiet poll calls nothing', () => {
    const r = make()
    const { cb, calls } = subscribe(r)
    r.world.design.rig.controls.ql1['playback-usb'] = true
    r.timers.tick()
    r.timers.tick()
    expect(cb).toHaveBeenCalledTimes(1)
    expect(calls()[0][0].controls.ql1['playback-usb']).toBe(true)
  })

  it('a poll over an unready app stays quiet, then reports the first state without derived events', () => {
    const r = make(benchWorld(), { noCreation: true })
    const { cb, calls } = subscribe(r)
    r.timers.tick()
    r.timers.tick()
    expect(cb).not.toHaveBeenCalled()
    r.win.__creation = fakeCreation(r.world).reader
    r.timers.tick()
    expect(cb).toHaveBeenCalledTimes(1)
    expect(calls()[0][1]).toEqual([])
    expect(calls()[0][0].instances).toHaveLength(2)
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('a throw during a poll is swallowed, the poll goes on, and nothing reaches console.error', () => {
    const r = make()
    const { cb } = subscribe(r)
    const design = r.win.__creation!.design
    r.win.__creation!.design = () => {
      throw new Error('boom')
    }
    expect(() => r.timers.tick()).not.toThrow()
    r.win.__creation!.design = design
    r.world.design.rig.controls.ql1.power = false
    r.timers.tick()
    expect(cb).toHaveBeenCalledTimes(1)
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('a listener that throws does not stop the others or the poll', () => {
    const r = make()
    const bad = vi.fn(() => {
      throw new Error('listener')
    })
    const good = vi.fn()
    r.bridge.onChange(bad)
    r.bridge.onChange(good)
    r.world.design.rig.controls.ql1.power = false
    expect(() => r.timers.tick()).not.toThrow()
    expect(bad).toHaveBeenCalledTimes(1)
    expect(good).toHaveBeenCalledTimes(1)
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('pauses while document.hidden and resumes on visibility, catching up at once', () => {
    const r = make()
    const { cb } = subscribe(r)
    expect(r.timers.count()).toBe(1)
    r.d.setHidden(true)
    expect(r.timers.count()).toBe(0)
    r.timers.tick()
    r.world.design.rig.controls.ql1.power = false
    r.timers.tick()
    expect(cb).not.toHaveBeenCalled()
    r.d.setHidden(false)
    expect(r.timers.count()).toBe(1)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('a bridge created while the document is hidden does not poll until it is shown', () => {
    const w = benchWorld()
    const { reader } = fakeCreation(w)
    const timers = fakeTimers()
    const d = fakeDoc()
    d.doc.hidden = true
    const bridge = createCreationBridge({ win: { __creation: reader }, registry, doc: d.doc, now: () => 0, setInterval: timers.setInterval, clearInterval: timers.clearInterval })
    bridge.onChange(() => {})
    expect(timers.count()).toBe(0)
    d.setHidden(false)
    expect(timers.count()).toBe(1)
  })

  it('a hidden poll never reads the hook', () => {
    const r = make()
    subscribe(r)
    r.d.setHidden(true)
    const before = r.reads.design
    r.timers.tick()
    expect(r.reads.design).toBe(before)
  })

  it('removing the last listener stops the timer and the page listener', () => {
    const r = make()
    const off1 = r.bridge.onChange(() => {})
    const off2 = r.bridge.onChange(() => {})
    off1()
    expect(r.timers.count()).toBe(1)
    off2()
    off2()
    expect(r.timers.count()).toBe(0)
    expect(r.d.listenerCount()).toBe(0)
  })

  it('destroy clears the timer and listeners (the fake timer count returns to 0), twice is fine', () => {
    const r = make()
    const { cb } = subscribe(r)
    expect(r.timers.count()).toBe(1)
    expect(r.d.listenerCount()).toBe(1)
    r.bridge.destroy()
    r.bridge.destroy()
    expect(r.timers.count()).toBe(0)
    expect(r.d.listenerCount()).toBe(0)
    r.world.design.rig.controls.ql1.power = false
    r.timers.tick()
    expect(cb).not.toHaveBeenCalled()
    r.bridge.onChange(cb)()
    expect(r.timers.count()).toBe(0)
    expect(r.d.listenerCount()).toBe(0)
  })
})

describe('derived host events', () => {
  it('adding a cable emits connect with both port anchors, removing it emits disconnect', () => {
    const r = make()
    const { calls } = subscribe(r)
    r.world.design.rig.connections = [cable('ql1 out-main-l', 'k12 in-line-a')]
    r.timers.tick()
    expect(calls()).toHaveLength(1)
    const [state, events] = calls()[0]
    expect(types(events)).toEqual(['connect'])
    const a = r.bridge.anchorOfPort({ instance: 'ql1', port: 'out-main-l' })
    const b = r.bridge.anchorOfPort({ instance: 'k12', port: 'in-line-a' })
    expect(events[0].data).toEqual({ a, b })
    expect(isAnchor(a) && isAnchor(b) && a !== b).toBe(true)
    expect(typeof events[0].at).toBe('number')
    expect(state.connections).toHaveLength(1)

    r.world.design.rig.connections = []
    r.timers.tick()
    const [, off] = calls()[1]
    expect(types(off)).toEqual(['disconnect'])
    expect(off[0].data).toEqual({ a, b })
  })

  it('a cable written the other way round is not a new cable', () => {
    const w = benchWorld()
    w.design.rig.connections = [cable('ql1 out-main-l', 'k12 in-line-a')]
    const r = make(w)
    const { cb } = subscribe(r)
    r.world.design.rig.connections = [cable('k12 in-line-a', 'ql1 out-main-l')]
    r.timers.tick()
    expect(cb).not.toHaveBeenCalled()
  })

  it('removing a device with a cable still reports the disconnect with the anchors the guide knew', () => {
    const w = benchWorld()
    w.design.rig.connections = [cable('ql1 out-main-l', 'k12 in-line-a')]
    const r = make(w)
    const { calls } = subscribe(r)
    const a = r.bridge.anchorOfPort({ instance: 'ql1', port: 'out-main-l' })
    const b = r.bridge.anchorOfPort({ instance: 'k12', port: 'in-line-a' })
    r.world.design.rig.instances = r.world.design.rig.instances.filter((i) => i.instanceId !== 'k12')
    r.world.design.rig.connections = []
    r.timers.tick()
    const events = calls()[0][1]
    expect(types(events)).toEqual(['disconnect'])
    expect(events[0].data).toEqual({ a, b })
  })

  it('a toggle control change emits toggle with the control anchor and the new value', () => {
    const r = make()
    const { calls } = subscribe(r)
    r.world.design.rig.controls.ql1['playback-usb'] = true
    r.timers.tick()
    const events = calls()[0][1]
    expect(types(events)).toEqual(['toggle'])
    expect(events[0].data).toEqual({ control: 'control:ql1.playback-usb', anchor: 'control:ql1.playback-usb', value: true })
    r.world.design.rig.controls.ql1['playback-usb'] = false
    r.timers.tick()
    expect(calls()[1][1][0].data).toEqual({ control: 'control:ql1.playback-usb', anchor: 'control:ql1.playback-usb', value: false })
  })

  it('R6: the toggle data carries both `control` and `anchor`, the same valid anchor string, plus the value', () => {
    const r = make()
    const { calls } = subscribe(r)
    r.world.design.rig.controls.ql1['playback-usb'] = true
    r.timers.tick()
    const data = calls()[0][1][0].data as Record<string, string | boolean>
    expect(Object.keys(data).sort()).toEqual(['anchor', 'control', 'value'])
    expect(data.control).toBe(data.anchor)
    expect(isAnchor(String(data.anchor))).toBe(true)
    expect(r.bridge.rectOf(String(data.anchor))).not.toBeNull()
  })

  it('R7: placeChosen is emitted once when placeKnown goes false to true, and never for the other flips', () => {
    const w = benchWorld()
    w.design = emptyDesign()
    w.place = null
    const r = make(w)
    const { calls } = subscribe(r)
    r.world.place = 'room:concert-hall-medium'
    r.timers.tick()
    expect(types(calls()[0][1])).toEqual(['placeChosen'])
    expect(calls()[0][1][0].data).toBeUndefined()
    // a quiet poll, then the place going away and a different place: no new placeChosen unless it comes back from none
    r.timers.tick()
    expect(calls()).toHaveLength(1)
    r.world.place = null
    r.timers.tick()
    expect(types(calls()[1][1])).toEqual([])
    r.world.place = 'room:x'
    r.timers.tick()
    expect(types(calls()[2][1])).toEqual(['placeChosen'])
    // another place while one is known is not a state change for the guide at all (only `placeKnown` is kept)
    r.world.place = 'room:y'
    r.timers.tick()
    expect(calls()).toHaveLength(3)
  })

  it('R7: `place` keeps its meaning (the first device on an empty bench), placeChosen is separate', () => {
    const w = benchWorld()
    w.design = emptyDesign()
    w.place = null
    const r = make(w)
    const { calls } = subscribe(r)
    r.world.place = 'room:a'
    r.world.design.rig.instances = [{ instanceId: 'ql1', deviceId: 'yamaha-ql1' }]
    r.world.design.rig.controls = { ql1: { power: true } }
    r.timers.tick()
    expect(types(calls()[0][1]).sort()).toEqual(['deviceAdded', 'place', 'placeChosen'])
  })

  it('R6: anchorOfPort(null) and a malformed ref give an empty string, never a throw', () => {
    const r = make()
    expect(r.bridge.anchorOfPort(null as unknown as TpPortRef)).toBe('')
    expect(r.bridge.anchorOfPort(undefined as unknown as TpPortRef)).toBe('')
    expect(r.bridge.anchorOfPort({ instance: 1, port: 'x' } as unknown as TpPortRef)).toBe('')
    expect(r.bridge.anchorOfDevice(null as unknown as string)).toBe('')
  })

  it('anchorOfControl gives the control anchor the toggle event uses, and a valid anchor for an unlisted one', () => {
    const r = make()
    r.bridge.snapshot()
    expect(r.bridge.anchorOfControl('ql1', 'playback-usb')).toBe('control:ql1.playback-usb')
    expect(isAnchor(r.bridge.anchorOfControl('nobody', 'x y'))).toBe(true)
    expect(r.bridge.anchorOfControl(null as unknown as string, 'x')).toBe('')
  })

  it('an enum control change changes the state but emits no toggle', () => {
    const r = make()
    const { calls } = subscribe(r)
    r.world.design.rig.controls.ql1['fader-master'] = '-6'
    r.timers.tick()
    expect(calls()).toHaveLength(1)
    expect(calls()[0][1]).toEqual([])
  })

  it('every new device emits deviceAdded with its anchor, and the first device of an empty bench also emits place', () => {
    const w = benchWorld()
    w.design = emptyDesign()
    w.place = null
    const r = make(w)
    const { calls } = subscribe(r)
    r.world.design.rig.instances = [{ instanceId: 'ql1', deviceId: 'yamaha-ql1' }]
    r.world.design.rig.controls = { ql1: { power: true } }
    r.timers.tick()
    const first = calls()[0][1]
    expect(types(first)).toEqual(['deviceAdded', 'place'])
    expect(first[0].data).toEqual({ device: 'device:ql1' })
    expect(first[1].data).toEqual({ device: 'device:ql1' })
    // a new device's own controls are not a toggle
    r.world.design.rig.instances.push({ instanceId: 'k12', deviceId: 'qsc-k12-2' })
    r.world.design.rig.controls.k12 = { power: true }
    r.timers.tick()
    const second = calls()[1][1]
    expect(types(second)).toEqual(['deviceAdded'])
    expect(second[0].data).toEqual({ device: 'device:k12' })
  })

  it('two devices added in one poll on an empty bench give two deviceAdded and one place', () => {
    const w = benchWorld()
    w.design = emptyDesign()
    const r = make(w)
    const { calls } = subscribe(r)
    r.world.design.rig.instances = [
      { instanceId: 'a', deviceId: 'yamaha-ql1' },
      { instanceId: 'b', deviceId: 'qsc-k12-2' },
    ]
    r.timers.tick()
    expect(types(calls()[0][1])).toEqual(['deviceAdded', 'deviceAdded', 'place'])
  })

  it('an event, a place or a playback change is a state change without a host event', () => {
    const r = make()
    const { calls } = subscribe(r)
    r.world.events = [err('k12', 'in-line-a')]
    r.timers.tick()
    r.world.place = null
    r.timers.tick()
    expect(calls()).toHaveLength(2)
    expect(calls()[0][1]).toEqual([])
    expect(calls()[1][1]).toEqual([])
    expect(calls()[1][0].placeKnown).toBe(false)
  })

  it('the host events carry the clock of the page', () => {
    const r = make()
    const { calls } = subscribe(r)
    r.clock.t = 123456
    r.world.design.rig.controls.ql1['playback-usb'] = true
    r.timers.tick()
    expect(calls()[0][1][0].at).toBeGreaterThanOrEqual(123456)
  })
})

// ── anchors and rects ───────────────────────────────────────────────────────────────────────────────────────────────

describe('anchors', () => {
  it('anchors of devices and ports are valid and map back through rectOf', () => {
    const r = make()
    const d = r.bridge.anchorOfDevice('ql1')
    const p = r.bridge.anchorOfPort({ instance: 'ql1', port: 'out-main-l' })
    expect(d).toBe('device:ql1')
    expect(p).toBe('port:ql1.out-main-l')
    expect(isAnchor(d) && isAnchor(p)).toBe(true)
    expect(r.bridge.rectOf(d)).toEqual({ x: 272, y: 372, w: 56, h: 56 })
    expect(r.bridge.rectOf(p)).toEqual({ x: 308, y: 398, w: 24, h: 24 })
  })

  it('ids with capitals, spaces, dots, accents, 80+ characters and collisions give distinct valid anchors, none dropped', () => {
    const w = benchWorld()
    const ids = ['Mixer 1', 'mixer-1', 'MIXER-1', 'été.1', 'a😀b', 'x'.repeat(95), 'x'.repeat(96), 'k12']
    w.design.rig.instances = ids.map((i) => ({ instanceId: i, deviceId: 'qsc-k12-2' }))
    w.design.rig.controls = Object.fromEntries(ids.map((i) => [i, { power: true }]))
    w.ports = Object.fromEntries(ids.map((i) => [i, ['In 1', 'in-1', 'IN-1', 'power-in']]))
    w.devicePoint = Object.fromEntries(ids.map((i, n) => [i, { x: 100 + n * 10, y: 200 }]))
    w.portPoint = Object.fromEntries(ids.flatMap((i, n) => ['In 1', 'in-1', 'IN-1', 'power-in'].map((p, m) => [key(i, p), { x: 100 + n * 10, y: 300 + m }])))
    const r = make(w)
    const s = r.bridge.snapshot()!
    expect(s.instances.map((i) => i.id)).toEqual(ids)
    const devices = ids.map((i) => r.bridge.anchorOfDevice(i))
    const ports = ids.flatMap((i) => ['In 1', 'in-1', 'IN-1', 'power-in'].map((p) => r.bridge.anchorOfPort({ instance: i, port: p })))
    const all = [...devices, ...ports]
    expect(new Set(all).size).toBe(all.length)
    for (const a of all) expect(isAnchor(a), a).toBe(true)
    // each anchor resolves to its own point
    ids.forEach((_i, n) => expect(r.bridge.rectOf(devices[n])).toEqual({ x: 100 + n * 10 - 28, y: 200 - 28, w: 56, h: 56 }))
    ids.forEach((i, n) =>
      ['In 1', 'in-1', 'IN-1', 'power-in'].forEach((p, m) => expect(r.bridge.rectOf(r.bridge.anchorOfPort({ instance: i, port: p }))).toEqual({ x: 100 + n * 10 - 12, y: 300 + m - 12, w: 24, h: 24 })),
    )
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('the same state gives the same anchors on every snapshot', () => {
    const w = benchWorld()
    w.design.rig.instances.push({ instanceId: 'QL1', deviceId: 'yamaha-ql1' })
    const r = make(w)
    r.bridge.snapshot()
    const first = [r.bridge.anchorOfDevice('ql1'), r.bridge.anchorOfDevice('QL1'), r.bridge.anchorOfPort({ instance: 'QL1', port: 'a b' })]
    r.bridge.snapshot()
    r.bridge.snapshot()
    expect([r.bridge.anchorOfDevice('ql1'), r.bridge.anchorOfDevice('QL1'), r.bridge.anchorOfPort({ instance: 'QL1', port: 'a b' })]).toEqual(first)
    expect(first[0]).not.toBe(first[1])
  })

  it('a port, a control or a device the hook does not list is still given a valid anchor (a cable can name one)', () => {
    const w = benchWorld()
    w.design.rig.connections = [cable('ql1 ghost-port', 'k12 in-line-a')]
    const r = make(w)
    r.bridge.snapshot()
    const g = r.bridge.anchorOfPort({ instance: 'ql1', port: 'ghost-port' })
    expect(isAnchor(g)).toBe(true)
    expect(r.bridge.anchorOfPort({ instance: 'nobody', port: 'x' })).toMatch(/^port:/)
    expect(isAnchor(r.bridge.anchorOfDevice('nobody'))).toBe(true)
  })
})

describe('rectOf', () => {
  it('resolves port:, device: and control: through portScreen, deviceScreen and controlScreen', () => {
    const r = make()
    r.bridge.snapshot()
    expect(r.bridge.rectOf('device:k12')).toEqual({ x: 572, y: 392, w: 56, h: 56 })
    expect(r.bridge.rectOf('port:k12.in-line-a')).toEqual({ x: 578, y: 418, w: 24, h: 24 })
    expect(r.bridge.rectOf('control:ql1.playback-usb')).toEqual({ x: 296, y: 366, w: 28, h: 28 })
    expect(r.reads.deviceScreen).toBe(1)
    expect(r.reads.portScreen).toBe(1)
    expect(r.reads.controlScreen).toBe(1)
  })

  it('returns null for an unknown anchor, a malformed one, and a null or off-screen projection', () => {
    const r = make()
    r.bridge.snapshot()
    for (const a of ['device:nobody', 'port:nobody.x', 'control:ql1.nope', 'nav:nope', 'bogus', '', 'device:', 'port:ql1.out-main-r', 'DEVICE:ql1']) expect(r.bridge.rectOf(a), a).toBeNull()
    // port out-main-r exists on the device but the scene has no projection for it (off screen, hidden): null, never {0,0}
    expect(r.bridge.rectOf(r.bridge.anchorOfPort({ instance: 'ql1', port: 'out-main-r' }))).toBeNull()
    r.world.devicePoint.ql1 = { x: 5000, y: 100 }
    expect(r.bridge.rectOf('device:ql1')).toBeNull()
    r.world.devicePoint.ql1 = { x: 100, y: -300 }
    expect(r.bridge.rectOf('device:ql1')).toBeNull()
    r.world.devicePoint.ql1 = { x: NaN, y: 100 }
    expect(r.bridge.rectOf('device:ql1')).toBeNull()
    r.world.devicePoint.ql1 = { x: Infinity, y: 100 }
    expect(r.bridge.rectOf('device:ql1')).toBeNull()
    r.world.devicePoint.ql1 = null
    expect(r.bridge.rectOf('device:ql1')).toBeNull()
  })

  it('without a window size, a finite projection is kept', () => {
    const r = make()
    delete r.win.innerWidth
    delete r.win.innerHeight
    r.world.devicePoint.ql1 = { x: 5000, y: 100 }
    expect(r.bridge.rectOf('device:ql1')).not.toBeNull()
  })

  it('a device added since the last poll resolves at once (the table is refreshed on a miss)', () => {
    const r = make()
    r.bridge.snapshot()
    r.world.design.rig.instances.push({ instanceId: 'newbie', deviceId: 'qsc-k12-2' })
    r.world.devicePoint.newbie = { x: 700, y: 500 }
    expect(r.bridge.rectOf('device:newbie')).toEqual({ x: 672, y: 472, w: 56, h: 56 })
  })

  it('is null, never a throw, while the hook is absent or throwing', () => {
    const r = make()
    r.bridge.snapshot()
    r.win.__creation!.deviceScreen = () => {
      throw new Error('boom')
    }
    expect(r.bridge.rectOf('device:ql1')).toBeNull()
    delete r.win.__creation
    expect(r.bridge.rectOf('device:ql1')).toBeNull()
    expect(r.bridge.rectOf('port:ql1.out-main-l')).toBeNull()
    expect(errorSpy).not.toHaveBeenCalled()
  })
})

describe('nav anchors', () => {
  it('declares nav:inventory, nav:place and nav:status, each with at least one selector', () => {
    for (const k of ['nav:inventory', 'nav:place', 'nav:status']) {
      expect(NAV_SELECTORS[k], k).toBeDefined()
      expect(NAV_SELECTORS[k].length).toBeGreaterThan(0)
      expect(isAnchor(k)).toBe(true)
    }
  })

  it('resolve by the selector map, from the element box in page px', () => {
    const r = make()
    r.d.put(NAV_SELECTORS['nav:status'][0], { x: 0, y: 760, width: 1280, height: 40 })
    expect(r.bridge.rectOf('nav:status')).toEqual({ x: 0, y: 760, w: 1280, h: 40 })
  })

  it('are null when the element is absent or has zero size, and fall back to the next selector', () => {
    const r = make()
    expect(r.bridge.rectOf('nav:inventory')).toBeNull()
    const [first, second] = NAV_SELECTORS['nav:inventory']
    expect(second).toBeDefined()
    r.d.put(first, { x: 10, y: 10, width: 0, height: 0 })
    expect(r.bridge.rectOf('nav:inventory')).toBeNull()
    r.d.put(second, { x: 20, y: 30, width: 90, height: 24 })
    expect(r.bridge.rectOf('nav:inventory')).toEqual({ x: 20, y: 30, w: 90, h: 24 })
    r.d.put(first, { x: 10, y: 600, width: 500, height: 200 })
    expect(r.bridge.rectOf('nav:inventory')).toEqual({ x: 10, y: 600, w: 500, h: 200 })
  })

  it('are null for NaN boxes, a throwing selector, and an unknown nav name', () => {
    const r = make()
    r.d.put(NAV_SELECTORS['nav:status'][0], { x: NaN, y: 0, width: 10, height: 10 })
    expect(r.bridge.rectOf('nav:status')).toBeNull()
    r.d.doc.querySelector.mockImplementation(() => {
      throw new Error('bad selector')
    })
    expect(r.bridge.rectOf('nav:status')).toBeNull()
    expect(r.bridge.rectOf('nav:does-not-exist')).toBeNull()
    expect(r.bridge.rectOf('nav:constructor')).toBeNull()
    expect(r.bridge.rectOf('nav:__proto__')).toBeNull()
  })

  it('resolve even while __creation is absent (the shell is there before the hook)', () => {
    const r = make(benchWorld(), { noCreation: true })
    r.d.put(NAV_SELECTORS['nav:place'][0], { x: 1, y: 2, width: 3, height: 4 })
    expect(r.bridge.rectOf('nav:place')).toEqual({ x: 1, y: 2, w: 3, h: 4 })
  })
})

// ── the guide never changes the app ─────────────────────────────────────────────────────────────────────────────────

describe('read only', () => {
  it('the bridge never calls a method that mutates', () => {
    const r = make()
    const { cb } = subscribe(r)
    r.bridge.snapshot()
    r.world.design.rig.connections = [cable('ql1 out-main-l', 'k12 in-line-a')]
    r.world.design.rig.controls.ql1['playback-usb'] = true
    r.world.design.rig.instances.push({ instanceId: 'n', deviceId: 'qsc-k12-2' })
    r.timers.tick()
    r.bridge.anchorOfDevice('n')
    r.bridge.anchorOfPort({ instance: 'n', port: 'power-in' })
    for (const a of ['device:ql1', 'port:ql1.out-main-l', 'control:ql1.playback-usb', 'nav:status', 'device:nope']) r.bridge.rectOf(a)
    r.d.setHidden(true)
    r.d.setHidden(false)
    r.bridge.destroy()
    expect(cb).toHaveBeenCalled()
    for (const m of MUTATORS) expect(r.spies[m], m).not.toHaveBeenCalled()
  })

  it('the typed hook has readers only: a mutating method is a compile error', () => {
    const r = fakeCreation(benchWorld()).reader
    // @ts-expect-error dispatch is not part of the reader
    void r.dispatch
    // @ts-expect-error setControlValue is not part of the reader
    void r.setControlValue
    // @ts-expect-error choosePlace is not part of the reader
    void r.choosePlace
    expect(typeof r.design).toBe('function')
  })
})

describe('real browser types', () => {
  it('a real Window and Document are accepted by the deps (compile-time check)', () => {
    const typecheck = (w: Window, d: Document): TpBridge => createCreationBridge({ win: w, registry, doc: d, now: Date.now, setInterval: w.setInterval.bind(w), clearInterval: w.clearInterval.bind(w) })
    expect(typeof typecheck).toBe('function')
  })
})
