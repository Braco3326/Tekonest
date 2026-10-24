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
  it('Task 14b: every scene token exists and is a 7-char hex', () => {
    const S = CREATION_TOKENS.scene
    const keys = ['floor', 'gridMinor', 'gridMajor', 'wall', 'ceiling', 'zoneFill', 'zoneEdge', 'deviceBody', 'accentMixing', 'accentSource', 'accentSpeaker', 'accentInfra', 'portIn', 'portOut', 'portBidir', 'labelInk', 'labelBg', 'shadow', 'selection', 'hover']
    for (const k of keys) expect(S[k as keyof typeof S], k).toMatch(/^#[0-9A-Fa-f]{6}$/)
    const L = CREATION_TOKENS.light
    expect(L.fillSky).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(L.fillGround).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(L.keyColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
    for (const v of [L.fill, L.key, L.shadowAlpha, L.portGlow]) expect(v).toBeGreaterThan(0)
  })
  it('Task 14b: scene contrast (dark, low-saturation, devices and ports stand out)', () => {
    const S = CREATION_TOKENS.scene
    expect(contrastRatio(S.floor, C.nuit)).toBeGreaterThanOrEqual(1.3)
    expect(contrastRatio(S.deviceBody, S.floor)).toBeGreaterThanOrEqual(2)
    for (const p of [S.portIn, S.portOut, S.portBidir]) {
      expect(contrastRatio(p, S.deviceBody)).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(p, S.floor)).toBeGreaterThanOrEqual(3)
    }
    // text drawn in the scene: label ink on its card and on the floor
    expect(contrastRatio(S.labelInk, S.labelBg)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(S.labelInk, S.floor)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(S.zoneEdge, S.zoneFill)).toBeGreaterThanOrEqual(2.5)
    // selection = the shell's Ambre, readable on the floor, distinguishable from hover
    expect(S.selection).toBe(C.ambre)
    expect(contrastRatio(S.selection, S.floor)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(S.hover, S.floor)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(S.selection, S.hover)).toBeGreaterThanOrEqual(1.5)
  })
  it('no radius token exists (square corners)', () => {
    expect(JSON.stringify(CREATION_TOKENS)).not.toMatch(/radius/i)
  })
})
