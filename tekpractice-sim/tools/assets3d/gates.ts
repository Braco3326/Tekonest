/**
 * assets3d/gates: the pass/fail checks a built GLB must clear before it ships. Pure functions over a GlbReport
 * (tools/assets3d/inspect.ts), the asset spec and its placement; no fs. Every gate returns a GateResult and
 * `runGates` runs all five asset gates without short-circuiting, so a report shows every failure at once. The sixth
 * and seventh results, `proportionDrift` and `textures`, are added by the orchestrator (the first needs the fix-up's
 * pre-scale size, the second only makes sense on the final shipped bytes).
 *
 * The report is in GLB file space (io face at +Z, see placement.ts), world metres. Lengths in the `detail`
 * strings are printed in millimetres for humans. Tolerances (all in this file, nowhere else):
 *   size            per axis |measured - spec| <= max(0.5 mm, 0.5 % of the spec size)
 *   pivot           0.5 mm (device: bottom-centre; connector: centre of the mating face, body along +Z)
 *   scale/rotation  1e-6 (scale 1, identity quaternion, q and -q are the same rotation)
 *   port positions  0.3 mm from the placement; 0.2 mm from the real face plane of the measured body (R4)
 *   budget          triangles <= 800 (connector) / 4000 (standard, hero), ceilings with no floor; one material (R5)
 *   connector fit   the plug is 0 to 0.3 mm under the socket opening
 *   proportion      the pre-scale model's proportions drift at most 5 % from the spec's
 *   textures        longest texture side <= 512 px (connector) / 1024 px (standard, hero); file <= 250 kB / 1.5 MB (near-lossless data maps)
 * Every gate fails closed: a non-finite input (NaN, Infinity) fails with a detail saying which value, and each
 * tolerance test is written `!(x <= tol)` so that a NaN that slipped through still fails.
 */
import type { GlbReport } from './inspect'
import type { Placement } from './placement'
import type { AssetSpecT } from './specSchema'

export interface GateResult {
  gate: string
  ok: boolean
  detail: string
}

type Vec3 = [number, number, number]
interface SizeM { w: number; h: number; d: number }

const AXES = ['x', 'y', 'z'] as const
const SIZE_FLOOR_M = 0.0005
const SIZE_FRACTION = 0.005
const PIVOT_TOL_M = 0.0005
const UNIT_TOL = 1e-6
const PORT_TOL_M = 0.0003
const FACE_PLANE_TOL_M = 0.0002
const FIT_UNDER_MM = 0.3
const DRIFT_LIMIT = 0.05
const MAX_MATERIALS = 1
/** Triangle ceiling by tier (R5): the budget gate enforces it, the builder derives the Meshy target from it. */
export const TRIANGLE_CEILING = { connector: 800, standard: 4000, hero: 4000 } as const
/** Longest texture side, in pixels, by tier: the texture step downsizes to this, the textures gate enforces it. */
export const TEXTURE_MAX_PX = { connector: 512, standard: 1024, hero: 1024 } as const
/** Shipped file size ceiling, in bytes, by tier (the whole GLB: geometry, textures and JSON). */
export const FILE_BYTES_MAX = { connector: 250_000, standard: 1_500_000, hero: 1_500_000 } as const
/** Float noise only: a port exactly on the edge of the face rectangle is inside it. */
const EDGE_SLACK_M = 1e-6
/** Slack under which two lengths count as equal at a tolerance boundary (a micrometre fraction of float noise). */
const EPS_M = 1e-9

const mm = (m: number): string => (m * 1000).toFixed(2)
const fmtVec = (v: ArrayLike<number>): string => `(${Array.from(v, mm).join(', ')})`
const finite = (v: ArrayLike<number>): boolean => Array.from(v).every(Number.isFinite)
const bboxFinite = (r: GlbReport): boolean => finite(r.bboxM.min) && finite(r.bboxM.max)
const result = (gate: string, problems: string[], okDetail: string): GateResult =>
  problems.length === 0 ? { gate, ok: true, detail: okDetail } : { gate, ok: false, detail: problems.join('; ') }

/** The spec size as a vector in (w, h, d) = (x, y, z) order, in metres. */
function specSizeM(spec: AssetSpecT): Vec3 {
  return [spec.realSizeMm.w / 1000, spec.realSizeMm.h / 1000, spec.realSizeMm.d / 1000]
}

/** Measured bbox extents of the world bbox, (x, y, z) in metres. */
function extents(report: GlbReport): Vec3 {
  const { min, max } = report.bboxM
  return [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
}

/** Size gate: each axis of the measured world bbox matches the spec within max(0.5 mm, 0.5 % of the spec size). */
export function checkSize(report: GlbReport, spec: AssetSpecT): GateResult {
  const wanted = specSizeM(spec)
  if (!bboxFinite(report)) return { gate: 'size', ok: false, detail: 'the bbox is not finite (NaN or Infinity)' }
  if (!finite(wanted)) return { gate: 'size', ok: false, detail: 'the spec size is not finite' }
  const measured = extents(report)
  const labels = ['w', 'h', 'd']
  const problems: string[] = []
  for (let i = 0; i < 3; i++) {
    const tol = Math.max(SIZE_FLOOR_M, SIZE_FRACTION * wanted[i])
    if (!(Math.abs(measured[i] - wanted[i]) <= tol + EPS_M)) {
      problems.push(`${labels[i]} measures ${mm(measured[i])} mm, spec ${mm(wanted[i])} mm (off by ${mm(Math.abs(measured[i] - wanted[i]))} mm, tolerance ${mm(tol)} mm)`)
    }
  }
  return result('size', problems, `${fmtVec(measured)} mm matches the spec ${fmtVec(wanted)} mm`)
}

/** True when `q` is the identity rotation; q and -q are the same rotation. */
function isIdentityRotation(q: ArrayLike<number>): boolean {
  const near = (sign: number): boolean => Math.abs(q[0]) <= UNIT_TOL && Math.abs(q[1]) <= UNIT_TOL && Math.abs(q[2]) <= UNIT_TOL && Math.abs(q[3] - sign) <= UNIT_TOL
  return near(1) || near(-1)
}

/**
 * Transform gate: one top-level node, scale 1 (never negative), identity rotation, and the pivot where the spec kind
 * wants it. A device (R6) sits bottom-centre: bbox min y = 0 and the bbox centre x, z = 0. A connector's pivot is the
 * centre of its mating face: bbox min z = 0 and the bbox centre x, y = 0, the body extending along +Z.
 */
export function checkTransform(report: GlbReport, spec: AssetSpecT): GateResult {
  const problems: string[] = []
  if (report.topLevelCount !== 1) problems.push(`${report.topLevelCount} top-level nodes, expected exactly 1`)

  if (!finite(report.rootScale)) problems.push(`root scale is not finite (${report.rootScale.join(', ')})`)
  else if (report.rootScale.some((s) => s < 0)) problems.push(`negative root scale (${report.rootScale.join(', ')})`)
  else if (report.rootScale.some((s) => !(Math.abs(s - 1) <= UNIT_TOL))) problems.push(`root scale is (${report.rootScale.join(', ')}), expected (1, 1, 1): apply the scale`)

  if (!finite(report.rootRotation)) problems.push(`root rotation is not finite (${report.rootRotation.join(', ')})`)
  else if (!isIdentityRotation(report.rootRotation)) problems.push(`root rotation is (${report.rootRotation.join(', ')}), expected identity: apply the rotation`)

  if (!bboxFinite(report)) {
    problems.push('the bbox is not finite (NaN or Infinity), the pivot cannot be checked')
    return result('transform', problems, '')
  }
  const { min, max } = report.bboxM
  const centre = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  const off = (v: number): boolean => !(Math.abs(v) <= PIVOT_TOL_M + EPS_M)
  if (spec.kind === 'device') {
    if (off(min[1])) problems.push(`pivot not at the bottom: bbox min y is ${mm(min[1])} mm, expected 0`)
    if (off(centre[0]) || off(centre[2])) problems.push(`pivot not centred: bbox centre x, z is (${mm(centre[0])}, ${mm(centre[2])}) mm, expected (0, 0)`)
  } else {
    if (off(min[2])) problems.push(`pivot not at the mating face: bbox min z is ${mm(min[2])} mm, expected 0 (body along +Z)`)
    if (off(centre[0]) || off(centre[1])) problems.push(`pivot not at the mating-face centre: bbox centre x, y is (${mm(centre[0])}, ${mm(centre[1])}) mm, expected (0, 0)`)
  }
  const pivot = spec.kind === 'device' ? 'bottom-centre' : 'mating-face centre'
  return result('transform', problems, `one root, scale 1, identity rotation, pivot at the ${pivot}`)
}

const PART_PREFIX = /^(port_|ctrl_)/
const STRAY_NAME = /^(Cube|Camera|Light)/i
/** The exporter's duplicate suffix, exactly three digits: a legitimate id such as out-6.35 is not rejected. */
const NUMERIC_SUFFIX = /\.\d{3}$/

/**
 * Parts gate (R4): the node names starting with port_ or ctrl_ are exactly the placement's port and control names
 * (missing, extra and duplicated all fail), no node is a leftover (Cube, Camera, Light) or carries a numeric
 * suffix such as `.001`. The root and mesh nodes are otherwise free.
 */
export function checkParts(report: GlbReport, placement: Placement): GateResult {
  const expected = [...placement.ports.map((p) => p.name), ...placement.controls.map((c) => c.name)]
  const found = report.nodeNames.filter((n) => PART_PREFIX.test(n))
  const problems: string[] = []

  const missing = expected.filter((n) => !found.includes(n))
  if (missing.length > 0) problems.push(`missing: ${missing.join(', ')}`)
  const extra = [...new Set(found.filter((n) => !expected.includes(n)))]
  if (extra.length > 0) problems.push(`extra port_/ctrl_ nodes: ${extra.join(', ')}`)
  const duplicated = [...new Set(found.filter((n, i) => found.indexOf(n) !== i))]
  if (duplicated.length > 0) problems.push(`duplicated: ${duplicated.join(', ')}`)

  const stray = report.nodeNames.filter((n) => STRAY_NAME.test(n))
  if (stray.length > 0) problems.push(`stray node: ${stray.join(', ')}`)
  const suffixed = report.nodeNames.filter((n) => NUMERIC_SUFFIX.test(n))
  if (suffixed.length > 0) problems.push(`numeric suffix on: ${suffixed.join(', ')}`)

  return result('parts', problems, `${expected.length} port/control nodes match the placement exactly`)
}

/**
 * Port-position gate. Every port and control node is within 0.3 mm of its placement position. Every port also lies on
 * the face plane of the ACTUAL body (the measured bbox extreme along its outward axis, within 0.2 mm) and inside the
 * face rectangle (its other two coordinates within the bbox range), so a port cannot float or sink while the placement
 * still agrees with it. A node missing from the report fails.
 */
export function checkPortPositions(report: GlbReport, placement: Placement): GateResult {
  const problems: string[] = []
  if (!bboxFinite(report)) return { gate: 'portPositions', ok: false, detail: 'the bbox is not finite (NaN or Infinity)' }
  const { min, max } = report.bboxM
  const byName = new Map(report.nodes.map((n) => [n.name, n.worldPos]))
  const wanted = [
    ...placement.ports.map((p) => ({ name: p.name, pos: p.pos, outward: p.outward as Vec3 | undefined })),
    ...placement.controls.map((c) => ({ name: c.name, pos: c.pos, outward: undefined as Vec3 | undefined })),
  ]

  for (const w of wanted) {
    const actual = byName.get(w.name)
    if (!actual) {
      problems.push(`${w.name} is not in the model`)
      continue
    }
    if (!finite(actual) || !finite(w.pos)) {
      problems.push(`${w.name} position is not finite (${actual.join(', ')})`)
      continue
    }
    const dist = Math.hypot(actual[0] - w.pos[0], actual[1] - w.pos[1], actual[2] - w.pos[2])
    if (!(dist <= PORT_TOL_M + EPS_M)) {
      problems.push(`${w.name} is at ${fmtVec(actual)} mm, placement ${fmtVec(w.pos)} mm (off by ${mm(dist)} mm, tolerance ${mm(PORT_TOL_M)} mm)`)
    }
    if (!w.outward) continue

    const axis = w.outward.findIndex((c) => c !== 0)
    const face = w.outward[axis] > 0 ? max[axis] : min[axis]
    const planeOff = Math.abs(actual[axis] - face)
    if (!(planeOff <= FACE_PLANE_TOL_M + EPS_M)) {
      problems.push(`${w.name} is off the face plane: ${AXES[axis]} = ${mm(actual[axis])} mm, the body face is at ${mm(face)} mm (off by ${mm(planeOff)} mm, tolerance ${mm(FACE_PLANE_TOL_M)} mm)`)
    }
    for (let k = 0; k < 3; k++) {
      if (k === axis) continue
      if (!(actual[k] >= min[k] - EDGE_SLACK_M && actual[k] <= max[k] + EDGE_SLACK_M)) {
        problems.push(`${w.name} is outside the face rectangle: ${AXES[k]} = ${mm(actual[k])} mm, the body spans ${mm(min[k])} to ${mm(max[k])} mm`)
      }
    }
  }
  return result('portPositions', problems, `${wanted.length} port/control nodes within ${mm(PORT_TOL_M)} mm of the placement, ports on the face plane`)
}

/** Budget gate (R5): triangle count is a ceiling by tier (connector 800, standard and hero 4000), no floor; at most one material. */
export function checkBudget(report: GlbReport, spec: AssetSpecT): GateResult {
  const ceiling = TRIANGLE_CEILING[spec.tier]
  const problems: string[] = []
  if (!Number.isFinite(report.triangles)) problems.push(`triangles count is not finite (${report.triangles})`)
  else if (!(report.triangles <= ceiling)) problems.push(`${report.triangles} triangles exceeds the ${spec.tier} ceiling of ${ceiling}`)
  if (!Number.isFinite(report.materials)) problems.push(`materials count is not finite (${report.materials})`)
  else if (!(report.materials <= MAX_MATERIALS)) problems.push(`${report.materials} materials, at most ${MAX_MATERIALS} allowed`)
  return result('budget', problems, `${report.triangles} triangles (ceiling ${ceiling}), ${report.materials} material${report.materials === 1 ? '' : 's'}`)
}

/**
 * Textures gate: on the FINAL bytes, every texture's longest side is within the tier maximum (TEXTURE_MAX_PX) and the
 * whole file within the tier's FILE_BYTES_MAX. A model without textures only has its file size checked. Fails closed on a
 * missing or non-finite size, and lists every problem at once, naming the texture and the numbers.
 */
export function checkTextures(report: GlbReport, spec: AssetSpecT): GateResult {
  const maxPx = TEXTURE_MAX_PX[spec.tier]
  const maxBytes = FILE_BYTES_MAX[spec.tier]
  const problems: string[] = []

  if (!Number.isFinite(report.fileBytes)) problems.push(`the file size is not known (${String(report.fileBytes)})`)
  else if (!(report.fileBytes <= maxBytes)) problems.push(`file size budget exceeded: ${report.fileBytes} > ${maxBytes}`)

  if (!Array.isArray(report.textures)) problems.push('the texture list is missing')
  else {
    for (const t of report.textures) {
      if (!Number.isFinite(t.width) || !Number.isFinite(t.height) || !(t.width > 0) || !(t.height > 0)) {
        problems.push(`texture "${t.name}" has no usable size (${String(t.width)} x ${String(t.height)})`)
      } else if (!(Math.max(t.width, t.height) <= maxPx)) {
        problems.push(`texture "${t.name}" is ${t.width} x ${t.height} px, the longest side must be at most ${maxPx} px (${spec.tier})`)
      }
    }
  }
  const count = Array.isArray(report.textures) ? report.textures.length : 0
  return result('textures', problems, `${count} texture${count === 1 ? '' : 's'} within ${maxPx} px, file ${report.fileBytes} bytes (limit ${maxBytes})`)
}

/** Connector-fit gate: the plug's outer diameter is 0 to 0.3 mm under the socket's opening. */
export function checkConnectorFit(plug: AssetSpecT, socket: AssetSpecT): GateResult {
  const gate = 'connectorFit'
  const problems: string[] = []
  if (!plug.mating) problems.push(`${plug.id} has no mating block`)
  else if (plug.mating.role !== 'plug') problems.push(`${plug.id} has mating role ${plug.mating.role}, expected plug`)
  if (!socket.mating) problems.push(`${socket.id} has no mating block`)
  else if (socket.mating.role !== 'socket') problems.push(`${socket.id} has mating role ${socket.mating.role}, expected socket`)
  if (problems.length > 0) return { gate, ok: false, detail: problems.join('; ') }

  const outer = plug.mating?.outerMm
  const opening = socket.mating?.openingMm
  if (outer === undefined) problems.push(`${plug.id} mating.outerMm is missing`)
  if (opening === undefined) problems.push(`${socket.id} mating.openingMm is missing`)
  if (outer === undefined || opening === undefined) return { gate, ok: false, detail: problems.join('; ') }
  if (!Number.isFinite(outer)) problems.push(`${plug.id} mating.outerMm is not finite (${String(outer)})`)
  if (!Number.isFinite(opening)) problems.push(`${socket.id} mating.openingMm is not finite (${String(opening)})`)
  if (problems.length > 0) return { gate, ok: false, detail: problems.join('; ') }

  // Written `!(x <= y)` / `!(x >= y)` so that a NaN that slipped through still fails.
  const under = opening - outer
  if (!(under >= -EPS_M)) return { gate, ok: false, detail: `plug ${outer.toFixed(2)} mm is oversize for the ${opening.toFixed(2)} mm opening (${(-under).toFixed(2)} mm larger, it must be 0 to ${FIT_UNDER_MM} mm under)` }
  if (!(under <= FIT_UNDER_MM + EPS_M)) return { gate, ok: false, detail: `plug ${outer.toFixed(2)} mm is ${under.toFixed(2)} mm under the ${opening.toFixed(2)} mm opening (it must be 0 to ${FIT_UNDER_MM} mm under)` }
  return { gate, ok: true, detail: `plug ${outer.toFixed(2)} mm is ${under.toFixed(2)} mm under the ${opening.toFixed(2)} mm opening` }
}

/**
 * Proportion-drift gate: both size vectors, axis order (w, h, d), are normalised by their largest component; the drift
 * is the largest |normPre / normSpec - 1|, and it fails above 5 % (strictly). The fix-up step rotates the model into
 * the spec's axis order before measuring, so there is no permutation search here.
 */
export function checkProportionDrift(preScaleSizeM: SizeM, spec: AssetSpecT): GateResult {
  const gate = 'proportionDrift'
  const pre = [preScaleSizeM.w, preScaleSizeM.h, preScaleSizeM.d]
  const wanted = specSizeM(spec)
  if (!wanted.every((v) => Number.isFinite(v) && v > 0)) return { gate, ok: false, detail: `the spec size (${wanted.map(mm).join(', ')} mm) must be positive and finite on every axis` }
  const preMax = Math.max(...pre)
  if (!(preMax > 0) || pre.some((v) => !Number.isFinite(v) || v < 0)) return { gate, ok: false, detail: `the pre-scale size (${pre.join(', ')}) is degenerate or not finite` }

  const specMax = Math.max(...wanted)
  let drift = 0
  for (let i = 0; i < 3; i++) {
    drift = Math.max(drift, Math.abs((pre[i] / preMax) / (wanted[i] / specMax) - 1))
  }
  const percent = (drift * 100).toFixed(2)
  const detail = `proportions drift ${percent} % from the spec, limit ${DRIFT_LIMIT * 100} %`
  // Strictly greater than 5 % fails; the slack lets a mathematically exact 5 % pass despite float error.
  return { gate, ok: drift <= DRIFT_LIMIT + EPS_M, detail }
}

/** Runs the five asset gates in order (size, transform, parts, portPositions, budget). Never short-circuits. */
export function runGates(report: GlbReport, spec: AssetSpecT, placement: Placement): GateResult[] {
  return [
    checkSize(report, spec),
    checkTransform(report, spec),
    checkParts(report, placement),
    checkPortPositions(report, placement),
    checkBudget(report, spec),
  ]
}
