/** The legend's data (Task 27 fix round 1): the unit tests have no DOM, so the rows and the toggle are pure data; the DOM is in the e2e. */
import { describe, expect, it } from 'vitest'
import { legendEntries } from '../../src/creation/cableStyle'
import { legendRows, toggleState } from '../../src/creation/shell/cableLegend'
import { SIGNAL_STYLE } from '../../src/creation/cableStyle'
import { SIGNAL_CABLE_TYPE } from '../../src/design/cablePalette'
import { CABLE_LINE } from '../../src/design/cablePattern'

describe('legendRows', () => {
  const rows = legendRows(legendEntries(['mains-power', 'mic-level']))
  it('every row draws its cable type’s pattern (the 2D sheet’s, the one the 3D cable has) and names its line (mission 3, cable cues)', () => {
    expect(rows[0]).toEqual({
      id: 'mains-power',
      label: 'Secteur 230 V',
      color: SIGNAL_STYLE['mains-power']!.color,
      dasharray: null,
      strokeWidth: 5,
      linecap: 'butt',
      ticks: [12, 24],
      note: 'trait épais à bagues',
    })
    expect(rows[1]).toEqual({ id: 'mic-level', label: 'Niveau micro', color: SIGNAL_STYLE['mic-level']!.color, dasharray: null, strokeWidth: 2.5, linecap: 'butt', ticks: [], note: 'trait plein' })
  })
  it('each signal’s swatch has its type’s dash, and signals of different line families get different samples and notes', () => {
    const all = legendRows(legendEntries(Object.keys(SIGNAL_CABLE_TYPE)))
    for (const r of all) {
      const t = SIGNAL_CABLE_TYPE[r.id]!
      expect(r.dasharray, r.id).toBe(CABLE_LINE[t].dash || null)
      expect(r.note, r.id).toBeTruthy()
    }
    const sample = (id: string) => {
      const r = all.find((x) => x.id === id)!
      return `${r.dasharray}|${r.strokeWidth}|${r.ticks.join(',')}|${r.note}`
    }
    const families = ['mic-level', 'line-level-consumer', 'speaker-level', 'aes3', 'aoip', 'wordclock', 'gpio-tally', 'mains-power', 'phantom-48v']
    expect(new Set(families.map(sample)).size).toBe(families.length)
    expect(all.find((r) => r.id === 'aoip')!.linecap).toBe('round') // beads
  })
  it('a signal the table does not know: a plain sample, no note', () => {
    expect(legendRows(legendEntries(['zzz']))[0]).toMatchObject({ dasharray: null, ticks: [], note: null })
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
