/**
 * SceneHost (C3, P15, C4): ONE Babylon Engine for the page, ONE Scene per
 * place. `load()` tears the current scene down completely (no reload, no
 * leak) and builds the next one; `apply()` reconciles the scene from a design
 * through the pure `planSceneOps`. State-based: a grouped store change (one
 * notify) is applied in one go, the scene never shows an in-between state.
 *
 * Loads may overlap (fast place changes): every load has a token and only the
 * latest one finishes; a design applied while a place loads is the one shown.
 * The scene is read-only towards the rig: the store owns it, this only draws.
 */
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  SceneLoader,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import type { Registry } from '../engine/CatalogLoader'
import type { PortRef } from '../engine/types'
import type { RoomLayout } from '../explore/roomLayout'
import type { DesignState, Placement } from '../trials/trial'
import { DeviceSpawner, type DeviceInstance } from '../scene/DeviceSpawner'
import { CableRenderer } from '../scene/CableRenderer'
import { CameraRig } from '../scene/CameraRig'
import { installDesignerOrbitInput, uninstallDesignerOrbitInput, type DesignerOrbitPointersInput } from '../scene/designerOrbitInput'
import { applyOrbitFeel, ENSEMBLE_LOWER_RADIUS } from '../camera/orbitFeel'
import { isSoftwareRenderer } from '../render/detect'
import { assetUrl } from '../assetUrl'
import { DisposableBag } from '../util/disposable'
import { attachRenderScheduler, type RenderScheduler } from './renderScheduler'
import { cableKey, planSceneOps } from './sceneDiff'
import { placeFromKey, placeKey, type PlaceRef } from './places'
import { blankData, loadPlaceData, type PlaceData } from './placeData'

/** Nuit (brief §2) until CREATION_TOKENS land (Task 7). */
const NUIT = '#131114'
const DEG = Math.PI / 180
type RoomBuild = (scene: Scene, file: Extract<PlaceData, { kind: 'room' }>['file'], layout: RoomLayout) => unknown

export class SceneHost {
  readonly engine: Engine
  private _scene: Scene | null = null
  private _camera: ArcRotateCamera | null = null
  private _rig: CameraRig | null = null
  private _layout: RoomLayout | null = null
  private _place: PlaceRef | null = null
  private orbitInput: DesignerOrbitPointersInput | null = null
  private spawner: DeviceSpawner | null = null
  private cables: CableRenderer | null = null
  private instances = new Map<string, DeviceInstance>()
  /** Scene plumbing (render loop, input invalidation): disposed after the scene's own objects. */
  private bag: DisposableBag | null = null
  /** Controllers attached to this place later (focus, patch, …: Tasks 9, 18, 26): disposed FIRST. */
  private controllers: DisposableBag | null = null
  /** The design the scene shows (null = nothing drawn yet). */
  private applied: DesignState | null = null
  /** The place key being loaded, or null when no load is in flight. */
  private loadingKey: string | null = null
  /** The latest design asked for while a load is in flight. */
  private pending: DesignState | null = null
  private loadSeq = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly registry: Registry,
    private readonly scheduler: RenderScheduler,
    /** Tests inject a NullEngine; the app lets the host create the page's only Engine. */
    engine?: Engine,
  ) {
    this.engine = engine ?? new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true })
    if (!engine && isSoftwareRenderer(this.engine.getGlInfo().renderer)) {
      this.engine.setHardwareScalingLevel(1.5)
      console.info('[render] software GL → scaling 1.5')
    }
  }

  get scene(): Scene | null {
    return this._scene
  }
  get camera(): ArcRotateCamera | null {
    return this._camera
  }
  get rig(): CameraRig | null {
    return this._rig
  }
  get layout(): RoomLayout | null {
    return this._layout
  }
  /** The place on screen (null while nothing is loaded; a place being loaded is not "on screen" yet). */
  get place(): PlaceRef | null {
    return this._place
  }
  /** A bag for controllers bound to this place's scene; disposed first on teardown. Null when no scene. */
  get placeBag(): DisposableBag | null {
    return this.controllers
  }

  instance(id: string): DeviceInstance | undefined {
    return this.instances.get(id)
  }

  /** World position of a port marker, or null when the instance or port is unknown. */
  portWorld(ref: PortRef): Vector3 | null {
    const inst = this.instances.get(ref.instance)
    const marker = inst?.portMarkers.get(ref.port)
    if (!inst || !marker) return null
    inst.root.computeWorldMatrix(true)
    marker.computeWorldMatrix(true)
    return marker.getAbsolutePosition().clone()
  }

  /** Dispose the current scene, build `place` and show `design` in it. Resolves when shown (or superseded). */
  async load(place: PlaceRef, design: DesignState): Promise<void> {
    const token = ++this.loadSeq
    this.teardown()
    this.loadingKey = placeKey(place)
    this.pending = structuredClone(design)
    let data: PlaceData = await loadPlaceData(place) // never throws
    // RoomBuilder ships in its own lazy chunk (the legacy sandbox does the same).
    let build: RoomBuild | null = null
    if (data.kind === 'room') {
      try {
        build = (await import('../scene/RoomBuilder')).buildRoom
      } catch (e) {
        console.warn('[creation] générateur de salle indisponible, salle vide neutre', e)
        data = blankData()
      }
    }
    if (token !== this.loadSeq) return

    const scene = this.buildScene(data, build)
    if (data.kind === 'set' && data.env.set) {
      await this.importSet(scene, data.env.set)
      if (token !== this.loadSeq) return
    }
    this._place = place
    this.loadingKey = null
    const latest = this.pending ?? design
    this.pending = null
    this.reconcile(latest)
  }

  /**
   * Show `design`. Another place (roomId) → load it; a load in flight → this
   * design is shown when it ends; otherwise reconcile in place.
   */
  apply(design: DesignState): void {
    const key = placeKey(placeFromKey(design.roomId))
    if (this.loadingKey !== null) {
      this.pending = structuredClone(design)
      if (key !== this.loadingKey) this.startLoad(design)
      return
    }
    // planSceneOps' reloadPlace on the normalised key: null and 'blank' are the same place.
    if (!this._scene || !this._place || key !== placeKey(this._place)) {
      this.startLoad(design)
      return
    }
    this.reconcile(design)
  }

  /** Scene teardown (C3). The Engine survives; a load in flight is abandoned. */
  dispose(): void {
    this.loadSeq++
    this.loadingKey = null
    this.pending = null
    this.teardown()
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private startLoad(design: DesignState): void {
    this.load(placeFromKey(design.roomId), design).catch((e: unknown) => console.error('[creation] place load failed', e))
  }

  private teardown(): void {
    this.controllers?.dispose()
    this.cables?.dispose()
    for (const inst of this.instances.values()) inst.dispose()
    this.instances.clear()
    this._rig?.dispose()
    if (this._camera && this.orbitInput) {
      this._camera.detachControl()
      uninstallDesignerOrbitInput(this._camera, this.orbitInput)
    }
    this.bag?.dispose() // stops the render loop, input invalidation, scheduler registration
    this._scene?.dispose()
    this._scene = null
    this._camera = null
    this._rig = null
    this._layout = null
    this._place = null
    this.orbitInput = null
    this.spawner = null
    this.cables = null
    this.bag = null
    this.controllers = null
    this.applied = null
  }

  private buildScene(data: PlaceData, buildRoom: RoomBuild | null): Scene {
    const scene = new Scene(this.engine)
    const nuit = Color3.FromHexString(NUIT)
    scene.clearColor = new Color4(nuit.r, nuit.g, nuit.b, 1)

    // Overview from the audience side (+z) looking at the stage end (−z), as the legacy room boot.
    const roomRadius = Math.min(55, Math.max(8, Math.max(data.width, data.length) * 0.8))
    const env = data.kind === 'set' ? data.env : null
    const camera = new ArcRotateCamera(
      'cam',
      env ? env.camera.alpha : Math.PI / 2,
      env ? env.camera.beta : 1.05,
      env ? env.camera.radius : roomRadius,
      env ? Vector3.FromArray(env.camera.target) : new Vector3(0, 1, 0),
      scene,
    )
    const orbitInput = installDesignerOrbitInput(camera)
    camera.attachControl(true)
    camera.lowerRadiusLimit = ENSEMBLE_LOWER_RADIUS
    camera.upperRadiusLimit = env ? 40 : Math.max(40, roomRadius * 1.5)
    applyOrbitFeel(camera)
    // Explicit: a disposed previous camera must never leave Babylon falling back to cameras[0].
    scene.activeCamera = camera

    const hemi = new HemisphericLight('light', new Vector3(0.2, 1, 0.3), scene)
    hemi.intensity = 0.95
    hemi.groundColor = Color3.FromHexString('#DDE1E8')
    const key = new DirectionalLight('key', new Vector3(-0.35, -1, 0.25), scene)
    key.intensity = 0.35

    if (data.kind === 'room' && buildRoom) {
      buildRoom(scene, data.file, data.layout)
      this._layout = data.layout
    } else {
      const ground = MeshBuilder.CreateGround('stage', { width: data.width, height: data.length }, scene)
      const mat = new StandardMaterial('mat:stage', scene)
      mat.diffuseColor = Color3.FromHexString(env ? env.backdrop.floorColor : NUIT)
      mat.specularColor = Color3.Black()
      ground.material = mat
      ground.isPickable = false
      ground.metadata = { pivotSurface: true }
    }

    const bag = new DisposableBag()
    this._scene = scene
    this._camera = camera
    this.orbitInput = orbitInput
    this.bag = bag
    this.controllers = new DisposableBag()
    this.spawner = new DeviceSpawner(scene, this.registry)
    this.cables = new CableRenderer(scene, undefined, { pulses: false })
    this._rig = new CameraRig(camera)
    attachRenderScheduler(this.engine, scene, camera, this.canvas, this.scheduler, bag)
    this.scheduler.invalidate()
    return scene
  }

  /** The venue set .glb (as game.ts): non-blocking, a failure keeps the plain floor. */
  private async importSet(scene: Scene, set: NonNullable<Extract<PlaceData, { kind: 'set' }>['env']['set']>): Promise<void> {
    try {
      const { meshes } = await SceneLoader.ImportMeshAsync(null, assetUrl('assets/environments/'), set.glb, scene)
      if (scene.isDisposed) {
        for (const m of meshes) m.dispose(false, true)
        return
      }
      const root = meshes[0]
      root.name = 'env:set'
      if (set.scale) root.scaling.setAll(set.scale)
      if (set.rotationY) root.rotation = new Vector3(0, set.rotationY * DEG, 0)
      if (set.position) root.position = Vector3.FromArray(set.position)
      for (const m of meshes) {
        m.isPickable = false
        m.metadata = { ...(m.metadata ?? {}), pivotSurface: true }
      }
      scene.getMeshByName('stage')?.setEnabled(false) // the set brings its own floor
      this.scheduler.invalidate()
    } catch {
      if (!scene.isDisposed) console.warn(`[creation] décor ${set.glb} indisponible, sol simple conservé`)
    }
  }

  /** Bring the scene from `this.applied` to `design` (P15). */
  private reconcile(design: DesignState): void {
    const spawner = this.spawner
    const cables = this.cables
    if (!spawner || !cables) return
    const ops = planSceneOps(this.applied, design)

    for (const key of ops.cablesRemove) cables.removeCable(key)
    for (const id of ops.remove) {
      this.instances.get(id)?.dispose()
      this.instances.delete(id)
    }
    const touched = new Set<string>()
    for (const p of ops.spawn) {
      let inst: DeviceInstance
      try {
        inst = spawner.spawn(p.deviceId, Vector3.FromArray(p.position_m), p.instanceId)
      } catch (e) {
        console.warn(`[creation] ${p.instanceId}: appareil inconnu, non affiché`, e)
        continue
      }
      this.instances.set(p.instanceId, inst)
      this.pose(inst, p)
      touched.add(p.instanceId)
      // The .glb replaces the placeholder later: its ports move, its cables follow.
      void inst.modelReady.then((ok) => {
        if (this.instances.get(p.instanceId) !== inst) return // removed or place changed meanwhile
        if (ok) this.redrawCablesOf(new Set([p.instanceId]))
        this.scheduler.invalidate()
      })
    }
    for (const p of ops.move) {
      const inst = this.instances.get(p.instanceId)
      if (!inst) continue
      this.pose(inst, p)
      touched.add(p.instanceId)
    }
    this.applied = structuredClone(design)
    for (const c of ops.cablesAdd) this.drawCable(c.key, c.a, c.b)
    // Endpoints follow moved / respawned devices.
    this.redrawCablesOf(touched)
    this.scheduler.invalidate()
  }

  private pose(inst: DeviceInstance, p: Placement): void {
    inst.root.position = Vector3.FromArray(p.position_m)
    // Yaw about +y (legacy convention), tilt about the device's own x axis.
    inst.root.rotation = new Vector3((p.tiltDeg ?? 0) * DEG, p.yawDeg * DEG, 0)
    // The contact shadow stays on the floor whatever the device height (DeviceSpawner).
    const blob = inst.root.getChildMeshes(true, (n) => n.name === `shadow:${inst.instanceId}`)[0]
    if (blob) blob.position.y = 0.002 - p.position_m[1]
    inst.root.computeWorldMatrix(true)
    for (const m of inst.root.getChildMeshes(false)) m.computeWorldMatrix(true)
  }

  private drawCable(key: string, a: PortRef, b: PortRef): void {
    const pa = this.portWorld(a)
    const pb = this.portWorld(b)
    if (pa && pb) this.cables?.addCable(key, pa, pb) // addCable replaces by key
  }

  private redrawCablesOf(ids: Set<string>): void {
    if (!ids.size || !this.applied) return
    for (const { a, b } of this.applied.rig.connections)
      if (ids.has(a.instance) || ids.has(b.instance)) this.drawCable(cableKey(a, b), a, b)
  }
}
