/**
 * Port marker size from the connector (pure). A marker is a thin outline ring drawn AROUND the connector, so it must be
 * sized from the connector, not a fixed 50 mm: a fixed disc covered three XLRs on a 25 mm pitch (the Yamaha QL1 rear).
 *
 * `CONNECTOR_MM` is the size of the connector's face (the opening a plug goes into, mm). The marker's OUTER diameter is
 * that x `RING_OVERSIZE`, so the ring clears the connector and does not cover it.
 */

/** The ring's outer diameter over the connector's own size. */
export const RING_OVERSIZE = 1.25
/** The size of a connector with no table entry (mm). */
export const FALLBACK_MM = 20

/** Connector face size by catalog connector id (mm). */
export const CONNECTOR_MM: Readonly<Record<string, number>> = {
  'xlr3-f': 24,
  'xlr3-m': 24,
  'xlr5-f': 24,
  'xlr5-m': 24,
  'trs-quarter': 14,
  'ts-quarter': 14,
  'trs-35mm': 8,
  'tt-bantam': 11,
  rj45: 16,
  ethercon: 24,
  'speakon-nl4': 26,
  'powercon-blue': 30,
  'powercon-true1': 30,
  'iec-c13': 30,
  'iec-c14': 30,
  'schuko-plug': 30,
  'schuko-socket': 30,
  'usb-a': 14,
  'usb-b': 12,
  'usb-c': 10,
  bnc: 14,
  rca: 13,
  toslink: 9,
  dsub25: 40,
  'gpio-terminal': 40,
  digilink: 12,
}

/**
 * Outer diameter (m) of the marker ring for a connector. `openingMm` (the spec's opening for that port) wins when it is
 * finite and > 0; otherwise the table; otherwise `FALLBACK_MM`. Always finite and > 0.
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
