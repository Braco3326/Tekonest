/**
 * Onboarding state machine (onboarding packs, plan T2.1, spec 4.1 and 4.4). Pure: no DOM, no Babylon, no guide import.
 *
 * Where the first visit lands (`entryStage`), how each answer changes the stored record (`reduce`), and a store that keeps the record under
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

export interface OnboardingRecord {
  v: 1
  /** `null` = the learner left the profile stage (« Tous les lieux », Échap) without choosing. */
  profile: ProfileId | null
  offer: OfferAnswer | null
  request: number
  shown: StepId[]
}

/** The slice of `Storage` the store needs (tests pass a fake). */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** What the boot shows once `restore()` has run. */
export type EntryStage = 'workspace' | 'picker' | 'start'

/**
 * `design`: a valid `?design=1..5` is on the address. `restored`: `restore()` reopened an autosave. `record`: the stored record, or null.
 * The start screen exists only under `?design`, only with no autosave, and only when no record exists: any record (a profile chosen, the offer
 * answered, or the profile stage left) means the learner has been asked once, so the plain picker shows and nothing nags.
 */
export function entryStage(i: { design: boolean; restored: boolean; record: OnboardingRecord | null }): EntryStage {
  if (i.restored) return 'workspace'
  if (!i.design) return 'picker'
  return i.record === null ? 'start' : 'picker'
}

export type OnboardingEvent =
  | { type: 'profile'; id: ProfileId }
  /** « Tous les lieux » or Échap on the profile stage. */
  | { type: 'all-places' }
  /** « Faire le tutoriel ». */
  | { type: 'tutorial' }
  /** « Passer, je connais » or Échap on the offer stage. */
  | { type: 'skip' }
  /** Aide « Premiers pas »: the tutorial is asked for again; the earlier answer stays. */
  | { type: 'request' }

const BASE: OnboardingRecord = { v: 1, profile: null, offer: null, request: 0, shown: [] }

export function reduce(rec: OnboardingRecord | null, ev: OnboardingEvent): OnboardingRecord {
  const cur: OnboardingRecord = rec ? { ...rec, shown: [...rec.shown] } : { ...BASE, shown: [] }
  switch (ev.type) {
    case 'profile':
      return { ...cur, profile: ev.id }
    case 'all-places':
      return cur
    case 'tutorial':
      return { ...cur, offer: 'taken', request: cur.request + 1 }
    case 'skip':
      return { ...cur, offer: 'skipped' }
    case 'request':
      return { ...cur, request: cur.request + 1 }
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
  return { v: 1, profile: r.profile as ProfileId | null, offer: r.offer as OfferAnswer | null, request: r.request, shown: r.shown as StepId[] }
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
      memory = reduce(memory, ev)
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
