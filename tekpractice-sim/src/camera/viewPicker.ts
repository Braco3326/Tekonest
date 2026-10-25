/**
 * The `V` picker model (Task 16, C11): 8 azimuths × 5 elevations with the two
 * poles collapsed to one cell each = 8 × 3 + 2 = 26 cells, one per cube zone.
 * Pure. Azimuth k follows OCTANTS (0 = Face, clockwise seen from above, so
 * ArrowRight turns toward « droite »). Elevation: 0 = horizon, ±1 = ¾ band,
 * ±2 = pole (Dessus / Dessous).
 */
import { OCTANTS, type ZoneSigns } from './cubeZones'

export type PickerElevation = -2 | -1 | 0 | 1 | 2
export interface PickerCell {
  az: number
  el: PickerElevation
  zone: ZoneSigns
}

export const PICKER_CELLS: readonly PickerCell[] = (() => {
  const out: PickerCell[] = []
  for (const el of [2, 1, 0, -1, -2] as PickerElevation[]) {
    if (Math.abs(el) === 2) {
      out.push({ az: 0, el, zone: { x: 0, y: el > 0 ? 1 : -1, z: 0 } })
      continue
    }
    for (let az = 0; az < 8; az++) {
      const [x, z] = OCTANTS[az]
      out.push({ az, el, zone: { x, y: el === 0 ? 0 : el > 0 ? 1 : -1, z } })
    }
  }
  return out
})()

const find = (az: number, el: PickerElevation): PickerCell => {
  const c = PICKER_CELLS.find((p) => p.az === az && p.el === el)
  if (!c) throw new Error(`no picker cell az=${az} el=${el}`)
  return c
}

export function pickerMove(
  cell: PickerCell,
  key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown',
  prevAz?: number,
): PickerCell {
  const pole = Math.abs(cell.el) === 2
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    if (pole) return cell
    return find((cell.az + (key === 'ArrowRight' ? 1 : 7)) % 8, cell.el)
  }
  const next = Math.max(-2, Math.min(2, cell.el + (key === 'ArrowUp' ? 1 : -1))) as PickerElevation
  if (Math.abs(next) === 2) return find(0, next) // the single pole cell
  // Leaving a pole: return at the caller's last non-pole azimuth (default 0 = Face).
  const az = pole ? (((Math.round(prevAz ?? 0) % 8) + 8) % 8) : cell.az
  return find(az, next)
}
