/**
 * Device thumbnails for the inventory drawer (final review 4). The files are the legacy shelf's
 * (`src/ui/shelf.ts`: `public/assets/thumbs/<deviceId>.png`, 384 px square). This set lists the catalog devices that have
 * one; `tests/creation/inventoryThumbs.test.ts` compares it with the folder in both directions, so a new thumbnail or a
 * new device cannot drift silently. A device not listed (a Bêta proposal, a device with no picture yet) keeps the
 * generic silhouette. Pure data: no DOM.
 */
export const THUMB_IDS: ReadonlySet<string> = new Set([
  'aeta-scoop5-s',
  'aeta-scoopy-plus-s',
  'antelope-ocx-hd',
  'avid-hd-io',
  'avid-protools-hdx',
  'axia-iq',
  'ev-re20',
  'ev-re50',
  'focusrite-isa-one',
  'genelec-8030c',
  'grace-m905',
  'km-210-9',
  'mogami-gold-db25-xlrm',
  'neumann-u87-ai',
  'playout-pc',
  'qsc-k12-2',
  'shure-sm57',
  'shure-sm58',
  'switchcraft-studiopatch-9625',
  'yamaha-dbr12',
  'yamaha-ql1',
  'yamaha-rio3224-d2',
  'yellowtec-litt',
  'yellowtec-mika',
])

/** The thumbnail's path under the app base (feed it to `assetUrl`), or null when the device has none. */
export const thumbPath = (deviceId: string): string | null => (THUMB_IDS.has(deviceId) ? `assets/thumbs/${deviceId}.png` : null)
