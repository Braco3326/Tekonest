import { describe, expect, it } from 'vitest'
import { AGE_RANGES, ageRangeLabel, isAgeRange, isUnder15 } from '../../src/accounts/ageRange'

describe('age ranges', () => {
  it('has exactly the eight agreed ranges, in order', () => {
    expect([...AGE_RANGES]).toEqual(['-15', '15-17', '18-21', '22-25', '26-30', '31-35', '36-40', '41+'])
  })

  it('labels every range in French', () => {
    expect(ageRangeLabel('-15')).toBe('moins de 15 ans')
    expect(ageRangeLabel('15-17')).toBe('15 à 17 ans')
    expect(ageRangeLabel('18-21')).toBe('18 à 21 ans')
    expect(ageRangeLabel('22-25')).toBe('22 à 25 ans')
    expect(ageRangeLabel('26-30')).toBe('26 à 30 ans')
    expect(ageRangeLabel('31-35')).toBe('31 à 35 ans')
    expect(ageRangeLabel('36-40')).toBe('36 à 40 ans')
    expect(ageRangeLabel('41+')).toBe('41 ans et plus')
  })

  it('only the first range is under 15', () => {
    expect(AGE_RANGES.filter((r) => isUnder15(r))).toEqual(['-15'])
  })

  it('isAgeRange accepts the eight values and nothing else', () => {
    for (const r of AGE_RANGES) expect(isAgeRange(r)).toBe(true)
    for (const bad of ['', '15', '14', '41', '-16', 'adult', null, undefined, 15, {}]) expect(isAgeRange(bad)).toBe(false)
  })
})
