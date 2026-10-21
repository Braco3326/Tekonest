import { describe, expect, it } from "vitest";
import type { Course } from "@/data/types";
import {
  allUnitsComplete,
  arePrerequisitesMet,
  bestExamScore,
  certificateExpiry,
  courseCompletion,
  emptyCourseProgress,
  isCertificateEarned,
  isExamPassed,
  isExamUnlocked,
  isUnitComplete,
  makeVerificationCode,
  quizScore,
  type CourseProgress,
} from "./model";

/* ---------- fixtures ---------- */

const course: Course = {
  id: "test-course",
  slug: "test-course",
  title: "Cours de test",
  shortTitle: "Test",
  description: "",
  epreuve: "E3",
  blocs: ["BC02"],
  competencies: [],
  status: "available",
  prerequisites: [],
  pathOrder: 1,
  units: [
    { id: "u1", slug: "u1", title: "U1", summary: "", estimatedMinutes: 10, lesson: [], quiz: [] },
    { id: "u2", slug: "u2", title: "U2", summary: "", estimatedMinutes: 10, lesson: [], quiz: [] },
  ],
  survey: [{ id: "s1", kind: "scale", question: "?" }],
  exam: { passingScore: 0.7, description: "", questions: [] },
};

function progressWith(mutate: (p: CourseProgress) => void): CourseProgress {
  const p = emptyCourseProgress(course.id);
  mutate(p);
  return p;
}

const completedUnit = () => ({
  lessonReadAt: "2026-01-01T00:00:00Z",
  quizBestScore: 0.9,
  quizPassedAt: "2026-01-01T00:00:00Z",
});

/* ---------- unit completion ---------- */

describe("isUnitComplete", () => {
  it("is false with no progress", () => {
    expect(isUnitComplete(emptyCourseProgress(course.id), "u1")).toBe(false);
  });

  it("is false with lesson read but quiz not passed", () => {
    const p = progressWith((p) => {
      p.units.u1 = { lessonReadAt: "2026-01-01T00:00:00Z" };
    });
    expect(isUnitComplete(p, "u1")).toBe(false);
  });

  it("is false with quiz passed but lesson not read", () => {
    const p = progressWith((p) => {
      p.units.u1 = { quizBestScore: 1, quizPassedAt: "2026-01-01T00:00:00Z" };
    });
    expect(isUnitComplete(p, "u1")).toBe(false);
  });

  it("is true with lesson read and quiz passed", () => {
    const p = progressWith((p) => {
      p.units.u1 = completedUnit();
    });
    expect(isUnitComplete(p, "u1")).toBe(true);
  });
});

/* ---------- THE gating rule ---------- */

describe("isExamUnlocked (gating rule)", () => {
  it("locked when nothing is done", () => {
    expect(isExamUnlocked(course, emptyCourseProgress(course.id))).toBe(false);
  });

  it("locked when only some units are complete", () => {
    const p = progressWith((p) => {
      p.units.u1 = completedUnit();
    });
    expect(isExamUnlocked(course, p)).toBe(false);
  });

  it("locked when ALL units are complete but the survey is not", () => {
    const p = progressWith((p) => {
      p.units.u1 = completedUnit();
      p.units.u2 = completedUnit();
    });
    expect(allUnitsComplete(course, p)).toBe(true);
    expect(isExamUnlocked(course, p)).toBe(false);
  });

  it("locked when the survey is complete but a unit is missing", () => {
    const p = progressWith((p) => {
      p.units.u1 = completedUnit();
      p.surveyCompletedAt = "2026-01-01T00:00:00Z";
    });
    expect(isExamUnlocked(course, p)).toBe(false);
  });

  it("unlocked when ALL units AND the survey are complete", () => {
    const p = progressWith((p) => {
      p.units.u1 = completedUnit();
      p.units.u2 = completedUnit();
      p.surveyCompletedAt = "2026-01-01T00:00:00Z";
    });
    expect(isExamUnlocked(course, p)).toBe(true);
  });

  it("a course with zero units never unlocks its exam (stub safety)", () => {
    const stub: Course = { ...course, units: [] };
    const p = progressWith((p) => {
      p.surveyCompletedAt = "2026-01-01T00:00:00Z";
    });
    expect(isExamUnlocked(stub, p)).toBe(false);
  });
});

/* ---------- exam scoring & certificate ---------- */

describe("exam pass & certificate", () => {
  const fullPath = () =>
    progressWith((p) => {
      p.units.u1 = completedUnit();
      p.units.u2 = completedUnit();
      p.surveyCompletedAt = "2026-01-01T00:00:00Z";
    });

  it("69 % does not pass, 70 % passes (boundary)", () => {
    const p69 = fullPath();
    p69.examAttempts.push({ score: 0.69, at: "2026-01-02T00:00:00Z", passed: false });
    expect(isExamPassed(course, p69)).toBe(false);
    expect(isCertificateEarned(course, p69)).toBe(false);

    const p70 = fullPath();
    p70.examAttempts.push({ score: 0.7, at: "2026-01-02T00:00:00Z", passed: true });
    expect(isExamPassed(course, p70)).toBe(true);
    expect(isCertificateEarned(course, p70)).toBe(true);
  });

  it("best score across attempts is used", () => {
    const p = fullPath();
    p.examAttempts.push({ score: 0.5, at: "2026-01-02T00:00:00Z", passed: false });
    p.examAttempts.push({ score: 0.85, at: "2026-01-03T00:00:00Z", passed: true });
    p.examAttempts.push({ score: 0.6, at: "2026-01-04T00:00:00Z", passed: false });
    expect(bestExamScore(p)).toBe(0.85);
    expect(isCertificateEarned(course, p)).toBe(true);
  });

  it("no certificate if the exam was somehow taken while gated", () => {
    const p = progressWith((p) => {
      p.units.u1 = completedUnit(); // u2 missing, no survey
      p.examAttempts.push({ score: 1, at: "2026-01-02T00:00:00Z", passed: true });
    });
    expect(isCertificateEarned(course, p)).toBe(false);
  });
});

/* ---------- scoring helpers ---------- */

describe("quizScore", () => {
  it("scores fraction of correct answers", () => {
    expect(quizScore([0, 1, 2, 3], [0, 1, 2, 0])).toBe(0.75);
  });
  it("empty quiz scores 0", () => {
    expect(quizScore([], [])).toBe(0);
  });
  it("missing answers count as wrong", () => {
    expect(quizScore([0], [0, 1])).toBe(0.5);
  });
});

describe("courseCompletion", () => {
  it("0 when nothing done, 1 when everything done", () => {
    expect(courseCompletion(course, emptyCourseProgress(course.id))).toBe(0);
    const p = progressWith((p) => {
      p.units.u1 = completedUnit();
      p.units.u2 = completedUnit();
      p.surveyCompletedAt = "2026-01-01T00:00:00Z";
      p.examAttempts.push({ score: 0.9, at: "2026-01-02T00:00:00Z", passed: true });
    });
    expect(courseCompletion(course, p)).toBe(1);
  });
});

/* ---------- prerequisites ---------- */

describe("arePrerequisitesMet", () => {
  it("true when no prerequisites", () => {
    expect(arePrerequisitesMet(course, new Set())).toBe(true);
  });
  it("false when a prerequisite is not certified", () => {
    const c: Course = { ...course, prerequisites: ["e3-ptes"] };
    expect(arePrerequisitesMet(c, new Set())).toBe(false);
    expect(arePrerequisitesMet(c, new Set(["e3-ptes"]))).toBe(true);
  });
});

/* ---------- certificate metadata ---------- */

describe("certificate metadata", () => {
  it("verification code has the TN-XXXX-XXXX format and is derived from RNG", () => {
    let i = 0;
    const fake = () => [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8][i++ % 8];
    const code = makeVerificationCode(fake);
    expect(code).toMatch(/^TN-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it("expiry is exactly 3 years after issue", () => {
    const issued = new Date("2026-07-11T12:00:00Z");
    const expires = certificateExpiry(issued);
    expect(expires.toISOString()).toBe("2029-07-11T12:00:00.000Z");
  });
});
