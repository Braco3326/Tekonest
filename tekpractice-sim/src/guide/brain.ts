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
/** A word shorter than this never counts. */
const MIN_WORD = 3

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

interface Candidate {
  row: RuleRow
  /** Question words found in the rule's title, plus those found anywhere in its text: a title hit counts twice. */
  score: number
  titleHits: number
}

/**
 * The rule a question is about, or null (a refusal is better than a guess).
 *  - Only words that occur in some rule's text count ("known" words); the rest of the question is ignored.
 *  - A lone known word finds a rule only if it occurs in exactly one rule's whole text (title and explanation).
 *  - With several known words, a rule needs at least two of them, at least one that occurs in no other rule, and either one hit in its title
 *    or three overlaps. Of two rules that tie, the one with strictly more title hits wins; otherwise nothing is answered.
 */
function findRule(question: string, rules: readonly RuleRow[]): RuleRow | null {
  const q = wordsOf(question)
  if (q.size === 0) return null
  const indexed = Array.from(rules, (row) => {
    const usable = row !== null && typeof row === 'object' && typeof row.title_fr === 'string' && row.title_fr !== ''
    const title = usable ? wordsOf(row.title_fr as string) : new Set<string>()
    const teach = usable && typeof row.teach_fr === 'string' ? wordsOf(row.teach_fr) : new Set<string>()
    return { row, title, all: new Set<string>([...title, ...teach]), usable }
  }).filter((r) => r.usable)

  const rulesWith = new Map<string, number>()
  for (const r of indexed) for (const w of r.all) rulesWith.set(w, (rulesWith.get(w) ?? 0) + 1)
  const known = [...q].filter((w) => rulesWith.has(w))
  if (known.length === 0) return null

  if (known.length === 1) {
    const word = known[0] as string
    return rulesWith.get(word) === 1 ? ((indexed.find((r) => r.all.has(word)) as (typeof indexed)[number]).row) : null
  }

  const found: Candidate[] = []
  for (const r of indexed) {
    const overlaps = known.filter((w) => r.all.has(w))
    const titleHits = overlaps.filter((w) => r.title.has(w)).length
    const distinctive = overlaps.some((w) => rulesWith.get(w) === 1)
    if (overlaps.length >= 2 && distinctive && (titleHits >= 1 || overlaps.length >= 3)) found.push({ row: r.row, score: overlaps.length + titleHits, titleHits })
  }
  found.sort((a, b) => b.score - a.score || b.titleHits - a.titleHits)
  const [top, next] = found
  if (top === undefined) return null
  if (next !== undefined && next.score === top.score && next.titleHits === top.titleHits) return null
  return top.row
}

const reply = (kind: BrainReply['kind'], text: string, lines: BrainReply['lines'] = []): BrainReply => ({ kind, text, lines, verdict: null })

export function createTekPracticeBrain(deps: { bridge: TpBridge; rules: readonly RuleRow[]; mode: () => 'practice' | 'exam'; route?: TpState['route'] }): GuideBrain {
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
    const legacy = deps.route === 'legacy'
    const empty: TpState = { route: legacy ? 'legacy' : 'creation', placeKnown: legacy, instances: [], connections: [], controls: {}, events: [], playbackReady: false, firstReason: null }
    return { ...buildVerdict(empty, ruleTextFor(rules)), labelFr: legacy ? TP_STRINGS.verdict.legacyNothingToJudge : TP_STRINGS.verdict.nothingToJudge }
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
