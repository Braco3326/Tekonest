/**
 * TECH NEST — typed content model.
 * Content is DATA, never hardcoded in components.
 * All référentiel facts (coefficients, formes, durées, blocs) come from the
 * official sources: arrêté du 4 juin 2013 & RNCP37196 — see docs/ and /a-propos.
 */

export type EpreuveCode = "E1" | "E2" | "E3" | "E4" | "E51" | "E52" | "E6";

export type BlocCode = "BC01" | "BC02" | "BC03" | "BC04";

export interface Epreuve {
  code: EpreuveCode;
  unite: string; // U1…U6
  titre: string;
  coefficient: number;
  formeCCF: string;
  formePonctuelle: string;
  duree: string;
  notes?: string;
}

export interface BlocCompetences {
  code: BlocCode;
  rncp: string; // e.g. "RNCP37196BC02"
  intitule: string;
  nature: string;
}

/* ---------- Lesson content blocks (structured prose + diagrams) ---------- */

export type LessonBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string } // supports **bold** and *italic* inline markers
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "table"; caption?: string; header: string[]; rows: string[][] }
  | { type: "formula"; latexLike: string; label?: string } // rendered as styled monospace
  | { type: "example"; title: string; problem: string; steps: string[]; answer: string }
  | { type: "note"; tone: "info" | "warning" | "exam"; text: string }
  | { type: "figure"; figureId: string; caption: string };

/* ---------- Quiz / exam ---------- */

export interface QuizQuestion {
  id: string;
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

export interface Unit {
  id: string; // stable, e.g. "e3-u1"
  slug: string; // url segment, e.g. "acoustique"
  title: string;
  summary: string;
  estimatedMinutes: number;
  lesson: LessonBlock[];
  quiz: QuizQuestion[];
}

export type SurveyQuestion =
  | { id: string; kind: "scale"; question: string } // 1–5
  | { id: string; kind: "text"; question: string };

export interface Exam {
  /** Passing threshold, fraction of 1 (0.7 = 70 %, the certificate gate). */
  passingScore: number;
  description: string;
  questions: QuizQuestion[];
}

/* ---------- Course ---------- */

export type CourseStatus = "available" | "stub";

export interface Course {
  id: string; // e.g. "e3-ptes"
  slug: string; // e.g. "e3-ptes"
  title: string;
  shortTitle: string;
  description: string;
  epreuve: EpreuveCode;
  blocs: BlocCode[];
  /** Competencies displayed on the certificate (derived from the blocs). */
  competencies: string[];
  status: CourseStatus;
  /** Course ids that must be certified before this course is recommended. */
  prerequisites: string[];
  /** Order on the learning path. */
  pathOrder: number;
  stubNote?: string; // shown on "en préparation" courses
  units: Unit[];
  survey: SurveyQuestion[];
  exam: Exam | null; // null for stubs
}

/* ---------- Annales ---------- */

export interface AnnaleEntry {
  session: string; // "2025", "Sujet 0", "2011-2025", "Multi"
  epreuve: string;
  unite: string;
  option: string;
  type: string; // Sujet, Corrigé, Note BO, Hub…
  statut: string; // "Officiel PDF", "Officiel page", "3rd-party", …
  source: string; // eduscol STI, education.gouv, btsmav.fr
  lien: string;
  official: boolean;
}
