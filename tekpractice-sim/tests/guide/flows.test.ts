// Flows of Mode Création: anchors, texts, and the live cable / phantom suggestions.
import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { ConnectionGraph } from '../../src/engine/ConnectionGraph'
import { isAnchor } from '../../src/guide/anchors'
import { NAV_SELECTORS } from '../../src/guide/bridge/creationBridge'
import type { TpState } from '../../src/guide/bridge/types'
import {
  ACKNOWLEDGE,
  CREATION_FLOWS,
  CREATION_STRINGS,
  FLOW_PATH,
  SUGGEST_FROM,
  SUGGEST_PHANTOM,
  SUGGEST_TO,
  benchStage,
  firstPhantom,
  flowsFor,
  keywordsFor,
  montageFlowFor,
  nextConnectionStep,
  type BenchStage,
} from '../../src/guide/flows.creation'
import { TP_STRINGS } from '../../src/guide/strings'
import { ANCHOR_PATTERN, isValidAnchor } from '../../src/guide/vendor/core/planner'
import { createController } from '../../src/guide/vendor/core/controller'
import type { GuideBrain } from '../../src/guide/vendor/core/brain'
import type { ControllerInput, HostEvent } from '../../src/guide/vendor/core/types'

const registry = makeRegistry()
const RESERVED = [SUGGEST_FROM, SUGGEST_TO, SUGGEST_PHANTOM]

function stateOf(devices: [string, string][], connections: TpState['connections'] = []): TpState {
  const controls: TpState['controls'] = {}
  for (const [id, deviceId] of devices) {
    const own: Record<string, boolean | string> = {}
    for (const c of registry.deviceById.get(deviceId)?.controls ?? []) own[c.id] = c.type === 'toggle' ? c.default : c.defaultOption
    controls[id] = own
  }
  return {
    route: 'creation',
    placeKnown: true,
    instances: devices.map(([id, deviceId]) => ({ id, deviceId, label: registry.deviceById.get(deviceId)?.label ?? deviceId })),
    connections,
    controls,
    events: [],
    playbackReady: false,
    firstReason: null,
  }
}

describe('flows: anchors and texts', () => {
  it('every flow step anchor passes isAnchor, or is a reserved suggestion anchor (and then matches the vendored anchor pattern too)', () => {
    for (const f of CREATION_FLOWS)
      for (const s of f.steps) {
        for (const a of [s.anchor, ...(s.to === undefined ? [] : [s.to])]) {
          if (RESERVED.includes(a)) expect(isAnchor(a)).toBe(true)
          else expect(Object.keys(NAV_SELECTORS)).toContain(a)
          expect(isAnchor(a)).toBe(true)
          expect(isValidAnchor(a)).toBe(true)
          expect(ANCHOR_PATTERN.test(a)).toBe(true)
        }
      }
  })

  it('flow titles and step texts exist in TP_STRINGS, and the flow says exactly those texts', () => {
    const texts = new Set<string>()
    const collect = (node: unknown): void => {
      if (typeof node === 'string') texts.add(node)
      else if (node && typeof node === 'object') Object.values(node).forEach(collect)
    }
    collect(TP_STRINGS.flows)
    for (const f of CREATION_FLOWS) {
      const key = f.titleKey.replace(/^flows\./, '')
      expect(Object.keys(TP_STRINGS.flows)).toContain(key)
      expect(CREATION_STRINGS.flows[key as keyof typeof CREATION_STRINGS.flows]).toBe(TP_STRINGS.flows[key as keyof typeof TP_STRINGS.flows].title)
      expect(f.steps.length).toBeGreaterThan(0)
      for (const s of f.steps) {
        expect(s.say.length).toBeGreaterThan(0)
        expect(texts.has(s.say)).toBe(true)
      }
    }
  })

  it('has the six flows of the path, none with a `when` predicate', () => {
    expect(CREATION_FLOWS.map((f) => f.id)).toEqual([...FLOW_PATH])
    expect(CREATION_FLOWS.every((f) => f.when === undefined)).toBe(true)
  })

  it('every step text of TP_STRINGS is used by the flow it belongs to, and a flow says nothing else', () => {
    for (const f of CREATION_FLOWS) {
      const own = Object.values(TP_STRINGS.flows[f.id as keyof typeof TP_STRINGS.flows].steps)
      expect([...new Set(f.steps.map((x) => x.say))].sort()).toEqual([...new Set(own)].sort())
    }
  })

  it('premier-montage ends step 1 on placeChosen (R7), the cable step on connect, and the status step on acknowledge', () => {
    const f = CREATION_FLOWS[0]
    expect(f.steps[0].done).toEqual({ event: 'placeChosen' })
    expect(f.steps.filter((s) => s.done.event === 'deviceAdded')).toHaveLength(2)
    const drag = f.steps.find((s) => s.action === 'drag')!
    expect(drag).toMatchObject({ anchor: SUGGEST_FROM, to: SUGGEST_TO, done: { event: 'connect' } })
    expect(f.steps[f.steps.length - 1]).toMatchObject({ anchor: 'nav:status', action: 'read', done: { event: ACKNOWLEDGE } })
  })

  it('alimentation-fantome is one toggle step done by the suggested switch going on; lire-le-statut is one read step on the status bar', () => {
    const byId = (id: string) => CREATION_FLOWS.find((f) => f.id === id)!
    expect(byId('alimentation-fantome').steps).toEqual([expect.objectContaining({ anchor: SUGGEST_PHANTOM, action: 'toggle', done: { event: 'toggle', match: { value: true, suggested: true } } })])
    expect(byId('lire-le-statut').steps).toEqual([expect.objectContaining({ anchor: 'nav:status', action: 'read', done: { event: ACKNOWLEDGE } })])
  })

  it('each small flow starts at its own thing: places, devices, the second device, the cable', () => {
    const first = (id: string) => CREATION_FLOWS.find((f) => f.id === id)!.steps[0]
    expect(first('premier-montage')).toMatchObject({ anchor: 'nav:place', done: { event: 'placeChosen' } })
    expect(first('ajouter-des-appareils')).toMatchObject({ anchor: 'nav:inventory', done: { event: 'deviceAdded' } })
    expect(first('deuxieme-appareil')).toMatchObject({ anchor: 'nav:inventory', done: { event: 'deviceAdded' } })
    expect(CREATION_FLOWS.find((f) => f.id === 'deuxieme-appareil')!.steps).toHaveLength(1)
    expect(first('premier-cable')).toMatchObject({ anchor: SUGGEST_FROM, to: SUGGEST_TO, action: 'drag', done: { event: 'connect' } })
  })

  it('every keyword table entry names a flow that exists, for every stage', () => {
    const ids = new Set(CREATION_FLOWS.map((f) => f.id))
    for (const stage of STAGES) {
      const table = keywordsFor(stage)
      expect(table.length).toBeGreaterThan(0)
      for (const k of table) expect(ids.has(k.flowId), `${stage} ${k.flowId}`).toBe(true)
    }
  })
})

const STAGES: BenchStage[] = ['no-place', 'empty', 'one-device', 'connectable', 'settled']

describe('bench stage and the flow that comes first', () => {
  const PAIR: [string, string][] = [['ql1', 'yamaha-ql1'], ['mic', 'shure-sm58']]
  const cable = [{ a: { instance: 'mic', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }]

  it('five stages: no place, empty bench, one device, a cable can be drawn, everything else', () => {
    expect(benchStage(null, registry)).toBe('no-place')
    expect(benchStage({ ...stateOf([]), placeKnown: false }, registry)).toBe('no-place')
    expect(benchStage({ ...stateOf(PAIR), placeKnown: false }, registry)).toBe('no-place')
    expect(benchStage(stateOf([]), registry)).toBe('empty')
    expect(benchStage(stateOf([['ql1', 'yamaha-ql1']]), registry)).toBe('one-device')
    expect(benchStage(stateOf(PAIR), registry)).toBe('connectable')
    expect(benchStage(stateOf(PAIR, cable), registry)).toBe('settled')
    // two devices the app cannot cable together: nothing to draw, so not connectable
    expect(benchStage(stateOf([['mic', 'shure-sm58'], ['spk', 'qsc-k12-2']]), registry)).toBe('settled')
  })

  it('the first flow of each stage is the one that starts at what is next', () => {
    expect(STAGES.map((s) => flowsFor(s)[0].id)).toEqual(['premier-montage', 'ajouter-des-appareils', 'deuxieme-appareil', 'premier-cable', 'lire-le-statut'])
  })

  it('flowsFor keeps every flow (a running or restored flow is always found), the same objects, the path from the stage on first', () => {
    for (const stage of STAGES) {
      const list = flowsFor(stage)
      expect(list).toHaveLength(CREATION_FLOWS.length)
      expect(new Set(list)).toEqual(new Set(CREATION_FLOWS))
    }
    expect(flowsFor('connectable').map((f) => f.id)).toEqual(['premier-cable', 'lire-le-statut', 'alimentation-fantome', 'premier-montage', 'ajouter-des-appareils', 'deuxieme-appareil'])
  })

  it('the words « premier montage » open the flow of the stage while the montage is not done, the whole flow after', () => {
    expect(STAGES.map((s) => montageFlowFor(s))).toEqual(['premier-montage', 'ajouter-des-appareils', 'deuxieme-appareil', 'premier-cable', 'premier-montage'])
    for (const stage of STAGES) {
      const montage = keywordsFor(stage).find((k) => k.keywords.includes('premier montage'))!
      expect(montage.flowId).toBe(montageFlowFor(stage))
    }
  })
})

describe('flows: they run on the real controller', () => {
  const brain: GuideBrain = {
    ask: async () => ({ kind: 'refusal', text: 'x', lines: [], verdict: null }),
    judge: async () => ({ verdict: null, needInfo: null }),
  }
  function run(stage: BenchStage = 'no-place') {
    const clock = { t: 1 }
    const c = createController({ brain, flows: flowsFor(stage), clock: () => clock.t++, strings: CREATION_STRINGS, flowKeywords: keywordsFor(stage) })
    const send = (i: ControllerInput) => c.dispatch(i)
    const ev = (type: string, data?: HostEvent['data']) => send({ type: 'hostEvent', event: { type, at: clock.t++, ...(data ? { data } : {}) } })
    return { c, send, ev }
  }

  it('premier-montage runs to its end by the events the bridge derives, with the titles and texts of TP_STRINGS', async () => {
    const { c, send, ev } = run()
    await send({ type: 'setContext', context: { page: 'workbench', mode: 'practice' } })
    let v = await send({ type: 'flow', control: { action: 'start', flowId: 'premier-montage' } })
    expect(v.bubble?.title).toBe('Parcours « Premier montage » : étape 1 sur 5.')
    expect(v.bubble?.lines[0].text).toBe(TP_STRINGS.flows['premier-montage'].steps.place)
    expect(v.target?.anchor).toBe('nav:place')
    v = await ev('placeChosen')
    expect(v.bubble?.lines[0].text).toBe(TP_STRINGS.flows['premier-montage'].steps.addFirst)
    await ev('deviceAdded', { device: 'device:a' })
    v = await ev('deviceAdded', { device: 'device:b' })
    expect(v.target?.anchor).toBe(SUGGEST_FROM)
    expect(v.bubble?.lines[0].text).toBe(TP_STRINGS.flows['premier-montage'].steps.connect)
    // the step bubble points at the first end; « Montre-moi » shows the whole drag, which asks the widget for both ends
    v = await send({ type: 'chip', id: 'show' })
    expect(v.target?.gesture).toBe('drag')
    expect(c.getView().wantAnchors).toEqual([SUGGEST_FROM, SUGGEST_TO])
    v = await ev('connect', { a: 'port:a.out', b: 'port:b.in' })
    expect(v.target?.anchor).toBe('nav:status')
    v = await ev(ACKNOWLEDGE, { anchor: 'nav:status' })
    expect(v.bubble?.kind).toBe('celebrate')
    expect(v.bubble?.lines[0].text).toContain('Premier montage')
  })

  it('alimentation-fantome ends on the suggested switch going on, and on nothing else', async () => {
    const { send, ev } = run()
    await send({ type: 'setContext', context: { page: 'workbench', mode: 'practice' } })
    await send({ type: 'flow', control: { action: 'start', flowId: 'alimentation-fantome' } })
    // the switch going off, or a switch that is not the suggested one (no `suggested` mark), does not end the step
    let v = await ev('toggle', { control: 'control:isa.phantom-48v', anchor: 'control:isa.phantom-48v', value: false, suggested: true })
    expect(v.bubble?.kind).toBe('step')
    v = await ev('toggle', { control: 'control:other.phantom-48v', anchor: 'control:other.phantom-48v', value: true })
    expect(v.bubble?.kind).toBe('step')
    v = await ev('toggle', { control: 'control:isa.phantom-48v', anchor: 'control:isa.phantom-48v', value: true, suggested: true })
    expect(v.bubble?.kind).toBe('celebrate')
  })

  it('on an empty bench with no verdict the next step offers premier-montage and the start chip begins it', async () => {
    const { send } = run()
    await send({ type: 'setContext', context: { page: 'workbench', mode: 'practice' } })
    let v = await send({ type: 'chip', id: 'next' })
    expect(v.bubble?.lines.map((l) => l.text)).toEqual(['Aucune étape en cours. Un parcours guidé peut être lancé.'])
    expect(v.bubble?.chips.map((c) => c.id)).toContain('start')
    v = await send({ type: 'chip', id: 'start' })
    expect(v.bubble?.title).toBe('Parcours « Premier montage » : étape 1 sur 5.')
  })

  it('a learner can reach each flow by words: premier montage, fantôme, barre d’état', async () => {
    for (const [question, title] of [
      ['comment faire mon premier montage ?', 'Premier montage'],
      ['comment activer l’alimentation fantôme', 'Alimentation fantôme'],
      ['comment faire pour lire la barre d’état', 'Lire la barre d’état'],
    ] as const) {
      const { send } = run()
      await send({ type: 'setContext', context: { page: 'workbench', mode: 'practice' } })
      const v = await send({ type: 'ask', text: question })
      expect(v.bubble?.title).toContain(title)
    }
  })

  it('every text a flow shows is free of the old « relancer la vérification » wording', async () => {
    const all = JSON.stringify([CREATION_FLOWS, CREATION_STRINGS.flows, CREATION_STRINGS.planner])
    expect(all).not.toContain('vérification')
    expect(all).not.toContain('relancer')
  })
})

describe('nextConnectionStep', () => {
  const graphOf = (s: TpState): ConnectionGraph => {
    const g = new ConnectionGraph(registry, s.instances.map((i) => ({ instanceId: i.id, deviceId: i.deviceId })))
    for (const c of s.connections) g.connect(c.a, c.b)
    return g
  }
  const dirOf = (s: TpState, ref: { instance: string; port: string }): string | undefined => {
    const deviceId = s.instances.find((i) => i.id === ref.instance)?.deviceId ?? ''
    return registry.deviceById.get(deviceId)?.ports.find((p) => p.portId === ref.port)?.dir
  }

  it('is null on an empty bench and with one device', () => {
    expect(nextConnectionStep(stateOf([]), registry)).toBeNull()
    expect(nextConnectionStep(stateOf([['ql1', 'yamaha-ql1']]), registry)).toBeNull()
  })

  it('a mic and a console: the mic output to the console input, free ports, opposite directions, different devices, accepted by the app', () => {
    const s = stateOf([
      ['ql1', 'yamaha-ql1'],
      ['mic', 'shure-sm58'],
    ])
    const step = nextConnectionStep(s, registry)!
    expect(step).not.toBeNull()
    expect(step.from).toEqual({ instance: 'mic', port: 'out-xlr' })
    expect(step.to.instance).toBe('ql1')
    expect(step.to.port).toMatch(/^in-mic-/)
    expect(step.from.instance).not.toBe(step.to.instance)
    expect(dirOf(s, step.from)).toBe('out')
    expect(dirOf(s, step.to)).toBe('in')
    expect(graphOf(s).canConnect(step.from, step.to).ok).toBe(true)
    expect(step.say).toBe(TP_STRINGS.flows['premier-montage'].steps.connect)
  })

  it('skips ports that already have a cable, and moves to the next free input', () => {
    const s = stateOf(
      [
        ['ql1', 'yamaha-ql1'],
        ['mic', 'shure-sm58'],
        ['mic2', 'shure-sm57'],
      ],
      [{ a: { instance: 'mic', port: 'out-xlr' }, b: { instance: 'ql1', port: 'in-mic-1' } }],
    )
    const step = nextConnectionStep(s, registry)!
    expect(step.from).toEqual({ instance: 'mic2', port: 'out-xlr' })
    expect(step.to).toEqual({ instance: 'ql1', port: 'in-mic-2' })
    expect(graphOf(s).canConnect(step.from, step.to).ok).toBe(true)
  })

  it('is null when every compatible port is taken', () => {
    const s = stateOf(
      [
        ['ql1', 'yamaha-ql1'],
        ['mic', 'shure-sm58'],
      ],
      [{ a: { instance: 'ql1', port: 'in-mic-1' }, b: { instance: 'mic', port: 'out-xlr' } }],
    )
    expect(nextConnectionStep(s, registry)).toBeNull()
  })

  it('is null for an incompatible pair (a mic and a loudspeaker: signal and connector differ), and for two mics', () => {
    expect(nextConnectionStep(stateOf([['mic', 'shure-sm58'], ['spk', 'qsc-k12-2']]), registry)).toBeNull()
    expect(nextConnectionStep(stateOf([['a', 'shure-sm58'], ['b', 'shure-sm57']]), registry)).toBeNull()
  })

  it('ignores an instance of a device the catalog does not know, and never throws on malformed input', () => {
    const s = stateOf([['mic', 'shure-sm58'], ['ql1', 'yamaha-ql1']])
    s.instances.push({ id: 'ghost', deviceId: 'no-such-device', label: 'x' })
    expect(nextConnectionStep(s, registry)).not.toBeNull()
    expect(nextConnectionStep(null as unknown as TpState, registry)).toBeNull()
    expect(nextConnectionStep(s, null as never)).toBeNull()
  })

  it('prefers an audio cable to a mains cable, and suggests the mains cable only when it is the only one', () => {
    const audio = nextConnectionStep(stateOf([['strip', 'multiprise-secteur'], ['mic', 'shure-sm58'], ['ql1', 'yamaha-ql1']]), registry)!
    expect(audio.from.instance).toBe('mic')
    const mains = nextConnectionStep(stateOf([['strip', 'multiprise-secteur'], ['ql1', 'yamaha-ql1']]), registry)!
    expect(mains.from).toEqual({ instance: 'strip', port: 'out-1' })
    expect(mains.to).toEqual({ instance: 'ql1', port: 'power-in' })
  })

  it('never returns a pair the app refuses (R1 to R3), for EVERY pair of catalog devices, and finds one whenever the app accepts one', () => {
    const devices = [...registry.deviceById.values()]
    let withStep = 0
    for (const a of devices)
      for (const b of devices) {
        const s = stateOf([
          ['a', a.id],
          ['b', b.id],
        ])
        const step = nextConnectionStep(s, registry)
        const g = graphOf(s)
        // brute force: is there any out -> in pair the app accepts between two different devices?
        let possible = false
        for (const [x, y] of [['a', 'b'], ['b', 'a']] as const)
          for (const px of registry.deviceById.get(x === 'a' ? a.id : b.id)!.ports)
            for (const py of registry.deviceById.get(y === 'a' ? a.id : b.id)!.ports)
              if (px.dir === 'out' && py.dir === 'in' && g.canConnect({ instance: x, port: px.portId }, { instance: y, port: py.portId }).ok) possible = true
        if (step === null) {
          expect(possible, `${a.id} + ${b.id}`).toBe(false)
          continue
        }
        withStep++
        expect(step.from.instance).not.toBe(step.to.instance)
        expect(dirOf(s, step.from)).toBe('out')
        expect(dirOf(s, step.to)).toBe('in')
        expect(g.canConnect(step.from, step.to), `${a.id} + ${b.id}`).toEqual({ ok: true })
      }
    expect(withStep).toBeGreaterThan(20)
  })
})

describe('firstPhantom', () => {
  it('is the first device holding a phantom-48v control, else null', () => {
    const s = stateOf([['ql1', 'yamaha-ql1'], ['isa', 'focusrite-isa-one'], ['isa2', 'focusrite-isa-one']])
    expect(firstPhantom(s)).toEqual({ instance: 'isa', control: 'phantom-48v' })
    expect(firstPhantom(stateOf([['ql1', 'yamaha-ql1']]))).toBeNull()
    expect(firstPhantom(stateOf([]))).toBeNull()
  })
  it('a control named after an inherited property is not a phantom switch', () => {
    const s = stateOf([['x', 'yamaha-ql1']])
    expect(firstPhantom(s)).toBeNull()
    expect(firstPhantom({ ...s, controls: { x: Object.create({ 'phantom-48v': true }) } })).toBeNull()
  })
})
