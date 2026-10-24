/**
 * SceneHost (C3) headless: one Engine, one Scene per place, everything torn
 * down on a place change, and the scene reconciled from the store (P15).
 * NullEngine + spy window/canvas, as tests/scene/dispose.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MeshBuilder, NullEngine, Vector3 } from '@babylonjs/core'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { SceneHost } from '../../src/creation/sceneHost'
import { RenderScheduler } from '../../src/creation/renderScheduler'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { History } from '../../src/creation/history'
import { placeFromKey } from '../../src/creation/places'
import { DisposableBag } from '../../src/util/disposable'
import type { DesignState } from '../../src/trials/trial'
import { CREATION_TOKENS, contrastRatio } from '../../src/design/creationTokens'

/** Review fix 1: a room builder that throws half-way (after adding a mesh) when armed. */
const roomBoom = vi.hoisted(() => ({ on: false }))
vi.mock('../../src/scene/RoomBuilder', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/scene/RoomBuilder')>()
  return {
    ...real,
    buildRoom: (...args: Parameters<typeof real.buildRoom>) => {
      if (roomBoom.on) {
        MeshBuilder.CreateBox('boom:half-built', {}, args[0])
        throw new Error('boom')
      }
      return real.buildRoom(...args)
    },
  }
})

function spyTarget() {
  const entries: { type: string; fn: unknown }[] = []
  return {
    entries,
    addEventListener(type: string, fn: unknown) {
      entries.push({ type, fn })
    },
    removeEventListener(type: string, fn: unknown) {
      const i = entries.findIndex((e) => e.type === type && e.fn === fn)
      if (i >= 0) entries.splice(i, 1)
    },
  }
}

const g = globalThis as Record<string, unknown>
const saved: Record<string, unknown> = {}
let win: ReturnType<typeof spyTarget> & { matchMedia: () => { matches: boolean } }
let canvas: ReturnType<typeof spyTarget>
let doc: ReturnType<typeof spyTarget> & { createElement: () => unknown }

/** DeviceSpawner's label / shadow DynamicTextures draw on a 2D canvas: a do-nothing one headless. */
function fakeCanvas2d() {
  const ctx: unknown = new Proxy(
    {},
    {
      get: (_t, k) => (k === 'canvas' ? el : () => ({ width: 10, addColorStop() {} })),
      set: () => true,
    },
  )
  const el = { width: 1, height: 1, style: {}, getContext: () => ctx }
  return el
}

beforeEach(() => {
  win = Object.assign(spyTarget(), { matchMedia: () => ({ matches: true }) }) // reduced motion: no pulses, cuts
  canvas = spyTarget()
  doc = Object.assign(spyTarget(), { createElement: fakeCanvas2d })
  saved.window = g.window
  saved.document = g.document
  g.window = win
  g.document = doc
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  g.window = saved.window
  g.document = saved.document
  vi.restoreAllMocks()
})

const registry = loadCatalog(catalogJson)

function makeHost() {
  const engine = new NullEngine()
  // CameraRig listens on the rendering canvas; Babylon's own scene input stays off headless.
  ;(engine as unknown as { getRenderingCanvas: () => unknown }).getRenderingCanvas = () => canvas
  ;(engine as unknown as { getInputElement: () => unknown }).getInputElement = () => null
  const scheduler = new RenderScheduler({ render: () => {}, camera: () => null, tweening: () => false })
  const host = new SceneHost(canvas as unknown as HTMLCanvasElement, registry, scheduler, engine)
  return { engine, host, scheduler }
}

const rig = (roomId: string | null): DesignState => ({
  roomId,
  rig: {
    instances: [
      { instanceId: 'ql1', deviceId: 'yamaha-ql1' },
      { instanceId: 'k12-g', deviceId: 'qsc-k12-2' },
    ],
    connections: [{ a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } }],
    controls: {},
  },
  placements: [
    { instanceId: 'ql1', deviceId: 'yamaha-ql1', position_m: [0, 0, 4], yawDeg: 180 },
    { instanceId: 'k12-g', deviceId: 'qsc-k12-2', position_m: [3, 0, -3], yawDeg: 0 },
  ],
})
const emptyIn = (roomId: string | null): DesignState => ({ roomId, rig: { instances: [], connections: [], controls: {} }, placements: [] })

/** Babylon's Observable.remove is deferred to the next macrotask. */
const settle = () => new Promise((r) => setTimeout(r, 0))
const cableMeshes = (host: SceneHost) => host.scene!.meshes.filter((m) => m.name.startsWith('cable:')).length

describe('SceneHost', () => {
  it('the blank room floor reads against the Nuit background, with a 1 m grid (Task 7)', async () => {
    const { host } = makeHost()
    await host.load(placeFromKey('blank'), emptyIn('blank'))
    const scene = host.scene!
    const floor = scene.getMeshByName('stage')!
    const floorHex = (floor.material as unknown as { diffuseColor: { toHexString(): string } }).diffuseColor.toHexString()
    const clearHex = `#${[scene.clearColor.r, scene.clearColor.g, scene.clearColor.b].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`
    expect(clearHex).toBe(CREATION_TOKENS.color.nuit)
    expect(floorHex).toBe(CREATION_TOKENS.scene.floor)
    expect(contrastRatio(floorHex, clearHex)).toBeGreaterThanOrEqual(1.3)
    const grid = scene.getMeshByName('stage:grid')
    expect(grid).not.toBeNull()
    expect(grid!.isPickable).toBe(false)
    host.dispose()
  })
  it('load() builds one scene with the place, its camera active, and the design', async () => {
    const { engine, host } = makeHost()
    await host.load(placeFromKey('blank'), rig('blank'))
    expect(engine.scenes.length).toBe(1)
    expect(host.place).toEqual({ kind: 'blank' })
    expect(host.scene!.activeCamera).toBe(host.camera)
    expect(host.scene!.cameras).toHaveLength(1)
    expect(host.instance('ql1')).toBeDefined()
    expect(host.instance('k12-g')!.root.position.asArray()).toEqual([3, 0, -3])
    expect(host.instance('ql1')!.root.rotation.y).toBeCloseTo(Math.PI, 9)
    expect(cableMeshes(host)).toBe(1)
    expect(host.portWorld({ instance: 'k12-g', port: 'in-line-a' })).not.toBeNull()
    expect(host.portWorld({ instance: 'nope', port: 'x' })).toBeNull()
    host.dispose()
  })

  it('N place changes: one scene, one camera, meshes / observers / listeners back to baseline', async () => {
    const { engine, host } = makeHost()
    const listeners0 = DisposableBag.liveListeners
    await host.load(placeFromKey('room:concert-hall-medium'), rig('room:concert-hall-medium'))
    const meshesA = host.scene!.meshes.length
    const winA = win.entries.length
    const canvasA = canvas.entries.length
    const listenersA = DisposableBag.liveListeners
    for (const k of ['room:bar-club-stage-small', 'set:theatre', 'blank', 'room:classroom-lab-small', 'room:concert-hall-medium'])
      await host.load(placeFromKey(k), rig(k))
    await settle()
    expect(engine.scenes.length).toBe(1)
    expect(host.scene!.cameras).toHaveLength(1)
    expect(host.scene!.activeCamera).toBe(host.camera)
    expect(host.scene!.meshes.length).toBe(meshesA)
    expect(win.entries.length).toBe(winA)
    expect(canvas.entries.length).toBe(canvasA)
    expect(DisposableBag.liveListeners).toBe(listenersA)
    host.dispose()
    await settle()
    expect(engine.scenes.length).toBe(0)
    expect(host.scene).toBeNull()
    expect(host.camera).toBeNull()
    expect(host.rig).toBeNull()
    expect(win.entries).toEqual([])
    expect(canvas.entries).toEqual([])
    expect(doc.entries).toEqual([])
    expect(DisposableBag.liveListeners).toBe(listeners0)
  })

  it('apply() with another roomId reloads the place; overlapping loads end on the last one', async () => {
    const { engine, host } = makeHost()
    await host.load(placeFromKey('blank'), emptyIn('blank'))
    host.apply(emptyIn('room:bar-club-stage-small'))
    host.apply(emptyIn('set:theatre'))
    const last = host.load(placeFromKey('room:classroom-lab-small'), rig('room:classroom-lab-small'))
    await last
    await settle()
    expect(engine.scenes.length).toBe(1)
    expect(host.place).toEqual({ kind: 'room', id: 'classroom-lab-small' })
    expect(host.instance('ql1')).toBeDefined()
    host.dispose()
  })

  it('a design applied while the place loads is the one shown', async () => {
    const { host } = makeHost()
    const p = host.load(placeFromKey('room:concert-hall-medium'), emptyIn('room:concert-hall-medium'))
    host.apply(rig('room:concert-hall-medium'))
    await p
    expect(host.instance('ql1')).toBeDefined()
    expect(cableMeshes(host)).toBe(1)
    host.dispose()
  })

  it('reconciles moves, removes and cables from the store; undo of a REMOVE restores the scene in one change', async () => {
    const { host } = makeHost()
    const store = new CreationStore(registry, creationEvaluator(registry), rig('blank'))
    const history = new History(store)
    let applies = 0
    store.subscribe(() => {
      applies++
      host.apply(store.design())
    })
    await host.load(placeFromKey('blank'), store.design())
    const meshes0 = host.scene!.meshes.length

    history.do({ type: 'SET_POSE', instanceId: 'k12-g', position: [2, 0, -2], yawDeg: 90, tiltDeg: 0, mount: 'floor' })
    expect(host.instance('k12-g')!.root.position.asArray()).toEqual([2, 0, -2])
    expect(host.instance('k12-g')!.root.rotation.y).toBeCloseTo(Math.PI / 2, 9)

    const k12 = host.instance('k12-g')!
    history.do({ type: 'REMOVE', instanceId: 'k12-g' })
    expect(host.instance('k12-g')).toBeUndefined()
    expect(k12.root.isDisposed()).toBe(true)
    expect(cableMeshes(host)).toBe(0)

    applies = 0
    history.undo() // SPAWN + pose + CONNECT: ONE notification
    expect(applies).toBe(1)
    expect(host.instance('k12-g')!.root.position.asArray()).toEqual([2, 0, -2])
    expect(cableMeshes(host)).toBe(1)
    await settle()
    expect(host.scene!.meshes.length).toBe(meshes0)
    host.dispose()
  })

  it('tilt sign (Task 10): a positive tiltDeg aims the front (local +z) upward, a negative one downward', async () => {
    const { host } = makeHost()
    const store = new CreationStore(registry, creationEvaluator(registry), rig('blank'))
    store.subscribe(() => host.apply(store.design()))
    await host.load(placeFromKey('blank'), store.design())
    const frontY = (): number => {
      const root = host.instance('k12-g')!.root
      root.computeWorldMatrix(true)
      return Vector3.TransformNormal(new Vector3(0, 0, 1), root.getWorldMatrix()).y
    }
    store.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [3, 1.5, -3], yawDeg: 30, tiltDeg: 10, mount: 'stand' })
    expect(frontY()).toBeCloseTo(Math.sin((10 * Math.PI) / 180), 6)
    store.dispatch({ type: 'SET_POSE', instanceId: 'k12-g', position: [3, 1.5, -3], yawDeg: 30, tiltDeg: -10, mount: 'stand' })
    expect(frontY()).toBeCloseTo(-Math.sin((10 * Math.PI) / 180), 6)
    host.dispose()
  })

  it('a room that throws while building: half-built scene disposed, blank fallback (warned), later apply() draws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { engine, host } = makeHost()
    await host.load(placeFromKey('blank'), emptyIn('blank'))
    roomBoom.on = true
    try {
      await host.load(placeFromKey('room:concert-hall-medium'), emptyIn('room:concert-hall-medium'))
    } finally {
      roomBoom.on = false
    }
    expect(engine.scenes.length).toBe(1)
    expect(host.scene!.getMeshByName('boom:half-built')).toBeNull()
    expect(host.scene!.activeCamera).toBe(host.camera)
    expect(host.place).toEqual({ kind: 'room', id: 'concert-hall-medium' })
    expect(warn).toHaveBeenCalled()
    host.apply(rig('room:concert-hall-medium'))
    expect(host.instance('ql1')).toBeDefined()
    expect(cableMeshes(host)).toBe(1)
    host.dispose()
    expect(engine.scenes.length).toBe(0)
  })

  it('a pending cancelled flight does not touch anything after dispose; the engine survives', async () => {
    const { engine, host } = makeHost()
    await host.load(placeFromKey('blank'), emptyIn('blank'))
    host.dispose()
    host.dispose()
    expect(engine.isDisposed).toBe(false)
    expect(host.place).toBeNull()
    // apply() after dispose with nothing loaded starts a fresh load (no throw)
    host.apply(emptyIn('blank'))
    await settle()
    host.dispose()
  })
})

describe('SceneHost view decor (Task 9): selection outline and hidden objects', () => {
  const bodies = (host: SceneHost, id: string) => host.instance(id)!.root.getChildMeshes(false).filter((m) => m.metadata?.isDeviceBody === true)

  it('the selected device gets an Ambre outline; another selection moves it; null clears it', async () => {
    const { host } = makeHost()
    await host.load(placeFromKey('blank'), rig('blank'))
    host.setSelected('ql1')
    expect(bodies(host, 'ql1').length).toBeGreaterThan(0)
    for (const m of bodies(host, 'ql1')) {
      expect(m.renderOutline).toBe(true)
      expect(m.outlineColor.toHexString()).toBe(CREATION_TOKENS.color.ambre)
    }
    expect(host.outlined()).toEqual(['ql1'])
    host.setSelected('k12-g')
    expect(bodies(host, 'ql1').some((m) => m.renderOutline)).toBe(false)
    expect(host.outlined()).toEqual(['k12-g'])
    host.setSelected(null)
    expect(host.outlined()).toEqual([])
    host.dispose()
  })

  it('the outline survives a respawn (undo of a REMOVE) and a place reload', async () => {
    const { host } = makeHost()
    const store = new CreationStore(registry, creationEvaluator(registry), rig('blank'))
    const history = new History(store)
    store.subscribe(() => host.apply(store.design()))
    await host.load(placeFromKey('blank'), store.design())
    host.setSelected('k12-g')
    history.do({ type: 'REMOVE', instanceId: 'k12-g' })
    history.undo()
    expect(host.outlined()).toEqual(['k12-g'])
    await host.load(placeFromKey('room:concert-hall-medium'), rig('room:concert-hall-medium'))
    expect(host.outlined()).toEqual(['k12-g'])
    host.dispose()
  })

  it('hidden devices, cables and zones are disabled, and stay so across redraws; no store change', async () => {
    const { host } = makeHost()
    const store = new CreationStore(registry, creationEvaluator(registry), rig('room:concert-hall-medium'))
    const history = new History(store)
    store.subscribe(() => host.apply(store.design()))
    await host.load(placeFromKey('room:concert-hall-medium'), store.design())
    const key = 'cable:k12-g in-line-a|ql1 out-main-l'
    const before = JSON.stringify(store.design())
    host.setHidden(['ql1', key, 'zone:scene'])
    expect(host.instance('ql1')!.root.isEnabled()).toBe(false)
    expect(host.visible('ql1')).toBe(false)
    expect(host.visible('k12-g')).toBe(true)
    expect(host.scene!.getMeshByName(key)!.isEnabled()).toBe(false)
    const zoneMeshes = host.scene!.meshes.filter((m) => m.name === 'room:zone:scene')
    expect(zoneMeshes.length).toBeGreaterThan(0)
    expect(zoneMeshes.every((m) => !m.isEnabled())).toBe(true)
    expect(JSON.stringify(store.design())).toBe(before)
    expect(history.sizes.undo).toBe(0)
    // the cable is redrawn when its device moves: still hidden
    history.do({ type: 'SET_POSE', instanceId: 'k12-g', position: [2, 0, -2], yawDeg: 0, tiltDeg: 0, mount: 'floor' })
    expect(host.scene!.getMeshByName(key)!.isEnabled()).toBe(false)
    host.setHidden([])
    expect(host.visible('ql1')).toBe(true)
    expect(host.scene!.getMeshByName(key)!.isEnabled()).toBe(true)
    expect(host.scene!.meshes.filter((m) => m.name === 'room:zone:scene').every((m) => m.isEnabled())).toBe(true)
    host.dispose()
  })

  it('frameOfKey frames a zone and a cable (for the tree « fly to »)', async () => {
    const { host } = makeHost()
    await host.load(placeFromKey('room:concert-hall-medium'), rig('room:concert-hall-medium'))
    const zone = host.frameOfKey('zone:scene')
    expect(zone).not.toBeNull()
    expect(zone!.boundingRadius).toBeGreaterThan(0)
    expect(host.frameOfKey('cable:k12-g in-line-a|ql1 out-main-l')).not.toBeNull()
    expect(host.frameOfKey('zone:nope')).toBeNull()
    host.dispose()
  })
})
