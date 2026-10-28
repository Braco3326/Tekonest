import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { CATEGORY_TAB, TAB_LABELS, filterItems, inventory, tabFor, type InventoryTab } from '../../src/creation/inventory'

const registry = makeRegistry()
const allIds = [...registry.deviceById.keys()]
const allModels: ReadonlySet<string> = new Set(allIds)
const none = { proposals: [], modelIds: allModels }

const tabOf = (id: string, r = inventory(registry, none)) => r.items.find((i) => i.deviceId === id)?.tab

describe('TAB_LABELS', () => {
  it('names the nine tabs in French', () => {
    expect(TAB_LABELS).toEqual({
      micros: 'Micros',
      consoles: 'Consoles',
      enceintes: 'Enceintes',
      sources: 'Sources',
      reseau: 'Réseau',
      secteur: 'Secteur',
      eclairage: 'Éclairage',
      beta: 'Bêta',
      autres: 'Autres',
    })
  })
})

describe('tabFor', () => {
  it('maps every category value present in the catalog explicitly (no silent fallback)', () => {
    const categories = new Set([...registry.deviceById.values()].map((d) => d.realWorld.category))
    expect(categories.size).toBe(15)
    for (const c of categories) expect(Object.keys(CATEGORY_TAB), c).toContain(c)
  })

  const expected: Record<string, InventoryTab> = {
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
  for (const [category, tab] of Object.entries(expected)) {
    it(`category « ${category} » goes to « ${tab} »`, () => {
      const sample = [...registry.deviceById.values()].find((d) => d.realWorld.category === category)!
      expect(sample, category).toBeDefined()
      expect(tabFor(sample)).toBe(tab)
    })
  }

  it('sends an unknown category to « autres »', () => {
    const d = structuredClone(registry.deviceById.get('shure-sm58')!)
    d.realWorld.category = 'something-new'
    expect(tabFor(d)).toBe('autres')
  })

  it('never maps a catalog category to the beta tab (reserved for proposals)', () => {
    for (const tab of Object.values(CATEGORY_TAB)) expect(tab).not.toBe('beta')
  })
})

describe('inventory', () => {
  it('lists each of the 24 catalog devices in exactly one tab', () => {
    expect(allIds).toHaveLength(24)
    const r = inventory(registry, none)
    expect(r.items).toHaveLength(24)
    for (const id of allIds) expect(r.items.filter((i) => i.deviceId === id), id).toHaveLength(1)
    for (const i of r.items) expect(r.tabs, i.deviceId).toContain(i.tab)
  })

  it('puts the reference devices in their tabs', () => {
    const r = inventory(registry, none)
    expect(tabOf('shure-sm58', r)).toBe('micros')
    expect(tabOf('yamaha-ql1', r)).toBe('consoles')
    expect(tabOf('qsc-k12-2', r)).toBe('enceintes')
    expect(tabOf('yamaha-dbr12', r)).toBe('enceintes')
    expect(tabOf('genelec-8030c', r)).toBe('enceintes')
    expect(tabOf('playout-pc', r)).toBe('sources')
  })

  it('hides empty tabs: no mains or lighting device yet, no proposals', () => {
    const { tabs } = inventory(registry, none)
    expect(tabs).not.toContain('secteur')
    expect(tabs).not.toContain('eclairage')
    expect(tabs).not.toContain('beta')
  })

  it('keeps « autres » last and the other tabs in declaration order', () => {
    const { tabs } = inventory(registry, none)
    expect(tabs).toEqual(['micros', 'consoles', 'enceintes', 'sources', 'reseau', 'autres'])
    expect(tabs[tabs.length - 1]).toBe('autres')
  })

  it('keeps « autres » last even when « bêta » is shown', () => {
    const { tabs } = inventory(registry, { proposals: [{ deviceId: 'p-1', label: 'Proposé' }], modelIds: allModels })
    expect(tabs.slice(-2)).toEqual(['beta', 'autres'])
  })

  it('uses the catalog label and the model set for hasModel', () => {
    const models = new Set(allIds.filter((id) => id !== 'yamaha-ql1'))
    const r = inventory(registry, { proposals: [], modelIds: models })
    const ql1 = r.items.find((i) => i.deviceId === 'yamaha-ql1')!
    expect(ql1.label).toBe(registry.deviceById.get('yamaha-ql1')!.label)
    expect(ql1.hasModel).toBe(false)
    expect(r.items.find((i) => i.deviceId === 'shure-sm58')!.hasModel).toBe(true)
  })

  it('does not badge catalog devices', () => {
    for (const i of inventory(registry, none).items) expect(i.badge, i.deviceId).toBeUndefined()
  })

  it('puts proposals only in « bêta », badged « non vérifié »', () => {
    const r = inventory(registry, {
      proposals: [
        { deviceId: 'multiprise-secteur', label: 'Multiprise' },
        { deviceId: 'projecteur-par', label: 'Projecteur PAR' },
      ],
      modelIds: new Set([...allIds, 'multiprise-secteur']),
    })
    const betas = r.items.filter((i) => i.tab === 'beta')
    expect(betas.map((i) => i.deviceId)).toEqual(['multiprise-secteur', 'projecteur-par'])
    for (const b of betas) expect(b.badge).toBe('non vérifié')
    expect(betas[0].hasModel).toBe(true)
    expect(betas[1].hasModel).toBe(false)
    expect(r.items.filter((i) => i.tab !== 'beta' && i.badge)).toEqual([])
    expect(r.items).toHaveLength(26)
  })

  it('ignores a proposal whose id is already a catalog device (one tab per device)', () => {
    const r = inventory(registry, { proposals: [{ deviceId: 'shure-sm58', label: 'Doublon' }], modelIds: allModels })
    expect(r.items.filter((i) => i.deviceId === 'shure-sm58')).toHaveLength(1)
    expect(tabOf('shure-sm58', r)).toBe('micros')
    expect(r.tabs).not.toContain('beta')
  })
})

describe('filterItems (the drawer search, final review 4)', () => {
  const r = inventory(registry, none)
  it('an empty or blank query keeps everything, in order', () => {
    expect(filterItems(r.items, '').map((i) => i.deviceId)).toEqual(r.items.map((i) => i.deviceId))
    expect(filterItems(r.items, '   ').length).toBe(r.items.length)
  })
  it('matches the label across ALL tabs, ignoring case and accents', () => {
    const items = [
      { deviceId: 'a', label: 'Shure SM58', tab: 'micros' as const, hasModel: true },
      { deviceId: 'b', label: 'Yamaha QL1', tab: 'consoles' as const, hasModel: true },
      { deviceId: 'c', label: 'Enceinte Éclatée', tab: 'enceintes' as const, hasModel: false },
    ]
    expect(filterItems(items, 'sm58').map((i) => i.deviceId)).toEqual(['a'])
    expect(filterItems(items, 'YAMAHA').map((i) => i.deviceId)).toEqual(['b'])
    expect(filterItems(items, 'eclatee').map((i) => i.deviceId)).toEqual(['c'])
    expect(filterItems(items, 'éclat').map((i) => i.deviceId)).toEqual(['c'])
    expect(filterItems(items, 'e').map((i) => i.deviceId)).toEqual(['a', 'c']) // « Shure », « Éclatée »: order kept, accent folded
  })
  it('several words must all be in the label, in any order; no match gives an empty list', () => {
    const items = [{ deviceId: 'b', label: 'Yamaha QL1', tab: 'consoles' as const, hasModel: true }]
    expect(filterItems(items, 'ql1 yamaha')).toHaveLength(1)
    expect(filterItems(items, 'yamaha sm58')).toEqual([])
    expect(filterItems(items, 'zzz')).toEqual([])
  })
  it('every catalog device is found by its own label', () => {
    for (const it of r.items) expect(filterItems(r.items, it.label).map((i) => i.deviceId), it.label).toContain(it.deviceId)
  })
})
