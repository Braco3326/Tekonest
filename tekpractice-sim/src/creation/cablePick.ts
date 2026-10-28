/**
 * Cable picking in SCREEN space (Task 27). A cable is a 2.4 cm tube: a few px wide at best, so a ray test against the
 * mesh would need a pixel-perfect pointer. Instead the cable's drawn points are projected to the canvas (CSS px) and
 * the pointer hits the nearest one within a tolerance (`CABLE_HIT_PX`). Pure: no Babylon, no DOM (unit tested).
 */
export interface Pt {
  x: number
  y: number
}

/** A cable is hit within this many CSS px of its drawn line (the tube itself is 2-3 px wide). */
export const CABLE_HIT_PX = 7

/** Distance from point `p` to the segment `a`-`b`. */
export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/**
 * The cable whose projected polyline passes nearest `at`, within `tolPx`; null when none does. A `null` point (behind
 * the camera) breaks the line there: the segments touching it are skipped. Ties keep the first.
 */
export function nearestCable(polylines: Iterable<readonly [string, ReadonlyArray<Pt | null>]>, at: Pt, tolPx: number = CABLE_HIT_PX): string | null {
  let best: string | null = null
  let bestD = tolPx
  for (const [id, pts] of polylines) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      if (!a || !b) continue
      const d = distToSegment(at, a, b)
      if (d <= bestD && (best === null || d < bestD)) {
        bestD = d
        best = id
      }
    }
  }
  return best
}
