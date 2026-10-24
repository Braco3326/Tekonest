/**
 * Win bookkeeping after a refresh (pure; extracted for the Task 14 review).
 * Only a learner action ('normal') can EARN a win (recordWin, win card, exam
 * finish). An Essais restore ('restore') re-applies a frozen design: the
 * in-memory flag follows the state silently, and nothing is recorded.
 * A compare preview ('preview') never touches the flag.
 */
export type RefreshMode = 'normal' | 'preview' | 'restore'

export interface WinStep {
  won: boolean
  /** Record the win, show the card / finish the exam. */
  earn: boolean
  /** Retract the win card. */
  retract: boolean
}

export function winTransition(mode: RefreshMode, stateWon: boolean, won: boolean, sandbox: boolean): WinStep {
  // Sandbox has no requiredChain — "won" is meaningless there (ADR-0004).
  if (sandbox || mode === 'preview') return { won, earn: false, retract: false }
  if (mode === 'restore') return { won: stateWon, earn: false, retract: won && !stateWon }
  if (stateWon && !won) return { won: true, earn: true, retract: false }
  if (!stateWon && won) return { won: false, earn: false, retract: true }
  return { won, earn: false, retract: false }
}
