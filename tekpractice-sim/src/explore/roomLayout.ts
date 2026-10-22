/**
 * Procedural room layout from a TEK Brain room template (ADR-0010, master prompt
 * B3) — pure. Typical dimensions give the shell (width along x, length along z,
 * origin at the floor centre, z toward the audience); doors cut the walls; zones
 * may raise the floor (a stage you walk up onto). Windows are not cut (v1).
 * Wall names: front = −z (stage / far end), rear = +z, left = −x, right = +x;
 * an opening's offset runs along its wall from the wall centre.
 */
import type { Box } from './collision'

type Range = { min: number; typical: number; max: number }

export interface RoomTemplate {
  id: string
  name_fr: string
  dimensions_m: { length: Range; width: Range; height: Range }
  zones: { id: string; kind: string; rect_m: [number, number, number, number]; floor_y_m?: number }[]
  openings: { wall: 'front' | 'rear' | 'left' | 'right'; kind: string; offset_m: number; width_m: number; height_m: number }[]
  procedural: { wall_color: string; floor_color: string; ceiling_color: string; prop_hints: string[] }
  lighting: { mood: string; color_temp_k: number }
}

export interface WallSegment {
  wall: 'front' | 'rear' | 'left' | 'right'
  x0: number
  z0: number
  x1: number
  z1: number
  bottom: number
  top: number
}

export interface RoomLayout {
  width: number
  length: number
  height: number
  wallSegments: WallSegment[]
  colliders: Box[]
  zones: { id: string; kind: string; x: number; z: number; w: number; d: number; y: number }[]
  floorAt(x: number, z: number): number
  spawn: { x: number; z: number; yaw: number }
}

const THICK = 0.2
const WALLS = ['front', 'rear', 'left', 'right'] as const

export function roomLayout(room: RoomTemplate): RoomLayout {
  const width = room.dimensions_m.width.typical
  const length = room.dimensions_m.length.typical
  const height = room.dimensions_m.height.typical
  const hw = width / 2
  const hl = length / 2

  const wallSegments: WallSegment[] = []
  const colliders: Box[] = []
  for (const wall of WALLS) {
    const alongX = wall === 'front' || wall === 'rear'
    const half = alongX ? hw : hl
    const fixed = wall === 'front' ? -hl : wall === 'rear' ? hl : wall === 'left' ? -hw : hw
    const doors = room.openings
      .filter((o) => o.wall === wall && o.kind === 'door')
      .map((o) => ({ a: Math.max(-half, o.offset_m - o.width_m / 2), b: Math.min(half, o.offset_m + o.width_m / 2), h: o.height_m }))
      .filter((d) => d.b > d.a)
      .sort((p, q) => p.a - q.a)
    const seg = (a: number, b: number, bottom: number): WallSegment =>
      alongX
        ? { wall, x0: a, z0: fixed, x1: b, z1: fixed, bottom, top: height }
        : { wall, x0: fixed, z0: a, x1: fixed, z1: b, bottom, top: height }
    let cursor = -half
    for (const d of doors) {
      if (d.a > cursor) wallSegments.push(seg(cursor, d.a, 0))
      wallSegments.push(seg(d.a, d.b, Math.min(d.h, height)))
      cursor = Math.max(cursor, d.b)
    }
    if (cursor < half) wallSegments.push(seg(cursor, half, 0))
  }

  for (const s of wallSegments) {
    if (s.bottom > 0) continue // lintels: walk under them
    // The collider sits just OUTSIDE the wall line, 0.2 m thick.
    const out = s.wall === 'front' || s.wall === 'left' ? -THICK : THICK
    if (s.wall === 'front' || s.wall === 'rear') {
      const zA = Math.min(s.z0, s.z0 + out)
      colliders.push({ minX: Math.min(s.x0, s.x1), maxX: Math.max(s.x0, s.x1), minZ: zA, maxZ: zA + THICK, height })
    } else {
      const xA = Math.min(s.x0, s.x0 + out)
      colliders.push({ minX: xA, maxX: xA + THICK, minZ: Math.min(s.z0, s.z1), maxZ: Math.max(s.z0, s.z1), height })
    }
  }
  // Corner posts so the circle cannot slip between two walls.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      colliders.push({
        minX: Math.min(sx * hw, sx * (hw + THICK)),
        maxX: Math.max(sx * hw, sx * (hw + THICK)),
        minZ: Math.min(sz * hl, sz * (hl + THICK)),
        maxZ: Math.max(sz * hl, sz * (hl + THICK)),
        height,
      })

  const zones = room.zones.map((z) => ({
    id: z.id,
    kind: z.kind,
    x: z.rect_m[0],
    z: z.rect_m[1],
    w: z.rect_m[2],
    d: z.rect_m[3],
    y: z.floor_y_m ?? 0,
  }))
  const floorAt = (x: number, z: number): number =>
    zones.reduce(
      (best, zn) => (Math.abs(x - zn.x) <= zn.w / 2 && Math.abs(z - zn.z) <= zn.d / 2 ? Math.max(best, zn.y) : best),
      0,
    )

  const anchor = zones.find((z) => z.kind === 'foh') ?? zones.find((z) => z.kind === 'control-room')
  const spawn = anchor ? { x: anchor.x, z: anchor.z, yaw: Math.PI } : { x: 0, z: hl - 1.5, yaw: Math.PI }

  return { width, length, height, wallSegments, colliders, zones, floorAt, spawn }
}
