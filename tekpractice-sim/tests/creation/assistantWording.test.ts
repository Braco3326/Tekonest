/**
 * The assistant is a product assistant, never a person (founder decision 2026-11-13), outside the guide's own code. The guide's strings are checked by
 * tests/guide/assistantOnly.test.ts (Tek Brain's); this file applies the same generic patterns to the rest of the app: the coach tips, Mode Création's
 * copy deck, every quoted string of src/ (the guide's folder excepted), and the files under content/. Nothing here names anyone.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COPY } from '../../src/creation/copy'

const ROOT = join(__dirname, '..', '..')

const norm = (s: string): string => s.toLowerCase().replace(/[’‘]/g, "'")

/** Speech of a person about themselves: the first person singular (subject, object and possessive forms) and the voice of a team. */
const FIRST_PERSON: { name: string; re: RegExp }[] = [
  { name: 'je', re: /(^|[^\p{L}])je([^\p{L}]|$)/u },
  { name: "j'", re: /(^|[^\p{L}])j'/u },
  { name: 'moi', re: /(^|[^\p{L}])moi([^\p{L}]|$)/u },
  { name: "me / m'", re: /(^|[^\p{L}])(me|m')([^\p{L}]|$)/u },
  { name: 'mon ma mes', re: /(^|[^\p{L}])(mon|ma|mes)([^\p{L}]|$)/u },
  { name: 'notre / nous', re: /(^|[^\p{L}])(nous|notre|nos)([^\p{L}]|$)/u },
]

/** A person: a role, a trade, a biography. */
const PERSON_WORDS: { name: string; re: RegExp }[] = [
  { name: 'student', re: /[ée]tudiant/u },
  { name: 'technician', re: /technicien/u },
  { name: 'dj', re: /(^|[^\p{L}])dj([^\p{L}]|$)/u },
  { name: 'creator', re: /cr[ée]ateur|cr[ée]atrice/u },
  { name: 'biography', re: /biograph|mon histoire|mon parcours|son histoire|son parcours|ma vie|sa vie|n[ée]e? en \d|\d+ ans|souvenir|anecdote|vécu/u },
  { name: 'human', re: /(^|[^\p{L}])(humain|humaine|en personne|personnellement)([^\p{L}]|$)/u },
  { name: 'mentor', re: /mentor/u },
]

/** A named speaker: advice or a statement attributed to « Oscar » as if a person said it. */
const ATTRIBUTION =
  /(conseils?|avis|mot|message|astuce|histoire|souvenir|exp[ée]rience)\s+d['e ]\s*oscar|oscar\s+(vous\s+|te\s+)?(dit|disait|pense|conseille|recommande|raconte|explique|sugg[èe]re|a\s|est\s|était|travaille|vit|aime)|selon\s+oscar|par\s+oscar|de\s+la\s+part\s+d'oscar|pour\s+oscar|relire\s+par|valider\s+par|v[ée]rifier\s+par/u

/** The placeholders of the old coach file, written to be replaced by a person's own words. */
const PLACEHOLDER = /à remplacer|a remplacer|remplacer par/u

const hits = (text: string): string[] => {
  const s = norm(text)
  return [
    ...FIRST_PERSON.filter((p) => p.re.test(s)).map((p) => `first person (${p.name})`),
    ...PERSON_WORDS.filter((p) => p.re.test(s)).map((p) => `person (${p.name})`),
    ...(ATTRIBUTION.test(s) ? ['attributed to a named speaker'] : []),
    ...(PLACEHOLDER.test(s) ? ['placeholder for a person'] : []),
  ]
}

function leaves(node: unknown, path: string[] = []): { path: string; value: string }[] {
  if (typeof node === 'string') return [{ path: path.join('.'), value: node }]
  if (node !== null && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => leaves(v, [...path, k]))
  return []
}

function walk(dir: string, keep: (p: string) => boolean): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (f === 'node_modules') return []
    return statSync(p).isDirectory() ? walk(p, keep) : keep(p) ? [p] : []
  })
}
const rel = (p: string): string => relative(ROOT, p).split('\\').join('/')

const strip = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** The quoted literals of a source file, comments removed. */
function literals(src: string): string[] {
  const out: string[] = []
  for (const m of strip(src).matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) out.push(m[1] ?? m[2] ?? m[3] ?? '')
  return out
}

const appFiles = walk(join(ROOT, 'src'), (p) => /\.ts$/.test(p) && !rel(p).startsWith('src/guide/'))

/**
 * Two names are kept as they are, each with its reason; any other first person fails.
 *  - « Je branche pour vous » is the name of the power helper's button (spec 6.5), a feature name the founder has still to rule on, not a line the assistant says.
 *  - « Pourquoi je n’entends rien ? » is the learner's own question, the title of the status list and of its button.
 */
const KEPT_NAMES = ['Pourquoi je n’entends rien ?', 'Je branche pour vous']
const withoutKeptNames = (s: string): string => KEPT_NAMES.reduce((t, n) => t.split(n).join(''), s)

describe('the app presents the assistant, never a person', () => {
  it('the coach tips: real tips, in the assistant’s voice, none written to be replaced by a person', () => {
    const file = JSON.parse(readFileSync(join(ROOT, 'content', 'coach', 'tips.json'), 'utf8')) as { note: string; tips: { id: string; text: string }[] }
    expect(file.tips.length).toBeGreaterThanOrEqual(13)
    for (const t of file.tips) expect(hits(t.text), `${t.id}: ${t.text}`).toEqual([])
    expect(norm(file.note), 'the file note').not.toMatch(/oscar|mentor|voix|premi[èe]re personne/)
    for (const t of file.tips) expect(norm(t.text), t.id).not.toContain('oscar')
  })

  it('Mode Création’s copy deck speaks about the assistant only in its label « Oscar · Assistant », and never as a person', () => {
    const rows = Object.entries(COPY).flatMap(([section, entries]) => leaves(entries).map((l) => ({ section, path: `${section}.${l.path}`, value: l.value })))
    expect(rows.length).toBeGreaterThan(300)
    // Everywhere: no job, no biography, no attribution, no placeholder, and the name only in the badge. The first person is read only in the sections
    // that speak for the product (the others carry the learner's own words, e.g. « J’ai vérifié le fichier » on a confirmation).
    const PRODUCT_VOICE = new Set(['checklist', 'assist', 'ruleOverride', 'onboarding', 'ownGear', 'tutorialUi', 'tutorial', 'tutorialCard', 'oscar', 'plainTutorial', 'accountPrompt', 'plan2d'])
    // The learner's own words, the four profile buttons and « Passer, je connais »: the learner says « je », not the product.
    const LEARNER_SPEAKS = /^onboarding\.(profile[A-Za-z]+|offerSkip)$/
    for (const { section, path, value } of rows) {
      const found = hits(withoutKeptNames(value)).filter((h) => !(LEARNER_SPEAKS.test(path) && h.startsWith('first person'))).filter((h) => PRODUCT_VOICE.has(section) || !h.startsWith('first person'))
      expect(found, `${path}: ${value}`).toEqual([])
      expect(/Oscar/.test(value.replace('Oscar · Assistant', '')), `${path} names the assistant outside its label: ${value}`).toBe(false)
    }
    expect(COPY.oscar.badge).toBe('Oscar · Assistant')
  })

  it('no quoted string of src/ (the guide’s folder aside) presents a person or attributes advice to a named speaker', () => {
    expect(appFiles.length).toBeGreaterThan(200)
    for (const f of appFiles)
      for (const lit of literals(readFileSync(f, 'utf8'))) {
        if (!/\p{L}{3}/u.test(lit)) continue
        const s = norm(lit)
        expect(ATTRIBUTION.test(s), `${rel(f)}: ${lit}`).toBe(false)
        // Capital O: the name as a word; the lower case is a selector or a key (`.oscar-guide`, `data-oscar-root`).
        expect(/\bOscar\b/.test(lit.replace('Oscar · Assistant', '').replace('Oscar, assistant IA', '')), `${rel(f)} names the assistant in a string: ${lit}`).toBe(false)
        expect(/conseils? d'/u.test(s), `${rel(f)}: a heading that gives advice a speaker: ${lit}`).toBe(false)
      }
  })

  it('no data file of content/ names the assistant as the person who reviews, decides or writes', () => {
    const files = walk(join(ROOT, 'content'), (p) => /\.(json|md)$/.test(p))
    expect(files.length).toBeGreaterThan(40)
    for (const f of files) expect(readFileSync(f, 'utf8'), rel(f)).not.toMatch(/\bOscar\b/)
  })

  it('the comments of src/ carry no internal ruling or review marker (R-A, G14b, « T3 close review »)', () => {
    // `G50` is a gain notation (src/audio), not a gate: only the gate numbers 1 to 19 followed by a colon, « fix », « review » or a closing bracket count.
    const MARKER = /\bruling\b|\bR-[A-F]\b|\bG(?:[1-9]|1\d)[a-z]?\b(?=:| fix| review|\))|\bT\d (?:close )?review\b/
    for (const f of walk(join(ROOT, 'src'), (p) => /\.(ts|css)$/.test(p) && !rel(p).startsWith('src/guide/'))) {
      const lines = readFileSync(f, 'utf8').split('\n')
      lines.forEach((line, i) => expect(MARKER.test(line), `${rel(f)}:${i + 1}: ${line.trim().slice(0, 140)}`).toBe(false))
    }
  })

  it('the checks themselves catch the wording they exist for', () => {
    for (const bad of [
      'Je vous conseille de relier le micro.',
      "J'ai oublié le fantôme la première fois aussi.",
      '[À REMPLACER PAR OSCAR — anecdote perso sur un mauvais câble.]',
      'Conseil d’Oscar : brancher le câble.',
      'Ton souvenir mic/line : comment tu as retenu la différence de 40 dB.',
      'Brouillon : formulation à valider par Oscar.',
    ])
      expect(hits(bad).length > 0 || ATTRIBUTION.test(norm(bad)), bad).toBe(true)
    for (const ok of ['Astuce : un XLR mâle s’emboîte dans un XLR femelle.', 'Connexion acceptée.', 'Brouillon : formulation à valider avant publication.'])
      expect(hits(ok), ok).toEqual([])
  })
})
