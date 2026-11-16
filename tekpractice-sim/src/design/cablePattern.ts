/**
 * ONE line pattern per cable type for the 2D schema page and the 3D view (mission 3, cable cues): colour is never the only cue (WCAG 1.4.1).
 * The 2D values are table (a) of « 2D schema - colour and symbol sheet » (2026-11-15): stroke dash (SVG px), stroke width (px) and the glyph the sheet
 * repeats along the line (mains: a lightning every ~80 px). Pure data and pure functions: no import but a type, no DOM, no Babylon.
 * Read by src/plan2d/cableStyle2d.ts (the 2D stroke), src/creation/cableStyle.ts (the 3D cue of a signal, its legend swatch) and the 3D renderer through
 * `cue3dOf` / `cueLayout` (pieces along the path). Change a pattern HERE and both pages change. The colours are src/design/cablePalette.ts's, never here.
 *
 * Honesty (the sheet's own tag): the line styles are OUR PROPOSAL (no signal-flow line-style convention was found). The 3D realisation is ours too:
 * 1 px of the sheet = 1 cm along a 3D cable (`LINE_PX_M`), a dot is a small bead, the mains glyph is a raised collar (a lightning bolt does not survive
 * as a tube at the camera's distance). Balanced / unbalanced analogue are both solid on the sheet (2 px vs 1.5 px plus a text tag): in 3D they differ
 * only by the tube's thickness, as on the sheet. Speaker and mains are both thick solid lines on the sheet; the mains collar keeps them apart.
 */
import type { CableType } from './cablePalette'

/** The sheet's glyph repeated along the line (only mains has one). */
export type LineMark = 'none' | 'lightning'

export interface CableLine {
  /** SVG stroke-dasharray in px ('' = solid). Round caps turn '0 6' into dots. */
  dash: string
  /** Stroke width in px. */
  width: number
  mark: LineMark
}

/** Cable type -> the sheet's line (table (a), column « Line style (trait) »). */
export const CABLE_LINE: Readonly<Record<CableType, CableLine>> = {
  'analog-bal': { dash: '', width: 2, mark: 'none' },
  'analog-unbal': { dash: '', width: 1.5, mark: 'none' },
  speaker: { dash: '', width: 4, mark: 'none' },
  digital: { dash: '8 4', width: 2.5, mark: 'none' },
  network: { dash: '0 6', width: 3, mark: 'none' },
  clock: { dash: '8 3 2 3', width: 1.5, mark: 'none' },
  control: { dash: '10 4', width: 1.5, mark: 'none' },
  mains: { dash: '', width: 4.5, mark: 'lightning' },
  dc: { dash: '3 3', width: 2, mark: 'none' },
}

/** 1 px of the sheet's dash = this many metres along a 3D cable (the earlier 3D mains dash had a 10 cm period: same order). */
export const LINE_PX_M = 0.01
/** The 3D tube radius of the sheet's 2 px line (the renderer's committed cable radius, 12 mm). */
export const LINE_BASE_RADIUS_M = 0.012
/** A dot is a bead this much wider than its tube (so it reads as a dot, not a short dash). */
export const DOT_SCALE = 1.3
/** The mains collar (the sheet's lightning glyph in 3D): this much wider than the tube, this long, one every this many metres. */
export const MARK_SCALE = 1.7
export const MARK_LENGTH_M = 0.045
export const MARK_EVERY_M = 0.25
/** At most this many pieces (dashes, dots or collars) per cable: a long run gets a longer period, never more pieces. */
export const PIECE_MAX = 64
/** At least this many periods per cable, so even a short cable shows its pattern. */
export const PERIOD_MIN = 3

/** How a cable type is drawn in 3D: derived from `CABLE_LINE` only. */
export interface Cue3d {
  type: CableType
  /** The tube radius (m): the sheet's width, square-rooted around the 12 mm of its 2 px line so a thick line does not swamp the room. */
  radiusM: number
  /** null = a solid tube. Else on / off lengths (m), alternating, starting with « on »; an « on » of 0 is a dot (a bead). */
  runs: readonly number[] | null
  /** A collar every this many metres along a solid tube (the sheet's glyph), null = none. */
  markEveryM: number | null
}

export function cue3dOf(type: CableType): Cue3d {
  const line = CABLE_LINE[type]
  const runs = line.dash ? line.dash.trim().split(/\s+/).map((n) => Number(n) * LINE_PX_M) : null
  return {
    type,
    radiusM: LINE_BASE_RADIUS_M * Math.sqrt(line.width / 2),
    runs,
    markEveryM: line.mark === 'lightning' ? MARK_EVERY_M : null,
  }
}

/** One piece along a cable, as fractions of its length: a dash [t0, t1], a dot (t0 = t1) or a collar. */
export interface CuePiece {
  t0: number
  t1: number
  kind: 'dash' | 'dot' | 'mark'
}

/**
 * Where the pieces of a cue go along a cable of `lengthM`: the pattern repeated a whole number of times (at least `PERIOD_MIN`), stretched to fit, and
 * never more than `cap` pieces (a long run gets a longer period). A solid cue has no piece but its collars; a solid cue without collars has none at all.
 */
export function cueLayout(cue: Cue3d, lengthM: number, cap = PIECE_MAX): CuePiece[] {
  const out: CuePiece[] = []
  if (!(lengthM > 0)) return out
  if (!cue.runs) {
    if (cue.markEveryM === null) return out
    const n = Math.max(1, Math.min(cap, Math.floor(lengthM / cue.markEveryM)))
    const half = Math.min(MARK_LENGTH_M / lengthM, 0.5 / n) / 2
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      out.push({ t0: t - half, t1: t + half, kind: 'mark' })
    }
    return out
  }
  const runs = cue.runs
  const period = runs.reduce((s, r) => s + r, 0)
  const perPeriod = runs.filter((_, i) => i % 2 === 0).length
  const n = Math.max(1, Math.min(Math.max(PERIOD_MIN, Math.round(lengthM / period)), Math.floor(cap / perPeriod)))
  const stretch = lengthM / (n * period)
  // Centre the pattern: the first dash starts half a trailing gap in.
  const lead = ((runs.length % 2 === 0 ? runs[runs.length - 1]! : 0) * stretch) / 2
  for (let k = 0; k < n; k++) {
    let at = k * period * stretch + lead
    for (let j = 0; j < runs.length; j++) {
      const len = runs[j]! * stretch
      if (j % 2 === 0) out.push({ t0: at / lengthM, t1: Math.min(1, (at + len) / lengthM), kind: len === 0 ? 'dot' : 'dash' })
      at += len
    }
  }
  return out
}

/** The legend swatch of a cue (SVG, user units of a 36 x 8 sample): the sheet's own dash and width, the mains collars as two ticks. */
export interface CueSwatch {
  dasharray: string | null
  strokeWidth: number
  linecap: 'butt' | 'round'
  /** x positions of the collar ticks (mains), empty otherwise. */
  ticks: number[]
}

export function cueSwatch(type: CableType): CueSwatch {
  const line = CABLE_LINE[type]
  return {
    dasharray: line.dash || null,
    // the sheet's 1.5 to 4.5 px, kept inside the 8-unit-high sample
    strokeWidth: Math.min(5, line.width + 0.5),
    linecap: line.dash.startsWith('0 ') ? 'round' : 'butt',
    ticks: line.mark === 'lightning' ? [12, 24] : [],
  }
}
