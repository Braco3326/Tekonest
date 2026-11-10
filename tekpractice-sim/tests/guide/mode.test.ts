// The guide's mode gate fails closed: "practice" only on the two practice surfaces, "exam" for anything else.
import { describe, expect, it } from 'vitest'
import { guideEnabled, guideMode, type GuideMode, type GuideRoute } from '../../src/guide/mode'
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
]

describe('guideMode', () => {
  it.each(rows)('%s', (_name, search, route, expected) => {
    expect(guideMode(search, route)).toBe(expected)
  })

  it('the search string does not need its question mark', () => {
    expect(guideMode('level=a1', 'legacy')).toBe('practice')
    expect(guideMode('level=a1&mode=exam', 'legacy')).toBe('exam')
  })

  it('a creation level parameter does not matter, a legacy mode parameter always matters', () => {
    expect(guideMode('?level=a1', 'creation')).toBe('practice')
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
    const off = { levels: false, guide: false }
    expect(guideEnabled('', off)).toBe(false)
    expect(guideEnabled('?oscar=1', off)).toBe(false)
    expect(guideEnabled('?oscar=0', off)).toBe(false)
  })

  it('is true when features.guide is true and the query does not switch it off', () => {
    expect(guideEnabled('', { levels: true, guide: true })).toBe(true)
  })

  it('never throws on garbage and does not enable on unparsable input beyond the default', () => {
    for (const s of ['%', '%E0%A4%A', '\u0000', '&&&']) expect(() => guideEnabled(s)).not.toThrow()
    expect(guideEnabled('x'.repeat(100_000))).toBe(true)
  })
})
