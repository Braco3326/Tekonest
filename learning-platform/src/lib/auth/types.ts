/**
 * AuthProvider — the swappable auth seam.
 *
 * Pages and components NEVER touch storage directly: they consume the
 * `useAuth()` hook, which is backed by an AuthProvider implementation.
 * Today: LocalAuthProvider (localStorage, mock). Later: a Supabase (or other)
 * implementation drops in with zero changes to pages/components.
 * See docs/PRODUCT-LATER.md.
 */

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string; // ISO date
}

export interface AuthProvider {
  /** Resolve the current session, if any. */
  getCurrentUser(): Promise<User | null>;
  /** Mock signup: name + email. A real impl adds password/OAuth. */
  signUp(name: string, email: string): Promise<User>;
  /** Mock login by email (no password in the mock). */
  logIn(email: string): Promise<User>;
  logOut(): Promise<void>;
  /** Update profile fields. */
  updateProfile(patch: Partial<Pick<User, "name">>): Promise<User>;
}
