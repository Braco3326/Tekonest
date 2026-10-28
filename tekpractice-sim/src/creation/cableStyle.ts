/**
 * Cable style by signal type (Task 27, C18). Keyed by the catalog's `signalTypes[].id` (content/catalog.json is the
 * source of truth: a new signal type is a new row here, and `tests/creation/cableStyle.test.ts` fails until it has one).
 *
 * - Colours are distinct pairwise (simple RGB distance >= 60), stay >= 30 apart under simulated protanopia, deuteranopia
 *   and tritanopia, and each reads at >= 3:1 on Nuit and on the panel (WCAG 1.4.11), all tested. They are kept >= 60 from
 *   Papier (the hover outline) and Ambre (the selection).
 * - Cues other than colour, honestly: every legend entry carries the French name of the signal next to its stroke sample,
 *   and the hover text names it. `mains-power` is also DASHED, BUT THAT CUE IS REACHABLE ONLY THROUGH BÊTA DEVICES until
 *   Task 32: no CATALOG device sources mains (every catalog `mains-power` port is `power-in`), but the Bêta proposals
 *   `shure-axient-digital-ad4d` and `shure-ua845uwb` declare `mains-power` OUT ports, so since Task 30 a mains cable can be
 *   drawn between one of them and a power-in port. Task 32 adds a mains source to the catalog (`multiprise-secteur`). The dash
 *   code is unit-tested; do not count it as a delivered non-colour cue for verified gear. The other families rely on colour
 *   that is colour-blind separable (above) plus the legend and hover names (docs/CREATIVE-MODE-LOG.md L17, corrected by L23).
 * - The label of an entry is the French name already in `COPY.signal` (strings live in copy.ts only).
 *
 * Pure data and pure functions: no Babylon, no DOM. The shell never imports the engine; the scene host and the shell
 * both read this module.
 */
import type { PortRef } from '../engine/types'
import { COPY } from './copy'

export interface SignalStyle {
  /** '#RRGGBB'. */
  color: string
  /** The French name (COPY.signal). */
  label: string
  /** Drawn dashed (a second cue next to the colour). */
  dash?: boolean
}

const label = (id: string): string => COPY.signal?.[id] ?? id

/**
 * In the catalog's order: analog, digital, control, power.
 *
 * The 16 colours were FOUND, not picked: `node tools/cable-palette-search.mjs` (seed 27, 12 restarts of a seeded hill
 * climb) maximises the worst pairwise distance as seen through simulated protanopia, deuteranopia and tritanopia
 * (Machado 2009, severity 1.0) under these constraints: normal-vision distance >= 70, contrast >= 3:1 against Nuit AND the
 * panel colour, luminance <= 0.7, >= 60 from Papier and Ambre. Result: worst colour-blind pair 60.5 (test floor 30),
 * worst normal-vision pair 72.6 (floor 60), contrast >= 3.49 on Nuit and >= 3.23 on the panel. The script's output was
 * then assigned to the signals by family; the assignment is free, the set is what the tests hold.
 */
const COLORS: ReadonlyArray<readonly [id: string, color: string, dash?: true]> = [
  ['mic-level', '#E9DC7D'],
  ['line-level-pro', '#80BCFE'],
  ['line-level-consumer', '#376ED3'],
  ['instrument-hiz', '#BBB400'],
  ['speaker-level', '#F38AC9'],
  ['headphone-level', '#E70CFB'],
  ['aes3', '#28F1F3'],
  ['spdif', '#8EEDB7'],
  ['madi', '#03BD89'],
  ['aoip', '#B4EA30'],
  ['wordclock', '#9F71A9'],
  ['usb-audio', '#618569'],
  ['gpio-tally', '#7CC953'],
  ['dmx512', '#B616C4'],
  ['phantom-48v', '#2D7B01'],
  ['mains-power', '#F8093E', true],
]

export const SIGNAL_STYLE: Record<string, SignalStyle> = Object.fromEntries(
  COLORS.map(([id, color, dash]) => [id, { color, label: label(id), ...(dash ? { dash: true } : {}) }])
)

/** A signal the palette does not know (a catalog newer than this table): neutral, never one of the signal colours. */
export const FALLBACK_COLOR = '#A39B91'

export function cableColor(signalId: string): string {
  return SIGNAL_STYLE[signalId]?.color ?? FALLBACK_COLOR
}

export function cableDash(signalId: string): boolean {
  return SIGNAL_STYLE[signalId]?.dash === true
}

/** The French name of a signal for the hover text and the legend. */
export function signalLabel(signalId: string): string {
  return SIGNAL_STYLE[signalId]?.label ?? signalId
}

export interface PortInfo {
  dir: 'in' | 'out' | 'bidir'
  signal: string
}

/**
 * The signal a connection carries: the one leaving its output port (whichever end is `a`); two bidirectional ports
 * (or two inputs, refused elsewhere) read from `a`. An unknown end falls back to the known one; null when neither is known.
 */
export function connectionSignal(portOf: (ref: PortRef) => PortInfo | undefined, a: PortRef, b: PortRef): string | null {
  const [pa, pb] = [portOf(a), portOf(b)]
  if (pa?.dir === 'out') return pa.signal
  if (pb?.dir === 'out') return pb.signal
  return (pa ?? pb)?.signal ?? null
}

/** The signals on the scene, once each: the palette's order (the catalog's), then any the palette does not know. Nulls ignored. */
export function presentSignals(signals: Iterable<string | null>): string[] {
  const seen = new Set<string>()
  for (const s of signals) if (s) seen.add(s)
  const known = Object.keys(SIGNAL_STYLE).filter((id) => seen.has(id))
  return [...known, ...[...seen].filter((id) => !(id in SIGNAL_STYLE))]
}

export interface LegendEntry {
  id: string
  label: string
  color: string
  dash: boolean
}

export function legendEntries(ids: readonly string[]): LegendEntry[] {
  return ids.map((id) => ({ id, label: signalLabel(id), color: cableColor(id), dash: cableDash(id) }))
}

/** The direction and signal of any port of a design (`instances` = the rig's), through the catalog. Undefined when unknown. */
export function portInfoOf(
  registry: { deviceById: ReadonlyMap<string, { ports: ReadonlyArray<{ portId: string; dir: 'in' | 'out' | 'bidir'; signal: string }> }> },
  instances: ReadonlyArray<{ instanceId: string; deviceId: string }>
): (ref: PortRef) => PortInfo | undefined {
  return (ref) => {
    const deviceId = instances.find((i) => i.instanceId === ref.instance)?.deviceId
    const p = deviceId ? registry.deviceById.get(deviceId)?.ports.find((q) => q.portId === ref.port) : undefined
    return p ? { dir: p.dir, signal: p.signal } : undefined
  }
}

/** « 6,4 m »: metres with one decimal and the French comma. */
export function lengthText(metres: number): string {
  return COPY.cables!.length!.replace('{n}', metres.toFixed(1).replace('.', ','))
}

/**
 * The hover text of a cable: « ql1 out-main-l → k12-g in-line-a · Niveau ligne pro (+4 dBu) · 6,4 m ». The output end comes
 * first whichever way the connection is stored; the length (the drawn cable's, metres) ends it when given. Null when neither
 * port is known (the cable is not in the design).
 */
export function cableText(portOf: (ref: PortRef) => PortInfo | undefined, a: PortRef, b: PortRef, lengthM?: number | null): string | null {
  const signal = connectionSignal(portOf, a, b)
  if (signal === null) return null
  const [from, to] = portOf(a)?.dir !== 'out' && portOf(b)?.dir === 'out' ? [b, a] : [a, b]
  const end = (r: PortRef): string => `${r.instance} ${r.port}`
  const known = typeof lengthM === 'number' && Number.isFinite(lengthM)
  return (known ? COPY.cables!.hoverLength! : COPY.cables!.hover!)
    .replace('{a}', end(from))
    .replace('{b}', end(to))
    .replace('{signal}', signalLabel(signal))
    .replace('{length}', known ? lengthText(lengthM) : '')
}
