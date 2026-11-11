import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NullEngine, Scene, ArcRotateCamera, Matrix, Vector3 } from '@babylonjs/core'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { DeviceSpawner } from '../../src/scene/DeviceSpawner'
import { CREATION_DEVICE_THEME } from '../../src/creation/sceneTheme'
import { DisposableBag } from '../../src/util/disposable'
import { markerDiameterM } from '../../src/scene/portMarkerSize'
import { liftMarkerRing } from '../../src/scene/portMarkerMesh'
import { HIGHLIGHT_PX, labelScale, PortProxies, proxyRadius, RING_MAX_GROW, RING_MIN_PX, ringScale, screenRadiusPx, worldPerPx } from '../../src/creation/portProxies'

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

describe('ringScale (a marker ring never draws under 9 CSS px, never grows past 1.6x at close range)', () => {
  it('exports the rule: 9 px floor, 1.6x cap', () => {
    expect(RING_MIN_PX).toBe(9)
    expect(RING_MAX_GROW).toBe(1.6)
  })

  it('close: a 30 mm ring at 0.3 m is far over 9 px, so the scale stays 1', () => {
    expect(ringScale(0.03, 0.3, FOV, H)).toBe(1)
  })

  it('far: at 20 m a 30 mm ring is scaled up until it spans >= 9 px (and not much more)', () => {
    const s = ringScale(0.03, 20, FOV, H)
    const px = (0.03 * s) / worldPerPx(20, FOV, H)
    expect(px).toBeGreaterThanOrEqual(RING_MIN_PX - 1e-9)
    expect(px).toBeLessThan(RING_MIN_PX + 0.5)
    expect(s).toBeGreaterThan(1)
  })

  it('never shrinks a ring and never grows one that already spans >= 9 px (so never past 1.6x at close range)', () => {
    for (const d of [0.05, 0.2, 0.5, 1, 2, 3, 6, 12, 30, 80]) {
      for (const rest of [0.008, 0.015, 0.03, 0.05]) {
        const s = ringScale(rest, d, FOV, H)
        expect(s, `${rest}@${d}`).toBeGreaterThanOrEqual(1)
        const px = rest / worldPerPx(d, FOV, H)
        if (px >= RING_MIN_PX) expect(s, `${rest}@${d}`).toBe(1)
        else expect((rest * s) / worldPerPx(d, FOV, H), `${rest}@${d}`).toBeGreaterThanOrEqual(RING_MIN_PX - 1e-9)
      }
    }
  })

  it('is finite for degenerate input (distance 0 / NaN / negative, no viewport, bad size)', () => {
    for (const [rest, d, h] of [[0.03, 0, H], [0.03, Number.NaN, H], [0.03, -2, H], [0.03, 5, 0], [0, 5, H], [Number.NaN, 5, H], [-1, 5, H]] as const) {
      const s = ringScale(rest, d, FOV, h)
      expect(Number.isFinite(s), `${rest},${d},${h}`).toBe(true)
      expect(s).toBeGreaterThanOrEqual(1)
    }
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

  function setup(distance: number, selected: { id: string | null } = { id: null }) {
    const scene = new Scene(new NullEngine({ renderWidth: 1000, renderHeight: H } as never)) // render size = the canvas stand-in's, so px mean px
    const camera = new ArcRotateCamera('cam', Math.PI / 2, 1.05, distance, new Vector3(0, 1, 0), scene)
    camera.fov = FOV
    scene.activeCamera = camera
    const spawner = new DeviceSpawner(scene, registry, CREATION_DEVICE_THEME)
    const inst = spawner.spawn('yamaha-ql1', new Vector3(0, 0, 0), 'ql1')
    const instances = new Map([['ql1', inst]])
    const canvas = { clientHeight: H, clientWidth: 1000 } as unknown as HTMLElement
    const bag = new DisposableBag()
    const proxies = new PortProxies({ scene, camera, canvas, instance: (id) => instances.get(id), instances: () => instances.values(), selected: () => selected.id }, bag)
    return { scene, camera, inst, instances, proxies, bag, selected }
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
    const rest = ma.scaling.x // the ring at rest from here: 1, or a little over it where the 9 px floor of a far view applies
    proxies.mark({ instance: 'ql1', port: a }, new Map([[`ql1\u0000${b}`, 'dim']]))
    expect(ma.scaling.x).toBeGreaterThan(rest) // the hovered port is drawn big enough to see
    expect(ma.material).not.toBe(baseMat)
    expect(mb.visibility).toBeLessThan(1)
    proxies.mark(null, null)
    expect(ma.scaling.x).toBe(rest)
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

  // ── Final review 3 (controller ruling): the first-click radius depends on the state ──────────────
  /** Canvas px of every port of ql1, and what is under a point. */
  function screens(setupResult: ReturnType<typeof setup>) {
    const { scene, camera, inst } = setupResult
    scene.render()
    camera.getViewMatrix(true)
    setupResult.proxies.refresh()
    for (const m of scene.meshes) m.computeWorldMatrix(true)
    const engine = scene.getEngine()
    const vp = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
    const at = [...inst.portMarkers.keys()].map((port) => {
      const c = Vector3.Project(inst.portMarkers.get(port)!.getAbsolutePosition(), Matrix.Identity(), scene.getTransformMatrix(), vp)
      return { port, x: c.x, y: c.y }
    })
    const bodyAt = (x: number, y: number): string | null => {
      const hit = scene.pick(x, y, (m) => m.metadata?.isDeviceBody === true && m.isEnabled() && m.isVisible)
      return hit?.hit ? (hit.pickedMesh?.metadata?.instanceId as string) : null
    }
    return { at, bodyAt }
  }
  /** A port, and a point 9 px from it that is over the body and at least 8 px from every other port: only a 12 px radius reaches the port. */
  function nineOff(s: ReturnType<typeof screens>) {
    for (const p of s.at)
      for (const [dx, dy] of [[9, 0], [-9, 0], [0, 9], [0, -9]]) {
        const x = p.x + dx
        const y = p.y + dy
        if (s.bodyAt(x, y) !== 'ql1') continue
        if (s.at.some((q) => q !== p && Math.hypot(q.x - x, q.y - y) < 8)) continue
        return { port: p, x, y }
      }
    return null
  }

  it('over an UNSELECTED device body a first click 9 px off a connector does not take the port; ON the connector (<= 3 px) it is; selected, or with a cable in hand, 9 px is (12 px radius)', () => {
    const t = setup(5)
    const s = screens(t)
    const plan = nineOff(s)
    expect(plan, 'a ql1 connector with a 9 px point on the body, 8+ px from every other port').not.toBeNull()
    const want = { instance: 'ql1', port: plan!.port.port }
    expect(t.proxies.portAt(plan!.x, plan!.y)).toBeNull() // tight (6 px) over an unselected body
    expect(t.proxies.portAt(plan!.port.x + 3, plan!.port.y)).toEqual(want) // the connector itself still patches
    expect(t.proxies.portAt(plan!.x, plan!.y, true)).toEqual(want) // a cable in hand: 12 px
    t.selected.id = 'ql1'
    expect(t.proxies.portAt(plan!.x, plan!.y)).toEqual(want) // the selected device: 12 px
    t.scene.dispose()
  })

  it('the radius reported is the one a first click gets: tight (6 <= r < 12) on an unselected body, >= 12 selected or with a cable in hand; the proxy (hitRadiusPx) stays >= 12', () => {
    const t = setup(5)
    const s = screens(t)
    const onBody = s.at.filter((p) => s.bodyAt(p.x, p.y) === 'ql1')
    expect(onBody.length).toBeGreaterThan(0)
    for (const p of onBody) {
      const ref = { instance: 'ql1', port: p.port }
      const tight = t.proxies.firstClickRadiusPx(ref)
      expect(tight, p.port).toBeGreaterThanOrEqual(6 - 1e-6)
      expect(tight, p.port).toBeLessThan(12)
      expect(t.proxies.firstClickRadiusPx(ref, true), p.port).toBeGreaterThanOrEqual(12 - 1e-6)
      expect(t.proxies.hitRadiusPx(ref), p.port).toBeGreaterThanOrEqual(12 - 1e-6)
    }
    t.selected.id = 'ql1'
    for (const p of onBody) expect(t.proxies.firstClickRadiusPx({ instance: 'ql1', port: p.port }), p.port).toBeGreaterThanOrEqual(12 - 1e-6)
    t.scene.dispose()
  })

  it('a port with no body behind the pointer keeps the 12 px radius even on an unselected device (empty space around a connector that sticks out)', () => {
    const t = setup(5)
    const mic = new DeviceSpawner(t.scene, registry, CREATION_DEVICE_THEME).spawn('shure-sm58', new Vector3(-1.5, 0, 0.5), 'm')
    t.instances.set('m', mic)
    t.scene.render()
    t.camera.getViewMatrix(true)
    t.proxies.refresh()
    for (const m of t.scene.meshes) m.computeWorldMatrix(true)
    const engine = t.scene.getEngine()
    const vp = t.camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
    const c = Vector3.Project(mic.portMarkers.get('out-xlr')!.getAbsolutePosition(), Matrix.Identity(), t.scene.getTransformMatrix(), vp)
    const bodyAt = (x: number, y: number): boolean => !!t.scene.pick(x, y, (m) => m.metadata?.isDeviceBody === true && m.isEnabled() && m.isVisible)?.hit
    const off = [[9, 0], [-9, 0], [0, 9], [0, -9]].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })).filter((q) => !bodyAt(q.x, q.y))
    expect(off.length, 'a point 9 px from the mic connector that is off every body').toBeGreaterThan(0)
    for (const q of off) expect(t.proxies.portAt(q.x, q.y), `${q.x},${q.y}`).toEqual({ instance: 'm', port: 'out-xlr' })
    // (the radius reported is the one OVER the body, where the connector sits: tight; off the body the port keeps its 12 px, as just checked)
    expect(t.proxies.firstClickRadiusPx({ instance: 'm', port: 'out-xlr' })).toBeLessThan(12)
    t.scene.dispose()
  })

  it('where proxies overlap in depth, the NEAREST port wins over a rear one that is closer to the ray', () => {
    const t = setup(8)
    const mic = new DeviceSpawner(t.scene, registry, CREATION_DEVICE_THEME).spawn('shure-sm58', new Vector3(0.6, 0, 0.4), 'front')
    const rear = new DeviceSpawner(t.scene, registry, CREATION_DEVICE_THEME).spawn('shure-sm58', new Vector3(0.6, 0, -1.6), 'rear')
    t.instances.set('front', mic)
    t.instances.set('rear', rear)
    t.scene.render()
    t.camera.getViewMatrix(true)
    t.proxies.refresh()
    for (const m of t.scene.meshes) m.computeWorldMatrix(true)
    const engine = t.scene.getEngine()
    const vp = t.camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
    const front = Vector3.Project(mic.portMarkers.get('out-xlr')!.getAbsolutePosition(), Matrix.Identity(), t.scene.getTransformMatrix(), vp)
    const qx = front.x + 4
    const qy = front.y
    // slide the rear mic so ITS port sits exactly on the ray through the pointer, 2.5 m behind the front one
    const ray = t.scene.createPickingRay(qx, qy, null, t.camera)
    const want = ray.origin.add(ray.direction.scale(Vector3.Distance(ray.origin, mic.portMarkers.get('out-xlr')!.getAbsolutePosition()) + 2.5))
    rear.root.position.addInPlace(want.subtract(rear.portMarkers.get('out-xlr')!.getAbsolutePosition()))
    for (const m of t.scene.meshes) m.computeWorldMatrix(true)
    t.proxies.refresh()
    for (const m of t.scene.meshes) m.computeWorldMatrix(true)
    t.selected.id = 'front'
    expect(t.proxies.portAt(qx, qy)).toEqual({ instance: 'front', port: 'out-xlr' })
    t.scene.dispose()
  })

  // ── Residual fixes R2 / R3: the ranking is precision-aware, and "tight" is decided per port ──────
  /** Move `inst` so that its `port` sits on the picking ray through canvas (x, y), `depth` m from the eye. */
  function pin(t: ReturnType<typeof setup>, inst: ReturnType<typeof setup>['inst'], port: string, x: number, y: number, depth: number): void {
    for (const m of t.scene.meshes) m.computeWorldMatrix(true)
    const ray = t.scene.createPickingRay(x, y, null, t.camera)
    const want = ray.origin.add(ray.direction.scale(depth))
    inst.root.position.addInPlace(want.subtract(inst.portMarkers.get(port)!.getAbsolutePosition()))
    for (const m of t.scene.meshes) m.computeWorldMatrix(true)
    t.proxies.refresh()
    for (const m of t.scene.meshes) m.computeWorldMatrix(true)
  }
  /** Two mics (`front` / `rear`) in a scene looking at the QL1; the camera is 8 m out. */
  function twoMics() {
    const t = setup(8)
    const front = new DeviceSpawner(t.scene, registry, CREATION_DEVICE_THEME).spawn('shure-sm58', new Vector3(40, 0, 0), 'front')
    const rear = new DeviceSpawner(t.scene, registry, CREATION_DEVICE_THEME).spawn('shure-sm58', new Vector3(-40, 0, 0), 'rear')
    t.instances.set('front', front)
    t.instances.set('rear', rear)
    t.scene.render()
    t.camera.getViewMatrix(true)
    return { ...t, front, rear }
  }
  const FRONT = { instance: 'front', port: 'out-xlr' }
  const REAR = { instance: 'rear', port: 'out-xlr' }
  const eyeDepth = (t: ReturnType<typeof setup>): number => Vector3.Distance(t.camera.position, t.camera.target)

  it('R2: aimed at dead centre of a rear connector, a nearer port that is only grazed at 9 px does not take the click (12 px radius: cable in hand)', () => {
    const t = twoMics()
    const q = { x: 800, y: 300 } // empty space: the QL1 is at the screen centre
    pin(t, t.rear, 'out-xlr', q.x, q.y, eyeDepth(t))
    pin(t, t.front, 'out-xlr', q.x + 9, q.y, eyeDepth(t) - 2.5) // 2.5 m nearer, 9 px off the pointer
    expect(t.proxies.portAt(q.x, q.y, true)).toEqual(REAR)
    // the grazed port is still reachable where it is the one aimed at
    expect(t.proxies.portAt(q.x + 9, q.y, true)).toEqual(FRONT)
    t.scene.dispose()
  })

  it('R2: with nothing inside the tight radius the nearest port still wins (fallback), and when both are inside it the nearest wins', () => {
    const t = twoMics()
    const q = { x: 800, y: 300 }
    pin(t, t.rear, 'out-xlr', q.x - 10, q.y, eyeDepth(t))
    pin(t, t.front, 'out-xlr', q.x + 9, q.y, eyeDepth(t) - 2.5)
    expect(t.proxies.portAt(q.x, q.y, true)).toEqual(FRONT) // 10 px and 9 px: both outside the 6 px, the nearer one wins
    pin(t, t.rear, 'out-xlr', q.x, q.y, eyeDepth(t))
    pin(t, t.front, 'out-xlr', q.x + 4, q.y, eyeDepth(t) - 2.5)
    expect(t.proxies.portAt(q.x, q.y, true)).toEqual(FRONT) // 0 px and 4 px: both inside, the nearer one wins
    t.scene.dispose()
  })

  it('R3: a port of the SELECTED device keeps the 12 px radius even where it projects over an UNSELECTED body behind it; an unselected one stays tight', () => {
    const t = twoMics()
    const s = screens(t)
    // a point over the QL1's body, 40+ px from every QL1 port
    let q: { x: number; y: number } | null = null
    for (let y = 250; y < 480 && !q; y += 10)
      for (let x = 350; x < 650 && !q; x += 10)
        if (s.bodyAt(x, y) === 'ql1' && s.at.every((p) => Math.hypot(p.x - x, p.y - y) >= 40)) q = { x, y }
    expect(q, 'a point over the QL1 body, away from its ports').not.toBeNull()
    // park the rear mic far away, pin the front mic's connector 9 px from the point, 3 m in front of the body
    pin(t, t.rear, 'out-xlr', 20, 20, 12)
    let placed = false
    for (const [dx, dy] of [[9, 0], [-9, 0], [0, 9], [0, -9]]) {
      pin(t, t.front, 'out-xlr', q!.x + dx, q!.y + dy, eyeDepth(t) - 3)
      if (s.bodyAt(q!.x, q!.y) === 'ql1') {
        placed = true
        break
      }
    }
    expect(placed, 'the front mic does not hide the QL1 body at the point').toBe(true)
    t.selected.id = 'front'
    expect(t.proxies.portAt(q!.x, q!.y)).toEqual(FRONT) // selected: 12 px
    t.selected.id = null
    expect(t.proxies.portAt(q!.x, q!.y)).toBeNull() // unselected, over an unselected body: tight
    t.scene.dispose()
  })

  // ── Outline rings: screen-space floor and highlight rule (Wave 0, Task 0.3) ──────────────────────
  /** World matrices up to date, as after a render (the proxies read absolute positions). */
  const prime = (t: ReturnType<typeof setup>): void => {
    for (const m of t.scene.meshes) m.computeWorldMatrix(true)
  }
  /** Aim the camera at a port's ring from `distance` m (a close view of the rear panel; the ring is the camera target, so that is its distance). */
  const lookAt = (t: ReturnType<typeof setup>, port: string, distance: number): void => {
    prime(t)
    t.camera.setTarget(t.inst.portMarkers.get(port)!.getAbsolutePosition().clone())
    t.camera.radius = distance
    t.camera.getViewMatrix(true)
    prime(t)
  }
  /** A marker ring's outer diameter on screen, in CSS px. */
  function ringPx(t: ReturnType<typeof setup>, port: string): number {
    const m = t.inst.portMarkers.get(port)!
    m.computeWorldMatrix(true)
    const world = m.getBoundingInfo().boundingBox.extendSize.x * 2 * m.scaling.x
    return world / worldPerPx(Vector3.Distance(t.camera.position, m.getAbsolutePosition()), FOV, H)
  }
  const restPx = (t: ReturnType<typeof setup>, port: string): number => {
    const m = t.inst.portMarkers.get(port)!
    return (m.getBoundingInfo().boundingBox.extendSize.x * 2) / worldPerPx(Vector3.Distance(t.camera.position, m.getAbsolutePosition()), FOV, H)
  }

  it('far camera (20 m): every ring spans >= 9 px (the floor); a ring that already does is left at 1', () => {
    const t = setup(20)
    prime(t)
    t.camera.getViewMatrix(true)
    t.proxies.refresh()
    for (const port of t.inst.portMarkers.keys()) {
      expect(ringPx(t, port), port).toBeGreaterThanOrEqual(RING_MIN_PX - 1e-6)
      expect(t.inst.portMarkers.get(port)!.metadata.restScale, port).toBe(1) // the metadata contract is untouched by the floor
    }
    t.scene.dispose()
  })

  it('close camera (0.5 m from a ring): rings keep their own size (scale 1), none above 1.6x rest', () => {
    const t = setup(5)
    const [first] = [...t.inst.portMarkers.keys()]
    lookAt(t, first, 0.5)
    t.proxies.refresh()
    expect(restPx(t, first)).toBeGreaterThan(RING_MIN_PX * 3) // really close: the ring is big on screen
    for (const port of t.inst.portMarkers.keys()) {
      const m = t.inst.portMarkers.get(port)!
      expect(m.scaling.x, port).toBeLessThanOrEqual(RING_MAX_GROW + 1e-9)
      if (restPx(t, port) >= RING_MIN_PX) expect(m.scaling.x, port).toBe(1)
    }
    t.scene.dispose()
  })

  it('a lifted ring (a connector in a pocket) keeps its lift when the far floor scales it: it grows about its own centre, it does not float off the panel (Wave 5c finding E3)', () => {
    const LIFT = 0.039 // a K12.2 XLR pocket
    for (const dist of [20, 5]) {
      const t = setup(dist)
      prime(t)
      const port = [...t.inst.portMarkers.keys()][0]
      const m = t.inst.portMarkers.get(port)!
      m.scaling.setAll(1) // as the spawner leaves it, before the camera floor scales it
      liftMarkerRing(m, LIFT)
      m.computeWorldMatrix(true)
      const parentScale = (m.parent as { absoluteScaling: Vector3 }).absoluteScaling.x
      const gap = (): number => Vector3.Distance(m.getBoundingInfo().boundingBox.centerWorld, m.getAbsolutePosition())
      expect(gap()).toBeCloseTo(LIFT * parentScale, 6)
      t.camera.getViewMatrix(true)
      t.proxies.refresh()
      if (dist === 20) expect(m.scaling.x).toBeGreaterThan(1.5) // the floor really scaled it
      m.computeWorldMatrix(true)
      expect(gap(), `ring centre off the port at ${dist} m`).toBeCloseTo(LIFT * parentScale, 6)
      t.proxies.mark({ instance: 'ql1', port }, null) // hover: the 14 px highlight scales it too
      m.computeWorldMatrix(true)
      expect(gap(), 'after the highlight growth').toBeCloseTo(LIFT * parentScale, 6)
      t.scene.dispose()
    }
  })

  it('zooming back in puts a far-scaled ring back to its rest size', () => {
    const t = setup(20)
    prime(t)
    t.camera.getViewMatrix(true)
    t.proxies.refresh()
    const port = [...t.inst.portMarkers.keys()][0]
    expect(t.inst.portMarkers.get(port)!.scaling.x).toBeGreaterThan(1.5)
    t.camera.radius = 0.8
    t.camera.getViewMatrix(true) // the observer refreshes
    expect(t.inst.portMarkers.get(port)!.scaling.x).toBe(1)
    t.scene.dispose()
  })

  it('a refresh with the camera where it was forces no marker matrix update (an idle page does no work)', () => {
    const t = setup(20)
    prime(t)
    t.camera.getViewMatrix(true)
    t.proxies.refresh()
    const before = [...t.inst.portMarkers.values()].map((m) => m.scaling.x)
    const spies = [...t.inst.portMarkers.values()].map((m) => vi.spyOn(m, 'computeWorldMatrix'))
    t.proxies.refresh()
    t.proxies.refresh()
    for (const sp of spies) expect(sp.mock.calls.filter((c) => c[0] === true)).toHaveLength(0) // (getAbsolutePosition calls the cheap, unforced one)
    expect([...t.inst.portMarkers.values()].map((m) => m.scaling.x)).toEqual(before)
    t.scene.dispose()
  })

  it('a pending / hovered ring far away reads as HIGHLIGHT_PX wide, never smaller than its rest size', () => {
    const t = setup(20)
    prime(t)
    t.camera.getViewMatrix(true)
    t.proxies.refresh()
    const [a, b] = [...t.inst.portMarkers.keys()]
    t.proxies.mark({ instance: 'ql1', port: a }, new Map([[`ql1\u0000${b}`, 'pending']]))
    for (const port of [a, b]) {
      expect(ringPx(t, port), port).toBeLessThanOrEqual(HIGHLIGHT_PX + 1e-6)
      expect(ringPx(t, port), port).toBeGreaterThanOrEqual(Math.max(RING_MIN_PX, restPx(t, port)) - 1e-6)
    }
    t.camera.radius = 12 // still far: it follows the camera, 14 px
    t.camera.getViewMatrix(true)
    expect(ringPx(t, b)).toBeCloseTo(HIGHLIGHT_PX, 3)
    t.proxies.mark(null, null)
    t.scene.dispose()
  })

  it('close range (0.45 m): a pending ring on a 24 mm connector is at most 1.6x its ring, not a 50 mm disc; lifting the mark puts it back', () => {
    const t = setup(5)
    const dev = registry.deviceById.get('yamaha-ql1')!
    const port = dev.ports.find((p) => p.connector === 'xlr3-f' || p.connector === 'xlr3-m')!.portId
    lookAt(t, port, 0.45)
    t.proxies.refresh()
    const m = t.inst.portMarkers.get(port)!
    const ring = markerDiameterM('xlr3-f')
    t.proxies.mark(null, new Map([[`ql1\u0000${port}`, 'pending']]))
    const world = m.getBoundingInfo().boundingBox.extendSize.x * 2 * m.scaling.x
    expect(world).toBeLessThanOrEqual(ring * RING_MAX_GROW + 1e-9)
    expect(world).toBeGreaterThanOrEqual(ring - 1e-9)
    expect(world).toBeLessThan(0.05)
    t.proxies.mark(null, null)
    expect(m.scaling.x).toBe(1)
    t.scene.dispose()
  })

  it('under 1 m a highlight of a SMALL ring (3.5 mm jack: 10 mm) is capped at 1.6x: 14 px would be 1.65x there; at 1.2 m it follows the 14 px', () => {
    const t = setup(5)
    const pc = new DeviceSpawner(t.scene, registry, CREATION_DEVICE_THEME).spawn('playout-pc', new Vector3(0, 0, 0), 'pc')
    t.instances.set('pc', pc)
    const m = pc.portMarkers.get('out-analog-consumer')!
    const ring = markerDiameterM('trs-35mm')
    const world = (): number => m.getBoundingInfo().boundingBox.extendSize.x * 2 * m.scaling.x
    const view = (d: number): void => {
      for (const x of t.scene.meshes) x.computeWorldMatrix(true)
      t.camera.setTarget(m.getAbsolutePosition().clone())
      t.camera.radius = d
      t.camera.getViewMatrix(true)
      for (const x of t.scene.meshes) x.computeWorldMatrix(true)
    }
    view(0.99)
    t.proxies.mark({ instance: 'pc', port: 'out-analog-consumer' }, null)
    expect(labelScale(0.99, HIGHLIGHT_PX, FOV, H)).toBeGreaterThan(ring * RING_MAX_GROW) // the premise: 14 px is over the cap here
    expect(world()).toBeCloseTo(ring * RING_MAX_GROW, 9)
    view(1.2)
    expect(world()).toBeCloseTo(labelScale(1.2, HIGHLIGHT_PX, FOV, H), 9)
    t.proxies.mark(null, null)
    t.scene.dispose()
  })

  it('the restScale metadata is the size a marker rests at: a marker marked 0.5 stays at 0.5 (near) after a hover and back', () => {
    const t = setup(5)
    const port = [...t.inst.portMarkers.keys()][0]
    const m = t.inst.portMarkers.get(port)!
    m.metadata = { ...m.metadata, restScale: 0.5 }
    lookAt(t, port, 0.4)
    t.proxies.refresh()
    expect(m.scaling.x).toBe(0.5)
    t.proxies.mark({ instance: 'ql1', port }, null)
    expect(m.scaling.x).toBeGreaterThanOrEqual(0.5)
    t.proxies.mark(null, null)
    expect(m.scaling.x).toBe(0.5)
    t.scene.dispose()
  })

  it('the first-click radius uses the rest radius of its marker, i.e. the real rest radius (a 24 mm XLR ring: 15 mm), not the old 25 mm disc, on an unselected device', () => {
    const t = setup(1.2)
    const s = screens(t)
    const dev = registry.deviceById.get('yamaha-ql1')!
    let checked = 0
    for (const p of s.at.filter((q) => s.bodyAt(q.x, q.y) === 'ql1')) {
      const connector = dev.ports.find((x) => x.portId === p.port)!.connector
      const marker = t.inst.portMarkers.get(p.port)!
      const depth = Vector3.Distance(t.camera.position, marker.getAbsolutePosition())
      const want = Math.min(t.proxies.hitRadiusPx({ instance: 'ql1', port: p.port }), Math.max(6, screenRadiusPx(markerDiameterM(connector) / 2, depth, FOV, H)))
      expect(t.proxies.firstClickRadiusPx({ instance: 'ql1', port: p.port }), p.port).toBeCloseTo(want, 6)
      checked++
    }
    expect(checked).toBeGreaterThan(0)
    t.scene.dispose()
  })
})
