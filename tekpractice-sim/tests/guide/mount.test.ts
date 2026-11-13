// mountOscar: gates, failure isolation, destroy, restore bursts, the rect cache and the reserved anchors. No DOM: the vendored entry points are faked.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest'
import { makeRegistry } from '../helpers'
import type { RuleRow } from '../../src/creation/shell/statusModel'
import type { TpBridge, TpPortRef, TpState } from '../../src/guide/bridge/types'
import { ACKNOWLEDGE, SUGGEST_FROM, SUGGEST_PHANTOM, SUGGEST_TO } from '../../src/guide/flows.creation'
import { packageById } from '../../src/design/packages'
import { RECT_CACHE_MS, annotateToggle, collapseRestore, cornerDefaultStorage, createObstacleSource, createRectResolver, hostInsets, hostObstacles, mountOscar, setupFor, type MountDeps, type MountImpl } from '../../src/guide/mount'
import { COPY } from '../../src/creation/copy'
import { ruleText as modeCreationRuleText } from '../../src/creation/ruleTexts'
import { TP_STRINGS, tpString } from '../../src/guide/strings'
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
  const removed: unknown[] = []
  const doc = {
    addEventListener: vi.fn((t: string, fn: EventListenerOrEventListenerObject, _capture?: boolean) => {
      if (!listeners.has(t)) listeners.set(t, new Set())
      listeners.get(t)!.add(fn)
    }),
    removeEventListener: vi.fn((t: string, fn: EventListenerOrEventListenerObject, _capture?: boolean) => {
      listeners.get(t)?.delete(fn)
    }),
    createElement: vi.fn((tag: string) => {
      appended++
      const attrs: Record<string, string> = {}
      const el = {
        tag,
        attrs,
        setAttribute: vi.fn((k: string, v: string) => void (attrs[k] = v)),
        remove: vi.fn(() => void removed.push(el)),
      }
      return el
    }),
    body: { appendChild: vi.fn() },
  }
  return {
    doc: doc as unknown as Document,
    spies: doc,
    count: (): number => [...listeners.values()].reduce((n, s) => n + s.size, 0),
    nodes: (): number => appended - removed.length,
    removed: (): unknown[] => removed,
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
    const r = make({ features: { levels: false, guide: false, guideLegacy: false } })
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
    expect(c.flows.map((x) => x.id)).toEqual(['premier-montage', 'ajouter-des-appareils', 'deuxieme-appareil', 'premier-cable', 'lire-le-statut', 'alimentation-fantome'])
    expect(c.clock()).toBe(1000)
    expect(c.strings).toBeDefined()
  })

  it('the widget lives inside a landmark of its own (an aside with a name), so no text of the guide sits outside a landmark; destroy removes it', () => {
    const r = make()
    const h = mountOscar(r.deps, r.f.impl)
    const opts = r.f.impl.mountGuide.mock.calls[0][0] as { root?: { tag: string; attrs: Record<string, string> } }
    expect(opts.root).toBeDefined()
    expect(opts.root!.tag).toBe('aside')
    expect(opts.root!.attrs['aria-label']).toBe(tpString('landmark'))
    expect(opts.root!.attrs['aria-label']).not.toBe('')
    expect(r.d.spies.body.appendChild).toHaveBeenCalledWith(opts.root)
    expect(r.d.removed()).toHaveLength(0)
    h!.destroy()
    expect(r.d.removed()).toEqual([opts.root])
  })

  it('the widget is told where the page keeps its bars (menu bar on top, status bar at the bottom) through a getter, so the icon rests clear of them', () => {
    const r = make()
    mountOscar(r.deps, r.f.impl)
    const opts = r.f.impl.mountGuide.mock.calls[0][0] as { insets?: () => unknown }
    expect(typeof opts.insets).toBe('function')
  })

  it('a mount that fails after the landmark was made removes the landmark', () => {
    const r = make()
    r.f.impl.mountGuide.mockImplementation(() => {
      throw new Error('boom')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(mountOscar(r.deps, r.f.impl)).toBeNull()
    expect(r.d.removed()).toHaveLength(1)
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

// ── failure isolation ────────────────────────────────────────────────────────────────────────────────────────────

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

// ── the page's bars ────────────────────────────────────────────────────────────────────────────────────────────────

describe('hostInsets', () => {
  const rect = (y: number, h: number) => ({ top: y, bottom: y + h, height: h, width: 1280, left: 0, right: 1280, x: 0, y })
  const docWith = (bars: Record<string, ReturnType<typeof rect> | null | 'throw'>, height = 800) =>
    ({
      documentElement: { clientHeight: height },
      querySelector: (sel: string) => {
        const b = bars[sel]
        if (b === 'throw') throw new Error('bad selector')
        return b ? { getBoundingClientRect: () => b } : null
      },
    }) as unknown as Document
  const MENU = '[data-testid="menubar"]'
  const STATUS = '[data-testid="status-bar"]'

  it('top = the bottom edge of the menu bar, bottom = the viewport minus the top edge of the status bar', () => {
    expect(hostInsets(docWith({ [MENU]: rect(0, 32), [STATUS]: rect(772, 28) }))).toEqual({ top: 32, bottom: 28, left: 0, right: 0 })
    expect(hostInsets(docWith({ [MENU]: rect(0, 32), [STATUS]: rect(784, 28) }, 812))).toEqual({ top: 32, bottom: 28, left: 0, right: 0 })
  })

  it('a bar that is missing, empty, off screen or an answer that throws counts as no bar; never negative, never NaN', () => {
    expect(hostInsets(docWith({}))).toEqual({ top: 0, bottom: 0, left: 0, right: 0 })
    expect(hostInsets(docWith({ [MENU]: rect(0, 0), [STATUS]: rect(800, 0) }))).toEqual({ top: 0, bottom: 0, left: 0, right: 0 })
    expect(hostInsets(docWith({ [MENU]: rect(-100, 32), [STATUS]: rect(900, 28) }))).toEqual({ top: 0, bottom: 0, left: 0, right: 0 })
    expect(hostInsets(docWith({ [MENU]: 'throw', [STATUS]: 'throw' }))).toEqual({ top: 0, bottom: 0, left: 0, right: 0 })
    expect(hostInsets({} as unknown as Document)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 })
    expect(hostInsets(docWith({ [STATUS]: { ...rect(772, 28), top: Number.NaN } }))).toEqual({ top: 0, bottom: 0, left: 0, right: 0 })
  })
})

describe('hostInsets: the open side panels', () => {
  // A box as getBoundingClientRect answers it.
  type Box = { top: number; bottom: number; left: number; right: number; width: number; height: number }
  const box = (left: number, top: number, width: number, height: number): Box => ({ left, top, width, height, right: left + width, bottom: top + height })
  const MENU = '[data-testid="menubar"]'
  const STATUS = '[data-testid="status-bar"]'
  const PROPS = '[data-testid="properties"]'
  const TREE = '[data-testid="project-tree"]'
  const docOf = (boxes: Record<string, Box | 'throw'>, width = 1366, height = 768): Document =>
    ({
      documentElement: { clientWidth: width, clientHeight: height },
      querySelector: (sel: string) => {
        const b = boxes[sel]
        if (b === 'throw') throw new Error('bad selector')
        return b ? { getBoundingClientRect: () => b } : null
      },
    }) as unknown as Document
  const bars = { [MENU]: box(0, 0, 1366, 32), [STATUS]: box(0, 740, 1366, 28) }

  it('Propriétés open: the right inset is its width (260), so the icon rests clear of it', () => {
    expect(hostInsets(docOf({ ...bars, [PROPS]: box(1106, 32, 260, 708) }))).toEqual({ top: 32, bottom: 28, left: 0, right: 260 })
  })

  it('Propriétés folded to its rail: the right inset is the rail (32)', () => {
    expect(hostInsets(docOf({ ...bars, [PROPS]: box(1334, 32, 32, 708) })).right).toBe(32)
  })

  it('the Projet tree on the left works the same way (open 200, rail 32), for an icon the learner moved to a left corner', () => {
    expect(hostInsets(docOf({ ...bars, [TREE]: box(0, 32, 200, 708) })).left).toBe(200)
    expect(hostInsets(docOf({ ...bars, [TREE]: box(0, 32, 32, 708) })).left).toBe(32)
  })

  it('a panel that is empty, off screen or not a number counts as no panel', () => {
    expect(hostInsets(docOf({ ...bars, [PROPS]: box(1366, 32, 0, 708) })).right).toBe(0)
    expect(hostInsets(docOf({ ...bars, [PROPS]: box(1500, 32, 260, 708) })).right).toBe(0)
    expect(hostInsets(docOf({ ...bars, [PROPS]: { ...box(1106, 32, 260, 708), left: Number.NaN } })).right).toBe(0)
  })

  it('no panel is the bars only', () => {
    expect(hostInsets(docOf({ ...bars }))).toEqual({ top: 32, bottom: 28, left: 0, right: 0 })
  })

  it('an answer that throws for a panel is zero for everything, never a throw', () => {
    expect(hostInsets(docOf({ ...bars, [PROPS]: 'throw' }))).toEqual({ top: 0, bottom: 0, left: 0, right: 0 })
  })

  it('a document without a width gives no side inset (the bars still count)', () => {
    expect(hostInsets(docOf({ ...bars, [PROPS]: box(1106, 32, 260, 708) }, 0))).toEqual({ top: 32, bottom: 28, left: 0, right: 0 })
  })
})

describe('hostObstacles: the page controls the icon and the bubble keep clear of', () => {
  interface Style {
    visibility?: string
    display?: string
    overflowX?: string
    overflowY?: string
  }
  interface FakeEl {
    tagName: string
    style: Style
    inert: boolean
    parentElement: FakeEl | null
    getBoundingClientRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number; x: number; y: number }
    closest(sel: string): FakeEl | null
  }
  const el = (tag: string, x: number, y: number, w: number, h: number, over: { style?: Style; inert?: boolean; parent?: FakeEl | null } = {}): FakeEl => {
    const e: FakeEl = {
      tagName: tag.toUpperCase(),
      style: { visibility: 'visible', display: 'block', overflowX: 'visible', overflowY: 'visible', ...over.style },
      inert: over.inert === true,
      parentElement: over.parent ?? null,
      getBoundingClientRect: () => ({ left: x, top: y, right: x + w, bottom: y + h, width: w, height: h, x, y }),
      closest: (sel: string) => {
        if (sel !== '[inert]') return null
        for (let p: FakeEl | null = e; p !== null; p = p.parentElement) if (p.inert) return p
        return null
      },
    }
    return e
  }
  const ROOT = '[data-testid="creation-root"]'
  /** A document whose shell root answers `all()` to a querySelectorAll (by default the list). */
  const world = (list: FakeEl[], size = { w: 1366, h: 768 }, all: () => FakeEl[] = () => list, panels: Record<string, FakeEl> = {}): Document => {
    const root = { querySelectorAll: all, querySelector: (sel: string) => panels[sel] ?? null }
    return {
      documentElement: { clientWidth: size.w, clientHeight: size.h },
      defaultView: { getComputedStyle: (e: FakeEl) => e.style },
      querySelector: (sel: string) => (sel === ROOT ? root : null),
    } as unknown as Document
  }

  it('a visible control gives its box; the list is in the viewport pixels the widget uses', () => {
    expect(hostObstacles(world([el('button', 100, 50, 80, 24)]))).toEqual([{ x: 100, y: 50, w: 80, h: 24 }])
  })

  it('what the learner cannot see or use is not an obstacle: hidden, display none, inert (itself or an ancestor), the 3D canvas, a speck, a whole-screen box', () => {
    const inertParent = el('div', 0, 0, 10, 10, { inert: true })
    const list = [
      el('button', 10, 10, 50, 20, { style: { visibility: 'hidden' } }),
      el('button', 10, 40, 50, 20, { style: { display: 'none' } }),
      el('button', 10, 70, 50, 20, { inert: true }),
      el('button', 10, 100, 50, 20, { parent: inertParent }),
      el('canvas', 200, 32, 900, 700),
      el('button', 10, 130, 3, 3),
      el('div', 0, 0, 1366, 768),
      el('button', 300, 300, 40, 20),
    ]
    expect(hostObstacles(world(list))).toEqual([{ x: 300, y: 300, w: 40, h: 20 }])
  })

  it('a scroll area clips what it holds: the part that shows is the obstacle, a control scrolled out of sight is none', () => {
    const scroller = el('aside', 1106, 32, 260, 700, { style: { overflowY: 'auto', overflowX: 'hidden' } })
    const half = el('button', 1119, 700, 235, 40, { parent: scroller })
    const gone = el('button', 1119, 900, 235, 40, { parent: scroller })
    const whole = el('button', 1119, 300, 235, 40, { parent: scroller })
    expect(hostObstacles(world([half, gone, whole]))).toEqual([
      { x: 1119, y: 700, w: 235, h: 32 },
      { x: 1119, y: 300, w: 235, h: 40 },
    ])
  })

  it('a control partly off screen is cut to the viewport; one wholly off screen is none', () => {
    const list = [el('button', 1340, 740, 100, 60), el('a', 1500, 10, 50, 20), el('a', -80, 10, 50, 20)]
    expect(hostObstacles(world(list))).toEqual([{ x: 1340, y: 740, w: 26, h: 28 }])
  })

  const PROPS = '[data-testid="properties"]'
  const TREE = '[data-testid="project-tree"]'
  const DRAWER = '[data-testid="inventory-drawer"][data-open="true"]'

  it('the side panels are obstacles whole, open or folded to their rail, even though they hold no control where the icon would rest', () => {
    const panels = { [PROPS]: el('aside', 560, 32, 260, 1120), [TREE]: el('nav', 0, 32, 200, 1120) }
    expect(hostObstacles(world([], { w: 820, h: 1180 }, undefined, panels))).toEqual([
      { x: 560, y: 32, w: 260, h: 1120 },
      { x: 0, y: 32, w: 200, h: 1120 },
    ])
    expect(hostObstacles(world([], undefined, undefined, { [PROPS]: el('aside', 1334, 32, 32, 708) }))).toEqual([{ x: 1334, y: 32, w: 32, h: 708 }])
  })

  const SLOT = '[data-testid="tutorial-slot"]'
  it('T6.1: the tutorial’s slot (the step card’s row) is an obstacle whole, and the controls inside it are not listed again; no slot, no obstacle', () => {
    const slot = el('div', 0, 32, 1366, 49)
    const skip = el('button', 1219, 40, 131, 32)
    const elsewhere = el('button', 300, 300, 40, 20)
    const list = [skip, elsewhere]
    expect(hostObstacles(world(list, undefined, undefined, { [SLOT]: slot }))).toEqual([{ x: 0, y: 32, w: 1366, h: 49 }, { x: 300, y: 300, w: 40, h: 20 }])
    expect(hostObstacles(world(list))).toEqual([{ x: 1219, y: 40, w: 131, h: 32 }, { x: 300, y: 300, w: 40, h: 20 }])
  })

  it('a panel that is hidden or inert is not an obstacle; no panel is no obstacle', () => {
    expect(hostObstacles(world([], undefined, undefined, { [PROPS]: el('aside', 1106, 32, 260, 708, { style: { display: 'none' } }) }))).toEqual([])
    expect(hostObstacles(world([], undefined, undefined, { [TREE]: el('nav', 0, 32, 200, 708, { inert: true }) }))).toEqual([])
    expect(hostObstacles(world([]))).toEqual([])
  })

  it('the inventory drawer, while open, is an obstacle at its RESTING place (the bottom of its view, its layout height), not where its slide has it', () => {
    const view = el('section', 200, 32, 906, 708)
    const sliding = el('section', 200, 600, 906, 255, { parent: view }) // its box is mid-slide: 60 px below its resting place
    ;(sliding as unknown as { offsetHeight: number }).offsetHeight = 255
    expect(hostObstacles(world([], undefined, undefined, { [DRAWER]: sliding }))).toEqual([{ x: 200, y: 740 - 255, w: 906, h: 255 }])
  })

  it('a control inside a panel or the open drawer is not listed again: the panel is the obstacle', () => {
    const inProps = el('button', 1119, 300, 235, 40)
    const outside = el('button', 300, 300, 40, 20)
    expect(hostObstacles(world([inProps, outside], undefined, undefined, { [PROPS]: el('aside', 1106, 32, 260, 708) }))).toEqual([
      { x: 1106, y: 32, w: 260, h: 708 },
      { x: 300, y: 300, w: 40, h: 20 },
    ])
  })

  it('one scan reads the style of each ancestor once, however many controls it holds (the clip of an ancestor is remembered)', () => {
    let reads = 0
    const scroller = el('aside', 0, 40, 400, 400, { style: { overflowY: 'auto', overflowX: 'hidden' } })
    const inner = el('div', 0, 40, 400, 900, { parent: scroller })
    const base = { ...scroller.style }
    for (const e of [scroller, inner]) {
      Object.defineProperty(e, 'style', {
        get: () => {
          reads++
          return base
        },
      })
    }
    const buttons = Array.from({ length: 12 }, (_, i) => el('button', 10, 50 + i * 30, 100, 24, { parent: inner }))
    const out = hostObstacles(world(buttons))
    expect(out).toHaveLength(12)
    // two ancestors, read once each by the first control; no control after it reads them again
    expect(reads).toBe(2)
  })

  it('a panel is cut to the viewport like any control', () => {
    expect(hostObstacles(world([], { w: 400, h: 600 }, undefined, { [PROPS]: el('aside', 300, 32, 260, 1120) }))).toEqual([{ x: 300, y: 32, w: 100, h: 568 }])
  })

  it('no shell on the page (the level page, an exam), no size, or a DOM that throws: no obstacle, never a throw', () => {
    expect(hostObstacles({ querySelector: () => null, documentElement: { clientWidth: 1366, clientHeight: 768 } } as unknown as Document)).toEqual([])
    expect(hostObstacles(world([el('button', 1, 1, 50, 20)], { w: 0, h: 0 }))).toEqual([])
    const boom = world([], undefined, () => {
      throw new Error('x')
    })
    expect(hostObstacles(boom)).toEqual([])
  })

  it('the source reads the page at most once per 250 ms, unless the page just changed (fresh)', () => {
    let reads = 0
    const list = [el('button', 10, 10, 50, 20)]
    const doc = world(list, undefined, () => {
      reads++
      return list
    })
    const clock = { t: 0 }
    const get = createObstacleSource({ doc, now: () => clock.t })
    get()
    clock.t = 249
    get()
    get(false)
    expect(reads).toBe(1)
    clock.t = 250
    get()
    expect(reads).toBe(2)
    get(true)
    expect(reads).toBe(3)
  })

  it('mountOscar gives the widget the source: a function that answers with rects (none on a page without the shell)', () => {
    const r = make()
    mountOscar(r.deps, r.f.impl)
    const opts = r.f.impl.mountGuide.mock.calls[0][0] as { obstacles?: (fresh?: boolean) => unknown }
    expect(typeof opts.obstacles).toBe('function')
    expect(opts.obstacles!(true)).toEqual([]) // the fake document has no shell
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

  it('an exam address appearing later: the controller is told the mode exam, then the whole mount is torn down (node, bridge, listeners), once', () => {
    const r = make()
    const h = mountOscar(r.deps, r.f.impl)!
    r.b.emit(PAIR)
    expect(contexts(r.f).at(-1)?.mode).toBe('practice')
    expect(r.f.handle.destroy).not.toHaveBeenCalled()
    r.win.location.search = '?mode=exam'
    r.b.emit(EMPTY)
    expect(contexts(r.f).at(-1)?.mode).toBe('exam')
    expect(r.f.handle.destroy, 'the widget is destroyed').toHaveBeenCalledTimes(1)
    expect(r.b.spies.destroy, 'the bridge is stopped').toHaveBeenCalledTimes(1)
    expect(r.d.count(), 'no page listener is left').toBe(0)
    expect(r.d.removed(), 'the landmark is removed').toHaveLength(1)
    // nothing more is sent, and a later destroy of the handle is a no-op
    const sentBefore = r.f.handle.send.mock.calls.length
    r.b.emit(PAIR, [ev('deviceAdded', { device: 'device:ql1' })])
    expect(r.f.handle.send.mock.calls.length).toBe(sentBefore)
    h.destroy()
    expect(r.f.handle.destroy).toHaveBeenCalledTimes(1)
  })

  it('the widget starts with the live mode, not a hard-coded one: an exam address at mount gives mode exam and an immediate teardown', () => {
    const r = make()
    r.win.location.search = '?mode=exam' // the page moved to an exam address between the gate (deps.search) and the widget
    mountOscar(r.deps, r.f.impl)
    expect((r.f.impl.mountGuide.mock.calls[0][0] as { context: { mode: string } }).context.mode).toBe('exam')
    expect(r.f.handle.destroy).toHaveBeenCalledTimes(1)
    const p = make()
    mountOscar(p.deps, p.f.impl)
    expect((p.f.impl.mountGuide.mock.calls[0][0] as { context: { mode: string } }).context.mode).toBe('practice')
    expect(p.f.handle.destroy).not.toHaveBeenCalled()
  })

  it('sends the bench as it is at mount (a restored project is already there)', () => {
    const r = make({}, stateOf([['ql1', 'yamaha-ql1']], { playbackReady: true }))
    mountOscar(r.deps, r.f.impl)
    const first = contexts(r.f).at(-1)!
    expect(first.setup).toMatchObject({ coveredFamilies: [], instances: [], connections: [] })
  })

  it('setupFor: a new revision for every state, whatever the stage (the planner decides what to say); null only without a state', () => {
    expect(setupFor(null, 1)).toBeNull()
    for (const st of [EMPTY, stateOf([['a', 'yamaha-ql1']]), stateOf([['a', 'yamaha-ql1']], { events: [{ ruleId: 'R5', severity: 'warning', subjects: [] }] })])
      expect(setupFor(st, 3)).toEqual({ coveredFamilies: [], instances: [], connections: [], ctx: { revision: 3 } })
    expect(setupFor(stateOf([['a', 'yamaha-ql1']], { events: [{ ruleId: 'R5', severity: 'error', subjects: [] }] }), 7)).toEqual({ coveredFamilies: [], instances: [], connections: [], ctx: { revision: 7 } })
    expect(setupFor(stateOf([['a', 'yamaha-ql1']], { playbackReady: true }), 2)).toEqual({ coveredFamilies: [], instances: [], connections: [], ctx: { revision: 2 } })
  })

  it('every change sends a setup, an empty bench included (no stage hides a verdict)', () => {
    const r = make({}, EMPTY)
    mountOscar(r.deps, r.f.impl)
    expect(contexts(r.f).at(-1)?.setup).not.toBeNull()
    r.b.emit(stateOf([]))
    expect(contexts(r.f).at(-1)?.setup).toMatchObject({ ctx: { revision: 1 } })
    r.b.emit(PAIR)
    expect(contexts(r.f).at(-1)?.setup).toMatchObject({ ctx: { revision: 2 } })
  })

  it('annotateToggle marks a toggle of the suggested phantom switch, and only that', () => {
    const state = stateOf([['ql1', 'yamaha-ql1'], ['isa', 'focusrite-isa-one'], ['isa2', 'focusrite-isa-one']])
    const bridge = { anchorOfControl: (i: string, c: string) => `control:${i}.${c}` }
    const on = (anchor: string): HostEvent => ev('toggle', { control: anchor, anchor, value: true })
    expect(annotateToggle(on('control:isa.phantom-48v'), state, bridge).data).toEqual({ control: 'control:isa.phantom-48v', anchor: 'control:isa.phantom-48v', value: true, suggested: true })
    expect(annotateToggle(on('control:isa2.phantom-48v'), state, bridge)).toEqual(on('control:isa2.phantom-48v'))
    expect(annotateToggle(on('control:ql1.power'), state, bridge)).toEqual(on('control:ql1.power'))
    expect(annotateToggle(ev('connect', { a: 'x', b: 'y' }), state, bridge)).toEqual(ev('connect', { a: 'x', b: 'y' }))
    expect(annotateToggle(on('control:isa.phantom-48v'), null, bridge)).toEqual(on('control:isa.phantom-48v'))
    expect(annotateToggle(on('control:isa.phantom-48v'), stateOf([['ql1', 'yamaha-ql1']]), bridge)).toEqual(on('control:isa.phantom-48v'))
    expect(annotateToggle({ type: 'toggle', at: 1 }, state, bridge)).toEqual({ type: 'toggle', at: 1 })
  })

  it('the toggle forwarded to the controller carries the suggested mark when it is the suggested switch', () => {
    const state = stateOf([['isa', 'focusrite-isa-one']])
    const r = make({}, state)
    mountOscar(r.deps, r.f.impl)
    r.f.handle.send.mockClear()
    r.b.emit(state, [ev('toggle', { control: 'control:isa.phantom-48v', anchor: 'control:isa.phantom-48v', value: true })])
    expect(hostEvents(r.f)[0].data).toMatchObject({ suggested: true, value: true })
  })

  it('the lists the controller reads follow the stage of the bench: flows in the order of the path, the words « premier montage » on the flow of the stage', () => {
    const r = make({}, EMPTY)
    mountOscar(r.deps, r.f.impl)
    const deps = r.f.impl.createController.mock.calls[0][0] as { flows: { id: string }[]; flowKeywords: { flowId: string; keywords: string[] }[] }
    const montage = (): string => deps.flowKeywords.find((k) => k.keywords.includes('premier montage'))!.flowId
    const keep = deps.flows
    expect(keep.map((f) => f.id)[0]).toBe('premier-montage')
    r.b.emit(stateOf([]))
    expect(deps.flows).toBe(keep) // the same array: the controller reads it by reference
    expect(deps.flows.map((f) => f.id)[0]).toBe('ajouter-des-appareils')
    expect(montage()).toBe('ajouter-des-appareils')
    r.b.emit(stateOf([['ql1', 'yamaha-ql1']]))
    expect(deps.flows[0].id).toBe('deuxieme-appareil')
    r.b.emit(PAIR)
    expect(deps.flows[0].id).toBe('premier-cable')
    expect(montage()).toBe('premier-cable')
    r.b.emit(stateOf([['ql1', 'yamaha-ql1'], ['mic', 'shure-sm58']], { connections: [{ a: { instance: 'mic', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }] }))
    expect(deps.flows[0].id).toBe('lire-le-statut')
    expect(montage()).toBe('lire-le-statut')
    expect(deps.flows).toHaveLength(6) // a running or restored flow is always still there
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

  it('a device called « suggest » cannot shadow the reserved anchors: they are answered from the live suggestion, never looked up as written', () => {
    // a device whose id slugs to `suggest`, with a port `from`, has the real anchor port:suggest.from; the reserved meaning wins, in the resolver
    const { b, rr } = resolver(stateOf([['suggest', 'shure-sm58'], ['ql1', 'yamaha-ql1']]))
    expect(rr.getRect(SUGGEST_FROM)).toEqual(R)
    expect(b.spies.rectOf).not.toHaveBeenCalledWith(SUGGEST_FROM)
    expect(b.spies.rectOf).toHaveBeenCalledWith('port:suggest.out-xlr')
    // with nothing to suggest the answer is null even though an anchor of that name could exist
    const none = resolver(stateOf([['suggest', 'qsc-k12-2']]))
    expect(none.rr.getRect(SUGGEST_FROM)).toBeNull()
    expect(none.b.spies.rectOf).not.toHaveBeenCalled()
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

/** The whole wiring: the mount, the real controller and the real brain; the widget is replaced by a handle that hands every input to the controller. */
function wired(initial: TpState | null) {
  const r = make({}, initial)
  let controller!: ReturnType<typeof createController>
  const impl: MountImpl = {
    createController: ((deps: Parameters<typeof createController>[0]) => (controller = createController(deps))) as typeof createController,
    mountGuide: vi.fn((o: { controller: typeof controller; context: ControllerInput extends never ? never : Record<string, unknown> }) => {
      void o.controller.dispatch({ type: 'setContext', context: o.context })
      return { destroy: vi.fn(), send: (i: ControllerInput) => o.controller.dispatch(i) }
    }) as never,
  }
  mountOscar(r.deps, impl)
  const flush = (): Promise<void> => new Promise((res) => setTimeout(res, 0))
  return {
    r,
    flush,
    next: async () => {
      await flush()
      return controller.dispatch({ type: 'chip', id: 'next' })
    },
    ask: async (text: string) => {
      await flush()
      return controller.dispatch({ type: 'ask', text })
    },
    chip: (id: string) => controller.dispatch({ type: 'chip', id: id as never }),
    go: async (state: TpState, events: HostEvent[] = []) => {
      r.b.emit(state, events)
      await flush()
    },
    controller: () => controller,
  }
}
const texts = (v: GuideView): string[] => (v.bubble?.lines ?? []).map((l) => l.text)
const NEEDS = TP_STRINGS.planner.needInfo
const CHIPS_WITH_START = ['next', 'show', 'hint', 'where', 'start', 'mute', 'close']
const CHIPS_NO_START = ['next', 'show', 'hint', 'where', 'mute', 'close']

describe('mountOscar on the real controller: what each bench state says, and what is offered first', () => {
  it('1. no place: the verdict sentence and the neutral line, with the start chip; the chip and the words both open premier-montage at the place', async () => {
    const w = wired(EMPTY)
    const v = await w.next()
    expect(v.bubble?.kind).toBe('need-info')
    expect(texts(v)).toEqual([TP_STRINGS.verdict.placeFirst, NEEDS])
    expect(v.bubble?.chips.map((c) => c.id)).toEqual(CHIPS_WITH_START)
    const started = await w.chip('start')
    expect(started.bubble?.title).toBe('Parcours « Premier montage » : étape 1 sur 5.')
    expect(started.target?.anchor).toBe('nav:place')
    const a = await w.ask('comment faire un premier montage ?')
    expect(a.bubble?.title).toBe('Parcours « Premier montage » : étape 1 sur 5.')
    expect(texts(a)).toEqual([TP_STRINGS.flows['premier-montage'].steps.place])
    expect(a.target?.anchor).toBe('nav:place')
  })

  it('2. a place and no device: the empty-bench sentence; the chip and the words open the add-devices flow at the inventory', async () => {
    const w = wired(EMPTY)
    await w.go(stateOf([]))
    const v = await w.next()
    expect(v.bubble?.kind).toBe('need-info')
    expect(texts(v)).toEqual([TP_STRINGS.verdict.benchEmpty, NEEDS])
    expect(v.bubble?.chips.map((c) => c.id)).toEqual(CHIPS_WITH_START)
    const started = await w.chip('start')
    expect(started.bubble?.title).toBe('Parcours « Ajouter des appareils » : étape 1 sur 2.')
    const a = await w.ask('comment faire un premier montage ?')
    expect(a.bubble?.title).toBe('Parcours « Ajouter des appareils » : étape 1 sur 2.')
    expect(texts(a)).toEqual([TP_STRINGS.flows['ajouter-des-appareils'].steps.addFirst])
    expect(a.target?.anchor).toBe('nav:inventory')
  })

  it('2b. one device: the signal path reason; the words open « deuxième appareil »', async () => {
    const w = wired(EMPTY)
    await w.go(stateOf([['ql1', 'yamaha-ql1']], { firstReason: { code: 'NO_SOURCE', text_fr: 'Aucune source n’est branchée.', subjects: [] } }))
    const v = await w.next()
    expect(texts(v)).toEqual([`Aucune source n’est branchée. ${COPY.assist!.noSource}`, NEEDS]) // T1.4: the reason, then what to do (NO_SOURCE is a signal-path code)
    expect(v.bubble?.chips.map((c) => c.id)).toEqual(CHIPS_WITH_START)
    expect((await w.chip('start')).bubble?.title).toBe('Parcours « Ajouter un deuxième appareil » : étape 1 sur 1.')
    const a = await w.ask('comment faire un premier montage ?')
    expect(a.bubble?.title).toBe('Parcours « Ajouter un deuxième appareil » : étape 1 sur 1.')
    expect(a.target?.anchor).toBe('nav:inventory')
  })

  it('3. devices and no cable: the signal path first reason, verbatim; the words open the cable flow, pointing at the cable to draw', async () => {
    const w = wired(EMPTY)
    const reason = 'Le micro n’est relié à aucune entrée de la console.'
    await w.go(stateOf([['ql1', 'yamaha-ql1'], ['mic', 'shure-sm58']], { firstReason: { code: 'NO_CABLE', text_fr: reason, subjects: [] } }))
    const v = await w.next()
    expect(v.bubble?.kind).toBe('need-info')
    expect(texts(v)).toEqual([reason, NEEDS])
    expect(v.bubble?.chips.map((c) => c.id)).toEqual(CHIPS_WITH_START)
    const started = await w.chip('start')
    expect(started.bubble?.title).toBe('Parcours « Premier câble » : étape 1 sur 2.')
    expect(started.target?.anchor).toBe(SUGGEST_FROM)
    const a = await w.ask('comment faire un premier montage ?')
    expect(a.bubble?.title).toBe('Parcours « Premier câble » : étape 1 sur 2.')
    expect(texts(a)).toEqual([TP_STRINGS.flows['premier-cable'].steps.connect])
    expect(a.target?.anchor).toBe(SUGGEST_FROM)
  })

  it('3b. devices, no cable and no reason from the signal path: the not-yet sentence', async () => {
    const w = wired(EMPTY)
    await w.go(stateOf([['ql1', 'yamaha-ql1'], ['mic', 'shure-sm58']]))
    const v = await w.next()
    expect(texts(v)).toEqual([TP_STRINGS.verdict.notYet, NEEDS])
    expect(v.bubble?.chips.map((c) => c.id)).toEqual(CHIPS_WITH_START)
  })

  it('4. a rule error: the app’s own title and explanation, pointing at the first subject, no pointer sentence', async () => {
    const rules = registry.catalog.rules as unknown as RuleRow[]
    const rule = rules.find((x) => x.id === 'R4')! // an error rule the evaluator can emit (R1 to R3 are refusals: no event)
    const w = wired(EMPTY)
    await w.go(stateOf([['ql1', 'yamaha-ql1'], ['mic', 'shure-sm58']], { events: [{ ruleId: rule.id, severity: 'error', subjects: [{ instance: 'mic', port: 'out-xlr' }] }] }))
    const v = await w.next()
    expect(v.bubble?.kind).toBe('fix')
    // T1.5b: the creation route quotes Mode Création's wording of the rule (ruleOverride), not the catalog row (R1 here)
    expect(texts(v)).toEqual([modeCreationRuleText(rule.id, rules).detail])
    expect(texts(v)).not.toEqual([rule.teach_fr])
    expect(v.bubble?.title).toBe('Correction à apporter')
    expect(v.target?.anchor).toMatch(/^port:/)
    expect(JSON.stringify(v.bubble)).not.toContain(NEEDS)
    expect(v.bubble?.chips.map((c) => c.id)).toEqual(CHIPS_NO_START)
  })

  it('5. playable: the good sentence with what the app checks, and the next flow offered; the chip starts it at the status bar', async () => {
    const w = wired(EMPTY)
    await w.go(
      stateOf([['ql1', 'yamaha-ql1'], ['mic', 'shure-sm58']], {
        playbackReady: true,
        connections: [{ a: { instance: 'mic', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }],
      }),
    )
    const v = await w.next()
    expect(v.bubble?.kind).toBe('good')
    expect(texts(v)).toEqual([TP_STRINGS.verdict.allGood, 'Pour continuer, un parcours guidé est proposé.'])
    expect(v.bubble?.chips.map((c) => c.id)).toContain('start')
    const s = await w.chip('start')
    expect(s.bubble?.title).toBe('Parcours « Lire la barre d’état » : étape 1 sur 1.')
    expect(s.target?.anchor).toBe('nav:status')
  })

  it('no bubble of any stage carries a request to run a check again', async () => {
    const w = wired(EMPTY)
    for (const st of [EMPTY, stateOf([]), stateOf([['a', 'yamaha-ql1']]), PAIR]) {
      await w.go(st)
      expect(JSON.stringify((await w.next()).bubble)).not.toMatch(/relancer|vérification/)
    }
  })

  it('the offered flow is the one of the stage, and advances as the learner moves: place, devices, cable, status', async () => {
    const w = wired(EMPTY)
    const a = await w.ask('comment faire un premier montage ?')
    expect(a.bubble?.title).toContain('étape 1 sur 5')
    await w.go(stateOf([]), [ev('placeChosen')])
    expect((await w.next()).bubble?.title ?? '').toContain('étape 2 sur 5')
    await w.go(stateOf([['ql1', 'yamaha-ql1']]), [ev('deviceAdded', { device: 'device:ql1' }), ev('place')])
    await w.go(PAIR, [ev('deviceAdded', { device: 'device:mic' })])
    const c = await w.next()
    expect(c.bubble?.title).toContain('étape 4 sur 5')
    expect(c.target?.anchor).toBe(SUGGEST_FROM)
  })

  it('a rule error on the bench: the bubble is the app’s own cause and fix, nothing about « relancer la vérification »', async () => {
    const rules = registry.catalog.rules as unknown as RuleRow[]
    const rule = rules.find((x) => x.id === 'R4')! // an error rule the evaluator can emit (R1 to R3 are refusals: no event)
    const broken = stateOf([['ql1', 'yamaha-ql1'], ['mic', 'shure-sm58']], { events: [{ ruleId: rule.id, severity: 'error', subjects: [{ instance: 'mic', port: 'out-xlr' }] }] })
    const r = make({}, broken)
    const impl: MountImpl = { createController, mountGuide: vi.fn(() => ({ destroy: vi.fn(), send: vi.fn(async () => ({}) as GuideView) })) as never }
    mountOscar(r.deps, impl)
    const controller = (impl.mountGuide as Mock).mock.calls[0][0].controller as ReturnType<typeof createController>
    await controller.dispatch({ type: 'setContext', context: { page: 'workbench', mode: 'practice', setup: setupFor(broken, 1) } })
    const v = await controller.dispatch({ type: 'chip', id: 'next' })
    expect(v.bubble?.kind).toBe('fix')
    const all = JSON.stringify(v.bubble)
    expect(all).toContain(modeCreationRuleText(rule.id, rules).detail) // T1.5b: Mode Création's wording, not the catalog row
    expect(all).not.toContain(rule.teach_fr as string)
    expect(all).not.toContain('relancer')
    expect(v.target?.anchor).toMatch(/^port:/)
  })
})

// ── the tutorial « Premiers pas » (T3.1c) ─────────────────────────────────────────────────────────────────────────────

describe('the tutorial in the mount: ?design only, never started by the mount', () => {
  const designRig = (search: string, state: TpState | null = EMPTY): Rig => {
    const r = make({ search }, state)
    r.win.location.search = search
    return r
  }
  const flowsOf = (r: Rig) => (r.f.impl.createController.mock.calls[0][0] as { flows: { id: string; steps: { id: string }[] }[] }).flows
  const PATH = ['premier-montage', 'ajouter-des-appareils', 'deuxieme-appareil', 'premier-cable', 'lire-le-statut', 'alimentation-fantome']
  const DEVS: [string, string][] = [['q', 'yamaha-ql1'], ['k', 'qsc-k12-2']]
  const CABLE = { a: { instance: 'q', port: 'out-main-l' }, b: { instance: 'k', port: 'in-line-a' } }

  it('?design=1: the six path flows, then premiers-pas with its ten steps; it stays last when the stage changes', () => {
    const r = designRig('?design=1')
    expect(mountOscar(r.deps, r.f.impl)).not.toBeNull()
    const flows = flowsOf(r)
    expect(flows.map((f) => f.id)).toEqual([...PATH, 'premiers-pas'])
    expect(flows[6].steps).toHaveLength(10)
    r.b.emit(stateOf(DEVS))
    expect(flows.map((f) => f.id).slice(-1)).toEqual(['premiers-pas'])
    expect(flows).toHaveLength(7)
  })

  it('?design=5: premiers-pas is the ten standard steps until T6.3 builds the playable model (T3 close review S1; was ecoute, debrancher, rebrancher)', () => {
    const r = designRig('?design=5')
    mountOscar(r.deps, r.f.impl)
    expect(flowsOf(r).find((f) => f.id === 'premiers-pas')!.steps.map((s) => s.id)).toEqual(['console', 'micro', 'enceinte', 'console-enceinte', 'micro-console', 'lecture-console', 'multiprise', 'courant-console', 'courant-enceinte', 'ecoute'])
  })

  it('the mount never starts a flow: no flow control is sent at mount or on a change (T3.2 starts it on a request)', () => {
    const r = designRig('?design=1')
    mountOscar(r.deps, r.f.impl)
    r.b.emit(stateOf(DEVS), [ev('deviceAdded', { device: 'device:q' })])
    expect(sent(r.f).filter((i) => i.type === 'flow')).toEqual([])
  })

  it('?design=1: deviceAdded carries its role, connect its pair, a disconnect the pair of the state before, the playback toggle playback: true', () => {
    const r = designRig('?design=1', stateOf([]))
    mountOscar(r.deps, r.f.impl)
    r.b.emit(stateOf(DEVS), [ev('deviceAdded', { device: 'device:q' })])
    r.b.emit(stateOf(DEVS, { connections: [CABLE] }), [ev('connect', { a: 'port:q.out-main-l', b: 'port:k.in-line-a' })])
    r.b.emit(stateOf([['q', 'yamaha-ql1']]), [ev('disconnect', { a: 'port:q.out-main-l', b: 'port:k.in-line-a' })])
    r.b.emit(stateOf([['q', 'yamaha-ql1']]), [ev('toggle', { control: 'control:q.playback-usb', anchor: 'control:q.playback-usb', value: true })])
    expect(hostEvents(r.f).map((e) => e.data)).toEqual([
      { device: 'device:q', role: 'source-console' },
      { a: 'port:q.out-main-l', b: 'port:k.in-line-a', pair: 'console-speaker' },
      { a: 'port:q.out-main-l', b: 'port:k.in-line-a', pair: 'console-speaker' },
      { control: 'control:q.playback-usb', anchor: 'control:q.playback-usb', value: true, playback: true },
    ])
  })

  it('without ?design the events go through untouched, and a change that only starts a sound tells the controller nothing', () => {
    const r = make({}, stateOf(DEVS))
    mountOscar(r.deps, r.f.impl)
    const before = sent(r.f).length
    r.b.emit(stateOf(DEVS), [ev('playStarted', { source: 'test' })])
    expect(sent(r.f).length).toBe(before)
    r.b.emit(stateOf(DEVS, { connections: [CABLE] }), [ev('connect', { a: 'port:q.out-main-l', b: 'port:k.in-line-a' })])
    expect(hostEvents(r.f).map((e) => e.data)).toEqual([{ a: 'port:q.out-main-l', b: 'port:k.in-line-a' }])
  })

  it('?design=1: a sound start reaches the controller as playStarted', () => {
    const r = designRig('?design=1', stateOf(DEVS))
    mountOscar(r.deps, r.f.impl)
    r.b.emit(stateOf(DEVS), [ev('playStarted', { source: 'test' })])
    expect(hostEvents(r.f)).toEqual([ev('playStarted', { source: 'test' })])
  })

  it('?design with ?oscar=0 or an exam address mounts nothing (the tutorial cannot exist there)', () => {
    for (const search of ['?design=1&oscar=0', '?design=1&mode=exam']) {
      const r = designRig(search)
      expect(mountOscar(r.deps, r.f.impl)).toBeNull()
      expect(r.f.impl.createController).not.toHaveBeenCalled()
    }
  })
})

describe('createRectResolver: the tutorial anchors on a fake bridge and a fake page', () => {
  const B = (n: number) => ({ x: n, y: n, width: 20, height: 10 })
  type Box = ReturnType<typeof B>
  function page(boxes: Record<string, Box>) {
    return { querySelector: (sel: string) => (Object.hasOwn(boxes, sel) ? { getBoundingClientRect: () => boxes[sel] } : null) }
  }
  function resolver(state: TpState, boxes: Record<string, Box>, selection: string | null = null) {
    const b = fakeBridge(state)
    Object.assign(b.bridge, { selection: () => selection })
    return createRectResolver({ bridge: b.bridge, registry, now: () => 0, doc: page(boxes) })
  }
  const S = stateOf([['q', 'yamaha-ql1'], ['k', 'qsc-k12-2']])
  const DRAWER = '[data-testid="inventory-drawer"][data-open="true"]'

  it('inventory item: the card, else its tab, else the « Matériel » menu; the speaker tab; null with nothing on the page', () => {
    expect(resolver(S, {}).getRect('nav:inventory.item.yamaha-ql1')).toBeNull()
    expect(resolver(S, { '#cr-menu-materiel': B(1) }).getRect('nav:inventory.item.yamaha-ql1')).toEqual({ x: 1, y: 1, w: 20, h: 10 })
    const tab = `${DRAWER} [role="tab"][data-tab="consoles"]`
    const item = `${DRAWER} [data-testid="inventory-item"][data-device-id="yamaha-ql1"]`
    expect(resolver(S, { '#cr-menu-materiel': B(1), [tab]: B(2) }).getRect('nav:inventory.item.yamaha-ql1')).toEqual({ x: 2, y: 2, w: 20, h: 10 })
    expect(resolver(S, { '#cr-menu-materiel': B(1), [tab]: B(2), [item]: B(3) }).getRect('nav:inventory.item.yamaha-ql1')).toEqual({ x: 3, y: 3, w: 20, h: 10 })
    expect(resolver(S, { [`${DRAWER} [role="tab"][data-tab="enceintes"]`]: B(4) }).getRect('nav:inventory.tab.enceintes')).toEqual({ x: 4, y: 4, w: 20, h: 10 })
  })

  it('connect from: the console (the bridge’s device rect) until it is selected, then its « Connecter à… » button', () => {
    const button = '[data-testid="properties-content"] [data-key="connect:out-main-l"]'
    expect(resolver(S, { [button]: B(5) }).getRect('nav:connect.from.console-speaker')).toEqual(R)
    expect(resolver(S, { [button]: B(5) }, 'q').getRect('nav:connect.from.console-speaker')).toEqual({ x: 5, y: 5, w: 20, h: 10 })
  })

  it('playback: the « Lecture console » row once the console is selected, else the bridge’s control rect', () => {
    const row = '[data-testid="properties-content"] [data-key="ctl:playback-usb"]'
    expect(resolver(S, { [row]: B(6) }).getRect('control:suggest.playback')).toEqual(R)
    expect(resolver(S, { [row]: B(6) }, 'q').getRect('control:suggest.playback')).toEqual({ x: 6, y: 6, w: 20, h: 10 })
  })

  it('nav:ecoute and nav:checklist-power are shell anchors the bridge resolves; a resolver without a page still answers the bridge anchors', () => {
    const b = fakeBridge(S)
    const rr = createRectResolver({ bridge: b.bridge, registry, now: () => 0 })
    expect(rr.getRect('nav:ecoute')).toEqual(R)
    expect(b.spies.rectOf).toHaveBeenCalledWith('nav:ecoute')
    expect(rr.getRect('nav:inventory.item.yamaha-ql1')).toBeNull() // no page to read
  })

  it('T3.4: a power step rings the helper button once the tutorial unlocked it (triggers); the strip pair before that (does not trigger)', () => {
    const P = stateOf([['q', 'yamaha-ql1'], ['k', 'qsc-k12-2'], ['p', 'multiprise-secteur']])
    const power = '[data-testid="checklist-power"]'
    let unlocked = false
    let offered = true // T3 close review S3: Mode Création offers the helper now
    const rr = createRectResolver({ bridge: fakeBridge(P).bridge, registry, now: () => 0, doc: page({ [power]: B(7) }), helperUnlocked: () => unlocked, helperOffered: () => offered })
    expect(rr.getRect('nav:connect.from.mains-console')).toEqual(R) // the console (the bridge's device rect)
    unlocked = true
    rr.clear()
    expect(rr.getRect('nav:connect.from.mains-console')).toEqual({ x: 7, y: 7, w: 20, h: 10 })
    offered = false // S3: unlocked, but the button is not there (a full strip): the console, never the missing button
    rr.clear()
    expect(rr.getRect('nav:connect.from.mains-console')).toEqual(R)
  })

  it('S4 (T3 close review): nav:ecoute rings the checklist chip while the bench cannot play; once it can, the bridge’s Écoute as before', () => {
    const chip = '[data-testid="checklist-chip"]'
    const blocked = { ...stateOf([['q', 'yamaha-ql1'], ['k', 'qsc-k12-2']]), playbackReady: false }
    const b = fakeBridge(blocked)
    const rr = createRectResolver({ bridge: b.bridge, registry, now: () => 0, doc: page({ [chip]: B(8) }) })
    expect(rr.getRect('nav:ecoute')).toEqual({ x: 8, y: 8, w: 20, h: 10 })
    const ready = fakeBridge({ ...blocked, playbackReady: true })
    const rr2 = createRectResolver({ bridge: ready.bridge, registry, now: () => 0, doc: page({ [chip]: B(8) }) })
    expect(rr2.getRect('nav:ecoute')).toEqual(R)
    expect(ready.spies.rectOf).toHaveBeenCalledWith('nav:ecoute')
  })
})

describe('the tutorial at run time in the mount (T3.2)', () => {
  const designRig = (search: string, state: TpState | null = EMPTY): Rig => {
    const r = make({ search }, state)
    r.win.location.search = search
    return r
  }
  const flush = (): Promise<void> => new Promise((res) => setTimeout(res, 0))
  const withRequest = (r: Rig, req: { n: number; kind: 'start' | 'restart' | 'skip'; allowed: boolean } | null): void => {
    Object.assign(r.b.bridge, { tutorialRequest: () => req, playing: () => null })
  }

  it('?design: a request above the guide record starts premiers-pas (at mount, the request came first); no second start on the same request', async () => {
    const r = designRig('?design=1', stateOf([]))
    withRequest(r, { n: 1, kind: 'start', allowed: true })
    mountOscar(r.deps, r.f.impl)
    await flush()
    expect(sent(r.f).filter((i) => i.type === 'flow')).toEqual([{ type: 'flow', control: { action: 'start', flowId: 'premiers-pas' } }])
    r.b.emit(stateOf([]), [ev('tutorialRequest', { n: 1 })])
    await flush()
    expect(sent(r.f).filter((i) => i.type === 'flow')).toHaveLength(1)
    // the `tutorialRequest` event is the mount's, never the controller's
    expect(hostEvents(r.f).map((e) => e.type)).not.toContain('tutorialRequest')
  })

  it('?design: the controller gets the tutorial’s observed storage, not the page’s; without ?design the page’s own (or none)', () => {
    const storage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } as unknown as Storage
    const r = designRig('?design=1')
    r.deps.storage = storage
    withRequest(r, null)
    mountOscar(r.deps, r.f.impl)
    const got = (r.f.impl.createController.mock.calls[0][0] as { storage?: unknown }).storage
    expect(got).toBeDefined()
    expect(got).not.toBe(storage)
    const plain = make({ storage })
    mountOscar(plain.deps, plain.f.impl)
    expect((plain.f.impl.createController.mock.calls[0][0] as { storage?: unknown }).storage).toBe(storage)
  })

  it('without ?design a request does nothing: no flow control is ever sent', async () => {
    const r = make({}, stateOf([]))
    withRequest(r, { n: 5, kind: 'start', allowed: true })
    mountOscar(r.deps, r.f.impl)
    r.b.emit(stateOf([]), [ev('tutorialRequest', { n: 5 })])
    await flush()
    expect(sent(r.f).filter((i) => i.type === 'flow')).toEqual([])
  })
})

// ── T4.3: the corner an unconfigured Oscar starts in comes from the package's layout preset ─────────────────────────────────────────────

describe('Oscar corner default per package (storage wrapper)', () => {
  const KEY = 'oscar-guide.ui.v1'
  const memory = (init: Record<string, string> = {}): Storage => {
    const m = new Map(Object.entries(init))
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage
  }
  const storageOf = (r: Rig): { getItem(k: string): string | null; setItem(k: string, v: string): void } | null =>
    (r.f.impl.mountGuide.mock.calls[0][0] as { storage: { getItem(k: string): string | null; setItem(k: string, v: string): void } | null }).storage

  it('the wrapper returns the package corner while nothing is saved, the saved corner after, and passes every other key through', () => {
    const base = memory({ other: 'x' })
    const w = cornerDefaultStorage(base, KEY, 'bl')
    expect(w.getItem(KEY)).toBe(JSON.stringify({ corner: 'bl' }))
    expect(w.getItem('other')).toBe('x')
    expect(w.getItem('missing')).toBeNull()
    w.setItem(KEY, JSON.stringify({ corner: 'tr' })) // the learner moved Oscar
    expect(base.getItem(KEY)).toBe(JSON.stringify({ corner: 'tr' }))
    expect(w.getItem(KEY)).toBe(JSON.stringify({ corner: 'tr' }))
  })

  it('a null or throwing storage still gives the package corner, and a write is kept for the session', () => {
    const w = cornerDefaultStorage(null, KEY, 'tr')
    expect(w.getItem(KEY)).toBe(JSON.stringify({ corner: 'tr' }))
    w.setItem(KEY, JSON.stringify({ corner: 'br' }))
    expect(w.getItem(KEY)).toBe(JSON.stringify({ corner: 'br' }))
    const bad = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } } as unknown as Storage
    const w2 = cornerDefaultStorage(bad, KEY, 'bl')
    expect(w2.getItem(KEY)).toBe(JSON.stringify({ corner: 'bl' }))
    expect(() => w2.setItem(KEY, JSON.stringify({ corner: 'br' }))).not.toThrow()
  })

  it.each([[1, 'br'], [2, 'bl'], [3, 'tr'], [4, 'br'], [5, 'bl']] as const)('?design=%i: the widget storage says corner %s while nothing is saved', (id, corner) => {
    const r = make({ search: `?design=${id}`, storage: memory() })
    expect(mountOscar(r.deps, r.f.impl)).not.toBeNull()
    expect(storageOf(r)!.getItem(KEY)).toBe(JSON.stringify({ corner }))
  })

  it('a corner the learner saved wins over the package', () => {
    const r = make({ search: '?design=3', storage: memory({ [KEY]: JSON.stringify({ corner: 'bl' }) }) })
    mountOscar(r.deps, r.f.impl)
    expect(storageOf(r)!.getItem(KEY)).toBe(JSON.stringify({ corner: 'bl' }))
  })

  it('no ?design: the storage is handed to the widget exactly as before (same object, no wrapper)', () => {
    const st = memory()
    const r = make({ storage: st })
    mountOscar(r.deps, r.f.impl)
    expect(storageOf(r)).toBe(st)
    expect(st.getItem(KEY)).toBeNull()
  })

  it('no package corner is the view cube\'s corner (top left)', () => {
    for (const id of [1, 2, 3, 4, 5] as const) expect(['br', 'bl', 'tr']).toContain(packageById(id).layout.oscarCorner)
  })
})

// ── T5.3 to T5.5: the new Oscar's skin, its host events and the mute default ─────────────────────────────────────────────────────────────

describe('pin (T5.3): the vendored names the skin reads are still there', () => {
  const src = (p: string): string => readFileSync(fileURLToPath(new URL(`../../src/guide/vendor/${p}`, import.meta.url)), 'utf8')
  it('.oscar-guide, .oscar-icon-wrap, .oscar-icon (widget), svg.oscar-mascot with data-state (mascot), .oscar-ring and its drop (overlay), .oscar-header / .oscar-title (bubble)', () => {
    const widget = src('ui/widget.ts')
    expect(widget).toContain('h(doc, "div", "oscar-guide"')
    expect(widget).toContain('h(doc, "div", "oscar-icon-wrap")')
    expect(widget).toContain('h(doc, "button", "oscar-icon"')
    expect(widget).toContain('"aria-expanded"')
    const mascot = src('ui/mascot.ts')
    expect(mascot).toContain('s(doc, "svg", { viewBox: "0 0 64 64", focusable: "false", "aria-hidden": "true" }, "oscar-mascot")')
    expect(mascot).toContain('root.setAttribute("data-state", next)')
    const overlay = src('ui/overlay.ts')
    expect(overlay).toContain('h(doc, "div", "oscar-ring", undefined')
    expect(overlay).toContain('"oscar-ring oscar-ring-drop"')
    expect(overlay).toContain('el.style.left = ')
    const bubble = src('ui/bubble.ts')
    expect(bubble).toContain('h(doc, "div", "oscar-header")')
    expect(bubble).toContain('h(doc, "div", "oscar-title", L.title)')
    // the box the host svg takes: the vendored mascot rule fills the icon
    expect(src('guide.css')).toMatch(/\.oscar-mascot \{\s*display: block;\s*width: 100%;\s*height: 100%;/)
  })
  it('the mute key (T5.5): the controller reads `storageKey + ".muted"` once, as "1"', () => {
    const c = src('core/controller.ts')
    expect(c).toContain('const MUTE_SUFFIX = ".muted";')
    expect(c).toContain('lastMuted = parseMuted(readItem(storageKey + MUTE_SUFFIX));')
    expect(c).toContain('return raw === "1";')
    expect(c.match(/MUTE_SUFFIX/g)).toHaveLength(3) // the constant, the one read, the one write
  })
})

describe('mountOscar: the skin (T5.3, T5.4; controller ruling 4: only under ?design in Mode Création)', () => {
  type Play = 'nod' | 'wave' | 'celebrate' | 'shrug'
  const skinImpl = () => {
    const f = fakeImpl()
    const plays: Play[] = []
    const skin = { play: vi.fn((e: Play) => void plays.push(e)), destroy: vi.fn(), character: {}, setCelebrationsSpent: vi.fn((_v: boolean) => undefined) }
    const attachSkin = vi.fn((_root: unknown, _d: unknown) => skin)
    return { ...f, impl: { ...f.impl, attachSkin } as unknown as MountImpl & typeof f.impl & { attachSkin: typeof attachSkin }, skin, plays, attachSkin }
  }
  const memory = (init: Record<string, string> = {}): Storage => {
    const m = new Map(Object.entries(init))
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage
  }

  it('triggers on ?design=1: attached once, on the landmark, after the widget; the badge is COPY oscar.badge', () => {
    const r = make({ search: '?design=1', storage: memory() })
    const s = skinImpl()
    expect(mountOscar(r.deps, s.impl)).not.toBeNull()
    expect(s.attachSkin).toHaveBeenCalledTimes(1)
    const [root, d] = s.attachSkin.mock.calls[0] as [unknown, { badge: string }]
    expect(root).toBe((s.impl.mountGuide.mock.calls[0][0] as { root: unknown }).root)
    expect(d.badge).toBe(COPY.oscar!.badge)
    expect(COPY.oscar!.badge).toBe('Oscar · Assistant')
  })

  it('does not trigger: the plain address, an unknown ?design, the legacy route (the vendored mascot stays)', () => {
    for (const over of [{ search: '' }, { search: '?design=9' }, { search: '?level=a1&oscar=legacy&design=1', route: 'legacy' as const }]) {
      const r = make(over)
      const s = skinImpl()
      expect(mountOscar(r.deps, s.impl), JSON.stringify(over)).not.toBeNull()
      expect(s.attachSkin, JSON.stringify(over)).not.toHaveBeenCalled()
    }
  })

  it('a skin that throws or attaches nothing leaves the guide mounted', () => {
    const r = make({ search: '?design=1', storage: memory() })
    const s = skinImpl()
    s.attachSkin.mockImplementation(() => null as never)
    expect(mountOscar(r.deps, s.impl)).not.toBeNull()
    const r2 = make({ search: '?design=1', storage: memory() })
    const s2 = skinImpl()
    s2.attachSkin.mockImplementation(() => {
      throw new Error('x')
    })
    expect(mountOscar(r2.deps, s2.impl)).not.toBeNull()
    expect(s2.impl.mountGuide).toHaveBeenCalledTimes(1)
  })

  it('first accepted connection celebrates, the next nods; the first sound celebrates; a refused connection shrugs', () => {
    const r = make({ search: '?design=1', storage: memory() })
    const s = skinImpl()
    mountOscar(r.deps, s.impl)
    r.b.emit(PAIR, [ev('connect', { a: 'port:mic.out-xlr', b: 'port:ql1.in-mic-1' })])
    r.b.emit(PAIR, [ev('connect', { a: 'port:x.a', b: 'port:y.b' })])
    r.b.emit(PAIR, [ev('playStarted', { source: 'test' })])
    r.b.emit(PAIR, [ev('playStarted', { source: 'test' })])
    r.b.emit(PAIR, [ev('connectRefused')])
    expect(s.plays).toEqual(['celebrate', 'nod', 'celebrate', 'shrug'])
  })

  it('the skin-only events (connectRefused, profileChosen) never reach the controller, with or without ?design', () => {
    for (const search of ['', '?design=1']) {
      const r = make({ search, storage: memory() })
      const s = skinImpl()
      mountOscar(r.deps, s.impl)
      r.b.emit(PAIR, [ev('connectRefused'), ev('profileChosen')])
      expect(hostEvents(s).map((e) => e.type), search).toEqual([])
    }
  })

  it('a step done nods (the controller persisted the next step of the tutorial); its start does not', async () => {
    const st = memory()
    const r = make({ search: '?design=1', storage: st })
    const s = skinImpl()
    mountOscar(r.deps, s.impl)
    const deps = s.impl.createController.mock.calls[0][0] as { storage: Storage; flows: { id: string }[] }
    const id = deps.flows[deps.flows.length - 1].id
    const save = (index: number, status = 'running'): void => deps.storage.setItem('oscar-guide.state.v1', JSON.stringify({ v: 1, flow: { flowId: id, index, status }, hint: null }))
    save(0)
    await Promise.resolve()
    expect(s.plays).toEqual([])
    save(1)
    await Promise.resolve()
    expect(s.plays).toEqual(['nod'])
    save(1)
    save(0) // back to step 1 (a restart): no nod
    await Promise.resolve()
    expect(s.plays).toEqual(['nod'])
  })

  it('a click on the « Passer cette étape » chip: the next advance is not a nod (the same capture listener, no new one)', async () => {
    const r = make({ search: '?design=1', storage: memory() })
    const s = skinImpl()
    mountOscar(r.deps, s.impl)
    const count = r.d.count()
    const deps = s.impl.createController.mock.calls[0][0] as { storage: Storage; flows: { id: string }[] }
    const id = deps.flows[deps.flows.length - 1].id
    const save = (index: number): void => deps.storage.setItem('oscar-guide.state.v1', JSON.stringify({ v: 1, flow: { flowId: id, index, status: 'running' }, hint: null }))
    save(2)
    r.d.click({ closest: (sel: string) => (sel === '[data-chip="skip"]' ? {} : null) })
    save(3)
    await Promise.resolve()
    expect(s.plays).toEqual([])
    save(4)
    expect(s.plays).toEqual(['nod'])
    expect(r.d.count()).toBe(count)
  })

  it('round 1, N1: a skip-chip click while no tutorial runs does not swallow the nod of a later step done', async () => {
    const r = make({ search: '?design=1', storage: memory() })
    const s = skinImpl()
    mountOscar(r.deps, s.impl)
    const deps = s.impl.createController.mock.calls[0][0] as { storage: Storage; flows: { id: string }[] }
    const id = deps.flows[deps.flows.length - 1].id
    const save = (index: number): void => deps.storage.setItem('oscar-guide.state.v1', JSON.stringify({ v: 1, flow: { flowId: id, index, status: 'running' }, hint: null }))
    r.d.click({ closest: (sel: string) => (sel === '[data-chip="skip"]' ? {} : null) }) // another flow's skip chip: no tutorial runs
    save(0)
    save(1)
    expect(s.plays).toEqual(['nod'])
  })

  it('round 1, N1: the skip flag lasts one tutorial change, whatever it was', async () => {
    const r = make({ search: '?design=1', storage: memory() })
    const s = skinImpl()
    mountOscar(r.deps, s.impl)
    const deps = s.impl.createController.mock.calls[0][0] as { storage: Storage; flows: { id: string }[] }
    const id = deps.flows[deps.flows.length - 1].id
    const save = (index: number): void => deps.storage.setItem('oscar-guide.state.v1', JSON.stringify({ v: 1, flow: { flowId: id, index, status: 'running' }, hint: null }))
    save(3)
    r.d.click({ closest: (sel: string) => (sel === '[data-chip="skip"]' ? {} : null) })
    save(1) // the skip did not advance: a jump back (« Recommencer ») came first
    save(2)
    expect(s.plays).toEqual(['nod'])
  })

  it('round 1, S4: once the first accepted connection and the first sound have celebrated, the skin is told (the vendored flow-end celebrate is drawn as a nod)', () => {
    const r = make({ search: '?design=1', storage: memory() })
    const s = skinImpl()
    mountOscar(r.deps, s.impl)
    r.b.emit(PAIR, [ev('connect', { a: 'port:a.x', b: 'port:b.y' })])
    expect(s.skin.setCelebrationsSpent).not.toHaveBeenCalledWith(true)
    r.b.emit(PAIR, [ev('playStarted', { source: 'test' })])
    expect(s.skin.setCelebrationsSpent).toHaveBeenLastCalledWith(true)
  })

  it('round 1, N2: a change the app made (undo, redo, a load, the power helper: the bridge adds appChange) is neither celebrated nor nodded, and appChange never reaches the controller', () => {
    const r = make({ search: '?design=1', storage: memory() })
    const s = skinImpl()
    mountOscar(r.deps, s.impl)
    r.b.emit(PAIR, [ev('connect', { a: 'port:a.x', b: 'port:b.y' }), ev('appChange')])
    expect(s.plays).toEqual([])
    expect(hostEvents(s).map((e) => e.type)).toEqual(['connect'])
    r.b.emit(PAIR, [ev('connect', { a: 'port:c.x', b: 'port:d.y' })])
    expect(s.plays).toEqual(['celebrate'])
  })

  it('destroy: the skin goes before the widget', () => {
    const r = make({ search: '?design=1', storage: memory() })
    const s = skinImpl()
    const order: string[] = []
    s.skin.destroy.mockImplementation(() => void order.push('skin'))
    s.handle.destroy.mockImplementation(() => void order.push('widget'))
    mountOscar(r.deps, s.impl)!.destroy()
    expect(order).toEqual(['skin', 'widget'])
  })
})

describe('mountOscar: Oscar muted by default (T5.5)', () => {
  const MUTE = 'oscar-guide.state.v1.muted'
  const memory = (init: Record<string, string> = {}): Storage => {
    const m = new Map(Object.entries(init))
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage
  }
  const controllerStorage = (r: Rig): Storage | undefined => (r.f.impl.createController.mock.calls[0][0] as { storage?: Storage }).storage
  const withProfile = (r: Rig, p: { v: string | null }): void => {
    ;(r.b.bridge as unknown as { profile: () => string | null }).profile = () => p.v
  }

  it('triggers on first mount: package 4, or the engineer profile on another package; nothing is written', () => {
    const st4 = memory()
    const r4 = make({ search: '?design=4', storage: st4 })
    mountOscar(r4.deps, r4.f.impl)
    expect(controllerStorage(r4)!.getItem(MUTE)).toBe('1')
    expect(st4.getItem(MUTE)).toBeNull()
    const r1 = make({ search: '?design=1', storage: memory() })
    withProfile(r1, { v: 'metier' })
    mountOscar(r1.deps, r1.f.impl)
    expect(controllerStorage(r1)!.getItem(MUTE)).toBe('1')
  })

  it('does not trigger: another profile on package 1; a stored choice (the learner unmuted); the plain address with the engineer profile', () => {
    const r1 = make({ search: '?design=1', storage: memory() })
    withProfile(r1, { v: 'decouvre' })
    mountOscar(r1.deps, r1.f.impl)
    expect(controllerStorage(r1)!.getItem(MUTE)).toBeNull()
    const r4 = make({ search: '?design=4', storage: memory({ [MUTE]: '0' }) })
    mountOscar(r4.deps, r4.f.impl)
    expect(controllerStorage(r4)!.getItem(MUTE)).toBe('0')
    const st = memory()
    const plain = make({ storage: st })
    withProfile(plain, { v: 'metier' })
    mountOscar(plain.deps, plain.f.impl)
    expect(controllerStorage(plain)).toBe(st) // the same storage object as before: no wrapper on the plain address
    expect(controllerStorage(plain)!.getItem(MUTE)).toBeNull()
  })

  it('the engineer profile chosen after the mount (the start screen): mute then close, once, when the bubble is closed and nothing is stored', () => {
    const r = make({ search: '?design=1', storage: memory() })
    const p = { v: null as string | null }
    withProfile(r, p)
    r.f.controller.getView.mockImplementation(() => ({ muted: false, bubble: null }))
    mountOscar(r.deps, r.f.impl)
    r.b.emit(PAIR, [ev('profileChosen')])
    expect(sent(r.f).filter((i) => i.type === 'chip')).toEqual([])
    p.v = 'metier'
    r.b.emit(PAIR, [ev('profileChosen')])
    expect(sent(r.f).filter((i) => i.type === 'chip')).toEqual([{ type: 'chip', id: 'mute' }, { type: 'chip', id: 'close' }])
    r.b.emit(PAIR, [ev('profileChosen')])
    expect(sent(r.f).filter((i) => i.type === 'chip')).toHaveLength(2)
  })

  it('round 1, S1: the late mute is not stored: the « 1 » the vendored mute chip writes is removed at once (this page stays muted in memory; the next mount derives it from the profile)', () => {
    const st = memory()
    const r = make({ search: '?design=1', storage: st })
    const p = { v: null as string | null }
    withProfile(r, p)
    r.f.controller.getView.mockImplementation(() => ({ muted: false, bubble: null }))
    mountOscar(r.deps, r.f.impl)
    const ctrl = controllerStorage(r)!
    // the vendored controller persists the mute synchronously inside the chip's dispatch (controller.ts setMute -> persist)
    r.f.handle.send.mockImplementation((i: ControllerInput) => {
      if (i.type === 'chip' && i.id === 'mute') ctrl.setItem(MUTE, '1')
      return Promise.resolve({} as GuideView)
    })
    p.v = 'metier'
    r.b.emit(PAIR, [ev('profileChosen')])
    expect(sent(r.f).filter((i) => i.type === 'chip')).toHaveLength(2)
    expect(st.getItem(MUTE)).toBeNull()
    // and a later unmute by the learner is stored as before
    ctrl.setItem(MUTE, '0')
    expect(st.getItem(MUTE)).toBe('0')
  })

  it('late engineer profile, does not trigger: a bubble open (the tutorial speaks: the next mount applies it), a stored choice, already muted, or another profile', () => {
    const cases: { view: { muted: boolean; bubble: unknown }; stored?: string; profile: string }[] = [
      { view: { muted: false, bubble: { kind: 'step' } }, profile: 'metier' },
      { view: { muted: false, bubble: null }, stored: '0', profile: 'metier' },
      { view: { muted: true, bubble: null }, profile: 'metier' },
      { view: { muted: false, bubble: null }, profile: 'etudie' },
    ]
    for (const c of cases) {
      const r = make({ search: '?design=1', storage: memory(c.stored === undefined ? {} : { [MUTE]: c.stored }) })
      const p = { v: null as string | null }
      withProfile(r, p)
      r.f.controller.getView.mockImplementation(() => c.view)
      mountOscar(r.deps, r.f.impl)
      p.v = c.profile
      r.b.emit(PAIR, [ev('profileChosen')])
      r.b.emit(PAIR, [ev('profileChosen')])
      expect(sent(r.f).filter((i) => i.type === 'chip'), JSON.stringify(c)).toEqual([])
    }
  })
})

describe('mountOscar: the step card (T6.1, spec 6.6): the tutorial’s progress presenter, only under ?design', () => {
  const cardImpl = () => {
    const f = fakeImpl()
    const card = { update: vi.fn(), destroy: vi.fn() }
    const mountStepCard = vi.fn((_d: unknown) => card)
    return { ...f, impl: { ...f.impl, mountStepCard } as unknown as MountImpl & typeof f.impl & { mountStepCard: typeof mountStepCard }, card, mountStepCard }
  }
  const memory = (): Storage => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage
  }
  type CardDeps = { steps: string[]; presenter: string; record(): { status: string }; closing(): string[]; skip(): void }

  it('triggers on ?design=1: mounted once, with the run’s ten step ids, the package’s presenter, and the first look told to it', () => {
    const r = make({ search: '?design=1', storage: memory() })
    const c = cardImpl()
    expect(mountOscar(r.deps, c.impl)).not.toBeNull()
    expect(c.mountStepCard).toHaveBeenCalledTimes(1)
    const d = c.mountStepCard.mock.calls[0][0] as CardDeps
    expect(d.steps).toEqual(['console', 'micro', 'enceinte', 'console-enceinte', 'micro-console', 'lecture-console', 'multiprise', 'courant-console', 'courant-enceinte', 'ecoute'])
    expect(d.presenter).toBe('step-card')
    expect(d.record().status).toBe('idle')
    expect(c.card.update).toHaveBeenCalled() // the first look: a tutorial restored from storage shows its card at once
  })

  it('the presenter is the package’s: package 2 and 4 hand `checklist`, 1, 3, 5 `step-card` (data, no branch on the number)', () => {
    const seen: string[] = []
    for (const n of [1, 2, 3, 4, 5]) {
      const r = make({ search: `?design=${n}`, storage: memory() })
      const c = cardImpl()
      mountOscar(r.deps, c.impl)
      seen.push((c.mountStepCard.mock.calls[0][0] as CardDeps).presenter)
    }
    expect(seen).toEqual(['step-card', 'checklist', 'step-card', 'checklist', 'step-card'])
  })

  it('does not trigger: the plain address, an unknown ?design, the legacy route have no card', () => {
    for (const over of [{ search: '' }, { search: '?design=9' }, { search: '?level=a1&oscar=legacy&design=1', route: 'legacy' as const }]) {
      const r = make(over)
      const c = cardImpl()
      expect(mountOscar(r.deps, c.impl), JSON.stringify(over)).not.toBeNull()
      expect(c.mountStepCard, JSON.stringify(over)).not.toHaveBeenCalled()
    }
  })

  it('a change of the bench is told to the card (the closing lines follow it); destroy removes the card', () => {
    const r = make({ search: '?design=1', storage: memory() })
    const c = cardImpl()
    const h = mountOscar(r.deps, c.impl)!
    const n = c.card.update.mock.calls.length
    r.b.emit(PAIR, [ev('deviceAdded', { device: 'device:q' })])
    expect(c.card.update.mock.calls.length).toBeGreaterThan(n)
    h.destroy()
    expect(c.card.destroy).toHaveBeenCalledTimes(1)
  })

  it('the closing lines: the pinned simulation sentence alone while the bench’s mic verdict is unknown (never a claim about the mic)', () => {
    const r = make({ search: '?design=1', storage: memory() })
    const c = cardImpl()
    mountOscar(r.deps, c.impl)
    const d = c.mountStepCard.mock.calls[0][0] as CardDeps
    expect(d.closing()).toEqual([COPY.listen!.simple])
    r.b.bridge.mic = () => ({ micOk: true, micReasons: [] })
    expect(d.closing()).toEqual([COPY.listen!.simple, COPY.checklist!.micCabled])
    r.b.bridge.mic = () => ({ micOk: false, micReasons: [{ code: 'NO_MIC', text_fr: 'texte du moteur' }] })
    expect(d.closing()).toEqual([COPY.listen!.simple, 'texte du moteur'])
  })

  it('a card that throws is one warning and the guide stays mounted', () => {
    const r = make({ search: '?design=1', storage: memory() })
    const c = cardImpl()
    c.mountStepCard.mockImplementation(() => {
      throw new Error('x')
    })
    expect(mountOscar(r.deps, c.impl)).not.toBeNull()
    expect(c.impl.mountGuide).toHaveBeenCalledTimes(1)
  })
})

describe('hostInsets: the tutorial’s reserved row (T6.1)', () => {
  type Box = { top: number; bottom: number; left: number; right: number; width: number; height: number }
  const box = (left: number, top: number, width: number, height: number): Box => ({ left, top, width, height, right: left + width, bottom: top + height })
  const docOf = (boxes: Record<string, Box>): Document =>
    ({
      documentElement: { clientWidth: 1366, clientHeight: 768 },
      querySelector: (sel: string) => (boxes[sel] ? { getBoundingClientRect: () => boxes[sel] } : null),
    }) as unknown as Document
  const MENU = '[data-testid="menubar"]'
  const STATUS = '[data-testid="status-bar"]'
  const SLOT = '[data-testid="tutorial-slot"]'

  it('triggers: with the slot present the top inset is the slot’s bottom edge (Oscar rests under the card)', () => {
    expect(hostInsets(docOf({ [MENU]: box(0, 0, 1366, 40), [SLOT]: box(0, 40, 1366, 48), [STATUS]: box(0, 740, 1366, 28) })).top).toBe(88)
  })
  it('does not trigger: no slot (or an empty one) leaves the top inset at the menu bar', () => {
    expect(hostInsets(docOf({ [MENU]: box(0, 0, 1366, 40), [STATUS]: box(0, 740, 1366, 28) })).top).toBe(40)
    expect(hostInsets(docOf({ [MENU]: box(0, 0, 1366, 40), [SLOT]: box(0, 40, 1366, 0), [STATUS]: box(0, 740, 1366, 28) })).top).toBe(40)
  })
})
