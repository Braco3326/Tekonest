import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import type { TeachingEvent } from '../../src/engine/types'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { autosaveView, rejectionOf, ruleTextFor, statusView } from '../../src/creation/shell/statusModel'

const ruleText = (id: string): { title: string; detail: string } => ({ title: `T-${id}`, detail: `detail-${id}` })
const ev = (ruleId: string, severity: 'error' | 'warning', instance = 'u87'): TeachingEvent => ({
  ruleId,
  severity,
  title: ruleId,
  teach: '',
  subjects: [{ instance, port: 'out' }],
})
const base = { selectionLabel: null, snapFree: false, events: [] as TeachingEvent[], lastRejection: null, ruleText, connections: 1 }

describe('statusView (Task 14, C17)', () => {
  it('0 errors → « Aucune erreur détectée » (neutral): no error is not a working chain (L5)', () => {
    const v = statusView(base)
    expect(v.signal).toEqual({ kind: 'neutral', label: 'Aucune erreur détectée', count: 0 })
    expect(v.errors).toEqual([])
  })
  it('« Signal OK » (ok) ONLY when playbackReady is true; playbackReady defaults to false', () => {
    expect(statusView({ ...base, playbackReady: true }).signal).toEqual({ kind: 'ok', label: 'Signal OK', count: 0 })
    expect(statusView({ ...base, playbackReady: false }).signal.label).toBe('Aucune erreur détectée')
  })
  it('a rig with 0 connections → « Rien de branché » (neutral)', () => {
    expect(statusView({ ...base, connections: 0 }).signal).toEqual({ kind: 'neutral', label: 'Rien de branché', count: 0 })
    expect(statusView({ ...base, connections: 0, playbackReady: true }).signal.label).toBe('Rien de branché')
  })
  it('errors win over playbackReady and an empty rig', () => {
    expect(statusView({ ...base, playbackReady: true, events: [ev('R4', 'error')] }).signal.kind).toBe('errors')
  })
  it('2 error events → « 2 erreurs »; 1 → « 1 erreur »', () => {
    expect(statusView({ ...base, events: [ev('R4', 'error'), ev('R8', 'error', 'hd')] }).signal).toEqual({ kind: 'errors', label: '2 erreurs', count: 2 })
    expect(statusView({ ...base, events: [ev('R4', 'error')] }).signal).toEqual({ kind: 'errors', label: '1 erreur', count: 1 })
  })
  it('warnings are listed but do not count as errors', () => {
    const v = statusView({ ...base, events: [ev('R5', 'warning')] })
    expect(v.signal).toEqual({ kind: 'neutral', label: 'Aucune erreur détectée', count: 0 })
    expect(v.errors).toHaveLength(1)
    expect(v.errors[0].title).toBe('T-R5')
    expect(v.errors[0].severity).toBe('warning')
  })
  it('the last rejection is listed first, then errors, then warnings; the rejection does not change the count', () => {
    const rej = { title: 'Refus', detail: 'pourquoi', ports: [{ instance: 'k12-g', port: 'power-in' }] }
    const v = statusView({ ...base, events: [ev('R5', 'warning'), ev('R4', 'error')], lastRejection: rej })
    expect(v.errors.map((e) => e.id)).toEqual(['rejection', expect.stringContaining('R4'), expect.stringContaining('R5')])
    expect(v.errors[0]).toMatchObject({ title: 'Refus', detail: 'pourquoi', severity: 'rejection', ports: rej.ports })
    expect(v.signal.count).toBe(1)
  })
  it('the rule text comes from ruleText (its detail), with the event ports', () => {
    const v = statusView({ ...base, events: [ev('R4', 'error')] })
    expect(v.errors[0]).toMatchObject({ title: 'T-R4', detail: 'detail-R4', ports: [{ instance: 'u87', port: 'out' }] })
  })
  it('selection and snapping lines (brief wording); no snapping text until placement snapping exists', () => {
    expect(statusView(base).selection).toBe('Aucune sélection')
    expect(statusView({ ...base, selectionLabel: 'Yamaha QL1 (ql1)' }).selection).toBe('Sélection : Yamaha QL1 (ql1)')
    expect(statusView(base).snapping).toBe('Aimantation : 0,25 m · 15°')
    expect(statusView({ ...base, snapFree: true }).snapping).toBe('Aimantation : libre')
    expect(statusView({ ...base, snapFree: undefined }).snapping).toBe('')
  })
  it('error ids are stable for the same rule on the same ports', () => {
    const a = statusView({ ...base, events: [ev('R4', 'error')] }).errors[0].id
    const b = statusView({ ...base, events: [ev('R4', 'error')] }).errors[0].id
    expect(a).toBe(b)
  })
  it('error ids are unique even when the same rule fires twice on the same ports', () => {
    const ids = statusView({ ...base, events: [ev('R4', 'error'), ev('R4', 'error')] }).errors.map((e) => e.id)
    expect(new Set(ids).size).toBe(2)
  })
})

describe('statusView: unverified devices (Task 30 fix 3)', () => {
  it('no unverified device: no phrase (default and 0)', () => {
    expect(statusView(base).extra).toBe('')
    expect(statusView({ ...base, unverified: 0 }).extra).toBe('')
  })
  it('one / several unverified devices are said next to the signal, with plural handling', () => {
    expect(statusView({ ...base, unverified: 1 }).extra).toBe('1 appareil non vérifié')
    expect(statusView({ ...base, unverified: 3 }).extra).toBe('3 appareils non vérifiés')
  })
  it('joins the other extras, and never changes the signal (still neutral, never « Signal OK »)', () => {
    const v = statusView({ ...base, unverified: 2, events: [ev('R5', 'warning')], playbackReady: false })
    expect(v.extra).toBe('1 avertissement · 2 appareils non vérifiés')
    expect(v.signal).toEqual({ kind: 'neutral', label: 'Aucune erreur détectée', count: 0 })
  })
})

describe('ruleTextFor', () => {
  it('prefers the catalog French fields', () => {
    const t = ruleTextFor([{ id: 'R9', title: 'EN', teach: 'en', title_fr: 'FR', teach_fr: 'fr' }])
    expect(t('R9')).toEqual({ title: 'FR', detail: 'fr' })
  })
  it('reads title_fr / teach_fr of every real catalog rule, never the English (exact strings in ruleTexts.test.ts)', () => {
    const t = ruleTextFor(catalogJson.rules)
    for (const r of catalogJson.rules) expect(t(r.id), r.id).toEqual({ title: r.title_fr, detail: r.teach_fr })
  })
  it('an unknown rule still has a text (its id)', () => {
    expect(ruleTextFor([])('R42').title).toContain('R42')
  })
})

describe('rejectionOf: a refused CONNECT, in French', () => {
  it('an engine rule (R3) reads as that rule', () => {
    const t = ruleTextFor(catalogJson.rules)
    const r = rejectionOf({ code: 'DIRECTION_MISMATCH', message: 'both are inputs', ruleId: 'R3' }, [{ instance: 'a', port: 'x' }], t)
    expect(r).toEqual({ title: t('R3').title, detail: t('R3').detail, ports: [{ instance: 'a', port: 'x' }] })
  })
  it('an occupied port or another refusal has its own French text', () => {
    const t = ruleTextFor(catalogJson.rules)
    const occ = rejectionOf({ code: 'PORT_OCCUPIED', message: 'x already has a cable' }, [], t)
    expect(occ.title).toBe('Prise déjà utilisée')
    const other = rejectionOf({ code: 'UNKNOWN_PORT', message: 'nope' }, [], t)
    expect(other.title).toBe('Connexion impossible')
  })
  it('the real store refuses { k12-g power-in } → { ql1 in-mic-2 } as R3', () => {
    const registry = loadCatalog(catalogJson)
    const store = new CreationStore(registry, creationEvaluator(registry))
    store.dispatch({ type: 'SPAWN', deviceId: 'qsc-k12-2', instanceId: 'k12-g' })
    store.dispatch({ type: 'SPAWN', deviceId: 'yamaha-ql1', instanceId: 'ql1' })
    const r = store.dispatch({ type: 'CONNECT', a: { instance: 'k12-g', port: 'power-in' }, b: { instance: 'ql1', port: 'in-mic-2' } })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.ruleId).toBe('R3')
  })
})

describe('autosaveView: the autosave state in the status bar', () => {
  it('« Enregistré » / « Modifié » / « En pause »', () => {
    expect(autosaveView({ place: true, pending: false, pause: null }).label).toContain('Enregistré')
    expect(autosaveView({ place: true, pending: true, pause: null }).label).toContain('Modifié')
    expect(autosaveView({ place: true, pending: true, pause: 'other-tab' }).label).toContain('En pause')
  })
  it('nothing before a place', () => {
    expect(autosaveView({ place: false, pending: false, pause: null }).label).toBe('')
  })
  it('paused until the export: a persistent line with its action', () => {
    const v = autosaveView({ place: true, pending: true, pause: 'kept' })
    expect(v.line).toContain('Sauvegarde automatique en pause : exportez')
    expect(v.action).toBe('export')
    expect(autosaveView({ place: true, pending: true, pause: 'kept-exported' }).action).toBe('checked')
    expect(autosaveView({ place: true, pending: false, pause: 'other-tab' }).action).toBe('resume')
    expect(autosaveView({ place: true, pending: false, pause: null }).line).toBe('')
  })
})
