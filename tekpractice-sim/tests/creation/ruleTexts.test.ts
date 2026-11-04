import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import type { PortRef } from '../../src/engine/types'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { rejectionOf, ruleTextFor, statusView, type RuleRow } from '../../src/creation/shell/statusModel'
import { candidates } from '../../src/creation/shell/connectModel'

/**
 * Task 29 (C17, CA-15): the catalog's French rule texts, and the ONE function (`ruleTextFor`) that
 * every Mode Création surface reads them through. The strings are pinned from the catalog, not from copy.ts.
 */
const IDS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8']
const PLACEHOLDER = /À REMPLACER|A REMPLACER/i
const rules = catalogJson.rules as unknown as RuleRow[]
const fr = (id: string) => rules.find((r) => r.id === id)!
const registry = loadCatalog(catalogJson)
const ruleText = ruleTextFor(registry.catalog.rules as unknown as readonly RuleRow[])
const text = (e: unknown, s: readonly PortRef[]) => rejectionOf(e as { code: string; message: string; ruleId?: string }, s, ruleText)

const K12_POWER: PortRef = { instance: 'k12-g', port: 'power-in' }
const MIC2: PortRef = { instance: 'ql1', port: 'in-mic-2' }
const SM58_OUT: PortRef = { instance: 'sm58', port: 'out-xlr' }
const QL_L: PortRef = { instance: 'ql1', port: 'out-main-l' }

function rig() {
  const store = new CreationStore(registry, creationEvaluator(registry))
  store.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g' })
  store.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1' })
  store.dispatch({ type: 'SPAWN', deviceId: 'shure-sm58', instanceId: 'sm58' })
  return store
}

describe('the catalog French rule texts', () => {
  it('has the eight rules R1–R8', () => {
    expect(rules.map((r) => r.id)).toEqual(IDS)
  })
  it.each(IDS)('%s has a non-empty title_fr and teach_fr, no placeholder, different from the English', (id) => {
    const r = fr(id)
    expect(typeof r.title_fr).toBe('string')
    expect(typeof r.teach_fr).toBe('string')
    expect(r.title_fr!.trim().length).toBeGreaterThan(0)
    expect(r.teach_fr!.trim().length).toBeGreaterThan(0)
    expect(r.title_fr).not.toMatch(PLACEHOLDER)
    expect(r.teach_fr).not.toMatch(PLACEHOLDER)
    expect(r.title_fr).not.toBe(r.title)
    expect(r.teach_fr).not.toBe(r.teach)
  })
  it('keeps the English fields (the legacy UI reads them)', () => {
    expect(fr('R3').title).toBe('Direction mismatch')
    expect(registry.ruleById.get('R3')!.title).toBe('Direction mismatch')
    expect(registry.ruleById.get('R2')!.teach).toContain('40 dB too quiet')
  })
  it('keeps the technical terms and numbers of the English teach text', () => {
    expect(fr('R1').teach_fr).toContain('XLR')
    expect(fr('R2').teach_fr).toContain('40 dB')
    expect(fr('R2').teach_fr).toContain('12 dB')
    expect(fr('R2').teach_fr).toContain('AES3')
    expect(fr('R4').title_fr).toContain('+48 V')
    expect(fr('R4').teach_fr).toContain('alimentation fantôme +48 V')
    expect(fr('R8').teach_fr).toContain('OCX HD')
  })
})

describe('ruleTextFor reads the catalog French fields, never the English', () => {
  it.each(IDS)('%s: title and detail are exactly title_fr and teach_fr', (id) => {
    expect(ruleText(id)).toEqual({ title: fr(id).title_fr, detail: fr(id).teach_fr })
  })
  it('a rule without French fields shows its id, never the English text', () => {
    const t = ruleTextFor([{ id: 'R3', title: 'Direction mismatch', teach: 'Signal flows one way' }])('R3')
    expect(t.title).toContain('R3')
    expect(`${t.title} ${t.detail}`).not.toMatch(/Direction mismatch|Signal flows/)
  })
})

describe('the status view of an R3 rejection shows the French title and teaching text', () => {
  it('the real store refuses power-in → in-mic-2 as R3; the list row is title_fr / teach_fr', () => {
    const store = rig()
    const r = store.dispatch({ type: 'CONNECT', a: K12_POWER, b: MIC2 })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('the connection should have been refused')
    expect(r.error.ruleId).toBe('R3')
    const v = statusView({ selectionLabel: null, events: [], lastRejection: text(r.error, [K12_POWER, MIC2]), ruleText, connections: 0 })
    expect(v.errors).toHaveLength(1)
    expect(v.errors[0].severity).toBe('rejection')
    expect(v.errors[0].title).toBe(fr('R3').title_fr)
    expect(v.errors[0].detail).toBe(fr('R3').teach_fr)
    expect(v.errors[0].title).not.toBe('Direction mismatch')
  })
  it('a rule error of the evaluator (R4) is listed with its French title and teaching text', () => {
    const v = statusView({
      selectionLabel: null,
      events: [{ ruleId: 'R4', severity: 'error', title: 'Phantom power (+48 V)', teach: 'Condensers…', subjects: [{ instance: 'u87', port: 'out' }] }],
      lastRejection: null,
      ruleText,
      connections: 1,
    })
    expect(v.errors[0].title).toBe(fr('R4').title_fr)
    expect(v.errors[0].detail).toBe(fr('R4').teach_fr)
  })
})

describe('the « Connecter à… » model gives a rejected port the rule title AND its teaching text', () => {
  it('sm58 → power-in (R1) and ql1 → thru-out-a (R3): reason = title_fr, detail = teach_fr', () => {
    const store = rig()
    const c = candidates(store, registry, SM58_OUT, text)
    const power = c.rejected.find((e) => e.ref.instance === 'k12-g' && e.ref.port === 'power-in')!
    expect(power.reason).toBe(fr('R1').title_fr)
    expect(power.detail).toBe(fr('R1').teach_fr)
    const q = candidates(store, registry, QL_L, text)
    const thru = q.rejected.find((e) => e.ref.instance === 'k12-g' && e.ref.port === 'thru-out-a')!
    expect(thru.reason).toBe(fr('R3').title_fr)
    expect(thru.detail).toBe(fr('R3').teach_fr)
  })
})
