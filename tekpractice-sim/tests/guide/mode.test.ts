// The guide's mode gate fails closed: "practice" only on the two practice surfaces, "exam" for anything else.
import { describe, expect, it } from 'vitest'
import type { Features } from '../../src/features'
import { guideEnabled, guideMode, guideRouteAllowed, type GuideMode, type GuideRoute } from '../../src/guide/mode'
import { FEATURES } from '../../src/features'

type Row = [name: string, search: string, route: GuideRoute, expected: GuideMode]

const rows: Row[] = [
  ['creation default url is practice', '', 'creation', 'practice'],
  ['creation default url with a lone question mark is practice', '?', 'creation', 'practice'],
  ['creation with unrelated param view is practice', '?view=top', 'creation', 'practice'],
  ['creation with unrelated param room is practice', '?room=bar-club-stage-small', 'creation', 'practice'],
  ['creation with unrelated param render is practice', '?render=low&v=1730000000000', 'creation', 'practice'],
  ['creation with mode=exam is exam', '?mode=exam', 'creation', 'exam'],
  ['creation with mode=anything is exam', '?mode=anything', 'creation', 'exam'],
  ['creation with mode=practice is exam', '?mode=practice', 'creation', 'exam'],
  ['creation with an empty mode is exam', '?mode=', 'creation', 'exam'],
  ['creation with a bare mode key is exam', '?mode', 'creation', 'exam'],
  ['creation with mode among other params is exam', '?room=x&mode=exam&view=top', 'creation', 'exam'],
  ['legacy level a1 without mode is practice', '?level=a1', 'legacy', 'practice'],
  ['legacy level b1 without mode is practice', '?level=b1', 'legacy', 'practice'],
  ['legacy level c1 without mode is practice', '?level=c1', 'legacy', 'practice'],
  ['legacy level d1 without mode is practice', '?level=d1', 'legacy', 'practice'],
  ['legacy level with unrelated params is practice', '?level=a1&room=x&v=1', 'legacy', 'practice'],
  ['legacy a1 mode=exam is exam', '?level=a1&mode=exam', 'legacy', 'exam'],
  ['legacy a1 with an empty mode is exam', '?level=a1&mode=', 'legacy', 'exam'],
  ['legacy a1 with mode=practice is exam', '?level=a1&mode=practice', 'legacy', 'exam'],
  ['legacy sandbox is exam', '?level=sandbox', 'legacy', 'exam'],
  ['legacy sandbox with a room is exam', '?level=sandbox&room=bar-club-stage-small', 'legacy', 'exam'],
  ['legacy with no level is exam', '?legacy=1', 'legacy', 'exam'],
  ['legacy with an empty search is exam', '', 'legacy', 'exam'],
  ['legacy with an empty level is exam', '?level=', 'legacy', 'exam'],
  ['legacy level=zz is exam', '?level=zz', 'legacy', 'exam'],
  ['legacy level a2 is exam', '?level=a2', 'legacy', 'exam'],
  ['legacy level prefix a1x is exam', '?level=a1x', 'legacy', 'exam'],
  ['legacy repeated level where the first is valid and the second is not is exam', '?level=a1&level=zz', 'legacy', 'exam'],
  ['level case variant A1 is exam', '?level=A1', 'legacy', 'exam'],
  ['level with a leading space is exam', '?level=%20a1', 'legacy', 'exam'],
  ['level with a trailing space is exam', '?level=a1%20', 'legacy', 'exam'],
  ['level with a plus sign for space is exam', '?level=+a1', 'legacy', 'exam'],
  ['level with a trailing newline is exam', '?level=a1%0A', 'legacy', 'exam'],
  ['creation with an upper-case MODE key is exam', '?MODE=exam', 'creation', 'exam'],
  ['creation with a mixed-case Mode key is exam', '?Mode=practice', 'creation', 'exam'],
  ['creation with a percent-encoded mode key is exam', '?%6Dode=exam', 'creation', 'exam'],
  ['creation with a duplicated empty then exam mode key is exam', '?mode=&mode=exam', 'creation', 'exam'],
  ['legacy with an upper-case MODE key is exam', '?level=a1&MODE=exam', 'legacy', 'exam'],
  ['legacy with a percent-encoded mode key is exam', '?level=a1&%6Dode=exam', 'legacy', 'exam'],
  ['legacy with a duplicated empty then exam mode key is exam', '?level=a1&mode=&mode=exam', 'legacy', 'exam'],
  ['legacy level written with a percent-encoded digit decodes to a1 and is practice', '?level=a%31', 'legacy', 'practice'],
  ['creation with a legacy key is exam', '?legacy=1', 'creation', 'exam'],
  ['creation with a level key is exam', '?level=a1', 'creation', 'exam'],
]

describe('guideMode', () => {
  it.each(rows)('%s', (_name, search, route, expected) => {
    expect(guideMode(search, route)).toBe(expected)
  })

  it('the search string does not need its question mark', () => {
    expect(guideMode('level=a1', 'legacy')).toBe('practice')
    expect(guideMode('level=a1&mode=exam', 'legacy')).toBe('exam')
  })

  it('a creation route that carries a level or legacy key is exam, a mode key always matters', () => {
    expect(guideMode('?level=a1', 'creation')).toBe('exam')
    expect(guideMode('?level=sandbox', 'creation')).toBe('exam')
    expect(guideMode('?legacy=1', 'creation')).toBe('exam')
    expect(guideMode('?LEVEL=a1', 'creation')).toBe('exam')
    expect(guideMode('?%6Cevel=a1', 'creation')).toBe('exam')
    expect(guideMode('?level=a1&mode=exam', 'creation')).toBe('exam')
  })

  it('empty, garbage and very long search strings are exam where they carry a mode or a bad level, and never throw', () => {
    const garbage = ['%', '%E0%A4%A', '?%zz=%zz', '&&&', '===', '?=&=', '\u0000', '\ud800', '??mode=exam', '#mode=exam']
    const long = 'x'.repeat(100_000)
    const inputs = [...garbage, `?level=${long}`, `?mode=${long}`, `?${long}=1`, long, `?level=a1&${long}`]
    for (const route of ['creation', 'legacy'] as const) {
      for (const s of inputs) expect(() => guideMode(s, route), `${route} ${s.slice(0, 20)}`).not.toThrow()
    }
    // A legacy route with a garbage or oversize level is exam.
    for (const s of ['', '%', '&&&', '===', '\u0000', `?level=${long}`, long]) expect(guideMode(s, 'legacy')).toBe('exam')
    // A creation route with a mode parameter of any size is exam.
    for (const s of ['?mode=exam', `?mode=${long}`, '?mode', `?mode=%E0%A4%A`]) expect(guideMode(s, 'creation')).toBe('exam')
  })

  it('unparsable or non-string input returns exam rather than throwing', () => {
    const bad: unknown[] = [undefined, null, 0, {}, [], Symbol.iterator]
    for (const route of ['creation', 'legacy'] as const) {
      for (const s of bad) {
        expect(() => guideMode(s as string, route)).not.toThrow()
        expect(guideMode(s as string, route)).toBe('exam')
      }
    }
  })

  it('an unknown route is exam', () => {
    expect(guideMode('', 'other' as unknown as GuideRoute)).toBe('exam')
    expect(guideMode('?level=a1', undefined as unknown as GuideRoute)).toBe('exam')
  })
})

describe('guideEnabled', () => {
  it('is true by default with the shipped flags', () => {
    expect(FEATURES.guide).toBe(true)
    expect(guideEnabled('')).toBe(true)
    expect(guideEnabled('?room=x&view=top')).toBe(true)
    expect(guideEnabled('?level=a1')).toBe(true)
  })

  it('is false for ?oscar=0', () => {
    expect(guideEnabled('?oscar=0')).toBe(false)
    expect(guideEnabled('?room=x&oscar=0')).toBe(false)
    expect(guideEnabled('oscar=0')).toBe(false)
  })

  it('stays true for other oscar values', () => {
    expect(guideEnabled('?oscar=1')).toBe(true)
    expect(guideEnabled('?oscar=')).toBe(true)
    expect(guideEnabled('?oscar=00')).toBe(true)
  })

  it('is false when features.guide is false, whatever the query', () => {
    const off = { levels: false, guide: false, guideLegacy: false }
    expect(guideEnabled('', off)).toBe(false)
    expect(guideEnabled('?oscar=1', off)).toBe(false)
    expect(guideEnabled('?oscar=0', off)).toBe(false)
  })

  it('is false when any oscar parameter is 0, whatever the order or the case of the key', () => {
    expect(guideEnabled('?oscar=1&oscar=0')).toBe(false)
    expect(guideEnabled('?oscar=0&oscar=1')).toBe(false)
    expect(guideEnabled('?OSCAR=0')).toBe(false)
    expect(guideEnabled('?Oscar=0')).toBe(false)
    expect(guideEnabled('?%6Fscar=0')).toBe(false)
    expect(guideEnabled('?oscar=1&OSCAR=0')).toBe(false)
  })

  it('a missing or non-string search never throws and follows the flag alone', () => {
    const on = { levels: false, guide: true, guideLegacy: false }
    const off = { levels: false, guide: false, guideLegacy: false }
    for (const s of [undefined, null, 0, {}, []] as unknown[]) {
      expect(() => guideEnabled(s as string)).not.toThrow()
      expect(guideEnabled(s as string, on)).toBe(true)
      expect(guideEnabled(s as string, off)).toBe(false)
    }
  })

  it('is true when features.guide is true and the query does not switch it off', () => {
    expect(guideEnabled('', { levels: true, guide: true, guideLegacy: false })).toBe(true)
  })

  it('never throws on garbage and does not enable on unparsable input beyond the default', () => {
    for (const s of ['%', '%E0%A4%A', '\u0000', '&&&']) expect(() => guideEnabled(s)).not.toThrow()
    expect(guideEnabled('x'.repeat(100_000))).toBe(true)
  })
})

describe('guideRouteAllowed: Mode Création is on by default, level play ships dark', () => {
  const F = (over: Partial<Features> = {}): Features => ({ levels: false, guide: true, guideLegacy: false, ...over })

  it('the shipped flags: the guide is on in Mode Création and off for level play', () => {
    expect(FEATURES.guide).toBe(true)
    expect(FEATURES.guideLegacy).toBe(false)
    expect(guideRouteAllowed('', 'creation')).toBe(true)
    expect(guideRouteAllowed('?level=a1', 'legacy')).toBe(false)
  })

  it('Mode Création does not depend on the level-play flag or on the opt-in', () => {
    for (const s of ['', '?oscar=legacy', '?room=x']) {
      expect(guideRouteAllowed(s, 'creation', F()), s).toBe(true)
      expect(guideRouteAllowed(s, 'creation', F({ guideLegacy: true })), s).toBe(true)
    }
  })

  it('level play needs the flag or the explicit opt-in oscar=legacy', () => {
    expect(guideRouteAllowed('?level=a1', 'legacy', F())).toBe(false)
    expect(guideRouteAllowed('?level=a1', 'legacy', F({ guideLegacy: true }))).toBe(true)
    expect(guideRouteAllowed('?level=a1&oscar=legacy', 'legacy', F())).toBe(true)
    expect(guideRouteAllowed('?oscar=legacy&level=d1', 'legacy', F())).toBe(true)
    for (const s of ['?level=a1&oscar=1', '?level=a1&oscar=', '?level=a1&oscar=Legacy', '?level=a1&oscar=legacy2', '?level=a1&oscar=yes', '?level=a1&legacy=1'])
      expect(guideRouteAllowed(s, 'legacy', F()), s).toBe(false)
  })

  it('oscar=0 wins over everything, the flag and the opt-in, in any order and key case', () => {
    for (const s of ['?level=a1&oscar=0', '?level=a1&oscar=legacy&oscar=0', '?level=a1&oscar=0&oscar=legacy', '?level=a1&OSCAR=0&oscar=legacy', '?level=a1&%6Fscar=0&oscar=legacy']) {
      expect(guideRouteAllowed(s, 'legacy', F()), s).toBe(false)
      expect(guideRouteAllowed(s, 'legacy', F({ guideLegacy: true })), s).toBe(false)
    }
  })

  it('a repeated opt-in key is handled like the oscar key: any occurrence, any key case', () => {
    expect(guideRouteAllowed('?level=a1&oscar=1&oscar=legacy', 'legacy', F())).toBe(true)
    expect(guideRouteAllowed('?level=a1&oscar=legacy&oscar=1', 'legacy', F())).toBe(true)
    expect(guideRouteAllowed('?level=a1&OSCAR=legacy', 'legacy', F())).toBe(true)
    expect(guideRouteAllowed('?level=a1&%6Fscar=legacy', 'legacy', F())).toBe(true)
  })

  it('the master flag still wins: guide false is off everywhere, the opt-in included', () => {
    expect(guideRouteAllowed('?level=a1&oscar=legacy', 'legacy', F({ guide: false }))).toBe(false)
    expect(guideRouteAllowed('', 'creation', F({ guide: false }))).toBe(false)
  })

  it('the opt-in never opens the exam gate: the mode is the address alone', () => {
    for (const s of ['?level=a1&mode=exam&oscar=legacy', '?level=sandbox&oscar=legacy', '?legacy=1&oscar=legacy', '?level=zz&oscar=legacy', '?level=a1&MODE=&oscar=legacy', '?level=a1&level=b1&oscar=legacy'])
      expect(guideMode(s, 'legacy'), s).toBe('exam')
    expect(guideMode('?level=a1&oscar=legacy', 'legacy')).toBe('practice')
    expect(guideMode('?oscar=legacy', 'creation')).toBe('practice')
  })

  it('never throws on garbage and a non-string address is dark for level play', () => {
    for (const s of [undefined, null, 0, {}, [], '%', '%E0%A4%A', '\u0000', '&&&']) expect(() => guideRouteAllowed(s as string, 'legacy', F())).not.toThrow()
    expect(guideRouteAllowed(undefined as unknown as string, 'legacy', F())).toBe(false)
    expect(guideRouteAllowed(undefined as unknown as string, 'legacy', F({ guideLegacy: true }))).toBe(true)
    expect(guideRouteAllowed('', 'nowhere' as GuideRoute, F({ guideLegacy: true }))).toBe(false)
  })
})
