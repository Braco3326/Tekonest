/**
 * Pure camera-tween maths: no Babylon, no DOM, no clock of its own.
 * Easing and pose interpolation are inspired by pro acoustic-design tools'
 * smooth camera moves; the numbers (ease-in-out cubic, 450 ms) are ours.
 */

export interface PoseValues {
  alpha: number
  beta: number
  radius: number
  target: [number, number, number]
}

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)

/** Ease-in-out cubic. `t` is clamped to [0,1]. */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/** Signed shortest rotation from a to b, in (−π, π]. */
export function shortestAngle(a: number, b: number): number {
  const twoPi = Math.PI * 2
  let d = (b - a) % twoPi
  if (d > Math.PI) d -= twoPi
  if (d <= -Math.PI) d += twoPi
  return d
}

/** `to`, with alpha rewritten so the orbit takes the short way round (never more than π). */
export function planTween(from: PoseValues, to: PoseValues): PoseValues {
  return {
    alpha: from.alpha + shortestAngle(from.alpha, to.alpha),
    beta: to.beta,
    radius: to.radius,
    target: [to.target[0], to.target[1], to.target[2]],
  }
}

/** Eased lerp of every field; `t` is clamped to [0,1]. */
export function samplePose(from: PoseValues, to: PoseValues, t: number): PoseValues {
  const e = easeInOutCubic(t)
  if (e === 0) return { ...from, target: [from.target[0], from.target[1], from.target[2]] }
  if (e === 1) return { ...to, target: [to.target[0], to.target[1], to.target[2]] }
  const l = (a: number, b: number): number => a + (b - a) * e
  return {
    alpha: l(from.alpha, to.alpha),
    beta: l(from.beta, to.beta),
    radius: l(from.radius, to.radius),
    target: [l(from.target[0], to.target[0]), l(from.target[1], to.target[1]), l(from.target[2], to.target[2])],
  }
}

export interface PoseLimits {
  lowerRadius?: number
  upperRadius?: number
  lowerBeta?: number
  upperBeta?: number
}

/** Keep radius and beta inside the camera's limits (so a tween never fights them). */
export function clampPose(p: PoseValues, lim: PoseLimits): PoseValues {
  const c = (v: number, lo?: number, hi?: number): number => {
    let r = v
    if (lo !== undefined && r < lo) r = lo
    if (hi !== undefined && r > hi) r = hi
    return r
  }
  return {
    alpha: p.alpha,
    beta: c(p.beta, lim.lowerBeta, lim.upperBeta),
    radius: c(p.radius, lim.lowerRadius, lim.upperRadius),
    target: [p.target[0], p.target[1], p.target[2]],
  }
}

/** Time-to-progress mapping for one tween. Takes the clock as an argument: fully testable. */
export class TweenClock {
  private startMs: number | null = null
  private finished = false

  constructor(private readonly durationMs: number) {}

  start(nowMs: number): void {
    this.startMs = nowMs
    this.finished = this.durationMs <= 0
  }

  /** 0 before start, 1 once the duration has elapsed. */
  progress(nowMs: number): number {
    if (this.startMs === null) return 0
    if (this.durationMs <= 0) return 1
    const p = clamp01((nowMs - this.startMs) / this.durationMs)
    if (p >= 1) this.finished = true
    return p
  }

  cancel(): void {
    this.startMs = null
    this.finished = false
  }

  get active(): boolean {
    return this.startMs !== null && !this.finished
  }

  get done(): boolean {
    return this.finished
  }
}

/** A focused model landing late moves its centre: re-frame only from this shift on (no camera jitter). */
export const REFRAME_MIN_SHIFT_M = 0.02

export function needsReframe(
  framed: readonly [number, number, number],
  landed: readonly [number, number, number],
): boolean {
  const d = Math.hypot(landed[0] - framed[0], landed[1] - framed[1], landed[2] - framed[2])
  return d >= REFRAME_MIN_SHIFT_M - 1e-9
}
