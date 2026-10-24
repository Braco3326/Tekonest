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
import { captureDesignFrom, sanitizePlacements } from '../scene/designApplier'
import { phantomCheck } from '../logic/phantom'
import { gpioCheck } from '../logic/gpio'
import { mixMinusCheck } from '../logic/mixMinus'
import { clockCheck } from '../logic/clock'

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

export type DispatchResult =
  | { ok: true; normalized: Intent; inverse: Intent[]; connectionId?: string }
  | { ok: false; error: { code: string; message: string; ruleId?: string }; subjects: PortRef[] }

export interface StoreChange {
  intent: Intent
  result: DispatchResult
}

const clone = <T>(v: T): T => structuredClone(v)
const EMPTY: DesignState = { roomId: null, rig: { instances: [], connections: [], controls: {} }, placements: [] }
const DEFAULT_MOUNT: Mount = 'floor'

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

  constructor(
    registry: Registry,
    private evaluator: RuleEvaluator,
    initial: DesignState = EMPTY,
  ) {
    this.graph = new ConnectionGraph(registry, [])
    this.load(initial)
    this.lastEvents = this.evaluator.evaluate(this.graph)
  }

  get revision(): number {
    return this.rev
  }

  /** A fresh deep copy: mutating it never touches the store. */
  design(): DesignState {
    return clone(captureDesignFrom(this.graph.snapshot(), this.placements, this.roomId))
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

  dispatch(intent: Intent): DispatchResult {
    const result = this.apply(intent)
    if (result.ok) {
      this.lastEvents = this.evaluator.evaluate(this.graph)
      this.rev += 1
      const change: StoreChange = { intent, result }
      for (const fn of [...this.subs]) fn(change)
    }
    return result
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
        const before = this.placements.get(intent.instanceId)
        const deviceId = this.deviceOf(intent.instanceId)
        const next: Placement = {
          instanceId: intent.instanceId,
          deviceId,
          position_m: [intent.position[0], intent.position[1], intent.position[2]],
          yawDeg: intent.yawDeg,
          tiltDeg: intent.tiltDeg,
          mount: intent.mount,
        }
        if (!isPoseFinite(next)) return fail('INVALID_POSE', `pose of "${intent.instanceId}" is not finite`)
        this.placements.set(intent.instanceId, next)
        const prev = before ?? { position_m: [0, 0, 0] as [number, number, number], yawDeg: 0 }
        return {
          ok: true,
          normalized: { type: 'SET_POSE', instanceId: intent.instanceId, position: [...next.position_m], yawDeg: next.yawDeg, tiltDeg: intent.tiltDeg, mount: intent.mount },
          inverse: [
            {
              type: 'SET_POSE',
              instanceId: intent.instanceId,
              position: [prev.position_m[0], prev.position_m[1], prev.position_m[2]],
              yawDeg: prev.yawDeg,
              tiltDeg: before?.tiltDeg ?? 0,
              mount: before?.mount ?? DEFAULT_MOUNT,
            },
          ],
        }
      }
      case 'APPLY_DESIGN': {
        const before = this.design()
        const loaded = this.load(intent.design)
        if (!loaded.ok) {
          this.load(before) // every device unknown: restore, nothing changes
          return fail('UNKNOWN_DEVICE', `no device of the design exists in the catalog (${loaded.skipped.join(', ')})`)
        }
        return { ok: true, normalized: { type: 'APPLY_DESIGN', design: this.design() }, inverse: [{ type: 'APPLY_DESIGN', design: before }] }
      }
      case 'LOAD_RIG':
      case 'RESTORE_INSTANCE':
        return fail('UNSUPPORTED', `${intent.type} is a legacy-only intent`)
    }
  }

  private spawn(intent: Extract<Intent, { type: 'SPAWN' }>): DispatchResult {
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
    const pos = intent.position ?? [0, 0, 0]
    const placement: Placement = {
      instanceId,
      deviceId: intent.deviceId,
      position_m: [pos[0], pos[1], pos[2]],
      yawDeg: intent.rotationY ?? 0,
      ...(intent.tiltDeg !== undefined ? { tiltDeg: intent.tiltDeg } : {}),
      ...(intent.mount !== undefined ? { mount: intent.mount } : {}),
    }
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
      position: p ? [p.position_m[0], p.position_m[1], p.position_m[2]] : [0, 0, 0],
      rotationY: p?.yawDeg ?? 0,
      controls: { ...inst.controls },
      ...(p?.tiltDeg !== undefined ? { tiltDeg: p.tiltDeg } : {}),
      ...(p?.mount !== undefined ? { mount: p.mount } : {}),
    }
    return {
      ok: true,
      normalized: { type: 'REMOVE', instanceId },
      inverse: [respawn, ...wires.map((w): Intent => ({ type: 'CONNECT', a: ref(w.a), b: ref(w.b) }))],
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
    return { ok: true, normalized: { type: 'UNPLUG', a: ref(a), b: ref(b) }, inverse: [{ type: 'CONNECT', a: ref(a), b: ref(b) }] }
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  /**
   * Replace everything with `design`. Unknown devices are skipped (and their
   * cables, controls and placements with them); `ok` is false only when the
   * design had devices and none of them could be added.
   */
  private load(design: DesignState): { ok: boolean; skipped: string[] } {
    this.graph.clear()
    this.placements.clear()
    const skipped: string[] = []
    for (const { instanceId, deviceId } of design.rig.instances) {
      if (this.graph.addInstance(instanceId, deviceId).ok) this.bumpSeq(instanceId)
      else skipped.push(instanceId)
    }
    if (skipped.length > 0) console.warn(`[creation] skipped unknown devices: ${skipped.join(', ')}`)
    for (const c of design.rig.connections) this.graph.connect(c.a, c.b)
    for (const [inst, ctrls] of Object.entries(design.rig.controls))
      for (const [control, value] of Object.entries(ctrls)) this.graph.setControl(inst, control, value)
    for (const p of sanitizePlacements(design)) if (this.hasInstance(p.instanceId)) this.placements.set(p.instanceId, p)
    this.roomId = design.roomId
    const total = design.rig.instances.length
    return { ok: total === 0 || skipped.length < total, skipped }
  }

  private connectionById(id: string): { a: PortRef; b: PortRef } | undefined {
    for (const c of this.graph.getConnections()) if (this.graph.connectionAt(c.a) === id) return c
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

const isPoseFinite = (p: Placement): boolean =>
  p.position_m.every((v) => Number.isFinite(v)) && Number.isFinite(p.yawDeg) && (p.tiltDeg === undefined || Number.isFinite(p.tiltDeg))
