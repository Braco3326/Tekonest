/**
 * Task 34 (C7, C8, C9, CA-03 gate): the pure signal path. `playbackReady` = an enabled source on a powered host, a path over the
 * catalog routing[] and the cables, to the input of a powered transducer, with no error event on the path. Mute, fader and
 * balance silence a feed but never gate it. « Micro OK » is separate. Designs are built with the real CreationStore so the
 * ports and the controls are the engine's.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { templateToDesign } from '../../src/creation/templates'
import { Template } from '../../src/creation/templateSchema'
import { parseProposals, registerProposals } from '../../src/creation/betaDevices'
import { COPY } from '../../src/creation/copy'
import { isPowered, signalPath, type PathResult, type ReasonCode } from '../../src/flow/signalPath'
import type { Registry } from '../../src/engine/CatalogLoader'
import type { ControlValue, PortRef, TeachingEvent } from '../../src/engine/types'
import type { DesignState } from '../../src/trials/trial'

const registry = makeRegistry()
const template = (): DesignState => templateToDesign(Template.parse(JSON.parse(readFileSync('content/templates/concert-simple-reference.json', 'utf8'))))
const ref = (s: string): PortRef => {
  const [instance, port] = s.split(' ')
  return { instance, port }
}
const storeOf = (r: Registry, design?: DesignState): CreationStore => new CreationStore(r, creationEvaluator(r), design)
const ok = (r: { ok: boolean }, what: string): void => {
  expect(r.ok, what).toBe(true)
}
const unplugAt = (s: CreationStore, at: string | string[] | undefined): void => {
  for (const a of [at ?? []].flat()) {
    const id = s.connectionAt(ref(a))
    expect(id, `a cable at ${a} to unplug`).toBeDefined()
    ok(s.dispatch({ type: 'DISCONNECT', connectionId: id! }), `unplug ${a}`)
  }
}
const setControls = (s: CreationStore, power: Record<string, boolean> | undefined, controls: Record<string, ControlValue> | undefined): void => {
  for (const [instance, value] of Object.entries(power ?? {})) ok(s.dispatch({ type: 'SET_CONTROL', instance, control: 'power', value }), `power ${instance}`)
  for (const [control, value] of Object.entries(controls ?? {})) ok(s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control, value }), `ql1 ${control}`)
}

interface RigOpts {
  playback?: boolean
  unplug?: string | string[]
  power?: Record<string, boolean>
  controls?: Record<string, ControlValue>
}
/** The powered reference rig: the Task 32 template (strip + 3 mains cables + mic cable) + the 2 signal cables, playback-usb on. */
function rig(o: RigOpts = {}): DesignState {
  const s = storeOf(registry, template())
  ok(s.dispatch({ type: 'CONNECT', a: ref('ql1 out-main-l'), b: ref('k12-g in-line-a') }), 'left cable')
  ok(s.dispatch({ type: 'CONNECT', a: ref('ql1 out-main-r'), b: ref('k12-d in-line-a') }), 'right cable')
  ok(s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: o.playback ?? true }), 'playback')
  unplugAt(s, o.unplug)
  setControls(s, o.power, o.controls)
  return s.design()
}
/** Left goes to k12-g, whose passive loop-thru goes on to k12-d. */
function chain(o: { unpowered?: string; playback?: boolean } = {}): DesignState {
  const s = storeOf(registry, template())
  ok(s.dispatch({ type: 'CONNECT', a: ref('ql1 out-main-l'), b: ref('k12-g in-line-a') }), 'left cable')
  ok(s.dispatch({ type: 'CONNECT', a: ref('k12-g thru-out-a'), b: ref('k12-d in-line-a') }), 'thru cable')
  ok(s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: o.playback ?? true }), 'playback')
  if (o.unpowered) ok(s.dispatch({ type: 'SET_CONTROL', instance: o.unpowered, control: 'power', value: false }), 'unpower')
  return s.design()
}
function emptyWith(ids: string[]): DesignState {
  const s = storeOf(registry)
  for (const deviceId of ids) ok(s.dispatch({ type: 'SPAWN', deviceId, instanceId: deviceId }), `spawn ${deviceId}`)
  return s.design()
}
const first = (d: DesignState, events: readonly TeachingEvent[] = []): ReasonCode => {
  const r = signalPath(d, registry, events)
  expect(r.reasons.length, 'a reason to read').toBeGreaterThan(0)
  return r.reasons[0].code
}
const err = (instance: string, port: string, severity: 'error' | 'warning' = 'error'): TeachingEvent => ({ ruleId: 'R5', severity, title: 't', teach: 't', subjects: [{ instance, port }] })
const fed = (r: PathResult): [string, string[]][] => r.speakers.map((s) => [s.instanceId, s.channels])

describe('playbackReady: the gate (C9)', () => {
  it('powered reference rig with playback on → ready, both speakers fed L and R', () => {
    const r = signalPath(rig(), registry, [])
    expect(r.playbackReady).toBe(true)
    expect(r.reasons).toEqual([])
    expect(fed(r)).toEqual([['k12-d', ['R']], ['k12-g', ['L']]])
  })
  it('each feed records its path: host output, then the speaker input', () => {
    const r = signalPath(rig(), registry, [])
    const g = r.speakers.find((s) => s.instanceId === 'k12-g')!
    expect(g.path).toEqual([ref('ql1 out-main-l'), ref('k12-g in-line-a')])
  })
  it('the Task 32 template as shipped (strip cabled, no signal cable): playback off → SOURCE_OFF; on → NO_PATH, never ready', () => {
    const d = template()
    const off = signalPath(d, registry, [])
    expect(off.playbackReady).toBe(false)
    expect(off.reasons[0].code).toBe('SOURCE_OFF')
    const s = storeOf(registry, d)
    ok(s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }), 'playback')
    const on = signalPath(s.design(), registry, [])
    expect(on.playbackReady).toBe(false)
    expect(on.speakers).toEqual([])
    expect(on.reasons[0].code).toBe('NO_PATH')
  })
  it('playback off → SOURCE_OFF', () => {
    const r = signalPath(rig({ playback: false }), registry, [])
    expect(r.playbackReady).toBe(false)
    expect(r.reasons[0].code).toBe('SOURCE_OFF')
    expect(r.speakers).toEqual([])
  })
  it('QL1 unplugged from mains → HOST_UNPOWERED', () => {
    const r = signalPath(rig({ unplug: 'ql1 power-in' }), registry, [])
    expect(r.playbackReady).toBe(false)
    expect(r.reasons[0].code).toBe('HOST_UNPOWERED')
    expect(r.speakers).toEqual([])
  })
  it('QL1 power control off → HOST_UNPOWERED (cabled but switched off)', () => {
    const d = rig({ power: { ql1: false } })
    expect(d.rig.connections.some((c) => [c.a, c.b].some((p) => p.instance === 'ql1' && p.port === 'power-in'))).toBe(true) // premise: still cabled
    expect(first(d)).toBe('HOST_UNPOWERED')
  })
  it('k12-g unpowered (unplugged) → only k12-d fed, ready stays true, SPEAKER_UNPOWERED listed', () => {
    const r = signalPath(rig({ unplug: 'k12-g power-in' }), registry, [])
    expect(r.playbackReady).toBe(true)
    expect(r.speakers.map((s) => s.instanceId)).toEqual(['k12-d'])
    expect(r.reasons.map((x) => x.code)).toContain('SPEAKER_UNPOWERED')
    expect(r.reasons.find((x) => x.code === 'SPEAKER_UNPOWERED')!.subjects).toEqual([{ instance: 'k12-g', port: 'power-in' }])
  })
  it('k12-g power control off → same as unplugged', () => {
    const r = signalPath(rig({ power: { 'k12-g': false } }), registry, [])
    expect(r.playbackReady).toBe(true)
    expect(r.speakers.map((s) => s.instanceId)).toEqual(['k12-d'])
    expect(r.reasons.map((x) => x.code)).toEqual(['SPEAKER_UNPOWERED'])
  })
  it('both speakers unpowered → not ready, SPEAKER_UNPOWERED (not NO_PATH: the signal does arrive)', () => {
    const r = signalPath(rig({ power: { 'k12-g': false, 'k12-d': false } }), registry, [])
    expect(r.playbackReady).toBe(false)
    expect(r.reasons.map((x) => x.code)).toEqual(['SPEAKER_UNPOWERED', 'SPEAKER_UNPOWERED'])
  })
  it('no speaker cable → NO_PATH', () => {
    const r = signalPath(rig({ unplug: ['ql1 out-main-l', 'ql1 out-main-r'] }), registry, [])
    expect(r.playbackReady).toBe(false)
    expect(r.reasons.map((x) => x.code)).toEqual(['NO_PATH'])
  })
  it('one speaker cable only → ready, only that speaker fed (no NO_PATH when something plays)', () => {
    const r = signalPath(rig({ unplug: 'ql1 out-main-r' }), registry, [])
    expect(r.playbackReady).toBe(true)
    expect(fed(r)).toEqual([['k12-g', ['L']]])
    expect(r.reasons.map((x) => x.code)).not.toContain('NO_PATH')
  })
  it('no QL1 → NO_SOURCE', () => {
    const r = signalPath(emptyWith(['shure-sm58']), registry, [])
    expect(r.playbackReady).toBe(false)
    expect(r.reasons.map((x) => x.code)).toEqual(['NO_SOURCE'])
  })
  it('an empty project → NO_SOURCE, nothing fed, no mic', () => {
    const r = signalPath(emptyWith([]), registry, [])
    expect(r).toMatchObject({ playbackReady: false, speakers: [], micOk: false })
    expect(r.reasons.map((x) => x.code)).toEqual(['NO_SOURCE'])
  })
})

describe('rule errors on the path', () => {
  it('an error event on a path port blocks that path → RULE_ERROR', () => {
    const r = signalPath(rig({ unplug: 'ql1 out-main-r' }), registry, [err('k12-g', 'in-line-a')])
    expect(r.playbackReady).toBe(false)
    expect(r.reasons[0].code).toBe('RULE_ERROR')
    expect(r.reasons[0].subjects).toEqual([{ instance: 'k12-g', port: 'in-line-a' }])
  })
  it('an error on the host output port blocks that channel only: the other speaker still plays', () => {
    const r = signalPath(rig(), registry, [err('ql1', 'out-main-l')])
    expect(r.playbackReady).toBe(true)
    expect(fed(r)).toEqual([['k12-d', ['R']]])
    expect(r.reasons.map((x) => x.code)).toEqual(['RULE_ERROR'])
  })
  it('a warning on a path port does not block (errors only)', () => {
    const r = signalPath(rig(), registry, [err('k12-g', 'in-line-a', 'warning')])
    expect(r.playbackReady).toBe(true)
    expect(fed(r)).toEqual([['k12-d', ['R']], ['k12-g', ['L']]])
  })
  it('an error on a port that is not on the path (the mic input) does not gate playback', () => {
    const r = signalPath(rig(), registry, [err('ql1', 'in-mic-1')])
    expect(r.playbackReady).toBe(true)
    expect(r.reasons).toEqual([])
    expect(r.micOk).toBe(false) // but it does fail the mic
  })
  it('both channels blocked → RULE_ERROR first, not ready', () => {
    const r = signalPath(rig(), registry, [err('k12-g', 'in-line-a'), err('k12-d', 'in-line-a')])
    expect(r.playbackReady).toBe(false)
    expect(r.reasons[0].code).toBe('RULE_ERROR')
  })
})

describe('mute, fader and balance never gate (C9); the feed carries them', () => {
  it('mute-master: ready, every feed muted; without it, none is', () => {
    expect(signalPath(rig(), registry, []).speakers.every((s) => !s.muted)).toBe(true)
    const r = signalPath(rig({ controls: { 'mute-master': true } }), registry, [])
    expect(r.playbackReady).toBe(true)
    expect(r.speakers).toHaveLength(2)
    expect(r.speakers.every((s) => s.muted)).toBe(true)
    expect(r.reasons).toEqual([])
  })
  it("fader-master '-inf': ready, gainDb -Infinity", () => {
    const r = signalPath(rig({ controls: { 'fader-master': '-inf' } }), registry, [])
    expect(r.playbackReady).toBe(true)
    expect(r.speakers.map((s) => s.gainDb)).toEqual([-Infinity, -Infinity])
  })
  it.each([
    ['-30', -30],
    ['-6', -6],
    ['0', 0],
    ['+6', 6],
    ['+10', 10],
  ])("fader-master '%s' → gainDb %d (the catalog default '0' is read when the control is untouched)", (value, db) => {
    expect(signalPath(rig({ controls: { 'fader-master': value } }), registry, []).speakers.map((s) => s.gainDb)).toEqual([db, db])
    expect(signalPath(rig(), registry, []).speakers.map((s) => s.gainDb)).toEqual([0, 0])
  })
  it('balance-master never gates and is carried as the catalog option', () => {
    const r = signalPath(rig({ controls: { 'balance-master': 'D100' } }), registry, [])
    expect(r.playbackReady).toBe(true)
    expect(r.speakers.map((s) => s.balance)).toEqual(['D100', 'D100'])
    expect(signalPath(rig(), registry, []).speakers.map((s) => s.balance)).toEqual(['C', 'C'])
  })
  it('all three at once still do not gate', () => {
    const r = signalPath(rig({ controls: { 'mute-master': true, 'fader-master': '-inf', 'balance-master': 'G100' } }), registry, [])
    expect(r.playbackReady).toBe(true)
    expect(r.speakers.map((s) => [s.muted, s.gainDb, s.balance])).toEqual([[true, -Infinity, 'G100'], [true, -Infinity, 'G100']])
  })
})

describe('daisy chain through the passive loop-thru', () => {
  it('(P7 assumption) a passive pass-through works unpowered: k12-g unpowered still passes left on to k12-d', () => {
    // `passive` is the plan's pedagogical assumption (P7, log L26), not a sourced fact: the test pins the plan's behaviour.
    const r = signalPath(chain({ unpowered: 'k12-g' }), registry, [])
    expect(fed(r)).toEqual([['k12-d', ['L']]])
    expect(r.playbackReady).toBe(true)
    expect(r.reasons.map((x) => x.code)).toEqual(['SPEAKER_UNPOWERED'])
    expect(r.reasons[0].subjects).toEqual([{ instance: 'k12-g', port: 'power-in' }])
  })
  it('both powered: k12-g and k12-d are each fed L, and k12-d\'s path goes through the thru', () => {
    const r = signalPath(chain(), registry, [])
    expect(fed(r)).toEqual([['k12-d', ['L']], ['k12-g', ['L']]])
    expect(r.speakers.find((s) => s.instanceId === 'k12-d')!.path).toEqual([ref('ql1 out-main-l'), ref('k12-g in-line-a'), ref('k12-g thru-out-a'), ref('k12-d in-line-a')])
  })
  it('the thru of a powered speaker is not a way around a rule error on the first leg', () => {
    const r = signalPath(chain(), registry, [err('k12-g', 'in-line-a')])
    expect(r.playbackReady).toBe(false)
    expect(r.speakers).toEqual([])
    expect(r.reasons[0].code).toBe('RULE_ERROR')
  })
  it('an unpowered k12-d at the end of the chain is not fed (its transducer route is not passive)', () => {
    const r = signalPath(chain({ unpowered: 'k12-d' }), registry, [])
    expect(fed(r)).toEqual([['k12-g', ['L']]])
    expect(r.reasons.map((x) => x.code)).toEqual(['SPEAKER_UNPOWERED'])
  })
  it('a third speaker daisy-chained after the second: depth is not limited to one hop', () => {
    const s = storeOf(registry, template())
    ok(s.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-3' }), 'spawn')
    ok(s.dispatch({ type: 'CONNECT', a: ref('ql1 out-main-l'), b: ref('k12-g in-line-a') }), 'a')
    ok(s.dispatch({ type: 'CONNECT', a: ref('k12-g thru-out-a'), b: ref('k12-d in-line-a') }), 'b')
    ok(s.dispatch({ type: 'CONNECT', a: ref('k12-d thru-out-a'), b: ref('k12-3 in-line-a') }), 'c')
    ok(s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }), 'playback')
    ok(s.dispatch({ type: 'SET_CONTROL', instance: 'k12-d', control: 'power', value: false }), 'middle speaker off')
    const r = signalPath(s.design(), registry, [])
    // k12-3 has no mains cable (the template has three): unpowered; the middle one is switched off; only the first plays
    expect(fed(r)).toEqual([['k12-g', ['L']]])
    expect(r.reasons.map((x) => x.subjects[0].instance).sort()).toEqual(['k12-3', 'k12-d'])
  })
})

describe('a cable loop through two passive thrus terminates', () => {
  // The store allows one cable per port, and every input of the loop (k12-g, k12-d in-line-a) already has its own feed, so the
  // loop cannot be wired through intents: the DesignState is built by hand (signalPath is pure and reads any DesignState).
  it('ql1 -> k12-g -> (thru) k12-d -> (thru) back into k12-g in-line-a: terminates; feeds from the first visit', () => {
    const d = chain()
    d.rig.connections.push({ a: ref('k12-d thru-out-a'), b: ref('k12-g in-line-a') }) // the loop; k12-g in-line-a now has two cables
    // Bounded work counter: EVERY property read on the connection list counts (iterator, length, index, find, ...), so the bound holds
    // however the cable lookup is written. A walk that does not stop (the `seen` guard removed) would loop for ever and hang the
    // suite, so the list throws after a generous budget instead: the mutant FAILS. A correct walk reads it about a hundred times.
    let reads = 0
    const BUDGET = 5000
    const watched = new Proxy(d.rig.connections, {
      get(target, prop, receiver) {
        if (++reads > BUDGET) throw new Error(`signal walk read the cables more than ${BUDGET} times: no cycle guard`)
        return Reflect.get(target, prop, receiver)
      },
    })
    d.rig.connections = watched
    const r = signalPath(d, registry, [])
    expect(reads).toBeGreaterThan(0) // the counter really sees the walk
    expect(reads).toBeLessThan(BUDGET)
    expect(r.playbackReady).toBe(true)
    expect(fed(r)).toEqual([['k12-d', ['L']], ['k12-g', ['L']]]) // each fed once, left only: nothing doubled by going round
  })
})

describe('Micro OK is separate from playback', () => {
  it('SM58 into a powered QL1 mic input with no error event → micOk; unplugged → not', () => {
    expect(signalPath(rig(), registry, []).micOk).toBe(true)
    const r = signalPath(rig({ unplug: 'sm58 out-xlr' }), registry, [])
    expect(r.micOk).toBe(false)
    expect(r.micReasons.map((x) => x.code)).toEqual(['NO_MIC'])
    expect(r.playbackReady).toBe(true) // the mic is not part of the playback gate
  })
  it('micOk does not need playback: playback off, mic still ok', () => {
    const r = signalPath(rig({ playback: false }), registry, [])
    expect(r.playbackReady).toBe(false)
    expect(r.micOk).toBe(true)
    expect(r.micReasons).toEqual([])
  })
  it('QL1 unpowered (unplugged or switched off) → micOk false with HOST_UNPOWERED', () => {
    for (const d of [rig({ unplug: 'ql1 power-in' }), rig({ power: { ql1: false } })]) {
      const r = signalPath(d, registry, [])
      expect(r.micOk).toBe(false)
      expect(r.micReasons.map((x) => x.code)).toEqual(['HOST_UNPOWERED'])
    }
  })
  it('an error event on the mic cable ports → micOk false with RULE_ERROR; on either end', () => {
    for (const e of [err('sm58', 'out-xlr'), err('ql1', 'in-mic-1')]) {
      const r = signalPath(rig(), registry, [e])
      expect(r.micOk).toBe(false)
      expect(r.micReasons.map((x) => x.code)).toEqual(['RULE_ERROR'])
    }
  })
  it('a warning does not fail the mic', () => {
    expect(signalPath(rig(), registry, [err('ql1', 'in-mic-1', 'warning')]).micOk).toBe(true)
  })
  it('no mic in the rig → NO_MIC', () => {
    const r = signalPath(emptyWith(['yamaha-ql1']), registry, [])
    expect(r.micOk).toBe(false)
    expect(r.micReasons.map((x) => x.code)).toEqual(['NO_MIC'])
  })
  it('mute/fader on the console do not touch micOk', () => {
    expect(signalPath(rig({ controls: { 'mute-master': true, 'fader-master': '-inf' } }), registry, []).micOk).toBe(true)
  })
})

describe('isPowered (C7): power-in cabled to a mains source AND power on', () => {
  const d = rig()
  it('true for the three powered devices, true for a device with no power-in (mic, strip)', () => {
    for (const id of ['ql1', 'k12-g', 'k12-d', 'sm58', 'mains']) expect(isPowered(d, registry, id), id).toBe(true)
  })
  it('false for an unknown instance', () => {
    expect(isPowered(d, registry, 'nobody')).toBe(false)
  })
  it('false when unplugged, and false when the power control is off even if cabled', () => {
    expect(isPowered(rig({ unplug: 'k12-g power-in' }), registry, 'k12-g')).toBe(false)
    expect(isPowered(rig({ power: { 'k12-g': false } }), registry, 'k12-g')).toBe(false)
  })
  it('a K12 whose power-in is cabled to a NON mains peer is not powered', () => {
    // A power-in can only be cabled to a mains-power port (R1-R3), so « not mains » is a strip whose outputs do not carry the flag:
    // a second registry whose strip has none, read against the same design.
    const r = makeRegistry()
    const strip = r.deviceById.get('multiprise-secteur')!
    for (const p of strip.ports) p.flags = (p.flags ?? []).filter((f) => f !== 'isMainsSource')
    expect(isPowered(rig(), r, 'k12-g')).toBe(false)
    expect(isPowered(rig(), registry, 'k12-g')).toBe(true)
  })
})

describe('Bêta (unverified) devices are never part of the signal path', () => {
  const proposals = JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as unknown
  const withBeta = (extra: unknown[] = []): Registry => {
    const r = makeRegistry()
    registerProposals(r, parseProposals({ devices: [...(proposals as { devices: unknown[] }).devices, ...extra] }, r).devices)
    return r
  }
  /** A proposal that fits between the QL1 main out and a K12 input, and tries to carry its own routing. */
  const inline = {
    id: 'p-inline',
    label: 'Boîtier en ligne',
    levels: [],
    realWorld: { brand: 'Marque', model: 'p-inline', category: 'di', typicalUse: 'usage', notes: '' },
    ports: [
      { portId: 'in-line', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro' },
      { portId: 'out-line', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro' },
    ],
    routing: [{ from: 'in-line', to: ['out-line'] }],
  }
  /** The template + QL1 out-main-l → beta → k12-g, playback on. */
  const throughBeta = (r: Registry): DesignState => {
    const s = storeOf(r, template())
    ok(s.dispatch({ type: 'SPAWN', deviceId: 'p-inline', instanceId: 'beta' }), 'spawn beta')
    ok(s.dispatch({ type: 'CONNECT', a: ref('ql1 out-main-l'), b: ref('beta in-line') }), 'ql1 → beta')
    ok(s.dispatch({ type: 'CONNECT', a: ref('beta out-line'), b: ref('k12-g in-line-a') }), 'beta → k12')
    ok(s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }), 'playback')
    return s.design()
  }

  it('premise: the proposal is registered and carries no routing (parseProposals drops it)', () => {
    const r = withBeta([inline])
    expect(r.deviceById.get('p-inline')).toBeDefined()
    expect(r.deviceById.get('p-inline')!.routing).toBeUndefined()
    expect(r.catalog.devices.some((x) => x.id === 'p-inline')).toBe(false)
  })
  it('a Bêta device wired between the QL1 and a speaker does not produce a feed', () => {
    const r = withBeta([inline])
    const res = signalPath(throughBeta(r), r, [])
    expect(res.playbackReady).toBe(false)
    expect(res.speakers).toEqual([])
    expect(res.reasons[0].code).toBe('NO_PATH')
  })
  it('even if routing is put on the registered Bêta device afterwards, it is not followed (verified catalog data only)', () => {
    const r = withBeta([inline])
    r.deviceById.get('p-inline')!.routing = [{ from: 'in-line', to: ['out-line'] }]
    const res = signalPath(throughBeta(r), r, [])
    expect(res.playbackReady).toBe(false)
    expect(res.speakers).toEqual([])
  })
  it('a Bêta device that claims to be a transducer is no speaker', () => {
    const r = withBeta([{ ...inline, id: 'p-spk', ports: [inline.ports[0]], routing: [{ from: 'in-line', to: ['transducer'] }] }])
    r.deviceById.get('p-spk')!.routing = [{ from: 'in-line', to: ['transducer'] }]
    const s = storeOf(r, template())
    ok(s.dispatch({ type: 'SPAWN', deviceId: 'p-spk', instanceId: 'beta' }), 'spawn')
    ok(s.dispatch({ type: 'CONNECT', a: ref('ql1 out-main-l'), b: ref('beta in-line') }), 'cable')
    ok(s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }), 'playback')
    const res = signalPath(s.design(), r, [])
    expect(res.speakers).toEqual([])
    expect(res.playbackReady).toBe(false)
  })
  it.each([
    ['shure-axient-digital-ad4d', 'out-ac-power-cascade-locking'],
    ['shure-ua845uwb', 'out-ac-power-output-daisy-chain'],
  ])('a Bêta mains output (%s) wired to a K12 power-in does not power it', (deviceId, portId) => {
    const r = withBeta()
    const s = storeOf(r, template())
    ok(s.dispatch({ type: 'SPAWN', deviceId, instanceId: 'beta' }), 'spawn')
    ok(s.dispatch({ type: 'DISCONNECT', connectionId: s.connectionAt(ref('k12-g power-in'))! }), 'free the K12 inlet')
    ok(s.dispatch({ type: 'CONNECT', a: ref('beta ' + portId), b: ref('k12-g power-in') }), 'beta → k12 power-in (the engine accepts it)')
    ok(s.dispatch({ type: 'CONNECT', a: ref('ql1 out-main-l'), b: ref('k12-g in-line-a') }), 'signal')
    ok(s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }), 'playback')
    const d = s.design()
    expect(isPowered(d, r, 'k12-g')).toBe(false)
    const res = signalPath(d, r, [])
    expect(res.speakers).toEqual([])
    expect(res.reasons.map((x) => x.code)).toEqual(['SPEAKER_UNPOWERED'])
    expect(res.playbackReady).toBe(false)
  })
  it('and still not if the isMainsSource flag is set directly on the registered Bêta port (isMainsSourceRef guards it)', () => {
    const r = withBeta()
    const beta = r.deviceById.get('shure-ua845uwb')!
    const port = beta.ports.find((p) => p.portId === 'out-ac-power-output-daisy-chain')!
    port.flags = [...(port.flags ?? []), 'isMainsSource']
    const s = storeOf(r, template())
    ok(s.dispatch({ type: 'SPAWN', deviceId: 'shure-ua845uwb', instanceId: 'beta' }), 'spawn')
    ok(s.dispatch({ type: 'DISCONNECT', connectionId: s.connectionAt(ref('k12-g power-in'))! }), 'free')
    ok(s.dispatch({ type: 'CONNECT', a: ref('beta ' + port.portId), b: ref('k12-g power-in') }), 'cable')
    expect(isPowered(s.design(), r, 'k12-g')).toBe(false)
  })
  it('micOk is false for a Bêta mic, and true for the same wiring with the verified SM58 (the premise)', () => {
    const r = withBeta()
    const mic = (deviceId: string): DesignState => {
      const s = storeOf(r, template())
      ok(s.dispatch({ type: 'DISCONNECT', connectionId: s.connectionAt(ref('sm58 out-xlr'))! }), 'free the SM58')
      ok(s.dispatch({ type: 'SPAWN', deviceId, instanceId: 'm' }), 'spawn')
      const out = r.deviceById.get(deviceId)!.ports.find((p) => p.dir === 'out' && p.signal === 'mic-level')!
      ok(s.dispatch({ type: 'CONNECT', a: ref('m ' + out.portId), b: ref('ql1 in-mic-1') }), 'mic cable (the engine accepts it)')
      return s.design()
    }
    expect(signalPath(mic('shure-sm58'), r, []).micOk).toBe(true)
    const beta = signalPath(mic('beyerdynamic-m-160'), r, [])
    expect(beta.micOk).toBe(false)
    expect(beta.micReasons.map((x) => x.code)).toEqual(['NO_MIC'])
  })
  it('a Bêta preamp with a flagged mic input gives no Micro OK, even with a verified SM58 cabled to it', () => {
    const pre = {
      id: 'p-pre',
      label: 'Préampli',
      levels: [],
      realWorld: { brand: 'Marque', model: 'p-pre', category: 'preamp', typicalUse: 'usage', notes: '' },
      ports: [{ portId: 'in-mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level', flags: ['isMicInput'] }],
    }
    const r = withBeta([pre])
    const s = storeOf(r, template())
    ok(s.dispatch({ type: 'DISCONNECT', connectionId: s.connectionAt(ref('sm58 out-xlr'))! }), 'free the SM58')
    ok(s.dispatch({ type: 'SPAWN', deviceId: 'p-pre', instanceId: 'beta' }), 'spawn')
    ok(s.dispatch({ type: 'CONNECT', a: ref('sm58 out-xlr'), b: ref('beta in-mic') }), 'cable')
    const res = signalPath(s.design(), r, [])
    expect(res.micOk).toBe(false)
    expect(res.micReasons.map((x) => x.code)).toEqual(['NO_MIC'])
  })
})

describe('purity', () => {
  it('does not mutate its inputs and gives the same answer twice', () => {
    const d = rig({ controls: { 'fader-master': '-6' } })
    const events = [err('k12-g', 'in-line-a')]
    const dCopy = structuredClone(d)
    const eCopy = structuredClone(events)
    const a = signalPath(d, registry, events)
    const b = signalPath(d, registry, events)
    expect(a).toEqual(b)
    expect(d).toEqual(dCopy)
    expect(events).toEqual(eCopy)
  })
  it('follows the design it is given (no cache): the same registry, a changed rig, a changed answer', () => {
    expect(signalPath(rig(), registry, []).playbackReady).toBe(true)
    expect(signalPath(rig({ unplug: ['ql1 out-main-l', 'ql1 out-main-r'] }), registry, []).playbackReady).toBe(false)
    expect(signalPath(rig(), registry, []).playbackReady).toBe(true)
  })
  it('every reason code has a non-empty French text from the shell copy, and it is the one returned', () => {
    const P = COPY.playback!
    const codes: ReasonCode[] = ['NO_SOURCE', 'SOURCE_OFF', 'HOST_UNPOWERED', 'NO_PATH', 'SPEAKER_UNPOWERED', 'RULE_ERROR', 'NO_MIC']
    for (const k of ['noSource', 'sourceOff', 'hostUnpowered', 'noPath', 'speakerUnpowered', 'ruleError', 'noMic', 'ready', 'micOk']) expect(P[k], k).toBeTruthy()
    expect(signalPath(emptyWith([]), registry, []).reasons[0]).toMatchObject({ code: codes[0], text_fr: P.noSource })
    expect(signalPath(rig({ playback: false }), registry, []).reasons[0].text_fr).toBe(P.sourceOff)
    expect(signalPath(rig({ unplug: 'ql1 power-in' }), registry, []).reasons[0].text_fr).toBe(P.hostUnpowered)
    expect(signalPath(rig({ unplug: ['ql1 out-main-l', 'ql1 out-main-r'] }), registry, []).reasons[0].text_fr).toBe(P.noPath)
    expect(signalPath(rig({ unplug: 'k12-g power-in' }), registry, []).reasons[0].text_fr).toBe(P.speakerUnpowered)
    expect(signalPath(rig(), registry, [err('k12-g', 'in-line-a'), err('k12-d', 'in-line-a')]).reasons[0].text_fr).toBe(P.ruleError)
    expect(signalPath(rig({ unplug: 'sm58 out-xlr' }), registry, []).micReasons[0].text_fr).toBe(P.noMic)
  })
  it('the current drafts of the reason texts (tekuxwriter owns the final wording)', () => {
    const P = COPY.playback!
    expect(P.noSource).toBe('Aucune source de lecture dans le projet.')
    expect(P.sourceOff).toBe('La lecture console est coupée.')
    expect(P.hostUnpowered).toBe('La console n’est pas alimentée.')
    expect(P.noPath).toBe('Aucun chemin de la console jusqu’à une enceinte.')
    expect(P.speakerUnpowered).toBe('Une enceinte reçoit le signal mais n’est pas alimentée.')
    expect(P.ruleError).toBe('Une erreur de câblage bloque le chemin.')
  })
})

describe('src/flow stays a pure layer', () => {
  const root = resolve(__dirname, '../../src')
  const importsOf = (file: string): string[] => {
    const src = readFileSync(file, 'utf8')
    // value imports and re-exports only: `import type` is erased and carries no runtime dependency
    return [...src.matchAll(/^\s*(?:import|export)\s+(?!type\b)[\w\s{},*$]*?\bfrom\s+['"]([^'"]+)['"]/gm), ...src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)].map((m) => m[1])
  }
  const resolveTs = (from: string, spec: string): string | null => {
    if (!spec.startsWith('.')) return null
    const base = resolve(dirname(from), spec)
    for (const c of [`${base}.ts`, `${base}/index.ts`, base]) if (existsSync(c) && c.endsWith('.ts')) return c
    return null
  }
  /** Every external package and every src file reachable by value imports from `entry`. */
  const closure = (entry: string): { files: Set<string>; packages: Set<string> } => {
    const files = new Set<string>()
    const packages = new Set<string>()
    const todo = [entry]
    while (todo.length) {
      const f = todo.pop()!
      if (files.has(f)) continue
      files.add(f)
      for (const spec of importsOf(f)) {
        const next = resolveTs(f, spec)
        if (next) todo.push(next)
        else if (!spec.startsWith('.')) packages.add(spec)
        else if (!/\.(json|css|svg|png|glb)$|\?/.test(spec)) throw new Error(`cannot resolve ${spec} from ${f}`)
      }
    }
    return { files, packages }
  }
  const entry = resolve(root, 'flow/signalPath.ts')

  it('the module exists and its value-import closure reaches no store, shell, engine graph, Babylon, DOM or betaDevices import', () => {
    expect(existsSync(entry)).toBe(true)
    const { files, packages } = closure(entry)
    const names = [...files].map((f) => f.replace(root, '').replace(/\\/g, '/'))
    expect(names).toContain('/flow/signalPath.ts')
    expect(names).toContain('/creation/mains.ts') // the registry-aware mains reader is the one used
    for (const n of names) {
      expect(n, n).not.toMatch(/\/creation\/store\.ts$/)
      expect(n, n).not.toMatch(/\/creation\/shell\//)
      expect(n, n).not.toMatch(/ConnectionGraph|RuleEvaluator/)
    }
    expect([...packages].filter((p) => /babylon/i.test(p))).toEqual([])
  })
  it('signalPath.ts itself imports neither the store, betaDevices, the DOM nor an engine implementation', () => {
    const src = readFileSync(entry, 'utf8')
    for (const bad of [/creation\/store/, /betaDevices/, /ConnectionGraph/, /RuleEvaluator/, /@babylonjs/, /\bdocument\./, /\bwindow\./]) expect(src, String(bad)).not.toMatch(bad)
  })
  it('the guard bites: the closure walker sees the transitive import of the Babylon-free module and would see a store import', () => {
    const { files } = closure(resolve(root, 'creation/boot.ts'))
    expect([...files].some((f) => /creation[\\/]store\.ts$/.test(f))).toBe(true)
  })
})
