/**
 * Onboarding state machine (plan T2.1, spec 4.1 and 4.4): pure, no DOM. Where the first visit starts, how each answer changes the stored record,
 * what a blocked or corrupt storage does. The browser behaviour (the start screen itself) is tests/e2e/onboarding-start.spec.ts.
 */
import { describe, expect, it } from 'vitest'
import {
  chipGoal,
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

describe('N3 (T3 close review): the kind of the last request is stored with it', () => {
  const base = { v: 1 as const, profile: 'decouvre' as const, offer: 'taken' as const, request: 1, shown: [] }
  it('restart and skip are written; a start (or an offer taken) removes the field; parseRecord takes a missing kind, refuses an unknown one', () => {
    expect(parseRecord(JSON.stringify({ ...base, kind: 'skip' }))).toEqual({ ...base, kind: 'skip' })
    expect(parseRecord(JSON.stringify({ ...base, kind: 'restart' }))).toEqual({ ...base, kind: 'restart' })
    expect(parseRecord(JSON.stringify(base))).toEqual(base)
    expect(parseRecord(JSON.stringify({ ...base, kind: 'start' }))).toBeNull() // never written: a start leaves no field
    expect(parseRecord(JSON.stringify({ ...base, kind: 'jump' }))).toBeNull()
    const store = createOnboardingStore(null)
    store.dispatch({ type: 'answer', profile: 'decouvre', offer: 'taken' })
    expect(store.dispatch({ type: 'request', kind: 'skip' })).toMatchObject({ request: 2, kind: 'skip' })
    expect(store.dispatch({ type: 'request' })).not.toHaveProperty('kind')
    store.dispatch({ type: 'request', kind: 'restart' })
    expect(store.dispatch({ type: 'answer', profile: 'etudie', offer: 'taken' })).not.toHaveProperty('kind')
  })
})

describe('two tabs on one storage (T6 review S4): a write reduces from what is STORED, so it never rolls the other tab back', () => {
  const rec = (o: Partial<OnboardingRecord>): string => JSON.stringify({ ...fresh, profile: 'projet', offer: 'skipped', ...o })
  it('tab B (opened at request 1) dismisses the card after tab A asked twice: the request counter is A’s (3), the dismissal is kept', () => {
    const st = fakeStorage()
    st.data.set(ONBOARDING_KEY, rec({ request: 1 }))
    const a = createOnboardingStore(st)
    const b = createOnboardingStore(st) // both read request 1
    a.dispatch({ type: 'request' })
    a.dispatch({ type: 'request' }) // storage now holds request 3
    b.dispatch({ type: 'ownGear', value: 'dismissed' })
    expect(JSON.parse(st.data.get(ONBOARDING_KEY)!)).toMatchObject({ request: 3, ownGear: 'dismissed', profile: 'projet' })
    expect(b.read()!.request, 'its memory follows what it wrote').toBe(3)
  })
  it('reverse: A asks after B dismissed: the dismissal is not lost and the counter goes on from the stored value', () => {
    const st = fakeStorage()
    st.data.set(ONBOARDING_KEY, rec({ request: 1 }))
    const a = createOnboardingStore(st)
    const b = createOnboardingStore(st)
    b.dispatch({ type: 'ownGear', value: 'dismissed' })
    a.dispatch({ type: 'request' })
    expect(JSON.parse(st.data.get(ONBOARDING_KEY)!)).toMatchObject({ request: 2, ownGear: 'dismissed' })
  })
  it('does not trigger: with nothing stored (cleared, or corrupt) it reduces from its own memory, as before', () => {
    const st = fakeStorage()
    const a = createOnboardingStore(st)
    a.dispatch({ type: 'answer', profile: 'etudie', offer: 'skipped' })
    st.data.delete(ONBOARDING_KEY)
    a.dispatch({ type: 'request' })
    expect(JSON.parse(st.data.get(ONBOARDING_KEY)!)).toMatchObject({ profile: 'etudie', request: 1 })
    st.data.set(ONBOARDING_KEY, '{not json')
    a.dispatch({ type: 'request' })
    expect(JSON.parse(st.data.get(ONBOARDING_KEY)!)).toMatchObject({ profile: 'etudie', request: 2 })
  })
  it('a storage that throws on read keeps the memory path (blocked), no crash', () => {
    const st = fakeStorage({ failGet: true })
    const a = createOnboardingStore(st)
    expect(a.blocked).toBe(true)
    expect(a.dispatch({ type: 'request' }).request).toBe(1)
  })
})

describe('the goal (mission 1, spec 3): an optional field, old records read unchanged', () => {
  const goal = { id: 'travaille.studio.mastering' }

  it('an answer with a goal writes the goal and the profile the goal maps to (the caller derives it), with the offer', () => {
    expect(reduce(null, { type: 'answer', profile: 'metier', offer: 'skipped', goal })).toEqual({ ...fresh, profile: 'metier', offer: 'skipped', goal })
    expect(reduce(null, { type: 'answer', profile: 'metier', offer: 'skipped', goal: { ...goal, extra: 1 } as typeof goal }).goal).toEqual(goal)
    expect(reduce(null, { type: 'answer', profile: 'metier', offer: 'taken', goal })).toEqual({ ...fresh, profile: 'metier', offer: 'taken', request: 1, goal })
  })

  it('« Passer » on the goal screens stores no goal and no profile: the record exists, so nothing is asked again', () => {
    const r = reduce(null, { type: 'answer', profile: null, offer: null, goal: null })
    expect(r).toEqual({ ...fresh, goal: null })
    expect(entryStage({ design: true, tutorialAllowed: true, restored: false, record: r })).toBe('picker')
    expect(entryStage({ design: true, tutorialAllowed: false, restored: false, record: r })).toBe('picker')
  })

  it('an answer without a goal (the four profiles) leaves a stored goal as it is; a new goal replaces it', () => {
    const withGoal = reduce(null, { type: 'answer', profile: 'metier', offer: 'skipped', goal })
    expect(reduce(withGoal, { type: 'answer', profile: 'etudie', offer: 'skipped' }).goal).toEqual(goal)
    const other = { id: 'etudie.bts-mav-son' }
    expect(reduce(withGoal, { type: 'answer', profile: 'etudie', offer: null, goal: other })).toEqual({ ...withGoal, profile: 'etudie', goal: other })
    expect(reduce(withGoal, { type: 'answer', profile: null, offer: null, goal: null }).goal).toBeNull()
  })

  it('parseRecord: a record with no goal field is read unchanged (no field added); null and a full path are kept', () => {
    const old = { v: 1, profile: 'etudie', offer: 'skipped', request: 2, shown: ['console'] }
    expect(parseRecord(JSON.stringify(old))).toEqual(old)
    expect('goal' in parseRecord(JSON.stringify(old))!).toBe(false)
    expect(parseRecord(JSON.stringify({ ...old, goal: null }))).toEqual({ ...old, goal: null })
    expect(parseRecord(JSON.stringify({ ...old, goal }))).toEqual({ ...old, goal })
    // the own-gear field and the kind still come through next to it
    expect(parseRecord(JSON.stringify({ ...old, goal, ownGear: 'dismissed', kind: 'skip' }))).toEqual({ ...old, goal, ownGear: 'dismissed', kind: 'skip' })
  })

  it.each([
    ['a string', 'metier'],
    ['a number', 3],
    ['an array', ['travaille', 'travaille.studio']],
    ['no id', { goal: 'travaille' }],
    ['an empty id', { id: '' }],
    ['a non-string id', { id: 4 }],
    ['an id that is not dotted words', { id: 'travaille..studio' }],
    ['an id with spaces', { id: 'Travaille studio' }],
  ])('parseRecord: a corrupt goal (%s) drops the whole record, as any corrupt field does', (_n, bad) => {
    expect(parseRecord(JSON.stringify({ ...fresh, goal: bad }))).toBeNull()
  })

  it('parseRecord keeps only the id of a goal (an extra key is not carried along: the record stays tiny)', () => {
    expect(parseRecord(JSON.stringify({ ...fresh, goal: { ...goal, extra: 1 } }))?.goal).toEqual(goal)
  })

  it('chipGoal: the stored goal under the onboarding only; null without one, or without a record, or without the onboarding', () => {
    const r = reduce(null, { type: 'answer', profile: 'metier', offer: 'skipped', goal })
    expect(chipGoal({ design: true, record: r })).toEqual(goal)
    expect(chipGoal({ design: false, record: r })).toBeNull()
    expect(chipGoal({ design: true, record: null })).toBeNull()
    expect(chipGoal({ design: true, record: { ...fresh, profile: 'etudie' } })).toBeNull()
  })

  it('the store writes the goal and reads it back over a reload', () => {
    const st = fakeStorage()
    createOnboardingStore(st).dispatch({ type: 'answer', profile: 'metier', offer: 'skipped', goal })
    expect(createOnboardingStore(st).read()?.goal).toEqual(goal)
  })
})

describe('the plain tutorial and the account prompt (mission 1, spec 4 and 5): two optional fields, old records read unchanged', () => {
  const old: OnboardingRecord = { v: 1, profile: 'decouvre', offer: 'taken', request: 1, shown: [] }
  it('a plainTutorial event writes { step, done } and keeps the rest of the record', () => {
    expect(reduce(old, { type: 'plainTutorial', step: 2, done: false })).toEqual({ ...old, plainTutorial: { step: 2, done: false } })
    expect(reduce(null, { type: 'plainTutorial', step: 4, done: true })).toEqual({ ...fresh, plainTutorial: { step: 4, done: true } })
  })
  it('an accountPrompt event remembers the dismissal', () => {
    expect(reduce(old, { type: 'accountPrompt', value: 'dismissed' })).toEqual({ ...old, accountPrompt: 'dismissed' })
  })
  it('parseRecord: a record without the fields reads unchanged (no field added); well-formed fields are kept', () => {
    expect(parseRecord(JSON.stringify(old))).toEqual(old)
    expect(parseRecord(JSON.stringify(old))).not.toHaveProperty('plainTutorial')
    const both = { ...old, plainTutorial: { step: 3, done: false }, accountPrompt: 'dismissed' }
    expect(parseRecord(JSON.stringify(both))).toEqual(both)
  })
  it('parseRecord: a malformed plainTutorial drops the record like any corrupt field; an unknown accountPrompt value is ignored', () => {
    for (const bad of [{ step: 0, done: false }, { step: 5, done: false }, { step: 1.5, done: false }, { step: '2', done: false }, { step: 2 }, { step: 2, done: 'no' }, null, [], 'x'])
      expect(parseRecord(JSON.stringify({ ...old, plainTutorial: bad })), JSON.stringify(bad)).toBeNull()
    expect(parseRecord(JSON.stringify({ ...old, accountPrompt: 'later' }))).toEqual(old)
  })
  it('parseRecord keeps only step and done (an extra key is not carried along)', () => {
    expect(parseRecord(JSON.stringify({ ...old, plainTutorial: { step: 2, done: true, extra: 1 } }))).toEqual({ ...old, plainTutorial: { step: 2, done: true } })
  })
  it('the store writes both and reads them back over a reload', () => {
    const st = fakeStorage()
    const a = createOnboardingStore(st)
    a.dispatch({ type: 'plainTutorial', step: 3, done: false })
    a.dispatch({ type: 'accountPrompt', value: 'dismissed' })
    expect(createOnboardingStore(st).read()).toMatchObject({ plainTutorial: { step: 3, done: false }, accountPrompt: 'dismissed' })
  })
})
