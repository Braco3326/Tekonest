/**
 * Game bootstrap / composition root (extracted from main.ts when the
 * dashboard became the home screen). The ONLY layer allowed to wire
 * everything together: it loads content, owns the ConnectionGraph, applies UI
 * intents to it, and injects logic/* modules into RuleEvaluator (the engine
 * itself never imports logic/*).
 */
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Matrix,
  MeshBuilder,
  Scene,
  SceneLoader,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import { loadCatalog, loadLevel, type Registry } from './engine/CatalogLoader'
import { ConnectionGraph } from './engine/ConnectionGraph'
import { RuleEvaluator } from './engine/RuleEvaluator'
import { LevelRunner } from './engine/LevelRunner'
import type { LevelState, PortRef, TypedError } from './engine/types'

import { phantomCheck } from './logic/phantom'
import { gpioCheck } from './logic/gpio'
import { mixMinusCheck } from './logic/mixMinus'
import { clockCheck } from './logic/clock'

import { DeviceSpawner, type DeviceInstance } from './scene/DeviceSpawner'
import { CableRenderer } from './scene/CableRenderer'
import { CameraRig } from './scene/CameraRig'
import { bodyCenter, FocusPatch } from './scene/FocusPatch'
import type { PortPoint } from './scene/snap'
import type { Intent } from './ui/intents'
import { Hud } from './ui/hud'
import { ControlsPanel } from './ui/controlsPanel'
import { LocalStorageProgressStore } from './ui/ProgressStore'
import { ExamController } from './ui/exam'
import { loadRigs, Shelf, saveRig } from './ui/shelf'
import { SeenTips, tipFor, type CoachFile } from './ui/coach'
import type { ToastAction } from './ui/hud'
import coachJson from '../content/coach/tips.json'
import { motionEnabled, setMotionOverride } from './design/tokens'
import { ExploreController, type BaseView, type ExploreUi } from './scene/ExploreController'
import { ViewDirector } from './scene/ViewDirector'
import { roomWalls, type Box } from './explore/collision'
import { loadSettings, saveSettings, type ExploreSettings } from './ui/exploreSettings'
import { ExploreHud } from './ui/exploreHud'
import { Placement } from './scene/Placement'
import { detectLayout } from './input/layoutLabels'
import { askCoach, createAiCoach } from './ai'
import { buildGrounding } from './ai/grounding'

declare global {
  interface Window {
    __audioSim?: {
      dispatch: (intent: Intent) => void
      state: () => LevelState
      level: ReturnType<typeof loadLevel>
      canConnect: (a: PortRef, b: PortRef) => ReturnType<ConnectionGraph['canConnect']>
      portScreen: (ref: PortRef) => { x: number; y: number } | null
      deviceScreen: (instanceId: string) => { x: number; y: number } | null
      /** Focus & Patch state (ADR-0008): camera mode, focused device, held cable. */
      view: () => { mode: 'ensemble' | 'focus'; focused: string | null; held: PortRef | null; selected: string | null }
      /** Meshes carrying the teaching glow right now (exam ⇒ always 0). */
      glowCount: () => number
      /** Teaching hints gate — read/write (sandbox toggle flips it). */
      hints: () => boolean
      /** Asset load status per instance (e2e: count glb vs placeholder). */
      assets: () => { instanceId: string; deviceId: string; status: 'glb' | 'placeholder' }[]
      /** Explore view state (ADR-0010): base view, eye position, look angles, FOV, pointer lock, panels. */
      explore?: () => ReturnType<ExploreController['snapshot']> & { panels: number; placing: boolean }
    }
  }
}

// Environments are DATA (VISION §3): a backdrop + a camera per room preset.
// New rooms = new JSON, never new engine code.
import plateauJson from '../content/environments/plateau.json'
import radioJson from '../content/environments/radio.json'
import studioJson from '../content/environments/studio.json'
import theatreJson from '../content/environments/theatre.json'
import pleinAirJson from '../content/environments/plein-air.json'
import reportageJson from '../content/environments/reportage.json'
import blancJson from '../content/environments/blanc.json'
import { Environment, type EnvironmentT } from '../tools/schemas'

const ENVIRONMENTS: Record<string, unknown> = {
  plateau: plateauJson,
  radio: radioJson,
  studio: studioJson,
  theatre: theatreJson,
  'plein-air': pleinAirJson,
  reportage: reportageJson,
  blanc: blancJson,
}

function loadEnvironment(id: string | undefined): EnvironmentT {
  const raw = ENVIRONMENTS[id ?? 'plateau'] ?? ENVIRONMENTS.plateau
  const parsed = Environment.safeParse(raw)
  if (!parsed.success) throw new Error(`environment preset invalid: ${parsed.error.issues[0]?.message}`)
  return parsed.data
}

export interface BootOptions {
  /** Sandbox gating (ADR-0004): true = guided 3-item palette, false = full shelves. */
  sandboxGuided?: boolean
}

/** Perf budget: max device bodies on the sandbox stage before spawn is refused. */
const MAX_SANDBOX_DEVICES = 24

export function bootGame(registry: Registry, rawLevel: unknown, opts: BootOptions = {}): void {
  const level = loadLevel(rawLevel)
  const sandboxMode = level.id === 'sandbox'
  // Exam mode (Beat 5): same engine, no hints, a clock, a /20 report.
  const examMode = !sandboxMode && new URLSearchParams(location.search).get('mode') === 'exam'
  // Teaching hints gate (spec §3): ON in Learn/Levels, HARD OFF in Exam,
  // toggleable in Sandbox (defaults ON for exploration). Gates glow/dim AND
  // the green/red tint of the held cable — never the cable itself.
  let hintsOn = !examMode
  const hints = (): boolean => !examMode && hintsOn

  // ── engine ────────────────────────────────────────────────────────────────
  const graph = new ConnectionGraph(registry, level.devices)
  const evaluator = new RuleEvaluator(registry, level, {
    'logic/phantom': phantomCheck,
    'logic/gpio': gpioCheck,
    'logic/mixMinus': mixMinusCheck,
    'logic/clock': clockCheck,
  })
  const runner = new LevelRunner(level, evaluator)

  // ── scene (white gallery — env preset + design tokens, VISION §3/§6) ─────
  // Sandbox room picker: ?env=<preset> overrides the default (rooms are data,
  // trying them costs nothing — Beat 3 "she picks the théâtre just to try").
  const envOverride = sandboxMode
    ? (new URLSearchParams(location.search).get('env') ?? undefined)
    : undefined
  const env = loadEnvironment(envOverride ?? level.environment)
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
  const babylon = new Engine(canvas, true)
  const scene = new Scene(babylon)
  const bg = Color3.FromHexString(env.backdrop.clearColor)
  scene.clearColor = new Color4(bg.r, bg.g, bg.b, 1)

  const camera = new ArcRotateCamera(
    'cam',
    env.camera.alpha,
    env.camera.beta,
    env.camera.radius,
    Vector3.FromArray(env.camera.target),
    scene,
  )
  camera.attachControl(true)
  camera.lowerRadiusLimit = 2
  camera.upperRadiusLimit = 40
  camera.wheelDeltaPercentage = 0.02

  const hemi = new HemisphericLight('light', new Vector3(0.2, 1, 0.3), scene)
  hemi.intensity = 0.95
  hemi.groundColor = Color3.FromHexString('#DDE1E8')
  const key = new DirectionalLight('key', new Vector3(-0.35, -1, 0.25), scene)
  key.intensity = 0.35

  const [floorW, floorD] = env.backdrop.floorSize
  const ground = MeshBuilder.CreateGround('stage', { width: floorW, height: floorD }, scene)
  const groundMat = new StandardMaterial('mat:stage', scene)
  groundMat.diffuseColor = Color3.FromHexString(env.backdrop.floorColor)
  groundMat.specularColor = Color3.Black()
  ground.material = groundMat
  ground.isPickable = false

  // Realistic ROOM backdrop (Set-System sourcing): the room wraps AROUND the
  // origin where the gear already lives — anchored by preset DATA. Non-blocking:
  // any failure keeps the white studio (assets never block gameplay).
  if (env.set) {
    const setCfg = env.set
    SceneLoader.ImportMeshAsync(null, '/assets/environments/', setCfg.glb, scene)
      .then(({ meshes }) => {
        const root = meshes[0]
        root.name = 'env:set'
        if (setCfg.scale) root.scaling.setAll(setCfg.scale)
        if (setCfg.rotationY) root.rotation = new Vector3(0, (setCfg.rotationY * Math.PI) / 180, 0)
        if (setCfg.position) root.position = Vector3.FromArray(setCfg.position)
        for (const m of meshes) m.isPickable = false
        // The room brings its own floor — retire the white ground (z-fight).
        ground.setEnabled(false)
        console.info(`[env] set ${setCfg.glb} chargé (${meshes.length} meshes)`)
      })
      .catch(() => console.warn(`[env] set ${setCfg.glb} indisponible — studio blanc conservé`))
  }

  const layout = level.layout ?? {}
  const spawner = new DeviceSpawner(scene, registry)
  const instances = level.devices.map((d, i) => {
    const pos = layout[d.instanceId]
    return spawner.spawn(
      d.deviceId,
      pos ? Vector3.FromArray(pos) : new Vector3((i % 4) * 1.5 - 2.25, 0, Math.floor(i / 4) * 1.5),
      d.instanceId,
    )
  })

  // World-space port points for snapping + cable anchoring.
  scene.render() // one pass so absolute positions are computed
  const portPoints: PortPoint[] = instances.flatMap((inst) =>
    [...inst.portMarkers.entries()].map(([portId, marker]) => {
      const p = marker.getAbsolutePosition()
      return { ref: { instance: inst.instanceId, port: portId }, x: p.x, y: p.y, z: p.z }
    }),
  )
  const portPos = (ref: PortRef): Vector3 => {
    const p = portPoints.find((pt) => pt.ref.instance === ref.instance && pt.ref.port === ref.port)
    return p ? new Vector3(p.x, p.y, p.z) : Vector3.Zero()
  }

  // ── orchestrator: intents → engine → scene/UI notifications ──────────────
  const cables = new CableRenderer(scene)

  // When a .glb finishes loading, its ports are RE-ANCHORED onto the real model
  // (DeviceSpawner). Refresh this instance's portPoints from the moved markers,
  // then redraw any committed cable touching it. Graph access is READ-ONLY
  // (getConnections/connectionAt) — the scene never mutates the graph.
  const resyncInstance = (inst: DeviceInstance): void => {
    for (const [portId, marker] of inst.portMarkers) {
      marker.computeWorldMatrix(true)
      const p = marker.getAbsolutePosition()
      const existing = portPoints.find((pt) => pt.ref.instance === inst.instanceId && pt.ref.port === portId)
      if (existing) {
        existing.x = p.x
        existing.y = p.y
        existing.z = p.z
      } else {
        portPoints.push({ ref: { instance: inst.instanceId, port: portId }, x: p.x, y: p.y, z: p.z })
      }
    }
    for (const conn of graph.getConnections()) {
      if (conn.a.instance !== inst.instanceId && conn.b.instance !== inst.instanceId) continue
      const id = graph.connectionAt(conn.a)
      if (id) cables.addCable(id, portPos(conn.a), portPos(conn.b)) // addCable replaces by id
    }
  }
  for (const inst of instances) void inst.modelReady.then((ok) => ok && resyncInstance(inst))
  const hud = new Hud(document.getElementById('hud')!, registry, level)
  const progress = new LocalStorageProgressStore(window.localStorage)
  const controlsPanel = new ControlsPanel(
    document.getElementById('hud-controls')!,
    registry,
    level,
    (intent) => dispatch(intent),
  )

  const { data: progressData, wasReset } = progress.load()
  if (wasReset)
    hud.toast('info', 'Progression réinitialisée', 'Sauvegarde incompatible avec cette version — repart de zéro.')
  let mistakes = [...(progressData.levels[level.id]?.mistakes ?? [])]
  let sessionMistakes = 0

  let won = false
  const activeViolations = new Set<string>()

  // Coach IA (ADR-0006): on-demand "Pourquoi ?" layer, distinct from the
  // authored Oscar tips. No key in .env → unconfigured → no button, no crash.
  const aiCoach = createAiCoach(import.meta.env)
  const whyAction = (
    ruleId: string | undefined,
    errorCode: string | undefined,
    subjects: PortRef[],
  ): ToastAction | undefined => {
    if (examMode || aiCoach.status !== 'ready') return undefined
    return {
      label: 'Pourquoi ?',
      onClick: (toastEl) => {
        const grounding = buildGrounding(registry, graph.snapshot(), { ruleId, errorCode, subjects })
        void hud.showCoachReply(toastEl, askCoach(aiCoach, grounding, { examMode }))
      },
    }
  }

  // Coach (Beat 2): the mentor voice fires on the exact topic, once per
  // session, never during an exam (no hints there — including human ones).
  const coachTips = coachJson as CoachFile
  const seenTips = new SeenTips()
  const coachOnRule = (ruleId: string | undefined): void => {
    if (examMode || !ruleId) return
    const tip = tipFor(coachTips, { kind: 'rule', ruleId }, seenTips.set)
    if (!tip) return
    seenTips.mark(tip.id)
    hud.toast('coach', 'Conseil d’Oscar', tip.text)
  }

  const refresh = (): LevelState => {
    const state = runner.check(graph)
    hud.update(state)
    controlsPanel.update(graph.snapshot())
    focusPatch.refreshHints() // occupancy moved → recompute glow/dim (spec §3)
    console.info(
      `[${level.id}] ${state.connectedRequired}/${state.totalRequired} required — ${state.won ? 'WIN' : 'in progress'}`,
    )
    // Logic violations (R4–R8 sweeps) — recorded ALWAYS (play = assessment),
    // but taught (toasted) only outside exam mode.
    for (const v of state.violations) {
      if (activeViolations.has(v.ruleId)) continue
      activeViolations.add(v.ruleId)
      if (!examMode) hud.toast(v.severity, v.title, v.teach, whyAction(v.ruleId, undefined, v.subjects))
      sessionMistakes += 1
      mistakes = progress.recordMistake(level.id, v.ruleId).levels[level.id]!.mistakes
      coachOnRule(v.ruleId)
    }
    for (const id of [...activeViolations])
      if (!state.violations.some((v) => v.ruleId === id)) activeViolations.delete(id)

    if (state.won && !won && !sandboxMode) {
      // Sandbox has no requiredChain — "won" is meaningless there (ADR-0004).
      won = true
      const firstEver = Object.values(progress.load().data.levels).every((l) => l.wins === 0)
      progress.recordWin(level.id) // feeds the readiness model (ADR-0003)
      if (exam) exam.finish()
      else {
        hud.showWin(mistakes)
        if (firstEver) {
          const tip = tipFor(coachTips, { kind: 'first-win' }, seenTips.set)
          if (tip) {
            seenTips.mark(tip.id)
            hud.toast('coach', 'Conseil d’Oscar', tip.text)
          }
        }
      }
    } else if (!state.won && won && !sandboxMode) {
      // Regressed out of a win (a required cable was pulled): retract the card.
      won = false
      hud.hideWin()
    }
    return state
  }

  const onRejected = (e: TypedError, subjects: PortRef[]): void => {
    const rule = !examMode && e.ruleId ? registry.ruleById.get(e.ruleId) : undefined
    if (examMode) {
      hud.toast('error', 'Connexion refusée', 'Pas d’explication en mode examen — analyse et corrige.')
    } else {
      hud.toast(
        'error',
        rule?.title ?? 'Connexion impossible',
        rule?.teach ?? e.message,
        whyAction(e.ruleId, e.code, subjects),
      )
    }
    sessionMistakes += 1
    mistakes = progress.recordMistake(level.id, e.ruleId ?? e.code).levels[level.id]!.mistakes
    coachOnRule(e.ruleId)
    console.warn(`[rejected ${e.code}${e.ruleId ? ` ${e.ruleId}` : ''}] ${e.message}`)
  }

  // Sandbox spawns land on a simple grid rows-of-5, centered, front of stage —
  // unless Explore placement (ADR-0010) gives an exact floor point and yaw.
  let spawnCount = 0
  const spawnExact = (
    instanceId: string,
    deviceId: string,
    index: number,
    at?: { position: [number, number, number]; rotationY?: number },
  ): boolean => {
    const r = graph.addInstance(instanceId, deviceId)
    if (!r.ok) {
      hud.toast('error', 'Spawn impossible', r.message)
      return false
    }
    const pos = at
      ? Vector3.FromArray(at.position)
      : new Vector3(((index % 5) - 2) * 1.6, 0, -1.2 - Math.floor(index / 5) * 1.6)
    const inst = spawner.spawn(deviceId, pos, instanceId)
    if (at?.rotationY) inst.root.rotation.y = (at.rotationY * Math.PI) / 180
    instances.push(inst)
    scene.render() // compute absolute positions for the new markers
    for (const [portId, marker] of inst.portMarkers) {
      const p = marker.getAbsolutePosition()
      portPoints.push({ ref: { instance: instanceId, port: portId }, x: p.x, y: p.y, z: p.z })
    }
    // Re-anchor + redraw once (if) the glb replaces this placeholder.
    void inst.modelReady.then((ok) => {
      invalidateObstacles()
      if (ok) resyncInstance(inst)
    })
    invalidateObstacles()
    return true
  }
  const spawnDevice = (deviceId: string, at?: { position: [number, number, number]; rotationY?: number }): void => {
    // Perf budget: sandbox spawn is uncapped input — a low-end PC degrades fast
    // past a couple dozen placeholder bodies + markers + shadows.
    if (instances.length >= MAX_SANDBOX_DEVICES) {
      hud.toast('warning', 'Rack plein', `Maximum ${MAX_SANDBOX_DEVICES} appareils sur le plateau — retire-en pour en ajouter.`)
      return
    }
    const instanceId = `${deviceId}-s${++spawnCount}`
    if (spawnExact(instanceId, deviceId, level.devices.length + spawnCount - 1, at)) refresh()
  }

  /** Where an instance stands (rig save, undo of a pick-up). */
  const poseOf = (instanceId: string): { position: [number, number, number]; rotationY: number } | null => {
    const inst = instances.find((i) => i.instanceId === instanceId)
    if (!inst) return null
    const p = inst.root.position
    return { position: [p.x, p.y, p.z], rotationY: Math.round((inst.root.rotation.y * 180) / Math.PI) }
  }

  // Pick-up (ADR-0010 Décision 8): the device leaves the stage with its cables;
  // the toast offers to undo (device, cables and controls come back).
  const removeDevice = (instanceId: string): void => {
    const inst = instances.find((i) => i.instanceId === instanceId)
    if (!inst) return
    const pose = poseOf(instanceId)!
    const snap = graph.snapshot()
    const wires = snap.connections.filter((c) => c.a.instance === instanceId || c.b.instance === instanceId)
    const controls = snap.instances.find((i) => i.instanceId === instanceId)?.controls ?? {}
    focusPatch.releaseInstance(instanceId)
    for (const w of wires) {
      const id = graph.connectionAt(w.a)
      if (id) cables.removeCable(id)
    }
    if (!graph.removeInstance(instanceId).ok) return
    inst.dispose()
    instances.splice(instances.indexOf(inst), 1)
    for (let i = portPoints.length - 1; i >= 0; i--) if (portPoints[i].ref.instance === instanceId) portPoints.splice(i, 1)
    invalidateObstacles()
    refresh()
    const label = registry.deviceById.get(inst.deviceId)?.label ?? inst.deviceId
    hud.toast('info', 'Appareil ramassé', `${label} est retourné dans l’inventaire${wires.length ? ` (${wires.length} câble(s) débranché(s))` : ''}.`, {
      label: 'Annuler',
      onClick: (toastEl) => {
        toastEl.remove()
        if (instances.some((i) => i.instanceId === instanceId)) return
        if (!spawnExact(instanceId, inst.deviceId, 0, pose)) return
        for (const w of wires) {
          const r = graph.connect(w.a, w.b)
          if (r.ok && r.connectionId) cables.addCable(r.connectionId, portPos(w.a), portPos(w.b))
        }
        for (const [controlId, value] of Object.entries(controls)) graph.setControl(instanceId, controlId, value)
        refresh()
      },
    })
  }

  // Rig reload (ADR-0005): clear stage → respawn exact ids → rewire → restate.
  const loadRigByName = (name: string): void => {
    const rig = loadRigs(window.localStorage).find((r) => r.name === name)
    if (!rig) return
    graph.clear()
    cables.clear()
    for (const inst of instances) inst.dispose()
    instances.length = 0
    portPoints.length = 0
    invalidateObstacles()
    spawnCount = rig.instances.length
    let allOk = true
    rig.instances.forEach((s, i) => {
      const saved = rig.positions?.[s.instanceId]
      const at = saved ? { position: [saved[0], saved[1], saved[2]] as [number, number, number], rotationY: saved[3] } : undefined
      if (!spawnExact(s.instanceId, s.deviceId, i, at)) allOk = false
    })
    for (const c of rig.connections) {
      const r = graph.connect(c.a, c.b)
      if (r.ok && r.connectionId) cables.addCable(r.connectionId, portPos(c.a), portPos(c.b))
    }
    for (const [instId, ctrls] of Object.entries(rig.controls))
      for (const [controlId, value] of Object.entries(ctrls)) graph.setControl(instId, controlId, value)
    if (!allOk)
      hud.toast('warning', 'Rig partiellement chargé', 'Un appareil de ce rig n’existe plus dans le catalog.')
    refresh()
  }

  const dispatch = (intent: Intent): void => {
    if (exam?.isFinished) return // the exam is over — the report owns the screen
    switch (intent.type) {
      case 'CONNECT': {
        const r = graph.connect(intent.a, intent.b)
        if (r.ok && r.connectionId) {
          cables.addCable(r.connectionId, portPos(intent.a), portPos(intent.b))
          refresh()
        } else if (!r.ok) {
          onRejected(r, [intent.a, intent.b])
        }
        break
      }
      case 'DISCONNECT': {
        if (graph.disconnect(intent.connectionId).ok) {
          cables.removeCable(intent.connectionId)
          refresh()
        }
        break
      }
      case 'SET_CONTROL': {
        if (graph.setControl(intent.instance, intent.control, intent.value).ok) refresh()
        break
      }
      case 'SPAWN': {
        if (sandboxMode)
          spawnDevice(intent.deviceId, intent.position ? { position: intent.position, rotationY: intent.rotationY } : undefined)
        break
      }
      case 'REMOVE': {
        if (sandboxMode) removeDevice(intent.instanceId)
        break
      }
      case 'LOAD_RIG': {
        if (sandboxMode) loadRigByName(intent.name)
        break
      }
    }
  }

  // Snap feedback (motion = pedagogy): the candidate port breathes while the
  // cable hovers it. Touch only the two markers involved (was O(instances×ports)
  // per pointer move — costly on big sandbox rigs).
  let scaledMarker: { scaling: { setAll(v: number): void } } | undefined
  const markerScale = (ref: PortRef | null): void => {
    if (!motionEnabled()) return
    const next = ref
      ? instances.find((i) => i.instanceId === ref.instance)?.portMarkers.get(ref.port)
      : undefined
    if (next === scaledMarker) return
    scaledMarker?.scaling.setAll(1)
    next?.scaling.setAll(1.35)
    scaledMarker = next
  }

  // Focus & Patch (ADR-0008, spec §1): double-click focuses, port clicks patch.
  // Replaces the drag flow entirely — the camera rig captures the env preset
  // pose as "Ensemble" and never touches the graph (spec §5).
  const rig = new CameraRig(camera)

  // Explore view (ADR-0010): walk the room, inventory, remappable controls.
  // Sandbox starts walking; levels/exam keep orbit unless the learner (or
  // ?view=) asks — their layouts and e2e are framed for the orbit camera.
  let settings: ExploreSettings = loadSettings(window.localStorage)
  const applyMotionPref = (): void =>
    setMotionOverride(settings.reducedMotion === 'system' ? null : settings.reducedMotion === 'off')
  applyMotionPref()
  const viewParam = new URLSearchParams(location.search).get('view')
  const initialView: BaseView =
    viewParam === 'explore' || viewParam === 'orbit' ? viewParam : sandboxMode ? 'explore' : settings.levelView

  const crosshair = document.createElement('div')
  crosshair.id = 'explore-crosshair'
  crosshair.hidden = true
  crosshair.setAttribute('aria-hidden', 'true')
  document.getElementById('hud')!.appendChild(crosshair)

  // Collision world: four walls at the env floor edges + one box per device
  // body (cached; re-derived when the stage changes).
  const walls = roomWalls(floorW, floorD, 4)
  let deviceBoxes: Box[] | null = null
  const invalidateObstacles = (): void => {
    deviceBoxes = null
  }
  const obstacles = (): readonly Box[] => {
    if (!deviceBoxes) {
      deviceBoxes = []
      for (const inst of instances) {
        let min: Vector3 | null = null
        let max: Vector3 | null = null
        for (const m of inst.root.getChildMeshes(false)) {
          if (m.metadata?.isDeviceBody !== true || !m.isEnabled()) continue
          m.computeWorldMatrix(true)
          const bb = m.getBoundingInfo().boundingBox
          min = min ? Vector3.Minimize(min, bb.minimumWorld) : bb.minimumWorld.clone()
          max = max ? Vector3.Maximize(max, bb.maximumWorld) : bb.maximumWorld.clone()
        }
        if (min && max) deviceBoxes.push({ minX: min.x, maxX: max.x, minZ: min.z, maxZ: max.z, height: max.y })
      }
    }
    return [...walls, ...deviceBoxes]
  }
  for (const inst of instances) void inst.modelReady.then(invalidateObstacles)

  // The walker starts where the preset camera stands, on the floor, looking
  // at the preset target (inside the walls).
  const presetEye = camera.position.clone()
  const clampIn = (v: number, half: number): number => Math.max(-half + 0.6, Math.min(half - 0.6, v))
  const startX = clampIn(presetEye.x, floorW / 2)
  const startZ = clampIn(presetEye.z, floorD / 2)
  const explore = new ExploreController({
    scene,
    canvas,
    arc: camera,
    rig,
    settings: () => settings,
    obstacles,
    start: { x: startX, z: startZ, yaw: Math.atan2(camera.target.x - startX, camera.target.z - startZ) },
    initialView,
    crosshair,
  })
  const director = new ViewDirector(scene, camera, rig, explore)
  const focusPatch = new FocusPatch(scene, camera, director, cables, instances, portPoints, {
    canConnect: (a, b) => graph.canConnect(a, b),
    dispatch,
    hints,
    onCandidate: markerScale,
    clickFocuses: () => explore.clickFocuses(),
    inputEnabled: () => explore.pointerFree(),
  })
  // Inventory, help, settings, pause + placement ghost (ADR-0010 Décisions 8–9).
  const placement = new Placement({
    scene,
    aim: () => explore.aimPoint(),
    halfWidth: floorW / 2,
    halfDepth: floorD / 2,
    dispatch: (intent) => dispatch(intent),
  })
  let layoutMap: ReadonlyMap<string, string> | undefined
  const exploreHud = new ExploreHud({
    root: document.getElementById('hud')!,
    devices: [...registry.deviceById.values()],
    sandbox: sandboxMode,
    settings: () => settings,
    onSettings: (next) => {
      settings = next
      saveSettings(window.localStorage, settings)
      applyMotionPref()
      explore.settingsChanged()
    },
    layout: detectLayout(navigator.language ?? 'fr-FR'),
    get layoutMap() {
      return layoutMap
    },
    placement,
    ensureExplore: () => {
      if (!explore.exploreView) explore.toggleView()
    },
    pickUp: (instanceId) => {
      if (!sandboxMode) {
        hud.toast('info', 'Ramasser', 'Dans un niveau, le matériel reste en place. Le ramassage est disponible dans la Sandbox.')
        return
      }
      dispatch({ type: 'REMOVE', instanceId })
    },
    toggleView: () => explore.toggleView(),
    currentView: () => explore.snapshot().view,
  })
  const exploreUi: ExploreUi = exploreHud
  // Chromium exposes the real layout map: refine key labels when it resolves.
  const kb = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<ReadonlyMap<string, string>> } }).keyboard
  void kb?.getLayoutMap?.()
    .then((m) => {
      layoutMap = m
      exploreHud.refresh()
    })
    .catch(() => undefined)
  explore.connect(focusPatch, exploreUi)

  const exam = examMode
    ? new ExamController(document.getElementById('hud')!, level.examSeconds ?? 300, {
        getState: () => runner.check(graph),
        getMistakes: () => sessionMistakes,
        // The report overlay takes the screen; the dispatch guard freezes intents.
        onFinished: () => undefined,
      })
    : null

  // Sandbox shelves (ADR-0004): catalog-driven, mastery-gated, rig save box.
  if (sandboxMode) {
    new Shelf(
      document.getElementById('hud-shelf')!,
      registry,
      opts.sandboxGuided ?? true,
      dispatch,
      (name) => {
        const snap = graph.snapshot()
        saveRig(window.localStorage, {
          name,
          savedAt: new Date().toISOString(),
          instances: snap.instances.map((i) => ({ instanceId: i.instanceId, deviceId: i.deviceId })),
          connections: snap.connections,
          controls: Object.fromEntries(snap.instances.map((i) => [i.instanceId, i.controls])),
          positions: Object.fromEntries(
            snap.instances.flatMap((i) => {
              const pose = poseOf(i.instanceId)
              return pose ? [[i.instanceId, [...pose.position, pose.rotationY] as [number, number, number, number]]] : []
            }),
          ),
        })
        // Clean rig = positive readiness signal (ADR-0005): ≥2 connections and
        // zero violations. A messy rig still saves — no shame, just no credit.
        const state = runner.check(graph)
        if (snap.connections.length >= 2 && state.violations.length === 0) {
          progress.recordWin('sandbox')
          hud.toast('info', 'Rig propre', 'Deux connexions ou plus, zéro faute — ta readiness en profite.')
        }
      },
      Object.keys(ENVIRONMENTS),
      env.id,
    )
    // Hints toggle (spec §3): Sandbox defaults ON (exploration), switchable
    // OFF for self-testing. Levels are always ON, Exam is hard OFF (no toggle).
    const hintsBtn = document.createElement('button')
    hintsBtn.type = 'button'
    hintsBtn.id = 'hints-toggle'
    hintsBtn.className = 'shelf-hints-toggle'
    const renderHintsBtn = (): void => {
      hintsBtn.textContent = `Indices : ${hintsOn ? 'ON' : 'OFF'}`
      hintsBtn.setAttribute('aria-pressed', String(hintsOn))
      hintsBtn.title = hintsOn
        ? 'Couper les indices (glow des compatibles) pour t’auto-tester'
        : 'Réactiver les indices d’exploration'
    }
    renderHintsBtn()
    hintsBtn.addEventListener('click', () => {
      hintsOn = !hintsOn
      renderHintsBtn()
      focusPatch.refreshHints()
    })
    document.getElementById('hud-shelf')!.appendChild(hintsBtn)
  }

  // Debug/e2e hook (Playwright drives the same REAL clicks a mouse would:
  // deviceScreen() aims double-clicks, portScreen() aims port clicks, both
  // projected live through the CURRENT camera — valid in Ensemble and Focus).
  const project = (world: Vector3): { x: number; y: number } => {
    const projected = Vector3.Project(
      world,
      Matrix.Identity(),
      scene.getTransformMatrix(),
      camera.viewport.toGlobal(babylon.getRenderWidth(), babylon.getRenderHeight()),
    )
    const rect = canvas.getBoundingClientRect()
    return {
      x: rect.left + (projected.x / babylon.getRenderWidth()) * rect.width,
      y: rect.top + (projected.y / babylon.getRenderHeight()) * rect.height,
    }
  }
  const portScreen = (ref: PortRef): { x: number; y: number } | null => project(portPos(ref))
  const deviceScreen = (instanceId: string): { x: number; y: number } | null => {
    const inst = instances.find((i) => i.instanceId === instanceId)
    if (!inst) return null
    // Aim at the visible BODY center — hierarchy bounds include the floor
    // shadow blob and label billboard (a mic on a stand would aim at the pole).
    const center = bodyCenter(inst)
    return center ? project(center) : null
  }

  window.__audioSim = {
    dispatch,
    state: () => runner.check(graph),
    level,
    canConnect: (a, b) => graph.canConnect(a, b),
    portScreen,
    deviceScreen,
    view: () => focusPatch.view,
    glowCount: () => focusPatch.glowCount,
    hints,
    assets: () =>
      instances.map((i) => ({ instanceId: i.instanceId, deviceId: i.deviceId, status: i.assetStatus })),
    explore: () => ({ ...explore.snapshot(), panels: exploreUi.panelCount(), placing: exploreUi.placing() }),
  }

  babylon.runRenderLoop(() => scene.render())
  window.addEventListener('resize', () => babylon.resize())
  refresh()
}

export { loadCatalog }
