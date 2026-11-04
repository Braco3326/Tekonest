/**
 * assets3d/placement: turns an asset spec into positions in GLB file space (metres, pivot bottom-centre).
 * Pure, no fs: the builder and the extras writer call it, the tests pin the face mapping.
 *
 * Handedness (decision R9): the placement is in GLB file space. Babylon's glTF loader mirrors Z, and the app
 * wants the I/O face at Babylon -Z, so in the GLB the 'io' face sits at z=+d/2 (and 'opposite' at z=-d/2).
 * Face-local coordinates (xMm, yMm) have their origin at the bottom-left of the face seen from OUTSIDE, x right, y up.
 * With w, h, d the real size in metres and (x, y) the face-local position in metres:
 *   io        z=+d/2   x_w = x - w/2   y_w = y        outward (0, 0, +1)
 *   opposite  z=-d/2   x_w = w/2 - x   y_w = y        outward (0, 0, -1)
 *   top       y_w=h    x_w = x - w/2   z_w = d/2 - y  outward (0, +1, 0)
 *   bottom    y_w=0    x_w = w/2 - x   z_w = d/2 - y  outward (0, -1, 0)
 *   left      x_w=-w/2 y_w = y         z_w = -d/2 + x outward (-1, 0, 0)
 *   right     x_w=+w/2 y_w = y         z_w = d/2 - x  outward (+1, 0, 0)
 */
import type { AssetExtrasV1 } from '../../src/scene/assetExtras'
import type { AssetSpecT, FaceT } from './specSchema'

type Vec3 = [number, number, number]
interface SizeM { w: number; h: number; d: number }

export interface PlacedPort {
  /** Node name in the GLB: port_<portId>. */
  name: string
  pos: Vec3
  outward: Vec3
  /** Diameter of the port opening in metres, when the spec gives it (R3). */
  openingM?: number
  /** How far behind the bounding-box face the port sits, in metres (spec insetMm); absent = on the face plane. */
  insetM?: number
}

export interface PlacedControl {
  /** Node name in the GLB: ctrl_<controlId>. */
  name: string
  pos: Vec3
  axis: 'x' | 'y' | 'z'
  kind: string
  sizeM: SizeM
  travelM?: number
}

export interface Placement {
  sizeM: SizeM
  ports: PlacedPort[]
  controls: PlacedControl[]
}

const mmToM = (mm: number): number => mm / 1000

/** Position and outward normal of the face-local point (x, y) metres on `face` of a casing of size `s`. */
function onFace(face: FaceT, x: number, y: number, s: SizeM): { pos: Vec3; outward: Vec3 } {
  const { w, h, d } = s
  switch (face) {
    case 'io': return { pos: [x - w / 2, y, d / 2], outward: [0, 0, 1] }
    case 'opposite': return { pos: [w / 2 - x, y, -d / 2], outward: [0, 0, -1] }
    case 'top': return { pos: [x - w / 2, h, d / 2 - y], outward: [0, 1, 0] }
    case 'bottom': return { pos: [w / 2 - x, 0, d / 2 - y], outward: [0, -1, 0] }
    case 'left': return { pos: [-w / 2, y, -d / 2 + x], outward: [-1, 0, 0] }
    case 'right': return { pos: [w / 2, y, d / 2 - x], outward: [1, 0, 0] }
  }
}

/** Placement of every port and control of a spec in GLB space. A connector spec has no ports or controls, only its size. */
export function buildPlacement(spec: AssetSpecT): Placement {
  const sizeM: SizeM = { w: mmToM(spec.realSizeMm.w), h: mmToM(spec.realSizeMm.h), d: mmToM(spec.realSizeMm.d) }
  if (spec.kind === 'connector') return { sizeM, ports: [], controls: [] }

  const ports = spec.ports.map((p): PlacedPort => {
    const { pos: onPlane, outward } = onFace(p.face, mmToM(p.xMm), mmToM(p.yMm), sizeM)
    const inset = p.insetMm !== undefined && p.insetMm > 0 ? mmToM(p.insetMm) : 0
    const pos: Vec3 = [onPlane[0] - outward[0] * inset, onPlane[1] - outward[1] * inset, onPlane[2] - outward[2] * inset]
    const placed: PlacedPort = { name: `port_${p.portId}`, pos, outward }
    if (inset > 0) placed.insetM = inset
    if (p.openingMm !== undefined) placed.openingM = mmToM(p.openingMm)
    return placed
  })

  const controls = spec.controls.map((c): PlacedControl => {
    const { pos } = onFace(c.face, mmToM(c.xMm), mmToM(c.yMm), sizeM)
    const placed: PlacedControl = {
      name: `ctrl_${c.controlId}`,
      pos,
      axis: c.axis,
      kind: c.kind,
      sizeM: { w: mmToM(c.sizeMm.w), h: mmToM(c.sizeMm.h), d: mmToM(c.sizeMm.d) },
    }
    if (c.travelMm !== undefined) placed.travelM = mmToM(c.travelMm)
    return placed
  })

  return { sizeM, ports, controls }
}

/** The `extras` object written on the GLB root node: the spec's ids joined to the placed positions. */
export function toExtras(spec: AssetSpecT, placement: Placement): AssetExtrasV1 {
  return {
    schema: 1,
    realSizeMm: { ...spec.realSizeMm },
    ports: spec.ports.map((p, i) => ({ portId: p.portId, pos: [...placement.ports[i].pos] as Vec3 })),
    controls: spec.controls.map((c, i) => ({
      controlId: c.controlId,
      pos: [...placement.controls[i].pos] as Vec3,
      axis: c.axis,
      kind: c.kind,
    })),
  }
}
