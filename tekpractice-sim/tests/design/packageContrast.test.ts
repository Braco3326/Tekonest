/**
 * T4.1 (spec 7.3): every declared colour pair of every package is computed, never asserted by hand. Text pairs >= 4.5, UI pairs >= 3 (WCAG 2.1, `contrastRatio`).
 * The Ambre-on-Papier pair (2.16) is the one the spec bans, as text and as a UI boundary: a crafted pair of that kind must FAIL, which proves the checker bites.
 */
import { describe, expect, it } from 'vitest'
import { CREATION_TOKENS, contrastRatio } from '../../src/design/creationTokens'
import { DESIGN_IDS, packageById, type Hex } from '../../src/design/packages'
import { TEXT_MIN, UI_MIN, declaredPairs, pairPasses, type DeclaredPair } from '../../src/design/packageContrast'

const C = CREATION_TOKENS.color

describe('the checker', () => {
  it('thresholds are the WCAG ones', () => {
    expect(TEXT_MIN).toBe(4.5)
    expect(UI_MIN).toBe(3)
  })

  it('a crafted Ambre-on-Papier TEXT pair fails (2.16 : 1)', () => {
    const bad: DeclaredPair = { role: 'crafted', fg: C.ambre as Hex, bg: C.papier as Hex, kind: 'text', where: 'test' }
    expect(contrastRatio(bad.fg, bad.bg)).toBeCloseTo(2.16, 1)
    expect(pairPasses(bad)).toBe(false)
  })

  it('a crafted Ambre-on-Papier UI pair (a border, an outline) fails too', () => {
    expect(pairPasses({ role: 'crafted', fg: C.ambre as Hex, bg: C.papier as Hex, kind: 'ui', where: 'test' })).toBe(false)
  })

  it('a crafted Ambre-on-Prune TEXT pair fails (4.24 : 1: UI and large text only) while the UI pair passes', () => {
    expect(pairPasses({ role: 'crafted', fg: C.ambre as Hex, bg: C.prune as Hex, kind: 'text', where: 'test' })).toBe(false)
    expect(pairPasses({ role: 'crafted', fg: C.ambre as Hex, bg: C.prune as Hex, kind: 'ui', where: 'test' })).toBe(true)
  })

  it('good pairs pass: Papier on Nuit, Nuit on Ambre, Prune on Papier', () => {
    for (const [fg, bg] of [[C.papier, C.nuit], [C.nuit, C.ambre], [C.prune, C.papier]] as const) expect(pairPasses({ role: 'x', fg: fg as Hex, bg: bg as Hex, kind: 'text', where: 'test' })).toBe(true)
  })
})

describe('declared pairs of the five packages', () => {
  for (const id of DESIGN_IDS) {
    const pkg = packageById(id)
    const pairs = declaredPairs(pkg.colours)

    it(`package ${id}: it declares text and UI pairs (not an empty list that passes by default)`, () => {
      expect(pairs.filter((p) => p.kind === 'text').length).toBeGreaterThanOrEqual(10)
      expect(pairs.filter((p) => p.kind === 'ui').length).toBeGreaterThanOrEqual(6)
    })

    it(`package ${id}: every declared text pair >= 4.5 and every UI pair >= 3`, () => {
      const failing = pairs.filter((p) => !pairPasses(p)).map((p) => `${p.role} ${p.fg} on ${p.bg} (${p.where}) = ${contrastRatio(p.fg, p.bg).toFixed(2)} < ${p.kind === 'text' ? TEXT_MIN : UI_MIN}`)
      expect(failing).toEqual([])
    })

    it(`package ${id}: no declared pair is Ambre on Papier, as text or as a boundary`, () => {
      expect(pairs.filter((p) => p.fg.toUpperCase() === C.ambre && p.bg.toUpperCase() === C.papier)).toEqual([])
    })
  }

  it('package 3 (Papier sheets): focus is Nuit, selection and text accents are Prune, the Ambre fill carries a Nuit edge', () => {
    const c = packageById(3).colours
    expect(c.focus).toBe(C.nuit)
    expect(c.select).toBe(C.prune)
    expect(c.accentText).toBe(C.prune)
    expect(c.accentEdge).toBe(C.nuit)
    expect(c.accent).toBe(C.ambre)
    expect(c.accentInk).toBe(C.nuit)
  })

  it('Prune share (spec 7.2): package 4 has none as a surface or a band, package 5 has Prune panels and bands, package 3 only as ink and selection', () => {
    expect(packageById(4).colours.band).not.toBe(C.prune)
    expect(packageById(4).colours.surface).not.toBe(C.prune)
    expect(packageById(5).colours.surface).toBe(C.prune)
    expect(packageById(5).colours.band).toBe(C.prune)
    expect(packageById(2).colours.band).toBe(C.prune)
    expect(packageById(3).colours.surface).toBe(C.papier)
    expect(packageById(3).colours.band).not.toBe(C.prune)
  })
})
