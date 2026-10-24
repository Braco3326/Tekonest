/**
 * Task 14b « Look 3D Mode Création »: the creation theme paints rooms and
 * placeholder devices with CREATION_TOKENS.scene; the legacy defaults (no
 * theme passed) keep the old colours exactly. NullEngine, as sceneHost.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Color3, DirectionalLight, HemisphericLight, Mesh, NullEngine, Scene, StandardMaterial, Vector3, VertexBuffer } from '@babylonjs/core'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { DeviceSpawner } from '../../src/scene/DeviceSpawner'
import { buildRoom, kelvinToColor } from '../../src/scene/RoomBuilder'
import { CREATION_DEVICE_THEME, CREATION_ROOM_THEME } from '../../src/creation/sceneTheme'
import { SceneHost } from '../../src/creation/sceneHost'
import { RenderScheduler } from '../../src/creation/renderScheduler'
import { loadPlaceData } from '../../src/creation/placeData'
import { placeFromKey } from '../../src/creation/places'
import { CREATION_TOKENS } from '../../src/design/creationTokens'
import { TOKENS } from '../../src/design/tokens'
import type { DesignState } from '../../src/trials/trial'

const S = CREATION_TOKENS.scene
const g = globalThis as Record<string, unknown>
const saved: Record<string, unknown> = {}
const target = () => ({ addEventListener() {}, removeEventListener() {} })
function fakeCanvas2d() {
  const ctx: unknown = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? el : () => ({ width: 10, addColorStop() {} })), set: () => true })
  const el = { width: 1, height: 1, style: {}, getContext: () => ctx }
  return el
}
beforeEach(() => {
  saved.window = g.window
  saved.document = g.document
  g.window = Object.assign(target(), { matchMedia: () => ({ matches: true }) })
  g.document = Object.assign(target(), { createElement: fakeCanvas2d })
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  g.window = saved.window
  g.document = saved.document
  vi.restoreAllMocks()
})

const registry = loadCatalog(catalogJson)
const hex = (c: Color3): string => c.toHexString()
const diffuse = (m: { material: unknown } | null): string => hex((m!.material as StandardMaterial).diffuseColor)

async function roomData() {
  const data = await loadPlaceData(placeFromKey('room:concert-hall-medium'))
  if (data.kind !== 'room') throw new Error('room expected')
  return data
}

describe('RoomBuilder: legacy default unchanged, creation theme from tokens', () => {
  it('no theme = the old look: procedural colours, zone tints, the room light', async () => {
    const { file, layout } = await roomData()
    const scene = new Scene(new NullEngine())
    buildRoom(scene, file, layout)
    expect(diffuse(scene.getMeshByName('room:floor'))).toBe(file.procedural.floor_color.toUpperCase())
    expect(diffuse(scene.getMeshByName('room:ceiling'))).toBe(file.procedural.ceiling_color.toUpperCase())
    const wall = scene.meshes.find((m) => m.name.startsWith('room:wall:'))!
    expect(diffuse(wall)).toBe(file.procedural.wall_color.toUpperCase())
    const stage = layout.zones.find((z) => z.kind === 'stage')!
    expect(diffuse(scene.getMeshByName(`room:zone:${stage.id}`))).toBe('#C9A86A')
    for (const z of layout.zones) expect(scene.meshes.filter((m) => m.name === `room:zone:${z.id}`)).toHaveLength(1) // no outline
    const flat = layout.zones.find((z) => z.y <= 0.05)
    if (flat) expect((scene.getMeshByName(`room:zone:${flat.id}`)!.material as StandardMaterial).alpha).toBe(0.12)
    const light = scene.lights.find((l) => l.name === `room:light:${file.id}`) as HemisphericLight
    expect(light).toBeDefined()
    expect(light.intensity).toBe(0.35)
    expect(light.diffuse.equals(kelvinToColor(file.lighting.color_temp_k))).toBe(true)
    scene.dispose()
  })

  it('the creation theme: token floor / walls / ceiling / zones, a zone outline, no extra light', async () => {
    const { file, layout } = await roomData()
    const scene = new Scene(new NullEngine())
    buildRoom(scene, file, layout, CREATION_ROOM_THEME)
    expect(diffuse(scene.getMeshByName('room:floor'))).toBe(S.floor)
    expect(diffuse(scene.getMeshByName('room:ceiling'))).toBe(S.ceiling)
    for (const w of scene.meshes.filter((m) => m.name.startsWith('room:wall:'))) expect(diffuse(w)).toBe(S.wall)
    for (const z of layout.zones) {
      const meshes = scene.meshes.filter((m) => m.name === `room:zone:${z.id}`)
      const fill = meshes.find((m) => m.material)!
      expect(diffuse(fill)).toBe(S.zoneFill)
      expect((fill.material as StandardMaterial).alpha).toBe(1)
      // the outline shares the zone's name: hidden / framed with it
      const edge = meshes.find((m) => m !== fill) as unknown as { color: Color3; isPickable: boolean }
      expect(edge).toBeDefined()
      expect(hex(edge.color)).toBe(S.zoneEdge)
      expect(edge.isPickable).toBe(false)
    }
    expect(scene.lights).toHaveLength(0)
    scene.dispose()
  })
})

describe('DeviceSpawner placeholders: legacy default unchanged, creation theme from tokens', () => {
  const box = (scene: Scene, id: string) => scene.getMeshByName(`box:${id}`) as Mesh
  const marker = (scene: Scene, id: string, port: string) => scene.getMeshByName(`port:${id}:${port}`) as Mesh

  it('no theme = the old look: TOKENS body and port colours, no vertex tint', () => {
    const scene = new Scene(new NullEngine())
    const sp = new DeviceSpawner(scene, registry)
    sp.spawn('yamaha-ql1', Vector3.Zero(), 'ql1')
    expect(diffuse(box(scene, 'ql1'))).toBe(TOKENS.color.deviceBody.toUpperCase())
    expect(box(scene, 'ql1').getVerticesData(VertexBuffer.ColorKind)).toBeNull()
    const port = registry.deviceById.get('yamaha-ql1')!.ports.find((p) => p.dir === 'out')!
    expect(diffuse(marker(scene, 'ql1', port.portId))).toBe(TOKENS.color.portOut.toUpperCase())
    scene.dispose()
  })

  it('the creation theme: token body, a subtle family tint on the top face only, token port markers', () => {
    const scene = new Scene(new NullEngine())
    const sp = new DeviceSpawner(scene, registry, CREATION_DEVICE_THEME)
    sp.spawn('yamaha-ql1', Vector3.Zero(), 'ql1') // console → mixing family
    const b = box(scene, 'ql1')
    expect(diffuse(b)).toBe('#FFFFFF') // the colour comes from the faces
    const colors = b.getVerticesData(VertexBuffer.ColorKind)!
    const normals = b.getVerticesData(VertexBuffer.NormalKind)!
    const faceHex = new Set<string>()
    const topHex = new Set<string>()
    for (let v = 0; v < normals.length / 3; v++) {
      const h = new Color3(colors[v * 4], colors[v * 4 + 1], colors[v * 4 + 2]).toHexString()
      if (normals[v * 3 + 1] > 0.9) topHex.add(h)
      else faceHex.add(h)
    }
    expect([...topHex]).toEqual([S.accentMixing])
    expect([...faceHex]).toEqual([S.deviceBody])
    const ports = registry.deviceById.get('yamaha-ql1')!.ports
    const want = { in: S.portIn, out: S.portOut, bidir: S.portBidir } as const
    for (const p of ports) expect(diffuse(marker(scene, 'ql1', p.portId))).toBe(want[p.dir as keyof typeof want])
    scene.dispose()
  })
})

describe('SceneHost uses the creation look (Task 14b)', () => {
  function makeHost() {
    const engine = new NullEngine()
    const canvas = target()
    ;(engine as unknown as { getRenderingCanvas: () => unknown }).getRenderingCanvas = () => canvas
    ;(engine as unknown as { getInputElement: () => unknown }).getInputElement = () => null
    const scheduler = new RenderScheduler({ render: () => {}, camera: () => null, tweening: () => false })
    const host = new SceneHost(canvas as unknown as HTMLCanvasElement, registry, scheduler, engine)
    return { host, scheduler }
  }
  const design = (roomId: string): DesignState => ({
    roomId,
    rig: { instances: [{ instanceId: 'ql1', deviceId: 'yamaha-ql1' }, { instanceId: 'k12', deviceId: 'qsc-k12-2' }], connections: [], controls: {} },
    placements: [
      { instanceId: 'ql1', deviceId: 'yamaha-ql1', position_m: [0, 0, 4], yawDeg: 0 },
      { instanceId: 'k12', deviceId: 'qsc-k12-2', position_m: [2, 0, 0], yawDeg: 0 },
    ],
  })

  it('a room: token floor, a grid, one fill + one key light from tokens, themed placeholders', async () => {
    const { host } = makeHost()
    await host.load(placeFromKey('room:concert-hall-medium'), design('room:concert-hall-medium'))
    const scene = host.scene!
    expect(diffuse(scene.getMeshByName('room:floor'))).toBe(S.floor)
    expect(scene.getMeshByName('stage:grid')).not.toBeNull()
    const hemis = scene.lights.filter((l) => l instanceof HemisphericLight) as HemisphericLight[]
    const keys = scene.lights.filter((l) => l instanceof DirectionalLight) as DirectionalLight[]
    expect(hemis).toHaveLength(1)
    expect(keys).toHaveLength(1)
    expect(hemis[0].intensity).toBe(CREATION_TOKENS.light.fill)
    expect(hex(hemis[0].groundColor)).toBe(CREATION_TOKENS.light.fillGround)
    expect(keys[0].intensity).toBe(CREATION_TOKENS.light.key)
    expect(hex(keys[0].diffuse)).toBe(CREATION_TOKENS.light.keyColor)
    // no shadow maps: nothing re-rendered per frame for shadows
    expect(scene.lights.every((l) => !l.getShadowGenerator())).toBe(true)
    expect(diffuse(scene.getMeshByName('box:ql1'))).toBe('#FFFFFF')
    host.dispose()
  })

  it('hover: a thin Papier outline without wash; selection (Ambre + wash) wins; outlined() lists the selection only', async () => {
    const { host, scheduler } = makeHost()
    await host.load(placeFromKey('blank'), design('blank'))
    const bodies = (id: string) => host.instance(id)!.root.getChildMeshes(false).filter((m) => m.metadata?.isDeviceBody === true)
    const inv = vi.spyOn(scheduler, 'invalidate')
    host.setHovered('k12')
    expect(inv).toHaveBeenCalledTimes(1)
    for (const m of bodies('k12')) {
      expect(m.renderOutline).toBe(true)
      expect(m.renderOverlay).toBe(false)
      expect(m.outlineColor.toHexString()).toBe(S.hover)
    }
    expect(host.outlined()).toEqual([])
    expect(host.hovered()).toBe('k12')
    host.setHovered('k12') // unchanged: no frame asked
    expect(inv).toHaveBeenCalledTimes(1)
    host.setSelected('k12')
    for (const m of bodies('k12')) {
      expect(m.outlineColor.toHexString()).toBe(S.selection)
      expect(m.renderOverlay).toBe(true)
    }
    expect(host.outlined()).toEqual(['k12'])
    host.setSelected(null)
    for (const m of bodies('k12')) expect(m.outlineColor.toHexString()).toBe(S.hover)
    host.setHovered(null)
    for (const m of bodies('k12')) expect(m.renderOutline).toBe(false)
    host.dispose()
  })
})
