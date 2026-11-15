import { type AgeRange, isAgeRange, isUnder15 } from './ageRange'
import type { ProfileField } from './fieldsFor'

/**
 * The profile the account stores. THESE KEYS ARE THE WHOLE LIST: no birthdate, no phone, no employer, no address.
 * supabase/schema.sql mirrors them (first_name, age_range, goal, region, school, parental_confirmation, consent_at).
 */
export const PROFILE_KEYS = ['ageRange', 'goal', 'firstName', 'region', 'school', 'parentalConfirmation', 'consentAt'] as const
export type ProfileKey = (typeof PROFILE_KEYS)[number]

export interface Profile {
  ageRange: AgeRange
  /** The learner's goal: ONE node id of the goal tree (a dotted string such as `etudie.bts-mav-son`), or null when the goal screens were skipped. */
  goal: string | null
  firstName: string | null
  /** City or region, free text. */
  region: string | null
  /** Students only (goal id starting with `etudie`): a school id from the schools list, or `autre:` followed by free text (80 characters at most). There is no employer field anywhere. */
  school: string | null
  /** True only for a learner under 15 whose parent or guardian confirmation was ticked. */
  parentalConfirmation: boolean
  /** When the learner consented to the privacy text (ISO 8601, UTC). */
  consentAt: string
}

export const LIMITS = { firstName: 40, region: 80, school: 80, schoolId: 100, id: 80, password: 72, passwordMin: 8, email: 254 } as const

export type ProfileErrorCode = 'required' | 'invalid' | 'too-long' | 'too-short'
export type ErrorField = ProfileField | 'consent' | 'email' | 'password'

export interface ProfileError {
  field: ErrorField
  code: ProfileErrorCode
  /** French, « vous », ready to show. */
  message: string
}

export type ProfileResult = { ok: true; profile: Profile } | { ok: false; errors: ProfileError[] }

export interface NormaliseContext {
  /** True when the goal is a study goal (id starting with `etudie`): the only case where the school is kept. */
  isStudent?: boolean
}

const MESSAGES: Record<string, string> = {
  'ageRange.required': 'Choisissez votre tranche d’âge.',
  'ageRange.invalid': 'Choisissez votre tranche d’âge dans la liste.',
  'consent.required': 'Le consentement est nécessaire pour créer un compte.',
  'consent.invalid': 'Le consentement doit porter une date valide.',
  'goal.invalid': 'Le but enregistré n’est pas valide.',
  'firstName.too-long': `Le prénom ne peut pas dépasser ${LIMITS.firstName} caractères.`,
  'firstName.invalid': 'Le prénom doit être du texte.',
  'region.too-long': `La ville ou la région ne peut pas dépasser ${LIMITS.region} caractères.`,
  'region.invalid': 'La ville ou la région doit être du texte.',
  'school.too-long': `L’établissement ne peut pas dépasser ${LIMITS.school} caractères.`,
  'school.invalid': 'L’établissement choisi n’est pas valide.',
  'email.required': 'Saisissez votre adresse e-mail.',
  'email.invalid': 'Cette adresse e-mail ne semble pas valide.',
  'email.too-long': 'Cette adresse e-mail est trop longue.',
  'password.required': 'Saisissez votre mot de passe.',
  'password.too-short': `Le mot de passe doit comporter au moins ${LIMITS.passwordMin} caractères.`,
  'password.too-long': `Le mot de passe ne peut pas dépasser ${LIMITS.password} caractères.`,
}

function err(field: ErrorField, code: ProfileErrorCode): ProfileError {
  return { field, code, message: MESSAGES[`${field}.${code}`] ?? 'Cette valeur n’est pas valide.' }
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g
const ID = /^[A-Za-z0-9_.:-]{1,80}$/
const SCHOOL_ID = /^[A-Za-z0-9_.:-]{1,100}$/

/** Prefix of a school typed by hand (not in the list). */
export const OTHER_SCHOOL_PREFIX = 'autre:'

/** Trim, drop control characters, collapse inner whitespace. */
function clean(s: string): string {
  return s.replace(CONTROL, '').replace(/\s+/g, ' ').trim()
}

type Text = { value: string | null; error: ProfileError | null }

function text(field: 'firstName' | 'region', raw: unknown): Text {
  if (raw === undefined || raw === null) return { value: null, error: null }
  if (typeof raw !== 'string') return { value: null, error: err(field, 'invalid') }
  const v = clean(raw)
  if (v === '') return { value: null, error: null }
  if (v.length > LIMITS[field]) return { value: null, error: err(field, 'too-long') }
  return { value: v, error: null }
}

/** A school: an id from the list, or `autre:` + free text (1 to 80 characters). Anything else is refused. */
function school(raw: unknown): Text {
  if (raw === undefined || raw === null) return { value: null, error: null }
  if (typeof raw !== 'string') return { value: null, error: err('school', 'invalid') }
  const v = clean(raw)
  if (v === '') return { value: null, error: null }
  if (v.startsWith(OTHER_SCHOOL_PREFIX)) {
    const rest = v.slice(OTHER_SCHOOL_PREFIX.length).trim()
    if (rest === '') return { value: null, error: null }
    if (rest.length > LIMITS.school) return { value: null, error: err('school', 'too-long') }
    return { value: OTHER_SCHOOL_PREFIX + rest, error: null }
  }
  if (!SCHOOL_ID.test(v)) return { value: null, error: err('school', 'invalid') }
  return { value: v, error: null }
}

function id(field: 'goal', raw: unknown): Text {
  if (raw === undefined || raw === null || raw === '') return { value: null, error: null }
  if (typeof raw !== 'string' || !ID.test(raw)) return { value: null, error: err(field, 'invalid') }
  return { value: raw, error: null }
}

/**
 * Validate and normalise what the profile form (or a stored row) hands over. Only the allowed keys are read: anything else in
 * `raw` is ignored, never copied. Rules: under 15 without a parent confirmation keeps only the age range and the goal; the school
 * is kept only for students; a parent confirmation is recorded only under 15.
 */
export function normaliseProfile(raw: unknown, ctx: NormaliseContext = {}): ProfileResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, errors: [err('ageRange', 'required')] }
  const r = raw as Record<string, unknown>
  const errors: ProfileError[] = []

  let ageRange: AgeRange | null = null
  if (r.ageRange === undefined || r.ageRange === null || r.ageRange === '') errors.push(err('ageRange', 'required'))
  else if (isAgeRange(r.ageRange)) ageRange = r.ageRange
  else errors.push(err('ageRange', 'invalid'))

  let consentAt = ''
  if (r.consentAt === undefined || r.consentAt === null || r.consentAt === '') errors.push(err('consent', 'required'))
  else if (typeof r.consentAt !== 'string' || Number.isNaN(Date.parse(r.consentAt))) errors.push(err('consent', 'invalid'))
  else consentAt = new Date(r.consentAt).toISOString()

  const goal = id('goal', r.goal)
  const firstName = text('firstName', r.firstName)
  const region = text('region', r.region)
  const schoolValue = school(r.school)
  for (const t of [goal, firstName, region, schoolValue]) if (t.error) errors.push(t.error)

  if (errors.length > 0 || ageRange === null) return { ok: false, errors }

  const under15 = isUnder15(ageRange)
  const unlocked = !under15 || r.parentalConfirmation === true
  return {
    ok: true,
    profile: {
      ageRange,
      goal: goal.value,
      firstName: unlocked ? firstName.value : null,
      region: unlocked ? region.value : null,
      school: unlocked && ctx.isStudent === true ? schoolValue.value : null,
      parentalConfirmation: under15 && r.parentalConfirmation === true,
      consentAt,
    },
  }
}

export type CredentialsMode = 'sign-up' | 'sign-in'
export type CredentialsResult = { ok: true; email: string } | { ok: false; errors: ProfileError[] }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Cheap client-side checks before a sign-up or log-in call; the provider remains the authority. */
export function validateCredentials(email: string, password: string, mode: CredentialsMode): CredentialsResult {
  const errors: ProfileError[] = []
  const e = email.trim()
  if (e === '') errors.push(err('email', 'required'))
  else if (e.length > LIMITS.email) errors.push(err('email', 'too-long'))
  else if (!EMAIL.test(e)) errors.push(err('email', 'invalid'))
  if (password === '') errors.push(err('password', 'required'))
  else if (password.length > LIMITS.password) errors.push(err('password', 'too-long'))
  else if (mode === 'sign-up' && password.length < LIMITS.passwordMin) errors.push(err('password', 'too-short'))
  return errors.length > 0 ? { ok: false, errors } : { ok: true, email: e }
}
