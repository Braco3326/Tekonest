/**
 * Cable types of the 2D schema page (mission 2): the table (a) of « 2D schema - colour and symbol sheet » (2026-11-15) as data, and the derivation of a
 * cable's type from its two ports (connector, signal, flags). Pure. The COLOURS are not here: they are the shared cable palette (src/design/cablePalette.ts,
 * mission 3 fixes item 2), read by the 3D cables too, so a cable has one colour on both pages. The line pattern and width are the shared pattern table's (src/design/cablePattern.ts,
 * mission 3 cable cues), read by the 3D view too, so a cable has one pattern on both pages; the tag and glyph are the 2D page's own.
 *
 * Honesty (the sheet's own tags): the meaning of each hue is OUR PROPOSAL (no audio signal-colour standard was found); the line styles are OUR PROPOSAL too
 * (no signal-flow line-style convention was found); mains brown nods to the harmonised live-conductor colour (a standard for conductor cores, not for drawings).
 * Colour is never the only cue (WCAG 1.4.1): each type has its own line pattern, a text tag on the line and a glyph; the legend repeats the pattern.
 * The colours were computed by the sheet's author for >= 3:1 on Nuit and on Papier (WCAG 1.4.11); tests/plan2d/cableStyle2d.test.ts recomputes it.
 * Two rows of the sheet are not drawn in stage 1 because no port yields them: the multicore (a bundle, a device of its own in the catalogue) and the patch-bay
 * link (drawn in the colour of the signal it carries, normalling marker in a later item).
 */
import { CABLE_TYPE_COLOUR as C, SIGNAL_CABLE_TYPE, type CableType } from '../design/cablePalette'
import { CABLE_LINE as L } from '../design/cablePattern'

export type { CableType }
export type LineGlyph = 'arrow' | 'double-arrow' | 'clock' | 'lightning'

export interface CableStyle2d {
  type: CableType
  /** '#RRGGBB', the sheet's value, read from the shared palette. */
  colour: string
  /** SVG stroke-dasharray in px ('' = solid). Round caps turn '0 6' into dots. */
  dash: string
  /** Stroke width in px. */
  width: number
  /** The short text drawn on the line when the signal names no format. */
  tag: string
  glyph: LineGlyph
  /** The sheet's confidence tag for the meaning of this row. */
  confidence: 'OUR PROPOSAL'
}

/** Dash and width come from the shared pattern table (src/design/cablePattern.ts, mission 3 cable cues), which the 3D view reads too. */
const line = (t: CableType) => ({ dash: L[t].dash, width: L[t].width })

export const CABLE_STYLES: readonly CableStyle2d[] = [
  { type: 'analog-bal', colour: C['analog-bal'], ...line('analog-bal'), tag: 'sym.', glyph: 'arrow', confidence: 'OUR PROPOSAL' },
  { type: 'analog-unbal', colour: C['analog-unbal'], ...line('analog-unbal'), tag: 'asym.', glyph: 'arrow', confidence: 'OUR PROPOSAL' },
  { type: 'speaker', colour: C.speaker, ...line('speaker'), tag: 'HP', glyph: 'arrow', confidence: 'OUR PROPOSAL' },
  { type: 'digital', colour: C.digital, ...line('digital'), tag: 'num.', glyph: 'arrow', confidence: 'OUR PROPOSAL' },
  { type: 'network', colour: C.network, ...line('network'), tag: 'réseau', glyph: 'double-arrow', confidence: 'OUR PROPOSAL' },
  { type: 'clock', colour: C.clock, ...line('clock'), tag: 'horloge', glyph: 'clock', confidence: 'OUR PROPOSAL' },
  { type: 'control', colour: C.control, ...line('control'), tag: 'ctrl', glyph: 'arrow', confidence: 'OUR PROPOSAL' },
  { type: 'mains', colour: C.mains, ...line('mains'), tag: 'secteur', glyph: 'lightning', confidence: 'OUR PROPOSAL' },
  { type: 'dc', colour: C.dc, ...line('dc'), tag: 'DC', glyph: 'arrow', confidence: 'OUR PROPOSAL' },
]
export const CABLE_TYPES: readonly CableType[] = CABLE_STYLES.map((s) => s.type)

export const styleOf = (t: CableType): CableStyle2d => CABLE_STYLES.find((s) => s.type === t) ?? CABLE_STYLES[0]!

/** Every signal type of content/catalog.json -> its cable type: the shared table (src/design/cablePalette.ts), re-exported for the page's own callers. */
export { SIGNAL_CABLE_TYPE }

/** Connectors that carry an analogue line unbalanced (the sheet: 6.35 mm TS, RCA, 3.5 mm). */
const UNBALANCED_CONNECTORS = new Set(['ts-quarter', 'rca', 'trs-35mm'])

/** The format a signal names, shown as the line's tag (the sheet: « AES3 », « MADI »). */
const SIGNAL_TAG: Readonly<Record<string, string>> = {
  aes3: 'AES3',
  spdif: 'S/PDIF',
  madi: 'MADI',
  aoip: 'AoIP',
  aes50: 'AES50',
  'ethernet-control': 'Ethernet',
  wordclock: 'WCLK',
  'usb-audio': 'USB',
  'usb-control': 'USB',
  'gpio-tally': 'GPIO',
  dmx512: 'DMX',
}

export interface PortLike {
  signal: string
  connector: string
  flags?: readonly string[]
}

/** The cable type one port asks for. */
export function portCableType(p: PortLike): CableType {
  const base = SIGNAL_CABLE_TYPE[p.signal] ?? 'analog-bal'
  if (base === 'analog-bal' && (UNBALANCED_CONNECTORS.has(p.connector) || p.flags?.includes('isUnbalanced'))) return 'analog-unbal'
  if (base === 'mains' && p.connector === 'dc-barrel') return 'dc'
  return base
}

/** When the two ends differ, the type higher in this order wins (the more demanding cable). */
const PRECEDENCE: readonly CableType[] = ['mains', 'speaker', 'dc', 'network', 'digital', 'clock', 'control', 'analog-unbal', 'analog-bal']

export function cableTypeOf(a: PortLike, b: PortLike): CableType {
  const ta = portCableType(a)
  const tb = portCableType(b)
  if (ta === tb) return ta
  return PRECEDENCE.find((t) => t === ta || t === tb) ?? ta
}

/** The tag on the line: the format the signal names, else the row's tag. */
export const tagOf = (t: CableType, signal: string): string => SIGNAL_TAG[signal] ?? styleOf(t).tag

/** Which way the arrow points: from the output to the input; network both ways (it is not directional); otherwise from end a to end b. */
export function arrowOf(t: CableType, dirA: string, dirB: string): 'to-a' | 'to-b' | 'both' {
  if (styleOf(t).glyph === 'double-arrow') return 'both'
  if (dirA === 'in' && dirB !== 'in') return 'to-a'
  return 'to-b'
}
