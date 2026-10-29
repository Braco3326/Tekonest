/**
 * Task 37: the coverage client (debounce, stale answers, transferred buffers, dispose) with a fake worker and fake timers, and the job runner the
 * worker wraps (`runCoverageJob`: the field, the statistics, the probes, the NaN contract). No real Worker: the worker file is a thin shell.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CoverageClient, type MessagePortLike } from '../../src/acoustics/client'
import type { AcSource } from '../../src/acoustics/field'
import { runCoverageJob, type CoverageReply } from '../../src/acoustics/job'

class FakeWorker implements MessagePortLike {
  posted: { message: { jobId: number; points: Float32Array; probes?: Float32Array }; transfer: Transferable[] | undefined }[] = []
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  terminated = 0
  postMessage(message: unknown, transfer?: Transferable[]): void {
    this.posted.push({ message: message as never, transfer })
  }
  terminate(): void {
    this.terminated++
  }
  reply(data: unknown): void {
    this.onmessage?.({ data })
  }
}
const src = (over: Partial<AcSource> = {}): AcSource => ({ id: 'a', pose: { position: [0, 0, 0], yawDeg: 0, tiltDeg: 0 }, hDeg: 90, vDeg: 60, lRefDb: 0, ...over })
const job = (n = 2) => ({ sources: [src()], points: new Float32Array(3 * n) })
const answer = (jobId: number): CoverageReply => ({ jobId, relDb: new Float32Array(2), overlap: new Uint8Array(2), stats: { min: 0, max: 0, mean: 0, sd: 0, count: 2 }, maxDb: 0, probeRelDb: new Float32Array(0) })

describe('CoverageClient', () => {
  let w: FakeWorker
  let made = 0
  const make = (): FakeWorker => {
    made++
    return (w = new FakeWorker())
  }
  beforeEach(() => {
    vi.useFakeTimers()
    made = 0
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('5 requests inside the 150 ms window post ONE job: the last', () => {
    const c = new CoverageClient(make)
    const ids = [1, 2, 3, 4, 5].map((n) => c.request({ sources: [src({ lRefDb: n })], points: new Float32Array(3) }))
    expect(ids).toEqual([1, 2, 3, 4, 5])
    expect(made).toBe(0) // nothing yet, not even the worker
    vi.advanceTimersByTime(149)
    expect(made).toBe(0)
    vi.advanceTimersByTime(1)
    expect(w.posted).toHaveLength(1)
    expect((w.posted[0].message as unknown as { sources: AcSource[] }).sources[0].lRefDb).toBe(5)
    expect(w.posted[0].message.jobId).toBe(5)
    expect(c.stats).toMatchObject({ requested: 5, posted: 1 })
  })
  it('each request restarts the window (a request at 100 ms pushes the post to 250 ms)', () => {
    const c = new CoverageClient(make)
    c.request(job())
    vi.advanceTimersByTime(100)
    c.request(job())
    vi.advanceTimersByTime(100)
    expect(made).toBe(0)
    vi.advanceTimersByTime(50)
    expect(w.posted).toHaveLength(1)
  })
  it('two requests more than 150 ms apart post two jobs; an idle client posts none', () => {
    const c = new CoverageClient(make)
    vi.advanceTimersByTime(5000)
    expect(made).toBe(0)
    expect(c.stats.posted).toBe(0)
    c.request(job())
    vi.advanceTimersByTime(150)
    c.request(job())
    vi.advanceTimersByTime(150)
    expect(w.posted).toHaveLength(2)
    expect(made).toBe(1) // one worker for the client's life
  })
  it('the debounce is the argument', () => {
    const c = new CoverageClient(make, 40)
    c.request(job())
    vi.advanceTimersByTime(40)
    expect(w.posted).toHaveLength(1)
  })
  it('transfers the buffers: postMessage lists the points (and the probes) as its second argument', () => {
    const c = new CoverageClient(make)
    const points = new Float32Array(6)
    const probes = new Float32Array(3)
    c.request({ sources: [src()], points, probes })
    vi.advanceTimersByTime(150)
    expect(w.posted[0].transfer).toEqual([points.buffer, probes.buffer])
  })
  it('transfers just the points when there are no probes', () => {
    const c = new CoverageClient(make)
    const points = new Float32Array(6)
    c.request({ sources: [src()], points })
    vi.advanceTimersByTime(150)
    expect(w.posted[0].transfer).toEqual([points.buffer])
  })
  it('delivers the answer to the latest request', () => {
    const c = new CoverageClient(make)
    const got: number[] = []
    c.onResult((r) => got.push(r.jobId))
    const id = c.request(job())
    vi.advanceTimersByTime(150)
    expect(c.busy).toBe(true)
    w.reply(answer(id))
    expect(got).toEqual([id])
    expect(c.busy).toBe(false)
    expect(c.stats).toMatchObject({ delivered: 1, dropped: 0 })
  })
  it('DROPS a stale answer: the job was posted, then a newer request was made, then the old answer arrived', () => {
    const c = new CoverageClient(make)
    const got: number[] = []
    c.onResult((r) => got.push(r.jobId))
    const first = c.request(job())
    vi.advanceTimersByTime(150)
    const second = c.request(job())
    w.reply(answer(first)) // arrives while the newer request is still in its debounce
    expect(got).toEqual([])
    expect(c.stats.dropped).toBe(1)
    vi.advanceTimersByTime(150)
    w.reply(answer(first)) // arrives after the newer job was posted too
    expect(got).toEqual([])
    expect(c.stats.dropped).toBe(2)
    w.reply(answer(second))
    expect(got).toEqual([second])
  })
  it('an answer with an unknown id or no id is dropped', () => {
    const c = new CoverageClient(make)
    const got: unknown[] = []
    c.onResult((r) => got.push(r))
    const id = c.request(job())
    vi.advanceTimersByTime(150)
    w.reply({ jobId: id + 7 })
    w.reply(null)
    w.reply('x')
    expect(got).toEqual([])
    expect(c.stats.dropped).toBe(3)
  })
  it('a worker failure for the latest job reaches onError; one for an old job does not', () => {
    const c = new CoverageClient(make)
    const errors: string[] = []
    c.onError((m) => errors.push(m))
    const first = c.request(job())
    vi.advanceTimersByTime(150)
    const second = c.request(job())
    w.reply({ jobId: first, error: 'RangeError: old' })
    expect(errors).toEqual([])
    vi.advanceTimersByTime(150)
    w.reply({ jobId: second, error: 'RangeError: coverage must be positive' })
    expect(errors).toEqual(['RangeError: coverage must be positive'])
    expect(c.busy).toBe(false)
  })
  it('a worker that cannot be created, or that errors at load, reaches onError (the panel says so)', () => {
    const errors: string[] = []
    const c = new CoverageClient(() => {
      throw new Error('no worker here')
    })
    c.onError((m) => errors.push(m))
    c.request(job())
    vi.advanceTimersByTime(150)
    expect(errors).toEqual(['worker: no worker here'])
    expect(c.stats.posted).toBe(0)
    const c2 = new CoverageClient(make)
    c2.onError((m) => errors.push(m))
    c2.request(job())
    vi.advanceTimersByTime(150)
    w.onerror?.({ message: 'chunk 404' })
    expect(errors[1]).toBe('worker: chunk 404')
  })
  it('dispose() cancels a pending post, terminates the worker, detaches it and ignores later requests and answers', () => {
    const c = new CoverageClient(make)
    const got: number[] = []
    c.onResult((r) => got.push(r.jobId))
    const id = c.request(job())
    vi.advanceTimersByTime(150)
    const worker = w
    c.request(job()) // pending debounce
    c.dispose()
    expect(worker.terminated).toBe(1)
    expect(worker.onmessage).toBeNull()
    vi.advanceTimersByTime(1000)
    expect(worker.posted).toHaveLength(1) // the pending post never happened
    worker.onmessage?.({ data: answer(id) })
    expect(got).toEqual([])
    expect(c.request(job())).toBe(-1)
    vi.advanceTimersByTime(1000)
    expect(made).toBe(1)
    c.dispose() // idempotent
    expect(worker.terminated).toBe(1)
  })
  it('dispose() before any job never creates a worker', () => {
    const c = new CoverageClient(make)
    c.request(job())
    c.dispose()
    vi.advanceTimersByTime(1000)
    expect(made).toBe(0)
  })
  it('works with a MessagePort-like (close instead of terminate)', () => {
    let closed = 0
    const port: MessagePortLike = { postMessage: () => undefined, onmessage: null, close: () => void closed++ }
    const c = new CoverageClient(() => port)
    c.request(job())
    vi.advanceTimersByTime(150)
    c.dispose()
    expect(closed).toBe(1)
  })
})

describe('runCoverageJob (what the worker answers)', () => {
  const pts = (...p: number[][]): Float32Array => new Float32Array(p.flat())
  it('answers the field, its statistics and the loudest level, and echoes the job id', () => {
    const r = runCoverageJob({ jobId: 9, sources: [src()], points: pts([0, 0, 2], [0, 0, 4], [0, 0, 8]) })
    expect(r.jobId).toBe(9)
    expect(Array.from(r.relDb).map((v) => Math.round(v * 100) / 100)).toEqual([0, -6.02, -12.04])
    expect(r.stats.count).toBe(3)
    expect(r.stats.max).toBe(0)
    expect(r.stats.min).toBeCloseTo(-12.04, 2)
    expect(r.maxDb).toBeCloseTo(-6.0206, 4)
  })
  it('probes are on the grid scale (0 = loudest GRID point) and take no part in the statistics', () => {
    const r = runCoverageJob({ jobId: 1, sources: [src()], points: pts([0, 0, 2], [0, 0, 4]), probes: pts([0, 0, 4], [0, 0, 1]) })
    expect(r.stats.count).toBe(2)
    expect(r.probeRelDb[0]).toBeCloseTo(-6.02, 2)
    expect(r.probeRelDb[1]).toBeCloseTo(6.02, 2) // louder than every grid point: above 0, honestly
  })
  it('no source (nothing fed): −Infinity everywhere, count 0, never NaN', () => {
    const r = runCoverageJob({ jobId: 1, sources: [], points: pts([0, 0, 2]), probes: pts([0, 0, 3]) })
    expect(r.maxDb).toBe(-Infinity)
    expect(Array.from(r.relDb)).toEqual([-Infinity])
    expect(r.stats).toEqual({ min: 0, max: 0, mean: 0, sd: 0, count: 0 })
    expect(Array.from(r.probeRelDb)).toEqual([-Infinity])
  })
  it('an empty grid with a source: maxDb −Infinity, count 0 (the listener-less room)', () => {
    const r = runCoverageJob({ jobId: 1, sources: [src()], points: new Float32Array(0), probes: pts([0, 0, 3]) })
    expect(r.stats.count).toBe(0)
    expect(r.maxDb).toBe(-Infinity)
    expect(Array.from(r.probeRelDb)).toEqual([-Infinity])
  })
  it('a bad coverage and a ragged probes array are refused (RangeError), as the core does', () => {
    expect(() => runCoverageJob({ jobId: 1, sources: [src({ hDeg: 0 })], points: pts([0, 0, 2]) })).toThrow(RangeError)
    expect(() => runCoverageJob({ jobId: 1, sources: [src()], points: pts([0, 0, 2]), probes: new Float32Array(2) })).toThrow(RangeError)
  })
  it('survives a structured clone (what postMessage does), -Infinity included', () => {
    const r = runCoverageJob({ jobId: 1, sources: [], points: pts([0, 0, 2]) })
    const back = structuredClone(r)
    expect(back.maxDb).toBe(-Infinity)
    expect(Array.from(back.relDb)).toEqual([-Infinity])
  })
})
