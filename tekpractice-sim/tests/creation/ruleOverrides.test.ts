import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { COPY } from '../../src/creation/copy'
import { creationRuleRows, ruleText, RULE_OVERRIDE_IDS } from '../../src/creation/ruleTexts'
import { ruleTextFor, type RuleRow } from '../../src/creation/shell/statusModel'
import { rulesRevOf } from '../../src/trials/fingerprint'
import { makeRegistry } from '../helpers'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { signalPath } from '../../src/flow/signalPath'
import { FAMILIES, offends as offendsShared } from './honestyLists'

/**
 * T1.5a (onboarding packs, spec section 6.5 and Appendix A). Mode Creation shows reworded simulator-rule texts through ONE host-side accessor; the
 * catalog is never edited, so the legacy Essais fingerprint is unchanged and the legacy route keeps the old texts.
 */
const rules = catalogJson.rules as unknown as readonly RuleRow[]
const cat = (id: string) => rules.find((r) => r.id === id)!
const O = () => COPY.ruleOverride as Record<string, string>

/** `rulesRevOf(catalog.rules)` recorded BEFORE this task (pre-flight of 2026-11-12). It must never change: a new value invalidates every frozen Essai. */
const PRE_FLIGHT_RULES_REV = 'r1:31976636175ae95deac28925c5e7e1b8f7dd309fc65bf093f596ca335480c619'
/**
 * git blob of tekpractice-sim/content/catalog.json (git hash-object): the file is byte-identical to the live equipment build 2de5ef4 (113 devices). The blob was
 * fc78a13 before the merge with that build (2026-11-14); `rulesRevOf(catalog.rules)` above did NOT change (the equipment build added devices, not rules).
 */
const PRE_FLIGHT_CATALOG_BLOB = 'c42de64d3c666f47936c896eba13ec67ffaa6f6a'

// The banned families (spec 9) and the stripping of device and signal names that carry digits (U 87, SM58, RE20, AES3, N-1, +48 V): ONE list, shared (T1.7), in ./honestyLists.
// `real-world instruction` (the catalog's R1 says « il ne faut jamais forcer ») is one of its families.
const BANNED = FAMILIES
const offends = (s: string): string[] => offendsShared(s, 'learner')

/** The Appendix A texts, written out once here (the spec is the source; COPY and the deck must match them byte for byte). */
const APPENDIX_A: Record<string, string> = {
  R1: 'Dans le simulateur, un XLR mâle se branche sur un XLR femelle et une fiche TT sur un jack TT. Deux connecteurs qui ne vont pas ensemble sont refusés : choisissez une autre prise ou un autre câble.',
  R2: 'Dans le simulateur, les deux prises doivent porter le même type de signal : niveau micro, niveau ligne pro, niveau ligne grand public, numérique AES3… Un type différent est refusé : un micro va sur une entrée micro, une sortie ligne sur une entrée ligne.',
  R3: 'Dans le simulateur, un câble va d’une sortie vers une entrée. Deux sorties reliées entre elles, ou deux entrées, sont refusées. Les ports bidirectionnels (réseau, patchbay…) acceptent les deux sens.',
  R4: 'Dans le simulateur, un micro à condensateur (U 87) branché sur une entrée sans alimentation fantôme +48 V est signalé en erreur et n’obtient pas « Micro OK » ; un micro dynamique (SM58, RE20) n’est pas concerné.',
  R5: 'Dans le simulateur, quand la voie micro d’une console est ouverte (même sans micro branché), sa sortie tally doit être reliée à un voyant ON-AIR ; sinon un avertissement s’affiche.',
}

describe('creationRuleRows / ruleText: the override applies to R1 to R5 (triggers)', () => {
  it.each(['R1', 'R2', 'R3', 'R4', 'R5'])('%s: teach_fr is the Appendix A text; the title and the English fields are the catalog\'s', (id) => {
    const row = creationRuleRows(rules).find((r) => r.id === id)!
    expect(row.teach_fr).toBe(APPENDIX_A[id])
    expect(row.teach_fr).not.toBe(cat(id).teach_fr)
    expect(row.title_fr).toBe(cat(id).title_fr)
    expect(row.title).toBe(cat(id).title)
    expect(row.teach).toBe(cat(id).teach)
    expect(ruleText(id, rules)).toEqual({ title: cat(id).title_fr, detail: APPENDIX_A[id] })
  })
  it('COPY.ruleOverride holds exactly the Appendix A texts, one key per overridden rule', () => {
    expect(O()).toEqual(APPENDIX_A)
    expect([...RULE_OVERRIDE_IDS]).toEqual(['R1', 'R2', 'R3', 'R4', 'R5'])
  })
  it('the deck has a row per override with the same text', () => {
    const deck = readFileSync(fileURLToPath(new URL('../../docs/copy/creation-mode.md', import.meta.url)), 'utf8')
    for (const [id, text] of Object.entries(APPENDIX_A)) {
      const row = deck.split('\n').find((l) => l.startsWith(`| \`ruleOverride.${id}\` |`))
      expect(row, id).toBeDefined()
      expect(row!, id).toContain(`| ${text} |`)
      expect(row!, id).toContain('à valider (tekuxwriter)')
    }
  })
})

describe('creationRuleRows / ruleText: no override (does not trigger)', () => {
  it.each(['R6', 'R7', 'R8'])('%s returns the catalog text, row for row', (id) => {
    expect(creationRuleRows(rules).find((r) => r.id === id)).toEqual(cat(id))
    expect(ruleText(id, rules)).toEqual({ title: cat(id).title_fr, detail: cat(id).teach_fr })
  })
  it('an unknown id falls back exactly as ruleTextFor does (the id in the title, no detail)', () => {
    expect(ruleText('R42', rules)).toEqual(ruleTextFor(rules)('R42'))
    expect(ruleText('R42', rules).title).toContain('R42')
    expect(ruleText('R42', rules).detail).toBe('')
    expect(ruleText('R1', [])).toEqual(ruleTextFor([])('R1'))
  })
  it('a row without a French title is left alone (it still degrades to its id, never to the English text)', () => {
    const bare = [{ id: 'R3', title: 'Direction mismatch', teach: 'Signal flows one way' }]
    const t = ruleText('R3', bare)
    expect(t.title).toContain('R3')
    expect(`${t.title} ${t.detail}`).not.toMatch(/Direction mismatch|Signal flows/)
    expect(creationRuleRows(bare)).toEqual(bare)
  })
  it('does not mutate the rows it is given, and returns a new list', () => {
    const before = JSON.stringify(rules)
    const out = creationRuleRows(rules)
    expect(JSON.stringify(rules)).toBe(before)
    expect(out).not.toBe(rules)
    expect(out).toHaveLength(rules.length)
    expect(out.map((r) => r.id)).toEqual(rules.map((r) => r.id))
  })
})

describe('the legacy fingerprint and the catalog are untouched', () => {
  it('catalog.json is byte-identical (git blob) and rulesRevOf(catalog.rules) equals the pre-flight value', async () => {
    const file = readFileSync(fileURLToPath(new URL('../../content/catalog.json', import.meta.url)))
    const { createHash } = await import('node:crypto')
    const blob = createHash('sha1').update(`blob ${file.length}\0`).update(file).digest('hex')
    expect(blob).toBe(PRE_FLIGHT_CATALOG_BLOB)
    expect(await rulesRevOf(catalogJson.rules)).toBe(PRE_FLIGHT_RULES_REV)
  })
  it('creationRuleRows leaves the hash of the rows it was given unchanged (it copies, it never writes into the catalog)', async () => {
    creationRuleRows(rules)
    expect(await rulesRevOf(catalogJson.rules)).toBe(PRE_FLIGHT_RULES_REV)
  })
  it('the override is real: the rows it returns hash differently (so only a caller that passed them to the Essais would notice)', async () => {
    expect(await rulesRevOf(creationRuleRows(rules))).not.toBe(PRE_FLIGHT_RULES_REV)
  })
})

describe('honesty of the texts', () => {
  const offenders = rules.filter((r) => offends(r.teach_fr ?? '').length > 0).map((r) => r.id)
  it('every catalog teach_fr that trips the banned list has an override, and every override replaces one that trips (offender list = override keys)', () => {
    expect(offenders).toEqual(Object.keys(O()))
    expect(offenders).toEqual([...RULE_OVERRIDE_IDS])
  })
  it('the scan is not vacuous: R1 (real-world instruction), R3 (damage), R5 (safety) trip it; R6 to R8 do not', () => {
    expect(offends(cat('R1').teach_fr!)).toEqual(['real-world instruction'])
    expect(offends(cat('R3').teach_fr!)).toContain('safety and norms')
    expect(offends(cat('R5').teach_fr!)).toContain('safety and norms')
    for (const id of ['R6', 'R7', 'R8']) expect(offends(cat(id).teach_fr!), id).toEqual([])
  })
  it.each(['R1', 'R2', 'R3', 'R4', 'R5'])('%s override: framed as the simulator, « vous » form, no banned phrase (device and signal names are not figures)', (id) => {
    const t = O()[id]!
    expect(t.startsWith('Dans le simulateur, ')).toBe(true)
    const factsRemoved = t.replace(/U 87|SM58|RE20|\+48 V|AES3/g, '')
    for (const b of BANNED) {
      if (b.name === 'figures') expect(factsRemoved, `${id} / figures`).not.toMatch(b.re)
      else expect(t, `${id} / ${b.name}`).not.toMatch(b.re)
    }
    expect(t).not.toMatch(/peuvent endommager le matériel|il ne faut jamais forcer|contrat de sécurité|STI|SPL|réaliste/i)
  })
})

// ── what the texts claim, checked against the engine (T1 close review 2 and 3) ────────────────────────────────────────────────────────────────────
describe('R4 and R5 override texts are true of the engine', () => {
  const registry = makeRegistry()
  const fresh = () => new CreationStore(registry, creationEvaluator(registry))

  it('R5 fires with NO mic plugged: the Axia iQ ships with its mic fader open, so a console alone raises the warning (the text says « même sans micro branché »)', () => {
    const store = fresh()
    store.dispatch({ type: 'SPAWN', deviceId: 'axia-iq', instanceId: 'iq' })
    expect(store.design().rig.connections).toHaveLength(0)
    const r5 = store.events().filter((e) => e.ruleId === 'R5')
    expect(r5.length).toBeGreaterThan(0)
    expect(r5[0]!.severity).toBe('warning') // a warning, as the text says (« un avertissement »)
    expect(O().R5).toContain('même sans micro branché')
    expect(O().R5).toContain('un avertissement')
  })

  it('R4: a condenser mic on a preamp input with +48 V off is an ERROR event and gets no « Micro OK »; with +48 V on it is clean and gets Micro OK; a dynamic mic is not concerned (the text claims nothing about hearing or muting)', () => {
    const rig = (micDevice: string) => {
      const store = fresh()
      store.dispatch({ type: 'SPAWN', deviceId: micDevice, instanceId: 'mic' })
      store.dispatch({ type: 'SPAWN', deviceId: 'focusrite-isa-one', instanceId: 'isa' })
      store.dispatch({ type: 'SPAWN', deviceId: 'multiprise-secteur', instanceId: 'mains' })
      store.dispatch({ type: 'CONNECT', a: { instance: 'mains', port: 'out-1' }, b: { instance: 'isa', port: 'power-in' } })
      store.dispatch({ type: 'CONNECT', a: { instance: 'mic', port: 'out-xlr' }, b: { instance: 'isa', port: 'in-mic' } })
      return store
    }
    const read = (store: CreationStore) => ({ events: store.events().filter((e) => e.ruleId === 'R4'), path: signalPath(store.design(), registry, store.events()) })
    const condenser = rig('neumann-u87-ai')
    const off = read(condenser)
    expect(off.events.length).toBeGreaterThan(0)
    expect(off.events[0]!.severity).toBe('error')
    expect(off.path.micOk).toBe(false)
    expect(off.path.micReasons.map((r) => r.code)).toEqual(['RULE_ERROR'])
    condenser.dispatch({ type: 'SET_CONTROL', instance: 'isa', control: 'phantom-48v', value: true })
    const on = read(condenser)
    expect(on.events).toHaveLength(0)
    expect(on.path.micOk).toBe(true)
    const dynamic = read(rig('shure-sm58'))
    expect(dynamic.events).toHaveLength(0) // a dynamic mic is not concerned
    expect(dynamic.path.micOk).toBe(true)
    expect(O().R4).toContain('est signalé en erreur')
    expect(O().R4).toContain('« Micro OK »')
    expect(O().R4).not.toMatch(/muet|entend|fonctionne/) // no claim about what is heard or muted
  })
})
