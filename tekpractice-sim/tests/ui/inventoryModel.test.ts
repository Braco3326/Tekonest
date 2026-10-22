import { describe, expect, it } from 'vitest'
import { buildInventoryModel, normalize, type InventoryDevice, type KbSheets } from '../../src/ui/inventoryModel'

const devices: InventoryDevice[] = [
  { id: 'shure-sm58', label: 'Shure SM58', realWorld: { brand: 'Shure', model: 'SM58', category: 'microphone' } },
  { id: 'neumann-u87-ai', label: 'Neumann U 87 Ai', realWorld: { brand: 'Neumann', model: 'U 87 Ai', category: 'microphone' } },
  { id: 'yamaha-ql1', label: 'Yamaha QL1', realWorld: { brand: 'Yamaha', model: 'QL1', category: 'console' } },
  { id: 'playout-pc', label: 'PC de diffusion', realWorld: { brand: 'Générique', model: 'Playout', category: 'computer' } },
]

const sheets: KbSheets = {
  categories: { microphones: 'Microphones', consoles: 'Consoles de mixage' },
  devices: {
    'shure-sm58': {
      kbId: 'shure-sm58', brand: 'Shure', model: 'SM58', category: 'microphones', subType: 'dynamic-moving-coil',
      keySpecs: [['polar pattern', 'cardioid']], connectors: ['xlr3-m'], manualUrl: 'https://example.com/sm58', productUrl: null, manualLanguages: ['en'],
    },
    'neumann-u87-ai': {
      kbId: 'neumann-u87-ai', brand: 'Neumann', model: 'U 87 Ai', category: 'microphones', subType: 'condenser-large-diaphragm',
      keySpecs: [], connectors: ['xlr3-m'], manualUrl: null, productUrl: null, manualLanguages: [],
    },
    'yamaha-ql1': {
      kbId: 'yamaha-ql1', brand: 'Yamaha', model: 'QL1', category: 'consoles', subType: 'digital-live',
      keySpecs: [], connectors: ['ethercon'], manualUrl: null, productUrl: null, manualLanguages: [],
    },
  },
}

describe('inventory model', () => {
  it('groups catalog devices by KB taxonomy category, French labels, sorted', () => {
    const m = buildInventoryModel(devices, sheets, '', true)
    expect(m.groups.map((g) => g.label)).toEqual(['Computer', 'Consoles de mixage', 'Microphones'])
    expect(m.groups.find((g) => g.categoryId === 'microphones')!.items.map((i) => i.id)).toEqual([
      'neumann-u87-ai',
      'shure-sm58',
    ])
    expect(m.total).toBe(4)
  })

  it('falls back to the catalog realWorld.category when no KB sheet exists', () => {
    const m = buildInventoryModel(devices, sheets, '', true)
    const pc = m.groups.find((g) => g.categoryId === 'computer')!
    expect(pc.items[0].sheet).toBeNull()
  })

  it('searches label, brand, model and category, ignoring case and accents', () => {
    expect(buildInventoryModel(devices, sheets, 'neum', true).total).toBe(1)
    expect(buildInventoryModel(devices, sheets, 'CONSOLE', true).total).toBe(1)
    expect(buildInventoryModel(devices, sheets, 'generique', true).total).toBe(1)
    expect(buildInventoryModel(devices, sheets, 'micro', true).total).toBe(2)
    const none = buildInventoryModel(devices, sheets, 'zzz', true)
    expect(none.total).toBe(0)
    expect(none.groups).toEqual([])
  })

  it('carries the placement gate (Sandbox only)', () => {
    expect(buildInventoryModel(devices, sheets, '', false).placementAllowed).toBe(false)
  })

  it('normalizes accents and case', () => {
    expect(normalize('Générique ÉCRAN')).toBe('generique ecran')
  })
})
