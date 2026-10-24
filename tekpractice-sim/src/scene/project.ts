/**
 * World point → CSS pixel point on the page (extracted from
 * game.ts project(); shared by the legacy debug hook and Mode Création).
 * Null only when the canvas has no render size or the result is not finite.
 */
import { Matrix, Vector3, type Camera, type Engine, type Scene } from '@babylonjs/core'

export function projectToScreen(
  world: Vector3,
  scene: Scene,
  camera: Camera,
  engine: Engine,
  canvas: HTMLCanvasElement,
): { x: number; y: number } | null {
  const w = engine.getRenderWidth()
  const h = engine.getRenderHeight()
  if (w <= 0 || h <= 0) return null
  // Exactly the legacy maths: the scene's CURRENT transform (whatever camera
  // rendered last, e.g. the walker in Explore view) and `camera`'s viewport.
  const projected = Vector3.Project(world, Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(w, h))
  const rect = canvas.getBoundingClientRect()
  const x = rect.left + (projected.x / w) * rect.width
  const y = rect.top + (projected.y / h) * rect.height
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}
