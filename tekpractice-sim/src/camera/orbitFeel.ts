/**
 * orbitFeel — designer-grade orbit "feel" for the ArcRotateCamera (Task 3).
 * Inspired by pro acoustic-design and 3D modelling tools: soft inertia, a wheel
 * that dollies toward the cursor, a pan that follows the cursor at any distance,
 * and beta limits that never let the camera slip under the floor.
 * Pure config + pure maths: a structural camera type, no Babylon import.
 */

export const ORBIT_FEEL = {
  inertia: 0.85,
  panningInertia: 0.85,
  wheelDeltaPercentage: 0.02,
  zoomToMouseLocation: true,
  upperBetaLimit: Math.PI / 2 - 0.02,
  lowerBetaLimit: 0.05,
  upperRadiusLimit: 60,
} as const

/** Ensemble (env/room overview) dolly floor — the env default the game always used. */
export const ENSEMBLE_LOWER_RADIUS = 2

/** Minimum dolly distance while focusing a device. */
const MIN_FOCUS_RADIUS = 0.3

/** The subset of ArcRotateCamera the feel touches (structural: testable headless). */
export interface OrbitCam {
  inertia: number
  panningInertia: number
  wheelDeltaPercentage: number
  zoomToMouseLocation: boolean
  upperBetaLimit: number | null
  lowerBetaLimit: number | null
  upperRadiusLimit: number | null
  panningSensibility: number
  minZ: number
}

/**
 * Near clip plane of the orbit camera. Babylon's default (1 m) hides — and
 * makes unpickable — a small device framed at the 0.9 m focus radius or dollied
 * to the 0.3 m floor. Same value as the Explore walker's camera.
 */
export const ORBIT_MIN_Z = 0.05

/** Focus: the dolly may come to 1.2 × the device's bounding radius, never under 0.3 m. */
export function radiusLimitFor(boundingRadius: number): number {
  const r = Number.isFinite(boundingRadius) ? boundingRadius : 0
  return Math.max(MIN_FOCUS_RADIUS, r * 1.2)
}

/**
 * Babylon panningSensibility (higher = slower) such that one pixel of drag moves
 * the target by one pixel's worth of world at the target depth, once the pan
 * inertia has played out. Babylon's total pan per pixel is
 * 1 / (sensibility · (1 − panningInertia)) world units; one pixel at distance r
 * spans 2 · r · tan(fov / 2) / heightPx. Computed once per drag (no per-frame work).
 */
export function panningSensibilityFor(
  radius: number,
  viewportHeightPx: number,
  fov: number,
  panningInertia: number = ORBIT_FEEL.panningInertia,
): number {
  const r = Math.max(0.05, Number.isFinite(radius) ? radius : 0)
  const h = Math.max(1, Number.isFinite(viewportHeightPx) ? viewportHeightPx : 0)
  const f = Math.max(0.05, Number.isFinite(fov) ? fov : 0)
  const worldPerPx = (2 * r * Math.tan(f / 2)) / h
  const pi = Number.isFinite(panningInertia) ? Math.min(0.99, Math.max(0, panningInertia)) : ORBIT_FEEL.panningInertia
  return 1 / (worldPerPx * (1 - pi))
}

/**
 * Reduced motion (in-app setting or system, final review): no glide after the
 * hand lets go, inertia and panningInertia 0. Babylon's total travel per
 * gesture is input / (1 − inertia), so the wheel step and the orbit speed are
 * scaled to travel the SAME distance, only without the glide.
 * `angularScale` multiplies the pointer input's angular sensibilities.
 */
export function orbitMotion(reduced: boolean): {
  inertia: number
  panningInertia: number
  wheelDeltaPercentage: number
  angularScale: number
} {
  if (!reduced)
    return {
      inertia: ORBIT_FEEL.inertia,
      panningInertia: ORBIT_FEEL.panningInertia,
      wheelDeltaPercentage: ORBIT_FEEL.wheelDeltaPercentage,
      angularScale: 1,
    }
  const glide = 1 / (1 - ORBIT_FEEL.inertia)
  return { inertia: 0, panningInertia: 0, wheelDeltaPercentage: ORBIT_FEEL.wheelDeltaPercentage * glide, angularScale: 1 / glide }
}

/** Default pan speed before the first drag re-tunes it (radius 10 m, 800 px, fov 0.8). */
const DEFAULT_PANNING_SENSIBILITY = panningSensibilityFor(10, 800, 0.8)

/**
 * Apply the feel. The upper radius limit is a FLOOR of 60 m: a big room whose
 * overview already needs more reach keeps it.
 */
export function applyOrbitFeel(cam: OrbitCam): void {
  cam.inertia = ORBIT_FEEL.inertia
  cam.panningInertia = ORBIT_FEEL.panningInertia
  cam.wheelDeltaPercentage = ORBIT_FEEL.wheelDeltaPercentage
  cam.zoomToMouseLocation = ORBIT_FEEL.zoomToMouseLocation
  cam.upperBetaLimit = ORBIT_FEEL.upperBetaLimit
  cam.lowerBetaLimit = ORBIT_FEEL.lowerBetaLimit
  cam.upperRadiusLimit = Math.max(cam.upperRadiusLimit ?? 0, ORBIT_FEEL.upperRadiusLimit)
  cam.panningSensibility = DEFAULT_PANNING_SENSIBILITY
  cam.minZ = ORBIT_MIN_Z
}
