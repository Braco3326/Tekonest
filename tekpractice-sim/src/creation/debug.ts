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
import type { CoverageDebug } from './coverageController'

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
  /** Task 27: the colour a drawn cable has ('#RRGGBB', read from its material); null when it is not drawn. */
  cableColor(key: string): string | null
  /** Task 27 (test hook): show these signal ids in the legend as if their cables were on the scene (the next rig change puts the real ones back). */
  legendPreview(ids: string[]): void
  /** Task 27: the cable under the pointer (highlighted, its text shown), or null. */
  cableHovered(): string | null
  /** Task 27: the cable a page point is over (screen-space pick; ignores ports and devices), or null: an oracle for the hover. */
  cableAtPage(x: number, y: number): string | null
  /** Task 27: a page point on this cable with no port and no device under it (a hover there is the cable's), or null. */
  cableFreePoint(key: string): { x: number; y: number } | null
  /** Task 24: a device is following the pointer (placement ghost on screen). */
  placing(): boolean
  /** Task 24: `scene.transformNodes.length` (a ghost must not leave the glb's nodes behind). */
  transformNodeCount(): number
  /** Stabilisation A: .glb loads still in flight (0 = every model that will arrive has been applied or dropped). */
  modelsPending(): number
  /**
   * Task 26 + final review: the radius a FIRST click gets on a port over its device's body, in CSS px, for the state as it is now:
   * >= 12 (a 24 px target) on the selected device or while a cable is in hand, tight (6, or the connector's own size when closer)
   * on an unselected device. 0 for an unknown port.
   */
  portHitRadiusPx(ref: PortRef): number
  /** Final review: a port's pick proxy radius in CSS px, always >= 12 at any distance and after any resize (the guard); 0 for an unknown port. */
  portProxyRadiusPx(ref: PortRef): number
  /** Task 26: the port under a canvas-relative point (CSS px), proxies included, for the state as it is now (selection, cable in hand). */
  portAtPoint(x: number, y: number): PortRef | null
  /** Task 26: the ports of a device (ids), [] when unknown. */
  devicePorts(instanceId: string): string[]
  /** Task 26: in-scene port label planes drawn right now (0 = none: labels exist on hover only, as DOM). */
  visiblePortLabels(): number
  /** Task 26: move the orbit camera to this distance at once (a zoom). */
  setCameraRadius(radius: number): void
  /** Task 27: turn the orbit camera about its target by this many radians at once (a cut). */
  turnCamera(dAlpha: number): void
  /** Final review: the drawn length (m) of a cable (the polyline the hover shows), or null when it is not drawn. */
  cableLengthM(key: string): number | null
  /** Final review: the straight distance (m) between two ports in the world, or null when either is unknown. */
  portDistanceM(a: PortRef, b: PortRef): number | null
  /** Task 26: the first port clicked while a cable is in hand, or null. */
  patchPending(): PortRef | null
  /** Task 24: the raw floor point under a page point (CSS px), as the placement pick finds it; null off the floor. */
  floorPoint(x: number, y: number): [number, number, number] | null
  /** Task 37: the coverage's state (plain data; never loads its chunk: `on: false` until Écoute › Couverture is chosen). */
  coverage(): CoverageDebug
  /** Task 37: draw calls of the coverage mesh called `name` ('coverage' = the plain dots) in the latest frame it drew; 0 if it never did. */
  drawCalls(name: string): number
  /** Task 37: coverage jobs posted to the worker since the page loaded (idle = no change; a moved speaker = +1). */
  coverageJobs(): number
  /** Task 37: the coverage dot under a canvas point (canvas CSS px), devices ignored (the oracle of the pin); null when none. */
  coverageDotAt(x: number, y: number): [number, number, number] | null
  /** Task 37: the world position of a port marker (after the .glb is applied it sits on the model), or null when unknown. */
  portWorld(ref: PortRef): [number, number, number] | null
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
