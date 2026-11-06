/**
 * DeviceSpawner.tryLoadModel: a device with no shipped glb (multiprise-secteur) never asks for a file (a 404 on the deployed site),
 * keeps its placeholder box, and modelReady / pendingModels behave as for any failed load. A device with a model still loads.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NullEngine, Scene, SceneLoader, Vector3 } from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { DeviceSpawner } from '../../src/scene/DeviceSpawner'
import { makeBoxGlb } from '../tools/assets3d/helpers'
import { parseProposals, registerProposals } from '../../src/creation/betaDevices'

const registry = loadCatalog(catalogJson)
const realImport = SceneLoader.ImportMeshAsync.bind(SceneLoader)

function fakeCanvas2d() {
  const ctx: unknown = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? el : () => ({ width: 10, addColorStop() {} })), set: () => true })
  const el = { width: 1, height: 1, style: {}, getContext: () => ctx }
  return el
}
const g = globalThis as Record<string, unknown>
let savedDoc: unknown
beforeEach(() => {
  savedDoc = g.document
  g.document = { createElement: fakeCanvas2d, addEventListener() {}, removeEventListener() {} }
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  g.document = savedDoc
  vi.restoreAllMocks()
})
const makeSpawner = () => new DeviceSpawner(new Scene(new NullEngine()), registry)

describe('DeviceSpawner: no request for a model that does not ship', () => {
  it('multiprise-secteur: ImportMeshAsync is never called, modelReady resolves false, the placeholder stays, pendingModels goes 1 -> 0', async () => {
    const spy = vi.spyOn(SceneLoader, 'ImportMeshAsync')
    const spawner = makeSpawner()
    const inst = spawner.spawn('multiprise-secteur', new Vector3(0, 0, 0), 'mp')
    expect(spawner.pendingModels).toBe(1)
    await expect(inst.modelReady).resolves.toBe(false)
    expect(spawner.pendingModels).toBe(0)
    expect(spy).not.toHaveBeenCalled()
    expect(inst.assetStatus).toBe('placeholder')
    expect(inst.root.getChildMeshes(true).some((m) => m.name.startsWith('glb:'))).toBe(false)
  })

  it('a device with a shipped model still goes through the loader, with its own file name', async () => {
    const glb = await makeBoxGlb({ sizeM: { w: 0.356, h: 0.602, d: 0.35 } })
    const spy = vi.spyOn(SceneLoader, 'ImportMeshAsync').mockImplementation(((...args: unknown[]) =>
      realImport(null, '', glb, args[3] as Scene, undefined, '.glb')) as unknown as typeof SceneLoader.ImportMeshAsync)
    const spawner = makeSpawner()
    const inst = spawner.spawn('qsc-k12-2', new Vector3(0, 0, 0), 'k')
    await expect(inst.modelReady).resolves.toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![2]).toBe('qsc-k12-2.glb')
    expect(spawner.pendingModels).toBe(0)
  })
})

describe('DeviceSpawner: Bêta proposals (registered at runtime, no model ever ships for them)', () => {
  const proposalsRaw = JSON.parse(readFileSync(join(__dirname, '..', '..', 'content', 'proposals', 'catalog-proposals.json'), 'utf8')) as unknown

  it('every proposal of the real file spawns as a placeholder without a single loader call; modelReady false; pendingModels 0', async () => {
    const reg = loadCatalog(catalogJson)
    const { devices } = parseProposals(proposalsRaw, reg)
    expect(devices.length).toBeGreaterThan(0)
    registerProposals(reg, devices)
    const spy = vi.spyOn(SceneLoader, 'ImportMeshAsync')
    const spawner = new DeviceSpawner(new Scene(new NullEngine()), reg)
    const insts = devices.map((d, i) => spawner.spawn(d.id, new Vector3(i, 0, 0), `beta-${i}`))
    expect(spawner.pendingModels).toBe(devices.length)
    expect(await Promise.all(insts.map((i) => i.modelReady))).toEqual(devices.map(() => false))
    expect(spawner.pendingModels).toBe(0)
    expect(spy).not.toHaveBeenCalled()
    expect(insts.every((i) => i.assetStatus === 'placeholder')).toBe(true)
  })

  it('a proposal-shaped device whose id is NOT in the manifest is not requested, whatever its fields', async () => {
    const reg = loadCatalog(catalogJson)
    const proto = reg.deviceById.get('multiprise-secteur')!
    registerProposals(reg, [{ ...proto, id: 'beta-made-up-1', label: 'Fiche proposée' }])
    const spy = vi.spyOn(SceneLoader, 'ImportMeshAsync')
    const spawner = new DeviceSpawner(new Scene(new NullEngine()), reg)
    const inst = spawner.spawn('beta-made-up-1', new Vector3(0, 0, 0), 'b1')
    await expect(inst.modelReady).resolves.toBe(false)
    expect(spy).not.toHaveBeenCalled()
    expect(spawner.pendingModels).toBe(0)
  })
})
