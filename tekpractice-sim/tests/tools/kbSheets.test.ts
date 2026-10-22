import { describe, expect, it } from 'vitest'
import { toSheet } from '../../tools/build-kb-sheets'

const base = {
  id: 'shure-sm58',
  brand: 'Shure',
  model: 'SM58',
  category: 'microphones',
  sub_type: 'dynamic-moving-coil',
  key_specs: { polar_pattern: ['cardioid'], sensitivity: 'not found', weight: '298 g' },
  manual_url: 'https://www.shure.com/en-US/docs/guide/SM58',
  product_page_url: 'not found',
  manual_languages: ['en'],
}

describe('KB → inventory sheet', () => {
  it('turns KB connector objects into readable strings', () => {
    const s = toSheet({
      ...base,
      connectors: [
        { connector: 'xlr3-m', role: 'mic output', dir: 'out', signal: 'mic-level', count: 1 },
        { connector: 'rj45', count: 2 },
      ],
    })
    expect(s.connectors).toEqual(['xlr3-m — mic output', 'rj45 ×2'])
    expect(s.connectors.every((c) => typeof c === 'string')).toBe(true)
  })

  it('keeps plain string connectors, drops "not found" specs and non-URL links', () => {
    const s = toSheet({ ...base, connectors: ['xlr3-m'] })
    expect(s.connectors).toEqual(['xlr3-m'])
    expect(s.keySpecs).toEqual([
      ['polar pattern', 'cardioid'],
      ['weight', '298 g'],
    ])
    expect(s.productUrl).toBeNull()
    expect(s.manualUrl).toMatch(/^https:/)
  })
})
