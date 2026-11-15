import { describe, expect, it } from 'vitest'
import { AGE_RANGES } from '../../src/accounts/ageRange'
import { canCreateAccount, fieldsFor, needsParentConfirmation } from '../../src/accounts/fieldsFor'

describe('fieldsFor', () => {
  it('always asks the age range and the goal', () => {
    for (const r of AGE_RANGES)
      for (const parentConfirmed of [false, true])
        for (const isStudent of [false, true]) {
          const f = fieldsFor(r, { isStudent, parentConfirmed })
          expect(f).toContain('ageRange')
          expect(f).toContain('goal')
        }
  })

  it('under 15 without a parent confirmation: only the age range, the goal and the confirmation box', () => {
    expect(fieldsFor('-15', { isStudent: true, parentConfirmed: false })).toEqual(['ageRange', 'goal', 'parentConfirmation'])
  })

  it('under 15 with a parent confirmation: the other fields are unlocked', () => {
    expect(fieldsFor('-15', { isStudent: false, parentConfirmed: true })).toEqual(['ageRange', 'goal', 'parentConfirmation', 'firstName', 'region'])
    expect(fieldsFor('-15', { isStudent: true, parentConfirmed: true })).toEqual(['ageRange', 'goal', 'parentConfirmation', 'firstName', 'region', 'school'])
  })

  it('15 and over: first name and region, school only for students, no parent confirmation box', () => {
    for (const r of AGE_RANGES.filter((x) => x !== '-15')) {
      expect(fieldsFor(r, { isStudent: false, parentConfirmed: false })).toEqual(['ageRange', 'goal', 'firstName', 'region'])
      expect(fieldsFor(r, { isStudent: true, parentConfirmed: false })).toEqual(['ageRange', 'goal', 'firstName', 'region', 'school'])
    }
  })

  it('never offers anything outside the allowed field names (no birthdate, phone, employer, address)', () => {
    const allowed = new Set(['ageRange', 'goal', 'parentConfirmation', 'firstName', 'region', 'school'])
    for (const r of AGE_RANGES)
      for (const parentConfirmed of [false, true])
        for (const isStudent of [false, true])
          for (const f of fieldsFor(r, { isStudent, parentConfirmed })) expect(allowed.has(f)).toBe(true)
  })

  it('needsParentConfirmation is true for under 15 only', () => {
    expect(AGE_RANGES.filter((r) => needsParentConfirmation(r))).toEqual(['-15'])
  })

  it('an account may be created unless the learner is under 15 without a parent confirmation', () => {
    expect(canCreateAccount('-15', false)).toBe(false)
    expect(canCreateAccount('-15', true)).toBe(true)
    for (const r of AGE_RANGES.filter((x) => x !== '-15')) {
      expect(canCreateAccount(r, false)).toBe(true)
      expect(canCreateAccount(r, true)).toBe(true)
    }
  })
})
