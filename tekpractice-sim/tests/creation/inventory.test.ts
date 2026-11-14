import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { makeRegistry, rawCatalog } from '../helpers'
import { COPY } from '../../src/creation/copy'
import { CATEGORY_TAB, TAB_LABELS, filterItems, inventory, tabFor, type InventoryTab } from '../../src/creation/inventory'

const registry = makeRegistry()
/** Counts the catalogue has TODAY, read from content/catalog.json, never typed here: a promotion changes the file, not this test (Wave 0, derived pins). */
const catalogDevices = (rawCatalog() as { devices: { id: string; realWorld: { category: string } }[] }).devices
const CATALOG_DEVICE_COUNT = catalogDevices.length
const CATALOG_CATEGORIES = new Set(catalogDevices.map((d) => d.realWorld.category))
/** The declared display order of the tabs (the test's own copy: a tab added to the code but not here fails the order test). */
const DECLARED_ORDER: readonly InventoryTab[] = ['micros', 'consoles', 'enceintes', 'amplis', 'sources', 'reseau', 'cables', 'pieds', 'secteur', 'eclairage', 'beta', 'autres']
const tabsPresent = (extra: readonly InventoryTab[] = []): InventoryTab[] => {
  const used = new Set<InventoryTab>([...catalogDevices.map((d) => CATEGORY_TAB[d.realWorld.category] ?? 'autres'), ...extra])
  return DECLARED_ORDER.filter((x) => used.has(x))
}
const allIds = [...registry.deviceById.keys()]
const allModels: ReadonlySet<string> = new Set(allIds)
const none = { proposals: [], modelIds: allModels }

const tabOf = (id: string, r = inventory(registry, none)) => r.items.find((i) => i.deviceId === id)?.tab

describe('TAB_LABELS', () => {
  it('names the twelve tabs in French (the nine of Task 22 and Amplis, Câbles et DI, Pieds et accroches, Wave 0)', () => {
    expect(TAB_LABELS).toEqual({
      micros: 'Micros',
      consoles: 'Consoles',
      enceintes: 'Enceintes',
      amplis: 'Amplis',
      sources: 'Sources',
      reseau: 'Réseau',
      cables: 'Câbles et DI',
      pieds: 'Pieds et accroches',
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
    expect(categories).toEqual(CATALOG_CATEGORIES) // derived from content/catalog.json: the registry holds exactly the catalogue's categories
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
    accessory: 'pieds',
    signaling: 'autres',
    cable: 'cables',
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
  it('lists each catalog device in exactly one tab (the count is the one of content/catalog.json, not a literal)', () => {
    expect(allIds).toHaveLength(registry.catalog.devices.length)
    expect(allIds).toHaveLength(CATALOG_DEVICE_COUNT)
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
    expect(tabs).toEqual(tabsPresent())
    expect(tabs[tabs.length - 1]).toBe('autres')
  })

  it('night wave 1, item 6: while the Bêta sheets load or failed, « bêta » is listed (empty) so the drawer can say so; ready with none hides it; the catalog tabs are the same', () => {
    const base = inventory(registry, none).tabs
    for (const beta of ['loading', 'unavailable'] as const) {
      const r = inventory(registry, { ...none, beta })
      expect(r.tabs, beta).toEqual(tabsPresent(['beta']))
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

  it('puts proposals only in « bêta », badged (« non vérifié », or « dimensions estimées » when a model ships)', () => {
    const r = inventory(registry, {
      proposals: [
        { deviceId: 'rallonge-test', label: 'Rallonge' },
        { deviceId: 'projecteur-par', label: 'Projecteur PAR' },
      ],
      modelIds: new Set([...allIds, 'rallonge-test']),
    })
    const betas = r.items.filter((i) => i.tab === 'beta')
    expect(betas.map((i) => i.deviceId)).toEqual(['rallonge-test', 'projecteur-par'])
    // Wave 0: a proposal with a shipped model reads « dimensions estimées », one without keeps the plain « non vérifié »; neither is ever unbadged
    expect(betas.map((b) => b.badge)).toEqual(['dimensions estimées', 'non vérifié'])
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
    // « beta » also reaches a verified device whose own label says Beta (the Shure Beta 58A, Wave 1): the proposal is found, and every other hit is a label match
    const betaHits = filterItems(withBeta.items, 'beta')
    expect(betaHits.map((i) => i.deviceId)).toContain('prop-x')
    expect(betaHits.filter((i) => i.deviceId !== 'prop-x').every((i) => /beta/i.test(i.label))).toBe(true)
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

describe('Wave 0 tabs: no category falls into « Autres » by accident, no id is in two tabs, the pins derive from the catalogue', () => {
  const proposalsFile = JSON.parse(readFileSync('content/proposals/catalog-proposals.json', 'utf8')) as { devices: { id: string; label: string; realWorld: { category: string } }[] }
  const plan = JSON.parse(readFileSync('content/proposals/equipment-plan.json', 'utf8')) as { rows: { id: string; category: string }[] }
  /** The categories that belong in « Autres » on purpose. */
  const INTENDED_AUTRES = new Set(['signaling', 'patchbay', 'furniture'])

  it('every catalogue category, every proposal category and every plan category has a CATEGORY_TAB line (an unlisted one would silently land in « Autres » when promoted)', () => {
    const all = new Set([...CATALOG_CATEGORIES, ...proposalsFile.devices.map((d) => d.realWorld.category), ...plan.rows.map((r) => r.category)])
    const missing = [...all].filter((c) => !Object.prototype.hasOwnProperty.call(CATEGORY_TAB, c))
    expect(missing, `categories with no tab: ${missing.join(', ')}`).toEqual([])
    const autres = [...all].filter((c) => CATEGORY_TAB[c] === 'autres' && !INTENDED_AUTRES.has(c))
    expect(autres, `categories sent to « Autres » that nobody decided on: ${autres.join(', ')}`).toEqual([])
  })

  it('the nine categories that only exist as Bêta (amplifier, speaker, outboard, wireless, di-box, broadcast, headphones, recorder, measurement) each have a tab, and the three new tabs are fed', () => {
    for (const c of ['amplifier', 'speaker', 'outboard', 'wireless', 'di-box', 'broadcast', 'headphones', 'recorder', 'measurement']) expect(CATEGORY_TAB[c], c).toBeDefined()
    const targets = new Set(Object.values(CATEGORY_TAB))
    for (const tab of ['amplis', 'cables', 'pieds'] as const) expect(targets.has(tab), tab).toBe(true)
    expect(CATEGORY_TAB['amplifier']).toBe('amplis')
    expect(CATEGORY_TAB['di-box']).toBe('cables')
    expect(CATEGORY_TAB['stand-arm']).toBe('pieds')
  })

  it('every tab named by CATEGORY_TAB is a declared tab with a French label, and never « beta »', () => {
    for (const [c, tab] of Object.entries(CATEGORY_TAB)) {
      expect(DECLARED_ORDER, c).toContain(tab)
      expect(TAB_LABELS[tab], c).toMatch(/\S/)
      expect(tab, c).not.toBe('beta')
    }
  })

  it('no id is listed in two tabs, with the real proposals loaded next to the real catalogue (a promoted id leaves « Bêta » when it joins the catalogue)', () => {
    const r = inventory(registry, { proposals: proposalsFile.devices.map((d) => ({ deviceId: d.id, label: d.label })), modelIds: allModels })
    const seen = new Map<string, string>()
    for (const i of r.items) {
      expect(seen.has(i.deviceId), `${i.deviceId} is in ${seen.get(i.deviceId)} and ${i.tab}`).toBe(false)
      seen.set(i.deviceId, i.tab)
    }
    expect(r.items).toHaveLength(CATALOG_DEVICE_COUNT + proposalsFile.devices.filter((d) => !catalogDevices.some((c) => c.id === d.id)).length)
  })

  it('independent of the test helpers (finding 11): the registry holds exactly the devices[] of content/catalog.json read here, and every plan row flagged promoted has a device in it', () => {
    // The derived pins above read the catalogue through the same helper that built the registry, so a bug there would pass both. This one reads the file itself.
    const direct = JSON.parse(readFileSync('content/catalog.json', 'utf8')) as { devices: { id: string }[] }
    expect(registry.deviceById.size).toBe(direct.devices.length)
    expect(registry.catalog.devices).toHaveLength(direct.devices.length)
    expect([...registry.deviceById.keys()].sort()).toEqual(direct.devices.map((d) => d.id).sort())
    const rows = (JSON.parse(readFileSync('content/proposals/equipment-plan.json', 'utf8')) as { rows: { id: string; promoted?: boolean }[] }).rows
    const promoted = rows.filter((r) => r.promoted === true)
    for (const r of promoted) expect(registry.deviceById.has(r.id), `${r.id} is flagged promoted in the plan but is not in the catalogue`).toBe(true)
    for (const r of rows.filter((x) => x.promoted !== true)) expect(registry.deviceById.has(r.id), `${r.id} is in the catalogue but its plan row is not flagged promoted`).toBe(false)
  })

  it('the pinned counts are derived: the registry and the inventory agree with content/catalog.json, whatever it holds today', () => {
    expect(registry.catalog.devices).toHaveLength(CATALOG_DEVICE_COUNT)
    expect(new Set(registry.catalog.devices.map((d) => d.realWorld.category))).toEqual(CATALOG_CATEGORIES)
    expect(inventory(registry, none).items).toHaveLength(CATALOG_DEVICE_COUNT)
    const present = tabsPresent()
    expect(inventory(registry, none).tabs).toEqual(present)
    expect(present[present.length - 1]).toBe('autres')
  })
})
