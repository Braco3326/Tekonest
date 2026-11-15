/**
 * The 2D schema plan (mission 2, spec §3): plain data and pure intents. No DOM, no Babylon, no catalogue.
 *
 * `Plan2D v1 = { v: 1, roomId, devices: [{ id, deviceId, x, z, rot }], cables: [{ id, a: { dev, port }, b: { dev, port }, type? }] }`.
 * x / z are metres from the room's own origin (the floor centre), on the same axes as the 3D placements, and `rot` is the 3D yaw in degrees
 * (0 = the front faces +z), so that a later spawn into 3D is the identity transform.
 *
 * Plans are immutable values: `applyIntent` returns a new plan or a refusal and never touches the plan it is given. Ids are stable: a device id is
 * `<deviceId>-<n>` with n one above the highest number in use for that device, a cable id is `c<n>` above every cable id ever seen in this plan
 * (the highest present), so undo / redo (which restore whole plans) give the same ids back. The catalogue's connection rules are NOT here: the
 * model only refuses what is structurally wrong (an unknown id, a port already cabled, the same port twice); `patchRules.ts` answers the rest.
 */
export interface PortEnd {
  dev: string
  port: string
}
export interface PlanDevice {
  id: string
  deviceId: string
  x: number
  z: number
  rot: number
}
export interface PlanCable {
  id: string
  a: PortEnd
  b: PortEnd
  /** The cable type derived from the two ports (cableStyle2d.ts), never typed by the learner. */
  type?: string
}
export interface Plan2D {
  v: 1
  roomId: string | null
  devices: readonly PlanDevice[]
  cables: readonly PlanCable[]
}

export type PlanIntent =
  | { type: 'place'; deviceId: string; x: number; z: number; rot?: number }
  | { type: 'move'; ids: readonly string[]; dx: number; dz: number }
  | { type: 'setPose'; id: string; x: number; z: number; rot?: number }
  | { type: 'rotate'; ids: readonly string[]; by: number }
  | { type: 'remove'; ids: readonly string[] }
  | { type: 'duplicate'; ids: readonly string[]; dx: number; dz: number }
  | { type: 'connect'; a: PortEnd; b: PortEnd; cableType?: string }
  | { type: 'disconnect'; ids: readonly string[] }

export type RefusalCode = 'UNKNOWN_DEVICE' | 'UNKNOWN_CABLE' | 'PORT_TAKEN' | 'SAME_PORT' | 'NOT_FINITE' | 'EMPTY'
export type ApplyResult = { ok: true; plan: Plan2D; created: string[] } | { ok: false; code: RefusalCode; message: string }

export const emptyPlan = (roomId: string | null): Plan2D => ({ v: 1, roomId, devices: [], cables: [] })

/** Degrees in [0, 360), rounded to a millionth of a degree. */
export const normRot = (deg: number): number => {
  const r = Math.round((((deg % 360) + 360) % 360) * 1e6) / 1e6
  return r === 360 ? 0 : r
}
/** Metres rounded to 0.1 mm: a sum of snapped steps never carries float noise. */
const m = (v: number): number => {
  const r = Math.round(v * 1e4) / 1e4
  return Object.is(r, -0) ? 0 : r
}
const finite = (...v: number[]): boolean => v.every((n) => typeof n === 'number' && Number.isFinite(n))
const no = (code: RefusalCode, message: string): ApplyResult => ({ ok: false, code, message })
const same = (a: PortEnd, b: PortEnd): boolean => a.dev === b.dev && a.port === b.port

/** The cable on this port, if any. */
export const cableAt = (plan: Plan2D, end: PortEnd): PlanCable | undefined => plan.cables.find((c) => same(c.a, end) || same(c.b, end))

function nextDeviceId(devices: readonly PlanDevice[], deviceId: string): string {
  const prefix = `${deviceId}-`
  let n = 0
  for (const d of devices) {
    if (!d.id.startsWith(prefix)) continue
    const k = Number(d.id.slice(prefix.length))
    if (Number.isInteger(k) && k > n) n = k
  }
  return `${prefix}${n + 1}`
}
function nextCableId(cables: readonly PlanCable[]): string {
  let n = 0
  for (const c of cables) {
    const k = Number(c.id.slice(1))
    if (c.id.startsWith('c') && Number.isInteger(k) && k > n) n = k
  }
  return `c${n + 1}`
}

function knownAll(plan: Plan2D, ids: readonly string[]): string | null {
  if (!ids.length) return 'no device listed'
  const have = new Set(plan.devices.map((d) => d.id))
  const missing = ids.find((id) => !have.has(id))
  return missing === undefined ? null : `no device "${missing}"`
}

export function applyIntent(plan: Plan2D, intent: PlanIntent): ApplyResult {
  const done = (next: Partial<Plan2D>, created: string[] = []): ApplyResult => ({ ok: true, plan: { ...plan, ...next }, created })
  switch (intent.type) {
    case 'place': {
      if (!intent.deviceId) return no('UNKNOWN_DEVICE', 'no device id')
      if (!finite(intent.x, intent.z, intent.rot ?? 0)) return no('NOT_FINITE', 'position is not finite')
      const id = nextDeviceId(plan.devices, intent.deviceId)
      return done({ devices: [...plan.devices, { id, deviceId: intent.deviceId, x: m(intent.x), z: m(intent.z), rot: normRot(intent.rot ?? 0) }] }, [id])
    }
    case 'move': {
      const bad = knownAll(plan, intent.ids)
      if (bad) return no(intent.ids.length ? 'UNKNOWN_DEVICE' : 'EMPTY', bad)
      if (!finite(intent.dx, intent.dz)) return no('NOT_FINITE', 'offset is not finite')
      const ids = new Set(intent.ids)
      return done({ devices: plan.devices.map((d) => (ids.has(d.id) ? { ...d, x: m(d.x + intent.dx), z: m(d.z + intent.dz) } : d)) })
    }
    case 'setPose': {
      const bad = knownAll(plan, [intent.id])
      if (bad) return no('UNKNOWN_DEVICE', bad)
      if (!finite(intent.x, intent.z, intent.rot ?? 0)) return no('NOT_FINITE', 'pose is not finite')
      return done({ devices: plan.devices.map((d) => (d.id === intent.id ? { ...d, x: m(intent.x), z: m(intent.z), rot: intent.rot === undefined ? d.rot : normRot(intent.rot) } : d)) })
    }
    case 'rotate': {
      const bad = knownAll(plan, intent.ids)
      if (bad) return no(intent.ids.length ? 'UNKNOWN_DEVICE' : 'EMPTY', bad)
      if (!finite(intent.by)) return no('NOT_FINITE', 'angle is not finite')
      const ids = new Set(intent.ids)
      return done({ devices: plan.devices.map((d) => (ids.has(d.id) ? { ...d, rot: normRot(d.rot + intent.by) } : d)) })
    }
    case 'remove': {
      const bad = knownAll(plan, intent.ids)
      if (bad) return no(intent.ids.length ? 'UNKNOWN_DEVICE' : 'EMPTY', bad)
      const ids = new Set(intent.ids)
      return done({ devices: plan.devices.filter((d) => !ids.has(d.id)), cables: plan.cables.filter((c) => !ids.has(c.a.dev) && !ids.has(c.b.dev)) })
    }
    case 'duplicate': {
      const bad = knownAll(plan, intent.ids)
      if (bad) return no(intent.ids.length ? 'UNKNOWN_DEVICE' : 'EMPTY', bad)
      if (!finite(intent.dx, intent.dz)) return no('NOT_FINITE', 'offset is not finite')
      const devices = [...plan.devices]
      const created: string[] = []
      for (const id of intent.ids) {
        const src = plan.devices.find((d) => d.id === id)!
        const nid = nextDeviceId(devices, src.deviceId)
        devices.push({ ...src, id: nid, x: m(src.x + intent.dx), z: m(src.z + intent.dz) })
        created.push(nid)
      }
      return done({ devices }, created)
    }
    case 'connect': {
      const { a, b } = intent
      const have = new Set(plan.devices.map((d) => d.id))
      if (!have.has(a.dev) || !have.has(b.dev)) return no('UNKNOWN_DEVICE', `no device "${have.has(a.dev) ? b.dev : a.dev}"`)
      if (same(a, b)) return no('SAME_PORT', 'a cable needs two ports')
      if (cableAt(plan, a) || cableAt(plan, b)) return no('PORT_TAKEN', 'a port is already cabled')
      const id = nextCableId(plan.cables)
      const cable: PlanCable = { id, a: { dev: a.dev, port: a.port }, b: { dev: b.dev, port: b.port }, ...(intent.cableType ? { type: intent.cableType } : {}) }
      return done({ cables: [...plan.cables, cable] }, [id])
    }
    case 'disconnect': {
      if (!intent.ids.length) return no('EMPTY', 'no cable listed')
      const have = new Set(plan.cables.map((c) => c.id))
      const missing = intent.ids.find((id) => !have.has(id))
      if (missing !== undefined) return no('UNKNOWN_CABLE', `no cable "${missing}"`)
      const ids = new Set(intent.ids)
      return done({ cables: plan.cables.filter((c) => !ids.has(c.id)) })
    }
  }
}

/** A plain pick replaces the selection; an additive pick (Maj, Ctrl) toggles the id in it. */
export function selectToggle(selection: readonly string[], id: string, additive: boolean): string[] {
  if (!additive) return [id]
  return selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id]
}
