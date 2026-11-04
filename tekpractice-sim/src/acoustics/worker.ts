/**
 * The coverage Web Worker (Task 37): thin. It receives a `CoverageJob`, runs `runCoverageJob` (the pure core) and posts the `CoverageReply` with
 * its big buffers TRANSFERRED (no copy). The ONE exception of the acoustics folder to the « no worker global » rule of the core (ADR-0015):
 * it may use `self` / `postMessage`; it imports only `./job` (which imports the core).
 */
import { runCoverageJob, type CoverageFailure, type CoverageJob } from './job'

interface WorkerScope {
  onmessage: ((e: { data: unknown }) => void) | null
  postMessage(message: unknown, transfer?: Transferable[]): void
}
const scope = self as unknown as WorkerScope

scope.onmessage = (e) => {
  const job = e.data as CoverageJob
  try {
    const reply = runCoverageJob(job)
    scope.postMessage(reply, [reply.relDb.buffer, reply.overlap.buffer, reply.probeRelDb.buffer])
  } catch (err) {
    const failure: CoverageFailure = { jobId: job.jobId, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) }
    scope.postMessage(failure)
  }
}
