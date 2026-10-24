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
import { applyOrbitFeel, ENSEMBLE_LOWER_RADIUS } from './camera/orbitFeel'
import { installDesignerOrbitInput } from './scene/designerOrbitInput'
import { roomWalls, type Box } from './explore/collision'
import { loadSettings, saveSettings, type ExploreSettings } from './ui/exploreSettings'
import { ExploreToolbar } from './ui/exploreToolbar'
import { Placement } from './scene/Placement'
import { detectLayout, labelFor } from './input/layoutLabels'
import type { Action } from './input/actions'
import { CameraPresets } from './ui/cameraPresets'
import { dockBelow, ViewCube } from './ui/viewCube'
import { DEFAULT_FRONT_ALPHA, faceAngles, rotate90, type FaceId } from './camera/viewCube'
import { loadPresets, roomKeyFor, savePreset } from './camera/presets'
import type { RoomLayout } from './explore/roomLayout'
import type { RoomFileT } from './explore/roomSchema'
import { askCoach, createAiCoach } from './ai'
import { buildGrounding, KbPackSchema, type KbPack } from './ai/grounding'

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
      /** Orbit camera pose (designer nav e2e): angles in rad, radius and target in m. */
      camera: () => { alpha: number; beta: number; radius: number; target: [number, number, number] }
      /**
       * World centre of a device's body meshes (N9), computed by its OWN loop
       * (debugBodyCenter) so the e2e checks the focus pivot non-circularly. 2D: null.
       */
      deviceBodyCenter: (instanceId: string) => [number, number, number] | null
      /** Screen point of a world point through the current camera (e2e aims at the floor). 2D: null. */
      worldScreen: (p: [number, number, number]) => { x: number; y: number } | null
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
  /**
   * Procedural room from a TEK Brain template (B3) — replaces the env backdrop.
   * main.ts lazy-loads the room data AND the generator code (never in the startup bundle).
   */
  room?: { file: RoomFileT; layout: RoomLayout; build(scene: Scene): void }
  /** Room picker for the sandbox shelves (content/rooms/index.json). */
  roomIndex?: { id: string; name_fr: string }[]
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

  // A procedural room (B3) sets its own footprint and an orbit pose from the
  // audience side (+z), looking at the stage end (−z).
  const room = opts.room ?? null
  const roomRadius = room ? Math.min(55, Math.max(8, Math.max(room.layout.width, room.layout.length) * 0.8)) : 0
  const camera = new ArcRotateCamera(
    'cam',
    room ? Math.PI / 2 : env.camera.alpha,
    room ? 1.05 : env.camera.beta,
    room ? roomRadius : env.camera.radius,
    room ? new Vector3(0, 1, 0) : Vector3.FromArray(env.camera.target),
    scene,
  )
  // Designer-grade orbit feel (Task 3): inertia, wheel dolly toward the cursor,
  // right-drag / Shift+left-drag pan, beta kept above the floor.
  installDesignerOrbitInput(camera)
  camera.attachControl(true)
  camera.lowerRadiusLimit = ENSEMBLE_LOWER_RADIUS
  camera.upperRadiusLimit = room ? Math.max(40, roomRadius * 1.5) : 40
  applyOrbitFeel(camera) // upper radius: at least 60 m, more if the room needs it

  const hemi = new HemisphericLight('light', new Vector3(0.2, 1, 0.3), scene)
  hemi.intensity = 0.95
  hemi.groundColor = Color3.FromHexString('#DDE1E8')
  const key = new DirectionalLight('key', new Vector3(-0.35, -1, 0.25), scene)
  key.intensity = 0.35

  const [floorW, floorD] = room ? [room.layout.width, room.layout.length] : env.backdrop.floorSize
  const ground = MeshBuilder.CreateGround('stage', { width: floorW, height: floorD }, scene)
  const groundMat = new StandardMaterial('mat:stage', scene)
  groundMat.diffuseColor = Color3.FromHexString(env.backdrop.floorColor)
  groundMat.specularColor = Color3.Black()
  ground.material = groundMat
  ground.isPickable = false
  // Orbit pivot surface (designer nav: double-click the floor to orbit there).
  ground.metadata = { pivotSurface: true }

  if (room) {
    // Procedural room from data: its own floor replaces the white ground.
    ground.setEnabled(false)
    room.build(scene)
    console.info(`[room] ${room.file.id} généré (${room.layout.width} × ${room.layout.length} × ${room.layout.height} m)`)
  } else if (env.set) {
    // Realistic ROOM backdrop (Set-System sourcing): the room wraps AROUND the
    // origin where the gear already lives — anchored by preset DATA. Non-blocking:
    // any failure keeps the white studio (assets never block gameplay).
    const setCfg = env.set
    SceneLoader.ImportMeshAsync(null, '/assets/environments/', setCfg.glb, scene)
      .then(({ meshes }) => {
        const root = meshes[0]
        root.name = 'env:set'
        if (setCfg.scale) root.scaling.setAll(setCfg.scale)
        if (setCfg.rotationY) root.rotation = new Vector3(0, (setCfg.rotationY * Math.PI) / 180, 0)
        if (setCfg.position) root.position = Vector3.FromArray(setCfg.position)
        // Not pickable by default picks. Set .glb files merge floor, walls and
        // truss into a few meshes (live-stage.glb: 5), so the floor cannot be
        // told apart per mesh: they are flagged, and FocusPatch keeps only hits
        // whose picked FACE points up (floor, deck tops) — never a wall face.
        for (const m of meshes) {
          m.isPickable = false
          m.metadata = { ...(m.metadata ?? {}), pivotSurface: true }
        }
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
        // TEK Brain fiches (A5) ride along as citable [kb:…] context — a lazy chunk,
        // fetched only when the learner asks. No pack → the coach works as before.
        const question = { ruleId, errorCode, subjects }
        const reply = import('../content/coach/kb-chunks.json')
          .then((m) => {
            const parsed = KbPackSchema.safeParse(m.default)
            if (!parsed.success) console.warn('[coach] pack TEK Brain invalide — coach sans fiches', parsed.error.issues[0])
            return parsed.success ? (parsed.data as KbPack) : undefined
          })
          .catch(() => undefined)
          .then((kb) => askCoach(aiCoach, buildGrounding(registry, graph.snapshot(), question, undefined, kb), { examMode }))
        void hud.showCoachReply(toastEl, reply)
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
        if (instances.length >= MAX_SANDBOX_DEVICES) {
          hud.toast('warning', 'Rack plein', `Maximum ${MAX_SANDBOX_DEVICES} appareils — retire-en un pour annuler.`)
          return
        }
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
      // Stored data is untrusted: only 4 finite numbers count as a position.
      const valid = Array.isArray(saved) && saved.length === 4 && saved.every((v) => Number.isFinite(v))
      const at = valid ? { position: [saved[0], saved[1], saved[2]] as [number, number, number], rotationY: saved[3] } : undefined
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
  const walls = room ? room.layout.colliders : roomWalls(floorW, floorD, 4)
  let deviceBoxes: Box[] | null = null
  let allObstacles: Box[] | null = null
  const invalidateObstacles = (): void => {
    deviceBoxes = null
    allObstacles = null
  }
  const obstacles = (): readonly Box[] => {
    if (allObstacles) return allObstacles // per-frame call: no allocation (review)
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
    allObstacles = [...walls, ...deviceBoxes]
    return allObstacles
  }
  for (const inst of instances) void inst.modelReady.then(invalidateObstacles)

  // The walker starts where the preset camera stands, on the floor, looking
  // at the preset target (inside the walls).
  const presetEye = camera.position.clone()
  const clampIn = (v: number, half: number): number => Math.max(-half + 0.6, Math.min(half - 0.6, v))
  const startX = room ? room.layout.spawn.x : clampIn(presetEye.x, floorW / 2)
  const startZ = room ? room.layout.spawn.z : clampIn(presetEye.z, floorD / 2)
  const startYaw = room ? room.layout.spawn.yaw : Math.atan2(camera.target.x - startX, camera.target.z - startZ)
  // Assigned below (it needs focusPatch); view/focus hooks refresh it.
  let exploreHud: ExploreToolbar | undefined
  let presetsUi: CameraPresets | undefined
  let viewCube: ViewCube | undefined
  let onViewKey: (a: Action) => void = () => undefined
  const refreshNavUi = (): void => {
    exploreHud?.refresh()
    presetsUi?.refresh()
    viewCube?.refresh()
  }
  const explore = new ExploreController({
    scene,
    canvas,
    arc: camera,
    rig,
    onViewChange: () => refreshNavUi(), // « Vue d'ensemble » and the presets show in Orbit only
    onPreset: (slot) => presetsUi?.press(slot),
    onViewKey: (a) => onViewKey(a),
    settings: () => settings,
    obstacles,
    start: { x: startX, z: startZ, yaw: startYaw },
    initialView,
    crosshair,
    floorAt: room ? (x, z) => room.layout.floorAt(x, z) : undefined,
  })
  const director = new ViewDirector(scene, camera, rig, explore)
  const focusPatch = new FocusPatch(scene, camera, director, cables, instances, portPoints, {
    canConnect: (a, b) => graph.canConnect(a, b),
    dispatch,
    hints,
    onCandidate: markerScale,
    floorPivot: () => !explore.exploreView, // walking has no orbit pivot (ADR-0010)
    inputEnabled: () => explore.pointerFree(),
    onViewChange: () => refreshNavUi(),
  })
  // Inventory, help, settings, pause + placement ghost (ADR-0010 Décisions 8–9).
  const placement = new Placement({
    scene,
    aim: () => explore.aimPoint(),
    halfWidth: floorW / 2,
    halfDepth: floorD / 2,
    dispatch: (intent) => dispatch(intent),
    floorAt: room ? (x, z) => room.layout.floorAt(x, z) : undefined,
  })
  let layoutMap: ReadonlyMap<string, string> | undefined
  exploreHud = new ExploreToolbar({
    root: document.getElementById('hud')!,
    devices: [...registry.deviceById.values()],
    sandbox: sandboxMode,
    inventoryEnabled: !examMode,
    focusedInstance: () => (focusPatch.view.mode === 'focus' ? focusPatch.view.focused : null),
    home: () => focusPatch.home(),
    settings: () => settings,
    onSettings: (next) => {
      settings = next
      saveSettings(window.localStorage, settings)
      applyMotionPref()
      explore.settingsChanged()
      presetsUi?.refresh() // a remapped Digit key shows on the buttons
      viewCube?.refresh() // …and a remapped Numpad key in the cube tooltips
    },
    layout: detectLayout(navigator.language ?? 'fr-FR'),
    get layoutMap() {
      return layoutMap
    },
    placement,
    ensureExplore: () => {
      // Placement aims while walking: leave focus first (review #3), then walk.
      focusPatch.leaveFocus()
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
  // View cube + camera presets dock (Task 8): top-left of the 3D view, just
  // under the objectives panel (never over it), orbit view only.
  const navDock = document.createElement('div')
  navDock.id = 'view-dock'
  document.getElementById('hud')!.appendChild(navDock)
  dockBelow(navDock, document.getElementById('hud-objectives'))
  const presetLayout = detectLayout(navigator.language ?? 'fr-FR')
  // Orbit only, like the presets: walking has no pivot, and from Explore-focus the walker owns the return flight.
  const cubeAvailable = (): boolean => !explore.exploreView
  const frontAlpha = DEFAULT_FRONT_ALPHA // N3: Face = audience side
  const goFace = (face: FaceId): void => {
    const a = faceAngles(face, frontAlpha, camera.alpha)
    rig.flyToView(a.alpha, a.beta)
  }
  const turn = (dir: 1 | -1): void => {
    rig.flyToView(rotate90(camera.alpha, dir, frontAlpha), camera.beta)
  }
  viewCube = new ViewCube({
    root: navDock,
    frontAlpha,
    pose: () => ({ alpha: camera.alpha, beta: camera.beta }),
    available: cubeAvailable,
    focused: () => focusPatch.view.mode === 'focus',
    go: goFace,
    rotate: turn,
    home: () => focusPatch.home(),
    keyLabel: (a) => {
      const code = settings.bindings[a][0]
      return code ? labelFor(code, presetLayout, layoutMap) : null
    },
    hasRoom: room !== null,
    viewChanged: camera.onViewMatrixChangedObservable,
    coach: { seen: () => seenTips.set.has('view-cube'), markSeen: () => seenTips.mark('view-cube') },
  })
  const VIEW_KEY_FACE: Partial<Record<Action, FaceId>> = {
    VIEW_FACE: 'face',
    VIEW_ARRIERE: 'arriere',
    VIEW_DROITE: 'droite',
    VIEW_GAUCHE: 'gauche',
    VIEW_DESSUS: 'dessus',
  }
  onViewKey = (a) => {
    if (!cubeAvailable()) return
    if (a === 'VIEW_ROT_LEFT') turn(-1)
    else if (a === 'VIEW_ROT_RIGHT') turn(1)
    else {
      const face = VIEW_KEY_FACE[a]
      if (face) goFace(face)
    }
  }
  // Camera presets « Vue 1 / 2 / 3 » (Task 5): per-room slots, orbit view only, docked under the cube.
  const presetRoom = roomKeyFor(room?.file.id, level.id)
  const presetKey = (slot: number): Action => `CAMERA_PRESET_${slot + 1}` as Action
  presetsUi = new CameraPresets({
    root: navDock,
    slots: () => loadPresets(window.localStorage, presetRoom),
    keyLabel: (slot) =>
      labelFor(settings.bindings[presetKey(slot)][0] ?? '', presetLayout, layoutMap) || '—',
    // Orbit only: from Explore-focus the walker owns the return flight (ViewDirector).
    available: () => !explore.exploreView,
    recall: (slot) => {
      const p = loadPresets(window.localStorage, presetRoom)[slot]
      if (p) focusPatch.recallPreset({ alpha: p.alpha, beta: p.beta, radius: p.radius, target: Vector3.FromArray(p.target) })
    },
    save: (slot) => {
      const n = slot + 1
      const had = loadPresets(window.localStorage, presetRoom)[slot] !== null
      const ok = savePreset(window.localStorage, presetRoom, slot, {
        alpha: camera.alpha,
        beta: camera.beta,
        radius: camera.radius,
        target: [camera.target.x, camera.target.y, camera.target.z],
      })
      if (ok) hud.toast('info', had ? `Vue ${n} remplacée.` : `Vue ${n} enregistrée.`, '')
      else hud.toast('warning', "La vue n'a pas pu être enregistrée dans ce navigateur.", '')
    },
    empty: (slot) => hud.toast('info', `La vue ${slot + 1} est vide. Clic droit ou appui long pour l'enregistrer.`, ''),
  })
  // Chromium exposes the real layout map: refine key labels when it resolves.
  const kb = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<ReadonlyMap<string, string>> } }).keyboard
  void kb?.getLayoutMap?.()
    .then((m) => {
      layoutMap = m
      refreshNavUi()
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
      room ? '' : env.id,
      opts.roomIndex ?? [],
      room?.file.id ?? '',
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
    worldScreen: (p) => project(Vector3.FromArray(p)),
    deviceBodyCenter: (instanceId) => {
      const inst = instances.find((i) => i.instanceId === instanceId)
      return inst ? debugBodyCenter(inst) : null
    },
    camera: () => ({
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: [camera.target.x, camera.target.y, camera.target.z],
    }),
  }

  babylon.runRenderLoop(() => scene.render())
  window.addEventListener('resize', () => babylon.resize())
  refresh()
}

/**
 * e2e oracle for the focus pivot (N9 review): the body-mesh box centre, written
 * independently of FocusPatch.bodyBounds/focusFrame on purpose (mesh min/max
 * corners, not the bounding-box helpers) so a regression there cannot hide.
 */
function debugBodyCenter(inst: { root: { getChildMeshes(direct: boolean): import('@babylonjs/core').AbstractMesh[] } }): [number, number, number] | null {
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const m of inst.root.getChildMeshes(false)) {
    if (m.metadata?.isDeviceBody !== true || !m.isEnabled()) continue
    const { minimum, maximum } = m.getBoundingInfo()
    const w = m.computeWorldMatrix(true)
    for (const x of [minimum.x, maximum.x])
      for (const y of [minimum.y, maximum.y])
        for (const z of [minimum.z, maximum.z]) {
          const p = Vector3.TransformCoordinates(new Vector3(x, y, z), w)
          lo[0] = Math.min(lo[0], p.x); lo[1] = Math.min(lo[1], p.y); lo[2] = Math.min(lo[2], p.z)
          hi[0] = Math.max(hi[0], p.x); hi[1] = Math.max(hi[1], p.y); hi[2] = Math.max(hi[2], p.z)
        }
  }
  return lo[0] === Infinity ? null : [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2]
}

export { loadCatalog }
