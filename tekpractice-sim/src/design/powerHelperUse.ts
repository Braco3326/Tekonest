/**
 * What Mode Création tells the guide about the power helper (onboarding spec 6.5, plan T3.3 and T3.4). Neutral: neither side imports
 * the other. Mode Création counts the helper's uses for the page's life and says whether the helper is offered now; it exposes both as readers on its debug hook
 * (`window.__creation.helperOffered()` / `helperUses()`, src/creation/onboarding/wire.ts), which the guide's bridge already polls. NOT through storage: with a
 * blocked storage the guide must still mark the steps the helper did « montré » (S2: before, a lost storage mark made them look like the learner's own success).
 *   offered     the checklist's button would be shown now, and enabled once the tutorial gate opens (a verified strip, something to cable, free outlets)
 *   n           uses since the page loaded (only grows)
 *   instances   the devices the last use cabled
 * Pure: no DOM.
 */
export interface PowerHelperUses {
  n: number
  instances: string[]
}

/** The two readers as the guide sees them in one look. */
export interface PowerHelperReading extends PowerHelperUses {
  offered: boolean
}

/** A plain copy of what the hook returned, or null when it is not a well-formed reading (never a throw). */
export function readPowerHelper(offered: unknown, uses: unknown): PowerHelperReading | null {
  try {
    if (typeof offered !== 'boolean' || uses === null || typeof uses !== 'object') return null
    const u = uses as { n?: unknown; instances?: unknown }
    if (typeof u.n !== 'number' || !Number.isSafeInteger(u.n) || u.n < 0) return null
    if (!Array.isArray(u.instances) || !u.instances.every((s) => typeof s === 'string')) return null
    return { offered, n: u.n, instances: [...(u.instances as string[])] }
  } catch {
    return null
  }
}
