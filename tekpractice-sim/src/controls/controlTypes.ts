/**
 * controls/controlTypes: what a device's hands-on surface is, as data. A layout (content/control-layouts/<deviceId>.json) lists the
 * faders, knobs, buttons, switches, LEDs and meters of one model with their real position on a face (the same face-local millimetres
 * as the asset specs), their real size and their range. The 3D rig builds the moving parts from it, the bank holds the values, and
 * the console software of a later phase reads and writes the same bank: nothing here knows Babylon.
 *
 * Face-local coordinates, as in tools/assets3d/specSchema.ts: origin bottom-left of the face seen from OUTSIDE, x right, y up, mm.
 * On 'top' and 'bottom' y=0 is the I/O edge. A fader's (xMm, yMm) is the centre of its cap at value 0; the cap travels `travelMm`
 * along `axis` ('x' or 'y' of the face) toward +. For a knob / button / switch / led the (xMm, yMm) is the centre.
 */

export const FACES = ['io', 'opposite', 'top', 'bottom', 'left', 'right'] as const
export type Face = (typeof FACES)[number]

export const KINDS = ['fader', 'knob', 'button', 'switch', 'led', 'meter', 'screen'] as const
export type ControlKind = (typeof KINDS)[number]

export interface MeterSpec {
  /** vu = needle in a dial window; bar = a row of LED segments. */
  style: 'vu' | 'bar'
  /** The meter bus this one reads (a channel, the master…). The software layer feeds buses by name; the demo signal feeds all. */
  source: string
  /** bar: how many segments. */
  segments?: number
  /** bar: dBFS at the first and the last segment. */
  fromDb?: number
  toDb?: number
  /** vu: dBFS that reads 0 VU (default -18, the EBU line-up level). */
  referenceDb?: number
}

/** A screen: the app it runs (screenApp.ts) and the resolution of its canvas. */
export interface ScreenSpec {
  app: string
  pxW: number
  pxH: number
}

export interface ControlDef {
  id: string
  kind: ControlKind
  face: Face
  xMm: number
  yMm: number
  /** w along the face x, h along the face y, d out of the face. */
  sizeMm: { w: number; h: number; d: number }
  /** fader: the travel axis on the face ('z' is not valid for it). Others: 'z' (out of the face). */
  axis: 'x' | 'y' | 'z'
  /** fader: the cap travels toward the I/O edge (-) instead of away from it (+): value 0 sits at (xMm, yMm), value 1 is travelMm nearer the edge. */
  reverse?: boolean
  /** With catalogControl on a toggle: the control is the opposite of the setting (an ON key lit = « mute » false). */
  invert?: boolean
  /** fader: cap travel. button: how far a press sinks (default 1.5). */
  travelMm?: number
  /** Normalised start value (fader / knob 0..1, button 0 or 1, switch an index). */
  default: number
  /** fader / knob response: linear, the 0 dB-at-75 % console fader taper, or a plain range. */
  taper?: 'linear' | 'fader-db' | 'broadcast-db'
  /** Display range of a linear control (« -20 … +60 dB ») for its value text. */
  range?: { min: number; max: number; unit: string }
  /** knob: sweep of the pointer in degrees (default 270). */
  sweepDeg?: number
  /** button: stays pressed and lit after a click (default true); false = lit only while held. */
  latch?: boolean
  /** button / led: a round cap (a cylinder of diameter w) instead of a rectangular one. */
  round?: boolean
  /** switch: number of positions (default 2). */
  positions?: number
  /** Cap / body colour, and the colour a lit part glows with. sRGB hex. */
  colour?: string
  lit?: string
  /** A key's printed legend colour (default dark ink, for a light cap). */
  ink?: string
  /** fader: lay a dark slot plate under the cap, to hide the cap a photograph already shows there. */
  slot?: boolean
  /** fader: the plate's size when the photographed slot is not cap-sized: width across, length along the travel, centred on it. */
  slotMm?: { w: number; len: number }
  /** button: keys with the same group are radio (pressing one releases the others): an ON / OFF pair. */
  group?: string
  meter?: MeterSpec
  screen?: ScreenSpec
  /** The catalog control this one is (« power », « fader-master ») when it stands for one. */
  catalogControl?: string
  label?: string
}

export interface ControlLayout {
  schema: 1
  deviceId: string
  /** A sloped top (a console wedge): [depth from the I/O edge mm, height mm] points, as the spec's build.profile. Controls on 'top' sit on it. */
  topProfile?: [number, number][]
  controls: ControlDef[]
}

const HEX = /^#[0-9a-fA-F]{6}$/
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** A raw control may carry `repeat` to stand for a row / column of identical ones (8 channel faders). */
interface Repeat {
  count: number
  dxMm: number
  dyMm: number
  /** Id pattern, « fader-{n} » (n counts from 1). */
  idFormat: string
}

function parseSize(v: unknown): ControlDef['sizeMm'] | null {
  if (!isRec(v) || !isNum(v.w) || !isNum(v.h) || !isNum(v.d) || v.w <= 0 || v.h <= 0 || v.d <= 0) return null
  return { w: v.w, h: v.h, d: v.d }
}

/** Records an error and returns null (a parse step that gives up). */
const fail = (errors: string[], message: string): null => {
  errors.push(message)
  return null
}

function parseOne(raw: Record<string, unknown>, id: string, errors: string[]): ControlDef | null {
  const at = `control "${id}"`
  const kind = raw.kind
  if (typeof kind !== 'string' || !(KINDS as readonly string[]).includes(kind)) return fail(errors, `${at}: unknown kind`)
  const face = raw.face
  if (typeof face !== 'string' || !(FACES as readonly string[]).includes(face)) return fail(errors, `${at}: unknown face`)
  if (!isNum(raw.xMm) || !isNum(raw.yMm)) return fail(errors, `${at}: xMm / yMm must be numbers`)
  const sizeMm = parseSize(raw.sizeMm)
  if (!sizeMm) return fail(errors, `${at}: sizeMm needs positive w, h, d`)
  const axis = raw.axis === undefined ? (kind === 'fader' ? 'y' : 'z') : raw.axis
  if (axis !== 'x' && axis !== 'y' && axis !== 'z') return fail(errors, `${at}: axis must be x, y or z`)
  if (kind === 'fader') {
    if (axis === 'z') return fail(errors, `${at}: a fader travels along x or y of its face`)
    if (!isNum(raw.travelMm) || raw.travelMm <= 0) return fail(errors, `${at}: a fader needs travelMm > 0`)
  }
  const def: ControlDef = {
    id,
    kind: kind as ControlKind,
    face: face as Face,
    xMm: raw.xMm,
    yMm: raw.yMm,
    sizeMm,
    axis,
    default: isNum(raw.default) ? raw.default : 0,
  }
  if (isNum(raw.travelMm) && raw.travelMm > 0) def.travelMm = raw.travelMm
  if (raw.taper === 'linear' || raw.taper === 'fader-db' || raw.taper === 'broadcast-db') def.taper = raw.taper
  if (isRec(raw.range) && isNum(raw.range.min) && isNum(raw.range.max) && typeof raw.range.unit === 'string') def.range = { min: raw.range.min, max: raw.range.max, unit: raw.range.unit }
  if (isNum(raw.sweepDeg) && raw.sweepDeg > 0 && raw.sweepDeg <= 360) def.sweepDeg = raw.sweepDeg
  if (typeof raw.latch === 'boolean') def.latch = raw.latch
  if (raw.round === true) def.round = true
  if (raw.reverse === true && kind === 'fader') def.reverse = true
  if (raw.invert === true) def.invert = true
  if (isNum(raw.positions) && Number.isInteger(raw.positions) && raw.positions >= 2) def.positions = raw.positions
  if (typeof raw.colour === 'string' && HEX.test(raw.colour)) def.colour = raw.colour
  if (typeof raw.lit === 'string' && HEX.test(raw.lit)) def.lit = raw.lit
  if (typeof raw.ink === 'string' && HEX.test(raw.ink)) def.ink = raw.ink
  if (raw.slot === true) def.slot = true
  if (isRec(raw.slotMm) && isNum(raw.slotMm.w) && isNum(raw.slotMm.len) && raw.slotMm.w > 0 && raw.slotMm.len > 0) def.slotMm = { w: raw.slotMm.w, len: raw.slotMm.len }
  if (typeof raw.group === 'string' && raw.group) def.group = raw.group
  if (typeof raw.catalogControl === 'string') def.catalogControl = raw.catalogControl
  if (typeof raw.label === 'string') def.label = raw.label
  if (kind === 'screen') {
    const sc = raw.screen
    if (!isRec(sc) || typeof sc.app !== 'string' || !sc.app || !isNum(sc.pxW) || !isNum(sc.pxH) || sc.pxW < 64 || sc.pxH < 64 || sc.pxW > 2048 || sc.pxH > 2048) return fail(errors, `${at}: a screen needs screen.app and screen.pxW / pxH (64 … 2048)`)
    def.screen = { app: sc.app, pxW: Math.round(sc.pxW), pxH: Math.round(sc.pxH) }
  }
  if (kind === 'meter') {
    const m = raw.meter
    if (!isRec(m) || (m.style !== 'vu' && m.style !== 'bar') || typeof m.source !== 'string' || !m.source) return fail(errors, `${at}: a meter needs meter.style (vu | bar) and meter.source`)
    const meter: MeterSpec = { style: m.style, source: m.source }
    if (isNum(m.segments) && Number.isInteger(m.segments) && m.segments >= 2) meter.segments = m.segments
    if (isNum(m.fromDb)) meter.fromDb = m.fromDb
    if (isNum(m.toDb)) meter.toDb = m.toDb
    if (isNum(m.referenceDb)) meter.referenceDb = m.referenceDb
    def.meter = meter
  }
  return def
}

const normaliseDefault = (def: ControlDef, v: number): number => (def.kind === 'button' || def.kind === 'led' ? (v >= 0.5 ? 1 : 0) : v)

/** The layout of a raw JSON value, `repeat` expanded; `errors` lists every problem (an invalid layout is null, never half-built). */
export function parseControlLayout(raw: unknown): { layout: ControlLayout | null; errors: string[] } {
  const errors: string[] = []
  if (!isRec(raw) || raw.schema !== 1 || typeof raw.deviceId !== 'string' || !Array.isArray(raw.controls)) {
    return { layout: null, errors: ['not a control layout (schema 1, deviceId, controls[])'] }
  }
  const controls: ControlDef[] = []
  const seen = new Set<string>()
  for (const entry of raw.controls as unknown[]) {
    if (!isRec(entry)) {
      errors.push('a control entry is not an object')
      continue
    }
    const rep = entry.repeat
    let expanded: { id: string; raw: Record<string, unknown> }[] = []
    if (rep === undefined) {
      if (typeof entry.id !== 'string' || !entry.id) {
        errors.push('a control has no id')
        continue
      }
      expanded = [{ id: entry.id, raw: entry }]
    } else {
      const r = rep as Partial<Repeat>
      if (!isRec(rep) || !isNum(r.count) || !Number.isInteger(r.count) || r.count < 1 || !isNum(r.dxMm) || !isNum(r.dyMm) || typeof r.idFormat !== 'string' || !r.idFormat.includes('{n}')) {
        errors.push('repeat needs count (integer ≥ 1), dxMm, dyMm and idFormat containing {n}')
        continue
      }
      for (let n = 1; n <= r.count; n++) {
        expanded.push({
          id: r.idFormat.replace('{n}', String(n)),
          raw: {
            ...entry,
            xMm: (entry.xMm as number) + (n - 1) * r.dxMm,
            yMm: (entry.yMm as number) + (n - 1) * r.dyMm,
            // A group or a legend may carry {n} too (strip 3's ON / OFF pair, a numbered key).
            ...(typeof entry.group === 'string' ? { group: entry.group.replace('{n}', String(n)) } : {}),
            ...(typeof entry.label === 'string' ? { label: entry.label.replace('{n}', String(n)) } : {}),
            ...(isRec(entry.meter) && typeof entry.meter.source === 'string' ? { meter: { ...entry.meter, source: entry.meter.source.replace('{n}', String(n)) } } : {}),
          },
        })
      }
    }
    for (const { id, raw: r } of expanded) {
      if (seen.has(id)) {
        errors.push(`control "${id}" is defined twice`)
        continue
      }
      seen.add(id)
      const def = parseOne(r, id, errors)
      if (def) controls.push(def)
    }
  }
  let topProfile: [number, number][] | undefined
  if (raw.topProfile !== undefined) {
    const tp = raw.topProfile
    const ok = Array.isArray(tp) && tp.length >= 2 && tp.every((p, i) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]) && p[1] > 0 && (i === 0 || p[0] > (tp[i - 1] as number[])[0]))
    if (ok) topProfile = (tp as [number, number][]).map((p) => [p[0], p[1]])
    else errors.push('topProfile needs at least two [depthMm, heightMm] points with increasing depth')
  }
  // Per-control overrides of an expanded row (strip 1's fader is the simulation's « Mic 1 fader »): only the link, the legend and the start value.
  if (raw.overrides !== undefined) {
    if (!isRec(raw.overrides)) errors.push('overrides must be an object of control id -> fields')
    else
      for (const [id, o] of Object.entries(raw.overrides)) {
        const def = controls.find((c) => c.id === id)
        if (!def || !isRec(o)) {
          errors.push(`overrides: no control "${id}"`)
          continue
        }
        if (typeof o.catalogControl === 'string') def.catalogControl = o.catalogControl
        if (o.invert === true) def.invert = true
        if (typeof o.label === 'string') def.label = o.label
        if (isNum(o.default)) def.default = normaliseDefault(def, o.default)
      }
  }
  if (errors.length) return { layout: null, errors }
  return { layout: { schema: 1, deviceId: raw.deviceId, ...(topProfile ? { topProfile } : {}), controls }, errors }
}
