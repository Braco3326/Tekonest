// The TekPractice brain. It knows only what the app itself knows: the live bench (through the bridge) and the catalog's rule texts.
// No remote call, no fact of its own. Silent in exam, and it never throws out of `ask`.
import { ruleTextFor, type RuleRow } from '../creation/shell/statusModel'
import type { TpBridge, TpState } from './bridge/types'
import { TP_STRINGS } from './strings'
import { buildVerdict } from './verdict'
import type { BrainReply, BrainRequest, BrainVerdict, GuideBrain } from './vendor/core/brain'
import type { Verdict } from './vendor/hostTypes'

/** The only badge this brain ever produces: what it quotes is the app's own wording, not signed by anyone. */
const BADGE = 'À vérifier (non signé)'
/** A question longer than this is cut before anything reads it. */
const MAX_QUESTION_CHARS = 2000
/** A word shorter than this never counts, and a lone word must be at least this long to find a rule on its own. */
const MIN_WORD = 3
const MIN_LONE_WORD = 6

// Words that say nothing about a rule (already folded: no accent, lower case).
const STOP = new Set(
  (
    'le la les un une des du de d l et ou en au aux ce ces cet cette je tu il elle on nous vous ils elles mon ma mes ton ta tes son sa ses ' +
    'que qui quoi dont est sont etre ete avoir ai as avons avez ont pas ne ni se sur sous dans par pour avec sans plus moins tres ' +
    'comment pourquoi quand quel quelle quels quelles faire fait fais peut peux peuvent puis si mais car donc ca cela ceci ici la voici ' +
    'veux veut voudrais dois doit faut falloir quoi alors aussi encore meme tout tous toute toutes y'
  ).split(' '),
)

const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** The words of a text that can tell one rule from another: folded, no stop word, a trailing plural mark removed. */
function wordsOf(text: string): Set<string> {
  const out = new Set<string>()
  for (const raw of fold(text).split(/[^a-z0-9]+/u)) {
    if (raw.length < MIN_WORD || STOP.has(raw)) continue
    out.add(raw.length > MIN_WORD && /[sx]$/u.test(raw) ? raw.slice(0, -1) : raw)
  }
  return out
}

interface Hit {
  row: RuleRow
  /** Distinct question words found in the rule's text. */
  matched: number
  /** A word found in the title counts double. */
  score: number
}

/** The rule a question is about, or null. At least two distinct words must match, or one long word found in exactly one title. */
function findRule(question: string, rules: readonly RuleRow[]): RuleRow | null {
  const q = wordsOf(question)
  if (q.size === 0) return null
  const indexed = Array.from(rules, (row) => {
    const usable = row !== null && typeof row === 'object' && typeof row.title_fr === 'string' && row.title_fr !== ''
    return {
      row,
      title: usable ? wordsOf(row.title_fr as string) : new Set<string>(),
      teach: usable && typeof row.teach_fr === 'string' ? wordsOf(row.teach_fr) : new Set<string>(),
      usable,
    }
  }).filter((r) => r.usable)

  let best: Hit | null = null
  for (const r of indexed) {
    let matched = 0
    let score = 0
    for (const w of q) {
      if (r.title.has(w)) {
        matched += 1
        score += 2
      } else if (r.teach.has(w)) {
        matched += 1
        score += 1
      }
    }
    if (matched >= 2 && (best === null || score > best.score)) best = { row: r.row, matched, score }
  }
  if (best !== null) return best.row

  if (q.size === 1) {
    const word = [...q][0] as string
    if (word.length >= MIN_LONE_WORD) {
      const inTitle = indexed.filter((r) => r.title.has(word))
      if (inTitle.length === 1) return (inTitle[0] as (typeof indexed)[number]).row
    }
  }
  return null
}

const reply = (kind: BrainReply['kind'], text: string, lines: BrainReply['lines'] = []): BrainReply => ({ kind, text, lines, verdict: null })

export function createTekPracticeBrain(deps: { bridge: TpBridge; rules: readonly RuleRow[]; mode: () => 'practice' | 'exam' }): GuideBrain {
  // Fail closed: anything but "practice", or a getter that throws, is exam.
  const practice = (): boolean => {
    try {
      return deps.mode() === 'practice'
    } catch {
      return false
    }
  }

  const withheld = (): BrainReply => reply('withheld', TP_STRINGS.ask.examQuiet)

  const nothingToJudge = (rules: readonly RuleRow[]): Verdict => {
    const empty: TpState = { route: 'creation', placeKnown: false, instances: [], connections: [], controls: {}, events: [], playbackReady: false, firstReason: null }
    return { ...buildVerdict(empty, ruleTextFor(rules)), labelFr: TP_STRINGS.verdict.nothingToJudge }
  }

  return {
    async ask(req: BrainRequest): Promise<BrainReply> {
      try {
        if (!practice()) return withheld()
        if (req === null || typeof req !== 'object') return reply('error', TP_STRINGS.error.calm)
        if (req.mode !== 'practice') return withheld()
        const question = typeof req.question === 'string' ? req.question.slice(0, MAX_QUESTION_CHARS) : ''
        const row = findRule(question, deps.rules)
        if (row === null) return reply('refusal', TP_STRINGS.ask.noInformation)
        const t = ruleTextFor([row])(row.id)
        const text = t.detail === '' ? t.title : `${t.title} : ${t.detail}`
        return reply('answer', text, [{ text, badge: BADGE, citation: null }])
      } catch {
        return reply('error', TP_STRINGS.error.calm)
      }
    },

    async judge(_setup, mode): Promise<BrainVerdict> {
      if (!practice() || mode !== 'practice') return { verdict: null, needInfo: null, withheld: true }
      let snap: TpState | null = null
      try {
        snap = deps.bridge.snapshot()
      } catch {
        snap = null
      }
      let verdict: Verdict
      try {
        verdict = snap === null ? nothingToJudge(deps.rules) : buildVerdict(snap, ruleTextFor(deps.rules))
      } catch {
        verdict = nothingToJudge([])
      }
      return { verdict, needInfo: null }
    },
  }
}
