/**
 * Render on demand (C4, CA-18): the loop runs every rAF but only renders when
 * something changed. Pure decision (RenderScheduler) + a thin Babylon adapter.
 * ArcRotateCamera applies inertia inside scene.render(), so non-zero inertial
 * offsets keep frames coming until Babylon zeroes them.
 */
import type { ArcRotateCamera, Engine, Scene } from '@babylonjs/core'

export interface InertiaSource { inertialAlphaOffset: number; inertialBetaOffset: number; inertialRadiusOffset: number; inertialPanningX: number; inertialPanningY: number }
/** Structural view of any Babylon camera, enough to fingerprint where it looks. */
export interface SignatureCamera {
  uniqueId?: number
  alpha?: number; beta?: number; radius?: number; fov?: number
  target?: { x: number; y: number; z: number }
  position?: { x: number; y: number; z: number }
  rotation?: { x: number; y: number; z: number }
}
export interface SchedulerHooks {
  render(): void; camera(): InertiaSource | null; tweening(): boolean; busy?(): boolean
  /**
   * The camera that renders (scene.activeCamera). Its pose is compared with the
   * last rendered one, so an instant write (reduced-motion cut, walk <-> orbit
   * switch) shows up without anybody calling invalidate().
   */
  activeCamera?(): SignatureCamera | null
}

const v3 = (v: { x: number; y: number; z: number } | undefined): string => (v ? `${v.x},${v.y},${v.z}` : '-')
/** Cheap fingerprint of the active camera (identity + pose). */
export function cameraSignature(c: SignatureCamera | null): string {
  if (!c) return 'none'
  return `${c.uniqueId ?? 0}|${c.alpha ?? '-'},${c.beta ?? '-'},${c.radius ?? '-'}|${c.fov ?? '-'}|${v3(c.target)}|${v3(c.position)}|${v3(c.rotation)}`
}

export function hasInertia(c: InertiaSource | null): boolean {
  return !!c && (c.inertialAlphaOffset !== 0 || c.inertialBetaOffset !== 0 || c.inertialRadiusOffset !== 0 || c.inertialPanningX !== 0 || c.inertialPanningY !== 0)
}

export class RenderScheduler {
  private dirty = true
  private leases = new Map<string, number>()
  private count = 0
  constructor(private readonly hooks: SchedulerHooks) {}
  invalidate(): void { this.dirty = true }
  hold(name: string): () => void {
    this.leases.set(name, (this.leases.get(name) ?? 0) + 1)
    this.dirty = true
    let released = false
    return () => {
      if (released) return
      released = true
      const n = (this.leases.get(name) ?? 1) - 1
      if (n <= 0) this.leases.delete(name)
      else this.leases.set(name, n)
      this.dirty = true // one last frame shows the end state
    }
  }
  private lastSig: string | null = null
  private currentSig(): string | null {
    return this.hooks.activeCamera ? cameraSignature(this.hooks.activeCamera()) : null
  }
  shouldRender(): boolean {
    return (
      this.dirty || this.leases.size > 0 || this.hooks.tweening() || hasInertia(this.hooks.camera()) ||
      (this.hooks.busy?.() ?? false) || this.currentSig() !== this.lastSig
    )
  }
  tick(): boolean {
    if (!this.shouldRender()) return false
    this.dirty = false
    this.hooks.render()
    this.lastSig = this.currentSig() // after render: inertia / tween moves made during it are already shown
    this.count++
    return true
  }
  get renders(): number { return this.count }
  get leaseNames(): string[] { return [...this.leases.keys()] }
}

/** Structural view of a Babylon Scene, enough to render once and wait for readiness. */
export interface RenderableScene {
  render(): void
  isReady(): boolean
  executeWhenReady(fn: () => void): void
}
const waitingReady = new WeakSet<object>()
/**
 * Render one frame. A scene not ready yet (textures, shaders compiling) gets
 * ONE ready callback that asks for one more frame, never a per-frame
 * re-invalidation: the loop can still fall idle (0 renders) while it waits.
 */
export function renderSceneOnce(scene: RenderableScene, invalidate: () => void): void {
  scene.render()
  if (scene.isReady() || waitingReady.has(scene)) return
  waitingReady.add(scene)
  scene.executeWhenReady(() => {
    waitingReady.delete(scene)
    invalidate()
  })
}

let registered: RenderScheduler | null = null
/** attachRenderScheduler registers the page's scheduler; tests pass null to reset. */
export function registerScheduler(s: RenderScheduler | null): void { registered = s }
/** Ask for one frame from DOM-driven code (overlays, toggles). No-op until a scheduler exists. */
export function requestRender(): void { registered?.invalidate() }

/** Babylon glue: one runRenderLoop, invalidated by input, camera, scene and resize events. */
export function attachRenderScheduler(
  engine: Engine, scene: Scene, camera: ArcRotateCamera, canvas: HTMLCanvasElement,
  scheduler: RenderScheduler, bag?: { add(fn: () => void): void },
): void {
  const inv = (): void => scheduler.invalidate()
  for (const t of ['pointerdown', 'pointermove', 'pointerup', 'wheel'] as const) {
    canvas.addEventListener(t, inv, { passive: true })
    bag?.add(() => canvas.removeEventListener(t, inv))
  }
  // Keys act on the camera even when the canvas is not focused (arrow-key orbit, Babylon guard restore).
  for (const t of ['keydown', 'keyup'] as const) {
    window.addEventListener(t, inv, { passive: true })
    bag?.add(() => window.removeEventListener(t, inv))
  }
  const onResize = (): void => { engine.resize(); inv() }
  window.addEventListener('resize', onResize)
  bag?.add(() => window.removeEventListener('resize', onResize))
  const o1 = camera.onViewMatrixChangedObservable.add(inv)
  const o2 = scene.onNewMeshAddedObservable.add(inv)
  const o3 = scene.onMeshRemovedObservable.add(inv)
  bag?.add(() => { camera.onViewMatrixChangedObservable.remove(o1); scene.onNewMeshAddedObservable.remove(o2); scene.onMeshRemovedObservable.remove(o3) })
  registerScheduler(scheduler)
  bag?.add(() => { if (registered === scheduler) registerScheduler(null) })
  engine.runRenderLoop(() => void scheduler.tick())
  bag?.add(() => engine.stopRenderLoop())
}
