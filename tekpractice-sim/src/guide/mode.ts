// Mode gate of the guide. Fail closed: "practice" only on the two practice surfaces, "exam" otherwise.
// It reads the query only, creates nothing and never throws.
import { FEATURES, type Features } from '../features'

export type GuideMode = 'practice' | 'exam'
export type GuideRoute = 'creation' | 'legacy'

const PRACTICE_LEVELS: readonly string[] = ['a1', 'b1', 'c1', 'd1']

function parse(search: unknown): URLSearchParams | null {
  if (typeof search !== 'string') return null
  try {
    return new URLSearchParams(search)
  } catch {
    return null
  }
}

/** The decoded keys of the query, lower-cased (so MODE, Mode and %6Dode all read as mode). */
function lowerKeys(params: URLSearchParams): Set<string> {
  const out = new Set<string>()
  for (const k of params.keys()) out.add(k.toLowerCase())
  return out
}

/**
 * "practice" only for (a) the creation route with no `mode`, `level` or `legacy` parameter at all, and (b) the legacy route
 * with `level` exactly one of a1, b1, c1, d1 (case-sensitive, no whitespace) and no `mode` parameter.
 * Every other input, including any `mode` value (even empty) and unparsable input, is "exam".
 */
export function guideMode(search: string, route: GuideRoute): GuideMode {
  try {
    const params = parse(search)
    if (!params) return 'exam'
    const keys = lowerKeys(params)
    if (keys.has('mode')) return 'exam'
    if (route === 'creation') return keys.has('level') || keys.has('legacy') ? 'exam' : 'practice'
    if (route === 'legacy') {
      const levels = params.getAll('level')
      return levels.length === 1 && PRACTICE_LEVELS.includes(levels[0]) ? 'practice' : 'exam'
    }
    return 'exam'
  } catch {
    return 'exam'
  }
}

/** False when the flag is off or any `oscar` parameter (any key case) is 0. A missing search follows the flag alone. */
export function guideEnabled(search: string, features: Features = FEATURES): boolean {
  if (!features.guide) return false
  try {
    const params = parse(search)
    if (!params) return true
    for (const [k, v] of params) if (k.toLowerCase() === 'oscar' && v === '0') return false
    return true
  } catch {
    return true
  }
}

/** The explicit opt-in of the level page: any oscar parameter (any key case) whose value is exactly legacy. */
function legacyOptIn(search: unknown): boolean {
  const params = parse(search)
  if (!params) return false
  for (const [k, v] of params) if (k.toLowerCase() === 'oscar' && v === 'legacy') return true
  return false
}

/**
 * Whether the guide may start on a route: guideEnabled (the master flag; oscar=0 wins over everything), and for level play also the level flag or the
 * explicit opt-in oscar=legacy. Mode Création needs nothing more. This is not the mode gate: the opt-in never makes an exam address practice (guideMode decides
 * that from the address alone).
 */
export function guideRouteAllowed(search: string, route: GuideRoute, features: Features = FEATURES): boolean {
  if (!guideEnabled(search, features)) return false
  if (route === 'creation') return true
  if (route !== 'legacy') return false
  if (features.guideLegacy) return true
  try {
    return legacyOptIn(search)
  } catch {
    return false
  }
}
