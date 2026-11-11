/**
 * assets3d/flatZones: the areas of a device's faces that its control layout (content/control-layouts/<id>.json) hands to the 3D rig.
 * The rig draws the faders, knobs, buttons, LEDs, meters and screens there itself, so modelled detail (ear slots, handles, vents, insets)
 * must never intersect one: a modelled copy would double the rig's caps. The builder gets these rectangles as plan.flatZones and
 * raises a BuildError when a feature of the same face overlaps one (build_from_spec.py: rack_zone_check).
 *
 * Face-local millimetres as in the layouts and the asset specs: origin bottom-left of the face seen from outside, x right, y up
 * (on 'top' and 'bottom' y = 0 is the io edge). A zone is a control's footprint (w x h around its centre; a fader also covers its
 * cap travel along its axis) grown by FLAT_ZONE_MARGIN_MM on every side.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expandControlEntry } from '../../src/controls/controlTypes'

/** Default folder of the layouts: content/control-layouts. */
export const DEFAULT_LAYOUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'control-layouts')

/** How far a flat zone reaches past the control's own footprint, in millimetres. */
export const FLAT_ZONE_MARGIN_MM = 3

export interface FlatZone {
  face: string
  x0: number
  y0: number
  x1: number
  y1: number
}

interface LayoutControl {
  face: string
  xMm: number
  yMm: number
  sizeMm: { w: number; h: number; d?: number }
  axis?: string
  travelMm?: number
  reverse?: boolean
}

/**
 * The flat zones of `deviceId`, one per control of its layout; [] when the device has no layout. A malformed layout throws
 * (a layout the builder cannot read must not silently allow a vent over a knob).
 */
export function flatZonesFor(deviceId: string, dir: string = DEFAULT_LAYOUT_DIR): FlatZone[] {
  const path = resolve(dir, `${deviceId}.json`)
  if (!existsSync(path)) return []
  let layout: unknown
  try {
    layout = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    throw new Error(`control layout ${path} is not valid JSON: ${(err as Error).message}`)
  }
  const controls = (layout as { controls?: unknown }).controls
  if (!Array.isArray(controls)) throw new Error(`control layout ${path} has no controls list`)
  // `repeat` is expanded by the layout parser's own function (8 channel strips are 8 zones, not one)
  const expanded: LayoutControl[] = []
  controls.forEach((entry: unknown, i: number) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) throw new Error(`control layout ${path}: control ${i} has no face, position or size`)
    const raw = entry as Record<string, unknown>
    if (raw.repeat === undefined) {
      expanded.push(raw as unknown as LayoutControl)
      return
    }
    const ex = expandControlEntry(raw)
    if (ex.error) throw new Error(`control layout ${path}: control ${i}: ${ex.error}`)
    for (const e of ex.expanded) expanded.push(e.raw as unknown as LayoutControl)
  })
  return expanded.map((c: LayoutControl, i: number) => {
    const ok = typeof c?.face === 'string' && Number.isFinite(c.xMm) && Number.isFinite(c.yMm) && Number.isFinite(c.sizeMm?.w) && Number.isFinite(c.sizeMm?.h)
    if (!ok) throw new Error(`control layout ${path}: control ${i} has no face, position or size`)
    let x0 = c.xMm - c.sizeMm.w / 2
    let x1 = c.xMm + c.sizeMm.w / 2
    let y0 = c.yMm - c.sizeMm.h / 2
    let y1 = c.yMm + c.sizeMm.h / 2
    const travel = Number.isFinite(c.travelMm) && (c.axis === 'x' || c.axis === 'y') ? (c.travelMm as number) * (c.reverse ? -1 : 1) : 0
    if (c.axis === 'x') {
      if (travel >= 0) x1 += travel
      else x0 += travel
    } else if (c.axis === 'y') {
      if (travel >= 0) y1 += travel
      else y0 += travel
    }
    const m = FLAT_ZONE_MARGIN_MM
    return { face: c.face, x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m }
  })
}
