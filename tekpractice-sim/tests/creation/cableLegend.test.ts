/** The legend's data (Task 27 fix round 1): the unit tests have no DOM, so the rows and the toggle are pure data; the DOM is in the e2e. */
import { describe, expect, it } from 'vitest'
import { legendEntries } from '../../src/creation/cableStyle'
import { DASH_PATTERN, legendRows, toggleState } from '../../src/creation/shell/cableLegend'
import { SIGNAL_STYLE } from '../../src/creation/cableStyle'

describe('legendRows', () => {
  const rows = legendRows(legendEntries(['mains-power', 'mic-level']))
  it('a dashed signal has a dash pattern on its stroke sample AND the « pointillés » note; a solid one has neither', () => {
    expect(rows[0]).toEqual({ id: 'mains-power', label: 'Secteur 230 V', color: SIGNAL_STYLE['mains-power']!.color, dasharray: DASH_PATTERN, note: 'pointillés' })
    expect(rows[1]).toEqual({ id: 'mic-level', label: 'Niveau micro', color: SIGNAL_STYLE['mic-level']!.color, dasharray: null, note: null })
    expect(DASH_PATTERN).toMatch(/^\d+ \d+$/)
  })
  it('keeps the order given and the French name of every row', () => {
    expect(rows.map((r) => r.id)).toEqual(['mains-power', 'mic-level'])
    for (const r of rows) expect(r.label.length).toBeGreaterThan(0)
  })
  it('no entry, no row (the block hides)', () => {
    expect(legendRows([])).toEqual([])
  })
})

describe('toggleState', () => {
  it('open: aria-expanded true, named « Replier… », list shown', () => {
    expect(toggleState(true)).toEqual({ expanded: 'true', name: 'Replier la légende des câbles', listHidden: false })
  })
  it('folded: aria-expanded false, named « Déplier… », list hidden', () => {
    expect(toggleState(false)).toEqual({ expanded: 'false', name: 'Déplier la légende des câbles', listHidden: true })
  })
})
