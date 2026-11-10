import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MeshBuilder, NullEngine, Scene, Vector3, type AbstractMesh } from '@babylonjs/core'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { DeviceSpawner } from '../../src/scene/DeviceSpawner'
import { CREATION_DEVICE_THEME } from '../../src/creation/sceneTheme'
import { createMarkerRing, liftMarkerRing, LIFT_MAX_M, surfaceLiftM, ringVertexData } from '../../src/scene/portMarkerMesh'
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

describe('surfaceLiftM (a port in a pocket: the ring comes out onto the face around it)', () => {
  const OUT = new Vector3(0, 0, -1)
  const RIGHT = new Vector3(1, 0, 0)
  const UP = new Vector3(0, 1, 0)
  const box = (scene: Scene, name: string, w: number, h: number, d: number, at: [number, number, number]): AbstractMesh => {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene)
    m.position.set(...at)
    m.computeWorldMatrix(true)
    return m
  }
  /** A rear plate: the floor in the plane z = 0 (surface at z = 0) and a face `depth` m in front of it (surface at z = -depth) with a round-ish hole of `hole` m (four bars around a square opening). */
  function pocketScene(depth: number, hole: number): { scene: Scene; meshes: AbstractMesh[] } {
    const scene = new Scene(new NullEngine())
    const t = 0.002
    const z = -depth + t / 2 // outward is -Z: the face spans z in [-depth, -depth + t], so its front surface is at -depth
    const bar = 0.1
    const meshes = [
      box(scene, 'floor', 0.3, 0.3, t, [0, 0, t / 2]), // front surface at z = 0
      box(scene, 'left', bar, 0.3, t, [-(hole / 2 + bar / 2), 0, z]),
      box(scene, 'right', bar, 0.3, t, [hole / 2 + bar / 2, 0, z]),
      box(scene, 'top', hole, bar, t, [0, hole / 2 + bar / 2, z]),
      box(scene, 'bottom', hole, bar, t, [0, -(hole / 2 + bar / 2), z]),
    ]
    return { scene, meshes }
  }

  it('finds the depth of a 13.8 mm pocket with a 24 mm opening, for a 30 mm ring', () => {
    const { scene, meshes } = pocketScene(0.0138, 0.024)
    const lift = surfaceLiftM(meshes, new Vector3(0, 0, 0), OUT, RIGHT, UP, 0.03)
    expect(lift).toBeCloseTo(0.0138, 4)
    scene.dispose()
  })

  it('a flat panel (no pocket) gives 0, so the ring stays on the port', () => {
    const scene = new Scene(new NullEngine())
    const panel = box(scene, 'panel', 0.3, 0.3, 0.004, [0, 0, 0.002])
    expect(surfaceLiftM([panel], new Vector3(0, 0, 0), OUT, RIGHT, UP, 0.03)).toBe(0)
    scene.dispose()
  })

  it('no surface at all, a bad ring size, or a recess deeper than 6 cm (another part of the body) give 0, never NaN', () => {
    const empty = new Scene(new NullEngine())
    expect(surfaceLiftM([], new Vector3(0, 0, 0), OUT, RIGHT, UP, 0.03)).toBe(0)
    empty.dispose()
    const deep = pocketScene(0.09, 0.024)
    expect(surfaceLiftM(deep.meshes, new Vector3(0, 0, 0), OUT, RIGHT, UP, 0.03)).toBe(0)
    expect(LIFT_MAX_M).toBeLessThan(0.09)
    deep.scene.dispose()
    const ok = pocketScene(0.02, 0.024)
    for (const outer of [0, -1, Number.NaN]) expect(Number.isFinite(surfaceLiftM(ok.meshes, new Vector3(0, 0, 0), OUT, RIGHT, UP, outer))).toBe(true)
    ok.scene.dispose()
  })

  it('a ring whose circle falls INSIDE the opening (a big pocket) is not lifted: the probes see the floor', () => {
    const { scene, meshes } = pocketScene(0.0138, 0.1)
    expect(surfaceLiftM(meshes, new Vector3(0, 0, 0), OUT, RIGHT, UP, 0.03)).toBe(0)
    scene.dispose()
  })

  it('liftMarkerRing moves the ring outward (toward -Z) by its vertices and is idempotent: bounds extents, position and scale are unchanged', () => {
    const scene = new Scene(new NullEngine())
    const ring = createMarkerRing(scene, 'port:x:y', 0.03)
    ring.position.set(1, 2, 3)
    liftMarkerRing(ring, 0.0138)
    const zs = ring.getVerticesData('position')!.filter((_, i) => i % 3 === 2)
    for (const z of zs) expect(z).toBeCloseTo(-0.0138, 9)
    expect(ring.getBoundingInfo().boundingBox.extendSize.x * 2).toBeCloseTo(0.03, 9)
    expect([ring.position.x, ring.position.y, ring.position.z, ring.scaling.x]).toEqual([1, 2, 3, 1])
    liftMarkerRing(ring, 0.0138) // again: no further move
    for (const z of ring.getVerticesData('position')!.filter((_, i) => i % 3 === 2)) expect(z).toBeCloseTo(-0.0138, 9)
    liftMarkerRing(ring, 0) // back
    for (const z of ring.getVerticesData('position')!.filter((_, i) => i % 3 === 2)) expect(z).toBeCloseTo(0, 9)
    scene.dispose()
  })
})
