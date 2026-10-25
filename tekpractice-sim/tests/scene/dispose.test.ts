/**
 * Task 3 (C3): every controller releases everything it registered on dispose().
 * NullEngine scene + spy window/document/canvas; legacy never calls dispose().
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArcRotateCamera, NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { CameraRig } from '../../src/scene/CameraRig'
import { CableRenderer } from '../../src/scene/CableRenderer'
import { FocusPatch } from '../../src/scene/FocusPatch'
import { ExploreController } from '../../src/scene/ExploreController'
import { Placement } from '../../src/scene/Placement'
import { DEFAULT_SETTINGS } from '../../src/ui/exploreSettings'
import { DesignerOrbitPointersInput, installDesignerOrbitInput, uninstallDesignerOrbitInput } from '../../src/scene/designerOrbitInput'

/** A target that tracks (type, fn) pairs so a removal must name the same function. */
function spyTarget() {
  const entries: { type: string; fn: unknown }[] = []
  return {
    entries,
    pointerLockElement: null as unknown,
    exitPointerLock: vi.fn(),
    addEventListener(type: string, fn: unknown) {
      entries.push({ type, fn })
    },
    removeEventListener(type: string, fn: unknown) {
      const i = entries.findIndex((e) => e.type === type && e.fn === fn)
      if (i >= 0) entries.splice(i, 1)
    },
  }
}

let win: ReturnType<typeof spyTarget> & { matchMedia: () => { matches: boolean } }
let doc: ReturnType<typeof spyTarget>
let canvas: ReturnType<typeof spyTarget>
const g = globalThis as Record<string, unknown>
const saved: Record<string, unknown> = {}

function makeScene() {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  ;(engine as unknown as { getRenderingCanvas: () => unknown }).getRenderingCanvas = () => canvas
  const cam = new ArcRotateCamera('c', 0, 1, 10, Vector3.Zero(), scene)
  return { engine, scene, cam }
}

const counts = (scene: Scene) => ({
  before: scene.onBeforeRenderObservable.observers.length,
  pointer: scene.onPointerObservable.observers.length,
})

beforeEach(() => {
  win = Object.assign(spyTarget(), { matchMedia: () => ({ matches: false }) })
  doc = spyTarget()
  canvas = spyTarget()
  for (const k of ['window', 'document']) saved[k] = g[k]
  g.window = win
  g.document = doc
})
afterEach(() => {
  g.window = saved.window
  g.document = saved.document
})

/** Babylon's Observable.remove is deferred to the next macrotask. */
const settle = () => new Promise((r) => setTimeout(r, 0))

const noListeners = () => {
  expect(win.entries).toEqual([])
  expect(doc.entries).toEqual([])
  expect(canvas.entries).toEqual([])
}

describe('dispose() releases every listener and observer', () => {
  it('CameraRig', async () => {
    const { scene, cam } = makeScene()
    const c0 = counts(scene)
    const rig = new CameraRig(cam)
    expect(canvas.entries.length + win.entries.length).toBeGreaterThan(0)
    rig.dispose()
    rig.dispose()
    noListeners()
    await settle()
    expect(counts(scene)).toEqual(c0)
  })

  it('CableRenderer with one pulse', async () => {
    const { scene } = makeScene()
    const c0 = counts(scene)
    const cables = new CableRenderer(scene)
    cables.addCable('c1', new Vector3(0, 0, 0), new Vector3(1, 0, 0))
    expect(cables.pulseCount).toBe(1)
    expect(scene.onBeforeRenderObservable.observers.length).toBe(c0.before + 1)
    cables.dispose()
    cables.dispose()
    await settle()
    expect(counts(scene)).toEqual(c0)
    expect(cables.pulseCount).toBe(0)
  })

  it('Placement', async () => {
    const { scene } = makeScene()
    const c0 = counts(scene)
    const p = new Placement({ scene, aim: () => ({ x: 0, y: 0 }), halfWidth: 5, halfDepth: 5, dispatch: () => {} })
    expect(scene.onBeforeRenderObservable.observers.length).toBe(c0.before + 1)
    p.dispose()
    p.dispose()
    await settle()
    expect(counts(scene)).toEqual(c0)
  })

  it('FocusPatch', async () => {
    const { scene, cam } = makeScene()
    const c0 = counts(scene)
    const rig = { flyToDevice() {}, flyToEnsemble() {}, flyToPreset: () => 0, repivot() {} }
    const cables = new CableRenderer(scene)
    const fp = new FocusPatch(scene, cam, rig, cables, [], [], {
      canConnect: () => ({ ok: true }) as never,
      dispatch: () => {},
      hints: () => true,
    })
    expect(scene.onPointerObservable.observers.length).toBe(c0.pointer + 1)
    expect(canvas.entries.length + win.entries.length).toBeGreaterThan(0)
    fp.dispose()
    fp.dispose()
    noListeners()
    await settle()
    expect(counts(scene)).toEqual(c0)
    expect(fp.glowCount).toBe(0)
  })

  it('ExploreController (and its camera)', async () => {
    const { scene, cam } = makeScene()
    const c0 = counts(scene)
    const rig = new CameraRig(cam)
    rig.dispose() // only needed as a typed dependency; its own listeners are covered above
    noListeners()
    const ex = new ExploreController({
      scene,
      canvas: canvas as unknown as HTMLCanvasElement,
      arc: cam,
      rig,
      settings: () => DEFAULT_SETTINGS,
      obstacles: () => [],
      start: { x: 0, z: 0, yaw: 0 },
      initialView: 'orbit',
      crosshair: {} as HTMLElement,
    })
    expect(win.entries.length + doc.entries.length + canvas.entries.length).toBe(8)
    // Task 19: born in Orbit, no per-frame tick (it is registered only while the base view is Explore)
    expect(scene.onBeforeRenderObservable.observers.length).toBe(c0.before)
    const nCams = scene.cameras.length
    ex.dispose()
    ex.dispose()
    noListeners()
    await settle()
    expect(counts(scene)).toEqual(c0)
    expect(scene.cameras.length).toBe(nCams - 1)
  })

  it('uninstallDesignerOrbitInput removes the designer input', async () => {
    const { cam } = makeScene()
    const input = installDesignerOrbitInput(cam)
    expect(cam.inputs.attached.pointers).toBe(input)
    uninstallDesignerOrbitInput(cam, input)
    expect(cam.inputs.attached.pointers).toBeUndefined()
    expect(input).toBeInstanceOf(DesignerOrbitPointersInput)
  })
})
