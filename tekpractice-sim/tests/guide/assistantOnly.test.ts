// The assistant is a product assistant, never a person. The guide's own words carry no first person singular speech, no biography, no job or role
// attributed to it, and no attribution of advice to a named person. The only place its name may stand is its label « Oscar, assistant IA ».
// Generic patterns only: nothing here names anyone.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CREATION_FLOWS, CREATION_STRINGS } from '../../src/guide/flows.creation'
import { LEGACY_FLOWS, LEGACY_STRINGS } from '../../src/guide/flows.legacy'
import { TP_STRINGS } from '../../src/guide/strings'
import { strings as vendoredStrings } from '../../src/guide/vendor/content/strings.fr'

const ROOT = join(__dirname, '..', '..')

function leaves(node: unknown, path: string[] = []): { path: string; value: string }[] {
  if (typeof node === 'string') return [{ path: path.join('.'), value: node }]
  if (node !== null && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => leaves(v, [...path, k]))
  return []
}

/** Lower case, curly apostrophes straight, accents kept (the patterns below say them). */
const norm = (s: string): string => s.toLowerCase().replace(/[’‘]/g, "'")

/** Speech of a person about themselves: the first person singular (subject, object and possessive forms). */
const FIRST_PERSON: { name: string; re: RegExp }[] = [
  { name: 'je', re: /(^|[^\p{L}])je([^\p{L}]|$)/u },
  { name: "j'", re: /(^|[^\p{L}])j'/u },
  { name: 'moi', re: /(^|[^\p{L}])moi([^\p{L}]|$)/u },
  { name: 'me / m\'', re: /(^|[^\p{L}])(me|m')([^\p{L}]|$)/u },
  { name: 'mon ma mes', re: /(^|[^\p{L}])(mon|ma|mes)([^\p{L}]|$)/u },
  { name: 'notre / nous (a voice of a team)', re: /(^|[^\p{L}])(nous|notre|nos)([^\p{L}]|$)/u },
]

/** A person: a role, a trade, a biography. None of these says anything about a product assistant. */
const PERSON_WORDS: { name: string; re: RegExp }[] = [
  { name: 'student', re: /[ée]tudiant/u },
  { name: 'technician', re: /technicien/u },
  { name: 'dj', re: /(^|[^\p{L}])dj([^\p{L}]|$)/u },
  { name: 'creator', re: /cr[ée]ateur|cr[ée]atrice/u },
  { name: 'biography', re: /biograph|mon histoire|mon parcours|son histoire|son parcours|ma vie|sa vie|n[ée]e? en \d|\d+ ans/u },
  { name: 'human', re: /(^|[^\p{L}])(humain|humaine|en personne|personnellement)([^\p{L}]|$)/u },
]

/** A named speaker: advice or a statement attributed to « Oscar » as if a person said it. */
const ATTRIBUTION = /(conseils?|avis|mot|message|astuce|histoire|souvenir|exp[ée]rience)\s+d['e ]\s*oscar|oscar\s+(vous\s+|te\s+)?(dit|disait|pense|conseille|recommande|raconte|explique|sugg[èe]re|a\s|est\s|était|travaille|vit|aime)|selon\s+oscar|par\s+oscar|de\s+la\s+part\s+d'oscar/u

/** « Oscar » may stand only inside the assistant's label. */
const OSCAR_OUTSIDE_LABEL = (s: string): boolean => /oscar/.test(s.replace(/oscar, assistant ia/g, ''))

/**
 * The one first-person sentence kept: the pinned refusal the assistant gives about itself (« no information on this point yet »), specified word for word.
 * It is the assistant describing its own knowledge, not a person speaking; it stays the single allowed exception and is pinned so a second one fails.
 */
const ALLOWED_FIRST_PERSON = new Set(["Je n'ai pas encore d'information sur ce point."])

const hostTables = (): { path: string; value: string }[] => [
  ...leaves(TP_STRINGS).map((l) => ({ ...l, path: `TP_STRINGS.${l.path}` })),
  ...[...CREATION_FLOWS, ...LEGACY_FLOWS].flatMap((f) => f.steps.map((s) => ({ path: `flow ${f.id}.${s.id}`, value: s.say ?? '' }))),
]

/** Everything the controller can show on either route: the host tables and the vendored defaults they spread. */
const shownTables = (): { path: string; value: string }[] => [
  ...hostTables(),
  ...leaves(CREATION_STRINGS).map((l) => ({ ...l, path: `CREATION_STRINGS.${l.path}` })),
  ...leaves(LEGACY_STRINGS).map((l) => ({ ...l, path: `LEGACY_STRINGS.${l.path}` })),
  ...leaves(vendoredStrings).map((l) => ({ ...l, path: `vendored.${l.path}` })),
]

/** The quoted literals of a source file, comments removed. */
function literals(file: string): string[] {
  const src = readFileSync(join(ROOT, 'src', 'guide', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const out: string[] = []
  for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) out.push(m[1] ?? m[2] ?? m[3] ?? '')
  return out.filter((s) => /\p{L}{3}/u.test(s))
}
const HOST_FILES = ['strings.ts', 'flows.creation.ts', 'flows.legacy.ts', 'verdict.ts', 'brain.ts', 'mount.ts', 'index.ts', 'mode.ts']

describe('the guide presents the assistant, never a person', () => {
  it('scans a real set of strings', () => {
    expect(hostTables().length).toBeGreaterThan(30)
    expect(shownTables().length).toBeGreaterThan(80)
    for (const f of HOST_FILES) expect(literals(f).length, f).toBeGreaterThan(0)
    expect(hostTables().every((l) => l.value !== ''), 'every flow step says something').toBe(true)
  })

  it('no sentence of the host tables speaks in the first person singular, except the one pinned sentence about its own knowledge', () => {
    for (const { path, value } of hostTables()) {
      if (ALLOWED_FIRST_PERSON.has(value)) continue
      const s = norm(value)
      for (const { name, re } of FIRST_PERSON) expect(re.test(s), `${path} speaks as a person (${name}): ${value}`).toBe(false)
    }
    // the exception is real and unique
    expect(hostTables().filter((l) => ALLOWED_FIRST_PERSON.has(l.value)).map((l) => l.path)).toEqual(['TP_STRINGS.ask.noInformation'])
  })

  it('nothing the controller can show names a job, a trade or a biography', () => {
    for (const { path, value } of shownTables()) {
      const s = norm(value)
      for (const { name, re } of PERSON_WORDS) expect(re.test(s), `${path} presents a person (${name}): ${value}`).toBe(false)
    }
  })

  it('no string literal of the guide’s own files presents a person either', () => {
    for (const f of HOST_FILES)
      for (const lit of literals(f)) {
        const s = norm(lit)
        for (const { name, re } of PERSON_WORDS) expect(re.test(s), `${f}: ${name}: ${lit}`).toBe(false)
        expect(ATTRIBUTION.test(s), `${f}: an attribution to a named speaker: ${lit}`).toBe(false)
      }
  })

  it('advice is never attributed to a named speaker, and the name stands only in the label « Oscar, assistant IA »', () => {
    for (const { path, value } of shownTables()) {
      const s = norm(value)
      expect(ATTRIBUTION.test(s), `${path} attributes words to a named speaker: ${value}`).toBe(false)
      expect(OSCAR_OUTSIDE_LABEL(s), `${path} names the assistant outside its label: ${value}`).toBe(false)
    }
    expect(vendoredStrings.widget.title).toBe('Oscar, assistant IA')
    expect(vendoredStrings.widget.iconName).toBe('Oscar, assistant IA')
  })

  it('the checks themselves catch the wording they exist for', () => {
    const bad = [
      'Je vous conseille de relier le micro.',
      "J'ai oublié le fantôme la première fois aussi.",
      'Oscar, étudiant en son, vous dit de vérifier.',
      'Conseil d’Oscar : brancher le câble.',
      'Technicien polyvalent et DJ.',
      'Mon parcours a commencé en 2010.',
    ]
    for (const t of bad) {
      const s = norm(t)
      const hit = FIRST_PERSON.some((p) => p.re.test(s)) || PERSON_WORDS.some((p) => p.re.test(s)) || ATTRIBUTION.test(s) || OSCAR_OUTSIDE_LABEL(s)
      expect(hit, t).toBe(true)
    }
    for (const ok of ['Lire la barre d’état en bas de l’écran.', 'Oscar, assistant IA', 'Poser une question à l’assistant', 'Cette aide n’est pas disponible pendant un examen.']) {
      const s = norm(ok)
      const hit = FIRST_PERSON.some((p) => p.re.test(s)) || PERSON_WORDS.some((p) => p.re.test(s)) || ATTRIBUTION.test(s) || OSCAR_OUTSIDE_LABEL(s)
      expect(hit, ok).toBe(false)
    }
  })
})
