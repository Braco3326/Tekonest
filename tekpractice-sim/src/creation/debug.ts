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

export interface CreationDebug {
  /** Through `history.do` (undoable, as a UI action). */
  dispatch(intent: Intent): DispatchResult
  design(): DesignState
  events(): TeachingEvent[]
  undo(): boolean
  redo(): boolean
  /** Undo entries. */
  historySize(): number
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
  choosePlace(key: string): Promise<void>
  /** The user path: the keep / empty dialog when the rig has gear. */
  requestPlace(key: string): Promise<void>
}

declare global {
  interface Window {
    __creation?: CreationDebug
  }
}

/** Centre of a device's visible body meshes (world), or null. */
export function bodyCentreOf(inst: DeviceInstance): Vector3 | null {
  let lo: Vector3 | null = null
  let hi: Vector3 | null = null
  for (const m of inst.root.getChildMeshes(false)) {
    if (m.metadata?.isDeviceBody !== true || !m.isEnabled()) continue
    m.computeWorldMatrix(true)
    const b = m.getBoundingInfo().boundingBox
    lo = lo ? Vector3.Minimize(lo, b.minimumWorld) : b.minimumWorld.clone()
    hi = hi ? Vector3.Maximize(hi, b.maximumWorld) : b.maximumWorld.clone()
  }
  return lo && hi ? lo.add(hi).scale(0.5) : null
}
