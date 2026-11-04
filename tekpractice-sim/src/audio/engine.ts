/**
 * The Web Audio adapter (Task 39, C9, C14, CA-03, CA-26, S3). A LAZY chunk: nothing here is loaded until the first « Lecture ».
 *
 *   source ─▶ input (2 ch, speaker up-mix) ─▶ master Gain ─▶ ChannelSplitter(2) ─▶ per voice: [L and/or R] ─▶ Gain ─▶ Delay(≤ 1 s) ─▶ StereoPanner ─▶ Analyser (the speaker's OUTPUT level) ─▶ limiter ─▶ output tap ─▶ destination
 *
 * The voices come from the pure `listenerMix` (gain, delay, pan per powered speaker); `update()` moves the three parameters with
 * `setTargetAtTime(…, 0.02)` so a mix change never clicks. A voice whose gain is 0 (muted, fader at −inf) is snapped to EXACTLY 0 once the ramp has
 * settled. A speaker fed by both channels takes (L + R) / 2, so a mono file keeps its level and a stereo one never clips by the sum.
 *
 * HEARING SAFETY (controller ruling, L31): audio never starts loud.
 *   - master gain `MASTER_GAIN_DB` = −12 dBFS (× 0.251), ahead of the voices, so every meter reads the level AFTER it;
 *   - a DynamicsCompressorNode set as a limiter (threshold −3 dBFS, knee 0, ratio 20, attack 3 ms, release 100 ms) sits between the voices and the destination (NOMINAL: a browser's compressor may add automatic make-up gain);
 *   - an 80 ms linear fade-in from the moment the source really produces sound (a file: when `play()` has resolved, not before) and an 80 ms fade-out when it stops
 *     (no click); `dispose()` is immediate. The worst case (two speakers, a full-scale file, the fader at +10 dB) is bounded by the limiter: see ADR-0015, addendum 39.
 *
 * Privacy (S3): a local file is played from `URL.createObjectURL(file)` through an <audio> element and a MediaElementAudioSourceNode. It is never
 * fetched, uploaded or stored: the object URL is revoked and the element removed on stop / dispose. No song is bundled (content/songs.json is empty);
 * a `song` source is a same-origin URL handed in by the caller.
 *
 * Browser classes are reached through an injected `AudioEnv` (the app builds the real one), so the lifecycle is unit-tested with a fake context.
 */
import { MAX_DELAY_S, type MixVoice } from './listenerMix'
import { renderTestSignal } from './testSignal'
import { audioStats, newAudioContext } from './context'

export { audioStats }

/**
 * The overall volume, set so that the reference rig at the Régie with the test signal puts the speakers' output peak between −30 and −6 dBFS (e2e). With the
 * loudness normalisation of the mix (the loudest speaker is unity) the absolute level is THIS constant, not the distance.
 */
export const MASTER_GAIN_DB = -12
export const MASTER_GAIN = 10 ** (MASTER_GAIN_DB / 20)
export const FADE_IN_S = 0.08
export const FADE_OUT_S = 0.08
/** Time constant of every parameter ramp in `update()` (the brief's 0.02). */
export const PARAM_TAU_S = 0.02
/** After this many seconds (10 time constants: 0.005 % of the start value left) a ramp to 0 is snapped to exactly 0. */
export const SNAP_ZERO_S = 10 * PARAM_TAU_S
/**
 * A speaker that leaves the mix (its cable pulled while it plays), or whose side changes, is faded over this long BEFORE it is disconnected / re-wired: a
 * disconnect cuts the delay line's buffered audio mid-waveform, which is a click.
 */
export const VOICE_FADE_S = 0.025
export const LIMITER = { threshold: -3, knee: 0, ratio: 20, attack: 0.003, release: 0.1 } as const
const METER_FFT = 1024
/** A `resume()` that has not settled after this long is a failure (Safari / iOS may leave a context suspended: no endless « Démarrage… »). */
export const RESUME_TIMEOUT_MS = 3000

/** The context could not start in time. */
export class ResumeTimeoutError extends Error {
  constructor() {
    super('AudioContext.resume() did not settle')
    this.name = 'ResumeTimeout'
  }
}

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

let testBuffer: { sampleRate: number; buffer: Promise<AudioBuffer> } | null = null

/** The real environment. Browser globals are read here, at call time, never at import. */
export function browserEnv(): AudioEnv {
  return {
    createContext: newAudioContext,
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
  /** A side change waiting for the fade-out to finish: the channels to wire next, and the timer. */
  wiring?: { channels: ('L' | 'R')[]; timer: number }
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
  /**
   * `ctx`: the context made inside the user's click (src/audio/context.ts), adopted by the engine (which then closes it). Without one the engine makes its own
   * through `env.createContext()`, which only works well where the browser lets a context start outside a gesture.
   */
  static create(env: AudioEnv = browserEnv(), ctx?: AudioContext | null): Promise<AudioEngine> {
    try {
      return Promise.resolve(new AudioEngine(env, ctx ?? null))
    } catch (e) {
      return Promise.reject(e)
    }
  }

  /** Told when the source ends by itself (a local file or a song reaching its end); never for the looped test signal. */
  onEnded: (() => void) | null = null
  /** Told when a playing media element fails or is paused from outside (a decode error mid-stream, a media key): the sound has stopped for a reason the learner did not choose. */
  onFailed: (() => void) | null = null
  /** Resolves when everything is released (after `stop()`'s fade, or `dispose()`). */
  readonly closed: Promise<void>

  private readonly ctx: AudioContext
  /** Every source enters here: forced to 2 channels with the speaker up-mix, so a MONO file feeds L and R alike (a ChannelSplitter alone is « discrete »: mono would reach L only). */
  private readonly input: GainNode
  private readonly splitter: ChannelSplitterNode
  private readonly master: GainNode
  private readonly limiter: DynamicsCompressorNode
  /** The tap after the limiter, one analyser per side: the real output level, read by the e2e. */
  private readonly outTap: { split: ChannelSplitterNode; l: AnalyserNode; r: AnalyserNode; buf: Float32Array<ArrayBuffer> }
  private readonly chains = new Map<string, Chain>()
  /** Speakers that left the mix and are fading out; disconnected by their timer (cleared by stop / dispose, re-adopted if the speaker comes back). */
  private readonly fading = new Map<string, { chain: Chain; timer: number }>()
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
  private elError: (() => void) | null = null
  private elPause: (() => void) | null = null
  private cancelResume: (() => void) | null = null

  private constructor(
    private readonly env: AudioEnv,
    adopted: AudioContext | null
  ) {
    this.closed = new Promise<void>((r) => (this.resolveClosed = r))
    let ctx = adopted
    if (!ctx) {
      ctx = env.createContext()
      audioStats.contexts.opened++
    }
    this.ctx = ctx
    this.splitter = ctx.createChannelSplitter(2)
    this.master = ctx.createGain()
    this.master.gain.value = 0 // the fade-in raises it; nothing is audible before the source starts
    this.input = ctx.createGain()
    this.input.channelCount = 2
    this.input.channelCountMode = 'explicit'
    this.input.channelInterpretation = 'speakers'
    this.input.connect(this.master) // the master gain is AHEAD of the voices: every speaker's meter reads the level after it
    this.master.connect(this.splitter)
    this.limiter = ctx.createDynamicsCompressor()
    this.limiter.threshold.value = LIMITER.threshold
    this.limiter.knee.value = LIMITER.knee
    this.limiter.ratio.value = LIMITER.ratio
    this.limiter.attack.value = LIMITER.attack
    this.limiter.release.value = LIMITER.release
    const split = ctx.createChannelSplitter(2)
    const l = ctx.createAnalyser()
    const r = ctx.createAnalyser()
    l.fftSize = r.fftSize = METER_FFT
    this.outTap = { split, l, r, buf: new Float32Array(METER_FFT) }
    this.limiter.connect(split)
    split.connect(l, 0)
    split.connect(r, 1)
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
      await this.resumed() // a context made in the click normally runs; one that stays suspended fails after RESUME_TIMEOUT_MS instead of waiting for ever
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
        bs.connect(this.input)
        this.fadeIn() // synthetic and instant: the sound starts with the ramp
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
        // After a successful start only: a decode error mid-stream, or a pause that is not the end of the file (a media key), is a stop nobody asked for.
        this.elError = () => {
          if (this.playingNow && !this.isDisposed && !this.stopping) this.onFailed?.()
        }
        this.elPause = () => {
          if (this.playingNow && !this.isDisposed && !this.stopping && !el.ended) this.onFailed?.()
        }
        el.addEventListener('error', this.elError)
        el.addEventListener('pause', this.elPause)
        const mes = this.ctx.createMediaElementSource(el)
        this.src = { node: mes, stop: () => el.pause() }
        mes.connect(this.input)
        // The master stays at 0 while the file is being read and decoded: a slow `play()` (a large file) must not use up the 80 ms ramp before the first sample.
        await el.play() // rejects for a file the browser cannot decode
        if (stale()) return
        this.fadeIn()
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
    this.cancelResume?.()
    this.clearVoiceTimers() // the master fade-out covers every voice; dispose() disconnects them
    const now = this.ctx.currentTime
    const g = this.master.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(0, now + FADE_OUT_S)
    // The master gain is upstream of the voices' delay lines: they keep sounding what they hold. Release after the fade AND the longest delay, not before.
    this.timer = this.env.setTimeout(() => {
      this.timer = null
      this.dispose()
    }, (FADE_OUT_S + this.longestTail()) * 1000 + 40)
  }

  /** The voices of the pure mix. Creates a chain for a new speaker, drops the ones that left, ramps the rest. */
  update(voices: readonly MixVoice[]): void {
    if (this.isDisposed || this.stopping) return
    const keep = new Set(voices.map((v) => v.instanceId))
    const now = this.ctx.currentTime
    for (const [id, chain] of this.chains) {
      if (keep.has(id)) continue
      // Fade the speaker out, disconnect when the fade is done (a cable pulled mid-note must not click).
      this.chains.delete(id)
      if (chain.wiring) {
        this.env.clearTimeout(chain.wiring.timer)
        chain.wiring = undefined
      }
      this.fadeOut(chain.gain.gain, now)
      // The fade is on the gain, UPSTREAM of the delay line: audio sent before the fade is still inside the line for `tail` seconds, and a disconnect before it has
      // played out would cut it mid-waveform. So the disconnect waits for the fade plus the line's delay.
      const timer = this.env.setTimeout(() => {
        this.fading.delete(id)
        this.dropChain(chain)
      }, (VOICE_FADE_S + this.tailOf(chain)) * 1000 + 10)
      this.fading.set(id, { chain, timer })
    }
    for (const v of voices) {
      let chain = this.chains.get(v.instanceId)
      let force = false
      // Both sides: (L + R) / 2. One side: that side as it is.
      const weight = v.channels.length > 1 ? 1 / v.channels.length : 1
      // The graph never receives NaN or Infinity: a non-finite value is « no sound », « no delay », « centre ».
      const fin = (n: number): number => (Number.isFinite(n) ? n : 0)
      const target = { gain: Math.max(0, fin(v.gain * weight)), delayS: Math.min(Math.max(fin(v.delayS), 0), MAX_DELAY_S), pan: Math.min(Math.max(fin(v.pan), -1), 1) }
      if (!chain) {
        const back = this.fading.get(v.instanceId)
        if (back) {
          // The speaker came back during its fade-out: keep its chain (the stale timer must not disconnect it) and ramp it up again.
          this.env.clearTimeout(back.timer)
          this.fading.delete(v.instanceId)
          chain = back.chain
          this.chains.set(v.instanceId, chain)
          force = true
        } else {
          chain = this.makeChain(v.channels, target)
          this.chains.set(v.instanceId, chain)
          this.setParam(chain.gain.gain, target.gain, now, true)
          continue
        }
      }
      // A change of side: fade out, wire the new side, fade back in (a switch while sounding clicks).
      const wanted = v.channels.join()
      if (chain.wiring) {
        if (wanted === chain.channels.join()) {
          // back to the side that is still wired: nothing to switch
          this.env.clearTimeout(chain.wiring.timer)
          chain.wiring = undefined
          force = true
        } else chain.wiring.channels = [...v.channels]
      } else if (wanted !== chain.channels.join()) this.beginRewire(chain, v.channels, now)
      const waiting = chain.wiring !== undefined
      // `force` (a speaker back from its fade) never overrides a pending re-wire: coming back on the OTHER side must stay at 0 until the side is switched.
      if (!waiting && (force || target.gain !== chain.target.gain)) this.setParam(chain.gain.gain, target.gain, now, true)
      if (target.delayS !== chain.target.delayS) this.setParam(chain.delay.delayTime, target.delayS, now, false)
      if (target.pan !== chain.target.pan) this.setParam(chain.pan.pan, target.pan, now, false)
      chain.target = target
    }
  }

  /** How long a voice's delay line still holds audio: the larger of its target and its live delay, never beyond the line. */
  private tailOf(chain: Chain): number {
    const live = Number.isFinite(chain.delay.delayTime.value) ? chain.delay.delayTime.value : 0
    return Math.min(MAX_DELAY_S, Math.max(0, chain.target.delayS, live))
  }

  /** The longest tail among the voices and the ones still fading out. */
  private longestTail(): number {
    let t = 0
    for (const c of this.chains.values()) t = Math.max(t, this.tailOf(c))
    for (const f of this.fading.values()) t = Math.max(t, this.tailOf(f.chain))
    return t
  }

  /** Fade the voice out, wire `channels` when the fade is done, then bring the gain back to the voice's latest target. */
  private beginRewire(chain: Chain, channels: ('L' | 'R')[], now: number): void {
    this.fadeOut(chain.gain.gain, now)
    const timer = this.env.setTimeout(() => {
      const w = chain.wiring
      chain.wiring = undefined
      if (!w || this.isDisposed) return
      this.wire(chain, w.channels)
      this.setParam(chain.gain.gain, chain.target.gain, this.ctx.currentTime, true)
    }, VOICE_FADE_S * 1000 + 10)
    chain.wiring = { channels: [...channels], timer }
  }

  /** A linear ramp to 0 over VOICE_FADE_S from the parameter's current value. */
  private fadeOut(p: AudioParam, now: number): void {
    p.cancelScheduledValues(now)
    p.setValueAtTime(p.value, now)
    p.linearRampToValueAtTime(0, now + VOICE_FADE_S)
  }

  /** Clear every fade / re-wire timer (stop and dispose). */
  private clearVoiceTimers(): void {
    for (const f of this.fading.values()) this.env.clearTimeout(f.timer)
    for (const c of this.chains.values()) {
      if (c.wiring) this.env.clearTimeout(c.wiring.timer)
      c.wiring = undefined
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

  /**
   * The largest absolute sample each speaker's analyser holds (linear, 0 = silence), and the same at the real output (after the limiter, the larger side).
   * Speaker values are AFTER the master gain and before the limiter; `output` is what reaches the destination (nominal: a browser's compressor may add make-up gain).
   */
  peaks(): { voices: Record<string, number>; output: number } {
    const voices: Record<string, number> = {}
    if (this.isDisposed) return { voices, output: 0 }
    const peakOf = (a: AnalyserNode, buf: Float32Array<ArrayBuffer>): number => {
      a.getFloatTimeDomainData(buf)
      let m = 0
      for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]))
      return m
    }
    for (const [id, c] of this.chains) voices[id] = peakOf(c.analyser, c.buf)
    return { voices, output: Math.max(peakOf(this.outTap.l, this.outTap.buf), peakOf(this.outTap.r, this.outTap.buf)) }
  }

  /** Immediate and idempotent: every node disconnected, the context closed, the object URL revoked, the element removed, the timer cleared. */
  dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true
    this.seq++
    this.cancelResume?.()
    if (this.timer !== null) {
      this.env.clearTimeout(this.timer)
      this.timer = null
    }
    this.clearVoiceTimers()
    this.releaseSource()
    for (const c of this.chains.values()) this.dropChain(c)
    this.chains.clear()
    for (const f of this.fading.values()) this.dropChain(f.chain)
    this.fading.clear()
    for (const n of [this.input, this.splitter, this.master, this.limiter, this.outTap.split, this.outTap.l, this.outTap.r] as AudioNode[]) {
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

  /** `ctx.resume()` with a bound: rejects with ResumeTimeoutError, and settles quietly when `stop()` / `dispose()` cancels the wait. */
  private resumed(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = this.env.setTimeout(() => {
        this.cancelResume = null
        reject(new ResumeTimeoutError())
      }, RESUME_TIMEOUT_MS)
      this.cancelResume = () => {
        this.cancelResume = null
        this.env.clearTimeout(timer)
        resolve()
      }
      this.ctx.resume().then(
        () => {
          if (this.cancelResume) {
            this.env.clearTimeout(timer)
            this.cancelResume = null
            resolve()
          }
        },
        (e: unknown) => {
          this.env.clearTimeout(timer)
          this.cancelResume = null
          reject(e)
        }
      )
    })
  }

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
    analyser.connect(this.limiter)
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
      if (this.elError) el.removeEventListener('error', this.elError)
      if (this.elPause) el.removeEventListener('pause', this.elPause)
      this.elEnded = this.elError = this.elPause = null
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
