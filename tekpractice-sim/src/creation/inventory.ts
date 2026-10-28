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
  | 'micros' | 'consoles' | 'enceintes' | 'sources' | 'reseau' | 'secteur' | 'eclairage' | 'beta' | 'autres'

export interface InventoryItem {
  deviceId: string
  label: string
  tab: InventoryTab
  /** A public/assets/<deviceId>.glb exists; otherwise the placeholder box ships. */
  hasModel: boolean
  badge?: 'non vérifié'
}

/** Tab names: the `inventory.tab*` strings of copy.ts (the one place for shell wording). */
const T = COPY.inventory!
export const TAB_LABELS: Record<InventoryTab, string> = {
  micros: T.tabMicros!,
  consoles: T.tabConsoles!,
  enceintes: T.tabEnceintes!,
  sources: T.tabSources!,
  reseau: T.tabReseau!,
  secteur: T.tabSecteur!,
  eclairage: T.tabEclairage!,
  beta: T.tabBeta!,
  autres: T.tabAutres!,
}

/** Display order. « Autres » stays last; empty tabs are dropped by `inventory`. */
const TAB_ORDER: readonly InventoryTab[] = [
  'micros', 'consoles', 'enceintes', 'sources', 'reseau', 'secteur', 'eclairage', 'beta', 'autres',
]

/**
 * `realWorld.category` → tab, one line per value in content/catalog.json.
 * Nothing in the catalog is mains or lighting yet, so those tabs stay hidden.
 */
export const CATEGORY_TAB: Record<string, InventoryTab> = {
  microphone: 'micros',
  console: 'consoles',
  stagebox: 'consoles',
  'mic-preamp': 'consoles',
  'monitor-controller': 'consoles',
  'powered-speaker': 'enceintes',
  'studio-monitor': 'enceintes',
  computer: 'sources',
  'audio-interface': 'sources',
  codec: 'reseau',
  'master-clock': 'reseau',
  accessory: 'autres',
  signaling: 'autres',
  cable: 'autres',
  patchbay: 'autres',
}

export function tabFor(device: DeviceT): InventoryTab {
  return Object.prototype.hasOwnProperty.call(CATEGORY_TAB, device.realWorld.category) ? CATEGORY_TAB[device.realWorld.category] : 'autres'
}

export function inventory(
  registry: Registry,
  opts: { proposals: { deviceId: string; label: string }[]; modelIds: ReadonlySet<string> },
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
      badge: 'non vérifié',
    })
  }
  const used = new Set(items.map((i) => i.tab))
  return { tabs: TAB_ORDER.filter((t) => used.has(t)), items }
}

/** Lower case, no accents, single spaces: what the search compares. */
const fold = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * The drawer search: the items whose LABEL holds every word of `query` (any order), across all tabs; accents and case
 * are ignored. A blank query keeps everything. Order is kept.
 */
export function filterItems<T extends { label: string }>(items: readonly T[], query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return [...items]
  return items.filter((it) => {
    const label = fold(it.label)
    return words.every((w) => label.includes(w))
  })
}
