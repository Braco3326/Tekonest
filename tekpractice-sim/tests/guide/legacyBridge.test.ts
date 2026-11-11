// The legacy level-play data bridge: window.__audioSim (read only) to the guide's plain state, derived host events, rects and anchors.
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { makeLevel, makeRegistry } from '../helpers'
import type { LevelState, PortRef, TeachingEvent } from '../../src/engine/types'
import { ruleTextFor, type RuleRow } from '../../src/creation/shell/statusModel'
import { chainLabel } from '../../src/ui/format'
import { isAnchor } from '../../src/guide/anchors'
import { POLL_MS } from '../../src/guide/bridge/creationBridge'
import { LEGACY_NAV_SELECTORS, createLegacyBridge, type LegacyReader } from '../../src/guide/bridge/legacyBridge'
import type { TpBridge, TpState } from '../../src/guide/bridge/types'
import { guideMode } from '../../src/guide/mode'
import { buildVerdict } from '../../src/guide/verdict'
import type { HostEvent } from '../../src/guide/vendor/core/types'

const registry = makeRegistry()
const level = makeLevel('a1')
const rules = registry.catalog.rules as unknown as readonly RuleRow[]

// ── fakes ───────────────────────────────────────────────────────────────────────────────────────────────────────────

interface World {
  /** Indexes of the required links that are made. */
  made: Set<number>
  violations: TeachingEvent[]
  assets: { instanceId: string; deviceId: string; status: 'glb' | 'placeholder' }[]
  devicePoint: Record<string, { x: number; y: number } | null>
  portPoint: Record<string, { x: number; y: number } | null>
}
const key = (a: string, b: string): string => `${a} ${b}`

function world(made: number[] = []): World {
  return {
    made: new Set(made),
    violations: [],
    assets: level.devices.map((d) => ({ instanceId: d.instanceId, deviceId: d.deviceId, status: 'glb' as const })),
    devicePoint: { 'sm58-1': { x: 300, y: 400 }, 'rio-1': { x: 600, y: 420 } },
    portPoint: { 'sm58-1 out-xlr': { x: 320, y: 410 }, 'rio-1 in-mic-1': { x: 590, y: 430 } },
  }
}
function levelState(w: World): LevelState {
  const missing = level.requiredChain.filter((_, i) => !w.made.has(i)).map((rc) => ({ from: { ...rc.from }, to: { ...rc.to } }))
  const chainComplete = missing.length === 0
  return { chainComplete, connectedRequired: level.requiredChain.length - missing.length, totalRequired: level.requiredChain.length, missing, violations: w.violations, won: chainComplete && w.violations.length === 0 }
}

/** The members of the real hook that are not readers. Every one of them is a spy: a call to one is a defect. */
const NON_READERS = ['dispatch', 'canConnect', 'view', 'glowCount', 'hints', 'camera', 'deviceBodyCenter', 'worldScreen', 'explore', 'pose', 'renders', 'cameraMoving', 'glbRoots'] as const

function fakeSim(w: World): { reader: LegacyReader; spies: Record<string, ReturnType<typeof vi.fn>>; reads: Record<string, number> } {
  const reads: Record<string, number> = {}
  const count = (n: string): void => {
    reads[n] = (reads[n] ?? 0) + 1
  }
  const readers = {
    level,
    state: () => {
      count('state')
      return levelState(w)
    },
    assets: () => {
      count('assets')
      return w.assets
    },
    portScreen: (r: PortRef) => {
      count('portScreen')
      return w.portPoint[key(r.instance, r.port)] ?? null
    },
    deviceScreen: (id: string) => {
      count('deviceScreen')
      return w.devicePoint[id] ?? null
    },
  }
  const spies: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of NON_READERS) spies[m] = m === 'hints' ? (vi.fn(() => false) as unknown as ReturnType<typeof vi.fn>) : vi.fn()
  return { reader: { ...readers, ...spies } as unknown as LegacyReader, spies, reads }
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
  win: { __audioSim?: LegacyReader; innerWidth?: number; innerHeight?: number }
  timers: ReturnType<typeof fakeTimers>
  d: ReturnType<typeof fakeDoc>
  spies: Record<string, ReturnType<typeof vi.fn>>
  reads: Record<string, number>
  bridge: TpBridge
}
function make(w: World = world(), opts: { noSim?: boolean } = {}): Rig {
  const { reader, spies, reads } = fakeSim(w)
  const win: Rig['win'] = { innerWidth: 1280, innerHeight: 800 }
  if (!opts.noSim) win.__audioSim = reader
  const timers = fakeTimers()
  const d = fakeDoc()
  let t = 1000
  const bridge = createLegacyBridge({ win, registry, doc: d.doc, now: () => t++, setInterval: timers.setInterval, clearInterval: timers.clearInterval })
  return { world: w, win, timers, d, spies, reads, bridge }
}
const subscribe = (r: Rig): { cb: ReturnType<typeof vi.fn>; calls: () => [TpState, HostEvent[]][] } => {
  const cb = vi.fn()
  r.bridge.onChange(cb)
  return { cb, calls: () => cb.mock.calls as [TpState, HostEvent[]][] }
}
const types = (e: HostEvent[]): string[] => e.map((x) => x.type)
const violation = (ruleId: string, severity: 'error' | 'warning', subjects: PortRef[]): TeachingEvent => ({ ruleId, severity, title: 'English title', teach: 'English teach', subjects })

let errorSpy: MockInstance
let warnSpy: MockInstance
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  expect(errorSpy).not.toHaveBeenCalled()
  expect(warnSpy).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

// ── the four named tests of the brief ───────────────────────────────────────────────────────────────────────────────

describe('snapshot', () => {
  it('snapshot maps level state and events with French rule text', () => {
    const w = world([0, 1])
    w.violations = [violation('R4', 'error', [{ instance: 'sm58-1', port: 'out-xlr' }])]
    const s = make(w).bridge.snapshot()!
    expect(s.route).toBe('legacy')
    expect(s.placeKnown).toBe(true)
    expect(s.playbackReady).toBe(false)
    expect(s.controls).toEqual({})
    expect(s.instances.map((i) => [i.id, i.deviceId])).toEqual(level.devices.map((d) => [d.instanceId, d.deviceId]))
    expect(s.instances[0].label).toBe(registry.deviceById.get('shure-sm58')!.label)
    // the made required links are the cables the guide knows of
    expect(s.connections).toEqual([
      { a: level.requiredChain[0].from, b: level.requiredChain[0].to },
      { a: level.requiredChain[1].from, b: level.requiredChain[1].to },
    ])
    expect(s.events).toEqual([{ ruleId: 'R4', severity: 'error', subjects: [{ instance: 'sm58-1', port: 'out-xlr' }] }])
    // the first unmet required link, worded as the app's own checklist words it
    const next = level.requiredChain[2]
    expect(s.firstReason).toEqual({ code: 'missing-link', text_fr: chainLabel(registry, level, next), subjects: [next.from, next.to] })
    // the French text of the violation is looked up from the catalog, not taken from the toast's English text
    const v = buildVerdict(s, ruleTextFor(rules))
    const rule = rules.find((r) => r.id === 'R4')!
    expect(v.result).toBe('a-corriger')
    expect(v.primary?.causeFr).toBe(rule.title_fr)
    expect(v.primary?.fixFr).toBe(rule.teach_fr)
    expect(JSON.stringify(v)).not.toContain('English')
  })

  it('a won level is playbackReady, has no first reason, and the verdict is good', () => {
    const s = make(world([0, 1, 2, 3, 4])).bridge.snapshot()!
    expect(s.playbackReady).toBe(true)
    expect(s.firstReason).toBeNull()
    expect(s.connections).toHaveLength(5)
    expect(buildVerdict(s, ruleTextFor(rules)).result).toBe('bon')
  })

  it('a copy: a later change of the hook does not change a snapshot already taken', () => {
    const r = make(world([0]))
    const a = r.bridge.snapshot()!
    r.world.made.add(1)
    expect(a.connections).toHaveLength(1)
    expect(r.bridge.snapshot()!.connections).toHaveLength(2)
  })

  it('maps every violation, the warning ones included, and a severity it does not know as an error', () => {
    const w = world()
    w.violations = [violation('R5', 'warning', [{ instance: 'rio-1', port: 'in-mic-1' }]), violation('R6', 'weird' as 'error', [])]
    const s = make(w).bridge.snapshot()!
    expect(s.events.map((e) => [e.ruleId, e.severity])).toEqual([['R5', 'warning'], ['R6', 'error']])
  })

  it('is null, quietly, while the hook is absent, half built or throwing', () => {
    expect(make(world(), { noSim: true }).bridge.snapshot()).toBeNull()
    const r = make()
    ;(r.win.__audioSim as unknown as { state: () => unknown }).state = () => {
      throw new Error('not ready')
    }
    expect(r.bridge.snapshot()).toBeNull()
    ;(r.win.__audioSim as unknown as { state: () => unknown }).state = () => ({ violations: 'nope' })
    expect(r.bridge.snapshot()).toBeNull()
    const noLevel = make()
    ;(noLevel.win.__audioSim as unknown as { level: unknown }).level = undefined
    expect(noLevel.bridge.snapshot()).toBeNull()
  })

  it('falls back to the level devices when the hook lists no assets', () => {
    const r = make()
    ;(r.win.__audioSim as unknown as { assets: () => unknown }).assets = () => {
      throw new Error('no assets')
    }
    expect(r.bridge.snapshot()!.instances.map((i) => i.id)).toEqual(level.devices.map((d) => d.instanceId))
  })
})

describe('rectOf', () => {
  it('rectOf uses portScreen/deviceScreen and returns null off screen', () => {
    const r = make()
    const s = r.bridge.snapshot()!
    const dev = r.bridge.anchorOfDevice('sm58-1')
    const port = r.bridge.anchorOfPort({ instance: 'sm58-1', port: 'out-xlr' })
    expect(s.instances).not.toHaveLength(0)
    expect(r.bridge.rectOf(dev)).toEqual({ x: 272, y: 372, w: 56, h: 56 })
    expect(r.bridge.rectOf(port)).toEqual({ x: 308, y: 398, w: 24, h: 24 })
    expect(r.reads.deviceScreen).toBe(1)
    expect(r.reads.portScreen).toBe(1)
    // off screen: the centre is outside the window
    r.world.portPoint['sm58-1 out-xlr'] = { x: 1400, y: 410 }
    expect(r.bridge.rectOf(port)).toBeNull()
    r.world.portPoint['sm58-1 out-xlr'] = { x: -5, y: 410 }
    expect(r.bridge.rectOf(port)).toBeNull()
    r.world.devicePoint['sm58-1'] = { x: 300, y: 900 }
    expect(r.bridge.rectOf(dev)).toBeNull()
  })

  it('is null, never a rect at 0,0, for a 2D board (no projection), NaN, infinity, unknown or malformed anchors, and a missing hook', () => {
    const r = make()
    r.bridge.snapshot()
    const dev = r.bridge.anchorOfDevice('sm58-1')
    const port = r.bridge.anchorOfPort({ instance: 'sm58-1', port: 'out-xlr' })
    r.world.devicePoint['sm58-1'] = null // the 2D board answers null
    r.world.portPoint['sm58-1 out-xlr'] = { x: Number.NaN, y: 3 }
    expect(r.bridge.rectOf(dev)).toBeNull()
    expect(r.bridge.rectOf(port)).toBeNull()
    r.world.portPoint['sm58-1 out-xlr'] = { x: Number.POSITIVE_INFINITY, y: 3 }
    expect(r.bridge.rectOf(port)).toBeNull()
    for (const bad of ['', 'x', 'device:', 'port:nope.nothing', 'device:not-there', 'control:sm58-1.power', 'port:' + 'a'.repeat(80), 7 as unknown as string, null as unknown as string]) {
      expect(r.bridge.rectOf(bad)).toBeNull()
    }
    const gone = make(world(), { noSim: true })
    expect(gone.bridge.rectOf('device:sm58-1')).toBeNull()
  })

  it('a hook whose projection throws gives null, not an exception', () => {
    const r = make()
    r.bridge.snapshot()
    const dev = r.bridge.anchorOfDevice('sm58-1')
    ;(r.win.__audioSim as unknown as { deviceScreen: () => never }).deviceScreen = () => {
      throw new Error('scene gone')
    }
    expect(r.bridge.rectOf(dev)).toBeNull()
  })

  it('a nav anchor is resolved from the page: the objectives panel, null when it is not there or has no size', () => {
    const r = make()
    expect(r.bridge.rectOf('nav:objectif')).toBeNull()
    r.d.put('#hud-objectives', { x: 10, y: 20, width: 300, height: 200 })
    expect(r.bridge.rectOf('nav:objectif')).toEqual({ x: 10, y: 20, w: 300, h: 200 })
    r.d.put('#hud-objectives', { x: 10, y: 20, width: 0, height: 200 })
    expect(r.bridge.rectOf('nav:objectif')).toBeNull()
    expect(r.bridge.rectOf('nav:status')).toBeNull() // a creation anchor: nothing of the legacy page
    expect(Object.keys(LEGACY_NAV_SELECTORS)).toEqual(['nav:objectif'])
  })
})

describe('the guide only reads', () => {
  it('nothing mutates the game (spy on every method except the readers)', () => {
    const r = make(world([0]))
    const got = subscribe(r)
    r.bridge.snapshot()
    const dev = r.bridge.anchorOfDevice('sm58-1')
    const port = r.bridge.anchorOfPort({ instance: 'sm58-1', port: 'out-xlr' })
    r.bridge.rectOf(dev)
    r.bridge.rectOf(port)
    r.world.made.add(1)
    r.timers.tick()
    r.d.setHidden(true)
    r.d.setHidden(false)
    r.timers.tick()
    r.bridge.destroy()
    expect(got.calls().length).toBeGreaterThan(0)
    for (const [name, spy] of Object.entries(r.spies)) expect(spy, `${name} must not be called`).not.toHaveBeenCalled()
    // and the readers it does use are only these
    expect(Object.keys(r.reads).sort()).toEqual(['assets', 'deviceScreen', 'portScreen', 'state'])
  })

  it('hints() being false never makes the guide mode exam by itself (mode is decided by the URL only)', () => {
    const r = make()
    expect((r.win.__audioSim as unknown as { hints: () => boolean }).hints()).toBe(false)
    r.spies.hints.mockClear()
    expect(guideMode('?level=a1', 'legacy')).toBe('practice')
    for (const level of ['a1', 'b1', 'c1', 'd1']) expect(guideMode(`?level=${level}`, 'legacy')).toBe('practice')
    // the bridge reads the bench with hints() reporting false, and never asks it
    expect(r.bridge.snapshot()).not.toBeNull()
    subscribe(r)
    r.timers.tick()
    expect(r.spies.hints).not.toHaveBeenCalled()
    // the exam surfaces stay exam, whatever hints() says
    for (const search of ['?level=a1&mode=exam', '?level=sandbox', '?legacy=1', '?level=zz', '?MODE=x&level=a1']) expect(guideMode(search, 'legacy')).toBe('exam')
  })
})

// ── anchors ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('anchors', () => {
  it('names a device and a port with the shared scheme; two different ports never share an anchor; a control has none', () => {
    const r = make()
    r.bridge.snapshot()
    const a = r.bridge.anchorOfPort({ instance: 'sm58-1', port: 'out-xlr' })
    const b = r.bridge.anchorOfPort({ instance: 'rio-1', port: 'in-mic-1' })
    expect(a).toBe('port:sm58-1.out-xlr')
    expect(b).toBe('port:rio-1.in-mic-1')
    expect(r.bridge.anchorOfDevice('rio-1')).toBe('device:rio-1')
    for (const x of [a, b, r.bridge.anchorOfDevice('rio-1')]) expect(isAnchor(x)).toBe(true)
    expect(r.bridge.anchorOfControl('sm58-1', 'power')).toBe('')
    expect(r.bridge.anchorOfPort({ instance: 1, port: 'x' } as unknown as { instance: string; port: string })).toBe('')
    expect(r.bridge.anchorOfDevice(5 as unknown as string)).toBe('')
  })
})

// ── change hash, derived events, the poll ───────────────────────────────────────────────────────────────────────────

describe('onChange', () => {
  it('polls every POLL_MS, calls back once at the first read, and again only on a change (a hash, not a copy)', () => {
    const r = make(world([0]))
    const got = subscribe(r)
    expect(r.timers.periods).toEqual([POLL_MS])
    r.timers.tick()
    r.timers.tick()
    expect(got.calls()).toHaveLength(0) // nothing changed since the base read
    r.world.made.add(1)
    r.timers.tick()
    expect(got.calls()).toHaveLength(1)
    r.timers.tick()
    expect(got.calls()).toHaveLength(1)
  })

  it('derives connect when a required link is made, and disconnect when one is pulled, with anchors', () => {
    const r = make(world([0]))
    const got = subscribe(r)
    r.world.made.add(1)
    r.timers.tick()
    const [, events] = got.calls()[0]
    expect(types(events)).toEqual(['connect'])
    const a = `port:${level.requiredChain[1].from.instance}.${level.requiredChain[1].from.port}`
    const b = `port:${level.requiredChain[1].to.instance}.${level.requiredChain[1].to.port}`
    expect(events[0].data).toEqual({ a, b })
    r.world.made.delete(1)
    r.timers.tick()
    const last = got.calls().at(-1)!
    expect(types(last[1])).toEqual(['disconnect'])
    expect(last[1][0].data).toEqual({ a, b })
  })

  it('a new violation is a change with no host event; a winning cable is a connect', () => {
    const r = make(world([0, 1, 2, 3]))
    const got = subscribe(r)
    r.world.violations = [violation('R4', 'error', [{ instance: 'sm58-1', port: 'out-xlr' }])]
    r.timers.tick()
    expect(got.calls()[0][1]).toEqual([])
    expect(got.calls()[0][0].events).toHaveLength(1)
    r.world.violations = []
    r.world.made.add(4)
    r.timers.tick()
    expect(types(got.calls().at(-1)![1])).toEqual(['connect'])
    expect(got.calls().at(-1)![0].playbackReady).toBe(true)
  })

  it('is paused while the document is hidden, and reads at once when it is shown again', () => {
    const r = make(world([0]))
    const got = subscribe(r)
    expect(r.timers.count()).toBe(1)
    r.d.setHidden(true)
    expect(r.timers.count()).toBe(0)
    r.world.made.add(1)
    r.d.setHidden(false)
    expect(got.calls()).toHaveLength(1) // the catch-up read
    expect(r.timers.count()).toBe(1)
  })

  it('starts no timer for a document that is hidden at the start, and none at all without a listener', () => {
    const idle = make()
    expect(idle.timers.count()).toBe(0)
    expect(idle.d.listenerCount()).toBe(0)
    const hidden = make()
    hidden.d.doc.hidden = true
    subscribe(hidden)
    expect(hidden.timers.count()).toBe(0)
  })

  it('unsubscribing the last listener, and destroy (twice), stop the timer and the page listener', () => {
    const r = make()
    const off = r.bridge.onChange(() => {})
    expect(r.timers.count()).toBe(1)
    expect(r.d.listenerCount()).toBe(1)
    off()
    expect(r.timers.count()).toBe(0)
    expect(r.d.listenerCount()).toBe(0)
    r.bridge.onChange(() => {})
    r.bridge.destroy()
    r.bridge.destroy()
    expect(r.timers.count()).toBe(0)
    expect(r.d.listenerCount()).toBe(0)
    expect(r.bridge.onChange(() => {})()).toBeUndefined()
    expect(r.timers.count()).toBe(0)
  })

  it('a listener that throws does not stop the others or the poll (one console.warn each time)', () => {
    const r = make(world([0]))
    const bad = vi.fn(() => {
      throw new Error('boom')
    })
    const good = vi.fn()
    r.bridge.onChange(bad)
    r.bridge.onChange(good)
    r.world.made.add(1)
    r.timers.tick()
    expect(bad).toHaveBeenCalledTimes(1)
    expect(good).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    warnSpy.mockClear()
  })

  it('a hook that disappears or throws mid-poll is a quiet skip; the next good poll goes on', () => {
    const r = make(world([0]))
    const got = subscribe(r)
    const sim = r.win.__audioSim
    r.win.__audioSim = undefined
    r.timers.tick()
    r.win.__audioSim = sim
    r.world.made.add(1)
    r.timers.tick()
    expect(got.calls()).toHaveLength(1)
  })
})
