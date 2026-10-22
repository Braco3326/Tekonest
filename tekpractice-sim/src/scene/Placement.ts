/**
 * Placement ghost (ADR-0010 Décision 8): a translucent box follows the floor
 * point under the aim (crosshair or cursor), snapped to the 0.25 m grid and kept
 * inside the room; R rotates by 90°; confirm dispatches a SPAWN intent. Scene
 * adapter only — the orchestrator owns the graph.
 */
import { Color3, Mesh, MeshBuilder, Plane, Scene, StandardMaterial, Vector3 } from '@babylonjs/core'
import { rotateStep, snapToGrid } from '../explore/placement'
import { TOKENS } from '../design/tokens'
import type { Intent } from '../ui/intents'

export interface PlacementDeps {
  scene: Scene
  /** Screen point to aim with (ExploreController.aimPoint). */
  aim(): { x: number; y: number }
  /** Half extents of the walkable floor (m). */
  halfWidth: number
  halfDepth: number
  dispatch(intent: Intent): void
  /** Floor height under a point (procedural rooms: stage decks). Default 0. */
  floorAt?(x: number, z: number): number
}

const GHOST = { w: 0.5, h: 0.4, d: 0.5 }

export class Placement {
  private ghost: Mesh | null = null
  private deviceId: string | null = null
  private rotationDeg = 0
  private floor = Plane.FromPositionAndNormal(Vector3.Zero(), Vector3.Up())

  constructor(private deps: PlacementDeps) {
    deps.scene.onBeforeRenderObservable.add(() => this.follow())
  }

  get active(): boolean {
    return this.deviceId !== null
  }

  /** Current ghost pose (e2e/debug). */
  get pose(): { deviceId: string; position: [number, number, number]; rotationY: number } | null {
    if (!this.ghost || !this.deviceId) return null
    const p = this.ghost.position
    return { deviceId: this.deviceId, position: [p.x, this.floorHeight(p.x, p.z), p.z], rotationY: this.rotationDeg }
  }

  start(deviceId: string): void {
    this.cancel()
    this.deviceId = deviceId
    this.rotationDeg = 0
    const ghost = MeshBuilder.CreateBox('placement:ghost', { width: GHOST.w, height: GHOST.h, depth: GHOST.d }, this.deps.scene)
    const mat = new StandardMaterial('mat:placement', this.deps.scene)
    mat.diffuseColor = Color3.FromHexString(TOKENS.color.accent)
    mat.alpha = 0.35
    ghost.material = mat
    ghost.isPickable = false
    ghost.position.y = GHOST.h / 2
    this.ghost = ghost
    this.follow()
  }

  rotate(): void {
    if (!this.ghost) return
    this.rotationDeg = rotateStep(this.rotationDeg, 1)
    this.ghost.rotation.y = (this.rotationDeg * Math.PI) / 180
  }

  confirm(): void {
    const pose = this.pose
    if (!pose) return
    this.cancel()
    this.deps.dispatch({ type: 'SPAWN', deviceId: pose.deviceId, position: pose.position, rotationY: pose.rotationY })
  }

  cancel(): void {
    this.ghost?.material?.dispose()
    this.ghost?.dispose()
    this.ghost = null
    this.deviceId = null
  }

  private follow(): void {
    if (!this.ghost) return
    const { scene } = this.deps
    const camera = scene.activeCamera
    if (!camera) return
    const a = this.deps.aim()
    const ray = scene.createPickingRay(a.x, a.y, null, camera)
    const t = ray.intersectsPlane(this.floor)
    if (t === null || t < 0) return
    const hit = ray.origin.add(ray.direction.scale(t))
    const lim = (v: number, half: number) => Math.max(-half + 0.5, Math.min(half - 0.5, v))
    const x = snapToGrid(lim(hit.x, this.deps.halfWidth))
    const z = snapToGrid(lim(hit.z, this.deps.halfDepth))
    this.ghost.position.set(x, this.floorHeight(x, z) + GHOST.h / 2, z)
  }

  private floorHeight(x: number, z: number): number {
    return this.deps.floorAt?.(x, z) ?? 0
  }
}
