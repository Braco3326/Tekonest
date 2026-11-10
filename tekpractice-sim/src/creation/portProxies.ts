/**
 * Port pick proxies (Task 26, CA-19, C18): every port already has an invisible pick sphere
 * (`pick:<instance>:<port>`, `isPickable`, `metadata.isPortMarker`, DeviceSpawner). This module makes
 * them big enough to hit: at least 24 CSS px across (a 12 px radius) at ANY camera distance, so a
 * 2 px connector is as easy to click on a far view as on a close one.
 *
 * The FIRST-CLICK radius depends on the state (final review, controller ruling): for a port of an UNSELECTED device,
 * over an unselected device body, with no cable in hand it is TIGHT (`TIGHT_PX` = 6 px, or the connector's own size when
 * closer): the body is the click's, the connector itself still patches. For a port of the SELECTED device, while a cable is
 * in hand, or off any body (a connector that sticks out) it is the full 12 px. The 24 px-everywhere reading made the reference QL1
 * unselectable by clicking its body. The proxy spheres themselves always stay >= 12 px (`hitRadiusPx`).
 *
 * - No new meshes, no per-frame work: the spheres are rescaled by an observer on the camera's
 *   `onViewMatrixChangedObservable` (it fires only when the camera moved) and after a scene
 *   reconcile (a device spawned or moved). An idle page rescales nothing.
 * - The permanent in-scene port labels are hidden here (C18: labels on hover / focus only; the hover
 *   label is DOM, `shell/portLabel.ts`).
 * - Where proxies overlap (`portAt`): a port inside the tight radius of the ray (aimed at) beats one that is only grazed;
 *   among those, the nearest to the eye wins (ports at about the same depth: the closest to the ray); with none aimed at,
 *   the nearest to the eye of all the ports reached.
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
/** A marker ring is never drawn under this many CSS px across (outer diameter): far views keep a visible outline. */
export const RING_MIN_PX = 9
/** At close range (under CLOSE_M) a highlighted ring never grows past this many times its rest size. */
export const RING_MAX_GROW = 1.6
/** "Close range" for the grow cap (m). */
const CLOSE_M = 1
/** A marker ring's rest diameter when its mesh has no usable bounds (m): the fallback connector's ring (20 mm x 1.25). */
const FALLBACK_RING_M = 0.025

/** The scale a marker rests at (DeviceSpawner records it in the metadata; 1 for every ring now, the diameter being per connector). */
const restScale = (m: Mesh): number => {
  const s = m.metadata?.restScale
  return typeof s === 'number' && s > 0 ? s : 1
}

/** A marker ring's own outer diameter at scale 1, local metres (the half-extent of its local bounding box, doubled). */
const ringLocalDiameter = (m: Mesh): number => {
  const d = m.getBoundingInfo().boundingBox.extendSize.x * 2
  return Number.isFinite(d) && d > 0 ? d : FALLBACK_RING_M
}

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

/**
 * The uniform scale for a marker ring of rest outer diameter `restM` (world metres) seen from `distanceM`: 1 while the ring spans
 * at least RING_MIN_PX on screen (close and middle range: it keeps its own size), otherwise the scale that makes it span exactly
 * RING_MIN_PX (far views keep a visible outline). Never below 1, never grows a ring that is big enough, always finite.
 */
export function ringScale(restM: number, distanceM: number, fovRad: number, viewportPx: number): number {
  if (!Number.isFinite(restM) || restM <= 0) return 1
  const px = restM / worldPerPx(distanceM, fovRad, viewportPx)
  return px >= RING_MIN_PX ? 1 : RING_MIN_PX / px
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
  /** The marker ring (the outline drawn around the connector). */
  marker: Mesh | undefined
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
        // The outline ring: never under RING_MIN_PX on screen. Same skip as the pick sphere (a change under 2 % is not worth a matrix
        // update). A ring restyled by hover / marks is sized by `restyle` (called below), not here.
        const m = e.marker
        if (m && !m.isDisposed() && !this.styled.has(m)) {
          const target = this.ringTarget(m, false)
          if (Math.abs(m.scaling.x - target) > target * 0.02) {
            m.scaling.setAll(target)
            m.computeWorldMatrix(true)
          }
        }
      }
    }
    this.restyle(false)
  }

  /**
   * The port aimed at on a canvas point (CSS px, canvas-relative), or null. The state decides the radius: 12 px
   * (the proxy), or TIGHT for a port of an UNSELECTED device over an unselected body with no cable in hand (`inHand`):
   * decided per port, so a port of the selected device keeps 12 px wherever it projects. Ranking: a port inside the
   * TIGHT radius of the ray (a connector aimed at) beats one that is only grazed, whatever its depth; among the
   * ports of that class the NEAREST to the eye wins (a rear port never takes the click of a front one), ports at
   * about the same depth compete on closeness to the ray. With no port inside the tight radius the same rule applies
   * to every port reached.
   */
  portAt(x: number, y: number, inHand = false): PortRef | null {
    const { scene, camera, canvas } = this.host
    const cam = scene.activeCamera
    if (!cam) return null
    const hits = scene.multiPick(x, y, (m: AbstractMesh) => m.metadata?.isPortMarker === true && m.isEnabled())
    if (!hits?.length) return null
    const ray = scene.createPickingRay(x, y, null, cam)
    const overUnselected = !inHand && this.overUnselectedBody(ray)
    const selected = this.host.selected?.() ?? null
    const h = canvas.clientHeight
    const near: { ref: PortRef; d: number; depth: number; sharp: boolean }[] = []
    for (const hit of hits) {
      const mesh = hit.pickedMesh
      const ref = mesh?.metadata?.portRef as PortRef | undefined
      if (!mesh || !ref) continue
      const centre = mesh.getAbsolutePosition()
      const d = ray.direction.cross(centre.subtract(ray.origin)).length()
      const depth = Vector3.Distance(ray.origin, centre)
      const marker = this.host.instance(ref.instance)?.portMarkers.get(ref.port)
      const sharp = d <= this.tightWorld(depth, camera.fov, h, marker && !marker.isDisposed() ? this.restRadius(marker) : FALLBACK_RING_M / 2)
      if (overUnselected && ref.instance !== selected && !sharp) continue
      near.push({ ref: { instance: ref.instance, port: ref.port }, d, depth, sharp })
    }
    if (!near.length) return null
    const aimed = near.filter((c) => c.sharp)
    const pool = aimed.length ? aimed : near
    const front = Math.min(...pool.map((c) => c.depth))
    // "Same layer": within the proxy's own world radius of the nearest (far views have big proxies), at least DEPTH_TIE_M.
    const tie = Math.max(DEPTH_TIE_M, proxyRadius(front, camera.fov, h))
    let best: PortRef | null = null
    let bestD = Infinity
    for (const c of pool) {
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
    return Math.min(wide, Math.max(TIGHT_PX, screenRadiusPx(this.restRadius(marker), depth, camera.fov, canvas.clientHeight)))
  }

  /** The tight radius, in world metres at `depth`: TIGHT_PX, or the connector's own (ring) radius when that is bigger (a close view). */
  private tightWorld(depth: number, fov: number, h: number, restRadiusM: number): number {
    return Math.max(TIGHT_PX * worldPerPx(depth, fov, h), restRadiusM)
  }

  /** A marker ring's rest radius in world metres (its real size at rest, scale = restScale: the connector's, not a fixed 25 mm). */
  private restRadius(marker: Mesh): number {
    return (ringLocalDiameter(marker) * restScale(marker) * this.parentScale((marker.parent as TransformNode | null) ?? null)) / 2
  }

  /**
   * The scale a marker ring should have now, from the camera. At rest: restScale, raised so the ring spans RING_MIN_PX on screen.
   * `grow` (hover / patch glow): it reads HIGHLIGHT_PX wide at least (so a small connector's ring is visible), never under its rest
   * size, and closer than CLOSE_M never past RING_MAX_GROW x its rest size.
   */
  private ringTarget(marker: Mesh, grow: boolean): number {
    const rest = restScale(marker)
    const { camera, canvas } = this.host
    const h = canvas.clientHeight
    if (!(h > 0)) return rest
    const local = ringLocalDiameter(marker)
    const parent = this.parentScale((marker.parent as TransformNode | null) ?? null)
    const restWorld = local * rest * parent
    const d = Vector3.Distance(camera.position, marker.getAbsolutePosition())
    const floored = restWorld * ringScale(restWorld, d, camera.fov, h)
    let world = floored
    if (grow) {
      const want = Math.max(floored, labelScale(d, HIGHLIGHT_PX, camera.fov, h))
      world = d < CLOSE_M ? Math.max(floored, Math.min(want, restWorld * RING_MAX_GROW)) : want
    }
    return world / (local * parent)
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
          marker: inst.portMarkers.get(port),
          label: own(`portlabel:${inst.instanceId}:${port}`),
        }
      })
      this.entries.set(inst, list)
    }
    return list
  }

  private parentScale(root: TransformNode | null): number {
    const s = root?.absoluteScaling?.x
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
      // The marker is a flat ring on the connector's face: seen from either side, pulled toward the camera (as DeviceSpawner's own).
      m.backFaceCulling = false
      m.zOffset = -2
      this.materials.set(kind, m)
    }
    return m
  }

  /** Apply the hover / marks to the markers (`full`: also put back the ones no longer marked). */
  private restyle(full: boolean): void {
    if (!this.hover && !this.marks && this.styled.size === 0) return
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
        marker.scaling.setAll(this.ringTarget(marker, false))
      } else {
        marker.visibility = 1
        if (w.kind) marker.material = this.material(w.kind)
        marker.scaling.setAll(this.ringTarget(marker, w.grow))
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
    m.scaling.setAll(this.ringTarget(m, false))
    m.computeWorldMatrix(true)
  }

  private unstyleAll(): void {
    for (const m of [...this.styled.keys()]) this.unstyle(m)
  }
}
