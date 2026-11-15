/**
 * The rear panel of a device on the 2D schema page (mission 2, spec §1.3): its REAL ports, read from the catalogue (content/catalog.json, never invented),
 * in catalogue order, each with its connector glyph, its gender (the catalogue's connector type), its French connector and signal names and its direction.
 *
 * The layout is a plain row (wrapped every 8 ports) in catalogue order, for every device, and the page says so: the catalogue does not give the position of
 * a port on the panel, so none is drawn. Gender drawing rule of the colour and symbol sheet §2: a male glyph (filled pins) is an output, a female one (open
 * sockets) an input, for XLR audio (AES14 convention, secondary source; the drawing is OUR PROPOSAL). Pure: no DOM.
 */
import type { Registry } from '../engine/CatalogLoader'
import { connectorName, shortName, signalName } from '../creation/shell/propertiesModel'
import { portCableType, type CableType } from './cableStyle2d'

export type ConnectorGlyph =
  | 'xlr' | 'jack' | 'rca' | 'speakon' | 'rj45' | 'bnc' | 'optical' | 'usb' | 'din' | 'iec' | 'schuko' | 'powercon' | 'dsub' | 'dc' | 'terminal' | 'multipin'

/** Every connector type of the catalogue, explicitly (tests/plan2d/rearPanel.test.ts fails on a new one). */
export const CONNECTOR_GLYPH: Readonly<Record<string, ConnectorGlyph>> = {
  'xlr3-m': 'xlr',
  'xlr3-f': 'xlr',
  'xlr5-m': 'xlr',
  'xlr5-f': 'xlr',
  xlr4: 'xlr',
  'mini-xlr-ta4': 'xlr',
  'trs-quarter': 'jack',
  'ts-quarter': 'jack',
  'trs-35mm': 'jack',
  'tt-bantam': 'jack',
  rca: 'rca',
  rj45: 'rj45',
  ethercon: 'rj45',
  'speakon-nl4': 'speakon',
  'speakon-nl8': 'speakon',
  'powercon-blue': 'powercon',
  'powercon-true1': 'powercon',
  'iec-c13': 'iec',
  'iec-c14': 'iec',
  'schuko-plug': 'schuko',
  'schuko-socket': 'schuko',
  bnc: 'bnc',
  'bnc-antenna-50ohm': 'bnc',
  dsub25: 'dsub',
  toslink: 'optical',
  opticalcon: 'optical',
  'sc-fibre': 'optical',
  'usb-a': 'usb',
  'usb-b': 'usb',
  'usb-c': 'usb',
  digilink: 'multipin',
  'gpio-terminal': 'terminal',
  euroblock: 'terminal',
  'binding-post': 'terminal',
  'dc-barrel': 'dc',
  'midi-din5': 'din',
  lemo: 'multipin',
  hirose: 'multipin',
}

export interface RearPort {
  portId: string
  dir: 'in' | 'out' | 'bidir'
  connector: string
  signal: string
  flags: readonly string[]
  gender: 'male' | 'female' | 'universal'
  glyph: ConnectorGlyph
  connectorLabel: string
  signalLabel: string
  cableType: CableType
}

export interface RearLayout {
  deviceId: string
  /** The device's short name (the catalogue label without the brand). */
  label: string
  ports: RearPort[]
  /** Always true today: the ports are drawn in catalogue order, not at their place on the panel (the page says so). */
  plainRow: true
  columns: number
}

export const REAR_COLUMNS = 8

export function rearLayout(registry: Registry, deviceId: string): RearLayout | null {
  const device = registry.deviceById.get(deviceId)
  if (!device) return null
  const ports: RearPort[] = device.ports.map((p) => ({
    portId: p.portId,
    dir: p.dir,
    connector: p.connector,
    signal: p.signal,
    flags: p.flags ?? [],
    gender: registry.connectorById.get(p.connector)?.gender ?? 'universal',
    glyph: CONNECTOR_GLYPH[p.connector] ?? 'multipin',
    connectorLabel: connectorName(registry, p.connector),
    signalLabel: signalName(registry, p.signal),
    cableType: portCableType(p),
  }))
  return { deviceId, label: shortName(registry, deviceId), ports, plainRow: true, columns: Math.max(1, Math.min(REAR_COLUMNS, ports.length)) }
}
