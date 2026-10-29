/**
 * The coverage client (Task 37): owns the worker, debounces the requests and drops the stale answers. It imports only `./job` (no DOM, no
 * Babylon, no store): the worker is built by the caller (`makeWorker`), so a test hands in a fake one.
 *
 * - `request()` is cheap and may be called on every store change: it only remembers the latest job and (re)starts the debounce timer. After
 *   `debounceMs` (150) without a new request ONE job is posted, so 5 requests inside the window post one job (the last).
 * - Every request gets an id (`jobId`, increasing, returned by `request`). An answer is delivered only when its id is the latest REQUESTED one:
 *   an answer to an older request is dropped (« stale »), even when its job had been posted.
 * - The big buffers of the job are TRANSFERRED to the worker (`postMessage(job, [buffers])`): the caller must keep its own copy of what it needs.
 * - `dispose()` clears the timer, detaches the handlers and terminates the worker. Idempotent. A request after `dispose()` is ignored.
 */
import { isFailure, type CoverageJob, type CoverageReply } from './job'

/** A Worker, or anything shaped like one (a MessagePort, a test double). */
export interface MessagePortLike {
  postMessage(message: unknown, transfer?: Transferable[]): void
  onmessage: ((e: { data: unknown }) => void) | null
  onerror?: ((e: unknown) => void) | null
  terminate?(): void
  close?(): void
}

export interface CoverageClientStats {
  /** Calls to `request()`. */
  requested: number
  /** Jobs posted to the worker (what the e2e counts: idle = 0, a moved speaker = +1). */
  posted: number
  /** Answers delivered to `onResult` listeners. */
  delivered: number
  /** Answers dropped because a newer request exists. */
  dropped: number
}

export class CoverageClient {
  private worker: MessagePortLike | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private latest: CoverageJob | null = null
  private seq = 0
  private disposed = false
  private inFlight = false
  private readonly results = new Set<(r: CoverageReply) => void>()
  private readonly errors = new Set<(message: string) => void>()
  private counts: CoverageClientStats = { requested: 0, posted: 0, delivered: 0, dropped: 0 }

  constructor(
    private readonly makeWorker: () => MessagePortLike,
    private readonly debounceMs = 150
  ) {}

  /** The id the request got. The answer to it (if no newer request exists by then) reaches `onResult`. */
  request(job: Omit<CoverageJob, 'jobId'>): number {
    if (this.disposed) return -1
    const jobId = ++this.seq
    this.counts.requested++
    this.latest = { ...job, jobId }
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.post(), this.debounceMs)
    return jobId
  }

  /** The id of the latest request (0 before any). */
  get latestId(): number {
    return this.seq
  }

  /** A request is waiting for its debounce or for its answer. */
  get busy(): boolean {
    return this.timer !== null || this.inFlight
  }

  get stats(): Readonly<CoverageClientStats> {
    return this.counts
  }

  /** Returns the remover. */
  onResult(fn: (r: CoverageReply) => void): () => void {
    this.results.add(fn)
    return () => void this.results.delete(fn)
  }

  /** A job the worker could not answer, or a worker that failed to load. Returns the remover. */
  onError(fn: (message: string) => void): () => void {
    this.errors.add(fn)
    return () => void this.errors.delete(fn)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.latest = null
    this.inFlight = false
    this.results.clear()
    this.errors.clear()
    const w = this.worker
    this.worker = null
    if (w) {
      w.onmessage = null
      w.onerror = null
      w.terminate?.()
      w.close?.()
    }
  }

  private ensureWorker(): MessagePortLike | null {
    if (this.worker) return this.worker
    try {
      const w = this.makeWorker()
      w.onmessage = (e) => this.receive(e.data)
      w.onerror = (e) => this.fail(`worker: ${messageOf(e)}`)
      this.worker = w
      return w
    } catch (e) {
      this.fail(`worker: ${messageOf(e)}`)
      return null
    }
  }

  private post(): void {
    this.timer = null
    const job = this.latest
    this.latest = null
    if (!job || this.disposed) return
    const w = this.ensureWorker()
    if (!w) return
    this.counts.posted++
    this.inFlight = true
    const transfer: Transferable[] = [job.points.buffer]
    if (job.probes) transfer.push(job.probes.buffer)
    w.postMessage(job, transfer)
  }

  private receive(data: unknown): void {
    if (this.disposed) return
    const id = typeof data === 'object' && data !== null ? (data as { jobId?: unknown }).jobId : undefined
    if (id !== this.seq) {
      this.counts.dropped++ // stale: a newer request exists (or an unknown id)
      return
    }
    this.inFlight = false
    if (isFailure(data)) return this.fail(data.error)
    this.counts.delivered++
    for (const fn of [...this.results]) fn(data as CoverageReply)
  }

  private fail(message: string): void {
    this.inFlight = false
    for (const fn of [...this.errors]) fn(message)
  }
}

function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}
