import { FEATURES, type Features } from './features'
export type Route = 'creation' | 'legacy'
/**
 * C1: the default URL is Mode Création. The learning pages (levels, exam, sandbox, dashboard, the 2D board) keep every `?level=` URL and `?legacy=1` only while
 * `features.legacyPages` is on (absent counts as on); in the shipped product it is off, so those addresses open Mode Création too (founder, 2026-11-15).
 */
export function decideRoute(search: string, features: Features = FEATURES): Route {
  if (features.legacyPages === false) return 'creation'
  const p = new URLSearchParams(search)
  if (p.has('level') || p.get('legacy') === '1') return 'legacy'
  return features.levels ? 'legacy' : 'creation'
}
