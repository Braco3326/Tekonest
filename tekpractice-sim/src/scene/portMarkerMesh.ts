/**
 * Port marker mesh: a thin flat OUTLINE RING (an annulus in the XY plane, facing -Z like the device's rear) instead of the old
 * 50 mm opaque disc, so a marker sits around its connector and no longer hides it. 32 segments = 64 triangles, no fill.
 *
 * Pure geometry (`ringVertexData`) plus one Babylon call (`createMarkerRing`). The material is the caller's: it must be double
 * sided (`backFaceCulling = false`) and may carry a small `zOffset`, since the ring lies on the connector's face.
 */
import { Matrix, Mesh, Ray, VertexData, type AbstractMesh, type Scene, type Vector3 } from '@babylonjs/core'
import { FALLBACK_MM, RING_OVERSIZE } from './portMarkerSize'

/** Segments around the ring. */
export const RING_SEGMENTS = 32
/** The ring's width as a share of its outer diameter. */
export const RING_THICKNESS = 0.12
/** The ring is never narrower than this (m), so a small ring still draws a visible line. */
export const RING_MIN_WIDTH_M = 0.0012

/**
 * A flat annulus in the XY plane, centred on the origin, normals toward -Z. Outer radius = outerM / 2, width =
 * max(thickness x outerM, 1.2 mm). A non-positive or non-finite size falls back to the fallback connector's ring.
 */
export function ringVertexData(outerM: number, thickness = RING_THICKNESS): VertexData {
  const outer = Number.isFinite(outerM) && outerM > 0 ? outerM : (FALLBACK_MM * RING_OVERSIZE) / 1000
  const k = Number.isFinite(thickness) && thickness > 0 ? thickness : RING_THICKNESS
  const rOut = outer / 2
  const width = Math.min(Math.max(k * outer, RING_MIN_WIDTH_M), rOut * 0.9)
  const rIn = rOut - width
  const positions: number[] = []
  const normals: number[] = []
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a = (i / RING_SEGMENTS) * Math.PI * 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    positions.push(c * rOut, s * rOut, 0, c * rIn, s * rIn, 0) // vertex 2i = outer, 2i + 1 = inner
    normals.push(0, 0, -1, 0, 0, -1)
  }
  const indices: number[] = []
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const o0 = 2 * i
    const i0 = o0 + 1
    const o1 = (2 * ((i + 1) % RING_SEGMENTS))
    const i1 = o1 + 1
    indices.push(o0, o1, i0, i0, o1, i1)
  }
  const vd = new VertexData()
  vd.positions = positions
  vd.normals = normals
  vd.indices = indices
  return vd
}

/** The marker ring as a mesh named `name` (not pickable: the invisible pick sphere takes the clicks). */
export function createMarkerRing(scene: Scene, name: string, outerM: number): Mesh {
  const mesh = new Mesh(name, scene)
  ringVertexData(outerM).applyToMesh(mesh)
  mesh.isPickable = false
  return mesh
}

// ── Sitting on the surface: a connector in a pocket ──────────────────────────────────────────────────────────────────────────────
// A port's empty sits on the FLOOR of a recess when the spec gives an `insetMm` (speakers: the amplifier plate's IEC / XLR pockets, 14 to 39
// mm deep). A flat ring left there would be hidden behind the panel (the old 50 mm disc stuck out of the pocket by its 10 mm half height).
// The marker therefore asks the model where the surrounding surface is and lifts its ring (geometry only: the marker's position, which the
// cables use, stays on the port).

/** How far in front of the port the probe rays start (m). */
const PROBE_M = 0.1
/** Anything outside this lift range is not a pocket (noise below, or a different part of the body above): the ring stays where it is. */
export const LIFT_MIN_M = 0.0005
export const LIFT_MAX_M = 0.06
/** The probe rays around the ring, as a share of its outer radius. */
const PROBE_RING = 0.95

/**
 * How far OUTWARD (m) the surface around a port is from the port's own plane, 0 when the port is on a flat surface. Probe rays are cast
 * back toward the port from `PROBE_M` in front of it: one down the middle (it lands on the pocket floor, or on the plain surface) and
 * four on the ring's circle at the plane axes (they land on the surrounding face). The lift is the SMALLEST drop the four see over the
 * middle one, so a curved body (a mic tube) or one open side gives 0 and only a real recess gives its depth.
 * `outward` is the unit direction the marker faces; `right` / `up` its in-plane unit axes (all world space).
 */
export function surfaceLiftM(meshes: readonly AbstractMesh[], port: Vector3, outward: Vector3, right: Vector3, up: Vector3, outerM: number): number {
  const probe = (at: Vector3): number | null => {
    const ray = new Ray(at.add(outward.scale(PROBE_M)), outward.scale(-1), PROBE_M * 2)
    let best: number | null = null
    for (const m of meshes) {
      if (m.isDisposed() || !m.isEnabled() || m.getTotalVertices() === 0) continue
      const hit = ray.intersectsMesh(m)
      if (hit.hit && (best === null || hit.distance < best)) best = hit.distance
    }
    return best
  }
  const middle = probe(port)
  if (middle === null) return 0
  const r = (Number.isFinite(outerM) && outerM > 0 ? outerM : 0.025) / 2 * PROBE_RING
  let lift = Infinity
  for (const dir of [right, right.scale(-1), up, up.scale(-1)]) {
    const t = probe(port.add(dir.scale(r)))
    if (t === null) return 0
    lift = Math.min(lift, middle - t)
  }
  return lift >= LIFT_MIN_M && lift <= LIFT_MAX_M ? lift : 0
}

/** Move a marker ring `liftM` outward (toward -Z) from where it was built, by its vertices: its position, scale and bounds extents do not change. */
export function liftMarkerRing(marker: Mesh, liftM: number): void {
  const had = typeof marker.metadata?.lift === 'number' ? (marker.metadata.lift as number) : 0
  const delta = (Number.isFinite(liftM) && liftM > 0 ? liftM : 0) - had
  if (Math.abs(delta) < 1e-9) return
  marker.bakeTransformIntoVertices(Matrix.Translation(0, 0, -delta))
  marker.metadata = { ...(marker.metadata ?? {}), lift: had + delta }
}
