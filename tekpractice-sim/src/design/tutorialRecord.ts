/**
 * The tutorial's own record (onboarding spec 4.4 and 6.1, plan T3.2), under `oscar-guide.onboarding.v1`. Neutral: the guide writes it (src/guide/tutorial.ts),
 * Mode Création reads it (Aide « Reprendre à l’étape {k} »); neither imports the other. Pure: no DOM.
 *
 * `handledRequest`: the last onboarding `request` the guide acted on (the creation record's counter, `audio-sim/creation-onboarding.v1`); a request above it
 * starts, resumes, restarts or skips the tutorial once. `step` / `k` / `n`: the current step id, its number (1-based) and the step count while it runs.
 * `status`: idle (never started or stopped), running, done (the last step ended), skipped (« Passer le tutoriel »). `early`: steps completed because their
 * result was already on the bench (« déjà en place », G8 review C2).
 */
import type { StepId } from './packages'

export const TUTORIAL_RECORD_KEY = 'oscar-guide.onboarding.v1'

export type TutorialStatus = 'idle' | 'running' | 'done' | 'skipped'
export interface TutorialRecord {
  v: 1
  handledRequest: number
  step: StepId | null
  k: number
  n: number
  status: TutorialStatus
  early: StepId[]
}

export const EMPTY_TUTORIAL_RECORD: Readonly<TutorialRecord> = Object.freeze({ v: 1, handledRequest: 0, step: null, k: 0, n: 0, status: 'idle', early: [] as StepId[] })

const STATUSES: readonly string[] = ['idle', 'running', 'done', 'skipped']
const count = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0

/** The record in `raw`, or null when missing or malformed in any field (a corrupt record is replaced by the next write, never repaired). */
export function parseTutorialRecord(raw: string | null): TutorialRecord | null {
  if (raw === null || raw === '') return null
  let o: unknown
  try {
    o = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return null
  const r = o as Record<string, unknown>
  if (r.v !== 1 || !count(r.handledRequest) || !count(r.k) || !count(r.n)) return null
  if (typeof r.status !== 'string' || !STATUSES.includes(r.status)) return null
  if (r.step !== null && typeof r.step !== 'string') return null
  if (!Array.isArray(r.early) || !r.early.every((s) => typeof s === 'string')) return null
  return { v: 1, handledRequest: r.handledRequest, step: r.step as StepId | null, k: r.k, n: r.n, status: r.status as TutorialStatus, early: r.early as StepId[] }
}

/** The step the learner can resume at (1-based), or null when no tutorial is running. Reads storage in try/catch: blocked storage = null. */
export function tutorialInProgress(storage: { getItem(key: string): string | null } | null): { k: number; n: number } | null {
  try {
    const r = storage ? parseTutorialRecord(storage.getItem(TUTORIAL_RECORD_KEY)) : null
    return r !== null && r.status === 'running' && r.k > 0 ? { k: r.k, n: r.n } : null
  } catch {
    return null
  }
}
