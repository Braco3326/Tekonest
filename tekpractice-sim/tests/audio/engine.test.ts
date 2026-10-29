/**
 * Task 39: the Web Audio adapter against a FAKE audio context (Node): the graph it builds (splitter → per voice gain → delay → panner → analyser → master →
 * limiter → destination), the hearing-safety constants, how `update()` moves the parameters, and above all its LIFECYCLE: stop fades out and releases,
 * dispose releases at once, a failed start leaves nothing, a stop / dispose while a start is in flight leaves the late result ignored. The sound itself
 * (levels in a real browser) is the e2e's.
 */
import { describe, expect, it } from 'vitest'
import { AudioEngine, FADE_IN_S, FADE_OUT_S, LIMITER, MASTER_GAIN, MASTER_GAIN_DB, PARAM_TAU_S, RESUME_TIMEOUT_MS, ResumeTimeoutError, SNAP_ZERO_S, VOICE_FADE_S, audioStats } from '../../src/audio/engine'
import type { MixVoice } from '../../src/audio/listenerMix'
import { FakeAnalyser, FakeBufferSource, FakeCompressor, FakeContext, FakeDelay, FakeGain, FakeMediaSource, FakePanner, fakeEnv, type FakeEnvHandle } from './fakeAudio'

const voice = (instanceId: string, over: Partial<MixVoice> = {}): MixVoice => ({ instanceId, channels: ['L'], gain: 0.5, delayS: 0, pan: 0, ...over })
/** Let the pending promise callbacks run (the resume, the render…). */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}
const file = (): File => new File([new Uint8Array([1, 2, 3])], 'a.wav', { type: 'audio/wav' })

async function started(kind: 'test' | 'file' | 'song' = 'test', opts: { deferRender?: boolean } = {}): Promise<{ h: FakeEnvHandle; e: AudioEngine; ctx: FakeContext }> {
  const h = fakeEnv(opts)
  const e = await AudioEngine.create(h.env)
  const ctx = h.contexts[0]
  if (!opts.deferRender) await e.play(kind === 'test' ? { kind } : kind === 'file' ? { kind, file: file() } : { kind, url: '/audio/songs/x.mp3' })
  return { h, e, ctx }
}
const chainOf = (ctx: FakeContext, k = 0): { gain: FakeGain; delay: FakeDelay; pan: FakePanner; analyser: FakeAnalyser } => {
  // voices create their nodes in the order gain, delay, panner, analyser; the master and the input are the two gains made before them
  const gains = ctx.ofType<FakeGain>('gain')
  return { gain: gains[2 + k], delay: ctx.ofType<FakeDelay>('delay')[k], pan: ctx.ofType<FakePanner>('panner')[k], analyser: ctx.ofType<FakeAnalyser>('analyser')[2 + k] } // the two output taps are the first analysers
}

describe('hearing safety: it never starts loud', () => {
  it('states its constants: master −12 dBFS, 80 ms fades, a limiter', () => {
    expect(MASTER_GAIN_DB).toBe(-12)
    expect(MASTER_GAIN).toBeCloseTo(0.2512, 4)
    expect(MASTER_GAIN).toBeLessThan(0.26)
    expect(FADE_IN_S).toBeGreaterThanOrEqual(0.05)
    expect(FADE_IN_S).toBeLessThanOrEqual(0.1)
    expect(FADE_OUT_S).toBeGreaterThanOrEqual(0.05)
    expect(FADE_OUT_S).toBeLessThanOrEqual(0.1)
  })
  it('the master gain is 0 at creation (silent until the fade-in), sits AHEAD of the voices, and the only node that feeds the destination is the limiter', async () => {
    const h = fakeEnv()
    const e = await AudioEngine.create(h.env)
    const ctx = h.contexts[0]
    const master = ctx.ofType<FakeGain>('gain')[0]
    expect(master.gain.value).toBe(0)
    const split = ctx.ofType('splitter')[0]
    expect(master.feeds(split)).toBe(true) // master → splitter → voices: every voice, and so every meter, is after the master gain
    const limiter = ctx.ofType<FakeCompressor>('compressor')[0]
    expect(limiter.feeds(ctx.destination)).toBe(true)
    for (const n of ctx.nodes) if (n !== limiter) expect(n.feeds(ctx.destination), `${n.type} reaches the destination`).toBe(false)
    e.update([voice('a')])
    const c = chainOf(ctx)
    expect(c.analyser.feeds(limiter)).toBe(true) // the voices end in the limiter, not in a second path to the destination
    expect(master.feeds(limiter)).toBe(false)
  })
  it('the limiter is set as a limiter: threshold −3 dBFS, hard knee, ratio 20, fast attack', async () => {
    const h = fakeEnv()
    await AudioEngine.create(h.env)
    const l = h.contexts[0].ofType<FakeCompressor>('compressor')[0]
    expect([l.threshold.value, l.knee.value, l.ratio.value, l.attack.value, l.release.value]).toEqual([LIMITER.threshold, LIMITER.knee, LIMITER.ratio, LIMITER.attack, LIMITER.release])
    expect(LIMITER.threshold).toBeLessThan(0)
    expect(LIMITER.ratio).toBeGreaterThanOrEqual(10)
  })
  it('starting fades the master in from 0 to MASTER_GAIN over FADE_IN_S, and the source starts only after the ramp is scheduled', async () => {
    const { ctx } = await started('test')
    const m = ctx.ofType<FakeGain>('gain')[0].gain
    expect(m.of('set').find((e) => e.value === 0)).toBeDefined()
    const ramp = m.of('linear').find((e) => e.value === MASTER_GAIN)
    expect(ramp).toBeDefined()
    expect(ramp!.time - m.of('set')[0].time).toBeCloseTo(FADE_IN_S, 9)
    expect(Math.max(...m.events.map((e) => e.value ?? 0))).toBeLessThanOrEqual(MASTER_GAIN) // never above the master gain
  })
  it('stopping fades the master out to 0 over FADE_OUT_S before anything is released', async () => {
    const { ctx, e, h } = await started('test')
    ctx.currentTime = 1
    e.stop()
    const m = ctx.ofType<FakeGain>('gain')[0].gain
    const last = m.of('linear').at(-1)!
    expect(last.value).toBe(0)
    expect(last.time).toBeCloseTo(1 + FADE_OUT_S, 9)
    expect(ctx.closeCalls).toBe(0) // not yet: the fade is still sounding
    expect(h.timers).toHaveLength(1)
    expect(h.timers[0].ms).toBeGreaterThanOrEqual(FADE_OUT_S * 1000)
    h.flushTimers()
    await e.closed
    expect(ctx.closeCalls).toBe(1)
  })
})

describe('the graph', () => {
  it('a voice is gain → delay (max 1 s) → panner → analyser → master; the source feeds the splitter; L and R pick the splitter outputs', async () => {
    const { e, ctx } = await started('test')
    e.update([voice('l', { channels: ['L'] }), voice('r', { channels: ['R'] }), voice('both', { channels: ['L', 'R'] })])
    const split = ctx.ofType('splitter')[0]
    const src = ctx.ofType<FakeBufferSource>('buffersource')[0]
    const input = ctx.ofType<FakeGain>('gain')[1]
    const master = ctx.ofType<FakeGain>('gain')[0]
    expect(src.feeds(input)).toBe(true) // the source enters the 2-channel input, then the master gain, then the splitter
    expect(input.feeds(master)).toBe(true)
    expect(master.feeds(split)).toBe(true)
    expect(input.channelCount).toBe(2)
    expect(input.channelCountMode).toBe('explicit')
    expect(input.channelInterpretation).toBe('speakers') // a mono file is up-mixed: both speakers get it
    expect(src.loop).toBe(true)
    expect(src.started).toBe(1)
    const [cl, cr, cb] = [0, 1, 2].map((k) => chainOf(ctx, k))
    for (const c of [cl, cr, cb]) {
      expect(c.gain.feeds(c.delay)).toBe(true)
      expect(c.delay.feeds(c.pan)).toBe(true)
      expect(c.pan.feeds(c.analyser)).toBe(true)
      expect(c.analyser.feeds(ctx.ofType<FakeCompressor>('compressor')[0])).toBe(true)
      expect(c.delay.maxDelayTime).toBe(1)
    }
    expect([split.feeds(cl.gain, 0), split.feeds(cl.gain, 1)]).toEqual([true, false])
    expect([split.feeds(cr.gain, 0), split.feeds(cr.gain, 1)]).toEqual([false, true])
    expect([split.feeds(cb.gain, 0), split.feeds(cb.gain, 1)]).toEqual([true, true])
  })
  it('a speaker fed by both channels takes (L + R) / 2: the gain is halved so a mono source keeps its level', async () => {
    const { e, ctx } = await started('test')
    e.update([voice('both', { channels: ['L', 'R'], gain: 0.5 }), voice('one', { channels: ['L'], gain: 0.5 })])
    const targets = ctx.ofType<FakeGain>('gain').slice(2).map((g) => g.gain.of('target').at(-1)!.value)
    expect(targets).toEqual([0.25, 0.5])
  })
  it('a new voice starts at its delay and pan (no sweep from zero); its gain ramps up from 0', async () => {
    const { e, ctx } = await started('test')
    e.update([voice('a', { delayS: 0.05, pan: -0.5 })])
    const c = chainOf(ctx)
    expect(c.delay.delayTime.value).toBe(0.05)
    expect(c.pan.pan.value).toBe(-0.5)
    expect(c.gain.gain.value).toBe(0)
    expect(c.gain.gain.of('target')[0]).toMatchObject({ value: 0.5, tau: PARAM_TAU_S })
  })
  it('a change ramps with setTargetAtTime and a 0.02 s time constant, from the current value (no click); an unchanged mix posts nothing', async () => {
    const { e, ctx } = await started('test')
    e.update([voice('a')])
    const c = chainOf(ctx)
    ctx.currentTime = 2
    e.update([voice('a', { gain: 0.25, delayS: 0.01, pan: 0.5 })])
    for (const [p, v] of [[c.gain.gain, 0.25], [c.delay.delayTime, 0.01], [c.pan.pan, 0.5]] as const) {
      const t = p.of('target').at(-1)!
      expect(t).toMatchObject({ value: v, tau: 0.02, time: 2 })
      expect(p.of('cancel').at(-1)!.time).toBe(2)
    }
    const counts = [c.gain.gain.events.length, c.delay.delayTime.events.length, c.pan.pan.events.length]
    e.update([voice('a', { gain: 0.25, delayS: 0.01, pan: 0.5 })])
    expect([c.gain.gain.events.length, c.delay.delayTime.events.length, c.pan.pan.events.length]).toEqual(counts)
  })
  it('a gain of 0 (muted, fader at −inf) is snapped to EXACTLY 0 once the ramp has settled; 0.2 s after the change', async () => {
    const { e, ctx } = await started('test')
    e.update([voice('a')])
    const c = chainOf(ctx)
    ctx.currentTime = 3
    e.update([voice('a', { gain: 0 })])
    expect(c.gain.gain.of('target').at(-1)).toMatchObject({ value: 0, time: 3 })
    expect(c.gain.gain.of('set').at(-1)).toMatchObject({ value: 0, time: 3 + SNAP_ZERO_S })
    expect(SNAP_ZERO_S).toBeCloseTo(0.2, 9)
    // un-muting cancels the pending snap
    ctx.currentTime = 3.05
    e.update([voice('a', { gain: 0.5 })])
    expect(c.gain.gain.of('cancel').at(-1)!.time).toBe(3.05)
    expect(c.gain.gain.of('target').at(-1)).toMatchObject({ value: 0.5, time: 3.05 })
  })
  it('a channel change re-wires the voice (L → R), a speaker that leaves is disconnected, the others are kept', async () => {
    const { e, ctx, h } = await started('test')
    e.update([voice('a', { channels: ['L'] }), voice('b', { channels: ['R'] })])
    const split = ctx.ofType('splitter')[0]
    const a = chainOf(ctx, 0)
    const b = chainOf(ctx, 1)
    e.update([voice('a', { channels: ['R'] }), voice('b', { channels: ['R'] })])
    h.flushTimers() // the re-wire waits for its fade
    expect([split.feeds(a.gain, 0), split.feeds(a.gain, 1)]).toEqual([false, true])
    e.update([voice('b', { channels: ['R'] })])
    h.flushTimers() // and so does the disconnection of a speaker that left
    expect(a.gain.disconnected).toBe(1)
    expect(a.analyser.disconnected).toBe(1)
    expect(split.feeds(a.gain)).toBe(false)
    expect(split.feeds(b.gain, 1)).toBe(true)
    expect(e.snapshot().voices.map((v) => v.instanceId)).toEqual(['b'])
  })
  it('levels() is the RMS of each analyser, 0 for silence, {} when there is no voice', async () => {
    const { e, ctx } = await started('test')
    expect(e.levels()).toEqual({})
    e.update([voice('a'), voice('b')])
    ctx.ofType<FakeAnalyser>('analyser')[2].level = 0.5
    expect(e.levels()).toEqual({ a: 0.5, b: 0 })
  })
})

describe('sources', () => {
  it('the test signal asks the environment for its generated buffer and loops it', async () => {
    const { h, ctx } = await started('test')
    expect(h.renders).toBe(1)
    expect(ctx.ofType<FakeBufferSource>('buffersource')[0].buffer).toEqual({ fake: 'buffer' })
  })
  it('a local file goes through an object URL, an <audio> element and a MediaElementSource; nothing is fetched', async () => {
    const { h, ctx } = await started('file')
    expect(h.urls.created).toHaveLength(1)
    expect(h.elements).toHaveLength(1)
    expect(h.elements[0].src).toBe(h.urls.created[0])
    expect(h.elements[0].paused).toBe(false)
    const mes = ctx.ofType<FakeMediaSource>('mediasource')[0]
    expect(mes.element).toBe(h.elements[0])
    expect(mes.feeds(ctx.ofType<FakeGain>('gain')[1])).toBe(true) // into the up-mixing input
    expect(h.renders).toBe(0)
  })
  it('a song is a same-origin URL on the element: no object URL is made', async () => {
    const { h } = await started('song')
    expect(h.elements[0].src).toBe('/audio/songs/x.mp3')
    expect(h.urls.created).toEqual([])
  })
  it('the file reaching its end tells the owner once; the test signal never ends by itself; after stop nothing is told', async () => {
    const { h, e } = await started('file')
    let n = 0
    e.onEnded = () => void n++
    h.elements[0].dispatch('ended')
    expect(n).toBe(1)
    e.stop()
    h.elements[0].dispatch('ended')
    expect(n).toBe(1)
  })
  it('a second play() on the same engine is refused (one source per engine)', async () => {
    const { e } = await started('test')
    await expect(e.play({ kind: 'test' })).rejects.toThrow(/one source per engine/)
  })
})

describe('lifecycle: nothing is left behind', () => {
  it('dispose() releases everything at once: nodes disconnected, context closed, URL revoked, element removed, listener off, timer cleared', async () => {
    const { h, e, ctx } = await started('file')
    e.update([voice('a'), voice('b', { channels: ['R'] })])
    const before = { ...audioStats.urls }
    e.dispose()
    await e.closed
    expect(ctx.closeCalls).toBe(1)
    expect(h.urls.revoked).toEqual(h.urls.created)
    expect(audioStats.urls.revoked - before.revoked).toBe(1)
    expect(h.elements[0].removed).toBe(true)
    expect(h.elements[0].paused).toBe(true)
    expect(h.elements[0].src).toBe('')
    expect(h.elements[0].liveListeners).toBe(0)
    expect(ctx.nodes.filter((n) => n.out.length > 0)).toEqual([]) // no node still connected to anything
    expect(e.levels()).toEqual({})
    expect(e.disposed).toBe(true)
  })
  it('stop() releases the same things after its fade; the timer is the only deferred step', async () => {
    const { h, e, ctx } = await started('file')
    e.stop()
    expect(h.urls.revoked).toEqual([]) // still fading
    expect(h.elements[0].removed).toBe(false)
    h.flushTimers()
    await e.closed
    expect(ctx.closeCalls).toBe(1)
    expect(h.urls.revoked).toEqual(h.urls.created)
    expect(h.elements[0].removed).toBe(true)
  })
  it('stop() then dispose() clears the pending timer and releases once; every call after is a no-op', async () => {
    const { h, e, ctx } = await started('test')
    const cleared0 = h.cleared.length
    e.stop()
    e.stop()
    expect(h.timers).toHaveLength(1)
    e.dispose()
    expect(h.timers).toHaveLength(0)
    expect(h.cleared.length - cleared0).toBe(1)
    e.dispose()
    e.stop()
    e.update([voice('x')])
    await e.closed
    await Promise.resolve()
    expect(ctx.closeCalls).toBe(1)
    expect(ctx.ofType('gain')).toHaveLength(2) // the master and the input: update() after dispose built nothing
  })
  it('a context that refuses to close (already closed) does not throw out of dispose()', async () => {
    const { e, ctx } = await started('test')
    ctx.state = 'closed'
    expect(() => e.dispose()).not.toThrow()
    await e.closed
  })
  it('a file the browser cannot play: play() rejects, and the URL, the element and the nodes of the attempt are gone', async () => {
    const h = fakeEnv()
    const e = await AudioEngine.create(h.env)
    // the element is made inside play(): arrange its failure through the env
    const make = h.env.createAudio
    h.env.createAudio = () => {
      const el = make()
      ;(el as unknown as { failPlay: boolean }).failPlay = true
      return el
    }
    await expect(e.play({ kind: 'file', file: file() })).rejects.toThrow(/supported/)
    expect(h.urls.revoked).toEqual(h.urls.created)
    expect(h.elements[0].removed).toBe(true)
    expect(h.elements[0].liveListeners).toBe(0)
    e.dispose()
    expect(h.contexts[0].closeCalls).toBe(1)
  })
  it('the generated test signal failing to render rejects play() and leaves nothing started', async () => {
    const h = fakeEnv({ deferRender: true })
    const e = await AudioEngine.create(h.env)
    const p = e.play({ kind: 'test' })
    await flush()
    h.failRender()
    await expect(p).rejects.toThrow(/render failed/)
    expect(h.contexts[0].ofType<FakeBufferSource>('buffersource')).toHaveLength(0)
    e.dispose()
  })
  it('stale: dispose() while the test signal is being generated: the late buffer starts nothing and play() resolves quietly', async () => {
    const { h, e, ctx } = await started('test', { deferRender: true }).then(async (s) => {
      const p = s.e.play({ kind: 'test' })
      await flush()
      return { ...s, p }
    }).then(async (s) => {
      s.e.dispose()
      s.h.release()
      await s.p
      return s
    })
    expect(ctx.ofType<FakeBufferSource>('buffersource')).toHaveLength(0)
    expect(h.renders).toBe(1)
    expect(ctx.closeCalls).toBe(1)
    expect(e.playing).toBe(false)
  })
  it('stale: stop() while the test signal is being generated: the late buffer starts nothing, and the engine still releases', async () => {
    const h = fakeEnv({ deferRender: true })
    const e = await AudioEngine.create(h.env)
    const p = e.play({ kind: 'test' })
    await flush()
    e.stop()
    h.release()
    await p
    expect(h.contexts[0].ofType<FakeBufferSource>('buffersource')).toHaveLength(0)
    h.flushTimers()
    await e.closed
    expect(h.contexts[0].closeCalls).toBe(1)
  })
  it('counters: every context opened is closed, every URL created is revoked, every element created is removed', async () => {
    const before = JSON.parse(JSON.stringify(audioStats)) as typeof audioStats
    const a = await started('file')
    const b = await started('test')
    const c = await started('song')
    a.e.dispose()
    b.e.stop()
    b.h.flushTimers()
    c.e.dispose()
    await Promise.all([a.e.closed, b.e.closed, c.e.closed])
    expect(audioStats.contexts.opened - before.contexts.opened).toBe(3)
    expect(audioStats.contexts.closed - before.contexts.closed).toBe(3)
    expect(audioStats.urls.created - before.urls.created).toBe(1)
    expect(audioStats.urls.revoked - before.urls.revoked).toBe(1)
    expect(audioStats.elements.created - before.elements.created).toBe(2)
    expect(audioStats.elements.removed - before.elements.removed).toBe(2)
  })
})

describe('review round 1: the fade-in waits for the file, a context that does not start fails, a failing element is told', () => {
  /** An environment whose <audio> elements keep play() pending until `releasePlay()` (a large file being decoded). */
  const slowFiles = (h: FakeEnvHandle): void => {
    const make = h.env.createAudio
    h.env.createAudio = () => {
      const el = make() as unknown as { deferPlay: boolean }
      el.deferPlay = true
      return el as unknown as HTMLAudioElement
    }
  }
  it('a FILE fades in only once play() has resolved: a slow decode (longer than the 80 ms ramp) never finds the master already up', async () => {
    const h = fakeEnv()
    const e = await AudioEngine.create(h.env)
    const ctx = h.contexts[0]
    const master = ctx.ofType<FakeGain>('gain')[0].gain
    slowFiles(h)
    const p = e.play({ kind: 'file', file: file() })
    await flush()
    ctx.currentTime = 5 // the file is still being decoded, well past FADE_IN_S
    expect(master.of('linear')).toEqual([]) // no ramp yet: the master is still 0
    expect(master.value).toBe(0)
    h.elements[0].releasePlay()
    await p
    const ramp = master.of('linear')
    expect(ramp).toHaveLength(1)
    expect(ramp[0].value).toBe(MASTER_GAIN)
    expect(ramp[0].time).toBeCloseTo(5 + FADE_IN_S, 9) // scheduled from the moment the first sample could arrive
    expect(e.playing).toBe(true)
  })
  it('the same for a song', async () => {
    const h = fakeEnv()
    const e = await AudioEngine.create(h.env)
    const master = h.contexts[0].ofType<FakeGain>('gain')[0].gain
    slowFiles(h)
    const p = e.play({ kind: 'song', url: '/audio/songs/x.mp3' })
    await flush()
    expect(master.of('linear')).toEqual([])
    h.elements[0].releasePlay()
    await p
    expect(master.of('linear')).toHaveLength(1)
  })
  it('a context whose resume() never settles fails with ResumeTimeoutError after RESUME_TIMEOUT_MS, and leaves nothing started', async () => {
    expect(RESUME_TIMEOUT_MS).toBeGreaterThanOrEqual(2000)
    expect(RESUME_TIMEOUT_MS).toBeLessThanOrEqual(5000)
    const h = fakeEnv()
    const e = await AudioEngine.create(h.env)
    h.contexts[0].deferResume = true
    const p = e.play({ kind: 'file', file: file() })
    const settled = p.then(
      () => 'resolved',
      (err: unknown) => err
    )
    await flush()
    const timer = h.timers.find((t) => t.ms === RESUME_TIMEOUT_MS)
    expect(timer).toBeDefined() // the wait is bounded, by the environment's timer
    timer!.fn()
    const err = await settled
    expect(err).toBeInstanceOf(ResumeTimeoutError)
    expect(h.elements).toHaveLength(0) // nothing was made for the file
    expect(h.urls.created).toEqual([])
    h.contexts[0].releaseResume() // the late resume changes nothing
    await flush()
    expect(e.playing).toBe(false)
    e.dispose()
    expect(h.contexts[0].closeCalls).toBe(1)
  })
  it('a resume() that settles in time clears its timer', async () => {
    const { h } = await started('test')
    expect(h.timers.filter((t) => t.ms === RESUME_TIMEOUT_MS)).toEqual([])
  })
  it('stale: dispose() while resume() is pending → play() settles quietly, nothing is made, the context is closed once', async () => {
    const h = fakeEnv()
    const e = await AudioEngine.create(h.env)
    h.contexts[0].deferResume = true
    const p = e.play({ kind: 'file', file: file() })
    await flush()
    e.dispose()
    await expect(p).resolves.toBeUndefined()
    h.contexts[0].releaseResume()
    await flush()
    expect(h.elements).toHaveLength(0)
    expect(h.urls.created).toEqual([])
    expect(h.contexts[0].ofType<FakeBufferSource>('buffersource')).toHaveLength(0)
    expect(h.contexts[0].closeCalls).toBe(1)
    expect(h.timers).toEqual([])
  })
  it('stale: stop() while resume() is pending → play() settles quietly, nothing is started, and the engine still releases itself', async () => {
    const h = fakeEnv()
    const e = await AudioEngine.create(h.env)
    h.contexts[0].deferResume = true
    const p = e.play({ kind: 'test' })
    await flush()
    e.stop()
    await expect(p).resolves.toBeUndefined()
    expect(h.renders).toBe(0)
    h.flushTimers()
    await e.closed
    expect(h.contexts[0].closeCalls).toBe(1)
  })
  it("stale: dispose() while a FILE's play() is pending → URL revoked, element removed, late play() quietly ignored, no ramp", async () => {
    const h = fakeEnv()
    const e = await AudioEngine.create(h.env)
    slowFiles(h)
    const p = e.play({ kind: 'file', file: file() })
    await flush()
    expect(h.elements).toHaveLength(1)
    e.dispose()
    expect(h.urls.revoked).toEqual(h.urls.created)
    expect(h.elements[0].removed).toBe(true)
    h.elements[0].releasePlay()
    await expect(p).resolves.toBeUndefined()
    expect(h.contexts[0].ofType<FakeGain>('gain')[0].gain.of('linear')).toEqual([])
    expect(e.playing).toBe(false)
  })
  it("stale: stop() while a FILE's play() is pending → the late play() does not fade in, everything is released after the fade", async () => {
    const h = fakeEnv()
    const e = await AudioEngine.create(h.env)
    slowFiles(h)
    const p = e.play({ kind: 'file', file: file() })
    await flush()
    e.stop()
    h.elements[0].releasePlay()
    await expect(p).resolves.toBeUndefined()
    const master = h.contexts[0].ofType<FakeGain>('gain')[0].gain
    expect(master.of('linear').every((r) => r.value === 0)).toBe(true) // only the fade-out ramp, never a fade-in to MASTER_GAIN
    h.flushTimers()
    await e.closed
    expect(h.urls.revoked).toEqual(h.urls.created)
    expect(h.elements[0].removed).toBe(true)
  })
  it('the fade-out is a ramp to 0 of FADE_OUT_S from the current value (not an abrupt cut)', async () => {
    const { ctx, e } = await started('test')
    ctx.currentTime = 2
    e.stop()
    const m = ctx.ofType<FakeGain>('gain')[0].gain
    expect(m.of('set').at(-1)).toMatchObject({ time: 2 })
    expect(m.of('linear').at(-1)).toMatchObject({ value: 0, time: 2 + FADE_OUT_S })
    expect(m.of('cancel').at(-1)!.time).toBe(2)
  })
  it('a media element that fails after the start (a decode error mid-stream) is told: onFailed; a pause from outside too; the natural end (pause with ended, then ended) is not a failure', async () => {
    const { h, e } = await started('file')
    let failed = 0
    let ended = 0
    e.onFailed = () => void failed++
    e.onEnded = () => void ended++
    h.elements[0].dispatch('error')
    expect(failed).toBe(1)
    h.elements[0].dispatch('pause') // a media key
    expect(failed).toBe(2)
    h.elements[0].ended = true // at the end of a file the browser fires « pause » with ended = true, then « ended »
    h.elements[0].dispatch('pause')
    h.elements[0].dispatch('ended')
    expect(failed).toBe(2)
    expect(ended).toBe(1)
  })
  it('an element error BEFORE the start has completed is not forwarded (play() rejects by itself); nor after stop; the listeners are removed at the end', async () => {
    const h = fakeEnv()
    const e = await AudioEngine.create(h.env)
    slowFiles(h)
    let failed = 0
    e.onFailed = () => void failed++
    const p = e.play({ kind: 'file', file: file() })
    await flush()
    h.elements[0].dispatch('error')
    expect(failed).toBe(0)
    h.elements[0].releasePlay()
    await p
    e.stop()
    h.elements[0].dispatch('error')
    h.elements[0].dispatch('pause')
    expect(failed).toBe(0)
    h.flushTimers()
    await e.closed
    expect(h.elements[0].liveListeners).toBe(0)
  })
  it('non-finite targets never reach a parameter: NaN gain / pan become 0, Infinity delay is capped, NaN delay is 0', async () => {
    const { e, ctx } = await started('test')
    e.update([voice('a', { gain: NaN, delayS: Infinity, pan: NaN })])
    const c = chainOf(ctx)
    for (const p of [c.gain.gain, c.delay.delayTime, c.pan.pan]) for (const ev of p.events) if (ev.value !== undefined) expect(Number.isFinite(ev.value)).toBe(true)
    expect(c.gain.gain.of('target')[0].value).toBe(0)
    expect(c.delay.delayTime.value).toBe(0) // Infinity is not a delay: 0, like any non-finite value
    expect(c.pan.pan.value).toBe(0)
    e.update([voice('a', { gain: 0.5, delayS: NaN, pan: 0.2 })])
    for (const p of [c.gain.gain, c.delay.delayTime, c.pan.pan]) for (const ev of p.events) if (ev.value !== undefined) expect(Number.isFinite(ev.value)).toBe(true)
  })
  it('a context handed in is adopted (the engine does not make another) and closed by dispose()', async () => {
    const h = fakeEnv()
    const mine = new FakeContext()
    let made = 0
    const env = { ...h.env, createContext: () => (made++, h.env.createContext()) }
    const e = await AudioEngine.create(env, mine as unknown as AudioContext)
    expect(made).toBe(0)
    expect(h.contexts).toHaveLength(0)
    await e.play({ kind: 'test' })
    expect(mine.ofType('gain').length).toBeGreaterThan(0)
    e.dispose()
    expect(mine.closeCalls).toBe(1)
  })
  it("peaks(): each speaker's largest sample (after the master, before the limiter) and the real output after the limiter", async () => {
    const { e, ctx } = await started('test')
    e.update([voice('a'), voice('b')])
    const an = ctx.ofType<FakeAnalyser>('analyser')
    an[2].level = -0.4 // a negative sample counts by its magnitude
    an[0].level = 0.25 // the output tap, left side
    an[1].level = 0.5 // right side
    const pk = e.peaks()
    expect(pk.voices.a).toBeCloseTo(0.4, 6)
    expect(pk.voices.b).toBe(0)
    expect(pk.output).toBe(0.5)
    e.dispose()
    expect(e.peaks()).toEqual({ voices: {}, output: 0 })
  })
  it('the output tap sits after the limiter: limiter → splitter → two analysers', async () => {
    const { ctx } = await started('test')
    const limiter = ctx.ofType<FakeCompressor>('compressor')[0]
    const [l, r] = ctx.ofType<FakeAnalyser>('analyser')
    const split = ctx.ofType('splitter')[1]
    expect(limiter.feeds(split)).toBe(true)
    expect([split.feeds(l, 0), split.feeds(r, 1)]).toEqual([true, true])
  })
})

describe('Phase 4 final wave: unplugging a speaker (or re-wiring a side) never clicks', () => {
  const fadeMs = VOICE_FADE_S * 1000
  it('a speaker that leaves the mix is faded to 0 over VOICE_FADE_S FIRST, and disconnected only when its timer fires (the delay buffer is not cut mid-waveform)', async () => {
    const { e, ctx, h } = await started('test')
    e.update([voice('a'), voice('b')])
    const a = chainOf(ctx, 0)
    ctx.currentTime = 3
    const timers0 = h.timers.length
    e.update([voice('b')])
    const ramp = a.gain.gain.of('linear').at(-1)!
    expect(ramp).toMatchObject({ value: 0, time: 3 + VOICE_FADE_S })
    expect(a.gain.gain.of('set').at(-1)).toMatchObject({ time: 3 }) // from the current value
    expect(a.gain.disconnected).toBe(0) // still connected: its tail is still sounding
    expect(a.delay.disconnected).toBe(0)
    expect(h.timers.length).toBe(timers0 + 1)
    expect(h.timers.at(-1)!.ms).toBeGreaterThanOrEqual(fadeMs)
    expect(e.snapshot().voices.map((v) => v.instanceId)).toEqual(['b']) // no longer part of the mix
    h.flushTimers()
    expect(a.gain.disconnected).toBe(1)
    expect(a.delay.disconnected).toBe(1)
    expect(a.pan.disconnected).toBe(1)
    expect(a.analyser.disconnected).toBe(1)
  })
  it('dispose() and stop() clear the fade timers; dispose() still disconnects the fading voice at once', async () => {
    const a1 = await started('test')
    a1.e.update([voice('a'), voice('b')])
    const c1 = chainOf(a1.ctx, 0)
    a1.e.update([voice('b')])
    const n = a1.h.timers.length
    a1.e.dispose()
    expect(a1.h.timers.length).toBeLessThan(n) // the fade timer was cleared
    expect(c1.gain.disconnected).toBeGreaterThan(0)
    a1.h.flushTimers() // nothing left to fire
    const a2 = await started('test')
    a2.e.update([voice('a'), voice('b')])
    a2.e.update([voice('b')])
    a2.e.stop()
    expect(a2.h.timers).toHaveLength(1) // only stop()'s own release timer: the voice timer was cleared
    a2.h.flushTimers()
    await a2.e.closed
    expect(a2.ctx.closeCalls).toBe(1)
  })
  it('a speaker re-added within the fade is kept: the stale timer does not disconnect it and its gain comes back', async () => {
    const { e, ctx, h } = await started('test')
    e.update([voice('a', { gain: 0.5 }), voice('b')])
    const a = chainOf(ctx, 0)
    e.update([voice('b')])
    ctx.currentTime = 4
    e.update([voice('a', { gain: 0.5 }), voice('b')])
    h.flushTimers() // the voice's timer was cleared on re-adoption: nothing fires
    expect(a.gain.disconnected).toBe(0)
    expect(a.gain.gain.of('target').at(-1)).toMatchObject({ value: 0.5, time: 4 }) // ramping back up
    expect(e.snapshot().voices.map((v) => v.instanceId).sort()).toEqual(['a', 'b'])
    expect(ctx.ofType<FakeGain>('gain')).toHaveLength(2 + 2) // no third chain was built for it
  })
  it('a re-wire (L → R) fades the voice out, re-wires when the fade is done, and fades back in; the old side keeps feeding until then', async () => {
    const { e, ctx, h } = await started('test')
    e.update([voice('a', { channels: ['L'], gain: 0.5 })])
    const split = ctx.ofType('splitter')[0]
    const a = chainOf(ctx)
    ctx.currentTime = 2
    e.update([voice('a', { channels: ['R'], gain: 0.5 })])
    expect(a.gain.gain.of('linear').at(-1)).toMatchObject({ value: 0, time: 2 + VOICE_FADE_S })
    expect([split.feeds(a.gain, 0), split.feeds(a.gain, 1)]).toEqual([true, false]) // not switched yet: no click
    ctx.currentTime = 2.03
    h.flushTimers()
    expect([split.feeds(a.gain, 0), split.feeds(a.gain, 1)]).toEqual([false, true])
    expect(a.gain.gain.of('target').at(-1)).toMatchObject({ value: 0.5, time: 2.03 }) // fading back in
  })
  it('while a re-wire is pending a gain change waits for it, and a change back to the wired side cancels it', async () => {
    const { e, ctx, h } = await started('test')
    e.update([voice('a', { channels: ['L'], gain: 0.5 })])
    const split = ctx.ofType('splitter')[0]
    const a = chainOf(ctx)
    e.update([voice('a', { channels: ['R'], gain: 0.5 })])
    const events = a.gain.gain.events.length
    e.update([voice('a', { channels: ['R'], gain: 0.25 })]) // another change while fading out: only recorded
    expect(a.gain.gain.events.length).toBe(events)
    h.flushTimers()
    expect(a.gain.gain.of('target').at(-1)!.value).toBe(0.25) // the latest target comes back in
    // L → R pending, then back to R: nothing to do
    e.update([voice('a', { channels: ['L'], gain: 0.25 })])
    e.update([voice('a', { channels: ['R'], gain: 0.25 })])
    h.flushTimers()
    expect([split.feeds(a.gain, 0), split.feeds(a.gain, 1)]).toEqual([false, true])
    expect(a.gain.gain.of('target').at(-1)!.value).toBe(0.25)
  })
  it('dispose() during a pending re-wire clears its timer', async () => {
    const { e, h } = await started('test')
    e.update([voice('a', { channels: ['L'] })])
    e.update([voice('a', { channels: ['R'] })])
    e.dispose()
    expect(h.timers).toEqual([])
  })
})
