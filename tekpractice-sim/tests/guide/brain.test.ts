// The TekPractice brain: the app's own rule texts, a fixed refusal, silence in exam, and never a throw.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi, type Mock } from 'vitest'
import { createTekPracticeBrain } from '../../src/guide/brain'
import type { TpBridge, TpState } from '../../src/guide/bridge/types'
import { TP_STRINGS } from '../../src/guide/strings'
import { shapeBrainVerdict, shapeReply, BADGE_UNSIGNED } from '../../src/guide/vendor/core/shape'
import type { BrainReply } from '../../src/guide/vendor/core/brain'
import type { Setup } from '../../src/guide/vendor/hostTypes'
import { ruleTextFor, type RuleRow } from '../../src/creation/shell/statusModel'

const rules = (JSON.parse(readFileSync(resolve(process.cwd(), 'content/catalog.json'), 'utf8')) as { rules: RuleRow[] }).rules
const ruleText = ruleTextFor(rules)
const BADGE = 'À vérifier (non signé)'
const NO_INFO = "Je n'ai pas encore d'information sur ce point."

const SETUP: Setup = { coveredFamilies: [], instances: [], connections: [] }

function benchState(over: Partial<TpState> = {}): TpState {
  return {
    route: 'creation',
    placeKnown: true,
    instances: [{ id: 'mic-1', deviceId: 'dev-mic', label: 'Micro' }],
    connections: [],
    controls: {},
    events: [],
    playbackReady: false,
    firstReason: null,
    ...over,
  }
}

function fakeBridge(snap: () => TpState | null = () => benchState()): TpBridge & { snapshot: Mock<[], TpState | null> } {
  return {
    snapshot: vi.fn(snap),
    rectOf: vi.fn(() => null),
    anchorOfPort: vi.fn(() => 'port:x.y'),
    anchorOfDevice: vi.fn(() => 'device:x'),
    anchorOfControl: vi.fn(() => 'control:x.y'),
    onChange: vi.fn(() => () => undefined),
    destroy: vi.fn(),
  }
}

function brainWith(opts: { bridge?: TpBridge; mode?: () => 'practice' | 'exam'; rules?: readonly RuleRow[] } = {}) {
  const bridge = opts.bridge ?? fakeBridge()
  const brain = createTekPracticeBrain({ bridge, rules: opts.rules ?? rules, mode: opts.mode ?? (() => 'practice') })
  return { brain, bridge }
}

const ask = (brain: ReturnType<typeof brainWith>['brain'], question: string, mode: 'practice' | 'exam' = 'practice'): Promise<BrainReply> =>
  brain.ask({ question, mode })

describe('exam mode', () => {
  it('exam mode: ask and judge return withheld and never read the bridge (spy)', async () => {
    const { brain, bridge } = brainWith({ mode: () => 'exam' })
    const j = await brain.judge(SETUP, 'practice')
    expect(j).toEqual({ verdict: null, needInfo: null, withheld: true })
    const a = await brain.ask({ question: 'alimentation fantôme', mode: 'practice' })
    expect(a.kind).toBe('withheld')
    expect(a.text).toBe(TP_STRINGS.ask.examQuiet)
    expect(a.lines).toEqual([])
    expect(a.verdict).toBeNull()
    expect(bridge.snapshot).not.toHaveBeenCalled()
    expect(bridge.rectOf).not.toHaveBeenCalled()
    expect(bridge.onChange).not.toHaveBeenCalled()
  })

  it('a request that says exam is withheld even when the getter says practice', async () => {
    const { brain, bridge } = brainWith()
    expect(await brain.judge(SETUP, 'exam')).toEqual({ verdict: null, needInfo: null, withheld: true })
    expect((await ask(brain, 'alimentation fantôme', 'exam')).kind).toBe('withheld')
    expect(bridge.snapshot).not.toHaveBeenCalled()
  })

  it('any mode other than practice is exam (fail closed), read at every call', async () => {
    let m = 'practice'
    const { brain, bridge } = brainWith({ mode: () => m as 'practice' })
    expect((await brain.judge(SETUP, 'practice')).verdict).not.toBeNull()
    expect(bridge.snapshot).toHaveBeenCalledTimes(1)
    m = 'anything'
    expect((await brain.judge(SETUP, 'practice')).withheld).toBe(true)
    expect((await ask(brain, 'alimentation fantôme')).kind).toBe('withheld')
    expect(bridge.snapshot).toHaveBeenCalledTimes(1)
  })

  it('a mode getter that returns a non-string (number, object, null, undefined, array) is exam too', async () => {
    for (const odd of [1, 0, {}, { toString: () => 'practice' }, ['practice'], null, undefined, true]) {
      const { brain, bridge } = brainWith({ mode: () => odd as unknown as 'practice' })
      expect(await brain.judge(SETUP, 'practice'), String(odd)).toEqual({ verdict: null, needInfo: null, withheld: true })
      expect((await ask(brain, 'alimentation fantôme')).kind, String(odd)).toBe('withheld')
      expect(bridge.snapshot).not.toHaveBeenCalled()
    }
  })

  it('a mode getter that throws is exam too', async () => {
    const { brain, bridge } = brainWith({
      mode: () => {
        throw new Error('gate broke')
      },
    })
    expect((await brain.judge(SETUP, 'practice')).withheld).toBe(true)
    expect((await ask(brain, 'alimentation fantôme')).kind).toBe('withheld')
    expect(bridge.snapshot).not.toHaveBeenCalled()
  })
})

describe('ask', () => {
  it("a question matching R4 returns that rule's title and explanation as one badged line", async () => {
    const { brain } = brainWith()
    const r = await ask(brain, 'Pourquoi mon micro à condensateur reste muet sans alimentation fantôme ?')
    expect(r.kind).toBe('answer')
    const t = ruleText('R4')
    expect(r.lines).toEqual([{ text: `${t.title} : ${t.detail}`, badge: BADGE, citation: null }])
    expect(r.text).toBe(`${t.title} : ${t.detail}`)
    expect(r.verdict).toBeNull()
  })

  it('no match returns the no-information refusal', async () => {
    const { brain } = brainWith()
    for (const q of ['Quelle est la capitale de la Mongolie ?', 'Comment ça marche ?', '', '   ', 'micro']) {
      const r = await ask(brain, q)
      expect(r.kind, q).toBe('refusal')
      expect(r.text, q).toBe(NO_INFO)
      expect(r.text).toBe(TP_STRINGS.ask.noInformation)
      expect(r.lines, q).toEqual([])
    }
  })

  it('accent-free and uppercase questions match', async () => {
    const { brain } = brainWith()
    const t = ruleText('R4')
    for (const q of ['alimentation fantome', 'ALIMENTATION FANTÔME', 'Alimentation FANTOME ???', 'l’alimentation fantôme, c’est quoi ?']) {
      const r = await ask(brain, q)
      expect(r.kind, q).toBe('answer')
      expect(r.lines[0]!.text, q).toBe(`${t.title} : ${t.detail}`)
    }
  })

  it('other rules are found too (larsen, word clock, mix-minus)', async () => {
    const { brain } = brainWith()
    expect((await ask(brain, 'pourquoi un larsen avec les enceintes et le micro ouvert ?')).lines[0]!.text).toContain(ruleText('R6').title)
    expect((await ask(brain, 'horloge word clock maître esclave')).lines[0]!.text).toContain(ruleText('R8').title)
    expect((await ask(brain, 'un invité entend sa propre voix en écho')).lines[0]!.text).toContain(ruleText('R7').title)
  })

  it('one distinctive word of a rule is enough', async () => {
    const { brain } = brainWith()
    expect((await ask(brain, 'larsen ?')).lines[0]!.text).toContain(ruleText('R6').title)
    expect((await ask(brain, 'Qu’est-ce que le larsen sur scène ?')).lines[0]!.text).toContain(ruleText('R6').title)
    expect((await ask(brain, 'alimentation fantôme')).lines[0]!.text).toContain(ruleText('R4').title)
    expect((await ask(brain, 'enceintes de studio micro ouvert')).lines[0]!.text).toContain(ruleText('R6').title)
  })

  it('a generic question is refused, not guessed: a lone word found in several rules, two generic words, other languages, odd input', async () => {
    const { brain } = brainWith()
    const vague = [
      'signal',
      'signal micro',
      'micro',
      'signal ?',
      'How do I connect a microphone to the mixing desk?',
      'What is the signal flow',
      '__proto__',
      'constructor',
      'toString hasOwnProperty',
      '(.*)+',
      '[[[',
      '\\',
      '(?<a>',
      'comment ça marche',
      'Comment ça marche ?',
    ]
    for (const q of vague) {
      const r = await ask(brain, q)
      expect(r.kind, q).toBe('refusal')
      expect(r.text, q).toBe(NO_INFO)
      expect(r.lines, q).toEqual([])
    }
  })

  it('a lone word is accepted only when it occurs in exactly one rule’s whole text', async () => {
    const odd: RuleRow[] = [
      { id: 'A1', title: 'a', teach: 'a', title_fr: 'Réglage du gain', teach_fr: 'Le niveau se règle avec prudence.' },
      { id: 'A2', title: 'b', teach: 'b', title_fr: 'Réglage du retour', teach_fr: 'Le gain du retour reste bas.' },
      { id: 'A3', title: 'c', teach: 'c', title_fr: 'Câblage symétrique', teach_fr: 'Deux conducteurs portent le signal.' },
    ]
    const { brain } = brainWith({ rules: odd })
    expect((await ask(brain, 'gain')).kind).toBe('refusal')
    expect((await ask(brain, 'prudence')).lines[0]!.text).toContain('Réglage du gain')
    expect((await ask(brain, 'conducteurs')).lines[0]!.text).toContain('Câblage symétrique')
  })

  it('two rules that tie are not guessed between; strictly more title hits wins', async () => {
    const twins: RuleRow[] = [
      { id: 'T1', title: 'a', teach: 'a', title_fr: 'Prise jack', teach_fr: 'Une fiche mono dans une prise.' },
      { id: 'T2', title: 'b', teach: 'b', title_fr: 'Prise XLR', teach_fr: 'Une fiche trois broches dans une prise.' },
    ]
    const { brain } = brainWith({ rules: twins })
    expect((await ask(brain, 'prise fiche')).kind).toBe('refusal')
    expect((await ask(brain, 'prise jack xlr')).kind).toBe('refusal')
    expect((await ask(brain, 'prise jack')).lines[0]!.text).toBe('Prise jack : Une fiche mono dans une prise.')

    const lopsided: RuleRow[] = [
      { id: 'L1', title: 'a', teach: 'a', title_fr: 'Alpha bravo', teach_fr: 'Charlie golf' },
      { id: 'L2', title: 'b', teach: 'b', title_fr: 'Delta', teach_fr: 'Alpha bravo charlie echo foxtrot hotel' },
    ]
    const { brain: lop } = brainWith({ rules: lopsided })
    // Same score (six each); the first rule has strictly more title hits.
    expect((await ask(lop, 'alpha bravo charlie golf echo foxtrot hotel')).lines[0]!.text).toContain('Alpha bravo')
  })

  it('a 5,000 character question is cut and answered', async () => {
    const { brain } = brainWith()
    const long = 'alimentation fantôme '.repeat(250)
    expect(long.length).toBeGreaterThan(5000)
    const r = await ask(brain, long)
    expect(r.kind).toBe('answer')
    expect(r.lines).toHaveLength(1)
    // What lies after the 2,000th character is never read.
    const tail = `${'x '.repeat(1100)}alimentation fantôme`
    expect(tail.length).toBeGreaterThan(2000)
    expect((await ask(brain, tail)).kind).toBe('refusal')
  })

  it('ask never throws when the bridge throws', async () => {
    const bridge = fakeBridge(() => {
      throw new Error('bridge down')
    })
    const { brain } = brainWith({ bridge })
    await expect(ask(brain, 'alimentation fantôme')).resolves.toMatchObject({ kind: 'answer' })
    await expect(ask(brain, 'quoi ?')).resolves.toMatchObject({ kind: 'refusal' })
  })

  it('ask never throws on bad input or a broken catalog: a calm error reply', async () => {
    const broken = new Proxy([] as RuleRow[], {
      get() {
        throw new Error('catalog gone')
      },
    })
    const { brain } = brainWith({ rules: broken })
    const r = await ask(brain, 'alimentation fantôme')
    expect(r.kind).toBe('error')
    expect(r.text).toBe(TP_STRINGS.error.calm)

    const { brain: ok } = brainWith()
    for (const q of [undefined, null, 42, {}, []]) {
      const out = await ok.ask({ question: q as unknown as string, mode: 'practice' })
      expect(['refusal', 'error']).toContain(out.kind)
    }
    const out2 = await (ok.ask as unknown as (r: unknown) => Promise<BrainReply>)(undefined)
    expect(out2.kind).toBe('error')
  })

  it('a rule without a French title is never offered; one without an explanation answers with its title alone', async () => {
    const odd: RuleRow[] = [
      { id: 'X1', title: 'Only English wording here', teach: 'English only' },
      { id: 'X2', title: 'b', teach: 'b', title_fr: 'Câblage symétrique', teach_fr: '' },
      null as unknown as RuleRow,
    ]
    const { brain } = brainWith({ rules: odd })
    expect((await ask(brain, 'only english wording')).kind).toBe('refusal')
    const r = await ask(brain, 'câblage symétrique')
    expect(r.kind).toBe('answer')
    expect(r.lines[0]!.text).toBe('Câblage symétrique')
  })

  it('the only badge ever produced is "À vérifier (non signé)", and the browser-side shape check keeps the reply whole', async () => {
    expect(BADGE_UNSIGNED).toBe(BADGE)
    const { brain } = brainWith()
    const questions = ['alimentation fantôme', 'larsen', 'horloge word clock', 'connecteurs incompatibles xlr', 'sens de connexion sortie', 'rien du tout', 'écho retour invité mix-minus', 'voyant on-air tally']
    const badges = new Set<string | null>()
    for (const q of questions) {
      const r = await ask(brain, q)
      for (const l of r.lines) badges.add(l.badge)
      const shaped = shapeReply(r)
      expect(shaped.kind, q).toBe(r.kind)
      expect(shaped.lines, q).toEqual(r.lines)
      expect(shaped.text, q).toBe(r.text)
    }
    expect([...badges]).toEqual([BADGE])
    for (const r of [await ask(brain, 'alimentation fantôme', 'exam'), await ask(brain, 'bof')]) {
      expect(r.lines.every((l) => l.badge === BADGE)).toBe(true)
    }
  })
})

describe('judge', () => {
  it('reads the live bridge, ignores its setup argument and returns a verdict that survives the shape check', async () => {
    const bridge = fakeBridge(() => benchState({ events: [{ ruleId: 'R4', severity: 'error', subjects: [{ instance: 'mic-1', port: 'out' }] }] }))
    const { brain } = brainWith({ bridge })
    const bv = await brain.judge({ coveredFamilies: ['x'], instances: [], connections: [] }, 'practice')
    expect(bridge.snapshot).toHaveBeenCalledTimes(1)
    expect(bv.needInfo).toBeNull()
    expect(bv.withheld).toBeUndefined()
    expect(bv.verdict!.result).toBe('a-corriger')
    expect(bv.verdict!.primary!.causeFr).toBe(ruleText('R4').title)
    expect(bv.verdict!.primary!.fixFr).toBe(ruleText('R4').detail)
    expect(bv.verdict!.coveredFamilies).toEqual([])
    const shaped = shapeBrainVerdict(bv)
    expect(shaped.verdict!.primary!.fixFr).toBe(ruleText('R4').detail)
  })

  it('a null snapshot (app not ready) is a calm indetermine, not a throw', async () => {
    const { brain } = brainWith({ bridge: fakeBridge(() => null) })
    const bv = await brain.judge(SETUP, 'practice')
    expect(bv.verdict!.result).toBe('indetermine')
    expect(bv.verdict!.labelFr).toBe(TP_STRINGS.verdict.nothingToJudge)
    expect(bv.needInfo).toBeNull()
    expect(() => shapeBrainVerdict(bv)).not.toThrow()
  })

  it('a bridge that throws is the same calm indetermine', async () => {
    const { brain } = brainWith({
      bridge: fakeBridge(() => {
        throw new Error('bridge down')
      }),
    })
    const bv = await brain.judge(SETUP, 'practice')
    expect(bv.verdict!.labelFr).toBe(TP_STRINGS.verdict.nothingToJudge)
  })

  it('a playable bench is bon with the scope sentence', async () => {
    const { brain } = brainWith({ bridge: fakeBridge(() => benchState({ playbackReady: true })) })
    const bv = await brain.judge(SETUP, 'practice')
    expect(bv.verdict!.result).toBe('bon')
    expect(bv.verdict!.labelFr).toBe(TP_STRINGS.verdict.allGood)
  })

  it('the empty bench and a rule id missing from the catalog both stay calm', async () => {
    const empty = brainWith({ bridge: fakeBridge(() => benchState({ instances: [] })) })
    expect((await empty.brain.judge(SETUP, 'practice')).verdict!.labelFr).toBe(TP_STRINGS.verdict.benchEmpty)
    const missing = brainWith({ bridge: fakeBridge(() => benchState({ events: [{ ruleId: 'R99', severity: 'error', subjects: [] }] })) })
    const bv = await missing.brain.judge(SETUP, 'practice')
    expect(bv.verdict!.primary!.causeFr).toBe(ruleText('R99').title)
    expect(bv.verdict!.primary!.fixFr).toBe(ruleText('R99').title)
  })
})
