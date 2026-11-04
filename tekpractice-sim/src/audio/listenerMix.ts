/**
 * The listener mix (Task 39, C9, C14, CA-03). Pure: no DOM, no Web Audio, no Babylon, no store. What each powered speaker contributes at the
 * listener's ears, from geometry alone:
 *
 *   geom  = 1 / max(r, 0.5 m) · 10^(dirDb/20)                       (the geometry gain of a speaker)
 *   gain  = (geom / the largest geom of the feeds) · 10^(gainDb/20)  (0 when muted or when the fader is at −inf)
 *   delay = r / 343 − (the smallest r / 343 of the feeds)           (the nearest voice has none; capped at the 1 s delay line)
 *   pan   = dot(horizontal unit vector listener → speaker, listener RIGHT), clamped to [−1, 1]
 *
 * `right` is the camera's RENDERED right vector, handed in by the caller (src/creation/listenerPose.ts reads it off the view matrix): this module
 * never assumes a handedness (P14: facing −z in Babylon's left-handed world the right is world −x, so a speaker at world +x pans LEFT).
 * `dirDb` is `directivityDb(...)` toward the listener (src/acoustics/field.ts), computed by the caller from the speaker's pose: it is not
 * re-implemented here. The 0.5 m floor is the one of `levelDb` (tests/audio/layering.test.ts checks they agree).
 *
 * LOUDNESS NORMALISATION (controller ruling, Task 39 review): the loudest speaker's geometry gain, taken BEFORE the fader and the mute, is unity. The ratios
 * between speakers (1/r, directivity), the delays and the pans are untouched, the faders still scale the level, a mute / −inf is exactly 0, and nothing
 * audible (every geometry gain 0 or not finite) is all 0. So the ABSOLUTE level is a constant of the engine (its master gain), not a function of the
 * distance: a listener 40 m from the only speaker hears it as loud as one at 2 m. This keeps the sound audible at any seat; it is not a realism claim.
 * Not finite input (a NaN position, a NaN directivity) is « no sound » for that voice: the audio graph never receives NaN or Infinity.
 *
 * A SIMPLE simulation: level, delay and left–right placement from the geometry. No room acoustics, no frequency response, no reflections, no
 * crosstalk between the speakers.
 */
export const SPEED_OF_SOUND = 343
/** Distances below this are treated as this (the same floor as `levelDb`'s `max(r, 0.5)`). */
export const MIN_DISTANCE_M = 0.5
/** The longest delay a voice may ask for (the engine's DelayNode `maxDelayTime`). */
export const MAX_DELAY_S = 1

export interface MixInput {
  listener: { position: [number, number, number]; right: [number, number, number] }
  feeds: { instanceId: string; position: [number, number, number]; channels: ('L' | 'R')[]; gainDb: number; muted: boolean; dirDb: number /* directivityDb toward the listener */ }[]
}
export interface MixVoice {
  instanceId: string
  channels: ('L' | 'R')[]
  gain: number
  delayS: number
  pan: number
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

export function listenerMix(input: MixInput): MixVoice[] {
  const { position: p, right } = input.listener
  // Only the horizontal part of `right` matters (the speaker's height is ignored in the pan); a unit vector keeps the pan in [−1, 1].
  const rh = Math.hypot(right[0], right[2])
  const rx = rh > 1e-12 ? right[0] / rh : 0
  const rz = rh > 1e-12 ? right[2] / rh : 0
  const geo = input.feeds.map((f) => {
    const dx = f.position[0] - p[0]
    const dz = f.position[2] - p[2]
    const h = Math.hypot(dx, dz)
    const r = Math.hypot(dx, f.position[1] - p[1], dz)
    // The geometry gain: 1/r (floored) times the directivity toward the listener. A non-finite one is « no sound », never NaN in the graph.
    const g = (10 ** (f.dirDb / 20)) / Math.max(r, MIN_DISTANCE_M)
    return { r, dot: h > 1e-12 ? (dx / h) * rx + (dz / h) * rz : 0, g: Number.isFinite(g) && g > 0 ? g : 0 }
  })
  const nearest = geo.reduce((m, g) => (Number.isFinite(g.r) ? Math.min(m, g.r) : m), Infinity) // over every feed, muted or not: muting one never shifts the others
  // LOUDNESS NORMALISATION: the loudest speaker's geometry gain (before fader and mute) is unity. Ratios, delays and pans are untouched; the absolute
  // level is the engine's master constant, not the distance (this is not a realism claim). Nothing audible (all 0) → all 0.
  const loudest = geo.reduce((m, g) => Math.max(m, g.g), 0)
  return input.feeds.map((f, i) => {
    const silent = f.muted || f.gainDb === -Infinity || Number.isNaN(f.gainDb) || loudest === 0
    const gain = silent ? 0 : (geo[i].g / loudest) * 10 ** (f.gainDb / 20)
    const delay = Number.isFinite(nearest) && Number.isFinite(geo[i].r) ? (geo[i].r - nearest) / SPEED_OF_SOUND : 0
    return {
      instanceId: f.instanceId,
      channels: [...f.channels],
      gain: Number.isFinite(gain) ? gain : 0,
      delayS: Number.isFinite(delay) ? clamp(delay, 0, MAX_DELAY_S) : 0,
      pan: Number.isFinite(geo[i].dot) ? clamp(geo[i].dot, -1, 1) + 0 : 0, // `+ 0`: a −0 becomes +0
    }
  })
}
