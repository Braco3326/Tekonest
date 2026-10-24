/**
 * View cube maths (designer nav, Task 7): named views around the current pivot.
 * The behaviour (click a face of a small cube to look from that side, ¾ corners,
 * 90° turns) is inspired by pro acoustic-design tools; the numbers are ours.
 * Pure: no Babylon, no DOM. Angles in radians, Babylon ArcRotateCamera terms
 * (eye = target + r·(cos α sin β, cos β, sin α sin β), left-handed world).
 *
 * Face convention (N3, ADR-0011-nav): "Face" = from the audience toward the
 * stage, alpha = +π/2 (rooms: audience at +z; levels without a room: the side
 * the port panels do NOT face). "Arrière" = front + π.
 */
import { shortestAngle } from './tween'

export type FaceId =
  | 'face'
  | 'arriere'
  | 'gauche'
  | 'droite'
  | 'dessus'
  | 'dessous'
  | 'face-gauche'
  | 'face-droite'
  | 'arriere-gauche'
  | 'arriere-droite'

export const ALL_FACES: readonly FaceId[] = [
  'face',
  'arriere',
  'gauche',
  'droite',
  'dessus',
  'dessous',
  'face-gauche',
  'face-droite',
  'arriere-gauche',
  'arriere-droite',
]

export const DEFAULT_FRONT_ALPHA = Math.PI / 2
/** Side views sit slightly above the horizon. */
export const FACE_BETA = Math.PI / 2 - 0.25
export const DESSUS_BETA = 0.0001
/** Needs the orbit floor guard lifted for this one request (the adapter does it). */
export const DESSOUS_BETA = Math.PI - 0.0001
/** nearestFace: within this of a pole, the view counts as top / bottom. */
const POLE_BAND = 0.35

/**
 * Which way "droite" turns, in alpha. Babylon is LEFT-handed: from the Face pose
 * (camera at +z looking −z) world +x is on the screen's LEFT, and an alpha
 * increase moves the camera toward its own right (verified in the e2e,
 * tests/e2e/viewCube.spec.ts). So "camera on the right, seen from the audience"
 * is front + π/2. The night brief wrote front − π/2 (right-handed reasoning);
 * its stated intent wins, recorded in ADR-0011-nav.
 */
export const SIDE_SIGN = 1

const Q = Math.PI / 2
const E = Math.PI / 4

/** Azimuth offset from front (radians, before SIDE_SIGN) of each side / ¾ view. */
const AZIMUTH: Record<Exclude<FaceId, 'dessus' | 'dessous'>, number> = {
  face: 0,
  'face-droite': E,
  droite: Q,
  'arriere-droite': 3 * E,
  arriere: Math.PI,
  'arriere-gauche': -3 * E,
  gauche: -Q,
  'face-gauche': -E,
}

/** Angle in (−π, π]. */
const wrap = (a: number): number => shortestAngle(0, a)

/** Nearest multiple of π/2 from front, as an absolute alpha. */
function snapQuadrant(alpha: number, frontAlpha: number): number {
  return frontAlpha + Math.round(shortestAngle(frontAlpha, alpha) / Q) * Q
}

/**
 * Camera angles for a named view. `currentAlpha` matters for "dessus" only
 * (it keeps the learner's heading, snapped to the nearest quadrant).
 */
export function faceAngles(
  face: FaceId,
  frontAlpha: number = DEFAULT_FRONT_ALPHA,
  currentAlpha: number = frontAlpha,
): { alpha: number; beta: number } {
  if (face === 'dessus') return { alpha: snapQuadrant(currentAlpha, frontAlpha), beta: DESSUS_BETA }
  if (face === 'dessous') return { alpha: snapQuadrant(currentAlpha, frontAlpha), beta: DESSOUS_BETA }
  return { alpha: frontAlpha + SIDE_SIGN * AZIMUTH[face], beta: FACE_BETA }
}

const BY_BIN: readonly FaceId[] = [
  'arriere-gauche', // −3
  'gauche', // −2
  'face-gauche', // −1
  'face', // 0
  'face-droite', // 1
  'droite', // 2
  'arriere-droite', // 3
]

/** The named view closest to a camera pose (the cube's active face). */
export function nearestFace(alpha: number, beta: number, frontAlpha: number = DEFAULT_FRONT_ALPHA): FaceId {
  if (beta < POLE_BAND) return 'dessus'
  if (beta > Math.PI - POLE_BAND) return 'dessous'
  const rel = SIDE_SIGN * shortestAngle(frontAlpha, alpha)
  const bin = Math.round(rel / E)
  if (bin === 4 || bin === -4) return 'arriere'
  return BY_BIN[bin + 3]
}

/**
 * A 90° turn: the next multiple of π/2 from front in `dir` (+1 = alpha grows =
 * the camera moves to its right). An off-grid alpha snaps to the next quarter
 * rather than adding 90°. Float noise near a quarter still moves a full step.
 */
export function rotate90(alpha: number, dir: 1 | -1, frontAlpha: number = DEFAULT_FRONT_ALPHA): number {
  const k = shortestAngle(frontAlpha, alpha) / Q
  const eps = 1e-6
  const next = dir === 1 ? Math.floor(k + eps) + 1 : Math.ceil(k - eps) - 1
  return frontAlpha + wrap(next * Q)
}

const DEG = 180 / Math.PI
const roundTiny = (v: number): number => (Math.abs(v) < 1e-9 ? 0 : v)

/**
 * CSS rotation for the DOM cube, applied as `rotateX(rx) rotateY(ry)` (degrees).
 * Cube-local frame = the CSS frame at rest (x right, y down, z toward the
 * viewer) seen from the Face pose: "face" at +z, "droite" at +x (screen right
 * from the audience, see SIDE_SIGN), "dessus" at −y.
 * Derivation (ADR-0011-nav): the camera basis maps a world direction d to CSS
 * (d·R, −d·U, d·B), with R = (−sin α, 0, cos α) (Babylon LookAtLH), U the
 * screen up, B the eye direction. Matching that with RX(ψ)·RY(φ) gives
 * φ = front − α and ψ = β − π/2. At the Face pose: (−14.3°, 0).
 */
export function cubeCssRotation(alpha: number, beta: number, frontAlpha: number = DEFAULT_FRONT_ALPHA): { rx: number; ry: number } {
  // A proper rotation only with SIDE_SIGN = 1 (droite on screen-right): the other
  // sign would need a mirrored cube, which CSS rotations cannot express.
  const ry = wrap(frontAlpha - alpha) * DEG
  return { rx: roundTiny((beta - Math.PI / 2) * DEG), ry: roundTiny(ry) }
}
