/**
 * CreationStore (Mode Création, C5/C6): the headless owner of the rig. A
 * `ConnectionGraph` + the placements + the room id, mutated ONLY by intents.
 * Every successful dispatch returns its normalized intent and its inverse
 * intents (the History command stack replays them), re-evaluates the domain
 * rules R4–R8, bumps the revision and notifies subscribers once. A rejected
 * intent is a result, never an exception, and changes nothing.
 *
 * No Babylon, no DOM. The shell never imports the graph: it dispatches here.
 */
import { ConnectionGraph } from '../engine/ConnectionGraph'
import { RuleEvaluator } from '../engine/RuleEvaluator'
import type { LevelT, Registry } from '../engine/CatalogLoader'
import type { ConnectResult, ControlValue, PortRef, RigSnapshot, TeachingEvent } from '../engine/types'
import type { Intent } from '../ui/intents'
import type { DesignState, Mount, Placement } from '../trials/trial'
import { captureDesignFrom, isFinitePlacement, sanitizePlacements } from '../scene/designApplier'
import { phantomCheck } from '../logic/phantom'
import { gpioCheck } from '../logic/gpio'
import { mixMinusCheck } from '../logic/mixMinus'
import { clockCheck } from '../logic/clock'
import { cableKey } from './sceneDiff'
import { MAX_ROUTE_POINTS, clampToRoom, fromXZ, planLengthM, readRoute, toXZ, type FloorBounds } from '../scene/cableRoute'

/** A cable's hand-drawn route (mission 3 B): plan points [x, z] in metres. */
type Route = [number, number][]
/** Without a known room, the longest route accepted (m); with one, twice the room's width plus length (its perimeter). */
const MAX_ROUTE_LENGTH_M = 500
const copyRoute = (r: readonly (readonly [number, number])[]): Route => r.map(([x, z]): [number, number] => [x, z])

/** The Mode Création evaluator: every domain rule R4–R8 (legacy sandbox parity). */
export function creationEvaluator(registry: Registry): RuleEvaluator {
  const level = {
    id: 'creation',
    version: 1,
    domain: 'live',
    title: 'Mode Création',
    brief: '-',
    devices: [],
    requiredChain: [],
    logicChecks: ['R4', 'R5', 'R6', 'R7', 'R8'],
    successMessage: '-',
  } as const
  return new RuleEvaluator(registry, level as unknown as LevelT, {
    'logic/phantom': phantomCheck,
    'logic/gpio': gpioCheck,
    'logic/mixMinus': mixMinusCheck,
    'logic/clock': clockCheck,
  })
}

/** What a design load could not restore (reported, never silent). */
export interface DroppedItems {
  /** Instance ids whose device is unknown (or duplicated). */
  devices: string[]
  cables: { a: PortRef; b: PortRef; code: string; message: string }[]
  controls: { instance: string; control: string; code: string; message: string }[]
  /** Placement entries that are not finite or have an unknown mount (the device still loads, unplaced). */
  placements: { instance: string; code: string; message: string }[]
}

export type DispatchResult = DispatchOk | DispatchFail
export type DispatchOk = { ok: true; normalized: Intent; inverse: Intent[]; connectionId?: string; dropped?: DroppedItems }
export type DispatchFail = { ok: false; error: { code: string; message: string; ruleId?: string }; subjects: PortRef[] }

/**
 * The result of `dispatchAll`: either every intent applied (one notify) with
 * the inverse of the whole group (last change first), or none did.
 */
export type BatchResult =
  | { ok: true; results: DispatchOk[]; inverse: Intent[] }
  | { ok: false; index: number; error: DispatchFail['error']; subjects: PortRef[] }

/**
 * One notification per dispatch or per group. `intent`/`result` are the last
 * (or only) step; `intents`/`results` list every step, in order.
 */
export interface StoreChange {
  intent: Intent
  result: DispatchResult
  intents: Intent[]
  results: DispatchResult[]
}

export type LoadReport = { ok: true; dropped: DroppedItems } | { ok: false; error: { code: string; message: string } }

const clone = <T>(v: T): T => structuredClone(v)
const EMPTY: DesignState = { roomId: null, rig: { instances: [], connections: [], controls: {} }, placements: [] }
const DEFAULT_MOUNT: Mount = 'floor'
const MOUNTS: readonly string[] = ['floor', 'stand', 'flown']

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isPortRef = (v: unknown): v is PortRef => isObj(v) && typeof v.instance === 'string' && typeof v.port === 'string'

/**
 * Shape check of untrusted design data (autosave, templates, intents from the
 * shell). Returns why it is unusable, or null. Only the overall shape counts:
 * a placement with bad numbers or an unknown mount is dropped later, one by
 * one, and reported (`DroppedItems.placements`).
 */
function designShapeError(d: unknown): string | null {
  if (!isObj(d)) return 'design is not an object'
  if (d.roomId !== null && typeof d.roomId !== 'string') return 'roomId must be a string or null'
  const rig = d.rig
  if (!isObj(rig)) return 'design.rig is missing'
  if (!Array.isArray(rig.instances)) return 'rig.instances must be an array'
  if (!rig.instances.every((i) => isObj(i) && typeof i.instanceId === 'string' && typeof i.deviceId === 'string'))
    return 'rig.instances entries need string instanceId and deviceId'
  if (!Array.isArray(rig.connections)) return 'rig.connections must be an array'
  if (!rig.connections.every((c) => isObj(c) && isPortRef(c.a) && isPortRef(c.b))) return 'rig.connections entries need two port refs'
  if (!isObj(rig.controls) || !Object.values(rig.controls).every(isObj)) return 'rig.controls must be an object of objects'
  if (!Array.isArray(d.placements)) return 'design.placements must be an array'
  for (const p of d.placements)
    if (!isObj(p) || typeof p.instanceId !== 'string' || typeof p.deviceId !== 'string') return 'placements need string ids'
  return null
}

/** Why one placement entry cannot be used as a pose, or null. */
function placementError(p: Record<string, unknown>): string | null {
  if (!isFinitePlacement(p)) return `placement of "${String(p.instanceId)}" is not finite`
  if (p.mount !== undefined && !MOUNTS.includes(p.mount as string)) return `placement of "${String(p.instanceId)}" has an unknown mount`
  return null
}

const fail = (code: string, message: string, subjects: PortRef[] = [], ruleId?: string): DispatchResult => ({
  ok: false,
  error: ruleId ? { code, message, ruleId } : { code, message },
  subjects,
})
const ref = (r: PortRef): PortRef => ({ instance: r.instance, port: r.port })

export class CreationStore {
  private graph: ConnectionGraph
  private placements = new Map<string, Placement>()
  private roomId: string | null = null
  private lastEvents: TeachingEvent[] = []
  private rev = 0
  private seq = new Map<string, number>()
  private subs = new Set<(c: StoreChange) => void>()
  /** Mission 3 B: the hand-drawn routes, by cable key (design data; the graph never sees them). */
  private routes = new Map<string, Route>()
  private routeBounds: ((roomId: string | null) => FloorBounds | null) | null = null
  /** How the initial design loaded. On failure the store starts empty (never throws). */
  readonly initialLoad: LoadReport

  constructor(
    private registry: Registry,
    private evaluator: RuleEvaluator,
    initial: DesignState = EMPTY,
  ) {
    this.graph = new ConnectionGraph(registry, [])
    const built = this.build(initial)
    if (built.ok) {
      this.commit(built)
      this.initialLoad = { ok: true, dropped: built.dropped }
    } else {
      console.error(`[creation] initial design rejected (${built.code}): ${built.message}`)
      this.initialLoad = { ok: false, error: { code: built.code, message: built.message } }
    }
    this.lastEvents = this.evaluator.evaluate(this.graph)
  }

  get revision(): number {
    return this.rev
  }

  /** A fresh deep copy: mutating it never touches the store. */
  design(): DesignState {
    const d = captureDesignFrom(this.graph.snapshot(), this.placements, this.roomId)
    // No route = no `routes` field: a design without one is byte-identical to before mission 3 B.
    return clone(this.routes.size ? { ...d, routes: Object.fromEntries(this.routes) } : d)
  }

  /** Mission 3 B: the stored route of a cable (a copy), or null for the automatic shape. */
  route(key: string): Route | null {
    const r = this.routes.get(key)
    return r ? copyRoute(r) : null
  }

  /**
   * Mission 3 B: the floor rectangle of the room a route is drawn in (the shell passes the room on screen). With it, SET_ROUTE clamps a point outside the
   * floor onto it and refuses a route longer than the room's perimeter; without it only the point count and an absolute length are checked.
   */
  setRouteBounds(fn: ((roomId: string | null) => FloorBounds | null) | null): void {
    this.routeBounds = fn
  }

  /** RuleEvaluator output (R4–R8) after the last change. */
  events(): TeachingEvent[] {
    return clone(this.lastEvents)
  }

  snapshot(): RigSnapshot {
    return this.graph.snapshot()
  }

  /** Dry-run of a CONNECT (the UI's green/red snap feedback). */
  canConnect(a: PortRef, b: PortRef): ConnectResult {
    return this.graph.canConnect(a, b)
  }

  connectionAt(r: PortRef): string | undefined {
    return this.graph.connectionAt(r)
  }

  subscribe(fn: (change: StoreChange) => void): () => void {
    this.subs.add(fn)
    return () => {
      this.subs.delete(fn)
    }
  }

  /** `${deviceId}-${n}`: the counter only grows and skips ids already in the graph. */
  newInstanceId(deviceId: string): string {
    const present = new Set(this.graph.snapshot().instances.map((i) => i.instanceId))
    let n = this.seq.get(deviceId) ?? 0
    let id: string
    do {
      n += 1
      id = `${deviceId}-${n}`
    } while (present.has(id))
    this.seq.set(deviceId, n)
    return id
  }

  /** Never throws: a rejected or malformed intent is a failed result that changes nothing. */
  dispatch(intent: Intent): DispatchResult {
    const result = this.applySafe(intent)
    if (result.ok) this.changed([intent], [result])
    return result
  }

  /**
   * Several intents as ONE transaction (undo/redo of a multi-intent entry,
   * e.g. the undo of a REMOVE = SPAWN + poses + CONNECTs). Subscribers are
   * notified once, after the last step, so the scene never shows an
   * in-between state. If a step fails, the steps already applied are undone
   * and the store is exactly as before (no revision, no notify). Never throws.
   */
  dispatchAll(intents: readonly Intent[]): BatchResult {
    if (intents.length === 0) return { ok: true, results: [], inverse: [] }
    const before = this.design()
    const done: DispatchOk[] = []
    for (let k = 0; k < intents.length; k++) {
      const r = this.applySafe(intents[k])
      if (!r.ok) {
        this.revert(done, before)
        return { ok: false, index: k, error: r.error, subjects: r.subjects }
      }
      done.push(r)
    }
    this.changed([...intents], done)
    return { ok: true, results: done, inverse: inverseOf(done) }
  }

  private applySafe(intent: Intent): DispatchResult {
    try {
      return this.apply(intent)
    } catch (e) {
      // Defensive: every branch validates before mutating, so this is a bug report, not a path.
      console.error('[creation] dispatch failed', intent, e)
      return fail('INTERNAL', e instanceof Error ? e.message : String(e))
    }
  }

  /** Undo the applied steps of a failed group, last first; if that ever fails, rebuild `before`. */
  private revert(done: DispatchOk[], before: DesignState): void {
    for (const i of inverseOf(done)) {
      if (this.applySafe(i).ok) continue
      console.error('[creation] group rollback failed; restoring the design snapshot', i)
      const built = this.build(before)
      if (built.ok) this.commit(built)
      return
    }
  }

  /** Re-evaluate the rules, bump the revision and notify every subscriber once. */
  private changed(intents: Intent[], results: DispatchResult[]): void {
    this.lastEvents = this.evaluator.evaluate(this.graph)
    this.rev += 1
    const change: StoreChange = { intent: intents[intents.length - 1], result: results[results.length - 1], intents, results }
    // One throwing subscriber must not starve the others (or the caller).
    for (const fn of [...this.subs]) {
      try {
        fn(change)
      } catch (e) {
        console.error('[creation] subscriber failed', e)
      }
    }
  }

  // ── intents ───────────────────────────────────────────────────────────────

  private apply(intent: Intent): DispatchResult {
    switch (intent.type) {
      case 'SPAWN':
        return this.spawn(intent)
      case 'REMOVE':
        return this.remove(intent.instanceId)
      case 'CONNECT':
        return this.connect(intent.a, intent.b)
      case 'DISCONNECT': {
        const conn = this.connectionById(intent.connectionId)
        if (!conn) return fail('UNKNOWN_CONNECTION', `no connection "${intent.connectionId}"`)
        return this.unplug(conn.a, conn.b)
      }
      case 'UNPLUG':
        return this.unplug(intent.a, intent.b)
      case 'SET_CONTROL': {
        const previous = this.graph.getControl(intent.instance, intent.control)
        const r = this.graph.setControl(intent.instance, intent.control, intent.value)
        if (!r.ok) return fail(r.code, r.message)
        return {
          ok: true,
          normalized: { type: 'SET_CONTROL', instance: intent.instance, control: intent.control, value: intent.value },
          // setControl succeeded, so the control exists and had a value
          inverse: [{ type: 'SET_CONTROL', instance: intent.instance, control: intent.control, value: previous as ControlValue }],
        }
      }
      case 'SET_POSE': {
        if (!this.hasInstance(intent.instanceId)) return fail('UNKNOWN_INSTANCE', `no instance "${intent.instanceId}"`)
        if (!MOUNTS.includes(intent.mount)) return fail('INVALID_POSE', `unknown mount "${String(intent.mount)}"`)
        const before = this.placements.get(intent.instanceId)
        const next = makePlacement(intent.instanceId, this.deviceOf(intent.instanceId), intent.position, intent.yawDeg, intent.tiltDeg, intent.mount)
        if (!isPoseFinite(next)) return fail('INVALID_POSE', `pose of "${intent.instanceId}" is not finite`)
        this.placements.set(intent.instanceId, next)
        return {
          ok: true,
          normalized: { type: 'SET_POSE', instanceId: intent.instanceId, position: [...next.position_m], yawDeg: next.yawDeg, tiltDeg: intent.tiltDeg, mount: intent.mount },
          // No placement before → undo clears it again (never invents one).
          inverse: [before ? poseIntent(before) : { type: 'CLEAR_POSE', instanceId: intent.instanceId }],
        }
      }
      case 'CLEAR_POSE': {
        if (!this.hasInstance(intent.instanceId)) return fail('UNKNOWN_INSTANCE', `no instance "${intent.instanceId}"`)
        const before = this.placements.get(intent.instanceId)
        this.placements.delete(intent.instanceId)
        return {
          ok: true,
          normalized: { type: 'CLEAR_POSE', instanceId: intent.instanceId },
          inverse: [before ? poseIntent(before) : { type: 'CLEAR_POSE', instanceId: intent.instanceId }],
        }
      }
      case 'APPLY_DESIGN': {
        // Atomic: the new rig is built on a scratch graph and swapped in only
        // when it is usable, so a failure never touches the live rig (no
        // restore, connection ids unchanged, no notify).
        const built = this.build(intent.design)
        if (!built.ok) return fail(built.code, built.message)
        const before = this.design()
        this.commit(built)
        return {
          ok: true,
          normalized: { type: 'APPLY_DESIGN', design: this.design() },
          inverse: [{ type: 'APPLY_DESIGN', design: before }],
          dropped: built.dropped,
        }
      }
      case 'SET_ROUTE':
        return this.setRoute(intent.key, intent.points)
      case 'LOAD_RIG':
      case 'RESTORE_INSTANCE':
        return fail('UNSUPPORTED', `${intent.type} is a legacy-only intent`)
    }
  }

  /**
   * Mission 3 B (spec §3): set or clear a cable's route. Refused (nothing changes) for a key that is no cable, points that are not finite [x, z] pairs,
   * more than MAX_ROUTE_POINTS points, or a route longer than the room allows. A point outside the room's floor is clamped onto it (clampToRoom).
   */
  private setRoute(key: unknown, points: unknown): DispatchResult {
    if (typeof key !== 'string') return fail('INVALID_ROUTE', 'the route key must be a cable key')
    const conn = this.connectionByKey(key)
    if (!conn) return fail('UNKNOWN_CONNECTION', `no cable "${key}"`)
    const k = cableKey(conn.a, conn.b)
    const before = this.routes.get(k)
    const undo: Intent[] = [{ type: 'SET_ROUTE', key: k, points: before ? copyRoute(before) : null }]
    if (points === null || (Array.isArray(points) && points.length === 0)) {
      this.routes.delete(k)
      return { ok: true, normalized: { type: 'SET_ROUTE', key: k, points: null }, inverse: undo }
    }
    if (Array.isArray(points) && points.length > MAX_ROUTE_POINTS) return fail('ROUTE_TOO_LONG', `a route has at most ${MAX_ROUTE_POINTS} points`)
    const read = readRoute(points)
    if (!read) return fail('INVALID_ROUTE', 'route points must be finite [x, z] pairs in metres')
    let bounds: FloorBounds | null = null
    try {
      bounds = this.routeBounds?.(this.roomId) ?? null
    } catch {
      bounds = null
    }
    const pts = bounds ? fromXZ(clampToRoom(toXZ(read), bounds)) : read
    const maxLength = bounds ? 2 * (bounds.maxX - bounds.minX + (bounds.maxZ - bounds.minZ)) : MAX_ROUTE_LENGTH_M
    if (planLengthM(toXZ(pts)) > maxLength) return fail('ROUTE_TOO_LONG', `a route is at most ${maxLength.toFixed(1)} m long here`)
    this.routes.set(k, pts)
    return { ok: true, normalized: { type: 'SET_ROUTE', key: k, points: copyRoute(pts) }, inverse: undo }
  }

  /** The route of a cable that is going away, as the intent that puts it back (none when it had no route); the route is forgotten. */
  private takeRoute(a: PortRef, b: PortRef): Intent[] {
    const k = cableKey(a, b)
    const r = this.routes.get(k)
    if (!r) return []
    this.routes.delete(k)
    return [{ type: 'SET_ROUTE', key: k, points: copyRoute(r) }]
  }

  private spawn(intent: Extract<Intent, { type: 'SPAWN' }>): DispatchResult {
    if (intent.mount !== undefined && !MOUNTS.includes(intent.mount)) return fail('INVALID_POSE', `unknown mount "${String(intent.mount)}"`)
    const instanceId = intent.instanceId ?? this.newInstanceId(intent.deviceId)
    const added = this.graph.addInstance(instanceId, intent.deviceId)
    if (!added.ok) return fail(added.code, added.message)
    // Initial controls are all-or-nothing: a bad one rolls the spawn back.
    for (const [control, value] of Object.entries(intent.controls ?? {})) {
      const r = this.graph.setControl(instanceId, control, value)
      if (!r.ok) {
        this.graph.removeInstance(instanceId)
        return fail(r.code, r.message)
      }
    }
    const placement = makePlacement(instanceId, intent.deviceId, intent.position ?? [0, 0, 0], intent.rotationY ?? 0, intent.tiltDeg, intent.mount)
    if (!isPoseFinite(placement)) {
      this.graph.removeInstance(instanceId)
      return fail('INVALID_POSE', `pose of "${instanceId}" is not finite`)
    }
    this.placements.set(instanceId, placement)
    this.bumpSeq(instanceId)
    const normalized: Intent = {
      type: 'SPAWN',
      deviceId: intent.deviceId,
      instanceId,
      position: [...placement.position_m],
      rotationY: placement.yawDeg,
      ...(intent.controls ? { controls: { ...intent.controls } } : {}),
      ...(intent.tiltDeg !== undefined ? { tiltDeg: intent.tiltDeg } : {}),
      ...(intent.mount !== undefined ? { mount: intent.mount } : {}),
    }
    return { ok: true, normalized, inverse: [{ type: 'REMOVE', instanceId }] }
  }

  private remove(instanceId: string): DispatchResult {
    const snap = this.graph.snapshot()
    const inst = snap.instances.find((i) => i.instanceId === instanceId)
    if (!inst) return fail('UNKNOWN_INSTANCE', `no instance "${instanceId}"`)
    const wires = snap.connections.filter((c) => c.a.instance === instanceId || c.b.instance === instanceId)
    const p = this.placements.get(instanceId)
    const r = this.graph.removeInstance(instanceId)
    if (!r.ok) return fail(r.code, r.message)
    this.placements.delete(instanceId)
    const respawn: Intent = {
      type: 'SPAWN',
      instanceId,
      deviceId: inst.deviceId,
      controls: { ...inst.controls },
      ...(p
        ? {
            position: [p.position_m[0], p.position_m[1], p.position_m[2]] as [number, number, number],
            rotationY: p.yawDeg,
            ...(p.tiltDeg !== undefined ? { tiltDeg: p.tiltDeg } : {}),
            ...(p.mount !== undefined ? { mount: p.mount } : {}),
          }
        : {}),
    }
    // SPAWN always places; a device that had no placement gets it cleared again.
    const unplace: Intent[] = p ? [] : [{ type: 'CLEAR_POSE', instanceId }]
    // Its cables' routes go with them; the undo draws them again once the cables are back (none = the inverse is exactly the old one).
    const rewind = wires.flatMap((w) => this.takeRoute(w.a, w.b))
    return {
      ok: true,
      normalized: { type: 'REMOVE', instanceId },
      inverse: [respawn, ...unplace, ...wires.map((w): Intent => ({ type: 'CONNECT', a: ref(w.a), b: ref(w.b) })), ...rewind],
    }
  }

  private connect(a: PortRef, b: PortRef): DispatchResult {
    const r = this.graph.connect(a, b)
    if (!r.ok) return fail(r.code, r.message, [ref(a), ref(b)], r.ruleId)
    return {
      ok: true,
      normalized: { type: 'CONNECT', a: ref(a), b: ref(b) },
      inverse: [{ type: 'UNPLUG', a: ref(a), b: ref(b) }],
      ...(r.connectionId ? { connectionId: r.connectionId } : {}),
    }
  }

  private unplug(a: PortRef, b: PortRef): DispatchResult {
    const id = this.graph.connectionAt(a)
    if (!id || id !== this.graph.connectionAt(b))
      return fail('UNKNOWN_CONNECTION', `${a.instance}.${a.port} and ${b.instance}.${b.port} are not cabled together`, [ref(a), ref(b)])
    const r = this.graph.disconnect(id)
    if (!r.ok) return fail(r.code, r.message, [ref(a), ref(b)])
    // Unplugged, the cable takes its route with it (a new CONNECT starts automatic); the undo puts the route back after the cable.
    const rewind = this.takeRoute(a, b)
    return { ok: true, normalized: { type: 'UNPLUG', a: ref(a), b: ref(b) }, inverse: [{ type: 'CONNECT', a: ref(a), b: ref(b) }, ...rewind] }
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  /**
   * Build `design` on a SCRATCH graph without touching the live rig. Fails
   * (nothing built) on a malformed design shape, or when the design has
   * devices and none of them exists in the catalog. Otherwise the unknown
   * devices, the cables/controls the graph refuses and the unusable placement
   * entries are reported in `dropped` (and warned), never silently lost.
   * Never throws.
   */
  private build(
    design: unknown,
  ):
    | { ok: true; graph: ConnectionGraph; placements: Map<string, Placement>; roomId: string | null; ids: string[]; dropped: DroppedItems; routes: Map<string, Route> }
    | { ok: false; code: string; message: string } {
    try {
      const shape = designShapeError(design)
      if (shape) return { ok: false, code: 'INVALID_DESIGN', message: shape }
      const d = design as DesignState
      const total = d.rig.instances.length
      const unknown = d.rig.instances.filter((i) => !this.registry.deviceById.has(i.deviceId)).map((i) => i.instanceId)
      if (total > 0 && unknown.length === total)
        return { ok: false, code: 'UNKNOWN_DEVICE', message: `no device of the design exists in the catalog (${unknown.join(', ')})` }

      const graph = new ConnectionGraph(this.registry, [])
      const dropped: DroppedItems = { devices: [], cables: [], controls: [], placements: [] }
      const ids: string[] = []
      for (const { instanceId, deviceId } of d.rig.instances) {
        if (graph.addInstance(instanceId, deviceId).ok) ids.push(instanceId)
        else dropped.devices.push(instanceId)
      }
      // A device promoted from a Bêta proposal has shorter port ids (Device.portAliases: old -> current): a saved cable that still names an
      // old id is loaded onto the new one. A port id the device currently has is never aliased.
      const deviceOf = new Map(d.rig.instances.map((i) => [i.instanceId, i.deviceId]))
      const current = (r: PortRef): PortRef => {
        const dev = this.registry.deviceById.get(deviceOf.get(r.instance) ?? '')
        const to = dev?.portAliases?.[r.port]
        return to !== undefined && !dev!.ports.some((p) => p.portId === r.port) && dev!.ports.some((p) => p.portId === to) ? { instance: r.instance, port: to } : r
      }
      // Mission 3 B: a route is kept with its cable (under the cable's current key, a saved one may name an aliased port); a route whose cable is not
      // built, or whose points are unusable, is dropped with no report (design data, spec §3: the quarantine note is not involved).
      const savedRoutes = isObj((d as { routes?: unknown }).routes) ? ((d as { routes?: unknown }).routes as Record<string, unknown>) : null
      const savedRoute = (key: string): Route | null =>
        savedRoutes && Object.prototype.hasOwnProperty.call(savedRoutes, key) ? readRoute(savedRoutes[key]) : null
      const routes = new Map<string, Route>()
      for (const c of d.rig.connections) {
        const r = graph.connect(current(c.a), current(c.b))
        if (!r.ok) dropped.cables.push({ a: ref(c.a), b: ref(c.b), code: r.code, message: r.message })
        else if (savedRoutes) {
          const key = cableKey(current(c.a), current(c.b))
          const pts = savedRoute(key) ?? savedRoute(cableKey(c.a, c.b))
          if (pts?.length) routes.set(key, pts)
        }
      }
      for (const [instance, ctrls] of Object.entries(d.rig.controls))
        for (const [control, value] of Object.entries(ctrls)) {
          const r = graph.setControl(instance, control, value)
          if (!r.ok) dropped.controls.push({ instance, control, code: r.code, message: r.message })
        }
      // A bad placement entry is dropped on its own (reported); the device still loads, unplaced.
      const usable = d.placements.filter((p) => {
        const why = placementError(p as unknown as Record<string, unknown>)
        if (why) dropped.placements.push({ instance: p.instanceId, code: 'INVALID_POSE', message: why })
        return !why
      })
      const present = new Set(ids)
      const placements = new Map<string, Placement>()
      for (const p of sanitizePlacements({ ...d, placements: usable }))
        if (present.has(p.instanceId))
          placements.set(p.instanceId, makePlacement(p.instanceId, p.deviceId, p.position_m, p.yawDeg, p.tiltDeg, p.mount))
      if (dropped.devices.length || dropped.cables.length || dropped.controls.length || dropped.placements.length)
        console.warn('[creation] design loaded with dropped items', dropped)
      return { ok: true, graph, placements, roomId: d.roomId, ids, dropped, routes }
    } catch (e) {
      return { ok: false, code: 'INVALID_DESIGN', message: e instanceof Error ? e.message : String(e) }
    }
  }

  /** Swap a built design in (cannot fail). */
  private commit(built: { graph: ConnectionGraph; placements: Map<string, Placement>; roomId: string | null; ids: string[]; routes: Map<string, Route> }): void {
    this.graph = built.graph
    this.placements = built.placements
    this.roomId = built.roomId
    this.routes = built.routes
    for (const id of built.ids) this.bumpSeq(id)
  }

  private connectionById(id: string): { a: PortRef; b: PortRef } | undefined {
    for (const c of this.graph.getConnections()) if (this.graph.connectionAt(c.a) === id) return c
    return undefined
  }

  private connectionByKey(key: string): { a: PortRef; b: PortRef } | undefined {
    for (const c of this.graph.getConnections()) if (cableKey(c.a, c.b) === key) return c
    return undefined
  }

  private hasInstance(id: string): boolean {
    return this.graph.snapshot().instances.some((i) => i.instanceId === id)
  }

  private deviceOf(id: string): string {
    return this.graph.snapshot().instances.find((i) => i.instanceId === id)?.deviceId ?? ''
  }

  /** Keep `newInstanceId` ahead of any `${deviceId}-${n}` id seen in this store. */
  private bumpSeq(instanceId: string): void {
    const m = /^(.*)-(\d+)$/.exec(instanceId)
    if (!m) return
    const [, deviceId, n] = m
    this.seq.set(deviceId, Math.max(this.seq.get(deviceId) ?? 0, Number(n)))
  }
}

/**
 * A placement in canonical form: tilt 0 and mount 'floor' are the defaults and
 * are left out, so an untilted floor device looks exactly like a legacy
 * placement (same fingerprint) and undo round-trips compare equal.
 */
function makePlacement(
  instanceId: string,
  deviceId: string,
  position: readonly number[],
  yawDeg: number,
  tiltDeg: number | undefined,
  mount: Mount | undefined,
): Placement {
  return {
    instanceId,
    deviceId,
    position_m: [position[0], position[1], position[2]],
    yawDeg,
    ...(tiltDeg !== undefined && tiltDeg !== 0 ? { tiltDeg } : {}),
    ...(mount !== undefined && mount !== DEFAULT_MOUNT ? { mount } : {}),
  }
}

/** The inverse of applied steps: the last change is undone first. */
const inverseOf = (steps: readonly DispatchOk[]): Intent[] => [...steps].reverse().flatMap((s) => s.inverse)

const poseIntent = (p: Placement): Intent => ({
  type: 'SET_POSE',
  instanceId: p.instanceId,
  position: [p.position_m[0], p.position_m[1], p.position_m[2]],
  yawDeg: p.yawDeg,
  tiltDeg: p.tiltDeg ?? 0,
  mount: p.mount ?? DEFAULT_MOUNT,
})

const isPoseFinite = (p: Placement): boolean =>
  p.position_m.every((v) => Number.isFinite(v)) && Number.isFinite(p.yawDeg) && (p.tiltDeg === undefined || Number.isFinite(p.tiltDeg))
