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

export const TAB_LABELS: Record<InventoryTab, string> = {
  micros: 'Micros',
  consoles: 'Consoles',
  enceintes: 'Enceintes',
  sources: 'Sources',
  reseau: 'Réseau',
  secteur: 'Secteur',
  eclairage: 'Éclairage',
  beta: 'Bêta',
  autres: 'Autres',
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
  // A proposal never shadows a catalog device: one device, one tab.
  for (const p of opts.proposals) {
    if (registry.deviceById.has(p.deviceId)) continue
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
