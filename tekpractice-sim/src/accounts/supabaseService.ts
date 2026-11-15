import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  type AccountFailureReason,
  type AccountService,
  type AccountUser,
  type Failure,
  failingService,
} from './accountService'
import { isAgeRange } from './ageRange'
import { type Profile, normaliseProfile } from './profileModel'

/**
 * The real AccountService, backed by Supabase. THIS IS THE ONLY FILE THAT IMPORTS @supabase/supabase-js, and it is only ever loaded
 * with a dynamic `import()` (see accountUi.ts), so the SDK is its own lazy chunk and a build with `accounts` off never fetches it.
 *
 * The project URL and the public anon key come from `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` ONLY (set at build
 * time by the founder, never committed). When either is missing, every call answers `{ ok:false, reason:'not-configured' }`.
 * Row-level security (supabase/schema.sql) is what protects the data, not the secrecy of the anon key.
 */

export interface SupabaseConfig {
  url?: string
  anonKey?: string
  /** Replaceable in tests so no network client is ever created. */
  makeClient?: (url: string, anonKey: string, options: ClientOptions) => SupabaseClient
}

type ClientOptions = { auth: { persistSession: boolean; autoRefreshToken: boolean; detectSessionInUrl: boolean } }

const CLIENT_OPTIONS: ClientOptions = { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }

/** The row of table `profiles` (snake_case, as supabase/schema.sql declares it). */
export interface ProfileRow {
  id: string
  first_name: string | null
  age_range: string
  goal: string | null
  region: string | null
  school: string | null
  consent_at: string
  parental_confirmation: boolean
}

export function toRow(userId: string, p: Profile): ProfileRow {
  return {
    id: userId,
    first_name: p.firstName,
    age_range: p.ageRange,
    goal: p.goal,
    region: p.region,
    school: p.school,
    consent_at: p.consentAt,
    parental_confirmation: p.parentalConfirmation,
  }
}

/** A stored row back to a Profile, through the same validation as the form (a row that fails is treated as no usable profile). */
export function fromRow(row: Record<string, unknown>): Profile | null {
  if (!isAgeRange(row.age_range)) return null
  const r = normaliseProfile(
    {
      ageRange: row.age_range,
      goal: row.goal,
      firstName: row.first_name,
      region: row.region,
      school: row.school,
      parentalConfirmation: row.parental_confirmation,
      consentAt: row.consent_at,
    },
    { isStudent: typeof row.school === 'string' && row.school !== '' }
  )
  return r.ok ? r.profile : null
}

/** Maps whatever the SDK threw or returned to one of our reasons. Never throws. */
export function mapAuthError(e: unknown): AccountFailureReason {
  const x = (e ?? {}) as { code?: unknown; status?: unknown; message?: unknown; name?: unknown }
  const code = typeof x.code === 'string' ? x.code : ''
  const message = typeof x.message === 'string' ? x.message.toLowerCase() : ''
  const name = typeof x.name === 'string' ? x.name : ''
  const status = typeof x.status === 'number' ? x.status : 0
  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) return 'invalid-credentials'
  if (code === 'user_already_exists' || code === 'email_exists' || message.includes('already registered')) return 'email-taken'
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) return 'email-not-confirmed'
  if (code === 'weak_password' || message.includes('password should be')) return 'weak-password'
  if (code === 'email_address_invalid' || code === 'validation_failed' || message.includes('invalid email')) return 'invalid-email'
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || status === 429) return 'rate-limited'
  if (name.endsWith('FetchError') || message.includes('failed to fetch') || message.includes('network')) return 'network'
  if (code === 'session_not_found' || code === 'user_not_found' || status === 401) return 'not-signed-in'
  return 'unknown'
}

const failure = (e: unknown): Failure => ({ ok: false, reason: mapAuthError(e) })

function toUser(u: { id: string; email?: string | null } | null | undefined): AccountUser | null {
  return u ? { id: u.id, email: u.email ?? null } : null
}

function redirectUrl(): string | undefined {
  return typeof location === 'undefined' ? undefined : location.origin + location.pathname
}

/** Builds the service from an explicit config (tests) or, when `cfg` is omitted, from the build-time environment. */
export function createSupabaseService(cfg?: SupabaseConfig): AccountService {
  const url = cfg ? cfg.url : (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  const anonKey = cfg ? cfg.anonKey : (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  if (typeof url !== 'string' || url.trim() === '' || typeof anonKey !== 'string' || anonKey.trim() === '') return failingService('not-configured')

  const client = (cfg?.makeClient ?? createClient)(url.trim(), anonKey.trim(), CLIENT_OPTIONS)

  async function sessionUser(): Promise<AccountUser | null> {
    try {
      const { data } = await client.auth.getSession()
      return toUser(data.session?.user)
    } catch {
      return null
    }
  }

  return {
    async signUpEmail(email, password) {
      try {
        const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl() } })
        if (error) return failure(error)
        // With e-mail confirmation on, an address that already exists comes back as a user with no identities and no error.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return { ok: false, reason: 'email-taken' }
        return { ok: true, user: toUser(data.session?.user ?? data.user), needsEmailConfirmation: data.session === null }
      } catch (e) {
        return failure(e)
      }
    },
    async signInEmail(email, password) {
      try {
        const { data, error } = await client.auth.signInWithPassword({ email, password })
        if (error) return failure(error)
        const user = toUser(data.user)
        return user ? { ok: true, user } : { ok: false, reason: 'unknown' }
      } catch (e) {
        return failure(e)
      }
    },
    async signInGoogle() {
      try {
        const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } })
        return error ? failure(error) : { ok: true, redirecting: true }
      } catch (e) {
        return failure(e)
      }
    },
    async signOut() {
      try {
        const { error } = await client.auth.signOut()
        return error ? failure(error) : { ok: true }
      } catch (e) {
        return failure(e)
      }
    },
    currentUser: sessionUser,
    async saveProfile(profile) {
      try {
        const user = await sessionUser()
        if (!user) return { ok: false, reason: 'not-signed-in' }
        const { error } = await client.from('profiles').upsert(toRow(user.id, profile), { onConflict: 'id' })
        return error ? failure(error) : { ok: true }
      } catch (e) {
        return failure(e)
      }
    },
    async loadProfile() {
      try {
        const user = await sessionUser()
        if (!user) return { ok: false, reason: 'not-signed-in' }
        const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle()
        if (error) return failure(error)
        return { ok: true, profile: data ? fromRow(data as Record<string, unknown>) : null }
      } catch (e) {
        return failure(e)
      }
    },
    async deleteAccount() {
      try {
        const user = await sessionUser()
        if (!user) return { ok: false, reason: 'not-signed-in' }
        // The authenticated edge function removes the profile row and the auth user with the service role; the caller's own JWT is the
        // only identity it trusts (no id is sent in the body).
        const { error } = await client.functions.invoke('delete-account', { method: 'POST' })
        if (error) return failure(error)
        // The user no longer exists on the server: end the local session only.
        await client.auth.signOut({ scope: 'local' })
        return { ok: true }
      } catch (e) {
        return failure(e)
      }
    },
    onAuthChange(cb) {
      try {
        const { data } = client.auth.onAuthStateChange((_event, session) => cb(toUser(session?.user)))
        return () => data.subscription.unsubscribe()
      } catch {
        return () => undefined
      }
    },
  }
}
