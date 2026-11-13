/**
 * Onboarding state machine (onboarding packs, plan T2.1, spec 4.1 and 4.4, T2 review ruling R-B). Pure: no DOM, no Babylon, no guide import.
 *
 * Where the first visit lands (`entryStage`), how an answer changes the stored record (`reduce`: the profile is written WITH the answer, so leaving mid-way
 * writes nothing), and a store that keeps the record under
 * `audio-sim/creation-onboarding.v1` with every storage access in try/catch: a blocked storage (or a write that throws) keeps the record in
 * memory for the page's life (the start screen may then show again next visit: stated, accepted); a corrupt record reads as « none » and the
 * next answer replaces it (there is no learner work in it).
 *
 * The record is `{ v: 1, profile, offer, request, shown }`. `request` is the guide's trigger: it goes up on « Faire le tutoriel » and on
 * Aide « Premiers pas », and the guide starts the tutorial only when `request` is above its own `handledRequest` (spec 4.4). `shown` holds the
 * ids of the tutorial steps already shown; the tutorial (plan T3) owns what is in it, the machine only keeps it well-formed.
 */
import type { StepId } from '../../design/packages'

export const ONBOARDING_KEY = 'audio-sim/creation-onboarding.v1'

export const PROFILE_IDS = ['decouvre', 'etudie', 'projet', 'metier'] as const
export type ProfileId = (typeof PROFILE_IDS)[number]

/** The learner's answer to the offer: the tutorial was asked for, or declined. `null` = not answered yet. */
export type OfferAnswer = 'taken' | 'skipped'

/** What the last request asked the guide: start (or resume a run), restart, skip. */
export type RequestKind = 'start' | 'restart' | 'skip'

export interface OnboardingRecord {
  v: 1
  /** `null` = the learner left the profile stage (« Tous les lieux », Échap) without choosing. */
  profile: ProfileId | null
  offer: OfferAnswer | null
  request: number
  shown: StepId[]
  /**
   * What the last request asked for, stored WITH the counter (T3 close review N3: kept in memory only, a « Passer le tutoriel » reloaded before the guide's next
   * poll read as a start). Absent = start (records written before it, and every start: the field is written only for restart and skip).
   */
  kind?: Exclude<RequestKind, 'start'>
  /**
   * The learner dismissed the entrepreneur's card (the own-gear line and the three generic venue types shown after the first sound, T6.4: ownGear.ts). Absent = not dismissed (every
   * record written before it, and every record of a learner who never dismissed it). A value this code does not know is ignored on read, never a reason to drop the record.
   */
  ownGear?: 'dismissed'
}

/** The slice of `Storage` the store needs (tests pass a fake). */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** What the boot shows once `restore()` has run: the workspace, the start screen (profile stage), the offer for the stored profile, or today's picker. */
export type EntryStage = 'workspace' | 'start' | 'offer' | 'picker'

/**
 * `design`: the onboarding is on (a valid `?design=1..5`, and not an exam address). `tutorialAllowed`: the guide may run here (not `?oscar=0`). `restored`: `restore()`
 * reopened an autosave. `record`: the stored record, or null.
 * The start screen exists only with the onboarding on, no autosave and no record. A record means the learner was asked, so the picker shows and nothing nags,
 * with one exception (ruling R-B): a profile whose offer was never answered (the first visit was on `?oscar=0`, where the profile choice is final) gets the OFFER the
 * first time the tutorial is allowed. A record with no profile (only an Aide « Premiers pas » request) is the picker.
 */
export function entryStage(i: { design: boolean; tutorialAllowed: boolean; restored: boolean; record: OnboardingRecord | null }): EntryStage {
  if (i.restored) return 'workspace'
  if (!i.design) return 'picker'
  if (i.record === null) return 'start'
  return i.tutorialAllowed && i.record.profile !== null && i.record.offer === null ? 'offer' : 'picker'
}

export type OnboardingEvent =
  /** The learner answered: the profile and the answer to the offer together (`offer` null = no offer was made, `?oscar=0`: an earlier answer is kept). */
  | { type: 'answer'; profile: ProfileId; offer: OfferAnswer | null }
  /** Aide « Premiers pas » (start), « Recommencer » (restart), « Passer le tutoriel » (skip): the tutorial is asked for again; the earlier answer stays. */
  | { type: 'request'; kind?: RequestKind }
  /** The learner dismissed the entrepreneur's card (T6.4). */
  | { type: 'ownGear'; value: 'dismissed' }

const BASE: OnboardingRecord = { v: 1, profile: null, offer: null, request: 0, shown: [] }

export function reduce(rec: OnboardingRecord | null, ev: OnboardingEvent): OnboardingRecord {
  const cur: OnboardingRecord = rec ? { ...rec, shown: [...rec.shown] } : { ...BASE, shown: [] }
  /** The record with the kind of a new request: written for restart and skip only (a start leaves no field). */
  const asking = (r: OnboardingRecord, kind: RequestKind): OnboardingRecord => {
    const rest: OnboardingRecord = { ...r }
    delete rest.kind
    return kind === 'start' ? rest : { ...rest, kind }
  }
  switch (ev.type) {
    case 'answer':
      return ev.offer === 'taken' ? asking({ ...cur, profile: ev.profile, offer: ev.offer, request: cur.request + 1 }, 'start') : { ...cur, profile: ev.profile, offer: ev.offer ?? cur.offer }
    case 'request':
      return asking({ ...cur, request: cur.request + 1 }, ev.kind ?? 'start')
    case 'ownGear':
      return { ...cur, ownGear: ev.value }
  }
}

/** The record in `raw`, or null when it is missing or malformed in any field (a corrupt record is replaced, never repaired). */
export function parseRecord(raw: string | null): OnboardingRecord | null {
  if (raw === null || raw === '') return null
  let o: unknown
  try {
    o = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return null
  const r = o as Record<string, unknown>
  if (r.v !== 1) return null
  if (r.profile !== null && !(PROFILE_IDS as readonly unknown[]).includes(r.profile)) return null
  if (r.offer !== null && r.offer !== 'taken' && r.offer !== 'skipped') return null
  if (typeof r.request !== 'number' || !Number.isSafeInteger(r.request) || r.request < 0) return null
  if (!Array.isArray(r.shown) || !r.shown.every((s) => typeof s === 'string')) return null
  if (r.kind !== undefined && r.kind !== 'restart' && r.kind !== 'skip') return null
  const base: OnboardingRecord = { v: 1, profile: r.profile as ProfileId | null, offer: r.offer as OfferAnswer | null, request: r.request, shown: r.shown as StepId[] }
  const withKind: OnboardingRecord = r.kind === undefined ? base : { ...base, kind: r.kind }
  return r.ownGear === 'dismissed' ? { ...withKind, ownGear: 'dismissed' } : withKind
}

export interface OnboardingStore {
  /** The current record (memory first), or null when the learner was never asked. */
  read(): OnboardingRecord | null
  /** Apply the event, remember the result in memory, write it when the storage allows. Returns the new record. */
  dispatch(ev: OnboardingEvent): OnboardingRecord
  /** The storage could not be read or written: the record lives in memory for this page only. */
  readonly blocked: boolean
}

export function createOnboardingStore(storage: StorageLike | null): OnboardingStore {
  let blocked = storage === null
  let memory: OnboardingRecord | null = null
  if (storage) {
    try {
      memory = parseRecord(storage.getItem(ONBOARDING_KEY))
    } catch {
      blocked = true
    }
  }
  return {
    read: () => memory,
    dispatch(ev) {
      // T6 review S4: reduce from what is STORED now (another tab may have written since this one read: its request counter, its dismissal), not from this tab's memory alone; the memory is the
      // fallback when nothing readable is stored (blocked, cleared, corrupt). The write is still the whole record, so it never rolls the other tab back.
      let base = memory
      if (storage && !blocked) {
        try {
          base = parseRecord(storage.getItem(ONBOARDING_KEY)) ?? memory
        } catch {
          blocked = true
        }
      }
      memory = reduce(base, ev)
      if (storage && !blocked) {
        try {
          storage.setItem(ONBOARDING_KEY, JSON.stringify(memory))
        } catch {
          blocked = true
        }
      }
      return memory
    },
    get blocked() {
      return blocked
    },
  }
}

/**
 * The profile the chip « Profil : X · changer » names, or null (no chip). Only under `?design`, and only once a profile was chosen: leaving the
 * profile stage (« Tous les lieux », Échap) stores `profile: null`, and then there is nothing to name. The offer's answer does not matter.
 */
export function chipProfile(i: { design: boolean; record: OnboardingRecord | null }): ProfileId | null {
  return i.design && i.record !== null ? i.record.profile : null
}
