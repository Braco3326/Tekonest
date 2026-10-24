/**
 * Essais: compact rule results (rulesRev pins the catalog texts) and the
 * measured size of a realistic medium Trial (recorded in ADR-0012).
 */
import { describe, expect, it } from 'vitest'
import type { TeachingEvent } from '../../src/engine/types'
import { createTrial, type DesignState } from '../../src/trials/trial'
import { input, NOW } from './fixtures'

const longTeach = 'Un micro dynamique n’a pas besoin du +48 V ; le fantôme sert aux micros statiques et aux boîtes de direct actives. '.repeat(2)
const event = (ruleId: string, i: number): TeachingEvent => ({
  ruleId,
  severity: i % 2 ? 'warning' : 'error',
  title: `Titre long de la règle ${ruleId} pour l’apprenant`,
  teach: longTeach,
  subjects: [{ instance: `dev-${i}`, port: 'out' }],
})

function mediumDesign(): DesignState {
  const devices = ['sm58', 'sm57', 'beta52', 'di-box', 'mixer-16', 'stagebox', 'powered-12', 'powered-12', 'sub-18', 'wedge-12', 'wedge-12', 'iem-tx']
  const instances = devices.map((deviceId, i) => ({ instanceId: `dev-${i}`, deviceId }))
  const connections = Array.from({ length: 14 }, (_, i) => ({
    a: { instance: `dev-${i % 12}`, port: `out-${i}` },
    b: { instance: 'dev-4', port: `in-${i + 1}` },
  }))
  const placements = instances.map((x, i) => ({
    instanceId: x.instanceId,
    deviceId: x.deviceId,
    position_m: [i * 0.731 - 4.2, 1.234, -6.789 + i * 0.5] as [number, number, number],
    yawDeg: (i * 17.3) % 360,
  }))
  return {
    roomId: 'auditorium-moyen',
    rig: { instances, connections, controls: { 'dev-0': { phantom: false }, 'dev-3': { phantom: true, pad: true }, 'dev-4': { route: 'main' } } },
    placements,
  }
}

describe('Evidence: compact rule results', () => {
  it('stores only {ruleId, severity, subjects}: no title/teach text (rulesRev pins it)', async () => {
    const i = input()
    i.evidence.ruleResults = [event('R4', 0)]
    i.evidence.levelState = {
      chainComplete: false,
      connectedRequired: 1,
      totalRequired: 2,
      missing: [],
      violations: [event('R5', 1)],
      won: false,
    }
    const t = await createTrial(i, NOW, 'tr_x')
    expect(t.evidence.ruleResults).toEqual([{ ruleId: 'R4', severity: 'error', subjects: [{ instance: 'dev-0', port: 'out' }] }])
    expect(t.evidence.levelState?.violations).toEqual([{ ruleId: 'R5', severity: 'warning', subjects: [{ instance: 'dev-1', port: 'out' }] }])
    expect(JSON.stringify(t)).not.toContain('fantôme')
  })
})

describe('frozen design is stored quantised (data model: "quantised to 1 mm when frozen")', () => {
  it('positions to 1 mm, yaw normalised to [0, 360) at 0.1°, fingerprint unchanged', async () => {
    const i = input()
    i.design.placements[0].position_m = [1.23456, -0.0004, 2.0000000001]
    i.design.placements[0].yawDeg = -10.04
    const t = await createTrial(i, NOW, 'tr_x')
    expect(t.design.placements[0].position_m).toEqual([1.235, 0, 2])
    expect(t.design.placements[0].yawDeg).toBe(350)
    expect(Object.is(t.design.placements[0].position_m[1], -0)).toBe(false)
    const again = await createTrial(input({ design: JSON.parse(JSON.stringify(t.design)) }), NOW, 'tr_y')
    expect(again.fingerprint).toBe(t.fingerprint)
  })
})

describe('size of a medium Essai', () => {
  it('12 devices, 14 cables, 3 rule events, 200-char prediction and note: measured', async () => {
    const i = input({ design: mediumDesign() })
    i.evidence.prediction.text = 'P'.repeat(200)
    i.evidence.note = 'N'.repeat(200)
    i.evidence.ruleResults = [event('R4', 0), event('R5', 1), event('R6', 2)]
    i.evidence.levelState = {
      chainComplete: false,
      connectedRequired: 12,
      totalRequired: 14,
      missing: [
        { from: { instance: 'dev-6', port: 'in' }, to: { instance: 'dev-4', port: 'main-l' } },
        { from: { instance: 'dev-7', port: 'in' }, to: { instance: 'dev-4', port: 'main-r' } },
      ],
      violations: [event('R4', 0), event('R5', 1), event('R6', 2)],
      won: false,
    }
    i.consumed = { room: { roomId: 'auditorium-moyen', geometryRev: 'g1:' + 'a'.repeat(64) } }
    i.evidence.rulesRev = 'r1:' + 'b'.repeat(64)
    const t = await createTrial(i, NOW, 'tr_lzv4k1x2abc123')
    const size = JSON.stringify(t).length
    console.info(`[essai-size] medium Trial = ${size} UTF-16 code units`)
    expect(size).toBeLessThan(5000)
  })
})
