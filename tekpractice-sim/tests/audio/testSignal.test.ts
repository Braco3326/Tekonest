/**
 * Task 39: the generated test signal (own work, no asset). The plan and the pink noise are pure and deterministic; the renderer is checked against a fake
 * OfflineAudioContext (what it schedules); the real rendering in a browser is the e2e's.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BURST_PEAK, NOTE_PEAK, TEST_SIGNAL_SECONDS, midiToHz, pinkNoise, renderTestSignal, seededRandom, testSignalPlan, type OfflineContextCtor } from '../../src/audio/testSignal'

describe('the plan', () => {
  const plan = testSignalPlan()
  it('starts with noise on the left, then the right, then both twice (so each speaker can be checked)', () => {
    expect(plan.bursts.map((b) => b.side)).toEqual(['L', 'R', 'LR', 'LR'])
  })
  it('then a short musical pattern: eight notes, every one after the last burst and inside the signal', () => {
    expect(plan.notes).toHaveLength(8)
    const lastBurstEnd = Math.max(...plan.bursts.map((b) => b.startS + b.durS))
    for (const n of plan.notes) {
      expect(n.startS).toBeGreaterThanOrEqual(lastBurstEnd)
      expect(n.startS + n.durS).toBeLessThanOrEqual(plan.durationS)
    }
    expect(plan.durationS).toBe(TEST_SIGNAL_SECONDS)
  })
  it('nothing overlaps: bursts and notes follow each other', () => {
    const spans = [...plan.bursts, ...plan.notes].map((x) => [x.startS, x.startS + x.durS]).sort((a, b) => a[0] - b[0])
    for (let i = 1; i < spans.length; i++) expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1] - 1e-9)
  })
  it('equal temperament: A4 = 440 Hz, an octave doubles, middle C is 261.63 Hz', () => {
    expect(midiToHz(69)).toBe(440)
    expect(midiToHz(81)).toBeCloseTo(880, 9)
    expect(midiToHz(60)).toBeCloseTo(261.6256, 3)
    expect(plan.notes[0].freqHz).toBeCloseTo(261.6256, 3)
  })
  it('is modest by design: the bursts peak below −12 dBFS, a note below −18 dBFS', () => {
    expect(20 * Math.log10(BURST_PEAK)).toBeLessThanOrEqual(-12)
    expect(20 * Math.log10(NOTE_PEAK)).toBeLessThanOrEqual(-18)
  })
})

describe('pink noise', () => {
  const n = 44100
  const x = pinkNoise(n)
  it('is deterministic for a seed and differs between seeds', () => {
    expect(Array.from(pinkNoise(256, 7))).toEqual(Array.from(pinkNoise(256, 7)))
    expect(Array.from(pinkNoise(256, 7))).not.toEqual(Array.from(pinkNoise(256, 8)))
  })
  it('is finite, peaks at exactly 1 and is not silent', () => {
    expect(x.every(Number.isFinite)).toBe(true)
    expect(Math.max(...x.map(Math.abs))).toBeCloseTo(1, 6)
    const rms = Math.sqrt(x.reduce((s, v) => s + v * v, 0) / n)
    expect(rms).toBeGreaterThan(0.05)
  })
  it('is pink, not white: neighbouring samples are strongly correlated, and the low half of the spectrum carries more than the high half', () => {
    let num = 0
    let den = 0
    for (let i = 1; i < n; i++) {
      num += x[i] * x[i - 1]
      den += x[i] * x[i]
    }
    expect(num / den).toBeGreaterThan(0.5) // white noise: about 0
    // energy per octave band by a direct DFT at a few frequencies: pink falls with frequency
    const power = (f: number): number => {
      let re = 0
      let im = 0
      for (let i = 0; i < n; i++) {
        const a = (2 * Math.PI * f * i) / n
        re += x[i] * Math.cos(a)
        im -= x[i] * Math.sin(a)
      }
      return (re * re + im * im) / n
    }
    const band = (lo: number, hi: number): number => {
      let s = 0
      let k = 0
      for (let f = lo; f < hi; f += Math.max(1, Math.floor((hi - lo) / 12))) {
        s += power(f)
        k++
      }
      return s / k
    }
    expect(band(20, 80)).toBeGreaterThan(band(2000, 8000) * 10) // a clear tilt (white: about equal)
  })
  it('seededRandom stays in [0, 1) and is repeatable', () => {
    const r = seededRandom(5)
    const a = Array.from({ length: 1000 }, r)
    expect(a.every((v) => v >= 0 && v < 1)).toBe(true)
    const r2 = seededRandom(5)
    expect(Array.from({ length: 1000 }, r2)).toEqual(a)
  })
})

/** A recording OfflineAudioContext: what is scheduled, nothing rendered. */
interface OfflineLog {
  sources: { start: number; stop: number }[]
  oscs: { freq: number; start: number; type: string }[]
  made: { channels: number; length: number; rate: number } | null
}
function fakeOffline(): { Ctor: OfflineContextCtor; log: OfflineLog } {
  const log: OfflineLog = { sources: [], oscs: [], made: null }
  class Param {
    value = 0
    setValueAtTime(): void {}
    linearRampToValueAtTime(): void {}
  }
  class Node {
    connect(): void {}
  }
  class Gain extends Node {
    gain = new Param()
  }
  class Source extends Node {
    buffer: unknown = null
    rec = { start: 0, stop: 0 }
    constructor() {
      super()
      log.sources.push(this.rec)
    }
    start(t: number): void {
      this.rec.start = t
    }
    stop(t: number): void {
      this.rec.stop = t
    }
  }
  class Osc extends Node {
    type = ''
    frequency = new Param()
    rec = { freq: 0, start: 0, type: '' }
    constructor() {
      super()
      log.oscs.push(this.rec)
    }
    start(t: number): void {
      this.rec.start = t
      this.rec.freq = this.frequency.value
      this.rec.type = this.type
    }
    stop(): void {}
  }
  class Ctx {
    destination = new Node()
    constructor(channels: number, length: number, rate: number) {
      log.made = { channels, length, rate }
    }
    createChannelMerger = (): Node => new Node()
    createGain = (): Gain => new Gain()
    createBuffer = (): { copyToChannel(): void } => ({ copyToChannel() {} })
    createBufferSource = (): Source => new Source()
    createOscillator = (): Osc => new Osc()
    startRendering = async (): Promise<unknown> => ({ rendered: true })
  }
  return { Ctor: Ctx as unknown as OfflineContextCtor, log }
}

describe('renderTestSignal', () => {
  it('builds a 2-channel OfflineAudioContext of exactly durationS at the given rate, and resolves with its rendering', async () => {
    const { Ctor, log } = fakeOffline()
    const buf = await renderTestSignal(Ctor, 44100)
    expect(buf).toEqual({ rendered: true })
    expect(log.made).toEqual({ channels: 2, length: Math.ceil(TEST_SIGNAL_SECONDS * 44100), rate: 44100 })
  })
  it('schedules each burst at its time and each note at its pitch, on triangle oscillators', async () => {
    const { Ctor, log } = fakeOffline()
    await renderTestSignal(Ctor, 48000)
    const plan = testSignalPlan()
    expect(log.sources.map((s) => s.start)).toEqual(plan.bursts.map((b) => b.startS))
    expect(log.sources.map((s) => s.stop)).toEqual(plan.bursts.map((b) => b.startS + b.durS))
    expect(log.oscs.map((o) => o.freq)).toEqual(plan.notes.map((n) => n.freqHz))
    expect(log.oscs.every((o) => o.type === 'triangle')).toBe(true)
  })
  it('imports no audio file and fetches nothing: the module has no URL, no fetch, no asset import', () => {
    const src = readFileSync('src/audio/testSignal.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(src).not.toMatch(/\bfetch\b|XMLHttpRequest|\.mp3|\.ogg|\.wav|\bimport\b.*from/)
  })
})
