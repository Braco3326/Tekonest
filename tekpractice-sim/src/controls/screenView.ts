/**
 * controls/screenView: where the orbit camera goes to « go into » a console screen: look at its centre from the operator's side, far
 * enough that the whole glass fits, tilted a little toward the operator so a flat top screen is not seen edge-on at a low angle.
 * Pure numbers: world vectors in, an ArcRotateCamera pose out (position = target + radius * (cos a sin b, cos b, sin a sin b)).
 */
export type V3 = [number, number, number]

export interface ScreenFrame {
  /** World centre of the glass. */
  center: V3
  /** World outward normal of the glass (unit). */
  normal: V3
  /** World direction toward the top of the picture on the glass (unit): what the operator reads as up. */
  up: V3
  /** Size of the glass in metres. */
  w: number
  h: number
}

export interface ViewPose {
  alpha: number
  beta: number
  radius: number
  target: V3
}

const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

/**
 * The pose that frames `f` filling about `fill` of the shorter fit side. `fov` is the camera's vertical field of view (rad), `aspect` the
 * canvas width / height. The camera sits on the normal, leaned `tiltDeg` away from it toward the bottom of the picture (the operator's side).
 */
export function screenViewPose(f: ScreenFrame, fov: number, aspect: number, tiltDeg = 22, fill = 0.82): ViewPose {
  const t = (tiltDeg * Math.PI) / 180
  // Toward the camera: the normal, leaned toward the bottom of the picture (-up). A vertical glass (normal horizontal) leans down a little.
  const lean = norm([-f.up[0], -f.up[1], -f.up[2]])
  const v = norm([
    f.normal[0] * Math.cos(t) + lean[0] * Math.sin(t),
    f.normal[1] * Math.cos(t) + lean[1] * Math.sin(t),
    f.normal[2] * Math.cos(t) + lean[2] * Math.sin(t),
  ])
  // Fit: the glass seen at angle t is h*cos(t) tall in the picture plane; the width is unchanged.
  const needH = (f.h * Math.cos(t)) / fill
  const needW = f.w / fill / Math.max(0.2, aspect)
  const half = Math.max(needH, needW) / 2
  const radius = Math.max(0.15, half / Math.tan(fov / 2))
  const beta = Math.acos(Math.min(1, Math.max(-1, v[1])))
  const alpha = Math.atan2(v[2], v[0])
  return { alpha, beta, radius, target: [...f.center] as V3 }
}

/** Whether a camera at `pose` would see the glass from its front (the pose looks at the face the glass shows). */
export function seesFront(f: ScreenFrame, pose: ViewPose): boolean {
  const v: V3 = [Math.cos(pose.alpha) * Math.sin(pose.beta), Math.cos(pose.beta), Math.sin(pose.alpha) * Math.sin(pose.beta)]
  return dot(v, f.normal) > 0
}
