/**
 * Listener position relative to a loudspeaker (Task 36, ADR-0015). Pure: no Babylon, no DOM, no store.
 *
 * Conventions (Babylon left-handed, the same as Placement / SceneHost, ADR-0013 addendum):
 * - yaw is about +y; yawDeg 0 = the speaker faces +z; yaw 90 faces +x (world axis = (sin yaw, 0, cos yaw)).
 * - tilt is about the speaker's own x axis (applied after the yaw); tiltDeg > 0 aims UP, so the acoustic axis is
 *   (sin yaw·cos tilt, sin tilt, cos yaw·cos tilt). A listener at the speaker's height straight ahead is therefore BELOW the axis for
 *   tilt > 0 (thetaV < 0) and ABOVE it for tilt < 0.
 * - thetaH > 0 = to the right of the axis (+x when facing +z); thetaV > 0 = above the axis.
 * - rear = local z < 0 (behind the plane of the speaker front). The plane itself (z = 0) counts as front.
 */
export interface SpeakerPose {
  position: [number, number, number]
  yawDeg: number
  tiltDeg: number
}

const D2R = Math.PI / 180

/** Angles of the point `p` off the axis of `s` (degrees), whether it lies behind the speaker, and the distance `r` (metres, not floored). */
export function offAxis(s: SpeakerPose, p: [number, number, number]): { thetaHdeg: number; thetaVdeg: number; rear: boolean; r: number } {
  const dx = p[0] - s.position[0]
  const dy = p[1] - s.position[1]
  const dz = p[2] - s.position[2]
  const r = Math.hypot(dx, dy, dz)
  const yaw = s.yawDeg * D2R
  const tilt = s.tiltDeg * D2R
  // inverse yaw (Babylon LH: world = local rotated by yaw about +y)
  const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw)
  const lz1 = dx * Math.sin(yaw) + dz * Math.cos(yaw)
  // inverse tilt (pitch up by `tilt` about local x)
  const ly = dy * Math.cos(tilt) - lz1 * Math.sin(tilt)
  const lz = dy * Math.sin(tilt) + lz1 * Math.cos(tilt)
  return { thetaHdeg: Math.atan2(lx, lz) / D2R, thetaVdeg: Math.atan2(ly, Math.hypot(lx, lz)) / D2R, rear: lz < 0, r }
}
