/**
 * Task 39: the mix input of the live design (design + catalog + signal path + listener → `MixInput`). Built with the real CreationStore, so ports,
 * controls and the path are the engine's. Directivity comes from the field model (`directivityDb`); a speaker without acoustic data still plays.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadCatalog, type Registry } from '../../src/engine/CatalogLoader'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { templateToDesign } from '../../src/creation/templates'
import { Template } from '../../src/creation/templateSchema'
import { signalPath, type PathResult } from '../../src/flow/signalPath'
import { mixInput, type ListenerPose } from '../../src/creation/listenVoices'
import { listenerMix } from '../../src/audio/listenerMix'
import { directivityDb } from '../../src/acoustics/field'
import { makeRegistry, rawCatalog } from '../helpers'
import type { ControlValue, PortRef } from '../../src/engine/types'
import type { DesignState } from '../../src/trials/trial'

const registry = makeRegistry()
const ref = (s: string): PortRef => {
  const [instance, port] = s.split(' ')
  return { instance, port }
}
function rig(o: { controls?: Record<string, ControlValue>; reg?: Registry } = {}): DesignState {
  const reg = o.reg ?? registry
  const t = Template.parse(JSON.parse(readFileSync('content/templates/concert-simple-reference.json', 'utf8')))
  const s = new CreationStore(reg, creationEvaluator(reg), templateToDesign(t))
  for (const r of [
    s.dispatch({ type: 'CONNECT', a: ref('ql1 out-main-l'), b: ref('k12-g in-line-a') }),
    s.dispatch({ type: 'CONNECT', a: ref('ql1 out-main-r'), b: ref('k12-d in-line-a') }),
    s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }),
    ...Object.entries(o.controls ?? {}).map(([control, value]) => s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control, value })),
  ])
    expect(r.ok).toBe(true)
  return s.design()
}
const pathOf = (d: DesignState, reg: Registry = registry): PathResult => signalPath(d, reg, [])
/** A listener 8 m in front of the speakers (z = +0.5), facing the stage (−z): rendered right = world −x. */
const regie: ListenerPose = { position: [0, 1.2, 0.5], right: [-1, 0, 0] }
const feedOf = (d: DesignState, reg: Registry, l: ListenerPose, id: string) => mixInput(d, reg, pathOf(d, reg), l).feeds.find((f) => f.instanceId === id)!

describe('mixInput', () => {
  it('one feed per fed speaker with its placement position, its channels, the console fader and mute', () => {
    const d = rig({ controls: { 'fader-master': '-6' } })
    const m = mixInput(d, registry, pathOf(d), regie)
    expect(m.listener).toEqual(regie)
    expect(m.feeds.map((f) => f.instanceId)).toEqual(['k12-d', 'k12-g'])
    const g = m.feeds.find((f) => f.instanceId === 'k12-g')!
    expect(g).toMatchObject({ position: [6, 2.7, -7.5], channels: ['L'], gainDb: -6, muted: false })
    expect(m.feeds.find((f) => f.instanceId === 'k12-d')).toMatchObject({ position: [-6, 2.7, -7.5], channels: ['R'] })
  })
  it('mute is carried (it never gates the path) and the fader at −inf is −Infinity; the mix turns both into exact silence', () => {
    const d = rig({ controls: { 'mute-master': true } })
    const path = pathOf(d)
    expect(path.playbackReady).toBe(true)
    const voices = listenerMix(mixInput(d, registry, path, regie))
    expect(voices.map((v) => v.gain)).toEqual([0, 0])
    const off = rig({ controls: { 'fader-master': '-inf' } })
    expect(mixInput(off, registry, pathOf(off), regie).feeds.every((f) => f.gainDb === -Infinity)).toBe(true)
    expect(listenerMix(mixInput(off, registry, pathOf(off), regie)).map((v) => v.gain)).toEqual([0, 0])
  })
  it('dirDb is the field model directivity toward the listener: 0 dB on axis, then −6·u² (30° off a 75° speaker)', () => {
    const d = rig()
    expect(feedOf(d, registry, { position: [6, 2.7, 4], right: [-1, 0, 0] }, 'k12-g').dirDb).toBe(0) // straight in front of the speaker (yaw 0 faces +z)
    const p = d.placements.find((x) => x.instanceId === 'k12-g')!
    const at30: ListenerPose = { position: [p.position_m[0] + 4 * Math.sin(Math.PI / 6), p.position_m[1], p.position_m[2] + 4 * Math.cos(Math.PI / 6)], right: [-1, 0, 0] }
    const dirDb = feedOf(d, registry, at30, 'k12-g').dirDb
    expect(dirDb).toBeCloseTo(directivityDb(30, 0, 75, 75, false), 9)
    expect(dirDb).toBeCloseTo(-6 * (30 / 37.5) ** 2, 9)
  })
  it('behind the speaker is the −30 dB floor, and the speaker turned away follows its yaw (placement), not the world', () => {
    const d = rig()
    expect(feedOf(d, registry, { position: [6, 2.7, -12], right: [-1, 0, 0] }, 'k12-g').dirDb).toBe(-30) // behind (z smaller than the speaker's)
    d.placements.find((x) => x.instanceId === 'k12-g')!.yawDeg = 180 // now it faces −z
    expect(feedOf(d, registry, { position: [6, 2.7, -12], right: [-1, 0, 0] }, 'k12-g').dirDb).toBeCloseTo(0, 9)
    expect(feedOf(d, registry, { position: [6, 2.7, 4], right: [-1, 0, 0] }, 'k12-g').dirDb).toBe(-30)
  })
  it('the tilt comes from the placement too (a speaker aimed 10° up: a listener level with it is 10° below the axis)', () => {
    const d = rig()
    d.placements.find((x) => x.instanceId === 'k12-g')!.tiltDeg = 10
    expect(feedOf(d, registry, { position: [6, 2.7, 4], right: [-1, 0, 0] }, 'k12-g').dirDb).toBeCloseTo(directivityDb(0, -10, 75, 75, false), 9)
  })
  it('a powered speaker with NO acoustic data still plays: directivity falls back to 0 dB, wherever the listener stands', () => {
    const raw = structuredClone(rawCatalog()) as { devices: { id: string; acoustic?: unknown }[] }
    delete raw.devices.find((x) => x.id === 'qsc-k12-2')!.acoustic
    const bare = loadCatalog(raw)
    const d = rig({ reg: bare })
    const behind: ListenerPose = { position: [6, 2.7, -12], right: [-1, 0, 0] }
    const f = feedOf(d, bare, behind, 'k12-g')
    expect(f.dirDb).toBe(0)
    expect(listenerMix(mixInput(d, bare, pathOf(d, bare), behind)).every((v) => v.gain > 0)).toBe(true)
    expect(feedOf(d, registry, behind, 'k12-g').dirDb).toBe(-30) // with its data the same spot is behind the speaker
  })
  it('GOLDEN: the console BALANCE changes the sound: C is unchanged; G100 silences the right-fed k12-d (gain 0), k12-g stays; G50 puts k12-d at one half; D100 the opposite', () => {
    const gainsFor = (balance: string): Record<string, number> => {
      const d = rig({ controls: { 'balance-master': balance } })
      return Object.fromEntries(listenerMix(mixInput(d, registry, pathOf(d), regie)).map((v) => [v.instanceId, v.gain]))
    }
    expect(gainsFor('C')).toEqual({ 'k12-d': 1, 'k12-g': 1 })
    expect(gainsFor('G100')).toEqual({ 'k12-d': 0, 'k12-g': 1 })
    expect(gainsFor('G50')['k12-d']).toBeCloseTo(0.5, 12)
    expect(gainsFor('G50')['k12-g']).toBe(1)
    expect(gainsFor('D100')).toEqual({ 'k12-d': 1, 'k12-g': 0 })
    expect(gainsFor('D50')['k12-g']).toBeCloseTo(0.5, 12)
  })
  it('the balance acts on top of the fader, and a balance cut is exact silence even with a +10 dB fader', () => {
    const d = rig({ controls: { 'balance-master': 'G50', 'fader-master': '-6' } })
    const v = listenerMix(mixInput(d, registry, pathOf(d), regie))
    expect(v.find((x) => x.instanceId === 'k12-d')!.gain).toBeCloseTo(0.5 * 10 ** (-6 / 20), 12)
    const loud = rig({ controls: { 'balance-master': 'G100', 'fader-master': '+10' } })
    expect(listenerMix(mixInput(loud, registry, pathOf(loud), regie)).find((x) => x.instanceId === 'k12-d')!.gain).toBe(0)
  })
  it('a speaker without a placement has no position: it is left out (the others still play)', () => {
    const d = rig()
    d.placements = d.placements.filter((p) => p.instanceId !== 'k12-g')
    expect(mixInput(d, registry, pathOf(d), regie).feeds.map((f) => f.instanceId)).toEqual(['k12-d'])
  })
  it('nothing is fed (no path) → no feed; the input is a copy (mutating it never touches the design or the listener)', () => {
    const t = Template.parse(JSON.parse(readFileSync('content/templates/concert-simple-reference.json', 'utf8')))
    const bare = templateToDesign(t)
    expect(mixInput(bare, registry, pathOf(bare), regie).feeds).toEqual([])
    const d = rig()
    const m = mixInput(d, registry, pathOf(d), regie)
    m.feeds[0].position[0] = 99
    m.listener.position[0] = 99
    expect(d.placements.find((p) => p.instanceId === m.feeds[0].instanceId)!.position_m[0]).not.toBe(99)
    expect(regie.position[0]).toBe(0)
  })
  it('end to end with the pure mix: the Régie hears the nearer speaker first? both equidistant → no delay; k12-g (world +x) pans left', () => {
    const d = rig()
    const v = listenerMix(mixInput(d, registry, pathOf(d), regie))
    const g = v.find((x) => x.instanceId === 'k12-g')!
    const dd = v.find((x) => x.instanceId === 'k12-d')!
    expect(g.pan).toBeLessThan(0)
    expect(dd.pan).toBeGreaterThan(0)
    expect(g.delayS).toBeCloseTo(0, 12)
    expect(g.gain).toBeCloseTo(dd.gain, 12)
  })
})
