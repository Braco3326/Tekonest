/**
 * ExploreController — Babylon/DOM adapter for Explore view (ADR-0010).
 * Owns the walking UniversalCamera, feeds keyboard + mouse into the PURE input
 * layer (src/input) and movement maths (src/explore), applies the result to the
 * camera every frame, handles pointer lock, the crosshair, the Esc chain and the
 * Explore ⇄ Orbit toggle. Never touches the graph: interactions go through the
 * injected FocusPatch handles and UI callbacks.
 */
import { ArcRotateCamera, Scene, UniversalCamera, Vector3 } from '@babylonjs/core'
import { actionsForCode, chordFor } from '../input/bindings'
import { KeyboardState } from '../input/keyboardState'
import { MouseGesture } from '../input/mouseGesture'
import { buildIntent, MOUSE_LOOK_RAD_PER_PX } from '../explore/intent'
import { initialPlayer, stepPlayer, type PlayerState } from '../explore/movement'
import { resolveMove, type Box } from '../explore/collision'
import { resolveEsc } from '../explore/escChain'
import type { ExploreSettings } from '../ui/exploreSettings'
import { motionEnabled } from '../design/tokens'
import type { CameraRig } from './CameraRig'
import type { Walker } from './ViewDirector'
import type { PortRef } from '../engine/types'

export type BaseView = 'explore' | 'orbit'
const PLAYER_RADIUS = 0.3
const MIN_FOV = (20 * Math.PI) / 180

/** UI surface the controller drives (panels live in src/ui). */
export interface ExploreUi {
  panelCount(): number
  closeTopPanel(): void
  toggleInventory(): void
  toggleHelp(): void
  openPause(): void
  placing(): boolean
  cancelPlacement(): void
  rotatePlacement(): void
  /** Click while placing: drop the ghost at the aimed floor point. */
  confirmPlacement(): void
  pickUp(instanceId: string): void
  /** True while the settings panel waits for a key to remap (the controller must not react). */
  capturingKey(): boolean
}

/** The FocusPatch handles the controller needs (ADR-0008 stays the patch grammar). */
export interface FocusHandles {
  readonly view: { mode: 'ensemble' | 'focus'; focused: string | null; held: PortRef | null; selected: string | null }
  focusInstance(instanceId: string): void
  deviceAt(x: number, y: number): string | null
  /** CAMERA_HOME (Alt+H): back to the Ensemble pose (Task 4). */
  home(): void
}

export interface ExploreDeps {
  scene: Scene
  canvas: HTMLCanvasElement
  arc: ArcRotateCamera
  rig: CameraRig
  settings(): ExploreSettings
  obstacles(): readonly Box[]
  start: { x: number; z: number; yaw: number }
  initialView: BaseView
  crosshair: HTMLElement
  onViewChange?(view: BaseView): void
  /** Floor height under a point (procedural rooms: raised stage zones). Default: 0. */
  floorAt?(x: number, z: number): number
  /** CAMERA_PRESET_1..3 pressed (slot 0..2). Typing is already filtered; the host decides if the view allows it. */
  onPreset?(slot: number): void
}

const isTyping = (el: Element | null): boolean =>
  !!el &&
  (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable)

export class ExploreController implements Walker {
  readonly camera: UniversalCamera
  private player: PlayerState
  private keyboard: KeyboardState
  private gesture = new MouseGesture()
  private look = { dx: 0, dy: 0 }
  private stick = { x0: 0, y0: 0, dx: 0, dy: 0, on: false }
  private view: BaseView
  private suspended = false
  private unlockedAt = -Infinity
  /** Eased floor height under the player (steps onto stages smoothly). */
  private floorY = 0
  /** A crosshair click already acted on pointerdown: swallow the Babylon tap that follows (review #5). */
  private suppressTapUntil = 0
  /** Last input came from the keyboard: aim at the screen centre and show the crosshair (review #6). */
  private keyboardAim = false
  private focus!: FocusHandles
  private ui!: ExploreUi

  constructor(private deps: ExploreDeps) {
    const { scene } = deps
    this.player = initialPlayer(deps.start.x, deps.start.z, deps.start.yaw)
    this.floorY = deps.floorAt?.(deps.start.x, deps.start.z) ?? 0
    this.keyboard = new KeyboardState(deps.settings().bindings)
    this.camera = new UniversalCamera('explore', new Vector3(this.player.x, this.player.eye, this.player.z), scene)
    this.camera.inputs.clear() // WE drive it: no Babylon key/mouse inputs
    this.camera.minZ = 0.05
    this.camera.fov = (deps.settings().fovDeg * Math.PI) / 180
    this.applyCamera()
    this.view = deps.initialView

    scene.onBeforeRenderObservable.add(() => this.tick(scene.getEngine().getDeltaTime() / 1000))
    window.addEventListener('keydown', this.onKeyDown, true)
    window.addEventListener('keyup', this.onKeyUp, true)
    window.addEventListener('blur', this.onBlur)
    deps.canvas.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    deps.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    document.addEventListener('pointerlockchange', this.onLockChange)
  }

  /** Late wiring: FocusPatch and the UI are built after the controller (they need its flags). */
  connect(focus: FocusHandles, ui: ExploreUi): void {
    this.focus = focus
    this.ui = ui
    this.setView(this.view, false)
  }

  // ── Walker (ViewDirector) ───────────────────────────────────────────────────
  get exploreView(): boolean {
    return this.view === 'explore'
  }
  eyePosition(): Vector3 {
    return new Vector3(this.player.x, this.floorY + this.player.eye, this.player.z)
  }
  lookPoint(): Vector3 {
    const { yaw, pitch } = this.player
    const f = new Vector3(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
    return this.eyePosition().add(f.scale(3))
  }
  suspend(): void {
    this.suspended = true
    this.keyboard.reset()
    this.gesture.cancel()
    this.stick.on = false
    if (this.locked) document.exitPointerLock()
  }
  resume(): void {
    this.suspended = false
    this.deps.scene.activeCamera = this.camera
  }

  // ── public state (e2e, FocusPatch gates) ────────────────────────────────────
  get locked(): boolean {
    return document.pointerLockElement === this.deps.canvas
  }
  /** Explore view, walking camera live, no panel open. */
  get walking(): boolean {
    return this.view === 'explore' && !this.suspended && (this.ui?.panelCount() ?? 0) === 0
  }
  /** FocusPatch gate: Babylon taps are stale/foreign while locked, placing or a panel is up. */
  pointerFree(): boolean {
    return (
      !this.locked &&
      performance.now() >= this.suppressTapUntil &&
      !(this.ui?.placing() ?? false) &&
      (this.ui?.panelCount() ?? 0) === 0
    )
  }
  // (clickFocuses() retired: N1 makes a single click focus in every view, in focusMachine.)
  snapshot(): {
    view: BaseView
    camera: string | null
    position: { x: number; y: number; z: number }
    yaw: number
    pitch: number
    fovDeg: number
    locked: boolean
  } {
    return {
      view: this.view,
      camera: this.deps.scene.activeCamera?.name ?? null,
      position: { x: this.player.x, y: this.floorY + this.player.eye, z: this.player.z },
      yaw: this.player.yaw,
      pitch: this.player.pitch,
      fovDeg: (this.camera.fov * 180) / Math.PI,
      locked: this.locked,
    }
  }
  /** Screen point the player aims with: crosshair when locked, else the cursor. */
  aimPoint(): { x: number; y: number } {
    const eng = this.deps.scene.getEngine()
    return this.locked || (this.keyboardAim && this.view === 'explore')
      ? { x: eng.getRenderWidth() / 2, y: eng.getRenderHeight() / 2 }
      : { x: this.deps.scene.pointerX, y: this.deps.scene.pointerY }
  }

  private setKeyboardAim(on: boolean): void {
    this.keyboardAim = on
    this.deps.crosshair.hidden = !(this.locked || (on && this.walking))
  }
  settingsChanged(): void {
    const s = this.deps.settings()
    this.keyboard.setBindings(s.bindings)
    this.camera.fov = (s.fovDeg * Math.PI) / 180
  }

  // ── views ───────────────────────────────────────────────────────────────────
  toggleView(): void {
    if (this.focus.view.mode === 'focus') return // leave focus first (Esc / right-click)
    this.setView(this.view === 'explore' ? 'orbit' : 'explore', true)
  }

  private setView(v: BaseView, animate: boolean): void {
    this.view = v
    const { scene, arc, rig } = this.deps
    if (v === 'explore') {
      arc.detachControl()
      this.resume()
    } else {
      this.suspend()
      this.suspended = false // orbit is not "suspended", it just does not walk
      scene.activeCamera = arc
      arc.attachControl(true)
      if (animate) rig.flyToEnsemble()
    }
    this.deps.onViewChange?.(v)
  }

  // ── frame ───────────────────────────────────────────────────────────────────
  private tick(dt: number): void {
    if (!this.walking || this.deps.scene.activeCamera !== this.camera) {
      this.look.dx = this.look.dy = 0
      return
    }
    const s = this.deps.settings()
    const intent = buildIntent(
      (a) => this.keyboard.held(a),
      { lookDx: this.look.dx, lookDy: this.look.dy, stickDx: this.stick.on ? this.stick.dx : 0, stickDy: this.stick.on ? this.stick.dy : 0 },
      dt,
      s,
    )
    this.look.dx = this.look.dy = 0
    const next = stepPlayer(this.player, intent, dt, { speedMult: s.speedMult, reducedMotion: !motionEnabled() })
    const at = resolveMove({ x: this.player.x, z: this.player.z }, { x: next.x, z: next.z }, PLAYER_RADIUS, this.deps.obstacles())
    this.player = { ...next, x: at.x, z: at.z }
    const target = this.deps.floorAt?.(at.x, at.z) ?? 0
    this.floorY += (target - this.floorY) * Math.min(1, dt * 8)
    this.applyCamera()
  }

  private applyCamera(): void {
    this.camera.position.set(this.player.x, this.floorY + this.player.eye, this.player.z)
    this.camera.rotation.set(this.player.pitch, this.player.yaw, 0)
  }

  // ── keyboard ────────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.ui || this.ui.capturingKey()) return
    const actions = actionsForCode(this.deps.settings().bindings, e.code)
    if (actions.includes('CANCEL')) {
      this.handleEsc(e)
      return
    }
    const target = document.activeElement
    if (isTyping(target)) return // inventory search, rig name… never hijacked
    const onButton = target && target !== document.body && target.tagName !== 'CANVAS'
    if (onButton && (e.code === 'Space' || e.code === 'Enter')) return // the focused button owns it
    const chord = chordFor(e)
    if (chord !== e.code) {
      // A modifier chord (Alt+H = CAMERA_HOME): one-shot actions bound to the
      // chord only — never the plain key's action (plain H = help).
      const chordActions = actionsForCode(this.deps.settings().bindings, chord)
      if (chordActions.length === 0 || e.repeat) return
      e.preventDefault() // e.g. Firefox's Alt+H Help menu
      for (const a of chordActions) this.onPressed(a, e)
      return
    }
    if (actions.length === 0) return

    this.keyboard.keyDown(e.code)
    if (actions.some((a) => a.startsWith('MOVE') || a.startsWith('STRAFE') || a.startsWith('TURN') || a.startsWith('LOOK')))
      this.setKeyboardAim(true)
    for (const a of this.keyboard.consumePressed()) this.onPressed(a, e)
    if (this.walking && actions.some((a) => a.startsWith('MOVE') || a.startsWith('STRAFE') || a.startsWith('TURN') || a.startsWith('LOOK')))
      e.preventDefault() // arrows / PageUp must not scroll the page while walking
  }

  private onPressed(a: string, e: KeyboardEvent): void {
    switch (a) {
      case 'TOGGLE_INVENTORY':
        e.preventDefault()
        if (this.locked) document.exitPointerLock()
        this.ui.toggleInventory()
        break
      case 'TOGGLE_HELP':
        if (this.locked) document.exitPointerLock()
        this.ui.toggleHelp()
        break
      case 'TOGGLE_VIEW':
        this.toggleView()
        break
      case 'FOCUS': {
        if (this.ui.placing()) {
          this.ui.confirmPlacement() // keyboard confirm of the ghost (review #6)
          break
        }
        if (this.view !== 'explore' || this.focus.view.mode === 'focus') break
        const p = this.aimPoint()
        const id = this.focus.deviceAt(p.x, p.y)
        if (id) {
          if (this.locked) document.exitPointerLock()
          this.focus.focusInstance(id)
        }
        break
      }
      case 'PICK_UP': {
        const p = this.aimPoint()
        const id = this.focus.deviceAt(p.x, p.y) ?? this.focus.view.focused
        if (id) this.ui.pickUp(id)
        break
      }
      case 'ROTATE_PLACEMENT':
        if (this.ui.placing()) this.ui.rotatePlacement()
        break
      case 'CAMERA_HOME':
        // Orbit / focus: fly to the Ensemble pose. Walking: ViewDirector no-op.
        this.focus.home()
        break
      case 'CAMERA_PRESET_1':
      case 'CAMERA_PRESET_2':
      case 'CAMERA_PRESET_3':
        this.deps.onPreset?.(Number(a.slice(-1)) - 1)
        break
    }
  }

  private onKeyUp = (e: KeyboardEvent): void => this.keyboard.keyUp(e.code)

  private onBlur = (): void => {
    this.keyboard.reset()
    this.gesture.cancel()
    this.stick.on = false
  }

  private handleEsc(e: KeyboardEvent): void {
    const action = resolveEsc({
      pointerLocked: this.locked,
      msSinceUnlock: performance.now() - this.unlockedAt,
      placing: this.ui.placing(),
      openPanels: this.ui.panelCount(),
      holdingCable: this.focus.view.held !== null,
      focused: this.focus.view.mode === 'focus',
      view: this.view,
    })
    const consume = (): void => {
      e.stopPropagation()
      e.preventDefault()
    }
    switch (action) {
      case 'release-pointer':
        document.exitPointerLock()
        consume()
        break
      case 'ignore':
        consume()
        break
      case 'cancel-placement':
        this.ui.cancelPlacement()
        consume()
        break
      case 'close-panel':
        this.ui.closeTopPanel()
        consume()
        break
      case 'open-pause':
        this.ui.openPause()
        consume()
        break
      // drop-cable / leave-focus / none: FocusPatch (ADR-0008) handles it — let it through.
    }
  }

  // ── mouse ───────────────────────────────────────────────────────────────────
  private mouseActive(): boolean {
    return this.walking && this.deps.scene.activeCamera === this.camera
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.mouseActive()) return
    if (this.locked) {
      if (e.button === 0) this.lockedClick()
      return
    }
    this.gesture.down(e.button, e.clientX, e.clientY)
    if (e.button === 2) this.stick = { x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, on: false }
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.mouseActive()) return
    if (this.locked) {
      this.look.dx += e.movementX
      this.look.dy += e.movementY
      return
    }
    if (this.keyboardAim && (Math.abs(e.movementX) > 2 || Math.abs(e.movementY) > 2)) this.setKeyboardAim(false)
    const d = this.gesture.move(e.clientX, e.clientY)
    if (d.kind === 'look') {
      this.look.dx += d.dx
      this.look.dy += d.dy
    } else if (d.kind === 'move' || (this.stick.on && this.gesture.isDragging)) {
      this.stick.on = true
      this.stick.dx = e.clientX - this.stick.x0
      this.stick.dy = e.clientY - this.stick.y0
    }
  }

  private onPointerUp = (e: PointerEvent): void => {
    const result = this.gesture.up(e.clientX, e.clientY)
    this.stick.on = false
    if (result !== 'click' || e.button !== 0 || !this.mouseActive()) return
    if (this.ui.placing()) {
      this.ui.confirmPlacement()
      return
    }
    // A click on gear is FocusPatch's (Babylon tap). Empty space may capture the mouse.
    const rect = this.deps.canvas.getBoundingClientRect()
    if (this.somethingInteractiveAt(e.clientX - rect.left, e.clientY - rect.top)) return
    const pref = this.deps.settings().pointerLock
    if (pref === 'always' || (pref === 'auto' && this.keyboard.anyMovementUsed)) {
      void Promise.resolve(this.deps.canvas.requestPointerLock()).catch(() => undefined)
    }
  }

  private somethingInteractiveAt(x: number, y: number): boolean {
    const hit = this.deps.scene.pick(x, y, (m) => m.metadata?.isPortMarker === true || m.metadata?.isDeviceBody === true)
    return !!hit?.hit
  }

  private lockedClick(): void {
    if (this.ui.placing()) {
      this.ui.confirmPlacement()
      return
    }
    const p = this.aimPoint()
    const id = this.focus.deviceAt(p.x, p.y)
    if (!id) return
    this.suppressTapUntil = performance.now() + 400 // the release's Babylon tap carries stale coords
    document.exitPointerLock() // patching ports needs a visible cursor
    this.focus.focusInstance(id)
  }

  private onWheel = (e: WheelEvent): void => {
    if (!this.mouseActive()) return
    e.preventDefault()
    const maxFov = (this.deps.settings().fovDeg * Math.PI) / 180
    this.camera.fov = Math.min(maxFov, Math.max(MIN_FOV, this.camera.fov * (1 + e.deltaY * 0.001)))
  }

  private onLockChange = (): void => {
    if (!this.locked) this.unlockedAt = performance.now()
    this.setKeyboardAim(this.keyboardAim)
    this.look.dx = this.look.dy = 0
  }
}

export { MOUSE_LOOK_RAD_PER_PX }
