/**
 * ProgressStore — the swappable persistence seam.
 * localStorage implementation today; a backend (Supabase…) drops in later
 * with zero changes to pages/components. See docs/PRODUCT-LATER.md.
 */

import type { Certificate, CourseProgress } from "./model";
import { emptyCourseProgress } from "./model";

export interface ProgressStore {
  getCourseProgress(userId: string, courseId: string): Promise<CourseProgress>;
  markLessonRead(userId: string, courseId: string, unitId: string): Promise<CourseProgress>;
  saveQuizResult(
    userId: string,
    courseId: string,
    unitId: string,
    score: number,
    passed: boolean
  ): Promise<CourseProgress>;
  saveSurvey(
    userId: string,
    courseId: string,
    answers: Record<string, string | number>
  ): Promise<CourseProgress>;
  saveExamAttempt(
    userId: string,
    courseId: string,
    score: number,
    passed: boolean
  ): Promise<CourseProgress>;
  saveCertificate(userId: string, certificate: Certificate): Promise<void>;
  getCertificates(userId: string): Promise<Certificate[]>;
  getCertificateById(userId: string, certificateId: string): Promise<Certificate | null>;
  getAllProgress(userId: string): Promise<Record<string, CourseProgress>>;
}

/* ------------------------------------------------------------------ */

const progressKey = (userId: string) => `technest.progress.${userId}.v1`;
const certsKey = (userId: string) => `technest.certificates.${userId}.v1`;

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export class LocalProgressStore implements ProgressStore {
  private readAll(userId: string): Record<string, CourseProgress> {
    return readJSON<Record<string, CourseProgress>>(progressKey(userId), {});
  }

  private writeAll(userId: string, all: Record<string, CourseProgress>) {
    window.localStorage.setItem(progressKey(userId), JSON.stringify(all));
  }

  private update(
    userId: string,
    courseId: string,
    fn: (p: CourseProgress) => CourseProgress
  ): CourseProgress {
    const all = this.readAll(userId);
    const current = all[courseId] ?? emptyCourseProgress(courseId);
    const next = fn(current);
    all[courseId] = next;
    this.writeAll(userId, all);
    return next;
  }

  async getCourseProgress(userId: string, courseId: string): Promise<CourseProgress> {
    return this.readAll(userId)[courseId] ?? emptyCourseProgress(courseId);
  }

  async getAllProgress(userId: string): Promise<Record<string, CourseProgress>> {
    return this.readAll(userId);
  }

  async markLessonRead(userId: string, courseId: string, unitId: string) {
    return this.update(userId, courseId, (p) => ({
      ...p,
      units: {
        ...p.units,
        [unitId]: {
          ...p.units[unitId],
          lessonReadAt: p.units[unitId]?.lessonReadAt ?? new Date().toISOString(),
        },
      },
    }));
  }

  async saveQuizResult(
    userId: string,
    courseId: string,
    unitId: string,
    score: number,
    passed: boolean
  ) {
    return this.update(userId, courseId, (p) => {
      const prev = p.units[unitId] ?? {};
      const best = Math.max(prev.quizBestScore ?? 0, score);
      return {
        ...p,
        units: {
          ...p.units,
          [unitId]: {
            ...prev,
            quizBestScore: best,
            quizPassedAt: passed
              ? prev.quizPassedAt ?? new Date().toISOString()
              : prev.quizPassedAt,
          },
        },
      };
    });
  }

  async saveSurvey(
    userId: string,
    courseId: string,
    answers: Record<string, string | number>
  ) {
    return this.update(userId, courseId, (p) => ({
      ...p,
      surveyAnswers: answers,
      surveyCompletedAt: p.surveyCompletedAt ?? new Date().toISOString(),
    }));
  }

  async saveExamAttempt(userId: string, courseId: string, score: number, passed: boolean) {
    return this.update(userId, courseId, (p) => ({
      ...p,
      examAttempts: [
        ...p.examAttempts,
        { score, passed, at: new Date().toISOString() },
      ],
    }));
  }

  async saveCertificate(userId: string, certificate: Certificate): Promise<void> {
    const certs = readJSON<Certificate[]>(certsKey(userId), []);
    if (!certs.some((c) => c.courseId === certificate.courseId)) {
      certs.push(certificate);
      window.localStorage.setItem(certsKey(userId), JSON.stringify(certs));
    }
    this.update(userId, certificate.courseId, (p) => ({
      ...p,
      certificateId:
        certs.find((c) => c.courseId === certificate.courseId)?.id ?? certificate.id,
    }));
  }

  async getCertificates(userId: string): Promise<Certificate[]> {
    return readJSON<Certificate[]>(certsKey(userId), []);
  }

  async getCertificateById(userId: string, certificateId: string) {
    const certs = await this.getCertificates(userId);
    return certs.find((c) => c.id === certificateId) ?? null;
  }
}
