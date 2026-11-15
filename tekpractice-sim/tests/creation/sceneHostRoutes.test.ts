/**
 * Mission 3 B, stage 1: the scene draws a stored route. `drawCable` threads `design.routes[key]` to the renderer, so the drawn path (`cablePoints`,
 * the hover length `cableLengthM`, the gravity oracle `cableSupportReport`, the pick `cableAtPoint`) follows it: above the floor, ends on the ports,
 * on a raised deck at deck height. A route change through the store redraws that cable only; undo brings the automatic shape back exactly.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Matrix, NullEngine, Vector3 } from '@babylonjs/core'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { SceneHost } from '../../src/creation/sceneHost'
import { RenderScheduler } from '../../src/creation/renderScheduler'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { History } from '../../src/creation/history'
import { placeFromKey } from '../../src/creation/places'
import { polylineLength } from '../../src/scene/cablePath'
import type { DesignState } from '../../src/trials/trial'

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
let canvas: ReturnType<typeof spyTarget>
function fakeCanvas2d() {
  const ctx: unknown = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? el : () => ({ width: 10, addColorStop() {} })), set: () => true })
  const el = { width: 1, height: 1, style: {}, getContext: () => ctx }
  return el
}
beforeEach(() => {
  canvas = spyTarget()
  saved.window = g.window
  saved.document = g.document
  g.window = Object.assign(spyTarget(), { matchMedia: () => ({ matches: true }) })
  g.document = Object.assign(spyTarget(), { createElement: fakeCanvas2d })
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
  ;(engine as unknown as { getRenderingCanvas: () => unknown }).getRenderingCanvas = () => canvas
  ;(engine as unknown as { getInputElement: () => unknown }).getInputElement = () => null
  const scheduler = new RenderScheduler({ render: () => {}, camera: () => null, tweening: () => false })
  return { engine, host: new SceneHost(canvas as unknown as HTMLCanvasElement, registry, scheduler, engine) }
}

const OUT = { instance: 'ql1', port: 'out-main-l' }
const SPK = { instance: 'k12-g', port: 'in-line-a' }
const MIC = { instance: 'sm58', port: 'out-xlr' }
const IN1 = { instance: 'ql1', port: 'in-mic-1' }
const KEY = 'k12-g in-line-a|ql1 out-main-l'
const MIC_KEY = 'ql1 in-mic-1|sm58 out-xlr'

const rig = (roomId: string, deckZ = 0): DesignState => ({
  roomId,
  rig: {
    instances: [
      { instanceId: 'ql1', deviceId: 'yamaha-ql1' },
      { instanceId: 'k12-g', deviceId: 'qsc-k12-2' },
      { instanceId: 'sm58', deviceId: 'shure-sm58' },
    ],
    connections: [
      { a: OUT, b: SPK },
      { a: MIC, b: IN1 },
    ],
    controls: {},
  },
  placements: [
    { instanceId: 'ql1', deviceId: 'yamaha-ql1', position_m: [0, 0, 4], yawDeg: 180 },
    { instanceId: 'k12-g', deviceId: 'qsc-k12-2', position_m: [3, 0, deckZ - 3], yawDeg: 0 },
    { instanceId: 'sm58', deviceId: 'shure-sm58', position_m: [-1, 0, 2], yawDeg: 0 },
  ],
})

const near2 = (p: [number, number, number], q: Vector3 | null): boolean => !!q && Math.hypot(p[0] - q.x, p[1] - q.y, p[2] - q.z) < 1e-6
const planDist = (pts: [number, number, number][], x: number, z: number): number => Math.min(...pts.map((p) => Math.hypot(p[0] - x, p[2] - z)))

describe('SceneHost draws a stored route', () => {
  const ROOM = 'room:concert-hall-medium'

  it('the drawn cable follows the route: through its corners (rounded), above the floor, ends on the ports; the hover length is its drawn length', async () => {
    const { host } = makeHost()
    const auto = rig(ROOM)
    await host.load(placeFromKey(ROOM), auto)
    const before = host.cablePoints(KEY)!
    const route: [number, number][] = [[-2, 4], [-2, -3]]
    await host.load(placeFromKey(ROOM), { ...auto, routes: { [KEY]: route } })
    const pts = host.cablePoints(KEY)!
    expect(pts).not.toEqual(before)
    expect(host.cableRoute(KEY)).toEqual(route)
    expect(host.cableRoute(MIC_KEY)).toBeNull()
    expect(near2(pts[0]!, host.portWorld(OUT)) || near2(pts[0]!, host.portWorld(SPK))).toBe(true)
    expect(near2(pts.at(-1)!, host.portWorld(OUT)) || near2(pts.at(-1)!, host.portWorld(SPK))).toBe(true)
    for (const [x, z] of route) expect(planDist(pts, x, z)).toBeLessThan(0.1) // a rounded corner passes within (√2 − 1) · 0.15 m
    for (const p of pts.slice(1, -1)) expect(p[1]).toBeGreaterThanOrEqual(host.floorHeight(p[0], p[2], 0) - 1e-9)
    const rep = host.cableSupportReport(KEY)!
    expect(rep.minAboveM).toBeGreaterThanOrEqual(-0.002)
    expect(rep.longestMidSpanM).toBeLessThanOrEqual(0.4)
    expect(host.cableLengthM(KEY)).toBeCloseTo(polylineLength(pts.map(([x, y, z]) => ({ x, y, z }))), 9)
    expect(host.cableLengthM(KEY)!).toBeGreaterThan(Math.hypot(2, 7) + Math.hypot(5, 0) - 0.5)
    host.dispose()
  })

  it('on a raised deck the routed run lies on the deck (bar-club-stage-small, 0.8 m)', async () => {
    const PLACE = 'room:bar-club-stage-small'
    const { host } = makeHost()
    await host.load(placeFromKey(PLACE), rig(PLACE))
    const b = host.roomBounds()
    // a route that walks over the whole floor in a grid of crossings: wherever the deck is, part of the run is on it
    const route: [number, number][] = []
    for (let i = 0; i <= 4; i++) {
      const z = b.minZ + 0.5 + (i * (b.maxZ - b.minZ - 1)) / 4
      route.push([i % 2 ? b.maxX - 0.5 : b.minX + 0.5, z], [i % 2 ? b.minX + 0.5 : b.maxX - 0.5, z])
    }
    await host.load(placeFromKey(PLACE), { ...rig(PLACE), routes: { [KEY]: route } })
    const pts = host.cablePoints(KEY)!
    // away from the two ports (a device stood at y = 0 may be inside the deck there: its connector bend climbs out of it, not judged here)
    const ends = [host.portWorld(OUT)!, host.portWorld(SPK)!]
    const decked = pts.filter((p) => host.floorHeight(p[0], p[2], 0) > 0.5 && ends.every((e) => Math.hypot(p[0] - e.x, p[2] - e.z) > 0.5))
    expect(decked.length, 'some of the run is over the deck').toBeGreaterThan(0)
    for (const p of decked) expect(p[1]).toBeGreaterThanOrEqual(host.floorHeight(p[0], p[2], 0))
    const rep = host.cableSupportReport(KEY)!
    expect(rep.minAboveM).toBeGreaterThanOrEqual(-0.002)
    host.dispose()
  })

  it('SET_ROUTE through the store redraws that cable only; undo brings the automatic shape back exactly', async () => {
    const { host } = makeHost()
    const store = new CreationStore(registry, creationEvaluator(registry), rig(ROOM))
    store.setRouteBounds(() => host.roomBounds())
    const history = new History(store)
    store.subscribe(() => host.apply(store.design()))
    await host.load(placeFromKey(ROOM), store.design())
    const auto = host.cablePoints(KEY)!
    const micMesh = host.scene!.getMeshByName(`cable:${MIC_KEY}`)
    const mesh = host.scene!.getMeshByName(`cable:${KEY}`)
    expect(history.do({ type: 'SET_ROUTE', key: KEY, points: [[-2, 4], [-2, -3]] }).ok).toBe(true)
    expect(host.scene!.getMeshByName(`cable:${MIC_KEY}`)).toBe(micMesh) // the other cable is not redrawn
    expect(host.scene!.getMeshByName(`cable:${KEY}`)).not.toBe(mesh)
    expect(planDist(host.cablePoints(KEY)!, -2, -3)).toBeLessThan(0.1)
    history.undo()
    expect(host.cablePoints(KEY)).toEqual(auto)
    expect(host.cableRoute(KEY)).toBeNull()
    history.redo()
    expect(host.cableRoute(KEY)).toEqual([[-2, 4], [-2, -3]])
    // unplugging drops the drawn cable and its route; undo: both back
    history.do({ type: 'UNPLUG', a: OUT, b: SPK })
    expect(host.cablePoints(KEY)).toBeNull()
    expect(host.cableRoute(KEY)).toBeNull()
    history.undo()
    expect(planDist(host.cablePoints(KEY)!, -2, -3)).toBeLessThan(0.1)
    host.dispose()
  })

  it('the pick finds a routed cable where the route took it (cablePick reads the drawn path)', async () => {
    ;(canvas as unknown as { getBoundingClientRect: () => unknown }).getBoundingClientRect = () => ({ left: 0, top: 0, width: 512, height: 256 })
    const { host, engine } = makeHost()
    await host.load(placeFromKey(ROOM), { ...rig(ROOM), routes: { [KEY]: [[-2, 4], [-2, -3]] } })
    const pts = host.cablePoints(KEY)!
    // the middle of the longest drawn segment on the routed leg x = -2: far from the straight line the automatic shape would take
    let best: [number, number, number] | null = null
    let bestLen = 0
    for (let i = 1; i < pts.length; i++) {
      const [p, q] = [pts[i - 1]!, pts[i]!]
      if (Math.abs(p[0] + 2) > 1e-6 || Math.abs(q[0] + 2) > 1e-6) continue
      const len = Math.abs(q[2] - p[2])
      if (len > bestLen) [best, bestLen] = [[(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], len]
    }
    expect(bestLen).toBeGreaterThan(3)
    const at = best!
    const cam = host.camera!
    const w = engine.getRenderWidth()
    const h = engine.getRenderHeight()
    const p = Vector3.Project(new Vector3(at[0], at[1], at[2]), Matrix.Identity(), cam.getViewMatrix().multiply(cam.getProjectionMatrix()), cam.viewport.toGlobal(w, h))
    expect(host.cableAtPoint((p.x / w) * 512, (p.y / h) * 256)).toBe(KEY)
    host.dispose()
  })
})
