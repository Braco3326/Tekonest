/**
 * Task 37, brief §5 (council Q5): the coverage is honest. No file of src/ or content/ (tests excluded) says « STI » (a word), « limite légale »,
 * « décret », « 102 dB » or « dB(A) réglementaire »; the copy has the four mandatory phrases. The ADR files under docs/ are outside the scope
 * (they say what is NOT modelled, which needs the words).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COPY } from '../../src/creation/copy'

const root = resolve(__dirname, '../..')
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
const isText = (f: string): boolean => /\.(ts|tsx|js|mjs|cjs|json|css|html|md|svg)$/.test(f)
const isTest = (f: string): boolean => /\.test\.ts$/.test(f) || /[\\/]tests?[\\/]/.test(relative(root, f))
const shipped = (): string[] => ['src', 'content'].flatMap((d) => walk(join(root, d))).filter((f) => isText(f) && !isTest(f))

/** Case-sensitive for the acronym (« sti » is a French syllable), case-insensitive for the phrases. */
export const FORBIDDEN: { name: string; re: RegExp }[] = [
  { name: 'STI (word)', re: /\bSTI\b/ },
  { name: 'limite légale', re: /limite\s+l[ée]gale/i },
  { name: 'décret', re: /d[ée]cret/i },
  { name: '102 dB', re: /\b102\s*dB\b/i },
  { name: 'dB(A) réglementaire', re: /dB\(A\)\s+r[ée]glementaire/i },
]

describe('honesty: forbidden claims', () => {
  it('scans the shipped files (the guard cannot pass vacuously)', () => {
    const files = shipped().map((f) => relative(root, f).replace(/\\/g, '/'))
    expect(files.length).toBeGreaterThan(100)
    for (const must of ['src/acoustics/field.ts', 'src/acoustics/worker.ts', 'src/creation/copy.ts', 'content/catalog.json', 'src/acoustics/client.ts'])
      expect(files, must).toContain(must)
    expect(files.some((f) => f.endsWith('.test.ts'))).toBe(false)
  })
  it('no shipped file under src/ or content/ contains a forbidden claim', () => {
    const hits: string[] = []
    for (const f of shipped()) {
      const text = readFileSync(f, 'utf8')
      for (const { name, re } of FORBIDDEN) if (re.test(text)) hits.push(`${relative(root, f).replace(/\\/g, '/')}: ${name}`)
    }
    expect(hits).toEqual([])
  })
  it('the guard bites: each pattern catches its phrase and nothing innocent', () => {
    const sample: [string, string][] = [
      ['STI (word)', 'pas de STI ici'],
      ['limite légale', 'la limite légale est'],
      ['limite légale', 'Limite   legale'],
      ['décret', 'selon le décret'],
      ['102 dB', 'plafond de 102 dB'],
      ['dB(A) réglementaire', 'un dB(A) réglementaire'],
    ]
    for (const [name, text] of sample) expect(FORBIDDEN.find((x) => x.name === name)!.re.test(text), `${name}: ${text}`).toBe(true)
    const innocent = 'question, mistime, bistiou, estimation pédagogique, STIMULUS, 1102 dB'
    for (const { name, re } of FORBIDDEN) expect(re.test(innocent), name).toBe(false)
  })
})

describe('honesty: the copy says what the coverage is', () => {
  const all = Object.values(COPY).flatMap((s) => Object.values(s))
  const has = (phrase: string): boolean => all.some((t) => t.includes(phrase))
  it.each(['dB relatif (0 = point le plus fort)', 'somme énergétique, champ direct', 'interférences non modélisées', 'estimation pédagogique'])('has « %s »', (phrase) => {
    expect(has(phrase), phrase).toBe(true)
  })
  it('the unit and the method are the exact brief wording, as their own keys', () => {
    expect(COPY.coverage!.unit).toBe('dB relatif (0 = point le plus fort)')
    expect(COPY.coverage!.method).toBe('somme énergétique, champ direct')
    expect(COPY.coverage!.chip).toBe('relatif')
  })
  it('never labels a coverage level as an SPL, except the guarded estimate line', () => {
    for (const [k, t] of Object.entries(COPY.coverage!)) if (/\bSPL\b/.test(t)) expect(['splPending'], `coverage.${k}`).toContain(k)
    expect(COPY.coverage!.splPending).toContain('estimation pédagogique')
  })
})
