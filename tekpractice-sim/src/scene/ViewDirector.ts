/**
 * ViewDirector — the CameraDirector FocusPatch talks to (ADR-0010 Décision 1).
 * Orbit view: plain CameraRig behaviour (ensemble ⇄ focus, ADR-0008).
 * Explore view: entering focus first parks the ArcRotateCamera exactly on the
 * walker's eye (no visual jump), then flies to the device; leaving focus flies
 * back to that eye and hands control back to the walking camera.
 * Camera-only: never touches the graph.
 */
import { ArcRotateCamera, Scene, Vector3 } from '@babylonjs/core'
import type { CameraDirector, CameraPose, CameraRig, FrameTarget } from './CameraRig'
import { ENSEMBLE_LOWER_RADIUS, ORBIT_FEEL } from '../camera/orbitFeel'
import { motionEnabled, TOKENS } from '../design/tokens'

/** What the director needs from the walking camera (ExploreController). */
export interface Walker {
  /** True when Explore is the base view (not orbit). */
  readonly exploreView: boolean
  eyePosition(): Vector3
  /** A point straight ahead of the eye (the look target). */
  lookPoint(): Vector3
  /** Explore camera becomes active / inactive (inputs, render camera). */
  resume(): void
  suspend(): void
}

/** Arc pose that puts the ArcRotateCamera at `eye` looking at `target`. */
export function poseFromEye(eye: Vector3, target: Vector3): CameraPose {
  const o = eye.subtract(target)
  const radius = Math.max(0.05, o.length())
  return {
    alpha: Math.atan2(o.z, o.x),
    beta: Math.acos(Math.min(1, Math.max(-1, o.y / radius))),
    radius,
    target: target.clone(),
  }
}

export class ViewDirector implements CameraDirector {
  private fromExplore = false
  private returnTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private scene: Scene,
    private arc: ArcRotateCamera,
    private rig: CameraRig,
    private walker: Walker,
  ) {}

  /** True while a focus started from Explore is active. */
  get focusedFromExplore(): boolean {
    return this.fromExplore
  }

  flyToDevice(frame: FrameTarget): void {
    if (this.returnTimer) {
      clearTimeout(this.returnTimer)
      this.returnTimer = null
    }
    if (this.walker.exploreView && !this.fromExplore) {
      const pose = poseFromEye(this.walker.eyePosition(), frame.center)
      // Arc limits must not snap the parked pose (the walker can be far / low,
      // or look UP at gear on a stand: beta past the orbit feel's floor guard).
      this.arc.lowerRadiusLimit = 0.05
      this.relaxBetaLimits()
      this.arc.alpha = pose.alpha
      this.arc.beta = pose.beta
      this.arc.radius = pose.radius
      this.arc.setTarget(pose.target)
      this.walker.suspend()
      this.scene.activeCamera = this.arc
      this.arc.attachControl(true)
      this.fromExplore = true
    }
    this.rig.flyToDevice(frame)
    if (this.fromExplore) {
      // Parking needed relaxed beta limits; once the focus flight has landed
      // (FOCUS_BETA is inside the guard) the orbit must not dip under the floor.
      this.clearBetaTimer()
      const ms = motionEnabled() ? TOKENS.focus.flyMs : 0
      this.betaTimer = setTimeout(() => {
        this.betaTimer = null
        this.restoreBetaLimits()
      }, ms + 20)
    }
  }

  private betaTimer: ReturnType<typeof setTimeout> | null = null

  private clearBetaTimer(): void {
    if (this.betaTimer) clearTimeout(this.betaTimer)
    this.betaTimer = null
  }

  private restoreBetaLimits(): void {
    this.arc.lowerBetaLimit = ORBIT_FEEL.lowerBetaLimit
    this.arc.upperBetaLimit = ORBIT_FEEL.upperBetaLimit
  }

  private relaxBetaLimits(): void {
    this.arc.lowerBetaLimit = 0.01
    this.arc.upperBetaLimit = Math.PI - 0.01
  }

  /**
   * Orbit view, or a focus started from Explore (the arc camera is live): move
   * the pivot. Walking (Explore, no focus): no-op — the walker has no pivot and
   * ADR-0010's mouse rules stay untouched.
   */
  repivot(point: Vector3, focusRadius?: number): void {
    if (this.walker.exploreView && !this.fromExplore) return
    this.rig.repivot(point, focusRadius)
  }

  flyToPreset(pose: CameraPose): number {
    return this.rig.flyToPreset(pose) // presets are an orbit-view feature (the UI hides them while walking)
  }

  flyToEnsemble(): void {
    if (!this.fromExplore) {
      // Walking (HOME from Explore with nothing framed): the orbit camera is
      // not shown — do not fly it in the background.
      if (this.walker.exploreView) return
      this.rig.flyToEnsemble()
      return
    }
    // The walker's eye may sit outside the floor guard (crouched, looking up):
    // relax it again so the return flight lands exactly on the eye.
    this.clearBetaTimer()
    this.relaxBetaLimits()
    const ms = this.rig.flyToPose(poseFromEye(this.walker.eyePosition(), this.walker.lookPoint()))
    this.fromExplore = false
    const handBack = (): void => {
      this.returnTimer = null
      this.restoreBetaLimits()
      // The learner may have switched to Orbit (V) during the flight: then the
      // orbit camera keeps control and the walker stays parked (review #4), and
      // its dolly floor (an Orbit focus may have set one) is left alone.
      if (!this.walker.exploreView) return
      // Hand back with the designer feel's floor (Task 3).
      this.arc.lowerRadiusLimit = ENSEMBLE_LOWER_RADIUS
      this.arc.detachControl()
      this.walker.resume()
    }
    if (ms === 0) handBack()
    else this.returnTimer = setTimeout(handBack, ms + 20)
  }
}
