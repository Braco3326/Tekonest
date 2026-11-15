import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { fromRow, mapAuthError, createSupabaseService, toRow } from '../../src/accounts/supabaseService'
import { type Profile, normaliseProfile } from '../../src/accounts/profileModel'

// No network anywhere in this file: the client is a stub, and the URL / key are obvious placeholders.
const CFG = { url: 'https://placeholder.invalid', anonKey: 'placeholder-anon-value' }

function profile(over: Record<string, unknown> = {}): Profile {
  const r = normaliseProfile({ ageRange: '22-25', goal: 'etudie.x', firstName: 'Sam', region: 'Paris', school: 'ecole.lycee-x', consentAt: '2026-11-15T10:00:00Z', ...over }, { isStudent: true })
  if (!r.ok) throw new Error('bad fixture')
  return r.profile
}

interface Stub {
  client: SupabaseClient
  calls: { name: string; args: unknown[] }[]
  session: { user: { id: string; email: string } } | null
  responses: Record<string, unknown>
}

function stub(over: Partial<Stub['responses']> = {}): Stub {
  const calls: Stub['calls'] = []
  const s: Stub = { client: null as unknown as SupabaseClient, calls, session: { user: { id: 'u1', email: 'a@b.co' } }, responses: { ...over } }
  const rec = (name: string, ret: () => unknown) => (...args: unknown[]) => {
    calls.push({ name, args })
    const r = s.responses[name]
    return Promise.resolve(r instanceof Error ? Promise.reject(r) : (r ?? ret()))
  }
  const query = {
    upsert: rec('upsert', () => ({ error: null })),
    select: (...a: unknown[]) => {
      calls.push({ name: 'select', args: a })
      return query
    },
    eq: (...a: unknown[]) => {
      calls.push({ name: 'eq', args: a })
      return query
    },
    maybeSingle: rec('maybeSingle', () => ({ data: null, error: null })),
  }
  s.client = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: s.session }, error: null }),
      signUp: rec('signUp', () => ({ data: { user: { id: 'u1', email: 'a@b.co', identities: [{}] }, session: { user: { id: 'u1', email: 'a@b.co' } } }, error: null })),
      signInWithPassword: rec('signInWithPassword', () => ({ data: { user: { id: 'u1', email: 'a@b.co' } }, error: null })),
      signInWithOAuth: rec('signInWithOAuth', () => ({ data: {}, error: null })),
      signOut: rec('signOut', () => ({ error: null })),
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        calls.push({ name: 'onAuthStateChange', args: [] })
        cb('SIGNED_IN', s.session)
        return { data: { subscription: { unsubscribe: () => calls.push({ name: 'unsubscribe', args: [] }) } } }
      },
    },
    from: (t: string) => {
      calls.push({ name: 'from', args: [t] })
      return query
    },
    functions: { invoke: rec('invoke', () => ({ data: null, error: null })) },
  } as unknown as SupabaseClient
  return s
}

describe('not configured', () => {
  it('answers not-configured to every call when the URL or the key is missing', async () => {
    for (const cfg of [{}, { url: CFG.url }, { anonKey: CFG.anonKey }, { url: '  ', anonKey: 'x' }]) {
      const makeClient = vi.fn()
      const s = createSupabaseService({ ...cfg, makeClient })
      const nc = { ok: false, reason: 'not-configured' }
      expect(await s.signUpEmail('a@b.co', 'password1')).toEqual(nc)
      expect(await s.signInEmail('a@b.co', 'password1')).toEqual(nc)
      expect(await s.signInGoogle()).toEqual(nc)
      expect(await s.signOut()).toEqual(nc)
      expect(await s.saveProfile(profile())).toEqual(nc)
      expect(await s.loadProfile()).toEqual(nc)
      expect(await s.deleteAccount()).toEqual(nc)
      expect(await s.currentUser()).toBeNull()
      expect(typeof s.onAuthChange(() => undefined)).toBe('function')
      expect(makeClient).not.toHaveBeenCalled()
    }
  })
})

describe('client options', () => {
  it('persists the session, refreshes the token and reads the session from the URL', () => {
    const st = stub()
    const makeClient = vi.fn(() => st.client)
    createSupabaseService({ ...CFG, makeClient })
    expect(makeClient).toHaveBeenCalledWith(CFG.url, CFG.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  })
})

describe('adapter calls (stub client)', () => {
  const make = (st: Stub) => createSupabaseService({ ...CFG, makeClient: () => st.client })

  it('sign-up with a session: no confirmation needed', async () => {
    const st = stub()
    expect(await make(st).signUpEmail('a@b.co', 'password1')).toMatchObject({ ok: true, needsEmailConfirmation: false, user: { id: 'u1' } })
  })

  it('sign-up without a session: confirmation needed', async () => {
    const st = stub({ signUp: { data: { user: { id: 'u1', email: 'a@b.co', identities: [{}] }, session: null }, error: null } })
    expect(await make(st).signUpEmail('a@b.co', 'password1')).toMatchObject({ ok: true, needsEmailConfirmation: true })
  })

  it('sign-up of an existing address (no identities) is email-taken', async () => {
    const st = stub({ signUp: { data: { user: { id: 'u1', email: 'a@b.co', identities: [] }, session: null }, error: null } })
    expect(await make(st).signUpEmail('a@b.co', 'password1')).toEqual({ ok: false, reason: 'email-taken' })
  })

  it('maps provider errors and exceptions to typed failures, never throwing', async () => {
    const st = stub({
      signInWithPassword: { data: { user: null }, error: { code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 } },
      signInWithOAuth: new Error('Failed to fetch'),
    })
    const s = make(st)
    expect(await s.signInEmail('a@b.co', 'password1')).toEqual({ ok: false, reason: 'invalid-credentials' })
    expect(await s.signInGoogle()).toEqual({ ok: false, reason: 'network' })
  })

  it('Google sign-in asks for a redirect back to the page', async () => {
    const st = stub()
    expect(await make(st).signInGoogle()).toEqual({ ok: true, redirecting: true })
    const call = st.calls.find((c) => c.name === 'signInWithOAuth')
    expect(call?.args[0]).toMatchObject({ provider: 'google' })
  })

  it('saves the profile in table profiles, keyed on the signed-in user, in snake_case', async () => {
    const st = stub()
    expect(await make(st).saveProfile(profile())).toEqual({ ok: true })
    expect(st.calls.find((c) => c.name === 'from')?.args[0]).toBe('profiles')
    const row = st.calls.find((c) => c.name === 'upsert')?.args[0] as Record<string, unknown>
    expect(row.id).toBe('u1')
    expect(Object.keys(row).sort()).toEqual(['age_range', 'consent_at', 'first_name', 'goal', 'id', 'parental_confirmation', 'region', 'school'])
  })

  it('does not call the database without a session', async () => {
    const st = stub()
    st.session = null
    const s = make(st)
    expect(await s.saveProfile(profile())).toEqual({ ok: false, reason: 'not-signed-in' })
    expect(await s.loadProfile()).toEqual({ ok: false, reason: 'not-signed-in' })
    expect(await s.deleteAccount()).toEqual({ ok: false, reason: 'not-signed-in' })
    expect(st.calls.some((c) => c.name === 'upsert' || c.name === 'invoke')).toBe(false)
  })

  it('loads a profile row back through the same validation', async () => {
    const row = toRow('u1', profile())
    const st = stub({ maybeSingle: { data: row, error: null } })
    const r = await make(st).loadProfile()
    expect(r).toMatchObject({ ok: true, profile: { firstName: 'Sam', school: 'ecole.lycee-x', ageRange: '22-25' } })
    expect(st.calls.find((c) => c.name === 'eq')?.args).toEqual(['id', 'u1'])
  })

  it('no row = no profile yet', async () => {
    expect(await make(stub()).loadProfile()).toEqual({ ok: true, profile: null })
  })

  it('deleteAccount calls the delete-account function with NO user id, then ends the local session', async () => {
    const st = stub()
    expect(await make(st).deleteAccount()).toEqual({ ok: true })
    const inv = st.calls.find((c) => c.name === 'invoke')
    expect(inv?.args[0]).toBe('delete-account')
    expect(JSON.stringify(inv?.args[1])).not.toMatch(/u1|body/)
    const out = st.calls.find((c) => c.name === 'signOut')
    expect(out?.args[0]).toEqual({ scope: 'local' })
  })

  it('deleteAccount keeps the session when the function fails', async () => {
    const st = stub({ invoke: { data: null, error: { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code' } } })
    expect(await make(st).deleteAccount()).toEqual({ ok: false, reason: 'unknown' })
    expect(st.calls.some((c) => c.name === 'signOut')).toBe(false)
  })

  it('onAuthChange forwards the user and returns the unsubscribe', () => {
    const st = stub()
    const seen: (string | null)[] = []
    const off = make(st).onAuthChange((u) => seen.push(u?.id ?? null))
    expect(seen).toEqual(['u1'])
    off()
    expect(st.calls.some((c) => c.name === 'unsubscribe')).toBe(true)
  })
})

describe('row mapping and error mapping', () => {
  it('a row with an unknown age range is not a usable profile', () => {
    expect(fromRow({ ...toRow('u1', profile()), age_range: '99' })).toBeNull()
  })

  it('maps the codes that matter', () => {
    expect(mapAuthError({ code: 'user_already_exists' })).toBe('email-taken')
    expect(mapAuthError({ code: 'weak_password' })).toBe('weak-password')
    expect(mapAuthError({ code: 'email_not_confirmed' })).toBe('email-not-confirmed')
    expect(mapAuthError({ status: 429 })).toBe('rate-limited')
    expect(mapAuthError({ name: 'AuthRetryableFetchError', message: 'x' })).toBe('network')
    expect(mapAuthError(null)).toBe('unknown')
    expect(mapAuthError('boom')).toBe('unknown')
  })
})
