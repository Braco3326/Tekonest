/**
 * Wave 5c finding E1: in the game (not Mode Creation) the port rings had no screen-space floor: at the 8.5 m Ensemble view an XLR ring is 2 px
 * wide with a 0.3 px line, invisible (the old 50 mm discs read as 5 px dots). The game gets a small floor of its own; the creation floor
 * (portProxies, 9 px) is untouched.
 */
import { ArcRotateCamera, NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { DeviceSpawner } from '../../src/scene/DeviceSpawner'
import { GAME_RING_MIN_PX, applyGameRingFloor, gameRingScale } from '../../src/scene/ringFloor'
import { liftMarkerRing } from '../../src/scene/portMarkerMesh'
import { worldPerPx } from '../../src/creation/portProxies'

const FOV = 0.8
const H = 800
const registry = loadCatalog(catalogJson)

describe('gameRingScale', () => {
  it('is 1 for a ring that already spans the floor, the ratio otherwise, always finite and never under 1', () => {
    expect(gameRingScale(0.0234, 0.9, FOV, H)).toBe(1) // an XLR ring at a focus distance: 22 px
    const far = gameRingScale(0.0234, 8.5, FOV, H)
    expect(far).toBeGreaterThan(2)
    expect((0.0234 * far) / worldPerPx(8.5, FOV, H)).toBeCloseTo(GAME_RING_MIN_PX, 6)
    for (const bad of [0, -1, Number.NaN, Infinity]) expect(gameRingScale(bad, 3, FOV, H)).toBe(1)
    expect(Number.isFinite(gameRingScale(0.01, Number.NaN, FOV, H))).toBe(true)
    expect(GAME_RING_MIN_PX).toBeLessThan(9) // lighter than Mode Creation's 9 px
  })
})

describe('applyGameRingFloor on a real (headless) device', () => {
  // The spawner draws labels / the contact shadow on a 2D canvas: a stand-in (as portProxies.test.ts).
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
  function setup(radius: number) {
    const scene = new Scene(new NullEngine({ renderWidth: 1000, renderHeight: H } as never))
    const camera = new ArcRotateCamera('cam', Math.PI / 2, 1.05, radius, new Vector3(0, 1, 0), scene)
    camera.fov = FOV
    scene.activeCamera = camera
    const inst = new DeviceSpawner(scene, registry).spawn('yamaha-ql1', new Vector3(0, 0, 0), 'ql1')
    for (const m of scene.meshes) m.computeWorldMatrix(true)
    camera.getViewMatrix(true)
    return { scene, camera, inst }
  }
  const px = (camera: ArcRotateCamera, m: import('@babylonjs/core').Mesh): number =>
    (m.getBoundingInfo().boundingBox.extendSize.x * 2 * m.scaling.x) / worldPerPx(Vector3.Distance(camera.position, m.getAbsolutePosition()), FOV, H)

  it('far (8.5 m, the Ensemble view): every ring spans the game floor; close (0.9 m): rings keep their own size', () => {
    const far = setup(8.5)
    applyGameRingFloor([far.inst], far.camera, H)
    for (const m of far.inst.portMarkers.values()) {
      m.computeWorldMatrix(true)
      expect(px(far.camera, m)).toBeGreaterThanOrEqual(GAME_RING_MIN_PX - 1e-6)
    }
    far.scene.dispose()
    const near = setup(0.9)
    applyGameRingFloor([near.inst], near.camera, H)
    for (const m of near.inst.portMarkers.values()) expect(m.scaling.x).toBe(1)
    near.scene.dispose()
  })

  it('scales a pocket ring in its plane only (the lift stays) and leaves an unchanged view alone (no matrix work)', () => {
    const { scene, camera, inst } = setup(8.5)
    const [port, m] = [...inst.portMarkers.entries()][0]
    m.scaling.setAll(1)
    liftMarkerRing(m, 0.039)
    m.computeWorldMatrix(true)
    applyGameRingFloor([inst], camera, H)
    m.computeWorldMatrix(true)
    expect(m.scaling.x, port).toBeGreaterThan(2)
    expect(m.scaling.z).toBe(1)
    expect(Vector3.Distance(m.getBoundingInfo().boundingBox.centerWorld, m.getAbsolutePosition())).toBeCloseTo(0.039, 6)
    const spies = [...inst.portMarkers.values()].map((x) => vi.spyOn(x, 'computeWorldMatrix'))
    applyGameRingFloor([inst], camera, H)
    for (const sp of spies) expect(sp.mock.calls.filter((c) => c[0] === true)).toHaveLength(0)
    scene.dispose()
  })
})
