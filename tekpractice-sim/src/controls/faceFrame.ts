/**
 * controls/faceFrame: where a face-local point is in the device root's frame in Babylon, and which way the face looks.
 * Same face mapping as tools/assets3d/placement.ts (GLB file space, pivot bottom-centre, 'io' at +Z), then Babylon's z mirror:
 * a pipeline model reaches the scene as glTF (x, y, z) -> Babylon (x, y, -z), so the I/O face sits at -Z. Pure arrays, no Babylon.
 */
import type { Face } from './controlTypes'

export type V3 = [number, number, number]

export interface FaceFrame {
  /** Position in the device root frame, metres. */
  pos: V3
  /** Face-local +x (to the right seen from outside) in the root frame. */
  right: V3
  /** Face-local +y (up on a side face, toward the front on top / bottom) in the root frame. */
  up: V3
  /** Outward normal in the root frame. */
  out: V3
}

const flipZ = (v: V3): V3 => [v[0], v[1], v[2] === 0 ? 0 : -v[2]]

/** Height of a sloped top at `depthMm` from the I/O edge, and its slope (dh per mm of depth), from [depth, height] points (flat beyond the ends). */
export function topSurface(profile: readonly [number, number][], depthMm: number): { heightMm: number; slope: number } {
  const first = profile[0]
  const last = profile[profile.length - 1]
  if (depthMm <= first[0]) return { heightMm: first[1], slope: 0 }
  if (depthMm >= last[0]) return { heightMm: last[1], slope: 0 }
  for (let i = 1; i < profile.length; i++) {
    const [d1, h1] = profile[i]
    if (depthMm <= d1) {
      const [d0, h0] = profile[i - 1]
      const slope = (h1 - h0) / (d1 - d0)
      return { heightMm: h0 + slope * (depthMm - d0), slope }
    }
  }
  return { heightMm: last[1], slope: 0 }
}

/**
 * The frame of the point (xMm, yMm) on `face` of a casing w x h x d mm. `topProfile` (a console wedge) puts a point of the 'top' face on the
 * sloped surface instead of the flat top, and tilts the frame to the slope.
 */
export function faceFrame(face: Face, xMm: number, yMm: number, size: { w: number; h: number; d: number }, topProfile?: readonly [number, number][]): FaceFrame {
  const x = xMm / 1000
  const y = yMm / 1000
  const w = size.w / 1000
  const h = size.h / 1000
  const d = size.d / 1000
  let pos: V3, right: V3, up: V3, out: V3
  switch (face) {
    case 'io':
      pos = [x - w / 2, y, d / 2]; right = [1, 0, 0]; up = [0, 1, 0]; out = [0, 0, 1]
      break
    case 'opposite':
      pos = [w / 2 - x, y, -d / 2]; right = [-1, 0, 0]; up = [0, 1, 0]; out = [0, 0, -1]
      break
    case 'top': {
      pos = [x - w / 2, h, d / 2 - y]; right = [1, 0, 0]; up = [0, 0, -1]; out = [0, 1, 0]
      if (topProfile && topProfile.length >= 2) {
        const { heightMm, slope } = topSurface(topProfile, yMm)
        const k = 1 / Math.hypot(1, slope)
        pos = [pos[0], heightMm / 1000, pos[2]]
        up = [0, slope * k, -k]
        out = [0, k, slope * k]
      }
      break
    }
    case 'bottom':
      pos = [w / 2 - x, 0, d / 2 - y]; right = [-1, 0, 0]; up = [0, 0, -1]; out = [0, -1, 0]
      break
    case 'left':
      pos = [-w / 2, y, -d / 2 + x]; right = [0, 0, 1]; up = [0, 1, 0]; out = [-1, 0, 0]
      break
    case 'right':
      pos = [w / 2, y, d / 2 - x]; right = [0, 0, -1]; up = [0, 1, 0]; out = [1, 0, 0]
      break
  }
  return { pos: flipZ(pos), right: flipZ(right), up: flipZ(up), out: flipZ(out) }
}
