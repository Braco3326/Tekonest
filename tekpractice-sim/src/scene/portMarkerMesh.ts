/**
 * Port marker mesh: a thin flat OUTLINE RING (an annulus in the XY plane, facing -Z like the device's rear) instead of the old
 * 50 mm opaque disc, so a marker sits around its connector and no longer hides it. 32 segments = 64 triangles, no fill.
 *
 * Pure geometry (`ringVertexData`) plus one Babylon call (`createMarkerRing`). The material is the caller's: it must be double
 * sided (`backFaceCulling = false`) and may carry a small `zOffset`, since the ring lies on the connector's face.
 */
import { Color3, Matrix, Mesh, Quaternion, Ray, StandardMaterial, Vector3, VertexData, type AbstractMesh, type Scene } from '@babylonjs/core'
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

// ── The glow of a compatible port ────────────────────────────────────────────────────────────────────────────────────────────────
// Babylon's renderOutline extrudes a mesh along its normals; a flat ring has the same normal (-Z) everywhere, so the "outline" came out as a copy
// pushed toward the camera (a doubled, shifted ring when seen at an angle) and never as a halo. A halo is instead a second, wider flat annulus, a child
// of the ring (it scales, lifts and turns with it) lying a hair behind it, drawn with a translucent emissive colour.

/** A soft band around the ring: from 85 % of the ring's inner radius to 125 % of its outer radius (flat, in the XY plane, normals toward -Z). */
export function haloVertexData(outerM: number): VertexData {
  const ring = ringVertexData(outerM)
  const outer = Number.isFinite(outerM) && outerM > 0 ? outerM : (FALLBACK_MM * RING_OVERSIZE) / 1000
  const rOut = outer / 2
  let rIn = rOut
  for (let i = 0; i < ring.positions!.length; i += 3) rIn = Math.min(rIn, Math.hypot(ring.positions![i], ring.positions![i + 1]))
  const a = rIn * 0.85
  const b = rOut * 1.25
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const t = (i / RING_SEGMENTS) * Math.PI * 2
    positions.push(Math.cos(t) * b, Math.sin(t) * b, 0, Math.cos(t) * a, Math.sin(t) * a, 0)
    normals.push(0, 0, -1, 0, 0, -1)
    const o0 = 2 * i
    const o1 = 2 * ((i + 1) % RING_SEGMENTS)
    indices.push(o0, o1, o0 + 1, o0 + 1, o1, o1 + 1)
  }
  const vd = new VertexData()
  vd.positions = positions
  vd.normals = normals
  vd.indices = indices
  return vd
}

/** How far behind its ring the halo lies (m): under the ring in depth, so the ring itself stays crisp on top. */
export const HALO_BEHIND_M = 0.0004

/** The halo of `ring` in `colour` (translucent, emissive, double sided, not pickable); a child of the ring, so it goes with it, scale and dispose included. */
export function attachMarkerHalo(scene: Scene, ring: Mesh, colour: Color3): Mesh {
  const halo = new Mesh(`${ring.name}:halo`, scene)
  // the ring's own outer diameter, from its bounds at scale 1 (a lifted or turned ring has the same extents)
  const outer = ring.getBoundingInfo().boundingBox.extendSize.x * 2
  haloVertexData(outer).applyToMesh(halo)
  const mat = new StandardMaterial(`${ring.name}:halo-mat`, scene)
  mat.disableLighting = true
  mat.emissiveColor = colour
  mat.alpha = 0.55
  mat.backFaceCulling = false
  mat.zOffset = -1
  halo.material = mat
  halo.isPickable = false
  halo.parent = ring
  halo.position.z = HALO_BEHIND_M
  halo.onDisposeObservable.add(() => mat.dispose())
  return halo
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
/** The probe rays around the ring start this far OUTSIDE its circle (m): a ring that fits inside a pocket's opening (the audit shrank the rings to the connector, a 23 mm XLR ring in a 24 mm hole) still finds the face around it. */
const PROBE_BEYOND_M = 0.008

/**
 * How far OUTWARD (m) the surface around a port is from the port's own plane, 0 when the port is on a flat surface. Probe rays are cast
 * back toward the port from `PROBE_M` in front of it: one down the middle (it lands on the pocket floor, or on the plain surface) and
 * four on the ring's circle at the plane axes (8 mm beyond the ring: they land on the surrounding face, or still on the floor when the opening is wider than that on
 * that axis). Per axis the drop is the SMALLER of its two probes (a face on BOTH sides); the lift is the LARGER of the two axes. So a ring that
 * clears the opening on one axis only (a 24 mm ring on the 25 x 17 mm outlet of a power strip: it crosses the top and bottom edges, not the sides)
 * still comes out onto the face, a ring that lies wholly inside a big opening stays on the floor, and one open side (no surface there at all)
 * gives 0.
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
  const r = (Number.isFinite(outerM) && outerM > 0 ? outerM : 0.025) / 2 + PROBE_BEYOND_M
  let lift = 0
  for (const axis of [right, up]) {
    const a = probe(port.add(axis.scale(r)))
    const b = probe(port.add(axis.scale(-r)))
    if (a === null || b === null) return 0
    lift = Math.max(lift, Math.min(middle - a, middle - b))
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

// ── A port on a side or the base: the ring turns to face it ──────────────────────────────────────────────────────────────────────
// The ring is built in the XY plane and faces -Z, the rear: right for every io / opposite port (it is drawn on both sides). A port on a SIDE
// face (the Scoopy+ S's XLR and headphone jack on its right side) or on the BASE of a mic would show its ring edge-on, a thin line.

/**
 * The outward unit normal (+X / -X / +Y / -Y, in the frame of `lo` / `hi`) of the side or base face a port sits on, or null for a port on a
 * rear / front face (+Z / -Z: the ring already faces it), inside the body or where no face is within `tolM`. A port within `tolM` of a Z
 * face is a rear port whatever its other coordinates (a port in a pocket is further in than that and is a Z-face port by its position too).
 */
export function markerFaceNormal(local: Vector3, lo: Vector3, hi: Vector3, tolM = 0.002): Vector3 | null {
  if (!(Number.isFinite(local.x + local.y + local.z) && Number.isFinite(lo.x + lo.y + lo.z) && Number.isFinite(hi.x + hi.y + hi.z))) return null
  if (local.z - lo.z <= tolM || hi.z - local.z <= tolM) return null
  const cands: [number, Vector3][] = [
    [hi.x - local.x, new Vector3(1, 0, 0)],
    [local.x - lo.x, new Vector3(-1, 0, 0)],
    [hi.y - local.y, new Vector3(0, 1, 0)],
    [local.y - lo.y, new Vector3(0, -1, 0)],
  ]
  let best: [number, Vector3] | null = null
  for (const c of cands) if (c[0] <= tolM && (best === null || c[0] < best[0])) best = c
  return best ? best[1] : null
}

/** Turn a marker ring so that it faces `normal` (a unit vector in its parent's frame); null puts it back to facing -Z. Position and scale are untouched. */
export function orientMarkerRing(marker: Mesh, normal: Vector3 | null): void {
  if (!normal) {
    marker.rotationQuaternion = null
    marker.rotation.set(0, 0, 0)
    return
  }
  const q = new Quaternion()
  Quaternion.FromUnitVectorsToRef(new Vector3(0, 0, -1), normal.normalizeToNew(), q)
  marker.rotationQuaternion = q
}
