/**
 * The first-sound framing follows the canvas height (plan T2.5). The vertical field of view is fixed, so a body's size on screen is
 * proportional to the canvas height over the camera's distance: to give the SM58 the same pixels on a 590 px canvas (a 1366 x 650 laptop window) as on a 708 px
 * one (1366 x 768), the radius follows the height. The package's `framing.radius` is the radius AT `FRAMING_REFERENCE_CANVAS_PX`; the camera's own 2 m lower limit
 * stays (a canvas shorter than about 545 px gets the 2 m radius and fewer pixels, said in docs, not hidden). Pure: no Babylon, no DOM.
 */
import type { FramingPose } from '../../design/packages'
import { ENSEMBLE_LOWER_RADIUS } from '../../camera/orbitFeel'

/** The canvas height (CSS px) a package's `framing.radius` is written for. */
export const FRAMING_REFERENCE_CANVAS_PX = 600

export function framingForCanvas(pose: FramingPose, canvasHeightPx: number): FramingPose {
  if (!Number.isFinite(canvasHeightPx) || canvasHeightPx <= 0) return pose
  return { ...pose, radius: Math.max(ENSEMBLE_LOWER_RADIUS, (pose.radius * canvasHeightPx) / FRAMING_REFERENCE_CANVAS_PX) }
}
