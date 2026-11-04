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
import { releaseAction } from './dragDrop'
import { clampToRoom, isFree, rotateStep, snapPosition, type RoomBounds } from './placementMath'
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
  /**
   * A press-and-release on the selected device without a drag: the shell's usual click (select and frame).
   * (x, y) is the release point (canvas px): a click on a port of that device is the cabling's (Task 26).
   */
  onClickSelected?(instanceId: string, x: number, y: number): void
  /** Snapping while placing / dragging: false = grid, true = free (Alt), null = nothing is being placed or dragged. */
  onSnap?(free: boolean | null): void
  /** A device started or stopped following the pointer (the « Annuler la pose » button follows this; Task 43b). */
  onPlacing?(placing: boolean): void
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
  /** The placement was started by a drag out of the inventory: the drawer's window-level pointer events steer it (Task 43b). */
  private pointerDrag = false
  /** The G latch (Task 43b): free placement without Alt. Lives for one pose or one drag, reset when it ends. */
  private latched = false
  /** Alt as the last pointer event or key saw it (the latch toggle needs it to say what the snapping is now). */
  private altHeld = false

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
    if (typeof window !== 'undefined') {
      bag.listen(window, 'blur', () => {
        this.altHeld = false // an Alt released in another window never sends its keyup here
        this.endDrag(false)
      })
      // Alt is the « free » modifier while a device is placed or dragged: a bare Alt tap would also toggle the menu bar in
      // Firefox on Windows. Claiming its keyup (only then) keeps the menu bar shut; any other time Alt is the browser's.
      bag.listen(window, 'keydown', (e: KeyboardEvent) => void (this.altHeld = e.altKey))
      bag.listen(window, 'keyup', (e: KeyboardEvent) => {
        this.altHeld = e.altKey
        if ((e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight') && (this.placing || this.dragging)) e.preventDefault()
      })
    }
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

  /** `pointerDrag`: the pose was started by dragging an item out of the inventory (the drawer then calls dragGhostTo / endPointerDrag). */
  startPlacement(deviceId: string, opts: { pointerDrag?: boolean } = {}): boolean {
    if (this.drag) return false
    this.yawDeg = 0 // each placement starts square; R turns it (rotateGhost)
    const seed = this.seedPoint()
    if (!seed || !this.host.showGhost(deviceId, seed, this.yawDeg)) {
      this.opts.announce?.(this.refused(deviceId))
      return false
    }
    this.deviceId = deviceId
    this.at = seed
    this.press = null
    // A new pose starts on the grid, with no Alt remembered: it may begin while another is in progress (the drawer reopened and another device chosen).
    this.latched = false
    this.altHeld = false
    this.pointerDrag = opts.pointerDrag === true
    this.opts.onPlacing?.(true)
    this.setSnap(false)
    this.opts.announce?.(
      (this.pointerDrag ? COPY.placement!.statusDragging! : COPY.placement!.statusPlacing!).replace('{device}', this.name(deviceId))
    )
    return true
  }

  /**
   * R / Shift+R while a device follows the pointer (Alt = 1° instead of 15°): the ghost turns and the
   * drop uses that yaw. Not a history entry (nothing is placed yet). False when nothing is being placed.
   */
  rotateGhost(dir: 1 | -1, free: boolean): boolean {
    if (!this.placing || !this.at) return false
    // « Libre » means the rotation too: Alt+R and, with the G latch on, R turn by 1 degree (L19).
    this.yawDeg = rotateStep(this.yawDeg, dir, isFree(free, this.latched))
    this.host.moveGhost(this.at, this.yawDeg)
    this.scheduler.invalidate()
    this.opts.announce?.(COPY.edit!.statusGhostYaw!.replace('{deg}', String(this.yawDeg)))
    return true
  }

  /**
   * G while a device follows the pointer or is dragged: latch free placement on / off (Alt keeps working on top of it).
   * Said once per toggle. False when there is nothing to place or drag (the key then does nothing).
   */
  toggleFreeLatch(altKey?: boolean): boolean {
    if (!this.placing && !this.drag) return false
    // The Alt state of the key event itself, when the caller has it, beats what the last pointer event said.
    if (altKey !== undefined) this.altHeld = altKey
    this.latched = !this.latched
    const free = isFree(this.altHeld, this.latched)
    this.setSnap(free)
    // Said from the resulting state: Alt still held after the latch is lifted keeps it free, and nothing may then say « grille ».
    this.opts.announce?.(this.latched ? COPY.placement!.statusSnapFree! : free ? COPY.placement!.statusSnapLatchOff! : COPY.placement!.statusSnapGrid!)
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

  /**
   * The pointer of a drawer drag is at canvas px (x, y): the ghost follows it. No-op unless the pose was started by that drag
   * and is still going (Échap or a place change may have ended it while the button is still down).
   */
  dragGhostTo(x: number, y: number, altKey = false): void {
    if (!this.placing || !this.pointerDrag) return
    this.setSnap(this.free({ altKey }))
    const hit = this.floorPointAtPx(x, y)
    if (!hit) return
    this.at = this.target(hit, this.free({ altKey }))
    this.host.moveGhost(this.at, this.yawDeg)
    this.scheduler.invalidate()
  }

  /**
   * The drawer drag ended at canvas px (x, y). Over the 3D view: drop there (the click path: same SPAWN, same entry, same
   * announcement); anywhere else, a cancelled gesture, or no floor under the pointer: the pose is cancelled (said).
   * No-op when the pose already ended (Échap).
   */
  endPointerDrag(x: number, y: number, input: { overView: boolean; cancelled?: boolean; altKey?: boolean }): void {
    if (!this.placing || !this.pointerDrag) return
    const hit = releaseAction(input) === 'drop' ? this.floorPointAtPx(x, y) : null
    if (!hit) {
      this.cancel()
      return
    }
    this.drop(this.target(hit, this.free({ altKey: input.altKey === true })))
  }

  // ── pointer events ──────────────────────────────────────────────────────────

  private onDown(e: PointerEvent): void {
    if (e.button !== 0 || !e.isPrimary) return
    if (e.shiftKey || e.ctrlKey || e.metaKey) return // pan gestures stay the camera's
    // A tap drops the ghost (touch too, Task 43b); a finger that travels is the camera's orbit, as for the mouse (isClick on release).
    if (this.placing) {
      this.press = { x: e.offsetX, y: e.offsetY, t: e.timeStamp }
      return
    }
    if (e.pointerType === 'touch') return // a finger never grabs a placed device: the camera's orbit
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
    this.setSnap(this.free(e))
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
      this.setSnap(this.free(e))
      if (!d.armed && Math.hypot(e.offsetX - d.x, e.offsetY - d.y) <= DRAG_PX) return
      d.armed = true
      const hit = this.floorPointAtPx(e.offsetX, e.offsetY)
      if (!hit) return
      const to = this.target([hit[0] + d.grab[0], hit[1], hit[2] + d.grab[1]], this.free(e))
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
    this.setSnap(this.free(e))
    const hit = this.floorPointAtPx(e.offsetX, e.offsetY)
    if (!hit) return
    this.at = this.target(hit, this.free(e))
    this.host.moveGhost(this.at, this.yawDeg)
    this.scheduler.invalidate()
  }

  private onUp(e: PointerEvent): void {
    const d = this.drag
    if (d) {
      if (e.pointerId !== d.pointerId) return
      const click = !d.armed && isClick({ x: d.x, y: d.y, t: d.t }, { x: e.offsetX, y: e.offsetY, t: e.timeStamp })
      this.endDrag(false)
      if (click) this.opts.onClickSelected?.(d.instanceId, e.offsetX, e.offsetY)
      else if (d.moved)
        this.opts.announce?.(
          COPY.placement!.statusMoved!
            .replace('{device}', d.name)
            .replace('{undo}', this.opts.undoLabel?.() ?? 'Ctrl+Z')
        )
      return
    }
    if (e.pointerType === 'touch' && !e.isPrimary) return // a second finger lifting near the first press is no tap
    const press = this.press
    this.press = null
    if (!press || e.button !== 0 || !this.placing) return
    if (!isClick(press, { x: e.offsetX, y: e.offsetY, t: e.timeStamp })) return // an orbit, not a drop
    const hit = this.floorPointAtPx(e.offsetX, e.offsetY)
    if (!hit) return
    this.drop(this.target(hit, this.free(e)))
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
    this.latched = false
    this.host.hideGhost()
    this.setSnap(null)
    this.opts.onPlacing?.(false)
    this.scheduler.invalidate()
  }

  /** Close the drag: `rollback` (Échap, pointer cancel, teardown) restores the pose, else `commit`. */
  private endDrag(rollback: boolean): void {
    const d = this.drag
    if (!d) return
    this.drag = null
    this.latched = false
    if (rollback) this.history.rollback()
    else this.history.commit()
    d.release()
    this.setSnap(null)
    this.scheduler.invalidate()
  }

  /** Free of the grid for this pointer event: Alt held now, or the latch (remembers Alt for the toggle). */
  private free(e: { altKey: boolean }): boolean {
    this.altHeld = e.altKey
    return isFree(e.altKey, this.latched)
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
