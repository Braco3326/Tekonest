// mountOscar: gates, failure isolation, destroy, restore bursts, the rect cache and the reserved anchors. No DOM: the vendored entry points are faked.
import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest'
import { makeRegistry } from '../helpers'
import type { RuleRow } from '../../src/creation/shell/statusModel'
import type { TpBridge, TpPortRef, TpState } from '../../src/guide/bridge/types'
import { ACKNOWLEDGE, SUGGEST_FROM, SUGGEST_PHANTOM, SUGGEST_TO } from '../../src/guide/flows.creation'
import { RECT_CACHE_MS, collapseRestore, createRectResolver, mountOscar, setupFor, type MountDeps, type MountImpl } from '../../src/guide/mount'
import { createController } from '../../src/guide/vendor/core/controller'
import type { ControllerInput, GuideView, HostEvent, Rect } from '../../src/guide/vendor/core/types'

const registry = makeRegistry()
const PRACTICE = ''
const R: Rect = { x: 10, y: 20, w: 30, h: 40 }

function stateOf(devices: [string, string][], over: Partial<TpState> = {}): TpState {
  const controls: TpState['controls'] = {}
  for (const [id, deviceId] of devices) {
    const own: Record<string, boolean | string> = {}
    for (const c of registry.deviceById.get(deviceId)?.controls ?? []) own[c.id] = c.type === 'toggle' ? c.default : c.defaultOption
    controls[id] = own
  }
  return {
    route: 'creation',
    placeKnown: true,
    instances: devices.map(([id, deviceId]) => ({ id, deviceId, label: deviceId })),
    connections: [],
    controls,
    events: [],
    playbackReady: false,
    firstReason: null,
    ...over,
  }
}
const EMPTY = stateOf([], { placeKnown: false })
const PAIR = stateOf([['ql1', 'yamaha-ql1'], ['mic', 'shure-sm58']])

type Listener = (state: TpState, events: HostEvent[]) => void
function fakeBridge(initial: TpState | null = EMPTY) {
  let state: TpState | null = initial
  const listeners = new Set<Listener>()
  const unsubscribe = vi.fn()
  const bridge = {
    snapshot: vi.fn(() => state),
    rectOf: vi.fn((a: string): Rect | null => (a.startsWith('nav:') || a.startsWith('device:') || a.startsWith('port:') || a.startsWith('control:') ? { ...R } : null)),
    anchorOfPort: vi.fn((r: TpPortRef) => `port:${r.instance}.${r.port}`),
    anchorOfDevice: vi.fn((id: string) => `device:${id}`),
    anchorOfControl: vi.fn((i: string, c: string) => `control:${i}.${c}`),
    onChange: vi.fn((cb: Listener) => {
      listeners.add(cb)
      return () => {
        unsubscribe()
        listeners.delete(cb)
      }
    }),
    destroy: vi.fn(),
  }
  return {
    bridge: bridge as unknown as TpBridge & typeof bridge,
    spies: bridge,
    unsubscribe,
    set: (s: TpState | null): void => {
      state = s
    },
    emit: (s: TpState, events: HostEvent[] = []): void => {
      state = s
      for (const l of [...listeners]) l(s, events)
    },
    listenerCount: (): number => listeners.size,
  }
}

function fakeDoc() {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
  let appended = 0
  const doc = {
    addEventListener: vi.fn((t: string, fn: EventListenerOrEventListenerObject, _capture?: boolean) => {
      if (!listeners.has(t)) listeners.set(t, new Set())
      listeners.get(t)!.add(fn)
    }),
    removeEventListener: vi.fn((t: string, fn: EventListenerOrEventListenerObject, _capture?: boolean) => {
      listeners.get(t)?.delete(fn)
    }),
    createElement: vi.fn(() => {
      appended++
      return {}
    }),
    body: { appendChild: vi.fn(() => void appended++) },
  }
  return {
    doc: doc as unknown as Document,
    spies: doc,
    count: (): number => [...listeners.values()].reduce((n, s) => n + s.size, 0),
    nodes: (): number => appended,
    click: (target: unknown): void => {
      for (const fn of [...(listeners.get('click') ?? [])]) (fn as (e: unknown) => void)({ target })
    },
  }
}

function fakeImpl() {
  const handle = {
    destroy: vi.fn(),
    send: vi.fn((_i: ControllerInput) => Promise.resolve({} as GuideView)),
  }
  const controller = { dispatch: vi.fn(), getView: vi.fn(), subscribe: vi.fn() }
  const impl = {
    createController: vi.fn((_deps: unknown) => controller),
    mountGuide: vi.fn((_o: unknown) => handle),
  }
  return { impl: impl as unknown as MountImpl & typeof impl, handle, controller }
}

interface Rig {
  deps: MountDeps
  b: ReturnType<typeof fakeBridge>
  d: ReturnType<typeof fakeDoc>
  f: ReturnType<typeof fakeImpl>
  win: { location: { search: string } }
  clock: { t: number }
}
function make(over: Partial<MountDeps> = {}, state: TpState | null = EMPTY): Rig {
  const b = fakeBridge(state)
  const d = fakeDoc()
  const f = fakeImpl()
  const win = { location: { search: PRACTICE } }
  const clock = { t: 1000 }
  const deps: MountDeps = {
    win: win as unknown as Window,
    doc: d.doc,
    route: 'creation',
    search: PRACTICE,
    bridge: b.bridge,
    registry,
    storage: null,
    now: () => clock.t,
    ...over,
  }
  return { deps, b, d, f, win, clock }
}
const sent = (f: ReturnType<typeof fakeImpl>): ControllerInput[] => f.handle.send.mock.calls.map((c) => c[0])
const hostEvents = (f: ReturnType<typeof fakeImpl>): HostEvent[] => sent(f).flatMap((i) => (i.type === 'hostEvent' ? [i.event] : []))
const contexts = (f: ReturnType<typeof fakeImpl>): Record<string, unknown>[] => sent(f).flatMap((i) => (i.type === 'setContext' ? [i.context as Record<string, unknown>] : []))
const ev = (type: string, data?: HostEvent['data']): HostEvent => ({ type, at: 5, ...(data ? { data } : {}) })

let warnSpy: MockInstance
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// ── gates ───────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('mountOscar gates', () => {
  it.each([['?mode=exam'], ['?level=a1'], ['?legacy=1'], ['?mode='], ['?MODE=exam'], ['?%6Dode=exam']])(
    'returns null in exam (%s), creating nothing: no controller, no widget, no bridge call, no listener, no node',
    (search) => {
      const r = make({ search })
      r.win.location.search = search
      expect(mountOscar(r.deps, r.f.impl)).toBeNull()
      expect(r.f.impl.createController).not.toHaveBeenCalled()
      expect(r.f.impl.mountGuide).not.toHaveBeenCalled()
      expect(r.b.spies.onChange).not.toHaveBeenCalled()
      expect(r.b.spies.snapshot).not.toHaveBeenCalled()
      expect(r.b.spies.rectOf).not.toHaveBeenCalled()
      expect(r.d.spies.addEventListener).not.toHaveBeenCalled()
      expect(r.d.nodes()).toBe(0)
      expect(warnSpy).not.toHaveBeenCalled()
    },
  )

  it('returns null for the legacy route without a practice level, and for an unknown route', () => {
    expect(mountOscar(make({ route: 'legacy', search: '' }).deps, fakeImpl().impl)).toBeNull()
    expect(mountOscar(make({ route: 'legacy', search: '?level=sandbox' }).deps, fakeImpl().impl)).toBeNull()
    expect(mountOscar(make({ route: 'nowhere' as never }).deps, fakeImpl().impl)).toBeNull()
  })

  it.each([['?oscar=0'], ['?OSCAR=0'], ['?x=1&oscar=0'], ['?oscar=1&oscar=0']])('returns null for the kill switch (%s) and creates nothing', (search) => {
    const r = make({ search })
    expect(mountOscar(r.deps, r.f.impl)).toBeNull()
    expect(r.f.impl.createController).not.toHaveBeenCalled()
    expect(r.f.impl.mountGuide).not.toHaveBeenCalled()
    expect(r.b.spies.onChange).not.toHaveBeenCalled()
    expect(r.d.nodes()).toBe(0)
    expect(r.d.count()).toBe(0)
  })

  it('returns null when the feature flag is off', () => {
    const r = make({ features: { levels: false, guide: false } })
    expect(mountOscar(r.deps, r.f.impl)).toBeNull()
    expect(r.f.impl.createController).not.toHaveBeenCalled()
    expect(r.f.impl.mountGuide).not.toHaveBeenCalled()
  })

  it('mounts in practice (creation, no parameter): the widget gets the controller, a rect function, z-index 35 and the workbench context', () => {
    const r = make()
    const h = mountOscar(r.deps, r.f.impl)
    expect(h).not.toBeNull()
    expect(r.f.impl.createController).toHaveBeenCalledTimes(1)
    expect(r.f.impl.mountGuide).toHaveBeenCalledTimes(1)
    const opts = r.f.impl.mountGuide.mock.calls[0][0] as { controller: unknown; getRect: unknown; zIndex: number; context: unknown }
    expect(opts.controller).toBe(r.f.controller)
    expect(typeof opts.getRect).toBe('function')
    expect(opts.zIndex).toBe(35)
    expect(opts.context).toEqual({ page: 'workbench', mode: 'practice' })
    const c = r.f.impl.createController.mock.calls[0][0] as { flows: { id: string }[]; clock: () => number; strings: unknown }
    expect(c.flows.map((x) => x.id)).toEqual(['premier-montage', 'alimentation-fantome', 'lire-le-statut'])
    expect(c.clock()).toBe(1000)
    expect(c.strings).toBeDefined()
  })

  it('the storage goes to the controller and the widget when there is one, and neither gets a storage key otherwise', () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn() } as unknown as Storage
    const withS = make({ storage })
    mountOscar(withS.deps, withS.f.impl)
    expect((withS.f.impl.createController.mock.calls[0][0] as { storage?: unknown }).storage).toBe(storage)
    expect((withS.f.impl.mountGuide.mock.calls[0][0] as { storage: unknown }).storage).toBe(storage)
    const without = make()
    mountOscar(without.deps, without.f.impl)
    expect('storage' in (without.f.impl.createController.mock.calls[0][0] as object)).toBe(false)
    expect((without.f.impl.mountGuide.mock.calls[0][0] as { storage: unknown }).storage).toBeNull()
  })
})

// ── failure isolation (W-12) ────────────────────────────────────────────────────────────────────────────────────────────

describe('mountOscar failures', () => {
  it('a throw in mountGuide is swallowed with one console.warn, mountOscar returns null, and what was built is stopped', () => {
    const r = make()
    r.f.impl.mountGuide.mockImplementation(() => {
      throw new Error('boom')
    })
    expect(mountOscar(r.deps, r.f.impl)).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(r.b.spies.destroy).toHaveBeenCalledTimes(1)
    expect(r.b.spies.onChange).not.toHaveBeenCalled()
    expect(r.d.count()).toBe(0)
  })

  it('a throw in createController gives null and one console.warn', () => {
    const r = make()
    r.f.impl.createController.mockImplementation(() => {
      throw new Error('boom')
    })
    expect(mountOscar(r.deps, r.f.impl)).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(r.f.impl.mountGuide).not.toHaveBeenCalled()
  })

  it('an exception thrown by the bridge during mount is swallowed (console.warn once) and mountOscar returns null, with the widget removed', () => {
    const r = make()
    r.b.spies.onChange.mockImplementation(() => {
      throw new Error('bridge down')
    })
    expect(mountOscar(r.deps, r.f.impl)).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(r.f.handle.destroy).toHaveBeenCalledTimes(1)
    expect(r.b.spies.destroy).toHaveBeenCalledTimes(1)
  })

  it('a throwing snapshot at mount is not fatal: the guide still mounts, the failure is one warning', () => {
    const r = make()
    r.b.spies.snapshot.mockImplementation(() => {
      throw new Error('hook half built')
    })
    expect(mountOscar(r.deps, r.f.impl)).not.toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('a bridge whose destroy throws does not stop the rest of the teardown, nor reach the page', () => {
    const r = make()
    r.b.spies.destroy.mockImplementation(() => {
      throw new Error('x')
    })
    const h = mountOscar(r.deps, r.f.impl)!
    expect(() => h.destroy()).not.toThrow()
    expect(r.f.handle.destroy).toHaveBeenCalledTimes(1)
  })

  it('a throw while handling a change (the widget send throws, then rejects) is one console.warn for the whole mount, never an exception into the bridge', async () => {
    const r = make()
    mountOscar(r.deps, r.f.impl)
    r.f.handle.send.mockImplementation(() => {
      throw new Error('send')
    })
    expect(() => r.b.emit(PAIR, [ev('deviceAdded', { device: 'device:ql1' })])).not.toThrow()
    r.f.handle.send.mockImplementation(() => Promise.reject(new Error('later')))
    expect(() => r.b.emit(EMPTY, [ev('deviceAdded')])).not.toThrow()
    await Promise.resolve()
    await Promise.resolve()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('a throwing document.removeEventListener at destroy is contained', () => {
    const r = make()
    const h = mountOscar(r.deps, r.f.impl)!
    r.d.spies.removeEventListener.mockImplementation(() => {
      throw new Error('x')
    })
    expect(() => h.destroy()).not.toThrow()
    expect(r.f.handle.destroy).toHaveBeenCalledTimes(1)
  })
})

// ── destroy ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('mountOscar destroy', () => {
  it('stops the widget, the bridge and its listener, removes the page listener, and leaves no timer and no node of its own', () => {
    vi.useFakeTimers()
    const r = make()
    const h = mountOscar(r.deps, r.f.impl)!
    expect(r.b.listenerCount()).toBe(1)
    expect(r.d.count()).toBe(1)
    h.destroy()
    expect(r.f.handle.destroy).toHaveBeenCalledTimes(1)
    expect(r.b.spies.destroy).toHaveBeenCalledTimes(1)
    expect(r.b.unsubscribe).toHaveBeenCalledTimes(1)
    expect(r.b.listenerCount()).toBe(0)
    expect(r.d.count()).toBe(0)
    expect(r.d.nodes()).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('is safe twice, and a change after destroy reaches nothing', () => {
    const r = make()
    const h = mountOscar(r.deps, r.f.impl)!
    h.destroy()
    h.destroy()
    expect(r.f.handle.destroy).toHaveBeenCalledTimes(1)
    expect(r.b.spies.destroy).toHaveBeenCalledTimes(1)
    const before = r.f.handle.send.mock.calls.length
    r.b.emit(PAIR, [ev('deviceAdded')])
    expect(r.f.handle.send.mock.calls.length).toBe(before)
  })

  it('a click in the status bar after destroy sends nothing', () => {
    const r = make()
    const h = mountOscar(r.deps, r.f.impl)!
    h.destroy()
    const before = r.f.handle.send.mock.calls.length
    r.d.click({ closest: () => ({}) })
    expect(r.f.handle.send.mock.calls.length).toBe(before)
  })
})

// ── forwarding ──────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('mountOscar forwarding', () => {
  it('forwards the events of a change in order, after one setContext for the change', () => {
    const r = make()
    mountOscar(r.deps, r.f.impl)
    r.f.handle.send.mockClear()
    r.b.emit(PAIR, [ev('deviceAdded', { device: 'device:a' }), ev('connect', { a: 'port:a.x', b: 'port:b.y' })])
    const kinds = sent(r.f).map((i) => (i.type === 'hostEvent' ? i.event.type : i.type))
    expect(kinds).toEqual(['setContext', 'deviceAdded', 'connect'])
  })

  it('three deviceAdded in one poll are three events', () => {
    const r = make()
    mountOscar(r.deps, r.f.impl)
    r.b.emit(PAIR, [ev('deviceAdded'), ev('deviceAdded'), ev('deviceAdded'), ev('place')])
    expect(hostEvents(r.f).map((e) => e.type)).toEqual(['deviceAdded', 'deviceAdded', 'deviceAdded', 'place'])
  })

  it('a restore burst (more than three deviceAdded in one poll) is ONE `restore` event, not the burst', () => {
    const r = make()
    mountOscar(r.deps, r.f.impl)
    r.f.handle.send.mockClear()
    r.b.emit(PAIR, [ev('placeChosen'), ev('deviceAdded'), ev('deviceAdded'), ev('deviceAdded'), ev('deviceAdded'), ev('place'), ev('connect'), ev('toggle')])
    expect(hostEvents(r.f).map((e) => e.type)).toEqual(['restore'])
  })

  it('collapseRestore: the limit is exactly three, and other events pass untouched', () => {
    const three = [ev('deviceAdded'), ev('deviceAdded'), ev('deviceAdded')]
    expect(collapseRestore(three)).toHaveLength(3)
    expect(collapseRestore([...three, ev('deviceAdded')]).map((e) => e.type)).toEqual(['restore'])
    expect(collapseRestore([])).toEqual([])
    expect(collapseRestore([ev('connect')])).toEqual([ev('connect')])
  })

  it('tells the controller the mode: an exam address appearing later is sent as mode exam', () => {
    const r = make()
    mountOscar(r.deps, r.f.impl)
    r.b.emit(PAIR)
    expect(contexts(r.f).at(-1)?.mode).toBe('practice')
    r.win.location.search = '?mode=exam'
    r.b.emit(EMPTY)
    expect(contexts(r.f).at(-1)?.mode).toBe('exam')
  })

  it('sends the bench as it is at mount (a restored project is already there)', () => {
    const r = make({}, stateOf([['ql1', 'yamaha-ql1']], { playbackReady: true }))
    mountOscar(r.deps, r.f.impl)
    const first = contexts(r.f).at(-1)!
    expect(first.setup).toMatchObject({ coveredFamilies: [], instances: [], connections: [] })
  })

  it('setupFor: a verdict only when something can be said (an error to fix, or a chain that plays), a revision each time, none for a half-built bench', () => {
    expect(setupFor(null, 1)).toBeNull()
    expect(setupFor(EMPTY, 1)).toBeNull()
    expect(setupFor(stateOf([['a', 'yamaha-ql1']]), 1)).toBeNull()
    expect(setupFor(stateOf([['a', 'yamaha-ql1']], { events: [{ ruleId: 'R5', severity: 'warning', subjects: [] }] }), 1)).toBeNull()
    expect(setupFor(stateOf([['a', 'yamaha-ql1']], { events: [{ ruleId: 'R5', severity: 'error', subjects: [] }] }), 7)).toEqual({ coveredFamilies: [], instances: [], connections: [], ctx: { revision: 7 } })
    expect(setupFor(stateOf([['a', 'yamaha-ql1']], { playbackReady: true }), 2)).toEqual({ coveredFamilies: [], instances: [], connections: [], ctx: { revision: 2 } })
  })

  it('a click inside the status bar is `acknowledge` (the end of a read step); a click elsewhere is nothing', () => {
    const r = make()
    mountOscar(r.deps, r.f.impl)
    r.f.handle.send.mockClear()
    const selectors: string[] = []
    r.d.click({
      closest: (s: string) => {
        selectors.push(s)
        return null
      },
    })
    expect(hostEvents(r.f)).toEqual([])
    r.d.click(null)
    r.d.click({})
    expect(hostEvents(r.f)).toEqual([])
    r.d.click({ closest: () => ({}) })
    expect(hostEvents(r.f)).toEqual([{ type: ACKNOWLEDGE, at: 1000, data: { anchor: 'nav:status' } }])
    expect(selectors[0]).toBe('[data-testid="status-bar"]')
  })

  it('the click listener is in the capture phase, so the app cannot hide a click from it', () => {
    const r = make()
    mountOscar(r.deps, r.f.impl)
    expect(r.d.spies.addEventListener.mock.calls[0][2]).toBe(true)
  })
})

// ── getRect ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('createRectResolver', () => {
  function resolver(state: TpState | null = PAIR) {
    const b = fakeBridge(state)
    const clock = { t: 0 }
    const rr = createRectResolver({ bridge: b.bridge, registry, now: () => clock.t })
    return { b, clock, rr }
  }

  it('the second call for an anchor within 250 ms does not call the bridge again; after 250 ms it does', () => {
    const { b, clock, rr } = resolver()
    expect(RECT_CACHE_MS).toBe(250)
    expect(rr.getRect('device:ql1')).toEqual(R)
    clock.t = 249
    expect(rr.getRect('device:ql1')).toEqual(R)
    expect(b.spies.rectOf).toHaveBeenCalledTimes(1)
    clock.t = 250
    rr.getRect('device:ql1')
    expect(b.spies.rectOf).toHaveBeenCalledTimes(2)
  })

  it('the cache is per anchor, and a "not on screen" answer is cached too (a stale anchor does not rebuild the table every call)', () => {
    const { b, clock, rr } = resolver()
    b.spies.rectOf.mockImplementation(() => null)
    for (let i = 0; i < 20; i++) {
      clock.t += 5
      expect(rr.getRect('device:gone')).toBeNull()
    }
    expect(b.spies.rectOf).toHaveBeenCalledTimes(1)
    rr.getRect('device:other')
    expect(b.spies.rectOf).toHaveBeenCalledTimes(2)
  })

  it('returns a copy: changing the answer does not change the cached rect', () => {
    const { rr } = resolver()
    const a = rr.getRect('nav:status')!
    a.x = 999
    expect(rr.getRect('nav:status')).toEqual(R)
  })

  it('clear() empties the cache (a change of the bench)', () => {
    const { b, rr } = resolver()
    rr.getRect('device:ql1')
    rr.clear()
    rr.getRect('device:ql1')
    expect(b.spies.rectOf).toHaveBeenCalledTimes(2)
  })

  it('unknown or malformed anchors give null; a malformed one never reaches the bridge', () => {
    const { b, rr } = resolver()
    b.spies.rectOf.mockImplementation(() => null)
    expect(rr.getRect('lesson:x')).toBeNull()
    expect(rr.getRect('')).toBeNull()
    expect(rr.getRect('not an anchor')).toBeNull()
    expect(rr.getRect(null as unknown as string)).toBeNull()
    expect(b.spies.rectOf).not.toHaveBeenCalled()
    expect(rr.getRect('device:nobody')).toBeNull()
    expect(b.spies.rectOf).toHaveBeenCalledWith('device:nobody')
  })

  it('a throwing bridge gives null, never a throw', () => {
    const { b, rr } = resolver()
    b.spies.rectOf.mockImplementation(() => {
      throw new Error('x')
    })
    expect(rr.getRect('device:ql1')).toBeNull()
  })

  it('port:suggest.from and port:suggest.to resolve from the state: the free mic output and the console input', () => {
    const { b, rr } = resolver(PAIR)
    expect(rr.getRect(SUGGEST_FROM)).toEqual(R)
    expect(rr.getRect(SUGGEST_TO)).toEqual(R)
    expect(b.spies.anchorOfPort).toHaveBeenNthCalledWith(1, { instance: 'mic', port: 'out-xlr' })
    expect(b.spies.anchorOfPort).toHaveBeenNthCalledWith(2, { instance: 'ql1', port: 'in-mic-1' })
    expect(b.spies.rectOf).toHaveBeenNthCalledWith(1, 'port:mic.out-xlr')
    expect(b.spies.rectOf).toHaveBeenNthCalledWith(2, 'port:ql1.in-mic-1')
    expect(b.spies.snapshot).toHaveBeenCalledTimes(1) // one snapshot serves both ends
  })

  it('the suggestion follows the bench: another pair once the first is cabled, null when none is left', () => {
    const { b, clock, rr } = resolver(PAIR)
    rr.getRect(SUGGEST_FROM)
    const cabled = { ...PAIR, connections: [{ a: { instance: 'mic', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }] }
    b.set(cabled)
    clock.t = 300
    b.spies.rectOf.mockClear()
    expect(rr.getRect(SUGGEST_FROM)).toBeNull()
    expect(rr.getRect(SUGGEST_TO)).toBeNull()
    expect(b.spies.rectOf).not.toHaveBeenCalled()
  })

  it('the suggestion anchors are null on an empty bench and while the bridge has no state', () => {
    expect(resolver(EMPTY).rr.getRect(SUGGEST_FROM)).toBeNull()
    expect(resolver(EMPTY).rr.getRect(SUGGEST_PHANTOM)).toBeNull()
    const none = resolver(null)
    expect(none.rr.getRect(SUGGEST_TO)).toBeNull()
    expect(none.rr.getRect(SUGGEST_PHANTOM)).toBeNull()
  })

  it('an incompatible pair gives no suggestion (the app would refuse the cable)', () => {
    const { b, rr } = resolver(stateOf([['mic', 'shure-sm58'], ['spk', 'qsc-k12-2']]))
    expect(rr.getRect(SUGGEST_FROM)).toBeNull()
    expect(rr.getRect(SUGGEST_TO)).toBeNull()
    expect(b.spies.rectOf).not.toHaveBeenCalled()
  })

  it('control:suggest.phantom resolves to the phantom switch of the first device that has one', () => {
    const { b, rr } = resolver(stateOf([['ql1', 'yamaha-ql1'], ['isa', 'focusrite-isa-one']]))
    expect(rr.getRect(SUGGEST_PHANTOM)).toEqual(R)
    expect(b.spies.anchorOfControl).toHaveBeenCalledWith('isa', 'phantom-48v')
    expect(b.spies.rectOf).toHaveBeenCalledWith('control:isa.phantom-48v')
  })

  it('control:suggest.phantom falls back to the device itself when the switch has no pad on screen, and is null with no phantom device', () => {
    const { b, rr } = resolver(stateOf([['isa', 'focusrite-isa-one']]))
    b.spies.rectOf.mockImplementation((a: string) => (a.startsWith('control:') ? null : { ...R }))
    expect(rr.getRect(SUGGEST_PHANTOM)).toEqual(R)
    expect(b.spies.rectOf).toHaveBeenLastCalledWith('device:isa')
    expect(resolver(stateOf([['ql1', 'yamaha-ql1']])).rr.getRect(SUGGEST_PHANTOM)).toBeNull()
  })

  it('the widget gets this resolver: mountGuide receives a getRect that caches and resolves the reserved anchors', () => {
    const r = make({}, PAIR)
    mountOscar(r.deps, r.f.impl)
    const getRect = (r.f.impl.mountGuide.mock.calls[0][0] as { getRect: (a: string) => Rect | null }).getRect
    expect(getRect(SUGGEST_FROM)).toEqual(R)
    getRect('nav:place')
    getRect('nav:place')
    expect(r.b.spies.rectOf.mock.calls.filter((c) => c[0] === 'nav:place')).toHaveLength(1)
    // a change of the bench drops the cache
    r.b.emit(PAIR)
    getRect('nav:place')
    expect(r.b.spies.rectOf.mock.calls.filter((c) => c[0] === 'nav:place')).toHaveLength(2)
  })
})

// ── what the learner sees, on the real controller and the real brain ─────────────────────────────────────────────────────

describe('mountOscar on the real controller', () => {
  it('an empty bench: « Prochaine étape » offers premier-montage, and the offered chip starts it', async () => {
    const r = make({}, EMPTY)
    const impl: MountImpl = { createController, mountGuide: vi.fn(() => ({ destroy: vi.fn(), send: vi.fn(async () => ({}) as GuideView) })) as never }
    mountOscar(r.deps, impl)
    const controller = (impl.mountGuide as Mock).mock.calls[0][0].controller as ReturnType<typeof createController>
    await controller.dispatch({ type: 'setContext', context: { page: 'workbench', mode: 'practice', setup: null } })
    let v = await controller.dispatch({ type: 'chip', id: 'next' })
    expect(v.bubble?.kind).toBe('info')
    expect(v.bubble?.lines.map((l) => l.text)).toEqual(['Aucune étape en cours. Un parcours guidé peut être lancé.'])
    expect(v.bubble?.chips.map((c) => c.id)).toContain('start')
    v = await controller.dispatch({ type: 'chip', id: 'start' })
    expect(v.bubble?.title).toBe('Parcours « Premier montage » : étape 1 sur 5.')
    expect(v.bubble?.lines.map((l) => l.text)).toEqual(['Choisir un lieu pour commencer.'])
    expect(v.target?.anchor).toBe('nav:place')
  })

  it('a rule error on the bench: the bubble is the app’s own cause and fix, nothing about « relancer la vérification »', async () => {
    const rules = registry.catalog.rules as unknown as RuleRow[]
    const rule = rules.find((x) => x.title_fr && x.teach_fr)!
    const broken = stateOf([['ql1', 'yamaha-ql1'], ['mic', 'shure-sm58']], { events: [{ ruleId: rule.id, severity: 'error', subjects: [{ instance: 'mic', port: 'out-xlr' }] }] })
    const r = make({}, broken)
    const impl: MountImpl = { createController, mountGuide: vi.fn(() => ({ destroy: vi.fn(), send: vi.fn(async () => ({}) as GuideView) })) as never }
    mountOscar(r.deps, impl)
    const controller = (impl.mountGuide as Mock).mock.calls[0][0].controller as ReturnType<typeof createController>
    await controller.dispatch({ type: 'setContext', context: { page: 'workbench', mode: 'practice', setup: setupFor(broken, 1) } })
    const v = await controller.dispatch({ type: 'chip', id: 'next' })
    expect(v.bubble?.kind).toBe('fix')
    const all = JSON.stringify(v.bubble)
    expect(all).toContain(rule.teach_fr as string)
    expect(all).not.toContain('relancer')
    expect(v.target?.anchor).toMatch(/^port:/)
  })
})
