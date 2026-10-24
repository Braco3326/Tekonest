/**
 * Essais (Task 10): write-once Trial + diffDesign. Pure.
 */
import { describe, expect, it } from 'vitest'
import { fingerprint } from '../../src/trials/fingerprint'
import { createTrial, diffDesign, newTrialId, TrialError } from '../../src/trials/trial'
import { design, input, NOW } from './fixtures'

describe('createTrial', () => {
  it('builds a formatVersion 1 Trial with an fp1 fingerprint of the design', async () => {
    const t = await createTrial(input(), NOW, 'tr_test1')
    expect(t.formatVersion).toBe(1)
    expect(t.id).toBe('tr_test1')
    expect(t.frozenAt).toBe(NOW)
    expect(t.parentId).toBeNull()
    expect(t.fingerprint).toBe(await fingerprint(design()))
    expect(t.evidence.noteAmendments).toEqual([])
    expect(t.evidence.changedSinceParent).toEqual([])
    expect(t.view.pivot).toEqual([0, 1, 0])
    expect(t.consumed.room).toEqual({ roomId: 'salle-polyvalente', geometryRev: null })
  })

  it('accepts a Date clock', async () => {
    const t = await createTrial(input(), new Date(NOW), 'tr_x')
    expect(t.frozenAt).toBe(NOW)
  })

  it('rejects an empty or blank prediction', async () => {
    for (const text of ['', '   \n']) {
      const bad = input()
      bad.evidence.prediction.text = text
      await expect(createTrial(bad, NOW, 'tr_x')).rejects.toMatchObject({ code: 'prediction-required' })
      await expect(createTrial(bad, NOW, 'tr_x')).rejects.toBeInstanceOf(TrialError)
    }
  })

  it('rejects a prediction written after the freeze', async () => {
    const bad = input()
    bad.evidence.prediction.writtenAt = '2026-10-24T10:06:00.000Z'
    await expect(createTrial(bad, NOW, 'tr_x')).rejects.toMatchObject({ code: 'prediction-after-freeze' })
  })

  it('accepts writtenAt equal to frozenAt', async () => {
    const ok = input()
    ok.evidence.prediction.writtenAt = NOW
    await expect(createTrial(ok, NOW, 'tr_x')).resolves.toBeTruthy()
  })

  it('an unquantisable design → TrialError("invalid-design"), never a raw RangeError', async () => {
    for (const bad of [[Number.NaN, 0, 0], [1e300, 0, 0]] as [number, number, number][]) {
      const i = input()
      i.design.placements[0].position_m = bad
      await expect(createTrial(i, NOW, 'tr_x')).rejects.toMatchObject({ name: 'TrialError', code: 'invalid-design' })
    }
  })

  it('a failing hasher → TrialError("crypto-unavailable")', async () => {
    const failing = async (): Promise<string> => {
      throw new Error('no crypto')
    }
    await expect(createTrial(input(), NOW, 'tr_x', failing)).rejects.toMatchObject({ code: 'crypto-unavailable' })
  })

  it('returns a deep-frozen object (mutation throws in strict mode)', async () => {
    const t = await createTrial(input(), NOW, 'tr_x')
    expect(Object.isFrozen(t)).toBe(true)
    expect(Object.isFrozen(t.design.placements[0].position_m)).toBe(true)
    expect(() => {
      ;(t as { name: string }).name = 'hack'
    }).toThrow(TypeError)
    expect(() => {
      ;(t.design.placements[0].position_m as number[])[0] = 99
    }).toThrow(TypeError)
    expect(() => {
      ;(t.evidence.noteAmendments as unknown[]).push({ text: 'x', at: NOW })
    }).toThrow(TypeError)
  })

  it('copies its inputs by value (later edits to the live design do not leak in)', async () => {
    const i = input()
    const t = await createTrial(i, NOW, 'tr_x')
    i.design.placements[0].position_m[0] = 42
    expect(t.design.placements[0].position_m[0]).toBe(0)
  })

  it('takes parentId and changedSinceParent from the parent Trial', async () => {
    const parent = await createTrial(input(), NOW, 'tr_parent')
    const child = input({ parent })
    child.design.placements[1].position_m = [-3, 2.2, -9]
    const t = await createTrial(child, NOW, 'tr_child')
    expect(t.parentId).toBe('tr_parent')
    expect(t.evidence.changedSinceParent).toEqual(['placement:spk-l'])
  })
})

describe('newTrialId', () => {
  it("is 'tr_' + base36 timestamp + random, from injected clock and rng", () => {
    const id = newTrialId(1_700_000_000_000, () => 0.5)
    expect(id.startsWith('tr_' + (1_700_000_000_000).toString(36))).toBe(true)
    expect(id).toMatch(/^tr_[0-9a-z]+$/)
    expect(newTrialId(1, () => 0.1)).not.toBe(newTrialId(1, () => 0.2))
  })
})

describe('diffDesign', () => {
  it('is empty for equal designs', () => {
    expect(diffDesign(design(), design())).toEqual([])
  })

  it('placement: moved more than 1 mm, or yaw changed more than 0.1°', () => {
    const b = design()
    b.placements[0].position_m = [0.0005, 1.2, -3] // 0.5 mm: no change
    b.placements[1].yawDeg = 10.05 // 0.05°: no change
    expect(diffDesign(design(), b)).toEqual([])
    b.placements[0].position_m = [0.002, 1.2, -3]
    expect(diffDesign(design(), b)).toEqual(['placement:mic-1'])
    b.placements[1].yawDeg = 10.2
    expect(diffDesign(design(), b)).toEqual(['placement:mic-1', 'placement:spk-l'])
  })

  it('instance:+id / instance:-id', () => {
    const b = design()
    b.rig.instances = b.rig.instances.filter((i) => i.instanceId !== 'mic-1')
    b.rig.instances.push({ instanceId: 'spk-r', deviceId: 'powered-12' })
    expect(diffDesign(design(), b)).toEqual(['instance:+spk-r', 'instance:-mic-1'])
  })

  it('connection:+N / connection:-N counts, direction-insensitive', () => {
    const b = design()
    b.rig.connections = [
      { a: { instance: 'spk-l', port: 'in' }, b: { instance: 'mix', port: 'main-l' } }, // same cable, reversed
      { a: { instance: 'mix', port: 'main-r' }, b: { instance: 'spk-r', port: 'in' } },
      { a: { instance: 'mix', port: 'aux-1' }, b: { instance: 'mon', port: 'in' } },
    ]
    expect(diffDesign(design(), b)).toEqual(['connection:+2', 'connection:-1'])
  })

  it('control:<instance>.<control>, including added and removed controls', () => {
    const b = design()
    b.rig.controls = { 'mic-1': { phantom: true }, mix: {}, 'spk-l': { power: true } }
    expect(diffDesign(design(), b)).toEqual(['control:mic-1.phantom', 'control:mix.route', 'control:spk-l.power'])
  })

  it('room', () => {
    const b = design()
    b.roomId = null
    expect(diffDesign(design(), b)).toEqual(['room'])
  })

  it('reports several kinds in a stable order', () => {
    const b = design()
    b.placements[1].position_m = [-3, 2.2, -9]
    b.rig.connections.push({ a: { instance: 'mix', port: 'main-r' }, b: { instance: 'spk-r', port: 'in' } })
    b.rig.controls['mic-1'].phantom = true
    expect(diffDesign(design(), b)).toEqual(['placement:spk-l', 'connection:+1', 'control:mic-1.phantom'])
  })
})
