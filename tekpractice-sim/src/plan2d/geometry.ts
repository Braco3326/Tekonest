/**
 * Geometry of the 2D schema page (mission 2, spec §2): metres to pixels, snap, scale bar, footprints, port anchors, pan and zoom. Pure numbers.
 *
 * The plan is read like the room thumbnails (src/creation/roomPlanSvg.ts, the Face view of ADR-0011): the front wall (the stage, -z) at the top, the
 * audience (+z) at the bottom, world +x on the LEFT. Seen from the audience that left side is « jardin » and the right side « cour » (colour and
 * symbol sheet §1.4, a theatre convention). Device yaw is the 3D one: 0 = the front faces +z, its local front axis is (sin yaw, cos yaw) in x/z
 * (as src/creation/coverageLayer.ts aims a loudspeaker), so a plan and a later spawn into 3D agree.
 */
export const SNAP_STEPS_M = [0.1, 0.25, 0.5, 1] as const
export const DEFAULT_SNAP_M = 0.25
/** Pixels per metre, bounds of the zoom. */
export const MIN_SCALE = 8
export const MAX_SCALE = 400

const r4 = (v: number): number => {
  const r = Math.round(v * 1e4) / 1e4
  return Object.is(r, -0) ? 0 : r
}

/** The nearest multiple of `step` (metres). */
export const snap = (v: number, step: number): number => r4(Math.round(v / step) * step)

/** A view of the plan: `scale` px per metre, (cx, cz) the world point at the centre of a `w` x `h` px drawing. */
export interface View {
  scale: number
  cx: number
  cz: number
  w: number
  h: number
}

export const toScreen = (v: View, x: number, z: number): { sx: number; sy: number } => ({ sx: v.w / 2 + (v.cx - x) * v.scale, sy: v.h / 2 + (z - v.cz) * v.scale })
export const toWorld = (v: View, sx: number, sy: number): { x: number; z: number } => ({ x: v.cx - (sx - v.w / 2) / v.scale, z: v.cz + (sy - v.h / 2) / v.scale })

const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

/** The whole room in a `w` x `h` drawing with `margin` px round it, centred on the room. */
export function fitView(room: { width: number; length: number }, w: number, h: number, margin = 48): View {
  const sx = Math.max(1, w - 2 * margin) / Math.max(0.01, room.width)
  const sz = Math.max(1, h - 2 * margin) / Math.max(0.01, room.length)
  return { scale: clampScale(Math.min(sx, sz)), cx: 0, cz: 0, w, h }
}

/** Zoom by `factor` keeping the world point under (sx, sy) where it is. */
export function zoomAt(v: View, factor: number, sx: number, sy: number): View {
  const at = toWorld(v, sx, sy)
  const scale = clampScale(v.scale * factor)
  // solve toScreen(next, at) = (sx, sy) for the centre
  return { ...v, scale, cx: at.x + (sx - v.w / 2) / scale, cz: at.z - (sy - v.h / 2) / scale }
}

/** The drawing follows a pointer moved by (dsx, dsy) px. */
export const panBy = (v: View, dsx: number, dsy: number): View => ({ ...v, cx: v.cx + dsx / v.scale, cz: v.cz - dsy / v.scale })

const NICE_M = [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05] as const

/** The longest round length whose bar fits in `maxPx`, with its label (« 2 m », « 20 cm »). */
export function scaleBar(scale: number, maxPx = 160): { m: number; px: number; label: string } {
  const m = NICE_M.find((n) => n * scale <= maxPx) ?? NICE_M[NICE_M.length - 1]!
  const label = m >= 1 ? `${m} m` : `${Math.round(m * 100)} cm`
  return { m, px: r4(m * scale), label }
}

export interface Pose {
  x: number
  z: number
  rot: number
}
/** Width (local x) and depth (local z, front to rear) in metres. */
export interface Size2 {
  w: number
  d: number
}

/** A point of the device's own frame (lx across, lz toward its front) in world metres. */
export function localToWorld(p: Pose, lx: number, lz: number): { x: number; z: number } {
  const t = (p.rot * Math.PI) / 180
  const c = Math.cos(t)
  const s = Math.sin(t)
  return { x: p.x + lx * c + lz * s, z: p.z - lx * s + lz * c }
}

/** The four corners (rear left, rear right, front right, front left in the device's frame). */
export function footprintCorners(p: Pose, size: Size2): { x: number; z: number }[] {
  const hw = size.w / 2
  const hd = size.d / 2
  return [
    localToWorld(p, -hw, -hd),
    localToWorld(p, hw, -hd),
    localToWorld(p, hw, hd),
    localToWorld(p, -hw, hd),
  ]
}

export interface Bounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}
export function footprintBounds(p: Pose, size: Size2): Bounds {
  const c = footprintCorners(p, size)
  return { minX: Math.min(...c.map((q) => q.x)), maxX: Math.max(...c.map((q) => q.x)), minZ: Math.min(...c.map((q) => q.z)), maxZ: Math.max(...c.map((q) => q.z)) }
}

/** The footprint lies on the floor (the room's origin is its centre). */
export const insideRoom = (b: Bounds, room: { width: number; length: number }): boolean =>
  b.minX >= -room.width / 2 - 1e-9 && b.maxX <= room.width / 2 + 1e-9 && b.minZ >= -room.length / 2 - 1e-9 && b.maxZ <= room.length / 2 + 1e-9

/**
 * Where port `index` of `count` meets the outline: on the REAR edge (local -z, the side the rear panel faces), spread evenly in catalogue order
 * from local -x to +x (left to right for someone standing behind the device). A drawing aid: the real position on the panel is not read.
 */
export function portAnchor(p: Pose, size: Size2, index: number, count: number): { x: number; z: number } {
  const n = Math.max(1, count)
  const lx = -size.w / 2 + (size.w * (index + 0.5)) / n
  return localToWorld(p, lx, -size.d / 2)
}

/** The grid lines every `step` metres inside the floor (edges included). */
export function gridLines(room: { width: number; length: number }, step: number): { xs: number[]; zs: number[] } {
  const line = (half: number): number[] => {
    const out: number[] = []
    for (let k = Math.ceil(-half / step - 1e-9); k * step <= half + 1e-9; k++) out.push(r4(k * step))
    return out
  }
  return { xs: line(room.width / 2), zs: line(room.length / 2) }
}
