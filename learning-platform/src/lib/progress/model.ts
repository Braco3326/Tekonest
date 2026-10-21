/**
 * Progress domain model — pure types + pure gating logic.
 * No storage, no React. Fully unit-tested in gating.test.ts.
 *
 * The model (adapted from professional certification programs):
 *  - a unit is complete when its lesson has been read AND its quiz passed;
 *  - the final exam unlocks only when ALL units and the survey are complete;
 *  - passing the exam (>= passingScore, 70 %) issues the certificate;
 *  - certificates are valid 3 years and carry a unique verification code.
 */

import type { Course } from "@/data/types";

export interface UnitProgress {
  lessonReadAt?: string; // ISO date
  quizBestScore?: number; // fraction 0..1
  quizPassedAt?: string;
}

export interface ExamAttempt {
  score: number; // fraction 0..1
  at: string; // ISO date
  passed: boolean;
}

export interface CourseProgress {
  courseId: string;
  units: Record<string, UnitProgress>;
  surveyCompletedAt?: string;
  surveyAnswers?: Record<string, string | number>;
  examAttempts: ExamAttempt[];
  certificateId?: string;
}

export interface Certificate {
  id: string;
  verificationCode: string; // e.g. TN-2026-4F7A9C2E
  userName: string;
  userEmail: string;
  courseId: string;
  courseTitle: string;
  epreuveCode: string;
  epreuveTitre: string;
  coefficient: number;
  blocs: { rncp: string; intitule: string }[];
  competencies: string[];
  score: number; // fraction 0..1
  issuedAt: string; // ISO date
  expiresAt: string; // ISO date, +3 years
}

/** Threshold for passing a unit quiz (assumption, logged in docs). */
export const UNIT_QUIZ_PASS = 0.7;

export const CERTIFICATE_VALIDITY_YEARS = 3;

export function emptyCourseProgress(courseId: string): CourseProgress {
  return { courseId, units: {}, examAttempts: [] };
}

export function isUnitComplete(progress: CourseProgress, unitId: string): boolean {
  const u = progress.units[unitId];
  return Boolean(u?.lessonReadAt && u.quizPassedAt);
}

export function allUnitsComplete(course: Course, progress: CourseProgress): boolean {
  if (course.units.length === 0) return false;
  return course.units.every((u) => isUnitComplete(progress, u.id));
}

export function isSurveyComplete(progress: CourseProgress): boolean {
  return Boolean(progress.surveyCompletedAt);
}

/**
 * THE gating rule: the exam unlocks only when ALL units AND the survey
 * are complete.
 */
export function isExamUnlocked(course: Course, progress: CourseProgress): boolean {
  return allUnitsComplete(course, progress) && isSurveyComplete(progress);
}

export function bestExamScore(progress: CourseProgress): number | null {
  if (progress.examAttempts.length === 0) return null;
  return Math.max(...progress.examAttempts.map((a) => a.score));
}

export function isExamPassed(course: Course, progress: CourseProgress): boolean {
  const passing = course.exam?.passingScore ?? 0.7;
  const best = bestExamScore(progress);
  return best !== null && best >= passing;
}

export function isCertificateEarned(course: Course, progress: CourseProgress): boolean {
  // The exam can only have been taken if it was unlocked, but we re-check the
  // gate defensively: a certificate requires the full path.
  return isExamUnlocked(course, progress) && isExamPassed(course, progress);
}

/** Completed units / total units, as a fraction for progress bars. */
export function courseCompletion(course: Course, progress: CourseProgress): number {
  const total = course.units.length + 2; // + survey + exam
  if (total === 2 && course.units.length === 0) return 0;
  let done = course.units.filter((u) => isUnitComplete(progress, u.id)).length;
  if (isSurveyComplete(progress)) done += 1;
  if (isExamPassed(course, progress)) done += 1;
  return done / total;
}

export function quizScore(answers: number[], correct: number[]): number {
  if (correct.length === 0) return 0;
  let ok = 0;
  for (let i = 0; i < correct.length; i++) {
    if (answers[i] === correct[i]) ok += 1;
  }
  return ok / correct.length;
}

/** Prerequisites: a course is recommended once its prerequisites are certified. */
export function arePrerequisitesMet(
  course: Course,
  certifiedCourseIds: Set<string>
): boolean {
  return course.prerequisites.every((p) => certifiedCourseIds.has(p));
}

export function makeVerificationCode(random: () => number = Math.random): string {
  const hex = Array.from({ length: 8 }, () =>
    Math.floor(random() * 16).toString(16).toUpperCase()
  ).join("");
  return `TN-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

export function certificateExpiry(issuedAt: Date): Date {
  const d = new Date(issuedAt);
  d.setFullYear(d.getFullYear() + CERTIFICATE_VALIDITY_YEARS);
  return d;
}
