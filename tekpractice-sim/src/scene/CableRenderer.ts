/**
 * CableRenderer — Path3D-style tube cables with catenary sag.
 * One transient DRAG cable (green/red/neutral from ConnectionGraph.canConnect's
 * verdict — the renderer never judges validity itself) and N committed cables.
 * Perf guard: CableBudget degrades committed cables to straight lines before
 * frames drop (CLAUDE.md).
 */
import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core'
import type { PortRef } from '../engine/types'
import { CableBudget, catenaryPoints, FLOOR_CLEARANCE, pointAlong, SEGMENTS_FULL, type FloorRest, type P3 } from './cablePath'
import { buildSupport, gravityPath, hangInHand, type Support, type XZ } from './cableGravity'
import { motionEnabled, TOKENS } from '../design/tokens'
import { DOT_SCALE, MARK_SCALE, cueLayout, type Cue3d } from '../design/cablePattern'
import type { CableType } from '../design/cablePalette'
import { DisposableBag } from '../util/disposable'

export type DragTint = 'neutral' | 'ok' | 'bad'

const toVec = (p: P3) => new Vector3(p.x, p.y, p.z)
const CABLE_RADIUS = 0.012 // committed cable — thin dark line on the white floor
/** A dashed cable (Task 27): one dash every ~10 cm, 55 % drawn, at most this many per cable (a long run gets longer dashes). */
const DASH_PERIOD_M = 0.1
const DASH_FILL = 0.55
const DASH_MAX = 48
const DASH_MIN = 4
/** A coloured cable glows at this share of its colour (legacy committed: 0.1) so the legend colour reads in the dark room. */
const COLOR_GLOW = 0.55
/**
 * The dark underlay (mission 3, cable cues): an inverted hull this much wider than each piece of the cable, on every side (m). Only its back faces are
 * drawn, so it shows as a rim around the cable (on the dark floor, the raised stage and the light sets alike) and never covers the cable's colour.
 */
export const OUTLINE_M = 0.0015
/** A plain tube: the cue of a cable whose signal the table does not know, or of a legacy call without ends, on a renderer that draws outlines. */
const PLAIN_CUE: Cue3d = { type: 'analog-bal', radiusM: CABLE_RADIUS, runs: null, markEveryM: null }

/** What the renderer drew for a cable's cue (tests and the e2e debug hooks). */
export interface CueInfo {
  /** The cable type whose pattern was drawn; null = a plain tube (no cue, or a legacy cable). */
  type: CableType | null
  /** Dashes, beads or collars merged into the cable's mesh (0 for a plain tube). */
  pieces: number
  /** Over the point budget: drawn as the plain tube (with its outline) instead of its pattern. */
  fallback: boolean
  outline: boolean
}

/** What a creation host adds (Task 27); without them the renderer is the legacy one. */
export interface CableOptions {
  pulses?: boolean
  /** The colour of a connection between two ports (the host reads the catalog's signal). Absent = the legacy committed colour. */
  colorFor?: (a: PortRef, b: PortRef) => Color3
  /** Draw this connection dashed (a second cue next to the colour). Legacy (Task 27): `cueFor` replaces it where given. */
  dashFor?: (a: PortRef, b: PortRef) => boolean
  /**
   * Mission 3, cable cues: the line pattern of this connection (src/design/cablePattern.ts: thickness, dashes, beads, collars), null = a plain tube. The
   * pieces are merged into the cable's ONE mesh (same name, same tree / framing / hide / hover contract); the drawn path is never changed by it.
   */
  cueFor?: (a: PortRef, b: PortRef) => Cue3d | null
  /** '#RRGGBB' of a thin dark underlay under every cable (a child mesh `cable-outline:<id>`, never pickable, hidden and disposed with its cable). */
  outline?: string
  /**
   * The height of the floor under a point (a raised deck included): with it every cable, and the cable in hand, rests ON the surface instead of sagging under it
   * (founder, 2026-11-15). Absent (the legacy callers) = the cable keeps its old sag.
   */
  floorAt?: (x: number, z: number) => number
  /**
   * Mission 3 A (« gravity first »): the whole support surface (the floor and the tops of the devices resting on it), read at each draw. With it, or
   * with `floorAt` alone (then the floor is the only support), a cable is laid by gravity (cableGravity.ts): it drops from a raised port, lies on
   * the surface, goes over a device in its way, and hangs only as a small loop between two close raised ports. Absent both = the legacy sag.
   */
  support?: () => Support
  /** The direction a cable leaves a port (world; null = it hangs straight down from the connector). Absent = every port hangs. */
  outwardFor?: (ref: PortRef) => P3 | null
}

/** One counter for every renderer: a revision is never reused, so two renderers (a place reload) can never share a cache key. */
let revisionSeq = 0

interface Drawn {
  mesh: Mesh
  path: P3[]
  /** The cable's own material (its colour); the hover highlight swaps it temporarily. */
  base: StandardMaterial
  /** '#RRGGBB' of the cable's colour. */
  hex: string
  cue: CueInfo
}

export class CableRenderer {
  private committed = new Map<string, Drawn>()
  private colored = new Map<string, StandardMaterial>()
  private hot = new Map<string, StandardMaterial>()
  private _highlighted: string | null = null
  private _revision = ++revisionSeq
  private drag: { mesh: Mesh; from: Vector3 } | null = null
  private mats!: Record<DragTint | 'committed', StandardMaterial>

  constructor(
    private scene: Scene,
    private budget = new CableBudget(),
    private opts: CableOptions = {},
  ) {
    const make = (name: string, hex: string, glow = 0.6) => {
      const m = new StandardMaterial(`cable:${name}`, scene)
      const c = Color3.FromHexString(hex)
      m.diffuseColor = c
      m.emissiveColor = c.scale(glow)
      return m
    }
    this.mats = {
      neutral: make('neutral', TOKENS.color.cableNeutral, 0.35),
      ok: make('ok', TOKENS.color.cableOk, 0.4),
      bad: make('bad', TOKENS.color.cableBad, 0.4),
      committed: make('committed', TOKENS.color.cable, 0.1),
    }
  }

  // ── drag lifecycle ─────────────────────────────────────────────────────────

  beginDrag(from: Vector3): void {
    this.endDrag()
    // Held cable is thicker so it reads in the wide Ensemble view; the radius is
    // baked here (updateDrag reuses this mesh via instance, keeping the radius).
    this.drag = {
      mesh: this.buildTube('cable:drag', from, from, SEGMENTS_FULL, TOKENS.focus.heldCableRadius),
      from: from.clone(),
    }
    this.drag.mesh.material = this.mats.neutral
  }

  updateDrag(to: Vector3, tint: DragTint): void {
    if (!this.drag) return
    // Same point count every frame → cheap in-place tube update. With a surface the cable in hand hangs from the pointer and lies on the surface.
    const support = this.supportNow()
    const path = (
      support
        ? hangInHand(this.drag.from, to, SEGMENTS_FULL + 1, support, this.clearance(TOKENS.focus.heldCableRadius))
        : catenaryPoints(this.drag.from, to, SEGMENTS_FULL, this.rest(TOKENS.focus.heldCableRadius))
    ).map(toVec)
    this.drag.mesh = MeshBuilder.CreateTube('cable:drag', { path, instance: this.drag.mesh })
    this.drag.mesh.material = this.mats[tint]
  }

  endDrag(): void {
    this.drag?.mesh.dispose()
    this.drag = null
  }

  // ── committed cables + signal-flow pulses ──────────────────────────────────

  private pulses = new Map<string, { mesh: Mesh; path: P3[]; phase: number }>()
  private pulseObserverOn = false
  private bag = new DisposableBag()

  /** Drop cables, pulses, the held cable, the pulse observer and the materials. Idempotent; legacy never calls it. */
  dispose(): void {
    if (this.bag.disposed) return
    this.clear()
    this.endDrag()
    this.bag.dispose()
    this.pulseObserverOn = false
    for (const m of Object.values(this.mats)) m.dispose()
    for (const m of [...this.colored.values(), ...this.hot.values()]) m.dispose()
    this.colored.clear()
    this.hot.clear()
    this._highlighted = null
    this.pulseMaterial?.dispose()
    this.pulseMaterial = undefined
    this.outlineMaterial?.dispose()
    this.outlineMaterial = undefined
  }
  private static readonly PULSE_PERIOD_MS = 2400
  private static readonly PULSE_CAP = 12 // perf guard: no pulse swarm on huge rigs

  /**
   * `ends` (Task 27) are the two ports the cable joins: `colorFor` / `dashFor` read them. Without them (every legacy
   * caller) the cable keeps the legacy committed colour and look.
   */
  addCable(connectionId: string, a: Vector3, b: Vector3, ends?: readonly [PortRef, PortRef], route?: readonly XZ[]): void {
    const wasHot = this._highlighted === connectionId
    this._revision = ++revisionSeq
    this.removeCable(connectionId)
    const { path, fits } = this.layOut(connectionId, a, b, ends, route)
    const color = ends && this.opts.colorFor ? this.opts.colorFor(ends[0], ends[1]) : null
    const name = `cable:${connectionId}`
    let mesh: Mesh
    let cue: CueInfo = { type: null, pieces: 0, fallback: false, outline: false }
    if (this.opts.cueFor || this.opts.outline) {
      const asked = ends && this.opts.cueFor ? this.opts.cueFor(ends[0], ends[1]) : null
      const built = this.buildCued(connectionId, path, asked ?? PLAIN_CUE, fits)
      mesh = built.mesh
      cue = { type: asked ? asked.type : null, pieces: built.pieces, fallback: !!asked && !fits, outline: built.outline }
    } else {
      const dashed = !!ends && this.opts.dashFor?.(ends[0], ends[1]) === true
      mesh = dashed ? this.buildDashed(name, path) : this.buildTubeFromPath(name, path)
    }
    const base = color ? this.colorMaterial(color) : this.mats.committed
    mesh.material = base
    this.committed.set(connectionId, { mesh, path, base, hex: color ? color.toHexString() : TOKENS.color.cable, cue })
    if (wasHot) this.setHighlighted(connectionId)
    this.addPulse(connectionId, path)
  }

  /** What a cable's cue was drawn as (pattern type, pieces, budget fallback, outline), or null for an unknown cable. */
  cueInfo(connectionId: string): CueInfo | null {
    const c = this.committed.get(connectionId)
    return c ? { ...c.cue } : null
  }

  /** The colour a cable was drawn in ('#RRGGBB'), or null for an unknown cable. */
  colorOf(connectionId: string): string | null {
    return this.committed.get(connectionId)?.hex ?? null
  }

  /** The drawn, enabled cables with their points (a hidden cable is not hoverable). */
  paths(): [string, readonly P3[]][] {
    const out: [string, readonly P3[]][] = []
    for (const [id, c] of this.committed) if (c.mesh.isEnabled()) out.push([id, c.path])
    return out
  }

  /** Changes whenever a cable is added, redrawn or removed (a cache key for what is drawn). */
  get revision(): number {
    return this._revision
  }

  /** The cable drawn lighter (the hover); null = none. */
  get highlighted(): string | null {
    return this._highlighted
  }

  /** Draw one cable lighter (null puts it back). An unknown id highlights nothing. */
  setHighlighted(connectionId: string | null): void {
    const prev = this._highlighted !== null ? this.committed.get(this._highlighted) : undefined
    if (prev) prev.mesh.material = prev.base
    const next = connectionId !== null ? this.committed.get(connectionId) : undefined
    this._highlighted = next ? connectionId : null
    if (next) next.mesh.material = this.hotMaterial(next.base)
  }

  private colorMaterial(color: Color3): StandardMaterial {
    const hex = color.toHexString()
    let m = this.colored.get(hex)
    if (!m) {
      m = new StandardMaterial(`cable:color:${hex}`, this.scene)
      m.diffuseColor = color
      m.emissiveColor = color.scale(COLOR_GLOW)
      this.colored.set(hex, m)
    }
    return m
  }

  /** The cable's colour pushed towards white and fully self-lit: it reads as the hovered one at any distance. */
  private hotMaterial(base: StandardMaterial): StandardMaterial {
    const key = base.diffuseColor.toHexString() + (base === this.mats.committed ? ':legacy' : '')
    let m = this.hot.get(key)
    if (!m) {
      m = new StandardMaterial(`cable:hot:${key}`, this.scene)
      const c = Color3.Lerp(base.diffuseColor, Color3.White(), 0.55)
      m.diffuseColor = c
      m.emissiveColor = c
      this.hot.set(key, m)
    }
    return m
  }

  /** Drop every committed cable + pulse (rig reload, ADR-0005). */
  clear(): void {
    for (const id of [...this.committed.keys()]) this.removeCable(id)
  }

  removeCable(connectionId: string): void {
    const drawn = this.committed.get(connectionId)
    if (!drawn) return
    drawn.mesh.dispose()
    this._revision = ++revisionSeq
    this.committed.delete(connectionId)
    if (this._highlighted === connectionId) this._highlighted = null
    this.budget.release(connectionId)
    const pulse = this.pulses.get(connectionId)
    if (pulse) {
      pulse.mesh.dispose()
      this.pulses.delete(connectionId)
    }
  }

  /** Live signal-flow pulses (they animate every frame; the render scheduler treats them as busy). */
  get pulseCount(): number {
    return this.pulses.size
  }

  /**
   * A small accent dot travelling out→in along the cable: the signal flow made
   * visible (pedagogical motion, VISION §6). Skipped entirely under
   * prefers-reduced-motion, beyond the pulse cap, and with `{ pulses: false }`.
   */
  private addPulse(connectionId: string, path: P3[]): void {
    if (this.opts.pulses === false || !motionEnabled() || this.pulses.size >= CableRenderer.PULSE_CAP) return
    const dot = MeshBuilder.CreateSphere(`pulse:${connectionId}`, { diameter: 0.024, segments: 8 }, this.scene)
    dot.material = this.pulseMat()
    dot.isPickable = false
    this.pulses.set(connectionId, { mesh: dot, path, phase: this.pulses.size * 0.17 })
    if (!this.pulseObserverOn) {
      this.pulseObserverOn = true
      this.bag.observe(this.scene.onBeforeRenderObservable, () => {
        const now = performance.now()
        for (const p of this.pulses.values()) {
          const t = (now / CableRenderer.PULSE_PERIOD_MS + p.phase) % 1
          const pos = pointAlong(p.path, t)
          p.mesh.position.set(pos.x, pos.y, pos.z)
        }
      })
    }
  }

  private pulseMaterial?: StandardMaterial
  private pulseMat(): StandardMaterial {
    if (!this.pulseMaterial) {
      this.pulseMaterial = new StandardMaterial('cable:pulse', this.scene)
      const c = Color3.FromHexString(TOKENS.color.accent)
      this.pulseMaterial.diffuseColor = c
      this.pulseMaterial.emissiveColor = c.scale(0.8)
    }
    return this.pulseMaterial
  }

  /** The surface the cables lie on, or null for the legacy sag (no floor given). */
  private supportNow(): Support | null {
    if (this.opts.support) return this.opts.support()
    return this.opts.floorAt ? buildSupport(this.opts.floorAt) : null
  }

  /** The cable's centre above the surface it rests on, for a cable of this radius (its radius plus the hair of FLOOR_CLEARANCE). */
  private clearance(radius = CABLE_RADIUS): number {
    return radius + (FLOOR_CLEARANCE - CABLE_RADIUS)
  }

  /**
   * The drawn path of a committed cable, booked against the point budget. Legacy (no surface): the parabola, a straight line once over budget.
   * Gravity: the full path while it fits, else its coarse shape (no bends, a 5 cm simplification, still on the surface): never a flying straight line.
   * A hand-drawn `route` (mission 3 B) is the plan its run follows: its corners rounded in the full path (every arc point counts against the budget),
   * sharp in the coarse one; never dropped.
   */
  private layOut(connectionId: string, a: Vector3, b: Vector3, ends?: readonly [PortRef, PortRef], route?: readonly XZ[]): { path: P3[]; fits: boolean } {
    const support = this.supportNow()
    if (!support) {
      const segments = this.budget.grant(connectionId)
      return { path: catenaryPoints(a, b, segments, this.rest()), fits: segments > 1 } // straight line once over budget
    }
    const out = (ref: PortRef | undefined): P3 | null => (ref && this.opts.outwardFor ? this.opts.outwardFor(ref) : null)
    const ea = { at: { x: a.x, y: a.y, z: a.z }, out: out(ends?.[0]) }
    const eb = { at: { x: b.x, y: b.y, z: b.z }, out: out(ends?.[1]) }
    const opts = { clearance: this.clearance(), ...(route?.length ? { route } : {}) }
    const fine = gravityPath(ea, eb, support, { ...opts, round: true })
    if (this.budget.fits(connectionId, fine.length)) {
      this.budget.take(connectionId, fine.length)
      return { path: fine, fits: true }
    }
    const coarse = gravityPath(ea, eb, support, { ...opts, arcs: false, tolM: 0.05 })
    this.budget.take(connectionId, coarse.length)
    return { path: coarse, fits: false }
  }

  private buildTube(name: string, a: Vector3, b: Vector3, segments: number, radius = CABLE_RADIUS): Mesh {
    return this.buildTubeFromPath(name, catenaryPoints(a, b, segments, this.rest(radius)), radius)
  }

  /** The surface the cables lie on (the host's floor), for a cable of this radius; undefined without a floor = the legacy sag. */
  private rest(radius = CABLE_RADIUS): FloorRest | undefined {
    const floorAt = this.opts.floorAt
    return floorAt ? { floorAt, clearance: radius + (FLOOR_CLEARANCE - CABLE_RADIUS) } : undefined
  }

  /**
   * A dashed cable: short tube pieces along the same path, merged into ONE mesh named like a plain cable (so the tree,
   * the framing and the hide switch find it the same way). The count is capped: a long run gets longer dashes.
   */
  private buildDashed(name: string, path: P3[]): Mesh {
    let length = 0
    for (let i = 1; i < path.length; i++) length += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y, path[i]!.z - path[i - 1]!.z)
    const n = Math.min(DASH_MAX, Math.max(DASH_MIN, Math.round(length / DASH_PERIOD_M)))
    const parts: Mesh[] = []
    for (let i = 0; i < n; i++) {
      const t0 = i / n
      const t1 = t0 + DASH_FILL / n
      const piece = [pointAlong(path, t0), pointAlong(path, (t0 + t1) / 2), pointAlong(path, t1)]
      parts.push(this.buildTubeFromPath(`${name}:dash${i}`, piece, CABLE_RADIUS, 6))
    }
    const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, false)
    if (!merged) {
      for (const p of parts) p.dispose()
      return this.buildTubeFromPath(name, path)
    }
    merged.name = name
    merged.isPickable = false
    return merged
  }

  private outlineMaterial?: StandardMaterial
  /** The underlay's one material: unlit, its colour exactly, front faces culled (an inverted hull). */
  private outlineMat(hex: string): StandardMaterial {
    if (!this.outlineMaterial) {
      const m = new StandardMaterial('cable:outline', this.scene)
      const c = Color3.FromHexString(hex)
      m.diffuseColor = c
      m.emissiveColor = c
      m.specularColor = Color3.Black()
      m.disableLighting = true
      m.backFaceCulling = true
      m.cullBackFaces = false // draw the back faces only: a rim around the cable, never over it
      this.outlineMaterial = m
    }
    return this.outlineMaterial
  }

  /**
   * A cable with its line cue (mission 3, cable cues): the solid tube (thickness of its type) or its dashes / beads, plus collars for mains, merged into ONE
   * mesh named like a plain cable; and, when an outline colour is given, the same pieces a hair wider merged into ONE child mesh `cable-outline:<id>`.
   * The drawn path is never changed: a tube thicker than the 12 mm the path was laid for is lifted by the difference so it rests on the surface, not in it.
   * Over the point budget (`fits` false) the pattern is dropped for the plain tube, outline kept: a cable is never dropped.
   */
  private buildCued(connectionId: string, path: P3[], cue: Cue3d, fits: boolean): { mesh: Mesh; pieces: number; outline: boolean } {
    const name = `cable:${connectionId}`
    const ring = this.opts.outline ? OUTLINE_M : 0
    const r = cue.radiusM
    // the widest piece (a bead or a collar) sets the lift: like a real ferrule, it holds the cable up off the surface by its own thickness
    const widest = r * Math.max(1, cue.markEveryM !== null ? MARK_SCALE : 1, cue.runs?.some((x, i) => i % 2 === 0 && x === 0) ? DOT_SCALE : 1)
    const lift = this.opts.floorAt || this.opts.support ? Math.max(0, widest + ring - (FLOOR_CLEARANCE - 0.0005)) : 0
    const run = lift ? path.map((q) => ({ x: q.x, y: q.y + lift, z: q.z })) : path
    const at = sampler(run)
    const layout = fits ? cueLayout(cue, at.length) : []
    const solid = !cue.runs || !fits
    const body: Mesh[] = []
    const rim: Mesh[] = []
    const piece = (from: P3[], radius: number, cap: boolean): void => {
      body.push(this.buildTubeFromPath(`${name}:part`, from, radius, cap ? 6 : 8, cap))
      if (ring) rim.push(this.buildTubeFromPath(`${name}:rim`, from, radius + ring, cap ? 6 : 8, cap))
    }
    if (solid) piece(run, r, false)
    for (const p of layout) {
      if (p.kind === 'dot') {
        const c = at.point(p.t0)
        const bead = (d: number, tag: string): Mesh => {
          const s = MeshBuilder.CreateSphere(`${name}:${tag}`, { diameter: d, segments: 4 }, this.scene)
          s.position.set(c.x, c.y, c.z)
          s.isPickable = false
          return s
        }
        body.push(bead(2 * r * DOT_SCALE, 'dot'))
        if (ring) rim.push(bead(2 * (r * DOT_SCALE + ring), 'dotrim'))
      } else piece(at.span(p.t0, p.t1), p.kind === 'mark' ? r * MARK_SCALE : r, true)
    }
    const mesh = merge(body, name)
    if (rim.length) {
      const outline = merge(rim, `cable-outline:${connectionId}`)
      outline.material = this.outlineMat(this.opts.outline!)
      outline.parent = mesh // hidden, disabled and disposed with its cable; never in paths(), never pickable
    }
    return { mesh, pieces: layout.length, outline: rim.length > 0 }
  }

  private buildTubeFromPath(name: string, path: P3[], radius = CABLE_RADIUS, tessellation = 8, cap = false): Mesh {
    const mesh = MeshBuilder.CreateTube(
      name,
      { path: path.map(toVec), radius, tessellation, updatable: true, ...(cap ? { cap: Mesh.CAP_ALL } : {}) },
      this.scene,
    )
    mesh.isPickable = false
    return mesh
  }
}

/** Merge the parts of one cable (or of its outline) into ONE unpickable mesh of this name: one draw call however many pieces. */
function merge(parts: Mesh[], name: string): Mesh {
  const merged = parts.length === 1 ? parts[0]! : Mesh.MergeMeshes(parts, true, true, undefined, false, false)
  if (!merged) throw new Error(`CableRenderer: could not merge ${name}`)
  merged.name = name
  merged.id = name
  merged.isPickable = false
  return merged
}

/** Points along a polyline by share of its length, and the sub-polyline between two shares (sampled every ~4 cm, at least its two ends and middle). */
function sampler(path: readonly P3[]): { length: number; point(t: number): P3; span(t0: number, t1: number): P3[] } {
  const cum = [0]
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1]! + Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y, path[i]!.z - path[i - 1]!.z))
  const length = cum[cum.length - 1] ?? 0
  const point = (t: number): P3 => {
    if (path.length < 2 || length === 0) return { ...(path[0] ?? { x: 0, y: 0, z: 0 }) }
    const d = Math.min(length, Math.max(0, t * length))
    let lo = 0
    let hi = cum.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (cum[mid]! <= d) lo = mid
      else hi = mid
    }
    const seg = cum[hi]! - cum[lo]!
    const u = seg > 0 ? (d - cum[lo]!) / seg : 0
    const a = path[lo]!
    const b = path[hi]!
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u }
  }
  const span = (t0: number, t1: number): P3[] => {
    const n = Math.min(8, Math.max(2, Math.ceil(((t1 - t0) * length) / 0.04)))
    return Array.from({ length: n + 1 }, (_, k) => point(t0 + ((t1 - t0) * k) / n))
  }
  return { length, point, span }
}
