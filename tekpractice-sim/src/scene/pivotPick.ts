/**
 * The floor point under a screen point (designer-nav Task 4 re-pivot, review minor 4), shared by
 * the legacy FocusPatch and Mode Création's double-click (Task 21 review). Only meshes flagged
 * `pivotSurface` (white ground, room floor and zones, floor-like env-set meshes) and only where
 * the picked face points up: a deck side, a wall or a ceiling never counts, and a wall's back
 * face in front of the floor does not block it (multiPick, nearest up-facing hit). Default picks
 * ignore those surfaces (isPickable false), so the predicate checks enabled / visible itself.
 */
import type { AbstractMesh, Camera, Scene } from '@babylonjs/core'
import { nearestUpHit } from './pivotSurface'

export function floorPointAt(scene: Scene, x: number, y: number, camera?: Camera): [number, number, number] | null {
  const hits = scene.multiPick(
    x,
    y,
    (m: AbstractMesh) => {
      const md = m.metadata as { isDeviceBody?: boolean; isPortMarker?: boolean; pivotSurface?: boolean } | null
      if (!m.isEnabled() || !m.isVisible || md?.isDeviceBody || md?.isPortMarker) return false
      return md?.pivotSurface === true
    },
    camera,
  )
  return nearestUpHit(
    (hits ?? []).flatMap((h) => {
      const p = h.hit ? h.pickedPoint : null
      return p ? [{ distance: h.distance, normal: h.getNormal(true, true), point: [p.x, p.y, p.z] as [number, number, number] }] : []
    }),
  )
}
