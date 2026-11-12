// The tutorial « Premiers pas » (onboarding spec 6, plan T3.1a): roles read from the catalog, the host-event annotations, the cable a step asks
// for, the ONE step list (ids, completing events), and the anchor resolvers. Pure: no DOM; the vendored `matchesDone` decides what ends a step.
import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { ConnectionGraph } from '../../src/engine/ConnectionGraph'
import { registerProposals } from '../../src/creation/betaDevices'
import type { DeviceT } from '../../src/engine/CatalogLoader'
import type { TpPortRef, TpState } from '../../src/guide/bridge/types'
import { DESIGN_IDS, packageById, type StepId } from '../../src/design/packages'
import {
  TUTORIAL_STEPS,
  annotateConnect,
  annotateDevice,
  annotatePlayback,
  annotateTutorialEvent,
  nextConnectionStepFor,
  pairOf,
  resolveTutorialAnchor,
  roleOf,
  sourceConsoles,
  playbackControlOf,
  stepAnchor,
  stepsFor,
  type AnchorEnv,
  type DeviceRole,
} from '../../src/guide/tutorial'
import { matchesDone } from '../../src/guide/vendor/core/flow'
import { isValidAnchor } from '../../src/guide/vendor/core/planner'
import type { HostEvent, Rect, Step } from '../../src/guide/vendor/core/types'

const registry = makeRegistry()

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
    instances: devices.map(([id, deviceId]) => ({ id, deviceId, label: registry.deviceById.get(deviceId)?.label ?? deviceId })),
    connections,
    controls: own,
    events: [],
    playbackReady: false,
    firstReason: null,
  }
}

/** The anchors the creation bridge gives (same shape: kind, then the instance id, then the port or control). */
const fakeAnchors = {
  anchorOfDevice: (id: string): string => `device:${id}`,
  anchorOfPort: (r: TpPortRef): string => `port:${r.instance}.${r.port}`,
  anchorOfControl: (i: string, c: string): string => `control:${i}.${c}`,
}
const cable = (a: [string, string], b: [string, string]) => ({ a: { instance: a[0], port: a[1] }, b: { instance: b[0], port: b[1] } })
const added = (id: string): HostEvent => ({ type: 'deviceAdded', at: 1, data: { device: `device:${id}` } })
const connected = (c: { a: TpPortRef; b: TpPortRef }, type: 'connect' | 'disconnect' = 'connect'): HostEvent => ({
  type,
  at: 1,
  data: { a: fakeAnchors.anchorOfPort(c.a), b: fakeAnchors.anchorOfPort(c.b) },
})
const toggled = (instance: string, control: string, value: boolean): HostEvent => {
  const a = fakeAnchors.anchorOfControl(instance, control)
  return { type: 'toggle', at: 1, data: { control: a, anchor: a, value } }
}

const byId = (id: StepId) => TUTORIAL_STEPS.find((s) => s.id === id)!
/** The step as the vendored controller sees it: only `done` matters to `matchesDone`. */
const asStep = (id: StepId): Step => ({ id, anchor: 'nav:status', action: 'point', say: 'x', done: byId(id).done })
/** What the mount will hand the controller: the raw bridge event, annotated, against the state after the change (and before it, for a disconnect). */
const ends = (id: StepId, e: HostEvent, state: TpState, prev: TpState = state): boolean =>
  matchesDone(asStep(id), annotateTutorialEvent(e, { state, prev, bridge: fakeAnchors, registry }))

describe('roles from the catalog', () => {
  it('source-console is every catalog device with a route from a control: today only the Yamaha QL1', () => {
    const fromCatalog = registry.catalog.devices
      .filter((d) => (d.routing ?? []).some((r) => typeof r.from === 'string' && r.from.startsWith('control:')))
      .map((d) => d.id)
    expect(sourceConsoles(registry)).toEqual(fromCatalog)
    expect(sourceConsoles(registry)).toEqual(['yamaha-ql1'])
    expect(playbackControlOf(registry, 'yamaha-ql1')).toBe('playback-usb')
    expect(playbackControlOf(registry, 'axia-iq')).toBeNull()
  })

  it('mic = category microphone; speaker = powered speaker or studio monitor; mains-strip = an isMainsSource port; the rest is other', () => {
    const want: Record<string, DeviceRole> = {
      'yamaha-ql1': 'source-console',
      'shure-sm58': 'mic',
      'shure-sm57': 'mic',
      'neumann-u87-ai': 'mic',
      'qsc-k12-2': 'speaker',
      'genelec-8030c': 'speaker',
      'multiprise-secteur': 'mains-strip',
      // a console without a playback route, a preamp, a stage box, a monitor controller: none is the source
      'axia-iq': 'other',
      'focusrite-isa-one': 'other',
      'yamaha-rio3224-d2': 'other',
      'grace-m905': 'other',
      'km-210-9': 'other',
      'no-such-device': 'other',
    }
    for (const [id, role] of Object.entries(want)) expect(roleOf(registry, id), id).toBe(role)
    // every catalog device has a role (the table is total)
    for (const d of registry.catalog.devices) expect(['source-console', 'mic', 'speaker', 'mains-strip', 'other']).toContain(roleOf(registry, d.id))
  })

  it('a Bêta proposal has no role, even when it copies a strip or a mic (it never powers, never counts as a mic)', () => {
    const r = makeRegistry()
    const strip = r.deviceById.get('multiprise-secteur')!
    const mic = r.deviceById.get('shure-sm58')!
    registerProposals(r, [{ ...strip, id: 'beta-strip' } as DeviceT, { ...mic, id: 'beta-mic' } as DeviceT])
    expect(roleOf(r, 'beta-strip')).toBe('other')
    expect(roleOf(r, 'beta-mic')).toBe('other')
  })
})

describe('annotations', () => {
  it('annotateDevice adds the role of the added instance, found by its anchor; an unknown anchor is left as it is', () => {
    const s = stateOf([['q', 'yamaha-ql1'], ['isa', 'focusrite-isa-one']])
    expect(annotateDevice(added('q'), s, fakeAnchors, registry).data).toEqual({ device: 'device:q', role: 'source-console' })
    expect(annotateDevice(added('isa'), s, fakeAnchors, registry).data).toEqual({ device: 'device:isa', role: 'other' })
    const unknown = added('ghost')
    expect(annotateDevice(unknown, s, fakeAnchors, registry)).toBe(unknown)
  })

  it('annotateConnect names the pair from the two ends, in either order, for connect and (from the state before) for disconnect', () => {
    const c = cable(['q', 'out-main-l'], ['k', 'in-line-a'])
    const s = stateOf([['q', 'yamaha-ql1'], ['k', 'qsc-k12-2']], [c])
    expect(annotateConnect(connected(c), s.connections, s, fakeAnchors, registry).data?.pair).toBe('console-speaker')
    const flipped = { a: c.b, b: c.a }
    expect(annotateConnect(connected(flipped), s.connections, s, fakeAnchors, registry).data?.pair).toBe('console-speaker')
    const after = stateOf([['q', 'yamaha-ql1'], ['k', 'qsc-k12-2']])
    expect(annotateConnect(connected(c, 'disconnect'), s.connections, after, fakeAnchors, registry).data?.pair).toBe('console-speaker')
  })

  it('pairOf: mic-console, mains-console, mains-speaker, and other for anything else', () => {
    const s = stateOf([
      ['q', 'yamaha-ql1'],
      ['m', 'shure-sm58'],
      ['k', 'qsc-k12-2'],
      ['p', 'multiprise-secteur'],
      ['ax', 'axia-iq'],
      ['g', 'genelec-8030c'],
    ])
    expect(pairOf(cable(['m', 'out-xlr'], ['q', 'in-mic-1']), s, registry)).toBe('mic-console')
    expect(pairOf(cable(['p', 'out-1'], ['q', 'power-in']), s, registry)).toBe('mains-console')
    expect(pairOf(cable(['k', 'power-in'], ['p', 'out-2']), s, registry)).toBe('mains-speaker')
    expect(pairOf(cable(['ax', 'out-n1'], ['g', 'in-analog']), s, registry)).toBe('other')
    expect(pairOf(cable(['m', 'out-xlr'], ['ax', 'in-mic-1']), s, registry)).toBe('other')
    expect(pairOf(cable(['p', 'out-1'], ['ax', 'power-in']), s, registry)).toBe('other')
  })

  it('annotatePlayback marks the source console’s playback control, and only it', () => {
    const s = stateOf([['q', 'yamaha-ql1'], ['isa', 'focusrite-isa-one']])
    expect(annotatePlayback(toggled('q', 'playback-usb', true), s, fakeAnchors, registry).data?.playback).toBe(true)
    expect(annotatePlayback(toggled('q', 'mute-master', true), s, fakeAnchors, registry).data?.playback).toBeUndefined()
    expect(annotatePlayback(toggled('isa', 'phantom-48v', true), s, fakeAnchors, registry).data?.playback).toBeUndefined()
  })

  it('an event of another type, a null state or data that is not there goes through unchanged', () => {
    const s = stateOf([['q', 'yamaha-ql1']])
    const place: HostEvent = { type: 'placeChosen', at: 1 }
    expect(annotateTutorialEvent(place, { state: s, prev: s, bridge: fakeAnchors, registry })).toBe(place)
    const bare: HostEvent = { type: 'deviceAdded', at: 1 }
    expect(annotateTutorialEvent(bare, { state: s, prev: s, bridge: fakeAnchors, registry })).toBe(bare)
    expect(annotateTutorialEvent(added('q'), { state: null, prev: null, bridge: fakeAnchors, registry })).toEqual(added('q'))
  })
})

describe('the step list', () => {
  it('step ids are unique and are exactly the StepId list (ten steps of spec 6.3, then the two unplug steps of 7.2)', () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([
      'console',
      'micro',
      'enceinte',
      'console-enceinte',
      'micro-console',
      'lecture-console',
      'multiprise',
      'courant-console',
      'courant-enceinte',
      'ecoute',
      'debrancher',
      'rebrancher',
    ])
  })

  it('every step says one COPY key of the tutorial section (multiprise adds the power note), and every package pacing id exists here', () => {
    for (const s of TUTORIAL_STEPS) {
      expect(s.sayKeys.length).toBeGreaterThan(0)
      for (const k of s.sayKeys) expect(k).toMatch(/^tutorial\.[a-zA-Z]+$/)
    }
    expect(byId('multiprise').sayKeys).toEqual(['tutorial.multiprise', 'tutorial.powerNote'])
    for (const d of DESIGN_IDS) for (const id of packageById(d).pacing.steps) expect(TUTORIAL_STEPS.some((s) => s.id === id), `${d} ${id}`).toBe(true)
  })

  it('packages 1 to 4 take the ten steps in order; package 5 takes ecoute, debrancher, rebrancher in that order', () => {
    expect(stepsFor(packageById(1).pacing.steps).map((s) => s.id)).toEqual(TUTORIAL_STEPS.slice(0, 10).map((s) => s.id))
    expect(stepsFor(packageById(5).pacing.steps).map((s) => s.id)).toEqual(['ecoute', 'debrancher', 'rebrancher'])
    expect(stepsFor(['rebrancher', 'console']).map((s) => s.id)).toEqual(['rebrancher', 'console'])
  })

  it('every step anchor is a valid vendored anchor', () => {
    for (const s of TUTORIAL_STEPS) expect(isValidAnchor(stepAnchor(s, registry)), s.id).toBe(true)
  })

  // One completing event and the closest one that must NOT complete, per step.
  const Q = ['q', 'yamaha-ql1'] as [string, string]
  const M = ['m', 'shure-sm58'] as [string, string]
  const K = ['k', 'qsc-k12-2'] as [string, string]
  const P = ['p', 'multiprise-secteur'] as [string, string]

  it('1 console: the QL1 placed ends it; the ISA One (a preamp under « Consoles ») and the Axia iQ (a console with no playback) do not', () => {
    const s = stateOf([Q, ['isa', 'focusrite-isa-one'], ['ax', 'axia-iq']])
    expect(ends('console', added('q'), s)).toBe(true)
    expect(ends('console', added('isa'), s)).toBe(false)
    expect(ends('console', added('ax'), s)).toBe(false)
  })

  it('2 micro: a mic placed ends it (any mic, the SM57 too); a mic stand does not', () => {
    const s = stateOf([M, ['m57', 'shure-sm57'], ['st', 'km-210-9']])
    expect(ends('micro', added('m'), s)).toBe(true)
    expect(ends('micro', added('m57'), s)).toBe(true)
    expect(ends('micro', added('st'), s)).toBe(false)
  })

  it('3 enceinte: a K12.2 or a Genelec ends it; the monitor controller does not', () => {
    const s = stateOf([K, ['g', 'genelec-8030c'], ['gr', 'grace-m905']])
    expect(ends('enceinte', added('k'), s)).toBe(true)
    expect(ends('enceinte', added('g'), s)).toBe(true)
    expect(ends('enceinte', added('gr'), s)).toBe(false)
  })

  it('4 console-enceinte: QL1 to a speaker ends it; a Genelec cabled to the Axia iQ does not, nor a disconnect of the right cable, nor the mic cable', () => {
    const good = cable(['q', 'out-main-l'], ['k', 'in-line-a'])
    const s = stateOf([Q, K, M, ['ax', 'axia-iq'], ['g', 'genelec-8030c']], [good])
    expect(ends('console-enceinte', connected(good), s)).toBe(true)
    const axia = cable(['ax', 'out-n1'], ['g', 'in-analog'])
    expect(ends('console-enceinte', connected(axia), stateOf([Q, K, ['ax', 'axia-iq'], ['g', 'genelec-8030c']], [axia]))).toBe(false)
    const without = stateOf([Q, K])
    expect(ends('console-enceinte', connected(good, 'disconnect'), without, s)).toBe(false)
    const mic = cable(['m', 'out-xlr'], ['q', 'in-mic-1'])
    expect(ends('console-enceinte', connected(mic), stateOf([Q, M], [mic]))).toBe(false)
  })

  it('5 micro-console: the mic into the QL1 ends it; the mic into the ISA One does not', () => {
    const good = cable(['m', 'out-xlr'], ['q', 'in-mic-1'])
    expect(ends('micro-console', connected(good), stateOf([Q, M], [good]))).toBe(true)
    const isa = cable(['m', 'out-xlr'], ['isa', 'in-mic'])
    expect(ends('micro-console', connected(isa), stateOf([M, ['isa', 'focusrite-isa-one']], [isa]))).toBe(false)
  })

  it('6 lecture-console: « Lecture console » on ends it; the phantom toggle, another QL1 switch, or Lecture console going off do not', () => {
    const s = stateOf([Q, ['isa', 'focusrite-isa-one']])
    expect(ends('lecture-console', toggled('q', 'playback-usb', true), s)).toBe(true)
    expect(ends('lecture-console', toggled('isa', 'phantom-48v', true), s)).toBe(false)
    expect(ends('lecture-console', toggled('q', 'mute-master', true), s)).toBe(false)
    expect(ends('lecture-console', toggled('q', 'playback-usb', false), s)).toBe(false)
  })

  it('7 multiprise: the catalog strip ends it; a Bêta copy of the strip does not', () => {
    const r = makeRegistry()
    registerProposals(r, [{ ...r.deviceById.get('multiprise-secteur')!, id: 'beta-strip' } as DeviceT])
    const s = stateOf([P, ['b', 'beta-strip']])
    const end = (e: HostEvent) => matchesDone(asStep('multiprise'), annotateTutorialEvent(e, { state: s, prev: s, bridge: fakeAnchors, registry: r }))
    expect(end(added('p'))).toBe(true)
    expect(end(added('b'))).toBe(false)
  })

  it('8 courant-console: strip to the console ends it; strip to the speaker does not', () => {
    const c = cable(['p', 'out-1'], ['q', 'power-in'])
    const k = cable(['p', 'out-2'], ['k', 'power-in'])
    const s = stateOf([Q, K, P], [c, k])
    expect(ends('courant-console', connected(c), s)).toBe(true)
    expect(ends('courant-console', connected(k), s)).toBe(false)
  })

  it('9 courant-enceinte: strip to the speaker ends it; strip to the console does not', () => {
    const c = cable(['p', 'out-1'], ['q', 'power-in'])
    const k = cable(['k', 'power-in'], ['p', 'out-2'])
    const s = stateOf([Q, K, P], [c, k])
    expect(ends('courant-enceinte', connected(k), s)).toBe(true)
    expect(ends('courant-enceinte', connected(c), s)).toBe(false)
  })

  it('10 ecoute: the test signal starting ends it; a song or a file starting does not', () => {
    const s = stateOf([Q])
    expect(ends('ecoute', { type: 'playStarted', at: 1, data: { source: 'test' } }, s)).toBe(true)
    expect(ends('ecoute', { type: 'playStarted', at: 1, data: { source: 'song' } }, s)).toBe(false)
    expect(ends('ecoute', { type: 'playStarted', at: 1, data: { source: 'file' } }, s)).toBe(false)
  })

  it('debrancher: a disconnect of a console-to-speaker cable ends it; the connect of that cable does not, nor a mains unplug', () => {
    const c = cable(['q', 'out-main-l'], ['k', 'in-line-a'])
    const before = stateOf([Q, K], [c])
    expect(ends('debrancher', connected(c, 'disconnect'), stateOf([Q, K]), before)).toBe(true)
    expect(ends('debrancher', connected(c), before)).toBe(false)
    const mains = cable(['p', 'out-1'], ['k', 'power-in'])
    expect(ends('debrancher', connected(mains, 'disconnect'), stateOf([Q, K, P]), stateOf([Q, K, P], [mains]))).toBe(false)
  })

  it('rebrancher: a console-to-speaker connect ends it; its disconnect does not', () => {
    const c = cable(['q', 'out-main-r'], ['k', 'in-line-a'])
    const s = stateOf([Q, K], [c])
    expect(ends('rebrancher', connected(c), s)).toBe(true)
    expect(ends('rebrancher', connected(c, 'disconnect'), stateOf([Q, K]), s)).toBe(false)
  })
})

describe('nextConnectionStepFor', () => {
  const accepted = (s: TpState, from: TpPortRef, to: TpPortRef): boolean => {
    const g = new ConnectionGraph(registry, s.instances.map((i) => ({ instanceId: i.id, deviceId: i.deviceId })))
    for (const c of s.connections) g.connect(c.a, c.b)
    return g.canConnect(from, to).ok
  }

  it('console-speaker: a main output of the QL1 to the speaker input, accepted by the app', () => {
    const s = stateOf([['q', 'yamaha-ql1'], ['k', 'qsc-k12-2'], ['m', 'shure-sm58']])
    const step = nextConnectionStepFor('console-speaker', s, registry)!
    expect(step.from).toEqual({ instance: 'q', port: 'out-main-l' })
    expect(step.to).toEqual({ instance: 'k', port: 'in-line-a' })
    expect(accepted(s, step.from, step.to)).toBe(true)
  })

  it('console-speaker skips a taken main output and moves to the next one', () => {
    const s = stateOf([['q', 'yamaha-ql1'], ['k', 'qsc-k12-2'], ['k2', 'qsc-k12-2']], [cable(['q', 'out-main-l'], ['k', 'in-line-a'])])
    expect(nextConnectionStepFor('console-speaker', s, registry)).toMatchObject({ from: { instance: 'q', port: 'out-main-r' }, to: { instance: 'k2', port: 'in-line-a' } })
  })

  it('mic-console: from the mic, to a mic input of the QL1', () => {
    const s = stateOf([['q', 'yamaha-ql1'], ['m', 'shure-sm58']])
    expect(nextConnectionStepFor('mic-console', s, registry)).toEqual({ from: { instance: 'm', port: 'out-xlr' }, to: { instance: 'q', port: 'in-mic-1' } })
  })

  it('mains pairs: from the device’s mains inlet, to a free strip outlet', () => {
    const s = stateOf([['q', 'yamaha-ql1'], ['k', 'qsc-k12-2'], ['p', 'multiprise-secteur']], [cable(['p', 'out-1'], ['q', 'power-in'])])
    expect(nextConnectionStepFor('mains-speaker', s, registry)).toEqual({ from: { instance: 'k', port: 'power-in' }, to: { instance: 'p', port: 'out-2' } })
    expect(nextConnectionStepFor('mains-console', s, registry)).toBeNull() // the console is already on the strip
  })

  it('null without the two roles, for an unknown pair, and never a throw on a malformed state', () => {
    expect(nextConnectionStepFor('mains-console', stateOf([['q', 'yamaha-ql1']]), registry)).toBeNull()
    expect(nextConnectionStepFor('mic-console', stateOf([['m', 'shure-sm58'], ['isa', 'focusrite-isa-one']]), registry)).toBeNull()
    expect(nextConnectionStepFor('other', stateOf([['q', 'yamaha-ql1'], ['k', 'qsc-k12-2']]), registry)).toBeNull()
    expect(nextConnectionStepFor('console-speaker', { instances: null } as unknown as TpState, registry)).toBeNull()
  })
})

describe('anchor resolvers (pure, on a fake page)', () => {
  const RECT = (n: number): Rect => ({ x: n, y: n, w: 10, h: 10 })
  /** A page where only the listed selectors have a box; every device, port and control anchor has one. */
  function env(over: Partial<AnchorEnv> & { shown?: string[] } = {}): AnchorEnv {
    const shown = over.shown ?? []
    return {
      state: over.state ?? null,
      selection: over.selection ?? null,
      registry,
      firstRect: (selectors) => {
        for (const s of selectors) {
          const i = shown.indexOf(s)
          if (i >= 0) return RECT(100 + i)
        }
        return null
      },
      rectOfAnchor: over.rectOfAnchor ?? ((a: string) => (a.startsWith('device:') ? RECT(1) : a.startsWith('control:') ? RECT(2) : null)),
      ...fakeAnchors,
    }
  }
  const step = (id: StepId) => stepAnchor(byId(id), registry)

  it('an anchor that is not a tutorial anchor is not handled (undefined)', () => {
    expect(resolveTutorialAnchor('nav:status', env())).toBeUndefined()
    expect(resolveTutorialAnchor('device:q', env())).toBeUndefined()
  })

  it('inventory item: the card when it is shown, else its tab in the open drawer, else the « Matériel » menu', () => {
    const a = step('console')
    expect(a).toBe('nav:inventory.item.yamaha-ql1')
    const sel = resolveTutorialAnchor(a, env({ shown: [] }))
    expect(sel).toBeNull()
    expect(resolveTutorialAnchor(a, env({ shown: ['#cr-menu-materiel'] }))).toEqual(RECT(100))
    const tab = '[data-testid="inventory-drawer"][data-open="true"] [role="tab"][data-tab="consoles"]'
    expect(resolveTutorialAnchor(a, env({ shown: ['#cr-menu-materiel', tab] }))).toEqual(RECT(101))
    const item = '[data-testid="inventory-drawer"][data-open="true"] [data-testid="inventory-item"][data-device-id="yamaha-ql1"]'
    expect(resolveTutorialAnchor(a, env({ shown: ['#cr-menu-materiel', tab, item] }))).toEqual(RECT(102))
  })

  it('the speaker step points at the « Enceintes » tab (it names no model), the strip step at the strip card', () => {
    expect(step('enceinte')).toBe('nav:inventory.tab.enceintes')
    expect(step('micro')).toBe('nav:inventory.item.shure-sm58')
    expect(step('multiprise')).toBe('nav:inventory.item.multiprise-secteur')
  })

  it('connect from: the source device while it is not selected, then its « Connecter à… » button in Propriétés', () => {
    const s = stateOf([['q', 'yamaha-ql1'], ['k', 'qsc-k12-2']])
    const a = step('console-enceinte')
    expect(a).toBe('nav:connect.from.console-speaker')
    expect(resolveTutorialAnchor(a, env({ state: s }))).toEqual(RECT(1))
    const button = '[data-testid="properties-content"] [data-key="connect:out-main-l"]'
    expect(resolveTutorialAnchor(a, env({ state: s, selection: 'q', shown: [button] }))).toEqual(RECT(100))
    // selected, but Propriétés is folded (no box): the device itself
    expect(resolveTutorialAnchor(a, env({ state: s, selection: 'q', shown: [] }))).toEqual(RECT(1))
    // another device selected: still the source device
    expect(resolveTutorialAnchor(a, env({ state: s, selection: 'k', shown: [button] }))).toEqual(RECT(1))
    // nothing to cable: not on screen
    expect(resolveTutorialAnchor(a, env({ state: stateOf([['q', 'yamaha-ql1']]) }))).toBeNull()
  })

  it('playback: the « Lecture console » toggle in Propriétés when the console is selected, else its pad, else the console', () => {
    const s = stateOf([['q', 'yamaha-ql1']])
    const a = step('lecture-console')
    expect(a).toBe('control:suggest.playback')
    const row = '[data-testid="properties-content"] [data-key="ctl:playback-usb"]'
    expect(resolveTutorialAnchor(a, env({ state: s, selection: 'q', shown: [row] }))).toEqual(RECT(100))
    expect(resolveTutorialAnchor(a, env({ state: s }))).toEqual(RECT(2))
    expect(resolveTutorialAnchor(a, env({ state: s, rectOfAnchor: (x) => (x === 'device:q' ? RECT(1) : null) }))).toEqual(RECT(1))
    expect(resolveTutorialAnchor(a, env({ state: stateOf([]) }))).toBeNull()
  })

  it('unplug: the console while not selected, then the « Débrancher » button of its cable to a speaker', () => {
    const s = stateOf([['q', 'yamaha-ql1'], ['k', 'qsc-k12-2']], [cable(['q', 'out-main-r'], ['k', 'in-line-a'])])
    const a = step('debrancher')
    expect(a).toBe('nav:unplug.from.console-speaker')
    expect(resolveTutorialAnchor(a, env({ state: s }))).toEqual(RECT(1))
    const b = '[data-testid="properties-content"] [data-key="unplug:out-main-r"]'
    expect(resolveTutorialAnchor(a, env({ state: s, selection: 'q', shown: [b] }))).toEqual(RECT(100))
    expect(resolveTutorialAnchor(a, env({ state: stateOf([['q', 'yamaha-ql1'], ['k', 'qsc-k12-2']]) }))).toBeNull()
  })

  it('a throwing page is not on screen (null), never a throw', () => {
    const bad = env({ state: stateOf([['q', 'yamaha-ql1']]) })
    bad.firstRect = () => {
      throw new Error('page')
    }
    expect(resolveTutorialAnchor(step('console'), bad)).toBeNull()
  })
})
