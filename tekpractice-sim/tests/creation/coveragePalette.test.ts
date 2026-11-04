/**
 * Task 37 (C13): the locked 8-colour scale of the coverage dots on Nuit. Every constraint of tools/coverage-palette-search.mjs is re-checked here,
 * independently (own luminance, own Machado matrices), so the committed constants cannot drift from what the search promised.
 */
import { describe, expect, it } from 'vitest'
import { COVERAGE_PALETTE, binColor, hexToRgb01 } from '../../src/creation/coveragePalette'
import { CREATION_TOKENS, contrastRatio } from '../../src/design/creationTokens'
import { scaleBin } from '../../src/acoustics/scale'

/** Machado, Oliveira, Fernandes (2009), severity 1.0, applied to linear RGB. */
const MACHADO = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
} as const
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
const lin = (c: number): number => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gam = (v: number): number => {
  v = Math.min(1, Math.max(0, v))
  return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)
}
const lum = (hex: string): number => {
  const [r, g, b] = rgb(hex).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const simulate = (m: readonly (readonly number[])[], hex: string): number[] => {
  const l = rgb(hex).map(lin)
  return m.map((row) => gam(row[0] * l[0] + row[1] * l[1] + row[2] * l[2]))
}
const dist = (a: number[], b: number[]): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const hue = (hex: string): number => {
  const [r, g, b] = rgb(hex).map((v) => v / 255)
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const d = mx - mn
  const h = (mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60
  return h < 0 ? h + 360 : h
}

describe('the coverage palette', () => {
  const T = CREATION_TOKENS.color
  it('has 8 colours, one per 3 dB bin, all distinct well-formed hex values', () => {
    expect(COVERAGE_PALETTE).toHaveLength(8)
    for (const c of COVERAGE_PALETTE) expect(c).toMatch(/^#[0-9A-F]{6}$/)
    expect(new Set(COVERAGE_PALETTE).size).toBe(8)
  })
  it('every colour has a contrast >= 3:1 against Nuit (the 3D background) AND against the panel colour (the legend swatches)', () => {
    for (const [i, c] of COVERAGE_PALETTE.entries()) {
      expect(contrastRatio(c, T.nuit), `bin ${i} vs Nuit`).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(c, T.panel), `bin ${i} vs panel`).toBeGreaterThanOrEqual(3)
    }
  })
  it('is a sequential scale: relative luminance falls bin by bin (the order reads in greys), by at least 0.035 each', () => {
    for (let i = 0; i < 7; i++) expect(lum(COVERAGE_PALETTE[i]) - lum(COVERAGE_PALETTE[i + 1]), `bin ${i} vs ${i + 1}`).toBeGreaterThanOrEqual(0.035)
  })
  it('is one ordered ramp: the hue falls bin by bin, from yellow (bin 0) to violet (bin 7)', () => {
    for (let i = 0; i < 7; i++) expect(hue(COVERAGE_PALETTE[i + 1]) - hue(COVERAGE_PALETTE[i]), `bin ${i} → ${i + 1}`).toBeGreaterThanOrEqual(12)
    expect(hue(COVERAGE_PALETTE[0])).toBeLessThan(80)
    expect(hue(COVERAGE_PALETTE[7])).toBeGreaterThan(250)
  })
  it('stays apart for colour-blind users: every pair is >= 30 apart (RGB distance) under simulated protanopia, deuteranopia and tritanopia (and normal vision)', () => {
    const views = (c: string): number[][] => [rgb(c), ...Object.values(MACHADO).map((m) => simulate(m, c))]
    let worst = Infinity
    for (let i = 0; i < 8; i++)
      for (let j = i + 1; j < 8; j++) {
        const a = views(COVERAGE_PALETTE[i])
        const b = views(COVERAGE_PALETTE[j])
        for (let k = 0; k < 4; k++) worst = Math.min(worst, dist(a[k], b[k]))
      }
    expect(worst).toBeGreaterThanOrEqual(30)
  })
  it('no colour reads as the selection (Ambre) or the aim lines (Papier): >= 60 apart', () => {
    for (const c of COVERAGE_PALETTE) {
      expect(dist(rgb(c), rgb(T.ambre))).toBeGreaterThanOrEqual(60)
      expect(dist(rgb(c), rgb(T.papier))).toBeGreaterThanOrEqual(60)
    }
  })
})

describe('binColor and hexToRgb01', () => {
  it('is the palette at the scale bin: 0 dB → bin 0, −3 → 1, −24 and below → 7, silence → 7', () => {
    expect(binColor(0)).toBe(COVERAGE_PALETTE[0])
    expect(binColor(-2.99)).toBe(COVERAGE_PALETTE[0])
    expect(binColor(-3)).toBe(COVERAGE_PALETTE[1])
    expect(binColor(-23.9)).toBe(COVERAGE_PALETTE[7])
    expect(binColor(-40)).toBe(COVERAGE_PALETTE[7])
    expect(binColor(-Infinity)).toBe(COVERAGE_PALETTE[7])
    for (const rel of [0, -4, -8, -13, -17, -19.5, -22, -30]) expect(binColor(rel)).toBe(COVERAGE_PALETTE[scaleBin(rel)])
  })
  it('converts to 0..1 floats', () => {
    expect(hexToRgb01('#FF8000')).toEqual([1, 128 / 255, 0])
    expect(hexToRgb01('#000000')).toEqual([0, 0, 0])
  })
})
