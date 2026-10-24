/**
 * Essais (ADR-0012): the write-once Trial. Pure: no Babylon, no DOM, never
 * imported by src/engine/. Learner word "Essai", code word Trial, never "snapshot".
 *
 * Phase 1: no acoustics (no TrialResult), no pitch. Everything the Trial
 * consumed is embedded by value; the result is deep-frozen.
 */
import type { CameraPoseJSON } from '../camera/presets'
import type { ControlValue, LevelState, PortRef, TeachingEvent } from '../engine/types'
import { canonicalCable, canonicalize, FP_PREFIX, quantField, sha256hex, type Hasher } from './fingerprint'

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

/**
 * A rule outcome as frozen in an Essai: no title/teach text. `rulesRev` pins
 * the catalog the texts come from, so they are looked up, not copied (size).
 */
export interface RuleResult {
  ruleId: string
  severity: 'error' | 'warning'
  subjects: PortRef[]
}
export type FrozenLevelState = Omit<LevelState, 'violations'> & { violations: RuleResult[] }

export const compactRule = (e: TeachingEvent | RuleResult): RuleResult => ({
  ruleId: e.ruleId,
  severity: e.severity,
  subjects: e.subjects.map((s) => ({ instance: s.instance, port: s.port })),
})

const compactLevelState = (s: LevelState | FrozenLevelState | null): FrozenLevelState | null =>
  s === null
    ? null
    : {
        chainComplete: s.chainComplete,
        connectedRequired: s.connectedRequired,
        totalRequired: s.totalRequired,
        missing: s.missing,
        violations: s.violations.map(compactRule),
        won: s.won,
      }

export interface Evidence {
  prediction: { text: string; writtenAt: string }
  ruleResults: RuleResult[]
  levelState: FrozenLevelState | null
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
  /** Full engine events are accepted; they are compacted to RuleResult on freeze. */
  evidence: Omit<Evidence, 'noteAmendments' | 'changedSinceParent' | 'ruleResults' | 'levelState'> & {
    ruleResults: (TeachingEvent | RuleResult)[]
    levelState: LevelState | FrozenLevelState | null
  }
  /** The Trial this one was restored from; sets parentId and changedSinceParent. */
  parent?: Trial | null
  levelId?: string
}

export type TrialErrorCode =
  | 'prediction-required'
  | 'prediction-after-freeze'
  | 'invalid-date'
  /** A number that cannot be canonicalised (NaN, ±Infinity, out of quantisation range). */
  | 'invalid-design'
  /** The hasher failed (crypto.subtle missing). */
  | 'crypto-unavailable'

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

/**
 * Stores placements exactly as the fingerprint sees them (1 mm, yaw in
 * [0, 360) at 0.1°): smaller, and re-quantising is idempotent so fp1 is unchanged.
 */
function quantiseDesign(d: DesignState): DesignState {
  return {
    ...d,
    placements: d.placements.map((p) => ({
      ...p,
      position_m: p.position_m.map((v) => Number(quantField('position_m', v))) as [number, number, number],
      yawDeg: Number(quantField('yawDeg', p.yawDeg)),
    })),
  }
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

  // Canonicalise the ORIGINAL input: a JSON clone would silently turn NaN into null.
  let canon: string
  let changedSinceParent: string[]
  const parent = input.parent ?? null
  try {
    canon = canonicalize(input.design)
    changedSinceParent = parent ? diffDesign(parent.design, input.design) : []
  } catch {
    throw new TrialError('invalid-design')
  }
  let fp: string
  try {
    fp = FP_PREFIX + (await hash(canon))
  } catch {
    throw new TrialError('crypto-unavailable')
  }
  const design = quantiseDesign(cloneData(input.design))
  const trial = {
    formatVersion: 1 as const,
    id,
    name: input.name,
    frozenAt,
    parentId: parent ? parent.id : null,
    fingerprint: fp,
    design,
    consumed: cloneData(input.consumed),
    evidence: {
      prediction: { text: input.evidence.prediction.text, writtenAt: input.evidence.prediction.writtenAt },
      ruleResults: input.evidence.ruleResults.map(compactRule),
      levelState: cloneData(compactLevelState(input.evidence.levelState)),
      rulesRev: input.evidence.rulesRev,
      note: input.evidence.note,
      noteAmendments: [],
      changedSinceParent,
    },
    view: cloneData(input.view),
    ...(input.levelId !== undefined ? { levelId: input.levelId } : {}),
  }
  return deepFreeze(trial)
}

// ---- diffDesign: what changed between two designs (for changedSinceParent) ----

/** A placement as the fingerprint sees it (same quantisation, yaw normalised). */
const placementKey = (p: DeepReadonly<Placement>): string =>
  [...p.position_m.map((v) => quantField('position_m', v)), quantField('yawDeg', p.yawDeg)].join('|')

function multiset(keys: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
  return m
}

type DesignLike = DeepReadonly<DesignState> | DesignState

/**
 * Keys, in this order: 'room', 'instance:+id', 'instance:-id', 'instance:~id'
 * (deviceId changed), 'placement:id', 'connection:+N', 'connection:-N',
 * 'control:<instance>.<control>'. Ids sorted within each group.
 *
 * Positions and yaw are compared with the fingerprint's own quantisation
 * (quantField), so equal fp1 ⇔ empty diff (array order aside). A placement
 * counts as changed when its quantised position or yaw differs, when it exists
 * on one side only while the instance exists on both, or when its deviceId
 * differs without an 'instance:~' already saying so.
 */
export function diffDesign(a: DesignLike, b: DesignLike): string[] {
  const out: string[] = []
  if (a.roomId !== b.roomId) out.push('room')

  const ia = new Map(a.rig.instances.map((i) => [i.instanceId, i.deviceId]))
  const ib = new Map(b.rig.instances.map((i) => [i.instanceId, i.deviceId]))
  const both = [...ib.keys()].filter((x) => ia.has(x))
  for (const id of [...ib.keys()].filter((x) => !ia.has(x)).sort()) out.push(`instance:+${id}`)
  for (const id of [...ia.keys()].filter((x) => !ib.has(x)).sort()) out.push(`instance:-${id}`)
  const swapped = new Set(both.filter((id) => ia.get(id) !== ib.get(id)))
  for (const id of [...swapped].sort()) out.push(`instance:~${id}`)

  const pa = new Map(a.placements.map((p) => [p.instanceId, p]))
  const pb = new Map(b.placements.map((p) => [p.instanceId, p]))
  const moved: string[] = []
  for (const id of new Set([...pa.keys(), ...pb.keys()])) {
    const p = pa.get(id)
    const q = pb.get(id)
    if (!p || !q) {
      // a placement appearing/disappearing with its instance is already 'instance:±'
      if (ia.has(id) === ib.has(id)) moved.push(id)
      continue
    }
    if (placementKey(p) !== placementKey(q) || (p.deviceId !== q.deviceId && !swapped.has(id))) moved.push(id)
  }
  for (const id of moved.sort()) out.push(`placement:${id}`)

  const ca = multiset(a.rig.connections.map(canonicalCable))
  const cb = multiset(b.rig.connections.map(canonicalCable))
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
