/**
 * Mode Création selection (Task 9, C10): ONE selection state (`viewState.selection`)
 * shared by the « Projet » tree, a click on a device in the 3D view and `[` / `]`.
 * Selecting a device flies the camera to it through `CameraRig.flyToDevice`
 * (450 ms, a cut under reduced motion). Selection and camera are view state:
 * never in the store, never undoable (brief §4). No FocusPatch in the shell.
 */
import type { Scene, Vector3 } from '@babylonjs/core'
import type { DeviceInstance } from '../scene/DeviceSpawner'
import type { DisposableBag } from '../util/disposable'
import type { ViewState } from './viewState'
import { frameOf } from './debug'

type Frame = { center: Vector3; boundingRadius: number }

export interface SelectionDeps {
  viewState: ViewState
  host: {
    instance(id: string): DeviceInstance | undefined
    frameOfKey(key: string): Frame | null
    readonly rig: { flyToDevice(f: Frame): void } | null
  }
  /** Ask for a frame (render on demand). */
  invalidate(): void
  /** A device was selected (or the selection cleared) by a learner action: announce it. */
  onSelect?(id: string | null): void
}

export interface Selection {
  /** Select a device (null clears); flies to it unless `fly: false`. False when the device is unknown. */
  select(id: string | null, opts?: { fly?: boolean }): boolean
  /** Fly to the selected device (Entrée / F in the 3D view). */
  frameSelection(): boolean
  /** Frame a zone ('zone:<id>') or a cable ('cable:<key>'); the device selection is cleared. */
  flyToKey(key: string): boolean
}

export function createSelection(d: SelectionDeps): Selection {
  const flyTo = (f: Frame | null): boolean => {
    if (!f || !d.host.rig) return false
    d.host.rig.flyToDevice(f)
    d.invalidate()
    return true
  }
  const frameDevice = (id: string): boolean => {
    const inst = d.host.instance(id)
    return inst ? flyTo(frameOf(inst)) : false
  }
  return {
    select(id, opts = {}) {
      if (id !== null && !d.host.instance(id)) return false
      d.viewState.set({ selection: id })
      d.onSelect?.(id)
      if (id !== null && opts.fly !== false) frameDevice(id)
      return true
    },
    frameSelection() {
      const sel = d.viewState.get().selection
      return sel ? frameDevice(sel) : false
    },
    flyToKey(key) {
      const f = d.host.frameOfKey(key)
      if (!f) return false
      d.viewState.set({ selection: null })
      return flyTo(f)
    },
  }
}

type Press = { x: number; y: number; t: number }

/** A click on the canvas, not an orbit drag: moved ≤ 5 px, released within 500 ms. */
export function isClick(down: Press, up: Press): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) <= 5 && up.t - down.t <= 500
}

/** The instance id under a canvas point (device bodies only, visible ones), or null. */
export function pickDevice(scene: Scene | null, x: number, y: number): string | null {
  if (!scene) return null
  const hit = scene.pick(
    x,
    y,
    (m) => m.metadata?.isDeviceBody === true && m.isEnabled() && m.isVisible
  )
  const id = hit?.hit ? hit.pickedMesh?.metadata?.instanceId : undefined
  return typeof id === 'string' ? id : null
}

/** A port (its marker or its invisible enlarged pick proxy) is under a canvas point. */
export function portAt(scene: Scene | null, x: number, y: number): boolean {
  if (!scene) return false
  return !!scene.pick(x, y, (m) => m.metadata?.isPortMarker === true && m.isEnabled())?.hit
}

/**
 * Hover (Task 14b): the device under a free-moving pointer (no button held, so
 * never during an orbit drag) gets the hover outline; leaving the canvas or a
 * press clears it. Event-driven only: one pick per pointer move, no per-frame
 * work (the move already asks for a frame through the render scheduler).
 */
export function attachCanvasHover(
  canvas: HTMLElement,
  bag: DisposableBag,
  pick: (x: number, y: number) => string | null,
  hover: (id: string | null) => void
): void {
  bag.listen(canvas, 'pointermove', (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    hover(e.buttons === 0 ? pick(e.offsetX, e.offsetY) : null)
  })
  bag.listen(canvas, 'pointerleave', () => hover(null))
}

/**
 * A primary-button click on a device body selects it and flies to it.
 * DOM listeners on the canvas (in `bag`), independent of the place's scene.
 */
export function attachCanvasPicking(
  canvas: HTMLElement,
  bag: DisposableBag,
  pick: (x: number, y: number) => string | null,
  sel: Selection
): void {
  let down: Press | null = null
  bag.listen(canvas, 'pointerdown', (e: PointerEvent) => {
    down = e.button === 0 && e.isPrimary ? { x: e.offsetX, y: e.offsetY, t: e.timeStamp } : null
  })
  bag.listen(canvas, 'pointerup', (e: PointerEvent) => {
    const from = down
    down = null
    if (!from || e.button !== 0 || !isClick(from, { x: e.offsetX, y: e.offsetY, t: e.timeStamp }))
      return
    const id = pick(e.offsetX, e.offsetY)
    if (id) sel.select(id)
  })
}
