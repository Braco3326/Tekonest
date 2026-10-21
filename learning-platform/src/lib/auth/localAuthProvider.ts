import type { AuthProvider, User } from "./types";

/**
 * LocalAuthProvider — mock implementation on localStorage.
 * Looks and feels like a real portal; swap for a backend later
 * (see docs/PRODUCT-LATER.md).
 */

const USERS_KEY = "technest.users.v1";
const SESSION_KEY = "technest.session.v1";

function readUsers(): User[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(USERS_KEY) ?? "[]") as User[];
  } catch {
    return [];
  }
}

function writeUsers(users: User[]) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export class LocalAuthProvider implements AuthProvider {
  async getCurrentUser(): Promise<User | null> {
    if (typeof window === "undefined") return null;
    const id = window.localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    return readUsers().find((u) => u.id === id) ?? null;
  }

  async signUp(name: string, email: string): Promise<User> {
    const users = readUsers();
    const normalized = email.trim().toLowerCase();
    const existing = users.find((u) => u.email === normalized);
    if (existing) {
      throw new Error("Un compte existe déjà avec cet e-mail. Connectez-vous.");
    }
    const user: User = {
      id: `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      email: normalized,
      createdAt: new Date().toISOString(),
    };
    writeUsers([...users, user]);
    window.localStorage.setItem(SESSION_KEY, user.id);
    return user;
  }

  async logIn(email: string): Promise<User> {
    const normalized = email.trim().toLowerCase();
    const user = readUsers().find((u) => u.email === normalized);
    if (!user) {
      throw new Error("Aucun compte trouvé avec cet e-mail. Inscrivez-vous d'abord.");
    }
    window.localStorage.setItem(SESSION_KEY, user.id);
    return user;
  }

  async logOut(): Promise<void> {
    window.localStorage.removeItem(SESSION_KEY);
  }

  async updateProfile(patch: Partial<Pick<User, "name">>): Promise<User> {
    const current = await this.getCurrentUser();
    if (!current) throw new Error("Non connecté.");
    const updated = { ...current, ...patch };
    writeUsers(readUsers().map((u) => (u.id === updated.id ? updated : u)));
    return updated;
  }
}
