/** Placement maths (ADR-0010 Décision 8) — pure. */
export const GRID_STEP = 0.25

export function snapToGrid(v: number, step = GRID_STEP): number {
  const s = Math.round(v / step) * step
  return Object.is(s, -0) ? 0 : s
}

/** Rotate by one 90° step (dir = +1 / −1), result in [0, 360). */
export function rotateStep(deg: number, dir: 1 | -1): number {
  return (((deg + 90 * dir) % 360) + 360) % 360
}
