/**
 * The messages of the coverage worker and the pure function that answers one (Task 37, ADR-0015). No DOM, no Babylon, no worker global:
 * `worker.ts` is the thin shell around `runCoverageJob`, `client.ts` posts the jobs and drops the stale answers. It imports only the core.
 *
 * Numbers only travel here: the sources are plain `AcSource`s (the caller read the catalog), the points are xyz triples in a Float32Array.
 * `-Infinity` (no sound) survives the structured clone, so the sentinel of the core needs no translation.
 */
import { computeField, energeticSumDb, levelDb, type AcSource } from './field'
import { stats } from './scale'

export interface CoverageJob {
  jobId: number
  sources: AcSource[]
  /** The listener grid: x, y, z triples (transferred to the worker: the sender keeps its own copy). */
  points: Float32Array
  /**
   * Extra listener positions (x, y, z triples: the named listening points and the pinned dot). They are answered on the SAME scale as the grid
   * (relative to its loudest point) but take no part in the statistics, the overlap flags or the loudest point.
   */
  probes?: Float32Array
}

export interface CoverageReply {
  jobId: number
  relDb: Float32Array
  overlap: Uint8Array
  stats: ReturnType<typeof stats>
  /** The loudest grid point on the L_ref scale of the feeds (0 = unity feed): NOT a sound pressure level. `-Infinity` when nothing is heard. */
  maxDb: number
  /** One value per probe: its level minus `maxDb` (so it can be above 0 when the probe is louder than every grid point); `-Infinity` = silent. */
  probeRelDb: Float32Array
}

/** A failure the worker could not answer (a RangeError for a bad coverage, say): the client turns it into an `onError` call. */
export interface CoverageFailure {
  jobId: number
  error: string
}

export function isFailure(m: unknown): m is CoverageFailure {
  return typeof m === 'object' && m !== null && typeof (m as CoverageFailure).error === 'string' && typeof (m as CoverageFailure).jobId === 'number'
}

/** Compute one job. Throws the core's RangeError for an invalid coverage or a points array that is not xyz triples. */
export function runCoverageJob(job: CoverageJob): CoverageReply {
  const f = computeField(job.sources, job.points)
  const probes = job.probes ?? new Float32Array(0)
  if (probes.length % 3 !== 0) throw new RangeError(`probes must be xyz triples, got length ${probes.length}`)
  const probeRelDb = new Float32Array(probes.length / 3)
  for (let i = 0; i < probeRelDb.length; i++) {
    const p: [number, number, number] = [probes[3 * i], probes[3 * i + 1], probes[3 * i + 2]]
    const abs = energeticSumDb(job.sources.map((s) => levelDb(s, p)))
    // nothing heard anywhere (maxDb = -Infinity) or at this probe: silent, never NaN (−Infinity − −Infinity)
    probeRelDb[i] = abs === -Infinity || f.maxDb === -Infinity ? -Infinity : abs - f.maxDb
  }
  return { jobId: job.jobId, relDb: f.relDb, overlap: f.overlap, stats: stats(f.relDb), maxDb: f.maxDb, probeRelDb }
}
