/**
 * AI tutor — unit tests for the grounding mechanisms.
 *
 * The three product guarantees (never gives an exam answer directly, never
 * cites a fact absent from the sources, always cites) are enforced by three
 * mechanisms, each tested here:
 *  1. the system prompt carries the anti-cheat + grounding + citation rules;
 *  2. retrieval only ever returns passages from the typed corpus, and returns
 *     nothing for out-of-domain queries (the prompt then forces an admission);
 *  3. the citation validator flags any cited id that isn't a real source.
 * The model's actual behaviour is verified in tutor.integration.test.ts
 * (runs only when ANTHROPIC_API_KEY is set).
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_MODELS, resolveProvider } from "./llm";
import { buildCorpus, getPassage, retrieve } from "./corpus";
import {
  buildContextBlock,
  buildSystemPrompt,
  extractCitations,
  findInvalidCitations,
} from "./prompt";
import { computeWeakSpots } from "./weakSpots";
import { getCourseBySlug } from "@/data/courses";
import { emptyCourseProgress } from "@/lib/progress/model";

describe("corpus", () => {
  it("builds passages from référentiel, course content and annales", () => {
    const corpus = buildCorpus();
    expect(corpus.length).toBeGreaterThan(30);
    expect(corpus.some((p) => p.id === "referentiel/epreuve-e3")).toBe(true);
    expect(corpus.some((p) => p.id.startsWith("e3-ptes/"))).toBe(true);
    expect(corpus.some((p) => p.id.startsWith("annales/"))).toBe(true);
  });

  it("has unique passage ids", () => {
    const ids = buildCorpus().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("retrieves the Sabine passage for a réverbération question", () => {
    const results = retrieve("Comment calculer le temps de réverbération TR60 avec la formule de Sabine ?");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((p) => p.text.includes("Sabine"))).toBe(true);
  });

  it("retrieves the E3 épreuve for a coefficient question", () => {
    const results = retrieve("Quel est le coefficient de l'épreuve E3 PTES ?");
    expect(results.some((p) => p.id === "referentiel/epreuve-e3")).toBe(true);
  });

  it("returns nothing for an out-of-domain query", () => {
    const results = retrieve("recette de la tarte tatin au caramel");
    expect(results).toHaveLength(0);
  });

  it("getPassage resolves an id returned by retrieval", () => {
    const [first] = retrieve("alimentation fantôme 48V micro statique");
    expect(first).toBeDefined();
    expect(getPassage(first.id)).toEqual(first);
  });
});

describe("system prompt (anti-triche + ancrage)", () => {
  const prompt = buildSystemPrompt();

  it("forbids giving evaluation answers directly", () => {
    expect(prompt).toContain("tu ne la donnes pas directement");
    expect(prompt).toContain("tu refuses poliment");
  });

  it("mandates grounding in the provided sources only", () => {
    expect(prompt).toContain("UNIQUEMENT sur les extraits fournis");
    expect(prompt).toContain("Tu n'inventes JAMAIS");
  });

  it("mandates the citation syntax and the admission of ignorance", () => {
    expect(prompt).toContain("[source: id]");
    expect(prompt).toContain("Je ne trouve pas cela dans mes sources");
  });

  it("is byte-stable across calls (cacheable prefix)", () => {
    expect(buildSystemPrompt()).toBe(prompt);
  });
});

describe("context block", () => {
  it("lists passages with their ids", () => {
    const passages = retrieve("Sabine TR60").slice(0, 2);
    const block = buildContextBlock(passages);
    for (const p of passages) {
      expect(block).toContain(`[id: ${p.id}]`);
    }
  });

  it("instructs to admit ignorance when no passage matched", () => {
    const block = buildContextBlock([]);
    expect(block).toContain("Aucun extrait pertinent");
    expect(block).toContain("sans avancer de fait technique");
  });

  it("includes weak spots when provided", () => {
    const block = buildContextBlock([], {
      weakSpots: [
        { unitId: "e3-u1", unitTitle: "Acoustique", kind: "quiz-echoue", detail: "Quiz échoué — 40 %" },
      ],
    });
    expect(block).toContain("PROGRESSION");
    expect(block).toContain("Acoustique");
  });
});

describe("citation validation", () => {
  const validIds = new Set(buildCorpus().map((p) => p.id));

  it("extracts citations from a reply", () => {
    const text =
      "La célérité vaut environ 344 m/s [source: e3-ptes/acoustique#0] et E3 a un coefficient 4 [source: referentiel/epreuve-e3].";
    expect(extractCitations(text)).toEqual(["e3-ptes/acoustique#0", "referentiel/epreuve-e3"]);
  });

  it("accepts replies that cite only real sources", () => {
    const text = "Le coefficient de E3 est 4 [source: referentiel/epreuve-e3].";
    expect(findInvalidCitations(text, validIds)).toHaveLength(0);
  });

  it("flags a citation that does not exist in the corpus", () => {
    const text = "D'après la norme [source: norme-inventee/xyz], c'est 42.";
    expect(findInvalidCitations(text, validIds)).toEqual(["norme-inventee/xyz"]);
  });

  it("handles replies without citations", () => {
    expect(extractCitations("Bonjour ! Sur quoi travaillez-vous ?")).toHaveLength(0);
  });
});

describe("provider resolution (Claude / Gemini seam)", () => {
  it("returns null when nothing is configured (route answers 501)", () => {
    expect(resolveProvider({})).toBeNull();
  });

  it("prefers Anthropic when both keys are present", () => {
    const r = resolveProvider({ ANTHROPIC_API_KEY: "a", GEMINI_API_KEY: "g" });
    expect(r?.provider).toBe("anthropic");
    expect(r?.model).toBe(DEFAULT_MODELS.anthropic);
  });

  it("falls back to Gemini when only its key is present", () => {
    const r = resolveProvider({ GEMINI_API_KEY: "g" });
    expect(r).toEqual({ provider: "gemini", apiKey: "g", model: DEFAULT_MODELS.gemini });
  });

  it("TUTOR_PROVIDER forces the provider", () => {
    const r = resolveProvider({
      TUTOR_PROVIDER: "gemini",
      ANTHROPIC_API_KEY: "a",
      GEMINI_API_KEY: "g",
    });
    expect(r?.provider).toBe("gemini");
  });

  it("a forced provider without its key yields null, not a silent fallback", () => {
    expect(resolveProvider({ TUTOR_PROVIDER: "gemini", ANTHROPIC_API_KEY: "a" })).toBeNull();
  });

  it("TUTOR_MODEL overrides the default model of either provider", () => {
    const r = resolveProvider({ GEMINI_API_KEY: "g", TUTOR_MODEL: "gemini-2.5-pro" });
    expect(r?.model).toBe("gemini-2.5-pro");
  });
});

describe("weak-spot detection", () => {
  const e3 = getCourseBySlug("e3-ptes")!;

  it("reports every unit as non commencé on empty progress", () => {
    const spots = computeWeakSpots(e3, emptyCourseProgress(e3.id));
    expect(spots).toHaveLength(e3.units.length);
    expect(spots.every((s) => s.kind === "non-commence")).toBe(true);
  });

  it("flags a failed quiz and a fragile pass", () => {
    const progress = emptyCourseProgress(e3.id);
    progress.units[e3.units[0].id] = { lessonReadAt: "2026-01-01", quizBestScore: 0.4 };
    progress.units[e3.units[1].id] = {
      lessonReadAt: "2026-01-01",
      quizBestScore: 0.75,
      quizPassedAt: "2026-01-01",
    };
    const spots = computeWeakSpots(e3, progress);
    expect(spots.find((s) => s.unitId === e3.units[0].id)?.kind).toBe("quiz-echoue");
    expect(spots.find((s) => s.unitId === e3.units[1].id)?.kind).toBe("quiz-fragile");
  });

  it("flags a failed exam, not a passed one", () => {
    const progress = emptyCourseProgress(e3.id);
    for (const u of e3.units) {
      progress.units[u.id] = { lessonReadAt: "x", quizBestScore: 1, quizPassedAt: "x" };
    }
    progress.examAttempts = [{ score: 0.5, at: "x", passed: false }];
    expect(computeWeakSpots(e3, progress).some((s) => s.kind === "examen-non-valide")).toBe(true);
    progress.examAttempts.push({ score: 0.9, at: "x", passed: true });
    expect(computeWeakSpots(e3, progress).some((s) => s.kind === "examen-non-valide")).toBe(false);
  });
});
