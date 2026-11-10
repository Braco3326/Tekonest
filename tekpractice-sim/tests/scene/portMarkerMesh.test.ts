import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NullEngine, Scene, Vector3 } from '@babylonjs/core'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { DeviceSpawner } from '../../src/scene/DeviceSpawner'
import { CREATION_DEVICE_THEME } from '../../src/creation/sceneTheme'
import { createMarkerRing, ringVertexData } from '../../src/scene/portMarkerMesh'
import { markerDiameterM } from '../../src/scene/portMarkerSize'

const bounds = (positions: ArrayLike<number>): { min: number[]; max: number[] } => {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k])
      max[k] = Math.max(max[k], positions[i + k])
    }
  return { min, max }
}

describe('ringVertexData (a flat annulus in the XY plane)', () => {
  it('has 32 segments = 64 triangles, a bounding box of the outer diameter, no NaN', () => {
    const vd = ringVertexData(0.03)
    expect(vd.indices!.length / 3).toBe(64)
    const b = bounds(vd.positions!)
    expect(b.max[0] - b.min[0]).toBeCloseTo(0.03, 9)
    expect(b.max[1] - b.min[1]).toBeCloseTo(0.03, 9)
    expect(b.max[2] - b.min[2]).toBe(0) // flat
    for (const v of [...vd.positions!, ...vd.normals!, ...vd.indices!]) expect(Number.isFinite(v)).toBe(true)
  })

  it('the ring is 12 % of the diameter wide, and never under 1.2 mm (a 10 mm ring is 1.2 mm wide)', () => {
    const radii = (outer: number): { rMax: number; rMin: number } => {
      const p = ringVertexData(outer).positions!
      const r: number[] = []
      for (let i = 0; i < p.length; i += 3) r.push(Math.hypot(p[i], p[i + 1]))
      return { rMax: Math.max(...r), rMin: Math.min(...r) }
    }
    const big = radii(0.05)
    expect(big.rMax - big.rMin).toBeCloseTo(0.006, 9)
    const small = radii(0.01)
    expect(small.rMax).toBeCloseTo(0.005, 9)
    expect(small.rMax - small.rMin).toBeGreaterThanOrEqual(0.0012 - 1e-12)
    expect(small.rMax - small.rMin).toBeCloseTo(0.0012, 9)
  })

  it('the inside is open: no triangle covers the centre', () => {
    const vd = ringVertexData(0.03)
    const p = vd.positions!
    const idx = vd.indices!
    for (let t = 0; t < idx.length; t += 3) {
      const rs = [0, 1, 2].map((k) => Math.hypot(p[idx[t + k] * 3], p[idx[t + k] * 3 + 1]))
      expect(Math.min(...rs)).toBeGreaterThan(0.005)
    }
  })

  it('a degenerate size still gives a finite mesh (never NaN)', () => {
    for (const outer of [0, -1, Number.NaN]) {
      const vd = ringVertexData(outer)
      for (const v of vd.positions!) expect(Number.isFinite(v)).toBe(true)
    }
  })
})

describe('createMarkerRing', () => {
  it('makes a named, unpickable mesh of the outer diameter', () => {
    const scene = new Scene(new NullEngine())
    const m = createMarkerRing(scene, 'port:x:y', 0.03)
    expect(m.name).toBe('port:x:y')
    expect(m.isPickable).toBe(false)
    expect(m.getBoundingInfo().boundingBox.extendSize.x * 2).toBeCloseTo(0.03, 9)
    expect(m.getTotalIndices() / 3).toBe(64)
    scene.dispose()
  })
})

describe('spawned markers are rings sized from their connector', () => {
  const registry = loadCatalog(catalogJson)
  const g = globalThis as Record<string, unknown>
  const saved: Record<string, unknown> = {}
  const fakeCanvas2d = () => {
    const ctx: unknown = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? el : () => ({ width: 10, addColorStop() {} })), set: () => true })
    const el = { width: 1, height: 1, style: {}, getContext: () => ctx }
    return el
  }
  beforeEach(() => {
    saved.window = g.window
    saved.document = g.document
    g.window = Object.assign(new EventTarget(), { matchMedia: () => ({ matches: true }) })
    g.document = Object.assign(new EventTarget(), { createElement: fakeCanvas2d })
  })
  afterEach(() => {
    g.window = saved.window
    g.document = saved.document
  })

  it('every port marker of every catalog device is the connector size x 1.25 (+- 1 %), restScale 1, not pickable', () => {
    const scene = new Scene(new NullEngine())
    const spawner = new DeviceSpawner(scene, registry, CREATION_DEVICE_THEME, { alignFront: true })
    let checked = 0
    for (const dev of registry.deviceById.values()) {
      const inst = spawner.spawn(dev.id, Vector3.Zero(), `i-${dev.id}`)
      for (const port of dev.ports) {
        const marker = inst.portMarkers.get(port.portId)!
        const want = markerDiameterM(port.connector)
        const got = marker.getBoundingInfo().boundingBox.extendSize.x * 2
        expect(got, `${dev.id}/${port.portId}`).toBeGreaterThan(want * 0.99)
        expect(got, `${dev.id}/${port.portId}`).toBeLessThan(want * 1.01)
        expect(marker.metadata?.restScale, `${dev.id}/${port.portId}`).toBe(1)
        expect(marker.scaling.x).toBe(1)
        expect(marker.isPickable).toBe(false)
        // a ring, not a disc: it is flat and faces along z
        expect(marker.getBoundingInfo().boundingBox.extendSize.z).toBeLessThan(0.001)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(50)
    scene.dispose()
  })

  it('the marker materials are double sided (the ring is seen from either side)', () => {
    const scene = new Scene(new NullEngine())
    const inst = new DeviceSpawner(scene, registry, CREATION_DEVICE_THEME).spawn('yamaha-ql1', Vector3.Zero(), 'ql1')
    for (const marker of inst.portMarkers.values()) expect(marker.material!.backFaceCulling).toBe(false)
    scene.dispose()
  })
})
