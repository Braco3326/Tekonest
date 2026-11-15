/**
 * Persistence of the 2D plan (mission 2, spec §2-§3): its OWN localStorage key, never the 3D design (DesignState, src/creation/store.ts and the autosave
 * of src/creation/persistence.ts know nothing of it: engine neutrality stays).
 *
 * - Key: `audio-sim/plan2d.v1.<project key>`, the project key being `<project name>@<place key>`, both parts URI-encoded (an untitled project has an
 *   empty name part). One plan per project and place (the founder may choose per project only: spec §9).
 * - Versioned: the record is a `Plan2D` with `v: 1`; any other version, a record that does not parse, or one of the wrong shape is DROPPED (removed) and
 *   reported (`dropped: true`), never thrown and never half-read.
 * - Every storage call is in try/catch: a blocked or full storage (or none) reads as « nothing stored » and a refused write returns false.
 */
import type { Plan2D, PlanCable, PlanDevice } from './model'

export const PLAN2D_KEY_PREFIX = 'audio-sim/plan2d.v1.'

export const projectKey = (projectName: string | null, placeKey: string | null): string => `${encodeURIComponent(projectName ?? '')}@${encodeURIComponent(placeKey ?? '')}`
export const planKey = (projectName: string | null, placeKey: string | null): string => PLAN2D_KEY_PREFIX + projectKey(projectName, placeKey)

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const end = (v: unknown): v is { dev: string; port: string } => isObj(v) && str(v.dev) && str(v.port)

/** The record as a plan, or null when anything in it is not a v1 plan. */
export function parsePlan(raw: unknown): Plan2D | null {
  if (!isObj(raw) || raw.v !== 1) return null
  if (raw.roomId !== null && typeof raw.roomId !== 'string') return null
  if (!Array.isArray(raw.devices) || !Array.isArray(raw.cables)) return null
  const devices: PlanDevice[] = []
  for (const d of raw.devices) {
    if (!isObj(d) || !str(d.id) || !str(d.deviceId) || !num(d.x) || !num(d.z) || !num(d.rot)) return null
    devices.push({ id: d.id, deviceId: d.deviceId, x: d.x, z: d.z, rot: d.rot })
  }
  const ids = new Set(devices.map((d) => d.id))
  if (ids.size !== devices.length) return null
  const cables: PlanCable[] = []
  for (const c of raw.cables) {
    if (!isObj(c) || !str(c.id) || !end(c.a) || !end(c.b)) return null
    if (!ids.has(c.a.dev) || !ids.has(c.b.dev)) return null
    if (c.type !== undefined && typeof c.type !== 'string') return null
    cables.push({ id: c.id, a: { dev: c.a.dev, port: c.a.port }, b: { dev: c.b.dev, port: c.b.port }, ...(typeof c.type === 'string' ? { type: c.type } : {}) })
  }
  return { v: 1, roomId: raw.roomId as string | null, devices, cables }
}

export function loadPlan(storage: Storage | null, key: string): { plan: Plan2D | null; dropped: boolean } {
  if (!storage) return { plan: null, dropped: false }
  let text: string | null
  try {
    text = storage.getItem(key)
  } catch {
    return { plan: null, dropped: false }
  }
  if (text === null) return { plan: null, dropped: false }
  let plan: Plan2D | null = null
  try {
    plan = parsePlan(JSON.parse(text))
  } catch {
    plan = null
  }
  if (plan) return { plan, dropped: false }
  try {
    storage.removeItem(key)
  } catch {
    // a storage that refuses the removal keeps the record; it is still not read
  }
  return { plan: null, dropped: true }
}

export function savePlan(storage: Storage | null, key: string, plan: Plan2D): boolean {
  if (!storage) return false
  try {
    storage.setItem(key, JSON.stringify(plan))
    return true
  } catch {
    return false
  }
}
