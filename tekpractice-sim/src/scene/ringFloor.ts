/**
 * Screen-space floor of the port rings in the GAME (src/game.ts). Mode Creation has its own (PortProxies, 9 px); the game never had one:
 * at the 8.5 m Ensemble view an XLR ring (23 mm) spans 2 px with a 0.3 px line and vanishes, where the old 50 mm discs read as dots.
 * A ring that spans less than GAME_RING_MIN_PX on screen is scaled up (in its plane only, so a pocket ring keeps its lift) to span exactly that;
 * a ring that is big enough (every focus distance) is left at 1. Hover / patch glow is the FocusPatch's business and does not change the scale.
 */
import type { ArcRotateCamera, Mesh, TransformNode } from '@babylonjs/core'
import { Vector3 } from '@babylonjs/core'
import type { DeviceInstance } from './DeviceSpawner'
import { worldPerPx } from '../creation/portProxies'

/** A ring never spans fewer CSS px than this in the game (Mode Creation: 9). */
export const GAME_RING_MIN_PX = 6

/** The in-plane scale a ring of rest diameter `restM` (world metres) needs at `distanceM`: 1 when it already spans the floor; finite, never under 1. */
export function gameRingScale(restM: number, distanceM: number, fovRad: number, viewportPx: number): number {
  if (!Number.isFinite(restM) || restM <= 0) return 1
  const px = restM / worldPerPx(distanceM, fovRad, viewportPx)
  return Number.isFinite(px) && px > 0 && px < GAME_RING_MIN_PX ? GAME_RING_MIN_PX / px : 1
}

/** Applies the floor to every marker ring of `instances` for the camera as it is now; a change under 2 % is not worth a matrix update. */
export function applyGameRingFloor(instances: Iterable<DeviceInstance>, camera: ArcRotateCamera, viewportPx: number): void {
  if (!(viewportPx > 0)) return
  const eye = camera.position
  for (const inst of instances) {
    for (const marker of inst.portMarkers.values()) {
      if (marker.isDisposed()) continue
      const m: Mesh = marker
      const local = m.getBoundingInfo().boundingBox.extendSize.x * 2
      if (!(local > 0)) continue
      const parent = (m.parent as TransformNode | null)?.absoluteScaling?.x
      const parentScale = parent && Number.isFinite(parent) && parent > 0 ? parent : 1
      const target = gameRingScale(local * parentScale, Vector3.Distance(eye, m.getAbsolutePosition()), camera.fov, viewportPx)
      if (Math.abs(m.scaling.x - target) > target * 0.02) {
        m.scaling.set(target, target, 1)
        m.computeWorldMatrix(true)
      }
    }
  }
}
