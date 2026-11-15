import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import { CREATION_TOKENS, contrastRatio } from '../../src/design/creationTokens'
import { CABLE_STYLES, CABLE_TYPES, SIGNAL_CABLE_TYPE, arrowOf, cableTypeOf, portCableType, styleOf, tagOf } from '../../src/plan2d/cableStyle2d'

const registry = loadCatalog(catalogJson)
const { nuit, papier } = CREATION_TOKENS.color

describe('the sheet’s table as data (2D schema colour and symbol sheet, table (a))', () => {
  it('has the nine drawable rows of the sheet, with its exact colours, dashes and widths', () => {
    expect(CABLE_TYPES).toEqual(['analog-bal', 'analog-unbal', 'speaker', 'digital', 'network', 'clock', 'control', 'mains', 'dc'])
    const row = (t: string) => {
      const s = styleOf(t as never)
      return [s.colour, s.dash, s.width, s.glyph]
    }
    expect(row('analog-bal')).toEqual(['#2B7BC2', '', 2, 'arrow'])
    expect(row('analog-unbal')).toEqual(['#2B7BC2', '', 1.5, 'arrow'])
    expect(row('speaker')).toEqual(['#D55E00', '', 4, 'arrow'])
    expect(row('digital')).toEqual(['#B5659A', '8 4', 2.5, 'arrow'])
    expect(row('network')).toEqual(['#00946A', '0 6', 3, 'double-arrow'])
    expect(row('clock')).toEqual(['#737A87', '8 3 2 3', 1.5, 'clock'])
    expect(row('control')).toEqual(['#737A87', '10 4', 1.5, 'arrow'])
    expect(row('mains')).toEqual(['#8A5A2B', '', 4.5, 'lightning'])
    expect(row('dc')).toEqual(['#8A5A2B', '3 3', 2, 'arrow'])
  })

  it('keeps the sheet’s confidence: the meaning of every hue is OUR PROPOSAL', () => {
    for (const s of CABLE_STYLES) expect(s.confidence, s.type).toBe('OUR PROPOSAL')
  })

  it('every colour is at least 3:1 against Nuit and against Papier (WCAG 1.4.11), with the sheet’s check numbers', () => {
    for (const s of CABLE_STYLES) {
      expect(contrastRatio(s.colour, nuit), `${s.type} on Nuit`).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(s.colour, papier), `${s.type} on Papier`).toBeGreaterThanOrEqual(3)
    }
    expect(contrastRatio('#8A5A2B', nuit)).toBeCloseTo(3.2, 1)
    expect(contrastRatio('#D55E00', papier)).toBeCloseTo(3.32, 1)
  })

  it('colour is never the only cue: each type has its own line pattern (dash, width, glyph) and a text tag; types sharing a colour differ by the line itself', () => {
    const keys = CABLE_STYLES.map((s) => `${s.dash}|${s.width}|${s.glyph}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const a of CABLE_STYLES)
      for (const b of CABLE_STYLES) if (a !== b && a.colour === b.colour) expect(`${a.dash}|${a.width}`, `${a.type} vs ${b.type}`).not.toBe(`${b.dash}|${b.width}`)
    for (const s of CABLE_STYLES) expect(s.tag.length, s.type).toBeGreaterThan(0)
  })
})

describe('the cable type is derived from the ports, never typed', () => {
  it('every signal type of the catalogue has its cable type (no fallback hides a new one)', () => {
    for (const s of registry.catalog.signalTypes) expect(SIGNAL_CABLE_TYPE[s.id], s.id).toBeDefined()
  })

  it('every port of every catalogue device yields a styled type', () => {
    for (const d of registry.catalog.devices)
      for (const p of d.ports) expect(CABLE_TYPES, `${d.id}.${p.portId}`).toContain(portCableType(p))
  })

  it('balanced unless the connector or the flag says unbalanced; mains on a DC barrel is DC', () => {
    expect(portCableType({ signal: 'line-level-pro', connector: 'xlr3-m' })).toBe('analog-bal')
    expect(portCableType({ signal: 'line-level-pro', connector: 'rca' })).toBe('analog-unbal')
    expect(portCableType({ signal: 'mic-level', connector: 'xlr3-f', flags: ['isUnbalanced'] })).toBe('analog-unbal')
    expect(portCableType({ signal: 'speaker-level', connector: 'speakon-nl4' })).toBe('speaker')
    expect(portCableType({ signal: 'mains-power', connector: 'iec-c14' })).toBe('mains')
    expect(portCableType({ signal: 'mains-power', connector: 'dc-barrel' })).toBe('dc')
    expect(portCableType({ signal: 'aoip', connector: 'rj45' })).toBe('network')
    expect(portCableType({ signal: 'wordclock', connector: 'bnc' })).toBe('clock')
  })

  it('two different ends take the one higher in the order mains, speaker, dc, network, digital, clock, control, unbalanced, balanced', () => {
    expect(cableTypeOf({ signal: 'mic-level', connector: 'xlr3-m' }, { signal: 'instrument-hiz', connector: 'ts-quarter' })).toBe('analog-unbal')
    expect(cableTypeOf({ signal: 'line-level-pro', connector: 'xlr3-m' }, { signal: 'line-level-pro', connector: 'xlr3-f' })).toBe('analog-bal')
  })

  it('a short tag names the format when the signal says it, else the family', () => {
    expect(tagOf('digital', 'aes3')).toBe('AES3')
    expect(tagOf('digital', 'madi')).toBe('MADI')
    expect(tagOf('speaker', 'speaker-level')).toBe('HP')
    expect(tagOf('analog-unbal', 'line-level-consumer')).toBe(styleOf('analog-unbal').tag)
  })

  it('the arrow points from the output to the input; network is drawn both ways; otherwise from the first end to the second', () => {
    expect(arrowOf('analog-bal', 'out', 'in')).toBe('to-b')
    expect(arrowOf('analog-bal', 'in', 'out')).toBe('to-a')
    expect(arrowOf('network', 'bidir', 'bidir')).toBe('both')
    expect(arrowOf('control', 'bidir', 'bidir')).toBe('to-b')
  })
})
