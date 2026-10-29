/**
 * Task 39: the Écoute block's text. Every number the bars stand for is real text: French decimals, a true minus sign, never « −0,0 », NaN or Infinity.
 */
import { describe, expect, it } from 'vitest'
import { barOf, delayText, fr, gainText, levelText, panText, rowsOf, sourceName } from '../../src/creation/listenModel'

describe('numbers', () => {
  it('French decimals and a true minus (U+2212); a tiny negative is 0,0, not −0,0; not finite is a dash', () => {
    expect(fr(-12.34)).toBe('−12,3')
    expect(fr(0.04)).toBe('0,0')
    expect(fr(-0.04)).toBe('0,0')
    expect(fr(2, 0)).toBe('2')
    expect(fr(NaN)).toBe('–')
    expect(fr(-Infinity)).toBe('–')
  })
  it('level: full scale is 0,0 dBFS, half is −6,0, below −120 dBFS is « silence »', () => {
    expect(levelText(1)).toBe('0,0 dBFS')
    expect(levelText(0.5)).toBe('−6,0 dBFS')
    expect(levelText(0)).toBe('silence')
    expect(levelText(1e-7)).toBe('silence')
  })
  it('the bar: 0 at silence and at −60 dBFS and below, 1 at full scale, and monotonic', () => {
    expect(barOf(0)).toBe(0)
    expect(barOf(1e-3)).toBeCloseTo(0, 9) // −60 dBFS
    expect(barOf(1)).toBe(1)
    expect(barOf(0.5)).toBeGreaterThan(barOf(0.1))
    expect(barOf(2)).toBe(1)
  })
  it('gain in dB (0 is silence), delay in ms, pan as a side and a percentage', () => {
    expect(gainText(0.5)).toBe('−6,0 dB')
    expect(gainText(0)).toBe('silence')
    expect(delayText(0)).toBe('0,0 ms')
    expect(delayText(0.0123)).toBe('12,3 ms')
    expect(panText(-0.424)).toBe('gauche 42 %')
    expect(panText(1)).toBe('droite 100 %')
    expect(panText(0)).toBe('centre')
    expect(panText(0.001)).toBe('centre')
  })
})

describe('rows', () => {
  const v = (instanceId: string, gain: number, delayS: number, pan: number) => ({ instanceId, channels: ['L' as const], gain, delayS, pan })
  it('one row per voice, sorted by id, with the name, level, gain, delay and pan as one sentence', () => {
    const rows = rowsOf([v('k12-g', 0.5, 0.01, -0.5), v('k12-d', 0.25, 0, 0.5)], { 'k12-g': 0.1, 'k12-d': 0 }, (id) => `QSC (${id})`)
    expect(rows.map((r) => r.id)).toEqual(['k12-d', 'k12-g'])
    expect(rows[1].text).toBe('QSC (k12-g) : niveau −20,0 dBFS, gain −6,0 dB, retard 10,0 ms, pan gauche 50 %')
    expect(rows[0].text).toBe('QSC (k12-d) : niveau silence, gain −12,0 dB, retard 0,0 ms, pan droite 50 %')
  })
  it('a muted voice (gain 0) reads « silence » everywhere, no -Infinity, no NaN', () => {
    const [r] = rowsOf([v('a', 0, 0, 0)], {}, (id) => id)
    expect(r.text).toBe('a : niveau silence, gain silence, retard 0,0 ms, pan centre')
    expect(r.text).not.toMatch(/NaN|Infinity|undefined/)
    expect(r.bar).toBe(0)
  })
})

describe('source names', () => {
  it('the test signal, a file by its name, a song by its title', () => {
    expect(sourceName({ kind: 'test' })).toBe('signal de test')
    expect(sourceName({ kind: 'file', file: new File([new Uint8Array(1)], 'mix.wav') })).toBe('fichier mix.wav')
    expect(sourceName({ kind: 'song', id: 's', title: 'Mon titre', url: '/x' })).toBe('Mon titre')
  })
})
