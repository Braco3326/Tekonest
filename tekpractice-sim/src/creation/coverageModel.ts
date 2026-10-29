/**
 * What the coverage block says (Task 37): pure view-model functions, no DOM, no Babylon, no store (the unit tests have no DOM). The controller
 * (`coverageLayer.ts`) feeds them the numbers of a worker reply and the sources of the signal path; `shell/coveragePanel.ts` draws the result.
 * Every sentence comes from COPY.coverage; every number printed here is real text (the screen-reader equivalent of the dots).
 */
import type { RoomLayout } from '../explore/roomLayout'
import type { PathResult } from '../flow/signalPath'
import { listenerGrid } from '../acoustics/grid'
import { SCALE_STEPS_DB, scaleBin } from '../acoustics/scale'
import { COPY } from './copy'
import { COVERAGE_PALETTE } from './coveragePalette'
import { provenanceOf, type ExclusionReason, type UsedSpeaker } from './coverageSources'

const C = (): Readonly<Record<string, string>> => COPY.coverage!

/** A French decimal with one digit and a true minus sign (U+2212); never « −0,0 ». */
export function formatNumber(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return '–'
  const s = Math.abs(v) < 0.5 * 10 ** -digits ? (0).toFixed(digits) : v.toFixed(digits)
  return s.replace('-', '−').replace('.', ',')
}
export const formatDb = (v: number): string => C().dbValue!.replace('{v}', formatNumber(v))
const fill = (t: string, vars: Record<string, string | number>): string => t.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`))

// ── the listener grid ───────────────────────────────────────────────────────

type Zone = RoomLayout['zones'][number]
/**
 * The zones the dots cover, in WORLD coordinates (RoomBuilder draws the zones from the same numbers, so a dot lands on the floor mark drawn
 * there): every `audience` zone first, then every `foh` zone, so where they overlap (the « régie » inside the pit) the audience lattice wins.
 * A room without an audience or foh zone (studios, booths: 16 of the 32 shipped rooms) gives none: the grid is empty.
 */
export function listenerZones(layout: RoomLayout | null): Zone[] {
  if (!layout) return []
  return [...layout.zones.filter((z) => z.kind === 'audience'), ...layout.zones.filter((z) => z.kind === 'foh')]
}

/** The grid for a place at an ear height (1.2 m seated / 1.7 m standing): ≤ 20 000 points, 0.5 m, then 1 m, then 2 m. */
export function coverageGrid(layout: RoomLayout | null, earHeight: number): { points: Float32Array; stepM: 0.5 | 1 | 2 } {
  return listenerGrid(listenerZones(layout), earHeight)
}

// ── legend, statistics, counts ──────────────────────────────────────────────

export interface LegendRow {
  bin: number
  color: string
  /** « 0 à −3 dB », last row « −21 dB et moins ». */
  label: string
  /** Points in the bin, or null before a result. */
  count: number | null
  countLabel: string | null
}

/** The 8 legend rows (0 → −24 dB in 3 dB steps), with the count of dots per bin when `counts` is given. */
export function legendRows(counts: readonly number[] | null): LegendRow[] {
  return COVERAGE_PALETTE.map((color, bin) => {
    const from = SCALE_STEPS_DB[bin]
    const to = SCALE_STEPS_DB[bin + 1]
    const num = (n: number): string => (n === 0 ? '0' : String(n).replace('-', '−'))
    const label = bin === COVERAGE_PALETTE.length - 1 ? fill(C().legendLast!, { from: num(from) }) : fill(C().legendBin!, { from: num(from), to: num(to) })
    const count = counts ? counts[bin] ?? 0 : null
    return { bin, color, label, count, countLabel: count === null ? null : fill(C().legendCount!, { n: count }) }
  })
}

/** Dots per bin (8 numbers), silent points counted in the last bin as `scaleBin` does, and how many are flagged as overlap. */
export function binCounts(relDb: Float32Array, overlap: Uint8Array): { counts: number[]; hatched: number } {
  const counts = new Array<number>(COVERAGE_PALETTE.length).fill(0)
  let hatched = 0
  for (let i = 0; i < relDb.length; i++) {
    counts[scaleBin(relDb[i])]++
    if (overlap[i] === 1) hatched++
  }
  return { counts, hatched }
}

export interface StatRow {
  key: 'min' | 'max' | 'mean' | 'sd' | 'count' | 'step'
  label: string
  value: string
}
export function statRows(s: { min: number; max: number; mean: number; sd: number; count: number }, stepM: number): StatRow[] {
  const L = C()
  return [
    { key: 'min', label: L.statMin!, value: formatDb(s.min) },
    { key: 'max', label: L.statMax!, value: formatDb(s.max) },
    { key: 'mean', label: L.statMean!, value: formatDb(s.mean) },
    { key: 'sd', label: L.statSd!, value: formatDb(s.sd) },
    { key: 'count', label: L.statCount!, value: String(s.count) },
    { key: 'step', label: L.statStep!, value: fill(L.mValue!, { v: formatNumber(stepM, stepM % 1 === 0 ? 0 : 1) }) },
  ]
}

// ── sources and reasons ─────────────────────────────────────────────────────

/** « Couverture : données KB (V déduit) / valeur nominale »: only the kinds of the angles of the speakers that count. Null with no speaker. */
export function sourceLine(used: readonly UsedSpeaker[]): string | null {
  const L = C()
  if (!used.length) return null
  const { kinds, vDeduced } = provenanceOf(used)
  const name: Record<string, string> = { kb: L.sourceKb!, nominal: L.sourceNominal!, datasheet: L.sourceDatasheet! }
  const parts = kinds.map((k) => (k === 'kb' && vDeduced ? `${name.kb} (${L.sourceDeduced})` : name[k]))
  return fill(L.sourceLine!, { sources: parts.join(' / ') })
}

export const speakerLines = (used: readonly UsedSpeaker[]): string[] =>
  used.map((u) => fill(C().speakerRow!, { name: u.instanceId, h: formatNumber(u.hDeg, 0), v: formatNumber(u.vDeg, 0) }))

const REASON_KEY: Record<ExclusionReason, string> = {
  muted: 'reasonMuted',
  silent: 'reasonSilent',
  unverified: 'reasonUnverified',
  'no-acoustic': 'reasonNoAcoustic',
  unpowered: 'reasonUnpowered',
  'no-placement': 'reasonOther',
  'bad-coverage': 'reasonOther',
}

/**
 * Why nothing can be heard, as one sentence: « Aucune enceinte audible : la console est en mute ». With no speaker fed at all the first reason
 * of the playback path is quoted (« La lecture console est coupée. »); with speakers fed and all left out, the distinct reasons they were
 * left out for.
 */
export function noSourceMessage(path: PathResult, excluded: readonly { instanceId: string; reason: ExclusionReason }[]): string {
  const L = C()
  let reason: string
  if (excluded.length === 0) {
    const why = path.reasons[0]?.text_fr.replace(/\.$/, '')
    reason = why ? fill(L.reasonNotFed!, { why: why.charAt(0).toLowerCase() + why.slice(1) }) : L.reasonNotFedBare!
  } else {
    const texts: string[] = []
    for (const e of excluded) {
      const t = L[REASON_KEY[e.reason]]!
      if (!texts.includes(t)) texts.push(t)
    }
    reason = texts.join(L.reasonsJoin!)
  }
  return fill(L.noSource!, { reason }) + '.'
}

export function doneMessage(s: { min: number; max: number; count: number }, stepM: number): string {
  return fill(C().announceDone!, { n: s.count, min: formatNumber(s.min), max: formatNumber(s.max), step: formatNumber(stepM, stepM % 1 === 0 ? 0 : 1) })
}

// ── the view the panel draws ────────────────────────────────────────────────

export type CoverageStatus = 'off' | 'computing' | 'ready' | 'no-audience' | 'no-source' | 'error'

export interface PointRow {
  id: string
  /** Visible text: « Régie : −2,1 dB ». */
  text: string
  /** The name only (button label « Épingler Régie »). */
  name: string
  /** A named point can be pinned (the pinned row itself cannot). */
  pinnable: boolean
}

export interface CoverageView {
  on: boolean
  status: CoverageStatus
  /** The one sentence for the state (the panel's status line; the shell announces it once per result). */
  message: string
  /** Legend rows with counts (only with a result); always the 8 rows. */
  legend: LegendRow[]
  hatchedCount: number | null
  stats: StatRow[] | null
  speakers: string[]
  sourceLine: string | null
  points: PointRow[]
  pinned: { text: string } | null
  /** The « ≈ dB SPL estimé » line exists (S2): only when every contributing speaker has a sourced sensitivity and max SPL. */
  spl: boolean
}

export const EMPTY_VIEW: CoverageView = {
  on: false,
  status: 'off',
  message: '',
  legend: legendRows(null),
  hatchedCount: null,
  stats: null,
  speakers: [],
  sourceLine: null,
  points: [],
  pinned: null,
  spl: false,
}

/** « Régie : −2,1 dB », or « Régie : aucun son ». */
export function pointText(name: string, rel: number): string {
  const L = C()
  return fill(L.pointRow!, { name, value: Number.isFinite(rel) ? formatDb(rel) : L.pointSilent! })
}
export function pinnedText(x: number, z: number, rel: number): string {
  const L = C()
  return fill(L.pinned!, { x: formatNumber(x), z: formatNumber(z), value: Number.isFinite(rel) ? formatDb(rel) : L.pointSilent! })
}
