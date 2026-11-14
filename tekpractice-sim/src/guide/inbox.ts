// The unanswered-questions inbox, app side. It ships dark: with `FEATURES.guideInbox` off this module is never fetched, nothing is recorded, no storage key
// is created and no global is defined. With the flag on (testing by hand, no public switch), a question the brain has no answer for is kept in this
// browser's storage (never sent anywhere: this file makes no network call), the learner is told so in one calm line, and `window.__oscarQuestions` hands
// the list over as an export file.
//
// What is kept, and nothing else: the question text (200 characters at most, control characters turned into spaces), the first and last time it was asked
// (ISO 8601 from toISOString), how many times, and the route it was asked on. Never in an exam, a sandbox, a teacher page or with `?oscar=0`: the guide is not
// mounted there, and this module checks the same gates again before it defines or records anything.
//
// The export file has this shape: { version: 1, exportedAt, questions: [{ text, firstSeen, lastSeen, count, route }] }, the route
// `creation` or `legacy` only, and the same normalisation (NFKC, lower case, accents folded including oe, ae and the sharp s, punctuation and spaces
// collapsed) to tell one question from another.
import { FEATURES } from '../features'
import { guideMode, guideRouteAllowed, type GuideRoute } from './mode'
import type { BrainReply } from './vendor/core/brain'

export const INBOX_STORAGE_KEY = 'oscar-guide.inbox.v1'
/** The most questions kept; past it the one asked least recently is dropped. */
export const INBOX_CAP = 200
export const INBOX_MAX_TEXT = 200

/** DRAFT, French, impersonal: to be validated before the flag is ever turned on for learners. This constant is the only place the sentence lives. */
export const INBOX_NOTED_A_VALIDER = 'Cette question est notée pour améliorer l’aide ; elle reste dans ce navigateur.'

export type InboxRoute = GuideRoute

export interface InboxQuestion {
  text: string
  firstSeen: string
  lastSeen: string
  count: number
  route: InboxRoute
}

export interface InboxExport {
  version: 1
  exportedAt: string
  questions: InboxQuestion[]
}

/** The part of Storage the inbox uses. */
export interface InboxStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface Inbox {
  /** Keeps the question; false when nothing was kept (no usable text, no storage, a refused write). Never throws. */
  record(text: string, route: InboxRoute): boolean
  /** The export file, as JSON text. */
  export(): string
  /** Forgets every question and removes the storage key. */
  clear(): void
  size(): number
}

declare global {
  interface Window {
    __oscarQuestions?: { export(): string; clear(): void }
  }
}

/** Control and format characters become spaces; the text is trimmed, cut at 200 characters (code points) and trimmed again. */
export function cleanQuestion(text: string): string {
  return Array.from(String(text).replace(/[\p{Cc}\p{Cf}]/gu, ' ').trim()).slice(0, INBOX_MAX_TEXT).join('').trim()
}

/** NFKC, lower case, accents folded (and the ligatures oe and ae and the sharp s), punctuation and whitespace collapsed. */
export function normalizeQuestion(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/œ/gu, 'oe')
    .replace(/æ/gu, 'ae')
    .replace(/ß/gu, 'ss')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u
const isIso = (v: unknown): v is string => typeof v === 'string' && ISO_Z.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString() === v
const isRoute = (v: unknown): v is InboxRoute => v === 'creation' || v === 'legacy'
const MAX_COUNT = 1_000_000

/** A stored record that still has the contract's shape, or null. */
function valid(q: unknown): InboxQuestion | null {
  if (q === null || typeof q !== 'object') return null
  const r = q as Record<string, unknown>
  if (typeof r.text !== 'string' || !isIso(r.firstSeen) || !isIso(r.lastSeen) || !isRoute(r.route)) return null
  if (typeof r.count !== 'number' || !Number.isSafeInteger(r.count) || r.count < 1 || r.count > MAX_COUNT) return null
  const text = cleanQuestion(r.text)
  if (text === '' || normalizeQuestion(text) === '' || r.firstSeen > r.lastSeen) return null
  return { text, firstSeen: r.firstSeen, lastSeen: r.lastSeen, count: r.count, route: r.route }
}

/** The inbox over an injected storage and clock. The storage is read at every call: another tab's changes are not overwritten from a stale copy. */
export function createInbox(deps: { storage: InboxStorage | null; now: () => Date }): Inbox {
  const { storage, now } = deps

  const load = (): InboxQuestion[] => {
    try {
      if (storage === null) return []
      const raw = storage.getItem(INBOX_STORAGE_KEY)
      if (raw === null) return []
      const data = JSON.parse(raw) as { version?: unknown; questions?: unknown }
      if (data === null || typeof data !== 'object' || data.version !== 1 || !Array.isArray(data.questions)) return []
      const out: InboxQuestion[] = []
      const seen = new Set<string>()
      for (const q of data.questions) {
        const v = valid(q)
        if (v === null) continue
        const k = normalizeQuestion(v.text)
        if (seen.has(k)) continue
        seen.add(k)
        out.push(v)
      }
      return out
    } catch {
      return []
    }
  }

  const stamp = (): string => {
    const t = now()
    return Number.isNaN(t.getTime()) ? new Date(0).toISOString() : t.toISOString()
  }

  return {
    record(text, route) {
      try {
        if (storage === null || !isRoute(route) || typeof text !== 'string') return false
        const clean = cleanQuestion(text)
        const key = normalizeQuestion(clean)
        if (key === '') return false
        const at = stamp()
        const list = load()
        const found = list.find((q) => normalizeQuestion(q.text) === key)
        if (found !== undefined) {
          found.count = Math.min(found.count + 1, MAX_COUNT)
          if (at > found.lastSeen) found.lastSeen = at
          if (at < found.firstSeen) found.firstSeen = at
        } else {
          list.push({ text: clean, firstSeen: at, lastSeen: at, count: 1, route })
        }
        while (list.length > INBOX_CAP) {
          let oldest = 0
          for (let i = 1; i < list.length; i++) if (list[i].lastSeen < list[oldest].lastSeen) oldest = i
          list.splice(oldest, 1)
        }
        storage.setItem(INBOX_STORAGE_KEY, JSON.stringify({ version: 1, questions: list }))
        return true
      } catch {
        return false
      }
    },
    export() {
      const out: InboxExport = { version: 1, exportedAt: stamp(), questions: load() }
      return JSON.stringify(out)
    },
    clear() {
      try {
        storage?.removeItem(INBOX_STORAGE_KEY)
      } catch {
        // nothing to remove it from
      }
    },
    size: () => load().length,
  }
}

// ── the page: one inbox per mounted guide, set by installInbox ─────────────────────────────────────────────────────────

let active: { inbox: Inbox; route: InboxRoute; win: Window } | null = null

const allowed = (win: Window, route: InboxRoute): boolean => {
  try {
    return FEATURES.guideInbox === true && guideRouteAllowed(win.location.search, route) && guideMode(win.location.search, route) === 'practice'
  } catch {
    return false
  }
}

/**
 * Called once after the guide mounted (src/guide/index.ts), only with the flag on. Defines `window.__oscarQuestions` and arms the recorder. Does nothing
 * unless the flag is on and the address is a practice one; never throws.
 */
export function installInbox(win: Window, route: InboxRoute, storage: InboxStorage | null, now: () => Date = () => new Date()): void {
  try {
    if (!allowed(win, route)) return
    const inbox = createInbox({ storage, now })
    active = { inbox, route, win }
    Object.defineProperty(win, '__oscarQuestions', { value: Object.freeze({ export: () => inbox.export(), clear: () => inbox.clear() }), configurable: true, enumerable: false, writable: false })
  } catch {
    active = null
  }
}

/**
 * The reply of a question with no answer. The fixed refusal comes first and unchanged; when the question was kept (flag on, practice, storage available),
 * one calm line follows it. Anything else is the reply as it came.
 */
export function recordUnanswered(question: string, base: BrainReply): BrainReply {
  try {
    if (active === null || !allowed(active.win, active.route)) return base
    if (!active.inbox.record(question, active.route)) return base
    const lines = base.lines.length > 0 ? base.lines : [{ text: base.text, badge: null, citation: null }]
    return { ...base, lines: [...lines, { text: INBOX_NOTED_A_VALIDER, badge: null, citation: null }] }
  } catch {
    return base
  }
}

/** For tests: forgets the installed inbox. */
export function resetInboxForTests(): void {
  active = null
}
