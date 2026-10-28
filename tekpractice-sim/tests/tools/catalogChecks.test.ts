import { describe, expect, it } from 'vitest'
import { checkCatalog } from '../../tools/catalogChecks'
import type { CatalogT } from '../../tools/schemas'
import { makeRegistry } from '../helpers'

const base = makeRegistry().catalog
const allModels: ReadonlySet<string> = new Set(base.devices.map((d) => d.id))
const fresh = (): CatalogT => structuredClone(base)
/** Fields the zod Device does not know yet (acoustic, Task 35) and deliberately malformed values, hence the loose view. */
type LooseDevice = CatalogT['devices'][number] & Record<string, any>
const dev = (c: CatalogT, id: string) => c.devices.find((d) => d.id === id) as LooseDevice
const errors = (c: CatalogT) => checkCatalog(c, { modelIds: allModels }).filter((i) => i.level === 'error')

describe('checkCatalog, models', () => {
  it('the real catalog has no issue when every device has a model', () => {
    expect(checkCatalog(fresh(), { modelIds: allModels })).toEqual([])
  })

  it('warns (never errors) for a device without a .glb: the placeholder ships', () => {
    const models = new Set(allModels)
    models.delete('shure-sm58')
    const issues = checkCatalog(fresh(), { modelIds: models })
    expect(issues).toHaveLength(1)
    expect(issues[0].level).toBe('warning')
    expect(issues[0].path).toBe('devices["shure-sm58"]')
    expect(issues[0].message).toMatch(/shure-sm58\.glb/)
  })
})

describe('checkCatalog, ports', () => {
  it('errors on a duplicate port id inside a device', () => {
    const c = fresh()
    const d = dev(c, 'shure-sm58')
    d.ports.push({ ...d.ports[0] })
    const e = errors(c)
    expect(e).toHaveLength(1)
    expect(e[0].path).toBe(`devices["shure-sm58"].ports["${d.ports[0].portId}"]`)
    expect(e[0].message).toMatch(/duplicate/)
  })

  it('allows the same port id on two different devices', () => {
    expect(errors(fresh())).toEqual([])
  })
})

describe('checkCatalog, routing (Task 33, C8, P7)', () => {
  const ql1 = (c: CatalogT) => dev(c, 'yamaha-ql1')
  const inPort = 'in-mic-1'
  const outPort = 'out-main-l'
  /** The real QL1 with its routing replaced by exactly these routes. */
  const withRoutes = (...routes: unknown[]): CatalogT => {
    const c = fresh()
    ;(ql1(c) as Record<string, unknown>).routing = routes
    return c
  }
  const at = (i: number, field = '') => `devices["yamaha-ql1"].routing[${i}]${field}`

  it('the real QL1 declares routing, and the real catalog passes', () => {
    expect(ql1(fresh()).routing).toBeDefined()
    expect(errors(fresh())).toEqual([])
  })

  it('accepts a port route, a stereo source route behind a toggle, an enum-valued when, a pass-through and the transducer target', () => {
    const c = withRoutes(
      { from: inPort, to: [outPort, 'out-main-r'] },
      { from: 'control:playback-usb', to: [outPort, 'out-main-r'], channels: ['L', 'R'], when: { control: 'playback-usb', equals: true } },
      { from: 'control:playback-usb', to: [outPort], when: { control: 'balance-master', equals: 'C' } },
      { from: inPort, to: ['dante-primary'] },
      { from: 'dante-primary', to: [outPort], passive: true },
      { from: inPort, to: ['transducer'] },
    )
    expect(errors(c)).toEqual([])
  })

  it('errors when a route names an unknown port (from, then to)', () => {
    const e = errors(withRoutes({ from: 'nope', to: [outPort] }, { from: inPort, to: ['nope'] }))
    expect(e.map((i) => i.path)).toEqual([at(0, '.from'), at(1, '.to')])
    expect(e[0].message).toMatch(/unknown port "nope"/)
    expect(e[1].message).toMatch(/unknown port "nope"/)
  })

  it('errors when `from` is an output port', () => {
    const e = errors(withRoutes({ from: outPort, to: ['out-main-r'] }))
    expect(e.map((i) => i.path)).toEqual([at(0, '.from')])
    expect(e[0].message).toMatch(/is an output/)
  })

  it('errors when a `to` is an input port', () => {
    const e = errors(withRoutes({ from: inPort, to: [outPort, 'in-mic-2'] }))
    expect(e.map((i) => i.path)).toEqual([at(0, '.to')])
    expect(e[0].message).toMatch(/"in-mic-2" is an input/)
  })

  it('accepts a bidir port at either end', () => {
    expect(errors(withRoutes({ from: 'dante-primary', to: ['dante-primary'] }))).toEqual([])
  })

  it('errors when `to` is empty or missing', () => {
    expect(errors(withRoutes({ from: inPort, to: [] }, { from: inPort })).map((i) => i.path)).toEqual([at(0, '.to'), at(1, '.to')])
  })

  it('errors when when.control is not a control of the device', () => {
    const e = errors(withRoutes({ from: 'control:playback-usb', to: [outPort], when: { control: 'no-such-control', equals: true } }))
    expect(e.map((i) => i.path)).toEqual([at(0, '.when.control')])
    expect(e[0].message).toMatch(/"no-such-control" is not a control of yamaha-ql1/)
  })

  it('errors when `from` is control:<id> for a control the device lacks', () => {
    const e = errors(withRoutes({ from: 'control:no-such-control', to: [outPort] }))
    expect(e.map((i) => i.path)).toEqual([at(0, '.from')])
    expect(e[0].message).toMatch(/"no-such-control" is not a control of yamaha-ql1/)
  })

  it('errors when channels has a different length from `to` (shorter and longer)', () => {
    const e = errors(withRoutes(
      { from: 'control:playback-usb', to: [outPort, 'out-main-r'], channels: ['L'] },
      { from: 'control:playback-usb', to: [outPort], channels: ['L', 'R'] },
    ))
    expect(e.map((i) => i.path)).toEqual([at(0, '.channels'), at(1, '.channels')])
    expect(e[0].message).toMatch(/1 channel\(s\) for 2 target\(s\)/)
  })

  it('errors on a channel that is not L or R, and on a non-boolean passive', () => {
    const e = errors(withRoutes({ from: inPort, to: [outPort], channels: ['C'] }, { from: inPort, to: [outPort], passive: 'yes' }))
    expect(e.map((i) => i.path)).toEqual([at(0, '.channels'), at(1, '.passive')])
  })

  it('errors when when.equals does not fit the control: a string for a toggle, a boolean or an unlisted value for an enum', () => {
    const e = errors(withRoutes(
      { from: 'control:playback-usb', to: [outPort], when: { control: 'playback-usb', equals: 'true' } },
      { from: 'control:playback-usb', to: [outPort], when: { control: 'fader-master', equals: true } },
      { from: 'control:playback-usb', to: [outPort], when: { control: 'fader-master', equals: '+20' } },
    ))
    expect(e.map((i) => i.path)).toEqual([at(0, '.when.equals'), at(1, '.when.equals'), at(2, '.when.equals')])
  })

  it('errors on a route that is not an object, has no from, or keeps a key the schema would silently drop', () => {
    const e = errors(withRoutes('x', { to: [outPort] }, { from: inPort, to: [outPort], enabledBy: 'power' }, { source: 'player', to: [outPort] }))
    expect(e.map((i) => i.path)).toEqual([at(0), at(1, '.from'), at(2), at(3), at(3, '.from')])
    expect(e[2].message).toMatch(/unknown key "enabledBy"/)
  })

  it('errors when routing is not an array', () => {
    expect(errors(withRoutes()), 'an empty list is fine').toEqual([])
    const c = fresh()
    ;(ql1(c) as Record<string, unknown>).routing = { from: 'a' }
    expect(errors(c).map((i) => i.path)).toEqual(['devices["yamaha-ql1"].routing'])
  })

  it('the real speakers: every route of the catalog is valid, and a bad port id in a speaker is caught too', () => {
    const c = fresh()
    dev(c, 'qsc-k12-2').routing = [{ from: 'in-line-a', to: ['thru-out-b'], passive: true }]
    expect(errors(c).map((i) => i.path)).toEqual(['devices["qsc-k12-2"].routing[0].to'])
  })

  it('does nothing for a device without routing', () => {
    const c = fresh()
    delete ql1(c).routing
    expect(errors(c)).toEqual([])
  })
})

describe('checkCatalog, acoustic (optional)', () => {
  const src = { kind: 'datasheet', ref: 'knowledge-base/equipment/x.json', retrieved: '2026-10-24' }
  const good = (): Record<string, unknown> => ({
    transducer: true,
    coverage_h_deg: { value: 90, source: src },
    coverage_v_deg: { value: 60, source: src },
  })

  it('accepts a sourced block', () => {
    const c = fresh()
    dev(c, 'qsc-k12-2').acoustic = good()
    expect(errors(c)).toEqual([])
  })

  it('errors when a value has no source', () => {
    const c = fresh()
    dev(c, 'qsc-k12-2').acoustic = { ...good(), coverage_h_deg: { value: 90 } }
    expect(errors(c).map((i) => i.path)).toEqual(['devices["qsc-k12-2"].acoustic.coverage_h_deg.source'])
  })

  it('errors on an unknown source kind and a non-numeric value', () => {
    const c = fresh()
    dev(c, 'qsc-k12-2').acoustic = { ...good(), coverage_h_deg: { value: 'wide', source: { ...src, kind: 'memory' } } }
    const e = errors(c).map((i) => i.path)
    expect(e).toContain('devices["qsc-k12-2"].acoustic.coverage_h_deg.value')
    expect(e).toContain('devices["qsc-k12-2"].acoustic.coverage_h_deg.source.kind')
  })

  it('allows kind nominal only for 90 or 60', () => {
    const c = fresh()
    dev(c, 'qsc-k12-2').acoustic = {
      ...good(),
      coverage_h_deg: { value: 90, source: { ...src, kind: 'nominal' } },
      coverage_v_deg: { value: 75, source: { ...src, kind: 'nominal' } },
    }
    expect(errors(c).map((i) => i.path)).toEqual(['devices["qsc-k12-2"].acoustic.coverage_v_deg.source.kind'])
  })

  it('errors when transducer is not a boolean', () => {
    const c = fresh()
    dev(c, 'qsc-k12-2').acoustic = { ...good(), transducer: 'yes' }
    expect(errors(c).map((i) => i.path)).toEqual(['devices["qsc-k12-2"].acoustic.transducer'])
  })
})

describe('checkCatalog, mains (Task 32, C7)', () => {
  const POWER: Record<string, unknown> = { id: 'power', type: 'toggle', label: 'Alimentation', default: true }
  const powered = (c: CatalogT) => c.devices.filter((d) => d.ports.some((p) => p.portId === 'power-in'))

  it('the real catalog passes: every power-in device has its power toggle, the strip is the only source', () => {
    expect(powered(fresh()).length).toBeGreaterThanOrEqual(13)
    expect(errors(fresh())).toEqual([])
  })

  it('errors on a power-in device that has no « power » control (the validator catches it, not a human)', () => {
    const c = fresh()
    const d = dev(c, 'qsc-k12-2')
    d.controls = (d.controls ?? []).filter((x) => x.id !== 'power')
    const e = errors(c)
    expect(e).toHaveLength(1)
    expect(e[0].path).toBe('devices["qsc-k12-2"].controls')
    expect(e[0].message).toMatch(/power/)
  })

  it('errors on a power-in device whose « power » is an enum, mislabelled or off by default', () => {
    const bads: Record<string, unknown>[] = [
      { id: 'power', type: 'enum', label: 'Alimentation', options: ['on', 'off'], defaultOption: 'on' },
      { ...POWER, label: 'Power' },
      { ...POWER, default: false },
    ]
    for (const bad of bads) {
      const c = fresh()
      dev(c, 'yamaha-ql1').controls = [...(dev(c, 'yamaha-ql1').controls ?? []).filter((x) => x.id !== 'power'), bad] as LooseDevice['controls']
      expect(errors(c).map((i) => i.path), JSON.stringify(bad)).toEqual(['devices["yamaha-ql1"].controls["power"]'])
    }
  })

  it('a device without power-in is not asked for a power control (the strip, a microphone)', () => {
    const c = fresh()
    expect(dev(c, 'multiprise-secteur').controls ?? []).toEqual([])
    expect(dev(c, 'shure-sm58').controls ?? []).toEqual([])
    expect(errors(c)).toEqual([])
  })

  it('errors on isMainsSource on an input, or on a port that does not carry mains-power', () => {
    const c = fresh()
    dev(c, 'qsc-k12-2').ports.find((p) => p.portId === 'power-in')!.flags = ['isMainsSource']
    dev(c, 'shure-sm58').ports[0].flags = ['isMainsSource']
    expect(errors(c).map((i) => i.path)).toEqual(['devices["shure-sm58"].ports["out-xlr"]', 'devices["qsc-k12-2"].ports["power-in"]']) // catalog order
  })

  it('errors on a verified mains-power OUTPUT that is not flagged isMainsSource (a source nobody could tell)', () => {
    const c = fresh()
    const strip = dev(c, 'multiprise-secteur')
    delete strip.ports[1].flags
    const e = errors(c)
    expect(e.map((i) => i.path)).toEqual(['devices["multiprise-secteur"].ports["out-2"]'])
  })
})
