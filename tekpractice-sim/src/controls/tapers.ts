/**
 * controls/tapers: how a normalised control value (0..1 on the cap's travel or the knob's sweep) maps to what it means, and back.
 * The console fader is not linear: 0 dB sits at three quarters of the travel, the top gives +10 dB, and the bottom is -inf.
 */
import type { ControlDef } from './controlTypes'

/** [travel 0..1, dB]: Yamaha-style console fader scale (0 dB at 75 %, +10 at the top), linear in dB between the marks. */
const FADER_DB: readonly [number, number][] = [
  [0, -90],
  [0.1, -60],
  [0.25, -30],
  [0.5, -10],
  [0.75, 0],
  [1, 10],
]

/** Broadcast console fader as printed on the Axia iQ: -inf at the far end of the slot, 0 dB at 90 % of the travel, +10 at the near end. */
const BROADCAST_DB: readonly [number, number][] = [
  [0, -90],
  [0.1, -70],
  [0.234, -50],
  [0.382, -30],
  [0.539, -20],
  [0.711, -10],
  [0.898, 0],
  [1, 10],
]

function interpolate(points: readonly [number, number][], v: number): number {
  const x = Math.min(1, Math.max(0, v))
  if (x === 0) return -Infinity
  for (let i = 1; i < points.length; i++) {
    const [x1, d1] = points[i]
    if (x <= x1) {
      const [x0, d0] = points[i - 1]
      return d0 + ((x - x0) / (x1 - x0)) * (d1 - d0)
    }
  }
  return points[points.length - 1][1]
}

/** dB of a fader position: -Infinity at the very bottom. */
export function faderDb(v: number): number {
  const x = Math.min(1, Math.max(0, v))
  if (x === 0) return -Infinity
  for (let i = 1; i < FADER_DB.length; i++) {
    const [x1, d1] = FADER_DB[i]
    if (x <= x1) {
      const [x0, d0] = FADER_DB[i - 1]
      return d0 + ((x - x0) / (x1 - x0)) * (d1 - d0)
    }
  }
  return FADER_DB[FADER_DB.length - 1][1]
}

/** The position of a dB value on the fader scale (0 for -Infinity or anything under the scale). */
export function faderPosition(db: number): number {
  if (!(db > FADER_DB[0][1])) return 0
  for (let i = 1; i < FADER_DB.length; i++) {
    const [x1, d1] = FADER_DB[i]
    if (db <= d1) {
      const [x0, d0] = FADER_DB[i - 1]
      return x0 + ((db - d0) / (d1 - d0)) * (x1 - x0)
    }
  }
  return 1
}

/** The text a control shows while it is held: « -6.0 dB », « −∞ », « 120 Hz », « ON ». */
export function valueText(def: ControlDef, v: number): string {
  if (def.kind === 'button') return v >= 0.5 ? 'ON' : 'OFF'
  if (def.kind === 'switch') return `${Math.round(v) + 1} / ${def.positions ?? 2}`
  if (def.taper === 'fader-db' || def.taper === 'broadcast-db') {
    const db = def.taper === 'broadcast-db' ? interpolate(BROADCAST_DB, v) : faderDb(v)
    return db === -Infinity || db <= -90 ? '−∞ dB' : `${db > 0 ? '+' : db < 0 ? '−' : ''}${Math.abs(db).toFixed(1)} dB`
  }
  if (def.range) {
    const x = def.range.min + v * (def.range.max - def.range.min)
    const sign = x > 0 && def.range.min < 0 ? '+' : x < 0 ? '−' : ''
    return `${sign}${Math.abs(x) >= 100 ? Math.abs(x).toFixed(0) : Math.abs(x).toFixed(1)} ${def.range.unit}`
  }
  return `${Math.round(v * 100)} %`
}
