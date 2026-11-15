/**
 * Technical symbols of the 2D schema page (mission 2): one glyph per device family, after the colour and symbol sheet §1.5, and the footprint of each
 * device. Pure data. Every glyph is OUR PROPOSAL (the sheet's tag): the IEC 60617 drawings were not seen, so nothing here claims to be the standard.
 *
 * A glyph is SVG path data in the device's own unit square: u in [-0.5, 0.5] across (local x), v in [-0.5, 0.5] from the rear (-0.5) to the front (+0.5).
 * The view scales it to the real footprint and turns it with the device, so the front of a loudspeaker's cone faces where the loudspeaker faces.
 * The family comes from the catalogue's own `realWorld.category` (as the inventory tabs, src/creation/inventory.ts); a category not listed below is
 * « unknown »: a labelled box that says so.
 */
import footprints from './footprints.json'

export type Family = 'micro' | 'speaker' | 'headphones' | 'amp' | 'console' | 'rack' | 'box' | 'unknown'

export interface Glyph {
  d: string
  confidence: 'OUR PROPOSAL'
  /** The sheet's words after the tag (what the drawing is loosely after, what is unverified). */
  after?: string
  /** The device's short name is written in the box (the sheet: « small rectangle with a short label »). */
  labelled?: boolean
}

export const GLYPHS: Readonly<Record<Family, Glyph>> = {
  // a round head (an octagon) on a short stem toward the rear
  micro: {
    d: 'M0 -0.5V-0.12M-0.12 -0.08L0.12 -0.08L0.3 0.1L0.3 0.32L0.12 0.5L-0.12 0.5L-0.3 0.32L-0.3 0.1Z',
    confidence: 'OUR PROPOSAL',
    after: 'circle on a short stem, loosely after the IEC-style microphone (drawing unseen)',
  },
  // the general loudspeaker shape from above: the magnet block at the rear, the cone opening toward the front
  speaker: {
    d: 'M-0.16 -0.4H0.16V-0.1H-0.16ZM-0.16 -0.1L-0.42 0.42H0.42L0.16 -0.1',
    confidence: 'OUR PROPOSAL',
    after: 'box + cone, loosely after IEC 60617 S01059 (drawing unseen)',
  },
  headphones: { d: 'M-0.34 0.05Q0 -0.5 0.34 0.05M-0.46 0H-0.22V0.36H-0.46ZM0.22 0H0.46V0.36H0.22Z', confidence: 'OUR PROPOSAL', after: 'headband arc with two cups' },
  amp: {
    d: 'M-0.38 -0.36H0.38L0 0.4Z',
    confidence: 'OUR PROPOSAL',
    after: 'triangle, the usual amp sign; the IEC entry is UNVERIFIED',
  },
  console: {
    d: 'M-0.36 -0.36V0.08M-0.24 -0.36V0.08M-0.12 -0.36V0.08M0 -0.36V0.08M0.12 -0.36V0.08M0.24 -0.36V0.08M0.36 -0.36V0.08M-0.42 0.2H0.42',
    confidence: 'OUR PROPOSAL',
    after: 'rectangle block with a small channel-strip pattern',
  },
  rack: { d: 'M-0.42 -0.2H0.42M-0.42 0H0.42M-0.42 0.2H0.42', confidence: 'OUR PROPOSAL', after: 'rectangle block', labelled: true },
  box: { d: 'M-0.42 0.36H0.42', confidence: 'OUR PROPOSAL', after: 'small rectangle with a short label', labelled: true },
  unknown: { d: 'M-0.42 -0.42L0.42 0.42M0.42 -0.42L-0.42 0.42', confidence: 'OUR PROPOSAL', after: 'labelled box: the family of this device is not drawn yet', labelled: true },
}

/** Every `realWorld.category` of content/catalog.json and of the inventory tabs (tests/plan2d/symbols.test.ts holds that no catalogue category is missing). */
export const CATEGORY_FAMILY: Readonly<Record<string, Family>> = {
  microphone: 'micro',
  wireless: 'micro',
  iem: 'headphones',
  headphones: 'headphones',
  'powered-speaker': 'speaker',
  'studio-monitor': 'speaker',
  speaker: 'speaker',
  amplifier: 'amp',
  console: 'console',
  'console-analog': 'console',
  'console-digital': 'console',
  'console-radio': 'console',
  'console-podcast': 'console',
  stagebox: 'rack',
  patchbay: 'rack',
  'headphone-amp': 'box',
  'mic-preamp': 'box',
  'monitor-controller': 'box',
  outboard: 'box',
  broadcast: 'box',
  'telephone-hybrid': 'box',
  computer: 'box',
  controller: 'box',
  'audio-interface': 'box',
  recorder: 'box',
  measurement: 'box',
  codec: 'box',
  'master-clock': 'box',
  'network-switch': 'box',
  intercom: 'box',
  interface: 'box',
  cable: 'box',
  'di-box': 'box',
  splitter: 'box',
  accessory: 'box',
  'stand-arm': 'box',
  'mic-arm': 'box',
  'shock-mount': 'box',
  'pop-filter': 'box',
  signaling: 'box',
  furniture: 'box',
  power: 'box',
  'power-strip': 'box',
}

export const familyOf = (category: string): Family => (Object.prototype.hasOwnProperty.call(CATEGORY_FAMILY, category) ? CATEGORY_FAMILY[category]! : 'unknown')

/** The side of the box drawn for a device whose footprint is unknown (a drawing size, not the device's: it is labelled « taille inconnue »). */
export const DEFAULT_BOX_M = 0.5

export interface Footprint {
  /** Width and depth in metres. */
  w: number
  d: number
  /** False: no size is known for this device; the default box is drawn and says so. */
  known: boolean
  /** The file the numbers come from (its own sources list names the manufacturer sheets), null when unknown. */
  source: string | null
}

const TABLE = (footprints as { devices: Record<string, { w: number; d: number; source: string }> }).devices

export function footprintOf(deviceId: string): Footprint {
  const f = Object.prototype.hasOwnProperty.call(TABLE, deviceId) ? TABLE[deviceId] : undefined
  if (!f) return { w: DEFAULT_BOX_M, d: DEFAULT_BOX_M, known: false, source: null }
  return { w: f.w / 1000, d: f.d / 1000, known: true, source: f.source }
}
