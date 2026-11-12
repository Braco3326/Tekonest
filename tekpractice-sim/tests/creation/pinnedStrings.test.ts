/**
 * Pinned honesty strings (onboarding packs, T1.7; spec section 9): the sentences that say what the numbers are and are not stay byte-identical,
 * whatever the onboarding packs add around them. CHARACTERIZATION tests: they pass on today's code (the literals below were copied from COPY
 * before any onboarding change). The mutation tests run THE pin check (`pinDrift`, one function) on a clone of COPY or of the deck with one string
 * changed and expect exactly that key to be reported, so a pin that stops comparing turns them red. Changing one of these strings is a
 * decision of its own (the founder / tekuxwriter), never a side effect: edit the literal here in the same commit and say why in the ledger.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COPY } from '../../src/creation/copy'

const deck = readFileSync(new URL('../../docs/copy/creation-mode.md', import.meta.url), 'utf8')
type Sections = Readonly<Record<string, Readonly<Record<string, string>>>>
const sections: Sections = COPY

/** [section, key, the literal]. Typographic apostrophes (’), plain spaces before « : » as the deck's typography rule says; « ≈ » is U+2248, « 3D » is plain. */
const PINNED: readonly (readonly [string, string, string])[] = [
  ['coverage', 'unit', 'dB relatif (0 = point le plus fort)'],
  ['coverage', 'method', 'somme énergétique, champ direct'],
  ['coverage', 'hatched', 'Hachuré : interférences non modélisées'],
  ['coverage', 'splPending', '≈ dB SPL estimé : non calculé (estimation pédagogique, formule non sourcée).'],
  ['coverage', 'frontCaveat', 'Face avant du modèle 3D non vérifiée pour {names} : le trait indique l’axe acoustique, pas forcément la face du modèle.'],
  ['coverage', 'sourceLine', 'Couverture : {sources}'],
  ['coverage', 'sourceKb', 'base de connaissances'],
  ['coverage', 'sourceNominal', 'valeur nominale'],
  ['coverage', 'sourceDatasheet', 'fiche constructeur'],
  ['coverage', 'sourceDeduced', 'verticale déduite'],
  ['coverage', 'chip', 'estimation'],
  ['listen', 'simple', 'Simulation simple : niveau relatif, volume normalisé, retard et placement gauche-droite d’après la géométrie. Ni acoustique de salle, ni réponse en fréquence, ni réflexions.'],
  ['listen', 'playing', 'Lecture en cours : {source} (simulation simple).'],
  // The Bêta tooltip (inventory drawer and the placed device's description): also pinned in tests/creation/betaDevices.test.ts and tests/e2e/creation-beta.spec.ts.
  ['inventory', 'tipUnverified', 'Fiche proposée, pas encore vérifiée : comportement approximatif.'],
]

const label = (s: string, k: string): string => `${s}.${k}`

/**
 * THE pin check: the labels of the pinned strings that are not byte-identical to their literal in `copy` (the exact UTF-16 sequence: a plain space, a no-break
 * space and a straight apostrophe all differ), or whose deck row does not carry the literal. It takes the COPY object and the deck text as arguments so the
 * mutation tests below run THIS function, unchanged, on a clone with one string patched: there is no second implementation of the comparison to drift from.
 */
function pinDrift(copy: Sections, deckText: string): string[] {
  const rows = deckText.split('\n')
  return PINNED.filter(([section, key, literal]) => {
    const actual = copy[section]?.[key]
    if (typeof actual !== 'string' || !Buffer.from(actual, 'utf8').equals(Buffer.from(literal, 'utf8'))) return true
    const row = rows.find((l) => l.startsWith('| `' + section + '.' + key + '` |'))
    return row === undefined || !row.includes('| ' + literal + ' |')
  }).map(([section, key]) => label(section, key))
}
/** A clone of COPY with one string replaced (COPY itself is never touched). */
const patched = (section: string, key: string, value: string): Sections => ({ ...sections, [section]: { ...sections[section], [key]: value } })

describe('pinned honesty strings (characterization: green today)', () => {
  it('the table covers every `coverage.source*` key that exists (a new source label would be unpinned otherwise)', () => {
    const sources = Object.keys(COPY.coverage).filter((k) => k.startsWith('source'))
    expect(sources.sort()).toEqual(PINNED.filter(([s, k]) => s === 'coverage' && k.startsWith('source')).map(([, k]) => k).sort())
  })

  it('every pinned string in COPY is byte-identical to its literal and to its deck row (no drift)', () => {
    expect(pinDrift(sections, deck)).toEqual([])
  })

  it('the pinned chip says « estimation », and the two always-visible honesty sentences keep their negations', () => {
    expect(COPY.coverage.chip).toBe('estimation')
    expect(COPY.listen.simple).toContain('Ni acoustique de salle, ni réponse en fréquence, ni réflexions.')
    expect(COPY.listen.simple).toContain('volume normalisé')
    expect(COPY.coverage.splPending).toContain('non calculé')
    expect(COPY.coverage.splPending).toContain('formule non sourcée')
  })
})

describe('mutation: the pin check, run on a clone of COPY (or of the deck) with ONE string changed, reports exactly that key', () => {
  /** The kinds of drift a careless edit makes: the first letter's case, a no-break space, a straight apostrophe or an accent, a trailing space, a dropped last character. */
  const mutate = (s: string): string[] =>
    [
      s.replace(/^./, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())),
      s.replace(/ /, ' '),
      s.includes('’') ? s.replace('’', "'") : s.replace('e', 'é'),
      s + ' ',
      s.slice(0, -1),
    ].filter((m) => m !== s) // a mutation that leaves the string unchanged (no space to swap) is no mutation

  it.each(PINNED.map((p) => [label(p[0], p[1]), p] as const))('%s: every mutated copy of COPY is reported, and only this key', (name, [section, key, literal]) => {
    const mutations = mutate(literal)
    expect(mutations.length).toBeGreaterThanOrEqual(3)
    for (const m of mutations) expect(pinDrift(patched(section, key, m), deck), JSON.stringify(m)).toEqual([name])
  })

  it.each(PINNED.map((p) => [label(p[0], p[1]), p] as const))('%s: a deck row that drifts from the literal is reported too', (name, [, , literal]) => {
    const drifted = deck.replace('| ' + literal + ' |', '| ' + literal.slice(0, -1) + ' |')
    expect(drifted).not.toBe(deck) // the row exists and was changed
    expect(pinDrift(sections, drifted)).toEqual([name])
  })

  it('a missing key and a missing section are reported (never silently skipped)', () => {
    const noKey: Sections = { ...sections, coverage: Object.fromEntries(Object.entries(sections.coverage).filter(([k]) => k !== 'chip')) }
    expect(pinDrift(noKey, deck)).toEqual(['coverage.chip'])
    const noSection: Sections = Object.fromEntries(Object.entries(sections).filter(([k]) => k !== 'inventory'))
    expect(pinDrift(noSection, deck)).toEqual(['inventory.tipUnverified'])
  })
})
