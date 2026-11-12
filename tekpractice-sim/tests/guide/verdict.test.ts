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
import { COPY } from '../../src/creation/copy'
import { signalPath, type ReasonCode } from '../../src/flow/signalPath'
import { CreationStore, creationEvaluator } from '../../src/creation/store'
import { makeRegistry } from '../helpers'

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

  it('not playable, no error, a firstReason gives indetermine quoting text_fr verbatim (T1.4: a known code adds its action after it; an unknown code adds nothing)', () => {
    const text = 'Aucune source n’est active : rien ne part de la console.'
    const v = buildVerdict(state({ firstReason: { code: 'NO_SOURCE', text_fr: text, subjects: [] } }), ruleText)
    expect(v.result).toBe('indetermine')
    expect(v.labelFr).toBe(`${text} ${COPY.assist!.noSource}`)
    expect(buildVerdict(state({ firstReason: { code: 'OTHER', text_fr: text, subjects: [] } }), ruleText).labelFr).toBe(text)
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

// ── T1.4: « Oscar says what to do »: label = the engine's reason (verbatim) + one action sentence per ReasonCode (COPY.assist) ─────────────────
// The banned families of spec 9 (T1.7 consolidates them into tests/creation/honesty.test.ts; this list is the same text for the sentences added here).
const BANNED: { name: string; re: RegExp }[] = [
  { name: 'success and school', re: /réussi|prépare au|\bBTS\b|\bE4\b|\bTMO\b|\bjury\b|\bexamen\b/i },
  { name: 'fidelity', re: /réaliste|vrai matériel|garanti|certifié|\bexact|fidèle|identique|comme en vrai|comme sur scène|sonnera/i },
  { name: 'safety and norms', re: /endommag|abîm|griller|danger|sécurité|\bnorme|conforme|\bSTI\b|\bSPL\b|RT60/i },
  { name: 'judgement', re: /bravo|parfait|correct|bien réglé/i },
  { name: 'false certainty', re: /la seule|le seul|passé par votre câblage|vous entendez le micro/i },
  { name: 'durations', re: /\d+\s*(s|sec|mn|min)\b|trois minutes/i },
  { name: 'figures', re: /\d|\bdBu?V?\b|\+48/i },
  { name: 'Oscar’s voice', re: /intelligent|expert|tuteur|ingénieur/i },
]

describe('buildVerdict: what to do (T1.4)', () => {
  const P = COPY.playback!
  const A = COPY.assist!
  /** The reason codes of the signal path with the COPY keys of their reason text and of their action; null = no action by design. */
  const CODES: Record<ReasonCode, { reason: string; action: string | null }> = {
    NO_SOURCE: { reason: P.noSource!, action: A.noSource! },
    SOURCE_OFF: { reason: P.sourceOff!, action: A.sourceOff! },
    HOST_UNPOWERED: { reason: P.hostUnpowered!, action: A.hostUnpowered! },
    NO_PATH: { reason: P.noPath!, action: A.noPath! },
    SPEAKER_UNPOWERED: { reason: P.speakerUnpowered!, action: A.speakerUnpowered! },
    // NO_MIC never reaches the verdict (the bridge reads path.reasons[0], NO_MIC lives in micReasons): no sentence, no dead copy.
    NO_MIC: { reason: P.noMic!, action: null },
    RULE_ERROR: { reason: P.ruleError!, action: null },
  }
  const withReason = (code: string, text_fr: string, over: Partial<TpState> = {}): TpState => state({ firstReason: { code, text_fr, subjects: [] }, ...over })

  for (const [code, { reason, action }] of Object.entries(CODES)) {
    if (action === null) continue
    it(`${code} (does trigger): the label is the engine's reason verbatim, then the action; the verdict stays « indetermine » / missing-input`, () => {
      const v = buildVerdict(withReason(code, reason), ruleText)
      expect(v.labelFr).toBe(`${reason} ${action}`)
      expect(v.labelFr.startsWith(reason)).toBe(true)
      expect(v.result).toBe('indetermine')
      expect(v.reason).toBe('missing-input')
      expect(v.primary).toBeNull()
    })
  }

  it('RULE_ERROR and NO_MIC (do not trigger): the reason alone, nothing added (the rule’s own fix is the one to read; NO_MIC is not a playback reason)', () => {
    expect(buildVerdict(withReason('RULE_ERROR', P.ruleError!), ruleText).labelFr).toBe(P.ruleError)
    expect(buildVerdict(withReason('NO_MIC', P.noMic!), ruleText).labelFr).toBe(P.noMic)
    expect(Object.keys(A).sort()).toEqual(['hostUnpowered', 'noPath', 'noSource', 'sourceOff', 'speakerUnpowered']) // no key for a code that adds nothing
  })

  it('NO_SOURCE with the Axia iQ placed (the console that has no « Lecture console » control): the sentence asks for a console WITH that command, and the command is the catalog’s own', () => {
    const registry = makeRegistry()
    const store = new CreationStore(registry, creationEvaluator(registry))
    expect(store.dispatch({ type: 'SPAWN', deviceId: 'axia-iq', instanceId: 'iq' }).ok).toBe(true)
    const path = signalPath(store.design(), registry, [])
    expect(path.reasons.map((r) => r.code)).toEqual(['NO_SOURCE']) // premise: a console is on the bench and the engine still has no source
    const v = buildVerdict(withReason('NO_SOURCE', path.reasons[0].text_fr), ruleText)
    expect(v.labelFr).toBe(`${P.noSource} ${A.noSource}`)
    expect(A.noSource).toContain('une console qui a la commande « Lecture console »')
    // every device that has a playback source (a `control:` route) carries a control labelled exactly like that
    const withSource = registry.catalog.devices.filter((d) => (d.routing ?? []).some((r) => r.from.startsWith('control:')))
    expect(withSource.length).toBeGreaterThan(0)
    for (const d of withSource) for (const r of d.routing!.filter((x) => x.from.startsWith('control:'))) expect(d.controls!.find((c) => c.id === r.from.slice('control:'.length))!.label, d.id).toBe('Lecture console')
  })

  it('a rule error event (does not trigger): the verdict is the rule’s own text, byte for byte as before; no action sentence anywhere', () => {
    const v = buildVerdict(withReason('NO_PATH', P.noPath!, { events: [{ ruleId: 'R4', severity: 'error', subjects: [P1, P2] }] }), ruleText)
    const t = ruleText('R4')
    expect(v.result).toBe('a-corriger')
    expect(v.labelFr).toBe(t.title)
    expect(v.primary!.causeFr).toBe(t.title)
    expect(v.primary!.fixFr).toBe(t.detail)
    for (const a of Object.values(A)) expect(JSON.stringify(v)).not.toContain(a)
  })

  it('a code the app does not know, and the level page’s own code (does not trigger): the reason verbatim, as before', () => {
    expect(buildVerdict(withReason('NO_CABLE', 'Le micro n’est relié à aucune entrée de la console.'), ruleText).labelFr).toBe('Le micro n’est relié à aucune entrée de la console.')
    const legacy = buildVerdict(withReason('missing-link', 'Premier lien à faire', { route: 'legacy' }), ruleText)
    expect(legacy.labelFr).toBe(`${TP_STRINGS.verdict.nextLink} Premier lien à faire`)
  })

  it('on the level page (does not trigger): a Mode Création code adds no action', () => {
    const v = buildVerdict(withReason('NO_SOURCE', P.noSource!, { route: 'legacy' }), ruleText)
    expect(v.labelFr).toBe(`${TP_STRINGS.verdict.nextLink} ${P.noSource}`)
  })

  it('a playable rig and the other states (does not trigger): unchanged', () => {
    expect(buildVerdict(state({ playbackReady: true, firstReason: { code: 'NO_SOURCE', text_fr: P.noSource!, subjects: [] } }), ruleText).labelFr).toBe(TP_STRINGS.verdict.allGood)
    expect(buildVerdict(state(), ruleText).labelFr).toBe(TP_STRINGS.verdict.notYet)
    expect(buildVerdict(state({ instances: [] }), ruleText).labelFr).toBe(TP_STRINGS.verdict.benchEmpty)
  })

  it('every action sentence says what to do (one sentence, « vous » form, no digit) and trips no banned phrase', () => {
    const sentences = Object.entries(A)
    expect(sentences.length).toBe(Object.values(CODES).filter((c) => c.action !== null).length) // one per code with an action, no stray key (no dead copy)
    for (const [key, s] of sentences) {
      expect(s, key).toMatch(/^[A-ZÉ][^.!?]*\.$/) // one sentence
      expect(s, key).toMatch(/^(Ajoutez|Activez|Sélectionnez|Reliez|Branchez)\b/) // the imperative « vous » form
      for (const b of BANNED) expect(s, `${key} / ${b.name}`).not.toMatch(b.re)
    }
  })

  it('the banned list does trip on a crafted sentence of each family (the scan is not vacuous)', () => {
    for (const s of ['Vous allez réussir.', 'Un son réaliste.', 'Risque de danger.', 'Bravo !', 'Vous entendez le micro.', 'Patientez 3 min.', 'Réglez à 12 dB.', 'Votre tuteur vous guide.']) expect(BANNED.some((b) => b.re.test(s)), s).toBe(true)
    expect(BANNED.some((b) => b.re.test('Reliez la sortie principale de la console à l’entrée d’une enceinte.'))).toBe(false)
  })

  it('the longer label survives the browser-side shape check whole', () => {
    const v = buildVerdict(withReason('HOST_UNPOWERED', P.hostUnpowered!), ruleText)
    expect(shapeBrainVerdict({ verdict: v, needInfo: null }).verdict!.labelFr).toBe(v.labelFr)
    expect(v.labelFr.length).toBeLessThan(400)
  })
})
