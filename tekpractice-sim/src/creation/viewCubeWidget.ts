/**
 * View cube widget (Task 17, C11, CA-05, CA-07): a small cube in the viewport's
 * top-left that turns with the room. Click one of its 26 zones (6 faces, 12
 * edges, 8 corners) to look from that side; drag it to orbit. The interaction
 * is inspired by pro acoustic-design tools; the look and the numbers are ours.
 *
 * One engine, one canvas: a SECOND camera of the same scene, with its own
 * viewport and layer mask (the main camera never draws the cube, the cube
 * camera never draws the room). The cube camera copies the main camera's
 * alpha / beta when the main view matrix changes (no onBeforeRender observer:
 * nothing runs while idle). A transparent DOM layer over the cube square takes
 * the pointer; hover paints the zone Ambre and asks one frame.
 */
import {
  ArcRotateCamera,
  Camera,
  Color3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  VertexBuffer,
  Viewport,
  type Scene,
} from '@babylonjs/core'
import {
  classifyHit,
  ZONES,
  zoneAngles,
  zoneBox,
  zoneId,
  zoneLabel,
  type ZoneSigns,
} from '../camera/cubeZones'
import { CREATION_TOKENS } from '../design/creationTokens'
import type { CameraRig } from '../scene/CameraRig'
import type { DisposableBag } from '../util/disposable'
import { cubeFaceTexture, whenLabelFontReady, type CubeFace } from './cubeTextures'
import type { RenderScheduler } from './renderScheduler'
import {
  cubeSizePx,
  cubeToWorld,
  cubeViewport,
  CUBE_LAYER,
  MAIN_LAYER,
  worldToCube,
  type XYZ,
} from './viewCubeGeometry'

const K = CREATION_TOKENS.cube
/**
 * The cube camera is ORTHOGRAPHIC (Fix 2): a perspective camera this close shrinks
 * the far faces (at the opening pose the top read 0.39 of the front, « DESSUS » a
 * sliver); orthographic gives the true tan(elevation) ratio (0.58 at beta 1.05).
 *
 * ORTHO_HALF is the half-width of the square in world units (cube side = 1): the
 * worst-case silhouette over every pose is 0.964 (the Face arrow tip on the compass
 * ring; the cube's own corners reach 0.866), plus ~4 %. Measured by projecting every
 * vertex over a 96 × 61 alpha / beta sweep; tests/creation/viewCubeWidget.test.ts
 * keeps the fill between 0.85 and 0.98 of the square over the 26 zone poses and a sweep.
 * CAM_DISTANCE only places the near / far planes around the cube.
 */
export const ORTHO_HALF = 1.0
export const CAM_DISTANCE = 3
/** Compass ring (world units, cube side = 1): just outside the cube's footprint (half-diagonal 0.707), at its base. */
const RING_SIZE = 0.72
const RING_Y = -0.5
/** The Face arrow: a flat triangle on the ring, tip outward. */
const ARROW_SIZE = 0.07
/** Label decals: a shell just outside the box, above the hover patch (0.01 proud), so labels always read on top. */
const DECAL_OFFSET = 0.515
/** A press that moves more than this (CSS px) is a drag (orbit), never a click. */
const DRAG_PX = 4
/** Orbit speed of a cube drag (radians per CSS px). */
const ORBIT_PER_PX = 0.01

/** Each face: outward normal and the label's up, in the CUBE frame (cubeZones.ts). Dessus / Dessous read north-up. */
const FACES: readonly { face: CubeFace; n: XYZ; up: XYZ }[] = [
  { face: 'face', n: { x: 0, y: 0, z: 1 }, up: { x: 0, y: 1, z: 0 } },
  { face: 'arriere', n: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 } },
  { face: 'droite', n: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } },
  { face: 'gauche', n: { x: -1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } },
  // Seen from above with the Face heading, the screen's up is toward the stage (−z); from below, toward the audience.
  { face: 'dessus', n: { x: 0, y: 1, z: 0 }, up: { x: 0, y: 0, z: -1 } },
  { face: 'dessous', n: { x: 0, y: -1, z: 0 }, up: { x: 0, y: 0, z: 1 } },
]

const v3 = (p: XYZ): Vector3 => new Vector3(p.x, p.y, p.z)

/** Unlit, coloured by the vertex colours (the box's per-face shades). */
function vertexShaded(name: string, scene: Scene): StandardMaterial {
  const m = new StandardMaterial(name, scene)
  m.disableLighting = true // no light term at all: the emissive carries the colour
  m.diffuseColor = Color3.Black()
  m.specularColor = Color3.Black()
  m.emissiveColor = Color3.White() // × vertex colour (Babylon multiplies the emissive by the base colour)
  return m
}

/** Vertex colours of the body box by face normal: top lighter, sides, bottom darker (volume without lights). */
function faceShades(box: Mesh): number[] {
  const normals = box.getVerticesData(VertexBuffer.NormalKind) ?? []
  const top = Color3.FromHexString(K.bodyTop)
  const side = Color3.FromHexString(K.body)
  const bottom = Color3.FromHexString(K.bodyBottom)
  const out: number[] = []
  for (let i = 0; i < normals.length; i += 3) {
    const ny = normals[i + 1]
    const c = ny > 0.5 ? top : ny < -0.5 ? bottom : side
    out.push(c.r, c.g, c.b, 1)
  }
  return out
}

function unlit(name: string, scene: Scene, color: string): StandardMaterial {
  const m = new StandardMaterial(name, scene)
  m.disableLighting = true
  m.diffuseColor = Color3.Black()
  m.specularColor = Color3.Black()
  m.emissiveColor = Color3.FromHexString(color)
  return m
}

export class ViewCubeWidget {
  /** The transparent pointer layer over the cube square (the viewport's only overlay). */
  readonly hitElement: HTMLElement
  /** The hovered zone's name under the square (no pointer events, hidden when nothing is hovered). */
  readonly caption: HTMLElement
  /** Every mesh of the cube (excluded from the selection stroke by the host). */
  readonly meshes: Mesh[] = []
  private readonly cubeCam: ArcRotateCamera
  private readonly box: Mesh
  private readonly hover: Mesh
  private readonly canvas: HTMLCanvasElement | null
  private hovered: ZoneSigns | null = null
  private press: {
    id: number
    x: number
    y: number
    lastX: number
    lastY: number
    drag: boolean
  } | null = null
  private disposed = false
  private readonly prevMainMask: number

  constructor(
    private readonly scene: Scene,
    private readonly main: ArcRotateCamera,
    private readonly rig: CameraRig,
    private readonly scheduler: RenderScheduler,
    bag: DisposableBag
  ) {
    const engine = scene.getEngine()
    this.canvas = engine.getRenderingCanvas()

    // ── second camera: own viewport, own layer; never attached to input
    this.prevMainMask = main.layerMask
    main.layerMask = MAIN_LAYER
    const cam = new ArcRotateCamera(
      'cube-cam',
      main.alpha,
      main.beta,
      CAM_DISTANCE,
      Vector3.Zero(),
      scene
    )
    cam.layerMask = CUBE_LAYER
    cam.mode = Camera.ORTHOGRAPHIC_CAMERA
    cam.orthoLeft = -ORTHO_HALF
    cam.orthoRight = ORTHO_HALF
    cam.orthoBottom = -ORTHO_HALF
    cam.orthoTop = ORTHO_HALF
    cam.minZ = 0.1
    cam.maxZ = 10
    // Mirrors every main pose, poles included (Dessus / Dessous sit at 0.0001 from them).
    cam.lowerBetaLimit = 0.0001
    cam.upperBetaLimit = Math.PI - 0.0001
    cam.lowerRadiusLimit = cam.upperRadiusLimit = CAM_DISTANCE
    this.cubeCam = cam
    scene.activeCameras = [main, cam]
    // The cube camera renders last, so Babylon leaves it as `activeCamera` after a frame: give the
    // main camera back (device picking, the render scheduler's inertia check), and the pointers.
    scene.cameraToUseForPointers = main
    // Its view-projection too: screen projections read the scene's current transform (projectToScreen).
    // Inserted FIRST, so every other after-render observer (now or later) sees the main camera.
    const restore = scene.onAfterRenderObservable.add(
      () => {
        if (scene.activeCamera !== main) scene.activeCamera = main
        scene.setTransformMatrix(main.getViewMatrix(), main.getProjectionMatrix())
      },
      undefined,
      true
    )
    bag.add(() => void scene.onAfterRenderObservable.remove(restore))
    bag.observe(main.onViewMatrixChangedObservable, () => this.sync())

    // ── the cube: one box (picked; shaded per face), six label decals, the hover patch, the compass ring
    const box = MeshBuilder.CreateBox('cube:box', { size: 1 }, scene)
    box.material = vertexShaded('mat:cube:body', scene)
    box.setVerticesData(VertexBuffer.ColorKind, faceShades(box))
    this.box = this.own(box)
    const textures = FACES.map(({ face, n, up }) => {
      const t = cubeFaceTexture(scene, face)
      const mat = new StandardMaterial(`mat:cube:${face}`, scene)
      mat.disableLighting = true
      mat.diffuseColor = Color3.Black()
      mat.specularColor = Color3.Black()
      mat.emissiveTexture = t.texture
      mat.opacityTexture = t.texture // transparent decal: the shaded body and the hover patch show through
      const plane = MeshBuilder.CreatePlane(`cube:label:${face}`, { size: 2 * DECAL_OFFSET }, scene)
      plane.material = mat
      plane.alphaIndex = 1 // always after the hover patch (alphaIndex 0), whatever the camera distance sort says
      // World frame of the decal: local −z faces out (a plane's front), +y is the label's up.
      const nw = v3(cubeToWorld(n))
      const uw = v3(cubeToWorld(up))
      const forward = nw.scale(-1)
      const right = Vector3.Cross(uw, forward)
      plane.rotation = Vector3.RotationFromAxis(right, uw, forward)
      plane.position = nw.scale(DECAL_OFFSET)
      this.own(plane)
      return t
    })
    whenLabelFontReady(() => {
      if (this.disposed) return
      for (const t of textures) t.redraw()
      scheduler.invalidate()
    })

    const hoverMat = unlit('mat:cube:hover', scene, K.hover)
    hoverMat.alpha = K.hoverAlpha
    const hover = MeshBuilder.CreateBox('cube:hover', { size: 1 }, scene)
    hover.material = hoverMat
    hover.alphaIndex = 0
    hover.setEnabled(false)
    this.hover = this.own(hover)

    this.buildRing()

    // ── the pointer layer, positioned over the cube square inside the viewport
    const doc = (globalThis as { document?: Document }).document
    const el = doc!.createElement('div')
    el.className = 'cr-cube-hit'
    el.dataset.testid = 'view-cube'
    // Not a tab stop and hidden from assistive tech (so no name either): the named views live in
    // the Vue menu and the V picker (Task 18).
    el.setAttribute('aria-hidden', 'true')
    this.hitElement = el
    this.canvas?.parentElement?.appendChild(el)
    // The hovered zone's name, just below the square (Fix 3): edge / corner patches carry no label of
    // their own and « DESSUS » is foreshortened. DOM only: showing it never asks a frame.
    const cap = doc!.createElement('div')
    cap.className = 'cr-cube-caption'
    cap.dataset.testid = 'view-cube-caption'
    cap.setAttribute('aria-hidden', 'true')
    cap.style.display = 'none'
    this.caption = cap
    this.canvas?.parentElement?.appendChild(cap)
    this.layout()
    bag.observe(engine.onResizeObservable, () => this.layout())
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function')
      bag.listen(window, 'resize', () => this.layout())

    bag.listen(el, 'pointerdown', (e: PointerEvent) => this.onDown(e))
    bag.listen(el, 'pointermove', (e: PointerEvent) => this.onMove(e))
    bag.listen(el, 'pointerup', (e: PointerEvent) => this.onUp(e))
    bag.listen(el, 'pointercancel', () => this.endPress())
    bag.listen(el, 'pointerleave', () => {
      if (!this.press) this.setHover(null)
    })
    bag.listen(el, 'contextmenu', (e: Event) => e.preventDefault())
    // WCAG 1.4.13: Échap dismisses the caption without moving the pointer. Passive: the key is not
    // taken (the rest of the Esc chain, e.g. clearing the selection, still runs) and the camera
    // never moves. The same zone stays quiet until the pointer reaches another zone or leaves.
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function')
      bag.listen(window, 'keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape') this.caption.style.display = 'none'
      })
    // The wheel over the cube zooms the room as anywhere else in the view: hand it to the canvas
    // (same point and deltas, so zoom-to-cursor works); the page never scrolls.
    bag.listen(
      el,
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault()
        this.canvas?.dispatchEvent(
          new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            clientX: e.clientX,
            clientY: e.clientY,
            screenX: e.screenX,
            screenY: e.screenY,
            deltaX: e.deltaX,
            deltaY: e.deltaY,
            deltaZ: e.deltaZ,
            deltaMode: e.deltaMode,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey,
            buttons: e.buttons,
          })
        )
      },
      { passive: false }
    )
    bag.add(() => this.dispose())
    this.sync()
    scheduler.invalidate()
  }

  /** C-a: 120 px, 130 px from a 1600 px wide window. */
  sizePx(): 120 | 130 {
    return cubeSizePx(typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 0)
  }

  /** The zone under a canvas point (CSS px), or null when the point misses the cube. */
  zoneAtCanvas(x: number, y: number): ZoneSigns | null {
    if (this.disposed) return null
    this.sync()
    const hit = this.scene.pick(x, y, (m) => m === this.box, false, this.cubeCam)
    if (!hit?.hit || !hit.pickedPoint) return null
    return classifyHit(worldToCube(hit.pickedPoint))
  }

  /** The zone under a page point (CSS px), or null outside the cube square / the cube. */
  zoneAtPage(x: number, y: number): ZoneSigns | null {
    const r = this.hitElement.getBoundingClientRect?.()
    const c = this.canvas?.getBoundingClientRect()
    if (!r || !c || x < r.left || x >= r.right || y < r.top || y >= r.bottom) return null
    return this.zoneAtCanvas(x - c.left, y - c.top)
  }

  /** The hovered zone id (Ambre patch on screen), or null. */
  hoveredZone(): string | null {
    return this.hovered ? zoneId(this.hovered) : null
  }

  /**
   * Debug / e2e: turn the main camera to the zone's own pose, then return the
   * cube centre in page px (that zone's patch is there). Null for an unknown id.
   */
  async zoneScreenPoint(id: string): Promise<{ x: number; y: number } | null> {
    const s = ZONES.find((z) => zoneId(z) === id)
    if (!s || this.disposed) return null
    const a = zoneAngles(s)
    const ms = this.rig.flyToView(a.alpha, a.beta)
    this.scheduler.invalidate()
    if (ms > 0) await new Promise((r) => setTimeout(r, ms + 60))
    this.sync()
    const r = this.hitElement.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const scene = this.scene
    if (!scene.isDisposed) {
      scene.activeCameras = [this.main]
      if (scene.cameraToUseForPointers === this.main) scene.cameraToUseForPointers = null
      scene.activeCamera = this.main
    }
    this.main.layerMask = this.prevMainMask
    this.hitElement.remove?.()
    this.caption.remove?.()
    for (const m of this.meshes) {
      const mat = m.material
      m.dispose(false, false)
      if (mat && !mat.isFrozen) mat.dispose(true, true)
    }
    this.meshes.length = 0
    this.cubeCam.dispose()
  }

  // ── internals ─────────────────────────────────────────────────────────

  private own<M extends Mesh>(m: M): M {
    m.layerMask = CUBE_LAYER
    m.isPickable = false // picked only through `zoneAtCanvas`' explicit predicate
    this.meshes.push(m)
    return m
  }

  /** The cube turns exactly like the room. */
  private sync(): void {
    if (this.disposed) return
    this.cubeCam.alpha = this.main.alpha
    this.cubeCam.beta = this.main.beta
  }

  /** Square size and place: 16 px from the viewport's top-left; the camera viewport follows the canvas. */
  private layout(): void {
    if (this.disposed) return
    const size = this.sizePx()
    const engine = this.scene.getEngine()
    const c = this.canvas
    const w = c?.clientWidth || engine.getRenderWidth()
    const h = c?.clientHeight || engine.getRenderHeight()
    const v = cubeViewport(w, h, size)
    this.cubeCam.viewport = new Viewport(v.x, v.y, v.width, v.height)
    const s = this.hitElement.style
    s.left = `${(c?.offsetLeft ?? 0) + K.marginPx}px`
    s.top = `${(c?.offsetTop ?? 0) + K.marginPx}px`
    s.width = `${size}px`
    s.height = `${size}px`
    const cs = this.caption.style
    cs.left = s.left
    cs.top = `${(c?.offsetTop ?? 0) + K.marginPx + size + 4}px`
    this.scheduler.invalidate()
  }

  private buildRing(): void {
    const scene = this.scene
    const mat = unlit('mat:cube:ring', scene, K.ring)
    mat.backFaceCulling = false // the flat arrow reads from above and below
    const ring = MeshBuilder.CreateTorus(
      'cube:ring',
      { diameter: RING_SIZE * 2, thickness: 0.014, tessellation: 72 },
      scene
    )
    ring.position.y = RING_Y
    // 12 ticks (every 30°; the four quarters longer), merged with the ring and the arrow: one mesh, one draw.
    const parts: Mesh[] = [ring]
    for (let k = 0; k < 12; k++) {
      if (k === 0) continue // the Face arrow stands there
      const a = (k * Math.PI) / 6
      const tick = MeshBuilder.CreateBox(
        'cube:tick',
        { width: 0.014, height: 0.008, depth: k % 3 === 0 ? 0.08 : 0.05 },
        scene
      )
      tick.position = new Vector3(Math.sin(a) * RING_SIZE, RING_Y, Math.cos(a) * RING_SIZE)
      tick.rotation.y = a
      parts.push(tick)
    }
    // « FACE » arrow: a flat triangle on the ring, pointing to the audience side (cube +z = world +z).
    const arrow = MeshBuilder.CreateDisc(
      'cube:arrow',
      { radius: ARROW_SIZE, tessellation: 3 },
      scene
    )
    arrow.rotation.x = Math.PI / 2 // lie flat
    arrow.rotation.y = -Math.PI / 2 // one tip toward +z
    arrow.position = new Vector3(0, RING_Y, RING_SIZE + ARROW_SIZE * 0.5)
    parts.push(arrow)
    const merged = Mesh.MergeMeshes(parts, true, true)
    if (merged) {
      merged.name = 'cube:ring'
      merged.material = mat
      this.own(merged)
    }
  }

  private setHover(z: ZoneSigns | null): void {
    const same = z && this.hovered ? zoneId(z) === zoneId(this.hovered) : z === this.hovered
    if (same) return
    this.hovered = z // a new zone (or none) resets an Échap-dismissed caption
    if (z) {
      const b = zoneBox(z)
      const c = cubeToWorld({ x: b.center[0], y: b.center[1], z: b.center[2] })
      this.hover.position.set(c.x, c.y, c.z)
      this.hover.scaling.set(b.size[0], b.size[1], b.size[2]) // sizes are unsigned: the mirror does not apply
      this.hover.setEnabled(true)
    } else this.hover.setEnabled(false)
    this.caption.textContent = z ? zoneLabel(z) : ''
    this.caption.style.display = z ? '' : 'none'
    this.hitElement.style.cursor = z ? 'pointer' : ''
    this.scheduler.invalidate()
  }

  private canvasPoint(e: PointerEvent): { x: number; y: number } {
    const c = this.canvas?.getBoundingClientRect()
    return { x: e.clientX - (c?.left ?? 0), y: e.clientY - (c?.top ?? 0) }
  }

  private onDown(e: PointerEvent): void {
    if (e.button !== 0 || this.press) return
    e.preventDefault()
    this.press = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      drag: false,
    }
    this.hitElement.setPointerCapture?.(e.pointerId)
  }

  private onMove(e: PointerEvent): void {
    const p = this.press
    if (!p) {
      const { x, y } = this.canvasPoint(e)
      this.setHover(this.zoneAtCanvas(x, y))
      return
    }
    if (e.pointerId !== p.id) return
    if (!p.drag && Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRAG_PX) {
      p.drag = true
      // The learner takes the camera: as a canvas press, stop a flight and end a lifted top / bottom guard.
      this.rig.cancelFlight()
      this.rig.restoreBetaLimits()
      this.setHover(null)
      this.hitElement.style.cursor = 'grabbing'
    }
    if (!p.drag) return
    const dx = e.clientX - p.lastX
    const dy = e.clientY - p.lastY
    p.lastX = e.clientX
    p.lastY = e.clientY
    // Same senses as Babylon's pointer orbit on the canvas: the cube turns with the hand, like the room.
    const m = this.main
    m.alpha -= dx * ORBIT_PER_PX
    const lo = m.lowerBetaLimit ?? 0.0001
    const hi = m.upperBetaLimit ?? Math.PI - 0.0001
    m.beta = Math.min(hi, Math.max(lo, m.beta - dy * ORBIT_PER_PX))
    this.scheduler.invalidate()
  }

  private onUp(e: PointerEvent): void {
    const p = this.press
    if (!p || e.pointerId !== p.id) return
    this.endPress()
    if (p.drag) {
      const { x, y } = this.canvasPoint(e)
      this.setHover(this.zoneAtCanvas(x, y))
      return
    }
    const { x, y } = this.canvasPoint(e)
    const z = this.zoneAtCanvas(x, y)
    if (!z) return // the square's corners outside the cube: nothing, no flight
    const a = zoneAngles(z)
    const ms = this.rig.flyToView(a.alpha, a.beta) // reduced motion: CameraRig cuts
    this.scheduler.invalidate()
    // A cut turned the cube under the pointer: show what is there now; a flight shows it on the next move.
    this.setHover(ms === 0 ? this.zoneAtCanvas(x, y) : null)
  }

  private endPress(): void {
    const p = this.press
    if (!p) return
    this.press = null
    if (this.hitElement.hasPointerCapture?.(p.id)) this.hitElement.releasePointerCapture(p.id)
    this.hitElement.style.cursor = ''
  }
}
