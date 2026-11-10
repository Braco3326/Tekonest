/**
 * controls/controlRig: the moving parts of one device instance. Built from a layout and the model's real size: a fader cap that
 * slides in its slot, a knob that turns, a button that sinks and lights, a switch lever that tilts, an LED, an LED bar, a VU needle.
 * Each part is a small procedural mesh parented to the device root at the control's real place on its face, so it follows the
 * device when it is moved or turned. The rig draws what the ControlBank says (values) and what a meter bus says (levels); the
 * pointer controller (creation/controlController.ts) writes the bank. Hit pads (invisible, pickable) carry the control's identity.
 */
import {
  Color3,
  DynamicTexture,
  Matrix,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Mesh,
  type Scene,
} from '@babylonjs/core'
import { ControlBank } from './controlBank'
import type { ControlDef } from './controlTypes'
import type { ControlHit } from './controlHit'
import { faceFrame } from './faceFrame'
import { BarBallistics, VuBallistics, barLit, demoLevelDb } from './meters'

const MM = 0.001
/** A part rests this far above its face so it never z-fights with the model. */
const LIFT = 0.0006
/** Smallest hit pad, metres: a 6 mm cap is still easy to grab. */
const MIN_PAD = 0.016

/** Where a fader's cap slides, in world space (the controller maps a pointer ray onto it). */
export interface SlideGeometry {
  origin: Vector3
  dir: Vector3
  length: number
  normal: Vector3
}

interface Part {
  def: ControlDef
  node: TransformNode
  /** The part that moves or turns with the value. */
  mover: TransformNode
  pad: Mesh | null
  /** Re-draw for the current value. */
  apply(v: number): void
  /** Hover tint on / off. */
  hover(on: boolean): void
  meterStep?(levelDb: number, nowMs: number, dtMs: number): void
  /** True for a fader: its cap slides along the control axis (slideOf gives the geometry). */
  slides?: boolean
}

export type LevelSource = (bus: string, tSec: number) => number

export class ControlRig {
  private readonly parts = new Map<string, Part>()
  private readonly materials = new Map<string, StandardMaterial>()
  private unsub: (() => void) | null = null
  private lastMeterMs = 0
  private hovered: string | null = null
  /** The bus level source; the demo signal until the console software feeds real ones. */
  levels: LevelSource = demoLevelDb
  /** Whether the meters move at all (a device that is off does not). */
  metersLive = true

  constructor(
    private readonly scene: Scene,
    private readonly root: TransformNode,
    readonly instanceId: string,
    readonly bank: ControlBank,
    private readonly sizeMm: { w: number; h: number; d: number },
    /** A sloped top (console wedge): parts on the 'top' face sit on it. */
    private readonly topProfile?: readonly [number, number][]
  ) {
    for (const def of bank.all()) {
      const part = this.build(def)
      if (part) {
        this.parts.set(def.id, part)
        part.apply(bank.get(def.id))
      }
    }
    this.unsub = bank.subscribe((id, v) => this.parts.get(id)?.apply(v))
  }

  get size(): number {
    return this.parts.size
  }

  /** Whether any meter is in the layout (the ticker only runs for these). */
  get hasMeters(): boolean {
    return [...this.parts.values()].some((p) => p.meterStep)
  }

  part(id: string): Part | undefined {
    return this.parts.get(id)
  }

  /** The hit pads, for a pick. */
  pads(): Mesh[] {
    return [...this.parts.values()].flatMap((p) => (p.pad ? [p.pad] : []))
  }

  setHover(id: string | null): void {
    if (id === this.hovered) return
    if (this.hovered) this.parts.get(this.hovered)?.hover(false)
    this.hovered = id
    if (id) this.parts.get(id)?.hover(true)
  }

  /** World geometry of a fader's slide (null for any other control). */
  slideOf(id: string): SlideGeometry | null {
    const p = this.parts.get(id)
    if (!p || !p.slides || !p.def.travelMm) return null
    p.node.computeWorldMatrix(true)
    const m = p.node.getWorldMatrix()
    const axisLocal = p.def.axis === 'x' ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1)
    const dir = Vector3.TransformNormal(axisLocal, m)
    const scale = dir.length() || 1
    return {
      origin: p.node.getAbsolutePosition().clone(),
      dir: dir.scale(1 / scale),
      length: p.def.travelMm * MM * scale,
      normal: Vector3.TransformNormal(new Vector3(0, 1, 0), m).normalize(),
    }
  }

  /** Advance every meter to `nowMs` (call from the ticker). Returns whether anything was redrawn. */
  update(nowMs: number): boolean {
    if (!this.metersLive) return false
    const dt = this.lastMeterMs ? Math.min(100, nowMs - this.lastMeterMs) : 16
    this.lastMeterMs = nowMs
    let any = false
    for (const p of this.parts.values()) {
      if (!p.meterStep || !p.def.meter) continue
      p.meterStep(this.levels(p.def.meter.source, nowMs / 1000), nowMs, dt)
      any = true
    }
    return any
  }

  dispose(): void {
    this.unsub?.()
    this.unsub = null
    for (const p of this.parts.values()) p.node.dispose(false, true)
    this.parts.clear()
    for (const m of this.materials.values()) m.dispose()
    this.materials.clear()
  }

  // ── building ───────────────────────────────────────────────────────────────────────────────────────────────

  private mat(name: string, hex: string, glow = 0): StandardMaterial {
    const key = `${name}:${hex}:${glow}`
    let m = this.materials.get(key)
    if (!m) {
      m = new StandardMaterial(`ctlmat:${this.instanceId}:${key}`, this.scene)
      const c = Color3.FromHexString(hex)
      m.diffuseColor = c
      m.specularColor = new Color3(0.25, 0.25, 0.25)
      m.specularPower = 48
      if (glow > 0) m.emissiveColor = c.scale(glow)
      this.materials.set(key, m)
    }
    return m
  }

  private box(name: string, parent: TransformNode, w: number, h: number, d: number, mat: StandardMaterial): Mesh {
    const b = MeshBuilder.CreateBox(`ctl:${this.instanceId}:${name}`, { width: w, height: h, depth: d }, this.scene)
    b.parent = parent
    b.material = mat
    b.isPickable = false
    return b
  }

  private pad(def: ControlDef, parent: TransformNode, w: number, h: number, d: number): Mesh {
    const pad = MeshBuilder.CreateBox(`ctlpad:${this.instanceId}:${def.id}`, { width: Math.max(MIN_PAD, w), height: Math.max(0.012, h), depth: Math.max(MIN_PAD, d) }, this.scene)
    pad.parent = parent
    pad.visibility = 0
    pad.isPickable = true
    const hit: ControlHit = { isControl: true, instanceId: this.instanceId, controlId: def.id }
    pad.metadata = hit
    return pad
  }

  private build(def: ControlDef): Part | null {
    const f = faceFrame(def.face, def.xMm, def.yMm, this.sizeMm, this.topProfile)
    const node = new TransformNode(`ctl:${this.instanceId}:${def.id}`, this.scene)
    node.parent = this.root
    node.position = new Vector3(f.pos[0], f.pos[1], f.pos[2])
    const right = new Vector3(...f.right)
    const out = new Vector3(...f.out)
    const z = Vector3.Cross(right, out)
    const m = new Matrix()
    Matrix.FromXYZAxesToRef(right, out, z, m)
    node.rotationQuaternion = Quaternion.FromRotationMatrix(m)
    const sx = def.sizeMm.w * MM
    const sy = def.sizeMm.d * MM
    const sz = def.sizeMm.h * MM
    switch (def.kind) {
      case 'fader':
        return this.buildFader(def, node, sx, sy, sz)
      case 'knob':
        return this.buildKnob(def, node, sx, sy)
      case 'button':
        return this.buildButton(def, node, sx, sy, sz)
      case 'switch':
        return this.buildSwitch(def, node, sx, sy, sz)
      case 'led':
        return this.buildLed(def, node, sx, sy, sz)
      case 'meter':
        return def.meter?.style === 'vu' ? this.buildVu(def, node, sx, sy, sz) : this.buildBar(def, node, sx, sz)
    }
  }

  private buildFader(def: ControlDef, node: TransformNode, sx: number, sy: number, sz: number): Part {
    const travel = (def.travelMm ?? 100) * MM
    const alongX = def.axis === 'x'
    if (def.slot) {
      const len = def.slotMm ? def.slotMm.len * MM : travel + (alongX ? sx : sz) + 0.004
      const across = def.slotMm ? def.slotMm.w * MM : (alongX ? sz : sx) + 0.004
      const plate = this.box('slot', node, alongX ? len : across, 0.0004, alongX ? across : len, this.mat('slot', '#16181b'))
      plate.position = alongX ? new Vector3(travel / 2, 0.0002 + LIFT / 2, 0) : new Vector3(0, 0.0002 + LIFT / 2, travel / 2)
      const groove = this.box('groove', node, alongX ? len - 0.012 : 0.0026, 0.0005, alongX ? 0.0026 : len - 0.012, this.mat('groove', '#050607'))
      groove.position = alongX ? new Vector3(travel / 2, 0.0004 + LIFT / 2, 0) : new Vector3(0, 0.0004 + LIFT / 2, travel / 2)
    }
    const mover = new TransformNode(`ctl:${this.instanceId}:${def.id}:cap`, this.scene)
    mover.parent = node
    const capMat = this.mat('cap', def.colour ?? '#2c2e33')
    const hoverMat = this.mat('cap-hover', def.colour ?? '#2c2e33', 0.55)
    const cap = this.box('cap', mover, sx, sy, sz, capMat)
    cap.position.y = sy / 2 + LIFT + 0.0006
    const stripe = this.box('stripe', mover, alongX ? 0.0012 : sx * 0.9, 0.0006, alongX ? sz * 0.9 : 0.0012, this.mat('stripe', '#e9e9e4'))
    stripe.position.y = sy + LIFT + 0.0006 + 0.0003
    const pad = this.pad(def, mover, sx * 1.5, sy * 2 + 0.01, sz * 1.5)
    pad.position.y = sy / 2
    return {
      def,
      node,
      mover,
      pad,
      slides: true,
      apply: (v) => {
        const p = v * travel
        mover.position = alongX ? new Vector3(p, 0, 0) : new Vector3(0, 0, p)
      },
      hover: (on) => (cap.material = on ? hoverMat : capMat),
    }
  }

  private buildKnob(def: ControlDef, node: TransformNode, sx: number, sy: number): Part {
    const mover = new TransformNode(`ctl:${this.instanceId}:${def.id}:knob`, this.scene)
    mover.parent = node
    const bodyMat = this.mat('knob', def.colour ?? '#26282c')
    const hoverMat = this.mat('knob-hover', def.colour ?? '#26282c', 0.55)
    const body = MeshBuilder.CreateCylinder(`ctl:${this.instanceId}:${def.id}:body`, { diameter: sx, height: sy, tessellation: 28 }, this.scene)
    body.parent = mover
    body.material = bodyMat
    body.isPickable = false
    body.position.y = sy / 2 + LIFT
    const tick = this.box('pointer', mover, 0.0018, 0.0008, sx * 0.4, this.mat('pointer', '#f1efe6', 0.25))
    tick.position = new Vector3(0, sy + LIFT + 0.0004, sx * 0.27)
    const pad = this.pad(def, mover, sx, sy * 2 + 0.008, sx)
    pad.position.y = sy / 2
    const sweep = ((def.sweepDeg ?? 270) * Math.PI) / 180
    return {
      def,
      node,
      mover,
      pad,
      apply: (v) => (mover.rotation.y = (v - 0.5) * sweep),
      hover: (on) => (body.material = on ? hoverMat : bodyMat),
    }
  }

  private buildButton(def: ControlDef, node: TransformNode, sx: number, sy: number, sz: number): Part {
    const mover = new TransformNode(`ctl:${this.instanceId}:${def.id}:btn`, this.scene)
    mover.parent = node
    const base = def.colour ?? '#3a3d42'
    const lit = def.lit ?? '#ffb347'
    const offMat = def.label ? this.keyMaterial(def.label, def.colour ?? '#e8e8e4', '#202226', 0) : this.mat('btn-off', base)
    const onMat = def.label ? this.keyMaterial(def.label, def.lit ?? '#e8453c', '#ffffff', 0.55) : this.mat('btn-on', lit, 0.8)
    const hoverMat = this.mat('btn-hover', base, 0.4)
    const cap = this.box('cap', mover, sx, sy, sz, offMat)
    cap.position.y = sy / 2 + LIFT
    const depth = (def.travelMm ?? 1.5) * MM
    const pad = this.pad(def, mover, sx * 1.3, sy * 2 + 0.008, sz * 1.3)
    pad.position.y = sy / 2
    let on = false
    let hov = false
    const paint = (): void => {
      cap.material = on ? onMat : hov ? hoverMat : offMat
    }
    return {
      def,
      node,
      mover,
      pad,
      apply: (v) => {
        on = v >= 0.5
        mover.position.y = on ? -depth : 0
        paint()
      },
      hover: (h) => {
        hov = h
        paint()
      },
    }
  }

  private buildSwitch(def: ControlDef, node: TransformNode, sx: number, sy: number, sz: number): Part {
    const n = def.positions ?? 2
    const plate = this.box('plate', node, sx * 1.4, 0.0012, sz * 1.4, this.mat('sw-plate', '#1b1d20'))
    plate.position.y = 0.0006 + LIFT
    const mover = new TransformNode(`ctl:${this.instanceId}:${def.id}:lever`, this.scene)
    mover.parent = node
    mover.position.y = LIFT + 0.0012
    const leverMat = this.mat('sw-lever', def.colour ?? '#c7cad0')
    const hoverMat = this.mat('sw-hover', def.colour ?? '#c7cad0', 0.5)
    const lever = this.box('lever', mover, sx * 0.55, sy, sx * 0.55, leverMat)
    lever.position.y = sy / 2
    const pad = this.pad(def, mover, sx * 1.4, sy * 2 + 0.008, sz * 1.4)
    pad.position.y = sy / 2
    return {
      def,
      node,
      mover,
      pad,
      apply: (v) => {
        const frac = n > 1 ? v / (n - 1) : 0
        mover.rotation.x = (frac - 0.5) * 2 * 0.52
      },
      hover: (on) => (lever.material = on ? hoverMat : leverMat),
    }
  }

  private buildLed(def: ControlDef, node: TransformNode, sx: number, sy: number, sz: number): Part {
    const lit = def.lit ?? '#4be36d'
    const offMat = this.mat('led-off', this.dim(lit, 0.22))
    const onMat = this.mat('led-on', lit, 1)
    const led = this.box('led', node, sx, Math.max(sy, 0.0008), sz, offMat)
    led.position.y = Math.max(sy, 0.0008) / 2 + LIFT
    const mover = node
    return { def, node, mover, pad: null, apply: (v) => (led.material = v >= 0.5 ? onMat : offMat), hover: () => undefined }
  }

  /** A key cap top with its legend printed on it (a canvas); a plain colour when no 2D canvas exists. */
  private keyMaterial(label: string, bg: string, fg: string, glow: number): StandardMaterial {
    const key = `key:${label}:${bg}:${fg}:${glow}`
    const hit = this.materials.get(key)
    if (hit) return hit
    const m = new StandardMaterial(`ctlmat:${this.instanceId}:${key}`, this.scene)
    m.specularColor = new Color3(0.2, 0.2, 0.2)
    m.diffuseColor = Color3.FromHexString(bg)
    if (glow > 0) m.emissiveColor = Color3.FromHexString(bg).scale(glow)
    try {
      const S = 128
      const tex = new DynamicTexture(`ctltex:${this.instanceId}:${key}`, { width: S, height: S }, this.scene, false)
      const ctx = tex.getContext() as CanvasRenderingContext2D
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, S, S)
      ctx.fillStyle = fg
      ctx.font = `bold ${Math.round(S * (label.length > 3 ? 0.26 : 0.38))}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, S / 2, S / 2)
      tex.update()
      m.diffuseTexture = tex
      m.diffuseColor = glow > 0 ? new Color3(1, 1, 1) : new Color3(0.95, 0.95, 0.95)
      if (glow > 0) m.emissiveTexture = tex
    } catch {
      /* headless: the plain colour stays */
    }
    this.materials.set(key, m)
    return m
  }

  private dim(hex: string, k: number): string {
    const c = Color3.FromHexString(hex).scale(k)
    return c.toHexString()
  }

  private buildBar(def: ControlDef, node: TransformNode, sx: number, sz: number): Part {
    const meter = def.meter!
    const n = meter.segments ?? 12
    const alongX = def.axis === 'x'
    const span = alongX ? sx : sz
    const pitch = span / n
    const gap = pitch * 0.18
    const fromDb = meter.fromDb ?? -48
    const toDb = meter.toDb ?? 0
    const colourAt = (i: number): string => (i >= n - Math.max(1, Math.round(n * 0.12)) ? '#ff3b30' : i >= n - Math.max(2, Math.round(n * 0.32)) ? '#ffb020' : '#2fe06a')
    const segs: { mesh: Mesh; on: StandardMaterial; off: StandardMaterial }[] = []
    for (let i = 0; i < n; i++) {
      const c = colourAt(i)
      const off = this.mat(`bar-off-${c}`, this.dim(c, 0.18))
      const on = this.mat(`bar-on-${c}`, c, 1)
      const len = pitch - gap
      const mesh = this.box(`${def.id}:seg${i}`, node, alongX ? len : sx, 0.0008, alongX ? sz : len, off)
      const at = i * pitch + pitch / 2
      mesh.position = alongX ? new Vector3(at - span / 2, 0.0004 + LIFT, 0) : new Vector3(0, 0.0004 + LIFT, at - span / 2)
      segs.push({ mesh, on, off })
    }
    const ball = new BarBallistics()
    let litCount = -1
    let peakIdx = -2
    const draw = (lit: number, peak: number): void => {
      if (lit === litCount && peak === peakIdx) return
      litCount = lit
      peakIdx = peak
      segs.forEach((s, i) => (s.mesh.material = i < lit || i === peak ? s.on : s.off))
    }
    return {
      def,
      node,
      mover: node,
      pad: null,
      apply: () => undefined,
      hover: () => undefined,
      meterStep: (db, now, dt) => {
        ball.step(db, now, dt)
        const r = barLit(ball.level, ball.peak, n, fromDb, toDb)
        draw(r.lit, r.peak)
      },
    }
  }

  private buildVu(def: ControlDef, node: TransformNode, sx: number, sy: number, sz: number): Part {
    const meter = def.meter!
    const face = this.box('vu', node, sx, Math.max(sy, 0.002), sz, this.dialMaterial(def.id, sx, sz))
    face.position.y = Math.max(sy, 0.002) / 2 + LIFT
    const mover = new TransformNode(`ctl:${this.instanceId}:${def.id}:needle`, this.scene)
    mover.parent = node
    mover.position = new Vector3(0, Math.max(sy, 0.002) + LIFT + 0.0004, -sz * 0.36)
    const len = sz * 0.78
    const needle = this.box('needle', mover, 0.0009, 0.0005, len, this.mat('needle', '#111111'))
    needle.position.z = len / 2
    const ball = new VuBallistics(meter.referenceDb ?? -18)
    const sweep = (100 * Math.PI) / 180
    const set = (pos: number): void => {
      mover.rotation.y = (pos - 0.5) * sweep
    }
    set(0)
    return {
      def,
      node,
      mover,
      pad: null,
      apply: () => undefined,
      hover: () => undefined,
      meterStep: (db, _now, dt) => set(ball.step(db, dt)),
    }
  }

  /** A cream dial with the arc scale of a VU meter (-20 … +3, red above 0), drawn on a canvas; a plain cream plate if no canvas exists. */
  private dialMaterial(id: string, sx: number, sz: number): StandardMaterial {
    const key = `dial:${Math.round(sx * 1e4)}x${Math.round(sz * 1e4)}`
    const hit = this.materials.get(key)
    if (hit) return hit
    const m = new StandardMaterial(`ctlmat:${this.instanceId}:${key}:${id}`, this.scene)
    m.specularColor = Color3.Black()
    m.diffuseColor = Color3.FromHexString('#efe6c8')
    m.emissiveColor = Color3.FromHexString('#efe6c8').scale(0.35)
    try {
      const W = 256
      const H = Math.max(64, Math.round((W * sz) / sx))
      const tex = new DynamicTexture(`ctltex:${this.instanceId}:${id}`, { width: W, height: H }, this.scene, false)
      drawVuDial(tex.getContext() as CanvasRenderingContext2D, W, H)
      tex.update()
      m.diffuseTexture = tex
      m.diffuseColor = Color3.White()
    } catch {
      /* no 2D canvas (headless): the plain cream plate stays */
    }
    this.materials.set(key, m)
    return m
  }
}

/** Draws a VU dial: arc scale from the lower middle, ticks from -20 to +3 VU with 0 at 70.7 % of the sweep, the red zone above 0. */
export function drawVuDial(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  ctx.fillStyle = '#efe6c8'
  ctx.fillRect(0, 0, W, H)
  const cx = W / 2
  const cy = H * 1.12
  const r = H * 0.86
  const sweep = (100 * Math.PI) / 180
  const angle = (pos: number): number => -Math.PI / 2 + (pos - 0.5) * sweep
  ctx.lineCap = 'butt'
  // red zone
  ctx.strokeStyle = '#c4271c'
  ctx.lineWidth = H * 0.05
  ctx.beginPath()
  ctx.arc(cx, cy, r, angle(0.7079), angle(1))
  ctx.stroke()
  ctx.strokeStyle = '#1b1b1b'
  ctx.lineWidth = H * 0.018
  ctx.beginPath()
  ctx.arc(cx, cy, r, angle(0), angle(0.7079))
  ctx.stroke()
  const marks: [number, string][] = [[-20, '20'], [-10, '10'], [-7, '7'], [-5, '5'], [-3, '3'], [0, '0'], [1, '1'], [2, '2'], [3, '3']]
  ctx.fillStyle = '#1b1b1b'
  ctx.font = `${Math.round(H * 0.16)}px sans-serif`
  ctx.textAlign = 'center'
  for (const [vu, text] of marks) {
    const pos = Math.min(1, 10 ** (vu / 20) * 0.7079)
    const a = angle(pos)
    const x0 = cx + Math.cos(a) * (r - H * 0.07)
    const y0 = cy + Math.sin(a) * (r - H * 0.07)
    const x1 = cx + Math.cos(a) * (r + H * 0.02)
    const y1 = cy + Math.sin(a) * (r + H * 0.02)
    ctx.strokeStyle = vu > 0 ? '#c4271c' : '#1b1b1b'
    ctx.lineWidth = H * 0.016
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
    ctx.fillStyle = vu > 0 ? '#c4271c' : '#1b1b1b'
    ctx.fillText(text, cx + Math.cos(a) * (r - H * 0.18), cy + Math.sin(a) * (r - H * 0.18) + H * 0.05)
  }
  ctx.fillStyle = '#1b1b1b'
  ctx.font = `bold ${Math.round(H * 0.2)}px sans-serif`
  ctx.fillText('VU', cx, H * 0.7)
}
