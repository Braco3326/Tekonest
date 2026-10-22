/**
 * Inventory model (ADR-0010 Décision 8) — pure. Catalog devices grouped by the
 * knowledge-base taxonomy category (French label), filtered by a search query.
 * The catalog stays the source of truth for WHAT exists; the KB sheet only adds
 * read-only facts (key specs, connectors, official manual).
 */
export interface InventoryDevice {
  id: string
  label: string
  realWorld: { brand: string; model: string; category: string }
}

export interface KbSheet {
  kbId: string
  brand: string
  model: string
  category: string
  subType: string
  keySpecs: [string, string][]
  connectors: string[]
  manualUrl: string | null
  productUrl: string | null
  manualLanguages: string[]
}

export interface KbSheets {
  categories: Record<string, string>
  devices: Record<string, KbSheet>
}

export interface InventoryItem {
  id: string
  label: string
  brand: string
  model: string
  sheet: KbSheet | null
}

export interface InventoryGroup {
  categoryId: string
  label: string
  items: InventoryItem[]
}

export interface InventoryModel {
  groups: InventoryGroup[]
  total: number
  placementAllowed: boolean
}

/** Combining diacritical marks (U+0300–U+036F), stripped after NFD so "é" matches "e". */
const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

export const normalize = (s: string): string => s.normalize('NFD').replace(DIACRITICS, '').toLowerCase()

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

export function buildInventoryModel(
  devices: readonly InventoryDevice[],
  sheets: KbSheets,
  query: string,
  placementAllowed: boolean,
): InventoryModel {
  const q = normalize(query.trim())
  const byCat = new Map<string, InventoryGroup>()
  let total = 0
  for (const d of devices) {
    const sheet = sheets.devices[d.id] ?? null
    const categoryId = sheet?.category ?? d.realWorld.category
    const label = sheets.categories[categoryId] ?? capitalize(categoryId)
    const haystack = normalize([d.label, d.realWorld.brand, d.realWorld.model, label, categoryId].join(' '))
    if (q && !haystack.includes(q)) continue
    const group = byCat.get(categoryId) ?? { categoryId, label, items: [] }
    group.items.push({ id: d.id, label: d.label, brand: d.realWorld.brand, model: d.realWorld.model, sheet })
    byCat.set(categoryId, group)
    total++
  }
  const collator = new Intl.Collator('fr')
  const groups = [...byCat.values()].sort((a, b) => collator.compare(a.label, b.label))
  for (const g of groups) g.items.sort((a, b) => collator.compare(a.label, b.label))
  return { groups, total, placementAllowed }
}
