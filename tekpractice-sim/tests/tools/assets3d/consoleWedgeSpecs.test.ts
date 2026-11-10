/**
 * The two shipped consoles on console-wedge v2 (Wave 3, task 3.2): what their specs declare, the ports against the modelled detail, and the
 * manifest rows. No Blender: the geometry itself is built and measured in consoleWedge.test.ts and by the gates when the assets are built.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { flatZonesFor } from '../../../tools/assets3d/flatZones'
import { loadSpecs } from '../../../tools/assets3d/loadSpecs'
import { CONSOLE_V2_PARAMS, validateBuild } from '../../../tools/assets3d/shapes'
import type { AssetSpecT } from '../../../tools/assets3d/specSchema'

const spec = (id: string): AssetSpecT => loadSpecs().find((s) => s.id === id) as AssetSpecT
const manifest = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'public', 'assets', 'ASSET_MANIFEST.json'), 'utf8')) as { assets: { id: string; tris: number; gates: { gate: string; ok: boolean }[] }[] }
const row = (id: string): { id: string; tris: number; gates: { gate: string; ok: boolean }[] } => manifest.assets.find((a) => a.id === id) as never

describe('yamaha-ql1 on console-wedge v2', () => {
  const ql1 = spec('yamaha-ql1')
  const p = ql1.build?.params ?? {}

  it('declares the v2 params, a budget up to 6000 triangles and a minimum fillet; the build block validates', () => {
    expect(ql1.build?.shape).toBe('console-wedge')
    for (const name of Object.keys(p)) expect(CONSOLE_V2_PARAMS as readonly string[]).toContain(name)
    for (const name of ['filletMm', 'armRestMm', 'cheekMm', 'baseMm', 'feetMm', 'slotPlates', 'frontRecessWMm']) expect(p[name], name).toBeGreaterThan(0)
    expect(ql1.build?.budget?.max).toBe(6000)
    expect(ql1.build?.minFilletMm).toBeGreaterThan(0)
    expect(ql1.build?.minFilletMm).toBeLessThanOrEqual(p.filletMm)
    expect(validateBuild(ql1)).toEqual([])
  })

  it('keeps the side profile of the control layout: the parity test of tests/controls reads it from here', () => {
    const layout = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'content', 'control-layouts', 'yamaha-ql1.json'), 'utf8')) as { topProfile: number[][] }
    expect(layout.topProfile).toEqual(ql1.build?.profile)
  })

  it('has the two option slots where the rear photo has them: 121 x 40 mm plates at x 193.6 and 320.6 mm, no port inside them', () => {
    expect(p.slotPlates).toBe(2)
    const x0 = [p.slotPlateXMm, p.slotPlateXMm + p.slotPlatePitchMm]
    expect(x0[0]).toBeCloseTo(193.6, 6)
    expect(x0[1]).toBeCloseTo(320.6, 6)
    for (const port of ql1.ports) {
      const r = (port.openingMm ?? 24) / 2
      for (const x of x0) {
        const clear = port.xMm + r <= x || port.xMm - r >= x + p.slotPlateWMm || port.yMm - r >= p.slotPlateYMm + p.slotPlateHMm || port.yMm + r <= p.slotPlateYMm
        expect(clear, `${port.portId} against the slot plate at ${x} mm`).toBe(true)
      }
      expect(port.insetMm, `${port.portId} sits on the rear plane`).toBeUndefined()
    }
  })

  it('re-measured rear ports: the connector centres on the picture crop 128,132,1731,1006 of rear.jpg (3.6987 px/mm), to the tenth of a millimetre', () => {
    const at = (id: string): [number, number] => {
      const port = ql1.ports.find((x) => x.portId === id)
      return [port?.xMm ?? NaN, port?.yMm ?? NaN]
    }
    const expected: Record<string, [number, number]> = {
      'in-mic-1': [420.1, 151.3],
      'in-mic-2': [396.6, 151.3],
      'out-main-l': [219.3, 152.0],
      'out-main-r': [193.8, 152.0],
      'out-mix-1': [168.2, 152.0],
      'dante-primary': [318.7, 72.8],
      'power-in': [147.9, 32.3],
    }
    for (const [id, [x, y]] of Object.entries(expected)) {
      expect(at(id)[0], `${id} x`).toBeCloseTo(x, 6)
      expect(at(id)[1], `${id} y`).toBeCloseTo(y, 6)
    }
    // the rocker housing the rig draws is the one on the picture (the layout and the spec agree)
    const power = ql1.controls.find((c) => c.controlId === 'power')
    expect([power?.xMm, power?.yMm]).toEqual([148, 71.5])
    const zone = flatZonesFor('yamaha-ql1').find((z) => z.face === 'io')
    expect(zone).toBeDefined()
    expect((((zone?.x0 ?? 0) + (zone?.x1 ?? 0)) / 2)).toBeCloseTo(148, 6)
  })

  it('the connector pitch survives the re-measure (XLR inputs 23.4 mm, OMNI outs 25.5 mm) and the rows are level', () => {
    const x = (id: string): number => ql1.ports.find((q) => q.portId === id)?.xMm ?? NaN
    expect(x('in-mic-1') - x('in-mic-2')).toBeCloseTo(23.5, 0)
    expect(x('out-main-l') - x('out-main-r')).toBeCloseTo(25.5, 0)
    expect(x('out-main-r') - x('out-mix-1')).toBeCloseTo(25.6, 0)
    expect(ql1.ports.find((q) => q.portId === 'in-mic-1')?.yMm).toBe(ql1.ports.find((q) => q.portId === 'in-mic-2')?.yMm)
  })

  it('is shipped as a hybrid with the detail and fillet gates, between 1000 and 6000 triangles', () => {
    const r = row('yamaha-ql1')
    expect(r.tris).toBeGreaterThan(1000)
    expect(r.tris).toBeLessThanOrEqual(6000)
    for (const g of ['detail', 'fillet', 'portSurface', 'size']) expect(r.gates.find((x) => x.gate === g)?.ok, g).toBe(true)
  })
})

describe('axia-iq on console-wedge v2', () => {
  const axia = spec('axia-iq')
  const p = axia.build?.params ?? {}

  it('declares the v2 params, a budget of 1500 to 3500 triangles and a minimum fillet; the build block validates', () => {
    expect(axia.build?.shape).toBe('console-wedge')
    for (const name of Object.keys(p)) expect(CONSOLE_V2_PARAMS as readonly string[]).toContain(name)
    expect(axia.build?.budget).toEqual({ min: 1500, max: 3500 })
    expect(axia.build?.minFilletMm).toBeGreaterThan(0)
    expect(validateBuild(axia)).toEqual([])
  })

  it('has its meter bridge narrower than the deck, wide enough for the meters of the layout, and the layout keeps the profile', () => {
    expect(p.tierWMm).toBeLessThan(axia.realSizeMm.w)
    const meters = flatZonesFor('axia-iq').filter((z) => z.face === 'top' && z.y1 < 82)
    expect(meters.length).toBeGreaterThan(0)
    const lo = (axia.realSizeMm.w - p.tierWMm) / 2
    for (const z of meters) {
      expect(z.x0).toBeGreaterThan(lo)
      expect(z.x1).toBeLessThan(axia.realSizeMm.w - lo)
    }
    const layout = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'content', 'control-layouts', 'axia-iq.json'), 'utf8')) as { topProfile: number[][] }
    expect(layout.topProfile).toEqual(axia.build?.profile)
  })

  it('puts the ports of the rear recess on its floor and says honestly that its port positions are guesses', () => {
    const inside = axia.ports.filter((q) => q.insetMm !== undefined)
    expect(inside.length).toBe(6)
    for (const q of inside) {
      expect(q.insetMm).toBe(p.rearRecessDepthMm)
      expect(q.xMm - 12).toBeGreaterThanOrEqual(p.rearRecessXMm)
      expect(q.xMm + 12).toBeLessThanOrEqual(p.rearRecessXMm + p.rearRecessWMm)
      expect(q.yMm - 12).toBeGreaterThanOrEqual(p.rearRecessYMm)
      expect(q.yMm + 12).toBeLessThanOrEqual(p.rearRecessYMm + p.rearRecessHMm)
    }
    expect(axia.ports.every((q) => q.confidence === 'guess')).toBe(true)
  })

  it('is shipped with the detail and fillet gates, between 1500 and 3500 triangles', () => {
    const r = row('axia-iq')
    expect(r.tris).toBeGreaterThanOrEqual(1500)
    expect(r.tris).toBeLessThanOrEqual(3500)
    for (const g of ['detail', 'fillet', 'portSurface', 'size']) expect(r.gates.find((x) => x.gate === g)?.ok, g).toBe(true)
  })
})
