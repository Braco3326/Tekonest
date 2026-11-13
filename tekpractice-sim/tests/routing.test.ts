import { describe, expect, it } from 'vitest'
import { decideRoute } from '../src/routing'

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

describe('decideRoute ignores a v query (night 2 wave 5, P1-1: the entry guard refreshes the page with ?v=<time>)', () => {
  it('?v= alone keeps Mode Création', () => expect(decideRoute('?v=1730000000000')).toBe('creation'))
  it('?legacy=1&v= and ?level=a1&v= keep legacy', () => {
    expect(decideRoute('?legacy=1&v=1730000000000')).toBe('legacy')
    expect(decideRoute('?level=a1&v=1730000000000')).toBe('legacy')
  })
})
