/**
 * Task 14b « Look 3D Mode Création »: the creation theme paints rooms and
 * placeholder devices with CREATION_TOKENS.scene; the legacy defaults (no
 * theme passed) keep the old colours exactly. NullEngine, as sceneHost.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Color3, DirectionalLight, DynamicTexture, HemisphericLight, Mesh, MeshBuilder, NullEngine, Scene, StandardMaterial, Vector3, VertexBuffer } from '@babylonjs/core'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { DeviceSpawner, THEMED_LABELS } from '../../src/scene/DeviceSpawner'
import { buildRoom, kelvinToColor } from '../../src/scene/RoomBuilder'
import { CREATION_DEVICE_THEME, CREATION_ROOM_THEME } from '../../src/creation/sceneTheme'
import { SceneHost, strokeTargets } from '../../src/creation/sceneHost'
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
/** Every 2D-context property write (font, fillStyle, …) the label / shadow code makes. */
const ctxWrites: [string, unknown][] = []
function fakeCanvas2d() {
  const ctx: unknown = new Proxy(
    {},
    {
      get: (_t, k) => (k === 'canvas' ? el : () => ({ width: 10, addColorStop() {} })),
      set: (_t, k, v) => (ctxWrites.push([String(k), v]), true),
    },
  )
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
    // the gallery label card: opaque, ink on white
    expect((scene.getMeshByName('label:ql1')!.material as StandardMaterial).opacityTexture).toBeNull()
    scene.dispose()
  })

  it('the creation theme: token body, a subtle family tint on the top face only, token port markers', () => {
    const scene = new Scene(new NullEngine())
    const drawText = vi.spyOn(DynamicTexture.prototype, 'drawText')
    ctxWrites.length = 0
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
    // labels: Papier ink + dark halo on a transparent texture (no card), in Plex
    expect(drawText).not.toHaveBeenCalled()
    // (string writes only: the contact shadow's fillStyle is a gradient object)
    const writes = (k: string) => ctxWrites.filter(([key, v]) => key === k && typeof v === 'string').map(([, v]) => v)
    expect(writes('font').length).toBeGreaterThan(0)
    for (const f of writes('font')) expect(String(f)).toMatch(/^bold \d+px 'IBM Plex Sans'/)
    expect(new Set(writes('fillStyle'))).toEqual(new Set([S.labelInk]))
    expect(new Set(writes('strokeStyle'))).toEqual(new Set([S.labelBg]))
    const label = scene.getMeshByName('label:ql1')!.material as StandardMaterial
    expect(label.opacityTexture).toBe(label.emissiveTexture)
    const ports = registry.deviceById.get('yamaha-ql1')!.ports
    const want = { in: S.portIn, out: S.portOut, bidir: S.portBidir } as const
    for (const p of ports) expect(diffuse(marker(scene, 'ql1', p.portId))).toBe(want[p.dir as keyof typeof want])
    scene.dispose()
  })
})

describe('Task 14b Fix 1: label hierarchy and a port grid spaced for its labels', () => {
  const pos = (scene: Scene, name: string) => scene.getMeshByName(name)!.position
  const size = (scene: Scene, name: string) => {
    const m = scene.getMeshByName(name)!
    const b = m.getBoundingInfo().boundingBox
    return { w: b.maximum.x - b.minimum.x, h: b.maximum.y - b.minimum.y }
  }

  it('themed: name label halved; port label glyph ≥ 0.5× the name glyph; port labels drawn on top (group 1)', () => {
    const scene = new Scene(new NullEngine())
    new DeviceSpawner(scene, registry, CREATION_DEVICE_THEME).spawn('yamaha-ql1', Vector3.Zero(), 'ql1')
    const { name, port } = THEMED_LABELS
    expect(size(scene, 'label:ql1').w).toBeCloseTo(0.8 / 2, 6)
    const glyph = (l: { w: number; h: number; fontPx: number }) => (l.fontPx / Math.round((512 * l.h) / l.w)) * l.h
    expect(glyph(port) / glyph(name)).toBeGreaterThanOrEqual(0.5)
    const labels = scene.meshes.filter((m) => m.name.startsWith('portlabel:ql1:'))
    expect(labels.length).toBe(registry.deviceById.get('yamaha-ql1')!.ports.length)
    for (const l of labels) expect(l.renderingGroupId).toBe(1)
    expect(scene.getMeshByName('label:ql1')!.renderingGroupId).toBe(0)
    scene.dispose()
  })

  it('themed: no port label overlaps another label or a neighbouring marker (QL1, 7 ports; Axia iQ, 9 ports)', () => {
    for (const id of ['yamaha-ql1', 'axia-iq']) {
      const scene = new Scene(new NullEngine())
      new DeviceSpawner(scene, registry, CREATION_DEVICE_THEME).spawn(id, Vector3.Zero(), 'd')
      const ports = registry.deviceById.get(id)!.ports.map((p) => p.portId)
      const glyphH = (THEMED_LABELS.port.fontPx / Math.round((512 * THEMED_LABELS.port.h) / THEMED_LABELS.port.w)) * THEMED_LABELS.port.h
      for (const a of ports) {
        const la = pos(scene, `portlabel:d:${a}`)
        // its own marker sits below the glyph band
        expect(la.y - glyphH / 2).toBeGreaterThan(pos(scene, `port:d:${a}`).y + 0.025)
        for (const b of ports) {
          if (a === b) continue
          const lb = pos(scene, `portlabel:d:${b}`)
          const sameRow = Math.abs(la.y - lb.y) < 1e-6
          if (sameRow) expect(Math.abs(la.x - lb.x)).toBeGreaterThanOrEqual(THEMED_LABELS.pitchX - 1e-9)
          // a neighbour's marker is never inside this label's glyph band
          const mb = pos(scene, `port:d:${b}`)
          const inBand = Math.abs(mb.y - la.y) < glyphH / 2 + 0.025
          if (inBand) expect(Math.abs(mb.x - la.x)).toBeGreaterThanOrEqual(THEMED_LABELS.pitchX / 2)
        }
        expect(pos(scene, `port:d:${a}`).y).toBeGreaterThan(0.03) // never under the floor
      }
      scene.dispose()
    }
  })

  it('themed .glb re-anchor: real connectors 5 cm apart → labels alternate above / below and shrink to fit (no collision)', () => {
    const scene = new Scene(new NullEngine())
    const sp = new DeviceSpawner(scene, registry, CREATION_DEVICE_THEME)
    const inst = sp.spawn('yamaha-ql1', Vector3.Zero(), 'ql1')
    const ids = registry.deviceById.get('yamaha-ql1')!.ports.map((p) => p.portId)
    ids.forEach((id, i) => inst.portMarkers.get(id)!.position.set(i * 0.05, 0.1, -0.2)) // one dense row, like the QL1 rear panel
    // headless canvas measures nothing: give the labels a real ink width (≈ « out-main-l » at 52 px)
    for (const id of ids) scene.getMeshByName(`portlabel:ql1:${id}`)!.metadata = { textW: 0.2 }
    ;(sp as unknown as { declutterLabels(i: string, r: unknown, ids: string[]): void }).declutterLabels('ql1', inst.root, ids)
    const labels = ids.map((id) => scene.getMeshByName(`portlabel:ql1:${id}`)!)
    for (let i = 0; i < labels.length; i++) {
      const l = labels[i]
      expect(l.position.y > 0.1, ids[i]).toBe(i % 2 === 0) // even above, odd below
      // same side neighbours (i ± 2) never overlap: scaled ink width ≤ their distance
      if (i + 2 < labels.length) {
        const w = (m: typeof l) => (m.metadata!.textW as number) * m.scaling.x
        expect((w(l) + w(labels[i + 2])) / 2).toBeLessThanOrEqual(labels[i + 2].position.x - l.position.x + 1e-9)
      }
    }
    scene.dispose()
  })

  it('legacy: port labels keep the old size, offset and rendering group', () => {
    const scene = new Scene(new NullEngine())
    new DeviceSpawner(scene, registry).spawn('yamaha-ql1', Vector3.Zero(), 'ql1')
    const p = registry.deviceById.get('yamaha-ql1')!.ports[0].portId
    expect(size(scene, `portlabel:ql1:${p}`).w).toBeCloseTo(0.34, 6)
    expect(size(scene, 'label:ql1').w).toBeCloseTo(0.8, 6)
    const d = pos(scene, `portlabel:ql1:${p}`).subtract(pos(scene, `port:ql1:${p}`))
    expect(d.asArray().map((v) => +v.toFixed(6))).toEqual([0, 0.055, -0.01])
    expect(scene.getMeshByName(`portlabel:ql1:${p}`)!.renderingGroupId).toBe(0)
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

  it('Fix 1: ONE merged silhouette stroke (body + parts + markers); labels, pick spheres and the shadow never enter its mask', async () => {
    const { host } = makeHost()
    await host.load(placeFromKey('blank'), design('blank'))
    const inst = host.instance('ql1')!
    // a .glb-like small part (a connector) in front of the body: it writes the stencil too, so no ring around it
    const part = MeshBuilder.CreateCylinder('glb:part', { diameter: 0.03, height: 0.02 }, host.scene!)
    part.parent = inst.root
    part.metadata = { isDeviceBody: true, instanceId: 'ql1' }
    const names = [...strokeTargets(inst)].map((m) => m.name)
    expect(names).toContain('box:ql1')
    expect(names).toContain('glb:part')
    const ports = registry.deviceById.get('yamaha-ql1')!.ports.map((p) => `port:ql1:${p.portId}`)
    for (const p of ports) expect(names).toContain(p)
    expect(names.filter((n) => /^(label|portlabel|pick|shadow):/.test(n))).toEqual([])
    host.setSelected('ql1')
    const hl = host.scene!.effectLayers[0] as unknown as { hasMesh(m: unknown): boolean; _shouldRenderMesh(m: unknown): boolean }
    for (const m of inst.root.getChildMeshes(false)) {
      const inStroke = names.includes(m.name)
      expect(hl.hasMesh(m), m.name).toBe(inStroke)
      // transparent quads / pick spheres: not even occluders (they cut the mask otherwise)
      if (!inStroke) expect(hl._shouldRenderMesh(m), m.name).toBe(false)
    }
    expect(host.strokeOf('ql1')).toBe(S.selection)
    host.setSelected(null)
    expect(hl.hasMesh(part)).toBe(false)
    host.dispose()
  })

  it('hover: a Papier stroke without wash; selection (Ambre stroke + wash) wins; outlined() lists the selection only', async () => {
    const { host, scheduler } = makeHost()
    await host.load(placeFromKey('blank'), design('blank'))
    const bodies = (id: string) => host.instance(id)!.root.getChildMeshes(false).filter((m) => m.metadata?.isDeviceBody === true)
    const inv = vi.spyOn(scheduler, 'invalidate')
    host.setHovered('k12')
    expect(inv).toHaveBeenCalledTimes(1)
    expect(host.strokeOf('k12')).toBe(S.hover)
    for (const m of bodies('k12')) expect(m.renderOverlay).toBe(false)
    expect(host.outlined()).toEqual([])
    expect(host.hovered()).toBe('k12')
    host.setHovered('k12') // unchanged: no frame asked
    expect(inv).toHaveBeenCalledTimes(1)
    host.setSelected('k12')
    expect(host.strokeOf('k12')).toBe(S.selection)
    for (const m of bodies('k12')) expect(m.renderOverlay).toBe(true)
    expect(host.outlined()).toEqual(['k12'])
    host.setSelected(null)
    expect(host.strokeOf('k12')).toBe(S.hover)
    host.setHovered(null)
    expect(host.strokeOf('k12')).toBeNull()
    // no legacy mesh outline (it grew fins on split-normal .glb meshes)
    for (const m of bodies('k12')) expect(m.renderOutline).toBeFalsy()
    host.dispose()
  })
})
