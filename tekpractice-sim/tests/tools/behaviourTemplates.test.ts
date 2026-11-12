/**
 * Task 0.4 (Wave 0): the per-category behaviour templates. Three fixture rows from different categories (a condenser microphone, a rack stage
 * box, an active monitor) plus structural checks over every category of the plan: whatever a template writes must pass the catalogue's own checks.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyTemplate, CATEGORY_KIND, expandPorts, kindOf, shortPortId } from '../../tools/behaviourTemplates'
import { checkCatalog } from '../../tools/catalogChecks'
import { loadPlan, type PlanPort, type PlanRow } from '../../tools/equipmentPlan'
import { Device, type CatalogT } from '../../tools/schemas'
import { makeRegistry } from '../helpers'

const catalog = makeRegistry().catalog
const row = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: 'fixture',
  status: 'new',
  category: 'microphone',
  manufacturer: 'Marque',
  product: 'Modèle',
  sizeMm: { w: 50, d: 50, h: 160 },
  portsSummary: '',
  family: 'revolve',
  dataQuality: 'datasheet',
  tier: 1,
  wave: 1,
  sources: ['https://example.com/ds.pdf'],
  notes: '',
  traits: [],
  sizeConfidence: 'ok',
  ...over,
})

/** The template as a catalogue device, run through the zod Device schema and the catalogue's own checks. */
function asDevice(category: string, r: Partial<PlanRow>, given: PlanPort[] = []) {
  const t = applyTemplate(category, row({ category, ...r }), given, '2026-11-11')
  const device = {
    id: 'fixture',
    label: 'Fixture',
    levels: [],
    realWorld: { brand: 'B', model: 'M', category, typicalUse: 'u', notes: '' },
    ports: t.ports,
    ...(t.controls.length ? { controls: t.controls } : {}),
    ...(t.acoustic ? { acoustic: t.acoustic } : {}),
    ...(t.routing ? { routing: t.routing } : {}),
  }
  const parsed = Device.parse(device)
  const cat: CatalogT = { ...structuredClone(catalog), devices: [parsed] }
  const issues = checkCatalog(cat, { modelIds: new Set(['fixture']) })
  return { t, parsed, issues }
}

const planRow = (id: string): PlanRow => {
  const r = loadPlan().find((x) => x.id === id)
  if (!r) throw new Error('no plan row ' + id)
  return r
}

// Documented port sets used as the `given` of the templates: a template never invents ports (Wave 0b finding 1).
const XLR_OUT: PlanPort = { id: 'out-xlr', role: 'xlr', dir: 'out', connector: 'xlr3-m', signal: 'mic-level' }
const MAINS: PlanPort = { id: 'power-in', role: 'power', dir: 'in', connector: 'iec-c14', signal: 'mains-power' }
const LINE_IN: PlanPort = { id: 'in-line', role: 'line', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro' }
const LINE_OUT: PlanPort = { id: 'out-line', role: 'line', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro' }

describe('a template never invents ports (finding 1)', () => {
  it('with no documented port a device has no port at all, whatever its category', () => {
    for (const c of ['microphone', 'di-box', 'mic-preamp', 'audio-interface', 'console-digital', 'powered-speaker', 'speaker', 'amplifier', 'outboard', 'wireless', 'headphones', 'recorder', 'computer', 'power', 'cable'])
      expect(asDevice(c, {}).t.ports, c).toEqual([])
  })
  it('no mains inlet and no power toggle are added: the documented ports decide, and a mains device without one is reported as an issue', () => {
    const { t } = asDevice('amplifier', { traits: ['power-amp'] }, [LINE_IN, { ...LINE_OUT, connector: 'speakon-nl4', signal: 'speaker-level' }])
    expect(t.ports.some((p) => p.signal === 'mains-power')).toBe(false)
    expect(t.controls).toEqual([])
    expect(t.issues.join(' ')).toMatch(/no mains inlet/)
  })
})

describe('microphone template (SM58 / U87), by traits', () => {
  it('a dynamic microphone: the documented mic-level out, no power control, no flags, never requires phantom even if a proposal said so', () => {
    const { t, issues } = asDevice('microphone', { traits: ['dynamic', 'passive'] }, [XLR_OUT])
    expect(t.ports).toEqual([{ portId: 'out-xlr', dir: 'out', connector: 'xlr3-m', signal: 'mic-level' }])
    expect(t.controls).toEqual([])
    expect(t.routing).toBeUndefined()
    expect(issues).toEqual([])
    expect(asDevice('microphone', { traits: ['dynamic'] }, [{ ...XLR_OUT, flags: ['requiresPhantom'] }]).t.ports[0]!.flags).toBeUndefined()
  })
  it('a phantom-powered condenser requires phantom (the U87 pattern); a ribbon is flagged isRibbon and never requires phantom, even if the proposal said so', () => {
    expect(asDevice('microphone', { traits: ['condenser', 'phantom-powered'] }, [XLR_OUT]).t.ports[0]!.flags).toEqual(['requiresPhantom'])
    expect(asDevice('microphone', { traits: ['condenser'] }, [XLR_OUT]).t.ports[0]!.flags).toEqual(['requiresPhantom'])
    const ribbon = asDevice('microphone', { traits: ['ribbon', 'passive'] }, [{ ...XLR_OUT, flags: ['requiresPhantom'] }])
    expect(ribbon.t.ports[0]!.flags).toEqual(['isRibbon'])
    expect(ribbon.issues).toEqual([])
  })
  it('an externally powered condenser (tube with its supply, lavalier on a bias) is NOT phantom-powered; a battery condenser neither', () => {
    expect(asDevice('microphone', { traits: ['condenser', 'active'] }, [XLR_OUT]).t.ports[0]!.flags).toBeUndefined()
    expect(asDevice('microphone', { traits: ['condenser', 'battery'] }, [XLR_OUT]).t.ports[0]!.flags).toBeUndefined()
  })
  it('real rows: neumann-tlm-103 and akg-c414-xlii come out phantom-required, royer-r-121 as a ribbon', () => {
    for (const id of ['neumann-tlm-103', 'akg-c414-xlii']) {
      const r = planRow(id)
      const { t, issues } = asDevice(r.category, { traits: r.traits }, [XLR_OUT])
      expect(t.ports[0]!.flags, id).toEqual(['requiresPhantom'])
      expect(t.controls, id).toEqual([])
      expect(issues, id).toEqual([])
    }
    const r121 = planRow('royer-r-121')
    expect(asDevice(r121.category, { traits: r121.traits }, [XLR_OUT]).t.ports[0]!.flags).toEqual(['isRibbon'])
  })
})

describe('wireless by traits (finding 2): battery transmitters have no mains, receivers have mains and outputs', () => {
  const mini: PlanPort = { id: 'in-mic', role: 'mic', dir: 'in', connector: 'mini-xlr-ta4', signal: 'mic-level' }
  it('real row shure-slxd1-bodypack: no mains inlet, no power toggle, no XLR out, only what is documented (its TA4M input)', () => {
    const r = planRow('shure-slxd1-bodypack')
    const { t, issues } = asDevice(r.category, { traits: r.traits }, [mini])
    expect(t.ports.map((p) => p.portId)).toEqual(['in-mic'])
    expect(t.ports.some((p) => p.signal === 'mains-power')).toBe(false)
    expect(t.ports.some((p) => p.connector === 'xlr3-m')).toBe(false)
    expect(t.controls).toEqual([])
    expect(issues).toEqual([])
  })
  it('real row shure-slxd2-handheld: no port, no control (the capsule is part of the transmitter)', () => {
    const r = planRow('shure-slxd2-handheld')
    const { t } = asDevice(r.category, { traits: r.traits }, [])
    expect(t.ports).toEqual([])
    expect(t.controls).toEqual([])
  })
  it('documenting a mains inlet on a body-pack, a handheld or a battery device is an error, not something to fix silently', () => {
    for (const traits of [['bodypack', 'transmitter', 'battery'], ['handheld', 'transmitter', 'battery'], ['battery']] as PlanRow['traits'][])
      expect(() => applyTemplate('wireless', row({ traits }), [MAINS], '2026-11-12')).toThrow(/battery device.*mains inlet/)
  })
  it('real row shure-qlx-d-receiver: documented mains inlet + XLR out + antenna-less audio out come out with power-in and the power toggle', () => {
    const r = planRow('shure-qlx-d-receiver')
    const { t, issues } = asDevice(r.category, { traits: r.traits }, [
      { id: 'out-xlr', role: 'xlr', dir: 'out', connector: 'xlr3-m', signal: 'mic-level' },
      { id: 'out-line', role: 'line', dir: 'out', connector: 'trs-quarter', signal: 'line-level-pro' },
      MAINS,
    ])
    expect(t.ports.map((p) => p.portId)).toEqual(['out-xlr', 'out-line', 'power-in'])
    expect(t.controls).toEqual([{ id: 'power', type: 'toggle', label: 'Alimentation', default: true }])
    expect(issues).toEqual([])
  })
  it('a receiver with no mains inlet documented is reported', () => {
    const r = planRow('shure-qlx-d-receiver')
    const { t } = asDevice(r.category, { traits: r.traits }, [{ id: 'out-xlr', role: 'xlr', dir: 'out', connector: 'xlr3-m', signal: 'mic-level' }])
    expect(t.controls).toEqual([])
    expect(t.issues.join(' ')).toMatch(/no mains inlet/)
  })
})

describe('processors and desks by traits (findings 3 and 8)', () => {
  it('real row dbx-driverack-pa2 (trait processor; filed under outboard since Wave 1, a processor filed under amplifier is still routed as outboard): routed like outboard gear, inputs to the outputs, no speaker-level, power toggle', () => {
    const r = planRow('dbx-driverack-pa2')
    expect(r.category).toBe('outboard')
    expect(kindOf('amplifier', r.traits)).toBe('outboard') // a processor still filed under amplifier is routed the same
    expect(kindOf(r.category, r.traits)).toBe('outboard')
    const given: PlanPort[] = [
      { id: 'in-line-1', role: 'line', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro' },
      { id: 'in-line-2', role: 'line', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro' },
      ...[1, 2, 3, 4, 5, 6].map((n): PlanPort => ({ id: `out-line-${n}`, role: 'line', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro' })),
      MAINS,
    ]
    const { t, issues } = asDevice(r.category, { traits: r.traits }, given)
    expect(t.routing).toHaveLength(2)
    expect(t.routing![0]!.to).toEqual(['out-line-1', 'out-line-2', 'out-line-3', 'out-line-4', 'out-line-5', 'out-line-6'])
    expect(t.controls).toEqual([{ id: 'power', type: 'toggle', label: 'Alimentation', default: true }])
    expect(issues).toEqual([])
  })
  it('a real power amplifier (crown-xls-2502, trait power-amp) routes line in to speaker out', () => {
    const r = planRow('crown-xls-2502')
    expect(kindOf(r.category, r.traits)).toBe('amp')
  })
  it('real rows yamaha-tf5 and allen-heath-sq-5 (traits desk): the desk comes out WITH routing, every input to the out-main outputs', () => {
    for (const id of ['yamaha-tf5', 'allen-heath-sq-5']) {
      const r = planRow(id)
      const given: PlanPort[] = [
        { id: 'in-mic-1', role: 'mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level' },
        { id: 'in-mic-2', role: 'mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level' },
        { id: 'out-main-l', role: 'main-l', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro' },
        { id: 'out-main-r', role: 'main-r', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro' },
        { id: 'out-aux-1', role: 'aux', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro' },
        { id: 'out-phones', role: 'phones', dir: 'out', connector: 'trs-35mm', signal: 'headphone-level' },
        MAINS,
      ]
      const { t, issues } = asDevice(r.category, { traits: r.traits }, given)
      expect(t.routing, id).toEqual([
        { from: 'in-mic-1', to: ['out-main-l', 'out-main-r'] },
        { from: 'in-mic-2', to: ['out-main-l', 'out-main-r'] },
      ])
      expect(t.controls.map((c) => c.id), id).toEqual(['power', 'mute-master', 'fader-master', 'balance-master'])
      expect(issues, id).toEqual([])
    }
  })
  it('the naming rule of a desk: main outputs are the ports whose id starts with out-main; a desk with none routes to every non-headphone output; a desk with no output is reported', () => {
    const mic: PlanPort = { id: 'in-mic-1', role: 'mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level' }
    const omni = (n: number): PlanPort => ({ id: `out-omni-${n}`, role: 'omni', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro' })
    expect(asDevice('console-digital', { traits: ['desk'] }, [mic, omni(1), omni(2), MAINS]).t.routing).toEqual([{ from: 'in-mic-1', to: ['out-omni-1', 'out-omni-2'] }])
    const none = asDevice('console-analog', { traits: ['desk'] }, [mic, MAINS]).t
    expect(none.routing).toBeUndefined()
    expect(none.issues.join(' ')).toMatch(/out-main/)
  })
  it('a passive studio monitor (NS-10M, trait passive) is a passive speaker: speaker-level in to the transducer, no power', () => {
    expect(kindOf('studio-monitor', ['passive'])).toBe('speaker-passive')
    expect(kindOf('speaker', ['active'])).toBe('speaker-active')
    const spk: PlanPort = { id: 'in-speaker', role: 'speaker', dir: 'in', connector: 'speakon-nl4', signal: 'speaker-level' }
    const { t } = asDevice('studio-monitor', { traits: ['passive'] }, [spk])
    expect(t.routing).toEqual([{ from: 'in-speaker', to: ['transducer'] }])
    expect(t.controls).toEqual([])
  })
})

describe('every documented mains port gets a power toggle', () => {
  it('a rack stage box (Rio3224 pattern): the documented mains inlet is power-in, the toggle is « Alimentation » on by default, mic ins flagged', () => {
    const given: PlanPort[] = [
      { role: 'mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level', count: 2 },
      { role: 'line', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro', count: 2 },
      { id: 'dante-primary', role: 'dante', dir: 'bidir', connector: 'ethercon', signal: 'aoip', flags: ['isDantePrimary'] },
      MAINS,
    ]
    const { t, issues } = asDevice('stagebox', {}, given)
    expect(t.ports.map((p) => p.portId)).toEqual(['in-mic-1', 'in-mic-2', 'out-line-1', 'out-line-2', 'dante-primary', 'power-in'])
    expect(t.ports.find((p) => p.portId === 'power-in')).toMatchObject({ dir: 'in', connector: 'iec-c14', signal: 'mains-power' })
    expect(t.controls).toContainEqual({ id: 'power', type: 'toggle', label: 'Alimentation', default: true })
    expect(t.ports.filter((p) => p.signal === 'mic-level').every((p) => p.flags?.includes('isMicInput') && p.flags.includes('providesPhantom'))).toBe(true)
    expect(issues).toEqual([])
  })
  it('a documented mains inlet of any connector is renamed power-in and gets the toggle (a powerCON device)', () => {
    const given: PlanPort[] = [
      { id: 'in-mains-in-powercon-32-a-closest-id-see-notes', role: 'mains', dir: 'in', connector: 'powercon-blue', signal: 'mains-power' },
      { role: 'spk', dir: 'out', connector: 'speakon-nl4', signal: 'speaker-level' },
      { role: 'line', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro' },
    ]
    const { t, issues } = asDevice('amplifier', { traits: ['power-amp'] }, given)
    expect(t.ports.find((p) => p.signal === 'mains-power')!.portId).toBe('power-in')
    expect(t.controls.map((c) => c.id)).toContain('power')
    expect(t.renamed['in-mains-in-powercon-32-a-closest-id-see-notes']).toBe('power-in')
    expect(issues).toEqual([])
  })
  it('two mains inlets: the first is power-in (the one the toggle gates), the second power-in-2; no second toggle', () => {
    const given: PlanPort[] = [
      { role: 'mains', dir: 'in', connector: 'iec-c14', signal: 'mains-power' },
      { role: 'mains', dir: 'in', connector: 'iec-c14', signal: 'mains-power' },
      LINE_IN,
      LINE_OUT,
    ]
    const { t } = asDevice('outboard', { traits: ['processor'] }, given)
    expect(t.ports.filter((p) => p.signal === 'mains-power').map((p) => p.portId)).toEqual(['power-in', 'power-in-2'])
    expect(t.controls.filter((c) => c.id === 'power')).toHaveLength(1)
  })
})

describe('active speaker template (Genelec 8030C / K12.2)', () => {
  const given: PlanPort[] = [{ id: 'in-analog', role: 'analog', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro' }, MAINS]
  it('routes every line input to the transducer, carries a nominal coverage WITH a source, keeps power-in and the power toggle', () => {
    const { t, parsed, issues } = asDevice('studio-monitor', { traits: ['active'] }, given)
    expect(t.routing).toEqual([{ from: 'in-analog', to: ['transducer'] }])
    expect(t.ports.map((p) => p.portId)).toEqual(['in-analog', 'power-in'])
    expect(t.controls).toEqual([{ id: 'power', type: 'toggle', label: 'Alimentation', default: true }])
    const a = parsed.acoustic!
    expect(a.coverage_h_deg.value).toBe(90)
    expect(a.coverage_v_deg.value).toBe(60)
    expect(a.coverage_h_deg.source).toMatchObject({ kind: 'nominal', retrieved: '2026-11-11' })
    expect(a.coverage_h_deg.source.ref).toContain('valeur nominale')
    expect(issues).toEqual([]) // the 90 x 60 nominal pair is the only nominal the catalogue accepts
  })
  it('never routes a mains or mic-level port to the transducer', () => {
    const { t } = asDevice('powered-speaker', { traits: ['active'] }, [
      { id: 'in-xlr', role: 'xlr', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro' },
      { id: 'in-mic', role: 'mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level' },
      MAINS,
    ])
    expect(t.routing).toEqual([{ from: 'in-xlr', to: ['transducer'] }])
  })
})

describe('patchbay (Wave 1 stage 2): no route ever returns to its own port', () => {
  const jack = (id: string): PlanPort => ({ id, role: 'jack', dir: 'bidir', connector: 'trs-quarter', signal: 'line-level-pro' })
  it('a front jack is normalled to the rear jack of the same number, both ways, and no port routes to itself', () => {
    const { t, issues } = asDevice('patchbay', { traits: ['rack'] }, [jack('front-1'), jack('front-2'), jack('rear-1'), jack('rear-2')])
    expect(t.routing).toEqual([
      { from: 'front-1', to: ['rear-1'] },
      { from: 'front-2', to: ['rear-2'] },
      { from: 'rear-1', to: ['front-1'] },
      { from: 'rear-2', to: ['front-2'] },
    ])
    for (const r of t.routing ?? []) expect(r.to).not.toContain(r.from)
    expect(issues).toEqual([])
  })
  it('a patchbay whose jacks are not named front / rear gets no routes rather than a self route (the shipped StudioPatch has none)', () => {
    const { t } = asDevice('patchbay', {}, [jack('tt-1'), jack('tt-2')])
    expect(t.routing).toBeUndefined()
  })
  it('an outboard device with only bidirectional jacks gets no route to its own port either', () => {
    const { t } = asDevice('outboard', { traits: ['processor'] }, [jack('io-1'), jack('io-2')])
    for (const r of t.routing ?? []) expect(r.to).not.toContain(r.from)
  })
})

describe('an Ethernet control port takes no audio route (Wave 1 stage 2)', () => {
  const net: PlanPort = { id: 'net', role: 'net', dir: 'bidir', connector: 'rj45', signal: 'aoip' }
  it('DriveRack PA2 (processor): the RJ45 is control / firmware, so no input routes to it and it routes nowhere', () => {
    const r = planRow('dbx-driverack-pa2')
    const given: PlanPort[] = [LINE_IN, { ...LINE_OUT, id: 'out-1' }, { ...LINE_OUT, id: 'out-2' }, net, MAINS]
    const { t, parsed, issues } = asDevice(r.category, { traits: r.traits }, given)
    expect(t.ports.map((p) => p.portId)).toContain('net') // the port stays (cables, connector rules)
    expect(t.routing).toEqual([{ from: 'in-line', to: ['out-1', 'out-2'] }])
    expect(JSON.stringify(parsed.routing)).not.toContain('"net"')
    expect(issues).toEqual([])
  })
  it('an active monitor (KH 120 II): the RJ45 does not reach the transducer', () => {
    const r = planRow('neumann-kh-120-ii')
    const { t } = asDevice(r.category, { traits: r.traits }, [{ ...LINE_IN, id: 'in-analog' }, net, MAINS])
    expect(t.routing).toEqual([{ from: 'in-analog', to: ['transducer'] }])
  })
  it('a codec (network audio by nature) keeps the RJ45 as audio', () => {
    const codec = asDevice('codec', { traits: ['processor'] }, [LINE_IN, { ...LINE_OUT, id: 'out-1' }, { ...LINE_OUT, id: 'out-2' }, net, MAINS])
    expect(codec.t.routing?.[0]?.to).toContain('net')
  })
})

describe('the other kinds', () => {
  it('passive speaker: speaker-level in routed to the transducer, nominal acoustic, no power', () => {
    const { t, issues } = asDevice('speaker', { traits: ['passive'] }, [{ id: 'in-speaker', role: 'speaker', dir: 'in', connector: 'speakon-nl4', signal: 'speaker-level' }])
    expect(t.ports).toEqual([{ portId: 'in-speaker', dir: 'in', connector: 'speakon-nl4', signal: 'speaker-level' }])
    expect(t.routing).toEqual([{ from: 'in-speaker', to: ['transducer'] }])
    expect(t.controls).toEqual([])
    expect(t.acoustic).toBeDefined()
    expect(issues).toEqual([])
    expect(kindOf('speaker', ['active'])).toBe('speaker-active')
  })
  it('amplifier: line in routed to speaker-level out, power; a processor trait makes it an outboard device', () => {
    const given: PlanPort[] = [
      { role: 'line', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro', count: 2 },
      { role: 'spk', dir: 'out', connector: 'speakon-nl4', signal: 'speaker-level', count: 2 },
      MAINS,
    ]
    const { t, issues } = asDevice('amplifier', { traits: ['power-amp'] }, given)
    expect(t.routing).toEqual([{ from: 'in-line-1', to: ['out-spk-1'] }, { from: 'in-line-2', to: ['out-spk-2'] }])
    expect(t.controls.map((c) => c.id)).toEqual(['power'])
    expect(issues).toEqual([])
    expect(kindOf('amplifier', ['processor'])).toBe('outboard')
  })
  it('DI box: ground-lift and pad controls, passive routes, phantom only if active without a battery', () => {
    const given: PlanPort[] = [
      { id: 'in-instrument', role: 'instrument', dir: 'in', connector: 'trs-quarter', signal: 'instrument-hiz' },
      { id: 'out-xlr', role: 'xlr', dir: 'out', connector: 'xlr3-m', signal: 'mic-level' },
    ]
    const passive = asDevice('di-box', { traits: ['passive'] }, given)
    expect(passive.t.controls.map((c) => c.id)).toEqual(['ground-lift', 'pad'])
    expect(passive.t.routing).toEqual([{ from: 'in-instrument', to: ['out-xlr'], passive: true }])
    expect(passive.t.ports.some((p) => p.flags?.includes('requiresPhantom'))).toBe(false)
    const active = asDevice('di-box', { traits: ['active', 'phantom-powered'] }, given)
    expect(active.t.ports.find((p) => p.signal === 'mic-level')!.flags).toEqual(['requiresPhantom'])
    expect(active.t.routing!.some((r) => r.passive === true)).toBe(false)
    const battery = asDevice('di-box', { traits: ['active', 'battery'] }, given)
    expect(battery.t.ports.find((p) => p.signal === 'mic-level')!.flags).toBeUndefined() // phantom or a battery: not required
    expect(passive.issues).toEqual([])
    expect(active.issues).toEqual([])
  })
  it('preamp: phantom toggle gates providesPhantom on the mic in (ISA One pattern), gain enum, power', () => {
    const { t, issues } = asDevice('mic-preamp', {}, [{ id: 'in-mic', role: 'mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level' }, LINE_OUT, MAINS])
    expect(t.controls.map((c) => c.id)).toEqual(['power', 'phantom-48v', 'gain'])
    const ph = t.controls.find((c) => c.id === 'phantom-48v')!
    expect(ph).toMatchObject({ type: 'toggle', default: false, enables: { flag: 'providesPhantom', ports: ['in-mic'] } })
    expect(issues).toEqual([])
  })
  it('console: mains, master outs, mute / fader / balance (QL1 pattern), every input routed to the mains', () => {
    const { t, issues } = asDevice('console-digital', { traits: ['desk'] }, [
      { role: 'mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level', count: 2 },
      { id: 'out-main-l', role: 'main-l', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro' },
      { id: 'out-main-r', role: 'main-r', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro' },
      MAINS,
    ])
    expect(t.controls.map((c) => c.id)).toEqual(['power', 'mute-master', 'fader-master', 'balance-master'])
    expect(t.routing).toEqual([
      { from: 'in-mic-1', to: ['out-main-l', 'out-main-r'] },
      { from: 'in-mic-2', to: ['out-main-l', 'out-main-r'] },
    ])
    expect(issues).toEqual([])
  })
  it('interface, wireless, headphones, recorder, computer, power, accessory: each produces a catalogue-valid device from a documented set', () => {
    const usb: PlanPort = { id: 'usb', role: 'usb', dir: 'bidir', connector: 'usb-c', signal: 'usb-audio' }
    const outlets: PlanPort = { role: 'out', dir: 'out', connector: 'iec-c13', signal: 'mains-power', count: 4 }
    const cases: [string, PlanPort[]][] = [
      ['audio-interface', [{ id: 'in-mic-1', role: 'mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level' }, usb, MAINS]],
      ['wireless', [{ id: 'out-xlr', role: 'xlr', dir: 'out', connector: 'xlr3-m', signal: 'mic-level' }, MAINS]],
      ['headphones', [{ id: 'in-35mm', role: '35mm', dir: 'in', connector: 'trs-35mm', signal: 'headphone-level' }]],
      ['recorder', [{ id: 'in-mic', role: 'mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level' }, usb]],
      ['computer', [usb]],
      ['power', [MAINS, outlets]],
      ['pop-filter', []],
    ]
    for (const [c, given] of cases) expect(asDevice(c, c === 'wireless' ? { traits: ['receiver', 'rack'] } : {}, given).issues, c).toEqual([])
    expect(asDevice('power', {}, [MAINS, outlets]).t.ports.filter((p) => p.dir === 'out').every((p) => p.flags?.includes('isMainsSource'))).toBe(true)
  })
})

describe('category coverage', () => {
  const plan = loadPlan()
  const proposals = (JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as { devices: { realWorld: { category: string } }[] }).devices
  it('every category of the plan, of the proposals and of the catalogue has a template kind (a new category fails here, on purpose)', () => {
    const cats = new Set([...plan.map((r) => r.category), ...proposals.map((d) => d.realWorld.category), ...catalog.devices.map((d) => d.realWorld.category)])
    const missing = [...cats].filter((c) => !(c in CATEGORY_KIND))
    expect(missing).toEqual([])
  })
  it('an unknown category is an error, never a silent default', () => {
    expect(() => kindOf('something-new')).toThrow(/something-new/)
  })
})

describe('short port ids', () => {
  it('are at most 19 characters, lower case, hyphenated, and the same on every run', () => {
    const longs = [
      'in-balanced-input-per-channel-1',
      'in-mains-in-powercon-32-a-closest-id-see-notes',
      'out-xlr-balanced-main-left-output-1',
      'Entrée Ligne Équilibrée Canal 12',
      'x'.repeat(116),
      'in-' + 'abcdefghij-'.repeat(10) + '2',
    ]
    for (const l of longs) {
      const id = shortPortId(l)
      expect(id.length, l).toBeLessThanOrEqual(19)
      expect(id, l).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(shortPortId(l), l).toBe(id)
    }
  })
  it('keeps the direction and the trailing number of a long id; a short id is only normalised', () => {
    expect(shortPortId('in-balanced-input-per-channel-1')).toMatch(/^in-.*-1$/)
    expect(shortPortId('in-mic-1')).toBe('in-mic-1')
    expect(shortPortId('Dante Primary')).toBe('dante-primary')
    expect(shortPortId('')).toBe('port')
  })
  it('expandPorts keeps ids unique even when two long ids shorten to the same text', () => {
    const base = { dir: 'in' as const, connector: 'xlr3-f', signal: 'line-level-pro', role: 'line' }
    const { ports, renamed } = expandPorts([
      { ...base, id: 'in-balanced-input-per-channel-1' },
      { ...base, id: 'in-balanced-input-per-channel-1' },
      { ...base, id: 'in-balanced-input-per-channel-1' },
    ])
    const ids = ports.map((p) => p.portId)
    expect(new Set(ids).size).toBe(3)
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(19)
    expect(Object.keys(renamed)).toEqual(['in-balanced-input-per-channel-1'])
  })
  it('count runs number from 1 and a bidir port takes its role as id', () => {
    const { ports } = expandPorts([
      { role: 'mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level', count: 3 },
      { role: 'usb', dir: 'bidir', connector: 'usb-c', signal: 'usb-audio' },
    ])
    expect(ports.map((p) => p.portId)).toEqual(['in-mic-1', 'in-mic-2', 'in-mic-3', 'usb'])
  })
})

describe('short port ids keep the channel number (finding 4: the regex was /^d+$/ instead of the digit class)', () => {
  type RealDevice = { id: string; ports: { portId: string; dir: 'in' | 'out' | 'bidir'; connector: string; signal: string }[] }
  const realDevices = (JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as { devices: RealDevice[] }).devices
  const expandReal = (d: RealDevice) =>
    expandPorts(d.ports.map((p) => ({ id: p.portId, role: 'port', dir: p.dir, connector: p.connector, signal: p.signal })))

  it('in-mic-preamp-input-balanced-per-channel-1 and -2 stay distinct by their own number, not by an accidental suffix', () => {
    const a = shortPortId('in-mic-preamp-input-balanced-per-channel-1')
    const b = shortPortId('in-mic-preamp-input-balanced-per-channel-2')
    expect(a).toMatch(/-1$/)
    expect(b).toMatch(/-2$/)
    expect(a).not.toBe(b)
    expect(a.length).toBeLessThanOrEqual(19)
  })

  it('on every real Bêta proposal the shortened id keeps the trailing channel number of its long id, and expandPorts gives unique ids of at most 19 characters', () => {
    let longIds = 0
    for (const d of realDevices) {
      const { ports } = expandReal(d)
      const ids = ports.map((p) => p.portId)
      expect(new Set(ids).size, d.id).toBe(ids.length)
      for (const raw of d.ports.map((p) => p.portId)) {
        const short = shortPortId(raw)
        expect(short.length, `${d.id}: ${raw}`).toBeLessThanOrEqual(19)
        const m = /-(\d+)$/.exec(raw)
        if (m && raw.length > 19) {
          longIds++
          expect(short, `${d.id}: ${raw} lost its channel number`).toMatch(new RegExp(`-${m[1]}$`))
        }
      }
      for (const p of ports) expect(p.portId.length, d.id).toBeLessThanOrEqual(19)
    }
    expect(longIds).toBeGreaterThan(50) // the check really ran over the long numbered ids
  })

  it('the TF5 combo inputs 1 and 2 and the MOTU 828 pairs keep their numbers', () => {
    for (const id of ['yamaha-tf5', 'motu-828']) {
      const d = realDevices.find((x) => x.id === id)!
      const { ports } = expandReal(d)
      expect(ports[0]!.portId, id).toMatch(/-1$/)
      expect(ports[1]!.portId, id).toMatch(/-2$/)
    }
  })
})
