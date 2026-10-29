/**
 * The Web Audio adapter (Task 39, C9, C14, CA-03, CA-26, S3). A LAZY chunk: nothing here is loaded until the first « Lecture ».
 *
 *   source ─▶ ChannelSplitter(2) ─▶ per voice: [L and/or R] ─▶ Gain ─▶ Delay(≤ 1 s) ─▶ StereoPanner ─▶ Analyser (meter) ─▶ master Gain ─▶ limiter ─▶ destination
 *
 * The voices come from the pure `listenerMix` (gain, delay, pan per powered speaker); `update()` moves the three parameters with
 * `setTargetAtTime(…, 0.02)` so a mix change never clicks. A voice whose gain is 0 (muted, fader at −inf) is snapped to EXACTLY 0 once the ramp has
 * settled. A speaker fed by both channels takes (L + R) / 2, so a mono file keeps its level and a stereo one never clips by the sum.
 *
 * HEARING SAFETY (controller ruling, L31): audio never starts loud.
 *   - master gain `MASTER_GAIN_DB` = −18 dBFS (× 0.126) before anything reaches the destination;
 *   - a DynamicsCompressorNode set as a limiter (threshold −3 dBFS, knee 0, ratio 20, attack 3 ms, release 100 ms) sits between master and destination;
 *   - a 80 ms linear fade-in when the source starts and a 80 ms fade-out when it stops (no click); `dispose()` is immediate.
 *
 * Privacy (S3): a local file is played from `URL.createObjectURL(file)` through an <audio> element and a MediaElementAudioSourceNode. It is never
 * fetched, uploaded or stored: the object URL is revoked and the element removed on stop / dispose. No song is bundled (content/songs.json is empty);
 * a `song` source is a same-origin URL handed in by the caller.
 *
 * Browser classes are reached through an injected `AudioEnv` (the app builds the real one), so the lifecycle is unit-tested with a fake context.
 */
import { MAX_DELAY_S, type MixVoice } from './listenerMix'
import { renderTestSignal } from './testSignal'

export const MASTER_GAIN_DB = -18
export const MASTER_GAIN = 10 ** (MASTER_GAIN_DB / 20)
export const FADE_IN_S = 0.08
export const FADE_OUT_S = 0.08
/** Time constant of every parameter ramp in `update()` (the brief's 0.02). */
export const PARAM_TAU_S = 0.02
/** After this many seconds (10 time constants: 0.005 % of the start value left) a ramp to 0 is snapped to exactly 0. */
export const SNAP_ZERO_S = 10 * PARAM_TAU_S
export const LIMITER = { threshold: -3, knee: 0, ratio: 20, attack: 0.003, release: 0.1 } as const
const METER_FFT = 1024

export type PlaySource = { kind: 'song'; url: string } | { kind: 'file'; file: File } | { kind: 'test' }

/** Everything the engine takes from the browser. */
export interface AudioEnv {
  createContext(): AudioContext
  /** A detached-or-hidden <audio> element the engine owns and removes. */
  createAudio(): HTMLAudioElement
  createObjectURL(blob: Blob): string
  revokeObjectURL(url: string): void
  /** The generated test signal for this context (stereo, looped by the engine). */
  renderTest(ctx: AudioContext): Promise<AudioBuffer>
  setTimeout(fn: () => void, ms: number): number
  clearTimeout(id: number): void
}

/** Counters over the page's life (the e2e checks that nothing leaks: every context closed, every URL revoked, every element removed). */
export const audioStats = { contexts: { opened: 0, closed: 0 }, urls: { created: 0, revoked: 0 }, elements: { created: 0, removed: 0 } }

let testBuffer: { sampleRate: number; buffer: Promise<AudioBuffer> } | null = null

/** The real environment. Browser globals are read here, at call time, never at import. */
export function browserEnv(): AudioEnv {
  return {
    createContext: () => {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      return new Ctor({ latencyHint: 'playback' })
    },
    createAudio: () => {
      const el = document.createElement('audio')
      el.hidden = true
      el.preload = 'auto'
      el.dataset.testid = 'listen-audio'
      document.body.appendChild(el)
      return el
    },
    createObjectURL: (b) => URL.createObjectURL(b),
    revokeObjectURL: (u) => URL.revokeObjectURL(u),
    renderTest: (ctx) => {
      // One rendering per sample rate for the page (a few MB); a failure is not cached.
      if (!testBuffer || testBuffer.sampleRate !== ctx.sampleRate) {
        const buffer = renderTestSignal(window.OfflineAudioContext, ctx.sampleRate)
        testBuffer = { sampleRate: ctx.sampleRate, buffer }
        buffer.catch(() => (testBuffer = null))
      }
      return testBuffer.buffer
    },
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id),
  }
}

interface Chain {
  gain: GainNode
  delay: DelayNode
  pan: StereoPannerNode
  analyser: AnalyserNode
  buf: Float32Array<ArrayBuffer>
  channels: ('L' | 'R')[]
  target: { gain: number; delayS: number; pan: number }
}

/** What the debug hook and the panel read: the targets last asked for (not the live parameter values). */
export interface EngineSnapshot {
  state: AudioContextState
  playing: boolean
  stopping: boolean
  source: PlaySource['kind'] | null
  voices: { instanceId: string; channels: ('L' | 'R')[]; gain: number; delayS: number; pan: number }[]
}

export class AudioEngine {
  static create(env: AudioEnv = browserEnv()): Promise<AudioEngine> {
    try {
      return Promise.resolve(new AudioEngine(env))
    } catch (e) {
      return Promise.reject(e)
    }
  }

  /** Told when the source ends by itself (a local file or a song reaching its end); never for the looped test signal. */
  onEnded: (() => void) | null = null
  /** Resolves when everything is released (after `stop()`'s fade, or `dispose()`). */
  readonly closed: Promise<void>

  private readonly ctx: AudioContext
  private readonly splitter: ChannelSplitterNode
  private readonly master: GainNode
  private readonly limiter: DynamicsCompressorNode
  private readonly chains = new Map<string, Chain>()
  private src: { node: AudioNode; stop(): void } | null = null
  private el: HTMLAudioElement | null = null
  private url: string | null = null
  private kind: PlaySource['kind'] | null = null
  private seq = 0
  private starting = false
  private playingNow = false
  private stopping = false
  private isDisposed = false
  private timer: number | null = null
  private resolveClosed!: () => void
  private elEnded: (() => void) | null = null

  private constructor(private readonly env: AudioEnv) {
    this.closed = new Promise<void>((r) => (this.resolveClosed = r))
    const ctx = env.createContext()
    audioStats.contexts.opened++
    this.ctx = ctx
    this.splitter = ctx.createChannelSplitter(2)
    this.master = ctx.createGain()
    this.master.gain.value = 0 // the fade-in raises it; nothing is audible before the source starts
    this.limiter = ctx.createDynamicsCompressor()
    this.limiter.threshold.value = LIMITER.threshold
    this.limiter.knee.value = LIMITER.knee
    this.limiter.ratio.value = LIMITER.ratio
    this.limiter.attack.value = LIMITER.attack
    this.limiter.release.value = LIMITER.release
    this.master.connect(this.limiter)
    this.limiter.connect(ctx.destination)
  }

  get disposed(): boolean {
    return this.isDisposed
  }
  get playing(): boolean {
    return this.playingNow && !this.stopping && !this.isDisposed
  }

  snapshot(): EngineSnapshot {
    return {
      state: this.isDisposed ? 'closed' : this.ctx.state,
      playing: this.playing,
      stopping: this.stopping,
      source: this.kind,
      voices: [...this.chains.entries()].map(([instanceId, c]) => ({ instanceId, channels: [...c.channels], ...c.target })),
    }
  }

  /** Start the source. One source per engine: the caller makes a new engine to change it. Resolves quietly when stopped or disposed meanwhile; rejects when the source cannot play. */
  async play(source: PlaySource): Promise<void> {
    if (this.isDisposed || this.stopping) return
    if (this.starting || this.playingNow) throw new Error('AudioEngine: one source per engine')
    const seq = ++this.seq
    this.starting = true
    this.kind = source.kind
    const stale = (): boolean => this.isDisposed || this.stopping || this.seq !== seq
    try {
      await this.ctx.resume() // the context was made in the « Lecture » gesture; with the browser's policy it may start suspended
      if (stale()) return
      if (source.kind === 'test') {
        const buffer = await this.env.renderTest(this.ctx)
        if (stale()) return
        const bs = this.ctx.createBufferSource()
        bs.buffer = buffer
        bs.loop = true
        this.src = {
          node: bs,
          stop: () => {
            try {
              bs.stop()
            } catch {
              /* not started */
            }
          },
        }
        bs.connect(this.splitter)
        this.fadeIn()
        bs.start()
      } else {
        const el = this.env.createAudio()
        audioStats.elements.created++
        this.el = el
        if (source.kind === 'file') {
          this.url = this.env.createObjectURL(source.file)
          audioStats.urls.created++
          el.src = this.url
        } else el.src = source.url
        el.loop = false
        this.elEnded = () => {
          if (!this.isDisposed && !this.stopping) this.onEnded?.()
        }
        el.addEventListener('ended', this.elEnded)
        const mes = this.ctx.createMediaElementSource(el)
        this.src = { node: mes, stop: () => el.pause() }
        mes.connect(this.splitter)
        this.fadeIn()
        await el.play() // rejects for a file the browser cannot decode
        if (stale()) return
      }
      this.playingNow = true
    } catch (e) {
      // A failed start leaves nothing behind: the URL, the element and the nodes of this attempt go; the engine stays usable only to be disposed.
      if (!stale()) this.releaseSource()
      throw e
    } finally {
      this.starting = false
    }
  }

  /** Fade out (80 ms, no click), then release everything. Idempotent. A play() still in flight resolves quietly. */
  stop(): void {
    if (this.isDisposed || this.stopping) return
    this.stopping = true
    this.seq++
    const now = this.ctx.currentTime
    const g = this.master.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(0, now + FADE_OUT_S)
    this.timer = this.env.setTimeout(() => {
      this.timer = null
      this.dispose()
    }, FADE_OUT_S * 1000 + 40)
  }

  /** The voices of the pure mix. Creates a chain for a new speaker, drops the ones that left, ramps the rest. */
  update(voices: readonly MixVoice[]): void {
    if (this.isDisposed || this.stopping) return
    const keep = new Set(voices.map((v) => v.instanceId))
    for (const [id, chain] of this.chains) {
      if (!keep.has(id)) {
        this.dropChain(chain)
        this.chains.delete(id)
      }
    }
    const now = this.ctx.currentTime
    for (const v of voices) {
      let chain = this.chains.get(v.instanceId)
      // Both sides: (L + R) / 2. One side: that side as it is.
      const weight = v.channels.length > 1 ? 1 / v.channels.length : 1
      const target = { gain: v.gain * weight, delayS: Math.min(Math.max(v.delayS, 0), MAX_DELAY_S), pan: Math.min(Math.max(v.pan, -1), 1) }
      if (!chain) {
        chain = this.makeChain(v.channels, target)
        this.chains.set(v.instanceId, chain)
        this.setParam(chain.gain.gain, target.gain, now, true)
        continue
      }
      if (chain.channels.join() !== v.channels.join()) this.wire(chain, v.channels)
      if (target.gain !== chain.target.gain) this.setParam(chain.gain.gain, target.gain, now, true)
      if (target.delayS !== chain.target.delayS) this.setParam(chain.delay.delayTime, target.delayS, now, false)
      if (target.pan !== chain.target.pan) this.setParam(chain.pan.pan, target.pan, now, false)
      chain.target = target
    }
  }

  /** RMS of each speaker's output (linear, 0 = silence), read from its analyser. {} once disposed. */
  levels(): Record<string, number> {
    const out: Record<string, number> = {}
    if (this.isDisposed) return out
    for (const [id, c] of this.chains) {
      c.analyser.getFloatTimeDomainData(c.buf)
      let sum = 0
      for (let i = 0; i < c.buf.length; i++) sum += c.buf[i] * c.buf[i]
      out[id] = Math.sqrt(sum / c.buf.length)
    }
    return out
  }

  /** Immediate and idempotent: every node disconnected, the context closed, the object URL revoked, the element removed, the timer cleared. */
  dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true
    this.seq++
    if (this.timer !== null) {
      this.env.clearTimeout(this.timer)
      this.timer = null
    }
    this.releaseSource()
    for (const c of this.chains.values()) this.dropChain(c)
    this.chains.clear()
    for (const n of [this.splitter, this.master, this.limiter] as AudioNode[]) {
      try {
        n.disconnect()
      } catch {
        /* already disconnected */
      }
    }
    audioStats.contexts.closed++
    // close() rejects on a context that is already closed; either way the context is gone.
    try {
      this.ctx.close().catch(() => undefined)
    } catch {
      /* a context that cannot be closed any more */
    }
    this.resolveClosed()
  }

  // ── internals ───────────────────────────────────────────────────────────────

  private fadeIn(): void {
    const now = this.ctx.currentTime
    const g = this.master.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(0, now)
    g.linearRampToValueAtTime(MASTER_GAIN, now + FADE_IN_S)
  }

  private makeChain(channels: ('L' | 'R')[], target: Chain['target']): Chain {
    const ctx = this.ctx
    const gain = ctx.createGain()
    gain.gain.value = 0
    const delay = ctx.createDelay(MAX_DELAY_S)
    delay.delayTime.value = target.delayS // a new voice starts at its place: no sweep from zero
    const pan = ctx.createStereoPanner()
    pan.pan.value = target.pan
    const analyser = ctx.createAnalyser()
    analyser.fftSize = METER_FFT
    gain.connect(delay)
    delay.connect(pan)
    pan.connect(analyser)
    analyser.connect(this.master)
    const chain: Chain = { gain, delay, pan, analyser, buf: new Float32Array(analyser.fftSize), channels: [], target }
    this.wire(chain, channels)
    return chain
  }

  /** Connect this voice to the splitter outputs of its channels (0 = L, 1 = R), replacing the previous wiring. */
  private wire(chain: Chain, channels: ('L' | 'R')[]): void {
    for (const out of [0, 1]) {
      try {
        this.splitter.disconnect(chain.gain, out)
      } catch {
        /* that output was not connected */
      }
    }
    for (const c of channels) this.splitter.connect(chain.gain, c === 'L' ? 0 : 1)
    chain.channels = [...channels]
  }

  private dropChain(c: Chain): void {
    for (const n of [c.gain, c.delay, c.pan, c.analyser] as AudioNode[]) {
      try {
        n.disconnect()
      } catch {
        /* already disconnected */
      }
    }
    for (const out of [0, 1]) {
      try {
        this.splitter.disconnect(c.gain, out)
      } catch {
        /* not connected */
      }
    }
  }

  /** Move a parameter to `value` with a 20 ms time constant; a gain of 0 is snapped to exactly 0 when the ramp has settled. */
  private setParam(p: AudioParam, value: number, now: number, snapZero: boolean): void {
    p.cancelScheduledValues(now)
    p.setValueAtTime(p.value, now)
    p.setTargetAtTime(value, now, PARAM_TAU_S)
    if (snapZero && value === 0) p.setValueAtTime(0, now + SNAP_ZERO_S)
  }

  private releaseSource(): void {
    if (this.src) {
      try {
        this.src.stop()
      } catch {
        /* already stopped */
      }
      try {
        this.src.node.disconnect()
      } catch {
        /* already disconnected */
      }
      this.src = null
    }
    const el = this.el
    if (el) {
      if (this.elEnded) el.removeEventListener('ended', this.elEnded)
      this.elEnded = null
      el.pause()
      el.removeAttribute('src')
      el.load() // drops the media resource (and its hold on the blob)
      el.remove()
      audioStats.elements.removed++
      this.el = null
    }
    if (this.url !== null) {
      this.env.revokeObjectURL(this.url)
      audioStats.urls.revoked++
      this.url = null
    }
    this.playingNow = false
  }
}
