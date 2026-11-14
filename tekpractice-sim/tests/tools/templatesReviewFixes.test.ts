/**
 * Waves 2 to 5 review (2026-11-12), the template findings, tested on synthetic ports AND on the real catalogue rows:
 *  5   a device is either powered by a modelled inlet or says « alimentation non modélisée »;
 *  6   no invented routes (codec: none; preamp: channel by channel, analogue only; same-signal pairing for other outboard);
 *  7   a thru / link / loop output repeats its input (passive, labelled P7);
 *  8   a Dante / AES67 RJ45 keeps aoip, the control RJ45 does not;
 *  10  desk routing: no talkback to the mains, no digital or USB output, nothing without a documented main / mix / monitor output; no monitor controller default;
 *  16  every assumed connector says so in the notes; labels do not claim variants that are not modelled.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyTemplate } from '../../tools/behaviourTemplates'
import { loadPlan, type PlanPort, type PlanRow } from '../../tools/equipmentPlan'

const row = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: 'fixture', status: 'new', category: 'outboard', manufacturer: 'M', product: 'P', sizeMm: { w: 1, d: 1, h: 1 }, portsSummary: '', family: 'rack-box-v2',
  dataQuality: 'datasheet', tier: 1, wave: 1, sources: ['https://example.com'], notes: '', traits: [], sizeConfidence: 'ok', ...over,
})
const port = (id: string, dir: 'in' | 'out' | 'bidir', connector: string, signal: string, more: Partial<PlanPort> = {}): PlanPort => ({ id, role: 'port', dir, connector, signal, ...more })
const routes = (t: { routing?: { from: string; to: string[]; passive?: boolean }[] }, from: string) => (t.routing ?? []).filter((r) => r.from === from)
const targets = (t: { routing?: { from: string; to: string[] }[] }, from: string): string[] => routes(t, from).flatMap((r) => r.to)
const tpl = (category: string, traits: PlanRow['traits'], given: PlanPort[], extra?: { powerNote?: string }) => applyTemplate(category, row({ category, traits }), given, '2026-11-12', undefined, extra)

interface DevJson { id: string; label: string; ports: { portId: string; dir: string; connector: string; signal: string; flags?: string[] }[]; controls?: { id: string }[]; routing?: { from: string; to: string[]; passive?: boolean }[]; realWorld: { notes: string; category: string }; portAliases?: Record<string, string> }
const catalog = (JSON.parse(readFileSync('content/catalog.json', 'utf8')) as { devices: DevJson[] }).devices
const dev = (id: string): DevJson => {
  const d = catalog.find((x) => x.id === id)
  if (!d) throw new Error(`no catalogue device ${id}`)
  return d
}
const plan = loadPlan()
const promoted = plan.filter((r) => r.promoted === true)
const cat = (d: DevJson, from: string): string[] => (d.routing ?? []).filter((r) => r.from === from).flatMap((r) => r.to)
const readSpec = (id: string) => JSON.parse(readFileSync(`content/asset-specs/${id}.json`, 'utf8')) as { ports: { portId: string; dir: 'in' | 'out' | 'bidir'; connector: string; signal: string; flags?: string[]; thruOf?: string; thruProcessed?: boolean }[]; powerNote?: string; sources: { note: string }[] }

describe('finding 6: no invented routes', () => {
  it('a codec has no through-route: its send inputs never feed its receive outputs', () => {
    const t = tpl('codec', [], [port('in-send-1', 'in', 'xlr3-f', 'line-level-pro'), port('out-recv-1', 'out', 'xlr3-m', 'line-level-pro'), port('in-aes', 'in', 'xlr3-f', 'aes3'), port('out-aes', 'out', 'xlr3-m', 'aes3')])
    expect(t.routing).toBeUndefined()
  })
  it('a preamp routes channel by channel to analogue outputs: mic N and line N go to line out N, never to a digital output (not documented)', () => {
    const given = [
      port('in-mic-1', 'in', 'xlr3-f', 'mic-level'), port('in-mic-2', 'in', 'xlr3-f', 'mic-level'),
      port('in-line-1', 'in', 'xlr3-f', 'line-level-pro'), port('in-line-2', 'in', 'xlr3-f', 'line-level-pro'),
      port('out-line-1', 'out', 'xlr3-m', 'line-level-pro'), port('out-line-2', 'out', 'xlr3-m', 'line-level-pro'),
      port('out-aes-1', 'out', 'xlr3-m', 'aes3'), port('out-aes-2', 'out', 'xlr3-m', 'aes3'),
    ]
    const t = tpl('mic-preamp', ['rack'], given)
    expect(targets(t, 'in-mic-1')).toEqual(['out-line-1'])
    expect(targets(t, 'in-line-1')).toEqual(['out-line-1'])
    expect(targets(t, 'in-mic-2')).toEqual(['out-line-2'])
    expect(targets(t, 'in-line-2')).toEqual(['out-line-2'])
  })
  it('other outboard gear pairs inputs with outputs of the SAME signal only (an AES input does not feed an analogue output)', () => {
    const given = [
      port('in-xlr-1', 'in', 'xlr3-f', 'line-level-pro'), port('in-aes', 'in', 'xlr3-f', 'aes3'),
      port('out-xlr-1', 'out', 'xlr3-m', 'line-level-pro'), port('out-aes', 'out', 'xlr3-m', 'aes3'),
    ]
    const t = tpl('outboard', ['processor', 'rack'], given)
    expect(targets(t, 'in-xlr-1')).toEqual(['out-xlr-1'])
    expect(targets(t, 'in-aes')).toEqual(['out-aes'])
  })
  it('real row telos-zephyr-xstream (a codec): no routing at all', () => {
    expect(dev('telos-zephyr-xstream').routing).toBeUndefined()
  })
  it('real row ams-neve-1073dpd: mic and line inputs reach the matching line output, nothing reaches an AES output', () => {
    const d = dev('ams-neve-1073dpd')
    expect(cat(d, 'in-mic-1')).toEqual(['out-line-1'])
    expect(cat(d, 'in-line-1')).toEqual(['out-line-1'])
    expect(cat(d, 'in-mic-2')).toEqual(['out-line-2'])
    expect(cat(d, 'in-line-2')).toEqual(['out-line-2'])
    for (const r of d.routing ?? []) for (const to of r.to) expect(to.startsWith('out-aes'), `${r.from} -> ${to}`).toBe(false)
  })
  it('no promoted codec, and no promoted preamp, routes to a digital output', () => {
    for (const r of promoted) {
      const d = dev(r.id)
      if (d.realWorld.category === 'codec') expect(d.routing, r.id).toBeUndefined()
      if (d.realWorld.category === 'mic-preamp')
        for (const route of d.routing ?? []) for (const to of route.to) expect(d.ports.find((p) => p.portId === to)?.signal, `${r.id} ${route.from} -> ${to}`).toMatch(/^line-level/)
    }
  })
  it('across every promoted device, a route joins ports of the same signal family (an analogue input is not fed to a digital output)', () => {
    const analog = new Set(['mic-level', 'line-level-pro', 'line-level-consumer', 'instrument-hiz', 'speaker-level', 'headphone-level'])
    const outboard = promoted.filter((r) => ['outboard', 'broadcast', 'monitor-controller', 'mic-preamp', 'di-box', 'headphone-amp'].includes(r.category))
    expect(outboard.length).toBeGreaterThan(10)
    for (const r of outboard) {
      const d = dev(r.id)
      for (const route of d.routing ?? [])
        for (const to of route.to) {
          const a = d.ports.find((p) => p.portId === route.from)!
          const b = d.ports.find((p) => p.portId === to)!
          if (r.category === 'headphone-amp') continue
          expect(analog.has(a.signal), `${r.id} ${route.from} (${a.signal}) -> ${to} (${b.signal})`).toBe(analog.has(b.signal))
        }
    }
  })
})

describe('finding 10: desks and controllers', () => {
  const deskPorts = [
    port('in-mic-1', 'in', 'xlr3-f', 'mic-level'), port('in-talkback', 'in', 'xlr3-f', 'mic-level'),
    port('out-main-l', 'out', 'xlr3-m', 'line-level-pro'), port('out-main-r', 'out', 'xlr3-m', 'line-level-pro'),
    port('out-aes', 'out', 'xlr3-m', 'aes3'), port('usb', 'bidir', 'usb-b', 'usb-audio'), port('net-dante-1', 'bidir', 'rj45', 'aoip'),
  ]
  it('talkback never routes to the main outputs; a channel input routes to the main outputs only (not to AES, USB or Dante)', () => {
    const t = tpl('console-digital', ['desk'], deskPorts)
    expect(targets(t, 'in-mic-1')).toEqual(['out-main-l', 'out-main-r'])
    expect(targets(t, 'in-talkback')).toEqual([])
  })
  it('a desk without a documented main / mix / monitor analogue output routes nothing (no omni, no AES, no Dante, no USB)', () => {
    const t = tpl('console-digital', ['desk'], [port('in-1', 'in', 'xlr3-f', 'mic-level'), port('out-omni-1', 'out', 'xlr3-m', 'line-level-pro'), port('out-aes', 'out', 'xlr3-m', 'aes3'), port('net-dante-1', 'bidir', 'rj45', 'aoip'), port('usb', 'bidir', 'usb-b', 'usb-audio')])
    expect(t.routing).toBeUndefined()
  })
  it('a mix or monitor output counts as documented when no out-main exists', () => {
    const t = tpl('console-analog', ['desk'], [port('in-mic-1', 'in', 'xlr3-f', 'mic-level'), port('out-mix-1', 'out', 'xlr3-m', 'line-level-pro'), port('out-aes', 'out', 'xlr3-m', 'aes3')])
    expect(targets(t, 'in-mic-1')).toEqual(['out-mix-1'])
  })
  it('a monitor controller has no default route (the sheet gives no default speaker pair): it is not fed to every speaker pair at once', () => {
    const given = [
      port('in-a-l', 'in', 'xlr3-f', 'line-level-pro'), port('in-a-r', 'in', 'xlr3-f', 'line-level-pro'),
      port('out-spk-a-l', 'out', 'xlr3-m', 'line-level-pro'), port('out-spk-a-r', 'out', 'xlr3-m', 'line-level-pro'),
      port('out-spk-b-l', 'out', 'xlr3-m', 'line-level-pro'), port('out-spk-b-r', 'out', 'xlr3-m', 'line-level-pro'),
    ]
    expect(tpl('monitor-controller', ['monitor-controller', 'desk'], given).routing).toBeUndefined()
  })
  it.each(['yamaha-cl5', 'yamaha-dm7', 'allen-heath-avantis'])('real row %s: no documented main output, so no route', (id) => {
    expect(dev(id).routing).toBeUndefined()
  })
  it('real row presonus-monitor-station-v2: no route (not fed to all three speaker pairs)', () => {
    expect(dev('presonus-monitor-station-v2').routing).toBeUndefined()
  })
  it('real row midas-m32: channel inputs reach out-main-l / out-main-r, the talkback reaches nothing', () => {
    const d = dev('midas-m32')
    expect(cat(d, 'in-mic-1')).toEqual(['out-main-l', 'out-main-r'])
    expect(cat(d, 'in-talkback')).toEqual([])
  })
  it('across every promoted desk, no route ends on a digital, network or USB port, nor starts at a talkback input', () => {
    const desks = promoted.filter((r) => dev(r.id).realWorld.category.startsWith('console'))
    expect(desks.length).toBeGreaterThan(8)
    for (const r of desks) {
      const d = dev(r.id)
      for (const route of d.routing ?? []) {
        expect(route.from, r.id).not.toMatch(/talkback/)
        for (const to of route.to) expect(d.ports.find((p) => p.portId === to)?.signal, `${r.id} ${route.from} -> ${to}`).toMatch(/^line-level/)
      }
    }
  })
})

describe('finding 7: thru / link / loop outputs repeat their input', () => {
  it('a speaker output declared thruOf gets a passive route from that input, labelled as the P7 assumption', () => {
    const t = tpl('powered-speaker', ['active'], [port('in-xlr', 'in', 'xlr3-f', 'line-level-pro'), port('thru-out', 'out', 'xlr3-m', 'line-level-pro', { thruOf: 'in-xlr' }), port('power-in', 'in', 'iec-c14', 'mains-power')])
    expect(routes(t, 'in-xlr')).toEqual([{ from: 'in-xlr', to: ['transducer'] }, { from: 'in-xlr', to: ['thru-out'], passive: true }])
    expect(t.notes.join(' ')).toContain('hypothèse pédagogique du plan (P7), non sourcée')
  })
  it('thruProcessed makes the route need power (a high-passed daisy chain is processed)', () => {
    const t = tpl('studio-monitor', ['active'], [port('in-analog-1', 'in', 'xlr3-f', 'line-level-pro'), port('out-analog-1', 'out', 'xlr3-m', 'line-level-pro', { thruOf: 'in-analog-1', thruProcessed: true }), port('power-in', 'in', 'iec-c14', 'mains-power')])
    expect(routes(t, 'in-analog-1').find((r) => r.to.includes('out-analog-1'))).toEqual({ from: 'in-analog-1', to: ['out-analog-1'] })
  })
  it('a pair of parallel bidir speakON sockets repeats both ways', () => {
    const t = tpl('speaker', ['passive'], [port('bidir-nl4-1', 'bidir', 'speakon-nl4', 'speaker-level'), port('bidir-nl4-2', 'bidir', 'speakon-nl4', 'speaker-level', { thruOf: 'bidir-nl4-1' })])
    expect(routes(t, 'bidir-nl4-1').map((r) => r.to[0])).toEqual(['transducer', 'bidir-nl4-2'])
    expect(routes(t, 'bidir-nl4-2').map((r) => r.to[0])).toEqual(['transducer', 'bidir-nl4-1'])
  })
  it.each([
    ['yamaha-dxr12-mkii', 'in-xlr', ['thru-out']],
    ['meyer-upjunior-upj-1p', 'in-xlr', ['out-xlr-loop']],
    ['meyer-sound-lina', 'in-xlr', ['out-xlr-loop']],
    ['l-acoustics-a15-focus', 'in-nl4', ['out-nl4-link']],
    ['genelec-8341a', 'in-aes', ['out-aes']],
    ['genelec-8351b', 'in-aes', ['out-aes']],
    ['adam-audio-s3h', 'in-aes', ['out-aes']],
    ['db-audiotechnik-y10p', 'bidir-nl4-1', ['bidir-nl4-2']],
    ['db-audiotechnik-v-sub', 'bidir-nl4-1', ['bidir-nl4-2']],
    ['nexo-45n12', 'bidir-nl4-1', ['bidir-nl4-2']],
    ['nexo-p12', 'bidir-nl4-1', ['bidir-nl4-2']],
  ])('real row %s: %s repeats to %j', (id, from, to) => {
    const d = dev(id)
    for (const t of to) expect(cat(d, from), `${id}: ${from} -> ${t}`).toContain(t)
    expect(d.realWorld.notes, id).toContain('hypothèse pédagogique du plan (P7), non sourcée')
  })
  it('real rows with two repeating outputs: DXR12 link-out, KH 750 outputs (processed: not passive)', () => {
    expect(cat(dev('yamaha-dxr12-mkii'), 'in-xlr')).toContain('link-out')
    const kh = dev('neumann-kh-750-dsp')
    expect(cat(kh, 'in-analog-1')).toContain('out-analog-1')
    expect(cat(kh, 'in-analog-2')).toContain('out-analog-2')
    expect(cat(kh, 'in-aes')).toContain('out-aes')
    const analog = (kh.routing ?? []).find((r) => r.from === 'in-analog-1' && r.to.includes('out-analog-1'))
    expect(analog?.passive).toBeUndefined()
  })
  it('every spec thruOf names an input of the same spec', () => {
    for (const r of [...promoted, ...plan.filter((x) => x.betaModelled)]) {
      const s = readSpec(r.id)
      for (const p of s.ports.filter((q) => q.thruOf)) expect(s.ports.some((q) => q.portId === p.thruOf && q.dir !== 'out'), `${r.id} ${p.portId}`).toBe(true)
    }
  })
})

describe('finding 8: Dante RJ45 ports stay aoip, control RJ45 ports do not', () => {
  it('a device that declares a Dante port by name keeps every spec-declared RJ45 signal', () => {
    const t = tpl('wireless', ['receiver'], [port('net-dante-1', 'bidir', 'rj45', 'aoip'), port('net-ctl-1', 'bidir', 'rj45', 'ethernet-control'), port('net-other', 'bidir', 'rj45', 'aoip')])
    expect(t.ports.map((p) => p.signal)).toEqual(['aoip', 'ethernet-control', 'aoip'])
  })
  it('a wireless device without any Dante port still has control-only Ethernet', () => {
    const t = tpl('wireless', ['receiver'], [port('net', 'bidir', 'rj45', 'aoip')])
    expect(t.ports[0]!.signal).toBe('ethernet-control')
  })
  it('real row shure-axient-digital-ad4d: Dante ports are aoip, the control ports are ethernet-control, per its spec', () => {
    const d = dev('shure-axient-digital-ad4d')
    const sig = (id: string) => d.ports.find((p) => p.portId === id)?.signal
    expect(sig('net-dante-1')).toBe('aoip')
    expect(sig('net-dante-2')).toBe('aoip')
    expect(sig('net-ctl-1')).toBe('ethernet-control')
    expect(sig('net-ctl-2')).toBe('ethernet-control')
    expect(d.portAliases?.['net-1']).toBe('net-dante-1')
    expect(d.portAliases?.['net-3']).toBe('net-ctl-1')
  })
  it('real row sennheiser-em-6000: the label does not say DANTE (the plain model has no Dante port)', () => {
    const d = dev('sennheiser-em-6000')
    expect(d.label).not.toMatch(/dante/i)
    expect(d.ports.some((p) => p.signal === 'aoip')).toBe(false)
  })
})

describe('finding 16: labels claim what is modelled; assumed connectors say so', () => {
  it('Dante AVIO Install is labelled with the one variant that is modelled (2IN), not all three', () => {
    const d = dev('audinate-dante-avio-install')
    expect(d.label).not.toMatch(/2OUT|2IN2OUT/)
    expect(d.label).toMatch(/2IN/)
  })
  it('AD4D label does not cite the AD1 / AD2 transmitters (none is modelled)', () => {
    expect(dev('shure-axient-digital-ad4d').label).not.toMatch(/AD1|AD2/)
  })
  it('every plan row with assumedConnectors carries the same assumed-connector sentence in its notes (promoted devices)', () => {
    const rows = promoted.filter((r) => (r.assumedConnectors ?? []).length > 0)
    expect(rows.length).toBeGreaterThan(20)
    for (const r of rows) expect(dev(r.id).realWorld.notes, r.id).toMatch(/assumed: no cited page states it/)
  })
  it.each(['genelec-8341a', 'genelec-8040b', 'midas-m32', 'yamaha-dxr12-mkii'])('%s says its inlet type is assumed (the sheet does not name it)', (id) => {
    const r = plan.find((x) => x.id === id)!
    expect(r.assumedConnectors ?? [], id).toContain('power-in')
    expect(dev(id).realWorld.notes).toMatch(/connector type of power-in \(iec-c14\), assumed/)
  })
  it('a spec whose source says the inlet type is not named lists power-in in the plan assumedConnectors', () => {
    const says = /(inlet[^.;]{0,80}\bnot (named|stated|described|printed|given|specified)|does not name the inlet|iec-c14 (by|follows|comes|from)|type letter not)/i
    const missing: string[] = []
    for (const r of promoted) {
      const s = readSpec(r.id)
      if (!s.ports.some((p) => p.portId === 'power-in')) continue
      if (says.test(s.sources.map((x) => x.note).join(' ')) && !(r.assumedConnectors ?? []).includes('power-in')) missing.push(r.id)
    }
    expect(missing).toEqual([])
  })
  it.each(['omnia-11', 'sonifex-dhy-04s', 'dbx-160a'])('%s discloses that the sheet documents no mains switch: its notes say the power control is the simulator\'s', (id) => {
    expect(dev(id).realWorld.notes).toMatch(/interrupteur secteur/i)
  })
})

describe('finding 5: a device is powered by a modelled inlet or says so', () => {
  it('a mains device without a modelled inlet carries the note (default text)', () => {
    const t = tpl('outboard', ['processor', 'rack'], [port('in-1', 'in', 'xlr3-f', 'line-level-pro'), port('out-1', 'out', 'xlr3-m', 'line-level-pro')])
    expect(t.issues.join(' ')).toMatch(/no mains inlet/)
    expect(t.notes.join(' ')).toContain('alimentation non modélisée (source non lue)')
  })
  it('a spec powerNote replaces the default text', () => {
    const t = tpl('outboard', ['processor', 'rack'], [port('in-1', 'in', 'xlr3-f', 'line-level-pro')], { powerNote: 'alimentation non modélisée (alimentation externe selon la fiche)' })
    expect(t.notes.join(' ')).toContain('alimentation non modélisée (alimentation externe selon la fiche)')
    expect(t.notes.join(' ')).not.toContain('source non lue')
  })
  it('a device with a mains inlet carries no such note', () => {
    const t = tpl('outboard', ['processor', 'rack'], [port('in-1', 'in', 'xlr3-f', 'line-level-pro'), port('power-in', 'in', 'iec-c14', 'mains-power')])
    expect(t.notes.join(' ')).not.toContain('alimentation non modélisée')
  })
  it.each(['ua-la-610-mkii', 'dbx-160a', 'eventide-h9000', 'orban-optimod-6300', 'tc-electronic-m3000'])('real row %s: the documented mains inlet is modelled with its power port', (id) => {
    const d = dev(id)
    expect(d.ports.find((p) => p.portId === 'power-in'), id).toMatchObject({ dir: 'in', connector: 'iec-c14', signal: 'mains-power' })
  })
  it('real row ua-la-2a: the inlet is not confirmable, so the note says so', () => {
    const d = dev('ua-la-2a')
    expect(d.ports.some((p) => p.portId === 'power-in')).toBe(false)
    expect(d.realWorld.notes).toMatch(/alimentation non modélisée/i)
  })
  it('across every promoted device: when the template would report a missing mains inlet, the catalogue notes carry the alimentation non modélisée line', () => {
    let reported = 0
    for (const r of promoted) {
      const spec = readSpec(r.id)
      const t = applyTemplate(r.category, r, spec.ports.map((p) => ({ id: p.portId, role: 'port', dir: p.dir, connector: p.connector, signal: p.signal })), '2026-11-12')
      const d = dev(r.id)
      if (d.ports.some((p) => p.portId === 'power-in')) continue
      if (t.issues.some((i) => /no mains inlet/.test(i))) {
        reported++
        expect(d.realWorld.notes, r.id).toMatch(/alimentation non modélisée/i)
      }
    }
    expect(reported).toBeGreaterThan(5)
  })
})
