import { describe, expect, it } from 'vitest'
import { CREATION_TOKENS, contrastRatio } from '../../src/design/creationTokens'

const C = CREATION_TOKENS.color

describe('creation tokens (brief §2, P11)', () => {
  it('the four brand colours are exact', () => {
    expect(C.nuit).toBe('#131114')
    expect(C.papier).toBe('#F3EDE3')
    expect(C.ambre).toBe('#DD9349')
    expect(C.prune).toBe('#612D45')
  })
  it('contrastRatio follows WCAG (black on white = 21, same colour = 1)', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#131114', '#131114')).toBeCloseTo(1, 5)
  })
  it('text pairs pass 4.5:1', () => {
    expect(contrastRatio(C.papier, C.nuit)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(C.papier, C.panel)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(C.inkMuted, C.panel)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(C.inkMuted, C.nuit)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(C.danger, C.panel)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(C.ok, C.panel)).toBeGreaterThanOrEqual(4.5)
    // Ambre as text (active menu, shortcuts) and Nuit on an Ambre fill (selected item)
    expect(contrastRatio(C.ambre, C.panel)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(C.nuit, C.ambre)).toBeGreaterThanOrEqual(4.5)
  })
  it('Ambre on Nuit ≥ 3:1 (focus ring, selection)', () => {
    expect(contrastRatio(C.ambre, C.nuit)).toBeGreaterThanOrEqual(3)
  })
  it('every colour is a 7-char hex', () => {
    for (const v of Object.values(C)) expect(v).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
  it('fonts and sizes', () => {
    expect(CREATION_TOKENS.font.title).toMatch(/^'Tektur'/)
    expect(CREATION_TOKENS.font.ui).toMatch(/^'IBM Plex Sans'/)
    expect(CREATION_TOKENS.size).toEqual({ menubar: 32, status: 28, tree: 200, props: 260, rail: 32 })
    expect(CREATION_TOKENS.motion).toEqual({ drawerMs: 180, flyMs: 450 })
  })
  it('no radius token exists (square corners)', () => {
    expect(JSON.stringify(CREATION_TOKENS)).not.toMatch(/radius/i)
  })
})
