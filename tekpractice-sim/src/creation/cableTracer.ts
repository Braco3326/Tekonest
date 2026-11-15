/**
 * The scene part of a hand-drawn cable (mission 3 B stage 2, spec §1 items 3 and 5): a LAZY chunk, fetched the first time a cable is traced or a routed cable is
 * selected (cableRouteController.ts), never at boot. It only draws; it holds no state of its own beyond its meshes and never touches the store.
 *
 * - Tracing: the grid of the chosen snap size on the floor around the cursor (fading out with distance, following the floor height at each crossing, inside the
 *   room), a dot at each placed point, the placed path (port A → the points), a dashed preview from the last point to the cursor and on to port B, the cursor ring.
 * - Editing: a handle at each point of the stored route (the chosen one bigger and Papier), and during a drag the dragged point and its dashed neighbours.
 * - Every mark keeps a constant size on screen (sized from the camera distance at each redraw; the controller redraws on every camera change): never too small
 *   to see or to aim at. Nothing is pickable; the controller hit-tests in screen space.
 * Colours: the scene tokens (Ambre selection, Papier hover), as the device selection and hover.
 */
import { Color3, Color4, Mesh, MeshBuilder, StandardMaterial, Vector3, type LinesMesh, type Scene } from '@babylonjs/core'
import type { XZ } from '../scene/cableGravity'
import type { FloorBounds } from '../scene/cableRoute'
import { CREATION_TOKENS } from '../design/creationTokens'

type P3 = { x: number; y: number; z: number }

/** Lift above the floor (m): the grid and the marks sit on it without z-fighting. */
const LIFT_M = 0.012
/** Marks, in CSS px on screen (diameters). */
export const DOT_PX = 12
export const CURSOR_PX = 22
export const HANDLE_PX = 18
export const HANDLE_SELECTED_PX = 26

export interface TracerView {
  /** Metres per CSS px at a world point (from the camera): marks keep their size on screen. */
  metresPerPx(at: P3): number
  floorAt(x: number, z: number): number
  bounds(): FloorBounds | null
}

export interface TraceDrawing {
  step: number
  cursor: XZ
  candidate: XZ
  points: readonly XZ[]
  /** The two ports (world). */
  from: P3
  to: P3
}

export interface HandleDrawing {
  route: readonly XZ[]
  selected: number | null
  /** The two ports (world): the dashed neighbours of a dragged point. */
  from: P3
  to: P3
  /** A point being dragged (index, where it is now). */
  drag?: { index: number; at: XZ } | null
}

const ambre = Color3.FromHexString(CREATION_TOKENS.scene.selection)
const papier = Color3.FromHexString(CREATION_TOKENS.scene.hover)

export class CableTracer {
  private meshes: Mesh[] = []
  private readonly matDot: StandardMaterial
  private readonly matCursor: StandardMaterial
  private readonly matHandle: StandardMaterial
  private readonly matHandleSel: StandardMaterial

  constructor(
    private readonly scene: Scene,
    private readonly view: TracerView
  ) {
    const flat = (name: string, c: Color3): StandardMaterial => {
      const m = new StandardMaterial(name, scene)
      m.diffuseColor = c
      m.emissiveColor = c
      m.disableLighting = true
      return m
    }
    this.matDot = flat('trace:dot', ambre)
    this.matCursor = flat('trace:cursor', papier)
    this.matHandle = flat('trace:handle', ambre)
    this.matHandleSel = flat('trace:handle-sel', papier)
  }

  /** How many meshes it holds now (tests, the « no leak » check). */
  get meshCount(): number {
    return this.meshes.length
  }

  private lift(p: XZ): Vector3 {
    return new Vector3(p.x, this.view.floorAt(p.x, p.z) + LIFT_M, p.z)
  }

  private keep<T extends Mesh>(m: T): T {
    m.isPickable = false
    this.meshes.push(m)
    return m
  }

  clear(): void {
    for (const m of this.meshes) m.dispose(false, false)
    this.meshes = []
  }

  private sphere(name: string, at: Vector3, px: number, mat: StandardMaterial): void {
    const d = px * this.view.metresPerPx(at)
    const s = this.keep(MeshBuilder.CreateSphere(name, { diameter: d, segments: 10 }, this.scene))
    s.position.copyFrom(at)
    s.material = mat
    s.renderingGroupId = 1 // drawn over the cable and the floor: a mark is never hidden by the tube it sits on
  }

  private line(name: string, pts: Vector3[], color: Color3, dashed = false): void {
    if (pts.length < 2) return
    const m = dashed
      ? MeshBuilder.CreateDashedLines(name, { points: pts, dashSize: 3, gapSize: 2, dashNb: Math.max(8, Math.round(totalLength(pts) / 0.08)) }, this.scene)
      : MeshBuilder.CreateLines(name, { points: pts }, this.scene)
    ;(m as LinesMesh).color = color
    m.renderingGroupId = 1
    this.keep(m)
  }

  /** The grid around the cursor: (2n + 1) lines each way, inside the room, alpha fading with distance. */
  private grid(step: number, cursor: XZ): void {
    const n = Math.min(12, Math.max(4, Math.ceil(1.5 / step)))
    const b = this.view.bounds()
    const inX = (x: number): boolean => !b || (x >= b.minX - 1e-9 && x <= b.maxX + 1e-9)
    const inZ = (z: number): boolean => !b || (z >= b.minZ - 1e-9 && z <= b.maxZ + 1e-9)
    const radius = n * step
    const lines: Vector3[][] = []
    const colors: Color4[][] = []
    const at = (x: number, z: number): Vector3 => new Vector3(x, this.view.floorAt(x, z) + LIFT_M * 0.5, z)
    const alpha = (x: number, z: number): number => Math.max(0.06, 0.75 * (1 - Math.hypot(x - cursor.x, z - cursor.z) / (radius * 1.05)))
    const ks = Array.from({ length: 2 * n + 1 }, (_, i) => i - n)
    for (const k of ks) {
      const x = cursor.x + k * step
      if (inX(x)) {
        const pts = ks.map((j) => cursor.z + j * step).filter(inZ).map((z) => at(x, z))
        if (pts.length > 1) {
          lines.push(pts)
          colors.push(pts.map((p) => new Color4(papier.r, papier.g, papier.b, alpha(p.x, p.z))))
        }
      }
      const z = cursor.z + k * step
      if (inZ(z)) {
        const pts = ks.map((j) => cursor.x + j * step).filter(inX).map((x2) => at(x2, z))
        if (pts.length > 1) {
          lines.push(pts)
          colors.push(pts.map((p) => new Color4(papier.r, papier.g, papier.b, alpha(p.x, p.z))))
        }
      }
    }
    if (!lines.length) return
    const g = MeshBuilder.CreateLineSystem('trace:grid', { lines, colors, useVertexAlpha: true }, this.scene)
    g.alpha = 1
    this.keep(g)
  }

  /** One frame of a tracing (everything redrawn: a handful of meshes). */
  drawTrace(t: TraceDrawing): void {
    this.clear()
    this.grid(t.step, t.cursor)
    const from = new Vector3(t.from.x, t.from.y, t.from.z)
    const to = new Vector3(t.to.x, t.to.y, t.to.z)
    const placed = t.points.map((p) => this.lift(p))
    this.line('trace:placed', [from, ...placed], ambre)
    const last = placed[placed.length - 1] ?? from
    const cand = this.lift(t.candidate)
    this.line('trace:preview', [last, cand, to], papier, true)
    placed.forEach((p, i) => this.sphere(`trace:dot:${i}`, p, DOT_PX, this.matDot))
    this.ring(cand)
  }

  private ring(at: Vector3): void {
    const d = CURSOR_PX * this.view.metresPerPx(at)
    const r = this.keep(MeshBuilder.CreateTorus('trace:cursor', { diameter: d, thickness: Math.max(d * 0.18, 0.004), tessellation: 32 }, this.scene))
    r.position.copyFrom(at)
    r.material = this.matCursor
    r.renderingGroupId = 1
  }

  /** The handles of a selected routed cable (and a drag in progress). */
  drawHandles(h: HandleDrawing): void {
    this.clear()
    const route = h.route.map((p, i) => (h.drag && h.drag.index === i ? h.drag.at : p))
    if (h.drag) {
      const i = h.drag.index
      const prev = i > 0 ? this.lift(route[i - 1]!) : new Vector3(h.from.x, h.from.y, h.from.z)
      const next = i < route.length - 1 ? this.lift(route[i + 1]!) : new Vector3(h.to.x, h.to.y, h.to.z)
      this.line('trace:drag', [prev, this.lift(route[i]!), next], papier, true)
    }
    route.forEach((p, i) => {
      const sel = i === h.selected || (h.drag?.index === i)
      this.sphere(`trace:handle:${i}`, this.lift(p), sel ? HANDLE_SELECTED_PX : HANDLE_PX, sel ? this.matHandleSel : this.matHandle)
    })
  }

  /** The world point of a plan point as the marks are drawn (the controller projects it for the hit test). */
  markWorld(p: XZ): P3 {
    const v = this.lift(p)
    return { x: v.x, y: v.y, z: v.z }
  }

  dispose(): void {
    this.clear()
    for (const m of [this.matDot, this.matCursor, this.matHandle, this.matHandleSel]) m.dispose()
  }
}

function totalLength(pts: Vector3[]): number {
  let s = 0
  for (let i = 1; i < pts.length; i++) s += Vector3.Distance(pts[i - 1]!, pts[i]!)
  return s
}

export function createCableTracer(scene: Scene, view: TracerView): CableTracer {
  return new CableTracer(scene, view)
}
