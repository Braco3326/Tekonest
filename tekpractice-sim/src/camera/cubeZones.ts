/**
 * View cube, 26 zones (Task 16, C11, ADR-0014): pure model, no Babylon, no DOM.
 * The behaviour (click a face, edge or corner of a small cube to look from that
 * side) is inspired by pro acoustic-design tools; the numbers are ours.
 *
 * Cube frame: x = droite (+) / gauche (−), y = dessus (+) / dessous (−),
 * z = face (+) / arrière (−). "Droite" is the right of the audience-side
 * viewer at the Face pose. Babylon is left-handed, so that is world −x of the
 * cube mesh's parent; the camera side is carried by `SIDE_SIGN` in viewCube.ts
 * (proven by tests/e2e/viewCube.spec.ts), which this module reuses unchanged.
 */
import { DEFAULT_FRONT_ALPHA, DESSOUS_BETA, DESSUS_BETA, FACE_BETA, SIDE_SIGN } from './viewCube'

export type Sign = -1 | 0 | 1
export interface ZoneSigns {
  x: Sign
  y: Sign
  z: Sign
}

/** acos(1/√3): the elevation (from the pole) of a cube corner. */
const ISO = 0.9553

const sgn = (v: number, t: number): Sign =>
  Math.abs(v) >= 0.999 ? (Math.sign(v) as Sign) : Math.abs(v) > t ? (Math.sign(v) as Sign) : 0

/** The 26 non-zero sign triples. */
export const ZONES: readonly ZoneSigns[] = (() => {
  const out: ZoneSigns[] = []
  for (const y of [1, 0, -1] as Sign[])
    for (const z of [1, 0, -1] as Sign[])
      for (const x of [0, 1, -1] as Sign[]) if (x || y || z) out.push({ x, y, z })
  return out
})()

export function zoneId(s: ZoneSigns): string {
  const p: string[] = []
  if (s.y) p.push(s.y > 0 ? 'dessus' : 'dessous')
  if (s.z) p.push(s.z > 0 ? 'face' : 'arriere')
  if (s.x) p.push(s.x > 0 ? 'droite' : 'gauche')
  return p.join('-')
}

/** French label, e.g. « Dessus · Face », « Arrière · Gauche ». */
export function zoneLabel(s: ZoneSigns): string {
  const p: string[] = []
  if (s.y) p.push(s.y > 0 ? 'Dessus' : 'Dessous')
  if (s.z) p.push(s.z > 0 ? 'Face' : 'Arrière')
  if (s.x) p.push(s.x > 0 ? 'Droite' : 'Gauche')
  return p.join(' · ')
}

/** `local` is a point of the cube surface in [−0.5, 0.5]³; `threshold` 0.5 splits each axis in 3 bands. */
export function classifyHit(l: { x: number; y: number; z: number }, threshold = 0.5): ZoneSigns {
  return { x: sgn(l.x * 2, threshold), y: sgn(l.y * 2, threshold), z: sgn(l.z * 2, threshold) }
}

/** Camera angles for a zone. Poles keep the front heading (north-up). */
export function zoneAngles(s: ZoneSigns): { alpha: number; beta: number } {
  const horizontal = s.x !== 0 || s.z !== 0
  const alpha = horizontal ? DEFAULT_FRONT_ALPHA + SIDE_SIGN * Math.atan2(s.x, s.z) : DEFAULT_FRONT_ALPHA
  if (s.y === 0) return { alpha, beta: FACE_BETA }
  if (!horizontal) return { alpha, beta: s.y > 0 ? DESSUS_BETA : DESSOUS_BETA }
  const corner = s.x !== 0 && s.z !== 0
  const up = corner ? ISO : Math.PI / 4
  return { alpha, beta: s.y > 0 ? up : Math.PI - up }
}

/** [x, z] from Face, clockwise seen from above. Shared with the V picker (az = index). */
export const OCTANTS: readonly (readonly [Sign, Sign])[] = [
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
]

/** The zone closest to a camera pose (the cube's active zone). */
export function nearestZone(alpha: number, beta: number): ZoneSigns {
  const el = (Math.PI / 2 - beta) * (180 / Math.PI)
  const y: Sign = el > 25 ? 1 : el < -25 ? -1 : 0
  if (Math.abs(el) > 70) return { x: 0, y, z: 0 }
  const k = (Math.round((SIDE_SIGN * (alpha - DEFAULT_FRONT_ALPHA)) / (Math.PI / 4)) % 8 + 8) % 8
  const [x, z] = OCTANTS[k]
  return { x, y, z }
}

/** Hover overlay box in cube local units, 0.01 proud of the surface on every non-zero axis. */
export function zoneBox(
  s: ZoneSigns,
  threshold = 0.5,
): { center: [number, number, number]; size: [number, number, number] } {
  const axis = (v: Sign): [number, number] =>
    v === 0 ? [0, threshold] : [v * ((0.5 + threshold / 2) / 2 + 0.01), 0.5 - threshold / 2]
  const [cx, sx] = axis(s.x)
  const [cy, sy] = axis(s.y)
  const [cz, sz] = axis(s.z)
  return { center: [cx, cy, cz], size: [sx, sy, sz] }
}
