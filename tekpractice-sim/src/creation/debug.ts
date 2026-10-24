/**
 * `window.__creation` (P2): the Mode Création debug / e2e hook. Every action
 * goes through the same functions as the UI (history, place commit).
 * Legacy keeps `window.__audioSim`.
 */
import { Vector3 } from '@babylonjs/core'
import type { DispatchResult } from './store'
import type { Intent } from '../ui/intents'
import type { PortRef, TeachingEvent } from '../engine/types'
import type { DesignState } from '../trials/trial'
import type { DeviceInstance } from '../scene/DeviceSpawner'
import type { PlaceResult } from './placeController'

export interface CreationDebug {
  /** Through `history.do` (undoable, as a UI action). */
  dispatch(intent: Intent): DispatchResult
  design(): DesignState
  events(): TeachingEvent[]
  undo(): boolean
  redo(): boolean
  /** Undo entries. */
  historySize(): number
  /** Body-mesh box centre of a device (independent oracle, src/scene/debugBody.ts), null when unknown / hidden. */
  deviceBodyCenter(id: string): [number, number, number] | null
  /** The device's root is enabled (not hidden by the tree's eye). */
  visible(id: string): boolean
  /** Devices drawn with the Ambre selection outline. */
  outlined(): string[]
  /** `viewState.hidden` keys. */
  hidden(): string[]
  /** The device under a canvas point (CSS px), as a click would pick it. */
  pickAt(x: number, y: number): string | null
  /** « Projet » tree rebuilds so far. */
  treeRenders(): number
  renders(): number
  camera(): { alpha: number; beta: number; radius: number; target: [number, number, number] } | null
  /** `engine.scenes.length`. */
  scenes(): number
  meshCount(): number
  /** `DisposableBag.liveListeners`. */
  liveListeners(): number
  /** The place on screen ('room:<id>' | 'set:<envId>' | 'blank'), null while none is. */
  place(): string | null
  selection(): string | null
  deviceScreen(id: string): { x: number; y: number } | null
  portScreen(ref: PortRef): { x: number; y: number } | null
  worldScreen(p: [number, number, number]): { x: number; y: number } | null
  /** Commit a place with an empty rig, no dialog (the picker path when there is no gear). */
  choosePlace(key: string): Promise<PlaceResult>
  /** The user path: the keep / empty dialog when the rig has gear. 'busy' while another change is in flight. */
  requestPlace(key: string): Promise<PlaceResult>
}

declare global {
  interface Window {
    __creation?: CreationDebug
  }
}

/** World bounds of a device's visible body meshes, or null. */
function bodyBoundsOf(inst: DeviceInstance): { lo: Vector3; hi: Vector3 } | null {
  let lo: Vector3 | null = null
  let hi: Vector3 | null = null
  for (const m of inst.root.getChildMeshes(false)) {
    if (m.metadata?.isDeviceBody !== true || !m.isEnabled()) continue
    m.computeWorldMatrix(true)
    const b = m.getBoundingInfo().boundingBox
    lo = lo ? Vector3.Minimize(lo, b.minimumWorld) : b.minimumWorld.clone()
    hi = hi ? Vector3.Maximize(hi, b.maximumWorld) : b.maximumWorld.clone()
  }
  return lo && hi ? { lo, hi } : null
}

/** Centre of a device's visible body meshes (world), or null. */
export function bodyCentreOf(inst: DeviceInstance): Vector3 | null {
  const b = bodyBoundsOf(inst)
  return b ? b.lo.add(b.hi).scale(0.5) : null
}

/** What the camera rig frames (as legacy `focusFrame`): body bounds, else the whole hierarchy. */
export function frameOf(inst: DeviceInstance): { center: Vector3; boundingRadius: number } {
  const b = bodyBoundsOf(inst)
  const { min, max } = b ? { min: b.lo, max: b.hi } : inst.root.getHierarchyBoundingVectors()
  return { center: min.add(max).scale(0.5), boundingRadius: max.subtract(min).length() / 2 }
}
