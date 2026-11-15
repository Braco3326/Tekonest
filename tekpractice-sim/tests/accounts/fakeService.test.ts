import { describe, expect, it } from 'vitest'
import { createFakeService } from '../../src/accounts/fakeService'
import { type Profile, normaliseProfile } from '../../src/accounts/profileModel'

function profile(over: Record<string, unknown> = {}): Profile {
  const r = normaliseProfile({ ageRange: '22-25', goal: 'g1', speciality: 's1', firstName: 'Sam', region: 'Paris', consentAt: '2026-11-15T10:00:00Z', ...over })
  if (!r.ok) throw new Error('bad fixture')
  return r.profile
}

describe('fake account service', () => {
  it('signs up, signs out, signs in', async () => {
    const s = createFakeService()
    expect(await s.currentUser()).toBeNull()
    const up = await s.signUpEmail('a@b.co', 'password1')
    expect(up).toMatchObject({ ok: true, needsEmailConfirmation: false })
    expect((await s.currentUser())?.email).toBe('a@b.co')
    expect(await s.signOut()).toEqual({ ok: true })
    expect(await s.currentUser()).toBeNull()
    const inn = await s.signInEmail('a@b.co', 'password1')
    expect(inn.ok).toBe(true)
    expect((await s.currentUser())?.email).toBe('a@b.co')
  })

  it('answers typed failures instead of throwing', async () => {
    const s = createFakeService()
    expect(await s.signInEmail('nobody@b.co', 'password1')).toEqual({ ok: false, reason: 'invalid-credentials' })
    await s.signUpEmail('a@b.co', 'password1')
    await s.signOut()
    expect(await s.signUpEmail('a@b.co', 'password1')).toEqual({ ok: false, reason: 'email-taken' })
    expect(await s.signInEmail('a@b.co', 'wrong-pass')).toEqual({ ok: false, reason: 'invalid-credentials' })
    expect(await s.signUpEmail('c@d.co', 'short')).toEqual({ ok: false, reason: 'weak-password' })
    expect(await s.signUpEmail('not-an-email', 'password1')).toEqual({ ok: false, reason: 'invalid-email' })
  })

  it('profile calls need a session', async () => {
    const s = createFakeService()
    expect(await s.saveProfile(profile())).toEqual({ ok: false, reason: 'not-signed-in' })
    expect(await s.loadProfile()).toEqual({ ok: false, reason: 'not-signed-in' })
    expect(await s.deleteAccount()).toEqual({ ok: false, reason: 'not-signed-in' })
  })

  it('saves and loads the profile of the signed-in user only', async () => {
    const s = createFakeService()
    await s.signUpEmail('a@b.co', 'password1')
    expect(await s.loadProfile()).toEqual({ ok: true, profile: null })
    expect(await s.saveProfile(profile())).toEqual({ ok: true })
    const loaded = await s.loadProfile()
    expect(loaded).toMatchObject({ ok: true, profile: { firstName: 'Sam', ageRange: '22-25' } })
    await s.signOut()
    await s.signUpEmail('c@d.co', 'password2')
    expect(await s.loadProfile()).toEqual({ ok: true, profile: null })
  })

  it('what is stored is a copy: changing the original afterwards changes nothing', async () => {
    const s = createFakeService()
    await s.signUpEmail('a@b.co', 'password1')
    const p = profile()
    await s.saveProfile(p)
    p.firstName = 'Changed'
    const loaded = await s.loadProfile()
    expect(loaded.ok && loaded.profile?.firstName).toBe('Sam')
  })

  it('deleteAccount removes the profile and the user, and signs out', async () => {
    const s = createFakeService()
    await s.signUpEmail('a@b.co', 'password1')
    await s.saveProfile(profile())
    expect(s.state.profiles.size).toBe(1)
    expect(await s.deleteAccount()).toEqual({ ok: true })
    expect(await s.currentUser()).toBeNull()
    expect(s.state.profiles.size).toBe(0)
    expect(s.state.users.size).toBe(0)
    expect(await s.signInEmail('a@b.co', 'password1')).toEqual({ ok: false, reason: 'invalid-credentials' })
  })

  it('onAuthChange reports sign-in and sign-out and can be unsubscribed', async () => {
    const s = createFakeService()
    const seen: (string | null)[] = []
    const off = s.onAuthChange((u) => seen.push(u?.email ?? null))
    await s.signUpEmail('a@b.co', 'password1')
    await s.signOut()
    off()
    await s.signInEmail('a@b.co', 'password1')
    expect(seen).toEqual(['a@b.co', null])
  })

  it('with e-mail confirmation on, sign-up leaves no session', async () => {
    const s = createFakeService({ emailConfirmation: true })
    const up = await s.signUpEmail('a@b.co', 'password1')
    expect(up).toMatchObject({ ok: true, needsEmailConfirmation: true })
    expect(await s.currentUser()).toBeNull()
    expect(await s.signInEmail('a@b.co', 'password1')).toEqual({ ok: false, reason: 'email-not-confirmed' })
    s.confirmEmail('a@b.co')
    expect((await s.signInEmail('a@b.co', 'password1')).ok).toBe(true)
  })

  it('can simulate an outage', async () => {
    const s = createFakeService()
    s.state.offline = true
    expect(await s.signUpEmail('a@b.co', 'password1')).toEqual({ ok: false, reason: 'network' })
    expect(await s.signInGoogle()).toEqual({ ok: false, reason: 'network' })
  })

  it('Google sign-in records that it was started and signs a Google user in', async () => {
    const s = createFakeService()
    expect(await s.signInGoogle()).toEqual({ ok: true, redirecting: true })
    expect(s.state.googleStarted).toBe(1)
    s.completeGoogleSignIn('g@example.org')
    expect((await s.currentUser())?.email).toBe('g@example.org')
  })
})
