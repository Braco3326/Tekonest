/** Essais (Task 13): A/B comparison. Rules and design only, no acoustic values. */
import { describe, expect, it } from 'vitest'
import { compareTrials } from '../../src/trials/compare'
import { createTrial, diffDesign, type RuleResult } from '../../src/trials/trial'
import { input, NOW } from './fixtures'

const rule = (ruleId: string, severity: RuleResult['severity'] = 'error'): RuleResult => ({
  ruleId,
  severity,
  subjects: [{ instance: 'mic-1', port: 'out' }],
})

async function pair() {
  const a = await createTrial(
    input({
      evidence: { ...input().evidence, ruleResults: [rule('R2'), rule('R5', 'warning'), rule('R2')] },
    }),
    NOW,
    'tr_a',
  )
  const ib = input({
    name: 'Essai B',
    parent: a,
    evidence: {
      ...input().evidence,
      prediction: { text: 'Plus de retour sur scène.', writtenAt: '2026-10-24T10:03:00.000Z' },
      ruleResults: [rule('R5', 'warning'), rule('R7')],
    },
  })
  ib.design.placements[1].position_m = [-3, 2.2, -9]
  ib.design.rig.controls['mic-1'] = { phantom: true }
  const b = await createTrial(ib, NOW, 'tr_b')
  return { a, b }
}

describe('compareTrials', () => {
  it('changed = diffDesign(a.design, b.design)', async () => {
    const { a, b } = await pair()
    const c = compareTrials(a, b)
    expect(c.changed).toEqual(diffDesign(a.design, b.design))
    expect(c.changed).toEqual(['placement:spk-l', 'control:mic-1.phantom'])
  })

  it('rules: fixed = in A not in B, broken = in B not in A (by ruleId, unique, sorted)', async () => {
    const { a, b } = await pair()
    expect(compareTrials(a, b).rules).toEqual({ fixed: ['R2'], broken: ['R7'] })
    expect(compareTrials(b, a).rules).toEqual({ fixed: ['R7'], broken: ['R2'] })
  })

  it('carries both predictions as written', async () => {
    const { a, b } = await pair()
    const c = compareTrials(a, b)
    expect(c.predictionA).toEqual({ text: 'Le micro arrive sur la tranche 1.', writtenAt: '2026-10-24T10:00:00.000Z' })
    expect(c.predictionB).toEqual({ text: 'Plus de retour sur scène.', writtenAt: '2026-10-24T10:03:00.000Z' })
  })

  it('a trial compared with itself: nothing changed, nothing fixed or broken', async () => {
    const { a } = await pair()
    const c = compareTrials(a, a)
    expect(c.changed).toEqual([])
    expect(c.rules).toEqual({ fixed: [], broken: [] })
  })

  it('exposes exactly the four fields (no acoustic values)', async () => {
    const { a, b } = await pair()
    expect(Object.keys(compareTrials(a, b)).sort()).toEqual(['changed', 'predictionA', 'predictionB', 'rules'])
  })
})
