import { type AgeRange, isUnder15 } from './ageRange'

/**
 * Every field the account form may show. This is the whole list: no birthdate, no phone, no employer, no address.
 * `parentConfirmation` is the declaration box shown to learners under 15; it is not personal data of its own.
 */
export type ProfileField = 'ageRange' | 'goal' | 'parentConfirmation' | 'firstName' | 'region' | 'school'

export interface FieldContext {
  /** True when the learner says they are a pupil or student: only then is the school field offered. */
  isStudent: boolean
  /** True when a parent or guardian confirmation has been ticked (only meaningful under 15). */
  parentConfirmed: boolean
}

export function needsParentConfirmation(range: AgeRange): boolean {
  return isUnder15(range)
}

/** Under 15 an account cannot be created without the parent or guardian confirmation; everyone else can. */
export function canCreateAccount(range: AgeRange, parentConfirmed: boolean): boolean {
  return !needsParentConfirmation(range) || parentConfirmed
}

/**
 * The fields to collect, in display order.
 * - Always: age range and goal.
 * - Under 15: the parent-confirmation box; the first name and the region only once it is ticked.
 * - School: students only (a boolean `isStudent`; there is no employer field anywhere).
 */
export function fieldsFor(range: AgeRange, ctx: FieldContext): ProfileField[] {
  const fields: ProfileField[] = ['ageRange', 'goal']
  if (needsParentConfirmation(range)) fields.push('parentConfirmation')
  if (canCreateAccount(range, ctx.parentConfirmed)) {
    fields.push('firstName', 'region')
    if (ctx.isStudent) fields.push('school')
  }
  return fields
}
