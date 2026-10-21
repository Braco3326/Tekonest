import { beforeEach, describe, expect, it } from "vitest";
import { LocalProgressStore } from "./store";
import type { Certificate } from "./model";

/* Minimal localStorage shim so the store can be tested in node. */
function installFakeLocalStorage() {
  const data = new Map<string, string>();
  const fake = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => void data.clear(),
  };
  (globalThis as Record<string, unknown>).window = { localStorage: fake };
}

const USER = "u_test";
const COURSE = "e3-ptes";

describe("LocalProgressStore (persistence)", () => {
  beforeEach(() => {
    installFakeLocalStorage();
  });

  it("returns empty progress for a fresh user", async () => {
    const store = new LocalProgressStore();
    const p = await store.getCourseProgress(USER, COURSE);
    expect(p.courseId).toBe(COURSE);
    expect(p.units).toEqual({});
    expect(p.examAttempts).toEqual([]);
  });

  it("persists lesson read + quiz result across store instances", async () => {
    const store = new LocalProgressStore();
    await store.markLessonRead(USER, COURSE, "u1");
    await store.saveQuizResult(USER, COURSE, "u1", 0.8, true);

    const reloaded = new LocalProgressStore(); // fresh instance, same storage
    const p = await reloaded.getCourseProgress(USER, COURSE);
    expect(p.units.u1.lessonReadAt).toBeTruthy();
    expect(p.units.u1.quizBestScore).toBe(0.8);
    expect(p.units.u1.quizPassedAt).toBeTruthy();
  });

  it("keeps the best quiz score, and a fail never erases a pass", async () => {
    const store = new LocalProgressStore();
    await store.saveQuizResult(USER, COURSE, "u1", 0.9, true);
    await store.saveQuizResult(USER, COURSE, "u1", 0.3, false);
    const p = await store.getCourseProgress(USER, COURSE);
    expect(p.units.u1.quizBestScore).toBe(0.9);
    expect(p.units.u1.quizPassedAt).toBeTruthy();
  });

  it("accumulates exam attempts", async () => {
    const store = new LocalProgressStore();
    await store.saveExamAttempt(USER, COURSE, 0.5, false);
    await store.saveExamAttempt(USER, COURSE, 0.75, true);
    const p = await store.getCourseProgress(USER, COURSE);
    expect(p.examAttempts).toHaveLength(2);
    expect(p.examAttempts[1].passed).toBe(true);
  });

  it("stores the survey once", async () => {
    const store = new LocalProgressStore();
    await store.saveSurvey(USER, COURSE, { s1: 5 });
    const first = (await store.getCourseProgress(USER, COURSE)).surveyCompletedAt;
    await store.saveSurvey(USER, COURSE, { s1: 2 });
    const p = await store.getCourseProgress(USER, COURSE);
    expect(p.surveyCompletedAt).toBe(first); // completion date is stable
    expect(p.surveyAnswers).toEqual({ s1: 2 });
  });

  it("saves and retrieves certificates; no duplicate per course", async () => {
    const store = new LocalProgressStore();
    const cert: Certificate = {
      id: "cert_1",
      verificationCode: "TN-ABCD-1234",
      userName: "Test",
      userEmail: "t@t.fr",
      courseId: COURSE,
      courseTitle: "PTES",
      epreuveCode: "E3",
      epreuveTitre: "PTES",
      coefficient: 4,
      blocs: [],
      competencies: [],
      score: 0.8,
      issuedAt: "2026-07-11T00:00:00Z",
      expiresAt: "2029-07-11T00:00:00Z",
    };
    await store.saveCertificate(USER, cert);
    await store.saveCertificate(USER, { ...cert, id: "cert_2" }); // same course again
    const certs = await store.getCertificates(USER);
    expect(certs).toHaveLength(1);
    expect(await store.getCertificateById(USER, "cert_1")).toBeTruthy();
    const p = await store.getCourseProgress(USER, COURSE);
    expect(p.certificateId).toBe("cert_1");
  });

  it("isolates progress between users", async () => {
    const store = new LocalProgressStore();
    await store.markLessonRead("alice", COURSE, "u1");
    const bob = await store.getCourseProgress("bob", COURSE);
    expect(bob.units).toEqual({});
  });
});
