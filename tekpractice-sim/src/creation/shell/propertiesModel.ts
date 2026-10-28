/**
 * The « Propriétés » model (Task 10, C5, P6): what the panel shows for the
 * selected device, and how a field edit becomes the intent to dispatch.
 * Pure: no DOM, no Babylon; the panel (propertiesPanel.ts) renders it and
 * sends the intents through `history.do` (the UI never mutates the graph).
 * Layout inspired by pro acoustic-design tools (a properties inspector).
 *
 * Units and conventions (read by acoustics, Task 36):
 * - x / y / z in metres, world axes, y up; y is the height of the device origin.
 * - yawDeg: rotation about +y, wrapped into [0, 360).
 * - tiltDeg: pitch about the device's own x axis, clamped to [−90, 90].
 *   SIGN: positive tilt = the front (the acoustic axis, local +z, P9 / ADR-0015)
 *   aims UPWARD; negative = aims down at the audience. SceneHost renders it so.
 * - mount 'floor' puts the device on the floor (y = floor height, height
 *   read-only); 'stand' and 'flown' keep an editable height, never below the floor.
 */
import type { Registry } from '../../engine/CatalogLoader'
import type { ControlValue, PortRef } from '../../engine/types'
import type { Intent } from '../../ui/intents'
import type { DesignState, Mount, Placement } from '../../trials/trial'
import { COPY } from '../copy'
import { cableText, portInfoOf } from '../cableStyle'
import { isUnverified } from '../betaDevices'

export type FieldId = 'name' | 'x' | 'y' | 'z' | 'yaw' | 'tilt' | 'mount'

export interface PropField {
  id: FieldId
  label: string
  value: string | number
  unit?: 'm' | '°'
  step?: number
  min?: number
  max?: number
  readOnly?: boolean
  /** The mount picker's choices. */
  options?: { value: string; label: string }[]
}
export interface PropControl {
  id: string
  label: string
  kind: 'toggle' | 'enum'
  value: ControlValue
  options?: string[]
}
export interface PropPort {
  portId: string
  label: string
  connector: string
  /** The connector in French (`COPY.connector`), else the catalog label. */
  connectorLabel: string
  signal: string
  /** The signal type in French (`COPY.signal`), else the catalog label. */
  signalLabel: string
  /**
   * The row's full accessible name (Task 28, CA-02): « <port id> · <connector> · <signal type> · branché à X / libre ».
   * The keyboard / screen-reader equivalent of the port label a pointer sees on hover.
   */
  name: string
  /** A connected row: the cable as the hover shows it (« ql1 out-main-l → k12-g in-line-a · Niveau ligne pro »). Null for a free row. */
  cable: string | null
  dir: 'in' | 'out' | 'bidir'
  state: { kind: 'free' } | { kind: 'connected'; to: PortRef; toLabel: string }
}
export interface PropsView {
  title: string
  deviceId: string
  instanceId: string
  fields: PropField[]
  controls: PropControl[]
  ports: PropPort[]
  /** A proposed (Bêta) device (Task 30): the panel says « non vérifié » under the title. */
  unverified: boolean
}

export interface FieldOpts {
  /** The place's floor height at (x, z); 0 when unknown (blank room, sets). */
  floorAt?(x: number, z: number): number
}

const P = (): Readonly<Record<string, string>> => COPY.props!
const MOUNTS: readonly Mount[] = ['floor', 'stand', 'flown']
const STEP: Record<'x' | 'y' | 'z' | 'yaw' | 'tilt', number> = { x: 0.1, y: 0.1, z: 0.1, yaw: 15, tilt: 1 }
export const TILT_MIN = -90
export const TILT_MAX = 90

const fill = (s: string, k: string, v: string): string => s.replace(`{${k}}`, () => v)
const mm = (v: number): number => Math.round(v * 1000) / 1000 + 0
const tenth = (v: number): number => Math.round(v * 10) / 10 + 0
const fr = (s: string): string => s.replace('.', ',')
const metres = (v: number): string => fr((Math.abs(v) < 0.005 ? 0 : v).toFixed(2))
const degrees = (v: number): string => fr(String(tenth(v)))
const wrapYaw = (v: number): number => {
  const w = tenth(((v % 360) + 360) % 360)
  return w >= 360 ? 0 : w
}
const clampTilt = (v: number): number => tenth(Math.min(TILT_MAX, Math.max(TILT_MIN, v)))

/** A short device name for the other end of a cable: the catalog label without its brand (« QSC K12.2 » → « K12.2 »). */
export function shortName(registry: Registry, deviceId: string): string {
  const d = registry.deviceById.get(deviceId)
  if (!d) return deviceId
  const brand = d.realWorld.brand
  return d.label.startsWith(`${brand} `) ? d.label.slice(brand.length + 1) : d.label
}

/** A connector's French name (the catalog label when the copy has none). */
export function connectorName(registry: Registry, connectorId: string): string {
  return COPY.connector?.[connectorId] ?? registry.connectorById.get(connectorId)?.label ?? connectorId
}
/** A signal type's French name (the legend's: the catalog label when the copy has none). */
export function signalName(registry: Registry, signalId: string): string {
  return COPY.signal?.[signalId] ?? registry.signalById.get(signalId)?.label ?? signalId
}

/** Above the floor by more than this (m), a placement with no mount reads as « Pied ». */
const ON_FLOOR_EPS = 0.005

/**
 * The device's pose; an unplaced device stands at the origin, yaw 0 (as SceneHost shows it).
 * A placement with no `mount` (legacy, templates) that stands above the floor
 * reads as 'stand' (review fix 4): its height stays editable and an edit never
 * drops it to the floor.
 */
function poseOf(design: DesignState, instanceId: string, opts: FieldOpts = {}): { position: [number, number, number]; yawDeg: number; tiltDeg: number; mount: Mount } {
  const p: Placement | undefined = design.placements.find((q) => q.instanceId === instanceId)
  const position: [number, number, number] = p ? [p.position_m[0], p.position_m[1], p.position_m[2]] : [0, 0, 0]
  const floor = opts.floorAt?.(position[0], position[2]) ?? 0
  return {
    position,
    yawDeg: p?.yawDeg ?? 0,
    tiltDeg: p?.tiltDeg ?? 0,
    mount: p?.mount ?? (position[1] > floor + ON_FLOOR_EPS ? 'stand' : 'floor'),
  }
}

export function propsView(design: DesignState, registry: Registry, instanceId: string, opts: FieldOpts = {}): PropsView | null {
  const inst = design.rig.instances.find((i) => i.instanceId === instanceId)
  const device = inst && registry.deviceById.get(inst.deviceId)
  if (!inst || !device) return null
  const pose = poseOf(design, instanceId, opts)
  const onFloor = pose.mount === 'floor'
  const fields: PropField[] = [
    { id: 'name', label: P().name!, value: instanceId, readOnly: true },
    { id: 'x', label: P().x!, value: metres(pose.position[0]), unit: 'm', step: STEP.x },
    { id: 'y', label: P().y!, value: metres(pose.position[1]), unit: 'm', step: STEP.y, ...(onFloor ? { readOnly: true } : {}) },
    { id: 'z', label: P().z!, value: metres(pose.position[2]), unit: 'm', step: STEP.z },
    { id: 'yaw', label: P().yaw!, value: degrees(pose.yawDeg), unit: '°', step: STEP.yaw, min: 0, max: 360 },
    { id: 'tilt', label: P().tilt!, value: degrees(pose.tiltDeg), unit: '°', step: STEP.tilt, min: TILT_MIN, max: TILT_MAX },
    {
      id: 'mount',
      label: P().mount!,
      value: pose.mount,
      options: [
        { value: 'floor', label: P().mountFloor! },
        { value: 'stand', label: P().mountStand! },
        { value: 'flown', label: P().mountFlown! },
      ],
    },
  ]
  const live = design.rig.controls[instanceId] ?? {}
  const controls: PropControl[] = (device.controls ?? []).map((c) =>
    c.type === 'toggle'
      ? { id: c.id, label: c.label, kind: 'toggle', value: (live[c.id] as ControlValue | undefined) ?? c.default }
      : { id: c.id, label: c.label, kind: 'enum', value: (live[c.id] as ControlValue | undefined) ?? c.defaultOption, options: [...c.options] },
  )
  const deviceOf = new Map(design.rig.instances.map((i) => [i.instanceId, i.deviceId]))
  const portOf = portInfoOf(registry, design.rig.instances)
  const ports: PropPort[] = device.ports.map((p) => {
    const conn = design.rig.connections.find(
      (c) => (c.a.instance === instanceId && c.a.port === p.portId) || (c.b.instance === instanceId && c.b.port === p.portId),
    )
    const to = conn ? (conn.a.instance === instanceId && conn.a.port === p.portId ? conn.b : conn.a) : null
    const toLabel = to ? `${shortName(registry, deviceOf.get(to.instance) ?? '')} (${to.instance}) · ${to.port}` : ''
    const signalLabel = signalName(registry, p.signal)
    const connectorLabel = connectorName(registry, p.connector)
    const me = { instance: instanceId, port: p.portId }
    // The cable as the hover shows it: the output end first, whichever way it is stored.
    const cable = to ? cableText(portOf, me, { instance: to.instance, port: to.port }) : null
    return {
      portId: p.portId,
      label: p.portId, // the catalog has no French port names yet
      connector: p.connector,
      connectorLabel,
      signal: p.signal,
      signalLabel,
      name: fill(fill(fill(fill(P().portName!, 'port', p.portId), 'connector', connectorLabel), 'signal', signalLabel), 'state', to ? fill(P().portStateConnected!, 'other', toLabel) : P().portFree!),
      cable,
      dir: p.dir,
      state: to ? { kind: 'connected', to: { instance: to.instance, port: to.port }, toLabel } : { kind: 'free' },
    }
  })
  return { title: device.label, deviceId: device.id, instanceId, fields, controls, ports, unverified: isUnverified(registry, device.id) }
}

/**
 * A typed number: French comma or dot, optional sign (« - » or « − »), spaces,
 * and the field's own unit (« 2,5 m », « 15° »). Null when it is not one.
 */
export function parseNumber(raw: string, unit?: 'm' | '°'): number | null {
  let s = raw.trim().replace(/−/g, '-')
  if (unit === 'm') s = s.replace(/\s*m$/i, '')
  if (unit === '°') s = s.replace(/\s*°$/, '')
  s = s.replace(/\s+/g, '')
  if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(s)) return null
  const v = Number(s.replace(',', '.'))
  return Number.isFinite(v) ? v : null
}

type Pose = ReturnType<typeof poseOf>

function poseIntent(instanceId: string, p: Pose): Intent {
  return { type: 'SET_POSE', instanceId, position: [mm(p.position[0]), mm(p.position[1]), mm(p.position[2])], yawDeg: p.yawDeg, tiltDeg: p.tiltDeg, mount: p.mount }
}

/** The pose with one numeric field set (wrapped / clamped), as a SET_POSE; null for a read-only field. */
function withNumber(view: PropsView, design: DesignState, field: 'x' | 'y' | 'z' | 'yaw' | 'tilt', v: number, opts: FieldOpts): Intent | null {
  if (view.fields.find((f) => f.id === field)?.readOnly) return null
  const p = poseOf(design, view.instanceId, opts)
  const floor = (x: number, z: number): number => opts.floorAt?.(x, z) ?? 0
  if (field === 'x') p.position[0] = v
  else if (field === 'z') p.position[2] = v
  else if (field === 'y') p.position[1] = v
  else if (field === 'yaw') p.yawDeg = wrapYaw(v)
  else p.tiltDeg = clampTilt(v)
  // Never below the floor (a floor device's height is read-only, so this only bounds stand / flown).
  if (field === 'y') p.position[1] = Math.max(floor(p.position[0], p.position[2]), p.position[1])
  return poseIntent(view.instanceId, p)
}

/** Parse a field edit into the intent to dispatch (null = invalid input, shown as an error on the field). */
export function fieldIntent(view: PropsView, design: DesignState, field: FieldId, raw: string, opts: FieldOpts = {}): Intent | null {
  if (field === 'name') return null // instance ids are fixed (undo and cables refer to them)
  if (field === 'mount') {
    if (!(MOUNTS as readonly string[]).includes(raw)) return null
    const p = poseOf(design, view.instanceId, opts)
    p.mount = raw as Mount
    if (p.mount === 'floor') p.position[1] = opts.floorAt?.(p.position[0], p.position[2]) ?? 0
    return poseIntent(view.instanceId, p)
  }
  const unit = field === 'yaw' || field === 'tilt' ? '°' : 'm'
  const v = parseNumber(raw, unit)
  return v === null ? null : withNumber(view, design, field, v, opts)
}

/** One ± stepper press from the store value (X ± 0,1 m, yaw ± 15°, tilt ± 1°); null for a read-only field. */
export function stepIntent(view: PropsView, design: DesignState, field: 'x' | 'y' | 'z' | 'yaw' | 'tilt', dir: 1 | -1, opts: FieldOpts = {}): Intent | null {
  const p = poseOf(design, view.instanceId, opts)
  const now = field === 'x' ? p.position[0] : field === 'y' ? p.position[1] : field === 'z' ? p.position[2] : field === 'yaw' ? p.yawDeg : p.tiltDeg
  return withNumber(view, design, field, now + dir * STEP[field], opts)
}

/** False when the intent is a SET_POSE that leaves the device exactly where it is (nothing to record). */
export function poseChanged(design: DesignState, intent: Intent, opts: FieldOpts = {}): boolean {
  if (intent.type !== 'SET_POSE') return true
  if (!design.placements.some((q) => q.instanceId === intent.instanceId)) return true
  const p = poseOf(design, intent.instanceId, opts)
  return (
    p.position.some((v, i) => mm(v) !== intent.position[i]) || p.yawDeg !== intent.yawDeg || p.tiltDeg !== intent.tiltDeg || p.mount !== intent.mount
  )
}
