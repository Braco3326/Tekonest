/**
 * Direct-field level model (Task 36, ADR-0015; C13, P9, P10). Pure: no Babylon, no DOM, no store, no catalog read. It is meant to run in a
 * Web Worker (Task 37) and is read by src/audio/listenerMix.ts (Task 39, `directivityDb`).
 *
 *   L = L_ref + D(θH, θV) − 20·log10(max(r, 0.5 m))        D = max(−6·u², −30) dB,  u² = (θH/(H/2))² + (θV/(V/2))²
 *
 * -6 dB per doubling of distance; exactly −6 dB at half the nominal H (or V) coverage; −30 dB behind the speaker plane and as the floor.
 * Not modelled: reflections, interference (the overlap flag is only a warning), air absorption, STI. See ADR-0015.
 *
 * NaN contract: nothing returned here is NaN for finite inputs. `-Infinity` is « no sound » (an empty source list, or every feed at −inf):
 * `maxDb` is `-Infinity` and every `relDb` is `-Infinity`.
 */
import { offAxis, type SpeakerPose } from './geometry'

/** One speaker that sends sound. `lRefDb` = the dB gain of its feed (Task 34 `SpeakerFeed.gainDb`, P10); `hDeg` / `vDeg` = catalog coverage angles. */
export interface AcSource {
  id: string
  pose: SpeakerPose
  hDeg: number
  vDeg: number
  lRefDb: number
}

/** Directivity in dB (≤ 0): 0 on axis, −6 at half the coverage, floored at −30; −30 behind the speaker. Throws RangeError for a coverage that is not > 0 and finite. */
export function directivityDb(thetaHdeg: number, thetaVdeg: number, hDeg: number, vDeg: number, rear: boolean): number {
  if (!(hDeg > 0 && vDeg > 0 && Number.isFinite(hDeg) && Number.isFinite(vDeg))) throw new RangeError(`coverage must be positive and finite, got ${hDeg} x ${vDeg}`)
  if (rear) return -30
  const u2 = (thetaHdeg / (hDeg / 2)) ** 2 + (thetaVdeg / (vDeg / 2)) ** 2
  return Math.max(0 - 6 * u2, -30) // `0 - …` so that on axis the result is +0, not −0
}

/** Level of `src` at point `p`: L_ref + D − 20·log10(max(r, 0.5)). The distance is floored at 0.5 m. */
export function levelDb(src: AcSource, p: [number, number, number]): number {
  const a = offAxis(src.pose, p)
  return src.lRefDb + directivityDb(a.thetaHdeg, a.thetaVdeg, src.hDeg, src.vDeg, a.rear) - 20 * Math.log10(Math.max(a.r, 0.5))
}

/** Energetic sum 10·log10(Σ 10^(L/10)) (computed relative to the largest level, so far-negative levels do not underflow). [] or only −Infinity → −Infinity. */
export function energeticSumDb(levels: readonly number[]): number {
  let top = -Infinity
  for (const l of levels) if (l > top) top = l
  if (top === -Infinity) return -Infinity
  let e = 0
  for (const l of levels) e += 10 ** ((l - top) / 10)
  return top + 10 * Math.log10(e)
}

/**
 * `relDb[i]` = level at point i minus the loudest point (so the loudest is exactly 0, the rest ≤ 0; `-Infinity` when nothing is heard at
 * all). `overlap[i]` = 1 when the two loudest contributors at the point are within 6 dB (interference not modelled: the UI hatches it).
 * `maxDb` = the absolute energetic level of the loudest point, in dB relative to the feeds' L_ref scale; `-Infinity` when nothing is heard.
 * `points` = x, y, z triples.
 */
export interface FieldResult {
  relDb: Float32Array
  overlap: Uint8Array
  maxDb: number
}

/** The field of `sources` at `points`. A muted / unfed source is simply left out of `sources` by the caller; a feed at −Infinity counts as absent. */
export function computeField(sources: readonly AcSource[], points: Float32Array): FieldResult {
  if (points.length % 3 !== 0) throw new RangeError(`points must be xyz triples, got length ${points.length}`)
  const n = points.length / 3
  const abs = new Float64Array(n)
  const overlap = new Uint8Array(n)
  const levels: number[] = new Array<number>(sources.length)
  let maxDb = -Infinity
  for (let i = 0; i < n; i++) {
    const p: [number, number, number] = [points[3 * i], points[3 * i + 1], points[3 * i + 2]]
    let first = -Infinity // the two loudest contributors
    let second = -Infinity
    for (let k = 0; k < sources.length; k++) {
      const l = levelDb(sources[k], p)
      levels[k] = l
      if (l > first) {
        second = first
        first = l
      } else if (l > second) second = l
    }
    abs[i] = energeticSumDb(levels)
    // within 6 dB. A silent second contributor (−Infinity) is never an overlap: the difference is +Infinity (or NaN when both are silent),
    // and both compare false against 6 (tested: « a source at −Infinity … is exactly as if it were absent »).
    overlap[i] = first - second <= 6 ? 1 : 0
    if (abs[i] > maxDb) maxDb = abs[i]
  }
  const relDb = new Float32Array(n)
  for (let i = 0; i < n; i++) relDb[i] = abs[i] === -Infinity ? -Infinity : abs[i] - maxDb
  return { relDb, overlap, maxDb }
}
