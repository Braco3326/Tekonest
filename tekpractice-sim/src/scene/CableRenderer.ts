/**
 * CableRenderer — Path3D-style tube cables with catenary sag.
 * One transient DRAG cable (green/red/neutral from ConnectionGraph.canConnect's
 * verdict — the renderer never judges validity itself) and N committed cables.
 * Perf guard: CableBudget degrades committed cables to straight lines before
 * frames drop (CLAUDE.md).
 */
import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core'
import type { PortRef } from '../engine/types'
import { CableBudget, catenaryPoints, pointAlong, SEGMENTS_FULL, type P3 } from './cablePath'
import { motionEnabled, TOKENS } from '../design/tokens'
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

/** What a creation host adds (Task 27); without them the renderer is the legacy one. */
export interface CableOptions {
  pulses?: boolean
  /** The colour of a connection between two ports (the host reads the catalog's signal). Absent = the legacy committed colour. */
  colorFor?: (a: PortRef, b: PortRef) => Color3
  /** Draw this connection dashed (a second cue next to the colour). */
  dashFor?: (a: PortRef, b: PortRef) => boolean
}

interface Drawn {
  mesh: Mesh
  path: P3[]
  /** The cable's own material (its colour); the hover highlight swaps it temporarily. */
  base: StandardMaterial
  /** '#RRGGBB' of the cable's colour. */
  hex: string
}

export class CableRenderer {
  private committed = new Map<string, Drawn>()
  private colored = new Map<string, StandardMaterial>()
  private hot = new Map<string, StandardMaterial>()
  private _highlighted: string | null = null
  private _revision = 0
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
    // Same point count every frame → cheap in-place tube update.
    const path = catenaryPoints(this.drag.from, to, SEGMENTS_FULL).map(toVec)
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
  }
  private static readonly PULSE_PERIOD_MS = 2400
  private static readonly PULSE_CAP = 12 // perf guard: no pulse swarm on huge rigs

  /**
   * `ends` (Task 27) are the two ports the cable joins: `colorFor` / `dashFor` read them. Without them (every legacy
   * caller) the cable keeps the legacy committed colour and look.
   */
  addCable(connectionId: string, a: Vector3, b: Vector3, ends?: readonly [PortRef, PortRef]): void {
    const wasHot = this._highlighted === connectionId
    this._revision++
    this.removeCable(connectionId)
    const segments = this.budget.grant(connectionId) // straight line once over budget
    const path = catenaryPoints(a, b, segments)
    const color = ends && this.opts.colorFor ? this.opts.colorFor(ends[0], ends[1]) : null
    const dashed = !!ends && this.opts.dashFor?.(ends[0], ends[1]) === true
    const name = `cable:${connectionId}`
    const mesh = dashed ? this.buildDashed(name, path) : this.buildTubeFromPath(name, path)
    const base = color ? this.colorMaterial(color) : this.mats.committed
    mesh.material = base
    this.committed.set(connectionId, { mesh, path, base, hex: color ? color.toHexString() : TOKENS.color.cable })
    if (wasHot) this.setHighlighted(connectionId)
    this.addPulse(connectionId, path)
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
    this._revision++
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

  private buildTube(name: string, a: Vector3, b: Vector3, segments: number, radius = CABLE_RADIUS): Mesh {
    return this.buildTubeFromPath(name, catenaryPoints(a, b, segments), radius)
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

  private buildTubeFromPath(name: string, path: P3[], radius = CABLE_RADIUS, tessellation = 8): Mesh {
    const mesh = MeshBuilder.CreateTube(
      name,
      { path: path.map(toVec), radius, tessellation, updatable: true },
      this.scene,
    )
    mesh.isPickable = false
    return mesh
  }
}
