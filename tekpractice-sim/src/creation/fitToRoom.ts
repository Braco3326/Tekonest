/**
 * « Garder le matériel » (C3): bring a design's placements inside a new room.
 * x/z are clamped inside the footprint (origin at the floor centre) with a
 * margin; a floor device lands on the new floor; a stand / flown device keeps
 * its height above the floor. The old room's floor is not known here, so that
 * height is read with `floorAt` at the old point (exact for flat rooms and for
 * devices that stay where they were). Never below the floor. The rig and the
 * roomId are untouched (the caller sets the new roomId). Pure.
 */
import type { DesignState } from '../trials/trial'

const clamp = (v: number, half: number, margin: number): number => {
  const lim = half - margin
  if (lim <= 0) return 0 // smaller than twice the margin: centre line
  return Math.min(lim, Math.max(-lim, v))
}

export function fitPlacementsToRoom(
  design: DesignState,
  bounds: { width: number; length: number },
  floorAt: (x: number, z: number) => number,
  margin = 0.5,
): DesignState {
  const out = structuredClone(design)
  out.placements = out.placements.map((p) => {
    const [x0, y0, z0] = p.position_m
    const x = clamp(x0, bounds.width / 2, margin)
    const z = clamp(z0, bounds.length / 2, margin)
    const floor = floorAt(x, z)
    const y = (p.mount ?? 'floor') === 'floor' ? floor : floor + Math.max(0, y0 - floorAt(x0, z0))
    return { ...p, position_m: [x, y, z] }
  })
  return out
}
