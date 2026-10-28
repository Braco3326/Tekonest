import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import catalogJson from '../../content/catalog.json'
import { loadCatalog } from '../../src/engine/CatalogLoader'
import type { TeachingEvent } from '../../src/engine/types'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { templateToDesign } from '../../src/creation/templates'
import { Template } from '../../src/creation/templateSchema'
import { signalPath } from '../../src/flow/signalPath'
import { autosaveView, rejectionOf, ruleTextFor, statusView } from '../../src/creation/shell/statusModel'

const ruleText = (id: string): { title: string; detail: string } => ({ title: `T-${id}`, detail: `detail-${id}` })
const ev = (ruleId: string, severity: 'error' | 'warning', instance = 'u87'): TeachingEvent => ({
  ruleId,
  severity,
  title: ruleId,
  teach: '',
  subjects: [{ instance, port: 'out' }],
})
const READY = { playbackReady: true, reasons: [], micOk: false }
const NOT_READY = { playbackReady: false, reasons: [], micOk: false }
const base = { selectionLabel: null, snapFree: false, events: [] as TeachingEvent[], lastRejection: null, ruleText, connections: 1 }

describe('statusView (Task 14, C17)', () => {
  it('0 errors → « Aucune erreur détectée » (neutral): no error is not a working chain (L5)', () => {
    const v = statusView(base)
    expect(v.signal).toEqual({ kind: 'neutral', label: 'Aucune erreur détectée', count: 0 })
    expect(v.errors).toEqual([])
  })
  it('« Signal OK » (ok) ONLY when playbackReady is true; playbackReady defaults to false', () => {
    expect(statusView({ ...base, path: READY }).signal).toEqual({ kind: 'ok', label: 'Signal OK', count: 0 })
    expect(statusView({ ...base, path: NOT_READY }).signal.label).toBe('Aucune erreur détectée')
  })
  it('a rig with 0 connections → « Rien de branché » (neutral)', () => {
    expect(statusView({ ...base, connections: 0 }).signal).toEqual({ kind: 'neutral', label: 'Rien de branché', count: 0 })
    expect(statusView({ ...base, connections: 0, path: READY }).signal.label).toBe('Rien de branché')
  })
  it('errors win over playbackReady and an empty rig', () => {
    expect(statusView({ ...base, path: READY, events: [ev('R4', 'error')] }).signal.kind).toBe('errors')
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
    const v = statusView({ ...base, unverified: 2, events: [ev('R5', 'warning')], path: NOT_READY })
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

describe('statusView: the signal path (Task 34, C9, L5)', () => {
  const reason = (text_fr: string) => ({ code: 'NO_PATH' as const, text_fr, subjects: [] })
  it('ready → « Lecture possible » and no reason', () => {
    expect(statusView({ ...base, path: { playbackReady: true, reasons: [reason('ignorée')], micOk: false } }).playback).toEqual({ ready: true, text: 'Lecture possible' })
  })
  it('not ready → the FIRST reason text, ready false', () => {
    const v = statusView({ ...base, path: { playbackReady: false, reasons: [reason('Première.'), reason('Seconde.')], micOk: false } })
    expect(v.playback).toEqual({ ready: false, text: 'Première.' })
  })
  it('no path given (before the first change) → an empty, not-ready line; never « Lecture possible »', () => {
    expect(statusView(base).playback).toEqual({ ready: false, text: '' })
  })
  it('« Micro OK » only when micOk, apart from the playback line', () => {
    expect(statusView({ ...base, path: { playbackReady: false, reasons: [], micOk: true } }).mic).toBe('Micro OK')
    expect(statusView({ ...base, path: { playbackReady: true, reasons: [], micOk: false } }).mic).toBe('')
    expect(statusView(base).mic).toBe('')
  })
  it('« Signal OK » still needs a cable and no error; the playback line says its own thing', () => {
    const v = statusView({ ...base, path: READY, events: [ev('R4', 'error')] })
    expect(v.signal.kind).toBe('errors')
    expect(v.playback.ready).toBe(true)
  })
  it('the « N appareils non vérifiés » mark is kept next to the signal with a path given', () => {
    expect(statusView({ ...base, path: READY, unverified: 2 }).extra).toBe('2 appareils non vérifiés')
  })
  it('follows the live design: a store change flips the line (no stale value) and mute never does', () => {
    const r = loadCatalog(catalogJson)
    const tpl = Template.parse(JSON.parse(readFileSync('content/templates/concert-simple-reference.json', 'utf8')))
    const s = new CreationStore(r, creationEvaluator(r), templateToDesign(tpl))
    const line = () => statusView({ ...base, path: signalPath(s.design(), r, s.events()) })
    expect(line().playback).toEqual({ ready: false, text: 'La lecture console est coupée.' })
    s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true })
    expect(line().playback).toEqual({ ready: false, text: 'Aucun chemin de la console jusqu’à une enceinte.' })
    s.dispatch({ type: 'CONNECT', a: { instance: 'ql1', port: 'out-main-l' }, b: { instance: 'k12-g', port: 'in-line-a' } })
    expect(line()).toMatchObject({ playback: { ready: true, text: 'Lecture possible' }, mic: 'Micro OK', signal: { kind: 'ok', label: 'Signal OK' } })
    s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'mute-master', value: true })
    expect(line().playback).toEqual({ ready: true, text: 'Lecture possible' })
    s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'power', value: false })
    expect(line()).toMatchObject({ playback: { ready: false, text: 'La console n’est pas alimentée.' }, mic: '' })
    expect(line().signal.kind).toBe('neutral')
  })
})
