/**
 * Pinned honesty strings (onboarding packs, T1.7; spec section 9): the sentences that say what the numbers are and are not stay byte-identical,
 * whatever the onboarding packs add around them. CHARACTERIZATION tests: they pass on today's code (the literals below were copied from COPY
 * before any onboarding change) and each carries one MUTATION that must turn it red (labelled « mutation »). Changing one of these strings is a
 * decision of its own (the founder / tekuxwriter), never a side effect: edit the literal here in the same commit and say why in the ledger.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COPY } from '../../src/creation/copy'

const deck = readFileSync(new URL('../../docs/copy/creation-mode.md', import.meta.url), 'utf8')
const sections = COPY as Record<string, Record<string, string>>

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
/** What the pin check compares: the exact UTF-16 sequence, so a plain space, a no-break space and a straight apostrophe all differ. */
const same = (actual: string, literal: string): boolean => actual === literal

describe('pinned honesty strings (characterization: green today)', () => {
  it('the table covers every `coverage.source*` key that exists (a new source label would be unpinned otherwise)', () => {
    const sources = Object.keys(COPY.coverage).filter((k) => k.startsWith('source'))
    expect(sources.sort()).toEqual(PINNED.filter(([s, k]) => s === 'coverage' && k.startsWith('source')).map(([, k]) => k).sort())
  })

  it.each(PINNED.map((p) => [label(p[0], p[1]), p] as const))('%s is byte-identical to the pinned literal and to the deck row', (_name, [section, key, literal]) => {
    const actual = sections[section][key]
    expect(actual).toBe(literal)
    expect(Buffer.from(actual, 'utf8').equals(Buffer.from(literal, 'utf8'))).toBe(true)
    const row = deck.split('\n').find((l) => l.startsWith(`| \`${section}.${key}\` |`))
    expect(row, `deck row ${section}.${key}`).toBeDefined()
    expect(row!).toContain(`| ${literal} |`)
  })

  it('the pinned chip says « estimation », and the two always-visible honesty sentences keep their negations', () => {
    expect(COPY.coverage.chip).toBe('estimation')
    expect(COPY.listen.simple).toContain('Ni acoustique de salle, ni réponse en fréquence, ni réflexions.')
    expect(COPY.listen.simple).toContain('volume normalisé')
    expect(COPY.coverage.splPending).toContain('non calculé')
    expect(COPY.coverage.splPending).toContain('formule non sourcée')
  })
})

describe('mutation: each kind of drift turns the pin check red (the pins are not vacuous)', () => {
  /** One mutation per pinned string, of the kinds a careless edit makes: the first letter, a typographic apostrophe, a plain space, a trailing space, the decimal-free unit. */
  const mutate = (s: string): string[] => [
    s.replace(/^./, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())), // the first letter's case
    s.replace(/ /, ' '), // a no-break space instead of the first plain space
    s.includes('’') ? s.replace('’', "'") : s.replace('e', 'é'), // a straight apostrophe, or an accent
    `${s} `, // a trailing space
    s.slice(0, -1), // the last character dropped
  ].filter((m) => m !== s) // a mutation that leaves the string unchanged (no space to swap) is no mutation
  it.each(PINNED.map((p) => [label(p[0], p[1]), p] as const))('%s: every mutated copy fails the comparison', (_name, [, , literal]) => {
    expect(mutate(literal).length).toBeGreaterThanOrEqual(3)
    for (const m of mutate(literal)) {
      expect(m).not.toBe(literal)
      expect(same(m, literal), JSON.stringify(m)).toBe(false)
    }
    expect(same(literal, literal)).toBe(true)
  })
  it('a pinned string edited in COPY is caught by the real comparison: the pin check, run on a copy of COPY with one change, reports exactly that key', () => {
    const drifted = (section: string, key: string, value: string): string[] =>
      PINNED.filter(([s, k, lit]) => !same(s === section && k === key ? value : sections[s][k], lit)).map(([s, k]) => label(s, k))
    expect(drifted('none', 'none', '')).toEqual([])
    expect(drifted('coverage', 'chip', 'Estimation')).toEqual(['coverage.chip'])
    expect(drifted('listen', 'playing', 'Lecture en cours : {source}.')).toEqual(['listen.playing'])
    expect(drifted('inventory', 'tipUnverified', 'Fiche vérifiée.')).toEqual(['inventory.tipUnverified'])
  })
})
