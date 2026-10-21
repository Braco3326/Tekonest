/**
 * The tutor's grounding corpus — built exclusively from the platform's own
 * typed data: référentiel officiel, blocs RNCP, contenu du cours E3/PTES,
 * index des annales. No external knowledge lives here.
 *
 * Retrieval is deliberately simple (keyword scoring over normalized French
 * text): the corpus is small and structured, a vector DB would be overkill
 * (see docs/adr/0001-assistant-ia-tuteur.md).
 */

import { COURSES } from "@/data/courses";
import { EPREUVES, BLOCS, GRILLE_HORAIRE, SOURCES_OFFICIELLES, TOTAL_COEFFICIENTS } from "@/data/referentiel";
import { ANNALES } from "@/data/annales";
import type { LessonBlock } from "@/data/types";

export interface Passage {
  /** Stable id, cited by the model as [source: id]. */
  id: string;
  title: string;
  /** Human label shown in the UI ("Cours E3 · Unité 1", "Référentiel"...). */
  sourceLabel: string;
  /** Optional in-app link for the citation chip. */
  href?: string;
  text: string;
}

function blockToText(block: LessonBlock): string {
  switch (block.type) {
    case "h2":
    case "h3":
      return block.text;
    case "p":
      return block.text;
    case "list":
      return block.items.join(" · ");
    case "table":
      return [
        block.caption ?? "",
        block.header.join(" | "),
        ...block.rows.map((r) => r.join(" | ")),
      ].join("\n");
    case "formula":
      return `${block.latexLike} — ${block.label ?? ""}`;
    case "example":
      return `Exercice résolu : ${block.title}. ${block.problem} Étapes : ${block.steps.join(" ")} Réponse : ${block.answer}`;
    case "note":
      return block.text;
    case "figure":
      return block.caption ?? "";
    default:
      return "";
  }
}

function buildLessonPassages(): Passage[] {
  const passages: Passage[] = [];
  for (const course of COURSES) {
    for (const unit of course.units) {
      let sectionTitle = unit.title;
      let sectionParts: string[] = [];
      let sectionIndex = 0;
      const flush = () => {
        const text = sectionParts.join("\n").trim();
        if (text) {
          passages.push({
            id: `${course.slug}/${unit.slug}#${sectionIndex}`,
            title: sectionTitle,
            sourceLabel: `Cours ${course.epreuve} · ${unit.title.split("—")[0].trim()}`,
            href: `/cours/${course.slug}/unite/${unit.slug}`,
            text,
          });
          sectionIndex += 1;
        }
        sectionParts = [];
      };
      for (const block of unit.lesson) {
        if (block.type === "h2") {
          flush();
          sectionTitle = `${unit.title} — ${block.text}`;
          sectionParts.push(block.text);
        } else {
          sectionParts.push(blockToText(block));
        }
      }
      flush();
    }
  }
  return passages;
}

function buildReferentielPassages(): Passage[] {
  const passages: Passage[] = [];
  for (const e of EPREUVES) {
    passages.push({
      id: `referentiel/epreuve-${e.code.toLowerCase()}`,
      title: `Épreuve ${e.code} — ${e.titre}`,
      sourceLabel: "Référentiel officiel",
      href: "/a-propos",
      text: `Épreuve ${e.code} (unité ${e.unite}) : ${e.titre}. Coefficient ${e.coefficient} (sur ${TOTAL_COEFFICIENTS} au total). Forme ponctuelle : ${e.formePonctuelle}. Durée : ${e.duree}.${e.notes ? ` ${e.notes}.` : ""}`,
    });
  }
  for (const b of BLOCS) {
    passages.push({
      id: `referentiel/bloc-${b.code.toLowerCase()}`,
      title: `Bloc de compétences ${b.rncp}`,
      sourceLabel: "RNCP37196",
      href: "/a-propos",
      text: `Bloc ${b.rncp} (${b.code}) : ${b.intitule}. Nature : ${b.nature}.`,
    });
  }
  passages.push({
    id: "referentiel/grille-horaire",
    title: "Grille horaire de la formation (option Son)",
    sourceLabel: "Référentiel officiel",
    href: "/a-propos",
    text: GRILLE_HORAIRE.map(
      (g) => `${g.discipline} : ${g.a1} h/sem en 1re année, ${g.a2} h/sem en 2e année, ${g.global} h au total`
    ).join("\n"),
  });
  passages.push({
    id: "referentiel/sources",
    title: "Textes officiels de référence",
    sourceLabel: "Sources officielles",
    href: "/a-propos",
    text: SOURCES_OFFICIELLES.map((s) => `${s.label} — ${s.url}`).join("\n"),
  });
  return passages;
}

function buildAnnalesPassages(): Passage[] {
  return ANNALES.map((a, i) => ({
    id: `annales/${i}`,
    title: `${a.epreuve} — session ${a.session} (${a.type})`,
    sourceLabel: a.official ? "Annale officielle" : "Ressource tierce",
    href: "/annales",
    text: `${a.epreuve} (${a.unite}, option ${a.option}) — session ${a.session} — ${a.type} — ${a.statut}, source ${a.source}. Lien : ${a.lien}`,
  }));
}

let corpusCache: Passage[] | null = null;

export function buildCorpus(): Passage[] {
  if (!corpusCache) {
    corpusCache = [
      ...buildReferentielPassages(),
      ...buildLessonPassages(),
      ...buildAnnalesPassages(),
    ];
  }
  return corpusCache;
}

export function getPassage(id: string): Passage | undefined {
  return buildCorpus().find((p) => p.id === id);
}

/* ---------------- retrieval ---------------- */

const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "d", "l", "et", "ou", "a",
  "au", "aux", "en", "dans", "sur", "pour", "par", "avec", "sans", "que", "qui",
  "quoi", "quel", "quelle", "quels", "quelles", "est", "sont", "etre", "c",
  "ce", "cette", "ces", "se", "sa", "son", "ses", "je", "tu", "il", "elle",
  "on", "nous", "vous", "ils", "elles", "moi", "toi", "me", "te", "ne", "pas",
  "plus", "mais", "donc", "car", "si", "y", "comment", "pourquoi", "combien",
  "explique", "expliquer", "moi", "peux", "peut", "faire", "donne", "donner",
]);

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Keyword retrieval: score = capped term frequency in the body + a boost for
 * title matches. Returns the top-k passages with a strictly positive score.
 */
export function retrieve(query: string, k = 6): Passage[] {
  const terms = Array.from(new Set(tokenize(query)));
  if (terms.length === 0) return [];
  const scored = buildCorpus().map((p) => {
    const body = normalize(p.text);
    const title = normalize(p.title);
    let score = 0;
    for (const term of terms) {
      const occurrences = body.split(term).length - 1;
      score += Math.min(occurrences, 3);
      if (title.includes(term)) score += 3;
    }
    return { p, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.p);
}
