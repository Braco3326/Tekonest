/**
 * The ONE banned-phrase list of the onboarding packs (spec section 9), shared by tests/creation/honesty.test.ts, tests/creation/ruleOverrides.test.ts
 * and tests/guide/verdict.test.ts. Lexical on purpose: section 11 adds a runtime scan for what lives outside COPY.
 *
 * Two scopes. `everywhere` families apply to every visible-text surface; `learner` families (success and school, figures, Oscar's voice) apply to the
 * onboarding / tutorial / checklist / assist / Oscar strings and the rule overrides, because the app's own panels legitimately carry figures
 * (« 230 V », « dB relatif ») and the words of the school world (« examen ») outside what teaches the learner.
 */

export interface Family {
  name: string
  re: RegExp
  scope: 'everywhere' | 'learner'
}

export const FAMILIES: readonly Family[] = [
  { name: 'success and school', scope: 'learner', re: /réussi|prépare au|\bBTS\b|\bE4\b|\bTMO\b|\bjury\b|\bexamen/i },
  // « vrai matériel » is allowed only as « vrai matériel simplifié »; \b is ASCII-only in JS, so the accented words carry no boundary.
  { name: 'fidelity', scope: 'everywhere', re: /réaliste|vrai matériel(?! simplifié)|garanti|certifié|\bexact|fidèle|identique|comme en vrai|comme sur scène|sonnera/i },
  { name: 'safety and norms', scope: 'everywhere', re: /endommag|abîm|griller|danger|sécurité|\bnorme|conforme|\bSTI\b|\bSPL\b|RT60/i },
  // « correct » as a word (correct, correcte, corrects): « correction » is not a judgement.
  { name: 'judgement', scope: 'everywhere', re: /bravo|parfait|\bcorrect(?:e|es|s)?\b|réussi|bien réglé/i },
  { name: 'false certainty', scope: 'everywhere', re: /la seule|le seul|passé par votre câblage|vous entendez le micro/i },
  {
    name: 'durations',
    scope: 'everywhere',
    re: /\d+\s*(?:s|sec|secondes?|mn|min|minutes?)\b|\b(?:une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|quinze|vingt|trente|quarante|soixante)\s+(?:secondes?|minutes?)\b|\bune minute\b/i,
  },
  { name: 'figures', scope: 'learner', re: /\d|\bdBu?V?\b|\+48/i },
  { name: 'Oscar’s voice', scope: 'learner', re: /intelligent|expert|tuteur|ingénieur/i },
  // The catalog's R1 says « il ne faut jamais forcer »: an instruction about the real world, which a simulator does not give.
  { name: 'real-world instruction', scope: 'everywhere', re: /jamais forcer|ne forcez/i },
]

/**
 * Device, signal and bus NAMES carry digits (U 87, SM58, RE20, AES3, N-1, QL1, the +48 V of R4's own title): they are facts of the catalog, not figures.
 * Removed before the scan (so « +48 V » as a NAME is fine, and a bare « 48 V » or « 12 dB » is still a figure).
 */
export const NAMES = /U 87|SM58|RE20|\+48 V|AES3|N-1|QL1|K12/g

export type Scope = 'everywhere' | 'learner'

/** The names of the families a string trips. `scope: 'learner'` checks every family; `'everywhere'` only the families that apply outside the learner strings. */
export function offends(s: string, scope: Scope = 'learner'): string[] {
  const bare = s.replace(NAMES, '')
  return FAMILIES.filter((f) => (scope === 'learner' || f.scope === 'everywhere') && f.re.test(bare)).map((f) => f.name)
}
