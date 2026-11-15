/**
 * Mission 3 B stage 2: what the route controller asks of the SceneHost. A selected cable keeps the hover's Papier stroke (the hover of another cable wins the
 * « stroked » read, and leaving it gives the selected one back); the preview length of a route is the length the cable is then drawn with (the bar's live
 * figure = the committed `cableLengthM`); `cableEnds` are the two ports; `projectToCanvas` is null before a camera.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NullEngine } from '@babylonjs/core'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { SceneHost } from '../../src/creation/sceneHost'
import { RenderScheduler } from '../../src/creation/renderScheduler'
import { placeFromKey } from '../../src/creation/places'
import { toXZ } from '../../src/scene/cableRoute'
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
  return new SceneHost(canvas as unknown as HTMLCanvasElement, registry, scheduler, engine)
}

const OUT = { instance: 'ql1', port: 'out-main-l' }
const SPK = { instance: 'k12-g', port: 'in-line-a' }
const MIC = { instance: 'sm58', port: 'out-xlr' }
const IN1 = { instance: 'ql1', port: 'in-mic-1' }
const KEY = 'k12-g in-line-a|ql1 out-main-l'
const MIC_KEY = 'ql1 in-mic-1|sm58 out-xlr'
const ROOM = 'room:concert-hall-medium'
const rig = (routes?: Record<string, [number, number][]>): DesignState => ({
  roomId: ROOM,
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
    { instanceId: 'k12-g', deviceId: 'qsc-k12-2', position_m: [3, 0, -3], yawDeg: 0 },
    { instanceId: 'sm58', deviceId: 'shure-sm58', position_m: [-1, 0, 2], yawDeg: 0 },
  ],
  ...(routes ? { routes } : {}),
})

describe('SceneHost for the route controller', () => {
  it('the preview length of a route is the length the cable is drawn with once the route is stored; [] is the automatic length', async () => {
    const host = makeHost()
    await host.load(placeFromKey(ROOM), rig())
    const auto = host.cableLengthM(KEY)!
    expect(host.previewCableLengthM(KEY, [])).toBeCloseTo(auto, 9)
    const route: [number, number][] = [[-2, 4], [-2, -3], [1, -3.5]]
    const preview = host.previewCableLengthM(KEY, toXZ(route))!
    expect(preview).toBeGreaterThan(auto)
    await host.load(placeFromKey(ROOM), rig({ [KEY]: route }))
    expect(host.cableLengthM(KEY)).toBeCloseTo(preview, 9)
    expect(host.previewCableLengthM('nope', [])).toBeNull()
    host.dispose()
  })

  it('cableEnds are the two ports (a = the stored a); null for an unknown cable', async () => {
    const host = makeHost()
    await host.load(placeFromKey(ROOM), rig())
    const e = host.cableEnds(KEY)!
    const pa = host.portWorld(OUT)!
    const pb = host.portWorld(SPK)!
    expect([e.a.x, e.a.y, e.a.z]).toEqual([pa.x, pa.y, pa.z])
    expect([e.b.x, e.b.y, e.b.z]).toEqual([pb.x, pb.y, pb.z])
    expect(host.cableEnds('nope')).toBeNull()
    host.dispose()
  })

  it('a selected cable keeps the Papier stroke; the hovered one is read first and the selected one comes back after it; deselect clears it', async () => {
    const host = makeHost()
    await host.load(placeFromKey(ROOM), rig())
    host.setSelectedCable(KEY)
    expect(host.selectedCable()).toBe(KEY)
    expect(host.strokedCable()).toBe(KEY)
    host.setHoveredCable(MIC_KEY)
    expect(host.strokedCable()).toBe(MIC_KEY)
    host.setHoveredCable(null)
    expect(host.strokedCable()).toBe(KEY)
    // a redraw of the selected cable (a route change) keeps its stroke on the new mesh
    await host.load(placeFromKey(ROOM), rig({ [KEY]: [[-2, 4]] }))
    expect(host.strokedCable()).toBe(KEY)
    host.setSelectedCable(null)
    expect(host.strokedCable()).toBeNull()
    expect(host.selectedCable()).toBeNull()
    host.dispose()
  })

  it('a wider hit tolerance never finds a cable where there is none, and projectToCanvas is null before a scene', () => {
    const host = makeHost()
    expect(host.projectToCanvas({ x: 0, y: 0, z: 0 })).toBeNull()
    expect(host.cableAtPoint(10, 10, 16)).toBeNull()
    host.dispose()
  })
})
