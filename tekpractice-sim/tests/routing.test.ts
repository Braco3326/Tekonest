import { describe, expect, it } from 'vitest'
import { decideRoute } from '../src/routing'

/** The product table (src/features.ts, read as text by tests/features.test.ts): the learning pages are off. */
const PRODUCT = { levels: false, legacyPages: false, guide: false, guideLegacy: false, guideInbox: false }
/** The learning pages on (the all-on table the unit and end-to-end tests run against). */
const PAGES_ON = { levels: false, legacyPages: true, guide: true, guideLegacy: false }

describe('decideRoute', () => {
  it('no query → Mode Création', () => expect(decideRoute('')).toBe('creation'))
  it('?legacy=1 → legacy home', () => expect(decideRoute('?legacy=1')).toBe('legacy'))
  it('any ?level= → legacy (levels, sandbox, exam)', () => {
    for (const q of ['?level=a1', '?level=sandbox&room=bar-club-stage-small', '?level=a1&mode=exam'])
      expect(decideRoute(q)).toBe('legacy')
  })
  it('?legacy=0 or other params → creation', () => expect(decideRoute('?legacy=0&room=x')).toBe('creation'))
  it('FEATURES.levels = true sends the default URL to legacy', () =>
    expect(decideRoute('', { levels: true, guide: true, guideLegacy: false })).toBe('legacy'))
})

describe('decideRoute with the learning pages off (the shipped product, founder 2026-11-15)', () => {
  it('every address that used to open the learning game opens Mode Création: levels, exam, sandbox, dashboard, the 2D board, ?legacy=1', () => {
    for (const q of ['?level=a1', '?level=b1&mode=exam', '?level=sandbox&room=bar-club-stage-small', '?level=a1&render=2d', '?legacy=1', '?legacy=1&level=d1', '?level=a1&oscar=legacy', '?legacy=1&v=1730000000000'])
      expect(decideRoute(q, PRODUCT), q).toBe('creation')
  })
  it('the default address and ?design stay Mode Création, and FEATURES.levels alone no longer reaches the learning pages', () => {
    expect(decideRoute('', PRODUCT)).toBe('creation')
    expect(decideRoute('?design=3', PRODUCT)).toBe('creation')
    expect(decideRoute('', { ...PRODUCT, levels: true })).toBe('creation')
  })
  it('one switch brings them back', () => {
    expect(decideRoute('?level=a1', PAGES_ON)).toBe('legacy')
    expect(decideRoute('?legacy=1', PAGES_ON)).toBe('legacy')
    expect(decideRoute('?level=a1', { ...PRODUCT, legacyPages: true })).toBe('legacy')
  })
})

describe('decideRoute ignores a v query (night 2 wave 5, P1-1: the entry guard refreshes the page with ?v=<time>)', () => {
  it('?v= alone keeps Mode Création', () => expect(decideRoute('?v=1730000000000')).toBe('creation'))
  it('?legacy=1&v= and ?level=a1&v= keep legacy', () => {
    expect(decideRoute('?legacy=1&v=1730000000000')).toBe('legacy')
    expect(decideRoute('?level=a1&v=1730000000000')).toBe('legacy')
  })
})
