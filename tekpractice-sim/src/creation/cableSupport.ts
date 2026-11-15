/**
 * The design's side of « gravity first » (mission 3 A): which devices a cable can rest on, and which way a cable leaves a port. Pure (no Babylon).
 *
 * - Support boxes: every placed device whose outer size is on its own asset spec (src/scene/cableSupportSizes.json, generated from
 *   content/asset-specs/<id>.json realSizeMm). A device with no such size is no support: a cable never rests on an invented height. A tilted device
 *   (a speaker aimed down) is no shelf either. Whether a box really rests on something (and so supports) is cableGravity's `buildSupport` rule.
 * - Outward direction: a port marker's position in its device's own frame tells which face it is on (the side of the box it is nearest, relative to
 *   the box's half sizes); the cable leaves along that face's normal. A port that is on no side face (a microphone's connector under its body, a jack
 *   on a top panel) gets none: the cable hangs straight down from it.
 */
import type { Placement } from '../trials/trial'
import type { P3 } from '../scene/cablePath'
import type { SupportBox } from '../scene/cableGravity'
import sizes from '../scene/cableSupportSizes.json'

const SIZES = (sizes as { devices: Record<string, number[]> }).devices

/** A device's outer size in metres from its own sheet, or null when the sheet has none. */
export function deviceSizeM(deviceId: string): { w: number; h: number; d: number } | null {
  const s = Object.prototype.hasOwnProperty.call(SIZES, deviceId) ? SIZES[deviceId] : undefined
  return s && s.length === 3 ? { w: s[0]! / 1000, h: s[1]! / 1000, d: s[2]! / 1000 } : null
}

/** The support boxes of a design's placements (position_m is the bottom centre of the device, as the spawner grounds it). */
export function supportBoxes(placements: readonly Placement[], sizeOf: (deviceId: string) => { w: number; h: number; d: number } | null = deviceSizeM): SupportBox[] {
  const out: SupportBox[] = []
  for (const p of placements) {
    if (Math.abs(p.tiltDeg ?? 0) > 0.5) continue
    const s = sizeOf(p.deviceId)
    if (!s) continue
    out.push({ id: p.instanceId, x: p.position_m[0], z: p.position_m[2], w: s.w, d: s.d, yawDeg: p.yawDeg, base: p.position_m[1], h: s.h })
  }
  return out
}

/** A port nearer than this share of the half size to a side face is on that face. */
const FACE_SHARE = 0.6

/**
 * The face a port is on, as a unit axis of the device's own frame ((±1, 0, 0) or (0, 0, ±1)), from the port's position in that frame (origin at the
 * bottom centre). `size` null: the larger horizontal offset decides, but only when it is at least 1 cm (a port on the device's axis has no face).
 * Returns null for a port on no side face.
 */
export function portFaceLocal(local: P3, size: { w: number; d: number } | null): P3 | null {
  const hw = size ? size.w / 2 : Math.max(Math.abs(local.x), Math.abs(local.z))
  const hd = size ? size.d / 2 : hw
  if (!(hw > 0.01 || hd > 0.01)) return null
  const rx = hw > 0 ? Math.abs(local.x) / hw : 0
  const rz = hd > 0 ? Math.abs(local.z) / hd : 0
  if (Math.max(rx, rz) < FACE_SHARE) return null
  return rx > rz ? { x: Math.sign(local.x), y: 0, z: 0 } : { x: 0, y: 0, z: Math.sign(local.z) }
}
