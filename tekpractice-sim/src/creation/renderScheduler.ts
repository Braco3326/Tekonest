/**
 * Render on demand (C4, CA-18): the loop runs every rAF but only renders when
 * something changed. Pure decision (RenderScheduler) + a thin Babylon adapter.
 * ArcRotateCamera applies inertia inside scene.render(), so non-zero inertial
 * offsets keep frames coming until Babylon zeroes them.
 */
import type { ArcRotateCamera, Engine, Scene } from '@babylonjs/core'

export interface InertiaSource { inertialAlphaOffset: number; inertialBetaOffset: number; inertialRadiusOffset: number; inertialPanningX: number; inertialPanningY: number }
export interface SchedulerHooks { render(): void; camera(): InertiaSource | null; tweening(): boolean; busy?(): boolean }

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
  shouldRender(): boolean {
    return this.dirty || this.leases.size > 0 || this.hooks.tweening() || hasInertia(this.hooks.camera()) || (this.hooks.busy?.() ?? false)
  }
  tick(): boolean {
    if (!this.shouldRender()) return false
    this.dirty = false
    this.hooks.render()
    this.count++
    return true
  }
  get renders(): number { return this.count }
  get leaseNames(): string[] { return [...this.leases.keys()] }
}

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
  engine.runRenderLoop(() => void scheduler.tick())
  bag?.add(() => engine.stopRenderLoop())
}
