// The guided flows of the legacy level play (`?level=a1|b1|c1|d1`), which one is offered first, and the live data they need.
//
// Two flows, procedure text only: read the level card, and make the next cable. The page keeps its own checklist of the required connections,
// so the guide adds no fact of its own: the cable to draw is the first required connection the level still misses (the bridge's first reason carries its
// two ports), the technical sentences are the app's rule texts (see verdict.ts).
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
/**
 * The legacy guide keeps its own state, one key per level: a flow of Mode Création is never restored on a level page, nor a flow left running on another
 * level (nor its mute choice). The level comes from the address and is one of the four practice levels, else the base key.
 */
export const LEGACY_STORAGE_KEY = 'oscar-guide.legacy.v1'
const PRACTICE_LEVELS: readonly string[] = ['a1', 'b1', 'c1', 'd1']
export function legacyStorageKey(search: string): string {
  try {
    const levels = new URLSearchParams(search).getAll('level')
    return levels.length === 1 && PRACTICE_LEVELS.includes(levels[0]) ? `${LEGACY_STORAGE_KEY}.${levels[0]}` : LEGACY_STORAGE_KEY
  } catch {
    return LEGACY_STORAGE_KEY
  }
}

export const LEGACY_FLOW_IDS = ['lire-l-objectif', 'premier-cable'] as const
type LegacyFlowId = (typeof LEGACY_FLOW_IDS)[number]

const L = TP_STRINGS.legacy

/**
 * The two flows. Each sentence stands without a ring: on the 2D board nothing can be projected, so no ring or ghost cable shows, and the text names the
 * page's own list (the first line not ticked) instead of pointing at something the learner may not see highlighted.
 */
export const LEGACY_FLOWS: Flow[] = [
  {
    id: 'lire-l-objectif',
    titleKey: 'flows.lire-l-objectif',
    steps: [{ id: 'read', anchor: LEGACY_NAV_OBJECTIVES, action: 'read', say: L.flows['lire-l-objectif'].steps.read, done: { event: ACKNOWLEDGE } }],
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

/**
 * The flows, the one that starts at what is next first, by the level's own data: while no required connection is made the reading comes first, while the
 * chain is partly made the cable comes first, and a complete chain goes back to the reading. Same flows, same objects.
 */
export function legacyFlowsFor(state: TpState | null): Flow[] {
  const [reading, cable] = LEGACY_FLOWS
  const partly = state !== null && state.connections.length > 0 && state.firstReason !== null
  return partly ? [cable, reading] : [reading, cable]
}

/** What a learner can type to reach a flow. Folded (no accent, no apostrophe), as the vendored router expects. */
export function legacyKeywords(): FlowKeywords[] {
  return [
    { flowId: 'lire-l-objectif', keywords: ['lire l objectif', 'lire le niveau', 'objectif du niveau', 'lire la consigne', 'quel est l objectif', 'quel est le but'] },
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
  where: { ...defaultStrings.where, workbench: TP_STRINGS.where.legacy },
  flows: Object.fromEntries(LEGACY_FLOW_IDS.map((id) => [id, L.flows[id].title])) as Record<LegacyFlowId, string>,
}
