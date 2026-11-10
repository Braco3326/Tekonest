/**
 * Port marker mesh: a thin flat OUTLINE RING (an annulus in the XY plane, facing -Z like the device's rear) instead of the old
 * 50 mm opaque disc, so a marker sits around its connector and no longer hides it. 32 segments = 64 triangles, no fill.
 *
 * Pure geometry (`ringVertexData`) plus one Babylon call (`createMarkerRing`). The material is the caller's: it must be double
 * sided (`backFaceCulling = false`) and may carry a small `zOffset`, since the ring lies on the connector's face.
 */
import { Mesh, VertexData, type Scene } from '@babylonjs/core'
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
