// The guide's verdict, built only from the app's own data: engine events, the catalog's rule texts and the signal path's first reason.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stateHash } from '../../src/guide/bridge/creationBridge'
import type { TpState } from '../../src/guide/bridge/types'
import { TP_STRINGS } from '../../src/guide/strings'
import { buildVerdict, digestOf } from '../../src/guide/verdict'
import { shapeBrainVerdict } from '../../src/guide/vendor/core/shape'
import { ruleTextFor, type RuleRow } from '../../src/creation/shell/statusModel'

const catalog = JSON.parse(readFileSync(resolve(process.cwd(), 'content/catalog.json'), 'utf8')) as { rules: RuleRow[] }
const ruleText = ruleTextFor(catalog.rules)

function state(over: Partial<TpState> = {}): TpState {
  return {
    route: 'creation',
    placeKnown: true,
    instances: [
      { id: 'mic-1', deviceId: 'dev-mic', label: 'Micro' },
      { id: 'console-1', deviceId: 'dev-console', label: 'Console' },
    ],
    connections: [],
    controls: {},
    events: [],
    playbackReady: false,
    firstReason: null,
    ...over,
  }
}

const P1 = { instance: 'mic-1', port: 'out' }
const P2 = { instance: 'console-1', port: 'in-1' }
const P3 = { instance: 'console-1', port: 'in-2' }

describe('buildVerdict: nothing to judge yet', () => {
  it('no state or no devices gives indetermine with the bench-empty sentence', () => {
    const v = buildVerdict(state({ instances: [], connections: [] }), ruleText)
    expect(v.result).toBe('indetermine')
    expect(v.labelFr).toBe(TP_STRINGS.verdict.benchEmpty)
    expect(v.primary).toBeNull()
    expect(v.alsoFound).toEqual([])
  })

  it('no place yet gives indetermine with the place-first sentence', () => {
    const v = buildVerdict(state({ placeKnown: false }), ruleText)
    expect(v.result).toBe('indetermine')
    expect(v.labelFr).toBe(TP_STRINGS.verdict.placeFirst)
  })

  it('no place and no device: the place comes first', () => {
    const v = buildVerdict(state({ placeKnown: false, instances: [] }), ruleText)
    expect(v.labelFr).toBe(TP_STRINGS.verdict.placeFirst)
  })

  it('a device with no ports in the events does not matter: no crash, same sentence as any bench', () => {
    const v = buildVerdict(state({ instances: [{ id: 'lonely', deviceId: 'dev-x', label: 'Seul' }], events: [] }), ruleText)
    expect(v.result).toBe('indetermine')
    expect(v.labelFr).toBe(TP_STRINGS.verdict.notYet)
  })
})

describe('buildVerdict: errors', () => {
  it('one error event gives a-corriger whose causeFr and fixFr equal ruleTextFor(title) and (detail) exactly and whose subject is the first port', () => {
    const v = buildVerdict(state({ events: [{ ruleId: 'R4', severity: 'error', subjects: [P1, P2] }] }), ruleText)
    expect(v.result).toBe('a-corriger')
    expect(v.reason).toBe('setup-error')
    expect(v.primary).not.toBeNull()
    expect(v.primary!.ruleId).toBe('R4')
    expect(v.primary!.causeFr).toBe(ruleText('R4').title)
    expect(v.primary!.fixFr).toBe(ruleText('R4').detail)
    expect(v.primary!.fixFr).not.toBe('')
    expect(v.primary!.subjects[0]).toEqual(P1)
    expect(v.primary!.subjects).toEqual([P1, P2])
    expect(v.primary!.factIds).toEqual([])
    expect(v.labelFr).toBe(ruleText('R4').title)
    expect(v.alsoFound).toEqual([])
    expect(v.coveredFamilies).toEqual([])
    expect(v.notEvaluated).toEqual([])
    expect(v.note).toBeNull()
  })

  it('two errors: primary is the first, the other is in alsoFound', () => {
    const v = buildVerdict(
      state({
        events: [
          { ruleId: 'R3', severity: 'error', subjects: [P1] },
          { ruleId: 'R6', severity: 'error', subjects: [P2, P3] },
        ],
      }),
      ruleText,
    )
    expect(v.primary!.ruleId).toBe('R3')
    expect(v.alsoFound).toEqual([{ ruleId: 'R6', subjects: [P2, P3] }])
  })

  it('a warning before an error does not become the primary; it goes to alsoFound', () => {
    const v = buildVerdict(
      state({
        events: [
          { ruleId: 'R5', severity: 'warning', subjects: [P1] },
          { ruleId: 'R3', severity: 'error', subjects: [P2] },
        ],
      }),
      ruleText,
    )
    expect(v.result).toBe('a-corriger')
    expect(v.primary!.ruleId).toBe('R3')
    expect(v.alsoFound).toEqual([{ ruleId: 'R5', subjects: [P1] }])
  })

  it('a warning alone is not a-corriger', () => {
    const v = buildVerdict(state({ events: [{ ruleId: 'R5', severity: 'warning', subjects: [P1] }] }), ruleText)
    expect(v.result).not.toBe('a-corriger')
    expect(v.primary).toBeNull()
  })

  it('a warning alone on a playable bench is still bon', () => {
    const v = buildVerdict(state({ playbackReady: true, events: [{ ruleId: 'R5', severity: 'warning', subjects: [P1] }] }), ruleText)
    expect(v.result).toBe('bon')
  })

  it("a rule id absent from the catalog degrades to the app's unknown-rule text, which also stands for the fix (no blank bubble, nothing invented), no throw", () => {
    let v: ReturnType<typeof buildVerdict> | undefined
    expect(() => {
      v = buildVerdict(state({ events: [{ ruleId: 'R99', severity: 'error', subjects: [P1] }] }), ruleText)
    }).not.toThrow()
    expect(v!.result).toBe('a-corriger')
    expect(v!.primary!.causeFr).toBe(ruleText('R99').title)
    expect(v!.primary!.causeFr).not.toBe('')
    expect(ruleText('R99').detail).toBe('')
    expect(v!.primary!.fixFr).toBe(ruleText('R99').title)
  })

  it('a rule with a title but no explanation: the fix is the title again, never a made-up sentence', () => {
    const rt = ruleTextFor([{ id: 'X1', title: 'e', teach: 'e', title_fr: 'Règle sans explication', teach_fr: '' }])
    const v = buildVerdict(state({ events: [{ ruleId: 'X1', severity: 'error', subjects: [P1] }] }), rt)
    expect(v.primary!.causeFr).toBe('Règle sans explication')
    expect(v.primary!.fixFr).toBe('Règle sans explication')
  })

  it('an error with no subject keeps an empty subject list', () => {
    const v = buildVerdict(state({ events: [{ ruleId: 'R4', severity: 'error', subjects: [] }] }), ruleText)
    expect(v.primary!.subjects).toEqual([])
  })

  it('a rule text lookup that throws gives a calm a-corriger whose fix repeats the calm sentence, never an invented one', () => {
    const boom = (): { title: string; detail: string } => {
      throw new Error('catalog gone')
    }
    const v = buildVerdict(state({ events: [{ ruleId: 'R4', severity: 'error', subjects: [P1] }] }), boom)
    expect(v.result).toBe('a-corriger')
    expect(v.primary!.fixFr).toBe(TP_STRINGS.verdict.toFix)
    expect(v.primary!.causeFr).toBe(TP_STRINGS.verdict.toFix)
  })

  it('the subjects are copies: changing the verdict does not change the state', () => {
    const s = state({ events: [{ ruleId: 'R4', severity: 'error', subjects: [P1] }] })
    const v = buildVerdict(s, ruleText)
    v.primary!.subjects[0]!.port = 'changed'
    expect(s.events[0]!.subjects[0]!.port).toBe('out')
  })
})

describe('buildVerdict: no error', () => {
  it('playable and no error gives bon with the scope sentence from strings', () => {
    const v = buildVerdict(state({ playbackReady: true }), ruleText)
    expect(v.result).toBe('bon')
    expect(v.labelFr).toBe(TP_STRINGS.verdict.allGood)
    expect(v.reason).toBeNull()
    expect(v.primary).toBeNull()
  })

  it('not playable, no error, a firstReason gives indetermine quoting text_fr verbatim', () => {
    const text = 'Aucune source n’est active : rien ne part de la console.'
    const v = buildVerdict(state({ firstReason: { code: 'NO_SOURCE', text_fr: text, subjects: [] } }), ruleText)
    expect(v.result).toBe('indetermine')
    expect(v.labelFr).toBe(text)
    expect(v.reason).toBe('missing-input')
  })

  it('not playable, no error, no reason: indetermine with the not-yet sentence', () => {
    const v = buildVerdict(state(), ruleText)
    expect(v.result).toBe('indetermine')
    expect(v.labelFr).toBe(TP_STRINGS.verdict.notYet)
    expect(v.reason).toBe('no-coverage')
  })
})

describe('buildVerdict: the hash', () => {
  it('setupHash is a short digest of the bridge state hash that the shape check accepts, and changes with the state', () => {
    const a = state()
    const b = state({ connections: [{ a: P1, b: P2 }] })
    const c = state({ events: [{ ruleId: 'R4', severity: 'error', subjects: [P1] }] })
    expect(buildVerdict(a, ruleText).setupHash).toBe(digestOf(stateHash(a)))
    expect(buildVerdict(a, ruleText).setupHash).toMatch(/^[0-9A-Za-z:]{1,128}$/)
    expect(stateHash(a)).not.toMatch(/^[0-9A-Za-z:]{1,128}$/)
    expect(buildVerdict(a, ruleText).setupHash).toBe(buildVerdict(state(), ruleText).setupHash)
    expect(buildVerdict(b, ruleText).setupHash).not.toBe(buildVerdict(a, ruleText).setupHash)
    expect(buildVerdict(c, ruleText).setupHash).not.toBe(buildVerdict(a, ruleText).setupHash)
  })
})

describe('buildVerdict: what the browser-side shape check keeps', () => {
  it('survives shapeBrainVerdict for every kind of verdict (hash, reason and strings accepted)', () => {
    const states: TpState[] = [
      state({ instances: [] }),
      state({ placeKnown: false }),
      state({ playbackReady: true }),
      state({ firstReason: { code: 'NO_PATH', text_fr: 'Aucun chemin ne mène aux enceintes.', subjects: [] } }),
      state({ events: [{ ruleId: 'R4', severity: 'error', subjects: [P1, P2] }] }),
      state({ events: [{ ruleId: 'R99', severity: 'error', subjects: [P1] }] }),
    ]
    for (const s of states) {
      const v = buildVerdict(s, ruleText)
      const shaped = shapeBrainVerdict({ verdict: v, needInfo: null })
      expect(shaped.verdict).not.toBeNull()
      expect(shaped.verdict!.result).toBe(v.result)
      expect(shaped.verdict!.labelFr).toBe(v.labelFr)
      if (v.primary !== null) {
        expect(shaped.verdict!.primary!.causeFr).toBe(v.primary.causeFr)
        expect(shaped.verdict!.primary!.fixFr).toBe(v.primary.fixFr)
        expect(shaped.verdict!.primary!.subjects).toEqual(v.primary.subjects)
      }
    }
  })
})
