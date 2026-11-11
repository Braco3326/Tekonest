// The guide on the legacy level-play route: its flows, its verdict wording, its brain, its mount choices, and the proof that it never speaks on its own.
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { makeLevel, makeRegistry } from '../helpers'
import { ruleTextFor, type RuleRow } from '../../src/creation/shell/statusModel'
import { isAnchor } from '../../src/guide/anchors'
import { createTekPracticeBrain } from '../../src/guide/brain'
import { LEGACY_NAV_SELECTORS } from '../../src/guide/bridge/legacyBridge'
import type { TpBridge, TpPortRef, TpState } from '../../src/guide/bridge/types'
import {
  LEGACY_ACK_SELECTOR,
  LEGACY_FLOWS,
  LEGACY_FLOW_IDS,
  LEGACY_NAV_OBJECTIVES,
  LEGACY_STORAGE_KEY,
  LEGACY_STRINGS,
  legacyFlowsFor,
  legacyKeywords,
  legacyStorageKey,
  nextLegacyLink,
} from '../../src/guide/flows.legacy'
import { ACKNOWLEDGE, SUGGEST_FROM, SUGGEST_TO } from '../../src/guide/flows.creation'
import { RECT_CACHE_MS, createRectResolver, mountOscar, type MountDeps, type MountImpl } from '../../src/guide/mount'
import { TP_STRINGS } from '../../src/guide/strings'
import { buildVerdict } from '../../src/guide/verdict'
import { createController } from '../../src/guide/vendor/core/controller'
import type { BrainVerdict } from '../../src/guide/vendor/core/brain'
import { routeQuestion } from '../../src/guide/vendor/core/router'
import type { ControllerInput, GuideView, HostEvent, Rect } from '../../src/guide/vendor/core/types'

const registry = makeRegistry()
const level = makeLevel('a1')
const rules = registry.catalog.rules as unknown as readonly RuleRow[]
const ruleText = ruleTextFor(rules)

const P = (instance: string, port: string): TpPortRef => ({ instance, port })
const NEXT = level.requiredChain[2]

function legacyState(over: Partial<TpState> = {}): TpState {
  return {
    route: 'legacy',
    placeKnown: true,
    instances: level.devices.map((d) => ({ id: d.instanceId, deviceId: d.deviceId, label: d.deviceId })),
    connections: [],
    controls: {},
    events: [],
    playbackReady: false,
    firstReason: { code: 'missing-link', text_fr: 'Premier lien à faire', subjects: [P('sm58-1', 'out-xlr'), P('rio-1', 'in-mic-1')] },
    ...over,
  }
}
const made = (n: number): TpState['connections'] => level.requiredChain.slice(0, n).map((c) => ({ a: c.from, b: c.to }))

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// ── flows ───────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('LEGACY_FLOWS', () => {
  it('are lire-l-objectif and premier-cable, with a title in the string table for each', () => {
    expect(LEGACY_FLOWS.map((f) => f.id)).toEqual(['lire-l-objectif', 'premier-cable'])
    expect([...LEGACY_FLOW_IDS]).toEqual(['lire-l-objectif', 'premier-cable'])
    for (const f of LEGACY_FLOWS) {
      expect(f.titleKey).toBe(`flows.${f.id}`)
      expect(LEGACY_STRINGS.flows[f.id as 'premier-cable']).toBeTruthy()
      expect(f.steps.length).toBeGreaterThan(0)
    }
  })

  it('every anchor is valid: a reserved suggestion anchor, or a nav anchor the legacy bridge resolves', () => {
    for (const f of LEGACY_FLOWS)
      for (const s of f.steps)
        for (const a of [s.anchor, ...(s.to === undefined ? [] : [s.to])]) {
          expect(isAnchor(a), a).toBe(true)
          if (a.startsWith('nav:')) expect(Object.keys(LEGACY_NAV_SELECTORS)).toContain(a)
          else expect([SUGGEST_FROM, SUGGEST_TO]).toContain(a)
        }
    expect(LEGACY_NAV_OBJECTIVES).toBe('nav:objectif')
  })

  it('the cable step is a drag from the suggested port to the suggested port, done by a connect; a read step is done by an acknowledgement', () => {
    const cable = LEGACY_FLOWS[1].steps[0]
    expect(cable).toMatchObject({ anchor: SUGGEST_FROM, to: SUGGEST_TO, action: 'drag', done: { event: 'connect' } })
    for (const f of LEGACY_FLOWS) for (const s of f.steps.filter((x) => x.action === 'read')) expect(s.done).toEqual({ event: ACKNOWLEDGE })
  })

  it('the texts are impersonal French with no digit written by the guide, and no step nudges on its own', () => {
    for (const f of LEGACY_FLOWS)
      for (const s of f.steps) {
        expect(/\d/.test(s.say), s.say).toBe(false)
        expect(s.say.length).toBeGreaterThan(10)
        expect(s.hintAfterMs).toBeUndefined()
      }
    for (const t of Object.values(LEGACY_STRINGS.flows)) expect(/\d/.test(t)).toBe(false)
    expect(/\d/.test(LEGACY_STRINGS.planner.needInfo)).toBe(false)
  })

  it('quotes nothing (the page shows English text the guide does not repeat) and every sentence stands without a ring', () => {
    for (const f of LEGACY_FLOWS)
      for (const s of f.steps) {
        expect(s.say, s.say).not.toContain('«')
        expect(s.say.toLowerCase(), 'a ring may be missing (the 2D board projects nothing): the text must not rely on one').not.toMatch(/indiqu|surlign|entour|cercle/)
      }
    // the reading step names the card's own parts, the cable step the page's own list
    expect(LEGACY_FLOWS[0].steps[0].say).toContain('liste des connexions requises')
    expect(LEGACY_FLOWS[1].steps[0].say).toContain('liste des connexions requises')
  })
})

describe('legacyFlowsFor: the flow that starts at what is next, by the level’s own data', () => {
  it('no required link made yet: the objective first; some made: the cable first; the chain complete: the objective first', () => {
    expect(legacyFlowsFor(legacyState()).map((f) => f.id)).toEqual(['lire-l-objectif', 'premier-cable'])
    expect(legacyFlowsFor(legacyState({ connections: made(2) })).map((f) => f.id)).toEqual(['premier-cable', 'lire-l-objectif'])
    expect(legacyFlowsFor(legacyState({ connections: made(5), firstReason: null, playbackReady: true })).map((f) => f.id)).toEqual(['lire-l-objectif', 'premier-cable'])
    expect(legacyFlowsFor(null).map((f) => f.id)).toEqual(['lire-l-objectif', 'premier-cable'])
  })

  it('gives the same flow objects every time (only the order changes)', () => {
    const a = legacyFlowsFor(legacyState())
    expect(legacyFlowsFor(legacyState())[0]).toBe(a[0])
    expect(legacyFlowsFor(legacyState({ connections: made(1) }))[0]).toBe(a[1])
  })

  it('a level with no required link offers the objective only', () => {
    expect(legacyFlowsFor(legacyState({ firstReason: null, connections: [], playbackReady: true, instances: [] })).map((f) => f.id)).toContain('lire-l-objectif')
  })
})

describe('the cable to draw is the first unmet required link of the level', () => {
  it('reads the ports from the first reason; none when the chain is complete or the reason is another one', () => {
    expect(nextLegacyLink(legacyState())).toEqual({ from: P('sm58-1', 'out-xlr'), to: P('rio-1', 'in-mic-1') })
    expect(nextLegacyLink(legacyState({ firstReason: null }))).toBeNull()
    expect(nextLegacyLink(legacyState({ firstReason: { code: 'other', text_fr: 'x', subjects: [P('a', 'b'), P('c', 'd')] } }))).toBeNull()
    expect(nextLegacyLink(legacyState({ firstReason: { code: 'missing-link', text_fr: 'x', subjects: [P('a', 'b')] } }))).toBeNull()
  })

  it('the rect resolver of the legacy route resolves the suggestion anchors to those ports (cached), and has no phantom switch', () => {
    const state = legacyState({ firstReason: { code: 'missing-link', text_fr: 'x', subjects: [P(NEXT.from.instance, NEXT.from.port), P(NEXT.to.instance, NEXT.to.port)] } })
    const R: Rect = { x: 1, y: 2, w: 3, h: 4 }
    const bridge = {
      snapshot: vi.fn(() => state),
      rectOf: vi.fn((a: string) => (a.startsWith('port:') ? { ...R } : null)),
      anchorOfPort: vi.fn((r: TpPortRef) => `port:${r.instance}.${r.port}`),
      anchorOfDevice: vi.fn((i: string) => `device:${i}`),
      anchorOfControl: vi.fn(() => ''),
    } as unknown as TpBridge
    let t = 0
    const rects = createRectResolver({ bridge, registry, now: () => t, route: 'legacy' })
    expect(rects.getRect(SUGGEST_FROM)).toEqual(R)
    expect(rects.getRect(SUGGEST_TO)).toEqual(R)
    expect(bridge.rectOf).toHaveBeenCalledWith(`port:${NEXT.from.instance}.${NEXT.from.port}`)
    expect(bridge.rectOf).toHaveBeenCalledWith(`port:${NEXT.to.instance}.${NEXT.to.port}`)
    expect((bridge.snapshot as unknown as MockInstance).mock.calls).toHaveLength(1) // one snapshot serves both anchors
    expect(rects.getRect('control:suggest.phantom')).toBeNull()
    t += RECT_CACHE_MS
    expect(rects.getRect(SUGGEST_FROM)).toEqual(R)
  })
})

describe('what a learner can type', () => {
  it('reaches each flow by its own words, and names no flow of Mode Création', () => {
    const table = legacyKeywords()
    expect(table.map((k) => k.flowId).sort()).toEqual(['lire-l-objectif', 'premier-cable'])
    expect(routeQuestion('Guide-moi pour lire l’objectif du niveau', table).flowId).toBe('lire-l-objectif')
    expect(routeQuestion('Comment faire le premier câble ?', table).flowId).toBe('premier-cable')
    expect(routeQuestion('Comment faire un premier montage ?', table).flowId).toBeUndefined()
  })
})

// ── strings ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('wording of the legacy route', () => {
  it('the need-info line points at the objectives panel, the legacy words are impersonal French without a digit', () => {
    expect(LEGACY_STRINGS.planner.needInfo).toContain('connexions requises')
    for (const s of [TP_STRINGS.verdict.legacyWon, TP_STRINGS.verdict.nextLink, TP_STRINGS.verdict.legacyNothingToJudge]) {
      expect(s.length).toBeGreaterThan(5)
      expect(/\d/.test(s)).toBe(false)
      expect(s.includes("'")).toBe(false)
    }
  })

  it('the storage key of the legacy guide is its own (a flow of the other route is never restored here)', () => {
    expect(LEGACY_STORAGE_KEY).not.toBe('oscar-guide.state.v1')
    expect(LEGACY_STORAGE_KEY.startsWith('oscar-guide')).toBe(true)
  })

  it('the storage key is per level, the level taken from the address and validated, so a flow left running on one level is not restored on another', () => {
    const levels = ['a1', 'b1', 'c1', 'd1']
    const keys = levels.map((l) => legacyStorageKey(`?level=${l}`))
    expect(new Set(keys).size).toBe(4)
    levels.forEach((l, i) => expect(keys[i]).toBe(`${LEGACY_STORAGE_KEY}.${l}`))
    expect(legacyStorageKey('?level=a1&oscar=1')).toBe(`${LEGACY_STORAGE_KEY}.a1`)
    // anything else gets the base key, never a key made of the address
    for (const bad of ['', '?level=zz', '?level=A1', '?level=a1&level=b1', '?level=sandbox', '?level=a1.x', '?level=%00', '?legacy=1']) expect(legacyStorageKey(bad), bad).toBe(LEGACY_STORAGE_KEY)
    expect(legacyStorageKey(undefined as unknown as string)).toBe(LEGACY_STORAGE_KEY)
  })
})

// ── verdict ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('buildVerdict for the legacy route', () => {
  it('a violation, whatever its severity, is to fix: the level’s declared checks block the win, and the title and explanation are quoted from the catalog', () => {
    const r5 = rules.find((r) => r.id === 'R5')!
    const v = buildVerdict(legacyState({ events: [{ ruleId: 'R5', severity: 'warning', subjects: [P('rio-1', 'in-mic-1')] }] }), ruleText)
    expect(v.result).toBe('a-corriger')
    expect(v.reason).toBe('setup-error')
    expect(v.primary).toMatchObject({ ruleId: 'R5', causeFr: r5.title_fr, fixFr: r5.teach_fr })
  })

  it('in Mode Création a warning alone is still not an error (unchanged)', () => {
    const v = buildVerdict({ ...legacyState({ events: [{ ruleId: 'R5', severity: 'warning', subjects: [] }] }), route: 'creation' }, ruleText)
    expect(v.result).not.toBe('a-corriger')
  })

  it('an error and a warning: the first violation is primary, the other is also found', () => {
    const v = buildVerdict(
      legacyState({
        events: [
          { ruleId: 'R5', severity: 'warning', subjects: [] },
          { ruleId: 'R4', severity: 'error', subjects: [] },
        ],
      }),
      ruleText,
    )
    expect(v.primary?.ruleId).toBe('R5')
    expect(v.alsoFound.map((a) => a.ruleId)).toEqual(['R4'])
  })

  it('no violation and a link still to make: indetermine, the next required link in the app’s own words', () => {
    const v = buildVerdict(legacyState(), ruleText)
    expect(v.result).toBe('indetermine')
    expect(v.reason).toBe('missing-input')
    expect(v.labelFr).toBe(`${TP_STRINGS.verdict.nextLink} Premier lien à faire`)
  })

  it('a won level says the chain is complete and that the check covers only the app’s own controls', () => {
    const v = buildVerdict(legacyState({ playbackReady: true, firstReason: null }), ruleText)
    expect(v.result).toBe('bon')
    expect(v.labelFr).toBe(TP_STRINGS.verdict.legacyWon)
    expect(v.labelFr).not.toBe(TP_STRINGS.verdict.allGood)
  })
})

// ── brain ───────────────────────────────────────────────────────────────────────────────────────────────────────────

function brainWith(state: TpState | null, mode: () => 'practice' | 'exam' = () => 'practice') {
  const bridge = { snapshot: vi.fn(() => state) } as unknown as TpBridge
  return createTekPracticeBrain({ bridge, rules, mode, route: 'legacy' })
}

describe('the brain on the legacy route', () => {
  it('judges the level from the bridge: a violation gives the catalog’s French title and explanation', async () => {
    const r4 = rules.find((r) => r.id === 'R4')!
    const out = await brainWith(legacyState({ events: [{ ruleId: 'R4', severity: 'error', subjects: [P('sm58-1', 'out-xlr')] }] })).judge({ coveredFamilies: [], instances: [], connections: [] }, 'practice')
    const verdict = (out as Extract<BrainVerdict, { verdict: unknown }>).verdict!
    expect(verdict.primary?.causeFr).toBe(r4.title_fr)
    expect(verdict.primary?.fixFr).toBe(r4.teach_fr)
  })

  it('with no state to read says so in words of the level, not of the place', async () => {
    const out = await brainWith(null).judge({ coveredFamilies: [], instances: [], connections: [] }, 'practice')
    expect((out as { verdict: { labelFr: string } }).verdict.labelFr).toBe(TP_STRINGS.verdict.legacyNothingToJudge)
  })

  it('is withheld in exam, whatever the bridge holds, and never reads the bench', async () => {
    const snapshot = vi.fn(() => legacyState())
    const brain = createTekPracticeBrain({ bridge: { snapshot } as unknown as TpBridge, rules, mode: () => 'exam', route: 'legacy' })
    expect(await brain.judge({ coveredFamilies: [], instances: [], connections: [] }, 'practice')).toEqual({ verdict: null, needInfo: null, withheld: true })
    expect((await brain.ask({ question: 'Pourquoi le fantôme ?', mode: 'practice' } as never)).kind).toBe('withheld')
    expect(snapshot).not.toHaveBeenCalled()
  })
})

// ── mount ───────────────────────────────────────────────────────────────────────────────────────────────────────────

type Listener = (state: TpState, events: HostEvent[]) => void
function fakeBridge(initial: TpState | null) {
  let state: TpState | null = initial
  const listeners = new Set<Listener>()
  const bridge = {
    snapshot: vi.fn(() => state),
    rectOf: vi.fn((): Rect | null => ({ x: 1, y: 2, w: 3, h: 4 })),
    anchorOfPort: vi.fn((r: TpPortRef) => `port:${r.instance}.${r.port}`),
    anchorOfDevice: vi.fn((id: string) => `device:${id}`),
    anchorOfControl: vi.fn(() => ''),
    onChange: vi.fn((cb: Listener) => {
      listeners.add(cb)
      return () => void listeners.delete(cb)
    }),
    destroy: vi.fn(),
  }
  return {
    bridge: bridge as unknown as TpBridge & typeof bridge,
    emit: (s: TpState, events: HostEvent[] = []): void => {
      state = s
      for (const l of [...listeners]) l(s, events)
    },
  }
}
function fakeDoc() {
  const listeners = new Map<string, Set<(e: unknown) => void>>()
  const doc = {
    addEventListener: vi.fn((t: string, fn: (e: unknown) => void) => {
      if (!listeners.has(t)) listeners.set(t, new Set())
      listeners.get(t)!.add(fn)
    }),
    removeEventListener: vi.fn((t: string, fn: (e: unknown) => void) => void listeners.get(t)?.delete(fn)),
    createElement: vi.fn(() => ({ setAttribute: vi.fn(), remove: vi.fn() })),
    body: { appendChild: vi.fn() },
  }
  return { doc: doc as unknown as Document, click: (target: unknown): void => [...(listeners.get('click') ?? [])].forEach((fn) => fn({ target })) }
}
function fakeImpl() {
  const handle = { destroy: vi.fn(), send: vi.fn((_i: ControllerInput) => Promise.resolve({} as GuideView)) }
  const controller = { dispatch: vi.fn(), getView: vi.fn(), subscribe: vi.fn() }
  const impl = { createController: vi.fn((_d: unknown) => controller), mountGuide: vi.fn((_o: unknown) => handle) }
  return { impl: impl as unknown as MountImpl & typeof impl, handle }
}
function mountLegacy(over: Partial<MountDeps> = {}, state: TpState | null = legacyState()) {
  const b = fakeBridge(state)
  const d = fakeDoc()
  const f = fakeImpl()
  const search = '?level=a1'
  const deps: MountDeps = {
    win: { location: { search } } as unknown as Window,
    doc: d.doc,
    route: 'legacy',
    search,
    bridge: b.bridge,
    registry,
    storage: null,
    now: () => 1000,
    ...over,
  }
  const handle = mountOscar(deps, f.impl)
  return { b, d, f, handle }
}
const sentEvents = (f: ReturnType<typeof fakeImpl>): HostEvent[] => f.handle.send.mock.calls.flatMap((c) => (c[0].type === 'hostEvent' ? [c[0].event] : []))

describe('mountOscar on the legacy route', () => {
  it('mounts for a practice level with the legacy flows, strings, keywords and its own storage key', () => {
    const { f, handle } = mountLegacy()
    expect(handle).not.toBeNull()
    const c = f.impl.createController.mock.calls[0][0] as { flows: { id: string }[]; strings: { flows: Record<string, string> }; storageKey?: string; flowKeywords: { flowId: string }[] }
    expect(c.flows.map((x) => x.id)).toEqual(['lire-l-objectif', 'premier-cable'])
    expect(c.strings.flows['lire-l-objectif']).toBe(LEGACY_STRINGS.flows['lire-l-objectif'])
    expect(c.storageKey).toBe(`${LEGACY_STORAGE_KEY}.a1`)
    const other = mountLegacy({ search: '?level=b1', win: { location: { search: '?level=b1' } } as unknown as Window })
    expect((other.f.impl.createController.mock.calls[0][0] as { storageKey?: string }).storageKey).toBe(`${LEGACY_STORAGE_KEY}.b1`)
    expect(c.flowKeywords.map((k) => k.flowId).sort()).toEqual(['lire-l-objectif', 'premier-cable'])
    expect((f.impl.mountGuide.mock.calls[0][0] as { context: unknown }).context).toEqual({ page: 'workbench', mode: 'practice' })
  })

  it.each([['?level=a1&mode=exam'], ['?level=sandbox'], ['?legacy=1'], ['?level=zz'], ['?level=a1&MODE=exam'], ['?level=a1&oscar=0']])('stays silent for %s: no controller, no widget, no bridge call', (search) => {
    const r = mountLegacy({ search })
    expect(r.handle).toBeNull()
    expect(r.f.impl.createController).not.toHaveBeenCalled()
    expect(r.f.impl.mountGuide).not.toHaveBeenCalled()
    expect(r.b.bridge.onChange).not.toHaveBeenCalled()
    expect(r.b.bridge.snapshot).not.toHaveBeenCalled()
  })

  it('the order of the flows follows the bench (the list is the controller’s by reference)', () => {
    const { f, b } = mountLegacy()
    const flows = (f.impl.createController.mock.calls[0][0] as { flows: { id: string; steps: { say: string }[] }[] }).flows
    expect(flows.map((x) => x.id)).toEqual(['lire-l-objectif', 'premier-cable'])
    b.emit(legacyState({ connections: made(1) }), [{ type: 'connect', at: 1, data: { a: 'port:x.y', b: 'port:z.w' } }])
    expect(flows.map((x) => x.id)).toEqual(['premier-cable', 'lire-l-objectif'])
  })

  it('a click inside the objectives panel is the learner reading it; a click elsewhere is nothing; the status bar of Mode Création means nothing here', () => {
    const { d, f } = mountLegacy()
    expect(LEGACY_ACK_SELECTOR).toBe('#hud-objectives')
    const inside = { closest: (s: string) => (s === LEGACY_ACK_SELECTOR ? {} : null) }
    d.click(inside)
    d.click({ closest: () => null })
    d.click({ closest: (s: string) => (s === '[data-testid="status-bar"]' ? {} : null) })
    const acks = sentEvents(f).filter((e) => e.type === ACKNOWLEDGE)
    expect(acks).toHaveLength(1)
    expect(acks[0].data).toEqual({ anchor: LEGACY_NAV_OBJECTIVES })
  })

  it('connect and disconnect events of the bridge reach the controller as they are; no toggle is ever invented', () => {
    const { f, b } = mountLegacy()
    b.emit(legacyState({ connections: made(1) }), [{ type: 'connect', at: 5, data: { a: 'port:sm58-1.out-xlr', b: 'port:rio-1.in-mic-1' } }])
    expect(sentEvents(f).map((e) => e.type)).toEqual(['connect'])
  })
})

// ── the guide never speaks on its own in the legacy level ───────────────────────────────────────────────────────────

describe('the guide is the icon and on-demand help only (the app’s own toast and its Pourquoi ? stay the only unasked voice)', () => {
  function rig(state: TpState) {
    let now = 0
    const bridge = { snapshot: vi.fn(() => state) } as unknown as TpBridge
    const brain = createTekPracticeBrain({ bridge, rules, mode: () => 'practice', route: 'legacy' })
    const flows = legacyFlowsFor(state)
    const controller = createController({ brain, flows, clock: () => now, strings: LEGACY_STRINGS, flowKeywords: legacyKeywords(), storageKey: LEGACY_STORAGE_KEY })
    const send = (i: ControllerInput) => controller.dispatch(i)
    return { controller, send, advance: (ms: number) => void (now += ms) }
  }
  const SETUP = { coveredFamilies: [], instances: [], connections: [] }

  it('a violation on the screen, left alone for ten minutes, opens no bubble and shows no text (no judging happens before the learner asks)', async () => {
    const state = legacyState({ events: [{ ruleId: 'R4', severity: 'error', subjects: [P('sm58-1', 'out-xlr')] }] })
    const r = rig(state)
    await r.send({ type: 'setContext', context: { page: 'workbench', mode: 'practice', setup: { ...SETUP, ctx: { revision: 1 } } } } as ControllerInput)
    for (let i = 0; i < 20; i++) {
      r.advance(30_000)
      await r.send({ type: 'tick' } as ControllerInput)
    }
    const view = r.controller.getView()
    expect(view.bubble).toBeNull()
    expect(view.target).toBeNull()
  })

  it('a flow step with no hintAfterMs never nudges, even left running', async () => {
    const r = rig(legacyState())
    await r.send({ type: 'setContext', context: { page: 'workbench', mode: 'practice', setup: { ...SETUP, ctx: { revision: 1 } } } } as ControllerInput)
    await r.send({ type: 'flow', control: { action: 'start', flowId: 'premier-cable' } } as unknown as ControllerInput)
    await r.send({ type: 'chip', id: 'close' } as ControllerInput)
    for (let i = 0; i < 10; i++) {
      r.advance(60_000)
      await r.send({ type: 'tick' } as ControllerInput)
    }
    expect(r.controller.getView().bubble).toBeNull()
  })

  it('asked, the guide answers in French from the catalog: the same sentence as the rule text lookup, and not the English toast', async () => {
    const r4 = rules.find((r) => r.id === 'R4')!
    const state = legacyState({ events: [{ ruleId: 'R4', severity: 'error', subjects: [P('sm58-1', 'out-xlr')] }] })
    const r = rig(state)
    await r.send({ type: 'setContext', context: { page: 'workbench', mode: 'practice', setup: { ...SETUP, ctx: { revision: 1 } } } } as ControllerInput)
    await r.send({ type: 'chip', id: 'next' } as ControllerInput)
    const lines = r.controller.getView().bubble?.lines.map((l) => l.text) ?? []
    expect(lines).toContain(r4.teach_fr)
    expect(lines.join(' ')).not.toContain(r4.teach)
    expect(lines.join(' ')).not.toContain(r4.title)
  })
})
