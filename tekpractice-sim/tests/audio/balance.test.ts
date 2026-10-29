/**
 * Phase 4 final wave (brief §5 « console mute / fader / PAN affect sound »): the console balance as a per-channel level factor, shared by the sound
 * (listenVoices) and the coverage (coverageSources) so that the dots and the sound agree. Pure.
 *
 * The law: G100 = left only (R × 0), G50 = R at 0.5 (−6 dB), C = both 1, D50 = L at 0.5, D100 = right only. A speaker fed L only uses the L factor, R only the R
 * factor, both the mean of the two.
 */
import { describe, expect, it } from 'vitest'
import { balanceFactors, speakerBalanceDb, speakerBalanceFactor } from '../../src/audio/balance'

describe('balanceFactors: the catalog enum G100 / G50 / C / D50 / D100', () => {
  it('G100: left only', () => expect(balanceFactors('G100')).toEqual({ l: 1, r: 0 }))
  it('G50: the right side at 0.5', () => expect(balanceFactors('G50')).toEqual({ l: 1, r: 0.5 }))
  it('C: both sides at 1', () => expect(balanceFactors('C')).toEqual({ l: 1, r: 1 }))
  it('D50: the left side at 0.5', () => expect(balanceFactors('D50')).toEqual({ l: 0.5, r: 1 }))
  it('D100: right only', () => expect(balanceFactors('D100')).toEqual({ l: 0, r: 1 }))
  it('anything else (an unknown value, empty, a number out of range) is the centre, never NaN; 150 is clamped to 100', () => {
    for (const v of ['', 'X', 'g50', 'G', 'GG', 'G-5']) expect(balanceFactors(v), v).toEqual({ l: 1, r: 1 })
    expect(balanceFactors('G150')).toEqual({ l: 1, r: 0 })
  })
})

describe('speakerBalanceFactor: which side feeds the speaker', () => {
  it('an L-fed speaker follows the left factor, an R-fed one the right factor, a both-fed one the mean', () => {
    expect(speakerBalanceFactor('G50', ['L'])).toBe(1)
    expect(speakerBalanceFactor('G50', ['R'])).toBe(0.5)
    expect(speakerBalanceFactor('G50', ['L', 'R'])).toBe(0.75)
    expect(speakerBalanceFactor('D100', ['L'])).toBe(0)
    expect(speakerBalanceFactor('D100', ['R'])).toBe(1)
    expect(speakerBalanceFactor('D100', ['R', 'L'])).toBe(0.5)
  })
  it('no channel at all (not a case of the path) is unity', () => expect(speakerBalanceFactor('G100', [])).toBe(1))
})

describe('speakerBalanceDb', () => {
  it('centre is exactly 0 dB (+0), G50 on the right speaker is −6.02 dB, a zero factor is −Infinity', () => {
    expect(Object.is(speakerBalanceDb('C', ['L']), 0)).toBe(true)
    expect(speakerBalanceDb('G50', ['R'])).toBeCloseTo(-6.0206, 4)
    expect(speakerBalanceDb('G100', ['R'])).toBe(-Infinity)
    expect(speakerBalanceDb('G100', ['L'])).toBe(0)
  })
})
