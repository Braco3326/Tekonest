/**
 * CameraTween — cancellable camera tween with zero idle cost: the
 * onBeforeRender observer exists only while a tween is running.
 * Structural types only, so it is testable without a Babylon engine.
 */
import { clampPose, planTween, samplePose, TweenClock, type PoseLimits, type PoseValues } from '../camera/tween'
import { motionEnabled, TOKENS } from '../design/tokens'

export interface Vec3Like {
  x: number
  y: number
  z: number
}

export interface TweenCamera {
  alpha: number
  beta: number
  radius: number
  readonly target: Vec3Like
  setTarget(target: Vec3Like): void
  lowerRadiusLimit?: number | null
  upperRadiusLimit?: number | null
  lowerBetaLimit?: number | null
  upperBetaLimit?: number | null
}

export interface TweenScene {
  onBeforeRenderObservable: {
    add(cb: () => void): unknown
    remove(observer: any): unknown
  }
}

export interface EventSourceLike {
  addEventListener(type: string, cb: () => void): void
  removeEventListener(type: string, cb: () => void): void
}

export type TweenResult = 'done' | 'cancelled'

export class CameraTween {
  private observer: unknown = null
  private clock: TweenClock | null = null
  private settle: ((r: TweenResult) => void) | null = null
  private disposeInput: (() => void) | null = null

  constructor(
    private readonly camera: TweenCamera,
    private readonly scene: TweenScene,
    private readonly now: () => number = () => performance.now(),
  ) {}

  get active(): boolean {
    return this.clock !== null
  }

  currentPose(): PoseValues {
    const c = this.camera
    return { alpha: c.alpha, beta: c.beta, radius: c.radius, target: [c.target.x, c.target.y, c.target.z] }
  }

  private limits(): PoseLimits {
    const c = this.camera
    const lim: PoseLimits = {}
    if (c.lowerRadiusLimit != null) lim.lowerRadius = c.lowerRadiusLimit
    if (c.upperRadiusLimit != null) lim.upperRadius = c.upperRadiusLimit
    if (c.lowerBetaLimit != null) lim.lowerBeta = c.lowerBetaLimit
    if (c.upperBetaLimit != null) lim.upperBeta = c.upperBetaLimit
    return lim
  }

  /** setTarget first: Babylon's setTarget rebuilds the angles from the position. */
  private apply(p: PoseValues): void {
    this.camera.setTarget({ x: p.target[0], y: p.target[1], z: p.target[2] })
    this.camera.alpha = p.alpha
    this.camera.beta = p.beta
    this.camera.radius = p.radius
  }

  /** Tween to `pose`. A new call cancels the previous tween. Reduced motion: instant, resolves 'done'. */
  to(pose: PoseValues, ms: number = TOKENS.focus.flyMs): Promise<TweenResult> {
    this.cancel()
    const goal = clampPose(planTween(this.currentPose(), pose), this.limits())
    if (!motionEnabled() || ms <= 0) {
      this.apply(goal)
      return Promise.resolve('done')
    }
    const from = this.currentPose()
    const clock = new TweenClock(ms)
    clock.start(this.now())
    this.clock = clock
    return new Promise<TweenResult>((resolve) => {
      this.settle = resolve
      this.observer = this.scene.onBeforeRenderObservable.add(() => {
        const p = clock.progress(this.now())
        this.apply(samplePose(from, goal, p))
        if (clock.done) this.finish('done')
      })
    })
  }

  cancel(): void {
    if (this.clock) this.finish('cancelled')
  }

  private finish(result: TweenResult): void {
    const settle = this.settle
    if (this.observer !== null) this.scene.onBeforeRenderObservable.remove(this.observer)
    this.observer = null
    this.clock?.cancel()
    this.clock = null
    this.settle = null
    settle?.(result)
  }

  /**
   * Any pointerdown/wheel on the canvas or keydown on the window cancels an
   * active tween (the user takes over). Attaches once; returns a disposer.
   */
  cancelOnUserInput(canvas: EventSourceLike, win?: EventSourceLike): () => void {
    if (this.disposeInput) return this.disposeInput
    const w: EventSourceLike | null = win ?? (typeof window !== 'undefined' ? window : null)
    const onInput = (): void => {
      if (this.active) this.cancel()
    }
    canvas.addEventListener('pointerdown', onInput)
    canvas.addEventListener('wheel', onInput)
    w?.addEventListener('keydown', onInput)
    this.disposeInput = () => {
      canvas.removeEventListener('pointerdown', onInput)
      canvas.removeEventListener('wheel', onInput)
      w?.removeEventListener('keydown', onInput)
      this.disposeInput = null
    }
    return this.disposeInput
  }
}
