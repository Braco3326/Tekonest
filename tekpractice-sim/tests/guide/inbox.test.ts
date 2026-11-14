// The unanswered-questions inbox, app side: dark by default; with the flag on it keeps only what the export contract holds, in this browser.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FEATURES } from '../../src/features'
import { createTekPracticeBrain } from '../../src/guide/brain'
import type { TpBridge } from '../../src/guide/bridge/types'
import {
  INBOX_CAP,
  INBOX_NOTED_A_VALIDER,
  INBOX_STORAGE_KEY,
  cleanQuestion,
  createInbox,
  installInbox,
  normalizeQuestion,
  recordUnanswered,
  resetInboxForTests,
  type InboxStorage,
} from '../../src/guide/inbox'
import { TP_STRINGS } from '../../src/guide/strings'
import type { BrainReply } from '../../src/guide/vendor/core/brain'

const ROOT = join(__dirname, '..', '..')

function memoryStorage(initial: Record<string, string> = {}): InboxStorage & { data: Map<string, string>; writes: number } {
  const data = new Map(Object.entries(initial))
  const s = {
    data,
    writes: 0,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      s.writes++
      data.set(k, v)
    },
    removeItem: (k: string) => void data.delete(k),
  }
  return s
}
const clock = (start = '2026-11-14T10:00:00.000Z') => {
  let t = Date.parse(start)
  return { now: () => new Date(t), tick: (ms = 1000) => void (t += ms) }
}
const winAt = (search: string): Window => ({ location: { search } }) as unknown as Window
const withFlag = (on: boolean, fn: () => void | Promise<void>) => async () => {
  const before = FEATURES.guideInbox
  FEATURES.guideInbox = on
  try {
    await fn()
  } finally {
    FEATURES.guideInbox = before
  }
}

beforeEach(() => {
  resetInboxForTests()
})
afterEach(() => {
  resetInboxForTests()
  delete (globalThis as { window?: unknown }).window
})

describe('the flag', () => {
  it('ships off', () => {
    expect(FEATURES.guideInbox).toBe(false)
  })
})

describe('text', () => {
  it('turns control characters into spaces, trims, and cuts at 200 characters', () => {
    expect(cleanQuestion('  pourquoi\u0007 le larsen​?\n ')).toBe('pourquoi  le larsen ?')
    expect(Array.from(cleanQuestion('é'.repeat(300))).length).toBe(200)
    expect(cleanQuestion('😀'.repeat(250))).toBe('😀'.repeat(200))
  })

  it('normalises with the rules of the export file: NFKC, lower case, accents folded including oe ae and the sharp s, punctuation and spaces collapsed', () => {
    expect(normalizeQuestion('  Pourquoi, le LARSEN ?? ')).toBe('pourquoi le larsen')
    expect(normalizeQuestion('Cœur de l’Æther Straße')).toBe('coeur de l aether strasse')
    expect(normalizeQuestion('ＡＢＣ ﬁn')).toBe('abc fin')
    expect(normalizeQuestion('Écoute — écoute')).toBe('ecoute ecoute')
    expect(normalizeQuestion('???')).toBe('')
  })
})

describe('createInbox', () => {
  it('keeps a question once with its dates, count and route, and merges the same question however it is written', () => {
    const c = clock()
    const s = memoryStorage()
    const inbox = createInbox({ storage: s, now: c.now })
    expect(inbox.record('Pourquoi le larsen ?', 'creation')).toBe(true)
    c.tick(5000)
    expect(inbox.record('  pourquoi LE larsen', 'creation')).toBe(true)
    c.tick(5000)
    expect(inbox.record('Qu’est-ce qu’un DI ?', 'legacy')).toBe(true)
    const out = JSON.parse(inbox.export())
    expect(out.questions).toEqual([
      { text: 'Pourquoi le larsen ?', firstSeen: '2026-11-14T10:00:00.000Z', lastSeen: '2026-11-14T10:00:05.000Z', count: 2, route: 'creation' },
      { text: 'Qu’est-ce qu’un DI ?', firstSeen: '2026-11-14T10:00:10.000Z', lastSeen: '2026-11-14T10:00:10.000Z', count: 1, route: 'legacy' },
    ])
  })

  it('the export has exactly the contract: version 1, an ISO exportedAt, and per question only text, firstSeen, lastSeen, count, route', () => {
    const c = clock()
    const inbox = createInbox({ storage: memoryStorage(), now: c.now })
    inbox.record('une question', 'creation')
    c.tick()
    const out = JSON.parse(inbox.export()) as Record<string, unknown>
    expect(Object.keys(out).sort()).toEqual(['exportedAt', 'questions', 'version'])
    expect(out.version).toBe(1)
    expect(out.exportedAt).toBe('2026-11-14T10:00:01.000Z')
    for (const q of out.questions as Record<string, unknown>[]) {
      expect(Object.keys(q).sort()).toEqual(['count', 'firstSeen', 'lastSeen', 'route', 'text'])
      expect(new Date(q.firstSeen as string).toISOString()).toBe(q.firstSeen)
      expect(new Date(q.lastSeen as string).toISOString()).toBe(q.lastSeen)
      expect(['creation', 'legacy']).toContain(q.route)
      expect(Number.isInteger(q.count) && (q.count as number) >= 1).toBe(true)
      expect(Array.from(q.text as string).length).toBeLessThanOrEqual(200)
      expect(/[\p{Cc}\p{Cf}]/u.test(q.text as string)).toBe(false)
    }
  })

  it('an empty export is a valid file', () => {
    const out = JSON.parse(createInbox({ storage: memoryStorage(), now: clock().now }).export())
    expect(out).toEqual({ version: 1, exportedAt: '2026-11-14T10:00:00.000Z', questions: [] })
  })

  it('keeps nothing for a text with no letter or digit, an unknown route, or no storage; and never throws', () => {
    const s = memoryStorage()
    const inbox = createInbox({ storage: s, now: clock().now })
    expect(inbox.record('???', 'creation')).toBe(false)
    expect(inbox.record('   ', 'creation')).toBe(false)
    expect(inbox.record('ok', 'exam' as never)).toBe(false)
    expect(inbox.record(42 as never, 'creation')).toBe(false)
    expect(s.writes).toBe(0)
    expect(s.data.size).toBe(0)
    const none = createInbox({ storage: null, now: clock().now })
    expect(none.record('une question', 'creation')).toBe(false)
    expect(JSON.parse(none.export()).questions).toEqual([])
    const broken: InboxStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    const b = createInbox({ storage: broken, now: clock().now })
    expect(b.record('une question', 'creation')).toBe(false)
    expect(() => b.export()).not.toThrow()
    expect(() => b.clear()).not.toThrow()
  })

  it('keeps at most 200 questions, dropping the one asked least recently', () => {
    const c = clock()
    const inbox = createInbox({ storage: memoryStorage(), now: c.now })
    for (let i = 0; i < INBOX_CAP; i++) {
      inbox.record(`question numéro ${i}`, 'creation')
      c.tick()
    }
    inbox.record('question numéro 0', 'creation') // asked again: no longer the oldest
    c.tick()
    inbox.record('une toute nouvelle question', 'legacy')
    const texts = (JSON.parse(inbox.export()).questions as { text: string }[]).map((q) => q.text)
    expect(texts).toHaveLength(INBOX_CAP)
    expect(texts).toContain('question numéro 0')
    expect(texts).toContain('une toute nouvelle question')
    expect(texts).not.toContain('question numéro 1')
  })

  it('a stored list that is damaged, or of another version, is ignored; a bad record is dropped and the good ones stay', () => {
    for (const raw of ['not json', '{"version":2,"questions":[]}', '{"version":1,"questions":"x"}', 'null', '[]']) {
      const inbox = createInbox({ storage: memoryStorage({ [INBOX_STORAGE_KEY]: raw }), now: clock().now })
      expect(JSON.parse(inbox.export()).questions).toEqual([])
      expect(inbox.record('une question', 'creation')).toBe(true)
    }
    const good = { text: 'bonne question', firstSeen: '2026-11-14T09:00:00.000Z', lastSeen: '2026-11-14T09:00:00.000Z', count: 3, route: 'legacy' }
    const stored = JSON.stringify({ version: 1, questions: [good, { ...good, route: 'exam', text: 'examen' }, { ...good, count: 0, text: 'zéro' }, { ...good, firstSeen: 'hier', text: 'date' }, { ...good, text: 'Bonne  question!' }] })
    const inbox = createInbox({ storage: memoryStorage({ [INBOX_STORAGE_KEY]: stored }), now: clock().now })
    expect(JSON.parse(inbox.export()).questions).toEqual([good])
  })

  it('clear forgets everything and removes the storage key', () => {
    const s = memoryStorage()
    const inbox = createInbox({ storage: s, now: clock().now })
    inbox.record('une question', 'creation')
    expect(s.data.has(INBOX_STORAGE_KEY)).toBe(true)
    inbox.clear()
    expect(s.data.has(INBOX_STORAGE_KEY)).toBe(false)
    expect(inbox.size()).toBe(0)
  })

  it('holds nothing but the contract in storage: no extra field, no page, no mode', () => {
    const s = memoryStorage()
    createInbox({ storage: s, now: clock().now }).record('une question', 'creation')
    const stored = JSON.parse(s.data.get(INBOX_STORAGE_KEY)!)
    expect(Object.keys(stored).sort()).toEqual(['questions', 'version'])
    expect(Object.keys(stored.questions[0]).sort()).toEqual(['count', 'firstSeen', 'lastSeen', 'route', 'text'])
    expect([...s.data.keys()]).toEqual([INBOX_STORAGE_KEY])
  })
})

describe('installInbox: the global and the recorder exist only with the flag on, in practice mode', () => {
  const tryInstall = (search: string, route: 'creation' | 'legacy' = 'creation') => {
    const w = winAt(search)
    const s = memoryStorage()
    installInbox(w, route, s, clock().now)
    return { w: w as Window & { __oscarQuestions?: { export(): string; clear(): void } }, s }
  }

  it('flag off: no global, and nothing is recorded', () => {
    const { w, s } = tryInstall('')
    expect(w.__oscarQuestions).toBeUndefined()
    const base: BrainReply = { kind: 'refusal', text: 'x', lines: [], verdict: null }
    expect(recordUnanswered('une question', base)).toBe(base)
    expect(s.writes).toBe(0)
  })

  it('flag on, Mode Création and a practice level page: the global is defined', async () => {
    await withFlag(true, () => {
      const a = tryInstall('')
      expect(Object.keys(a.w.__oscarQuestions!).sort()).toEqual(['clear', 'export'])
      expect(JSON.parse(a.w.__oscarQuestions!.export()).version).toBe(1)
      const b = tryInstall('?level=a1&oscar=legacy', 'legacy')
      expect(b.w.__oscarQuestions).toBeDefined()
    })()
  })

  it.each([
    ['?oscar=0', 'creation'],
    ['?mode=exam', 'creation'],
    ['?level=a1', 'creation'],
    ['?level=a1&mode=exam&oscar=legacy', 'legacy'],
    ['?level=sandbox&oscar=legacy', 'legacy'],
    ['?level=a1&oscar=0', 'legacy'],
    ['?legacy=1', 'legacy'],
  ] as const)('flag on but %s (%s): no global and nothing recorded', async (search, route) => {
    await withFlag(true, () => {
      const { w, s } = tryInstall(search, route)
      expect(w.__oscarQuestions).toBeUndefined()
      const base: BrainReply = { kind: 'refusal', text: 'x', lines: [], verdict: null }
      expect(recordUnanswered('une question', base)).toBe(base)
      expect(s.writes).toBe(0)
      expect(s.data.size).toBe(0)
    })()
  })
})

// ── the brain: where the fixed sentence is returned ──────────────────────────────────────────────────────────────────

const bridge = (): TpBridge => ({
  snapshot: vi.fn(() => null),
  rectOf: vi.fn(() => null),
  anchorOfPort: vi.fn(() => ''),
  anchorOfDevice: vi.fn(() => ''),
  anchorOfControl: vi.fn(() => ''),
  onChange: vi.fn(() => () => undefined),
  destroy: vi.fn(),
})
const NO_INFO = "Je n'ai pas encore d'information sur ce point."
const OFF_TOPIC = 'quelle est la capitale de la Mongolie'

describe('the brain with the inbox', () => {
  const brain = (mode: () => 'practice' | 'exam' = () => 'practice') => createTekPracticeBrain({ bridge: bridge(), rules: [], mode })

  it('flag off: the refusal is the fixed sentence alone, as before, and nothing is stored', async () => {
    const s = memoryStorage()
    installInbox(winAt(''), 'creation', s, clock().now)
    const r = await brain().ask({ question: OFF_TOPIC, mode: 'practice' })
    expect(r).toEqual({ kind: 'refusal', text: NO_INFO, lines: [], verdict: null })
    expect(s.writes).toBe(0)
    expect(s.data.size).toBe(0)
  })

  it('flag on: the fixed sentence first and unchanged, then one calm line; the question is kept', async () => {
    await withFlag(true, async () => {
      const s = memoryStorage()
      installInbox(winAt(''), 'creation', s, clock().now)
      const r = await brain().ask({ question: OFF_TOPIC, mode: 'practice' })
      expect(r.kind).toBe('refusal')
      expect(r.text).toBe(NO_INFO)
      expect(r.lines.map((l) => l.text)).toEqual([NO_INFO, INBOX_NOTED_A_VALIDER])
      expect(r.lines.every((l) => l.badge === null && l.citation === null)).toBe(true)
      const kept = JSON.parse(s.data.get(INBOX_STORAGE_KEY)!).questions
      expect(kept).toHaveLength(1)
      expect(kept[0].text).toBe(OFF_TOPIC)
      expect(kept[0].route).toBe('creation')
      await brain().ask({ question: OFF_TOPIC.toUpperCase(), mode: 'practice' })
      expect(JSON.parse(s.data.get(INBOX_STORAGE_KEY)!).questions[0].count).toBe(2)
    })()
  })

  it('flag on, level page: the question is kept with the legacy route', async () => {
    await withFlag(true, async () => {
      const s = memoryStorage()
      installInbox(winAt('?level=a1&oscar=legacy'), 'legacy', s, clock().now)
      await brain().ask({ question: OFF_TOPIC, mode: 'practice' })
      expect(JSON.parse(s.data.get(INBOX_STORAGE_KEY)!).questions[0].route).toBe('legacy')
    })()
  })

  it('flag on but no storage: the fixed sentence alone, no extra line (the line says the question stays in this browser, so it is never shown when it was not kept)', async () => {
    await withFlag(true, async () => {
      installInbox(winAt(''), 'creation', null, clock().now)
      const r = await brain().ask({ question: OFF_TOPIC, mode: 'practice' })
      expect(r.lines).toEqual([])
      expect(r.text).toBe(NO_INFO)
    })()
  })

  it('an exam: withheld, nothing is read or kept, with the flag on', async () => {
    await withFlag(true, async () => {
      const s = memoryStorage()
      installInbox(winAt(''), 'creation', s, clock().now)
      const r = await brain(() => 'exam').ask({ question: OFF_TOPIC, mode: 'practice' })
      expect(r.kind).toBe('withheld')
      expect(r.text).toBe(TP_STRINGS.ask.examQuiet)
      const r2 = await brain().ask({ question: OFF_TOPIC, mode: 'exam' })
      expect(r2.kind).toBe('withheld')
      expect(s.writes).toBe(0)
    })()
  })

  it('an answered question is not kept', async () => {
    await withFlag(true, async () => {
      const s = memoryStorage()
      installInbox(winAt(''), 'creation', s, clock().now)
      const rules = [{ id: 'R9', title_fr: 'Alimentation fantôme manquante', teach_fr: 'Le micro statique réclame une alimentation fantôme.' }]
      const b = createTekPracticeBrain({ bridge: bridge(), rules: rules as never, mode: () => 'practice' })
      const r = await b.ask({ question: 'alimentation fantôme manquante', mode: 'practice' })
      expect(r.kind).toBe('answer')
      expect(s.writes).toBe(0)
    })()
  })
})

describe('the draft sentence', () => {
  it('is named with the suffix _A_VALIDER, calm and impersonal, and its text lives in src/guide/inbox.ts only', () => {
    expect(INBOX_NOTED_A_VALIDER).toBe('Cette question est notée pour améliorer l’aide ; elle reste dans ce navigateur.')
    const hits: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|css|json|html)$/.test(name) && readFileSync(p, 'utf8').includes('notée pour améliorer')) hits.push(relative(ROOT, p).split(sep).join('/'))
      }
    }
    walk(join(ROOT, 'src'))
    expect(hits).toEqual(['src/guide/inbox.ts'])
    expect(/(^|[^\p{L}])(je|j'|mon|ma|mes|nous)([^\p{L}]|$)/u.test(INBOX_NOTED_A_VALIDER.toLowerCase())).toBe(false)
  })
})

describe('no network, no other data', () => {
  it('the module names no network API and no other storage', () => {
    const src = readFileSync(join(ROOT, 'src', 'guide', 'inbox.ts'), 'utf8')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    for (const word of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'indexedDB', 'document.cookie', 'navigator.']) expect(code.includes(word), word).toBe(false)
  })
})
