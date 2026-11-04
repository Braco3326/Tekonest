/**
 * A fake Web Audio environment for the unit tests (Task 39): records every node, connection, parameter event, element, object URL and timer, so the
 * engine's graph and its LIFECYCLE (everything disconnected, closed, revoked, removed) can be asserted in Node. The real browser behaviour is the e2e's.
 */
import type { AudioEnv } from '../../src/audio/engine'

export interface ParamEvent {
  kind: 'cancel' | 'set' | 'target' | 'linear'
  value?: number
  time: number
  tau?: number
}

export class FakeParam {
  events: ParamEvent[] = []
  constructor(public value = 0) {}
  cancelScheduledValues(time: number): this {
    this.events.push({ kind: 'cancel', time })
    return this
  }
  setValueAtTime(value: number, time: number): this {
    this.events.push({ kind: 'set', value, time })
    return this
  }
  setTargetAtTime(value: number, time: number, tau: number): this {
    this.events.push({ kind: 'target', value, time, tau })
    return this
  }
  linearRampToValueAtTime(value: number, time: number): this {
    this.events.push({ kind: 'linear', value, time })
    return this
  }
  of(kind: ParamEvent['kind']): ParamEvent[] {
    return this.events.filter((e) => e.kind === kind)
  }
}

export class FakeNode {
  readonly out: { to: FakeNode; output: number; input: number }[] = []
  disconnected = 0
  constructor(readonly type: string, readonly ctx: FakeContext) {
    ctx.nodes.push(this)
  }
  connect(to: FakeNode, output = 0, input = 0): FakeNode {
    this.out.push({ to, output, input })
    return to
  }
  /** Like the real one: throws when there is nothing to disconnect. */
  disconnect(to?: FakeNode, output?: number): void {
    if (to === undefined) {
      this.disconnected++
      this.out.length = 0
      return
    }
    const before = this.out.length
    for (let i = this.out.length - 1; i >= 0; i--) if (this.out[i].to === to && (output === undefined || this.out[i].output === output)) this.out.splice(i, 1)
    if (this.out.length === before) throw new Error('InvalidAccessError: no such connection')
  }
  feeds(to: FakeNode, output?: number): boolean {
    return this.out.some((c) => c.to === to && (output === undefined || c.output === output))
  }
}

export class FakeGain extends FakeNode {
  gain = new FakeParam(1)
  channelCount = 2
  channelCountMode = 'max'
  channelInterpretation = 'speakers'
  constructor(ctx: FakeContext) {
    super('gain', ctx)
  }
}
export class FakeDelay extends FakeNode {
  delayTime = new FakeParam(0)
  constructor(ctx: FakeContext, readonly maxDelayTime: number) {
    super('delay', ctx)
  }
}
export class FakePanner extends FakeNode {
  pan = new FakeParam(0)
  constructor(ctx: FakeContext) {
    super('panner', ctx)
  }
}
export class FakeAnalyser extends FakeNode {
  fftSize = 2048
  /** Set by a test: the constant sample value the analyser reports. */
  level = 0
  constructor(ctx: FakeContext) {
    super('analyser', ctx)
  }
  getFloatTimeDomainData(buf: Float32Array): void {
    buf.fill(this.level)
  }
}
export class FakeCompressor extends FakeNode {
  threshold = new FakeParam()
  knee = new FakeParam()
  ratio = new FakeParam()
  attack = new FakeParam()
  release = new FakeParam()
  constructor(ctx: FakeContext) {
    super('compressor', ctx)
  }
}
export class FakeBufferSource extends FakeNode {
  buffer: unknown = null
  loop = false
  started = 0
  stopped = 0
  constructor(ctx: FakeContext) {
    super('buffersource', ctx)
  }
  start(): void {
    this.started++
  }
  stop(): void {
    this.stopped++
  }
}
export class FakeMediaSource extends FakeNode {
  constructor(ctx: FakeContext, readonly element: FakeAudioElement) {
    super('mediasource', ctx)
  }
}

export class FakeContext {
  nodes: FakeNode[] = []
  state: 'suspended' | 'running' | 'closed' = 'suspended'
  currentTime = 0
  sampleRate = 48000
  closeCalls = 0
  resumeCalls = 0
  destination = new FakeNode('destination', this)
  /** Set by a test: resume() stays pending until `releaseResume()` (a suspended context that never starts). */
  deferResume = false
  private resumeWaiters: (() => void)[] = []
  async resume(): Promise<void> {
    this.resumeCalls++
    if (this.deferResume) await new Promise<void>((r) => this.resumeWaiters.push(r))
    this.state = 'running'
  }
  releaseResume(): void {
    for (const r of this.resumeWaiters.splice(0)) r()
  }
  async close(): Promise<void> {
    this.closeCalls++
    if (this.state === 'closed') throw new Error('InvalidStateError: already closed')
    this.state = 'closed'
  }
  createChannelSplitter(): FakeNode {
    return new FakeNode('splitter', this)
  }
  createGain(): FakeGain {
    return new FakeGain(this)
  }
  createDelay(max: number): FakeDelay {
    return new FakeDelay(this, max)
  }
  createStereoPanner(): FakePanner {
    return new FakePanner(this)
  }
  createAnalyser(): FakeAnalyser {
    return new FakeAnalyser(this)
  }
  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor(this)
  }
  createBufferSource(): FakeBufferSource {
    return new FakeBufferSource(this)
  }
  createMediaElementSource(el: FakeAudioElement): FakeMediaSource {
    return new FakeMediaSource(this, el)
  }
  ofType<T extends FakeNode>(type: string): T[] {
    return this.nodes.filter((n) => n.type === type) as T[]
  }
}

export class FakeAudioElement {
  src = ''
  loop = false
  paused = true
  removed = false
  loads = 0
  /** Set by a test: make play() reject (an undecodable file). */
  failPlay = false
  /** Set by a test: play() stays pending until `releasePlay()` (a large file being decoded). */
  deferPlay = false
  ended = false
  private playWaiters: (() => void)[] = []
  releasePlay(): void {
    for (const r of this.playWaiters.splice(0)) r()
  }
  listeners = new Map<string, Set<() => void>>()
  addEventListener(type: string, fn: () => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(fn)
  }
  removeEventListener(type: string, fn: () => void): void {
    this.listeners.get(type)?.delete(fn)
  }
  dispatch(type: string): void {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn()
  }
  async play(): Promise<void> {
    if (this.failPlay) throw new DOMException('The element has no supported sources.', 'NotSupportedError')
    if (this.deferPlay) await new Promise<void>((r) => this.playWaiters.push(r))
    this.paused = false
  }
  pause(): void {
    this.paused = true
  }
  removeAttribute(name: string): void {
    if (name === 'src') this.src = ''
  }
  load(): void {
    this.loads++
  }
  remove(): void {
    this.removed = true
  }
  get liveListeners(): number {
    return [...this.listeners.values()].reduce((n, s) => n + s.size, 0)
  }
}

export interface FakeEnvHandle {
  env: AudioEnv
  contexts: FakeContext[]
  elements: FakeAudioElement[]
  urls: { created: string[]; revoked: string[] }
  timers: { id: number; fn: () => void; ms: number }[]
  cleared: number[]
  /** Run (and drop) every pending timer. */
  flushTimers(): void
  /** The test signal's renderTest: pending until `release()`; `renders` counts calls. */
  renders: number
  release(): void
  /** Make renderTest reject. */
  failRender(): void
}

/** `deferRender`: the test signal's buffer arrives only on `release()` (to stage a stop / dispose while it is being made). */
export function fakeEnv(opts: { deferRender?: boolean } = {}): FakeEnvHandle {
  const h: FakeEnvHandle = {
    contexts: [],
    elements: [],
    urls: { created: [], revoked: [] },
    timers: [],
    cleared: [],
    renders: 0,
    flushTimers() {
      for (const t of h.timers.splice(0)) t.fn()
    },
    release: () => undefined,
    failRender: () => undefined,
    env: undefined as unknown as AudioEnv,
  }
  let seq = 0
  let waiting: { resolve: (b: unknown) => void; reject: (e: unknown) => void }[] = []
  h.release = () => {
    for (const w of waiting.splice(0)) w.resolve({ fake: 'buffer' })
  }
  h.failRender = () => {
    for (const w of waiting.splice(0)) w.reject(new Error('render failed'))
  }
  h.env = {
    createContext: () => {
      const c = new FakeContext()
      h.contexts.push(c)
      return c as unknown as AudioContext
    },
    createAudio: () => {
      const e = new FakeAudioElement()
      h.elements.push(e)
      return e as unknown as HTMLAudioElement
    },
    createObjectURL: () => {
      const u = `blob:fake/${++seq}`
      h.urls.created.push(u)
      return u
    },
    revokeObjectURL: (u) => void h.urls.revoked.push(u),
    renderTest: () => {
      h.renders++
      if (!opts.deferRender) return Promise.resolve({ fake: 'buffer' } as unknown as AudioBuffer)
      return new Promise<AudioBuffer>((resolve, reject) => waiting.push({ resolve: resolve as (b: unknown) => void, reject }))
    },
    setTimeout: (fn, ms) => {
      const id = ++seq
      h.timers.push({ id, fn, ms })
      return id
    },
    clearTimeout: (id) => {
      h.cleared.push(id)
      const i = h.timers.findIndex((t) => t.id === id)
      if (i >= 0) h.timers.splice(i, 1)
    },
  }
  return h
}
