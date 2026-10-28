/**
 * Port pick proxies (Task 26, CA-19, C18): every port already has an invisible pick sphere
 * (`pick:<instance>:<port>`, `isPickable`, `metadata.isPortMarker`, DeviceSpawner). This module makes
 * them big enough to hit: at least 24 CSS px across (a 12 px radius) at ANY camera distance, so a
 * 2 px connector is as easy to click on a far view as on a close one.
 *
 * The FIRST-CLICK radius depends on the state (final review, controller ruling): over an UNSELECTED device body
 * with no cable in hand it is TIGHT (`TIGHT_PX` = 6 px, or the connector's own size when closer): the body is
 * the click's, the connector itself still patches. On the SELECTED device, while a cable is in hand, or off any
 * body (a connector that sticks out) it is the full 12 px. The 24 px-everywhere reading made the reference QL1
 * unselectable by clicking its body. The proxy spheres themselves always stay >= 12 px (`hitRadiusPx`).
 *
 * - No new meshes, no per-frame work: the spheres are rescaled by an observer on the camera's
 *   `onViewMatrixChangedObservable` (it fires only when the camera moved) and after a scene
 *   reconcile (a device spawned or moved). An idle page rescales nothing.
 * - The permanent in-scene port labels are hidden here (C18: labels on hover / focus only; the hover
 *   label is DOM, `shell/portLabel.ts`).
 * - Where far proxies overlap, the port whose centre is closest to the ray wins (`portAt`).
 * - `mark` restyles the markers (hover, the click-to-patch glow): the marker grows to a few pixels so a
 *   2 px connector is visible, and goes back to its own material / size when the mark is lifted.
 *
 * The scene, camera and canvas arrive through a small structural host: the same code runs in the page and
 * in a headless scene (NullEngine) in tests.
 */
import {
  Color3,
  StandardMaterial,
  Vector3,
  type AbstractMesh,
  type ArcRotateCamera,
  type Material,
  type Mesh,
  type Ray,
  type Scene,
  type TransformNode,
} from '@babylonjs/core'
import type { PortRef } from '../engine/types'
import type { DeviceInstance } from '../scene/DeviceSpawner'
import type { DisposableBag } from '../util/disposable'
import { CREATION_TOKENS } from '../design/creationTokens'

/** C18: a port's hit area is at least 24 CSS px across. */
export const HIT_MIN_PX = 24
/** The first-click radius over an unselected device body, with no cable in hand (px; or the connector's own size when larger). */
export const TIGHT_PX = 6
/** Ports whose centres are within this many metres of the nearest candidate's depth compete on closeness to the ray; farther ones are behind. */
const DEPTH_TIE_M = 0.1
/** A highlighted marker (hover, patch glow) reads as about this many CSS px across. */
export const HIGHLIGHT_PX = 14
/** A marker's own diameter (m): DeviceSpawner's cylinder. */
const MARKER_DIAMETER_M = 0.05

/** World metres that one CSS pixel spans at `distanceM` (perspective camera, vertical fov). */
export function worldPerPx(distanceM: number, fovRad: number, viewportHeightPx: number): number {
  const d = Number.isFinite(distanceM) ? Math.max(distanceM, 0.01) : 0.01
  const h = Number.isFinite(viewportHeightPx) && viewportHeightPx > 0 ? viewportHeightPx : 708
  return (2 * d * Math.tan(fovRad / 2)) / h
}

/** A world radius on screen, in CSS px, at `distanceM`. */
export function screenRadiusPx(radiusM: number, distanceM: number, fovRad: number, viewportHeightPx: number): number {
  return radiusM / worldPerPx(distanceM, fovRad, viewportHeightPx)
}

/** World radius so that a proxy covers >= `minPx` CSS px across (perspective camera, fov, viewport height). */
export function proxyRadius(distanceM: number, fovRad: number, viewportHeightPx: number, minPx: number = HIT_MIN_PX): number {
  return (minPx / 2) * worldPerPx(distanceM, fovRad, viewportHeightPx)
}

/**
 * Screen-size cap for in-scene decoration: the world size (m) of something that spans `maxPx` CSS px
 * across at `distanceM`. A highlight sized with it never exceeds `maxPx` on screen, near or far.
 */
export function labelScale(distanceM: number, maxPx: number, fovRad = 0.8, viewportHeightPx = 708): number {
  return maxPx * worldPerPx(distanceM, fovRad, viewportHeightPx)
}

/** A stable map key for a port. */
export const portKey = (r: PortRef): string => `${r.instance}\u0000${r.port}`

export type PortMark = 'ok' | 'dim' | 'pending'

/** What PortProxies needs of the page (structural: tests give a headless scene and a stand-in canvas). */
export interface ProxyHost {
  scene: Scene
  camera: ArcRotateCamera
  /** Its `clientHeight` is the viewport height in CSS px. */
  canvas: HTMLElement
  instance(id: string): DeviceInstance | undefined
  instances(): Iterable<DeviceInstance>
  /** The selected device (its ports keep the full radius). */
  selected?(): string | null
}

interface Entry {
  ref: PortRef
  sphere: Mesh | undefined
  /** The sphere's unscaled radius (local, m). */
  base: number
  label: AbstractMesh | undefined
}

const same = (a: PortRef, b: PortRef): boolean => a.instance === b.instance && a.port === b.port

export class PortProxies {
  private entries = new WeakMap<DeviceInstance, Entry[]>()
  /** Markers restyled by `mark`, with what to put back. */
  private styled = new Map<Mesh, { material: Material | null; visibility: number }>()
  private hover: PortRef | null = null
  private marks: ReadonlyMap<string, PortMark> | null = null
  private materials = new Map<string, StandardMaterial>()

  constructor(
    private readonly host: ProxyHost,
    bag: DisposableBag,
    /** After each rescale for a moved camera: the labels on screen follow their port. */
    onViewChange?: () => void
  ) {
    // Fires only when the view matrix really changed (orbit, zoom, flight, resize): nothing runs at idle.
    bag.observe(host.camera.onViewMatrixChangedObservable, () => {
      this.refresh()
      onViewChange?.()
    })
    bag.add(() => {
      this.unstyleAll()
      for (const m of this.materials.values()) m.dispose()
      this.materials.clear()
    })
  }

  /** Rescale every proxy for the camera as it is now; hide the permanent in-scene port labels. */
  refresh(): void {
    const { camera, canvas } = this.host
    const h = canvas.clientHeight
    if (!(h > 0)) return
    const eye = camera.position
    for (const inst of this.host.instances()) {
      for (const e of this.entriesOf(inst)) {
        if (e.label?.isVisible) e.label.isVisible = false
        const s = e.sphere
        if (!s || s.isDisposed()) continue
        const d = Vector3.Distance(eye, s.getAbsolutePosition())
        // 2 % over the minimum: a hit radius is never a hair under 12 px through rounding.
        const world = Math.max(e.base * this.parentScale(inst.root), proxyRadius(d, camera.fov, h) * 1.02)
        const scale = world / (e.base * this.parentScale(inst.root))
        // Skip the matrix work for a sphere that is already big enough and at most 2 % too big (nothing the learner can
        // feel). One-sided: a sphere BELOW its target is always rescaled, or a small shrink of the canvas would leave it
        // a hair under the 12 px floor.
        if (s.scaling.x < scale || s.scaling.x > scale * 1.02) {
          s.scaling.setAll(scale)
          s.computeWorldMatrix(true)
        }
      }
    }
    this.restyle(false)
  }

  /**
   * The port aimed at on a canvas point (CSS px, canvas-relative), or null. The state decides the radius: 12 px
   * (the proxy), or TIGHT over an unselected body with no cable in hand (`inHand`). Among the ports reached, the
   * NEAREST to the eye wins (a rear port never takes the click of a front one); ports at about the same depth
   * compete on closeness to the ray.
   */
  portAt(x: number, y: number, inHand = false): PortRef | null {
    const { scene, camera, canvas } = this.host
    const cam = scene.activeCamera
    if (!cam) return null
    const hits = scene.multiPick(x, y, (m: AbstractMesh) => m.metadata?.isPortMarker === true && m.isEnabled())
    if (!hits?.length) return null
    const ray = scene.createPickingRay(x, y, null, cam)
    const tight = !inHand && this.overUnselectedBody(ray)
    const h = canvas.clientHeight
    const near: { ref: PortRef; d: number; depth: number }[] = []
    for (const hit of hits) {
      const mesh = hit.pickedMesh
      const ref = mesh?.metadata?.portRef as PortRef | undefined
      if (!mesh || !ref) continue
      const centre = mesh.getAbsolutePosition()
      const d = ray.direction.cross(centre.subtract(ray.origin)).length()
      const depth = Vector3.Distance(ray.origin, centre)
      if (tight && d > this.tightWorld(depth, camera.fov, h)) continue
      near.push({ ref: { instance: ref.instance, port: ref.port }, d, depth })
    }
    if (!near.length) return null
    const front = Math.min(...near.map((c) => c.depth))
    // "Same layer": within the proxy's own world radius of the nearest (far views have big proxies), at least DEPTH_TIE_M.
    const tie = Math.max(DEPTH_TIE_M, proxyRadius(front, camera.fov, h))
    let best: PortRef | null = null
    let bestD = Infinity
    for (const c of near) {
      if (c.depth > front + tie || c.d >= bestD) continue
      bestD = c.d
      best = c.ref
    }
    return best
  }

  /**
   * The radius, in CSS px, a FIRST click gets on this port in the state as it is now, OVER the device's body (where a
   * connector sits): the proxy's (>= 12) on the selected device or while a cable is in hand (`inHand`), TIGHT on an
   * unselected one. Off the body (a connector that sticks out) every port keeps the proxy's radius: `portAt` decides
   * that per point. 0 for an unknown port.
   */
  firstClickRadiusPx(ref: PortRef, inHand = false): number {
    const wide = this.hitRadiusPx(ref)
    if (wide === 0 || inHand || ref.instance === (this.host.selected?.() ?? null)) return wide
    const marker = this.host.instance(ref.instance)?.portMarkers.get(ref.port)
    const { camera, canvas } = this.host
    if (!marker || marker.isDisposed()) return wide
    const depth = Vector3.Distance(camera.position, marker.getAbsolutePosition())
    return Math.min(wide, Math.max(TIGHT_PX, screenRadiusPx(MARKER_DIAMETER_M / 2, depth, camera.fov, canvas.clientHeight)))
  }

  /** The tight radius, in world metres at `depth`: TIGHT_PX, or the connector's own radius when that is bigger (a close view). */
  private tightWorld(depth: number, fov: number, h: number): number {
    return Math.max(TIGHT_PX * worldPerPx(depth, fov, h), MARKER_DIAMETER_M / 2)
  }

  /** A device body that is not the selected one lies along this ray (the nearest body decides). */
  private overUnselectedBody(ray: Ray): boolean {
    const hit = this.host.scene.pickWithRay(ray, (m: AbstractMesh) => m.metadata?.isDeviceBody === true && m.isEnabled() && m.isVisible)
    const id = hit?.hit ? hit.pickedMesh?.metadata?.instanceId : undefined
    return typeof id === 'string' && id !== (this.host.selected?.() ?? null)
  }

  /** The port's proxy radius on screen, in CSS px (>= 12 at any distance; null-safe: 0 for an unknown port). Not the first-click radius: see `firstClickRadiusPx`. */
  hitRadiusPx(ref: PortRef): number {
    const inst = this.host.instance(ref.instance)
    const { camera, canvas } = this.host
    const h = canvas.clientHeight
    if (!inst || !(h > 0)) return 0
    const e = this.entriesOf(inst).find((x) => same(x.ref, ref))
    const s = e?.sphere
    if (!e || !s || s.isDisposed()) return 0
    const world = e.base * this.parentScale(inst.root) * s.scaling.x
    return screenRadiusPx(world, Vector3.Distance(camera.position, s.getAbsolutePosition()), camera.fov, h)
  }

  /**
   * Restyle the markers: `hover` (the port under the pointer) and `marks` (the patch glow: 'ok' green,
   * 'dim' faded, 'pending' Ambre; keys are `portKey`). `mark(null, null)` puts everything back.
   */
  mark(hover: PortRef | null, marks: ReadonlyMap<string, PortMark> | null): void {
    this.hover = hover
    this.marks = marks && marks.size ? marks : null
    this.restyle(true)
  }

  // ── internals ───────────────────────────────────────────────────────────────

  private entriesOf(inst: DeviceInstance): Entry[] {
    let list = this.entries.get(inst)
    if (!list) {
      const own = (name: string): Mesh | undefined => inst.root.getChildMeshes(true, (n) => n.name === name)[0] as Mesh | undefined
      list = [...inst.portMarkers.keys()].map((port) => {
        const sphere = own(`pick:${inst.instanceId}:${port}`)
        return {
          ref: { instance: inst.instanceId, port },
          sphere,
          // The half-extent of the local box = the sphere's radius (Babylon's boundingSphere hugs the box corners: 1.73x too big).
          base: sphere ? sphere.getBoundingInfo().boundingBox.extendSize.x : 0.04,
          label: own(`portlabel:${inst.instanceId}:${port}`),
        }
      })
      this.entries.set(inst, list)
    }
    return list
  }

  private parentScale(root: TransformNode): number {
    const s = root.absoluteScaling?.x
    return s && Number.isFinite(s) && s > 0 ? s : 1
  }

  private material(kind: PortMark | 'hover'): StandardMaterial {
    let m = this.materials.get(kind)
    if (!m) {
      m = new StandardMaterial(`cr:port-${kind}`, this.host.scene)
      const hex = kind === 'ok' ? CREATION_TOKENS.color.ok : kind === 'pending' ? CREATION_TOKENS.color.ambre : CREATION_TOKENS.color.papier
      m.diffuseColor = Color3.Black()
      m.specularColor = Color3.Black()
      m.emissiveColor = Color3.FromHexString(hex)
      m.disableLighting = true
      this.materials.set(kind, m)
    }
    return m
  }

  /** Apply the hover / marks to the markers (`full`: also put back the ones no longer marked). */
  private restyle(full: boolean): void {
    if (!this.hover && !this.marks && this.styled.size === 0) return
    const { camera, canvas } = this.host
    const h = canvas.clientHeight
    const want = new Map<Mesh, { kind: PortMark | 'hover' | null; grow: boolean }>()
    const consider = (ref: PortRef, kind: PortMark | 'hover' | null, grow: boolean): void => {
      const marker = this.host.instance(ref.instance)?.portMarkers.get(ref.port)
      if (marker && !marker.isDisposed()) want.set(marker, { kind, grow })
    }
    if (this.marks)
      for (const [key, kind] of this.marks) {
        const [instance, port] = key.split('\u0000')
        consider({ instance, port }, kind, kind !== 'dim')
      }
    if (this.hover) {
      const marker = this.host.instance(this.hover.instance)?.portMarkers.get(this.hover.port)
      const prior = marker ? want.get(marker) : undefined
      consider(this.hover, prior?.kind ?? 'hover', true)
    }
    if (full) for (const m of [...this.styled.keys()]) if (!want.has(m) || m.isDisposed()) this.unstyle(m)
    for (const [marker, w] of want) {
      if (!this.styled.has(marker)) this.styled.set(marker, { material: marker.material, visibility: marker.visibility })
      if (w.kind === 'dim') {
        marker.visibility = 0.3
        marker.scaling.setAll(1)
      } else {
        marker.visibility = 1
        if (w.kind) marker.material = this.material(w.kind)
        const size = h > 0 ? labelScale(Vector3.Distance(camera.position, marker.getAbsolutePosition()), HIGHLIGHT_PX, camera.fov, h) : MARKER_DIAMETER_M
        marker.scaling.setAll(w.grow ? Math.max(1, size / MARKER_DIAMETER_M) : 1)
      }
      marker.computeWorldMatrix(true)
    }
  }

  private unstyle(m: Mesh): void {
    const was = this.styled.get(m)
    this.styled.delete(m)
    if (!was || m.isDisposed()) return
    m.material = was.material
    m.visibility = was.visibility
    m.scaling.setAll(1)
    m.computeWorldMatrix(true)
  }

  private unstyleAll(): void {
    for (const m of [...this.styled.keys()]) this.unstyle(m)
  }
}
