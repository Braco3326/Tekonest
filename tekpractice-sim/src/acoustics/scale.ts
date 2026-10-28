/**
 * The locked relative scale and the statistics of a field (Task 36, ADR-0015; P17). Pure.
 *
 * Silence is `-Infinity` (nothing is fed): it is the quietest bin and it is not a statistic (see `stats`).
 */

/** Edges of the 8 bins of the relative scale: 0 to −24 dB in 3 dB steps (« 0 = point le plus fort »). */
export const SCALE_STEPS_DB = [0, -3, -6, -9, -12, -15, -18, -21, -24] as const

/**
 * Bin 0..7 of a relative level, clamped to [−24, 0]. Bin k holds (−3(k+1), −3k]: an edge belongs to the bin it starts (−3 → 1), the last
 * bin is open downward (−24, −40 and −Infinity → 7), anything above 0 is bin 0. NaN (never produced by `computeField`) → 7.
 */
export function scaleBin(relDb: number): number {
  if (Number.isNaN(relDb)) return 7
  const c = Math.min(0, Math.max(-24, relDb))
  return Math.min(7, Math.floor((0 - c) / 3)) // `0 - c`, not `-c`: scaleBin(0) is +0, never −0
}

/**
 * min / max / mean / standard deviation / count of a relative field, on the UNCLAMPED values (P17: the −24 dB floor of the colour scale
 * must not hide how uneven the coverage is). `sd` is the POPULATION standard deviation (divides by n). Only points that receive sound
 * (finite relative level) take part; `-Infinity` points (nothing fed) are left out and not counted. Sentinel: when `count` is 0 (no points,
 * or all silent) every number is 0: the caller must read `count` before showing the figures.
 */
export function stats(relDb: Float32Array): { min: number; max: number; mean: number; sd: number; count: number } {
  let count = 0
  let sum = 0
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < relDb.length; i++) {
    const v = relDb[i]
    if (!Number.isFinite(v)) continue
    count++
    sum += v
    if (v < min) min = v
    if (v > max) max = v
  }
  if (count === 0) return { min: 0, max: 0, mean: 0, sd: 0, count: 0 }
  const mean = sum / count
  let sq = 0 // two-pass: no cancellation on a large uniform field
  for (let i = 0; i < relDb.length; i++) {
    const v = relDb[i]
    if (Number.isFinite(v)) sq += (v - mean) * (v - mean)
  }
  return { min, max, mean, sd: Math.sqrt(sq / count), count }
}
