import type { Profile } from './profileModel'

/**
 * The account service contract. Two implementations: supabaseService.ts (the real one, the only file that imports the provider's SDK)
 * and fakeService.ts (in memory, injected by tests only). Every call answers with a typed result and NEVER throws for an expected
 * failure (wrong password, e-mail already used, no network, not configured, ...).
 */

export interface AccountUser {
  id: string
  email: string | null
}

export type AccountFailureReason =
  | 'not-configured' // no URL / key at build time: every call answers this
  | 'invalid-credentials'
  | 'email-taken'
  | 'email-not-confirmed'
  | 'weak-password'
  | 'invalid-email'
  | 'not-signed-in'
  | 'rate-limited'
  | 'network'
  | 'unknown'

export interface Failure {
  ok: false
  reason: AccountFailureReason
}

export type Result<T = object> = ({ ok: true } & T) | Failure

export interface SignUpOk {
  /** The new user; null when the provider hides it until the e-mail is confirmed. */
  user: AccountUser | null
  /** True when the provider sent a confirmation e-mail and there is no session yet. */
  needsEmailConfirmation: boolean
}

export interface AccountService {
  signUpEmail(email: string, password: string): Promise<Result<SignUpOk>>
  signInEmail(email: string, password: string): Promise<Result<{ user: AccountUser }>>
  /** Starts the Google redirect flow; the page leaves, the session is picked up when it comes back. */
  signInGoogle(): Promise<Result<{ redirecting: true }>>
  signOut(): Promise<Result>
  /** The signed-in user, or null. Never throws. */
  currentUser(): Promise<AccountUser | null>
  saveProfile(profile: Profile): Promise<Result>
  /** `profile: null` when the signed-in user has no profile yet. */
  loadProfile(): Promise<Result<{ profile: Profile | null }>>
  /** Deletes the profile row and the sign-in account itself, then signs out locally. */
  deleteAccount(): Promise<Result>
  /** Calls `cb` with the user on every sign-in / sign-out. Returns the unsubscribe function. */
  onAuthChange(cb: (user: AccountUser | null) => void): () => void
}

const REASON_FR: Record<AccountFailureReason, string> = {
  'not-configured': 'Les comptes ne sont pas disponibles pour le moment.',
  'invalid-credentials': 'L’adresse e-mail ou le mot de passe est incorrect.',
  'email-taken': 'Cette adresse e-mail est déjà utilisée. Connectez-vous plutôt.',
  'email-not-confirmed': 'Confirmez d’abord votre adresse e-mail grâce au message que vous avez reçu.',
  'weak-password': 'Ce mot de passe est trop faible. Choisissez-en un plus long.',
  'invalid-email': 'Cette adresse e-mail ne semble pas valide.',
  'not-signed-in': 'Vous n’êtes pas connecté(e).',
  'rate-limited': 'Trop de tentatives. Attendez un moment puis réessayez.',
  network: 'La connexion a échoué. Vérifiez votre connexion internet puis réessayez.',
  unknown: 'Une erreur est survenue. Réessayez dans un instant.',
}

/** French, « vous », ready to show in the dialogs. */
export function failureMessage(reason: AccountFailureReason): string {
  return REASON_FR[reason]
}

export const NOT_CONFIGURED: Failure = { ok: false, reason: 'not-configured' }

/** A service whose every call answers the same failure (nobody signed in). Used when the adapter is missing or cannot be loaded. */
export function failingService(reason: AccountFailureReason): AccountService {
  const f: Failure = { ok: false, reason }
  return {
    signUpEmail: async () => f,
    signInEmail: async () => f,
    signInGoogle: async () => f,
    signOut: async () => f,
    currentUser: async () => null,
    saveProfile: async () => f,
    loadProfile: async () => f,
    deleteAccount: async () => f,
    onAuthChange: () => () => undefined,
  }
}
