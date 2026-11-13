// The guide's verdict, built only from the app's own data: its rule events, the catalog's rule texts (through ruleTextFor) and the
// signal path's first reason. Nothing here is invented: a fix is the catalog's explanation verbatim (or, when a rule has none, the app's own title text).
import type { RuleText } from '../creation/shell/statusModel'
import { stateHash } from './bridge/shared'
import type { TpPortRef, TpState } from './bridge/types'
import { TP_STRINGS } from './strings'
import type { Verdict } from './vendor/hostTypes'

/**
 * The browser-side shape check only accepts a hash of 1 to 128 letters, digits and colons, and `stateHash` is a JSON string:
 * the verdict carries a short digest of it instead (two 32-bit FNV-1a runs with different seeds: equal states give equal digests,
 * and a change anywhere in the state changes it).
 */
export function digestOf(text: string): string {
  let a = 0x811c9dc5
  let b = 0x01000193
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193) >>> 0
    b = Math.imul(b ^ c, 0x85ebca6b) >>> 0
    b = (b ^ (b >>> 13)) >>> 0
  }
  return `h:${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`
}

const copyRefs = (refs: readonly TpPortRef[]): TpPortRef[] => refs.map((r) => ({ instance: r.instance, port: r.port }))

/** The app's text for a rule; a lookup that fails gives an empty text (never an invented one). */
function textOf(ruleText: RuleText, ruleId: string): { title: string; detail: string } {
  try {
    const t = ruleText(ruleId)
    return { title: typeof t.title === 'string' ? t.title : '', detail: typeof t.detail === 'string' ? t.detail : '' }
  } catch {
    return { title: '', detail: '' }
  }
}

/**
 * `reason` (the closest of the four the host type allows):
 *  - a-corriger: 'setup-error' (a rule of the app is broken);
 *  - indetermine with nothing on the bench, no place, or a reason from the signal path: 'missing-input' (something is still to be added);
 *  - indetermine with no error and no reason given: 'no-coverage' (the app cannot say more);
 *  - bon: null.
 */
export function buildVerdict(state: TpState, ruleText: RuleText): Verdict {
  const base = { setupHash: digestOf(stateHash(state)), coveredFamilies: [] as string[], note: null, notEvaluated: [] as Verdict['notEvaluated'] }
  // Level play: the checks a level declares are its lesson, so any event blocks the win, a warning as well (severity only styles the app's own toast).
  const legacy = state.route === 'legacy'
  const firstAt = state.events.findIndex((e) => legacy || e.severity === 'error')
  const first = firstAt < 0 ? undefined : state.events[firstAt]

  if (first !== undefined) {
    const t = textOf(ruleText, first.ruleId)
    // A rule with no explanation (an id missing from the catalog) is shown by its title alone: the fix is that same text, never a made-up one.
    const cause = t.title !== '' ? t.title : TP_STRINGS.verdict.toFix
    return {
      ...base,
      result: 'a-corriger',
      labelFr: cause,
      reason: 'setup-error',
      primary: {
        ruleId: first.ruleId,
        subjects: copyRefs(first.subjects),
        causeFr: cause,
        fixFr: t.detail !== '' ? t.detail : cause,
        factIds: [],
      },
      alsoFound: state.events.filter((_, i) => i !== firstAt).map((e) => ({ ruleId: e.ruleId, subjects: copyRefs(e.subjects) })),
    }
  }

  const indetermine = (labelFr: string, reason: NonNullable<Verdict['reason']>): Verdict => ({ ...base, result: 'indetermine', labelFr, reason, primary: null, alsoFound: [] })

  if (state.playbackReady) return { ...base, result: 'bon', labelFr: legacy ? TP_STRINGS.verdict.legacyWon : TP_STRINGS.verdict.allGood, reason: null, primary: null, alsoFound: [] }
  if (!state.placeKnown) return indetermine(TP_STRINGS.verdict.placeFirst, 'missing-input')
  if (state.instances.length === 0) return indetermine(TP_STRINGS.verdict.benchEmpty, 'missing-input')
  if (state.firstReason !== null && state.firstReason.text_fr !== '') return indetermine(legacy ? `${TP_STRINGS.verdict.nextLink} ${state.firstReason.text_fr}` : state.firstReason.text_fr, 'missing-input')
  return indetermine(TP_STRINGS.verdict.notYet, 'no-coverage')
}
