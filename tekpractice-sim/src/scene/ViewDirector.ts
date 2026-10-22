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
      // Arc limits must not snap the parked pose (the walker can be far / low).
      this.arc.lowerRadiusLimit = 0.05
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
  }

  flyToEnsemble(): void {
    if (!this.fromExplore) {
      this.rig.flyToEnsemble()
      return
    }
    const ms = this.rig.flyToPose(poseFromEye(this.walker.eyePosition(), this.walker.lookPoint()))
    this.fromExplore = false
    const handBack = (): void => {
      this.returnTimer = null
      this.arc.detachControl()
      this.arc.lowerRadiusLimit = 2
      this.walker.resume()
    }
    if (ms === 0) handBack()
    else this.returnTimer = setTimeout(handBack, ms + 20)
  }
}
