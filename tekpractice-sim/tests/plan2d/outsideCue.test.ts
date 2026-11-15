/**
 * Mission 3 fixes, item 1: the « hors de la salle » cue reads in every look of the 2D page. The page sits in `.cr-dialog`, where a design package re-points
 * --cr-nuit to its ground, --cr-panel to its surface (the footprint's fill) and --cr-danger to its danger role (src/design/packages.css); without a package
 * (a plain address) the shell's own tokens hold. The cue is drawn in --cr-danger only: graphic (the hatch and the edge) >= 3:1 on the ground and on the
 * footprint's fill (WCAG 1.4.11), the words >= 4.5:1 on the ground they sit on (WCAG 1.4.3, their halo is the ground). Never the fixed Ambre literal.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CREATION_TOKENS, contrastRatio } from '../../src/design/creationTokens'
import { packageById, type DesignId } from '../../src/design/packages'

const css = readFileSync(join(__dirname, '..', '..', 'src', 'plan2d', 'plan2d.css'), 'utf8')
const T = CREATION_TOKENS.color
const looks: { name: string; ground: string; surface: string; danger: string }[] = [
  { name: 'no package', ground: T.nuit, surface: T.panel, danger: T.danger },
  ...([1, 2, 3, 4, 5] as DesignId[]).map((id) => {
    const c = packageById(id).colours
    return { name: `design ${id}`, ground: c.ground, surface: c.surface, danger: c.danger }
  }),
]

describe('the outside-the-room cue (mission 3 fixes, item 1)', () => {
  it.each(looks)('$name: the hatch and the edge >= 3:1 on the ground and on the footprint fill; the words >= 4.5:1 on the ground', (l) => {
    expect(contrastRatio(l.danger, l.ground), 'graphic / ground').toBeGreaterThanOrEqual(3)
    expect(contrastRatio(l.danger, l.surface), 'graphic / footprint fill').toBeGreaterThanOrEqual(3)
    expect(contrastRatio(l.danger, l.ground), 'text / ground').toBeGreaterThanOrEqual(4.5)
  })

  it('design 2 (Nuit) and design 3 (Papier) are the two grounds the brief names: each has its own danger value', () => {
    expect(packageById(2).colours.ground.toUpperCase()).toBe(T.nuit.toUpperCase())
    expect(packageById(3).colours.ground.toUpperCase()).toBe(T.papier.toUpperCase())
    expect(packageById(3).colours.danger).not.toBe(packageById(2).colours.danger)
  })

  it('the cue takes the danger role in the stylesheet, never a fixed colour (no hex, no Ambre)', () => {
    const rules = css.split('\n').filter((l) => /p2d-out-(hatch|edge|label)/.test(l) && l.includes('{'))
    expect(rules.length).toBeGreaterThanOrEqual(3)
    for (const r of rules) {
      expect(r, r).not.toMatch(/#[0-9a-f]{3,8}\b/i)
      expect(r, r).not.toMatch(/ambre/i)
    }
    expect(rules.filter((r) => r.includes('var(--cr-danger)'))).toHaveLength(3)
  })
})
