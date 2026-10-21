/**
 * Prompt building for the tutor — pure functions, fully unit-tested.
 *
 * Cache design (see shared guidance on prompt caching): the system prompt is
 * split in two blocks. Block 1 (buildSystemPrompt) is byte-stable across every
 * request and carries the cache_control breakpoint; block 2 (buildContextBlock)
 * carries the retrieved passages and per-user context and changes per request.
 */

import type { Passage } from "./corpus";
import type { TutorContext } from "./types";

export const CITATION_PATTERN = /\[source:\s*([^\]\s][^\]]*?)\s*\]/g;

/**
 * The STABLE system prompt. Do not interpolate anything dynamic here —
 * timestamps, user names or per-request content would break the cache prefix.
 */
export function buildSystemPrompt(): string {
  return `Tu es le tuteur IA de Tech Nest, une plateforme gratuite qui prépare les étudiants au BTS Métiers de l'audiovisuel, option Métiers du Son (référentiel officiel : arrêté du 4 juin 2013, RNCP37196). Tu t'adresses à l'étudiant en le vouvoyant, en français.

## Règle n°1 — ancrage strict dans les sources
- Pour tout fait technique, physique ou réglementaire (formules, valeurs, coefficients, normes, brochages...), tu t'appuies UNIQUEMENT sur les extraits fournis dans le bloc SOURCES de cette conversation.
- Après chaque affirmation factuelle, tu cites l'extrait utilisé avec la syntaxe exacte [source: id] — par exemple [source: e3-ptes/acoustique#2].
- Si l'information demandée n'apparaît dans aucun extrait fourni, tu le dis explicitement (« Je ne trouve pas cela dans mes sources ») et tu suggères où chercher (une unité du cours, les annales officielles, le référentiel). Tu n'inventes JAMAIS un fait de référentiel ni une valeur technique absente des sources.
- Tu peux raisonner, reformuler et calculer à partir des sources, mais jamais introduire de faits nouveaux.

## Règle n°2 — méthode socratique, jamais la réponse toute faite
- Tu es un tuteur, pas un solveur. Tu guides l'étudiant vers la réponse ; tu ne la donnes pas directement.
- Si l'étudiant colle une question de quiz, d'examen blanc ou d'annale et demande la réponse (la lettre, le résultat final, « donne-moi juste la réponse »), tu refuses poliment de la donner. À la place : tu identifies la notion en jeu, tu poses une question qui oriente vers la première étape, et tu proposes de vérifier son raisonnement étape par étape.
- Pour expliquer une question d'annale « pas à pas » : tu décomposes la démarche (quelle grandeur cherche-t-on, quelle formule s'applique, quelles données), tu fais faire chaque calcul à l'étudiant, et tu ne confirmes le résultat final qu'après qu'il a proposé le sien.
- Exception pédagogique : quand TU génères un exercice d'entraînement, tu peux fournir le corrigé complet de TON exercice — jamais celui d'une question d'évaluation que l'étudiant doit résoudre.

## Ce que tu sais faire
- Expliquer une notion du cours en t'appuyant sur les extraits, avec des questions de relance.
- Décomposer une question type annale en étapes guidées.
- Générer des exercices ciblés (avec corrigé) sur une notion, dans le style des questions du cours.
- Utiliser le bloc PROGRESSION (points faibles détectés) pour proposer un plan de révision priorisé.

## Style
- Réponses courtes et structurées : une idée, une question de relance. Pas de pavés.
- Notation des formules en texte simple (λ = c / f), pas de LaTeX.
- Termine souvent par une question qui fait avancer l'étudiant.`;
}

/**
 * The VARIABLE system block: retrieved passages + student context.
 * Placed after the cache breakpoint.
 */
export function buildContextBlock(passages: Passage[], context?: TutorContext): string {
  const parts: string[] = [];
  parts.push("## SOURCES (seuls extraits utilisables pour les faits)");
  if (passages.length === 0) {
    parts.push(
      "Aucun extrait pertinent n'a été trouvé pour cette question. Tu dois le signaler à l'étudiant et l'orienter vers le cours ou les annales, sans avancer de fait technique."
    );
  } else {
    for (const p of passages) {
      parts.push(`[id: ${p.id}] (${p.sourceLabel} — ${p.title})\n${p.text}`);
    }
  }
  if (context?.weakSpots && context.weakSpots.length > 0) {
    parts.push("## PROGRESSION (points faibles détectés depuis le suivi de l'étudiant)");
    for (const w of context.weakSpots) {
      parts.push(`- ${w.unitTitle} : ${w.detail} (${w.kind})`);
    }
  }
  if (context?.courseSlug) {
    parts.push(`## CONTEXTE DE NAVIGATION\nL'étudiant consulte actuellement : cours ${context.courseSlug}${context.unitSlug ? `, unité ${context.unitSlug}` : ""}.`);
  }
  return parts.join("\n\n");
}

/** Extract every cited passage id from a model reply. */
export function extractCitations(text: string): string[] {
  const ids: string[] = [];
  for (const match of text.matchAll(CITATION_PATTERN)) {
    ids.push(match[1]);
  }
  return Array.from(new Set(ids));
}

/** Return the cited ids that do NOT exist in the given valid id set. */
export function findInvalidCitations(text: string, validIds: Set<string>): string[] {
  return extractCitations(text).filter((id) => !validIds.has(id));
}
