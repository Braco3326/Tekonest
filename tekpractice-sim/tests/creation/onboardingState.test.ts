/**
 * Onboarding state machine (plan T2.1, spec 4.1 and 4.4): pure, no DOM. Where the first visit starts, how each answer changes the stored record,
 * what a blocked or corrupt storage does. The browser behaviour (the start screen itself) is tests/e2e/onboarding-start.spec.ts.
 */
import { describe, expect, it } from 'vitest'
import {
  chipProfile,
  createOnboardingStore,
  entryStage,
  ONBOARDING_KEY,
  parseRecord,
  PROFILE_IDS,
  reduce,
  type OnboardingRecord,
  type StorageLike,
} from '../../src/creation/onboarding/state'

const fresh: OnboardingRecord = { v: 1, profile: null, offer: null, request: 0, shown: [] }

/** A Storage fake: a Map, with switches to make reads or writes throw (blocked storage, quota). */
function fakeStorage(opts: { failGet?: boolean; failSet?: boolean } = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem(k) {
      if (opts.failGet) throw new Error('SecurityError')
      return data.get(k) ?? null
    },
    setItem(k, v) {
      if (opts.failSet) throw new Error('QuotaExceededError')
      data.set(k, v)
    },
  }
}

describe('entryStage: where the first visit lands (spec 4.1, ruling R-B)', () => {
  const at = (record: OnboardingRecord | null, over: Partial<Parameters<typeof entryStage>[0]> = {}) =>
    entryStage({ design: true, tutorialAllowed: true, restored: false, record, ...over })
  it('a restored autosave opens the workspace, whatever the record says', () => {
    for (const record of [null, fresh, { ...fresh, profile: 'etudie' as const }])
      for (const design of [true, false]) expect(at(record, { design, restored: true })).toBe('workspace')
  })
  it('no ?design never yields the start screen or the offer: today\'s picker, with or without a record', () => {
    expect(at(null, { design: false })).toBe('picker')
    expect(at({ ...fresh, profile: 'metier' }, { design: false })).toBe('picker')
  })
  it('?design, no autosave, no record: the start screen', () => {
    expect(at(null)).toBe('start')
    expect(at(null, { tutorialAllowed: false })).toBe('start') // the profile choice is made, the offer is not (?oscar=0)
  })
  it('a profile with the offer not answered (a first visit on ?oscar=0): the OFFER on the next address where the tutorial is allowed, the picker where it is not', () => {
    const profileOnly = { ...fresh, profile: 'etudie' as const }
    expect(at(profileOnly)).toBe('offer')
    expect(at(profileOnly, { tutorialAllowed: false })).toBe('picker')
  })
  it('an answered offer (taken or skipped) or a record with no profile (only a Premiers pas request): the picker, the offer is not shown again', () => {
    expect(at({ ...fresh, profile: 'projet', offer: 'skipped' })).toBe('picker')
    expect(at({ ...fresh, profile: 'projet', offer: 'taken', request: 1 })).toBe('picker')
    expect(at({ ...fresh, request: 1 })).toBe('picker')
    expect(at(fresh)).toBe('picker')
  })
})

describe('reduce: every transition changes the record in one way (ruling R-B: the profile is written WITH the answer)', () => {
  it('« Faire le tutoriel »: the profile and the offer are written together and the request goes up by one', () => {
    expect(reduce(null, { type: 'answer', profile: 'decouvre', offer: 'taken' })).toEqual({ ...fresh, profile: 'decouvre', offer: 'taken', request: 1 })
    expect(reduce({ ...fresh, profile: 'decouvre', offer: 'taken', request: 1 }, { type: 'answer', profile: 'decouvre', offer: 'taken' }).request).toBe(2)
  })
  it('« Passer, je connais »: the profile and the offer are written together, the request is left alone', () => {
    expect(reduce(null, { type: 'answer', profile: 'etudie', offer: 'skipped' })).toEqual({ ...fresh, profile: 'etudie', offer: 'skipped', request: 0 })
  })
  it('a profile with no offer made (?oscar=0): only the profile is written, and an earlier offer answer is kept (never reset to « not asked »)', () => {
    expect(reduce(null, { type: 'answer', profile: 'projet', offer: null })).toEqual({ ...fresh, profile: 'projet' })
    const skipped: OnboardingRecord = { ...fresh, profile: 'etudie', offer: 'skipped' }
    expect(reduce(skipped, { type: 'answer', profile: 'metier', offer: null })).toEqual({ ...skipped, profile: 'metier' })
  })
  it('a new profile through the chip replaces the stored one and keeps the earlier count', () => {
    expect(reduce({ ...fresh, profile: 'decouvre', offer: 'taken', request: 2 }, { type: 'answer', profile: 'metier', offer: 'skipped' })).toEqual({ ...fresh, profile: 'metier', offer: 'skipped', request: 2 })
  })
  it('Aide « Premiers pas » raises the request by one and keeps the answer (skip never re-nags, but the learner may ask again)', () => {
    const skipped: OnboardingRecord = { ...fresh, profile: 'etudie', offer: 'skipped' }
    expect(reduce(skipped, { type: 'request' })).toEqual({ ...skipped, request: 1 })
    expect(reduce(null, { type: 'request' }).request).toBe(1) // asked before any profile: a record is made
  })
  it('does not mutate its input', () => {
    const frozen = Object.freeze({ ...fresh, shown: Object.freeze([]) as never })
    expect(() => reduce(frozen, { type: 'answer', profile: 'decouvre', offer: 'taken' })).not.toThrow()
    expect(frozen.request).toBe(0)
  })
})

describe('parseRecord: a corrupt record is not a record', () => {
  it('accepts every well-formed record', () => {
    for (const profile of [null, ...PROFILE_IDS])
      for (const offer of [null, 'taken', 'skipped'] as const) {
        const r = { v: 1, profile, offer, request: 3, shown: ['console', 'micro'] }
        expect(parseRecord(JSON.stringify(r))).toEqual(r)
      }
  })
  it.each([
    ['null', null],
    ['empty', ''],
    ['not json', '{profile'],
    ['an array', '[]'],
    ['json null', 'null'],
    ['a number', '3'],
    ['wrong version', JSON.stringify({ ...fresh, v: 2 })],
    ['no version', JSON.stringify({ profile: null, offer: null, request: 0, shown: [] })],
    ['unknown profile', JSON.stringify({ ...fresh, profile: 'expert' })],
    ['unknown offer', JSON.stringify({ ...fresh, offer: 'maybe' })],
    ['negative request', JSON.stringify({ ...fresh, request: -1 })],
    ['fractional request', JSON.stringify({ ...fresh, request: 1.5 })],
    ['string request', JSON.stringify({ ...fresh, request: '1' })],
    ['unsafe request', JSON.stringify({ ...fresh, request: 1e300 })],
    ['shown not an array', JSON.stringify({ ...fresh, shown: 'console' })],
    ['shown with a non-string', JSON.stringify({ ...fresh, shown: ['console', 4] })],
    ['missing field', JSON.stringify({ v: 1, profile: null, offer: null, request: 0 })],
  ])('%s -> null', (_name, raw) => {
    expect(parseRecord(raw)).toBeNull()
  })
})

describe('createOnboardingStore: storage, memory fallback, replacement of a corrupt record', () => {
  it('starts empty on a fresh storage and writes the record under the pinned key on each answer', () => {
    const st = fakeStorage()
    const s = createOnboardingStore(st)
    expect(ONBOARDING_KEY).toBe('audio-sim/creation-onboarding.v1')
    expect(s.read()).toBeNull()
    expect(st.data.size).toBe(0) // nothing is written before an answer
    expect(s.dispatch({ type: 'answer', profile: 'projet', offer: null })).toEqual({ ...fresh, profile: 'projet' })
    expect(JSON.parse(st.data.get(ONBOARDING_KEY)!)).toEqual({ ...fresh, profile: 'projet' })
    s.dispatch({ type: 'answer', profile: 'projet', offer: 'taken' })
    expect(JSON.parse(st.data.get(ONBOARDING_KEY)!)).toEqual({ ...fresh, profile: 'projet', offer: 'taken', request: 1 })
    expect(s.blocked).toBe(false)
  })
  it('resume: a new store over the same storage reads the answer back, so the offer is not shown again', () => {
    const st = fakeStorage()
    createOnboardingStore(st).dispatch({ type: 'answer', profile: 'etudie', offer: 'skipped' })
    const b = createOnboardingStore(st)
    expect(b.read()).toEqual({ ...fresh, profile: 'etudie', offer: 'skipped' })
    expect(entryStage({ design: true, tutorialAllowed: true, restored: false, record: b.read() })).toBe('picker')
  })
  it('« request » counts across reloads: the third ask is 3', () => {
    const st = fakeStorage()
    for (let i = 1; i <= 3; i++) expect(createOnboardingStore(st).dispatch({ type: 'request' }).request).toBe(i)
  })
  it('a corrupt record reads as none, and the next answer replaces it with a valid one', () => {
    const st = fakeStorage()
    st.data.set(ONBOARDING_KEY, '{"v":1,"profile":"expert"')
    const s = createOnboardingStore(st)
    expect(s.read()).toBeNull()
    expect(entryStage({ design: true, tutorialAllowed: true, restored: false, record: s.read() })).toBe('start')
    s.dispatch({ type: 'answer', profile: 'metier', offer: 'skipped' })
    expect(parseRecord(st.data.get(ONBOARDING_KEY)!)).toEqual({ ...fresh, profile: 'metier', offer: 'skipped' })
  })
  it('blocked storage (reads throw): works in memory, says so, and the start screen shows (no record survives a reload)', () => {
    const s = createOnboardingStore(fakeStorage({ failGet: true, failSet: true }))
    expect(s.blocked).toBe(true)
    expect(s.read()).toBeNull()
    expect(s.dispatch({ type: 'answer', profile: 'decouvre', offer: 'taken' }).request).toBe(1)
    expect(s.read()).toEqual({ ...fresh, profile: 'decouvre', offer: 'taken', request: 1 })
  })
  it('no storage object at all (window.localStorage itself threw): the same in-memory behaviour', () => {
    const s = createOnboardingStore(null)
    expect(s.blocked).toBe(true)
    expect(s.dispatch({ type: 'request' }).request).toBe(1)
    expect(s.dispatch({ type: 'request' }).request).toBe(2)
  })
  it('writes that throw (quota) keep the in-memory record for the page\'s life and flag the store blocked', () => {
    const s = createOnboardingStore(fakeStorage({ failSet: true }))
    expect(s.blocked).toBe(false) // reads work
    s.dispatch({ type: 'answer', profile: 'etudie', offer: null })
    expect(s.blocked).toBe(true)
    expect(s.read()?.profile).toBe('etudie')
  })
})

describe('chipProfile: the chip « Profil : X · changer » (T2.4b)', () => {
  it('is the stored profile, under ?design only, once a profile was chosen (the offer answer does not matter)', () => {
    expect(chipProfile({ design: true, record: { ...fresh, profile: 'etudie' } })).toBe('etudie')
    expect(chipProfile({ design: true, record: { ...fresh, profile: 'projet', offer: 'taken', request: 2 } })).toBe('projet')
  })
  it('is null (the chip then says « Choisir un profil ») without a record or a stored profile; null without ?design (no chip at all)', () => {
    expect(chipProfile({ design: false, record: { ...fresh, profile: 'etudie' } })).toBeNull()
    expect(chipProfile({ design: true, record: null })).toBeNull()
    expect(chipProfile({ design: true, record: fresh })).toBeNull()
  })
})
