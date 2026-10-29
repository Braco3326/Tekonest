/**
 * The test signal (Task 39, CA-26): OWN WORK, generated at run time, no audio asset and nothing copyrighted. Pink noise bursts to check that each side
 * speaks (left, right, both, both), then a short musical pattern (an arpeggio) so that the rig can also be judged on something that is not noise.
 *
 *   plan  : `testSignalPlan()` (pure data: when, how long, which side, which pitch) and `pinkNoise()` (a seeded, deterministic generator): unit-tested in Node.
 *   render: `renderTestSignal()` schedules the plan on an `OfflineAudioContext` (its constructor is handed in, so this file names no browser global) and returns
 *           the stereo `AudioBuffer`, which the engine plays in a loop.
 *
 * Levels are modest by construction (peak ≈ −12 dBFS for the bursts, less for the notes): the engine's own master gain and limiter come on top
 * (src/audio/engine.ts), so even a mistake here cannot start loud.
 */

/** One pink-noise burst: which side it is on. */
export interface NoiseBurst {
  startS: number
  durS: number
  side: 'L' | 'R' | 'LR'
}
/** One note of the pattern (both sides). */
export interface PatternNote {
  startS: number
  durS: number
  midi: number
  freqHz: number
}
export interface TestSignalPlan {
  durationS: number
  bursts: NoiseBurst[]
  notes: PatternNote[]
}

export const TEST_SIGNAL_SECONDS = 6.4
/** Linear peak of a noise burst (≈ −12 dBFS) and of a note. */
export const BURST_PEAK = 0.25
export const NOTE_PEAK = 0.12
const EDGE_S = 0.01 // attack / release of every burst and note: no click at its edges

/** Equal-tempered frequency of a MIDI note number (A4 = 69 = 440 Hz is the tuning convention of the notation, not a measured fact). */
export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

/** L, R, then twice both: 0.4 s bursts 0.2 s apart; then eight 0.4 s notes (a C major arpeggio up and down, with a low G). Silence pads the loop. */
export function testSignalPlan(): TestSignalPlan {
  const bursts: NoiseBurst[] = (['L', 'R', 'LR', 'LR'] as const).map((side, i) => ({ startS: i * 0.6, durS: 0.4, side }))
  const pattern = [60, 64, 67, 72, 67, 64, 60, 55]
  const notes = pattern.map((midi, i) => ({ startS: 2.6 + i * 0.4, durS: 0.4, midi, freqHz: midiToHz(midi) }))
  return { durationS: TEST_SIGNAL_SECONDS, bursts, notes }
}

/** A small seeded generator (mulberry32): the same seed, the same noise, in any browser. Returns values in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Pink noise (≈ −3 dB per octave, Paul Kellet's filter on white noise), normalised to a peak of exactly 1. Deterministic for a seed. */
export function pinkNoise(length: number, seed = 39): Float32Array<ArrayBuffer> {
  const rand = seededRandom(seed)
  const out = new Float32Array(length)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0
  let peak = 0
  for (let i = 0; i < length; i++) {
    const white = rand() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.969 * b2 + white * 0.153852
    b3 = 0.8665 * b3 + white * 0.3104856
    b4 = 0.55 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.016898
    const v = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
    b6 = white * 0.115926
    out[i] = v
    if (Math.abs(v) > peak) peak = Math.abs(v)
  }
  if (peak > 0) for (let i = 0; i < length; i++) out[i] /= peak
  return out
}

/** The slice of the browser's `OfflineAudioContext` that the renderer uses (a constructor is passed in, so tests may fake it). */
export interface OfflineContextCtor {
  new (channels: number, length: number, sampleRate: number): OfflineAudioContext
}

/**
 * Renders the plan on an OfflineAudioContext: noise bursts through a channel merger (L, R or both), notes on triangle oscillators (both sides),
 * every one with a 10 ms attack and release. Resolves with the stereo buffer (`durationS` long).
 */
export async function renderTestSignal(Offline: OfflineContextCtor, sampleRate: number): Promise<AudioBuffer> {
  const plan = testSignalPlan()
  const ctx = new Offline(2, Math.ceil(plan.durationS * sampleRate), sampleRate)
  const merger = ctx.createChannelMerger(2)
  merger.connect(ctx.destination)
  const toSides = (node: AudioNode, side: 'L' | 'R' | 'LR'): void => {
    if (side !== 'R') node.connect(merger, 0, 0)
    if (side !== 'L') node.connect(merger, 0, 1)
  }
  const envelope = (peak: number, start: number, dur: number): GainNode => {
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, start)
    g.gain.linearRampToValueAtTime(peak, start + EDGE_S)
    g.gain.setValueAtTime(peak, start + dur - EDGE_S)
    g.gain.linearRampToValueAtTime(0, start + dur)
    return g
  }
  for (const [i, b] of plan.bursts.entries()) {
    const n = Math.ceil(b.durS * sampleRate)
    const buf = ctx.createBuffer(1, n, sampleRate)
    buf.copyToChannel(pinkNoise(n, 39 + i), 0)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = envelope(BURST_PEAK, b.startS, b.durS)
    src.connect(g)
    toSides(g, b.side)
    src.start(b.startS)
    src.stop(b.startS + b.durS)
  }
  for (const note of plan.notes) {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = note.freqHz
    const g = envelope(NOTE_PEAK, note.startS, note.durS)
    osc.connect(g)
    toSides(g, 'LR')
    osc.start(note.startS)
    osc.stop(note.startS + note.durS)
  }
  return ctx.startRendering()
}
