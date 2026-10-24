/**
 * Essais (ADR-0012): the write-once Trial. Pure: no Babylon, no DOM, never
 * imported by src/engine/. Learner word "Essai", code word Trial, never "snapshot".
 *
 * Phase 1: no acoustics (no TrialResult), no pitch. Everything the Trial
 * consumed is embedded by value; the result is deep-frozen.
 */
import type { CameraPoseJSON } from '../camera/presets'
import type { ControlValue, LevelState, PortRef, TeachingEvent } from '../engine/types'
import { canonicalize, fingerprint, sha256hex, type Hasher } from './fingerprint'

export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T

export interface Placement {
  instanceId: string
  deviceId: string
  /** Metres; quantised to 1 mm in the fingerprint. */
  position_m: [number, number, number]
  /** Degrees; quantised to 0.1° in the fingerprint. */
  yawDeg: number
}

export interface DesignState {
  roomId: string | null
  rig: {
    instances: { instanceId: string; deviceId: string }[]
    connections: { a: PortRef; b: PortRef }[]
    controls: Record<string, Record<string, ControlValue>>
  }
  placements: Placement[]
}

export interface Evidence {
  prediction: { text: string; writtenAt: string }
  ruleResults: TeachingEvent[]
  levelState: LevelState | null
  /** 'r1:' + sha256(canonicalize(catalog.rules)); see rulesRevOf(). */
  rulesRev: string
  note: string
  noteAmendments: { text: string; at: string }[]
  changedSinceParent: string[]
}

export interface TrialView {
  pose: CameraPoseJSON
  pivot: [number, number, number]
}

export type Trial = DeepReadonly<{
  formatVersion: 1
  id: string
  name: string
  frozenAt: string
  parentId: string | null
  /** fp1 of `design` only: the view is display, not evaluation. */
  fingerprint: string
  design: DesignState
  consumed: { room: { roomId: string | null; geometryRev: string | null } }
  evidence: Evidence
  view: TrialView
  levelId?: string
}>

export interface TrialInput {
  name: string
  design: DesignState
  consumed: { room: { roomId: string | null; geometryRev: string | null } }
  view: TrialView
  evidence: Omit<Evidence, 'noteAmendments' | 'changedSinceParent'>
  /** The Trial this one was restored from; sets parentId and changedSinceParent. */
  parent?: Trial | null
  levelId?: string
}

export type TrialErrorCode = 'prediction-required' | 'prediction-after-freeze' | 'invalid-date'

export class TrialError extends Error {
  constructor(public readonly code: TrialErrorCode) {
    super(`TrialError: ${code}`)
    this.name = 'TrialError'
  }
}

/** Recursively freezes plain data (objects and arrays). */
export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) deepFreeze(v)
    Object.freeze(value)
  }
  return value as DeepReadonly<T>
}

/** Plain-data deep copy (by value; drops undefined fields). */
export function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** 'tr_' + base36 timestamp + random; clock and rng injected for tests. */
export function newTrialId(nowMs: number = Date.now(), rand: () => number = Math.random): string {
  const r = Math.floor(rand() * 36 ** 6)
    .toString(36)
    .padStart(6, '0')
  return 'tr_' + Math.floor(nowMs).toString(36) + r
}

const toIso = (now: Date | string): string => {
  const d = typeof now === 'string' ? new Date(now) : now
  if (Number.isNaN(d.getTime())) throw new TrialError('invalid-date')
  return d.toISOString()
}

export async function createTrial(input: TrialInput, now: Date | string, id: string, hash: Hasher = sha256hex): Promise<Trial> {
  const frozenAt = toIso(now)
  const { prediction } = input.evidence
  if (typeof prediction?.text !== 'string' || prediction.text.trim() === '') throw new TrialError('prediction-required')
  const writtenMs = Date.parse(prediction.writtenAt)
  if (Number.isNaN(writtenMs)) throw new TrialError('invalid-date')
  if (writtenMs > Date.parse(frozenAt)) throw new TrialError('prediction-after-freeze')

  const design = cloneData(input.design)
  const parent = input.parent ?? null
  const trial = {
    formatVersion: 1 as const,
    id,
    name: input.name,
    frozenAt,
    parentId: parent ? parent.id : null,
    fingerprint: await fingerprint(design, hash),
    design,
    consumed: cloneData(input.consumed),
    evidence: {
      ...cloneData(input.evidence),
      noteAmendments: [],
      changedSinceParent: parent ? diffDesign(parent.design, design) : [],
    },
    view: cloneData(input.view),
    ...(input.levelId !== undefined ? { levelId: input.levelId } : {}),
  }
  return deepFreeze(trial)
}

// ---- diffDesign: what changed between two designs (for changedSinceParent) ----

const MOVE_EPS_M = 0.001
const YAW_EPS_DEG = 0.1
const FLOAT_SLACK = 1e-9

const cableKey = (c: { a: PortRef; b: PortRef }): string => {
  const a = canonicalize(c.a)
  const b = canonicalize(c.b)
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function multiset(keys: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
  return m
}

type DesignLike = DeepReadonly<DesignState> | DesignState

/**
 * Keys, in this order: 'room', 'instance:+id', 'instance:-id', 'placement:id'
 * (moved > 1 mm or yaw changed > 0.1°), 'connection:+N', 'connection:-N',
 * 'control:<instance>.<control>'. Ids sorted within each group.
 */
export function diffDesign(a: DesignLike, b: DesignLike): string[] {
  const out: string[] = []
  if (a.roomId !== b.roomId) out.push('room')

  const ia = new Set(a.rig.instances.map((i) => i.instanceId))
  const ib = new Set(b.rig.instances.map((i) => i.instanceId))
  for (const id of [...ib].filter((x) => !ia.has(x)).sort()) out.push(`instance:+${id}`)
  for (const id of [...ia].filter((x) => !ib.has(x)).sort()) out.push(`instance:-${id}`)

  const pa = new Map(a.placements.map((p) => [p.instanceId, p]))
  const moved: string[] = []
  for (const q of b.placements) {
    const p = pa.get(q.instanceId)
    if (!p) continue
    const d = Math.hypot(q.position_m[0] - p.position_m[0], q.position_m[1] - p.position_m[1], q.position_m[2] - p.position_m[2])
    if (d > MOVE_EPS_M + FLOAT_SLACK || Math.abs(q.yawDeg - p.yawDeg) > YAW_EPS_DEG + FLOAT_SLACK) moved.push(q.instanceId)
  }
  for (const id of moved.sort()) out.push(`placement:${id}`)

  const ca = multiset(a.rig.connections.map(cableKey))
  const cb = multiset(b.rig.connections.map(cableKey))
  let added = 0
  let removed = 0
  for (const [k, n] of cb) added += Math.max(0, n - (ca.get(k) ?? 0))
  for (const [k, n] of ca) removed += Math.max(0, n - (cb.get(k) ?? 0))
  if (added) out.push(`connection:+${added}`)
  if (removed) out.push(`connection:-${removed}`)

  const changed: string[] = []
  const insts = new Set([...Object.keys(a.rig.controls), ...Object.keys(b.rig.controls)])
  for (const inst of insts) {
    const xa = a.rig.controls[inst] ?? {}
    const xb = b.rig.controls[inst] ?? {}
    for (const ctl of new Set([...Object.keys(xa), ...Object.keys(xb)])) {
      if (xa[ctl] !== xb[ctl]) changed.push(`${inst}.${ctl}`)
    }
  }
  for (const k of changed.sort()) out.push(`control:${k}`)
  return out
}
