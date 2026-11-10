/**
 * controls/meters: what a level meter does with a signal, and a stand-in signal until the console software feeds real ones.
 * Pure: time and levels in, positions out. A VU needle integrates (it takes about 300 ms to reach 99 %), an LED bar rises at once
 * and falls at a steady rate with a held peak. All levels are dBFS of the signal's short-term amplitude.
 */

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))
const toLinear = (db: number): number => (db <= -120 ? 0 : 10 ** (db / 20))
const toDb = (lin: number): number => (lin <= 1e-6 ? -120 : 20 * Math.log10(lin))

/** VU needle: first-order integration of the amplitude (tau 65 ms = 99 % in 300 ms), reading linear on the dial (0 VU at 70.7 %). */
export class VuBallistics {
  private amp = 0
  constructor(
    /** dBFS that reads 0 VU. */
    readonly referenceDb = -18,
    private readonly tauMs = 65
  ) {}

  /** Advance `dtMs` toward `levelDb`; returns the needle position 0..1 (1 = hard right, about +3 VU). */
  step(levelDb: number, dtMs: number): number {
    const target = toLinear(levelDb)
    const k = 1 - Math.exp(-Math.max(0, dtMs) / this.tauMs)
    this.amp += (target - this.amp) * k
    return this.position
  }

  get position(): number {
    if (this.amp <= 1e-6) return 0
    const vu = toDb(this.amp) - this.referenceDb
    return clamp01(10 ** (vu / 20) * 0.7079)
  }

  reset(): void {
    this.amp = 0
  }
}

/** LED bar: instant attack, fixed fall rate (dB per second), peak hold. */
export class BarBallistics {
  level = -120
  peak = -120
  private holdUntil = 0
  constructor(
    private readonly fallDbPerS = 20,
    private readonly holdMs = 1500
  ) {}

  step(levelDb: number, nowMs: number, dtMs: number): void {
    if (levelDb >= this.level) this.level = levelDb
    else this.level = Math.max(levelDb, this.level - (this.fallDbPerS * Math.max(0, dtMs)) / 1000)
    if (levelDb >= this.peak) {
      this.peak = levelDb
      this.holdUntil = nowMs + this.holdMs
    } else if (nowMs > this.holdUntil) {
      this.peak = Math.max(this.level, this.peak - (this.fallDbPerS * Math.max(0, dtMs)) / 1000)
    }
  }

  reset(): void {
    this.level = -120
    this.peak = -120
    this.holdUntil = 0
  }
}

/** How many of `segments` LEDs light for `levelDb`, the first at `fromDb` and the last at `toDb`; and which one holds the peak (-1 for none). */
export function barLit(levelDb: number, peakDb: number, segments: number, fromDb: number, toDbMax: number): { lit: number; peak: number } {
  const at = (db: number): number => (db < fromDb ? -1 : Math.min(segments - 1, Math.floor(((db - fromDb) / (toDbMax - fromDb)) * (segments - 1) + 1e-9)))
  return { lit: at(levelDb) + 1, peak: at(peakDb) }
}

/** 32-bit string hash (a channel's phase in the demo signal). */
function hash(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}

/**
 * A music-like level, deterministic in (bus, time): a slow phrase envelope, a beat with decaying accents, and a little flutter, in
 * dBFS (about -40 in the gaps up to -4 on an accent). Every bus has its own phase and tempo offset so a console's strips do not move
 * in unison. Stands in for the real signal until the console software drives the buses.
 */
export function demoLevelDb(bus: string, tSec: number): number {
  const p = hash(bus)
  const bpm = 100 + Math.floor(p * 40)
  const beat = (tSec * bpm) / 60 + p * 8
  const frac = beat - Math.floor(beat)
  const accent = Math.exp(-frac * 5) * (0.55 + 0.45 * Math.sin(Math.floor(beat) * 1.7 + p * 20))
  const phrase = 0.5 + 0.5 * Math.sin(tSec * 0.31 + p * 12)
  const flutter = 0.5 + 0.5 * Math.sin(tSec * 7.3 + p * 31) * Math.sin(tSec * 3.1 + p * 5)
  const amp = clamp01(0.08 + 0.55 * phrase * (0.35 + 0.65 * accent) + 0.12 * flutter * phrase)
  return Math.max(-60, toDb(amp) - 3)
}

export { toDb as linearToDb, toLinear as dbToLinear }
