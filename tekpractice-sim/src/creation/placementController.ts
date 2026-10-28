/**
 * Placement controller (Task 24, CA-10, P20, C5): put a device in the scene and move it.
 *
 * - `startPlacement(deviceId)`: a half-transparent ghost follows the pointer on the floor (0.25 m
 *   grid, Alt = free); R / Maj+R turn it (`rotateGhost`, Alt = 1°) and the drop uses that yaw;
 *   a click drops it (`SPAWN`, one history entry); Échap cancels.
 * - A left-drag that STARTS on the already-selected device moves it: `history.begin`, a `SET_POSE`
 *   per snapped step (the history coalesces them), `commit` on release = ONE undo entry; Échap
 *   during the drag rolls it back and records nothing. Any other left-drag is the camera's orbit.
 *
 * Intents only: the controller never touches the graph. No `onBeforeRender` observer and no timer:
 * it works on pointer events (which already ask the scheduler for a frame) and holds the `drag`
 * lease only while a drag lasts, so an idle page renders nothing.
 */
import type { Scene } from '@babylonjs/core'
import type { DesignState } from '../trials/trial'
import type { DisposableBag } from '../util/disposable'
import { floorPointAt } from '../scene/pivotPick'
import { COPY } from './copy'
import type { History } from './history'
import { clampToRoom, rotateStep, snapPosition, type RoomBounds } from './placementMath'
import type { RenderScheduler } from './renderScheduler'
import { isClick, pickDevice } from './selection'
import type { CreationStore } from './store'
import type { ViewState } from './viewState'

type V3 = [number, number, number]

/** What the controller needs of the SceneHost (structural: SceneHost satisfies it, tests fake it). */
export interface PlacementHost {
  readonly canvasElement: HTMLElement
  readonly scene: Scene | null
  readonly camera: { readonly target: { x: number; y: number; z: number } } | null
  readonly walking: boolean
  /** Called when the host took the ghost down by itself (a place change); the controller ends the placement. */
  onGhostLost: (() => void) | null
  showGhost(deviceId: string, at: V3, yawDeg: number): boolean
  moveGhost(at: V3, yawDeg: number): void
  hideGhost(): void
  roomBounds(): RoomBounds
  floorHeight(x: number, z: number, fallback: number): number
}

export interface PlacementOptions {
  /** The device name for history labels and the status line. */
  deviceLabel?(deviceId: string): string
  /** A line for the status bar (announced). */
  announce?(message: string): void
  /** The undo key's label (« Ctrl+Z »). */
  undoLabel?(): string
  /** A device was dropped: the shell selects it (no camera flight). */
  onPlaced?(instanceId: string): void
  /** A press-and-release on the selected device without a drag: the shell's usual click (select and frame). */
  onClickSelected?(instanceId: string): void
  /** Snapping while placing / dragging: false = grid, true = free (Alt), null = nothing is being placed or dragged. */
  onSnap?(free: boolean | null): void
  /** Called just before a drag opens its transaction (the shell closes a stepper burst still open). */
  beforeDrag?(): void
  /** The floor point under a canvas point (default: the shared `floorPointAt` pick). */
  floorPoint?(x: number, y: number): V3 | null
  /** The device under a canvas point (default: the shell's `pickDevice`). */
  deviceAt?(x: number, y: number): string | null
}

/** A press that travels less than this many px is a click, not a drag (as `isClick`). */
const DRAG_PX = 5

interface Drag {
  pointerId: number
  instanceId: string
  name: string
  /** Where the press happened (canvas px) and when. */
  x: number
  y: number
  t: number
  /** The device centre minus the floor point grabbed: the device does not jump to the cursor. */
  grab: [number, number]
  yawDeg: number
  tiltDeg: number
  /** Past the click threshold: the device follows the pointer. */
  armed: boolean
  /** At least one SET_POSE was applied. */
  moved: boolean
  /** The pose last sent, to skip a move that snaps to the same place. */
  last: V3 | null
  release: () => void
}

export class PlacementController {
  private deviceId: string | null = null
  private yawDeg = 0
  private at: V3 | null = null
  /** The primary press made while placing (a click drops, a drag orbits). */
  private press: { x: number; y: number; t: number } | null = null
  private drag: Drag | null = null
  private snap: boolean | null = null

  constructor(
    private readonly host: PlacementHost,
    private readonly history: History,
    private readonly store: CreationStore,
    private readonly viewState: ViewState,
    private readonly scheduler: RenderScheduler,
    bag: DisposableBag,
    private readonly opts: PlacementOptions = {}
  ) {
    const canvas = host.canvasElement
    // Capture: a drag that starts on the selected device must reach nobody else (the camera's
    // orbit input, the click-to-select), so this runs before them.
    bag.listen(canvas, 'pointerdown', (e: PointerEvent) => this.onDown(e), { capture: true })
    bag.listen(canvas, 'pointermove', (e: PointerEvent) => this.onMove(e))
    bag.listen(canvas, 'pointerup', (e: PointerEvent) => this.onUp(e))
    bag.listen(canvas, 'pointercancel', (e: PointerEvent) => this.onPointerCancel(e))
    // A release that never came as a pointerup (capture lost, window blurred): treated as the release it is.
    bag.listen(canvas, 'lostpointercapture', (e: PointerEvent) => {
      if (this.drag && e.pointerId === this.drag.pointerId) this.endDrag(false)
    })
    if (typeof window !== 'undefined') bag.listen(window, 'blur', () => this.endDrag(false))
    host.onGhostLost = () => this.onHostLostGhost()
    bag.add(() => {
      host.onGhostLost = null
      this.endDrag(true)
      this.endPlacement()
    })
  }

  /** A device is following the pointer (a pure read: the host tells us when a place change took its ghost). */
  get placing(): boolean {
    return this.deviceId !== null
  }

  /** A selected device is being dragged. */
  get dragging(): boolean {
    return this.drag !== null
  }

  startPlacement(deviceId: string): void {
    if (this.drag) return
    this.yawDeg = 0 // each placement starts square; R turns it (rotateGhost)
    const seed = this.seedPoint()
    if (!seed || !this.host.showGhost(deviceId, seed, this.yawDeg)) {
      this.opts.announce?.(this.refused(deviceId))
      return
    }
    this.deviceId = deviceId
    this.at = seed
    this.press = null
    this.setSnap(false)
    this.opts.announce?.(COPY.placement!.statusPlacing!.replace('{device}', this.name(deviceId)))
  }

  /**
   * R / Shift+R while a device follows the pointer (Alt = 1° instead of 15°): the ghost turns and the
   * drop uses that yaw. Not a history entry (nothing is placed yet). False when nothing is being placed.
   */
  rotateGhost(dir: 1 | -1, free: boolean): boolean {
    if (!this.placing || !this.at) return false
    this.yawDeg = rotateStep(this.yawDeg, dir, free)
    this.host.moveGhost(this.at, this.yawDeg)
    this.scheduler.invalidate()
    this.opts.announce?.(COPY.edit!.statusGhostYaw!.replace('{deg}', String(this.yawDeg)))
    return true
  }

  /** Échap: the drag is rolled back, else the placement is dropped. False when there was neither. */
  cancel(): boolean {
    if (this.drag) {
      const name = this.drag.name
      this.endDrag(true)
      this.opts.announce?.(COPY.placement!.statusMoveCancelled!.replace('{device}', name))
      return true
    }
    if (this.placing) {
      this.endPlacement()
      this.opts.announce?.(COPY.placement!.statusCancelled!)
      return true
    }
    return false
  }

  /** Entrée while placing: drop where the ghost is (the keyboard path). False when not placing. */
  confirm(): boolean {
    if (!this.placing || !this.at) return false
    this.drop(this.at)
    return true
  }

  // ── pointer events ──────────────────────────────────────────────────────────

  private onDown(e: PointerEvent): void {
    if (e.button !== 0 || !e.isPrimary || e.pointerType === 'touch') return
    if (e.shiftKey || e.ctrlKey || e.metaKey) return // pan gestures stay the camera's
    if (this.placing) {
      this.press = { x: e.offsetX, y: e.offsetY, t: e.timeStamp }
      return
    }
    if (this.drag || this.host.walking) return
    const d = this.dragCandidate(e)
    if (!d) return
    // Ours from here: not the orbit, not the click-to-select.
    e.stopImmediatePropagation()
    e.preventDefault()
    this.drag = d
    this.opts.beforeDrag?.()
    this.history.begin(COPY.placement!.entryMove!.replace('{device}', d.name))
    const lease = this.scheduler.hold('drag')
    const canvas = this.host.canvasElement
    try {
      canvas.setPointerCapture?.(e.pointerId)
    } catch {
      // a pointer already gone: the drag just ends with the next event
    }
    d.release = () => {
      lease()
      try {
        canvas.releasePointerCapture?.(e.pointerId)
      } catch {
        // already released
      }
    }
    canvas.focus?.()
    this.setSnap(e.altKey)
  }

  /** The drag a press would start: on the selected, floor-mounted device. Null = the camera takes the press. */
  private dragCandidate(e: PointerEvent): Drag | null {
    const sel = this.viewState.get().selection
    if (sel === null) return null
    const design: DesignState = this.store.design()
    const pl = design.placements.find((p) => p.instanceId === sel)
    const inst = design.rig.instances.find((i) => i.instanceId === sel)
    if (!pl || !inst || (pl.mount ?? 'floor') !== 'floor') return null
    if (this.deviceAtPoint(e.offsetX, e.offsetY) !== sel) return null
    const hit = this.floorPointAtPx(e.offsetX, e.offsetY)
    return {
      pointerId: e.pointerId,
      instanceId: sel,
      name: this.name(inst.deviceId),
      x: e.offsetX,
      y: e.offsetY,
      t: e.timeStamp,
      grab: hit ? [pl.position_m[0] - hit[0], pl.position_m[2] - hit[2]] : [0, 0],
      yawDeg: pl.yawDeg,
      tiltDeg: pl.tiltDeg ?? 0,
      armed: false,
      moved: false,
      last: [pl.position_m[0], pl.position_m[1], pl.position_m[2]],
      release: () => {},
    }
  }

  private onMove(e: PointerEvent): void {
    const d = this.drag
    if (d) {
      if (e.pointerId !== d.pointerId) return
      if (e.buttons === 0) return this.endDrag(false) // the pointerup never came: a release
      this.setSnap(e.altKey)
      if (!d.armed && Math.hypot(e.offsetX - d.x, e.offsetY - d.y) <= DRAG_PX) return
      d.armed = true
      const hit = this.floorPointAtPx(e.offsetX, e.offsetY)
      if (!hit) return
      const to = this.target([hit[0] + d.grab[0], hit[1], hit[2] + d.grab[1]], e.altKey)
      if (d.last && d.last[0] === to[0] && d.last[1] === to[1] && d.last[2] === to[2]) return
      const r = this.history.do({
        type: 'SET_POSE',
        instanceId: d.instanceId,
        position: to,
        yawDeg: d.yawDeg,
        tiltDeg: d.tiltDeg,
        mount: 'floor',
      })
      if (r.ok) {
        d.last = to
        d.moved = true
      }
      return
    }
    if (!this.placing || e.pointerType === 'touch') return
    this.setSnap(e.altKey)
    const hit = this.floorPointAtPx(e.offsetX, e.offsetY)
    if (!hit) return
    this.at = this.target(hit, e.altKey)
    this.host.moveGhost(this.at, this.yawDeg)
    this.scheduler.invalidate()
  }

  private onUp(e: PointerEvent): void {
    const d = this.drag
    if (d) {
      if (e.pointerId !== d.pointerId) return
      const click = !d.armed && isClick({ x: d.x, y: d.y, t: d.t }, { x: e.offsetX, y: e.offsetY, t: e.timeStamp })
      this.endDrag(false)
      if (click) this.opts.onClickSelected?.(d.instanceId)
      else if (d.moved)
        this.opts.announce?.(
          COPY.placement!.statusMoved!
            .replace('{device}', d.name)
            .replace('{undo}', this.opts.undoLabel?.() ?? 'Ctrl+Z')
        )
      return
    }
    const press = this.press
    this.press = null
    if (!press || e.button !== 0 || !this.placing) return
    if (!isClick(press, { x: e.offsetX, y: e.offsetY, t: e.timeStamp })) return // an orbit, not a drop
    const hit = this.floorPointAtPx(e.offsetX, e.offsetY)
    if (!hit) return
    this.drop(this.target(hit, e.altKey))
  }

  /** A place change took the ghost down: the placement is over, said in the status bar. */
  private onHostLostGhost(): void {
    if (this.deviceId === null) return
    this.endPlacement()
    // After the store change that caused the place change has had its own status line (« Prêt »): that line must not hide this one.
    queueMicrotask(() => this.opts.announce?.(COPY.placement!.statusCancelled!))
  }

  private onPointerCancel(e: PointerEvent): void {
    if (this.drag && e.pointerId === this.drag.pointerId) this.endDrag(true)
    this.press = null
  }

  // ── internals ───────────────────────────────────────────────────────────────

  private drop(at: V3): void {
    const deviceId = this.deviceId
    if (deviceId === null) return
    const name = this.name(deviceId)
    const instanceId = this.store.newInstanceId(deviceId)
    this.endPlacement()
    const r = this.history.do(
      { type: 'SPAWN', deviceId, instanceId, position: at, rotationY: this.yawDeg, mount: 'floor' },
      COPY.inventory!.entry!.replace('{device}', name)
    )
    if (!r.ok) {
      this.opts.announce?.(this.refused(deviceId))
      return
    }
    this.opts.onPlaced?.(instanceId)
    this.opts.announce?.(
      COPY.placement!.statusPlaced!
        .replace('{device}', name)
        .replace('{undo}', this.opts.undoLabel?.() ?? 'Ctrl+Z')
    )
  }

  private endPlacement(): void {
    if (this.deviceId === null) return
    this.deviceId = null
    this.at = null
    this.press = null
    this.host.hideGhost()
    this.setSnap(null)
    this.scheduler.invalidate()
  }

  /** Close the drag: `rollback` (Échap, pointer cancel, teardown) restores the pose, else `commit`. */
  private endDrag(rollback: boolean): void {
    const d = this.drag
    if (!d) return
    this.drag = null
    if (rollback) this.history.rollback()
    else this.history.commit()
    d.release()
    this.setSnap(null)
    this.scheduler.invalidate()
  }

  private setSnap(free: boolean | null): void {
    if (this.snap === free) return
    this.snap = free
    this.opts.onSnap?.(free)
  }

  /** Where a floor point lands: grid (Alt = free), inside the room, on the floor's own height. */
  private target(hit: V3, free: boolean): V3 {
    const snapped = snapPosition(hit, free)
    // Margin 0: keep the device inside the room, but never push it off the cursor near a wall.
    const [x, , z] = clampToRoom(snapped, this.host.roomBounds(), 0)
    return [x, this.host.floorHeight(x, z, hit[1]), z]
  }

  /** The first ghost position: the floor under the middle of the view, else the camera's pivot on the floor. */
  private seedPoint(): V3 | null {
    const canvas = this.host.canvasElement
    const hit = this.floorPointAtPx(canvas.clientWidth / 2, canvas.clientHeight / 2)
    const cam = this.host.camera
    const raw: V3 | null = hit ?? (cam ? [cam.target.x, 0, cam.target.z] : null)
    return raw ? this.target(raw, false) : null
  }

  private floorPointAtPx(x: number, y: number): V3 | null {
    if (this.opts.floorPoint) return this.opts.floorPoint(x, y)
    const scene = this.host.scene
    const cam = scene?.activeCamera
    return scene && cam ? floorPointAt(scene, x, y, cam) : null
  }

  private deviceAtPoint(x: number, y: number): string | null {
    return this.opts.deviceAt ? this.opts.deviceAt(x, y) : pickDevice(this.host.scene, x, y)
  }

  private name(deviceId: string): string {
    return this.opts.deviceLabel?.(deviceId) ?? deviceId
  }

  private refused(deviceId: string): string {
    return COPY.placement!.statusRefused!.replace('{device}', this.name(deviceId))
  }
}
