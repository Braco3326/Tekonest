/**
 * CameraRig — flies the ArcRotateCamera between the ENSEMBLE pose (the level's
 * environment preset) and a FOCUS pose auto-framing one device (ADR-0008).
 * Eased 450 ms (CameraTween, zero idle cost); prefers-reduced-motion → instant cut, no fly.
 * Camera-only module: imports no engine code and never mutates any graph state.
 */
import { Vector3, type ArcRotateCamera } from '@babylonjs/core'
import { shortestAngle } from '../camera/tween'
import { ENSEMBLE_LOWER_RADIUS, radiusLimitFor } from '../camera/orbitFeel'
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
  /**
   * Orbit around `point` from now on: tween the target only (alpha, beta, radius kept).
   * `focusRadius` = the focused device's bounding radius when re-framing a focus
   * (its dolly floor stays); omitted = a floor pivot (Ensemble floor).
   */
  repivot(point: Vector3, focusRadius?: number): void
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

  /**
   * Auto-frame the device's active panel (spec §2): ports face you, orbit free.
   * The dolly may then come as close as radiusLimitFor(boundingRadius) (Task 3).
   */
  flyToDevice(frame: FrameTarget): void {
    this.fly(
      {
        alpha: FOCUS_ALPHA,
        beta: FOCUS_BETA,
        radius: Math.min(6, Math.max(0.9, frame.boundingRadius * 2.6)),
        target: frame.center,
      },
      radiusLimitFor(frame.boundingRadius),
    )
  }

  /** Back to the env/room overview pose captured at construction; dolly floor back to the env default. */
  flyToEnsemble(): void {
    this.fly(this.ensemble, ENSEMBLE_LOWER_RADIUS)
  }

  /**
   * Floor re-pivot / late model re-frame (Task 4): only the target moves, the
   * learner's angle and distance stay. Floor pivot → Ensemble dolly floor;
   * focus re-frame → the device's floor. Never above the current radius.
   */
  repivot(point: Vector3, focusRadius?: number): void {
    this.fly(
      { alpha: this.camera.alpha, beta: this.camera.beta, radius: this.camera.radius, target: point },
      focusRadius === undefined ? ENSEMBLE_LOWER_RADIUS : radiusLimitFor(focusRadius),
    )
  }

  /** Fly to an arbitrary pose (ViewDirector: back to the walker's eye). Returns the flight time in ms (0 = cut). */
  flyToPose(to: CameraPose): number {
    this.fly(to)
    return motionEnabled() ? TOKENS.focus.flyMs : 0
  }

  /** Bumped by every flight: only the latest one may set the dolly floor when it ends. */
  private flightSeq = 0

  /**
   * `lowerRadius` (optional) = the dolly floor for the destination. At take-off
   * the floor never exceeds where the camera stands nor where it goes (Babylon
   * would otherwise clamp the radius = a visible jump); the full floor applies
   * when the flight ends (or the learner takes over).
   */
  private fly(to: CameraPose, lowerRadius?: number): void {
    const seq = ++this.flightSeq
    if (lowerRadius !== undefined) {
      this.camera.lowerRadiusLimit = Math.min(lowerRadius, this.camera.radius, to.radius)
    }
    void this.tween
      .to({
        alpha: to.alpha,
        beta: to.beta,
        radius: to.radius,
        target: [to.target.x, to.target.y, to.target.z],
      })
      .then(() => {
        if (lowerRadius === undefined || seq !== this.flightSeq) return
        this.camera.lowerRadiusLimit = Math.min(lowerRadius, this.camera.radius)
      })
  }
}

/**
 * Structural view of the Babylon camera (its setTarget wants a Vector3, the tween speaks plain x/y/z).
 * Exported for the headless test (tests/scene/cameraRig.test.ts).
 */
export function asTweenCamera(cam: ArcRotateCamera): TweenCamera {
  return {
    get alpha() { return cam.alpha },
    set alpha(v) { cam.alpha = v },
    get beta() { return cam.beta },
    set beta(v) { cam.beta = v },
    get radius() { return cam.radius },
    set radius(v) { cam.radius = v },
    get target() { return cam.target },
    // A FRESH Vector3 per call, on purpose. Babylon's setTarget(Vector3) stores
    // the reference: a reused scratch made cam._target === scratch from the
    // second frame on, so setTarget saw "same position" and early-returned,
    // skipping rebuildAnglesAndRadius and onMeshTargetChangedObservable. One
    // small allocation per frame, only while a 450 ms flight runs: negligible.
    setTarget: (t) => cam.setTarget(new Vector3(t.x, t.y, t.z)),
    get lowerRadiusLimit() { return cam.lowerRadiusLimit },
    get upperRadiusLimit() { return cam.upperRadiusLimit },
    get lowerBetaLimit() { return cam.lowerBetaLimit },
    get upperBetaLimit() { return cam.upperBetaLimit },
  }
}

/** Moved to camera/tween.ts; re-exported so existing imports keep working. */
export { shortestAngle }
