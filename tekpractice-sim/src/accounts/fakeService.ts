import { type AccountService, type AccountUser, type Failure, type Result, type SignUpOk } from './accountService'
import { type Profile, validateCredentials } from './profileModel'

/**
 * In-memory AccountService for tests. It is injected by tests only: no URL switch, no flag, and no production file imports it
 * (a test pins that). Passwords are kept in plain text in memory because nothing here ever leaves the process.
 */

interface FakeUser extends AccountUser {
  password: string
  confirmed: boolean
}

export interface FakeState {
  users: Map<string, FakeUser>
  profiles: Map<string, Profile>
  session: string | null
  /** When true, every network-like call answers `network`. */
  offline: boolean
  googleStarted: number
}

export interface FakeService extends AccountService {
  state: FakeState
  /** Test helper: mark an e-mail as confirmed (the link in the mail was followed). */
  confirmEmail(email: string): void
  /** Test helper: what happens when the Google redirect comes back. */
  completeGoogleSignIn(email: string): void
}

export interface FakeOptions {
  /** When true, sign-up leaves no session until `confirmEmail` is called. */
  emailConfirmation?: boolean
}

const fail = (reason: Failure['reason']): Failure => ({ ok: false, reason })

export function createFakeService(options: FakeOptions = {}): FakeService {
  const state: FakeState = { users: new Map(), profiles: new Map(), session: null, offline: false, googleStarted: 0 }
  const listeners = new Set<(u: AccountUser | null) => void>()
  let counter = 0

  const publicUser = (u: FakeUser): AccountUser => ({ id: u.id, email: u.email })
  const notify = (): void => {
    const u = state.session ? state.users.get(state.session) : undefined
    const out = u ? publicUser(u) : null
    for (const cb of [...listeners]) cb(out)
  }
  const byEmail = (email: string): FakeUser | undefined => [...state.users.values()].find((u) => u.email === email.trim())
  const setSession = (id: string | null): void => {
    state.session = id
    notify()
  }
  const me = (): FakeUser | null => (state.session ? (state.users.get(state.session) ?? null) : null)
  const newUser = (email: string, password: string, confirmed: boolean): FakeUser => {
    const u: FakeUser = { id: `fake-user-${++counter}`, email: email.trim(), password, confirmed }
    state.users.set(u.id, u)
    return u
  }

  return {
    state,
    async signUpEmail(email, password): Promise<Result<SignUpOk>> {
      if (state.offline) return fail('network')
      const v = validateCredentials(email, password, 'sign-up')
      if (!v.ok) return fail(v.errors[0].field === 'email' ? 'invalid-email' : 'weak-password')
      if (byEmail(email)) return fail('email-taken')
      const confirmed = !options.emailConfirmation
      const u = newUser(email, password, confirmed)
      if (confirmed) {
        setSession(u.id)
        return { ok: true, user: publicUser(u), needsEmailConfirmation: false }
      }
      return { ok: true, user: null, needsEmailConfirmation: true }
    },
    async signInEmail(email, password) {
      if (state.offline) return fail('network')
      const u = byEmail(email)
      if (!u || u.password !== password) return fail('invalid-credentials')
      if (!u.confirmed) return fail('email-not-confirmed')
      setSession(u.id)
      return { ok: true, user: publicUser(u) }
    },
    async signInGoogle() {
      if (state.offline) return fail('network')
      state.googleStarted += 1
      return { ok: true, redirecting: true }
    },
    async signOut() {
      setSession(null)
      return { ok: true }
    },
    async currentUser() {
      const u = me()
      return u ? publicUser(u) : null
    },
    async saveProfile(profile) {
      if (state.offline) return fail('network')
      const u = me()
      if (!u) return fail('not-signed-in')
      state.profiles.set(u.id, { ...profile })
      return { ok: true }
    },
    async loadProfile() {
      if (state.offline) return fail('network')
      const u = me()
      if (!u) return fail('not-signed-in')
      const p = state.profiles.get(u.id)
      return { ok: true, profile: p ? { ...p } : null }
    },
    async deleteAccount() {
      if (state.offline) return fail('network')
      const u = me()
      if (!u) return fail('not-signed-in')
      state.profiles.delete(u.id)
      state.users.delete(u.id)
      setSession(null)
      return { ok: true }
    },
    onAuthChange(cb) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    confirmEmail(email) {
      const u = byEmail(email)
      if (u) u.confirmed = true
    },
    completeGoogleSignIn(email) {
      const u = byEmail(email) ?? newUser(email, '', true)
      setSession(u.id)
    },
  }
}
