/**
 * Port marker size from the connector (pure). A marker is a thin outline ring drawn AROUND the connector, so it must be
 * sized from the connector, not a fixed 50 mm: a fixed disc covered three XLRs on a 25 mm pitch (the Yamaha QL1 rear).
 *
 * `CONNECTOR_MM` is the size of the connector's face as seen on a panel (mm): the diameter of the opening for a round
 * connector, the SMALLER dimension of a non-round one plus a little margin (a ring is round, so it cannot follow a
 * 53 x 12.5 mm D-sub; it must stay short enough not to touch the neighbour above or beside it). The marker's OUTER
 * diameter is that x `RING_OVERSIZE`, so the ring clears the connector and does not cover it.
 *
 * Wave 5 audit (2026-11-10): the first table was per connector and too big for the panels it sits on (a C13 ring of
 * 37.5 mm on a 25 x 17 mm outlet of a 52 mm bar, XLR rings of 30 mm on 23.8 to 25.5 mm pitches, a 50 mm ring on a
 * D-sub of a 1U rack). Every entry below is checked against the specs' real footprints and against the closest
 * neighbour of every catalog device by `tests/scene/portMarkerSize.test.ts`.
 */

/** The ring's outer diameter over the connector's own size (the audit asked for about 1.15 to 1.25). */
export const RING_OVERSIZE = 1.2
/** The size of a connector with no table entry (mm). */
export const FALLBACK_MM = 20

/** Connector face size by catalog connector id (mm). */
export const CONNECTOR_MM: Readonly<Record<string, number>> = {
  // round holes: Neutrik D-size XLR opening 19.5 mm (flange 24 x 26 is outside the ring), 1/4 in jack bushing 12 mm
  'xlr3-f': 19.5,
  'xlr3-m': 19.5,
  'xlr5-f': 19.5,
  'xlr5-m': 19.5,
  'trs-quarter': 12,
  'ts-quarter': 12,
  'trs-35mm': 7,
  'tt-bantam': 9,
  // etherCON / speakON / powerCON share the D-size housing: 26 x 31 mm, the ring goes round the 26
  ethercon: 25,
  'speakon-nl4': 25,
  'powercon-blue': 25,
  'powercon-true1': 25,
  // RJ45 jack: 11.7 mm wide opening, 13 mm with its latch notch
  rj45: 13,
  // IEC: the C14 inlet is 31 x 23 mm (panel cut 27.5 x 19.5: a 1U face is 44 mm), the C13 outlet recess of the power strip 25.4 x 17.4 mm (the smaller side + margin)
  'iec-c14': 22,
  'iec-c13': 20,
  // Schuko: plug body 35 mm, socket recess about 40 mm
  'schuko-plug': 35,
  'schuko-socket': 40,
  // USB: openings 13 x 6 (A), 8 x 11 (B), 8.5 x 2.6 (C), plus margin
  'usb-a': 11,
  'usb-b': 12,
  'usb-c': 9,
  bnc: 12,
  rca: 12,
  toslink: 8,
  // D-sub 25 (flange 53 x 12.5), euroblock GPIO (42.6 x 15), mini DigiLink (12 x 8): the smaller side + margin
  dsub25: 14,
  'gpio-terminal': 15,
  digilink: 10,
  // Wave 0 (build all equipment): sizes of the connectors the plan's 315 devices need, from the manufacturers' panel-cut drawings where known,
  // otherwise a documented estimate (marked "est."): the marker ring is a hint, the spec's real positions rule where a port sits.
  // DC barrel jack: 5.5 mm plug, bore 6.5 mm -> 7 (as the 3.5 mm mini-jack); MIDI DIN 5-pin socket: 13.2 mm barrel + margin
  'dc-barrel': 7,
  'midi-din5': 14,
  // XLR4 is the D-size XLR housing, the same 19.5 mm opening as XLR3
  xlr4: 19.5,
  // BNC 50 ohm antenna jack: the BNC bayonet 12 mm of the 75 ohm connector
  'bnc-antenna-50ohm': 12,
  // Mini-XLR TA4 (Switchcraft / Neutrik TA4): about 10 mm (est.)
  'mini-xlr-ta4': 10,
  // Euroblock 3-pin 5.08 mm: 15 x 8.5 -> the smaller side + margin
  euroblock: 10,
  // speakON NL8 is the D-size housing like NL4
  'speakon-nl8': 25,
  // binding post cap about 16 mm (est.)
  'binding-post': 16,
  // opticalCON DUO is the D-size housing like etherCON and speakON
  opticalcon: 25,
  // SC simplex adapter 9 x 13 mm -> 9
  'sc-fibre': 9,
  // LEMO 0B 4-pin socket 7.2 mm -> 8 (est.)
  lemo: 8,
  // Hirose 4-pin DC socket (HR10A) about 12 mm (est.)
  hirose: 12,
}

/**
 * Outer diameter (m) of the marker ring for a connector. `openingMm` (the spec's opening for that port) wins when it is
 * finite and > 0; otherwise the table; otherwise `FALLBACK_MM`. Always finite and > 0.
 *
 * NOTE (Wave 5c, finding H): the `openingMm` branch is NOT used at runtime. The spec's opening is not in the GLB extras and DeviceSpawner calls
 * `markerDiameterM(port.connector)` only, so every ring is sized from the connector table (deliberate, see the models log, Wave 0 decisions). The
 * parameter is kept for a later change that carries the opening into the extras; tests/scene/portMarkerSize.test.ts pins the table-only call.
 */
export function markerDiameterM(connector: string, openingMm?: number): number {
  const size =
    typeof openingMm === 'number' && Number.isFinite(openingMm) && openingMm > 0
      ? openingMm
      : Object.prototype.hasOwnProperty.call(CONNECTOR_MM, connector)
        ? CONNECTOR_MM[connector]
        : FALLBACK_MM
  return (size * RING_OVERSIZE) / 1000
}
