/**
 * Cable style by signal type (Task 27, C18). Keyed by the catalog's `signalTypes[].id` (content/catalog.json is the
 * source of truth: a new signal type is a new row here, and `tests/creation/cableStyle.test.ts` fails until it has one).
 *
 * - Colours (mission 3 fixes, item 2) are the shared cable palette's (src/design/cablePalette.ts): one colour per cable type, the
 *   2D colour and symbol sheet's. Each reads at >= 3:1 on Nuit (WCAG 1.4.11) and stays >= 60 from Papier (the hover and selected
 *   stroke) and Ambre (the selection); the sheet's weak pairs on the 3D side (its brown on the panel, colour-blind pairs) are pinned
 *   in tests/creation/cableStyle.test.ts and reported, not fixed here.
 * - Cues other than colour, honestly: every legend entry carries the French name of the signal next to its stroke sample,
 *   and the hover text names it. `mains-power` is also DASHED, and since Task 32 that cue
 *   is REACHABLE FOR VERIFIED GEAR: the catalog's generic `multiprise-secteur` (out `mains-power`, flag `isMainsSource`) feeds
 *   the reference rig through three mains cables, drawn dashed (a SceneHost test on the real template holds it). It was dormant
 *   before Task 32, then reachable only through Bêta proposals (`shure-axient-digital-ad4d` and `shure-ua845uwb` declare
 *   `mains-power` OUT ports without the flag; they still power nothing). The other families rely on colour that is
 *   colour-blind separable (above) plus the legend and hover names (docs/CREATIVE-MODE-LOG.md L17, L23, L25).
 * - The label of an entry is the French name already in `COPY.signal` (strings live in copy.ts only).
 *
 * Pure data and pure functions: no Babylon, no DOM. The shell never imports the engine; the scene host and the shell
 * both read this module.
 */
import type { PortRef } from '../engine/types'
import { signalColour } from '../design/cablePalette'
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
 * In the catalog's order: analog, digital, control, power (the legend reads in that order).
 *
 * Mission 3 fixes, item 2: the colour is no longer a per-signal colour of the 3D view's own (Task 27's 19 searched colours, tools/cable-palette-search.mjs):
 * it is the colour of the signal's CABLE TYPE in the shared palette (src/design/cablePalette.ts, the 2D colour and symbol sheet), so a cable has the same
 * colour on the 2D page and in the 3D view, and the renderer, the hover tint (CableRenderer lightens this colour), the legend rows and the e2e checks all
 * read it from there. Signals of one family share a colour; the legend and the hover text name the signal. Only the colour changed: mains stays dashed.
 */
const ORDER: ReadonlyArray<readonly [id: string, dash?: true]> = [
  ['mic-level'],
  ['line-level-pro'],
  ['line-level-consumer'],
  ['instrument-hiz'],
  ['speaker-level'],
  ['headphone-level'],
  ['aes3'],
  ['spdif'],
  ['madi'],
  ['aoip'],
  ['aes50'],
  ['wordclock'],
  ['usb-audio'],
  ['gpio-tally'],
  ['dmx512'],
  ['ethernet-control'],
  ['usb-control'],
  ['phantom-48v'],
  ['mains-power', true],
]

/** A signal the palette does not know (a catalog newer than this table): neutral, never one of the signal colours. */
export const FALLBACK_COLOR = '#A39B91'

export const SIGNAL_STYLE: Record<string, SignalStyle> = Object.fromEntries(
  ORDER.map(([id, dash]) => [id, { color: signalColour(id) ?? FALLBACK_COLOR, label: label(id), ...(dash ? { dash: true } : {}) }])
)

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
export function cableText(
  portOf: (ref: PortRef) => PortInfo | undefined,
  a: PortRef,
  b: PortRef,
  lengthM?: number | null,
  unverified = false
): string | null {
  const signal = connectionSignal(portOf, a, b)
  if (signal === null) return null
  const [from, to] = portOf(a)?.dir !== 'out' && portOf(b)?.dir === 'out' ? [b, a] : [a, b]
  const end = (r: PortRef): string => `${r.instance} ${r.port}`
  const known = typeof lengthM === 'number' && Number.isFinite(lengthM)
  const text = (known ? COPY.cables!.hoverLength! : COPY.cables!.hover!)
    .replace('{a}', end(from))
    .replace('{b}', end(to))
    .replace('{signal}', signalLabel(signal))
    .replace('{length}', known ? lengthText(lengthM) : '')
  // A cable on a Bêta device is as unverified as its device (night wave 1, item 1).
  return unverified ? `${text} · ${COPY.inventory!.badgeUnverified!}` : text
}
