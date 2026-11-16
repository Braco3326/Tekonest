/** Mission 3, cable cues: ONE line pattern per cable type, read by the 2D page and the 3D view (src/design/cablePattern.ts). */
import { describe, expect, it } from 'vitest'
import { CABLE_TYPE_COLOUR, SIGNAL_CABLE_TYPE, type CableType } from '../../src/design/cablePalette'
import { CABLE_LINE, LINE_PX_M, MARK_EVERY_M, PERIOD_MIN, PIECE_MAX, cue3dOf, cueLayout, cueSwatch } from '../../src/design/cablePattern'
import { CABLE_STYLES, CABLE_TYPES } from '../../src/plan2d/cableStyle2d'
import { SIGNAL_STYLE, cableCue } from '../../src/creation/cableStyle'

const TYPES = Object.keys(CABLE_TYPE_COLOUR) as CableType[]
const key3d = (t: CableType): string => {
  const c = cue3dOf(t)
  return `${c.runs?.map((r) => r.toFixed(4)).join(' ') ?? 'solid'}|${c.markEveryM ?? '-'}`
}

describe('the pattern table (one source for 2D and 3D)', () => {
  it('every cable type has a line on the sheet and a 3D cue', () => {
    expect(Object.keys(CABLE_LINE).sort()).toEqual([...TYPES].sort())
    expect([...CABLE_TYPES].sort()).toEqual([...TYPES].sort())
    for (const t of TYPES) {
      expect(CABLE_LINE[t].width, t).toBeGreaterThan(0)
      expect(cue3dOf(t).radiusM, t).toBeGreaterThan(0.005)
      expect(cue3dOf(t).radiusM, t).toBeLessThan(0.025)
    }
  })

  it('the 2D page draws exactly this table (dash and width of every row)', () => {
    for (const s of CABLE_STYLES) {
      expect(s.dash, s.type).toBe(CABLE_LINE[s.type].dash)
      expect(s.width, s.type).toBe(CABLE_LINE[s.type].width)
    }
  })

  it('the 3D cue IS the 2D table: dashes in metres (1 px = 1 cm), the widths in order, the mains glyph as collars', () => {
    for (const t of TYPES) {
      const want = CABLE_LINE[t].dash ? CABLE_LINE[t].dash.split(' ').map((n) => Number(n) * LINE_PX_M) : null
      const got = cue3dOf(t).runs
      if (want === null) expect(got, t).toBeNull()
      else want.forEach((w, i) => expect(got![i], `${t} run ${i}`).toBeCloseTo(w, 9))
      expect(cue3dOf(t).markEveryM !== null, t).toBe(CABLE_LINE[t].mark === 'lightning')
    }
    // a wider line on the sheet is a thicker tube in 3D (same order)
    for (const a of TYPES) for (const b of TYPES) if (CABLE_LINE[a].width > CABLE_LINE[b].width) expect(cue3dOf(a).radiusM, `${a} > ${b}`).toBeGreaterThan(cue3dOf(b).radiusM)
  })

  it('types whose lines differ on the sheet (other than by width) have different 3D patterns, pairwise; only the sheet’s own shared line (analogue bal / unbal, both solid) is shared', () => {
    const shared: string[] = []
    for (let i = 0; i < TYPES.length; i++)
      for (let j = i + 1; j < TYPES.length; j++) {
        const [a, b] = [TYPES[i]!, TYPES[j]!]
        const sheetSame = CABLE_LINE[a].dash === CABLE_LINE[b].dash && CABLE_LINE[a].mark === CABLE_LINE[b].mark
        expect(key3d(a) === key3d(b), `${a} / ${b}`).toBe(sheetSame)
        if (sheetSame) shared.push(`${a}/${b}`)
      }
    // solid analogue, balanced and unbalanced; and speaker shares their solid line too (thick, its own colour) as on the sheet
    expect(shared.sort()).toEqual(['analog-bal/analog-unbal', 'analog-bal/speaker', 'analog-unbal/speaker'])
    // types that share a COLOUR always differ by their pattern (clock / control, mains / DC), except the sheet's balanced / unbalanced (by width)
    for (const a of TYPES)
      for (const b of TYPES)
        if (a < b && CABLE_TYPE_COLOUR[a] === CABLE_TYPE_COLOUR[b] && !(a.startsWith('analog') && b.startsWith('analog'))) expect(key3d(a), `${a} / ${b}`).not.toBe(key3d(b))
  })

  it('every signal of the 3D view gets the cue of its cable type', () => {
    for (const [signal, type] of Object.entries(SIGNAL_CABLE_TYPE)) {
      expect(SIGNAL_STYLE[signal]!.type, signal).toBe(type)
      expect(cableCue(signal), signal).toEqual(cue3dOf(type))
    }
    expect(cableCue('not-in-the-catalog')).toBeNull()
  })
})

describe('cueLayout (where the pieces go along a cable)', () => {
  it('a plain solid line has no piece; mains has collars along its length', () => {
    expect(cueLayout(cue3dOf('analog-bal'), 5)).toEqual([])
    expect(cueLayout(cue3dOf('speaker'), 5)).toEqual([])
    const marks = cueLayout(cue3dOf('mains'), 3)
    expect(marks.length).toBe(Math.floor(3 / MARK_EVERY_M))
    for (const m of marks) expect(m.kind).toBe('mark')
  })

  it('dashes, dots and dash-dots: in order, inside the cable, at least the minimum periods, dots have no length', () => {
    for (const t of ['digital', 'network', 'clock', 'control', 'dc'] as const) {
      for (const len of [0.4, 2, 6.5]) {
        const p = cueLayout(cue3dOf(t), len)
        const perPeriod = Math.ceil(cue3dOf(t).runs!.length / 2)
        expect(p.length, `${t} ${len}`).toBeGreaterThanOrEqual(PERIOD_MIN * perPeriod)
        for (let i = 0; i < p.length; i++) {
          expect(p[i]!.t0).toBeGreaterThanOrEqual(0)
          expect(p[i]!.t1).toBeLessThanOrEqual(1)
          expect(p[i]!.t1).toBeGreaterThanOrEqual(p[i]!.t0)
          if (i) expect(p[i]!.t0).toBeGreaterThanOrEqual(p[i - 1]!.t1)
        }
      }
    }
    for (const d of cueLayout(cue3dOf('network'), 2)) expect(d).toMatchObject({ kind: 'dot', t1: d.t0 })
    const clock = cueLayout(cue3dOf('clock'), 2)
    expect(clock.map((d) => ((d.t1 - d.t0) * 2 > 0.05 ? 'L' : 'S')).slice(0, 4).join('')).toBe('LSLS') // long dash, short dash, long, short
  })

  it('the pattern keeps its sheet period on a normal run (2 m of digital: 8 cm on, 4 cm off)', () => {
    const p = cueLayout(cue3dOf('digital'), 2.4)
    expect(p.length).toBe(20)
    expect((p[0]!.t1 - p[0]!.t0) * 2.4).toBeCloseTo(0.08, 6)
    expect((p[1]!.t0 - p[0]!.t1) * 2.4).toBeCloseTo(0.04, 6)
  })

  it('a long run never gets more than the cap: the period stretches instead', () => {
    for (const t of TYPES) {
      const p = cueLayout(cue3dOf(t), 120)
      expect(p.length, t).toBeLessThanOrEqual(PIECE_MAX)
    }
    const dash = cueLayout(cue3dOf('digital'), 120)
    expect(dash.length).toBe(PIECE_MAX)
    expect((dash[0]!.t1 - dash[0]!.t0) * 120).toBeGreaterThan(0.08) // longer dashes
    expect(cueLayout(cue3dOf('clock'), 120, 10).length).toBeLessThanOrEqual(10)
  })

  it('no length, no piece', () => {
    expect(cueLayout(cue3dOf('digital'), 0)).toEqual([])
  })
})

describe('cueSwatch (the legend sample drawn with the same pattern)', () => {
  it('the sheet’s dash, a width in the sheet’s order, round caps for dots, two collar ticks for mains', () => {
    for (const t of TYPES) expect(cueSwatch(t).dasharray, t).toBe(CABLE_LINE[t].dash || null)
    expect(cueSwatch('network').linecap).toBe('round')
    expect(cueSwatch('digital').linecap).toBe('butt')
    expect(cueSwatch('mains').ticks).toHaveLength(2)
    expect(cueSwatch('speaker').ticks).toHaveLength(0)
    expect(cueSwatch('speaker').strokeWidth).toBeGreaterThan(cueSwatch('analog-bal').strokeWidth)
    expect(cueSwatch('analog-bal').strokeWidth).toBeGreaterThan(cueSwatch('analog-unbal').strokeWidth)
    for (const t of TYPES) expect(cueSwatch(t).strokeWidth, t).toBeLessThanOrEqual(5)
  })
})
