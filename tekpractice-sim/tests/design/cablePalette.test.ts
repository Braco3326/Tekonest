/**
 * Mission 3 fixes, item 2: ONE cable palette for the 2D page and the 3D view (review finding C: the mic cable was yellow in 3D, blue in 2D). The colour of
 * each cable type is the « 2D schema - colour and symbol sheet » (2026-11-15) value, in one pure module (no DOM, no Babylon) that the 2D styles and the 3D
 * cable colours both read, so changing a colour there changes both. The line pattern stays a 2D concern; the 3D tube, its glow and its dash stay as they were.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { CABLE_TYPE_COLOUR, SIGNAL_CABLE_TYPE, signalColour } from '../../src/design/cablePalette'
import { CABLE_STYLES, SIGNAL_CABLE_TYPE as SIGNAL_CABLE_TYPE_2D } from '../../src/plan2d/cableStyle2d'
import { SIGNAL_STYLE, cableColor, legendEntries } from '../../src/creation/cableStyle'
import { CREATION_TOKENS, contrastRatio } from '../../src/design/creationTokens'
import { packageById } from '../../src/design/packages'

const ROOT = join(__dirname, '..', '..')
const catalogSignals: string[] = (catalogJson as { signalTypes: { id: string }[] }).signalTypes.map((s) => s.id)

describe('the shared cable palette (src/design/cablePalette.ts)', () => {
  it('is the sheet, value for value (table a): never changed here', () => {
    expect(CABLE_TYPE_COLOUR).toEqual({
      'analog-bal': '#2B7BC2',
      'analog-unbal': '#2B7BC2',
      speaker: '#D55E00',
      digital: '#B5659A',
      network: '#00946A',
      clock: '#737A87',
      control: '#737A87',
      mains: '#8A5A2B',
      dc: '#8A5A2B',
    })
  })

  it('is pure: no DOM, no Babylon, no import at all', () => {
    const src = readFileSync(join(ROOT, 'src', 'design', 'cablePalette.ts'), 'utf8')
    expect(src).not.toMatch(/^\s*import\s/m)
    expect(src).not.toMatch(/document|window|@babylonjs/)
  })

  it('every catalogue signal has a cable type (a new signal fails here until the sheet places it); the 2D page reads the same table', () => {
    expect(Object.keys(SIGNAL_CABLE_TYPE).sort()).toEqual([...catalogSignals].sort())
    expect(SIGNAL_CABLE_TYPE_2D).toBe(SIGNAL_CABLE_TYPE)
  })

  it('signalColour: the colour of the signal’s cable type; null for a signal the sheet does not place', () => {
    expect(signalColour('mic-level')).toBe('#2B7BC2')
    expect(signalColour('speaker-level')).toBe('#D55E00')
    expect(signalColour('mains-power')).toBe('#8A5A2B')
    expect(signalColour('not-in-the-catalog')).toBeNull()
  })
})

describe('contrast of the sheet colours where the 3D side draws them (REPORTED, never fixed by changing the sheet)', () => {
  const colours = [...new Set(Object.values(CABLE_TYPE_COLOUR))]
  const S = CREATION_TOKENS.scene
  const under = (bg: string): string[] => colours.filter((c) => contrastRatio(c, bg) < 3)
  it('the sheet’s own claim holds: every colour >= 3:1 on Nuit and on Papier', () => {
    expect(under(CREATION_TOKENS.color.nuit)).toEqual([])
    expect(under(CREATION_TOKENS.color.papier)).toEqual([])
  })
  it('the light set floors (every content/environments floor) take every colour at >= 3:1', () => {
    for (const f of ['#FCFCFD', '#F9FBFC', '#FDFCFA', '#FCFBFA', '#FBFCFD', '#FBF9F6']) expect(under(f), f).toEqual([])
  })
  it('pairs under 3:1 (pinned so a change is seen): the dark room floor, the raised deck, the legend’s panel, design 5’s Prune surface', () => {
    expect(under(S.floor)).toEqual(['#8A5A2B']) // brown 2.45 on the room floor #2E2830
    expect(under(S.zoneFill)).toEqual(['#2B7BC2', '#737A87', '#8A5A2B']) // blue 2.77, grey 2.86, brown 2.11 on the deck #3A323B
    expect(under(CREATION_TOKENS.color.panel)).toEqual(['#8A5A2B']) // brown 2.97 on the legend's panel #1C191D
    expect(under(packageById(5).colours.surface)).toEqual(colours) // all six (1.82 to 2.76) on design 5's Prune legend surface #612D45
    expect(under(packageById(3).colours.surface)).toEqual([]) // design 3's Papier legend surface: all >= 3.31
  })
})

describe('both pages read it', () => {
  it('2D: every cable style’s colour is the shared one', () => {
    for (const s of CABLE_STYLES) expect(s.colour, s.type).toBe(CABLE_TYPE_COLOUR[s.type])
  })

  it('3D: every signal’s cable colour, its style and its legend row are the shared colour of its cable type (the mic cable is blue in both)', () => {
    for (const id of catalogSignals) {
      const want = CABLE_TYPE_COLOUR[SIGNAL_CABLE_TYPE[id]!]
      expect(cableColor(id), id).toBe(want)
      expect(SIGNAL_STYLE[id]!.color, id).toBe(want)
      expect(legendEntries([id])[0]!.color, id).toBe(want)
    }
    expect(cableColor('mic-level')).toBe(CABLE_STYLES.find((s) => s.type === 'analog-bal')!.colour)
  })

  it('a cable joins two ports of the SAME signal (engine rule R2), so the 3D colour by signal and the 2D colour by both ends are the same colour for every cable', () => {
    // the 2D type also reads the connector (balanced / unbalanced, mains / DC), but those pairs share a colour on the sheet
    expect(CABLE_TYPE_COLOUR['analog-bal']).toBe(CABLE_TYPE_COLOUR['analog-unbal'])
    expect(CABLE_TYPE_COLOUR.mains).toBe(CABLE_TYPE_COLOUR.dc)
    expect(CABLE_TYPE_COLOUR.clock).toBe(CABLE_TYPE_COLOUR.control)
  })

  it('no other file of the 3D side holds a cable-type colour of its own (the old per-signal table is gone)', () => {
    const src = readFileSync(join(ROOT, 'src', 'creation', 'cableStyle.ts'), 'utf8')
    expect(src).not.toMatch(/'#[0-9A-F]{6}'\]/i) // no « ['mic-level', '#E9DC7D'] » rows
    for (const old of ['#E9DC7D', '#80BCFE', '#F38AC9', '#F8093E']) expect(src.toUpperCase(), old).not.toContain(old)
  })
})
