"use client";

/**
 * App-wide providers. Components consume ONLY these hooks — never storage
 * directly. Swapping the localStorage implementations for a backend means
 * changing the two `new Local…` lines below (see docs/PRODUCT-LATER.md).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthProvider, User } from "./auth/types";
import { LocalAuthProvider } from "./auth/localAuthProvider";
import type { ProgressStore } from "./progress/store";
import { LocalProgressStore } from "./progress/store";
import type { Certificate, CourseProgress } from "./progress/model";
import { emptyCourseProgress } from "./progress/model";
import type { AiTutor } from "./ai/types";
import { ApiAiTutor } from "./ai/apiTutor";

/* ---- the three swappable implementations (THE seam) ---- */
const authProvider: AuthProvider = new LocalAuthProvider();
const progressStore: ProgressStore = new LocalProgressStore();
const aiTutor: AiTutor = new ApiAiTutor();

/* ---------------- Auth ---------------- */

interface AuthContextValue {
  user: User | null;
  /** true until the session has been resolved (avoids SSR flash). */
  loading: boolean;
  signUp(name: string, email: string): Promise<User>;
  logIn(email: string): Promise<User>;
  logOut(): Promise<void>;
  updateProfile(patch: { name?: string }): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/* ---------------- Progress ---------------- */

interface ProgressContextValue {
  store: ProgressStore;
  /** bumped after every mutation so hooks reload */
  version: number;
  bump(): void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function AppProviders({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    authProvider.getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const auth = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async signUp(name, email) {
        const u = await authProvider.signUp(name, email);
        setUser(u);
        return u;
      },
      async logIn(email) {
        const u = await authProvider.logIn(email);
        setUser(u);
        return u;
      },
      async logOut() {
        await authProvider.logOut();
        setUser(null);
      },
      async updateProfile(patch) {
        const u = await authProvider.updateProfile(patch);
        setUser(u);
      },
    }),
    [user, loading]
  );

  const progress = useMemo<ProgressContextValue>(
    () => ({
      store: progressStore,
      version,
      bump: () => setVersion((v) => v + 1),
    }),
    [version]
  );

  return (
    <AuthContext.Provider value={auth}>
      <ProgressContext.Provider value={progress}>{children}</ProgressContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AppProviders");
  return ctx;
}

export function useProgressStore() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgressStore must be used within AppProviders");
  return ctx;
}

/** The AI tutor seam — components never talk to the API route directly. */
export function useAiTutor(): AiTutor {
  return aiTutor;
}

/** Load (and auto-reload after mutations) the progress of one course. */
export function useCourseProgress(courseId: string): {
  progress: CourseProgress;
  ready: boolean;
  actions: {
    markLessonRead(unitId: string): Promise<void>;
    saveQuizResult(unitId: string, score: number, passed: boolean): Promise<void>;
    saveSurvey(answers: Record<string, string | number>): Promise<void>;
    saveExamAttempt(score: number, passed: boolean): Promise<void>;
    saveCertificate(cert: Certificate): Promise<void>;
  };
} {
  const { user } = useAuth();
  const { store, version, bump } = useProgressStore();
  const [progress, setProgress] = useState<CourseProgress>(() =>
    emptyCourseProgress(courseId)
  );
  const [ready, setReady] = useState(false);
  const userId = user?.id ?? null;

  useEffect(() => {
    let alive = true;
    if (!userId) {
      setProgress(emptyCourseProgress(courseId));
      setReady(true);
      return;
    }
    store.getCourseProgress(userId, courseId).then((p) => {
      if (alive) {
        setProgress(p);
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [userId, courseId, store, version]);

  const requireUser = useCallback(() => {
    if (!userId) throw new Error("Connexion requise");
    return userId;
  }, [userId]);

  const actions = useMemo(
    () => ({
      async markLessonRead(unitId: string) {
        await store.markLessonRead(requireUser(), courseId, unitId);
        bump();
      },
      async saveQuizResult(unitId: string, score: number, passed: boolean) {
        await store.saveQuizResult(requireUser(), courseId, unitId, score, passed);
        bump();
      },
      async saveSurvey(answers: Record<string, string | number>) {
        await store.saveSurvey(requireUser(), courseId, answers);
        bump();
      },
      async saveExamAttempt(score: number, passed: boolean) {
        await store.saveExamAttempt(requireUser(), courseId, score, passed);
        bump();
      },
      async saveCertificate(cert: Certificate) {
        await store.saveCertificate(requireUser(), cert);
        bump();
      },
    }),
    [store, courseId, bump, requireUser]
  );

  return { progress, ready, actions };
}

/** All certificates of the current user (the "Mes certificats" portal). */
export function useCertificates(): { certificates: Certificate[]; ready: boolean } {
  const { user } = useAuth();
  const { store, version } = useProgressStore();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!user) {
      setCertificates([]);
      setReady(true);
      return;
    }
    store.getCertificates(user.id).then((c) => {
      if (alive) {
        setCertificates(c);
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [user, store, version]);

  return { certificates, ready };
}

/** Map of courseId → progress for the current user (catalog / path pages). */
export function useAllProgress(): {
  all: Record<string, CourseProgress>;
  ready: boolean;
} {
  const { user } = useAuth();
  const { store, version } = useProgressStore();
  const [all, setAll] = useState<Record<string, CourseProgress>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!user) {
      setAll({});
      setReady(true);
      return;
    }
    store.getAllProgress(user.id).then((a) => {
      if (alive) {
        setAll(a);
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [user, store, version]);

  return { all, ready };
}
