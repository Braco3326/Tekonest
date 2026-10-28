/**
 * Edit actions on the selected device (Task 25, CA-11): rotate, duplicate, delete.
 *
 * - Each is ONE `history.do` = one undo entry (C5). Intents only: the controller never touches
 *   the graph (C6). Selection is view state: `onDuplicated` hands the copy to the shell.
 * - `blocked()` is true while a drag holds an open "Déplacer" transaction: an edit then would be
 *   merged into it by the history, so every edit is ignored (nothing recorded, nothing said).
 * - Delete is a single REMOVE: its inverse (the store's) respawns the device with its pose and
 *   controls and re-plugs its cables, so Ctrl+Z brings back the device AND its cables.
 * - Duplicate copies the device, its controls and its pose (`duplicatePose`), never its cables.
 * Methods return whether an edit was recorded.
 */
import type { Intent } from '../ui/intents'
import { COPY } from './copy'
import type { History } from './history'
import { duplicatePose, rotateStep, type RoomBounds } from './placementMath'
import type { CreationStore } from './store'

export interface EditDeps {
  history: History
  store: CreationStore
  /** The selected device's instance id (view state), or null. */
  selection(): string | null
  /** True while an edit must not run (a drag is open). */
  blocked(): boolean
  /** The room's bounds: a copy never lands past the far wall. */
  roomBounds?(): RoomBounds
  /** The device name for history labels and the status line. */
  deviceLabel?(deviceId: string): string
  /** A line for the status bar (announced). */
  announce?(message: string): void
  /** The undo key's label (« Ctrl+Z »). */
  undoLabel?(): string
  /** The copy exists: the shell selects it (no camera flight). */
  onDuplicated?(instanceId: string): void
}

interface Target {
  instanceId: string
  deviceId: string
  name: string
  placement: ReturnType<CreationStore['design']>['placements'][number] | undefined
}

export class EditController {
  constructor(private readonly d: EditDeps) {}

  /** R / Shift+R (dir ±1; `free` = Alt: 1° instead of 15°). */
  rotate(dir: 1 | -1, free: boolean): boolean {
    const t = this.target()
    if (!t) return false
    const p = this.needPose(t)
    if (!p) return false
    const yawDeg = rotateStep(p.yawDeg, dir, free)
    const ok = this.run(
      t,
      {
        type: 'SET_POSE',
        instanceId: t.instanceId,
        position: [p.position_m[0], p.position_m[1], p.position_m[2]],
        yawDeg,
        tiltDeg: p.tiltDeg ?? 0,
        mount: p.mount ?? 'floor',
      },
      COPY.edit!.entryRotate!
    )
    if (ok) this.say(COPY.edit!.statusRotated!.replace('{deg}', String(yawDeg)), t)
    return ok
  }

  /** Ctrl+D: a copy 0.5 m along x with the same controls, as one entry; the shell selects it. */
  duplicate(): boolean {
    const t = this.target()
    if (!t) return false
    const p = this.needPose(t)
    if (!p) return false
    const inst = this.d.store.snapshot().instances.find((i) => i.instanceId === t.instanceId)
    if (!inst) return false
    const pose = duplicatePose(
      { position: [p.position_m[0], p.position_m[1], p.position_m[2]], yawDeg: p.yawDeg, tiltDeg: p.tiltDeg ?? 0, mount: p.mount ?? 'floor' },
      this.d.roomBounds?.()
    )
    const instanceId = this.d.store.newInstanceId(t.deviceId)
    const ok = this.run(
      t,
      {
        type: 'SPAWN',
        deviceId: t.deviceId,
        instanceId,
        position: pose.position,
        rotationY: pose.yawDeg,
        controls: { ...inst.controls },
        ...(pose.tiltDeg !== 0 ? { tiltDeg: pose.tiltDeg } : {}),
        ...(pose.mount !== 'floor' ? { mount: pose.mount } : {}),
      },
      COPY.edit!.entryDuplicate!
    )
    if (!ok) return false
    this.d.onDuplicated?.(instanceId)
    this.say(COPY.edit!.statusDuplicated!, t)
    return true
  }

  /** Suppr: the device and its cables leave as one entry. */
  remove(): boolean {
    const t = this.target()
    if (!t) return false
    const ok = this.run(t, { type: 'REMOVE', instanceId: t.instanceId }, COPY.edit!.entryDelete!)
    if (ok) this.say(COPY.edit!.statusDeleted!, t)
    return ok
  }

  // ── internals ───────────────────────────────────────────────────────────────

  /** The selected device, or null (blocked: silently; nothing selected: said). */
  private target(): Target | null {
    if (this.d.blocked()) return null
    const id = this.d.selection()
    if (id === null) {
      this.d.announce?.(COPY.shell!.statusNoSelection!)
      return null
    }
    const design = this.d.store.design()
    const inst = design.rig.instances.find((i) => i.instanceId === id)
    if (!inst) return null // a stale selection: nothing to edit
    return {
      instanceId: id,
      deviceId: inst.deviceId,
      name: this.d.deviceLabel?.(inst.deviceId) ?? inst.deviceId,
      placement: design.placements.find((p) => p.instanceId === id),
    }
  }

  private needPose(t: Target): NonNullable<Target['placement']> | null {
    if (t.placement) return t.placement
    this.d.announce?.(COPY.edit!.statusNoPose!.replace('{device}', t.name))
    return null
  }

  private run(t: Target, intent: Intent, label: string): boolean {
    const r = this.d.history.do(intent, label.replace('{device}', t.name))
    if (r.ok) return true
    this.d.announce?.(COPY.edit!.statusRefused!.replace('{device}', t.name))
    return false
  }

  private say(template: string, t: Target): void {
    this.d.announce?.(template.replace('{device}', t.name).replace('{undo}', this.d.undoLabel?.() ?? 'Ctrl+Z'))
  }
}
