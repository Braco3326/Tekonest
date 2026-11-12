/**
 * T1.3a: the checklist « Pourquoi je n’entends rien ? » as a pure view over the engine's own playback reasons (src/flow/signalPath.ts).
 * Every blocked text is the engine's `COPY.playback.*` text verbatim; a row after the first blocked one is « not yet checked » (the engine
 * returns early at the first three gates), never ticked; the mic line is the engine's NO_MIC text, or the fixed line when a mic is cabled.
 * The real signal path is used (designs built with the real store), so a change of the engine's gate order fails here.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { makeRegistry } from '../helpers'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { templateToDesign } from '../../src/creation/templates'
import { Template } from '../../src/creation/templateSchema'
import { COPY } from '../../src/creation/copy'
import { signalPath, type PathResult, type ReasonCode } from '../../src/flow/signalPath'
import { checklistView, REASON_ROW, type ChecklistView, type RowId, type RowState } from '../../src/creation/checklistModel'
import type { Registry } from '../../src/engine/CatalogLoader'
import type { PortRef, TeachingEvent } from '../../src/engine/types'
import type { DesignState } from '../../src/trials/trial'

const registry = makeRegistry()
const P = COPY.playback!
const C = COPY.checklist!
const ref = (s: string): PortRef => {
  const [instance, port] = s.split(' ')
  return { instance, port }
}
const storeOf = (r: Registry, design?: DesignState): CreationStore => new CreationStore(r, creationEvaluator(r), design)
const ok = (r: { ok: boolean }, what: string): void => {
  expect(r.ok, what).toBe(true)
}
const template = (): DesignState => templateToDesign(Template.parse(JSON.parse(readFileSync('content/templates/concert-simple-reference.json', 'utf8'))))

/** The powered reference rig (template + the two signal cables), `playback-usb` on, then what `change` does. */
function rig(change: (s: CreationStore) => void = () => undefined): DesignState {
  const s = storeOf(registry, template())
  ok(s.dispatch({ type: 'CONNECT', a: ref('ql1 out-main-l'), b: ref('k12-g in-line-a') }), 'left cable')
  ok(s.dispatch({ type: 'CONNECT', a: ref('ql1 out-main-r'), b: ref('k12-d in-line-a') }), 'right cable')
  ok(s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'playback-usb', value: true }), 'playback')
  change(s)
  return s.design()
}
const unplug = (s: CreationStore, at: string): void => {
  const id = s.connectionAt(ref(at))
  expect(id, `a cable at ${at}`).toBeDefined()
  ok(s.dispatch({ type: 'DISCONNECT', connectionId: id! }), `unplug ${at}`)
}
const view = (d: DesignState, events: readonly TeachingEvent[] = [], placeOpen = true): { path: PathResult; v: ChecklistView } => {
  const path = signalPath(d, registry, events)
  return { path, v: checklistView(path, { placeOpen }) }
}
const states = (v: ChecklistView): Record<RowId, RowState> => Object.fromEntries(v.rows.map((r) => [r.id, r.state])) as Record<RowId, RowState>
const row = (v: ChecklistView, id: RowId) => v.rows.find((r) => r.id === id)!
const errAt = (instance: string, port: string): TeachingEvent => ({ ruleId: 'R5', severity: 'error', title: 't', teach: 't', subjects: [{ instance, port }] })

describe('the table: a reason code is placed in a row or the mic line', () => {
  it('has an entry for every ReasonCode (a new code fails to compile until it is placed)', () => {
    const ALL: Record<ReasonCode, true> = { NO_SOURCE: true, SOURCE_OFF: true, HOST_UNPOWERED: true, NO_PATH: true, SPEAKER_UNPOWERED: true, RULE_ERROR: true, NO_MIC: true }
    expect(Object.keys(REASON_ROW).sort()).toEqual(Object.keys(ALL).sort())
    expect(REASON_ROW).toEqual({ NO_SOURCE: 'source', SOURCE_OFF: 'console', HOST_UNPOWERED: 'power', SPEAKER_UNPOWERED: 'power', NO_PATH: 'cable', RULE_ERROR: 'cable', NO_MIC: 'mic' })
  })
})

describe('rows over the real signal path: one blocked row, the later ones not yet checked', () => {
  it('an empty project: NO_SOURCE blocks the first row, verbatim; nothing after it is ticked', () => {
    const { path, v } = view(storeOf(registry).design())
    expect(path.reasons.map((r) => r.code)).toEqual(['NO_SOURCE'])
    expect(v.visible).toBe(true)
    expect(v.rows.map((r) => r.id)).toEqual(['source', 'console', 'power', 'cable'])
    expect(states(v)).toEqual({ source: 'blocked', console: 'unchecked', power: 'unchecked', cable: 'unchecked' })
    expect(row(v, 'source').detail).toBe(P.noSource)
    expect(row(v, 'source').goTo).toEqual({ kind: 'inventory', tab: 'consoles' })
    expect(row(v, 'console').detail).toBe('')
    expect(row(v, 'console').goTo).toBeNull()
  })

  it('the template as shipped (Lecture console off): the console row is blocked, the source row passed, the rest not yet checked', () => {
    const { path, v } = view(template())
    expect(path.reasons.map((r) => r.code)).toEqual(['SOURCE_OFF'])
    expect(states(v)).toEqual({ source: 'ok', console: 'blocked', power: 'unchecked', cable: 'unchecked' })
    expect(row(v, 'console').detail).toBe(P.sourceOff)
    expect(row(v, 'console').goTo).toEqual({ kind: 'select', instance: 'ql1' })
  })

  it('the console switched off: the power row is blocked (HOST_UNPOWERED), the cable row not yet checked', () => {
    const { path, v } = view(rig((s) => ok(s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'power', value: false }), 'power off')))
    expect(path.reasons.map((r) => r.code)).toEqual(['HOST_UNPOWERED'])
    expect(states(v)).toEqual({ source: 'ok', console: 'ok', power: 'blocked', cable: 'unchecked' })
    expect(row(v, 'power').detail).toBe(P.hostUnpowered)
    expect(row(v, 'power').goTo).toEqual({ kind: 'select', instance: 'ql1' })
  })

  it('no speaker cable: the cable row is blocked (NO_PATH); the power row is NOT ticked (a speaker supply is not known yet)', () => {
    const { path, v } = view(rig((s) => (unplug(s, 'ql1 out-main-l'), unplug(s, 'ql1 out-main-r'))))
    expect(path.reasons.map((r) => r.code)).toEqual(['NO_PATH'])
    expect(states(v)).toEqual({ source: 'ok', console: 'ok', power: 'unchecked', cable: 'blocked' })
    expect(row(v, 'cable').detail).toBe(P.noPath)
    expect(row(v, 'cable').goTo).toEqual({ kind: 'select', instance: 'ql1' })
  })

  it('both speakers unpowered: the power row is blocked (SPEAKER_UNPOWERED) once, on the first speaker', () => {
    const { path, v } = view(rig((s) => (ok(s.dispatch({ type: 'SET_CONTROL', instance: 'k12-g', control: 'power', value: false }), 'g off'), ok(s.dispatch({ type: 'SET_CONTROL', instance: 'k12-d', control: 'power', value: false }), 'd off'))))
    expect(path.reasons.map((r) => r.code)).toEqual(['SPEAKER_UNPOWERED', 'SPEAKER_UNPOWERED'])
    expect(states(v)).toEqual({ source: 'ok', console: 'ok', power: 'blocked', cable: 'unchecked' })
    expect(row(v, 'power').detail).toBe(P.speakerUnpowered) // the same sentence is not repeated per speaker
    expect(row(v, 'power').goTo).toEqual({ kind: 'select', instance: 'k12-d' })
  })

  it('a rule error on the path: the cable row is blocked (RULE_ERROR) and selects the device of the blocked port', () => {
    const { path, v } = view(rig((s) => unplug(s, 'ql1 out-main-r')), [errAt('k12-g', 'in-line-a')])
    expect(path.reasons.map((r) => r.code)).toEqual(['RULE_ERROR'])
    expect(states(v)).toEqual({ source: 'ok', console: 'ok', power: 'unchecked', cable: 'blocked' })
    expect(row(v, 'cable').detail).toBe(P.ruleError)
    expect(row(v, 'cable').goTo).toEqual({ kind: 'select', instance: 'k12-g' })
  })

  it('two rows can be blocked in the same pass (a rule error and an unpowered speaker); neither is ticked', () => {
    const d = rig((s) => ok(s.dispatch({ type: 'SET_CONTROL', instance: 'k12-d', control: 'power', value: false }), 'd off'))
    const { path, v } = view(d, [errAt('k12-g', 'in-line-a')])
    expect(path.reasons.map((r) => r.code).sort()).toEqual(['RULE_ERROR', 'SPEAKER_UNPOWERED'])
    expect(states(v)).toEqual({ source: 'ok', console: 'ok', power: 'blocked', cable: 'blocked' })
  })
})

describe('never a false tick; hidden when the rig can play', () => {
  it('playbackReady (does trigger): every row is ticked, the checklist is hidden', () => {
    const { path, v } = view(rig())
    expect(path.playbackReady).toBe(true)
    expect(states(v)).toEqual({ source: 'ok', console: 'ok', power: 'ok', cable: 'ok' })
    expect(v.visible).toBe(false)
  })

  it('not ready (does not trigger): no row of any blocked scenario has every row ticked, and a row after the first blocked one is never ticked', () => {
    const scenarios: DesignState[] = [
      storeOf(registry).design(),
      template(),
      rig((s) => ok(s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'power', value: false }), 'off')),
      rig((s) => (unplug(s, 'ql1 out-main-l'), unplug(s, 'ql1 out-main-r'))),
    ]
    const ORDER: RowId[] = ['source', 'console', 'power', 'cable']
    for (const d of scenarios) {
      const { path, v } = view(d)
      expect(path.playbackReady).toBe(false)
      expect(v.visible).toBe(true)
      expect(v.rows.every((r) => r.state === 'ok')).toBe(false)
      const firstBlocked = ORDER.findIndex((id) => row(v, id).state === 'blocked')
      expect(firstBlocked).toBeGreaterThanOrEqual(0)
      for (const id of ORDER.slice(firstBlocked + 1)) expect(row(v, id).state, id).not.toBe('ok')
    }
  })

  it('a path that cannot play and carries no reason (never produced by the engine) ticks nothing', () => {
    const v = checklistView({ playbackReady: false, reasons: [], micReasons: [] }, { placeOpen: true })
    expect(v.rows.map((r) => r.state)).toEqual(['unchecked', 'unchecked', 'unchecked', 'unchecked'])
  })

  it('no place open: hidden even when the rig cannot play', () => {
    const { v } = view(storeOf(registry).design(), [], false)
    expect(v.visible).toBe(false)
  })

  it('every row has a label from COPY and a blocked row carries no text of its own (only the engine words)', () => {
    const { v } = view(template())
    expect(v.rows.map((r) => r.label)).toEqual([C.rowSource, C.rowConsole, C.rowPower, C.rowCable])
    for (const r of v.rows) if (r.state !== 'blocked') expect(r.detail, r.id).toBe('')
  })
})

describe('the mic line', () => {
  it('a mic cabled to a powered console (Micro OK): the fixed line « câblé mais pas entendu »', () => {
    const { path, v } = view(template())
    expect(path.micOk).toBe(true)
    expect(v.mic).toEqual({ cabled: true, text: C.micCabled })
  })

  it('a mic cabled to a console that is switched off: still the fixed line (the power reason is on the power row)', () => {
    const { path, v } = view(rig((s) => ok(s.dispatch({ type: 'SET_CONTROL', instance: 'ql1', control: 'power', value: false }), 'off')))
    expect(path.micReasons.map((r) => r.code)).toEqual(['HOST_UNPOWERED'])
    expect(v.mic).toEqual({ cabled: true, text: C.micCabled })
  })

  it('no mic cabled (does not trigger the fixed line): the engine NO_MIC text, verbatim', () => {
    const { path, v } = view(storeOf(registry).design())
    expect(path.micReasons.map((r) => r.code)).toEqual(['NO_MIC'])
    expect(v.mic).toEqual({ cabled: false, text: P.noMic })
    expect(v.mic.text).not.toBe(C.micCabled)
  })

  it('the fixed line is the pinned sentence', () => {
    expect(C.micCabled).toBe('Le micro est câblé mais n’est pas entendu : le signal de test entre à la console.')
  })
})
