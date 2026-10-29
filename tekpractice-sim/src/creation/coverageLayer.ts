/**
 * The coverage dots in the 3D scene (Task 37, C13). A scene adapter: it draws what the controller hands it and owns every Babylon object it makes
 * (meshes, materials, the hatch texture, observers); `dispose()` releases all of it, idempotent, and the controller puts it in the place's bag so a
 * place change takes it away with the scene.
 *
 * - ONE thin-instanced disc mesh for the plain dots (`coverage`: `thinInstanceSetBuffer('matrix')` + `'color'`, one draw call whatever the number
 *   of dots) and ONE for the hatched dots, the points where two speakers are within 6 dB of each other (`coverage:hatch`, a striped texture on the
 *   same disc: « interférences non modélisées »). The colour of a dot is the locked palette bin of its relative level (coveragePalette.ts).
 * - Aim lines (`coverage:aim`): one thin line per speaker that makes sound, along its acoustic axis, so the learner sees where the model
 *   thinks the speaker points (the yaw 0 = +z convention of ADR-0015, made visible). One line-system mesh, drawn only while the coverage is shown.
 * - A pin ring (`coverage:pin`) on the dot whose value is pinned.
 * Nothing here runs per frame: buffers are written once per result, and the draw-call counters are observers that only fire when the mesh draws.
 */
import { Color3, DynamicTexture, Mesh, MeshBuilder, Observer, Scene, StandardMaterial, Vector3, Matrix, type Nullable } from '@babylonjs/core'
import type { AcSource } from '../acoustics/field'
import { scaleBin } from '../acoustics/scale'
import { COVERAGE_PALETTE, hexToRgb01 } from './coveragePalette'
import { CREATION_TOKENS } from '../design/creationTokens'

/** Length of an aim line (m) and of its arrowhead. */
export const AIM_LENGTH_M = 4
const ARROW_M = 0.35
/** A dot fills this share of its grid cell (neighbours never touch). */
const DOT_FILL = 0.8
const HATCH_PX = 64

export interface DotHit {
  index: number
  position: [number, number, number]
}

export class CoverageLayer {
  private plain: Mesh
  private hatch: Mesh
  private aim: Mesh | null = null
  private pin: Mesh | null = null
  private mats: StandardMaterial[] = []
  private hatchTexture: DynamicTexture | null = null
  private observers: { mesh: Mesh; o: Nullable<Observer<Mesh>>; lines: boolean }[] = []
  private draws = new Map<string, { frame: number; count: number }>()
  private disposed = false
  /** false while the legend is out of sight (Propriétés folded): every mesh is hidden, nothing is computed or lost, and the layer returns on unfold. */
  private visible = true
  private pinOn = false
  /** What is on screen (for picking and for the e2e oracle). */
  private shown: { points: Float32Array; step: number; plain: number; hatched: number } | null = null
  private aimShown: { id: string; from: [number, number, number]; to: [number, number, number] }[] = []

  constructor(
    readonly scene: Scene,
    private readonly invalidate: () => void
  ) {
    this.plain = this.makeDots('coverage', this.material('coverage:mat', null))
    this.hatch = this.makeDots('coverage:hatch', this.material('coverage:mat:hatch', this.hatchPattern()))
    this.plain.setEnabled(false)
    this.hatch.setEnabled(false)
  }

  private material(name: string, texture: DynamicTexture | null): StandardMaterial {
    const m = new StandardMaterial(name, this.scene)
    // Unlit: the colour on screen is the palette colour (the instance colour multiplies the white emissive base), never shaded by the key light.
    m.disableLighting = true
    m.emissiveColor = Color3.White()
    m.diffuseColor = Color3.White()
    m.specularColor = Color3.Black()
    m.backFaceCulling = false
    if (texture) m.diffuseTexture = texture
    this.mats.push(m)
    return m
  }

  /** White with dark diagonal stripes: the thin-instance colour tints the white, the stripes stay dark. */
  private hatchPattern(): DynamicTexture {
    const tex = new DynamicTexture('coverage:tex:hatch', { width: HATCH_PX, height: HATCH_PX }, this.scene, true)
    const ctx = tex.getContext() as CanvasRenderingContext2D
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, HATCH_PX, HATCH_PX)
    ctx.strokeStyle = CREATION_TOKENS.color.nuit
    ctx.lineWidth = 11
    for (let k = -HATCH_PX; k <= HATCH_PX * 2; k += 22) {
      ctx.beginPath()
      ctx.moveTo(k, HATCH_PX)
      ctx.lineTo(k + HATCH_PX, 0)
      ctx.stroke()
    }
    tex.update()
    this.hatchTexture = tex
    return tex
  }

  private makeDots(name: string, mat: StandardMaterial): Mesh {
    const disc = MeshBuilder.CreateDisc(name, { radius: 0.5, tessellation: 14 }, this.scene)
    // Lie flat (the disc is built in the xy plane): baked into the vertices, so every instance matrix is a plain scale + translation.
    disc.rotation.x = Math.PI / 2
    disc.bakeCurrentTransformIntoVertices()
    disc.material = mat
    disc.isPickable = false
    disc.alwaysSelectAsActiveMesh = true // the instances spread over the whole room; the unit disc's own box is at the origin
    disc.doNotSyncBoundingInfo = true
    this.countDraws(disc)
    return disc
  }

  /** Counts the draws of `mesh` in the latest frame it drew: the e2e oracle for « one draw call » (an observer, not a per-frame hook of ours). */
  private countDraws(mesh: Mesh, lines = false): void {
    // A LinesMesh draws through its own path that never notifies `onBeforeDraw`: its renders are its draws (one sub-mesh).
    const o = (lines ? mesh.onBeforeRenderObservable : mesh.onBeforeDrawObservable).add(() => {
      const frame = this.scene.getFrameId()
      const r = this.draws.get(mesh.name) ?? { frame, count: 0 }
      if (r.frame !== frame) {
        r.frame = frame
        r.count = 0
      }
      r.count++
      this.draws.set(mesh.name, r)
    })
    this.observers.push({ mesh, o, lines })
  }

  /** Draw calls of the mesh called `name` in the latest frame in which it drew (0 if it never did). */
  drawCalls(name: string): number {
    return this.draws.get(name)?.count ?? 0
  }

  /**
   * Draw the field: one dot per grid point, coloured by the palette bin of its relative level; points flagged as overlap go to the hatched mesh.
   * Silent points (−Infinity, nothing is fed there) are left out: no sound, no dot.
   */
  show(points: Float32Array, relDb: Float32Array, overlap: Uint8Array, stepM: number): void {
    if (this.disposed) return
    const n = relDb.length
    let plain = 0
    let hatched = 0
    for (let i = 0; i < n; i++) {
      if (!(relDb[i] > -Infinity)) continue
      if (overlap[i] === 1) hatched++
      else plain++
    }
    const scale = stepM * DOT_FILL
    const fill = (mesh: Mesh, count: number, hatchedPass: boolean): void => {
      if (count === 0) {
        mesh.setEnabled(false)
        mesh.thinInstanceSetBuffer('matrix', null)
        return
      }
      const m = new Float32Array(16 * count)
      const c = new Float32Array(4 * count)
      let k = 0
      for (let i = 0; i < n; i++) {
        if (!(relDb[i] > -Infinity) || (overlap[i] === 1) !== hatchedPass) continue
        m.set([scale, 0, 0, 0, 0, 1, 0, 0, 0, 0, scale, 0, points[3 * i], points[3 * i + 1], points[3 * i + 2], 1], 16 * k)
        const rgb = hexToRgb01(COVERAGE_PALETTE[scaleBin(relDb[i])])
        c.set([rgb[0], rgb[1], rgb[2], 1], 4 * k)
        k++
      }
      mesh.thinInstanceSetBuffer('matrix', m, 16, true)
      mesh.thinInstanceSetBuffer('color', c, 4, true)
      mesh.thinInstanceRefreshBoundingInfo(true)
      mesh.setEnabled(this.visible)
    }
    fill(this.plain, plain, false)
    fill(this.hatch, hatched, true)
    this.shown = { points: points.slice(), step: stepM, plain, hatched }
    this.invalidate()
  }

  /** Take the dots away (nothing to show: no audience, no audible speaker, coverage off). */
  clearDots(): void {
    if (this.disposed) return
    for (const m of [this.plain, this.hatch]) {
      m.setEnabled(false)
      m.thinInstanceSetBuffer('matrix', null)
    }
    this.shown = null
    this.invalidate()
  }

  /** Hide / show every coverage mesh at once (one frame). The buffers stay: showing again costs no computation. */
  setVisible(visible: boolean): void {
    if (this.disposed || visible === this.visible) return
    this.visible = visible
    this.plain.setEnabled(visible && (this.shown?.plain ?? 0) > 0)
    this.hatch.setEnabled(visible && (this.shown?.hatched ?? 0) > 0)
    this.aim?.setEnabled(visible)
    this.pin?.setEnabled(visible && this.pinOn)
    this.invalidate()
  }

  get isVisible(): boolean {
    return this.visible
  }

  /** Names of the coverage meshes that are enabled (drawn) right now. */
  get enabledMeshes(): string[] {
    return [this.plain, this.hatch, this.aim, this.pin].filter((m): m is Mesh => m !== null && !m.isDisposed() && m.isEnabled()).map((m) => m.name)
  }

  /** Dots on screen: plain and hatched. */
  get counts(): { plain: number; hatched: number } {
    return { plain: this.shown?.plain ?? 0, hatched: this.shown?.hatched ?? 0 }
  }

  /** The aim lines (cheap: one small mesh, rebuilt on a rig change). `[]` removes them. */
  setAim(sources: readonly AcSource[]): void {
    if (this.disposed) return
    const d2r = Math.PI / 180
    const lines: Vector3[][] = []
    const shown: typeof this.aimShown = []
    for (const s of sources) {
      const yaw = s.pose.yawDeg * d2r
      const tilt = s.pose.tiltDeg * d2r
      // The acoustic axis of ADR-0015: (sin yaw·cos tilt, sin tilt, cos yaw·cos tilt).
      const ax = new Vector3(Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt))
      const from = Vector3.FromArray(s.pose.position)
      const to = from.add(ax.scale(AIM_LENGTH_M))
      // an arrowhead: two short strokes back from the tip, in the horizontal plane of the axis
      const side = Vector3.Cross(ax, Vector3.Up())
      const perp = side.lengthSquared() > 1e-6 ? side.normalize() : new Vector3(1, 0, 0)
      const back = to.subtract(ax.scale(ARROW_M))
      lines.push([from, to], [to, back.add(perp.scale(ARROW_M * 0.5))], [to, back.subtract(perp.scale(ARROW_M * 0.5))])
      shown.push({ id: s.id, from: [from.x, from.y, from.z], to: [to.x, to.y, to.z] })
    }
    this.aimShown = shown
    if (this.aim) {
      this.aim.dispose(false, false)
      this.aim = null
    }
    const old = this.observers.filter((x) => x.mesh.name === 'coverage:aim')
    for (const x of old) (x.lines ? x.mesh.onBeforeRenderObservable : x.mesh.onBeforeDrawObservable).remove(x.o)
    this.observers = this.observers.filter((x) => !old.includes(x))
    if (lines.length) {
      const aim = MeshBuilder.CreateLineSystem('coverage:aim', { lines }, this.scene)
      aim.color = Color3.FromHexString(CREATION_TOKENS.color.papier)
      aim.isPickable = false
      aim.alwaysSelectAsActiveMesh = true
      aim.setEnabled(this.visible)
      this.countDraws(aim, true)
      this.aim = aim
    }
    this.invalidate()
  }

  /** The aim lines on screen: speaker id and the two ends (world), for the e2e. */
  get aimLines(): readonly { id: string; from: [number, number, number]; to: [number, number, number] }[] {
    return this.aimShown
  }

  /** A ring on a pinned dot; null removes it. */
  setPin(at: [number, number, number] | null, stepM: number): void {
    if (this.disposed) return
    this.pinOn = at !== null
    if (!at) {
      this.pin?.setEnabled(false)
      this.invalidate()
      return
    }
    if (!this.pin) {
      const ring = MeshBuilder.CreateTorus('coverage:pin', { diameter: 1, thickness: 0.07, tessellation: 28 }, this.scene)
      const mat = this.material('coverage:mat:pin', null)
      mat.emissiveColor = Color3.FromHexString(CREATION_TOKENS.color.ambre)
      mat.diffuseColor = Color3.Black()
      ring.material = mat
      ring.isPickable = false
      this.countDraws(ring)
      this.pin = ring
    }
    const d = stepM * 1.15
    this.pin.scaling.set(d, 1, d)
    this.pin.position.set(at[0], at[1] + 0.01, at[2])
    this.pin.setEnabled(this.visible)
    this.invalidate()
  }

  /**
   * The dot whose grid cell the pointer is over (canvas px), or null. The pointer ray is cut with the horizontal plane of each dot level (the pit and
   * a balcony have different heights) and the nearest cell hit wins. O(points) per call, on a click only.
   */
  pickDot(x: number, y: number): DotHit | null {
    const shown = this.shown
    const camera = this.scene.activeCamera
    if (this.disposed || !this.visible || !shown || !camera) return null
    const ray = this.scene.createPickingRay(x, y, Matrix.Identity(), camera)
    const { points, step } = shown
    const levels = new Set<number>()
    for (let i = 1; i < points.length; i += 3) levels.add(Math.round(points[i] * 1000) / 1000)
    let best: { t: number; index: number } | null = null
    for (const level of levels) {
      if (Math.abs(ray.direction.y) < 1e-6) continue
      const t = (level - ray.origin.y) / ray.direction.y
      if (!(t > 0)) continue
      const hx = ray.origin.x + ray.direction.x * t
      const hz = ray.origin.z + ray.direction.z * t
      for (let i = 0; i < points.length; i += 3) {
        if (Math.abs(points[i + 1] - level) > 1e-3) continue
        if (Math.abs(points[i] - hx) <= step / 2 && Math.abs(points[i + 2] - hz) <= step / 2) {
          if (!best || t < best.t) best = { t, index: i / 3 }
          break
        }
      }
    }
    return best ? { index: best.index, position: [points[3 * best.index], points[3 * best.index + 1], points[3 * best.index + 2]] } : null
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const x of this.observers) (x.lines ? x.mesh.onBeforeRenderObservable : x.mesh.onBeforeDrawObservable).remove(x.o)
    this.observers = []
    for (const m of [this.plain, this.hatch, this.aim, this.pin]) if (m && !m.isDisposed()) m.dispose(false, false)
    for (const m of this.mats) m.dispose(false, false)
    this.hatchTexture?.dispose()
    this.aim = null
    this.pin = null
    this.shown = null
    this.aimShown = []
    this.mats = []
    this.hatchTexture = null
  }
}
