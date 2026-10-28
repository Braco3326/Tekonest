import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NullEngine, Scene, ArcRotateCamera, Matrix, Vector3 } from '@babylonjs/core'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { DeviceSpawner } from '../../src/scene/DeviceSpawner'
import { CREATION_DEVICE_THEME } from '../../src/creation/sceneTheme'
import { DisposableBag } from '../../src/util/disposable'
import { labelScale, PortProxies, proxyRadius, screenRadiusPx, worldPerPx } from '../../src/creation/portProxies'

const FOV = 0.8
const H = 708

describe('proxyRadius (C18: an invisible pick proxy covers >= 24 CSS px)', () => {
  it('at 10 m the proxy is at least the world size of 12 px (the radius of a 24 px target)', () => {
    const r = proxyRadius(10, FOV, H)
    expect(r).toBeGreaterThanOrEqual(12 * worldPerPx(10, FOV, H) - 1e-9)
    // and it really reads as >= 12 px of radius on screen
    expect(screenRadiusPx(r, 10, FOV, H)).toBeGreaterThanOrEqual(12 - 1e-6)
  })

  it('is monotonic in distance: farther = a bigger world radius, so the screen size holds', () => {
    let last = 0
    for (const d of [0.5, 1, 2, 5, 10, 20, 40]) {
      const r = proxyRadius(d, FOV, H)
      expect(r).toBeGreaterThan(last)
      last = r
      expect(screenRadiusPx(r, d, FOV, H)).toBeGreaterThanOrEqual(12 - 1e-6)
    }
  })

  it('a taller viewport needs a smaller world radius for the same px; minPx scales it', () => {
    expect(proxyRadius(10, FOV, 1416)).toBeLessThan(proxyRadius(10, FOV, 708))
    expect(proxyRadius(10, FOV, H, 48)).toBeCloseTo(2 * proxyRadius(10, FOV, H, 24), 9)
  })

  it('never throws on degenerate input: a zero-size viewport or a zero distance gives a finite radius', () => {
    for (const r of [proxyRadius(0, FOV, H), proxyRadius(10, FOV, 0), proxyRadius(-3, FOV, H), proxyRadius(Number.NaN, FOV, H)])
      expect(Number.isFinite(r)).toBe(true)
  })
})

describe('labelScale (a label never exceeds maxPx on screen)', () => {
  it('gives the world size that spans maxPx; never more, at any distance', () => {
    for (const d of [0.3, 1, 5, 10, 25, 60]) {
      const size = labelScale(d, 160, FOV, H)
      expect(size / worldPerPx(d, FOV, H)).toBeLessThanOrEqual(160 + 1e-6)
    }
  })

  it('is monotonic in distance and in maxPx', () => {
    expect(labelScale(20, 100, FOV, H)).toBeGreaterThan(labelScale(10, 100, FOV, H))
    expect(labelScale(10, 200, FOV, H)).toBeGreaterThan(labelScale(10, 100, FOV, H))
  })

  it('defaults (no camera numbers) still cap', () => {
    expect(labelScale(10, 100) / worldPerPx(10, 0.8, 708)).toBeLessThanOrEqual(100 + 1e-6)
    expect(Number.isFinite(labelScale(0, 100))).toBe(true)
  })
})

describe('PortProxies on a real (headless) scene', () => {
  const registry = loadCatalog(catalogJson)
  // The spawner draws labels / the contact shadow on a 2D canvas: a stand-in (as sceneLook.test.ts).
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

  function setup(distance: number) {
    const scene = new Scene(new NullEngine({ renderWidth: 1000, renderHeight: H } as never)) // render size = the canvas stand-in's, so px mean px
    const camera = new ArcRotateCamera('cam', Math.PI / 2, 1.05, distance, new Vector3(0, 1, 0), scene)
    camera.fov = FOV
    scene.activeCamera = camera
    const spawner = new DeviceSpawner(scene, registry, CREATION_DEVICE_THEME)
    const inst = spawner.spawn('yamaha-ql1', new Vector3(0, 0, 0), 'ql1')
    const instances = new Map([['ql1', inst]])
    const canvas = { clientHeight: H, clientWidth: 1000 } as unknown as HTMLElement
    const bag = new DisposableBag()
    const proxies = new PortProxies({ scene, camera, canvas, instance: (id) => instances.get(id), instances: () => instances.values() }, bag)
    return { scene, camera, inst, instances, proxies, bag }
  }

  it('every port gets a hit area of at least 12 px radius at the default camera distance', () => {
    const { proxies, camera, inst, scene } = setup(20)
    camera.getViewMatrix(true)
    proxies.refresh()
    expect(inst.portMarkers.size).toBeGreaterThan(3)
    for (const port of inst.portMarkers.keys()) expect(proxies.hitRadiusPx({ instance: 'ql1', port })).toBeGreaterThanOrEqual(12 - 1e-6)
    scene.dispose()
  })

  it('a canvas that gets a little shorter (708 -> 694 px) never leaves a proxy under 12 px radius (the skip band is one-sided)', () => {
    const { proxies, camera, inst, scene } = setup(20)
    const canvas = (proxies as unknown as { host: { canvas: { clientHeight: number } } }).host.canvas
    camera.getViewMatrix(true)
    proxies.refresh()
    canvas.clientHeight = 694 // a 2 % shrink: the old sphere would read 11.998 px
    proxies.refresh()
    for (const port of inst.portMarkers.keys()) expect(proxies.hitRadiusPx({ instance: 'ql1', port }), port).toBeGreaterThanOrEqual(12 - 1e-6)
    canvas.clientHeight = 708 // and back: a rescale down within 2 % may be skipped (nothing to feel), the floor still holds
    proxies.refresh()
    for (const port of inst.portMarkers.keys()) expect(proxies.hitRadiusPx({ instance: 'ql1', port }), port).toBeGreaterThanOrEqual(12 - 1e-6)
    scene.dispose()
  })

  it('a camera view change rescales the proxies (an observer, no render loop): zoom out = a bigger world radius', () => {
    const { proxies, camera, inst, scene } = setup(5)
    camera.getViewMatrix(true)
    proxies.refresh()
    const port = [...inst.portMarkers.keys()][0]
    const sphere = scene.getMeshByName(`pick:ql1:${port}`)!
    sphere.computeWorldMatrix(true)
    const near = sphere.getBoundingInfo().boundingSphere.radiusWorld
    camera.radius = 40
    camera.getViewMatrix(true) // the view matrix changed: the observable rescales
    sphere.computeWorldMatrix(true)
    const far = sphere.getBoundingInfo().boundingSphere.radiusWorld
    expect(far).toBeGreaterThan(near * 2)
    expect(proxies.hitRadiusPx({ instance: 'ql1', port })).toBeGreaterThanOrEqual(12 - 1e-6)
    scene.dispose()
  })

  it('the proxies stay invisible and pickable; the permanent in-scene port labels are hidden', () => {
    const { proxies, camera, inst, scene } = setup(10)
    camera.getViewMatrix(true)
    proxies.refresh()
    const port = [...inst.portMarkers.keys()][0]
    const sphere = scene.getMeshByName(`pick:ql1:${port}`)!
    expect(sphere.visibility).toBe(0)
    expect(sphere.isPickable).toBe(true)
    expect(sphere.metadata.isPortMarker).toBe(true)
    for (const m of scene.meshes.filter((x) => x.name.startsWith('portlabel:ql1:'))) expect(m.isVisible).toBe(false)
    scene.dispose()
  })

  it('hover and marks restyle a marker and put it back; dispose leaves nothing behind', async () => {
    const { proxies, camera, inst, scene, bag } = setup(10)
    camera.getViewMatrix(true)
    proxies.refresh()
    const [a, b] = [...inst.portMarkers.keys()]
    const ma = inst.portMarkers.get(a)!
    const mb = inst.portMarkers.get(b)!
    const baseMat = ma.material
    proxies.mark({ instance: 'ql1', port: a }, new Map([[`ql1\u0000${b}`, 'dim']]))
    expect(ma.scaling.x).toBeGreaterThan(1) // the hovered port is drawn big enough to see
    expect(ma.material).not.toBe(baseMat)
    expect(mb.visibility).toBeLessThan(1)
    proxies.mark(null, null)
    expect(ma.scaling.x).toBe(1)
    expect(ma.material).toBe(baseMat)
    expect(mb.visibility).toBe(1)
    const before = camera.onViewMatrixChangedObservable.observers.length
    bag.dispose()
    await new Promise((r) => setTimeout(r, 0)) // Babylon unregisters an observer on the next tick
    expect(camera.onViewMatrixChangedObservable.observers.length).toBe(before - 1)
    scene.dispose()
  })

  it('independent oracle: a real pick hits within 11 px of a lone port and misses 40 px away (the radius is right, not just self-consistent)', () => {
    const { proxies, camera, scene, instances } = setup(25.6)
    const mic = new DeviceSpawner(scene, registry, CREATION_DEVICE_THEME).spawn('shure-sm58', new Vector3(0, 0, -9), 'sm58')
    instances.set('sm58', mic)
    scene.render()
    camera.getViewMatrix(true)
    proxies.refresh()
    for (const m of scene.meshes) m.computeWorldMatrix(true)
    const engine = scene.getEngine()
    const vp = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
    const c = Vector3.Project(mic.portMarkers.get('out-xlr')!.getAbsolutePosition(), Matrix.Identity(), scene.getTransformMatrix(), vp)
    const want = { instance: 'sm58', port: 'out-xlr' }
    for (const [dx, dy] of [[0, 0], [11, 0], [-11, 0], [0, 11], [0, -11]]) expect(proxies.portAt(c.x + dx, c.y + dy), `${dx},${dy}`).toEqual(want)
    // the reported radius is the real first-click radius: it hits out to ~hitRadiusPx and not beyond
    const rad = proxies.hitRadiusPx(want)
    expect(rad).toBeGreaterThanOrEqual(12 - 1e-6)
    expect(proxies.portAt(c.x + rad - 1, c.y)).toEqual(want)
    expect(proxies.portAt(c.x + rad + 3, c.y)).toBeNull()
    expect(proxies.portAt(c.x + 40, c.y + 40)).toBeNull()
    expect(proxies.portAt(c.x + 20, c.y)).toBeNull() // not a huge halo either: ~12 px, not 24
    scene.dispose()
  })

  it('portAt returns the port aimed at, even where far proxies overlap (closest centre to the ray)', () => {
    const { proxies, camera, inst, scene } = setup(30) // far: big overlapping proxies
    scene.render()
    camera.getViewMatrix(true)
    proxies.refresh()
    for (const m of scene.meshes) m.computeWorldMatrix(true)
    const engine = scene.getEngine()
    const vp = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
    let hits = 0
    for (const port of inst.portMarkers.keys()) {
      const w = inst.portMarkers.get(port)!.getAbsolutePosition()
      const s = Vector3.Project(w, Matrix.Identity(), scene.getTransformMatrix(), vp)
      expect(proxies.portAt(s.x, s.y)).toEqual({ instance: 'ql1', port })
      hits++
    }
    expect(hits).toBeGreaterThan(3)
    expect(proxies.portAt(1, 1)).toBeNull()
    scene.dispose()
  })
})
