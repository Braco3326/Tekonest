import { describe, expect, it } from 'vitest'
import { checkCatalog } from '../../tools/catalogChecks'
import type { CatalogT } from '../../tools/schemas'
import { makeRegistry } from '../helpers'

const base = makeRegistry().catalog
const allModels: ReadonlySet<string> = new Set(base.devices.map((d) => d.id))
const fresh = (): CatalogT => structuredClone(base)
/** Optional later fields (routing, acoustic) are not in the zod Device yet, hence the loose view. */
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

describe('checkCatalog, routing (optional)', () => {
  const ql1Ports = () => dev(fresh(), 'yamaha-ql1').ports
  const inPort = () => ql1Ports().find((p) => p.dir === 'in')!.portId
  const outPort = () => ql1Ports().find((p) => p.dir === 'out')!.portId

  it('accepts a valid route', () => {
    const c = fresh()
    dev(c, 'yamaha-ql1').routing = [{ from: inPort(), to: [outPort()] }]
    expect(errors(c)).toEqual([])
  })

  it('accepts a source route enabled by an existing control', () => {
    const c = fresh()
    const d = dev(c, 'yamaha-ql1')
    d.controls = [...(d.controls ?? []), { id: 'playback-usb', type: 'toggle', label: 'Lecture console (USB)', default: false }]
    d.routing = [{ source: 'playback-usb', label: 'Lecture console', to: [outPort()], enabledBy: 'playback-usb' }]
    expect(errors(c)).toEqual([])
  })

  it('errors on an unknown port, a wrong direction, an empty target list and an unknown enabledBy', () => {
    const c = fresh()
    const d = dev(c, 'yamaha-ql1')
    d.routing = [
      { from: 'nope', to: [outPort()] },
      { from: outPort(), to: [outPort()] },
      { from: inPort(), to: [inPort()] },
      { from: inPort(), to: [] },
      { source: 'player', to: [outPort()], enabledBy: 'no-such-control' },
      { to: [outPort()] },
    ]
    expect(errors(c).map((i) => i.path)).toEqual([
      'devices["yamaha-ql1"].routing[0].from',
      'devices["yamaha-ql1"].routing[1].from',
      'devices["yamaha-ql1"].routing[2].to',
      'devices["yamaha-ql1"].routing[3].to',
      'devices["yamaha-ql1"].routing[4].enabledBy',
      'devices["yamaha-ql1"].routing[5]',
    ])
  })

  it('errors when routing is not an array', () => {
    const c = fresh()
    dev(c, 'yamaha-ql1').routing = { from: 'a' }
    expect(errors(c).map((i) => i.path)).toEqual(['devices["yamaha-ql1"].routing'])
  })

  it('does nothing for a device without routing', () => {
    expect(errors(fresh())).toEqual([])
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
