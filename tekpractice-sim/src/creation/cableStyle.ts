/**
 * Cable style by signal type (Task 27, C18). Keyed by the catalog's `signalTypes[].id` (content/catalog.json is the
 * source of truth: a new signal type is a new row here, and `tests/creation/cableStyle.test.ts` fails until it has one).
 *
 * - Colours (mission 3 fixes, item 2) are the shared cable palette's (src/design/cablePalette.ts): one colour per cable type, the
 *   2D colour and symbol sheet's. Each reads at >= 3:1 on Nuit (WCAG 1.4.11) and stays >= 60 from Papier (the hover and selected
 *   stroke) and Ambre (the selection); the sheet's weak pairs on the 3D side (its brown on the panel, colour-blind pairs) are pinned
 *   in tests/creation/cableStyle.test.ts and reported, not fixed here.
 * - Cues other than colour: every legend entry carries the French name of the signal next to its stroke sample, and the hover
 *   text names it. Since mission 3 (cable cues) every cable also has the LINE PATTERN of its cable type (src/design/cablePattern.ts,
 *   the 2D sheet's table): solid, thick, dashes, beads, dash-dot, long dashes, short dashes, collars for mains; the legend swatch
 *   draws the same pattern. Before it only `mains-power` was dashed (Task 27, reachable with verified gear since Task 32).
 * - The label of an entry is the French name already in `COPY.signal` (strings live in copy.ts only).
 *
 * Pure data and pure functions: no Babylon, no DOM. The shell never imports the engine; the scene host and the shell
 * both read this module.
 */
import type { PortRef } from '../engine/types'
import { SIGNAL_CABLE_TYPE, signalColour, type CableType } from '../design/cablePalette'
import { cue3dOf, type Cue3d } from '../design/cablePattern'
import { COPY } from './copy'

export interface SignalStyle {
  /** '#RRGGBB'. */
  color: string
  /** The French name (COPY.signal). */
  label: string
  /** The cable type of the signal (the shared table): its line pattern is the second cue next to the colour (mission 3, cable cues). */
  type: CableType
}

const label = (id: string): string => COPY.signal?.[id] ?? id

/**
 * In the catalog's order: analog, digital, control, power (the legend reads in that order).
 *
 * Mission 3 fixes, item 2: the colour is no longer a per-signal colour of the 3D view's own (Task 27's 19 searched colours, tools/cable-palette-search.mjs):
 * it is the colour of the signal's CABLE TYPE in the shared palette (src/design/cablePalette.ts, the 2D colour and symbol sheet), so a cable has the same
 * colour on the 2D page and in the 3D view, and the renderer, the hover tint (CableRenderer lightens this colour), the legend rows and the e2e checks all
 * read it from there. Signals of one family share a colour; the legend and the hover text name the signal.
 *
 * Mission 3, cable cues: the old « mains only is dashed » cue is replaced by the line pattern of the signal's cable type (src/design/cablePattern.ts, the 2D
 * sheet's own table), so EVERY cable carries a second cue and a cable has the same pattern on both pages; the legend swatch draws it.
 */
const ORDER: readonly string[] = [
  'mic-level',
  'line-level-pro',
  'line-level-consumer',
  'instrument-hiz',
  'speaker-level',
  'headphone-level',
  'aes3',
  'spdif',
  'madi',
  'aoip',
  'aes50',
  'wordclock',
  'usb-audio',
  'gpio-tally',
  'dmx512',
  'ethernet-control',
  'usb-control',
  'phantom-48v',
  'mains-power',
]

/** A signal the palette does not know (a catalog newer than this table): neutral, never one of the signal colours. */
export const FALLBACK_COLOR = '#A39B91'

export const SIGNAL_STYLE: Record<string, SignalStyle> = Object.fromEntries(
  ORDER.map((id) => [id, { color: signalColour(id) ?? FALLBACK_COLOR, label: label(id), type: SIGNAL_CABLE_TYPE[id] ?? 'analog-bal' }])
)

export function cableColor(signalId: string): string {
  return SIGNAL_STYLE[signalId]?.color ?? FALLBACK_COLOR
}

/** The cable type of a signal, or null for a signal the table does not know (it is then drawn as a plain tube, its neutral colour being the cue). */
export function cableTypeOfSignal(signalId: string): CableType | null {
  return SIGNAL_STYLE[signalId]?.type ?? null
}

/** How a cable carrying this signal is drawn in 3D (pattern, thickness, collars), or null for an unknown signal. */
export function cableCue(signalId: string): Cue3d | null {
  const t = cableTypeOfSignal(signalId)
  return t ? cue3dOf(t) : null
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
  /** The cable type whose pattern the swatch draws; null for a signal the table does not know (a plain stroke). */
  type: CableType | null
}

export function legendEntries(ids: readonly string[]): LegendEntry[] {
  return ids.map((id) => ({ id, label: signalLabel(id), color: cableColor(id), type: cableTypeOfSignal(id) }))
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
