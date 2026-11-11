/**
 * Inventory tabs model (Task 22, P16/S5/C18): which catalog device shows under
 * which tab of the inventory drawer. Pure: no Babylon, no DOM.
 *
 * The tab comes from the catalog's own `realWorld.category` (source of truth,
 * never re-invented here). Every category present in the catalog is mapped
 * explicitly below; an unknown one falls back to « Autres ». « Bêta » holds
 * proposals only and never a catalog device.
 */
import type { DeviceT, Registry } from '../engine/CatalogLoader'
import { COPY } from './copy'

export type InventoryTab =
  | 'micros' | 'consoles' | 'enceintes' | 'amplis' | 'sources' | 'reseau' | 'cables' | 'pieds' | 'secteur' | 'eclairage' | 'beta' | 'autres'

export interface InventoryItem {
  deviceId: string
  label: string
  tab: InventoryTab
  /** A public/assets/<deviceId>.glb exists; otherwise the placeholder box ships. */
  hasModel: boolean
  /**
   * A proposal's mark: « non vérifié » (the plain Bêta badge), or « dimensions estimées » once a model ships for it (Wave 0, beta-modelled:
   * a model at an estimated size, still unverified and patch-only). A catalog device carries none.
   */
  badge?: 'non vérifié' | 'dimensions estimées'
}

/** Tab names: the `inventory.tab*` strings of copy.ts (the one place for shell wording). */
const T = COPY.inventory!
export const TAB_LABELS: Record<InventoryTab, string> = {
  micros: T.tabMicros!,
  consoles: T.tabConsoles!,
  enceintes: T.tabEnceintes!,
  amplis: T.tabAmplis!,
  sources: T.tabSources!,
  reseau: T.tabReseau!,
  cables: T.tabCables!,
  pieds: T.tabPieds!,
  secteur: T.tabSecteur!,
  eclairage: T.tabEclairage!,
  beta: T.tabBeta!,
  autres: T.tabAutres!,
}

/** Display order. « Autres » stays last; empty tabs are dropped by `inventory`. */
const TAB_ORDER: readonly InventoryTab[] = [
  'micros', 'consoles', 'enceintes', 'amplis', 'sources', 'reseau', 'cables', 'pieds', 'secteur', 'eclairage', 'beta', 'autres',
]

/**
 * `realWorld.category` → tab, one line per category value of content/catalog.json, of the Bêta proposals and of the equipment plan
 * (Wave 0, build all equipment: tests/creation/inventory.test.ts holds that none falls into « Autres » by accident, so a promotion never
 * lands a device in the wrong tab). Mains is the generic power strip (Task 32); nothing in the catalog is lighting yet, so that tab stays hidden.
 * The three tabs of the original brief are « Amplis », « Câbles et DI » and « Pieds et accroches » (the K&M stand and the Yellowtec arm, both
 * category « accessory », and the Mogami loom, category « cable », moved there from « Autres » in Wave 0).
 */
export const CATEGORY_TAB: Record<string, InventoryTab> = {
  // Micros: microphones and wireless systems (a wireless system is a microphone with a radio)
  microphone: 'micros',
  wireless: 'micros',
  iem: 'micros',
  // Consoles: desks and everything in a rack that processes or distributes a signal on the way to them
  console: 'consoles',
  'console-analog': 'consoles',
  'console-digital': 'consoles',
  'console-radio': 'consoles',
  'console-podcast': 'consoles',
  stagebox: 'consoles',
  'mic-preamp': 'consoles',
  'monitor-controller': 'consoles',
  outboard: 'consoles',
  broadcast: 'consoles',
  'telephone-hybrid': 'consoles',
  // Enceintes: loudspeakers and what one listens on
  'powered-speaker': 'enceintes',
  'studio-monitor': 'enceintes',
  speaker: 'enceintes',
  headphones: 'enceintes',
  'headphone-amp': 'enceintes',
  amplifier: 'amplis',
  // Sources: what feeds or records the signal
  computer: 'sources',
  controller: 'sources',
  'audio-interface': 'sources',
  recorder: 'sources',
  measurement: 'sources',
  // Réseau: links, clocks, intercom
  codec: 'reseau',
  'master-clock': 'reseau',
  'network-switch': 'reseau',
  intercom: 'reseau',
  interface: 'reseau',
  // Câbles et DI
  cable: 'cables',
  'di-box': 'cables',
  splitter: 'cables',
  // Pieds et accroches
  accessory: 'pieds',
  'stand-arm': 'pieds',
  'mic-arm': 'pieds',
  'shock-mount': 'pieds',
  'pop-filter': 'pieds',
  // Autres
  signaling: 'autres',
  patchbay: 'autres',
  furniture: 'autres',
  // Secteur
  power: 'secteur',
  'power-strip': 'secteur',
}

export function tabFor(device: DeviceT): InventoryTab {
  return Object.prototype.hasOwnProperty.call(CATEGORY_TAB, device.realWorld.category) ? CATEGORY_TAB[device.realWorld.category] : 'autres'
}

export function inventory(
  registry: Registry,
  opts: {
    proposals: { deviceId: string; label: string }[]
    modelIds: ReadonlySet<string>
    /**
     * Where the Bêta sheets are (night wave 1, item 6): while they `loading` or `unavailable` the « Bêta » tab is listed anyway (empty), so the
     * drawer can say so in it; `ready` (the default) lists it only when there are proposals.
     */
    beta?: 'loading' | 'ready' | 'unavailable'
  },
): { tabs: InventoryTab[]; items: InventoryItem[] } {
  const items: InventoryItem[] = registry.catalog.devices.map((d) => ({
    deviceId: d.id,
    label: d.label,
    tab: tabFor(d),
    hasModel: opts.modelIds.has(d.id),
  }))
  // A proposal never shadows a catalog device: one device, one tab. The test is the CATALOG's own list, not
  // `deviceById`: a proposal registered for placement (betaDevices.ts) lives in `deviceById` and stays in « Bêta ».
  const catalogIds = new Set(registry.catalog.devices.map((d) => d.id))
  for (const p of opts.proposals) {
    if (catalogIds.has(p.deviceId)) continue
    items.push({
      deviceId: p.deviceId,
      label: p.label,
      tab: 'beta',
      hasModel: opts.modelIds.has(p.deviceId),
      badge: opts.modelIds.has(p.deviceId) ? 'dimensions estimées' : 'non vérifié',
    })
  }
  const used = new Set(items.map((i) => i.tab))
  if (opts.beta === 'loading' || opts.beta === 'unavailable') used.add('beta')
  return { tabs: TAB_ORDER.filter((t) => used.has(t)), items }
}

/** Lower case, no accents, single spaces: what the search compares. */
const fold = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * The drawer search: the items whose LABEL or FAMILY (the tab's name: « Micros », « Consoles », « Enceintes »…) holds every word of `query`
 * (any order), across all tabs; accents and case are ignored. A blank query keeps everything. Order is kept. The family is searched because the
 * empty-filter help suggests « micro, console, enceinte » (night wave 2c, C1): those words are in no device label, they are the tabs' names.
 * The label matches anywhere in a word (« ure » finds « Shure »); the FAMILY only at the start of one of its words (night wave 3b), so « e » no
 * longer finds every Console and Enceinte through « Consoles » / « Enceintes »; « console », « micro », « enceinte » (and their prefixes) still do.
 */
export function filterItems<T extends { label: string; tab?: InventoryTab }>(items: readonly T[], query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return [...items]
  return items.filter((it) => {
    const label = fold(it.label)
    const family = it.tab ? fold(TAB_LABELS[it.tab]).split(/\s+/) : []
    return words.every((w) => label.includes(w) || family.some((f) => f.startsWith(w)))
  })
}
