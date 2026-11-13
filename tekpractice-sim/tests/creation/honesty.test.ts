/**
 * Honesty lint (onboarding packs, T1.7; spec sections 9 and 11, item 14): the banned families on a crafted string (trigger) and on a near miss
 * (does not trigger), then the REAL scan over every visible-text surface that exists today. The list lives in honestyLists.ts (one list, shared).
 *
 * Surfaces scanned: COPY (every section), the copy deck's « Texte » column, the guide's own words (TP_STRINGS, CREATION_STRINGS, the creation
 * flow steps), the rule override texts (a COPY section, also scanned as learner text), the template names, the picker pitch and the template notes,
 * the venue and set names of the picker cards and the catalog's French rule titles (these three with the families that apply everywhere).
 * Surfaces NOT scanned (said here and in spec 9, so this file claims no more than it does): the catalog's device and port labels (brand/model names and
 * connector names, the catalog's own data), the catalog's `teach_fr` texts (reported: each one that trips has an override, see ruleOverrides.test.ts), the
 * room files' other text (descriptions, gear notes), the vendored guide table (strings.fr.ts) beyond the keys listed in KNOWN, `index.html` and the legacy
 * level page. The runtime scan of what is on screen is T7.1c.
 * Learner scope (figures, success and school, Oscar's voice): the sections checklist, assist, ruleOverride, onboarding, tutorial and the guide's words.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COPY } from '../../src/creation/copy'
import { CREATION_FLOWS, CREATION_STRINGS } from '../../src/guide/flows.creation'
import { TP_STRINGS } from '../../src/guide/strings'
import catalogJson from '../../content/catalog.json'
import { placeSummary } from '../../src/creation/placeSummary'
import { FAMILIES, NAMES, offends } from './honestyLists'

// ── helpers ────────────────────────────────────────────────────────────────────────────────────────────────────────
interface Leaf {
  path: string
  text: string
}
function leaves(node: unknown, path: string[] = []): Leaf[] {
  if (typeof node === 'string') return [{ path: path.join('.'), text: node }]
  if (node !== null && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => leaves(v, [...path, k]))
  return []
}

const LEARNER_SECTIONS = ['checklist', 'assist', 'ruleOverride', 'onboarding', 'tutorial', 'oscar'] as const
const copySections = COPY as Record<string, Record<string, string>>
/** The pinned `coverage.splPending` is the one string allowed to say « SPL » (spec 9: « SPL (outside the pinned splPending) »): it is removed before the scan, not exempted by key. */
const SPL_PENDING = COPY.coverage.splPending

const deckPath = new URL('../../docs/copy/creation-mode.md', import.meta.url)
const deckRows = readFileSync(deckPath, 'utf8')
  .split('\n')
  .filter((l) => l.startsWith('| `'))
  .map((l) => {
    const cells = l.split(' | ')
    return { key: cells[0].slice(3, cells[0].indexOf('`', 3)), text: cells[1] ?? '' }
  })

const templateFiles = readdirSync('content/templates').filter((f) => f.endsWith('.json'))
const templates = templateFiles.map((f) => JSON.parse(readFileSync(`content/templates/${f}`, 'utf8')) as { id: string; name_fr: string })

/** Every scanned string with its scope: `where` names it in a failure. */
interface Item {
  where: string
  text: string
  scope: 'everywhere' | 'learner'
}
function surfaces(): Item[] {
  const items: Item[] = []
  for (const [section, entries] of Object.entries(copySections))
    for (const [key, text] of Object.entries(entries)) {
      const learner = (LEARNER_SECTIONS as readonly string[]).includes(section)
      items.push({ where: `COPY.${section}.${key}`, text: text.replace(SPL_PENDING, ''), scope: learner ? 'learner' : 'everywhere' })
    }
  for (const r of deckRows) {
    const section = r.key.split('.')[0]
    const learner = (LEARNER_SECTIONS as readonly string[]).includes(section)
    items.push({ where: `deck ${r.key}`, text: r.text.replace(SPL_PENDING, ''), scope: learner ? 'learner' : 'everywhere' })
  }
  for (const l of leaves(TP_STRINGS)) items.push({ where: `TP_STRINGS.${l.path}`, text: l.text, scope: 'learner' })
  for (const l of leaves(CREATION_STRINGS)) items.push({ where: `CREATION_STRINGS.${l.path}`, text: l.text, scope: 'learner' })
  for (const f of CREATION_FLOWS) for (const s of f.steps) items.push({ where: `flow ${f.id}.${s.id}`, text: s.say, scope: 'learner' })
  for (const t of templates) {
    items.push({ where: `template ${t.id} name`, text: t.name_fr, scope: 'learner' })
    const note = copySections.picker[`templateNote-${t.id}`]
    if (note !== undefined) items.push({ where: `template ${t.id} note`, text: note, scope: 'learner' })
  }
  items.push({ where: 'picker.templatesPitch', text: COPY.picker!.templatesPitch!, scope: 'learner' })
  // The venue and set names of the picker cards and the French rule titles (T1 close review 6): shown to every visitor, so the families that apply everywhere are checked.
  for (const r of placeSummary().rooms) items.push({ where: `place ${r.id} name`, text: r.name_fr, scope: 'everywhere' })
  for (const st of placeSummary().sets) items.push({ where: `set ${st.envId} name`, text: st.name, scope: 'everywhere' })
  for (const r of catalogJson.rules) items.push({ where: `rule ${r.id} title_fr`, text: r.title_fr, scope: 'everywhere' })
  return items
}

// ── the lint itself: a crafted string trips each family; a near miss does not ───────────────────────────────────────
const CRAFTED: Record<string, string[]> = {
  'success and school': ['Vous allez réussir.', 'Ce modèle prépare au BTS.', 'Comme à l’examen.', 'Devant le jury.', 'Pour le TMO.', 'Épreuve E4.'],
  fidelity: ['Un son réaliste.', 'Le vrai matériel.', 'Réponse garantie.', 'Résultat certifié.', 'Valeur exacte.', 'Rendu fidèle.', 'Son identique.', 'Comme en vrai.', 'Comme sur scène.', 'Cela sonnera bien.'],
  'safety and norms': ['Risque de danger.', 'Peut endommager le matériel.', 'Il peut abîmer l’enceinte.', 'Vous allez griller la table.', 'Pour votre sécurité.', 'Selon la norme.', 'Conforme au règlement.', 'Au niveau STI.', 'Un SPL de salle.', 'Mesure RT60.'],
  judgement: ['Bravo !', 'Parfait.', 'C’est correct.', 'Réglage correcte.', 'Câblage réussi.', 'Un son bien réglé.'],
  'false certainty': ['C’est la seule solution.', 'Le seul câble possible.', 'Le son est passé par votre câblage.', 'Vous entendez le micro.'],
  durations: ['Patientez 3 min.', 'Attendez 10 s.', 'Comptez 2 sec.', 'Environ 5 minutes.', 'Cela prend trois minutes.', 'Une minute suffit.', 'Deux secondes de pause.'],
  figures: ['Réglez à 12 dB.', 'Montez à -6 dBu.', 'Activez le +48.', 'Ajoutez 2 enceintes.', 'Étape 2 sur 5.'],
  'Oscar’s voice': ['Un assistant intelligent.', 'Mon avis d’expert.', 'Votre tuteur vous guide.', 'Comme un ingénieur du son.'],
  'real-world instruction': ['Il ne faut jamais forcer un connecteur.', 'Ne forcez pas la fiche.'],
}
const NEAR_MISSES = [
  'Reliez la sortie principale de la console à l’entrée d’une enceinte.',
  'Une correction est à apporter.', // « correction » is not « correct »
  'Le vrai matériel simplifié du simulateur.', // allowed with « simplifié »
  'Un tutoriel pas à pas.', // not « tuteur »
  'Examinez le câble.', // not « examen »
  'La seconde enceinte est reliée.', // « seconde », one, not a duration
  'Plusieurs minuteries sont absentes.', // « minuteries » is not « minutes »
  'Les normales conditions du simulateur.', // « normales » is not « norme »
  'Le micro U 87 se branche sur une entrée micro.', // device names carry digits
  'Le SM58 et le RE20 sont des micros dynamiques.',
  'Une liaison AES3 relie les deux appareils.',
  'La phase N-1 du simulateur.',
  'La console QL1 et l’enceinte K12 sont posées.',
  'La fantôme +48 V est coupée sur cette voie.',
]

describe('T1.7 the banned list: every family trips on a crafted string (trigger)', () => {
  it('the families of the list are exactly those of spec 9 plus the real-world instruction', () => {
    expect(FAMILIES.map((f) => f.name)).toEqual(Object.keys(CRAFTED))
  })
  for (const f of FAMILIES)
    it(`${f.name}: each crafted string trips it`, () => {
      expect(CRAFTED[f.name].length).toBeGreaterThan(0)
      for (const s of CRAFTED[f.name]) expect(offends(s, 'learner'), s).toContain(f.name)
    })
})

describe('T1.7 the banned list: near misses pass (does not trigger)', () => {
  it.each(NEAR_MISSES)('%s', (s) => {
    expect(offends(s, 'learner')).toEqual([])
  })
  it('device and signal names are removed before the figures family: bare figures still trip', () => {
    for (const n of ['U 87', 'SM58', 'RE20', 'AES3', 'N-1', '+48 V', 'QL1', 'K12']) expect(offends(`Le ${n} est là.`, 'learner'), n).toEqual([])
    expect(offends('Le U 87 à 12 dB.', 'learner')).toEqual(['figures'])
    expect(offends('Une alimentation de 48 V.', 'learner')).toEqual(['figures'])
    expect(NAMES.source).toContain('N-1') // the G4 addition: bus names with a digit
  })
  it('the learner-only families (figures, success and school, Oscar’s voice) do not apply to the app’s own panels', () => {
    expect(offends('Secteur 230 V.', 'everywhere')).toEqual([])
    expect(offends('Secteur 230 V.', 'learner')).toEqual(['figures'])
    expect(offends('Le mode examen.', 'everywhere')).toEqual([])
    expect(offends('Le mode examen.', 'learner')).toEqual(['success and school'])
    // the everywhere families apply to every surface
    expect(offends('Risque de danger.', 'everywhere')).toEqual(['safety and norms'])
    expect(offends('Patientez 3 min.', 'everywhere')).toEqual(['durations'])
    expect(offends('Il ne faut jamais forcer.', 'everywhere')).toEqual(['real-world instruction'])
  })
})

// ── the real scan ──────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Strings that trip the list today and that this task must NOT change (validated copy, pinned copy or the catalog's own text), each with its reason.
 * The test asserts the offender list EQUALS this table: a new offender fails it, and so does a table entry that no longer offends (dead weight).
 */
const VENDORED_COURSE = 'Vendored default strings (the guide’s vendored string table, strings.fr.ts), kept verbatim: vendor files are not edited here. They state the exam gate and promise nothing. They are reached through hard() / guarded() (vendor/core/controller.ts:819 and :1089, `course.withheld`) when the mode is not « practice »; the controller is told the exam mode first and the whole mount is then torn down (src/guide/mount.ts, `tell`), so no exam page shows them (the T7 runtime scan covers what is shown).'
const KNOWN: Record<string, { families: string[]; why: string }> = {
  'CREATION_STRINGS.course.lockedExam': { families: ['success and school'], why: VENDORED_COURSE },
  'CREATION_STRINGS.course.lockedExamOther': { families: ['success and school'], why: VENDORED_COURSE },
  'CREATION_STRINGS.course.nextExam': { families: ['success and school'], why: VENDORED_COURSE },
  'CREATION_STRINGS.course.withheld': { families: ['success and school'], why: VENDORED_COURSE },
  // Our own sentence, the brain's answer when the mode is not « practice »: Oscar never speaks in an exam (the mount is torn down in exam mode, src/guide/mount.ts `tell`),
  // so this is a defence in depth that no learner sees. Spec section 9 carries the exception (« examen » banned except this one withheld sentence).
  'TP_STRINGS.ask.examQuiet': { families: ['success and school'], why: 'The withheld answer of the brain; never spoken in an exam (the guide is torn down in exam mode, mount.ts), and it states a fact, it promises nothing.' },
}

describe('T1.7 the real scan over every visible-text surface', () => {
  const items = surfaces()
  it('the surfaces are not empty (the scan is not vacuous)', () => {
    const kinds = new Set(items.map((i) => i.where.split(/[. ]/)[0]))
    expect([...kinds].sort()).toEqual(['COPY', 'CREATION_STRINGS', 'TP_STRINGS', 'deck', 'flow', 'picker', 'place', 'rule', 'set', 'template'])
    expect(items.filter((i) => i.where.startsWith('place ')).length).toBeGreaterThan(30) // the 32 venues
    expect(items.filter((i) => i.where.startsWith('rule ')).length).toBe(8)
    expect(items.filter((i) => i.where.startsWith('COPY.')).length).toBeGreaterThan(600)
    expect(items.filter((i) => i.where.startsWith('deck ')).length).toBeGreaterThan(600)
    expect(items.filter((i) => i.where.startsWith('template ')).length).toBe(templates.length * 2) // a name and a note each
    expect(items.some((i) => i.where === 'COPY.ruleOverride.R1' && i.scope === 'learner')).toBe(true)
    expect(items.some((i) => i.where === 'COPY.coverage.unit' && i.scope === 'everywhere')).toBe(true)
  })
  it('the deck’s « Texte » column and COPY carry the same strings (a deck-only or COPY-only string would be scanned once)', () => {
    const deck = new Map(deckRows.map((r) => [r.key, r.text]))
    for (const [section, entries] of Object.entries(copySections)) for (const [key, text] of Object.entries(entries)) expect(deck.get(`${section}.${key}`), `${section}.${key}`).toBe(text)
  })
  it('every surface string passes its scope’s families, except the known list (offender list = known list)', () => {
    const found: Record<string, string[]> = {}
    for (const it_ of items) {
      const fams = offends(it_.text, it_.scope)
      if (fams.length) found[it_.where] = fams
    }
    const known = Object.fromEntries(Object.entries(KNOWN).map(([k, v]) => [k, v.families]))
    expect(found).toEqual(known)
  })
  it('« SPL » is allowed only in the pinned splPending: stripped, nothing else says it', () => {
    expect(COPY.coverage.splPending).toMatch(/SPL/)
    expect(offends(COPY.coverage.splPending, 'everywhere')).toContain('safety and norms') // unstripped, the list does trip on it
    const others = items.filter((i) => /\bSPL\b/.test(i.text))
    expect(others.map((i) => i.where)).toEqual([])
  })
})
