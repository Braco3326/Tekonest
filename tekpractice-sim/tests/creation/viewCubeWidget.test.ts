/**
 * ViewCubeWidget headless (Task 17, C11): NullEngine, one scene, a stand-in DOM.
 * Second camera on its own layer, nothing per frame, the main camera back as the
 * scene's active camera after a frame, the centre patch classified, clean dispose.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArcRotateCamera, Camera, NullEngine, Scene, Vector3, VertexBuffer } from '@babylonjs/core'
import { ViewCubeWidget, type CubeHooks } from '../../src/creation/viewCubeWidget'
import { CUBE_LAYER, cubeToWorld } from '../../src/creation/viewCubeGeometry'
import { RenderScheduler } from '../../src/creation/renderScheduler'
import { CameraRig } from '../../src/scene/CameraRig'
import { DisposableBag } from '../../src/util/disposable'
import { ZONES, zoneAngles, zoneId } from '../../src/camera/cubeZones'

/** A cube-frame point in world space. */
const v3w = (p: { x: number; y: number; z: number }) => {
  const w = cubeToWorld(p)
  return new Vector3(w.x, w.y, w.z)
}

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

/** A 2D canvas that draws nothing (the face labels' DynamicTextures), and a div with what the widget touches. */
function fakeElement(tag: string) {
  if (tag === 'canvas') {
    const ctx: unknown = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? el : () => ({ width: 10 })), set: () => true })
    const el = { width: 1, height: 1, style: {}, getContext: () => ctx }
    return el
  }
  return Object.assign(spyTarget(), {
    tag,
    style: {} as Record<string, string>,
    dataset: {} as Record<string, string>,
    attrs: {} as Record<string, string>,
    children: [] as unknown[],
    textContent: '',
    removed: false,
    setAttribute(k: string, v: string) {
      this.attrs[k] = v
    },
    appendChild(c: unknown) {
      this.children.push(c)
    },
    remove() {
      this.removed = true
    },
    getBoundingClientRect: () => ({ left: 16, top: 16, right: 136, bottom: 136, width: 120, height: 120, x: 16, y: 16 }),
  })
}

const g = globalThis as Record<string, unknown>
const saved: Record<string, unknown> = {}
beforeEach(() => {
  saved.document = g.document
  saved.window = g.window
  g.document = Object.assign(spyTarget(), { createElement: fakeElement })
  g.window = Object.assign(spyTarget(), { innerWidth: 1366, matchMedia: () => ({ matches: true }) }) // reduced motion
  vi.spyOn(console, 'warn').mockImplementation(() => {}) // CameraRig: the NullEngine has no canvas
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  g.document = saved.document
  g.window = saved.window
  vi.restoreAllMocks()
})

function setup(hooks: CubeHooks = {}) {
  const engine = new NullEngine({ renderWidth: 900, renderHeight: 700, textureSize: 256, deterministicLockstep: false, lockstepMaxSteps: 1 })
  const scene = new Scene(engine)
  const main = new ArcRotateCamera('cam', Math.PI / 2, 1.05, 20, Vector3.Zero(), scene)
  scene.activeCamera = main
  const rig = new CameraRig(main)
  const scheduler = new RenderScheduler({ render: () => scene.render(), camera: () => null, tweening: () => false })
  const bag = new DisposableBag()
  const beforeRender = scene.onBeforeRenderObservable.observers.length
  const cube = new ViewCubeWidget(scene, main, rig, scheduler, bag, hooks)
  return { engine, scene, main, rig, bag, cube, beforeRender }
}

type FakeEl = ReturnType<typeof spyTarget> & {
  tag: string
  type?: string
  title?: string
  textContent: string
  attrs: Record<string, string>
  style: Record<string, string>
  dataset: Record<string, string>
  children: FakeEl[]
  removed: boolean
}
const click = (b: FakeEl) => {
  for (const e of b.entries.filter((x) => x.type === 'click')) (e.fn as () => void)()
}

describe('ViewCubeWidget ↺ ↻ ⌂ (Task 21 review, brief §3)', () => {
  it('three named buttons beside the square; each runs its hook; hidden while walking; removed on dispose', () => {
    const seen: string[] = []
    const { cube, bag } = setup({ rotate: (d) => seen.push(`rotate ${d}`), home: () => seen.push('home') })
    const tools = cube.tools as unknown as FakeEl
    expect(tools.dataset.testid).toBe('view-cube-tools')
    const [left, right, home] = tools.children
    expect(tools.children.map((b) => [b.tag, b.type, b.textContent, b.attrs['aria-label']])).toEqual([
      ['button', 'button', '↺', 'Tourner de 90° à gauche'],
      ['button', 'button', '↻', 'Tourner de 90° à droite'],
      ['button', 'button', '⌂', 'Vue d’ensemble'],
    ])
    // a column just right of the 120 px square (16 px margin + 120 + 4), level with its top
    expect(tools.style.left).toBe('140px')
    expect(tools.style.top).toBe('16px')
    click(right)
    click(left)
    click(home)
    expect(seen).toEqual(['rotate 1', 'rotate -1', 'home'])
    cube.setWalkCamera(cube['main'])
    expect(tools.style.display).toBe('none')
    cube.setWalkCamera(null)
    expect(tools.style.display).toBe('')
    bag.dispose()
    expect(tools.removed).toBe(true)
  })

  it('a zone click flies to its view and tells the shell which (announced like the menu and V)', () => {
    const views: string[] = []
    const { cube } = setup({ onView: (z) => views.push(zoneId(z)) })
    const hit = cube.hitElement as unknown as FakeEl
    const fire = (type: string, e: Record<string, unknown>) => {
      for (const x of hit.entries.filter((y) => y.type === type)) (x.fn as (e: unknown) => void)(e)
    }
    // the square's centre (76, 76) is the zone the pose faces; the NullEngine canvas is null (offset 0)
    const at = { clientX: 76, clientY: 76, pointerId: 1, button: 0, preventDefault: () => {} }
    fire('pointerdown', at)
    fire('pointerup', at)
    expect(views).toHaveLength(1)
  })
})

describe('ViewCubeWidget (Task 17)', () => {
  it('a second camera with its own layer; the main camera never sees the cube; nothing per frame', () => {
    const { scene, main, cube, beforeRender } = setup()
    expect(scene.activeCameras!.map((c) => c.name)).toEqual(['cam', 'cube-cam'])
    const cubeCam = scene.activeCameras![1]
    expect(cubeCam.layerMask).toBe(CUBE_LAYER)
    expect(main.layerMask & CUBE_LAYER).toBe(0)
    expect(cube.meshes.length).toBeGreaterThanOrEqual(8) // box, 6 labels, hover, ring
    for (const m of cube.meshes) {
      expect(m.layerMask, m.name).toBe(CUBE_LAYER)
      expect(m.isPickable, m.name).toBe(false)
    }
    expect(scene.onBeforeRenderObservable.observers.length).toBe(beforeRender)
    expect(cube.sizePx()).toBe(120)
    const attrs = (cube.hitElement as unknown as { attrs: Record<string, string> }).attrs
    expect(attrs['aria-hidden']).toBe('true') // the named views live in the Vue menu (Task 18)
    expect(attrs['aria-label']).toBeUndefined() // hidden: no name (Fix 1)
    expect(cube.hitElement.dataset.testid).toBe('view-cube')
    // the hover caption (Fix 3): hidden from assistive tech, hidden until a zone is hovered
    const cap = cube.caption as unknown as { attrs: Record<string, string>; style: Record<string, string> }
    expect(cap.attrs['aria-hidden']).toBe('true')
    expect(cap.style.display).toBe('none')
    expect(cap.style.top).toBe('140px') // 16 + 120 + 4: just below the square
  })

  it('every after-render observer, even one registered before the cube, already sees the main camera', () => {
    const engine = new NullEngine()
    const scene = new Scene(engine)
    const main = new ArcRotateCamera('cam', Math.PI / 2, 1.05, 20, Vector3.Zero(), scene)
    scene.activeCamera = main
    const seen: string[] = []
    scene.onAfterRenderObservable.add(() => seen.push(scene.activeCamera!.name)) // e.g. a scheduler hook
    const scheduler = new RenderScheduler({ render: () => {}, camera: () => null, tweening: () => false })
    new ViewCubeWidget(scene, main, new CameraRig(main), scheduler, new DisposableBag())
    scene.render()
    scene.render()
    expect(seen).toEqual(['cam', 'cam'])
  })

  it('nothing of the cube, its ring or the Face arrow ever leaves the square, from any pose; the cube fills it', () => {
    const { scene, main, cube } = setup()
    const cubeCam = scene.activeCameras![1] as ArcRotateCamera
    main.lowerBetaLimit = null
    main.upperBetaLimit = null
    const poses = ZONES.map((s) => zoneAngles(s))
    for (let a = 0; a < 24; a++)
      for (const b of [0.0001, 0.3, 0.7, 1.05, 1.35, Math.PI / 2, 1.9, 2.4, 2.9, Math.PI - 0.0001])
        poses.push({ alpha: (a * Math.PI) / 12, beta: b })
    let worst = 0
    for (const p of poses) {
      main.alpha = p.alpha
      main.beta = p.beta
      scene.render()
      const vp = cubeCam.getViewMatrix().multiply(cubeCam.getProjectionMatrix())
      for (const m of cube.meshes) {
        if (!m.isEnabled()) continue // the hover patch: inside the cube anyway
        const pos = m.getVerticesData(VertexBuffer.PositionKind)!
        const w = m.computeWorldMatrix(true)
        for (let i = 0; i < pos.length; i += 3) {
          const ndc = Vector3.TransformCoordinates(Vector3.TransformCoordinates(new Vector3(pos[i], pos[i + 1], pos[i + 2]), w), vp)
          worst = Math.max(worst, Math.abs(ndc.x), Math.abs(ndc.y))
        }
      }
    }
    // a 2 % margin inside the square, never clipped
    expect(worst).toBeLessThanOrEqual(0.98)
    // …and the cube really fills it (Fix 1): at the corner (iso) poses, the outermost vertex is near the border
    expect(worst).toBeGreaterThan(0.85)
  })

  it('orthographic: at the opening pose (beta 1.05) the top face reads ≈ 0.58 of the front height, not a perspective sliver (Fix 2)', () => {
    const { scene, main } = setup()
    const cubeCam = scene.activeCameras![1] as ArcRotateCamera
    expect(cubeCam.mode).toBe(Camera.ORTHOGRAPHIC_CAMERA)
    expect(cubeCam.orthoTop).toBe(-cubeCam.orthoBottom!)
    expect(cubeCam.orthoRight).toBe(-cubeCam.orthoLeft!)
    expect(cubeCam.orthoTop).toBe(cubeCam.orthoRight)
    main.alpha = zoneAngles({ x: 0, y: 0, z: 1 }).alpha
    main.beta = 1.05
    scene.render()
    const vp = cubeCam.getViewMatrix().multiply(cubeCam.getProjectionMatrix())
    const y = (p: { x: number; y: number; z: number }) => Vector3.TransformCoordinates(v3w(p), vp).y
    const topBack = y({ x: 0, y: 0.5, z: -0.5 })
    const topFront = y({ x: 0, y: 0.5, z: 0.5 })
    const bottomFront = y({ x: 0, y: -0.5, z: 0.5 })
    const ratio = (topBack - topFront) / (topFront - bottomFront)
    // tan(30°) = 0.577 in orthographic; the perspective camera gave ≈ 0.39
    expect(ratio).toBeGreaterThan(0.55)
    expect(ratio).toBeLessThan(0.61)
  })

  it('after a frame the main camera is the scene active camera again (picking, the scheduler inertia check)', () => {
    const { scene, main } = setup()
    scene.render()
    expect(scene.activeCamera).toBe(main)
    expect(scene.cameraToUseForPointers).toBe(main)
    // screen projections (projectToScreen) read the scene's current transform: the main camera's, not the cube's
    const want = main.getViewMatrix().multiply(main.getProjectionMatrix()).asArray()
    const got = scene.getTransformMatrix().asArray()
    for (let i = 0; i < 16; i++) expect(got[i]).toBeCloseTo(want[i], 9)
  })

  it('the cube camera copies the main pose; the centre of the square is the zone the pose faces', () => {
    const { scene, main, cube } = setup()
    for (const id of ['face', 'dessus-face-droite', 'arriere-gauche', 'dessous']) {
      const s = { x: id.includes('droite') ? 1 : id.includes('gauche') ? -1 : 0, y: id.includes('dessus') ? 1 : id.includes('dessous') ? -1 : 0, z: id.includes('face') ? 1 : id.includes('arriere') ? -1 : 0 } as const
      const a = zoneAngles(s)
      main.lowerBetaLimit = null
      main.upperBetaLimit = null
      main.alpha = a.alpha
      main.beta = a.beta
      scene.render()
      const cubeCam = scene.activeCameras![1] as ArcRotateCamera
      expect(cubeCam.alpha).toBeCloseTo(main.alpha, 9)
      expect(cubeCam.beta).toBeCloseTo(main.beta, 9)
      // the square is 120 px, 16 px from the canvas top-left: its centre is (76, 76)
      const z = cube.zoneAtCanvas(76, 76)
      expect(z && zoneId(z), id).toBe(id)
    }
    // a corner of the square, outside the cube's silhouette: no zone
    expect(cube.zoneAtCanvas(18, 18)).toBeNull()
  })

  it('dispose: the main camera alone again, the cube meshes and the layer gone, listeners released', async () => {
    const { scene, main, bag, cube } = setup()
    const listeners = DisposableBag.liveListeners
    expect(listeners).toBeGreaterThan(0)
    bag.dispose()
    expect(scene.activeCameras!.length).toBe(1)
    expect(scene.activeCameras![0]).toBe(main)
    expect(scene.activeCamera).toBe(main)
    expect(DisposableBag.liveListeners).toBeLessThan(listeners)
    expect(scene.meshes.filter((m) => m.name.startsWith('cube:'))).toEqual([])
    expect(scene.cameras.map((c) => c.name)).toEqual(['cam'])
    expect((cube.hitElement as unknown as { removed: boolean }).removed).toBe(true)
    expect((cube.caption as unknown as { removed: boolean }).removed).toBe(true)
    cube.dispose() // idempotent
  })
})
