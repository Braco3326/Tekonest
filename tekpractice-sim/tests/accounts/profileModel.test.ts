import { describe, expect, it } from 'vitest'
import {
  LIMITS,
  PROFILE_KEYS,
  type Profile,
  normaliseProfile,
  validateCredentials,
} from '../../src/accounts/profileModel'

const CONSENT = '2026-11-15T10:00:00.000Z'
const base = { ageRange: '22-25', goal: 'goal-a', speciality: 'spec-a1', firstName: '  Sam  ', region: ' Occitanie ', consentAt: CONSENT }

function ok(raw: unknown, ctx?: { isStudent?: boolean }): Profile {
  const r = normaliseProfile(raw, ctx)
  if (!r.ok) throw new Error('expected ok, got ' + JSON.stringify(r.errors))
  return r.profile
}

describe('Profile type', () => {
  it('has exactly the allowed keys, nothing else', () => {
    expect([...PROFILE_KEYS].sort()).toEqual(
      ['ageRange', 'consentAt', 'firstName', 'goal', 'parentalConfirmation', 'region', 'school', 'speciality'].sort()
    )
  })

  it('a normalised profile carries exactly those keys (extra input keys are dropped)', () => {
    const p = ok({ ...base, phone: '0600000000', birthdate: '2001-01-01', employer: 'ACME', address: '1 rue X' }, { isStudent: true })
    expect(Object.keys(p).sort()).toEqual([...PROFILE_KEYS].sort())
    for (const bad of ['phone', 'birthdate', 'employer', 'address', 'email']) expect(bad in p).toBe(false)
  })
})

describe('normaliseProfile', () => {
  it('trims and collapses whitespace', () => {
    const p = ok({ ...base, firstName: '  Sam   Lee  ' })
    expect(p.firstName).toBe('Sam Lee')
    expect(p.region).toBe('Occitanie')
  })

  it('empty optional fields become null', () => {
    const p = ok({ ...base, firstName: '   ', region: '', goal: null, speciality: undefined })
    expect(p.firstName).toBeNull()
    expect(p.region).toBeNull()
    expect(p.goal).toBeNull()
    expect(p.speciality).toBeNull()
  })

  it('requires a valid age range, with a French message', () => {
    const r = normaliseProfile({ ...base, ageRange: '30' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({ field: 'ageRange', code: 'invalid' })
      expect(r.errors[0].message).toMatch(/tranche d.âge/)
    }
    const missing = normaliseProfile({ ...base, ageRange: undefined })
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.errors[0]).toMatchObject({ field: 'ageRange', code: 'required' })
  })

  it('requires the consent date', () => {
    for (const consentAt of [undefined, '', 'yesterday', 42]) {
      const r = normaliseProfile({ ...base, consentAt })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.errors.some((e) => e.field === 'consent')).toBe(true)
    }
  })

  it('normalises the consent date to an ISO string', () => {
    expect(ok({ ...base, consentAt: '2026-11-15T12:00:00+02:00' }).consentAt).toBe('2026-11-15T10:00:00.000Z')
  })

  it('enforces length limits (region free text max 80)', () => {
    expect(LIMITS.region).toBe(80)
    expect(ok({ ...base, region: 'x'.repeat(80) }).region).toHaveLength(80)
    const r = normaliseProfile({ ...base, region: 'x'.repeat(81) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toMatchObject({ field: 'region', code: 'too-long' })
    const n = normaliseProfile({ ...base, firstName: 'y'.repeat(LIMITS.firstName + 1) })
    expect(n.ok).toBe(false)
    const s = normaliseProfile({ ...base, school: 'z'.repeat(LIMITS.school + 1) }, { isStudent: true })
    expect(s.ok).toBe(false)
  })

  it('strips control characters and rejects non-strings', () => {
    expect(ok({ ...base, firstName: 'Sa\u0000m\u0007' }).firstName).toBe('Sam')
    const r = normaliseProfile({ ...base, firstName: 12 })
    expect(r.ok).toBe(false)
  })

  it('keeps the school only for students', () => {
    expect(ok({ ...base, school: 'Lycée X' }, { isStudent: false }).school).toBeNull()
    expect(ok({ ...base, school: ' Lycée X ' }, { isStudent: true }).school).toBe('Lycée X')
  })

  it('under 15 without a parent confirmation keeps only the age range and the goal', () => {
    const p = ok({ ...base, ageRange: '-15', school: 'Collège', parentalConfirmation: false }, { isStudent: true })
    expect(p.ageRange).toBe('-15')
    expect(p.goal).toBe('goal-a')
    expect(p.firstName).toBeNull()
    expect(p.region).toBeNull()
    expect(p.school).toBeNull()
    expect(p.parentalConfirmation).toBe(false)
  })

  it('under 15 with a parent confirmation keeps the other fields', () => {
    const p = ok({ ...base, ageRange: '-15', school: 'Collège', parentalConfirmation: true }, { isStudent: true })
    expect(p.firstName).toBe('Sam')
    expect(p.region).toBe('Occitanie')
    expect(p.school).toBe('Collège')
    expect(p.parentalConfirmation).toBe(true)
  })

  it('15 and over never record a parent confirmation', () => {
    expect(ok({ ...base, parentalConfirmation: true }).parentalConfirmation).toBe(false)
  })

  it('rejects goal ids that are not plain ids', () => {
    const r = normaliseProfile({ ...base, goal: '<script>' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toMatchObject({ field: 'goal', code: 'invalid' })
  })

  it('rejects a non-object', () => {
    for (const raw of [null, undefined, 'x', 3]) expect(normaliseProfile(raw).ok).toBe(false)
  })

  it('collects every error, each with a French message', () => {
    const r = normaliseProfile({ ageRange: 'x', consentAt: 'x', region: 'r'.repeat(200) })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.length).toBeGreaterThanOrEqual(2)
      for (const e of r.errors) expect(e.message.length).toBeGreaterThan(5)
    }
  })
})

describe('validateCredentials', () => {
  it('accepts a plausible email and a password of 8 characters or more', () => {
    expect(validateCredentials('a@b.co', '12345678', 'sign-up')).toEqual({ ok: true, email: 'a@b.co' })
  })

  it('trims the email and lowercases nothing else than the domain-insensitive part', () => {
    const r = validateCredentials('  Sam@Example.org ', '12345678', 'sign-up')
    expect(r).toEqual({ ok: true, email: 'Sam@Example.org' })
  })

  it('rejects a bad email', () => {
    for (const e of ['', 'nope', 'a@b', '@b.co', 'a b@c.de']) {
      const r = validateCredentials(e, '12345678', 'sign-up')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.errors[0].field).toBe('email')
    }
  })

  it('requires 8 characters at sign-up but only a non-empty password at log-in', () => {
    const up = validateCredentials('a@b.co', '1234567', 'sign-up')
    expect(up.ok).toBe(false)
    if (!up.ok) expect(up.errors[0]).toMatchObject({ field: 'password', code: 'too-short' })
    expect(validateCredentials('a@b.co', '1234567', 'sign-in').ok).toBe(true)
    expect(validateCredentials('a@b.co', '', 'sign-in').ok).toBe(false)
  })

  it('caps the password at 72 characters', () => {
    expect(validateCredentials('a@b.co', 'x'.repeat(73), 'sign-up').ok).toBe(false)
  })
})
