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
  HighlightLayer,
  Mesh,
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
import {
  installDesignerOrbitInput,
  uninstallDesignerOrbitInput,
  type DesignerOrbitPointersInput,
} from '../scene/designerOrbitInput'
import { applyOrbitFeel, ENSEMBLE_LOWER_RADIUS } from '../camera/orbitFeel'
import { isSoftwareRenderer } from '../render/detect'
import { assetUrl } from '../assetUrl'
import { DisposableBag } from '../util/disposable'
import { attachRenderScheduler, type RenderScheduler } from './renderScheduler'
import { cableKey, planSceneOps } from './sceneDiff'
import { placeFromKey, placeKey, type PlaceRef } from './places'
import { blankData, loadPlaceData, type PlaceData } from './placeData'
import { CREATION_TOKENS } from '../design/creationTokens'
import type { RoomTheme } from '../scene/RoomBuilder'
import { CREATION_DEVICE_THEME, CREATION_ROOM_THEME } from './sceneTheme'
import { ViewCubeWidget, type CubeHooks } from './viewCubeWidget'
import { ExploreController, type ExploreUi, type FocusHandles } from '../scene/ExploreController'
import { roomWalls } from '../explore/collision'
import { CREATION_WALK_SETTINGS, walkSpawn } from './walk'

/** What the shell gives the walk view (Task 19). */
export interface WalkOptions {
  /** Ear height above the floor (1.2 m seated, 1.7 m standing). */
  eyeHeight: number
  /** A key the walker may take (the shell: only while the 3D canvas has focus, no Ctrl / Alt / Meta). */
  acceptKey(e: KeyboardEvent): boolean
  /** Something modal covers the view (the place picker): no walking under it. */
  covered(): boolean
}

/** The shell has no FocusPatch (Task 9): the walker's focus handles are inert. */
const NO_FOCUS: FocusHandles = {
  view: { mode: 'ensemble', focused: null, held: null, selected: null },
  focusInstance: () => {},
  deviceAt: () => null,
  home: () => {},
}

const NUIT = CREATION_TOKENS.color.nuit
const SELECTION = Color3.FromHexString(CREATION_TOKENS.scene.selection)
const HOVER = Color3.FromHexString(CREATION_TOKENS.scene.hover)
const LIGHT = CREATION_TOKENS.light
/** Selection = Ambre screen-space stroke + a light Ambre wash; hover = a Papier stroke, no wash. */
const SELECT_OVERLAY_ALPHA = 0.22
const DEG = Math.PI / 180
/** The placement ghost's opacity (Task 24). */
const GHOST_ALPHA = 0.5
/**
 * The meshes that make up a device's outlined silhouette (Task 14b Fix 1): every
 * OPAQUE, drawn part — body (placeholder box or all .glb sub-meshes) and port
 * markers — merged into ONE stroke. Each of them writes the highlight stencil, so
 * the stroke runs around the device's outer silhouette only, never as a ring around
 * a connector or marker in front of the body. Transparent quads (labels, contact
 * shadow) and invisible pick spheres are left out entirely (not even occluders).
 */
export function strokeTargets(inst: DeviceInstance): Set<Mesh> {
  return new Set(
    inst.root
      .getChildMeshes(false)
      .filter(
        (m): m is Mesh =>
          m instanceof Mesh &&
          m.getTotalVertices() > 0 &&
          m.isEnabled(false) &&
          m.isVisible &&
          m.visibility > 0 &&
          m.renderingGroupId === 0 &&
          (m.metadata?.isDeviceBody === true || m.name.startsWith(`port:${inst.instanceId}:`))
      )
  )
}

type RoomBuild = (
  scene: Scene,
  file: Extract<PlaceData, { kind: 'room' }>['file'],
  layout: RoomLayout,
  theme?: RoomTheme
) => unknown

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
    engine?: Engine
  ) {
    this.engine =
      engine ?? new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true })
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
  /** The view cube of this place's scene (Task 17); null without a scene or a canvas. */
  get cube(): ViewCubeWidget | null {
    return this._cube
  }
  private _cube: ViewCubeWidget | null = null
  /** What the shell does for every place's cube buttons and clicks (read at each use). */
  cubeHooks: CubeHooks = {}
  /** A bag for controllers bound to this place's scene; disposed first on teardown. Null when no scene. */
  get placeBag(): DisposableBag | null {
    return this.controllers
  }

  instance(id: string): DeviceInstance | undefined {
    return this.instances.get(id)
  }

  // ── walk view (Task 19, C11, S6): view state, never in the store, never undoable ──

  /** This place's walker: created on the first walk, disposed with the place (its `controllers` bag). */
  private walker: ExploreController | null = null
  /** The render lease held while the walker moves (keys held, look drag, velocity easing out). */
  private walkLease: (() => void) | null = null
  /** Floor size of the place on screen (the walls of a blank room / venue set). */
  private floor = { width: 20, length: 20 }
  /** The walk view started (true) or ended (false), including by a place change. */
  onWalkChange: ((walking: boolean) => void) | null = null

  /** The walk view is on. */
  get walking(): boolean {
    return this.walker?.exploreView ?? false
  }

  /** Walk from the orbit view. False when no place is on screen. */
  enterWalk(o: WalkOptions): boolean {
    if (this.walking) return true
    const scene = this._scene
    const arc = this._camera
    const rig = this._rig
    const bag = this.controllers
    if (!scene || !arc || !rig || !bag || !this._place) return false
    // The orbit camera stops where it is: no flight or coast goes on unseen behind the walk.
    rig.cancelFlight()
    arc.inertialAlphaOffset = arc.inertialBetaOffset = arc.inertialRadiusOffset = 0
    arc.inertialPanningX = arc.inertialPanningY = 0
    if (!this.walker) this.walker = this.createWalker(scene, arc, rig, bag, o)
    else this.walker.setEyeHeight(o.eyeHeight)
    this.walker.setBaseView('explore', false)
    this._cube?.setWalkCamera(this.walker.camera)
    this.scheduler.invalidate()
    this.onWalkChange?.(true)
    return true
  }

  /** Back to the orbit view, where the orbit camera was. */
  exitWalk(): void {
    const w = this.walker
    if (!w || !w.exploreView) return
    w.setBaseView('orbit', false)
    this._cube?.setWalkCamera(null)
    this.scheduler.invalidate()
    this.onWalkChange?.(false)
  }

  /** The ear height changed (Écoute): a live walker moves at once. */
  setEarHeight(h: number): void {
    this.walker?.setEyeHeight(h)
    this.scheduler.invalidate()
  }

  /** The walk camera (e2e): eye position, heading and the floor height under it; null when not walking. */
  walkSnapshot(): { x: number; y: number; z: number; yaw: number; floor: number } | null {
    const w = this.walker
    if (!w || !w.exploreView) return null
    const s = w.snapshot()
    const { x, y, z } = s.position
    return { x, y, z, yaw: s.yaw, floor: this._layout?.floorAt(x, z) ?? 0 }
  }

  private createWalker(
    scene: Scene,
    arc: ArcRotateCamera,
    rig: CameraRig,
    bag: DisposableBag,
    o: WalkOptions
  ): ExploreController {
    const layout = this._layout
    const walls = layout ? layout.colliders : roomWalls(this.floor.width, this.floor.length, 4)
    // The shell shows no crosshair (no pointer lock): a detached, hidden element.
    const crosshair = document.createElement('div')
    crosshair.hidden = true
    const ui: ExploreUi = {
      panelCount: () => (o.covered() ? 1 : 0),
      closeTopPanel: () => {},
      toggleInventory: () => {},
      toggleHelp: () => {},
      openPause: () => {},
      placing: () => false,
      cancelPlacement: () => {},
      rotatePlacement: () => {},
      confirmPlacement: () => {},
      pickUp: () => {},
      capturingKey: () => false,
    }
    const w = new ExploreController({
      scene,
      canvas: this.canvas,
      arc,
      rig,
      settings: () => CREATION_WALK_SETTINGS,
      obstacles: () => walls,
      start: walkSpawn(layout, this.floor, arc.position, arc.target),
      initialView: 'orbit',
      crosshair,
      floorAt: layout ? (x, z) => layout.floorAt(x, z) : undefined,
      eyeHeight: o.eyeHeight,
      acceptKey: (e) => o.acceptKey(e),
      canToggleView: () => false,
      onActive: (on) => this.setWalkLease(on),
    })
    w.connect(NO_FOCUS, ui)
    // Right-drag moves the walker: no browser menu. In Orbit the attached camera's pointer
    // input already prevents it (Babylon); walking detaches it, so the walk view does it here.
    bag.listen(this.canvas, 'contextmenu', (e: Event) => {
      if (w.exploreView) e.preventDefault()
    })
    // Disposed FIRST on teardown (a place change while walking): back to the main camera, no lease left.
    bag.add(() => {
      const was = w.exploreView
      this._cube?.setWalkCamera(null)
      w.dispose()
      this.setWalkLease(false)
      if (this.walker === w) this.walker = null
      if (was) this.onWalkChange?.(false)
    })
    return w
  }

  private setWalkLease(on: boolean): void {
    if (on && !this.walkLease) this.walkLease = this.scheduler.hold('walk')
    else if (!on && this.walkLease) {
      this.walkLease()
      this.walkLease = null
    }
  }

  // ── placement ghost (Task 24): scene decoration, never in the store, never undoable ──

  private ghost: DeviceInstance | null = null
  private ghostSeq = 0

  /** The 3D canvas (pointer handling of the placement controller). */
  get canvasElement(): HTMLCanvasElement {
    return this.canvas
  }

  /** The place's floor rectangle (x, z), centred on the origin as the room and the grid are. */
  roomBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    const hw = this.floor.width / 2
    const hl = this.floor.length / 2
    return { minX: -hw, maxX: hw, minZ: -hl, maxZ: hl }
  }

  /** The floor height at (x, z): the room's own (raised decks), else `fallback` (a venue set, the blank floor). */
  floorHeight(x: number, z: number, fallback: number): number {
    return this._layout ? this._layout.floorAt(x, z) : fallback
  }

  /** The place changed under a ghost (its meshes went with the scene): the placement controller ends the placement. */
  onGhostLost: (() => void) | null = null

  /** A ghost is on screen (false after a place change took it down). */
  get hasGhost(): boolean {
    return this.ghost !== null
  }

  /**
   * Show the half-transparent ghost of a device: its real .glb when one loads, else the placeholder
   * box. Body only (no labels, ports, contact shadow), not pickable, not in `instances`, not outlined.
   * False when no place is on screen or the device is unknown.
   */
  showGhost(deviceId: string, at: [number, number, number], yawDeg: number): boolean {
    const spawner = this.spawner
    if (!spawner || !this._scene) return false
    this.hideGhost()
    let inst: DeviceInstance
    try {
      inst = spawner.spawn(deviceId, Vector3.FromArray(at), `ghost-${++this.ghostSeq}`)
    } catch (e) {
      console.warn(`[creation] ${deviceId}: appareil inconnu, pas de fantôme`, e)
      return false
    }
    this.ghost = inst
    this.styleGhost(inst)
    void inst.modelReady.then(() => {
      if (this.ghost === inst) {
        this.styleGhost(inst) // the .glb meshes arrived pickable and marked as device bodies
        this.scheduler.invalidate()
      }
    })
    this.moveGhost(at, yawDeg)
    return true
  }

  moveGhost(at: [number, number, number], yawDeg: number): void {
    const g = this.ghost
    if (!g) return
    g.root.position.set(at[0], at[1], at[2])
    g.root.rotation.y = yawDeg * DEG
    this.scheduler.invalidate()
  }

  hideGhost(): void {
    const g = this.ghost
    if (!g) return
    this.ghost = null
    // Not `g.dispose()`: that disposes every material, and the spawner shares its body, port and
    // contact-shadow materials / texture with the real devices. Only what the ghost owns goes.
    // Collected first: disposing a mesh without recursion reparents its child nodes to nothing.
    const nodes = g.root.getChildTransformNodes(false)
    for (const m of g.root.getChildMeshes(false)) {
      if (m.name.startsWith('shadow:')) m.material?.dispose(false, false) // its texture is shared
      m.dispose(true, !/^(box|port|shadow):/.test(m.name))
    }
    // The glb's own transform nodes (its port empties) are not meshes: they go explicitly, never left in the scene.
    for (const n of nodes) if (!n.isDisposed()) n.dispose(true, false)
    g.root.dispose(true, false)
    this.scheduler.invalidate()
  }

  private styleGhost(inst: DeviceInstance): void {
    for (const m of inst.root.getChildMeshes(false)) {
      m.isPickable = false
      if (m.metadata) m.metadata = { ...m.metadata, isDeviceBody: false, isPortMarker: false }
      if (/^(label|portlabel|port|pick|shadow):/.test(m.name)) m.setEnabled(false)
      else m.visibility = GHOST_ALPHA
    }
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

  // ── view decor (Task 9): view state, never in the store, never undoable ──

  /** The device drawn with the Ambre selection outline (null = none). */
  private selected: string | null = null
  /** `viewState.hidden` keys: instance ids, 'cable:<key>', 'zone:<id>'. */
  private hidden = new Set<string>()

  /** Outline the selected device (Ambre, brief §2); survives respawns and place reloads. */
  setSelected(id: string | null): void {
    this.selected = id
    this.applyDecor()
  }

  /** Hide devices (root disabled), cables and zones; the rig is untouched. */
  setHidden(keys: readonly string[]): void {
    this.hidden = new Set(keys)
    this.applyDecor()
  }

  /** A device is on screen (its root enabled); false when unknown. */
  visible(id: string): boolean {
    return this.instances.get(id)?.root.isEnabled() ?? false
  }

  /** The device under the pointer, drawn with the hover outline (null = none). */
  private hoveredId: string | null = null

  /** Hover a device (null clears). A frame is asked only when it changes. */
  setHovered(id: string | null): void {
    if (id === this.hoveredId) return
    this.hoveredId = id
    this.applyDecor()
  }

  hovered(): string | null {
    return this.hoveredId
  }

  /** Devices currently drawn as SELECTED (Ambre stroke + wash; e2e / tests). A hovered device has no wash. */
  outlined(): string[] {
    return [...this.instances]
      .filter(([, inst]) =>
        inst.root
          .getChildMeshes(false)
          .some((m) => m.metadata?.isDeviceBody === true && m.renderOverlay)
      )
      .map(([id]) => id)
  }

  /** The stroke colour drawn around a device's bodies ('#RRGGBB'), or null when none (tests). */
  strokeOf(id: string): string | null {
    const inst = this.instances.get(id)
    const hl = this.highlight
    if (!inst || !hl) return null
    const body = inst.root
      .getChildMeshes(false)
      .find(
        (m): m is Mesh => m instanceof Mesh && m.metadata?.isDeviceBody === true && hl.hasMesh(m)
      )
    return body ? (this.strokeColor.get(body.uniqueId) ?? null) : null
  }
  /** Screen-space stroke for selection / hover (Task 14b): crisp at any distance, no fins on split-normal .glb meshes. */
  private highlight: HighlightLayer | null = null
  private strokeColor = new Map<number, string>()

  /** What the camera frames for a tree row: a 'zone:<id>' or 'cable:<key>' mesh (world bounds), or null. */
  frameOfKey(key: string): { center: Vector3; boundingRadius: number } | null {
    const scene = this._scene
    if (!scene) return null
    const zone = /^zone:(.+)$/.exec(key)
    const name = zone ? `room:zone:${zone[1]}` : key
    const meshes = scene.meshes.filter((m) => m.name === name)
    if (!meshes.length) return null
    let lo: Vector3 | null = null
    let hi: Vector3 | null = null
    for (const m of meshes) {
      m.computeWorldMatrix(true)
      const b = m.getBoundingInfo().boundingBox
      lo = lo ? Vector3.Minimize(lo, b.minimumWorld) : b.minimumWorld.clone()
      hi = hi ? Vector3.Maximize(hi, b.maximumWorld) : b.maximumWorld.clone()
    }
    return {
      center: lo!.add(hi!).scale(0.5),
      boundingRadius: Math.max(0.25, hi!.subtract(lo!).length() / 2),
    }
  }

  private applyDecor(): void {
    const scene = this._scene
    if (!scene) return
    const hl = this.highlight
    hl?.removeAllMeshes()
    this.strokeColor.clear()
    for (const [id, inst] of this.instances) {
      inst.root.setEnabled(!this.hidden.has(id))
      const on = id === this.selected
      const hover = !on && id === this.hoveredId
      const main = strokeTargets(inst)
      for (const m of inst.root.getChildMeshes(false)) {
        if (m.metadata?.isDeviceBody === true) {
          m.renderOverlay = on
          if (on) {
            m.overlayColor = SELECTION
            m.overlayAlpha = SELECT_OVERLAY_ALPHA
          }
        }
        if (!hl || !(m instanceof Mesh)) continue
        if (!main.has(m)) {
          // Labels (transparent quads), port markers, pick spheres, connector sub-meshes, the
          // contact shadow: never in the stroke mask, not even as occluders (they cut holes /
          // draw rings inside the body otherwise — Task 14b review, Fix 1).
          hl.addExcludedMesh(m)
          continue
        }
        hl.removeExcludedMesh(m)
        if (on || hover) {
          hl.addMesh(m, on ? SELECTION : HOVER)
          this.strokeColor.set(
            m.uniqueId,
            on ? CREATION_TOKENS.scene.selection : CREATION_TOKENS.scene.hover
          )
        }
      }
    }
    for (const m of scene.meshes) {
      if (m.name.startsWith('cable:')) m.setEnabled(!this.hidden.has(m.name))
      else if (m.name.startsWith('room:zone:'))
        m.setEnabled(!this.hidden.has(`zone:${m.name.slice('room:zone:'.length)}`))
    }
    this.scheduler.invalidate()
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

    let scene: Scene
    try {
      scene = this.buildScene(data, build)
    } catch (e) {
      // Assets never block (CLAUDE.md): drop the half-built scene, show the blank room, warn.
      console.warn(
        `[creation] lieu ${placeKey(place)} impossible à construire, salle vide neutre`,
        e
      )
      this.teardown()
      data = blankData()
      try {
        scene = this.buildScene(data, null)
      } catch (e2) {
        this.teardown()
        this.loadingKey = null
        this.pending = null
        throw e2
      }
    }
    if (data.kind === 'set' && data.env.set) {
      await this.importSet(scene, data.env.set)
      if (token !== this.loadSeq) return
    }
    this._place = place
    this.loadingKey = null
    const latest = this.pending ?? design
    this.pending = null
    this.reconcile(latest)
    this.onPlaceShown?.()
    // Asked for a room / set, showing the blank room instead: tell the learner (non-blocking).
    if (place.kind !== 'blank' && data.kind === 'blank') this.onFallback?.(placeKey(place))
  }

  /** Called when a place finished loading and shows its design (the tree reads its zones). */
  onPlaceShown: (() => void) | null = null
  /** Called when `placeKey` could not be loaded or built and the blank room is shown instead. */
  onFallback: ((placeKey: string) => void) | null = null

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
    this.load(placeFromKey(design.roomId), design).catch((e: unknown) =>
      console.error('[creation] place load failed', e)
    )
  }

  private teardown(): void {
    const hadGhost = this.ghost !== null
    this.ghost = null // its meshes go with the scene; its materials are shared with the spawner's
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
    this.highlight = null // disposed with its scene
    this._cube = null // disposed by `bag`
    this.strokeColor.clear()
    if (hadGhost) this.onGhostLost?.()
  }

  private buildScene(data: PlaceData, buildRoom: RoomBuild | null): Scene {
    const scene = new Scene(this.engine)
    // Owned from the first line: if anything below throws, teardown() disposes the half-built scene.
    this._scene = scene
    this.floor = { width: data.width, length: data.length }
    const nuit = Color3.FromHexString(NUIT)
    scene.clearColor = new Color4(nuit.r, nuit.g, nuit.b, 1)
    // Port labels draw in rendering group 1 (on top of markers / model parts). That group must clear
    // DEPTH only: clearing the stencil would erase the highlighted bodies' stencil and the stroke
    // would fill the whole body (Task 14b review, Fix 1, critical).
    scene.setRenderingAutoClearDepthStencil(1, true, true, false)

    // Overview from the audience side (+z) looking at the stage end (−z), as the legacy room boot.
    const roomRadius = Math.min(55, Math.max(8, Math.max(data.width, data.length) * 0.8))
    const env = data.kind === 'set' ? data.env : null
    const camera = new ArcRotateCamera(
      'cam',
      env ? env.camera.alpha : Math.PI / 2,
      env ? env.camera.beta : 1.05,
      env ? env.camera.radius : roomRadius,
      env ? Vector3.FromArray(env.camera.target) : new Vector3(0, 1, 0),
      scene
    )
    const orbitInput = installDesignerOrbitInput(camera)
    this._camera = camera
    this.orbitInput = orbitInput
    camera.attachControl(true)
    camera.lowerRadiusLimit = ENSEMBLE_LOWER_RADIUS
    camera.upperRadiusLimit = env ? 40 : Math.max(40, roomRadius * 1.5)
    applyOrbitFeel(camera)
    // Explicit: a disposed previous camera must never leave Babylon falling back to cameras[0].
    scene.activeCamera = camera

    // Selection / hover stroke (Task 14b): only drawn when a frame renders; empty = no cost.
    // Bound to the main camera (Task 17): the view cube's camera never renders nor composites it.
    const hl = new HighlightLayer('cr:stroke', scene, {
      isStroke: true,
      mainTextureRatio: 1,
      blurHorizontalSize: 1,
      blurVerticalSize: 1,
      camera,
    })
    hl.innerGlow = false
    this.highlight = hl

    // One calm fill + one key (Task 14b, tokens): no shadow generator, nothing recomputed per frame.
    const hemi = new HemisphericLight('light', new Vector3(0.2, 1, 0.3), scene)
    hemi.intensity = LIGHT.fill
    hemi.diffuse = Color3.FromHexString(LIGHT.fillSky)
    hemi.groundColor = Color3.FromHexString(LIGHT.fillGround)
    hemi.specular = Color3.Black()
    const key = new DirectionalLight('key', new Vector3(-0.35, -1, 0.25), scene)
    key.intensity = LIGHT.key
    key.diffuse = Color3.FromHexString(LIGHT.keyColor)

    if (data.kind === 'room' && buildRoom) {
      buildRoom(scene, data.file, data.layout, CREATION_ROOM_THEME)
      this._layout = data.layout
      // Above the flat zone marks (5 mm; the themed floor is depth-biased back, RoomBuilder), under the raised decks.
      this.buildGrid(scene, data.layout.width, data.layout.length, 0.012)
    } else {
      const ground = MeshBuilder.CreateGround(
        'stage',
        { width: data.width, height: data.length },
        scene
      )
      const mat = new StandardMaterial('mat:stage', scene)
      mat.diffuseColor = Color3.FromHexString(
        env ? env.backdrop.floorColor : CREATION_TOKENS.scene.floor
      )
      mat.specularColor = Color3.Black()
      ground.material = mat
      ground.isPickable = false
      ground.metadata = { pivotSurface: true }
      if (!env) this.buildGrid(scene, data.width, data.length)
    }

    const bag = new DisposableBag()
    this.bag = bag
    this.controllers = new DisposableBag()
    this.spawner = new DeviceSpawner(scene, this.registry, CREATION_DEVICE_THEME)
    this.cables = new CableRenderer(scene, undefined, { pulses: false })
    // L7 (Task 18): a recalled view lands exactly, even during an orbit flick.
    this._rig = new CameraRig(camera, { stopInertiaOnFlight: true })
    attachRenderScheduler(this.engine, scene, camera, this.canvas, this.scheduler, bag)
    // View cube (Task 17): a second camera of this scene, only on a real DOM canvas (headless
    // NullEngine tests have a stand-in, no DOM). Disposed with the plumbing, before the scene.
    const domCanvas = this.engine.getRenderingCanvas()
    if (typeof HTMLElement !== 'undefined' && domCanvas instanceof HTMLElement) {
      const cube = new ViewCubeWidget(scene, camera, this._rig, this.scheduler, bag, {
        rotate: (dir) => this.cubeHooks.rotate?.(dir),
        home: () => this.cubeHooks.home?.(),
        onView: (z) => this.cubeHooks.onView?.(z),
      })
      for (const m of cube.meshes) hl.addExcludedMesh(m) // never in the selection stroke mask
      this._cube = cube
    }
    this.scheduler.invalidate()
    return scene
  }

  /** A 1 m grid (every 5 m from the centre stronger), one line-system mesh, never picked. */
  private buildGrid(
    scene: Scene,
    width: number,
    length: number,
    y = 0.003 /* above the floor, no z-fighting */
  ): void {
    const hw = width / 2
    const hl = length / 2
    const minor = Color4.FromColor3(Color3.FromHexString(CREATION_TOKENS.scene.gridMinor))
    const major = Color4.FromColor3(Color3.FromHexString(CREATION_TOKENS.scene.gridMajor))
    const lines: Vector3[][] = []
    const colors: Color4[][] = []
    const add = (a: Vector3, b: Vector3, i: number): void => {
      lines.push([a, b])
      const c = i % 5 === 0 ? major : minor
      colors.push([c, c])
    }
    for (let i = -Math.floor(hw); i <= Math.floor(hw); i++)
      add(new Vector3(i, y, -hl), new Vector3(i, y, hl), i)
    for (let j = -Math.floor(hl); j <= Math.floor(hl); j++)
      add(new Vector3(-hw, y, j), new Vector3(hw, y, j), j)
    // The floor's own border (non-integer extents, e.g. 18.1 m): the grid always reaches the floor edges.
    if (hw !== Math.floor(hw))
      for (const x of [-hw, hw]) add(new Vector3(x, y, -hl), new Vector3(x, y, hl), 1)
    if (hl !== Math.floor(hl))
      for (const z of [-hl, hl]) add(new Vector3(-hw, y, z), new Vector3(hw, y, z), 1)
    const grid = MeshBuilder.CreateLineSystem('stage:grid', { lines, colors }, scene)
    grid.isPickable = false
  }

  /** The venue set .glb (as game.ts): non-blocking, a failure keeps the plain floor. */
  private async importSet(
    scene: Scene,
    set: NonNullable<Extract<PlaceData, { kind: 'set' }>['env']['set']>
  ): Promise<void> {
    try {
      const { meshes } = await SceneLoader.ImportMeshAsync(
        null,
        assetUrl('assets/environments/'),
        set.glb,
        scene
      )
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
      if (!scene.isDisposed)
        console.warn(`[creation] décor ${set.glb} indisponible, sol simple conservé`)
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
        this.applyDecor() // the .glb body meshes take the outline / hidden state too
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
    this.applyDecor() // invalidates
  }

  private pose(inst: DeviceInstance, p: Placement): void {
    inst.root.position = Vector3.FromArray(p.position_m)
    // Yaw about +y (legacy convention), tilt about the device's own x axis.
    // Tilt sign (Task 10, propertiesModel.ts): positive = the front (local +z) aims UP.
    // Babylon's left-handed +x rotation pitches +z down, hence the minus.
    inst.root.rotation = new Vector3(-(p.tiltDeg ?? 0) * DEG, p.yawDeg * DEG, 0)
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
