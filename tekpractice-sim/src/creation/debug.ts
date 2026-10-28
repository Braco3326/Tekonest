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
import type { QuarantineItem } from './persistence'

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
  /** The device drawn with the Papier hover outline (Task 14b), or null. */
  hovered(): string | null
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
  /** Task 13: the project name and the « * » state. */
  project(): { name: string | null; dirty: boolean }
  /** Task 13: everything set aside in `audio-sim/creation.v1.quarantine` (kept, exportable as JSON). */
  quarantine(): QuarantineItem[]
  /** Task 17: the view cube square in page CSS px (also before a place is on screen: where it will sit). */
  cubeRect(): { x: number; y: number; width: number; height: number }
  /** Task 17: the cube zone id under a page point, as a click there would classify it (null = no cube / missed). */
  cubeZoneAt(x: number, y: number): string | null
  /** Task 17: the zone painted Ambre under the pointer, or null. */
  cubeHover(): string | null
  /**
   * Task 17: turn the main camera to the zone's own pose (its patch then sits at the cube centre,
   * the honest user path: turn, then click the centre patch) and return the cube centre (page px).
   * Resolves once the camera is there (a cut under reduced motion, else after the flight).
   */
  cubeZoneScreenPoint(id: string): Promise<{ x: number; y: number } | null>
  /** Task 17: between frames the scene's active camera is the main one (pointers, picking, render scheduler). */
  activeCameraIsMain(): boolean
  /** Task 18: a flight runs or the orbit inertia still coasts (false = the camera has settled). */
  cameraMoving(): boolean
  /** Task 19: the base view, 'explore' while walking. */
  view(): 'orbit' | 'explore'
  /** Task 19: the walk camera (eye position, heading, floor height under it); null when not walking. */
  walkCamera(): { x: number; y: number; z: number; yaw: number; floor: number } | null
  /** Task 19: the render scheduler's held leases ('walk' while the walker moves). */
  leases(): string[]
  /** Task 19: the ear height view setting. */
  earHeight(): 1.2 | 1.7
  /** Task 20: the place's listening points at the current ear height ([] before a place is shown). */
  listeningPoints(): { id: string; label: string; position: [number, number, number] }[]
  /** Task 20: `viewState.listenerPoint` (the active listening point's id). */
  listenerPoint(): string
  /** Task 24: the world centre of each drawn cable's mesh (a cable follows a moved device), in rig order; null for a cable not drawn. */
  cableCenters(): ([number, number, number] | null)[]
  /** Task 24: a device is following the pointer (placement ghost on screen). */
  placing(): boolean
  /** Task 24: `scene.transformNodes.length` (a ghost must not leave the glb's nodes behind). */
  transformNodeCount(): number
  /** Task 24: the raw floor point under a page point (CSS px), as the placement pick finds it; null off the floor. */
  floorPoint(x: number, y: number): [number, number, number] | null
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
