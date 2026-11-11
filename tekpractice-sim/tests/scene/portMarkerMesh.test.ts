import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MeshBuilder, NullEngine, Scene, Vector3, type AbstractMesh } from '@babylonjs/core'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { DeviceSpawner } from '../../src/scene/DeviceSpawner'
import { CREATION_DEVICE_THEME } from '../../src/creation/sceneTheme'
import { createMarkerRing, liftMarkerRing, LIFT_MAX_M, markerFaceNormal, orientMarkerRing, surfaceLiftM, ringVertexData } from '../../src/scene/portMarkerMesh'
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

  it('every port marker of every catalog device is the connector size x 1.2 (+- 1 %), restScale 1, not pickable', () => {
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

  it('a ring wider than a rectangular opening on ONE axis only (24 mm ring, 25.4 x 17.4 mm outlet, 9 mm deep) still comes out onto the face; with an opening much bigger than the ring (80 x 60 mm) it stays on the floor', () => {
    const scene = new Scene(new NullEngine())
    const t = 0.002
    const rect = (w: number, h: number, depth: number): AbstractMesh[] => {
      const z = -depth + t / 2
      const bar = 0.1
      return [
        box(scene, 'floor', 0.3, 0.3, t, [0, 0, t / 2]),
        box(scene, 'left', bar, 0.3, t, [-(w / 2 + bar / 2), 0, z]),
        box(scene, 'right', bar, 0.3, t, [w / 2 + bar / 2, 0, z]),
        box(scene, 'top', w, bar, t, [0, h / 2 + bar / 2, z]),
        box(scene, 'bottom', w, bar, t, [0, -(h / 2 + bar / 2), z]),
      ]
    }
    const outlet = rect(0.0254, 0.0174, 0.009)
    expect(surfaceLiftM(outlet, new Vector3(0, 0, 0), OUT, RIGHT, UP, markerDiameterM('iec-c13'))).toBeCloseTo(0.009, 4)
    const tall = rect(0.08, 0.06, 0.009)
    expect(surfaceLiftM(tall, new Vector3(0, 0, 0), OUT, RIGHT, UP, markerDiameterM('iec-c13'))).toBe(0)
    scene.dispose()
  })

  it('a ring that FITS in the opening (a 23.4 mm XLR ring in a 24 mm hole, 25.6 mm deep, the DBR12) is still lifted onto the face around it: the probes start 8 mm outside the ring', () => {
    const { scene, meshes } = pocketScene(0.0256, 0.026)
    expect(surfaceLiftM(meshes, new Vector3(0, 0, 0), OUT, RIGHT, UP, 0.0234)).toBeCloseTo(0.0256, 4)
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

describe('markerFaceNormal / orientMarkerRing (a port on a side or the base: the ring faces it, no longer edge-on)', () => {
  const lo = new Vector3(-0.0775, 0, -0.117)
  const hi = new Vector3(0.0775, 0.08, 0.117) // a 155 x 80 x 234 mm box (the Scoopy+ S)
  it('a port on the +x side is +X, on -x is -X, on the base is -Y, on the top is +Y', () => {
    expect(markerFaceNormal(new Vector3(0.0775, 0.022, 0.05), lo, hi)!.asArray()).toEqual([1, 0, 0])
    expect(markerFaceNormal(new Vector3(-0.0775, 0.022, 0.05), lo, hi)!.asArray()).toEqual([-1, 0, 0])
    expect(markerFaceNormal(new Vector3(0, 0, 0), lo, hi)!.asArray()).toEqual([0, -1, 0])
    expect(markerFaceNormal(new Vector3(0, 0.08, 0), lo, hi)!.asArray()).toEqual([0, 1, 0])
  })
  it('a rear / front port (on a z face, even near an edge or in a pocket), an interior point and bad numbers give null: the ring already faces z', () => {
    expect(markerFaceNormal(new Vector3(0.0775, 0.022, -0.117), lo, hi)).toBeNull() // on the rear edge: a rear port
    expect(markerFaceNormal(new Vector3(0.02, 0.04, -0.117), lo, hi)).toBeNull()
    expect(markerFaceNormal(new Vector3(0.02, 0.04, 0.117), lo, hi)).toBeNull()
    expect(markerFaceNormal(new Vector3(0.02, 0.04, -0.09), lo, hi)).toBeNull() // 27 mm deep pocket floor, away from the side faces
    expect(markerFaceNormal(new Vector3(Number.NaN, 0, 0), lo, hi)).toBeNull()
  })
  it('orientMarkerRing turns the ring so that its -Z axis points along the normal; the bounds extent, position and scale stay; null puts it back', () => {
    const scene = new Scene(new NullEngine())
    const ring = createMarkerRing(scene, 'port:x:y', 0.03)
    ring.position.set(0.07, 0.02, 0.05)
    orientMarkerRing(ring, new Vector3(1, 0, 0))
    ring.computeWorldMatrix(true)
    const out = Vector3.TransformNormal(new Vector3(0, 0, -1), ring.getWorldMatrix())
    expect([out.x, out.y + 0, out.z + 0].map((v) => Math.round(v * 1e6) / 1e6 + 0)).toEqual([1, 0, 0])
    expect(ring.getBoundingInfo().boundingBox.extendSize.x * 2).toBeCloseTo(0.03, 9)
    expect([ring.position.x, ring.position.y, ring.position.z, ring.scaling.x]).toEqual([0.07, 0.02, 0.05, 1])
    orientMarkerRing(ring, new Vector3(0, -1, 0))
    ring.computeWorldMatrix(true)
    const down = Vector3.TransformNormal(new Vector3(0, 0, -1), ring.getWorldMatrix())
    expect(down.y).toBeCloseTo(-1, 6)
    orientMarkerRing(ring, null)
    ring.computeWorldMatrix(true)
    expect(Vector3.TransformNormal(new Vector3(0, 0, -1), ring.getWorldMatrix()).z).toBeCloseTo(-1, 6)
    scene.dispose()
  })
})

describe('marker halo (Wave 5c E2: the compatible-port glow of a flat ring)', () => {
  it('haloVertexData is a flat annulus wider than the ring on both sides, in the same plane', async () => {
    const { haloVertexData } = await import('../../src/scene/portMarkerMesh')
    const ring = bounds(ringVertexData(0.03).positions!)
    const halo = haloVertexData(0.03)
    const hb = bounds(halo.positions!)
    expect(hb.max[0]).toBeGreaterThan(ring.max[0]) // reaches past the outer edge
    expect(hb.max[2] - hb.min[2]).toBe(0)
    // and inward of the ring's inner edge: the smallest radius of the halo is under the ring's
    const rad = (p: ArrayLike<number>): number[] => Array.from({ length: p.length / 3 }, (_, i) => Math.hypot(p[3 * i], p[3 * i + 1]))
    expect(Math.min(...rad(halo.positions!))).toBeLessThan(Math.min(...rad(ringVertexData(0.03).positions!)))
    for (const v of [...halo.positions!, ...halo.indices!]) expect(Number.isFinite(v)).toBe(true)
  })

  it('attachMarkerHalo parents a halo to the ring (it scales, lifts and turns with it), sits a hair behind, is not pickable, and disposes with the ring', async () => {
    const { attachMarkerHalo } = await import('../../src/scene/portMarkerMesh')
    const { Color3 } = await import('@babylonjs/core')
    const scene = new Scene(new NullEngine())
    const ring = createMarkerRing(scene, 'ring', 0.03)
    const halo = attachMarkerHalo(scene, ring, Color3.FromHexString('#ff8800'))
    expect(halo.parent).toBe(ring)
    expect(halo.isPickable).toBe(false)
    expect(halo.position.z).toBeGreaterThan(0) // behind the ring (the ring faces -Z)
    expect(halo.position.z).toBeLessThan(0.002)
    ring.scaling.set(3, 3, 1)
    ring.computeWorldMatrix(true)
    halo.computeWorldMatrix(true)
    expect(halo.getAbsolutePosition().z).toBeCloseTo(halo.position.z, 9) // z scale stays 1: the halo does not drift
    ring.dispose()
    expect(halo.isDisposed()).toBe(true)
    scene.dispose()
  })
})
