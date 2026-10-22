/**
 * Explore movement integrator (ADR-0010 Décision 7) — pure, Babylon-free.
 * Conventions match Babylon's UniversalCamera: yaw = rotation.y (0 looks +Z,
 * forward = (sin yaw, cos yaw)), pitch = rotation.x (positive looks down).
 * Collision is a separate step (collision.ts) applied by the adapter.
 */
export const WALK_SPEED = 1.4 // m/s — a calm indoor walk
export const RUN_MULT = 2
export const EYE = { min: 0.9, stand: 1.65, max: 1.9 } as const // metres above the floor
export const EYE_RATE = 1.0 // m/s for Q/E
export const PITCH_LIMIT = (85 * Math.PI) / 180
const MAX_DT = 0.1 // a tab switch must not teleport the player
const TAU_ACCEL = 0.12
const TAU_DECEL = 0.08
const TAU_REDUCED = 0.04

export interface PlayerState {
  x: number
  z: number
  eye: number
  yaw: number
  pitch: number
  vx: number
  vz: number
}

/** forward/strafe/vertical in [−1, 1]; yaw/pitch deltas in radians (already sensitivity-scaled). */
export interface MoveIntent {
  forward: number
  strafe: number
  vertical: number
  run: boolean
  yawDelta: number
  pitchDelta: number
}

export interface MoveOptions {
  speedMult: number
  reducedMotion: boolean
}

export const initialPlayer = (x = 0, z = 0, yaw = 0): PlayerState => ({
  x,
  z,
  eye: EYE.stand,
  yaw,
  pitch: 0,
  vx: 0,
  vz: 0,
})

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2
  let r = (a + Math.PI) % twoPi
  if (r < 0) r += twoPi
  return r - Math.PI
}

export function stepPlayer(p: PlayerState, intent: MoveIntent, dtRaw: number, opts: MoveOptions): PlayerState {
  const dt = clamp(dtRaw, 0, MAX_DT)
  const yaw = wrapAngle(p.yaw + intent.yawDelta)
  const pitch = clamp(p.pitch + intent.pitchDelta, -PITCH_LIMIT, PITCH_LIMIT)

  // Desired velocity in world space; the input vector is normalised so a
  // diagonal is never faster than a straight line.
  let f = clamp(intent.forward, -1, 1)
  let s = clamp(intent.strafe, -1, 1)
  const len = Math.hypot(f, s)
  if (len > 1) {
    f /= len
    s /= len
  }
  const speed = WALK_SPEED * (intent.run ? RUN_MULT : 1) * opts.speedMult
  const sin = Math.sin(yaw)
  const cos = Math.cos(yaw)
  const tx = (f * sin + s * cos) * speed
  const tz = (f * cos - s * sin) * speed

  // Exponential easing toward the target (no jerk); shorter when reduced motion.
  const moving = tx !== 0 || tz !== 0
  const tau = opts.reducedMotion ? TAU_REDUCED : moving ? TAU_ACCEL : TAU_DECEL
  const k = 1 - Math.exp(-dt / tau)
  const vx = p.vx + (tx - p.vx) * k
  const vz = p.vz + (tz - p.vz) * k

  return {
    x: p.x + vx * dt,
    z: p.z + vz * dt,
    eye: clamp(p.eye + clamp(intent.vertical, -1, 1) * EYE_RATE * dt, EYE.min, EYE.max),
    yaw,
    pitch,
    vx,
    vz,
  }
}
