/**
 * Essais (ADR-0012), phase 1: comparing two Trials. Pure; design and rule
 * outcomes only, NO acoustic values. Inspired by the freeze-and-compare
 * behaviour of pro acoustic-design tools (behaviour only).
 */
import { diffDesign, type Trial } from './trial'

export interface TrialComparison {
  /** diffDesign(a.design, b.design): what the learner changed from A to B. */
  changed: string[]
  /** By ruleId across evidence.ruleResults: fixed = flagged in A, gone in B; broken = new in B. */
  rules: { fixed: string[]; broken: string[] }
  predictionA: { text: string; writtenAt: string }
  predictionB: { text: string; writtenAt: string }
}

const ruleIds = (t: Trial): Set<string> => new Set(t.evidence.ruleResults.map((r) => r.ruleId))

export function compareTrials(a: Trial, b: Trial): TrialComparison {
  const ra = ruleIds(a)
  const rb = ruleIds(b)
  return {
    changed: diffDesign(a.design, b.design),
    rules: {
      fixed: [...ra].filter((id) => !rb.has(id)).sort(),
      broken: [...rb].filter((id) => !ra.has(id)).sort(),
    },
    predictionA: { text: a.evidence.prediction.text, writtenAt: a.evidence.prediction.writtenAt },
    predictionB: { text: b.evidence.prediction.text, writtenAt: b.evidence.prediction.writtenAt },
  }
}
