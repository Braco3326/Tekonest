/**
 * DeviceSpawner + controls: a pipeline model whose device has a control layout gets its hands-on surface once it loads (real Axia iQ
 * layout, a generated box GLB carrying the real size in its extras), registers its meters with the ticker, and cleans up on dispose.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NullEngine, Scene, SceneLoader, Vector3 } from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { DeviceSpawner } from '../../src/scene/DeviceSpawner'
import { ControlTicker } from '../../src/controls/ticker'
import { makeBoxGlb } from '../tools/assets3d/helpers'

const registry = loadCatalog(catalogJson)
const SIZE_MM = { w: 519.3, h: 111.2, d: 482.9 }

function fakeCanvas2d() {
  const ctx: unknown = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? el : () => ({ width: 10, addColorStop() {} })), set: () => true })
  const el = { width: 1, height: 1, style: {}, getContext: () => ctx }
  return el
}
const g = globalThis as Record<string, unknown>
let savedDoc: unknown
const realImport = SceneLoader.ImportMeshAsync.bind(SceneLoader)
beforeEach(() => {
  savedDoc = g.document
  g.document = { createElement: fakeCanvas2d, addEventListener() {}, removeEventListener() {} }
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  g.document = savedDoc
  vi.restoreAllMocks()
})

async function glbFor(ext: boolean): Promise<Uint8Array> {
  return makeBoxGlb({
    sizeM: { w: SIZE_MM.w / 1000, h: SIZE_MM.h / 1000, d: SIZE_MM.d / 1000 },
    extras: ext ? { tekpractice: { schema: 1, realSizeMm: SIZE_MM, ports: [], controls: [] } } : undefined,
  })
}

function serve(glb: Uint8Array) {
  return vi.spyOn(SceneLoader, 'ImportMeshAsync').mockImplementation(((...args: unknown[]) =>
    realImport(null, '', glb, args[3] as Scene, undefined, '.glb')) as unknown as typeof SceneLoader.ImportMeshAsync)
}

const make = (ticker?: ControlTicker) => {
  const scene = new Scene(new NullEngine())
  return { scene, spawner: new DeviceSpawner(scene, registry, undefined, { alignFront: true, ...(ticker ? { controlTicker: ticker } : {}) }) }
}

describe('controls on a spawned device', () => {
  it('builds the Axia iQ surface (8 faders, keys, knobs, 2 LED bars) once the model loads, and starts the ticker', async () => {
    serve(await glbFor(true))
    const frames = vi.fn()
    const ticker = new ControlTicker(frames, () => 0, () => 1, () => undefined)
    const { spawner } = make(ticker)
    const inst = spawner.spawn('axia-iq', new Vector3(0, 0, 0), 'q1')
    expect(inst.controls).toBeNull() // placeholder until the model arrives
    await inst.modelReady
    const c = await inst.controlsReady
    expect(c).not.toBeNull()
    expect(inst.controls).toBe(c)
    const ids = c!.bank.all().map((d) => d.id)
    expect(ids.filter((i) => /^fader-\d$/.test(i))).toHaveLength(8)
    expect(ids).toContain('monitor-level')
    expect(ids).toContain('pgm1-meter-l')
    expect(c!.rig.hasMeters).toBe(true)
    expect(ticker.running).toBe(true)
    // the ON / OFF pair of a strip is a radio group: ON starts on
    expect(c!.bank.get('ch1-on')).toBe(1)
    c!.bank.set('ch1-off', 1, 'user')
    expect(c!.bank.get('ch1-on')).toBe(0)
  })

  it('dispose takes the rig off the ticker and removes its parts', async () => {
    serve(await glbFor(true))
    const ticker = new ControlTicker(() => undefined, () => 0, () => 1, () => undefined)
    const { scene, spawner } = make(ticker)
    const inst = spawner.spawn('axia-iq', new Vector3(0, 0, 0), 'q1')
    await inst.modelReady
    await inst.controlsReady
    expect(scene.getTransformNodeByName('ctl:q1:fader-1')).not.toBeNull()
    inst.dispose()
    expect(inst.controls).toBeNull()
    expect(ticker.running).toBe(false)
    expect(scene.getTransformNodeByName('ctl:q1:fader-1')).toBeNull()
  })

  it('does nothing without a ticker option (the legacy game), for a model without extras, or for a device with no layout', async () => {
    serve(await glbFor(true))
    const legacy = make().spawner.spawn('axia-iq', new Vector3(0, 0, 0), 'q1')
    await legacy.modelReady
    expect(await legacy.controlsReady).toBeNull()
    expect(legacy.controls).toBeNull()

    serve(await glbFor(false))
    const ticker = new ControlTicker(() => undefined, () => 0, () => 1, () => undefined)
    const plain = make(ticker).spawner.spawn('axia-iq', new Vector3(0, 0, 0), 'q2')
    await plain.modelReady
    expect(await plain.controlsReady).toBeNull()

    serve(await glbFor(true))
    const noLayout = make(ticker).spawner.spawn('qsc-k12-2', new Vector3(0, 0, 0), 'k1')
    await noLayout.modelReady
    expect(await noLayout.controlsReady).toBeNull()
    expect(noLayout.controls).toBeNull()
  })
})
