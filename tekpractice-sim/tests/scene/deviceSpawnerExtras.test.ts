/**
 * DeviceSpawner reads the GLB extras (3D rebuild, Task 10). Real GLBs built with gltf-transform, loaded by the real
 * Babylon glTF loader on a NullEngine (SceneLoader.ImportMeshAsync is redirected to the in-memory bytes).
 * Device: qsc-k12-2 (REAL_SIZE_M h = 0.602 m; ports in-line-a, thru-out-a, power-in; control power).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Mesh, NullEngine, Scene, SceneLoader, TransformNode, Vector3 } from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { DeviceSpawner, type DeviceInstance } from '../../src/scene/DeviceSpawner'
import { findExtras, type AssetExtrasV1 } from '../../src/scene/assetExtras'
import { makeBoxGlb } from '../tools/assets3d/helpers'

const registry = loadCatalog(catalogJson)
const DEVICE = 'qsc-k12-2'
const SIZE = { w: 0.356, h: 0.602, d: 0.35 }
/** In GLB (glTF) file space, the I/O face is +Z (fixup.py / placement.ts convention). */
const PORT_GLTF: [number, number, number] = [0.1, 0.3, SIZE.d / 2]
const CTRL_GLTF: [number, number, number] = [-0.08, 0.5, SIZE.d / 2]

const extras = (): AssetExtrasV1 => ({
  schema: 1,
  realSizeMm: { w: 356, h: 602, d: 350 },
  ports: [{ portId: 'in-line-a', pos: PORT_GLTF }],
  controls: [{ controlId: 'power', pos: CTRL_GLTF, axis: 'z', kind: 'toggle' }],
})

/** DeviceSpawner's label / shadow DynamicTextures draw on a 2D canvas: a do-nothing one headless (as sceneHost.test). */
function fakeCanvas2d() {
  const ctx: unknown = new Proxy(
    {},
    { get: (_t, k) => (k === 'canvas' ? el : () => ({ width: 10, addColorStop() {} })), set: () => true }
  )
  const el = { width: 1, height: 1, style: {}, getContext: () => ctx }
  return el
}

const g = globalThis as Record<string, unknown>
const saved: Record<string, unknown> = {}
const realImport = SceneLoader.ImportMeshAsync.bind(SceneLoader)

beforeEach(() => {
  saved.document = g.document
  g.document = { createElement: fakeCanvas2d, addEventListener() {}, removeEventListener() {} }
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  g.document = saved.document
  vi.restoreAllMocks()
})

/** Every spawner import loads these bytes with the real loader (the spawner's own arguments are recorded). */
function serveGlb(glb: Uint8Array) {
  return vi.spyOn(SceneLoader, 'ImportMeshAsync').mockImplementation(((...args: unknown[]) =>
    realImport(null, '', glb, args[3] as Scene, undefined, '.glb')) as unknown as typeof SceneLoader.ImportMeshAsync)
}

function makeSpawner() {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  return { scene, spawner: new DeviceSpawner(scene, registry) }
}

const glbRootOf = (inst: DeviceInstance): Mesh =>
  inst.root.getChildMeshes(true).find((m) => m.name === `glb:${inst.instanceId}`) as Mesh
const local = (inst: DeviceInstance, n: TransformNode): Vector3 => {
  n.computeWorldMatrix(true)
  return n.getAbsolutePosition().subtract(inst.root.getAbsolutePosition())
}

describe('Babylon 7 glTF loader: where node extras land', () => {
  it('on node.metadata.gltf.extras of the glTF node (ExtrasAsMetadata, enabled by default, no plugin options)', async () => {
    const glb = await makeBoxGlb({ sizeM: SIZE, extras: { tekpractice: extras() } })
    const scene = new Scene(new NullEngine())
    const { meshes } = await realImport(null, '', glb, scene, undefined, '.glb')
    // meshes[0] is the loader's own __root__ (no extras); the glTF root node 'root' is its child and carries them.
    expect(meshes[0]!.name).toBe('__root__')
    expect(meshes[0]!.metadata?.gltf).toBeUndefined()
    const root = meshes.find((m) => m.name === 'root')!
    expect(root.parent).toBe(meshes[0])
    expect(root.metadata.gltf.extras.tekpractice).toEqual(extras())
    expect(findExtras(meshes[0]!)).toEqual(extras())
  })

  it('the loader maps glTF (x, y, z) to Babylon (-x, y, z) by default: __root__ = 180 deg about Y and scale (1, 1, -1)', async () => {
    const glb = await makeBoxGlb({ sizeM: SIZE, nodes: [{ name: 'port_in-line-a', pos: PORT_GLTF }] })
    const scene = new Scene(new NullEngine())
    const { meshes } = await realImport(null, '', glb, scene, undefined, '.glb')
    expect(meshes[0]!.rotationQuaternion!.asArray()).toEqual([0, 1, 0, 0])
    expect(meshes[0]!.scaling.asArray()).toEqual([1, 1, -1])
    const port = meshes[0]!.getDescendants(false).find((n) => n.name === 'port_in-line-a') as TransformNode
    port.computeWorldMatrix(true)
    const p = port.getAbsolutePosition()
    expect([p.x, p.y, p.z].map((v) => +v.toFixed(5))).toEqual([-0.1, 0.3, SIZE.d / 2])
  })
})

describe('DeviceSpawner with GLB extras', () => {
  it('a GLB with tekpractice extras loads at scale 1, I/O at Babylon -Z with no rotation on the glb root, and exposes ctrl nodes', async () => {
    const glb = await makeBoxGlb({
      sizeM: SIZE,
      extras: { tekpractice: extras() },
      nodes: [
        { name: 'port_in-line-a', pos: PORT_GLTF },
        { name: 'ctrl_power', pos: CTRL_GLTF },
      ],
    })
    const spy = serveGlb(glb)
    const { spawner } = makeSpawner()
    const inst = spawner.spawn(DEVICE, new Vector3(2, 0, 3), 'k12')
    expect(inst.controlNodes.size).toBe(0) // placeholder until the model arrives
    await expect(inst.modelReady).resolves.toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(inst.assetStatus).toBe('glb')

    const glbRoot = glbRootOf(inst)
    // (b) scale exactly 1 (the -1 on z is the loader's handedness conversion, not a size change)
    expect(glbRoot.scaling.asArray()).toEqual([1, 1, -1])
    // no rotation on the glb root, pivot not moved (bottom-centre on the instance origin)
    const q = glbRoot.rotationQuaternion
    expect(q === null || (q.x === 0 && q.y === 0 && q.z === 0 && q.w === 1)).toBe(true)
    expect(glbRoot.rotation.asArray()).toEqual([0, 0, 0])
    expect(glbRoot.position.asArray()).toEqual([0, 0, 0])
    glbRoot.computeWorldMatrix(true)
    const b = glbRoot.getHierarchyBoundingVectors()
    expect(b.max.y - b.min.y).toBeCloseTo(SIZE.h, 5) // the authored real height, untouched
    expect(b.min.y).toBeCloseTo(0, 5)

    // (a) the port anchor (marker, pick sphere) ends on the Babylon -Z face, x not mirrored
    const marker = inst.portMarkers.get('in-line-a')!
    expect(marker.position.x).toBeCloseTo(PORT_GLTF[0], 5)
    expect(marker.position.y).toBeCloseTo(PORT_GLTF[1], 5)
    expect(marker.position.z).toBeCloseTo(-SIZE.d / 2, 5)
    const pick = inst.root.getChildMeshes(true).find((m) => m.name === 'pick:k12:in-line-a')!
    expect(pick.position.z).toBeCloseTo(-SIZE.d / 2, 5)

    // the ctrl_<controlId> node of THIS instance, at its authored place
    const ctrl = inst.controlNodes.get('power')!
    expect(ctrl.name).toBe('ctrl_power')
    expect(ctrl.isDescendantOf(inst.root)).toBe(true)
    const c = local(inst, ctrl)
    expect([c.x, c.y, c.z].map((v) => +v.toFixed(5))).toEqual([CTRL_GLTF[0], CTRL_GLTF[1], -SIZE.d / 2])
    expect([...inst.controlNodes.keys()]).toEqual(['power'])
  })

  it('two instances of the same device each get their own ctrl nodes; a .001-suffixed node is tolerated', async () => {
    const glb = await makeBoxGlb({
      sizeM: SIZE,
      extras: { tekpractice: extras() },
      nodes: [{ name: 'ctrl_power.001', pos: CTRL_GLTF }],
    })
    serveGlb(glb)
    const { spawner } = makeSpawner()
    const a = spawner.spawn(DEVICE, new Vector3(0, 0, 0), 'a')
    const b = spawner.spawn(DEVICE, new Vector3(4, 0, 0), 'b')
    await Promise.all([a.modelReady, b.modelReady])
    const ca = a.controlNodes.get('power')!
    const cb = b.controlNodes.get('power')!
    expect(ca.name).toBe('ctrl_power.001')
    expect(ca).not.toBe(cb)
    expect(ca.isDescendantOf(a.root)).toBe(true)
    expect(cb.isDescendantOf(b.root)).toBe(true)
  })

  it('only <exact> or <exact>.NNN matches: ctrl_power_old / ctrl_powerX are not the power control', async () => {
    const glb = await makeBoxGlb({
      sizeM: SIZE,
      extras: { tekpractice: extras() },
      nodes: [{ name: 'ctrl_power_old', pos: CTRL_GLTF }, { name: 'ctrl_powerX', pos: CTRL_GLTF }, { name: 'port_in-line-a-spare', pos: PORT_GLTF }],
    })
    serveGlb(glb)
    const { spawner } = makeSpawner()
    const inst = spawner.spawn(DEVICE, new Vector3(0, 0, 0), 'k12')
    await expect(inst.modelReady).resolves.toBe(true)
    expect(inst.controlNodes.size).toBe(0)
    // port_in-line-a-spare is not port_in-line-a: the marker falls back to the grid, not onto that node
    expect(inst.portMarkers.get('in-line-a')!.position.x).not.toBeCloseTo(PORT_GLTF[0], 5)
  })

  it('extras models keep their authored size and offset: no height scaling, grounding or centring', async () => {
    // REAL_SIZE_M of qsc-k12-2 has h = 0.602; this model is authored 0.45 m tall, its body off-centre on a child node
    const authored = { w: 0.3, h: 0.45, d: 0.25 }
    const offset: [number, number, number] = [0.05, 0.02, -0.03]
    const glb = await makeBoxGlb({
      sizeM: authored,
      meshOnChild: { pos: offset },
      extras: { tekpractice: { ...extras(), realSizeMm: { w: 300, h: 450, d: 250 } } },
      nodes: [{ name: 'ctrl_power', pos: CTRL_GLTF }],
    })
    serveGlb(glb)
    const { spawner } = makeSpawner()
    const inst = spawner.spawn(DEVICE, new Vector3(2, 0.5, -1), 'k12')
    await expect(inst.modelReady).resolves.toBe(true)
    const glbRoot = glbRootOf(inst)
    expect(glbRoot.scaling.asArray()).toEqual([1, 1, -1])
    expect(glbRoot.position.asArray()).toEqual([0, 0, 0])
    glbRoot.computeWorldMatrix(true)
    const b = glbRoot.getHierarchyBoundingVectors()
    const o = inst.root.getAbsolutePosition()
    expect(b.max.y - b.min.y).toBeCloseTo(authored.h, 5) // NOT 0.602
    expect(b.max.x - b.min.x).toBeCloseTo(authored.w, 5)
    expect(b.min.y - o.y).toBeCloseTo(offset[1], 5) // not grounded
    expect((b.min.x + b.max.x) / 2 - o.x).toBeCloseTo(offset[0], 5) // not centred (x kept)
    expect((b.min.z + b.max.z) / 2 - o.z).toBeCloseTo(-offset[2], 5) // not centred (glTF z mirrored to Babylon -z)
  })

  it('a GLB without extras still takes the height-scaling path (2x too large -> REAL_SIZE_M height, grounded, centred, grid)', async () => {
    // 2x too large, and the mesh offset from the root so the legacy grounding / centring visibly act
    const glb = await makeBoxGlb({ sizeM: { w: SIZE.w * 2, h: SIZE.h * 2, d: SIZE.d * 2 }, meshOnChild: { pos: [0.5, 0.2, 0.1] } })
    serveGlb(glb)
    const { spawner } = makeSpawner()
    const inst = spawner.spawn(DEVICE, new Vector3(1, 0, -2), 'k12')
    await expect(inst.modelReady).resolves.toBe(true)
    const glbRoot = glbRootOf(inst)
    expect(glbRoot.scaling.x).toBeCloseTo(0.5, 6)
    // the legacy path leaves the loader's 180-degree turn about Y in place (only the extras path resets it)
    expect(glbRoot.rotationQuaternion!.asArray()).toEqual([0, 1, 0, 0])
    glbRoot.computeWorldMatrix(true)
    const b = glbRoot.getHierarchyBoundingVectors()
    const o = inst.root.getAbsolutePosition()
    expect(b.max.y - b.min.y).toBeCloseTo(SIZE.h, 5)
    expect(b.min.y).toBeCloseTo(o.y, 5)
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(o.x, 5)
    expect((b.min.z + b.max.z) / 2).toBeCloseTo(o.z, 5)
    // no empties: the grid fallback on the -Z face of the real size
    expect(inst.portMarkers.get('in-line-a')!.position.z).toBeCloseTo(-SIZE.d / 2 - 0.015, 6)
    expect(inst.controlNodes.size).toBe(0)
  })

  it('a malformed extras object falls back to the legacy path without throwing', async () => {
    const glb = await makeBoxGlb({
      sizeM: { w: SIZE.w * 2, h: SIZE.h * 2, d: SIZE.d * 2 },
      extras: { tekpractice: { ...extras(), schema: 2 } },
      nodes: [{ name: 'ctrl_power', pos: CTRL_GLTF }],
    })
    serveGlb(glb)
    const { spawner } = makeSpawner()
    const inst = spawner.spawn(DEVICE, new Vector3(0, 0, 0), 'k12')
    await expect(inst.modelReady).resolves.toBe(true)
    expect(glbRootOf(inst).scaling.x).toBeCloseTo(0.5, 6)
    expect(inst.controlNodes.size).toBe(0)
  })

  it('a placeholder (the glb fails to load) has an empty controlNodes map', async () => {
    vi.spyOn(SceneLoader, 'ImportMeshAsync').mockRejectedValue(new Error('404'))
    const { spawner } = makeSpawner()
    const inst = spawner.spawn(DEVICE, new Vector3(0, 0, 0), 'k12')
    await expect(inst.modelReady).resolves.toBe(false)
    expect(inst.assetStatus).toBe('placeholder')
    expect(inst.controlNodes).toBeInstanceOf(Map)
    expect(inst.controlNodes.size).toBe(0)
  })
})
