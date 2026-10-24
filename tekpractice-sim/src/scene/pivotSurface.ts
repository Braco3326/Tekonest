/**
 * pivotSurface — which surfaces a floor double-click may re-pivot on (Task 4,
 * review minor 4): floors only — the ground, a room floor, raised zone TOPS.
 * Walls, deck sides and ceilings never count. Pure (structural types).
 */
export interface V3 {
  x: number
  y: number
  z: number
}

/** cos(~37°): a picked face this close to straight up is a floor (raked stages pass). */
const UP_MIN_Y = 0.8

export const isUpFacing = (n: V3): boolean => n.y >= UP_MIN_Y * Math.hypot(n.x, n.y, n.z)

/** Nearest hit whose face points up; a wall's back face in front of the floor never blocks it. */
export function nearestUpHit(
  hits: readonly { distance: number; normal: V3 | null; point: [number, number, number] }[],
): [number, number, number] | null {
  let best: { distance: number; point: [number, number, number] } | null = null
  for (const h of hits) {
    if (!h.normal || !isUpFacing(h.normal)) continue
    if (!best || h.distance < best.distance) best = h
  }
  return best ? best.point : null
}
