import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { COPY } from '../../src/creation/copy'
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
    expect(categories.size).toBe(16) // 15 + « power-strip » (Task 32)
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
    'power-strip': 'secteur',
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
  it('lists each catalog device in exactly one tab (24 before Task 32, 25 with the power strip)', () => {
    expect(allIds).toHaveLength(registry.catalog.devices.length)
    expect(allIds).toHaveLength(25)
    const r = inventory(registry, none)
    expect(r.items).toHaveLength(allIds.length)
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
    expect(tabOf('multiprise-secteur', r)).toBe('secteur')
  })

  it('shows « secteur » (the power strip, Task 32) and hides the tabs that are still empty: lighting, proposals', () => {
    const { tabs, items } = inventory(registry, none)
    expect(tabs).toContain('secteur')
    expect(items.filter((i) => i.tab === 'secteur').map((i) => i.deviceId)).toEqual(['multiprise-secteur'])
    expect(tabs).not.toContain('eclairage')
    expect(tabs).not.toContain('beta')
  })

  it('keeps « autres » last and the other tabs in declaration order', () => {
    const { tabs } = inventory(registry, none)
    expect(tabs).toEqual(['micros', 'consoles', 'enceintes', 'sources', 'reseau', 'secteur', 'autres'])
    expect(tabs[tabs.length - 1]).toBe('autres')
  })

  it('night wave 1, item 6: while the Bêta sheets load or failed, « bêta » is listed (empty) so the drawer can say so; ready with none hides it; the catalog tabs are the same', () => {
    const base = inventory(registry, none).tabs
    for (const beta of ['loading', 'unavailable'] as const) {
      const r = inventory(registry, { ...none, beta })
      expect(r.tabs, beta).toEqual(['micros', 'consoles', 'enceintes', 'sources', 'reseau', 'secteur', 'beta', 'autres'])
      expect(r.items.filter((i) => i.tab === 'beta')).toEqual([])
      expect(r.tabs.filter((t) => t !== 'beta')).toEqual(base)
    }
    expect(inventory(registry, { ...none, beta: 'ready' }).tabs).toEqual(base)
    expect(inventory(registry, none).tabs).toEqual(base)
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
        { deviceId: 'rallonge-test', label: 'Rallonge' },
        { deviceId: 'projecteur-par', label: 'Projecteur PAR' },
      ],
      modelIds: new Set([...allIds, 'rallonge-test']),
    })
    const betas = r.items.filter((i) => i.tab === 'beta')
    expect(betas.map((i) => i.deviceId)).toEqual(['rallonge-test', 'projecteur-par'])
    for (const b of betas) expect(b.badge).toBe('non vérifié')
    expect(betas[0].hasModel).toBe(true)
    expect(betas[1].hasModel).toBe(false)
    expect(r.items.filter((i) => i.tab !== 'beta' && i.badge)).toEqual([])
    expect(r.items).toHaveLength(allIds.length + 2)
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
    expect(filterItems(items, 'ure').map((i) => i.deviceId)).toEqual(['a']) // « Shure »: order kept
    expect(filterItems(items, 'eclat').map((i) => i.deviceId)).toEqual(['c']) // « Éclatée »: accent folded
  })
  it('several words must all be in the label, in any order; no match gives an empty list', () => {
    const items = [{ deviceId: 'b', label: 'Yamaha QL1', tab: 'consoles' as const, hasModel: true }]
    expect(filterItems(items, 'ql1 yamaha')).toHaveLength(1)
    expect(filterItems(items, 'yamaha sm58')).toEqual([])
    expect(filterItems(items, 'zzz')).toEqual([])
  })
  it('night wave 2c (C1): the family name is searched too, so every word the empty-filter help suggests really finds devices', () => {
    // The words come from the shipped help text itself (« … (micro, console, enceinte). »): the text and the behaviour cannot drift apart again.
    const words = COPY.inventory!.filterNoneHelp!.match(/\(([^)]+)\)/)![1].split(',').map((w) => w.trim())
    expect(words).toEqual(['micro', 'console', 'enceinte'])
    for (const w of words) expect(filterItems(r.items, w).length, w).toBeGreaterThanOrEqual(1)
    // and they find the right family: « console » reaches the Consoles tab, « enceinte » the speakers
    expect(filterItems(r.items, 'console').some((i) => i.tab === 'consoles')).toBe(true)
    expect(filterItems(r.items, 'enceinte').some((i) => i.tab === 'enceintes')).toBe(true)
    expect(filterItems(r.items, 'micro').some((i) => i.tab === 'micros')).toBe(true)
    // the Bêta tab keeps working: a proposal is found by its label and by « bêta »
    const withBeta = inventory(registry, { proposals: [{ deviceId: 'prop-x', label: 'Zoom Proposé 9' }], modelIds: allModels })
    expect(filterItems(withBeta.items, 'propose').map((i) => i.deviceId)).toEqual(['prop-x'])
    expect(filterItems(withBeta.items, 'beta').map((i) => i.deviceId)).toEqual(['prop-x'])
    // a word of the label and a word of the family together
    expect(filterItems(r.items, 'yamaha console').every((i) => i.tab === 'consoles' || /console/i.test(i.label))).toBe(true)
  })
  it('night wave 3b: the FAMILY matches at word start only (« e » no longer reaches every Console / Enceinte), the label still matches inside words', () => {
    const items = [
      { deviceId: 'k', label: 'XYZ 9', tab: 'consoles' as const, hasModel: true },
      { deviceId: 'm', label: 'Qrs 4', tab: 'micros' as const, hasModel: true },
      { deviceId: 'w', label: 'Qrs 5', tab: 'enceintes' as const, hasModel: true },
    ]
    // a one-letter query: only the family that STARTS with it (before: also « Consoles », which merely holds an « e »)
    expect(filterItems(items, 'e').map((i) => i.deviceId)).toEqual(['w'])
    expect(filterItems(items, 'ceinte')).toEqual([]) // inside « Enceintes »
    expect(filterItems(items, 'o').map((i) => i.deviceId)).toEqual([]) // « Consoles », « Micros »: inside words
    expect(filterItems(items, 'sole')).toEqual([]) // inside « Consoles »
    expect(filterItems(items, 'ros')).toEqual([]) // inside « Micros »
    // at word start: found, prefixes included, accents and case ignored
    expect(filterItems(items, 'c').map((i) => i.deviceId)).toEqual(['k'])
    expect(filterItems(items, 'cons').map((i) => i.deviceId)).toEqual(['k'])
    expect(filterItems(items, 'CONSOLES').map((i) => i.deviceId)).toEqual(['k'])
    expect(filterItems(items, 'micro').map((i) => i.deviceId)).toEqual(['m'])
    expect(filterItems(items, 'enceinte').map((i) => i.deviceId)).toEqual(['w'])
    // the LABEL keeps matching inside words (« ure » finds « Shure »; the existing test above), and a label + a family word still combine
    expect(filterItems(items, 'yz 9 console').map((i) => i.deviceId)).toEqual(['k'])
    expect(filterItems(items, 'yz sole')).toEqual([])
    // the family name is accent-folded (« Bêta »), and matched at the start only
    const multi = [{ deviceId: 'x', label: 'Qrs', tab: 'beta' as const, hasModel: false }]
    expect(filterItems(multi, 'beta').map((i) => i.deviceId)).toEqual(['x'])
    expect(filterItems(multi, 'eta')).toEqual([])
  })
  it('every catalog device is found by its own label', () => {
    for (const it of r.items) expect(filterItems(r.items, it.label).map((i) => i.deviceId), it.label).toContain(it.deviceId)
  })
})
