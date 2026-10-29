/**
 * Task 37: `coverageSources` (design + catalog + signal path → the AcSources of the speakers that make sound), the pre-filter that keeps
 * `computeField` from throwing, the S2 rule for « ≈ dB SPL estimé » (proved with a synthetic catalog), and the provenance line.
 * Designs are built with the real CreationStore (as tests/flow/signalPath.test.ts), so ports, controls and the path are the engine's.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadCatalog, type Registry } from '../../src/engine/CatalogLoader'
import { computeField } from '../../src/acoustics/field'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { templateToDesign } from '../../src/creation/templates'
import { Template } from '../../src/creation/templateSchema'
import { signalPath, type PathResult } from '../../src/flow/signalPath'
import { coverageSources, coverageSourcesDetail, provenanceOf, splEstimateEligible, type UsedSpeaker } from '../../src/creation/coverageSources'
import { noSourceMessage, sourceLine } from '../../src/creation/coverageModel'
import { makeRegistry, rawCatalog } from '../helpers'
import type { ControlValue, PortRef } from '../../src/engine/types'
import type { DesignState } from '../../src/trials/trial'

const registry = makeRegistry()
const template = (): DesignState => templateToDesign(Template.parse(JSON.parse(readFileSync('content/templates/concert-simple-reference.json', 'utf8'))))
const ref = (s: string): PortRef => {
  const [instance, port] = s.split(' ')
  return { instance, port }
}
const ok = (r: { ok: boolean }, what: string): void => {
  expect(r.ok, what).toBe(true)
}
/** The powered reference rig + the two signal cables, playback on; `controls` are set on the QL1, `power` per instance. */
function rig(o: { controls?: Record<string, ControlValue>; power?: Record<string, boolean>; playback?: boolean } = {}, reg: Registry = registry): DesignState {
  const s = new CreationStore(reg, creationEvaluator(reg), template())
  ok(s.dispatch({ type: 'CONNECT', a: ref('ql1 out-main-l'), b: ref('k12-g in-line-a') }), 'left cable')
  ok(s.dispatch({ type: 'CONNECT', a: ref('ql1 out-main-r'), b: ref('k12-d in-line-a') }), 'right cable')
  ok(s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: o.playback ?? true }), 'playback')
  for (const [control, value] of Object.entries(o.controls ?? {})) ok(s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control, value }), control)
  for (const [instance, value] of Object.entries(o.power ?? {})) ok(s.dispatch({ type: 'SET_CONTROL', instance, control: 'power', value }), `power ${instance}`)
  return s.design()
}
const pathOf = (d: DesignState, reg: Registry = registry): PathResult => signalPath(d, reg, [])
/** The catalog with every `acoustic` of `deviceId` edited by `edit` (a deep copy: the real file is never touched). */
function catalogWith(edit: (devices: Record<string, { acoustic?: Record<string, unknown> }>) => void): Registry {
  const raw = structuredClone(rawCatalog()) as { devices: { id: string; acoustic?: Record<string, unknown> }[] }
  edit(Object.fromEntries(raw.devices.map((d) => [d.id, d])))
  return loadCatalog(raw)
}

describe('coverageSources: the speakers that make sound', () => {
  it('the powered reference rig gives both K12.2, from the placements and the catalog coverage', () => {
    const d = rig()
    const src = coverageSources(d, registry, pathOf(d))
    expect(src.map((s) => s.id)).toEqual(['k12-d', 'k12-g'])
    const g = src.find((s) => s.id === 'k12-g')!
    expect(g).toEqual({ id: 'k12-g', pose: { position: [6, 2.7, -7.5], yawDeg: 0, tiltDeg: 0 }, hDeg: 75, vDeg: 75, lRefDb: 0 })
    expect(src.find((s) => s.id === 'k12-d')!.pose.position).toEqual([-6, 2.7, -7.5])
  })
  it('lRefDb = the feed gainDb (P10): a −6 dB fader gives −6 on every source', () => {
    const d = rig({ controls: { 'fader-master': '-6' } })
    expect(coverageSources(d, registry, pathOf(d)).map((s) => s.lRefDb)).toEqual([-6, -6])
  })
  it('yaw, tilt and position come from the placement (a rotated, tilted speaker)', () => {
    const d = rig()
    const p = d.placements.find((x) => x.instanceId === 'k12-g')!
    p.yawDeg = 30
    p.tiltDeg = -10
    p.position_m = [4, 3, -6]
    const g = coverageSources(d, registry, pathOf(d)).find((s) => s.id === 'k12-g')!
    expect(g.pose).toEqual({ position: [4, 3, -6], yawDeg: 30, tiltDeg: -10 })
  })
  it('a MUTED feed is excluded (the master mute silences both), with the reason; nothing is fed to the field', () => {
    const d = rig({ controls: { 'mute-master': true } })
    const path = pathOf(d)
    expect(path.playbackReady).toBe(true) // mute never gates playback (Task 34)
    const r = coverageSourcesDetail(d, registry, path)
    expect(r.sources).toEqual([])
    expect(r.excluded).toEqual([
      { instanceId: 'k12-d', reason: 'muted' },
      { instanceId: 'k12-g', reason: 'muted' },
    ])
    expect(noSourceMessage(path, r.excluded)).toBe('Aucune enceinte audible : la console est en mute.')
  })
  it('a fader at −inf is excluded as silent (it would add nothing to the field)', () => {
    const d = rig({ controls: { 'fader-master': '-inf' } })
    const r = coverageSourcesDetail(d, registry, pathOf(d))
    expect(r.sources).toEqual([])
    expect(r.excluded.map((e) => e.reason)).toEqual(['silent', 'silent'])
    expect(noSourceMessage(pathOf(d), r.excluded)).toBe('Aucune enceinte audible : le fader master est à −inf.')
  })
  it('an unpowered speaker is not fed by the path, so it is not a source (the other one is)', () => {
    const d = rig({ power: { 'k12-d': false } })
    expect(coverageSources(d, registry, pathOf(d)).map((s) => s.id)).toEqual(['k12-g'])
  })
  it('an unpowered speaker listed by a path anyway is excluded as unpowered (defence in depth)', () => {
    const d = rig({ power: { 'k12-d': false } })
    const path = pathOf(d)
    const forged: PathResult = { ...path, speakers: [...path.speakers, { instanceId: 'k12-d', channels: ['R'], gainDb: 0, muted: false, balance: 'C', path: [] }] }
    const r = coverageSourcesDetail(d, registry, forged)
    expect(r.sources.map((s) => s.id)).toEqual(['k12-g'])
    expect(r.excluded).toEqual([{ instanceId: 'k12-d', reason: 'unpowered' }])
  })
  it('nothing fed (playback off): no source, no exclusion, and the message quotes the playback reason', () => {
    const d = rig({ playback: false })
    const path = pathOf(d)
    const r = coverageSourcesDetail(d, registry, path)
    expect(r.sources).toEqual([])
    expect(r.excluded).toEqual([])
    expect(noSourceMessage(path, r.excluded)).toBe('Aucune enceinte audible : aucune enceinte ne reçoit de signal (la lecture console est coupée).')
  })
  it('a speaker WITHOUT acoustic data is excluded (computeField would throw): no RangeError reaches the field', () => {
    const reg = catalogWith((dev) => void delete dev['qsc-k12-2'].acoustic)
    const d = rig({}, reg)
    const r = coverageSourcesDetail(d, reg, pathOf(d, reg))
    expect(r.sources).toEqual([])
    expect(r.excluded.map((e) => e.reason)).toEqual(['no-acoustic', 'no-acoustic'])
    expect(() => computeField(r.sources, new Float32Array([0, 1.2, 0]))).not.toThrow()
    expect(noSourceMessage(pathOf(d, reg), r.excluded)).toBe('Aucune enceinte audible : enceinte sans données acoustiques.')
  })
  it('a Bêta (unverified) device is never a source, whatever the path says: it is not a catalog device', () => {
    const d = rig()
    const reg = makeRegistry()
    const k12 = reg.deviceById.get('qsc-k12-2')!
    // the registry knows a proposal only in deviceById (as registerProposals does); it carries (forged here) acoustic data
    reg.deviceById.set('beta-speaker', { ...k12, id: 'beta-speaker' })
    d.rig.instances.find((i) => i.instanceId === 'k12-d')!.deviceId = 'beta-speaker'
    const forged: PathResult = { ...pathOf(d), speakers: [{ instanceId: 'k12-d', channels: ['L'], gainDb: 0, muted: false, balance: 'C', path: [] }] }
    const r = coverageSourcesDetail(d, reg, forged)
    expect(r.sources).toEqual([])
    expect(r.excluded).toEqual([{ instanceId: 'k12-d', reason: 'unverified' }])
  })
  it('a fed speaker without a placement is excluded (no pose to compute from)', () => {
    const d = rig()
    d.placements = d.placements.filter((p) => p.instanceId !== 'k12-d')
    const r = coverageSourcesDetail(d, registry, pathOf(d))
    expect(r.sources.map((s) => s.id)).toEqual(['k12-g'])
    expect(r.excluded).toEqual([{ instanceId: 'k12-d', reason: 'no-placement' }])
  })
  it('a coverage that is not > 0 is excluded as bad-coverage, never thrown at the field', () => {
    const d = rig()
    const reg = makeRegistry()
    reg.deviceById.get('qsc-k12-2')!.acoustic!.coverage_h_deg.value = 0 // the in-memory registry only
    const r = coverageSourcesDetail(d, reg, pathOf(d, reg))
    expect(r.sources).toEqual([])
    expect(r.excluded.map((e) => e.reason)).toEqual(['bad-coverage', 'bad-coverage'])
    expect(() => computeField(r.sources, new Float32Array(3))).not.toThrow()
  })
  it('one source per speaker even if the path listed it twice', () => {
    const d = rig()
    const path = pathOf(d)
    const twice: PathResult = { ...path, speakers: [...path.speakers, ...path.speakers] }
    expect(coverageSources(d, registry, twice)).toHaveLength(2)
  })
  it('the field of the reference rig is finite and the loudest point is exactly 0 dB (what the e2e relies on)', () => {
    const d = rig()
    const f = computeField(coverageSources(d, registry, pathOf(d)), new Float32Array([6, 1.2, -6, 0, 1.2, 4, -6, 1.2, -6]))
    expect(Math.max(...f.relDb)).toBe(0)
    expect(Array.from(f.relDb).every(Number.isFinite)).toBe(true)
  })
  it('the front-yaw seam is data: an offset for a device id turns its acoustic axis, none by default', () => {
    const d = rig()
    const path = pathOf(d)
    expect(coverageSources(d, registry, path).every((s) => s.pose.yawDeg === 0)).toBe(true)
    const turned = coverageSources(d, registry, path, { frontYawOffsetDeg: { 'qsc-k12-2': 180 } })
    expect(turned.map((s) => s.pose.yawDeg)).toEqual([180, 180])
    // the placement itself is not edited
    expect(d.placements.find((p) => p.instanceId === 'k12-g')!.yawDeg).toBe(0)
  })
})

describe('« ≈ dB SPL estimé » (S2): the rule, proved on a synthetic catalog', () => {
  const sourced = (value: number): Record<string, unknown> => ({ value, source: { kind: 'datasheet', ref: 'synthetic test sheet', retrieved: '2026-10-29' } })
  it('is hidden today: no device of the real catalog has a sensitivity_db', () => {
    for (const d of registry.catalog.devices) expect(d.acoustic?.sensitivity_db, d.id).toBeUndefined()
    const d = rig()
    const used = coverageSourcesDetail(d, registry, pathOf(d)).used
    expect(used).toHaveLength(2)
    expect(splEstimateEligible(used)).toBe(false)
  })
  it('exists when EVERY contributing speaker has a sourced sensitivity AND max SPL', () => {
    const reg = catalogWith((dev) => {
      dev['qsc-k12-2'].acoustic!.sensitivity_db = sourced(98)
      dev['qsc-k12-2'].acoustic!.max_spl_db = sourced(132)
    })
    const d = rig({}, reg)
    const used = coverageSourcesDetail(d, reg, pathOf(d, reg)).used
    expect(used.map((u) => [u.sensitivityDb, u.maxSplDb])).toEqual([
      [98, 132],
      [98, 132],
    ])
    expect(splEstimateEligible(used)).toBe(true)
  })
  it('is hidden when a figure is missing for ANY contributing speaker (sensitivity or max SPL, NaN included)', () => {
    const onlyMax = catalogWith((dev) => void (dev['qsc-k12-2'].acoustic!.sensitivity_db = sourced(98))) // the K12.2 already has its sourced max_spl: complete
    const d1 = rig({}, onlyMax)
    expect(splEstimateEligible(coverageSourcesDetail(d1, onlyMax, pathOf(d1, onlyMax)).used)).toBe(true)
    const noMax = catalogWith((dev) => {
      dev['qsc-k12-2'].acoustic!.sensitivity_db = sourced(98)
      delete dev['qsc-k12-2'].acoustic!.max_spl_db
    })
    const d2 = rig({}, noMax)
    expect(splEstimateEligible(coverageSourcesDetail(d2, noMax, pathOf(d2, noMax)).used)).toBe(false)
    const used = coverageSourcesDetail(d1, onlyMax, pathOf(d1, onlyMax)).used
    const one = (over: Partial<UsedSpeaker>): UsedSpeaker => ({ ...used[0], ...over })
    expect(splEstimateEligible([one({}), one({ sensitivityDb: undefined })])).toBe(false) // one speaker without a sensitivity
    expect(splEstimateEligible([one({}), one({ maxSplDb: undefined })])).toBe(false)
    expect(splEstimateEligible([one({ sensitivityDb: NaN })])).toBe(false)
  })
  it('is never available with no contributing speaker', () => {
    expect(splEstimateEligible([])).toBe(false)
  })
})

describe('provenance: what the source line says', () => {
  it('the K12.2 coverage is KB data and its V angle is a deduction (L28 iii): « données KB (V déduit) »', () => {
    const d = rig()
    const used = coverageSourcesDetail(d, registry, pathOf(d)).used
    expect(used.every((u) => u.hKind === 'kb' && u.vKind === 'kb' && u.vDeduced)).toBe(true)
    expect(provenanceOf(used)).toEqual({ kinds: ['kb'], vDeduced: true })
    expect(sourceLine(used)).toBe('Couverture : données KB (V déduit)')
  })
  it('a nominal pair (the 8030C 90 × 60) reads « valeur nominale »; mixed with KB data both are listed, KB first', () => {
    const k = coverageSourcesDetail(rig(), registry, pathOf(rig())).used[0]
    const nominal: UsedSpeaker = { ...k, instanceId: 'g', deviceId: 'genelec-8030c', hKind: 'nominal', vKind: 'nominal', vDeduced: false }
    expect(sourceLine([nominal])).toBe('Couverture : valeur nominale')
    expect(sourceLine([nominal, k])).toBe('Couverture : données KB (V déduit) / valeur nominale')
  })
  it('a datasheet value reads « fiche constructeur »; an empty list has no line', () => {
    const k = coverageSourcesDetail(rig(), registry, pathOf(rig())).used[0]
    expect(sourceLine([{ ...k, hKind: 'datasheet', vKind: 'datasheet', vDeduced: false }])).toBe('Couverture : fiche constructeur')
    expect(sourceLine([])).toBeNull()
  })
  it('the deduction is read from the catalog note itself (a V without the note is not « déduit »)', () => {
    const reg = catalogWith((dev) => {
      const v = dev['qsc-k12-2'].acoustic!.coverage_v_deg as { source: { ref: string } }
      v.source.ref = 'knowledge-base/equipment/loudspeakers.json#qsc-k12-2 key_specs.coverage « 75° nominal »'
    })
    const d = rig({}, reg)
    const used = coverageSourcesDetail(d, reg, pathOf(d, reg)).used
    expect(used.every((u) => !u.vDeduced)).toBe(true)
    expect(sourceLine(used)).toBe('Couverture : données KB')
  })
})
