/**
 * The listening feature, the entry of its LAZY chunk (Task 39, C9, C14, CA-03, CA-26): Écoute › Lecture. The engine, the panel and its CSS load on the
 * first « Lecture », never with the creation start chunk.
 *
 * What it does, and when:
 *  - `play(source)`: only when the signal path can play (`playbackReady`; the menu gates it too, this is the rule's own check). It makes the engine (a new
 *    one per source: a source change is a stop and a start), gives it the voices of the pure mix, starts the source, then takes the render scheduler's
 *    `meters` lease and starts ONE animation-frame loop.
 *  - while playing: a rig change or an ear-height change recomputes the voices (`refresh`); the frame loop notices a moved listener (the walk camera) and
 *    pushes new voices only if they changed, and refreshes the meters about every 100 ms. Not playing = no loop, no lease, no timer, no work.
 *  - `stop(why)`: fade out, release the lease, cancel the loop, say why once. The chain turning invalid while playing stops it (said with the reason);
 *    mute and fader never do (they silence the voices, the sound goes on and the block says so).
 *  - `reset()` (a place change) and `dispose()` leave nothing: engine, lease, loop, retiring engines.
 *
 * Stale answers are ignored: every start/stop bumps a token, so the engine chunk resolving after Stop, a place change or a newer « Lecture » is disposed
 * unused. The listener is handed in by the shell (the walk camera, else the active listening point looking at the stage) with its RENDERED right vector.
 */
import type { Registry } from '../engine/CatalogLoader'
import type { PathResult } from '../flow/signalPath'
import type { DesignState } from '../trials/trial'
import { AudioEngine, audioStats, type PlaySource } from '../audio/engine'
import { listenerMix, type MixVoice } from '../audio/listenerMix'
import type { DisposableBag } from '../util/disposable'
import { COPY } from './copy'
import { mixInput, type ListenerPose } from './listenVoices'
import { EMPTY_LISTEN_VIEW, rowsOf, sourceName, type ListenSource, type ListenState, type ListenView } from './listenModel'
import { mountListenPanel, type ListenPanel } from './shell/listenPanel'

/** What the controller needs of the engine (AudioEngine satisfies it; a unit test fakes it). */
export interface EngineLike {
  play(source: PlaySource): Promise<void>
  stop(): void
  update(voices: MixVoice[]): void
  levels(): Record<string, number>
  dispose(): void
  onEnded: (() => void) | null
  readonly closed: Promise<void>
}
export type PanelPort = Pick<ListenPanel, 'render'>

export interface ListenDeps {
  registry: Registry
  design(): DesignState
  /** The signal path of the live design (recomputed by the shell on each store change, before this controller is told). */
  path(): PathResult
  /** Where the learner listens from, with the camera's rendered right vector; null when there is no place on screen. */
  listener(): ListenerPose | null
  /** The render scheduler's lease (`hold('meters')`): the returned function releases it. */
  hold(name: string): () => void
  /** Said politely through the shell's status line, once per event. */
  announce(message: string): void
  /** A speaker's name as the block shows it (« QSC K12.2 (k12-g) »). */
  deviceLabel(instanceId: string): string
  /** Notified after every rig change; returns the remover. */
  subscribe(fn: () => void): () => void
  /** Propriétés is open: with it folded nobody reads the meters, so the DOM is left alone (the sound goes on). */
  propsOpen(): boolean
  /** The block's button: start the chosen source (the shell knows which), the controller stops when it is playing. */
  startDefault(): void
  /** The state changed (the menu reads it). */
  onChange?(): void
  bag: DisposableBag
  /** Where the block goes (the Propriétés panel) and what it goes before (the cable legend). */
  container: HTMLElement
  before: HTMLElement | null
  /** One animation frame; returns the canceller. Tests drive the frames by hand. Default: requestAnimationFrame. */
  frame?: (fn: () => void) => () => void
  /** Milliseconds, monotonic (the meter rate). Default: performance.now. */
  now?: () => number
  /** Tests inject a fake engine; the app builds the Web Audio one. */
  createEngine?: () => Promise<EngineLike>
  /** Tests inject a fake panel; the app builds the real one. */
  createPanel?: (handlers: { toggle(): void }) => PanelPort
}

/** What `window.__creation.audioState()` returns: the e2e oracle (plain data). */
export interface ListenDebug {
  state: ListenState
  source: 'test' | 'file' | 'song' | null
  sourceName: string
  /** The voices last given to the engine. */
  voices: MixVoice[]
  /** The `meters` lease is held. */
  lease: boolean
  /** An animation-frame loop is running. */
  loop: boolean
  /** Engines that are fading out (they release themselves a few tens of ms after Stop). */
  retiring: number
}

export const OFF_LISTEN_DEBUG: ListenDebug = { state: 'stopped', source: null, sourceName: '', voices: [], lease: false, loop: false, retiring: 0 }

/** The meters are refreshed about this often while playing (ms). */
export const METER_MS = 100

const L = (): Readonly<Record<string, string>> => COPY.listen!
const toPlaySource = (s: ListenSource): PlaySource => (s.kind === 'test' ? { kind: 'test' } : s.kind === 'file' ? { kind: 'file', file: s.file } : { kind: 'song', url: s.url })
const q = (n: number): number => Math.round(n * 1000) / 1000
const listenerSig = (l: ListenerPose): string => [...l.position, ...l.right].map(q).join(',')

export type StopWhy = 'user' | 'unready' | 'place' | 'ended'

export class ListenController {
  private st: ListenState = 'stopped'
  private src: ListenSource | null = null
  private engine: EngineLike | null = null
  /** Bumped by every start, stop and dispose: an async result carrying an older one is stale. */
  private token = 0
  private release: (() => void) | null = null
  private cancelFrame: (() => void) | null = null
  private retiring = new Set<EngineLike>()
  private voices: MixVoice[] = []
  private voicesSig = ''
  private lastListener = ''
  private lastMeter = -Infinity
  private levels: Record<string, number> = {}
  private panel: PanelPort
  private removeSubscribe: (() => void) | null = null
  private disposed = false

  constructor(private readonly deps: ListenDeps) {
    const handlers = { toggle: () => (this.st === 'stopped' ? deps.startDefault() : this.stop('user')) }
    this.panel = deps.createPanel ? deps.createPanel(handlers) : mountListenPanel(deps.container.ownerDocument, deps.container, deps.before, deps.bag, handlers)
    this.removeSubscribe = deps.subscribe(() => this.refresh())
    deps.bag.add(() => this.dispose())
    this.render()
  }

  get state(): ListenState {
    return this.st
  }
  get playing(): boolean {
    return this.st === 'playing'
  }
  /** Playing or about to (the engine is being made or started): a Stop is meaningful. */
  get active(): boolean {
    return this.st !== 'stopped'
  }

  /** The panel's view of the current state. */
  view(): ListenView {
    const path = this.deps.path()
    const reason = path.playbackReady ? '' : (path.reasons[0]?.text_fr ?? '')
    const line =
      this.st === 'stopped' ? L().stopped! : this.st === 'starting' ? L().starting! : L().playing!.replace('{source}', this.src ? sourceName(this.src) : '')
    return {
      ...EMPTY_LISTEN_VIEW,
      shown: true,
      state: this.st,
      line,
      silent: this.st === 'playing' && this.voices.length > 0 && this.voices.every((v) => v.gain === 0),
      rows: this.st === 'playing' ? rowsOf(this.voices, this.levels, (id) => this.deps.deviceLabel(id)) : [],
      canStart: path.playbackReady,
      reason,
    }
  }

  debug(): ListenDebug {
    return {
      state: this.st,
      source: this.src?.kind ?? null,
      sourceName: this.src ? sourceName(this.src) : '',
      voices: this.voices.map((v) => ({ ...v, channels: [...v.channels] })),
      lease: this.release !== null,
      loop: this.cancelFrame !== null,
      retiring: this.retiring.size,
    }
  }

  /** Web Audio counters over the page's life (the e2e checks that nothing leaks). */
  stats(): typeof audioStats {
    return JSON.parse(JSON.stringify(audioStats)) as typeof audioStats
  }

  /** The speakers' output levels (linear RMS) right now; {} when nothing plays. */
  readLevels(): Record<string, number> {
    return this.engine && this.st === 'playing' ? this.engine.levels() : {}
  }

  async play(source: ListenSource): Promise<void> {
    if (this.disposed) return
    const path = this.deps.path()
    if (!path.playbackReady) {
      // The menu is off in this state, but a stale click or a call from the block lands here: the rule is checked where it matters.
      this.deps.announce(L().notReady!.replace('{reason}', path.reasons[0]?.text_fr ?? '').trim())
      return
    }
    this.endSession() // a source change: the previous engine fades out, nothing is said
    const session = ++this.token
    this.st = 'starting'
    this.src = source
    this.afterChange()
    let engine: EngineLike
    try {
      engine = await (this.deps.createEngine ?? (() => AudioEngine.create()))()
    } catch (e) {
      console.error('[listen] audio engine failed', e)
      if (session === this.token) this.fail(L().loadFailed!)
      return
    }
    if (session !== this.token || this.disposed) {
      engine.dispose() // stopped, replaced or torn down while it was being made: never used
      return
    }
    this.engine = engine
    engine.onEnded = () => {
      if (session === this.token) this.stop('ended')
    }
    this.pushVoices(true)
    try {
      await engine.play(toPlaySource(source))
    } catch (e) {
      if (session !== this.token) return // stopped meanwhile: the failure is of no interest
      console.warn('[listen] play failed', e)
      this.fail(source.kind === 'file' ? L().failedFile! : L().failed!)
      return
    }
    if (session !== this.token || this.disposed) return // stop() already released this engine
    this.st = 'playing'
    this.release = this.deps.hold('meters')
    this.lastMeter = -Infinity
    this.lastListener = this.listenerNow()
    this.loop()
    this.render()
    this.deps.announce(L().playing!.replace('{source}', sourceName(source)))
    this.deps.onChange?.()
  }

  /** Stop: fade out, release the lease and the loop, say why once (nothing when it was not playing). */
  stop(why: StopWhy = 'user'): void {
    const was = this.st !== 'stopped'
    this.endSession()
    if (!was) return
    this.afterChange()
    const path = this.deps.path()
    const reason = path.reasons[0]?.text_fr ?? ''
    this.deps.announce(
      why === 'unready' ? L().stoppedNotReady!.replace('{reason}', reason).trim() : why === 'place' ? L().stoppedPlace! : why === 'ended' ? L().stoppedEnded! : L().stopped!
    )
  }

  /**
   * Something the sound reads may have changed (a rig change, the ear height): follow it. While stopped the only work is the block's own text (its button is
   * live or off with the first reason): no engine, no voices, no loop.
   */
  refresh(): void {
    if (this.st === 'stopped') {
      this.render()
      return
    }
    if (!this.deps.path().playbackReady) {
      this.stop('unready')
      return
    }
    this.pushVoices(false)
    this.render()
  }

  /** A place change: nothing of the old place's sound survives. */
  reset(): void {
    if (this.st !== 'stopped') this.stop('place')
    else this.render()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.removeSubscribe?.()
    this.removeSubscribe = null
    this.endSession()
    for (const e of [...this.retiring]) e.dispose()
    this.retiring.clear()
  }

  // ── internals ───────────────────────────────────────────────────────────────

  /** Tear the session down without a word: invalidate in-flight starts, fade the engine out, drop the lease and the loop. */
  private endSession(): void {
    this.token++
    const e = this.engine
    this.engine = null
    if (e) {
      e.onEnded = null
      e.stop()
      this.retiring.add(e)
      void e.closed.then(() => this.retiring.delete(e))
    }
    this.cancelFrame?.()
    this.cancelFrame = null
    this.release?.()
    this.release = null
    this.st = 'stopped'
    this.src = null
    this.voices = []
    this.voicesSig = ''
    this.levels = {}
    this.lastListener = ''
  }

  /** The start failed: nothing is left running, and the learner is told. */
  private fail(message: string): void {
    this.endSession()
    this.afterChange()
    this.deps.announce(message)
  }

  private afterChange(): void {
    this.render()
    this.deps.onChange?.()
  }

  private render(): void {
    this.panel.render(this.view())
  }

  private listenerNow(): string {
    const l = this.deps.listener()
    return l ? listenerSig(l) : ''
  }

  /** The voices of the live design at the listener; given to the engine only when they changed. */
  private pushVoices(force: boolean): void {
    const listener = this.deps.listener()
    if (!this.engine || !listener) return
    const voices = listenerMix(mixInput(this.deps.design(), this.deps.registry, this.deps.path(), listener))
    const sig = JSON.stringify(voices)
    if (!force && sig === this.voicesSig) return
    this.voicesSig = sig
    this.voices = voices
    this.engine.update(voices)
  }

  /** ONE animation-frame loop, only while playing: a moved listener, and the meters. */
  private loop(): void {
    const tick = (): void => {
      this.cancelFrame = null
      if (this.st !== 'playing' || !this.engine) return
      const at = this.listenerNow()
      let dirty = false
      if (at !== this.lastListener) {
        this.lastListener = at
        this.pushVoices(false)
        dirty = true
      }
      const now = (this.deps.now ?? (() => performance.now()))()
      if (now - this.lastMeter >= METER_MS) {
        this.lastMeter = now
        this.levels = this.engine.levels()
        dirty = true
      }
      if (dirty && this.deps.propsOpen()) this.render()
      this.cancelFrame = (this.deps.frame ?? defaultFrame)(tick)
    }
    this.cancelFrame = (this.deps.frame ?? defaultFrame)(tick)
  }
}

function defaultFrame(fn: () => void): () => void {
  const id = requestAnimationFrame(fn)
  return () => cancelAnimationFrame(id)
}

export function createListen(deps: ListenDeps): ListenController {
  return new ListenController(deps)
}
