/**
 * CameraRig — flies the ArcRotateCamera between the ENSEMBLE pose (the level's
 * environment preset) and a FOCUS pose auto-framing one device (ADR-0008).
 * Eased 450 ms (CameraTween, zero idle cost); prefers-reduced-motion → instant cut, no fly.
 * Camera-only module: imports no engine code and never mutates any graph state.
 */
import { Vector3, type ArcRotateCamera } from '@babylonjs/core'
import { shortestAngle } from '../camera/tween'
import { motionEnabled, TOKENS } from '../design/tokens'
import { CameraTween, type TweenCamera } from './cameraTween'

export interface CameraPose {
  alpha: number
  beta: number
  radius: number
  target: Vector3
}

/** What the rig needs to frame a device: world bounds, nothing engine-side. */
export interface FrameTarget {
  center: Vector3
  /** Half-diagonal of the device's world bounding box (meters). */
  boundingRadius: number
}

/**
 * What FocusPatch needs from "the camera" (ADR-0010 Décision 1): CameraRig in
 * orbit view, ViewDirector when the learner walks in Explore view.
 */
export interface CameraDirector {
  flyToDevice(frame: FrameTarget): void
  flyToEnsemble(): void
}

/** Placeholder port panels face −Z (DeviceSpawner) — arrive looking at them. */
const FOCUS_ALPHA = -Math.PI / 2
const FOCUS_BETA = 1.15

export class CameraRig implements CameraDirector {
  private ensemble: CameraPose
  private tween: CameraTween

  constructor(private camera: ArcRotateCamera) {
    this.ensemble = this.currentPose()
    const scene = camera.getScene()
    this.tween = new CameraTween(asTweenCamera(camera), scene)
    // The learner grabbing the view cancels a flight in progress.
    const canvas = scene.getEngine().getRenderingCanvas()
    if (canvas) this.tween.cancelOnUserInput(canvas)
    else console.warn('CameraRig: no rendering canvas; flights cannot be cancelled by user input')
  }

  private currentPose(): CameraPose {
    return {
      alpha: this.camera.alpha,
      beta: this.camera.beta,
      radius: this.camera.radius,
      target: this.camera.target.clone(),
    }
  }

  /** Auto-frame the device's active panel (spec §2): ports face you, orbit free. */
  flyToDevice(frame: FrameTarget): void {
    this.fly({
      alpha: FOCUS_ALPHA,
      beta: FOCUS_BETA,
      radius: Math.min(6, Math.max(0.9, frame.boundingRadius * 2.6)),
      target: frame.center,
    })
  }

  flyToEnsemble(): void {
    this.fly(this.ensemble)
  }

  /** Fly to an arbitrary pose (ViewDirector: back to the walker's eye). Returns the flight time in ms (0 = cut). */
  flyToPose(to: CameraPose): number {
    this.fly(to)
    return motionEnabled() ? TOKENS.focus.flyMs : 0
  }

  private fly(to: CameraPose): void {
    void this.tween.to({
      alpha: to.alpha,
      beta: to.beta,
      radius: to.radius,
      target: [to.target.x, to.target.y, to.target.z],
    })
  }
}

/** Structural view of the Babylon camera (its setTarget wants a Vector3, the tween speaks plain x/y/z). */
function asTweenCamera(cam: ArcRotateCamera): TweenCamera {
  const scratch = new Vector3() // reused: no per-frame allocation while a tween runs
  return {
    get alpha() { return cam.alpha },
    set alpha(v) { cam.alpha = v },
    get beta() { return cam.beta },
    set beta(v) { cam.beta = v },
    get radius() { return cam.radius },
    set radius(v) { cam.radius = v },
    get target() { return cam.target },
    setTarget: (t) => {
      scratch.set(t.x, t.y, t.z)
      cam.setTarget(scratch)
    },
    get lowerRadiusLimit() { return cam.lowerRadiusLimit },
    get upperRadiusLimit() { return cam.upperRadiusLimit },
    get lowerBetaLimit() { return cam.lowerBetaLimit },
    get upperBetaLimit() { return cam.upperBetaLimit },
  }
}

/** Moved to camera/tween.ts; re-exported so existing imports keep working. */
export { shortestAngle }
