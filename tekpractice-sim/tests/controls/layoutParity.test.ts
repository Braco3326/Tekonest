/**
 * Every shipped control layout against the catalog and the asset specs: the device exists, a control that stands for a simulation setting
 * names a real catalog control of THAT device with a compatible kind, no two controls stand for the same setting, and a layout that
 * places controls on a face stays inside the casing of the model it is for.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import catalogJson from '../../content/catalog.json'
import { parseControlLayout, type ControlDef } from '../../src/controls/controlTypes'

const dir = join(__dirname, '../../content/control-layouts')
const specs = join(__dirname, '../../content/asset-specs')
const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
type CatDevice = { id: string; controls?: { id: string; type: 'toggle' | 'enum'; options?: string[] }[] }
const devices = new Map((catalogJson.devices as CatDevice[]).map((d) => [d.id, d]))

const load = (f: string) => {
  const { layout, errors } = parseControlLayout(JSON.parse(readFileSync(join(dir, f), 'utf8')))
  expect(errors, f).toEqual([])
  return layout!
}

describe('control layouts vs the catalog', () => {
  it.each(files)('%s: the device exists and every catalog link is real, compatible and unique', (f) => {
    const layout = load(f)
    const dev = devices.get(layout.deviceId)
    expect(dev, `${f}: unknown device`).toBeDefined()
    const linked = new Map<string, string>()
    for (const c of layout.controls) {
      if (!c.catalogControl) continue
      const cat = dev!.controls?.find((x) => x.id === c.catalogControl)
      expect(cat, `${f}: ${c.id} -> catalog control "${c.catalogControl}" does not exist on ${layout.deviceId}`).toBeDefined()
      const ok =
        cat!.type === 'toggle'
          ? ['button', 'switch', 'fader'].includes(c.kind)
          : (['fader', 'knob', 'switch'] as ControlDef['kind'][]).includes(c.kind) && (cat!.options?.length ?? 0) >= 2
      expect(ok, `${f}: ${c.id} (${c.kind}) cannot stand for the ${cat!.type} "${cat!.id}"`).toBe(true)
      expect(linked.get(cat!.id), `${f}: "${cat!.id}" is stood for by ${linked.get(cat!.id)} and ${c.id}`).toBeUndefined()
      linked.set(cat!.id, c.id)
      // a detented knob has as many clicks as the setting has options
      if (c.kind === 'knob' && c.detents) expect(c.detents, `${f}: ${c.id} detents`).toBe(cat!.options!.length)
    }
  })
})

describe('control layouts vs the model they sit on', () => {
  it.each(files)('%s: every control is inside the casing (face-local mm) and a sloped top matches the spec profile', (f) => {
    const layout = load(f)
    const spec = JSON.parse(readFileSync(join(specs, f), 'utf8')) as { realSizeMm: { w: number; h: number; d: number }; build?: { profile?: [number, number][] } }
    const { w, h, d } = spec.realSizeMm
    const extent = (face: string): { x: number; y: number } =>
      face === 'io' || face === 'opposite' ? { x: w, y: h } : face === 'top' || face === 'bottom' ? { x: w, y: d } : { x: d, y: h }
    for (const c of layout.controls) {
      const e = extent(c.face)
      expect(c.xMm, `${f}: ${c.id} x`).toBeGreaterThanOrEqual(0)
      expect(c.xMm, `${f}: ${c.id} x`).toBeLessThanOrEqual(e.x)
      expect(c.yMm, `${f}: ${c.id} y`).toBeGreaterThanOrEqual(0)
      expect(c.yMm, `${f}: ${c.id} y`).toBeLessThanOrEqual(e.y)
      if (c.kind === 'fader') {
        const far = c.yMm + (c.axis === 'y' ? (c.reverse ? -1 : 1) * (c.travelMm ?? 0) : 0)
        const farX = c.xMm + (c.axis === 'x' ? (c.reverse ? -1 : 1) * (c.travelMm ?? 0) : 0)
        expect(far, `${f}: ${c.id} travel end y`).toBeGreaterThanOrEqual(0)
        expect(far, `${f}: ${c.id} travel end y`).toBeLessThanOrEqual(e.y)
        expect(farX, `${f}: ${c.id} travel end x`).toBeGreaterThanOrEqual(0)
        expect(farX, `${f}: ${c.id} travel end x`).toBeLessThanOrEqual(e.x)
      }
    }
    if (layout.topProfile && spec.build?.profile) expect(layout.topProfile, `${f}: topProfile`).toEqual(spec.build.profile)
  })
})
