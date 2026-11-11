/**
 * Wave 0, Task 0.5: the placeholder box of a device with no model uses the plan's size when the proposal carries one
 * (axis by axis), else the category footprint, else 0.4 x 0.3 x 0.3 m.
 */
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NullEngine, Scene, Vector3 } from '@babylonjs/core'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { parseProposals, registerProposals } from '../../src/creation/betaDevices'
import { DeviceSpawner } from '../../src/scene/DeviceSpawner'
import { DEFAULT_SIZE, SIZE_BY_CATEGORY, categoryFootprintM, deviceFootprint, estimateSizeMm } from '../../src/scene/placeholderSize'

const dev = (category: string, sizeMm?: Record<string, number>) => ({ realWorld: { brand: 'B', model: 'M', category, typicalUse: 'u', notes: '' }, ...(sizeMm ? { sizeMm } : {}) })

describe('deviceFootprint', () => {
  it('uses the plan size when it is complete (mm to metres)', () => {
    expect(deviceFootprint(dev('amplifier', { w: 483, d: 400, h: 88 }))).toEqual({ w: 0.483, d: 0.4, h: 0.088 })
  })
  it('mixes axes: a plan that knows only the height takes width and depth from the category', () => {
    const f = deviceFootprint(dev('stagebox', { h: 137 }))
    expect(f).toEqual({ w: 0.48, h: 0.137, d: 0.4 })
  })
  it('without a plan size: the category footprint, then the default 0.4 x 0.3 x 0.3 m (as before Wave 0)', () => {
    expect(deviceFootprint(dev('console'))).toEqual({ w: 1.0, h: 0.25, d: 0.55 })
    expect(deviceFootprint(dev('amplifier'))).toEqual({ w: 0.4, h: 0.3, d: 0.3 })
    expect(DEFAULT_SIZE).toEqual([0.4, 0.3, 0.3])
    expect(categoryFootprintM('nope')).toEqual({ w: 0.4, h: 0.3, d: 0.3 })
  })
  it('ignores a zero, negative or NaN axis instead of drawing a flat or invisible box', () => {
    expect(deviceFootprint(dev('console', { w: 0, d: -5, h: Number.NaN }))).toEqual({ w: 1.0, h: 0.25, d: 0.55 })
  })
  it('the category table is exactly the one that shipped before Wave 0 (15 categories, values unchanged)', () => {
    expect(Object.keys(SIZE_BY_CATEGORY)).toHaveLength(15)
    expect(SIZE_BY_CATEGORY['microphone']).toEqual([0.07, 0.22, 0.07])
    expect(SIZE_BY_CATEGORY['powered-speaker']).toEqual([0.4, 0.62, 0.36])
  })
})

describe('estimateSizeMm (a beta-modelled device with a partial size: never a zero, always says what it estimated)', () => {
  it('keeps the plan axes and fills the others from the category, listing them', () => {
    const r = estimateSizeMm('audio-interface', { w: 482.6, h: 44.5 })
    expect(r.sizeMm).toEqual({ w: 482.6, d: 300, h: 44.5 })
    expect(r.estimated).toEqual(['d'])
  })
  it('a microphone (round section) takes its missing width or depth from the other', () => {
    expect(estimateSizeMm('microphone', { w: 25, h: 155.7 }).sizeMm).toEqual({ w: 25, d: 25, h: 155.7 })
    expect(estimateSizeMm('microphone', { d: 30, h: 100 }).sizeMm).toEqual({ w: 30, d: 30, h: 100 })
  })
  it('a complete size is returned as it is, nothing estimated; an empty one is wholly the category footprint', () => {
    expect(estimateSizeMm('console', { w: 1, d: 2, h: 3 })).toEqual({ sizeMm: { w: 1, d: 2, h: 3 }, estimated: [] })
    const all = estimateSizeMm('console', {})
    expect(all.estimated).toEqual(['w', 'd', 'h'])
    for (const v of Object.values(all.sizeMm)) expect(v).toBeGreaterThan(0)
  })
})

describe('the spawner draws the placeholder at the proposal size', () => {
  const g = globalThis as Record<string, unknown>
  let savedDoc: unknown
  beforeEach(() => {
    const ctx: unknown = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? el : () => ({ width: 10, addColorStop() {} })), set: () => true })
    const el = { width: 1, height: 1, style: {}, getContext: () => ctx }
    savedDoc = g.document
    g.document = { createElement: () => el, addEventListener() {}, removeEventListener() {} }
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => {
    g.document = savedDoc
    vi.restoreAllMocks()
  })

  const entry = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    label: `Proposition ${id}`,
    levels: [],
    realWorld: { brand: 'B', model: id, category: 'amplifier', typicalUse: 'u', notes: '' },
    ports: [{ portId: 'in-1', dir: 'in', connector: 'xlr3-f', signal: 'line-level-pro' }],
    ...over,
  })
  const boxSize = (spawner: DeviceSpawner, id: string) => {
    const inst = spawner.spawn(id, new Vector3(0, 0, 0), 'x')
    const box = inst.root.getChildMeshes(true).find((m) => m.name.startsWith('box:'))!
    box.computeWorldMatrix(true)
    const b = box.getBoundingInfo().boundingBox
    return { w: b.maximum.x - b.minimum.x, h: b.maximum.y - b.minimum.y, d: b.maximum.z - b.minimum.z }
  }

  it('a proposal with sizeMm: the box is that size; one without: the category / default footprint, as before', () => {
    const reg = loadCatalog(catalogJson)
    const parsed = parseProposals({ devices: [entry('p-sized', { sizeMm: { w: 483, d: 400, h: 88 } }), entry('p-plain')] }, reg)
    expect(parsed.skipped).toEqual([])
    registerProposals(reg, parsed.devices)
    const spawner = new DeviceSpawner(new Scene(new NullEngine()), reg)
    const sized = boxSize(spawner, 'p-sized')
    expect(sized.w).toBeCloseTo(0.483, 6)
    expect(sized.d).toBeCloseTo(0.4, 6)
    expect(sized.h).toBeCloseTo(0.088, 6)
    const plain = boxSize(spawner, 'p-plain')
    expect([plain.w, plain.h, plain.d].map((v) => Number(v.toFixed(6)))).toEqual([0.4, 0.3, 0.3])
  })

  it('the real proposals file: every proposal with a plan size spawns a box of that size (axes the plan has)', () => {
    const reg = loadCatalog(catalogJson)
    const file = JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as { devices: { id: string; sizeMm?: { w?: number; d?: number; h?: number } }[] }
    const parsed = parseProposals(file, reg)
    registerProposals(reg, parsed.devices)
    const withSize = file.devices.filter((d) => d.sizeMm && d.sizeMm.w && d.sizeMm.d && d.sizeMm.h)
    expect(withSize.length).toBeGreaterThan(10)
    const spawner = new DeviceSpawner(new Scene(new NullEngine()), reg)
    for (const d of withSize.slice(0, 6)) {
      const s = boxSize(spawner, d.id)
      expect(s.w, d.id).toBeCloseTo(d.sizeMm!.w! / 1000, 5)
      expect(s.h, d.id).toBeCloseTo(d.sizeMm!.h! / 1000, 5)
      expect(s.d, d.id).toBeCloseTo(d.sizeMm!.d! / 1000, 5)
    }
  })
})
