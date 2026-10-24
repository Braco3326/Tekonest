import { FEATURES, type Features } from './features'
export type Route = 'creation' | 'legacy'
/** C1: the default URL is Mode Création; legacy keeps every ?level= URL and ?legacy=1. */
export function decideRoute(search: string, features: Features = FEATURES): Route {
  const p = new URLSearchParams(search)
  if (p.has('level') || p.get('legacy') === '1') return 'legacy'
  return features.levels ? 'legacy' : 'creation'
}
