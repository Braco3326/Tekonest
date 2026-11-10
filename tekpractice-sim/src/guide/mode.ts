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

/**
 * "practice" only for (a) the creation route with no `mode` parameter at all, and (b) the legacy route
 * with `level` exactly one of a1, b1, c1, d1 (case-sensitive, no whitespace) and no `mode` parameter.
 * Every other input, including any `mode` value (even empty) and unparsable input, is "exam".
 */
export function guideMode(search: string, route: GuideRoute): GuideMode {
  try {
    const params = parse(search)
    if (!params) return 'exam'
    if (params.has('mode')) return 'exam'
    if (route === 'creation') return 'practice'
    if (route === 'legacy') {
      const levels = params.getAll('level')
      return levels.length === 1 && PRACTICE_LEVELS.includes(levels[0]) ? 'practice' : 'exam'
    }
    return 'exam'
  } catch {
    return 'exam'
  }
}

/** False when the flag is off or the query carries `oscar=0`. */
export function guideEnabled(search: string, features: Features = FEATURES): boolean {
  if (!features.guide) return false
  const params = parse(search)
  return !(params && params.get('oscar') === '0')
}
