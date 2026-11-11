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

describe('microphone template (SM58 / U87)', () => {
  it('a dynamic microphone: one mic-level out, no power control, no flags', () => {
    const { t, issues } = asDevice('microphone', {})
    expect(t.ports).toEqual([{ portId: 'out-xlr', dir: 'out', connector: 'xlr3-m', signal: 'mic-level' }])
    expect(t.controls).toEqual([])
    expect(t.routing).toBeUndefined()
    expect(issues).toEqual([])
  })
  it('a condenser requires phantom (the U87 pattern); a ribbon is flagged isRibbon and never requires phantom, even if the proposal said so', () => {
    expect(asDevice('microphone', { traits: ['condenser'] }).t.ports[0]!.flags).toEqual(['requiresPhantom'])
    const ribbon = asDevice('microphone', { traits: ['ribbon'] }, [{ role: 'xlr', dir: 'out', connector: 'xlr3-m', signal: 'mic-level', flags: ['requiresPhantom'] }])
    expect(ribbon.t.ports[0]!.flags).toEqual(['isRibbon'])
    expect(ribbon.issues).toEqual([])
  })
})

describe('every mains port gets a power toggle', () => {
  it('a rack stage box (Rio3224 pattern): mains inlet is power-in, the toggle is « Alimentation » on by default, mic ins flagged', () => {
    const given: PlanPort[] = [
      { role: 'mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level', count: 2 },
      { role: 'line', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro', count: 2 },
      { id: 'dante-primary', role: 'dante', dir: 'bidir', connector: 'ethercon', signal: 'aoip', flags: ['isDantePrimary'] },
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
    const { t, issues } = asDevice('amplifier', {}, given)
    expect(t.ports.find((p) => p.signal === 'mains-power')!.portId).toBe('power-in')
    expect(t.controls.map((c) => c.id)).toContain('power')
    expect(t.renamed['in-mains-in-powercon-32-a-closest-id-see-notes']).toBe('power-in')
    expect(issues).toEqual([])
  })
  it('two mains inlets: the first is power-in (the one the toggle gates), the second power-in-2; no second toggle', () => {
    const given: PlanPort[] = [
      { role: 'mains', dir: 'in', connector: 'iec-c14', signal: 'mains-power' },
      { role: 'mains', dir: 'in', connector: 'iec-c14', signal: 'mains-power' },
      { role: 'line', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro' },
      { role: 'line', dir: 'out', connector: 'xlr3-m', signal: 'line-level-pro' },
    ]
    const { t } = asDevice('outboard', {}, given)
    expect(t.ports.filter((p) => p.signal === 'mains-power').map((p) => p.portId)).toEqual(['power-in', 'power-in-2'])
    expect(t.controls.filter((c) => c.id === 'power')).toHaveLength(1)
  })
  it('a passive kind (microphone, DI, headphones, accessory) gets no mains inlet unless its documented ports list one', () => {
    for (const c of ['microphone', 'di-box', 'headphones', 'stand-arm']) expect(asDevice(c, {}).t.ports.some((p) => p.signal === 'mains-power'), c).toBe(false)
  })
})

describe('active speaker template (Genelec 8030C / K12.2)', () => {
  it('routes every line input to the transducer, carries a nominal coverage WITH a source, keeps power-in and the power toggle', () => {
    const { t, parsed, issues } = asDevice('studio-monitor', {})
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
    const { t } = asDevice('powered-speaker', {}, [
      { role: 'xlr', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro' },
      { role: 'mic', dir: 'in', connector: 'xlr3-f', signal: 'mic-level' },
    ])
    expect(t.routing).toEqual([{ from: 'in-xlr', to: ['transducer'] }])
  })
})

describe('the other kinds', () => {
  it('passive speaker: speaker-level in routed to the transducer, nominal acoustic, no power', () => {
    const { t, issues } = asDevice('speaker', {})
    expect(t.ports).toEqual([{ portId: 'in-speaker', dir: 'in', connector: 'speakon-nl4', signal: 'speaker-level' }])
    expect(t.routing).toEqual([{ from: 'in-speaker', to: ['transducer'] }])
    expect(t.controls).toEqual([])
    expect(t.acoustic).toBeDefined()
    expect(issues).toEqual([])
    expect(kindOf('speaker', ['active'])).toBe('speaker-active')
  })
  it('amplifier: line in routed to speaker-level out, power; a processor trait makes it an outboard device', () => {
    const { t, issues } = asDevice('amplifier', {})
    expect(t.routing).toEqual([{ from: 'in-line-1', to: ['out-spk-1'] }, { from: 'in-line-2', to: ['out-spk-2'] }])
    expect(t.controls.map((c) => c.id)).toEqual(['power'])
    expect(issues).toEqual([])
    expect(kindOf('amplifier', ['processor'])).toBe('outboard')
  })
  it('DI box: ground-lift and pad controls, passive routes, phantom only if active', () => {
    const passive = asDevice('di-box', {})
    expect(passive.t.controls.map((c) => c.id)).toEqual(['ground-lift', 'pad'])
    expect(passive.t.routing!.every((r) => r.passive === true)).toBe(true)
    expect(passive.t.ports.some((p) => p.flags?.includes('requiresPhantom'))).toBe(false)
    const active = asDevice('di-box', { traits: ['active'] })
    expect(active.t.ports.find((p) => p.signal === 'mic-level')!.flags).toEqual(['requiresPhantom'])
    expect(active.t.routing!.some((r) => r.passive === true)).toBe(false)
    expect(passive.issues).toEqual([])
    expect(active.issues).toEqual([])
  })
  it('preamp: phantom toggle gates providesPhantom on the mic in (ISA One pattern), gain enum, power', () => {
    const { t, issues } = asDevice('mic-preamp', {})
    expect(t.controls.map((c) => c.id)).toEqual(['power', 'phantom-48v', 'gain'])
    const ph = t.controls.find((c) => c.id === 'phantom-48v')!
    expect(ph).toMatchObject({ type: 'toggle', default: false, enables: { flag: 'providesPhantom', ports: ['in-mic'] } })
    expect(issues).toEqual([])
  })
  it('console: mains, master outs, mute / fader / balance (QL1 pattern), every input routed to the mains', () => {
    const { t, issues } = asDevice('console-digital', {})
    expect(t.controls.map((c) => c.id)).toEqual(['power', 'mute-master', 'fader-master', 'balance-master'])
    expect(t.routing).toEqual([
      { from: 'in-mic-1', to: ['out-main-l', 'out-main-r'] },
      { from: 'in-mic-2', to: ['out-main-l', 'out-main-r'] },
    ])
    expect(issues).toEqual([])
  })
  it('interface, outboard, wireless, headphones, recorder, computer, power, accessory: each produces a catalogue-valid device', () => {
    for (const c of ['audio-interface', 'outboard', 'wireless', 'iem', 'headphones', 'recorder', 'measurement', 'computer', 'controller', 'power', 'accessory', 'pop-filter']) {
      const { issues } = asDevice(c, {})
      expect(issues, c).toEqual([])
    }
    expect(asDevice('power', {}).t.ports.every((p) => p.flags?.includes('isMainsSource'))).toBe(true)
    expect(asDevice('pop-filter', {}).t.ports).toEqual([])
  })
  it('a cable row without documented ports has no default ports: the promotion tool refuses it', () => {
    expect(asDevice('cable', {}).t.ports).toEqual([])
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

describe('short port ids keep the channel number (finding 4: the regex was /^d+$/ instead of /^\d+$/)', () => {
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
