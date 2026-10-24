/**
 * FocusPatch — the "Focus & Patch" input adapter (ADR-0008, spec §1-§3).
 * Translates pointer/keyboard into focusMachine events and executes the
 * machine's commands: camera flights (CameraRig), the held-cable indicator
 * (CableRenderer), compatible-device glow, and CONNECT intent dispatch.
 *
 * Discipline (spec §5): validation is the injected canConnect dry-run,
 * mutation is the injected dispatch — this module never imports the graph.
 */
import {
  AbstractMesh,
  ArcRotateCamera,
  Color3,
  Mesh,
  Plane,
  PointerEventTypes,
  Scene,
  Vector3,
} from '@babylonjs/core'
import type { ConnectResult, PortRef } from '../engine/types'
import type { Intent } from '../ui/intents'
import type { DeviceInstance } from './DeviceSpawner'
import type { PortPoint } from './snap'
import type { CameraDirector, FrameTarget } from './CameraRig'
import type { CableRenderer } from './CableRenderer'
import { needsReframe } from '../camera/tween'

type Vec3 = [number, number, number]
import {
  initialState,
  reduce,
  repickup,
  type FocusCommand,
  type FocusState,
} from './focusMachine'
import { motionEnabled, TOKENS } from '../design/tokens'
import { confirmWindowMs, DeferredEmptyClick } from './deferredEmptyClick'

export interface FocusPatchDeps {
  /** Dry-run verdict — ConnectionGraph.canConnect, injected by the bootstrap. */
  canConnect(a: PortRef, b: PortRef): ConnectResult
  dispatch(intent: Intent): void
  /**
   * Teaching hints gate (spec §3): true in Learn/Levels, false in Exam,
   * toggleable in Sandbox. Gates device glow, port dim AND the green/red
   * tint of the held cable (a neutral cable still shows — it is state, not a hint).
   */
  hints(): boolean
  /** Hover candidate while a cable is held (drives the marker breathing). */
  onCandidate?(ref: PortRef | null): void
  /**
   * Floor double-click re-pivots the orbit (designer nav, Task 4). False while
   * the Explore view is the base view: walking has no pivot (ADR-0010 untouched).
   * Default: true.
   */
  floorPivot?(): boolean
  /**
   * False while pointer lock / a panel / placement owns the mouse: Babylon taps
   * then carry stale or foreign coordinates and must not reach the machine.
   */
  inputEnabled?(): boolean
  /** Mode / focused device changed (the Explore toolbar shows « Ramasser » in focus). */
  onViewChange?(): void
}

const same = (a: PortRef, b: PortRef) => a.instance === b.instance && a.port === b.port

export class FocusPatch {
  private state: FocusState = initialState()
  private glowing = new Set<AbstractMesh>()
  private dimmed = new Set<Mesh>()
  private hoverRef: PortRef | null = null
  private outlineColor = Color3.FromHexString(TOKENS.focus.glowOutline)

  constructor(
    private scene: Scene,
    private camera: ArcRotateCamera,
    private rig: CameraDirector,
    private cables: CableRenderer,
    private instances: readonly DeviceInstance[],
    private ports: readonly PortPoint[],
    private deps: FocusPatchDeps,
  ) {
    scene.onPointerObservable.add((info) => {
      if (this.deps.inputEnabled && !this.deps.inputEnabled()) return
      switch (info.type) {
        case PointerEventTypes.POINTERTAP:
          this.onTap((info.event as PointerEvent).button)
          break
        case PointerEventTypes.POINTERDOUBLETAP:
          this.onDoubleTap()
          break
        case PointerEventTypes.POINTERMOVE:
          this.onMove()
          break
      }
    })

    // Right-click must reach the machine, not the browser menu (spec §2).
    const canvas = scene.getEngine().getRenderingCanvas()
    canvas?.addEventListener('contextmenu', (e) => e.preventDefault())

    window.addEventListener('keydown', this.onKey)
  }

  /** e2e/debug view — mode, focused device, held cable end. */
  get view(): { mode: FocusState['mode']; focused: string | null; held: PortRef | null; selected: string | null } {
    return { mode: this.state.mode, focused: this.state.focused, held: this.state.held, selected: this.state.selected }
  }

  /** e2e/debug — how many meshes currently carry the hint glow (exam ⇒ 0). */
  get glowCount(): number {
    return this.glowing.size
  }

  /** Re-derive glow/dim after any graph change (occupancy moved). Called by refresh(). */
  refreshHints(): void {
    this.applyHints()
  }

  // ── input → machine events ──────────────────────────────────────────────────

  private onTap(button: number): void {
    // Any new tap supersedes a deferred empty click (it re-schedules below if empty again).
    this.emptyClick.cancel()
    if (button === 2) {
      this.apply(reduce(this.state, { type: 'RIGHT_CLICK' }))
      return
    }
    // N1: a click DURING the flight a click-focus started aims at a moving view
    // (often the 2nd half of a double-click that a busy frame split into two
    // taps). It confirms that focus — never a pick through the moving scene.
    // Reduced motion = no flight = no window.
    const first = this.clickFocus
    if (first && performance.now() - first.at < confirmWindowMs(TOKENS.focus.flyMs, motionEnabled())) {
      this.clickFocus = null
      this.apply(reduce(this.state, { type: 'DEVICE_DOUBLE_CLICK', instanceId: first.id }))
      return
    }
    const port = this.portUnderPointer()
    if (port) {
      const hadHeld = this.state.held !== null
      this.apply(reduce(this.state, { type: 'PORT_CLICK', ref: port }))
      if (!hadHeld && this.state.held) this.pickupAt = performance.now()
      return
    }
    const device = this.deviceUnderPointer()
    if (device) {
      // N1: a single click focuses in Orbit and Explore alike (the machine decides).
      const t = reduce(this.state, { type: 'DEVICE_CLICK', instanceId: device })
      if (t.commands.some((c) => c.kind === 'flyToDevice')) this.clickFocus = { id: device, at: performance.now() }
      this.apply(t)
      return
    }
    if (this.state.mode === 'focus') {
      // Leaving focus waits out the double-click window: if this click is the
      // first half of a floor double-click (re-pivot), the camera must not
      // start flying home first. Dropped if the view changes meanwhile.
      this.emptyClick.schedule()
      return
    }
    this.apply(reduce(this.state, { type: 'EMPTY_CLICK' }))
  }

  /** The deferred "empty click leaves focus" (see onTap, deferredEmptyClick.ts). */
  private emptyClick = new DeferredEmptyClick(
    Scene.DoubleClickDelay,
    () => this.state,
    () => this.apply(reduce(this.state, { type: 'EMPTY_CLICK' })),
  )

  /** Alt+H / « Vue d'ensemble » (Task 4): fly home, cable kept. */
  home(): void {
    this.emptyClick.cancel()
    this.apply(reduce(this.state, { type: 'HOME' }))
  }

  /** Focus a device programmatically (Explore: F key, crosshair click). Same path as a double-click. */
  focusInstance(instanceId: string): void {
    this.emptyClick.cancel()
    this.apply(reduce(this.state, { type: 'DEVICE_DOUBLE_CLICK', instanceId }))
  }

  /**
   * A device is about to disappear (pick-up): drop a cable held from it and
   * leave its focus first, through the same ESC transitions a learner uses.
   */
  releaseInstance(instanceId: string): void {
    this.emptyClick.cancel()
    if (this.state.held?.instance === instanceId) this.apply(reduce(this.state, { type: 'ESC' }))
    if (this.state.focused === instanceId) {
      if (this.state.held) this.apply(reduce(this.state, { type: 'ESC' }))
      this.apply(reduce(this.state, { type: 'ESC' }))
    }
    if (this.state.selected === instanceId) this.state = { ...this.state, selected: null }
  }

  /** Instance whose body is under the given screen point (Explore aim / pick-up). */
  deviceAt(x: number, y: number): string | null {
    return this.deviceUnder(x, y)
  }

  private pickupAt = 0

  /** The pair's FIRST click already focused this device (N1) — see onDoubleTap. */
  private clickFocus: { id: string; at: number } | null = null

  private onDoubleTap(): void {
    const leftFocusPending = this.emptyClick.cancel()
    // N1: the first click of a double-click already started the flight, so the
    // view under the cursor is MOVING — re-picking now could hit the stand, a
    // neighbour or the floor. The double-click confirms the device the first
    // click chose (and re-issues the flight its 2nd pointerdown cancelled).
    // Reduced motion = a cut, nothing moves = re-pick normally.
    const first = this.clickFocus
    this.clickFocus = null
    if (first && performance.now() - first.at < confirmWindowMs(600, motionEnabled())) {
      this.apply(reduce(this.state, { type: 'DEVICE_DOUBLE_CLICK', instanceId: first.id }))
      return
    }
    const port = this.portUnderPointer()
    if (port) {
      // A double-click landing on a port means "dive on this device" (on tiny
      // gear like a mic the pick-sphere covers the whole body, so focusing
      // would otherwise be impossible). Undo the accidental pickup made by the
      // pair's FIRST click, then focus the port's owner. A cable held from
      // before (older/different) survives — that is spec §1 step 5.
      if (
        this.state.held &&
        same(this.state.held, port) &&
        performance.now() - this.pickupAt < 600
      ) {
        this.apply(reduce(this.state, { type: 'PORT_CLICK', ref: port })) // held-end click = drop
      }
      this.apply(reduce(this.state, { type: 'DEVICE_DOUBLE_CLICK', instanceId: port.instance }))
      return
    }
    const device = this.deviceUnderPointer()
    if (device) {
      this.apply(reduce(this.state, { type: 'DEVICE_DOUBLE_CLICK', instanceId: device }))
      return
    }
    // Floor / room surface: orbit around that point (Task 4). Walking: no pivot.
    const point = this.deps.floorPivot?.() === false ? null : this.surfaceUnderPointer()
    if (point) {
      this.apply(reduce(this.state, { type: 'FLOOR_DOUBLE_CLICK', point }))
      return
    }
    // Nothing to pivot on: the deferred empty click still leaves focus.
    if (leftFocusPending) this.apply(reduce(this.state, { type: 'EMPTY_CLICK' }))
  }

  private onKey = (e: KeyboardEvent): void => {
    // Never hijack keys while the learner is inside HUD controls (a11y).
    const active = document.activeElement
    const inHud = active && active !== document.body && active.tagName !== 'CANVAS'
    switch (e.key) {
      case 'Escape':
        this.emptyClick.cancel()
        this.apply(reduce(this.state, { type: 'ESC' }))
        break
      case 'Tab':
        if (inHud) return
        e.preventDefault()
        this.apply(reduce(this.state, { type: 'TAB', instanceIds: this.instances.map((i) => i.instanceId) }))
        break
      case 'Enter':
        if (inHud) return
        this.apply(reduce(this.state, { type: 'ENTER' }))
        break
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        if (inHud || this.state.mode !== 'focus') return
        e.preventDefault()
        // Keyboard orbit (spec §2) — same camera the mouse drags, small steps.
        if (e.key === 'ArrowLeft') this.camera.alpha -= 0.09
        if (e.key === 'ArrowRight') this.camera.alpha += 0.09
        if (e.key === 'ArrowUp') this.camera.beta = Math.max(0.15, this.camera.beta - 0.06)
        if (e.key === 'ArrowDown') this.camera.beta = Math.min(Math.PI / 2 + 0.3, this.camera.beta + 0.06)
        break
      }
    }
  }

  private onMove(): void {
    if (!this.state.held) return
    const from = this.portPoint(this.state.held)
    if (!from) return

    const hover = this.portUnderPointer()
    const hoverKey = hover ? `${hover.instance} ${hover.port}` : ''
    const prevKey = this.hoverRef ? `${this.hoverRef.instance} ${this.hoverRef.port}` : ''
    if (hoverKey !== prevKey) {
      this.hoverRef = hover
      this.deps.onCandidate?.(hover)
    }

    if (hover && !same(hover, this.state.held)) {
      const target = this.portPoint(hover)
      if (target) {
        const verdict = this.deps.canConnect(this.state.held, hover).ok
        this.cables.updateDrag(
          new Vector3(target.x, target.y, target.z),
          this.deps.hints() ? (verdict ? 'ok' : 'bad') : 'neutral',
        )
        return
      }
    }
    // Free end follows the pointer on a camera-facing plane at the port's depth.
    const origin = new Vector3(from.x, from.y, from.z)
    const plane = Plane.FromPositionAndNormal(origin, this.camera.getForwardRay().direction.negate())
    const ray = this.scene.createPickingRay(this.scene.pointerX, this.scene.pointerY, null, this.camera)
    const dist = ray.intersectsPlane(plane)
    if (dist !== null) this.cables.updateDrag(ray.origin.add(ray.direction.scale(dist)), 'neutral')
  }

  // ── machine commands → effects ──────────────────────────────────────────────

  private apply(t: { state: FocusState; commands: FocusCommand[] }): void {
    const before = `${this.state.mode}|${this.state.focused}`
    this.state = t.state
    // Out of focus, a pending "click-focus confirm" has nothing left to confirm.
    if (this.state.mode !== 'focus') this.clickFocus = null
    for (const cmd of t.commands) this.exec(cmd)
    this.applyHints()
    if (`${this.state.mode}|${this.state.focused}` !== before) this.deps.onViewChange?.()
  }

  /** Back out of focus the way Esc does: drop a held cable first, then leave (placement from focus). */
  leaveFocus(): void {
    this.emptyClick.cancel()
    if (this.state.mode !== 'focus') return
    if (this.state.held) this.apply(reduce(this.state, { type: 'ESC' }))
    this.apply(reduce(this.state, { type: 'ESC' }))
  }

  private exec(cmd: FocusCommand): void {
    switch (cmd.kind) {
      case 'flyToDevice': {
        const inst = this.instances.find((i) => i.instanceId === cmd.instanceId)
        if (!inst) return
        const frame = focusFrame(inst)
        const flewAt = performance.now()
        this.rig.flyToDevice(frame)
        // The .glb may land after the flight started (placeholder box → model):
        // re-centre the pivot on the real bounds, only if it moved ≥ 2 cm.
        void inst.modelReady.then(() => {
          if (this.state.mode !== 'focus' || this.state.focused !== inst.instanceId) return
          const next = focusFrame(inst)
          if (!needsReframe(frame.center.asArray() as Vec3, next.center.asArray() as Vec3)) return
          // Mid-flight: finish the SAME framing on the corrected centre; after it:
          // move the target only (the learner may have orbited since).
          if (performance.now() - flewAt < TOKENS.focus.flyMs + 50) this.rig.flyToDevice(next)
          else this.rig.repivot(next.center, next.boundingRadius)
        })
        break
      }
      case 'flyToEnsemble':
        this.rig.flyToEnsemble()
        break
      case 'repivot':
        this.rig.repivot(Vector3.FromArray(cmd.point))
        break
      case 'pickup': {
        const p = this.portPoint(cmd.from)
        if (p) this.cables.beginDrag(new Vector3(p.x, p.y, p.z))
        break
      }
      case 'dropHeld':
        this.cables.endDrag()
        this.deps.onCandidate?.(null)
        this.hoverRef = null
        break
      case 'connect': {
        const accepted = this.deps.canConnect(cmd.a, cmd.b).ok
        this.cables.endDrag()
        this.deps.onCandidate?.(null)
        this.hoverRef = null
        // The intent ALWAYS goes out — a rejection toasts the teaching text
        // (that rejection IS the R1-R3 lesson). On reject, the cable returns
        // to the hand so the learner retries without re-clicking the source.
        this.deps.dispatch({ type: 'CONNECT', a: cmd.a, b: cmd.b })
        if (!accepted) this.apply(repickup(this.state, cmd.a))
        break
      }
    }
  }

  // ── teaching hints (spec §3, mode-gated) ────────────────────────────────────

  /**
   * Ensemble + held cable → devices with a FREE compatible port glow.
   * Focus + held cable → compatible port markers glow, incompatible dim.
   * hints() false (Exam / sandbox toggle) → nothing glows, ever.
   */
  private applyHints(): void {
    this.clearHints()
    if (!this.state.held || !this.deps.hints()) return
    const held = this.state.held

    if (this.state.mode === 'ensemble') {
      for (const inst of this.instances) {
        if (inst.instanceId === held.instance) continue
        const compatible = this.ports.some(
          (p) => p.ref.instance === inst.instanceId && this.deps.canConnect(held, p.ref).ok,
        )
        if (!compatible) continue
        for (const mesh of this.bodyMeshes(inst)) {
          // Outline + translucent overlay wash: the outline alone is sub-pixel
          // at Ensemble distance; the overlay reads from across the stage.
          mesh.renderOutline = true
          mesh.outlineColor = this.outlineColor
          mesh.outlineWidth = TOKENS.focus.glowOutlineWidth
          mesh.renderOverlay = true
          mesh.overlayColor = this.outlineColor
          mesh.overlayAlpha = TOKENS.focus.glowOverlayAlpha
          this.glowing.add(mesh)
        }
        // The label card is a billboard with constant screen presence — tinting
        // it makes the "this device accepts your cable" signal readable even on
        // tiny far-away devices (a 20px mic body cannot carry the glow alone).
        const label = this.scene.getMeshByName(`label:${inst.instanceId}`)
        if (label) {
          label.renderOverlay = true
          label.overlayColor = this.outlineColor
          label.overlayAlpha = TOKENS.focus.glowOverlayAlpha
          this.glowing.add(label)
        }
      }
      return
    }

    // Focus: judge the framed device's ports (and the held end stays neutral).
    const focused = this.instances.find((i) => i.instanceId === this.state.focused)
    if (!focused) return
    for (const [portId, marker] of focused.portMarkers) {
      const ref = { instance: focused.instanceId, port: portId }
      if (same(ref, held)) continue
      if (this.deps.canConnect(held, ref).ok) {
        marker.renderOutline = true
        marker.outlineColor = this.outlineColor
        marker.outlineWidth = TOKENS.focus.glowOutlineWidth / 2
        this.glowing.add(marker)
      } else {
        marker.visibility = TOKENS.focus.dimVisibility
        this.dimmed.add(marker)
      }
    }
  }

  private clearHints(): void {
    for (const mesh of this.glowing) {
      mesh.renderOutline = false
      mesh.renderOverlay = false
    }
    for (const mesh of this.dimmed) mesh.visibility = 1
    this.glowing.clear()
    this.dimmed.clear()
  }

  // ── picking helpers ─────────────────────────────────────────────────────────

  private portPoint(ref: PortRef): PortPoint | undefined {
    return this.ports.find((p) => same(p.ref, ref))
  }

  /** multiPick + closest-center-to-ray (dense grids pick the aimed port, not a neighbour). */
  private portUnderPointer(): PortRef | null {
    const hits = this.scene.multiPick(
      this.scene.pointerX,
      this.scene.pointerY,
      (m: AbstractMesh) => m.metadata?.isPortMarker === true,
    )
    if (!hits?.length) return null
    const ray = this.scene.createPickingRay(this.scene.pointerX, this.scene.pointerY, null, this.camera)
    let best: PortRef | null = null
    let bestD = Infinity
    for (const hit of hits) {
      const mesh = hit.pickedMesh
      if (!mesh) continue
      const d = ray.direction.cross(mesh.getAbsolutePosition().subtract(ray.origin)).length()
      if (d < bestD) {
        bestD = d
        best = mesh.metadata.portRef as PortRef
      }
    }
    return best
  }

  /**
   * multiPick + closest-INSTANCE-center-to-ray: with a small device sitting on
   * a big prop (SM58 on its K&M stand), single pick() returns whichever mesh is
   * nearest the camera — often the prop. Aiming is judged per instance center,
   * exactly like the dense-port disambiguation.
   */
  private deviceUnderPointer(): string | null {
    return this.deviceUnder(this.scene.pointerX, this.scene.pointerY)
  }

  private deviceUnder(px: number, py: number): string | null {
    const hits = this.scene.multiPick(px, py, (m: AbstractMesh) => m.metadata?.isDeviceBody === true)
    if (!hits?.length) return null
    const ray = this.scene.createPickingRay(px, py, null, this.scene.activeCamera)
    let best: string | null = null
    let bestD = Infinity
    for (const instanceId of new Set(
      hits.map((h) => h.pickedMesh?.metadata?.instanceId as string | undefined),
    )) {
      if (!instanceId) continue
      const inst = this.instances.find((i) => i.instanceId === instanceId)
      if (!inst) continue
      const center = bodyCenter(inst)
      if (!center) continue
      const d = ray.direction.cross(center.subtract(ray.origin)).length()
      if (d < bestD) {
        bestD = d
        best = instanceId
      }
    }
    return best
  }

  /**
   * World point on the floor / room surface under the pointer (Task 4 re-pivot).
   * Devices, ports, labels, cables never count: only meshes flagged
   * `pivotSurface` (white ground, room floor and zones, env set) or any other
   * pickable non-device mesh. Default picks ignore those surfaces (isPickable
   * false), so the predicate checks enabled/visible itself.
   */
  private surfaceUnderPointer(): [number, number, number] | null {
    const hit = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (m: AbstractMesh) => {
      const md = m.metadata as { isDeviceBody?: boolean; isPortMarker?: boolean; pivotSurface?: boolean } | null
      if (!m.isEnabled() || !m.isVisible || md?.isDeviceBody || md?.isPortMarker) return false
      return md?.pivotSurface === true || m.isPickable
    })
    const p = hit?.hit ? hit.pickedPoint : null
    return p ? [p.x, p.y, p.z] : null
  }

  private bodyMeshes(inst: DeviceInstance): AbstractMesh[] {
    return inst.root
      .getChildMeshes(false)
      .filter((m) => m.metadata?.isDeviceBody === true)
  }
}

/**
 * World bounds of a device's enabled BODY meshes only (`isDeviceBody`): shadow
 * blob, label billboards and port pick-spheres pollute hierarchy bounds (a mic
 * on a stand would otherwise "center" halfway down the pole). null = no body.
 * The one loop shared by bodyCenter and focusFrame (N9).
 */
export function bodyBounds(inst: DeviceInstance): { min: Vector3; max: Vector3 } | null {
  let min: Vector3 | null = null
  let max: Vector3 | null = null
  for (const m of inst.root.getChildMeshes(false)) {
    if (m.metadata?.isDeviceBody !== true || !m.isEnabled()) continue
    m.computeWorldMatrix(true)
    const bb = m.getBoundingInfo().boundingBox
    min = min ? Vector3.Minimize(min, bb.minimumWorld) : bb.minimumWorld.clone()
    max = max ? Vector3.Maximize(max, bb.maximumWorld) : bb.maximumWorld.clone()
  }
  return min && max ? { min, max } : null
}

/**
 * The focus pivot (N9): centre and half-diagonal of the device BODY bounds.
 * Falls back to the whole hierarchy only when the device has no body mesh.
 */
export function focusFrame(inst: DeviceInstance): FrameTarget {
  const { min, max } = bodyBounds(inst) ?? inst.root.getHierarchyBoundingVectors()
  return { center: min.add(max).scale(0.5), boundingRadius: max.subtract(min).length() / 2 }
}

/** World centre of the device body (deviceScreen aims here). */
export function bodyCenter(inst: DeviceInstance): Vector3 | null {
  const b = bodyBounds(inst)
  return b ? b.min.add(b.max).scale(0.5) : null
}
