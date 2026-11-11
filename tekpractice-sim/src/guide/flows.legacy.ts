// The guided flows of the legacy level play (`?level=a1|b1|c1|d1`), which one is offered first, and the live data they need.
//
// Two flows, procedure text only: read the level's objective, and make the next cable. The page keeps its own checklist of the required connections,
// so the guide adds no fact of its own: the cable to draw is the first required connection the level still misses (the bridge's first reason carries its
// two ports), the objective is the level's own sentence, quoted as it is, and the technical sentences are the app's rule texts (see verdict.ts).
//
// Like Mode Création, a step ends on a host event: the bridge derives `connect` from the level's required links; a `read` step has no change of the
// bench to wait for, so the mount sends `acknowledge` when the learner clicks inside the objectives card (the step is about reading it).
// No step has `hintAfterMs`: nothing here speaks on its own (the page's own toast and its « Pourquoi ? » button are the only unasked voice).
import { MISSING_LINK, type TpPortRef, type TpState } from './bridge/types'
import { ACKNOWLEDGE, SUGGEST_FROM, SUGGEST_TO } from './flows.creation'
import { TP_STRINGS } from './strings'
import { strings as defaultStrings } from './vendor/content/strings.fr'
import type { FlowKeywords } from './vendor/core/router'
import type { Flow } from './vendor/core/types'

export const LEGACY_NAV_OBJECTIVES = 'nav:objectif'
/** A click inside this element of the page is the learner reading the objectives card (`#hud-objectives`, src/ui/hud.ts). */
export const LEGACY_ACK_SELECTOR = '#hud-objectives'
/** The legacy guide keeps its own state: a flow of Mode Création is never restored on the level page (nor its mute choice). */
export const LEGACY_STORAGE_KEY = 'oscar-guide.legacy.v1'

export const LEGACY_FLOW_IDS = ['lire-l-objectif', 'premier-cable'] as const
type LegacyFlowId = (typeof LEGACY_FLOW_IDS)[number]

const L = TP_STRINGS.legacy

/** The two flows. With an objective, the first step quotes it, word for word, in guillemets; without one it only points at the card. */
export function legacyFlows(objective?: string): Flow[] {
  const quote = typeof objective === 'string' && objective.trim() !== '' ? objective.trim() : null
  return [
    {
      id: 'lire-l-objectif',
      titleKey: 'flows.lire-l-objectif',
      steps: [
        {
          id: 'read',
          anchor: LEGACY_NAV_OBJECTIVES,
          action: 'read',
          say: quote === null ? L.flows['lire-l-objectif'].steps.read : `${L.flows['lire-l-objectif'].steps.readQuoted} « ${quote} »`,
          done: { event: ACKNOWLEDGE },
        },
      ],
    },
    {
      id: 'premier-cable',
      titleKey: 'flows.premier-cable',
      steps: [
        { id: 'connect', anchor: SUGGEST_FROM, to: SUGGEST_TO, action: 'drag', say: L.flows['premier-cable'].steps.connect, done: { event: 'connect' } },
        { id: 'check', anchor: LEGACY_NAV_OBJECTIVES, action: 'read', say: L.flows['premier-cable'].steps.check, done: { event: ACKNOWLEDGE } },
      ],
    },
  ]
}

/** The flows with no objective to quote (the generic ones). */
export const LEGACY_FLOWS: Flow[] = legacyFlows()

const byObjective = new Map<string, Flow[]>()
function flowsQuoting(objective: string | undefined): Flow[] {
  const key = typeof objective === 'string' ? objective.trim() : ''
  let set = byObjective.get(key)
  if (set === undefined) {
    if (byObjective.size > 16) byObjective.clear()
    set = legacyFlows(key)
    byObjective.set(key, set)
  }
  return set
}

/**
 * The flows, the one that starts at what is next first, by the level's own data: while no required connection is made the objective comes first, while the
 * chain is partly made the cable comes first, and a complete chain goes back to the objective. Same objective, same flow objects.
 */
export function legacyFlowsFor(state: TpState | null): Flow[] {
  const set = flowsQuoting(state?.objective)
  const [objective, cable] = set
  const partly = state !== null && state.connections.length > 0 && state.firstReason !== null
  return partly ? [cable, objective] : [objective, cable]
}

/** What a learner can type to reach a flow. Folded (no accent, no apostrophe), as the vendored router expects. */
export function legacyKeywords(): FlowKeywords[] {
  return [
    { flowId: 'lire-l-objectif', keywords: ['lire l objectif', 'objectif du niveau', 'lire la consigne', 'quel est l objectif', 'quel est le but'] },
    { flowId: 'premier-cable', keywords: ['premier cable', 'premiere connexion', 'premier branchement', 'brancher le premier', 'relier les deux'] },
  ]
}

/**
 * The cable the learner can draw now: the first required connection the level still misses (its two ports, from the bridge's first reason).
 * Null when the chain is complete, or when the reason is not a missing link.
 */
export function nextLegacyLink(state: TpState): { from: TpPortRef; to: TpPortRef } | null {
  const r = state.firstReason
  if (r === null || r.code !== MISSING_LINK || r.subjects.length < 2) return null
  return { from: { ...r.subjects[0] }, to: { ...r.subjects[1] } }
}

/**
 * The controller's string table: the vendored default one with the flow titles of this page and the host's own sentence after a need-info verdict
 * (`planner.needInfo`: the vendored one asks to run a check again, and this page has no check button). A step text is passed as the sentence itself.
 */
export const LEGACY_STRINGS = {
  ...defaultStrings,
  planner: { ...defaultStrings.planner, needInfo: L.planner.needInfo },
  flows: Object.fromEntries(LEGACY_FLOW_IDS.map((id) => [id, L.flows[id].title])) as Record<LegacyFlowId, string>,
}
