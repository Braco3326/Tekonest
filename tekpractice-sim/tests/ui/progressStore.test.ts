import { describe, expect, it } from 'vitest'
import {
  EXAM_CAP,
  LocalStorageProgressStore,
  MISTAKE_CAP,
  PROGRESS_VERSION,
  type StorageLike,
} from '../../src/ui/ProgressStore'

const fakeStorage = (initial: Record<string, string> = {}): StorageLike & { dump(): Record<string, string> } => {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  }
}

describe('LocalStorageProgressStore', () => {
  it('fresh storage → empty data, no reset notice', () => {
    const store = new LocalStorageProgressStore(fakeStorage())
    expect(store.load()).toEqual({
      data: { version: PROGRESS_VERSION, levels: {}, activity: [], exams: [] },
      wasReset: false,
    })
  })

  it('v1 payload MIGRATES to v2 (no reset — history is precious, ADR-0003)', () => {
    const storage = fakeStorage({
      'audio-sim/progress': JSON.stringify({
        version: 1,
        levels: { a1: { completedAt: '2026-07-01T10:00:00Z', mistakes: [{ ruleId: 'R2', at: 'x' }] } },
      }),
    })
    const { data, wasReset } = new LocalStorageProgressStore(storage).load()
    expect(wasReset).toBe(false)
    expect(data.version).toBe(PROGRESS_VERSION)
    expect(data.levels.a1).toEqual({
      completedAt: '2026-07-01T10:00:00Z',
      wins: 1,
      mistakes: [{ ruleId: 'R2', at: 'x' }],
    })
    expect(data.activity).toEqual([])
  })

  it('recordWin counts wins and touches the activity day', () => {
    const store = new LocalStorageProgressStore(fakeStorage())
    store.recordWin('a1')
    const data = store.recordWin('a1')
    expect(data.levels.a1?.wins).toBe(2)
    expect(data.levels.a1?.completedAt).toBeTruthy()
    expect(data.activity).toHaveLength(1)
    expect(data.activity[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('save/load roundtrip', () => {
    const store = new LocalStorageProgressStore(fakeStorage())
    store.markCompleted('a1')
    const { data } = store.load()
    expect(data.levels.a1?.completedAt).toBeTruthy()
  })

  it('version mismatch → reset + notice (CLAUDE.md)', () => {
    const storage = fakeStorage({
      'audio-sim/progress': JSON.stringify({ version: 99, levels: { a1: { mistakes: [] } } }), // 3 = earlier local draft, read as v2
    })
    const { data, wasReset } = new LocalStorageProgressStore(storage).load()
    expect(wasReset).toBe(true)
    expect(data.levels).toEqual({})
    expect(storage.dump()).toEqual({}) // stale payload discarded
  })

  it('corrupt JSON → reset + notice', () => {
    const storage = fakeStorage({ 'audio-sim/progress': '{not json' })
    expect(new LocalStorageProgressStore(storage).load().wasReset).toBe(true)
  })

  it('recordMistake appends to the level history (dashboard fuel)', () => {
    const store = new LocalStorageProgressStore(fakeStorage())
    store.recordMistake('a1', 'R2')
    const data = store.recordMistake('a1', 'R2')
    expect(data.levels.a1?.mistakes.map((m) => m.ruleId)).toEqual(['R2', 'R2'])
    expect(data.levels.a1?.mistakes[0]?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it(`caps the mistake history at ${MISTAKE_CAP} (bounded payload, keeps the most recent)`, () => {
    const store = new LocalStorageProgressStore(fakeStorage())
    let data
    for (let i = 0; i < MISTAKE_CAP + 20; i++) data = store.recordMistake('a1', `R${(i % 8) + 1}`)
    expect(data!.levels.a1?.mistakes.length).toBe(MISTAKE_CAP)
    // the LAST recorded mistake survives (slice keeps the tail)
    expect(data!.levels.a1?.mistakes.at(-1)?.ruleId).toBe(`R${((MISTAKE_CAP + 19) % 8) + 1}`)
  })

  it('a write failure (quota/blocked storage) degrades gracefully — no throw', () => {
    const throwing: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('QuotaExceededError')
      },
      removeItem: () => undefined,
    }
    const store = new LocalStorageProgressStore(throwing)
    expect(() => store.recordWin('a1')).not.toThrow()
    expect(() => store.recordMistake('a1', 'R2')).not.toThrow()
  })

  it('the version is NOT bumped: exams is an optional v2 field (old builds reset unknown versions)', () => {
    expect(PROGRESS_VERSION).toBe(2)
    const v2 = {
      version: 2,
      levels: {
        a1: { completedAt: '2026-07-01T10:00:00Z', wins: 3, mistakes: [{ ruleId: 'R2', at: '2026-07-01T09:00:00Z' }] },
        sandbox: { wins: 1, mistakes: [] },
      },
      activity: ['2026-07-01', '2026-07-02'],
    }
    const storage = fakeStorage({ 'audio-sim/progress': JSON.stringify(v2) })
    const { data, wasReset } = new LocalStorageProgressStore(storage).load()
    expect(wasReset).toBe(false)
    expect(data).toEqual({ ...v2, exams: [] })
    // an exam is saved INSIDE the v2 object, everything else kept
    new LocalStorageProgressStore(storage).recordExam('a1', 12, new Date('2026-10-24T10:00:00Z'))
    const saved = JSON.parse(storage.dump()['audio-sim/progress']!)
    expect(saved.version).toBe(2)
    expect(saved.levels).toEqual(v2.levels)
    expect(saved.exams).toEqual([{ levelId: 'a1', score20: 12, at: '2026-10-24T10:00:00.000Z' }])
  })

  it('an OLD v2 build (pre-exams code) re-saving the payload keeps exams', () => {
    const storage = fakeStorage()
    new LocalStorageProgressStore(storage).recordExam('a1', 15, new Date('2026-10-24T10:00:00Z'))
    // The deployed v2 code, verbatim in behaviour: load = JSON.parse (version 2
    // accepted, `activity ??= []`), mutate in place, save = JSON.stringify(data).
    const oldBuildRecordMistake = (levelId: string, ruleId: string): void => {
      const parsed = JSON.parse(storage.getItem('audio-sim/progress')!)
      if (parsed.version !== 2) throw new Error('old build would reset here')
      parsed.activity ??= []
      const level = (parsed.levels[levelId] ??= { wins: 0, mistakes: [] })
      level.mistakes.push({ ruleId, at: '2026-10-25T08:00:00.000Z' })
      storage.setItem('audio-sim/progress', JSON.stringify(parsed))
    }
    oldBuildRecordMistake('a1', 'R2')
    const { data, wasReset } = new LocalStorageProgressStore(storage).load()
    expect(wasReset).toBe(false)
    expect(data.exams).toEqual([{ levelId: 'a1', score20: 15, at: '2026-10-24T10:00:00.000Z' }])
    expect(data.levels.a1?.mistakes.map((m) => m.ruleId)).toEqual(['R2'])
  })

  it('a version-3 payload from an earlier local draft is read as v2 + exams and rewritten as v2', () => {
    const exams = [{ levelId: 'a1', score20: 9, at: '2026-10-24T10:00:00.000Z' }]
    const storage = fakeStorage({
      'audio-sim/progress': JSON.stringify({ version: 3, levels: { a1: { wins: 1, mistakes: [] } }, activity: ['2026-10-24'], exams }),
    })
    const { data, wasReset } = new LocalStorageProgressStore(storage).load()
    expect(wasReset).toBe(false)
    expect(data).toEqual({ version: 2, levels: { a1: { wins: 1, mistakes: [] } }, activity: ['2026-10-24'], exams })
    expect(JSON.parse(storage.dump()['audio-sim/progress']!).version).toBe(2)
  })

  it('v1 payload migrates to v2 with exams = []', () => {
    const storage = fakeStorage({
      'audio-sim/progress': JSON.stringify({ version: 1, levels: { a1: { completedAt: '2026-07-01T10:00:00Z', mistakes: [] } } }),
    })
    const { data } = new LocalStorageProgressStore(storage).load()
    expect(data).toEqual({
      version: 2,
      levels: { a1: { completedAt: '2026-07-01T10:00:00Z', wins: 1, mistakes: [] } },
      activity: [],
      exams: [],
    })
  })

  it('recordExam stores { levelId, score20, at } and touches the activity day', () => {
    const store = new LocalStorageProgressStore(fakeStorage())
    const data = store.recordExam('a1', 14.5, new Date('2026-10-24T10:00:00Z'))
    expect(data.exams).toEqual([{ levelId: 'a1', score20: 14.5, at: '2026-10-24T10:00:00.000Z' }])
    expect(data.activity).toHaveLength(1)
    expect(store.load().data.exams).toEqual(data.exams) // persisted
  })

  it(`caps the exam history at ${EXAM_CAP} (keeps the most recent)`, () => {
    const store = new LocalStorageProgressStore(fakeStorage())
    let data
    for (let i = 0; i < EXAM_CAP + 7; i++) data = store.recordExam('a1', i % 21, new Date(Date.UTC(2026, 0, 1, 0, i)))
    expect(data!.exams).toHaveLength(EXAM_CAP)
    expect(data!.exams.at(-1)?.score20).toBe((EXAM_CAP + 6) % 21)
    expect(data!.exams[0]?.at).toBe(new Date(Date.UTC(2026, 0, 1, 0, 7)).toISOString())
  })

  it('recordExam ignores a score that is not a finite /20 value (nothing written)', () => {
    const storage = fakeStorage()
    const store = new LocalStorageProgressStore(storage)
    expect(store.recordExam('a1', Number.NaN).exams).toEqual([])
    expect(store.recordExam('a1', 21).exams).toEqual([])
    expect(store.recordExam('a1', -1).exams).toEqual([])
    expect(storage.dump()).toEqual({})
  })

  it('a v2 payload with a non-array exams (hand-edited) loads with exams = []', () => {
    const storage = fakeStorage({ 'audio-sim/progress': JSON.stringify({ version: 2, levels: {}, activity: [], exams: 'x' }) })
    expect(new LocalStorageProgressStore(storage).load().data.exams).toEqual([])
  })

  it('markCompleted is idempotent (first completion date wins)', () => {
    const store = new LocalStorageProgressStore(fakeStorage())
    const first = store.markCompleted('a1').levels.a1?.completedAt
    const second = store.markCompleted('a1').levels.a1?.completedAt
    expect(second).toBe(first)
  })
})
