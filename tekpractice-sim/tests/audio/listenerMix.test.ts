/**
 * Task 39 (C9, C14, CA-03): the listener mix is a pure function of geometry. Gain = 1/r (r floored at 0.5 m, as the field's levelDb) times the
 * feed's fader and the speaker's directivity toward the listener; delay = r/343 minus the nearest voice's; pan = the speaker's horizontal
 * direction projected on the listener's RENDERED right vector.
 */
import { describe, expect, it } from 'vitest'
import { Matrix, Vector3 } from '@babylonjs/core'
import { MAX_DELAY_S, MIN_DISTANCE_M, SPEED_OF_SOUND, listenerMix, type MixInput } from '../../src/audio/listenerMix'

type Feed = MixInput['feeds'][number]
const feed = (over: Partial<Feed> & { instanceId: string; position: [number, number, number] }): Feed => ({ channels: ['L', 'R'], gainDb: 0, muted: false, dirDb: 0, ...over })
/** A listener at the origin looking down +z, whose rendered right is +x (Babylon LH). */
const ahead = { position: [0, 0, 0] as [number, number, number], right: [1, 0, 0] as [number, number, number] }
const mix = (feeds: Feed[], listener = ahead) => listenerMix({ listener, feeds })
const byId = (vs: ReturnType<typeof mix>, id: string) => vs.find((v) => v.instanceId === id)!

describe('gain: the geometry (1/r times the directivity) NORMALISED to the loudest speaker, then the fader', () => {
  it('the loudest speaker is at unity; a speaker at 4 m next to one at 2 m is at 0.5 (ratio 2: the 1/r law survives the normalisation)', () => {
    const v = mix([feed({ instanceId: 'near', position: [0, 0, 2] }), feed({ instanceId: 'far', position: [0, 0, 4] })])
    expect(byId(v, 'near').gain).toBe(1)
    expect(byId(v, 'far').gain).toBeCloseTo(0.5, 12)
    expect(byId(v, 'near').gain / byId(v, 'far').gain).toBeCloseTo(2, 12)
  })
  it('a lone speaker is at unity wherever it stands: the absolute level is a master constant, not the distance (loudness normalisation)', () => {
    for (const z of [0.1, 2, 10, 100]) expect(mix([feed({ instanceId: 'a', position: [0, 0, z] })])[0].gain).toBe(1)
  })
  it('ratios between speakers are the plain 1/r ones at any distance (10 m and 20 m: 1 and 0.5)', () => {
    const v = mix([feed({ instanceId: 'a', position: [0, 0, 10] }), feed({ instanceId: 'b', position: [0, 0, 20] }), feed({ instanceId: 'c', position: [0, 0, 40] })])
    expect([byId(v, 'a').gain, byId(v, 'b').gain, byId(v, 'c').gain]).toEqual([1, 0.5, 0.25])
  })
  it('the directivity is part of the geometry: a speaker 6 dB down at the same distance is at 10^(-6/20) of the other', () => {
    const v = mix([feed({ instanceId: 'a', position: [0, 0, 2] }), feed({ instanceId: 'b', position: [0, 0, 2], dirDb: -6 })])
    expect(byId(v, 'a').gain).toBe(1)
    expect(byId(v, 'b').gain).toBeCloseTo(10 ** (-6 / 20), 12)
  })
  it('the fader scales on top: 10^(gainDb/20), and a fader BOOST above unity is kept (the master and the limiter bound the output)', () => {
    const v = mix([feed({ instanceId: 'a', position: [0, 0, 2], gainDb: -6 }), feed({ instanceId: 'b', position: [0, 0, 2], gainDb: 6 }), feed({ instanceId: 'c', position: [0, 0, 4], gainDb: 0 })])
    expect(byId(v, 'a').gain).toBeCloseTo(10 ** (-6 / 20), 12)
    expect(byId(v, 'b').gain).toBeCloseTo(10 ** (6 / 20), 12)
    expect(byId(v, 'c').gain).toBeCloseTo(0.5, 12)
  })
  it('the normalisation ignores the faders: lowering the loudest speaker\'s fader does not raise the others', () => {
    const base = mix([feed({ instanceId: 'a', position: [0, 0, 2] }), feed({ instanceId: 'b', position: [0, 0, 4] })])
    const down = mix([feed({ instanceId: 'a', position: [0, 0, 2], gainDb: -12 }), feed({ instanceId: 'b', position: [0, 0, 4] })])
    expect(byId(down, 'b').gain).toBe(byId(base, 'b').gain)
    expect(byId(down, 'a').gain).toBeCloseTo(10 ** (-12 / 20), 12)
  })
  it('muted is exactly 0, and so is a fader at -Infinity (never NaN)', () => {
    const v = mix([feed({ instanceId: 'm', position: [0, 0, 2], muted: true }), feed({ instanceId: 'f', position: [0, 0, 2], gainDb: -Infinity }), feed({ instanceId: 'ok', position: [0, 0, 2] })])
    expect(byId(v, 'm').gain).toBe(0)
    expect(byId(v, 'f').gain).toBe(0)
    expect(Object.is(byId(v, 'f').gain, 0)).toBe(true) // +0, not -0 and not NaN
    expect(byId(v, 'ok').gain).toBe(1)
  })
  it('a muted speaker still counts for the normalisation: muting the loudest one never raises the others', () => {
    const v = mix([feed({ instanceId: 'm', position: [0, 0, 2], muted: true }), feed({ instanceId: 'o', position: [0, 0, 4] })])
    expect(byId(v, 'm').gain).toBe(0)
    expect(byId(v, 'o').gain).toBeCloseTo(0.5, 12)
  })
  it('all speakers silent (mute / -inf): all 0, nothing is divided by zero', () => {
    const v = mix([feed({ instanceId: 'a', position: [0, 0, 2], muted: true }), feed({ instanceId: 'b', position: [0, 0, 3], gainDb: -Infinity })])
    expect(v.map((x) => x.gain)).toEqual([0, 0])
  })
  it('all geometry gains 0 (every speaker at -Infinity directivity) or not finite: all 0, never NaN', () => {
    expect(mix([feed({ instanceId: 'a', position: [0, 0, 2], dirDb: -Infinity })]).map((x) => x.gain)).toEqual([0])
    expect(mix([feed({ instanceId: 'a', position: [0, 0, 2], dirDb: NaN }), feed({ instanceId: 'b', position: [0, 0, 3], dirDb: NaN })]).map((x) => x.gain)).toEqual([0, 0])
  })
  it('a muted voice still keeps its geometry (delay, pan): muting never moves the others', () => {
    const v = mix([feed({ instanceId: 'm', position: [3, 0, 4], muted: true }), feed({ instanceId: 'o', position: [0, 0, 10] })])
    expect(byId(v, 'm').delayS).toBe(0) // still the nearest: the others are delayed relative to it
    expect(byId(v, 'm').pan).toBeCloseTo(0.6, 12)
    expect(byId(v, 'o').delayS).toBeCloseTo(5 / SPEED_OF_SOUND, 12)
  })
  it('the distance is floored at 0.5 m, like the field model: 0.1 m and 0.5 m are the same loudness, 1 m is half of them', () => {
    expect(MIN_DISTANCE_M).toBe(0.5)
    const v = mix([feed({ instanceId: 'on', position: [0, 0, 0] }), feed({ instanceId: 'close', position: [0, 0, 0.1] }), feed({ instanceId: 'edge', position: [0, 0, 0.5] }), feed({ instanceId: 'one', position: [0, 0, 1] })])
    for (const id of ['on', 'close', 'edge']) expect(byId(v, id).gain).toBe(1)
    expect(byId(v, 'one').gain).toBeCloseTo(0.5, 12)
  })
  it('the channels travel with the voice', () => {
    const v = mix([feed({ instanceId: 'l', position: [0, 0, 2], channels: ['L'] }), feed({ instanceId: 'r', position: [0, 0, 2], channels: ['R'] })])
    expect(byId(v, 'l').channels).toEqual(['L'])
    expect(byId(v, 'r').channels).toEqual(['R'])
  })
})

describe('non-finite input never reaches the audio graph', () => {
  it('a NaN position, listener or directivity gives 0 gain / 0 delay / 0 pan for that voice, and the others are not disturbed', () => {
    const v = mix([feed({ instanceId: 'bad', position: [NaN, 0, 2] }), feed({ instanceId: 'ok', position: [0, 0, 2] })])
    expect([byId(v, 'bad').gain, byId(v, 'bad').pan]).toEqual([0, 0])
    expect(Number.isFinite(byId(v, 'bad').delayS)).toBe(true)
    expect(byId(v, 'ok').gain).toBe(1)
    expect(byId(v, 'ok').delayS).toBe(0)
    const w = mix([feed({ instanceId: 'a', position: [0, 0, 2] })], { position: [NaN, 0, 0], right: [1, 0, 0] })
    expect([w[0].gain, w[0].delayS, w[0].pan]).toEqual([0, 0, 0])
    const r = mix([feed({ instanceId: 'a', position: [3, 0, 0] })], { position: [0, 0, 0], right: [NaN, 0, 0] })
    expect(Number.isNaN(r[0].pan)).toBe(false)
    const d = mix([feed({ instanceId: 'a', position: [0, 0, 2], dirDb: NaN })])
    expect(d[0].gain).toBe(0)
  })
  it('an Infinity position is the same: finite numbers out', () => {
    const v = mix([feed({ instanceId: 'a', position: [Infinity, 0, 2] }), feed({ instanceId: 'b', position: [0, 0, 2] })])
    for (const x of v) for (const n of [x.gain, x.delayS, x.pan]) expect(Number.isFinite(n)).toBe(true)
    expect(byId(v, 'b').gain).toBe(1)
  })
})

describe('delay: r/343 minus the nearest voice', () => {
  it('the nearest voice has no delay; 34.3 m further is 0.1 s', () => {
    const v = mix([feed({ instanceId: 'a', position: [0, 0, 5] }), feed({ instanceId: 'b', position: [0, 0, 5 + 34.3] })])
    expect(byId(v, 'a').delayS).toBe(0)
    expect(byId(v, 'b').delayS).toBeCloseTo(0.1, 12)
  })
  it('uses the real 3D distance, not the floor distance', () => {
    const v = mix([feed({ instanceId: 'a', position: [0, 0, 3] }), feed({ instanceId: 'b', position: [0, 4, 3] })])
    expect(byId(v, 'b').delayS).toBeCloseTo((Math.hypot(0, 4, 3) - 3) / SPEED_OF_SOUND, 12)
  })
  it('is never negative, and is capped at the delay line (1 s)', () => {
    expect(MAX_DELAY_S).toBe(1)
    const v = mix([feed({ instanceId: 'a', position: [0, 0, 1] }), feed({ instanceId: 'b', position: [0, 0, 1000] })])
    expect(byId(v, 'b').delayS).toBe(1)
    for (const x of v) expect(x.delayS).toBeGreaterThanOrEqual(0)
  })
  it('a single speaker has no delay', () => {
    expect(mix([feed({ instanceId: 'a', position: [7, 0, 9] })])[0].delayS).toBe(0)
  })
})

describe('pan: the horizontal direction projected on the rendered right vector', () => {
  it('a speaker on the right is +1, on the left -1, straight ahead 0, behind 0', () => {
    const v = mix([
      feed({ instanceId: 'r', position: [3, 0, 0] }),
      feed({ instanceId: 'l', position: [-3, 0, 0] }),
      feed({ instanceId: 'f', position: [0, 0, 3] }),
      feed({ instanceId: 'b', position: [0, 0, -3] }),
    ])
    expect(byId(v, 'r').pan).toBeCloseTo(1, 12)
    expect(byId(v, 'l').pan).toBeCloseTo(-1, 12)
    expect(byId(v, 'f').pan).toBeCloseTo(0, 12)
    expect(byId(v, 'b').pan).toBeCloseTo(0, 12)
  })
  it('is the dot of the HORIZONTAL unit vector (height ignored) and stays in [-1, 1]', () => {
    const v = mix([feed({ instanceId: 'a', position: [3, 40, 4] }), feed({ instanceId: 'b', position: [0.0001, 2, 0] })])
    expect(byId(v, 'a').pan).toBeCloseTo(0.6, 12)
    for (const x of v) expect(Math.abs(x.pan)).toBeLessThanOrEqual(1)
  })
  it('clamps a non-unit right vector to [-1, 1]', () => {
    const v = mix([feed({ instanceId: 'a', position: [3, 0, 0] })], { position: [0, 0, 0], right: [5, 0, 0] })
    expect(byId(v, 'a').pan).toBe(1)
  })
  it('a speaker straight above or below the listener pans 0 (no horizontal direction), never NaN or -0', () => {
    const v = mix([feed({ instanceId: 'a', position: [0, 3, 0] })])
    expect(v[0].pan).toBe(0)
    expect(Object.is(v[0].pan, -0)).toBe(false)
  })
  it('follows the listener: turn the listener around (right = -x) and left and right swap', () => {
    const turned = { position: [0, 0, 0] as [number, number, number], right: [-1, 0, 0] as [number, number, number] }
    const v = mix([feed({ instanceId: 'r', position: [3, 0, 0] })], turned)
    expect(v[0].pan).toBeCloseTo(-1, 12)
  })
  it('P14 golden: the Régie listener faces the stage (-z); its RENDERED right is world -x, so k12-g at world +x pans LEFT', () => {
    // The right vector comes from the camera's own view matrix (never assumed): inverse(view) applied to +x.
    const eye = new Vector3(0, 1.2, 8)
    const stage = new Vector3(0, 1.2, -6) // looking toward -z
    const view = Matrix.LookAtLH(eye, stage, Vector3.Up())
    const r = Vector3.TransformNormal(Vector3.Right(), view.clone().invert())
    const right: [number, number, number] = [r.x, r.y, r.z]
    expect(right[0]).toBeCloseTo(-1, 9) // facing -z in Babylon's left-handed world, right is -x
    const v = listenerMix({
      listener: { position: [eye.x, eye.y, eye.z], right },
      feeds: [feed({ instanceId: 'k12-g', position: [4, 0, -5] }), feed({ instanceId: 'k12-d', position: [-4, 0, -5] })],
    })
    expect(byId(v, 'k12-g').pan).toBeCloseTo(-4 / Math.hypot(4, 13), 9) // world +x, on the listener's left
    expect(byId(v, 'k12-d').pan).toBeCloseTo(4 / Math.hypot(4, 13), 9)
  })
})

describe('shape', () => {
  it('one voice per feed, in feed order; empty in, empty out', () => {
    expect(mix([])).toEqual([])
    expect(mix([feed({ instanceId: 'b', position: [0, 0, 1] }), feed({ instanceId: 'a', position: [0, 0, 2] })]).map((v) => v.instanceId)).toEqual(['b', 'a'])
  })
  it('does not mutate its input', () => {
    const input: MixInput = { listener: { position: [0, 0, 0], right: [1, 0, 0] }, feeds: [feed({ instanceId: 'a', position: [1, 2, 3] })] }
    const copy = structuredClone(input)
    listenerMix(input)
    expect(input).toEqual(copy)
  })
  it('never returns NaN for finite inputs', () => {
    const v = mix([feed({ instanceId: 'a', position: [0, 0, 0] }), feed({ instanceId: 'b', position: [1e-12, 0, 0] })])
    for (const x of v) for (const n of [x.gain, x.delayS, x.pan]) expect(Number.isNaN(n)).toBe(false)
  })
})
