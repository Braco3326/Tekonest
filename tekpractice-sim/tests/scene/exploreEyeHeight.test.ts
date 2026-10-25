/**
 * Task 19 (C11, S6): the walking camera of Mode Création.
 * - `eyeHeight` option: the walk camera starts at floorAt(spawn) + eyeHeight; the default
 *   stays the legacy standing eye (EYE.stand), so the legacy Explore is unchanged.
 * - `setEyeHeight` moves it (ear height switch while walking).
 * - No idle ticking: the per-frame tick is registered only while the base view is Explore.
 * - `acceptKey` / `onActive`: the shell gates keys and holds a render lease while the walker moves.
 * NullEngine scene + spy window / document / canvas (as tests/scene/dispose.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArcRotateCamera, NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { CameraRig } from '../../src/scene/CameraRig'
import { ExploreController, type ExploreDeps } from '../../src/scene/ExploreController'
import { DEFAULT_SETTINGS } from '../../src/ui/exploreSettings'
import { EYE } from '../../src/explore/movement'

function spyTarget() {
  const entries: { type: string; fn: (e: unknown) => void }[] = []
  return {
    entries,
    pointerLockElement: null as unknown,
    activeElement: null as unknown,
    exitPointerLock: vi.fn(),
    addEventListener(type: string, fn: (e: unknown) => void) {
      entries.push({ type, fn })
    },
    removeEventListener(type: string, fn: unknown) {
      const i = entries.findIndex((e) => e.type === type && e.fn === fn)
      if (i >= 0) entries.splice(i, 1)
    },
    fire(type: string, e: unknown) {
      for (const x of entries.filter((x) => x.type === type)) x.fn(e)
    },
  }
}

let win: ReturnType<typeof spyTarget> & { matchMedia: () => { matches: boolean } }
let doc: ReturnType<typeof spyTarget>
let canvas: ReturnType<typeof spyTarget>
const g = globalThis as Record<string, unknown>
const saved: Record<string, unknown> = {}

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

function make(over: Partial<ExploreDeps> = {}) {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  const cam = new ArcRotateCamera('c', 0, 1, 10, Vector3.Zero(), scene)
  scene.activeCamera = cam
  const rig = new CameraRig(cam)
  const before = scene.onBeforeRenderObservable.observers.length
  const ex = new ExploreController({
    scene,
    canvas: canvas as unknown as HTMLCanvasElement,
    arc: cam,
    rig,
    settings: () => DEFAULT_SETTINGS,
    obstacles: () => [],
    start: { x: 1, z: 2, yaw: 0 },
    initialView: 'orbit',
    crosshair: {} as HTMLElement,
    floorAt: () => 0.5,
    ...over,
  })
  const ui = {
    panelCount: () => 0,
    closeTopPanel() {},
    toggleInventory() {},
    toggleHelp() {},
    openPause() {},
    placing: () => false,
    cancelPlacement() {},
    rotatePlacement() {},
    confirmPlacement() {},
    pickUp() {},
    capturingKey: () => false,
  }
  const focus = {
    view: { mode: 'ensemble' as const, focused: null, held: null, selected: null },
    focusInstance() {},
    deviceAt: () => null,
    home() {},
  }
  return { engine, scene, cam, rig, ex, before, connect: () => ex.connect(focus, ui) }
}

const key = (code: string, target: unknown = canvas) => ({
  code,
  key: code.replace(/^Key/, '').toLowerCase(),
  target,
  repeat: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  shiftKey: false,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
})

describe('ExploreController eyeHeight (Task 19)', () => {
  it('places the walk camera at floorAt(spawn) + eyeHeight', () => {
    const { ex } = make({ eyeHeight: 1.2 })
    expect(ex.camera.position.y).toBeCloseTo(0.5 + 1.2, 6)
    expect(ex.snapshot().position.y).toBeCloseTo(1.7, 6)
    expect(ex.eyePosition().y).toBeCloseTo(1.7, 6)
  })
  it('without the option the legacy standing eye is kept', () => {
    const { ex } = make()
    expect(ex.camera.position.y).toBeCloseTo(0.5 + EYE.stand, 6)
  })
  it('setEyeHeight moves the walk camera to floor + the new height', () => {
    const { ex } = make({ eyeHeight: 1.2 })
    ex.setEyeHeight(1.7)
    expect(ex.camera.position.y).toBeCloseTo(0.5 + 1.7, 6)
    expect(ex.snapshot().position.y).toBeCloseTo(2.2, 6)
  })
})

describe('ExploreController ticks only while walking (Task 19, no idle ticking)', () => {
  it('orbit: no onBeforeRender observer; explore: one; back to orbit: none', async () => {
    const { scene, ex, before, connect } = make()
    expect(scene.onBeforeRenderObservable.observers.length).toBe(before)
    connect()
    expect(scene.onBeforeRenderObservable.observers.length).toBe(before)
    ex.setBaseView('explore', false)
    expect(ex.exploreView).toBe(true)
    expect(scene.activeCamera).toBe(ex.camera)
    expect(scene.onBeforeRenderObservable.observers.length).toBe(before + 1)
    ex.setBaseView('explore', false) // idempotent: still one
    expect(scene.onBeforeRenderObservable.observers.length).toBe(before + 1)
    ex.setBaseView('orbit', false)
    await settle()
    expect(scene.onBeforeRenderObservable.observers.length).toBe(before)
    expect(ex.exploreView).toBe(false)
  })
  it('legacy: a controller born in Explore ticks from construction (legacy path unchanged)', () => {
    const { scene, before } = make({ initialView: 'explore' })
    expect(scene.onBeforeRenderObservable.observers.length).toBe(before + 1)
  })
  it('legacy toggleView keeps the tick in step with the view', async () => {
    const { scene, ex, rig, before, connect } = make()
    connect()
    ex.toggleView()
    expect(scene.onBeforeRenderObservable.observers.length).toBe(before + 1)
    ex.toggleView() // back to Orbit flies to the Ensemble pose (a tween observer of its own)
    rig.cancelFlight()
    await settle()
    expect(scene.onBeforeRenderObservable.observers.length).toBe(before)
  })
  it('dispose removes the tick even while walking', async () => {
    const { scene, ex, before, connect } = make()
    connect()
    ex.setBaseView('explore', false)
    ex.dispose()
    await settle()
    expect(scene.onBeforeRenderObservable.observers.length).toBe(before)
  })
})

describe('ExploreController acceptKey / onActive (Task 19, render lease)', () => {
  it('a held movement key makes it active; key-up (no velocity left) makes it idle', () => {
    const seen: boolean[] = []
    const { ex, connect } = make({ onActive: (on) => seen.push(on) })
    connect()
    ex.setBaseView('explore', false)
    win.fire('keydown', key('KeyW'))
    expect(seen).toEqual([true])
    win.fire('keydown', key('KeyW')) // auto-repeat: no new edge
    expect(seen).toEqual([true])
    win.fire('keyup', key('KeyW'))
    expect(seen).toEqual([true, false])
  })
  it('acceptKey false: the key is ignored (no movement, never active)', () => {
    const seen: boolean[] = []
    const { ex, connect } = make({ onActive: (on) => seen.push(on), acceptKey: (e) => (e.target as unknown) === canvas })
    connect()
    ex.setBaseView('explore', false)
    win.fire('keydown', key('KeyW', doc))
    expect(seen).toEqual([])
    win.fire('keydown', key('KeyW'))
    expect(seen).toEqual([true])
  })
  it('in Orbit a movement key never makes it active', () => {
    const seen: boolean[] = []
    const { connect } = make({ onActive: (on) => seen.push(on) })
    connect()
    win.fire('keydown', key('KeyW'))
    expect(seen).toEqual([])
  })
  it('setBaseView(explore) forgets keys held in Orbit: the walk never starts already moving (review minor 6)', () => {
    const seen: boolean[] = []
    const { ex, connect } = make({ onActive: (on) => seen.push(on) })
    connect()
    win.fire('keydown', key('KeyW')) // held in Orbit
    ex.setBaseView('explore', false)
    expect(seen).toEqual([])
    // the held key's auto-repeat stays ignored until it is released
    win.fire('keydown', { ...key('KeyW'), repeat: true })
    expect(seen).toEqual([])
    // a new press walks
    win.fire('keyup', key('KeyW'))
    win.fire('keydown', key('KeyW'))
    expect(seen).toEqual([true])
  })
  it('Shift still down from Maj+V is the run modifier, not a stale key: W then runs (Task 21 carry-over)', () => {
    /** Walk 10 frames of 50 ms with W held; how far the walker went. */
    const walked = (shift: 'none' | 'before' | 'after'): number => {
      const { engine, scene, ex, connect } = make()
      vi.spyOn(engine, 'getDeltaTime').mockReturnValue(50)
      connect()
      if (shift === 'before') win.fire('keydown', { ...key('ShiftLeft'), shiftKey: true }) // Maj of Maj+V
      ex.setBaseView('explore', false)
      if (shift === 'after') win.fire('keydown', { ...key('ShiftLeft'), shiftKey: true })
      const p0 = ex.eyePosition()
      win.fire('keydown', { ...key('KeyW'), shiftKey: shift !== 'none' })
      for (let i = 0; i < 10; i++) scene.onBeforeRenderObservable.notifyObservers(scene)
      const p1 = ex.eyePosition()
      return Math.hypot(p1.x - p0.x, p1.z - p0.z)
    }
    const walk = walked('none')
    const run = walked('after')
    expect(walk).toBeGreaterThan(0)
    expect(run).toBeGreaterThan(walk * 1.5)
    expect(walked('before')).toBeCloseTo(run, 6)
  })
  it('leaving Explore while a key is held ends the activity', () => {
    const seen: boolean[] = []
    const { ex, connect } = make({ onActive: (on) => seen.push(on) })
    connect()
    ex.setBaseView('explore', false)
    win.fire('keydown', key('KeyW'))
    ex.setBaseView('orbit', false)
    expect(seen).toEqual([true, false])
  })
})
