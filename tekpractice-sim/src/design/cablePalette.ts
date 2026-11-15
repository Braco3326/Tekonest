/**
 * ONE cable palette for the 2D schema page and the 3D view (mission 3 fixes, item 2; review finding C: the mic cable was yellow in 3D, blue in 2D).
 * The colour of each cable type is the table (a) value of « 2D schema - colour and symbol sheet » (2026-11-15). Pure data: no import, no DOM, no Babylon.
 * Read by src/plan2d/cableStyle2d.ts (the 2D styles: colour + line pattern + tag + glyph) and src/creation/cableStyle.ts (the 3D cable colour, its legend
 * row and its hover tint): change a colour HERE and both pages change. The line pattern is a 2D concern and stays in cableStyle2d.ts; the 3D tube, its glow
 * and its mains dash stay in the 3D renderer.
 *
 * Honesty (the sheet's own tags): the meaning of each hue is OUR PROPOSAL (no audio signal-colour standard was found); mains brown nods to the harmonised
 * live-conductor colour (a standard for conductor cores, not for drawings). Each colour is >= 3:1 on Nuit and on Papier (the sheet's computation, recomputed
 * in tests/plan2d/cableStyle2d.test.ts). Weak pairs found on the 3D side (the panel, the dark room floor, colour-blind pairs) are pinned in
 * tests/creation/cableStyle.test.ts and reported, never fixed by changing a value here.
 */
export type CableType = 'analog-bal' | 'analog-unbal' | 'speaker' | 'digital' | 'network' | 'clock' | 'control' | 'mains' | 'dc'

/** Cable type -> '#RRGGBB', the sheet's values. Balanced / unbalanced, clock / control and mains / DC share a colour (the sheet's families). */
export const CABLE_TYPE_COLOUR: Readonly<Record<CableType, string>> = {
  'analog-bal': '#2B7BC2',
  'analog-unbal': '#2B7BC2',
  speaker: '#D55E00',
  digital: '#B5659A',
  network: '#00946A',
  clock: '#737A87',
  control: '#737A87',
  mains: '#8A5A2B',
  dc: '#8A5A2B',
}

/**
 * Every signal type of content/catalog.json, explicitly (tests/design/cablePalette.test.ts fails on a new one). `ethernet-control` goes with the network row
 * (an RJ45 / etherCON link, the sheet's « network » connector), `usb-audio` with control / data (the sheet puts USB there), `phantom-48v` with DC. The 2D page
 * refines analogue to unbalanced and mains to DC by the connector (cableStyle2d.ts `portCableType`); those pairs share a colour, so the colour of a cable is
 * the colour of its signal's row.
 */
export const SIGNAL_CABLE_TYPE: Readonly<Record<string, CableType>> = {
  'mic-level': 'analog-bal',
  'line-level-pro': 'analog-bal',
  'line-level-consumer': 'analog-unbal',
  'instrument-hiz': 'analog-unbal',
  'speaker-level': 'speaker',
  'headphone-level': 'analog-unbal',
  aes3: 'digital',
  spdif: 'digital',
  madi: 'digital',
  aoip: 'network',
  aes50: 'network',
  wordclock: 'clock',
  'usb-audio': 'control',
  'gpio-tally': 'control',
  dmx512: 'control',
  'ethernet-control': 'network',
  'usb-control': 'control',
  'phantom-48v': 'dc',
  'mains-power': 'mains',
}

/** The colour of a signal's cable type, or null for a signal the sheet does not place (a catalogue newer than this table). */
export function signalColour(signal: string): string | null {
  const t = Object.prototype.hasOwnProperty.call(SIGNAL_CABLE_TYPE, signal) ? SIGNAL_CABLE_TYPE[signal] : undefined
  return t ? CABLE_TYPE_COLOUR[t] : null
}
